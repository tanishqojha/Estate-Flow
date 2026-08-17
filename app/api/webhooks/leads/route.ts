import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/db/activities";
import { getAssignableAgentsWithLoad } from "@/lib/db/assignment";
import { getIntegrationSettings, getOrgIdByWebhookSecret } from "@/lib/db/integration-settings";
import { notify } from "@/lib/db/notifications";
import { startBridgeForLead } from "@/lib/services/bridge-orchestrator";
import { leadAssignmentService } from "@/lib/services/lead-assignment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_SOURCE_LABELS } from "@/lib/types";
import { webhookLeadSchema } from "@/lib/validation/webhook";

export const runtime = "nodejs";

/**
 * Lead-intake webhook (PRD §6.4): POST /api/webhooks/leads
 * Auth: per-org secret via `x-webhook-secret` header (or Bearer token).
 * On receipt: persist (idempotent) → auto-assign → trigger instant bridge →
 * log activity → notify agent.
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const admin = createAdminClient();
  if (!admin) {
    // TODO: set SUPABASE_SERVICE_ROLE_KEY — webhook ingestion needs it.
    return NextResponse.json(
      { ok: false, error: "Server is not configured for webhook ingestion." },
      { status: 503 },
    );
  }

  const organizationId = await getOrgIdByWebhookSecret(secret);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Invalid webhook secret." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = webhookLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid payload.",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // ── Idempotency (Rules.md §6) ──────────────────────────────────────────
  if (input.externalRef) {
    const { data: existing } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("external_ref", input.externalRef)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { ok: true, leadId: existing.id, duplicate: true },
        { status: 200 },
      );
    }
  } else {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", input.phone)
      .gte("created_at", fiveMinAgo)
      .limit(1)
      .maybeSingle();
    if (recent) {
      return NextResponse.json({ ok: true, leadId: recent.id, duplicate: true }, { status: 200 });
    }
  }

  // ── Auto-assignment ────────────────────────────────────────────────────
  const settings = await getIntegrationSettings(organizationId);
  const mode = settings?.default_assignment_mode ?? "round_robin";
  const candidates = await getAssignableAgentsWithLoad(admin, organizationId);
  const picked = leadAssignmentService.pickAgent(mode, candidates);

  // ── Persist ────────────────────────────────────────────────────────────
  const { data: lead, error: insertError } = await admin
    .from("leads")
    .insert({
      organization_id: organizationId,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      source: input.source,
      property_type: input.propertyType ?? null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      preferred_location: input.preferredLocation ?? null,
      notes: input.notes ?? null,
      assigned_agent_id: picked?.id ?? null,
      external_ref: input.externalRef ?? null,
    })
    .select()
    .single();

  if (insertError || !lead) {
    // Unique violation on external_ref = concurrent duplicate POST.
    if (insertError?.code === "23505" && input.externalRef) {
      const { data: existing } = await admin
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("external_ref", input.externalRef)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { ok: true, leadId: existing.id, duplicate: true },
          { status: 200 },
        );
      }
    }
    console.error("Webhook lead insert failed:", insertError?.message);
    return NextResponse.json({ ok: false, error: "Could not save lead." }, { status: 500 });
  }

  // ── Timeline + notification ────────────────────────────────────────────
  await logActivity(admin, {
    organizationId,
    leadId: lead.id,
    type: "lead_created",
    title: `Lead received from ${LEAD_SOURCE_LABELS[lead.source]}`,
    metadata: { via: "webhook", external_ref: input.externalRef ?? null },
  });

  if (picked) {
    await logActivity(admin, {
      organizationId,
      leadId: lead.id,
      type: "lead_assigned",
      title: `Auto-assigned to ${picked.fullName} (${mode === "least_busy" ? "least busy" : "round robin"})`,
      metadata: { agent_id: picked.id, mode },
    });
    await notify({
      organizationId,
      userId: picked.id,
      type: "lead_assigned",
      title: `New lead: ${lead.full_name}`,
      body: `From ${LEAD_SOURCE_LABELS[lead.source]} — calling you now.`,
      link: `/leads/${lead.id}`,
    });
  }

  // ── Instant bridge ─────────────────────────────────────────────────────
  // Bridge failures never fail the ingestion; the lead is already saved.
  let bridge;
  try {
    bridge = await startBridgeForLead({ organizationId, lead });
  } catch (err) {
    console.error("Bridge trigger failed:", err);
    bridge = null;
  }

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
      assignedAgentId: picked?.id ?? null,
      bridge: bridge
        ? {
            attempted: bridge.attempted,
            dryRun: bridge.dryRun,
            fallback: bridge.fallback,
            detail: bridge.detail,
          }
        : { attempted: false, detail: "Bridge errored — see server logs." },
    },
    { status: 201 },
  );
}

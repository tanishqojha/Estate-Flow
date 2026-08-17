import "server-only";

import { logActivity } from "@/lib/db/activities";
import { getAssignableAgentsWithLoad, getManagers } from "@/lib/db/assignment";
import { insertCall, updateCall } from "@/lib/db/calls";
import { notify } from "@/lib/db/notifications";
import { createCallService } from "@/lib/services/call-service";
import { getOrgIntegrationConfig } from "@/lib/services/config";
import { leadAssignmentService } from "@/lib/services/lead-assignment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBudgetRange } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/types";
import type { LeadRow } from "@/lib/types/database";

/**
 * Instant call bridge orchestration (PRD §6.5, Rules.md §8).
 * Flow: dial assigned agent first → key-press confirm (TwiML, P4 routes) →
 * dial lead → conference. Fallback: next available agent → else mark the
 * lead Call Pending, create a task and notify managers.
 *
 * Runs as a system flow (service role) because it is triggered by webhooks
 * with no user session. All queries are explicitly org-scoped.
 */

export interface BridgeResult {
  attempted: boolean;
  dryRun: boolean;
  callId: string | null;
  agentId: string | null;
  fallback: "none" | "call_pending";
  detail: string;
}

/** Announcement read to the agent before the key-press confirm. */
export function buildAnnouncement(lead: LeadRow): string {
  return (
    `New lead: ${lead.full_name}. ` +
    (lead.property_type ? `${PROPERTY_TYPE_LABELS[lead.property_type]}, ` : "") +
    (lead.preferred_location ? `${lead.preferred_location}, ` : "") +
    `budget ${formatBudgetRange(lead.budget_min, lead.budget_max)}. ` +
    "Press 1 to connect."
  );
}

export async function startBridgeForLead(params: {
  organizationId: string;
  lead: LeadRow;
  initiatedBy?: string | null;
}): Promise<BridgeResult> {
  const { organizationId, lead, initiatedBy = null } = params;
  const admin = createAdminClient();
  if (!admin) {
    // TODO: SUPABASE_SERVICE_ROLE_KEY required for system call logging.
    return {
      attempted: false,
      dryRun: true,
      callId: null,
      agentId: null,
      fallback: "none",
      detail: "Service role key missing — bridge skipped (dry-run).",
    };
  }

  const config = await getOrgIntegrationConfig(organizationId);
  const callService = createCallService(config);

  // Build the agent queue: assigned agent first, then round-robin fallbacks.
  const candidates = await getAssignableAgentsWithLoad(admin, organizationId);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, phone")
    .eq("organization_id", organizationId)
    .in("id", candidates.map((c) => c.id).concat(lead.assigned_agent_id ?? []));

  const phoneById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const queue = leadAssignmentService
    .orderFallbackQueue("round_robin", candidates)
    .filter((a) => phoneById.get(a.id)?.phone);

  if (lead.assigned_agent_id) {
    const idx = queue.findIndex((a) => a.id === lead.assigned_agent_id);
    if (idx > 0) {
      const [assigned] = queue.splice(idx, 1);
      if (assigned) queue.unshift(assigned);
    } else if (idx === -1 && phoneById.get(lead.assigned_agent_id)?.phone) {
      queue.unshift({
        id: lead.assigned_agent_id,
        fullName: phoneById.get(lead.assigned_agent_id)?.full_name ?? "Agent",
        activeLeadCount: 0,
        lastAssignedAt: null,
      });
    }
  }

  const firstAgent = queue[0];
  if (!firstAgent) {
    return markCallPending(organizationId, lead, "No available agent with a phone number.");
  }

  const agentProfile = phoneById.get(firstAgent.id);
  const agentPhone = agentProfile?.phone;
  if (!agentPhone) {
    return markCallPending(organizationId, lead, "Assigned agent has no phone number on file.");
  }

  const announcement = buildAnnouncement(lead);

  const { call } = await insertCall(admin, {
    organization_id: organizationId,
    lead_id: lead.id,
    agent_id: firstAgent.id,
    status: "queued",
    is_dry_run: callService.dryRun,
    metadata: { initiated_by: initiatedBy, queue: queue.map((a) => a.id) },
  });
  if (!call) {
    return {
      attempted: false,
      dryRun: callService.dryRun,
      callId: null,
      agentId: firstAgent.id,
      fallback: "none",
      detail: "Could not create call record.",
    };
  }

  const result = await callService.startBridge({
    agentPhone,
    leadPhone: lead.phone,
    callId: call.id,
    organizationId,
    announcement,
  });

  if (!result.ok) {
    await updateCall(admin, organizationId, call.id, {
      status: "failed",
      metadata: { ...(call.metadata as Record<string, unknown>), error: result.error },
    });
    await logActivity(admin, {
      organizationId,
      leadId: lead.id,
      actorId: initiatedBy,
      type: "call_missed",
      title: "Instant bridge failed to start",
      description: result.error ?? null,
      metadata: { call_id: call.id },
    });
    return markCallPending(organizationId, lead, result.error ?? "Call could not be placed.");
  }

  if (result.dryRun) {
    // Simulate a successful bridge with realistic values (Rules.md §4).
    const duration = 90 + Math.floor(Math.random() * 180);
    const now = new Date();
    await updateCall(admin, organizationId, call.id, {
      call_sid: result.callSid,
      conference_sid: result.conferenceSid,
      status: "completed",
      outcome: "connected",
      duration,
      started_at: now.toISOString(),
      ended_at: new Date(now.getTime() + duration * 1000).toISOString(),
    });
    await admin
      .from("leads")
      .update({ last_contacted_at: now.toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", lead.id);
    await logActivity(admin, {
      organizationId,
      leadId: lead.id,
      actorId: initiatedBy,
      type: "call_completed",
      title: `Instant bridge connected ${firstAgent.fullName} (dry run, ${Math.round(duration / 60)} min)`,
      metadata: { call_id: call.id, dry_run: true },
    });
  } else {
    await updateCall(admin, organizationId, call.id, {
      call_sid: result.callSid,
      conference_sid: result.conferenceSid,
      status: "dialing_agent",
      started_at: new Date().toISOString(),
    });
    await logActivity(admin, {
      organizationId,
      leadId: lead.id,
      actorId: initiatedBy,
      type: "call_placed",
      title: `Instant bridge: dialing ${firstAgent.fullName}`,
      metadata: { call_id: call.id, call_sid: result.callSid },
    });
  }

  return {
    attempted: true,
    dryRun: result.dryRun,
    callId: call.id,
    agentId: firstAgent.id,
    fallback: "none",
    detail: result.dryRun ? "Simulated bridge completed." : "Dialing agent.",
  };
}

/**
 * Agent leg failed (no answer / busy / declined / failed): notify the missed
 * agent, then try the next agent in the queue; when exhausted, Call Pending.
 */
export async function advanceBridgeFallback(callId: string, reason: string): Promise<BridgeResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      attempted: false,
      dryRun: true,
      callId,
      agentId: null,
      fallback: "none",
      detail: "Service role key missing.",
    };
  }

  const { data: call } = await admin.from("calls").select("*").eq("id", callId).maybeSingle();
  if (!call) {
    return {
      attempted: false,
      dryRun: false,
      callId,
      agentId: null,
      fallback: "none",
      detail: "Call not found.",
    };
  }

  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", call.lead_id)
    .maybeSingle();
  if (!lead) {
    return {
      attempted: false,
      dryRun: false,
      callId,
      agentId: null,
      fallback: "none",
      detail: "Lead not found.",
    };
  }

  const meta = (call.metadata ?? {}) as { queue?: string[]; attempt?: number };
  const queue = Array.isArray(meta.queue) ? meta.queue : [];
  const attempt = typeof meta.attempt === "number" ? meta.attempt : 0;

  // Missed-call notification to the agent who didn't pick up (PRD §6.11).
  if (call.agent_id) {
    await notify({
      organizationId: call.organization_id,
      userId: call.agent_id,
      type: "missed_call",
      title: `Missed bridge call: ${lead.full_name}`,
      body: reason,
      link: `/leads/${lead.id}`,
    });
    await logActivity(admin, {
      organizationId: call.organization_id,
      leadId: lead.id,
      type: "call_missed",
      title: `Agent did not answer (${reason})`,
      metadata: { call_id: call.id, agent_id: call.agent_id },
    });
  }

  const nextAttempt = attempt + 1;
  const nextAgentId = queue[nextAttempt];
  if (!nextAgentId) {
    await updateCall(admin, call.organization_id, call.id, {
      status: "no_answer",
      outcome: "no_answer",
      ended_at: new Date().toISOString(),
    });
    return markCallPending(call.organization_id, lead, "No agent answered the bridge call.");
  }

  const { data: nextAgent } = await admin
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", nextAgentId)
    .maybeSingle();
  if (!nextAgent?.phone) {
    return advanceBridgeFallback(callId, "Next agent has no phone on file.");
  }

  const config = await getOrgIntegrationConfig(call.organization_id);
  const callService = createCallService(config);
  const result = await callService.startBridge({
    agentPhone: nextAgent.phone,
    leadPhone: lead.phone,
    callId: call.id,
    organizationId: call.organization_id,
    announcement: buildAnnouncement(lead),
  });

  if (!result.ok) {
    return advanceBridgeFallback(callId, result.error ?? "Next agent dial failed.");
  }

  await updateCall(admin, call.organization_id, call.id, {
    agent_id: nextAgent.id,
    call_sid: result.callSid,
    status: "dialing_agent",
    metadata: { ...meta, attempt: nextAttempt },
  });
  await logActivity(admin, {
    organizationId: call.organization_id,
    leadId: lead.id,
    type: "call_placed",
    title: `Instant bridge: trying next agent ${nextAgent.full_name}`,
    metadata: { call_id: call.id, attempt: nextAttempt },
  });

  return {
    attempted: true,
    dryRun: result.dryRun,
    callId: call.id,
    agentId: nextAgent.id,
    fallback: "none",
    detail: `Dialing fallback agent ${nextAgent.full_name}.`,
  };
}

/** Rules.md §8 fallback: Call Pending + task + manager notification. */
async function markCallPending(
  organizationId: string,
  lead: LeadRow,
  reason: string,
): Promise<BridgeResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      attempted: false,
      dryRun: true,
      callId: null,
      agentId: null,
      fallback: "call_pending",
      detail: reason,
    };
  }

  await admin
    .from("leads")
    .update({ status: "call_pending" })
    .eq("organization_id", organizationId)
    .eq("id", lead.id);

  await logActivity(admin, {
    organizationId,
    leadId: lead.id,
    type: "status_changed",
    title: "Marked Call Pending — no agent reachable",
    description: reason,
  });

  const managers = await getManagers(admin, organizationId);
  const firstManager = managers[0] ?? null;

  await admin.from("tasks").insert({
    organization_id: organizationId,
    title: `Call pending: ${lead.full_name}`,
    description: `Instant bridge could not reach an agent (${reason}). Call the lead back at ${lead.phone}.`,
    lead_id: lead.id,
    assigned_to: firstManager?.id ?? null,
    priority: "urgent",
    due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  await Promise.all(
    managers.map((m) =>
      notify({
        organizationId,
        userId: m.id,
        type: "call_pending",
        title: `Call pending: ${lead.full_name}`,
        body: reason,
        link: `/leads/${lead.id}`,
      }),
    ),
  );

  return {
    attempted: false,
    dryRun: false,
    callId: null,
    agentId: null,
    fallback: "call_pending",
    detail: reason,
  };
}

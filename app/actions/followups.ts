"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/db/activities";
import {
  getFollowup,
  insertFollowup,
  syncLeadNextFollowup,
  updateFollowup,
} from "@/lib/db/followups";
import { getLead } from "@/lib/db/leads";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import { FOLLOWUP_TEMPLATES, type FollowupTemplateKey } from "@/lib/followup-templates";
import type { ActionResult } from "@/lib/types";
import {
  cancelFollowupSchema,
  completeFollowupSchema,
  scheduleFollowupSchema,
  snoozeFollowupSchema,
} from "@/lib/validation/followup";

function templateNote(key: string | null | undefined): string | null {
  if (!key) return null;
  return FOLLOWUP_TEMPLATES[key as FollowupTemplateKey] ?? null;
}

export async function scheduleFollowupAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleFollowupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const lead = await getLead(supabase, profile.organization_id, input.leadId);
    if (!lead) return { ok: false, error: "Lead not found." };

    const note = input.note || templateNote(input.templateKey);
    const { followup, error } = await insertFollowup(supabase, {
      organization_id: profile.organization_id,
      lead_id: lead.id,
      agent_id: lead.assigned_agent_id ?? profile.id,
      due_at: input.dueAt.toISOString(),
      template_key: input.templateKey ?? null,
      note,
    });
    if (error || !followup) return { ok: false, error: error ?? "Could not schedule follow-up" };

    await syncLeadNextFollowup(supabase, profile.organization_id, lead.id);
    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "followup_scheduled",
      title: `Follow-up scheduled for ${input.dueAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      description: note,
      metadata: { followup_id: followup.id },
    });

    revalidatePath("/followups");
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: { id: followup.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not schedule follow-up" };
  }
}

export async function snoozeFollowupAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = snoozeFollowupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const existing = await getFollowup(supabase, profile.organization_id, parsed.data.id);
    if (!existing) return { ok: false, error: "Follow-up not found." };
    if (existing.status === "completed" || existing.status === "cancelled") {
      return { ok: false, error: "This follow-up is already closed." };
    }

    const base = Math.max(Date.now(), new Date(existing.due_at).getTime());
    const newDue = new Date(base + parsed.data.minutes * 60_000);

    const { error } = await updateFollowup(supabase, profile.organization_id, existing.id, {
      due_at: newDue.toISOString(),
      status: "snoozed",
      snooze_count: existing.snooze_count + 1,
      reminder_sent: false,
    });
    if (error) return { ok: false, error };

    await syncLeadNextFollowup(supabase, profile.organization_id, existing.lead_id);
    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: existing.lead_id,
      actorId: profile.id,
      type: "followup_snoozed",
      title: `Follow-up snoozed to ${newDue.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      metadata: { followup_id: existing.id, minutes: parsed.data.minutes },
    });

    revalidatePath("/followups");
    revalidatePath(`/leads/${existing.lead_id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not snooze follow-up" };
  }
}

export async function completeFollowupAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = completeFollowupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const existing = await getFollowup(supabase, profile.organization_id, parsed.data.id);
    if (!existing) return { ok: false, error: "Follow-up not found." };
    if (existing.status === "completed") return { ok: true, data: undefined };

    const { error } = await updateFollowup(supabase, profile.organization_id, existing.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error };

    await syncLeadNextFollowup(supabase, profile.organization_id, existing.lead_id);
    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: existing.lead_id,
      actorId: profile.id,
      type: "followup_completed",
      title: "Follow-up completed",
      description: existing.note,
      metadata: { followup_id: existing.id },
    });

    revalidatePath("/followups");
    revalidatePath(`/leads/${existing.lead_id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not complete follow-up" };
  }
}

export async function cancelFollowupAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = cancelFollowupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const existing = await getFollowup(supabase, profile.organization_id, parsed.data.id);
    if (!existing) return { ok: false, error: "Follow-up not found." };

    const { error } = await updateFollowup(supabase, profile.organization_id, existing.id, {
      status: "cancelled",
    });
    if (error) return { ok: false, error };

    await syncLeadNextFollowup(supabase, profile.organization_id, existing.lead_id);

    revalidatePath("/followups");
    revalidatePath(`/leads/${existing.lead_id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel follow-up" };
  }
}

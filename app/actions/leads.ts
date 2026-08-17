"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/db/activities";
import {
  deleteLead as dbDeleteLead,
  getLead,
  insertLead,
  updateLead as dbUpdateLead,
} from "@/lib/db/leads";
import { notify } from "@/lib/db/notifications";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { LEAD_STATUS_LABELS, TEMPERATURE_LABELS } from "@/lib/types";
import {
  addLeadNoteSchema,
  assignLeadSchema,
  changeLeadStatusSchema,
  changeLeadTemperatureSchema,
  createLeadSchema,
  deleteLeadSchema,
  updateLeadSchema,
} from "@/lib/validation/lead";

/**
 * Lead server actions. Tenant scope always comes from the caller's profile
 * (never client input); RLS enforces it again underneath.
 */

export async function createLeadAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const assignedAgentId =
      input.assignedAgentId ?? (profile.role === "sales_agent" ? profile.id : null);

    const { lead, error } = await insertLead(supabase, {
      organization_id: profile.organization_id,
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || null,
      source: input.source,
      property_type: input.propertyType ?? null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      preferred_location: input.preferredLocation || null,
      notes: input.notes || null,
      assigned_agent_id: assignedAgentId,
    });
    if (error || !lead) return { ok: false, error: error ?? "Could not create lead" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "lead_created",
      title: `Lead created by ${profile.full_name}`,
      metadata: { source: lead.source },
    });

    if (assignedAgentId && assignedAgentId !== profile.id) {
      await logActivity(supabase, {
        organizationId: profile.organization_id,
        leadId: lead.id,
        actorId: profile.id,
        type: "lead_assigned",
        title: "Lead assigned",
      });
      await notify({
        organizationId: profile.organization_id,
        userId: assignedAgentId,
        type: "lead_assigned",
        title: `New lead: ${lead.full_name}`,
        body: "A lead was assigned to you.",
        link: `/leads/${lead.id}`,
      });
    }

    revalidatePath("/leads");
    return { ok: true, data: { id: lead.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create lead" };
  }
}

export async function updateLeadAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, ...input } = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const values: Record<string, unknown> = {};
    if (input.fullName !== undefined) values.full_name = input.fullName;
    if (input.phone !== undefined) values.phone = input.phone;
    if (input.email !== undefined) values.email = input.email || null;
    if (input.source !== undefined) values.source = input.source;
    if (input.propertyType !== undefined) values.property_type = input.propertyType;
    if (input.budgetMin !== undefined) values.budget_min = input.budgetMin;
    if (input.budgetMax !== undefined) values.budget_max = input.budgetMax;
    if (input.preferredLocation !== undefined)
      values.preferred_location = input.preferredLocation || null;
    if (input.notes !== undefined) values.notes = input.notes || null;

    const { lead, error } = await dbUpdateLead(supabase, profile.organization_id, id, values);
    if (error || !lead) return { ok: false, error: error ?? "Could not update lead" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "note_added",
      title: `Details updated by ${profile.full_name}`,
      metadata: { fields: Object.keys(values) },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { ok: true, data: { id: lead.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update lead" };
  }
}

export async function changeLeadStatusAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = changeLeadStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const before = await getLead(supabase, profile.organization_id, parsed.data.id);
    if (!before) return { ok: false, error: "Lead not found" };
    if (before.status === parsed.data.status) return { ok: true, data: undefined };

    const { lead, error } = await dbUpdateLead(supabase, profile.organization_id, parsed.data.id, {
      status: parsed.data.status,
    });
    if (error || !lead) return { ok: false, error: error ?? "Could not change status" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: parsed.data.status === "site_visit_scheduled" ? "site_visit_scheduled" : "status_changed",
      title: `Status: ${LEAD_STATUS_LABELS[before.status]} → ${LEAD_STATUS_LABELS[lead.status]}`,
      metadata: { from: before.status, to: lead.status },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not change status" };
  }
}

export async function changeLeadTemperatureAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = changeLeadTemperatureSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const { lead, error } = await dbUpdateLead(supabase, profile.organization_id, parsed.data.id, {
      temperature: parsed.data.temperature,
    });
    if (error || !lead) return { ok: false, error: error ?? "Could not update temperature" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "temperature_changed",
      title: `Marked ${TEMPERATURE_LABELS[lead.temperature]}`,
      metadata: { to: lead.temperature },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update temperature" };
  }
}

export async function assignLeadAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = assignLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    if (profile.role !== "admin" && profile.role !== "sales_manager") {
      return { ok: false, error: "Only admins and managers can reassign leads." };
    }
    const supabase = await createServerSupabase();

    const before = await getLead(supabase, profile.organization_id, parsed.data.id);
    if (!before) return { ok: false, error: "Lead not found" };

    const { lead, error } = await dbUpdateLead(supabase, profile.organization_id, parsed.data.id, {
      assigned_agent_id: parsed.data.agentId,
    });
    if (error || !lead) return { ok: false, error: error ?? "Could not assign lead" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: before.assigned_agent_id ? "lead_reassigned" : "lead_assigned",
      title: before.assigned_agent_id ? "Lead reassigned" : "Lead assigned",
      metadata: { from: before.assigned_agent_id, to: parsed.data.agentId },
    });

    if (parsed.data.agentId && parsed.data.agentId !== profile.id) {
      await notify({
        organizationId: profile.organization_id,
        userId: parsed.data.agentId,
        type: "lead_assigned",
        title: `Lead assigned: ${lead.full_name}`,
        body: `${profile.full_name} assigned this lead to you.`,
        link: `/leads/${lead.id}`,
      });
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not assign lead" };
  }
}

export async function addLeadNoteAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = addLeadNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    const lead = await getLead(supabase, profile.organization_id, parsed.data.id);
    if (!lead) return { ok: false, error: "Lead not found" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "note_added",
      title: `Note by ${profile.full_name}`,
      description: parsed.data.note,
    });

    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add note" };
  }
}

export async function deleteLeadAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    if (profile.role !== "admin" && profile.role !== "sales_manager") {
      return { ok: false, error: "Only admins and managers can delete leads." };
    }
    const supabase = await createServerSupabase();

    const { error } = await dbDeleteLead(supabase, profile.organization_id, parsed.data.id);
    if (error) return { ok: false, error };

    revalidatePath("/leads");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete lead" };
  }
}

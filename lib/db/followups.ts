import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FollowupRow } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export type FollowupWithLead = FollowupRow & {
  lead: { id: string; full_name: string; phone: string } | null;
  agent: { id: string; full_name: string } | null;
};

const FOLLOWUP_SELECT =
  "*, lead:leads(id, full_name, phone), agent:profiles!followups_agent_id_fkey(id, full_name)";

/** All open + recent follow-ups for the follow-ups tab (RLS scopes rows). */
export async function listFollowups(
  db: Db,
  organizationId: string,
): Promise<{ followups: FollowupWithLead[]; error: string | null }> {
  const { data, error } = await db
    .from("followups")
    .select(FOLLOWUP_SELECT)
    .eq("organization_id", organizationId)
    .order("due_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("listFollowups failed:", error.message);
    return { followups: [], error: error.message };
  }
  return { followups: (data ?? []) as FollowupWithLead[], error: null };
}

export async function getFollowup(
  db: Db,
  organizationId: string,
  followupId: string,
): Promise<FollowupRow | null> {
  const { data, error } = await db
    .from("followups")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", followupId)
    .maybeSingle();
  if (error) {
    console.error("getFollowup failed:", error.message);
    return null;
  }
  return data;
}

export async function insertFollowup(
  db: Db,
  values: Database["public"]["Tables"]["followups"]["Insert"],
): Promise<{ followup: FollowupRow | null; error: string | null }> {
  const { data, error } = await db.from("followups").insert(values).select().single();
  if (error) {
    console.error("insertFollowup failed:", error.message);
    return { followup: null, error: error.message };
  }
  return { followup: data, error: null };
}

export async function updateFollowup(
  db: Db,
  organizationId: string,
  followupId: string,
  values: Database["public"]["Tables"]["followups"]["Update"],
): Promise<{ followup: FollowupRow | null; error: string | null }> {
  const { data, error } = await db
    .from("followups")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", followupId)
    .select()
    .single();
  if (error) {
    console.error("updateFollowup failed:", error.message);
    return { followup: null, error: error.message };
  }
  return { followup: data, error: null };
}

/** Recompute the lead's next_followup_at from its open follow-ups. */
export async function syncLeadNextFollowup(
  db: Db,
  organizationId: string,
  leadId: string,
): Promise<void> {
  const { data } = await db
    .from("followups")
    .select("due_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .in("status", ["pending", "snoozed"])
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  await db
    .from("leads")
    .update({ next_followup_at: data?.due_at ?? null })
    .eq("organization_id", organizationId)
    .eq("id", leadId);
}

/** Pending follow-ups that just became due and haven't been reminded yet. */
export async function getDueUnreminded(db: Db): Promise<FollowupWithLead[]> {
  const { data, error } = await db
    .from("followups")
    .select(FOLLOWUP_SELECT)
    .in("status", ["pending", "snoozed"])
    .eq("reminder_sent", false)
    .lte("due_at", new Date().toISOString())
    .limit(100);
  if (error) {
    console.error("getDueUnreminded failed:", error.message);
    return [];
  }
  return (data ?? []) as FollowupWithLead[];
}

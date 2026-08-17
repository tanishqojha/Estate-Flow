import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadRow } from "@/lib/types/database";
import type { LeadFilters } from "@/lib/validation/lead";

type Db = SupabaseClient<Database>;

export const LEADS_PAGE_SIZE = 25;

/** Lead row with the assigned agent joined for list/detail display. */
export type LeadWithAgent = LeadRow & {
  assigned_agent: { id: string; full_name: string; avatar_url: string | null } | null;
};

const LEAD_WITH_AGENT_SELECT =
  "*, assigned_agent:profiles!leads_assigned_agent_id_fkey(id, full_name, avatar_url)";

export async function listLeads(
  db: Db,
  organizationId: string,
  filters: LeadFilters,
): Promise<{ leads: LeadWithAgent[]; total: number; error: string | null }> {
  let query = db
    .from("leads")
    .select(LEAD_WITH_AGENT_SELECT, { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, " ").trim();
    if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    }
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.temperature) query = query.eq("temperature", filters.temperature);
  if (filters.agent) query = query.eq("assigned_agent_id", filters.agent);

  const from = (filters.page - 1) * LEADS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + LEADS_PAGE_SIZE - 1);

  if (error) {
    console.error("listLeads failed:", error.message);
    return { leads: [], total: 0, error: error.message };
  }
  return { leads: (data ?? []) as LeadWithAgent[], total: count ?? 0, error: null };
}

export async function getLead(
  db: Db,
  organizationId: string,
  leadId: string,
): Promise<LeadWithAgent | null> {
  const { data, error } = await db
    .from("leads")
    .select(LEAD_WITH_AGENT_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) {
    console.error("getLead failed:", error.message);
    return null;
  }
  return data as LeadWithAgent | null;
}

export async function insertLead(
  db: Db,
  values: Database["public"]["Tables"]["leads"]["Insert"],
): Promise<{ lead: LeadRow | null; error: string | null }> {
  const { data, error } = await db.from("leads").insert(values).select().single();
  if (error) {
    console.error("insertLead failed:", error.message);
    return { lead: null, error: error.message };
  }
  return { lead: data, error: null };
}

export async function updateLead(
  db: Db,
  organizationId: string,
  leadId: string,
  values: Database["public"]["Tables"]["leads"]["Update"],
): Promise<{ lead: LeadRow | null; error: string | null }> {
  const { data, error } = await db
    .from("leads")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .select()
    .single();
  if (error) {
    console.error("updateLead failed:", error.message);
    return { lead: null, error: error.message };
  }
  return { lead: data, error: null };
}

export async function deleteLead(
  db: Db,
  organizationId: string,
  leadId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from("leads")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", leadId);
  if (error) {
    console.error("deleteLead failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Active sales agents + managers of the org (for assignment pickers). */
export async function listAssignableAgents(db: Db, organizationId: string) {
  return db
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["sales_agent", "sales_manager", "admin"])
    .order("full_name");
}

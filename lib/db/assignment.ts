import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { AssignableAgent } from "@/lib/services/types";

type Db = SupabaseClient<Database>;

/** Lead statuses that count toward an agent's active load. */
const ACTIVE_STATUSES = [
  "new",
  "contacted",
  "interested",
  "site_visit_scheduled",
  "negotiation",
  "call_pending",
] as const;

/**
 * Candidate agents for auto-assignment: active sales agents with a phone
 * (the bridge needs to dial them), plus their current load and the time of
 * their most recent assignment (for round-robin fairness).
 */
export async function getAssignableAgentsWithLoad(
  db: Db,
  organizationId: string,
): Promise<AssignableAgent[]> {
  const { data: agents, error } = await db
    .from("profiles")
    .select("id, full_name, phone")
    .eq("organization_id", organizationId)
    .eq("role", "sales_agent")
    .eq("is_active", true);
  if (error || !agents) {
    console.error("getAssignableAgentsWithLoad: agents query failed:", error?.message);
    return [];
  }

  const { data: leads, error: leadsError } = await db
    .from("leads")
    .select("assigned_agent_id, status, created_at")
    .eq("organization_id", organizationId)
    .not("assigned_agent_id", "is", null);
  if (leadsError) {
    console.error("getAssignableAgentsWithLoad: leads query failed:", leadsError.message);
  }

  const load = new Map<string, { count: number; lastAssignedAt: string | null }>();
  for (const lead of leads ?? []) {
    const agentId = lead.assigned_agent_id;
    if (!agentId) continue;
    const entry = load.get(agentId) ?? { count: 0, lastAssignedAt: null };
    if ((ACTIVE_STATUSES as readonly string[]).includes(lead.status)) {
      entry.count += 1;
    }
    if (!entry.lastAssignedAt || lead.created_at > entry.lastAssignedAt) {
      entry.lastAssignedAt = lead.created_at;
    }
    load.set(agentId, entry);
  }

  return agents.map((a) => ({
    id: a.id,
    fullName: a.full_name,
    activeLeadCount: load.get(a.id)?.count ?? 0,
    lastAssignedAt: load.get(a.id)?.lastAssignedAt ?? null,
  }));
}

/** Managers + admins of an org (for Call Pending escalation notifications). */
export async function getManagers(db: Db, organizationId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["admin", "sales_manager"]);
  if (error) {
    console.error("getManagers failed:", error.message);
    return [];
  }
  return data ?? [];
}

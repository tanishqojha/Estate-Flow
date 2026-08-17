import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityType, Database, Json } from "@/lib/types/database";

/**
 * activities — the single source of truth for the lead timeline (PRD §5).
 * Every call/message/share/followup/status-change writes a row here via
 * this module (Rules.md §6).
 */

type Db = SupabaseClient<Database>;

export interface LogActivityInput {
  organizationId: string;
  leadId?: string | null;
  actorId?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
  metadata?: Json;
}

export async function logActivity(db: Db, input: LogActivityInput): Promise<void> {
  const { error } = await db.from("activities").insert({
    organization_id: input.organizationId,
    lead_id: input.leadId ?? null,
    actor_id: input.actorId ?? null,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    // Timeline writes must never break the primary action, but they must
    // never fail silently either (Rules.md §5).
    console.error(`Failed to log activity "${input.type}":`, error.message);
  }
}

export async function getLeadTimeline(db: Db, organizationId: string, leadId: string) {
  return db
    .from("activities")
    .select("*, actor:profiles(id, full_name, avatar_url)")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
}

export async function getRecentActivities(db: Db, organizationId: string, limit = 30) {
  return db
    .from("activities")
    .select("*, actor:profiles(id, full_name, avatar_url), lead:leads(id, full_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

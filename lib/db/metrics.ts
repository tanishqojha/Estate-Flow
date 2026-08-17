import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadSource, LeadStatus, ShareChannel } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

/**
 * Dashboard + report aggregations. All queries run through the caller's
 * RLS-scoped client, so an agent's dashboard automatically shows their own
 * numbers while managers see the org.
 */

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string,
): Promise<number> {
  const { count, error } = await query;
  if (error) console.error(`metrics ${label} failed:`, error.message);
  return count ?? 0;
}

export interface DashboardMetrics {
  newLeadsToday: number;
  callsToday: number;
  followupsDue: number;
  hotLeads: number;
  siteVisits: number;
  availableProperties: number;
  checkedInToday: number;
}

export async function getDashboardMetrics(
  db: Db,
  organizationId: string,
): Promise<DashboardMetrics> {
  const today = startOfToday();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [
    newLeadsToday,
    callsToday,
    followupsDue,
    hotLeads,
    siteVisits,
    availableProperties,
    checkedInToday,
  ] = await Promise.all([
    countRows(
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", today),
      "newLeadsToday",
    ),
    countRows(
      db
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", today),
      "callsToday",
    ),
    countRows(
      db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["pending", "snoozed"])
        .lte("due_at", endOfDay.toISOString()),
      "followupsDue",
    ),
    countRows(
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("temperature", "hot")
        .not("status", "in", "(won,lost)"),
      "hotLeads",
    ),
    countRows(
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "site_visit_scheduled"),
      "siteVisits",
    ),
    countRows(
      db
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("availability_status", "available"),
      "availableProperties",
    ),
    countRows(
      db
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("work_date", new Date().toISOString().slice(0, 10))
        .not("check_in_time", "is", null),
      "checkedInToday",
    ),
  ]);

  return {
    newLeadsToday,
    callsToday,
    followupsDue,
    hotLeads,
    siteVisits,
    availableProperties,
    checkedInToday,
  };
}

/** Leads created per day for the last `days` days (inclusive of today). */
export async function getLeadsPerDay(
  db: Db,
  organizationId: string,
  days = 14,
): Promise<{ label: string; value: number }[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const { data, error } = await db
    .from("leads")
    .select("created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", since.toISOString())
    .limit(5000);
  if (error) console.error("getLeadsPerDay failed:", error.message);

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, value]) => {
    const d = new Date(`${date}T00:00:00`);
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value };
  });
}

// ---------------------------------------------------------------------------
// Reports (last 30 days unless stated)
// ---------------------------------------------------------------------------
export interface ReportData {
  leadsBySource: { source: LeadSource; count: number }[];
  leadsByStatus: { status: LeadStatus; count: number }[];
  won: number;
  lost: number;
  agentPerformance: {
    agentId: string;
    name: string;
    totalCalls: number;
    connected: number;
    avgDurationSec: number;
  }[];
  followupsCompleted30d: number;
  sharesByChannel: { channel: ShareChannel; count: number }[];
  attendance30d: { present: number; late: number };
}

export async function getReportData(db: Db, organizationId: string): Promise<ReportData> {
  const since30 = daysAgoIso(30);

  const [leadsRes, callsRes, followupsCompleted, sharesRes, attendanceRes] = await Promise.all([
    db
      .from("leads")
      .select("source, status")
      .eq("organization_id", organizationId)
      .limit(5000),
    db
      .from("calls")
      .select("agent_id, status, duration, agent:profiles!calls_agent_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .gte("created_at", since30)
      .limit(5000),
    countRows(
      db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .gte("updated_at", since30),
      "followupsCompleted",
    ),
    db
      .from("lead_property_shares")
      .select("channel")
      .eq("organization_id", organizationId)
      .gte("created_at", since30)
      .limit(5000),
    db
      .from("attendance")
      .select("status")
      .eq("organization_id", organizationId)
      .gte("work_date", since30.slice(0, 10))
      .limit(5000),
  ]);

  const bySource = new Map<LeadSource, number>();
  const byStatus = new Map<LeadStatus, number>();
  for (const lead of leadsRes.data ?? []) {
    bySource.set(lead.source, (bySource.get(lead.source) ?? 0) + 1);
    byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
  }

  const perAgent = new Map<
    string,
    { name: string; totalCalls: number; connected: number; totalDuration: number }
  >();
  for (const call of callsRes.data ?? []) {
    if (!call.agent_id) continue;
    const agentName =
      (call.agent as { full_name: string } | null)?.full_name ?? "Unknown agent";
    const entry = perAgent.get(call.agent_id) ?? {
      name: agentName,
      totalCalls: 0,
      connected: 0,
      totalDuration: 0,
    };
    entry.totalCalls += 1;
    if (call.status === "completed") {
      entry.connected += 1;
      entry.totalDuration += call.duration ?? 0;
    }
    perAgent.set(call.agent_id, entry);
  }

  const byChannel = new Map<ShareChannel, number>();
  for (const share of sharesRes.data ?? []) {
    byChannel.set(share.channel, (byChannel.get(share.channel) ?? 0) + 1);
  }

  let present = 0;
  let late = 0;
  for (const a of attendanceRes.data ?? []) {
    if (a.status === "late") late += 1;
    else if (a.status === "present" || a.status === "half_day") present += 1;
  }

  return {
    leadsBySource: [...bySource.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    leadsByStatus: [...byStatus.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    won: byStatus.get("won") ?? 0,
    lost: byStatus.get("lost") ?? 0,
    agentPerformance: [...perAgent.entries()]
      .map(([agentId, e]) => ({
        agentId,
        name: e.name,
        totalCalls: e.totalCalls,
        connected: e.connected,
        avgDurationSec: e.connected > 0 ? Math.round(e.totalDuration / e.connected) : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls),
    followupsCompleted30d: followupsCompleted,
    sharesByChannel: [...byChannel.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    attendance30d: { present, late },
  };
}

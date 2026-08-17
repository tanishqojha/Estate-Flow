import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarCheck, Share2 } from "lucide-react";
import { BarList } from "@/components/charts/bar-list";
import { SplitBar } from "@/components/charts/split-bar";
import { StatTile } from "@/components/charts/stat-tile";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportData } from "@/lib/db/metrics";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  SHARE_CHANNEL_LABELS,
} from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

function formatDuration(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_manager") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabase();
  const report = await getReportData(supabase, profile.organization_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        subtitle="Pipeline snapshot · activity over the last 30 days"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads by source</CardTitle>
        </CardHeader>
        <CardContent>
          {report.leadsBySource.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <BarList
              title="Leads by source"
              items={report.leadsBySource.map((r) => ({
                label: LEAD_SOURCE_LABELS[r.source],
                value: r.count,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads by status</CardTitle>
        </CardHeader>
        <CardContent>
          {report.leadsByStatus.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <BarList
              title="Leads by status"
              items={report.leadsByStatus.map((r) => ({
                label: LEAD_STATUS_LABELS[r.status],
                value: r.count,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Won vs lost</CardTitle>
        </CardHeader>
        <CardContent>
          <SplitBar
            leftLabel="Won"
            leftValue={report.won}
            rightLabel="Lost"
            rightValue={report.lost}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agent call performance (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {report.agentPerformance.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No calls logged in the last 30 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Agent</th>
                    <th className="px-2 py-2 text-right font-medium">Calls</th>
                    <th className="px-2 py-2 text-right font-medium">Connected</th>
                    <th className="pl-2 py-2 text-right font-medium">Avg time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.agentPerformance.map((a) => (
                    <tr key={a.agentId} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{a.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.totalCalls}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {a.connected}
                        <span className="text-muted-foreground">
                          {" "}
                          ({a.totalCalls > 0 ? Math.round((a.connected / a.totalCalls) * 100) : 0}%)
                        </span>
                      </td>
                      <td className="pl-2 py-2 text-right tabular-nums">
                        {formatDuration(a.avgDurationSec)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Follow-ups completed (30d)"
          value={report.followupsCompleted30d}
          icon={CalendarCheck}
        />
        <StatTile
          label="Properties shared (30d)"
          value={report.sharesByChannel.reduce((sum, s) => sum + s.count, 0)}
          icon={Share2}
        />
      </div>

      {report.sharesByChannel.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shares by channel (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              title="Shares by channel"
              items={report.sharesByChannel.map((s) => ({
                label: SHARE_CHANNEL_LABELS[s.channel],
                value: s.count,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attendance (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <SplitBar
            leftLabel="On time"
            leftValue={report.attendance30d.present}
            rightLabel="Late"
            rightValue={report.attendance30d.late}
          />
        </CardContent>
      </Card>
    </div>
  );
}

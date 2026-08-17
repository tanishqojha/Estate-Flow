import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Flame,
  MapPin,
  MapPinCheck,
  PhoneCall,
  Plus,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatTile } from "@/components/charts/stat-tile";
import { TrendBars } from "@/components/charts/trend-bars";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivities } from "@/lib/db/activities";
import { getDashboardMetrics, getLeadsPerDay } from "@/lib/db/metrics";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;
  const isManager = profile.role === "admin" || profile.role === "sales_manager";

  const [metrics, trend, activitiesResult] = await Promise.all([
    getDashboardMetrics(supabase, profile.organization_id),
    getLeadsPerDay(supabase, profile.organization_id, 14),
    getRecentActivities(supabase, profile.organization_id, 12),
  ]);
  const activities = activitiesResult.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Hi, ${firstName} 👋`}
        subtitle={isManager ? "Your team at a glance." : "Your day at a glance."}
        action={
          <Button asChild size="sm">
            <Link href="/leads/new">
              <Plus aria-hidden /> Lead
            </Link>
          </Button>
        }
      />

      {/* KPI tiles (PRD §6.2) */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="New leads today"
          value={metrics.newLeadsToday}
          icon={UserPlus}
          href="/leads?status=new"
        />
        <StatTile label="Calls today" value={metrics.callsToday} icon={PhoneCall} />
        <StatTile
          label="Follow-ups due"
          value={metrics.followupsDue}
          icon={CalendarClock}
          href="/followups"
          tone={metrics.followupsDue > 0 ? "attention" : "default"}
        />
        <StatTile
          label="Hot leads"
          value={metrics.hotLeads}
          icon={Flame}
          href="/leads?temperature=hot"
        />
        <StatTile
          label="Site visits"
          value={metrics.siteVisits}
          icon={MapPin}
          href="/leads?status=site_visit_scheduled"
        />
        <StatTile
          label="Available inventory"
          value={metrics.availableProperties}
          icon={Building2}
          href="/properties?availability=available"
        />
      </div>

      {isManager ? (
        <StatTile
          label="Checked in today"
          value={metrics.checkedInToday}
          icon={MapPinCheck}
          href="/attendance"
          sub="Tap for the full roster"
        />
      ) : null}

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New leads — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendBars points={trend} title="New leads per day, last 14 days" />
        </CardContent>
      </Card>

      {/* Activity feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Activity from calls, shares and follow-ups will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => {
                const lead = a.lead as { id: string; full_name: string } | null;
                return (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="leading-snug">
                        {a.title}
                        {lead ? (
                          <>
                            {" · "}
                            <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                              {lead.full_name}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

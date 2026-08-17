import type { Metadata } from "next";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { HistoryList } from "@/components/attendance/history-list";
import { TeamToday } from "@/components/attendance/team-today";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTodayAttendance,
  listMyAttendance,
  listTodayOrgAttendance,
} from "@/lib/db/attendance";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const isManager = profile.role === "admin" || profile.role === "sales_manager";

  const [today, history] = await Promise.all([
    getTodayAttendance(supabase, profile.organization_id, profile.id),
    listMyAttendance(supabase, profile.organization_id, profile.id),
  ]);

  let teamRecords: Awaited<ReturnType<typeof listTodayOrgAttendance>> = [];
  let members: { id: string; full_name: string; role: UserRole }[] = [];
  if (isManager) {
    teamRecords = await listTodayOrgAttendance(supabase, profile.organization_id);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("full_name");
    members = data ?? [];
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" subtitle="GPS check-in / check-out" />

      <CheckInCard today={today} />

      {isManager ? (
        <Tabs defaultValue="team">
          <TabsList className="w-full">
            <TabsTrigger value="team" className="flex-1">
              Team today
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              My history
            </TabsTrigger>
          </TabsList>
          <TabsContent value="team" className="mt-3">
            <TeamToday records={teamRecords} members={members} />
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            <HistoryList records={history} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">My history</h2>
          <HistoryList records={history} />
        </div>
      )}
    </div>
  );
}

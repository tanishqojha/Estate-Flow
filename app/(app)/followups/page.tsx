import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { isPast, isToday } from "date-fns";
import { FollowupCard } from "@/components/followups/followup-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listFollowups, type FollowupWithLead } from "@/lib/db/followups";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Follow-ups" };

function FollowupList({
  followups,
  showAgent,
  emptyTitle,
  emptyDescription,
}: {
  followups: FollowupWithLead[];
  showAgent: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (followups.length === 0) {
    return <EmptyState icon={CalendarCheck} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="space-y-3">
      {followups.map((f) => (
        <FollowupCard key={f.id} followup={f} showAgent={showAgent} />
      ))}
    </div>
  );
}

export default async function FollowupsPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const isManager = profile.role === "admin" || profile.role === "sales_manager";

  const { followups, error } = await listFollowups(supabase, profile.organization_id);
  if (error) throw new Error(`Could not load follow-ups: ${error}`);

  const open = followups.filter((f) => f.status === "pending" || f.status === "snoozed");
  const due = open.filter((f) => isPast(new Date(f.due_at)) || isToday(new Date(f.due_at)));
  const upcoming = open.filter((f) => !due.includes(f));
  const done = followups
    .filter((f) => f.status === "completed")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Follow-ups"
        subtitle={`${due.length} due · ${upcoming.length} upcoming`}
      />

      <Tabs defaultValue="due">
        <TabsList className="w-full">
          <TabsTrigger value="due" className="flex-1">
            Due{due.length > 0 ? ` (${due.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1">
            Done
          </TabsTrigger>
        </TabsList>
        <TabsContent value="due" className="mt-3">
          <FollowupList
            followups={due}
            showAgent={isManager}
            emptyTitle="Nothing due right now"
            emptyDescription="Follow-ups due today or overdue will appear here."
          />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-3">
          <FollowupList
            followups={upcoming}
            showAgent={isManager}
            emptyTitle="No upcoming follow-ups"
            emptyDescription="Schedule one from any lead's page — one tap on the Follow-up button."
          />
        </TabsContent>
        <TabsContent value="done" className="mt-3">
          <FollowupList
            followups={done}
            showAgent={isManager}
            emptyTitle="Nothing completed yet"
            emptyDescription="Completed follow-ups show up here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

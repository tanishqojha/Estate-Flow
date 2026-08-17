import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireProfile } from "@/lib/db/profiles";
import { getMyNotifications } from "@/lib/db/notifications";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const { data: notifications, error } = await getMyNotifications(supabase, profile.id);

  if (error) {
    throw new Error(`Could not load notifications: ${error.message}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" />

      {!notifications || notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New lead assignments, missed calls and due follow-ups will show up here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const inner = (
              <Card
                className={cn(
                  "flex flex-col gap-0.5 p-4",
                  !n.read_at && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read_at ? (
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  ) : null}
                </div>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </Card>
            );
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                className="block rounded-xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

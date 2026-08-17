import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { Clock, Phone, UserRound } from "lucide-react";
import { FollowupActions } from "@/components/followups/followup-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FollowupWithLead } from "@/lib/db/followups";
import { cn } from "@/lib/utils";

export function FollowupCard({
  followup,
  showAgent,
}: {
  followup: FollowupWithLead;
  showAgent: boolean;
}) {
  const due = new Date(followup.due_at);
  const open = followup.status === "pending" || followup.status === "snoozed";
  const overdue = open && isPast(due) && !isToday(due);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {followup.lead ? (
            <Link href={`/leads/${followup.lead.id}`} className="font-semibold hover:underline">
              {followup.lead.full_name}
            </Link>
          ) : (
            <p className="font-semibold text-muted-foreground">Lead removed</p>
          )}
          {followup.note ? (
            <p className="text-sm text-muted-foreground">{followup.note}</p>
          ) : null}
        </div>
        {followup.status === "completed" ? (
          <Badge variant="success">Done</Badge>
        ) : followup.status === "cancelled" ? (
          <Badge variant="secondary">Cancelled</Badge>
        ) : overdue ? (
          <Badge variant="destructive">Overdue</Badge>
        ) : followup.status === "snoozed" ? (
          <Badge variant="warning">Snoozed</Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
          <Clock className="size-3" aria-hidden />
          {isToday(due) ? `Today ${format(due, "p")}` : format(due, "d MMM, p")}
        </span>
        {showAgent && followup.agent ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3" aria-hidden />
            {followup.agent.full_name}
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="flex items-center gap-2">
          {followup.lead ? (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${followup.lead.phone}`} aria-label={`Call ${followup.lead.full_name}`}>
                <Phone aria-hidden /> Call
              </a>
            </Button>
          ) : null}
          <FollowupActions followupId={followup.id} />
        </div>
      ) : null}
    </Card>
  );
}

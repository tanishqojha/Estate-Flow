import {
  ArrowRightLeft,
  CalendarCheck,
  CalendarClock,
  Flame,
  Mail,
  MessageSquare,
  PhoneCall,
  PhoneMissed,
  Share2,
  Sparkles,
  StickyNote,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityRow, ActivityType } from "@/lib/types/database";

const ICONS: Partial<Record<ActivityType, LucideIcon>> = {
  lead_created: Sparkles,
  lead_assigned: UserPlus,
  lead_reassigned: ArrowRightLeft,
  status_changed: ArrowRightLeft,
  temperature_changed: Flame,
  note_added: StickyNote,
  call_placed: PhoneCall,
  call_completed: PhoneCall,
  call_missed: PhoneMissed,
  message_sent: MessageSquare,
  email_sent: Mail,
  property_shared: Share2,
  followup_scheduled: CalendarClock,
  followup_completed: CalendarCheck,
  followup_snoozed: CalendarClock,
  site_visit_scheduled: CalendarCheck,
};

export type TimelineActivity = ActivityRow & {
  actor: { id: string; full_name: string; avatar_url: string | null } | null;
};

/** The lead's audit trail — everything renders from `activities` (PRD §5). */
export function LeadTimeline({ activities }: { activities: TimelineActivity[] }) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet — calls, notes and shares will appear here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-[15px] before:w-px before:bg-border">
      {activities.map((activity) => {
        const Icon = ICONS[activity.type] ?? StickyNote;
        return (
          <li key={activity.id} className="relative flex gap-3 pl-0">
            <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium">{activity.title}</p>
              {activity.description ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {activity.description}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                {activity.actor ? ` · ${activity.actor.full_name}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

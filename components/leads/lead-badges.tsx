import { Flame, Snowflake, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABELS, TEMPERATURE_LABELS } from "@/lib/types";
import type { LeadStatus, LeadTemperature } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  contacted: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  interested: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  site_visit_scheduled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  negotiation: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  won: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  not_responding: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  call_pending: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
};

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_STYLES[status], className)}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

const TEMP_META: Record<
  LeadTemperature,
  { icon: typeof Flame; className: string }
> = {
  hot: { icon: Flame, className: "text-red-600 dark:text-red-400" },
  warm: { icon: Sun, className: "text-amber-600 dark:text-amber-400" },
  cold: { icon: Snowflake, className: "text-sky-600 dark:text-sky-400" },
};

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: LeadTemperature;
  className?: string;
}) {
  const { icon: Icon, className: color } = TEMP_META[temperature];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color, className)}>
      <Icon className="size-3.5" aria-hidden />
      {TEMPERATURE_LABELS[temperature]}
    </span>
  );
}

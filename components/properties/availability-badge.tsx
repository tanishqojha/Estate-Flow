import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_LABELS } from "@/lib/types";
import type { AvailabilityStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  hold: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  sold: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  rented: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function AvailabilityBadge({
  status,
  className,
}: {
  status: AvailabilityStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[status], className)}>
      {AVAILABILITY_LABELS[status]}
    </Badge>
  );
}

import { format } from "date-fns";
import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import type { AttendanceRow } from "@/lib/types/database";

export function HistoryList({ records }: { records: AttendanceRow[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No attendance history yet"
        description="Your check-ins will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <Card key={r.id} className="flex items-center justify-between gap-2 p-3">
          <div>
            <p className="text-sm font-medium">
              {format(new Date(`${r.work_date}T00:00:00`), "EEE, d MMM")}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.check_in_time ? format(new Date(r.check_in_time), "p") : "—"}
              {" → "}
              {r.check_out_time ? format(new Date(r.check_out_time), "p") : "—"}
            </p>
          </div>
          <Badge
            variant={
              r.status === "late" ? "warning" : r.status === "absent" ? "destructive" : "success"
            }
          >
            {ATTENDANCE_STATUS_LABELS[r.status]}
          </Badge>
        </Card>
      ))}
    </div>
  );
}

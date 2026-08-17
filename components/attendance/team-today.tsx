import { format } from "date-fns";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AttendanceWithUser } from "@/lib/db/attendance";
import { ROLE_LABELS } from "@/lib/types";
import type { ProfileRow, UserRole } from "@/lib/types/database";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Admin roster (PRD §6.10): who's in, late, and who hasn't shown up. */
export function TeamToday({
  records,
  members,
}: {
  records: AttendanceWithUser[];
  members: Pick<ProfileRow, "id" | "full_name" | "role">[];
}) {
  const recordByUser = new Map(records.map((r) => [r.user_id, r]));
  const absent = members.filter((m) => !recordByUser.get(m.id)?.check_in_time);

  if (members.length === 0) {
    return <EmptyState icon={UsersRound} title="No team members yet" />;
  }

  return (
    <div className="space-y-2">
      {records
        .filter((r) => r.check_in_time)
        .map((r) => (
          <Card key={r.id} className="flex items-center gap-3 p-3">
            <Avatar className="size-9">
              <AvatarFallback className="text-xs font-semibold">
                {initials(r.user?.full_name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.user?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">
                In {r.check_in_time ? format(new Date(r.check_in_time), "p") : "—"}
                {r.check_out_time ? ` · Out ${format(new Date(r.check_out_time), "p")}` : ""}
              </p>
            </div>
            <Badge variant={r.status === "late" ? "warning" : "success"}>
              {r.status === "late" ? "Late" : "In"}
            </Badge>
          </Card>
        ))}

      {absent.map((m) => (
        <Card key={m.id} className="flex items-center gap-3 p-3 opacity-70">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs font-semibold">
              {initials(m.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[m.role as UserRole] ?? m.role}
            </p>
          </div>
          <Badge variant="destructive">Not in</Badge>
        </Card>
      ))}
    </div>
  );
}

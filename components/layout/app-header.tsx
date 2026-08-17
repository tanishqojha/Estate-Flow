import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import type { ProfileRow } from "@/lib/types/database";

/** Sticky top bar: org context + notifications + account menu. */
export function AppHeader({
  profile,
  orgName,
  unreadCount,
}: {
  profile: ProfileRow;
  orgName: string;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/dashboard" className="min-w-0">
          <span className="block truncate text-base font-semibold">{orgName}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-lg" className="relative">
            <Link href="/notifications" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}>
              <Bell className="size-5" aria-hidden />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <UserMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}

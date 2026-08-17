"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  cancelFollowupAction,
  completeFollowupAction,
  snoozeFollowupAction,
} from "@/app/actions/followups";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SNOOZES = [
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
  { label: "Tomorrow", minutes: 60 * 24 },
  { label: "Next week", minutes: 60 * 24 * 7 },
] as const;

export function FollowupActions({ followupId }: { followupId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error("error" in result && result.error ? result.error : "Something went wrong");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 items-center justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <AlarmClock aria-hidden /> Snooze <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SNOOZES.map((s) => (
            <DropdownMenuItem
              key={s.minutes}
              onSelect={() =>
                run(() => snoozeFollowupAction({ id: followupId, minutes: s.minutes }), `Snoozed ${s.label.toLowerCase()}`)
              }
            >
              {s.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => run(() => cancelFollowupAction({ id: followupId }), "Follow-up cancelled")}
          >
            Cancel follow-up
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => completeFollowupAction({ id: followupId }), "Follow-up completed")}
      >
        <Check aria-hidden /> Done
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { startBridgeAction } from "@/app/actions/calls";
import { Button } from "@/components/ui/button";

/**
 * Primary "Call" action: triggers the instant bridge (agent's phone rings
 * first, then the lead is conferenced in). One tap, thumb reach (Rules.md §7).
 */
export function CallLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="h-auto flex-col gap-1 py-2.5"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startBridgeAction({ leadId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            result.dryRun
              ? `Bridge simulated (dry run) — ${result.data.detail}`
              : "Calling your phone now — press 1 to connect to the lead.",
          );
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PhoneCall aria-hidden />}
      <span className="text-xs">{pending ? "Calling…" : "Call"}</span>
    </Button>
  );
}

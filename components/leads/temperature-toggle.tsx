"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flame, Snowflake, Sun } from "lucide-react";
import { toast } from "sonner";
import { changeLeadTemperatureAction } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { TEMPERATURE_LABELS } from "@/lib/types";
import type { LeadTemperature } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const OPTIONS: { value: LeadTemperature; icon: typeof Flame; activeClass: string }[] = [
  { value: "cold", icon: Snowflake, activeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  { value: "warm", icon: Sun, activeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  { value: "hot", icon: Flame, activeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
];

/** One-tap "mark hot/warm/cold" (PRD §6.3). */
export function TemperatureToggle({
  leadId,
  temperature,
}: {
  leadId: string;
  temperature: LeadTemperature;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Lead temperature">
      {OPTIONS.map(({ value, icon: Icon, activeClass }) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-pressed={temperature === value}
          className={cn(temperature === value && cn("border-transparent", activeClass))}
          onClick={() => {
            if (temperature === value) return;
            startTransition(async () => {
              const result = await changeLeadTemperatureAction({ id: leadId, temperature: value });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          <Icon aria-hidden /> {TEMPERATURE_LABELS[value]}
        </Button>
      ))}
    </div>
  );
}

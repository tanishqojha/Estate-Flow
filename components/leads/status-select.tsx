"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeLeadStatusAction } from "@/app/actions/leads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS_LABELS } from "@/lib/types";
import type { LeadStatus } from "@/lib/types/database";

export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(next) =>
        startTransition(async () => {
          const result = await changeLeadStatusAction({ id: leadId, status: next });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Status → ${LEAD_STATUS_LABELS[next as LeadStatus]}`);
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-full" aria-label="Lead status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

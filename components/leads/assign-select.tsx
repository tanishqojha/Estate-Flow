"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignLeadAction } from "@/app/actions/leads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "unassigned";

export interface AgentOption {
  id: string;
  full_name: string;
}

/**
 * Reassignment is destructive-ish (it changes who owns the lead), so it
 * confirms before applying (Rules.md §7).
 */
export function AssignSelect({
  leadId,
  assignedAgentId,
  agents,
}: {
  leadId: string;
  assignedAgentId: string | null;
  agents: AgentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);

  const currentValue = assignedAgentId ?? UNASSIGNED;
  const pendingAgentName =
    pendingChoice === UNASSIGNED
      ? "Unassigned"
      : agents.find((a) => a.id === pendingChoice)?.full_name ?? "this agent";

  function applyChange(choice: string) {
    startTransition(async () => {
      const result = await assignLeadAction({
        id: leadId,
        agentId: choice === UNASSIGNED ? null : choice,
      });
      setPendingChoice(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lead reassigned");
      router.refresh();
    });
  }

  return (
    <>
      <Select
        value={currentValue}
        disabled={pending}
        onValueChange={(next) => {
          if (next !== currentValue) setPendingChoice(next);
        }}
      >
        <SelectTrigger className="w-full" aria-label="Assigned agent">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={pendingChoice !== null} onOpenChange={(open) => !open && setPendingChoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              The lead will move to <strong>{pendingAgentName}</strong>. The previous agent will
              lose access and the new agent will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => pendingChoice && applyChange(pendingChoice)}
            >
              {pending ? "Reassigning…" : "Reassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

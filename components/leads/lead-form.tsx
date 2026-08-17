"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createLeadAction, updateLeadAction } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_SOURCE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/types";
import type { LeadRow } from "@/lib/types/database";

const NONE = "none";

export interface AgentOption {
  id: string;
  full_name: string;
}

/** Create + edit form. Minimal typing, mobile-first (Rules.md §7). */
export function LeadForm({
  lead,
  agents,
  canAssign,
}: {
  lead?: LeadRow;
  agents: AgentOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      source: String(form.get("source") ?? "manual"),
      propertyType:
        form.get("propertyType") && form.get("propertyType") !== NONE
          ? String(form.get("propertyType"))
          : null,
      budgetMin: form.get("budgetMin") ? Number(form.get("budgetMin")) : null,
      budgetMax: form.get("budgetMax") ? Number(form.get("budgetMax")) : null,
      preferredLocation: String(form.get("preferredLocation") ?? "") || null,
      notes: String(form.get("notes") ?? "") || null,
      assignedAgentId:
        canAssign && form.get("assignedAgentId") && form.get("assignedAgentId") !== NONE
          ? String(form.get("assignedAgentId"))
          : lead
            ? undefined
            : null,
    };

    startTransition(async () => {
      const result = lead
        ? await updateLeadAction({ ...payload, id: lead.id })
        : await createLeadAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(lead ? "Lead updated" : "Lead created");
      router.push(`/leads/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name *</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={lead?.full_name}
          placeholder="e.g. Asha Patel"
          autoComplete="name"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={lead?.phone}
            placeholder="+91 98765 43210"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            defaultValue={lead?.email ?? ""}
            placeholder="optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select name="source" defaultValue={lead?.source ?? "manual"}>
            <SelectTrigger id="source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyType">Property type</Label>
          <Select name="propertyType" defaultValue={lead?.property_type ?? NONE}>
            <SelectTrigger id="propertyType" className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not sure</SelectItem>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="budgetMin">Budget min (₹)</Label>
          <Input
            id="budgetMin"
            name="budgetMin"
            type="number"
            inputMode="numeric"
            min={0}
            step={100000}
            defaultValue={lead?.budget_min ?? ""}
            placeholder="50,00,000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budgetMax">Budget max (₹)</Label>
          <Input
            id="budgetMax"
            name="budgetMax"
            type="number"
            inputMode="numeric"
            min={0}
            step={100000}
            defaultValue={lead?.budget_max ?? ""}
            placeholder="80,00,000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferredLocation">Preferred location</Label>
        <Input
          id="preferredLocation"
          name="preferredLocation"
          defaultValue={lead?.preferred_location ?? ""}
          placeholder="e.g. Baner, Pune"
        />
      </div>

      {canAssign ? (
        <div className="space-y-2">
          <Label htmlFor="assignedAgentId">Assign to</Label>
          <Select name="assignedAgentId" defaultValue={lead?.assigned_agent_id ?? NONE}>
            <SelectTrigger id="assignedAgentId" className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={lead?.notes ?? ""}
          placeholder="Anything worth remembering…"
          rows={3}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Saving…
          </>
        ) : lead ? (
          "Save changes"
        ) : (
          "Create lead"
        )}
      </Button>
    </form>
  );
}

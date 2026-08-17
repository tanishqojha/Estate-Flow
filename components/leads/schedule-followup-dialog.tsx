"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, addHours, format } from "date-fns";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { scheduleFollowupAction } from "@/app/actions/followups";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { FOLLOWUP_TEMPLATES } from "@/lib/followup-templates";
import { cn } from "@/lib/utils";

const NONE = "none";

const QUICK_PICKS = [
  { label: "In 1 hour", value: () => addHours(new Date(), 1) },
  { label: "Tomorrow 10am", value: () => { const d = addDays(new Date(), 1); d.setHours(10, 0, 0, 0); return d; } },
  { label: "In 3 days", value: () => { const d = addDays(new Date(), 3); d.setHours(10, 0, 0, 0); return d; } },
] as const;

function toLocalInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** One-tap follow-up scheduling from the lead page (PRD §6.7). */
export function ScheduleFollowupDialog({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dueAt, setDueAt] = useState<string>(toLocalInputValue(addHours(new Date(), 1)));
  const [template, setTemplate] = useState<string>(NONE);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(note: string) {
    setError(null);
    startTransition(async () => {
      const result = await scheduleFollowupAction({
        leadId,
        dueAt: new Date(dueAt),
        templateKey: template === NONE ? null : template,
        note: note || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Follow-up scheduled");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-auto flex-col gap-1 py-2.5">
          <CalendarPlus aria-hidden />
          <span className="text-xs">Follow-up</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(String(new FormData(e.currentTarget).get("note") ?? "").trim());
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
            <DialogDescription>You&apos;ll get a notification when it&apos;s due.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            {QUICK_PICKS.map((q) => {
              const active = toLocalInputValue(q.value()) === dueAt;
              return (
                <Button
                  key={q.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("flex-1", active && "border-primary bg-primary/5")}
                  onClick={() => setDueAt(toLocalInputValue(q.value()))}
                >
                  {q.label}
                </Button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueAt">Due</Label>
            <Input
              id="dueAt"
              type="datetime-local"
              value={dueAt}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">What&apos;s it about?</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger id="template" className="w-full">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Custom note</SelectItem>
                {Object.entries(FOLLOWUP_TEMPLATES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={2} placeholder="Extra context…" />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

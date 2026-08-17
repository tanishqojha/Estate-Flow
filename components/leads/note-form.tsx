"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { addLeadNoteAction } from "@/app/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const note = String(new FormData(e.currentTarget).get("note") ?? "").trim();
        if (!note) return;
        startTransition(async () => {
          const result = await addLeadNoteAction({ id: leadId, note });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          formRef.current?.reset();
          toast.success("Note added");
          router.refresh();
        });
      }}
    >
      <Textarea
        name="note"
        placeholder="Add a note to the timeline…"
        rows={2}
        required
        aria-label="New note"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <StickyNote aria-hidden />}
        Add note
      </Button>
    </form>
  );
}

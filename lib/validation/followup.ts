import { z } from "zod";
import { FOLLOWUP_TEMPLATE_KEYS } from "@/lib/followup-templates";

export const followupTemplateSchema = z.enum(
  FOLLOWUP_TEMPLATE_KEYS as [string, ...string[]],
);

export const scheduleFollowupSchema = z.object({
  leadId: z.string().uuid(),
  dueAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60_000, {
    message: "Due time must be in the future",
  }),
  templateKey: followupTemplateSchema.optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const snoozeFollowupSchema = z.object({
  id: z.string().uuid(),
  /** Minutes to push the follow-up forward. */
  minutes: z.number().int().min(5).max(60 * 24 * 30),
});

export const completeFollowupSchema = z.object({ id: z.string().uuid() });
export const cancelFollowupSchema = z.object({ id: z.string().uuid() });

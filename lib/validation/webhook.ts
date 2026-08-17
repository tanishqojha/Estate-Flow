import { z } from "zod";
import { phoneSchema, propertyTypeSchema } from "@/lib/validation/lead";
import type { LeadSource } from "@/lib/types/database";

/**
 * Lead-intake webhook payload (PRD §8). phone + source are required;
 * unknown source values map to 'other' instead of rejecting the lead.
 */

const KNOWN_SOURCES: Record<string, LeadSource> = {
  "36_acre": "36_acre",
  "36 acre": "36_acre",
  "36acre": "36_acre",
  magicbricks: "magicbricks",
  housing: "housing",
  facebook: "facebook",
  fb: "facebook",
  instagram: "instagram",
  ig: "instagram",
  website: "website",
  referral: "referral",
  manual: "manual",
  other: "other",
};

export const webhookSourceSchema = z
  .string()
  .min(1, "source is required")
  .transform((v): LeadSource => KNOWN_SOURCES[v.trim().toLowerCase()] ?? "other");

export const webhookLeadSchema = z.object({
  fullName: z.string().trim().max(120).optional().default("Unknown Lead"),
  phone: phoneSchema,
  email: z.string().trim().email().max(200).optional().nullable(),
  source: webhookSourceSchema,
  propertyType: propertyTypeSchema.optional().nullable(),
  budgetMin: z.coerce.number().nonnegative().optional().nullable(),
  budgetMax: z.coerce.number().nonnegative().optional().nullable(),
  preferredLocation: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Optional caller-supplied id for idempotency (portal lead id etc.). */
  externalRef: z.string().trim().max(200).optional().nullable(),
});

export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>;

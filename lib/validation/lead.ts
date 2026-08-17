import { z } from "zod";

/** Shared enum schemas (mirror DB enums). */
export const leadSourceSchema = z.enum([
  "36_acre",
  "magicbricks",
  "housing",
  "facebook",
  "instagram",
  "website",
  "referral",
  "manual",
  "other",
]);

export const propertyTypeSchema = z.enum([
  "apartment",
  "villa",
  "plot",
  "commercial",
  "rental",
]);

export const leadStatusSchema = z.enum([
  "new",
  "contacted",
  "interested",
  "site_visit_scheduled",
  "negotiation",
  "won",
  "lost",
  "not_responding",
  "call_pending",
]);

export const leadTemperatureSchema = z.enum(["cold", "warm", "hot"]);

/** E.164-ish phone: +, 8–15 digits. Normalized before validation. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-().]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{8,15}$/, "Enter a valid phone number"));

export const createLeadSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: phoneSchema,
  email: z.string().trim().email("Enter a valid email").max(200).or(z.literal("")).optional(),
  source: leadSourceSchema.default("manual"),
  propertyType: propertyTypeSchema.optional().nullable(),
  budgetMin: z.coerce.number().nonnegative().optional().nullable(),
  budgetMax: z.coerce.number().nonnegative().optional().nullable(),
  preferredLocation: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const changeLeadStatusSchema = z.object({
  id: z.string().uuid(),
  status: leadStatusSchema,
});

export const changeLeadTemperatureSchema = z.object({
  id: z.string().uuid(),
  temperature: leadTemperatureSchema,
});

export const assignLeadSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
});

export const addLeadNoteSchema = z.object({
  id: z.string().uuid(),
  note: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const deleteLeadSchema = z.object({ id: z.string().uuid() });

/** List filters arrive via URL search params — validate loosely + coerce. */
export const leadFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: leadStatusSchema.optional(),
  source: leadSourceSchema.optional(),
  temperature: leadTemperatureSchema.optional(),
  agent: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

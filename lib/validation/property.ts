import { z } from "zod";
import { propertyTypeSchema } from "@/lib/validation/lead";

export const availabilityStatusSchema = z.enum(["available", "hold", "sold", "rented"]);
export const furnishingStatusSchema = z.enum(["unfurnished", "semi_furnished", "fully_furnished"]);
export const shareChannelSchema = z.enum(["whatsapp", "sms", "email", "link"]);

export const createPropertySchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(160),
  location: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  propertyType: propertyTypeSchema,
  price: z.coerce.number().nonnegative().optional().nullable(),
  size: z.string().trim().max(60).optional().nullable(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional().nullable(),
  bathrooms: z.coerce.number().int().min(0).max(20).optional().nullable(),
  floor: z.string().trim().max(60).optional().nullable(),
  furnishingStatus: furnishingStatusSchema.optional().nullable(),
  availabilityStatus: availabilityStatusSchema.default("available"),
  description: z.string().trim().max(5000).optional().nullable(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  ownerDeveloper: z.string().trim().max(160).optional().nullable(),
  coverImageUrl: z.string().trim().url().optional().nullable().or(z.literal("").transform(() => null)),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = createPropertySchema.partial().extend({
  id: z.string().uuid(),
});

export const deletePropertySchema = z.object({ id: z.string().uuid() });

export const addPropertyImageSchema = z.object({
  propertyId: z.string().uuid(),
  externalUrl: z.string().trim().url("Enter a valid image URL"),
  caption: z.string().trim().max(200).optional().nullable(),
});

export const propertyFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: propertyTypeSchema.optional(),
  availability: availabilityStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;

export const sharePropertySchema = z.object({
  leadId: z.string().uuid(),
  propertyId: z.string().uuid(),
  channel: shareChannelSchema,
});
export type SharePropertyInput = z.infer<typeof sharePropertySchema>;

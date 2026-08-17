import { z } from "zod";

const latSchema = z.coerce.number().min(-90).max(90);
const lngSchema = z.coerce.number().min(-180).max(180);

export const checkInSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const checkOutSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
});

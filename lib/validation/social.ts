import { z } from "zod";

export const socialStatusSchema = z.enum(["idea", "draft", "scheduled", "published"]);
export const socialPostTypeSchema = z.enum([
  "image",
  "video",
  "reel",
  "story",
  "carousel",
  "text",
]);

const PLATFORMS = ["instagram", "facebook", "linkedin", "youtube", "x"] as const;
export const platformSchema = z.enum(PLATFORMS);
export const PLATFORM_OPTIONS = PLATFORMS;

export const createSocialPostSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(160),
  caption: z.string().trim().max(3000).optional().nullable(),
  postType: socialPostTypeSchema.default("image"),
  status: socialStatusSchema.default("idea"),
  scheduledFor: z.coerce.date().optional().nullable(),
  platforms: z.array(platformSchema).max(5).default([]),
});

export const updateSocialPostSchema = createSocialPostSchema.partial().extend({
  id: z.string().uuid(),
});

export const deleteSocialPostSchema = z.object({ id: z.string().uuid() });

export const dispatchSocialPostSchema = z.object({ id: z.string().uuid() });

export const generateCaptionSchema = z.object({
  title: z.string().trim().min(3).max(160),
  postType: socialPostTypeSchema,
  platforms: z.array(platformSchema).max(5).default([]),
  extraContext: z.string().trim().max(500).optional().nullable(),
});

"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/db/activities";
import { requireProfile } from "@/lib/db/profiles";
import {
  deleteSocialPost as dbDeleteSocialPost,
  getSocialPost,
  insertSocialPost,
  updateSocialPost as dbUpdateSocialPost,
} from "@/lib/db/social-posts";
import { generateCaption } from "@/lib/services/ai-service";
import { getOrgIntegrationConfig } from "@/lib/services/config";
import { createSocialPostService } from "@/lib/services/social-post-service";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  createSocialPostSchema,
  deleteSocialPostSchema,
  dispatchSocialPostSchema,
  generateCaptionSchema,
  updateSocialPostSchema,
} from "@/lib/validation/social";

function canManageSocial(role: string): boolean {
  return role === "admin" || role === "social_media_manager";
}

export async function createSocialPostAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createSocialPostSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireProfile();
    if (!canManageSocial(profile.role)) {
      return { ok: false, error: "Only admins and the social media manager can create posts." };
    }
    const supabase = await createServerSupabase();

    const { post, error } = await insertSocialPost(supabase, {
      organization_id: profile.organization_id,
      title: input.title,
      caption: input.caption || null,
      post_type: input.postType,
      status: input.status,
      scheduled_for: input.scheduledFor?.toISOString() ?? null,
      platforms: input.platforms,
      created_by: profile.id,
    });
    if (error || !post) return { ok: false, error: error ?? "Could not create post" };

    revalidatePath("/social");
    return { ok: true, data: { id: post.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create post" };
  }
}

export async function updateSocialPostAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateSocialPostSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, ...input } = parsed.data;

  try {
    const profile = await requireProfile();
    if (!canManageSocial(profile.role)) {
      return { ok: false, error: "Only admins and the social media manager can edit posts." };
    }
    const supabase = await createServerSupabase();

    const values: Record<string, unknown> = {};
    if (input.title !== undefined) values.title = input.title;
    if (input.caption !== undefined) values.caption = input.caption || null;
    if (input.postType !== undefined) values.post_type = input.postType;
    if (input.status !== undefined) {
      values.status = input.status;
      if (input.status === "published") values.published_at = new Date().toISOString();
    }
    if (input.scheduledFor !== undefined)
      values.scheduled_for = input.scheduledFor?.toISOString() ?? null;
    if (input.platforms !== undefined) values.platforms = input.platforms;

    const { post, error } = await dbUpdateSocialPost(supabase, profile.organization_id, id, values);
    if (error || !post) return { ok: false, error: error ?? "Could not update post" };

    revalidatePath("/social");
    return { ok: true, data: { id: post.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update post" };
  }
}

export async function deleteSocialPostAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deleteSocialPostSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    if (!canManageSocial(profile.role)) {
      return { ok: false, error: "Only admins and the social media manager can delete posts." };
    }
    const supabase = await createServerSupabase();

    const { error } = await dbDeleteSocialPost(supabase, profile.organization_id, parsed.data.id);
    if (error) return { ok: false, error };

    revalidatePath("/social");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete post" };
  }
}

export async function generateCaptionAction(
  raw: unknown,
): Promise<ActionResult<{ caption: string }>> {
  const parsed = generateCaptionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    if (!canManageSocial(profile.role)) {
      return { ok: false, error: "Only admins and the social media manager can use AI captions." };
    }

    const result = await generateCaption({
      title: parsed.data.title,
      postType: parsed.data.postType,
      platforms: parsed.data.platforms,
      extraContext: parsed.data.extraContext,
    });
    return { ok: true, data: { caption: result.caption }, dryRun: result.dryRun };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not generate caption" };
  }
}

/** Hand the approved post to the org's automation webhook (Zapier/Make/Buffer). */
export async function dispatchSocialPostAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = dispatchSocialPostSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    if (!canManageSocial(profile.role)) {
      return { ok: false, error: "Only admins and the social media manager can dispatch posts." };
    }
    const supabase = await createServerSupabase();

    const post = await getSocialPost(supabase, profile.organization_id, parsed.data.id);
    if (!post) return { ok: false, error: "Post not found." };

    const config = await getOrgIntegrationConfig(profile.organization_id);
    const service = createSocialPostService(config);
    const result = await service.dispatch({
      postId: post.id,
      organizationId: profile.organization_id,
      title: post.title,
      caption: post.caption,
      postType: post.post_type,
      platforms: post.platforms,
      scheduledFor: post.scheduled_for,
      mediaUrls: post.media_paths,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "Webhook dispatch failed" };
    }

    await dbUpdateSocialPost(supabase, profile.organization_id, post.id, {
      dispatched_at: new Date().toISOString(),
      dispatch_response: {
        status_code: result.statusCode,
        body: result.responseBody,
        dry_run: result.dryRun,
      },
      status: "published",
      published_at: new Date().toISOString(),
    });

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      actorId: profile.id,
      type: "social_post_dispatched",
      title: `Social post dispatched: ${post.title}${result.dryRun ? " (dry run)" : ""}`,
      metadata: { post_id: post.id, dry_run: result.dryRun },
    });

    revalidatePath("/social");
    return { ok: true, data: undefined, dryRun: result.dryRun };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not dispatch post" };
  }
}

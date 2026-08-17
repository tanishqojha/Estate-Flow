import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SocialPostRow } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export type SocialPostWithCreator = SocialPostRow & {
  creator: { id: string; full_name: string } | null;
};

const POST_SELECT = "*, creator:profiles!social_posts_created_by_fkey(id, full_name)";

export async function listSocialPosts(
  db: Db,
  organizationId: string,
): Promise<{ posts: SocialPostWithCreator[]; error: string | null }> {
  const { data, error } = await db
    .from("social_posts")
    .select(POST_SELECT)
    .eq("organization_id", organizationId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listSocialPosts failed:", error.message);
    return { posts: [], error: error.message };
  }
  return { posts: (data ?? []) as SocialPostWithCreator[], error: null };
}

export async function getSocialPost(
  db: Db,
  organizationId: string,
  postId: string,
): Promise<SocialPostRow | null> {
  const { data, error } = await db
    .from("social_posts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .maybeSingle();
  if (error) {
    console.error("getSocialPost failed:", error.message);
    return null;
  }
  return data;
}

export async function insertSocialPost(
  db: Db,
  values: Database["public"]["Tables"]["social_posts"]["Insert"],
): Promise<{ post: SocialPostRow | null; error: string | null }> {
  const { data, error } = await db.from("social_posts").insert(values).select().single();
  if (error) {
    console.error("insertSocialPost failed:", error.message);
    return { post: null, error: error.message };
  }
  return { post: data, error: null };
}

export async function updateSocialPost(
  db: Db,
  organizationId: string,
  postId: string,
  values: Database["public"]["Tables"]["social_posts"]["Update"],
): Promise<{ post: SocialPostRow | null; error: string | null }> {
  const { data, error } = await db
    .from("social_posts")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .select()
    .single();
  if (error) {
    console.error("updateSocialPost failed:", error.message);
    return { post: null, error: error.message };
  }
  return { post: data, error: null };
}

export async function deleteSocialPost(
  db: Db,
  organizationId: string,
  postId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from("social_posts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", postId);
  if (error) {
    console.error("deleteSocialPost failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Scheduled posts whose time has arrived and were never dispatched/reminded. */
export async function getDueScheduledPosts(db: Db): Promise<SocialPostWithCreator[]> {
  const { data, error } = await db
    .from("social_posts")
    .select(POST_SELECT)
    .eq("status", "scheduled")
    .is("dispatched_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .limit(100);
  if (error) {
    console.error("getDueScheduledPosts failed:", error.message);
    return [];
  }
  return (data ?? []) as SocialPostWithCreator[];
}

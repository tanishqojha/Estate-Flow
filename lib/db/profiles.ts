import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/types/database";

/**
 * Session → profile resolution. Every server action starts here: the
 * returned profile carries the trusted organization_id + role (never taken
 * from client input — Rules.md §3).
 */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Failed to load current profile:", error.message);
    return null;
  }
  return data;
}

/** Like getCurrentProfile but throws — for actions that require auth. */
export async function requireProfile(): Promise<ProfileRow> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("Not authenticated.");
  }
  return profile;
}

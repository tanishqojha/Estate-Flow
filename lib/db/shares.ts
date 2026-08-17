import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export async function insertShare(
  db: Db,
  values: Database["public"]["Tables"]["lead_property_shares"]["Insert"],
): Promise<{ error: string | null }> {
  const { error } = await db.from("lead_property_shares").insert(values);
  if (error) {
    console.error("insertShare failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

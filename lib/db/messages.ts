import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageRow } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export async function insertMessage(
  db: Db,
  values: Database["public"]["Tables"]["messages"]["Insert"],
): Promise<{ message: MessageRow | null; error: string | null }> {
  const { data, error } = await db.from("messages").insert(values).select().single();
  if (error) {
    console.error("insertMessage failed:", error.message);
    return { message: null, error: error.message };
  }
  return { message: data, error: null };
}

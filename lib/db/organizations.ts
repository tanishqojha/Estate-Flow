import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OrganizationRow } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export async function getOrganization(
  db: Db,
  organizationId: string,
): Promise<OrganizationRow | null> {
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load organization:", error.message);
    return null;
  }
  return data;
}

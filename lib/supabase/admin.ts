import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { getEnv } from "@/lib/env";

/**
 * Service-role client. SERVER-ONLY (enforced by the `server-only` import and
 * Rules.md §3). Bypasses RLS — use exclusively for:
 *   - webhook ingestion (no user session)
 *   - integration_settings reads/writes (secrets table, default-deny RLS)
 *   - system writes (notifications, Twilio callbacks, seed)
 * Every caller MUST scope queries by organization_id explicitly.
 *
 * Returns null when the key is missing (degrade, never crash — Rules.md §4).
 */
export function createAdminClient() {
  const env = getEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // TODO: set SUPABASE_SERVICE_ROLE_KEY to enable system writes (webhooks,
    // notifications, integration settings). Feature degrades to dry-run.
    console.warn(
      "[dry-run] SUPABASE_SERVICE_ROLE_KEY missing — admin client unavailable.",
    );
    return null;
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Variant for flows that cannot proceed at all without the admin client. */
export function requireAdminClient() {
  const client = createAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for this operation (see .env.example).",
    );
  }
  return client;
}

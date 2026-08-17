import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationSettingsRow } from "@/lib/types/database";

/**
 * integration_settings access — SERVICE-ROLE ONLY (the table has default-deny
 * RLS with no authenticated policies; Rules.md §3). Callers must verify the
 * caller's admin role app-side before writes.
 */

/** Resolve the tenant from a webhook secret. Timing-safe-ish exact match. */
export async function getOrgIdByWebhookSecret(secret: string): Promise<string | null> {
  if (!secret || secret.length < 16) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("integration_settings")
    .select("organization_id")
    .eq("webhook_secret", secret)
    .maybeSingle();
  if (error) {
    console.error("Webhook secret lookup failed:", error.message);
    return null;
  }
  return data?.organization_id ?? null;
}

export async function getIntegrationSettings(
  organizationId: string,
): Promise<IntegrationSettingsRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("integration_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    console.error("integration_settings load failed:", error.message);
    return null;
  }
  return data;
}

"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptSecret } from "@/lib/crypto";
import { requireProfile } from "@/lib/db/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/types";

const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(120),
  timezone: z.string().trim().min(1).max(60),
  defaultAssignmentMode: z.enum(["round_robin", "manual", "least_busy"]),
});

/**
 * Integration settings (PRD §6.13). Secret fields are optional: blank means
 * "leave unchanged". Tokens are AES-256-GCM encrypted before they touch the
 * database (Rules.md §3); the table itself is server-only (default-deny RLS).
 */
const integrationSettingsSchema = z.object({
  twilioAccountSid: z.string().trim().max(100).optional().nullable(),
  twilioAuthToken: z.string().trim().max(200).optional().nullable(),
  twilioPhoneNumber: z.string().trim().max(30).optional().nullable(),
  whatsappSender: z.string().trim().max(30).optional().nullable(),
  resendApiKey: z.string().trim().max(200).optional().nullable(),
  emailFrom: z.string().trim().max(200).optional().nullable(),
  aiApiKey: z.string().trim().max(200).optional().nullable(),
  aiBaseUrl: z.string().trim().url().optional().nullable().or(z.literal("").transform(() => null)),
  socialDispatchWebhookUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  defaultAssignmentMode: z.enum(["round_robin", "manual", "least_busy"]),
});

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Only admins can change settings.");
  }
  return profile;
}

export async function updateOrgSettingsAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = orgSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireAdmin();
    const supabase = await createServerSupabase();

    const { error } = await supabase
      .from("organizations")
      .update({
        name: parsed.data.name,
        timezone: parsed.data.timezone,
        default_assignment_mode: parsed.data.defaultAssignmentMode,
      })
      .eq("id", profile.organization_id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save settings" };
  }
}

export async function updateIntegrationSettingsAction(
  raw: unknown,
): Promise<ActionResult<undefined>> {
  const parsed = integrationSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireAdmin();
    const admin = createAdminClient();
    if (!admin) {
      return {
        ok: false,
        error: "Server is missing SUPABASE_SERVICE_ROLE_KEY — integrations can't be saved here.",
      };
    }

    const hasSecretInput = !!(input.twilioAuthToken || input.resendApiKey || input.aiApiKey);
    if (hasSecretInput && !getEnv().SECRETS_ENCRYPTION_KEY) {
      return {
        ok: false,
        error:
          "SECRETS_ENCRYPTION_KEY is not set on the server, so API tokens can't be stored securely yet.",
      };
    }

    const values: Record<string, unknown> = {
      organization_id: profile.organization_id,
      default_assignment_mode: input.defaultAssignmentMode,
    };
    if (input.twilioAccountSid !== undefined)
      values.twilio_account_sid = input.twilioAccountSid || null;
    if (input.twilioPhoneNumber !== undefined)
      values.twilio_phone_number = input.twilioPhoneNumber || null;
    if (input.whatsappSender !== undefined) values.whatsapp_sender = input.whatsappSender || null;
    if (input.emailFrom !== undefined) values.email_from = input.emailFrom || null;
    if (input.aiBaseUrl !== undefined) values.ai_base_url = input.aiBaseUrl;
    if (input.socialDispatchWebhookUrl !== undefined)
      values.social_dispatch_webhook_url = input.socialDispatchWebhookUrl;
    // Secrets: blank = leave unchanged
    if (input.twilioAuthToken) values.twilio_auth_token_encrypted = encryptSecret(input.twilioAuthToken);
    if (input.resendApiKey) values.resend_api_key_encrypted = encryptSecret(input.resendApiKey);
    if (input.aiApiKey) values.ai_api_key_encrypted = encryptSecret(input.aiApiKey);

    const { error } = await admin
      .from("integration_settings")
      .upsert(values as never, { onConflict: "organization_id" });
    if (error) return { ok: false, error: error.message };

    // Keep the org-level default in sync (used when settings row is absent).
    await admin
      .from("organizations")
      .update({ default_assignment_mode: input.defaultAssignmentMode })
      .eq("id", profile.organization_id);

    revalidatePath("/settings/integrations");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save integrations" };
  }
}

export async function rotateWebhookSecretAction(): Promise<ActionResult<{ secret: string }>> {
  try {
    const profile = await requireAdmin();
    const admin = createAdminClient();
    if (!admin) {
      return { ok: false, error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." };
    }

    const secret = randomBytes(24).toString("hex");
    const { error } = await admin
      .from("integration_settings")
      .upsert(
        { organization_id: profile.organization_id, webhook_secret: secret },
        { onConflict: "organization_id" },
      );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/settings/integrations");
    return { ok: true, data: { secret } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not rotate the secret" };
  }
}

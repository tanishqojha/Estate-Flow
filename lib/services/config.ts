import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import { getEnv, isGlobalDryRun } from "@/lib/env";
import type { AssignmentMode } from "@/lib/types/database";

/**
 * Resolves the effective integration config for an org:
 *   per-org integration_settings (encrypted, server-only) → env fallbacks.
 * Missing credentials never throw — the affected provider resolves to null
 * and its adapter runs in dry-run (Rules.md §4).
 */

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface OrgIntegrationConfig {
  organizationId: string;
  globalDryRun: boolean;
  twilio: TwilioConfig | null;
  whatsappSender: string | null;
  resend: ResendConfig | null;
  socialDispatchWebhookUrl: string | null;
  webhookSecret: string | null;
  defaultAssignmentMode: AssignmentMode;
}

export async function getOrgIntegrationConfig(
  organizationId: string,
): Promise<OrgIntegrationConfig> {
  const env = getEnv();
  const admin = createAdminClient();

  let row: {
    twilio_account_sid: string | null;
    twilio_auth_token_encrypted: string | null;
    twilio_phone_number: string | null;
    whatsapp_sender: string | null;
    resend_api_key_encrypted: string | null;
    email_from: string | null;
    social_dispatch_webhook_url: string | null;
    webhook_secret: string;
    default_assignment_mode: AssignmentMode;
  } | null = null;

  if (admin) {
    const { data, error } = await admin
      .from("integration_settings")
      .select(
        "twilio_account_sid, twilio_auth_token_encrypted, twilio_phone_number, whatsapp_sender, resend_api_key_encrypted, email_from, social_dispatch_webhook_url, webhook_secret, default_assignment_mode",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load integration_settings:", error.message);
    }
    row = data ?? null;
  }

  // Twilio: org settings win, env is the fallback.
  const twilioSid = row?.twilio_account_sid ?? env.TWILIO_ACCOUNT_SID ?? null;
  const twilioToken = decryptSecret(row?.twilio_auth_token_encrypted) ?? env.TWILIO_AUTH_TOKEN ?? null;
  const twilioNumber = row?.twilio_phone_number ?? env.TWILIO_PHONE_NUMBER ?? null;
  const twilio: TwilioConfig | null =
    twilioSid && twilioToken && twilioNumber
      ? { accountSid: twilioSid, authToken: twilioToken, phoneNumber: twilioNumber }
      : null;

  const resendKey = decryptSecret(row?.resend_api_key_encrypted) ?? env.RESEND_API_KEY ?? null;
  const emailFrom = row?.email_from ?? env.EMAIL_FROM ?? null;
  const resend: ResendConfig | null =
    resendKey && emailFrom ? { apiKey: resendKey, from: emailFrom } : null;

  return {
    organizationId,
    globalDryRun: isGlobalDryRun(),
    twilio,
    whatsappSender: row?.whatsapp_sender ?? env.WHATSAPP_SENDER ?? null,
    resend,
    socialDispatchWebhookUrl: row?.social_dispatch_webhook_url ?? null,
    webhookSecret: row?.webhook_secret ?? null,
    defaultAssignmentMode: row?.default_assignment_mode ?? "round_robin",
  };
}

/** Short random suffix for realistic simulated provider IDs. */
export function fakeProviderId(prefix: string): string {
  return `${prefix}_dryrun_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

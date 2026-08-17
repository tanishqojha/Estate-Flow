import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IntegrationsForm, type IntegrationsView } from "@/components/settings/integrations-form";
import { BackLink } from "@/components/shared/back-link";
import { PageHeader } from "@/components/shared/page-header";
import { getIntegrationSettings } from "@/lib/db/integration-settings";
import { requireProfile } from "@/lib/db/profiles";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Integrations" };

/**
 * Admin-only. Secrets never leave the server: the page maps the settings row
 * to a view model with has-flags — encrypted values themselves are never
 * serialized to the client (Rules.md §3).
 */
export default async function IntegrationsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const settings = await getIntegrationSettings(profile.organization_id);
  const env = getEnv();

  const view: IntegrationsView = {
    twilioAccountSid: settings?.twilio_account_sid ?? "",
    twilioPhoneNumber: settings?.twilio_phone_number ?? "",
    whatsappSender: settings?.whatsapp_sender ?? "",
    emailFrom: settings?.email_from ?? "",
    aiBaseUrl: settings?.ai_base_url ?? "",
    socialDispatchWebhookUrl: settings?.social_dispatch_webhook_url ?? "",
    webhookSecret: settings?.webhook_secret ?? "",
    defaultAssignmentMode: settings?.default_assignment_mode ?? "round_robin",
    hasTwilioToken: !!settings?.twilio_auth_token_encrypted,
    hasResendKey: !!settings?.resend_api_key_encrypted,
    hasAiKey: !!settings?.ai_api_key_encrypted,
    canStoreSecrets: !!env.SECRETS_ENCRYPTION_KEY && !!env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return (
    <div className="space-y-4">
      <BackLink href="/settings" label="Settings" />
      <PageHeader
        title="Integrations"
        subtitle="Per-organization credentials. Tokens are encrypted at rest and never sent to the browser."
      />
      <IntegrationsForm view={view} />
    </div>
  );
}

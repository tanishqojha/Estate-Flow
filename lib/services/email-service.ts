import "server-only";

import { fakeProviderId, type OrgIntegrationConfig } from "@/lib/services/config";
import type { EmailService, SendEmailParams, SendEmailResult } from "@/lib/services/types";

/**
 * emailService — Resend REST API (PRD §3). SMTP fallback can be added as
 * another class behind the same interface without product-code changes.
 */

class DryRunEmailService implements EmailService {
  readonly dryRun = true;

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    console.info(
      `[dry-run] emailService.send → would email ${params.to}: "${params.subject}"`,
    );
    return { ok: true, dryRun: true, providerMessageId: fakeProviderId("email") };
  }
}

class ResendEmailService implements EmailService {
  readonly dryRun = false;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          dryRun: false,
          providerMessageId: null,
          error: `Resend ${res.status}: ${text.slice(0, 300)}`,
        };
      }
      const json = (await res.json()) as { id?: string };
      return { ok: true, dryRun: false, providerMessageId: json.id ?? null };
    } catch (err) {
      return {
        ok: false,
        dryRun: false,
        providerMessageId: null,
        error: err instanceof Error ? err.message : "Resend request failed",
      };
    }
  }
}

export function createEmailService(config: OrgIntegrationConfig): EmailService {
  if (config.globalDryRun) return new DryRunEmailService();
  if (!config.resend) {
    // TODO: add RESEND_API_KEY + EMAIL_FROM (or org Settings → Integrations)
    // to send live email. Degrading to dry-run.
    console.warn("[dry-run] emailService: Resend credentials missing — simulating.");
    return new DryRunEmailService();
  }
  return new ResendEmailService(config.resend.apiKey, config.resend.from);
}

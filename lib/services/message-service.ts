import "server-only";

import { fakeProviderId, type OrgIntegrationConfig } from "@/lib/services/config";
import type {
  MessageService,
  SendMessageParams,
  SendMessageResult,
} from "@/lib/services/types";

/**
 * messageService — WhatsApp + SMS behind one adapter (PRD §3: provider is
 * swappable via config only). Default provider: Twilio Messages API.
 * WhatsApp Cloud API can be added as another class without product-code
 * changes (Rules.md §4).
 */

class DryRunMessageService implements MessageService {
  readonly dryRun = true;

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    console.info(
      `[dry-run] messageService.send → would send ${params.channel} to ${params.to}: ` +
        `"${params.body.slice(0, 80)}${params.body.length > 80 ? "…" : ""}"`,
    );
    return { ok: true, dryRun: true, providerMessageId: fakeProviderId("SM") };
  }
}

class TwilioMessageService implements MessageService {
  readonly dryRun = false;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly smsFrom: string,
    private readonly whatsappFrom: string | null,
  ) {}

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const isWhatsApp = params.channel === "whatsapp";
    const from = isWhatsApp
      ? this.whatsappFrom
        ? `whatsapp:${this.whatsappFrom}`
        : null
      : this.smsFrom;

    if (!from) {
      // TODO: configure WHATSAPP_SENDER (or org Settings → Integrations) to
      // send WhatsApp messages. Degrading to dry-run.
      console.warn("[dry-run] messageService: WhatsApp sender missing — simulating.");
      return {
        ok: true,
        dryRun: true,
        providerMessageId: fakeProviderId("SM"),
      };
    }

    const body = new URLSearchParams({
      To: isWhatsApp ? `whatsapp:${params.to}` : params.to,
      From: from,
      Body: params.body,
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          dryRun: false,
          providerMessageId: null,
          error: `Twilio ${res.status}: ${text.slice(0, 300)}`,
        };
      }
      const json = (await res.json()) as { sid?: string };
      return { ok: true, dryRun: false, providerMessageId: json.sid ?? null };
    } catch (err) {
      return {
        ok: false,
        dryRun: false,
        providerMessageId: null,
        error: err instanceof Error ? err.message : "Twilio request failed",
      };
    }
  }
}

export function createMessageService(config: OrgIntegrationConfig): MessageService {
  if (config.globalDryRun) return new DryRunMessageService();
  if (!config.twilio) {
    // TODO: add Twilio credentials to send live SMS/WhatsApp. Degrading to dry-run.
    console.warn("[dry-run] messageService: Twilio credentials missing — simulating.");
    return new DryRunMessageService();
  }
  return new TwilioMessageService(
    config.twilio.accountSid,
    config.twilio.authToken,
    config.twilio.phoneNumber,
    config.whatsappSender,
  );
}

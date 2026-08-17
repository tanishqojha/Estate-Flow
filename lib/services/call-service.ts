import "server-only";

import { getEnv } from "@/lib/env";
import { fakeProviderId, type OrgIntegrationConfig } from "@/lib/services/config";
import type {
  AdapterResult,
  CallService,
  DialLeadParams,
  StartBridgeParams,
  StartBridgeResult,
} from "@/lib/services/types";

/**
 * callService — instant call bridge (PRD §6.5, Rules.md §8).
 * Flow: dial AGENT first → TwiML gathers key-press confirm → dial lead →
 * both join a conference. Prod uses the Twilio REST API directly (no SDK —
 * one authenticated POST). Dry-run simulates the same result shape.
 */

class DryRunCallService implements CallService {
  readonly dryRun = true;

  async startBridge(params: StartBridgeParams): Promise<StartBridgeResult> {
    const callSid = fakeProviderId("CA");
    const conferenceSid = `conf_${params.callId}`;
    console.info(
      `[dry-run] callService.startBridge → would dial agent ${params.agentPhone}, ` +
        `announce "${params.announcement}", then bridge lead ${params.leadPhone} ` +
        `into conference ${conferenceSid}`,
    );
    return { ok: true, dryRun: true, callSid, conferenceSid };
  }

  async dialLeadIntoConference(
    params: DialLeadParams,
  ): Promise<AdapterResult & { ok: boolean; callSid: string | null; error?: string }> {
    console.info(
      `[dry-run] callService.dialLeadIntoConference → would dial ${params.leadPhone} ` +
        `into ${params.conferenceName}`,
    );
    return { ok: true, dryRun: true, callSid: fakeProviderId("CA") };
  }

  async cancelCall(callSid: string): Promise<AdapterResult & { ok: boolean }> {
    console.info(`[dry-run] callService.cancelCall → would cancel ${callSid}`);
    return { ok: true, dryRun: true };
  }
}

class TwilioCallService implements CallService {
  readonly dryRun = false;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;
  }

  async startBridge(params: StartBridgeParams): Promise<StartBridgeResult> {
    const appUrl = getEnv().APP_URL;
    // Agent leg: TwiML endpoint plays the announcement and gathers the
    // key-press confirm; on confirm it dials the lead into the conference.
    const voiceUrl = `${appUrl}/api/twilio/voice?callId=${encodeURIComponent(params.callId)}`;
    const statusUrl = `${appUrl}/api/twilio/status?callId=${encodeURIComponent(params.callId)}`;

    const body = new URLSearchParams({
      To: params.agentPhone,
      From: this.fromNumber,
      Url: voiceUrl,
      StatusCallback: statusUrl,
      StatusCallbackEvent: "initiated ringing answered completed",
      Timeout: "20",
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: this.authHeader,
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
          callSid: null,
          conferenceSid: null,
          error: `Twilio ${res.status}: ${text.slice(0, 300)}`,
        };
      }
      const json = (await res.json()) as { sid?: string };
      return {
        ok: true,
        dryRun: false,
        callSid: json.sid ?? null,
        conferenceSid: `conf_${params.callId}`,
      };
    } catch (err) {
      return {
        ok: false,
        dryRun: false,
        callSid: null,
        conferenceSid: null,
        error: err instanceof Error ? err.message : "Twilio request failed",
      };
    }
  }

  async dialLeadIntoConference(
    params: DialLeadParams,
  ): Promise<AdapterResult & { ok: boolean; callSid: string | null; error?: string }> {
    const appUrl = getEnv().APP_URL;
    // Lead leg answers straight into the conference; agent is already waiting.
    const twiml =
      `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>` +
      `<Conference endConferenceOnExit="true">${params.conferenceName}</Conference>` +
      `</Dial></Response>`;

    const body = new URLSearchParams({
      To: params.leadPhone,
      From: this.fromNumber,
      Twiml: twiml,
      StatusCallback: `${appUrl}/api/twilio/status?callId=${encodeURIComponent(params.callId)}&leg=lead`,
      StatusCallbackEvent: "initiated ringing answered completed",
      Timeout: "25",
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: this.authHeader,
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
          callSid: null,
          error: `Twilio ${res.status}: ${text.slice(0, 300)}`,
        };
      }
      const json = (await res.json()) as { sid?: string };
      return { ok: true, dryRun: false, callSid: json.sid ?? null };
    } catch (err) {
      return {
        ok: false,
        dryRun: false,
        callSid: null,
        error: err instanceof Error ? err.message : "Twilio request failed",
      };
    }
  }

  async cancelCall(callSid: string): Promise<AdapterResult & { ok: boolean }> {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callSid}.json`,
        {
          method: "POST",
          headers: {
            Authorization: this.authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ Status: "canceled" }),
        },
      );
      return { ok: res.ok, dryRun: false };
    } catch {
      return { ok: false, dryRun: false };
    }
  }
}

export function createCallService(config: OrgIntegrationConfig): CallService {
  if (config.globalDryRun) return new DryRunCallService();
  if (!config.twilio) {
    // TODO: add Twilio credentials (org Settings → Integrations, or env
    // TWILIO_*) to place live calls. Degrading to dry-run (Rules.md §4).
    console.warn("[dry-run] callService: Twilio credentials missing — simulating.");
    return new DryRunCallService();
  }
  const { accountSid, authToken, phoneNumber } = config.twilio;
  return new TwilioCallService(accountSid, authToken, phoneNumber);
}

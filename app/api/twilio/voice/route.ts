import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/db/activities";
import { getCallById, updateCall } from "@/lib/db/calls";
import { buildAnnouncement, advanceBridgeFallback } from "@/lib/services/bridge-orchestrator";
import { createCallService } from "@/lib/services/call-service";
import { getOrgIntegrationConfig } from "@/lib/services/config";
import { validateTwilioSignature } from "@/lib/services/twilio-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * TwiML for the agent leg (PRD §8):
 *   step=answer  → announce the lead, Gather a key press
 *   step=connect → on "1": dial the lead into the conference and put the
 *                  agent in it; anything else counts as a decline and the
 *                  bridge falls through to the next agent.
 */

function twiml(xmlInner: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${xmlInner}</Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function POST(request: NextRequest) {
  const callId = request.nextUrl.searchParams.get("callId") ?? "";
  const step = request.nextUrl.searchParams.get("step") ?? "answer";

  const admin = createAdminClient();
  if (!admin || !callId) {
    return twiml("<Say>Configuration error. Goodbye.</Say><Hangup/>");
  }

  const call = await getCallById(admin, callId);
  if (!call) {
    return twiml("<Say>This call is no longer active. Goodbye.</Say><Hangup/>");
  }

  const config = await getOrgIntegrationConfig(call.organization_id);

  // Authenticate the request when live Twilio credentials exist.
  const form = await request.formData();
  const formParams: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") formParams[key] = value;
  });
  if (config.twilio && !config.globalDryRun) {
    const valid = validateTwilioSignature({
      authToken: config.twilio.authToken,
      signature: request.headers.get("x-twilio-signature"),
      url: `${getEnv().APP_URL}${request.nextUrl.pathname}${request.nextUrl.search}`,
      formParams,
    });
    if (!valid) {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }

  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", call.lead_id)
    .maybeSingle();
  if (!lead) {
    return twiml("<Say>Lead not found. Goodbye.</Say><Hangup/>");
  }

  const appUrl = getEnv().APP_URL;
  const conferenceName = `conf_${call.id}`;

  if (step === "answer") {
    const action = `${appUrl}/api/twilio/voice?callId=${encodeURIComponent(call.id)}&amp;step=connect`;
    return twiml(
      `<Gather numDigits="1" timeout="8" method="POST" action="${action}">` +
        `<Say voice="alice">${escapeXml(buildAnnouncement(lead))}</Say>` +
        `</Gather>` +
        `<Say voice="alice">No response received. Goodbye.</Say><Hangup/>`,
    );
  }

  // step=connect — the agent pressed a key (or Gather timed out upstream).
  const digits = formParams.Digits ?? "";
  if (digits !== "1") {
    await updateCall(admin, call.organization_id, call.id, { outcome: "declined" });
    await logActivity(admin, {
      organizationId: call.organization_id,
      leadId: lead.id,
      type: "call_missed",
      title: "Agent declined the bridge call",
      metadata: { call_id: call.id },
    });
    // Fall through to the next agent asynchronously; don't block TwiML.
    advanceBridgeFallback(call.id, "Agent declined").catch((err) =>
      console.error("Bridge fallback failed:", err),
    );
    return twiml("<Say voice=\"alice\">Okay, cancelling. Goodbye.</Say><Hangup/>");
  }

  await updateCall(admin, call.organization_id, call.id, { status: "dialing_lead" });

  const callService = createCallService(config);
  const dial = await callService.dialLeadIntoConference({
    leadPhone: lead.phone,
    conferenceName,
    callId: call.id,
    organizationId: call.organization_id,
  });

  if (!dial.ok) {
    await updateCall(admin, call.organization_id, call.id, {
      status: "failed",
      outcome: "failed",
      ended_at: new Date().toISOString(),
    });
    return twiml(
      `<Say voice="alice">Could not reach the lead. Please try again from the app.</Say><Hangup/>`,
    );
  }

  await updateCall(admin, call.organization_id, call.id, { status: "agent_confirmed" });
  await logActivity(admin, {
    organizationId: call.organization_id,
    leadId: lead.id,
    type: "call_placed",
    title: "Agent confirmed — dialing lead into conference",
    metadata: { call_id: call.id, lead_call_sid: dial.callSid },
  });

  return twiml(
    `<Say voice="alice">Connecting you to ${escapeXml(lead.full_name)} now.</Say>` +
      `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true">` +
      `${conferenceName}</Conference></Dial>`,
  );
}

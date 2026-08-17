import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/db/activities";
import { getCallById, updateCall } from "@/lib/db/calls";
import { advanceBridgeFallback } from "@/lib/services/bridge-orchestrator";
import { getOrgIntegrationConfig } from "@/lib/services/config";
import { validateTwilioSignature } from "@/lib/services/twilio-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Twilio status callback (PRD §8). Query: callId, leg=agent|lead.
 * Agent-leg failures before the bridge trigger the fallback chain
 * (next agent → Call Pending). Completions finalize the calls row.
 */
export async function POST(request: NextRequest) {
  const callId = request.nextUrl.searchParams.get("callId") ?? "";
  const leg = request.nextUrl.searchParams.get("leg") ?? "agent";

  const admin = createAdminClient();
  if (!admin || !callId) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const call = await getCallById(admin, callId);
  if (!call) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const form = await request.formData();
  const formParams: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") formParams[key] = value;
  });

  const config = await getOrgIntegrationConfig(call.organization_id);
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

  const twilioStatus = formParams.CallStatus ?? "";
  const duration = formParams.CallDuration ? Number(formParams.CallDuration) : null;
  const now = new Date().toISOString();

  if (leg === "agent") {
    switch (twilioStatus) {
      case "no-answer":
      case "busy":
      case "failed":
      case "canceled": {
        // Agent never made it into the bridge — try the next agent.
        if (call.status === "queued" || call.status === "dialing_agent") {
          await advanceBridgeFallback(call.id, `Agent leg ${twilioStatus}`);
        }
        break;
      }
      case "completed": {
        if (call.status === "agent_confirmed" || call.status === "dialing_lead" || call.status === "bridged") {
          // Conversation happened; finalize.
          await updateCall(admin, call.organization_id, call.id, {
            status: "completed",
            outcome: call.outcome ?? "connected",
            duration: duration ?? call.duration,
            ended_at: now,
          });
          await admin
            .from("leads")
            .update({ last_contacted_at: now })
            .eq("organization_id", call.organization_id)
            .eq("id", call.lead_id);
          await logActivity(admin, {
            organizationId: call.organization_id,
            leadId: call.lead_id,
            actorId: call.agent_id,
            type: "call_completed",
            title: `Bridge call completed${duration ? ` (${Math.max(1, Math.round(duration / 60))} min)` : ""}`,
            metadata: { call_id: call.id, duration },
          });
        } else if (call.status === "dialing_agent") {
          // Agent hung up during the announcement → treat as decline.
          await advanceBridgeFallback(call.id, "Agent hung up before confirming");
        }
        break;
      }
      default:
        // initiated / ringing / in-progress — no state change needed;
        // the voice route drives confirm/connect transitions.
        break;
    }
  } else {
    // Lead leg
    switch (twilioStatus) {
      case "in-progress": {
        await updateCall(admin, call.organization_id, call.id, {
          status: "bridged",
          started_at: call.started_at ?? now,
        });
        break;
      }
      case "no-answer":
      case "busy":
      case "failed": {
        const outcome = twilioStatus === "busy" ? "busy" : twilioStatus === "failed" ? "failed" : "no_answer";
        await updateCall(admin, call.organization_id, call.id, {
          status: outcome === "failed" ? "failed" : outcome === "busy" ? "busy" : "no_answer",
          outcome,
          ended_at: now,
        });
        await logActivity(admin, {
          organizationId: call.organization_id,
          leadId: call.lead_id,
          actorId: call.agent_id,
          type: "call_missed",
          title: `Lead did not answer (${twilioStatus})`,
          metadata: { call_id: call.id },
        });
        break;
      }
      case "completed": {
        if (duration !== null) {
          await updateCall(admin, call.organization_id, call.id, {
            duration,
            ended_at: now,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response/>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}

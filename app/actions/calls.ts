"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLead } from "@/lib/db/leads";
import { requireProfile } from "@/lib/db/profiles";
import { startBridgeForLead } from "@/lib/services/bridge-orchestrator";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const startBridgeSchema = z.object({ leadId: z.string().uuid() });

/**
 * One-tap instant bridge from the lead detail page (PRD §6.5).
 * Access is verified through the user's RLS-scoped client (an agent can only
 * bridge leads they can see); the orchestration itself is a system flow.
 */
export async function startBridgeAction(
  raw: unknown,
): Promise<ActionResult<{ callId: string | null; detail: string }>> {
  const parsed = startBridgeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request." };
  }

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    // RLS-scoped fetch = access check. Also gives us the row for the bridge.
    const lead = await getLead(supabase, profile.organization_id, parsed.data.leadId);
    if (!lead) return { ok: false, error: "Lead not found." };

    const result = await startBridgeForLead({
      organizationId: profile.organization_id,
      lead,
      initiatedBy: profile.id,
    });

    revalidatePath(`/leads/${lead.id}`);

    if (!result.attempted && result.fallback === "call_pending") {
      return { ok: false, error: `Bridge unavailable: ${result.detail}` };
    }
    return {
      ok: true,
      data: { callId: result.callId, detail: result.detail },
      dryRun: result.dryRun,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the call" };
  }
}

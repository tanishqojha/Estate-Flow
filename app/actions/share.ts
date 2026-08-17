"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/db/activities";
import { getLead } from "@/lib/db/leads";
import { insertMessage } from "@/lib/db/messages";
import { notify } from "@/lib/db/notifications";
import { requireProfile } from "@/lib/db/profiles";
import { getProperty } from "@/lib/db/properties";
import { insertShare } from "@/lib/db/shares";
import { getOrgIntegrationConfig } from "@/lib/services/config";
import { createEmailService } from "@/lib/services/email-service";
import { createMessageService } from "@/lib/services/message-service";
import { propertyShareService } from "@/lib/services/property-share-service";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { sharePropertySchema } from "@/lib/validation/property";

/**
 * One-click property share (PRD §6.6): UI → this action → messageService /
 * emailService → db layer. Writes messages + lead_property_shares + an
 * activities row, and bumps last_contacted_at (Rules.md §6).
 */
export async function sharePropertyAction(
  raw: unknown,
): Promise<ActionResult<{ shareUrl: string; dryRun: boolean }>> {
  const parsed = sharePropertySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { leadId, propertyId, channel } = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    // RLS-scoped fetches double as access checks.
    const [lead, property] = await Promise.all([
      getLead(supabase, profile.organization_id, leadId),
      getProperty(supabase, profile.organization_id, propertyId),
    ]);
    if (!lead) return { ok: false, error: "Lead not found." };
    if (!property) return { ok: false, error: "Property not found." };
    if (channel === "email" && !lead.email) {
      return { ok: false, error: "This lead has no email address on file." };
    }

    const shareUrl = propertyShareService.buildShareUrl(property.share_slug);
    const messageBody = propertyShareService.buildShareMessage(channel, {
      leadName: lead.full_name.split(" ")[0] ?? lead.full_name,
      propertyTitle: property.title,
      location: property.location,
      price: property.price,
      shareUrl,
      agentName: profile.full_name,
    });

    const config = await getOrgIntegrationConfig(profile.organization_id);
    let dryRun = config.globalDryRun;
    let providerMessageId: string | null = null;
    let sendError: string | undefined;

    if (channel === "whatsapp" || channel === "sms") {
      const messageService = createMessageService(config);
      const result = await messageService.send({
        channel,
        to: lead.phone,
        body: messageBody,
        organizationId: profile.organization_id,
      });
      dryRun = result.dryRun;
      providerMessageId = result.providerMessageId;
      sendError = result.error;
    } else if (channel === "email") {
      const emailService = createEmailService(config);
      const result = await emailService.send({
        to: lead.email as string,
        subject: `Property for you: ${property.title}`,
        html: messageBody.replaceAll("\n", "<br/>"),
        text: messageBody,
        organizationId: profile.organization_id,
      });
      dryRun = result.dryRun;
      providerMessageId = result.providerMessageId;
      sendError = result.error;
    }
    // channel === "link": nothing is sent; the caller copies the URL.

    if (sendError) {
      return { ok: false, error: `Could not send: ${sendError}` };
    }

    let messageId: string | null = null;
    if (channel !== "link") {
      const { message } = await insertMessage(supabase, {
        organization_id: profile.organization_id,
        lead_id: lead.id,
        sender_id: profile.id,
        channel,
        direction: "outbound",
        status: "sent",
        to_address: channel === "email" ? (lead.email as string) : lead.phone,
        subject: channel === "email" ? `Property for you: ${property.title}` : null,
        body: messageBody,
        template_key: "property_share",
        provider_message_id: providerMessageId,
        is_dry_run: dryRun,
      });
      messageId = message?.id ?? null;
    }

    await insertShare(supabase, {
      organization_id: profile.organization_id,
      lead_id: lead.id,
      property_id: property.id,
      shared_by: profile.id,
      channel,
      message_id: messageId,
      share_url: shareUrl,
    });

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      leadId: lead.id,
      actorId: profile.id,
      type: "property_shared",
      title: `Shared "${property.title}" via ${channel === "link" ? "link" : channel}${dryRun ? " (dry run)" : ""}`,
      description: property.location,
      metadata: { property_id: property.id, channel, dry_run: dryRun },
    });

    if (channel !== "link") {
      await supabase
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("organization_id", profile.organization_id)
        .eq("id", lead.id);
    }

    // Keep the assigned agent in the loop when someone else shares (PRD §6.11).
    if (lead.assigned_agent_id && lead.assigned_agent_id !== profile.id) {
      await notify({
        organizationId: profile.organization_id,
        userId: lead.assigned_agent_id,
        type: "property_shared",
        title: `Property shared with ${lead.full_name}`,
        body: `${profile.full_name} shared "${property.title}" via ${channel}.`,
        link: `/leads/${lead.id}`,
      });
    }

    revalidatePath(`/leads/${lead.id}`);
    return { ok: true, data: { shareUrl, dryRun }, dryRun };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not share property" };
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getDueUnreminded } from "@/lib/db/followups";
import { notify } from "@/lib/db/notifications";
import { getDueScheduledPosts } from "@/lib/db/social-posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Follow-up due notifications (PRD §6.7/§6.11). Invoked by Vercel Cron
 * (vercel.json, every 5 min) or manually:
 *   curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/followups
 * Auth: Vercel injects `Authorization: Bearer ${CRON_SECRET}` when the env
 * var is set; requests without it are rejected.
 */
export async function GET(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    // TODO: SUPABASE_SERVICE_ROLE_KEY required for reminder delivery.
    return NextResponse.json(
      { ok: false, error: "Service role key missing — reminders skipped." },
      { status: 503 },
    );
  }

  const due = await getDueUnreminded(admin);
  let notified = 0;

  for (const followup of due) {
    if (!followup.agent || !followup.lead) {
      // Nothing actionable without an agent; mark handled to avoid re-scans.
      await admin.from("followups").update({ reminder_sent: true }).eq("id", followup.id);
      continue;
    }
    await notify({
      organizationId: followup.organization_id,
      userId: followup.agent.id,
      type: "followup_due",
      title: `Follow-up due: ${followup.lead.full_name}`,
      body: followup.note ?? "Time to follow up.",
      link: `/leads/${followup.lead.id}`,
      metadata: { followup_id: followup.id },
    });
    await admin.from("followups").update({ reminder_sent: true }).eq("id", followup.id);
    notified += 1;
  }

  // Scheduled social posts whose time has arrived → notify the creator to
  // dispatch (PRD §6.11 "social post due"). Dedupe via dispatch_response flag.
  const duePosts = await getDueScheduledPosts(admin);
  let postsNotified = 0;
  for (const post of duePosts) {
    const meta = post.dispatch_response as { due_notified?: boolean } | null;
    if (meta?.due_notified || !post.creator) continue;
    await notify({
      organizationId: post.organization_id,
      userId: post.creator.id,
      type: "social_post_due",
      title: `Post due: ${post.title}`,
      body: "Scheduled time reached — dispatch it to your automation webhook.",
      link: "/social",
      metadata: { post_id: post.id },
    });
    await admin
      .from("social_posts")
      .update({ dispatch_response: { ...(meta ?? {}), due_notified: true } })
      .eq("id", post.id);
    postsNotified += 1;
  }

  return NextResponse.json({
    ok: true,
    followupsDue: due.length,
    followupsNotified: notified,
    postsDue: duePosts.length,
    postsNotified,
  });
}

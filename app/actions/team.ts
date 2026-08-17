"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/db/profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { phoneSchema } from "@/lib/validation/lead";

const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  role: z.enum(["admin", "sales_manager", "sales_agent", "field_executive", "social_media_manager"]),
});

const memberActionSchema = z.object({ profileId: z.string().uuid() });

/**
 * Admin invite flow (PRD §6.1). Creates the auth user with org + role in
 * app_metadata (server-set, unforgeable); the handle_new_user trigger
 * provisions the profile. A one-time temporary password is returned to the
 * admin to hand over securely.
 * TODO: switch to email invites (inviteUserByEmail) once org SMTP is set up.
 */
export async function inviteMemberAction(
  raw: unknown,
): Promise<ActionResult<{ tempPassword: string }>> {
  const parsed = inviteMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireProfile();
    if (profile.role !== "admin") {
      return { ok: false, error: "Only admins can invite team members." };
    }

    const admin = createAdminClient();
    if (!admin) {
      return {
        ok: false,
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY — invites are unavailable in this environment.",
      };
    }

    const tempPassword = `Ef!${randomBytes(9).toString("base64url")}`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { organization_id: profile.organization_id, role: input.role },
      user_metadata: { full_name: input.fullName, phone: input.phone ?? null },
    });
    if (error || !created.user) {
      return {
        ok: false,
        error: error?.message.includes("already been registered")
          ? "A user with this email already exists."
          : (error?.message ?? "Could not create the user."),
      };
    }

    // Membership ledger row (profile row comes from the auth trigger).
    await admin.from("team_members").upsert(
      {
        organization_id: profile.organization_id,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone ?? null,
        role: input.role,
        status: "active",
        profile_id: created.user.id,
        invited_by: profile.id,
      },
      { onConflict: "organization_id,email" },
    );

    revalidatePath("/team");
    return { ok: true, data: { tempPassword } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not invite member" };
  }
}

export async function setMemberActiveAction(
  raw: unknown,
  active: boolean,
): Promise<ActionResult<undefined>> {
  const parsed = memberActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    if (profile.role !== "admin") {
      return { ok: false, error: "Only admins can manage team members." };
    }
    if (parsed.data.profileId === profile.id && !active) {
      return { ok: false, error: "You can't deactivate your own account." };
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: active })
      .eq("organization_id", profile.organization_id)
      .eq("id", parsed.data.profileId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/team");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update member" };
  }
}

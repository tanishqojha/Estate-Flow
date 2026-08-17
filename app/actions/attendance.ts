"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/db/activities";
import { getManagers } from "@/lib/db/assignment";
import {
  getTodayAttendance,
  insertAttendance,
  updateAttendance,
} from "@/lib/db/attendance";
import { notify } from "@/lib/db/notifications";
import { getOrganization } from "@/lib/db/organizations";
import { requireProfile } from "@/lib/db/profiles";
import { attendanceService } from "@/lib/services/attendance-service";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { checkInSchema, checkOutSchema } from "@/lib/validation/attendance";

/**
 * GPS check-in with optional selfie (PRD §6.10). FormData because a file may
 * ride along; coordinates are Zod-validated + range-checked by the adapter.
 * Selfies land in the private attendance-selfies bucket under
 * <org>/<user>/<date>-selfie.jpg (storage RLS: own path only).
 */
export async function checkInAction(formData: FormData): Promise<ActionResult<undefined>> {
  const parsed = checkInSchema.safeParse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    notes: formData.get("notes") ? String(formData.get("notes")) : null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid location" };
  }
  const { lat, lng, notes } = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    if (!attendanceService.validateLocation({ lat, lng })) {
      return { ok: false, error: "Could not read a valid GPS location. Enable location and retry." };
    }

    const existing = await getTodayAttendance(supabase, profile.organization_id, profile.id);
    if (existing?.check_in_time) {
      return { ok: false, error: "You are already checked in today." };
    }

    const org = await getOrganization(supabase, profile.organization_id);
    const now = new Date();
    const status = attendanceService.deriveCheckInStatus(now, org?.timezone ?? "Asia/Kolkata");
    const workDate = now.toISOString().slice(0, 10);

    // Optional selfie
    let selfiePath: string | null = null;
    const selfie = formData.get("selfie");
    if (selfie instanceof File && selfie.size > 0) {
      if (selfie.size > 5 * 1024 * 1024) {
        return { ok: false, error: "Selfie must be under 5 MB." };
      }
      selfiePath = attendanceService.buildSelfiePath(profile.organization_id, profile.id, workDate);
      const buffer = Buffer.from(await selfie.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("attendance-selfies")
        .upload(selfiePath, buffer, {
          contentType: selfie.type || "image/jpeg",
          upsert: true,
        });
      if (uploadError) {
        console.error("Selfie upload failed:", uploadError.message);
        selfiePath = null; // check-in still succeeds; selfie is optional
      }
    }

    const { attendance, error } = existing
      ? await updateAttendance(supabase, profile.organization_id, existing.id, {
          check_in_time: now.toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          selfie_path: selfiePath,
          status,
          notes: notes ?? existing.notes,
        })
      : await insertAttendance(supabase, {
          organization_id: profile.organization_id,
          user_id: profile.id,
          work_date: workDate,
          check_in_time: now.toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          selfie_path: selfiePath,
          status,
          notes: notes ?? null,
        });
    if (error || !attendance) return { ok: false, error: error ?? "Could not check in" };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      actorId: profile.id,
      type: "attendance_check_in",
      title: `${profile.full_name} checked in${status === "late" ? " (late)" : ""}`,
      metadata: { attendance_id: attendance.id, lat, lng },
    });

    // Late check-in → attendance issue notification to managers (PRD §6.11).
    if (status === "late") {
      const managers = await getManagers(supabase, profile.organization_id);
      await Promise.all(
        managers
          .filter((m) => m.id !== profile.id)
          .map((m) =>
            notify({
              organizationId: profile.organization_id,
              userId: m.id,
              type: "attendance_issue",
              title: `Late check-in: ${profile.full_name}`,
              body: `Checked in at ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`,
              link: "/attendance",
            }),
          ),
      );
    }

    revalidatePath("/attendance");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not check in" };
  }
}

export async function checkOutAction(formData: FormData): Promise<ActionResult<undefined>> {
  const parsed = checkOutSchema.safeParse({
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid location" };
  }
  const { lat, lng } = parsed.data;

  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabase();

    if (!attendanceService.validateLocation({ lat, lng })) {
      return { ok: false, error: "Could not read a valid GPS location. Enable location and retry." };
    }

    const existing = await getTodayAttendance(supabase, profile.organization_id, profile.id);
    if (!existing?.check_in_time) {
      return { ok: false, error: "Check in first — there's no open attendance for today." };
    }
    if (existing.check_out_time) {
      return { ok: false, error: "You already checked out today." };
    }

    const now = new Date();
    const { error } = await updateAttendance(supabase, profile.organization_id, existing.id, {
      check_out_time: now.toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
    });
    if (error) return { ok: false, error };

    await logActivity(supabase, {
      organizationId: profile.organization_id,
      actorId: profile.id,
      type: "attendance_check_out",
      title: `${profile.full_name} checked out`,
      metadata: { attendance_id: existing.id, lat, lng },
    });

    revalidatePath("/attendance");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not check out" };
  }
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRow, Database } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export type AttendanceWithUser = AttendanceRow & {
  user: { id: string; full_name: string; role: string; avatar_url: string | null } | null;
};

export async function getTodayAttendance(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<AttendanceRow | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("attendance")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("work_date", today)
    .maybeSingle();
  if (error) {
    console.error("getTodayAttendance failed:", error.message);
    return null;
  }
  return data;
}

export async function insertAttendance(
  db: Db,
  values: Database["public"]["Tables"]["attendance"]["Insert"],
): Promise<{ attendance: AttendanceRow | null; error: string | null }> {
  const { data, error } = await db.from("attendance").insert(values).select().single();
  if (error) {
    console.error("insertAttendance failed:", error.message);
    return { attendance: null, error: error.message };
  }
  return { attendance: data, error: null };
}

export async function updateAttendance(
  db: Db,
  organizationId: string,
  attendanceId: string,
  values: Database["public"]["Tables"]["attendance"]["Update"],
): Promise<{ attendance: AttendanceRow | null; error: string | null }> {
  const { data, error } = await db
    .from("attendance")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", attendanceId)
    .select()
    .single();
  if (error) {
    console.error("updateAttendance failed:", error.message);
    return { attendance: null, error: error.message };
  }
  return { attendance: data, error: null };
}

export async function listMyAttendance(
  db: Db,
  organizationId: string,
  userId: string,
  limit = 14,
): Promise<AttendanceRow[]> {
  const { data, error } = await db
    .from("attendance")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("work_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listMyAttendance failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** Today's org-wide records (managers; RLS enforces access). */
export async function listTodayOrgAttendance(
  db: Db,
  organizationId: string,
): Promise<AttendanceWithUser[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("attendance")
    .select("*, user:profiles!attendance_user_id_fkey(id, full_name, role, avatar_url)")
    .eq("organization_id", organizationId)
    .eq("work_date", today)
    .order("check_in_time", { ascending: true });
  if (error) {
    console.error("listTodayOrgAttendance failed:", error.message);
    return [];
  }
  return (data ?? []) as AttendanceWithUser[];
}

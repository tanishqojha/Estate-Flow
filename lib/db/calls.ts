import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CallRow } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export async function insertCall(
  db: Db,
  values: Database["public"]["Tables"]["calls"]["Insert"],
): Promise<{ call: CallRow | null; error: string | null }> {
  const { data, error } = await db.from("calls").insert(values).select().single();
  if (error) {
    console.error("insertCall failed:", error.message);
    return { call: null, error: error.message };
  }
  return { call: data, error: null };
}

export async function updateCall(
  db: Db,
  organizationId: string,
  callId: string,
  values: Database["public"]["Tables"]["calls"]["Update"],
): Promise<{ call: CallRow | null; error: string | null }> {
  const { data, error } = await db
    .from("calls")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", callId)
    .select()
    .single();
  if (error) {
    console.error("updateCall failed:", error.message);
    return { call: null, error: error.message };
  }
  return { call: data, error: null };
}

export async function getCallById(
  db: Db,
  callId: string,
): Promise<CallRow | null> {
  const { data, error } = await db.from("calls").select("*").eq("id", callId).maybeSingle();
  if (error) {
    console.error("getCallById failed:", error.message);
    return null;
  }
  return data;
}

export async function getCallBySid(db: Db, callSid: string): Promise<CallRow | null> {
  const { data, error } = await db
    .from("calls")
    .select("*")
    .eq("call_sid", callSid)
    .maybeSingle();
  if (error) {
    console.error("getCallBySid failed:", error.message);
    return null;
  }
  return data;
}

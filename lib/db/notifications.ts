import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, NotificationType } from "@/lib/types/database";

type Db = SupabaseClient<Database>;

export interface NotifyInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Json;
}

/**
 * System-generated notifications are service-role inserts (RLS grants users
 * read/update on their own rows only). Degrades to a warning when the
 * service key is missing — never crashes the calling flow.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      `[dry-run] notification skipped (no service key): ${input.type} → user ${input.userId}`,
    );
    return;
  }
  const { error } = await admin.from("notifications").insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error(`Failed to create notification "${input.type}":`, error.message);
  }
}

export async function getMyNotifications(db: Db, userId: string, limit = 50) {
  return db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getUnreadNotificationCount(db: Db, userId: string): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("Failed to count unread notifications:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(db: Db, notificationId: string) {
  return db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
}

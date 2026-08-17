/**
 * Typed Supabase schema — hand-written to mirror supabase/migrations exactly.
 * TODO: once a Supabase instance is running, regenerate with
 *   pnpm dlx supabase gen types typescript --local > lib/types/database.ts
 * and keep the enum/table names in sync.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enums (mirror 0001_extensions_and_enums.sql)
// ---------------------------------------------------------------------------
export type UserRole =
  | "admin"
  | "sales_manager"
  | "sales_agent"
  | "field_executive"
  | "social_media_manager";

export type LeadSource =
  | "36_acre"
  | "magicbricks"
  | "housing"
  | "facebook"
  | "instagram"
  | "website"
  | "referral"
  | "manual"
  | "other";

export type PropertyType = "apartment" | "villa" | "plot" | "commercial" | "rental";

export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "site_visit_scheduled"
  | "negotiation"
  | "won"
  | "lost"
  | "not_responding"
  | "call_pending";

export type LeadTemperature = "cold" | "warm" | "hot";

export type AvailabilityStatus = "available" | "hold" | "sold" | "rented";

export type SocialStatus = "idea" | "draft" | "scheduled" | "published";

export type AssignmentMode = "round_robin" | "manual" | "least_busy";

export type FurnishingStatus = "unfurnished" | "semi_furnished" | "fully_furnished";

export type CallStatus =
  | "queued"
  | "dialing_agent"
  | "agent_confirmed"
  | "dialing_lead"
  | "bridged"
  | "completed"
  | "no_answer"
  | "busy"
  | "failed"
  | "canceled";

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "busy"
  | "failed"
  | "voicemail"
  | "declined";

export type MessageChannel = "whatsapp" | "sms" | "email";
export type MessageDirection = "outbound" | "inbound";
export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export type FollowupStatus = "pending" | "completed" | "snoozed" | "cancelled";

export type AttendanceStatus = "present" | "late" | "absent" | "half_day";

export type ShareChannel = "whatsapp" | "sms" | "email" | "link";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type SocialPostType = "image" | "video" | "reel" | "story" | "carousel" | "text";

export type TeamMemberStatus = "invited" | "active" | "disabled";

export type ActivityType =
  | "lead_created"
  | "lead_assigned"
  | "lead_reassigned"
  | "status_changed"
  | "temperature_changed"
  | "note_added"
  | "call_placed"
  | "call_completed"
  | "call_missed"
  | "message_sent"
  | "email_sent"
  | "property_shared"
  | "followup_scheduled"
  | "followup_completed"
  | "followup_snoozed"
  | "site_visit_scheduled"
  | "attendance_check_in"
  | "attendance_check_out"
  | "social_post_dispatched"
  | "task_created";

export type NotificationType =
  | "lead_assigned"
  | "missed_call"
  | "call_pending"
  | "followup_due"
  | "site_visit"
  | "property_shared"
  | "attendance_issue"
  | "social_post_due";

// ---------------------------------------------------------------------------
// Row types (mirror 0002_tables.sql)
// ---------------------------------------------------------------------------
export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  default_assignment_mode: AssignmentMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileRow = {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type TeamMemberRow = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  status: TeamMemberStatus;
  profile_id: string | null;
  invited_by: string | null;
  invite_token: string;
  created_at: string;
  updated_at: string;
}

export type LeadSourceRow = {
  id: string;
  organization_id: string;
  name: string;
  key: LeadSource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadRow = {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  source_detail: string | null;
  property_type: PropertyType | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_location: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  assigned_agent_id: string | null;
  notes: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

export type PropertyRow = {
  id: string;
  organization_id: string;
  title: string;
  location: string | null;
  address: string | null;
  property_type: PropertyType;
  price: number | null;
  size: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  furnishing_status: FurnishingStatus | null;
  availability_status: AvailabilityStatus;
  description: string | null;
  amenities: string[];
  owner_developer: string | null;
  cover_image_url: string | null;
  share_slug: string;
  created_at: string;
  updated_at: string;
}

export type PropertyImageRow = {
  id: string;
  organization_id: string;
  property_id: string;
  storage_path: string | null;
  external_url: string | null;
  caption: string | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
  updated_at: string;
}

export type PropertyDocumentRow = {
  id: string;
  organization_id: string;
  property_id: string;
  storage_path: string | null;
  external_url: string | null;
  file_name: string;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  actor_id: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type CallRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  agent_id: string | null;
  call_sid: string | null;
  conference_sid: string | null;
  status: CallStatus;
  duration: number | null;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  outcome: CallOutcome | null;
  is_dry_run: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type MessageRow = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  sender_id: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  to_address: string;
  subject: string | null;
  body: string;
  template_key: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  is_dry_run: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadPropertyShareRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  property_id: string;
  shared_by: string | null;
  channel: ShareChannel;
  message_id: string | null;
  share_url: string | null;
  created_at: string;
  updated_at: string;
}

export type FollowupRow = {
  id: string;
  organization_id: string;
  lead_id: string;
  agent_id: string | null;
  due_at: string;
  status: FollowupStatus;
  note: string | null;
  template_key: string | null;
  snooze_count: number;
  reminder_sent: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AttendanceRow = {
  id: string;
  organization_id: string;
  user_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  selfie_path: string | null;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SocialPostRow = {
  id: string;
  organization_id: string;
  title: string;
  caption: string | null;
  post_type: SocialPostType;
  status: SocialStatus;
  scheduled_for: string | null;
  published_at: string | null;
  platforms: string[];
  media_paths: string[];
  created_by: string | null;
  ai_caption_prompt: string | null;
  dispatched_at: string | null;
  dispatch_response: Json | null;
  created_at: string;
  updated_at: string;
}

export type TaskRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  lead_id: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type IntegrationSettingsRow = {
  id: string;
  organization_id: string;
  twilio_account_sid: string | null;
  twilio_auth_token_encrypted: string | null;
  twilio_phone_number: string | null;
  whatsapp_provider: string;
  whatsapp_sender: string | null;
  resend_api_key_encrypted: string | null;
  smtp_url_encrypted: string | null;
  email_from: string | null;
  ai_api_key_encrypted: string | null;
  ai_base_url: string | null;
  social_dispatch_webhook_url: string | null;
  webhook_secret: string;
  default_assignment_mode: AssignmentMode;
  created_at: string;
  updated_at: string;
}

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert/Update helpers: Insert = required columns + everything else optional;
// Update = all optional.
// ---------------------------------------------------------------------------
type InsertOf<Row, RequiredKeys extends keyof Row> = Partial<Row> & Pick<Row, RequiredKeys>;

/** FK metadata (default Postgres `<table>_<column>_fkey` naming) so
 *  postgrest-js can type embedded joins like `actor:profiles(...)`. */
type FkRel<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<Row, Insert, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: Relationships;
}

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<OrganizationRow, InsertOf<OrganizationRow, "name" | "slug">>;
      profiles: TableDef<
        ProfileRow,
        InsertOf<ProfileRow, "id" | "organization_id" | "full_name" | "email">,
        [FkRel<"profiles_organization_id_fkey", "organization_id", "organizations">]
      >;
      team_members: TableDef<
        TeamMemberRow,
        InsertOf<TeamMemberRow, "organization_id" | "email" | "full_name">,
        [
          FkRel<"team_members_organization_id_fkey", "organization_id", "organizations">,
          FkRel<"team_members_profile_id_fkey", "profile_id", "profiles">,
          FkRel<"team_members_invited_by_fkey", "invited_by", "profiles">,
        ]
      >;
      lead_sources: TableDef<LeadSourceRow, InsertOf<LeadSourceRow, "organization_id" | "name">>;
      leads: TableDef<
        LeadRow,
        InsertOf<LeadRow, "organization_id" | "full_name" | "phone">,
        [
          FkRel<"leads_organization_id_fkey", "organization_id", "organizations">,
          FkRel<"leads_assigned_agent_id_fkey", "assigned_agent_id", "profiles">,
        ]
      >;
      properties: TableDef<
        PropertyRow,
        InsertOf<PropertyRow, "organization_id" | "title" | "property_type">,
        [FkRel<"properties_organization_id_fkey", "organization_id", "organizations">]
      >;
      property_images: TableDef<
        PropertyImageRow,
        InsertOf<PropertyImageRow, "organization_id" | "property_id">,
        [FkRel<"property_images_property_id_fkey", "property_id", "properties">]
      >;
      property_documents: TableDef<
        PropertyDocumentRow,
        InsertOf<PropertyDocumentRow, "organization_id" | "property_id" | "file_name">,
        [FkRel<"property_documents_property_id_fkey", "property_id", "properties">]
      >;
      activities: TableDef<
        ActivityRow,
        InsertOf<ActivityRow, "organization_id" | "type" | "title">,
        [
          FkRel<"activities_lead_id_fkey", "lead_id", "leads">,
          FkRel<"activities_actor_id_fkey", "actor_id", "profiles">,
        ]
      >;
      calls: TableDef<
        CallRow,
        InsertOf<CallRow, "organization_id" | "lead_id">,
        [
          FkRel<"calls_lead_id_fkey", "lead_id", "leads">,
          FkRel<"calls_agent_id_fkey", "agent_id", "profiles">,
        ]
      >;
      messages: TableDef<
        MessageRow,
        InsertOf<MessageRow, "organization_id" | "channel" | "to_address" | "body">,
        [
          FkRel<"messages_lead_id_fkey", "lead_id", "leads">,
          FkRel<"messages_sender_id_fkey", "sender_id", "profiles">,
        ]
      >;
      lead_property_shares: TableDef<
        LeadPropertyShareRow,
        InsertOf<LeadPropertyShareRow, "organization_id" | "lead_id" | "property_id" | "channel">,
        [
          FkRel<"lead_property_shares_lead_id_fkey", "lead_id", "leads">,
          FkRel<"lead_property_shares_property_id_fkey", "property_id", "properties">,
          FkRel<"lead_property_shares_shared_by_fkey", "shared_by", "profiles">,
          FkRel<"lead_property_shares_message_id_fkey", "message_id", "messages">,
        ]
      >;
      followups: TableDef<
        FollowupRow,
        InsertOf<FollowupRow, "organization_id" | "lead_id" | "due_at">,
        [
          FkRel<"followups_lead_id_fkey", "lead_id", "leads">,
          FkRel<"followups_agent_id_fkey", "agent_id", "profiles">,
        ]
      >;
      attendance: TableDef<
        AttendanceRow,
        InsertOf<AttendanceRow, "organization_id" | "user_id">,
        [FkRel<"attendance_user_id_fkey", "user_id", "profiles">]
      >;
      social_posts: TableDef<
        SocialPostRow,
        InsertOf<SocialPostRow, "organization_id" | "title">,
        [FkRel<"social_posts_created_by_fkey", "created_by", "profiles">]
      >;
      tasks: TableDef<
        TaskRow,
        InsertOf<TaskRow, "organization_id" | "title">,
        [
          FkRel<"tasks_assigned_to_fkey", "assigned_to", "profiles">,
          FkRel<"tasks_lead_id_fkey", "lead_id", "leads">,
          FkRel<"tasks_created_by_fkey", "created_by", "profiles">,
        ]
      >;
      integration_settings: TableDef<
        IntegrationSettingsRow,
        InsertOf<IntegrationSettingsRow, "organization_id">
      >;
      notifications: TableDef<
        NotificationRow,
        InsertOf<NotificationRow, "organization_id" | "user_id" | "type" | "title">,
        [FkRel<"notifications_user_id_fkey", "user_id", "profiles">]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_org_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_role: { Args: Record<PropertyKey, never>; Returns: UserRole };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_manager_or_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_assigned_agent: { Args: { p_lead_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      lead_source: LeadSource;
      property_type: PropertyType;
      lead_status: LeadStatus;
      lead_temperature: LeadTemperature;
      availability_status: AvailabilityStatus;
      social_status: SocialStatus;
      assignment_mode: AssignmentMode;
      furnishing_status: FurnishingStatus;
      call_status: CallStatus;
      call_outcome: CallOutcome;
      message_channel: MessageChannel;
      message_direction: MessageDirection;
      message_status: MessageStatus;
      followup_status: FollowupStatus;
      attendance_status: AttendanceStatus;
      share_channel: ShareChannel;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      social_post_type: SocialPostType;
      team_member_status: TeamMemberStatus;
      activity_type: ActivityType;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

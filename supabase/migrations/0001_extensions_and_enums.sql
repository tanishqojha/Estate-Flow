-- EstateFlow CRM — 0001: extensions + enums
-- Every enum used across the schema. Display labels are mapped in the UI
-- (e.g. '36_acre' → '36 Acre'); DB stores stable snake_case values.

create extension if not exists "pgcrypto";

-- Roles (PRD §2)
create type public.user_role as enum (
  'admin',
  'sales_manager',
  'sales_agent',
  'field_executive',
  'social_media_manager'
);

-- Lead source (PRD §5 enums)
create type public.lead_source as enum (
  '36_acre',
  'magicbricks',
  'housing',
  'facebook',
  'instagram',
  'website',
  'referral',
  'manual',
  'other'
);

create type public.property_type as enum (
  'apartment',
  'villa',
  'plot',
  'commercial',
  'rental'
);

-- Lead status. 'call_pending' is required by the call-bridge fallback
-- (Rules.md §8: no agent answers → mark lead Call Pending).
create type public.lead_status as enum (
  'new',
  'contacted',
  'interested',
  'site_visit_scheduled',
  'negotiation',
  'won',
  'lost',
  'not_responding',
  'call_pending'
);

create type public.lead_temperature as enum ('cold', 'warm', 'hot');

create type public.availability_status as enum ('available', 'hold', 'sold', 'rented');

create type public.social_status as enum ('idea', 'draft', 'scheduled', 'published');

create type public.assignment_mode as enum ('round_robin', 'manual', 'least_busy');

create type public.furnishing_status as enum ('unfurnished', 'semi_furnished', 'fully_furnished');

-- Call lifecycle for the instant bridge (agent-first → confirm → lead → conference)
create type public.call_status as enum (
  'queued',
  'dialing_agent',
  'agent_confirmed',
  'dialing_lead',
  'bridged',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled'
);

create type public.call_outcome as enum (
  'connected',
  'no_answer',
  'busy',
  'failed',
  'voicemail',
  'declined'
);

create type public.message_channel as enum ('whatsapp', 'sms', 'email');

create type public.message_direction as enum ('outbound', 'inbound');

create type public.message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');

create type public.followup_status as enum ('pending', 'completed', 'snoozed', 'cancelled');

create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day');

create type public.share_channel as enum ('whatsapp', 'sms', 'email', 'link');

create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');

create type public.social_post_type as enum ('image', 'video', 'reel', 'story', 'carousel', 'text');

create type public.team_member_status as enum ('invited', 'active', 'disabled');

-- Timeline event types. activities is the single source of truth for the
-- lead timeline (PRD §5); every feature table also writes one of these.
create type public.activity_type as enum (
  'lead_created',
  'lead_assigned',
  'lead_reassigned',
  'status_changed',
  'temperature_changed',
  'note_added',
  'call_placed',
  'call_completed',
  'call_missed',
  'message_sent',
  'email_sent',
  'property_shared',
  'followup_scheduled',
  'followup_completed',
  'followup_snoozed',
  'site_visit_scheduled',
  'attendance_check_in',
  'attendance_check_out',
  'social_post_dispatched',
  'task_created'
);

create type public.notification_type as enum (
  'lead_assigned',
  'missed_call',
  'call_pending',
  'followup_due',
  'site_visit',
  'property_shared',
  'attendance_issue',
  'social_post_due'
);

-- Shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

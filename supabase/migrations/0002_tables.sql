-- EstateFlow CRM — 0002: tables
-- Every table: id uuid PK, created_at, updated_at.
-- Every tenant table: non-null organization_id (Rules.md §3). RLS lands in 0003
-- in the same migration set — no tenant table ships without it.

-- ---------------------------------------------------------------------------
-- organizations (tenant root)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  timezone text not null default 'Asia/Kolkata',
  default_assignment_mode public.assignment_mode not null default 'round_robin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users; carries org + role)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role public.user_role not null default 'sales_agent',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_idx on public.profiles (organization_id);
create unique index profiles_org_email_idx on public.profiles (organization_id, email);

-- ---------------------------------------------------------------------------
-- team_members (invite / membership ledger; admin invite flow)
-- ---------------------------------------------------------------------------
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null default 'sales_agent',
  status public.team_member_status not null default 'invited',
  profile_id uuid references public.profiles (id) on delete set null,
  invited_by uuid references public.profiles (id) on delete set null,
  invite_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index team_members_org_idx on public.team_members (organization_id);

-- ---------------------------------------------------------------------------
-- lead_sources (per-org configurable source registry)
-- ---------------------------------------------------------------------------
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  key public.lead_source not null default 'other',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index lead_sources_org_idx on public.lead_sources (organization_id);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  source public.lead_source not null default 'other',
  source_detail text,
  property_type public.property_type,
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  preferred_location text,
  status public.lead_status not null default 'new',
  temperature public.lead_temperature not null default 'warm',
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  notes text,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  -- idempotency guard for webhook ingestion (Rules.md §6)
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_org_idx on public.leads (organization_id);
create index leads_org_status_idx on public.leads (organization_id, status);
create index leads_org_agent_idx on public.leads (organization_id, assigned_agent_id);
create index leads_org_phone_idx on public.leads (organization_id, phone);
create unique index leads_org_external_ref_idx
  on public.leads (organization_id, external_ref)
  where external_ref is not null;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  location text,
  address text,
  property_type public.property_type not null,
  price numeric(14, 2),
  size text,
  bedrooms integer,
  bathrooms integer,
  floor text,
  furnishing_status public.furnishing_status,
  availability_status public.availability_status not null default 'available',
  description text,
  amenities text[] not null default '{}',
  owner_developer text,
  cover_image_url text,
  -- public share link slug (unguessable)
  share_slug text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_org_idx on public.properties (organization_id);
create index properties_org_availability_idx on public.properties (organization_id, availability_status);
create index properties_org_type_idx on public.properties (organization_id, property_type);

-- ---------------------------------------------------------------------------
-- property_images / property_documents
-- storage_path → Supabase Storage object (signed URLs only);
-- external_url → placeholder used by the demo seed.
-- ---------------------------------------------------------------------------
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text,
  external_url text,
  caption text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index property_images_property_idx on public.property_images (property_id);
create index property_images_org_idx on public.property_images (organization_id);

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text,
  external_url text,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create index property_documents_property_idx on public.property_documents (property_id);
create index property_documents_org_idx on public.property_documents (organization_id);

-- ---------------------------------------------------------------------------
-- activities — single source of truth for the lead timeline (PRD §5)
-- Immutable: no update/delete policies will be granted.
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type public.activity_type not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_org_lead_created_idx on public.activities (organization_id, lead_id, created_at desc);
create index activities_org_created_idx on public.activities (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- calls (instant bridge log)
-- ---------------------------------------------------------------------------
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,
  call_sid text,
  conference_sid text,
  status public.call_status not null default 'queued',
  duration integer,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  outcome public.call_outcome,
  is_dry_run boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calls_org_lead_idx on public.calls (organization_id, lead_id);
create index calls_org_agent_idx on public.calls (organization_id, agent_id);
create index calls_call_sid_idx on public.calls (call_sid) where call_sid is not null;

-- ---------------------------------------------------------------------------
-- messages (WhatsApp / SMS / email sends)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  channel public.message_channel not null,
  direction public.message_direction not null default 'outbound',
  status public.message_status not null default 'queued',
  to_address text not null,
  subject text,
  body text not null,
  template_key text,
  provider_message_id text,
  error_message text,
  is_dry_run boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_org_lead_idx on public.messages (organization_id, lead_id);

-- ---------------------------------------------------------------------------
-- lead_property_shares
-- ---------------------------------------------------------------------------
create table public.lead_property_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  shared_by uuid references public.profiles (id) on delete set null,
  channel public.share_channel not null,
  message_id uuid references public.messages (id) on delete set null,
  share_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_property_shares_org_lead_idx on public.lead_property_shares (organization_id, lead_id);
create index lead_property_shares_property_idx on public.lead_property_shares (property_id);

-- ---------------------------------------------------------------------------
-- followups
-- ---------------------------------------------------------------------------
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz not null,
  status public.followup_status not null default 'pending',
  note text,
  template_key text,
  snooze_count integer not null default 0,
  reminder_sent boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index followups_org_due_idx on public.followups (organization_id, status, due_at);
create index followups_org_agent_idx on public.followups (organization_id, agent_id);
create index followups_lead_idx on public.followups (lead_id);

-- ---------------------------------------------------------------------------
-- attendance (GPS check-in/out; one row per user per day)
-- ---------------------------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null default current_date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  selfie_path text,
  status public.attendance_status not null default 'present',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, work_date)
);

create index attendance_org_date_idx on public.attendance (organization_id, work_date desc);

-- ---------------------------------------------------------------------------
-- social_posts
-- ---------------------------------------------------------------------------
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  caption text,
  post_type public.social_post_type not null default 'image',
  status public.social_status not null default 'idea',
  scheduled_for timestamptz,
  published_at timestamptz,
  platforms text[] not null default '{}',
  media_paths text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  ai_caption_prompt text,
  dispatched_at timestamptz,
  dispatch_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_posts_org_status_idx on public.social_posts (organization_id, status);
create index social_posts_org_scheduled_idx on public.social_posts (organization_id, scheduled_for);

-- ---------------------------------------------------------------------------
-- tasks (e.g. "Call Pending" fallback tasks from the bridge)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  due_at timestamptz,
  status public.task_status not null default 'open',
  priority public.task_priority not null default 'medium',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_org_assignee_idx on public.tasks (organization_id, assigned_to, status);

-- ---------------------------------------------------------------------------
-- integration_settings (per-org secrets — encrypted app-side, server-only)
-- RLS: default-deny with NO authenticated policies; accessed exclusively via
-- the service-role client in server code (Rules.md §3).
-- ---------------------------------------------------------------------------
create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  twilio_account_sid text,
  twilio_auth_token_encrypted text,
  twilio_phone_number text,
  whatsapp_provider text not null default 'twilio',
  whatsapp_sender text,
  resend_api_key_encrypted text,
  smtp_url_encrypted text,
  email_from text,
  ai_api_key_encrypted text,
  ai_base_url text,
  social_dispatch_webhook_url text,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  default_assignment_mode public.assignment_mode not null default 'round_robin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, read_at) where read_at is null;
create index notifications_org_user_idx on public.notifications (organization_id, user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'team_members', 'lead_sources', 'leads',
    'properties', 'property_images', 'property_documents', 'activities',
    'calls', 'messages', 'lead_property_shares', 'followups', 'attendance',
    'social_posts', 'tasks', 'integration_settings', 'notifications'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-provision a profile when an auth user is created with org metadata
-- (used by the admin invite flow; seed creates profiles explicitly).
-- app_metadata is set server-side only — clients cannot forge it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  member_role public.user_role;
begin
  org_id := nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid;
  member_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role,
    'sales_agent'
  );

  if org_id is not null then
    insert into public.profiles (id, organization_id, full_name, email, phone, role)
    values (
      new.id,
      org_id,
      coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      member_role
    )
    on conflict (id) do nothing;

    update public.team_members
      set status = 'active', profile_id = new.id
      where organization_id = org_id
        and lower(email) = lower(new.email)
        and status = 'invited';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

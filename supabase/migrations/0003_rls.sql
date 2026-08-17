-- EstateFlow CRM — 0003: Row Level Security
-- Default-deny on EVERY table (Rules.md §3). Enabling RLS with no policy
-- denies all access; each policy below is an explicit, per-role grant.
-- Tenant scope comes from the JWT / profiles row — never from client input.

-- ---------------------------------------------------------------------------
-- Helper functions (security definer → bypass RLS internally, no recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid,
    (select organization_id from public.profiles where id = auth.uid())
  );
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')::public.user_role,
    (select role from public.profiles where id = auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'sales_manager');
$$;

-- True when the current user is the assigned agent of the given lead.
-- security definer so agent policies on child tables (activities, calls…)
-- don't recursively evaluate the leads policies.
create or replace function public.is_assigned_agent(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id
      and l.organization_id = public.current_org_id()
      and l.assigned_agent_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (default-deny)
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.property_documents enable row level security;
alter table public.activities enable row level security;
alter table public.calls enable row level security;
alter table public.messages enable row level security;
alter table public.lead_property_shares enable row level security;
alter table public.followups enable row level security;
alter table public.attendance enable row level security;
alter table public.social_posts enable row level security;
alter table public.tasks enable row level security;
alter table public.integration_settings enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------------------------
-- organizations — members read their own org; only admin updates it.
-- Inserts happen via service role (signup/onboarding flow) only.
-- ---------------------------------------------------------------------------
create policy org_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

create policy org_update_admin on public.organizations
  for update to authenticated
  using (id = public.current_org_id() and public.is_admin())
  with check (id = public.current_org_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles — org members see each other (needed for assignment pickers,
-- activity feeds). Users update their own profile but cannot change their
-- role or org; admin updates anyone in-org.
-- ---------------------------------------------------------------------------
create policy profiles_select_org on public.profiles
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and organization_id = public.current_org_id()
    and role = public.current_user_role()
  );

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_admin())
  with check (organization_id = public.current_org_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- team_members — admin manages; managers can view the roster.
-- ---------------------------------------------------------------------------
create policy team_members_select on public.team_members
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy team_members_insert_admin on public.team_members
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_admin());

create policy team_members_update_admin on public.team_members
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_admin())
  with check (organization_id = public.current_org_id() and public.is_admin());

create policy team_members_delete_admin on public.team_members
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- lead_sources — org read; admin/manager write.
-- ---------------------------------------------------------------------------
create policy lead_sources_select on public.lead_sources
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy lead_sources_write on public.lead_sources
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy lead_sources_update on public.lead_sources
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy lead_sources_delete on public.lead_sources
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- leads — role matrix (PRD §2):
--   admin / sales_manager: all org leads, full write.
--   sales_agent: sees + updates only leads assigned to them; can create
--     (self-assigned or unassigned); cannot reassign away from themselves.
--   field_executive / social_media_manager: no direct lead access.
-- ---------------------------------------------------------------------------
create policy leads_select_managers on public.leads
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy leads_select_agent on public.leads
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'sales_agent'
    and assigned_agent_id = auth.uid()
  );

create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_manager_or_admin()
      or (
        public.current_user_role() = 'sales_agent'
        and (assigned_agent_id = auth.uid() or assigned_agent_id is null)
      )
    )
  );

create policy leads_update_managers on public.leads
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy leads_update_agent on public.leads
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.current_user_role() = 'sales_agent'
    and assigned_agent_id = auth.uid()
  )
  with check (
    organization_id = public.current_org_id()
    and assigned_agent_id = auth.uid()
  );

create policy leads_delete_managers on public.leads
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- properties — org-wide read (agents need inventory to share);
-- admin/manager write.
-- ---------------------------------------------------------------------------
create policy properties_select on public.properties
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy properties_insert on public.properties
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy properties_update on public.properties
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy properties_delete on public.properties
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- property_images / property_documents mirror properties
create policy property_images_select on public.property_images
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy property_images_write on public.property_images
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy property_images_update on public.property_images
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy property_images_delete on public.property_images
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy property_documents_select on public.property_documents
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy property_documents_write on public.property_documents
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy property_documents_update on public.property_documents
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

create policy property_documents_delete on public.property_documents
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- activities — immutable timeline. Read: managers all; agents for their
-- leads or their own actions. Insert: org members for themselves.
-- No update/delete policies → immutable for all non-service roles.
-- ---------------------------------------------------------------------------
create policy activities_select on public.activities
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_manager_or_admin()
      or actor_id = auth.uid()
      or (lead_id is not null and public.is_assigned_agent(lead_id))
    )
  );

create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (actor_id = auth.uid() or actor_id is null)
  );

-- ---------------------------------------------------------------------------
-- calls — managers all; agents their own.
-- ---------------------------------------------------------------------------
create policy calls_select on public.calls
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid())
  );

create policy calls_insert on public.calls
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid())
  );

create policy calls_update on public.calls
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid())
  )
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- messages — managers all; agents their own sends + messages for their leads.
-- ---------------------------------------------------------------------------
create policy messages_select on public.messages
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_manager_or_admin()
      or sender_id = auth.uid()
      or (lead_id is not null and public.is_assigned_agent(lead_id))
    )
  );

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or sender_id = auth.uid())
  );

create policy messages_update on public.messages
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or sender_id = auth.uid())
  )
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- lead_property_shares — managers all; agents their own / their leads'.
-- ---------------------------------------------------------------------------
create policy shares_select on public.lead_property_shares
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_manager_or_admin()
      or shared_by = auth.uid()
      or public.is_assigned_agent(lead_id)
    )
  );

create policy shares_insert on public.lead_property_shares
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or shared_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- followups — managers all; agents their own.
-- ---------------------------------------------------------------------------
create policy followups_select on public.followups
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid() or public.is_assigned_agent(lead_id))
  );

create policy followups_insert on public.followups
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid())
  );

create policy followups_update on public.followups
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or agent_id = auth.uid())
  )
  with check (organization_id = public.current_org_id());

create policy followups_delete on public.followups
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- attendance — everyone manages their own; admin/manager see the org.
-- ---------------------------------------------------------------------------
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or user_id = auth.uid())
  );

create policy attendance_insert_own on public.attendance
  for insert to authenticated
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy attendance_update on public.attendance
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or user_id = auth.uid())
  )
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- social_posts — admin + social_media_manager write; sales_manager read.
-- ---------------------------------------------------------------------------
create policy social_posts_select on public.social_posts
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'sales_manager', 'social_media_manager')
  );

create policy social_posts_insert on public.social_posts
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'social_media_manager')
  );

create policy social_posts_update on public.social_posts
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'social_media_manager')
  )
  with check (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'social_media_manager')
  );

create policy social_posts_delete on public.social_posts
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.current_user_role() in ('admin', 'social_media_manager')
  );

-- ---------------------------------------------------------------------------
-- tasks — managers all; others see/update tasks assigned to or created by them.
-- ---------------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or assigned_to = auth.uid() or created_by = auth.uid())
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or created_by = auth.uid())
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_manager_or_admin() or assigned_to = auth.uid())
  )
  with check (organization_id = public.current_org_id());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- integration_settings — NO authenticated policies on purpose.
-- Secrets are server-only (Rules.md §3): all reads/writes go through the
-- service-role client in server code after an app-layer admin check.
-- Default-deny RLS guarantees the browser can never read this table.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- notifications — users see and manage only their own; inserts are
-- service-role only (system-generated).
-- ---------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid())
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid());

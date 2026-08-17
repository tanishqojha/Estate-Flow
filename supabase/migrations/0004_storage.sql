-- EstateFlow CRM — 0004: storage buckets + policies
-- All buckets are PRIVATE (Rules.md §3): customer media is served via signed
-- URLs only. Object paths are org-scoped: <organization_id>/...
--   property-media:      <org_id>/properties/<property_id>/<file>
--   attendance-selfies:  <org_id>/<user_id>/<date>-<file>
--   avatars:             <org_id>/<user_id>/<file>

insert into storage.buckets (id, name, public)
values
  ('property-media', 'property-media', false),
  ('attendance-selfies', 'attendance-selfies', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- First path segment must be the caller's org id.
create or replace function public.storage_path_in_org(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (storage.foldername(object_name))[1] = public.current_org_id()::text;
$$;

-- property-media: org members read (to build signed URLs); admin/manager write.
create policy property_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'property-media' and public.storage_path_in_org(name));

create policy property_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'property-media'
    and public.storage_path_in_org(name)
    and public.is_manager_or_admin()
  );

create policy property_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'property-media'
    and public.storage_path_in_org(name)
    and public.is_manager_or_admin()
  );

create policy property_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'property-media'
    and public.storage_path_in_org(name)
    and public.is_manager_or_admin()
  );

-- attendance-selfies: users write their own (<org>/<user_id>/...);
-- admin/manager can read the org's.
create policy attendance_selfies_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attendance-selfies'
    and public.storage_path_in_org(name)
    and (
      public.is_manager_or_admin()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

create policy attendance_selfies_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attendance-selfies'
    and public.storage_path_in_org(name)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- avatars: org members read; users write their own.
create policy avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.storage_path_in_org(name));

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.storage_path_in_org(name)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.storage_path_in_org(name)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.storage_path_in_org(name)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

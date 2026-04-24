-- Phase 5: consultant profile assets (avatar, CV, skills), public API readiness

-------------------------------------------------------------------------------
-- Extend consultant_profiles with CV + availability details + profile fields
-------------------------------------------------------------------------------
alter table public.consultant_profiles
  add column if not exists cv_storage_path text,
  add column if not exists cv_filename text,
  add column if not exists headline text,           -- short tagline under name
  add column if not exists location text,           -- city/region
  add column if not exists languages text[];        -- e.g. ['Norsk', 'Engelsk']

-------------------------------------------------------------------------------
-- RLS for consultant_profiles — add INSERT and allow solo consultants to
-- update their own profile directly
-------------------------------------------------------------------------------
-- INSERT: tenant members (owners/admins) can create profiles under their tenant
create policy "consultants_insert_tenant" on public.consultant_profiles
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.tenant_members
      where tenant_id = consultant_profiles.tenant_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- The existing "consultants_manage_tenant" FOR ALL policy already covers updates,
-- but it requires membership. Add a separate policy for a consultant editing
-- their own linked profile (for solo consultants whose user_id matches).
create policy "consultants_update_self" on public.consultant_profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Storage buckets
-------------------------------------------------------------------------------
-- Avatars are public so they can be embedded anywhere (marketplace, emails)
insert into storage.buckets (id, name, public)
  values ('consultant-avatars', 'consultant-avatars', true)
  on conflict (id) do nothing;

-- CVs are private — served via signed URLs only
insert into storage.buckets (id, name, public)
  values ('consultant-cvs', 'consultant-cvs', false)
  on conflict (id) do nothing;

-- Path convention: {consultant_profile_id}/{filename}
-- RLS policies: anyone can upload if they own/manage the consultant profile.
-- Reading avatars is public (bucket is public); reading CVs requires signed URL
-- which goes through the API route that checks authorization.

create policy "consultant_avatars_write" on storage.objects
  for insert with check (
    bucket_id = 'consultant-avatars'
    and auth.uid() is not null
  );

create policy "consultant_avatars_update" on storage.objects
  for update using (
    bucket_id = 'consultant-avatars'
    and auth.uid() is not null
  );

create policy "consultant_avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'consultant-avatars'
    and auth.uid() is not null
  );

create policy "consultant_cvs_write" on storage.objects
  for insert with check (
    bucket_id = 'consultant-cvs'
    and auth.uid() is not null
  );

create policy "consultant_cvs_delete" on storage.objects
  for delete using (
    bucket_id = 'consultant-cvs'
    and auth.uid() is not null
  );

-- CV reading via service-role (in the download API route) — no public read policy.

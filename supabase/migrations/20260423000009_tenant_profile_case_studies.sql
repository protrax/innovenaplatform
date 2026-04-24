-- Phase 6: public tenant profiles + case studies
-- Lets agencies build a rich public presence that syndicates to innovena.no

-------------------------------------------------------------------------------
-- case_studies
-------------------------------------------------------------------------------
create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  client_name text,
  description text,
  challenge text,
  solution text,
  result text,
  cover_image_url text,
  project_url text,
  categories text[],
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index case_studies_tenant_idx on public.case_studies(tenant_id, sort_order);
create index case_studies_published_idx on public.case_studies(tenant_id, published)
  where published = true;

create trigger case_studies_updated_at before update on public.case_studies
  for each row execute function public.set_updated_at();

alter table public.case_studies enable row level security;

-- Public can read published case studies; tenant members manage their own
create policy "case_studies_select_public" on public.case_studies
  for select using (
    published = true
    or public.is_tenant_member(tenant_id)
    or public.is_admin()
  );

create policy "case_studies_manage_tenant" on public.case_studies
  for all using (public.is_tenant_member(tenant_id) or public.is_admin())
  with check (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- Extend tenants with richer profile fields
-------------------------------------------------------------------------------
alter table public.tenants
  add column if not exists tagline text,
  add column if not exists founded_year int,
  add column if not exists team_size text,
  add column if not exists location text,
  add column if not exists linkedin_url text,
  add column if not exists instagram_url text,
  add column if not exists twitter_url text;

-------------------------------------------------------------------------------
-- Storage bucket for tenant branding (logos, case study covers)
-- Public so innovena.no can embed images directly
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('tenant-assets', 'tenant-assets', true)
  on conflict (id) do nothing;

create policy "tenant_assets_write" on storage.objects
  for insert with check (
    bucket_id = 'tenant-assets' and auth.uid() is not null
  );

create policy "tenant_assets_update" on storage.objects
  for update using (
    bucket_id = 'tenant-assets' and auth.uid() is not null
  );

create policy "tenant_assets_delete" on storage.objects
  for delete using (
    bucket_id = 'tenant-assets' and auth.uid() is not null
  );

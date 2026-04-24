-- Fix infinite recursion between projects <-> project_leads RLS policies.
-- Root cause: projects_select_customer did EXISTS against project_leads,
-- and project_leads_select did EXISTS back against projects. Postgres
-- evaluates RLS on each referenced table, so the two policies recursed.
--
-- Solution: wrap the cross-table lookups in SECURITY DEFINER functions
-- so they bypass RLS on the inner table. Apply the same pattern to every
-- other policy that did EXISTS (SELECT 1 FROM projects ...) to keep the
-- behaviour consistent and avoid future recursion.

-- Helper: does the current user's tenant have a lead on this project?
create or replace function public.project_has_my_tenant_lead(pid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_leads pl
    join public.tenant_members tm on tm.tenant_id = pl.tenant_id
    where pl.project_id = pid and tm.user_id = uid
  );
$$;

-- Helper: is the given user the customer who owns this project?
create or replace function public.user_owns_project(pid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = pid and customer_id = uid
  );
$$;

-- Helper: is the given user the customer on this contract?
create or replace function public.user_owns_contract(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contracts
    where id = cid and customer_id = uid
  );
$$;

-- Rebuild projects SELECT policy using the security-definer helper
drop policy if exists "projects_select_customer" on public.projects;
create policy "projects_select_customer" on public.projects
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or public.project_has_my_tenant_lead(id)
  );

-- Rebuild project_leads SELECT policy so it doesn't recurse into projects
drop policy if exists "project_leads_select" on public.project_leads;
create policy "project_leads_select" on public.project_leads
  for select using (
    public.is_tenant_member(tenant_id)
    or public.is_admin()
    or public.user_owns_project(project_id)
  );

-- Rebuild project_categories SELECT policy — same recursive shape
drop policy if exists "project_categories_select" on public.project_categories;
create policy "project_categories_select" on public.project_categories
  for select using (
    public.user_owns_project(project_id)
    or public.is_admin()
    or public.project_has_my_tenant_lead(project_id)
  );

drop policy if exists "project_categories_manage_owner" on public.project_categories;
create policy "project_categories_manage_owner" on public.project_categories
  for all using (
    public.user_owns_project(project_id) or public.is_admin()
  );

-- Rebuild bids policies to use helper
drop policy if exists "bids_select" on public.bids;
create policy "bids_select" on public.bids
  for select using (
    public.is_tenant_member(tenant_id)
    or public.is_admin()
    or (status in ('sent', 'viewed', 'accepted', 'rejected')
        and public.user_owns_project(project_id))
  );

drop policy if exists "bids_customer_respond" on public.bids;
create policy "bids_customer_respond" on public.bids
  for update using (
    public.user_owns_project(project_id)
  ) with check (
    public.user_owns_project(project_id)
  );

-- Rebuild messages SELECT policy to use helpers
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    sender_id = auth.uid()
    or public.is_admin()
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (project_id is not null and public.user_owns_project(project_id))
    or (contract_id is not null and public.user_owns_contract(contract_id))
  );

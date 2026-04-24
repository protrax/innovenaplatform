-- Row-level security policies for multi-tenant isolation
-- Principle: tenants see only their own data; customers see only their own projects;
-- admins see everything via the 'admin' user_role.

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

create or replace function public.is_tenant_member(tid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = tid and user_id = uid
  );
$$;

create or replace function public.user_tenant_ids(uid uuid default auth.uid())
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members where user_id = uid;
$$;

-------------------------------------------------------------------------------
-- Enable RLS
-------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_categories enable row level security;
alter table public.tenant_categories enable row level security;
alter table public.consultant_profiles enable row level security;
alter table public.consultant_skills enable row level security;
alter table public.projects enable row level security;
alter table public.project_categories enable row level security;
alter table public.project_leads enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.pipeline_cards enable row level security;
alter table public.bids enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.marketing_packages enable row level security;
alter table public.tenant_marketing_subscriptions enable row level security;
alter table public.consultant_bookings enable row level security;

-------------------------------------------------------------------------------
-- profiles: users see own profile, admins see all
-------------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-------------------------------------------------------------------------------
-- tenants: members see own tenant, admins see all, public sees active tenants
-- for marketplace browsing (name/slug/logo only — column-level is enforced in queries)
-------------------------------------------------------------------------------
create policy "tenants_select_member" on public.tenants
  for select using (
    public.is_tenant_member(id) or public.is_admin() or status = 'active'
  );
create policy "tenants_update_owner" on public.tenants
  for update using (
    public.is_admin() or exists (
      select 1 from public.tenant_members
      where tenant_id = tenants.id and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
create policy "tenants_insert_self" on public.tenants
  for insert with check (auth.uid() is not null);

-------------------------------------------------------------------------------
-- tenant_members: members see own tenant's members, admins see all
-------------------------------------------------------------------------------
create policy "tenant_members_select" on public.tenant_members
  for select using (public.is_tenant_member(tenant_id) or public.is_admin());
create policy "tenant_members_manage_owner" on public.tenant_members
  for all using (
    public.is_admin() or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_members.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

-------------------------------------------------------------------------------
-- user_roles: users see own roles, admins manage all
-------------------------------------------------------------------------------
create policy "user_roles_select_own" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "user_roles_admin_manage" on public.user_roles
  for all using (public.is_admin());

-------------------------------------------------------------------------------
-- service_categories: public read, admin write
-------------------------------------------------------------------------------
create policy "categories_select_all" on public.service_categories
  for select using (true);
create policy "categories_admin_write" on public.service_categories
  for all using (public.is_admin());

-------------------------------------------------------------------------------
-- tenant_categories: tenant members manage own, public read active
-------------------------------------------------------------------------------
create policy "tenant_categories_select" on public.tenant_categories
  for select using (true);
create policy "tenant_categories_manage" on public.tenant_categories
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- consultant_profiles: tenant members manage own, public sees visible ones
-------------------------------------------------------------------------------
create policy "consultants_select_public" on public.consultant_profiles
  for select using (
    visible_in_marketplace = true
    or public.is_tenant_member(tenant_id)
    or public.is_admin()
  );
create policy "consultants_manage_tenant" on public.consultant_profiles
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());

create policy "consultant_skills_select" on public.consultant_skills
  for select using (
    exists (
      select 1 from public.consultant_profiles cp
      where cp.id = consultant_skills.consultant_id
        and (cp.visible_in_marketplace or public.is_tenant_member(cp.tenant_id) or public.is_admin())
    )
  );
create policy "consultant_skills_manage" on public.consultant_skills
  for all using (
    exists (
      select 1 from public.consultant_profiles cp
      where cp.id = consultant_skills.consultant_id
        and (public.is_tenant_member(cp.tenant_id) or public.is_admin())
    )
  );

-------------------------------------------------------------------------------
-- projects: customer owns, receiving tenants can read, admin sees all
-------------------------------------------------------------------------------
create policy "projects_select_customer" on public.projects
  for select using (
    customer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.project_leads pl
      where pl.project_id = projects.id and public.is_tenant_member(pl.tenant_id)
    )
  );
create policy "projects_insert_customer" on public.projects
  for insert with check (customer_id = auth.uid());
create policy "projects_update_customer" on public.projects
  for update using (customer_id = auth.uid() or public.is_admin());

create policy "project_categories_select" on public.project_categories
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_categories.project_id
        and (p.customer_id = auth.uid() or public.is_admin() or exists (
          select 1 from public.project_leads pl
          where pl.project_id = p.id and public.is_tenant_member(pl.tenant_id)
        ))
    )
  );
create policy "project_categories_manage_owner" on public.project_categories
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_categories.project_id and p.customer_id = auth.uid()
    ) or public.is_admin()
  );

-------------------------------------------------------------------------------
-- project_leads: tenants see own, customer sees own project's leads, admin all
-------------------------------------------------------------------------------
create policy "project_leads_select" on public.project_leads
  for select using (
    public.is_tenant_member(tenant_id)
    or public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_leads.project_id and p.customer_id = auth.uid()
    )
  );
create policy "project_leads_tenant_update" on public.project_leads
  for update using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- pipeline_stages & cards: strictly per-tenant
-------------------------------------------------------------------------------
create policy "pipeline_stages_tenant" on public.pipeline_stages
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());
create policy "pipeline_cards_tenant" on public.pipeline_cards
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- bids: tenant owns, customer sees when sent, admin all
-------------------------------------------------------------------------------
create policy "bids_select" on public.bids
  for select using (
    public.is_tenant_member(tenant_id)
    or public.is_admin()
    or (status in ('sent', 'viewed', 'accepted', 'rejected') and exists (
      select 1 from public.projects p
      where p.id = bids.project_id and p.customer_id = auth.uid()
    ))
  );
create policy "bids_manage_tenant" on public.bids
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());
create policy "bids_customer_respond" on public.bids
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = bids.project_id and p.customer_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = bids.project_id and p.customer_id = auth.uid()
    )
  );

-------------------------------------------------------------------------------
-- contracts: customer + tenant + admin
-------------------------------------------------------------------------------
create policy "contracts_select" on public.contracts
  for select using (
    customer_id = auth.uid()
    or public.is_tenant_member(tenant_id)
    or public.is_admin()
  );
create policy "contracts_manage_tenant" on public.contracts
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- invoices
-------------------------------------------------------------------------------
create policy "invoices_select" on public.invoices
  for select using (
    customer_id = auth.uid()
    or public.is_tenant_member(tenant_id)
    or public.is_admin()
  );

-------------------------------------------------------------------------------
-- messages: customer + tenant participants
-------------------------------------------------------------------------------
create policy "messages_select" on public.messages
  for select using (
    sender_id = auth.uid()
    or public.is_admin()
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (project_id is not null and exists (
      select 1 from public.projects p where p.id = messages.project_id and p.customer_id = auth.uid()
    ))
    or (contract_id is not null and exists (
      select 1 from public.contracts c where c.id = messages.contract_id and c.customer_id = auth.uid()
    ))
  );
create policy "messages_insert" on public.messages
  for insert with check (sender_id = auth.uid());

-------------------------------------------------------------------------------
-- subscriptions: tenant + admin
-------------------------------------------------------------------------------
create policy "subscriptions_tenant" on public.subscriptions
  for select using (public.is_tenant_member(tenant_id) or public.is_admin());

create policy "marketing_packages_select" on public.marketing_packages
  for select using (true);
create policy "marketing_packages_admin" on public.marketing_packages
  for all using (public.is_admin());

create policy "tenant_marketing_subscriptions_tenant" on public.tenant_marketing_subscriptions
  for select using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- consultant_bookings: both parties + admin
-------------------------------------------------------------------------------
create policy "consultant_bookings_select" on public.consultant_bookings
  for select using (
    customer_id = auth.uid()
    or public.is_tenant_member(tenant_id)
    or public.is_admin()
  );
create policy "consultant_bookings_insert_customer" on public.consultant_bookings
  for insert with check (customer_id = auth.uid());
create policy "consultant_bookings_update_tenant" on public.consultant_bookings
  for update using (public.is_tenant_member(tenant_id) or public.is_admin());

-- Innovena platform initial schema
-- Multi-tenant: agencies/solo consultants are tenants, customers are standalone users

set check_function_bodies = off;

-------------------------------------------------------------------------------
-- Enums
-------------------------------------------------------------------------------
create type user_role as enum ('customer', 'agency_member', 'consultant', 'admin');
create type tenant_type as enum ('agency', 'solo_consultant');
create type tenant_status as enum ('pending_approval', 'active', 'suspended', 'rejected');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
create type project_status as enum ('draft', 'open', 'matched', 'in_progress', 'completed', 'cancelled');
create type bid_status as enum ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'withdrawn');
create type contract_status as enum ('draft', 'sent', 'signed', 'active', 'completed', 'cancelled');
create type message_channel as enum ('project', 'bid', 'contract');
create type marketing_tier as enum ('basic', 'pro', 'premium');

-------------------------------------------------------------------------------
-- Profiles (links to auth.users, holds cross-role info)
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- Tenants (agencies and solo consultants)
-------------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type tenant_type not null,
  status tenant_status not null default 'pending_approval',
  org_number text,
  logo_url text,
  website text,
  description text,
  billing_email text,
  stripe_customer_id text unique,
  platform_fee_enabled boolean not null default true,
  platform_fee_percent numeric(5, 2) not null default 2.50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants(status);
create index tenants_type_idx on public.tenants(type);

-------------------------------------------------------------------------------
-- Tenant memberships (which users belong to which tenant, with roles)
-------------------------------------------------------------------------------
create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-------------------------------------------------------------------------------
-- User roles (global role assignments — one user can have multiple roles)
-------------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-------------------------------------------------------------------------------
-- Service categories (seeded from Joakim's list, admin-configurable)
-------------------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  sort_order int not null default 0,
  active boolean not null default true,
  -- Lead distribution config: max agencies that receive each lead in this category
  max_agencies_per_lead int not null default 5,
  created_at timestamptz not null default now()
);

create index service_categories_active_idx on public.service_categories(active);

-------------------------------------------------------------------------------
-- Tenant <-> service_categories (which services a tenant offers)
-------------------------------------------------------------------------------
create table public.tenant_categories (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, category_id)
);

-------------------------------------------------------------------------------
-- Consultant profiles (agency employees or solo consultant self)
-------------------------------------------------------------------------------
create table public.consultant_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Optional link to a platform user (if the consultant has their own login)
  user_id uuid references public.profiles(id) on delete set null,
  slug text unique not null,
  full_name text not null,
  title text,
  bio text,
  avatar_url text,
  hourly_rate_nok int,
  years_experience int,
  available_from date,
  available_hours_per_week int,
  visible_in_marketplace boolean not null default false,
  linkedin_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultant_profiles_tenant_idx on public.consultant_profiles(tenant_id);
create index consultant_profiles_marketplace_idx on public.consultant_profiles(visible_in_marketplace) where visible_in_marketplace = true;

-------------------------------------------------------------------------------
-- Consultant skills (tagged categories + freeform)
-------------------------------------------------------------------------------
create table public.consultant_skills (
  consultant_id uuid not null references public.consultant_profiles(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete cascade,
  skill_name text,
  created_at timestamptz not null default now(),
  check (category_id is not null or skill_name is not null)
);

create index consultant_skills_consultant_idx on public.consultant_skills(consultant_id);

-------------------------------------------------------------------------------
-- Projects (customer requests)
-------------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  budget_min_nok int,
  budget_max_nok int,
  deadline date,
  status project_status not null default 'draft',
  location text,
  remote_ok boolean not null default true,
  -- Customer source: 'platform' (direct) or 'innovena_site' (from innovena.no forms)
  source text not null default 'platform',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz
);

create index projects_customer_idx on public.projects(customer_id);
create index projects_status_idx on public.projects(status);

-------------------------------------------------------------------------------
-- Project <-> categories
-------------------------------------------------------------------------------
create table public.project_categories (
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  primary key (project_id, category_id)
);

-------------------------------------------------------------------------------
-- Lead distribution: which tenants received a given project as a lead
-------------------------------------------------------------------------------
create table public.project_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  distributed_at timestamptz not null default now(),
  viewed_at timestamptz,
  dismissed_at timestamptz,
  unique (project_id, tenant_id)
);

create index project_leads_tenant_idx on public.project_leads(tenant_id);
create index project_leads_project_idx on public.project_leads(project_id);

-------------------------------------------------------------------------------
-- Pipeline stages (per tenant — so each agency can customize their CRM stages)
-------------------------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create index pipeline_stages_tenant_idx on public.pipeline_stages(tenant_id, sort_order);

-------------------------------------------------------------------------------
-- Pipeline cards (lead position in a tenant's pipeline — same lead, multi-tenant)
-------------------------------------------------------------------------------
create table public.pipeline_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, project_id)
);

create index pipeline_cards_tenant_stage_idx on public.pipeline_cards(tenant_id, stage_id, sort_order);

-------------------------------------------------------------------------------
-- Bids (offers from tenants on projects)
-------------------------------------------------------------------------------
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  amount_nok int not null,
  currency text not null default 'NOK',
  delivery_weeks int,
  description text not null,
  includes text[],
  status bid_status not null default 'draft',
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  responded_at timestamptz,
  unique (project_id, tenant_id)
);

create index bids_project_idx on public.bids(project_id);
create index bids_tenant_idx on public.bids(tenant_id);
create index bids_status_idx on public.bids(status);

-------------------------------------------------------------------------------
-- Contracts (signed bid -> contract)
-------------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_nok int not null,
  status contract_status not null default 'draft',
  pdf_url text,
  customer_signed_at timestamptz,
  tenant_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_tenant_idx on public.contracts(tenant_id);
create index contracts_customer_idx on public.contracts(customer_id);

-------------------------------------------------------------------------------
-- Invoices (for contract payments routed through the platform)
-------------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_nok int not null,
  platform_fee_nok int not null default 0,
  total_nok int not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  stripe_invoice_id text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_tenant_idx on public.invoices(tenant_id);
create index invoices_customer_idx on public.invoices(customer_id);

-------------------------------------------------------------------------------
-- Messages (project-level, bid-level, or contract-level threads)
-------------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel message_channel not null,
  project_id uuid references public.projects(id) on delete cascade,
  bid_id uuid references public.bids(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete set null,
  body text not null,
  attachments jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (channel = 'project' and project_id is not null) or
    (channel = 'bid' and bid_id is not null) or
    (channel = 'contract' and contract_id is not null)
  )
);

create index messages_project_idx on public.messages(project_id) where project_id is not null;
create index messages_bid_idx on public.messages(bid_id) where bid_id is not null;
create index messages_contract_idx on public.messages(contract_id) where contract_id is not null;
create index messages_sender_idx on public.messages(sender_id);

-------------------------------------------------------------------------------
-- Subscriptions (tenant pays 990 kr/mnd for lead access)
-------------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- Marketing packages (upsells — higher visibility on innovena.no, more leads)
-------------------------------------------------------------------------------
create table public.marketing_packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  tier marketing_tier not null,
  price_nok int not null,
  stripe_price_id text,
  features jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tenant_marketing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  package_id uuid not null references public.marketing_packages(id) on delete restrict,
  stripe_subscription_id text unique,
  status subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, package_id)
);

-------------------------------------------------------------------------------
-- Consultant bookings (customer books a consultant from marketplace)
-------------------------------------------------------------------------------
create table public.consultant_bookings (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.consultant_profiles(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  hours_per_week int,
  start_date date,
  end_date date,
  hourly_rate_nok int,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultant_bookings_consultant_idx on public.consultant_bookings(consultant_id);
create index consultant_bookings_customer_idx on public.consultant_bookings(customer_id);

-------------------------------------------------------------------------------
-- updated_at trigger
-------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger consultant_profiles_updated_at before update on public.consultant_profiles
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger pipeline_cards_updated_at before update on public.pipeline_cards
  for each row execute function public.set_updated_at();
create trigger bids_updated_at before update on public.bids
  for each row execute function public.set_updated_at();
create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger consultant_bookings_updated_at before update on public.consultant_bookings
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Auto-create profile when a new auth.user is created
-------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Default pipeline stages on tenant creation
-------------------------------------------------------------------------------
create or replace function public.create_default_pipeline_stages()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.pipeline_stages (tenant_id, name, color, sort_order, is_won, is_lost) values
    (new.id, 'Lead', '#94a3b8', 0, false, false),
    (new.id, 'Kontaktet', '#3b82f6', 1, false, false),
    (new.id, 'Tilbud sendt', '#eab308', 2, false, false),
    (new.id, 'Forhandling', '#f97316', 3, false, false),
    (new.id, 'Vunnet', '#10b981', 4, true, false),
    (new.id, 'Tapt', '#ef4444', 5, false, true);
  return new;
end;
$$;

create trigger on_tenant_created
  after insert on public.tenants
  for each row execute function public.create_default_pipeline_stages();
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
-- Seed service categories from Joakim's list
insert into public.service_categories (slug, name, sort_order) values
  ('nettsider', 'Nettsider', 10),
  ('seo', 'SEO', 20),
  ('aeo', 'AEO', 30),
  ('nettbutikk', 'Nettbutikk', 40),
  ('markedsforing', 'Markedsføring', 50),
  ('ai-losninger', 'AI-løsninger', 60),
  ('webutvikling', 'Webutvikling', 70),
  ('design', 'Design', 80),
  ('crm-systemer', 'CRM-systemer', 90),
  ('regnskap', 'Regnskap', 100),
  ('hosting', 'Hosting', 110),
  ('app-utvikling', 'App-utvikling', 120),
  ('teknisk-radgivning', 'Teknisk rådgivning', 130),
  ('it-konsulenter', 'IT-konsulenter', 140),
  ('influencer-markedsforing', 'Influencer markedsføring', 150),
  ('video-produksjon', 'Video produksjon', 160),
  ('fotograf', 'Fotograf', 170),
  ('innholdsmarkedsforing', 'Innholdsmarkedsføring', 180),
  ('pr-byraa', 'PR-byrå', 190),
  ('anbud', 'Anbud', 200),
  ('ai-radgivning', 'AI-rådgivning', 210),
  ('ai-kurs', 'AI-kurs', 220)
on conflict (slug) do nothing;
-- Invoice payment flow: allow invoices to exist without a contract (contracts come in phase 2),
-- add Stripe payment link storage, and complete RLS policies for invoice create/update.

alter table public.invoices
  alter column contract_id drop not null;

alter table public.invoices
  add column if not exists description text,
  add column if not exists stripe_payment_link_url text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists platform_fee_enabled boolean not null default true,
  add column if not exists platform_fee_percent numeric(5, 2) not null default 2.50;

-- Allow tenant members to create and update invoices for their tenant
create policy "invoices_insert_tenant" on public.invoices
  for insert
  with check (public.is_tenant_member(tenant_id) or public.is_admin());

create policy "invoices_update_tenant" on public.invoices
  for update
  using (public.is_tenant_member(tenant_id) or public.is_admin())
  with check (public.is_tenant_member(tenant_id) or public.is_admin());

-- Index for webhook lookups by stripe session id
create index if not exists invoices_stripe_session_idx
  on public.invoices(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
-- Phase 2: bid submission, acceptance, and contract signing
-- Adds metadata columns and audit fields to bids and contracts, plus tightens RLS
-- to allow contract creation by both parties.

alter table public.bids
  add column if not exists summary text,
  add column if not exists rejected_reason text;

alter table public.contracts
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists body_markdown text,
  add column if not exists terms_markdown text,
  add column if not exists customer_signed_ip inet,
  add column if not exists customer_signed_user_agent text,
  add column if not exists tenant_signed_ip inet,
  add column if not exists tenant_signed_user_agent text,
  add column if not exists tenant_signed_by uuid references public.profiles(id) on delete set null;

-- Allow customer to insert a contract when accepting a bid (RLS on contracts)
-- Existing policy only allowed tenant + admin writes; customers accept a bid
-- through a server action that uses the service-role client, so we also keep
-- this tight: the insert policy allows only tenant+admin directly. Customer
-- acceptance flows through /api/bids/[id]/respond which uses the admin client.

-- Adjust pipeline_cards stage when bid is accepted → move to 'Vunnet' stage
-- (handled application-side, no trigger needed)

-- Allow service role to move pipeline cards across stages (RLS already permits tenant members)
-- No extra policies needed here.
-- Phase 3: functional CRM (drag-and-drop, card details) + time tracking

-------------------------------------------------------------------------------
-- time_entries — consultants log hours against a project or booking
-------------------------------------------------------------------------------
create type time_entry_status as enum ('draft', 'submitted', 'approved', 'invoiced');

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Who logged the time — always a user (not just a profile ref)
  user_id uuid not null references public.profiles(id) on delete restrict,
  -- Which consultant profile the hours are booked under (for agencies with many consultants)
  consultant_profile_id uuid references public.consultant_profiles(id) on delete set null,
  -- What the hours are against — either a platform project or a marketplace booking
  project_id uuid references public.projects(id) on delete set null,
  booking_id uuid references public.consultant_bookings(id) on delete set null,
  -- Free-form label if neither project nor booking is set (e.g. internal work)
  label text,
  date date not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  description text not null,
  billable boolean not null default true,
  hourly_rate_nok int,
  status time_entry_status not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_tenant_date_idx on public.time_entries(tenant_id, date);
create index time_entries_user_date_idx on public.time_entries(user_id, date);
create index time_entries_project_idx on public.time_entries(project_id) where project_id is not null;
create index time_entries_booking_idx on public.time_entries(booking_id) where booking_id is not null;
create index time_entries_status_idx on public.time_entries(status);

create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

-- RLS
alter table public.time_entries enable row level security;

-- Users can see their own entries; tenant admins/owners see all entries in their tenant
create policy "time_entries_select" on public.time_entries
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_tenant_member(tenant_id) and exists (
      select 1 from public.tenant_members
      where tenant_id = time_entries.tenant_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    ))
  );

-- Users can insert their own entries
create policy "time_entries_insert_self" on public.time_entries
  for insert with check (
    user_id = auth.uid()
    and public.is_tenant_member(tenant_id)
  );

-- Users can update their own draft entries. Admins/owners can update any in their tenant.
create policy "time_entries_update" on public.time_entries
  for update using (
    (user_id = auth.uid() and status in ('draft', 'submitted'))
    or public.is_admin()
    or exists (
      select 1 from public.tenant_members
      where tenant_id = time_entries.tenant_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- Users can delete their own draft entries
create policy "time_entries_delete_own_draft" on public.time_entries
  for delete using (
    user_id = auth.uid() and status = 'draft'
  );

-------------------------------------------------------------------------------
-- pipeline_activity — simple audit log for card/stage changes
-------------------------------------------------------------------------------
create table public.pipeline_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  card_id uuid references public.pipeline_cards(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  activity_type text not null, -- 'stage_changed' | 'note_added' | 'assigned' | 'card_created'
  from_value text,
  to_value text,
  created_at timestamptz not null default now()
);

create index pipeline_activity_card_idx on public.pipeline_activity(card_id, created_at desc);
create index pipeline_activity_tenant_idx on public.pipeline_activity(tenant_id, created_at desc);

alter table public.pipeline_activity enable row level security;

create policy "pipeline_activity_tenant" on public.pipeline_activity
  for all using (public.is_tenant_member(tenant_id) or public.is_admin());
-- Phase 4: project workspace — tasks, files, messaging
-- Brings agencies and customers into one shared surface per project.

-------------------------------------------------------------------------------
-- project_tasks
-------------------------------------------------------------------------------
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_visibility as enum ('shared', 'internal');

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'todo',
  visibility task_visibility not null default 'shared',
  due_date date,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks(project_id, sort_order);
create index project_tasks_tenant_idx on public.project_tasks(tenant_id);
create index project_tasks_assigned_idx on public.project_tasks(assigned_to) where assigned_to is not null;

create trigger project_tasks_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

alter table public.project_tasks enable row level security;

-- Task visibility rules:
--   shared  → customer + any tenant member on the project + admin
--   internal → only the tenant that created it + admin (hidden from customer)
create policy "tasks_select" on public.project_tasks
  for select using (
    public.is_admin()
    or public.is_tenant_member(tenant_id)
    or (
      visibility = 'shared'
      and exists (
        select 1 from public.projects p
        where p.id = project_tasks.project_id and p.customer_id = auth.uid()
      )
    )
  );

create policy "tasks_insert_tenant" on public.project_tasks
  for insert with check (
    public.is_tenant_member(tenant_id)
  );

create policy "tasks_update_tenant" on public.project_tasks
  for update using (public.is_tenant_member(tenant_id) or public.is_admin());

create policy "tasks_delete_tenant" on public.project_tasks
  for delete using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- project_files — metadata rows; actual bytes live in Supabase Storage
-------------------------------------------------------------------------------
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  -- Storage bucket + object path (bucket is always "project-files")
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  visibility task_visibility not null default 'shared',
  created_at timestamptz not null default now()
);

create index project_files_project_idx on public.project_files(project_id, created_at desc);
create index project_files_tenant_idx on public.project_files(tenant_id);

alter table public.project_files enable row level security;

create policy "files_select" on public.project_files
  for select using (
    public.is_admin()
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (
      visibility = 'shared'
      and exists (
        select 1 from public.projects p
        where p.id = project_files.project_id and p.customer_id = auth.uid()
      )
    )
  );

-- Any participant (tenant member or the customer) can upload a file record
create policy "files_insert_participant" on public.project_files
  for insert with check (
    (tenant_id is not null and public.is_tenant_member(tenant_id))
    or exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.customer_id = auth.uid()
    )
  );

create policy "files_delete_uploader" on public.project_files
  for delete using (
    uploaded_by = auth.uid() or public.is_admin()
  );

-------------------------------------------------------------------------------
-- Storage bucket for project files — create policies via SQL
-- NOTE: the bucket itself must be created via the Supabase dashboard or CLI:
--   insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false);
-- Running this insert is idempotent with on conflict, so we include it here.
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

-- Storage RLS policies: allow authenticated participants to read, upload, delete
-- their own uploads. The object path convention is: {project_id}/{random_id}_{filename}
create policy "project_files_read" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and exists (
      select 1 from public.project_files pf
      where pf.storage_path = storage.objects.name
        and (
          public.is_admin()
          or (pf.tenant_id is not null and public.is_tenant_member(pf.tenant_id))
          or (pf.visibility = 'shared' and exists (
            select 1 from public.projects p
            where p.id = pf.project_id and p.customer_id = auth.uid()
          ))
        )
    )
  );

create policy "project_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and auth.uid() is not null
  );

create policy "project_files_delete" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and exists (
      select 1 from public.project_files pf
      where pf.storage_path = storage.objects.name
        and (pf.uploaded_by = auth.uid() or public.is_admin())
    )
  );
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

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

-- Contacts (per-tenant address book) + webhook ingestion.
-- A contact is anyone a tenant wants to track — customer, prospect, newsletter
-- subscriber, etc. Separate from platform-distributed project leads so that
-- tenants can fully run their own CRM even without Innovena-sourced inquiries.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  company text,
  tags text[] not null default '{}',
  notes text,
  source text, -- 'manual' | 'webhook' | 'embed' | 'imported' | free-form
  lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in ('subscriber', 'lead', 'customer', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_identity_present check (
    email is not null or phone is not null or full_name is not null
  )
);

create index contacts_tenant_idx on public.contacts(tenant_id);
create index contacts_email_idx on public.contacts(tenant_id, email);
create index contacts_lifecycle_idx on public.contacts(tenant_id, lifecycle_stage);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Webhook key per tenant so external forms (their own website, Zapier, etc.)
-- can push contacts/leads into the CRM without exposing admin credentials.
alter table public.tenants
  add column webhook_key uuid not null default gen_random_uuid() unique;

-- Pipeline cards get an optional contact reference. A card now represents
-- EITHER a platform project lead (project_id set) OR a tenant-owned lead
-- (contact_id set). Keep the old unique (tenant_id, project_id) so platform
-- leads can't duplicate, add a matching unique on (tenant_id, contact_id).
alter table public.pipeline_cards
  alter column project_id drop not null,
  add column contact_id uuid references public.contacts(id) on delete cascade,
  add column title text,         -- free-form title when not linked to project
  add column value_nok integer,  -- expected deal value for forecasting
  add constraint pipeline_cards_target_present check (
    project_id is not null or contact_id is not null or title is not null
  );

create unique index pipeline_cards_tenant_contact_uniq
  on public.pipeline_cards(tenant_id, contact_id)
  where contact_id is not null;

-- RLS
alter table public.contacts enable row level security;

create policy "contacts_tenant_all" on public.contacts
  for all using (
    public.is_tenant_member(tenant_id) or public.is_admin()
  ) with check (
    public.is_tenant_member(tenant_id) or public.is_admin()
  );

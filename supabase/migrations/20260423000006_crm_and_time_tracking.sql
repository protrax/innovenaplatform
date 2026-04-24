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

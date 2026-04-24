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

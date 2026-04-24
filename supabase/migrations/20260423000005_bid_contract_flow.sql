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

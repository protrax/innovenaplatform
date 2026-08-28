-- Oppfolging av leads som ble fanget, men aldri fullforte.
--
-- lead_captures ga oss folk a ta kontakt med. Men de la bare i en liste i
-- admin: ingen visste at de var der for noen apnet /admin/trakt. Forste ekte
-- fangst (27.08.2026) ble oppdaget tilfeldig, tre dager for sent.
--
-- To kolonner, to jobber:
--   varsel_sendt_at      — internt varsel til ADMIN_EMAIL, ett per okt
--   paaminnelse_sendt_at — én paaminnelse til kunden om a fullfore
--
-- Begge er tidsstempler og ikke boolske: da vet vi ogsa NAR det skjedde, og
-- en feilet jobb kan kjores om igjen uten a sende dobbelt.

alter table public.lead_captures
  add column if not exists varsel_sendt_at timestamptz,
  add column if not exists paaminnelse_sendt_at timestamptz;

-- Kojobben spor «apne fangster uten paaminnelse, eldre enn en time».
create index if not exists lead_captures_paaminnelse_idx
  on public.lead_captures(created_at)
  where project_id is null and paaminnelse_sendt_at is null;

comment on column public.lead_captures.varsel_sendt_at is
  'Nar internt varsel om denne fangsten ble sendt. Null = ikke varslet.';
comment on column public.lead_captures.paaminnelse_sendt_at is
  'Nar kunden fikk paaminnelse om a fullfore. Null = ikke sendt. Sendes kun en gang.';

-- Fangst av leads for de fullforer veiviseren.
--
-- Bakgrunn, malt i tall: innovena.no fanget leads i sitt eget skjema fram til
-- 7. august 2026 og fikk 244 leads pa tretten maneder — snitt 25 i maneden pa
-- det meste. Det skjemaet spurte om kontaktinfo i steg 1 og lagret leadet med
-- en gang, for det beriket det i senere steg.
--
-- Redesignet erstattet den innsendingen med en videresending til denne
-- veiviseren, der kontaktinfo forst kommer i steg 5. Faller kunden av i steg
-- 1-4, sitter vi igjen med ingenting. Etter 7. august: null leads pa
-- innovena.no, to prosjekter her.
--
-- Denne tabellen gjenoppretter fangst-sa-berik: vi lagrer navn og e-post i det
-- oyeblikket vi har dem, uavhengig av om kunden kommer i mal. Fullfores
-- forespoerselen, peker project_id pa prosjektet og raden er bare historikk.
-- Gjor de det ikke, har vi fortsatt noen a ta kontakt med.

create table public.lead_captures (
  id uuid primary key default gen_random_uuid(),
  -- Samme okt-id som wizard_events, slik at trakt og fangst kan kobles.
  session_id text not null unique,
  email text not null,
  full_name text,
  phone text,
  -- Det kunden skrev i steg 1. Ofte det mest verdifulle vi har.
  user_input text,
  -- Hvilken side pa innovena.no som sendte dem, og hvilket fagomrade.
  source text,
  service text,
  category_slugs text[] not null default '{}',
  -- Hoyeste steg okten naadde. Viser hvor nær de var.
  highest_step smallint not null default 2,
  -- Satt nar forespoerselen faktisk ble publisert.
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Den viktigste sporringen er «hvem falt av, nyeste forst».
create index lead_captures_created_idx on public.lead_captures(created_at desc);
create index lead_captures_open_idx on public.lead_captures(created_at desc)
  where project_id is null;

alter table public.lead_captures enable row level security;

-- Skrives utelukkende med service-rollen fra API-ruta, og leses av admin
-- gjennom samme rolle. Ingen anon-policy: kontaktinfo skal ikke kunne leses
-- eller fylles fra nettleseren.

comment on table public.lead_captures is
  'Leads fanget i steg 2 av veiviseren, for de eventuelt fullfoerer. project_id satt = fullfort.';

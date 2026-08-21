-- Trakt-sporing for den offentlige veiviseren.
--
-- Plattformen hadde ingen maling i det hele tatt: ikke Clarity, ikke GA4,
-- ingen stegsporing. Vi sa bare de som kom helt gjennom — tre prosjekter —
-- og hadde ingen mate a vite hvor de andre falt av.
--
-- Tabellen logger ett rad per gang en okt naar et nytt steg. Ingen
-- personopplysninger: en tilfeldig okt-id generert i nettleseren, hvilket
-- steg, hvor de kom fra, og tidspunkt. Beskrivelsen og kontaktinfoen ligger
-- i projects der den hoerer hjemme.

create table public.wizard_events (
  id uuid primary key default gen_random_uuid(),
  -- Tilfeldig id per okt, laget i nettleseren. Ikke knyttet til person.
  session_id text not null,
  -- 1-5. Hoyeste naadde steg per okt gir trakten.
  step smallint not null check (step between 1 and 6),
  -- Fra ?source= — forteller hvilken side pa innovena.no som sendte dem.
  source text,
  -- Fra ?service= — hvilket fagomrade de kom inn pa.
  service text,
  created_at timestamptz not null default now()
);

-- Trakten leses per okt og per dag; begge stottes av disse.
create index wizard_events_session_idx on public.wizard_events(session_id);
create index wizard_events_created_idx on public.wizard_events(created_at desc);
create index wizard_events_step_idx on public.wizard_events(step);

-- Samme okt skal ikke telles to ganger for samme steg.
create unique index wizard_events_session_step_uniq
  on public.wizard_events(session_id, step);

alter table public.wizard_events enable row level security;

-- Skriving skjer utelukkende via service-rollen i API-ruta. Ingen anon-policy:
-- da kan ingen fylle tabellen med soppel fra nettleseren.
-- Lesing gjor admin gjennom samme rolle.

comment on table public.wizard_events is
  'Anonym trakt-sporing for /lag-forespoersel. En rad per okt per steg.';

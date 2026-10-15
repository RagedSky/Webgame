-- ===========================================================================
-- Aetherfall: Dungeons – Zustimmungsnachweise (Tabelle public.consents)
-- Im Supabase-SQL-Editor ausführen (nach schema.sql). Idempotent: beliebig oft ausführbar.
--
-- Website (registrieren.html) und Spiel speichern hier, wann ein Konto den Nutzungsbedingungen
-- zugestimmt und die Datenschutzerklärung bestätigt hat:
--   Clerk-User-ID (auth.jwt()->>'sub'), Version der Nutzungsbedingungen und der Datenschutzerklärung,
--   Version und Wortlaut des Zustimmungstextes, Sprache, Altersbestätigung, Quelle und Zeitpunkt.
-- Der maßgebliche Zeitpunkt (accepted_at) ist immer die Serverzeit.
-- Row Level Security: Jedes Konto darf nur seine EIGENEN Zeilen lesen und einfügen.
-- Ändern und Löschen ist für Nutzer nicht möglich (Nachweis); gelöscht wird nur serverseitig
-- mit der Kontolöschung (supabase/account.sql + Edge Function delete-account).
-- Voraussetzung wie für die Spielstände: Clerk als Third-Party-Auth-Provider (Claim role = authenticated).
-- ===========================================================================

create table if not exists public.consents (
  id               bigint generated always as identity primary key,
  user_id          text not null default (auth.jwt() ->> 'sub'),
  kind             text not null default 'signup',
  terms_version    text not null,
  privacy_version  text not null,
  text_version     text not null,
  consent_text     text not null,
  lang             text not null default 'de',
  age_confirmed    boolean not null,
  min_age          smallint not null default 16,
  source           text not null default 'landing',
  client_at        timestamptz,                         -- Zeitpunkt laut Browser (nur zur Information)
  accepted_at      timestamptz not null default now()   -- Serverzeit (maßgeblich)
);

-- Prüfregeln (einzeln, damit das Skript auch auf älteren Ständen der Tabelle läuft)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consents_user_id_check') then
    alter table public.consents add constraint consents_user_id_check check (char_length(user_id) between 1 and 128);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_kind_check') then
    alter table public.consents add constraint consents_kind_check check (kind in ('signup', 'reconsent'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_versions_check') then
    alter table public.consents add constraint consents_versions_check check (
      char_length(terms_version) between 1 and 32 and char_length(privacy_version) between 1 and 32 and char_length(text_version) between 1 and 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_text_check') then
    alter table public.consents add constraint consents_text_check check (char_length(consent_text) between 1 and 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_lang_check') then
    alter table public.consents add constraint consents_lang_check check (lang ~ '^[a-z]{2}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_age_check') then
    alter table public.consents add constraint consents_age_check check (age_confirmed and min_age between 13 and 21);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_source_check') then
    alter table public.consents add constraint consents_source_check check (source in ('landing', 'game'));
  end if;
end $$;

create index if not exists consents_user_idx on public.consents (user_id, accepted_at desc);

-- Serverzeit erzwingen; unplausible Browserzeit verwerfen
create or replace function public.consents_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.accepted_at := now();
  if new.client_at is not null and (new.client_at > now() + interval '1 day' or new.client_at < now() - interval '30 days') then
    new.client_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists consents_before_insert on public.consents;
create trigger consents_before_insert before insert on public.consents
  for each row execute function public.consents_before_insert();

-- Row Level Security: nur eigene Zeilen lesen und einfügen
alter table public.consents enable row level security;

drop policy if exists "consents_select_own" on public.consents;
drop policy if exists "consents_insert_own" on public.consents;
create policy "consents_select_own" on public.consents for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "consents_insert_own" on public.consents for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- Rechte: anonyme Zugriffe gar nicht, angemeldete nur Lesen und Einfügen (kein Ändern/Löschen)
revoke all on table public.consents from anon;
revoke all on table public.consents from authenticated;
grant select, insert on table public.consents to authenticated;
revoke all on function public.consents_before_insert() from public, anon, authenticated;

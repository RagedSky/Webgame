-- ===========================================================================
-- Aetherfall: Dungeons – Supabase-Schema für Cloud-Spielstände
-- Clerk ist Third-Party-Auth-Provider (offizielle Clerk-Supabase-Integration):
--   1. Clerk-Dashboard → „Connect with Supabase“ (setzt den Claim role = authenticated
--      in den Clerk-Session-Tokens).
--   2. Supabase-Dashboard → Authentication → Sign In / Providers → Third-Party Auth →
--      „Clerk“ hinzufügen und die Domain der Clerk-Instanz eintragen.
--   3. Dieses Skript im SQL-Editor ausführen (neues Projekt).
--      Bestehendes Projekt mit 3 Slots: supabase/migrate_save_slots.sql ausführen (ohne Datenverlust).
-- Im Spiel stehen nur der Clerk Publishable Key und Supabase-URL + Publishable/Anon Key.
-- Die Zeilen gehören über user_id = auth.jwt()->>'sub' (Clerk-User-ID) ihrem Besitzer;
-- Row Level Security erlaubt nur Lesen/Schreiben/Löschen der eigenen Zeilen.
-- ===========================================================================

create table if not exists public.profiles (
  user_id      text primary key default (auth.jwt() ->> 'sub'),
  display_name text check (display_name is null or char_length(display_name) <= 40),
  language     text not null default 'de' check (language ~ '^[a-z]{2}$'),
  settings     jsonb not null default '{}'::jsonb,
  keybindings  jsonb not null default '{}'::jsonb,
  is_admin     boolean not null default false,       -- Admin-Befehle der Konsole; nur per SQL/Dashboard setzbar
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.savegames (
  id          bigint generated always as identity primary key,
  user_id     text not null default (auth.jwt() ->> 'sub'),
  slot        smallint not null constraint savegames_slot_check check (slot between 1 and 5),  -- = CONFIG.saveSlots im Spiel
  character   jsonb not null default '{}'::jsonb,   -- Name, Klasse, Aussehen, Stufe, Talente, Zauber
  progress    jsonb not null default '{}'::jsonb,   -- Flags, Rätsel/Truhen/Geheimnisse, Weltstufe, Statistik
  quests      jsonb not null default '{}'::jsonb,   -- Queststände, verfolgte Quest
  map         jsonb not null default '{}'::jsonb,   -- Region, Position, Nebel des Krieges, Wegsteine, Regionen
  inventory   jsonb not null default '{}'::jsonb,   -- Ausrüstung, Inventar, Edelsteine, Munition, Händlerware
  summary     jsonb not null default '{}'::jsonb,   -- Kurzinfo für die Slot-Übersicht
  revision    integer not null default 1 check (revision > 0),  -- für die Konflikterkennung
  version     integer not null default 3,                       -- Format-Version des Spielstands
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,                                        -- Löschmarker (gelöschter Slot, kehrt nicht zurück)
  constraint savegames_user_id_slot_key unique (user_id, slot)
);

-- updated_at bei jeder Änderung eines Spielstands setzen
create or replace function public.aetherfall_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists savegames_touch on public.savegames;
create trigger savegames_touch before update on public.savegames
  for each row execute function public.aetherfall_touch_updated_at();

-- Row Level Security: nur eigene Zeilen
alter table public.profiles  enable row level security;
alter table public.savegames enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "savegames_select_own" on public.savegames;
drop policy if exists "savegames_insert_own" on public.savegames;
drop policy if exists "savegames_update_own" on public.savegames;
drop policy if exists "savegames_delete_own" on public.savegames;
create policy "savegames_select_own" on public.savegames for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "savegames_insert_own" on public.savegames for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "savegames_update_own" on public.savegames for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "savegames_delete_own" on public.savegames for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- Rechte: nur angemeldete Nutzer (Rolle authenticated aus dem Clerk-Token), kein anonymer Zugriff
revoke all on public.profiles, public.savegames from anon;
grant select, insert, update, delete on public.profiles, public.savegames to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-Rechte für die Befehlskonsole (profiles.is_admin)
-- Spieler können is_admin weder beim Anlegen noch beim Ändern ihres Profils setzen:
--   1. Trigger: für die Rollen anon/authenticated wird is_admin auf false bzw. den alten Wert zurückgesetzt.
--   2. Spaltenrechte: die Rolle authenticated darf die Spalte is_admin nicht schreiben (nur lesen).
-- Vergeben wird das Recht nur im Supabase-Dashboard bzw. SQL-Editor (als Datenbank-Besitzer), z. B.:
--   update public.profiles set is_admin = true where user_id = 'user_…';
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.aetherfall_protect_admin()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.is_admin := false;
    else new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin before insert or update on public.profiles
  for each row execute function public.aetherfall_protect_admin();

revoke insert, update on public.profiles from authenticated;
grant insert (user_id, display_name, language, settings, keybindings, created_at, updated_at) on public.profiles to authenticated;
grant update (user_id, display_name, language, settings, keybindings, updated_at) on public.profiles to authenticated;

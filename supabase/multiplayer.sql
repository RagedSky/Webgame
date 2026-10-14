-- ===========================================================================
-- Aetherfall: Dungeons – Mehrspieler (Koop 2–4 Spieler) für Supabase
-- Voraussetzung: supabase/schema.sql (Tabelle profiles, Clerk als Third-Party-Auth).
-- Dieses Skript ist idempotent (mehrfach ausführbar) und ändert keine Spielstände.
--
-- Aufbau
--   · lobbies, lobby_members, friends, player_blocks, lobby_invites, player_reports
--   · profiles: zusätzlich mp_name, mp_tag (Anzeigename#Kennung) und last_seen (Online-Status)
--   · Alle Änderungen laufen über SECURITY-DEFINER-Funktionen (mp_*), die das Clerk-Token prüfen
--     (auth.jwt()->>'sub'). Mitspieler sehen nie Konto-IDs oder E-Mail-Adressen, nur Name#Kennung,
--     Klasse, Stufe und Aussehen; im Netz trägt jeder eine zufällige Sitzungs-ID (pid).
--   · Realtime Authorization: private Kanäle „lobby:<uuid>“ nur für Mitglieder dieser Lobby
--     (RLS auf realtime.messages für Broadcast und Presence, Senden und Empfangen).
--   · Beitrittscodes: 8 Zeichen aus 32 Zeichen (≈ 1,1 Billionen Möglichkeiten), laufen ab
--     (expires_at; aktive Lobbys verlängern sich per Herzschlag, höchstens 24 h).
--   · Aufräumen: mp_cleanup() bei jedem Erstellen einer Lobby und – falls pg_cron aktiv ist –
--     alle 15 Minuten.
-- Einstellungen im Dashboard: siehe README.md, Abschnitt „Mehrspieler einrichten“.
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Profile: Mehrspieler-Name und Online-Status ----------
alter table public.profiles add column if not exists mp_name   text;
alter table public.profiles add column if not exists mp_tag    text;
alter table public.profiles add column if not exists last_seen timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_mp_name_check') then
    alter table public.profiles add constraint profiles_mp_name_check check (mp_name is null or char_length(mp_name) between 2 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_mp_tag_check') then
    alter table public.profiles add constraint profiles_mp_tag_check check (mp_tag is null or mp_tag ~ '^[0-9]{4}$');
  end if;
end $$;
create unique index if not exists profiles_mp_name_tag_key on public.profiles (lower(mp_name), mp_tag) where mp_name is not null;

-- ---------- Tabellen ----------
create table if not exists public.lobbies (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_user    text not null,                                   -- Clerk-ID des Hosts (wird nie ausgegeben)
  host_name    text not null,
  visibility   text not null default 'private' check (visibility in ('private', 'public')),
  max_players  smallint not null default 4 check (max_players between 2 and 4),
  settings     jsonb not null default '{}'::jsonb,              -- öffentliche Einstellungen (ohne Passwort)
  pass_hash    text,                                            -- bcrypt (pgcrypto), nie im Klartext
  game_version text not null check (char_length(game_version) <= 20),
  status       text not null default 'lobby' check (status in ('lobby', 'running', 'closed')),
  locked       boolean not null default false,
  cheats       boolean not null default false,                  -- vom Host erlaubt (nur privat)
  region       text check (region is null or char_length(region) <= 40),
  progress     integer not null default 0,
  language     text not null default 'de' check (language ~ '^[a-z]{2}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '180 minutes'
);
create index if not exists lobbies_public_idx on public.lobbies (visibility, status, expires_at);

create table if not exists public.lobby_members (
  lobby_id   uuid not null references public.lobbies (id) on delete cascade,
  user_id    text not null,
  pid        text not null check (pid ~ '^[a-z0-9]{6,24}$'),       -- zufällige Sitzungs-ID (Realtime-Presence)
  name       text not null check (char_length(name) <= 26),
  class      text check (class is null or char_length(class) <= 16),
  level      integer check (level is null or level between 1 and 100),
  is_host    boolean not null default false,
  kicked     boolean not null default false,
  joined_at  timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (lobby_id, user_id),
  unique (lobby_id, pid)
);
create index if not exists lobby_members_user_idx on public.lobby_members (user_id);

create table if not exists public.friends (
  id         bigint generated always as identity primary key,
  user_a     text not null,                                       -- Anfragende(r)
  user_b     text not null,                                       -- Angefragte(r)
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b),
  unique (user_a, user_b)
);
create index if not exists friends_b_idx on public.friends (user_b);

create table if not exists public.player_blocks (
  user_id      text not null,
  blocked_user text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, blocked_user),
  check (user_id <> blocked_user)
);
create index if not exists player_blocks_blocked_idx on public.player_blocks (blocked_user);
alter table public.player_blocks add column if not exists id bigint generated always as identity;  -- Kennung zum Freigeben (ohne Konto-ID)
alter table public.player_blocks add column if not exists kind text not null default 'block';           -- 'block' (blockiert) oder 'mute' (stumm)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'player_blocks_kind_check') then
    alter table public.player_blocks add constraint player_blocks_kind_check check (kind in ('block', 'mute'));
  end if;
end $$;

create table if not exists public.lobby_invites (
  id         bigint generated always as identity primary key,
  lobby_id   uuid not null references public.lobbies (id) on delete cascade,
  from_user  text not null,
  to_user    text not null,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lobby_id, to_user)
);
create index if not exists lobby_invites_to_idx on public.lobby_invites (to_user, dismissed);

create table if not exists public.player_reports (
  id            bigint generated always as identity primary key,
  reporter      text not null default (auth.jwt() ->> 'sub'),
  reported_user text,
  reported_pid  text,
  lobby_id      uuid,                                             -- bleibt erhalten, auch wenn die Lobby gelöscht ist
  reason        text not null check (char_length(reason) <= 40),
  context       text check (context is null or char_length(context) <= 2000),
  created_at    timestamptz not null default now()
);

-- ---------- Row Level Security (eigene Zeilen; fremde Daten nur über die Funktionen) ----------
alter table public.lobbies        enable row level security;
alter table public.lobby_members  enable row level security;
alter table public.friends        enable row level security;
alter table public.player_blocks  enable row level security;
alter table public.lobby_invites  enable row level security;
alter table public.player_reports enable row level security;

-- Richtlinien prüfen über SECURITY-DEFINER-Hilfsfunktionen (keine fremden Konto-IDs in Spaltenrechten nötig)
create or replace function public.mp_is_member(p_lobby uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = (select auth.jwt() ->> 'sub') and not m.kicked)
$$;
create or replace function public.mp_own_friend(p_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friends f where f.id = p_id and (select auth.jwt() ->> 'sub') in (f.user_a, f.user_b))
$$;
grant execute on function public.mp_is_member(uuid), public.mp_own_friend(bigint) to authenticated;
revoke all on function public.mp_is_member(uuid), public.mp_own_friend(bigint) from public, anon;

drop policy if exists "lobbies_select_member" on public.lobbies;
create policy "lobbies_select_member" on public.lobbies for select to authenticated
  using ((select public.mp_is_member(id)));
drop policy if exists "lobby_members_select_own" on public.lobby_members;
create policy "lobby_members_select_own" on public.lobby_members for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own" on public.friends for select to authenticated
  using ((select public.mp_own_friend(id)));
drop policy if exists "player_blocks_select_own" on public.player_blocks;
create policy "player_blocks_select_own" on public.player_blocks for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
drop policy if exists "lobby_invites_select_own" on public.lobby_invites;
create policy "lobby_invites_select_own" on public.lobby_invites for select to authenticated
  using ((select auth.jwt() ->> 'sub') = to_user);
-- Meldungen: nur anlegen (eigene), lesen nur Admins (profiles.is_admin); kein Ändern/Löschen
drop policy if exists "player_reports_insert_own" on public.player_reports;
create policy "player_reports_insert_own" on public.player_reports for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = reporter);
drop policy if exists "player_reports_select_admin" on public.player_reports;
create policy "player_reports_select_admin" on public.player_reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.user_id = (select auth.jwt() ->> 'sub') and p.is_admin));

-- Spaltenrechte: keine Konto-IDs, kein Passwort-Hash; Schreiben nur über die Funktionen
revoke all on public.lobbies, public.lobby_members, public.friends, public.player_blocks, public.lobby_invites, public.player_reports from anon, authenticated;
grant select (id, code, visibility, max_players, settings, game_version, status, locked, region, progress, language, created_at, expires_at) on public.lobbies to authenticated;
grant select (lobby_id, user_id, pid, name, class, level, is_host, kicked, joined_at, last_seen) on public.lobby_members to authenticated; -- RLS: nur die eigene Zeile
grant select (id, status, created_at) on public.friends to authenticated;
grant select (user_id, created_at) on public.player_blocks to authenticated;                       -- RLS: nur eigene Sperren
grant select (id, lobby_id, to_user, dismissed, created_at) on public.lobby_invites to authenticated; -- RLS: nur an mich
grant insert (reporter, reported_pid, lobby_id, reason, context) on public.player_reports to authenticated;
grant select on public.player_reports to authenticated;  -- RLS: nur Admins sehen Zeilen

-- ---------- Hilfsfunktionen ----------
create or replace function public.mp_uid() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text := (select auth.jwt() ->> 'sub');
begin
  if v is null or v = '' then raise exception 'MP:not_member' using errcode = '42501'; end if;
  return v;
end; $$;

create or replace function public.mp_ver(v text) returns text
language sql immutable set search_path = '' as $$ select split_part(coalesce(v, ''), '.', 1) || '.' || split_part(coalesce(v, ''), '.', 2) $$;

create or replace function public.mp_blocked(a text, b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_blocks where kind = 'block' and ((user_id = a and blocked_user = b) or (user_id = b and blocked_user = a)))
$$;

create or replace function public.mp_clean_name(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare n text := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
begin
  if char_length(n) < 2 or char_length(n) > 26 or n ~ '[[:cntrl:]<>"`\\/{}\[\]@&;=$%*+!?|~^]' then return null; end if;
  return n;
end; $$;

-- Mitglied (nicht entfernt) einer gültigen Lobby? – für Realtime Authorization
create or replace function public.mp_can_channel(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lobby_members m join public.lobbies l on l.id = m.lobby_id
    where 'lobby:' || l.id::text = p_topic and m.user_id = (select auth.jwt() ->> 'sub') and not m.kicked
      and l.status <> 'closed' and l.expires_at > now()
  )
$$;

-- Aufräumen: abgelaufene/geschlossene Lobbys, alte Einladungen, verwaiste Mitglieder
create or replace function public.mp_cleanup() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.lobbies where expires_at < now() - interval '10 minutes'
    or (status = 'closed' and updated_at < now() - interval '10 minutes')
    or created_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  delete from public.lobby_invites where created_at < now() - interval '1 day' or dismissed;
  delete from public.lobby_members m using public.lobbies l where l.id = m.lobby_id and not m.kicked and m.last_seen < now() - interval '2 hours';
  return n;
end; $$;

-- ---------- Eigenes Mehrspieler-Profil (Name#Kennung) ----------
create or replace function public.mp_set_profile(p_name text)
returns table (mp_name text, mp_tag text)
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); n text := public.mp_clean_name(p_name); cur record; tag text; i integer := 0;
begin
  if n is null or char_length(n) > 20 then raise exception 'MP:name_invalid'; end if;
  select p.mp_name, p.mp_tag into cur from public.profiles p where p.user_id = v_uid;
  if found and cur.mp_name is not null and lower(cur.mp_name) = lower(n) and cur.mp_tag is not null then
    tag := cur.mp_tag;
  else
    loop
      i := i + 1; tag := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      exit when not exists (select 1 from public.profiles p where lower(p.mp_name) = lower(n) and p.mp_tag = tag and p.user_id <> v_uid);
      if i > 40 then raise exception 'MP:name_taken'; end if;
    end loop;
  end if;
  insert into public.profiles (user_id, mp_name, mp_tag, last_seen) values (v_uid, n, tag, now())
  on conflict (user_id) do update set mp_name = excluded.mp_name, mp_tag = excluded.mp_tag, last_seen = now();
  return query select n, tag;
end; $$;

-- ---------- Lobbys ----------
create or replace function public.mp_create_lobby(p_code text, p_visibility text, p_max integer, p_settings jsonb, p_password text, p_version text,
  p_name text, p_class text, p_level integer, p_pid text, p_ttl_min integer)
returns table (id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_code text := upper(coalesce(p_code, '')); v_id uuid; v_exp timestamptz; v_vis text; v_set jsonb; i integer := 0;
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_name text := public.mp_clean_name(p_name);
begin
  perform public.mp_cleanup();
  if v_name is null then raise exception 'MP:name_invalid'; end if;
  if p_pid is null or p_pid !~ '^[a-z0-9]{6,24}$' then raise exception 'MP:not_member'; end if;
  if (select count(*) from public.lobbies l where l.host_user = v_uid and l.created_at > now() - interval '10 minutes') >= 6 then raise exception 'MP:rate'; end if;
  v_vis := case when p_visibility = 'public' then 'public' else 'private' end;
  v_set := coalesce(p_settings, '{}'::jsonb) - 'pass';
  if v_vis = 'public' then v_set := jsonb_set(v_set, '{cheats}', 'false'::jsonb); end if;
  -- Code des Clients prüfen; bei Kollision oder ungültigem Code serverseitig neu würfeln
  while v_code !~ '^[A-HJ-NP-Z2-9]{8}$' or exists (select 1 from public.lobbies l where l.code = v_code) loop
    i := i + 1; if i > 20 then raise exception 'MP:generic'; end if;
    v_code := ''; for k in 1..8 loop v_code := v_code || substr(abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1); end loop;
  end loop;
  -- nur eine Lobby gleichzeitig: alte Mitgliedschaften verlassen
  delete from public.lobby_members m where m.user_id = v_uid and not m.kicked;
  update public.lobbies l set status = 'closed', updated_at = now() where l.host_user = v_uid and l.status <> 'closed'
    and not exists (select 1 from public.lobby_members m where m.lobby_id = l.id and not m.kicked);
  v_exp := now() + make_interval(mins => greatest(30, least(coalesce(p_ttl_min, 180), 360)));
  insert into public.lobbies (code, host_user, host_name, visibility, max_players, settings, pass_hash, game_version, cheats, language, expires_at)
  values (v_code, v_uid, v_name, v_vis, greatest(2, least(coalesce(p_max, 4), 4)), v_set,
    case when coalesce(p_password, '') <> '' then extensions.crypt(left(p_password, 64), extensions.gen_salt('bf', 8)) end,
    left(coalesce(p_version, '?'), 20), v_vis = 'private' and coalesce((v_set ->> 'cheats')::boolean, false),
    case when coalesce(v_set ->> 'lang', '') ~ '^[a-z]{2}$' then v_set ->> 'lang' else 'de' end, v_exp)
  returning lobbies.id into v_id;
  insert into public.lobby_members (lobby_id, user_id, pid, name, class, level, is_host)
  values (v_id, v_uid, p_pid, v_name, left(p_class, 16), greatest(1, least(coalesce(p_level, 1), 100)), true);
  return query select v_id, v_code, v_exp;
end; $$;

create or replace function public.mp_join_lobby(p_code text, p_password text, p_version text, p_name text, p_class text, p_level integer, p_pid text)
returns table (lobby_id uuid, code text, max_players smallint, settings jsonb, status text, visibility text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); l public.lobbies%rowtype; mem public.lobby_members%rowtype; n integer; v_name text := public.mp_clean_name(p_name);
begin
  if v_name is null then raise exception 'MP:name_invalid'; end if;
  if p_pid is null or p_pid !~ '^[a-z0-9]{6,24}$' then raise exception 'MP:not_member'; end if;
  select * into l from public.lobbies x where x.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found or l.status = 'closed' then raise exception 'MP:not_found'; end if;
  if l.expires_at <= now() then raise exception 'MP:expired'; end if;
  if public.mp_ver(l.game_version) <> public.mp_ver(p_version) then raise exception 'MP:version:%', l.game_version; end if;
  select * into mem from public.lobby_members m where m.lobby_id = l.id and m.user_id = v_uid;
  if found and mem.kicked then raise exception 'MP:kicked'; end if;
  if public.mp_blocked(l.host_user, v_uid) then raise exception 'MP:blocked'; end if;
  if l.pass_hash is not null and (coalesce(p_password, '') = '' or extensions.crypt(left(p_password, 64), l.pass_hash) <> l.pass_hash) then raise exception 'MP:password'; end if;
  if mem.user_id is null then
    if l.locked then raise exception 'MP:locked'; end if;
    select count(*) into n from public.lobby_members m where m.lobby_id = l.id and not m.kicked and m.last_seen > now() - interval '3 minutes';
    if n >= l.max_players then raise exception 'MP:full'; end if;
    delete from public.lobby_members m where m.user_id = v_uid and m.lobby_id <> l.id and not m.kicked;
    insert into public.lobby_members (lobby_id, user_id, pid, name, class, level) values (l.id, v_uid, p_pid, v_name, left(p_class, 16), greatest(1, least(coalesce(p_level, 1), 100)));
  else
    -- Wiederverbinden/erneuter Beitritt: neue Sitzungs-ID, Platz bleibt erhalten
    update public.lobby_members m set pid = p_pid, name = v_name, class = left(p_class, 16), level = greatest(1, least(coalesce(p_level, 1), 100)), last_seen = now()
      where m.lobby_id = l.id and m.user_id = v_uid;
  end if;
  update public.lobby_invites i set dismissed = true where i.lobby_id = l.id and i.to_user = v_uid;
  return query select l.id, l.code, l.max_players, l.settings, l.status, l.visibility, l.expires_at;
end; $$;

create or replace function public.mp_leave_lobby(p_lobby uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  delete from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid and not m.kicked;
  update public.lobbies l set status = 'closed', updated_at = now() where l.id = p_lobby
    and not exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and not m.kicked);
end; $$;

create or replace function public.mp_is_host(p_lobby uuid, p_uid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = p_uid and m.is_host and not m.kicked)
$$;

create or replace function public.mp_kick_member(p_lobby uuid, p_pid text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  if not public.mp_is_host(p_lobby, v_uid) then raise exception 'MP:not_host'; end if;
  update public.lobby_members m set kicked = true, is_host = false where m.lobby_id = p_lobby and m.pid = p_pid and m.user_id <> v_uid;
end; $$;

create or replace function public.mp_update_lobby(p_lobby uuid, p_status text, p_settings jsonb, p_visibility text, p_max integer, p_locked boolean, p_region text, p_progress integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_vis text;
begin
  if not public.mp_is_host(p_lobby, v_uid) then raise exception 'MP:not_host'; end if;
  select l.visibility into v_vis from public.lobbies l where l.id = p_lobby;
  v_vis := case when p_visibility in ('private', 'public') then p_visibility else v_vis end;
  update public.lobbies l set
    status      = case when p_status in ('lobby', 'running', 'closed') then p_status else l.status end,
    settings    = case when p_settings is null then l.settings when v_vis = 'public' then jsonb_set(p_settings - 'pass', '{cheats}', 'false'::jsonb) else p_settings - 'pass' end,
    visibility  = v_vis,
    cheats      = v_vis = 'private' and coalesce(((case when p_settings is null then l.settings else p_settings end) ->> 'cheats')::boolean, false),
    max_players = case when p_max between 2 and 4 then p_max else l.max_players end,
    locked      = coalesce(p_locked, l.locked),
    region      = coalesce(left(p_region, 40), l.region),
    progress    = coalesce(greatest(0, least(p_progress, 1000)), l.progress),
    updated_at  = now()
  where l.id = p_lobby;
end; $$;

-- Host-Migration: ein Mitglied übernimmt (Grenze: Clients entscheiden gemeinsam, siehe README)
create or replace function public.mp_claim_host(p_lobby uuid, p_pid text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_name text;
begin
  select m.name into v_name from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid and m.pid = p_pid and not m.kicked;
  if not found then raise exception 'MP:not_member'; end if;
  update public.lobby_members m set is_host = (m.user_id = v_uid) where m.lobby_id = p_lobby;
  update public.lobbies l set host_user = v_uid, host_name = v_name, updated_at = now() where l.id = p_lobby;
end; $$;

-- Herzschlag: Online-Status (profiles.last_seen) und – in einer Lobby – Mitgliedschaft/Lobby lebendig halten
create or replace function public.mp_heartbeat(p_lobby uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  insert into public.profiles (user_id, last_seen) values (v_uid, now()) on conflict (user_id) do update set last_seen = now();
  if p_lobby is not null then
    update public.lobby_members m set last_seen = now() where m.lobby_id = p_lobby and m.user_id = v_uid and not m.kicked;
    if found then
      update public.lobbies l set expires_at = least(greatest(l.expires_at, now() + interval '30 minutes'), l.created_at + interval '24 hours')
        where l.id = p_lobby and l.status <> 'closed';
    end if;
  end if;
end; $$;

create or replace function public.mp_list_lobbies(p_version text)
returns table (code text, host_name text, region text, progress integer, players integer, max_players smallint, language text, has_password boolean, status text, game_version text, difficulty text)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  return query
  select l.code, l.host_name, l.region, l.progress,
         (select count(*)::int from public.lobby_members m where m.lobby_id = l.id and not m.kicked and m.last_seen > now() - interval '3 minutes') as players,
         l.max_players, l.language, l.pass_hash is not null, l.status, l.game_version, coalesce(l.settings ->> 'diff', 'normal')
  from public.lobbies l
  where l.visibility = 'public' and l.status <> 'closed' and not l.locked and l.expires_at > now()
    and public.mp_ver(l.game_version) = public.mp_ver(p_version)
    and not public.mp_blocked(l.host_user, v_uid)
    and (select count(*) from public.lobby_members m where m.lobby_id = l.id and not m.kicked and m.last_seen > now() - interval '3 minutes') < l.max_players
  order by l.created_at desc
  limit 30;
end; $$;

-- ---------- Freunde ----------
create or replace function public.mp_friends()
returns table (id bigint, name text, tag text, status text, incoming boolean, online boolean, lobby_code text)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  return query
  select f.id, p.mp_name, p.mp_tag, f.status, f.user_b = v_uid and f.status = 'pending',
         coalesce(p.last_seen > now() - interval '150 seconds', false),
         case when f.status = 'accepted' then (select l.code from public.lobby_members m join public.lobbies l on l.id = m.lobby_id
           where m.user_id = p.user_id and not m.kicked and l.status <> 'closed' and l.expires_at > now() and l.visibility = 'public' limit 1) end
  from public.friends f
  join public.profiles p on p.user_id = case when f.user_a = v_uid then f.user_b else f.user_a end
  where v_uid in (f.user_a, f.user_b) and not public.mp_blocked(f.user_a, f.user_b)
  order by f.status, p.mp_name;
end; $$;

create or replace function public.mp_friend_request(p_name text, p_tag text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_to text; n integer; ex public.friends%rowtype;
begin
  if (select count(*) from public.friends f where f.user_a = v_uid and f.created_at > now() - interval '1 hour') >= 20 then raise exception 'MP:rate'; end if;
  select count(*) into n from public.profiles p where lower(p.mp_name) = lower(btrim(p_name)) and (p_tag is null or p.mp_tag = p_tag);
  if n = 0 then raise exception 'MP:no_user'; end if;
  if n > 1 then raise exception 'MP:ambiguous'; end if;
  select p.user_id into v_to from public.profiles p where lower(p.mp_name) = lower(btrim(p_name)) and (p_tag is null or p.mp_tag = p_tag);
  if v_to = v_uid then raise exception 'MP:self'; end if;
  if public.mp_blocked(v_uid, v_to) then raise exception 'MP:no_user'; end if;
  select * into ex from public.friends f where (f.user_a = v_uid and f.user_b = v_to) or (f.user_a = v_to and f.user_b = v_uid);
  if found then
    if ex.status = 'pending' and ex.user_b = v_uid then update public.friends f set status = 'accepted', updated_at = now() where f.id = ex.id; return; end if;
    raise exception 'MP:exists';
  end if;
  insert into public.friends (user_a, user_b) values (v_uid, v_to);
end; $$;

create or replace function public.mp_friend_respond(p_id bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  if p_accept then update public.friends f set status = 'accepted', updated_at = now() where f.id = p_id and f.user_b = v_uid and f.status = 'pending';
  else delete from public.friends f where f.id = p_id and f.user_b = v_uid and f.status = 'pending'; end if;
end; $$;

create or replace function public.mp_friend_remove(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  delete from public.friends f where f.id = p_id and v_uid in (f.user_a, f.user_b);
end; $$;

-- ---------- Einladungen ----------
create or replace function public.mp_invite(p_friend bigint, p_lobby uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_to text;
begin
  if not exists (select 1 from public.lobby_members m join public.lobbies l on l.id = m.lobby_id
                 where m.lobby_id = p_lobby and m.user_id = v_uid and not m.kicked and l.status <> 'closed') then raise exception 'MP:not_member'; end if;
  select case when f.user_a = v_uid then f.user_b else f.user_a end into v_to from public.friends f
    where f.id = p_friend and f.status = 'accepted' and v_uid in (f.user_a, f.user_b);
  if v_to is null then raise exception 'MP:no_user'; end if;
  if public.mp_blocked(v_uid, v_to) then raise exception 'MP:blocked'; end if;
  if (select count(*) from public.lobby_invites i where i.from_user = v_uid and i.created_at > now() - interval '1 hour') >= 30 then raise exception 'MP:rate'; end if;
  insert into public.lobby_invites (lobby_id, from_user, to_user) values (p_lobby, v_uid, v_to)
  on conflict (lobby_id, to_user) do update set from_user = excluded.from_user, dismissed = false, created_at = now();
end; $$;

create or replace function public.mp_invites()
returns table (id bigint, from_name text, from_tag text, code text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  return query
  select i.id, p.mp_name, p.mp_tag, l.code, i.created_at
  from public.lobby_invites i join public.lobbies l on l.id = i.lobby_id left join public.profiles p on p.user_id = i.from_user
  where i.to_user = v_uid and not i.dismissed and i.created_at > now() - interval '30 minutes'
    and l.status <> 'closed' and l.expires_at > now() and not public.mp_blocked(i.from_user, v_uid)
  order by i.created_at desc limit 10;
end; $$;

create or replace function public.mp_invite_dismiss(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  update public.lobby_invites i set dismissed = true where i.id = p_id and i.to_user = v_uid;
end; $$;

-- ---------- Blockieren, Melden ----------
create or replace function public.mp_block_member(p_lobby uuid, p_pid text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_t text;
begin
  if not exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid) then raise exception 'MP:not_member'; end if;
  select m.user_id into v_t from public.lobby_members m where m.lobby_id = p_lobby and m.pid = p_pid;
  if v_t is null then raise exception 'MP:no_user'; end if;
  if v_t = v_uid then raise exception 'MP:self'; end if;
  insert into public.player_blocks (user_id, blocked_user, kind) values (v_uid, v_t, 'block') on conflict (user_id, blocked_user) do update set kind = 'block';
  delete from public.friends f where (f.user_a = v_uid and f.user_b = v_t) or (f.user_a = v_t and f.user_b = v_uid);
  delete from public.lobby_invites i where i.from_user = v_t and i.to_user = v_uid;
end; $$;

-- Stummschalten (dauerhaft, je Konto): stummgeschaltete Spieler bleiben in künftigen Sitzungen stumm
create or replace function public.mp_mute_member(p_lobby uuid, p_pid text, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_t text;
begin
  if not exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid) then raise exception 'MP:not_member'; end if;
  select m.user_id into v_t from public.lobby_members m where m.lobby_id = p_lobby and m.pid = p_pid;
  if v_t is null then raise exception 'MP:no_user'; end if;
  if v_t = v_uid then raise exception 'MP:self'; end if;
  if p_on then insert into public.player_blocks (user_id, blocked_user, kind) values (v_uid, v_t, 'mute') on conflict (user_id, blocked_user) do nothing;
  else delete from public.player_blocks b where b.user_id = v_uid and b.blocked_user = v_t and b.kind = 'mute'; end if;
end; $$;

-- eigene Sperrliste (Name#Kennung, blockiert/stumm) und Freigeben
drop function if exists public.mp_blocks();
create or replace function public.mp_blocks()
returns table (id bigint, name text, tag text, kind text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  return query select b.id, p.mp_name, p.mp_tag, b.kind, b.created_at from public.player_blocks b left join public.profiles p on p.user_id = b.blocked_user
    where b.user_id = v_uid order by b.created_at desc limit 100;
end; $$;

create or replace function public.mp_unblock(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  delete from public.player_blocks b where b.id = p_id and b.user_id = v_uid;
end; $$;

-- Sitzungs-IDs der Mitglieder dieser Lobby: von mir blockiert ('block') oder stummgeschaltet ('mute'), mich blockiert ('blocked')
drop function if exists public.mp_blocked_pids(uuid);
create or replace function public.mp_blocked_pids(p_lobby uuid)
returns table (pid text, kind text)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := public.mp_uid();
begin
  if not exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid) then return; end if;
  return query
    select m.pid, b.kind from public.lobby_members m join public.player_blocks b on b.user_id = v_uid and b.blocked_user = m.user_id
      where m.lobby_id = p_lobby and m.user_id <> v_uid
    union
    select m.pid, 'blocked'::text from public.lobby_members m join public.player_blocks b on b.user_id = m.user_id and b.blocked_user = v_uid and b.kind = 'block'
      where m.lobby_id = p_lobby and m.user_id <> v_uid;
end; $$;

create or replace function public.mp_report(p_lobby uuid, p_pid text, p_reason text, p_context text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid text := public.mp_uid(); v_t text;
begin
  if (select count(*) from public.player_reports r where r.reporter = v_uid and r.created_at > now() - interval '1 hour') >= 10 then raise exception 'MP:rate'; end if;
  if not exists (select 1 from public.lobby_members m where m.lobby_id = p_lobby and m.user_id = v_uid) then raise exception 'MP:not_member'; end if;
  select m.user_id into v_t from public.lobby_members m where m.lobby_id = p_lobby and m.pid = p_pid;
  if v_t is null then raise exception 'MP:no_user'; end if;
  insert into public.player_reports (reporter, reported_user, reported_pid, lobby_id, reason, context)
  values (v_uid, v_t, p_pid, p_lobby, left(coalesce(p_reason, 'other'), 40), left(p_context, 2000));
end; $$;

-- ---------- Ausführungsrechte: nur angemeldete Spieler, nur die öffentlichen Funktionen ----------
revoke all on function public.mp_uid(), public.mp_ver(text), public.mp_blocked(text, text), public.mp_clean_name(text), public.mp_can_channel(text),
  public.mp_cleanup(), public.mp_is_host(uuid, text) from public, anon;
grant execute on function public.mp_can_channel(text) to authenticated;   -- wird von den Realtime-Policies aufgerufen
revoke all on function public.mp_set_profile(text), public.mp_create_lobby(text, text, integer, jsonb, text, text, text, text, integer, text, integer),
  public.mp_join_lobby(text, text, text, text, text, integer, text), public.mp_leave_lobby(uuid), public.mp_kick_member(uuid, text),
  public.mp_update_lobby(uuid, text, jsonb, text, integer, boolean, text, integer), public.mp_claim_host(uuid, text), public.mp_heartbeat(uuid),
  public.mp_list_lobbies(text), public.mp_friends(), public.mp_friend_request(text, text), public.mp_friend_respond(bigint, boolean), public.mp_friend_remove(bigint),
  public.mp_invite(bigint, uuid), public.mp_invites(), public.mp_invite_dismiss(bigint), public.mp_block_member(uuid, text), public.mp_blocked_pids(uuid),
  public.mp_report(uuid, text, text, text), public.mp_blocks(), public.mp_unblock(bigint), public.mp_mute_member(uuid, text, boolean) from public, anon;
grant execute on function public.mp_set_profile(text), public.mp_create_lobby(text, text, integer, jsonb, text, text, text, text, integer, text, integer),
  public.mp_join_lobby(text, text, text, text, text, integer, text), public.mp_leave_lobby(uuid), public.mp_kick_member(uuid, text),
  public.mp_update_lobby(uuid, text, jsonb, text, integer, boolean, text, integer), public.mp_claim_host(uuid, text), public.mp_heartbeat(uuid),
  public.mp_list_lobbies(text), public.mp_friends(), public.mp_friend_request(text, text), public.mp_friend_respond(bigint, boolean), public.mp_friend_remove(bigint),
  public.mp_invite(bigint, uuid), public.mp_invites(), public.mp_invite_dismiss(bigint), public.mp_block_member(uuid, text), public.mp_blocked_pids(uuid),
  public.mp_report(uuid, text, text, text), public.mp_blocks(), public.mp_unblock(bigint), public.mp_mute_member(uuid, text, boolean) to authenticated;

-- ---------- Realtime Authorization: private Kanäle „lobby:<uuid>“ ----------
-- Empfangen (select) und Senden (insert) von Broadcast und Presence nur für Mitglieder der Lobby.
drop policy if exists "aetherfall_mp_receive" on realtime.messages;
create policy "aetherfall_mp_receive" on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence') and (select realtime.topic()) like 'lobby:%' and (select public.mp_can_channel((select realtime.topic()))));
drop policy if exists "aetherfall_mp_send" on realtime.messages;
create policy "aetherfall_mp_send" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence') and (select realtime.topic()) like 'lobby:%' and (select public.mp_can_channel((select realtime.topic()))));

-- ---------- Aufräumen per pg_cron (optional; nur wenn die Erweiterung aktiv ist) ----------
-- Aktivieren: Dashboard › Database › Extensions › pg_cron. Ohne pg_cron räumt mp_create_lobby auf.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'aetherfall-mp-cleanup';
    perform cron.schedule('aetherfall-mp-cleanup', '*/15 * * * *', 'select public.mp_cleanup()');
  end if;
end $$;

-- ===========================================================================
-- Aetherfall: Dungeons – Kontolöschung und Aufbewahrung
-- Im Supabase-SQL-Editor ausführen (nach schema.sql, optional multiplayer.sql, consents.sql). Idempotent.
--
-- public.af_delete_user_data(p_user) löscht ALLE Daten eines Kontos in einer Transaktion:
--   Lobbys (als Host) inkl. Mitglieder/Einladungen, Lobby-Mitgliedschaften, Einladungen, Freundschaften,
--   Blockierungen/Stummschaltungen (in beide Richtungen), Meldungen (gemeldet oder gemeldet worden),
--   Spielstände, Zustimmungsnachweise und das Profil.
-- Aufrufbar NUR mit der service_role – also ausschließlich serverseitig aus der Edge Function
-- supabase/functions/delete-account. Nutzer im Browser können sie nicht ausführen.
-- Fehlende Tabellen (z. B. ohne multiplayer.sql) werden übersprungen.
--
-- public.af_cleanup_reports() entfernt Meldungen, die älter als 180 Tage sind (Datenschutzerklärung:
-- „höchstens sechs Monate“). Mit pg_cron läuft sie täglich automatisch.
-- ===========================================================================

create or replace function public.af_delete_user_data(p_user text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  res jsonb := '{}'::jsonb;
  n   integer;
  -- Tabelle, Bedingung (immer mit $1 = Konto-ID)
  steps text[][] := array[
    ['lobbies',         'host_user = $1'],
    ['lobby_invites',   'from_user = $1 or to_user = $1'],
    ['lobby_members',   'user_id = $1'],
    ['friends',         'user_a = $1 or user_b = $1'],
    ['player_blocks',   'user_id = $1 or blocked_user = $1'],
    ['player_reports',  'reporter = $1 or reported_user = $1'],
    ['savegames',       'user_id = $1'],
    ['consents',        'user_id = $1'],
    ['profiles',        'user_id = $1']
  ];
  i integer;
begin
  if p_user is null or char_length(p_user) < 3 or char_length(p_user) > 128 then
    raise exception 'af_delete_user_data: ungültige Konto-ID';
  end if;
  for i in 1 .. array_length(steps, 1) loop
    if to_regclass('public.' || steps[i][1]) is not null then
      execute format('delete from public.%I where %s', steps[i][1], steps[i][2]) using p_user;
      get diagnostics n = row_count;
      res := res || jsonb_build_object(steps[i][1], n);
    end if;
  end loop;
  return res;
end;
$$;
revoke all on function public.af_delete_user_data(text) from public, anon, authenticated;
grant execute on function public.af_delete_user_data(text) to service_role;

-- Aufbewahrung von Meldungen: höchstens 180 Tage
create or replace function public.af_cleanup_reports()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer := 0;
begin
  if to_regclass('public.player_reports') is not null then
    execute 'delete from public.player_reports where created_at < now() - interval ''180 days''';
    get diagnostics n = row_count;
  end if;
  return n;
end;
$$;
revoke all on function public.af_cleanup_reports() from public, anon, authenticated;
grant execute on function public.af_cleanup_reports() to service_role;

-- Täglich um 03:17 Uhr (UTC) per pg_cron, falls aktiv (Dashboard › Database › Extensions › pg_cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'aetherfall-report-retention';
    perform cron.schedule('aetherfall-report-retention', '17 3 * * *', 'select public.af_cleanup_reports()');
  end if;
end $$;

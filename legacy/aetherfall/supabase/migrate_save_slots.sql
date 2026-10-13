-- ===========================================================================
-- Aetherfall: Dungeons – Migration der Tabelle savegames auf 5 Speicherslots
-- Für bestehende Projekte: im Supabase-Dashboard → SQL Editor ausführen.
--   · idempotent: darf beliebig oft laufen
--   · ohne Datenverlust: vorhandene Spielstände (Slots 1–3) bleiben unverändert
--   · alles in einer Transaktion: scheitert ein Schritt, wird nichts geändert
-- Passt zu CONFIG.saveSlots = 5 im Spiel. Für eine andere Slot-Anzahl die Zahl 5 in Schritt 1 ersetzen.
-- ===========================================================================
begin;

-- 1) Slot-Bereich 1–5: alle bisherigen CHECK-Constraints auf die Spalte slot (z. B. „slot between 1 and 3“) ersetzen
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.conrelid = 'public.savegames'::regclass and con.contype = 'c' and att.attname = 'slot'
  loop
    execute format('alter table public.savegames drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.savegames add constraint savegames_slot_check check (slot between 1 and 5);

-- 2) Ein Spielstand je Konto und Slot: Unique (user_id, slot) – Grundlage für Überschreiben/Upsert
do $$
begin
  if not exists (
    select 1 from pg_constraint con
    where con.conrelid = 'public.savegames'::regclass and con.contype in ('u', 'p')
      and (select array_agg(att.attname::text order by att.attname)
             from unnest(con.conkey) k join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k) = array['slot', 'user_id']
  ) then
    if exists (select 1 from public.savegames group by user_id, slot having count(*) > 1) then
      raise exception 'savegames enthält doppelte Zeilen je (user_id, slot) – bitte zuerst bereinigen. Es wurde nichts geändert.';
    end if;
    alter table public.savegames add constraint savegames_user_id_slot_key unique (user_id, slot);
  end if;
end $$;

-- 3) Löschmarker: ein gelöschter Slot wird nicht sofort entfernt, sondern markiert – andere Geräte erkennen das Löschen,
--    und kein Gerät lädt ihn als „Geisterstand“ wieder herunter. Das Spiel kommt auch ohne diese Spalte aus.
alter table public.savegames add column if not exists deleted_at timestamptz;

-- 4) Row Level Security: Lesen, Anlegen, Ändern und Löschen nur der eigenen Zeilen (Clerk-User-ID aus dem Token)
alter table public.savegames enable row level security;
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

-- 5) Rechte: nur angemeldete Nutzer, kein anonymer Zugriff
revoke all on public.savegames from anon;
grant select, insert, update, delete on public.savegames to authenticated;

commit;

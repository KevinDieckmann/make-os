-- ============================================================
-- MAKE.ORGA einfrieren — nur noch lesen
--
-- Für den Umzug nach MAKE OS (Kevins Entscheidung, 24.09.2026):
-- danach wird nur noch in MAKE OS gepflegt. Diese Datei entzieht
-- allen Mitgliedern das Anlegen, Ändern und Löschen. Lesen bleibt
-- — das Cockpit zeigt weiter alles an, speichert aber nichts mehr.
--
-- Im Supabase SQL-Editor ausführen. Mehrfach ausführbar.
-- Rückgängig: auftauen.sql
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['konten','kategorien','buchungen','zuordnungsregeln','schulden','planwerte','belege','leads']
  loop
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
  end loop;
end $$;

-- Kontrolle: pro Tabelle darf nur noch die select-Regel übrig sein.
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, cmd;

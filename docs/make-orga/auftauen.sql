-- ============================================================
-- MAKE.ORGA auftauen — Schreibrechte zurückholen
-- Der Rückweg zu einfrieren.sql. Stellt genau die Regeln aus
-- Malins make-orga-schema-phase1.sql wieder her.
-- Im Supabase SQL-Editor ausführen. Mehrfach ausführbar.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['konten','kategorien','buchungen','zuordnungsregeln','schulden','planwerte','belege','leads']
  loop
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_member())', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_member()) with check (public.is_member())', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.is_member())', t, t);
  end loop;
end $$;

select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, cmd;

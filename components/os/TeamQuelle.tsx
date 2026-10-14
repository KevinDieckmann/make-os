'use client';
// ─── Das CRM-Team im Browser (14.10., Kevins Entscheidung „feste Vorgaben aus den Konten ableiten“) ───────────────────────────────────
// Der OS-Rahmen (app/os/layout.tsx) rechnet das Team auf dem Server aus den Konten (lib/crm/team-liste.ts `teamAusKonten`) und gibt es
// hierher. Gesetzt wird es beim ersten Rendern — VOR allen Seiten darunter (dieselbe Reihenfolge wie auf dem Server, keine Abweichung
// beim Hydrieren); `teamSetzen` ersetzt das Array an Ort und Stelle, alle Leser von `TEAM` bleiben synchron. Mit
// `NEXT_PUBLIC_MAKE_OS_CRM_TEAM` ändert sich nichts. Nur Kennung, Vorname, Farbe, Verantwortung — nie Adressen.
import { teamSetzen, type Mitglied } from '@/lib/crm/team-liste';

export function TeamQuelle({ team }: { team: Mitglied[] | null }) {
  teamSetzen(team);
  return null;
}

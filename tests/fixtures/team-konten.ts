// ─── Test-Hilfe: das CRM-Team aus Konten (14.10.) ───────────────────────────────────────────────────────────────────────────────────
// Seit Kevins Entscheidung 14.10. kommt das CRM-Team ohne NEXT_PUBLIC_MAKE_OS_CRM_TEAM aus den KONTEN des Haushalts (lib/crm/team-liste.ts
// `teamAusKonten`); ohne Konten gelten Rollen-Platzhalter. Tests, deren Fälle mit zwei Personen-Kennungen rechnen, setzen das Team hier so,
// wie es eine Instanz mit diesen zwei Konten bekommt (Inhaber zuerst: Sales; zweite Person: Marketing + Event).
import { teamAusKonten, teamSetzen } from '@/lib/crm/team-liste';

const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function teamWieKonten(erste = 'kevin', zweite = 'malin'): void {
  teamSetzen(teamAusKonten([
    { speicher: erste, name: gross(erste), rolle: 'inhaber', haushalt: 'h', angelegt: '2026-01-01' },
    { speicher: zweite, name: gross(zweite), rolle: 'mitglied', haushalt: 'h', angelegt: '2026-01-02' },
  ]));
}

// Gemeinsamer Aufbau für die Gmail-Tests: Konten (Kevin Inhaber, Malin Mitglied, ein Haushalt), Umgebung, nachgebautes Google/Gmail.
// Alles erfunden (@example.invalid / @makeinnovation.test) — nie echte Daten, nie ein echtes Google-Konto.
import { GmailFake } from './gmail-fake';

export const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: 'kevin@example.invalid', name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: 'malin@example.invalid', name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };

type Vi = { stubGlobal: (n: string, v: unknown) => void; stubEnv: (n: string, v: string) => void };

/** Fetch und Umgebung auf das nachgebaute Google biegen (nach `vi.useFakeTimers`, wenn nötig). */
export function umgebung(vi: Vi, g: GmailFake, extra: Record<string, string> = {}): void {
  vi.stubGlobal('fetch', async (u: string | URL, i: RequestInit = {}) => g.handle(String(u), i));
  const env: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'client-id-test', GOOGLE_CLIENT_SECRET: 'geheim', GOOGLE_ERLAUBTE_DOMAIN: 'makeinnovation.test', MAKE_OS_ADRESSE: 'http://localhost:3001',
    NEXT_PUBLIC_MAKE_BAU: '', ICLOUD_APPLE_ID: '', ICLOUD_APP_PASSWORT: '', GMAIL_PUBSUB_THEMA: '', GMAIL_PUSH_DIENSTKONTO: '', GMAIL_PUSH_AUDIENCE: '', ...extra,
  };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

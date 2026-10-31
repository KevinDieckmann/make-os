// ─── Sperrliste für Betriebe (01.11.2026, Welle A „Firmen als Ziel“) ─────────────────────────────────────────────────────────
// Dieselbe Sperrliste wie für Personen (lib/crm/sperrliste.ts: `crm-sperrliste--<haushalt>`, HMAC-SHA-256 mit Pepper, nie Klartext), nur mit den
// Merkmalen eines Betriebs (`betriebMerkmale`, lib/crm/betrieb.ts): OSM-ID, eigene Domain, Name + Adresse. Ein Betrieb ohne Ansprechpartner hat
// keinen Personennamen — ohne diese Merkmale überlebte sein „Nein“ den nächsten Abendlauf nicht.
//   entsteht  Werbesperre an der Firma (jeder Schreibweg über `crmSchreiben`), Abmeldelink an die Firmen-Adresse, Art. 17 einer Inhaber-Person
//   wirkt     Abendlauf und Datei-Import der Homepage-Funde, Übernahme eines Funds: ein gesperrter Betrieb wird nie wieder angelegt

import { sperrHash, sperrHashV1, sperrHashesAufnehmen, type SperrEintrag, type SperrGrund } from './sperrliste';
import { formatModus } from '@/lib/store/huelle.mjs';
import { betriebMerkmale, type BetriebKandidat } from './betrieb';

/** Hashes eines Betriebs für NEUE Einträge (Format v2: aktuelle Version; kompatibel: v2 + v1 wie bei Personen). */
export function betriebSperrHashes(f: BetriebKandidat): string[] {
  const m = betriebMerkmale(f);
  const aktuell = m.map(sperrHash);
  return formatModus() === 'v2' ? aktuell : Array.from(new Set([...aktuell, ...m.map(sperrHashV1)]));
}
/** Alle Hashes in jeder Version — geprüft wird immer gegen beide. */
export const betriebSperrHashesAlle = (f: BetriebKandidat) => { const m = betriebMerkmale(f); return Array.from(new Set([...m.map(sperrHash), ...m.map(sperrHashV1)])); };

/** Steht der Betrieb auf der Sperrliste (eines seiner Merkmale)? Rein bis auf den Pepper. */
export function betriebGesperrt(eintraege: readonly SperrEintrag[], f: BetriebKandidat): boolean {
  if (!eintraege.length) return false;
  const h = new Set(betriebSperrHashesAlle(f));
  return h.size > 0 && eintraege.some(e => e.h.some(x => h.has(x)));
}

/** Betriebe aufnehmen (idempotent, je Betrieb ein Eintrag). Liefert die Zahl geänderter Einträge. */
export async function betriebeSperren(betriebe: readonly BetriebKandidat[], grund: SperrGrund, am: string): Promise<number> {
  let n = 0;
  for (const f of betriebe) { const h = betriebSperrHashes(f); if (h.length) n += await sperrHashesAufnehmen(h, grund, am); }
  return n;
}

// ─── Prozesse — Stellschrauben, die an eine vorhandene Schreibstelle weiterleiten (Server; Restpunkte 24.10.) ───────────────────────────────────────────────
// Kevin 22.10.: „Alles muss anpassbar sein und es muss auch immer mal wieder zu bearbeiten sein.“ Drei Masken des Steckbriefs ändern EIN Feld eines Objekts,
// dessen Route das GANZE Objekt erwartet (Scoring-Einstellungen, Buchungsseite, Head-Einstellung). Damit der Browser nicht erst das ganze Objekt holen muss
// (bei den Buchungsseiten stünden dabei die Buchungen der Gäste im Browser), schickt die Karte nur Feld, Wert und den gelesenen Stand — HIER wird der
// aktuelle Stand gelesen, geprüft (409) und an DIESELBE Schreibstelle gegeben wie die Fachseite. KEINE zweite Wahrheit, nie am Bestand vorbei:
//   scoring  → `scoringSchreiben` (lib/crm/scoring-server.ts: Stand/409, `scoringPruefen` → 400/413 mit Satz, Vermerk, Protokoll)
//   buchung  → `seiteSpeichern`   (lib/kalender/buchung-seite-server.ts: dieselbe Stelle wie POST /api/kalender/buchung `seite` — Stand, Person, Protokoll)
//   head     → `einstellungAendern` (lib/agenten/einstellung.ts: dieselbe Stelle wie POST /api/agenten `einstellung` — Stand/409, Autonomie nur verschärfen)
// Rechte wie dort, und strenger, wo die Projektregel es will: Dienstweg nie (Tor der Route); Scoring und Buchungsseiten jede Person im Haushalt des Inhabers
// (wie /api/crm/scoring, /api/kalender/buchung); die Agenten-Regler der Heads NUR der Inhaber (CLAUDE.md Regel 7) — sonst 403.
// Werte außerhalb der Grenzen → 400 mit Satz (die Buchungsseite klemmte bisher still: hier wird abgelehnt). Gibt nie Daten Dritter zurück.

import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { SCORING_FELDER, BUCHUNG_FELDER, HEAD_FELDER, type ScoringFeld, type BuchungFeld, type HeadFeld } from './stellschrauben';

export type WeiterErgebnis = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string): WeiterErgebnis => ({ ok: false, status, fehler });

/** Die Business-Heads, deren Regler der Steckbrief zeigt (dieselben wie lib/prozesse/stellschrauben-server.ts). */
const HEADS = new Set(['sales', 'marketing', 'event', 'finanzen']);
const STAND = /^[\w:.+\-]{1,120}$/;

/** Die Anfrage lesen (rein): `{ weg: { art, feld, stand, seite?/head? }, wert }` — sonst ein Satz. */
export function weiterAnfrage(b: unknown): { ok: true; weg: { art: 'scoring'; feld: ScoringFeld; stand: string } | { art: 'buchung'; seite: string; feld: BuchungFeld; stand: string } | { art: 'head'; head: string; feld: HeadFeld; stand: string }; wert: unknown } | { ok: false; fehler: string } {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, fehler: 'Anfrage fehlt.' };
  const o = b as Record<string, unknown>;
  const w = (o.weg && typeof o.weg === 'object' ? o.weg : {}) as Record<string, unknown>;
  if (!('wert' in o)) return { ok: false, fehler: 'Wert fehlt (null = zurück auf die Vorgabe).' };
  const stand = typeof w.stand === 'string' && STAND.test(w.stand) ? w.stand : null;
  if (!stand) return { ok: false, fehler: 'Stand fehlt — bitte neu laden.' };
  if (w.art === 'scoring' && (SCORING_FELDER as readonly unknown[]).includes(w.feld)) return { ok: true, weg: { art: 'scoring', feld: w.feld as ScoringFeld, stand }, wert: o.wert };
  if (w.art === 'buchung' && (BUCHUNG_FELDER as readonly unknown[]).includes(w.feld) && typeof w.seite === 'string' && /^[a-z]{1,4}-[a-z0-9-]{8,80}$/.test(w.seite)) {
    return { ok: true, weg: { art: 'buchung', seite: w.seite, feld: w.feld as BuchungFeld, stand }, wert: o.wert };
  }
  if (w.art === 'head' && (HEAD_FELDER as readonly unknown[]).includes(w.feld) && typeof w.head === 'string' && HEADS.has(w.head)) return { ok: true, weg: { art: 'head', head: w.head, feld: w.feld as HeadFeld, stand }, wert: o.wert };
  return { ok: false, fehler: 'Unbekannte Stellschraube — Scoring, Buchungsseite oder Business-Head.' };
}

/** Eine ganze Zahl in den Grenzen (rein) — sonst ein Satz. */
function ganz(v: unknown, min: number, max: number, name: string): { ok: true; n: number } | { ok: false; fehler: string } {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? { ok: true, n: v } : { ok: false, fehler: `${name}: ganze Zahl ${min}–${max.toLocaleString('de-DE')}.` };
}

/**
 * Weiterleiten. `person` = die angemeldete Person (aus dem Tor der Route, nie Dienstweg), `wer` fürs Änderungsprotokoll. Liefert einen Satz für die Karte —
 * die Werte liest die Karte danach neu (GET /api/prozesse/landkarte: EINE Wahrheit).
 */
export async function stellschraubeWeiter(b: unknown, o: { person: string; wer: Wer; jetzt?: Date }): Promise<WeiterErgebnis> {
  const a = weiterAnfrage(b);
  if (!a.ok) return nein(400, a.fehler);
  const { weg, wert } = a;

  if (weg.art === 'scoring') {
    const [{ scoringDateiLaden, scoringSchreiben, scoringStand }, { standardScoring, SCORING_GRENZEN }] = await Promise.all([import('@/lib/crm/scoring-server'), import('@/lib/crm/scoring')]);
    const d = await scoringDateiLaden();
    if (scoringStand(d.einstellungen) !== weg.stand) return nein(409, 'Die Scoring-Einstellungen wurden inzwischen geändert — bitte neu laden.');
    const st = standardScoring();
    const temp = weg.feld === 'lau' || weg.feld === 'warm' || weg.feld === 'heiss';
    const vorgabe = temp ? st.temperaturAb[weg.feld as 'lau' | 'warm' | 'heiss'] : st[weg.feld as 'marketing' | 'sales'].schwelle;
    const v = wert === null ? vorgabe : wert;
    const g = temp ? ganz(v, 1, 100, 'Temperatur') : ganz(v, 0, SCORING_GRENZEN.schwelleMax, weg.feld === 'marketing' ? 'MQL-Schwelle' : 'SQL-Schwelle');
    if (!g.ok) return nein(400, g.fehler);
    const e = d.einstellungen;
    const roh = temp
      ? { ...e, temperaturAb: { ...e.temperaturAb, [weg.feld]: g.n } }
      : { ...e, [weg.feld]: { ...e[weg.feld as 'marketing' | 'sales'], schwelle: g.n } };
    // Dieselbe Schreibstelle wie der Reiter Scoring: prüft den Stand in der Sperre noch einmal, `scoringPruefen` (lau < warm < heiß …) → 400 mit Satz.
    const r = await scoringSchreiben({ art: 'eigen', roh }, weg.stand, o.person, o.wer, (o.jetzt ?? new Date()).toISOString());
    if (r.ok) return { ok: true, text: wert === null ? 'Auf den Standard zurückgesetzt.' : 'Gespeichert — Leads, Runde und Heads rechnen sofort damit.' };
    if (r.art === 'konflikt') return nein(409, 'Die Scoring-Einstellungen wurden inzwischen geändert — bitte neu laden.');
    if (r.art === 'fehler') return nein(r.status, r.fehler.map(f => f.text).join(' · '));
    return nein(409, r.text);
  }

  if (weg.art === 'buchung') {
    const [{ ladeBuchungBestand }, { SEITE_ZAHLEN }, { seiteSpeichern }] = await Promise.all([
      import('@/lib/kalender/buchung-speicher'), import('@/lib/kalender/buchung'), import('@/lib/kalender/buchung-seite-server'),
    ]);
    const seite = (await ladeBuchungBestand(o.jetzt)).seiten.find(s => s.id === weg.seite);
    if (!seite) return nein(404, 'Buchungsseite nicht gefunden.');
    if (seite.geaendert !== weg.stand) return nein(409, 'Die Seite wurde inzwischen geändert — bitte neu laden.');
    let neuWert: number | boolean;
    if (weg.feld === 'aktiv') {
      if (wert !== null && typeof wert !== 'boolean') return nein(400, 'An / aus: ja oder nein.');
      neuWert = wert === null ? true : wert;
    } else {
      const z = SEITE_ZAHLEN[weg.feld];
      const NAME: Record<Exclude<BuchungFeld, 'aktiv'>, string> = { dauerMin: 'Dauer (Minuten)', vorlaufMin: 'Vorlauf (Minuten)', maxJeTag: 'Höchstens je Tag', pufferMin: 'Puffer (Minuten)' };
      const g = ganz(wert === null ? z.vorgabe : wert, z.min, z.max, NAME[weg.feld]);
      if (!g.ok) return nein(400, g.fehler);
      neuWert = g.n;
    }
    // Dieselbe Schreibstelle wie die Verwaltung der Buchungsseiten (Person im Haushalt, Stand in der Sperre, `seiteSauber`, Protokoll).
    const r = await seiteSpeichern({ ...seite, [weg.feld]: neuWert }, { stand: weg.stand, person: o.person, wer: o.wer, jetzt: o.jetzt });
    return r.ok ? { ok: true, text: wert === null ? 'Auf die Vorgabe zurückgesetzt.' : 'Gespeichert — die Seite zeigt ab jetzt die neuen Zeiten.' } : nein(r.status, r.fehler);
  }

  // Heads: die Agenten-Regler sind Inhaber-Dinge (CLAUDE.md Regel 7) — der Steckbrief zeigt sie anderen nur an.
  const { istInhaber } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await istInhaber(o.person))) return nein(403, 'Die Agenten-Regler der Heads ändert nur der Inhaber — ansehen kannst du sie.');
  let v: unknown = wert;
  if (weg.feld === 'budget') {
    // Euro in der Maske, Cent im Bestand (kaufmännisch gerundet; `einstellungAendern` prüft Grenze und Form noch einmal).
    if (wert !== null && (typeof wert !== 'number' || !Number.isFinite(wert) || wert < 0)) return nein(400, 'Budget je Monat: ein Betrag in Euro (oder leer = keine Grenze).');
    v = wert === null ? null : Math.round((wert as number) * 100);
  }
  const FELD: Record<HeadFeld, 'aktiv' | 'stufe' | 'budgetCentMonat' | 'autonomie'> = { aktiv: 'aktiv', stufe: 'stufe', budget: 'budgetCentMonat', autonomie: 'autonomie' };
  const { einstellungAendern } = await import('@/lib/agenten/einstellung');
  const r = await einstellungAendern(o.person, weg.head, { [FELD[weg.feld]]: v }, weg.stand);
  if (r.ok) return { ok: true, text: wert === null ? 'Auf die Vorgabe zurückgesetzt.' : r.felder.length ? 'Gespeichert — der Head arbeitet ab dem nächsten Lauf damit.' : 'Unverändert.' };
  return nein(r.status, r.fehler);
}

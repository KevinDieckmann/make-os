// ─── Prozesse · Werkstatt — ruhige Hinweise und der Probelauf (Etappe B2, 21.10.; ANALYSE_100.md Punkte 8, 23; Vertrag mit dem Lauf-Motor C1) ─────────────
// Hinweise sperren nie etwas (die Sperren sagen die Befunde der Prüfung, lib/prozesse/definition-pruefen.ts) — sie raten:
//   · Beschriftung nach Regel (Punkt 23): Verb + Gegenstand („Angebot senden“) statt eines Einzelworts; ein leerer Rauten-Ausgang ist eine Warnung (der Lauf
//     endet dort); die Ende-Form zeigt den Zustand („Mandat aktiv“) statt „Ende“.
//   · Wenige Schritte je Ebene (Punkt 8): ab `PROZESS_GRENZEN.schritteHinweis` Schritten in einer Phase „Teilprozess bilden?“ mit dem Umwandeln
//     (lib/prozesse/werkstatt-aktionen.ts `teilprozessBilden`) — nie hart gesperrt.
// Der Probelauf: POST /api/prozesse/probelauf (baut der Lauf-Motor, Etappe C1) — Körper `{ prozessId, quelle, fall? }`, Antwort je Knoten ein Status und ein Satz,
// dazu eine Kostenschätzung. Solange es die Route nicht gibt (404), sagt die Werkstatt „Probelauf kommt mit dem Lauf-Motor“ — nie ein Absturz.
// Rein und client-sicher; Tests: tests/prozesse-werkstatt-aktionen.test.ts.

import { PROZESS_GRENZEN, type ProzessForm, type ProzessKnoten } from './definition';
import { alleSchritte, phasen, schritteDer } from './fluss';
import type { Bedeutung } from '@/lib/make-one/design';

type K = ProzessKnoten<ProzessForm>;

export interface Rat { art: 'warnung' | 'rat'; text: string; knotenId?: string; phaseId?: string; aktion?: 'teilprozess' }

/** Zu allgemeine Namen eines Endes (die Ende-Form soll den Zustand nennen). */
const ENDE_ALLGEMEIN = /^(ende|fertig|ziel( erreicht)?|abbruch|übergabe|done|stop)$/i;
/** Formen, die kein Verb brauchen (Auslöser heißen nach ihrem Ereignis, ein Schloss heißt „Freigabe“). */
const OHNE_REGEL: ReadonlySet<ProzessForm> = new Set(['ausloeser', 'freigabe', 'ende']);

/** Die ruhigen Hinweise einer Fassung (rein) — je Knoten höchstens einer der Beschriftung, dazu Warnungen an leeren Rauten-Ausgängen und „Teilprozess bilden?“. */
export function hinweiseVon(d: { knoten: K[] }): Rat[] {
  const raus: Rat[] = [];
  for (const p of phasen(d)) {
    const n = schritteDer(d, p.id).length;
    if (n > PROZESS_GRENZEN.schritteHinweis) raus.push({ art: 'rat', text: `„${p.titel}“ hat ${n} Schritte — einen Teilprozess bilden? Ein Klick teilt die Phase an einer Stelle, an der kein Zweig quer liegt.`, phaseId: p.id, aktion: 'teilprozess' });
  }
  for (const { schritt: k } of alleSchritte(d)) {
    const f = k.form ?? 'schritt';
    // Werkstatt bau-fertig (Punkt 14): ausgeschaltete Schritte sind sichtbar, nie still.
    if (k.deaktiviert) raus.push({ art: 'rat', text: `„${k.titel}“ ist ausgeschaltet — der Lauf überspringt ihn${d.knoten.some(x => x.schloss?.fuer === k.id) ? ' (sein Freigabe-Schloss mit)' : ''}.`, knotenId: k.id });
    if (f === 'entscheidung' && !k.zweige?.nein) raus.push({ art: 'warnung', text: `„${k.titel}“: der Ausgang „nein“ führt noch nirgends hin — ein Lauf, der hier „nein“ bekommt, endet.`, knotenId: k.id });
    if (f === 'ende' && ENDE_ALLGEMEIN.test(k.titel.trim())) raus.push({ art: 'rat', text: `„${k.titel}“: das Ende zeigt den Zustand, z. B. „Mandat aktiv“ oder „Lead verloren (mit Grund)“.`, knotenId: k.id });
    else if (!OHNE_REGEL.has(f) && !/\s/.test(k.titel.trim())) raus.push({ art: 'rat', text: `„${k.titel}“: besser Verb + Gegenstand, z. B. „Angebot senden“.`, knotenId: k.id });
  }
  return raus;
}

// ── Probelauf (Vertrag mit C1) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const PROBELAUF_PFAD = '/api/prozesse/probelauf';
export type ProbeStatus = 'wuerde' | 'uebersprungen' | 'wartet' | 'freigabe' | 'fehler';
export const PROBE_STATUS = ['wuerde', 'uebersprungen', 'wartet', 'freigabe', 'fehler'] as const satisfies readonly ProbeStatus[];
/** Was ein Schritt täte (Werkstatt bau-fertig, Punkt 10): Tabelle für Menschen, JSON nur mit Kennungen. */
export interface ProbeAusgabeAnsicht { zeilen: { feld: string; wert: string }[]; json: Record<string, string | number | boolean | null> }
export interface ProbeSchritt { knotenId: string; status: ProbeStatus; text: string; kostenCent?: number; ausgabe?: ProbeAusgabeAnsicht }
export interface ProbeErgebnis { schritte: ProbeSchritt[]; kostenSchaetzungCent: number; /** Der Schritt von „bis hier“ bzw. „nur diesen“ wurde auf dem Weg nicht erreicht. */ hinweis?: 'bis-nicht-erreicht' | 'nur-nicht-erreichbar' }
export type ProbeQuelle = 'entwurf' | 'version';
export type ProbeFall = { art: string; id: string } | 'beispiel';

/** Wie ein Status heißt und welche Bedeutung (Farbe nie allein — Symbol und Wort): würde laufen grün, wartet/Freigabe gelb, übersprungen grau, Fehler rot. */
export const PROBE_NAME: Readonly<Record<ProbeStatus, string>> = { wuerde: 'würde laufen', uebersprungen: 'übersprungen', wartet: 'wartet', freigabe: 'braucht Freigabe', fehler: 'Fehler' };
export const PROBE_BEDEUTUNG: Readonly<Record<ProbeStatus, Bedeutung>> = { wuerde: 'gut', uebersprungen: 'neutral', wartet: 'achtung', freigabe: 'achtung', fehler: 'kritisch' };
export const PROBE_FEHLT = 'Probelauf kommt mit dem Lauf-Motor.';

/** Der Körper des Probelaufs; seit 22.10. (bau-fertig) mit „Weg annehmen“, „nur diesen Schritt“ / „bis hier“ und der Ausgabe als Tabelle. */
export const probelaufKoerper = (prozessId: string, quelle: ProbeQuelle, fall: ProbeFall = 'beispiel', o: { annahmen?: Readonly<Record<string, string>>; nur?: string; bis?: string; ausgabe?: boolean } = {}) =>
  ({ prozessId, quelle, fall, ...(o.annahmen ? { annahmen: o.annahmen } : {}), ...(o.nur ? { nur: o.nur } : {}), ...(o.bis ? { bis: o.bis } : {}), ...(o.ausgabe ? { ausgabe: true } : {}) });
const ausgabeAus = (v: unknown): ProbeAusgabeAnsicht | undefined => {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null;
  if (!o || !Array.isArray(o.zeilen)) return undefined;
  const zeilen = o.zeilen.flatMap((z: unknown) => { const x = z && typeof z === 'object' ? z as Record<string, unknown> : null; return x && typeof x.feld === 'string' && typeof x.wert === 'string' ? [{ feld: x.feld, wert: x.wert }] : []; });
  const json: ProbeAusgabeAnsicht['json'] = {};
  for (const [k, w] of Object.entries(o.json && typeof o.json === 'object' ? o.json as Record<string, unknown> : {})) if (w === null || ['string', 'number', 'boolean'].includes(typeof w)) json[k] = w as string | number | boolean | null;
  return { zeilen, json };
};

/** Die Antwort lesen (rein): 404 = den Lauf-Motor gibt es noch nicht; sonst Schritte (unbekannte Status fallen weg) oder ein Fehlersatz. */
export function probelaufAus(status: number, roh: unknown): { art: 'ergebnis'; ergebnis: ProbeErgebnis } | { art: 'fehlt' } | { art: 'fehler'; text: string } {
  if (status === 404) return { art: 'fehlt' };
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  if (status < 200 || status >= 300) return { art: 'fehler', text: typeof o.fehler === 'string' ? o.fehler : 'Der Probelauf ließ sich nicht starten.' };
  const schritte: ProbeSchritt[] = (Array.isArray(o.schritte) ? o.schritte : []).flatMap((s: unknown) => {
    const x = s && typeof s === 'object' ? s as Record<string, unknown> : null;
    if (!x || typeof x.knotenId !== 'string' || !(PROBE_STATUS as readonly string[]).includes(x.status as string)) return [];
    const ausgabe = ausgabeAus(x.ausgabe);
    return [{ knotenId: x.knotenId, status: x.status as ProbeStatus, text: typeof x.text === 'string' ? x.text : '', ...(typeof x.kostenCent === 'number' ? { kostenCent: x.kostenCent } : {}), ...(ausgabe ? { ausgabe } : {}) }];
  });
  const hinweis = o.hinweis === 'bis-nicht-erreicht' || o.hinweis === 'nur-nicht-erreichbar' ? o.hinweis : undefined;
  return { art: 'ergebnis', ergebnis: { schritte, kostenSchaetzungCent: typeof o.kostenSchaetzungCent === 'number' ? o.kostenSchaetzungCent : 0, ...(hinweis ? { hinweis } : {}) } };
}
/** Cent als Betrag („0,42 €“). */
export const centText = (c: number) => `${(Math.max(0, c) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

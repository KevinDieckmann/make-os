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
export function hinweiseVon(d: { knoten: readonly K[] }): Rat[] {
  const raus: Rat[] = [];
  for (const p of phasen(d)) {
    const n = schritteDer(d, p.id).length;
    if (n > PROZESS_GRENZEN.schritteHinweis) raus.push({ art: 'rat', text: `„${p.titel}“ hat ${n} Schritte — einen Teilprozess bilden? Ein Klick teilt die Phase an einer Stelle, an der kein Zweig quer liegt.`, phaseId: p.id, aktion: 'teilprozess' });
  }
  for (const { schritt: k } of alleSchritte(d)) {
    const f = k.form ?? 'schritt';
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
export interface ProbeSchritt { knotenId: string; status: ProbeStatus; text: string; kostenCent?: number }
export interface ProbeErgebnis { schritte: ProbeSchritt[]; kostenSchaetzungCent: number }
export type ProbeQuelle = 'entwurf' | 'version';
export type ProbeFall = { art: string; id: string } | 'beispiel';

/** Wie ein Status heißt und welche Bedeutung (Farbe nie allein — Symbol und Wort): würde laufen grün, wartet/Freigabe gelb, übersprungen grau, Fehler rot. */
export const PROBE_NAME: Readonly<Record<ProbeStatus, string>> = { wuerde: 'würde laufen', uebersprungen: 'übersprungen', wartet: 'wartet', freigabe: 'braucht Freigabe', fehler: 'Fehler' };
export const PROBE_BEDEUTUNG: Readonly<Record<ProbeStatus, Bedeutung>> = { wuerde: 'gut', uebersprungen: 'neutral', wartet: 'achtung', freigabe: 'achtung', fehler: 'kritisch' };
export const PROBE_FEHLT = 'Probelauf kommt mit dem Lauf-Motor.';

export const probelaufKoerper = (prozessId: string, quelle: ProbeQuelle, fall: ProbeFall = 'beispiel') => ({ prozessId, quelle, fall });

/** Die Antwort lesen (rein): 404 = den Lauf-Motor gibt es noch nicht; sonst Schritte (unbekannte Status fallen weg) oder ein Fehlersatz. */
export function probelaufAus(status: number, roh: unknown): { art: 'ergebnis'; ergebnis: ProbeErgebnis } | { art: 'fehlt' } | { art: 'fehler'; text: string } {
  if (status === 404) return { art: 'fehlt' };
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  if (status < 200 || status >= 300) return { art: 'fehler', text: typeof o.fehler === 'string' ? o.fehler : 'Der Probelauf ließ sich nicht starten.' };
  const schritte: ProbeSchritt[] = (Array.isArray(o.schritte) ? o.schritte : []).flatMap((s: unknown) => {
    const x = s && typeof s === 'object' ? s as Record<string, unknown> : null;
    if (!x || typeof x.knotenId !== 'string' || !(PROBE_STATUS as readonly string[]).includes(x.status as string)) return [];
    return [{ knotenId: x.knotenId, status: x.status as ProbeStatus, text: typeof x.text === 'string' ? x.text : '', ...(typeof x.kostenCent === 'number' ? { kostenCent: x.kostenCent } : {}) }];
  });
  return { art: 'ergebnis', ergebnis: { schritte, kostenSchaetzungCent: typeof o.kostenSchaetzungCent === 'number' ? o.kostenSchaetzungCent : 0 } };
}
/** Cent als Betrag („0,42 €“). */
export const centText = (c: number) => `${(Math.max(0, c) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// ─── Prozesse · Werkstatt — Läufe, Tests, Scharfschalten: die reinen Regeln der Ansicht (22.10.; ANALYSE_100.md Punkte 29, 48, 49, 59, 69) ─────────────
// Kevins Bild (n8n „Executions“, 21.10.): Reiter Bauen · Läufe · Tests auf DEMSELBEN Bild. Ein Lauf öffnet denselben Plan, jeder Knoten mit seinem Stand (grün
// gelaufen, gelb wartet — „wartet auf dich“ pulsiert mit Frist —, rot Fehler, grau nicht erreicht), der Lichtfaden leuchtet den echten Weg; darunter der Log-Baum.
// Gespeichert sind nur Kennungen — die Inhalte holt die Ansicht beim Öffnen live mit den Rechten der Person (lib/prozesse/lauf-server.ts `laufInhalte`).
// Hier steht, was die Oberfläche daraus macht: Marken je Knoten, der Weg als Kanten, die Zeilen des Log-Baums, der Zustand des Prozesses (Entwurf · Probelauf ·
// scharf · pausiert), die Aufschlüsselung der Kosten im Scharf-Dialog, der Vergleich der Testfälle, die Tageszeile auf Heute und die Fall-Suche des Probelaufs.
// Rein und client-sicher (Wächter tests/prozesse-lauf-client.test.ts) — keine Bestände, keine Namen (die kommen live vom Server).

import type { Bedeutung } from '@/lib/make-one/design';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import { suchPasst } from '@/lib/text/such-norm';
import type { FallArt, ProzessDefinition, ProzessForm, ProzessKnoten, ProzessStatus } from './definition';
import { alleSchritte } from './fluss';
import {
  GRUND_TEXT, type LaufFall, type LaufGrund, type LaufSchritt, type LaufStatus, type LaufWarten, type ProzessLaufStand, type SchrittStatus, type Testfall, type TestStatus, type Wirkung,
} from './lauf-typen';

type K = ProzessKnoten<ProzessForm>;

// ══ Zustand des Prozesses in der Kopfzeile (Entwurf · Probelauf · scharf · pausiert) ══════════════════════════════════════════════════════════════

export type WerkstattZustand = 'entwurf' | 'probelauf' | 'scharf' | 'pausiert' | 'archiviert';
export const ZUSTAND_NAME: Readonly<Record<WerkstattZustand, string>> = { entwurf: 'Entwurf', probelauf: 'Probelauf', scharf: 'scharf', pausiert: 'pausiert', archiviert: 'archiviert' };
export const ZUSTAND_BEDEUTUNG: Readonly<Record<WerkstattZustand, Bedeutung>> = { entwurf: 'neutral', probelauf: 'info', scharf: 'gut', pausiert: 'achtung', archiviert: 'neutral' };
/** Was man aus einem Zustand heraus tun kann (Knöpfe der Kopfzeile). */
export type ZustandAktion = 'schatten' | 'scharf' | 'pausieren' | 'fortsetzen';

/**
 * Der Zustand (rein): „scharf“ nur, wenn der Prozess aktiv ist UND über „scharf schalten“ ging (sonst läuft er im Schatten = Probelauf — so rechnet der Motor,
 * lib/prozesse/lauf-server.ts `modusFuer`); „pausiert“ von Hand bzw. selbst (Budget, Notbremse — der Grund steht im Laufzeit-Stand).
 */
export function werkstattZustand(status: ProzessStatus, st: Pick<ProzessLaufStand, 'einstellung' | 'pause'> | null | undefined, hatVersion: boolean): { art: WerkstattZustand; satz: string; aktionen: ZustandAktion[] } {
  const scharf = !!st?.einstellung.scharf;
  switch (status) {
    case 'archiviert': return { art: 'archiviert', satz: 'Archiviert — läuft nicht mehr.', aktionen: [] };
    case 'pausiert': return {
      art: 'pausiert', aktionen: ['fortsetzen'],
      satz: st?.pause?.grund === 'budget' ? 'Pausiert: das Monatsbudget ist erreicht — erst das Budget anheben, dann fortsetzen.'
        : st?.pause?.grund === 'notbremse' ? 'Pausiert: Notbremse — zu viele Wirkungen in einer Stunde. Prüfen, dann fortsetzen.'
          : 'Pausiert — offene Läufe halten an und gehen nach dem Fortsetzen genau dort weiter.',
    };
    case 'aktiv': return scharf
      ? { art: 'scharf', satz: 'Scharf — Läufe legen echte Aufgaben und Vorschläge an. Nach außen geht nur, was ihr freigebt.', aktionen: ['pausieren'] }
      : { art: 'probelauf', satz: 'Aktiv im Schatten — Läufe rechnen den Weg mit echten Fällen und schreiben nichts. Erst „Scharf schalten“ macht sie wirksam.', aktionen: ['scharf', 'pausieren'] };
    case 'probelauf': return { art: 'probelauf', satz: 'Probelauf — Läufe rechnen im Schatten und schreiben nichts.', aktionen: ['scharf', 'pausieren'] };
    default: return hatVersion
      ? { art: 'entwurf', satz: 'Veröffentlicht, läuft aber noch nicht — erst im Schatten laufen lassen oder gleich scharf schalten.', aktionen: ['schatten', 'scharf'] }
      : { art: 'entwurf', satz: 'Entwurf — erst veröffentlichen, dann laufen lassen.', aktionen: [] };
  }
}
/** Fortsetzen: ein scharf geschalteter Prozess wird wieder aktiv (scharf), sonst läuft er weiter im Schatten. */
export const fortsetzenStatus = (st: Pick<ProzessLaufStand, 'einstellung'> | null | undefined): ProzessStatus => (st?.einstellung.scharf ? 'aktiv' : 'probelauf');

// ══ Lauf: Status, Marken je Knoten, der echte Weg ═════════════════════════════════════════════════════════════════════════════════════════════════

export const LAUF_STATUS_NAME: Readonly<Record<LaufStatus, string>> = { laeuft: 'läuft', wartet: 'wartet', angehalten: 'angehalten', fehler: 'Fehler', fertig: 'fertig', abgebrochen: 'abgebrochen' };
export const LAUF_STATUS_BEDEUTUNG: Readonly<Record<LaufStatus, Bedeutung>> = { laeuft: 'info', wartet: 'achtung', angehalten: 'neutral', fehler: 'kritisch', fertig: 'gut', abgebrochen: 'neutral' };
export const SCHRITT_NAME: Readonly<Record<SchrittStatus, string>> = {
  laeuft: 'läuft', wartet: 'wartet', erledigt: 'gelaufen', uebersprungen: 'übersprungen', fehler: 'Fehler', abgelaufen: 'abgelaufen', abgebrochen: 'abgebrochen', wuerde: 'würde laufen', freigabe: 'hätte Freigabe gebraucht',
};

/** Die Stufe einer Marke am Knoten (Farbe nie allein — dazu Symbol und Wort). Nicht erreichte Knoten haben keine Marke (grau). */
export type MarkenStufe = 'gelaufen' | 'laeuft' | 'wartet' | 'fehler' | 'uebersprungen' | 'abgebrochen';
export const MARKEN_BEDEUTUNG: Readonly<Record<MarkenStufe, Bedeutung>> = { gelaufen: 'gut', laeuft: 'info', wartet: 'achtung', fehler: 'kritisch', uebersprungen: 'neutral', abgebrochen: 'neutral' };
export interface LaufMarke { stufe: MarkenStufe; name: string; /** „wartet auf dich“ — pulsiert (still bei reduzierter Bewegung). */ puls: boolean; frist?: string }

const STUFE: Readonly<Record<SchrittStatus, MarkenStufe>> = {
  erledigt: 'gelaufen', wuerde: 'gelaufen', laeuft: 'laeuft', wartet: 'wartet', freigabe: 'wartet', abgelaufen: 'wartet', fehler: 'fehler', uebersprungen: 'uebersprungen', abgebrochen: 'abgebrochen',
};
/** Ein Tag als „24.10., 14:30“ (Berliner Zeit). */
export const zeitText = (iso: string | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : iso;
};

/**
 * Je Knoten die Marke (rein; der jüngste Besuch zählt). `fuerMich(wirkungId)` = die Aufgabe bzw. der Vorschlag, auf die der Lauf wartet, liegt bei der Person
 * der Ansicht (live vom Server) — dann „wartet auf dich“, pulsierend, mit Frist.
 */
export function laufMarken(l: { schritte: readonly LaufSchritt[]; status: LaufStatus; wartet?: LaufWarten }, fuerMich: (wirkungId: string) => boolean = () => false): Map<string, LaufMarke> {
  const m = new Map<string, LaufMarke>();
  for (const s of l.schritte) m.set(s.knoten, { stufe: STUFE[s.status], name: SCHRITT_NAME[s.status], puls: false });
  const w = l.status === 'wartet' ? l.wartet : undefined;
  if (w && m.has(w.knoten)) {
    const mir = !!w.wirkung && (w.art === 'aufgabe' || w.art === 'freigabe') && fuerMich(w.wirkung);
    const art = w.art === 'freigabe' ? 'Freigabe' : w.art === 'aufgabe' ? 'Aufgabe' : w.art === 'teilprozess' ? 'Teilprozess' : w.art === 'fenster' ? 'Takt-Fenster' : w.art === 'fehler' ? 'neuen Versuch' : w.art === 'ereignis' ? 'Ereignis' : 'Zeit';
    m.set(w.knoten, { stufe: 'wartet', name: mir ? 'wartet auf dich' : `wartet auf ${art}`, puls: mir, ...(w.bis ? { frist: w.bis } : {}) });
  }
  return m;
}

/** Der echte Weg als Kanten `<von>><nach>` (rein): zwei aufeinanderfolgende Besuche, der erste verlassen (mit Ausgang). Dieselbe Form wie die Kanten-Kennung der Lage ohne Ausgang. */
export function laufWeg(schritte: readonly Pick<LaufSchritt, 'knoten' | 'ausgang' | 'bis'>[]): Set<string> {
  const raus = new Set<string>();
  for (let i = 0; i + 1 < schritte.length; i++) {
    const a = schritte[i], b = schritte[i + 1];
    if (a.knoten !== b.knoten && (a.ausgang || a.bis)) raus.add(`${a.knoten}>${b.knoten}`);
  }
  return raus;
}
/** Liegt eine Kante der Lage (`id` = `<von>><nach>:<ausgang>`) auf dem Weg? */
export const kanteAufWeg = (weg: ReadonlySet<string>, k: { von: string; nach: string | null }): boolean => !!k.nach && weg.has(`${k.von}>${k.nach}`);

// ══ Log-Baum (Schritte in Reihenfolge, je Phase; Agenten-Schritte mit Modell, Dauer, Tokens, Kosten) ═══════════════════════════════════════════════

export interface LogZeile {
  nr: number; knotenId: string; titel: string; form: ProzessForm; status: SchrittStatus; stufe: MarkenStufe; ab: string; bis?: string; dauer: string;
  runde?: number; versuch?: number; grund?: string; kostenCent?: number; modell?: string; token?: { ein: number; aus: number }; kopf?: string; wirkung: Wirkung[];
  /** CRM-Abfrage bzw. Schleife (22.10. spät): „3 Treffer · 1 übrig · 2 schon versorgt“ bzw. „2 Teil-Läufe · 1 übrig“ — nur Zahlen. */
  zahlen?: string;
}
export interface LogGruppe { phaseId: string; titel: string; zeilen: LogZeile[] }

/** Eine Dauer als Wort (rein): „unter 1 s“, „12 s“, „3 min“, „2 h 5 min“, „3 T 4 h“. */
export function dauerText(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return 'unter 1 s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), rm = min % 60;
  if (h < 24) return rm ? `${h} h ${rm} min` : `${h} h`;
  const t = Math.floor(h / 24), rh = h % 24;
  return rh ? `${t} T ${rh} h` : `${t} T`;
}

/** Die Zahlen einer CRM-Abfrage bzw. Schleife als kurzer Satz (rein) — null ohne Zahlen. */
function zahlenText(s: Pick<LaufSchritt, 'anzahl' | 'rest' | 'uebersprungen'>, k: Pick<K, 'form' | 'abfrage'> | undefined): string | null {
  if (s.anzahl === undefined) return null;
  const was = k?.form === 'schleife' ? `${s.anzahl} ${s.anzahl === 1 ? 'Teil-Lauf' : 'Teil-Läufe'}` : `${s.anzahl} Treffer`;
  return [was, s.rest ? `${s.rest} übrig für den nächsten Lauf` : '', s.uebersprungen ? `${s.uebersprungen} schon versorgt` : ''].filter(Boolean).join(' · ');
}

/**
 * Der Log-Baum (rein): die besuchten Knoten in Reihenfolge, gruppiert nach aufeinanderfolgenden Phasen; beim Agenten-Schritt Modell (das gefragte, sonst die
 * Stufe aus der Version) und Tokens. Knoten, die es in der Version nicht (mehr) gibt, stehen mit ihrer Kennung da — nichts fällt still weg.
 */
export function laufLog(schritte: readonly LaufSchritt[], def: Pick<ProzessDefinition, 'knoten'>, jetzt: string): LogGruppe[] {
  const phaseVon = new Map(alleSchritte(def).map(x => [x.schritt.id, x.phase]));
  const nach = new Map(def.knoten.map(k => [k.id, k]));
  const raus: LogGruppe[] = [];
  schritte.forEach((s, i) => {
    const k = nach.get(s.knoten) as K | undefined;
    const ph = phaseVon.get(s.knoten);
    const z: LogZeile = {
      nr: i + 1, knotenId: s.knoten, titel: k?.titel ?? s.knoten, form: k?.form ?? 'schritt', status: s.status, stufe: STUFE[s.status], ab: s.ab, ...(s.bis ? { bis: s.bis } : {}),
      dauer: dauerText(Date.parse(s.bis ?? jetzt) - Date.parse(s.ab)), ...(s.runde ? { runde: s.runde } : {}), ...(s.versuch ? { versuch: s.versuch } : {}),
      ...(s.grund ? { grund: GRUND_TEXT[s.grund as LaufGrund] ?? s.grund } : {}), ...(s.kostenCent ? { kostenCent: Math.round(s.kostenCent) } : {}),
      ...(k?.form === 'agent' ? { modell: s.modell ?? k.agent?.modellWahl?.modell ?? k.agent?.modell } : {}), ...(s.token ? { token: s.token } : {}), ...(s.kopf ? { kopf: s.kopf } : {}),
      wirkung: s.wirkung ?? [], ...(zahlenText(s, k) ? { zahlen: zahlenText(s, k)! } : {}),
    };
    const letzte = raus.at(-1);
    const id = ph?.id ?? '—';
    if (letzte && letzte.phaseId === id) letzte.zeilen.push(z);
    else raus.push({ phaseId: id, titel: ph?.titel ?? 'ohne Phase', zeilen: [z] });
  });
  return raus;
}

// ══ Lauf-Liste (Status, Startzeit, Dauer, Version, Kosten) ═══════════════════════════════════════════════════════════════════════════════════════

export type LaufFilter = 'alle' | 'offen' | 'wartet' | 'fehler' | 'fertig';
export const LAUF_FILTER: readonly { id: LaufFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'offen', label: 'Offen' }, { id: 'wartet', label: 'Wartet' }, { id: 'fehler', label: 'Fehler' }, { id: 'fertig', label: 'Beendet' },
];
export function laufFiltern<T extends { status: LaufStatus }>(l: readonly T[], f: LaufFilter): T[] {
  if (f === 'alle') return [...l];
  if (f === 'offen') return l.filter(x => x.status === 'laeuft' || x.status === 'wartet' || x.status === 'angehalten' || x.status === 'fehler');
  if (f === 'fertig') return l.filter(x => x.status === 'fertig' || x.status === 'abgebrochen');
  return l.filter(x => x.status === f);
}
/** Cent als Betrag („0,42 €“; unter einem Cent „< 0,01 €“). */
export const centWort = (c: number | undefined): string => (!c ? '—' : c < 1 ? '< 0,01 €' : `${(c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
export const dauerMinText = (min: number): string => dauerText(min * 60_000);

// ══ Scharf schalten: Kosten aufgeschlüsselt, Budget-Vorschlag, die Rückfrage ═══════════════════════════════════════════════════════════════════════

export const STUFE_NAME: Readonly<Record<string, string>> = { schnell: 'schnell', ausgewogen: 'ausgewogen', stark: 'stark' };
/** „Läufe × Agenten-Schritte × Modellstufe“ als Zeilen (rein). */
export function kostenZeilen(laeufeJeMonat: number, stufen: readonly { stufe: string; schritte: number; centJeSchritt: number }[]): { text: string; centMonat: number }[] {
  return stufen.map(s => ({
    text: `${laeufeJeMonat} ${laeufeJeMonat === 1 ? 'Lauf' : 'Läufe'} × ${s.schritte} ${s.schritte === 1 ? 'Agenten-Schritt' : 'Agenten-Schritte'} × Stufe „${STUFE_NAME[s.stufe] ?? s.stufe}“ (${centWort(s.centJeSchritt)} je Schritt)`,
    centMonat: Math.round(laeufeJeMonat * s.schritte * s.centJeSchritt),
  }));
}
/** Budget-Vorschlag je Monat (Cent): ohne Agenten-Schritte 0; sonst das Anderthalbfache der Schätzung, auf ganze Euro gerundet, mindestens 1 €. */
export function budgetVorschlag(schaetzungCent: number, agentenSchritte: number): number {
  if (!agentenSchritte) return 0;
  return Math.max(100, Math.ceil((schaetzungCent * 1.5) / 100) * 100);
}
/** Euro-Eingabe („12,50“) → Cent; ungültig → null. */
export function euroZuCent(t: string): number | null {
  const s = t.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!s) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
export const centZuEuro = (c: number): string => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

// ══ Testfälle: Vergleich (grün = gleiche Folge; was sich geändert hat) ═════════════════════════════════════════════════════════════════════════════

export interface TestVergleich {
  ok: boolean;
  /** Jetzt besucht, vorher nicht. */
  neu: string[];
  /** Vorher besucht, jetzt nicht. */
  weg: string[];
  anders: { knotenId: string; vorher: TestStatus; nachher: TestStatus }[];
  /** Gleiche Knoten mit gleichem Status, aber eine andere Reihenfolge. */
  reihenfolge: boolean;
}
type Folge = readonly { knotenId: string; status: TestStatus }[];
const letzterStatus = (f: Folge) => { const m = new Map<string, TestStatus>(); for (const x of f) m.set(x.knotenId, x.status); return m; };

export function testVergleich(erwartet: Folge, ist: Folge): TestVergleich {
  const a = letzterStatus(erwartet), b = letzterStatus(ist);
  const neu = [...b.keys()].filter(k => !a.has(k));
  const weg = [...a.keys()].filter(k => !b.has(k));
  const anders = [...a.entries()].filter(([k, s]) => b.has(k) && b.get(k) !== s).map(([knotenId, vorher]) => ({ knotenId, vorher, nachher: b.get(knotenId)! }));
  const gleich = erwartet.length === ist.length && erwartet.every((x, i) => x.knotenId === ist[i].knotenId && x.status === ist[i].status);
  return { ok: gleich, neu, weg, anders, reihenfolge: !gleich && !neu.length && !weg.length && !anders.length };
}
const TEST_WORT: Readonly<Record<TestStatus, string>> = { wuerde: 'läuft', uebersprungen: 'übersprungen', wartet: 'wartet', freigabe: 'Freigabe', fehler: 'Fehler' };
/** Was sich geändert hat, in Sätzen (rein) — Titel aus der Fassung, sonst die Kennung. */
export function testUnterschiede(v: TestVergleich, titel: (knotenId: string) => string): string[] {
  if (v.ok) return [];
  const raus: string[] = [];
  if (v.neu.length) raus.push(`neu auf dem Weg: ${v.neu.map(k => `„${titel(k)}“`).join(', ')}`);
  if (v.weg.length) raus.push(`nicht mehr erreicht: ${v.weg.map(k => `„${titel(k)}“`).join(', ')}`);
  for (const x of v.anders) raus.push(`„${titel(x.knotenId)}“: ${TEST_WORT[x.vorher]} → ${TEST_WORT[x.nachher]}`);
  if (v.reihenfolge) raus.push('dieselben Schritte, andere Reihenfolge');
  return raus;
}
/** „Testfall 3 · Beispiel“ bzw. „Testfall 3 · Deal“ (der Name entsteht nie aus Freitext). */
export const testfallName = (t: Pick<Testfall, 'nr' | 'fall'>, fallName?: string): string => `Testfall ${t.nr} · ${t.fall === 'beispiel' ? 'Beispiel-Fall' : fallName ?? FALL_WORT[t.fall.art]}`;
/** Zusammenfassung für den Veröffentlichen-Dialog: „3 von 3 grün“ bzw. null ohne Testfälle. */
export function testStand(ergebnisse: readonly { ok: boolean }[] | null | undefined, anzahl: number): { satz: string; bedeutung: Bedeutung } | null {
  if (!anzahl) return null;
  if (!ergebnisse) return { satz: `${anzahl} ${anzahl === 1 ? 'Testfall' : 'Testfälle'} — noch nicht geprüft`, bedeutung: 'info' };
  const gruen = ergebnisse.filter(e => e.ok).length;
  return { satz: `Testfälle: ${gruen} von ${ergebnisse.length} grün`, bedeutung: gruen === ergebnisse.length ? 'gut' : 'achtung' };
}

// ══ Heute (Punkt 69): „Prozesse heute: n gelaufen, m warten auf dich“ ═══════════════════════════════════════════════════════════════════════════

/** Die Tageszeile (rein) — ohne Lauf und ohne Wartendes keine Zeile (nie eine Null). */
export function heuteSatz(h: { gelaufen: number; aufDich: number } | null | undefined): string | null {
  if (!h || (!h.gelaufen && !h.aufDich)) return null;
  const teile = [
    ...(h.gelaufen ? [`${h.gelaufen} gelaufen`] : []),
    ...(h.aufDich ? [`${h.aufDich} ${h.aufDich === 1 ? 'wartet' : 'warten'} auf dich`] : []),
  ];
  return `Prozesse heute: ${teile.join(', ')}`;
}

// ══ Probelauf mit echtem Fall: Suche über die schlanken Verweise (GET /api/aufgaben/crm — Art. 18 fehlt dort schon) ═══════════════════════════════

export const FALL_WORT: Readonly<Record<FallArt, string>> = { lead: 'Lead', deal: 'Deal', mandat: 'Mandat', event: 'Event', firma: 'Firma', kampagne: 'Kampagne', keiner: 'ohne Fall' };
export interface FallTreffer { art: FallArt; id: string; name: string; unter?: string }
/** Welche Fall-Arten sich über die Verweise suchen lassen (Events und Kampagnen nur mit dem Beispiel). */
export const FALL_SUCHBAR: ReadonlySet<FallArt> = new Set(['lead', 'deal', 'mandat', 'firma']);

/** Treffer für eine Fall-Art (rein): Deal → Deals, Mandat → Mandate, Firma → Firmen, Lead → Firmen und Personen (ein Lead ist eine Firma bzw. eine Person). */
export function fallTreffer(v: CrmVerweise | null | undefined, art: FallArt, frage: string, max = 8): FallTreffer[] {
  if (!v || !FALL_SUCHBAR.has(art)) return [];
  const q = frage.trim();
  const passt = (felder: (string | undefined)[]) => !q || suchPasst(felder.filter((x): x is string => !!x), q);
  const raus: FallTreffer[] = [];
  if (art === 'deal') raus.push(...v.deals.filter(d => passt([d.titel, d.firma])).map(d => ({ art, id: d.id, name: d.titel, ...(d.firma ? { unter: d.firma } : {}) })));
  if (art === 'mandat') raus.push(...v.mandate.filter(m => passt([m.titel, m.kunde])).map(m => ({ art, id: m.id, name: m.titel, unter: m.kunde })));
  if (art === 'firma' || art === 'lead') raus.push(...v.firmen.filter(f => passt([f.name])).map(f => ({ art, id: f.id, name: f.name })));
  if (art === 'lead') raus.push(...v.kontakte.filter(k => passt([k.name, k.firma])).map(k => ({ art, id: k.id, name: k.name, ...(k.firma ? { unter: k.firma } : {}) })));
  return raus.slice(0, max);
}
/** Der Name eines Falls aus den Verweisen (rein) — fehlt er (gelöscht, Art. 18, keine Sicht), die Art. */
export function fallName(v: CrmVerweise | null | undefined, f: LaufFall | 'beispiel'): string {
  if (f === 'beispiel') return 'Beispiel-Fall';
  if (f.art === 'keiner' || !f.id) return 'ohne Fall';
  const n = v && (f.art === 'deal' ? v.deals.find(d => d.id === f.id)?.titel
    : f.art === 'mandat' ? v.mandate.find(m => m.id === f.id)?.titel
      : f.art === 'firma' || f.art === 'lead' ? v.firmen.find(x => x.id === f.id)?.name ?? (f.art === 'lead' ? v.kontakte.find(k => k.id === f.id)?.name : undefined) : undefined);
  return n ?? FALL_WORT[f.art];
}

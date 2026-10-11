// ─── Fulfillment — reine Regeln (C0, 10.10.; FULFILLMENT_KONZEPT.md 2.2/2.3, 3.1, 5.4/5.5, 7.4, 8.1) ──────────────────────────────────
// EINE Stelle für: Ebenen und Teilbäume (Vorlage und Fall), Kreise, Fortschritt, aktueller Knoten, „wartet auf euch“, Wert-Konto-Zeilen,
// Puls-Stufe, Mandatsende, Zeitpunkt der Unterschrift, Onboarding-Kandidaten und „welcher Kunde steht wo“. Server UND Browser rechnen nur
// hiermit (Komponenten zeichnen, sie rechnen nicht — 6.1). Rein, client-sicher, deterministisch. Tests: tests/fulfillment-fundament.test.ts.
//
// Ebenen: ein Knoten ohne `elternId` (bzw. mit unbekanntem Eltern) ist Ebene 1 (Gesamtprozess); jede Stufe der Kette zählt eins dazu.
// Höchstens `EBENEN_MAX` (5). Ein Kreis hat keine Ebene (`KREIS` = -1) — der Schreibweg lehnt ihn mit 400 ab (`kreisBei`).

import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { tagVon } from '@/lib/zeit';
import { mandatZieleLesen } from '@/lib/crm/mandat-ziele';
import type {
  Fall, FallKnoten, KnotenStatus, OnboardingKandidat, ProzessVorlage, Unterschrift, WartetPunkt, WertKontoZeile,
} from './typen';

export const EBENEN_MAX = 5;
export const KREIS = -1;
/** Knoten, die als abgeschlossen gelten (erledigt oder bewusst entfallen). */
const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);

type Knotenartig = { id: string; elternId?: string; rang: number };

const nachRang = <T extends Knotenartig>(a: T, b: T) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Direkte Kinder eines Knotens (bzw. die Wurzeln bei `undefined`) in Rang-Reihenfolge. Ein unbekannter Elternteil zählt als Wurzel. */
export function kinderVon<T extends Knotenartig>(elternId: string | undefined, liste: readonly T[]): T[] {
  const ids = new Set(liste.map(k => k.id));
  return liste.filter(k => (elternId === undefined ? !k.elternId || !ids.has(k.elternId) : k.elternId === elternId && k.id !== elternId)).sort(nachRang);
}

/** Die Vorfahren eines Knotens, der nächste zuerst — bricht bei einem Kreis ab. */
export function vorfahren<T extends Knotenartig>(id: string, liste: readonly T[]): string[] {
  const nach = new Map(liste.map(k => [k.id, k]));
  const raus: string[] = [];
  const gesehen = new Set([id]);
  let p = nach.get(id)?.elternId;
  while (p && nach.has(p) && !gesehen.has(p)) { raus.push(p); gesehen.add(p); p = nach.get(p)?.elternId; }
  return raus;
}

/** Ebene eines Knotens (1–n) aus der Eltern-Kette; ein Kreis ergibt `KREIS` (-1). */
export function ebeneVon(k: { id: string; elternId?: string }, liste: readonly { id: string; elternId?: string }[]): number {
  const nach = new Map(liste.map(x => [x.id, x]));
  const gesehen = new Set<string>([k.id]);
  let ebene = 1;
  let p = k.elternId;
  while (p && nach.has(p)) {
    if (gesehen.has(p)) return KREIS;
    gesehen.add(p);
    ebene++;
    p = nach.get(p)!.elternId;
  }
  return ebene;
}

/** Der erste Knoten, der in einem Kreis steht — sonst null. */
export function kreisBei(liste: readonly { id: string; elternId?: string }[]): string | null {
  for (const k of liste) if (ebeneVon(k, liste) === KREIS) return k.id;
  return null;
}

/** Der Knoten und alle Nachfahren (Tiefensuche in Rang-Reihenfolge, kreisfest). */
export function teilbaum<T extends Knotenartig>(id: string, liste: readonly T[]): string[] {
  const raus: string[] = [];
  const gesehen = new Set<string>();
  const geh = (x: string) => {
    if (gesehen.has(x)) return;
    gesehen.add(x); raus.push(x);
    for (const k of kinderVon(x, liste)) geh(k.id);
  };
  if (liste.some(k => k.id === id)) geh(id);
  return raus;
}

/** Alle Knoten in Lese-Reihenfolge (Wurzeln nach Rang, je Teilbaum Tiefensuche) — die Reihenfolge von Zeitstrahl, Ablauf und Report. */
export function inReihenfolge<T extends Knotenartig>(liste: readonly T[]): T[] {
  const nach = new Map(liste.map(k => [k.id, k]));
  return kinderVon(undefined, liste).flatMap(w => teilbaum(w.id, liste)).map(id => nach.get(id)!).filter(Boolean);
}

/** Der Wurzelknoten (Ebene 1) einer Vorlage — bei mehreren der erste nach Rang. */
export const wurzelVon = <T extends Knotenartig>(liste: readonly T[]): T | null => kinderVon(undefined, liste)[0] ?? null;

// ── Fall: Fortschritt, aktueller Knoten, „wartet auf euch“ ──────────────────────────────────────────────────────────────────────────

const fertig = (k: FallKnoten) => FERTIG.has(k.status);
const blaetterUnter = (id: string, liste: readonly FallKnoten[]) => {
  const nach = new Map(liste.map(k => [k.id, k]));
  return teilbaum(id, liste).filter(x => x !== id && kinderVon(x, liste).length === 0).map(x => nach.get(x)!);
};

/**
 * Fortschritt eines Falls in Prozent (0–100, gerundet): Anteil der erledigten Knoten auf Ebene 4 und 5; „entfällt“ zählt nicht (7.4).
 * Hat der Fall (noch) keine Einzelschritte, zählen seine Blätter ab Ebene 2 — so steht ein Fall aus einem Muster bis Ebene 3 nicht ewig auf 0.
 */
export function fallFortschritt(fall: Pick<Fall, 'knoten'>): number {
  const l = fall.knoten;
  let zaehlend = l.filter(k => { const e = ebeneVon(k, l); return (e === 4 || e === 5) && k.status !== 'entfaellt'; });
  if (!zaehlend.length) zaehlend = l.filter(k => ebeneVon(k, l) >= 2 && kinderVon(k.id, l).length === 0 && k.status !== 'entfaellt');
  if (!zaehlend.length) return 0;
  return Math.round((zaehlend.filter(k => k.status === 'erledigt').length / zaehlend.length) * 100);
}

/** Ist eine Phase (Ebene 2) abgeschlossen? Eigener Status fertig — oder sie hat Blätter, und alle sind fertig. */
function phaseFertig(p: FallKnoten, liste: readonly FallKnoten[]): boolean {
  if (fertig(p)) return true;
  const b = blaetterUnter(p.id, liste);
  return b.length > 0 && b.every(fertig);
}

/**
 * Der aktuelle Knoten eines Falls (7.4): die erste nicht abgeschlossene Phase (Ebene 2) in Rang-Reihenfolge, darin der erste offene
 * Einzelschritt (Ebene 4; gibt es keine, der erste offene Teilprozess auf Ebene 3). Alles fertig → beides null.
 */
export function aktuellerKnoten(fall: Pick<Fall, 'knoten'>): { phase: FallKnoten | null; schritt: FallKnoten | null } {
  const l = fall.knoten;
  const reihenfolge = inReihenfolge(l);
  const phase = reihenfolge.find(k => ebeneVon(k, l) === 2 && !phaseFertig(k, l)) ?? null;
  if (!phase) return { phase: null, schritt: null };
  const darin = new Set(teilbaum(phase.id, l));
  const offen = (ebene: number) => reihenfolge.find(k => darin.has(k.id) && ebeneVon(k, l) === ebene && !fertig(k) && !(kinderVon(k.id, l).length && blaetterUnter(k.id, l).every(fertig))) ?? null;
  return { phase, schritt: offen(4) ?? offen(3) };
}

/** Tage zwischen zwei Tagen (YYYY-MM-DD bzw. ISO) — `bis` minus `von`, nie negativ; unlesbar → undefined. */
export function tageZwischen(von: string | undefined, bis: string): number | undefined {
  if (!von) return undefined;
  const t = (x: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tagVon(x)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
  const d = (t(bis) - t(von)) / 86_400_000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : undefined;
}

/**
 * „Wartet auf euch“ (1.3, 5.2): was beim Kunden liegt — Knoten im Status „wartet_kunde“ (mit Freigabe-Punkt als `freigabe`) und offene
 * Entscheidungen, die der Kunde trifft. Ältester zuerst (ohne Datum zuletzt).
 */
export function wartetAufEuch(fall: Pick<Fall, 'knoten' | 'entscheidungen' | 'freigaben'>, heute: string): WartetPunkt[] {
  const raus: WartetPunkt[] = [];
  for (const k of fall.knoten) {
    if (k.status !== 'wartet_kunde') continue;
    const art = k.freigabe && !fall.freigaben[k.freigabe] ? 'freigabe' as const : 'knoten' as const;
    const tage = tageZwischen(k.seit, heute);
    raus.push({ art, id: k.id, titel: k.titel, ...(k.seit ? { seit: k.seit } : {}), ...(tage !== undefined ? { tage } : {}) });
  }
  for (const e of fall.entscheidungen) {
    if (e.status !== 'offen' || e.wer !== 'kunde') continue;
    const tage = tageZwischen(e.am, heute);
    raus.push({ art: 'entscheidung', id: e.id, titel: e.titel, seit: e.am, ...(tage !== undefined ? { tage } : {}) });
  }
  return raus.sort((a, b) => (b.tage ?? -1) - (a.tage ?? -1) || a.titel.localeCompare(b.titel, 'de'));
}

// ── Wert-Konto (7.5) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const zahlText = (n: number, einheit?: string) => `${n.toLocaleString('de-DE')}${einheit ? ` ${einheit}` : ''}`;

/**
 * Eine Zeile „vorher → jetzt → Ziel“ je Ziel des Mandats (`Mandat.ziele` bleibt die Wahrheit für „was ist das Ziel“). Jetzt = letzte Messung
 * des Falls, sonst `ziele[].ist`; fehlt etwas: „—“. Ohne Fall nur die Werte des Mandats.
 */
export function wertKontoZeilen(fall: Pick<Fall, 'wertKonto'> | null | undefined, mandat: Pick<Mandat, 'ziele'>): WertKontoZeile[] {
  // Roh gelesen (ladeCrm säubert nicht) — auch Ziele in der alten Text-Form zählen (EINE Stelle lib/crm/mandat-ziele.ts).
  return mandatZieleLesen(mandat.ziele).map(z => {
    const e = fall?.wertKonto?.[z.id];
    const letzte = e?.messungen?.length ? [...e.messungen].sort((a, b) => (a.am < b.am ? -1 : a.am > b.am ? 1 : 0)).at(-1)! : null;
    const vorher = e?.ausgangZahl !== undefined ? zahlText(e.ausgangZahl, e.einheit) : e?.ausgang ?? '—';
    const jetzt = letzte ? zahlText(letzte.wert, e?.einheit) : z.ist?.trim() || '—';
    const ziel = e?.zielZahl !== undefined ? zahlText(e.zielZahl, e.einheit) : z.ziel?.trim() || '—';
    return { zielId: z.id, name: z.text, vorher, jetzt, ziel, ...(e?.zielBis ? { bis: e.zielBis } : {}), festgelegt: !!e?.festgelegtAm };
  });
}

// ── Puls (5.5) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PulsStufe = 'gut' | 'neutral' | 'kritisch';
/** 0–10: bis zur Schwelle (Vorgabe 6) „kritisch“ (Hinweis an die zuständige Person), ab 9 „gut“, dazwischen „neutral“. */
export function pulsStufe(wert: number, schwelle = 6): PulsStufe {
  if (wert <= schwelle) return 'kritisch';
  return wert >= 9 ? 'gut' : 'neutral';
}

// ── Mandat: Ende, Unterschrift, Onboarding-Kandidaten (3.1, 8.1) ─────────────────────────────────────────────────────────────────────

/**
 * Ende eines Mandats als Tag (Löschfristen 8.1): „beendet“ → `ende` (fehlt es: der Tag der letzten Änderung — nie früher als das echte Ende);
 * sonst im Papierkorb → Tag des Löschens; sonst null (läuft noch).
 */
export function mandatsEnde(m: Pick<Mandat, 'status' | 'ende' | 'geloeschtAm' | 'geaendert'>): string | null {
  if (m.status === 'beendet') return m.ende ? tagVon(m.ende) : m.geaendert ? tagVon(m.geaendert) : null;
  if (m.geloeschtAm) return tagVon(m.geloeschtAm);
  return null;
}

/**
 * Zeitpunkt der Unterschrift (3.1): `angenommenAm` des verknüpften Angebots (Mandat oder Deal) → Tag des Deal-Wechsels auf „gewonnen“
 * (Historie, der letzte) → `Mandat.start` → Tag, an dem der Fall angelegt wurde. Sonst null.
 */
export function unterschriftAm(
  m: Pick<Mandat, 'id' | 'chanceId' | 'start'>,
  crm: Pick<CrmBestand, 'angebote' | 'chancen'>,
  fallAngelegt?: string,
): Unterschrift | null {
  const angenommen = (crm.angebote ?? [])
    .filter(a => a.status === 'angenommen' && a.angenommenAm && (a.mandatId === m.id || (!!m.chanceId && a.dealId === m.chanceId)))
    .map(a => a.angenommenAm!).sort();
  if (angenommen.length) return { am: angenommen[0], quelle: 'angebot' };
  const deal = m.chanceId ? (crm.chancen ?? []).find(c => c.id === m.chanceId) : undefined;
  const gewonnen = (deal?.historie ?? []).filter(h => h.stufe === 'gewonnen' && h.am).map(h => h.am).sort().at(-1);
  if (gewonnen) return { am: gewonnen, quelle: 'deal' };
  if (m.start) return { am: m.start, quelle: 'start' };
  return fallAngelegt ? { am: fallAngelegt, quelle: 'fall' } : null;
}

/** Marke „nicht mehr vorschlagen“ für ein Mandat (Ausblenden der Onboarding-Karte). */
export const markeOnboardingAus = (mandatId: string) => `onboarding-aus:${mandatId}`;

/**
 * Mandate, für die „Kundenonboarding starten“ angeboten wird (3.1): Status aktiv oder Angebot, Business-Gesellschaft, nicht gelöscht, noch
 * kein Fall, nicht ausgeblendet — UND unterschrieben, Angebot angenommen oder Deal gewonnen. Älteste Unterschrift zuerst.
 * `heute` gehört zur festen Signatur (spätere Regeln nach Alter); heute ohne Wirkung.
 */
export function onboardingKandidaten(
  crm: Pick<CrmBestand, 'mandate' | 'angebote' | 'chancen'>,
  faelle: Readonly<Record<string, unknown>>,
  marken: Readonly<Record<string, string>>,
  _heute: string,
): OnboardingKandidat[] {
  const raus: OnboardingKandidat[] = [];
  for (const m of crm.mandate ?? []) {
    if (m.status !== 'aktiv' && m.status !== 'angebot') continue;
    if (!istBusinessGesellschaft(m.gesellschaft) || m.geloeschtAm || faelle[m.id] || marken[markeOnboardingAus(m.id)]) continue;
    const angebot = (crm.angebote ?? []).some(a => a.status === 'angenommen' && (a.mandatId === m.id || (!!m.chanceId && a.dealId === m.chanceId)));
    const deal = !!m.chanceId && (crm.chancen ?? []).some(c => c.id === m.chanceId && c.stufe === 'gewonnen');
    const grund = m.vertragUnterschrieben ? 'vertrag' as const : angebot ? 'angebot' as const : deal ? 'deal' as const : null;
    if (!grund) continue;
    raus.push({
      mandatId: m.id, titel: m.titel, kunde: m.kunde, grund, unterschrift: unterschriftAm(m, crm),
      ...(m.leistungId ? { leistungId: m.leistungId } : {}), ...(m.zustaendig ? { zustaendig: m.zustaendig } : {}),
    });
  }
  const zeit = (k: OnboardingKandidat) => k.unterschrift?.am ?? '9999';
  return raus.sort((a, b) => (zeit(a) < zeit(b) ? -1 : zeit(a) > zeit(b) ? 1 : a.mandatId.localeCompare(b.mandatId)));
}

// ── Landkarte: welcher Kunde steht wo (2.2) ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Je Knoten einer Vorlage die Mandate, deren aktueller Knoten (`aktuellerKnoten`) in seinem Teilbaum liegt. Ein Verweis auf eine Paket-Vorlage
 * (`verweis: fp-…`) zählt deren Fälle mit (und damit auch seine Vorfahren). Nur laufende Fälle (nicht „abgeschlossen“).
 */
export function kundenJeKnoten(vorlage: Pick<ProzessVorlage, 'id' | 'knoten'>, faelle: readonly Fall[]): Record<string, string[]> {
  const raus: Record<string, Set<string>> = {};
  const dazu = (knotenId: string, mandatId: string) => {
    for (const k of [knotenId, ...vorfahren(knotenId, vorlage.knoten)]) (raus[k] ??= new Set()).add(mandatId);
  };
  const ids = new Set(vorlage.knoten.map(k => k.id));
  for (const f of faelle) {
    if (f.status === 'abgeschlossen') continue;
    if (f.vorlageId === vorlage.id) {
      const a = aktuellerKnoten(f);
      const hier = [a.schritt?.id, a.phase?.id].find(x => x && ids.has(x));
      if (hier) dazu(hier, f.mandatId);
    }
    for (const k of vorlage.knoten) if (k.verweis && k.verweis === f.vorlageId) dazu(k.id, f.mandatId);
  }
  return Object.fromEntries(Object.entries(raus).map(([k, v]) => [k, Array.from(v).sort()]));
}

// ── Konto löschen: Speichername tilgen (lib/datenschutz/konto-daten.ts) ──────────────────────────────────────────────────────────────

/** Felder, die in Fulfillment-Beständen einen Speichernamen (Person des Haushalts) tragen. */
export const PERSONEN_FELDER: ReadonlySet<string> = new Set(['geaendertVon', 'gestartetVon', 'erledigtVon', 'willkommenVon', 'erstelltVon', 'von', 'person']);
/**
 * Den Speichernamen einer gelöschten Kontoperson in allen Personen-Feldern durch „[gelöscht]“ ersetzen — die Einträge bleiben (Geschäftsunterlagen).
 * Liefert den neuen Wert und die Zahl der Ersetzungen (0 = nichts geändert, dann derselbe Wert).
 */
export function speichernameTilgen<T>(wert: T, speicher: string, ersatz = '[gelöscht]'): { wert: T; n: number } {
  let n = 0;
  const geh = (x: unknown): unknown => {
    if (Array.isArray(x)) { let anders = false; const l = x.map(y => { const z = geh(y); if (z !== y) anders = true; return z; }); return anders ? l : x; }
    if (!x || typeof x !== 'object') return x;
    let anders = false;
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (PERSONEN_FELDER.has(k) && v === speicher) { o[k] = ersatz; n++; anders = true; continue; }
      const w = geh(v);
      if (w !== v) anders = true;
      o[k] = w;
    }
    return anders ? o : x;
  };
  const neu = geh(wert) as T;
  return { wert: n ? neu : wert, n };
}

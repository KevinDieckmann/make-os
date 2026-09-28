// ─── CRM — Wertelisten (rein, getestet, 27.09.) ─────────────────────────────
// Stammdaten › Wertelisten: was frei ist, pflegt Kevin hier; woran
// Programmlogik hängt, bleibt fest im Code und ist als „fest“ markiert.
//   Verlustgründe      fest: VERLUSTGRUENDE (pipeline.ts) · eigene dazu
//   Kadenz je Kreis    Standard: KREIS_TAKT (A 30 · B 60 · C 90 · D 180) · je Kreis überschreibbar
//   Gesprächsergebnisse fest: ERGEBNISSE (Regeln in erfassen.ts) · eigene dazu
//   Ziele je Monat     Umsatz neu (€), SQL, Gespräche je Woche — Messlatte für die Kennzahlen
// Gespeichert werden NUR die eigenen Werte und Abweichungen (crm.wertelisten);
// `wertelistenVollstaendig` setzt Standard und Eigenes zusammen. Die Prüfung
// nimmt ein Teil-Update entgegen (nur die gesendeten Listen ändern sich).

import { ERGEBNISSE, KREIS_TAKT, type Kreis, type Ergebnis } from '@/lib/make-one/crm';
import { VERLUSTGRUENDE, verlustgruende } from './pipeline';
import type { Wertelisten } from './typen';

export const KREISE: readonly Kreis[] = ['A', 'B', 'C', 'D'];
/** Ein Wort je Kreis — dieselben wie in runden.ts KREIS_WAHL. */
export const KREIS_WORT: Record<Kreis, string> = { A: 'eng', B: 'wichtig', C: 'locker', D: 'Netzwerk' };
export const KADENZ_MIN = 7;
export const KADENZ_MAX = 730;
export const GRUND_MIN = 2;
export const GRUND_MAX = 60;
export const ERGEBNIS_MIN = 2;
export const ERGEBNIS_MAX = 40;
export const WERT_MIN = 2;
export const WERT_MAX = 60;

// Vorbelegte Listen (Kevin 27.09.: „nicht selbst eintippen — vorsortiert, fünf bis zehn Stück“). Eigene kommen in den Stammdaten dazu.
export const BRANCHEN_STANDARD = ['Software & IT', 'KI & Daten', 'Beratung', 'Finanzen & Fintech', 'Immobilien & Bau', 'Handwerk', 'Industrie & Maschinenbau', 'Handel & E-Commerce', 'Gesundheit', 'Bildung & Coaching', 'Marketing & Agentur', 'Recht & Steuern', 'Medien & Kreativ', 'Energie & Umwelt', 'Gastronomie & Tourismus', 'Öffentlich & Verbände'] as const;
export const TYPEN_STANDARD = ['Zielkunde', 'Kunde', 'Netzwerk', 'Partner', 'Dienstleister', 'Investor', 'Multiplikator', 'Presse', 'Bewerber', 'Privat'] as const;
export const KATEGORIEN_STANDARD = ['Tech-Gründer', 'KI-Gründer', 'Mittelstand', 'Berater', 'Investor', 'Agentur', 'Hochschule', 'Verband', 'Ehemalige Kollegen', 'Freunde & Familie'] as const;

/** Lesbare Namen der festen Gesprächsergebnisse (Kennung → Anzeige). */
export const ERGEBNIS_LABEL: Record<Ergebnis, string> = {
  gespraech: 'Gespräch', termin: 'Termin', mailbox: 'Mailbox', nicht_erreicht: 'nicht erreicht', rueckruf: 'Rückruf', kein_bedarf: 'kein Bedarf', sperre: 'Sperre (Widerspruch)',
};
export const ergebnisLabel = (wert: string): string => (ERGEBNIS_LABEL as Record<string, string>)[wert] ?? wert;

export type Ziele = NonNullable<Wertelisten['ziele']>;
export const ZIEL_FELDER: { id: keyof Ziele; label: string; einheit: string }[] = [
  { id: 'umsatzNeuMonat', label: 'Umsatz neu', einheit: '€ je Monat' },
  { id: 'sqlMonat', label: 'Neue SQL', einheit: 'je Monat' },
  { id: 'gespraecheWoche', label: 'Echte Gespräche', einheit: 'je Woche' },
];
const ZIEL_IDS = new Set<string>(ZIEL_FELDER.map(z => z.id));

export interface WertelistenVoll {
  verlustgruende: { wert: string; fest: boolean }[];
  /** Wirksamer Takt je Kreis (Standard oder eigener). */
  kadenzTage: Record<Kreis, number>;
  kadenzStandard: Record<Kreis, number>;
  ergebnisse: { wert: string; label: string; fest: boolean }[];
  ziele: Ziele;
  branchen: { wert: string; fest: boolean }[];
  typen: { wert: string; fest: boolean }[];
  kategorien: { wert: string; fest: boolean }[];
  /** Labels (28.09.) — nur eigene, keine festen. */
  labels: { wert: string; fest: boolean }[];
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const schluessel = (s: string) => norm(s).toLowerCase().replace(/_/g, ' ');
const FESTE_ERGEBNISSE = new Set<string>([...ERGEBNISSE.map(schluessel), ...Object.values(ERGEBNIS_LABEL).map(schluessel)]);
const FESTE_GRUENDE = new Set<string>(VERLUSTGRUENDE.map(schluessel));

/** Eigene Gesprächsergebnisse — ohne die festen, ohne Doppelung. */
export function eigeneErgebnisse(w?: Wertelisten | null): string[] {
  const gesehen = new Set<string>(FESTE_ERGEBNISSE);
  const raus: string[] = [];
  for (const roh of w?.ergebnisse ?? []) {
    const e = norm(String(roh ?? ''));
    if (!e || gesehen.has(schluessel(e))) continue;
    gesehen.add(schluessel(e));
    raus.push(e);
  }
  return raus;
}

/** Eigene Werte einer Standardliste — ohne die festen, ohne Doppelung. */
function eigene(roh: unknown, feste: readonly string[]): string[] {
  const gesehen = new Set(feste.map(schluessel)); const raus: string[] = [];
  for (const x of Array.isArray(roh) ? roh : []) { const t = norm(String(x ?? '')); if (!t || gesehen.has(schluessel(t))) continue; gesehen.add(schluessel(t)); raus.push(t); }
  return raus;
}
const mitFest = (feste: readonly string[], eig: string[]) => [...feste.map(wert => ({ wert, fest: true })), ...eig.map(wert => ({ wert, fest: false }))];

/** Eigene Verlustgründe — ohne die festen, ohne Doppelung. */
export const eigeneVerlustgruende = (w?: Wertelisten | null): string[] => verlustgruende(w).slice(VERLUSTGRUENDE.length);

/** Standard + Eigenes, so wie Oberfläche und Regeln es brauchen. */
export function wertelistenVollstaendig(w?: Wertelisten | null): WertelistenVoll {
  const kadenzTage = { ...KREIS_TAKT };
  for (const k of KREISE) {
    const v = w?.kadenzTage?.[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= KADENZ_MIN && v <= KADENZ_MAX) kadenzTage[k] = v;
  }
  const ziele: Ziele = {};
  for (const z of ZIEL_FELDER) {
    const v = w?.ziele?.[z.id];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) ziele[z.id] = v;
  }
  return {
    verlustgruende: [...VERLUSTGRUENDE.map(wert => ({ wert, fest: true })), ...eigeneVerlustgruende(w).map(wert => ({ wert, fest: false }))],
    kadenzTage, kadenzStandard: { ...KREIS_TAKT },
    ergebnisse: [...ERGEBNISSE.map(wert => ({ wert, label: ERGEBNIS_LABEL[wert], fest: true })), ...eigeneErgebnisse(w).map(wert => ({ wert, label: wert, fest: false }))],
    ziele,
    branchen: mitFest(BRANCHEN_STANDARD, eigene(w?.branchen, BRANCHEN_STANDARD)),
    typen: mitFest(TYPEN_STANDARD, eigene(w?.typen, TYPEN_STANDARD)),
    kategorien: mitFest(KATEGORIEN_STANDARD, eigene(w?.kategorien, KATEGORIEN_STANDARD)),
    labels: mitFest([], eigene(w?.labels, [])),
  };
}

/** Eine Pille in der Wertelisten-Wahl der Akte (27.09.). */
export interface WahlOption { wert: string; fest: boolean; /** Bestandswert, der (noch) in keiner Liste steht — bleibt sichtbar, damit nichts verschwindet. */ fremd?: boolean }

/**
 * Was die Akte zur Wahl zeigt (Branchen, Typ, Kategorie): alle Werte der
 * Liste, dazu gewählte Werte, die in keiner Liste stehen (Import-Altbestand),
 * gefiltert nach einem Suchtext (ohne Groß/Klein, Teilwort genügt). Gewählte
 * Werte bleiben bei der Suche stehen — man sieht immer, was gesetzt ist.
 */
export function wertelisteZurWahl(liste: readonly { wert: string; fest: boolean }[], aktiv: readonly string[], suche = ''): WahlOption[] {
  const s = schluessel(suche);
  const bekannt = new Set(liste.map(x => schluessel(x.wert)));
  const alle: WahlOption[] = [...liste.map(x => ({ wert: x.wert, fest: x.fest })), ...aktiv.filter(a => a && !bekannt.has(schluessel(a))).map(wert => ({ wert, fest: false, fremd: true }))];
  if (!s) return alle;
  const gewaehlt = new Set(aktiv.map(schluessel));
  return alle.filter(o => gewaehlt.has(schluessel(o.wert)) || schluessel(o.wert).includes(s));
}

/** Ab so vielen Werten bekommt die Wahl ein Suchfeld. */
export const SUCHE_AB = 12;

export type Pruefung = { ok: true; wertelisten: Wertelisten; fehler: [] } | { ok: false; wertelisten: Wertelisten; fehler: string[] };

const istObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Zahl aus Zahl oder Zahlentext („45“, „1.200“, „1200,50“) — sonst NaN. */
const zahl = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const t = v.trim().replace(/\s/g, '');
  if (!t) return NaN;
  // Deutsch (1.200,50) oder englisch (1,200.50 / 1200.5): das letzte Trennzeichen ist das Dezimalzeichen, wenn danach 1–2 Ziffern kommen.
  const m = t.match(/^-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$|^-?\d+(?:[.,]\d+)?$/);
  if (!m) return NaN;
  const letztes = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  const dezimal = letztes >= 0 && t.length - letztes - 1 <= 2 && !/^-?\d{1,3}([.,]\d{3})+$/.test(t);
  const ganz = dezimal ? t.slice(0, letztes) : t;
  const bruch = dezimal ? t.slice(letztes + 1) : '';
  return Number(`${ganz.replace(/[.,]/g, '')}${bruch ? `.${bruch}` : ''}`);
};
const leer = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

/**
 * Teil-Update prüfen und säubern: nur gesendete Listen ändern sich; `alt` ist
 * der gespeicherte Stand. Feste Werte lassen sich nicht löschen (sie stehen gar
 * nicht im Speicher), Eigenes wird gesäubert (Leerraum, Doppelungen, Länge).
 * Bei Fehlern bleibt `wertelisten` der alte Stand.
 */
export function wertelistenPruefen(roh: unknown, alt?: Wertelisten | null): Pruefung {
  const fehler: string[] = [];
  const neu: Wertelisten = { ...(alt ?? {}) };
  if (!istObjekt(roh)) return { ok: false, wertelisten: alt ?? {}, fehler: ['Wertelisten müssen ein Objekt sein.'] };

  const liste = (feld: 'verlustgruende' | 'ergebnisse' | 'branchen' | 'typen' | 'kategorien' | 'labels', min: number, max: number, feste: Set<string>, name: string) => {
    if (!(feld in roh)) return;
    const v = roh[feld];
    if (v === null) { delete neu[feld]; return; }
    if (!Array.isArray(v)) { fehler.push(`${name}: Liste erwartet.`); return; }
    const gesehen = new Set<string>(feste);
    const sauber: string[] = [];
    for (const x of v) {
      const t = norm(String(x ?? ''));
      if (!t) continue;
      if (t.length < min || t.length > max) { fehler.push(`${name} „${t.slice(0, 20)}${t.length > 20 ? '…' : ''}“: ${min}–${max} Zeichen.`); continue; }
      if (gesehen.has(schluessel(t))) continue; // fest oder doppelt → stillschweigend weg
      gesehen.add(schluessel(t));
      sauber.push(t);
    }
    if (sauber.length) neu[feld] = sauber; else delete neu[feld];
  };
  liste('verlustgruende', GRUND_MIN, GRUND_MAX, FESTE_GRUENDE, 'Verlustgrund');
  liste('ergebnisse', ERGEBNIS_MIN, ERGEBNIS_MAX, FESTE_ERGEBNISSE, 'Gesprächsergebnis');
  liste('branchen', WERT_MIN, WERT_MAX, new Set(BRANCHEN_STANDARD.map(schluessel)), 'Branche');
  liste('typen', WERT_MIN, WERT_MAX, new Set(TYPEN_STANDARD.map(schluessel)), 'Lead-Typ');
  liste('kategorien', WERT_MIN, WERT_MAX, new Set(KATEGORIEN_STANDARD.map(schluessel)), 'Kategorie');
  liste('labels', WERT_MIN, WERT_MAX, new Set<string>(), 'Label');

  if ('kadenzTage' in roh) {
    const v = roh.kadenzTage;
    if (v === null) delete neu.kadenzTage;
    else if (!istObjekt(v)) fehler.push('Kadenz: Objekt je Kreis erwartet.');
    else {
      const k = { ...(neu.kadenzTage ?? {}) };
      for (const [kreis, wert] of Object.entries(v)) {
        if (!(KREISE as readonly string[]).includes(kreis)) { fehler.push(`Kadenz: Kreis „${kreis}“ unbekannt.`); continue; }
        if (leer(wert)) { delete k[kreis]; continue; }
        const n = zahl(wert);
        if (!Number.isInteger(n) || n < KADENZ_MIN || n > KADENZ_MAX) { fehler.push(`Kadenz ${kreis}: ganze Zahl ${KADENZ_MIN}–${KADENZ_MAX} Tage.`); continue; }
        if (n === KREIS_TAKT[kreis as Kreis]) delete k[kreis]; else k[kreis] = n;
      }
      if (Object.keys(k).length) neu.kadenzTage = k; else delete neu.kadenzTage;
    }
  }

  if ('ziele' in roh) {
    const v = roh.ziele;
    if (v === null) delete neu.ziele;
    else if (!istObjekt(v)) fehler.push('Ziele: Objekt erwartet.');
    else {
      const z: Ziele = { ...(neu.ziele ?? {}) };
      for (const [id, wert] of Object.entries(v)) {
        if (!ZIEL_IDS.has(id)) { fehler.push(`Ziel „${id}“ unbekannt.`); continue; }
        const feld = id as keyof Ziele;
        if (leer(wert)) { delete z[feld]; continue; }
        const n = zahl(wert);
        if (!Number.isFinite(n) || n < 0) { fehler.push(`${ZIEL_FELDER.find(f => f.id === feld)?.label ?? id}: Zahl ≥ 0.`); continue; }
        z[feld] = Math.round(n * 100) / 100;
      }
      if (Object.keys(z).length) neu.ziele = z; else delete neu.ziele;
    }
  }

  return fehler.length ? { ok: false, wertelisten: alt ?? {}, fehler } : { ok: true, wertelisten: neu, fehler: [] };
}

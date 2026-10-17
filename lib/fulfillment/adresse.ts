// ─── Fulfillment — Adressen (C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10; umgebaut 17.10. nach dem Miro-Standard) ──────────────────────────
// Die Fulfillment-Seite liegt unter Produkte & Mandate: `/os/mandate/fulfillment` (Segment „Fulfillment“, kein eigener Leistenpunkt).
//   u   Unternavigation: prozesse (= Landkarte, Standard, weggelassen) · onboarding · bausteine · analysen · kreislauf
//   k   ein Knoten im Drill-down (nur unter Landkarte) · b ein Baustein (nur unter Bausteine)
//   m   ein Fall (Mandat-Kennung) — dann `r` = Reiter des Falls: reise (Standard, weggelassen) · ziele · menschen · kunde
//   #   ein Sprung im Fall (`phase-<id>`, `freigabe-<id>`, `willkommen`, `stelle-<id>` — components/os/fulfillment/reise/sprung.ts)
// Rückmeldung 17.10. („es dupliziert sich — lieber wenig und klar“): der Fall hat vier Reiter statt acht, der Start fünf Unter-Reiter statt sechs. ALTE
// Adressen bleiben gültig und leiten um (`ALTE_REITER`, `ALTE_BEREICHE`): `r=ueberblick|ablauf` → Reise, `wert` → Ziele & Wirkung, `takt` → Menschen &
// Termine (#stelle-takt-leiste), `analyse` → Reise an der Analyse-Phase (#stelle-analyse), `kreislauf` → Reise am Abschluss (#stelle-abschluss);
// `u=visualisierung` → Landkarte. Nie ein toter Link — gespeicherte Glocken-Links und Lesezeichen kommen an.
// Links nur über `WEG.fulfillment` / `WEG.fall` / `WEG.dossier` (lib/wege.ts); gelesen nur über `fulfillmentAusAdresse` (ungültige Werte fallen weg).
// Rein und client-sicher — keine Importe aus lib/wege.ts (WEG importiert DIESE Datei).

export const FULFILLMENT_PFAD = '/os/mandate/fulfillment';

export type FulfillmentBereich = 'prozesse' | 'onboarding' | 'bausteine' | 'analysen' | 'kreislauf';
export const FULFILLMENT_BEREICHE: readonly { id: FulfillmentBereich; label: string }[] = [
  { id: 'prozesse', label: 'Landkarte' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'bausteine', label: 'Bausteine' },
  { id: 'analysen', label: 'Analysen' },
  { id: 'kreislauf', label: 'Kreislauf' },
];
/** Frühere Unter-Reiter (bis 17.10.) — die Adresse bleibt gültig und zeigt den neuen Ort. */
export type AlterBereich = 'visualisierung';
export const ALTE_BEREICHE: Readonly<Record<AlterBereich, FulfillmentBereich>> = { visualisierung: 'prozesse' };

export type FallReiter = 'reise' | 'ziele' | 'menschen' | 'kunde';
export const FALL_REITER: readonly { id: FallReiter; label: string }[] = [
  { id: 'reise', label: 'Reise' },
  { id: 'ziele', label: 'Ziele & Wirkung' },
  { id: 'menschen', label: 'Menschen & Termine' },
  { id: 'kunde', label: 'Kunde' },
];
/** Frühere Reiter des Falls (bis 17.10.). */
export type AlterFallReiter = 'ueberblick' | 'ablauf' | 'wert' | 'takt' | 'analyse' | 'kreislauf';
/** Wohin ein früherer Reiter heute führt — neuer Reiter und (optional) der Sprung an die Stelle. EINE Tabelle für Links UND das Lesen der Adresse. */
export const ALTE_REITER: Readonly<Record<AlterFallReiter, { r: FallReiter; anker?: string }>> = {
  ueberblick: { r: 'reise' },
  ablauf: { r: 'reise' },
  wert: { r: 'ziele' },
  takt: { r: 'menschen', anker: 'stelle-takt-leiste' },
  analyse: { r: 'reise', anker: 'stelle-analyse' },
  kreislauf: { r: 'reise', anker: 'stelle-abschluss' },
};

const BEREICH_IDS = FULFILLMENT_BEREICHE.map(b => b.id) as readonly string[];
const REITER_IDS = FALL_REITER.map(r => r.id) as readonly string[];
const KNOTEN = /^fk-[a-z0-9][a-z0-9-]{0,99}$/;
const BAUSTEIN = /^fb-[a-z0-9][a-z0-9-]{0,99}$/;
const MANDAT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
/** Ein Sprung im Fall (ohne „#“) — dieselbe Form wie `sprungAnker` (components/os/fulfillment/reise/sprung.ts). */
const ANKER = /^(willkommen|(phase|freigabe)-[A-Za-z0-9][A-Za-z0-9_-]{0,99}|stelle-[a-z][a-z0-9-]{0,60})$/;

const istAlterReiter = (r: string): r is AlterFallReiter => Object.prototype.hasOwnProperty.call(ALTE_REITER, r);
const istAlterBereich = (u: string): u is AlterBereich => Object.prototype.hasOwnProperty.call(ALTE_BEREICHE, u);

const mitQuery = (p: Record<string, string | undefined>, anker?: string) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  const t = q.toString();
  return `${t ? `${FULFILLMENT_PFAD}?${t}` : FULFILLMENT_PFAD}${anker && ANKER.test(anker) ? `#${anker}` : ''}`;
};

/** Ein Bereich der Unternavigation, optional mit Knoten (`k`, nur Landkarte) bzw. Baustein (`b`, nur Bausteine). Frühere Namen zeigen den neuen Ort. */
export function fulfillmentLink(u?: FulfillmentBereich | AlterBereich, p: { k?: string; b?: string } = {}): string {
  const wirksam: FulfillmentBereich | undefined = u && istAlterBereich(u) ? ALTE_BEREICHE[u] : u as FulfillmentBereich | undefined;
  const bereich = wirksam && wirksam !== 'prozesse' ? wirksam : undefined;
  return mitQuery({
    u: bereich,
    k: (!wirksam || wirksam === 'prozesse') && p.k && KNOTEN.test(p.k) ? p.k : undefined,
    b: wirksam === 'bausteine' && p.b && BAUSTEIN.test(p.b) ? p.b : undefined,
  });
}

/**
 * Ein Fall (Mandat) mit Reiter und optional einem Sprung (`anker` ohne „#“) — ohne gültige Kennung die Fulfillment-Seite. Ein früherer Reiter
 * (`ablauf`, `wert`, `analyse` …) ergibt die Adresse seines neuen Orts (`ALTE_REITER`).
 */
export function fallLink(mandatId: string, r?: FallReiter | AlterFallReiter, anker?: string): string {
  if (!MANDAT.test(mandatId)) return FULFILLMENT_PFAD;
  const ziel = r && istAlterReiter(r) ? ALTE_REITER[r] : { r: r as FallReiter | undefined };
  return mitQuery({ m: mandatId, r: ziel.r && ziel.r !== 'reise' ? ziel.r : undefined }, anker ?? ('anker' in ziel ? ziel.anker : undefined));
}

export interface FulfillmentAdresse {
  u: FulfillmentBereich; k?: string; b?: string; m?: string; r: FallReiter;
  /** Ein Sprung, den ein früherer Reiter mitbringt (z. B. `stelle-analyse`) — die Reise springt beim Öffnen dorthin. */
  anker?: string;
  /** Die Adresse nannte einen früheren Reiter/Bereich — die Seite ersetzt sie durch die neue (Verlauf ohne neuen Schritt). */
  alt?: true;
}

/** Die Adresse lesen — ungültige Werte fallen weg (Unbekanntes in `u` = Landkarte, in `r` = Reise); frühere Namen zeigen den neuen Ort. */
export function fulfillmentAusAdresse(q: { get(name: string): string | null }): FulfillmentAdresse {
  const u = q.get('u');
  const altU = !!u && istAlterBereich(u);
  const bereich: FulfillmentBereich = u && altU ? ALTE_BEREICHE[u as AlterBereich] : u && BEREICH_IDS.includes(u) ? (u as FulfillmentBereich) : 'prozesse';
  const r = q.get('r');
  const altR = !!r && istAlterReiter(r);
  const ziel = r && altR ? ALTE_REITER[r as AlterFallReiter] : null;
  const k = q.get('k'), b = q.get('b'), m = q.get('m');
  return {
    u: bereich,
    r: ziel ? ziel.r : r && REITER_IDS.includes(r) ? (r as FallReiter) : 'reise',
    ...(bereich === 'prozesse' && k && KNOTEN.test(k) ? { k } : {}),
    ...(bereich === 'bausteine' && b && BAUSTEIN.test(b) ? { b } : {}),
    ...(m && MANDAT.test(m) ? { m } : {}),
    ...(ziel?.anker ? { anker: ziel.anker } : {}),
    ...((altR && m && MANDAT.test(m)) || (altU && !(m && MANDAT.test(m))) ? { alt: true as const } : {}),
  };
}

/** Die neue Adresse für eine Adresse mit früherem Reiter/Bereich (ein vorhandener Sprung `hash` gewinnt) — sonst null. */
export function neueAdresse(a: FulfillmentAdresse, hash = ''): string | null {
  if (!a.alt) return null;
  const h = hash.replace(/^#/, '');
  if (a.m) return fallLink(a.m, a.r, h && ANKER.test(h) ? h : a.anker);
  return fulfillmentLink(a.u, { ...(a.k ? { k: a.k } : {}), ...(a.b ? { b: a.b } : {}) });
}

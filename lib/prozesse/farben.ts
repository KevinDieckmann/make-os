// ─── Prozesse — die Töne der Landkarte (Etappe A, 21.10.; ANALYSE_100.md Punkt 26) ──────────────────────────────────────────────────────────
// Farben NUR aus den Token (lib/make-one/design.ts) — keine Literale in den Ansichten. Die Farbe trägt nie allein: jede Stufe steht zusätzlich als Wort
// über ihrer Spalte, jede Kachel trägt ihren Titel, eine Zahl immer mit Wort, „hängt“ immer mit Zeichen. Kontrast ≥ 3:1 gegen den Grund (Grafik,
// WCAG 1.4.11) und Text auf der getönten Kachel ≥ 4,5:1 — Wächter tests/prozesse-modell.test.ts.

import { FARBE as C, LEUCHT, KUGEL } from '@/lib/make-one/design';
import type { Band, KernStufe } from './typen';
import type { ProzessForm, ZettelFarbe } from './definition';

/** Je Stufe der Fliege ein Ton (der Knoten „Übergabe“ im Akzent der Instanz — dort, wo „Hier“ im Flow steht). */
export const STUFE_FARBE: Readonly<Record<KernStufe, string>> = {
  marketing: LEUCHT.beziehung,
  sales: LEUCHT.business,
  uebergabe: C.aktiv,
  fulfillment: LEUCHT.puls,
  ausbau: LEUCHT.agenten,
};
/** Führung und Unterstützung bleiben ruhig. */
export const BAND_FARBE: Readonly<Record<Exclude<Band, 'kern'>, string>> = { fuehrung: C.inkDim, unterstuetzung: C.inkDim };

/** Der Ton einer Kachel: angepasst (`ton`, Landkarte anpassen — nur aus `LANDKARTE_TOENE`), sonst der ihrer Stufe bzw. ihres Bandes. */
export const tonVon = (p: { band: Band; stufe?: KernStufe; ton?: string }): string => p.ton ?? (p.band === 'kern' ? STUFE_FARBE[p.stufe ?? 'fulfillment'] : BAND_FARBE[p.band]);

// ── Landkarte anpassen (22.10.: „alles muss anpassbar sein“) — die feste, geprüfte Palette je Bereich ─────────────────────────────────────────
/**
 * Die Töne, die ein Bereich der Landkarte tragen darf — NUR Token (nie ein freies Literal), jeder ≥ 3:1 gegen Grund und Kachel, Titel darauf ≥ 4,5:1
 * (Wächter tests/prozesse-landkarte-anpassen.test.ts). Rot fehlt bewusst (Rot heißt „Frist“). Gespeichert wird nur die Kennung, nie der Farbwert.
 */
export const LANDKARTE_TOENE = [
  { id: 'rose', titel: 'Rosé', ton: LEUCHT.beziehung },
  { id: 'orange', titel: 'Orange', ton: LEUCHT.business },
  { id: 'petrol', titel: 'Petrol', ton: C.aktiv },
  { id: 'blau', titel: 'Blau', ton: LEUCHT.puls },
  { id: 'violett', titel: 'Violett', ton: LEUCHT.agenten },
  { id: 'lila', titel: 'Lila', ton: LEUCHT.schlaf },
  { id: 'gruen', titel: 'Grün', ton: LEUCHT.gut },
  { id: 'gelb', titel: 'Gelb', ton: LEUCHT.achtung },
  { id: 'grau', titel: 'Grau', ton: C.inkDim },
] as const;
export type LandkarteTon = (typeof LANDKARTE_TOENE)[number]['id'];
export const istLandkarteTon = (v: unknown): v is LandkarteTon => LANDKARTE_TOENE.some(t => t.id === v);
/** Der Farbwert eines Tons der Palette (unbekannt: null). */
export const landkarteTonWert = (id: string | undefined): string | null => LANDKARTE_TOENE.find(t => t.id === id)?.ton ?? null;
/** Welcher Ton der Palette einem Farbwert entspricht (die Vorgabe eines Bereichs als Kennung). */
export const landkarteTonVon = (wert: string): LandkarteTon | null => LANDKARTE_TOENE.find(t => t.ton === wert)?.id ?? null;

// ── Werkstatt (Etappe B2, 21.10.) — die Formen im Miro-Stil, dazu Agent (Ton der ZOE-Kugel) und Auslöser; Farbe nie allein (Symbol + Text) ──────────────
/** Schritt grün, Nachricht gelb, Raute ruhig, Erinnerung orange (Miro-Stil wie die Fläche des Fulfillments) — Agent im Granat der ZOE-Kugel, Auslöser im Akzent. */
export const WERKSTATT_FORM_FARBE: Readonly<Record<ProzessForm, string>> = {
  schritt: LEUCHT.gut, nachricht: LEUCHT.achtung, entscheidung: C.inkDim, erinnerung: LEUCHT.business, termin: C.ink, abstimmung: C.inkDim,
  ausloeser: C.aktiv, agent: KUGEL.granat, warten: LEUCHT.schlaf, schleife: LEUCHT.planung, teilprozess: LEUCHT.planung, freigabe: C.ink, ende: C.inkDim,
};
/** Der zweite Ton des Agenten (Verlauf wie die ZOE-Kugel: Granat → Smaragd). */
export const AGENT_TON_ZWEI = KUGEL.smaragd;
/** Notiz-Zettel: Farbe als Name im Bestand, hier ihr Token. */
export const ZETTEL_TON: Readonly<Record<ZettelFarbe, string>> = { gelb: LEUCHT.achtung, gruen: LEUCHT.gut, blau: LEUCHT.planung, rosa: LEUCHT.beziehung, grau: C.inkDim };
/** Die Bahnen ruhig im Grund — nur ihr Name trägt eine Marke (Kunde im Ton der Beziehung, Agenten im Ton der Kugel). */
export const BAHN_TON: Readonly<Record<'kunde' | 'mensch' | 'system' | 'agent', string>> = { kunde: LEUCHT.beziehung, mensch: LEUCHT.gut, system: C.inkDim, agent: KUGEL.granat };

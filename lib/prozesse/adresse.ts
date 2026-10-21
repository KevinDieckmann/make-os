// ─── Prozesse — die Adresse (Etappe A, 21.10.; ANALYSE_100.md Punkte 11, 12, 30, 93) ──────────────────────────────────────────────────────
// Die Seite liegt unter `/os/prozesse` (Business, eigener Leistenpunkt). Der Ort im Modell steht in der Adresse — Hineinfahren ist ein echter Schritt im
// Verlauf (`router.push`), Browser-Zurück fährt eine Ebene hinaus (Punkt 12):
//   p   ein Prozess (Ebene 2) · ph eine Phase (Ebene 3, Ablauf) · s ein Schritt (Ebene 4, Detail)
//   voll=1        Vollbild (Leiste und Kopf weg, Esc zurück — Punkt 11)
//   ansicht=      eine Darstellung aus `PROZESS_ANSICHTEN` (Bild · Liste …, Punkt 30) — fehlt: am Handy Liste, sonst Bild
//   modus=praesentieren   Präsentieren (Rahmen für Rahmen, Punkt 93) — schließt das Vollbild ein
//   w=laeufe|tests        Reiter der Werkstatt (22.10., Kevins Bild n8n „Executions“: Bauen · Läufe · Tests) — fehlt: Bauen; nur mit Prozess
//   lauf=pl-…             ein geöffneter Lauf im Reiter Läufe (derselbe Plan, nach dem echten Weg gefärbt)
// Links nur über `WEG.prozesse` (lib/wege.ts); gelesen nur über `prozesseAusAdresse` (ungültige Werte fallen weg). Rein und client-sicher — keine Importe
// aus lib/wege.ts (WEG importiert DIESE Datei).

import { istProzessAnsicht, type ProzessAnsicht, type ProzessPfad } from './typen';

export const PROZESSE_PFAD = '/os/prozesse';
/** Kennungen von Prozessen, Phasen und Schritten (System `sp-…`, Fulfillment `fp-…`/`fk-…`, Phasen- und Schritt-Kürzel). */
export const PROZESS_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.~-]{0,119}$/;
const kennung = (v: string | null | undefined): string | undefined => (v && PROZESS_KENNUNG.test(v) ? v : undefined);

export type ProzesseModus = 'ansehen' | 'praesentieren';
/** Reiter der Werkstatt (ohne Angabe: Bauen). */
export type WerkstattReiterId = 'bauen' | 'laeufe' | 'tests';
const WERKSTATT_REITER_IDS: readonly WerkstattReiterId[] = ['bauen', 'laeufe', 'tests'];
const LAUF = /^pl-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface ProzesseAdresse extends ProzessPfad {
  voll?: boolean;
  ansicht?: ProzessAnsicht;
  modus?: ProzesseModus;
  w?: WerkstattReiterId;
  lauf?: string;
}

/** Die Adresse (Reihenfolge der Parameter fest, damit gleiche Orte gleiche Adressen haben). Ein Schritt ohne Phase bzw. eine Phase ohne Prozess fällt weg. */
export function prozesseLink(a: ProzesseAdresse = {}): string {
  const q = new URLSearchParams();
  const p = kennung(a.p), ph = p ? kennung(a.ph) : undefined, s = ph ? kennung(a.s) : undefined;
  if (p) q.set('p', p);
  if (ph) q.set('ph', ph);
  if (s) q.set('s', s);
  if (a.ansicht && istProzessAnsicht(a.ansicht)) q.set('ansicht', a.ansicht);
  if (a.modus === 'praesentieren') q.set('modus', 'praesentieren');
  else if (a.voll) q.set('voll', '1');
  if (p && a.w && a.w !== 'bauen' && WERKSTATT_REITER_IDS.includes(a.w)) q.set('w', a.w);
  if (p && a.w === 'laeufe' && a.lauf && LAUF.test(a.lauf)) q.set('lauf', a.lauf);
  const t = q.toString();
  return t ? `${PROZESSE_PFAD}?${t}` : PROZESSE_PFAD;
}

/** Die Adresse lesen — ungültige Werte fallen weg, Präsentieren schließt das Vollbild ein. */
export function prozesseAusAdresse(q: URLSearchParams | { get(k: string): string | null }): ProzesseAdresse {
  const p = kennung(q.get('p')), ph = p ? kennung(q.get('ph')) : undefined, s = ph ? kennung(q.get('s')) : undefined;
  const ansicht = q.get('ansicht');
  const praes = q.get('modus') === 'praesentieren';
  const w = q.get('w') as WerkstattReiterId | null;
  const reiter = p && w && w !== 'bauen' && WERKSTATT_REITER_IDS.includes(w) ? w : undefined;
  const lauf = reiter === 'laeufe' ? q.get('lauf') : null;
  return {
    ...(p ? { p } : {}), ...(ph ? { ph } : {}), ...(s ? { s } : {}),
    ...(istProzessAnsicht(ansicht) ? { ansicht } : {}),
    ...(praes ? { modus: 'praesentieren' as const, voll: true } : q.get('voll') === '1' ? { voll: true } : {}),
    ...(reiter ? { w: reiter } : {}), ...(lauf && LAUF.test(lauf) ? { lauf } : {}),
  };
}

/** Eine Ebene hinaus (Esc, Brotkrumen): Schritt → Ablauf → Prozess → Landkarte. Vollbild, Ansicht und Modus bleiben. */
export function ebeneHoch(a: ProzesseAdresse): ProzesseAdresse {
  const { s, ph, p, ...rest } = a;
  if (s) return { ...rest, p, ph };
  if (ph) return { ...rest, p };
  if (p) return rest;
  return a;
}

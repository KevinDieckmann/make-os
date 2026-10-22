// ─── Prozesse · Werkstatt am Handy — Texte, Fristen/Dauer und Zuständige ändern (22.10., E6, Entscheidung „Am Handy Texte & Fristen ändern“) ───────────────────
// Am Handy (schmale Ansicht) zeigt die Werkstatt Pakete und Prozesse als Liste der Schritte; je Schritt öffnet „Bearbeiten“ eine kleine Maske. Ändern lassen sich
// NUR Texte, Fristen/Dauer und Zuständige — Bauen (anlegen, ziehen, verbinden, löschen, Form wechseln) bleibt am Rechner. Gespeichert wird über DENSELBEN Weg wie am
// Rechner (Entwurf mit Stand/409 → veröffentlichen, gleiche Rechte). EINE Stelle, welche Felder es gibt und wie sie wirken:
//   · Prozess der Werkstatt: `werkstattMobilFelder(k, team)` → `werkstattMobilAnwenden(k, werte)` (ändert nur Titel, `frist`, Text-/Zahl-/Personen-Felder der Maske
//     in `katalog.werte` und die Dauer eines Wartens — nie Kennung, Form, Zweige, Phase, Schloss)
//   · Paket des Fulfillments: `paketMobilFelder(k, art)` → `paketMobilOps(id, art, werte)` (Ops des Fulfillment-Editors `schritt`/`phase` mit genau diesen Feldern)
// Rein und client-sicher.

import type { MaskenWert, ProzessForm, ProzessKnoten } from './definition';
import { katalogEintrag } from './baustein-katalog';
import type { EditorOp } from '@/lib/fulfillment/prozesse/editor';
import type { ProzessKnoten as PaketKnoten } from '@/lib/fulfillment/typen';

export interface MobilFeld {
  id: string; label: string;
  art: 'text' | 'textlang' | 'zahl' | 'wahl';
  wert: string | number | null;
  min?: number; max?: number;
  optionen?: readonly { id: string; label: string }[];
}
export type MobilWerte = Readonly<Record<string, string | number | null>>;
type K = ProzessKnoten<ProzessForm>;

const TEXT_TYPEN = new Set(['text', 'langtext', 'textvorlage']);
const NUR_PERSONEN = 'team-person';

/** Die Felder eines Werkstatt-Schritts, die am Handy änderbar sind (rein). `team` = Auswahlliste „team-person“ (mit Rollen). */
export function werkstattMobilFelder(k: K, team: readonly { id: string; label: string }[] = []): MobilFeld[] {
  const raus: MobilFeld[] = [{ id: 'titel', label: 'Titel', art: 'text', wert: k.titel }];
  if (typeof k.frist === 'number') raus.push({ id: 'frist', label: 'Frist (Tage)', art: 'zahl', wert: k.frist, min: 0, max: 365 });
  if (k.warten?.art === 'dauer') raus.push({ id: 'warten.tage', label: 'Warten (Tage)', art: 'zahl', wert: k.warten.tage, min: 0, max: 365 });
  if (k.warten && (k.warten.art === 'ereignis' || k.warten.art === 'datum')) raus.push({ id: 'warten.hoechstensTage', label: 'Höchstens warten (Tage)', art: 'zahl', wert: k.warten.hoechstensTage, min: 1, max: 365 });
  const e = k.katalog?.id ? katalogEintrag(k.katalog.id) : null;
  if (e && !e.feld) {
    const w = k.katalog?.werte ?? {};
    for (const m of e.maske) {
      const v = w[m.id];
      if (TEXT_TYPEN.has(m.typ)) raus.push({ id: `werte.${m.id}`, label: m.label, art: m.typ === 'text' ? 'text' : 'textlang', wert: typeof v === 'string' ? v : null });
      else if (m.typ === 'zahl' || m.typ === 'tage') raus.push({ id: `werte.${m.id}`, label: m.label, art: 'zahl', wert: typeof v === 'number' ? v : null, ...(m.min !== undefined ? { min: m.min } : {}), ...(m.max !== undefined ? { max: m.max } : {}) });
      else if (m.typ === 'auswahl' && m.quelle === NUR_PERSONEN) raus.push({ id: `werte.${m.id}`, label: m.label, art: 'wahl', wert: typeof v === 'string' ? v : null, optionen: team });
    }
  }
  return raus;
}

const zahlAus = (v: string | number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Die Werte aus der Maske am Handy anwenden (rein): NUR die Felder aus `werkstattMobilFelder` — alles andere bleibt, wie es ist. Leere Texte/Zahlen entfernen
 * den Wert der Maske (wie am Rechner); der Titel bleibt Pflicht (leer → unverändert). Geprüft wird beim Speichern wie immer (Säuberer, Prüfung).
 */
export function werkstattMobilAnwenden(k: K, werte: MobilWerte): K {
  const felder = werkstattMobilFelder(k);
  const erlaubt = new Set(felder.map(f => f.id));
  let n: K = { ...k };
  for (const [id, roh] of Object.entries(werte)) {
    if (!erlaubt.has(id)) continue;
    if (id === 'titel') { const t = typeof roh === 'string' ? roh.trim() : ''; if (t) n = { ...n, titel: t }; continue; }
    if (id === 'frist') { const z = zahlAus(roh); if (z !== null) n = { ...n, frist: Math.round(z) }; continue; }
    if (id === 'warten.tage' && n.warten?.art === 'dauer') { const z = zahlAus(roh); if (z !== null) n = { ...n, warten: { ...n.warten, tage: Math.round(z) } }; continue; }
    if (id === 'warten.hoechstensTage' && n.warten && (n.warten.art === 'ereignis' || n.warten.art === 'datum')) { const z = zahlAus(roh); if (z !== null) n = { ...n, warten: { ...n.warten, hoechstensTage: Math.round(z) } as K['warten'] }; continue; }
    if (id.startsWith('werte.')) {
      const feld = id.slice('werte.'.length);
      const art = felder.find(f => f.id === id)?.art;
      const alt: Record<string, MaskenWert> = { ...(n.katalog?.werte ?? {}) };
      const wert: MaskenWert | null = art === 'zahl' ? zahlAus(roh) : typeof roh === 'string' && roh.trim() ? roh : null;
      if (wert === null) delete alt[feld]; else alt[feld] = wert;
      n = { ...n, katalog: { ...(n.katalog ?? { id: '' }), werte: alt } };
    }
  }
  return n;
}

/** Zuständig im Paket (wie der Editor des Fulfillments). */
export const PAKET_ZUSTAENDIG: readonly { id: 'intern' | 'kunde' | 'beide'; label: string }[] = [{ id: 'intern', label: 'Team' }, { id: 'kunde', label: 'Kunde' }, { id: 'beide', label: 'Gemeinsam' }];

/** Die Felder eines Paket-Schritts bzw. einer Phase am Handy (rein): Schritt = Titel, Frist, Zuständig; Phase = Titel. */
export function paketMobilFelder(k: Pick<PaketKnoten, 'titel' | 'frist' | 'zustaendig'>, art: 'schritt' | 'phase'): MobilFeld[] {
  if (art === 'phase') return [{ id: 'titel', label: 'Titel der Phase', art: 'text', wert: k.titel }];
  return [
    { id: 'titel', label: 'Titel', art: 'text', wert: k.titel },
    { id: 'frist', label: 'Frist (Tage nach dem Schritt davor)', art: 'zahl', wert: typeof k.frist === 'number' ? k.frist : null, min: 0, max: 365 },
    { id: 'zustaendig', label: 'Zuständig', art: 'wahl', wert: k.zustaendig ?? 'intern', optionen: PAKET_ZUSTAENDIG },
  ];
}

/** Die Ops des Fulfillment-Editors für die Maske am Handy (rein) — `schritt` bzw. `phase` mit genau diesen Feldern (nie anlegen, verschieben, löschen). */
export function paketMobilOps(id: string, art: 'schritt' | 'phase', werte: MobilWerte): EditorOp[] {
  const titel = typeof werte.titel === 'string' && werte.titel.trim() ? werte.titel.trim() : undefined;
  if (art === 'phase') return titel ? [{ op: 'phase', id, titel }] : [];
  const op: EditorOp = { op: 'schritt', id };
  if (titel) op.titel = titel;
  if ('frist' in werte) { const z = zahlAus(werte.frist); op.frist = z === null ? null : Math.round(z); }
  if (typeof werte.zustaendig === 'string' && PAKET_ZUSTAENDIG.some(z => z.id === werte.zustaendig)) op.zustaendig = werte.zustaendig;
  return Object.keys(op).length > 2 ? [op] : [];
}
/** Welche Ops die Werkstatt am Handy überhaupt schickt (Wächter). */
export const MOBIL_OPS: readonly string[] = ['schritt', 'phase'];

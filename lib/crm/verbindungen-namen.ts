// ─── Verbindungsprüfung — Namen statt roher Kennungen (Kalender-Gesamtprüfung F3, 29.09., rein, getestet) ─
// Die Karte „Verbindungen“ (Stammdaten › Datenqualität) listete je Befund bis zu fünf rohe Kennungen („c-8f3a…“,
// „kalender|uid“). Hier werden sie — wo auflösbar — zu dem, was Kevin und Malin im CRM ohnehin sehen: Name der Person,
// Firma, Titel von Deal/Mandat/Event, Name von Kampagne/Segment/Produkt, Titel einer Aufgabe oder eines Termins.
// Regeln:
//   · Nur aus den Beständen, die die Prüfung schon geladen hat (kein zweites Laden) — Termine aus dem Kalender-Leser.
//   · Termine: Titel nur, wenn der Termin für die fragende Person NICHT maskiert ist (privat der anderen Person →
//     kein Titel, die Kennung bleibt). Private Aufgaben (Space „privat“) bleiben ebenfalls Kennung.
//   · Was sich nicht auflösen lässt (tote Verweise sind ja gerade der Befund), bleibt die Kennung.
// Dazu die Überschrift nach Schwere: vorher stand „Alle Verbindungen sauber“, obwohl Hinweise offen waren (die Ampel
// bleibt bei reinen Hinweisen grün — die Überschrift sagt es trotzdem).

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { altSchluessel } from '@/lib/kalender/bezug';
import type { VerbindungsBestaende, VerbindungsBefund, Schwere } from './verbindungen';

/** Ein Termin aus dem Kalender-Leser, schon für die fragende Person maskiert (lib/kalender/bezug.ts `maskieren`). */
export interface NamenTermin { id: string; titel: string; start: string; maskiert?: true }

const tagKurz = (start: string) => (/^\d{4}-\d{2}-\d{2}/.test(start) ? `${Number(start.slice(8, 10))}.${Number(start.slice(5, 7))}.` : '');
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);

/** Anzeige-Namen für die Beispiel-Kennungen der Befunde (Kennung → Name). Nur, was auflösbar ist. */
export function beispielNamen(
  b: Pick<VerbindungsBestaende, 'kontakte' | 'crm'> & Partial<Pick<VerbindungsBestaende, 'aufgaben' | 'dateien'>>,
  befunde: readonly Pick<VerbindungsBefund, 'beispiele'>[],
  termine: readonly NamenTermin[] = [],
): Record<string, string> {
  const gesucht = new Set(befunde.flatMap(x => x.beispiele));
  const raus: Record<string, string> = {};
  if (!gesucht.size) return raus;
  const setze = (id: string | undefined, name: string | null) => { if (id && name && gesucht.has(id) && !raus[id]) raus[id] = name; };

  for (const k of b.kontakte as readonly Kontakt[]) setze(k.id, text(anzeigename(k)));
  // CRM-Listen: das erste sprechende Feld (Name, Titel, Nummer, Text) — gleiche Reihenfolge für jede Liste.
  for (const liste of Object.values(b.crm)) {
    if (!Array.isArray(liste)) continue;
    for (const o of liste as readonly Record<string, unknown>[]) {
      if (!o || typeof o.id !== 'string') continue;
      setze(o.id, text(o.name) ?? text(o.titel) ?? text(o.nummer) ?? text(o.text));
    }
  }
  for (const a of b.aufgaben?.liste ?? []) if (a.space !== 'privat') setze(a.id, text(a.title));
  for (const d of b.dateien?.eintraege ?? []) setze(d.id, text(d.titel) ?? text(d.datei?.name));
  // Termine: neue Form `kalender|uid(::RID)` UND alte Form ohne Kalender — maskierte nie.
  for (const t of termine) {
    if (t.maskiert) continue;
    const name = text(`${t.titel}${tagKurz(t.start) ? ` · ${tagKurz(t.start)}` : ''}`);
    setze(t.id, name);
    setze(altSchluessel(t.id), name);
  }
  return raus;
}

const zahl = (n: number, ein: string, mehr: string) => `${n} ${n === 1 ? ein : mehr}`;

/** Überschrift der Karte nach der schwersten offenen Schwere — mit allen Zahlen darunter. */
export function verbindungsUeberschrift(befunde: readonly Pick<VerbindungsBefund, 'schwere'>[]): { schwere: Schwere | null; text: string; zahlen: string } {
  const n = (s: Schwere) => befunde.filter(x => x.schwere === s).length;
  const f = n('fehler'), w = n('warnung'), h = n('hinweis');
  const zahlen = [f ? zahl(f, 'Fehler', 'Fehler') : '', w ? zahl(w, 'Warnung', 'Warnungen') : '', h ? zahl(h, 'Hinweis', 'Hinweise') : ''].filter(Boolean).join(' · ');
  if (f) return { schwere: 'fehler', text: 'Fehler in den Verbindungen', zahlen };
  if (w) return { schwere: 'warnung', text: 'Verbindungen mit Warnungen', zahlen };
  if (h) return { schwere: 'hinweis', text: `Keine Fehler — ${zahl(h, 'Hinweis', 'Hinweise')} offen`, zahlen };
  return { schwere: null, text: 'Alle Verbindungen sauber', zahlen: '' };
}

// ─── Verträge · Sammel-Import von Vorlagen aus einer JSON-Datei (rein, client-sicher, 01.11.) ─────────────────────────────
// Unternehmen › Verträge › Vorlagen › „Vorlagen importieren (Datei)“. Format:
//   { format: 'make-os-vertragsvorlagen', version: 1, arten?: [{ label }], vorlagen: [{ titel, art, fassung?, sprache?, anrede?, paragraphen, felder?, notiz? }] }
// Kennung, Stand, Prüfvermerk, Archiv, Startgerüst und Zeitstempel setzt der Server — aus der Datei wird davon NICHTS übernommen; jede
// importierte Vorlage startet „ungeprüft“. Säuberung und Platzhalter-Prüfung über `vorlageSaeubern` (dieselben Regeln wie Speichern).
// Übernommen wird nur, was es mit diesem Titel UND dieser Art noch nicht gibt (nie überschreiben, auch nicht archivierte). Die Vorschau und die
// Übernahme rechnen mit DERSELBEN Funktion — die Übernahme in der Schreibsperre gegen den dann aktuellen Bestand.
// Der Inhalt der Datei ist Text Dritter: nur gelesen, gesäubert und angezeigt.

import { VERTRAG_GRENZEN, vorlageSaeubern, eigeneArtAus, artLabel, istFesteArt, type VertragVorlage, type VorlagenDatei, type EigeneArt } from './modell';

export const SAMMEL_FORMAT = 'make-os-vertragsvorlagen';
export const SAMMEL_VERSION = 1;
/** Höchstens 2 MB je Datei (sonst 413). */
export const SAMMEL_MAX_BYTES = 2 * 1024 * 1024;
const EIGENE_ARTEN_MAX = 40;
/** Felder einer Vorlage, die aus der Datei kommen dürfen — alles andere setzt der Server. */
const ERLAUBT = ['titel', 'art', 'fassung', 'sprache', 'anrede', 'paragraphen', 'felder', 'notiz'] as const;

export type SammelZustand = 'neu' | 'vorhanden' | 'doppelt' | 'fehler';
export interface SammelZeile { nr: number; titel: string; art: string; artLabel: string; paragraphen: number; felder: number; zustand: SammelZustand; fehler: string[] }
export interface SammelVorschau { zeilen: SammelZeile[]; neu: number; vorhanden: number; fehlerhaft: number; neueArten: EigeneArt[] }
export class SammelFormatFehler extends Error { constructor(msg: string, readonly status: 400 | 413 = 400) { super(msg); } }

/** Titel + Art als Schlüssel für „gibt es schon“ (Groß/Klein und Leerraum egal). */
export const sammelSchluessel = (titel: string, art: string) => `${String(titel ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()}|${art}`;

/** Text der Datei → Objekt (rein). Falsches Format → `SammelFormatFehler` (400), zu groß → 413. */
export function sammelLesen(inhalt: string): unknown {
  if (new TextEncoder().encode(inhalt).length > SAMMEL_MAX_BYTES) throw new SammelFormatFehler('Datei zu groß (höchstens 2 MB).', 413);
  try { return JSON.parse(inhalt.replace(/^﻿/, '')); } catch { throw new SammelFormatFehler('Keine gültige JSON-Datei.'); }
}

/**
 * Datei prüfen (rein): je Vorlage Titel, Art, Zahl der Paragraphen/Felder, Fehler und Zustand; dazu die gesäuberten neuen Vorlagen und die
 * eigenen Arten, die die Übernahme anlegen würde. `neueId(i)` liefert die Kennung (`vv-…`) der i-ten Zeile.
 */
export function sammelPruefen(roh: unknown, bestand: VorlagenDatei, basis: { jetzt: string; person: string; neueId: (i: number) => string }): { vorschau: SammelVorschau; neu: VertragVorlage[]; arten: EigeneArt[] } {
  const o = (roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : null) as Record<string, unknown> | null;
  if (!o || o.format !== SAMMEL_FORMAT) throw new SammelFormatFehler(`Unbekanntes Format — erwartet „${SAMMEL_FORMAT}“.`);
  if (o.version !== SAMMEL_VERSION) throw new SammelFormatFehler(`Unbekannte Version — erwartet ${SAMMEL_VERSION}.`);
  if (!Array.isArray(o.vorlagen)) throw new SammelFormatFehler('„vorlagen“ fehlt.');
  if (o.vorlagen.length > VERTRAG_GRENZEN.vorlagen) throw new SammelFormatFehler(`Höchstens ${VERTRAG_GRENZEN.vorlagen} Vorlagen je Datei.`, 413);
  if (o.arten !== undefined && !Array.isArray(o.arten)) throw new SammelFormatFehler('„arten“ muss eine Liste sein.');

  // Eigene Arten aus der Datei: nur der Name zählt, die Kennung entsteht wie beim Anlegen von Hand.
  const vorhandeneArten = bestand.arten ?? [];
  const dateiArten: EigeneArt[] = [];
  for (const a of (o.arten ?? []) as unknown[]) {
    const label = a && typeof a === 'object' ? (a as Record<string, unknown>).label : a;
    const e = typeof label === 'string' ? eigeneArtAus(label) : null;
    if (!e) throw new SammelFormatFehler('Eine eigene Art braucht einen Namen (mindestens zwei Zeichen).');
    if (!vorhandeneArten.some(x => x.id === e.id) && !dateiArten.some(x => x.id === e.id)) dateiArten.push(e);
  }
  const alleArten = [...vorhandeneArten, ...dateiArten];

  const vergeben = new Set(bestand.vorlagen.map(v => sammelSchluessel(v.titel, v.art)));
  const inDatei = new Set<string>();
  let platz = VERTRAG_GRENZEN.vorlagen - bestand.vorlagen.length;
  const zeilen: SammelZeile[] = [];
  const neu: VertragVorlage[] = [];
  (o.vorlagen as unknown[]).forEach((x, i) => {
    const q = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
    const nurErlaubt: Record<string, unknown> = {};
    for (const k of ERLAUBT) if (q[k] !== undefined) nurErlaubt[k] = q[k];
    const parRoh = Array.isArray(q.paragraphen) ? q.paragraphen : [];
    const feldRoh = Array.isArray(q.felder) ? q.felder : [];
    const titelRoh = typeof q.titel === 'string' ? q.titel.replace(/\s+/g, ' ').trim() : '';
    const art = typeof q.art === 'string' ? q.art : '';
    const z: SammelZeile = { nr: i + 1, titel: titelRoh.slice(0, VERTRAG_GRENZEN.titel), art, artLabel: artLabel(art, alleArten), paragraphen: parRoh.length, felder: feldRoh.length, zustand: 'fehler', fehler: [] };
    if (!Array.isArray(q.paragraphen) || !parRoh.length) z.fehler.push('Keine Paragraphen.');
    if (!istFesteArt(art) && !alleArten.some(a => a.id === art)) z.fehler.push(`Unbekannte Art „${art || '—'}“ — eine feste Art nehmen oder unter „arten“ anlegen.`);
    const r = vorlageSaeubern(nurErlaubt, null, { id: basis.neueId(i), jetzt: basis.jetzt, person: basis.person, eigeneArten: alleArten });
    for (const f of r.fehler) if (!z.fehler.includes(f.text) && !/^Unbekannte Art/.test(f.text)) z.fehler.push(f.text);
    if (z.fehler.length || !r.v) { zeilen.push(z); return; }
    const schluessel = sammelSchluessel(r.v.titel, r.v.art);
    if (vergeben.has(schluessel)) z.zustand = 'vorhanden';
    else if (inDatei.has(schluessel)) z.zustand = 'doppelt';
    else if (platz <= 0) z.fehler.push(`Höchstens ${VERTRAG_GRENZEN.vorlagen} Vorlagen insgesamt.`);
    else { z.zustand = 'neu'; platz--; neu.push({ ...r.v, pruefung: {} }); }
    inDatei.add(schluessel);
    zeilen.push(z);
  });
  const genutzt = new Set(neu.map(v => v.art));
  const arten = dateiArten.filter(a => genutzt.has(a.id));
  if (vorhandeneArten.length + arten.length > EIGENE_ARTEN_MAX) throw new SammelFormatFehler(`Höchstens ${EIGENE_ARTEN_MAX} eigene Arten.`, 413);
  return {
    vorschau: { zeilen, neu: neu.length, vorhanden: zeilen.filter(z => z.zustand === 'vorhanden' || z.zustand === 'doppelt').length, fehlerhaft: zeilen.filter(z => z.zustand === 'fehler').length, neueArten: arten },
    neu, arten,
  };
}

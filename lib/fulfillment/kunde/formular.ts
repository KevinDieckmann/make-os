// ─── Fulfillment · Kunde — Formulare (Playbook, Workbooks): welche, wie weit, Antworten übernehmen (rein, client-sicher; C2, 10.10.; Konzept 5.4/7.2) ──
// Die Formulare eines Falls sind die Bausteine der Art „formular“/„workbook“ mit Fragen, an denen ein Knoten des Falls hängt (`bausteinId`, nicht
// „entfällt“). Die Fragen liest der Fall LIVE aus der Bibliothek (Konzept 7.2); Antworten werden mit der `fassung` des Bausteins gespeichert und bleiben
// über die Frage-Kennung stabil. Was der Kunde über den Link sieht, entscheidet `kundeTauglich` (lib/fulfillment/kunde/sicht.ts).
// Antworten: je Frage höchstens 4.000 Zeichen (413, nie gekürzt), Auswahl nur aus den Optionen, „ja“/„nein“, Zahl als Zahl; leer = Antwort entfernen.
// Stand je Formular-Stand (Fingerabdruck, vom Server mitgegeben) → 409, wenn sich inzwischen etwas geändert hat.

import { TEXT_MAX, ID_FREI, MANDAT_ID } from '../grenzen';
import type { AnwendenErgebnis, Baustein, Fall, FormularStand, Frage, KundeDatei } from '../typen';

/** Kurzer, stabiler Fingerabdruck (FNV-1a, 64 Bit als zwei Hälften) — für Schlüssel, die nach außen gehen (keine Kennungen anderer Bestände). */
export function fnv(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Öffentlicher Schlüssel eines Formulars auf der Kunden-Seite — statt der Baustein-Kennung (Konzept 5.4: keine Kennungen anderer Bestände). */
export const formularSchluessel = (mandatId: string, bausteinId: string): string => `fo-${fnv(`${mandatId}|${bausteinId}`)}`;
/** Schlüssel eines Abschnitts (der Kunde markiert ihn als „fertig“); Fragen ohne Abschnitt bilden den Abschnitt „Allgemein“. */
export const ALLGEMEIN = 'Allgemein';
export const abschnittSchluessel = (abschnitt: string | undefined): string => `ab-${fnv(abschnitt?.trim() || ALLGEMEIN)}`;

const FORMULAR_ARTEN = new Set(['formular', 'workbook']);

/** Die Formulare eines Falls (je Baustein einmal, in der Reihenfolge der Knoten). Ohne Fall: keine. */
export function formulareDesFalls(fall: Pick<Fall, 'knoten'> | null | undefined, bausteine: readonly Baustein[]): Baustein[] {
  if (!fall) return [];
  const nach = new Map(bausteine.map(b => [b.id, b]));
  const raus: Baustein[] = [];
  const gesehen = new Set<string>();
  for (const k of [...fall.knoten].sort((a, b) => a.rang - b.rang || (a.id < b.id ? -1 : 1))) {
    if (!k.bausteinId || k.status === 'entfaellt' || gesehen.has(k.bausteinId)) continue;
    const b = nach.get(k.bausteinId);
    if (!b || !FORMULAR_ARTEN.has(b.art) || !b.fragen?.length) continue;
    gesehen.add(b.id);
    raus.push(b);
  }
  return raus;
}

/** Der gespeicherte Stand eines Formulars (je Mandat und Baustein höchstens einer). */
export const formularStandVon = (d: Pick<KundeDatei, 'formulare'>, mandatId: string, bausteinId: string): FormularStand | null =>
  d.formulare.find(f => f.mandatId === mandatId && f.bausteinId === bausteinId) ?? null;

/** Wie weit ist ein Formular? Anteil der Fragen mit Antwort (0–100, gerundet). */
export function formularProzent(b: Pick<Baustein, 'fragen'>, stand: Pick<FormularStand, 'antworten'> | null): number {
  const fragen = b.fragen ?? [];
  if (!fragen.length) return 0;
  const n = fragen.filter(f => (stand?.antworten[f.id] ?? '').trim()).length;
  return Math.round((n / fragen.length) * 100);
}

/** Durchschnitt über mehrere Formulare (null ohne Formular). */
export function formulareProzent(liste: readonly Baustein[], d: Pick<KundeDatei, 'formulare'>, mandatId: string): number | null {
  if (!liste.length) return null;
  return Math.round(liste.reduce((s, b) => s + formularProzent(b, formularStandVon(d, mandatId, b.id)), 0) / liste.length);
}

/** Die Fragen eines Formulars nach Abschnitten (Reihenfolge wie im Baustein). */
export function abschnitteVon(b: Pick<Baustein, 'fragen'>): { schluessel: string; titel: string; fragen: Frage[] }[] {
  const raus: { schluessel: string; titel: string; fragen: Frage[] }[] = [];
  for (const f of b.fragen ?? []) {
    const titel = f.abschnitt?.trim() || ALLGEMEIN;
    let a = raus.find(x => x.titel === titel);
    if (!a) { a = { schluessel: abschnittSchluessel(titel), titel, fragen: [] }; raus.push(a); }
    a.fragen.push(f);
  }
  return raus;
}

/** Eine Antwort prüfen und in ihre gespeicherte Form bringen ('' = entfernen). Fehler → Satz. */
export function antwortPruefen(f: Frage, roh: unknown): { ok: true; wert: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (roh === null || roh === undefined) return { ok: true, wert: '' };
  if (typeof roh !== 'string' && typeof roh !== 'number' && typeof roh !== 'boolean') return { ok: false, status: 400, fehler: `„${f.frage.slice(0, 60)}“: ungültige Antwort.` };
  const text = String(roh).replace(/\r\n?/g, '\n');
  if (text.length > TEXT_MAX.antwort) return { ok: false, status: 413, fehler: `„${f.frage.slice(0, 60)}“: höchstens ${TEXT_MAX.antwort.toLocaleString('de-DE')} Zeichen (jetzt ${text.length.toLocaleString('de-DE')}). Nichts gespeichert.` };
  const t = text.trim();
  if (!t) return { ok: true, wert: '' };
  if (f.art === 'ja-nein') return t === 'ja' || t === 'nein' ? { ok: true, wert: t } : { ok: false, status: 400, fehler: `„${f.frage.slice(0, 60)}“: bitte „ja“ oder „nein“.` };
  if (f.art === 'auswahl') return (f.optionen ?? []).includes(t) ? { ok: true, wert: t } : { ok: false, status: 400, fehler: `„${f.frage.slice(0, 60)}“: bitte eine der Möglichkeiten wählen.` };
  if (f.art === 'zahl') return /^-?\d{1,13}([.,]\d{1,6})?$/.test(t) ? { ok: true, wert: t } : { ok: false, status: 400, fehler: `„${f.frage.slice(0, 60)}“: bitte eine Zahl.` };
  return { ok: true, wert: f.art === 'text' ? t : text };
}

export interface AntwortenEingabe {
  mandatId: string;
  baustein: Pick<Baustein, 'id' | 'fassung' | 'fragen'>;
  antworten: Record<string, unknown>;
  /** Stand, den der Schreiber gesehen hat (`'neu'` = es gab noch keinen) — weicht er ab: 409. */
  stand?: string;
  /** Abschnitt als „fertig“ markieren (true) bzw. wieder öffnen (false). */
  abschnitt?: string;
  fertig?: boolean;
  quelle: FormularStand['quelle'];
  jetzt: string;
}

/**
 * Antworten eines Formulars übernehmen (rein, alles oder nichts). `standVon` = Fingerabdruck eines Stands (vom Server, Node-Krypto).
 * Nur Fragen des Bausteins; unbekannte Frage → 400. Nichts geändert → ok ohne Änderung.
 */
export function antwortenAnwenden(d: KundeDatei, e: AntwortenEingabe, standVon: (f: FormularStand) => string): AnwendenErgebnis<KundeDatei> {
  if (!MANDAT_ID.test(e.mandatId)) return { ok: false, status: 400, fehler: 'Unzulässige Mandat-Kennung.' };
  const fragen = new Map((e.baustein.fragen ?? []).map(f => [f.id, f]));
  if (!e.antworten || typeof e.antworten !== 'object' || Array.isArray(e.antworten)) return { ok: false, status: 400, fehler: 'Antworten fehlen.' };
  const eintraege = Object.entries(e.antworten);
  if (eintraege.length > Math.max(150, fragen.size)) return { ok: false, status: 413, fehler: 'Zu viele Antworten auf einmal. Nichts gespeichert.' };
  const i = d.formulare.findIndex(f => f.mandatId === e.mandatId && f.bausteinId === e.baustein.id);
  const alt = i >= 0 ? d.formulare[i] : null;
  if (e.stand !== undefined && e.stand !== (alt ? standVon(alt) : 'neu')) {
    return { ok: false, status: 409, fehler: 'Inzwischen hat jemand anderes geantwortet — bitte neu laden; deine Eingaben bleiben im Feld.', konflikte: alt ? [{ id: e.baustein.id, stand: standVon(alt) }] : [] };
  }
  const antworten: Record<string, string> = { ...(alt?.antworten ?? {}) };
  for (const [fid, roh] of eintraege) {
    const f = fragen.get(fid);
    if (!f || !ID_FREI.test(fid)) return { ok: false, status: 400, fehler: 'Unbekannte Frage — bitte neu laden.' };
    const r = antwortPruefen(f, roh);
    if (!r.ok) return r;
    if (r.wert) antworten[fid] = r.wert; else delete antworten[fid];
  }
  let fertig = [...(alt?.fertig ?? [])];
  if (e.abschnitt !== undefined) {
    const schluessel = abschnitteVon(e.baustein).map(a => a.schluessel);
    if (!schluessel.includes(e.abschnitt)) return { ok: false, status: 400, fehler: 'Unbekannter Abschnitt — bitte neu laden.' };
    if (e.fertig === true && !fertig.includes(e.abschnitt)) fertig.push(e.abschnitt);
    if (e.fertig === false) fertig = fertig.filter(x => x !== e.abschnitt);
  }
  const gleich = alt && JSON.stringify(alt.antworten) === JSON.stringify(antworten) && JSON.stringify(alt.fertig) === JSON.stringify(fertig);
  if (gleich) return { ok: true, datei: d, geaendert: [] };
  if (!alt && !Object.keys(antworten).length && !fertig.length) return { ok: true, datei: d, geaendert: [] };
  const neu: FormularStand = { mandatId: e.mandatId, bausteinId: e.baustein.id, fassung: e.baustein.fassung, antworten, fertig, geaendertAm: e.jetzt, quelle: e.quelle };
  const formulare = [...d.formulare];
  if (i >= 0) formulare[i] = neu; else formulare.push(neu);
  return { ok: true, datei: { ...d, formulare }, geaendert: [e.baustein.id] };
}

/** CSV der Antworten (Playbook gehört dem Kunden — Export intern, Konzept 5.4). Formel-Anfänge neutralisiert, Semikolon, BOM. */
export function antwortenCsv(liste: readonly { titel: string; fragen: readonly Frage[]; antworten: Readonly<Record<string, string>> }[]): string {
  const zelle = (t: string) => {
    const x = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
    return /[;"\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  };
  const zeilen = [['Formular', 'Abschnitt', 'Frage', 'Antwort'].join(';')];
  for (const f of liste) for (const q of f.fragen) zeilen.push([f.titel, q.abschnitt?.trim() || ALLGEMEIN, q.frage, f.antworten[q.id] ?? ''].map(zelle).join(';'));
  return `﻿${zeilen.join('\r\n')}\r\n`;
}

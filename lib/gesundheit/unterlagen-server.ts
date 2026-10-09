// ─── Gesundheits-Unterlagen je Person — Server (09.10.) ──────────────────────────────────────────────────────────────────────────
// Lesen und Schreiben des Bestands `gesundheit-unterlagen--<person>` (Metadaten) und der Dateien in der Bild-Ablage (Ordner
// `gesundheit-unterlagen`, verschlüsselt mit AAD `<ordner>/<name>`, atomar). Wer welche Person anfragen darf, entscheidet allein die Route
// (/api/gesundheit/unterlagen: NUR die Person der Sitzung) bzw. der Lauf des Gesundheits-Heads (Thread-Besitzerin) — hier gibt es keinen
// Personen-Parameter von außen. Regeln rein in ./unterlagen.ts.
// Reihenfolge, damit nichts verwaist: Ablegen = erst Datei, dann Eintrag (scheitert der Eintrag, geht die Datei wieder); Löschen = erst Eintrag,
// dann Datei. Protokoll nur Kennung (nie Name, nie Inhalt).

import { createHash } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { bildAblegen, bildEntfernen, bildOeffnen } from '@/lib/store/bild-ablage';
import { neueKennung } from '@/lib/kennung';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import {
  abschnitt, dateiNameVon, groesseText, istBild, notizSaeubern, unterlagenBestand, unterlagenSaeubern, UNTERLAGE_ID, UNTERLAGEN_LEER, UNTERLAGEN_MAX,
  UNTERLAGEN_ORDNER, type Unterlage, type UnterlagenDatei, type UnterlageTyp,
} from './unterlagen';

const PERSON = /^[a-z0-9-]{1,40}$/;

export class UnterlagenFehler extends Error {
  constructor(readonly status: 400 | 404 | 409 | 413 | 415, text: string, readonly extra: Record<string, unknown> = {}) { super(text); }
}

/** Die eigenen Unterlagen einer Person (nur Metadaten) — liest nur, schreibt nie. */
export async function unterlagenLaden(person: string): Promise<Unterlage[]> {
  if (!PERSON.test(person)) return [];
  return unterlagenSaeubern(await loadJson<UnterlagenDatei>(unterlagenBestand(person))).unterlagen;
}

/** Wie viele Unterlagen hat die Person? (Einrichtung, Kontext des Heads — nie Namen.) */
export async function unterlagenAnzahl(person: string): Promise<number> {
  return (await unterlagenLaden(person)).length;
}

/**
 * Eine Unterlage ablegen (Typ schon am Inhalt geprüft — die Route). Die Einwilligung (a) prüft die Route VORHER (`gesundheitSchreibSperre`).
 * Gleicher Inhalt schon da → 409 mit der vorhandenen; über `UNTERLAGEN_MAX` → 413.
 */
export async function unterlageAblegen(person: string, d: { name: string; typ: UnterlageTyp; bytes: Buffer; notiz?: unknown }, jetzt = new Date().toISOString()): Promise<Unterlage> {
  if (!PERSON.test(person)) throw new UnterlagenFehler(400, 'Person ungültig.');
  const n = notizSaeubern(d.notiz);
  if (!n.ok) throw new UnterlagenFehler(n.status, n.fehler);
  const pruefsumme = createHash('sha256').update(d.bytes).digest('hex');
  const vorher = await unterlagenLaden(person);
  const gleich = vorher.find(u => u.pruefsumme === pruefsumme);
  if (gleich) throw new UnterlagenFehler(409, `Diese Datei liegt schon in deinen Unterlagen („${gleich.name}“).`, { unterlage: gleich });
  if (vorher.length >= UNTERLAGEN_MAX) throw new UnterlagenFehler(413, `Höchstens ${UNTERLAGEN_MAX} Unterlagen — bitte erst alte entfernen. Nichts gespeichert.`);
  const eintrag: Unterlage = { id: neueKennung('gu'), name: d.name, typ: d.typ, groesse: d.bytes.length, hochgeladen: jetzt, pruefsumme, ...(n.notiz ? { notiz: n.notiz } : {}) };
  await bildAblegen(UNTERLAGEN_ORDNER, dateiNameVon(eintrag.id), d.bytes);
  try {
    await updateJson<UnterlagenDatei>(unterlagenBestand(person), cur => {
      const alt = unterlagenSaeubern(cur ?? UNTERLAGEN_LEER);
      // In der Sperre noch einmal (zwei Geräte gleichzeitig).
      const doppelt = alt.unterlagen.find(u => u.pruefsumme === pruefsumme);
      if (doppelt) throw new UnterlagenFehler(409, `Diese Datei liegt schon in deinen Unterlagen („${doppelt.name}“).`, { unterlage: doppelt });
      if (alt.unterlagen.length >= UNTERLAGEN_MAX) throw new UnterlagenFehler(413, `Höchstens ${UNTERLAGEN_MAX} Unterlagen — bitte erst alte entfernen. Nichts gespeichert.`);
      return { v: 1, unterlagen: [...alt.unterlagen, eintrag] };
    });
  } catch (e) {
    await bildEntfernen(UNTERLAGEN_ORDNER, dateiNameVon(eintrag.id)).catch(() => {});
    throw e;
  }
  await protokolliere(unterlagenBestand(person), [{ liste: 'unterlagen', op: 'neu', id: eintrag.id }], { art: 'person', person }).catch(() => {});
  return eintrag;
}

/** Eine eigene Unterlage samt Inhalt — oder null (unbekannt, Datei weg bzw. nicht lesbar). */
export async function unterlageLesen(person: string, id: string): Promise<{ eintrag: Unterlage; bytes: Buffer } | null> {
  if (!PERSON.test(person) || !UNTERLAGE_ID.test(id)) return null;
  const eintrag = (await unterlagenLaden(person)).find(u => u.id === id);
  if (!eintrag) return null;
  const bytes = await bildOeffnen(UNTERLAGEN_ORDNER, dateiNameVon(id));
  return bytes ? { eintrag, bytes } : null;
}

/** Eine eigene Unterlage entfernen (Eintrag, dann Datei). false = gab es nicht. Geht immer — auch ohne Einwilligung (Art. 17). */
export async function unterlageEntfernen(person: string, id: string): Promise<boolean> {
  if (!PERSON.test(person) || !UNTERLAGE_ID.test(id)) return false;
  // Erst ohne Sperre nachsehen — fehlt der Bestand, wird nichts angelegt.
  if (!(await unterlagenLaden(person)).some(u => u.id === id)) return false;
  let da = false;
  await updateJson<UnterlagenDatei>(unterlagenBestand(person), cur => {
    const alt = unterlagenSaeubern(cur ?? UNTERLAGEN_LEER);
    da = alt.unterlagen.some(u => u.id === id);
    return da ? { v: 1, unterlagen: alt.unterlagen.filter(u => u.id !== id) } : alt;
  });
  if (!da) return false;
  await bildEntfernen(UNTERLAGEN_ORDNER, dateiNameVon(id));
  await protokolliere(unterlagenBestand(person), [{ liste: 'unterlagen', op: 'geloescht', id }], { art: 'person', person }).catch(() => {});
  return true;
}

/**
 * Konto löschen (lib/datenschutz/konto-daten.ts, VOR dem Entfernen des Bestands): alle Dateien der Person weg. Den Bestand selbst entfernt der
 * Konto-Lauf (PERSON_BESTAENDE). Liefert die Zahl der entfernten Dateien.
 */
export async function unterlagenKontoEntfernen(person: string): Promise<number> {
  const l = await unterlagenLaden(person);
  for (const u of l) await bildEntfernen(UNTERLAGEN_ORDNER, dateiNameVon(u.id));
  return l.length;
}

// ── Für den Gesundheits-Head (lib/agenten/unterlagen-werkzeug.ts) — nur Text, nie Bytes ───────────────────────────────────────

const tag = (iso: string) => iso.slice(0, 10);

/** Die Liste als Text (Name, Datum, Art, Größe, Text ja/nein) — Inhalte Dritter möglich (Dateinamen, Notizen): der Aufrufer kapselt. */
export function unterlagenListeText(l: readonly Unterlage[]): string {
  if (!l.length) return 'Keine Unterlagen hochgeladen.';
  return l.map(u => `- ${u.id} · ${u.name} · ${tag(u.hochgeladen)} · ${istBild(u.typ) ? 'Bild (kein Text lesbar)' : u.typ === 'application/pdf' ? 'PDF' : 'Text'} · ${groesseText(u.groesse)}${u.notiz ? ` · Notiz: ${u.notiz}` : ''}`).join('\n');
}

/**
 * Text einer Unterlage, Abschnitt `teil` (je 30.000 Zeichen). Wirft `UnterlagenFehler` (unbekannt, Bild, nicht lesbar, Teil außerhalb).
 * Rückgabe ohne Kapselung — der Aufrufer setzt Kopfzeile + `fremd()`.
 */
export async function unterlageText(person: string, id: string, teil = 1): Promise<{ eintrag: Unterlage; text: string; teil: number; teile: number; umfang?: string; hinweis?: string }> {
  const d = await unterlageLesen(person, id);
  if (!d) throw new UnterlagenFehler(404, 'Diese Unterlage gibt es nicht (oder sie ist nicht lesbar).');
  if (istBild(d.eintrag.typ)) throw new UnterlagenFehler(415, `„${d.eintrag.name}“ ist ein Bild — Text lässt sich daraus nicht lesen (keine Texterkennung).`);
  const { textAuslesen, NichtLesbar } = await import('@/lib/dateien/text-auslesen');
  let a: Awaited<ReturnType<typeof textAuslesen>>;
  try { a = await textAuslesen(d.bytes, d.eintrag.typ); }
  catch (e) { throw new UnterlagenFehler(415, e instanceof NichtLesbar ? e.message : 'Nicht lesbar.'); }
  const voll = a?.text ?? '';
  const s = abschnitt(voll, teil);
  if (!s) throw new UnterlagenFehler(400, `Teil ${teil} gibt es nicht — „${d.eintrag.name}“ hat ${Math.max(1, Math.ceil(voll.length / 30_000))} Teil(e).`);
  return { eintrag: d.eintrag, ...s, ...(a?.umfang ? { umfang: a.umfang } : {}), ...(a?.hinweis ? { hinweis: a.hinweis } : {}) };
}

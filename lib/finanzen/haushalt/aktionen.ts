// ─── Haushaltsfinanzen: Massenänderungen, serverseitig in einem Schritt ─────
// Was viele Zeilen auf einmal ändert (Regel rückwirkend, Import, Fixkosten
// je Empfänger), läuft hier: erst Vorschau (nichts wird geschrieben), dann
// Übernahme in EINEM gesperrten Schreibvorgang. Wiederholbar: ein zweiter
// Aufruf mit denselben Daten ändert nichts mehr.

import { randomUUID } from 'crypto';
import type { Buchung, Regel, Schuld, Turnus } from './typen';
import { normal, trifft, turnusAus } from './regeln';
import { importAblauf, ausN26Zeilen, ausText, type ImportErgebnis } from './import';
import { ladeHaushalt, aendereBuchungen, aendereStamm, aendereSchulden, aendereMeta, Ungueltig } from './speicher';
import { KREDIT } from './einordnung';
import { katNamen } from './einordnung';

export interface RegelEingabe {
  muster: string; kategorie_id: string | null; ist_umbuchung?: boolean; ganzes_wort?: boolean;
  ist_fixkosten?: boolean; turnus?: Turnus; rueckwirkend?: boolean; buchungId?: string | null;
}

/** Regel lernen (oder schärfen) und auf die gerade bearbeitete + auf Wunsch alle passenden Buchungen anwenden. */
export async function regelLernen(haushalt: string, e: RegelEingabe, vorschau: boolean) {
  const muster = String(e.muster ?? '').trim().slice(0, 120);
  if (!muster) throw new Ungueltig('Muster fehlt.');
  const h = await ladeHaushalt(haushalt);
  if (e.kategorie_id && !h.stamm.kategorien.some(k => k.id === e.kategorie_id)) throw new Ungueltig('Diese Kategorie gibt es nicht.');
  const wort = e.ganzes_wort !== false;
  const treffer = (b: Buchung) => b.id !== e.buchungId && (trifft(muster, b.empfaenger, wort) || trifft(muster, b.beschreibung, wort));
  const anzahl = e.rueckwirkend ? h.buchungen.filter(treffer).length : 0;
  if (vorschau) return { vorschau: true, rueckwirkend: anzahl };

  const aend = { kategorie_id: e.kategorie_id ?? null, ist_umbuchung: !!e.ist_umbuchung, ist_fixkosten: !!e.ist_fixkosten, turnus: e.ist_fixkosten ? turnusAus(e.turnus) : 'monatlich' as Turnus };
  await aendereStamm(haushalt, s => {
    const vorhanden = s.regeln.find(r => normal(r.muster) === normal(muster));
    const regel: Regel = vorhanden
      ? { ...vorhanden, ...aend, ganzes_wort: wort, treffer_zaehler: vorhanden.treffer_zaehler + 1, stand: vorhanden.stand + 1 }
      : { id: randomUUID(), stand: 1, muster, empfaenger: muster, ...aend, ganzes_wort: wort, prioritaet: 100, treffer_zaehler: 0 };
    return { ...s, regeln: [...s.regeln.filter(r => r.id !== regel.id), regel] };
  });
  const jetzt = new Date().toISOString();
  let geaendert = 0;
  await aendereBuchungen(haushalt, liste => liste.map(b => {
    const passt = b.id === e.buchungId || (e.rueckwirkend && treffer(b));
    if (!passt) return b;
    geaendert++;
    return { ...b, ...aend, stand: b.stand + 1, geaendert: jetzt };
  }));
  return { vorschau: false, geaendert };
}

export interface ImportEingabe { konto_id: string; zeilen?: string[]; text?: string; dateiName?: string }

export type ImportAntwort =
  | { ok: false; fehler: string; text: string }
  | { ok: true; gefunden: number; neu: number; schonVorhanden: number; zugeordnet: number; umbuchungen: number; pruefung: ImportOk['pruefung']; zeitraum: ImportOk['zeitraum']; beispiele: ImportOk['neu']; uebernommen: number | null; dateiName: string | null };
type ImportOk = Extract<ImportErgebnis, { ok: true }>;

/** Kontoauszug: Vorschau oder Übernahme. Doppelte Zeilen erkennt der Fingerabdruck — auch innerhalb der Sperre. */
export async function importieren(haushalt: string, person: string | null, e: ImportEingabe, vorschau: boolean): Promise<ImportAntwort> {
  const h = await ladeHaushalt(haushalt);
  const gelesen = Array.isArray(e.zeilen) ? ausN26Zeilen(e.zeilen.map(String).slice(0, 20000)) : ausText(String(e.text ?? '').slice(0, 2_000_000));
  const hashes = new Set(h.buchungen.filter(b => b.zeilen_hash).map(b => `${b.konto_id}|${b.zeilen_hash}`));
  const importId = randomUUID();
  const erg = importAblauf(gelesen, e.konto_id, h.stamm, hashes, importId, person);
  if (!erg.ok) return erg;
  const antwort = { ok: true as const, gefunden: erg.gefunden, neu: erg.neu.length, schonVorhanden: erg.schonVorhanden, zugeordnet: erg.zugeordnet, umbuchungen: erg.umbuchungen, pruefung: erg.pruefung, zeitraum: erg.zeitraum, beispiele: erg.neu.slice(0, 8), uebernommen: null as number | null, dateiName: e.dateiName ?? null };
  if (vorschau) return antwort;

  const jetzt = new Date().toISOString();
  let rein = 0;
  await aendereBuchungen(haushalt, liste => {
    const da = new Set(liste.filter(b => b.zeilen_hash).map(b => `${b.konto_id}|${b.zeilen_hash}`));
    const neu = erg.neu.filter(x => !da.has(`${x.konto_id}|${x.zeilen_hash}`)).map(x => ({ ...x, id: randomUUID(), stand: 1, geaendert: jetzt }) as Buchung);
    rein = neu.length;
    return [...liste, ...neu];
  });
  await aendereMeta(haushalt, m => ({ ...m, importe: [{ id: importId, zeit: jetzt, wer: person, quelle: e.dateiName || 'Einfügung', konto: e.konto_id, neu: rein, schonDa: erg.schonVorhanden + (erg.neu.length - rein), stimmt: erg.pruefung.stimmt }, ...m.importe].slice(0, 200) }));
  return { ...antwort, uebernommen: rein, schonVorhanden: erg.schonVorhanden + (erg.neu.length - rein) };
}

export interface KreditEingabe { buchung_id: string; bezeichnung?: string; glaeubiger?: string; rate?: number | null; zinssatz?: number | null }

/** Kredit-Einnahme wird zur Schuld. Wiederholbar: eine Buchung erzeugt nie zwei Schulden. */
export async function kreditZuSchuld(haushalt: string, e: KreditEingabe) {
  const h = await ladeHaushalt(haushalt);
  const b = h.buchungen.find(x => x.id === e.buchung_id);
  if (!b) throw new Ungueltig('Buchung nicht gefunden.');
  if (b.betrag <= 0) throw new Ungueltig('Ein Kredit ist ein Geldeingang.');
  if (katNamen(h.stamm)(b.kategorie_id) !== KREDIT) throw new Ungueltig(`Die Buchung ist nicht als „${KREDIT}“ eingeordnet.`);
  let schuld: Schuld | undefined;
  let schonDa = false;
  await aendereSchulden(haushalt, liste => {
    const vorhanden = liste.find(s => s.aus_buchung_id === b.id);
    if (vorhanden) { schuld = vorhanden; schonDa = true; return liste; }
    schuld = {
      id: randomUUID(), stand: 1, bezeichnung: String(e.bezeichnung || `Kredit ${b.empfaenger}`).trim().slice(0, 200),
      glaeubiger: String(e.glaeubiger || b.empfaenger || '').trim().slice(0, 200) || null, einheit: b.einheit,
      startbetrag: b.betrag, restbetrag: b.betrag, rate: typeof e.rate === 'number' && e.rate > 0 ? Math.round(e.rate) : null,
      zinssatz: typeof e.zinssatz === 'number' && e.zinssatz > 0 ? e.zinssatz : null, rhythmus: 'monatlich',
      naechste_faelligkeit: null, endet_am: null, notiz: `Automatisch aus der Einnahme vom ${b.datum} angelegt.`, aus_buchung_id: b.id,
    };
    return [...liste, schuld];
  });
  return { schuld, schonDa };
}

/** Alle Buchungen eines Empfängers als Fixkosten markieren (oder nicht) und es als Regel merken. */
export async function fixkostenMarkieren(haushalt: string, name: string, an: boolean, turnus: Turnus) {
  const n = normal(name);
  if (!n) throw new Ungueltig('Empfänger fehlt.');
  const jetzt = new Date().toISOString();
  let anzahl = 0;
  let kategorie: string | null = null;
  await aendereBuchungen(haushalt, liste => liste.map(b => {
    if (normal(b.empfaenger) !== n) return b;
    anzahl++; kategorie = kategorie ?? b.kategorie_id;
    return { ...b, ist_fixkosten: an, turnus, stand: b.stand + 1, geaendert: jetzt };
  }));
  await aendereStamm(haushalt, s => {
    const r = s.regeln.find(x => normal(x.muster) === n);
    if (r) return { ...s, regeln: s.regeln.map(x => x.id === r.id ? { ...x, ist_fixkosten: an, turnus, stand: x.stand + 1 } : x) };
    if (!an) return s;
    return { ...s, regeln: [...s.regeln, { id: randomUUID(), stand: 1, muster: name.trim(), empfaenger: name.trim(), kategorie_id: kategorie, ist_umbuchung: false, ist_fixkosten: true, turnus, ganzes_wort: true, prioritaet: 100, treffer_zaehler: 0 }] };
  });
  return { anzahl };
}

/** Turnus eines Empfängers setzen — auf allen seinen Buchungen und der Regel. */
export async function turnusSetzen(haushalt: string, name: string, turnus: Turnus) {
  const n = normal(name);
  const jetzt = new Date().toISOString();
  let anzahl = 0;
  await aendereBuchungen(haushalt, liste => liste.map(b => {
    if (normal(b.empfaenger) !== n) return b;
    anzahl++;
    return { ...b, turnus, stand: b.stand + 1, geaendert: jetzt };
  }));
  await aendereStamm(haushalt, s => ({ ...s, regeln: s.regeln.map(x => normal(x.muster) === n ? { ...x, turnus, stand: x.stand + 1 } : x) }));
  return { anzahl };
}

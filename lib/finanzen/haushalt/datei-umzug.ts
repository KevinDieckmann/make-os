// ─── Umzug aus Dateien: Malins Sicherung + V1-Export (24.09.) ──────────────
// Kevin: „Wir müssen uns nicht mit Malins Board verbinden. Wir müssen nur
// einmal die Daten sauber aus dem Ordner oder der Datei holen.“
//
// Befund (24.09., nachgerechnet): Malins Sicherung (MAKE.ORGA) endet wegen der
// Supabase-Grenze bei genau 1.000 Buchungen (01.01.–16.05.) — dafür mit ihren
// Kategorien, Regeln, Schulden, Budgets und allen Umbuchungen. Der V1-Export
// (KD-Finanzen-…json, p.bank) deckt alle drei Konten bis 31.08. ab; ohne
// Umbuchungen stimmt er Monat für Monat mit der Sicherung überein. V1 speichert
// Beträge ohne Vorzeichen, die Richtung steht in `_n26t` (in/out).
//
// Zusammensetzen: Sicherung bis zur Naht, V1 ab der Naht. War die Sicherung
// gekappt, gilt der letzte Tag als unvollständig — er kommt aus V1. Auf die
// V1-Buchungen laufen Malins Regeln; Kategorien über Namen und Synonyme.
// Heraus kommen Rohtabellen im Supabase-Format — danach derselbe Weg wie der
// Umzug aus Supabase (umwandeln → Probe-Haushalt → Bericht → Übernahme).

import type { Tabelle } from './supabase-umzug';
import type { Haushalt } from './typen';
import { TABELLEN } from './supabase-umzug';
import { SYNONYME } from './kategorien';
import { normal, anwenden } from './regeln';

type Roh = Record<string, unknown>;
export interface Sicherung { _typ?: string; _erstellt?: string; konten?: Roh[]; kategorien?: Roh[]; zuordnungsregeln?: Roh[]; schulden?: Roh[]; planwerte?: Roh[]; belege?: Roh[]; buchungen?: Roh[] }
export interface V1Buchung { id?: string; dat?: string; nm?: string; bes?: string; bt?: number | string; kat?: string; typ?: string; konto?: string; _n26t?: string }
export interface V1Beleg { id?: string; bes?: string; bet?: number; dat?: string; fae?: string; per?: string; st?: string }
export interface V1Export { _typ?: string; _erstellt?: string; p?: { bank?: V1Buchung[] }; b?: { bel?: V1Beleg[] } }
export interface DateiBericht { naht: string | null; gekappt: boolean; ausSicherung: number; ausV1: number; belegeAusV1: number; v1Ohne: { grund: string; anzahl: number }[]; bis: string | null; hinweise: string[] }

export const GRENZE_SUPABASE = 1000;
export const V1_IMPORT = 'v1-export';
const schl = (n: string) => normal(n).replace(/[^a-z0-9]/g, '');

export function ausDateien(sich: Sicherung, v1: V1Export | null): { roh: Record<Tabelle, { zeilen: Roh[]; gesamt: number }>; bericht: DateiBericht } {
  if (sich._typ && sich._typ !== 'make-orga-sicherung') throw new Error('Das ist keine Sicherung aus Malins Cockpit (make-orga-sicherung).');
  const tab = (t: Tabelle) => (Array.isArray(sich[t]) ? (sich[t] as Roh[]) : []);
  const buchungen = tab('buchungen');
  const daten = buchungen.map(b => String(b.datum ?? '')).filter(Boolean).sort();
  const letzter = daten[daten.length - 1] ?? null;
  const gekappt = buchungen.length === GRENZE_SUPABASE;
  const hinweise: string[] = [];
  const v1Bank = v1?.p?.bank ?? [];
  if (v1 && v1._typ && v1._typ !== 'kd-finanz-backup') hinweise.push(`V1-Datei hat den Typ „${v1._typ}“ — erwartet war „kd-finanz-backup“.`);

  // Naht: ohne V1 alles aus der Sicherung. Mit V1: bei Kappung ist der letzte
  // Tag unvollständig → er kommt ganz aus V1.
  const naht = v1Bank.length ? letzter : null;
  const ausSicherung = naht && gekappt ? buchungen.filter(b => String(b.datum) < naht) : buchungen;
  if (gekappt) hinweise.push(`Die Sicherung ist bei ${GRENZE_SUPABASE} Buchungen abgeschnitten (bis ${letzter}).${v1Bank.length ? ` Ab ${naht} kommen die Buchungen aus dem V1-Export.` : ' Ohne V1-Export fehlt alles danach.'}`);

  // Konten: V1 kennt kevin | malin | gemeinsam.
  const konten = tab('konten');
  const kontoVon = (k?: string) => {
    const n = (k ?? '').toLowerCase();
    return konten.find(x => normal(String(x.inhaber ?? '')) === n || normal(String(x.name ?? '')).includes(n));
  };
  // Kategorien: exakter Name, dann Synonym, dann Schreibvariante.
  const kategorien = tab('kategorien');
  const katVon = (name: string, typ?: 'einnahme' | 'ausgabe' | 'umbuchung') => {
    const ziele = [name, SYNONYME[name]].filter(Boolean) as string[];
    for (const z of ziele) {
      const k = kategorien.find(x => String(x.name) === z) ?? kategorien.find(x => schl(String(x.name)) === schl(z));
      if (k && (!typ || k.typ === typ || (typ === 'ausgabe' && !k.typ))) return String(k.id);
    }
    return null;
  };
  const umbuchungKat = katVon('Umbuchung', 'umbuchung');

  const v1Zeilen: Roh[] = [];
  const ohne = new Map<string, number>();
  const zaehle = (g: string) => ohne.set(g, (ohne.get(g) ?? 0) + 1);
  for (const x of v1Bank) {
    const dat = String(x.dat ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dat)) { zaehle('ohne Datum'); continue; }
    if (naht && (gekappt ? dat < naht : dat <= naht)) continue; // schon in der Sicherung
    const konto = kontoVon(x.konto);
    if (!konto) { zaehle(`Konto „${x.konto ?? '?'}“ unbekannt`); continue; }
    const bt = Math.abs(Number(x.bt));
    if (!Number.isFinite(bt) || bt === 0) { zaehle('Betrag fehlt'); continue; }
    const rein = x._n26t === 'in' || (x._n26t == null && x.typ === 'ein');
    const umbuchung = x.typ === 'skip' || x.typ === 'intern' || x.kat === 'Interner Transfer';
    let kategorie_id: string | null = null;
    if (umbuchung) kategorie_id = umbuchungKat;
    else if (x.kat && x.kat !== 'Sonstiges') kategorie_id = katVon(x.kat, rein ? 'einnahme' : 'ausgabe');
    v1Zeilen.push({
      id: `v1-${x.id ?? `${dat}-${v1Zeilen.length}`}`, konto_id: konto.id, datum: dat, betrag: rein ? bt : -bt,
      beschreibung: x.bes || x.nm || 'Buchung', empfaenger: x.nm ?? '', kategorie_id, ist_umbuchung: umbuchung,
      ist_fixkosten: x.typ === 'fix', turnus: x.typ === 'fix' ? 'monatlich' : null, einheit: 'privat',
      zeilen_hash: `v1-${x.id ?? ''}`, notiz: null, import_id: V1_IMPORT, updated_at: v1?._erstellt ?? null,
    });
  }
  const bisV1 = v1Zeilen.map(z => String(z.datum)).sort().pop() ?? null;
  const bis = [letzter, bisV1].filter(Boolean).sort().pop() ?? null;
  if (bis) hinweise.push(`Buchungen reichen bis ${bis}. Alles danach: N26-Auszüge unter Zahlen › Privat einlesen.`);

  // Belege: Malins Sicherung hatte keine; V1 führt die fehlenden Belege für die
  // Buchhaltung (b.bel, „wartend“) — nur übernehmen, wenn die Sicherung leer ist.
  const v1Belege: Roh[] = tab('belege').length ? [] : (v1?.b?.bel ?? []).filter(x => x.bes).map((x, i) => ({
    id: `v1b-${x.id ?? i}`, art: 'beleg', bezeichnung: x.bes, empfaenger: null, betrag: Number.isFinite(Number(x.bet)) ? Number(x.bet) : null,
    faellig_am: x.fae ?? null, verursacher: x.per ?? null, einheit: 'selbststaendigkeit', erledigt: x.st !== undefined && x.st !== 'wartend',
    bezahlt_am: null, notiz: x.dat ? `aus V1 (Beleg vom ${x.dat})` : 'aus V1', buchung_id: null,
  }));

  const roh = Object.fromEntries(TABELLEN.map(t => {
    const zeilen = t === 'buchungen' ? [...ausSicherung, ...v1Zeilen] : t === 'belege' ? [...tab(t), ...v1Belege] : tab(t);
    return [t, { zeilen, gesamt: zeilen.length }];
  })) as Record<Tabelle, { zeilen: Roh[]; gesamt: number }>;
  return {
    roh,
    bericht: { naht, gekappt, ausSicherung: ausSicherung.length, ausV1: v1Zeilen.length, belegeAusV1: v1Belege.length, v1Ohne: Array.from(ohne.entries()).map(([grund, anzahl]) => ({ grund, anzahl })), bis, hinweise },
  };
}

/**
 * Nach dem Umwandeln: V1-Buchungen ohne Kategorie (in V1 „Sonstiges“) laufen
 * durch Malins Regeln. Was keine Regel trifft, landet bei Ausgaben unter
 * „Sonstiges“, bei Eingängen unter „Noch einzuordnen“ — wie in V1, nur mit
 * dem richtigen Typ.
 */
export function v1Nacharbeiten(h: Haushalt): { haushalt: Haushalt; regelTreffer: number; sonstiges: number; offenEin: number } {
  const katId = (name: string, typ: string) => h.stamm.kategorien.find(k => k.name === name && k.typ === typ)?.id ?? null;
  const sonstigesId = katId('Sonstiges', 'ausgabe'), offenEinId = katId('Noch einzuordnen', 'einnahme');
  let regelTreffer = 0, sonstiges = 0, offenEin = 0;
  const buchungen = h.buchungen.map(b => {
    if (b.import_id !== V1_IMPORT || b.kategorie_id || b.ist_umbuchung) return b;
    const nach = anwenden(b, h.stamm.regeln);
    if (nach.kategorie_id || nach.ist_umbuchung) { regelTreffer++; return nach; }
    if (b.betrag > 0 && offenEinId) { offenEin++; return { ...b, kategorie_id: offenEinId }; }
    if (b.betrag < 0 && sonstigesId) { sonstiges++; return { ...b, kategorie_id: sonstigesId }; }
    return b;
  });
  return { haushalt: { ...h, buchungen }, regelTreffer, sonstiges, offenEin };
}

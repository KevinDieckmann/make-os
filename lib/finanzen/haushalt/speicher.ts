// ─── Haushaltsfinanzen: Speicher ────────────────────────────────────────────
// Fünf Bestände je Haushalt, über local-db (atomar, serialisiert, tägliche
// Sicherung). Name: haushalt-<teil>--<haushalt>, z. B.
// haushalt-buchungen--kevin-malin. Der Test-Haushalt „test“ hat eigene Dateien
// mit erfundenen Daten — Bildschirmfotos zeigen nie echte Beträge.
//
// Schreiben nur über geprüfte Änderungen:
//   • jede Zeile hat einen `stand`; wer eine veraltete Zeile schickt, bekommt
//     einen Konflikt (409) statt still zu überschreiben
//   • Prüfung und Schreiben laufen IN derselben Sperre
//   • mehr als die Hälfte einer Liste auf einmal löschen ist nie Absicht

import { randomUUID } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Beleg, Buchung, Haushalt, Kategorie, Konto, Planwert, Regel, Schuld, Stamm, Zeile } from './typen';
import { EINHEITEN, POSTEN, einheitAus } from './typen';
import { turnusAus } from './regeln';
import { HAUSHALT_OK } from './zugriff';

export type Teil = 'buchungen' | 'stamm' | 'schulden' | 'belege' | 'plan';

export function speicherName(teil: Teil, haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `haushalt-${teil}--${haushalt}`;
}

export interface Meta {
  steuerquote: number | null;            // Annahme für den Mindestumsatz, Prozent
  importe: { id: string; zeit: string; wer: string | null; quelle: string; konto: string | null; neu: number; schonDa: number; stimmt: boolean | null }[];
  umzug: { zeit: string; wer: string | null; ziel: string; zaehlung: Record<string, number>; supabase: Record<string, number> } | null;
}

interface PlanDatei { planwerte: Planwert[]; meta: Meta }

export const leererStamm = (): Stamm => ({ konten: [], kategorien: [], regeln: [], aliase: {} });
export const leereMeta = (): Meta => ({ steuerquote: null, importe: [], umzug: null });

export async function ladeHaushalt(haushalt: string): Promise<Haushalt & { meta: Meta }> {
  const [b, s, sch, bel, p] = await Promise.all([
    loadJson<{ buchungen: Buchung[] }>(speicherName('buchungen', haushalt)),
    loadJson<Stamm>(speicherName('stamm', haushalt)),
    loadJson<{ schulden: Schuld[] }>(speicherName('schulden', haushalt)),
    loadJson<{ belege: Beleg[] }>(speicherName('belege', haushalt)),
    loadJson<PlanDatei>(speicherName('plan', haushalt)),
  ]);
  return {
    stamm: { ...leererStamm(), ...(s ?? {}) },
    buchungen: Array.isArray(b?.buchungen) ? b!.buchungen : [],
    schulden: Array.isArray(sch?.schulden) ? sch!.schulden : [],
    belege: Array.isArray(bel?.belege) ? bel!.belege : [],
    planwerte: Array.isArray(p?.planwerte) ? p!.planwerte : [],
    meta: { ...leereMeta(), ...(p?.meta ?? {}) },
  };
}

// ── Säubern: was von außen kommt, wird geprüft, nie übernommen ─────────────

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const textOderNull = (v: unknown, max: number) => { const t = text(v, max); return t || null; };
const tagOderNull = (v: unknown) => (typeof v === 'string' && TAG.test(v) ? v : null);
const centOderNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const bool = (v: unknown) => v === true;

export class Ungueltig extends Error {}

function einheit(v: unknown) {
  const e = einheitAus(v);
  if (!e) throw new Ungueltig(`Unbekannte Einheit „${String(v)}“ — erlaubt sind ${EINHEITEN.join(', ')}.`);
  return e;
}

export function sauberBuchung(roh: Record<string, unknown>, stamm: Stamm): Omit<Buchung, 'id' | 'stand' | 'geaendert'> {
  const datum = tagOderNull(roh.datum);
  const betrag = centOderNull(roh.betrag);
  if (!datum || betrag === null) throw new Ungueltig('Datum und Betrag werden gebraucht.');
  const konto_id = text(roh.konto_id, 80);
  if (!stamm.konten.some(k => k.id === konto_id)) throw new Ungueltig('Kein gültiges Konto gewählt.');
  const kategorie_id = roh.kategorie_id ? text(roh.kategorie_id, 80) : null;
  if (kategorie_id && !stamm.kategorien.some(k => k.id === kategorie_id)) throw new Ungueltig('Diese Kategorie gibt es nicht.');
  return {
    konto_id, datum, betrag,
    beschreibung: text(roh.beschreibung, 900) || 'Buchung',
    empfaenger: text(roh.empfaenger, 200),
    kategorie_id,
    ist_umbuchung: bool(roh.ist_umbuchung), ist_fixkosten: bool(roh.ist_fixkosten), turnus: turnusAus(roh.turnus),
    einheit: einheit(roh.einheit ?? 'privat'),
    zeilen_hash: textOderNull(roh.zeilen_hash, 120), notiz: textOderNull(roh.notiz, 500),
    import_id: textOderNull(roh.import_id, 80), erfasst_von: textOderNull(roh.erfasst_von, 40),
  };
}

export function sauberSchuld(roh: Record<string, unknown>): Omit<Schuld, 'id' | 'stand'> {
  const bezeichnung = text(roh.bezeichnung, 200);
  if (!bezeichnung) throw new Ungueltig('Bezeichnung fehlt.');
  const start = centOderNull(roh.startbetrag) ?? 0, rest = centOderNull(roh.restbetrag) ?? 0;
  return {
    bezeichnung, glaeubiger: textOderNull(roh.glaeubiger, 200), einheit: einheit(roh.einheit ?? 'privat'),
    startbetrag: Math.max(0, start), restbetrag: Math.max(0, rest), rate: centOderNull(roh.rate),
    zinssatz: typeof roh.zinssatz === 'number' && Number.isFinite(roh.zinssatz) ? roh.zinssatz : null,
    rhythmus: textOderNull(roh.rhythmus, 30) ?? 'monatlich', naechste_faelligkeit: tagOderNull(roh.naechste_faelligkeit),
    endet_am: tagOderNull(roh.endet_am), notiz: textOderNull(roh.notiz, 500), aus_buchung_id: textOderNull(roh.aus_buchung_id, 80),
  };
}

export function sauberBeleg(roh: Record<string, unknown>): Omit<Beleg, 'id' | 'stand'> {
  const bezeichnung = text(roh.bezeichnung, 300);
  if (!bezeichnung) throw new Ungueltig('Ohne Beschreibung weißt du in drei Wochen nicht mehr, worum es ging.');
  const art = roh.art === 'rechnung' ? 'rechnung' : 'beleg';
  return {
    art, bezeichnung, empfaenger: textOderNull(roh.empfaenger, 200), betrag: centOderNull(roh.betrag),
    faellig_am: tagOderNull(roh.faellig_am), verursacher: textOderNull(roh.verursacher, 60), einheit: einheit(roh.einheit ?? 'privat'),
    erledigt: bool(roh.erledigt), bezahlt_am: tagOderNull(roh.bezahlt_am), notiz: textOderNull(roh.notiz, 500), buchung_id: textOderNull(roh.buchung_id, 80),
  };
}

export function sauberPlanwert(roh: Record<string, unknown>): Omit<Planwert, 'id' | 'stand'> {
  const jahr = Number(roh.jahr), monat = Number(roh.monat), sollwert = centOderNull(roh.sollwert);
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100 || !Number.isInteger(monat) || monat < 1 || monat > 12) throw new Ungueltig('Monat ungültig.');
  if (!POSTEN.includes(roh.posten as never)) throw new Ungueltig('Unbekannter Posten.');
  if (sollwert === null) throw new Ungueltig('Sollwert fehlt.');
  return { einheit: einheit(roh.einheit ?? 'privat'), jahr, monat, posten: roh.posten as Planwert['posten'], sollwert, notiz: textOderNull(roh.notiz, 300) };
}

export function sauberKategorie(roh: Record<string, unknown>): Omit<Kategorie, 'id' | 'stand'> {
  const name = text(roh.name, 80);
  if (!name) throw new Ungueltig('Name fehlt.');
  const typ = roh.typ === 'einnahme' || roh.typ === 'umbuchung' ? roh.typ : 'ausgabe';
  return { name, typ, sortierung: Number.isFinite(Number(roh.sortierung)) ? Number(roh.sortierung) : 100, monatsbudget: centOderNull(roh.monatsbudget) };
}

export function sauberKonto(roh: Record<string, unknown>): Omit<Konto, 'id' | 'stand'> {
  const name = text(roh.name, 80);
  if (!name) throw new Ungueltig('Name fehlt.');
  const suffix = text(roh.iban_suffix, 8).replace(/\D/g, '').slice(-4);
  return { name, inhaber: textOderNull(roh.inhaber, 40), einheit: einheit(roh.einheit ?? 'privat'), iban_suffix: suffix || null, bank: textOderNull(roh.bank, 60), waehrung: text(roh.waehrung, 3) || 'EUR', aktiv: roh.aktiv !== false };
}

export function sauberRegel(roh: Record<string, unknown>, stamm: Stamm): Omit<Regel, 'id' | 'stand'> {
  const muster = text(roh.muster, 120);
  if (!muster) throw new Ungueltig('Muster fehlt.');
  const kategorie_id = roh.kategorie_id ? text(roh.kategorie_id, 80) : null;
  if (kategorie_id && !stamm.kategorien.some(k => k.id === kategorie_id)) throw new Ungueltig('Diese Kategorie gibt es nicht.');
  return {
    muster, empfaenger: text(roh.empfaenger, 200) || muster, kategorie_id, ist_umbuchung: bool(roh.ist_umbuchung),
    ist_fixkosten: bool(roh.ist_fixkosten), turnus: turnusAus(roh.turnus), ganzes_wort: roh.ganzes_wort !== false,
    prioritaet: Number.isFinite(Number(roh.prioritaet)) ? Number(roh.prioritaet) : 100, treffer_zaehler: Number(roh.treffer_zaehler) || 0,
  };
}

// ── Änderungen mit Stand-Prüfung ────────────────────────────────────────────

export interface Op { op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string; stand?: number }
export interface Konflikt { id: string; grund: string; aktuell?: unknown }
export type PatchErgebnis = { ok: true; angewandt: number; zeilen: Zeile[] } | { ok: false; status: number; fehler: string; konflikte?: Konflikt[] };

/**
 * Änderungen auf eine Liste anwenden — alles oder nichts.
 * Ein Konflikt (Zeile inzwischen geändert oder gelöscht) lehnt den ganzen
 * Schritt ab und liefert den aktuellen Stand der Zeile zurück.
 */
export function opsAnwenden<E extends Zeile>(
  liste: E[], ops: Op[], saeubern: (roh: Record<string, unknown>) => Omit<E, 'id' | 'stand'>, jetzt: string, mitZeit = false,
): PatchErgebnis & { liste?: E[] } {
  const nachId = new Map(liste.map(x => [x.id, x]));
  const loeschen = ops.filter(o => o.op === 'delete').length;
  if (liste.length >= 10 && loeschen > liste.length / 2) return { ok: false, status: 409, fehler: 'Abgelehnt: das hätte über die Hälfte der Liste gelöscht.' };
  const konflikte: Konflikt[] = [];
  const geaendert: E[] = [];
  for (const o of ops) {
    if (o.op === 'delete') {
      const alt = o.id ? nachId.get(o.id) : undefined;
      if (!alt) { konflikte.push({ id: String(o.id), grund: 'schon weg' }); continue; }
      if (o.stand !== alt.stand) { konflikte.push({ id: alt.id, grund: 'inzwischen geändert', aktuell: alt }); continue; }
      nachId.delete(alt.id);
      continue;
    }
    const roh = o.eintrag ?? {};
    const id = typeof roh.id === 'string' && roh.id ? roh.id : null;
    const alt = id ? nachId.get(id) : undefined;
    if (alt && o.stand !== alt.stand) { konflikte.push({ id: alt.id, grund: 'inzwischen geändert', aktuell: alt }); continue; }
    if (id && !alt && o.stand !== undefined) { konflikte.push({ id, grund: 'inzwischen gelöscht' }); continue; }
    const sauber = saeubern(roh);
    const neu = { ...sauber, id: alt?.id ?? id ?? randomUUID(), stand: (alt?.stand ?? 0) + 1, ...(mitZeit ? { geaendert: jetzt } : {}) } as unknown as E;
    nachId.set(neu.id, neu);
    geaendert.push(neu);
  }
  if (konflikte.length) return { ok: false, status: 409, fehler: 'Jemand hat inzwischen geändert — bitte neu laden und noch einmal.', konflikte };
  return { ok: true, angewandt: ops.length, zeilen: geaendert, liste: Array.from(nachId.values()) };
}

/** Eine Liste eines Haushalts in einem Schritt ändern (Prüfung innerhalb der Schreibsperre). */
export async function patchen(haushalt: string, teil: Exclude<Teil, 'stamm'> | 'konten' | 'kategorien' | 'regeln', ops: Op[]): Promise<PatchErgebnis> {
  const jetzt = new Date().toISOString();
  let ergebnis: PatchErgebnis = { ok: false, status: 400, fehler: 'Unbekannter Teil.' };
  const stamm = teil === 'buchungen' ? (await ladeHaushalt(haushalt)).stamm : null;
  const lauf = <E extends Zeile>(datei: Teil, feld: string, saeubern: (r: Record<string, unknown>) => Omit<E, 'id' | 'stand'>, mitZeit = false) =>
    updateJson<Record<string, unknown>>(speicherName(datei, haushalt), aktuell => {
      const f = aktuell ?? {};
      const liste = (Array.isArray(f[feld]) ? f[feld] : []) as E[];
      try {
        const e = opsAnwenden<E>(liste, ops, saeubern, jetzt, mitZeit);
        if (!e.ok) { ergebnis = e; return f; }
        ergebnis = { ok: true, angewandt: e.angewandt, zeilen: e.zeilen };
        return { ...(datei === 'stamm' ? { ...leererStamm(), ...f } : f), [feld]: e.liste };
      } catch (err) {
        ergebnis = { ok: false, status: 400, fehler: err instanceof Ungueltig ? err.message : 'Eingabe nicht verwertbar.' };
        return f;
      }
    });
  if (teil === 'buchungen') await lauf<Buchung>('buchungen', 'buchungen', r => ({ ...sauberBuchung(r, stamm!), geaendert: jetzt }), true);
  else if (teil === 'schulden') await lauf<Schuld>('schulden', 'schulden', sauberSchuld);
  else if (teil === 'belege') await lauf<Beleg>('belege', 'belege', sauberBeleg);
  else if (teil === 'plan') await lauf<Planwert>('plan', 'planwerte', sauberPlanwert);
  else if (teil === 'konten') await lauf<Konto>('stamm', 'konten', sauberKonto);
  else if (teil === 'kategorien') await lauf<Kategorie>('stamm', 'kategorien', sauberKategorie);
  else if (teil === 'regeln') {
    const s = (await ladeHaushalt(haushalt)).stamm;
    await lauf<Regel>('stamm', 'regeln', r => sauberRegel(r, s));
  }
  return ergebnis;
}

/** Ganze Bestände setzen (Umzug, Testdaten). Nur serverseitig, nie aus dem Browser. */
export async function setzeHaushalt(haushalt: string, h: Haushalt, meta?: Partial<Meta>): Promise<void> {
  await updateJson(speicherName('stamm', haushalt), () => h.stamm);
  await updateJson(speicherName('buchungen', haushalt), () => ({ buchungen: h.buchungen }));
  await updateJson(speicherName('schulden', haushalt), () => ({ schulden: h.schulden }));
  await updateJson(speicherName('belege', haushalt), () => ({ belege: h.belege }));
  await updateJson<PlanDatei>(speicherName('plan', haushalt), cur => ({ planwerte: h.planwerte, meta: { ...leereMeta(), ...(cur?.meta ?? {}), ...(meta ?? {}) } }));
}

export async function aendereMeta(haushalt: string, mut: (m: Meta) => Meta): Promise<Meta> {
  const next = await updateJson<PlanDatei>(speicherName('plan', haushalt), cur => ({ planwerte: cur?.planwerte ?? [], meta: mut({ ...leereMeta(), ...(cur?.meta ?? {}) }) }));
  return next.meta;
}

export async function aendereBuchungen(haushalt: string, mut: (l: Buchung[]) => Buchung[]): Promise<Buchung[]> {
  const n = await updateJson<{ buchungen: Buchung[] }>(speicherName('buchungen', haushalt), cur => ({ buchungen: mut(Array.isArray(cur?.buchungen) ? cur!.buchungen : []) }));
  return n.buchungen;
}

export async function aendereStamm(haushalt: string, mut: (s: Stamm) => Stamm): Promise<Stamm> {
  return updateJson<Stamm>(speicherName('stamm', haushalt), cur => mut({ ...leererStamm(), ...(cur ?? {}) }));
}

export async function aendereSchulden(haushalt: string, mut: (l: Schuld[]) => Schuld[]): Promise<Schuld[]> {
  const n = await updateJson<{ schulden: Schuld[] }>(speicherName('schulden', haushalt), cur => ({ schulden: mut(Array.isArray(cur?.schulden) ? cur!.schulden : []) }));
  return n.schulden;
}

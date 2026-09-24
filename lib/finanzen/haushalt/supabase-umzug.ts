// ─── Umzug aus Malins Cockpit (Supabase) ────────────────────────────────────
// Kevin, 24.09.: „Alles nach MAKE OS umziehen.“ Gelesen wird direkt aus
// Supabase — nicht aus Malins Sicherungsdatei: die holt höchstens 1.000
// Buchungen (Supabase liefert je Abfrage höchstens 1.000 Zeilen, ihr Cockpit
// blättert nicht weiter). Hier wird geblättert, und jede Tabelle wird gegen
// die EXAKTE Zeilenzahl geprüft, die Supabase selbst meldet.
//
// Anmeldung: mit dem eigenen Supabase-Zugang (Kevin oder Malin, beide stehen
// in Malins Mitgliederliste). Das Passwort geht nur an Supabase und wird nicht
// gespeichert, nicht protokolliert.

import type { Beleg, Buchung, Haushalt, Kategorie, Konto, Planwert, Regel, Schuld } from './typen';
import { einheitAus, zuCent, POSTEN } from './typen';
import { turnusAus } from './regeln';

export const TABELLEN = ['konten', 'kategorien', 'zuordnungsregeln', 'schulden', 'planwerte', 'belege', 'buchungen'] as const;
export type Tabelle = typeof TABELLEN[number];
type Roh = Record<string, unknown>;
type Holer = typeof fetch;

export interface Verbindung { url: string; schluessel: string }

export function verbindungAusUmgebung(): Verbindung | null {
  const url = process.env.MAKE_ORGA_URL?.trim(), schluessel = process.env.MAKE_ORGA_KEY?.trim();
  return url && schluessel && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ? { url, schluessel } : null;
}

export async function anmelden(v: Verbindung, email: string, passwort: string, holer: Holer = fetch): Promise<string> {
  const r = await holer(`${v.url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: v.schluessel, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwort }), signal: AbortSignal.timeout(20_000),
  });
  const d = await r.json().catch(() => ({})) as { access_token?: string; error_description?: string; msg?: string };
  if (!r.ok || !d.access_token) throw new Error(r.status === 400 ? 'E-Mail oder Passwort stimmt nicht.' : `Anmeldung bei Supabase fehlgeschlagen (${r.status}).`);
  return d.access_token;
}

/** Eine Tabelle vollständig lesen, in Blöcken zu 1.000, mit exakter Zählung. */
export async function tabelleLesen(v: Verbindung, token: string, tabelle: Tabelle, holer: Holer = fetch): Promise<{ zeilen: Roh[]; gesamt: number }> {
  const ordnung = tabelle === 'buchungen' ? 'datum.asc,id.asc' : 'id.asc';
  const zeilen: Roh[] = [];
  let gesamt = -1;
  for (let von = 0; von < 1_000_000; von += 1000) {
    const r = await holer(`${v.url}/rest/v1/${tabelle}?select=*&order=${ordnung}`, {
      headers: { apikey: v.schluessel, Authorization: `Bearer ${token}`, 'Range-Unit': 'items', Range: `${von}-${von + 999}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(30_000),
    });
    if (r.status === 401 || r.status === 403) throw new Error(`Supabase verweigert „${tabelle}“ — steht dieser Zugang in Malins Mitgliederliste?`);
    if (!r.ok && r.status !== 206) throw new Error(`Supabase: „${tabelle}“ nicht lesbar (${r.status}).`);
    const teil = await r.json() as Roh[];
    const bereich = r.headers.get('content-range') ?? '';
    const m = bereich.match(/\/(\d+)$/);
    if (m) gesamt = Number(m[1]);
    zeilen.push(...teil);
    if (!teil.length || (gesamt >= 0 && zeilen.length >= gesamt)) break;
  }
  if (gesamt < 0) gesamt = zeilen.length;
  return { zeilen, gesamt };
}

// ── Umwandeln: Supabase-Zeilen → MAKE-OS-Bestand ───────────────────────────

const BEKANNT: Record<Tabelle, string[]> = {
  konten: ['id', 'name', 'inhaber', 'einheit', 'iban_suffix', 'bank', 'waehrung', 'aktiv', 'created_at'],
  kategorien: ['id', 'name', 'typ', 'sortierung', 'monatsbudget'],
  zuordnungsregeln: ['id', 'muster', 'empfaenger', 'kategorie_id', 'ist_umbuchung', 'ganzes_wort', 'prioritaet', 'treffer_zaehler', 'created_at', 'turnus', 'ist_fixkosten'],
  schulden: ['id', 'bezeichnung', 'glaeubiger', 'einheit', 'startbetrag', 'restbetrag', 'rate', 'zinssatz', 'rhythmus', 'naechste_faelligkeit', 'endet_am', 'notiz', 'created_at', 'updated_at', 'aus_buchung_id'],
  planwerte: ['id', 'einheit', 'jahr', 'monat', 'posten', 'sollwert', 'notiz'],
  belege: ['id', 'buchung_id', 'bezeichnung', 'faellig_am', 'verursacher', 'erledigt', 'created_at', 'art', 'betrag', 'empfaenger', 'einheit', 'notiz', 'bezahlt_am'],
  buchungen: ['id', 'konto_id', 'datum', 'betrag', 'beschreibung', 'empfaenger', 'kategorie_id', 'ist_umbuchung', 'einheit', 'import_id', 'zeilen_hash', 'notiz', 'erfasst_von', 'created_at', 'updated_at', 'turnus', 'ist_fixkosten'],
};

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const sOderNull = (v: unknown) => (s(v).trim() ? s(v).trim() : null);
const tag = (v: unknown) => { const t = s(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };

export interface Umzugsbericht {
  stichtag: string;
  zaehlung: Record<Tabelle, { supabase: number; gelesen: number; uebernommen: number; abgewiesen: number }>;
  summen: { konto: string; monat: string; anzahl: number; summe: number }[];
  unbekannteFelder: Partial<Record<Tabelle, string[]>>;
  abgewiesen: { tabelle: Tabelle; id: string; grund: string }[];
  hinweise: string[];
  zeitraum: { von: string; bis: string } | null;
}

export function umwandeln(roh: Record<Tabelle, { zeilen: Roh[]; gesamt: number }>, jetzt = new Date().toISOString()): { haushalt: Haushalt; bericht: Umzugsbericht } {
  const abgewiesen: Umzugsbericht['abgewiesen'] = [];
  const weg = (tabelle: Tabelle, r: Roh, grund: string) => { abgewiesen.push({ tabelle, id: s(r.id), grund }); return null; };
  const einheit = (tabelle: Tabelle, r: Roh) => { const e = einheitAus(r.einheit); return e ?? weg(tabelle, r, `unbekannte Einheit „${s(r.einheit)}“`); };

  const konten: Konto[] = [];
  for (const r of roh.konten.zeilen) {
    const e = einheit('konten', r); if (!e) continue;
    konten.push({ id: s(r.id), stand: 1, name: s(r.name) || 'Konto', inhaber: sOderNull(r.inhaber), einheit: e, iban_suffix: sOderNull(r.iban_suffix)?.replace(/\D/g, '').slice(-4) || null, bank: sOderNull(r.bank), waehrung: s(r.waehrung) || 'EUR', aktiv: r.aktiv !== false });
  }
  const kategorien: Kategorie[] = roh.kategorien.zeilen.map(r => ({
    id: s(r.id), stand: 1, name: s(r.name), typ: r.typ === 'einnahme' || r.typ === 'umbuchung' ? r.typ : 'ausgabe',
    sortierung: Number(r.sortierung) || 100, monatsbudget: r.monatsbudget === null || r.monatsbudget === undefined ? null : zuCent(r.monatsbudget),
  }));
  const kontoIds = new Set(konten.map(k => k.id)), katIds = new Set(kategorien.map(k => k.id));
  const hinweise: string[] = [];
  let katWeg = 0;
  const kat = (v: unknown) => { const id = sOderNull(v); if (id && !katIds.has(id)) { katWeg++; return null; } return id; };

  const regeln: Regel[] = roh.zuordnungsregeln.zeilen.filter(r => s(r.muster).trim()).map(r => ({
    id: s(r.id), stand: 1, muster: s(r.muster).trim(), empfaenger: s(r.empfaenger) || s(r.muster), kategorie_id: kat(r.kategorie_id),
    ist_umbuchung: r.ist_umbuchung === true, ist_fixkosten: r.ist_fixkosten === true, turnus: turnusAus(r.turnus),
    ganzes_wort: r.ganzes_wort !== false, prioritaet: Number(r.prioritaet) || 100, treffer_zaehler: Number(r.treffer_zaehler) || 0,
  }));

  const buchungen: Buchung[] = [];
  for (const r of roh.buchungen.zeilen) {
    const datum = tag(r.datum), betrag = zuCent(r.betrag);
    if (!datum || betrag === null) { weg('buchungen', r, 'Datum oder Betrag fehlt'); continue; }
    if (!kontoIds.has(s(r.konto_id))) { weg('buchungen', r, 'Konto unbekannt'); continue; }
    const e = einheit('buchungen', r); if (!e) continue;
    buchungen.push({
      id: s(r.id), stand: 1, konto_id: s(r.konto_id), datum, betrag, beschreibung: s(r.beschreibung) || 'Buchung', empfaenger: s(r.empfaenger),
      kategorie_id: kat(r.kategorie_id), ist_umbuchung: r.ist_umbuchung === true, ist_fixkosten: r.ist_fixkosten === true, turnus: turnusAus(r.turnus),
      einheit: e, zeilen_hash: sOderNull(r.zeilen_hash), notiz: sOderNull(r.notiz), import_id: sOderNull(r.import_id), erfasst_von: null,
      geaendert: s(r.updated_at) || jetzt,
    });
  }
  const buchungIds = new Set(buchungen.map(b => b.id));

  const schulden: Schuld[] = [];
  for (const r of roh.schulden.zeilen) {
    const e = einheit('schulden', r); if (!e) continue;
    schulden.push({
      id: s(r.id), stand: 1, bezeichnung: s(r.bezeichnung) || 'Schuld', glaeubiger: sOderNull(r.glaeubiger), einheit: e,
      startbetrag: zuCent(r.startbetrag) ?? 0, restbetrag: zuCent(r.restbetrag) ?? 0, rate: r.rate === null || r.rate === undefined ? null : zuCent(r.rate),
      zinssatz: r.zinssatz === null || r.zinssatz === undefined ? null : Number(r.zinssatz), rhythmus: sOderNull(r.rhythmus),
      naechste_faelligkeit: tag(r.naechste_faelligkeit), endet_am: tag(r.endet_am), notiz: sOderNull(r.notiz),
      aus_buchung_id: sOderNull(r.aus_buchung_id) && buchungIds.has(s(r.aus_buchung_id)) ? s(r.aus_buchung_id) : null,
    });
  }
  const planwerte: Planwert[] = [];
  for (const r of roh.planwerte.zeilen) {
    const e = einheit('planwerte', r); if (!e) continue;
    if (!POSTEN.includes(r.posten as never)) { weg('planwerte', r, `unbekannter Posten „${s(r.posten)}“`); continue; }
    planwerte.push({ id: s(r.id), stand: 1, einheit: e, jahr: Number(r.jahr), monat: Number(r.monat), posten: r.posten as Planwert['posten'], sollwert: zuCent(r.sollwert) ?? 0, notiz: sOderNull(r.notiz) });
  }
  const belege: Beleg[] = [];
  for (const r of roh.belege.zeilen) {
    const e = einheit('belege', r); if (!e) continue;
    belege.push({
      id: s(r.id), stand: 1, art: r.art === 'rechnung' ? 'rechnung' : 'beleg', bezeichnung: s(r.bezeichnung) || 'Beleg', empfaenger: sOderNull(r.empfaenger),
      betrag: r.betrag === null || r.betrag === undefined ? null : zuCent(r.betrag), faellig_am: tag(r.faellig_am), verursacher: sOderNull(r.verursacher),
      einheit: e, erledigt: r.erledigt === true, bezahlt_am: tag(r.bezahlt_am), notiz: sOderNull(r.notiz),
      buchung_id: sOderNull(r.buchung_id) && buchungIds.has(s(r.buchung_id)) ? s(r.buchung_id) : null,
    });
  }
  if (katWeg) hinweise.push(`${katWeg} Verweise auf nicht vorhandene Kategorien wurden auf „offen“ gesetzt.`);

  const unbekannteFelder: Umzugsbericht['unbekannteFelder'] = {};
  for (const t of TABELLEN) {
    const extra = new Set<string>();
    for (const r of roh[t].zeilen) for (const k of Object.keys(r)) if (!BEKANNT[t].includes(k)) extra.add(k);
    if (extra.size) unbekannteFelder[t] = Array.from(extra).sort();
  }
  const uebernommen: Record<Tabelle, number> = { konten: konten.length, kategorien: kategorien.length, zuordnungsregeln: regeln.length, schulden: schulden.length, planwerte: planwerte.length, belege: belege.length, buchungen: buchungen.length };
  const zaehlung = Object.fromEntries(TABELLEN.map(t => [t, {
    supabase: roh[t].gesamt, gelesen: roh[t].zeilen.length, uebernommen: uebernommen[t],
    abgewiesen: abgewiesen.filter(a => a.tabelle === t).length,
  }])) as Umzugsbericht['zaehlung'];
  for (const t of TABELLEN) if (roh[t].gesamt !== roh[t].zeilen.length) hinweise.push(`„${t}“: Supabase meldet ${roh[t].gesamt} Zeilen, gelesen wurden ${roh[t].zeilen.length}.`);

  const summenMap = new Map<string, { konto: string; monat: string; anzahl: number; summe: number }>();
  const kontoName = new Map(konten.map(k => [k.id, k.name]));
  for (const b of buchungen) {
    const k = `${b.konto_id}|${b.datum.slice(0, 7)}`;
    const e = summenMap.get(k) ?? { konto: kontoName.get(b.konto_id) ?? b.konto_id, monat: b.datum.slice(0, 7), anzahl: 0, summe: 0 };
    e.anzahl++; e.summe += b.betrag; summenMap.set(k, e);
  }
  const daten = buchungen.map(b => b.datum).sort();
  return {
    haushalt: { stamm: { konten, kategorien, regeln, aliase: {} }, buchungen, schulden, belege, planwerte },
    bericht: {
      stichtag: jetzt, zaehlung, summen: Array.from(summenMap.values()).sort((a, b) => a.monat.localeCompare(b.monat) || a.konto.localeCompare(b.konto)),
      unbekannteFelder, abgewiesen, hinweise, zeitraum: daten.length ? { von: daten[0], bis: daten[daten.length - 1] } : null,
    },
  };
}

/** Alles lesen (blätternd, mit exakter Zählung) und umwandeln. */
export async function ausSupabaseLesen(v: Verbindung, email: string, passwort: string, holer: Holer = fetch) {
  const token = await anmelden(v, email, passwort, holer);
  const roh = {} as Record<Tabelle, { zeilen: Roh[]; gesamt: number }>;
  for (const t of TABELLEN) roh[t] = await tabelleLesen(v, token, t, holer);
  return { roh, ...umwandeln(roh) };
}

/**
 * Probe in den echten Haushalt übernehmen, ohne in MAKE OS Geändertes zu
 * überschreiben: gleiche Kennung + in MAKE OS bearbeitet (stand > 1) → MAKE OS
 * gewinnt. Was es nur in MAKE OS gibt, bleibt.
 */
export function zusammenfuehren<T extends { id: string; stand: number }>(echt: T[], probe: T[]): { liste: T[]; neu: number; ersetzt: number; behalten: number; nurMakeOs: number } {
  const nachId = new Map(echt.map(x => [x.id, x]));
  let neu = 0, ersetzt = 0, behalten = 0;
  const probeIds = new Set(probe.map(x => x.id));
  for (const p of probe) {
    const e = nachId.get(p.id);
    if (!e) { nachId.set(p.id, p); neu++; }
    else if (e.stand > 1) behalten++;
    else { nachId.set(p.id, p); ersetzt++; }
  }
  const nurMakeOs = echt.filter(x => !probeIds.has(x.id)).length;
  return { liste: Array.from(nachId.values()), neu, ersetzt, behalten, nurMakeOs };
}

// ─── Prozesse · Werkstatt — Testdaten je Prozess (22.10., „Werkstatt bau-fertig“ Punkte 7–11; research/prozesse/WERKSTATT_BAUFERTIG.md) ───────────────────
// Der Probelauf spielt einen Prozess mit dem erfundenen Beispiel-Fall durch (lib/prozesse/lauf-server.ts `probelauf`). Hier steht das Beispiel als EINE Quelle
// (Server UND Browser — die Werkstatt zeigt damit die Vorschau „würde …“, ohne zu fragen) und die Testdaten, die ein Prozess dazu tragen darf (optionales Feld
// `ProzessEintrag.testdaten`, gesäubert in lib/prozesse/bestand.ts):
//   · `platzhalter` / `felder` / `empfaenger` — eigene Beispiel-Werte („Beispiel bearbeiten“). IMMER erfunden: Mail-Adressen nur unter `.invalid`, Telefonnummern nur
//     als Platzhalter (nach der Vorwahl nur Nullen), keine IBAN — `testdatenPruefen` lehnt sonst ab (nie still gekürzt). Ein echter Fall bleibt im Schatten: der
//     Probelauf liest ihn live mit den Rechten der Person, gespeichert wird von ihm nichts.
//   · `annahmen` — „Weg annehmen“ je Raute, Freigabe und Warten: Kennung des Knotens → Ausgang (nur Kennungen). Ohne Annahme nimmt der Probelauf wie bisher den
//     Hauptweg; mit ihr zeigt er den anderen Weg.
// Webhook-Eingänge sind fremder Text — nie Testdaten: das Beispiel eines Webhooks entsteht aus seinem Felder-Schema (`webhookBeispiel`).
// Rein und client-sicher; Tests: tests/prozesse-werkstatt-testdaten.test.ts.

import { FELD_KENNUNG, type FallArt, type ProzessForm, type ProzessKnoten, type WebhookFeld } from './definition';
import { PLATZHALTER_JE_FALL } from './baustein-katalog';
import type { LaufAusgang } from './lauf-typen';

type K = ProzessKnoten<ProzessForm>;
export type TestWert = string | number | boolean;

/** Testdaten eines Prozesses — alle Teile optional, alles erfunden. */
export interface ProzessTestdaten {
  /** Werte für Textvorlagen (`kontakt.vorname`, `firma.name` …) — nur Platzhalter, die es für eine Fall-Art gibt. */
  platzhalter?: Record<string, string>;
  /** Felder des Falls für Rauten, Ziel und Abbruch (`lead.score`, `deal.stufe` …). */
  felder?: Record<string, TestWert>;
  /** Der erfundene Empfänger (Mail nur `*.invalid`, Telefon nur Platzhalter). */
  empfaenger?: { name?: string; email?: string; telefon?: string };
  /** „Weg annehmen“: Kennung des Knotens → Ausgang (Raute ja/nein, Freigabe freigegeben/abgelehnt/abgelaufen, Warten eingetreten/abgelaufen). */
  annahmen?: Record<string, LaufAusgang>;
  am?: string; von?: string;
}

// ══ Das Beispiel (erfunden — dieselben Werte wie bisher im Motor) ═══════════════════════════════════════════════════════════════════════════════

export const BEISPIEL_FELDER: Readonly<Record<string, TestWert>> = {
  'deal.stufe': 'angebot', 'deal.wert': 1000, 'lead.status': 'qualifizierung', 'lead.temperatur': 'warm', 'lead.score': 60, 'lead.bean': 'N', 'lead.sql-bereit': true, 'lead.mql': true,
  'mandat.status': 'aktiv', 'firma.lead-status': 'im_gespraech', 'event.reihe': '', 'kampagne.status': 'aktiv',
  // Felder der Vorlagen (Kundengewinnung) — erfunden, damit der Probelauf mit dem Beispiel den ganzen Weg zeigt.
  'firma.daten-fehlen': true, 'firma.bester-kanal': 'telefon', 'lead.bester-kanal': 'mail', 'lead.ampel-mail': 'gruen', 'lead.ampel-telefon': 'gelb',
  'deal.ampel': 'gelb', 'deal.offen': true, 'deal.verschoben': 0, 'deal.mandat-da': false, 'deal.ampel-mail': 'gruen',
  // 22.10. spät (lib/prozesse/kundengewinnung/fall-felder-server.ts) — der Hauptweg jeder Raute, erfunden.
  'deal.vertrag-unterschrieben': false, 'deal.nachfass-followup': false, 'lead.zustaendig': 'beispiel', 'lead.neue-signale': true, 'lead.geantwortet': true, 'lead.waerme-gestiegen': false,
  'lead.mail-fach': 'antworten', 'lead.gespraech-zugeordnet': false, 'lead.anfrage-kanal': 'mail', 'lead.buchung-folge': 'qualifizierung', 'lead.nachweis-vollstaendig': true,
  'lead.einladungsweg': 'mail', 'lead.danke-moeglich': true, 'lead.netzwerken-schritt': 'qualifizieren', 'lead.kampagnen-ergebnis': 'chance',
  'mandat.ampel': 'gruen', 'mandat.health': 80, 'mandat.verlaengerung': 'manuell', 'mandat.verlaengert': false, 'mandat.ampel-mail': 'gruen',
  'event.mix-erreicht': true, 'event.quote-48h': 90,
  // Kunden-Begleitung (22.10., B2) — der Hauptweg der Begleit-Vorlagen, erfunden.
  'fall.status': 'laeuft', 'fall.phase': 'Umsetzung', 'fall.wartet-kunde': 1, 'fall.bestaetigung-offen': true, 'fall.willkommen-offen': true, 'fall.report-faellig': true,
  'fall.puls-kritisch': true, 'fall.puls-gespraech-offen': false,
};
export const BEISPIEL_PLATZHALTER: Readonly<Record<string, string>> = {
  'kontakt.anrede': 'Sie', 'kontakt.vorname': 'Erika', 'kontakt.nachname': 'Beispiel', 'firma.name': 'Beispiel GmbH', 'deal.titel': 'Beispiel-Deal', 'mandat.titel': 'Beispiel-Mandat', 'event.titel': 'Beispiel-Abend', 'kampagne.titel': 'Beispiel-Kampagne',
  'kontakt.gruss': 'Guten Tag Erika Beispiel', 'kunde.gruss': 'Guten Tag Erika Beispiel', 'fall.phase': 'Umsetzung', 'fall.termin': '2026-11-05',
  'absender.name': 'Beispiel Beratung GmbH', 'deal.stufe': 'Angebot', 'deal.naechster-schritt': 'Rückfragen zum Angebot klären',
};
export const BEISPIEL_EMPFAENGER_WERTE = { kontaktId: 'c-beispiel', name: 'Erika Beispiel', email: 'erika@example.invalid', telefon: '+49 000 0000000' } as const;

// ══ Prüfung: nur erfundene Werte ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Grenzen der Testdaten (darüber 413 im Schreibweg — nie gekürzt). */
export const TESTDATEN_GRENZEN = { platzhalter: 80, felder: 120, annahmen: 200, text: 300 } as const;
/** Nur Adressen unter der reservierten Endung `.invalid` (RFC 2606) — sie gehören nie einer echten Person. */
export const ERFUNDENE_MAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.invalid$/i;
/** Platzhalter-Telefon: optional „+“ und Vorwahl, danach nur Nullen (z. B. „+49 000 0000000“). */
export const PLATZHALTER_TELEFON = /^(\+\d{1,3}[ -]?)?0[0 -]*$/;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}\b/;
/** Ausgänge, die „Weg annehmen“ setzen darf. */
export const ANNAHME_AUSGAENGE: readonly LaufAusgang[] = ['ja', 'nein', 'weiter', 'abgelaufen', 'eingetreten'];

/** Ein Wert sieht nach echten Daten aus? (rein) — Mail-Adresse außerhalb von `.invalid`, eine Telefonnummer, die kein Platzhalter ist, eine IBAN. */
export function nichtErfunden(v: TestWert): string | null {
  if (typeof v !== 'string') return null;
  for (const m of v.match(/[^\s<>()"',;]+@[^\s<>()"',;]+/g) ?? []) if (!ERFUNDENE_MAIL.test(m)) return `„${m}“ ist keine erfundene Adresse — Testdaten nur mit Adressen unter „.invalid“ (z. B. erika@example.invalid).`;
  // Telefonnummern beginnen mit „+“ oder „0“ (Tage wie 2026-11-05 und Beträge sind keine).
  for (const t of v.match(/(?:\+|\b0)\d[\d ()/-]{4,}\d/g) ?? []) if ((t.match(/\d/g) ?? []).length >= 6 && !PLATZHALTER_TELEFON.test(t.replace(/[()/]/g, ''))) return `„${t}“ sieht nach einer echten Telefonnummer aus — Testdaten nur mit Platzhalter-Nummern (z. B. +49 000 0000000).`;
  if (IBAN.test(v.toUpperCase())) return 'Eine IBAN gehört nie in Testdaten.';
  return null;
}

/** Alle Platzhalter, die es für irgendeine Fall-Art gibt (dazu die immer da sind). */
const ALLE_PLATZHALTER = new Set<string>(['prozess.titel', 'heute', 'lauf.start', ...Object.values(PLATZHALTER_JE_FALL).flat()]);
const TEXT = (v: unknown): v is string => typeof v === 'string';
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);

/**
 * Testdaten prüfen (rein, Schreibweg UND Säuberer): Form, Grenzen, nur bekannte Platzhalter, nur erfundene Werte. `{ ok: false }` = abgelehnt (400 bzw. 413 mit
 * Satz — nichts gespeichert); leere Teile fallen weg (ganz leer = `testdaten: null`).
 */
export function testdatenPruefen(roh: unknown): { ok: true; testdaten: ProzessTestdaten | null } | { ok: false; status: 400 | 413; fehler: string } {
  if (roh === null || roh === undefined) return { ok: true, testdaten: null };
  const o = obj(roh);
  if (!o) return { ok: false, status: 400, fehler: 'Testdaten: als Objekt.' };
  const raus: ProzessTestdaten = {};
  const p = obj(o.platzhalter);
  if (o.platzhalter !== undefined && o.platzhalter !== null && !p) return { ok: false, status: 400, fehler: 'Testdaten › Platzhalter: als Objekt.' };
  if (p) {
    const e = Object.entries(p).filter(([, v]) => v !== '' && v !== null && v !== undefined);
    if (e.length > TESTDATEN_GRENZEN.platzhalter) return { ok: false, status: 413, fehler: `Testdaten: höchstens ${TESTDATEN_GRENZEN.platzhalter} Platzhalter — nichts gespeichert.` };
    const x: Record<string, string> = {};
    for (const [k, v] of e) {
      if (!ALLE_PLATZHALTER.has(k) && !/^webhook\.[a-z][a-z0-9_.-]{0,39}$/.test(k)) return { ok: false, status: 400, fehler: `Testdaten: den Platzhalter {{${k}}} gibt es nicht.` };
      if (k.startsWith('webhook.')) return { ok: false, status: 400, fehler: 'Webhook-Felder sind fremder Text — ihr Beispiel entsteht aus dem Felder-Schema, nie aus Testdaten.' };
      if (!TEXT(v)) return { ok: false, status: 400, fehler: `Testdaten › {{${k}}}: Text erwartet.` };
      if (v.length > TESTDATEN_GRENZEN.text) return { ok: false, status: 413, fehler: `Testdaten › {{${k}}}: höchstens ${TESTDATEN_GRENZEN.text} Zeichen — nichts gespeichert.` };
      const n = nichtErfunden(v); if (n) return { ok: false, status: 400, fehler: n };
      x[k] = v;
    }
    if (Object.keys(x).length) raus.platzhalter = x;
  }
  const f = obj(o.felder);
  if (o.felder !== undefined && o.felder !== null && !f) return { ok: false, status: 400, fehler: 'Testdaten › Felder: als Objekt.' };
  if (f) {
    const e = Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined);
    if (e.length > TESTDATEN_GRENZEN.felder) return { ok: false, status: 413, fehler: `Testdaten: höchstens ${TESTDATEN_GRENZEN.felder} Felder — nichts gespeichert.` };
    const x: Record<string, TestWert> = {};
    for (const [k, v] of e) {
      if (!FELD_KENNUNG.test(k) || k.startsWith('webhook.')) return { ok: false, status: 400, fehler: `Testdaten: das Feld „${k}“ gibt es so nicht${k.startsWith('webhook.') ? ' (Webhook-Felder kommen aus dem Schema)' : ''}.` };
      if (!(TEXT(v) || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)))) return { ok: false, status: 400, fehler: `Testdaten › ${k}: Text, Zahl oder ja/nein.` };
      if (TEXT(v) && v.length > TESTDATEN_GRENZEN.text) return { ok: false, status: 413, fehler: `Testdaten › ${k}: höchstens ${TESTDATEN_GRENZEN.text} Zeichen — nichts gespeichert.` };
      const n = nichtErfunden(v); if (n) return { ok: false, status: 400, fehler: n };
      x[k] = v;
    }
    if (Object.keys(x).length) raus.felder = x;
  }
  const em = obj(o.empfaenger);
  if (o.empfaenger !== undefined && o.empfaenger !== null && !em) return { ok: false, status: 400, fehler: 'Testdaten › Empfänger: als Objekt.' };
  if (em) {
    const x: NonNullable<ProzessTestdaten['empfaenger']> = {};
    for (const k of ['name', 'email', 'telefon'] as const) {
      const v = em[k];
      if (v === undefined || v === null || v === '') continue;
      if (!TEXT(v) || v.length > 120) return { ok: false, status: 400, fehler: `Testdaten › Empfänger: ${k} als kurzer Text.` };
      if (k === 'email' && !ERFUNDENE_MAIL.test(v.trim())) return { ok: false, status: 400, fehler: 'Testdaten › Empfänger: nur eine erfundene Adresse unter „.invalid“ (z. B. erika@example.invalid).' };
      if (k === 'telefon' && !PLATZHALTER_TELEFON.test(v.trim())) return { ok: false, status: 400, fehler: 'Testdaten › Empfänger: nur eine Platzhalter-Nummer (z. B. +49 000 0000000).' };
      if (k === 'name') { const n = nichtErfunden(v); if (n) return { ok: false, status: 400, fehler: n }; }
      x[k] = v.trim();
    }
    if (Object.keys(x).length) raus.empfaenger = x;
  }
  const a = obj(o.annahmen);
  if (o.annahmen !== undefined && o.annahmen !== null && !a) return { ok: false, status: 400, fehler: 'Testdaten › Weg annehmen: als Objekt.' };
  if (a) {
    const e = Object.entries(a);
    if (e.length > TESTDATEN_GRENZEN.annahmen) return { ok: false, status: 413, fehler: `Testdaten: höchstens ${TESTDATEN_GRENZEN.annahmen} angenommene Wege — nichts gespeichert.` };
    const x: Record<string, LaufAusgang> = {};
    for (const [k, v] of e) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/.test(k) || !(ANNAHME_AUSGAENGE as readonly unknown[]).includes(v)) return { ok: false, status: 400, fehler: 'Testdaten › Weg annehmen: Kennung eines Knotens → ja, nein, weiter, abgelaufen oder eingetreten.' };
      x[k] = v as LaufAusgang;
    }
    if (Object.keys(x).length) raus.annahmen = x;
  }
  if (TEXT(o.am)) raus.am = o.am.slice(0, 40);
  if (TEXT(o.von) && /^[a-z0-9-]{1,40}$/.test(o.von)) raus.von = o.von;
  const leer = !raus.platzhalter && !raus.felder && !raus.empfaenger && !raus.annahmen;
  return { ok: true, testdaten: leer ? null : raus };
}
/** Säuberer (rein, Lesen): unlesbare bzw. nicht erfundene Testdaten fallen ganz weg — nie eine erfundene Angabe, nie ein Absturz. */
export function testdatenAus(roh: unknown): ProzessTestdaten | undefined {
  const r = testdatenPruefen(roh);
  return r.ok && r.testdaten ? r.testdaten : undefined;
}
// ══ Werte für Vorschau und Probelauf ════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Das Beispiel eines Webhooks aus seinem Felder-Schema (rein): je Art ein erfundener Wert — nie ein echter Eingang (fremder Text). */
export function webhookBeispiel(felder: readonly WebhookFeld[]): Record<string, TestWert> {
  const raus: Record<string, TestWert> = {};
  for (const f of felder) {
    const k = `webhook.${f.id}`;
    raus[k] = f.art === 'zahl' ? 1 : f.art === 'ja-nein' ? true : f.art === 'datum' ? '2026-11-05' : f.art === 'email' ? 'beispiel@example.invalid'
      : f.art === 'auswahl' ? f.optionen?.[0] ?? 'beispiel' : f.art === 'kennung' ? `beispiel-${f.id}` : `Beispiel ${f.id}`;
  }
  return raus;
}
/** Die Felder eines Webhook-Auslösers (der erste Webhook-Auslöser des Prozesses). */
export function webhookFelderVon(knoten: readonly K[]): WebhookFeld[] {
  for (const k of knoten) if (k.form === 'ausloeser' && k.ausloeser?.art === 'webhook') return [...(k.ausloeser.felder ?? [])];
  return [];
}

/**
 * Die Werte, mit denen Vorschau und Probelauf „Beispiel“ rechnen (rein): Platzhalter (Beispiel ∪ eigene Testdaten ∪ Webhook aus dem Schema), Felder (dito) und der
 * Empfänger. Der Platzhalter `prozess.titel` kommt vom Prozess, `heute` vom Aufrufer.
 */
export function testWerte(o: { testdaten?: ProzessTestdaten | null; knoten?: readonly K[]; titel?: string; heute?: string }): { platzhalter: Record<string, TestWert>; felder: Record<string, TestWert>; empfaenger: { kontaktId: string; name: string; email?: string; telefon?: string } } {
  const wh = webhookBeispiel(webhookFelderVon(o.knoten ?? []));
  const td = o.testdaten ?? {};
  return {
    platzhalter: { ...BEISPIEL_PLATZHALTER, ...(o.titel ? { 'prozess.titel': o.titel } : {}), ...(o.heute ? { heute: o.heute, 'lauf.start': o.heute } : {}), ...(td.platzhalter ?? {}), ...wh },
    felder: { ...BEISPIEL_FELDER, ...(td.felder ?? {}), ...wh },
    empfaenger: { ...BEISPIEL_EMPFAENGER_WERTE, ...(td.empfaenger ?? {}) },
  };
}

/** Welche Wege eine Form im Probelauf annehmen kann (rein) — leer = keine Wahl (der Schritt hat nur einen Weg). */
export function annahmeOptionen(k: Pick<K, 'form' | 'raute' | 'warten' | 'schloss'>): { ausgang: LaufAusgang; label: string }[] {
  const f = k.form ?? 'schritt';
  if (f === 'entscheidung') return [{ ausgang: 'ja', label: 'ja' }, { ausgang: 'nein', label: 'nein' }];
  if (f === 'freigabe') return [{ ausgang: 'ja', label: 'freigegeben' }, { ausgang: 'nein', label: 'abgelehnt' }, { ausgang: 'abgelaufen', label: 'abgelaufen' }];
  if (f === 'warten') return k.warten?.art === 'dauer' ? [] : [{ ausgang: 'eingetreten', label: 'eingetreten' }, { ausgang: 'abgelaufen', label: 'abgelaufen (Obergrenze)' }];
  return [];
}

/** Die Fall-Art als Schlüssel für die Platzhalter (für die Vorschau). */
export const platzhalterDerFallArt = (fall: FallArt): readonly string[] => PLATZHALTER_JE_FALL[fall];

/**
 * „Als Testdaten in Bauen“ (Punkt 11, n8n „Copy to editor“): der Weg eines echten Laufs als „Weg annehmen“ (rein) — je Raute, Freigabe und Warten der Ausgang, den der
 * Lauf nahm (nur Kennungen, nie Inhalte; der jüngste Besuch zählt). Knoten, die es im Entwurf nicht mehr gibt, fallen weg.
 */
export function annahmenAusLauf(schritte: readonly { knoten: string; ausgang?: LaufAusgang }[], knoten: readonly K[]): Record<string, LaufAusgang> {
  const raus: Record<string, LaufAusgang> = {};
  for (const s of schritte) {
    const k = knoten.find(x => x.id === s.knoten);
    if (!k || !s.ausgang) continue;
    if (annahmeOptionen(k).some(o => o.ausgang === s.ausgang)) raus[k.id] = s.ausgang;
  }
  return raus;
}

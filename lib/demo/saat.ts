// ─── MAKE OS — Demo-Instanz: die Saat (Server, 05.10.) ─────────────────────────────────────────────────────────────────
// Legt in einem LEEREN Datenordner eine glaubwürdige, vollständig erfundene Demo an — über die BESTEHENDEN Schreibwege:
// dieselben Routen wie die Oberfläche (Säuberung, Regeln, Kaskade, Meilenstein-Listen, Protokoll), nur in-process aufgerufen
// mit der Person im Kopf `x-make-user` (wie nach der Middleware). Direkt über die Datenschicht (`aendereKonten`, `saveJson`)
// geht nur, was keinen Schreibweg im Browser hat: Konten (sonst Einrichtungs-Schlüssel), die Demo-Marke, der Termin-Stand
// (`calendar-cache`, sonst liefert ihn der Mac) und die drei vergangenen Wochenpläne (Morgenlauf-Schritt mit dem Tag von damals).
//
// Alles erfunden: Personen `@example.invalid`, Firmen, Beträge, Termine. Familie/Gesundheit nur harmlos und minimal. Kein
// Name, keine Firma, kein Betrag aus unserem Bestand (Wächter tests/repo-sauber.test.ts, tests/demo.test.ts).
// Schutzregeln (wann gesät/zurückgesetzt werden darf): lib/demo/schutz.ts. Aufrufer: scripts/demo-saat.mjs und
// lib/demo/server.ts (Knopf „Demo zurücksetzen“). Doku: DEMO.md.
// Agenten-Bereich und „Fotos & Videos“ (Paket 4c): lib/demo/saat-agenten.ts — ohne KI-Schlüssel vollständig (gespeicherte Antworten, kein Modell).
// Inbox (10.10.): lib/demo/saat-inbox.ts — Demo-Postfach, Übergaben, Aufgaben-Vorschläge (nur mit MAKE_OS_DEMO=1).
// 15.10. (Abnahme 2 B10/B12/B13): stimmige Finanzen (Retainer im Liquiditätsplan über den Vorschlagsweg „Mandat → Liquiplan“, Ausgaben, 0-Punkt zum
// Jahresbeginn, Monatsabschlüsse, Jahresziel, Gehälter in der Finanzplanung, Steuern der Hauptgesellschaft), ein Unternehmen ohne Schieflage (Pflichten
// der Vorjahre erledigt, höchstens EINE offene Frist, Risiken unter der Tragfähigkeit, vergangene Steuerfristen abgehakt) — alles über die Routen.
// KI-Beispiele (nur mit MAKE_OS_DEMO=1): lib/demo/saat-ki.ts — Heads, Head of Finance, ZOE-Stapel und -Gespräch als „Beispiel“ markiert; dort steht
// begründet, warum Berichte und Vorschläge direkt in die Bestände der Läufe gehen (im Browser entstehen sie nur über einen Modellaufruf).

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { saveJson, updateJson } from '@/lib/store/local-db';
import { aendereKonten, passwortHashen, type Konto } from '@/lib/zugang/konten';
import { localDay, tagVon } from '@/lib/zeit';
import { montagVon, tagPlus } from '@/lib/zeit/kalender-kern';
import { einheitAusGesellschaft, UG_NAME } from '@/lib/einheiten';
import { bauKennung, BAU_KOPF } from '@/lib/bau/kennung';
import type { RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { fahrplanFuer } from '@/lib/gesellschaften/fahrplan';
import { verantwortlich } from '@/lib/crm/team';
import { kennungAusName } from '@/lib/crm/marke';
import { DEMO_MARKE, DEMO_SAAT_VERSION, DEMO_DOMAIN, demoUuid } from './schutz';

export class DemoFehler extends Error {}

/** Der Haushalt der Demo (gültig nach HAUSHALT_OK, kein Test-/Probe-Haushalt). */
export const DEMO_HAUSHALT = 'demo';
/** Die zwei erfundenen Personen — Speichernamen bewusst nicht `kevin`/`malin` (die tragen in Altstellen Sonderfälle). */
export const DEMO_PERSONEN = [
  { speicher: 'lena', name: 'Lena Hartmann', email: `lena@${DEMO_DOMAIN}`, rolle: 'inhaber' as const, kurz: 'Lena', aufgabe: 'Geschäftsführung' },
  { speicher: 'jonas', name: 'Jonas Hartmann', email: `jonas@${DEMO_DOMAIN}`, rolle: 'mitglied' as const, kurz: 'Jonas', aufgabe: 'Produkt & Finanzen' },
] as const;
/**
 * Das dritte Konto (09.10., E4-Rest — Kevin: „Ja, Privates bleibt privat“): ein erfundener Vertriebspartner mit Finanzrecht „nur Business“
 * (`finanzRecht: 'business'`) im Haushalt der Demo — führt die Rolle vor: Business sieht er voll, aus dem Privat-Bereich (Privat-Ziel,
 * gemeinsame Privat-Routine, Urlaubs-Projekt, private Finanzen) bekommt er serverseitig nichts. Kein Inhaber, teilt nichts, mit ihm teilt niemand.
 */
export const DEMO_PARTNER = { speicher: 'ben', name: 'Ben Kramer', email: `ben@${DEMO_DOMAIN}`, rolle: 'mitglied' as const, kurz: 'Ben', aufgabe: 'Vertriebspartner (nur Business)' } as const;
/** Eine Team-Person ohne Konto (freie Mitarbeit) — zeigt Kapazität, Zuweisungen und die Team-Löschfrist. */
const MIRA = { id: 't-demo-mira', name: 'Mira Sommer', kurz: 'Mira', rolle: 'Design (frei)', email: `mira@${DEMO_DOMAIN}`, aktiv: true, kreis: 'partner' as const };

const LENA = DEMO_PERSONEN[0].speicher, JONAS = DEMO_PERSONEN[1].speicher, BEN = DEMO_PARTNER.speicher;
const KONTO_LENA = `konto-${LENA}`, KONTO_JONAS = `konto-${JONAS}`, KONTO_BEN = `konto-${BEN}`;

export interface SaatBericht { schritte: { name: string; anzahl: number }[]; heute: string; personen: { name: string; email: string }[] }
/** Zugangsdaten, die beim Zurücksetzen bleiben (die Sitzung des Vorführenden bleibt gültig). */
export type Zugang = Pick<Konto, 'hash' | 'salz'> & Partial<Pick<Konto, 'kdf' | 'zweiterFaktor' | 'sitzungenAb' | 'widerrufen'>>;

// ── Aufruf der bestehenden Routen (in-process) ────────────────────────────────────────────────────────────────────────

type Handler = (req: Request) => Promise<Response>;
type Modul = Record<string, unknown>;
async function rufe(modul: Promise<Modul>, methode: 'GET' | 'POST' | 'PUT' | 'PATCH', pfad: string, person: string, body?: unknown): Promise<Record<string, unknown>> {
  const fn = (await modul)[methode] as Handler | undefined;
  if (!fn) throw new DemoFehler(`${methode} ${pfad}: Route kennt die Methode nicht.`);
  const kopf: Record<string, string> = { 'content-type': 'application/json', 'x-make-user': person };
  const bau = bauKennung();
  if (bau) kopf[BAU_KOPF] = bau;
  const r = await fn(new Request(`http://demo.invalid${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { roh: text.slice(0, 200) }; }
  if (!r.ok || j.ok === false) throw new DemoFehler(`${methode} ${pfad} → ${r.status}: ${String(j.error ?? j.fehler ?? text.slice(0, 300))}`);
  return j;
}
const R = {
  team: () => import('@/app/api/team/route') as Promise<Modul>,
  kalenderEinstellungen: () => import('@/app/api/state/kalender-einstellungen/route') as Promise<Modul>,
  kontakte: () => import('@/app/api/state/kontakte/route') as Promise<Modul>,
  crm: () => import('@/app/api/crm/bestand/route') as Promise<Modul>,
  deal: () => import('@/app/api/crm/deal/route') as Promise<Modul>,
  lead: () => import('@/app/api/crm/lead/route') as Promise<Modul>,
  gesellschaften: () => import('@/app/api/gesellschaften/route') as Promise<Modul>,
  schild: () => import('@/app/api/gesellschaften/schild/route') as Promise<Modul>,
  eroeffnung: () => import('@/app/api/business/eroeffnung/route') as Promise<Modul>,
  konten: () => import('@/app/api/finanzen/konten/route') as Promise<Modul>,
  ziele: () => import('@/app/api/state/ziele/route') as Promise<Modul>,
  nordstern: () => import('@/app/api/planung/nordstern/route') as Promise<Modul>,
  meilensteine: () => import('@/app/api/state/meilensteine/route') as Promise<Modul>,
  aufgabe: () => import('@/app/api/tasks/create/route') as Promise<Modul>,
  aufgaben: () => import('@/app/api/state/tasks/route') as Promise<Modul>,
  top3: () => import('@/app/api/heute/top3/route') as Promise<Modul>,
  routinen: () => import('@/app/api/state/routinen/route') as Promise<Modul>,
  kapazitaet: () => import('@/app/api/kapazitaet/route') as Promise<Modul>,
  zeit: () => import('@/app/api/state/zeit/route') as Promise<Modul>,
  finanzImport: () => import('@/app/api/finanzplan/import/route') as Promise<Modul>,
  finanzplan: () => import('@/app/api/finanzplan/route') as Promise<Modul>,
  familie: () => import('@/app/api/familie/route') as Promise<Modul>,
  vitals: () => import('@/app/api/state/vitals/route') as Promise<Modul>,
  sport: () => import('@/app/api/sport/route') as Promise<Modul>,
  gesundheitEinwilligung: () => import('@/app/api/datenschutz/gesundheit/route') as Promise<Modul>,
  koerper: () => import('@/app/api/gesundheit/koerper/route') as Promise<Modul>,
  erholung: () => import('@/app/api/gesundheit/erholung/route') as Promise<Modul>,
  planung: () => import('@/app/api/crm/planung/route') as Promise<Modul>,
  treppe: () => import('@/app/api/crm/treppe/route') as Promise<Modul>,
  produktImport: () => import('@/app/api/crm/produkte/import/route') as Promise<Modul>,
  absender: () => import('@/app/api/crm/gesellschaften/route') as Promise<Modul>,
  stammdaten: () => import('@/app/api/crm/stammdaten/route') as Promise<Modul>,
  angebot: () => import('@/app/api/crm/angebot/route') as Promise<Modul>,
  mandatLiquiplan: () => import('@/app/api/crm/liquiplan/route') as Promise<Modul>,
  liquiplan: () => import('@/app/api/state/liquiplan/route') as Promise<Modul>,
  finanzplanBestand: () => import('@/app/api/state/finanzplan/route') as Promise<Modul>,
  business: () => import('@/app/api/business/route') as Promise<Modul>,
  controlling: () => import('@/app/api/state/finance/route') as Promise<Modul>,
  steuern: () => import('@/app/api/steuern/route') as Promise<Modul>,
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** Kontakt-Kennung `c-<uuid>` — deterministisch, damit Links nach dem Zurücksetzen gleich bleiben. */
const kontaktId = (schluessel: string) => `c-${demoUuid(`kontakt:${schluessel}`, sha)}`;
const upsert = (eintrag: unknown) => ({ op: 'upsert', eintrag });

// ── Die erfundenen Daten ──────────────────────────────────────────────────────────────────────────────────────────────

// Rechnungsanschrift je Firma (19.10., Rundgang A7): erfundene Straßen („Musterweg“, „Beispielkai“ …) — damit der Weg Mandat → Rechnung → gestellt
// vorführbar ist (§ 14 UStG verlangt die Anschrift des Empfängers). Sie liegt dort, wo die Rechnung sie liest: `zahlung.empfaenger.anschrift`.
const FIRMEN = [
  { id: 'f-demo-nordwerk', name: 'Nordwerk Maschinenbau GmbH', rolle: 'kunde', branche: 'Maschinenbau', stadt: 'Bielefeld', mitarbeiter: '180', anschrift: 'Musterweg 12, 33602 Bielefeld' },
  { id: 'f-demo-lumen', name: 'Lumen Logistik AG', rolle: 'kunde', branche: 'Logistik', stadt: 'Hamburg', mitarbeiter: '420', anschrift: 'Beispielkai 4, 20457 Hamburg' },
  { id: 'f-demo-gruenfeld', name: 'Grünfeld Bau GmbH', rolle: 'zielkunde', branche: 'Bau', stadt: 'Münster', mitarbeiter: '95', anschrift: 'Probestraße 7, 48143 Münster' },
  { id: 'f-demo-atlas', name: 'Atlas Software GmbH', rolle: 'zielkunde', branche: 'Software', stadt: 'Köln', mitarbeiter: '60', anschrift: 'Beispielring 21, 50667 Köln' },
  { id: 'f-demo-seeblick', name: 'Seeblick Hotels KG', rolle: 'zielkunde', branche: 'Hotellerie', stadt: 'Konstanz', mitarbeiter: '240', anschrift: 'Am Mustersee 3, 78462 Konstanz' },
  { id: 'f-demo-kanzlei', name: 'Beispiel Steuerberatung PartG', rolle: 'partner', branche: 'Steuerberatung', stadt: 'Bielefeld', mitarbeiter: '25', anschrift: 'Beispielplatz 1, 33602 Bielefeld' },
] as const;
/**
 * Bankverbindung der Demo-Gesellschaft (19.10., Rundgang A7 — ohne IBAN blieb „Rechnung stellen“ gesperrt): die ÖFFENTLICH DOKUMENTIERTE
 * Beispiel-IBAN für Deutschland (das Standardbeispiel in IBAN-Erklärungen und Bankdokumentationen, mit gültiger Prüfziffer nach ISO 13616),
 * KEINE Bankverbindung von uns oder einem Kunden. In Stücken notiert (auch hier im Kommentar nie am Stück), damit der Wächter gegen echte
 * Kontodaten im Repo (tests/repo-sauber.test.ts: jede gültige IBAN im Quelltext) still bleibt — so wie in den Tests.
 */
export const DEMO_IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');

const KONTAKTE = [
  { k: 'sophie', vorname: 'Sophie', nachname: 'Brandt', firma: 'f-demo-nordwerk', position: 'Geschäftsführerin', stufe: 'gewonnen', prio: 'A' },
  { k: 'paul', vorname: 'Paul', nachname: 'Neumann', firma: 'f-demo-lumen', position: 'CFO', stufe: 'gewonnen', prio: 'A' },
  { k: 'elif', vorname: 'Elif', nachname: 'Kaya', firma: 'f-demo-gruenfeld', position: 'Inhaberin', stufe: 'angebot', prio: 'A' },
  { k: 'tobias', vorname: 'Tobias', nachname: 'Lange', firma: 'f-demo-atlas', position: 'CEO', stufe: 'gespraech', prio: 'B' },
  { k: 'marie', vorname: 'Marie', nachname: 'Vogel', firma: 'f-demo-seeblick', position: 'Leitung Finanzen', stufe: 'termin', prio: 'B' },
  { k: 'david', vorname: 'David', nachname: 'Roth', firma: 'f-demo-kanzlei', position: 'Partner', stufe: 'gespraech', prio: 'C' },
  { k: 'nina', vorname: 'Nina', nachname: 'Wolf', firma: 'f-demo-atlas', position: 'Leitung Vertrieb', stufe: 'angesprochen', prio: 'B' },
  { k: 'felix', vorname: 'Felix', nachname: 'Braun', firma: undefined, position: 'Business Angel', stufe: 'ansprechen', prio: 'C' },
] as const;

// 16.10. (Abnahme 2 · C7): eine Zählung mit der Leistungstreppe — der kostenlose Kennzahlen-Check ist ihre erste Stufe und steht als Produkt
// im Katalog; die Stufen steigen mit dem Wert (Jahr): Einstieg (Check 0 €, Diagnose 4.800 €) · Kern (Cockpit 490 €/Monat) · Premium (Vertriebsaufbau).
const PRODUKTE = [
  { id: 'l-demo-diagnose', name: 'Klarheits-Diagnose', typ: 'diagnose', stufe: 'einstieg', preis: { betrag: 4800, einheit: 'pauschal netto', basis: 'einmalig' }, lieferumfang: ['Zwei Workshops mit der Geschäftsführung', 'Kennzahlen-Bild auf einer Seite', 'Fahrplan für 90 Tage'], text: 'Diagnose von Steuerung, Kennzahlen und Prioritäten in zwei Wochen.' },
  // 15.10. (Abnahme B4): das Produkt heißt, was es liefert — die Paket-Vorlage dahinter baut einen Vertrieb auf (Zielkunden, Ansprache, Team, Takt).
  { id: 'l-demo-retainer', name: 'Vertriebsaufbau', typ: 'retainer', stufe: 'premium', preis: { betrag: 3500, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Monatlicher Steuerungstermin', 'Kennzahlen-Review', 'Sparring auf Abruf'], text: 'Vertrieb planbar machen: Zielkunden, Ansprache, Team und Kennzahlen — bis das Team allein verkauft.' },
  { id: 'l-demo-software', name: 'Cockpit-Lizenz', typ: 'software', stufe: 'kern', preis: { betrag: 490, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Zugang für fünf Personen', 'Einrichtung', 'Support'], text: 'Software-Cockpit für Kennzahlen und Planung.' },
  // Am Ende (PRODUKTE[0] bleibt die Diagnose — das Demo-Angebot nimmt sie).
  { id: 'l-demo-check', name: 'Kennzahlen-Check', typ: 'diagnose', stufe: 'einstieg', preis: { betrag: 0, einheit: 'kostenlos', basis: 'einmalig' }, lieferumfang: ['Kurzbefund auf einer Seite'], text: 'Zeigt in einer Woche, wo die Steuerung hakt — ohne Risiko für den Kunden.' },
] as const;

/**
 * Die Demo-Produkte als Produkt-Karten (19.10., P4 — PRODUKTE_KONZEPT.md): jede Preis-Form des Konzepts einmal, alles erfunden (Namen, Preise, Texte).
 * Kommt über den Produkt-Import (dieselbe Route wie „Produkte importieren“): die vier Produkte oben werden über den Namen gefunden und bekommen ihre
 * Karten-Felder (Teil-Merge — Kennung, Texte, Status bleiben), vier kommen neu dazu. Abgedeckt: kostenlos · Festpreis mit Anrechnung · monatlich mit
 * Mindestlaufzeit, Bonus, höchstens gleichzeitig und einem enthaltenen Zusatzmodul · Zusatzmodul einmalig + je Messe (50/50) · jährlich mit
 * Kontingent und Mehrverbrauch · Tagessatz + Reisekosten · Stundensatz mit Deckel. Die Abläufe nennt der zweite Lauf nach dem Fulfillment.
 */
const SPARRING_TEXT = 'Ein Gegenüber für Entscheidungen in Vertrieb und Steuerung — nach Bedarf, ohne Mindestlaufzeit.';
export const DEMO_PRODUKT_KARTEN = [
  { name: 'Kennzahlen-Check', preise: [{ art: 'kostenlos' }], rolle: 'haupt', ebene: 1, dauerTage: 7 },
  {
    name: 'Klarheits-Diagnose', preise: [{ art: 'fest', betrag: 4800 }], vertrag: { zahlungszielTage: 14 }, ebene: 2, dauerTage: 14,
    regeln: { anrechnung: { auf: ['Vertriebsaufbau'], anteilProzent: 100 } },
  },
  {
    name: 'Vertriebsaufbau', rolle: 'haupt', ebene: 3,
    preise: [{ art: 'monatlich', betrag: 3500 }, { art: 'erfolg', text: 'Bonus bei erreichten Quartalszielen' }],
    vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar', kuendigungsfristTage: 30, zahlungszielTage: 14 },
    regeln: { maxGleichzeitig: 4, inklusive: [{ produkt: 'Messe-Begleitung', menge: 1, je: 'quartal' }] },
  },
  { name: 'Cockpit-Lizenz', preise: [{ art: 'monatlich', betrag: 490 }], vertrag: { mindestlaufzeitMonate: 12, danach: 'verlaengert_um_laufzeit', zahlungszielTage: 30 }, ebene: 3 },
  {
    name: 'Messe-Begleitung', status: 'aktiv', gesellschaft: 'ug', typ: 'sprint', rolle: 'zusatz',
    beschreibung: 'Zusatzmodul: wir begleiten den Messeauftritt vom Gesprächsplan bis zum Nachfassen.',
    leistungstext: 'Vorbereitung des Messeauftritts (Zielkunden, Gesprächsplan, Termine), Begleitung am Stand und Nachfassen der Kontakte in den zwei Wochen danach.',
    lieferumfang: ['Gesprächsplan', 'Begleitung am Stand', 'Nachfass-Liste'],
    preise: [{ art: 'fest', betrag: 1900, anzahlungProzent: 50 }, { art: 'je_einheit', einheit: 'je Messe', betrag: 1200, optional: true, anzahlungProzent: 50 }],
    vertrag: { zahlungszielTage: 14, reisekosten: 'separat' },
  },
  {
    name: 'Cockpit Jahrespaket', status: 'aktiv', gesellschaft: 'ug', typ: 'software', rolle: 'beides',
    beschreibung: 'Das Cockpit für ein Jahr — mit festem Kontingent an Monatsauswertungen.',
    leistungstext: 'Zugang zum Kennzahlen-Cockpit für ein Jahr, Einrichtung und zwölf Monatsauswertungen; weitere Auswertungen nach Bedarf.',
    lieferumfang: ['Zugang für fünf Personen', 'Einrichtung', 'Zwölf Monatsauswertungen'],
    preise: [{ art: 'jaehrlich', betrag: 4900, kontingent: 'fünf Nutzer und zwölf Monatsauswertungen' }, { art: 'je_einheit', einheit: 'je weitere Auswertung', betrag: 60, optional: true }],
    vertrag: { mindestlaufzeitMonate: 12, danach: 'verlaengert_um_laufzeit', zahlungszielTage: 30 },
  },
  {
    name: 'Sparring-Tag', status: 'aktiv', gesellschaft: 'ug', typ: 'sprint', beschreibung: 'Ein Tag gemeinsam an einer Frage — vor Ort oder online.',
    leistungstext: SPARRING_TEXT, preise: [{ art: 'tagessatz', betrag: 1400 }], vertrag: { reisekosten: 'separat', zahlungszielTage: 14 },
  },
  {
    name: 'Sparring nach Aufwand', status: 'aktiv', gesellschaft: 'ug', typ: 'sprint', beschreibung: 'Stundenweise Begleitung, gedeckelt je Monat.',
    leistungstext: SPARRING_TEXT, preise: [{ art: 'stundensatz', betrag: 160, stundenJeMonat: 15 }], vertrag: { zahlungszielTage: 14 },
  },
] as const;
/** Abläufe der Lieferung (Fulfillment-Vorlagen der Demo) je Produkt — der zweite Import-Lauf nennt sie (sonst ist alles „gleich“). */
const DEMO_PRODUKT_ABLAEUFE: Record<string, string> = { 'Vertriebsaufbau': 'Vertriebsaufbau', 'Cockpit-Lizenz': 'Cockpit-Einführung' };

/**
 * Notizen des Demo-Wissens (Vault der Demo). Vorgabe `scope: oeffentlich` (alle Demo-Konten); die Gründungs-Notiz nennt Gesellschafter und Fahrplan
 * der Firmen-Akte — `scope: intern`, also nur für volle Mitglieder des Haushalts, nie für das Konto „nur Business“ (Abnahme 2 A1, 15.10.).
 */
const WISSEN: { datei: string; titel: string; text: string; tags: string[]; scope?: 'intern' }[] = [
  { datei: 'Positionierung.md', titel: 'Positionierung Nordlicht Labs', tags: ['strategie'], text: 'Wir helfen inhabergeführten Mittelständlern, mit klaren Kennzahlen schneller zu entscheiden.\n\n- Zielgruppe: Geschäftsführung, 50–500 Mitarbeitende\n- Einstieg: Klarheits-Diagnose\n- Kern: Vertriebsaufbau + Cockpit-Lizenz' },
  { datei: 'Wochenrhythmus.md', titel: 'Unser Wochenrhythmus', tags: ['arbeitsweise'], text: 'Montag: Planung und Kapazität prüfen.\nDienstag/Donnerstag: Fokus-Blöcke für Kundenarbeit.\nMittwoch: Vertrieb (Power Hour).\nFreitag: Rückblick, Finanzen, Ablage.' },
  { datei: 'Angebots-Leitfaden.md', titel: 'Leitfaden für Angebote', tags: ['vertrieb'], text: 'Jedes Angebot nennt Ergebnis, Umfang, Grenzen und nächsten Schritt.\nPreise immer netto, Zahlungsziel 14 Tage.\nNach 10 Tagen nachfassen.' },
  { datei: 'Gruendung-Nordlicht-Ventures.md', titel: 'Gründung Nordlicht Ventures', tags: ['gesellschaften'], scope: 'intern', text: 'Neue Beteiligungsgesellschaft für Software-Beteiligungen.\nStammkapital 25.000 € (Beispiel), Gesellschafter: Hartmann Holding und Jonas.\nFahrplan steht unter Unternehmen.' },
];

// ── Die Saat ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Sät die Demo. Der Ordner muss leer sein (prüft der Aufrufer, lib/demo/schutz.ts). `passwort` gilt für beide Demo-Konten;
 * `zugang` (beim Zurücksetzen) übernimmt Hash/Salz der bisherigen Konten — dann bleibt die Sitzung gültig.
 */
export async function demoSaen(o: { passwort?: string; zugang?: Record<string, Zugang>; heute?: string; jetzt?: Date; vaultDir?: string | null }): Promise<SaatBericht> {
  const heute = o.heute ?? localDay();
  const jetzt = o.jetzt ?? new Date();
  const montag = montagVon(heute);
  const bericht: SaatBericht = { schritte: [], heute, personen: [...DEMO_PERSONEN, DEMO_PARTNER].map(p => ({ name: p.name, email: p.email })) };
  const schritt = (name: string, anzahl: number) => { bericht.schritte.push({ name, anzahl }); };

  // 1) Konten + Haushalt (direkt — die Einrichtung im Browser bräuchte den Instanz-Schlüssel).
  if (!o.zugang && !o.passwort) throw new DemoFehler('Ohne Passwort keine Demo-Konten.');
  const hashes: Record<string, Zugang> = {};
  for (const p of [...DEMO_PERSONEN, DEMO_PARTNER]) hashes[p.speicher] = o.zugang?.[p.speicher] ?? await passwortHashen(o.passwort as string);
  await aendereKonten(() => ({
    konten: [
      ...DEMO_PERSONEN.map((p, i) => ({
        id: `k-demo-${p.speicher}`, speicher: p.speicher, email: p.email, name: p.name, rolle: p.rolle, angelegt: jetzt.toISOString(),
        // Eigene Ziele (08.10.): in der Demo teilen beide sie miteinander — so ist die Einstellung „geteilt“ vorführbar (Vorgabe: niemand).
        haushalt: DEMO_HAUSHALT, teilt: { gesundheit: DEMO_PERSONEN.filter((_, j) => j !== i).map(x => x.speicher), ziele: DEMO_PERSONEN.filter((_, j) => j !== i).map(x => x.speicher) },
        ...hashes[p.speicher],
      })),
      // Der Partner (09.10., E4-Rest): Haushalt der Demo + Finanzrecht „nur Business“ — dieselbe Form, die der Inhaber unter Konto vergibt.
      {
        id: `k-demo-${BEN}`, speicher: BEN, email: DEMO_PARTNER.email, name: DEMO_PARTNER.name, rolle: DEMO_PARTNER.rolle, angelegt: jetzt.toISOString(),
        haushalt: DEMO_HAUSHALT, finanzRecht: 'business' as const, teilt: { gesundheit: [] },
        ...hashes[BEN],
      },
    ],
    einladungen: [],
  }));
  await saveJson(DEMO_MARKE, { saat: DEMO_SAAT_VERSION, angelegt: jetzt.toISOString(), haushalt: DEMO_HAUSHALT });
  schritt('Konten', DEMO_PERSONEN.length + 1);

  // 2) Team: Kurzwort/Rolle der Konten + eine freie Mitarbeiterin ohne Konto.
  await rufe(R.team(), 'PATCH', '/api/team', LENA, { ops: [
    upsert({ id: KONTO_LENA, name: DEMO_PERSONEN[0].name, kurz: DEMO_PERSONEN[0].kurz, rolle: DEMO_PERSONEN[0].aufgabe, aktiv: true, kreis: 'kern' }),
    upsert({ id: KONTO_JONAS, name: DEMO_PERSONEN[1].name, kurz: DEMO_PERSONEN[1].kurz, rolle: DEMO_PERSONEN[1].aufgabe, aktiv: true, kreis: 'kern' }),
    upsert({ id: KONTO_BEN, name: DEMO_PARTNER.name, kurz: DEMO_PARTNER.kurz, rolle: DEMO_PARTNER.aufgabe, aktiv: true, kreis: 'partner' }),
    upsert(MIRA),
  ] });
  schritt('Team', 4);

  // 3) CRM: Firmen + Produkte (Bestand), Kontakte (Kartei), Mandate, Deals (Anlage-Weg).
  const firmenName = (id?: string) => FIRMEN.find(f => f.id === id)?.name;
  await rufe(R.crm(), 'PATCH', '/api/crm/bestand', LENA, { ops: [
    ...FIRMEN.map(({ anschrift, ...f }) => ({ liste: 'firmen', ...upsert({ ...f, webseite: `https://${f.id.slice(7)}.example`, notiz: 'Erfundene Beispiel-Firma (Demo).', zahlung: { empfaenger: { anschrift } } }) })),
    ...PRODUKTE.map(l => ({ liste: 'leistungen', ...upsert({ id: l.id, name: l.name, typ: l.typ, stufe: l.stufe, preis: l.preis, lieferumfang: l.lieferumfang, beschreibung: l.text, gesellschaft: 'ug', status: 'aktiv', angebot: { titel: l.name, leistungstext: l.text } }) })),
  ] });
  // Anlagetag = der Tag der Saat (den stempelt der Server, `serverStempel`) — die erste Notiz liegt daher AM Anlagetag, nie davor (Abnahme
  // 14.10., C8: „angelegt heute, letzte Aktivität vor 17 Tagen“). Damit zählen die Personen nach EINER Regel (`neuerLeadAm`) als neue Leads.
  const jetztIso = new Date().toISOString();
  const anlageAm = tagVon(jetztIso) === heute ? jetztIso : `${heute}T10:00:00.000Z`;
  // C21 + B11 (16.10., Abnahme 2): verteilte, plausible Zeitpunkte (früher am Tag, nie vor dem Anlagetag — C8) statt achtmal der Säzeit, von der
  // Person, die die Beziehung hält; und Signale je Stufe (Gespräch, Termin, Antwort, Mail) — sonst stand jeder Lead auf „5 · Lau“.
  const frueher = (min: number) => { const t = new Date(Date.parse(anlageAm) - min * 60_000).toISOString(); return tagVon(t) === heute ? t : anlageAm; };
  const SIGNAL: Partial<Record<(typeof KONTAKTE)[number]['stufe'], { art: string; text: string }>> = {
    gewonnen: { art: 'gespraech', text: 'Steuerungstermin (erfunden) — nächste Schritte vereinbart.' },
    angebot: { art: 'gespraech', text: 'Gespräch zum Angebot (erfunden) — Fragen zum Umfang geklärt.' },
    gespraech: { art: 'gespraech', text: 'Gespräch (erfunden) — Bedarf und Engpass besprochen.' },
    termin: { art: 'termin', text: 'Termin vereinbart (erfunden) — Demo vor Ort.' },
    angesprochen: { art: 'mail', text: 'Mail (erfunden) — Unterlagen zur Diagnose geschickt.' },
  };
  await rufe(R.kontakte(), 'PATCH', '/api/state/kontakte', LENA, { ops: KONTAKTE.map((k, i) => {
    const besitzer = i % 3 === 2 ? JONAS : LENA;
    const signal = SIGNAL[k.stufe];
    return upsert({
      id: kontaktId(k.k), vorname: k.vorname, nachname: k.nachname, email: `${k.k}@${DEMO_DOMAIN}`, position: k.position,
      ...(k.firma ? { firma: firmenName(k.firma), firmaId: k.firma } : {}), stufe: k.stufe, prio: k.prio, eignung: 'ja', herkunft: 'Demo (erfunden)',
      besitzer,
      aktivitaeten: [
        { am: frueher(40 + i * 23), art: 'notiz', text: 'Erstgespräch (erfunden) — Interesse an Kennzahlen und Planung.', von: besitzer },
        ...(signal ? [{ am: frueher(10 + i * 7), art: signal.art, text: signal.text, von: besitzer }] : []),
      ],
    });
  }) });
  await rufe(R.crm(), 'PATCH', '/api/crm/bestand', LENA, { ops: [
    { liste: 'mandate', ...upsert({ id: 'm-demo-nordwerk', kunde: 'Nordwerk Maschinenbau GmbH', firmaId: 'f-demo-nordwerk', kontaktIds: [kontaktId('sophie')], titel: 'Vertriebsaufbau Nordwerk', art: 'retainer', leistungId: 'l-demo-retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: tagPlus(heute, -46), verlaengerung: 'auto', honorar: { betrag: 3500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: ['Monatliches Kennzahlen-Review etabliert', 'Qualifizierte Erstgespräche je Monat'], health: { beteiligung: 80, umsetzung: 75, wirkung: 70, zahlung: 90, stimmung: 70 }, leistungen: ['Steuerungstermin', 'Review'], offen: [], zustaendig: LENA }) },
    { liste: 'mandate', ...upsert({ id: 'm-demo-lumen', kunde: 'Lumen Logistik AG', firmaId: 'f-demo-lumen', kontaktIds: [kontaktId('paul')], titel: 'Cockpit-Einführung Lumen', art: 'software', leistungId: 'l-demo-software', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: tagPlus(heute, -3), verlaengerung: 'manuell', honorar: { betrag: 2450, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 30, ziele: ['Fünf Standorte im Cockpit'], health: { beteiligung: 75, umsetzung: null, wirkung: null, zahlung: 85, stimmung: null }, leistungen: ['Einrichtung', 'Schulung'], offen: ['Datenanbindung Lager'], zustaendig: JONAS }) },
  ] });
  const deals = [
    { titel: 'Diagnose Grünfeld Bau', firmaId: 'f-demo-gruenfeld', kontaktIds: [kontaktId('elif')], art: 'workshop', wert: { betrag: 4800, basis: 'einmalig' }, leistungId: 'l-demo-diagnose', stufe: 'angebot', schritt: { text: 'Angebot nachfassen (Telefon)', datum: tagPlus(heute, 2) }, erwartetAm: tagPlus(heute, 14) },
    { titel: 'Vertriebsaufbau Atlas Software', firmaId: 'f-demo-atlas', kontaktIds: [kontaktId('tobias'), kontaktId('nina')], art: 'retainer', wert: { betrag: 3500, basis: 'monat', laufzeitMonate: 12 }, leistungId: 'l-demo-retainer', stufe: 'diagnose', schritt: { text: 'Workshop zur Ausgangslage', datum: tagPlus(heute, 5) }, erwartetAm: tagPlus(heute, 40) },
    { titel: 'Cockpit für Seeblick Hotels', firmaId: 'f-demo-seeblick', kontaktIds: [kontaktId('marie')], art: 'software', wert: { betrag: 490, basis: 'monat', laufzeitMonate: 24 }, leistungId: 'l-demo-software', stufe: 'bedarf', schritt: { text: 'Demo-Termin vor Ort', datum: tagPlus(heute, 8) }, erwartetAm: tagPlus(heute, 60) },
    { titel: 'Partnerschaft Beispiel Steuerberatung', firmaId: 'f-demo-kanzlei', kontaktIds: [kontaktId('david')], art: 'vermittlung', wert: { betrag: 6000, basis: 'jahr' }, stufe: 'qualifiziert', schritt: { text: 'Kooperationsmodell skizzieren', datum: tagPlus(heute, 10) }, erwartetAm: tagPlus(heute, 75) },
  ];
  for (const d of deals) await rufe(R.deal(), 'POST', '/api/crm/deal', d.kontaktIds.length > 1 ? JONAS : LENA, { aktion: 'anlegen', ...d, gesellschaft: 'ug', quelle: 'netzwerk', besitzer: LENA });
  // B10 (Abnahme 2, 15.10.): die zwei laufenden Retainer stehen im Liquiditätsplan — über den Vorschlagsweg „Mandat → Liquiplan“ (GET zeigt den
  // Vorschlag, POST `anlegen` übernimmt ihn, wie der Knopf in der Mandatsakte); nie automatisch, hier in der Saat angenommen.
  const lpVorschlag = await rufe(R.mandatLiquiplan(), 'GET', '/api/crm/liquiplan', LENA);
  for (const m of (lpVorschlag.mandate as { id: string; lage: string }[]).filter(x => x.lage === 'fehlt')) await rufe(R.mandatLiquiplan(), 'POST', '/api/crm/liquiplan', LENA, { mandatId: m.id, aktion: 'anlegen' });
  // B11 (16.10.): unterschiedlich weit qualifiziert (Stufen der Sales-Fragen, Standard-Scoring) — über die Lead-Route, wie die Runde im Browser.
  const QUALI: [string, Record<string, string>][] = [
    ['f-demo-gruenfeld', { schmerz: 's5', entscheider: 's5', budget: 's5', zeitpunkt: 's3', wirkung: 's3' }],
    ['f-demo-atlas', { schmerz: 's3', entscheider: 's5', zeitpunkt: 's3' }],
    ['f-demo-seeblick', { schmerz: 's3', budget: 's1' }],
  ];
  for (const [id, stufen] of QUALI) await rufe(R.lead(), 'POST', '/api/crm/lead', LENA, { aktion: 'setze', id, felder: { stufen } });
  schritt('CRM: Firmen', FIRMEN.length); schritt('CRM: Kontakte', KONTAKTE.length); schritt('CRM: Produkte', PRODUKTE.length); schritt('CRM: Mandate', 2); schritt('CRM: Deals', deals.length);
  // 3a) Produkte als Karten (19.10., P4): über den Produkt-Import — erst die Vorschau, dann übernehmen (wie „Produkte importieren“ im Browser).
  await rufe(R.produktImport(), 'POST', '/api/crm/produkte/import', LENA, { produkte: DEMO_PRODUKT_KARTEN, vorschau: true });
  const produktKarten = await rufe(R.produktImport(), 'POST', '/api/crm/produkte/import', LENA, { produkte: DEMO_PRODUKT_KARTEN, vorschau: false }) as { angelegt?: number; geaendert?: number };
  schritt('Produkte als Karten (Import)', (produktKarten.angelegt ?? 0) + (produktKarten.geaendert ?? 0));

  // 3b) Markttraktion › Planung (10.10.): zwei erfundene Leadkanäle (Netzwerk, eigene Eventreihe), ein Umsatzziel bis Jahresende, eine
  //     Challenge dieser Woche und ein abgehakter Schritt „nach der Leistung“ — über die Planungs-Route (Einzel-Schritte), wie im Browser.
  // Reihen sind Instanz-Daten (14.10.): die Demo legt eine erfundene Reihe in den Wertelisten an — über die Stammdaten-Route, wie im Browser.
  const REIHE_NAME = 'Abendreihe Nord (Beispiel)';
  await rufe(R.stammdaten(), 'POST', '/api/crm/stammdaten', LENA, { aktion: 'wertelisten', wertelisten: { reihen: [REIHE_NAME] } });
  const reihe = kennungAusName(REIHE_NAME);
  await rufe(R.planung(), 'PATCH', '/api/crm/planung', LENA, { ops: [
    { op: 'kanal', eintrag: { id: 'lk-demo-netzwerk', name: 'Netzwerk & Empfehlung (Beispiel)', herkunft: 'netzwerk', kanaele: ['netzwerk', 'empfehlung', 'outreach'], leadsMonat: 6, zyklusWochen: 8, quoten: { leadZuGespraech: 45, gespraechZuSql: 50 }, kostenJeLead: 20, verantwortlich: verantwortlich('sales'), rang: 1 } },
    { op: 'kanal', eintrag: { id: 'lk-demo-reihe', name: 'Eigene Abendreihe (Beispiel)', herkunft: 'eventreihe', ...(reihe ? { bezug: reihe } : {}), leadsMonat: 8, zyklusWochen: 10, quoten: { leadZuGespraech: 30 }, kostenJeLead: 35, minutenJeLead: 25, beitraegeWoche: 2, verantwortlich: verantwortlich('event'), rang: 2 } },
    // 16.10. (Abnahme 2 · B11): zwölf Monate statt „bis Jahresende“ — bei 8–10 Wochen Sales Cycle blieben bis Jahresende nur ein bis drei Wochen
    // Lead-Fenster, und das Scoreboard verlangte „≥ 116 Leads je Woche“. Mit einem Jahr verteilt sich dasselbe Ziel auf plausible Wochenziele.
    { op: 'ziel', eintrag: { id: 'uz-demo-jahr', gesellschaft: 'ug', titel: 'Neugeschäft in zwölf Monaten (Beispiel)', von: heute, bis: tagPlus(heute, 364), umsatz: 60_000, dealWert: 7_500 } },
    { op: 'challenge', eintrag: { id: 'chl-demo-gespraeche', woche: montag, art: 'gespraeche', titel: '6 echte Gespräche', ziel: 6, person: 'beide' } },
    { op: 'schritt', mandatId: 'm-demo-nordwerk', schritt: 'bewertung', erledigt: true },
  ] });
  schritt('Markttraktion-Planung', 5);

  // 3c) Produkte · Leistungstreppe (10.10.): eine erfundene Beispiel-Treppe (Check → Diagnose → zwei Pakete nebeneinander), die Kundenreise als
  //     Kreislauf, ein Paket in der Roadmap, Positionierung & Story und der Fortschritt eines Mandats — über die Route (Einzel-Schritte), wie im Browser.
  const tr = await rufe(R.treppe(), 'GET', '/api/crm/treppe', LENA);
  await rufe(R.treppe(), 'PATCH', '/api/crm/treppe', LENA, { ops: [
    { op: 'stufe', eintrag: { id: 'ts-demo-check', name: 'Kennzahlen-Check', ebene: 1, preis: { art: 'kostenlos' }, leistungIds: ['l-demo-check'], dauerTage: 7, aufwandStunden: 2, lieferobjekte: ['Kurzbefund auf einer Seite'], kennzahl: 'Anzahl offener Steuerungsfragen', aufgabe: 'Zeigt in einer Woche, wo die Steuerung hakt — ohne Risiko für den Kunden. Schafft den Anlass für die Diagnose.', ergebnis: 'Ein Kurzbefund und die Entscheidung, ob eine Diagnose lohnt.' } },
    { op: 'stufe', eintrag: { id: 'ts-demo-diagnose', name: 'Klarheits-Diagnose', ebene: 2, preis: { art: 'fest', betrag: 4800 }, dauerTage: 14, aufwandStunden: 16, leistungIds: ['l-demo-diagnose'], lieferobjekte: ['Zwei Workshops', 'Kennzahlen-Bild', 'Fahrplan 90 Tage'], kennzahl: 'Tage bis zur Monatszahl', regeln: { anrechnung: 'wird bei Buchung des Vertriebsaufbaus angerechnet' }, ziel: { umsatz: 48_000, kunden: 10 }, aufgabe: 'Macht sichtbar, was wirklich bremst — erst mit diesem Bild lohnt ein Vertriebsaufbau.', ergebnis: 'Ein gemeinsames Kennzahlen-Bild und ein Fahrplan für 90 Tage.' } },
    { op: 'stufe', eintrag: { id: 'ts-demo-begleitung', name: 'Vertriebsaufbau', ebene: 3, preis: { art: 'monat', betrag: 3500 }, aufwandStunden: 18, leistungIds: ['l-demo-retainer'], lieferobjekte: ['Monatlicher Steuerungstermin', 'Kennzahlen-Review'], kennzahl: 'Ziele im Quartal erreicht', regeln: { mindestlaufzeitMonate: 6, bonus: 'bei erreichten Quartalszielen', maxGleichzeitig: 4 }, ziel: { umsatz: 84_000, kunden: 4 }, aufgabe: 'Baut den Vertrieb Schritt für Schritt auf — Zielkunden, Ansprache, Team und Takt — bis er ohne uns läuft.' } },
    { op: 'stufe', eintrag: { id: 'ts-demo-cockpit', name: 'Cockpit-Lizenz', ebene: 3, preis: { art: 'monat', betrag: 490 }, aufwandStunden: 2, leistungIds: ['l-demo-software'], lieferobjekte: ['Einrichtung', 'Schulung'], kennzahl: 'aktive Nutzer je Woche', aufgabe: 'Für Kunden, die selbst steuern wollen — die Zahlen jeden Tag im Blick.' } },
    { op: 'station', eintrag: { id: 'st-demo-sichtbar', name: 'Sichtbarkeit', messgroesse: 'Anfragen je Monat', ziel: 6, ist: 4 } },
    { op: 'station', eintrag: { id: 'st-demo-check', name: 'Check', messgroesse: 'Checks im Jahr', ziel: 20, stufeId: 'ts-demo-check' } },
    { op: 'station', eintrag: { id: 'st-demo-diagnose', name: 'Diagnose', messgroesse: 'Diagnosen im Jahr', ziel: 10, stufeId: 'ts-demo-diagnose' } },
    { op: 'station', eintrag: { id: 'st-demo-mandat', name: 'Mandat', messgroesse: 'laufende Mandate', ziel: 4, stufeId: 'ts-demo-begleitung' } },
    { op: 'station', eintrag: { id: 'st-demo-empfehlung', name: 'Empfehlung', messgroesse: 'Empfehlungen je Quartal', ziel: 3, ist: 1 } },
    { op: 'paket', eintrag: { id: 'rp-demo-training', titel: 'Kennzahlen-Training für Teams', status: 'geplant', start: `${tagPlus(heute, 35).slice(0, 7)}`, fertig: `${tagPlus(heute, 95).slice(0, 7)}`, stufeId: 'ts-demo-begleitung', warum: 'Teams lernen, die Zahlen selbst zu lesen — macht die Begleitung leichter und öffnet die Cockpit-Lizenz.' } },
    { op: 'positionierung', stand: (tr.datei as { positionierungStand: string }).positionierungStand, felder: { claim: 'Mit klaren Kennzahlen schneller entscheiden.', zielgruppe: 'Geschäftsführung inhabergeführter Mittelständler mit 50 bis 500 Mitarbeitenden.', problem: 'Entscheidungen fallen aus dem Bauch, weil die Zahlen zu spät oder zu verstreut kommen.', versprechen: 'In 90 Tagen ein Kennzahlen-Bild, das jeden Monat trägt.' } },
    { op: 'kunde', mandatId: 'm-demo-nordwerk', felder: { naechster: { text: 'Quartals-Review vorbereiten', datum: tagPlus(heute, 9) } } },
    // Mit dem Tag des Termins (15.10., Abnahme B6: vorher „erledigt heute“, auch in einem Report vom 01.10.).
    { op: 'lieferobjekt', mandatId: 'm-demo-nordwerk', was: 'Monatlicher Steuerungstermin', erledigt: true, am: tagPlus(heute, -9) },
  ] });
  schritt('Leistungstreppe', 4);

  // 4) Gesellschaften: Holding (kdv) hält die operative (ug); die Beratung (kdc) als Einzelunternehmen; eine neue in Gründung.
  const reg = await rufe(R.gesellschaften(), 'GET', '/api/gesellschaften', LENA);
  const stand = (id: string) => ((reg.gesellschaften as { id: string; stand: string }[]) ?? []).find(g => g.id === id)?.stand;
  const steck = async (id: string, felder: Record<string, unknown>) => (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id, stand: stand(id), felder })).gesellschaft as { stand: string };
  const kdc = await steck('kdc', { rechtsform: 'einzel', status: 'eingetragen', sitz: 'Bielefeld', gegruendetAm: '2019-03-01' });
  // C10 (16.10.): das Einzelunternehmen führt seine Inhaberin — so hängt es in „Wer hält wen“ mit einer Inhaber-Linie an der Person.
  await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'kdc', stand: kdc.stand, liste: 'organe', eintrag: { funktion: 'geschaeftsfuehrung', wer: { art: 'person', id: LENA }, seit: '2019-03-01' } });
  let kdv = await steck('kdv', { rechtsform: 'ug', status: 'eingetragen', rolle: 'holding', sitz: 'Bielefeld', gegruendetAm: '2021-06-15', stammkapitalCent: '5.000', eingezahltCent: '5.000' });
  let ug = await steck('ug', { rechtsform: 'gmbh', status: 'eingetragen', sitz: 'Bielefeld', gegruendetAm: '2023-01-10', stammkapitalCent: '25.000', eingezahltCent: '25.000' });
  kdv = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'kdv', stand: kdv.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'person', id: LENA }, nennbetragCent: '5.000', einlage: 'ja' } })).gesellschaft as { stand: string };
  ug = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: ug.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '25.000', einlage: 'ja' } })).gesellschaft as { stand: string };
  ug = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: ug.stand, liste: 'vertraege', eintrag: { art: 'kooperation', titel: 'Büro-Mietvertrag (Beispiel)', parteien: [{ art: 'gesellschaft', id: 'ug' }], status: 'unterschrieben', beginn: tagPlus(heute, -400), kuendigungsfrist: '3 Monate zum Quartalsende', kuendigenBis: tagPlus(heute, 45), erinnerungTage: 30 } })).gesellschaft as { stand: string };
  const neu = (await rufe(R.gesellschaften(), 'POST', '/api/gesellschaften', LENA, { felder: { name: 'Nordlicht Ventures GmbH', rechtsform: 'gmbh', status: 'gruendung', rolle: 'holding', sitz: 'Bielefeld', stammkapitalCent: '25.000' } })).gesellschaft as { id: string; stand: string };
  let ng = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: neu.id, stand: neu.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '15.000', einlage: 'nein' } })).gesellschaft as { stand: string };
  ng = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: neu.id, stand: ng.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'person', id: JONAS }, nennbetragCent: '10.000', einlage: 'nein' } })).gesellschaft as { stand: string };
  void ng; void kdv;
  schritt('Gesellschaften', 4);

  // 4a) Beschluss-Buch (10.10.): erfundene Fassungen und Beschlüsse der operativen Gesellschaft — über dieselbe Route wie die Oberfläche (Stand aus der
  //     letzten Antwort). Die Kapitalerhöhung ist „gefasst“ → ihre Folgen (Pflichten, Fassung, Cap-Table) liegen danach als Vorschläge im Stapel.
  type GAnt = { stand: string; gesellschafter?: { id: string }[]; beschluesse?: { id: string }[] };
  let ugB = ug as GAnt;
  const gsHolding = ugB.gesellschafter?.[0]?.id;
  const register = async (liste: 'beschluesse' | 'fassungen', eintrag: Record<string, unknown>) => {
    ugB = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: ugB.stand, liste, eintrag })).gesellschaft as GAnt;
  };
  await register('fassungen', { merkmal: 'satzung', ab: '2023-01-10', text: 'Gründungsfassung (Beispiel)' });
  await register('fassungen', { merkmal: 'gegenstand', ab: '2023-01-10', text: 'Beratung zu Kennzahlen und Unternehmenssteuerung (Beispiel).' });
  await register('fassungen', { merkmal: 'stammkapital', ab: '2023-01-10', cent: '25.000' });
  const stimme = gsHolding ? { beteiligte: [gsHolding], abstimmung: [{ id: gsHolding, stimme: 'ja' }] } : {};
  await register('beschluesse', { datum: '2023-01-10', art: 'gf-bestellung', titel: 'Bestellung der Geschäftsführung (Beispiel)', status: 'eingetragen', eingetragenAm: '2023-02-01', ...stimme,
    inhalt: 'Zur Geschäftsführerin wird Lena (Beispiel) bestellt; sie vertritt die Gesellschaft einzeln.', aenderungen: [{ merkmal: 'geschaeftsfuehrung', text: 'Lena (Beispiel), einzelvertretungsberechtigt' }] });
  await register('beschluesse', { datum: tagPlus(heute, -280), art: 'jahresabschluss', titel: 'Feststellung des Jahresabschlusses (Beispiel)', status: 'gefasst', ...stimme,
    inhalt: 'Der Jahresabschluss des Vorjahres wird festgestellt; das Ergebnis wird auf neue Rechnung vorgetragen; der Geschäftsführung wird Entlastung erteilt.' });
  await register('beschluesse', { datum: tagPlus(heute, -40), art: 'satzungsaenderung', titel: 'Satzungsänderung: Gegenstand erweitert (Beispiel)', status: 'angemeldet', angemeldetAm: tagPlus(heute, -30), ...stimme,
    aenderungen: [{ merkmal: 'gegenstand', text: 'Beratung zu Kennzahlen und Unternehmenssteuerung sowie Entwicklung und Vertrieb von Software (Beispiel).' }] });
  await register('beschluesse', { datum: tagPlus(heute, -3), art: 'kapitalmassnahme', titel: 'Kapitalerhöhung auf 50.000 € (Beispiel)', status: 'gefasst', ...stimme,
    aenderungen: [{ merkmal: 'stammkapital', cent: '50.000' }], inhalt: 'Das Stammkapital wird um 25.000 € auf 50.000 € erhöht; die neuen Anteile übernimmt die Holding (Beispiel).' });
  void ugB;
  schritt('Beschluss-Buch', 7);

  // 4b) Unternehmen › Schild (10.10.): die operative Gesellschaft mit Profil, Dokumenten-Status, drei Risiken (bewertet), einer Marke und einer
  //     Versicherung — erfunden, über dieselbe Route wie die Oberfläche (Stand aus der letzten Antwort).
  let sch = ((await rufe(R.schild(), 'GET', '/api/gesellschaften/schild', LENA)).eintraege as { id: string; stand: string }[]).find(e => e.id === 'ug')!;
  const schild = async (body: Record<string, unknown>) => { const r = await rufe(R.schild(), 'PATCH', '/api/gesellschaften/schild', LENA, { id: 'ug', stand: sch.stand, ...body }); sch = r.eintrag as typeof sch; return r; };
  // B12 (15.10.): Profil passend zu den Monatsabschlüssen (unten) — und eine Tragfähigkeit, unter der die bewerteten Risiken zusammen bleiben.
  await schild({ profil: { beschaeftigte: 4, umsatzVorjahrCent: '186.000', bilanzsummeCent: '95.000', groessenklasse: 'klein', beraten: true, tragfaehigkeitCent: '80.000' } });
  for (const d of [
    { art: 'satzung', fassungVom: '2023-01-10', quelle: 'notar' }, { art: 'gesellschafterliste', fassungVom: '2023-01-10', quelle: 'notar' },
    { art: 'transparenzregister', fassungVom: tagPlus(heute, -400), quelle: 'register-abruf' }, { art: 'steuer-stammdaten', fassungVom: '2023-02-01', quelle: 'eigen' },
    { art: 'elster-zertifikat', fassungVom: tagPlus(heute, -700), gueltigBis: tagPlus(heute, 395), quelle: 'behoerde' }, { art: 'vvt', fassungVom: tagPlus(heute, -200), quelle: 'eigen' },
  ]) await schild({ liste: 'dokumente', eintrag: d });
  const kat = await schild({ katalog: ['R1', 'R3', 'R8'] });
  const risiken = ((kat.eintrag as { risiken: { id: string; katalogId: string }[] }).risiken);
  for (const [k, e, w, euro] of [['R1', 2, 4, '20.000'], ['R3', 4, 4, '25.000'], ['R8', 2, 3, '10.000']] as const) {
    await schild({ bewertung: { risikoId: risiken.find(x => x.katalogId === k)!.id, eintritt: e, wirkung: w, art: 'netto', wirkungCent: euro, grund: 'Erste Runde (Beispiel)' } });
  }
  // B12 (15.10.): Marke, Zertifikat und Police ohne Verlängerungs-Druck — die Demo zeigt EINE offene Frist (unten), keine Häufung.
  await schild({ liste: 'marken', eintrag: { bezeichnung: 'Nordlicht Cockpit', amt: 'dpma', form: 'wort', registerNr: '30 2016 000 000 (Beispiel)', anmeldetag: tagPlus(heute, -2900), klassen: '9, 42', inhaberIstGesellschaft: true } });
  await schild({ liste: 'versicherungen', eintrag: { art: 'vermoegensschaden', versicherer: 'Beispiel Versicherung AG', deckungFallCent: '1.000.000', beginn: '2023-01-10', ablauf: tagPlus(heute, 260), kuendigungsfristMonate: 3 } });
  await schild({ liste: 'ereignisse', eintrag: { art: 'neuer-vertrag', datum: tagPlus(heute, -5), notiz: 'Rahmenvertrag mit einem Pilotkunden (Beispiel)' } });
  // 4c) Unternehmen „in einem Blick“ (11.10.): ein Vermerk „erledigt“ (der Zeitstrahl zeigt auch Erledigtes) und der Ereignis-Assistent wie in der
  //     Oberfläche — „Neue Geschäftsführung“ in drei Wochen: Beschluss als Entwurf über das Register, Ereignis mit Zusatz-Schritt und Verweis auf den
  //     Beschluss über das Schild. Erfunden, über dieselben Routen.
  await schild({ vermerk: { regelId: 'groessenklasse', periode: `${Number(heute.slice(0, 4)) - 1}-12-31`, status: 'erledigt', am: heute } });
  const { situationVon, beschlussEntwurf, ereignisEintraege } = await import('@/lib/gesellschaften/schild/assistent');
  const gfLage = situationVon('gf')!;
  const regUg = ((await rufe(R.gesellschaften(), 'GET', '/api/gesellschaften', LENA)).gesellschaften as (RegisterGesellschaft & { stand: string })[]).find(g => g.id === 'ug')!;
  const gfDatum = tagPlus(heute, 21);
  const entwurf = beschlussEntwurf(gfLage, regUg, gfDatum, heute);
  const nachEntwurf = entwurf ? ((await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: regUg.stand, liste: 'beschluesse', eintrag: entwurf })).gesellschaft as { beschluesse?: { id: string; status: string }[] }) : null;
  const entwurfId = nachEntwurf?.beschluesse?.find(b => b.status === 'entwurf' && !(regUg.beschluesse ?? []).some(x => x.id === b.id))?.id;
  for (const ev of ereignisEintraege(gfLage, null, gfDatum, { beschluss: !!entwurfId, zusatz: ['z-partner'] }, 'Zweite Geschäftsführung (Beispiel)')) {
    await schild({ liste: 'ereignisse', eintrag: ev, ...(entwurfId ? { ausBeschluss: entwurfId } : {}) });
  }
  schritt('Unternehmen › Schild', 1);

  // 4c') B12 (Abnahme 2, 15.10.): das Demo-Unternehmen steht nicht in Schieflage — die Pflichten der Vorjahre und alles, was bis heute fällig war,
  //      gelten als erledigt (Vermerk „erledigt am“ zum Fristtag, über die Schild-Route wie der Haken in der Oberfläche); von dem, was gerade fällig
  //      wird, bleibt genau EINE Frist offen (die nächste) — ein echter Punkt, keine Mahnung. Schon angelegte Erinnerungen schließt der Server selbst.
  const { unternehmenLage } = await import('@/lib/gesellschaften/schild-server');
  // Die Holding bekommt ihr Profil (sonst „Profil unvollständig“) — erfunden, über dieselbe Route; ohne Größenklasse, damit ihre Fristen bleiben.
  const standHolding = ((await rufe(R.schild(), 'GET', '/api/gesellschaften/schild', LENA)).eintraege as { id: string; stand: string }[]).find(e => e.id === 'kdv')?.stand;
  await rufe(R.schild(), 'PATCH', '/api/gesellschaften/schild', LENA, { id: 'kdv', stand: standHolding, profil: { beschaeftigte: 0, umsatzVorjahrCent: '0', bilanzsummeCent: '60.000', beraten: true } });
  const lageU = await unternehmenLage(DEMO_HAUSHALT, heute);
  const offenBleibt = lageU.gesellschaften.flatMap(g => g.pflichten.filter(x => x.status === 'faellig').map(x => ({ g: g.id, schluessel: x.schluessel, frist: x.frist })))
    .sort((a, b) => a.frist.localeCompare(b.frist))[0];
  const schildStaende = (await rufe(R.schild(), 'GET', '/api/gesellschaften/schild', LENA)).eintraege as { id: string; stand: string }[];
  let vermerkt = 0;
  for (const g of lageU.gesellschaften) {
    let standG = schildStaende.find(e => e.id === g.id)?.stand;
    for (const x of g.pflichten) {
      if (x.status !== 'ueberfaellig' && x.status !== 'faellig') continue;
      if (offenBleibt && offenBleibt.g === g.id && offenBleibt.schluessel === x.schluessel) continue;
      const r = await rufe(R.schild(), 'PATCH', '/api/gesellschaften/schild', LENA, { id: g.id, stand: standG, vermerk: { regelId: x.regelId, periode: x.periode, status: 'erledigt', am: x.frist < heute ? x.frist : heute } });
      standG = (r.eintrag as { stand: string }).stand;
      vermerkt++;
    }
    // Erreichte Schwellen (z. B. erste Beschäftigte) sind längst umgesetzt — Vermerk „laufend“ wie der Haken in der Oberfläche.
    for (const z of g.schwellen.filter(x => x.stand === 'erreicht' && !x.umgesetzt)) {
      const r = await rufe(R.schild(), 'PATCH', '/api/gesellschaften/schild', LENA, { id: g.id, stand: standG, vermerk: { regelId: `schwelle:${z.def.id}`, periode: 'laufend', status: 'erledigt', am: heute } });
      standG = (r.eintrag as { stand: string }).stand;
      vermerkt++;
    }
  }
  schritt('Unternehmen › Pflichten erledigt', vermerkt);

  // 4d) Angebot (Abnahme 14.10., B15): der Deal „Diagnose Grünfeld Bau“ steht in Stufe „Angebot“ — also gibt es auch ein GESTELLTES Angebot. Erst
  //     der Absender der operativen Gesellschaft (Pflichtangaben § 35a GmbHG, erfunden), dann Entwurf und Stellen über die Angebots-Route
  //     (Nummer, PDF in der Ablage, Deal/Follow-up/Aktivität wie in der Oberfläche). Der Name der Gesellschaft kommt aus der Instanz (lib/einheiten.ts).
  const abs = ((await rufe(R.absender(), 'GET', '/api/crm/gesellschaften', LENA)).gesellschaften as { id: string; stand?: string }[]).find(g => g.id === 'ug');
  await rufe(R.absender(), 'PATCH', '/api/crm/gesellschaften', LENA, { id: 'ug', ...(abs?.stand ? { stand: abs.stand } : {}), felder: {
    firmierung: UG_NAME, strasse: 'Beispielweg 1', plz: '33602', ort: 'Bielefeld', email: `kontakt@${DEMO_DOMAIN}`, steuernummer: '000/000/00000 (Beispiel)',
    geschaeftsfuehrung: `${DEMO_PERSONEN[0].name} (Beispiel)`, register: 'Amtsgericht Bielefeld, HRB 00000 (Beispiel)',
    // Bankverbindung (A7): die öffentliche Beispiel-IBAN (DEMO_IBAN) — damit eine Rechnung bis „gestellt“ vorführbar ist.
    bank: { inhaber: UG_NAME, bank: 'Beispielbank (Demo)', iban: DEMO_IBAN },
  } });
  const diagnose = PRODUKTE[0];
  const entwurfA = (await rufe(R.angebot(), 'POST', '/api/crm/angebot', LENA, { aktion: 'speichern', id: 'ang-demo-gruenfeld', felder: {
    gesellschaft: 'ug', kontaktId: kontaktId('elif'), firmaId: 'f-demo-gruenfeld', titel: 'Klarheits-Diagnose für Grünfeld Bau (Beispiel)',
    positionen: [{ id: 'p1', leistungId: diagnose.id, titel: diagnose.name, text: diagnose.text, menge: 1, einheit: 'pauschal', einzelpreisCent: diagnose.preis.betrag * 100, ustSatz: 19, basis: 'einmalig' }],
    einleitung: 'vielen Dank für das offene Gespräch. Wie besprochen schlagen wir eine Diagnose in zwei Wochen vor (Beispiel).',
    schluss: 'Wir freuen uns auf Ihre Rückmeldung.', gueltigBis: tagPlus(heute, 21), zahlungszielTage: 14,
  } })).angebot as { id: string; stand: string };
  await rufe(R.angebot(), 'POST', '/api/crm/angebot', LENA, { aktion: 'stellen', id: entwurfA.id, stand: entwurfA.stand, nachfassenAm: tagPlus(heute, 2) });
  schritt('Angebot (gestellt)', 1);

  // 5) Ziele (Jahr, Business + Privat) und Meilensteine mit Aufwand, Personen, Kette.
  const opsLabel = einheitAusGesellschaft('ug') ?? 'Operativ';
  const ziele = [
    // C17 (16.10.): Messgröße MRR — neben dem Fortschritt steht der gemessene Ist-Wert aus den Mandaten („Ist 5.950 € = 24 %“).
    { id: 'z-demo-umsatz', titel: 'Wiederkehrender Umsatz 25.000 € je Monat', fortschritt: 40, space: 'business', einheit: opsLabel, zielwert: 25000, messgroesse: 'mrr', rang: 1, aufwand: 60, personen: [KONTO_LENA] },
    { id: 'z-demo-produkt', titel: 'Cockpit 2.0 bei fünf Kunden im Einsatz', fortschritt: 25, space: 'business', einheit: opsLabel, rang: 2 },
    { id: 'z-demo-team', titel: 'Team auf drei feste Köpfe ausbauen', fortschritt: 10, space: 'business', rang: 3 },
    { id: 'z-demo-ruhe', titel: 'Vier Wochen Urlaub ohne Laptop', fortschritt: 50, space: 'privat', rang: 1 },
  ];
  await rufe(R.ziele(), 'PATCH', '/api/state/ziele', LENA, { horizont: 'jahr', ops: ziele.map(upsert) });
  const ms = [
    { id: 'ms-demo-pipeline', titel: 'Pipeline: 10 qualifizierte Gespräche', zielId: 'z-demo-umsatz', faellig: tagPlus(heute, 18), aufwand: 30, personen: [KONTO_LENA], fortschritt: 0, messlatte: '10 Gespräche mit Bedarf im CRM' },
    { id: 'ms-demo-angebote', titel: 'Drei Angebote verschickt', zielId: 'z-demo-umsatz', faellig: tagPlus(heute, 32), aufwand: 24, personen: [KONTO_LENA, KONTO_JONAS], fortschritt: 0, wartetAuf: ['ms-demo-pipeline'], messlatte: 'Drei Angebote im Angebots-Tool gestellt' },
    { id: 'ms-demo-cockpit', titel: 'Cockpit 2.0 Beta fertig', zielId: 'z-demo-produkt', faellig: tagPlus(heute, 25), aufwand: 120, personen: [KONTO_JONAS, MIRA.id], fortschritt: 0, messlatte: 'Beta bei zwei Pilotkunden' },
    { id: 'ms-demo-rollout', titel: 'Rollout bei Lumen (5 Standorte)', zielId: 'z-demo-produkt', faellig: tagPlus(heute, 50), aufwand: 60, personen: [KONTO_JONAS], fortschritt: 0, wartetAuf: ['ms-demo-cockpit'], mandatId: 'm-demo-lumen', messlatte: 'Alle fünf Standorte arbeiten im Cockpit' },
    { id: 'ms-demo-recruiting', titel: 'Stelle „Beratung“ besetzt', zielId: 'z-demo-team', faellig: tagPlus(heute, 70), aufwand: 20, personen: [KONTO_LENA], fortschritt: 0, messlatte: 'Vertrag unterschrieben' },
  ].map((m, i) => ({ ...m, space: 'business', erledigt: false, rang: i + 1 }));
  await rufe(R.meilensteine(), 'PATCH', '/api/state/meilensteine', LENA, { ops: ms.map(upsert) });
  schritt('Ziele', ziele.length); schritt('Meilensteine', ms.length);

  // 5b) Nordstern des Haushalts (08.10. abends, Planung › Jahr) — erfunden, über denselben Weg wie die Karte (GET Stand, PUT mit Stand).
  const ns = await rufe(R.nordstern(), 'GET', '/api/planung/nordstern', LENA);
  await rufe(R.nordstern(), 'PUT', '/api/planung/nordstern', LENA, { text: 'Nordlicht Labs wird die erste Adresse für klare Kennzahlen im Mittelstand — 40 Kunden, die wir beim Namen kennen, und ein Team, das freitags um vier Feierabend macht. (Beispiel)', stand: ns.stand });
  // Routinen (08.10. abends): eine leere Instanz startet ohne Routinen — die Demo zeigt ein paar erfundene, neutrale Beispiele
  // (gemeinsam und je Person) über den Routinen-Schreibweg.
  const routinen = [
    { id: 'r-demo-plan', label: 'Tagesplan festlegen · 10 Min', wann: 'morgen', kategorie: 'business', dauerMin: 10, owner: 'beide', space: 'business' },
    { id: 'r-demo-spaziergang', label: 'Spaziergang an der frischen Luft', wann: 'tag', kategorie: 'leben', dauerMin: 20, owner: LENA, space: 'privat' },
    { id: 'r-demo-lesen', label: 'Lesen · 20 Min', wann: 'abend', kategorie: 'leben', dauerMin: 20, owner: LENA, space: 'privat' },
    // Gemeinsam im Privat-Bereich (09.10., E4-Rest): sehen Lena und Jonas, der Partner nie (auch nicht als „Belegt“).
    { id: 'r-demo-abendessen', label: 'Gemeinsames Abendessen ohne Handy', wann: 'abend', kategorie: 'leben', dauerMin: 45, owner: 'beide', space: 'privat' },
    // Routinen 2 (10.10.): ein Zähler, feste Wochentage mit Uhrzeit und Erinnerung, ein n-ter Wochentag — erfunden und neutral.
    { id: 'r-demo-wasser', label: 'Wasser trinken', wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, owner: LENA, space: 'privat', tagesZiel: 8, zaehlWort: 'Gläser' },
    { id: 'r-demo-laufen', label: 'Laufen', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 40, owner: LENA, space: 'privat', regel: { art: 'wochentage', tage: [1, 4] }, uhrzeiten: ['07:00'], erinnerung: true },
    { id: 'r-demo-finanzen', label: 'Haushaltsbuch abschließen', wann: 'abend', kategorie: 'leben', dauerMin: 30, owner: 'beide', space: 'privat', regel: { art: 'monatlich', nter: { n: 1, tag: 1 } } },
  ];
  await rufe(R.routinen(), 'PATCH', '/api/state/routinen', LENA, { ops: routinen.map(upsert) });
  await rufe(R.routinen(), 'PATCH', '/api/state/routinen', JONAS, { ops: [upsert({ id: 'r-demo-wochenrueckblick', label: 'Wochenrückblick vorbereiten', wann: 'tag', kategorie: 'business', dauerMin: 30, owner: JONAS, space: 'business', rhythmus: 'woechentlich' })] });
  // Der Partner legt seine eigene Business-Routine über denselben Weg an (ein Privat-Eintrag würde mit 403 abgelehnt).
  await rufe(R.routinen(), 'PATCH', '/api/state/routinen', BEN, { ops: [upsert({ id: 'r-demo-partner-pipeline', label: 'Pipeline-Abgleich mit Lena', wann: 'tag', kategorie: 'business', dauerMin: 20, owner: BEN, space: 'business', rhythmus: 'woechentlich' })] });
  schritt('Nordstern', 1); schritt('Routinen', routinen.length + 2);

  // 6) Gründungsfahrplan der neuen Gesellschaft — wie der Knopf im Steckbrief (components/os/unternehmen/Fahrplan.tsx).
  const plan = fahrplanFuer(neu.id, { name: 'Nordlicht Ventures GmbH', art: 'gruendung' }, 'Nordlicht Ventures GmbH', heute);
  await rufe(R.ziele(), 'PATCH', '/api/state/ziele', LENA, { horizont: 'jahr', ops: [upsert(plan.ziel)] });
  await rufe(R.meilensteine(), 'PATCH', '/api/state/meilensteine', LENA, { ops: plan.meilensteine.map(upsert) });
  for (const a of plan.aufgaben) await rufe(R.aufgabe(), 'POST', '/api/tasks/create', LENA, { title: a.titel, meilensteinId: a.meilensteinId });
  schritt('Gründungsfahrplan (Meilensteine)', plan.meilensteine.length); schritt('Gründungsfahrplan (Aufgaben)', plan.aufgaben.length);

  // 7) Aufgaben: am Meilenstein und frei, mit Fristen, verteilt auf beide.
  const aufgaben: { title: string; person: string; meilensteinId?: string; dueDate?: string; priority?: string; space?: string; einheit?: string }[] = [
    { title: 'Zehn Wunschkunden recherchieren', person: LENA, meilensteinId: 'ms-demo-pipeline', dueDate: tagPlus(heute, 3), priority: 'high' },
    { title: 'Power Hour: fünf Anrufe', person: LENA, meilensteinId: 'ms-demo-pipeline', dueDate: tagPlus(heute, 2) },
    { title: 'Angebotsvorlage überarbeiten', person: JONAS, meilensteinId: 'ms-demo-angebote', dueDate: tagPlus(heute, 12) },
    { title: 'Beta-Funktionen festlegen', person: JONAS, meilensteinId: 'ms-demo-cockpit', dueDate: tagPlus(heute, 4), priority: 'high' },
    { title: 'Design der Startseite (mit Mira)', person: JONAS, meilensteinId: 'ms-demo-cockpit', dueDate: tagPlus(heute, 9) },
    { title: 'Testplan für zwei Pilotkunden', person: JONAS, meilensteinId: 'ms-demo-cockpit', dueDate: tagPlus(heute, 16) },
    { title: 'Stellenprofil Beratung schreiben', person: LENA, meilensteinId: 'ms-demo-recruiting', dueDate: tagPlus(heute, 20) },
    { title: 'Monatsabschluss an die Kanzlei', person: JONAS, dueDate: tagPlus(heute, 6), space: 'business', einheit: opsLabel },
    { title: 'Kennzahlen-Review Nordwerk vorbereiten', person: LENA, dueDate: tagPlus(heute, 1), priority: 'critical', space: 'business', einheit: opsLabel },
    { title: 'Urlaub im Frühjahr buchen', person: LENA, dueDate: tagPlus(heute, 14), space: 'privat' },
    { title: 'Geschenk für das Familienfest besorgen', person: LENA, dueDate: tagPlus(heute, 2), priority: 'high', space: 'privat' },
  ];
  for (const a of aufgaben) {
    const { person, ...rest } = a;
    await rufe(R.aufgabe(), 'POST', '/api/tasks/create', person, { ...rest, description: 'Beispiel-Aufgabe (Demo).' });
  }
  schritt('Aufgaben', aufgaben.length);

  // 7b) Seil (07.10., LICHTFAEDEN.md › Seil): Stränge, die auf die Ziele einzahlen — ein Unterziel, Meilensteine mit Kette und
  //     Erledigtem, Projekte mit „zahlt ein auf …“, Karten mit „wartet auf …“ (eine Blockade) und Erledigtes fürs Momentum.
  //     Über dieselben Schreibwege (Bereich, Kreis und Ziel werden dort geprüft).
  await rufe(R.ziele(), 'PATCH', '/api/state/ziele', LENA, { horizont: 'quartal', ops: [upsert({ id: 'z-demo-piloten', titel: 'Zwei Pilotkunden live', fortschritt: 50, space: 'business', einheit: opsLabel, termin: tagPlus(heute, 60), oberzielId: 'z-demo-produkt' })] });
  const msSeil = [
    { id: 'ms-demo-referenz', titel: 'Referenzfall veröffentlicht', zielId: 'z-demo-umsatz', faellig: tagPlus(heute, -10), erledigt: true, erledigtAm: tagPlus(heute, -12), fortschritt: 100 },
    { id: 'ms-demo-handbuch', titel: 'Handbuch Cockpit 2.0', zielId: 'z-demo-produkt', faellig: tagPlus(heute, 40), erledigt: false, fortschritt: 0, wartetAuf: ['ms-demo-cockpit'] },
    { id: 'ms-demo-einarbeitung', titel: 'Einarbeitung neue Beratung', zielId: 'z-demo-team', faellig: tagPlus(heute, 95), erledigt: false, fortschritt: 0, wartetAuf: ['ms-demo-recruiting'] },
  ].map((m, i) => ({ ...m, space: 'business', rang: 20 + i }));
  await rufe(R.meilensteine(), 'PATCH', '/api/state/meilensteine', LENA, { ops: msSeil.map(upsert) });
  const projektSeil = (id: string, title: string, spaceId: string, zielId: string, start: number, ende: number, color: string) => ({ id, title, spaceId, category: spaceId === 'privat' ? 'joint' : 'business', owner: 'both', color, tags: [], archived: false, zielId, start: tagPlus(heute, start), ende: tagPlus(heute, ende) });
  const karte = (id: string, title: string, projectId: string, spaceId: string, faellig: number, extra: Record<string, unknown> = {}) => ({ id, title, projectId, spaceId, status: 'todo', priority: 'medium', assignee: LENA, tags: [], subTasks: [], dependencies: [], sortOrder: 0, dueDate: tagPlus(heute, faellig), description: 'Beispiel-Aufgabe (Demo).', ...extra });
  const karten = [
    karte('t-demo-case', 'Case Study schreiben', 'p-demo-vertrieb', 'ug', -8, { status: 'done' }),
    karte('t-demo-serie', 'LinkedIn-Serie planen', 'p-demo-vertrieb', 'ug', 5, { assignee: JONAS }),
    karte('t-demo-webinar', 'Webinar vorbereiten', 'p-demo-vertrieb', 'ug', 16, { abhaengigVon: ['t-demo-serie'] }),
    karte('t-demo-live', 'Webinar durchführen', 'p-demo-vertrieb', 'ug', 24, { abhaengigVon: ['t-demo-webinar'], priority: 'high' }),
    karte('t-demo-teamtag', 'Teamtag organisieren', 'p-demo-team', 'ug', 30, { assignee: JONAS }),
    karte('t-demo-werte', 'Werte-Workshop', 'p-demo-team', 'ug', 12, { status: 'done' }),
    karte('t-demo-preise', 'Preisliste aktualisieren', 'sonstige-ug', 'ug', 7, { zielId: 'z-demo-umsatz' }),
    karte('t-demo-reise', 'Reiseziel auswählen', 'p-demo-urlaub', 'privat', -3, { status: 'done' }),
    karte('t-demo-unterkunft', 'Unterkunft buchen', 'p-demo-urlaub', 'privat', 21, { abhaengigVon: ['t-demo-reise'] }),
    karte('t-demo-vertretung', 'Vertretung im Büro klären', 'p-demo-urlaub', 'privat', 35),
  ];
  await rufe(R.aufgaben(), 'PATCH', '/api/state/tasks', LENA, {
    struktur: { projekte: [
      projektSeil('p-demo-vertrieb', 'Vertrieb & Sichtbarkeit', 'ug', 'z-demo-umsatz', -20, 45, '#E0A84E'),
      projektSeil('p-demo-team', 'Team & Kultur', 'ug', 'z-demo-team', -10, 60, '#A79BFF'),
      projektSeil('p-demo-urlaub', 'Urlaub planen', 'privat', 'z-demo-ruhe', -15, 50, '#3DE28B'),
    ].map(upsert) },
    ops: karten.map(task => ({ op: 'upsert', task })),
  });
  schritt('Seil (Bezüge)', 1 + msSeil.length + 3 + karten.length);

  // 7c) Heute (10.10., Branch `heute-top3`): zwei Freigaben von ZOE im Stapel (Ausnahme zur Regel „nur über Routen“: der Stapel hat keinen Schreibweg im
  //     Browser — Vorschläge legt nur ZOE selbst ab, hier `lege` wie im Lauf) und die Top 3 des Tages von Lena im Business — über die Route:
  //     genau ZOEs Vorschlag übernommen. Privat bleibt im Zustand „Vorschlag“ (Übernehmen/Anpassen), so sind beide Zustände vorführbar.
  const { lege } = await import('@/lib/zoe/stapel');
  const vorschlaege = [
    { titel: 'Angebot Grünfeld Bau nachfassen', anlass: 'Das Angebot liegt seit acht Tagen ohne Antwort (Beispiel).', eingabe: { title: 'Angebot Grünfeld Bau nachfassen', priority: 'high', faellig: tagPlus(heute, 1) } },
    { titel: 'Monatsabschluss vorbereiten', anlass: 'Der Monat endet in einer Woche, die Belege sind noch nicht vollständig (Beispiel).', eingabe: { title: 'Belege für den Monatsabschluss sammeln', priority: 'medium', faellig: tagPlus(heute, 5) } },
  ];
  for (const v of vorschlaege) {
    // Erfundene Vorschläge von ZOE — als „Beispiel“ markiert (15.10., Abnahme 2 B13; lib/demo/beispiel.ts).
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe anlegen', nachher: `Aufgabe „${v.titel}“ anlegen`, eingabe: v.eingabe, anlass: v.anlass, person: LENA, quelle: 'lauf', beispiel: true } as Parameters<typeof lege>[0]);
  }
  const t3 = await rufe(R.top3(), 'GET', '/api/heute/top3?space=business', LENA);
  const vorschlagIds = ((t3.bereiche as { business?: { vorschlag: { id: string }[] } }).business?.vorschlag ?? []).map(z => z.id);
  if (vorschlagIds.length) await rufe(R.top3(), 'PUT', '/api/heute/top3', LENA, { aktion: 'festlegen', space: 'business', ids: vorschlagIds, stand: '' });
  schritt('Heute: Top 3 und Freigaben', vorschlagIds.length + vorschlaege.length);

  // 8) Wochenvorlage (Arbeitszeit) je Person — Grundlage von Kalender-Verfügbarkeit und Kapazität.
  for (const [person, tage, von, bis] of [[LENA, [1, 2, 3, 4, 5], '08:30', '17:30'], [JONAS, [1, 2, 3, 4], '09:00', '17:00']] as const) {
    await rufe(R.routinen(), 'PATCH', '/api/state/routinen', person, { bloecke: tage.map(t => upsert({ id: `b-demo-${person}-${t}`, owner: person, wochentag: t, von, bis, art: 'business', titel: 'Arbeit' })) });
  }
  schritt('Wochenvorlage', 9);

  // 9) Termine (Stand wie vom Mac geliefert — in der Demo der einzige Kalender, nur lesen).
  const termin = (tag: string, von: string, bis: string, title: string, kal: string, ort?: string) => ({ id: `demo-${sha(`${tag}${von}${title}`).slice(0, 12)}`, title, startDate: `${tag}T${von}:00`, endDate: `${tag}T${bis}:00`, allDay: false, calendarName: kal, ...(ort ? { location: ort } : {}) });
  const events = [] as ReturnType<typeof termin>[];
  for (let w = -1; w <= 2; w++) {
    const mo = tagPlus(montag, 7 * w);
    events.push(termin(mo, '09:00', '09:45', 'Wochenstart Team', 'Arbeit'));
    events.push(termin(tagPlus(mo, 1), '10:00', '10:30', 'Wochen-Check Nordwerk', 'Arbeit', 'Video'));
    events.push(termin(tagPlus(mo, 2), '14:00', '15:00', 'Power Hour Vertrieb', 'Arbeit'));
    events.push(termin(tagPlus(mo, 3), '11:00', '12:00', 'Cockpit-Abstimmung Lumen', 'Arbeit', 'Video'));
    events.push(termin(tagPlus(mo, 4), '16:00', '17:00', 'Wochenrückblick', 'Arbeit'));
  }
  events.push(termin(tagPlus(heute, 5), '10:00', '12:00', 'Workshop Atlas Software (Ausgangslage)', 'Arbeit', 'Köln'));
  events.push(termin(tagPlus(heute, 8), '13:00', '14:30', 'Demo-Termin Seeblick Hotels', 'Arbeit', 'Konstanz'));
  events.push(termin(tagPlus(heute, 3), '19:00', '21:00', 'Abendessen mit Freunden', 'Privat'));
  await saveJson('calendar-cache', { events, at: jetzt.toISOString() });
  // „Arbeit“ zählt als belegt (17.10., Gesamtprüfung L1 B5): sonst schlug die Willkommensmail einen Kick-off mitten in den „Wochenstart Team“ vor — nicht
  // zugeordnete Kalender blockieren niemanden (R-K2). Über die Route der Einstellungen.
  await rufe(R.kalenderEinstellungen(), 'PUT', '/api/state/kalender-einstellungen', LENA, { teil: { belegt: { Arbeit: true } } });
  schritt('Termine', events.length);

  // 10) Kapazität: Grundwerte, Urlaub, Zuweisungen (Mandate).
  await rufe(R.kapazitaet(), 'PATCH', '/api/kapazitaet', LENA, { ops: [
    { op: 'grundwert', person: KONTO_LENA, stundenWoche: 40 },
    { op: 'grundwert', person: MIRA.id, stundenWoche: 16 },
    // Der Partner arbeitet nebenher mit (sonst zählte für ihn die Annahme 40 h je Konto).
    { op: 'grundwert', person: KONTO_BEN, stundenWoche: 10 },
    { op: 'zuweisung', zuweisung: { id: 'kz-demo-1', person: KONTO_LENA, art: 'mandat', bezugId: 'm-demo-nordwerk', stundenWoche: 6 } },
    { op: 'zuweisung', zuweisung: { id: 'kz-demo-2', person: KONTO_JONAS, art: 'mandat', bezugId: 'm-demo-lumen', stundenWoche: 8 } },
    { op: 'ausnahme', person: MIRA.id, ausnahme: { id: 'ka-demo-1', art: 'urlaub', von: tagPlus(montag, 21), bis: tagPlus(montag, 25), titel: 'Urlaub' } },
  ] });
  await rufe(R.kapazitaet(), 'PATCH', '/api/kapazitaet', JONAS, { ops: [
    { op: 'grundwert', person: KONTO_JONAS, stundenWoche: 32 },
    { op: 'ausnahme', person: KONTO_JONAS, ausnahme: { id: 'ka-demo-2', art: 'block', von: tagPlus(montag, -60), stundenWoche: 4, titel: 'Lehrauftrag' } },
  ] });
  schritt('Kapazität', 7);

  // 11) Gemessene Fokus-Zeit der letzten drei Wochen (Business) — Ist für die Plan-Treue.
  let bloecke = 0;
  for (const [person, je, ms1] of [[LENA, [4, 4, 3.5, 3.5, 2.5], 'ms-demo-pipeline'], [JONAS, [5, 5, 4.5, 4.5], 'ms-demo-cockpit']] as const) {
    for (let w = 3; w >= 1; w--) {
      const mo = tagPlus(montag, -7 * w);
      for (let d = 0; d < je.length; d++) {
        const tag = tagPlus(mo, d);
        const h = je[d] * (w === 2 ? 0.7 : 1);
        const von = new Date(`${tag}T07:00:00.000Z`), bis = new Date(von.getTime() + h * 3_600_000);
        await rufe(R.zeit(), 'POST', '/api/state/zeit', person, { aktion: 'fokus', von: von.toISOString(), bis: bis.toISOString(), schluessel: 'business:fokus', label: ms1 === 'ms-demo-pipeline' ? 'Vertrieb' : 'Produkt' });
        bloecke++;
      }
    }
  }
  schritt('Fokus-Blöcke', bloecke);

  // 12) Wochenpläne: drei vergangene Wochen (Morgenlauf-Schritt mit dem Montag von damals) und die laufende.
  const { kapaPlanFesthalten } = await import('@/lib/kapazitaet/server');
  let wochen = 0;
  for (const w of [3, 2, 1, 0]) if ((await kapaPlanFesthalten(DEMO_HAUSHALT, tagPlus(montag, -7 * w), jetzt)).neu) wochen++;
  schritt('Wochenpläne festgehalten', wochen);

  // 13) Finanzplanung: leer beginnen, dann erfundene Zahlen über den Schreibweg (Operationen mit Stand).
  await rufe(R.finanzImport(), 'POST', '/api/finanzplan/import', LENA, { leer: true });
  const fp = await rufe(R.finanzplan(), 'GET', '/api/finanzplan', LENA);
  const zeile = (id: string, name: string, einheit: string, gruppe: string, soll: number, typ?: string) => ({ id, name, einheit, gruppe, soll, ...(typ ? { typ } : {}) });
  await rufe(R.finanzplan(), 'PATCH', '/api/finanzplan', LENA, { basisStand: (fp.dokument as { stand?: string } | null)?.stand, ops: [
    { pfad: '/sachkosten', neu: [
      zeile('sk-demo-buero', 'Büro', 'ug', 'Raum', 1200, 'fix'), zeile('sk-demo-software', 'Software & Werkzeuge', 'ug', 'IT', 380, 'fix'),
      zeile('sk-demo-kanzlei', 'Steuerberatung', 'ug', 'Beratung', 450, 'fix'), zeile('sk-demo-reise', 'Reisen', 'ug', 'Vertrieb', 300, 'flex'),
      zeile('sk-demo-holding', 'Holding: Buchhaltung', 'kdv', 'Beratung', 120, 'fix'),
    ] },
    { pfad: '/privatBudget', neu: [
      zeile('pb-demo-miete', 'Miete', 'privat', 'Wohnen', 1650, 'fix'), zeile('pb-demo-leben', 'Lebensmittel', 'privat', 'Alltag', 700, 'flex'),
      zeile('pb-demo-mobil', 'Mobilität', 'privat', 'Alltag', 250, 'flex'), zeile('pb-demo-ruecklage', 'Rücklage', 'privat', 'Sparen', 500, 'sparen'),
    ] },
    // B10 (15.10.): Gehälter statt einer privaten Einnahme — Geschäftsführung (Gehalt 1) und Produkt & Finanzen (Gehalt 2) laufen über die operative
    // Gesellschaft, mit Arbeitgeberanteil und einer erfundenen Netto-Tabelle; das Netto kommt so im Haushalt an (keine doppelte Einnahme mehr).
    { pfad: '/annahmen/kevinBrutto', neu: 5200 }, { pfad: '/annahmen/kevinAb', neu: 1 },
    { pfad: '/annahmen/malinBrutto', neu: 4300 }, { pfad: '/annahmen/malinAb', neu: 1 },
    { pfad: '/annahmen/agAnteil', neu: 0.21 },
    { pfad: '/annahmen/nettoTabelle', neu: [[0, 0], [2500, 1820], [4300, 2860], [5200, 3320], [8000, 4650]] },
    { pfad: '/szenarien/0/retainer', neu: [{ name: 'Nordwerk', betrag: 3500, start: 1, laufzeit: 12 }, { name: 'Lumen', betrag: 2450, start: 1, laufzeit: 24 }] },
    { pfad: '/posten', neu: [{ id: 'po-demo-konto', art: 'konto', einheit: 'ug', name: 'Geschäftskonto (Beispiel)', betrag: 48000, status: 'ok' }, { id: 'po-demo-privat', art: 'konto', einheit: 'privat', name: 'Girokonto (Beispiel)', betrag: 9500, status: 'ok' }] },
    { pfad: '/planszenarien', neu: [{ id: 'ps-demo-wachstum', name: 'Wachstum mit Cockpit', basis: 'basis', angelegt: jetzt.toISOString(), annahmen: {}, bausteine: [
      { id: 'bs-demo-1', art: 'umsatz', einheit: 'ug', name: 'Vertriebsaufbau (neu)', preis: 3500, menge: 2, rhythmus: 'monatlich', start: 3, an: true, produktId: 'l-demo-retainer' },
      { id: 'bs-demo-2', art: 'umsatz', einheit: 'ug', name: 'Cockpit-Lizenzen', preis: 490, menge: 8, rhythmus: 'monatlich', start: 4, an: true, produktId: 'l-demo-software' },
      { id: 'bs-demo-3', art: 'kosten', einheit: 'ug', name: 'Beraterin (Teilzeit)', preis: 3200, menge: 1, rhythmus: 'monatlich', start: 5, an: true },
      // B10 (15.10.): das Projektgeschäft, das die Monatsabschlüsse zeigen, die freie Mitarbeit und einmalig Recruiting & Messe — so liegt der
      // Tiefpunkt der Kasse in den nächsten Monaten statt „heute“, und die Runway rechnet mit echten Kosten.
      { id: 'bs-demo-4', art: 'umsatz', einheit: 'ug', name: 'Klarheits-Diagnosen (Projektgeschäft)', preis: 4800, menge: 2, rhythmus: 'monatlich', start: 1, an: true, produktId: 'l-demo-diagnose' },
      { id: 'bs-demo-5', art: 'kosten', einheit: 'ug', name: 'Freie Mitarbeit Design', kostenArt: 'sonstiges', preis: 1400, menge: 1, rhythmus: 'monatlich', start: 1, an: true },
      { id: 'bs-demo-6', art: 'kosten', einheit: 'ug', name: 'Recruiting & Messeauftritt', kostenArt: 'sonstiges', preis: 9000, menge: 1, rhythmus: 'einmalig', start: 2, an: true },
    ] }] },
    { pfad: '/arbeitsplan', neu: 'ps-demo-wachstum' },
  ] });
  schritt('Finanzplanung', 1);
  // 0-Punkt (05.10.): Beispiel-Eröffnung der operativen Gesellschaft. Seit 15.10. (B10) zum JAHRESBEGINN — sonst wären die Monatsabschlüsse des Jahres
  // „vor dem 0-Punkt“ archiviert und weder Business-Index noch Steuern hätten Ist-Zahlen. Die offene Rechnung steht als echte Rechnung im Bestand.
  const jahrStart = `${heute.slice(0, 4)}-01-01`;
  await rufe(R.eroeffnung(), 'POST', '/api/business/eroeffnung', LENA, { aktion: 'setzen', firma: 'ug', stichtag: jahrStart, kontostand: 36500, notiz: 'Beispiel-Eröffnung zum Jahresbeginn (Demo)' });
  schritt('0-Punkt (Eröffnung)', 1);
  // Konten-Register (08.10.): die bisherigen Stände einmal übernehmen (wie der Knopf „Übernahme ansehen“ → „Übernehmen“) und ein Tagesgeld des
  // Haushalts dazu (die Rücklage im Privat-Index) — erfundene Beträge, über die Route wie in der Oberfläche.
  const kontenVorschau = await rufe(R.konten(), 'GET', '/api/finanzen/konten?uebernahme=1', LENA);
  await rufe(R.konten(), 'POST', '/api/finanzen/konten', LENA, { aktion: 'uebernahme', basis: kontenVorschau.basis });
  await rufe(R.konten(), 'POST', '/api/finanzen/konten', LENA, { ops: [{ op: 'konto-neu', konto: { name: 'Tagesgeld (Beispiel)', art: 'tagesgeld', ort: 'gemeinsam', bank: 'Beispielbank' }, stand0: { betrag: 15000, datum: heute } }] });
  // Der aktuelle Stand des Geschäftskontos (gestern) — wie „Stand eintragen“ am Konto.
  const kontenBiz = (await rufe(R.konten(), 'GET', '/api/finanzen/konten?sicht=business', LENA)).konten as { id: string; ort: string }[];
  const geschaeftskonto = kontenBiz.find(x => x.ort === 'ug');
  if (geschaeftskonto) await rufe(R.konten(), 'POST', '/api/finanzen/konten?sicht=business', LENA, { ops: [{ op: 'stand-neu', id: geschaeftskonto.id, betrag: 48000, datum: tagPlus(heute, -1) }] });
  schritt('Konten-Register', 2);

  // 13b) B10 (Abnahme 2, 15.10.): Finanzen, die sich nicht widersprechen — alles über die Routen wie in der Oberfläche, erfundene Zahlen.
  const monatVon = (m: number) => `${heute.slice(0, 4)}-${String(m).padStart(2, '0')}`;
  const naechsterTag = (tag: number) => { const t = `${heute.slice(0, 7)}-${String(tag).padStart(2, '0')}`; return t >= heute ? t : `${tagPlus(`${heute.slice(0, 7)}-01`, 32).slice(0, 7)}-${String(tag).padStart(2, '0')}`; };
  // Die offene Rechnung des Vormonats (Vertriebsaufbau Nordwerk) — Rechnungen & Zahlungen, Liquidität und Umsatzsteuer lesen sie.
  const vormonat = tagPlus(`${heute.slice(0, 7)}-01`, -1);
  await rufe(R.finanzplanBestand(), 'PATCH', '/api/state/finanzplan', LENA, { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: {
    id: 're-demo-nordwerk-vormonat', kunde: 'Nordwerk Maschinenbau GmbH', titel: 'Vertriebsaufbau (Beispiel)', betrag: 4165, netto: 3500, ustSatz: 19, status: 'gestellt',
    nummer: `NL-${heute.slice(0, 4)}-${heute.slice(5, 7)}-01`, datum: tagPlus(heute, -4), faellig: tagPlus(heute, 10), leistungVon: `${vormonat.slice(0, 7)}-01`, leistungBis: vormonat,
    mandatId: 'm-demo-nordwerk', firmaId: 'ug',
  } }] });
  // Was regelmäßig rausgeht (und das erwartete Projektgeschäft, unsicher) — neben den zwei Retainern aus „Mandat → Liquiplan“.
  await rufe(R.liquiplan(), 'PATCH', '/api/state/liquiplan', LENA, { ops: [
    { titel: 'Gehälter mit Sozialabgaben (Beispiel)', betrag: -11500, tag: 28, kategorie: 'personal' },
    { titel: 'Büromiete (Beispiel)', betrag: -1428, tag: 3, kategorie: 'raum' },
    { titel: 'Software & Werkzeuge (Beispiel)', betrag: -452, tag: 5, kategorie: 'betrieb' },
    { titel: 'Steuerberatung (Beispiel)', betrag: -536, tag: 20, kategorie: 'betrieb' },
    { titel: 'Klarheits-Diagnosen, erwartet (Beispiel)', betrag: 11424, tag: 15, kategorie: 'produkt', wahrscheinlich: 70 },
  ].map((x, i) => ({ liste: 'posten', op: 'upsert', eintrag: { id: `lp-demo-${i + 1}`, titel: x.titel, betrag: x.betrag, rhythmus: 'monatlich', ab: naechsterTag(x.tag), sicher: x.wahrscheinlich === undefined, ...(x.wahrscheinlich !== undefined ? { wahrscheinlich: x.wahrscheinlich } : {}), firmaId: 'ug', kategorie: x.kategorie } })) });
  // Monatsabschlüsse des laufenden Jahres (bis zum Vormonat) — die operative Gesellschaft mit Projekt- und Retainer-Umsatz, die Holding nur mit Kosten.
  const IST = [[15100, 14200], [15800, 14400], [17200, 14900], [16400, 14700], [17900, 15100], [16800, 15000], [18400, 15300], [17100, 15200], [19600, 15600], [18800, 15500], [19200, 15700]] as const;
  let abschluesse = 0;
  for (let m = 1; m < Number(heute.slice(5, 7)); m++) {
    const [umsatz, kosten] = IST[(m - 1) % IST.length];
    await rufe(R.business(), 'POST', '/api/business', JONAS, { aktion: 'abschluss', firma: 'ug', monat: monatVon(m), umsatz, kosten, personal: 11400, marketingVertrieb: 450, notiz: 'Beispiel-Abschluss (Demo)' });
    await rufe(R.business(), 'POST', '/api/business', JONAS, { aktion: 'abschluss', firma: 'kdv', monat: monatVon(m), umsatz: 0, kosten: 140, notiz: 'Beispiel-Abschluss (Demo)' });
    abschluesse += 2;
  }
  schritt('Monatsabschlüsse', abschluesse);
  // Jahresziel: Business-Index (je Gesellschaft) und Controlling (Umsatz, Gewinn) — dieselbe Zahl, nicht „0 €“.
  await rufe(R.business(), 'POST', '/api/business', LENA, { aktion: 'einstellungen', ziele: { ug: 205000 } });
  await rufe(R.controlling(), 'PATCH', '/api/state/finance', LENA, { felder: { jahr: Number(heute.slice(0, 4)), zielUmsatz: 205000, zielGewinn: 26000 } });
  // Steuern (Kevin 15.10.: die Hauptgesellschaft „wie bei KD Ventures“): vergangene Fristen sind erledigt (abgehakt wie in der Oberfläche) — sonst
  // stünden sie als überfällig in Heute —, und die Rücklage der operativen Gesellschaft deckt ihre Schätzung (Hinweis, keine Steuerberatung).
  const [{ ladeSteuerEinstellungenMitPlan, steuernStand }, { fristen: steuerFristen }] = await Promise.all([import('@/lib/steuern/speicher'), import('@/lib/steuern/rechnen')]);
  const vorbei = steuerFristen(await ladeSteuerEinstellungenMitPlan(heute), heute).filter(f => !f.erledigt && f.datum < heute);
  for (const f of vorbei) await rufe(R.steuern(), 'POST', '/api/steuern', LENA, { abhaken: { key: `f:${f.id}`, an: true } });
  const sollUg = (await steuernStand(heute, 'business')).prognose.je.ug?.soll ?? 0;
  if (sollUg > 0) await rufe(R.steuern(), 'POST', '/api/steuern?space=business', LENA, { einstellungen: { ruecklageIst: { ug: Math.ceil(sollUg / 500) * 500 } } });
  schritt('Steuern (Fristen abgehakt)', vorbei.length);

  // 14) Familie & Gesundheit — harmlos und minimal.
  await rufe(R.familie(), 'PATCH', '/api/familie', LENA, { ops: [
    { liste: 'menschen', ...upsert({ id: 'fm-demo-1', von: LENA, am: jetzt.toISOString(), name: 'Oma Ilse (Beispiel)', rolle: 'eltern', geburtstag: '12.11.', kontaktAlleTage: 14, letzterKontakt: tagPlus(heute, -9), notiz: '' }) },
    { liste: 'tage', ...upsert({ id: 'ft-demo-1', von: LENA, am: jetzt.toISOString(), titel: 'Hochzeitstag', art: 'jahrestag', datum: '06-21', vorlaufTage: 7, wer: 'beide', aktion: 'feier', erledigt: [] }) },
  ] });
  // Art. 9 (05.10.): Gesundheitsdaten nur mit Einwilligung (a) — die Demo-Person erklärt sie über denselben Weg wie die
  // Oberfläche (System › Datenschutz). (b) „An die KI“ und (c) „Partner“ bleiben aus (Vorgabe) — vorführbar im Dialog.
  const { GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  await rufe(R.gesundheitEinwilligung(), 'POST', '/api/datenschutz/gesundheit', LENA, { zweck: 'verarbeiten', an: true, fassung: GESUNDHEIT_FASSUNG });
  for (let i = 1; i <= 7; i++) {
    await rufe(R.vitals(), 'PUT', '/api/state/vitals', LENA, { date: tagPlus(heute, -i), vitals: { rec: 55 + ((i * 7) % 25), sleep: 7 + (i % 3) * 0.3, hrv: 48 + (i % 4) * 3, rhr: 56 + (i % 3) } });
  }
  await rufe(R.sport(), 'PUT', '/api/sport', LENA, { ops: [{ op: 'einstieg', fertig: true }, { op: 'woche', tage: { mo: { art: 'lauf', dauerMin: 40 }, di: { art: 'frei' }, mi: { art: 'gym', dauerMin: 60 }, do: { art: 'frei' }, fr: { art: 'lauf', dauerMin: 30 }, sa: { art: 'hyrox', dauerMin: 60 }, so: { art: 'ruhe' } } }] });
  // Training & Wettkampf (09.10., Plan-Baukasten): erfundenes Laufziel mit Referenzzeit (Countdown, Prognose, Taper), ein paar Einheiten von Hand —
  // Training-Reiter, Plan ↔ Ist und „Zuerst“ sind so vorführbar. Alles über die Sport-Route.
  await rufe(R.sport(), 'PUT', '/api/sport', LENA, { ops: [
    { op: 'ziel', eintrag: { id: 'demo-ziel-10k', art: 'lauf', titel: '10 km Stadtlauf (Beispiel)', datum: tagPlus(heute, 12), distanzKm: 10, zielzeitSek: 3300, referenz: { distanzKm: 5, sek: 1620 }, angelegt: jetzt.toISOString() } },
    { op: 'lauf', eintrag: { id: 'demo-lauf-1', datum: tagPlus(heute, -3), distanzKm: 6, dauerSek: 2160, art: 'locker', gefuehl: 4 } },
    { op: 'lauf', eintrag: { id: 'demo-lauf-2', datum: tagPlus(heute, -6), distanzKm: 8, dauerSek: 3000, art: 'longrun' } },
    { op: 'training', eintrag: { id: 'demo-training-1', datum: tagPlus(heute, -2), sport: 'Rad (Beispiel)', art: 'rad', dauerMin: 60, gefuehl: 3 } },
    { op: 'training', eintrag: { id: 'demo-training-2', datum: tagPlus(heute, -5), sport: 'Yoga (Beispiel)', art: 'mobility', dauerMin: 30 } },
  ] });
  schritt('Familie & Gesundheit', 10);
  // Körper-Profil (08.10. abends, Fragebogen Teil 3): erfunden und harmlos — nur die Person selbst sieht es (Körper-Reiter).
  const kp = await rufe(R.koerper(), 'GET', '/api/gesundheit/koerper', LENA);
  await rufe(R.koerper(), 'PATCH', '/api/gesundheit/koerper', LENA, { stand: kp.stand, ops: [
    { op: 'felder', felder: { leitsatz: 'Ausgeruht durch die Woche (Beispiel)', hinweis: 'Beispiel-Profil der Demo — Struktur und Notizen, keine ärztliche Beratung.', symptom: { name: 'Nacken (Beispiel)' }, sauberZaehler: false } },
    // Module (09.10.): das Symptom-Tagebuch ausdrücklich an, der Zähler bleibt aus (über `sauberZaehler: false` oben).
    { op: 'modul', modul: 'haut', an: true },
    { op: 'eintrag', liste: 'beschwerden', eintrag: { name: 'Verspannter Nacken (Beispiel)', status: 'besser', notiz: 'Nach langen Bildschirmtagen.', ton: 'achtung' } },
    { op: 'eintrag', liste: 'hebel', eintrag: { name: 'Schlaf', notiz: 'Vor 23 Uhr ins Bett.', kennzahl: 'schlaf' } },
    { op: 'eintrag', liste: 'hebel', eintrag: { name: 'Bewegung', notiz: 'Täglich 30 Minuten draußen.' } },
    { op: 'eintrag', liste: 'stufen', eintrag: { phase: '1', name: 'Grundlage', beschreibung: 'Drei feste Bewegungstermine je Woche.', zustand: 'jetzt' } },
    { op: 'eintrag', liste: 'stufen', eintrag: { phase: '2', name: 'Aufbau', beschreibung: 'Längere Läufe am Wochenende.', zustand: 'danach' } },
    { op: 'eintrag', liste: 'zusammenhaenge', eintrag: { text: 'Mehr Schlaf → mehr Energie am Nachmittag (Beispiel)' } },
  ] });
  schritt('Körper-Profil', 1);
  // Erholung (10.10.): ein erfundenes Programm, eine Behandlungsserie, ein Erholungs-Ziel und ein paar erledigte Einheiten — über die
  // Erholungs-Route (Einwilligung (a) steht oben). Harmlos und allgemein, nur die Person selbst (und wem sie die Gesundheit zeigt) sieht es.
  const eh = await rufe(R.erholung(), 'GET', '/api/gesundheit/erholung', LENA);
  const e1 = await rufe(R.erholung(), 'PATCH', '/api/gesundheit/erholung', LENA, { stand: eh.stand, ops: [
    { op: 'programm', programm: { name: 'Mobility am Morgen (Beispiel)', ziel: 'Beweglich in den Tag (Beispiel)', art: 'mobility', proWoche: 4, stufe: 'Phase 1', uebungen: [{ name: 'Ruhig durchbewegen', minuten: 8 }, { name: 'Dehnen im Stehen', minuten: 5, wiederholungen: 10 }] } },
    { op: 'behandlung', behandlung: { art: 'Massage (Beispiel)', geplant: 6 } },
    { op: 'ziel', ziel: { titel: '3× Erholung je Woche', zeitraum: 'woche', einheiten: 3 } },
    { op: 'fokus', text: 'Pausen ernst nehmen (Beispiel)' },
  ] });
  const eStand = e1.erholung as { programme: { id: string }[]; behandlungen: { id: string }[] };
  const programmId = eStand.programme[0].id, behandlungId = eStand.behandlungen[0].id;
  await rufe(R.erholung(), 'PATCH', '/api/gesundheit/erholung', LENA, { stand: e1.stand, ops: [
    ...[1, 2, 4].map(n => ({ op: 'einheit', einheit: { tag: tagPlus(heute, -n), programmId } })),
    { op: 'einheit', einheit: { tag: tagPlus(heute, -3), art: 'spaziergang', minuten: 25 } },
    { op: 'behandlung-termin', id: behandlungId, termin: { tag: tagPlus(heute, -14), uhr: '17:00', erledigt: true } },
    { op: 'behandlung-termin', id: behandlungId, termin: { tag: tagPlus(heute, -7), uhr: '17:00', erledigt: true } },
    { op: 'behandlung-termin', id: behandlungId, termin: { tag: tagPlus(heute, 7), uhr: '17:00' } },
  ] });
  schritt('Erholung', 1);

  // 14b) Agenten-Bereich und Fotos & Videos (Paket 4c): Threads mit Berichten je Business-Head, Mitarbeiter-Aufträge, Skills (einer aktiv),
  //      geplante Hintergrundaufgaben, ein Album mit drei erzeugten Farbflächen (eins freigegeben, eins angefragt, eins beim Head of Marketing).
  const { agentenUndMedienSaen } = await import('./saat-agenten');
  for (const s of await agentenUndMedienSaen({ lena: LENA, jonas: JONAS, haushalt: DEMO_HAUSHALT, heute, jetzt })) schritt(s.name, s.anzahl);

  // 14c) Fulfillment (10.10.): Vorlagen, Bausteine, Fälle (C1), Kunden-Link aus + Antworten + Puls (C2), Dossier mit gespeicherten Läufen (C3) —
  //      jedes Paket in seiner Datei (lib/demo/fulfillment-*.ts), über die Routen; der Kontext bringt Personen, Mandate, Produkte und `rufe` mit.
  const { fulfillmentSaeen, FULFILLMENT_ROUTEN } = await import('./saat-fulfillment');
  for (const s of await fulfillmentSaeen({
    inhaber: LENA, mitglied: JONAS, partner: BEN, haushalt: DEMO_HAUSHALT, heute, jetzt, rufe, routen: FULFILLMENT_ROUTEN,
    mandate: [
      { id: 'm-demo-nordwerk', leistungId: 'l-demo-retainer', firmaId: 'f-demo-nordwerk', kontaktIds: [kontaktId('sophie')] },
      { id: 'm-demo-lumen', leistungId: 'l-demo-software', firmaId: 'f-demo-lumen', kontaktIds: [kontaktId('paul')] },
    ],
    leistungen: PRODUKTE.map(p => p.id), kontaktId,
  })) schritt(s.name, s.anzahl);
  // 14c') Produkt-Import ein zweites Mal (19.10., P4) — jetzt mit den Abläufen (die Vorlagen gibt es seit 14c): derselbe Import ist „gleich“, die
  //       Zuordnung Produkt → Ablauf steht schon (14c) und bleibt. Zählt die Produkte, die gleich geblieben sind (Wächter tests/demo.test.ts).
  const zweiter = await rufe(R.produktImport(), 'POST', '/api/crm/produkte/import', LENA, {
    produkte: DEMO_PRODUKT_KARTEN.map(p => (DEMO_PRODUKT_ABLAEUFE[p.name] ? { ...p, ablauf: DEMO_PRODUKT_ABLAEUFE[p.name] } : p)), vorschau: false,
  }) as { gleich?: number };
  schritt('Produkte: zweiter Import gleich', zweiter.gleich ?? 0);
  // 14d) Inbox (10.10.): Demo-Postfach mit erfundener Post, zwei Übergaben an Jonas (eine mit PDF), Aufgaben-Vorschläge für Lena — nur mit
  //      MAKE_OS_DEMO=1 (sonst gibt es den Anbieter „demo“ nicht). lib/demo/saat-inbox.ts.
  const { inboxSaen } = await import('./saat-inbox');
  for (const s of await inboxSaen({ lena: LENA, jonas: JONAS })) schritt(s.name, s.anzahl);
  // 14e) KI-Beispiele (15.10., Abnahme 2 B13): Heads, Head of Finance, ZOE-Stapel und -Gespräch als „Beispiel“ markiert — nur mit MAKE_OS_DEMO=1
  //      und Demo-Marke (Riegel in lib/demo/saat-ki.ts). Die Analyse-Läufe (14c) tragen die Marke schon.
  const { kiBeispieleSaen } = await import('./saat-ki');
  for (const s of await kiBeispieleSaen({ lena: LENA, jonas: JONAS, haushalt: DEMO_HAUSHALT, heute, jetzt, kontaktId })) schritt(s.name, s.anzahl);

  // 14f) Prozesse (22.10., Kundengewinnung): einige der 18 Vorlagen über „Aus Vorlage“ der Werkstatt — veröffentlicht im Probelauf, Eignerin Lena (lib/demo/saat-prozesse.ts).
  const { prozesseAusVorlagenSaen } = await import('./saat-prozesse');
  for (const s of await prozesseAusVorlagenSaen({ lena: LENA, eigner: KONTO_LENA, rufe })) schritt(s.name, s.anzahl);

  // 15) Wissen: Notizen im Vault der Demo (nur, wenn er im Datenordner liegt — Riegel in lib/demo/schutz.ts).
  let notizen = 0;
  if (o.vaultDir) {
    await fs.mkdir(o.vaultDir, { recursive: true });
    for (const n of WISSEN) {
      const kopf = ['---', `title: ${n.titel}`, 'type: notiz', `scope: ${n.scope ?? 'oeffentlich'}`, `owner: ${LENA}`, `stand: ${heute}`, `tags: [${n.tags.join(', ')}]`, '---', ''].join('\n');
      await fs.writeFile(path.join(o.vaultDir, n.datei), `${kopf}# ${n.titel}\n\n${n.text}\n`, 'utf8');
      notizen++;
    }
  }
  schritt('Wissen (Notizen)', notizen);

  // Die Marke trägt am Ende, was gesät wurde (nur Zahlen).
  await updateJson<Record<string, unknown>>(DEMO_MARKE, alt => ({ ...(alt ?? {}), schritte: bericht.schritte }));
  return bericht;
}

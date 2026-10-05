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

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { saveJson, updateJson } from '@/lib/store/local-db';
import { aendereKonten, passwortHashen, type Konto } from '@/lib/zugang/konten';
import { localDay } from '@/lib/zeit';
import { montagVon, tagPlus } from '@/lib/zeit/kalender-kern';
import { einheitAusGesellschaft } from '@/lib/einheiten';
import { bauKennung, BAU_KOPF } from '@/lib/bau/kennung';
import { fahrplanFuer } from '@/lib/gesellschaften/fahrplan';
import { DEMO_MARKE, DEMO_SAAT_VERSION, DEMO_DOMAIN, demoUuid } from './schutz';

export class DemoFehler extends Error {}

/** Der Haushalt der Demo (gültig nach HAUSHALT_OK, kein Test-/Probe-Haushalt). */
export const DEMO_HAUSHALT = 'demo';
/** Die zwei erfundenen Personen — Speichernamen bewusst nicht `kevin`/`malin` (die tragen in Altstellen Sonderfälle). */
export const DEMO_PERSONEN = [
  { speicher: 'lena', name: 'Lena Hartmann', email: `lena@${DEMO_DOMAIN}`, rolle: 'inhaber' as const, kurz: 'Lena', aufgabe: 'Geschäftsführung' },
  { speicher: 'jonas', name: 'Jonas Hartmann', email: `jonas@${DEMO_DOMAIN}`, rolle: 'mitglied' as const, kurz: 'Jonas', aufgabe: 'Produkt & Finanzen' },
] as const;
/** Eine Team-Person ohne Konto (freie Mitarbeit) — zeigt Kapazität, Zuweisungen und die Team-Löschfrist. */
const MIRA = { id: 't-demo-mira', name: 'Mira Sommer', kurz: 'Mira', rolle: 'Design (frei)', email: `mira@${DEMO_DOMAIN}`, aktiv: true, kreis: 'partner' as const };

const LENA = DEMO_PERSONEN[0].speicher, JONAS = DEMO_PERSONEN[1].speicher;
const KONTO_LENA = `konto-${LENA}`, KONTO_JONAS = `konto-${JONAS}`;

export interface SaatBericht { schritte: { name: string; anzahl: number }[]; heute: string; personen: { name: string; email: string }[] }
/** Zugangsdaten, die beim Zurücksetzen bleiben (die Sitzung des Vorführenden bleibt gültig). */
export type Zugang = Pick<Konto, 'hash' | 'salz'> & Partial<Pick<Konto, 'zweiterFaktor' | 'sitzungenAb' | 'widerrufen'>>;

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
  kontakte: () => import('@/app/api/state/kontakte/route') as Promise<Modul>,
  crm: () => import('@/app/api/crm/bestand/route') as Promise<Modul>,
  deal: () => import('@/app/api/crm/deal/route') as Promise<Modul>,
  gesellschaften: () => import('@/app/api/gesellschaften/route') as Promise<Modul>,
  ziele: () => import('@/app/api/state/ziele/route') as Promise<Modul>,
  meilensteine: () => import('@/app/api/state/meilensteine/route') as Promise<Modul>,
  aufgabe: () => import('@/app/api/tasks/create/route') as Promise<Modul>,
  routinen: () => import('@/app/api/state/routinen/route') as Promise<Modul>,
  kapazitaet: () => import('@/app/api/kapazitaet/route') as Promise<Modul>,
  zeit: () => import('@/app/api/state/zeit/route') as Promise<Modul>,
  finanzImport: () => import('@/app/api/finanzplan/import/route') as Promise<Modul>,
  finanzplan: () => import('@/app/api/finanzplan/route') as Promise<Modul>,
  familie: () => import('@/app/api/familie/route') as Promise<Modul>,
  vitals: () => import('@/app/api/state/vitals/route') as Promise<Modul>,
  sport: () => import('@/app/api/sport/route') as Promise<Modul>,
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** Kontakt-Kennung `c-<uuid>` — deterministisch, damit Links nach dem Zurücksetzen gleich bleiben. */
const kontaktId = (schluessel: string) => `c-${demoUuid(`kontakt:${schluessel}`, sha)}`;
const upsert = (eintrag: unknown) => ({ op: 'upsert', eintrag });

// ── Die erfundenen Daten ──────────────────────────────────────────────────────────────────────────────────────────────

const FIRMEN = [
  { id: 'f-demo-nordwerk', name: 'Nordwerk Maschinenbau GmbH', rolle: 'kunde', branche: 'Maschinenbau', stadt: 'Bielefeld', mitarbeiter: '180' },
  { id: 'f-demo-lumen', name: 'Lumen Logistik AG', rolle: 'kunde', branche: 'Logistik', stadt: 'Hamburg', mitarbeiter: '420' },
  { id: 'f-demo-gruenfeld', name: 'Grünfeld Bau GmbH', rolle: 'zielkunde', branche: 'Bau', stadt: 'Münster', mitarbeiter: '95' },
  { id: 'f-demo-atlas', name: 'Atlas Software GmbH', rolle: 'zielkunde', branche: 'Software', stadt: 'Köln', mitarbeiter: '60' },
  { id: 'f-demo-seeblick', name: 'Seeblick Hotels KG', rolle: 'zielkunde', branche: 'Hotellerie', stadt: 'Konstanz', mitarbeiter: '240' },
  { id: 'f-demo-kanzlei', name: 'Beispiel Steuerberatung PartG', rolle: 'partner', branche: 'Steuerberatung', stadt: 'Bielefeld', mitarbeiter: '25' },
] as const;

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

const PRODUKTE = [
  { id: 'l-demo-diagnose', name: 'Klarheits-Diagnose', typ: 'diagnose', stufe: 'einstieg', preis: { betrag: 4800, einheit: 'pauschal netto', basis: 'einmalig' }, lieferumfang: ['Zwei Workshops mit der Geschäftsführung', 'Kennzahlen-Bild auf einer Seite', 'Fahrplan für 90 Tage'], text: 'Diagnose von Steuerung, Kennzahlen und Prioritäten in zwei Wochen.' },
  { id: 'l-demo-retainer', name: 'Strategie-Begleitung', typ: 'retainer', stufe: 'kern', preis: { betrag: 3500, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Monatlicher Steuerungstermin', 'Kennzahlen-Review', 'Sparring auf Abruf'], text: 'Laufende Begleitung der Geschäftsführung: Ziele, Kennzahlen, Umsetzung.' },
  { id: 'l-demo-software', name: 'Cockpit-Lizenz', typ: 'software', stufe: 'premium', preis: { betrag: 490, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: ['Zugang für fünf Personen', 'Einrichtung', 'Support'], text: 'Software-Cockpit für Kennzahlen und Planung.' },
] as const;

/** Notizen des Demo-Wissens (Vault der Demo, `scope: oeffentlich` — sichtbar für beide Demo-Personen). */
const WISSEN: { datei: string; titel: string; text: string; tags: string[] }[] = [
  { datei: 'Positionierung.md', titel: 'Positionierung Nordlicht Labs', tags: ['strategie'], text: 'Wir helfen inhabergeführten Mittelständlern, mit klaren Kennzahlen schneller zu entscheiden.\n\n- Zielgruppe: Geschäftsführung, 50–500 Mitarbeitende\n- Einstieg: Klarheits-Diagnose\n- Kern: Strategie-Begleitung + Cockpit-Lizenz' },
  { datei: 'Wochenrhythmus.md', titel: 'Unser Wochenrhythmus', tags: ['arbeitsweise'], text: 'Montag: Planung und Kapazität prüfen.\nDienstag/Donnerstag: Fokus-Blöcke für Kundenarbeit.\nMittwoch: Vertrieb (Power Hour).\nFreitag: Rückblick, Finanzen, Ablage.' },
  { datei: 'Angebots-Leitfaden.md', titel: 'Leitfaden für Angebote', tags: ['vertrieb'], text: 'Jedes Angebot nennt Ergebnis, Umfang, Grenzen und nächsten Schritt.\nPreise immer netto, Zahlungsziel 14 Tage.\nNach 10 Tagen nachfassen.' },
  { datei: 'Gruendung-Nordlicht-Ventures.md', titel: 'Gründung Nordlicht Ventures', tags: ['gesellschaften'], text: 'Neue Beteiligungsgesellschaft für Software-Beteiligungen.\nStammkapital 25.000 € (Beispiel), Gesellschafter: Hartmann Holding und Jonas.\nFahrplan steht unter Unternehmen.' },
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
  const bericht: SaatBericht = { schritte: [], heute, personen: DEMO_PERSONEN.map(p => ({ name: p.name, email: p.email })) };
  const schritt = (name: string, anzahl: number) => { bericht.schritte.push({ name, anzahl }); };

  // 1) Konten + Haushalt (direkt — die Einrichtung im Browser bräuchte den Instanz-Schlüssel).
  if (!o.zugang && !o.passwort) throw new DemoFehler('Ohne Passwort keine Demo-Konten.');
  const hashes: Record<string, Zugang> = {};
  for (const p of DEMO_PERSONEN) hashes[p.speicher] = o.zugang?.[p.speicher] ?? await passwortHashen(o.passwort as string);
  await aendereKonten(() => ({
    konten: DEMO_PERSONEN.map((p, i) => ({
      id: `k-demo-${p.speicher}`, speicher: p.speicher, email: p.email, name: p.name, rolle: p.rolle, angelegt: jetzt.toISOString(),
      haushalt: DEMO_HAUSHALT, teilt: { gesundheit: DEMO_PERSONEN.filter((_, j) => j !== i).map(x => x.speicher) },
      ...hashes[p.speicher],
    })),
    einladungen: [],
  }));
  await saveJson(DEMO_MARKE, { saat: DEMO_SAAT_VERSION, angelegt: jetzt.toISOString(), haushalt: DEMO_HAUSHALT });
  schritt('Konten', DEMO_PERSONEN.length);

  // 2) Team: Kurzwort/Rolle der Konten + eine freie Mitarbeiterin ohne Konto.
  await rufe(R.team(), 'PATCH', '/api/team', LENA, { ops: [
    upsert({ id: KONTO_LENA, name: DEMO_PERSONEN[0].name, kurz: DEMO_PERSONEN[0].kurz, rolle: DEMO_PERSONEN[0].aufgabe, aktiv: true, kreis: 'kern' }),
    upsert({ id: KONTO_JONAS, name: DEMO_PERSONEN[1].name, kurz: DEMO_PERSONEN[1].kurz, rolle: DEMO_PERSONEN[1].aufgabe, aktiv: true, kreis: 'kern' }),
    upsert(MIRA),
  ] });
  schritt('Team', 3);

  // 3) CRM: Firmen + Produkte (Bestand), Kontakte (Kartei), Mandate, Deals (Anlage-Weg).
  const firmenName = (id?: string) => FIRMEN.find(f => f.id === id)?.name;
  await rufe(R.crm(), 'PATCH', '/api/crm/bestand', LENA, { ops: [
    ...FIRMEN.map(f => ({ liste: 'firmen', ...upsert({ ...f, webseite: `https://${f.id.slice(7)}.example`, notiz: 'Erfundene Beispiel-Firma (Demo).' }) })),
    ...PRODUKTE.map(l => ({ liste: 'leistungen', ...upsert({ id: l.id, name: l.name, typ: l.typ, stufe: l.stufe, preis: l.preis, lieferumfang: l.lieferumfang, beschreibung: l.text, gesellschaft: 'ug', status: 'aktiv', angebot: { titel: l.name, leistungstext: l.text } }) })),
  ] });
  await rufe(R.kontakte(), 'PATCH', '/api/state/kontakte', LENA, { ops: KONTAKTE.map((k, i) => upsert({
    id: kontaktId(k.k), vorname: k.vorname, nachname: k.nachname, email: `${k.k}@${DEMO_DOMAIN}`, position: k.position,
    ...(k.firma ? { firma: firmenName(k.firma), firmaId: k.firma } : {}), stufe: k.stufe, prio: k.prio, eignung: 'ja', herkunft: 'Demo (erfunden)',
    besitzer: i % 3 === 2 ? JONAS : LENA, importiertAm: tagPlus(heute, -60 + i * 3), geaendertAm: tagPlus(heute, -i),
    aktivitaeten: [{ am: `${tagPlus(heute, -10 - i)}T10:00:00.000Z`, art: 'notiz', text: 'Erstgespräch (erfunden) — Interesse an Kennzahlen und Planung.', von: LENA }],
  })) });
  await rufe(R.crm(), 'PATCH', '/api/crm/bestand', LENA, { ops: [
    { liste: 'mandate', ...upsert({ id: 'm-demo-nordwerk', kunde: 'Nordwerk Maschinenbau GmbH', firmaId: 'f-demo-nordwerk', kontaktIds: [kontaktId('sophie')], titel: 'Strategie-Begleitung Nordwerk', art: 'retainer', leistungId: 'l-demo-retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: tagPlus(heute, -120), verlaengerung: 'auto', honorar: { betrag: 3500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: ['Monatliches Kennzahlen-Review etabliert', 'Liquiditätsplanung 12 Monate'], health: { beteiligung: 4, umsetzung: 4, wirkung: 3, zahlung: 5, stimmung: 4 }, leistungen: ['Steuerungstermin', 'Review'], offen: [], zustaendig: LENA }) },
    { liste: 'mandate', ...upsert({ id: 'm-demo-lumen', kunde: 'Lumen Logistik AG', firmaId: 'f-demo-lumen', kontaktIds: [kontaktId('paul')], titel: 'Cockpit-Einführung Lumen', art: 'software', leistungId: 'l-demo-software', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: tagPlus(heute, -45), verlaengerung: 'manuell', honorar: { betrag: 2450, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 30, ziele: ['Fünf Standorte im Cockpit'], health: { beteiligung: 3, umsetzung: 3, wirkung: 3, zahlung: 4, stimmung: 3 }, leistungen: ['Einrichtung', 'Schulung'], offen: ['Datenanbindung Lager'], zustaendig: JONAS }) },
  ] });
  const deals = [
    { titel: 'Diagnose Grünfeld Bau', firmaId: 'f-demo-gruenfeld', kontaktIds: [kontaktId('elif')], art: 'workshop', wert: { betrag: 4800, basis: 'einmalig' }, leistungId: 'l-demo-diagnose', stufe: 'angebot', schritt: { text: 'Angebot nachfassen (Telefon)', datum: tagPlus(heute, 2) }, erwartetAm: tagPlus(heute, 14) },
    { titel: 'Begleitung Atlas Software', firmaId: 'f-demo-atlas', kontaktIds: [kontaktId('tobias'), kontaktId('nina')], art: 'retainer', wert: { betrag: 3500, basis: 'monat', laufzeitMonate: 12 }, leistungId: 'l-demo-retainer', stufe: 'diagnose', schritt: { text: 'Workshop zur Ausgangslage', datum: tagPlus(heute, 5) }, erwartetAm: tagPlus(heute, 40) },
    { titel: 'Cockpit für Seeblick Hotels', firmaId: 'f-demo-seeblick', kontaktIds: [kontaktId('marie')], art: 'software', wert: { betrag: 490, basis: 'monat', laufzeitMonate: 24 }, leistungId: 'l-demo-software', stufe: 'bedarf', schritt: { text: 'Demo-Termin vor Ort', datum: tagPlus(heute, 8) }, erwartetAm: tagPlus(heute, 60) },
    { titel: 'Partnerschaft Beispiel Steuerberatung', firmaId: 'f-demo-kanzlei', kontaktIds: [kontaktId('david')], art: 'vermittlung', wert: { betrag: 6000, basis: 'jahr' }, stufe: 'qualifiziert', schritt: { text: 'Kooperationsmodell skizzieren', datum: tagPlus(heute, 10) }, erwartetAm: tagPlus(heute, 75) },
  ];
  for (const d of deals) await rufe(R.deal(), 'POST', '/api/crm/deal', d.kontaktIds.length > 1 ? JONAS : LENA, { aktion: 'anlegen', ...d, gesellschaft: 'ug', quelle: 'netzwerk', besitzer: LENA });
  schritt('CRM: Firmen', FIRMEN.length); schritt('CRM: Kontakte', KONTAKTE.length); schritt('CRM: Produkte', PRODUKTE.length); schritt('CRM: Mandate', 2); schritt('CRM: Deals', deals.length);

  // 4) Gesellschaften: Holding (kdv) hält die operative (ug); die Beratung (kdc) als Einzelunternehmen; eine neue in Gründung.
  const reg = await rufe(R.gesellschaften(), 'GET', '/api/gesellschaften', LENA);
  const stand = (id: string) => ((reg.gesellschaften as { id: string; stand: string }[]) ?? []).find(g => g.id === id)?.stand;
  const steck = async (id: string, felder: Record<string, unknown>) => (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id, stand: stand(id), felder })).gesellschaft as { stand: string };
  await steck('kdc', { rechtsform: 'einzel', status: 'eingetragen', sitz: 'Bielefeld', gegruendetAm: '2019-03-01' });
  let kdv = await steck('kdv', { rechtsform: 'ug', status: 'eingetragen', rolle: 'holding', sitz: 'Bielefeld', gegruendetAm: '2021-06-15', stammkapitalCent: '5.000', eingezahltCent: '5.000' });
  let ug = await steck('ug', { rechtsform: 'gmbh', status: 'eingetragen', sitz: 'Bielefeld', gegruendetAm: '2023-01-10', stammkapitalCent: '25.000', eingezahltCent: '25.000' });
  kdv = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'kdv', stand: kdv.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'person', id: LENA }, nennbetragCent: '5.000', einlage: 'ja' } })).gesellschaft as { stand: string };
  ug = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: ug.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '25.000', einlage: 'ja' } })).gesellschaft as { stand: string };
  ug = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: 'ug', stand: ug.stand, liste: 'vertraege', eintrag: { art: 'kooperation', titel: 'Büro-Mietvertrag (Beispiel)', parteien: [{ art: 'gesellschaft', id: 'ug' }], status: 'unterschrieben', beginn: tagPlus(heute, -400), kuendigungsfrist: '3 Monate zum Quartalsende', kuendigenBis: tagPlus(heute, 45), erinnerungTage: 30 } })).gesellschaft as { stand: string };
  const neu = (await rufe(R.gesellschaften(), 'POST', '/api/gesellschaften', LENA, { felder: { name: 'Nordlicht Ventures GmbH', rechtsform: 'gmbh', status: 'gruendung', rolle: 'holding', sitz: 'Bielefeld', stammkapitalCent: '25.000' } })).gesellschaft as { id: string; stand: string };
  let ng = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: neu.id, stand: neu.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '15.000', einlage: 'nein' } })).gesellschaft as { stand: string };
  ng = (await rufe(R.gesellschaften(), 'PATCH', '/api/gesellschaften', LENA, { id: neu.id, stand: ng.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'person', id: JONAS }, nennbetragCent: '10.000', einlage: 'nein' } })).gesellschaft as { stand: string };
  void ng;
  schritt('Gesellschaften', 4);

  // 5) Ziele (Jahr, Business + Privat) und Meilensteine mit Aufwand, Personen, Kette.
  const jahr = heute.slice(0, 4);
  const opsLabel = einheitAusGesellschaft('ug') ?? 'Operativ';
  const ziele = [
    { id: 'z-demo-umsatz', titel: 'Wiederkehrender Umsatz 25.000 € je Monat', fortschritt: 40, space: 'business', einheit: opsLabel, zielwert: 25000, rang: 1, aufwand: 60, personen: [KONTO_LENA] },
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
  ];
  for (const a of aufgaben) {
    const { person, ...rest } = a;
    await rufe(R.aufgabe(), 'POST', '/api/tasks/create', person, { ...rest, description: 'Beispiel-Aufgabe (Demo).' });
  }
  schritt('Aufgaben', aufgaben.length);

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
    events.push(termin(tagPlus(mo, 1), '10:00', '11:30', 'Steuerungstermin Nordwerk', 'Arbeit', 'Bielefeld'));
    events.push(termin(tagPlus(mo, 2), '14:00', '15:00', 'Power Hour Vertrieb', 'Arbeit'));
    events.push(termin(tagPlus(mo, 3), '11:00', '12:00', 'Cockpit-Abstimmung Lumen', 'Arbeit', 'Video'));
    events.push(termin(tagPlus(mo, 4), '16:00', '17:00', 'Wochenrückblick', 'Arbeit'));
  }
  events.push(termin(tagPlus(heute, 5), '10:00', '12:00', 'Workshop Atlas Software (Ausgangslage)', 'Arbeit', 'Köln'));
  events.push(termin(tagPlus(heute, 8), '13:00', '14:30', 'Demo-Termin Seeblick Hotels', 'Arbeit', 'Konstanz'));
  events.push(termin(tagPlus(heute, 3), '19:00', '21:00', 'Abendessen mit Freunden', 'Privat'));
  await saveJson('calendar-cache', { events, at: jetzt.toISOString() });
  schritt('Termine', events.length);

  // 10) Kapazität: Grundwerte, Urlaub, Zuweisungen (Mandate).
  await rufe(R.kapazitaet(), 'PATCH', '/api/kapazitaet', LENA, { ops: [
    { op: 'grundwert', person: KONTO_LENA, stundenWoche: 40 },
    { op: 'grundwert', person: MIRA.id, stundenWoche: 16 },
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
    { pfad: '/privatEinnahmen', neu: [zeile('pe-demo-gehalt', 'Geschäftsführer-Gehalt (netto)', 'privat', 'Einnahmen', 4200, 'fix')] },
    { pfad: '/szenarien/0/retainer', neu: [{ name: 'Nordwerk', betrag: 3500, start: 1, laufzeit: 12 }, { name: 'Lumen', betrag: 2450, start: 1, laufzeit: 24 }] },
    { pfad: '/posten', neu: [{ id: 'po-demo-konto', art: 'konto', einheit: 'ug', name: 'Geschäftskonto (Beispiel)', betrag: 48000, status: 'ok' }, { id: 'po-demo-privat', art: 'konto', einheit: 'privat', name: 'Girokonto (Beispiel)', betrag: 9500, status: 'ok' }] },
    { pfad: '/planszenarien', neu: [{ id: 'ps-demo-wachstum', name: 'Wachstum mit Cockpit', basis: 'basis', angelegt: jetzt.toISOString(), annahmen: {}, bausteine: [
      { id: 'bs-demo-1', art: 'umsatz', einheit: 'ug', name: 'Strategie-Begleitung (neu)', preis: 3500, menge: 2, rhythmus: 'monatlich', start: 3, an: true, produktId: 'l-demo-retainer' },
      { id: 'bs-demo-2', art: 'umsatz', einheit: 'ug', name: 'Cockpit-Lizenzen', preis: 490, menge: 8, rhythmus: 'monatlich', start: 4, an: true, produktId: 'l-demo-software' },
      { id: 'bs-demo-3', art: 'kosten', einheit: 'ug', name: 'Beraterin (Teilzeit)', preis: 3200, menge: 1, rhythmus: 'monatlich', start: 5, an: true },
    ] }] },
    { pfad: '/arbeitsplan', neu: 'ps-demo-wachstum' },
  ] });
  schritt('Finanzplanung', 1);

  // 14) Familie & Gesundheit — harmlos und minimal.
  await rufe(R.familie(), 'PATCH', '/api/familie', LENA, { ops: [
    { liste: 'menschen', ...upsert({ id: 'fm-demo-1', von: LENA, am: jetzt.toISOString(), name: 'Oma Ilse (Beispiel)', rolle: 'eltern', geburtstag: '12.11.', kontaktAlleTage: 14, letzterKontakt: tagPlus(heute, -9), notiz: '' }) },
    { liste: 'tage', ...upsert({ id: 'ft-demo-1', von: LENA, am: jetzt.toISOString(), titel: 'Hochzeitstag', art: 'jahrestag', datum: '06-21', vorlaufTage: 7, wer: 'beide', aktion: 'feier', erledigt: [] }) },
  ] });
  for (let i = 1; i <= 7; i++) {
    await rufe(R.vitals(), 'PUT', '/api/state/vitals', LENA, { date: tagPlus(heute, -i), vitals: { rec: 55 + ((i * 7) % 25), sleep: 7 + (i % 3) * 0.3, hrv: 48 + (i % 4) * 3, rhr: 56 + (i % 3) } });
  }
  await rufe(R.sport(), 'PUT', '/api/sport', LENA, { ops: [{ op: 'einstieg', fertig: true }, { op: 'woche', tage: { mo: { art: 'lauf', dauerMin: 40 }, di: { art: 'frei' }, mi: { art: 'gym', dauerMin: 60 }, do: { art: 'frei' }, fr: { art: 'lauf', dauerMin: 30 }, sa: { art: 'hyrox', dauerMin: 60 }, so: { art: 'ruhe' } } }] });
  schritt('Familie & Gesundheit', 10);

  // 15) Wissen: Notizen im Vault der Demo (nur, wenn er im Datenordner liegt — Riegel in lib/demo/schutz.ts).
  let notizen = 0;
  if (o.vaultDir) {
    await fs.mkdir(o.vaultDir, { recursive: true });
    for (const n of WISSEN) {
      const kopf = ['---', `title: ${n.titel}`, 'type: notiz', 'scope: oeffentlich', `owner: ${LENA}`, `stand: ${heute}`, `tags: [${n.tags.join(', ')}]`, '---', ''].join('\n');
      await fs.writeFile(path.join(o.vaultDir, n.datei), `${kopf}# ${n.titel}\n\n${n.text}\n`, 'utf8');
      notizen++;
    }
  }
  schritt('Wissen (Notizen)', notizen);

  // Die Marke trägt am Ende, was gesät wurde (nur Zahlen).
  await updateJson<Record<string, unknown>>(DEMO_MARKE, alt => ({ ...(alt ?? {}), schritte: bericht.schritte }));
  return bericht;
}

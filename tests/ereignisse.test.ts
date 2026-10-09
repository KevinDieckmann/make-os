// ─── E1 „Ereignisstelle“ (09.10.): Agenten reagieren auf Mail, Zahlung, Deal, Anfrage, Absage, „An ZOE geben“ ─────────────────────
// Eigener Datenordner, erfundene Konten (`@example.invalid`), keine echten Daten, kein Modellaufruf (es wird nur eingereiht), kein Netz
// außer den nachgebauten Diensten (Gmail-Fake, signierter WhatsApp-Webhook). Geprüft: je Quelle ein Ereignis (nur Kennungen), Dedup,
// Sperren wie bei Zeitplänen, Entprellen, Sichtregel (Mail der anderen Person löst nichts für mich aus), ein Skill läuft genau einmal,
// „An ZOE geben“ läuft sofort, Leser (Power Hour, Heads), Recht (Register, Frist, Art. 17, Konto löschen), Head of IT.
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ereignisse-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ereignisse', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

import type { Ereignis, EreignisBestand, Konsument, AuswertungsLage } from '@/lib/ereignisse/typen';
import type { Skill, WerkstattBestand } from '@/lib/agenten/typen';
import { GmailFake } from './fixtures/gmail-fake';
import { umgebung } from './fixtures/gmail-setup';

const HAUS = 'haus-a';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const BESTAND = `ereignisse--${HAUS}`;
/** 10:00 Berliner Zeit an einem Werktag — Takt-Fenster offen. */
const TAG = new Date('2026-10-09T08:00:00.000Z');
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

let db: typeof import('@/lib/store/local-db');
let S: typeof import('@/lib/ereignisse/server');
let T: typeof import('@/lib/ereignisse/typen');
let Q: typeof import('@/lib/ereignisse/quellen');
let TK: typeof import('@/lib/ereignisse/takt');
let A: typeof import('@/lib/zoe/auftraege');

const KARTEI = [
  { id: 'c-anna', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@firma.example.invalid', telefon: '+49 151 1234567', firmaId: 'f-firma', stufe: 'warm', aktivitaeten: [] },
  { id: 'c-bert', vorname: 'Bert', nachname: 'Muster', email: 'bert@firma.example.invalid', stufe: 'warm', aktivitaeten: [] },
  { id: 'c-gesperrt', vorname: 'Gesa', nachname: 'Gesperrt', email: 'gesa@firma.example.invalid', telefon: '+49 151 7654321', stufe: 'warm', aktivitaeten: [], eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'person-a' } },
];

function skill(id: string, extra: Partial<Skill> = {}): Skill {
  return {
    id, headId: 'sales', name: 'antwort-vorbereiten', beschreibung: 'Bereitet eine Antwort auf neue Mails vor.', anleitung: 'Lies die Mail und schlage eine Antwort vor.',
    werkzeuge: [], ausloeser: { art: 'ereignis', ereignis: 'neue-mail' }, eingabeFelder: [], freigabePflicht: true, ergebnis: 'stapel', stufe: 'schnell',
    tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-a', geaendertAm: '2026-10-01T00:00:00.000Z', ...extra,
  };
}
async function werkstatt(skills: Skill[]): Promise<void> {
  await db.saveJson<WerkstattBestand>(`agenten-skills--${HAUS}`, { v: 1, skills, mitarbeiter: [], gedaechtnis: {} });
}
const bestand = async () => (await db.loadJson<EreignisBestand>(BESTAND)) ?? { v: 1 as const, nr: 0, eintraege: [], cursor: {} };
const mail = (id: string, person: string, kontaktId?: string) => ({ id: `gmail:${id}`, art: 'neue-mail' as const, quelle: 'gmail' as const, bezug: kontaktId ? { kontaktId } : {}, bereich: 'business' as const, person });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  S = await import('@/lib/ereignisse/server');
  T = await import('@/lib/ereignisse/typen');
  Q = await import('@/lib/ereignisse/quellen');
  TK = await import('@/lib/ereignisse/takt');
  A = await import('@/lib/zoe/auftraege');
});
beforeEach(async () => {
  for (const n of [BESTAND, 'zoe-auftraege', `agenten-skills--${HAUS}`, 'crm', 'tasks', 'finanzplan', 'buchungen', 'kalender-bezug']) await db.bestandEntfernen(n).catch(() => false);
  db.leseCacheLeeren();
  await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber'), konto('k2', 'person-b', 'mitglied'), konto('k3', 'team-c', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: KARTEI });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

// ── Rein ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Regeln (rein): Kennung, nur Kennungen, Sichtregel', () => {
  it('Kennung: kurz bleibt, lang wird ein Fingerabdruck (≤ 80, deterministisch)', () => {
    expect(T.ereignisKennung('gmail', '18c00000001ab')).toBe('gmail:18c00000001ab');
    const lang = T.ereignisKennung('aufgabe', 'x'.repeat(90), 'zoe', '20261009100000');
    expect(lang.length).toBeLessThanOrEqual(80);
    expect(lang).toBe(T.ereignisKennung('aufgabe', 'x'.repeat(90), 'zoe', '20261009100000'));
    expect(lang).not.toBe(T.ereignisKennung('aufgabe', 'x'.repeat(90), 'zoe', '20261009100001'));
  });
  it('nur Kennungen: Text, Betreff, Betrag und fremde Felder fallen weg; unbekannte Art → verworfen', async () => {
    const { istEreignisArt } = await import('@/lib/ereignisse/arten');
    const roh = { id: 'gmail:1', art: 'neue-mail', quelle: 'gmail', bereich: 'business', person: 'person-a', bezug: { kontaktId: 'c-anna', betreff: 'GEHEIM-BETREFF', text: 'mit Leerzeichen' }, betrag: 4711, text: 'GEHEIM' };
    const s = T.eingabeSauber(roh as never, istEreignisArt)!;
    expect(JSON.stringify(s)).not.toMatch(/GEHEIM|4711|Leerzeichen/);
    expect(s.bezug).toEqual({ kontaktId: 'c-anna' });
    expect(T.eingabeSauber({ ...roh, art: 'erfunden' } as never, istEreignisArt)).toBeNull();
  });
  it('Sichtregel: Mail nur für die Person des Postfachs; Privat nur volle Mitglieder; privater Zahlungseingang nur mit privatem Finanzzugang', () => {
    const a = { person: 'person-a', vollesMitglied: true, privatFinanzen: true };
    const b = { person: 'person-b', vollesMitglied: true, privatFinanzen: true };
    const c = { person: 'team-c', vollesMitglied: false, privatFinanzen: false };
    expect(T.ereignisSichtbar({ person: 'person-b', bereich: 'business', art: 'neue-mail' }, a)).toBe(false);
    expect(T.ereignisSichtbar({ person: 'person-b', bereich: 'business', art: 'neue-mail' }, b)).toBe(true);
    expect(T.ereignisSichtbar({ bereich: 'business', art: 'deal-stufe' }, c)).toBe(true);
    expect(T.ereignisSichtbar({ bereich: 'privat', art: 'zahlungseingang' }, c)).toBe(false);
    expect(T.ereignisSichtbar({ bereich: 'privat', art: 'zahlungseingang' }, { ...b, privatFinanzen: false })).toBe(false);
    expect(T.ereignisSichtbar({ personen: ['person-a'], bereich: 'business', art: 'neue-whatsapp' }, b)).toBe(false);
    expect(T.passtZumBereich({ bereich: 'privat' }, 'business')).toBe(false);
  });
});

describe('Auswertung (rein): Sperren, Entprellen, Riegel, Cursor', () => {
  const k: Konsument = { schluessel: 'skill:sk-a', art: 'skill', arten: ['neue-mail'], headId: 'sales', headBereich: 'business', person: 'person-a', betrachter: { person: 'person-a', vollesMitglied: true, privatFinanzen: true }, skillId: 'sk-a', seit: '2026-10-01T00:00:00.000Z' };
  const ev = (nr: number, extra: Partial<Ereignis> = {}): Ereignis => ({ nr, id: `gmail:m${nr}`, art: 'neue-mail', quelle: 'gmail', bezug: { kontaktId: `c-${nr}` }, bereich: 'business', person: 'person-a', am: plus(TAG, -5).toISOString(), ...extra });
  const lage = (extra: Partial<AuswertungsLage> = {}, jetzt = TAG): AuswertungsLage => ({
    jetzt, jetztWand: '2026-10-09T10:00:00', heute: '2026-10-09', auftraege: [], instanz: 'frei', kiPerson: () => true, frei: () => [],
    taktOffen: (w: string, frei: readonly { start: string; ende: string }[]) => { const h = Number(w.slice(11, 13)); return h >= 7 && h < 22 && !frei.some(s => s.start <= w && w < s.ende); },
    hoechstzahl: 12, autoLaeufeHeute: () => 0, zoeAufgabe: () => null, ...extra,
  });
  const B = (eintraege: Ereignis[], cursor = {}) => ({ eintraege, cursor });

  it('fällig → genau ein Lauf; danach (Riegel = Warteschlange) erledigt und der Cursor rückt weiter', () => {
    const r = T.auswerten(B([ev(1)]), [k], lage());
    expect(r.faellig).toHaveLength(1);
    expect(r.cursor['skill:sk-a'].nr).toBe(0);
    const spur = { name: 'faden', zeit: TAG.toISOString(), tag: '2026-10-09', status: 'offen', eingabe: { skillId: 'sk-a', ereignisId: 'gmail:m1', bezugSchluessel: 'kontaktId:c-1' } };
    const r2 = T.auswerten(B([ev(1)]), [k], lage({ auftraege: [spur] }));
    expect(r2.faellig).toHaveLength(0);
    expect(r2.cursor['skill:sk-a'].nr).toBe(1);
  });
  it('Sichtregel: Mail der anderen Person löst für meinen Skill nichts aus (erledigt, nie fällig)', () => {
    const r = T.auswerten(B([ev(1, { person: 'person-b' })]), [k], lage());
    expect(r.faellig).toHaveLength(0);
    expect(r.cursor['skill:sk-a'].nr).toBe(1);
  });
  it('Entprellen: je Bezug nur das jüngste; ein Lauf in der letzten Stunde → wartet (nicht gestaut)', () => {
    const r = T.auswerten(B([ev(1, { bezug: { kontaktId: 'c-x' } }), ev(2, { bezug: { kontaktId: 'c-x' } })]), [k], lage());
    expect(r.faellig.map(f => f.ereignis.nr)).toEqual([2]);
    const spur = { name: 'faden', zeit: plus(TAG, -20).toISOString(), tag: '2026-10-09', status: 'fertig', eingabe: { skillId: 'sk-a', ereignisId: 'gmail:m0', bezugSchluessel: 'kontaktId:c-x' } };
    const r2 = T.auswerten(B([ev(3, { bezug: { kontaktId: 'c-x' }, am: plus(TAG, -90).toISOString() })]), [k], lage({ auftraege: [spur] }));
    expect(r2.faellig).toHaveLength(0);
    expect(r2.wartend).toBe(1);
    expect(r2.gestaut).toBe(0);
    // eine Stunde nach dem letzten Lauf: fällig
    const r3 = T.auswerten(B([ev(3, { bezug: { kontaktId: 'c-x' } })]), [k], lage({ auftraege: [{ ...spur, zeit: plus(TAG, -61).toISOString() }] }));
    expect(r3.faellig).toHaveLength(1);
  });
  it('Nachtruhe und Business-frei → wartet (Cursor bleibt davor); KI der Person aus / Instanz aus / Konsument ruht / zu alt → verfällt', () => {
    const nacht = T.auswerten(B([ev(1)]), [k], lage({ jetztWand: '2026-10-09T23:00:00' }));
    expect(nacht.faellig).toHaveLength(0); expect(nacht.wartend).toBe(1); expect(nacht.cursor['skill:sk-a'].nr).toBe(0);
    const frei = T.auswerten(B([ev(1)]), [k], lage({ frei: () => [{ start: '2026-10-09T09:00:00', ende: '2026-10-09T12:00:00' }] }));
    expect(frei.faellig).toHaveLength(0); expect(frei.wartend).toBe(1); expect(frei.gestaut).toBe(0);
    for (const l of [lage({ kiPerson: () => false }), lage({ instanz: 'aus' })]) { const r = T.auswerten(B([ev(1)]), [k], l); expect(r.faellig).toHaveLength(0); expect(r.cursor['skill:sk-a'].nr).toBe(1); }
    expect(T.auswerten(B([ev(1)]), [{ ...k, ruht: true }], lage()).cursor['skill:sk-a'].nr).toBe(1);
    expect(T.auswerten(B([ev(1, { am: plus(TAG, -73 * 60).toISOString() })]), [k], lage()).faellig).toHaveLength(0);
    // vor `seit` (Skill neu/geändert) zählt nichts
    expect(T.auswerten(B([ev(1, { am: '2026-09-30T12:00:00.000Z' })]), [k], lage()).faellig).toHaveLength(0);
  });
  it('Sperre nicht lesbar → wartet (fail-closed) und gilt nach 1 h als gestaut; Tageshöchstzahl → wartet', () => {
    const r = T.auswerten(B([ev(1, { am: plus(TAG, -90).toISOString() })]), [k], lage({ instanz: 'unlesbar' }));
    expect(r.faellig).toHaveLength(0); expect(r.gestaut).toBe(1); expect(r.cursor['skill:sk-a'].nr).toBe(0);
    const h = T.auswerten(B([ev(1)]), [k], lage({ autoLaeufeHeute: () => 12 }));
    expect(h.faellig).toHaveLength(0); expect(h.wartend).toBe(1);
  });
  it('ZOE-Aufgaben: nur mit Auftraggeberin und offener Aufgabe; arbeitet ZOE schon für die Person → wartet', () => {
    const z: Konsument = { schluessel: 'zoe-aufgaben', art: 'zoe-aufgaben', arten: ['aufgabe-zoe'], headId: 'zoe', headBereich: null, person: null, betrachter: null };
    const e = ev(1, { id: 'aufgabe:a1:zoe:1', art: 'aufgabe-zoe', quelle: 'aufgaben', bezug: { aufgabeId: 'a1' }, bereich: null, person: 'person-a' });
    expect(T.auswerten(B([e]), [z], lage()).faellig).toHaveLength(0);                                   // nicht (mehr) offen
    expect(T.auswerten(B([e]), [z], lage({ zoeAufgabe: () => ({ business: false }) })).faellig).toHaveLength(1);
    const laeuft = { name: 'zoe-aufgaben', zeit: TAG.toISOString(), tag: '2026-10-09', status: 'laeuft', person: 'person-a', eingabe: {} };
    expect(T.auswerten(B([e]), [z], lage({ zoeAufgabe: () => ({ business: false }), auftraege: [laeuft] })).faellig).toHaveLength(0);
  });
  it('Lauf-Eingaben: nur Kennungen und der Name der Art, höchstens 12', () => {
    const e = ev(1, { bezug: { kontaktId: 'c-1', firmaId: 'f-1', dealId: 'ch-1', gespraech: 'gm~t1' } });
    const ein = TK.laufEingaben({ ereignis: e, konsument: { ...k, filter: 'nur Kunden' } });
    expect(ein).toMatchObject({ ereignis: 'neue Mail', kennung: 'gmail:m1', kontakt: 'c-1', firma: 'f-1', deal: 'ch-1', gespraech: 'gm~t1', bedingung: 'nur Kunden' });
    expect(Object.keys(ein).length).toBeLessThanOrEqual(12);
    expect(Object.keys(ein).every(x => /^[a-z0-9-]{1,40}$/.test(x))).toBe(true);
  });
});

describe('Quellen (rein): CRM-Diff, Kartei, Kontoauszug, Absage', () => {
  it('Deal neu / andere Stufe → deal-stufe; gleiche Stufe → nichts; Firmen-Lead neu auf SQL → lead-sql', () => {
    const ch = (stufe: string) => ({ id: 'ch-1', titel: 'Deal', stufe, kontaktIds: ['c-anna'], firmaId: 'f-firma', gesellschaft: 'ug' });
    const vorher = { chancen: [ch('bedarf')], firmen: [{ id: 'f-firma', lead: { status: 'qualifizierung' } }] } as never;
    expect(Q.crmDiff(vorher, vorher)).toEqual([]);
    const l = Q.crmDiff(vorher, { chancen: [ch('angebot')], firmen: [{ id: 'f-firma', lead: { status: 'sql' } }] } as never);
    expect(l.map(x => [x.art, x.id])).toEqual([['deal-stufe', 'crm:deal:ch-1:angebot'], ['lead-sql', 'crm:lead:f-firma:sql']]);
    expect(l[0]).toMatchObject({ bereich: 'business', stufe: 'angebot', bezug: { dealId: 'ch-1', firmaId: 'f-firma', kontaktId: 'c-anna' } });
  });
  it('Kartei: Personen-Lead neu auf SQL (eingeschränkte nie)', () => {
    const l = Q.karteiDiffSql([{ id: 'c-1', lead: { status: 'qualifizierung' } }] as never, [{ id: 'c-1', lead: { status: 'sql' } }, { id: 'c-2', lead: { status: 'sql' }, eingeschraenkt: {} }] as never);
    expect(l.map(x => x.id)).toEqual(['crm:lead:c-1:sql']);
  });
  it('Kontoauszug: nur neu angelegte Eingänge (> 0) der letzten 14 Tage', () => {
    const z = [{ id: 'b1', datum: '2026-10-08', betrag: 120 }, { id: 'b2', datum: '2026-10-08', betrag: -50 }, { id: 'b3', datum: '2026-09-01', betrag: 80 }, { id: 'b4', datum: '2026-10-07', betrag: 10 }];
    expect(Q.auszugEingaenge(z, new Set(['b1', 'b2', 'b3']), '2026-10-09')).toEqual(['b1']);
  });
  it('Termin vom Gegenüber abgesagt: CANCELLED eines fremden Organisators bzw. alle Gäste abgesagt — eigene Absage nie', async () => {
    const { vomGegenueberAbgesagt } = await import('@/lib/kalender/ics');
    const ics = (status: string, org: string, att = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:u-1\r\nDTSTART:20261012T090000Z\r\nDTEND:20261012T100000Z\r\nSUMMARY:Termin\r\n${status ? `STATUS:${status}\r\n` : ''}ORGANIZER:mailto:${org}\r\n${att}END:VEVENT\r\nEND:VCALENDAR\r\n`;
    const ich = ['ich@example.invalid'];
    expect(vomGegenueberAbgesagt(ics('CANCELLED', 'kunde@example.invalid', 'ATTENDEE;PARTSTAT=ACCEPTED:mailto:ich@example.invalid\r\n'), ich)).toEqual({ uid: 'u-1', abgesagt: true });
    expect(vomGegenueberAbgesagt(ics('CANCELLED', 'ich@example.invalid', 'ATTENDEE;PARTSTAT=ACCEPTED:mailto:kunde@example.invalid\r\n'), ich).abgesagt).toBe(false);
    expect(vomGegenueberAbgesagt(ics('', 'ich@example.invalid', 'ATTENDEE;PARTSTAT=DECLINED:mailto:kunde@example.invalid\r\n'), ich).abgesagt).toBe(true);
    expect(vomGegenueberAbgesagt(ics('', 'kunde@example.invalid', 'ATTENDEE;PARTSTAT=DECLINED:mailto:ich@example.invalid\r\n'), ich).abgesagt).toBe(false); // wir haben abgesagt
    const alt = new Map([['kal|/a.ics', { href: '/a.ics', ics: ics('', 'kunde@example.invalid') }]]);
    const neu = [{ kal: 'kal', o: { href: '/a.ics', ics: ics('CANCELLED', 'kunde@example.invalid') } }];
    const l = Q.absagenAus(alt, neu, () => ({ uid: 'home|u-1', bezug: { kontaktId: 'c-anna', von: 'person-a' } }), x => vomGegenueberAbgesagt(x, ich));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: 'kalender:u-1:abgesagt', art: 'termin-abgesagt', person: 'person-a', bezug: { terminUid: 'home|u-1', kontaktId: 'c-anna' } });
    expect(Q.absagenAus(alt, neu, () => ({ uid: 'home|u-1', bezug: { art: 'fokus' } }), x => vomGegenueberAbgesagt(x, ich))).toHaveLength(0); // ohne CRM-Bezug nichts
  });
});

// ── Ereignisstelle (Server) ────────────────────────────────────────────────────────────────────────────────────────────

describe('ereignis(): Dedup unter Sperre, wirft nie, rollend, Grenzen', () => {
  it('dieselbe Kennung zweimal (auch gleichzeitig) → ein Eintrag; laufende Nummern', async () => {
    const [x, y] = await Promise.all([S.ereignis(mail('m1', 'person-a'), { jetzt: TAG }), S.ereignis(mail('m1', 'person-a'), { jetzt: TAG })]);
    expect(x.neu + y.neu).toBe(1);
    expect(x.schonDa + y.schonDa).toBe(1);
    await S.ereignis([mail('m2', 'person-a'), mail('m3', 'person-a')], { jetzt: TAG });
    const b = await bestand();
    expect(b.eintraege.map(e => [e.id, e.nr])).toEqual([['gmail:m1', 1], ['gmail:m2', 2], ['gmail:m3', 3]]);
  });
  it('wirft nie: Unsinn wird verworfen und gezählt', async () => {
    const r = await S.ereignis([{ id: '', art: 'neue-mail' } as never, { id: 'x y', art: 'neue-mail', quelle: 'gmail', bezug: {}, bereich: null }, null as never]);
    expect(r).toMatchObject({ neu: 0, ungueltig: 3 });
  });
  it('rollend: Einträge vor der Frist (30 Tage) fallen beim nächsten Schreiben weg; Löschfristen-Lauf ebenso', async () => {
    await S.ereignis(mail('alt', 'person-a'), { jetzt: new Date('2026-08-01T08:00:00.000Z') });
    await S.ereignis(mail('neu', 'person-a'), { jetzt: TAG });
    expect((await bestand()).eintraege.map(e => e.id)).toEqual(['gmail:neu']);
    await S.ereignis(mail('alt2', 'person-a'), { jetzt: new Date('2026-08-01T08:00:00.000Z') });
    expect(await S.ereignisseFristAnwenden(BESTAND, TAG)).toBe(1);
  });
  it('über der Grenze je Aufruf: neue abgelehnt und gezählt — nichts gekürzt', async () => {
    const viele = Array.from({ length: T.EREIGNIS_GRENZEN.jeAufruf + 2 }, (_, i) => mail(`v${i}`, 'person-a'));
    const r = await S.ereignis(viele, { jetzt: TAG });
    expect(r).toMatchObject({ neu: T.EREIGNIS_GRENZEN.jeAufruf, abgelehnt: 2 });
    expect((await bestand()).abgelehnt?.anzahl).toBe(2);
  });
});

describe('Quellen → Ereignisse (Fakes)', () => {
  it('Gmail: der volle Erstabgleich löst nichts aus; danach eine neue EINGEHENDE Mail → Ereignis nur für die Person des Postfachs, mit Kontakt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(TAG);
    const g = new GmailFake();
    umgebung(vi, g);
    const V = await import('@/lib/google/verbindung'); const GA = await import('@/lib/gmail/abgleich');
    const { url } = await V.verbindungStarten('person-a', ['gmail']);
    await V.verbindungAbschliessen('person-a', 'code-ok', new URL(url).searchParams.get('state')!);
    g.mail({ id: 'm1', von: 'Anna <anna@firma.example.invalid>', betreff: 'GEHEIM-ALT', text: 'a', vorMin: 60 });
    await GA.gmailAbgleichen('person-a');
    expect((await bestand()).eintraege).toHaveLength(0);
    g.mail({ id: 'm2', von: 'Anna <anna@firma.example.invalid>', betreff: 'GEHEIM-NEU', text: 'b' });
    g.mail({ id: 'm3', von: 'kevin@makeinnovation.test', an: 'anna@firma.example.invalid', betreff: 'Re', text: 'c', labels: ['SENT'] });
    g.mail({ id: 'm4', von: 'gesa@firma.example.invalid', betreff: 'Art 18', text: 'd' });
    g.mail({ id: 'm5', von: 'news@liste.example.invalid', betreff: 'Newsletter', text: 'e', kopf: { 'List-Unsubscribe': '<mailto:x@liste.example.invalid>' } });
    await GA.gmailAbgleichen('person-a');
    const b = await bestand();
    expect(b.eintraege.map(e => e.id)).toEqual(['gmail:m2']);
    expect(b.eintraege[0]).toMatchObject({ art: 'neue-mail', quelle: 'gmail', person: 'person-a', bezug: { kontaktId: 'c-anna', firmaId: 'f-firma', gespraech: expect.stringMatching(/^gm~/) } });
    expect(JSON.stringify(b)).not.toMatch(/GEHEIM|anna@/);
  });
  it('IMAP: neue Nachricht im Posteingang → Ereignis der Person; automatische, eigene und Art.-18-Absender nie', async () => {
    const k = (id: string, von: string, extra: Record<string, unknown> = {}) => ({ id, labels: ['INBOX'], von: { email: von }, ...extra });
    const n = await Q.imapEreignisse('person-b', { adresse: 'b@postfach.example.invalid', bereich: 'privat' }, [k('pf-1:e:1:1', 'bert@firma.example.invalid'), k('pf-1:e:1:2', 'x@y.example.invalid', { automatisch: true }), k('pf-1:e:1:3', 'b@postfach.example.invalid'), k('pf-1:e:1:4', 'gesa@firma.example.invalid')]);
    expect(n).toBe(1);
    expect((await bestand()).eintraege[0]).toMatchObject({ id: 'imap:pf-1:e:1:1', person: 'person-b', bereich: 'privat', bezug: { kontaktId: 'c-bert' } });
  });
  it('WhatsApp: signierter Webhook → Ereignis (Bereich der Nummer, Kontakt über die Telefonnummer); Meta liefert erneut → kein zweites', async () => {
    const GEHEIM = 'f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5';
    const { whatsappKonfig } = await import('@/lib/whatsapp/konfig');
    const k = whatsappKonfig({ WHATSAPP_TELEFONNUMMER_ID: '100200300400500', WHATSAPP_WABA_ID: '200300400500600', WHATSAPP_ZUGRIFFSSCHLUESSEL: 'EAAGtest' + 'Z'.repeat(120), WHATSAPP_APP_GEHEIMNIS: GEHEIM, WHATSAPP_VERIFY_TOKEN: 'c'.repeat(48), WHATSAPP_BEREICH: 'ug' } as never)!;
    expect(k).toBeTruthy();
    const roh = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '200300400500600', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '100200300400500' }, contacts: [{ profile: { name: 'Anna' }, wa_id: '491511234567' }], messages: [{ from: '491511234567', id: 'wamid.EREIGNIS1abcdef', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'GEHEIMER TEXT' } }] } }] }] });
    const sig = `sha256=${createHmac('sha256', GEHEIM).update(roh).digest('hex')}`;
    const { webhookVerarbeiten } = await import('@/lib/whatsapp/webhook');
    expect((await webhookVerarbeiten(Buffer.from(roh), sig, k, 'test-1')).status).toBe(200);
    expect((await webhookVerarbeiten(Buffer.from(roh), sig, k, 'test-1')).status).toBe(200);
    const b = await bestand();
    expect(b.eintraege).toHaveLength(1);
    expect(b.eintraege[0]).toMatchObject({ id: 'wa:wamid.EREIGNIS1abcdef', art: 'neue-whatsapp', bereich: 'business', bezug: { kontaktId: 'c-anna' } });
    expect(b.eintraege[0].person).toBeUndefined();
    expect(JSON.stringify(b)).not.toMatch(/GEHEIM|491511234567/);
  });
  it('Rechnung „bezahlt“ → Zahlungseingang (einmal; nie Betrag)', async () => {
    const route = await import('@/app/api/state/finanzplan/route');
    const kopf = { 'content-type': 'application/json', 'x-make-user': 'person-a' };
    await route.GET(new Request('http://test/api/state/finanzplan', { headers: kopf }));
    const p = (b: unknown) => route.PATCH(new Request('http://test/api/state/finanzplan', { method: 'PATCH', headers: kopf, body: JSON.stringify(b) }));
    expect((await p({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: { id: 'r-e1', firmaId: 'ug', kunde: 'Kunde', titel: 'Leistung', betrag: 4711, status: 'gestellt' } }] })).status).toBe(200);
    expect((await p({ aktion: 'bezahlt', rechnungId: 'r-e1', am: '2026-10-09' })).status).toBe(200);
    expect((await p({ aktion: 'bezahlt', rechnungId: 'r-e1', am: '2026-10-09' })).status).toBe(200);
    const b = await bestand();
    expect(b.eintraege.map(e => e.id)).toEqual(['rechnung:r-e1:bezahlt']);
    expect(b.eintraege[0]).toMatchObject({ art: 'zahlungseingang', quelle: 'finanzplan', bereich: 'business', bezug: { rechnungId: 'r-e1' } });
    expect(JSON.stringify(b)).not.toMatch(/4711/);
  });
  it('Kontoauszug: Zahlungseingänge Business (Gesellschaft) bzw. Haushalt (privat)', async () => {
    expect(await Q.auszugEreignisse({ art: 'business', ort: 'ug' }, 'kt-1', ['bu-ka-1'])).toBe(1);
    expect(await Q.auszugEreignisse({ art: 'haushalt' }, 'kt-2', ['h-1'])).toBe(1);
    expect(await Q.auszugEreignisse({ art: 'keins' }, 'kt-3', ['x'])).toBe(0);
    const e = (await bestand()).eintraege;
    expect(e.map(x => [x.id, x.bereich])).toEqual([['bank:bu-ka-1', 'business'], ['bank:h-1', 'privat']]);
  });
  it('CRM-Schreibweg: Deal anlegen und Stufe wechseln → je ein Ereignis; Kartei: Personen-Lead SQL → lead-sql', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    const deal = { id: 'ch-e1', titel: 'Beispiel-Deal', firma: 'Firma', firmaId: 'f-firma', kontaktIds: ['c-anna'], stufe: 'bedarf', historie: [], gesellschaft: 'ug', besitzer: 'person-a', art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, quelle: 'empfehlung', angelegt: '2026-10-09' };
    await aendereCrm(b => ({ ...b, chancen: [...b.chancen, deal as never] }));
    await aendereCrm(b => ({ ...b, chancen: b.chancen.map(c => (c.id === 'ch-e1' ? { ...c, stufe: 'angebot' as const } : c)) }));
    await aendereCrm(b => ({ ...b, chancen: b.chancen.map(c => (c.id === 'ch-e1' ? { ...c, titel: 'Nur Titel' } : c)) }));
    const { aendereKontakte } = await import('@/lib/crm/kartei-schreiben');
    await aendereKontakte(cur => ({ ...cur!, kontakte: cur!.kontakte.map(k => (k.id === 'c-bert' ? { ...k, lead: { status: 'sql', kriterien: {} } as never } : k)) }));
    const ids = (await bestand()).eintraege.map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining(['crm:deal:ch-e1:bedarf', 'crm:deal:ch-e1:angebot', 'crm:lead:c-bert:sql']));
    expect(ids.filter(i => i.startsWith('crm:deal:'))).toHaveLength(2);
  });
  it('Anfrage-Route: neue Anfrage → neuer Lead (Kennung = Follow-up)', async () => {
    const route = await import('@/app/api/crm/anfrage/route');
    const r = await route.POST(new Request('http://test/api/crm/anfrage', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' }, body: JSON.stringify({ aktion: 'anlegen', neu: { vorname: 'Neue', nachname: 'Person', email: 'neu@firma2.example.invalid' }, kanal: 'mail', text: 'Bitte um ein Angebot.' }) }));
    expect(r.status).toBe(200);
    const d = await r.json() as { followUpId: string; kontaktId: string };
    const e = (await bestand()).eintraege.find(x => x.art === 'neuer-lead')!;
    expect(e).toMatchObject({ id: `crm:anfrage:${d.followUpId}`, quelle: 'anfrage', bezug: { kontaktId: d.kontaktId, followupId: d.followUpId } });
  });
  it('iCloud-Abgleich: Termin mit CRM-Bezug vom Gegenüber abgesagt → Ereignis für die Person des Bezugs', async () => {
    const kal = 'https://caldav.example.invalid/123/calendars/home/';
    await db.saveJson('kalender-bezug', { bezuege: { 'home|u-77': { kontaktId: 'c-anna', von: 'person-a', geaendert: TAG.toISOString() } } });
    const ics = (st: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:u-77\r\nDTSTART:20261012T090000Z\r\nDTEND:20261012T100000Z\r\nSUMMARY:GEHEIM-TITEL\r\n${st}ORGANIZER:mailto:kunde@example.invalid\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const stand = (st: string) => ({ kalender: [{ id: kal }], objekte: { [kal]: [{ href: '/u-77.ics', ics: ics(st) }] }, adressen: ['ich@example.invalid'] });
    expect(await Q.terminAbsagenEreignisse(stand(''), stand('STATUS:CANCELLED\r\n'))).toBe(1);
    expect(await Q.terminAbsagenEreignisse(stand('STATUS:CANCELLED\r\n'), stand('STATUS:CANCELLED\r\n'))).toBe(0);
    const e = (await bestand()).eintraege[0];
    expect(e).toMatchObject({ id: 'kalender:u-77:abgesagt', art: 'termin-abgesagt', person: 'person-a', bezug: { terminUid: 'home|u-77', kontaktId: 'c-anna' } });
    expect(JSON.stringify(e)).not.toMatch(/GEHEIM/);
  });
});

// ── Takt ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Takt: Ereignis-Skill läuft genau einmal, Sichtregel, „An ZOE geben“ sofort', () => {
  it('Skill „neue Mail“: ein Auftrag `faden` mit Ereignis — nach Einreihen + Cursor kein zweiter; die Mail der anderen Person löst nichts aus', async () => {
    await werkstatt([skill('sk-ereignis-00000001')]);
    await S.ereignis([mail('m-a', 'person-a', 'c-anna'), mail('m-b', 'person-b', 'c-bert')], { jetzt: TAG });
    const dran = await TK.ereignisseFaellig(plus(TAG, 1));
    expect(dran).toHaveLength(1);
    const f = dran[0];
    expect(f.auftrag).toMatchObject({ name: 'faden', person: 'person-a', anlass: 'Takt: Agenten-Ereignis', eingabe: { art: 'skill', skillId: 'sk-ereignis-00000001', headId: 'sales', ausloeser: 'ereignis', ereignisId: 'gmail:m-a', eingaben: { kontakt: 'c-anna', ereignis: 'neue Mail' } } });
    expect(JSON.parse(f.auftrag.auftrag!)).toMatchObject({ ereignisId: 'gmail:m-a' });
    // derselbe Weg wie der Takt: Filter (KI, Not-Aus, Fehlerpause) und die eine Warteschlange
    const { sperrenFiltern } = await import('@/lib/zoe/takt');
    await A.reihe((await sperrenFiltern(dran, plus(TAG, 1))).map(x => x.auftrag), plus(TAG, 1));
    await TK.ereignisCursorNachziehen(plus(TAG, 2));
    expect(await TK.ereignisseFaellig(plus(TAG, 3))).toHaveLength(0);
    expect((await A.lies()).filter(a => a.name === 'faden')).toHaveLength(1);
    expect((await bestand()).cursor['skill:sk-ereignis-00000001'].nr).toBe(2);
    // Die Ereignis-Zeile im Takt (lib/zoe/takt.ts `faellig`) liefert ihn ebenso — ein Weg.
    await db.bestandEntfernen('zoe-auftraege');
    await db.saveJson(BESTAND, { ...(await bestand()), cursor: {} });
    const { faellig } = await import('@/lib/zoe/takt');
    expect((await faellig(plus(TAG, 4))).filter(x => x.id.startsWith('ereignis-'))).toHaveLength(1);
  });
  it('fail-closed: ist die Warteschlange (der Riegel) nicht lesbar, wird nichts eingereiht und der Cursor bleibt — danach läuft es einmal', async () => {
    await werkstatt([skill('sk-ereignis-00000004')]);
    await S.ereignis(mail('m-fc', 'person-a', 'c-anna'), { jetzt: TAG });
    const spy = vi.spyOn(A, 'lies').mockRejectedValue(new Error('Bestand nicht lesbar'));
    try {
      expect(await TK.ereignisseFaellig(plus(TAG, 1))).toHaveLength(0);
      await TK.ereignisCursorNachziehen(plus(TAG, 1));
      expect((await bestand()).cursor['skill:sk-ereignis-00000004']).toBeUndefined();
    } finally { spy.mockRestore(); }
    expect(await TK.ereignisseFaellig(plus(TAG, 2))).toHaveLength(1);
  });
  it('Head aus bzw. Skill aus → Ereignisse verfallen (wie ein verpasster Zeitplan); Not-Aus für alle → nichts', async () => {
    await werkstatt([skill('sk-ereignis-00000002', { aktiv: false })]);
    await S.ereignis(mail('m-c', 'person-a', 'c-anna'), { jetzt: TAG });
    expect(await TK.ereignisseFaellig(plus(TAG, 1))).toHaveLength(0);
    await TK.ereignisCursorNachziehen(plus(TAG, 1));
    expect((await bestand()).cursor['skill:sk-ereignis-00000002'].nr).toBe(1);
    await werkstatt([skill('sk-ereignis-00000003')]);
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {}, notAus: { seit: TAG.toISOString(), von: 'person-a' } });
    expect(await TK.ereignisseFaellig(plus(TAG, 2))).toHaveLength(0);
    await db.bestandEntfernen(`agenten-einstellung--${HAUS}`);
    expect(await TK.ereignisseFaellig(plus(TAG, 2))).toHaveLength(1);
  });
  it('„An ZOE geben“ reiht den ZOE-Aufgaben-Lauf SOFORT ein (mit Auftraggeberin) — nachts wartet er bis 7 Uhr', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(TAG);
    const T0 = '2026-10-01T08:00:00.000Z';
    const aufgabe = (id: string) => ({ id, projectId: 'proj-a', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv' });
    await db.saveJson('tasks', { projects: [{ id: 'proj-a', title: 'Projekt', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }], tasks: [aufgabe('a1'), aufgabe('a2')], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
    const { anZoeGeben } = await import('@/lib/zoe/aufgaben-werkzeuge');
    expect((await anZoeGeben('a1', 'person-a')).ok).toBe(true);
    const zoe = (await A.lies()).filter(a => a.name === 'zoe-aufgaben');
    expect(zoe).toHaveLength(1);
    expect(zoe[0]).toMatchObject({ person: 'person-a', status: 'offen', anlass: 'Takt: An ZOE gegeben', eingabe: { ereignisId: expect.stringMatching(/^aufgabe:a1:zoe:/) } });
    // Nachts: Ereignis entsteht, eingereiht wird erst ab 7 Uhr (Takt-Fenster).
    await db.bestandEntfernen('zoe-auftraege');
    vi.setSystemTime(new Date('2026-10-09T21:30:00.000Z')); // 23:30 Berlin
    expect((await anZoeGeben('a2', 'person-a')).ok).toBe(true);
    expect((await A.lies()).filter(a => a.name === 'zoe-aufgaben')).toHaveLength(0);
    const morgens = new Date('2026-10-10T05:05:00.000Z'); // 07:05 Berlin
    vi.setSystemTime(morgens);
    const dran = await TK.ereignisseFaellig(morgens);
    expect(dran.filter(x => x.auftrag.name === 'zoe-aufgaben')).toHaveLength(1);
  });
  it('die Tages-Runde der ZOE-Aufgaben zählt einen Ereignis-Lauf nicht als „heute gelaufen“', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../lib/zoe/takt.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/a\.name === 'zoe-aufgaben' && a\.tag === heute && a\.status !== 'fehler' && !a\.eingabe\?\.ereignisId/);
    expect(src).toMatch(/ereignisseFaellig\(jetzt\)/);
  });
});

// ── Leser ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Leser: Power Hour und Heads-Paket', () => {
  it('„gerade geschrieben“: nur eigene Postfächer bzw. geteilte Nummer — Power Hour schlägt dort kein Nachfassen vor', async () => {
    await S.ereignis([mail('g1', 'person-b', 'c-anna'), { id: 'wa:w1', art: 'neue-whatsapp', quelle: 'whatsapp', bezug: { kontaktId: 'c-bert' }, bereich: 'business' }], { jetzt: TAG });
    expect([...await S.geradeGeschrieben('person-a', plus(TAG, 5))]).toEqual(['c-bert']);
    expect([...await S.geradeGeschrieben('person-b', plus(TAG, 5))].sort()).toEqual(['c-anna', 'c-bert']);
    const { werIstDran } = await import('@/lib/crm/heute');
    const k = { id: 'c-pflege', vorname: 'Pia', nachname: 'Pflege', email: 'pia@firma.example.invalid', stufe: 'warm', kreis: 'A', aktivitaeten: [], besitzer: 'person-a' } as never;
    const crm = (await import('@/lib/crm/speicher')).leererBestand();
    expect(werIstDran([k], crm, '2026-10-09', null).karten).toHaveLength(1);
    const ohne = werIstDran([k], crm, '2026-10-09', null, 12, [], { geradeGeschrieben: new Set(['c-pflege']) });
    expect(ohne.karten).toHaveLength(0);
    expect(ohne.ausgefiltert.geschrieben).toBe(1);
  });
  it('Heads „seit dem letzten Lauf“: nur Business, nur Sichtbares; Systemlauf ohne personengebundene; Art.-18-Personen nie', async () => {
    await S.ereignis([mail('h1', 'person-a', 'c-anna'), { id: 'crm:deal:ch-9:angebot', art: 'deal-stufe', quelle: 'crm', stufe: 'angebot', bezug: { dealId: 'ch-9', kontaktId: 'c-gesperrt' }, bereich: 'business' }, { id: 'bank:p1', art: 'zahlungseingang', quelle: 'kontoauszug', bezug: { buchungId: 'p1' }, bereich: 'privat' }], { jetzt: TAG });
    expect((await S.ereignisseSeit('person-a', '')).map(e => e.id)).toEqual(['gmail:h1', 'crm:deal:ch-9:angebot']);
    expect((await S.ereignisseSeit('person-b', '')).map(e => e.id)).toEqual(['crm:deal:ch-9:angebot']);
    expect((await S.ereignisseSeit(null, '')).map(e => e.id)).toEqual(['crm:deal:ch-9:angebot']);
    const { seitZeilen, seitLetztemLauf, kiKategorieVon } = await import('@/lib/ereignisse/leser');
    const z = seitZeilen(await S.ereignisseSeit('person-a', ''), KARTEI as never, { chancen: [], firmen: [] });
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ art: 'neue Mail', kontakt_id: 'c-anna' });
    // KI-Etikett: was im Paket steht, nennt seine Kategorie; eine gesperrte Kategorie bleibt draußen.
    expect([kiKategorieVon('neue-mail'), kiKategorieVon('zahlungseingang'), kiKategorieVon('termin-abgesagt'), kiKategorieVon('deal-stufe')]).toEqual(['postfach', 'finanzen', 'kalender', 'crm']);
    expect((await seitLetztemLauf('person-a', '', KARTEI as never, { chancen: [], firmen: [] }))?.kategorien).toEqual(['postfach']);
    expect(await seitLetztemLauf('person-a', '', KARTEI as never, { chancen: [], firmen: [] }, k => k !== 'postfach')).toBeNull();
  });
});

// ── Recht, Skill-Editor, Head of IT ────────────────────────────────────────────────────────────────────────────────────

describe('Recht: Register, Frist, Art. 17, Konto löschen', () => {
  it('Register mit Angaben und Frist; Löschfrist „ereignisse“; Konto-Daten eingeordnet', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    expect(registerEintrag(BESTAND)).toMatchObject({ behandlung: 'entfernen', frist: 'ereignisse', rechtsgrundlage: expect.any(String), art15: expect.any(String), loeschfrist: expect.any(String) });
    const { LOESCHFRISTEN } = await import('@/lib/crm/loeschfristen');
    expect(LOESCHFRISTEN.find(f => f.id === 'ereignisse')).toMatchObject({ wirkung: 'automatisch', standard: 30 });
    const { NICHT_PERSOENLICH } = await import('@/lib/datenschutz/konto-daten');
    expect(NICHT_PERSOENLICH['ereignisse--*']).toMatch(/Kennungen/);
  });
  it('Art. 17: Einträge mit der Kennung der Person fallen weg (Art. 15 zählt sie)', async () => {
    await S.ereignis([mail('x1', 'person-a', 'c-anna'), mail('x2', 'person-a', 'c-bert'), { id: 'crm:lead:c-anna:sql', art: 'lead-sql', quelle: 'kartei', bezug: { kontaktId: 'c-anna' }, bereich: 'business' }], { jetzt: TAG });
    const { merkmaleVon, weitereAufzaehlen, weitereEntfernen } = await import('@/lib/crm/person-weitere');
    const m = merkmaleVon('c-anna', KARTEI[0] as never);
    expect((await weitereAufzaehlen(m))[BESTAND]).toBeGreaterThan(0);
    await weitereEntfernen(m);
    expect((await bestand()).eintraege.map(e => e.id)).toEqual(['gmail:x2']);
  });
  it('Konto löschen: Ereignisse NUR dieser Person fallen weg, aus Personen-Listen wird sie gestrichen (rein)', () => {
    const b: EreignisBestand = { v: 1, nr: 3, cursor: {}, eintraege: [
      { nr: 1, ...mail('y1', 'person-b'), am: TAG.toISOString() },
      { nr: 2, id: 'wa:y2', art: 'neue-whatsapp', quelle: 'whatsapp', bezug: {}, bereich: 'business', personen: ['person-a', 'person-b'], am: TAG.toISOString() },
      { nr: 3, id: 'crm:deal:y3:angebot', art: 'deal-stufe', quelle: 'crm', bezug: {}, bereich: 'business', am: TAG.toISOString() },
    ] };
    const r = S.ereignisseOhnePerson(b, 'person-b');
    expect(r.n).toBe(2);
    expect(r.neu.eintraege.map(e => [e.id, e.personen])).toEqual([['wa:y2', ['person-a']], ['crm:deal:y3:angebot', undefined]]);
  });
});

describe('Skill-Editor und Prüfung: „Ereignis“ ist echt', () => {
  it('wählbar sind die angebundenen Arten (nicht „an ZOE gegeben“); nicht angebundene mit Hinweis', async () => {
    const { SKILL_EREIGNISSE, ausloeserPruefen } = await import('@/lib/agenten/skills');
    const { EREIGNISSE_ANZEIGE, istAngebunden, nochNichtAngebunden } = await import('@/lib/ereignisse/arten');
    expect(SKILL_EREIGNISSE).toEqual(expect.arrayContaining(['neue-mail', 'neue-whatsapp', 'zahlungseingang', 'deal-stufe', 'lead-sql', 'neuer-lead', 'termin-abgesagt']));
    expect(SKILL_EREIGNISSE).not.toContain('aufgabe-zoe');
    expect(EREIGNISSE_ANZEIGE).not.toContain('aufgabe-zoe');
    expect(ausloeserPruefen({ art: 'ereignis', ereignis: 'deal-stufe' }).ok).toBe(true);
    expect(ausloeserPruefen({ art: 'ereignis', ereignis: 'aufgabe-zoe' }).ok).toBe(false);
    expect(istAngebunden('neue-mail')).toBe(true);
    expect(istAngebunden('frist-naht')).toBe(false);
    expect(nochNichtAngebunden('frist-naht')).toMatch(/noch nicht angebunden/);
  });
});

describe('Head of IT: Ereignisse (nur Zahlen)', () => {
  it('grün im Normalfall, gelb bei gestauten, rot bei abgelehnten', async () => {
    const { ereignisBefunde } = await import('@/lib/hoi/lage');
    expect(ereignisBefunde(null)).toEqual([]);
    expect(ereignisBefunde({ letzte24h: 4, wartend: 1, gestaut: 0, abgelehntHeute: 0 })[0].ampel).toBe('gruen');
    expect(ereignisBefunde({ letzte24h: 4, wartend: 3, gestaut: 2, abgelehntHeute: 0 })[0].ampel).toBe('gelb');
    expect(ereignisBefunde({ letzte24h: 4, wartend: 0, gestaut: 0, abgelehntHeute: 5 })[0].ampel).toBe('rot');
    await S.ereignis(mail('z1', 'person-a'), { jetzt: new Date() });
    const l = await S.ereignisLage();
    expect(l).toMatchObject({ letzte24h: 1 });
    expect(JSON.stringify(l)).not.toMatch(/person-a|gmail/);
  });
});

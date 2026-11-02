// ─── Marketing-Projekt · Paket M1 „Ziele und Versand“ (01.11.2026, MARKETING_PROJEKT.md) ───────────────────────────────────────────────
// Je Befund mindestens ein Fall: (1) Segment → Kampagne mit Betrieben + Firmen-Ampel · (2) Ziele (Stand je Betrieb, Stoppen, Ergebnis am Betrieb)
// · (3) Fund-Mail über den Mail-Stapel (Drossel, List-Unsubscribe, Fußzeile, Abmeldung sagt den Anruf ab) · (4) keine zweite Erstansprache
// · (5) Sequenz-Stand an der Schritt-Kennung · (6) Anruf-Ergebnis zählt im Trichter · (7) „Jetzt vorbereiten“ mit Zählern und Gründen
// · (8) gelbe Ampel nur einzeln · (9) Tageskontingent erst nach der Prüfung · (10) Willkommen: vermerken erst nach der Vorprüfung, Übersicht
// · (11) Kleines: Zahlen kumulativ mit Betrieben, „Als Lead übernehmen“, Funde-Kampagne ohne festes `zustaendig`, Sendefehler erneut vorbereiten.
// Nachgebautes Postfach (PostSpeicher), eigener Datenordner, erfundene Daten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import type { Kampagne, SequenzSchritt, ZielStand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mkt-ablauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-mkt-ablauf';
process.env.MAKE_OS_KEY = 'dienst-test-mkt-ablauf';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-mkt-ablauf-0123456789ab';

const D = 'example.invalid';
const PW = 'Geheim-Postfach-4711';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let motorRoute: R, kampagnenRoute: R, postfaecher: R;
let db: typeof import('@/lib/store/local-db');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
let M: typeof import('@/lib/crm/kampagnen-motor');
let server: PS;

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (url: string, h: Record<string, string> = sitzung('kevin')) => motorRoute.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const MOTOR = '/api/crm/kampagnen/motor';

const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  // 02.11. (Prüfung D): ein volles Mitglied steuert wie ein Inhaber — die Sperre gilt einem Konto „nur Business“.
  { id: 'k3', speicher: 'nurbusiness', email: `nb@${D}`, name: 'Team Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h', finanzRecht: 'business' },
], einladungen: [] };
const EINW = { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-10-01', zeitpunkt: '2026-10-01T10:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Ja, gern per Mail.', belegRef: 'Gespräch vom 2026-10-01' };
const kontakt = (id: string, vorname: string, extra: Record<string, unknown> = {}) => ({ id, vorname, nachname: 'Beispiel', email: `${vorname.toLowerCase()}@kunde.${D}`, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-10-01', ...extra });
const SEQ: SequenzSchritt[] = [
  { id: 'q1', tagAbstand: 0, kanal: 'mail', betreff: 'Kurze Frage', text: '{{anrede}},\n\nwir haben eine Idee.\n\nViele Grüße\n{{absender}}' },
  { id: 'q2', tagAbstand: 3, kanal: 'anruf', leitfaden: 'Bezug auf die Mail nehmen.' },
];
const MONTAG_10 = new Date('2026-11-02T09:00:00Z');

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  M = await import('@/lib/crm/kampagnen-motor');
  motorRoute = await import('../app/api/crm/kampagnen/motor/route') as R;
  kampagnenRoute = await import('../app/api/crm/kampagnen/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
}, 240_000);
afterAll(() => { T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  M._motorZuruecksetzen();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubEnv('MAKE_OS_ADRESSE', `https://os.${D}`); vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  server = new P.PostSpeicher({ passwort: PW, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] });
  T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    kontakt('c-anna-0001', 'Anna', { einwilligungen: [EINW], firma: 'Anna GmbH' }),
    // Gelb: Einwilligung ohne vollen Nachweis (Altbestand).
    kontakt('c-gabi-0002', 'Gabi', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01' }] }),
    kontakt('c-cora-0003', 'Cora', { telefon: '+49 30 1111111', einwilligungen: [{ ...EINW, kanal: 'telefon' }] }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(),
    firmen: [
      { id: 'f-betrieb', name: 'Betrieb Erfunden', rolle: 'offen', email: `info@betrieb.${D}`, telefon: '+49 30 2222222', labels: ['ziel-test'], lead: { status: 'neu', kriterien: (await import('@/lib/crm/leads')).leereKriterien() }, geaendert: '2026-09-01T10:00:00.000Z' },
      { id: 'f-ohnemail', name: 'Ohne Mail Erfunden', rolle: 'offen', telefon: '+49 30 4444444', labels: ['ziel-test'], geaendert: '2026-09-01T10:00:00.000Z' },
    ],
    segmente: [{ id: 'seg-ziel-test', name: 'Ziel-Test', kriterien: { label: ['ziel-test'] }, geaendert: '2026-10-01T10:00:00.000Z' }],
  });
});

async function kampagneAnlegen(k: Partial<Kampagne> = {}) {
  const neu: Kampagne = { id: 'kp-test', name: 'Test-Kampagne', playbook: 'eigen', ziel: 'Gespräche', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-anna-0001'], ergebnisse: [], von: 'hand', sequenz: SEQ, neuJeTag: 20, zustaendig: 'kevin', geaendert: '2026-10-01T10:00:00.000Z', ...k };
  await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: [...(c!.kampagnen ?? []).filter(x => x.id !== neu.id), neu] }));
}
async function postfachAnlegen(person = 'kevin') {
  const pf = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `vertrieb@firma.${D}`, passwort: PW, bereich: 'ug', anzeigename: 'Vertrieb', absenderName: 'Vertrieb Beispiel' }, sitzung(person));
  expect(pf.status, pf.text).toBe(200);
  return pf.d.id as string;
}
const crm = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const kampagne = async (id = 'kp-test') => (await crm()).kampagnen.find(k => k.id === id)!;
const stand = async (id: string) => (await kampagne()).zielStaende?.find(s => s.id === id);
const fusszeile = () => POST(motorRoute, MOTOR, { aktion: 'einstellungen', fusszeile: 'Beispiel Innovation GmbH · Beispielweg 1 · Impressum' });

describe('1 · Segment → Kampagne nimmt Betriebe mit (Firmen-Ampel beim Planen)', () => {
  it('rein: zielgruppeFirmen = Betriebe ohne Person des Segments; Mail-Kanal → Betrieb ohne Einwilligung rot', async () => {
    const { zielgruppeFirmen, kampagnenFirmenAmpel } = await import('@/lib/crm/kampagnen');
    const c = await crm();
    const f = zielgruppeFirmen([], c, { zielgruppe: {}, segmentId: 'seg-ziel-test' }, '2026-11-02');
    expect(f.map(x => x.id).sort()).toEqual(['f-betrieb', 'f-ohnemail']);
    const a = kampagnenFirmenAmpel('mail', f, c);
    expect(a.rot.map(x => x.id).sort()).toEqual(['f-betrieb', 'f-ohnemail']);
    expect(kampagnenFirmenAmpel('persoenlich', f, c)).toEqual({ rot: [], gelb: [] });
  });

  it('Route „planen“ aus einem Segment: persönlicher Kanal → beide Betriebe als Ziele; der Text nennt sie', async () => {
    const r = await POST(kampagnenRoute, '/api/crm/kampagnen', { aktion: 'planen', playbook: 'eigen', segmentId: 'seg-ziel-test' });
    expect(r.status, r.text).toBe(200);
    expect(r.d.kampagne.firmaIds.sort()).toEqual(['f-betrieb', 'f-ohnemail']);
    expect(r.d.text).toMatch(/2 Betrieben ohne Person/);
    const k = (await crm()).kampagnen.find(x => x.id === r.d.kampagne.id)!;
    expect(k.firmaIds?.sort()).toEqual(['f-betrieb', 'f-ohnemail']);
  });
});

describe('2 · Ziele: Betriebe sichtbar mit Stand, Stoppen, Ergebnis am Betrieb', () => {
  it('GET liefert den Stand je Betrieb; „stoppen“ beendet und sagt Follow-ups ab; Ergebnis „Interesse“ am Betrieb → Lead in Qualifizierung', async () => {
    await kampagneAnlegen({ kontaktIds: [], firmaIds: ['f-betrieb'], sequenz: [{ id: 'q1', tagAbstand: 0, kanal: 'besuch' }] });
    await M.sequenzenFortschreiben(MONTAG_10);
    const g = await GET(`${MOTOR}?kampagneId=kp-test`);
    expect(g.status, g.text).toBe(200);
    expect(g.d.staende).toEqual([expect.objectContaining({ art: 'firma', id: 'f-betrieb', schritt: 0, status: 'wartet' })]);
    const fu = ((await crm()).followups ?? []).filter(f => f.id.startsWith('fu-ks-'));
    expect(fu).toHaveLength(1);
    const s = await POST(motorRoute, MOTOR, { aktion: 'stoppen', kampagneId: 'kp-test', ziel: { art: 'firma', id: 'f-betrieb' } });
    expect(s.status, s.text).toBe(200);
    expect(await stand('f-betrieb')).toMatchObject({ status: 'gestoppt', grund: 'von Hand gestoppt' });
    expect(((await crm()).followups ?? []).find(f => f.id === fu[0].id)?.status).toBe('abgesagt');
    const e = await POST(kampagnenRoute, '/api/crm/kampagnen', { aktion: 'ergebnis', id: 'kp-test', firmaId: 'f-betrieb', ergebnis: 'chance' });
    expect(e.status, e.text).toBe(200);
    const c = await crm();
    expect(c.kampagnen[0].firmenErgebnisse).toEqual([expect.objectContaining({ firmaId: 'f-betrieb', ergebnis: 'chance', von: 'kevin' })]);
    expect(c.firmen.find(f => f.id === 'f-betrieb')?.lead?.status).toBe('qualifizierung');
    // Ein Betrieb, der kein Ziel ist, bekommt kein Ergebnis.
    expect((await POST(kampagnenRoute, '/api/crm/kampagnen', { aktion: 'ergebnis', id: 'kp-test', firmaId: 'f-ohnemail', ergebnis: 'reagiert' })).status).toBe(409);
  });

  it('Säuberer: firmenErgebnisse bleiben beim Speichern aus dem Browser erhalten, fremde Formen fallen weg', async () => {
    await kampagneAnlegen({ firmaIds: ['f-betrieb'], firmenErgebnisse: [{ firmaId: 'f-betrieb', ergebnis: 'reagiert', am: '2026-11-02' }] });
    const { wendeCrmAn, ladeCrm } = await import('@/lib/crm/speicher');
    const r = wendeCrmAn(await ladeCrm(), [{ liste: 'kampagnen', op: 'teil', id: 'kp-test', felder: { name: 'Neu' } }] as never, new Date().toISOString(), 'kevin');
    expect(r.bestand.kampagnen[0].firmenErgebnisse).toEqual([{ firmaId: 'f-betrieb', ergebnis: 'reagiert', am: '2026-11-02' }]);
  });
});

describe('3 + 4 · Fund-Mail über den Mail-Stapel, keine zweite Erstansprache', () => {
  it('eingestellt = freigegeben auf eigenes Risiko; gesendet gedrosselt mit List-Unsubscribe und Fußzeile; Fund + Lead + Ergebnis nach dem Senden; Abmeldung sagt den Anruf ab', async () => {
    await kampagneAnlegen({ kontaktIds: [], firmaIds: ['f-betrieb'], sequenz: undefined });
    const pf = await postfachAnlegen();
    await fusszeile();
    const risiko = { an: true, seit: '2026-11-01T10:00:00.000Z', von: 'kevin' };
    await db.saveJson('kampagne-funde--h', { funde: [{ id: 'fd-1', kampagneId: 'kp-test', quelle: 'hand', name: 'Betrieb Erfunden', branche: 'gastro', email: `info@betrieb.${D}`, firmaId: 'f-betrieb', status: 'uebernommen', angelegt: '2026-11-01T10:00:00.000Z', geaendert: '2026-11-01T10:00:00.000Z' }], bekannt: [], einstellungen: { eigenesRisiko: risiko } });
    const { neuesFollowUp } = await import('@/lib/crm/followup');
    await db.updateJson<Record<string, unknown>>('crm', c => ({ ...c!, followups: [neuesFollowUp({ id: 'fu-fd-1', bezug: { art: 'firma', id: 'f-betrieb' }, art: 'anruf', text: 'Anrufen: Website-Entwurf besprechen (nur ohne Antwort/Abmeldung)', faellig: '2026-11-05' }, undefined, 'kevin', '2026-11-02T09:00:00.000Z')] }));
    const r = await M.fundMailInStapel({ fundId: 'fd-1', kampagneId: 'kp-test', ziel: { art: 'firma', id: 'f-betrieb' }, an: { email: `info@betrieb.${D}`, name: 'Betrieb Erfunden' }, betreff: 'Ihre Website', text: 'Guten Tag,\n\nkurz zu Ihrer Website.\n\nAbmelden: {{abmeldeLink}}', absender: { person: 'kevin', postfach: pf }, durch: 'malin', eigenesRisiko: { seit: risiko.seit, von: risiko.von }, wer: { art: 'person', person: 'malin' } });
    expect(r.neu).toBe(true);
    expect((await M.fundMailInStapel({ fundId: 'fd-1', kampagneId: 'kp-test', ziel: { art: 'firma', id: 'f-betrieb' }, an: { email: `info@betrieb.${D}`, name: 'x' }, betreff: 'x', text: 'x', absender: { person: 'kevin', postfach: pf }, durch: 'kevin', eigenesRisiko: risiko, wer: { art: 'system' } })).neu).toBe(false);
    const e = (await M.ladePost()).eintraege;
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ status: 'freigegeben', risiko: true, fundId: 'fd-1', schrittId: 'fund', freigabe: { von: 'kevin', durch: 'malin', eigenesRisiko: { von: 'kevin' } } });
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(1);
    const roh = server.gesendet[0].roh.toString('utf8');
    expect(roh).toMatch(/^List-Unsubscribe: <https:\/\/os\.example\.invalid\/abmelden\/a1-/m);
    expect(roh.replace(/=\r?\n/g, '')).toMatch(/Beispielweg 1/);
    const fund = (await (await import('@/lib/funde/speicher')).ladeFunde()).funde[0];
    expect(fund).toMatchObject({ status: 'gesendet', gesendet: { von: 'kevin', eigenesRisiko: true } });
    const c = await crm();
    expect(c.firmen.find(f => f.id === 'f-betrieb')?.lead?.status).toBe('kontaktiert');
    expect(c.kampagnen[0].firmenErgebnisse?.some(x => x.firmaId === 'f-betrieb' && x.ergebnis === 'angesprochen')).toBe(true);
    // (4) Eine Sequenz derselben Kampagne startet den schon angeschriebenen Betrieb nicht — mit Grund.
    await db.updateJson<{ kampagnen: Kampagne[] }>('crm', x => ({ ...x!, kampagnen: x!.kampagnen.map(k => ({ ...k, sequenz: SEQ })) }));
    const v = await M.sequenzenFortschreiben(MONTAG_10);
    expect(v.gestartet).toBe(0);
    expect(v.gruende['nicht gestartet: schon angeschrieben']).toBe(1);
    // Abmeldung über den Link → das „Anrufen … nur ohne Antwort/Abmeldung“ des Funds ist abgesagt.
    const { abmeldeToken } = await import('@/lib/datenschutz/abmelden');
    expect(await M.kampagnenAbmeldung(abmeldeToken(`info@betrieb.${D}`)!)).toBe(1);
    expect(((await crm()).followups ?? []).find(f => f.id === 'fu-fd-1')?.status).toBe('abgesagt');
  });

  it('rein: schonAngeschrieben zählt gesendete Stapel-Mails und Funde dieser Kampagne (Firma UND Person), nicht Entwürfe', () => {
    const e = [
      { id: 'km-1', kampagneId: 'kp-a', ziel: { art: 'kontakt', id: 'c-x' }, schrittId: 'q1', kanal: 'mail', an: { name: 'x' }, betreff: '', text: '', status: 'gesendet', angelegt: '', geaendert: '' },
      { id: 'km-2', kampagneId: 'kp-a', ziel: { art: 'kontakt', id: 'c-y' }, schrittId: 'q1', kanal: 'mail', an: { name: 'y' }, betreff: '', text: '', status: 'entwurf', angelegt: '', geaendert: '' },
    ] as never[];
    const raus = M.schonAngeschrieben({ id: 'kp-a' }, e, [{ id: 'fd-9', kampagneId: 'kp-a', firmaId: 'f-z', kontaktId: 'c-z', angeschrieben: true }]);
    expect(Array.from(raus).sort()).toEqual(['firma:f-z', 'kontakt:c-x', 'kontakt:c-z']);
  });

  it('Quelle: lib/funde/uebernehmen.ts sendet nicht mehr selbst — EIN Versandweg über den Stapel', () => {
    const q = readFileSync('lib/funde/uebernehmen.ts', 'utf8');
    expect(q).not.toMatch(/inboxSenden\(/);
    expect(q).toMatch(/fundMailInStapel/);
  });
});

describe('5 · Sequenz-Stand an der Schritt-Kennung', () => {
  it('rein: Altstand (Index) wird übersetzt; ein eingefügter Schritt verschiebt keinen Stand; ein entfernter → kein Schritt mehr', async () => {
    const { schrittVon, standMitKennung, weiter, schrittIndex } = await import('@/lib/crm/sequenz');
    const alt = { sequenz: SEQ };
    const s: ZielStand = { art: 'kontakt', id: 'c-x', schritt: 1, faelligAm: '2026-11-05', status: 'offen', verlauf: [] };
    expect(schrittVon(alt, s)?.id).toBe('q2');
    const mit = standMitKennung(alt, s);
    expect(mit.schrittId).toBe('q2');
    const neu = { sequenz: [{ id: 'q0', tagAbstand: 0, kanal: 'brief' as const, text: 'x' }, ...SEQ] };
    expect(schrittVon(neu, mit)?.id).toBe('q2');
    expect(schrittVon(neu, s)?.id).toBe('q1'); // ohne Übersetzung hätte der Index verschoben
    expect(schrittIndex({ sequenz: [SEQ[0]] }, mit)).toBe(-1);
    const w = weiter(neu, { ...mit, schrittId: 'q1', schritt: 1 }, '2026-11-02', '2026-11-02T10:00:00.000Z', 'gesendet');
    expect(w).toMatchObject({ schritt: 2, schrittId: 'q2', status: 'offen' });
  });

  it('Route „sequenz“: laufende Stände bekommen die Kennung, der Text nennt sie', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-cora-0003'], sequenz: SEQ });
    await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: c!.kampagnen.map(k => ({ ...k, zielStaende: [{ art: 'kontakt', id: 'c-cora-0003', schritt: 1, faelligAm: '2026-11-05', status: 'offen', verlauf: [] }] })) }));
    const r = await POST(motorRoute, MOTOR, { aktion: 'sequenz', kampagneId: 'kp-test', sequenz: [{ id: 'q0', tagAbstand: 0, kanal: 'besuch' }, ...SEQ] });
    expect(r.status, r.text).toBe(200);
    expect(r.d.laufen).toBe(1);
    expect(r.d.text).toMatch(/Ein Ziel läuft/);
    expect(await stand('c-cora-0003')).toMatchObject({ schritt: 1, schrittId: 'q2' });
  });
});

describe('6 · Trichter: Anruf mit Gespräch zählt am Schritt', () => {
  it('Follow-up erledigt mit „Gespräch“ → reagiert, und der Schritt ist erreicht', async () => {
    await kampagneAnlegen({ kanal: 'telefon', kontaktIds: ['c-cora-0003'], sequenz: [{ id: 'a1', tagAbstand: 0, kanal: 'anruf', leitfaden: 'Kurz vorstellen.' }] });
    await M.sequenzenFortschreiben(MONTAG_10);
    const fu = ((await crm()).followups ?? []).find(f => f.id.startsWith('fu-ks-'))!;
    expect(fu).toBeTruthy();
    await db.updateJson<{ followups: { id: string; status: string; ergebnis?: string }[] }>('crm', c => ({ ...c!, followups: c!.followups.map(f => (f.id === fu.id ? { ...f, status: 'erledigt', ergebnis: 'gespraech' } : f)) }));
    await M.sequenzenFortschreiben(MONTAG_10);
    expect(await stand('c-cora-0003')).toMatchObject({ status: 'reagiert' });
    const { kennzahlenJeSchritt } = await import('@/lib/crm/sequenz');
    expect(kennzahlenJeSchritt(await kampagne())[0]).toMatchObject({ id: 'a1', erreicht: 1, reagiert: 1 });
  });
});

describe('7 · „Jetzt vorbereiten“ zeigt Wirkung und Gründe', () => {
  it('nicht aktiv → Hinweis; aktiv → Zähler und Grund (rote Ampel)', async () => {
    await kampagneAnlegen({ status: 'entwurf', kontaktIds: ['c-anna-0001', 'c-cora-0003'] });
    const a = await POST(motorRoute, MOTOR, { aktion: 'vorbereiten', kampagneId: 'kp-test' });
    expect(a.status, a.text).toBe(200);
    expect(a.d.text).toMatch(/nicht aktiv — erst den Status auf „Aktiv“/);
    await db.updateJson<{ kampagnen: Kampagne[] }>('crm', c => ({ ...c!, kampagnen: c!.kampagnen.map(k => ({ ...k, status: 'aktiv' as const })) }));
    const b = await POST(motorRoute, MOTOR, { aktion: 'vorbereiten', kampagneId: 'kp-test' });
    expect(b.d.entwuerfe).toBe(1);
    expect(b.d.gruende['Mail übersprungen: Kanal-Ampel rot']).toBe(1);
    expect(b.d.text).toMatch(/1 neuer Entwurf/);
    expect(b.d.text).toMatch(/Nicht vorbereitet: Mail übersprungen: Kanal-Ampel rot \(1\)/);
  });
});

describe('8 · Gelbe Ampel nur einzeln freigebbar', () => {
  it('Entwurf trägt „gelb“; in der Sammelfreigabe → 409, nichts freigegeben; einzeln → ok', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001', 'c-gabi-0002'] });
    const pf = await postfachAnlegen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const e = (await M.ladePost()).eintraege;
    const gabi = e.find(x => x.ziel.id === 'c-gabi-0002')!;
    const anna = e.find(x => x.ziel.id === 'c-anna-0001')!;
    expect(gabi.gelb).toBeTruthy();
    expect(anna.gelb).toBeUndefined();
    const sammel = await POST(motorRoute, MOTOR, { aktion: 'freigeben', kampagneId: 'kp-test', ids: [anna.id, gabi.id], postfach: pf });
    expect(sammel.status).toBe(409);
    expect(sammel.d.fehler).toMatch(/gelb.*einzeln/);
    expect((await M.ladePost()).eintraege.every(x => x.status === 'entwurf')).toBe(true);
    expect((await POST(motorRoute, MOTOR, { aktion: 'freigeben', kampagneId: 'kp-test', ids: [gabi.id], postfach: pf })).status).toBe(200);
  });
});

describe('9 · Tageskontingent zählt erst nach der Prüfung', () => {
  it('ohne Absender-/Impressumszeile: nichts gesendet, Zähler bleibt 0, Grund am Eintrag; danach geht die Mail', async () => {
    await kampagneAnlegen({ kontaktIds: ['c-anna-0001'] });
    const pf = await postfachAnlegen();
    await M.sequenzenFortschreiben(MONTAG_10);
    const id = (await M.ladePost()).eintraege[0].id;
    await M.stapelFreigeben({ person: 'kevin', kampagneId: 'kp-test', ids: [id], postfach: pf, wer: { art: 'person', person: 'kevin' } });
    const v = await M.versenden(MONTAG_10);
    expect(v.gesendet).toBe(0);
    const p = await M.ladePost();
    expect(Object.values(p.tage).reduce((a, b) => a + b, 0)).toBe(0);
    expect(p.eintraege[0]).toMatchObject({ status: 'freigegeben' });
    expect(p.eintraege[0].fehler).toMatch(/Impressumszeile fehlt/);
    await fusszeile();
    expect((await M.versenden(MONTAG_10)).gesendet).toBe(1);
    expect(Object.values((await M.ladePost()).tage).reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('10 · Willkommensstrecke: vermerken erst nach der Vorprüfung, Übersicht', () => {
  it('ohne sendbaren Website-Absender wird keine Stufe als gesendet vermerkt; GET ?teil=willkommen zeigt Schalter, Texte, Empfänger', async () => {
    const NL = { ...EINW, kanal: 'newsletter', erteiltAm: '2026-10-20', zeitpunkt: '2026-10-20T10:00:00.000Z' };
    await db.saveJson('kontakte', { kontakte: [kontakt('c-wim-0001', 'Wim', { einwilligungen: [NL] })] });
    await db.saveJson('kampagnen-post--h', { eintraege: [], einstellungen: { tagesgrenze: 30, willkommen: { an: true, seit: '2026-10-01T00:00:00.000Z', von: 'kevin' } }, tage: {}, ungueltig: [], willkommen: {} });
    const { willkommenImTakt } = await import('@/lib/crm/willkommen');
    expect(await willkommenImTakt(MONTAG_10)).toBe(0);
    expect((await M.ladePost()).willkommen).toEqual({});
    // Übersicht: mit einem Empfänger (wie nach einem Versand).
    await db.updateJson<Record<string, unknown>>('kampagnen-post--h', c => ({ ...c!, willkommen: { 'c-wim-0001': { start: '2026-10-20', gesendet: [0] } } }));
    const g = await GET(`${MOTOR}?teil=willkommen`, sitzung('nurbusiness'));
    expect(g.status, g.text).toBe(200);
    expect(g.d).toMatchObject({ istInhaber: false, willkommen: { von: 'Kevin' }, empfaenger: [{ id: 'c-wim-0001', name: expect.stringMatching(/Wim/), gesendet: [0] }] });
    expect(g.text).not.toMatch(/@kunde\./); // nie Adressen
    // Texte ändern Inhaber und volle Mitglieder — nie ein Konto „nur Business“.
    expect((await POST(motorRoute, MOTOR, { aktion: 'einstellungen', willkommenStufen: [{ tag: 2, betreff: 'Hallo', text: '{{anrede}}, schön.' }] }, sitzung('nurbusiness'))).status).toBe(403);
    expect((await POST(motorRoute, MOTOR, { aktion: 'einstellungen', willkommenStufen: [{ tag: 2, betreff: 'Hallo', text: '{{anrede}}, schön.' }] })).status).toBe(200);
    expect((await GET(`${MOTOR}?teil=willkommen`)).d.stufen).toEqual([{ tag: 2, betreff: 'Hallo', text: '{{anrede}}, schön.' }]);
  });
});

describe('11 · Kleines', () => {
  it('Kampagnen-Zahlen: Betriebe zählen, „reagiert“ kumulativ', async () => {
    const { kampagnenZahlen } = await import('@/lib/crm/kampagnen');
    const k = { id: 'kp-x', name: 'x', playbook: 'eigen', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-a', 'c-b'], firmaIds: ['f-a'], von: 'hand', geaendert: '',
      ergebnisse: [{ kontaktId: 'c-a', ergebnis: 'reagiert', am: '2026-11-01' }, { kontaktId: 'c-a', ergebnis: 'gespraech', am: '2026-11-02' }],
      firmenErgebnisse: [{ firmaId: 'f-a', ergebnis: 'angesprochen', am: '2026-11-01' }] } as Kampagne;
    expect(kampagnenZahlen(k, '2026-11-02')).toMatchObject({ personen: 2, firmen: 1, ziele: 3, angesprochen: 2, reagiert: 1, gespraeche: 1, offen: 1 });
  });

  it('„Als Lead übernehmen“ am Follow-up „Antwort bearbeiten“: Ergebnis „Interesse“, Lead in Qualifizierung; Dienstweg 403', async () => {
    await kampagneAnlegen({ kontaktIds: [], firmaIds: ['f-betrieb'] });
    const { postEintragId, antwortFollowupId } = await import('@/lib/crm/kampagnen-post');
    const id = postEintragId('kp-test', { art: 'firma', id: 'f-betrieb' }, 'q1');
    await M.aenderePost(b => ({ ...b, eintraege: [{ id, kampagneId: 'kp-test', ziel: { art: 'firma', id: 'f-betrieb' }, schrittId: 'q1', kanal: 'mail', an: { email: `info@betrieb.${D}`, name: 'Betrieb Erfunden' }, betreff: 'x', text: 'x', status: 'gesendet', rueckfluss: { art: 'antwort', am: '2026-11-02T10:00:00.000Z' }, angelegt: '', geaendert: '' }] }));
    const fu = antwortFollowupId(id);
    expect((await POST(motorRoute, MOTOR, { aktion: 'als-lead', followupId: fu }, { 'x-make-key': 'dienst-test-mkt-ablauf', 'x-make-person': 'kevin', 'content-type': 'application/json' })).status).toBe(403);
    const r = await POST(motorRoute, MOTOR, { aktion: 'als-lead', followupId: fu });
    expect(r.status, r.text).toBe(200);
    expect(r.d.text).toMatch(/Qualifizierung/);
    const c = await crm();
    expect(c.firmen.find(f => f.id === 'f-betrieb')?.lead?.status).toBe('qualifizierung');
    expect(c.kampagnen[0].firmenErgebnisse?.[0]).toMatchObject({ ergebnis: 'chance' });
    expect((await POST(motorRoute, MOTOR, { aktion: 'als-lead', followupId: 'fu-x' })).status).toBe(400);
  });

  it('Funde-Kampagne ohne festes „zuständig“ — die Welt Marketing greift', async () => {
    const { kampagneEinrichten } = await import('@/lib/funde/einrichten');
    const r = await kampagneEinrichten('kevin', { art: 'person', person: 'kevin' });
    const k = await kampagne(r.kampagneId);
    expect(k.zustaendig).toBeUndefined();
    const { weltDerKampagne } = await import('@/lib/crm/kampagnen-welt');
    expect(weltDerKampagne(k)).toBe('marketing');
  });

  it('Oberfläche: Sendefehler stehen unter „Versand“ (mit „Erneut vorbereiten“), gelbe nie in der Sammelauswahl, Freigabe-Knopf mit Grund', () => {
    const q = readFileSync('components/os/crm/kampagne/Sequenz.tsx', 'utf8');
    expect(q).toMatch(/sendefehler\(x\)\)/);
    expect(q).toMatch(/sammelbar = freigebbar\.filter\(x => !x\.gelb\)/);
    expect(q).toMatch(/aus=\{!!freigabeGrund\}/);
    expect(readFileSync('components/os/crm/website/Website.tsx', 'utf8')).toMatch(/<WillkommenKarte/);
    expect(readFileSync('components/os/crm/Kampagnen.tsx', 'utf8')).toMatch(/<KampagneZiele/);
  });
});

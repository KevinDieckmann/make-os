// ─── Markttraktion Sofort-Paket (08.10.) — die zehn Funde aus MARKTTRAKTION_BEFUND.md, je mit Wächter ──────────────────────────
// 1.1/1.2 neue Kontakte verschwinden · 3.1 Absender-Lücken erst beim Stellen · 3.2 Absender-Vorgabe fest `kdc` · 3.9 „+ Rechnung“ netto als
// brutto · 4.1 Power Hour schließt Follow-ups nicht · 4.2 Fehler verschwinden in der Follow-up-Liste · 4.3 Power Hour verteilt falsch ·
// 5.11 Erfolg trotz Fehler · 6.1 Heads im Takt (Zugang: tests/integritaet-zugang.test.ts). Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUp, Mandat } from '@/lib/crm/typen';
import type { CrmApi } from '@/components/os/crm/daten';
import type { AngebotDaten } from '@/components/os/crm/angebot/angebot-daten';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mt-sofort-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mt-sofort';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const T = '2026-10-08';
const J = '2026-10-08T09:00:00.000Z';
const vor = (n: number) => { const d = new Date(`${T}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: vor(90), geaendertAm: vor(90), besitzer: 'kevin', ...x });
const angelegtVonHand = (tag: string) => ({ importiertAm: tag, aktivitaeten: [{ am: `${tag}T09:00:00.000Z`, art: 'system' as const, text: 'Von Hand angelegt', von: 'system' }] });
const crmLeer = (x: Partial<CrmBestand> = {}): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], ...x } as unknown as CrmBestand);
const quelle = (datei: string) => readFileSync(path.join(process.cwd(), datei), 'utf8');

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── 1.1 / 1.2 · Neue Kontakte verschwinden nicht mehr ───────────────────────────────────────────────────────────────────────
describe('1.1/1.2 · neu angelegte und gesetzte Leads sind nie „kalt“ (EINE Regel in lib/crm/leads.ts)', () => {
  it('frischAngelegt: von Hand angelegt ≤ 14 Tage ja — Listen-Import (ohne Anlage-Vermerk) und Älteres nein', async () => {
    const { frischAngelegt, FRISCH_TAGE } = await import('@/lib/crm/leads');
    expect(FRISCH_TAGE).toBe(14);
    expect(frischAngelegt(k('a', angelegtVonHand(T)), T)).toBe(true);
    expect(frischAngelegt(k('b', angelegtVonHand(vor(14))), T)).toBe(true);
    expect(frischAngelegt(k('c', angelegtVonHand(vor(15))), T)).toBe(false);
    expect(frischAngelegt(k('d', { importiertAm: T }), T)).toBe(false); // Import: keine Aktivität
    expect(frischAngelegt(k('e', { ...angelegtVonHand('2026-10-20') }), T)).toBe(false); // Zukunft zählt nicht
  });

  it('leads(): frisch angelegter Lead ist mit kaltem Score sichtbar (In Arbeit, Runde); Import und Altes bleiben kalt — mit Zähler „n kalte ausgeblendet“', async () => {
    const { leads, nichtKalt, istKalt, inArbeit, zuQualifizieren, kalteAusgeblendet } = await import('@/lib/crm/leads');
    const kontakte = [k('neu', angelegtVonHand(T)), k('import', { importiertAm: T }), k('alt', angelegtVonHand(vor(40)))];
    const z = leads(kontakte, crmLeer(), T);
    const zeile = (id: string) => z.find(x => x.id === `c-${id}`)!;
    // Voraussetzung des Funds: beim Standard-Scoring sind alle drei „kalt“.
    for (const id of ['neu', 'import', 'alt']) expect(zeile(id).score.temperatur, id).toBe('kalt');
    expect(zeile('neu').frisch).toBe(true);
    expect(nichtKalt(zeile('neu'))).toBe(true);
    expect(inArbeit(zeile('neu'))).toBe(true); // „In Arbeit“ nimmt „Neu“ dazu
    expect(istKalt(zeile('import'))).toBe(true);
    expect(inArbeit(zeile('import'))).toBe(false);
    expect(istKalt(zeile('alt'))).toBe(true);
    const runde = zuQualifizieren(z, { wer: 'kevin', heute: T });
    expect(runde.map(x => x.id)).toEqual(['c-neu']);
    expect(kalteAusgeblendet(z, { wer: 'kevin', heute: T })).toBe(2);
    expect(kalteAusgeblendet(z, { wer: 'kevin', heute: T, auchKalt: true })).toBe(0);
    expect(zuQualifizieren(z, { wer: 'kevin', heute: T, auchKalt: true })).toHaveLength(3);
  });

  it('ein GESETZTER aktiver Status (kontaktiert, im Gespräch, Qualifizierung — z. B. aus Netzwerken) ist nie kalt; gesetztes „Neu“ schon', async () => {
    const { leads, istKalt, inArbeit, zuQualifizieren } = await import('@/lib/crm/leads');
    const kriterien = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
    const firmen = [
      { id: 'f-kontaktiert', name: 'Kontaktiert GmbH', rolle: 'zielkunde', geaendert: J, lead: { status: 'kontaktiert', kriterien } },
      { id: 'f-neu', name: 'Neu GmbH', rolle: 'zielkunde', geaendert: J, lead: { status: 'neu', kriterien } },
    ] as unknown as CrmBestand['firmen'];
    const z = leads([k('x', { firmaId: 'f-kontaktiert', firma: 'Kontaktiert GmbH' }), k('y', { firmaId: 'f-neu', firma: 'Neu GmbH' })], crmLeer({ firmen }), T);
    const a = z.find(x => x.id === 'f-kontaktiert')!, b = z.find(x => x.id === 'f-neu')!;
    expect(a.score.temperatur).toBe('kalt');
    expect(istKalt(a)).toBe(false);
    expect(inArbeit(a)).toBe(true);
    expect(istKalt(b)).toBe(true);
    expect(zuQualifizieren(z, { wer: 'alle', heute: T }).map(x => x.id)).toEqual(['f-kontaktiert']);
  });

  it('Oberfläche: Leads-Liste filtert nur über inArbeit/nichtKalt, die Runde zeigt „kalte ausgeblendet — Zeigen“', () => {
    const leadsTsx = quelle('components/os/crm/Leads.tsx');
    expect(leadsTsx).toMatch(/f === 'aktiv' \? inArbeit\(z\)/);
    expect(leadsTsx).not.toMatch(/mindestens 25 Punkte/);
    const runde = quelle('components/os/crm/Qualifizierung.tsx');
    expect(runde).toMatch(/kalteAusgeblendet\(/);
    expect(runde).toMatch(/ausgeblendet — sie warten im Segment/);
  });
});

// ── 4.1 / 4.3 · Power Hour: Follow-up führt und wird erledigt ────────────────────────────────────────────────────────────────
const fu = (x: Partial<FollowUp> = {}): FollowUp => ({ id: 'fu-eins', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'anruf', text: 'Angebot nachfassen', faellig: T, zustaendig: 'malin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J, ...x });

describe('4.3 · die Power-Hour-Karte gehört der Person, die für das Follow-up zuständig ist', () => {
  it('Beziehung hält Kevin, Follow-up gehört Malin → Karte (mit followupId) bei Malin, nicht bei Kevin', async () => {
    const { werIstDran, karteGehoert } = await import('@/lib/crm/heute');
    const kontakte = [k('a', { telefon: '+49 30 1', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'], stufe: 'gespraech' })];
    const crm = crmLeer({ followups: [fu()] });
    const mal = werIstDran(kontakte, crm, T, 'malin');
    const kev = werIstDran(kontakte, crm, T, 'kevin');
    expect(mal.karten.map(c => c.kontakt.id)).toEqual(['c-a']);
    expect(mal.karten[0].followupId).toBe('fu-eins');
    expect(kev.karten).toHaveLength(0);
    expect(kev.ausgefiltert.beiAnderen).toBe(1);
    // Ohne Follow-up gilt weiter die Beziehung — und der Systemlauf der Heads (null) sieht alle Karten.
    expect(karteGehoert({ kontakt: kontakte[0] }, crm)).toBe('kevin');
    expect(werIstDran(kontakte, crm, T, null).karten).toHaveLength(1);
  });
});

describe('4.1 · Ergebnis-Knopf führt das echte Follow-up mit (aktivitaetImCrm, EINE Sperre)', () => {
  const ein = (x: Record<string, unknown> = {}) => ({ kontakt: k('a'), von: 'malin', heute: T, jetzt: J, ...x });
  it('Gespräch → erledigt mit Ergebnis; nicht erreicht → kommt am Tag der Regel wieder (offen, keine zweite Erinnerung)', async () => {
    const { aktivitaetImCrm } = await import('@/lib/crm/aktivitaet-folgen');
    const crm = crmLeer({ followups: [fu()] });
    const r = aktivitaetImCrm(crm, ein({ ergebnis: 'gespraech', followupId: 'fu-eins' }));
    expect(r.followup).toMatchObject({ id: 'fu-eins', wie: 'erledigt' });
    expect(r.crm.followups![0]).toMatchObject({ status: 'erledigt', ergebnis: 'gespraech', erledigtAm: J, geaendertVon: 'malin' });
    const n = aktivitaetImCrm(crm, ein({ ergebnis: 'nicht_erreicht', followupId: 'fu-eins', followupNochmalAm: '2026-10-12' }));
    expect(n.followup).toMatchObject({ wie: 'verschoben', faellig: '2026-10-12' });
    expect(n.crm.followups![0]).toMatchObject({ status: 'offen', faellig: '2026-10-12' });
  });
  it('fremdes, erledigtes oder unbekanntes Follow-up bleibt unberührt; Event-Follow-up erledigt = Gast nachgefasst', async () => {
    const { aktivitaetImCrm } = await import('@/lib/crm/aktivitaet-folgen');
    const fremd = crmLeer({ followups: [fu({ kontaktId: 'c-b', bezug: { art: 'kontakt', id: 'c-b' } })] });
    expect(aktivitaetImCrm(fremd, ein({ ergebnis: 'gespraech', followupId: 'fu-eins' })).followup).toBeNull();
    const zu = crmLeer({ followups: [fu({ status: 'erledigt' })] });
    expect(aktivitaetImCrm(zu, ein({ ergebnis: 'gespraech', followupId: 'fu-eins' })).followup).toBeNull();
    expect(aktivitaetImCrm(crmLeer({ followups: [fu()] }), ein({ ergebnis: 'gespraech', followupId: 'fu-anders' })).followup).toBeNull();
    const ev = crmLeer({ followups: [fu({ bezug: { art: 'event', id: 'ev-1' } })], teilnahmen: [{ id: 't-1', eventId: 'ev-1', kontaktId: 'c-a', status: 'da', geaendert: J }] as unknown as CrmBestand['teilnahmen'] });
    const r = aktivitaetImCrm(ev, ein({ ergebnis: 'termin', followupId: 'fu-eins' }));
    expect(r.crm.teilnahmen[0].followUpAm).toBe(T);
  });
});

// ── Routen: Aktivität mit Follow-up (4.1), Angebot/Absender (3.1/3.2) ───────────────────────────────────────────────────────
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
let db: typeof import('@/lib/store/local-db');
let heute: string;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'fremd', 'mitglied', 'anders')], einladungen: [] });
  const person = (id: string) => ({ ...k(id, { email: `c-${id}@example.invalid`, telefon: '+49 30 9', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'], stufe: 'gespraech', besitzer: 'kevin' }) });
  const tagPlus = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  await db.saveJson('kontakte', { kontakte: [person('a'), person('b'), { ...person('c'), wiedervorlage: tagPlus(-3) }, { ...person('d'), wiedervorlage: tagPlus(30) }, person('angebot1')] });
  const speicher = await import('@/lib/crm/speicher');
  const fuFuer = (id: string, kontakt: string) => fu({ id, kontaktId: kontakt, bezug: { art: 'kontakt', id: kontakt }, faellig: heute });
  await db.saveJson('crm', { ...speicher.leererBestand(), followups: [fu({ faellig: heute }), fuFuer('fu-zwei', 'c-b'), fuFuer('fu-drei', 'c-c'), fuFuer('fu-vier', 'c-d')] });
  // Register mit Cap-Table, Verträgen, Notizen — nichts davon darf in eine Absender-Antwort. Absender `ug` noch ohne Firmierung/Anschrift.
  await db.saveJson('gesellschaften--haus', { gesellschaften: [
    { id: 'ug', email: 'info@example.invalid', gesellschafter: [{ id: 'gs-geheim-0001', wer: { art: 'person', id: 'p-x' }, nennbetragCent: 100 }], vertraege: [{ id: 'vt-geheim-0001', art: 'sonstiges', titel: 'Geheimvertrag', parteien: [], status: 'entwurf' }], notizen: 'Geheimnotiz' },
  ] });
});

describe('4.1 · POST /api/crm/aktivitaet mit followupId', () => {
  it('Gespräch: Aktivität am Kontakt + Follow-up erledigt (EINE Erinnerung: die Wiedervorlage der Regel)', async () => {
    const r = await (await import('@/app/api/crm/aktivitaet/route')).POST(anfrage('/api/crm/aktivitaet', sitzung('malin'), 'POST', { id: 'c-a', art: 'anruf', ergebnis: 'gespraech', anlass: 'Power Hour: Angebot nachfassen', followupId: 'fu-eins' }));
    expect(r.status).toBe(200);
    const d = await r.json() as { hinweis?: string; followup?: { wie: string } };
    expect(d.followup?.wie).toBe('erledigt');
    expect(d.hinweis).toMatch(/Follow-up erledigt/);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(crm.followups!.find(f => f.id === 'fu-eins')).toMatchObject({ status: 'erledigt', ergebnis: 'gespraech' });
    const a = ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte).find(x => x.id === 'c-a')!;
    expect(a.aktivitaeten).toHaveLength(1);
    expect(a.wiedervorlage).toBeTruthy();
  });
  it('nicht erreicht: Follow-up wandert auf +2 Werktage, KEINE Wiedervorlage am Kontakt daneben', async () => {
    const { werktagePlus } = await import('@/lib/crm/heute');
    const r = await (await import('@/app/api/crm/aktivitaet/route')).POST(anfrage('/api/crm/aktivitaet', sitzung('malin'), 'POST', { id: 'c-b', art: 'anruf', ergebnis: 'nicht_erreicht', anlass: 'Power Hour: Angebot nachfassen', followupId: 'fu-zwei' }));
    expect(r.status).toBe(200);
    const crm = await (await import('@/lib/crm/speicher')).ladeCrm();
    expect(crm.followups!.find(f => f.id === 'fu-zwei')).toMatchObject({ status: 'offen', faellig: werktagePlus(heute, 2) });
    const b = ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte).find(x => x.id === 'c-b')!;
    expect(b.aktivitaeten).toHaveLength(1);
    expect(b.wiedervorlage).toBeUndefined();
  });
  it('nicht erreicht: eine schon fällige Wiedervorlage ist mit dem Anlauf abgearbeitet, eine künftige bleibt', async () => {
    const route = await import('@/app/api/crm/aktivitaet/route');
    for (const [id, f] of [['c-c', 'fu-drei'], ['c-d', 'fu-vier']]) {
      const r = await route.POST(anfrage('/api/crm/aktivitaet', sitzung('malin'), 'POST', { id, art: 'anruf', ergebnis: 'mailbox', anlass: 'Power Hour: Angebot nachfassen', followupId: f }));
      expect(r.status).toBe(200);
    }
    const alle = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(alle.find(x => x.id === 'c-c')!.wiedervorlage).toBeUndefined();
    expect(alle.find(x => x.id === 'c-d')!.wiedervorlage! > heute).toBe(true);
  });
  it('die Power-Hour-Karte schickt ihr Follow-up mit (Heute.tsx → festhalten)', () => {
    expect(quelle('components/os/crm/Heute.tsx')).toMatch(/followupId: k\.followupId/);
    expect(quelle('app/api/crm/heute/route.ts')).toMatch(/followupId: c\.followupId/);
  });
});

describe('3.1 · GET /api/crm/angebot liefert die Absender mit `luecken` (und nichts aus dem Register)', () => {
  it('luecken + Vorgabe da, Cap-Table/Verträge/Notizen nicht; fremder Haushalt 403', async () => {
    const route = await import('@/app/api/crm/angebot/route');
    const r = await route.GET(anfrage('/api/crm/angebot', sitzung('kevin')));
    expect(r.status).toBe(200);
    const text = await r.text();
    const d = JSON.parse(text) as { gesellschaften: { id: string; luecken: string[] }[]; vorgabe: string | null };
    expect(d.gesellschaften.find(g => g.id === 'ug')!.luecken).toEqual(expect.arrayContaining(['Firmierung', 'Anschrift']));
    expect(d.vorgabe).toBe('ug');
    for (const geheim of ['gesellschafter', 'vertraege', 'Geheimvertrag', 'Geheimnotiz', 'gs-geheim']) expect(text, geheim).not.toContain(geheim);
    expect((await route.GET(anfrage('/api/crm/angebot', sitzung('fremd')))).status).toBe(403);
  });
  it('Stellen mit unvollständigem Absender: 409 mit dem Weg zu Unternehmen › … › Absender (nicht mehr „Stammdaten › Gesellschaften“)', async () => {
    const route = await import('@/app/api/crm/angebot/route');
    const plus = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const felder = { gesellschaft: 'ug', kontaktId: 'c-angebot1', titel: 'Beispiel-Angebot', gueltigBis: plus(20), zahlungszielTage: 14, einleitung: 'Guten Tag', schluss: 'Gruß',
      positionen: [{ id: 'p-1', titel: 'Beratung', menge: 1, einheit: 'Stück', einzelpreisCent: 100000, ustSatz: 19, basis: 'einmalig' }] };
    const s = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'speichern', id: 'ang-sofort-0001', felder }));
    expect(s.status).toBe(200);
    const a = (await s.json() as { angebot: { stand: string } }).angebot;
    const r = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'stellen', id: 'ang-sofort-0001', stand: a.stand }));
    const d = await r.json() as { fehler: string; weg?: string };
    expect(r.status, d.fehler).toBe(409);
    expect(d.fehler).toMatch(/Unternehmen › .+ › Absender/);
    expect(d.fehler).not.toMatch(/Stammdaten › Gesellschaften/);
    expect(d.weg).toBe('/os/unternehmen?g=ug&r=absender');
  });
  it('GET /api/crm/gesellschaften: dieselbe Absender-Stelle (nur Absender-Felder) und die Vorgabe', async () => {
    const r = await (await import('@/app/api/crm/gesellschaften/route')).GET(anfrage('/api/crm/gesellschaften', sitzung('malin')));
    const text = await r.text();
    expect(JSON.parse(text).vorgabe).toBe('ug');
    expect(text).not.toContain('Geheimvertrag');
  });
});

describe('3.2 · Absender-Vorgabe = die operative Business-Gesellschaft — nie fest die Selbstständigkeit', () => {
  it('operativeBusinessGesellschaft: Holding-Rückfall, Rolle im Steckbrief, nicht eindeutig → null, Privat-Einheit nie', async () => {
    const { operativeBusinessGesellschaft } = await import('@/lib/gesellschaften/modell');
    const { HOLDING_VORGABE } = await import('@/lib/business/register');
    expect(operativeBusinessGesellschaft(null, HOLDING_VORGABE)).toBe('ug');
    expect(operativeBusinessGesellschaft({ gesellschaften: [{ id: 'ug', rolle: 'holding' }] } as never, HOLDING_VORGABE)).toBe('kdv');
    expect(operativeBusinessGesellschaft(null, [])).toBeNull(); // zwei operative → wählen
    expect(operativeBusinessGesellschaft({ gesellschaften: [{ id: 'ug', geloeschtAm: J }] } as never, HOLDING_VORGABE)).toBeNull(); // im Papierkorb
    for (const rueckfall of [[], ['kdv'], ['ug']]) expect(operativeBusinessGesellschaft(null, rueckfall)).not.toBe('kdc');
  });
  it('Server: ein neuer Entwurf ohne Absender (z. B. aus Netzwerken) bekommt die Vorgabe des Registers, nicht die Selbstständigkeit', async () => {
    const route = await import('@/app/api/crm/angebot/route');
    const r = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'speichern', id: 'ang-sofort-0002', felder: { kontaktId: 'c-angebot1', titel: 'Ohne Absender' } }));
    expect(r.status).toBe(200);
    expect((await r.json() as { angebot: { gesellschaft: string } }).angebot.gesellschaft).toBe('ug');
  });

  const K: Kontakt = k('anna', { email: 'c-anna@example.invalid', anrede: 'Sie' });
  const stand = crmLeer();
  const api = { crm: { ok: true, heute: T, stand, ich: 'kevin', stufen: [], prognose: {}, gewinnquote: {}, ampel: {}, mandate: {}, zahlung: {}, mrr: 0, konzentration: null, events: {}, termine: {} }, kontakte: [K], fehler: null, laden: async () => {} } as unknown as CrmApi;
  const daten = (x: Partial<AngebotDaten>) => ({ angebote: [], papierkorb: [], gesellschaften: [], vorgabe: null, fehler: null, gesperrt: false, laden: async () => {}, uebernehmen: () => {}, entfernen: () => {}, setFehler: () => {}, ...x } as unknown as AngebotDaten);

  it('Editor: neues Angebot nimmt die Vorgabe des Registers und zeigt fehlende Absender-Angaben mit Weg', { timeout: 60_000 }, async () => {
    const { Editor } = await import('@/components/os/crm/angebot/Editor');
    const { UG_NAME } = await import('@/lib/einheiten');
    const html = renderToStaticMarkup(h(Editor, { api, daten: daten({ vorgabe: 'ug', gesellschaften: [{ id: 'ug', stand: 's', luecken: ['Firmierung', 'Anschrift'] }] as never }), id: 'ang-neu-sofort1', start: null, vorbelegung: { kontaktId: 'c-anna' }, onGespeichert: () => {}, onGestellt: () => {}, onListe: () => {} }));
    expect(html).toContain(UG_NAME);
    expect(html).toContain('Absender unvollständig');
    expect(html).toContain('href="/os/unternehmen?g=ug&amp;r=absender"');
    expect(html).not.toContain('Absender wählen');
  });
  it('Editor: ohne eindeutige Vorgabe wird gewählt — kein stiller Rückfall', { timeout: 60_000 }, async () => {
    const { Editor } = await import('@/components/os/crm/angebot/Editor');
    const html = renderToStaticMarkup(h(Editor, { api, daten: daten({ vorgabe: null }), id: 'ang-neu-sofort2', start: null, vorbelegung: { kontaktId: 'c-anna' }, onGespeichert: () => {}, onGestellt: () => {}, onListe: () => {} }));
    expect(html).toContain('Absender wählen');
    expect(html).toContain('Absender (Gesellschaft)'); // „fehlt: …“ in der Summenleiste sperrt „Mail versenden“
  });
  it('kein `kdc`-Rückfall mehr in Editor und Umsatz-Reiter', () => {
    expect(quelle('components/os/crm/angebot/Editor.tsx')).not.toMatch(/: 'kdc'/);
    expect(quelle('components/os/crm/kontakt/UmsatzReiter.tsx')).not.toMatch(/'kdc'/);
  });
});

// ── 3.9 · „+ Rechnung“ im Kontakt › Umsatz ──────────────────────────────────────────────────────────────────────────────────
describe('3.9 · „+ Rechnung“: Brutto aus dem Netto-Honorar, Gesellschaft über finanzFirmaFuer, Vorgabe „geplant“', () => {
  const m = (x: Partial<Mandat> = {}) => ({ id: 'm-1', titel: 'Retainer', honorar: { betrag: 1000, basis: 'monat' as const, netto: true }, ustSatz: 19, gesellschaft: 'ug', ...x }) as Mandat;
  it('Vorbelegung aus dem Mandat', async () => {
    const { rechnungVorbelegung } = await import('@/lib/crm/umsatz');
    expect(rechnungVorbelegung(m(), null)).toEqual({ titel: 'Retainer', betrag: '1190', mandatId: 'm-1', firmaId: 'ug', status: 'geplant', nurGrunddaten: false });
    expect(rechnungVorbelegung(m({ honorar: { betrag: 1190, basis: 'monat', netto: false } }), null).betrag).toBe('1190');
    expect(rechnungVorbelegung(m({ honorar: { betrag: 999.99, basis: 'monat', netto: true } }), null).betrag).toBe('1189.99');
    expect(rechnungVorbelegung(m({ gesellschaft: 'kdv' }), null).firmaId).toBe('kdv');
    // „offen“ → die operative Business-Gesellschaft (Vorgabe), ohne Vorgabe: wählen — nie still `kdc`.
    expect(rechnungVorbelegung(m({ gesellschaft: 'offen' }), 'ug').firmaId).toBe('ug');
    expect(rechnungVorbelegung(m({ gesellschaft: 'offen' }), null).firmaId).toBeNull();
    expect(rechnungVorbelegung(undefined, null)).toMatchObject({ betrag: '', mandatId: null, firmaId: null, status: 'geplant' });
    expect(rechnungVorbelegung(m({ gesellschaft: 'g-0f8fad5b-d9cb-469f-a165-70867728950e' as never }), 'ug')).toMatchObject({ firmaId: null, nurGrunddaten: true });
  });
  it('Eintrag: Netto + USt-Satz nur, solange der Betrag der gerechnete ist', async () => {
    const { rechnungAusFormular } = await import('@/lib/crm/umsatz');
    const f = { titel: 'Retainer', betrag: '1190', status: 'geplant' as const, mandatId: 'm-1', firmaId: 'ug' };
    expect(rechnungAusFormular(f, m(), { id: 'r-1', kunde: 'Muster' })).toMatchObject({ betrag: 1190, netto: 1000, ustSatz: 19, status: 'geplant', firmaId: 'ug', mandatId: 'm-1' });
    const vonHand = rechnungAusFormular({ ...f, betrag: '1500,5' }, m(), { id: 'r-2', kunde: 'Muster' });
    expect(vonHand).toMatchObject({ betrag: 1500.5, ustSatz: 19 });
    expect(vonHand).not.toHaveProperty('netto');
    expect(rechnungAusFormular({ ...f, mandatId: null }, undefined, { id: 'r-3', kunde: 'Muster' })).not.toHaveProperty('ustSatz');
  });
});

// ── 4.2 · Fehler bleiben stehen · 5.11 · kein Erfolg trotz Fehler ───────────────────────────────────────────────────────────
describe('4.2 / 5.11 · Rückmeldungen: Fehler bleiben stehen, Erfolg nur, wenn gespeichert', () => {
  it('Follow-up-Liste: Neuladen löscht den Fehler einer Aktion nicht; Formulare schließen nur bei ok', () => {
    const s = quelle('components/os/crm/FollowUp.tsx');
    const laden = s.slice(s.indexOf('const laden = useCallback'), s.indexOf('useEffect(() => { void laden(); }'));
    expect(laden).not.toMatch(/setAktionFehler/);
    expect(s).toMatch(/if \(r\.ok\) \{ setErledigen\(false\); setOffen\(false\); \}/);
    expect(s).toMatch(/if \(r\.ok\) setNeu\(false\)/);
    expect(s).toMatch(/die Eingabe bleibt stehen/);
  });
  it.each([
    'components/os/crm/marketing/Segmente.tsx', 'components/os/crm/events/Abend.tsx', 'components/os/crm/events/Start.tsx', 'components/os/crm/marketing/Redaktionsplan.tsx',
  ])('%s: jede Rückgabe von api.setze/teil/kontaktSetzen wird geprüft', datei => {
    // Kein `await api.setze(...)` als bloße Anweisung — die Antwort entscheidet, ob Erfolg gemeldet wird.
    expect(quelle(datei)).not.toMatch(/(^|[;{]\s*)await api\.(setze|teil|kontaktSetzen)\(/m);
  });
  it('Make.One-Abend: eine Person, die nicht gespeichert ist, wird nicht als „da“ eingetragen', () => {
    const s = quelle('components/os/crm/events/Abend.tsx');
    expect(s.indexOf('if (!(await api.kontaktSetzen(k)))')).toBeGreaterThan(-1);
    expect(s.indexOf('if (!(await api.kontaktSetzen(k)))')).toBeLessThan(s.indexOf('if (!(await eintragen(id)))'));
  });
});

// ── 6.1 · Heads ohne Person: kein Rückfall ──────────────────────────────────────────────────────────────────────────────────
describe('6.1 · Systemlauf der Heads (ohne Person) — kein Rückfall auf ein Kürzel', () => {
  it('fuerWen: „beide“ bleibt „beide“ ohne Person, sonst die Person; Power Hour/Frage nur mit Person', async () => {
    const { fuerWen } = await import('@/lib/heads/paket');
    const { headLauf, NUR_MIT_PERSON } = await import('@/lib/heads/lauf');
    const kontakte = new Map([['c-a', k('a', { besitzer: 'beide' })]]);
    expect(fuerWen({ kontakt_id: 'c-a', chance_id: null, mandat_id: null, event_id: null } as never, 'sales', kontakte, crmLeer(), null)).toBe('beide');
    expect(fuerWen({ kontakt_id: 'c-a', chance_id: null, mandat_id: null, event_id: null } as never, 'sales', kontakte, crmLeer(), 'malin')).toBe('malin');
    expect([...NUR_MIT_PERSON].sort()).toEqual(['frage', 'power_hour']);
    expect(await headLauf({ head: 'sales', modus: 'power_hour', person: null, ausgeloest: 'takt' })).toMatchObject({ ok: false });
    expect(await headLauf({ head: 'sales', modus: 'wochenreview', person: null, ausgeloest: 'hand' })).toMatchObject({ ok: false });
  });
  it('Routen-Register: heads/[head] nennt den Systemlauf als Grund (Klasse haushalt, Tor imHaushaltOderSystemlauf)', () => {
    expect(quelle('lib/zugang/routen-register.ts')).toMatch(/'heads\/\[head\]': r\('GET,POST', 'haushalt', '[^']*Systemlauf des Takts/);
    expect(quelle('app/api/heads/[head]/route.ts')).toMatch(/imHaushaltOderSystemlauf\(req\)/);
  });
});


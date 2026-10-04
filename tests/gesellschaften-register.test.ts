// Gesellschafts-Register (04.10., UMBAU_ABEND_0410.md Abschnitt 8, Paket 3): Summenprüfung der Anteile, Vorgänger-Kette
// ohne Kreis, Rechte (Partner/Testkunde eines anderen Haushalts → 403, Cap-Table nie in der Absender-Antwort), Kompatibilität
// (alte Einträge ohne neue Felder lesbar; der Schreibweg des Online-Stands behält Register-Einträge und -Felder), Fristen im
// Kalender, Löschen/Archiv (Papierkorb, Verweise), offene Liste in CRM-Säuberer und Auswahl.
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import {
  anteile, vorgaengerKette, vorgaengerErlaubt, steckbriefAnwenden, haelt, strukturBaum, gesellschaftVerweise, verweiseSatz, vertragsStichtage,
  gesellschafterSaeubern, vertragSaeubern, eintragAktion, gesellschaftArchiv, registerAufraeumen, alleGesellschaften, centAus, registerEinheitenNamen,
  type RegisterGesellschaft, type Gesellschafter,
} from '@/lib/gesellschaften/modell';
import { fristen } from '@/lib/kalender/eintraege';
import { gesellschaftWahl } from '@/lib/crm/wahl';
import { finanzFirmaFuer, istGesellschaftId, istRegisterKennung } from '@/lib/einheiten';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-gesellschaften-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-gesellschaften';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const G1 = 'g-11111111-1111-4111-8111-111111111111';
const G2 = 'g-22222222-2222-4222-8222-222222222222';
const G3 = 'g-33333333-3333-4333-8333-333333333333';
const GS = (id: string, wer: Gesellschafter['wer'], nennbetragCent: number, x: Partial<Gesellschafter> = {}): Gesellschafter => ({ id: `gs-${id}-aaaa`, wer, nennbetragCent, einlage: 'nein', ...x });
const J = '2026-10-04T10:00:00.000Z';

describe('Cap-Table: Prozent aus Nennbeträgen, Summenprüfung', () => {
  it('drei gleiche Anteile ergeben genau 100,00 % (größter Rest)', () => {
    const a = anteile({ stammkapitalCent: 3_000_000, gesellschafter: [GS('a', { art: 'person', id: 'p-a' }, 1_000_000), GS('b', { art: 'person', id: 'p-b' }, 1_000_000), GS('c', { art: 'person', id: 'p-c' }, 1_000_000)] });
    expect(a.zeilen.map(z => z.prozent).sort()).toEqual([33.33, 33.33, 33.34]);
    expect(a.summeProzent).toBe(100);
    expect(a.passtZumStammkapital).toBe(true);
    expect(a.hinweis).toBeUndefined();
  });
  it('Summe ≠ Stammkapital → Hinweis in ganzen Sätzen; ausgeschiedene und Papierkorb zählen nicht', () => {
    const a = anteile({ stammkapitalCent: 2_500_000, gesellschafter: [GS('a', { art: 'gesellschaft', id: 'kdv' }, 2_000_000), GS('x', { art: 'person', id: 'p' }, 500_000, { ausgeschiedenAm: '2026-01-01' }), GS('y', { art: 'person', id: 'q' }, 500_000, { geloeschtAm: J })] });
    expect(a.summeCent).toBe(2_000_000);
    expect(a.zeilen).toHaveLength(1);
    expect(a.zeilen[0].prozent).toBe(100);
    expect(a.passtZumStammkapital).toBe(false);
    expect(a.abweichungCent).toBe(-500_000);
    expect(a.hinweis).toMatch(/es fehlen .*5\.000/);
  });
  it('ohne Stammkapital keine Aussage (null), ohne Gesellschafter 0 %', () => {
    expect(anteile({ gesellschafter: [GS('a', { art: 'gesellschaft', id: 'kdv' }, 100)] }).passtZumStammkapital).toBeNull();
    expect(anteile({}).summeProzent).toBe(0);
  });
  it('Beträge: „25.000“, „12.500,50“, „12.5“; Unlesbares ist ein Fehler, nie still 0', () => {
    expect(centAus('25.000')).toBe(2_500_000);
    expect(centAus('12.500,50')).toBe(1_250_050);
    expect(centAus('12.5')).toBe(1250);
    expect(centAus('zwölf')).toBe('fehler');
    expect(centAus('-5')).toBe('fehler');
    expect(centAus('')).toBeUndefined();
  });
  it('Gesellschafter: Pflicht „wer“ + Nennbetrag, nie die Gesellschaft selbst', () => {
    expect(gesellschafterSaeubern({ id: 'gs-neu-0001', wer: { art: 'gesellschaft', id: G1 }, nennbetragCent: '1.000', einlage: 'ja' }, G1).fehler[0].text).toMatch(/eigener Gesellschafter/);
    expect(gesellschafterSaeubern({ id: 'gs-neu-0001', nennbetragCent: '1.000', einlage: 'ja' }, G1).fehler.length).toBeGreaterThan(0);
    const ok = gesellschafterSaeubern({ id: 'gs-neu-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '25.000', einlage: 'teil', eingezahltCent: '12.500' }, G1);
    expect(ok.e).toMatchObject({ nennbetragCent: 2_500_000, eingezahltCent: 1_250_000, einlage: 'teil' });
  });
});

describe('Vorgänger-Kette ohne Kreis', () => {
  const alle: RegisterGesellschaft[] = [{ id: G1, name: 'Neu', vorgaengerId: G2 }, { id: G2, name: 'Alt', vorgaengerId: G3 }, { id: G3, name: 'Ganz alt' }];
  it('Kette von neu nach alt', () => { expect(vorgaengerKette(G1, alle)).toEqual([G2, G3]); });
  it('kein Kreis, nicht sich selbst', () => {
    expect(vorgaengerErlaubt(G3, G1, alle)).toBe(false); // G3 → G1 würde G1 → G2 → G3 → G1 schließen
    expect(vorgaengerErlaubt(G1, G1, alle)).toBe(false);
    expect(vorgaengerErlaubt(G3, 'kdv', alle)).toBe(true);
  });
  it('steckbriefAnwenden lehnt den Kreis mit Satz ab und lässt den Eintrag unverändert', () => {
    const r = steckbriefAnwenden(alle[2], { vorgaengerId: G1 }, alle);
    expect(r.fehler[0].text).toMatch(/Kreis/);
  });
  it('eine kaputte Kette (Kreis im Bestand) läuft nicht endlos', () => {
    expect(vorgaengerKette(G1, [{ id: G1, vorgaengerId: G2 }, { id: G2, vorgaengerId: G1 }])).toEqual([G2]);
  });
  it('die drei festen behalten ihren Namen aus lib/einheiten.ts', () => {
    expect(steckbriefAnwenden({ id: 'ug' }, { name: 'Anders' }, []).fehler[0].feld).toBe('name');
  });
});

describe('Beteiligungen abgeleitet, Struktur, Verweise', () => {
  const alle: RegisterGesellschaft[] = [
    { id: 'kdv', beteiligungen: [{ id: 'bt-fremd-0001', firmaId: 'f-fremd', anteilProzent: 10 }] },
    { id: G1, name: 'Tochter', stammkapitalCent: 2_500_000, gesellschafter: [GS('a', { art: 'gesellschaft', id: 'kdv' }, 2_500_000)] },
  ];
  it('„hält“ kommt aus den Gesellschafter-Einträgen der anderen', () => {
    expect(haelt('kdv', alle)).toEqual([{ an: G1, prozent: 100, nennbetragCent: 2_500_000 }]);
  });
  it('Baum: kdv oben, die Tochter darunter mit 100 %, die fremde Beteiligung am Ende', () => {
    const b = strukturBaum(alle);
    const kdv = b.find(k => k.id === 'kdv')!;
    expect(kdv.kinder.map(k => [k.id, k.prozent])).toEqual([[G1, 100]]);
    expect(kdv.fremde).toEqual([{ firmaId: 'f-fremd', anteilProzent: 10 }]);
    expect(b.some(k => k.id === G1)).toBe(false);
  });
  it('wechselseitige Beteiligung läuft nicht im Kreis', () => {
    const kreis: RegisterGesellschaft[] = [
      { id: G1, gesellschafter: [GS('a', { art: 'gesellschaft', id: G2 }, 100)] },
      { id: G2, gesellschafter: [GS('b', { art: 'gesellschaft', id: G1 }, 100)] },
    ];
    const b = strukturBaum(kreis);
    expect(b).toHaveLength(1);
    expect(b[0].kinder[0].kinder[0].schonGezeigt).toBe(true);
  });
  it('Verweise: Deals/Mandate/Produkte + Gesellschafter-Verweise, als Satz', () => {
    const v = gesellschaftVerweise('kdv', alle, { chancen: [{ gesellschaft: 'kdv' }, { gesellschaft: 'kdv' }], mandate: [{ gesellschaft: 'kdv' }], leistungen: [{ gesellschaft: 'kdv', geloeschtAm: J }] });
    expect(v).toMatchObject({ deals: 2, mandate: 1, produkte: 0, gesellschafter: 1 });
    expect(verweiseSatz(v)).toBe('Daran hängen 2 Deals, 1 Mandat und 1 Gesellschafter-Eintrag.');
  });
});

describe('Archiv und Papierkorb (eine Logik mit lib/eintraege/sicher.ts)', () => {
  it('Vertrag: archivieren = beendet, zurück = vorheriger Status; Gesellschafter: ausgeschieden', () => {
    const v = vertragSaeubern({ id: 'vt-test-0001', art: 'darlehen', titel: 'Darlehen', status: 'unterschrieben', parteien: [] }).e!;
    const a = eintragAktion('vertraege', v, 'archivieren', '2026-10-04', J);
    expect(a.status).toBe('beendet');
    expect(eintragAktion('vertraege', a, 'zurueckholen', '2026-10-04', J).status).toBe('unterschrieben');
    const g = eintragAktion('gesellschafter', GS('a', { art: 'person', id: 'p' }, 1), 'archivieren', '2026-10-04', J);
    expect(g.ausgeschiedenAm).toBe('2026-10-04');
    expect(eintragAktion('gesellschafter', g, 'loeschen', '2026-10-04', J).geloeschtAm).toBe(J);
  });
  it('Gesellschaft: ruhend/aufgelöst, Zurückholen stellt den alten Status her', () => {
    const a = gesellschaftArchiv({ id: G1, status: 'gruendung' }, 'archivieren', 'aufgeloest');
    expect(a.status).toBe('aufgeloest');
    expect(gesellschaftArchiv(a, 'zurueckholen').status).toBe('gruendung');
  });
  it('Morgenlauf: abgelaufene Listeneinträge weg, Gesellschaft mit Verweisen bleibt im Papierkorb', () => {
    const alt = '2026-08-01T00:00:00.000Z';
    const d: { gesellschaften: RegisterGesellschaft[] } = { gesellschaften: [
      { id: G1, geloeschtAm: alt },
      { id: G2, geloeschtAm: alt },
      { id: 'kdv', vertraege: [{ id: 'vt-alt-0001', art: 'sonstiges' as const, titel: 'x', parteien: [], status: 'entwurf' as const, geloeschtAm: alt }, { id: 'vt-neu-0001', art: 'sonstiges' as const, titel: 'y', parteien: [], status: 'entwurf' as const, geloeschtAm: J }] },
    ] };
    const r = registerAufraeumen(d, { mandate: [{ gesellschaft: G2 }] }, J);
    expect(r.n).toBe(2);
    expect(r.d!.gesellschaften.map(g => g.id)).toEqual([G2, 'kdv']);
    expect(r.d!.gesellschaften[1].vertraege!.map(v => v.id)).toEqual(['vt-neu-0001']);
  });
});

describe('Fristen im Kalender', () => {
  const alle: RegisterGesellschaft[] = [{ id: G1, name: 'Neu GmbH', vertraege: [
    { id: 'vt-gv-0001', art: 'gf-vertrag', titel: 'GF-Vertrag', parteien: [], status: 'unterschrieben', beginn: '2026-11-01', kuendigenBis: '2026-12-15', kuendigungsfrist: '6 Monate', fristen: [{ id: 'f-1', datum: '2027-03-01', text: 'Option ziehen' }] },
    { id: 'vt-alt-0002', art: 'darlehen', titel: 'Altes Darlehen', parteien: [], status: 'beendet', ende: '2026-11-10' },
  ] }];
  it('Stichtage laufender Verträge — beendete nicht', () => {
    const s = vertragsStichtage(alle);
    expect(s.map(x => x.tag)).toEqual(['2026-11-01', '2026-12-15', '2027-03-01']);
    expect(s.find(x => x.kuendigung)?.titel).toBe('Kündigen bis: GF-Vertrag');
  });
  it('fristen() macht daraus Business-Fristen mit Weg ins Register', () => {
    const f = fristen({ vertraege: vertragsStichtage(alle) }, '2026-10-01', '2027-01-01');
    expect(f.map(x => x.art)).toEqual(['vertrag', 'vertrag']);
    expect(f[0]).toMatchObject({ bereich: 'business', href: `/os/unternehmen?g=${G1}&r=vertraege` });
    expect(f[1].kuendigung).toBe(true);
  });
});

describe('Offene Liste: Kennungen, Auswahl, Finanzen nur Grunddaten', () => {
  it('Kennungen', () => {
    expect(istRegisterKennung(G1)).toBe(true);
    expect(istRegisterKennung('g-')).toBe(false);
    expect(istGesellschaftId('ug')).toBe(true);
    expect(istGesellschaftId('kemaris')).toBe(false);
  });
  it('Auswahl: feste + Register (ruhende nur, wenn gewählt) + offen', () => {
    const reg = [{ id: 'kdc', name: 'x' }, { id: G1, name: 'Neu GmbH' }, { id: G2, name: 'Ruht', status: 'ruhend' }];
    expect(gesellschaftWahl(reg).map(e => e.id)).toEqual(['kdc', 'kdv', 'ug', G1, 'offen']);
    expect(gesellschaftWahl(reg, G2).find(e => e.id === G2)?.hinweis).toBe('ruhend');
    expect(gesellschaftWahl(null, G3).find(e => e.id === G3)?.label).toMatch(/nicht im Register/);
    expect(gesellschaftWahl(null).map(e => e.id)).toEqual(['kdc', 'kdv', 'ug', 'offen']);
  });
  it('Rechnungen: Register-Gesellschaft → null (nie still kdc); offen bleibt kdc', () => {
    expect(finanzFirmaFuer(G1)).toBeNull();
    expect(finanzFirmaFuer('kdv')).toBe('kdv');
    expect(finanzFirmaFuer('offen')).toBe('kdc');
  });
  it('Planungs-Einheiten: nur aktive Register-Gesellschaften', () => {
    expect(registerEinheitenNamen({ gesellschaften: [{ id: G1, name: 'Neu GmbH' }, { id: G2, name: 'Ruht', status: 'ruhend' }, { id: G3, name: 'Weg', geloeschtAm: J }, { id: 'kdv' }] })).toEqual(['Neu GmbH']);
  });
});

describe('Server: Rechte, Kompatibilität, Kalender', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  let reg: Route, absender: Route, unterlagen: Pick<Route, 'GET' | 'POST'>;
  let db: typeof import('@/lib/store/local-db');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  const get = (p: string, q = '') => reg.GET(new Request(`http://test/api/gesellschaften${q}`, { headers: kopf(p) }));
  const patch = (p: string, body: unknown) => reg.PATCH(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf(p), body: JSON.stringify(body) }));
  const post = (p: string, body: unknown) => reg.POST(new Request('http://test/api/gesellschaften', { method: 'POST', headers: kopf(p), body: JSON.stringify(body) }));
  // Der Datensatz, wie ihn der Online-Stand (f0c5526) geschrieben hätte: nur Absender-Felder, keine neuen.
  const ALT = { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel UG (haftungsbeschränkt)', ort: 'Musterstadt', geaendert: '2026-09-30T08:00:00.000Z', geaendertVon: 'person-a' }] };

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', 'haus'), konto('k2', 'person-b', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('gesellschaften--haus', ALT);
    await db.saveJson('gesellschaften--kunde-haus', { gesellschaften: [{ id: G3, name: 'Fremde Holding', stammkapitalCent: 100 }] });
    reg = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
    absender = (await import('@/app/api/crm/gesellschaften/route')) as unknown as Route;
    unterlagen = (await import('@/app/api/gesellschaften/unterlagen/route')) as unknown as Route;
  });

  it('Testkunde und Partner (fremder Haushalt), Konto ohne Person, Dienstweg ohne Person: 403 — lesen, anlegen, ändern, Unterlagen', async () => {
    for (const p of ['testkunde', 'partner']) {
      expect((await get(p)).status).toBe(403);
      expect((await get(p, '?wahl=1')).status).toBe(403);
      expect((await get(p, '?suche=firmen&q=ab')).status).toBe(403);
      expect((await post(p, { felder: { name: 'Eindringling GmbH' } })).status).toBe(403);
      expect((await patch(p, { id: 'kdv', stand: 'x', felder: { sitz: 'X' } })).status).toBe(403);
      expect((await unterlagen.GET(new Request('http://test/api/gesellschaften/unterlagen?id=kdv', { headers: kopf(p) }))).status).toBe(403);
    }
    expect((await reg.GET(new Request('http://test/api/gesellschaften'))).status).toBe(403);
    expect((await reg.GET(new Request('http://test/api/gesellschaften', { headers: { 'x-make-key': 'pruef-schluessel-gesellschaften' } }))).status).toBe(403);
  });

  it('Sicht X bekommt nichts aus Y: der Haushalt sieht nur sein Register — nie die Gesellschaft eines anderen Haushalts', async () => {
    const r = await get('person-b');
    expect(r.status).toBe(200);
    const text = JSON.stringify(await r.json());
    expect(text).not.toContain(G3);
    expect(text).not.toContain('Fremde Holding');
  });

  it('Kompatibilität: alter Eintrag ohne neue Felder ist lesbar, die drei festen erscheinen immer', async () => {
    const d = await (await get('person-a')).json();
    expect(d.gesellschaften.map((g: { id: string }) => g.id)).toEqual(['kdc', 'kdv', 'ug']);
    const kdv = d.gesellschaften[1];
    expect(kdv.firmierung).toBe('Beispiel UG (haftungsbeschränkt)');
    expect(kdv.luecken).toContain('Rechtsform');
    expect(alleGesellschaften(ALT as never).length).toBe(3);
  });

  it('anlegen → Gesellschafter → Vorgänger → Vertrag; Absender-Antwort ohne Cap-Table; alter Schreibweg behält alles', async () => {
    const neu = await (await post('person-a', { anfrageId: 'anfrage-test-0001', felder: { name: 'Neue Beispiel GmbH', rechtsform: 'gmbh', status: 'gruendung', stammkapitalCent: '25.000' } })).json();
    expect(neu.ok).toBe(true);
    const id = neu.gesellschaft.id as string;
    expect(istRegisterKennung(id)).toBe(true);
    // dieselbe Anfrage noch einmal legt nichts doppelt an
    const nochmal = await (await post('person-a', { anfrageId: 'anfrage-test-0001', felder: { name: 'Neue Beispiel GmbH' } })).json();
    expect(nochmal.gesellschaft.id).toBe(id);

    let g = (await (await patch('person-a', { id, stand: neu.gesellschaft.stand, liste: 'gesellschafter', eintrag: { wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: '25.000', einlage: 'ja' } })).json()).gesellschaft;
    expect(g.gesellschafter).toHaveLength(1);
    // veralteter Stand → 409 mit aktuellem Eintrag
    const konflikt = await patch('person-a', { id, stand: neu.gesellschaft.stand, felder: { sitz: 'Musterstadt' } });
    expect(konflikt.status).toBe(409);
    const vorg = (await (await post('person-a', { felder: { name: 'Vorgänger Beispiel GmbH', status: 'eingetragen' } })).json()).gesellschaft;
    g = (await (await patch('person-a', { id, stand: g.stand, felder: { vorgaengerId: vorg.id } })).json()).gesellschaft;
    expect(g.vorgaengerId).toBe(vorg.id);
    // Kreis über den Server: Vorgänger soll aus dem Nachfolger hervorgehen → 400
    const kreis = await patch('person-a', { id: vorg.id, stand: vorg.stand, felder: { vorgaengerId: id } });
    expect(kreis.status).toBe(400);
    g = (await (await patch('person-a', { id, stand: g.stand, liste: 'vertraege', eintrag: { art: 'gesellschaftsvertrag', titel: 'Satzung', status: 'entwurf', parteien: [{ art: 'gesellschaft', id: 'kdv' }], kuendigenBis: '2026-12-15' } })).json()).gesellschaft;
    expect(g.vertraege).toHaveLength(1);

    // „hält“: kdv hält die neue zu 100 % — abgeleitet
    const d = await (await get('person-a')).json();
    const alle = d.gesellschaften as (RegisterGesellschaft & { stand: string })[];
    expect(haelt('kdv', alle)).toEqual([{ an: id, prozent: 100, nennbetragCent: 2_500_000 }]);
    expect(d.verweise ?? alle.find(x => x.id === 'kdv')).toBeTruthy();

    // Absender-Route: nur die drei festen, nie Cap-Table/Verträge
    const abs = await (await absender.GET(new Request('http://test/api/crm/gesellschaften', { headers: kopf('person-a') }))).json();
    expect(abs.gesellschaften.map((x: { id: string }) => x.id)).toEqual(['kdc', 'kdv', 'ug']);
    expect(JSON.stringify(abs)).not.toMatch(/gesellschafter|vertraege/);
    // Absender schreibt über dieselbe Stelle — der Register-Eintrag `g-…` bleibt erhalten
    const kdvAbs = abs.gesellschaften[1];
    const ap = await absender.PATCH(new Request('http://test/api/crm/gesellschaften', { method: 'PATCH', headers: kopf('person-a'), body: JSON.stringify({ id: 'kdv', stand: kdvAbs.stand, felder: { email: 'info@example.invalid' } }) }));
    expect(ap.status).toBe(200);
    const roh = await db.loadJson<{ gesellschaften: RegisterGesellschaft[] }>('gesellschaften--haus');
    expect(roh!.gesellschaften.find(x => x.id === id)?.gesellschafter).toHaveLength(1);
    expect(roh!.gesellschaften.find(x => x.id === 'kdv')?.email).toBe('info@example.invalid');

    // Rückweg: der Schreibweg des Online-Stands (`{ gesellschaften: [...l.filter(g => g.id !== id), { ...alt, … }] }`) behält Einträge und Felder
    const l = roh!.gesellschaften;
    const altNeu = { ...l.find(x => x.id === 'kdv')!, ort: 'Anderswo' };
    const nachAltemWeg = { gesellschaften: [...l.filter(x => x.id !== 'kdv'), altNeu] };
    expect(nachAltemWeg.gesellschaften.find(x => x.id === id)?.vertraege).toHaveLength(1);

    // Vertragsfrist erscheint in den Fristen des Kalenders (Haushalt des Inhabers)
    const { fristenLesen } = await import('@/lib/kalender/fristen-server');
    const f = await fristenLesen('2026-12-01', '2027-01-01', '2026-10-04');
    expect(f.some(x => x.art === 'vertrag' && x.tag === '2026-12-15' && x.titel === 'Kündigen bis: Satzung')).toBe(true);

    // Löschen: feste nie, eine mit Verweisen nur in den Papierkorb, endgültig erst ohne Verweise
    const fest = await patch('person-a', { id: 'kdv', stand: alle.find(x => x.id === 'kdv')!.stand, aktion: 'loeschen' });
    expect(fest.status).toBe(409);
    const g2 = alle.find(x => x.id === id) as RegisterGesellschaft & { stand: string };
    const imKorb = (await (await patch('person-a', { id, stand: g2.stand, aktion: 'loeschen' })).json()).gesellschaft;
    expect(imKorb.geloeschtAm).toBeTruthy();
    expect((await (await get('person-a', '?wahl=1')).json()).gesellschaften.some((x: { id: string }) => x.id === id)).toBe(false);
    const zurueck = (await (await patch('person-a', { id, stand: imKorb.stand, aktion: 'wiederherstellen' })).json()).gesellschaft;
    expect(zurueck.geloeschtAm).toBeUndefined();
    // Vorgänger hängt am Nachfolger (Verweis) → endgültig 409
    const v2 = (await (await get('person-a')).json()).gesellschaften.find((x: { id: string }) => x.id === vorg.id);
    const vKorb = (await (await patch('person-a', { id: vorg.id, stand: v2.stand, aktion: 'loeschen' })).json()).gesellschaft;
    const endg = await patch('person-a', { id: vorg.id, stand: vKorb.stand, aktion: 'endgueltig' });
    expect(endg.status).toBe(409);
    expect((await endg.json()).fehler).toMatch(/Nachfolger/);
  });

  it('ZOE liest das Register nur für den Haushalt des Inhabers (Testkunde/Partner: kein Zugang)', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const lauf = WERKZEUGE.gesellschaften_lesen.lauf;
    for (const p of ['testkunde', 'partner']) expect(await lauf({}, '', p)).toMatch(/^Kein Zugang/);
    expect(await lauf({}, '')).toMatch(/^Kein Zugang/);
    const t = await lauf({ name: 'Beispiel' }, '', 'person-b');
    expect(t).toContain('Neue Beispiel GmbH');
    expect(t).not.toContain('Fremde Holding');
  });
  it('CRM-Säuberer nimmt Register-Kennungen an (Deals/Mandate/Produkte), Unbekanntes wird „offen“', async () => {
    const { saeubern } = await import('@/lib/crm/speicher');
    const roh = (gesellschaft: string) => ({ id: 'l-1', name: 'Produkt', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat', basis: 'monat' }, lieferumfang: [], gesellschaft, status: 'entwurf' });
    expect(saeubern('leistungen', roh(G1), J, 'person-a')?.gesellschaft).toBe(G1);
    expect(saeubern('leistungen', roh('kemaris'), J, 'person-a')?.gesellschaft).toBe('offen');
    expect(saeubern('mandate', { id: 'm-1', kunde: 'Kunde', titel: 'Mandat', gesellschaft: G1, honorar: { betrag: 1, basis: 'monat' } }, J, 'person-a')?.gesellschaft).toBe(G1);
  });
});

// ─── Prozesse · Werkstatt — Feinschliff Runde 2 „Felder und Speichern“ (24.10., Bau-Test im Demo) ─────────────────────────────────────────────────────────
// 1a Ein Entwurf speichert auch unvollständige Felder (eine neue, leere Bedingung; ein falscher Wert) — über die Route, nach dem Neuladen ist alles da;
//    blockiert wird erst Veröffentlichen (mit Befund). Ungültige Form bleibt 400.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { definitionPruefen, sperrtSpeichern, sperrtVeroeffentlichen } from '@/lib/prozesse/definition-pruefen';
import { bedingungenAus } from '@/lib/prozesse/bedingung';
import { katalogEintrag, maskeSaeubern } from '@/lib/prozesse/baustein-katalog';
import type { ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-felder-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-felder';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

type K = ProzessKnoten<ProzessForm>;
type H = (r: Request, ctx?: unknown) => Promise<Response>;
const H_ = 'haus-felder';
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function werkstatt(person: string, body: Record<string, unknown>) {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m.POST(new Request('http://test/api/prozesse/werkstatt?space=business', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function lesen(person: string, id: string) {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m.GET(new Request(`http://test/api/prozesse/werkstatt?space=business&id=${id}`, { headers: sitzung(person) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H_ }), konto('k2', 'olaf', 'mitglied', { haushalt: H_ })], einladungen: [] });
});

// ── 1a: unvollständig ≠ ungültig ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('1a — ein Entwurf speichert auch Unvollständiges (rein)', () => {
  it('eine neue, leere Bedingung ist offen (nicht fehler); ein falscher Wert ist fehler mit nurWert; Unlesbares bleibt fehler', () => {
    const leer = bedingungenAus([{ feld: 'lead.status', op: 'gleich', wert: '' }], ['lead.status'], '„hat geantwortet?“');
    expect(leer.befunde).toEqual([{ stufe: 'offen', text: '„hat geantwortet?“ 1: Wert fehlt.' }]);
    expect(bedingungenAus([{ feld: 'lead.status', op: 'einer-von', wert: [] }], ['lead.status']).befunde[0].stufe).toBe('offen');
    expect(bedingungenAus([{ feld: 'deal.wert', op: 'gleich', wert: 'x' }], ['lead.status']).befunde[0].stufe).toBe('offen');
    const falsch = bedingungenAus([{ feld: 'lead.score', op: 'groesser', wert: 'viel' }], ['lead.score']).befunde[0];
    expect(falsch).toMatchObject({ stufe: 'fehler', nurWert: true });
    expect(sperrtSpeichern([falsch])).toBe(false);
    expect(sperrtVeroeffentlichen([falsch])).toBe(true);
    expect(bedingungenAus([{ feld: 'lead.status', op: 'kaputt', wert: 'a' }]).befunde[0]).toMatchObject({ stufe: 'fehler' });
    expect(sperrtSpeichern(bedingungenAus(['unlesbar']).befunde)).toBe(true);
  });
  it('Masken: Zahl außerhalb der Grenzen, halb getippter Platzhalter → rot, speichert trotzdem; zu lang bleibt gesperrt', () => {
    const mail = katalogEintrag('inbox.mail-entwurf')!;
    const halb = maskeSaeubern(mail, { an: 'fall.kontakt', betreff: 'Danke {{kontakt.vor', text: 'Hallo' }, { platzhalter: ['kontakt.vorname'] }).befunde;
    expect(halb.some(b => b.stufe === 'fehler' && b.nurWert && b.feld === 'betreff')).toBe(true);
    expect(sperrtSpeichern(halb)).toBe(false);
    const lang = maskeSaeubern(mail, { an: 'fall.kontakt', betreff: 'x'.repeat(100_000), text: 'Hallo' }).befunde;
    expect(sperrtSpeichern(lang)).toBe(true);
  });
});

describe('1a — Route: Entwurf mit leerer Bedingung wird gespeichert, Veröffentlichen lehnt ab', () => {
  let id = '', stand = '';
  const raute = (wert: string): K => ({
    id: fk(40), elternId: '', titel: 'hat geantwortet?', rang: 5, form: 'entscheidung', bahn: 'system',
    katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'lead.status', op: 'gleich', wert }] },
  });
  beforeAll(async () => {
    const a = await werkstatt('pia', { aktion: 'anlegen', titel: 'Bau-Test Lead-Eingang', bereich: 'marketing', fallArt: 'lead' });
    expect(a.status).toBe(200);
    id = a.j.eintrag.id; stand = a.j.stand;
  });
  it('speichert (200), Befund offen am Knoten; nach dem Neuladen stehen Name und Bedingung da', async () => {
    const alt = (await lesen('pia', id)).j.eintrag.entwurf.knoten as K[];
    const phase = alt.find(k => k.elternId && !k.form)!.id;
    const knoten = [...alt, { ...raute(''), elternId: phase }];
    const r = await werkstatt('pia', { aktion: 'entwurf', id, stand, knoten });
    expect(r.status, JSON.stringify(r.j.fehler)).toBe(200);
    stand = r.j.stand;
    expect((r.j.befunde as { stufe: string; text: string; knotenId?: string }[]).some(b => b.stufe === 'offen' && b.knotenId === fk(40) && /Wert fehlt/.test(b.text))).toBe(true);
    const g = await lesen('pia', id);
    const k = (g.j.eintrag.entwurf.knoten as K[]).find(x => x.id === fk(40))!;
    expect(k.titel).toBe('hat geantwortet?');
    expect(k.raute).toEqual({ art: 'regel', bedingungen: [{ feld: 'lead.status', op: 'gleich', wert: '' }] });
  });
  it('Veröffentlichen lehnt den unvollständigen Entwurf mit Befund ab (409)', async () => {
    const v = await werkstatt('pia', { aktion: 'veroeffentlichen', id, stand, name: 'Version 1' });
    expect(v.status).toBe(409);
    expect((v.j.befunde as { text: string }[]).some(b => /Wert fehlt/.test(b.text))).toBe(true);
  });
  it('ungültige Form bleibt 400 (Knoten ohne Titel) — nichts gespeichert', async () => {
    const alt = (await lesen('pia', id)).j.eintrag.entwurf.knoten as K[];
    const r = await werkstatt('pia', { aktion: 'entwurf', id, stand, knoten: [...alt, { id: fk(41), elternId: alt[1].id, titel: '', rang: 9, form: 'schritt' }] });
    expect(r.status).toBe(400);
  });
});

describe('1a — die Prüfung über eine ganze Definition', () => {
  it('Raute mit leerer Bedingung: speicherbar, nicht veröffentlichbar; Befund springt ins Feld „bedingungen“', () => {
    const d = definition([schritt(10, 'Raute', 1, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'deal.stufe', op: 'gleich', wert: '' }] } }),
      schritt(11, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })]);
    const b = definitionPruefen(d, {});
    expect(sperrtSpeichern(b)).toBe(false);
    expect(sperrtVeroeffentlichen(b)).toBe(true);
    expect(b.find(x => /Wert fehlt/.test(x.text))).toMatchObject({ stufe: 'offen', knotenId: fk(10), feld: 'bedingungen' });
  });
});

// ── 1b: beim Tippen übernehmen, „gespeichert“ erst ohne Getipptes ────────────────────────────────────────────────────────────────────────────────────

describe('1b — Eingaben beim Tippen übernehmen (rein, eigene Uhr)', () => {
  const uhr = () => {
    let jetzt = 0; const plan: { t: number; f: () => void; h: number }[] = []; let n = 0;
    return {
      setze: (f: () => void, ms: number) => { const h = ++n; plan.push({ t: jetzt + ms, f, h }); return h; },
      loesche: (h: unknown) => { const i = plan.findIndex(x => x.h === h); if (i >= 0) plan.splice(i, 1); },
      weiter: (ms: number) => { jetzt += ms; for (const x of plan.filter(y => y.t <= jetzt)) { plan.splice(plan.indexOf(x), 1); x.f(); } },
    };
  };
  it('übernimmt nach der Pause (entprellt), nicht bei jedem Tastendruck; meldet „offen“ bis dahin', async () => {
    const { eingabePuffer, TIPP_PAUSE_MS } = await import('@/lib/prozesse/eingabe-puffer');
    expect(TIPP_PAUSE_MS).toBeGreaterThanOrEqual(600);
    expect(TIPP_PAUSE_MS).toBeLessThanOrEqual(800);
    const u = uhr(); const raus: string[] = []; const offen: boolean[] = [];
    const p = eingabePuffer({ anfang: 'Danke für Ihr Interesse', uebernehmen: v => raus.push(v), onOffen: o => offen.push(o), uhr: u });
    p.tippe('Danke für Ihr Interesse!');
    u.weiter(300);
    p.tippe('Danke für Ihr Interesse!!');
    u.weiter(TIPP_PAUSE_MS - 1);
    expect(raus).toEqual([]);
    expect(p.offen()).toBe(true);
    u.weiter(1);
    expect(raus).toEqual(['Danke für Ihr Interesse!!']);
    expect(p.offen()).toBe(false);
    expect(offen).toEqual([true, false]);
  });
  it('Verlassen/Schließen/pagehide übernimmt sofort; ein Wert von außen ersetzt Getipptes nie', async () => {
    const { eingabePuffer } = await import('@/lib/prozesse/eingabe-puffer');
    const u = uhr(); const raus: string[] = [];
    const p = eingabePuffer({ anfang: 'a', uebernehmen: v => raus.push(v), uhr: u });
    p.tippe('ab');
    expect(p.vonAussen('x')).toBe('ab');
    expect(p.jetzt()).toBe(true);
    expect(raus).toEqual(['ab']);
    expect(p.jetzt()).toBe(false);
    expect(p.vonAussen('y')).toBe('y');
  });
  it('„gueltig“: ein leerer Name wird nie übernommen; ohne Uhr nur beim Verlassen', async () => {
    const { eingabePuffer } = await import('@/lib/prozesse/eingabe-puffer');
    const u = uhr(); const raus: string[] = [];
    const p = eingabePuffer({ anfang: 'Start', uebernehmen: v => raus.push(v), gueltig: v => !!v.trim(), uhr: u });
    p.tippe(''); u.weiter(5000);
    expect(raus).toEqual([]);
    const q = eingabePuffer({ anfang: 'a', uebernehmen: v => raus.push(v), ohneUhr: true, uhr: u });
    q.tippe('b'); u.weiter(5000);
    expect(raus).toEqual([]);
    q.jetzt();
    expect(raus).toEqual(['b']);
  });
  it('Kopf: solange ein Feld Getipptes hält, nie „gespeichert“; Fehler/Konflikt/offline gehen vor', async () => {
    const { speicherAnzeige } = await import('@/lib/prozesse/eingabe-puffer');
    expect(speicherAnzeige('gespeichert', 1)).toBe('tippt');
    expect(speicherAnzeige('gespeichert', 0)).toBe('gespeichert');
    expect(speicherAnzeige('speichert', 2)).toBe('tippt');
    expect(speicherAnzeige('fehler', 1)).toBe('fehler');
    expect(speicherAnzeige('konflikt', 1)).toBe('konflikt');
  });
});

// ── 2: Bedingungen über Kennungs-Felder — Auswahl statt Freitext ─────────────────────────────────────────────────────────────────────────────────────

describe('2 — Werte je Feld: Auswahl aus dem Bestand, alter Freitext wird erkannt (rein)', () => {
  it('Produkt, Stufe, Status, Zuständig, ja/nein haben Werte; echte Textfelder bleiben frei', async () => {
    const { feldWerte, wertLage, wertAusOption } = await import('@/lib/prozesse/feld-werte');
    const auswahl = { produkt: [{ id: 'l-demo-vertrieb', label: 'Vertriebsaufbau' }], 'pipeline-stufe': [{ id: 'angebot', label: 'Angebot' }], 'konto-person': [{ id: 'pia', label: 'Pia' }], gesellschaft: [{ id: 'ug', label: 'MAKE' }, { id: 'fall.gesellschaft', label: 'Gesellschaft des Falls' }] };
    expect(feldWerte('mandat.produkt', auswahl)).toEqual([{ id: 'l-demo-vertrieb', label: 'Vertriebsaufbau' }]);
    expect(feldWerte('deal.stufe', auswahl)?.map(o => o.id)).toEqual(['angebot']);
    expect(feldWerte('lead.status', auswahl)?.map(o => o.id)).toContain('qualifizierung');
    expect(feldWerte('lead.zustaendig', auswahl)?.map(o => o.id)).toEqual(['pia', 'beide']);
    expect(feldWerte('mandat.gesellschaft', auswahl)?.map(o => o.id)).toEqual(['ug']);
    expect(feldWerte('lead.sql-bereit', auswahl)?.map(o => o.label)).toEqual(['ja', 'nein']);
    expect(wertAusOption('lead.sql-bereit', 'true')).toBe(true);
    expect(feldWerte('ereignis.quelle', auswahl)).toBeNull();
    expect(feldWerte('deal.wert', auswahl)).toBeNull();
    // Alter Freitext „Vertriebsaufbau“ = genau ein Name → erkannt (nicht umgeschrieben); Kennung → gut; Unbekanntes → fremd.
    const o = feldWerte('mandat.produkt', auswahl)!;
    expect(wertLage('Vertriebsaufbau', o)).toMatchObject({ art: 'name', option: { id: 'l-demo-vertrieb' } });
    expect(wertLage('l-demo-vertrieb', o).art).toBe('kennung');
    expect(wertLage('Etwas anderes', o).art).toBe('fremd');
  });
  it('die Prüfung meldet einen Namen statt der Kennung als offen (Entwurf speichert, Veröffentlichen nicht) — nur, wenn die Liste bekannt ist', () => {
    const d = (wert: string) => definition([schritt(10, 'Passt das Produkt?', 1, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert }] } }),
      schritt(11, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { fallArt: 'mandat' });
    const kx = { auswahl: (q: string) => (q === 'produkt' ? ['l-demo-vertrieb'] : null) };
    const name = definitionPruefen(d('Vertriebsaufbau'), kx);
    expect(name.find(b => /steht nicht in der Liste/.test(b.text))).toMatchObject({ stufe: 'offen', knotenId: fk(10), feld: 'bedingungen' });
    expect(sperrtSpeichern(name)).toBe(false);
    expect(definitionPruefen(d('l-demo-vertrieb'), kx).some(b => /steht nicht in der Liste/.test(b.text))).toBe(false);
    expect(definitionPruefen(d('Vertriebsaufbau'), {}).some(b => /steht nicht in der Liste/.test(b.text))).toBe(false);
  });
});

describe('2 — Probelauf mit echtem Mandat: Produkt = Auswahl geht über „ja“', () => {
  const PZM = 'pz-00000000-0000-4000-8000-000000000201';
  const J2 = '2026-10-21T08:00:00.000Z';
  const def = (wert: string) => ({
    ...definition([
      schritt(10, 'Passt das Produkt?', 1, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert }] }, zweige: { nein: fk(20) } }),
      schritt(11, 'Vertrieb starten', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
      schritt(20, 'Anderes Produkt', 3, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
    ], { fallArt: 'mandat', bereich: 'fulfillment', laeuftAls: 'pia' }), id: PZM,
  });
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const produkt = (id: string, name: string, x: Record<string, unknown> = {}) => ({ id, name, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J2, ...x });
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-nord', vorname: 'Nora', nachname: 'Beispiel', email: 'nora@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
    await db.saveJson('crm', {
      ...leererBestand(),
      leistungen: [produkt('l-demo-vertrieb', 'Vertriebsaufbau'), produkt('l-demo-privat', 'Privates Coaching', { gesellschaft: 'kdc' }), produkt('l-demo-weg', 'Gelöschtes', { geloeschtAm: J2 })],
      mandate: [{ id: 'm-nord', kunde: 'Nordwerk Beispiel', kontaktIds: ['c-nord'], titel: 'Vertriebsaufbau Nordwerk', art: 'retainer', leistungId: 'l-demo-vertrieb', gesellschaft: 'ug', status: 'aktiv',
        start: '2026-10-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
        health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J2 }],
    });
    await db.saveJson('tasks', { tasks: [], projects: [] });
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    await db.saveJson(prozesseBestand(H_), { v: 1, prozesse: [{ id: PZM, entwurf: def('l-demo-vertrieb'), versionen: [], status: 'entwurf', angelegtAm: J2, angelegtVon: 'pia', entwurfAm: J2, entwurfVon: 'pia' }] });
  });
  it('Produkt als Kennung (Auswahl „Vertriebsaufbau“) → „ja“; derselbe Name als Freitext → „nein“ (darum die Auswahl)', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const ja = await S.probelauf({ prozessId: PZM, quelle: 'entwurf', fall: { art: 'mandat', id: 'm-nord' }, person: 'pia' });
    expect(ja.ok, JSON.stringify(ja)).toBe(true);
    if (!ja.ok) return;
    expect(ja.schritte.map(x => x.knotenId)).toContain(fk(11));
    expect(ja.schritte.map(x => x.knotenId)).not.toContain(fk(20));
    const db = await import('@/lib/store/local-db');
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    await db.saveJson(prozesseBestand(H_), { v: 1, prozesse: [{ id: PZM, entwurf: def('Vertriebsaufbau'), versionen: [], status: 'entwurf', angelegtAm: J2, angelegtVon: 'pia', entwurfAm: J2, entwurfVon: 'pia' }] });
    const nein = await S.probelauf({ prozessId: PZM, quelle: 'entwurf', fall: { art: 'mandat', id: 'm-nord' }, person: 'pia' });
    expect(nein.ok && nein.schritte.map(x => x.knotenId)).toContain(fk(20));
  });
  it('Sicht: die Auswahl „Produkt“ trägt nur Business-Produkte des Haushalts (kein Privat, kein Papierkorb) — fremder Haushalt bekommt nichts (403)', async () => {
    const { auswahlListen } = await import('@/lib/prozesse/werkstatt-server');
    const l = await auswahlListen(H_, 'pia');
    expect(l.produkt?.map(x => x.id)).toEqual(['l-demo-vertrieb']);
    expect(JSON.stringify(l)).not.toMatch(/Privates Coaching|Gelöschtes/);
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H_ }), konto('k2', 'olaf', 'mitglied', { haushalt: H_ }), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' })], einladungen: [] });
    const { GET } = await import('@/app/api/prozesse/katalog/route');
    const fremd = await GET(new Request('http://test/api/prozesse/katalog?auswahl=1&space=business', { headers: sitzung('gast') }));
    expect(fremd.status).toBe(403);
    expect(await fremd.text()).not.toContain('Vertriebsaufbau');
    const eigen = await GET(new Request('http://test/api/prozesse/katalog?auswahl=1&space=business', { headers: sitzung('pia') }));
    expect(eigen.status).toBe(200);
    expect(((await eigen.json()) as { auswahl: { produkt: { id: string }[] } }).auswahl.produkt.map(x => x.id)).toEqual(['l-demo-vertrieb']);
  });
});

// ── 3: Teilprozess — auch Entwürfe wählbar, „+ Teilprozess hier anlegen“ mit passendem Fall ──────────────────────────────────────────────────────────

describe('3 — Teilprozess: Entwürfe wählbar (Probelauf ja, scharf nein), neuer Teilprozess mit passendem Fall', () => {
  const ELTERN = 'pz-00000000-0000-4000-8000-000000000301';
  const KIND = 'pz-00000000-0000-4000-8000-000000000302';
  const ALT = 'pz-00000000-0000-4000-8000-000000000303';
  const J3 = '2026-10-21T08:00:00.000Z';
  const eltern = () => ({
    ...definition([
      schritt(30, 'Deals ohne Schritt holen', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 10 } }),
      schritt(31, 'Je Deal nachfassen', 2, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(30)}`, prozessId: KIND, hoechstens: 10 } }),
      schritt(32, 'Ende', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
    ], { fallArt: 'keiner', bereich: 'sales', laeuftAls: 'pia' }), id: ELTERN,
  });
  const kind = () => ({ ...definition([schritt(40, 'Nachfassen', 1), schritt(41, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { fallArt: 'deal', titel: 'Deal nachfassen' }), id: KIND });
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    const e = (id: string, def: ReturnType<typeof eltern>, status: string, versionen: number) => ({ id, entwurf: def, status, angelegtAm: J3, angelegtVon: 'pia', entwurfAm: J3, entwurfVon: 'pia',
      versionen: Array.from({ length: versionen }, (_, i) => ({ nr: i + 1, name: `v${i + 1}`, am: J3, von: 'pia', definition: def })) });
    await db.saveJson(prozesseBestand(H_), { v: 1, prozesse: [e(ELTERN, eltern(), 'probelauf', 1), e(KIND, kind(), 'entwurf', 0), e(ALT, { ...kind(), id: ALT, titel: 'Archiviert' }, 'archiviert', 1)] });
  });
  it('die Auswahl „Prozess“ zeigt auch Entwürfe (gekennzeichnet), nie Archiviertes', async () => {
    const { auswahlListen } = await import('@/lib/prozesse/werkstatt-server');
    const l = (await auswahlListen(H_, 'pia')).prozess ?? [];
    expect(l.find(x => x.id === KIND)).toMatchObject({ label: 'Deal nachfassen', hinweis: 'Entwurf — läuft erst nach dem Veröffentlichen' });
    expect(l.find(x => x.id === ELTERN)?.hinweis).toBeUndefined();
    expect(l.some(x => x.id === ALT)).toBe(false);
  });
  it('Probelauf des Entwurfs nimmt den Entwurfs-Teilprozess; die veröffentlichte Version nicht (Teilprozess fehlt)', async () => {
    const S = await import('@/lib/prozesse/lauf-server');
    const ent = await S.probelauf({ prozessId: ELTERN, quelle: 'entwurf', fall: 'beispiel', person: 'pia' });
    expect(ent.ok, JSON.stringify(ent)).toBe(true);
    const schleife = ent.ok ? ent.schritte.find(x => x.knotenId === fk(31)) : undefined;
    expect(schleife?.status).not.toBe('fehler');
    const ver = await S.probelauf({ prozessId: ELTERN, quelle: 'version', fall: 'beispiel', person: 'pia' });
    expect(ver.ok && ver.schritte.find(x => x.knotenId === fk(31))?.status).toBe('fehler');
  });
  it('Veröffentlichen mit Entwurfs-Teilprozess: klarer Befund (offen) am Knoten', async () => {
    const { pruefKontextFuer } = await import('@/lib/prozesse/werkstatt-server');
    const kx = await pruefKontextFuer(H_, 'pia');
    const b = definitionPruefen(eltern(), kx).find(x => x.knotenId === fk(31) && /noch ein Entwurf/.test(x.text));
    expect(b).toMatchObject({ stufe: 'offen', feld: 'prozessId' });
    expect(b!.text).toContain('erst „Deal nachfassen“ veröffentlichen');
  });
  it('„+ Teilprozess hier anlegen“: Schleife je Deal → Fall Deal; sonst der Fall des Elternprozesses', async () => {
    const { teilprozessFall, teilprozessTitel } = await import('@/lib/prozesse/teilprozess-neu');
    const d = eltern();
    expect(teilprozessFall(d, d.knoten.find(k => k.id === fk(31))!)).toBe('deal');
    expect(teilprozessFall({ ...d, fallArt: 'mandat' }, { id: fk(50), titel: 'Aufruf', rang: 1, form: 'teilprozess' })).toBe('mandat');
    expect(teilprozessTitel({ titel: 'Je Deal nachfassen' })).toBe('Je Deal nachfassen — Teilprozess');
    expect(teilprozessTitel({ titel: 'x'.repeat(200) }).length).toBeLessThanOrEqual(120);
  });
});

// ── 4/5: Zeitplan-Tage nach dem Rhythmus; die Kurzzeile je Knoten zeigt die Einstellung ───────────────────────────────────────────────────────────────

describe('4 — Zeitplan: wöchentlich Mo–So, monatlich 1–30 + „letzter Tag“', () => {
  it('Tage je Rhythmus (dieselbe Regel wie der Takt)', async () => {
    const { tageOptionen, WOCHENTAGE, MONATSTAGE, LETZTER_TAG } = await import('@/lib/prozesse/zeitplan-tage');
    expect(tageOptionen('woechentlich')?.map(t => t.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(tageOptionen('woechentlich')).toBe(WOCHENTAGE);
    expect(tageOptionen('monatlich')).toBe(MONATSTAGE);
    expect(MONATSTAGE.at(-1)).toEqual({ id: String(LETZTER_TAG), label: 'letzter Tag' });
    expect(tageOptionen('taeglich')).toBeNull();
    expect(tageOptionen('werktags')).toBeNull();
    // Der Takt: 31 läuft am letzten Tag eines kürzeren Monats (lib/agenten/zeitplan.ts) — deshalb heißt sie „letzter Tag“.
    const { slotsAmTag } = await import('@/lib/agenten/zeitplan');
    expect(slotsAmTag({ art: 'wiederkehrend', rhythmus: 'monatlich', uhrzeit: '08:00', tage: [LETZTER_TAG] }, '2027-02-28')).toEqual(['2027-02-28T08:00:00']);
    expect(slotsAmTag({ art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1] }, '2026-10-26')).toEqual(['2026-10-26T08:00:00']);
  });
  it('die Prüfung nimmt Wochentage nur bei „wöchentlich“ (1–7)', async () => {
    const { ausloeserAus } = await import('@/lib/prozesse/ausloeser');
    expect(ausloeserAus({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1, 3] }, 'keiner').befunde).toEqual([]);
    expect(ausloeserAus({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [15] }, 'keiner').befunde[0].stufe).toBe('offen');
  });
});

describe('5 — Kurzzeile je Knoten (Fläche, Liste, Handy)', () => {
  it('Ereignis mit Namen, Zeitplan mit Tagen, Warten mit Dauer, Mail mit Betreff (gekürzt)', async () => {
    const { knotenUnterzeile } = await import('@/lib/prozesse/werkstatt-maske');
    const k = (x: Partial<K>): K => ({ id: fk(60), titel: 'Schritt', rang: 1, ...x });
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'ereignis', ereignis: 'neuer-lead' } }))).toBe('neuer Lead');
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'ereignis', ereignis: 'neuer-lead', bedingungen: [{ feld: 'lead.status', op: 'gleich', wert: 'neu' }] } }))).toBe('neuer Lead · nur wenn …');
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1] } }))).toBe('montags 08:00');
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '09:30', tage: [1, 3, 5] } }))).toBe('Mo, Mi, Fr 09:30');
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'zeitplan', rhythmus: 'monatlich', uhrzeit: '08:00', tage: [31] } }))).toBe('am letzten Tag 08:00');
    expect(knotenUnterzeile(k({ form: 'ausloeser', ausloeser: { art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '07:30' } }))).toBe('werktags 07:30');
    expect(knotenUnterzeile(k({ form: 'warten', warten: { art: 'dauer', tage: 3 } }))).toBe('3 Tage');
    expect(knotenUnterzeile(k({ form: 'warten', warten: { art: 'dauer', tage: 0, stunden: 4, arbeitszeit: true } }))).toBe('4 h Arbeitszeit');
    expect(knotenUnterzeile(k({ form: 'warten', warten: { art: 'ereignis', ereignis: 'antwort-gesendet', hoechstensTage: 0, hoechstensStunden: 4 } }))).toBe('auf „Antwort gesendet“ · höchstens 4 h');
    const mail = k({ form: 'nachricht', titel: 'Danke-Mail', katalog: { id: 'inbox.mail-entwurf', werte: { betreff: 'Danke für Ihr Interesse an unserem Angebot' } } });
    expect(knotenUnterzeile(mail, { mitSchloss: true })).toBe('„Danke für Ihr Interesse an…“ · Stapel');
    expect(knotenUnterzeile(k({ form: 'nachricht', titel: 'Mail', katalog: { id: 'inbox.mail-entwurf' } }), { mitSchloss: true })).toBe('Mail-Entwurf · Stapel');
  });
  it('die Liste (Landkarte) trägt dieselbe Kurzzeile je Schritt', async () => {
    const { prozessAusWerkstatt } = await import('@/lib/prozesse/werkstatt-landkarte');
    const { prozessAlsListe } = await import('@/lib/prozesse/modell');
    const d = definition([schritt(70, 'Warten', 1, { form: 'warten', warten: { art: 'dauer', tage: 3 } }), schritt(71, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })]);
    const p = prozessAusWerkstatt({ id: d.id, entwurf: d, versionen: [], status: 'entwurf', angelegtAm: '', angelegtVon: '', entwurfAm: '', entwurfVon: '' })!;
    expect(p.phasen[0].schritte.find(s => s.id === fk(70))?.was).toBe('3 Tage');
    const l = prozessAlsListe(p);
    expect(l.kinder[0].kinder.find(s => s.pfad.s === fk(70))?.text).toBe('3 Tage');
  });
});

// ── 6: Felder und Begriffe — „hat geantwortet“, Filter je Abfrage, Test mit Namen und Treffern ───────────────────────────────────────────────────────

describe('6 — „hat geantwortet (seit dem Start)“ und Filter je CRM-Abfrage', () => {
  it('„hat geantwortet“: nur die Aktivität „antwort“ seit dem Start; ein ja/nein-Feld im Lead-Fall', async () => {
    const { geantwortetSeit } = await import('@/lib/prozesse/kundengewinnung/fall-felder-server');
    const { FALL_FELDER, feldTitelVon } = await import('@/lib/prozesse/ausloeser');
    const { feldWerte } = await import('@/lib/prozesse/feld-werte');
    const k = (art: string, am: string) => ({ id: 'c-x', vorname: 'X', stufe: 'kontakt', aktivitaeten: [{ art, am, text: '' }] }) as never;
    expect(geantwortetSeit([k('antwort', '2026-10-22T09:00:00Z')], '2026-10-21T08:00:00Z')).toBe(true);
    expect(geantwortetSeit([k('antwort', '2026-10-20T09:00:00Z')], '2026-10-21T08:00:00Z')).toBe(false);
    expect(geantwortetSeit([k('mail', '2026-10-22T09:00:00Z')], '2026-10-21T08:00:00Z')).toBe(false);
    expect(FALL_FELDER.lead.some(f => f.id === 'lead.geantwortet')).toBe(true);
    expect(feldTitelVon('lead.geantwortet')).toBe('Hat geantwortet (seit dem Start)');
    expect(feldWerte('lead.geantwortet', {})?.map(o => o.label)).toEqual(['ja', 'nein']);
  });
  it('Filter je Abfrage: Lead-Filter nur bei Leads, Deal-Filter (Stufe, nur meine, Wert ab) nur bei Deals, Tage nur, wo gelesen', async () => {
    const { katalogEintrag, feldSichtbar } = await import('@/lib/prozesse/baustein-katalog');
    const m = katalogEintrag('crm.abfragen')!.maske;
    const sicht = (art: string) => m.filter(f => feldSichtbar(f, { art })).map(f => f.id);
    expect(sicht('deals-ohne-schritt')).toEqual(['art', 'stufe', 'nurMeine', 'wertAb', 'hoechstens']);
    expect(sicht('leads')).toEqual(['art', 'status', 'temperatur', 'bean', 'lifecycle', 'hoechstens']);
    expect(sicht('neue-leads')).toContain('tage');
  });
  it('der Motor liest die Deal-Filter (ohne sie wie bisher)', async () => {
    const { abfrageFaelle } = await import('@/lib/prozesse/kundengewinnung/abfrage');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const deal = (id: string, stufe: string, besitzer: string, betrag: number) => ({ id, titel: id, kontaktIds: [], stufe, historie: [], wert: { betrag, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer, angelegt: J, geaendert: J });
    const crm = { ...leererBestand(), chancen: [deal('ch-a', 'angebot', 'pia', 5000), deal('ch-b', 'bedarf', 'olaf', 800), deal('ch-c', 'diagnose', 'beide', 2000)] } as never;
    const d = { crm, kontakte: [], leads: [], heute: '2026-10-24', person: 'pia', fall: { art: 'keiner' as const }, business: () => true };
    const ids = (q: Record<string, unknown>) => abfrageFaelle({ art: 'deals-ohne-schritt', hoechstens: 10, ...q } as never, d).map(f => f.id);
    expect(ids({})).toEqual(['ch-a', 'ch-b', 'ch-c']);
    expect(ids({ stufe: ['angebot'] })).toEqual(['ch-a']);
    expect(ids({ nurMeine: true })).toEqual(['ch-a', 'ch-c']);
    expect(ids({ wertAb: 1000 })).toEqual(['ch-a', 'ch-c']);
    expect(abfrageFaelle({ art: 'deals-ohne-schritt', hoechstens: 10, nurMeine: true } as never, { ...d, person: null }).length).toBe(0);
  });
  it('„Schritt testen“ an der Abfrage: Name statt Technik-Kennung und die Treffer (nur gelesen)', async () => {
    const db = await import('@/lib/store/local-db');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    const PZA = 'pz-00000000-0000-4000-8000-000000000601';
    await db.saveJson('crm', { ...leererBestand(), chancen: [{ id: 'ch-ohne', titel: 'Ohne Schritt', kontaktIds: [], stufe: 'bedarf', historie: [], wert: { betrag: 900, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J },
      { id: 'ch-mit', titel: 'Mit Schritt', kontaktIds: [], stufe: 'bedarf', historie: [], wert: { betrag: 900, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J, naechsterSchritt: { text: 'Anrufen', datum: '2026-10-30' } }] });
    const def = { ...definition([schritt(80, 'Deals ohne Schritt', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 10 } }), schritt(81, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { fallArt: 'keiner', laeuftAls: 'pia' }), id: PZA };
    await db.saveJson(prozesseBestand(H_), { v: 1, prozesse: [{ id: PZA, entwurf: def, versionen: [], status: 'entwurf', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia' }] });
    const S = await import('@/lib/prozesse/lauf-server');
    const r = await S.probelauf({ prozessId: PZA, quelle: 'entwurf', fall: 'beispiel', person: 'pia', nur: fk(80), ausgabe: true });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const z = r.schritte[0].ausgabe!.zeilen.map(x => `${x.feld}: ${x.wert}`).join('\n');
    expect(z).toContain('Was: Deals ohne nächsten Schritt');
    expect(z).toContain('Treffer jetzt (nur gelesen): 1 Deal');
    expect(z).not.toContain('Ohne Schritt');
  });
});

// ── 7: Zuständig ohne Person — Befund schon beim Bauen ─────────────────────────────────────────────────────────────────────────────────────────────

describe('7 — Rolle ohne Person: gelber Befund am Knoten (mit und ohne Fall), sperrt das Veröffentlichen nicht', () => {
  const aufgabe = (wer: string) => schritt(90, 'Aufgabe anlegen', 1, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Anrufen', wer, fristTage: 2 } } });
  const ende = schritt(91, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } });
  const rolle = (bs: ReturnType<typeof definitionPruefen>) => bs.filter(b => b.knotenId === fk(90) && b.feld === 'wer' && b.warnung);
  it('ohne Fall und ohne Eigner: „Zuständig im Fall“ → Befund mit Satz und Weg; nicht sperrend', () => {
    const b = definitionPruefen(definition([aufgabe('rolle:zustaendig'), ende], { fallArt: 'keiner' }), {});
    expect(rolle(b)).toHaveLength(1);
    expect(rolle(b)[0]).toMatchObject({ stufe: 'hinweis', warnung: true });
    expect(rolle(b)[0].text).toMatch(/ohne Fall nimmt der Lauf den Eigner; der Prozess hat noch keinen Eigner\. Im Steckbrief einen Eigner mit Konto wählen/);
    expect(sperrtVeroeffentlichen(rolle(b))).toBe(false);
  });
  it('mit Fall (Lead) ohne Eigner: Befund „hat der Fall keine Zuständige …“; „Eigner des Prozesses“ ebenso', () => {
    const z = rolle(definitionPruefen(definition([aufgabe('rolle:zustaendig'), ende], { fallArt: 'lead' }), {}));
    expect(z[0].text).toMatch(/hat der Fall keine Zuständige/);
    const e = rolle(definitionPruefen(definition([aufgabe('rolle:eigner'), ende], { fallArt: 'lead' }), {}));
    expect(e[0].text).toMatch(/„Eigner des Prozesses“ — der Prozess hat noch keinen Eigner/);
  });
  it('Eigner mit Konto → kein Befund; Eigner ohne Konto → Befund „kein Konto“; eine feste Person → nie', () => {
    const team = [{ id: 'konto-pia', aktiv: true, speicher: 'pia' }, { id: 't-ohne', aktiv: true }];
    const mit = definitionPruefen(definition([aufgabe('rolle:zustaendig'), ende], { fallArt: 'keiner', eigner: 'konto-pia' }), { team, konten: ['pia'] });
    expect(rolle(mit)).toHaveLength(0);
    const ohne = definitionPruefen(definition([aufgabe('rolle:zustaendig'), ende], { fallArt: 'keiner', eigner: 't-ohne' }), { team, konten: ['pia'] });
    expect(rolle(ohne)[0].text).toMatch(/kein Konto/);
    expect(rolle(definitionPruefen(definition([aufgabe('konto-pia'), ende], { fallArt: 'keiner' }), {}))).toHaveLength(0);
  });
});

// ── 8/9: Ansicht beim Bauen und Handy ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('8 — Ansicht beim Bauen', () => {
  it('eine schwebende Hinweis-Karte unter der Kopfzeile zählt als Rand oben („Alles zeigen“ legt nichts darunter)', async () => {
    const { raenderAus, SCHWEBE_NAEHE } = await import('@/lib/einpassen');
    const { HINWEIS_NAEHE, HINWEIS_SELEKTOR } = await import('@/components/os/ui/flaeche/schwebe');
    const buehne = { x: 0, y: 0, b: 1440, h: 1000 };
    const karte = { x: 432, y: 143, b: 620, h: 144 };
    expect(raenderAus(buehne, [karte]).oben).toBe(0); // so lag die Karte bisher über den Knoten
    expect(HINWEIS_NAEHE).toBeGreaterThan(SCHWEBE_NAEHE);
    expect(raenderAus(buehne, [karte], { naehe: HINWEIS_NAEHE }).oben).toBeGreaterThanOrEqual(143 + 144);
    expect(HINWEIS_SELEKTOR).toBe('.pw-hinweis-karte');
  });
  it('Doppelklick, Esc und Probelauf sind verdrahtet (Quelltext)', async () => {
    const { readFileSync } = await import('node:fs');
    const flaeche = readFileSync('components/os/prozesse/WerkstattFlaeche.tsx', 'utf8');
    expect(flaeche).toMatch(/elementFromPoint\(e\.clientX, e\.clientY\)[\s\S]{0,200}data-ws-knoten[\s\S]{0,120}p\.onDoppel/);
    expect(flaeche).toMatch(/Math\.min\(b\.x, 0\)/);
    const w = readFileSync('components/os/prozesse/Werkstatt.tsx', 'utf8');
    expect(w).toMatch(/case 'abbrechen':\s*\/\/[^\n]*\n\s*if \(gross\) \{ setGross\(null\)/);
    expect(w).toMatch(/setPanelZu\(n => n \+ 1\);\s*requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => allesZeigenRef\.current\(\)\)\)/);
    expect(w).toMatch(/neuesSchloss[\s\S]{0,120}zeigeNeu\.current = neuesSchloss\.id/);
  });
});

describe('9 — Handy: eindeutige Felder, Bestätigung, Mail mit Platzhaltern', () => {
  it('„Name des Schritts“ und „Titel der Aufgabe“ — nie zweimal „Titel“; die Mail ist eine Vorlage (Platzhalter + Vorschau)', async () => {
    const { werkstattMobilFelder, paketMobilFelder } = await import('@/lib/prozesse/mobil-felder');
    const aufgabe = werkstattMobilFelder({ id: fk(95), titel: 'Rückruf', rang: 1, form: 'schritt', katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Zurückrufen' } } });
    const labels = aufgabe.map(f => f.label);
    expect(labels).toContain('Name des Schritts');
    expect(labels).toContain('Titel der Aufgabe');
    expect(labels.filter(l => l === 'Titel')).toHaveLength(0);
    const mail = werkstattMobilFelder({ id: fk(96), titel: 'Danke', rang: 1, form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { betreff: 'Danke {{kontakt.vorname}}' } } });
    expect(mail.find(f => f.id === 'werte.betreff')?.art).toBe('vorlage');
    expect(paketMobilFelder({ titel: 'Kick-off' }, 'schritt')[0].label).toBe('Name des Schritts');
    const { readFileSync } = await import('node:fs');
    const m = readFileSync('components/os/prozesse/MobilBearbeiten.tsx', 'utf8');
    expect(m).toContain("f.art === 'vorlage'");
    expect(m).toContain('<VorlageEingabe');
    expect(readFileSync('components/os/prozesse/Werkstatt.tsx', 'utf8')).toMatch(/ist gespeichert — als Entwurf/);
  });
});

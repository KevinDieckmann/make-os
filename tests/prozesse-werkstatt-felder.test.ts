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
import { definition, fk, schritt, konto } from './fixtures/prozess-bau';

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

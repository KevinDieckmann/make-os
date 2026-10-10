// ─── Produkte · Leistungstreppe — Routen, Report, Senden mit Anhang, Morgenlauf, Stapel, Altbestand (10.10.) ──────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), Firmen und Produkte — nie der echte Bestand, nie ein echter Mail-Server
// (PostSpeicher als nachgebauter Anbieter), nie ein Modell (ohne KI-Schlüssel). Geprüft wird:
//   · Zugang: Haushalt des Inhabers (anderer Haushalt/ohne Person 403), Konto „nur Business“ darf, `?space=privat` → 400, Dienstweg schreibt nie
//   · Schreiben mit Stand (409), Grenzen (413); Lesen schreibt nie (kein Bestand nach GET — keine Migration beim Lesen/Start)
//   · Report: PDF am Mandat abgelegt (Dateiablage), Mail-Vorlage Du nach der Akte; Versand NUR über /api/inbox/senden mit Anhang (multipart)
//   · Morgenlauf: Report-Vorschlag + Glocke einmal (idempotent), nächste Stufe einmal; Freigabe im Stapel erzeugt den Report bzw. ein Follow-up
//   · Dokument → Vorschlag: ohne KI 409 `ohneKi`; im Stapel nur die angehakten Teile, nur die hochladende Person
//   · Altbestand: Produkte/Mandate ohne die neuen Felder werden gleich gelesen und bleiben nach dem Schreiben eines neuen Felds vollständig
//   · Anschlüsse: Kreislauf der Markttraktion-Planung zeigt den Fortschritt, der Head of Sales bekommt Treppe + Positionierung im Paket
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate' }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-treppe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-treppe';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM = JSON.stringify([{ id: 'pa', name: 'Anna', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'pb', name: 'Bert', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
delete process.env.ANTHROPIC_API_KEY;

const D = 'example.invalid';
type Mod = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let treppe: Mod, report: Mod, dokument: Mod, stapel: Mod, senden: Mod, postfaecher: Mod, planung: Mod;
let db: typeof import('@/lib/store/local-db');
const kopf = (person?: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...extra });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, d: await r.clone().json().catch(() => ({})) as Record<string, any>, r });
const GET = (m: Mod, url: string, person?: string) => m.GET!(new Request(`http://test${url}`, { headers: kopf(person) })).then(j);
const POST = (m: Mod, url: string, body: unknown, person?: string, extra: Record<string, string> = {}) => m.POST!(new Request(`http://test${url}`, { method: 'POST', headers: kopf(person, extra), body: JSON.stringify(body) })).then(j);
const PATCH = (ops: unknown, person?: string, extra: Record<string, string> = {}) => treppe.PATCH!(new Request('http://test/api/crm/treppe', { method: 'PATCH', headers: kopf(person, extra), body: JSON.stringify({ ops }) })).then(j);
const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plus = (n: number) => { const d = new Date(`${heute()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const LEISTUNG = { id: 'l-analyse', name: 'Erfundene Analyse', typ: 'diagnose', stufe: 'einstieg', preis: { betrag: 2000, einheit: 'pauschal netto' }, lieferumfang: ['Bericht'], gesellschaft: 'ug', status: 'aktiv', phasen: [{ id: 'p1', name: 'Start', dauerTage: 5 }, { id: 'p2', name: 'Abschluss', beschreibung: 'Ergebnis vorstellen' }], geaendert: '2026-09-01T00:00:00.000Z' };
const MANDAT = {
  id: 'm-pruef', kunde: 'Beispiel Werke GmbH', firmaId: 'f-beispiel', kontaktIds: ['c-erika'], titel: 'Erfundene Analyse', art: 'workshop', leistungId: 'l-analyse', gesellschaft: 'ug', status: 'aktiv',
  vertragUnterschrieben: true, start: plus(-30), verlaengerung: 'manuell', honorar: { betrag: 2000, basis: 'einmalig', netto: true }, ustSatz: 19, rechnungsrhythmus: 'einmalig', zahlungszielTage: 14,
  ziele: [{ id: 'z1', text: 'Durchlaufzeit', ziel: '5 Tage', ist: '9 Tage' }], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: 80 }, leistungen: [], offen: [], phase: 'p1', zustaendig: 'pa', geaendert: '2026-09-01T00:00:00.000Z',
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  treppe = await import('@/app/api/crm/treppe/route') as Mod; report = await import('@/app/api/crm/treppe/report/route') as Mod; dokument = await import('@/app/api/crm/treppe/dokument/route') as Mod;
  stapel = await import('@/app/api/zoe/stapel/route') as Mod; senden = await import('@/app/api/inbox/senden/route') as Mod; postfaecher = await import('@/app/api/inbox/postfaecher/route') as Mod;
  planung = await import('@/app/api/crm/planung/route') as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: `pa@${D}`, name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', teilt: { gesundheit: [] } },
    { id: '2', speicher: 'pb', email: `pb@${D}`, name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business', teilt: { gesundheit: [] } },
    { id: '3', speicher: 'px', email: `px@${D}`, name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-erika', vorname: 'Erika', nachname: 'Erfunden', email: `erika@kunde.${D}`, anrede: 'Du', stufe: 'gespraech', importiertAm: '2026-09-01', geaendertAm: '2026-09-01', firmaId: 'f-beispiel', firma: 'Beispiel Werke GmbH', aktivitaeten: [] },
  ] });
  await db.saveJson('crm', { firmen: [{ id: 'f-beispiel', name: 'Beispiel Werke GmbH', geaendert: '2026-09-01T00:00:00.000Z' }], chancen: [], mandate: [MANDAT], leistungen: [LEISTUNG], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] });
});
afterAll(async () => {
  (await import('@/lib/postfach/transport')).transportSetzen(null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Altbestand bleibt — nur optionale Felder kommen dazu', () => {
  it('Produkt ohne die neuen Phasen-Felder wird gleich gelesen und bleibt nach dem Schreiben eines neuen Felds vollständig', async () => {
    const { ladeCrm, aendereCrm } = await import('@/lib/crm/speicher');
    const vorher = (await ladeCrm()).leistungen.find(l => l.id === 'l-analyse')!;
    expect(vorher.phasen).toEqual(LEISTUNG.phasen);
    expect(vorher).toMatchObject({ name: LEISTUNG.name, preis: LEISTUNG.preis, lieferumfang: LEISTUNG.lieferumfang, status: 'aktiv' });
    const mVorher = (await ladeCrm()).mandate.find(m => m.id === 'm-pruef')!;
    await aendereCrm(b => ({ ...b, leistungen: b.leistungen.map(l => (l.id === 'l-analyse' ? { ...l, phasen: (l.phasen ?? []).map((p, i) => (i === 0 ? { ...p, ziel: 'Klarheit über den Engpass', ergebnis: 'Befund', kennzahl: 'Durchlaufzeit', aufwandStunden: 6 } : p)) } : l)) }), { art: 'person', person: 'pa' });
    const nachher = (await ladeCrm()).leistungen.find(l => l.id === 'l-analyse')!;
    const ohneStempel = <T extends { geaendert?: unknown; geaendertVon?: unknown }>(x: T) => { const { geaendert: _g, geaendertVon: _v, ...r } = x; return r; };
    expect(ohneStempel(nachher)).toEqual({ ...ohneStempel(vorher), phasen: [{ ...LEISTUNG.phasen[0], ziel: 'Klarheit über den Engpass', ergebnis: 'Befund', kennzahl: 'Durchlaufzeit', aufwandStunden: 6 }, LEISTUNG.phasen[1]] });
    expect(ohneStempel((await ladeCrm()).mandate.find(m => m.id === 'm-pruef')!)).toEqual(ohneStempel(mVorher));
  });
});

describe('Leistungstreppe — wer darf', () => {
  it('ohne Person / anderer Haushalt: 403 — nie unsere Daten; Konto „nur Business“ darf; Sicht Privat → 400; Lesen schreibt nichts', async () => {
    expect((await GET(treppe, '/api/crm/treppe')).status).toBe(403);
    const fremd = await GET(treppe, '/api/crm/treppe', 'px');
    expect(fremd.status).toBe(403);
    expect(JSON.stringify(fremd.d)).not.toContain('Beispiel');
    expect((await PATCH([{ op: 'vorlage' }], 'px')).status).toBe(403);
    const b = await GET(treppe, '/api/crm/treppe', 'pb');
    expect(b.status).toBe(200);
    expect(b.d.datei.stufen).toEqual([]);
    expect((await GET(treppe, '/api/crm/treppe?space=privat', 'pa')).status).toBe(400);
    expect(await db.loadJson('produkt-treppe--h-pruef')).toBeNull();
  });
  it('Dienstweg schreibt nie (403)', async () => {
    expect((await PATCH([{ op: 'vorlage' }], 'pa', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' })).status).toBe(403);
  });
});

let stufen: { id: string; stand: string; name: string }[] = [];
describe('Leistungstreppe — schreiben und rechnen', () => {
  it('Stufen anlegen; das Mandat steht über sein Produkt in der Stufe; veralteter Stand → 409; zu viele Schritte → 413', async () => {
    const r = await PATCH([
      { op: 'stufe', eintrag: { id: 'ts-pruef-eins', name: 'Erstgespräch', ebene: 1, preis: { art: 'kostenlos' } } },
      { op: 'stufe', eintrag: { id: 'ts-pruef-zwei', name: 'Analyse', ebene: 2, preis: { art: 'fest', betrag: 2000 }, leistungIds: ['l-analyse'], lieferobjekte: ['Befund', 'Fahrplan'], kennzahl: 'Durchlaufzeit in Tagen', ziel: { kunden: 4 } } },
      { op: 'stufe', eintrag: { id: 'ts-pruef-drei', name: 'Begleitung', ebene: 3, preis: { art: 'monat', betrag: 3000 }, aufwandStunden: 20, regeln: { maxGleichzeitig: 3 } } },
      { op: 'positionierung', felder: { claim: 'Erfundener Claim', zielgruppe: 'Erfundene Zielgruppe' }, stand: (await GET(treppe, '/api/crm/treppe', 'pa')).d.datei.positionierungStand },
    ], 'pa');
    expect(r.status).toBe(200);
    stufen = r.d.datei.stufen;
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(lage.kunden).toHaveLength(1);
    expect(lage.kunden[0]).toMatchObject({ mandatId: 'm-pruef', stufe: { id: 'ts-pruef-zwei' }, stufeQuelle: 'produkt', schritt: { nr: 1, von: 2, name: 'Start' }, report: { faellig: true } });
    expect(lage.zielbild.zeilen.find((z: { stufeId: string }) => z.stufeId === 'ts-pruef-zwei').ist.kunden).toBe(1);
    const alt = stufen.find(s => s.id === 'ts-pruef-zwei')!.stand;
    expect((await PATCH([{ op: 'stufe', eintrag: { id: 'ts-pruef-zwei', dauerTage: 60 }, stand: alt }], 'pb')).status).toBe(200);
    const k = await PATCH([{ op: 'stufe', eintrag: { id: 'ts-pruef-zwei', dauerTage: 30 }, stand: alt }], 'pa');
    expect(k.status).toBe(409);
    expect(k.d.konflikte).toEqual([{ op: 0, id: 'ts-pruef-zwei' }]);
    expect(k.d.datei.stufen.find((s: { id: string }) => s.id === 'ts-pruef-zwei').dauerTage).toBe(60);
    expect((await PATCH(Array.from({ length: 61 }, () => ({ op: 'zieljahr', jahr: 2026 })), 'pa')).status).toBe(413);
  });
});

let dateiId = '';
describe('Fortschritts-Report', () => {
  it('erstellen: PDF am Mandat abgelegt, Mail-Vorlage per Du aus der Akte — verschickt nichts', async () => {
    const r = await POST(report, '/api/crm/treppe/report', { aktion: 'erstellen', mandatId: 'm-pruef' }, 'pa');
    expect(r.status).toBe(200);
    dateiId = r.d.datei.id;
    expect(dateiId).toMatch(/^d-/);
    expect(r.d.an).toEqual({ email: `erika@kunde.${D}`, name: 'Erika Erfunden' });
    expect(r.d.text.startsWith('Hey Erika,')).toBe(true);
    expect(r.d.anrede).toBe('Du');
    const pdf = await report.GET!(new Request(`http://test/api/crm/treppe/report?datei=${dateiId}`, { headers: kopf('pb') }));
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const ablage = await db.loadJson<{ eintraege: { id: string; mandatId?: string; art: string }[] }>('crm-dateien--h-pruef');
    expect(ablage!.eintraege.find(e => e.id === dateiId)).toMatchObject({ mandatId: 'm-pruef', art: 'sonstig' });
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(lage.kunden[0].report).toMatchObject({ dateiId, erstelltAm: heute() });
  });
  it('Zugang: Dienstweg 403, anderer Haushalt 403, unbekanntes Mandat 404, fremde Datei als Report 404', async () => {
    expect((await POST(report, '/api/crm/treppe/report', { aktion: 'erstellen', mandatId: 'm-pruef' }, 'pa', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' })).status).toBe(403);
    expect((await POST(report, '/api/crm/treppe/report', { aktion: 'entwurf', mandatId: 'm-pruef' }, 'px')).status).toBe(403);
    expect((await POST(report, '/api/crm/treppe/report', { aktion: 'entwurf', mandatId: 'm-gibtsnicht' }, 'pa')).status).toBe(404);
    expect((await GET(report, '/api/crm/treppe/report?datei=d-gibtsnicht', 'pa')).status).toBe(404);
  });
  it('Anhänge nur aus der eigenen Ablage: fremder Haushalt 403, unbekannt 404, zu viele 413', async () => {
    const { anhaengeLaden } = await import('@/lib/inbox/anhaenge-server');
    const a = await anhaengeLaden('pa', [{ datei: dateiId }]);
    expect(a).toHaveLength(1);
    expect(a[0].typ).toBe('application/pdf');
    await expect(anhaengeLaden('px', [{ datei: dateiId }])).rejects.toMatchObject({ status: 403 });
    await expect(anhaengeLaden('pa', [{ datei: 'd-gibtsnicht' }])).rejects.toMatchObject({ status: 404 });
    await expect(anhaengeLaden('pa', Array.from({ length: 4 }, (_, i) => ({ datei: `d-x${i}xxx` })))).rejects.toMatchObject({ status: 413 });
    await expect(anhaengeLaden('pa', [{ datei: '../etc' }])).rejects.toMatchObject({ status: 400 });
  });
  it('Senden NUR per Klick über die Inbox: aus dem Business-Postfach, PDF hängt an (multipart), danach als gesendet vermerkt', async () => {
    const T = await import('@/lib/postfach/transport');
    const P = await import('@/lib/postfach/post-speicher');
    const adresse = `pa.ug@firma.${D}`;
    const server: PS = new P.PostSpeicher({ passwort: 'pruef-passwort-ug', ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendet' }] });
    T.transportSetzen({ imap: z => server.sitzung(z), smtp: (z, u, roh) => server.senden(z, u, roh), waechter: async () => ({ stop: async () => {} }) });
    const echtesFetch = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error('kein Netz im Test'); }) as typeof fetch;
    try {
      const pf = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse, passwort: 'pruef-passwort-ug', bereich: 'ug', anzeigename: 'Firma' }, 'pa');
      expect(pf.status, JSON.stringify(pf.d)).toBe(200);
      const business = await GET(postfaecher, '/api/inbox/postfaecher?space=business', 'pa');
      expect(business.d.postfaecher.map((p: { id: string }) => p.id)).toContain(pf.d.id);
      const s = await POST(senden, '/api/inbox/senden', { neu: { postfach: pf.d.id, betreff: 'Fortschritt' }, an: [{ email: `erika@kunde.${D}` }], text: 'Hey Erika, hier der Stand.', anhaenge: [{ datei: dateiId }] }, 'pa');
      expect(s.status, JSON.stringify(s.d)).toBe(200);
      const roh = server.gesendet[server.gesendet.length - 1].roh.toString('utf8');
      expect(roh).toContain('multipart/mixed');
      expect(roh).toMatch(/filename\*=UTF-8''Fortschritt-Beispiel-Werke-GmbH-\d{4}-\d{2}-\d{2}\.pdf/);
      expect(roh).toContain('Content-Type: application/pdf');
      // Fremde Datei-Kennung → nichts gesendet.
      const vorher = server.gesendet.length;
      expect((await POST(senden, '/api/inbox/senden', { neu: { postfach: pf.d.id, betreff: 'x' }, an: [{ email: `erika@kunde.${D}` }], text: 'x', anhaenge: [{ datei: 'd-gibtsnicht' }] }, 'pa')).status).toBe(404);
      expect(server.gesendet.length).toBe(vorher);
    } finally { globalThis.fetch = echtesFetch; }
    expect((await PATCH([{ op: 'report-gesendet', mandatId: 'm-pruef' }], 'pa')).status).toBe(200);
    expect((await GET(treppe, '/api/crm/treppe', 'pa')).d.kunden[0].report).toMatchObject({ gesendetAm: heute(), faellig: false });
  });
});

describe('Morgenlauf und Freigabe-Stapel', () => {
  it('Report-Vorschlag + Glocke einmal (idempotent); Freigabe erstellt den Report — verschickt nichts', async () => {
    // Report-Stand zurück auf „vor drei Wochen“, damit er fällig ist.
    await db.updateJson<Record<string, unknown>>('produkt-treppe--h-pruef', cur => ({ ...cur, reports: { 'm-pruef': { gesendetAm: plus(-21) } } }));
    const { treppeMorgenlauf } = await import('@/lib/crm/treppe-server');
    expect(await treppeMorgenlauf()).toMatchObject({ reports: 1 });
    expect(await treppeMorgenlauf()).toMatchObject({ reports: 0 });
    const { lies } = await import('@/lib/zoe/stapel');
    const v = (await lies('offen')).find(x => x.bezug?.art === 'produkte' && x.werkzeug === 'fortschritt_report')!;
    expect(v).toMatchObject({ person: 'pa', gruppe: 'kunden', bereich: 'business' });
    const glocke = await db.loadJson<{ eintraege: { art: string; titel: string }[] }>('meldungen--pa');
    expect(glocke?.eintraege.some(m => m.art === 'produkte' && !m.titel.includes('Beispiel'))).toBe(true);
    // Eine andere Person gibt den Vorschlag einer Person nicht frei.
    expect((await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' }, 'pb')).status).not.toBe(200);
    const f = await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' }, 'pa');
    expect(f.status, JSON.stringify(f.d)).toBe(200);
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(lage.kunden[0].report.erstelltAm).toBe(heute());
    expect(lage.kunden[0].report.dateiId).not.toBe(dateiId);
  });
  it('nächste Stufe: einmal je erreichter Stufe vorgeschlagen; Freigabe legt ein Follow-up am Mandat an (idempotent)', async () => {
    await PATCH([{ op: 'lieferobjekt', mandatId: 'm-pruef', was: 'Befund', erledigt: true }, { op: 'lieferobjekt', mandatId: 'm-pruef', was: 'Fahrplan', erledigt: true }], 'pa');
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(lage.kunden[0].naechsteStufe).toMatchObject({ grund: 'alle Lieferobjekte erledigt', stufen: [{ id: 'ts-pruef-drei' }] });
    const { treppeMorgenlauf } = await import('@/lib/crm/treppe-server');
    expect(await treppeMorgenlauf()).toMatchObject({ stufen: 1 });
    expect(await treppeMorgenlauf()).toMatchObject({ stufen: 0 });
    const { lies } = await import('@/lib/zoe/stapel');
    const v = (await lies('offen')).find(x => x.bezug?.art === 'produkte' && x.werkzeug === 'naechste_stufe')!;
    expect(v.anlass).toMatch(/^Head of Sales: /);
    expect((await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben' }, 'pa')).status).toBe(200);
    const crm = await db.loadJson<{ followups: { id: string; bezug: { art: string; id: string }; text: string; kontaktId?: string }[] }>('crm');
    const fu = crm!.followups.filter(x => x.id.startsWith('fu-ts-'));
    expect(fu).toHaveLength(1);
    expect(fu[0]).toMatchObject({ bezug: { art: 'mandat', id: 'm-pruef' }, kontaktId: 'c-erika', text: 'Nächste Stufe „Begleitung“ anbieten' });
  });
  it('Dokument: ohne KI 409 `ohneKi` (nichts gelesen, nichts gespeichert); Vorschlag nur angehakte Teile, nur die hochladende Person', async () => {
    const form = new FormData();
    form.append('datei', new File(['# Erfunden\n\nStufe A, Stufe B'], 'treppe.md', { type: 'text/markdown' }));
    const r = await dokument.POST!(new Request('http://test/api/crm/treppe/dokument', { method: 'POST', headers: { 'x-make-user': 'pa' }, body: form }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ohneKi: true });
    const { dokumentVorschlagAblegen } = await import('@/lib/crm/treppe-server');
    const v = await dokumentVorschlagAblegen('pa', { stufen: [{ name: 'Erfundener Check', ebene: 1, preis: { art: 'kostenlos' } }, { name: 'Erfundenes Paket', ebene: 2, preis: { art: 'monat', betrag: 1000 } }], kreislauf: [], positionierung: { versprechen: 'Erfundenes Versprechen' } }, 'treppe.md');
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    const vv = lage.vorschlaege.find((x: { id: string }) => x.id === v.id);
    expect(vv.vorschlag.stufen).toHaveLength(2);
    expect((await GET(treppe, '/api/crm/treppe', 'pb')).d.vorschlaege).toEqual([]);
    expect((await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben', eingabe: { auswahl: ['stufe:1', 'pos:versprechen'] } }, 'pb')).status).not.toBe(200);
    const f = await POST(stapel, '/api/zoe/stapel', { id: v.id, entscheidung: 'freigeben', stand: vv.stand, eingabe: { auswahl: ['stufe:1', 'pos:versprechen'] } }, 'pa');
    expect(f.status, JSON.stringify(f.d)).toBe(200);
    const nach = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(nach.datei.stufen.map((s: { name: string }) => s.name)).toEqual(['Erstgespräch', 'Analyse', 'Begleitung', 'Erfundenes Paket']);
    expect(nach.datei.positionierung).toMatchObject({ claim: 'Erfundener Claim', versprechen: 'Erfundenes Versprechen' });
  });
});

describe('Anschlüsse', () => {
  it('Kreislauf der Markttraktion-Planung zeigt den Fortschritt im Paket', async () => {
    const r = await GET(planung, '/api/crm/planung', 'pa');
    expect(r.status).toBe(200);
    const k = r.d.kreislauf.kunden.find((x: { mandatId: string }) => x.mandatId === 'm-pruef');
    expect(k).toMatchObject({ paket: 'Analyse', lieferungen: '2/2', naechsteStufe: 'Begleitung' });
    expect(r.d.kreislauf.stufen.find((s: { id: string }) => s.id === 'fulfillment').zusatz).toContain('1 im Paket');
  });
  it('Head of Sales: Treppe und Positionierung im Datenpaket — ohne Kunden, als Daten', async () => {
    const { treppeFuerHead } = await import('@/lib/crm/treppe-server');
    const t = await treppeFuerHead();
    expect(t).toMatchObject({ positionierung: { claim: 'Erfundener Claim' } });
    expect(JSON.stringify(t)).not.toContain('Beispiel Werke');
    const { kontextHeadFuer } = await import('@/lib/agenten/kontext-head');
    expect(kontextHeadFuer('/os/mandate', '?s=produkte', 'business')).toBe('sales');
    expect(kontextHeadFuer('/os/mandate', '', 'business')).toBe('kundenerfolg');
  });
  it('die Ansichten rendern mit der echten Antwort (kein Absturz)', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { Kundenreise, Zielbild, Roadmap, PositionierungKarte } = await import('@/components/os/mandate/treppe/Teile');
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    const api = { lage, laedt: false, fehler: null, hinweis: null, setHinweis: () => {}, schreibe: async () => true, neuLaden: async () => {} };
    for (const C of [Kundenreise, Zielbild, Roadmap, PositionierungKarte]) expect(renderToStaticMarkup(createElement(C as never, { api, lage } as never)).length).toBeGreaterThan(50);
  });
});

describe('„+ Mandat“ immer mit Lead (Firma + Ansprechperson) und „Firma zuordnen“', () => {
  let lead: Mod;
  const ALT = { ...MANDAT, id: 'm-alt-ohne-firma', kunde: 'Altkunde ohne Firma', kontaktIds: [], status: 'beendet', ziele: [], quelle: 'Altbestand' };
  beforeAll(async () => {
    lead = await import('@/app/api/crm/lead/route') as Mod;
    const { firmaId: _f, leistungId: _l, ...alt } = ALT;
    await db.updateJson<{ mandate: unknown[] }>('crm', cur => ({ ...cur!, mandate: [...cur!.mandate, alt] }));
    await db.updateJson<{ kontakte: unknown[] }>('kontakte', cur => ({ ...cur!, kontakte: [...cur!.kontakte, { id: 'c-gesperrt', vorname: 'Gesa', nachname: 'Gesperrt', email: `gesa@kunde.${D}`, stufe: 'neu', importiertAm: '2026-09-01', geaendertAm: '2026-09-01', aktivitaeten: [], eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18 (Prüfung)', von: 'pa' } }] }));
  });
  const neu = (body: Record<string, unknown>, person = 'pa', extra: Record<string, string> = {}) => POST(lead, '/api/crm/lead', { aktion: 'mandat-neu', gesellschaft: 'ug', ...body }, person, extra);
  const crmJetzt = async () => (await import('@/lib/crm/speicher')).ladeCrm();

  it('vorhandene Firma + vorhandene Person: Mandat mit Firma, Firma/Lead → Kunde, Person → Lebensphase Kunde', async () => {
    const r = await neu({ firma: { id: 'f-beispiel' }, person: { id: 'c-erika' }, titel: 'Zweites Mandat (Prüfung)' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const crm = await crmJetzt();
    const m = crm.mandate.find(x => x.id === r.d.mandatId)!;
    expect(m).toMatchObject({ firmaId: 'f-beispiel', kunde: 'Beispiel Werke GmbH', kontaktIds: ['c-erika'], status: 'aktiv', gesellschaft: 'ug', titel: 'Zweites Mandat (Prüfung)' });
    expect(crm.firmen.find(f => f.id === 'f-beispiel')).toMatchObject({ rolle: 'kunde', lead: { status: 'kunde' } });
    const k = (await db.loadJson<{ kontakte: { id: string; lebensphase?: string }[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-erika');
    expect(k?.lebensphase).toBe('kunde');
  });
  it('neue Firma + neue Person: genau eine Firma (auch bei anderer Schreibweise), Person bei der Firma; Dublette → 409, nichts geschrieben', async () => {
    const r = await neu({ firma: { name: 'Erfundene Neukunde GmbH' }, person: { neu: { vorname: 'Nora', nachname: 'Neu', email: `nora@neukunde.${D}`, anrede: 'Du' } }, stufeId: 'ts-pruef-zwei', leistungId: 'l-analyse' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect(r.d).toMatchObject({ firmaNeu: true, personNeu: true });
    const crm = await crmJetzt();
    expect(crm.firmen.filter(f => f.name.startsWith('Erfundene Neukunde'))).toHaveLength(1);
    const kontakte = (await db.loadJson<{ kontakte: { id: string; email?: string; firmaId?: string; lebensphase?: string; anrede?: string }[] }>('kontakte'))!.kontakte;
    expect(kontakte.find(x => x.id === r.d.kontaktId)).toMatchObject({ email: `nora@neukunde.${D}`, firmaId: r.d.firmaId, lebensphase: 'kunde', anrede: 'Du' });
    expect(crm.mandate.find(x => x.id === r.d.mandatId)).toMatchObject({ leistungId: 'l-analyse', honorar: { betrag: 2000 } });
    // Aus der Stufe heraus: der Fortschritt steht gleich in dieser Stufe.
    const lage = (await GET(treppe, '/api/crm/treppe', 'pa')).d;
    expect(lage.kunden.find((z: { mandatId: string }) => z.mandatId === r.d.mandatId)).toMatchObject({ stufe: { id: 'ts-pruef-zwei' }, stufeQuelle: 'hand' });
    // Zweites Mal: Firma per Name (ohne Rechtsform) → dieselbe Firma; Person mit derselben Mail → 409 Dublette, NICHTS geschrieben.
    const mandateVorher = (await crmJetzt()).mandate.length;
    const d = await neu({ firma: { name: 'Erfundene Neukunde' }, person: { neu: { vorname: 'Nora', nachname: 'Neu', email: `nora@neukunde.${D}` } } });
    expect(d.status).toBe(409);
    expect(d.d.dublette).toMatchObject({ id: r.d.kontaktId });
    expect((await crmJetzt()).mandate.length).toBe(mandateVorher);
    const ok2 = await neu({ firma: { name: 'Erfundene Neukunde' }, person: { id: d.d.dublette.id } });
    expect(ok2.status).toBe(200);
    expect(ok2.d.firmaId).toBe(r.d.firmaId);
    expect((await crmJetzt()).firmen.filter(f => f.name.startsWith('Erfundene Neukunde'))).toHaveLength(1);
  });
  it('Art. 18: eine eingeschränkte Person wird abgelehnt (vorhanden oder als „neu“ eingegeben) — keine Firma, kein Mandat', async () => {
    const vorher = (await crmJetzt()).mandate.length;
    const a = await neu({ firma: { name: 'Erfundene Sperrfirma GmbH' }, person: { id: 'c-gesperrt' } });
    expect(a.status).toBe(409);
    expect(a.d.eingeschraenkt).toBe(true);
    const b = await neu({ firma: { name: 'Erfundene Sperrfirma GmbH' }, person: { neu: { vorname: 'Gesa', nachname: 'Gesperrt', email: `gesa@kunde.${D}` } } });
    expect(b.status).toBe(409);
    const crm = await crmJetzt();
    expect(crm.mandate.length).toBe(vorher);
    expect(crm.firmen.some(f => f.name.startsWith('Erfundene Sperrfirma'))).toBe(false);
  });
  it('ohne Person, ohne Firma, unbekannte Gesellschaft → 400; Dienstweg → 403; anderer Haushalt → 403', async () => {
    expect((await neu({ firma: { id: 'f-beispiel' } })).status).toBe(400);
    expect((await neu({ person: { id: 'c-erika' } })).status).toBe(400);
    expect((await neu({ firma: { id: 'f-beispiel' }, person: { id: 'c-erika' }, gesellschaft: 'unsinn' })).status).toBe(400);
    expect((await neu({ firma: { id: 'f-beispiel' }, person: { id: 'c-erika' } }, 'pa', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' })).status).toBe(403);
    expect((await neu({ firma: { id: 'f-beispiel' }, person: { id: 'c-erika' } }, 'px')).status).toBe(403);
  });
  it('Altbestand ohne Firma bleibt lesbar und unverändert; „Firma zuordnen“ nur auf Klick — danach Firma am Mandat, sonst alles wie vorher', async () => {
    const vorher = (await crmJetzt()).mandate.find(m => m.id === ALT.id)!;
    expect(vorher.firmaId).toBeUndefined();
    expect(vorher).toMatchObject({ kunde: 'Altkunde ohne Firma', status: 'beendet', quelle: 'Altbestand' });
    const r = await POST(lead, '/api/crm/lead', { aktion: 'mandat-firma', mandatId: ALT.id, firma: { name: 'Erfundene Altfirma GmbH' } }, 'pa');
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const nachher = (await crmJetzt()).mandate.find(m => m.id === ALT.id)!;
    const { geaendert: _a, geaendertVon: _b, kunde: _k, firmaId, ...rest } = nachher;
    const { geaendert: _c, geaendertVon: _d, kunde: _l, ...restVorher } = vorher;
    expect(rest).toEqual(restVorher);
    expect(firmaId).toBe(r.d.firmaId);
    expect(nachher.kunde).toBe('Erfundene Altfirma GmbH');
    expect((await POST(lead, '/api/crm/lead', { aktion: 'mandat-firma', mandatId: ALT.id, firma: { name: 'Noch eine GmbH' } }, 'pa')).status).toBe(409);
  });
});

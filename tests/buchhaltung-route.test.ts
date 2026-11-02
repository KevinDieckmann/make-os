// ─── Buchhaltung — Routen: Arbeitsliste (PATCH teil), Regeln, Paket, Export, Rechte (02.11.) ────────────────────────────────────────────
// Wächter „Sicht Business bekommt nichts aus Privat“ (GET/PATCH/Regeln/Paket/Export), Dienstweg 403, fremder Haushalt 403, Stand → 409,
// Paket: Vorschau schreibt nichts, Übernehmen idempotent, Hand gewinnt, fremde Gesellschaft 403, Grenze 413. Eigener Datenordner, erfundene Werte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-buchhaltung-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-buchhaltung';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

import { testIban } from './fixtures/kontoauszug';
import { PAKET_ART, PAKET_EINTRAEGE_MAX } from '@/lib/finanzen/buchhaltung/paket';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person?: string, body?: unknown, methode = body ? 'POST' : 'GET', kopf: Record<string, string> = {}) => new Request(`http://test${url}`, {
  method: methode, headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...kopf }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const DIENST = { 'x-make-key': 'pruef-schluessel-buchhaltung', 'x-make-person': 'pa' };

const IBAN_UG = testIban('37040044', '532013000');
const IBAN_PRIVAT = testIban('10010010', '123456789');

let db: typeof import('@/lib/store/local-db');
let konten: Route, bh: Route, exp: Route, buchungen: Route;
interface Zeile { id: string; ort?: string; kategorie: string; betrag: number; wer: string; stand?: string; kategorieHand?: boolean; notiz?: string; pruefung?: { status: string; vorschlag?: string; geprueftVon?: string; geprueftAm?: string } }

const SAAT = [
  { id: 'bu-t-1', datum: '2026-10-05', wer: 'Software Beispiel GmbH', betrag: -49.9, kategorie: 'Sonstiges', zweck: 'Abo Oktober', konto: 'Geschäftskonto MAKE', ort: 'ug' },
  { id: 'bu-t-2', datum: '2026-10-06', wer: 'Laden Beispiel', betrag: -30, kategorie: 'Büro', kategorieHand: true, konto: 'Geschäftskonto MAKE', ort: 'ug' },
  { id: 'bu-t-3', datum: '2026-10-07', wer: 'Eigenes Konto', betrag: -100, kategorie: 'Umbuchung', konto: 'Geschäftskonto MAKE', ort: 'ug' },
  { id: 'bu-t-4', datum: '2026-10-08', wer: 'Supermarkt Beispiel', betrag: -12.34, kategorie: 'Lebensmittel', konto: 'Girokonto Anna', ort: 'privat' },
  { id: 'bu-t-5', datum: '2026-09-30', wer: '=Formel Beispiel', betrag: 1200, kategorie: 'Erlöse', zweck: 'Rechnung 1', konto: 'Geschäftskonto MAKE', ort: 'ug' },
];
const alle = async () => ((await db.loadJson<{ buchungen: Zeile[] }>('buchungen'))?.buchungen ?? []);
const holen = async (person: string, sicht?: string) => {
  const r = await buchungen.GET!(anfrage(`/api/state/buchungen${sicht ? `?sicht=${sicht}` : ''}`, person));
  return { status: r.status, j: await r.json() as { buchungen: Zeile[] } };
};
const patch = async (person: string, ops: unknown[], kopf: Record<string, string> = {}) => {
  const r = await buchungen.PATCH!(anfrage('/api/state/buchungen', person, { ops }, 'PATCH', kopf));
  return { status: r.status, j: await r.json() as Record<string, unknown> };
};
const bhGet = async (person?: string, kopf: Record<string, string> = {}) => { const r = await bh.GET!(anfrage('/api/finanzen/buchhaltung', person, undefined, 'GET', kopf)); return { status: r.status, j: await r.json() as Record<string, unknown> }; };
const bhPost = async (person: string | undefined, body: unknown, kopf: Record<string, string> = {}) => { const r = await bh.POST!(anfrage('/api/finanzen/buchhaltung', person, body, 'POST', kopf)); return { status: r.status, j: await r.json() as Record<string, unknown> }; };

const paket = (eintraege: unknown[], regeln: unknown[] = []) => ({ art: PAKET_ART, version: 1, erstellt: '2026-11-01', regeln, eintraege });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  konten = await import('@/app/api/finanzen/konten/route') as Route;
  bh = await import('@/app/api/finanzen/buchhaltung/route') as Route;
  exp = await import('@/app/api/finanzen/buchhaltung/export/route') as Route;
  buchungen = await import('@/app/api/state/buchungen/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Ben Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '3', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k', finanzRecht: 'business' },
    { id: '4', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
  ], einladungen: [] });
  await db.saveJson('finanzplan', { firmen: [], rechnungen: [{ id: 're-t-1', nummer: 'RE-2026-001', firmaId: 'ug', betrag: 1200, status: 'gestellt' }], zahlungen: [], merkposten: [], produkte: [], uhrwerk: { letztesMeeting: null, agenda: [] } });
  const r = await konten.POST!(anfrage('/api/finanzen/konten', 'pa', { ops: [
    { op: 'konto-neu', konto: { name: 'Geschäftskonto MAKE', art: 'giro', ort: 'ug', iban: IBAN_UG } },
    { op: 'konto-neu', konto: { name: 'Girokonto Anna', art: 'giro', ort: 'privat', person: 'pa', iban: IBAN_PRIVAT } },
  ] }));
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
  await db.saveJson('buchungen', { buchungen: SAAT });
});
afterAll(async () => {
  const { leseprotokollWarten } = await import('@/lib/store/leseprotokoll');
  await leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Arbeitsliste — GET/PATCH /api/state/buchungen', () => {
  it('Sicht Business bekommt nichts aus Privat (Partner mit finanzRecht business)', async () => {
    const t = await holen('pt');
    expect(t.status).toBe(200);
    expect(t.j.buchungen.map(b => b.id).sort()).toEqual(['bu-t-1', 'bu-t-2', 'bu-t-3', 'bu-t-5']);
    expect(t.j.buchungen.every(b => b.ort !== 'privat')).toBe(true);
    // ?sicht=privat öffnet nichts für ein Business-Konto
    expect((await holen('pt', 'privat')).j.buchungen.some(b => b.ort === 'privat')).toBe(false);
    // Voller Zugang sieht alles, mit Stand je Zeile
    const a = await holen('pa');
    expect(a.j.buchungen).toHaveLength(5);
    expect(a.j.buchungen.every(b => typeof b.stand === 'string')).toBe(true);
    expect((await holen('px')).status).toBe(403);
  });

  it('Business darf private Buchungen weder ändern noch löschen (404/403, nichts gespeichert)', async () => {
    const privat = (await holen('pa')).j.buchungen.find(b => b.id === 'bu-t-4')!;
    const vorher = JSON.stringify(await alle());
    expect((await patch('pt', [{ op: 'teil', id: privat.id, stand: privat.stand, felder: { notiz: 'x' } }])).status).toBe(404);
    expect((await patch('pt', [{ op: 'delete', id: privat.id }])).status).toBe(403);
    expect((await patch('pt', [{ op: 'upsert', buchung: { id: 'bu-t-neu', datum: '2026-10-09', wer: 'X', betrag: -1, ort: 'privat' } }])).status).toBe(403);
    expect(JSON.stringify(await alle())).toBe(vorher);
  });

  it('teil: Kategorie + Notiz mit Stand; veralteter Stand → 409 mit aktueller Fassung', async () => {
    const z = (await holen('pt')).j.buchungen.find(b => b.id === 'bu-t-1')!;
    const ok = await patch('pt', [{ op: 'teil', id: z.id, stand: z.stand, felder: { kategorie: 'Software & Abos', notiz: 'Jahresabo' } }]);
    expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    const neu = (await alle()).find(b => b.id === 'bu-t-1')!;
    expect(neu).toMatchObject({ kategorie: 'Software & Abos', kategorieHand: true, notiz: 'Jahresabo' });
    const alt = await patch('pt', [{ op: 'teil', id: z.id, stand: z.stand, felder: { notiz: 'zweites Fenster' } }]);
    expect(alt.status).toBe(409);
    expect((alt.j.konflikte as { id: string }[])[0].id).toBe('bu-t-1');
    expect((await alle()).find(b => b.id === 'bu-t-1')!.notiz).toBe('Jahresabo');
  });

  it('teil: Gesellschaft aus dem Business nur in eine Business-Gesellschaft (403); unbekannte Felder 400', async () => {
    const z = (await holen('pt')).j.buchungen.find(b => b.id === 'bu-t-5')!;
    expect((await patch('pt', [{ op: 'teil', id: z.id, stand: z.stand, felder: { ort: 'privat' } }])).status).toBe(400);
    expect((await patch('pt', [{ op: 'teil', id: z.id, stand: z.stand, felder: { betrag: 1 } }])).status).toBe(400);
    const r = await patch('pt', [{ op: 'teil', id: z.id, stand: z.stand, felder: { rechnungId: 're-t-1' } }]);
    expect(r.status, JSON.stringify(r.j)).toBe(200);
  });
});

describe('Regeln — /api/finanzen/buchhaltung', () => {
  it('Dienstweg 403, fremder Haushalt 403', async () => {
    expect((await bhGet(undefined, DIENST)).status).toBe(403);
    expect((await bhPost(undefined, { aktion: 'kategorie-dazu', name: 'X' }, DIENST)).status).toBe(403);
    expect((await bhGet('px')).status).toBe(403);
  });

  it('regel-lernen mit Stand; veralteter Stand 409; Business nur mit Business-Gesellschaft', async () => {
    const l = await bhGet('pt');
    expect(l.status).toBe(200);
    const stand = l.j.stand as string;
    expect((await bhPost('pt', { aktion: 'regel-lernen', stand, regel: { feld: 'wer', muster: 'Supermarkt', kategorie: 'Büro', ort: 'privat' } })).status).toBe(403);
    expect((await bhPost('pt', { aktion: 'regel-lernen', stand, regel: { feld: 'wer', muster: 'Supermarkt', kategorie: 'Büro' } })).status).toBe(403);
    const ok = await bhPost('pt', { aktion: 'regel-lernen', stand, regel: { feld: 'wer', muster: 'Software Beispiel', kategorie: 'Software & Abos', ort: 'ug' } });
    expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    expect((ok.j.regeln as unknown[]).length).toBe(1);
    expect((await bhPost('pt', { aktion: 'regel-lernen', stand, regel: { feld: 'wer', muster: 'Laden Beispiel', kategorie: 'Büro', ort: 'ug' } })).status).toBe(409);
    expect((await bhPost('pt', { aktion: 'regel-lernen', regel: { feld: 'wer', muster: 'Laden Beispiel', kategorie: 'Büro', ort: 'ug' } })).status).toBe(400);
  });

  it('Business sieht keine Privat-Regel', async () => {
    const stand = (await bhGet('pa')).j.stand as string;
    const r = await bhPost('pa', { aktion: 'regel-lernen', stand, regel: { feld: 'wer', muster: 'Supermarkt', kategorie: 'Bewirtung', ort: 'kdc' } });
    expect(r.status, JSON.stringify(r.j)).toBe(200); // Selbstständigkeit = Privat-Bereich
    expect((await bhPost('pa', { aktion: 'regel-lernen', stand: r.j.stand, regel: { feld: 'wer', muster: 'Supermarkt', kategorie: 'Büro', ort: 'privat' } })).status).toBe(400); // Regeln nur je Gesellschaft
    expect((r.j.regeln as unknown[]).length).toBe(2);
    const t = await bhGet('pt');
    expect((t.j.regeln as { ort?: string }[]).every(x => x.ort === 'ug')).toBe(true);
  });

  it('Vorschlag: Umbuchung ohne Gegenbuchung → Gesellschafterdarlehen (Kapitalgesellschaft), nur per Klick', async () => {
    const t = await bhGet('pt');
    const v = (t.j.vorschlaege as { id: string; art: string; zuordnen?: string }[]).find(x => x.id === 'bu-t-3');
    expect(v).toMatchObject({ art: 'gesellschafter', zuordnen: 'gesellschafter' });
    expect((await alle()).find(b => b.id === 'bu-t-3')!.kategorie).toBe('Umbuchung');
  });

  it('rückwirkend: Vorschau schreibt nichts, Hand gewinnt', async () => {
    const vorher = JSON.stringify(await alle());
    const v = await bhPost('pa', { aktion: 'rueckwirkend-vorschau' });
    expect(v.status).toBe(200);
    const w = v.j.wirkung as { id: string }[];
    expect(w.some(x => x.id === 'bu-t-2')).toBe(false);
    expect(JSON.stringify(await alle())).toBe(vorher);
  });
});

describe('Paket — Vorschau, Übernehmen, Hand gewinnt, idempotent', () => {
  const eintraege = () => [
    { gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-06', betragCent: -3000, gegenseite: 'Laden Beispiel', kategorie: 'Bewirtung' },
    { gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-07', betragCent: -10000, gegenseite: 'Eigenes Konto', kategorie: 'Gesellschafterdarlehen', frage: { text: 'Darlehen oder Ausschüttung?', optionen: ['Darlehen', 'Ausschüttung'] } },
    { gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-01', betragCent: -999, gegenseite: 'Niemand' },
  ];

  it('Vorschau schreibt nichts; Übernehmen legt Vorschläge an; zweimal ändert nichts mehr', async () => {
    const vorher = JSON.stringify(await alle());
    const v = await bhPost('pt', { aktion: 'paket-vorschau', paket: paket(eintraege(), [{ gesellschaft: 'ug', muster: { gegenseite: 'Laden' }, kategorie: 'Büro' }]) });
    expect(v.status, JSON.stringify(v.j)).toBe(200);
    expect(v.j).toMatchObject({ zugeordnet: 2, mitAenderung: 1, handBehalten: 1, regelnNeu: 1 });
    expect((v.j.ohneBuchung as unknown[]).length).toBe(1);
    expect(JSON.stringify(await alle())).toBe(vorher);

    const u = await bhPost('pt', { aktion: 'paket-uebernehmen', basis: v.j.basis, paket: paket(eintraege(), [{ gesellschaft: 'ug', muster: { gegenseite: 'Laden' }, kategorie: 'Büro' }]) });
    expect(u.status, JSON.stringify(u.j)).toBe(200);
    expect(u.j).toMatchObject({ geaendert: 1, regelnGeschrieben: 1 });
    const b2 = (await alle()).find(b => b.id === 'bu-t-2')!;
    expect(b2.kategorie).toBe('Büro'); // Hand gewinnt
    expect(b2.pruefung).toBeUndefined();
    const b3 = (await alle()).find(b => b.id === 'bu-t-3')!;
    expect(b3.pruefung).toMatchObject({ status: 'offen', vorschlag: 'Gesellschafterdarlehen' });
    expect(b3.kategorie).toBe('Umbuchung'); // erst „Passt“ macht den Vorschlag zur Kategorie

    const nochmal = await bhPost('pt', { aktion: 'paket-vorschau', paket: paket(eintraege(), [{ gesellschaft: 'ug', muster: { gegenseite: 'Laden' }, kategorie: 'Büro' }]) });
    expect(nochmal.j).toMatchObject({ mitAenderung: 0, regelnNeu: 0, regelnGleich: 1 });
    expect((await bhGet('pt')).j.zuPruefen).toBe(1);
  });

  it('veraltete Vorschau (basis) → 409, nichts eingelesen', async () => {
    const vorher = JSON.stringify(await alle());
    const r = await bhPost('pt', { aktion: 'paket-uebernehmen', basis: 'alt', paket: paket([{ gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-05', betragCent: -4990, gegenseite: 'Software', notiz: 'neu' }]) });
    expect(r.status).toBe(409);
    expect(JSON.stringify(await alle())).toBe(vorher);
  });

  it('fremde Gesellschaft (Privat aus Business) 403; zu groß 413; unbekannte Kategorie 400', async () => {
    expect((await bhPost('pt', { aktion: 'paket-vorschau', paket: paket([{ gesellschaft: 'kdc', konto: IBAN_UG, datum: '2026-10-05', betragCent: -1, gegenseite: 'x' }]) })).status).toBe(403);
    const viele = Array.from({ length: PAKET_EINTRAEGE_MAX + 1 }, () => ({ gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-05', betragCent: -1, gegenseite: 'x' }));
    expect((await bhPost('pt', { aktion: 'paket-vorschau', paket: paket(viele) })).status).toBe(413);
    expect((await bhPost('pt', { aktion: 'paket-vorschau', paket: paket([{ gesellschaft: 'ug', konto: IBAN_UG, datum: '2026-10-05', betragCent: -1, gegenseite: 'x', kategorie: 'Gibt es nicht' }]) })).status).toBe(400);
  });

  it('„Passt“ stempelt die Person (Server), Vorschlag wird Kategorie', async () => {
    const z = (await holen('pb')).j.buchungen.find(b => b.id === 'bu-t-3')!;
    const r = await patch('pb', [{ op: 'teil', id: z.id, stand: z.stand, felder: { antwort: 'Darlehen', bestaetigen: true } }]);
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const b = (await alle()).find(x => x.id === 'bu-t-3')!;
    expect(b.kategorie).toBe('Gesellschafterdarlehen');
    expect(b.kategorieHand).toBe(true);
    expect(b.pruefung).toMatchObject({ status: 'bestaetigt', geprueftVon: 'pb' });
    expect(typeof b.pruefung!.geprueftAm).toBe('string');
  });
});

describe('Export — /api/finanzen/buchhaltung/export', () => {
  const holeCsv = async (person: string | undefined, q = '', kopf: Record<string, string> = {}) => {
    const r = await exp.GET!(anfrage(`/api/finanzen/buchhaltung/export${q}`, person, undefined, 'GET', kopf));
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, bytes, text: new TextDecoder().decode(bytes), kopf: r.headers };
  };
  it('CSV mit BOM, IBAN maskiert, Formel neutralisiert, Rechnungsnummer, nur Business für Business', async () => {
    const r = await holeCsv('pt', '?orte=ug&von=2026-09-01&bis=2026-10-31');
    expect(r.status).toBe(200);
    expect(r.kopf.get('content-type')).toContain('text/csv');
    expect(Array.from(r.bytes.slice(0, 3))).toEqual([0xEF, 0xBB, 0xBF]);
    expect(r.text).not.toContain(IBAN_UG);
    expect(r.text).toContain(`"'=Formel Beispiel"`);
    expect(r.text).toContain('RE-2026-001');
    expect(r.text).not.toContain('Supermarkt');
    expect(r.text.trim().split('\r\n')).toHaveLength(5); // Kopf + 4 Business-Buchungen
    expect(r.text.indexOf('2026-09-30'.split('-').reverse().join('.'))).toBeLessThan(r.text.indexOf('05.10.2026'));
  });
  it('fremde Gesellschaft 403, Dienstweg 403, kaputter Zeitraum 400', async () => {
    expect((await holeCsv('pt', '?orte=privat')).status).toBe(403);
    expect((await holeCsv('pt', '?orte=kdc')).status).toBe(403);
    expect((await holeCsv(undefined, '', DIENST)).status).toBe(403);
    expect((await holeCsv('pa', '?von=2026-13-01')).status).toBe(400);
    expect((await holeCsv('px')).status).toBe(403);
  });
});

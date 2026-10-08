// ─── Konten-Register (08.10., ROADMAP_Q4 › Lücke 2) ──────────────────────────────────────────────────────────────────────────────────
// Kevin 08.10.: „Kontostände an fünf Stellen → EIN Konten-Register … Bank, 0-Punkt, Liquidität, Finanzplanung und Haushalt lesen nur noch daraus.“
// Prüft: Regeln rein (Stände nur anhängen, geltend = jüngster, zurücknehmen, IBAN nur maskiert, Grenzen, Sicht); ohne Register bit-gleich (0-Punkt-
// Wirkung, Business-Index, Finanzplan-Kennzahlen, Runway); Übernahme nur per Vorschau → Bestätigen (Business-Index danach identisch); Wächter
// „Sicht Business bekommt nichts aus Privat“; Schreiben außerhalb der Sicht 403, Dienstweg 403; 409; Rückweg-Spiegel in den Finanzplan; bisherige
// Schreibwege (Liquidität, 0-Punkt) kommen im Register an. Eigener Datenordner, erfundene Personen, Beträge und die Beispiel-IBAN der Doku.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Datenordner VOR allen Imports (die Server-Module merken ihn beim Laden).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-konten-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-konten';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

import {
  registerAnwenden, geltenderStand, kasseFuer, gesellschaftsKasse, firmenMitRegister, mitRegister, planStartMitRegister, planMitIst, kontoAnzeige,
  registerFuerSicht, uebernahmePlan, uebernahmeAnwenden, ruecklageKasse, privatKasse, standAnhaengen, zielKontoFuer, andereEroeffnungenZuruecknehmen,
  LEERES_REGISTER, type KontenRegister, type Kontext, type RegisterKonto,
} from '@/lib/finanzen/konten/register';
import { registerOhnePerson } from '@/lib/finanzen/konten/server';
import { kennzahlenVon, mitIst } from '@/lib/finanzen/plan/speicher';
import { abEroeffnung, kontoStartFuerPlan, type Eroeffnung } from '@/lib/business/eroeffnung';
import { planFix } from './fixtures/finanz-plan';

/** Beispiel-IBAN aus der Doku der Bundesbank (keine echte Person) — gültige Prüfziffer. */
const IBAN = 'DE89370400440532013000';
const IBAN_MITTE = '37040044053201';
const J = '2026-10-08T09:00:00.000Z';
const ctx = (teil: Partial<Kontext> = {}): Kontext => ({ person: 'pa', jetzt: J, heute: '2026-10-08', sicht: 'privat', personen: ['pa', 'pb'], fassung: k => JSON.stringify(k), ...teil });
const ok = <T,>(e: T): Extract<T, { ok: true }> => { expect((e as { ok: boolean }).ok, JSON.stringify(e)).toBe(true); return e as Extract<T, { ok: true }>; };

// ── Rein: Regeln ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Register — Regeln (rein)', () => {
  const mitKonto = () => ok(registerAnwenden(LEERES_REGISTER, [{ op: 'konto-neu', konto: { name: 'Geschäftskonto', art: 'giro', ort: 'ug', iban: IBAN }, stand0: { betrag: '12.500,50', datum: '2026-10-01' } }], ctx()));

  it('Konto anlegen: Kennung kt-…, erster Stand auf den Cent, IBAN in Grundform gespeichert — ausgeliefert nur maskiert', () => {
    const e = mitKonto();
    const k = e.register.konten[0];
    expect(k.id).toMatch(/^kt-[0-9a-f-]{36}$/);
    expect(k.staende).toHaveLength(1);
    expect(k.staende[0]).toMatchObject({ betrag: 12500.5, datum: '2026-10-01', quelle: 'hand', erfasstVon: 'pa', herkunft: { art: 'konten' } });
    expect(k.iban).toBe(IBAN);
    const a = kontoAnzeige(k, 'f');
    expect(JSON.stringify(a)).not.toContain(IBAN_MITTE);
    expect(a.ibanMaskiert).toBe('DE89 •••• •••• 3000');
    expect('iban' in a).toBe(false);
  });

  it('Stände nur anhängen: geltend = jüngster nach Datum (gleiches Datum: zuletzt erfasst); zurücknehmen → der vorige gilt, nichts gelöscht', () => {
    let r = mitKonto().register;
    const id = r.konten[0].id;
    r = ok(registerAnwenden(r, [{ op: 'stand-neu', id, betrag: 9000, datum: '2026-09-01' }], ctx())).register;
    expect(geltenderStand(r.konten[0])?.betrag).toBe(12500.5);   // älteres Datum gilt nicht, auch wenn später erfasst
    r = ok(registerAnwenden(r, [{ op: 'stand-neu', id, betrag: 11000, datum: '2026-10-05' }], ctx({ jetzt: '2026-10-08T10:00:00.000Z' }))).register;
    const juengster = r.konten[0].staende.find(s => s.betrag === 11000)!;
    expect(geltenderStand(r.konten[0])?.betrag).toBe(11000);
    r = ok(registerAnwenden(r, [{ op: 'stand-zuruecknehmen', id, standId: juengster.id }], ctx())).register;
    expect(r.konten[0].staende).toHaveLength(3);
    expect(r.konten[0].staende.find(s => s.id === juengster.id)?.zurueckgenommenAm).toBe(J);
    expect(geltenderStand(r.konten[0])?.betrag).toBe(12500.5);
  });

  it('Prüfungen: Zukunft, kein Betrag, kaputte IBAN → 400; maskierte IBAN = unverändert; IBAN entfernen; Stand fehlt/veraltet → 400/409; Grenzen → 413', () => {
    const r = mitKonto().register;
    const k = r.konten[0];
    const f = (e: ReturnType<typeof registerAnwenden>) => (e.ok ? 200 : e.status);
    expect(f(registerAnwenden(r, [{ op: 'stand-neu', id: k.id, betrag: 1, datum: '2026-10-09' }], ctx()))).toBe(400);
    expect(f(registerAnwenden(r, [{ op: 'stand-neu', id: k.id, betrag: 'viel', datum: '2026-10-01' }], ctx()))).toBe(400);
    expect(f(registerAnwenden(r, [{ op: 'stand-neu', id: k.id, betrag: 1, datum: '2026-02-30' }], ctx()))).toBe(400);
    expect(f(registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'X', ort: 'ug', iban: 'DE00 1234' } }], ctx()))).toBe(400);
    expect(f(registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'X', ort: 'irgendwo' } }], ctx()))).toBe(400);
    expect(f(registerAnwenden(r, [{ op: 'konto-aendern', id: k.id, felder: { name: 'Neu' } }], ctx()))).toBe(400);   // ohne Stand
    expect(f(registerAnwenden(r, [{ op: 'konto-aendern', id: k.id, stand: 'alt', felder: { name: 'Neu' } }], ctx()))).toBe(409);
    const maske = ok(registerAnwenden(r, [{ op: 'konto-aendern', id: k.id, stand: JSON.stringify(k), felder: { iban: 'DE89 •••• •••• 3000', name: 'Neu' } }], ctx()));
    expect(maske.register.konten[0].iban).toBe(IBAN); expect(maske.register.konten[0].name).toBe('Neu');
    const weg = ok(registerAnwenden(r, [{ op: 'konto-aendern', id: k.id, stand: JSON.stringify(k), felder: { ibanEntfernen: true } }], ctx()));
    expect(weg.register.konten[0].iban).toBeUndefined();
    expect(f(registerAnwenden(r, Array.from({ length: 51 }, () => ({ op: 'stand-neu' as const, id: k.id, betrag: 1, datum: '2026-10-01' })), ctx()))).toBe(413);
    expect(f(registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'x'.repeat(121), ort: 'ug' } }], ctx()))).toBe(413);
    // Alles oder nichts: ein ungültiger Schritt lässt auch den gültigen davor liegen.
    expect(f(registerAnwenden(r, [{ op: 'stand-neu', id: k.id, betrag: 5, datum: '2026-10-02' }, { op: 'stand-neu', id: k.id, betrag: 5, datum: '2099-01-01' }], ctx()))).toBe(400);
  });

  it('Sicht Business: nur Business-Gesellschaften lesen und schreiben — privat, gemeinsam und die Selbstständigkeit (Privat) → 403', () => {
    let r: KontenRegister = LEERES_REGISTER;
    r = ok(registerAnwenden(r, [
      { op: 'konto-neu', konto: { name: 'Giro privat', ort: 'privat', person: 'pa' } },
      { op: 'konto-neu', konto: { name: 'Haushaltskonto', ort: 'gemeinsam' } },
      { op: 'konto-neu', konto: { name: 'Selbstständigkeit', ort: 'kdc' } },
      { op: 'konto-neu', konto: { name: 'MAKE', ort: 'ug' } },
    ], ctx())).register;
    expect(registerFuerSicht(r, 'business').konten.map(k => k.name)).toEqual(['MAKE']);
    const b = ctx({ sicht: 'business' });
    for (const o of ['privat', 'gemeinsam', 'kdc']) {
      const e = registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'X', ort: o } }], b);
      expect(e.ok ? 200 : e.status, o).toBe(403);
    }
    const privat = r.konten.find(k => k.ort === 'privat')!;
    const e1 = registerAnwenden(r, [{ op: 'stand-neu', id: privat.id, betrag: 1, datum: '2026-10-01' }], b);
    expect(e1.ok ? 200 : e1.status).toBe(403);
    const make = r.konten.find(k => k.ort === 'ug')!;
    const e2 = registerAnwenden(r, [{ op: 'konto-aendern', id: make.id, stand: JSON.stringify(make), felder: { ort: 'privat' } }], b);
    expect(e2.ok ? 200 : e2.status).toBe(403);
    expect(ok(registerAnwenden(r, [{ op: 'stand-neu', id: make.id, betrag: 1, datum: '2026-10-01' }], b)).orte).toEqual(['ug']);
    // Person an einem Privat-Konto nur aus dem Haushalt.
    const e3 = registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'Y', ort: 'privat', person: 'fremd' } }], ctx());
    expect(e3.ok ? 200 : e3.status).toBe(400);
  });

  it('Kasse: nur mit Stand regiert das Register; Kredit/Depot/archiviert zählen nicht; Haushalt = privat + gemeinsam; Rücklage = Tagesgeld', () => {
    let r: KontenRegister = LEERES_REGISTER;
    r = ok(registerAnwenden(r, [
      { op: 'konto-neu', konto: { name: 'Giro', ort: 'privat' } },
      { op: 'konto-neu', konto: { name: 'MAKE', ort: 'ug' } },
    ], ctx())).register;
    expect(gesellschaftsKasse(r.konten)).toEqual({});
    expect(privatKasse(r.konten)).toBeNull();
    const [giro, make] = r.konten;
    r = ok(registerAnwenden(r, [
      { op: 'stand-neu', id: giro.id, betrag: 1000, datum: '2026-10-01' },
      { op: 'stand-neu', id: make.id, betrag: 5000, datum: '2026-10-02' },
      { op: 'konto-neu', konto: { name: 'Tagesgeld', ort: 'gemeinsam', art: 'tagesgeld' }, stand0: { betrag: 3000, datum: '2026-09-30' } },
      { op: 'konto-neu', konto: { name: 'Kredit', ort: 'privat', art: 'kredit' }, stand0: { betrag: -20000, datum: '2026-10-01' } },
      { op: 'konto-neu', konto: { name: 'Depot', ort: 'ug', art: 'depot' }, stand0: { betrag: 7000, datum: '2026-10-01' } },
      { op: 'konto-neu', konto: { name: 'Zweites', ort: 'ug' } },
    ], ctx())).register;
    expect(gesellschaftsKasse(r.konten).ug).toEqual({ betrag: 5000, stand: '2026-10-02', aeltester: '2026-10-02', konten: 1, fehlen: 1 });
    expect(privatKasse(r.konten)).toMatchObject({ betrag: 4000, konten: 2, fehlen: 0, stand: '2026-10-01', aeltester: '2026-09-30' });
    expect(ruecklageKasse(r.konten)).toMatchObject({ betrag: 3000, konten: 1 });
    const tg = r.konten.find(k => k.name === 'Tagesgeld')!;
    r = ok(registerAnwenden(r, [{ op: 'archivieren', id: tg.id, stand: JSON.stringify(tg) }], ctx())).register;
    expect(privatKasse(r.konten)?.betrag).toBe(1000);
    // Zurückgenommen bleibt „regiert“ (Kasse ohne Wert) — die alte Quelle lebt nicht still wieder auf.
    const s = r.konten.find(k => k.name === 'Giro')!.staende[0];
    r = ok(registerAnwenden(r, [{ op: 'stand-zuruecknehmen', id: giro.id, standId: s.id }], ctx())).register;
    expect(kasseFuer(r.konten, o => o === 'privat')).toMatchObject({ betrag: 0, konten: 0, fehlen: 1 });
  });

  it('ohne Register bit-gleich: Firmen, Bündel und Planstart sind DIESELBEN Objekte', () => {
    const firmen = [{ id: 'ug', name: 'MAKE', kontostand: 5000, stand: '2026-09-01' }];
    expect(firmenMitRegister(firmen, {})).toBe(firmen);
    const b = { firmen, rechnungen: [] };
    expect(mitRegister(b, {})).toBe(b);
    const start = { ug: { monat: 1, betrag: 8000, stichtag: '2026-09-15' } };
    expect(planStartMitRegister(start, {}, 27)).toBe(start);
    expect(planStartMitRegister(undefined, {}, 27)).toBeUndefined();
    const d = planFix();
    expect(planMitIst(d, undefined, undefined)).toBe(d);
  });

  it('Wirkung: Firmen bekommen die Kasse (fehlende Firma entsteht); Planstart: Register nur, wenn jünger als der 0-Punkt', () => {
    const k = { ug: { betrag: 7000.5, stand: '2026-10-05', aeltester: '2026-10-05', konten: 1, fehlen: 0 } };
    const f = firmenMitRegister([{ id: 'kdv', name: 'KDV', kontostand: 1, stand: '2026-01-01' }], k)!;
    expect(f).toEqual([{ id: 'kdv', name: 'KDV', kontostand: 1, stand: '2026-01-01' }, { id: 'ug', name: expect.any(String), bank: '', kontostand: 7000.5, stand: '2026-10-05' }]);
    const aelter = { ug: { monat: 1, betrag: 8000, stichtag: '2026-10-07' } };
    expect(planStartMitRegister(aelter, k, 27)).toEqual(aelter);
    const neuer = { ug: { monat: 1, betrag: 8000, stichtag: '2026-10-01' } };
    expect(planStartMitRegister(neuer, k, 27)).toEqual({ ug: { monat: 1, betrag: 7000.5, stichtag: '2026-10-05', quelle: 'register' } });
    // Mit dem 0-Punkt danach gilt — wie bisher — die Regel `kontoQuelle`: der jüngere Stand gewinnt, gleicher Tag → 0-Punkt.
    const er: Eroeffnung = { id: 'er-1', firma: 'ug', stichtag: '2026-10-05', kontostand: 9000, gesetztVon: 'pa', gesetztAm: J };
    expect(abEroeffnung({ firmen: f }, { ug: er }).firmen!.find(x => x.id === 'ug')?.kontostand).toBe(9000);
  });

  it('bisherige Schreibwege: Zielkonto = verknüpft, sonst das einzige Kassen-Konto; Stand idempotent; ein neuer 0-Punkt löst frühere ab', () => {
    let r = ok(registerAnwenden(LEERES_REGISTER, [{ op: 'konto-neu', konto: { name: 'A', ort: 'ug' } }], ctx())).register;
    expect(zielKontoFuer(r, 'ug')?.name).toBe('A');
    r = ok(registerAnwenden(r, [{ op: 'konto-neu', konto: { name: 'B', ort: 'ug' } }], ctx())).register;
    expect(zielKontoFuer(r, 'ug')).toBeNull();
    const s = { betrag: 1, datum: '2026-10-01', quelle: 'hand' as const, erfasstVon: 'pa', erfasstAm: J, herkunft: { art: 'eroeffnung' as const, id: 'er-a' } };
    const a = standAnhaengen(r, r.konten[0].id, s);
    expect(a.neu).toBe(true);
    expect(standAnhaengen(a.register, r.konten[0].id, s).neu).toBe(false);
    const z = andereEroeffnungenZuruecknehmen(a.register, 'ug', 'er-b', 'pa', J);
    expect(z.anzahl).toBe(1);
    expect(geltenderStand(z.register.konten[0])).toBeNull();
  });

  it('Konto löschen: Konten bleiben, Personen-Kennungen werden „[gelöscht]“', () => {
    const r = ok(registerAnwenden(LEERES_REGISTER, [{ op: 'konto-neu', konto: { name: 'Giro', ort: 'privat', person: 'pb' }, stand0: { betrag: 1, datum: '2026-10-01' } }], ctx({ person: 'pb' }))).register;
    const t = registerOhnePerson(r, 'pb', '[gelöscht]');
    expect(t.anzahl).toBe(3);
    expect(JSON.stringify(t.register)).not.toContain('"pb"');
    expect(t.register.konten[0].name).toBe('Giro');
    expect(registerOhnePerson(r, 'pa', '[gelöscht]').register).toBe(r);
  });

  it('Übernahme (rein): Liquidität + 0-Punkt auf EIN Konto, Planungs-Posten der Gesellschaft nicht doppelt, Haushalt gleichen Namens = dasselbe Konto; danach leer', () => {
    const q = {
      firmen: [{ id: 'ug', name: 'MAKE', bank: 'Beispielbank', kontostand: 5000, stand: '2026-09-01' }, { id: 'kdc', name: 'Selbst', kontostand: 300, stand: '2026-09-02' }],
      eroeffnungen: [{ id: 'er-x', firma: 'ug' as const, stichtag: '2026-09-15', kontostand: 8000 }],
      posten: [{ id: 'po-ug', einheit: 'ug', name: 'Geschäftskonto', betrag: 4800 }, { id: 'po-p', einheit: 'privat', name: 'Girokonto Beispiel', betrag: 2500 }],
      haushaltKonten: [{ id: 'hk-1', name: 'Girokonto Beispiel', inhaber: 'Anna', einheit: 'privat', bank: 'Beispielbank', aktiv: true }, { id: 'hk-2', name: 'Haushalt', inhaber: 'gemeinsam', einheit: 'privat', bank: null, aktiv: true }],
      personNachName: (n: string) => (n === 'Anna' ? 'pa' : null),
    };
    const p = uebernahmePlan(LEERES_REGISTER, q, 'privat', '2026-10-08');
    expect(p.punkte.map(x => x.schluessel)).toEqual(['liq:kdc', 'liq:ug', 'er:er-x', 'po:po-p', 'hh:hk-2']);
    expect(p.nicht.map(x => x.name)).toEqual(['Geschäftskonto']);
    expect(p.punkte.find(x => x.schluessel === 'po:po-p')).toMatchObject({ person: 'pa', alt: { posten: 'po-p', haushaltKonto: 'hk-1' }, datumUnbekannt: true });
    const a = uebernahmeAnwenden(LEERES_REGISTER, p, { person: 'pa', jetzt: J });
    expect(a.konten).toBe(4); expect(a.staende).toBe(4);
    const ug = a.register.konten.find(k => k.ort === 'ug')!;
    expect(ug.staende.map(s => s.betrag)).toEqual([5000, 8000]);
    expect(geltenderStand(ug)?.betrag).toBe(8000);   // 0-Punkt am 15.09. ist jünger als der Liquidität-Stand vom 01.09.
    expect(uebernahmePlan(a.register, q, 'privat', '2026-10-08').punkte).toEqual([]);
    // Business-Sicht: nur die Business-Gesellschaften.
    expect(uebernahmePlan(LEERES_REGISTER, q, 'business', '2026-10-08').punkte.map(x => x.schluessel)).toEqual(['liq:ug', 'er:er-x']);
  });
});

// ── Finanzplanung: ohne Register bit-gleich, mit Register liest sie das Ist ──────────────────────────────────────────────────────

describe('Finanzplanung liest aus dem Register (R4)', () => {
  it('ohne Register: Kennzahlen bit-gleich (auch mit 0-Punkt); mit Privat-Ist: frei und Konten aus dem Register, Selbstständigkeit „heute“ ebenso', () => {
    const d = planFix();
    const vorher = kennzahlenVon(d);
    expect(kennzahlenVon(mitIst(d, {}, {}, undefined))).toEqual(vorher);
    const er: Eroeffnung = { id: 'er-1', firma: 'ug', stichtag: '2026-10-01', kontostand: 8000, gesetztVon: 'pa', gesetztAm: J };
    const nurNull = mitIst(d, { ug: er }, {}, undefined);
    expect(nurNull.eroeffnung).toEqual(kontoStartFuerPlan({ ug: er }, d.monate.length));
    const ist = { privat: { betrag: 2500, stand: '2026-10-01', aeltester: '2026-10-01', konten: 1, fehlen: 0 }, selbststaendigkeit: { betrag: 300, stand: '2026-10-01', aeltester: '2026-10-01', konten: 1, fehlen: 0 } };
    const mit = mitIst(d, {}, {}, ist);
    expect(mit.selbst.kontoStart).toBe(300);
    expect(d.selbst.kontoStart).toBe(5000);   // das Dokument bleibt unverändert (nie gespeichert)
    const nur = mitIst(d, {}, {}, { privat: ist.privat });
    expect(kennzahlenVon(nur).freiJetzt - vorher.freiJetzt).toBeCloseTo(2500, 6);
  });
});

// ── Schnittstellen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
const anfrage = (url: string, person?: string, body?: unknown, methode?: string, kopf: Record<string, string> = {}) => new Request(`http://test${url}`, {
  method: methode ?? (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...kopf }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

let db: typeof import('@/lib/store/local-db');
let konten: Route, business: Route, finanzplan: Route, altplan: Route, eroeffnung: Route;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  konten = await import('@/app/api/finanzen/konten/route') as Route;
  business = await import('@/app/api/business/route') as Route;
  finanzplan = await import('@/app/api/finanzplan/route') as Route;
  altplan = await import('@/app/api/state/finanzplan/route') as Route;
  eroeffnung = await import('@/app/api/business/eroeffnung/route') as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Ben Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k' },
    { id: '3', speicher: 'pt', email: 'pt@example.invalid', name: 'Team Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-k', finanzRecht: 'business' },
    { id: '4', speicher: 'px', email: 'px@example.invalid', name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd' },
    { id: '5', speicher: 'po', email: 'po@example.invalid', name: 'Ohne Haushalt', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01' },
  ], einladungen: [] });
  await db.saveJson('finanzplan', {
    firmen: [
      { id: 'ug', name: 'MAKE', bank: 'Beispielbank', kontostand: 5000, stand: tag(-60) },
      { id: 'kdv', name: 'KDV', bank: '', kontostand: 1000, stand: tag(-60) },
      { id: 'kdc', name: 'Selbst', bank: '', kontostand: 300, stand: tag(-60) },
    ],
    rechnungen: [{ id: 'r-neu', firmaId: 'ug', kunde: 'Neukunde', titel: 'neu', betrag: 3000, status: 'gestellt', datum: tag(-5), faellig: tag(20) }],
    zahlungen: [], merkposten: [], produkte: [{ id: 'p1', name: 'P', beschreibung: '', preis: 0, einheit: 'einmalig', status: 'entwurf' }],
    uhrwerk: { letztesMeeting: null, agenda: [{ id: 'a1', label: 'x', done: false }] },
  });
  await db.saveJson('liquiplan', { posten: [{ id: 'p-lauf', titel: 'Miete', betrag: -1000, rhythmus: 'monatlich', ab: '2025-01-01', sicher: true, firmaId: 'ug' }] });
  await db.saveJson('finanzen-plan--h-k', { ...planFix(), posten: [{ id: 'po-giro', art: 'konto', einheit: 'privat', name: 'Girokonto Beispiel', betrag: 2500, status: 'ok' }] });
  await db.saveJson('haushalt-stamm--h-k', { einheiten: 2, konten: [{ id: 'hk-1', stand: 1, name: 'Girokonto Beispiel', inhaber: 'Anna Prüf', einheit: 'privat', iban_suffix: null, bank: 'Beispielbank', waehrung: 'EUR', aktiv: true }], kategorien: [], regeln: [], aliase: {} });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const lies = async (person: string, sicht?: string) => {
  const r = await konten.GET!(anfrage(`/api/finanzen/konten${sicht ? `?sicht=${sicht}` : ''}`, person));
  return { status: r.status, text: await r.text() };
};
const schreibe = async (person: string, body: unknown, sicht?: string, kopf: Record<string, string> = {}) => {
  const r = await konten.POST!(anfrage(`/api/finanzen/konten${sicht ? `?sicht=${sicht}` : ''}`, person, body, 'POST', kopf));
  return { status: r.status, j: await r.json() };
};
const index = async () => JSON.stringify((await (await business.GET!(anfrage('/api/business?scope=gesamt&kompakt=1', 'pa'))).json()).bi);
const kennzahl = async (scope: string, id: string) => {
  const j = await (await business.GET!(anfrage(`/api/business?scope=${scope}&kompakt=1`, 'pa'))).json();
  return j.bi.saeulen.flatMap((s: { kennzahlen: { id: string }[] }) => s.kennzahlen).find((k: { id: string }) => k.id === id) as { wert: number | null; quelle?: string };
};

describe('Route /api/finanzen/konten — Zugang, Übernahme, Wirkung', () => {
  let vorherIndex = '';

  it('ohne Register: leer, und alle Leser rechnen wie bisher (0-Punkt-Wirkung gibt dieselben Firmen zurück)', async () => {
    const r = await lies('pa');
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toMatchObject({ ok: true, konten: [], gesellschaften: {}, privat: null });
    vorherIndex = await index();
    const { mitEroeffnung } = await import('@/lib/business/eroeffnung-server');
    const fp = (await db.loadJson<{ firmen: { id: string; kontostand: number | null; stand: string | null }[] }>('finanzplan'))!;
    expect((await mitEroeffnung(fp)).firmen).toBe(fp.firmen);
    const plan = (await (await finanzplan.GET!(anfrage('/api/finanzplan', 'pa'))).json()).dokument;
    expect(plan.kontenIst).toBeUndefined(); expect(plan.eroeffnung).toBeUndefined(); expect(plan.selbst.kontoStart).toBe(5000);
  });

  it('Rechte: ohne Haushalt/ohne Person → 403, Dienstweg → 403 (auch mit Person), ein fremder Haushalt hat sein eigenes (leeres) Register', async () => {
    expect((await lies('po')).status).toBe(403);
    expect((await konten.GET!(anfrage('/api/finanzen/konten'))).status).toBe(403);
    const dienst = { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' };
    expect((await konten.GET!(anfrage('/api/finanzen/konten', undefined, undefined, 'GET', dienst))).status).toBe(403);
    expect((await schreibe('pa', { ops: [{ op: 'konto-neu', konto: { name: 'X', ort: 'ug' } }] }, undefined, { 'x-make-key': process.env.MAKE_OS_KEY! })).status).toBe(403);
    expect(JSON.parse((await lies('px')).text).konten).toEqual([]);
    expect((await schreibe('px', { ops: [] })).status).toBe(400);
    expect((await schreibe('pa', { aktion: 'loeschen' })).status).toBe(400);
  });

  it('Übernahme nur per Klick: Vorschau schreibt nichts; falsche Kennung → 409; danach führt das Register — Business-Index unverändert', async () => {
    const v = await (await konten.GET!(anfrage('/api/finanzen/konten?uebernahme=1', 'pa'))).json();
    expect(v.punkte.map((p: { schluessel: string }) => p.schluessel)).toEqual(['liq:kdc', 'liq:kdv', 'liq:ug', 'po:po-giro']);
    expect(await db.loadJson('konten--h-k')).toBeNull();
    // Business-Recht sieht in der Vorschau nur die Business-Gesellschaften.
    const vt = await (await konten.GET!(anfrage('/api/finanzen/konten?uebernahme=1', 'pt'))).json();
    expect(vt.punkte.map((p: { schluessel: string }) => p.schluessel)).toEqual(['liq:kdv', 'liq:ug']);
    expect((await schreibe('pa', { aktion: 'uebernahme', basis: 'falsch' })).status).toBe(409);
    expect(await db.loadJson('konten--h-k')).toBeNull();
    const u = await schreibe('pa', { aktion: 'uebernahme', basis: v.basis });
    expect(u.status).toBe(200);
    expect(u.j).toMatchObject({ ok: true, konten: 4, staende: 4 });
    expect(u.j.lage.gesellschaften.ug).toMatchObject({ betrag: 5000, konten: 1 });
    expect(u.j.lage.privat).toMatchObject({ betrag: 2500, konten: 1 });
    // Dieselben Zahlen, jetzt aus dem Register: der Business-Index ist bit-gleich.
    expect(await index()).toBe(vorherIndex);
    // Ein zweites Mal gibt es nichts zu übernehmen.
    expect((await (await konten.GET!(anfrage('/api/finanzen/konten?uebernahme=1', 'pa'))).json()).punkte).toEqual([]);
  });

  it('Finanzplanung liest daraus: Start MAKE/KD Ventures aus dem Register, Privat-Konten und „Kontostand heute“ der Selbstständigkeit — Business-Sicht ohne Privates', async () => {
    const d = (await (await finanzplan.GET!(anfrage('/api/finanzplan', 'pa'))).json()).dokument;
    expect(d.eroeffnung.ug).toEqual({ monat: 1, betrag: 5000, stichtag: tag(-60), quelle: 'register' });
    expect(d.kontenIst.privat).toMatchObject({ betrag: 2500, konten: 1 });
    expect(d.selbst.kontoStart).toBe(300);
    for (const [p, q] of [['pa', '?sicht=business'], ['pt', '']] as const) {
      const b = await (await finanzplan.GET!(anfrage(`/api/finanzplan${q}`, p))).json();
      expect(b.dokument.kontenIst, p).toBeUndefined();
      expect(b.dokument.eroeffnung.ug.betrag).toBe(5000);
    }
    // Gespeichert wird davon nichts.
    const roh = (await db.loadJson<{ kontenIst?: unknown; eroeffnung?: unknown; selbst: { kontoStart: number } }>('finanzen-plan--h-k'))!;
    expect(roh.kontenIst).toBeUndefined(); expect(roh.eroeffnung).toBeUndefined(); expect(roh.selbst.kontoStart).toBe(5000);
  });

  it('Wächter „Sicht Business bekommt nichts aus Privat“: Business-Recht und Business-Bereich sehen nur Business-Konten; Schreiben auf Privates → 403', async () => {
    const neu = await schreibe('pa', { ops: [{ op: 'konto-neu', konto: { name: 'MARKE-PRIVAT-KONTO', ort: 'privat', person: 'pa', iban: IBAN }, stand0: { betrag: 7777.77, datum: tag(-1) } }] });
    expect(neu.status).toBe(200);
    const privatId = neu.j.neu[0] as string;
    for (const [p, s] of [['pt', undefined], ['pt', 'privat'], ['pa', 'business'], ['pb', 'business']] as const) {
      const r = await lies(p, s);
      expect(r.status).toBe(200);
      expect(r.text, `${p} ${s}`).not.toContain('MARKE-PRIVAT-KONTO');
      expect(r.text).not.toContain('Girokonto Beispiel');
      expect(r.text).not.toContain('7777.77');
      expect(JSON.parse(r.text).konten.every((k: { ort: string }) => k.ort === 'ug' || k.ort === 'kdv')).toBe(true);
      expect(JSON.parse(r.text).privat).toBeUndefined();
    }
    // Volles Mitglied sieht es — die IBAN nie ganz.
    const pb = await lies('pb');
    expect(pb.text).toContain('MARKE-PRIVAT-KONTO'); expect(pb.text).not.toContain(IBAN_MITTE);
    expect(JSON.stringify(await db.loadJson('konten--h-k'))).toContain(IBAN);
    for (const body of [
      { ops: [{ op: 'stand-neu', id: privatId, betrag: 1, datum: tag(0) }] },
      { ops: [{ op: 'konto-neu', konto: { name: 'X', ort: 'privat' } }] },
      { ops: [{ op: 'konto-neu', konto: { name: 'X', ort: 'kdc' } }] },
    ]) {
      expect((await schreibe('pt', body)).status).toBe(403);
      expect((await schreibe('pa', body, 'business')).status).toBe(403);
    }
    expect(JSON.stringify(await db.loadJson('konten--h-k'))).not.toContain('"betrag":1,');
  });

  it('Stand eintragen (Business-Recht für MAKE): Kasse, Business-Index und Rückweg-Spiegel in den Finanzplan; veraltete Fassung → 409', async () => {
    const lage = JSON.parse((await lies('pt')).text);
    const ug = lage.konten.find((k: { ort: string }) => k.ort === 'ug');
    const r = await schreibe('pt', { ops: [{ op: 'stand-neu', id: ug.id, betrag: '6.500', datum: tag(0), stand: ug.fassung }] });
    expect(r.status).toBe(200);
    expect(r.j.lage.gesellschaften.ug).toMatchObject({ betrag: 6500, stand: tag(0) });
    const fp = (await db.loadJson<{ firmen: { id: string; kontostand: number; stand: string }[] }>('finanzplan'))!;
    expect(fp.firmen.find(f => f.id === 'ug')).toMatchObject({ kontostand: 6500, stand: tag(0) });
    expect((await kennzahl('ug', 'liquiditaet')).quelle).toContain('6.500');
    expect((await schreibe('pt', { ops: [{ op: 'konto-aendern', id: ug.id, stand: ug.fassung, felder: { name: 'Neu' } }] })).status).toBe(409);
    const zurueck = r.j.lage.konten.find((k: { ort: string }) => k.ort === 'ug').geltend;
    expect((await schreibe('pt', { ops: [{ op: 'stand-zuruecknehmen', id: ug.id, standId: zurueck.id }] })).status).toBe(200);
    expect((await db.loadJson<{ firmen: { id: string; kontostand: number }[] }>('finanzplan'))!.firmen.find(f => f.id === 'ug')?.kontostand).toBe(5000);
    expect(await index()).toBe(vorherIndex);
  });

  it('bisherige Schreibwege kommen an: Kontostand über den Finanzplan (Liquidität), 0-Punkt setzen und zurücknehmen', async () => {
    const fp = await (await altplan.GET!(anfrage('/api/state/finanzplan', 'pa'))).json();
    const ug = fp.firmen.find((f: { id: string }) => f.id === 'ug');
    const p = await altplan.PATCH!(anfrage('/api/state/finanzplan', 'pa', { ops: [{ liste: 'firmen', op: 'upsert', eintrag: { ...ug, kontostand: 7000 }, stand: ug.fassung }] }, 'PATCH'));
    expect(p.status).toBe(200);
    const reg = (await db.loadJson<{ konten: RegisterKonto[] }>('konten--h-k'))!;
    const konto = reg.konten.find(k => k.ort === 'ug')!;
    expect(geltenderStand(konto)).toMatchObject({ betrag: 7000, datum: tag(0), herkunft: { art: 'liquiditaet' }, erfasstVon: 'pa' });
    // 0-Punkt: Anfangsbestand als Stand am Stichtag; zurücknehmen nimmt ihn auch im Register zurück.
    const e = await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'setzen', firma: 'ug', stichtag: tag(0), kontostand: 9000 }));
    expect(e.status).toBe(200);
    let k = (await db.loadJson<{ konten: RegisterKonto[] }>('konten--h-k'))!.konten.find(x => x.ort === 'ug')!;
    expect(geltenderStand(k)).toMatchObject({ betrag: 9000, herkunft: { art: 'eroeffnung' } });
    expect((await eroeffnung.POST!(anfrage('/api/business/eroeffnung', 'pa', { aktion: 'zuruecknehmen', firma: 'ug' }))).status).toBe(200);
    k = (await db.loadJson<{ konten: RegisterKonto[] }>('konten--h-k'))!.konten.find(x => x.ort === 'ug')!;
    expect(geltenderStand(k)?.betrag).toBe(7000);
    expect(k.staende.find(s => s.herkunft?.art === 'eroeffnung')?.zurueckgenommenAm).toBeTruthy();
  });

  it('Privat-Index: Tagesgeld im Register ist die Rücklage (die Eintragung bleibt gespeichert)', async () => {
    const r = await schreibe('pb', { ops: [{ op: 'konto-neu', konto: { name: 'Tagesgeld', ort: 'gemeinsam', art: 'tagesgeld' }, stand0: { betrag: 12000, datum: tag(-2) } }] });
    expect(r.status).toBe(200);
    expect(r.j.lage.ruecklage).toMatchObject({ betrag: 12000, konten: 1 });
    const { ruecklageAusRegister } = await import('@/lib/finanzen/konten/server');
    expect(await ruecklageAusRegister('h-k')).toEqual({ betrag: 1_200_000, stand: tag(-2) });
    expect(await ruecklageAusRegister('h-fremd')).toBeNull();
  });
});

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

// ─── Wächter: Threads — Stand/409, Grenzen 413, Verlauf nur vom Server, Löschfrist (09.10., Paket 1 „Kern“) ───────────────────
// Rein (lib/agenten/faeden.ts) und über POST /api/agenten/faden. Eigener Datenordner, erfundene Konten, Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-agenten-faeden-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-faeden';
process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
process.env.ANTHROPIC_API_KEY = 'test-schluessel';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_MODEL;

import { GRENZEN, type Faden } from '@/lib/agenten/typen';
import {
  abgelaufen, anhaengen, fadenHinzu, fadenStand, fuerPrompt, gedaechtnisFuer, kurzfassung, merksatzPruefen, neuerFaden, ohneAbgelaufene, textPruefen,
  type FadenBestandKern, type NachrichtKern,
} from '@/lib/agenten/faeden';
import { kontenSaeen, modellFake, rufe, sitzung, text, type ModellFake } from './fixtures/agenten-kern';

const J = '2026-10-09T08:00:00.000Z';
const n = (i: number, rolle: NachrichtKern['rolle'] = 'person', extra: Partial<NachrichtKern> = {}): NachrichtKern => ({ id: `nr-${i}`, rolle, von: rolle === 'person' ? 'person-a' : rolle === 'agent' ? 'head:sales' : 'system', text: `Nachricht ${i}`, zeit: J, ...extra });
const kapsel = (q: string, t: string) => `<fremde_daten quelle="${q}">${t}</fremde_daten>`;

describe('Regeln (rein)', () => {
  const f0 = () => neuerFaden({ id: 'fd-00000000-0000-4000-8000-000000000001', besitzer: 'person-a', agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: 'Test', jetzt: J });
  it('Text: leer 400, über 8.000 Zeichen 413 — nie gekürzt', () => {
    expect(textPruefen('  ')).toMatchObject({ ok: false, status: 400 });
    expect(textPruefen('x'.repeat(GRENZEN.nachrichtZeichen + 1))).toMatchObject({ ok: false, status: 413 });
    expect(textPruefen('x'.repeat(GRENZEN.nachrichtZeichen))).toMatchObject({ ok: true });
  });
  it('Thread voll (400 Nachrichten) → 413, nichts gekürzt', () => {
    const voll = { ...f0(), nachrichten: Array.from({ length: GRENZEN.fadenNachrichten }, (_, i) => n(i)) };
    const r = anhaengen(voll, [n(999)], J);
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect(voll.nachrichten).toHaveLength(GRENZEN.fadenNachrichten);
  });
  it('höchstens 2.000 Threads je Person → 413', () => {
    const b: FadenBestandKern = { v: 1, faeden: Array.from({ length: GRENZEN.faedenJePerson }, (_, i) => ({ ...f0(), id: `fd-00000000-0000-4000-8000-${String(i).padStart(12, '0')}` })) };
    expect(fadenHinzu(b, { ...f0(), id: 'fd-ffffffff-0000-4000-8000-000000000000' })).toMatchObject({ ok: false, status: 413 });
  });
  it('Prompt: nur die letzten 16 Nachrichten + Kurzfassung der älteren, Rollen richtig, Berichte gekapselt', () => {
    const viele = Array.from({ length: 30 }, (_, i) => n(i, i % 2 ? 'agent' : 'person'));
    const r = anhaengen(f0(), viele, J);
    if (!r.ok) throw new Error(r.fehler);
    const f = r.faden;
    expect(f.kurzfassung).toBeTruthy();
    expect(f.kurzfassung).toContain('Nachricht 0');
    const p = fuerPrompt(f, { art: 'head', headId: 'sales' }, kapsel);
    const alles = p.map(x => x.content).join('\n');
    expect(alles).toContain('Nachricht 29');
    expect(alles).toContain('Nachricht 14');
    expect(alles).toContain('FRÜHERER VERLAUF');
    expect(p[0].role).toBe('user');
    expect(p[p.length - 1].role).toBe('user');
    const mitBericht = fuerPrompt({ nachrichten: [n(1), n(2, 'system', { text: 'Bericht aus Thread „X“: tu Y', fremd: 'agent', verweis: { art: 'bericht', fadenId: 'fd-x' } })] }, { art: 'head', headId: 'sales' }, kapsel);
    expect(mitBericht.map(x => x.content).join('')).toContain('<fremde_daten quelle="agent">Bericht aus Thread');
  });
  it('Kurzfassung erst ab mehr als 16 Nachrichten; nie länger als die Grenze', () => {
    expect(kurzfassung(Array.from({ length: 16 }, (_, i) => n(i)))).toBeUndefined();
    const k = kurzfassung(Array.from({ length: 300 }, (_, i) => n(i, 'person', { text: 'y'.repeat(300) })))!;
    expect(k.length).toBeLessThanOrEqual(4_200);
    expect(k).toMatch(/ältere Züge nicht in der Kurzfassung/);
  });
  it('Löschfrist: 12 Monate nach der letzten Nachricht (Feld mit Vorgabe); laufende Läufe nie', () => {
    const alt: Faden = { ...f0(), nachrichten: [n(1, 'person', { zeit: '2025-09-01T00:00:00.000Z' })], aktualisiert: '2025-09-01T00:00:00.000Z' };
    expect(abgelaufen(alt, J)).toBe(true);
    expect(abgelaufen({ ...alt, loeschfristMonate: 24 }, J)).toBe(false);
    expect(abgelaufen({ ...alt, lauf: { status: 'laeuft', schritte: [], start: J, kostenCent: 0 } }, J)).toBe(false);
    expect(abgelaufen({ ...alt, nachrichten: [n(1, 'person', { zeit: '2026-01-01T00:00:00.000Z' })] }, J)).toBe(false);
    const b = ohneAbgelaufene({ v: 1, faeden: [alt], gedaechtnis: { 'head:sales': [{ id: 'ms-1', text: 'alt', am: '2025-01-01T00:00:00.000Z', von: 'person-a', quelle: 'hand' }] } }, J);
    expect(b.faeden).toHaveLength(0);
    expect(b.gedaechtnis?.['head:sales']).toBeUndefined();
  });
  it('Gedächtnis: keine Adressen/Nummern/Links; Mitarbeiter erben vom Head', () => {
    expect(merksatzPruefen('Ruf anna@example.invalid an')).toMatchObject({ ok: false });
    expect(merksatzPruefen('Nummer +49 170 1234567')).toMatchObject({ ok: false });
    expect(merksatzPruefen('Siehe https://example.invalid')).toMatchObject({ ok: false });
    expect(merksatzPruefen('Angebote immer mit drei Optionen')).toMatchObject({ ok: true });
    const b = { gedaechtnis: { 'head:sales': [{ id: 'ms-1', text: 'H', am: J, von: 'x', quelle: 'hand' as const }], 'mitarbeiter:sales:sales-angebote': [{ id: 'ms-2', text: 'M', am: J, von: 'x', quelle: 'hand' as const }] } };
    expect(gedaechtnisFuer(b, { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-angebote' }).map(m => m.text)).toEqual(['H', 'M']);
    expect(gedaechtnisFuer(b, { art: 'head', headId: 'sales' }).map(m => m.text)).toEqual(['H']);
  });
});

describe('Art. 17 über den Eintrag von Paket 0 (person-weitere.ts): Nennungen Dritter getilgt, der Thread bleibt', () => {
  it('Name, Adresse und Kennung im Thread und im Brett werden „[gelöscht]“', async () => {
    const { WEITERE_SPEICHER, merkmaleVon } = await import('@/lib/crm/person-weitere');
    const w = WEITERE_SPEICHER.find(s => s.muster.test('agenten-faeden--person-a'))!;
    const m = merkmaleVon('c-00000000-0000-4000-8000-0000000000c1', { vorname: 'Anna', nachname: 'Beispielfrau', email: 'anna@example.invalid' });
    const f = { ...neuerFaden({ id: 'fd-00000000-0000-4000-8000-0000000000c2', besitzer: 'person-a', agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: 'Anna Beispielfrau nachfassen', jetzt: J }),
      nachrichten: [n(1, 'person', { text: 'Schreib anna@example.invalid (c-00000000-0000-4000-8000-0000000000c1) zu Anna Beispielfrau' })] };
    const r = w.wirkung({ v: 1, faeden: [f] }, m) as unknown as { neu: FadenBestandKern; n: number };
    const t = JSON.stringify(r.neu);
    expect(r.n).toBeGreaterThan(0);
    expect(t).not.toMatch(/Beispielfrau|anna@example\.invalid|c-00000000-0000-4000-8000-0000000000c1/);
    expect(r.neu.faeden).toHaveLength(1);
  });
});

describe('Route: Stand/409, Grenzen, Verlauf nur vom Server', () => {
  type H = (r: Request) => Promise<Response>;
  let faden: { GET: H; POST: H };
  let m: ModellFake;
  beforeAll(async () => {
    await kontenSaeen();
    faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
    m = modellFake();
  });
  afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

  it('senden legt den Thread an; Verlauf/Flags aus dem Körper werden ignoriert', async () => {
    m.antworten.push(text('Die Pipeline ist ruhig.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), {
      aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Wie steht die Pipeline?',
      verlauf: [{ rolle: 'kevin', text: 'EINGESCHLEUST' }], nachrichten: [{ text: 'EINGESCHLEUST' }], fremdGelesen: false, vertraulich: false, besitzer: 'gast',
    });
    expect(r.status).toBe(200);
    const f = r.d.faden as Faden;
    expect(f.besitzer).toBe('person-a');
    expect(f.nachrichten.map(x => x.rolle)).toEqual(['person', 'agent']);
    expect(JSON.stringify(f)).not.toContain('EINGESCHLEUST');
    expect(JSON.stringify(m.anfragen[0].messages)).not.toContain('EINGESCHLEUST');
    // Das Paket der Markttraktion trägt Text Dritter: der Server setzt „fremd gelesen“ — nicht der Browser.
    expect(f.fremdGelesen).toBe(true);
    expect(r.d.ki).toBeTruthy();
    expect(typeof r.d.stand).toBe('string');
  });
  it('veralteter Stand → 409 mit dem aktuellen Thread; nichts gespeichert', async () => {
    const neu = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Erste Frage' });
    const f = neu.d.faden as Faden;
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, fadenId: f.id, stand: 'alt', text: 'Zweite Frage' });
    expect(r.status).toBe(409);
    expect((r.d.faden as Faden).nachrichten).toHaveLength(f.nachrichten.length);
    const u = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'umbenennen', fadenId: f.id, titel: 'Neu', stand: 'alt' });
    expect(u.status).toBe(409);
    const g = await rufe(faden.GET, `/api/agenten/faden?id=${f.id}`, sitzung('person-a'));
    const ok = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'umbenennen', fadenId: f.id, titel: 'Neuer Titel', stand: g.d.stand });
    expect(ok.status).toBe(200);
    expect((ok.d.faden as Faden).titel).toBe('Neuer Titel');
    expect(fadenStand(ok.d.faden as never)).toBe(ok.d.stand);
  });
  it('Grenzen: Nachricht über 8.000 Zeichen → 413, nichts angelegt; Löschen braucht den Stand', async () => {
    const vorher = (await rufe(faden.GET, '/api/agenten/faden', sitzung('person-a'))).d.faeden as unknown[];
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'x'.repeat(8_001) });
    expect(r.status).toBe(413);
    const nachher = (await rufe(faden.GET, '/api/agenten/faden', sitzung('person-a'))).d.faeden as { id: string }[];
    expect(nachher).toHaveLength(vorher.length);
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'loeschen', fadenId: nachher[0].id })).status).toBe(400);
    const g = await rufe(faden.GET, `/api/agenten/faden?id=${nachher[0].id}`, sitzung('person-a'));
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'loeschen', fadenId: nachher[0].id, stand: g.d.stand })).status).toBe(200);
  });
  it('ZOE-Threads laufen bis Paket 4 über das bestehende Gespräch', async () => {
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'zoe' }, text: 'Hallo' })).status).toBe(400);
  });
});

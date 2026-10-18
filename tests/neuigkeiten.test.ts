// ─── Was ist neu (18.10., Kevin: „jedes Mal, wenn ein Update gemacht wird … zeigt, was neu ist — damit Malin auch immer Bescheid weiß“) ──────
// Geprüft: die Liste (neueste zuerst, feste Kennungen, neutrale Texte ohne Namen/Firmen/Beträge, Wege nur in die App, Bereich je Punkt), die
// Sicht (ein Konto „nur Business“ bekommt keine Privat-Punkte — serverseitig), „ungelesen“ (einmal je Update und Person, neue Konten ohne die
// Geschichte), die Route (nur die Person selbst, Dienstweg 403, Lesen schreibt nie, nie rückwärts) und die Verdrahtung (Rahmen, Einstellungen,
// Suche, Register). Erfundene Konten, eigener Datenordner.
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NEUIGKEITEN, neuigkeitenFuer, ungelesene, wegGueltig, istNeuigkeit, type Neuigkeit } from '@/lib/neuigkeiten/eintraege';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-neuigkeiten-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-neuigkeiten';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

const n = (id: string, datum: string, punkte: Neuigkeit['abschnitte'][number]['punkte'], x: Partial<Neuigkeit> = {}): Neuigkeit =>
  ({ id, datum, titel: `Update ${id}`, kurz: 'Kurz für alle.', abschnitte: [{ art: 'neu', punkte }], ...x });

describe('Die Liste', () => {
  it('neueste zuerst, eindeutige Kennungen u-JJJJ-MM-TT, gültige Tage, jedes Update mit Punkten', () => {
    expect(NEUIGKEITEN.length).toBeGreaterThan(0);
    const ids = NEUIGKEITEN.map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of NEUIGKEITEN) {
      expect(x.id).toMatch(/^u-\d{4}-\d{2}-\d{2}(-\d+)?$/);
      expect(x.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(x.id.startsWith(`u-${x.datum}`)).toBe(true);
      expect(x.abschnitte.flatMap(a => a.punkte).length).toBeGreaterThan(0);
    }
    for (let i = 1; i < NEUIGKEITEN.length; i++) expect(NEUIGKEITEN[i - 1].datum >= NEUIGKEITEN[i].datum).toBe(true);
  });

  it('Texte sind neutral (gehen an jede Instanz): keine Personennamen, keine festen Firmen, keine Beträge, keine Technik-Wörter', () => {
    const texte = NEUIGKEITEN.flatMap(x => [x.titel, x.kurz, x.kurzBusiness ?? '', ...x.abschnitte.flatMap(a => a.punkte.map(p => p.text))]);
    const verboten = [/\bkevin\b/i, /\bmalin\b/i, /\bben\b/i, /dieckmann/i, /kd ventures/i, /kemaris/i, /make innovation/i, /\d[\d.]*\s?(€|eur)/i, /\bbranch\b/i, /\bcommit\b/i, /\bmerge\b/i, /\bapi\//i];
    for (const t of texte) for (const v of verboten) expect(t, `${v} in „${t}“`).not.toMatch(v);
    for (const t of texte) expect(t.length).toBeLessThanOrEqual(400);
  });

  it('Wege führen nur in die App; jeder Punkt trägt seinen Bereich', () => {
    for (const p of NEUIGKEITEN.flatMap(x => x.abschnitte.flatMap(a => a.punkte))) {
      expect(['privat', 'business', 'alle']).toContain(p.bereich);
      if (p.weg !== undefined) expect(wegGueltig(p.weg), p.weg).toBe(true);
    }
    expect(wegGueltig('https://fremd.example/')).toBe(false);
    expect(wegGueltig('/os/kalender')).toBe(true);
    expect(wegGueltig('/osx')).toBe(false);
  });

  it('das Herbst-Update (u-2026-10-18) erklärt sich selbst (der Hinweis ist neu) und nennt Fulfillment', () => {
    // Nach Kennung, nicht nach Stelle — neuere Updates stehen davor.
    const texte = NEUIGKEITEN.find(x => x.id === 'u-2026-10-18')!.abschnitte.flatMap(a => a.punkte.map(p => p.text)).join(' ');
    expect(texte).toMatch(/Was ist neu/);
    expect(texte).toMatch(/Fulfillment/);
  });
});

describe('Sicht: ein Konto „nur Business“ bekommt keine Privat-Punkte', () => {
  const liste = [n('u-2026-10-20', '2026-10-20', [{ text: 'P', bereich: 'privat' }, { text: 'B', bereich: 'business' }, { text: 'A', bereich: 'alle', weg: 'https://x.example' }], { kurzBusiness: 'Kurz ohne Privat.' }),
    n('u-2026-10-19', '2026-10-19', [{ text: 'nur privat', bereich: 'privat' }])];

  it('volles Mitglied: alles; nur Business: ohne Privat, mit der Business-Fassung, Updates ohne Punkt fallen weg; unbekannt = wie nur Business', () => {
    const voll = neuigkeitenFuer(liste, { nurBusiness: false });
    expect(voll.map(x => x.id)).toEqual(['u-2026-10-20', 'u-2026-10-19']);
    expect(voll[0].kurz).toBe('Kurz für alle.');
    expect(voll[0].abschnitte[0].punkte.map(p => p.text)).toEqual(['P', 'B', 'A']);
    expect(voll[0].abschnitte[0].punkte[2].weg).toBeUndefined(); // fremder Weg fällt weg
    for (const k of [{ nurBusiness: true }, { nurBusiness: null }]) {
      const b = neuigkeitenFuer(liste, k);
      expect(b.map(x => x.id)).toEqual(['u-2026-10-20']);
      expect(b[0].kurz).toBe('Kurz ohne Privat.');
      expect(b[0].abschnitte[0].punkte.map(p => p.text)).toEqual(['B', 'A']);
      expect(JSON.stringify(b)).not.toMatch(/kurzBusiness/);
    }
  });

  it('die echte Liste: Business-Sicht ohne einen einzigen Privat-Punkt', () => {
    const b = neuigkeitenFuer(NEUIGKEITEN, { nurBusiness: true });
    expect(b.flatMap(x => x.abschnitte.flatMap(a => a.punkte)).some(p => p.bereich === 'privat')).toBe(false);
    expect(JSON.stringify(b)).not.toMatch(/Gesundheit|Routinen|Erholung/);
  });
});

describe('Ungelesen: einmal je Update und Person', () => {
  const liste = [n('u-3', '2026-10-30', [{ text: 'c', bereich: 'alle' }]), n('u-2', '2026-10-20', [{ text: 'b', bereich: 'alle' }]), n('u-1', '2026-10-10', [{ text: 'a', bereich: 'alle' }])];
  it('nach dem zuletzt gesehenen alles Neuere; das neueste gesehen = nichts', () => {
    expect(ungelesene(liste, 'u-1').map(x => x.id)).toEqual(['u-3', 'u-2']);
    expect(ungelesene(liste, 'u-3')).toEqual([]);
  });
  it('noch nie gesehen: nur Updates nach dem Anlegen des Kontos (neue Personen bekommen den Willkommensgruß, nicht die Geschichte)', () => {
    expect(ungelesene(liste, null, '2026-10-15').map(x => x.id)).toEqual(['u-3', 'u-2']);
    expect(ungelesene(liste, null, '2026-10-30')).toEqual([]);
    expect(ungelesene(liste, null, null).map(x => x.id)).toEqual(['u-3', 'u-2', 'u-1']);
    // eine unbekannte (gelöschte) Kennung zählt wie „nie gesehen“
    expect(ungelesene(liste, 'u-weg', '2026-10-25').map(x => x.id)).toEqual(['u-3']);
  });
});

type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; POST: Handler };
const sitzung = (p: string) => ({ 'x-make-user': p, 'content-type': 'application/json' });
const dienst = { 'x-make-key': 'pruef-schluessel-neuigkeiten', 'x-make-person': 'inhaberin', 'content-type': 'application/json' };
const get = async (h: Record<string, string>) => { const r = await route.GET(new Request('http://test/api/neuigkeiten', { headers: h })); return { status: r.status, d: await r.json() as { ok?: boolean; eintraege?: Neuigkeit[]; ungelesen?: Neuigkeit[]; gesehen?: string | null } }; };
const post = async (body: unknown, h: Record<string, string>) => { const r = await route.POST(new Request('http://test/api/neuigkeiten', { method: 'POST', headers: h, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as { ok?: boolean; error?: string } }; };

describe('Route /api/neuigkeiten', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const k = (id: string, speicher: string, rolle: string, haushalt: string, angelegt: string, extra: Record<string, unknown> = {}) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt, teilt: { gesundheit: [] }, haushalt, ...extra });
    await db.saveJson('konten', { konten: [
      k('k1', 'inhaberin', 'inhaber', 'haus', '2026-01-01'), k('k2', 'partnerin', 'mitglied', 'haus', '2026-01-01'),
      k('k3', 'vertrieb', 'mitglied', 'haus', '2026-01-01', { finanzRecht: 'business' }), k('k4', 'neu', 'mitglied', 'haus', '2099-01-01'),
      k('k5', 'fremd', 'mitglied', 'anderes-haus', '2026-01-01'),
    ], einladungen: [] });
    route = await import('@/app/api/neuigkeiten/route') as unknown as typeof route;
  });

  it('jede Person sieht das neueste Update als neu — einmal; nach „gesehen“ nicht mehr, die andere Person weiter', async () => {
    const a = await get(sitzung('inhaberin'));
    expect(a.status).toBe(200);
    expect(a.d.ungelesen?.[0]?.id).toBe(NEUIGKEITEN[0].id);
    expect(existsSync(path.join(ordner, 'neuigkeiten--inhaberin.json'))).toBe(false); // Lesen schreibt nie
    expect((await post({ gesehen: NEUIGKEITEN[0].id }, sitzung('inhaberin'))).status).toBe(200);
    expect((await get(sitzung('inhaberin'))).d.ungelesen).toEqual([]);
    expect((await get(sitzung('partnerin'))).d.ungelesen?.[0]?.id).toBe(NEUIGKEITEN[0].id);
  });

  it('nur Business: keine Privat-Punkte in der Antwort', async () => {
    const r = await get(sitzung('vertrieb'));
    expect(r.status).toBe(200);
    expect(r.d.eintraege!.flatMap(x => x.abschnitte.flatMap(a => a.punkte)).some(p => p.bereich === 'privat')).toBe(false);
  });

  it('ein Konto, das nach dem Update angelegt wurde, bekommt keinen Hinweis', async () => {
    expect((await get(sitzung('neu'))).d.ungelesen).toEqual([]);
  });

  it('Dienstweg und fremder Haushalt → 403, unbekannte Kennung → 400, kaputtes JSON → 400; nichts gespeichert', async () => {
    expect((await get(dienst)).status).toBe(403);
    expect((await post({ gesehen: NEUIGKEITEN[0].id }, dienst)).status).toBe(403);
    expect((await get(sitzung('fremd'))).status).toBe(403);
    expect((await post({ gesehen: 'u-1999-01-01' }, sitzung('partnerin'))).status).toBe(400);
    expect((await post({ gesehen: 7 }, sitzung('partnerin'))).status).toBe(400);
    const roh = await route.POST(new Request('http://test/api/neuigkeiten', { method: 'POST', headers: sitzung('partnerin'), body: '{kaputt' }));
    expect(roh.status).toBe(400);
    expect(existsSync(path.join(ordner, 'neuigkeiten--partnerin.json'))).toBe(false);
  });

  it('nie rückwärts: ein älteres Update macht neuere nicht wieder neu', async () => {
    const { gesehenSetzen, neuigkeitenStand } = await import('@/lib/neuigkeiten/server');
    if (NEUIGKEITEN.length > 1) {
      await gesehenSetzen('inhaberin', NEUIGKEITEN[NEUIGKEITEN.length - 1].id);
      expect((await neuigkeitenStand('inhaberin')).gesehen).toBe(NEUIGKEITEN[0].id);
    }
    expect(istNeuigkeit(NEUIGKEITEN[0].id)).toBe(true);
  });
});

describe('Verdrahtung', () => {
  it('der Hinweis läuft im Rahmen jeder /os-Seite; die Seite steht in Einstellungen und in der Suche', () => {
    expect(lies('app/os/layout.tsx')).toMatch(/<UpdateHinweis \/>/);
    expect(lies('lib/make-one/einstellungen.ts')).toMatch(/'\/os\/neuigkeiten'/);
    expect(lies('lib/make-one/seiten.ts')).toMatch(/'\/os\/neuigkeiten'/);
    expect(existsSync(path.join(wurzel, 'app/os/neuigkeiten/page.tsx'))).toBe(true);
  });
  it('Route und Bestand stehen in den Registern; die Regel steht in CLAUDE.md', () => {
    expect(lies('lib/zugang/routen-register.ts')).toMatch(/'neuigkeiten': r\('GET,POST', 'person'/);
    expect(lies('lib/crm/speicher-register.ts')).toMatch(/neuigkeiten--\*/);
    expect(lies('lib/datenschutz/konto-daten.ts')).toMatch(/basis: 'neuigkeiten', nurMitSuffix: true/);
    expect(lies('CLAUDE.md')).toMatch(/lib\/neuigkeiten\/eintraege\.ts/);
  });
});

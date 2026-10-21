// ─── Prozesse · Kundengewinnung — „Aus Vorlage anlegen“ (22.10.) ──────────────────────────────────────────────────────────────────────────────────────
// Rein: neue Kennungen bei jeder Übernahme, Teile zuerst veröffentlicht, Verweise innen auf die neuen Kennungen (Zweige, Schlösser, Schleife, „erneut ab“),
// Übergabe an eine Vorlage → eigener Prozess aus dieser Vorlage bzw. „Ziel erreicht“ mit Hinweis, Probelauf nur mit dem Recht dazu, Grenzen.
// Route: Galerie (GET ?vorlagen=1, ?vorlage=), POST `aus-vorlage` (einmalig, Eigner aus dem Team), Sicht Privat 403, Dienstweg schreibt nie.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ausVorlageAnwenden, prozessAusVorlage, uebernommene } from '@/lib/prozesse/kundengewinnung/uebernehmen';
import { leerProzesse } from '@/lib/prozesse/bestand';
import { prozessRechte } from '@/lib/prozesse/rollen';
import { definitionPruefen, sperrtVeroeffentlichen } from '@/lib/prozesse/definition-pruefen';
import { schlossKennung, schlossFehlt } from '@/lib/prozesse/schloss';
import { PROZESS_KENNUNG, KNOTEN_KENNUNG, PROZESS_GRENZEN, type ProzesseDatei } from '@/lib/prozesse/definition';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-vorlagen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-vorlagen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const VOLL = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: false, nurBusiness: false });
const BUSINESS = prozessRechte({ imHaushalt: true, vollesMitglied: false, inhaber: false, nurBusiness: true });
const J = '2026-10-22T08:00:00.000Z';
let zaehler = 0;
const kennung = (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-${String(++zaehler).padStart(12, '0')}`;
const kx = (extra: Record<string, unknown> = {}) => ({ person: 'pia', jetzt: J, rechte: VOLL, neueKennung: kennung, eigner: 'konto-pia', ...extra });

describe('Übernehmen (rein)', () => {
  it('V09 mit Teilprozess: zwei Prozesse, neue Kennungen, Schleife zeigt auf den neuen Teil und die neue Abfrage — beide veröffentlicht und im Probelauf', () => {
    const r = ausVorlageAnwenden(leerProzesse(), 'kg-v09', kx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datei.prozesse).toHaveLength(2);
    expect(r.teile).toHaveLength(1);
    const [teil, haupt] = r.datei.prozesse;
    for (const p of r.datei.prozesse) {
      expect(p.id).toMatch(PROZESS_KENNUNG);
      expect(p.entwurf.id).toBe(p.id);
      expect(p.status).toBe('probelauf');
      expect(p.versionen).toHaveLength(1);
      expect(p.versionen[0].name).toBe('Aus Vorlage');
      expect(p.entwurf.eigner).toBe('konto-pia');
      for (const k of p.entwurf.knoten) expect(k.schloss ? k.id === schlossKennung(k.schloss.fuer) : KNOTEN_KENNUNG.test(k.id), k.id).toBe(true);
      expect(schlossFehlt(p.entwurf)).toBe(false);
    }
    expect(haupt.entwurf.herkunft).toMatchObject({ art: 'muster', quelleIds: ['kg-v09'] });
    expect(teil.entwurf.herkunft).toMatchObject({ art: 'muster', quelleIds: ['kg-v09a'] });
    const schleife = haupt.entwurf.knoten.find(k => k.form === 'schleife')!;
    expect(schleife.schleife!.prozessId).toBe(teil.id);
    const abfrage = haupt.entwurf.knoten.find(k => k.abfrage)!;
    expect(schleife.schleife!.liste).toBe(`abfrage:${abfrage.id}`);
    // Zweige zeigen auf vorhandene Knoten desselben Prozesses.
    for (const p of r.datei.prozesse) {
      const ids = new Set(p.entwurf.knoten.map(k => k.id));
      for (const k of p.entwurf.knoten) for (const z of Object.values(k.zweige ?? {})) expect(ids.has(z!), `${k.titel} → ${z}`).toBe(true);
      for (const k of p.entwurf.knoten) if (k.erneut) expect(ids.has(k.erneut.ab)).toBe(true);
    }
    expect(r.probelauf).toBe(true);
    expect(JSON.stringify(r.datei)).not.toMatch(/"kg-v09(a)?:/);
  });
  it('zweimal übernehmen erzeugt zwei Sätze mit neuen Kennungen', () => {
    const a = ausVorlageAnwenden(leerProzesse(), 'kg-v12', kx());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = ausVorlageAnwenden(a.datei, 'kg-v12', kx());
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.datei.prozesse).toHaveLength(2);
    const [x, y] = b.datei.prozesse;
    expect(x.id).not.toBe(y.id);
    const kx1 = new Set(x.entwurf.knoten.map(k => k.id));
    expect(y.entwurf.knoten.some(k => kx1.has(k.id))).toBe(false);
  });
  it('Übergabe an eine Vorlage: ohne eigenen Prozess „Ziel erreicht“ mit Hinweis — danach zeigt sie auf den eigenen Prozess aus dieser Vorlage', () => {
    const a = ausVorlageAnwenden(leerProzesse(), 'kg-v13', kx());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.haupt.entwurf.knoten.filter(k => k.ende?.ergebnis === 'uebergabe')).toHaveLength(0);
    expect(a.hinweise.join(' ')).toMatch(/Geparkte Leads wiederbeleben/);
    const v08 = ausVorlageAnwenden(leerProzesse(), 'kg-v08', kx());
    expect(v08.ok).toBe(true);
    if (!v08.ok) return;
    const b = ausVorlageAnwenden(v08.datei, 'kg-v13', kx());
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const ue = b.haupt.entwurf.knoten.filter(k => k.ende?.ergebnis === 'uebergabe');
    expect(ue.length).toBeGreaterThan(0);
    const ziel = prozessAusVorlage(b.datei, 'kg-v08')!;
    for (const k of ue) expect(k.ende!.uebergabeAn).toBe(ziel.id);
    expect(uebernommene(b.datei)).toMatchObject({ 'kg-v08': ziel.id, 'kg-v13': b.haupt.id });
  });
  it('alle 18 Vorlagen lassen sich übernehmen; jede veröffentlichte Fassung besteht die Prüfung', () => {
    let d: ProzesseDatei = leerProzesse();
    for (const id of ['kg-v01', 'kg-v02', 'kg-v03', 'kg-v04', 'kg-v05', 'kg-v06', 'kg-v07', 'kg-v08', 'kg-v09', 'kg-v10', 'kg-v11', 'kg-v12', 'kg-v13', 'kg-v14', 'kg-v15', 'kg-v16', 'kg-v17', 'kg-v18']) {
      const r = ausVorlageAnwenden(d, id, kx());
      expect(r.ok, id).toBe(true);
      if (!r.ok) return;
      expect(r.haupt.status, id).toBe('probelauf');
      d = r.datei;
    }
    expect(d.prozesse).toHaveLength(18 + 6);
    const kontext = { prozess: (id: string) => { const p = d.prozesse.find(x => x.id === id); return p ? { titel: p.entwurf.titel, veroeffentlicht: p.versionen.length > 0 } : null; } };
    for (const p of d.prozesse) expect(sperrtVeroeffentlichen(definitionPruefen(p.versionen[0].definition, kontext)), p.entwurf.titel).toBe(false);
  });
  it('Konto „nur Business“: Entwürfe ja, ohne Version und ohne Probelauf — mit Hinweis', () => {
    const r = ausVorlageAnwenden(leerProzesse(), 'kg-v07', kx({ rechte: BUSINESS }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.haupt.status).toBe('entwurf');
    expect(r.haupt.versionen).toHaveLength(0);
    expect(r.probelauf).toBe(false);
    expect(r.hinweise.join(' ')).toMatch(/volle Mitglieder/);
  });
  it('ohne Recht 403, unbekannte Vorlage 404, über der Grenze 413 (nichts angelegt)', () => {
    expect(ausVorlageAnwenden(leerProzesse(), 'kg-v07', kx({ rechte: prozessRechte(null) }))).toMatchObject({ ok: false, status: 403 });
    expect(ausVorlageAnwenden(leerProzesse(), 'kg-v99', kx())).toMatchObject({ ok: false, status: 404 });
    const voll = { v: 1 as const, prozesse: Array.from({ length: PROZESS_GRENZEN.prozesse - 1 }, () => leerProzesse().prozesse).flat() };
    const fast = ausVorlageAnwenden(leerProzesse(), 'kg-v07', kx());
    if (!fast.ok) throw new Error('V07');
    const viele = { ...voll, prozesse: Array.from({ length: PROZESS_GRENZEN.prozesse - 1 }, () => fast.haupt) };
    expect(ausVorlageAnwenden(viele, 'kg-v09', kx())).toMatchObject({ ok: false, status: 413 });
  });
  it('ohne Eigner: übernommen, aber mit Hinweis (ohne Eigner wird kein Prozess aktiv)', () => {
    const r = ausVorlageAnwenden(leerProzesse(), 'kg-v07', { person: 'pia', jetzt: J, rechte: VOLL, neueKennung: kennung });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.haupt.entwurf.eigner).toBeUndefined(); expect(r.hinweise.join(' ')).toMatch(/ohne Eigner/i); }
  });
});

// ── Über die Route ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function post(kopf: Record<string, string>, body: Record<string, unknown>) {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m.POST(new Request('http://test/api/prozesse/werkstatt?space=business', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function get(kopf: Record<string, string>, suche: string) {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m.GET(new Request(`http://test/api/prozesse/werkstatt${suche}`, { headers: kopf }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('Galerie und „Aus Vorlage anlegen“ über die Route', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: 'haus-vl' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-vl', finanzRecht: 'business' }), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer' })], einladungen: [] });
  });
  it('GET ?vorlagen=1: 18 Vorlagen in Kurzform, ohne Personen; fremder Haushalt und Sicht Privat → 403', async () => {
    const g = await get(sitzung('pia'), '?vorlagen=1&space=business');
    expect(g.status).toBe(200);
    expect(g.j.vorlagen).toHaveLength(18);
    expect(g.j.vorlagen[0]).toMatchObject({ id: 'kg-v01', nr: 'V01' });
    expect(g.j.uebernommen).toEqual({});
    expect((await get(sitzung('gast'), '?vorlagen=1')).status).toBe(403);
    expect((await get(sitzung('pia'), '?vorlagen=1&space=privat')).status).toBe(403);
    const v = await get(sitzung('pia'), '?vorlage=kg-v12&space=business');
    expect(v.status).toBe(200);
    expect(v.j.vorlage.vorschau.length).toBeGreaterThan(0);
    expect((await get(sitzung('pia'), '?vorlage=kg-v99')).status).toBe(404);
  });
  it('POST aus-vorlage: einmalig über anfrageId, Eigner nur aus dem Team, Dienstweg 403', async () => {
    const a = await post(sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'kg-v09', eigner: 'konto-pia', anfrageId: 'pza-00000000-0000-4000-8000-000000000001' });
    expect(a.status).toBe(200);
    expect(a.j.eintrag.status).toBe('probelauf');
    expect(a.j.teile).toHaveLength(1);
    const nochmal = await post(sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'kg-v09', eigner: 'konto-pia', anfrageId: 'pza-00000000-0000-4000-8000-000000000001' });
    expect(nochmal.j.eintrag.id).toBe(a.j.eintrag.id);
    const liste = await get(sitzung('pia'), '?space=business');
    expect(liste.j.prozesse.filter((p: { quelle: string }) => p.quelle === 'werkstatt')).toHaveLength(2);
    expect((await post(sitzung('pia'), { aktion: 'aus-vorlage', vorlageId: 'kg-v07', eigner: 't-gibt-es-nicht', anfrageId: 'pza-00000000-0000-4000-8000-000000000002' })).status).toBe(400);
    expect((await post({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' }, { aktion: 'aus-vorlage', vorlageId: 'kg-v07' })).status).toBe(403);
    const g = await get(sitzung('pia'), '?vorlagen=1&space=business');
    expect(Object.keys(g.j.uebernommen).sort()).toEqual(['kg-v09', 'kg-v09a']);
  });
  it('Konto „nur Business“ legt aus der Vorlage einen Entwurf an (veröffentlichen nur volle Mitglieder)', async () => {
    const a = await post(sitzung('olaf'), { aktion: 'aus-vorlage', vorlageId: 'kg-v07', anfrageId: 'pza-00000000-0000-4000-8000-000000000003' });
    expect(a.status).toBe(200);
    expect(a.j.eintrag.status).toBe('entwurf');
    expect(a.j.hinweise.join(' ')).toMatch(/volle Mitglieder/);
  });
});

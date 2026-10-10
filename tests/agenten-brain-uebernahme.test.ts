/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen Antworten und Bestände als JSON */
// ─── Wächter: „Aus dem Brain übernehmen“ (09.10.; lib/agenten/brain-agenten.ts + brain-agenten-server.ts + /api/agenten/brain) ──────────
// Ein erfundener Mini-Vault mit Agenten-Notizen (Kopf + Abschnitte wie Mission, Sub-Agenten, Wissen, Darf, Freigabe) und einem Index.
// Geprüft: Lesen nach Struktur (nie feste Inhalte), Zuordnung Datei → Head (Synonyme, Index, Kopf `unter`), Plan (Auftrag, Stufe, Mitarbeiter,
// Wissen) mit Aktion und Grund · NUR Business-Heads (Firma und Privat getrennt) · private Notizen nie · Vorschau schreibt nichts · Übernahme über
// die vorhandenen Schreibwege (Einstellung mit Stand → 409, Werkstatt, Wissen im Business-Bestand) · der Browser schickt nur die Auswahl (Text
// kommt neu aus dem Vault) · zweite Übernahme legt nichts doppelt an · Rechte (nur Inhaber, Dienstweg 403). Eigener Datenordner und Vault.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { promises as fs, rmSync } from 'node:fs';
import path from 'node:path';

const { wurzel, vault } = await vi.hoisted(async () => {
  const fsm = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fsm.mkdtempSync(p.join(os.tmpdir(), 'make-os-brain-agenten-'));
  const vault = p.join(wurzel, 'Vault', 'Brain');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: p.join(wurzel, 'daten'), MAKE_VAULT_DIR: vault, MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus',
    MAKE_OS_KEY: 'pruef-schluessel-brain-agenten', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_EMBEDDINGS: 'aus',
  });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return { wurzel, vault };
});
afterAll(() => rmSync(wurzel, { recursive: true, force: true }));

import * as B from '@/lib/agenten/brain-agenten';
import { auftragBrainBlock, auftragHash } from '@/lib/agenten/auftrag';
import { fremd } from '@/lib/anthropic';
import { einstellungBestand, wissenBestand, skillsHaushaltBestand, GRENZEN } from '@/lib/agenten/typen';

const H = 'haus-a';
const ORDNER = '01. Firma Brain/Agenten';
const schreibe = async (rel: string, text: string) => { const p = path.join(vault, rel); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, text, 'utf8'); };

const VERTRIEB = `---
type: agent
scope: intern
abteilung: sales
modell: stark
status: entwurf
---

# Agent · Vertrieb / Umsatz

> Vorspann der Notiz — wird nicht übernommen.

## Mission
Pipeline pflegen und Abschlüsse vorbereiten.

## Sub-Agenten (aus dem Code)
prospect · crm · outreach · funnel

## Wissen, das diese Abteilung bekommt
[[Vertrieb_Wissen]], [[Gibt_Es_Nicht]], [[Privates_Ding]], Firmen/

Alles andere sieht diese Abteilung nicht. Grundlage: [[Allgemein]].

## Darf
Entwürfe schreiben, **nichts** senden.

## Freigabe-Gate (nie ohne Menschen)
Jede Nachricht nach außen.

## Werkzeug-Manifest
| Werkzeug | Zweck |
|---|---|
| — | — |
`;

type H = (r: Request) => Promise<Response>;
type J = Record<string, any>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = () => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! });
const anfrage = async (h: H, url: string, methode: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${url}`, { method: methode, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const text = await r.text();
  let j: J = {};
  try { j = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: r.status, j, text };
};
let brain: { GET: H; POST: H };
let agenten: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  await fs.mkdir(path.join(wurzel, 'Vault', '.obsidian'), { recursive: true });
  await schreibe(`${ORDNER}/_Agenten_Index.md`, '---\ntype: index\nscope: intern\n---\n# Agenten\n\n| Abteilung | Datei | Modell |\n|---|---|---|\n| Vertrieb | [[vertrieb]] | stark |\n| Betrieb und Abläufe | [[ops]] | schnell |\n| Team / Fürsorge | [[team]] | schnell |\n');
  await schreibe(`${ORDNER}/vertrieb.md`, VERTRIEB);
  await schreibe(`${ORDNER}/ops.md`, '---\ntype: agent\nscope: intern\nabteilung: ops\nmodell: schnell\n---\n# Agent · Betrieb\n\n## Mission\nAbläufe am Laufen halten.\n\n## Sub-Agenten\ninbox · kalender · wissen\n');
  await schreibe(`${ORDNER}/finance.md`, '---\ntype: agent\nscope: intern\n---\n# Agent · Finance\n\n## Mission\nZahlen im Blick behalten.\n\n## Sub-Agenten\ncontrolling · board\n');
  await schreibe(`${ORDNER}/health.md`, '---\ntype: agent\nscope: intern\nabteilung: health\n---\n# Agent · Gesundheit\n\n## Mission\nRuhe und Erholung.\n');
  await schreibe(`${ORDNER}/team.md`, '---\ntype: agent\nscope: intern\nabteilung: team\n---\n# Agent · Team / Fürsorge\n\n## Mission\nAuf das Team achten.\n\n## Sub-Agenten\nfokus · health\n');
  await schreibe(`${ORDNER}/geheim.md`, '---\ntype: agent\nscope: privat\nowner: person-a\nabteilung: sales\n---\n# Agent · Geheim\n\n## Mission\nGEHEIMER-AUFTRAG-MARKE\n');
  await schreibe(`${ORDNER}/helfer.md`, '---\ntype: mitarbeiter\nscope: intern\nunter: sales\n---\n# Angebots-Helfer\n\n## Mission\nBereitet Angebote vor. Prüft Preise.\n\n## Darf\nNur lesen.\n');
  await schreibe('01. Firma Brain/02_Vertrieb_Wissen/Vertrieb_Wissen.md', '---\ntype: wissen\nscope: intern\n---\n# Vertrieb_Wissen\n\nPreisliste Beispiel.\n');
  await schreibe('01. Firma Brain/02_Vertrieb_Wissen/Privates_Ding.md', '---\ntype: notiz\nscope: privat\nowner: person-a\n---\n# Privates_Ding\n\nNur für die Person.\n');
  await schreibe('01. Firma Brain/Firmen/Kunde Probe.md', '---\ntype: firma\nscope: intern\n---\n# Kunde Probe\n\nEin erfundener Kunde.\n');
  await schreibe('03. Sonstiges/Allgemein.md', '---\nscope: intern\n---\n# Allgemein\n\nGrundlage.\n');
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `Name ${speicher}`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: H }), konto('k2', 'person-b', 'mitglied', { haushalt: H }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
  ], einladungen: [] });
  brain = await import('@/app/api/agenten/brain/route') as unknown as typeof brain;
  agenten = await import('@/app/api/agenten/route') as unknown as typeof agenten;
});

// ── Rein: lesen, zuordnen, planen ────────────────────────────────────────────────────────────────────────────────────────

const roh = (pfad: string, text: string) => { const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)!; const felder: Record<string, string> = {}; for (const z of m[1].split('\n')) { const kv = /^([\w-]+):\s*(.*)$/.exec(z); if (kv) felder[kv[1]] = kv[2]; } return { pfad, felder, rumpf: text.slice(m[0].length) }; };

describe('Agenten-Notiz lesen (rein, nach Struktur)', () => {
  const d = B.agentDateiLesen(roh(`${ORDNER}/vertrieb.md`, VERTRIEB));
  it('Kopf, Titel ohne „Agent ·“, Abschnitte nach Rolle — Vorspann, Tabellen und unbekannte Abschnitte bleiben draußen', () => {
    expect(d.titel).toBe('Vertrieb / Umsatz');
    expect(d.kopf).toMatchObject({ typ: 'agent', abteilung: 'sales', modell: 'stark', status: 'entwurf' });
    expect(d.mitarbeiter).toEqual(['prospect', 'crm', 'outreach', 'funnel']);
    expect(d.wissen.links).toEqual(['Vertrieb_Wissen', 'Gibt_Es_Nicht', 'Privates_Ding']);
    expect(d.wissen.ordner).toEqual(['Firmen']);
    expect(d.ignoriert).toEqual(['Werkzeug-Manifest']);
    const a = B.auftragAusDatei(d);
    expect(a).toContain('Auftrag: Pipeline pflegen');
    expect(a).toContain('Darf: Entwürfe schreiben, nichts senden.');
    expect(a).toContain('Nur mit Freigabe eines Menschen: Jede Nachricht nach außen.');
    expect(a).not.toMatch(/Vorspann|Werkzeug|\|/);
  });
  it('Zuordnung über Kopf, Dateiname, Synonyme und Index — eindeutig oder gar nicht', () => {
    const index = B.indexLesen('| Betrieb und Abläufe | [[ops]] | schnell |\n- Rechnungswesen: [[geld]]\n');
    expect(index.get('ops')).toBe('Betrieb und Abläufe');
    expect(index.get('geld')).toBe('Rechnungswesen');
    const z = (pfad: string, text: string) => B.zuordnen(B.agentDateiLesen(roh(pfad, text)), new Map());
    expect(z('A/finance.md', '---\ntype: agent\n---\n# Agent · Finance\n').headId).toBe('finanzen');
    expect(z('A/ops.md', '---\ntype: agent\n---\n# Agent · X\n').headId).toBe('operations');
    expect(z('A/x.md', '---\ntype: agent\n---\n# Agent · Vertrieb / Umsatz\n').headId).toBe('sales');
    expect(z('A/x.md', '---\ntype: agent\n---\n# Agent · Product (Software)\n').headId).toBe('produkt');
    expect(z('A/x.md', '---\ntype: agent\n---\n# Agent · Team / Fürsorge\n').headId).toBeNull();
    const ma = z('A/helfer.md', '---\ntype: mitarbeiter\nunter: marketing\n---\n# Helfer\n');
    expect(ma).toMatchObject({ headId: 'marketing', als: 'mitarbeiter' });
    expect(B.zuordnen(B.agentDateiLesen(roh('A/y.md', '---\ntype: agent\n---\n# Agent · Unbekannt\n')), new Map([['y', 'Rechnungswesen / Finance']])).headId).toBe('finanzen');
  });
  it('der Auftrag aus dem Brain steht gekapselt im System-Text — nie „von einem Menschen geschrieben“', () => {
    const block = auftragBrainBlock({ ebene: 'haushalt' }, 'Auftrag: X', fremd);
    expect(block).toContain('<fremde_daten quelle="brain-auftrag">');
    expect(block).not.toContain('von einem Menschen geschrieben');
    expect(auftragHash('a\r\nb')).toBe(auftragHash('a\nb'));
  });
  it('Auswahl prüfen: Form, unbekannter Head 400, zu viele 413', () => {
    expect(B.wahlPruefen([{ datei: 'a.md', headId: 'gibt-es-nicht' }]).ok).toBe(false);
    expect(B.wahlPruefen(Array.from({ length: 61 }, (_, i) => ({ datei: `${i}.md` })))).toMatchObject({ ok: false, status: 413 });
    expect(B.wahlPruefen([{ datei: 'a.md', auftrag: true, text: 'eingeschleust' }])).toMatchObject({ ok: true, wahl: [{ datei: 'a.md', auftrag: true }] });
    expect((B.wahlPruefen([{ datei: 'a.md', auftrag: true, text: 'x' }]) as any).wahl[0].text).toBeUndefined();
  });
});

// ── Route: Vorschau, Übernahme, Rechte ──────────────────────────────────────────────────────────────────────────────────

const vorschau = async (p = 'person-a') => anfrage(brain.GET, '/api/agenten/brain', 'GET', sitzung(p));
const eintrag = (j: J, name: string) => (j.eintraege as B.PlanEintrag[]).find(e => e.name === name)!;

describe('Rechte — nur ein Inhaber, nie der Dienstweg', () => {
  it('Mitglied 403, fremder Haushalt 403, Dienstweg 403 (GET und POST)', async () => {
    expect((await vorschau('person-b')).status).toBe(403);
    expect((await vorschau('gast')).status).toBe(403);
    expect((await anfrage(brain.GET, '/api/agenten/brain', 'GET', dienst())).status).toBe(403);
    expect((await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-b'), { aktion: 'uebernehmen', auswahl: [{ datei: 'x.md' }] })).status).toBe(403);
    expect((await anfrage(brain.POST, '/api/agenten/brain', 'POST', dienst(), { aktion: 'uebernehmen', auswahl: [{ datei: 'x.md' }] })).status).toBe(403);
  });
});

describe('Vorschau (schreibt nichts)', () => {
  it('findet den Ordner über den Index, plant je Datei — Business-Heads, private Notizen nie', async () => {
    const r = await vorschau();
    expect(r.status).toBe(200);
    expect(r.j.ordner).toEqual({ pfad: ORDNER, quelle: 'index' });
    expect(r.text).not.toContain('GEHEIMER-AUFTRAG-MARKE');
    expect((r.j.eintraege as B.PlanEintrag[]).map(e => e.name).sort()).toEqual(['finance', 'health', 'helfer', 'ops', 'team', 'vertrieb']);
    expect((r.j.heads as { bereich: string }[]).every(h => h.bereich === 'business')).toBe(true);
    // nichts geschrieben
    expect(await db.loadJson(einstellungBestand(H))).toBeNull();
    expect(await db.loadJson(wissenBestand(H))).toBeNull();

    const v = eintrag(r.j, 'vertrieb');
    expect(v.ziel).toEqual({ headId: 'sales', headName: 'Head of Sales', als: 'head' });
    expect(v.auftrag?.aktion).toBe('neu');
    expect(v.stufe).toEqual({ datei: 'stark', heute: 'ausgewogen' });
    expect(Object.fromEntries(v.mitarbeiter.map(m => [m.kuerzel, m.aktion]))).toEqual({ prospect: 'vorhanden', crm: 'vorhanden', outreach: 'anlegen', funnel: 'uebersprungen' });
    expect(v.mitarbeiter.find(m => m.kuerzel === 'outreach')?.neu?.agentId).toBe('outreach');
    expect(v.wissen).toEqual([
      { pfad: '01. Firma Brain/02_Vertrieb_Wissen', art: 'ordner', aus: 'Vertrieb_Wissen', aktion: 'neu' },
      { pfad: '01. Firma Brain/Firmen', art: 'ordner', aus: 'Firmen/', aktion: 'neu' },
    ]);
    // nicht gefunden: gibt es nicht, oder privat (nie an Agenten) — und der zweite Absatz (Erklärung) zählt nicht
    expect(v.wissenNichtGefunden).toEqual(['Gibt_Es_Nicht', 'Privates_Ding']);

    const ops = eintrag(r.j, 'ops');
    expect(ops.ziel?.headId).toBe('operations');
    expect(Object.fromEntries(ops.mitarbeiter.map(m => [m.kuerzel, m.aktion]))).toEqual({ inbox: 'vorhanden', kalender: 'vorhanden', wissen: 'uebersprungen' });
    expect(ops.mitarbeiter.find(m => m.kuerzel === 'kalender')?.grund).toContain('Persönliche Assistenz');
    expect(eintrag(r.j, 'finance').ziel?.headId).toBe('finanzen');
    // Privat-Agent: übersprungen (Firma und Privat getrennt); unbekannt: kein Ziel
    expect(eintrag(r.j, 'health').ziel).toBeNull();
    expect(eintrag(r.j, 'health').zielGrund).toContain('Privat-Agent');
    expect(eintrag(r.j, 'team').ziel).toBeNull();
    const helfer = eintrag(r.j, 'helfer');
    expect(helfer.ziel).toMatchObject({ headId: 'sales', als: 'mitarbeiter' });
    expect(helfer.mitarbeiter[0]).toMatchObject({ aktion: 'anlegen', neu: { name: 'Angebots-Helfer', rolle: 'Bereitet Angebote vor.' } });
  });
  it('ein Ziel in der Vorschau wählen: ein Privat-Head bleibt ausgeschlossen, „als Mitarbeiter“ geht', async () => {
    const r = await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'vorschau', ziele: { [`${ORDNER}/team.md`]: { headId: 'strategie', als: 'mitarbeiter' }, [`${ORDNER}/health.md`]: { headId: 'gesundheit' } } });
    expect(r.status).toBe(200);
    expect(eintrag(r.j, 'team').ziel).toMatchObject({ headId: 'strategie', als: 'mitarbeiter' });
    expect(eintrag(r.j, 'health').ziel).toBeNull();
  });
});

describe('Übernehmen — vorhandene Schreibwege, nur Business, nichts doppelt', () => {
  let erste: J;
  it('schreibt Auftrag (aus dem Brain markiert), Wissen im Business-Bestand und Mitarbeiter — der Text kommt aus dem Vault, nie aus dem Browser', async () => {
    const v = await vorschau();
    const auswahl = (v.j.vorauswahl as B.UebernahmeWahl[]).map(w => ({ ...w, auftragText: 'EINGESCHLEUST' }));
    const staende = Object.fromEntries((v.j.eintraege as B.PlanEintrag[]).filter(e => e.ziel && e.stand).map(e => [e.ziel!.headId, e.stand]));
    const wissenStaende = Object.fromEntries((v.j.eintraege as B.PlanEintrag[]).filter(e => e.ziel && e.wissenStand).map(e => [e.ziel!.headId, e.wissenStand]));
    const r = await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'uebernehmen', auswahl, staende, wissenStaende });
    expect(r.status).toBe(200);
    erste = r.j;
    expect((r.j.ergebnisse as { ok: boolean; teil: string; text: string }[]).filter(x => !x.ok)).toEqual([]);
    expect(r.text).not.toContain('EINGESCHLEUST');

    const e = await db.loadJson<any>(einstellungBestand(H));
    expect(e.heads.sales.auftrag).toBe(eintrag(v.j, 'vertrieb').auftrag!.text);
    expect(e.heads.sales.auftrag).not.toContain('EINGESCHLEUST');
    expect(e.heads.sales.auftragQuelle).toMatchObject({ art: 'brain', datei: `${ORDNER}/vertrieb.md`, von: 'person-a', hash: auftragHash(e.heads.sales.auftrag) });
    expect(e.heads.sales.stufe).toBeUndefined(); // Stufe nie von selbst
    expect(e.heads.operations.auftrag).toContain('Abläufe am Laufen halten');
    expect(e.personen).toBeUndefined();
    expect(e.heads.gesundheit).toBeUndefined();
    // Wissen: eigener Business-Bestand, NICHT in den Einstellungen (Firma und Privat getrennt)
    expect(JSON.stringify(e)).not.toContain('Vertrieb_Wissen');
    const w = await db.loadJson<any>(wissenBestand(H));
    expect(w.heads.sales).toMatchObject({ pfade: ['01. Firma Brain/02_Vertrieb_Wissen', '01. Firma Brain/Firmen'], modus: 'bevorzugt', geaendertVon: 'person-a' });
    expect(Object.keys(w.heads).every(id => ['sales', 'marketing', 'event', 'finanzen', 'it', 'operations', 'kundenerfolg', 'strategie', 'produkt', 'recht', 'research'].includes(id))).toBe(true);
    // Mitarbeiter: früherer Fach-Agent (Name/Rolle aus der Software, nicht fremd) und Mitarbeiter aus einer Notiz (Anleitung = Text aus dem Vault)
    const ws = await db.loadJson<any>(skillsHaushaltBestand(H));
    const outreach = ws.mitarbeiter.find((m: any) => m.agentId === 'outreach');
    expect(outreach).toMatchObject({ headId: 'sales', herkunft: { art: 'brain', datei: `${ORDNER}/vertrieb.md`, kuerzel: 'outreach' }, werkzeuge: [] });
    expect(outreach.ausFremdemText).toBeUndefined();
    const helfer = ws.mitarbeiter.find((m: any) => m.name === 'Angebots-Helfer');
    expect(helfer).toMatchObject({ headId: 'sales', ausFremdemText: true, herkunft: { art: 'brain', datei: `${ORDNER}/helfer.md` } });
    expect(helfer.anleitung).toContain('Darf: Nur lesen.');
  });
  it('zweite Vorschau: alles schon da — nichts vorausgewählt, nichts doppelt', async () => {
    expect(erste).toBeTruthy();
    const v = await vorschau();
    const vt = eintrag(v.j, 'vertrieb');
    expect(vt.auftrag?.aktion).toBe('gleich');
    expect(vt.mitarbeiter.find(m => m.kuerzel === 'outreach')?.aktion).toBe('vorhanden');
    expect(vt.wissen.every(x => x.aktion === 'schon')).toBe(true);
    expect(eintrag(v.j, 'helfer').mitarbeiter[0].aktion).toBe('vorhanden');
    const sel = (v.j.vorauswahl as B.UebernahmeWahl[]).find(w => w.datei === `${ORDNER}/vertrieb.md`)!;
    expect(sel).toMatchObject({ auftrag: false, mitarbeiter: [], wissen: [] });
  });
  it('von Hand geänderter Auftrag: Vorschau sagt „eigener“, GET /api/agenten zeigt „aus dem Brain, geändert“; Ersetzen nur ausdrücklich', async () => {
    const a = await anfrage(agenten.GET, '/api/agenten', 'GET', sitzung('person-a'));
    const sales = (a.j.heads as any[]).find(h => h.id === 'sales');
    expect(sales.einstellung.auftrag.ausBrain).toEqual({ datei: `${ORDNER}/vertrieb.md`, geaendert: false });
    expect(sales.einstellung.wissen).toEqual({ pfade: ['01. Firma Brain/02_Vertrieb_Wissen', '01. Firma Brain/Firmen'], modus: 'bevorzugt' });
    expect(typeof sales.einstellung.wissenStand).toBe('string');
    // Privat-Heads tragen kein Wissen
    for (const h of (a.j.heads as any[]).filter(x => x.bereich === 'privat')) expect(h.einstellung?.wissenStand).toBeUndefined();
    const p = await anfrage(agenten.POST, '/api/agenten', 'POST', sitzung('person-a'), { aktion: 'einstellung', headId: 'sales', teil: { auftrag: `${sales.einstellung.auftrag.text}\nUnd duzen.` }, stand: sales.einstellung.stand });
    expect(p.status).toBe(200);
    const v = await vorschau();
    expect(eintrag(v.j, 'vertrieb').auftrag?.aktion).toBe('eigener');
    const sel = (v.j.vorauswahl as B.UebernahmeWahl[]).find(w => w.datei === `${ORDNER}/vertrieb.md`)!;
    expect(sel.auftrag).toBe(false);
    const b = await anfrage(agenten.GET, '/api/agenten', 'GET', sitzung('person-a'));
    expect((b.j.heads as any[]).find(h => h.id === 'sales').einstellung.auftrag.ausBrain.geaendert).toBe(true);
  });
  it('Stand aus der Vorschau veraltet → 409 als Ergebnis, nichts für diesen Head geschrieben', async () => {
    const v = await vorschau();
    const staende = Object.fromEntries((v.j.eintraege as B.PlanEintrag[]).filter(e => e.ziel && e.stand).map(e => [e.ziel!.headId, e.stand]));
    // inzwischen ändert jemand die Einstellungen des Heads
    const a = await anfrage(agenten.GET, '/api/agenten', 'GET', sitzung('person-a'));
    const sales = (a.j.heads as any[]).find(h => h.id === 'sales');
    expect((await anfrage(agenten.POST, '/api/agenten', 'POST', sitzung('person-a'), { aktion: 'einstellung', headId: 'sales', teil: { aufwand: 'high' }, stand: sales.einstellung.stand })).status).toBe(200);
    const vorher = (await db.loadJson<any>(einstellungBestand(H))).heads.sales.auftrag;
    const r = await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'uebernehmen', auswahl: [{ datei: `${ORDNER}/vertrieb.md`, auftrag: true, ersetzen: true }], staende });
    expect(r.status).toBe(200);
    expect(r.j.ergebnisse[0]).toMatchObject({ ok: false, text: expect.stringContaining('Inzwischen geändert') });
    expect((await db.loadJson<any>(einstellungBestand(H))).heads.sales.auftrag).toBe(vorher);
  });
  it('ein Privat-Head als Ziel der Auswahl wird abgelehnt (mit Grund) — nichts geschrieben', async () => {
    const r = await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'uebernehmen', auswahl: [{ datei: `${ORDNER}/health.md`, headId: 'gesundheit', auftrag: true }] });
    expect(r.status).toBe(200);
    expect(r.j.ergebnisse).toEqual([{ datei: `${ORDNER}/health.md`, teil: 'Ziel', ok: false, text: expect.stringContaining('Privat-Agent') }]);
    expect((await db.loadJson<any>(einstellungBestand(H))).heads.gesundheit).toBeUndefined();
  });
  it('Agenten-Ordner merken: nur ein vorhandener, sichtbarer Ordner; danach Quelle „einstellung“ — im Business-Bestand', async () => {
    expect((await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'ordner', ordner: '../etc' })).status).toBe(400);
    expect((await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'ordner', ordner: 'Gibt/Es/Nicht' })).status).toBe(404);
    expect((await anfrage(brain.POST, '/api/agenten/brain', 'POST', sitzung('person-a'), { aktion: 'ordner', ordner: ORDNER })).status).toBe(200);
    expect((await db.loadJson<any>(wissenBestand(H))).brainAgenten).toMatchObject({ ordner: ORDNER, von: 'person-a' });
    expect((await vorschau()).j.ordner).toEqual({ pfad: ORDNER, quelle: 'einstellung' });
    const o = await anfrage(brain.GET, '/api/agenten/brain?nur=ordner', 'GET', sitzung('person-a'));
    expect(o.j.ordnerListe.map((x: { pfad: string }) => x.pfad)).toContain(ORDNER);
    expect(JSON.stringify(o.j)).not.toContain('Privat');
  });
  it('Grenzen: Auftrag über der Grenze wird nicht übernommen (nie gekürzt)', () => {
    const lang = `---\ntype: agent\nabteilung: marketing\n---\n# Agent · Marketing\n\n## Mission\n${'x'.repeat(GRENZEN.headAuftragZeichen + 10)}\n`;
    const plan = B.planBauen({
      dateien: [B.agentDateiLesen(roh('A/marketing.md', lang))], index: new Map(), sichtbar: new Set(['marketing']), einstellung: () => ({}), stand: () => 's',
      wissen: () => null, wissenStand: () => 'w', mitarbeiter: () => [], fachAgenten: [], brain: { notizen: [], ordner: [] },
    });
    expect(plan[0].auftrag).toMatchObject({ aktion: 'zu-lang' });
    expect(B.vorauswahl(plan[0]).auftrag).toBe(false);
  });
});

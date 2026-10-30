// ─── Social — Automatik (27.10.): Redaktionsplan, Agent, Veröffentlichen, LinkedIn, Wächter ────────────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), Modell und LinkedIn nachgebaut — nie ein echter Aufruf. Geprüft wird:
//   · Plan: Plätze aus Tagen/Uhrzeit/Vorlauf, je Woche höchstens `proWoche` (Geplantes zählt mit), nie kurz vor dem Termin, Rotation
//   · Schritte: `entwurf`/`post-*` nur der Server (Browser 403), ein Platz nur einmal, nie doppelt posten, „unklar“ nur von Hand lösen
//   · postPlan: jeder Zustand mit Grund (geplant, fällig, verpasst, Leitplanke, ohne Verbindung, kann nicht, unklar)
//   · Agent: schreibt, plant bei Stufe 2 + freigegebenem Format ein, sonst Entwurf; ohne KI nichts
//   · Veröffentlicher (Probe): postet Fälliges einmal, Not-Aus hält an
//   · LinkedIn: Kopf, Körper, Kennung aus `x-restli-id`, 401 → neu verbinden, keine Antwort → unklar, Karussell als PDF; state einmalig je Person
//   · Wächter: Tokens gehen nie an den Browser; Personenmarke verbindet nur die Person; fremder „nur ich“-Kanal: Verbindungen unsichtbar
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Datenordner VOR allen Imports (lib/social/anbieter/linkedin.ts lädt local-db) — wird beim ersten Schreiben angelegt, am Ende entfernt.
const { ordner } = vi.hoisted(() => {
  const o = `${(process.env.TMPDIR ?? '/tmp').replace(/\/+$/, '')}/make-os-social-auto-${process.pid}-${Date.now()}`;
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-social-auto';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  return { ordner: o };
});

const modell = vi.hoisted(() => ({ antwort: null as null | { ok: boolean; text: string; error?: string }, aufrufe: [] as { user: string; ki: unknown }[] }));
vi.mock('@/lib/anthropic', async orig => {
  const echt = await orig<typeof import('@/lib/anthropic')>();
  return {
    ...echt,
    askText: async (o: { user: string; ki: unknown }) => {
      modell.aufrufe.push({ user: o.user, ki: o.ki });
      const nr = modell.aufrufe.length;
      const SKRIPTE = [
        'Die meisten Entscheidungen werden nicht falsch, sondern zu spät getroffen. Frag dich: Was wäre der kleinste nächste Schritt? Dann geh ihn heute.',
        'Ruhe ist keine Pause vom Arbeiten. Sie ist der Ort, an dem gute Gedanken entstehen. Plane sie ein wie einen Termin mit dir selbst.',
        'Mut fühlt sich selten mutig an. Meist ist es ein kurzer Moment, in dem du trotzdem anfängst. Schreib heute auf, wovor du ausweichst.',
        'Ein voller Kalender sagt nichts über Wirkung. Streiche eine Sache diese Woche ersatzlos und beobachte, was passiert.',
      ];
      return modell.antwort ?? { ok: true, status: 200, text: JSON.stringify({ titel: `Gedanke ${nr}`, hooks: [{ text: `Einstieg ${nr}?` }], skript: SKRIPTE[(nr - 1) % SKRIPTE.length], cta: 'Speichern für später.' }) };
    },
  };
});

import { socialAnwenden, socialAus, platzBelegt, NUR_SYSTEM_OPS, type AnwendenKontext } from '@/lib/social/daten';
import { planLuecken, proWocheVon, terminVon } from '@/lib/social/plan';
import { postPlan } from '@/lib/social/veroeffentlichen';
import { entwurfAus, redaktionAuftrag, REDAKTION_SYSTEM, formVorgabe } from '@/lib/social/agent';
import { folienAus, karussellPdf } from '@/lib/social/anbieter/karussell-pdf';
import { commentaryAus } from '@/lib/social/anbieter/linkedin';
import { leereSocial, type SocialDatei, type SocialFolge } from '@/lib/social/typen';

let n = 0;
const kx = (person = 'pa', extra: Partial<AnwendenKontext> = {}): AnwendenKontext => ({ person, jetzt: '2026-11-02T08:00:00.000Z', heute: '2026-11-02', standVon: x => JSON.stringify(x).length.toString(36), neueId: p => `${p}-t${++n}`, ...extra });
const schritt = (d: SocialDatei, ops: unknown[], k = kx()) => { const r = socialAnwenden(d, ops, k); if (!r.ok) throw new Error(`${r.status} ${r.fehler}`); return r.datei; };

function grund(): SocialDatei {
  let d = schritt(leereSocial(), [{ op: 'kanal', eintrag: { name: 'Beispielkanal', plattformen: ['linkedin'], marke: { saeulen: ['Klarheit', 'Mut', 'Ruhe'], nieSagen: [] } } }]);
  const k = d.kanaele[0];
  d = schritt(d, [{ op: 'format', eintrag: { kanalId: k.id, name: 'Kurzer Gedanke', art: 'text' } }, { op: 'format', eintrag: { kanalId: k.id, name: 'Folien', art: 'karussell' } }]);
  return d;
}

describe('Redaktionsplan (rein)', () => {
  it('Plätze aus Tagen und Uhrzeit, höchstens proWoche je Woche, Geplantes zählt mit, nie kurz vor dem Termin', () => {
    let d = grund();
    const k = d.kanaele[0];
    // Mo 02.11. 09:00 Berliner Zeit; Vorgabe Di/Do/Sa 18:00, 7 Tage → 03.11., 05.11., 07.11.
    expect(planLuecken(k, d.formate, d.folgen, '2026-11-02T09:00').map(l => l.platz)).toEqual(['2026-11-03T18:00', '2026-11-05T18:00', '2026-11-07T18:00']);
    d = schritt(d, [{ op: 'folge', eintrag: { kanalId: k.id, titel: 'Von Hand', skript: 'x', hooks: [{ text: 'y' }], geplantAm: '2026-11-04' } }]);
    // Eine von Hand geplante Folge in derselben Woche zählt mit → nur noch zwei Plätze.
    expect(planLuecken(d.kanaele[0], d.formate, d.folgen, '2026-11-02T09:00')).toHaveLength(2);
    // Heute Di 17:00 — der Platz um 18:00 ist zu knapp (90 Min.).
    expect(planLuecken(k, d.formate, [], '2026-11-03T17:00')[0].platz).toBe('2026-11-05T18:00');
  });
  it('proWoche aus dem Ziel, nie mehr als Plan-Tage; Rotation: freigegebenes Format zuerst, Säulen wechseln', () => {
    let d = grund();
    const k = d.kanaele[0];
    expect(proWocheVon({ ...k, ziele: [{ id: 'sz-1', metrik: 'posts-woche', zielwert: 5, von: '2026-11-01', startwert: 0 }] })).toBe(3);
    d = schritt(d, [{ op: 'format-freigeben', id: d.formate[1].id, freigeben: true, stand: kx().standVon(d.formate[1]) }]);
    const l = planLuecken(d.kanaele[0], d.formate, d.folgen, '2026-11-02T09:00');
    expect(l[0].formatId).toBe(d.formate[1].id);
    expect(new Set(l.map(x => x.saeule)).size).toBe(3);
  });
});

describe('Server-Schritte', () => {
  it('entwurf und post-* nur der Server — aus dem Browser 403', () => {
    const d = grund();
    for (const op of NUR_SYSTEM_OPS) {
      const r = socialAnwenden(d, [{ op, kanalId: d.kanaele[0].id, platz: '2026-11-03T18:00', folgeId: 'sv-x', plattform: 'linkedin', eintrag: { titel: 'x' } }], kx());
      expect(r.ok ? 200 : r.status).toBe(403);
    }
  });
  it('ein Platz nur einmal; Termin, Herkunft, Platz gesetzt; Browser kann quelle/platz/versuche nicht setzen', () => {
    let d = grund();
    const k = d.kanaele[0];
    const e = { op: 'entwurf', kanalId: k.id, platz: '2026-11-03T18:00', eintrag: { titel: 'A', skript: 'Text', hooks: [{ text: 'H' }], formatId: d.formate[0].id, status: 'geplant' } };
    d = schritt(d, [e], kx('zoe', { system: true }));
    d = schritt(d, [e], kx('zoe', { system: true }));
    expect(d.folgen).toHaveLength(1);
    expect(d.folgen[0]).toMatchObject({ quelle: 'agent', platz: '2026-11-03T18:00', geplantAm: '2026-11-03', geplantUm: '18:00', status: 'geplant' });
    expect(platzBelegt(d.folgen, k.id, '2026-11-03T18:00', '18:00')).toBe(true);
    d = schritt(d, [{ op: 'folge', eintrag: { kanalId: k.id, titel: 'B', skript: 'x', hooks: [{ text: 'y' }], quelle: 'agent', platz: '2026-11-05T18:00', versuche: [{ plattform: 'linkedin', seit: 'x', zustand: 'laeuft' }] } }]);
    expect(d.folgen[1].quelle).toBeUndefined();
    expect(d.folgen[1].platz).toBeUndefined();
    expect(d.folgen[1].versuche).toBeUndefined();
  });
  it('nie doppelt: post-start bei laufendem Versuch → 409; unklar bleibt, bis eine Person löst', () => {
    let d = grund();
    d = schritt(d, [{ op: 'entwurf', kanalId: d.kanaele[0].id, platz: '2026-11-03T18:00', eintrag: { titel: 'A', skript: 'T', hooks: [{ text: 'H' }] } }], kx('zoe', { system: true }));
    const f = d.folgen[0];
    const sys = kx('zoe', { system: true });
    d = schritt(d, [{ op: 'post-start', folgeId: f.id, plattform: 'linkedin' }], sys);
    const zweit = socialAnwenden(d, [{ op: 'post-start', folgeId: f.id, plattform: 'linkedin' }], sys);
    expect(zweit.ok ? 200 : zweit.status).toBe(409);
    d = schritt(d, [{ op: 'post-fehler', folgeId: f.id, plattform: 'linkedin', text: 'keine Antwort', unklar: true }], sys);
    expect(d.folgen[0].versuche?.[0].zustand).toBe('unklar');
    const nochmal = socialAnwenden(d, [{ op: 'post-start', folgeId: f.id, plattform: 'linkedin' }], sys);
    expect(nochmal.ok ? 200 : nochmal.status).toBe(409);
    d = schritt(d, [{ op: 'versuch-loesen', folgeId: f.id, plattform: 'linkedin', stand: kx().standVon(d.folgen[0]) }]);
    expect(d.folgen[0].versuche).toBeUndefined();
    d = schritt(d, [{ op: 'post-start', folgeId: f.id, plattform: 'linkedin' }, { op: 'post-ok', folgeId: f.id, plattform: 'linkedin', externeId: 'urn:li:share:1' }], sys);
    expect(d.folgen[0]).toMatchObject({ status: 'veroeffentlicht', veroeffentlicht: [{ plattform: 'linkedin', externeId: 'urn:li:share:1', durch: 'automatik', am: '2026-11-02' }] });
  });
  it('plan: säubert Tage/Uhrzeit/Vorlauf', () => {
    let d = grund();
    d = schritt(d, [{ op: 'plan', kanalId: d.kanaele[0].id, stand: kx().standVon(d.kanaele[0]), plan: { agent: true, tage: [1, 1, 9, 3], uhrzeit: '25:00', vorlauf: 99 } }]);
    expect(d.kanaele[0].plan).toEqual({ agent: true, tage: [1, 3], uhrzeit: '18:00', vorlauf: 7 });
    expect(socialAus(JSON.parse(JSON.stringify(d))).kanaele[0].plan).toEqual(d.kanaele[0].plan);
  });
});

describe('postPlan (rein)', () => {
  const f: SocialFolge = { id: 'sv-1', kanalId: 'sk-1', titel: 'x', skript: 'x', hooks: [], quellen: [], kiInhalt: false, status: 'geplant', veroeffentlicht: [], messungen: [], geaendert: '' };
  const selbst = { weg: 'selbst' as const, grund: 'ok' };
  const verb = () => ({ kann: { ok: true as const } });
  it('jeder Zustand mit Grund', () => {
    const z = (o: Partial<Parameters<typeof postPlan>[1]>, ff = f) => postPlan(ff, { termin: '2026-11-03T18:00', jetzt: '2026-11-03T18:05', weg: selbst, plattformen: ['linkedin'], verbindung: verb, ...o })[0].zustand;
    expect(z({})).toBe('faellig');
    expect(z({ jetzt: '2026-11-03T12:00' })).toBe('geplant');
    expect(z({ jetzt: '2026-11-04T08:00' })).toBe('verpasst');
    expect(z({ weg: { weg: 'stapel', grund: 'Stufe 1' } })).toBe('leitplanke');
    expect(z({ verbindung: () => null })).toBe('ohne-verbindung');
    expect(z({ verbindung: () => ({ kann: { ok: false, grund: 'Video' } }) })).toBe('kann-nicht');
    expect(z({ termin: null })).toBe('ohne-termin');
    expect(z({}, { ...f, versuche: [{ plattform: 'linkedin', seit: 'x', zustand: 'unklar' }] })).toBe('unklar');
    expect(z({}, { ...f, veroeffentlicht: [{ plattform: 'linkedin', am: '2026-11-03' }] })).toBe('online');
  });
  it('terminVon nimmt die Uhrzeit der Folge, sonst die des Plans', () => {
    expect(terminVon({ geplantAm: '2026-11-03' }, {})).toBe('2026-11-03T18:00');
    expect(terminVon({ geplantAm: '2026-11-03', geplantUm: '07:30' }, {})).toBe('2026-11-03T07:30');
  });
});

describe('Agent-Auftrag (rein)', () => {
  it('Feste Regeln ohne Persönliches; Daten im <daten>-Rahmen; Form je Inhaltsart', () => {
    expect(REDAKTION_SYSTEM).not.toMatch(/Kevin|Malin|KEMARIS|MAKE Innovation|Fokus Innovation/);
    expect(REDAKTION_SYSTEM).toMatch(/Erfinde nie ein eigenes Erlebnis/);
    const d = grund();
    const a = redaktionAuftrag(d.kanaele[0], { platz: '2026-11-03T18:00', formatId: d.formate[0].id, saeule: 'Mut' }, d.formate[0], d.folgen, null);
    expect(a).toMatch(/<daten quelle="kanal">/);
    expect(a).toMatch(/Säule: Mut/);
    expect(formVorgabe({ ...d.formate[1] })).toMatch(/---/);
  });
  it('entwurfAus: unbrauchbar → null, sonst höchstens drei Hooks, CTA aus dem Markenprofil', () => {
    const k = { ...grund().kanaele[0], marke: { ...grund().kanaele[0].marke, cta: 'Folgen' } };
    expect(entwurfAus({ titel: 'x' }, k, { platz: 'p' })).toBeNull();
    const e = entwurfAus({ titel: 'T', skript: 'S', hooks: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }] }, k, { platz: 'p', saeule: 'Mut' })!;
    expect((e.hooks as unknown[]).length).toBe(3);
    expect(e.cta).toBe('Folgen');
  });
});

describe('Karussell und LinkedIn-Text (rein)', () => {
  it('Folien aus dem Skript, PDF mit einer Seite je Folie', async () => {
    const folien = folienAus('Hook\nerste Zeile\n---\nZwei\nText\n---\n\n---\nDrei');
    expect(folien.map(f => f.kopf)).toEqual(['Hook', 'Zwei', 'Drei']);
    const { PDFDocument } = await import('pdf-lib');
    expect((await PDFDocument.load(await karussellPdf('Titel', folien))).getPageCount()).toBe(3);
  });
  it('reservierte Zeichen maskiert, Hashtags bleiben', () => {
    expect(commentaryAus('Frage (kurz) @alle #Klarheit # allein')).toBe('Frage \\(kurz\\) \\@alle #Klarheit \\# allein');
  });
});

// ── Server: Agent, Veröffentlicher, LinkedIn, Route ───────────────────────────────────────────────────────────────────────────────
type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Route;
const URL_ = 'http://test/api/social';
const sende = (methode: 'PATCH' | 'POST', person: string, body: unknown) => new Request(URL_, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person }, body: JSON.stringify(body) });
const lies = async (person: string) => (await route.GET(new Request(URL_, { headers: { 'x-make-user': person } }))).json() as Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/social/route')) as unknown as Route;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
  ], einladungen: [] });
  await (await import('@/lib/zugang/konten')).ladeKonten();
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.unstubAllEnvs(); });

describe('Agent und Veröffentlicher (Server, Probe)', () => {
  let kanalId = '';
  it('Agent schreibt die freien Plätze; Stufe 2 + freigegebenes Format → eingeplant', async () => {
    const { socialSchreiben, ladeSocial } = await import('@/lib/social/server');
    const jetzt = new Date('2026-11-02T08:00:00Z');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Auto', plattformen: ['linkedin'], leitplanken: { autonomie: 2 }, marke: { saeulen: ['Klarheit'], nieSagen: [] } } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    kanalId = r.datei.kanaele[0].id;
    r = await socialSchreiben([{ op: 'format', eintrag: { kanalId, name: 'Gedanke', art: 'text' } }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    const { eintragStand } = await import('@/lib/social/server');
    r = await socialSchreiben([{ op: 'format-freigeben', id: r.datei.formate[0].id, freigeben: true, stand: eintragStand(r.datei.formate[0]) }], 'pa', undefined, jetzt);
    if (!r.ok) throw new Error(r.fehler);
    const { socialRedaktionLauf } = await import('@/lib/social/agent-server');
    const e = await socialRedaktionLauf({ person: 'pa', kanalId, jetzt });
    expect(e.gestoppt).toBeUndefined();
    expect(e.geschrieben).toHaveLength(3);
    expect(e.geschrieben.every(g => g.geplant)).toBe(true);
    expect(modell.aufrufe[0].ki).toMatchObject({ lauf: 'aufruf', person: 'pa', kategorien: ['crm'] });
    // Zweiter Lauf: alles belegt → nichts doppelt.
    const e2 = await socialRedaktionLauf({ person: 'pa', kanalId, jetzt });
    expect(e2.geschrieben).toHaveLength(0);
    expect((await ladeSocial()).folgen.filter(f => f.kanalId === kanalId)).toHaveLength(3);
  });
  it('gleiche Antworten: der zweite Entwurf ist eine Wiederholung und wird nicht eingeplant', async () => {
    const gleich = JSON.stringify({ titel: 'Immer dasselbe', hooks: [{ text: 'Gleich?' }], skript: 'Dieser Text kommt genau so zweimal vor, weil das Modell sich wiederholt und das darf nie zweimal live gehen.', cta: 'Folgen' });
    modell.antwort = { ok: true, text: gleich };
    const { socialSchreiben, eintragStand } = await import('@/lib/social/server');
    let r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Echo', plattformen: ['linkedin'], leitplanken: { autonomie: 2 } } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const id = r.geaendert[0];
    r = await socialSchreiben([{ op: 'format', eintrag: { kanalId: id, name: 'G', art: 'text' } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const f = r.datei.formate.find(x => x.kanalId === id)!;
    await socialSchreiben([{ op: 'format-freigeben', id: f.id, freigeben: true, stand: eintragStand(f) }], 'pa');
    const { socialRedaktionLauf } = await import('@/lib/social/agent-server');
    const e = await socialRedaktionLauf({ person: 'pa', kanalId: id, jetzt: new Date('2026-11-02T08:00:00Z') });
    expect(e.geschrieben.map(g => g.geplant)).toEqual([true, false, false]);
    modell.antwort = null;
  });
  it('ohne KI-Schlüssel: nichts geschrieben, Grund im Lauf', async () => {
    modell.antwort = { ok: false, text: '', error: 'no-key' };
    const { socialRedaktionLauf } = await import('@/lib/social/agent-server');
    const { socialSchreiben } = await import('@/lib/social/server');
    const r = await socialSchreiben([{ op: 'kanal', eintrag: { name: 'Ohne KI', plattformen: ['linkedin'] } }], 'pa');
    if (!r.ok) throw new Error(r.fehler);
    const e = await socialRedaktionLauf({ person: 'pa', kanalId: r.geaendert[0], jetzt: new Date('2026-11-02T08:00:00Z') });
    expect(e.geschrieben).toHaveLength(0);
    expect(e.gestoppt).toMatch(/KI-Schlüssel/);
    modell.antwort = null;
  });
  it('Veröffentlicher: postet Fälliges über die Probe genau einmal', async () => {
    const res = await route.POST(sende('POST', 'pa', { aktion: 'probe-verbinden', kanalId, plattform: 'linkedin' }));
    expect(res.status).toBe(200);
    const { socialVeroeffentlichenLauf } = await import('@/lib/social/veroeffentlichen-server');
    // Di 03.11. 18:05 Berliner Zeit = 17:05 UTC → der erste Platz ist fällig.
    const jetzt = new Date('2026-11-03T17:05:00Z');
    const a = await socialVeroeffentlichenLauf(jetzt);
    expect(a.gepostet).toHaveLength(1);
    expect((await socialVeroeffentlichenLauf(jetzt)).gepostet).toHaveLength(0);
    const l = await lies('pa');
    const online = l.datei.folgen.find((f: { veroeffentlicht: unknown[] }) => f.veroeffentlicht.length);
    expect(online.veroeffentlicht[0]).toMatchObject({ plattform: 'linkedin', durch: 'automatik' });
    expect(l.automatik.folgen[online.id][0].zustand).toBe('online');
  });
  it('Not-Aus des Kanals: nichts geht raus', async () => {
    const l = await lies('pa');
    const k = l.datei.kanaele.find((x: { id: string }) => x.id === kanalId);
    expect((await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'notaus', id: kanalId, posten: true, stand: k.stand }] }))).status).toBe(200);
    const { socialVeroeffentlichenLauf } = await import('@/lib/social/veroeffentlichen-server');
    expect((await socialVeroeffentlichenLauf(new Date('2026-11-05T17:05:00Z'))).gepostet).toHaveLength(0);
  });
  it('Wächter: kein Token in der Antwort; Personenmarke verbindet nur die Person; fremder „nur ich“-Kanal samt Verbindung unsichtbar', async () => {
    const roh = JSON.stringify(await lies('pa'));
    expect(roh).not.toMatch(/accessToken|geheim/);
    const r = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'kanal', eintrag: { name: 'Annas Marke', art: 'person', person: 'pa', sichtbarkeit: 'person', plattformen: ['linkedin'] } }] }));
    const marke = (await r.json()).geaendert[0];
    expect((await route.POST(sende('POST', 'pa', { aktion: 'probe-verbinden', kanalId: marke, plattform: 'linkedin' }))).status).toBe(200);
    const b = await lies('pb');
    expect(b.datei.kanaele.some((k: { id: string }) => k.id === marke)).toBe(false);
    expect(b.automatik.verbindungen.some((v: { kanalId: string }) => v.kanalId === marke)).toBe(false);
    expect((await route.POST(sende('POST', 'pb', { aktion: 'probe-verbinden', kanalId: marke, plattform: 'linkedin' }))).status).toBe(404);
    // Personenmarke ohne „nur ich“: Bert sieht sie, verbinden darf nur Anna.
    const r2 = await route.PATCH(sende('PATCH', 'pa', { ops: [{ op: 'kanal', eintrag: { name: 'Annas offene Marke', art: 'person', person: 'pa', plattformen: ['linkedin'] } }] }));
    const offen = (await r2.json()).geaendert[0];
    expect((await route.POST(sende('POST', 'pb', { aktion: 'probe-verbinden', kanalId: offen, plattform: 'linkedin' }))).status).toBe(403);
  });
});

describe('LinkedIn (nachgebaut)', () => {
  it('Anmeldung: state gehört der Person, einmalig; Autor aus userinfo', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'cid'); vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'geheim-x'); vi.stubEnv('MAKE_OS_ADRESSE', 'https://app.beispiel.test');
    const li = await import('@/lib/social/anbieter/linkedin');
    li._linkedinFetchSetzen(async (u: RequestInfo | URL) => {
      const s = String(u);
      if (s.endsWith('/oauth/v2/accessToken')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 5184000, scope: 'openid,profile,w_member_social' }), { status: 200 });
      if (s.endsWith('/v2/userinfo')) return new Response(JSON.stringify({ sub: 'abc', name: 'Anna Prüf' }), { status: 200 });
      return new Response('', { status: 404 });
    });
    const url = new URL(await li.linkedinStart('pa', 'sk-1'));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.beispiel.test/api/social/linkedin/rueckruf');
    expect(url.searchParams.get('scope')).toBe('openid profile w_member_social');
    const state = url.searchParams.get('state')!;
    expect((await li.linkedinAbschliessen('pb', 'code', state)).ok).toBe(false); // andere Person
    const r = await li.linkedinAbschliessen('pa', 'code', state);
    expect(r.ok).toBe(false); // der Fehlversuch hat den state verbraucht — nie zweimal
    const s2 = new URL(await li.linkedinStart('pa', 'sk-1')).searchParams.get('state')!;
    const ok = await li.linkedinAbschliessen('pa', 'code', s2);
    expect(ok).toMatchObject({ ok: true, kanalId: 'sk-1', geheim: { autor: 'urn:li:person:abc', accessToken: 'tok' } });
    expect((await li.linkedinAbschliessen('pa', 'code', s2)).ok).toBe(false);
  });
  it('Beitrag: Köpfe und Körper laut Doku, Kennung aus x-restli-id; 401 → neu verbinden; keine Antwort → unklar; Karussell als PDF', async () => {
    const li = await import('@/lib/social/anbieter/linkedin');
    li.DOKUMENT_WARTEN_MS.wert = 0;
    const gesehen: { url: string; init?: RequestInit }[] = [];
    let modus: 'ok' | '401' | 'netz' = 'ok';
    li._linkedinFetchSetzen(async (u: RequestInfo | URL, init?: RequestInit) => {
      gesehen.push({ url: String(u), init });
      if (modus === 'netz') throw new Error('timeout');
      if (modus === '401') return new Response('', { status: 401 });
      if (String(u).includes('/rest/documents?action=initializeUpload')) return new Response(JSON.stringify({ value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/x', document: 'urn:li:document:9' } }), { status: 200 });
      if (String(u).startsWith('https://www.linkedin.com/dms-uploads/')) return new Response('', { status: 201 });
      return new Response('', { status: 201, headers: { 'x-restli-id': 'urn:li:share:42' } });
    });
    const g = { accessToken: 'tok', autor: 'urn:li:person:abc', ablauf: Date.now() + 86_400_000 };
    const folge = { id: 'sv-1', kanalId: 'sk-1', titel: 'T', skript: 'Text (eins)', hooks: [{ id: 'hk-1', text: 'Hook' }], quellen: [], kiInhalt: false, status: 'geplant' as const, veroeffentlicht: [], messungen: [], geaendert: '' };
    const kanal = grund().kanaele[0];
    const r = await li.linkedinAnbieter.posten(g, { kanal, folge, format: { id: 'sf-1', kanalId: 'sk-1', name: 'x', art: 'text', geaendert: '' }, text: 'Text (eins)' });
    expect(r).toMatchObject({ ok: true, externeId: 'urn:li:share:42' });
    const post = gesehen.at(-1)!;
    expect(post.url).toBe('https://api.linkedin.com/rest/posts');
    expect(post.init?.headers).toMatchObject({ 'LinkedIn-Version': '202610', 'X-Restli-Protocol-Version': '2.0.0', Authorization: 'Bearer tok' });
    expect(JSON.parse(String(post.init?.body))).toMatchObject({ author: 'urn:li:person:abc', commentary: 'Text \\(eins\\)', visibility: 'PUBLIC', lifecycleState: 'PUBLISHED' });
    modus = '401';
    expect(await li.linkedinAnbieter.posten(g, { kanal, folge, format: null, text: 'x' })).toMatchObject({ ok: false, erneuern: true });
    modus = 'netz';
    expect(await li.linkedinAnbieter.posten(g, { kanal, folge, format: null, text: 'x' })).toMatchObject({ ok: false, unklar: true });
    modus = 'ok';
    const k = await li.linkedinAnbieter.posten(g, { kanal, folge: { ...folge, skript: 'Eins\na\n---\nZwei\nb' }, format: { id: 'sf-2', kanalId: 'sk-1', name: 'F', art: 'karussell', geaendert: '' }, text: '' });
    expect(k.ok).toBe(true);
    expect(JSON.parse(String(gesehen.at(-1)!.init?.body)).content).toEqual({ media: { title: 'T.pdf', id: 'urn:li:document:9' } });
    expect(li.linkedinAnbieter.kann(folge, { id: 'sf-3', kanalId: 'sk-1', name: 'V', geaendert: '' }).ok).toBe(false); // Video
    li._linkedinFetchSetzen(null);
  });
});

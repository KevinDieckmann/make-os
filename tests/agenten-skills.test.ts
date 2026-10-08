// ─── Wächter: Skills, eigene Mitarbeiter, Gedächtnis (09.10., Paket 3; AGENTEN_KONZEPT.md C11) ─────────────────────────────
// Grenzen (413, nie gekürzt), Werkzeuge ⊆ Head/Mitarbeiter (400), Vorschlag eines Agenten → Stapel (aktiv erst nach Klick), Testlauf
// ohne Wirkung, aktiv nur nach gelungenem Testlauf der aktuellen Fassung und Klick, Versionen, Import SKILL.md, „aus dem Chat“,
// Sicht (fremder Haushalt, „nur Business“, Dienstweg, Privat der anderen Person), Eigentum beim Konto-Löschen.
// Eigener Datenordner, erfundene Konten — nie echte Daten; Netz gesperrt, Modell aus.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-skills-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-skills';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MAKE_OS_GRABSTEINE_DIR;
  return o;
});
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { GRENZEN, fadenBestand, skillsHaushaltBestand, skillsPersonBestand, type Faden } from '@/lib/agenten/typen';
import { headDef } from '@/lib/agenten/katalog';
import { skillPruefen, skillMdLesen, mitarbeiterPruefen, merksatzHinzu, entwurfAusFaden, mitarbeiterListe, eingebauteSkills, textFeld } from '@/lib/agenten/skills';
import * as SK from '@/lib/agenten/skills-server';
import { skillLesen, skillsFuerHead } from '@/lib/agenten/skills-lesen';

type H = (r: Request) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
let route: { GET: H; POST: H };
const post = async (person: string, body: unknown, kopf: Record<string, string> = sitzung(person)) => {
  const r = await route.POST(new Request('http://test/api/agenten/skills', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as J };
};
const get = async (person: string, q = '', kopf: Record<string, string> = sitzung(person)) => {
  const r = await route.GET(new Request(`http://test/api/agenten/skills${q}`, { headers: kopf }));
  return { status: r.status, j: await r.json() as J };
};

const SALES = headDef('sales')!;
const ctxSales = { head: SALES, mitarbeiter: mitarbeiterListe('sales', []) };
const TESTS = [
  { eingabe: 'Ein Angebot seit 9 Tagen offen', erwartet: ['ein Entwurf', 'kein Versand'] },
  { eingabe: 'Kein Angebot offen', erwartet: ['nichts zu tun'] },
  { eingabe: 'Angebot an eine gesperrte Person', erwartet: ['kein Entwurf'] },
];
const ENTWURF = {
  headId: 'sales', name: 'angebot-nachfassen', beschreibung: 'Fasst gestellte Angebote nach sieben Tagen nach — wenn keine Antwort kam.',
  anleitung: '1. Offene Angebote lesen.\n2. Je Angebot einen kurzen Entwurf schreiben.\n3. Nur als Vorschlag — nie senden.',
  werkzeuge: ['angebote_lage', 'kontakt_akte', 'crm_vorschlag'], ausloeser: { art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' },
};

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }),
    konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
    konto('k4', 'nur-business', 'mitglied', { haushalt: 'haus-a', finanzRecht: 'business' }),
  ], einladungen: [] });
  route = await import('@/app/api/agenten/skills/route') as unknown as { GET: H; POST: H };
});

describe('Regeln (rein): Grenzen, Werkzeuge, Auslöser', () => {
  it('Anleitung, Beschreibung, Name, Tests — über der Grenze 413 (nie gekürzt), Unsinn 400', () => {
    const p = (x: Record<string, unknown>) => skillPruefen({ ...ENTWURF, ...x }, ctxSales);
    expect(p({}).ok).toBe(true);
    expect(p({ anleitung: 'x'.repeat(GRENZEN.skillAnleitung + 1) })).toMatchObject({ ok: false, status: 413 });
    expect(p({ anleitung: 'x'.repeat(GRENZEN.skillAnleitung) }).ok).toBe(true);
    expect(p({ beschreibung: 'x'.repeat(GRENZEN.skillBeschreibung + 1) })).toMatchObject({ ok: false, status: 413 });
    expect(p({ name: 'a'.repeat(GRENZEN.skillName + 1) })).toMatchObject({ ok: false, status: 413 });
    expect(p({ name: 'Angebot Nachfassen' })).toMatchObject({ ok: false, status: 400 });
    expect(p({ anleitung: 'Text\u0000mit NUL' })).toMatchObject({ ok: false, status: 400 });
    expect(p({ tests: Array.from({ length: GRENZEN.skillTestsMax + 1 }, () => TESTS[0]) })).toMatchObject({ ok: false, status: 413 });
    expect(textFeld('  frei  ', 10, 'x')).toEqual({ ok: true, wert: 'frei' });
  });
  it('Werkzeuge ⊆ Head bzw. Mitarbeiter — sonst 400; die Stufe kommt nie aus dem Skill', () => {
    expect(skillPruefen({ ...ENTWURF, werkzeuge: ['crm_suche', 'erfasse_rechnung'] }, ctxSales)).toMatchObject({ ok: false, status: 400 });
    expect(skillPruefen({ ...ENTWURF, werkzeuge: ['an_mitarbeiter'] }, ctxSales).ok).toBe(true);
    // Mitarbeiter „CRM-Pflege“ hat kein `angebote_lage` — ein Skill dort darf es nicht nutzen, obwohl der Head es hat.
    expect(skillPruefen({ ...ENTWURF, mitarbeiterId: 'sales-crm-pflege' }, ctxSales)).toMatchObject({ ok: false, status: 400 });
    expect(skillPruefen({ ...ENTWURF, mitarbeiterId: 'sales-crm-pflege', werkzeuge: ['datenqualitaet', 'skill_laden'] }, ctxSales).ok).toBe(true);
    expect(skillPruefen({ ...ENTWURF, mitarbeiterId: 'sales-crm-pflege', werkzeuge: ['an_mitarbeiter'] }, ctxSales)).toMatchObject({ ok: false, status: 400 });
    const r = skillPruefen({ ...ENTWURF, stufe: 'stark', risiko: 'frei' }, ctxSales);
    expect(r.ok && Object.keys(r.wert)).not.toContain('risiko');
  });
  it('Auslöser: von Hand, Zeitplan (nur im Takt-Fenster), Ereignis (nur die angebundenen)', () => {
    const a = (x: unknown) => skillPruefen({ ...ENTWURF, ausloeser: x }, ctxSales);
    expect(a({ art: 'hand' }).ok).toBe(true);
    expect(a({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '09:30', tage: [1, 5] }).ok).toBe(true);
    expect(a({ art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '23:00' })).toMatchObject({ ok: false, status: 400 });
    expect(a({ art: 'zeitplan', rhythmus: 'woechentlich', uhrzeit: '09:00', tage: [8] })).toMatchObject({ ok: false, status: 400 });
    expect(a({ art: 'ereignis', ereignis: 'neuer-lead', filter: 'nur Leads aus Events' }).ok).toBe(true);
    expect(a({ art: 'ereignis', ereignis: 'neues-medium' })).toMatchObject({ ok: false, status: 400 });
  });
  it('SKILL.md: Name, Beschreibung, Anleitung — andere Kopf-Felder (z. B. Werkzeuge) werden NICHT übernommen', () => {
    const md = '---\nname: wochenbericht\ndescription: "Fasst die Woche zusammen. Wird freitags genutzt."\nallowed-tools: Bash, Read\n---\n\n# Ablauf\n1. Zahlen holen\n2. Drei Absätze schreiben\n';
    const r = skillMdLesen(md);
    expect(r).toMatchObject({ ok: true, wert: { name: 'wochenbericht', beschreibung: 'Fasst die Woche zusammen. Wird freitags genutzt.', ignoriert: ['allowed-tools'] } });
    expect(r.ok && r.wert.anleitung).toContain('Drei Absätze');
    expect(skillMdLesen('---\ndescription: >\n  Zeile eins\n  Zeile zwei\nname: blockwert\n---\nText').ok && skillMdLesen('---\ndescription: >\n  Zeile eins\n  Zeile zwei\nname: blockwert\n---\nText')).toMatchObject({ wert: { beschreibung: 'Zeile eins Zeile zwei' } });
    expect(skillMdLesen('# kein Kopf')).toMatchObject({ ok: false, status: 400 });
    expect(skillMdLesen('---\nname: Mit Leerzeichen\ndescription: x\n---\nText')).toMatchObject({ ok: false, status: 400 });
    expect(skillMdLesen('---\nname: x\ndescription: x\n---\nText\u0000binär')).toMatchObject({ ok: false, status: 400 });
    expect(skillMdLesen(`---\nname: x\ndescription: x\n---\n${'y'.repeat(30_000)}`)).toMatchObject({ ok: false, status: 413 });
  });
  it('Mitarbeiter: Werkzeuge ⊆ Head, Aushilfe nur im selben Bereich; Merksätze ≤ 300 Zeichen, ≤ 100 je Agent', () => {
    expect(mitarbeiterPruefen({ name: 'Empfehlungen', rolle: 'Bittet um Empfehlungen.', werkzeuge: ['mandate_lage'], auchFuer: ['kundenerfolg'] }, SALES).ok).toBe(true);
    expect(mitarbeiterPruefen({ name: 'X', rolle: 'Y', werkzeuge: ['erfasse_rechnung'] }, SALES)).toMatchObject({ ok: false, status: 400 });
    expect(mitarbeiterPruefen({ name: 'X', rolle: 'Y', werkzeuge: [], auchFuer: ['assistenz'] }, SALES)).toMatchObject({ ok: false, status: 400 });
    expect(mitarbeiterPruefen({ name: 'X', rolle: 'Y', anleitung: 'z'.repeat(GRENZEN.mitarbeiterAnleitung + 1) }, SALES)).toMatchObject({ ok: false, status: 413 });
    const m = { id: 'ms-1', am: '2026-10-09T08:00:00.000Z', von: 'person-a', quelle: 'hand' as const };
    expect(merksatzHinzu([], { ...m, text: 'x'.repeat(GRENZEN.merksatzZeichen + 1) })).toMatchObject({ ok: false, status: 413 });
    const voll = Array.from({ length: GRENZEN.merksaetzeJeAgent }, (_, i) => ({ ...m, id: `ms-${i}`, text: `Regel ${i}` }));
    expect(merksatzHinzu(voll, { ...m, text: 'Noch eine Regel' })).toMatchObject({ ok: false, status: 413 });
    expect(merksatzHinzu(voll, { ...m, text: 'regel  3' })).toMatchObject({ ok: true, wert: { neu: false } });
  });
  it('eingebaute Skills = die Modi des Heads, sichtbar und aktiv, mit neutraler Beschreibung', () => {
    const e = eingebauteSkills(SALES);
    expect(e.map(s => s.name)).toEqual(SALES.eingebaut!.modi.map(m => m.replace(/_/g, '-')));
    expect(e.every(s => s.eingebaut && s.aktiv && s.beschreibung.length > 10)).toBe(true);
    expect(eingebauteSkills(headDef('research')!)).toEqual([]);
    expect(eingebauteSkills(headDef('finanzen')!).map(s => s.id)).toContain('eingebaut:finanzchef:tagescheck');
  });
});

describe('Route: anlegen, Versionen, Testlauf ohne Wirkung, aktiv nur per Klick', () => {
  let id = '', stand = '';
  it('anlegen → Entwurf (aus, Version 1); zweimal mit derselben anfrageId → derselbe Skill', async () => {
    const r = await post('person-b', { aktion: 'anlegen', skill: ENTWURF, anfrageId: 'anfrage-skill-0001' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.skill).toMatchObject({ aktiv: false, version: 1, quelle: 'hand', angelegtVon: 'person-b', headId: 'sales' });
    id = r.j.skill.id; stand = r.j.stand;
    const nochmal = await post('person-b', { aktion: 'anlegen', skill: ENTWURF, anfrageId: 'anfrage-skill-0001' });
    expect(nochmal.j.skill.id).toBe(id);
    expect((await post('person-b', { aktion: 'anlegen', skill: ENTWURF })).status).toBe(409); // Name je Head eindeutig
  });
  it('aktivieren ohne Testfälle/Testlauf → 409 mit Grund', async () => {
    const r = await post('person-b', { aktion: 'aktivieren', id, stand });
    expect(r.status).toBe(409);
    expect(r.j.fehlt.join(' ')).toMatch(/Testfälle/);
  });
  it('ändern mit falschem Stand → 409; mit Stand → neue Version (aus)', async () => {
    expect((await post('person-b', { aktion: 'aendern', id, teil: { tests: TESTS }, stand: 'veraltet' })).status).toBe(409);
    const r = await post('person-b', { aktion: 'aendern', id, teil: { tests: TESTS, aktiv: true, version: 99, angelegtVon: 'gast' }, stand });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.skill).toMatchObject({ version: 2, aktiv: false, angelegtVon: 'person-b' });
    expect(r.j.skill.frueher[0]).toMatchObject({ version: 1 });
    stand = r.j.stand;
    expect((await post('person-b', { aktion: 'aendern', id, teil: { headId: 'marketing' }, stand })).status).toBe(400);
  });
  it('Testlauf: jeder Testfall ohne Wirkung — ein Werkzeug außerhalb des Skills lässt ihn scheitern', async () => {
    SK.probelaeuferVerdrahten(async a => ({ ok: true, werkzeuge: a.nr === 1 ? ['erfasse_rechnung'] : ['angebote_lage'] }));
    const r = await post('person-b', { aktion: 'testlauf', id });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.skill.testlauf).toMatchObject({ ok: false, von: 'person-b' });
    expect(r.j.skill.testlauf.ergebnisse[1]).toMatchObject({ ok: false });
    stand = r.j.stand;
    expect((await post('person-b', { aktion: 'aktivieren', id, stand })).status).toBe(409);
  });
  it('gelungener Testlauf + Klick → aktiv (freigegebenVon = die Person der Sitzung); kein Bestand außer der Werkstatt wurde geschrieben', async () => {
    const db = await import('@/lib/store/local-db');
    SK.probelaeuferVerdrahten(async () => ({ ok: true, werkzeuge: ['angebote_lage', 'crm_vorschlag'] }));
    const t = await post('person-b', { aktion: 'testlauf', id });
    expect(t.j.skill.testlauf.ok).toBe(true);
    for (const n of ['tasks', 'zoe-stapel', 'zoe-protokoll', 'crm', 'kontakte']) expect(await db.loadJson(n), n).toBeNull();
    const a = await post('person-b', { aktion: 'aktivieren', id, stand: t.j.stand });
    expect(a.status, JSON.stringify(a.j)).toBe(200);
    expect(a.j.skill).toMatchObject({ aktiv: true, freigegebenVon: 'person-b' });
    stand = a.j.stand;
    expect((await skillLesen(id, { person: 'person-b', haushalt: 'haus-a' }))?.name).toBe('angebot-nachfassen');
  });
  it('Änderung nach dem Einschalten → wieder aus; einschalten erst nach neuem Testlauf', async () => {
    const r = await post('person-b', { aktion: 'aendern', id, teil: { anleitung: `${ENTWURF.anleitung}\n4. Freundlich bleiben.` }, stand });
    expect(r.j.skill).toMatchObject({ version: 3, aktiv: false });
    expect(r.j.skill.freigegebenVon).toBeUndefined();
    const a = await post('person-b', { aktion: 'aktivieren', id, stand: r.j.stand });
    expect(a.status).toBe(409);
    expect(a.j.fehlt.join(' ')).toMatch(/Testlauf/);
    expect(await skillLesen(id, { person: 'person-b', haushalt: 'haus-a' })).toBeNull(); // nur aktive gehen in skill_laden
  });
  it('Testlauf über der Kostenschwelle nur mit Bestätigung; „nachts“ nur vormerken', async () => {
    const viele = Array.from({ length: 20 }, (_, i) => ({ eingabe: `Fall ${i}`, erwartet: ['ok'] }));
    const s = await post('person-b', { aktion: 'aendern', id, teil: { tests: viele, stufe: 'stark' }, stand: (await get('person-b', `?id=${id}`)).j.stand });
    const ohne = await post('person-b', { aktion: 'testlauf', id });
    expect(ohne.status).toBe(409);
    expect(ohne.j).toMatchObject({ kostenBestaetigen: true, schaetzung: { quelle: 'annahme' } });
    const nachts = await post('person-b', { aktion: 'testlauf', id, nachts: true });
    expect(nachts.j.skill.probelaufNachts).toMatchObject({ von: 'person-b', batch: true });
    expect(s.status).toBe(200);
  });
  it('eingebaute Skills sind nicht änderbar; GET ?head= liefert eingebaute + eigene, Mitarbeiter, Gedächtnis, Leistung', async () => {
    expect((await post('person-b', { aktion: 'aendern', id: 'eingebaut:heads:power_hour', teil: {}, stand: 'x' })).status).toBe(409);
    const g = await get('person-b', '?head=sales');
    expect(g.status).toBe(200);
    expect(g.j.skills.filter((s: { eingebaut?: boolean }) => s.eingebaut).length).toBe(SALES.eingebaut!.modi.length);
    expect(g.j.skills.some((s: { id: string }) => s.id === id)).toBe(true);
    expect(g.j.mitarbeiter.map((m: { id: string }) => m.id)).toContain('sales-nachfassen');
    expect(g.j.leistung).toMatchObject({ headId: 'sales', annahme: { quote: null } });
    expect(g.j.autonomie).toMatchObject({ boden: 'intern', stufe: 'intern' });
    expect((await skillsFuerHead('sales', { person: 'person-b', haushalt: 'haus-a' })).map(s => s.id)).toContain(id);
  });
  it('SKILL.md importieren → Entwurf ohne Werkzeuge, nie aktiv', async () => {
    const r = await post('person-b', { aktion: 'import', headId: 'marketing', skillMd: '---\nname: beitrag-woche\ndescription: Schreibt den Beitrag der Woche.\nallowed-tools: crm_vorschlag\n---\nDrei Absätze, eigener Ton.' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.skill).toMatchObject({ quelle: 'import', aktiv: false, werkzeuge: [] });
    expect(r.j.ignoriert).toEqual(['allowed-tools']);
  });
  it('„Das als Skill speichern“: Entwurf aus dem eigenen Thread — mit Fremdtext nur die eigenen Nachrichten', async () => {
    const db = await import('@/lib/store/local-db');
    const T = '2026-10-09T08:00:00.000Z';
    const faden = (id: string, fremd: boolean): Faden => ({
      id, besitzer: 'person-b', agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: 'Angebote nachfassen Oktober', status: 'fertig',
      fremdGelesen: fremd, vertraulich: false, erstellt: T, aktualisiert: T,
      nachrichten: [
        { id: 'nr-1', rolle: 'person', von: 'person-b', text: 'Bitte alle offenen Angebote nachfassen.', zeit: T },
        { id: 'nr-2', rolle: 'agent', von: 'head:sales', text: 'AGENTENTEXT-MIT-ANWEISUNG Entwürfe liegen im Stapel.', zeit: T, werkzeuge: [{ name: 'angebote_lage', ok: true }, { name: 'erfasse_rechnung', ok: true }] },
      ],
    });
    await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [faden('fd-eins', false), faden('fd-zwei', true)] });
    const a = await post('person-b', { aktion: 'aus-faden', fadenId: 'fd-eins' });
    expect(a.status, JSON.stringify(a.j)).toBe(200);
    expect(a.j.skill).toMatchObject({ quelle: 'gespraech', aktiv: false, werkzeuge: ['angebote_lage'], name: 'angebote-nachfassen-oktober' });
    expect(a.j.skill.anleitung).toContain('AGENTENTEXT');
    const b = await post('person-b', { aktion: 'aus-faden', fadenId: 'fd-zwei' });
    expect(b.j.skill.anleitung).not.toContain('AGENTENTEXT');
    expect(b.j.skill.name).not.toBe(a.j.skill.name);
    expect((await post('person-a', { aktion: 'aus-faden', fadenId: 'fd-eins' })).status).toBe(404); // fremder Thread
    expect(entwurfAusFaden({ titel: 'Ä Ö Ü ß', nachrichten: [], fremdGelesen: false }, ctxSales).name).toBe('ae-oe-ue-ss');
  });
});

describe('Vorschläge von Agenten nur über den Stapel — wirksam erst nach Klick', () => {
  it('Skill-Vorschlag: ungültig erreicht den Stapel nie; gültig → Stapel-Art „skill“; Freigabe nur durch die Person → Entwurf (aus)', async () => {
    const h = { person: 'person-b', agent: { art: 'head' as const, headId: 'sales' }, anlass: 'Aus dem Chat' };
    expect(await SK.vorschlagSkillLegen(h, 'sales', { ...ENTWURF, name: 'x', werkzeuge: ['erfasse_rechnung'] })).toMatchObject({ ok: false, status: 400 });
    const v = await SK.vorschlagSkillLegen(h, 'sales', { ...ENTWURF, name: 'vom-agenten' });
    expect(v.ok).toBe(true);
    const vorschlag = (v as { vorschlag: import('@/lib/zoe/stapel').Vorschlag }).vorschlag;
    expect(vorschlag.bezug).toEqual({ art: 'skill', id: 'sales' });
    const { stapelArtVon } = await import('@/lib/zoe/stapel-arten');
    const art = await stapelArtVon(vorschlag);
    expect(art).not.toBeNull();
    expect(await art!.freigeben(vorschlag, 'person-a', {})).toMatchObject({ ok: false, status: 403 });
    const r = await art!.freigeben(vorschlag, 'person-b', {});
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const { hole } = await import('@/lib/zoe/stapel');
    expect(await hole(vorschlag.id)).toMatchObject({ status: 'freigegeben', entschiedenVon: 'person-b' });
    const s = (await SK.werkstattSicht('person-b', 'sales'));
    const neu = s.ok ? s.skills.find(x => x.name === 'vom-agenten') : undefined;
    expect(neu).toMatchObject({ aktiv: false });
    expect(await art!.freigeben(vorschlag, 'person-b', {})).toMatchObject({ ok: false, status: 409 });
  });
  it('Mitarbeiter- und Merksatz-Vorschlag → nach Klick angelegt, mit Herkunft (Agent) und Freigabe (Person)', async () => {
    const h = { person: 'person-b', agent: { art: 'head' as const, headId: 'marketing' } };
    const m = await SK.vorschlagMitarbeiterLegen(h, 'marketing', { name: 'Fallstudien', rolle: 'Sammelt Fallstudien.', werkzeuge: ['marketing_lage'] });
    const ms = await SK.vorschlagMerksatzLegen(h, { art: 'head', headId: 'marketing' }, 'Beiträge nie am Wochenende planen.');
    const { stapelArtVon } = await import('@/lib/zoe/stapel-arten');
    for (const v of [m, ms]) {
      const vor = (v as { vorschlag: import('@/lib/zoe/stapel').Vorschlag }).vorschlag;
      expect((await (await stapelArtVon(vor))!.freigeben(vor, 'person-b', {})).ok).toBe(true);
    }
    const s = await SK.werkstattSicht('person-b', 'marketing');
    expect(s.ok && s.mitarbeiter.find(x => x.name === 'Fallstudien')).toMatchObject({ quelle: 'vorschlag', freigegebenVon: 'person-b', aktiv: true });
    expect(s.ok && s.gedaechtnis?.[0]).toMatchObject({ quelle: 'vorschlag', von: 'head:marketing', freigegebenVon: 'person-b' });
  });
});

describe('Sicht und Trennung (serverseitig)', () => {
  it('fremder Haushalt, Dienstweg mit/ohne Person → 403', async () => {
    expect((await get('gast')).status).toBe(403);
    expect((await get('x', '', dienst('person-a'))).status).toBe(403);
    expect((await post('x', { aktion: 'anlegen', skill: ENTWURF }, dienst())).status).toBe(403);
  });
  it('„nur Business“: Business-Heads ja, Privat-Heads nie (Liste und direkt)', async () => {
    const g = await get('nur-business');
    expect(g.j.skills.every((s: { headId: string }) => headDef(s.headId)?.bereich === 'business')).toBe(true);
    expect((await get('nur-business', '?head=assistenz')).status).toBe(403);
    expect((await post('nur-business', { aktion: 'anlegen', skill: { ...ENTWURF, headId: 'assistenz', name: 'woche', werkzeuge: [] } })).status).toBe(403);
  });
  it('Privat-Skills sieht nur die Person selbst (eigener Bestand); Business-Skills der ganze Haushalt', async () => {
    const r = await post('person-a', { aktion: 'anlegen', skill: { headId: 'assistenz', name: 'wochenplan-privat', beschreibung: 'Plant die Woche — PRIVAT-MARKE-A.', anleitung: 'Termine sichten.', werkzeuge: ['freie_zeit'] } });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const db = await import('@/lib/store/local-db');
    expect(JSON.stringify(await db.loadJson(skillsPersonBestand('person-a')))).toContain('PRIVAT-MARKE-A');
    expect(JSON.stringify((await get('person-b')).j)).not.toContain('PRIVAT-MARKE-A');
    expect((await get('person-b', `?id=${r.j.skill.id}`)).status).toBe(404);
    expect((await post('person-b', { aktion: 'loeschen', id: r.j.skill.id, stand: r.j.stand })).status).toBe(404);
    expect(JSON.stringify((await get('person-a')).j)).toContain('PRIVAT-MARKE-A');
    expect(JSON.stringify((await get('person-a', '?head=sales')).j)).toContain('angebot-nachfassen'); // Business-Skill von person-b
  });
});

describe('Eigentum beim Konto-Löschen (Fragerunde 8)', () => {
  it('Business-Skills und eigene Mitarbeiter gehen an den Inhaber; „freigegeben von“ wird „[gelöscht]“; Privat-Werkstatt geht weg', async () => {
    const db = await import('@/lib/store/local-db');
    expect((await post('person-b', { aktion: 'anlegen', skill: { headId: 'assistenz', name: 'meins', beschreibung: 'Eigener Ablauf der zweiten Person.', anleitung: 'x', werkzeuge: [] } })).status).toBe(200);
    expect((await post('person-b', { aktion: 'mitarbeiter-anlegen', headId: 'sales', mitarbeiter: { name: 'Empfehlungen', rolle: 'Bittet um Empfehlungen.', werkzeuge: ['mandate_lage'] } })).status).toBe(200);
    const kd = await import('@/lib/datenschutz/konto-daten');
    const ex = await kd.kontoExport('person-b');
    expect(ex?.eintraege[skillsHaushaltBestand('haus-a')]?.length).toBeGreaterThan(0);
    expect(Object.keys(ex?.bestaende ?? {})).toContain(skillsPersonBestand('person-b'));
    const bericht = await kd.kontoLoeschen('person-b');
    expect(bericht?.bestaende).toContain(skillsPersonBestand('person-b'));
    const w = JSON.stringify(await db.loadJson(skillsHaushaltBestand('haus-a')));
    expect(w).not.toContain('"person-b"');
    const werk = await db.loadJson<import('@/lib/agenten/typen').WerkstattBestand>(skillsHaushaltBestand('haus-a'));
    const s = werk!.skills.find(x => x.name === 'angebot-nachfassen')!;
    expect(s.angelegtVon).toBe('person-a');
    expect(werk!.mitarbeiter.find(m => m.name === 'Empfehlungen')?.angelegtVon).toBe('person-a');
    expect(await db.loadJson(skillsPersonBestand('person-b'))).toBeNull();
  });
  it('werkstattOhnePerson (rein): ohne anderen Inhaber „[gelöscht]“; nichts zu tun → 0', () => {
    const w = { v: 1 as const, skills: [], mitarbeiter: [], gedaechtnis: { sales: [{ id: 'ms-1', text: 'x', am: 'a', von: 'p', quelle: 'hand' as const }] } };
    expect(SK.werkstattOhnePerson(w, 'p', 'p', 'a').werkstatt.gedaechtnis.sales?.[0].von).toBe('[gelöscht]');
    expect(SK.werkstattOhnePerson(w, 'q', 'p', 'a').anzahl).toBe(0);
  });
});

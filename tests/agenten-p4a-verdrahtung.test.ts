// ─── Wächter Paket 4a: die Haken von Paket 3 sind verdrahtet (09.10.; lib/agenten/skills-server.ts, laeufe.ts, plan-server.ts) ──────────
//   • Sicht: die Werkstatt fragt die EINE Filterstelle (lib/agenten/sicht.ts) — nicht mehr die vorläufige Regel.
//   • Probelauf: die echte Schleife im TROCKENLAUF — lesende Werkzeuge lesen, alles Schreibende/Stapelnde zeigt nur die Vorschau.
//   • Vorschläge der Agenten (Skill, Mitarbeiter, Merksatz) gehen über die Vorschlags-Stellen der Werkstatt (Form der Stapel-Arten).
//   • Skill-Läufe zählen in die Erfolgsquote, Plan-Läufe vermerken ihren Start; die Lauf-Eingabe darf `headId`/`batch` tragen.
// Eigener Datenordner, erfundene Konten, Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-p4a-verdrahtung-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-p4a-v', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});

import type { Faden } from '@/lib/agenten/typen';
import { dienst, kontenSaeen, modellFake, rufe, sitzung, text, werkzeug, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');
let SK: typeof import('@/lib/agenten/skills-server');
let skillId = '';

const ergebnisse = (b: Record<string, unknown>): string[] => {
  const letzte = ((b.messages as { content?: unknown }[] | undefined) ?? []).at(-1);
  return Array.isArray(letzte?.content) ? (letzte!.content as { content?: unknown }[]).map(x => String(x.content ?? '')) : [];
};

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  SK = await import('@/lib/agenten/skills-server');
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

describe('Sicht: die Werkstatt fragt die EINE Filterstelle', () => {
  it('headSichtbar der Werkstatt = lib/agenten/sicht.ts (Konto „nur Business“ ohne Privat-Heads, fremder Haushalt nichts)', async () => {
    for (const [person, head, soll] of [['person-a', 'sales', true], ['person-a', 'assistenz', true], ['team-c', 'sales', true], ['team-c', 'assistenz', false], ['team-c', 'familie', false], ['gast', 'sales', false], ['kunde', 'sales', false], ['person-a', 'gesundheit', false]] as const) {
      expect(await SK.headSichtbar(person, head), `${person}/${head}`).toBe(soll);
      expect(await SK.headSichtbarKern(person, head), `${person}/${head}`).toBe(soll);
    }
  });
});

describe('Probelauf: die echte Schleife im Trockenlauf', () => {
  it('ein Skill-Testlauf liest, zeigt Schreibendes nur als Vorschau und legt NICHTS an', async () => {
    const neu = await SK.skillAnlegen('person-a', {
      headId: 'sales', name: 'angebot-nachfassen', beschreibung: 'Fasst offene Angebote nach sieben Tagen nach.',
      anleitung: '1. Offene Angebote lesen.\n2. Je Angebot einen Entwurf vorschlagen.\n3. Nichts senden.',
      werkzeuge: ['angebote_lage', 'crm_vorschlag'],
      tests: [1, 2, 3].map(i => ({ eingabe: `Angebot ${i} seit neun Tagen offen`, erwartet: ['ein Entwurf'] })),
    });
    expect(neu.ok).toBe(true);
    skillId = (neu as { skill: { id: string } }).skill.id;
    const { lies } = await import('@/lib/zoe/stapel');
    const vorher = (await lies('offen')).length;
    m.anfragen.length = 0;
    for (let i = 0; i < 3; i++) m.antworten.push(werkzeug(['crm_vorschlag', { art: 'nachricht_entwurf', kontakt: 'c-00000000-0000-4000-8000-000000000009', kanal: 'mail', text: 'Hallo, kurze Frage zum Angebot.' }]), text('Ein Entwurf liegt bereit.'), text('{"erfuellt":[true],"notiz":"passt"}'));
    const r = await SK.skillTestlaufAktion('person-a', skillId, { kostenBestaetigt: true });
    expect(r.ok).toBe(true);
    const testlauf = (r as { skill: { testlauf?: { ok: boolean; ergebnisse: { ok: boolean }[] } } }).skill.testlauf!;
    expect(testlauf.ok).toBe(true);
    expect(testlauf.ergebnisse).toHaveLength(3);
    // Der Kopf des Laufs ist der Head mit der Anleitung des Skills — und nur den Werkzeugen des Skills.
    expect(JSON.stringify(m.anfragen[0].system)).toContain('Du bist Head of Sales');
    expect(JSON.stringify(m.anfragen[0].system)).toContain('AKTIVER SKILL „angebot-nachfassen“');
    expect((m.anfragen[0].tools as { name: string }[]).map(t => t.name).filter(n => !['skill_laden', 'an_mitarbeiter', 'merksatz_vorschlagen', 'skill_vorschlagen', 'mitarbeiter_vorschlagen'].includes(n)).sort()).toEqual(['angebote_lage', 'crm_vorschlag']);
    expect(ergebnisse(m.anfragen[1])[0]).toMatch(/^TROCKENLAUF — nicht ausgeführt, nur gezeigt/);
    expect((await lies('offen')).length).toBe(vorher);
    expect(await db.loadJson('tasks')).toBeNull();
    expect(await db.loadJson('agenten-faeden--person-a')).toBeNull(); // kein Thread gespeichert
  });
});

describe('Vorschläge der Agenten über die Werkstatt (Stapel-Arten skill · mitarbeiter · merksatz)', () => {
  it('skill_vorschlagen und mitarbeiter_vorschlagen aus dem Head-Chat: geprüft, in der Form der Stapel-Art, erst nach Klick wirksam', async () => {
    const faden = (await import('@/app/api/agenten/faden/route')) as unknown as { POST: H };
    m.antworten.push(werkzeug(
      ['skill_vorschlagen', { name: 'lead-check', beschreibung: 'Prüft neue Leads am Morgen.', anleitung: 'Leads lesen, Fit prüfen.', werkzeuge: ['crm_suche'] }],
      ['skill_vorschlagen', { name: 'zu-viel', beschreibung: 'x', anleitung: 'y', werkzeuge: ['setze_kontostand'] }],
      ['mitarbeiter_vorschlagen', { name: 'Fallstudien', rolle: 'Sammelt Fallstudien aus Mandaten.', werkzeuge: ['mandate_lage'] }],
    ), text('Liegt im Stapel.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Schlag mir einen Skill und einen Mitarbeiter vor.' });
    expect(r.status).toBe(200);
    const w = (r.d.faden as Faden).nachrichten.at(-1)!.werkzeuge!;
    expect(w.map(x => [x.name, x.ok, !!x.gestapelt])).toEqual([['skill_vorschlagen', true, true], ['skill_vorschlagen', false, false], ['mitarbeiter_vorschlagen', true, true]]);
    const { lies } = await import('@/lib/zoe/stapel');
    const offen = await lies('offen');
    const sk = offen.find(v => v.bezug?.art === 'skill')!;
    expect(sk).toMatchObject({ werkzeug: 'skill_vorschlagen', person: 'person-a', bezug: { art: 'skill', id: 'sales' }, eingabe: { headId: 'sales', von: 'head:sales', entwurf: { name: 'lead-check', werkzeuge: ['crm_suche'] } } });
    expect(offen.find(v => v.bezug?.art === 'mitarbeiter')).toMatchObject({ eingabe: { headId: 'sales', entwurf: { name: 'Fallstudien' } } });
    expect(offen.some(v => JSON.stringify(v.eingabe).includes('zu-viel'))).toBe(false);
    // Nichts ist schon wirksam: der Skill steht erst nach dem Klick in der Werkstatt.
    expect((await SK.werkstattLaden('agenten-skills--haus-a')).skills.map(s => s.name)).not.toContain('lead-check');
  });
});

describe('Läufe: Erfolgsquote je Skill, Start geplanter Aufgaben, Lauf-Eingabe mit headId/batch', () => {
  it('ein Skill-Lauf zählt in die Erfolgsquote', async () => {
    const st = await SK.skillMitStand('person-a', skillId);
    expect(st.ok).toBe(true);
    const an = await SK.skillAktivAktion('person-a', skillId, true, (st as { stand: string }).stand);
    expect(an.ok).toBe(true);
    const d = await import('@/lib/agenten/delegation');
    m.antworten.push(text('Zwei Entwürfe vorgeschlagen.'));
    const r = await d.fadenLauf('person-a', { art: 'skill', skillId, headId: 'sales', ausloeser: 'hand' }, { origin: 'http://test', hintergrund: false });
    expect(r.ok).toBe(true);
    const sk = (await SK.werkstattLaden('agenten-skills--haus-a')).skills.find(s => s.id === skillId)!;
    expect(sk.erfolg).toMatchObject({ laeufe: 1, fehler: 0 });
  });
  it('eine geplante einmalige Aufgabe vermerkt ihren Start (letzterLauf, danach aus); die Lauf-Route nimmt headId/batch hin', async () => {
    const P = await import('@/lib/agenten/plan-server');
    const morgen = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const p = await P.planen('person-a', { agent: { art: 'head', headId: 'sales' }, titel: 'Wochenrückblick', auftrag: 'Fass die Woche im Vertrieb zusammen.', zeitplan: { art: 'einmalig', wann: `${morgen}T09:00:00` } }, { kostenBestaetigt: true });
    expect(p.ok).toBe(true);
    const planId = (p as { aufgabe: { id: string } }).aufgabe.id;
    const route = (await import('@/app/api/agenten/faden/lauf/route')) as unknown as { POST: H };
    m.antworten.push(text('Woche zusammengefasst.'));
    const r = await rufe(route.POST, '/api/agenten/faden/lauf', dienst('person-a'), { art: 'plan', planId, headId: 'sales', batch: true });
    expect(r.status).toBe(200);
    const a = (await P.planLesen('person-a')).aufgaben.find(x => x.id === planId)!;
    expect(a.letzterLauf).toBeTruthy();
    expect(a.aktiv).toBe(false);
    // Ein freier Text ist weiterhin kein Lauf.
    expect((await rufe(route.POST, '/api/agenten/faden/lauf', dienst('person-a'), { art: 'frei', text: 'mach was' })).status).toBe(400);
  });
});

// ─── Wächter: Prüf-Funde 11.10. — ZOE, Agenten, Brain-Prompt, Recht-Stapel („Sicht Business bekommt nichts aus Privat“ und umgekehrt) ─────────
//   H1  Heads/Fach-Agenten je Sicht; an_head/head_fragen prüfen `kontext.sicht`; Werkzeuge mit Bereich „beide“ liefern nur Daten der Sicht
//       (Postfach, Arbeitssuche, Wissen, Routinen, Aufgaben-Leser mit `space`).
//   H3  Recht-Vorschläge (Art „recht“) sieht und entscheidet nur, wer Zugang zur Firmen-Akte hat (nie ein Konto „nur Business“).
//   M3  Brain-Prompt je Sicht: Termine nach Bereich des Kalenders, keine Familien-Geburtstage und kein Reha-Schild in Business, Schalter „Familie“.
//   N1  crm_vorschlag in der Sicht Privat: nur „liegt unter Business“, keine Inhalte. N2  Protokoll-Sicht über `bereichAusGruppe`.
//   Zusatz: Agenten-Leser mit `space` passieren die Hülle (1), Freigabe mit ungültiger Eingabe bleibt offen (4), `startMonat` als Zahl (5),
//   Recht-Läufe halten bei Not-Aus/„aus“ (6), Morgenlauf rundet aufs Raster (8), selbst stapelnde Werkzeuge melden `gestapelt` (10).
// Eigener Datenordner, erfundene Konten (`@example.invalid`), Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-zoe-sicht-pf-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-zoe-sicht-pf', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'speicher', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});
// Der Live-Zustand bleibt im Gespräch draußen (das Brain prüfen die reinen Fälle unten mit dem echten Modul).
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import { HAUS, kontenSaeen, modellFake, rufe, sitzung, text, werkzeug, werkzeugNamen, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');

const PRIVAT_ROUTINE = 'PRIVAT-ROUTINE-MARKE-5501';
const BUSINESS_ROUTINE = 'BUSINESS-ROUTINE-MARKE-5502';
const PRIVAT_NOTIZ = 'PRIVAT-NOTIZ-MARKE-5503';
const PRIVAT_AUFGABE = 'PRIVATAUFGABEMARKE5504';
const BUSINESS_AUFGABE = 'BUSINESSAUFGABEMARKE5505';
const systemText = (b: Record<string, unknown>) => JSON.stringify(b.system ?? '');
const ergebnisse = (b: Record<string, unknown>): string[] => {
  const letzte = ((b.messages as { content?: unknown }[] | undefined) ?? []).at(-1);
  return Array.isArray(letzte?.content) ? (letzte!.content as { content?: unknown }[]).map(x => String(x.content ?? '')) : [];
};
const fuehre = async (name: string, input: Record<string, unknown>, opt: Record<string, unknown>) =>
  (await import('@/lib/zoe/ausfuehren')).fuehreAus(name, input, 'http://test', opt);

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  for (const z of ['verarbeiten', 'ki'] as const) expect((await gesundheitErklaeren('person-a', z, true, GESUNDHEIT_FASSUNG)).ok).toBe(true);
  await db.saveJson('routinen', { routinen: [
    { id: 'r-p', label: PRIVAT_ROUTINE, aktiv: true, owner: 'beide', space: 'privat' },
    { id: 'r-b', label: BUSINESS_ROUTINE, aktiv: true, owner: 'beide', space: 'business' },
  ] });
  const vault = process.env.MAKE_VAULT_DIR!;
  await fs.mkdir(path.join(vault, '02. MAKE Brain privat'), { recursive: true });
  await fs.mkdir(path.join(vault, '00. Fundament'), { recursive: true });
  await fs.writeFile(path.join(vault, '02. MAKE Brain privat', 'Pruef-Privat.md'), `---\ntype: notiz\nscope: privat\nowner: person-a\n---\n# Pruef Privat\n\n${PRIVAT_NOTIZ} Pruefwort\n`);
  const T0 = '2026-10-01T08:00:00.000Z';
  const a = (id: string, title: string, projectId: string, spaceId: string) => ({ id, projectId, title, status: 'todo', priority: 'high', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId });
  const p = (id: string, title: string, spaceId: string) => ({ id, title, category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId });
  await db.saveJson('tasks', {
    projects: [p('p-priv', 'Haus', 'privat'), p('p-bus', 'Vertrieb', 'ug')], listen: [], statusEigen: [], vorlagen: [],
    tasks: [a('t-priv', `${PRIVAT_AUFGABE} Pruefsuche`, 'p-priv', 'privat'), a('t-bus', `${BUSINESS_AUFGABE} Pruefsuche`, 'p-bus', 'ug')],
  });
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

// ── H1: Heads, Fach-Agenten, Werkzeuge „beide“ ───────────────────────────────────────────────────────────────────────────

describe('H1 · ZOE in der Sicht Business bekommt nichts aus Privat (und umgekehrt)', () => {
  it('Heads: im Business-Gespräch nur Business-Heads in Prompt und Schema — head_fragen/an_head auf einen Privat-Head → „rechte“, nichts angelegt', async () => {
    const { KATALOG } = await import('@/lib/agenten/katalog');
    const privat = KATALOG.filter(h => h.bereich === 'privat');
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['head_fragen', { head: 'familie', frage: 'Was steht an?' }], ['an_head', { head: 'assistenz', auftrag: 'Plane den Sonntag.' }]), text('Geht hier nicht.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Frag die Familie und gib der Assistenz den Sonntag.', space: 'business', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    const anHead = (m.anfragen[0].tools as { name: string; input_schema: { properties: { head: { enum: string[] } } } }[]).find(t => t.name === 'an_head')!;
    for (const h of privat) {
      expect(anHead.input_schema.properties.head.enum).not.toContain(h.id);
      expect(systemText(m.anfragen[0])).not.toContain(h.name);
    }
    const e = ergebnisse(m.anfragen[1]);
    expect(e).toHaveLength(2);
    for (const x of e) expect(x).toMatch(/gehört nicht in die Sicht Business/);
    const { alleFaedenLesen } = await import('@/lib/agenten/faeden-ablage');
    expect((await alleFaedenLesen('person-a')).filter(f => f.agent.art === 'head')).toEqual([]);
  });
  it('Heads umgekehrt: im Privat-Gespräch kein Business-Head (Schema + Werkzeug)', async () => {
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['head_fragen', { head: 'sales', frage: 'Wie steht die Pipeline?' }]), text('Geht hier nicht.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Frag Sales nach der Pipeline.', space: 'privat', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    const anHead = (m.anfragen[0].tools as { name: string; input_schema: { properties: { head: { enum: string[] } } } }[]).find(t => t.name === 'an_head')!;
    expect(anHead.input_schema.properties.head.enum).not.toContain('sales');
    expect(ergebnisse(m.anfragen[1])[0]).toMatch(/gehört nicht in die Sicht Privat/);
  });
  it('Fach-Agenten je Sicht (rein): Business ohne Ernährung, Tagesform, alle Postfächer, Head of Finance; Privat ohne reine Business-Agenten', async () => {
    const { fachAgentInSicht } = await import('@/lib/agenten/werkzeuge');
    for (const a of ['ernaehrung', 'fokus', 'inbox', 'finanzchef', 'okr', 'task', 'kalender', 'planung', 'performance']) expect(fachAgentInSicht(a, 'business'), a).toBe(false);
    for (const a of ['crm', 'research', 'board', 'head-sales', 'content']) expect(fachAgentInSicht(a, 'business'), a).toBe(true);
    for (const a of ['crm', 'board', 'controlling', 'head-sales', 'prospect', 'finanzchef']) expect(fachAgentInSicht(a, 'privat'), a).toBe(false);
    for (const a of ['ernaehrung', 'fokus', 'research']) expect(fachAgentInSicht(a, 'privat'), a).toBe(true);
    for (const a of ['ernaehrung', 'crm']) expect(fachAgentInSicht(a, null), a).toBe(true);
  });
  it('run_agent im Business-Gespräch: die Ernährung steht nicht im Angebot und startet nicht', async () => {
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['run_agent', { agent: 'ernaehrung', auftrag: 'Wochenplan' }]), text('Nicht hier.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Starte den Ernährungs-Agenten für den Wochenplan (Agent, Recherche).', space: 'business', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    const ra = (m.anfragen[0].tools as { name: string; input_schema: { properties: { agent?: { enum?: string[] } } } }[]).find(t => t.name === 'run_agent');
    if (ra) expect(ra.input_schema.properties.agent?.enum ?? []).not.toContain('ernaehrung');
    expect(ergebnisse(m.anfragen[1])[0]).toMatch(/^Nicht (angeboten|ausgeführt)/);
  });
  it('starte_auftraege prüft die Sicht selbst (auch wenn das Modell es nennt)', async () => {
    const l = await fuehre('starte_auftraege', { auftraege: [{ agent: 'ernaehrung' }] }, { person: 'person-a', sicht: 'business' });
    expect(l.ok).toBe(false);
    expect(l.ergebnis.klasse).toBe('rechte');
    expect(l.text).toMatch(/gehört nicht in die Sicht Business/);
  });
  it('hake_routine: in Business weder Privat-Routinen abhaken noch aufzählen; in Privat keine Business-Routine', async () => {
    const b = await fuehre('hake_routine', { routinen: ['gibt-es-nicht-xyz'] }, { person: 'person-a', sicht: 'business' });
    expect(b.ok).toBe(false);
    expect(b.text).toContain(BUSINESS_ROUTINE);
    expect(b.text).not.toContain(PRIVAT_ROUTINE);
    const p = await fuehre('hake_routine', { routinen: ['gibt-es-nicht-xyz'] }, { person: 'person-a', sicht: 'privat' });
    expect(p.text).toContain(PRIVAT_ROUTINE);
    expect(p.text).not.toContain(BUSINESS_ROUTINE);
    // Abhaken einer Privat-Routine im Business-Gespräch: findet sie nicht.
    const h = await fuehre('hake_routine', { routinen: [PRIVAT_ROUTINE] }, { person: 'person-a', sicht: 'business' });
    expect(h.ok).toBe(false);
    // Ohne Sicht wie bisher beide.
    const o = await fuehre('hake_routine', { routinen: ['gibt-es-nicht-xyz'] }, { person: 'person-a' });
    expect(o.text).toContain(PRIVAT_ROUTINE);
    expect(o.text).toContain(BUSINESS_ROUTINE);
  });
  it('suche_wissen / lies_notiz: in Business nie `scope: privat` (auch nicht die eigene), ohne Sicht wie bisher', async () => {
    const b = await fuehre('suche_wissen', { frage: 'Pruefwort' }, { person: 'person-a', sicht: 'business' });
    expect(b.text).not.toContain(PRIVAT_NOTIZ);
    const o = await fuehre('suche_wissen', { frage: 'Pruefwort' }, { person: 'person-a' });
    expect(o.text).toContain(PRIVAT_NOTIZ);
    const n = await fuehre('lies_notiz', { notiz: 'Pruef-Privat' }, { person: 'person-a', sicht: 'business' });
    expect(n.text).not.toContain(PRIVAT_NOTIZ);
  });
  it('suche_arbeit: in Business keine Privat-Aufgabe, in Privat keine Business-Aufgabe', async () => {
    const b = await fuehre('suche_arbeit', { frage: 'Pruefsuche', nur: 'app' }, { person: 'person-a', sicht: 'business' });
    expect(b.text).not.toContain(PRIVAT_AUFGABE);
    expect(b.text).toContain(BUSINESS_AUFGABE);
    const p = await fuehre('suche_arbeit', { frage: 'Pruefsuche', nur: 'app' }, { person: 'person-a', sicht: 'privat' });
    expect(p.text).toContain(PRIVAT_AUFGABE);
    expect(p.text).not.toContain(BUSINESS_AUFGABE);
    // Konto „nur Business“ in der Sicht Privat: abgelehnt.
    const t = await fuehre('suche_arbeit', { frage: 'Pruefsuche' }, { person: 'team-c', sicht: 'privat' });
    expect(t.ok).toBe(false);
  });
  it('lies_postfach: in einer Sicht nur die Postfächer dieses Bereichs (Leser des Agenten-Bereichs)', async () => {
    const b = await fuehre('lies_postfach', {}, { person: 'person-a', sicht: 'business' });
    expect(b.text).toMatch(/Im Bereich Business ist kein Postfach verbunden/);
  });
  it('Aufgaben-Leser mit `space`: die Sicht setzt ihn fest (rein) — und die Hülle lässt ihn durch (ZOE + Agenten-Bereich)', async () => {
    const { eingabeInSicht } = await import('@/lib/zoe/bereich');
    expect(eingabeInSicht('meine_aufgaben', { space: 'privat' }, 'business')).toEqual({ space: 'business' });
    expect(eingabeInSicht('projekt_unterlagen', { projekt: 'x' }, 'privat')).toEqual({ projekt: 'x', space: 'privat' });
    expect(eingabeInSicht('create_task', { title: 'x' }, 'business')).toEqual({ title: 'x' });
    expect(eingabeInSicht('meine_aufgaben', { space: 'privat' }, null)).toEqual({ space: 'privat' });
    const { vertragsPruefung } = await import('@/lib/werkzeuge/huelle');
    const { eingabeImBereich } = await import('@/lib/agenten/werkzeuge');
    const { headDef } = await import('@/lib/agenten/katalog');
    for (const head of ['operations', 'kundenerfolg', 'it', 'assistenz']) {
      const h = headDef(head)!;
      for (const [w, roh] of [['meine_aufgaben', {}], ['projekt_unterlagen', { projekt: 'Vertrieb' }], ['datei_lesen', { datei: 'd-x' }]] as const) {
        const p = vertragsPruefung(w, eingabeImBereich(w, { ...roh }, h), { sicht: h.bereich });
        expect(p.ok, `${head} ${w}: ${p.ok ? '' : p.ergebnis.meldung}`).toBe(true);
      }
    }
    // Über die echte Hülle: meine_aufgaben aus dem Agenten-Bereich (Business-Head) läuft, statt an „space gibt es nicht“ zu scheitern.
    const l = await fuehre('meine_aufgaben', eingabeImBereich('meine_aufgaben', {}, headDef('operations')!), { person: 'person-a', sicht: 'business' });
    expect(l.text).not.toMatch(/gibt es bei diesem Werkzeug nicht/);
    expect(l.ok).toBe(true);
  });
});

// ── H3: Recht-Vorschläge nur mit Zugang zur Firmen-Akte ─────────────────────────────────────────────────────────────────

describe('H3 · Recht-Vorschläge sieht und entscheidet nur, wer die Firmen-Akte sieht', () => {
  it('rein: Art „recht“ ohne Zugang → unsichtbar, auch ohne Person am Vorschlag', async () => {
    const { vorschlagSichtbar } = await import('@/lib/zoe/stapel');
    const v = { gruppe: 'business', bezug: { art: 'recht' }, bereich: 'business' };
    expect(vorschlagSichtbar(v, 'team-c', true, false, false)).toBe(false);
    expect(vorschlagSichtbar(v, 'person-a', true, true, true)).toBe(true);
    // Andere Arten unverändert.
    expect(vorschlagSichtbar({ gruppe: 'business', bereich: 'business' }, 'team-c', true, false, false)).toBe(true);
  });
  it('Route: ein Konto „nur Business“ sieht den Recht-Vorschlag nicht und kann ihn nicht ablehnen (404); die Inhaberin schon', async () => {
    const { lege, hole } = await import('@/lib/zoe/stapel');
    const v = await lege({ werkzeug: 'recht_aufgabe', gruppe: 'business', titel: 'RECHT-VORSCHLAG-MARKE', nachher: 'Aufgabe anlegen (Business)', eingabe: { schluessel: 'pf-1', titel: 'x', text: 'y', weg: '/os' }, anlass: 'Head of Recht: Recht-Check', quelle: 'lauf', bezug: { art: 'recht', id: 'aufgabe-pf1' } });
    const stapel = (await import('@/app/api/zoe/stapel/route')) as unknown as { GET: H; POST: H };
    const t = await rufe(stapel.GET, '/api/zoe/stapel?space=business', sitzung('team-c'));
    expect(t.status).toBe(200);
    expect(JSON.stringify(t.d)).not.toContain('RECHT-VORSCHLAG-MARKE');
    const nein = await rufe(stapel.POST, '/api/zoe/stapel', sitzung('team-c'), { id: v.id, entscheidung: 'ablehnen', grund: 'nicht relevant' });
    expect(nein.status).toBe(404);
    expect((await hole(v.id))?.status).toBe('offen');
    const a = await rufe(stapel.GET, '/api/zoe/stapel?space=business', sitzung('person-a'));
    expect(JSON.stringify(a.d)).toContain('RECHT-VORSCHLAG-MARKE');
    const { vorschlaegeFuer } = await import('@/lib/zoe/stapel');
    expect((await vorschlaegeFuer('team-c', 'offen')).some(x => x.id === v.id)).toBe(false);
    expect((await vorschlaegeFuer('person-a', 'offen')).some(x => x.id === v.id)).toBe(true);
  });
});

// ── M3: Brain-Prompt je Sicht ───────────────────────────────────────────────────────────────────────────────────────────

describe('M3 · Brain-Prompt je Sicht (echtes Modul)', () => {
  it('Business: keine Privat-Termine, keine Familien-Geburtstage, kein Reha-Schild; Privat: keine Business-Termine; Schalter „Familie“ wirkt', async () => {
    const B = await vi.importActual<typeof import('@/lib/brain')>('@/lib/brain');
    const b = await B.gatherBrain(undefined, 'person-a');
    const tag = b.heute;
    b.kalender.heute = [
      { title: 'PRIVAT-TERMIN-MARKE', calendarName: 'Familie', space: 'privat', startDate: `${tag}T09:00:00` },
      { title: 'BUSINESS-TERMIN-MARKE', calendarName: 'Arbeit', space: 'business', startDate: `${tag}T10:00:00` },
      { title: 'OHNE-SPACE-PRIVAT-MARKE', calendarName: 'Zuhause', startDate: `${tag}T11:00:00` },
    ] as typeof b.kalender.heute;
    b.anlaesse = { feiertage: [], geburtstage: [{ name: 'FAMILIE-GEB-MARKE', tag, herkunft: 'familie' }, { name: 'KONTAKT-GEB-MARKE', tag, herkunft: 'crm' }] };
    b.shields = [{ id: 'reha', stufe: 'amber', text: 'REHA-SCHILD-MARKE', href: '/os/planung', label: 'Tagesplanung' }] as typeof b.shields;
    const bus = B.promptBrain(b, { sicht: 'business' });
    for (const x of ['PRIVAT-TERMIN-MARKE', 'OHNE-SPACE-PRIVAT-MARKE', 'FAMILIE-GEB-MARKE', 'REHA-SCHILD-MARKE']) expect(bus, x).not.toContain(x);
    for (const x of ['BUSINESS-TERMIN-MARKE', 'KONTAKT-GEB-MARKE']) expect(bus, x).toContain(x);
    const pri = B.promptBrain(b, { sicht: 'privat' });
    expect(pri).not.toContain('BUSINESS-TERMIN-MARKE');
    for (const x of ['PRIVAT-TERMIN-MARKE', 'FAMILIE-GEB-MARKE', 'REHA-SCHILD-MARKE']) expect(pri, x).toContain(x);
    const ohneFamilie = B.promptBrain(b, { bereiche: { familie: false } });
    expect(ohneFamilie).not.toContain('FAMILIE-GEB-MARKE');
    expect(ohneFamilie).toContain('KONTAKT-GEB-MARKE');
    // „fremd gelesen“ nur nach Terminen der Sicht.
    b.kalender.heute = [{ title: 'Einladung', calendarName: 'Familie', space: 'privat', fremd: true, startDate: `${tag}T09:00:00` }] as typeof b.kalender.heute;
    expect(B.kalenderImPrompt(b, 'business')).toBe(false);
    expect(B.kalenderImPrompt(b, 'privat')).toBe(true);
    expect(B.kalenderImPrompt(b)).toBe(true);
  });
});

// ── N1, N2, Zusatz 10 ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('N1 · crm_vorschlag in der Sicht Privat nennt keine Inhalte · Zusatz 10: selbst gestapelt = gestapelt', () => {
  it('Privat: nur „liegt unter Business“; Business: Titel wie bisher — beide gestapelt mit Kennung', async () => {
    const { PRIVAT_VORGESCHLAGEN } = await import('@/lib/zoe/crm-vorschlag');
    const p = await fuehre('crm_vorschlag', { art: 'aufgabe', titel: 'CRM-TITEL-MARKE nachfassen' }, { person: 'person-a', sicht: 'privat' });
    expect(p.text).toBe(PRIVAT_VORGESCHLAGEN);
    expect(p.text).not.toContain('CRM-TITEL-MARKE');
    expect(p.gestapelt).toBe(true);
    expect(p.vorschlagId).toBeTruthy();
    const { hole } = await import('@/lib/zoe/stapel');
    expect((await hole(p.vorschlagId!))?.bereich).toBe('business');
    const b = await fuehre('crm_vorschlag', { art: 'aufgabe', titel: 'CRM-TITEL-MARKE zwei' }, { person: 'person-a', sicht: 'business' });
    expect(b.text).toContain('CRM-TITEL-MARKE');
    expect(b.gestapelt).toBe(true);
    expect(b.vorschlagId).toBeTruthy();
    // Ein Fehlschlag der Prüfung nennt in Privat keine Namen.
    const f = await fuehre('crm_vorschlag', { art: 'deal_aendern', deal: 'gibt-es-nicht-Marke-XY' }, { person: 'person-a', sicht: 'privat' });
    expect(f.ok).toBe(false);
    expect(f.text).not.toContain('gibt-es-nicht-Marke-XY');
  });
});

describe('N2 · ZOE-Protokoll je Sicht über die EINE Gruppen-Regel', () => {
  it('Privat ohne Finanzen/Bauplan/Markttraktion, Business ohne Gesundheit/Haushalt; neutrale Gruppen in beiden', async () => {
    const { notiere } = await import('@/lib/zoe/protokoll');
    for (const gruppe of ['finanzen', 'bauplan', 'markttraktion', 'gesundheit', 'haushalt', 'aufgaben']) {
      await notiere({ werkzeug: `w-${gruppe}`, gruppe, risiko: 'frei', eingabe: {}, ergebnis: `PROTOKOLL-${gruppe}`, ok: true, quelle: 'zoe', person: 'person-a' });
    }
    const route = (await import('@/app/api/zoe/protokoll/route')) as unknown as { GET: H };
    const gruppen = async (space: string) => ((await rufe(route.GET, `/api/zoe/protokoll?space=${space}&anzahl=200`, sitzung('person-a'))).d.eintraege as { gruppe: string }[]).map(e => e.gruppe);
    const p = await gruppen('privat');
    for (const g of ['finanzen', 'bauplan', 'markttraktion']) expect(p, g).not.toContain(g);
    expect(p).toEqual(expect.arrayContaining(['gesundheit', 'aufgaben']));
    const b = await gruppen('business');
    for (const g of ['gesundheit', 'haushalt']) expect(b, g).not.toContain(g);
    expect(b).toEqual(expect.arrayContaining(['finanzen', 'bauplan', 'aufgaben']));
  });
});

// ── Zusatz 4, 5, 6, 8 ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('Zusatz 4 · Freigabe mit ungültiger Eingabe: der Vorschlag bleibt offen', () => {
  it('Block neben dem Raster (alter Vorschlag / „Ändern & freigeben“ mit dauerMin 50) → 400, Vorschlag offen, nichts fehlgeschlagen', async () => {
    const { lege, hole } = await import('@/lib/zoe/stapel');
    const { localDay } = await import('@/lib/zeit');
    const v = await lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Block', nachher: 'Fokus', eingabe: { date: localDay(), startMin: 545, dauerMin: 60, titel: 'Fokus' }, person: 'person-a', quelle: 'gespraech' }, { gespraech: 'privat' });
    const stapel = (await import('@/app/api/zoe/stapel/route')) as unknown as { POST: H };
    const r = await rufe(stapel.POST, '/api/zoe/stapel', sitzung('person-a'), { id: v.id, entscheidung: 'freigeben' });
    expect(r.status).toBe(400);
    expect(String(r.d.error)).toMatch(/bleibt offen/);
    expect((await hole(v.id))?.status).toBe('offen');
    const r2 = await rufe(stapel.POST, '/api/zoe/stapel', sitzung('person-a'), { id: v.id, entscheidung: 'freigeben', eingabe: { date: localDay(), startMin: 540, dauerMin: 50, titel: 'Fokus' } });
    expect(r2.status).toBe(400);
    expect((await hole(v.id))?.status).toBe('offen');
  });
});

describe('Zusatz 5 · „Rückgängig“ für setze_ziele mit startMonat als Zahl', () => {
  it('der Vertrag nimmt den gespeicherten Index (Alt-Protokolleintrag) und weiter den Monatsnamen', async () => {
    const { vertragsPruefung } = await import('@/lib/werkzeuge/huelle');
    expect(vertragsPruefung('setze_ziele', { startMonat: 3 }).ok).toBe(true);
    expect(vertragsPruefung('setze_ziele', { startMonat: 'Juni' }).ok).toBe(true);
    expect(vertragsPruefung('setze_ziele', { startMonat: 2.5 }).ok).toBe(false);
    // Der Trockenlauf legt die Rücknahme mit dem gespeicherten Index ab — genau diese Eingabe muss die Hülle passieren.
    await db.saveJson('finance', { zielUmsatz: 0, zielGewinn: 0, cash: 0, startMonat: 3 });
    const { vorschauVon } = await import('@/lib/zoe/register');
    const vs = await vorschauVon('setze_ziele', { startMonat: 'Juni' }, 'person-a');
    expect(vs.zurueck?.eingabe.startMonat).toBe(3);
    expect(vertragsPruefung('setze_ziele', vs.zurueck!.eingabe).ok).toBe(true);
  });
});

describe('Zusatz 6 · Recht-Läufe halten bei Not-Aus und „Head of Recht aus“', () => {
  it('Morgenlauf und Vertragseingang: übersprungen, nichts im Stapel', async () => {
    const { einstellungBestand } = await import('@/lib/agenten/typen');
    const { rechtMorgenlauf, vertragEingang } = await import('@/lib/recht/server');
    const { lies } = await import('@/lib/zoe/stapel');
    const vorher = (await lies()).length;
    await db.saveJson(einstellungBestand(HAUS), { v: 1, heads: {}, notAus: { seit: new Date().toISOString(), von: 'person-a' } });
    const a = await rechtMorgenlauf(HAUS);
    expect(a.uebersprungen).toMatch(/Not-Aus/);
    expect(a.vorschlaege).toBe(0);
    const v = await vertragEingang(HAUS, 'person-a', 'd-gibt-es-nicht');
    expect(v.uebersprungen).toMatch(/Not-Aus/);
    await db.saveJson(einstellungBestand(HAUS), { v: 1, heads: { recht: { aktiv: false } } });
    expect((await rechtMorgenlauf(HAUS)).uebersprungen).toMatch(/ausgeschaltet/);
    expect((await vertragEingang(HAUS, 'person-a', 'd-gibt-es-nicht')).uebersprungen).toMatch(/ausgeschaltet/);
    expect((await lies()).length).toBe(vorher);
    await db.saveJson(einstellungBestand(HAUS), { v: 1, heads: {} });
  });
});

describe('Zusatz 8 · Morgenlauf: plan_block mit dem Schema des Vertrags, gerundet statt verworfen', () => {
  it('EIN Schema; Start/Dauer neben dem Raster werden auf 15 Minuten gerundet und passieren die Hülle', async () => {
    const { morgenWerkzeuge, morgenEingabe, MORGEN_ERLAUBT } = await import('@/lib/zoe/morgen-werkzeuge');
    const { werkzeugDefs } = await import('@/lib/zoe/werkzeug-defs');
    const pb = morgenWerkzeuge().find(w => w.name === 'plan_block')!;
    expect(pb.input_schema).toEqual(werkzeugDefs().get('plan_block')!.input_schema);
    expect(morgenWerkzeuge().map(w => w.name)).toEqual([...MORGEN_ERLAUBT]);
    const { vertragsPruefung } = await import('@/lib/werkzeuge/huelle');
    const roh = { date: '2026-10-12', startMin: 547, dauerMin: 50, titel: 'Fokus' };
    expect(vertragsPruefung('plan_block', roh).ok).toBe(false);
    const ein = morgenEingabe('plan_block', roh);
    expect(ein).toEqual({ date: '2026-10-12', startMin: 540, dauerMin: 45, titel: 'Fokus' });
    expect(vertragsPruefung('plan_block', ein).ok).toBe(true);
    expect(morgenEingabe('plan_block', { ...roh, dauerMin: 5 }).dauerMin).toBe(15);
    expect(morgenEingabe('create_task', { title: 'x', why: 'y' })).toEqual({ title: 'x', why: 'y' });
    // Und die Route nimmt genau diese Stelle (kein zweites Schema).
    const { readFileSync } = await import('node:fs');
    const t = readFileSync(new URL('../app/api/zoe/morgen/route.ts', import.meta.url), 'utf8');
    expect(t).toMatch(/morgenWerkzeuge\(\)/);
    expect(t).toMatch(/morgenEingabe\(/);
    expect(t).not.toMatch(/startMin: \{ type: 'number'/);
  });
});

// ── Werkzeug-Liste: weiterhin höchstens 20 je Zug in jeder Sicht ─────────────────────────────────────────────────────────

describe('Angebot je Sicht bleibt schlank', () => {
  it('Business und Privat: ≤ 20 Werkzeuge, an_head/head_fragen dabei', async () => {
    for (const space of ['business', 'privat']) {
      m.anfragen.length = 0;
      m.antworten.push(text('Ok.'));
      expect((await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Hallo', space, zoeFaden: 'neu' })).status).toBe(200);
      const namen = werkzeugNamen(m.anfragen[0]);
      expect(namen.length).toBeLessThanOrEqual(20);
      expect(namen).toEqual(expect.arrayContaining(['an_head', 'head_fragen']));
    }
  });
});

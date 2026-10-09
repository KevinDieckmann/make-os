// ─── ZOE schreibt nur über den Stapel (29.09., Kevin; Paket D-B #90/#91/#93/#94) ─────────────────────────
// CRM-Schreibwerkzeuge sind freigabepflichtig (auch vor jedem Fremdtext), create_task für eine andere Person ebenso,
// run_agent umgeht nurVorschlag nicht mehr, Web-Agenten nach vertraulichem Lesen nur als Vorschlag, das ZOE-Protokoll
// hält nur Kennungen + Feldnamen, übernommene Aktivitäten tragen quelle 'zoe' + freigegebenVon.
// Eigener Datenordner, erfundene Konten und Daten; das Modell ist gemockt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-stapel-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-stapel';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const runAgent = vi.fn(async () => ({ ok: true, text: 'Agent gelaufen.' }));
let antworten: unknown[] = [];
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  return {
    ...echt, hasAnthropicKey: () => true, guthabenLeer: () => false,
    askText: vi.fn(async () => { const c = antworten.shift() ?? [{ type: 'text', text: 'Fertig.' }]; const tool = (c as { type: string }[]).some(b => b.type === 'tool_use'); return { ok: true, status: 200, text: tool ? '' : 'Fertig.', stopReason: tool ? 'tool_use' : 'end_turn', raw: { content: c } }; }),
  };
});
vi.mock('@/lib/zoe/agenten', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/zoe/agenten')>()), runAgent }));
vi.mock('@/lib/brain', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-zoe-1', vorname: 'Zora', nachname: 'Probestein', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Register: Stufen', () => {
  it('CRM-Schreibwerkzeuge brauchen die Freigabe; create_task nur für andere', async () => {
    const R = await import('@/lib/zoe/register');
    for (const n of ['notiere_kontakt', 'chance_anlegen', 'uebergeben', 'setze_kunde']) expect(R.risikoVon(n), n).toBe('freigabe');
    expect(R.risikoFuerAufruf('create_task', { title: 'x' }, 'kevin')).toBe('frei');
    expect(R.risikoFuerAufruf('create_task', { title: 'x', wer: 'kevin' }, 'kevin')).toBe('frei');
    expect(R.risikoFuerAufruf('create_task', { title: 'x', wer: 'malin' }, 'kevin')).toBe('freigabe');
    expect(R.risikoFuerAufruf('create_task', { title: 'x', wer: 'both' }, 'kevin')).toBe('freigabe');
    // risikoFuer verschärft nur
    expect(R.risikoFuerAufruf('setze_ziele', {}, 'kevin')).toBe('freigabe');
  });
  it('Gesprächsschutz: Agenten nach Fremdtext nur als Vorschlag, Web-Agenten nach vertraulichem Lesen', async () => {
    const S = await import('@/lib/zoe/gespraech-schutz');
    expect(S.agentNurVorschlag('board', true, true)).toBe(false);
    expect(S.agentNurVorschlag('task', true, false)).toBe(true);
    expect(S.agentNurVorschlag('research', false, true)).toBe(true);
    expect(S.agentNurVorschlag('research', false, false)).toBe(false);
    const quelle = (n: string) => ({ crm_suche: 'markttraktion', lies_postfach: 'postfach', research: 'web' } as Record<string, string>)[n] ?? null;
    expect(S.verlaufVertraulich([{ rolle: 'zoe', text: 'x', ran: [{ agent: 'crm_suche', ok: true }] }], quelle)).toBe(true);
    expect(S.verlaufVertraulich([{ rolle: 'zoe', text: 'x', ran: [{ agent: 'research', ok: true }] }], quelle)).toBe(false);
    expect(S.verlaufVertraulich(undefined, quelle)).toBe(false);
  });
  it('Protokoll-Eingabe: nur Kennungen (Kontakt als Fingerabdruck) und Feldnamen', async () => {
    const { eingabeKurz } = await import('@/lib/zoe/protokoll');
    const k = eingabeKurz({ kontakt: 'Zora Probestein', text: 'lange Gesprächsnotiz', kontakt_id: 'c-zoe-1', betrag: 1200, dealId: 'ch-12' });
    expect(Object.keys(k).sort()).toEqual(['dealId', 'kontakt_id']);
    expect(k.kontakt_id).toMatch(/^c2?#/);
    expect(JSON.stringify(k)).not.toContain('Probestein');
  });
});

describe('notiere_kontakt geht nur über den Stapel (#90/#94)', () => {
  it('ohne Fremdtext: VORGESCHLAGEN, Kartei unverändert, Protokoll ohne Notiztext', async () => {
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const r = await fuehreAus('notiere_kontakt', { kontakt: 'c-zoe-1', art: 'anruf', text: 'Geheime Gesprächsnotiz Pelikan' }, 'http://test', { person: 'kevin' });
    expect(r.gestapelt).toBe(true);
    expect(r.text).toMatch(/VORGESCHLAGEN/);
    const k = (await db.loadJson<{ kontakte: { aktivitaeten: unknown[] }[] }>('kontakte'))!.kontakte[0];
    expect(k.aktivitaeten).toHaveLength(0);
    expect(JSON.stringify(await db.loadJson('zoe-protokoll'))).not.toContain('Pelikan');
  });
  it('Freigabe per Klick: Aktivität trägt quelle „zoe“ und freigegebenVon', async () => {
    const stapel = await import('@/lib/zoe/stapel');
    const v = (await stapel.lies('offen')).find(x => x.werkzeug === 'notiere_kontakt')!;
    const route = await import('@/app/api/zoe/stapel/route');
    const r = await route.POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ id: v.id, entscheidung: 'freigeben' }) }));
    expect(r.status).toBe(200);
    const a = (await db.loadJson<{ kontakte: { aktivitaeten: { quelle?: string; freigegebenVon?: string; von: string }[] }[] }>('kontakte'))!.kontakte[0].aktivitaeten;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ quelle: 'zoe', freigegebenVon: 'kevin', von: 'kevin' });
  });
});

describe('Gespräch: run_agent umgeht den Schutz nicht (#90/#91)', () => {
  it('Recherche nach einem CRM-Leser im Verlauf → Auftrag nur als Vorschlag, kein Lauf', async () => {
    runAgent.mockClear();
    antworten = [[{ type: 'tool_use', id: 't1', name: 'run_agent', input: { agent: 'research', auftrag: 'Suche nach Zora Probestein' } }]];
    const { POST } = await import('@/app/api/kimmi/route');
    const r = await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message: 'Recherchier mal', verlauf: [{ rolle: 'kevin', text: 'Wer ist dran?' }, { rolle: 'zoe', text: 'Zora.', ran: [{ agent: 'crm_suche', ok: true }] }] }) }));
    expect(r.status).toBe(200);
    expect(runAgent).not.toHaveBeenCalled();
    const stapel = await import('@/lib/zoe/stapel');
    expect((await stapel.lies('offen')).some(v => v.werkzeug === 'starte_auftraege' && JSON.stringify(v.eingabe).includes('research'))).toBe(true);
  });
  it('ohne vertrauliches Lesen läuft die Recherche', async () => {
    runAgent.mockClear();
    antworten = [[{ type: 'tool_use', id: 't2', name: 'run_agent', input: { agent: 'research', auftrag: 'Wetter in Hamburg' } }]];
    const { POST } = await import('@/app/api/kimmi/route');
    // Seit Paket 4a (≤ 20 Werkzeuge je Zug) gibt es run_agent nur, wenn der Zug auf Fach-Agenten zielt („recherchier …“).
    await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message: 'Recherchier, wie das Wetter wird.' }) }));
    expect(runAgent).toHaveBeenCalledTimes(1);
  });
});

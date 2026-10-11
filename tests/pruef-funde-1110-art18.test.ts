// ─── Prüf-Funde 11.10. — Art. 18 LIVE gegen die Kartei: ZOE-Entwurf (M7) und Freigabe der Inbox-Vorschläge (N8) ────────────
// Die Zuordnung im Strom bzw. ein liegender Vorschlag kann älter sein als die Einschränkung. Postfach-Spiegel und interner Aufgaben-Weg sind
// nachgebaut (kein Netz, kein Modell); die Kartei liegt in einem eigenen Datenordner mit erfundenen Personen.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-pruef-1110-art18-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-1110-art18';
delete process.env.ANTHROPIC_API_KEY;

const innenAufrufe: { pfad: string; body: Record<string, unknown> }[] = [];
vi.mock('@/lib/inbox/gespraech-server', () => ({
  gespraechLesen: async () => ({
    gespraech: { id: 'gm~1', quelle: 'gmail', zuordnung: { kontaktId: 'c-art18', name: 'Erika Erfunden' } },
    nachrichten: [{ id: 'n1', von: { email: 'erika@kunde.example.invalid' }, betreff: 'Frage', text: 'Erfundener Text' }],
    antwort: { antwortAuf: 'n1', bereichName: 'Firma' },
  }),
}));
vi.mock('@/lib/inbox/strom-server', () => ({ stromRoh: async () => ({ gespraeche: [{ id: 'gm~1' }] }) }));
vi.mock('@/lib/zoe/innen', () => ({ innen: async (pfad: string, _m: string, body: Record<string, unknown>) => { innenAufrufe.push({ pfad, body }); return { status: 200, json: { ok: true } }; } }));

const D = 'example.invalid';
let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [{ id: '1', speicher: 'pa', email: `pa@${D}`, name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', teilt: { gesundheit: [] } }], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-art18', vorname: 'Erika', nachname: 'Erfunden', email: `erika@kunde.${D}`, stufe: 'neu', importiertAm: '2026-09-01', geaendertAm: '2026-10-01', aktivitaeten: [], eingeschraenkt: { seit: '2026-10-10', grund: 'Art. 18 (Prüfung)', von: 'pa' } },
  ] });
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('M7 — ZOE-Entwurf: Art. 18 live (die Zuordnung im Strom trägt noch keine Sperre)', () => {
  it('409 vor jedem Modellaufruf', async () => {
    const { inboxEntwurf } = await import('@/lib/inbox/entwurf');
    await expect(inboxEntwurf('pa', 'gm~1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('N8 — Freigabe eines Inbox-Vorschlags: Art. 18 live gegen die Kartei', () => {
  const vorschlag = async (id: string, kontaktId: string) => {
    const { lege } = await import('@/lib/zoe/stapel');
    return lege({
      werkzeug: 'inbox_aufgabe', gruppe: 'inbox', titel: 'Aufgabe aus der Inbox — eine Frage an dich', nachher: 'Aufgabe aus einer Nachricht — Einzelheiten in der Inbox',
      eingabe: { gespraech: 'gm~1', space: 'business', aufgabe: { title: 'Frage beantworten', description: 'Aus der Inbox', priority: 'medium', space: 'business', bezug: { kontaktId, firmaId: 'f-a' } } },
      person: 'pa', quelle: 'lauf', bezug: { art: 'inbox', id },
    });
  };
  it('eingeschränkte Person → 409, nichts angelegt; Person nicht mehr da → ohne Personen-Bezug angelegt', async () => {
    const { INBOX_STAPEL_ART } = await import('@/lib/inbox/aufgaben-vorschlag-server');
    const a = await vorschlag('m-art18', 'c-art18');
    expect(await INBOX_STAPEL_ART.freigeben(a, 'pa', {})).toMatchObject({ ok: false, status: 409 });
    expect(innenAufrufe).toHaveLength(0);
    const b = await vorschlag('m-weg', 'c-gibt-es-nicht');
    expect(await INBOX_STAPEL_ART.freigeben(b, 'pa', {})).toMatchObject({ ok: true });
    expect(innenAufrufe).toHaveLength(1);
    expect(innenAufrufe[0].body.bezug).toEqual({ firmaId: 'f-a' });
  });
});

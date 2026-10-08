// ─── Familie: Konto gelöscht → Einträge bleiben ohne Namen, „nur ich“ fällt weg (08.10. abends, Fragebogen Teil 3 Frage 11) ───────
// Erfundene Daten, Temp-Ordner. Wächter: nach `kontoLoeschen` steht der Speichername der Person nirgends mehr im Familien-Bestand
// und nicht im Protokoll; die gemeinsamen Inhalte (Date, Vereinbarung, Thema, Wunsch, Gespräch, geteilte Reflexion, Vision) bleiben;
// ihre „nur ich“-Einträge, ungeteilten Reflexionen und ihr Profil sind weg; die andere Person darf die verbliebenen Einträge ändern.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { familieOhnePerson } from '@/lib/familie/ohne-person';
import type { Familie } from '@/lib/familie/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-familie-ohne-person-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-familie-ohne-person';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const AM = '2026-09-01T08:00:00.000Z';
const B = 'person-b';

function bestand(start: Familie): Familie {
  return {
    ...start,
    dates: [
      { id: 'd-1', von: B, am: AM, titel: 'Abendessen (Beispiel)', ideeId: null, datum: '2026-10-20', planer: B, status: 'geplant', neuesErlebnis: false, nachklang: [{ von: B, text: 'Schön war es' }, { von: 'person-a', text: 'Gern wieder' }] },
    ],
    vereinbarungen: [
      { id: 'v-1', von: 'person-a', am: AM, text: 'Fahrrad reparieren (Beispiel)', wer: B, faellig: null, status: 'offen' },
      { id: 'v-2', von: 'person-a', am: AM, text: 'Gemeinsam einkaufen', wer: 'beide', faellig: null, status: 'offen' },
    ],
    themen: [
      { id: 't-gemeinsam', von: B, am: AM, titel: 'Urlaub planen (Beispiel)', art: 'loesbar', status: 'offen', hut: 'privat' },
      { id: 't-nurich', von: B, am: AM, titel: 'Eigenes Thema (Beispiel)', art: 'unklar', status: 'offen', hut: 'privat', sichtbarkeit: 'nur-ich' },
      { id: 't-a-nurich', von: 'person-a', am: AM, titel: 'Thema von A (Beispiel)', art: 'unklar', status: 'offen', hut: 'privat', sichtbarkeit: 'nur-ich' },
    ],
    wuensche: [{ id: 'w-1', von: B, am: AM, text: 'Mehr Ausflüge (Beispiel)', kategorie: 'erlebnis', status: 'offen' }],
    wertschaetzungen: [{ id: 'ws-1', von: 'person-a', am: AM, an: B, text: 'Danke für gestern', datum: '2026-09-30' }],
    gespraeche: [{ id: 'g-1', von: 'person-a', am: AM, datum: '2026-09-28', status: 'gehalten', wertschaetzungen: [{ von: B, text: 'Danke' }], lief_gut: [], orga: [], themenIds: [], wuensche: [{ von: B, text: 'Ruhiger Sonntag' }], schoeneZeit: '', businessGrenzeGehalten: true, notiz: '' }],
    lovemap: [{ id: 'lm-1', von: B, am: AM, frageId: 'f-1', person: B, antwort: 'Antwort (Beispiel)' }],
    reparaturen: [{ id: 'r-1', von: 'person-a', am: AM, datum: '2026-09-20', pauseBis: null, abgeschlossen: null, vereinbarung: '', reflexionen: [
      { person: B, gefuehle: 'geteilt (Beispiel)', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: true },
      { person: 'person-a', gefuehle: 'von A (Beispiel)', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: false },
    ] }, { id: 'r-2', von: B, am: AM, datum: '2026-09-21', pauseBis: null, abgeschlossen: null, vereinbarung: '', reflexionen: [
      { person: B, gefuehle: 'ungeteilt (Beispiel)', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: false },
    ] }],
    tage: [{ id: 'tg-1', von: B, am: AM, titel: 'Jahrestag (Beispiel)', art: 'jahrestag', datum: '06-21', vorlaufTage: 7, wer: B, aktion: 'feier', erledigt: [] }],
    profile: [{ person: B, stress: 'Profil von B (Beispiel)', traeume: '', wasMirGuttut: '', stand: AM }, { person: 'person-a', stress: 'Profil von A', traeume: '', wasMirGuttut: '', stand: AM }],
    visionen: [{ jahr: 2026, leitbild: 'Gemeinsam', ziele: [{ id: 'z-b', text: 'Ziel von B (Beispiel)', erreicht: false, von: B }], traeume: [{ person: B, text: 'Traum von B (Beispiel)' }] }],
  };
}

describe('familieOhnePerson (rein)', () => {
  it('Namen getilgt, Inhalte bleiben; „nur ich“, ungeteilte Reflexion und Profil der Person fallen weg', async () => {
    const { startBestand } = await import('@/lib/familie/speicher');
    const f = bestand(startBestand(AM));
    const r = familieOhnePerson(f, B);
    expect(JSON.stringify(r.familie)).not.toContain(B);
    expect(r.familie.dates[0]).toMatchObject({ von: '', planer: '', titel: 'Abendessen (Beispiel)' });
    expect(r.familie.dates[0].nachklang).toEqual([{ von: '', text: 'Schön war es' }, { von: 'person-a', text: 'Gern wieder' }]);
    expect(r.familie.vereinbarungen.map(v => v.wer)).toEqual(['', 'beide']);
    expect(r.familie.themen.map(t => t.id)).toEqual(['t-gemeinsam', 't-a-nurich']);
    expect(r.familie.themen[0].von).toBe('');
    expect(r.familie.wertschaetzungen[0].an).toBe('');
    expect(r.familie.gespraeche[0].wertschaetzungen[0].von).toBe('');
    expect(r.familie.lovemap[0]).toMatchObject({ person: '', antwort: 'Antwort (Beispiel)' });
    expect(r.familie.reparaturen[0].reflexionen.map(x => x.gefuehle)).toEqual(['geteilt (Beispiel)', 'von A (Beispiel)']);
    expect(r.familie.reparaturen[1].reflexionen).toEqual([]);
    expect(r.familie.tage[0].wer).toBe('');
    expect(r.familie.profile.map(p => p.person)).toEqual(['person-a']);
    expect(r.familie.visionen[0].traeume).toEqual([{ person: '', text: 'Traum von B (Beispiel)' }]);
    // Protokoll-Änderungen: nur Liste, Kennung, Feldnamen.
    expect(JSON.stringify(r.aenderungen)).not.toContain('Beispiel');
    expect(r.aenderungen).toContainEqual({ liste: 'themen', op: 'geloescht', id: 't-nurich' });
    expect(r.aenderungen).toContainEqual({ liste: 'dates', op: 'geaendert', id: 'd-1', felder: ['von', 'planer', 'nachklang'] });
  });

  it('nichts zu tun → derselbe Bestand', async () => {
    const { startBestand } = await import('@/lib/familie/speicher');
    const f = startBestand(AM);
    const r = familieOhnePerson(f, 'niemand');
    expect(r.anzahl).toBe(0);
    expect(r.familie).toBe(f);
  });
});

describe('kontoLoeschen: Familie des Haushalts', () => {
  type H = (r: Request) => Promise<Response>;
  let db: typeof import('@/lib/store/local-db');
  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    const k = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-f' });
    await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber'), k('k2', B, 'mitglied')], einladungen: [] });
    const { startBestand } = await import('@/lib/familie/speicher');
    await db.saveJson('familie--haus-f', bestand(startBestand(AM)));
  });

  it('nach dem Löschen: kein Name mehr im Bestand und im Protokoll, Inhalte da, die andere Person ändert sie', async () => {
    const kd = await import('@/lib/datenschutz/konto-daten');
    const bericht = await kd.kontoLoeschen(B, { grabstein: false });
    expect(bericht?.eintraege['familie--haus-f']).toBeGreaterThan(5);
    const f = (await db.loadJson<Familie>('familie--haus-f'))!;
    expect(JSON.stringify(f)).not.toContain(B);
    expect(f.dates[0].titel).toBe('Abendessen (Beispiel)');
    expect(f.themen.some(t => t.id === 't-nurich')).toBe(false);
    const protokoll = readdirSync(ordner).filter(n => n.startsWith('aenderungsprotokoll--')).map(n => readFileSync(path.join(ordner, n), 'utf8')).join('\n');
    expect(protokoll).toContain('familie--haus-f');
    expect(protokoll).not.toContain('Beispiel');
    // Die andere Person ändert das Thema der gelöschten Person (ohne Anlegerin = frei).
    const route = (await import('@/app/api/familie/route')) as unknown as { PATCH: H };
    const r = await route.PATCH(new Request('http://test/api/familie', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' },
      body: JSON.stringify({ ops: [{ liste: 'themen', op: 'upsert', eintrag: { ...f.themen[0], status: 'besprochen' } }] }) }));
    expect(r.status).toBe(200);
    expect(((await db.loadJson<Familie>('familie--haus-f'))!).themen[0].status).toBe('besprochen');
    // Zweiter Lauf: nichts mehr zu tun.
    expect(await kd.kontoLoeschen(B, { grabstein: false })).toBeNull();
  });
});

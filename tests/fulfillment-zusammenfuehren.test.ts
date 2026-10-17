// ─── Gesamtprüfung 18.10. (L3 A2): Dubletten zusammenführen biegt die Fulfillment-Kennungen um ─────────────────────────────────────
// Vorher erreichte nur der Kennungs-Umzug die Fulfillment-Bestände: nach dem Zusammenführen (A in B) zeigten Stakeholder und Personenkarten
// weiter auf A — Art. 15 für B nannte sie nicht, Art. 17 für B ließ Rolle, Haltung und Notiz stehen. Jetzt zieht `personUmbiegen` sie mit
// (wie `kalender-bezug`), steht B im selben Fall schon, bleibt EIN Eintrag. Eigener Datenordner, erfundene Personen (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-zusammen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-zusammen';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const H = 'h-ffz';
const B = { id: 'c-behalten', vorname: 'Berta', nachname: 'Prüfling', email: 'berta@example.invalid' };
const fall = (mandatId: string, stakeholder: Record<string, unknown>[]) => ({ mandatId, vorlageId: 'fv-1', gestartetAm: '2026-10-01', status: 'laeuft', stakeholder });
const karte = (id: string, kontaktId: string) => ({
  id, mandatId: 'm-1', funktion: 'Vertriebsleitung', name: 'Erfundene Person', kontaktId, erfasstAm: '2026-10-02', identitaet: 'hoch', status: 'geprueft',
  art14: { faelligAm: '2026-11-02' }, werdegang: [], themen: [], auftritte: [], aufhaenger: [], ausgelassen: [], quellen: [],
});

let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [{ id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H }], einladungen: [] });
  // Die Kartei NACH dem Zusammenführen (A ist schon weg — die Dubletten-Route führt die Einträge zusammen, `personUmbiegen` die Verweise).
  await db.saveJson('kontakte', { kontakte: [{ ...B, stufe: 'kontakt', aktivitaeten: [] }] });
  await db.saveJson(`fulfillment-faelle--${H}`, { version: 1, faelle: {
    'm-1': fall('m-1', [{ id: 'fs-1', kontaktId: 'c-weg', rolle: 'entscheider', einfluss: 3, haltung: 'kritisch', notiz: 'erfundene Notiz A' }, { id: 'fs-2', kontaktId: 'c-andere', rolle: 'nutzer', einfluss: 1 }]),
    // B steht im zweiten Fall schon — danach bleibt EIN Eintrag (Angaben von B gewinnen, die leere Notiz füllt A).
    'm-2': fall('m-2', [{ id: 'fs-3', kontaktId: 'c-weg', rolle: 'skeptiker', einfluss: 2, notiz: 'erfundene Notiz Zwei' }, { id: 'fs-4', kontaktId: 'c-behalten', rolle: 'sponsor', einfluss: 3, haltung: 'positiv' }]),
  } });
  await db.saveJson(`fulfillment-personen--${H}`, { version: 1, karten: [karte('pp-1', 'c-weg'), karte('pp-2', 'c-andere')] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('A2: Zusammenführen → Stakeholder und Personenkarte zeigen auf die behaltene Person', () => {
  it('rein: zwei Einträge derselben Person im Fall werden einer (sonst sperrte fall.ts jede Änderung mit 409)', async () => {
    const { faelleUmbiegen } = await import('@/lib/fulfillment/umbiegen');
    const d = { version: 1, faelle: { 'm-2': fall('m-2', [{ id: 'fs-3', kontaktId: 'c-weg', rolle: 'skeptiker', einfluss: 2, notiz: 'n' }, { id: 'fs-4', kontaktId: 'c-behalten', rolle: 'sponsor', einfluss: 3 }]) } } as unknown as Parameters<typeof faelleUmbiegen>[0];
    const r = faelleUmbiegen(d, new Map([['c-weg', 'c-behalten']]));
    expect(r.n).toBe(1);
    expect(r.datei.faelle['m-2'].stakeholder).toEqual([{ id: 'fs-4', kontaktId: 'c-behalten', rolle: 'sponsor', einfluss: 3, notiz: 'n' }]);
    expect(faelleUmbiegen(r.datei, new Map([['c-weg', 'c-behalten']])).n).toBe(0);
  });

  it('personUmbiegen zieht Fälle und Karten mit; Art. 15 für B findet beides', async () => {
    const { personUmbiegen, personAufzaehlen } = await import('@/lib/crm/person-bestaende');
    const bericht = await personUmbiegen('c-weg', 'c-behalten');
    expect(bericht.speicher[`fulfillment-faelle--${H}`]).toBe(2);
    expect(bericht.speicher[`fulfillment-personen--${H}`]).toBe(1);
    const f = await db.loadJson<{ faelle: Record<string, { stakeholder: { id: string; kontaktId: string; notiz?: string }[] }> }>(`fulfillment-faelle--${H}`);
    expect(f!.faelle['m-1'].stakeholder.map(s => s.kontaktId)).toEqual(['c-behalten', 'c-andere']);
    expect(f!.faelle['m-2'].stakeholder).toHaveLength(1);
    expect(f!.faelle['m-2'].stakeholder[0]).toMatchObject({ id: 'fs-4', kontaktId: 'c-behalten', notiz: 'erfundene Notiz Zwei' });
    const p = await db.loadJson<{ karten: { id: string; kontaktId?: string }[] }>(`fulfillment-personen--${H}`);
    expect(p!.karten.map(k => k.kontaktId)).toEqual(['c-behalten', 'c-andere']);

    const { fulfillmentAuskunft } = await import('@/lib/fulfillment/auskunft');
    const { merkmaleVon } = await import('@/lib/crm/person-weitere');
    const a = await fulfillmentAuskunft(merkmaleVon(B.id, B));
    expect(a.stakeholder.map(s => s.mandatId).sort()).toEqual(['m-1', 'm-2']);
    expect(a.stakeholder.find(s => s.mandatId === 'm-1')).toMatchObject({ rolle: 'entscheider', haltung: 'kritisch', notiz: 'erfundene Notiz A' });
    expect(a.personen.map(k => k.mandatId)).toEqual(['m-1']);
    // Der Weg der Auskunft (Art. 15, `personAufzaehlen`) liefert dasselbe.
    const ganz = await personAufzaehlen(B.id);
    expect(ganz.fulfillment?.stakeholder.map(s => s.mandatId).sort()).toEqual(['m-1', 'm-2']);
    expect(ganz.fulfillment?.personen.map(k => k.mandatId)).toEqual(['m-1']);
  });

  it('zweiter Lauf ändert nichts (idempotent — die Absicht darf wiederholen)', async () => {
    const { personUmbiegen } = await import('@/lib/crm/person-bestaende');
    const vorher = JSON.stringify([await db.loadJson(`fulfillment-faelle--${H}`), await db.loadJson(`fulfillment-personen--${H}`)]);
    const r = await personUmbiegen('c-weg', 'c-behalten');
    expect(r.speicher[`fulfillment-faelle--${H}`]).toBeUndefined();
    expect(JSON.stringify([await db.loadJson(`fulfillment-faelle--${H}`), await db.loadJson(`fulfillment-personen--${H}`)])).toBe(vorher);
  });

  it('Art. 17 für B tilgt Stakeholder-Kennung samt Notiz und nimmt die Karte heraus; andere bleiben', async () => {
    const { weitereEntfernen, merkmaleVon } = await import('@/lib/crm/person-weitere');
    const r = await weitereEntfernen(merkmaleVon(B.id, B));
    expect(r.fehler).toEqual([]);
    const f = await db.loadJson<{ faelle: Record<string, { stakeholder: { kontaktId: string; notiz?: string }[] }> }>(`fulfillment-faelle--${H}`);
    const alle = Object.values(f!.faelle).flatMap(x => x.stakeholder);
    expect(alle.some(s => s.kontaktId === 'c-behalten' || s.kontaktId === 'c-weg')).toBe(false);
    expect(JSON.stringify(f)).not.toContain('erfundene Notiz');
    expect(alle.some(s => s.kontaktId === 'c-andere')).toBe(true);
    const p = await db.loadJson<{ karten: { id: string }[] }>(`fulfillment-personen--${H}`);
    expect(p!.karten.map(k => k.id)).toEqual(['pp-2']);
  });
});

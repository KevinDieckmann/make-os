// ─── Gesamtprüfung 18.10. (L3 B5): Löschfristen ohne Leer-Schutz bei Dossiers, Personenkarten und Kunden-Daten ──────────────────────────────
// Vorher: fehlte ein Mandat im CRM, fielen Personenkarten, das ganze Dossier und die Kunden-Daten (Antworten, Puls, Unterlagen samt Dateien) SOFORT
// weg — eine unvollständige Mandatsliste nach Rücksicherung oder Umzug hätte sie ohne Archiv gelöscht. Jetzt: Marke `mandat-fehlt:<m>`, erst nach
// 30 Tagen weg, Marke fällt, wenn das Mandat zurückkommt; ohne Mandate oder bei zu vielen auf einmal bremst der Lauf.
// Eigener Datenordner, erfundene Daten (@example.invalid).
import { describe, it, expect, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const p = await import('node:path');
  const o = mkdtempSync(p.join(tmpdir(), 'make-os-ff-mandat-fehlt-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ff-mandat-fehlt', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return o;
});

import type { PersonenKarte } from '@/lib/fulfillment/typen';
import { fehlendeMandatePlanen, markeMandatFehlt, markenOhneBezug, FEHLT_TAGE } from '@/lib/fulfillment/mandat-fehlt';
import { tagPlus } from '@/lib/kalender/zeit';

afterAll(() => rmSync(ordner, { recursive: true, force: true }));
const FRISTEN = { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 };
const HEUTE = '2026-10-18';

describe('rein: fehlendeMandatePlanen', () => {
  const ids = (...x: string[]) => new Set(x);
  it('erst markieren, nach 30 Tagen weg; zurück → Marke fällt', () => {
    const a = fehlendeMandatePlanen({ betroffen: ids('m-a', 'm-b'), bekannt: ids('m-b'), marken: {}, heute: HEUTE });
    expect(a).toMatchObject({ gebremst: null, neu: { [markeMandatFehlt('m-a')]: HEUTE } });
    expect(a.weg.size).toBe(0);
    const b = fehlendeMandatePlanen({ betroffen: ids('m-a', 'm-b'), bekannt: ids('m-b'), marken: { [markeMandatFehlt('m-a')]: tagPlus(HEUTE, -(FEHLT_TAGE - 1)) }, heute: HEUTE });
    expect(b.weg.size).toBe(0);
    const c = fehlendeMandatePlanen({ betroffen: ids('m-a', 'm-b'), bekannt: ids('m-b'), marken: { [markeMandatFehlt('m-a')]: tagPlus(HEUTE, -FEHLT_TAGE) }, heute: HEUTE });
    expect([...c.weg]).toEqual(['m-a']);
    const d = fehlendeMandatePlanen({ betroffen: ids('m-a'), bekannt: ids('m-a'), marken: { [markeMandatFehlt('m-a')]: '2026-01-01' }, heute: HEUTE });
    expect(d.aus).toEqual([markeMandatFehlt('m-a')]);
    expect(d.weg.size).toBe(0);
  });
  it('Bremsen: kein Mandat im CRM → nichts; mehr als die Hälfte (und > 3) auf einmal → nichts', () => {
    expect(fehlendeMandatePlanen({ betroffen: ids('m-a'), bekannt: ids(), marken: { [markeMandatFehlt('m-a')]: '2026-01-01' }, heute: HEUTE })).toMatchObject({ gebremst: 'keine-mandate', neu: {} });
    const alt = Object.fromEntries(['m-1', 'm-2', 'm-3', 'm-4'].map(m => [markeMandatFehlt(m), '2026-01-01']));
    const z = fehlendeMandatePlanen({ betroffen: ids('m-1', 'm-2', 'm-3', 'm-4', 'm-ok'), bekannt: ids('m-ok'), marken: alt, heute: HEUTE });
    expect(z.gebremst).toBe('zu-viele');
    expect(z.weg.size).toBe(0);
  });
  it('markenOhneBezug: nur Marken, deren Mandat kein Bestand mehr nennt', () => {
    expect(markenOhneBezug({ [markeMandatFehlt('m-a')]: HEUTE, [markeMandatFehlt('m-b')]: HEUTE, andere: 'x' }, new Set(['m-a']))).toEqual([markeMandatFehlt('m-b')]);
  });
});

describe('Server: Karten, Dossiers und Kunden-Daten eines fehlenden Mandats bleiben 30 Tage', () => {
  const karte = (id: string, mandatId: string): PersonenKarte => ({ id, mandatId, funktion: 'Leitung', name: 'Erfundene Person', werdegang: [], themen: [], auftritte: [], aufhaenger: [], identitaet: 'hoch', ausgelassen: [], quellen: [], art14: { faelligAm: '2026-11-01' }, erfasstAm: '2026-10-01', status: 'entwurf' });
  const dossier = (mandatId: string) => ({ mandatId, eingaben: { firma: 'Erfundene GmbH' }, abschnitte: {}, laeufe: [], quellen: [], massnahmen: [], geaendert: '2026-10-01T00:00:00Z', geaendertVon: 'pia' });
  it('Tag 0: markiert, nichts weg; Tag 30: weg; die Marke verschwindet, wenn nichts mehr das Mandat nennt', async () => {
    const db = await import('@/lib/store/local-db');
    const { leererBestand } = await import('@/lib/crm/speicher');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-mf' }], einladungen: [] });
    // Das CRM kennt nur ein anderes Mandat (m-da) — m-weg fehlt (z. B. nach einer unvollständigen Rücksicherung).
    await db.saveJson('crm', { ...leererBestand(), mandate: [{ id: 'm-da', kunde: 'Erfundene AG', status: 'aktiv', start: '2026-01-01' }] });
    const sp = await import('@/lib/fulfillment/speicher');
    const h = await sp.fulfillmentHaushalt();
    await db.saveJson(sp.fulfillmentSpeicherFuer('personen', h), { version: 1, karten: [karte('pp-1', 'm-weg'), karte('pp-2', 'm-da')] });
    await db.saveJson(sp.fulfillmentSpeicherFuer('dossiers', h), { version: 1, dossiers: { 'm-weg': dossier('m-weg') } });
    await db.saveJson(sp.fulfillmentSpeicherFuer('kunde', h), { version: 1, links: [], formulare: [{ mandatId: 'm-weg', bausteinId: 'pb-1', fassung: 1, antworten: { f1: 'erfundene Antwort' }, fertig: [], geaendertAm: '2026-10-01T00:00:00Z', quelle: 'kunde' }], pulsAnfragen: [], puls: [], unterlagen: [] });
    const { fulfillmentFristen } = await import('@/lib/fulfillment/fristen-server');
    const z0 = await fulfillmentFristen({ heute: HEUTE, jetzt: new Date(`${HEUTE}T05:00:00Z`), fristen: FRISTEN });
    expect(z0['fulfillment-personen'] ?? 0).toBe(0);
    expect(z0['fulfillment-dossiers'] ?? 0).toBe(0);
    expect((await sp.fulfillmentLesen('personen', h)).karten.map(k => k.id)).toEqual(['pp-1', 'pp-2']);
    expect(Object.keys((await sp.fulfillmentLesen('dossiers', h)).dossiers)).toEqual(['m-weg']);
    expect((await sp.fulfillmentLesen('kunde', h)).formulare).toHaveLength(1);
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[markeMandatFehlt('m-weg')]).toBe(HEUTE);
    // Tag 29: noch alles da (die Marke bleibt beim ersten Tag).
    const t29 = tagPlus(HEUTE, FEHLT_TAGE - 1);
    await fulfillmentFristen({ heute: t29, jetzt: new Date(`${t29}T05:00:00Z`), fristen: FRISTEN });
    expect((await sp.fulfillmentLesen('personen', h)).karten).toHaveLength(2);
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[markeMandatFehlt('m-weg')]).toBe(HEUTE);
    // Tag 30: weg — Karte, Dossier, Antworten; die Karte des bekannten Mandats bleibt; die Marke fällt (nichts nennt das Mandat mehr).
    const t30 = tagPlus(HEUTE, FEHLT_TAGE);
    const z30 = await fulfillmentFristen({ heute: t30, jetzt: new Date(`${t30}T05:00:00Z`), fristen: FRISTEN });
    expect(z30['fulfillment-personen']).toBe(1);
    expect(z30['fulfillment-dossiers']).toBe(1);
    expect((await sp.fulfillmentLesen('personen', h)).karten.map(k => k.id)).toEqual(['pp-2']);
    expect((await sp.fulfillmentLesen('dossiers', h)).dossiers).toEqual({});
    expect((await sp.fulfillmentLesen('kunde', h)).formulare).toHaveLength(0);
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[markeMandatFehlt('m-weg')]).toBeUndefined();
  });
  it('kommt das Mandat zurück, fällt die Marke und nichts wird gelöscht', async () => {
    const db = await import('@/lib/store/local-db');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const sp = await import('@/lib/fulfillment/speicher');
    const h = await sp.fulfillmentHaushalt();
    await db.saveJson(sp.fulfillmentSpeicherFuer('personen', h), { version: 1, karten: [karte('pp-3', 'm-zurueck'), karte('pp-4', 'm-da')] });
    await db.saveJson('crm', { ...leererBestand(), mandate: [{ id: 'm-da', kunde: 'Erfundene AG', status: 'aktiv', start: '2026-01-01' }] });
    const { fulfillmentFristen } = await import('@/lib/fulfillment/fristen-server');
    await fulfillmentFristen({ heute: HEUTE, jetzt: new Date(`${HEUTE}T05:00:00Z`), fristen: FRISTEN });
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[markeMandatFehlt('m-zurueck')]).toBe(HEUTE);
    await db.saveJson('crm', { ...leererBestand(), mandate: [{ id: 'm-da', kunde: 'Erfundene AG', status: 'aktiv', start: '2026-01-01' }, { id: 'm-zurueck', kunde: 'Erfundene KG', status: 'aktiv', start: '2026-01-01' }] });
    const t40 = tagPlus(HEUTE, 40);
    await fulfillmentFristen({ heute: t40, jetzt: new Date(`${t40}T05:00:00Z`), fristen: FRISTEN });
    expect((await sp.fulfillmentLesen('personen', h)).karten.map(k => k.id)).toEqual(['pp-3', 'pp-4']);
    expect((await sp.fulfillmentLesen('vorlagen', h)).marken[markeMandatFehlt('m-zurueck')]).toBeUndefined();
  });
});

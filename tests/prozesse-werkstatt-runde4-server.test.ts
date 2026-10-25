// ─── Prozesse · Werkstatt — Runde 4, Server (25.10., dritter Bau-Test im Demo) ──────────────────────────────────────────────────────────────────────────────
// (7) Probelauf „Echtes Mandat“: die Verweise tragen mit `?fall=1` das Merkmal zum passenden Wählen — Mandat: Produkt, Deal: Stufe, Lead: Status (nur Namen).
// Ohne den Parameter bleibt die Antwort, wie sie war; eingeschränkte Personen (Art. 18) fehlen; ein fremder Haushalt bekommt nichts (403).
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten, kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import { fallTreffer } from '@/lib/prozesse/laeufe-ansicht';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-runde4-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-runde4';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-runde4';
const J = '2026-10-01T08:00:00.000Z';
const sitzung = (person: string) => ({ 'x-make-user': person });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'gast', 'mitglied', { haushalt: 'anderer-haus' })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id.slice(2), email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna', { firmaId: 'f-nord', firma: 'Nordprobe GmbH' }),
    k('c-solo'),
    k('c-gesperrt', { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const mandat = (id: string, leistungId: string) => ({
    id, kunde: 'Nordprobe GmbH', firmaId: 'f-nord', kontaktIds: ['c-anna'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft: 'ug', status: 'aktiv',
    vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
    rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
    leistungen: [], offen: [], geaendert: J,
  });
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [{ id: 'f-nord', name: 'Nordprobe GmbH', lead: { status: 'qualifizierung', kriterien: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, geaendert: J }],
    leistungen: [
      { id: 'l-diagnose', name: 'Klarheits-Diagnose', typ: 'projekt', status: 'aktiv', lieferumfang: [], geaendert: J },
      { id: 'l-cockpit', name: 'Cockpit-Lizenz', typ: 'retainer', status: 'aktiv', lieferumfang: [], geaendert: J },
    ],
    mandate: [mandat('m-eins', 'l-diagnose'), mandat('m-zwei', 'l-cockpit')],
    chancen: [{ id: 'ch-eins', titel: 'Deal eins', kontaktIds: ['c-anna'], firmaId: 'f-nord', stufe: 'angebot', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01' }],
  });
}, 60_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

const hole = async (suche: string, kopf: Record<string, string>) => {
  const { GET } = await import('@/app/api/aufgaben/crm/route');
  const r = await GET(new Request(`http://localhost/api/aufgaben/crm${suche}`, { headers: kopf }));
  return { status: r.status, j: await r.json() as CrmVerweise };
};

describe('(7) „Echtes Mandat“: Merkmal je Fall (Produkt, Stufe, Status)', () => {
  it('mit ?fall=1: Mandat trägt das Produkt, Deal die Stufe, Lead den Status — die Auswahl zeigt „Mandat · Produkt“', async () => {
    const { status, j } = await hole('?fall=1', sitzung('pia'));
    expect(status).toBe(200);
    expect(j.mandate.find(m => m.id === 'm-eins')?.produkt).toBe('Klarheits-Diagnose');
    expect(j.mandate.find(m => m.id === 'm-zwei')?.produkt).toBe('Cockpit-Lizenz');
    expect(j.deals.find(d => d.id === 'ch-eins')?.stufeName).toBeTruthy();
    expect(j.firmen.find(f => f.id === 'f-nord')?.leadStatus).toBe('Qualifizierung');
    expect(j.kontakte.some(k => k.id === 'c-gesperrt')).toBe(false);
    const t = fallTreffer(j, 'mandat', '');
    expect(t.map(x => [x.name, x.merkmal])).toEqual([['Mandat m-eins', 'Klarheits-Diagnose'], ['Mandat m-zwei', 'Cockpit-Lizenz']]);
    // Gesucht wird auch über das Merkmal.
    expect(fallTreffer(j, 'mandat', 'cockpit').map(x => x.id)).toEqual(['m-zwei']);
    expect(fallTreffer(j, 'deal', '')[0].merkmal).toBe(j.deals[0].stufeName);
    expect(fallTreffer(j, 'lead', 'nordprobe').find(x => x.id === 'f-nord')?.merkmal).toBe('Qualifizierung');
  });
  it('ohne ?fall=1 bleibt die Antwort wie bisher (nur Kennung und Name); fremder Haushalt → 403', async () => {
    const { j } = await hole('', sitzung('pia'));
    expect(j.mandate.every(m => m.produkt === undefined)).toBe(true);
    expect(j.deals.every(d => d.stufeName === undefined)).toBe(true);
    expect(j.firmen.every(f => f.leadStatus === undefined)).toBe(true);
    expect((await hole('?fall=1', sitzung('gast'))).status).toBe(403);
  });
});

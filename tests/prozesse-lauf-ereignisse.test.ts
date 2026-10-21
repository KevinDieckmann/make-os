// ─── Prozesse C1 · neue Ereignisse aus VORHANDENEN Schreibwegen (21.10.; E1, E4, E8, E9, Punkt 33) — die reinen Teile ───────────────────────────────
// Mandat angelegt/beendet (CRM-Diff), Termin vorbei (Kalender-Spiegel mit Bezug), Fall-Schritt erledigt und Ziel erreicht (Fulfillment-Fall). Jedes
// Ereignis trägt Bereich und nur Kennungen; dieselbe Lage ergibt dieselbe Kennung (kein Doppel); die Selbstständigkeit gehört zu Privat (startet nie
// einen Prozess). Herkunft (Schleifenschutz) setzt nur die Ereignisstelle aus dem Zusammenhang des Laufs — nie die Quelle.
import { describe, it, expect } from 'vitest';
import { crmDiff, terminVorbeiAus, fallDiff } from '@/lib/ereignisse/quellen';
import { EREIGNISSE_ANGEBUNDEN } from '@/lib/ereignisse/arten';
import { eingabeSauber, HERKUNFT } from '@/lib/ereignisse/typen';
import { istEreignisArt } from '@/lib/ereignisse/arten';
import { herkunftAus, laufHerkunftText, mitLaufHerkunft } from '@/lib/prozesse/lauf-herkunft';
import type { CrmBestand } from '@/lib/crm/typen';

const m = (id: string, x: Record<string, unknown> = {}) => ({ id, titel: 'Probe', kunde: 'Probe GmbH', status: 'aktiv', gesellschaft: 'ug', kontaktIds: ['c-1'], firmaId: 'f-1', ...x });
const crm = (mandate: unknown[]): Pick<CrmBestand, 'chancen' | 'firmen' | 'mandate'> => ({ chancen: [], firmen: [], mandate: mandate as CrmBestand['mandate'] });

describe('Mandat angelegt / beendet (E4) aus dem CRM-Diff', () => {
  it('neu → mandat-angelegt; neu „beendet“ → mandat-beendet; Bezug nur Kennungen; dieselbe Lage → dieselbe Kennung', () => {
    const a = crmDiff(crm([]), crm([m('ma-1')]));
    expect(a).toEqual([expect.objectContaining({ art: 'mandat-angelegt', quelle: 'crm', bereich: 'business', bezug: { mandatId: 'ma-1', firmaId: 'f-1', kontaktId: 'c-1' } })]);
    expect(crmDiff(crm([]), crm([m('ma-1')]))[0].id).toBe(a[0].id);
    const b = crmDiff(crm([m('ma-1')]), crm([m('ma-1', { status: 'beendet', ende: '2026-12-31' })]));
    expect(b.map(e => e.art)).toEqual(['mandat-beendet']);
    expect(crmDiff(crm([m('ma-1', { status: 'beendet' })]), crm([m('ma-1', { status: 'beendet' })]))).toEqual([]);
  });
  it('die Selbstständigkeit gehört zu Privat — ihr Mandat meldet „privat“ (startet nie einen Prozess)', () => {
    expect(crmDiff(crm([]), crm([m('ma-2', { gesellschaft: 'kdc' })]))[0].bereich).toBe('privat');
  });
  it('ohne Mandate in einem der Stände (älterer Schreiber) nichts — nie ein Schein-„angelegt“ für den ganzen Bestand', () => {
    expect(crmDiff({ chancen: [], firmen: [] }, crm([m('ma-1')]))).toEqual([]);
    expect(crmDiff(crm([]), crm([m('ma-3', { geloeschtAm: '2026-10-01' })]))).toEqual([]);
  });
});

describe('Termin vorbei (E1) aus dem Kalender-Spiegel', () => {
  const ende = (w: string) => Date.parse(`${w}Z`);
  const jetzt = new Date('2026-10-22T12:00:00.000Z');
  const t = (x: Record<string, unknown>) => ({ id: 'kal|uid-1', ende: '2026-10-22T11:00:00', kontaktIds: ['c-1'], ...x });
  it('vorbei (≤ 72 h) mit Bezug → termin-vorbei mit Termin-Kennung und Kontakt; Person nur, wer angelegt hat', () => {
    const l = terminVorbeiAus([t({ dealId: 'ch-1', von: 'pia' })], jetzt, ende);
    expect(l).toEqual([expect.objectContaining({ art: 'termin-vorbei', bereich: 'business', person: 'pia', bezug: { terminUid: 'kal|uid-1', kontaktId: 'c-1', dealId: 'ch-1' } })]);
  });
  it('nie: abgesagt, ganztägig, ohne Kontakt, noch nicht vorbei, zu alt; privat → Bereich privat', () => {
    expect(terminVorbeiAus([t({ abgesagt: true }), t({ ganztags: true }), t({ kontaktIds: [] }), t({ ende: '2026-10-22T13:00:00' }), t({ ende: '2026-10-18T10:00:00' })], jetzt, ende)).toEqual([]);
    expect(terminVorbeiAus([t({ privat: true })], jetzt, ende)[0].bereich).toBe('privat');
  });
});

describe('Fall-Schritt erledigt / Ziel erreicht (Punkt 33, E9) aus dem Fulfillment-Fall', () => {
  const mandat = { id: 'ma-1', firmaId: 'f-1', gesellschaft: 'ug', kontaktIds: ['c-1'] };
  const erreichung = (e: unknown) => (typeof e === 'number' ? e : null);
  it('nur Schritte, die NEU auf erledigt stehen; Ziel erst beim Übergang auf 100 %', () => {
    const l = fallDiff(
      { knoten: [{ id: 'k-1', status: 'offen' }, { id: 'k-2', status: 'erledigt' }], wertKonto: { z1: 80, z2: 100 } },
      { knoten: [{ id: 'k-1', status: 'erledigt', erledigtAm: '2026-10-22T09:00:00Z' }, { id: 'k-2', status: 'erledigt' }], wertKonto: { z1: 100, z2: 100 } },
      mandat, erreichung,
    );
    expect(l.map(e => [e.art, e.bezug.knotenId ?? null])).toEqual([['fall-schritt-erledigt', 'k-1'], ['ziel-erreicht', null]]);
    expect(l.every(e => e.quelle === 'fulfillment' && e.bereich === 'business' && e.bezug.mandatId === 'ma-1')).toBe(true);
  });
});

describe('Angebunden und Herkunft', () => {
  it('die neuen Arten sind angebunden (Auslöser wählbar)', () => {
    for (const a of ['termin-vorbei', 'mandat-angelegt', 'mandat-beendet', 'rechnung-gestellt', 'fall-schritt-erledigt', 'antwort-gesendet', 'followup-erledigt', 'ziel-erreicht'] as const) {
      expect(EREIGNISSE_ANGEBUNDEN, a).toContain(a);
    }
  });
  it('Herkunft nur aus dem Zusammenhang eines Laufs — Form geprüft, Tiefe gezählt', async () => {
    const pz = 'pz-00000000-0000-4000-8000-000000000001', pl = 'pl-00000000-0000-4000-8000-000000000002';
    expect(laufHerkunftText()).toBeNull();
    const text = await mitLaufHerkunft({ prozessId: pz, laufId: pl, tiefe: 1 }, async () => laufHerkunftText());
    expect(text).toBe(`prozess:${pz}:${pl}:1`);
    expect(HERKUNFT.test(text!)).toBe(true);
    expect(herkunftAus(text!)).toEqual({ prozessId: pz, laufId: pl, tiefe: 1 });
    expect(herkunftAus('prozess:boese')).toBeNull();
    // Eine Quelle kann keine Herkunft einschleusen, die nicht der Form entspricht.
    expect(eingabeSauber({ id: 'x:1', art: 'deal-stufe', quelle: 'crm', bezug: {}, bereich: 'business', herkunft: 'prozess:fremd' }, istEreignisArt)?.herkunft).toBeUndefined();
  });
});

// Server-Regeln am Deal (lib/crm/speicher.ts dealRegeln → wendeCrmAn), 27.09.:
// Stufenwechsel nur mit Grund/Wiedervorlage/nächstem Schritt, Historie vom Server,
// neue Deals nicht per Upsert, Löschen nur bei Fehlanlagen, letzteAktivitaet gesperrt.
import { describe, it, expect } from 'vitest';
import { wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import type { Chance, CrmBestand } from '@/lib/crm/typen';

const JETZT = '2026-09-27T10:00:00.000Z';
const [ERSTE, ZWEITE] = OFFENE_STUFEN;
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Muster AG · Retainer', kontaktIds: [], art: 'retainer', wert: { betrag: 2500, basis: 'monat' }, stufe: ERSTE,
  historie: [{ stufe: ERSTE, am: '2026-09-01T09:00:00.000Z', von: 'kevin' }], naechsterSchritt: { text: 'Angebot schicken', datum: '2026-09-30' },
  qualifizierung: { bedarf: 'offen', budget: 'offen', entscheider: 'offen', zeit: 'offen' } as unknown as Chance['qualifizierung'],
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: '2026-09-01T09:00:00.000Z', geaendert: '2026-09-01T09:00:00.000Z', geaendertVon: 'kevin', ...x,
} as unknown as Chance);
const bestand = (chancen: Chance[]): CrmBestand => ({ ...leererBestand(), chancen });
const teil = (felder: Record<string, unknown>, id = 'ch-1') => ({ liste: 'chancen' as const, op: 'teil' as const, id, felder });

describe('Deal-Regeln auf dem Server', () => {
  it('verloren braucht einen Grund, geparkt eine Wiedervorlage', () => {
    const r1 = wendeCrmAn(bestand([deal()]), [teil({ stufe: 'verloren' })], JETZT, 'kevin');
    expect(r1.fehler).toHaveLength(1);
    expect(r1.bestand.chancen[0].stufe).toBe(ERSTE);
    const r2 = wendeCrmAn(bestand([deal()]), [teil({ stufe: 'geparkt' })], JETZT, 'kevin');
    expect(r2.fehler).toHaveLength(1);
    const ok = wendeCrmAn(bestand([deal()]), [teil({ stufe: 'verloren', grund: 'Budget gestrichen' })], JETZT, 'malin');
    expect(ok.fehler).toEqual([]);
    expect(ok.bestand.chancen[0].stufe).toBe('verloren');
    // Historie hängt der Server an — mit Person und Zeitpunkt.
    expect(ok.bestand.chancen[0].historie).toHaveLength(2);
    expect(ok.bestand.chancen[0].historie[1]).toMatchObject({ stufe: 'verloren', am: JETZT, von: 'malin' });
  });

  it('eine offene Zielstufe braucht einen nächsten Schritt mit Datum vor sich', () => {
    const ueberfaellig = deal({ naechsterSchritt: { text: 'Angebot schicken', datum: '2026-09-20' } });
    const r = wendeCrmAn(bestand([ueberfaellig]), [teil({ stufe: ZWEITE })], JETZT, 'kevin');
    expect(r.fehler[0]).toContain('2026-09-20');
    expect(r.bestand.chancen[0].stufe).toBe(ERSTE);
    const ohne = deal({ naechsterSchritt: undefined });
    expect(wendeCrmAn(bestand([ohne]), [teil({ stufe: ZWEITE })], JETZT, 'kevin').fehler).toHaveLength(1);
    // Mit neuem Schritt im selben Aufruf geht es.
    const mit = wendeCrmAn(bestand([ueberfaellig]), [teil({ stufe: ZWEITE, naechsterSchritt: { text: 'Termin', datum: '2026-10-02' } })], JETZT, 'kevin');
    expect(mit.fehler).toEqual([]);
    expect(mit.bestand.chancen[0].stufe).toBe(ZWEITE);
  });

  it('Historie und letzteAktivitaet setzt nur der Server', () => {
    const r = wendeCrmAn(bestand([deal()]), [teil({ notiz: 'Hallo', historie: [], letzteAktivitaet: '2026-09-27' })], JETZT, 'kevin');
    expect(r.fehler).toEqual([]);
    expect(r.bestand.chancen[0].historie).toHaveLength(1);
    expect(r.bestand.chancen[0].letzteAktivitaet).not.toBe('2026-09-27');
    expect(r.bestand.chancen[0].notiz).toBe('Hallo');
  });

  it('neue Deals entstehen nicht per Upsert — nur über /api/crm/deal', () => {
    const r = wendeCrmAn(bestand([]), [{ liste: 'chancen', op: 'upsert', eintrag: deal({ id: 'ch-neu' }) as unknown as Record<string, unknown> }], JETZT, 'kevin');
    expect(r.fehler).toHaveLength(1);
    expect(r.bestand.chancen).toHaveLength(0);
  });

  it('gelöscht wird nur eine Fehlanlage', () => {
    const mitGeschichte = deal({ historie: [{ stufe: ERSTE, am: JETZT, von: 'kevin' }, { stufe: ZWEITE, am: JETZT, von: 'kevin' }] });
    const r = wendeCrmAn(bestand([mitGeschichte]), [{ liste: 'chancen', op: 'delete', id: 'ch-1' }], JETZT, 'kevin');
    expect(r.fehler).toHaveLength(1);
    expect(r.bestand.chancen).toHaveLength(1);
    const fehlanlage = deal({ wert: { betrag: 0, basis: 'monat' } });
    const ok = wendeCrmAn(bestand([fehlanlage]), [{ liste: 'chancen', op: 'delete', id: 'ch-1' }], JETZT, 'kevin');
    expect(ok.fehler).toEqual([]);
    expect(ok.bestand.chancen).toHaveLength(0);
  });
});

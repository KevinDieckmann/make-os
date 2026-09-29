// ─── Rückweg zum alten Stand (Upload U1 B2, 29.09.): Familien-Daten der neuen Version bringen af4679a nicht zum Absturz ─
// Die neue Version führt Geburtstage am Menschen (`menschId` am Wichtigen Tag). Der alte Online-Stand af4679a kennt
// `menschId` nicht und rechnet mit `WichtigerTag.datum` — `naechstes('')` warf dort RangeError (Familie-Seite, Pflege-
// Rhythmus, ZOE-Agenda). Seit B2 schreibt der Schreibweg `datum` immer als Kopie vom Menschen mit. Geprüft wird mit dem
// WÖRTLICH kopierten alten Code (tests/fixtures/alt-af4679a/). Rein — kein Datenordner nötig.
import { describe, it, expect, vi } from 'vitest';

await vi.hoisted(async () => {
  // Vor allen Imports: speicher.ts zieht local-db mit — nie der echte Datenordner (M3).
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  process.env.MAKE_OS_DATEN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-rueckweg-familie-'));
});

import { wendeFamilieAn, startBestand } from '@/lib/familie/speicher';
import { tagDatum, wichtigeTage } from '@/lib/familie/logik';
import * as alt from './fixtures/alt-af4679a/familie-logik';
import type { Familie as AltFamilie } from './fixtures/alt-af4679a/familie-typen';

const JETZT = '2026-09-29T08:00:00.000Z';
const mensch = (id: string, geburtstag: string | null) => ({ id, name: `Test ${id}`, rolle: 'eltern', geburtstag, kontaktAlleTage: null, letzterKontakt: null, notiz: '' });
const tagVon = (id: string, menschId: string, datum = '') => ({ id, titel: `Geburtstag ${menschId}`, art: 'geburtstag', datum, menschId, vorlaufTage: 7, wer: 'kevin', aktion: 'karte', erledigt: [] });

/** Alles, was der alte Stand mit den Wichtigen Tagen rechnet — darf nicht werfen. */
function altRechnet(f: unknown, heute: string) {
  const fa = f as AltFamilie;
  return { tage: alt.wichtigeTage(fa.tage, heute, 400), rhythmus: alt.pflegeRhythmus(fa, heute), agenda: alt.agendaVorbereiten(fa, heute, 'kevin') };
}

describe('Wichtige Tage mit Menschen-Verweis — der alte Stand liest sie', () => {
  it('ohne B2 wäre der alte Stand abgestürzt (Beleg für den Fund)', () => {
    expect(() => alt.wichtigeTage([{ ...tagVon('t0', 'm0'), von: 'kevin', am: JETZT, sichtbarkeit: 'paar' }] as never, '2026-09-29')).toThrow(RangeError);
  });

  it('neuer Geburtstag mit Verweis: `datum` = Kopie vom Menschen; alter Stand rechnet ohne Fehler', () => {
    const r = wendeFamilieAn(startBestand(JETZT), [
      { liste: 'tage', op: 'upsert', eintrag: tagVon('t1', 'm1') },
      { liste: 'tage', op: 'upsert', eintrag: tagVon('t2', 'm2') },
      { liste: 'menschen', op: 'upsert', eintrag: mensch('m1', '1.3.1940') },
      { liste: 'menschen', op: 'upsert', eintrag: mensch('m2', '3.10.') },
    ] as never, 'kevin', JETZT);
    expect(r.abgelehnt).toBe(0);
    expect(r.familie.tage.map(t => [t.id, t.datum, t.menschId])).toEqual([['t1', '1940-03-01', 'm1'], ['t2', '10-03', 'm2']]);
    const a = altRechnet(r.familie, '2026-09-29');
    expect(a.tage.map(t => [t.id, t.am])).toEqual([['t2', '2026-10-03'], ['t1', '2027-03-01']]);
    // Und die neue Rechnung kommt zum selben Ergebnis (der Mensch führt).
    expect(wichtigeTage(r.familie.tage, '2026-09-29', 400, r.familie.menschen).map(t => [t.id, t.am])).toEqual([['t2', '2026-10-03'], ['t1', '2027-03-01']]);
  });

  it('Geburtstag am Menschen geändert → Kopie zieht nach, auch wenn nur der Mensch geschrieben wird', () => {
    const f = wendeFamilieAn(startBestand(JETZT), [{ liste: 'menschen', op: 'upsert', eintrag: mensch('m1', '1.3.1940') }, { liste: 'tage', op: 'upsert', eintrag: tagVon('t1', 'm1') }] as never, 'kevin', JETZT).familie;
    const g = wendeFamilieAn(f, [{ liste: 'menschen', op: 'upsert', eintrag: mensch('m1', '24.12.') }] as never, 'kevin', JETZT).familie;
    expect(g.tage[0].datum).toBe('12-24');
    expect(altRechnet(g, '2026-09-29').tage[0].am).toBe('2026-12-24');
  });

  it('Browser schickt ein anderes Datum mit → der Mensch gewinnt; Mensch ohne Geburtstag → letzte Kopie bleibt', () => {
    const f = wendeFamilieAn(startBestand(JETZT), [{ liste: 'menschen', op: 'upsert', eintrag: mensch('m1', '1.3.1940') }, { liste: 'tage', op: 'upsert', eintrag: tagVon('t1', 'm1', '07-07') }] as never, 'kevin', JETZT).familie;
    expect(f.tage[0].datum).toBe('1940-03-01');
    const ohne = wendeFamilieAn(f, [{ liste: 'menschen', op: 'upsert', eintrag: mensch('m1', null) }] as never, 'kevin', JETZT).familie;
    expect(ohne.tage[0].datum).toBe('1940-03-01');
    expect(tagDatum(ohne.tage[0], ohne.menschen)).toBeNull(); // neu: der Mensch führt — ohne Geburtstag kein Datum
    expect(() => altRechnet(ohne, '2026-09-29')).not.toThrow();
    // Mensch gelöscht: die Kopie bleibt, der alte Stand rechnet weiter.
    const weg = wendeFamilieAn(ohne, [{ liste: 'menschen', op: 'delete', id: 'm1' }] as never, 'kevin', JETZT).familie;
    expect(() => altRechnet(weg, '2026-09-29')).not.toThrow();
  });

  it('neuer Verweis auf einen Menschen ohne Geburtstag wird abgelehnt (es gäbe kein Datum für den alten Stand)', () => {
    const f = wendeFamilieAn(startBestand(JETZT), [{ liste: 'menschen', op: 'upsert', eintrag: mensch('m1', null) }], 'kevin', JETZT).familie;
    const r = wendeFamilieAn(f, [{ liste: 'tage', op: 'upsert', eintrag: tagVon('t1', 'm1') }] as never, 'kevin', JETZT);
    expect(r.familie.tage).toEqual([]);
    expect([r.angewandt, r.abgelehnt]).toEqual([0, 1]);
  });

  it('Tage ohne Verweis bleiben unverändert', () => {
    const r = wendeFamilieAn(startBestand(JETZT), [{ liste: 'tage', op: 'upsert', eintrag: { id: 't9', titel: 'Jahrestag', art: 'jahrestag', datum: '06-15', vorlaufTage: 14, wer: 'kevin', aktion: 'feier', erledigt: [] } }] as never, 'kevin', JETZT);
    expect(r.familie.tage[0]).toMatchObject({ datum: '06-15' });
    expect(r.familie.tage[0]).not.toHaveProperty('menschId');
    expect(altRechnet(r.familie, '2026-09-29').tage[0].am).toBe('2027-06-15');
  });
});

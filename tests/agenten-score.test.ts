import { describe, it, expect } from 'vitest';
import { agentenFaktoren, agentenEingabe, LAEUFE_ZIEL_7 } from '@/lib/agenten-score';

describe('Agenten-Score', () => {
  it('rechnet die letzten sieben Tage aus den Rohbeständen', () => {
    const e = agentenEingabe({
      agenten: [{ status: 'live' }, { status: 'live' }, { status: 'geplant' }],
      log: [{ ts: '2026-09-23T10:00:00Z' }, { ts: '2026-09-18T10:00:00Z' }, { ts: '2026-09-01T10:00:00Z' }],
      auftraege: [{ zeit: '2026-09-22T07:00:00Z', status: 'fertig' }, { zeit: '2026-09-22T08:00:00Z', status: 'fehler' }, { zeit: '2026-08-30T08:00:00Z', status: 'fertig' }],
      vorschlaege: [{ status: 'offen' }, { status: 'offen' }, { status: 'freigegeben', entschiedenAm: '2026-09-21T09:00:00Z' }, { status: 'abgelehnt', entschiedenAm: '2026-08-01T09:00:00Z' }],
      boteKonfiguriert: true, boteGekoppelt: false,
    }, '2026-09-23');
    expect(e.agenten).toEqual({ live: 2, gesamt: 3 });
    expect(e.laeufe7).toBe(2);
    expect(e.auftraege7).toEqual({ fertig: 1, fehler: 1 });
    expect(e.stapel).toEqual({ offen: 2, entschieden7: 1 });
  });

  it('bewertet: live-Anteil, Läufe gegen Ziel, Auftragsquote, Stapel, Bote', () => {
    const f = agentenFaktoren({ agenten: { live: 19, gesamt: 23 }, laeufe7: LAEUFE_ZIEL_7 / 2, auftraege7: { fertig: 3, fehler: 1 }, stapel: { offen: 8, entschieden7: 2 }, bote: { konfiguriert: true, gekoppelt: true } });
    const w = Object.fromEntries(f.map(x => [x.label, x.wert]));
    expect(w['Agenten live']).toBe(83);
    expect(w['Läufe diese Woche']).toBe(50);
    expect(w['Aufträge erledigt']).toBe(75);
    expect(w['Stapel fließt']).toBe(70);
    expect(w['Bote erreicht dich']).toBe(100);
    expect(f.every(x => x.echt)).toBe(true);
  });

  it('ohne Daten ist nichts echt — und der Stapel ohne Vorschläge gibt keine Punkte', () => {
    const f = agentenFaktoren({ agenten: { live: 0, gesamt: 0 }, laeufe7: 0, auftraege7: { fertig: 0, fehler: 0 }, stapel: { offen: 0, entschieden7: 0 }, bote: { konfiguriert: false, gekoppelt: false } });
    expect(f.every(x => !x.echt)).toBe(true);
    expect(f.every(x => x.wert === 0)).toBe(true);
  });

  it('Stapel: bis fünf offene volle Punkte, ab dem sechsten je zehn weniger', () => {
    const bei = (offen: number) => agentenFaktoren({ agenten: { live: 1, gesamt: 1 }, laeufe7: 0, auftraege7: { fertig: 0, fehler: 0 }, stapel: { offen, entschieden7: 1 }, bote: { konfiguriert: false, gekoppelt: false } }).find(x => x.label === 'Stapel fließt')!.wert;
    expect(bei(5)).toBe(100); expect(bei(6)).toBe(90); expect(bei(15)).toBe(0); expect(bei(30)).toBe(0);
  });
});

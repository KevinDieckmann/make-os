// ─── Kalender-Kern (29.09., K2): EINE Stelle für Kalenderwoche, Montag, Feiertage NRW, Werktag ─
import { describe, it, expect } from 'vitest';
import { kalenderwoche, isoWoche, montagVon, wochentag, feiertageIm, feiertagsHinweis, istWerktag, werktagePlus, werktagAbOder, tagPlus } from '@/lib/zeit/kalender-kern';
import { kalenderwoche as kwMarketing } from '@/lib/crm/marketing';
import { kalenderwoche as kwScoreboard, montagVon as moScoreboard } from '@/lib/crm/scoreboard';
import { kalenderwoche as kwAnsichten } from '@/lib/aufgaben/ansichten';
import { kalenderwoche as kwWiederholung } from '@/lib/aufgaben/wiederholung';
import { kalenderwoche as kwZeit } from '@/lib/zeitmessung/einheiten';
import { kalenderwoche as kwPlanung, montagVon as moPlanung } from '@/lib/planung/zeitraum';
import { montagVon as moLayout } from '@/lib/kalender/layout';
import { werktag as steuerWerktag, feiertage as steuerFeiertage } from '@/lib/finanzen/chef/steuertermine';
import { werktagePlus as angebotWerktage } from '@/lib/crm/angebote';
import { werktagePlus as heuteWerktage } from '@/lib/crm/heute';
import { feiertageIm as quelleFeiertage, feiertagsHinweis as quelleHinweis } from '@/lib/kalender/quellen-feiertage';

describe('Kalenderwoche (ISO 8601)', () => {
  it('Jahreswechsel: die Woche gehört dem Jahr ihres Donnerstags', () => {
    expect(isoWoche('2026-12-31')).toEqual({ kw: 53, jahr: 2026 }); // 2026 hat 53 Wochen (Do 31.12.)
    expect(isoWoche('2027-01-03')).toEqual({ kw: 53, jahr: 2026 });
    expect(isoWoche('2027-01-04')).toEqual({ kw: 1, jahr: 2027 });
    expect(isoWoche('2025-12-29')).toEqual({ kw: 1, jahr: 2026 });
    expect(kalenderwoche('2026-09-29')).toBe(40);
  });
  it('alle früheren Stellen rechnen jetzt über den Kern (7 Stellen, eine Wahrheit)', () => {
    let tag = '2024-12-20';
    for (let i = 0; i < 800; i++, tag = tagPlus(tag, 1)) {
      const kw = kalenderwoche(tag);
      expect([kwMarketing(tag), kwAnsichten(tag), kwZeit(tag), kwPlanung(tag), kwScoreboard(tag).kw, kwWiederholung(tag).kw]).toEqual([kw, kw, kw, kw, kw, kw]);
      expect([moScoreboard(tag), moPlanung(tag), moLayout(tag)]).toEqual([montagVon(tag), montagVon(tag), montagVon(tag)]);
    }
  });
  it('Montag und Wochentag', () => {
    expect(montagVon('2026-10-04')).toBe('2026-09-28'); // Sonntag → Montag davor
    expect(montagVon('2026-09-28')).toBe('2026-09-28');
    expect(wochentag('2026-10-04')).toBe(7);
    expect(wochentag('2026-09-28')).toBe(1);
  });
});

describe('Feiertage NRW — eine Rechnung für alle', () => {
  it('bewegliche und feste Tage inkl. Fronleichnam und Allerheiligen', () => {
    const f = feiertageIm('2026-01-01', '2027-01-01');
    expect(f.map(x => x.tag)).toEqual(['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-06-04', '2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26']);
    expect(feiertageIm('2026-10-01', '2026-10-03')).toEqual([]); // bis exklusiv
    expect(feiertageIm('2026-10-03', '2026-10-04')[0].name).toBe('Tag der Deutschen Einheit');
    expect(feiertageIm('x', '2026-10-04')).toEqual([]);
  });
  it('Hinweis für freie-Zeit-Suche/Buchung (K4), Quellen-Datei reicht nur weiter', () => {
    expect(feiertagsHinweis('2026-06-04')).toBe('Feiertag in NRW: Fronleichnam');
    expect(feiertagsHinweis('2026-06-05')).toBeUndefined();
    expect(quelleHinweis).toBe(feiertagsHinweis);
    expect(quelleFeiertage).toBe(feiertageIm);
  });
  it('Werktage ohne Feiertag NRW', () => {
    expect(istWerktag('2026-06-04')).toBe(false);
    expect(werktagAbOder('2026-12-25')).toBe('2026-12-28');
    expect(werktagePlus('2026-12-23', 2)).toBe('2026-12-28');
  });
  it('Steuertermine (§ 108 AO): Feiertag NRW verschiebt — auch Fronleichnam/Allerheiligen', () => {
    expect(steuerWerktag('2026-06-04')).toBe('2026-06-05'); // Fronleichnam (bundesweit kein Feiertag)
    expect(steuerFeiertage(2026).has('2026-11-01')).toBe(true);
  });
  it('Angebote und Power-Hour-Wiedervorlage zählen Feiertage nicht mehr als Werktag', () => {
    expect(angebotWerktage('2026-09-30', 3)).toBe('2026-10-05'); // Do, Fr, (Sa 3.10.), Mo
    expect(angebotWerktage('2026-12-23', 2)).toBe('2026-12-28');
    expect(heuteWerktage('2026-06-03', 1)).toBe('2026-06-05'); // über Fronleichnam
    expect(heuteWerktage('2026-06-03', 0)).toBe('2026-06-03');
  });
});

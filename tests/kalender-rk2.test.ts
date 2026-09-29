// ─── R-K2 (29.09.): reine Regeln zu Buchungsseite und Bedienung ───────────────
// Frische (#73), Bestätigungslink (#76), freie Tage + Feiertage bis 2030 (#72), „zählt als belegt“ (#69), Gast-Zeitzone
// (#74), mehrtägig ziehen (J-Zusatz), „+n“ (#85), Zeitumstellung (#86), Kontrast der Art-Farben (#89), Suche mit
// Umlauten (#94), Event-ICS mit SEQUENCE (#78), Agenda „läuft weiter“ (#17/#88). Alle Daten erfunden.
import { describe, it, expect } from 'vitest';
import { standBuchbar, mailLinkMoeglich, mailLinkGueltig, mailLinkPfad, bestaetigungsMail } from '@/lib/kalender/buchung';
import { abgleichAlter } from '@/lib/kalender/icloud';
import { freieTageSauber, freieTageIm, FREIE_TAGE_STANDARD } from '@/lib/kalender/freie-tage';
import { zuordnung, zaehltAlsBelegt, werFuerBelegung } from '@/lib/kalender/belegt';
import { einstellungenSauber } from '@/lib/kalender/einstellungen';
import { gastZeit, gastZeitText, zweiteZone, zonenOrt } from '@/lib/kalender/gast-zeit';
import { spaltenLegen, rasterLage, zeitumstellung, verschiebeDifferenz, endeAmTag, letzterTag, laeuftWeiter, MAX_SPALTEN } from '@/lib/kalender/layout';
import { wandAus } from '@/lib/kalender/zeit';
import { verfuegbarkeitAus, istFrei } from '@/lib/kalender/verfuegbarkeit-regeln';
import { feiertageNRW } from '@/lib/aufgaben/feiertage';
import { ART_INFO, TERMIN_FARBEN } from '@/lib/kalender/arten';
import { ART_FARBE } from '@/types/planer';
import { FARBE } from '@/lib/make-one/design';
import { suchPasst } from '@/lib/text/such-norm';
import { icsText, icsSequenz } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';

describe('#73 Stand frisch genug? (dieselbe Regel wie „letzter Abgleich vor X Min.“, R-K1 abgleichAlter)', () => {
  const jetzt = Date.parse('2026-10-05T08:00:00Z');
  const a = (s: Parameters<typeof abgleichAlter>[0]) => abgleichAlter(s, jetzt);
  it('ohne iCloud, ohne Stand, alt, nach Fehler → nein; frisch → ja', () => {
    expect(standBuchbar(a({ at: '2026-10-05T07:59:00Z' }), false)).toEqual({ ok: false, grund: 'ohne-icloud' });
    expect(standBuchbar(null, true)).toEqual({ ok: false, grund: 'kein-stand' });
    expect(standBuchbar(a({}), true)).toEqual({ ok: false, grund: 'alt' });
    expect(standBuchbar(a({ at: new Date(jetzt - 31 * 60_000).toISOString() }), true)).toEqual({ ok: false, grund: 'alt' });
    expect(standBuchbar(a({ at: '2026-10-05T07:58:00.000Z', fehler: 'iCloud nicht erreichbar', fehlerAt: '2026-10-05T07:59:00.000Z' }), true)).toEqual({ ok: false, grund: 'fehler' });
    expect(standBuchbar(a({ at: '2026-10-05T07:59:30.000Z', fehler: 'alt', fehlerAt: '2026-10-05T07:10:00.000Z' }), true)).toEqual({ ok: true });
    expect(standBuchbar(a({ at: new Date(jetzt - 29 * 60_000).toISOString() }), true)).toEqual({ ok: true });
  });
});

describe('#76 Bestätigungslink', () => {
  it('nur für angefragte/bestätigte Buchungen mit unbestätigter Adresse; Ablauf; Pfad mit Fragment', () => {
    expect(mailLinkMoeglich({ status: 'angefragt' })).toEqual({ ok: true });
    expect(mailLinkMoeglich({ status: 'bestaetigt' })).toEqual({ ok: true });
    expect(mailLinkMoeglich({ status: 'vorlaeufig' }).ok).toBe(false);
    expect(mailLinkMoeglich({ status: 'abgelehnt' }).ok).toBe(false);
    expect(mailLinkMoeglich({ status: 'angefragt', emailBestaetigtAm: '2026-10-05T08:00:00Z' }).ok).toBe(false);
    expect(mailLinkGueltig({ hash: 'x', bis: '2026-10-12T08:00:00.000Z', am: '' }, '2026-10-12T07:59:59.000Z')).toBe(true);
    expect(mailLinkGueltig({ hash: 'x', bis: '2026-10-12T08:00:00.000Z', am: '' }, '2026-10-12T08:00:00.000Z')).toBe(false);
    expect(mailLinkGueltig(undefined, '2026-10-12T08:00:00.000Z')).toBe(false);
    expect(mailLinkPfad('probe-0123456789abcdef01234567', 'T'.repeat(43))).toBe(`/buchen/probe-0123456789abcdef01234567/status#mail=${'T'.repeat(43)}`);
  });
  it('Mail-Entwurf: Sie-Form, Link, Ablauf (Berliner Tag), Verantwortlicher, keine Werbung', () => {
    const m = bestaetigungsMail({ name: 'Testa Gast', titel: 'Kennenlernen', start: '2026-10-08T09:00:00', ende: '2026-10-08T09:30:00', link: 'https://probe.example.invalid/buchen/x#mail=abc', verantwortlich: 'Probe GmbH, p@example.invalid', bis: '2026-10-14T22:30:00.000Z' });
    expect(m.betreff).toContain('Kennenlernen');
    expect(m.text).toContain('Guten Tag Testa Gast');
    expect(m.text).toContain('08.10.2026, 09:00–09:30 Uhr');
    expect(m.text).toContain('https://probe.example.invalid/buchen/x#mail=abc');
    expect(m.text).toContain('bis 15.10.2026'); // 22:30 UTC = 00:30 Berlin am 15.
    expect(m.text).toContain('Verantwortlich: Probe GmbH');
    expect(m.text).not.toMatch(/Angebot|Newsletter|Rabatt/);
  });
});

describe('#72 frei, aber nicht gesetzlich · Feiertage NRW bis 2030', () => {
  it('Standard 24.12./31.12.; säubern (Format, 29.02., Doppelte); im Zeitraum', () => {
    expect(freieTageSauber(undefined)).toEqual(FREIE_TAGE_STANDARD);
    expect(freieTageSauber([])).toEqual([]);
    expect(freieTageSauber([{ tag: '12-31', name: 'Silvester' }, { tag: '12-31', name: 'doppelt' }, { tag: '02-30', name: 'gibt es nicht' }, { tag: '2-1', name: 'falsch' }, { tag: '02-29', name: '' }]))
      .toEqual([{ tag: '02-29', name: 'frei' }, { tag: '12-31', name: 'Silvester' }]);
    expect(freieTageIm('2026-12-20', '2027-01-05', FREIE_TAGE_STANDARD)).toEqual({ '2026-12-24': 'Heiligabend', '2026-12-31': 'Silvester' });
    expect(freieTageIm('2027-02-01', '2029-03-01', [{ tag: '02-29', name: 'Schalttag' }])).toEqual({ '2028-02-29': 'Schalttag' });
    expect(einstellungenSauber(null).freieTage).toEqual(FREIE_TAGE_STANDARD);
  });
  it('gesetzliche Feiertage NRW 2026–2030 (amtliche Liste; 24.12./31.12. nie)', () => {
    const soll: Record<number, string[]> = {
      2026: ['01-01', '04-03', '04-06', '05-01', '05-14', '05-25', '06-04', '10-03', '11-01', '12-25', '12-26'],
      2027: ['01-01', '03-26', '03-29', '05-01', '05-06', '05-17', '05-27', '10-03', '11-01', '12-25', '12-26'],
      2028: ['01-01', '04-14', '04-17', '05-01', '05-25', '06-05', '06-15', '10-03', '11-01', '12-25', '12-26'],
      2029: ['01-01', '03-30', '04-02', '05-01', '05-10', '05-21', '05-31', '10-03', '11-01', '12-25', '12-26'],
      2030: ['01-01', '04-19', '04-22', '05-01', '05-30', '06-10', '06-20', '10-03', '11-01', '12-25', '12-26'],
    };
    for (const [j, tage] of Object.entries(soll)) {
      const ist = feiertageNRW(Number(j)).map(f => f.tag.slice(5));
      expect(ist, `Feiertage ${j}`).toEqual(tage);
      expect(ist).not.toContain('12-24');
      expect(ist).not.toContain('12-31');
    }
  });
});

describe('#69 zählt als belegt', () => {
  const e = { kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' } };
  it('zugeordnet zählt, nicht zugeordnet nicht — Schalter gewinnt', () => {
    expect(zuordnung(e, 'Privat Kevin')).toBe('kevin');
    expect(zuordnung(e, 'Kevin Dieckmann')).toBe('kevin');
    expect(zuordnung(e, 'Kalender')).toBeNull();
    expect(zaehltAlsBelegt(e, 'Gemeinsam')).toBe(true);
    expect(zaehltAlsBelegt(e, 'Kalender')).toBe(false);
    expect(werFuerBelegung(e, 'Kalender')).toBe('niemand');
    expect(werFuerBelegung({ ...e, belegt: { Kalender: true } }, 'Kalender')).toBe('beide');
    expect(werFuerBelegung({ ...e, belegt: { 'Privat Kevin': false } }, 'Privat Kevin')).toBe('niemand');
    expect(einstellungenSauber({ belegt: { Kalender: true, Kaputt: 'ja' as unknown as boolean } }).belegt).toEqual({ Kalender: true });
  });
  it('ein Termin eines Kalenders, der nicht zählt, blockiert Kevin nicht (verfuegbarkeitAus)', () => {
    const termin = { uid: 'u1', id: 'u1', titel: 'Abo', start: '2026-10-06T10:00:00', ende: '2026-10-06T11:00:00', ganztags: false, kalender: 'Kalender', href: '', kalenderId: '', sichtbarkeit: 'standard' as const, serie: false, mitTeilnehmern: false, bearbeitbar: true, art: 'termin' as const, beschaeftigt: true, privat: false };
    const zaehlt = verfuegbarkeitAus({ person: 'kevin', von: '2026-10-06', bis: '2026-10-07', termine: [{ ...termin, wer: werFuerBelegung({ ...e, belegt: { Kalender: true } }, 'Kalender') }] });
    const nicht = verfuegbarkeitAus({ person: 'kevin', von: '2026-10-06', bis: '2026-10-07', termine: [{ ...termin, wer: werFuerBelegung(e, 'Kalender') }] });
    expect(istFrei(zaehlt, '2026-10-06T10:00:00', '2026-10-06T10:30:00')).toBe(false);
    expect(istFrei(nicht, '2026-10-06T10:00:00', '2026-10-06T10:30:00')).toBe(true);
  });
});

describe('#74 Zeitzone des Gasts', () => {
  it('New York: sechs Stunden früher; in der Umstellungslücke (08.–29.03.) nur fünf', () => {
    expect(gastZeit('2026-10-06T10:00:00', 'America/New_York')).toEqual({ tag: '2026-10-06', zeit: '04:00', abweichend: true });
    expect(gastZeitText('2027-03-15T10:00:00', 'America/New_York')).toBe('05:00');
    expect(gastZeitText('2026-10-06T03:00:00', 'America/New_York')).toBe('21:00 (Mo, 05.10.)');
    expect(gastZeitText('2026-10-06T10:00:00', 'Europe/Berlin')).toBeNull();
    expect(gastZeitText('2026-10-06T10:00:00', 'Europe/Paris')).toBeNull(); // gleiche Uhrzeit → keine zweite Angabe
    expect(gastZeit('2026-10-06T10:00:00', 'Mars/Olympus')).toBeNull();
    expect(zweiteZone('Europe/Berlin')).toBe(false);
    expect(zweiteZone('Asia/Tokyo')).toBe(true);
    expect(zonenOrt('America/New_York')).toBe('New York');
  });
});

describe('J-Zusatz · mehrtägige Termine ziehen', () => {
  const reise = { start: '2026-10-09T18:00:00', ende: '2026-10-11T14:00:00' };
  it('letzter Tag, „läuft weiter“', () => {
    expect(letzterTag(reise)).toBe('2026-10-11');
    expect(letzterTag({ start: '2026-10-09T22:00:00', ende: '2026-10-10T00:00:00' })).toBe('2026-10-09');
    expect(laeuftWeiter({ ...reise, ganztags: false }, '2026-10-10')).toBe(true);
    expect(laeuftWeiter({ ...reise, ganztags: false }, '2026-10-11')).toBe(true);
    expect(laeuftWeiter({ ...reise, ganztags: false }, '2026-10-09')).toBe(false);
    expect(laeuftWeiter({ ...reise, ganztags: false }, '2026-10-12')).toBe(false);
    expect(laeuftWeiter({ start: '2026-10-09T22:00:00', ende: '2026-10-10T00:00:00', ganztags: false }, '2026-10-10')).toBe(false);
  });
  it('am Samstag angefasst, einen Tag + 1 Std. später abgelegt → Start und Ende verschieben sich gleich (Dauer bleibt)', () => {
    const r = verschiebeDifferenz(reise, 1, 60);
    expect([wandAus(r.tag, r.startMin), wandAus(r.tag, r.endeMin)]).toEqual(['2026-10-10T19:00:00', '2026-10-12T15:00:00']);
    const zurueck = verschiebeDifferenz(reise, -1, -30);
    expect([wandAus(zurueck.tag, zurueck.startMin), wandAus(zurueck.tag, zurueck.endeMin)]).toEqual(['2026-10-08T17:30:00', '2026-10-10T13:30:00']);
  });
  it('Dauer am letzten Segment: neues Ende am Sonntag, Start bleibt', () => {
    const r = endeAmTag(reise, '2026-10-11', 16 * 60);
    expect([wandAus(r.tag, r.startMin), wandAus(r.tag, r.endeMin)]).toEqual(['2026-10-09T18:00:00', '2026-10-11T16:00:00']);
  });
});

describe('#85 „+n“ ab 4 Spalten · #86 Zeitumstellung', () => {
  it('bis 3 Spalten alle; ab 4 nur zwei + „+n“ in der dritten; aufgeklappt alle', () => {
    const lagen = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, von: 600 + i, bis: 660 }));
    const p = spaltenLegen(lagen);
    const m = new Map(lagen.map(l => [l.id, l]));
    const zu = rasterLage(p, m, false);
    expect(zu.sicht.size).toBe(MAX_SPALTEN - 1);
    expect(zu.mehr).toEqual([{ gruppe: 0, von: 602, n: 4, ids: ['c', 'd', 'e', 'f'] }]);
    for (const s of zu.sicht.values()) expect(s.breite).toBeCloseTo(100 / 3);
    const auf = rasterLage(p, m, true);
    expect(auf.sicht.size).toBe(6);
    expect(auf.mehr).toEqual([]);
    const drei = spaltenLegen(lagen.slice(0, 3));
    expect(rasterLage(drei, m, false).mehr).toEqual([]);
  });
  it('25.10.2026 hat 25 Stunden (doppelt), 29.03.2026 23 (entfällt), sonst nichts', () => {
    expect(zeitumstellung('2026-10-25')).toBe('doppelt');
    expect(zeitumstellung('2026-03-29')).toBe('entfaellt');
    expect(zeitumstellung('2026-10-26')).toBeNull();
    expect(zeitumstellung('2027-10-31')).toBe('doppelt');
  });
});

describe('#89 Kontrast der Art-Farben (Klar·DARK)', () => {
  // WCAG 2.x: relative Leuchtdichte; Bedienelemente/Grafik brauchen ≥ 3:1 (1.4.11), Text ≥ 4.5:1 (1.4.3).
  const lum = (h: string) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const mix = (f: string, b: string, a: number) => `#${[1, 3, 5].map(i => Math.round(parseInt(f.slice(i, i + 2), 16) * a + parseInt(b.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  const kr = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const farben = [...Object.values(ART_INFO).map(a => a.farbe).filter((f): f is string => !!f), ...Object.values(ART_FARBE), ...TERMIN_FARBEN.map(f => f.hex)];
  it('Randfarbe ≥ 3:1 gegen den Grund und gegen die eigene Blockfläche; Titeltext ≥ 4.5:1', () => {
    for (const f of farben) {
      const flaeche = mix(f, FARBE.grund, 0x2a / 255);
      expect(kr(f, FARBE.grund), `${f} gegen Grund`).toBeGreaterThanOrEqual(3);
      expect(kr(f, flaeche), `${f} gegen Blockfläche`).toBeGreaterThanOrEqual(3);
      expect(kr(FARBE.ink, flaeche), `Text auf ${f}`).toBeGreaterThanOrEqual(4.5);
      expect(kr(FARBE.inkDim, flaeche), `Zeitzeile auf ${f}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('#94 Suche mit Umlaut-Faltung · #78 Event-ICS', () => {
  it('„mueller“ findet „Müller“, „strasse“ findet „Straße“, NFD wie NFC', () => {
    expect(suchPasst(['Termin mit Müller', 'Büro'], 'mueller')).toBe(true);
    expect(suchPasst(['Termin mit Müller'], 'müller')).toBe(true);
    expect(suchPasst(['Termin mit Müller'], 'Müller')).toBe(true);
    expect(suchPasst(['Hauptstraße 1'], 'strasse')).toBe(true);
    expect(suchPasst(['Termin'], 'mueller')).toBe(false);
  });
  it('SEQUENCE steigt mit jeder Änderung, LAST-MODIFIED = Stand, DTSTAMP = Erzeugung', () => {
    const ev = (geaendert: string): Event => ({ id: 'ev-probe', titel: 'Probeabend', format: 'stammtisch', ziel: 'x', datum: '2026-11-05', uhrzeit: '19:00', status: 'geplant', geaendert });
    const a = icsText(ev('2026-10-01T10:00:00.000Z'), '2026-10-02T08:00:00.000Z').split('\r\n');
    const b = icsText(ev('2026-10-03T10:00:00.000Z'), '2026-10-02T08:00:00.000Z').split('\r\n');
    const seq = (z: string[]) => Number(z.find(x => x.startsWith('SEQUENCE:'))!.slice(9));
    expect(seq(b)).toBeGreaterThan(seq(a));
    expect(a).toContain('LAST-MODIFIED:20261001T100000Z');
    expect(a).toContain('DTSTAMP:20261002T080000Z');
    expect(icsSequenz(undefined)).toBe(0);
    expect(icsSequenz('2026-01-01T00:00:10Z')).toBe(10);
  });
});

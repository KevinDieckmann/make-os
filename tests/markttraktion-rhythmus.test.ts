// ─── Markttraktion — Rhythmus & Push ────────────────────────────────────────
// Verlauf des Traction-Scores (ein Schnappschuss je Tag, der letzte gilt),
// Wochen-Scoreboard (rückwirkend aus den echten Daten, Kalenderwochen Mo–So),
// Morgen-Nachricht und Freitags-Scoreboard, und der Takt mit seinem Riegel.

import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, Event, PowerHourSitzung, Teilnahme } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { traktion } from '../lib/crm/traktion';
import {
  verlaufFortschreiben, verlaufEintrag, verlaufSeit, gleicherStand, jePersonSieben, VERLAUF_MAX, type VerlaufTag,
  kalenderwoche, montagVon, wochenBis, wochenScoreboard, bewerte, type Scoreboard,
  morgenText, wochenText, faelligeRhythmen, markiereRhythmus, rhythmusStand, RHYTHMUS_VERSUCHE,
} from '../lib/crm/scoreboard';

const HEUTE = '2026-09-25'; // Freitag, KW 39
const J = (d: string, h = '10:00') => `${d}T${h}:00.000Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const sitzung = (person: string, datum: string): PowerHourSitzung => ({ id: `ph-${person}-${datum}`, person, datum, start: J(datum, '08:00'), ziel: { gespraeche: 5, termine: 1 }, karten: [] });
const chance = (x: Partial<Chance> = {}): Chance => ({ id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 3000, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J(HEUTE), geaendert: J(HEUTE), ...x });
const beitrag = (x: Partial<Beitrag>): Beitrag => ({ id: 'b-1', titel: 'Beitrag', kanal: 'linkedin', status: 'idee', wirkung: [], quellen: [], geaendert: J(HEUTE), ...x });
const event = (x: Partial<Event>): Event => ({ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'Drei Folgegespräche', datum: HEUTE, status: 'geplant', geaendert: J(HEUTE), ...x });
const gast = (id: string, eventId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id, eventId, kontaktId: `c-${id}`, status: 'da', geaendert: J(HEUTE), ...x });
const zeile = (sb: Scoreboard, id: string) => { const z = sb.zeilen.find(r => r.id === id); if (!z) throw new Error(`Zeile ${id} fehlt`); return z; };
const n = null;

// ── Verlauf ─────────────────────────────────────────────────────────────────

const tagEintrag = (tag: string, score: number | null): VerlaufTag => ({ tag, score, welten: { sales: score, marketing: null, event: null } });

describe('Traction-Verlauf fortschreiben', () => {
  it('beginnt bei leerem oder kaputtem Speicher neu', () => {
    expect(verlaufFortschreiben(null, tagEintrag(HEUTE, 50)).tage).toEqual([tagEintrag(HEUTE, 50)]);
    expect(verlaufFortschreiben({ tage: 'kaputt' }, tagEintrag(HEUTE, 50)).tage).toHaveLength(1);
    expect(verlaufFortschreiben({ tage: [null, { tag: 'gestern' }, tagEintrag('2026-09-24', 40)] }, tagEintrag(HEUTE, 50)).tage.map(t => t.tag)).toEqual(['2026-09-24', HEUTE]);
  });

  it('nie doppelt am selben Tag — der letzte Stand des Tages gilt', () => {
    const a = verlaufFortschreiben(null, tagEintrag(HEUTE, 50));
    const b = verlaufFortschreiben(a, tagEintrag(HEUTE, 55));
    expect(b.tage).toEqual([tagEintrag(HEUTE, 55)]);
  });

  it('hält die Tage sortiert und höchstens 400 — die neuesten', () => {
    const tage = Array.from({ length: VERLAUF_MAX }, (_, i) => { const d = new Date(Date.UTC(2025, 0, 1 + i, 12)); return tagEintrag(d.toISOString().slice(0, 10), i % 100); });
    const r = verlaufFortschreiben({ tage: [...tage].reverse() }, tagEintrag(HEUTE, 70));
    expect(r.tage).toHaveLength(VERLAUF_MAX);
    expect(r.tage[r.tage.length - 1].tag).toBe(HEUTE);
    expect(r.tage[0].tag).toBe('2025-01-02');
    expect(r.tage.every((t, i) => i === 0 || r.tage[i - 1].tag < t.tag)).toBe(true);
  });

  it('schreibt nur, wenn sich etwas geändert hat, und liefert 90 Tage', () => {
    expect(gleicherStand(undefined, tagEintrag(HEUTE, 50))).toBe(false);
    expect(gleicherStand(tagEintrag(HEUTE, 50), tagEintrag(HEUTE, 50))).toBe(true);
    expect(gleicherStand(tagEintrag(HEUTE, 50), tagEintrag(HEUTE, 51))).toBe(false);
    const stand = { tage: [tagEintrag('2026-06-27', 1), tagEintrag('2026-06-28', 2), tagEintrag(HEUTE, 3)] };
    expect(verlaufSeit(stand, HEUTE, 90).map(t => t.tag)).toEqual(['2026-06-28', HEUTE]); // 90 Tage einschließlich heute
  });

  it('nimmt Score, Welten und je Person die sieben Tage in den Schnappschuss', () => {
    const t = traktion({ sales: [], marketing: [], event: [] });
    const crm: CrmBestand = { ...leererBestand(), sitzungen: [sitzung('malin', '2026-09-22'), sitzung('malin', '2026-09-10')] };
    const kontakte = [k('a', { aktivitaeten: [{ am: J('2026-09-24'), art: 'termin', von: 'kevin' }, { am: J('2026-09-24'), art: 'gespraech', von: 'system' }] })];
    const e = verlaufEintrag(t, HEUTE, jePersonSieben(kontakte, crm, HEUTE));
    expect(e).toEqual({ tag: HEUTE, score: null, welten: { sales: null, marketing: null, event: null }, jePerson: { kevin: { powerHours: 0, gespraeche: 1 }, malin: { powerHours: 1, gespraeche: 0 } } });
  });
});

// ── Kalenderwochen ──────────────────────────────────────────────────────────

describe('Kalenderwochen (ISO 8601, Mo–So)', () => {
  it('rechnet die Kalenderwoche auch über den Jahreswechsel', () => {
    expect(kalenderwoche(HEUTE)).toEqual({ kw: 39, jahr: 2026 });
    expect(kalenderwoche('2026-12-31').kw).toBe(53);
    expect(kalenderwoche('2027-01-01')).toEqual({ kw: 53, jahr: 2026 });
    expect(kalenderwoche('2027-01-04')).toEqual({ kw: 1, jahr: 2027 });
    expect(kalenderwoche('2025-12-29')).toEqual({ kw: 1, jahr: 2026 });
    expect(montagVon('2026-09-27')).toBe('2026-09-21');
    expect(montagVon('2026-09-21')).toBe('2026-09-21');
  });

  it('acht Wochen, älteste zuerst, die laufende als letzte', () => {
    const w = wochenBis(HEUTE, 8);
    expect(w).toHaveLength(8);
    expect(w[0]).toMatchObject({ von: '2026-08-03', bis: '2026-08-09', label: 'KW 32', laufend: false });
    expect(w[7]).toMatchObject({ von: '2026-09-21', bis: '2026-09-27', label: 'KW 39', laufend: true });
    expect(w.filter(x => x.laufend)).toHaveLength(1);
  });
});

// ── Wochen-Scoreboard ───────────────────────────────────────────────────────

function bestand(): { kontakte: Kontakt[]; crm: CrmBestand } {
  const kontakte = [
    k('a', { aktivitaeten: [
      { am: J('2026-09-15'), art: 'mail', von: 'kevin' },                         // erster Verlauf → ab KW 38 gemessen
      { am: J('2026-09-22'), art: 'anruf', ergebnis: 'gespraech', von: 'kevin' },  // zählt (Ergebnis)
      { am: J('2026-09-23'), art: 'termin', von: 'malin' },                       // zählt (Art)
      { am: J('2026-09-23', '11:00'), art: 'gespraech', von: 'system' },          // System zählt nie
      { am: J('2026-09-24'), art: 'notiz', von: 'kevin' },                        // keine Notiz
      { am: J('2026-09-26'), art: 'anruf', ergebnis: 'gespraech', von: 'kevin' }, // morgen — zählt noch nicht
    ] }),
    k('b'),
  ];
  const crm: CrmBestand = {
    ...leererBestand(),
    sitzungen: [
      sitzung('kevin', '2026-09-01'), sitzung('kevin', '2026-09-02'), sitzung('malin', '2026-09-03'), sitzung('kevin', '2026-09-04'), // KW 36: 4
      sitzung('kevin', '2026-09-08'),                                                                                                // KW 37: 1
      sitzung('kevin', '2026-09-15'), sitzung('malin', '2026-09-16'),                                                                // KW 38: 2
      sitzung('malin', '2026-09-22'),                                                                                                // KW 39: 1
    ],
    chancen: [
      chance({ id: 'ch-1', angelegt: J('2026-09-10'), stufe: 'gewonnen', historie: [{ stufe: 'qualifiziert', am: J('2026-09-10'), von: 'kevin' }, { stufe: 'gewonnen', am: J('2026-09-23'), von: 'kevin' }] }),
      chance({ id: 'ch-2', angelegt: J('2026-09-22') }),
    ],
    beitraege: [
      beitrag({ id: 'b-1', status: 'veroeffentlicht', datum: '2026-09-22', geaendert: J('2026-09-22'), wirkung: [
        { kontaktId: 'c-a', art: 'gespraech', am: J('2026-09-23') },
        { kontaktId: 'c-a', art: 'anfrage', am: J('2026-09-24') },  // dieselbe Person am selben Beitrag: einmal
        { kontaktId: 'c-b', art: 'reaktion', am: J('2026-09-24') }, // Reaktion ist kein Gespräch
      ] }),
      beitrag({ id: 'b-2', status: 'geplant', datum: '2026-09-29', geaendert: J('2026-09-14') }),
    ],
    events: [
      event({ id: 'ev-1', datum: '2026-09-17', status: 'durchgefuehrt', geaendert: J('2026-09-10') }),
      event({ id: 'ev-2', datum: '2026-09-24', status: 'geplant', geaendert: J('2026-09-20') }),
    ],
    teilnahmen: [
      gast('g1', 'ev-1', { followUpAm: J('2026-09-18') }), // pünktlich
      gast('g2', 'ev-1'),                                  // Frist vorbei, nicht nachgefasst
      gast('g3', 'ev-1', { status: 'zugesagt' }),         // nicht da → zählt nicht
      gast('g4', 'ev-2'),                                  // Frist läuft noch → zählt noch nicht
    ],
  };
  return { kontakte, crm };
}

describe('Wochen-Scoreboard', () => {
  const { kontakte, crm } = bestand();
  const sb = wochenScoreboard(kontakte, crm, HEUTE);

  it('Power Hours je Woche — grau vor der ersten, die laufende Woche erst am Ende bewertet', () => {
    const z = zeile(sb, 'power_hours');
    expect(z.werte).toEqual([n, n, n, n, 4, 1, 2, 1]);
    expect(z.ampeln).toEqual(['grau', 'grau', 'grau', 'grau', 'gruen', 'rot', 'gelb', 'offen']);
    expect(z.zielText).toBe('≥ 4');
  });

  it('Power Hours je Person mit Anteil am Teamziel', () => {
    const kev = zeile(sb, 'power_hours:kevin'), mal = zeile(sb, 'power_hours:malin');
    expect(kev.werte.slice(4)).toEqual([3, 1, 1, 0]);
    expect(mal.werte.slice(4)).toEqual([1, 0, 1, 1]);
    expect(kev.ziel).toBe(2);
    expect(mal.ampeln.slice(4)).toEqual(['gelb', 'rot', 'gelb', 'offen']);
    expect(kev.person).toBe('kevin');
  });

  it('echte Gespräche: Art oder Ergebnis Gespräch/Termin, ohne System, ohne Zukunft', () => {
    expect(zeile(sb, 'gespraeche').werte).toEqual([n, n, n, n, n, n, 0, 2]);
    expect(zeile(sb, 'gespraeche').ampeln.slice(6)).toEqual(['rot', 'offen']);
    expect(zeile(sb, 'gespraeche:kevin').werte[7]).toBe(1);
    expect(zeile(sb, 'gespraeche:malin').werte[7]).toBe(1);
  });

  it('neue und gewonnene Chancen', () => {
    expect(zeile(sb, 'neue_chancen').werte).toEqual([n, n, n, n, n, 1, 0, 1]);
    expect(zeile(sb, 'neue_chancen').ampeln.slice(5)).toEqual(['gruen', 'rot', 'gruen']);
    expect(zeile(sb, 'gewonnen').werte).toEqual([n, n, n, n, n, 0, 0, 1]);
    expect(zeile(sb, 'gewonnen').zielText).toBe('—');
    expect(zeile(sb, 'gewonnen').ampeln[7]).toBe('offen');
  });

  it('Marketing: veröffentlichte Beiträge und Gespräche aus Content', () => {
    expect(zeile(sb, 'beitraege').werte.slice(5)).toEqual([n, 0, 1]);
    expect(zeile(sb, 'beitraege').ampeln.slice(6)).toEqual(['rot', 'offen']);
    expect(zeile(sb, 'content_gespraeche').werte.slice(5)).toEqual([n, n, 1]);
  });

  it('Event: durchgeführte Events und Nachgefasst binnen 48 h (Quote)', () => {
    expect(zeile(sb, 'events').werte.slice(4)).toEqual([n, 0, 1, 1]);
    const nf = zeile(sb, 'nachfassen_48h');
    expect(nf.werte.slice(5)).toEqual([n, 50, n]);
    expect(nf.ampeln.slice(5)).toEqual(['grau', 'rot', 'grau']);
    expect(nf.zielText).toBe('≥ 90 %');
    expect(nf.einheit).toBe('%');
  });

  it('ohne jede Messung überall grau — nie eine erfundene Null', () => {
    const leer = wochenScoreboard([], leererBestand(), HEUTE);
    expect(leer.zeilen.every(z => z.werte.every(v => v === null) && z.ampeln.every(a => a === 'grau'))).toBe(true);
    expect(leer.wochen).toHaveLength(8);
  });

  it('bewertet eine Quote auch in der laufenden Woche, eine Anzahl erst am Ende', () => {
    expect(bewerte(1, 4, 2, true)).toBe('offen');
    expect(bewerte(4, 4, 2, true)).toBe('gruen');
    expect(bewerte(50, 90, 60, true, true)).toBe('rot');
    expect(bewerte(3, null, null, false)).toBe('offen');
    expect(bewerte(null, 4, 2, false)).toBe('grau');
  });
});

// ── Texte ───────────────────────────────────────────────────────────────────

describe('Morgen-Nachricht', () => {
  const kontakte = [k('m', { vorname: 'Mara', nachname: 'Muster', besitzer: 'malin', kreis: 'B', naechsterSchritt: { text: 'Rückruf', datum: HEUTE }, telefon: '+49 30 2', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'] })];
  const crm: CrmBestand = {
    ...leererBestand(),
    sitzungen: [sitzung('malin', '2026-09-22')],
    beitraege: [beitrag({ id: 'b-f', status: 'entwurf', stimme: 'malin', zustaendig: 'kevin', freigabe: { status: 'offen', an: 'malin', von: 'kevin' } })],
  };

  it('sagt kurz, was bei der Person liegt, und wohin es geht', () => {
    const t = morgenText('malin', kontakte, crm, HEUTE, { adresse: 'https://make.example/' });
    const zeilen = t.split('\n');
    expect(zeilen[0]).toBe('Guten Morgen, Malin.');
    expect(zeilen[1]).toMatch(/^Markttraktion heute: 1 in deiner Power Hour \(1 Zusage\)/);
    expect(t).toMatch(/1 Freigabe wartet auf dich/);
    expect(t).toMatch(/Deine Woche bisher: 1 von 2 Power Hours/);
    expect(zeilen[zeilen.length - 1]).toBe('→ https://make.example/os/markttraktion');
  });

  it('keine Beträge, keine Namen, und die Zusage nicht doppelt', () => {
    const t = morgenText('malin', kontakte, crm, HEUTE);
    expect(t).not.toMatch(/€|Mara|Muster/);
    expect(t).not.toMatch(/Zugesagte nächste Schritte/);
  });

  it('montags das Wochenziel statt „bisher“, und ehrlich, wenn nichts anliegt', () => {
    expect(morgenText('malin', kontakte, crm, '2026-09-21')).toMatch(/Neue Woche — dein Anteil: 2 Power Hours\./);
    const leer = morgenText('kevin', [], leererBestand(), HEUTE);
    expect(leer).toBe('Guten Morgen, Kevin.\nMarkttraktion heute: nichts Fälliges bei dir.\n→ /os/markttraktion');
  });
});

describe('Wochen-Scoreboard als Nachricht (freitags)', () => {
  const { kontakte, crm } = bestand();

  it('jede gemessene Kennzahl der Woche gegen ihr Ziel, je Person, und die eigene Zeile', () => {
    const t = wochenText('malin', kontakte, crm, HEUTE, { adresse: 'https://make.example' });
    expect(t.split('\n')[0]).toBe('Wochen-Scoreboard KW 39 · 21.–27.09.');
    expect(t).toMatch(/• Power Hours: 1 von 4 \(Kevin 0, Malin 1\)/);
    expect(t).toMatch(/• Echte Gespräche: 2 von 8 \(Kevin 1, Malin 1\)/);
    expect(t).toMatch(/• Neue SQL → Deals: 1 von 1 ✓/);
    expect(t).toMatch(/• Gewonnene Deals: 1/);
    expect(t).toMatch(/• Veröffentlichte Beiträge: 1 von 2/);
    expect(t).toMatch(/• Gespräche aus Content: 1/);
    expect(t).toMatch(/• Durchgeführte Events: 1/);
    expect(t).not.toMatch(/Nachgefasst/); // diese Woche noch nicht messbar
    expect(t).toMatch(/Du: 1 von 2 Power Hours, 1 von 4 Gesprächen\./);
    expect(t).toMatch(/→ https:\/\/make\.example\/os\/markttraktion$/);
    expect(t).not.toMatch(/€/);
  });

  it('ohne Messung ein ehrlicher Satz statt leerer Zeilen', () => {
    expect(wochenText('kevin', [], leererBestand(), HEUTE)).toMatch(/Noch nichts gemessen/);
  });
});

// ── Takt ────────────────────────────────────────────────────────────────────

describe('Takt: Morgen-Nachricht und Freitags-Scoreboard', () => {
  const beide = ['kevin', 'malin'];
  const um = (tag: number, h: number, m = 0) => new Date(2026, 8, tag, h, m); // September 2026, lokale Zeit

  it('werktags ab 7:30 bis Mittag je Person einmal', () => {
    expect(faelligeRhythmen({}, beide, um(21, 7, 29))).toEqual([]);
    expect(faelligeRhythmen({}, beide, um(21, 7, 30))).toEqual([{ person: 'kevin', slot: 'morgen' }, { person: 'malin', slot: 'morgen' }]);
    expect(faelligeRhythmen({}, beide, um(21, 12, 0))).toEqual([]);
    expect(faelligeRhythmen({}, beide, um(26, 9, 0))).toEqual([]); // Samstag
    expect(faelligeRhythmen({}, beide, um(27, 9, 0))).toEqual([]); // Sonntag
  });

  it('freitags ab 15 Uhr das Wochen-Scoreboard', () => {
    expect(faelligeRhythmen({}, ['kevin'], um(25, 9, 0))).toEqual([{ person: 'kevin', slot: 'morgen' }]);
    expect(faelligeRhythmen({}, ['kevin'], um(25, 14, 59))).toEqual([]);
    expect(faelligeRhythmen({}, ['kevin'], um(25, 15, 0))).toEqual([{ person: 'kevin', slot: 'woche' }]);
    expect(faelligeRhythmen({}, ['kevin'], um(24, 15, 0))).toEqual([]); // Donnerstag
  });

  it('der Riegel verhindert Doppeltes; Fehlversuche enden nach drei', () => {
    let s = markiereRhythmus({}, 'kevin', 'morgen', '2026-09-21', true);
    expect(faelligeRhythmen(s, beide, um(21, 8))).toEqual([{ person: 'malin', slot: 'morgen' }]);
    expect(faelligeRhythmen(s, ['kevin'], um(22, 8))).toEqual([{ person: 'kevin', slot: 'morgen' }]); // nächster Tag wieder
    for (let i = 0; i < RHYTHMUS_VERSUCHE; i++) s = markiereRhythmus(s, 'malin', 'morgen', '2026-09-21', false);
    expect(s.malin.versuche).toEqual({ 'morgen:2026-09-21': RHYTHMUS_VERSUCHE });
    expect(faelligeRhythmen(s, beide, um(21, 8))).toEqual([]);
    s = markiereRhythmus(s, 'malin', 'morgen', '2026-09-22', true);
    expect(s.malin).toEqual({ morgen: '2026-09-22' }); // alte Fehlversuche fallen weg
  });

  it('ein kaputter Speicher hält den Takt nicht an', () => {
    expect(rhythmusStand(null)).toEqual({});
    expect(rhythmusStand([1, 2])).toEqual({});
    expect(rhythmusStand({ kevin: { morgen: '2026-09-25', woche: 7 }, malin: 'x' })).toEqual({ kevin: { morgen: '2026-09-25' } });
  });
});

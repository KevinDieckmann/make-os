// ─── Business-frei durchsetzen (08.10., Lücke 7) — reine Regeln ───────────────────────────────────────────────────────
// Kevin (ROADMAP_Q4 › Lücken): „Business-freie Zeiten wirken nicht → ein Arbeitsrahmen je Person; Business-frei sperrt Kalender,
// Kapazität, ZOE, Heads und Glocke.“ Geprüft: die EINE Regel (Fenster, Mitternacht, Zeitumstellung), K1 (Arbeitszeit, istFrei),
// freie Zeit und Buchungsseite ohne Plätze, Kapazität vorher → nachher (ohne Eintrag bit-gleich), Glocke gesammelt und danach als
// EINE Meldung, Heads verschoben und nachgeholt. Alles erfunden, keine Platte.
import { describe, it, expect } from 'vitest';
import {
  businessFreiFenster, istBusinessFrei, freiBis, ueberlappt, abziehen, amTag, bisText, fensterLesen, fensterPruefen, vereinigen,
  wochentagSo0, terminIstBusiness, istArbeitsBlock, businessFreiSatz, EIGENE_MAX, type BusinessFreiFenster,
} from '@/lib/arbeitsrahmen/regel';
import { wandzeit } from '@/lib/kalender/zeit';
import { verfuegbarkeitAus, istFrei } from '@/lib/kalender/verfuegbarkeit-regeln';
import { belegungenAus, arbeitszeitAus } from '@/lib/kalender/freie-zeit';
import { freieZeiten } from '@/lib/kalender/verfuegbar';
import { plaetzeFuerSeite, LEER, type BuchungsSeite } from '@/lib/kalender/buchung';
import { kapazitaetRechnen, tageAusVerfuegbarkeit } from '@/lib/kapazitaet/modell';
import type { Block } from '@/lib/planung/typen';
import {
  businessFreiSammeln, businessFreiIdsAufloesen, istBusinessMeldung, sichtBauen, gelesenSetzen, businessFreiId, leererBestand, anstehendAbleiten,
  type Meldung, type MeldungenBestand,
} from '@/lib/meldungen/regeln';
import { faelligeModi, type HeadsRahmen } from '@/lib/heads/takt';
import { leererStand } from '@/lib/heads/stand';

// Woche 12.–18.10.2026 (Mo–So).
const MO = '2026-10-12', SA = '2026-10-17', SO = '2026-10-18';
const FAMILIE: BusinessFreiFenster[] = [{ tage: [0], von: '00:00', bis: '23:59' }, { tage: [1, 2, 3, 4, 5], von: '20:00', bis: '23:59' }];

describe('Regel: Fenster in Berliner Wandzeit', () => {
  it('Familie-Standard: Sonntag ganz, werktags ab 20 Uhr bis Mitternacht (23:59 = Tagesende), vereinigt', () => {
    const s = businessFreiFenster(FAMILIE, MO, '2026-10-19');
    expect(s).toEqual([
      { start: '2026-10-12T20:00:00', ende: '2026-10-13T00:00:00' },
      { start: '2026-10-13T20:00:00', ende: '2026-10-14T00:00:00' },
      { start: '2026-10-14T20:00:00', ende: '2026-10-15T00:00:00' },
      { start: '2026-10-15T20:00:00', ende: '2026-10-16T00:00:00' },
      { start: '2026-10-16T20:00:00', ende: '2026-10-17T00:00:00' },
      { start: '2026-10-18T00:00:00', ende: '2026-10-19T00:00:00' },
    ]);
    expect(istBusinessFrei(s, '2026-10-12T19:59:00')).toBe(false);
    expect(istBusinessFrei(s, '2026-10-12T20:00:00')).toBe(true);
    expect(istBusinessFrei(s, '2026-10-12T23:59:30')).toBe(true);
    expect(istBusinessFrei(s, '2026-10-13T00:00:00')).toBe(false);
    expect(istBusinessFrei(s, `${SO}T12:00:00`)).toBe(true);
    expect(wochentagSo0(SO)).toBe(0);
    expect(wochentagSo0(SA)).toBe(6);
  });

  it('über Mitternacht: 22:00–06:00 am Samstag läuft in den Sonntag; ein Fenster des Vortags zählt am ersten Tag mit', () => {
    const f: BusinessFreiFenster[] = [{ tage: [6], von: '22:00', bis: '06:00' }];
    expect(businessFreiFenster(f, SA, '2026-10-19')).toEqual([{ start: `${SA}T22:00:00`, ende: `${SO}T06:00:00` }]);
    // Zeitraum ab Sonntag: der Teil nach Mitternacht kommt vom Samstag.
    expect(businessFreiFenster(f, SO, '2026-10-19')).toEqual([{ start: `${SO}T00:00:00`, ende: `${SO}T06:00:00` }]);
    // Angrenzend an „Sonntag ganz“ wird es EINE Spanne bis Montag 00:00.
    const beide = businessFreiFenster([...f, { tage: [0], von: '00:00', bis: '23:59' }], SA, '2026-10-19');
    expect(beide).toEqual([{ start: `${SA}T22:00:00`, ende: '2026-10-19T00:00:00' }]);
    expect(freiBis(beide, `${SA}T23:00:00`)).toBe('2026-10-19T00:00:00');
    expect(freiBis(beide, `${SA}T21:00:00`)).toBeNull();
  });

  it('von = bis heißt 24 Stunden; 24:00 ist erlaubt', () => {
    expect(businessFreiFenster([{ tage: [3], von: '00:00', bis: '00:00' }], '2026-10-14', '2026-10-15')).toEqual([{ start: '2026-10-14T00:00:00', ende: '2026-10-15T00:00:00' }]);
    expect(businessFreiFenster([{ tage: [3], von: '12:00', bis: '24:00' }], '2026-10-14', '2026-10-15')).toEqual([{ start: '2026-10-14T12:00:00', ende: '2026-10-15T00:00:00' }]);
  });

  it('Zeitumstellung: die doppelte Stunde (25.10.) und die fehlende (29.03.) liegen in einem Nachtfenster — echte Zeitpunkte über `wandzeit`', () => {
    const nacht: BusinessFreiFenster[] = [{ tage: [6], von: '22:00', bis: '06:00' }];
    const herbst = businessFreiFenster(nacht, '2026-10-24', '2026-10-26');
    // 02:30 gibt es am 25.10. zweimal (erst Sommer-, dann Winterzeit) — beide Male Business-frei.
    expect(wandzeit(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25T02:30:00');
    expect(wandzeit(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25T02:30:00');
    expect(istBusinessFrei(herbst, wandzeit(new Date('2026-10-25T00:30:00Z')))).toBe(true);
    expect(istBusinessFrei(herbst, wandzeit(new Date('2026-10-25T01:30:00Z')))).toBe(true);
    expect(istBusinessFrei(herbst, wandzeit(new Date('2026-10-25T05:30:00Z')))).toBe(false); // 06:30 Winterzeit
    const fruehling = businessFreiFenster(nacht, '2026-03-28', '2026-03-30');
    expect(istBusinessFrei(fruehling, wandzeit(new Date('2026-03-29T00:30:00Z')))).toBe(true); // 01:30 Winterzeit
    expect(istBusinessFrei(fruehling, wandzeit(new Date('2026-03-29T01:30:00Z')))).toBe(true); // 03:30 Sommerzeit
    expect(istBusinessFrei(fruehling, wandzeit(new Date('2026-03-29T04:30:00Z')))).toBe(false); // 06:30
  });

  it('Rahmen = Familie + eigene Ergänzung (nur einschränken): eine eigene Zeit hebt keine gemeinsame auf', () => {
    const r = { familie: FAMILIE, eigene: [{ tage: [6], von: '14:00', bis: '18:00' }] };
    const s = businessFreiFenster(r, SA, '2026-10-19');
    expect(s).toEqual([{ start: `${SA}T14:00:00`, ende: `${SA}T18:00:00` }, { start: `${SO}T00:00:00`, ende: '2026-10-19T00:00:00' }]);
    expect(businessFreiFenster({ familie: [], eigene: [] }, MO, SO)).toEqual([]);
  });

  it('lesen tolerant, prüfen streng: falsche Fenster → 400, zu viele → 413, nie gekürzt', () => {
    expect(fensterLesen([{ tage: ['1', 2], von: '08:00', bis: '09:00' }, { tage: [], von: '08:00', bis: '09:00' }, { tage: [9], von: '08:00', bis: '09:00' }, 'x'])).toEqual([{ tage: [1, 2], von: '08:00', bis: '09:00' }]);
    expect(fensterPruefen([{ tage: [1], von: '8 Uhr', bis: '09:00' }])).toMatchObject({ ok: false, status: 400 });
    expect(fensterPruefen(Array.from({ length: EIGENE_MAX + 1 }, () => ({ tage: [1], von: '08:00', bis: '09:00' })))).toMatchObject({ ok: false, status: 413 });
    expect(fensterPruefen([{ tage: [2, 1, 1], von: '08:00', bis: '09:00' }])).toEqual({ ok: true, fenster: [{ tage: [1, 2], von: '08:00', bis: '09:00' }] });
  });

  it('Hilfen: abziehen, amTag, ueberlappt, vereinigen, bisText', () => {
    expect(abziehen([{ start: `${SA}T09:00:00`, ende: `${SA}T18:00:00` }], [{ start: `${SA}T12:00:00`, ende: `${SA}T14:00:00` }])).toEqual([{ start: `${SA}T09:00:00`, ende: `${SA}T12:00:00` }, { start: `${SA}T14:00:00`, ende: `${SA}T18:00:00` }]);
    expect(amTag([{ start: `${SA}T22:00:00`, ende: `${SO}T06:00:00` }], SO)).toEqual([{ start: `${SO}T00:00:00`, ende: `${SO}T06:00:00` }]);
    expect(ueberlappt([{ start: `${SA}T22:00:00`, ende: `${SO}T06:00:00` }], `${SA}T21:00:00`, `${SA}T22:00:00`)).toBe(false);
    expect(ueberlappt([{ start: `${SA}T22:00:00`, ende: `${SO}T06:00:00` }], `${SA}T21:00:00`, `${SA}T22:15:00`)).toBe(true);
    expect(vereinigen([{ start: 'b', ende: 'c' }, { start: 'a', ende: 'b' }])).toEqual([{ start: 'a', ende: 'c' }]);
    expect(bisText('2026-10-13T00:00:00', MO)).toBe('bis 23:59');
    expect(bisText(`${SO}T06:00:00`, SA)).toBe('bis morgen 06:00');
    expect(bisText('2026-10-19T00:00:00', SA)).toBe('bis morgen 23:59');
    expect(bisText('2026-10-19T00:00:00', '2026-10-16')).toBe('bis So 18.10. 23:59');
  });

  it('Was ist Business? Termine im Business-Bereich/-Kalender (nie Abwesend/Arbeitsort), Arbeits-Blöcke; ZOE-Satz ohne Inhalte', () => {
    expect(terminIstBusiness({ art: 'termin', bereich: 'business', kalenderBusiness: false })).toBe(true);
    expect(terminIstBusiness({ art: 'termin', kalenderBusiness: true })).toBe(true);
    expect(terminIstBusiness({ art: 'termin', bereich: 'privat', kalenderBusiness: false })).toBe(false);
    expect(terminIstBusiness({ art: 'abwesend', bereich: 'business', kalenderBusiness: true })).toBe(false);
    expect(terminIstBusiness({ art: 'arbeitsort', kalenderBusiness: true })).toBe(false);
    expect(istArbeitsBlock('fokus')).toBe(true);
    expect(istArbeitsBlock('block', 'aufgabe')).toBe(true);
    expect(istArbeitsBlock('block', null)).toBe(true);
    for (const b of ['reha', 'routine', 'pause']) expect(istArbeitsBlock('block', b)).toBe(false);
    const satz = businessFreiSatz('Erika', 'bis 23:59');
    expect(satz).toContain('bis 23:59');
    expect(satz).not.toMatch(/Familie|Ehe|Partner/);
  });
});

// ── K1: Verfügbarkeit ────────────────────────────────────────────────────────────────────────────────────────────────
const VORLAGE: Block[] = [
  ...[1, 2, 3, 4, 5].map(w => ({ id: `b-${w}`, owner: 'person-a', wochentag: w as Block['wochentag'], von: '09:00', bis: '17:00', art: 'business' as const })),
  { id: 'b-6', owner: 'person-a', wochentag: 6, von: '10:00', bis: '14:00', art: 'business' },
  { id: 'b-1a', owner: 'person-a', wochentag: 1, von: '19:00', bis: '21:00', art: 'business' },
];
const v = (businessFrei?: { start: string; ende: string }[]) => verfuegbarkeitAus({ person: 'person-a', von: MO, bis: '2026-10-19', termine: [], bloecke: VORLAGE, ...(businessFrei ? { businessFrei } : {}) });
const SPANNEN = businessFreiFenster({ familie: FAMILIE, eigene: [{ tage: [6], von: '00:00', bis: '00:00' }] }, MO, '2026-10-19');

describe('K1: Arbeitszeit, istFrei, freie Zeit, Buchungsseite', () => {
  it('ohne Business-frei bit-gleich (keine neuen Felder); mit Business-frei fehlt die Zeit in der Arbeitszeit', () => {
    expect(v([])).toEqual(v());
    expect(JSON.stringify(v())).not.toContain('businessFrei');
    const mit = v(SPANNEN);
    const mo = mit.tage.find(t => t.tag === MO)!;
    expect(mo.arbeitszeit).toEqual([{ start: `${MO}T09:00:00`, ende: `${MO}T17:00:00` }, { start: `${MO}T19:00:00`, ende: `${MO}T20:00:00` }]);
    expect(mo.businessFrei).toEqual([{ start: `${MO}T20:00:00`, ende: '2026-10-13T00:00:00' }]);
    expect(mo.arbeitszeitVorlage).toHaveLength(2);
    const sa = mit.tage.find(t => t.tag === SA)!;
    expect(sa.arbeitszeit).toEqual([]);
    expect(sa.arbeitszeitVorlage).toEqual([{ start: `${SA}T10:00:00`, ende: `${SA}T14:00:00` }]);
    // Dienstag ohne Überschneidung: keine Vorlage-Kopie.
    expect(mit.tage.find(t => t.tag === '2026-10-13')!.arbeitszeitVorlage).toBeUndefined();
  });

  it('istFrei ist in einer Business-freien Zeit falsch (Buchungs-Freigabe fragt dann „Trotzdem freigeben“)', () => {
    expect(istFrei(v(), `${MO}T20:30:00`, `${MO}T21:00:00`)).toBe(true);
    expect(istFrei(v(SPANNEN), `${MO}T20:30:00`, `${MO}T21:00:00`)).toBe(false);
    expect(istFrei(v(SPANNEN), `${MO}T10:00:00`, `${MO}T11:00:00`)).toBe(true);
  });

  it('freie Zeit bietet in Business-freien Fenstern nichts an — auch ohne Wochenvorlage (Standard 9–18)', () => {
    const jetzt = new Date('2026-10-11T12:00:00Z');
    const suche = (x: ReturnType<typeof v>) => freieZeiten({ personen: ['person-a'], belegungen: belegungenAus(x), arbeitszeitJeTag: { 'person-a': arbeitszeitAus(x) }, dauerMin: 60, von: MO, tage: 7, jetzt, rasterMin: 60, grenze: 500 });
    const ohne = suche(v()), mit = suche(v(SPANNEN));
    expect(ohne.some(f => f.start === `${MO}T20:00:00`)).toBe(true);
    expect(ohne.some(f => f.tag === SA)).toBe(true);
    expect(mit.some(f => f.start >= `${MO}T20:00:00` && f.start < '2026-10-13T00:00:00')).toBe(false);
    expect(mit.some(f => f.tag === SA || f.tag === SO)).toBe(false);
    expect(mit.some(f => f.start === `${MO}T10:00:00`)).toBe(true);
    // Ohne Vorlage: Standard Mo–Fr 9–18 — eine eigene Business-freie Zeit am Mittwochvormittag belegt.
    const ohneVorlage = verfuegbarkeitAus({ person: 'person-a', von: MO, bis: '2026-10-19', termine: [], bloecke: [], businessFrei: businessFreiFenster([{ tage: [3], von: '09:00', bis: '12:00' }], MO, '2026-10-19') });
    const r = freieZeiten({ personen: ['person-a'], belegungen: belegungenAus(ohneVorlage), arbeitszeitJeTag: { 'person-a': arbeitszeitAus(ohneVorlage) }, dauerMin: 60, von: MO, tage: 7, jetzt, rasterMin: 60 });
    expect(r.filter(f => f.tag === '2026-10-14').map(f => f.start.slice(11, 16))).toEqual(['12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
  });

  it('Buchungsseite: keine Plätze in Business-freier Zeit', () => {
    const seite: BuchungsSeite = {
      id: 'bs-bf-1', slug: 'abend-0123456789abcdef01234567', titel: 'Abendtermin', dauerMin: 30, person: 'person-a',
      fenster: [{ tage: [1, 2, 3, 4, 5], von: '18:00', bis: '22:00' }], tageVoraus: 7, vorlaufMin: 0, maxJeTag: 10, pufferMin: 0, rasterMin: 60,
      zielKalender: 'Testkalender', fragen: {}, verantwortlich: 'Test GmbH, test@example.invalid', aktiv: true, angelegt: '2026-10-01T10:00:00Z', geaendert: '2026-10-01T10:00:00Z',
    } as BuchungsSeite;
    const jetzt = new Date('2026-10-11T12:00:00Z');
    const ohne = plaetzeFuerSeite(seite, belegungenAus(v()), { ...LEER, seiten: [seite] }, jetzt, {}, '2026-10-11');
    const mit = plaetzeFuerSeite(seite, belegungenAus(v(SPANNEN)), { ...LEER, seiten: [seite] }, jetzt, {}, '2026-10-11');
    expect(ohne.filter(p => p.tag === MO).map(p => p.start.slice(11, 16))).toEqual(['18:00', '19:00', '20:00', '21:00']);
    expect(mit.filter(p => p.tag === MO).map(p => p.start.slice(11, 16))).toEqual(['18:00', '19:00']);
  });
});

describe('Kapazität: vorher → nachher', () => {
  const rechne = (x: ReturnType<typeof v>) => {
    const t = tageAusVerfuegbarkeit(x);
    return kapazitaetRechnen({ heute: MO, wochen: 1, personen: [{ id: 'konto-person-a', name: 'A', quelle: 'konto', tage: t.tage, hatVorlage: t.hatVorlage }], datei: { personen: {}, zuweisungen: [] }, posten: [] });
  };
  it('ohne Business-frei-Eintrag rechnet sie bit-gleich', () => {
    expect(rechne(v([]))).toEqual(rechne(v()));
  });
  it('Business-freie Zeit zieht nur ab, wo die Vorlage Business-Blöcke hat: Montag 1 h, Samstag 4 h', () => {
    const vorher = rechne(v()), nachher = rechne(v(SPANNEN));
    expect(vorher.personen[0].grundwert).toBe(46);    // 5 × 8 + 4 (Sa) + 2 (Mo-Abend)
    expect(nachher.personen[0].grundwert).toBe(41);   // − 1 h (Mo 20–21) − 4 h (Sa)
    expect(nachher.personen[0].grundwertQuelle).toBe('vorlage');
    expect(nachher.personen[0].wochen[0].brutto).toBeLessThan(vorher.personen[0].wochen[0].brutto);
  });
  it('eine Vorlage, die NUR in Business-freier Zeit liegt, bleibt eine Vorlage (Soll 0, keine Annahme 40 h)', () => {
    const nurSa = verfuegbarkeitAus({ person: 'person-a', von: MO, bis: '2026-10-19', termine: [], bloecke: [VORLAGE[5]], businessFrei: SPANNEN });
    const t = tageAusVerfuegbarkeit(nurSa);
    expect(t.hatVorlage).toBe(true);
    const st = kapazitaetRechnen({ heute: MO, wochen: 1, personen: [{ id: 'konto-person-a', name: 'A', quelle: 'konto', tage: t.tage, hatVorlage: t.hatVorlage }], datei: { personen: {}, zuweisungen: [] }, posten: [] });
    expect(st.personen[0].grundwert).toBe(0);
  });
});

// ── Glocke ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const BIS = '2026-10-12T22:00:00.000Z'; // Ende des Fensters (Mo 24:00 Berlin)
const m = (id: string, x: Partial<Meldung> = {}): Meldung => ({ id, art: 'zuweisung', titel: `Meldung ${id}`, link: '/os/aufgaben', am: '2026-10-12T19:00:00.000Z', ...x });
const bereich = (id: string) => (id.startsWith('t-biz') ? 'business' as const : id.startsWith('t-priv') ? 'privat' as const : null);
const istBiz = (x: Meldung) => istBusinessMeldung(x, bereich);

describe('Glocke: Business-Hinweise aus der freien Zeit', () => {
  const liste = [
    m('m1', { freiBis: BIS, bezug: { art: 'aufgabe', id: 't-biz-1' } }),
    m('m2', { freiBis: BIS, art: 'netzwerken', bezug: { art: 'netzwerken', id: 'nw-1' } }),
    m('m3', { freiBis: BIS, bezug: { art: 'aufgabe', id: 't-priv-1' } }),      // privat → sofort
    m('m4', { freiBis: BIS, art: 'sicherheit' }),                              // Sicherheit → sofort
    m('m5', { bezug: { art: 'aufgabe', id: 't-biz-2' } }),                    // vor dem Fenster → normal
    m('v1', { art: 'faellig', virtuell: true, bezug: { art: 'aufgabe', id: 't-biz-3' } }),
    m('v2', { art: 'frist', virtuell: true, business: true }),
    m('v3', { art: 'geburtstag', virtuell: true }),
  ];
  it('Einordnung: Business sind Markttraktion, Netzwerken, Buchungen, Verträge, Business-Aufgaben und -Fristen', () => {
    expect(liste.filter(istBiz).map(x => x.id)).toEqual(['m1', 'm2', 'm5', 'v1', 'v2']);
    expect(istBusinessMeldung({ art: 'vertrag' })).toBe(true);
    expect(istBusinessMeldung({ art: 'buchung', bezug: { art: 'buchung', id: 'bu-1' } })).toBe(true);
    expect(istBusinessMeldung({ art: 'verbindung' })).toBe(false);
    expect(istBusinessMeldung({ art: 'postfach' })).toBe(false);
  });

  it('während des Fensters: Business ruht (nicht gezeigt, nicht gezählt), Privat/Sicherheit kommen sofort', () => {
    const r = businessFreiSammeln(liste, { jetzt: '2026-10-12T20:00:00.000Z', frei: true, istBusiness: istBiz });
    expect(r.meldungen.map(x => x.id).sort()).toEqual(['m3', 'm4', 'm5', 'v3']);
    expect([...r.ruhen].sort()).toEqual(['m1', 'm2']);
  });

  it('danach: EINE Meldung „2 Business-Hinweise aus der freien Zeit“ mit beiden darin; abgeleitete wieder da', () => {
    const r = businessFreiSammeln(liste, { jetzt: '2026-10-13T06:00:00.000Z', frei: false, istBusiness: istBiz });
    const s = r.meldungen.find(x => x.art === 'businessfrei')!;
    expect(s).toMatchObject({ id: businessFreiId(BIS), titel: '2 Business-Hinweise aus der freien Zeit', gelesen: false });
    expect(s.enthalten!.map(x => x.id).sort()).toEqual(['m1', 'm2']);
    expect(r.meldungen.some(x => x.id === 'm1' || x.id === 'm2')).toBe(false);
    expect(r.meldungen.some(x => x.id === 'v1') && r.meldungen.some(x => x.id === 'v2')).toBe(true);
    expect(businessFreiIdsAufloesen([s.id, 'x'], r.gruppen).sort()).toEqual([s.id, 'm1', 'm2', 'x'].sort());
  });

  it('sichtBauen zählt die Sammelmeldung als EINE; „alle gelesen“ im Fenster fasst Ruhendes nicht an — nichts geht verloren', () => {
    const bestand: MeldungenBestand = { ...leererBestand(), eintraege: liste.filter(x => !x.virtuell) };
    const im = sichtBauen(bestand, [], MO, { jetzt: '2026-10-12T20:00:00.000Z', frei: true, istBusiness: istBiz });
    expect(im.ungelesen).toBe(3); // m3, m4, m5
    const nachAlle = gelesenSetzen(bestand, { alle: true }, MO, [], new Set(['m1', 'm2']));
    expect(nachAlle.eintraege.filter(x => !x.gelesen).map(x => x.id).sort()).toEqual(['m1', 'm2']);
    const danach = sichtBauen(nachAlle, [], '2026-10-13', { jetzt: '2026-10-13T06:00:00.000Z', frei: false, istBusiness: istBiz });
    expect(danach.ungelesen).toBe(1);
    expect(danach.meldungen[0].art).toBe('businessfrei');
    // Ohne Lage: wie bisher (alles sichtbar).
    expect(sichtBauen(bestand, [], MO).meldungen).toHaveLength(5);
  });

  it('abgeleitete Fristen tragen „business“ nur, wenn sie Business sind', () => {
    const a = anstehendAbleiten({ termine: [], nachbereiten: [], followups: [], fristen: [
      { id: 'md-frist-1', titel: 'Kündigungsfrist', tag: MO, href: '/os/mandate', inTagen: 0, business: true },
      { id: 'ms-privat', titel: 'Umzug', tag: MO, href: '/os/planung', inTagen: 0 },
    ] }, { heute: MO, jetztWand: `${MO}T08:00:00`, am: 'x' });
    expect(a.map(x => !!x.business)).toEqual([true, false]);
  });
});

// ── Heads ──────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Heads: verschoben und nachgeholt', () => {
  const lokal = (iso: string) => new Date(iso);
  const rahmen = (x: Partial<HeadsRahmen> = {}): HeadsRahmen => ({ haushaltFrei: false, personFrei: new Set(), warFrei: () => false, ...x });
  it('Haushalt Business-frei → kein Lauf; danach wie gewohnt', () => {
    const fr = lokal('2026-10-16T15:00:00'); // Freitag 15 Uhr (Maschinenzeit)
    expect(faelligeModi('sales', fr, leererStand(), [], ['person-a'], rahmen({ haushaltFrei: true }))).toEqual([]);
    expect(faelligeModi('sales', fr, leererStand(), [], ['person-a'], rahmen()).map(x => x.modus)).toEqual(['power_hour']);
    // Ohne Rahmen exakt wie bisher.
    expect(faelligeModi('sales', fr, leererStand(), [], ['person-a'])).toEqual(faelligeModi('sales', fr, leererStand(), [], ['person-a'], rahmen()));
  });
  it('die Power Hour ruht nur für die Person, die gerade Business-frei ist', () => {
    const mo = lokal('2026-10-12T08:00:00');
    expect(faelligeModi('sales', mo, leererStand(), [], ['person-a', 'person-b'], rahmen({ personFrei: new Set(['person-a']) }))).toEqual([{ modus: 'power_hour', grund: 'Power Hour vorbereiten (Person-b)', person: 'person-b' }]);
  });
  it('Freitagnachmittag ganz Business-frei → der Wochenreview kommt am Samstag nach (und nur einmal)', () => {
    const sa = lokal('2026-10-17T10:00:00');
    const warFrei = (t: string, h: number) => t === '2026-10-16' && h >= 12;
    const s = { ...leererStand(), letzte: { ...leererStand().letzte, 'power_hour:person-a': '2026-10-16T07:00:00.000Z' } };
    expect(faelligeModi('sales', sa, s, [], ['person-a'])).toEqual([]);
    expect(faelligeModi('sales', sa, s, [], ['person-a'], rahmen({ warFrei }))).toEqual([{ modus: 'wochenreview', grund: 'Wochenreview Vertrieb (nachgeholt nach Business-frei)' }]);
    const gelaufen = { ...s, letzte: { ...s.letzte, wochenreview: '2026-10-17T08:00:00.000Z' } };
    expect(faelligeModi('sales', sa, gelaufen, [], ['person-a'], rahmen({ warFrei }))).toEqual([]);
  });
  it('Event am Samstag, Sonntag ganz Business-frei → Nachfassen am Montag', () => {
    const mo = lokal('2026-10-19T09:00:00');
    const events = [{ datum: '2026-10-17', status: 'geplant' }];
    expect(faelligeModi('event', mo, leererStand(), events, ['person-a'])).toEqual([]);
    expect(faelligeModi('event', mo, leererStand(), events, ['person-a'], rahmen({ warFrei: t => t === '2026-10-18' }))).toEqual([{ modus: 'nachfassen', grund: 'Nachfassen nach dem Event (48 h) (nachgeholt nach Business-frei)' }]);
  });
});

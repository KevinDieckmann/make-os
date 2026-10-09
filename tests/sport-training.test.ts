// ─── Sport · Training sichtbar (09.10.2026) ─────────────────────────────────────────────────────────────────────────────
// Befund zu Kevins Frage „Die Trainingsdaten fehlen ihr“: WHOOP-Workouts ohne Distanz landen in `SportStand.training[]`, die Ansichten
// zählten aber nur Läufe, Gym und Hyrox. Dieser Test belegt den Befund mit erfundenen Workouts (nie echte Daten) und hält die neue EINE
// Stelle `alleEinheiten` fest: Zuordnung je Sportart, nichts doppelt, Person-Felder bleiben beim Abgleich.
import { describe, it, expect } from 'vitest';
import { workoutAus, sportAnwenden, externeIdVon, ortsUhrzeit, type WWorkout } from '@/lib/whoop/abbilden';
import { training, uuid } from './fixtures/whoop-fake';
import { leererStand, saeubere, wendeAn, type SportStand } from '@/lib/sport/modell';
import { alleEinheiten, klasseVonSport, sportSchluessel, sportName, SPORT_ZUORDNUNG, summe, wochenListe, sportartenUebersicht, zaehlende } from '@/lib/sport/training';
import { wocheIst, planIst, ersteEinheit } from '@/lib/sport/plan';

/** Offizielle WHOOP-Sportarten (https://developer.whoop.com/docs/developing/user-data/workout, abgerufen 09.10.2026). */
const WHOOP_SPORTARTEN = [
  'Activity', 'Running', 'Cycling', 'Baseball', 'Basketball', 'Rowing', 'Fencing', 'Field Hockey', 'Football', 'Golf', 'Ice Hockey', 'Lacrosse', 'Rugby',
  'Sailing', 'Skiing', 'Soccer', 'Softball', 'Squash', 'Swimming', 'Tennis', 'Track & Field', 'Volleyball', 'Water Polo', 'Wrestling', 'Boxing', 'Dance',
  'Pilates', 'Yoga', 'Weightlifting', 'Cross Country Skiing', 'Functional Fitness', 'Duathlon', 'Gymnastics', 'Hiking/Rucking', 'Horseback Riding', 'Kayaking',
  'Martial Arts', 'Mountain Biking', 'Powerlifting', 'Rock Climbing', 'Paddleboarding', 'Triathlon', 'Walking', 'Surfing', 'Elliptical', 'Stairmaster',
  'Meditation', 'Other', 'Diving', 'Operations - Tactical', 'Operations - Medical', 'Operations - Flying', 'Operations - Water', 'Ultimate', 'Climber',
  'Jumping Rope', 'Australian Football', 'Skateboarding', 'Coaching', 'Ice Bath', 'Commuting', 'Gaming', 'Snowboarding', 'Motocross', 'Caddying',
  'Obstacle Course Racing', 'Motor Racing', 'HIIT', 'Spin', 'Jiu Jitsu', 'Manual Labor', 'Cricket', 'Pickleball', 'Inline Skating', 'Box Fitness', 'Spikeball',
  'Wheelchair Pushing', 'Paddle Tennis', 'Barre', 'Stage Performance', 'High Stress Work', 'Parkour', 'Gaelic Football', 'Hurling/Camogie', 'Circus Arts',
  'Massage Therapy', 'Strength Trainer', 'Watching Sports', 'Assault Bike', 'Kickboxing', 'Stretching', 'Table Tennis', 'Badminton', 'Netball', 'Sauna',
  'Disc Golf', 'Yard Work', 'Air Compression', 'Percussive Massage', 'Paintball', 'Ice Skating', 'Handball', 'F45 Training', 'Padel', "Barry's",
  'Dedicated Parenting', 'Stroller Walking', 'Stroller Jogging', 'Toddlerwearing', 'Babywearing', 'Barre3', 'Hot Yoga', 'Stadium Steps', 'Polo',
  'Musical Performance', 'Kite Boarding', 'Dog Walking', 'Water Skiing', 'Wakeboarding', 'Cooking', 'Cleaning', 'Public Speaking',
];

/** Eine erfundene Woche (Mo 05.10. – So 11.10.2026) mit WHOOP-Workouts — so, wie sie die Abbildung ablegt. */
const W = (n: number, start: string, min: number, sport: string, opt: Parameters<typeof training>[4] = {}): WWorkout => workoutAus(training(n, start, min, sport, opt))!;
const WOCHE: WWorkout[] = [
  W(1, '2026-10-05T05:30:00Z', 60, 'Functional Fitness', { strain: 14.1, zonen: [2, 6, 18, 20, 12, 2] }),
  W(2, '2026-10-06T16:00:00Z', 50, 'running', { meter: 10_020, strain: 12.4 }),
  W(3, '2026-10-07T06:00:00Z', 55, 'Strength Trainer', { strain: 9.8 }),
  W(4, '2026-10-08T17:00:00Z', 90, 'Cycling', { meter: 40_000, strain: 13 }),
  W(5, '2026-10-09T06:00:00Z', 45, 'HIIT', { strain: 11 }),
  W(6, '2026-10-09T19:00:00Z', 20, 'Sauna', { strain: 2 }),
  W(7, '2026-10-10T09:00:00Z', 40, 'Walking', { strain: 4 }),
];

describe('Befund: WHOOP-Trainings landen in `training[]` — die alte Zählung sah sie nicht', () => {
  const s = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
  it('nur der Lauf mit Distanz wird ein Lauf; alles andere ein Training', () => {
    expect(s.laeufe).toHaveLength(1);
    expect(s.training).toHaveLength(6);
  });
  it('die alte Zählung (Hyrox + Läufe + Gym, bis 09.10. in wocheIst) zählte eine von fünf Einheiten', () => {
    const montag = '2026-10-05', ende = '2026-10-11', drin = (d: string) => d >= montag && d <= ende;
    const vorher = s.hyrox.filter(e => drin(e.datum)).length + s.laeufe.filter(l => drin(l.datum)).length + s.gym.einheiten.filter(e => drin(e.datum)).length;
    expect(vorher).toBe(1);
    // Jetzt: Functional + HIIT = Hyrox & Functional, Strength Trainer = Gym, Running = Laufen, Cycling = Rad; Sauna und Gehen zählen nicht.
    expect(wocheIst(s, montag)).toMatchObject({ einheiten: 5, hyrox: 2, gym: 1, lauf: 1, weitere: 1, km: 10, je: { rad: 1 } }); // km auf eine Stelle wie bisher
  });
  it('Plan/Ist und der erste Trainingstag kennen die Trainings', () => {
    expect(planIst(s, '2026-10-11', 1)[0].ist).toBe(5);
    expect(ersteEinheit(s)).toBe('2026-10-05');
  });
  it('Strain-Summe und Zonen der Woche — nur zählende Einheiten', () => {
    const w = summe(alleEinheiten(s));
    expect(w.strain).toBeCloseTo(14.1 + 12.4 + 9.8 + 13 + 11, 5);
    expect(w.zonenMin).toEqual([2, 6, 18, 20, 12, 2]);
    expect(w.minuten).toBe(60 + 50 + 55 + 90 + 45);
  });
  it('Startzeit in Ortszeit an Lauf und Training (für Anzeige und Doppel-Erkennung)', () => {
    expect(s.laeufe[0].uhrzeit).toBe('18:00');
    expect(s.training!.find(t => t.externeId === externeIdVon(uuid(1)))!.uhrzeit).toBe('07:30');
    expect(ortsUhrzeit('2026-10-09T22:30:00Z')).toBe('00:30'); // ohne Angabe: Berliner Zeit
  });
});

describe('EINE Zuordnungstabelle Sportart → Sparte', () => {
  it('Schlüssel aus den offiziellen Namen', () => {
    expect(sportSchluessel('Hiking/Rucking')).toBe('hiking-rucking');
    expect(sportSchluessel('Track & Field')).toBe('track-field');
    expect(sportSchluessel('Operations - Tactical')).toBe('operations-tactical');
    expect(sportSchluessel("Barry's")).toBe('barry-s');
    expect(sportSchluessel('F45 Training')).toBe('f45-training');
    expect(sportSchluessel('operations---tactical')).toBe('operations-tactical'); // so legt die Abbildung „Operations - Tactical“ ab
  });
  it('die Tabelle nennt nur offizielle WHOOP-Sportarten — und jeder Schlüssel ist schon in fester Form', () => {
    const offiziell = new Set(WHOOP_SPORTARTEN.map(sportSchluessel));
    for (const k of Object.keys(SPORT_ZUORDNUNG)) {
      expect(offiziell.has(k), k).toBe(true);
      expect(sportSchluessel(k)).toBe(k);
    }
  });
  it('unbekannt = Sonstiges (zählt); Erholung und Alltag zählen nicht', () => {
    expect(klasseVonSport('Underwater Hockey')).toBe('sonstiges');
    expect(klasseVonSport('Functional Fitness')).toBe('hyrox');
    expect(klasseVonSport('Sauna')).toBe('erholung');
    expect(klasseVonSport('walking')).toBe('alltag');
  });
  it('die eigene Zuordnung der Person gewinnt vor der Tabelle; „zählt als“ an der Einheit vor beidem', () => {
    let s = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
    s = wendeAn(s, { op: 'sportart', sport: 'walking', klasse: 'ausdauer' });
    expect(wocheIst(s, '2026-10-05').einheiten).toBe(6);
    const hiit = s.training!.find(t => t.sport === 'hiit')!;
    s = wendeAn(s, { op: 'training-anmerken', id: hiit.id, art: 'alltag' });
    expect(wocheIst(s, '2026-10-05').einheiten).toBe(5);
    expect(alleEinheiten(s).find(e => e.id === hiit.id)).toMatchObject({ klasse: 'alltag', zaehlt: false, eigeneZuordnung: true });
    s = wendeAn(s, { op: 'sportart', sport: 'walking', klasse: null });
    expect(s.sportArten).toBeUndefined();
  });
  it('Namen für die Anzeige', () => {
    expect(sportName('functional-fitness')).toBe('Functional Fitness');
    expect(sportName('strength-trainer')).toBe('Krafttraining');
    expect(sportName('rock-climbing')).toBe('Rock Climbing');
  });
  it('Übersicht der Sportarten aus Importen, häufigste zuerst, mit Vorgabe und eigener Zuordnung', () => {
    let s = sportAnwenden(leererStand(), [...WOCHE, W(8, '2026-10-11T08:00:00Z', 50, 'HIIT')], '2026-07-01').stand;
    s = wendeAn(s, { op: 'sportart', sport: 'sauna', klasse: 'mobility' });
    const u = sportartenUebersicht(s);
    expect(u[0]).toMatchObject({ schluessel: 'hiit', anzahl: 2, klasse: 'hyrox', eigen: false });
    expect(u.find(x => x.schluessel === 'sauna')).toMatchObject({ klasse: 'mobility', vorgabe: 'erholung', eigen: true });
  });
});

describe('Nichts doppelt: Hand und Import derselben Einheit', () => {
  const basis = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
  it('Gym von Hand + WHOOP „Strength Trainer“ am selben Tag → EINE Einheit, Hand führt, WHOOP-Messwerte dazu', () => {
    const s = wendeAn(basis, { op: 'gym', eintrag: { id: 'g1', datum: '2026-10-07', dauerMin: 50, notiz: 'Beine', uebungen: [{ uebung: 'kniebeuge', saetze: [{ kg: 60, wdh: 5 }] }] } });
    const am = alleEinheiten(s).filter(e => e.datum === '2026-10-07');
    expect(am).toHaveLength(1);
    expect(am[0]).toMatchObject({ id: 'g1', herkunft: 'gym', quelle: 'hand', auch: ['whoop'], strain: 9.8, dauerMin: 50, notiz: 'Beine' });
    expect(wocheIst(s, '2026-10-05').einheiten).toBe(5);
  });
  it('Hyrox-Einheit von Hand + WHOOP „Functional Fitness“ am selben Tag → eine', () => {
    const s = wendeAn(basis, { op: 'hyrox', eintrag: { id: 'h1', datum: '2026-10-05', art: 'simulation', stationen: { skierg: 250 }, laeufe: [] } });
    expect(alleEinheiten(s).filter(e => e.datum === '2026-10-05')).toHaveLength(1);
    expect(wocheIst(s, '2026-10-05').hyrox).toBe(2);
  });
  it('Lauf von Hand NACH dem WHOOP-Lauf (±10 %) → einer; 5 km von Hand und 10 km WHOOP → zwei', () => {
    const gleich = wendeAn(basis, { op: 'lauf', eintrag: { id: 'l-hand', datum: '2026-10-06', distanzKm: 10, dauerSek: 3100, art: 'tempo', gefuehl: 4 } });
    expect(gleich.laeufe).toHaveLength(2); // im Bestand beide — gezählt einer
    expect(wocheIst(gleich, '2026-10-05')).toMatchObject({ lauf: 1, km: 10 });
    expect(alleEinheiten(gleich).find(e => e.id === 'l-hand')).toMatchObject({ gefuehl: 4, strain: 12.4, auch: ['whoop'] });
    const anders = wendeAn(basis, { op: 'lauf', eintrag: { id: 'l-hand', datum: '2026-10-06', distanzKm: 5, dauerSek: 1500, art: 'locker' } });
    expect(wocheIst(anders, '2026-10-05')).toMatchObject({ lauf: 2, km: 15 });
  });
  it('zwei Importe derselben Einheit (z. B. später Strava): Start ≤ 20 min und Dauer ±10 % → eine; sonst zwei; dieselbe Quelle nie', () => {
    const t = (id: string, quelle: 'whoop' | 'strava', uhrzeit: string, dauerMin: number) => ({ id, datum: '2026-10-08', sport: 'cycling', dauerMin, quelle, externeId: `${quelle}:${id}`, uhrzeit });
    const s = (...x: ReturnType<typeof t>[]): SportStand => ({ ...leererStand(), training: x });
    expect(zaehlende(alleEinheiten(s(t('a', 'whoop', '19:00', 90), t('b', 'strava', '19:10', 88))))).toHaveLength(1);
    expect(zaehlende(alleEinheiten(s(t('a', 'whoop', '19:00', 90), t('b', 'strava', '19:40', 88))))).toHaveLength(2);
    expect(zaehlende(alleEinheiten(s(t('a', 'whoop', '19:00', 90), t('b', 'strava', '19:05', 60))))).toHaveLength(2);
    expect(zaehlende(alleEinheiten(s(t('a', 'whoop', '19:00', 90), t('b', 'whoop', '19:05', 90))))).toHaveLength(2);
    expect(alleEinheiten(s(t('b', 'strava', '19:10', 88), t('a', 'whoop', '19:00', 90)))[0]).toMatchObject({ id: 'a', auch: ['strava'] });
  });
});

describe('Was die Person setzt, übersteht jeden Abgleich', () => {
  it('„zählt als“, Gefühl und Notiz bleiben; der Abgleich meldet keine Änderung', () => {
    let s = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
    const id = s.training!.find(t => t.sport === 'functional-fitness')!.id;
    s = wendeAn(s, { op: 'training-anmerken', id, art: 'hyrox', gefuehl: 2, notiz: 'Wall Balls zäh' });
    const r = sportAnwenden(saeubere(JSON.parse(JSON.stringify(s))), WOCHE, '2026-07-01');
    expect(r.neu + r.geaendert + r.entfernt).toBe(0);
    expect(r.stand.training!.find(t => t.id === id)).toMatchObject({ art: 'hyrox', gefuehl: 2, notiz: 'Wall Balls zäh', strain: 14.1 });
    // geänderte Messwerte bei WHOOP: die Werte ziehen nach, die Person-Felder bleiben
    const neu = sportAnwenden(r.stand, WOCHE.map(w => (w.sport === 'functional-fitness' ? { ...w, strain: 15 } : w)), '2026-07-01');
    expect(neu.geaendert).toBe(1);
    expect(neu.stand.training!.find(t => t.id === id)).toMatchObject({ strain: 15, gefuehl: 2, notiz: 'Wall Balls zäh', art: 'hyrox' });
  });
  it('Leeren mit null', () => {
    let s = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
    const id = s.training![0].id;
    s = wendeAn(s, { op: 'training-anmerken', id, gefuehl: 3, notiz: 'x' });
    s = wendeAn(s, { op: 'training-anmerken', id, gefuehl: null, notiz: null });
    expect(s.training!.find(t => t.id === id)!.gefuehl).toBeUndefined();
    expect(s.training!.find(t => t.id === id)!.notiz).toBeUndefined();
  });
});

describe('Training von Hand', () => {
  it('anlegen braucht Datum, Sportart, Dauer und eine Sparte; zählt dann mit', () => {
    expect(() => wendeAn(leererStand(), { op: 'training', eintrag: { id: 'tr-1', datum: '2026-10-08', sport: 'Rad', dauerMin: 60 } })).toThrow(/Sparte|zählt/);
    const s = wendeAn(leererStand(), { op: 'training', eintrag: { id: 'tr-1', datum: '2026-10-08', sport: 'Rad zur Arbeit', dauerMin: 60, art: 'rad', gefuehl: 4, quelle: 'whoop', externeId: 'whoop:x' } });
    expect(s.training![0]).toMatchObject({ quelle: 'hand', art: 'rad', gefuehl: 4 });
    expect(s.training![0].externeId).toBeUndefined();
    expect(wocheIst(s, '2026-10-05')).toMatchObject({ einheiten: 1, je: { rad: 1 } });
    expect(alleEinheiten(s)[0]).toMatchObject({ titel: 'Rad zur Arbeit', quelle: 'hand' });
  });
  it('Importe lassen sich weder überschreiben noch löschen (kämen beim Abgleich wieder) — nur Hand-Einträge', () => {
    const s = sportAnwenden(leererStand(), WOCHE, '2026-07-01').stand;
    const imp = s.training![0];
    expect(() => wendeAn(s, { op: 'training', eintrag: { ...imp, art: 'rad' } })).toThrow(/Importierte/);
    expect(() => wendeAn(s, { op: 'training-weg', id: imp.id })).toThrow(/Alltag/);
    const h = wendeAn(s, { op: 'training', eintrag: { id: 'tr-1', datum: '2026-10-08', sport: 'Yoga', dauerMin: 30, art: 'mobility' } });
    expect(wendeAn(h, { op: 'training-weg', id: 'tr-1' }).training!.some(t => t.id === 'tr-1')).toBe(false);
  });
  it('die eigene Zuordnung nimmt nur gültige Schlüssel und Sparten', () => {
    expect(() => wendeAn(leererStand(), { op: 'sportart', sport: '../x', klasse: 'lauf' })).toThrow();
    expect(() => wendeAn(leererStand(), { op: 'sportart', sport: 'hiit', klasse: 'quatsch' as never })).toThrow();
    expect(saeubere({ sportArten: { 'hiit': 'gym', 'B A D': 'gym', 'yoga': 'quatsch' } }).sportArten).toEqual({ hiit: 'gym' });
    expect(saeubere({}).sportArten).toBeUndefined(); // alter Stand bleibt bit-gleich
  });
});

describe('Liste je Woche', () => {
  it('neueste Woche zuerst, leere Wochen fallen weg, je Woche die Summe', () => {
    const s = sportAnwenden(leererStand(), [...WOCHE, W(9, '2026-09-22T06:00:00Z', 30, 'Yoga')], '2026-07-01').stand;
    const l = wochenListe(alleEinheiten(s), '2026-10-11', 4);
    expect(l.map(w => w.montag)).toEqual(['2026-10-05', '2026-09-21']);
    expect(l[0].summe.einheiten).toBe(5);
    expect(l[0].einheiten).toHaveLength(7); // Sauna und Gehen stehen in der Liste, zählen aber nicht
    expect(l[1].summe).toMatchObject({ einheiten: 1, je: { mobility: 1 } });
  });
});

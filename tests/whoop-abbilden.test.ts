// WHOOP je Person — reine Teile (lib/whoop/abbilden.ts, webhook.ts, konfig.ts, verbindung.ts): Tageszuordnung, Handwert gewinnt,
// Sport idempotent ohne Dubletten, Signatur nach der Doku, Körper der Webhooks, state-Form, Konfiguration ohne festen localhost.
import { describe, it, expect } from 'vitest';
import { recoveryAus, schlafAus, zyklusAus, workoutAus, tageswerte, vitalsAnwenden, sportAnwenden, ortsTag, externeIdVon, zyklusTag, zonenAus, type WhoopSpiegelDaten } from '@/lib/whoop/abbilden';
import { signaturGueltig, signieren, meldungAus } from '@/lib/whoop/webhook';
import { whoopKonfig, whoopFehlt, WHOOP_SCOPES, whoopHost } from '@/lib/whoop/konfig';
import { neuerState, STATE_FORM, autorisierungsUrl } from '@/lib/whoop/verbindung';
import { leererStand, saeubere } from '@/lib/sport/modell';
import { schlaf, erholung, zyklus, training, uuid } from './fixtures/whoop-fake';
import type { VitalsLog } from '@/lib/vitals';

const spiegel = (x: { s?: unknown[]; r?: unknown[]; z?: unknown[]; w?: unknown[] }): WhoopSpiegelDaten => {
  const d: WhoopSpiegelDaten = { recovery: {}, schlaf: {}, zyklen: {}, workouts: {} };
  for (const r of x.s ?? []) { const v = schlafAus(r)!; d.schlaf[v.id] = v; }
  for (const r of x.r ?? []) { const v = recoveryAus(r)!; d.recovery[v.sleepId] = v; }
  for (const r of x.z ?? []) { const v = zyklusAus(r)!; d.zyklen[String(v.id)] = v; }
  for (const r of x.w ?? []) { const v = workoutAus(r)!; d.workouts[v.id] = v; }
  return d;
};

describe('Rohdaten v2 → Spiegel', () => {
  it('nur SCORED trägt Werte; UUIDs klein; Unsinn fällt weg', () => {
    expect(recoveryAus(erholung(1, '2026-10-07T05:30:00Z', 72))).toMatchObject({ sleepId: uuid(1), rec: 72, hrv: 61, rhr: 52, spo2: 96.2, hautTemp: 33.71, state: 'SCORED' });
    expect(recoveryAus(erholung(2, '2026-10-07T05:30:00Z', 72, { state: 'PENDING_SCORE' }))?.rec).toBeUndefined();
    expect(recoveryAus({ sleep_id: 'kein-uuid', created_at: '2026-10-07T05:30:00Z' })).toBeNull();
    expect(schlafAus({ id: uuid(3), start: 'gestern', end: 'heute' })).toBeNull();
    expect(workoutAus(training(4, '2026-10-07T16:00:00Z', 0, 'running'))).toBeNull(); // Ende = Start
    expect(workoutAus(training(5, '2026-10-07T16:00:00Z', 45, 'Functional Fitness'))?.sport).toBe('functional-fitness');
  });
  it('Ortstag über timezone_offset (kurz nach Mitternacht Ortszeit = neuer Tag)', () => {
    expect(ortsTag('2026-10-06T22:30:00Z', '+02:00')).toBe('2026-10-07');
    expect(ortsTag('2026-10-07T03:30:00Z', '-05:00')).toBe('2026-10-06');
    expect(ortsTag('2026-10-06T22:30:00Z')).toBe('2026-10-07'); // ohne Angabe: Berliner Tag
  });
});

describe('Tageswerte', () => {
  it('Hauptschlaf (kein Nickerchen) + Recovery dieses Schlafs am Tag des Aufwachens; Strain am Starttag', () => {
    const d = spiegel({
      s: [schlaf(1, '2026-10-07T05:00:00Z', { stunden: 7.5 }), schlaf(2, '2026-10-07T13:00:00Z', { nap: true, stunden: 0.5 })],
      r: [erholung(1, '2026-10-07T05:05:00Z', 81), erholung(2, '2026-10-07T13:05:00Z', 40)],
      z: [zyklus(9, '2026-10-06T22:00:00Z', 12.4)],
    });
    // 09.10.: dazu alle weiteren Größen des Hauptschlafs, seiner Recovery und des Zyklus (Nickerchen und seine Recovery zählen nicht).
    expect(tageswerte(d)['2026-10-07']).toEqual({
      sleep: 7.5, rec: 81, hrv: 61, rhr: 52, strain: 12.4,
      phaseLeicht: 3.75, phaseTief: 1.88, phaseRem: 1.88, phaseWach: 0.5, schlafLeistung: 91, schlafKonsistenz: 80, schlafEffizienz: 93, atem: 15, stoerungen: 3,
      spo2: 96.2, hautTemp: 33.71, kcal: 2151,
    });
  });
});

// ─── 09.10.: alle sinnvollen v2-Größen (Kevin: „Strain wird nicht angezeigt“ → „mit allen Daten, die du bekommen kannst“) ─────────
describe('Weitere WHOOP-Größen (09.10.)', () => {
  it('Schlafbedarf = Basis + Schuld + Belastung + Nickerchen (Nickerchen senkt, nie unter 0); Spiegel trägt Atem, Konsistenz, Störungen, Zyklen', () => {
    const s = schlafAus(schlaf(1, '2026-10-07T05:00:00Z', { bedarf: { basis: 7.5, schuld: 0.5, last: 0.25, nap: -0.25 } }))!;
    expect(s).toMatchObject({ bedarfMs: 8 * 3_600_000, schuldMs: 0.5 * 3_600_000, atem: 15, konsistenz: 80, stoerungen: 3, zyklen: 4 });
    expect(schlafAus(schlaf(2, '2026-10-07T05:00:00Z', { bedarf: { basis: 0.5, nap: -2 } }))!.bedarfMs).toBe(0);
    expect(schlafAus(schlaf(3, '2026-10-07T05:00:00Z'))!.bedarfMs).toBeUndefined(); // ohne `sleep_needed` keine Angabe
    expect(tageswerte(spiegel({ s: [schlaf(1, '2026-10-07T05:00:00Z', { bedarf: { basis: 7.5, schuld: 0.5, last: 0.25, nap: -0.25 } })] }))['2026-10-07'].schlafBedarf).toBe(8);
  });
  it('Recovery: Kalibrierung wird gemerkt; nicht bewertete Recovery trägt keine Werte', () => {
    expect(recoveryAus({ ...erholung(1, '2026-10-07T05:30:00Z', 70), score: { ...erholung(1, '2026-10-07T05:30:00Z', 70).score, user_calibrating: true } })?.kal).toBe(true);
    expect(recoveryAus(erholung(1, '2026-10-07T05:30:00Z', 70))?.kal).toBeUndefined();
    expect(recoveryAus(erholung(2, '2026-10-07T05:30:00Z', 70, { state: 'PENDING_SCORE' }))).not.toHaveProperty('spo2');
  });
  it('Schritte stehen oben am Zyklus — auch im laufenden (noch nicht bewerteten) Zyklus; nie bei UNSCORABLE; Strain/kcal nur bewertet', () => {
    expect(zyklusAus(zyklus(5, '2026-10-07T05:00:00Z', 8.1, { schritte: 8234 }))?.schritte).toBe(8234);
    const offen = zyklusAus(zyklus(6, '2026-10-08T05:00:00Z', 3, { schritte: 1200, state: 'PENDING_SCORE' }))!;
    expect(offen).toMatchObject({ schritte: 1200, state: 'PENDING_SCORE' });
    expect(offen.strain).toBeUndefined();
    expect(zyklusAus(zyklus(7, '2026-10-09T05:00:00Z', 3, { schritte: 500, state: 'UNSCORABLE' }))?.schritte).toBeUndefined();
    expect(tageswerte(spiegel({ z: [zyklus(6, '2026-10-08T05:00:00Z', 3, { schritte: 1200, state: 'PENDING_SCORE' })] }))['2026-10-08']).toEqual({ schritte: 1200 });
  });
  it('Zyklus-Tag: Start ab 18 Uhr Ortszeit zählt zum Folgetag, sonst der Starttag (Strain von heute steht bei heute)', () => {
    expect(zyklusTag({ start: '2026-10-08T21:30:00Z', tz: '+02:00' })).toBe('2026-10-09'); // 23:30 Ortszeit → nächster Tag
    expect(zyklusTag({ start: '2026-10-08T16:00:00Z', tz: '+02:00' })).toBe('2026-10-09'); // 18:00 Ortszeit → nächster Tag
    expect(zyklusTag({ start: '2026-10-08T15:59:00Z', tz: '+02:00' })).toBe('2026-10-08'); // 17:59 → derselbe Tag
    expect(zyklusTag({ start: '2026-10-09T05:10:00Z', tz: '+02:00' })).toBe('2026-10-09'); // Start am Morgen → derselbe Tag
    expect(zyklusTag({ start: '2026-10-08T22:30:00Z', tz: '+02:00' })).toBe('2026-10-09'); // kurz nach Mitternacht → derselbe (Orts-)Tag
    expect(zyklusTag({ start: '2026-10-09T03:00:00Z', tz: '-05:00' })).toBe('2026-10-09'); // 22:00 Ortszeit am 08.10. → 09.10.
    expect(zyklusTag({ start: '2026-10-08T17:00:00Z' })).toBe('2026-10-09'); // ohne Angabe: Berliner Zeit (19:00) → nächster Tag
  });
  it('Workout: Höhenmeter, Anteil aufgezeichnet, Minuten je Zone (sechs Werte); leeres zone_durations = keine Angabe', () => {
    const w = workoutAus(training(20, '2026-10-07T16:00:00Z', 60, 'Functional Fitness', { zonen: [5, 10, 20, 15, 8, 2] }))!;
    expect(w).toMatchObject({ hoeheM: 10, erfasst: 100, zonenMs: [5, 10, 20, 15, 8, 2].map(m => m * 60_000) });
    expect(zonenAus({})).toBeUndefined();
    expect(workoutAus(training(21, '2026-10-07T16:00:00Z', 60, 'yoga'))!.zonenMs).toBeUndefined();
  });
  it('Lauf und Training tragen die Messwerte (Strain, kcal, Puls, Zonen, Höhe) — übersteht die Säuberung, zweiter Lauf ändert nichts', () => {
    const ws = Object.values(spiegel({ w: [training(30, '2026-10-06T16:00:00Z', 50, 'running', { meter: 10_020, zonen: [1, 4, 25, 15, 5, 0] }), training(31, '2026-10-07T07:00:00Z', 60, 'Functional Fitness', { zonen: [0, 5, 20, 20, 10, 5] })] }).workouts);
    const r = sportAnwenden(leererStand(), ws, '2026-07-01');
    expect(r.stand.laeufe[0]).toMatchObject({ strain: 11.2, kcal: 500, pulsSchnitt: 140, pulsMax: 172, zonenMin: [1, 4, 25, 15, 5, 0], hoeheM: 10 });
    expect(r.stand.training?.[0]).toMatchObject({ zonenMin: [0, 5, 20, 20, 10, 5], hoeheM: 10 });
    const gesaeubert = saeubere(JSON.parse(JSON.stringify(r.stand)));
    expect(gesaeubert).toEqual(r.stand);
    // Nach der Säuberung (andere Reihenfolge der Schlüssel) zählt nichts als geändert (vorher: jedes Training jedes Mal).
    const b = sportAnwenden(gesaeubert, ws, '2026-07-01');
    expect(b.neu + b.geaendert + b.entfernt).toBe(0);
  });
  it('Lauf von WHOOP nachbewertet: Messwerte ziehen nach, Gefühl und Notiz der Person bleiben', () => {
    const roh = (strain: number) => Object.values(spiegel({ w: [training(30, '2026-10-06T16:00:00Z', 50, 'running', { meter: 10_020, strain })] }).workouts);
    const a = sportAnwenden(leererStand(), roh(11.2), '2026-07-01').stand;
    a.laeufe[0] = { ...a.laeufe[0], gefuehl: 5, notiz: 'flog' };
    const b = sportAnwenden(a, roh(12.9), '2026-07-01');
    expect(b.geaendert).toBe(1);
    expect(b.stand.laeufe[0]).toMatchObject({ strain: 12.9, gefuehl: 5, notiz: 'flog' });
  });
  it('neue Felder in den Vitalwerten: WHOOP füllt sie (Herkunft whoop); ein Wert ohne Herkunft bleibt — Handwert gewinnt je Feld', () => {
    const werte = { '2026-10-07': { strain: 12.4, kcal: 2151, spo2: 96.2, schlafBedarf: 8 } };
    const a = vitalsAnwenden({ '2026-10-07': { strain: 9, rec: 70, quellen: { rec: 'hand' } } }, werte, '2026-07-01');
    expect(a.log['2026-10-07']).toEqual({ strain: 9, rec: 70, kcal: 2151, spo2: 96.2, schlafBedarf: 8, quellen: { rec: 'hand', kcal: 'whoop', spo2: 'whoop', schlafBedarf: 'whoop' } });
    // Bei WHOOP gelöscht → nur die WHOOP-Felder fallen weg.
    expect(vitalsAnwenden(a.log, {}, '2026-07-01').log['2026-10-07']).toEqual({ strain: 9, rec: 70, quellen: { rec: 'hand' } });
  });
});

describe('Vitalwerte: Handwert gewinnt', () => {
  const werte = { '2026-10-07': { rec: 81, sleep: 7.5, hrv: 61, rhr: 52 } };
  it('leere Felder füllt WHOOP und markiert sie; ein Handwert bleibt unverändert', () => {
    const log: VitalsLog = { '2026-10-07': { rec: 55, quellen: { rec: 'hand' } } };
    const r = vitalsAnwenden(log, werte, '2026-07-01');
    expect(r.log['2026-10-07']).toEqual({ rec: 55, sleep: 7.5, hrv: 61, rhr: 52, quellen: { rec: 'hand', sleep: 'whoop', hrv: 'whoop', rhr: 'whoop' } });
  });
  it('Werte ohne Markierung (Altbestand, Export) gelten als Handwerte', () => {
    const r = vitalsAnwenden({ '2026-10-07': { rec: 60, note: 'müde' } }, werte, '2026-07-01');
    expect(r.log['2026-10-07'].rec).toBe(60);
    expect(r.log['2026-10-07'].note).toBe('müde');
  });
  it('WHOOP-Werte zieht WHOOP nach; zweiter Lauf ändert nichts (idempotent)', () => {
    const a = vitalsAnwenden({}, werte, '2026-07-01');
    const b = vitalsAnwenden(a.log, { '2026-10-07': { ...werte['2026-10-07'], rec: 84 } }, '2026-07-01');
    expect(b.log['2026-10-07'].rec).toBe(84);
    expect(vitalsAnwenden(b.log, { '2026-10-07': { ...werte['2026-10-07'], rec: 84 } }, '2026-07-01').geaendert).toBe(0);
  });
  // Kevin 08.10. (Phase 0): „WHOOP ist die Quelle; Werte aus dem alten Export: Schnittstelle gewinnt, nur echte Handeingaben bleiben.“
  it('Export-Werte (`whoop-export`) überschreibt die Schnittstelle; Handwerte bleiben', () => {
    const log: VitalsLog = { '2026-10-07': { rec: 70, sleep: 6.9, hrv: 55, rhr: 60, quellen: { rec: 'whoop-export', sleep: 'whoop-export', hrv: 'hand' } } };
    const r = vitalsAnwenden(log, werte, '2026-07-01');
    expect(r.log['2026-10-07']).toEqual({ rec: 81, sleep: 7.5, hrv: 55, rhr: 60, quellen: { rec: 'whoop', sleep: 'whoop', hrv: 'hand' } });
  });
  it('Altbestand ohne Herkunft bleibt unberührt — auch ein GENAU gleicher Wert (Gegenprüfung 08.10.: könnte abgetippt sein, nie geraten)', () => {
    const r = vitalsAnwenden({ '2026-10-07': { rec: 81, sleep: 7.2, note: 'müde' } }, werte, '2026-07-01');
    expect(r.log['2026-10-07']).toEqual({ rec: 81, sleep: 7.2, hrv: 61, rhr: 52, note: 'müde', quellen: { hrv: 'whoop', rhr: 'whoop' } });
    // Neubewertung bei WHOOP überschreibt den gleichen Altwert NICHT, und ein Löschen bei WHOOP entfernt ihn nicht.
    const b = vitalsAnwenden(r.log, { '2026-10-07': { ...werte['2026-10-07'], rec: 79 } }, '2026-07-01');
    expect(b.log['2026-10-07']).toMatchObject({ rec: 81, sleep: 7.2 });
    expect(vitalsAnwenden(r.log, {}, '2026-07-01').log['2026-10-07']).toEqual({ rec: 81, sleep: 7.2, note: 'müde' });
  });
  it('gelöscht bei WHOOP → nur Werte der Schnittstelle fallen weg, Export-Werte bleiben', () => {
    const log: VitalsLog = { '2026-10-07': { rec: 70, hrv: 50, quellen: { rec: 'whoop-export', hrv: 'whoop' } } };
    expect(vitalsAnwenden(log, {}, '2026-07-01').log['2026-10-07']).toEqual({ rec: 70, quellen: { rec: 'whoop-export' } });
  });
  it('gelöscht bei WHOOP → nur WHOOP-Felder fallen weg, nur ab dem Spiegel-Anfang', () => {
    const log: VitalsLog = { '2026-10-07': { rec: 81, sleep: 6, quellen: { rec: 'whoop', sleep: 'hand' } }, '2026-01-02': { rec: 70, quellen: { rec: 'whoop' } } };
    const r = vitalsAnwenden(log, {}, '2026-07-01');
    expect(r.log['2026-10-07']).toEqual({ sleep: 6, quellen: { sleep: 'hand' } });
    expect(r.log['2026-01-02']).toEqual(log['2026-01-02']); // vor dem Spiegel-Anfang: bleibt
  });
});

describe('Workouts → Sport', () => {
  const lauf = training(10, '2026-10-06T16:00:00Z', 50, 'running', { meter: 10_020 });
  const kraft = training(11, '2026-10-07T07:00:00Z', 60, 'Functional Fitness');
  const ws = Object.values(spiegel({ w: [lauf, kraft] }).workouts);
  it('Lauf mit Distanz → Lauf, sonst Training — quelle whoop + externeId', () => {
    const r = sportAnwenden(leererStand(), ws, '2026-07-01');
    expect(r.neu).toBe(2);
    expect(r.stand.laeufe[0]).toMatchObject({ datum: '2026-10-06', distanzKm: 10.02, dauerSek: 3000, quelle: 'whoop', externeId: externeIdVon(uuid(10)) });
    expect(r.stand.training?.[0]).toMatchObject({ datum: '2026-10-07', sport: 'functional-fitness', dauerMin: 60, strain: 11.2, kcal: 500, quelle: 'whoop', externeId: externeIdVon(uuid(11)) });
    // übersteht die Säuberung des Sport-Bestands (sonst fiele es beim nächsten Speichern weg)
    expect(saeubere(JSON.parse(JSON.stringify(r.stand)))).toEqual(r.stand);
  });
  it('zweiter Lauf: keine Dubletten; was die Person am Lauf setzte (Gefühl, Notiz), bleibt', () => {
    const a = sportAnwenden(leererStand(), ws, '2026-07-01').stand;
    a.laeufe[0] = { ...a.laeufe[0], gefuehl: 4, notiz: 'locker' };
    const b = sportAnwenden(a, ws, '2026-07-01');
    expect(b.neu + b.geaendert + b.entfernt).toBe(0);
    expect(b.stand.laeufe).toHaveLength(1);
    expect(b.stand.laeufe[0]).toMatchObject({ gefuehl: 4, notiz: 'locker' });
  });
  it('ein von Hand erfasster Lauf am selben Tag (±10 %) zählt als derselbe', () => {
    const s = { ...leererStand(), laeufe: [{ id: 'l-hand', datum: '2026-10-06', distanzKm: 10, dauerSek: 3100, art: 'locker' as const, quelle: 'hand' as const }] };
    const r = sportAnwenden(s, ws, '2026-07-01');
    expect(r.stand.laeufe).toHaveLength(1);
    expect(r.stand.laeufe[0].id).toBe('l-hand');
  });
  it('bei WHOOP gelöscht → nur der WHOOP-Eintrag fällt weg, Handeinträge nie', () => {
    const a = sportAnwenden({ ...leererStand(), laeufe: [{ id: 'l-hand', datum: '2026-10-01', distanzKm: 5, dauerSek: 1500, art: 'locker', quelle: 'hand' }] }, ws, '2026-07-01').stand;
    const b = sportAnwenden(a, [], '2026-07-01');
    expect(b.entfernt).toBe(2);
    expect(b.stand.laeufe.map(l => l.id)).toEqual(['l-hand']);
    expect(b.stand.training).toBeUndefined();
  });
});

describe('Webhook (Doku: base64 HMAC-SHA256 über Zeitstempel + Rohkörper, Client Secret)', () => {
  const roh = Buffer.from(JSON.stringify({ user_id: 4711, id: uuid(1), type: 'sleep.updated', trace_id: 'tr-1' }));
  it('richtige Signatur gilt, jede Abweichung nicht', () => {
    const sig = signieren(roh, '1759900000000', 'geheim');
    expect(signaturGueltig(roh, '1759900000000', sig, 'geheim')).toBe(true);
    expect(signaturGueltig(roh, '1759900000001', sig, 'geheim')).toBe(false);
    expect(signaturGueltig(Buffer.concat([roh, Buffer.from(' ')]), '1759900000000', sig, 'geheim')).toBe(false);
    expect(signaturGueltig(roh, '1759900000000', sig, 'anderes')).toBe(false);
    expect(signaturGueltig(roh, null, sig, 'geheim')).toBe(false);
    expect(signaturGueltig(roh, '1759900000000', 'kaputt', 'geheim')).toBe(false);
  });
  it('Körper nur in der belegten Form', () => {
    expect(meldungAus(roh)).toEqual({ userId: 4711, id: uuid(1), art: 'sleep.updated', spur: 'tr-1' });
    expect(meldungAus(Buffer.from(JSON.stringify({ user_id: 4711, id: 5, type: 'sleep.updated', trace_id: 'x' })))).toBeNull(); // v1-ID
    expect(meldungAus(Buffer.from(JSON.stringify({ user_id: 4711, id: uuid(1), type: 'cycle.updated', trace_id: 'x' })))).toBeNull();
    expect(meldungAus(Buffer.from('kein json'))).toBeNull();
  });
});

describe('Konfiguration und Anmeldeseite', () => {
  it('ohne Werte aus — und nennt nur NAMEN; Rückruf aus der Umgebung, nie ein fester localhost', () => {
    expect(whoopKonfig({})).toBeNull();
    expect(whoopFehlt({})).toEqual(['WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET', 'WHOOP_RUECKRUF_URL oder MAKE_OS_ADRESSE']);
    expect(whoopKonfig({ WHOOP_CLIENT_ID: 'id', WHOOP_CLIENT_SECRET: 's' })).toBeNull();
    expect(whoopKonfig({ WHOOP_CLIENT_ID: 'id', WHOOP_CLIENT_SECRET: 's', MAKE_OS_ADRESSE: 'https://app.beispiel.test/' })?.rueckrufUrl).toBe('https://app.beispiel.test/api/whoop/rueckruf');
    expect(whoopKonfig({ WHOOP_CLIENT_ID: 'id', WHOOP_CLIENT_SECRET: 's', WHOOP_RUECKRUF_URL: 'https://x.test/api/whoop/rueckruf' })?.rueckrufUrl).toBe('https://x.test/api/whoop/rueckruf');
  });
  it('state: genau 8 Zeichen (Doku), zufällig; Scopes minimal (kein body_measurement), offline für das Refresh-Token', () => {
    const s = new Set(Array.from({ length: 200 }, () => neuerState()));
    expect(s.size).toBeGreaterThan(195);
    for (const x of s) expect(x).toMatch(STATE_FORM);
    const q = new URL(autorisierungsUrl({ clientId: 'id', clientSecret: 's', rueckrufUrl: 'https://x.test/api/whoop/rueckruf' }, 'Ab3dEf7h')).searchParams;
    expect(q.get('response_type')).toBe('code');
    expect(q.get('state')).toBe('Ab3dEf7h');
    expect(q.get('scope')?.split(' ')).toEqual([...WHOOP_SCOPES]);
    expect(WHOOP_SCOPES).toContain('offline');
    expect(WHOOP_SCOPES).not.toContain('read:body_measurement');
  });
  it('Zugangsdaten gehen nur an api.prod.whoop.com über HTTPS', () => {
    expect(whoopHost('https://api.prod.whoop.com/developer/v2/cycle')).toBe(true);
    expect(whoopHost('http://api.prod.whoop.com/x')).toBe(false);
    expect(whoopHost('https://api.prod.whoop.com.boese.test/x')).toBe(false);
  });
});

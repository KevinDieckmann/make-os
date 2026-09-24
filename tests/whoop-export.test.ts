import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'zlib';
import { zipEintrag, zyklenLesen, einmischen, istZyklenDatei, tagDesZyklus } from '@/lib/whoop-export';

/** Minimales ZIP bauen — gespeichert (0) oder deflate (8). */
function zipBauen(dateien: { name: string; text: string; deflate?: boolean }[]): Buffer {
  const lokale: Buffer[] = []; const zentral: Buffer[] = []; let off = 0;
  for (const d of dateien) {
    const roh = Buffer.from(d.text, 'utf8'); const daten = d.deflate ? deflateRawSync(roh) : roh; const name = Buffer.from(d.name, 'utf8');
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(d.deflate ? 8 : 0, 8); lh.writeUInt32LE(daten.length, 18); lh.writeUInt32LE(roh.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(d.deflate ? 8 : 0, 10); ch.writeUInt32LE(daten.length, 20); ch.writeUInt32LE(roh.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    lokale.push(lh, name, daten); zentral.push(ch, name); off += 30 + name.length + daten.length;
  }
  const cd = Buffer.concat(zentral); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(dateien.length, 8); eocd.writeUInt16LE(dateien.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...lokale, cd, eocd]);
}

const KOPF = 'Startzeit des Zyklus,Endzeit des Zyklus,Zeitzone des Zyklus,Erholungswert %,Ruheherzfrequenz (Schläge pro Minute),Herzfrequenzvariabilität (ms),Schlafdauer (Min.)';

describe('Whoop-Export', () => {
  it('liest die Zyklen-Tabelle aus einem ZIP (gespeichert und deflate)', () => {
    const csv = `${KOPF}\n2026-09-24 01:30:00,,UTC+02:00,72,50,101,420`;
    for (const deflate of [false, true]) {
      const zip = zipBauen([{ name: 'Schlaf.csv', text: 'x', deflate }, { name: 'physiologische_zyklen.csv', text: csv, deflate }]);
      expect(zipEintrag(zip, istZyklenDatei)).toBe(csv);
    }
    expect(zipEintrag(zipBauen([{ name: 'Schlaf.csv', text: 'x' }]), istZyklenDatei)).toBeNull();
    expect(zipEintrag(Buffer.from('kein zip'), istZyklenDatei)).toBeNull();
  });

  it('macht Tageswerte daraus: Recovery, Puls, HRV, Schlaf in Stunden; erster Treffer je Tag gewinnt', () => {
    const r = zyklenLesen(`${KOPF}\n2026-09-24 01:30:00,,UTC+02:00,72,50,101,420\n2026-09-24 00:10:00,,UTC+02:00,10,90,20,60\n2026-09-23 02:00:00,,UTC+02:00,,,,\n2026-09-22 01:00:00,,UTC+02:00,55,52,88,"390"`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tage['2026-09-24']).toEqual({ rec: 72, rhr: 50, hrv: 101, sleep: 7 });
    expect(r.tage['2026-09-22']).toEqual({ rec: 55, rhr: 52, hrv: 88, sleep: 6.5 });
    expect(r.tage['2026-09-23']).toBeUndefined();
    expect(r.ohneWerte).toBe(1);
  });

  it('versteht auch den englischen Export und verwirft unsinnige Werte', () => {
    const r = zyklenLesen('Cycle start time,Recovery score %,Resting heart rate (bpm),Heart rate variability (ms),Asleep duration (min)\n2026-09-24 01:00:00,140,55,70,480');
    expect(r.ok && r.tage['2026-09-24']).toEqual({ rhr: 55, hrv: 70, sleep: 8 });
  });

  it('lehnt fremde Tabellen ab', () => {
    const r = zyklenLesen('Startzeit des Zyklus,Endzeit des Zyklus,Fragetext\n2026-09-24,,Hast du Alkohol getrunken?');
    expect(r.ok).toBe(false);
  });

  it('mischt ein: Messwerte neu, eigene Notizen bleiben', () => {
    const { log, neu, aktualisiert } = einmischen({ '2026-09-23': { rec: 40, note: 'schlecht geschlafen' } }, { '2026-09-23': { rec: 61 }, '2026-09-24': { rec: 72 } });
    expect(log['2026-09-23']).toEqual({ rec: 61, note: 'schlecht geschlafen' });
    expect(log['2026-09-24']).toEqual({ rec: 72 });
    expect([neu, aktualisiert]).toEqual([1, 1]);
  });

  it('ordnet einen Zyklus dem Tag des Aufwachens zu, nicht dem Einschlafen', () => {
    expect(tagDesZyklus('2026-09-23 23:42:42', '2026-09-24 07:10:00')).toBe('2026-09-24');
    expect(tagDesZyklus('2026-09-23 00:26:42', '2026-09-23 08:02:00')).toBe('2026-09-23');
    expect(tagDesZyklus('2026-09-30 23:10:00', '')).toBe('2026-10-01');
    expect(tagDesZyklus('2026-09-23 01:00:00')).toBe('2026-09-23');
    const kopf = 'Startzeit des Zyklus,Erholungswert %,Beginn des Aufwachens';
    const r = zyklenLesen(`${kopf}\n2026-09-23 23:42:42,27,2026-09-24 07:10:00\n2026-09-23 00:26:42,1,2026-09-23 08:02:00`);
    expect(r.ok && r.tage).toEqual({ '2026-09-24': { rec: 27 }, '2026-09-23': { rec: 1 } });
  });
});

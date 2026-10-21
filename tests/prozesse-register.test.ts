// ─── Prozesse · Register der System-Prozesse (Etappe A, 21.10.; ANALYSE_100.md Punkte 4, 5, 7, 9, 74 — Entscheidung E3) ─────────────────────
// Wächter: jeder Eintrag ist vollständig (Steckbrief mit sechs Feldern, Phasen, Schritte in festen Formen), Zweige zeigen nur in die eigene Phase,
// Übergaben nur auf bekannte Prozesse, Links nur auf echte Seiten unter /os, nichts Persönliches (Plattform-Regel), die Fliege hat jede Stufe besetzt,
// Event-Nachfassen in 48 Stunden (Punkt 74) ist da und zählt.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { BAENDER, KERN_STUFEN, STECKBRIEF_FELDER } from '@/lib/prozesse/typen';
import { SEITEN_SUCHE } from '@/lib/make-one/seiten';
import { alsVorlage, endeSchritte, neinVon, wurzelKennung, abstimmungKennung } from '@/lib/prozesse/modell';
import { flaecheBild } from '@/lib/fulfillment/prozesse/flaeche';

const FORMEN = ['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin'];

describe('Register der System-Prozesse', () => {
  it('Kennungen eindeutig, alle „System“, Band gültig, im Kern immer eine Stufe — jede Stufe der Fliege und jedes Band besetzt', () => {
    const ids = SYSTEM_PROZESSE.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SYSTEM_PROZESSE) {
      expect(p.id).toMatch(/^sp-[a-z0-9-]+$/);
      expect(p.quelle).toBe('system');
      expect(BAENDER.map(b => b.id)).toContain(p.band);
      if (p.band === 'kern') expect(KERN_STUFEN.map(s => s.id), p.id).toContain(p.stufe);
      else expect(p.stufe, p.id).toBeUndefined();
    }
    for (const b of BAENDER) expect(SYSTEM_PROZESSE.some(p => p.band === b.id), b.id).toBe(true);
    for (const s of KERN_STUFEN) expect(SYSTEM_PROZESSE.some(p => p.stufe === s.id), s.id).toBe(true);
  });

  it('Steckbrief (Punkt 7): Auslöser, Eingang, Ergebnis, Empfänger, Eigner ausgefüllt; die Phasen kommen aus dem Prozess', () => {
    expect(STECKBRIEF_FELDER.map(f => f.titel)).toEqual(['Auslöser', 'Eingang', 'Phasen', 'Ergebnis', 'Empfänger', 'Eigner']);
    for (const p of SYSTEM_PROZESSE) {
      for (const f of ['ausloeser', 'eingang', 'ergebnis', 'empfaenger', 'eigner'] as const) expect(p.steckbrief[f].trim().length, `${p.id}.${f}`).toBeGreaterThan(3);
      expect(p.phasen.length, p.id).toBeGreaterThan(0);
    }
  });

  it('Ebenen (Punkt 5): Phasen mit Schritten in festen Formen; Kennungen je Prozess eindeutig; Zweige nur in der eigenen Phase', () => {
    for (const p of SYSTEM_PROZESSE) {
      const alle = [wurzelKennung(p), ...p.phasen.map(ph => ph.id), ...p.phasen.flatMap(ph => ph.schritte.map(s => s.id)), ...p.phasen.map(ph => abstimmungKennung(ph.id))];
      expect(new Set(alle).size, p.id).toBe(alle.length);
      for (const ph of p.phasen) {
        expect(ph.schritte.length, `${p.id}/${ph.id}`).toBeGreaterThan(0);
        expect(ph.schritte.length, `${p.id}/${ph.id} — höchstens etwa zehn Schritte je Ebene`).toBeLessThanOrEqual(10);
        const hier = new Set(ph.schritte.map(s => s.id));
        for (const s of ph.schritte) {
          expect(FORMEN, `${p.id}/${s.id}`).toContain(s.form);
          if (s.nein) { expect(s.form).toBe('entscheidung'); expect(hier.has(s.nein), `${p.id}/${s.id} → ${s.nein}`).toBe(true); }
          if (s.ja) expect(hier.has(s.ja), `${p.id}/${s.id} → ${s.ja}`).toBe(true);
          // `zurueck` und `ende` nur an einem Nein-Zweig, nie beides.
          if (s.zurueck || s.ende) expect(neinVon(ph, s.id), `${p.id}/${s.id}`).toBeTruthy();
          expect(!!(s.zurueck && s.ende), `${p.id}/${s.id}`).toBe(false);
        }
      }
    }
  });

  it('Übergaben (Punkt 9) zeigen auf bekannte Prozesse, nie auf sich selbst, mit kurzer Beschriftung', () => {
    const ids = new Set(SYSTEM_PROZESSE.map(p => p.id));
    let n = 0;
    for (const p of SYSTEM_PROZESSE) for (const u of p.uebergaben ?? []) {
      n++;
      expect(ids.has(u.nach), `${p.id} → ${u.nach}`).toBe(true);
      expect(u.nach).not.toBe(p.id);
      expect(u.text.length).toBeGreaterThan(1);
      expect(u.text.length).toBeLessThanOrEqual(24);
    }
    expect(n).toBeGreaterThanOrEqual(12);
    // Die Fliege ist verbunden: SQL → Deal → Übergabe → Lieferung → Wirkung.
    const kante = (a: string, b: string) => SYSTEM_PROZESSE.find(p => p.id === a)?.uebergaben?.some(u => u.nach === b);
    for (const [a, b] of [['sp-lead-sql', 'sp-deal'], ['sp-deal', 'sp-uebergabe'], ['sp-uebergabe', 'sp-lieferung'], ['sp-lieferung', 'sp-wirkung']]) expect(kante(a, b), `${a} → ${b}`).toBe(true);
  });

  it('Links nur auf echte Seiten unter /os (dieselbe Prüfung wie die Schnellsuche)', () => {
    const seiten = new Set(SEITEN_SUCHE.map(s => s.href.split(/[?#]/)[0]));
    for (const p of SYSTEM_PROZESSE) {
      expect(p.link, p.id).toBeTruthy();
      expect(p.link!.href).toMatch(/^\/os\//);
      expect(seiten.has(p.link!.href.split(/[?#]/)[0]), `${p.id}: ${p.link!.href}`).toBe(true);
    }
  });

  it('Punkt 74: Event-Nachfassen in 48 Stunden steht als System-Prozess im Marketing und zählt offen · rechtzeitig', () => {
    const e = SYSTEM_PROZESSE.find(p => p.id === 'sp-event-nachfassen')!;
    expect(e).toBeTruthy();
    expect(e.stufe).toBe('marketing');
    expect(e.zaehler).toBe('event-nachfassen');
    expect(JSON.stringify(e.phasen)).toMatch(/zwei Tagen/);
    const quelle = readFileSync(path.join(process.cwd(), 'lib/prozesse/server.ts'), 'utf8');
    expect(quelle).toContain('besuchUebersicht(');
    expect(quelle).toContain("wort: 'rechtzeitig nachgefasst'");
  });

  it('Plattform-Regel: keine Namen, keine Firmen, keine Beträge im Register', () => {
    const text = readFileSync(path.join(process.cwd(), 'lib/prozesse/register.ts'), 'utf8');
    expect(text).not.toMatch(/\b(kevin|malin|kemaris|ventures|innovation gmbh|kd management)\b/i);
    expect(text).not.toMatch(/\d+[.,]?\d*\s?(€|EUR|Euro)\b/);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });

  it('jeder System-Prozess lässt sich auf der Fläche des Editors auslegen (dieselbe Lage, Formen und Pfeile) — Enden ohne Pfeil weiter', () => {
    for (const p of SYSTEM_PROZESSE) {
      const bild = flaecheBild(alsVorlage(p));
      expect(bild.rahmen.map(r => r.id), p.id).toEqual(p.phasen.map(ph => ph.id));
      expect(bild.knoten.length, p.id).toBe(p.phasen.reduce((n, ph) => n + ph.schritte.length, 0));
      for (const pf of bild.pfeile) expect(pf.punkte.length).toBeGreaterThanOrEqual(2);
      // An einer Entscheidung mit Nein-Zweig gibt es einen Nein-Pfeil; ein Nein-Zweig mit `zurueck` läuft zurück zur Entscheidung.
      for (const ph of p.phasen) for (const s of ph.schritte) {
        if (s.form === 'entscheidung' && s.nein) expect(bild.pfeile.some(pf => pf.von === s.id && pf.nach === s.nein && pf.art === 'nein'), `${p.id}/${s.id}`).toBe(true);
        if (s.zurueck) expect(bild.pfeile.some(pf => pf.von === s.id && pf.nach === neinVon(ph, s.id)!.id), `${p.id}/${s.id}`).toBe(true);
      }
      expect([...endeSchritte(p)].every(id => p.phasen.some(ph => ph.schritte.some(s => s.id === id && s.ende)))).toBe(true);
    }
  });
});

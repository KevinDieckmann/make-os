// Wächter der neuen Website makeinnovation.de (Ordner makeinnovation/, Markenhandbuch 4.0, 24.10.2026).
// Die Seiten entstehen aus inhalt/*.json über bauen.mjs; pruefen.mjs hält die Regeln fest. Offenes (Platzhalter, vorläufige
// Preise, fehlender Termin-Link) blockiert nur die Freigabe, nicht den Test.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pruefen, SPERRLISTE } from '../makeinnovation/pruefen.mjs';
import { seitenBauen, quellen, t } from '../makeinnovation/bauen.mjs';

const ORDNER = join(__dirname, '..', 'makeinnovation');

describe('makeinnovation.de', () => {
  it('besteht die Prüfung ohne Fehler (Seiten passen zur Quelle, Links, CSP, Kennzeichnung)', () => {
    const r = pruefen(ORDNER);
    expect(r.fehler).toEqual([]);
  });

  it('hat für jedes Angebot eine eigene Seite (Kevin 24.10.)', () => {
    const q = quellen();
    const pfade = new Set(seitenBauen(q).map((s: { pfad: string }) => s.pfad));
    for (const a of q.inhalt.angebote) {
      const ziel = a.id === 'fokus-innovation' ? 'fokus-innovation/index.html' : `${q.seite.bereiche[a.bereich.toLowerCase()].pfad}/${a.id}/index.html`;
      expect(pfade.has(ziel), ziel).toBe(true);
    }
  });

  it('zeigt Preise offen und netto mit B2B-Hinweis (Kevin 24.10.)', () => {
    const start = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(start).toContain('2.990 € / Monat');
    expect(start).toContain('Alle Preise netto zuzüglich Umsatzsteuer');
  });

  it('verspricht im Check nichts, was die Beta nicht kann (Sprache, Upload)', () => {
    for (const p of ['index.html', 'innovations-check/index.html']) {
      const html = readFileSync(join(ORDNER, p), 'utf8');
      expect(html).not.toMatch(/Sprachnachricht|Dateien hochladen/);
    }
  });

  it('Platzhalter werden sichtbar markiert, nie still ausgeliefert', () => {
    expect(t('Telefon [[KEVIN: Nummer]]')).toBe('Telefon <span class="ph">[[KEVIN: Nummer]]</span>');
  });

  it('die Inhaltsdatei trägt keine internen Namen (Liste „nicht auf die Homepage“)', () => {
    const roh = readFileSync(join(ORDNER, 'inhalt', 'inhalt.json'), 'utf8') + readFileSync(join(ORDNER, 'inhalt', 'seite.json'), 'utf8');
    for (const w of SPERRLISTE as RegExp[]) expect(w.test(roh), w.source).toBe(false);
  });
});

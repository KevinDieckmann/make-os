// ─── Pegel ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { sprachBereich, huelle, spreize, ANSTIEG, ABFALL } from '../lib/make-one/pegel';

describe('Sprachbereich', () => {
  it('schneidet Lüfterbrummen unten weg', () => {
    // 48 kHz, fftSize 1024 → 512 Fächer à ~46,9 Hz. 85 Hz liegt im Fach 1.
    const b = sprachBereich(48000, 512);
    expect(b.von).toBeGreaterThanOrEqual(1);
    expect(b.bis).toBeLessThan(512);
  });

  it('lässt oben Rauschen weg — nicht das halbe Spektrum messen', () => {
    const b = sprachBereich(48000, 512);
    expect(b.bis).toBeLessThan(256);
  });

  it('gibt auch bei absurden Werten ein gültiges Band zurück', () => {
    const b = sprachBereich(8000, 4);
    expect(b.bis).toBeGreaterThan(b.von);
    expect(b.bis).toBeLessThanOrEqual(3);
  });
});

describe('Hüllkurve', () => {
  it('steigt schneller als sie fällt — sonst wirkt es träge beim Ansprechen', () => {
    expect(ANSTIEG).toBeGreaterThan(ABFALL);
    const rauf = huelle(0, 1);
    const runter = 1 - huelle(1, 0);
    expect(rauf).toBeGreaterThan(runter);
  });

  it('bleibt zwischen Ausgangs- und Zielwert', () => {
    const z = huelle(0.4, 0.9);
    expect(z).toBeGreaterThan(0.4);
    expect(z).toBeLessThan(0.9);
  });

  it('kommt bei anhaltender Stille wieder auf null', () => {
    let p = 1;
    for (let i = 0; i < 200; i++) p = huelle(p, 0);
    expect(p).toBeLessThan(0.001);
  });
});

describe('Spreizung', () => {
  it('deckelt bei 1 und wird nie negativ', () => {
    expect(spreize(5)).toBe(1);
    expect(spreize(-1)).toBe(0);
  });

  it('bringt normale Sprechlautstärke in den sichtbaren Bereich', () => {
    expect(spreize(0.15)).toBeGreaterThan(0.35);
  });
});

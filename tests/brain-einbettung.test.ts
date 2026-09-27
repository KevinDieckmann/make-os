// Brain-Embeddings (lib/brain/einbettung.ts): reine Teile — Kosinus, RRF — ohne Modell (Tests laden nie 120 MB).
import { describe, it, expect } from 'vitest';
import { kosinus, rrf, embeddingsAktiv } from '@/lib/brain/einbettung';

describe('Embeddings — reine Teile', () => {
  it('Kosinus normalisierter Vektoren', () => {
    expect(kosinus(Float32Array.from([1, 0]), Float32Array.from([1, 0]))).toBeCloseTo(1);
    expect(kosinus(Float32Array.from([1, 0]), Float32Array.from([0, 1]))).toBeCloseTo(0);
  });
  it('RRF verbindet zwei Ranglisten — gemeinsame Treffer steigen', () => {
    const r = rrf([['a', 'b', 'c'], ['c', 'a', 'd']]);
    expect(r[0].id).toBe('a'); expect(r[1].id).toBe('c'); expect(r.map(x => x.id)).toContain('d');
    expect(r[0].punkte).toBeCloseTo(1 / 61 + 1 / 62);
  });
  it('im Test sind Embeddings aus', () => { expect(embeddingsAktiv()).toBe(false); });
});

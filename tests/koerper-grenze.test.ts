// ─── Wächter: Die Middleware schneidet keinen erlaubten Upload ab (09.10., Befund der Medien-Recherche) ──────────────
// Next klont den Anfragekörper für die Middleware und reicht über `experimental.middlewareClientMaxBodySize` (Vorgabe 10 MB)
// nur den Anfang an die Route weiter. Jede Upload-/Körper-Grenze der App muss darunter liegen — sonst scheitern Dateien
// zwischen 10 MB und der eigenen Grenze, ohne dass die Route es merkt.
import { describe, it, expect } from 'vitest';
import { MAX_AUFGABEN_DATEI_BYTES } from '@/lib/dateien/aufgaben-regeln';
import { MAX_DATEI_BYTES } from '@/lib/dateien/regeln';
import { JSON_GROSS } from '@/lib/zugang/json-grenze';

describe('Grenze des Anfragekörpers in der Middleware', () => {
  it('liegt mit Luft über jeder Upload-Grenze der App', async () => {
    const konfig = (await import('../next.config.mjs')).default as { experimental?: { middlewareClientMaxBodySize?: number } };
    const grenze = konfig.experimental?.middlewareClientMaxBodySize;
    expect(typeof grenze).toBe('number');
    const groesste = Math.max(MAX_AUFGABEN_DATEI_BYTES, MAX_DATEI_BYTES, JSON_GROSS);
    // 1 MB Luft für Multipart-Rahmen und Metadaten.
    expect(grenze!).toBeGreaterThanOrEqual(groesste + 1024 * 1024);
  });
});

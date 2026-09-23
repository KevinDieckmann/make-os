// ─── MAKE OS — Test-Konfiguration ───────────────────────────────────────────
// Härtung 04.08.: die ersten automatischen Tests. Getestet wird die reine
// Logik (lib/) — keine Oberfläche, kein Server, keine echten Daten.

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const wurzel = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Derselbe @-Pfad wie in tsconfig.json.
    alias: { '@': wurzel },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

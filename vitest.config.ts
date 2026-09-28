// ─── MAKE OS — Test-Konfiguration ───────────────────────────────────────────
// Härtung 04.08.: die ersten automatischen Tests. Getestet wird die reine
// Logik (lib/) — keine Oberfläche, kein Server, keine echten Daten.

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const wurzel = path.dirname(fileURLToPath(import.meta.url));

// Berliner Zeit für alle Tests (29.09., Paket D-A #40): der Server läuft mit TZ=Europe/Berlin (Dockerfile, compose);
// Tests ohne TZ rechneten nachts in der Zone des Rechners bzw. der CI (UTC). Wer eine andere Zone prüfen will,
// setzt process.env.TZ im Test selbst (tests/zeit-berlin.test.ts).
process.env.TZ = 'Europe/Berlin';

export default defineConfig({
  resolve: {
    // Derselbe @-Pfad wie in tsconfig.json.
    alias: { '@': wurzel },
  },
  // Render-Tests der Oberfläche (28.09., Angebots-Tool): .tsx-Bauteile in Tests mit der automatischen JSX-Laufzeit
  // übersetzen (tsconfig steht für Next auf „preserve“). Tests bleiben .test.ts, gerendert wird serverseitig ohne Browser.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['tests/**/*.test.ts'],
    env: { TZ: 'Europe/Berlin' },
  },
});

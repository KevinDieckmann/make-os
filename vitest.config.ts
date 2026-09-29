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
// R-K1 #7 (29.09.): Die Kalender-Tests laufen zusätzlich unter anderen Zonen — `MAKE_OS_TEST_TZ=UTC npx vitest run
// tests/kalender-` bzw. `MAKE_OS_TEST_TZ=America/Los_Angeles …`: die Kalender-Logik darf nie an der Zone der Maschine hängen.
const testZone = process.env.MAKE_OS_TEST_TZ || 'Europe/Berlin';
process.env.TZ = testZone;
// Schreibformat (29.09. abends, Kompatibilitätsmodus): die Tests laufen im Format v2 — so prüfen die bestehenden Tests
// weiter Schlüssel-ID, AAD, „MKOSDAT2“ und `_v`. Den Standard „kompatibel“ (ohne Variable) prüft
// tests/format-kompatibel.test.ts ausdrücklich (setzt MAKE_OS_FORMAT selbst).
process.env.MAKE_OS_FORMAT ??= 'v2';

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
    env: { TZ: testZone, MAKE_OS_FORMAT: process.env.MAKE_OS_FORMAT },
  },
});

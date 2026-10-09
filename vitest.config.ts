// ─── MAKE OS — Test-Konfiguration ───────────────────────────────────────────
// Härtung 04.08.: die ersten automatischen Tests. Getestet wird die reine
// Logik (lib/) — keine Oberfläche, kein Server, keine echten Daten.

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

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
// KI-Vorgabe (05.10., DSGVO-Paket): ohne Variable entscheidet die Instanz nach Altbestand und Datum — in Tests mit frischen
// Datenordnern hinge das vom Kalendertag ab. Deshalb „kompatibel“ (wie Kevins Instanz); tests/ki-datenschutz.test.ts prüft
// „sparsam“ ausdrücklich (setzt die Variable selbst).
process.env.MAKE_OS_KI_VORGABE ??= 'kompatibel';
// Echte Notizen nie in Tests (09.10.): ohne MAKE_VAULT_DIR fällt lib/zoe/vault.ts am Mac auf den echten Vault zurück (~/Vaults, Schreibtisch,
// iCloud) — ein Test, der die Variable vergaß, las so echte Notizen. Vorgabe für ALLE Tests: ein leerer Wegwerf-Vault und keine Doku-Wurzel.
// Tests, die einen eigenen Vault brauchen, setzen MAKE_VAULT_DIR selbst; wer den Rückfall prüft, löscht die Variable im Test.
process.env.MAKE_VAULT_DIR ??= mkdtempSync(path.join(tmpdir(), 'make-os-test-vault-'));
process.env.MAKE_OS_DOKU_WURZEL ??= 'aus';

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
    env: { TZ: testZone, MAKE_OS_FORMAT: process.env.MAKE_OS_FORMAT, MAKE_OS_KI_VORGABE: process.env.MAKE_OS_KI_VORGABE, MAKE_VAULT_DIR: process.env.MAKE_VAULT_DIR, MAKE_OS_DOKU_WURZEL: process.env.MAKE_OS_DOKU_WURZEL },
  },
});

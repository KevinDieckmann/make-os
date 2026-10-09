// Echte Notizen nie in Tests (09.10.): die Test-Konfiguration setzt für alle Tests einen leeren Wegwerf-Vault und schaltet die
// Doku-Wurzel ab — ein Test ohne eigene Angabe liest nie den echten Vault am Mac (~/Vaults, Schreibtisch, iCloud).
import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';

describe('Testumgebung: kein echter Vault', () => {
  it('MAKE_VAULT_DIR zeigt in einen temporären Ordner, nie ins Heimverzeichnis', () => {
    const v = process.env.MAKE_VAULT_DIR ?? '';
    expect(v).not.toBe('');
    const heim = os.homedir();
    for (const echt of ['Vaults', 'Desktop', path.join('Library', 'Mobile Documents'), 'Documents']) expect(v.startsWith(path.join(heim, echt))).toBe(false);
  });
  it('Doku-Wurzel (iCloud-Doku) ist aus', () => {
    expect(process.env.MAKE_OS_DOKU_WURZEL).toBe('aus');
  });
});

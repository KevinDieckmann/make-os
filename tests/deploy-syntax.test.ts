// ─── Wächter: jedes Shell-Skript unter deploy/ und scripts/ ist syntaktisch gültig (bash -n) ─────────────────────────────────────────────
// Anlass (Audit 10.10., Befund B08): deploy/server-haerten.sh war seit 26.09. durch ein fehlendes Anführungszeichen kaputt — bei einem
// Neuaufbau nach NOTFALL.md wären SSH-Reload, Firewall-Drossel, fail2ban, Auto-Updates, Log-Grenzen und sysctl still ausgefallen.
// Der Test führt nichts aus, er liest nur (bash -n).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import path from 'path';

const WURZEL = path.resolve(__dirname, '..');
const skripte = ['deploy', 'scripts']
  .flatMap(ordner => existsSync(path.join(WURZEL, ordner)) ? readdirSync(path.join(WURZEL, ordner)).filter(f => f.endsWith('.sh')).map(f => path.join(ordner, f)) : [])
  .concat(existsSync(path.join(WURZEL, 'start.sh')) ? ['start.sh'] : []);

describe('Shell-Skripte sind syntaktisch gültig', () => {
  it('es gibt Skripte zu prüfen', () => { expect(skripte.length).toBeGreaterThan(5); });
  it.each(skripte)('%s', datei => {
    let fehler = '';
    try { execFileSync('bash', ['-n', path.join(WURZEL, datei)], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (e) { fehler = String((e as { stderr?: Buffer }).stderr ?? e); }
    expect(fehler, datei).toBe('');
  });
});

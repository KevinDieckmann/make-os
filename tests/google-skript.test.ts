// Betrieb: das Einrichtungs-Skript und die Anleitung passen zum Code — Variablen, Rückruf- und Webhook-Pfad, Scopes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { GOOGLE_FUNKTIONEN, RUECKRUF_PFAD } from '@/lib/google/verbindung';
import { WEBHOOK_PFAD } from '@/lib/kalender/google/kanal';

const wurzel = path.resolve(__dirname, '..');
const lies = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');

describe('deploy/google-verbinden.sh', () => {
  const skript = lies('deploy/google-verbinden.sh');
  it('ist gültiges Bash', () => { expect(spawnSync('bash', ['-n', path.join(wurzel, 'deploy/google-verbinden.sh')]).status).toBe(0); });
  it('zeigt das Geheimnis nie: verdeckte Eingabe, nur die letzten vier Zeichen, nie ein echo/printf des Werts außer in die .env', () => {
    expect(skript).toMatch(/read -rsp "Client-Geheimnis/);
    const ausgaben = skript.split('\n').filter(z => /^\s*(echo|printf)\b/.test(z) && /SECRET/.test(z));
    expect(ausgaben.every(z => /SECRET: -4/.test(z) || /schreibe_env|GOOGLE_CLIENT_SECRET=/.test(z) || /printf '%s' "\$ROH"/.test(z))).toBe(true);
    expect(skript).toMatch(/chmod 600/);
  });
  it('schreibt genau die Variablen, die der Code liest', () => {
    for (const v of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ERLAUBTE_DOMAIN']) expect(skript).toContain(v);
    const code = lies('lib/google/verbindung.ts');
    for (const v of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ERLAUBTE_DOMAIN', 'GOOGLE_RUECKRUF_URL']) expect(code).toContain(v);
    expect(lies('deploy/env.server.beispiel')).toMatch(/GOOGLE_CLIENT_ID=[\s\S]*GOOGLE_ERLAUBTE_DOMAIN=makeinnovation\.de/);
  });
});

describe('GOOGLE_KALENDER_EINRICHTEN.md', () => {
  const doku = lies('GOOGLE_KALENDER_EINRICHTEN.md');
  it('nennt den Rückruf- und den Webhook-Pfad genau wie der Code', () => {
    expect(doku).toContain(`https://app.makeinnovation.de${RUECKRUF_PFAD}`);
    expect(doku).toContain(`http://localhost:3001${RUECKRUF_PFAD}`);
    expect(doku).toContain(`https://app.makeinnovation.de${WEBHOOK_PFAD}`);
  });
  it('listet genau die Scopes des Codes (kein Scope zu wenig, keiner zu viel)', () => {
    const scopes = Array.from(new Set(Object.values(GOOGLE_FUNKTIONEN).flatMap(f => f.scopes)));
    for (const s of scopes) expect(doku, s).toContain(s === 'email' ? 'userinfo.email' : s);
    expect(doku).not.toMatch(/auth\/calendar`|gmail|auth\/drive/);
  });
  it('sagt, dass Client-ID und Geheimnis nie in den Chat gehören, und die Zielgruppe „Intern“', () => {
    expect(doku).toMatch(/nie in den Chat/);
    expect(doku).toMatch(/Zielgruppe: Intern/);
  });
});

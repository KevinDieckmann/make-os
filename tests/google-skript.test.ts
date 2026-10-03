// Betrieb: das Einrichtungs-Skript und die Anleitung passen zum Code — Variablen, Rückruf- und Webhook-Pfad, Scopes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { GOOGLE_FUNKTIONEN, RUECKRUF_PFAD } from '@/lib/google/verbindung';
import { WEBHOOK_PFAD } from '@/lib/kalender/google/kanal';
import { GMAIL_WEBHOOK_PFAD } from '@/lib/gmail/meldung';

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
  it('Gmail-Push (optional): das Skript fragt Thema, Dienstkonto und Zielgruppe ab und entfernt sie wieder — genau die Variablen, die lib/gmail/meldung.ts liest', () => {
    const push = lies('lib/gmail/meldung.ts');
    for (const v of ['GMAIL_PUBSUB_THEMA', 'GMAIL_PUSH_DIENSTKONTO', 'GMAIL_PUSH_AUDIENCE']) { expect(skript, v).toContain(v); expect(push, v).toContain(v); expect(lies('deploy/env.server.beispiel'), v).toContain(v); }
    expect(skript).toMatch(/grep -v -E '\^\(GOOGLE_\(CLIENT_ID\|CLIENT_SECRET\|ERLAUBTE_DOMAIN\)\|GMAIL_\(PUBSUB_THEMA\|PUSH_DIENSTKONTO\|PUSH_AUDIENCE\)\)=/);
    // Das Geheimnis wird dabei nirgends ausgegeben; Push-Werte sind keine Geheimnisse, werden aber geprüft, bevor sie gespeichert werden.
    expect(skript).toMatch(/Abbruch: „\$THEMA“/);
    expect(skript).toMatch(/Abbruch: „\$PUSHKONTO“/);
  });
});

describe('GOOGLE_KALENDER_EINRICHTEN.md', () => {
  const doku = lies('GOOGLE_KALENDER_EINRICHTEN.md');
  it('nennt den Rückruf- und den Webhook-Pfad genau wie der Code', () => {
    expect(doku).toContain(`https://app.makeinnovation.de${RUECKRUF_PFAD}`);
    expect(doku).toContain(`http://localhost:3001${RUECKRUF_PFAD}`);
    expect(doku).toContain(`https://app.makeinnovation.de${WEBHOOK_PFAD}`);
  });
  it('listet genau die Kalender-Scopes des Codes (kein Scope zu wenig, keiner zu viel) und verweist für Gmail auf die eigene Anleitung', () => {
    const scopes = Array.from(new Set([...GOOGLE_FUNKTIONEN.basis.scopes, ...GOOGLE_FUNKTIONEN.kalender.scopes]));
    for (const s of scopes) expect(doku, s).toContain(s === 'email' ? 'userinfo.email' : s);
    expect(doku).not.toMatch(/auth\/calendar`|auth\/gmail|mail\.google\.com|auth\/drive/);
    expect(doku).toContain('GOOGLE_GMAIL_EINRICHTEN.md');
  });
  it('sagt, dass Client-ID und Geheimnis nie in den Chat gehören, und die Zielgruppe „Intern“', () => {
    expect(doku).toMatch(/nie in den Chat/);
    expect(doku).toMatch(/Zielgruppe: Intern/);
  });
});

describe('GOOGLE_GMAIL_EINRICHTEN.md', () => {
  const doku = lies('GOOGLE_GMAIL_EINRICHTEN.md');
  it('nennt den Webhook-Pfad genau wie der Code und die Umgebungsvariablen', () => {
    expect(doku).toContain(`https://app.makeinnovation.de${GMAIL_WEBHOOK_PFAD}`);
    for (const v of ['GMAIL_PUBSUB_THEMA', 'GMAIL_PUSH_DIENSTKONTO', 'GMAIL_PUSH_AUDIENCE']) expect(doku, v).toContain(v);
  });
  it('verlangt genau den Gmail-Scope des Codes — und warnt vor dem Vollzugriff', () => {
    expect(GOOGLE_FUNKTIONEN.gmail.scopes).toEqual(['https://www.googleapis.com/auth/gmail.modify']);
    expect(doku).toContain('https://www.googleapis.com/auth/gmail.modify');
    expect(doku).toMatch(/\*\*nicht\*\*\s+den Vollzugriff \(`mail\.google\.com`/);
    expect(doku).not.toMatch(/auth\/gmail\.(send|readonly|compose)/);
  });
  it('Pub/Sub: der Push-Dienst von Gmail als Publisher, OIDC mit Dienstkonto und Zielgruppe, Token-Ersteller-Rolle', () => {
    expect(doku).toContain('gmail-api-push@system.gserviceaccount.com');
    expect(doku).toMatch(/Pub\/Sub-Publisher/);
    expect(doku).toMatch(/Ersteller von Dienstkonto-Tokens/);
    expect(doku).toMatch(/Zielgruppe \(Audience\)/);
  });
  it('DNS-Umstellung: Reihenfolge (hello@ ZUERST, MX zuletzt) und die genauen Einträge', () => {
    expect(doku.indexOf('D2. `hello@makeinnovation.de` ZUERST')).toBeGreaterThan(0);
    expect(doku.indexOf('D2.')).toBeLessThan(doku.indexOf('**MX (zuletzt!)**'));
    expect(doku).toContain('v=spf1 include:_spf.google.com ~all');
    expect(doku).toContain('google._domainkey');
    expect(doku).toContain('_dmarc');
    expect(doku).toMatch(/\*\*Ziel\*\* `smtp\.google\.com`, \*\*Priorität\*\* `1`/);
    expect(doku).toMatch(/Rückweg/);
  });
  it('Client-ID und Geheimnis nie in den Chat', () => { expect(doku).toMatch(/nicht in den Chat/); });
});

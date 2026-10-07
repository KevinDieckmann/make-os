// Betrieb WhatsApp (07.10.): das Einrichtungs-Skript und die Anleitung passen zum Code — Variablen, Webhook-Pfad, verdeckte Eingabe,
// genau einmal eingefügter Schlüssel, Verify-Token aus Zufall, nur Business-Bereiche, --entfernen; die Anleitung für Kevin nennt die
// Schritte bei Meta mit offiziellen Links.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { WA_ENV, WEBHOOK_PFAD } from '@/lib/whatsapp/konfig';

const wurzel = path.resolve(__dirname, '..');
const lies = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');

describe('deploy/whatsapp-verbinden.sh', () => {
  const skript = lies('deploy/whatsapp-verbinden.sh');
  it('ist gültiges Bash', () => { expect(spawnSync('bash', ['-n', path.join(wurzel, 'deploy/whatsapp-verbinden.sh')]).status).toBe(0); });
  it('schreibt genau die Variablen, die der Code liest — und entfernt genau diese', () => {
    for (const v of Object.values(WA_ENV)) { expect(skript, v).toContain(`${v}=`); expect(lies('deploy/env.server.beispiel'), v).toContain(v); }
    expect(skript).toMatch(/grep -v -E '\^WHATSAPP_\(TELEFONNUMMER_ID\|WABA_ID\|ZUGRIFFSSCHLUESSEL\|APP_GEHEIMNIS\|VERIFY_TOKEN\|BEREICH\|PERSONEN\)='/);
    expect(skript).toMatch(/--entfernen/);
    expect(skript).toMatch(/chmod 600/);
  });
  it('Schlüssel und App-Geheimnis nur verdeckt, nie ausgegeben (höchstens die letzten vier Zeichen)', () => {
    expect(skript).toMatch(/read -rsp "Dauerhaften Zugriffsschlüssel/);
    expect(skript).toMatch(/read -rsp "App-Geheimnis/);
    const ausgaben = skript.split('\n').filter(z => /^\s*(echo|printf)\b/.test(z) && /\$\{?(ZUGRIFF|GEHEIMNIS)\b/.test(z));
    expect(ausgaben.every(z => /\$\{(ZUGRIFF|GEHEIMNIS): -4\}/.test(z))).toBe(true);
    expect(skript).toMatch(/unset ZUGRIFF GEHEIMNIS/);
  });
  it('erkennt doppelt eingefügte Schlüssel („genau EINMAL“)', () => {
    expect(skript).toMatch(/zweimal eingefügt/);
    expect(skript).toMatch(/"\$\{ROH:0:\$HAELFTE\}" == "\$\{ROH:\$HAELFTE\}"/);
  });
  it('Verify-Token aus Zufall (24 Byte), angezeigt zum Eintragen bei Meta — samt Webhook-Adresse', () => {
    expect(skript).toMatch(/od -An -tx1 -N24 \/dev\/urandom/);
    expect(skript).toContain(`https://app.makeinnovation.de${WEBHOOK_PFAD}`);
    expect(skript).toMatch(/„messages“ abonnieren/);
  });
  it('nur Business-Bereiche (nie Privat), Personen als Speichernamen', () => {
    expect(skript).toMatch(/\^\(kdv\|ug\|g-\[a-z0-9\]/);
    expect(skript).not.toMatch(/\(privat\|/);
  });
});

describe('Anleitung für Kevin (UPDATES.md) und Projekt-Regeln (CLAUDE.md)', () => {
  const updates = lies('UPDATES.md');
  const ab = updates.indexOf('## 07.10.2026 — WhatsApp Business');
  const teil = updates.slice(ab, updates.indexOf('\n## ', ab + 10));
  it('Schritte bei Meta: Portfolio, App (Business), WhatsApp-Produkt, Speicherort vor der Registrierung, System-User mit den zwei Rechten, Webhook + messages, Skript', () => {
    expect(ab).toBeGreaterThan(0);
    for (const s of ['Business-Portfolio', 'Typ „Business“', 'Local Storage', 'No Storage', 'System-User', 'whatsapp_business_messaging', 'whatsapp_business_management', `https://app.makeinnovation.de${WEBHOOK_PFAD}`, '**messages**', 'whatsapp-verbinden.sh', 'nicht in der WhatsApp-App', 'data_localization_region']) expect(teil, s).toContain(s);
  });
  it('verlinkt nur auf offizielle Meta-Seiten (developers.facebook.com, business.facebook.com, whatsapp.com)', () => {
    const links = Array.from(teil.matchAll(/https:\/\/([a-z0-9.-]+)/g)).map(m => m[1]);
    expect(links.length).toBeGreaterThan(3);
    for (const h of links) expect(['developers.facebook.com', 'business.facebook.com', 'www.whatsapp.com', 'app.makeinnovation.de'].includes(h), h).toBe(true);
  });
  it('CLAUDE.md hat den Abschnitt WhatsApp', () => { expect(lies('CLAUDE.md')).toMatch(/## WhatsApp Business/); });
});

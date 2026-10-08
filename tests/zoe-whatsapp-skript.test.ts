// Betrieb ZOE auf WhatsApp (08.10.): das Einrichtungs-Skript und die Anleitung passen zum Code — Variablen, Webhook-Pfad, verdeckte Eingabe,
// genau einmal eingefügter Schlüssel, Verify-Token aus Zufall, nie die Business-Nummer, nur die WHATSAPP_ZOE_*-Zeilen (die Business-Nummer
// bleibt unberührt), --entfernen; die Anleitung nennt die Schritte bei Meta mit offiziellen Links und die Vorlage „briefing_bereit“.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ZOE_WA_ENV, ZOE_WEBHOOK_PFAD, VORLAGE_VORGABE } from '@/lib/zoe-whatsapp/konfig';
import { WA_ENV } from '@/lib/whatsapp/konfig';

const wurzel = path.resolve(__dirname, '..');
const lies = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');

describe('deploy/zoe-whatsapp-verbinden.sh', () => {
  const skript = lies('deploy/zoe-whatsapp-verbinden.sh');
  it('ist gültiges Bash', () => { expect(spawnSync('bash', ['-n', path.join(wurzel, 'deploy/zoe-whatsapp-verbinden.sh')]).status).toBe(0); });
  it('schreibt genau die Variablen, die der Code liest — und entfernt nur diese (nie die der Business-Nummer)', () => {
    for (const v of Object.values(ZOE_WA_ENV)) { expect(skript, v).toContain(`${v}=`); expect(lies('deploy/env.server.beispiel'), v).toContain(v); }
    expect(skript).toMatch(/grep -v -E '\^WHATSAPP_ZOE_\(TELEFONNUMMER_ID\|WABA_ID\|ZUGRIFFSSCHLUESSEL\|APP_GEHEIMNIS\|VERIFY_TOKEN\|VORLAGE\|VORLAGE_SPRACHE\)='/);
    for (const v of Object.values(WA_ENV)) expect(skript).not.toContain(`\n${v}=`);
    expect(skript).toMatch(/--entfernen/);
    expect(skript).toMatch(/chmod 600/);
  });
  it('bricht ab, wenn die ID der Business-Nummer gleicht', () => {
    expect(skript).toContain(`'^${WA_ENV.telefonnummerId}='`);
    expect(skript).toMatch(/Das ist die Telefonnummer-ID der Business-Nummer/);
  });
  it('Schlüssel und App-Geheimnis nur verdeckt, nie ausgegeben (höchstens die letzten vier Zeichen); doppelt Eingefügtes erkannt', () => {
    expect(skript).toMatch(/read -rsp "Dauerhaften Zugriffsschlüssel/);
    expect(skript).toMatch(/read -rsp "App-Geheimnis/);
    const ausgaben = skript.split('\n').filter(z => /^\s*(echo|printf)\b/.test(z) && /\$\{?(ZUGRIFF|GEHEIMNIS)\b/.test(z));
    expect(ausgaben.every(z => /\$\{(ZUGRIFF|GEHEIMNIS): -4\}/.test(z))).toBe(true);
    expect(skript).toMatch(/unset ZUGRIFF GEHEIMNIS/);
    expect(skript).toMatch(/zweimal eingefügt/);
  });
  it('Verify-Token aus Zufall, Webhook-Adresse der ZOE-Nummer, Vorgabe der Vorlage', () => {
    expect(skript).toMatch(/od -An -tx1 -N24 \/dev\/urandom/);
    expect(skript).toContain(`https://app.makeinnovation.de${ZOE_WEBHOOK_PFAD}`);
    expect(skript).toContain(`[${VORLAGE_VORGABE.name}]`);
    expect(skript).toMatch(/„messages“ abonnieren/);
  });
});

describe('Anleitung für Kevin (UPDATES.md)', () => {
  const updates = lies('UPDATES.md');
  const ab = updates.indexOf('ZOE auf WhatsApp: eigene ZOE-Nummer, Kanal je Person');
  const teil = updates.slice(ab, updates.indexOf('\n## ', ab + 10));
  it('Schritte: zweite Nummer, eigene App, Vorlage briefing_bereit (Utility, ein Platzhalter), Skript, Webhook, Registrieren, Datenschutz, „So testet ihr“', () => {
    expect(ab).toBeGreaterThan(0);
    for (const s of ['Zweite Nummer', 'Eigene App für ZOE', 'briefing_bereit', '**Utility**', '{{1}}', 'zoe-whatsapp-verbinden.sh', `https://app.makeinnovation.de${ZOE_WEBHOOK_PFAD}`,
      '**messages**', 'ZOE-Nummer registrieren', 'Meta (ZOE-Kanal)', 'So testet ihr', 'STOP', 'ja ABCD', 'Rückweg']) expect(teil, s).toContain(s);
  });
  it('verlinkt nur auf offizielle Meta-Seiten', () => {
    const links = Array.from(teil.matchAll(/https:\/\/([a-z0-9.-]+)/g)).map(m => m[1]);
    expect(links.length).toBeGreaterThan(3);
    for (const h of links) expect(['developers.facebook.com', 'business.facebook.com', 'www.whatsapp.com', 'app.makeinnovation.de'].includes(h), h).toBe(true);
  });
});

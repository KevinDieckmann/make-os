// Paket D-A (29.09.): nächtliche Sicherung (Schnappschuss, Prüfung, age-Pflicht, Generationen, Status für den HOI),
// Ausgabe an den Mac (Forced Command, nur lesend) und Abholung am Mac — Testläufe gegen Temp-Ordner, ohne Server,
// ohne Docker, mit einem Stellvertreter für age (der echte liegt am Mac/Server).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { huelleSchreiben, schluesselAus } from '@/lib/store/huelle.mjs';

const wurzel = mkdtempSync(path.join(tmpdir(), 'make-os-sicherung-'));
afterAll(() => rmSync(wurzel, { recursive: true, force: true }));
const bin = path.join(wurzel, 'bin');
const SCHL = 'sicherung-test-schluessel';

beforeAll(() => {
  mkdirSync(bin);
  // Stellvertreter für age: „verschlüsseln“ = Kopf + Inhalt, „entschlüsseln“ = Kopf ab.
  writeFileSync(path.join(bin, 'age'), '#!/bin/bash\nif [ "$1" = "-R" ]; then { printf "age-encryption.org/v1\\n"; cat "$5"; } > "$4"; elif [ "$1" = "-d" ]; then tail -c +23 "$4"; fi\n');
  chmodSync(path.join(bin, 'age'), 0o755);
});

function basisAnlegen(name: string, schluessel = SCHL): string {
  const b = path.join(wurzel, name);
  mkdirSync(path.join(b, 'daten', 'backup'), { recursive: true });
  mkdirSync(path.join(b, 'sicherungen'));
  const s = schluesselAus(schluessel);
  writeFileSync(path.join(b, 'daten', 'kontakte.json'), huelleSchreiben(JSON.stringify({ kontakte: [{ id: 'c-1' }, { id: 'c-2' }], _v: 1 }), s, 'kontakte'));
  writeFileSync(path.join(b, 'daten', 'crm.json'), huelleSchreiben(JSON.stringify({ chancen: [{ id: 'ch-1' }] }), s, 'crm'));
  writeFileSync(path.join(b, 'daten', 'backup', 'kontakte-2026-09-01.json'), 'nicht mitnehmen');
  writeFileSync(path.join(b, 'daten', 'brain-index.sqlite'), 'klartext-index');
  writeFileSync(path.join(b, 'daten', 'halb.json.123.abc.tmp'), 'rest');
  writeFileSync(path.join(b, 'sicherung.pub'), 'age1test');
  return b;
}
const lauf = (basis: string, env: Record<string, string> = {}) => spawnSync('bash', ['deploy/sicherung.sh'], {
  env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAKE_OS_BASIS: basis, MAKE_OS_OHNE_APP: '1', MAKE_OS_DATEN_SCHLUESSEL: SCHL, ...env }, encoding: 'utf8',
});
const status = (basis: string) => JSON.parse(readFileSync(path.join(basis, 'daten', 'system', 'sicherung.json'), 'utf8'));

describe('deploy/sicherung.sh', () => {
  it('Schnappschuss ohne backup/, Brain-Index und .tmp; geprüft; age-Archiv 0600; Status für den HOI; Stage weg', () => {
    const b = basisAnlegen('ok');
    const r = lauf(b);
    expect(r.status, r.stderr + r.stdout).toBe(0);
    const archiv = readdirSync(path.join(b, 'sicherungen')).find(f => f.endsWith('.tar.gz.age'))!;
    expect(archiv).toBeTruthy();
    expect(statSync(path.join(b, 'sicherungen', archiv)).mode & 0o777).toBe(0o600);
    const inhalt = execFileSync('bash', ['-c', `tail -c +23 "${path.join(b, 'sicherungen', archiv)}" | tar -tzf -`], { encoding: 'utf8' });
    expect(inhalt).toContain('daten/kontakte.json');
    expect(inhalt).not.toContain('backup');
    expect(inhalt).not.toContain('brain-index');
    expect(inhalt).not.toContain('.tmp');
    const s = status(b);
    expect(s).toMatchObject({ ok: true, ping: 'fehlt', schnappschuss: 'ohne-pause', grund: '' });
    expect(s.pruefung).toMatchObject({ ok: true, bestaende: 2, datensaetze: 3, v2: 2, fehler: 0 });
    expect(JSON.stringify(s)).not.toContain('c-1');
    expect(existsSync(path.join(b, 'daten', '.sicherung-stage'))).toBe(false);
    expect(r.stdout + r.stderr).not.toContain(SCHL);
  });
  it('Probe-Restore am Mac (sicherung-probe.sh): entpackt, entschlüsselt, zählt — ohne Schlüssel in der Ausgabe', () => {
    const b = basisAnlegen('probe');
    expect(lauf(b).status).toBe(0);
    const archiv = path.join(b, 'sicherungen', readdirSync(path.join(b, 'sicherungen')).find(f => f.endsWith('.tar.gz.age'))!);
    writeFileSync(path.join(wurzel, 'identitaet.txt'), 'AGE-SECRET-KEY-NUR-TEST');
    const r = spawnSync('bash', ['deploy/sicherung-probe.sh', archiv, path.join(wurzel, 'identitaet.txt')], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAKE_OS_DATEN_SCHLUESSEL: SCHL }, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Probe bestanden/);
    expect(r.stdout).toMatch(/Bestände: 2 \(v2 2/);
    expect(r.stdout + r.stderr).not.toContain(SCHL);
    const falsch = spawnSync('bash', ['deploy/sicherung-probe.sh', archiv, path.join(wurzel, 'identitaet.txt')], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAKE_OS_DATEN_SCHLUESSEL: 'falscher' }, encoding: 'utf8' });
    expect(falsch.status).toBe(2);
    expect(falsch.stdout).toMatch(/NICHT bestanden/);
  });
  it('ohne sicherung.pub: Abbruch (kein openssl-Rückfall), Status rot mit Grund', () => {
    const b = basisAnlegen('ohne-pub');
    rmSync(path.join(b, 'sicherung.pub'));
    const r = lauf(b);
    expect(r.status).not.toBe(0);
    expect(status(b)).toMatchObject({ ok: false });
    expect(status(b).grund).toMatch(/sicherung\.pub fehlt/);
    expect(readdirSync(path.join(b, 'sicherungen'))).toEqual([]);
  });
  it('Bestand mit fremdem Schlüssel: Prüfung schlägt an, kein Archiv, Dead-Man-Ping meldet /fail', async () => {
    const b = basisAnlegen('falsch', 'anderer-schluessel');
    const pings: string[] = [];
    const server = http.createServer((q, a) => { pings.push(q.url ?? ''); a.end('ok'); });
    await new Promise<void>(ok => server.listen(0, '127.0.0.1', () => ok()));
    writeFileSync(path.join(b, '.healthchecks-sicherung'), `http://127.0.0.1:${(server.address() as { port: number }).port}/hc`);
    try {
      const r = await new Promise<{ status: number | null }>(ok => { const p = spawn('bash', ['deploy/sicherung.sh'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAKE_OS_BASIS: b, MAKE_OS_OHNE_APP: '1', MAKE_OS_DATEN_SCHLUESSEL: SCHL } }); p.on('close', (c: number) => ok({ status: c })); });
      expect(r.status).not.toBe(0);
    } finally { await new Promise(ok => server.close(ok)); }
    expect(pings).toEqual(['/hc/fail']);
    const s = status(b);
    expect(s).toMatchObject({ ok: false, ping: 'ok' });
    expect(s.grund).toMatch(/Prüfung/);
    expect(readdirSync(path.join(b, 'sicherungen')).filter(f => f.endsWith('.age'))).toEqual([]);
  });
  it('Generationen: 14 täglich, 8 wöchentlich, 12 monatlich — ältere weg', () => {
    const b = basisAnlegen('gen');
    const heute = new Date();
    for (let i = 1; i <= 400; i++) {
      const d = new Date(heute.getTime() - i * 86_400_000).toISOString().slice(0, 10);
      writeFileSync(path.join(b, 'sicherungen', `make-os-${d}.tar.gz.${i > 380 ? 'enc' : 'age'}`), 'alt');
    }
    expect(lauf(b).status).toBe(0);
    const n = readdirSync(path.join(b, 'sicherungen')).filter(f => f.startsWith('make-os-')).length;
    expect(n).toBeGreaterThanOrEqual(14 + 5);
    expect(n).toBeLessThanOrEqual(14 + 8 + 12);
  });
});

describe('Mac-Abholung: sicherung-ausgeben.sh (Forced Command) + sicherung-abholen.sh', () => {
  const b = path.join(wurzel, 'abhol-server');
  const mac = path.join(wurzel, 'mac');
  const name = 'make-os-2026-09-28.tar.gz.age';
  let inhalt: Buffer;
  beforeAll(() => {
    mkdirSync(path.join(b, 'sicherungen'), { recursive: true });
    mkdirSync(path.join(b, 'daten', 'system'), { recursive: true });
    inhalt = Buffer.concat([Buffer.from('age-encryption.org/v1\n'), createHash('sha256').update('x').digest(), Buffer.alloc(3000, 7)]);
    writeFileSync(path.join(b, 'sicherungen', name), inhalt);
    writeFileSync(path.join(b, 'sicherungen', 'make-os-2026-09-27.tar.gz.age'), 'aelter');
    writeFileSync(path.join(wurzel, 'ssh-stellvertreter.sh'), `#!/bin/bash\nSSH_ORIGINAL_COMMAND="$*" MAKE_OS_BASIS="${b}" exec bash "${path.resolve('deploy/sicherung-ausgeben.sh')}"\n`);
    mkdirSync(mac);
  });
  const ausgeben = (befehl: string) => spawnSync('bash', ['deploy/sicherung-ausgeben.sh'], { env: { ...process.env, MAKE_OS_BASIS: b, SSH_ORIGINAL_COMMAND: befehl } });
  const abholen = () => spawnSync('bash', ['deploy/sicherung-abholen.sh'], { env: { ...process.env, HOME: mac, MAKE_OS_ABHOL_SSH: `bash ${path.join(wurzel, 'ssh-stellvertreter.sh')}`, MAKE_OS_ABHOL_ZIEL: path.join(mac, 'Sicherungen') }, encoding: 'utf8' });

  it('Ausgabe: nur liste/holen/bestaetigen, nur Archivnamen — kein Pfad, keine Shell', () => {
    expect(ausgeben('liste').stdout.toString()).toMatch(new RegExp(`^${name.replace(/\./g, '\\.')} ${inhalt.length} [0-9a-f]{64}\\n$`));
    expect(ausgeben('holen ../daten/system/abholung.json').status).toBe(2);
    expect(ausgeben('holen /etc/passwd').status).toBe(2);
    expect(ausgeben('bash -c id').status).toBe(2);
    expect(ausgeben(`bestaetigen ${name} ${'0'.repeat(64)}`).status).toBe(3);
    expect(Buffer.compare(ausgeben(`holen ${name}`).stdout, inhalt)).toBe(0);
  });
  it('Abholung: holt das neueste, prüft Größe + SHA-256, legt 0600 ab, bestätigt — Marke für den HOI', () => {
    const r = abholen();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const f = path.join(mac, 'Sicherungen', name);
    expect(Buffer.compare(readFileSync(f), inhalt)).toBe(0);
    expect(statSync(f).mode & 0o777).toBe(0o600);
    const marke = JSON.parse(readFileSync(path.join(b, 'daten', 'system', 'abholung.json'), 'utf8'));
    expect(marke).toMatchObject({ datei: name, bytes: inhalt.length, bestaetigt: true });
    const zweiter = abholen();
    expect(zweiter.status).toBe(0);
    expect(zweiter.stdout).toMatch(/liegt schon vollständig hier/);
  });
  it('Skripte: gültiges Bash, ausführbar; plist gültig', () => {
    for (const f of ['deploy/sicherung.sh', 'deploy/sicherung-ausgeben.sh', 'deploy/sicherung-abholen.sh', 'deploy/sicherung-probe.sh', 'deploy/generationen.sh', 'deploy/datenschluessel-rotieren-live.sh']) {
      execFileSync('bash', ['-n', f]);
      expect(statSync(f).mode & 0o100, f).toBeTruthy(); // Forced Command und launchd rufen sie direkt auf
    }
    execFileSync('bash', ['-n', 'deploy/lage-sammeln.sh']); // Cron ruft sie über „bash …“ auf
    if (process.platform === 'darwin') execFileSync('plutil', ['-lint', 'deploy/de.makeos.sicherung.plist']);
  });
});

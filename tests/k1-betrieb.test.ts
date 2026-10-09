// ─── Paket K1 (28.09.) — Betrieb: Prompt Injection (#98), fsync (#37), HOI „Bestand beschädigt“ (#39),
// Sicherung zurückholbar (#109/#110), Warnung bei laufender App (#40). Eigener Datenordner, keine echten Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import net from 'node:net';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k1-betrieb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('ZOE: Browser-Kontext zählt als Fremdtext, Gedächtnis/Notiz nur als Vorschlag (#98)', () => {
  let s: typeof import('@/lib/zoe/gespraech-schutz');
  beforeAll(async () => { s = await import('@/lib/zoe/gespraech-schutz'); });

  it('nicht leerer Kontext → fremd gelesen; leer/fehlend → nicht', () => {
    expect(s.kontextIstFremd('Kontaktkarte: Anna Beispiel, Notiz …')).toBe(true);
    expect(s.kontextIstFremd('   ')).toBe(false);
    expect(s.kontextIstFremd(undefined)).toBe(false);
  });
  it('fakt_merken und notiz_anlegen immer Vorschlag — auch ohne Fremdtext', () => {
    expect(s.nurVorschlag('fakt_merken', {}, false)).toBe(true);
    expect(s.nurVorschlag('notiz_anlegen', {}, false)).toBe(true);
    expect(s.nurVorschlag('create_task', {}, false)).toBe(false);
  });
  it('nach Fremdtext: Schreibendes nur Vorschlag, Lesendes frei; Werbesperre immer Vorschlag', () => {
    expect(s.nurVorschlag('create_task', {}, true)).toBe(true);
    expect(s.nurVorschlag('suche_wissen', {}, true)).toBe(false);
    expect(s.nurVorschlag('notiere_kontakt', { ergebnis: 'sperre' }, false)).toBe(true);
  });
  it('die Gesprächs-Route nutzt genau diese Regeln (Kontext setzt fremdGelesen von Anfang an)', () => {
    const route = readFileSync('app/api/kimmi/route.ts', 'utf8');
    expect(route).toMatch(/const kontextFremd = kontextIstFremd\(payload\.context\);/);
    // 29.09. (#K1): Termintitel im Prompt zählen ebenfalls als Fremdtext.
    // Seit Paket 4a (09.10.) steht die Marke am ZOE-Thread (Server); ohne Thread wie bisher aus dem Verlauf. Die Schleife ist EINE
    // (lib/agenten/schleife.ts) — sie reicht den laufenden Zustand `z` an den Handler der Route.
    expect(route).toMatch(/const fremdGelesen = kontextFremd \|\| lage\.kalenderFremd \|\| \(zug \? zug\.faden\.fremdGelesen : verlaufFremd\(payload\.verlauf, quelleVon\)\);/);
    expect(route).toMatch(/const vorschlagen = nurVorschlag\(name, a\.input, z\.fremdGelesen\)( \|\| webAuftrag)?;/);
    // 29.09. (D-B #90): run_agent geht durch denselben Schutz (agentNurVorschlag) statt daran vorbei.
    expect(route).toMatch(/agentNurVorschlag\(agentId, z\.fremdGelesen, z\.vertraulich\)/);
    // Der Kontext wird VOR dem Einpacken geprüft (fremd() macht aus „leer“ sonst Text).
    expect(route.indexOf('kontextIstFremd(payload.context)')).toBeLessThan(route.indexOf("payload.context = fremd('client'"));
  });
});

describe('local-db: fsync vor rename (#37)', () => {
  it('Datei-Daten werden synchronisiert, bevor sie umbenannt werden; das Verzeichnis danach', async () => {
    const db = await import('@/lib/store/local-db');
    const ablauf: string[] = [];
    const openEcht = fsp.open.bind(fsp);
    const renameEcht = fsp.rename.bind(fsp);
    const o = vi.spyOn(fsp, 'open').mockImplementation(async (...a: Parameters<typeof fsp.open>) => {
      const h = await openEcht(...a);
      const syncEcht = h.sync.bind(h);
      const ziel = String(a[0]);
      h.sync = async () => { ablauf.push(`sync:${ziel.endsWith('.tmp') ? 'tmp' : ziel === ordner ? 'ordner' : ziel}`); return syncEcht(); };
      return h;
    });
    const r = vi.spyOn(fsp, 'rename').mockImplementation(async (von, nach) => { ablauf.push(`rename:${String(von).endsWith('.tmp') ? 'tmp' : 'x'}`); return renameEcht(von, nach); });
    try {
      await db.saveJson('fsync-probe', { a: 1 });
    } finally { o.mockRestore(); r.mockRestore(); }
    expect(ablauf).toEqual(['sync:tmp', 'rename:tmp', 'sync:ordner']);
    expect(await db.loadJson('fsync-probe')).toEqual({ a: 1 });
  });
  it('Schreiben funktioniert weiter — auch updateJson, auch mehrfach, ohne liegengebliebene .tmp', async () => {
    const db = await import('@/lib/store/local-db');
    for (let i = 0; i < 5; i++) await db.updateJson<{ n: number }>('fsync-zaehler', c => ({ n: (c?.n ?? 0) + 1 }));
    expect(await db.loadJson('fsync-zaehler')).toEqual({ n: 5 });
    expect((await fsp.readdir(ordner)).filter(n => n.endsWith('.tmp'))).toEqual([]);
    expect(statSync(path.join(ordner, 'fsync-zaehler.json')).mode & 0o777).toBe(0o600);
  });
});

describe('HOI: beiseitegelegte Bestände werden rot gemeldet (#39)', () => {
  it('zählt nur Dateinamen <name>.json.corrupt-<zeit>', async () => {
    const { beschaedigteAus } = await import('@/lib/hoi/innen');
    expect(beschaedigteAus(['kontakte.json', 'kontakte.json.corrupt-1727000000000', 'crm.json.corrupt-1', 'crm.json.corrupt-2', 'x.json.corrupt-abc'])).toEqual({ anzahl: 3, bestaende: ['crm', 'kontakte'] });
  });
  it('innenLage liest den Datenordner, befundeAus macht daraus einen roten Befund', async () => {
    writeFileSync(path.join(ordner, 'kaputt-probe.json.corrupt-1727000000000'), 'INHALT-DER-NIE-GELESEN-WIRD');
    const { innenLage } = await import('@/lib/hoi/innen');
    const { befundeAus, gesamt } = await import('@/lib/hoi/lage');
    const innen = await innenLage();
    expect(innen.bestaende.beschaedigt).toEqual({ anzahl: 1, bestaende: ['kaputt-probe'] });
    const b = befundeAus(innen, null, null, innen.zeit);
    const f = b.find(x => x.id === 'beschaedigt');
    expect(f).toMatchObject({ ampel: 'rot', label: 'Bestand beschädigt beiseitegelegt' });
    expect(f!.wert).toContain('kaputt-probe');
    expect(JSON.stringify(b)).not.toContain('INHALT-DER-NIE-GELESEN-WIRD');
    expect(gesamt(b).ampel).toBe('rot');
    // Ohne Beiseitegelegtes kein Befund.
    expect(befundeAus({ ...innen, bestaende: { ...innen.bestaende, beschaedigt: { anzahl: 0, bestaende: [] } } }, null, null, innen.zeit).some(x => x.id === 'beschaedigt')).toBe(false);
  });
});

describe('Sicherung zurückholbar (#109/#110) — Skripte, nicht ausgeführt', () => {
  it('Probe-Restore-Skript: vorhanden, ausführbar, gültiges Bash, löscht den Temp-Ordner, gibt keinen Schlüssel aus', () => {
    const f = 'deploy/sicherung-probe.sh';
    expect(statSync(f).mode & 0o100).toBeTruthy();
    execFileSync('bash', ['-n', f]);
    const t = readFileSync(f, 'utf8');
    expect(t).toMatch(/age -d -i/);
    expect(t).toMatch(/trap 'rm -rf "\$TMP"' EXIT/);
    expect(t).not.toMatch(/echo[^\n]*\$\{?MAKE_OS_DATEN_SCHLUESSEL/);
    expect(t).not.toMatch(/console\.log\([^)]*(key|SCHLUESSEL)/);
  });
  it('Rotation: sagt am Ende deutlich, dass der ALTE Schlüssel aufbewahrt werden muss — ohne ihn auszugeben', () => {
    const t = readFileSync('deploy/datenschluessel-rotieren.sh', 'utf8');
    execFileSync('bash', ['-n', 'deploy/datenschluessel-rotieren.sh']);
    expect(t).toMatch(/ALTEN SCHLÜSSEL AUFBEWAHREN/);
    expect(t).toMatch(/14 Tage/);
    expect(t).toMatch(/7 Tage/);
    expect(t).not.toMatch(/echo[^\n]*\$(ALT|NEU)\b/);
    expect(t).not.toMatch(/\$\{?(ALT|NEU)\}?[^\n]*HINWEIS|HINWEIS[\s\S]*\$\{?(ALT|NEU)\b/);
  });
  it('DEPLOY.md beschreibt den quartalsweisen Probe-Restore', () => {
    expect(readFileSync('DEPLOY.md', 'utf8')).toMatch(/Probe-Restore — quartalsweise/);
  });
});

describe('Verschlüsselungs-Skript warnt bei laufender App (#40)', () => {
  const lauf = (porte: string) => spawnSync(process.execPath, ['scripts/daten-verschluesselung.mjs', '--verschluesseln'], {
    env: { ...process.env, MAKE_OS_DATEN_DIR: mkdtempSync(path.join(tmpdir(), 'make-os-k1-skript-')), MAKE_OS_DATEN_SCHLUESSEL: 'nur-fuer-den-test', MAKE_OS_PRUEF_PORTE: porte },
    encoding: 'utf8',
  });
  it('belegter Port → WARNUNG, freier Port → keine; das Skript läuft in beiden Fällen durch', async () => {
    const server = net.createServer(s => s.end());
    await new Promise<void>(ok => server.listen(0, '127.0.0.1', () => ok()));
    const port = (server.address() as net.AddressInfo).port;
    try {
      const belegt = lauf(String(port));
      expect(belegt.status).toBe(0);
      expect(belegt.stderr).toMatch(new RegExp(`WARNUNG: Auf Port ${port} läuft eine App`));
    } finally { await new Promise(ok => server.close(ok)); }
    const frei = lauf(String(port));
    expect(frei.status).toBe(0);
    expect(frei.stderr).not.toMatch(/WARNUNG/);
    expect(frei.stdout + frei.stderr).not.toContain('nur-fuer-den-test');
  });
});

// ─── Phase 0 (08.10.) — Freigaben › Protokoll und der Update-Hinweis ─────────────────────────────────────────────
// 1. Die Vollansicht /os/stapel/voll ist der Reiter „Protokoll“ der Freigaben (WEG.freigaben, Weiterleitung in next.config.mjs);
//    „Ändern & freigeben“ steht am offenen Vorschlag (lib/zoe/stapel-aendern.ts) — nichts an Funktion verloren.
// 2. Update-Hinweis: deploy/ausrollen.sh setzt/entfernt die Marke, die App liest sie (lib/bau/update.ts), GET /api/system/update
//    nur mit Sitzung und nur { laeuft, seit, bau }, die Zeile im Kopf fragt höchstens alle 60 s.
// Gegenprüfung 08.10.: Zahl-Felder nur als EINDEUTIGE Zahl („1.500“, „1500,50“), Herkunft des Anlasses, die drei Modi von
// ausrollen.sh wirklich ausgeführt (git/docker nachgebaut), Folge einer Antwort und „nicht doppelt“ rein geprüft, Zeile auch in /zoe.
// Eigener Datenordner, keine echten Daten.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { markeLesen, updateLage, updateAnzeige, antwortLesen, abfrageFaellig, abfrageFolge, hinweisZeigen, UPDATE_HOECHSTENS_MS, UPDATE_ABFRAGE_MS, UPDATE_MARKE } from '@/lib/bau/update';
import { aenderbareFelder, aenderungFehler, anlassText, darfAendern, eingabeMitAenderung, feldNachAenderung, hatAenderung, zahlAlsText, zahlAnzeige, zahlAusText, ZAHL_FEHLT, ZAHL_UNKLAR } from '@/lib/zoe/stapel-aendern';
import { WEG, freigabenReiterAus } from '@/lib/wege';
import { SEITEN_SUCHE } from '@/lib/make-one/seiten';
import { ROUTEN_REGISTER } from '@/lib/zugang/routen-register';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-phase0-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const MIN = 60_000;
const T = Date.parse('2026-10-08T10:00:00.000Z');

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Update-Hinweis — die Marke lesen (rein)', () => {
  const marke = (seit: string, ziel = 'abc1234') => JSON.stringify({ seit, ziel });
  it('frische Marke, Server lief schon vorher → Update läuft (seit als ISO)', () => {
    expect(updateLage(marke('2026-10-08T09:58:00Z'), { jetzt: T, start: T - 60 * MIN })).toEqual({ laeuft: true, seit: '2026-10-08T09:58:00.000Z' });
  });
  it('älter als 20 Minuten → ignoriert (abgebrochenes Ausrollen hinterlässt keinen Dauerhinweis)', () => {
    expect(UPDATE_HOECHSTENS_MS).toBe(20 * MIN);
    expect(updateLage(marke(new Date(T - 21 * MIN).toISOString()), { jetzt: T, start: T - 60 * MIN }).laeuft).toBe(false);
    expect(updateLage(marke(new Date(T - 19 * MIN).toISOString()), { jetzt: T, start: T - 60 * MIN }).laeuft).toBe(true);
  });
  it('eigener Bau-Stand: der Server ist NACH der Marke gestartet → erledigt', () => {
    expect(updateLage(marke(new Date(T - 5 * MIN).toISOString()), { jetzt: T, start: T - 2 * MIN })).toEqual({ laeuft: false, seit: null });
  });
  it('kaputt, leer, ohne seit oder weit in der Zukunft → kein Update', () => {
    for (const roh of [null, '', '{', '[]', '{"ziel":"abc1234"}', '{"seit":"gestern"}', 42]) expect(updateLage(roh, { jetzt: T, start: 0 }).laeuft, String(roh)).toBe(false);
    expect(updateLage(marke(new Date(T + 30 * MIN).toISOString()), { jetzt: T, start: 0 }).laeuft).toBe(false);
  });
  it('markeLesen: ziel nur als kurzer Commit, sonst weggelassen', () => {
    expect(markeLesen('{"seit":"2026-10-08T09:58:00Z","ziel":"9c3b0da"}')).toEqual({ seit: '2026-10-08T09:58:00Z', ziel: '9c3b0da' });
    expect(markeLesen('{"seit":"2026-10-08T09:58:00Z","ziel":""}')).toEqual({ seit: '2026-10-08T09:58:00Z' });
    expect(markeLesen({ seit: '2026-10-08T09:58:00Z', ziel: '<script>' })).toEqual({ seit: '2026-10-08T09:58:00Z' });
  });
  it('Anzeige: anderer Bau → „neu“ (Vorrang), sonst „läuft“ oder nichts; ohne eigene Kennung nie „neu“', () => {
    expect(updateAnzeige({ laeuft: false, bau: 'b2' }, 'b1')).toBe('neu');
    expect(updateAnzeige({ laeuft: true, bau: 'b2' }, 'b1')).toBe('neu');
    expect(updateAnzeige({ laeuft: true, bau: 'b1' }, 'b1')).toBe('laeuft');
    expect(updateAnzeige({ laeuft: false, bau: 'b1' }, 'b1')).toBeNull();
    expect(updateAnzeige({ laeuft: false, bau: 'b2' }, null)).toBeNull();
    expect(updateAnzeige({ laeuft: true, bau: null }, 'b1')).toBe('laeuft');
    expect(updateAnzeige(null, 'b1')).toBeNull();
  });
  it('Antwort prüfen und Abfrage-Takt: höchstens alle 60 s, außer sofort (nach 409 „neu laden“)', () => {
    expect(antwortLesen({ laeuft: true, seit: 'x', bau: 'b' })).toEqual({ laeuft: true, seit: 'x', bau: 'b' });
    expect(antwortLesen({ laeuft: 'ja' })).toBeNull();
    expect(antwortLesen(null)).toBeNull();
    expect(UPDATE_ABFRAGE_MS).toBe(60_000);
    expect(abfrageFaellig(null, T)).toBe(true);
    expect(abfrageFaellig(T - 59_000, T)).toBe(false);
    expect(abfrageFaellig(T - 60_000, T)).toBe(true);
    expect(abfrageFaellig(T - 1_000, T, true)).toBe(true);
  });
  it('Folge einer Antwort: 401/403 → nie wieder fragen, sonst kein 2xx → letzter Stand bleibt, 2xx → lesen', () => {
    expect(abfrageFolge(401)).toBe('aus');
    expect(abfrageFolge(403)).toBe('aus');
    for (const st of [500, 502, 503, 404, 409, 304]) expect(abfrageFolge(st), String(st)).toBe('behalten');
    expect(abfrageFolge(200)).toBe('lesen');
  });
  it('nie doppelt: zeigt die Bau-Wache schon „bitte neu laden“, steht „Neue Version da“ hier nicht — „Update läuft“ schon', () => {
    expect(hinweisZeigen('neu', true)).toBeNull();
    expect(hinweisZeigen('neu', false)).toBe('neu');
    expect(hinweisZeigen('laeuft', true)).toBe('laeuft');
    expect(hinweisZeigen(null, false)).toBeNull();
  });
});

describe('Update-Hinweis — Server und Route', () => {
  type Handler = (r: Request) => Promise<Response>;
  let route: { GET: Handler };
  let server: typeof import('@/lib/bau/update-server');
  const markePfad = () => path.join(ordner, 'system', UPDATE_MARKE);
  beforeAll(async () => {
    server = await import('@/lib/bau/update-server');
    route = (await import('@/app/api/system/update/route')) as unknown as typeof route;
  });
  afterEach(() => { rmSync(markePfad(), { force: true }); vi.unstubAllEnvs(); });

  it('liest <daten>/system/update.json — fehlt sie, läuft nichts', async () => {
    expect(server.updateMarkePfad()).toBe(markePfad());
    expect(await server.updateStand(T, T - 60 * MIN)).toEqual({ laeuft: false, seit: null });
    mkdirSync(path.dirname(markePfad()), { recursive: true });
    writeFileSync(markePfad(), JSON.stringify({ seit: new Date(T - MIN).toISOString(), ziel: 'abc1234' }));
    expect(await server.updateStand(T, T - 60 * MIN)).toEqual({ laeuft: true, seit: new Date(T - MIN).toISOString() });
    expect(await server.updateStand(T, T)).toEqual({ laeuft: false, seit: null }); // Server danach gestartet = erledigt
  });

  it('ohne Sitzung 401 — auch der Dienstweg ohne Sitzung bekommt nichts', async () => {
    const r = await route.GET(new Request('http://test/api/system/update'));
    expect(r.status).toBe(401);
    const d = await route.GET(new Request('http://test/api/system/update', { headers: { 'x-make-key': 'egal', 'x-make-person': 'jemand' } }));
    expect(d.status).toBe(401);
  });

  it('mit Sitzung nur { laeuft, seit, bau } — kein Commit, keine Inhalte, nicht zwischengespeichert', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-test-1');
    mkdirSync(path.dirname(markePfad()), { recursive: true });
    // Marke JETZT gesetzt — der Testprozess (= „Server“) läuft schon länger, das Update gilt also noch.
    writeFileSync(markePfad(), JSON.stringify({ seit: new Date(Date.now() + 1000).toISOString(), ziel: 'abc1234' }));
    const r = await route.GET(new Request('http://test/api/system/update', { headers: { 'x-make-user': 'testperson' } }));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const d = await r.json() as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(['bau', 'laeuft', 'seit']);
    expect(d.laeuft).toBe(true);
    expect(d.bau).toBe('bau-test-1');
    expect(JSON.stringify(d)).not.toContain('abc1234');
    // Ohne Marke: läuft nicht, seit leer.
    rmSync(markePfad(), { force: true });
    const leer = await (await route.GET(new Request('http://test/api/system/update', { headers: { 'x-make-user': 'testperson' } }))).json();
    expect(leer).toEqual({ laeuft: false, seit: null, bau: 'bau-test-1' });
  });

  it('steht im Routen-Register: Klasse person, nur GET, force-dynamic', () => {
    expect(ROUTEN_REGISTER['system/update']?.methoden).toEqual({ GET: 'person' });
    const q = lies('app/api/system/update/route.ts');
    expect(q).toContain("export const dynamic = 'force-dynamic'");
    expect(q).toContain('personDerSitzung(req)');
    expect(q).not.toMatch(/saveJson|updateJson|writeFile/); // Lesen schreibt nicht
  });
});

describe('Update-Hinweis — deploy/ausrollen.sh', () => {
  const skript = lies('deploy/ausrollen.sh');
  const zeilen = skript.split('\n');
  const von = zeilen.findIndex(z => z.startsWith('marke_setzen() {'));
  const bis = zeilen.findIndex(z => z.startsWith('marke_weg() {'));
  const funktionen = zeilen.slice(von, bis + 1).join('\n');

  it('bash -n: das Skript ist gültig', () => {
    expect(() => execFileSync('bash', ['-n', path.join(wurzel, 'deploy/ausrollen.sh')])).not.toThrow();
  });

  it('ziehen setzt die Marke NACH dem Ziehen; bild entfernt sie nach dem Tausch und bei jedem Abbruch; Modi wie bisher', () => {
    expect(von).toBeGreaterThan(0);
    expect(bis).toBeGreaterThan(von);
    expect(skript).toMatch(/ {2}ziehen\)\n {4}ziehen\n {4}marke_setzen\n/);
    expect(skript).toMatch(/trap 'rm -f "\$TMP"; marke_weg' EXIT/);
    expect(skript).toMatch(/docker compose up -d --no-build --remove-orphans\n {4}marke_weg\n/);
    expect(skript).toMatch(/docker compose up -d --build --remove-orphans\n {4}marke_weg\n/);
    // Die Modus-Logik und die Kennung für die Action bleiben.
    for (const s of ['case "$MODUS" in', '  ziehen)', '  bild)', '  *)', 'echo "ausrollen-v2"', 'git merge --ff-only origin/main', 'gunzip -c "$TMP" | docker load']) expect(skript).toContain(s);
    // Schreiben/Löschen hält das Ausrollen nie auf.
    expect(funktionen).toMatch(/\} 2>\/dev\/null \|\| true/);
    expect(funktionen).toMatch(/marke_weg\(\) \{ rm -f "\$MARKE" "\$MARKE\.tmp" 2>\/dev\/null \|\| true; \}/);
    // Die Action bleibt, wie sie war (ziehen, dann bild).
    const action = lies('.github/workflows/pruefen-und-ausrollen.yml');
    expect(action).toContain('$SSH ziehen </dev/null');
    expect(action).toContain('| $SSH bild');
  });

  it('die Marke entsteht als lesbares JSON, verschwindet wieder — und ein Schreibfehler bricht set -euo pipefail nicht ab', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'make-os-ausrollen-'));
    const gesperrt = path.join(tmp, 'gesperrt');
    mkdirSync(gesperrt); chmodSync(gesperrt, 0o500);
    try {
      const prog = [
        'set -euo pipefail',
        'MARKE="$1/daten/system/update.json"',
        funktionen,
        'marke_setzen',
        'cat "$MARKE"; echo',
        'marke_weg',
        '[ ! -e "$MARKE" ] && echo WEG',
        'MARKE="$2/unter/system/update.json"',
        'marke_setzen',
        'marke_weg',
        'echo WEITER',
      ].join('\n');
      const aus = execFileSync('bash', ['-c', prog, 'pruef', tmp, gesperrt], { cwd: tmp, encoding: 'utf8' });
      const [json] = aus.split('\n');
      const m = markeLesen(json);
      expect(m?.seit).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
      expect(Math.abs(Date.parse(m!.seit) - Date.now())).toBeLessThan(5 * MIN);
      expect(aus).toContain('WEG');
      expect(aus).toContain('WEITER');
      expect(existsSync(path.join(gesperrt, 'unter'))).toBe(false);
    } finally {
      chmodSync(gesperrt, 0o700);
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('Datenordner wie compose.yml: MAKE_OS_DATEN aus .env, sonst /srv/make-os/daten', () => {
    const daten = zeilen.filter(z => /^(DATEN|MARKE)=/.test(z)).join('\n');
    const tmp = mkdtempSync(path.join(tmpdir(), 'make-os-ausrollen-env-'));
    try {
      const prog = `set -euo pipefail\n${daten}\necho "$MARKE"`;
      expect(execFileSync('bash', ['-c', prog], { cwd: tmp, encoding: 'utf8' }).trim()).toBe('/srv/make-os/daten/system/update.json');
      writeFileSync(path.join(tmp, '.env'), 'MAKE_OS_KEY=x\nMAKE_OS_DATEN="/pruef/daten"\n');
      expect(execFileSync('bash', ['-c', prog], { cwd: tmp, encoding: 'utf8' }).trim()).toBe('/pruef/daten/system/update.json');
      expect(lies('compose.yml')).toContain('${MAKE_OS_DATEN:-/srv/make-os/daten}:/app/.data');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe('Update-Hinweis — deploy/ausrollen.sh wirklich ausgeführt (git/docker nachgebaut)', () => {
  // Das Skript, wie es ist — nur der feste Ordner und die Bild-Datei zeigen in den Prüfordner (genau je einmal ersetzt,
  // sonst merkt der Test, dass sich das Skript geändert hat). git/docker sind kleine Stellvertreter im PATH.
  const roh = lies('deploy/ausrollen.sh');
  const ersetze = (text: string, alt: string, neu: string) => { expect(text.split(alt).length - 1, alt).toBe(1); return text.replace(alt, neu); };
  let wurzelTmp: string, app: string, ablage: string, daten: string, protokoll: string, stubs: string, skript: string;
  const marke = () => path.join(daten, 'system', 'update.json');
  const markeSetzenVonHand = () => { mkdirSync(path.dirname(marke()), { recursive: true }); writeFileSync(marke(), JSON.stringify({ seit: new Date().toISOString(), ziel: 'abc1234' })); };
  const lauf = (modus: string, env: Record<string, string> = {}, eingabe?: Buffer) => {
    writeFileSync(protokoll, '');
    const r = spawnSync('bash', [skript], {
      cwd: wurzelTmp, input: eingabe ?? Buffer.alloc(0), encoding: 'utf8',
      env: { ...process.env, PATH: `${stubs}:${process.env.PATH}`, SSH_ORIGINAL_COMMAND: modus, PRUEF_APP: app, PRUEF_TMP: ablage, PRUEF_LOG: protokoll, PRUEF_MARKE: marke(), ...env },
    });
    return { status: r.status, aus: `${r.stdout}${r.stderr}`, log: readFileSync(protokoll, 'utf8') };
  };
  const bildReste = () => readdirSync(ablage).filter(n => n.startsWith('bild-'));

  beforeAll(() => {
    wurzelTmp = mkdtempSync(path.join(tmpdir(), 'make-os-ausrollen-lauf-'));
    app = path.join(wurzelTmp, 'app'); ablage = path.join(wurzelTmp, 'ablage'); daten = path.join(wurzelTmp, 'daten'); stubs = path.join(wurzelTmp, 'stubs');
    protokoll = path.join(wurzelTmp, 'protokoll.txt');
    for (const o of [app, ablage, daten, stubs]) mkdirSync(o, { recursive: true });
    writeFileSync(path.join(app, '.env'), `MAKE_OS_DATEN="${daten}"
`);
    let text = ersetze(roh, 'cd /srv/make-os/app', 'cd "$PRUEF_APP"');
    text = ersetze(text, 'mktemp /srv/make-os/bild-XXXXXX.tar.gz', 'mktemp "$PRUEF_TMP/bild-XXXXXX"');
    skript = path.join(wurzelTmp, 'ausrollen-pruef.sh');
    writeFileSync(skript, text);
    const stub = (name: string, inhalt: string) => { writeFileSync(path.join(stubs, name), `#!/bin/sh\n${inhalt}\n`); chmodSync(path.join(stubs, name), 0o755); };
    stub('git', [
      'echo "git $*" >> "$PRUEF_LOG"',
      'case "$1" in',
      '  log) case "$*" in *%s*) echo "abc1234 Pruefstand";; *) echo "abc1234";; esac;;',
      '  fetch|merge) [ -n "$STUB_GIT_FEHLER" ] && exit 1; exit 0;;',
      'esac',
      'exit 0',
    ].join('\n'));
    stub('docker', [
      'echo "docker $*" >> "$PRUEF_LOG"',
      'case "$1 $2" in',
      '  "load "*) cat >/dev/null; [ -n "$STUB_LOAD_FEHLER" ] && exit 1; exit 0;;',
      '  "compose up") [ -e "$PRUEF_MARKE" ] && echo "MARKE_BEIM_TAUSCH" >> "$PRUEF_LOG"; [ -n "$STUB_UP_FEHLER" ] && exit 1; exit 0;;',
      'esac',
      'exit 0',
    ].join('\n'));
  });
  afterAll(() => { rmSync(wurzelTmp, { recursive: true, force: true }); });
  afterEach(() => { rmSync(marke(), { force: true }); });

  const bild = () => gzipSync(Buffer.from('bild-inhalt'));

  it('ziehen: zieht, setzt danach die Marke (lesbar, mit kurzem Commit), endet gut', () => {
    const r = lauf('ziehen');
    expect(r.status, r.aus).toBe(0);
    expect(r.log).toMatch(/git fetch --quiet origin main\ngit merge --ff-only origin\/main/);
    const m = markeLesen(readFileSync(marke(), 'utf8'));
    expect(m?.ziel).toBe('abc1234');
    expect(Math.abs(Date.parse(m!.seit) - Date.now())).toBeLessThan(5 * MIN);
  });

  it('ziehen scheitert: keine Marke, Fehler', () => {
    const r = lauf('ziehen', { STUB_GIT_FEHLER: '1' });
    expect(r.status).not.toBe(0);
    expect(existsSync(marke())).toBe(false);
  });

  it('bild: Marke steht während des Tauschs und ist danach weg; die Bild-Datei auch', () => {
    markeSetzenVonHand();
    const r = lauf('bild', {}, bild());
    expect(r.status, r.aus).toBe(0);
    expect(r.log).toContain('docker load');
    expect(r.log).toMatch(/docker compose up -d --no-build --remove-orphans\nMARKE_BEIM_TAUSCH/);
    expect(existsSync(marke())).toBe(false);
    expect(bildReste()).toEqual([]);
  });

  it('bild: scheitert das Laden, ist die Marke weg, nichts getauscht, Fehler', () => {
    markeSetzenVonHand();
    const r = lauf('bild', { STUB_LOAD_FEHLER: '1' }, bild());
    expect(r.status).not.toBe(0);
    expect(r.log).toContain('docker load'); // wirklich bis zum Laden gekommen
    expect(r.log).not.toContain('compose up');
    expect(existsSync(marke())).toBe(false);
    expect(bildReste()).toEqual([]);
  });

  it('bild: scheitert das Tauschen, ist die Marke weg, Fehler', () => {
    markeSetzenVonHand();
    const r = lauf('bild', { STUB_UP_FEHLER: '1' }, bild());
    expect(r.status).not.toBe(0);
    expect(r.log).toContain('MARKE_BEIM_TAUSCH');
    expect(existsSync(marke())).toBe(false);
    expect(bildReste()).toEqual([]);
  });

  it('Altweg (ohne Modus): Marke beim Bauen, danach weg — auch wenn das Bauen scheitert', () => {
    const gut = lauf('');
    expect(gut.status, gut.aus).toBe(0);
    expect(gut.log).toMatch(/docker compose up -d --build --remove-orphans\nMARKE_BEIM_TAUSCH/);
    expect(existsSync(marke())).toBe(false);
    const schlecht = lauf('', { STUB_UP_FEHLER: '1' });
    expect(schlecht.status).not.toBe(0);
    expect(schlecht.log).toContain('MARKE_BEIM_TAUSCH');
    expect(existsSync(marke())).toBe(false);
  });
});

describe('Update-Hinweis — die Zeile im Kopf', () => {
  it('steht im Kopf (sticky mit ihm), fragt nur sichtbar, im 60-s-Takt und sofort nach „bitte neu laden“', () => {
    expect(lies('components/os/Kopf.tsx')).toContain('<UpdateHinweis />');
    const h = lies('components/os/UpdateHinweis.tsx');
    expect(h).toContain("fetch('/api/system/update', { cache: 'no-store' })");
    expect(h).toContain("document.visibilityState !== 'visible'");
    expect(h).toContain('NEU_LADEN_EREIGNIS');
    expect(h).toContain('abfrageFolge(r.status)'); // 401/403 beendet das Fragen (rein geprüft oben)
    expect(h).toContain('hinweisZeigen(updateAnzeige(antwort, bauKennung()), wacheZeigt)'); // nie doppelt neben der Bau-Wache
    expect(h).toContain('abfrageFaellig(letzte.current, Date.now(), sofort)');
    expect(h).toContain('bauKennung()');
    expect(h).toContain('window.location.reload()');
    expect(h).toContain('role="status"');
    // Bausteine und Token des Standards — keine Farb-Literale.
    expect(h).toContain("from './ui'");
    expect(h).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(lies('app/globals.css')).toMatch(/\.update-hinweis-text \{[^}]*text-overflow: ellipsis; white-space: nowrap;/);
  });
  it('steht auch im ZOE-Empfang /zoe (außerhalb von /os, ohne Kopf)', () => {
    expect(lies('app/zoe/page.tsx')).toContain('<ZoeStart />');
    expect(lies('app/os/layout.tsx')).not.toContain('ZoeStart');
    expect(lies('components/os/ZoeStart.tsx')).toContain('<UpdateHinweis />');
  });
});

describe('Freigaben › Protokoll (vorher /os/stapel/voll)', () => {
  it('Adresse über WEG, Reiter aus der Adresse, alte Seite leitet weiter', async () => {
    expect(WEG.freigaben()).toBe('/os/stapel');
    expect(WEG.freigaben('offen')).toBe('/os/stapel');
    expect(WEG.freigaben('protokoll')).toBe('/os/stapel?t=protokoll');
    expect(freigabenReiterAus('protokoll')).toBe('protokoll');
    for (const t of [null, undefined, '', 'voll', 'offen']) expect(freigabenReiterAus(t)).toBe('offen');
    expect(existsSync(path.join(wurzel, 'app/os/stapel/voll'))).toBe(false);
    expect(existsSync(path.join(wurzel, 'components/os/StapelVoll.tsx'))).toBe(false);
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    expect(regeln.find(r => r.source === '/os/stapel/voll')?.destination).toBe(WEG.freigaben('protokoll'));
    expect(SEITEN_SUCHE.find(s => s.id === 'stapel-protokoll')?.href).toBe('/os/stapel?t=protokoll');
    expect(SEITEN_SUCHE.some(s => s.href.includes('stapel/voll'))).toBe(false);
  });

  it('der Reiter „Protokoll“ trägt, was es nur in der Vollansicht gab: Rückgängig, ganzes Gedächtnis, Wissen', () => {
    const v = lies('components/os/StapelView.tsx');
    expect(v).toContain('<StapelProtokoll />');
    expect(v).toContain("router.push(WEG.freigaben(t), { scroll: false })");
    expect(v).not.toMatch(/['"`]\/os\/stapel\/voll/); // kein Link mehr (die Kommentare nennen die alte Adresse)
    const p = lies('components/os/StapelProtokoll.tsx');
    expect(p).toContain("fetch('/api/zoe/protokoll?anzahl=40')");
    expect(p).toContain("fetch('/api/zoe/protokoll', { method: 'POST'"); // Rückgängig
    expect(p).toContain('/api/zoe/gedaechtnis?id='); // vergessen
    expect(p).toContain("fetch('/api/zoe/wissen')");
    expect(p).toContain('{f.bis &&');
    expect(p).not.toMatch(/<Seite[ >]/); // ein Reiter, keine eigene Seite
    expect(lies('app/os/stapel/page.tsx')).toContain('<Suspense><StapelView /></Suspense>');
  });

  it('„Ändern & freigeben“ steht am offenen Vorschlag — mit gesperrtem Knopf und Grund am Feld, wenn eine Zahl unklar ist', () => {
    const v = lies('components/os/StapelView.tsx');
    expect(v).toContain('darfAendern(v)');
    expect(v).toContain('eingabeMitAenderung(v.eingabe, aendern[v.id])');
    expect(v).toContain("'Ändern & freigeben'");
    expect(v).toContain('aenderungFehler(v.eingabe, aendern[v.id])');
    expect(v).toContain('aus={busy === v.id || feldFehler.length > 0}');
    expect(v).toContain('if (aenderung && !aenderung.ok)'); // kommt der Klick trotzdem an: nichts an den Server
    expect(v).toContain('= {zahlAnzeige(lage.wert)}');
    expect(v).toContain('unter={anlassText(v) ??');
  });
  it('„Offen“ lädt nur im eigenen Reiter (kein 5-s-Takt, keine Head-Abfragen hinter dem Protokoll)', () => {
    const v = lies('components/os/StapelView.tsx');
    expect(v).toContain("const offenReiter = reiter === 'offen';");
    expect(v).toMatch(/if \(!offenReiter\) return;\n\s+void laden\(\);/);
    expect(v).toMatch(/if \(!offenReiter\) return;\n\s+let aktiv = true;/);
    expect(v).toContain('if (!inArbeit || !offenReiter) return;');
  });
});

describe('„Ändern & freigeben“ — die Eingabe (rein)', () => {
  const eingabe = { betrag: 120, titel: 'Rechnung Beispiel', notiz: '', bezahlt: false, liste: ['a', 'b'], objekt: { a: 1 }, _stand: { x: 1 } };
  const mit = (geaendert: Record<string, string>, e: Record<string, unknown> = eingabe) => {
    const r = eingabeMitAenderung(e, geaendert);
    if (!r.ok) throw new Error(`unerwartet abgelehnt: ${JSON.stringify(r.fehler)}`);
    return r.eingabe;
  };
  it('nur Text und Zahl, ohne interne Schlüssel; eine Zahl steht mit Komma da (ohne Tausenderpunkte)', () => {
    expect(aenderbareFelder(eingabe)).toEqual([
      { schluessel: 'betrag', wert: '120', zahl: true },
      { schluessel: 'titel', wert: 'Rechnung Beispiel', zahl: false },
      { schluessel: 'notiz', wert: '', zahl: false },
    ]);
    expect(aenderbareFelder(null)).toEqual([]);
    expect(aenderbareFelder({ betrag: 1500.5 })[0].wert).toBe('1500,5');
    expect(zahlAlsText(-0.25)).toBe('-0,25');
  });
  it('volle Eingabe zurück: Unverändertes wie es war (kein „[object Object]“), Zahl bleibt Zahl, unbekannte Schlüssel nie', () => {
    expect(mit({ betrag: '150,5', titel: 'Neu', fremd: 'x', objekt: 'kaputt' })).toEqual({ ...eingabe, betrag: 150.5, titel: 'Neu' });
    // Unverändert (auch die eigene Anzeige „1500,5“) → genau der alte Wert, nichts neu gelesen.
    expect(mit({ betrag: '1500,5' }, { betrag: 1500.5 })).toEqual({ betrag: 1500.5 });
    expect(mit({ x: '0,125' }, { x: 0.125 }).x).toBe(0.125);
  });
  it('deutsche Zahlen: „1.500“ ist 1500 (nicht 1,5), „1500,50“ ist 1500,5 (nicht Text) — Gegenprüfung 08.10.', () => {
    expect(mit({ betrag: '1.500' }).betrag).toBe(1500);
    expect(mit({ betrag: '1500,50' }).betrag).toBe(1500.5);
    expect(mit({ betrag: '1.500,50' }).betrag).toBe(1500.5);
    expect(typeof mit({ betrag: '1500,50' }).betrag).toBe('number');
    for (const [text, zahl] of [
      ['1500', 1500], ['-3', -3], ['+7', 7], ['1,5', 1.5], ['0,5', 0.5], ['-1.500', -1500], ['12.345.678', 12345678], ['1.234.567,89', 1234567.89],
      ['12.5', 12.5], ['1.5', 1.5], ['0.125', 0.125], ['1500.505', 1500.505], [' 1 500 € ', 1500], ['1\u00a0500', 1500],
    ] as const) expect(zahlAusText(text), text).toBe(zahl);
    for (const text of ['', '  ', 'viel', '1,2,3', '1.50,5', '1500,', '1e5', '0x10', '19 %', 'Infinity', '1.2.3', '--1', '1,500.50', 'NaN']) expect(zahlAusText(text), text).toBeNull();
    expect(zahlAnzeige(1500)).toBe('1.500');
    expect(zahlAnzeige(1500.5)).toBe('1.500,5');
  });
  it('keine eindeutige Zahl → nichts geht raus, das Feld sagt warum (statt Text an das Werkzeug)', () => {
    expect(eingabeMitAenderung(eingabe, { betrag: 'viel', titel: 'Neu' })).toEqual({ ok: false, fehler: [{ schluessel: 'betrag', grund: ZAHL_UNKLAR }] });
    expect(eingabeMitAenderung(eingabe, { betrag: '' })).toEqual({ ok: false, fehler: [{ schluessel: 'betrag', grund: ZAHL_FEHLT }] });
    expect(aenderungFehler(eingabe, { betrag: '1,2,3' })).toEqual([{ schluessel: 'betrag', grund: ZAHL_UNKLAR }]);
    expect(aenderungFehler(eingabe, { betrag: '1.500', titel: '' })).toEqual([]); // Text darf leer sein, eine Zahl nicht
    const zahlFeld = aenderbareFelder(eingabe)[0];
    expect(feldNachAenderung(zahlFeld, '120')).toBeNull();
    expect(feldNachAenderung(zahlFeld, '1.500')).toEqual({ wert: 1500 });
    expect(feldNachAenderung(zahlFeld, 'x')).toEqual({ grund: ZAHL_UNKLAR });
  });
  it('erkennt echte Änderungen; Vorschläge einer Art (Aufgabe, CRM) laufen über ihren eigenen Weg', () => {
    expect(hatAenderung(eingabe, {})).toBe(false);
    expect(hatAenderung(eingabe, { betrag: '120' })).toBe(false);
    expect(hatAenderung(eingabe, { betrag: '121' })).toBe(true);
    expect(hatAenderung(eingabe, { toString: 'x' })).toBe(false);
    expect(darfAendern({ eingabe })).toBe(true);
    expect(darfAendern({ eingabe, bezug: { art: 'crm', id: 'x' } })).toBe(false);
    expect(darfAendern({ eingabe: { objekt: { a: 1 } } })).toBe(false);
  });
  it('Herkunft des Anlasses: „weil du gesagt hast“ nur für einen Satz aus dem Gespräch, sonst „ZOE: …“', () => {
    expect(anlassText({ anlass: 'Trag den Block ein', quelle: 'gespraech' })).toBe('weil du gesagt hast: „Trag den Block ein“');
    expect(anlassText({ anlass: 'Trag den Block ein' })).toBe('weil du gesagt hast: „Trag den Block ein“'); // ohne Angabe = Gespräch (ausfuehren.ts)
    expect(anlassText({ anlass: 'Lücke am Dienstag', quelle: 'lauf' })).toBe('ZOE: Lücke am Dienstag');
    expect(anlassText({ anlass: 'Kunde wartet seit zwei Wochen', quelle: 'gespraech', bezug: { art: 'crm', id: 'x' } })).toBe('ZOE: Kunde wartet seit zwei Wochen');
    expect(anlassText({ anlass: 'Takt: Durchsicht' })).toBe('ZOE: Takt: Durchsicht');
    expect(anlassText({ anlass: '  ' })).toBeNull();
    expect(anlassText({})).toBeNull();
  });
});

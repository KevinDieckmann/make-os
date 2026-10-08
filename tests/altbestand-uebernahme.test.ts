// ─── Wächter: einmalige Übernahme des Altbestands (08.10. abends, Fragebogen Teil 3, Frage 2) ─────────────────────────
// Kevin: „Meine bisherigen Inhalte einmalig in meine Daten übernehmen, dann aus dem Code löschen.“ Die Übernahme läuft NUR
// mit MAKE_OS_ALTBESTAND_PERSON, genau einmal, nie über vorhandene Daten, Gesundheitsteile nur mit Einwilligung (a).
// Die Tests übergeben ERFUNDENEN Inhalt (das Modul nimmt den Inhalt als Parameter) — der bisherige Inhalt wird hier nie
// gelesen oder ausgegeben; nur seine Form/Länge gegen die Grenzen und die Exportnamen der alten Datei werden geprüft.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-altbestand-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KI_VORGABE = 'sparsam';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_DEMO;

let db: typeof import('@/lib/store/local-db');
let ab: typeof import('@/lib/altbestand/uebernahme');
let K: typeof import('@/lib/gesundheit/koerper');
const datei = (name: string) => path.join(ordner, `${name}.json`);
const roh = (name: string) => (existsSync(datei(name)) ? readFileSync(datei(name), 'utf8') : null);

/** Erfundener Inhalt — Platzhalter, keine echten Angaben. */
const PLATZHALTER = (): import('@/lib/gesundheit/koerper').KoerperStand => ({
  ...K.leererKoerper(),
  leitsatz: 'PLATZHALTER-LEITSATZ',
  beschwerden: [{ id: 'kb-alt-1', name: 'Platzhalter A', status: 'offen', notiz: 'PLATZHALTER-NOTIZ', ton: 'achtung' }],
  hebel: [{ id: 'kh-alt-1', name: 'Platzhalter-Hebel', notiz: '', kennzahl: 'schlaf' }],
  symptom: { name: 'Platzhalter-Symptom' },
  sauberZaehler: true,
});

/** Konten der Prüf-Instanz — `inhaber` = wer die Rolle Inhaber trägt (die Übernahme geht nur an den Inhaber). */
const kontenMitInhaber = (inhaber: string) => db.saveJson('konten', { konten: ['pia', 'olaf', 'uwe', 'vera'].map((p, i) => ({
  id: String(i + 1), speicher: p, email: `${p}@example.invalid`, name: `${p} Prüf`, rolle: p === inhaber ? 'inhaber' : 'mitglied',
  hash: 'x', salz: 'x', angelegt: '2026-10-10T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-alt',
})), einladungen: [] });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ab = await import('@/lib/altbestand/uebernahme');
  K = await import('@/lib/gesundheit/koerper');
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  await kontenMitInhaber('pia');
  for (const p of ['pia', 'olaf', 'vera']) expect((await ein.gesundheitErklaeren(p, 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
});
beforeEach(async () => { delete process.env.MAKE_OS_ALTBESTAND_PERSON; delete process.env.MAKE_OS_DEMO; await kontenMitInhaber('pia'); });
afterAll(() => {
  delete process.env.MAKE_OS_ALTBESTAND_PERSON;
  rmSync(ordner, { recursive: true, force: true });
});

const teile = () => [ab.koerperTeil(PLATZHALTER()) as import('@/lib/altbestand/uebernahme').AltbestandTeil];

describe('Übernahme des Altbestands', () => {
  it('ohne Variable passiert nichts — kein Bestand entsteht', async () => {
    const b = await ab.altbestandUebernehmen({ teile: teile() });
    expect(b).toEqual({ lauf: false, grund: 'keine Variable', teile: [] });
    expect(roh('gesundheit-koerper--pia')).toBeNull();
  });

  it('Demo-Instanz (MAKE_OS_DEMO=1) oder Person ohne Konto: nichts, auch mit Variable', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'pia';
    process.env.MAKE_OS_DEMO = '1';
    expect((await ab.altbestandUebernehmen({ teile: teile() })).lauf).toBe(false);
    delete process.env.MAKE_OS_DEMO;
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'niemand';
    expect((await ab.altbestandUebernehmen({ teile: teile() })).grund).toBe('kein Konto');
    process.env.MAKE_OS_ALTBESTAND_PERSON = '../kaputt';
    expect((await ab.altbestandUebernehmen({ teile: teile() })).lauf).toBe(false);
    expect(roh('gesundheit-koerper--pia')).toBeNull();
  });

  it('mit Variable genau einmal — die zweite Runde schreibt nichts mehr', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'pia';
    const b1 = await ab.altbestandUebernehmen({ teile: teile(), tag: '2026-10-09' });
    expect(b1.teile).toEqual([{ name: 'koerper', ergebnis: 'uebernommen' }]);
    const nachEins = roh('gesundheit-koerper--pia');
    expect(nachEins).toContain('PLATZHALTER-LEITSATZ');
    const gespeichert = K.koerperSaeubern(JSON.parse(nachEins!))!;
    expect(gespeichert.altbestand).toBe('2026-10-09');
    expect(gespeichert.symptom).toEqual({ name: 'Platzhalter-Symptom' });
    expect(gespeichert.sauberZaehler).toBe(true);
    const b2 = await ab.altbestandUebernehmen({ teile: teile(), tag: '2026-10-10' });
    expect(b2.teile).toEqual([{ name: 'koerper', ergebnis: 'schon-uebernommen' }]);
    expect(roh('gesundheit-koerper--pia')).toBe(nachEins);
  });

  it('nie über vorhandene Daten: hat die Person schon selbst etwas gepflegt, bleibt es unverändert', async () => {
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await kontenMitInhaber('olaf');
    await db.saveJson(speicherFuer('gesundheit-koerper', 'olaf'), { ...K.leererKoerper(), leitsatz: 'Olafs eigener Satz' });
    const vorher = roh('gesundheit-koerper--olaf');
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'olaf';
    const b = await ab.altbestandUebernehmen({ teile: teile() });
    expect(b.teile).toEqual([{ name: 'koerper', ergebnis: 'ziel-belegt' }]);
    expect(roh('gesundheit-koerper--olaf')).toBe(vorher);
  });

  it('nur Anzeige-Einstellungen gesetzt (Regler vermisst, bevor die Übernahme lief) → zählt NICHT als belegt; ihre Einstellungen gewinnen', async () => {
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await kontenMitInhaber('vera');
    // Vera hat vorher nur Regler/Zähler/einen Satz eingeschaltet — kein Inhalt.
    await db.saveJson(speicherFuer('gesundheit-koerper', 'vera'), { ...K.leererKoerper(), symptom: { name: 'Veras Regler' }, sauberZaehler: false,
      routinenHinweise: [{ id: 'kr-eigen', routine: 'r-eins', text: 'Veras Satz' }] });
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'vera';
    const inhalt = { ...PLATZHALTER(), routinenHinweise: [{ id: 'kr-alt-1', routine: 'r-eins', text: 'alter Satz' }, { id: 'kr-alt-2', routine: 'r-zwei', text: 'zweiter alter Satz' }] };
    const b = await ab.altbestandUebernehmen({ teile: [ab.koerperTeil(inhalt) as import('@/lib/altbestand/uebernahme').AltbestandTeil], tag: '2026-10-09' });
    expect(b.teile).toEqual([{ name: 'koerper', ergebnis: 'uebernommen' }]);
    const k = K.koerperSaeubern(JSON.parse(roh('gesundheit-koerper--vera')!))!;
    expect(k.leitsatz).toBe('PLATZHALTER-LEITSATZ');
    expect(k.altbestand).toBe('2026-10-09');
    expect(k.symptom).toEqual({ name: 'Veras Regler' }); // ihre Einstellung gewinnt
    expect(k.sauberZaehler).toBe(true); // eine Seite hat ihn an
    expect(k.routinenHinweise.map(h => h.text)).toEqual(['Veras Satz', 'zweiter alter Satz']); // je Routine ihr Satz, der Rest dazu
  });

  it('ohne Einwilligung (a) wird der Gesundheitsteil übersprungen — kein Bestand', async () => {
    await kontenMitInhaber('uwe');
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'uwe';
    const b = await ab.altbestandUebernehmen({ teile: teile() });
    expect(b.teile).toEqual([{ name: 'koerper', ergebnis: 'ohne-einwilligung' }]);
    expect(roh('gesundheit-koerper--uwe')).toBeNull();
  });

  it('die Variable nennt ein Konto, das NICHT Inhaber ist → nichts (nie Art.-9-Inhalte in ein fremdes Profil)', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'olaf'; // Mitglied (Inhaber ist pia), mit Einwilligung (a)
    const vorher = roh('gesundheit-koerper--olaf');
    const b = await ab.altbestandUebernehmen({ teile: teile() });
    expect(b).toEqual({ lauf: false, grund: 'nicht Inhaber', teile: [] });
    expect(roh('gesundheit-koerper--olaf')).toBe(vorher);
  });

  it('Kennzahl je Hebel: genauer Name oder Name beginnt mit dem Schlüssel', () => {
    expect(ab.hebelKennzahl('Schlaf')).toBe('schlaf');
    expect(ab.hebelKennzahl('Bewegung & mehr')).toBe('reha');
    expect(ab.hebelKennzahl('Etwas anderes')).toBeUndefined();
  });
});

describe('Der bisherige Inhalt liegt nur noch im Übernahme-Modul', () => {
  const wurzel = path.resolve(__dirname, '..');
  const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

  it('health-data.ts exportiert keine der früheren Konstanten mehr (geprüft über die Exportnamen)', async () => {
    const hd = await import('@/lib/make-one/health-data');
    for (const name of ['NORTHSTAR', 'WHOOP', 'BESCHWERDEN', 'HEBEL', 'AUFBAU', 'ZUSAMMENHAENGE', 'CARE_NOTE']) expect(Object.keys(hd), name).not.toContain(name);
    const quelle = lies('lib/make-one/health-data.ts');
    for (const name of ['NORTHSTAR', 'WHOOP', 'BESCHWERDEN', 'HEBEL', 'AUFBAU', 'ZUSAMMENHAENGE', 'CARE_NOTE', 'Beschwerde', 'Hebel', 'Stufe']) {
      expect(new RegExp(`export\\s+(const|interface|type)\\s+${name}\\b`).test(quelle), name).toBe(false);
    }
  });

  it('niemand außer dem Start-Haken importiert das Übernahme-Modul — nie der Browser', () => {
    const funde: string[] = [];
    const lauf = (d: string) => {
      for (const n of readdirSync(path.join(wurzel, d))) {
        const rel = `${d}/${n}`;
        if (statSync(path.join(wurzel, rel)).isDirectory()) { if (n !== 'node_modules') lauf(rel); continue; }
        if (!/\.(ts|tsx|mjs)$/.test(n) || rel === 'lib/altbestand/uebernahme.ts') continue;
        if (/(from\s*|import\(\s*)['"][^'"]*altbestand\/uebernahme['"]/.test(lies(rel))) funde.push(rel);
      }
    };
    for (const d of ['app', 'components', 'lib', 'context', 'hooks']) if (existsSync(path.join(wurzel, d))) lauf(d);
    expect(funde).toEqual(['lib/store/betrieb.ts']);
  });

  it('Gesundheits-Ansicht und Vitalwerte ohne Personen-Sonderfall und ohne feste Inhalte', () => {
    const gv = lies('components/os/GesundheitView.tsx');
    expect(gv).not.toContain('health-data');
    expect(gv).not.toContain('HEBEL_KENNZAHL');
    expect(gv).not.toMatch(/=== 'kevin'|=== 'malin'/);
    const v = lies('lib/vitals.ts');
    expect(v).not.toContain('health-data');
    expect(v).not.toMatch(/'kevin'|'malin'/);
  });

  it('der bisherige Inhalt passt in die Grenzen des Körper-Profils (die Person kann jede Zeile bearbeiten) — nur Pfade, nie Inhalte', async () => {
    const [teil] = ab.altbestandTeile();
    const k = teil.inhalt as import('@/lib/gesundheit/koerper').KoerperStand;
    const G = K.KOERPER_GRENZEN;
    const zuLang: string[] = [];
    const pruef = (pfad: string, t: string, max: number) => { if (t.length > max) zuLang.push(pfad); };
    pruef('leitsatz', k.leitsatz, G.leitsatz);
    pruef('hinweis', k.hinweis, G.lang);
    k.beschwerden.forEach((b, i) => { pruef(`beschwerden.${i}.name`, b.name, G.name); pruef(`beschwerden.${i}.status`, b.status, G.status); pruef(`beschwerden.${i}.notiz`, b.notiz, G.lang); });
    k.hebel.forEach((h, i) => { pruef(`hebel.${i}.name`, h.name, G.name); pruef(`hebel.${i}.notiz`, h.notiz, G.lang); if (h.kennzahl && !K.KENNZAHL_OK.test(h.kennzahl)) zuLang.push(`hebel.${i}.kennzahl`); });
    k.stufen.forEach((s, i) => { pruef(`stufen.${i}.phase`, s.phase, G.status); pruef(`stufen.${i}.name`, s.name, G.name); pruef(`stufen.${i}.beschreibung`, s.beschreibung, G.lang); });
    k.zusammenhaenge.forEach((z, i) => pruef(`zusammenhaenge.${i}`, z.text, G.satz));
    k.routinenHinweise.forEach((h, i) => pruef(`routinenHinweise.${i}`, h.text, G.satz));
    if (k.symptom) pruef('symptom', k.symptom.name, G.name);
    expect(zuLang).toEqual([]);
    // Form: Säubern ändert nichts (alle Kennungen gültig, nichts fällt weg), Anzeige-Einstellungen AN wie bisher.
    const s = K.koerperSaeubern(JSON.parse(JSON.stringify(k)))!;
    expect(s.beschwerden.length + s.hebel.length + s.stufen.length + s.zusammenhaenge.length).toBe(k.beschwerden.length + k.hebel.length + k.stufen.length + k.zusammenhaenge.length);
    expect(s.beschwerden.length).toBeGreaterThan(0);
    expect(!!s.symptom && s.sauberZaehler).toBe(true);
    expect(teil.art9).toBe(true);
  });
});

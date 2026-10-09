// ─── Wächter: keine Ziele, Werte oder Sonderfälle EINER Person im Verhalten (08.10. abends, Fragebogen Teil 3) ──────────
// Kevin: „Alles als eigene Daten je Person/Instanz … Feste Kevin/Malin-Stellen vollständig neutralisieren.“
// Geprüft wird VERHALTEN mit erfundenen Werten (eigener Datenordner) und — wo es nur statisch geht — der Quelltext auf
// Personen-Abfragen. Nie echte Gesundheitsangaben in diesem Test.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-privat-neutral-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

describe('Vitalwerte ohne feste Rückfallwerte (Verhalten)', () => {
  it('ohne Einträge: Nullen, Stand „—“, fallback — auch für das Erstkonto (Bestand ohne Suffix)', async () => {
    const { resolveVitals } = await import('@/lib/vitals');
    for (const p of ['kevin', 'pia']) {
      expect(await resolveVitals('2026-10-09', p), p).toEqual({ rec: 0, sleep: 0, hrv: 0, rhr: 0, stand: '—', heute: false, alterTage: 999, fallback: true });
    }
  });

  it('mit Einträgen: die eigenen Werte; fehlende Felder bleiben 0 (keine Angabe); andere Personen lesen nicht mit', async () => {
    const { resolveVitals } = await import('@/lib/vitals');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await db.saveJson(speicherFuer('vitals', 'pia'), { '2026-10-08': { rec: 61 } });
    expect(await resolveVitals('2026-10-09', 'pia')).toMatchObject({ rec: 61, sleep: 0, hrv: 0, rhr: 0, stand: '2026-10-08', heute: false, alterTage: 1, fallback: false });
    expect((await resolveVitals('2026-10-09', 'olaf')).fallback).toBe(true);
  });

  it('vitalsKurz zeigt fehlende Werte als „—“; ohne Recovery plant der Fokus GELB (`tagesZone`)', async () => {
    const { vitalsKurz, tagesZone } = await import('@/lib/vitals');
    expect(vitalsKurz({ rec: 0, sleep: 0, hrv: 0, rhr: 0 })).toBe('Recovery —, Schlaf —');
    expect(vitalsKurz({ rec: 70, sleep: 7.5, hrv: 0, rhr: 0 }, ['rec', 'sleep', 'hrv'])).toBe('Recovery 70%, Schlaf 7.5h, HRV —');
    expect(tagesZone(0)).toBe('GELB');
    expect(tagesZone(80)).toBe('GRÜN');
    expect(tagesZone(30)).toBe('ROT');
  });
});

describe('Reha-Schild nur für die eigene Routine (vorher: Ziel einer Person für alle)', () => {
  it('nie Reha geplant → kein Schild; Reha in den letzten 14 Tagen und heute keiner → Schild; heute Reha oder nichts geplant → keiner', async () => {
    const { rehaFehltHeute } = await import('@/lib/risk');
    const heute = '2026-10-09';
    const fokus = { date: heute, art: 'fokus' };
    expect(rehaFehltHeute([fokus], heute)).toBe(false);
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }, fokus], heute)).toBe(true);
    expect(rehaFehltHeute([{ date: '2026-09-20', art: 'reha' }, fokus], heute)).toBe(false); // länger her als 14 Tage
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }, fokus, { date: heute, art: 'reha' }], heute)).toBe(false);
    expect(rehaFehltHeute([{ date: '2026-10-02', art: 'reha' }], heute)).toBe(false); // heute gar nichts geplant
  });
  it('Tagesplanung „Durchgeplant“: Prüfpunkt Reha nur mit eigener Reha-Gewohnheit (Demo-Rundgang 08.10.: stand fest für jede Person)', async () => {
    const { rehaGewohnt } = await import('@/lib/planung/reha-regel');
    const heute = '2026-10-09';
    expect(rehaGewohnt([], heute)).toBe(false);
    expect(rehaGewohnt([{ date: '2026-10-02', art: 'reha' }], heute)).toBe(true);
    expect(rehaGewohnt([{ date: heute, art: 'reha' }], heute)).toBe(false); // heute zählt nicht als Gewohnheit
    expect(rehaGewohnt([{ date: '2026-09-20', art: 'reha' }], heute)).toBe(false);
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/TagesplanView.tsx'), 'utf-8');
    expect(quelle).toContain('rehaGewohnt(');
    expect(quelle).not.toMatch(/\{ ok: meine\.some\(b => b\.art === 'reha'\), text: 'Reha' \}/);
  });
});

describe('Quelltext: keine Abfrage einer festen Person', () => {
  it('Gesundheits-Takt (Telegram) fragt Symptom und Zähler nur nach den eigenen Modulen (EINE Regel, 09.10.)', () => {
    const lauf = lies('lib/gesundheit/lauf.ts');
    expect(lauf).not.toMatch(/===\s*'(kevin|malin)'/);
    expect(lauf).toContain('moduleUndKoerper');
    // Index und Takt fragen dieselbe Regel — keine eigene „geführt“-Rechnung daneben.
    expect(lies('lib/gesundheit/index.ts')).toMatch(/modulZaehlt\(b\.module\?\.haut/);
    expect(lies('lib/gesundheit/index.ts')).not.toMatch(/t60\.some/);
  });

  it('ZOE-Morgen/-Abend und Empfang nehmen nie den Rückfall von `personAus`', () => {
    for (const d of ['app/api/zoe/morgen/route.ts', 'app/api/zoe/empfang/route.ts']) expect(lies(d), d).not.toMatch(/personAus\(/);
  });

  // Vault- und Brain-Sicht (09.10., PRIVATE_INHALTE_SUCHE.md Paket 5): wer was sieht, wem eine Notiz ohne `owner` gehört, für wen
  // eine Regel gilt und wer einen Vorschlag sieht, kommt aus den Konten — kein Name, auch nicht in Kommentaren, Prompts oder als
  // Ordner-Muster. Verhalten (Kundeninstanz, Gold-Vergleich Altbestand, Systemlauf): tests/vault-sicht.test.ts.
  it('Vault, Brain-Inbox, Regeln, Konsolidierung und ihre Routen/Oberflächen nennen keine Person', () => {
    const DATEIEN = ['lib/zoe/vault.ts', 'lib/brain/inbox.ts', 'lib/brain/regeln.ts', 'lib/brain/konsolidierung.ts', 'lib/brain/kugel-server.ts',
      'components/os/wissen/Regeln.tsx', 'components/os/wissen/Inbox.tsx', 'app/api/brain/regeln/route.ts', 'app/api/brain/inbox/route.ts', 'app/api/zoe/wissen/route.ts'];
    for (const d of DATEIEN) expect(lies(d), d).not.toMatch(/kevin|malin/i);
    // Die Brain-Routen nehmen die Person aus dem Tor, nie aus dem Rückfall von `personAus`.
    for (const d of ['app/api/brain/regeln/route.ts', 'app/api/brain/inbox/route.ts', 'app/api/zoe/wissen/route.ts']) expect(lies(d), d).not.toMatch(/personAus\(/);
    // `darfSehen` prüft nur eine aus den Konten aufgelöste Sicht (der Typ erzwingt es) — es gibt keine zweite Sicht-Regel daneben.
    expect(lies('lib/zoe/vault.ts')).toMatch(/export function darfSehen\(n: \{ scope\?: string; owner\?: string \}, s: VaultSicht\)/);
  });
});

// ─── Gesundheits-Module und ihre Umgebung: nur allgemeine Begriffe (09.10., PRIVATE_INHALTE_SUCHE.md Paket 2 › C) ────────
// Keine konkrete Diagnose, Behandlungsart, Fachrichtung zu einer Körperstelle, Körperstelle oder Substanz — weder in Code noch in
// Kommentaren, Bausteinen, Mustern oder Standards. Die Liste ist bewusst ALLGEMEIN (keine echte Angabe einer Person — die stehen
// nie in einem Test). Wer eine neue Datei zu Gesundheits-Modulen, Bausteinen oder Standards anlegt: hier aufnehmen.
describe('Gesundheits-Module, Bausteine, Muster: keine konkreten Diagnosen, Behandlungen, Körperstellen, Substanzen', () => {
  const KONKRET = /chronisch|entzündlich|entzuendlich|kortison|cortison|salbe|tablette|medikament|infusion|spritze|dermatolog|neurolog|orthopäd|orthopaed|hautarzt|nikotin|tabak|rücken|ruecken|nacken|hüfte|gelenk/i;
  const DATEIEN = [
    ...readdirSync(path.join(wurzel, 'lib/gesundheit')).filter(n => n.endsWith('.ts')).map(n => `lib/gesundheit/${n}`),
    ...readdirSync(path.join(wurzel, 'components/os/gesundheit')).filter(n => n.endsWith('.tsx')).map(n => `components/os/gesundheit/${n}`),
    'app/api/state/haut/route.ts', 'app/api/state/streak/route.ts', 'app/api/state/journal/route.ts',
    'app/api/gesundheit/koerper/route.ts', 'app/api/gesundheit/stand/route.ts', 'app/api/gesundheit/index/route.ts',
    'components/os/GesundheitView.tsx', 'components/os/JournalView.tsx', 'components/os/EnergieView.tsx', 'components/os/TagesplanView.tsx',
    'components/os/kalender/Planen.tsx', 'lib/planung/bloecke.ts', 'lib/planung/reha-regel.ts', 'lib/risk.ts',
  ];
  it('keine Zeile der Dateien trifft die allgemeine Wortliste', () => {
    const funde = DATEIEN.flatMap(d => lies(d).split('\n').map((z, i) => ({ d, i: i + 1, z })).filter(x => KONKRET.test(x.z)).map(x => `${x.d}:${x.i}`));
    expect(funde).toEqual([]);
  });
  it('die Muster für Gesundheitstermine liegen an EINER Stelle (Index und Energie-Ansicht)', () => {
    expect(lies('components/os/EnergieView.tsx')).toContain("from '@/lib/gesundheit/muster'");
    expect(lies('components/os/EnergieView.tsx')).not.toMatch(/const GES_(TERMIN|BLOCK)\s*=/);
    expect(lies('lib/gesundheit/index.ts')).not.toMatch(/const GES_(TERMIN|BLOCK)\s*=/);
  });
  it('der Wächter greift (Gegenprobe mit erfundenem Text)', () => {
    expect(KONKRET.test('Baustein „Reha / Nacken“')).toBe(true);
    expect(KONKRET.test('Baustein „Training / Sport“')).toBe(false);
  });
});

describe('Oberfläche: ein Speichern sendet genau einmal', () => {
  // Ein Knopf `typ="submit"` mit eigenem `onClick` schickt zweimal (Klick + Absenden des Formulars) — beim Körper-Profil kam
  // so nach jedem Speichern ein 409. Formulare senden nur über `onSubmit`.
  it('kein `<Knopf typ="submit" … onClick=…>` unter components/', () => {
    const funde: string[] = [];
    const lauf = (d: string) => {
      for (const n of readdirSync(path.join(wurzel, d))) {
        const rel = `${d}/${n}`;
        if (statSync(path.join(wurzel, rel)).isDirectory()) { lauf(rel); continue; }
        if (!n.endsWith('.tsx')) continue;
        const q = lies(rel);
        let i = q.indexOf('typ="submit"');
        while (i >= 0) {
          const anfang = q.lastIndexOf('<Knopf', i);
          const ende = q.indexOf('</Knopf>', i);
          if (anfang >= 0 && ende > i && /onClick=/.test(q.slice(anfang, ende))) funde.push(rel);
          i = q.indexOf('typ="submit"', i + 1);
        }
      }
    };
    lauf('components');
    expect(funde).toEqual([]);
  });
});

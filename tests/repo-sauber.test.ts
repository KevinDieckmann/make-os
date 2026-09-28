// ─── Keine Kontodaten im Repo ───────────────────────────────────────────────
// Kevin: „An Dritte geht nur der Rohbau — Code, Regeln, Struktur. Nie Daten.“
// Seit dem Umzug der Haushaltsfinanzen (24.09.) liegen echte Buchungen in
// .data/ (gitignored). Dieser Test prüft jede Datei, die Git kennt, auf die
// Spuren echter Kontodaten: vollständige IBANs, N26-Auszugszeilen, Exporte.

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, statSync } from 'fs';

const IBAN = /\bDE\d{2}(?:\s?\d{4}){4}\s?\d{2}\b/g;
/** Nur echte Nummern zählen: Prüfsumme nach ISO 13616 (mod 97 = 1). Platzhalter wie „DE00 0000 …“ fallen durch. */
function echteIban(text: string): boolean {
  for (const m of Array.from(text.matchAll(IBAN))) {
    const iban = m[0].replace(/\s/g, '');
    const umgestellt = iban.slice(4) + iban.slice(0, 4);
    const ziffern = umgestellt.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    let rest = 0;
    for (const z of ziffern) rest = (rest * 10 + Number(z)) % 97;
    if (rest === 1) return true;
  }
  return false;
}
const N26_ZEILE = /(Dein (alter|neuer) Kontostand|Ausgehende Transaktionen)\s+[+-][\d.]*\d,\d{2}/;
const EXPORT = /"_typ"\s*:\s*"(make-orga-sicherung|kd-finanz-backup)"/;

function dateien(): string[] {
  try { return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { return []; }
}

describe('Repo ohne Kontodaten', () => {
  it('Prüfsumme erkennt echte IBANs, Platzhalter nicht', () => {
    // Zur Laufzeit zusammengesetzt, damit diese Datei sich nicht selbst meldet.
    expect(echteIban(['DE89', '3704', '0044', '0532', '0130', '00'].join(' '))).toBe(true);
    expect(echteIban('DE00 0000 0000 0000 0000 00')).toBe(false);
  });

  it('keine IBAN, keine Auszugszeile, kein Finanz-Export in versionierten Dateien', () => {
    const funde: string[] = [];
    for (const f of dateien()) {
      if (/\.(png|jpe?g|gif|ico|woff2?|mp3|mp4|pdf|zip)$/i.test(f)) continue;
      let text = '';
      try { if (statSync(f).size > 3_000_000) continue; text = readFileSync(f, 'utf8'); } catch { continue; }
      if (echteIban(text)) funde.push(`${f}: IBAN`);
      if (N26_ZEILE.test(text)) funde.push(`${f}: N26-Auszugszeile`);
      if (EXPORT.test(text) && !f.startsWith('tests/') && !f.startsWith('lib/')) funde.push(`${f}: Finanz-Export`);
    }
    expect(funde, funde.join('\n')).toEqual([]);
  });
});

// ─── Startbestände ohne echte Daten (28.09., K1) ────────────────────────────
// Ein SEED greift, wenn ein Speicher leer ist — er ist Code, geht also mit dem Rohbau an Dritte.
// Vorher standen dort echte Kunden, ein Privatkredit mit Betrag und Gesundheits-Etappen. Jeder
// `SEED`-Block in einer versionierten Datei wird auf Namen Dritter, Banken, private Themen und
// Beträge geprüft. Die Muster sind zur Laufzeit zusammengesetzt, damit diese Datei sich nicht selbst meldet.
const VERBOTEN_IM_SEED = new RegExp(['One' + 'Banking', 'Bj(ö|oe)' + 'rn', 'Gre' + 'gor', 'Vi' + 'vid', 'AC' + 'ME', 'Canna' + 'bis', 'Infil' + 'tration', 'Zoo ' + 'Palais', 'Volks' + 'bank', 'Kredit'].join('|'), 'i');
const BETRAG_IM_SEED = /\b(betrag|cashflow|kontostand|preis)\s*:\s*[1-9]|\b\d{1,3}_\d{3}\b/;

/** Alle `const SEED`-Blöcke einer Datei (bis zur schließenden Klammer am Zeilenanfang). */
function seedBloecke(text: string): string[] {
  const raus: string[] = [];
  const re = /(?:export\s+)?const\s+SEED\b[^=]*=\s*[[{]/g;
  for (const m of Array.from(text.matchAll(re))) {
    const rest = text.slice(m.index!);
    const ende = rest.search(/\n[\]}];?\s*\n/);
    raus.push(ende < 0 ? rest : rest.slice(0, ende + 3));
  }
  return raus;
}

describe('Startbestände (SEED) ohne echte Daten', () => {
  it('der Prüfer erkennt Namen Dritter und Beträge', () => {
    const probe = ['export const SEED = [', `  { id: 'x', kunde: '${'One' + 'Banking'}', betrag: 17_000 },`, '];', ''].join('\n');
    const b = seedBloecke(probe);
    expect(b.length).toBe(1);
    expect(VERBOTEN_IM_SEED.test(b[0])).toBe(true);
    expect(BETRAG_IM_SEED.test(b[0])).toBe(true);
  });

  it('kein SEED-Block in versionierten Dateien trägt Namen Dritter, private Themen oder Beträge', () => {
    const funde: string[] = [];
    for (const f of dateien()) {
      if (!/\.(ts|tsx|mjs|js)$/.test(f) || f.startsWith('tests/')) continue;
      let text = '';
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
      for (const b of seedBloecke(text)) {
        const name = b.match(VERBOTEN_IM_SEED);
        if (name) funde.push(`${f}: SEED enthält „${name[0]}“`);
        if (BETRAG_IM_SEED.test(b)) funde.push(`${f}: SEED enthält einen Betrag`);
      }
    }
    expect(funde, funde.join('\n')).toEqual([]);
  });
});

// ─── „Heute“ ist der Berliner Tag (28.09., K3 · #75/#77) ────────────────────
// `new Date().toISOString().slice(0, 10)` und `jetzt.slice(0, 10)` (jetzt = ISO in
// UTC) liefern den UTC-Tag — nachts bis 2 Uhr (MESZ) ist das noch gestern. Für
// „heute“ gilt `localDay()`, für den Tag eines Zeitstempels `tagVon()` (lib/zeit.ts).
// Neue Fundstellen lassen diesen Wächter rot werden; echte Ausnahmen stehen unten
// mit Grund (Datums-Rechnung um 12:00 UTC ist unproblematisch und fällt nicht darunter).
import { readdirSync } from 'fs';
import path from 'path';

const HEUTE_UTC = /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)|new Date\(Date\.now\(\)[^)]*\)\.toISOString\(\)\.slice\(0, ?10\)|(?:^|[^A-Za-z0-9_$])jetzt(?:\(\))?\.slice\(0, ?10\)/;
/** Datei → Grund. Nur, was (noch) nicht „heute“ meint oder in einem anderen Paket liegt. */
const HEUTE_AUSNAHMEN: Record<string, string> = {
  'lib/make-one/crm.ts': 'Paket K2 (Identität & Import) — Vergleich „liegt in der Zukunft“, dort umstellen',
  'lib/crm/dubletten.ts': 'Paket K2 — geaendertAm beim Zusammenführen, dort umstellen',
  'lib/crm/speicher.ts': 'Paket K4 (CRM-Bestand) — Verzeichnis-Stand und Kampagnen-/Power-Hour-Tage, dort umstellen',
  'lib/hoi/lage.ts': 'Kopfzeile der HOI-Meldung (Paket HOI) — nur Anzeige',
};

function quelltexte(ordner: string): string[] {
  const aus: string[] = [];
  let eintraege: import('fs').Dirent[] = [];
  try { eintraege = readdirSync(ordner, { withFileTypes: true }); } catch { return aus; }
  for (const e of eintraege) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) aus.push(...quelltexte(p)); }
    else if (/\.(ts|tsx)$/.test(e.name)) aus.push(p);
  }
  return aus;
}

describe('„Heute“ nie als UTC-Tag', () => {
  it('der Wächter erkennt die Muster (und lässt Datums-Rechnung um 12:00 UTC durch)', () => {
    expect(HEUTE_UTC.test("const heute = new Date().toISOString().slice(0, 10);")).toBe(true);
    expect(HEUTE_UTC.test('geaendertAm: jetzt.slice(0, 10)')).toBe(true);
    expect(HEUTE_UTC.test('letzteAktivitaet: ctx.jetzt.slice(0, 10)')).toBe(true);
    expect(HEUTE_UTC.test('d >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)')).toBe(true);
    expect(HEUTE_UTC.test("const d = new Date(`${t}T12:00:00Z`); return d.toISOString().slice(0, 10);")).toBe(false);
    expect(HEUTE_UTC.test('const heute = localDay(); const tag = tagVon(jetzt);')).toBe(false);
  });

  it('keine neue Fundstelle in lib/, app/, components/, hooks/', () => {
    const funde: string[] = [];
    for (const f of ['lib', 'app', 'components', 'hooks'].flatMap(o => quelltexte(o))) {
      const rel = f.split(path.sep).join('/');
      if (HEUTE_AUSNAHMEN[rel]) continue;
      const zeilen = readFileSync(f, 'utf8').split('\n');
      zeilen.forEach((z, i) => { if (HEUTE_UTC.test(z)) funde.push(`${rel}:${i + 1}: ${z.trim().slice(0, 120)}`); });
    }
    expect(funde, `„heute“ als UTC-Tag — localDay()/tagVon() aus lib/zeit.ts nehmen:\n${funde.join('\n')}`).toEqual([]);
  });
});

// ─── Keine echten Namen Dritter im Code (28.09., U3) ────────────────────────
// Außerhalb der Startbestände standen noch Namen aus Team, Kundschaft, Kanzleien,
// Banken und privaten Vorgängen — in Prompts, Kommentaren, Beispielterminen,
// Beschriftungen und Tests. Neutral sind „Beispiel GmbH“, „Kunde A“, „Anna Beispiel“,
// Rollen („Finanzen“, „Kanzlei“). Kevin und Malin bleiben. Die Muster sind nur
// Teilstücke, zur Laufzeit zusammengesetzt — diese Datei meldet sich nicht selbst.
// Groß-/Kleinschreibung zählt: `bjoernRest` (Feld im Rechenkern) ist kein Treffer.
const NAMEN_DRITTER = new RegExp([
  '\\bFra' + 'nk\\b', 'Math' + 'ick', '\\bAle' + 'x(ander)?\\b', 'Oph' + 'off', '\\bCle' + 'mens\\b', '\\bBj(ö|oe)' + 'rn',
  'Fren' + 'trup', 'Kronen' + 'berger', '\\bLi' + 'sa\\b', 'Goh' + 'lke', 'Kathar' + 'ina', 'Heins' + 'chke', 'H(ö|oe)pp' + 'ner',
  'Aka' + 'sha', '\\bJ(ö|oe)' + 'rn\\b', 'Lie' + 'tz\\b', 'One ?Ban' + 'king', 'One[ -]Fin' + 'ance', '\\bGre' + 'gor\\b', 'Grego' + 'sch',
  'Grze' + 'gorz', 'Augu' + 'styn', '\\bAC' + 'ME\\b', 'Vene' + 'tian', '\\bVi' + 'vid\\b', 'Witt' + 'ner', 'Volks' + 'bank', 'Cul' + 'pra',
  'Qua' + 'pler', 'Stern' + 'berg', 'Strei' + 'ner', 'Jes' + 'ke\\b', 'Reach-?O' + 'ut', 'Dani' + 'lo\\b', 'Kem' + 'pen\\b',
  'Zoo ' + 'Palais', 'Marc ' + 'Fis' + 'cher', 'BF ' + 'Beteiligungen',
].join('|'));

/** Datei → Grund. Nur, was in einem anderen Paket liegt oder bewusst bleibt. */
const NAMEN_AUSNAHMEN: Record<string, string> = {
  'homepage/pruefen.mjs': 'Sperrliste der Homepage-Prüfung (Paket Homepage) — dort auf Teilstücke umstellen',
};
/** Kevins geprüfter Rechenkern: zwei Beschriftungen im Zahlungskalender bleiben (nur mit Kevins Wort ändern). */
const ERLAUBTE_STELLEN: Record<string, string[]> = {
  'lib/finanzen/rechenkern.ts': ["'" + 'Bj' + "örn-Rate'", "'Eingang One" + " Banking'"],
  'tests/finanzplan-rechenkern.test.ts': ["'Eingang One" + " Banking'"],
};

/** E-Mail-Adressen im Code (außer Tests): nur reservierte Domains oder Kevins eigene Adresse. */
const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const MAIL_ERLAUBT = (m: string) => /\.(invalid|example|test|localhost)$/i.test(m) || /@example\.(com|org|net|de)$/i.test(m) || m === ['k.dieckmann', 'kemaris.de'].join('@');

describe('Keine echten Namen Dritter im Code', () => {
  it('der Prüfer erkennt Namen und lässt Platzhalter, Monatskürzel und Rechenkern-Felder durch', () => {
    expect(NAMEN_DRITTER.test(['Team:', 'Fra' + 'nk,', 'Li' + 'sa'].join(' '))).toBe(true);
    expect(NAMEN_DRITTER.test('Mandat ' + 'One' + 'Banking')).toBe(true);
    expect(NAMEN_DRITTER.test("{ name: 'Person A (Finanzen)', kurz: 'Finanzen' } · Kunde A · Beispiel GmbH · Anna Beispiel")).toBe(false);
    expect(NAMEN_DRITTER.test("['Jan', 'Feb'] · Frankfurt · kdvBjoern: 0, bjoernRest: 0 · Acme GmbH")).toBe(false);
    expect(MAIL_ERLAUBT('k@test.invalid')).toBe(true);
    expect(MAIL_ERLAUBT('hallo@make-os.example')).toBe(true);
    expect(MAIL_ERLAUBT('jemand@firma-beispiel.de')).toBe(false);
  });

  it('keine Namen Dritter in versionierten Code-Dateien (Ausnahmen mit Grund)', () => {
    const funde: string[] = [];
    for (const f of dateien()) {
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(f) || f === 'tests/repo-sauber.test.ts' || NAMEN_AUSNAHMEN[f]) continue;
      let text = '';
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
      for (const s of ERLAUBTE_STELLEN[f] ?? []) text = text.split(s).join("''");
      text.split('\n').forEach((z, i) => { const m = z.match(NAMEN_DRITTER); if (m) funde.push(`${f}:${i + 1}: „${m[0]}“`); });
    }
    expect(funde, `Namen Dritter — durch Platzhalter ersetzen („Beispiel GmbH“, „Kunde A“, Rolle):\n${funde.join('\n')}`).toEqual([]);
  });

  it('keine echten E-Mail-Adressen im Code außerhalb von Tests', () => {
    const funde: string[] = [];
    for (const f of dateien()) {
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(f) || f.startsWith('tests/') || f.startsWith('lib/crm/') || NAMEN_AUSNAHMEN[f]) continue;
      let text = '';
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
      for (const m of Array.from(text.matchAll(MAIL))) if (!MAIL_ERLAUBT(m[0])) funde.push(`${f}: ${m[0]}`);
    }
    expect(funde, funde.join('\n')).toEqual([]);
  });
});

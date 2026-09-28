// ─── Keine Kontodaten im Repo ───────────────────────────────────────────────
// Kevin: „An Alex geht nur der Rohbau — Code, Regeln, Struktur. Nie Daten.“
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

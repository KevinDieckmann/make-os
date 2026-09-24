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

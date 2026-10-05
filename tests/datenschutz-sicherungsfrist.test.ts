// ─── Wächter: Sicherungsfrist wahrheitsgemäß, Grabsteine länger als jede Sicherung (05.10.) ─
// Vorher stand überall „Sicherungen 14 Tage“ — deploy/generationen.sh behält aber 14 Tages-, 8 Wochen- und 12 Monatsgenerationen.
// Dieser Test liest die Skripte, lässt die echte Aufräum-Logik (bash + awk) über zwei Jahre Tagesarchive laufen und vergleicht:
//   · die Generationen in den Skripten = SICHERUNG_GENERATIONEN (die Texte rechnen damit),
//   · die älteste behaltene Sicherung ist höchstens ~12 Monate alt (der Text sagt „bis zu 12 Monate“),
//   · die Grabstein-Frist (Standard UND Minimum) ist länger als die älteste behaltene Sicherung — sonst holte ein Restore
//     eine gelöschte Person zurück, deren Grabstein schon weg ist.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LOESCHFRISTEN, SICHERUNG_GENERATIONEN, SICHERUNG_SATZ, fristenWirksam } from '@/lib/crm/loeschfristen';
import { LOESCHREGELN } from '@/lib/crm/datenschutz';
import { datenschutzHinweis, HINWEIS_FRISTEN_STANDARD } from '@/lib/kalender/buchung';

const TAG_MS = 86_400_000;
const tag = (d: Date) => d.toISOString().slice(0, 10);

/** Die echte Funktion aus deploy/generationen.sh über eine Liste von Dateinamen laufen lassen → die zu löschenden. */
function weg(namen: string[], t: number, w: number, m: number): Set<string> {
  const raus = execFileSync('bash', ['-c', `source deploy/generationen.sh; generationen_weg ${t} ${w} ${m}`], { input: namen.join('\n') + '\n', encoding: 'utf8' });
  return new Set(raus.split('\n').filter(Boolean));
}

describe('Sicherungs-Generationen und Texte', () => {
  it('die Skripte räumen mit genau den Generationen auf, mit denen die Texte rechnen', () => {
    const g = SICHERUNG_GENERATIONEN;
    for (const f of ['deploy/sicherung.sh', 'deploy/sicherung-abholen.sh']) {
      const m = /generationen_aufraeumen\s+"\$[A-Z_]+"\s+(\d+)\s+(\d+)\s+(\d+)/.exec(readFileSync(f, 'utf8'));
      expect(m, f).toBeTruthy();
      expect([Number(m![1]), Number(m![2]), Number(m![3])], f).toEqual([g.taeglich, g.woechentlich, g.monatlich]);
    }
    // Die Standardwerte der Funktion selbst ebenso (wer ohne Zahlen aufruft, bekommt dasselbe).
    expect(readFileSync('deploy/generationen.sh', 'utf8')).toContain(`-v T="\${1:-${g.taeglich}}" -v W="\${2:-${g.woechentlich}}" -v M="\${3:-${g.monatlich}}"`);
  });

  it('älteste behaltene Sicherung ≤ 12 Monate; Grabsteine (Standard und Minimum) halten länger', () => {
    const heute = new Date('2026-10-05T03:15:00Z');
    const namen = Array.from({ length: 800 }, (_, i) => `make-os-${tag(new Date(heute.getTime() - i * TAG_MS))}.tar.gz.age`);
    const g = SICHERUNG_GENERATIONEN;
    const geloescht = weg(namen, g.taeglich, g.woechentlich, g.monatlich);
    const behalten = namen.filter(n => !geloescht.has(n));
    expect(behalten.length).toBeLessThanOrEqual(g.taeglich + g.woechentlich + g.monatlich);
    const aeltester = behalten.map(n => n.slice(8, 18)).sort()[0];
    const alterTage = Math.round((heute.getTime() - Date.parse(`${aeltester}T03:15:00Z`)) / TAG_MS);
    expect(alterTage).toBeGreaterThan(300); // wirklich Monatsgenerationen — nicht 14 Tage
    expect(alterTage).toBeLessThanOrEqual(366); // „bis zu 12 Monate“ stimmt
    const grab = LOESCHFRISTEN.find(f => f.id === 'grabsteine')!;
    const monatTage = 365 / 12;
    expect(grab.standard * monatTage).toBeGreaterThan(alterTage + 14); // mit Rand
    expect(grab.min * monatTage).toBeGreaterThan(alterTage + 14);       // auch nicht unter das Minimum einstellbar
    expect(fristenWirksam({ grabsteine: 1 }).grabsteine).toBeGreaterThanOrEqual(grab.min);
  });

  it('auch mit Lücken (Monate ohne Sicherung) bleibt der Grabstein länger als die behaltene Monatsgeneration', () => {
    // Nur jeden 3. Tag eine Sicherung und ein ganzer Monat Ausfall — die Monatsgenerationen reichen dann etwas weiter zurück.
    const heute = new Date('2026-10-05T03:15:00Z');
    const namen = Array.from({ length: 800 }, (_, i) => new Date(heute.getTime() - i * TAG_MS)).filter((d, i) => i % 3 === 0 && tag(d).slice(0, 7) !== '2026-03').map(d => `make-os-${tag(d)}.tar.gz.age`);
    const g = SICHERUNG_GENERATIONEN;
    const geloescht = weg(namen, g.taeglich, g.woechentlich, g.monatlich);
    const aeltester = namen.filter(n => !geloescht.has(n)).map(n => n.slice(8, 18)).sort()[0];
    const alterTage = Math.round((heute.getTime() - Date.parse(`${aeltester}T03:15:00Z`)) / TAG_MS);
    expect(LOESCHFRISTEN.find(f => f.id === 'grabsteine')!.min * (365 / 12)).toBeGreaterThan(alterTage);
  });

  it('Löschfrist, Löschkonzept, Auskunft und Hinweis an Kontakte nennen „bis zu 12 Monate“ — nirgends mehr „14 Tage“ für Sicherungen', () => {
    const f = LOESCHFRISTEN.find(x => x.id === 'sicherungen')!;
    expect(f.anzeige).toBe(`bis zu ${SICHERUNG_GENERATIONEN.monatlich} Monate`);
    expect(f.hinweis).toBe(SICHERUNG_SATZ);
    expect(SICHERUNG_SATZ).toMatch(/bis zu 12 Monate/);
    expect(SICHERUNG_SATZ).toMatch(/überschrieben/);
    expect(SICHERUNG_SATZ).toMatch(/erneut gelöscht/);
    expect(LOESCHREGELN.find(r => r.id === 'sicherungen')?.frist).toMatch(/12 Monate/);
    expect(datenschutzHinweis(HINWEIS_FRISTEN_STANDARD)).toContain(SICHERUNG_SATZ);
    expect(readFileSync('app/api/crm/datenschutz/route.ts', 'utf8')).toContain('sicherungen: SICHERUNG_SATZ');
    for (const datei of ['lib/crm/loeschfristen.ts', 'lib/crm/datenschutz.ts', 'lib/crm/person-bestaende.ts']) {
      expect(/Sicherungen?[^\n]{0,40}14 Tage/.test(readFileSync(datei, 'utf8').replace(/14 Tages-/g, '')), datei).toBe(false);
    }
  });
});

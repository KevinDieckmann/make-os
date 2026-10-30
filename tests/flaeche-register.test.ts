// ─── Flächen-Register (30.10., Kevin: „Das Anpassen der Karten überall weitermachen“) ───────────────────────────────────────────────────
// Jede <Flaeche seite="…"> steht im Register (lib/flaeche/register.ts), keine Kennung doppelt, keine gespeicherte Kennung verloren,
// Bereich je Fläche richtig (Katalog und Server lesen ihn aus der Kennung). Liest nur den Quelltext.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { FLAECHEN, FRUEHER, SEITEN_MAX } from '@/lib/flaeche/register';
import { seiteOk } from '@/lib/flaeche/modell';
import { spaceAusFlaeche } from '@/lib/flaeche/space';
import { FLAECHE } from '@/lib/crm/flaechen';

const wurzel = path.resolve(__dirname, '..');
const lies = (f: string) => readFileSync(path.join(wurzel, f), 'utf8');
function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const n of readdirSync(path.join(wurzel, ordner))) {
    const p = path.join(ordner, n);
    if (statSync(path.join(wurzel, p)).isDirectory()) aus.push(...dateien(p));
    else if (/\.tsx$/.test(n)) aus.push(p);
  }
  return aus;
}
const QUELLEN = [...dateien('components'), ...dateien('app')];
const KENNUNGEN = FLAECHEN.map(f => f.seite);

/** Dynamische Kennungen: wo sie stehen und was sie werden können. */
const DYNAMISCH: Record<string, { muster: RegExp; werte: string[] }> = {
  'components/os/HorizontView.tsx': { muster: /<Flaeche seite=\{`planung-\$\{horizont\}`\}/, werte: ['planung-monat', 'planung-quartal', 'planung-jahr'] },
  'components/os/aufgaben/Ueberblick.tsx': { muster: /<Flaeche seite=\{nur \? `aufgaben-ueberblick-\$\{nur\}` : 'aufgaben-ueberblick'\}/, werte: ['aufgaben-ueberblick', 'aufgaben-ueberblick-privat', 'aufgaben-ueberblick-business'] },
  'components/os/HeuteView.tsx': { muster: /<Flaeche key=\{sicht\} seite=\{HEUTE_FLAECHE\[sicht\]\}/, werte: ['uebersicht-privat', 'uebersicht-business'] },
  'components/os/crm/Events.tsx': { muster: /<Flaeche seite=\{FLAECHE\.event\}/, werte: [FLAECHE.event] },
  'components/os/crm/marketing/Uebersicht.tsx': { muster: /<Flaeche seite=\{FLAECHE\.marketing\}/, werte: [FLAECHE.marketing] },
};

describe('Flächen-Register', () => {
  it('jede Kennung genau einmal, gültige Form, unter der Höchstzahl je Person', () => {
    expect(new Set(KENNUNGEN).size).toBe(KENNUNGEN.length);
    for (const k of [...KENNUNGEN, ...FRUEHER]) expect(seiteOk(k), k).toBe(true);
    expect(KENNUNGEN.length + FRUEHER.length).toBeLessThanOrEqual(SEITEN_MAX);
    expect(KENNUNGEN.filter(k => FRUEHER.includes(k))).toEqual([]);
  });

  it('jede <Flaeche seite="…"> im Quelltext steht im Register — und umgekehrt', () => {
    const benutzt = new Set<string>();
    const unbekannt: string[] = [];
    for (const f of QUELLEN) {
      const t = lies(f);
      for (const m of t.matchAll(/<Flaeche\b[^>]*?\bseite=("([^"]*)"|\{)/g)) {
        if (m[2] !== undefined) {
          if (f === 'components/os/flaeche/Flaeche.tsx') continue; // Beispiele im Kopfkommentar
          benutzt.add(m[2]);
          if (!KENNUNGEN.includes(m[2])) unbekannt.push(`${f}: ${m[2]}`);
        } else {
          const d = DYNAMISCH[f];
          expect(d, `${f}: dynamische Kennung — in DYNAMISCH eintragen`).toBeTruthy();
          expect(t, f).toMatch(d.muster);
          d.werte.forEach(w => benutzt.add(w));
        }
      }
    }
    expect(unbekannt).toEqual([]);
    expect(KENNUNGEN.filter(k => !benutzt.has(k))).toEqual([]);
  });

  it('der Bereich folgt aus der Kennung: Privat-Flächen zeigen keine Business-Widgets und umgekehrt', () => {
    for (const k of ['sport-plan', 'sport-training', 'sport-hyrox', 'sport-lauf', 'sport-gym', 'sport-erholung', 'gesundheit-heute', 'gesundheit-koerper', 'finanzen-ueberblick-privat', 'aufgaben-ueberblick-privat', 'uebersicht-privat']) {
      expect(spaceAusFlaeche(k), k).toBe('privat');
    }
    for (const k of ['controlling-business', 'aufgaben-ueberblick-business', 'uebersicht-business', 'markttraktion-ueberblick']) expect(spaceAusFlaeche(k), k).toBe('business');
    for (const k of ['aufgaben-ueberblick', 'planung-tag', 'planung-jahr']) expect(spaceAusFlaeche(k), k).toBe('alle');
  });

  it('feste Kennungen bleiben (gespeicherte Layouts hängen daran)', () => {
    for (const k of ['gesundheit-heute', 'gesundheit-koerper', 'gesundheit-erholung', 'ernaehrung', 'journal', 'uebersicht-privat', 'uebersicht-business', 'business', 'zahlen', 'markttraktion-ueberblick']) {
      expect(KENNUNGEN, k).toContain(k);
    }
    expect(FRUEHER).toContain('home');
  });
});

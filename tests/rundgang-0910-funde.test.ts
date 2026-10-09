// Funde aus dem Rundgang der Endprüfung 09.10. (Demo-Instanz, Bilder): deutsche Zahlform, „Als Nächstes“ verdrängt den Titel nicht,
// die ZOE-Kugel verdeckt am Handy die Reiter der Agenten-Seite nicht.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { restzeitText } from '@/lib/make-one/onboarding-data';
import { werIstDran } from '@/lib/crm/heute';
import { leererBestand } from '@/lib/crm/speicher';
import type { Chance } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const lies = (p: string) => readFileSync(p, 'utf8');

describe('Rundgang 09.10. — Funde', () => {
  it('Restzeit der Einrichtung in deutscher Zahlform', () => {
    expect(restzeitText(45)).toBe('45 Min.');
    expect(restzeitText(528)).toBe('rund 8,8 Std.');
    expect(restzeitText(540)).toBe('rund 9 Std.');
    expect(restzeitText(78)).toBe('rund 1,3 Std.');
  });

  it('Übersicht und Heute-Widget nutzen dieselbe Stelle, keine englischen Dezimalzahlen in sichtbaren Texten', () => {
    for (const p of ['components/os/OnboardingView.tsx', 'components/os/flaeche/widgets.tsx']) {
      const s = lies(p);
      expect(s).toContain('restzeitText(');
      expect(s).not.toMatch(/\/ 60 \* 10\) \/ 10\}? Std/);
    }
    for (const p of ['components/os/BoardView.tsx', 'components/os/TageslaufView.tsx', 'components/os/datenschutz/Nachweise.tsx', 'components/os/sport/Einstieg.tsx']) {
      expect(lies(p)).not.toMatch(/toFixed\(1\)\}?( Mon\.|s<| MB)|\/ 60 \* 10\) \/ 10\} h/);
    }
  });

  it('„Als Nächstes“: Wiederholung steht unter dem Titel, nicht daneben', () => {
    const s = lies('components/os/agenten/Hintergrund.tsx');
    const zeile = s.slice(s.indexOf('function NaechstesZeile'), s.indexOf('export function AlsNaechstes'));
    expect(zeile).toContain("flexDirection: 'column'");
    expect(zeile.indexOf('{n.titel}')).toBeLessThan(zeile.indexOf('wiederholText(n, jetzt)'));
  });

  it('ZOE-Kugel am Handy auf der Agenten-Seite ausgeblendet (Reiter bleiben frei)', () => {
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('className="agenten-reiter-handy"');
    expect(lies('app/globals.css')).toMatch(/body:has\(\.agenten-reiter-handy\) \.zoe-fab \{ display: none !important; \}/);
  });
  it('„Wer heute dran ist“: Daten deutsch kurz statt ISO („Entscheidung bis 23.10.“, „fällig 08.10.“)', () => {
    const k: Kontakt = { id: 'c-a', vorname: 'Erika', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'gespraech', telefon: '030', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' };
    const ch = (id: string, x: Partial<Chance>): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot',
      historie: [{ stufe: 'angebot', am: '2026-10-05', von: 'lena' }], gesellschaft: 'kdc', besitzer: 'lena', angelegt: '2026-10-01', geaendert: '2026-10-05', ...x } as Chance);
    const heute = '2026-10-09';
    const bald = werIstDran([k], { ...leererBestand(), chancen: [ch('ch-b', { erwartetAm: '2026-10-23', naechsterSchritt: { text: 'Nachfassen', datum: '2026-10-20' } })] }, heute, null);
    const t1 = bald.karten.flatMap(x => x.gruende).join(' | ');
    expect(t1).toContain('Entscheidung bis 23.10.');
    expect(t1).not.toMatch(/\b2026-\d\d-\d\d\b/);
    const faellig = werIstDran([k], { ...leererBestand(), chancen: [ch('ch-f', { naechsterSchritt: { text: 'Angebot nachfassen', datum: '2026-10-08' } })] }, heute, null);
    const t2 = faellig.karten.flatMap(x => x.gruende).join(' | ');
    expect(t2).toContain('(fällig 08.10.)');
    const anderesJahr = werIstDran([k], { ...leererBestand(), chancen: [ch('ch-j', { erwartetAm: '2027-01-02', historie: [{ stufe: 'angebot', am: '2026-12-20', von: 'lena' }], geaendert: '2026-12-20', naechsterSchritt: { text: 'x', datum: '2026-12-30' } })] }, '2026-12-28', null);
    expect(anderesJahr.karten.flatMap(x => x.gruende).join(' | ')).toContain('Entscheidung bis 02.01.2027');
  });
});

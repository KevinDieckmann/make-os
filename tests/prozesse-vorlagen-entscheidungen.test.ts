// ─── Prozesse · Kundengewinnung — Kevins Entscheidungen E-V4 und E-V7 (22.10.), vorher → nachher ─────────────────────────────────────────────────────
// E-V4: „Keine Entscheidung“ ist ein FESTER Verlustgrund — angehängt (nie umsortiert), ein gleichnamiger eigener Wert gilt weiter (ohne Doppel); die Vorlage V13
//       (Verloren / keine Entscheidung) nennt ihn, jeder Grund in einer Vorlage steht in der Auswahl.
// E-V7: „48 h“ heißt überall 2 WERKTAGE (Mo–Fr ohne Feiertage NRW) — die Follow-up-Quote besuchter Events (lib/crm/besuche.ts) und die Nachfass-Frist der eigenen
//       Abende (lib/crm/events.ts `followUpBis`); der Text der Definition sagt es. Mo–Mi bleibt alles wie vorher, Do/Fr/vor Feiertagen rückt die Frist weiter.
import { describe, it, expect } from 'vitest';
import { VERLUSTGRUENDE, verlustgruende } from '@/lib/crm/pipeline';
import { besuchFollowupFrist, besuchWirkung, FOLLOWUP_QUOTE_DEFINITION, BESUCH_FOLLOWUP_TAGE } from '@/lib/crm/besuche';
import { followUpBis } from '@/lib/crm/events';
import { KUNDENGEWINNUNG_VORLAGEN, vorlageVon } from '@/lib/prozesse/kundengewinnung/bibliothek';
import type { Event, Teilnahme } from '@/lib/crm/typen';

/** Wie bis 21.10. gerechnet wurde: zwei Kalendertage nach dem Event. */
const vorherFrist = (datum: string) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 2); return d.toISOString().slice(0, 10); };

describe('E-V4 — „Keine Entscheidung“ als fester Verlustgrund', () => {
  it('angehängt, die bisherigen Gründe in ihrer Reihenfolge unverändert', () => {
    expect(VERLUSTGRUENDE.slice(0, 7)).toEqual(['Preis', 'Kein Bedarf', 'Zeitpunkt', 'Wettbewerb', 'Kein Entscheider', 'Intern gelöst', 'Keine Rückmeldung']);
    expect(VERLUSTGRUENDE.filter(g => g === 'Keine Entscheidung')).toHaveLength(1);
  });
  it('ein gleichnamiger eigener Wert (andere Schreibweise) erscheint nicht doppelt, eigene Gründe kommen dahinter', () => {
    const l = verlustgruende({ verlustgruende: ['keine entscheidung', 'Budget gestrichen'] });
    expect(l.filter(g => g.toLowerCase() === 'keine entscheidung')).toHaveLength(1);
    expect(l.at(-1)).toBe('Budget gestrichen');
    // Ohne eigene Werte: genau die festen.
    expect(verlustgruende(null)).toEqual(VERLUSTGRUENDE);
  });
  it('V13 nennt den festen Grund — und jeder Grund, den eine Vorlage prüft, steht in der Auswahl', () => {
    expect(JSON.stringify(vorlageVon('kg-v13')!.definition)).toMatch(/Keine Entscheidung/);
    const auswahl = new Set(verlustgruende(null));
    for (const v of KUNDENGEWINNUNG_VORLAGEN) {
      for (const d of [v.definition, ...v.teile.map(t => t.definition)]) {
        for (const k of d.knoten) {
          for (const b of k.raute?.art === 'regel' ? k.raute.bedingungen : []) {
            if (b.feld !== 'deal.grund') continue;
            for (const w of Array.isArray(b.wert) ? b.wert : [b.wert]) expect(auswahl.has(String(w)), `${v.nr}: ${String(w)}`).toBe(true);
          }
          const g = k.katalog?.werte?.grund;
          if (typeof g === 'string') expect(auswahl.has(g), `${v.nr}: ${g}`).toBe(true);
        }
      }
    }
  });
});

describe('E-V7 — 48 h = 2 Werktage', () => {
  it('Montag bis Mittwoch wie vorher, Donnerstag/Freitag rücken über das Wochenende, Feiertage zählen nicht', () => {
    for (const tag of ['2026-10-19', '2026-10-20', '2026-10-21']) expect(besuchFollowupFrist(tag), tag).toBe(vorherFrist(tag));
    expect(vorherFrist('2026-10-22')).toBe('2026-10-24'); // Do → Sa (vorher)
    expect(besuchFollowupFrist('2026-10-22')).toBe('2026-10-26'); // Do → Mo (nachher)
    expect(vorherFrist('2026-10-23')).toBe('2026-10-25'); // Fr → So (vorher)
    expect(besuchFollowupFrist('2026-10-23')).toBe('2026-10-27'); // Fr → Di (nachher)
    // 23.12. (Mi): 24.12. zählt, 25./26.12. (Feiertage NRW) und das Wochenende nicht → Montag, 28.12.
    expect(besuchFollowupFrist('2026-12-23')).toBe('2026-12-28');
    // Unlesbares Datum bleibt, wie es ist.
    expect(besuchFollowupFrist('demnächst')).toBe('demnächst');
  });
  it('die Nachfass-Frist der eigenen Abende rechnet genauso', () => {
    expect(followUpBis({ datum: '2026-10-23' })).toBe('2026-10-27');
    expect(followUpBis({ datum: '2026-10-20' })).toBe('2026-10-22');
  });
  it('Follow-up-Quote: Nachfassen am Montag nach einem Freitags-Event zählt jetzt als rechtzeitig (vorher nicht)', () => {
    const e = { id: 'ev-1', titel: 'Probe-Event', datum: '2026-10-23', status: 'durchgefuehrt', marke: 'Netzwerken' } as unknown as Event;
    const t = (n: number, followUpAm?: string): Teilnahme => ({ id: `t-${n}`, eventId: 'ev-1', kontaktId: `c-${n}`, status: 'da', ...(followUpAm ? { followUpAm } : {}) } as unknown as Teilnahme);
    const w = besuchWirkung(e, { teilnahmen: [t(1, '2026-10-26'), t(2, '2026-10-28'), t(3)], kontakte: [], chancen: [], heute: '2026-10-30' });
    expect(w.followupBasis).toBe(3);
    expect(w.nachgefasst).toBe(1); // Montag ja (nachher), Mittwoch nein
    const vorherNachgefasst = ['2026-10-26', '2026-10-28'].filter(x => x <= vorherFrist(e.datum)).length;
    expect(vorherNachgefasst).toBe(0);
  });
  it('die Definition sagt „Werktage“', () => {
    expect(BESUCH_FOLLOWUP_TAGE).toBe(2);
    expect(FOLLOWUP_QUOTE_DEFINITION).toMatch(/2 Werktagen/);
    expect(FOLLOWUP_QUOTE_DEFINITION).toMatch(/Mo–Fr ohne Feiertage/);
  });
});

// ─── Prozesse · Kundengewinnung — die neuen Ereignis-Quellen (22.10., E6 · E7 · E11; lib/ereignisse/quellen-kundengewinnung.ts) ───────────────────────────
// Rein: nur Kennungen (nie Namen, Titel, Texte), Bereich Business, Kennung je Wirkung deterministisch (zweimal derselbe Diff = dieselben Kennungen), eingeschränkte
// Personen (Art. 18) lösen nie etwas aus, Einwilligungen nur mit vollem Nachweis und nicht widerrufen. Neue Arten stehen im eigenen Block von lib/ereignisse/arten.ts.
import { describe, it, expect } from 'vitest';
import { crmDiffKundengewinnung, einwilligungDiff } from '@/lib/ereignisse/quellen-kundengewinnung';
import { EREIGNISSE_KUNDENGEWINNUNG, EREIGNIS_NAME, istEreignisArt } from '@/lib/ereignisse/arten';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const ev = (id: string, status: string) => ({ id, titel: 'Geheimer Titel', datum: '2026-10-20', status }) as unknown as CrmBestand['events'][number];
const kp = (id: string, status: string, ergebnisse: { kontaktId: string; ergebnis: string; am: string }[] = []) => ({ id, name: 'Kampagne Geheim', status, ergebnisse }) as unknown as CrmBestand['kampagnen'][number];
const voll = (kanal: string, extra: Record<string, unknown> = {}) => ({ kanal, erteiltAm: '2026-10-20', zeitpunkt: '2026-10-20T09:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja, gern per Mail.', belegRef: 'gespraech:1', ...extra });
const person = (id: string, einwilligungen: unknown[], extra: Record<string, unknown> = {}) => ({ id, name: 'Erika Beispiel', einwilligungen, ...extra }) as unknown as Kontakt;

describe('E7 · E11 — CRM-Diff (rein)', () => {
  it('Event-Statuswechsel → event-status (Stufe = Status), „durchgeführt“ zusätzlich → event-vorbei; neue Events melden nichts', () => {
    const l = crmDiffKundengewinnung({ events: [ev('e1', 'geplant'), ev('e2', 'geplant')] }, { events: [ev('e1', 'durchgefuehrt'), ev('e2', 'geplant'), ev('e3', 'geplant')] });
    expect(l.map(x => x.art)).toEqual(['event-status', 'event-vorbei']);
    expect(l[0]).toMatchObject({ quelle: 'crm', stufe: 'durchgefuehrt', bereich: 'business', bezug: { eventId: 'e1' } });
    expect(JSON.stringify(l)).not.toMatch(/Geheim/);
  });
  it('Kampagne wird aktiv → kampagne-aktiv; nur NEUE Ergebnisse → kampagnen-ergebnis (Stufe = Ergebnis, Kontakt als Kennung)', () => {
    const vorher = { kampagnen: [kp('k1', 'entwurf', [{ kontaktId: 'c-1', ergebnis: 'interesse', am: '2026-10-19' }])] };
    const nachher = { kampagnen: [kp('k1', 'aktiv', [{ kontaktId: 'c-1', ergebnis: 'interesse', am: '2026-10-19' }, { kontaktId: 'c-2', ergebnis: 'kein_interesse', am: '2026-10-20' }])] };
    const l = crmDiffKundengewinnung(vorher, nachher);
    expect(l.map(x => x.art)).toEqual(['kampagne-aktiv', 'kampagnen-ergebnis']);
    expect(l[1]).toMatchObject({ stufe: 'kein_interesse', bezug: { kampagneId: 'k1', kontaktId: 'c-2' } });
    // Deterministisch: derselbe Diff ergibt dieselben Kennungen (ein wiederholter Schreibweg legt nichts doppelt an).
    expect(crmDiffKundengewinnung(vorher, nachher).map(x => x.id)).toEqual(l.map(x => x.id));
    // Bleibt die Kampagne aktiv, meldet sie sich nicht erneut.
    expect(crmDiffKundengewinnung(nachher, nachher)).toEqual([]);
  });
});

describe('E6 — Einwilligung erteilt (rein)', () => {
  it('nur neue, nicht widerrufene Einwilligungen mit vollem Nachweis — je Person und Kanal einmal', () => {
    const vorher = [person('c-1', [voll('mail')])];
    const nachher = [
      person('c-1', [voll('mail'), voll('newsletter')], { firmaId: 'f-1' }),
      person('c-2', [voll('mail', { widerrufenAm: '2026-10-21' })]),
      person('c-3', [{ kanal: 'mail', erteiltAm: '2026-10-20' }]), // Altbestand ohne Nachweis
    ];
    const l = einwilligungDiff(vorher, nachher);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ art: 'einwilligung-erteilt', quelle: 'kartei', stufe: 'newsletter', bereich: 'business', bezug: { kontaktId: 'c-1', firmaId: 'f-1' } });
    expect(JSON.stringify(l)).not.toMatch(/Erika|Ja, gern/);
  });
  it('Art. 18: eine eingeschränkte Person löst nie etwas aus; leere Kartei → nichts', () => {
    expect(einwilligungDiff([], [person('c-9', [voll('mail')], { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } })])).toEqual([]);
    expect(einwilligungDiff(null, null)).toEqual([]);
  });
});

describe('Neue Arten — eigener, klar getrennter Block', () => {
  it('jede neue Art hat einen Namen und ist eine bekannte Art', () => {
    expect(EREIGNISSE_KUNDENGEWINNUNG.length).toBeGreaterThan(0);
    for (const a of EREIGNISSE_KUNDENGEWINNUNG) { expect(istEreignisArt(a), a).toBe(true); expect(EREIGNIS_NAME[a], a).toBeTruthy(); }
  });
});

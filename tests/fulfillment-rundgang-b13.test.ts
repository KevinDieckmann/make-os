// ─── Fulfillment · Rundgang 19.10. (B13) — „Angebot angenommen?“ ist bei aktivem Mandat erledigt ─────────────────────────────────────────────────
// Fund: Bei einem Kunden mit aktivem Mandat fragte „Heute im Fulfillment“ „Angebot angenommen? Ja/Nein“ (eine Entscheidung aus dem Ablauf). Jetzt: mit aktivem
// Mandat bzw. angenommenem Angebot rechnet der Fall sie wirksam als „ja“ (`fallWirksam` → `angebotAngenommenWirksam`) — die Erinnerung des Nein-Zweigs
// entfällt, der Ablauf geht weiter, gespeichert wird nichts. Ein Mandat im Angebot lässt die Frage offen; eine andere Entscheidung bleibt, wie sie ist.
import { describe, it, expect } from 'vitest';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';
import type { Mandat } from '@/lib/crm/typen';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { fallWirksam, type OnboardingAbleitung } from '@/lib/fulfillment/prozesse/onboarding';
import { aktiveKnoten } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { ableitungFuer } from '@/lib/fulfillment/prozesse/fall-server';
import { angebotAngenommenWirksam, istAngebotsEntscheidung, ANGEBOT_ANGENOMMEN_GRUND } from '@/lib/fulfillment/regeln';

const HEUTE = '2026-10-19';
let N = 0;
const neueId = (p: string) => `${p}-b13-${++N}`;
const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);

/** Ein Fall wie das Beispiel des Editors: Bedarf → Angebot senden → „Angebot angenommen?“ (nein: Erinnerung) → Start-Termin; danach eine Phase „Start“. */
function fall(frage = 'Angebot angenommen?', x: Partial<FallKnoten> = {}): Fall {
  const basis = fallStarten({ mandatId: 'm-b13', vorlage: { ...MUSTER_P1, id: 'v-b13' }, person: 'pia', jetzt: `${HEUTE}T09:00:00.000Z`, start: '2026-10-01', neueId });
  return { ...basis, status: 'laeuft', startAm: '2026-10-01', freigaben: {}, knoten: [
    k('w', undefined, 'Ablauf', 1),
    k('p1', 'w', 'Angebot', 1),
    k('s1', 'p1', 'Bedarf aufnehmen', 1, { form: 'schritt', frist: 2, status: 'erledigt', erledigtAm: '2026-10-03' }),
    k('s2', 'p1', 'Angebot senden', 2, { form: 'nachricht', frist: 3, status: 'erledigt', erledigtAm: '2026-10-09' }),
    k('e', 'p1', frage, 3, { form: 'entscheidung', frist: 7, zustaendig: 'kunde', status: 'wartet_kunde', seit: '2026-10-09', antwort: 'nein', antwortAm: '2026-10-12', runden: 1, zweige: { nein: 'r' }, ...x }),
    k('r', 'p1', 'Nach einer Woche nachfassen', 4, { form: 'erinnerung', frist: 7, seit: '2026-10-12', faelligAm: '2026-10-19', zweige: { ja: 'e' } }),
    k('t', 'p1', 'Start-Termin vereinbaren', 5, { form: 'termin', frist: 5, zustaendig: 'beide' }),
    k('p2', 'w', 'Start', 2), k('z', 'p2', 'Zugänge einrichten', 1, { form: 'schritt', frist: 5 }),
  ] };
}
const ableitung = (angebotAngenommen?: string): OnboardingAbleitung => ({ ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: `${HEUTE}T09:00:00.000Z`, ...(angebotAngenommen ? { angebotAngenommen } : {}) });
const kn = (f: Pick<Fall, 'knoten'>, id: string) => f.knoten.find(x => x.id === id)!;

describe('B13 · „Angebot angenommen?“ bei aktivem Mandat', () => {
  it('erkennt genau die Frage, ob DAS Angebot angenommen ist — nie einen Abstimmungspunkt oder einen Nachtrag', () => {
    const e = (titel: string, x: Partial<FallKnoten> = {}) => istAngebotsEntscheidung({ form: 'entscheidung', titel, ...x });
    for (const t of ['Angebot angenommen?', 'angebot angenommen', 'Ist das Angebot angenommen?', 'Wurde unser Angebot angenommen?', 'Angebot wurde angenommen']) expect(e(t), t).toBe(true);
    for (const t of ['Angebot für Phase 2 angenommen?', 'Konzept freigegeben?', 'Angebot senden']) expect(e(t), t).toBe(false);
    expect(e('Angebot angenommen?', { freigabe: 'F1' })).toBe(false);
    expect(istAngebotsEntscheidung({ form: 'schritt', titel: 'Angebot angenommen?' })).toBe(false);
  });

  it('wirksam erledigt mit „ja“: die Erinnerung entfällt, der Ablauf geht zum Start-Termin — gespeichert wird nichts', () => {
    const f = fall();
    const w = fallWirksam(f, ableitung('2026-10-01'));
    // Der Tag: frühestens der des letzten fertigen Schritts davor (Angebot senden, 09.10.) — nie eine Ankunft vor der Frage.
    expect(kn(w, 'e')).toMatchObject({ status: 'erledigt', antwort: 'ja', antwortAm: '2026-10-09', erledigtAm: '2026-10-09' });
    expect(kn(w, 'e').faelligAm).toBeUndefined();
    expect(kn(w, 'r')).toMatchObject({ status: 'entfaellt', grund: ANGEBOT_ANGENOMMEN_GRUND });
    expect(aktiveKnoten(w).map(a => [a.knoten.id, a.ankunft, a.faellig])).toEqual([['t', '2026-10-09', '2026-10-14']]);
    // Der gespeicherte Fall bleibt unberührt.
    expect(kn(f, 'e')).toMatchObject({ status: 'wartet_kunde', antwort: 'nein', runden: 1 });
    expect(kn(f, 'r').status).toBe('offen');
    // Ohne Angabe (Mandat im Angebot): die Frage bleibt offen, die Erinnerung läuft.
    const offen = fallWirksam(f, ableitung());
    expect(kn(offen, 'e').status).toBe('wartet_kunde');
    expect(aktiveKnoten(offen).map(a => a.knoten.id)).toEqual(['r']);
    // Eine andere Entscheidung bleibt, wie sie ist.
    const andere = fallWirksam(fall('Konzept freigegeben?'), ableitung('2026-10-01'));
    expect(kn(andere, 'e').status).toBe('wartet_kunde');
  });

  it('der Ja-Zweig überspringt, was dazwischen steht — wie ein Klick auf „ja“; eine schon entschiedene Frage bleibt', () => {
    const f = fall('Angebot angenommen?', { zweige: { nein: 'r', ja: 'z2' } });
    const mitSprung: Fall = { ...f, knoten: [...f.knoten.filter(x => x.id !== 't'), k('t', 'p1', 'Start-Termin vereinbaren', 5, { form: 'termin' }), k('z2', 'p1', 'Vertrag ablegen', 6, { form: 'schritt', frist: 2 })] };
    const w = fallWirksam(mitSprung, ableitung('2026-10-20'));
    expect(kn(w, 'e')).toMatchObject({ status: 'erledigt', antwortAm: '2026-10-20' }); // die Annahme kam nach dem letzten Schritt
    expect(kn(w, 't')).toMatchObject({ status: 'entfaellt', grund: ANGEBOT_ANGENOMMEN_GRUND });
    expect(kn(w, 'z2').status).toBe('offen');
    const schon = { ...f, knoten: f.knoten.map(x => (x.id === 'e' ? { ...x, status: 'erledigt' as const, antwort: 'ja' as const, erledigtAm: '2026-10-11' } : x)) };
    expect(angebotAngenommenWirksam(schon.knoten, '2026-10-01')).toBe(schon.knoten);
  });

  it('Ableitung: aktives Mandat bzw. angenommenes Angebot → erledigt; Mandat im Angebot → offen', () => {
    const f = fall();
    const m = (x: Partial<Mandat>) => ({ id: 'm-b13', start: '2026-10-01', status: 'aktiv', ziele: [], ...x }) as Mandat;
    const vorlagen = { rituale: [], marken: {}, einstellungen: { willkommenStunden: 24 } } as never;
    const crm = { angebote: [], chancen: [] };
    expect(ableitungFuer(f, m({}), crm, vorlagen, undefined, `${HEUTE}T09:00:00.000Z`).angebotAngenommen).toBe('2026-10-01');
    expect(ableitungFuer(f, m({ status: 'angebot' }), crm, vorlagen, undefined, `${HEUTE}T09:00:00.000Z`).angebotAngenommen).toBeUndefined();
    const angenommen = { angebote: [{ id: 'ang-1', status: 'angenommen', angenommenAm: '2026-10-05T10:00:00.000Z', mandatId: 'm-b13' }], chancen: [] } as never;
    expect(ableitungFuer(f, m({ status: 'angebot' }), angenommen, vorlagen, undefined, `${HEUTE}T09:00:00.000Z`).angebotAngenommen).toBe('2026-10-05T10:00:00.000Z');
  });
});

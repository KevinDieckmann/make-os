// ─── Fulfillment · Rundgang 19.10. (A4) — ein neuer Fall zeigt keine Phase als „erledigt“, in der noch etwas offen ist ──────────────────────────────
// Fund: Am ersten Tag standen Phase 6 „Umsetzung“ und 7 „Führung“ (nur Bausteine ohne Form) als „✓ erledigt“ bei 0 %. Ursache: `fallReise` nahm `phaseDurch`
// (hält den Ablauf nicht an) als „fertig“. Jetzt EINE Regel `phasenStaende`: fertig nur, wenn alles darin erledigt ist; an der der Gang vorbei ist und darin
// noch etwas nebenher läuft = „läuft“; eine, an der er noch nicht war = „offen“. Die Regel für „hier“ und die Ausführung bleibt. Erfundene Daten, rein.
import { describe, it, expect } from 'vitest';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { aktiveKnoten } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { fallReise, fallStelle, reiseKurz } from '@/lib/fulfillment/prozesse/reise';
import { reiseZeile } from '@/lib/fulfillment/prozesse/reise-bild';
import { aktuellerKnoten, phaseDurch, phasenStaende } from '@/lib/fulfillment/regeln';
import { kundenReise, kundenTeile } from '@/lib/fulfillment/kunde/bild';
import { reiseFlow } from '@/lib/reise/flow';

const HEUTE = '2026-10-19';
let N = 0;
const neueId = (p: string) => `${p}-a4-${++N}`;
const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten =>
  ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', kundeSichtbar: true, ...x } as FallKnoten);
/** Eine Phase nur aus Bausteinen ohne Form (wie „Umsetzung“, „Führung“ im Ablauf Vertriebsaufbau). */
const nurBausteine = (p: string, titel: string, rang: number): FallKnoten[] => [
  k(p, 'w', titel, rang), k(`${p}-t`, p, 'Weitere Bausteine', 1), k(`${p}-s`, `${p}-t`, 'Zugeordnete Bausteine', 1),
  k(`${p}-b1`, `${p}-s`, `${titel} · Leitfaden`, 1, { bausteinId: `bb-${p}-1` }), k(`${p}-b2`, `${p}-s`, `${titel} · Vorlage`, 2, { bausteinId: `bb-${p}-2` }),
];

/** Ein frischer Fall: Vorlauf und Analyse mit ausgeführten Schritten, dann zwei Phasen nur aus Bausteinen, am Ende ein Follow-up mit Schritt. */
function neuerFall(): Fall {
  const basis = fallStarten({ mandatId: 'm-a4', vorlage: { ...MUSTER_P1, id: 'v-a4' }, person: 'pia', jetzt: `${HEUTE}T09:00:00.000Z`, start: HEUTE, neueId });
  return { ...basis, status: 'laeuft', freigaben: {}, knoten: [
    k('w', undefined, 'Vertriebsaufbau', 1),
    k('p1', 'w', 'Vorlauf', 1), k('s1', 'p1', 'Kick-off terminieren', 1, { form: 'schritt', frist: 2 }),
    k('p2', 'w', 'Analyse', 2), k('s2', 'p2', 'Dossier', 1, { form: 'schritt', frist: 5 }),
    ...nurBausteine('p3', 'Umsetzung', 3),
    ...nurBausteine('p4', 'Führung', 4),
    k('p5', 'w', 'Follow-up', 5), k('s5', 'p5', 'Abschluss-Review', 1, { form: 'schritt', frist: 3 }),
  ] };
}
const erledige = (f: Fall, ...ids: string[]): Fall => ({ ...f, knoten: f.knoten.map(x => (ids.includes(x.id) ? { ...x, status: 'erledigt' as const, erledigtAm: HEUTE } : x)) });
const zustaende = (f: Fall) => fallReise(f, [], HEUTE).phasen.map(p => p.zustand);

describe('A4 · ein neuer Fall: keine Phase „erledigt“, in der noch etwas offen ist', () => {
  it('am ersten Tag: Phasen nur aus Bausteinen stehen als „offen“, nicht als „✓ erledigt“ — überall gleich', () => {
    const f = neuerFall();
    // Die Regel für „hier“ und die Ausführung bleibt: die Bausteine halten den Ablauf später nicht an (sie sind „durch“).
    expect(phaseDurch(f.knoten.find(x => x.id === 'p3')!, f.knoten)).toBe(true);
    expect(aktuellerKnoten(f).phase!.id).toBe('p1');
    expect(aktiveKnoten(f).map(a => a.knoten.id)).toEqual(['s1']);
    // Darstellung: nur „hier“ und „kommt noch“.
    expect(zustaende(f)).toEqual(['jetzt', 'offen', 'offen', 'offen', 'offen']);
    const r = fallReise(f, [], HEUTE);
    expect(r.fertig).toBe(false);
    expect(r.phasen.find(p => p.id === 'p3')).toMatchObject({ erledigt: 0, anteil: 0 });
    expect(reiseKurz(r).map(p => p.zustand)).toEqual(['jetzt', 'offen', 'offen', 'offen', 'offen']);
    expect(reiseZeile({ fall: f, freigaben: [], heute: HEUTE }).spalten.map(s => s.zustand)).toEqual(['jetzt', 'offen', 'offen', 'offen', 'offen']);
    expect(fallStelle(f, [], HEUTE)).toMatchObject({ phase: { id: 'p1', nr: 1, von: 5 }, fertig: false });
    // Kunden-Seite: dieselbe Regel.
    const t = kundenTeile({ fall: f, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set() });
    expect(t.phasen.map(p => p.stand)).toEqual(['aktuell', 'kommt', 'kommt', 'kommt', 'kommt']);
    expect(kundenReise(t.phasen, t.naechstes, 0).some(s => s.zustand === 'fertig' || s.unter === 'erledigt')).toBe(false);
  });

  it('ist der Ablauf an einer Phase vorbei, in der noch Bausteine offen sind: „läuft“ (nie „erledigt“); „hier“ springt wie bisher', () => {
    const f = erledige(neuerFall(), 's1', 's2');
    expect(aktuellerKnoten(f).phase!.id).toBe('p5');
    expect(zustaende(f)).toEqual(['fertig', 'fertig', 'laeuft', 'laeuft', 'jetzt']);
    expect(phasenStaende(f).get('p4')).toBe('laeuft');
    const z = reiseZeile({ fall: f, freigaben: [], heute: HEUTE });
    expect(reiseFlow(z.spalten).hier).toEqual({ art: 'mitte', i: 4 });
    const t = kundenTeile({ fall: f, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set() });
    expect(t.phasen.map(p => p.stand)).toEqual(['erledigt', 'erledigt', 'laeuft', 'laeuft', 'aktuell']);
    expect(kundenReise(t.phasen, t.naechstes, 0).map(s => [s.zustand, s.unter])).toEqual([
      ['fertig', 'erledigt'], ['fertig', 'erledigt'], ['laeuft', 'läuft noch'], ['laeuft', 'läuft noch'], ['jetzt', '0 % der Schritte'],
    ]);
  });

  it('alles durchlaufen: die Reise ist fertig wie bisher (Abschluss), die Phasen mit offenen Bausteinen bleiben „läuft“, der Faden reicht bis ans Ende', () => {
    const f = erledige(neuerFall(), 's1', 's2', 's5');
    expect(aktuellerKnoten(f).phase).toBeNull();
    const r = fallReise(f, [], HEUTE);
    expect(r.phasen.map(p => p.zustand)).toEqual(['fertig', 'fertig', 'laeuft', 'laeuft', 'fertig']);
    expect(r.fertig).toBe(true);
    expect(reiseFlow(reiseZeile({ fall: f, freigaben: [], heute: HEUTE }).spalten).hier).toEqual({ art: 'ende' });
    // Sind auch die Bausteine erledigt, ist die Phase fertig.
    const g = erledige(f, 'p3-b1', 'p3-b2');
    expect(zustaende(g)).toEqual(['fertig', 'fertig', 'fertig', 'laeuft', 'fertig']);
  });
});

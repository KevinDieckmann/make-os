// ─── Prozesse × Fulfillment — der Kunde sieht seine Etappen (22.10.; lib/prozesse/kunden-etappen.ts, lib/fulfillment/kunde/sicht.ts) ─────────────────────
// Wächter der Kunden-Seite für die zweite Quelle: Etappen aus dem Lauf eines Werkstatt-Prozesses erscheinen NUR ohne Fall des Fulfillments, NUR aus scharfen
// Läufen, NUR für Knoten mit „Dem Kunden zeigen“ und erlaubter Form (Schritt · Nachricht · Termin) — in denselben Schlüsseln der Positivliste. Mit Fall ist die
// Kunden-Sicht bit-gleich wie vorher (die Etappen zählen dann nicht).
import { describe, it, expect } from 'vitest';
import { kundenEtappen, KUNDEN_FORMEN } from '@/lib/prozesse/kunden-etappen';
import { kundenSicht, kundeHinweis, schluesselPfade, SICHT_SCHLUESSEL, type SichtEingabe } from '@/lib/fulfillment/kunde/sicht';
import { leerKunde } from '@/lib/fulfillment/lesen';
import type { Fall } from '@/lib/fulfillment/typen';
import type { ProzessLauf, LaufSchritt } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, J } from './fixtures/prozess-bau';

const DEF = definition([
  schritt(10, 'Kick-off', 1, { kundeSichtbar: true }),
  schritt(11, 'Intern einschätzen', 2, { form: 'agent', kundeSichtbar: true }),
  schritt(12, 'Angebot intern prüfen', 3),
  schritt(13, 'Ergebnis-Workshop', 4, { form: 'termin', kundeSichtbar: true }),
  schritt(20, 'Bericht', 1, { form: 'nachricht', kundeSichtbar: true }, fk(5)),
], { fallArt: 'mandat', bereich: 'fulfillment' }, [{ id: fk(5), elternId: fk(1), titel: 'Abschluss', rang: 2 }]);
const s = (knoten: number, status: LaufSchritt['status']): LaufSchritt => ({ id: `ls-${knoten}`, knoten: fk(knoten), status, ab: J } as LaufSchritt);
const lauf = (x: Partial<ProzessLauf>): ProzessLauf => ({ id: 'pl-1', prozessId: 'pz-1', version: 1, fall: { art: 'mandat', id: 'm-1' }, bereich: 'fulfillment', schluessel: 'x', durchgang: 1, modus: 'scharf', status: 'wartet', person: 'pia', ausloeser: { art: 'produkt' }, tiefe: 0, daten: {}, start: J, geaendert: J, aktuell: null, schritte: [], kostenCent: 0, ...x } as ProzessLauf);

describe('Etappen aus dem Lauf (rein)', () => {
  it('nur markierte Schritte erlaubter Form: Agent und interne Prüfung bleiben intern; Phase ohne sichtbaren Schritt fehlt nie, wenn einer markiert ist', () => {
    expect(KUNDEN_FORMEN).toEqual(['schritt', 'nachricht', 'termin']);
    const e = kundenEtappen([{ lauf: lauf({ schritte: [s(3, 'erledigt'), s(10, 'erledigt'), s(11, 'erledigt'), s(12, 'erledigt'), s(13, 'wartet')] }), def: DEF }])!;
    expect(e).toEqual({
      phasen: [{ titel: 'Ablauf', stand: 'aktuell', anteil: 0.5 }, { titel: 'Abschluss', stand: 'kommt', anteil: 0 }],
      erledigt: ['Kick-off'], naechstes: ['Ergebnis-Workshop', 'Bericht'],
    });
    const text = JSON.stringify(e);
    for (const x of ['Intern einschätzen', 'Angebot intern prüfen', 'fk-', 'pl-', 'pia']) expect(text, x).not.toContain(x);
  });
  it('fertiger Lauf: alle Phasen erledigt; Schatten (Probelauf) und abgebrochene Läufe zeigen nichts; ohne Markierung null', () => {
    expect(kundenEtappen([{ lauf: lauf({ status: 'fertig', schritte: [s(10, 'erledigt')] }), def: DEF }])?.phasen.map(p => p.stand)).toEqual(['erledigt', 'erledigt']);
    expect(kundenEtappen([{ lauf: lauf({ modus: 'schatten', schritte: [s(10, 'erledigt')] }), def: DEF }])).toBeNull();
    expect(kundenEtappen([{ lauf: lauf({ status: 'abgebrochen' }), def: DEF }])).toBeNull();
    const ohne = definition([schritt(10, 'Kick-off', 1)], { fallArt: 'mandat' });
    expect(kundenEtappen([{ lauf: lauf({}), def: ohne }])).toBeNull();
  });
});

const FALL: Fall = {
  mandatId: 'm-1', vorlageId: 'fp-x', vorlageFassung: 1, gestartetAm: '2026-09-01T00:00:00Z', gestartetVon: 'person-intern', status: 'laeuft',
  knoten: [{ id: 'w', titel: 'Wurzel', rang: 1, status: 'offen' }, { id: 'p1', elternId: 'w', titel: 'Phase sichtbar', rang: 1, status: 'in_arbeit', kundeSichtbar: true }, { id: 's1', elternId: 'p1', titel: 'Schritt sichtbar', rang: 1, status: 'offen', kundeSichtbar: true }],
  freigaben: {}, geaendert: J, geaendertVon: 'person-intern',
} as unknown as Fall;
const EINGABE = (extra: Partial<SichtEingabe> = {}): SichtEingabe => ({
  modus: 'voll', heute: '2026-10-22', mandat: { id: 'm-1', titel: 'Mandat Eins', kunde: 'Erfundene Werke GmbH', ziele: [] }, fall: null, bausteine: [], marken: {}, rituale: [],
  kunde: leerKunde(), rechte: { formular: true, upload: true, puls: true }, standVon: () => 'stand-1',
  datenschutz: kundeHinweis({ verantwortlich: 'Erfundene Firma, Musterweg 1, 12345 Musterstadt', seite: null, mandatsdatenMonate: 12, unterlagenTage: 90 }), uploadFrei: 19, ...extra,
});
const ETAPPEN = { phasen: [{ titel: 'Ablauf', stand: 'aktuell' as const, anteil: 0.5 }], erledigt: ['Kick-off'], naechstes: ['Ergebnis-Workshop'] };

describe('Kunden-Sicht mit Etappen — dieselbe Positivliste', () => {
  it('ohne Fall: Strahl, erledigt und „als Nächstes“ aus den Etappen; nur erlaubte Schlüssel und Pfade', () => {
    const k = kundenSicht(EINGABE({ etappen: ETAPPEN }));
    expect(k.zeitstrahl).toEqual(ETAPPEN.phasen);
    expect(k.erledigt).toEqual(['Kick-off']);
    expect(k.naechstes).toEqual(['Ergebnis-Workshop']);
    expect(Object.keys(k).every(x => (SICHT_SCHLUESSEL as readonly string[]).includes(x))).toBe(true);
    for (const p of schluesselPfade(k).filter(p => p.startsWith('zeitstrahl'))) expect(['zeitstrahl', 'zeitstrahl[].titel', 'zeitstrahl[].stand', 'zeitstrahl[].anteil'], p).toContain(p);
    // Ohne Etappen und ohne Fall: wie bisher leer.
    expect(kundenSicht(EINGABE()).zeitstrahl).toEqual([]);
  });
  it('mit Fall: die Etappen zählen nicht — bit-gleich wie ohne sie', () => {
    expect(kundenSicht(EINGABE({ fall: FALL, etappen: ETAPPEN }))).toEqual(kundenSicht(EINGABE({ fall: FALL })));
  });
  it('Puls-Modus: nie Etappen', () => {
    expect(kundenSicht(EINGABE({ modus: 'puls', etappen: ETAPPEN })).zeitstrahl).toEqual([]);
  });
});

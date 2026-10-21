// ─── Prozesse C1 · Lauf-Motor — die reinen Regeln (lib/prozesse/lauf-regeln.ts; ANALYSE_100.md Punkte 35–50, 59, 61, 64) ──────────────────────────
// Ein Lauf geht seinen Weg: Menschen-Schritt → Aufgabe (Abhaken treibt weiter), Warten mit Wecker, Entscheidung als Vorschlag (ja/nein/abgelaufen),
// Außenwirkung nur über das Schloss (Mail mit Empfänger und Text sichtbar). Feste Kennung je Schritt (`<lauf>-<schritt>`) — ein Abbruch zwischen zwei
// Aufrufen wiederholt nichts doppelt. Probelauf (Schatten) geht denselben Weg ohne Wirkung. Starten: ein offener Lauf je Fall, Wiedereintritt, Kette,
// Person Pflicht (Regel 5), Flutschutz. Art. 18/Werbesperre beenden. Budget/Notbremse. Version bleibt am Lauf. Nur erfundene Werte.
import { describe, it, expect } from 'vitest';
import {
  voran, nachAktion, aufgabeFertig, weckenZeit, freigabeEntschieden, erneutAbHier, starten, wirkungsKennung, arbeitsstundenPlus, zeitPlus,
  kostenBuchen, budgetReicht, wirkungZaehlen, umzugVorschau, umziehen, probeZeilen, laufLage, abbrechen, anhalten, fortsetzen, knotenStand, laufKurz,
  schleifenBefunde, type LaufUmfeld, type StartAnfrage,
} from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe, leererStand, LAUF_GRENZEN, WIRKUNG_KENNUNG, type LaeufeDatei, type ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { definition, fk, schritt, PZ, J } from './fixtures/prozess-bau';

const lid = (n: number) => `pl-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plus = (min: number, ab = J) => new Date(Date.parse(ab) + min * 60_000).toISOString();
const umfeld = (jetzt = J, extra: Partial<LaufUmfeld> = {}): LaufUmfeld => ({ jetzt, titel: 'Probe', daten: {}, ...extra });

function start(def: ProzessDefinition, o: Partial<StartAnfrage> = {}, datei: LaeufeDatei = leereLaeufe()) {
  return starten(datei, {
    id: lid(1), prozessId: PZ, version: 1, def, fall: { art: 'deal', id: 'ch-probe' }, modus: 'scharf', person: 'pia',
    ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, jetzt: J, ...o,
  });
}
const lauf = (def: ProzessDefinition, o: Partial<StartAnfrage> = {}): ProzessLauf => { const r = start(def, o); if (!r.ok) throw new Error(r.grund); return r.lauf; };

/** Anrufen (Mensch) → 2 h warten → Entscheidung (Mensch) → Ende; „nein“ → Ende mit Abbruch. */
const WEG = definition([
  schritt(10, 'Anrufen', 1),
  schritt(11, 'Kurz warten', 2, { form: 'warten', warten: { art: 'dauer', tage: 0, stunden: 2 } }),
  schritt(12, 'Passt es?', 3, { form: 'entscheidung', zweige: { nein: fk(20) } }),
  schritt(13, 'Fertig', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(20, 'Abgesagt', 5, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
]);

describe('Der Weg eines scharfen Laufs', () => {
  it('Menschen-Schritt → Aufgabe mit fester Kennung; Abhaken → Warten → Wecker → Entscheidung als Vorschlag → „nein“ → Ende mit Abbruch', () => {
    const l0 = lauf(WEG);
    expect(l0).toMatchObject({ status: 'laeuft', version: 1, modus: 'scharf', person: 'pia', durchgang: 1 });
    const a = voran(l0, WEG, umfeld());
    expect(a.aktion).toMatchObject({ art: 'aufgabe', knoten: fk(10), titel: 'Anrufen', an: 'pia', bezug: { dealId: 'ch-probe' } });
    const kennung = a.aktion!.kennung;
    expect(kennung).toBe(wirkungsKennung(l0.id, fk(10), 0));
    expect(WIRKUNG_KENNUNG.test(kennung)).toBe(true);
    // Abbruch zwischen Planen und Festhalten: derselbe Ausgangsstand plant dieselbe Kennung (nichts doppelt).
    expect(voran(l0, WEG, umfeld(plus(5))).aktion?.kennung).toBe(kennung);
    const l1 = nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J);
    expect(l1).toMatchObject({ status: 'wartet', wartet: { art: 'aufgabe', wirkung: kennung, knoten: fk(10) } });
    // Eine fremde Aufgabe weckt nichts.
    expect(aufgabeFertig(l1, WEG, 'pl-anders', 'erledigt', J)).toBe(l1);
    const l2 = aufgabeFertig(l1, WEG, kennung, 'erledigt', plus(10));
    expect(l2).toMatchObject({ status: 'laeuft', aktuell: fk(11) });
    const w = voran(l2, WEG, umfeld(plus(10)));
    expect(w.aktion).toBeNull();
    expect(w.lauf).toMatchObject({ status: 'wartet', wartet: { art: 'zeit', bis: plus(130) } });
    expect(weckenZeit(w.lauf, WEG, plus(60))).toBe(w.lauf);
    const l3 = weckenZeit(w.lauf, WEG, plus(131));
    expect(l3).toMatchObject({ status: 'laeuft', aktuell: fk(12) });
    const e = voran(l3, WEG, umfeld(plus(131)));
    expect(e.aktion).toMatchObject({ art: 'vorschlag', sorte: 'entscheidung', knoten: fk(12), fuer: 'pia' });
    const l4 = nachAktion(e.lauf, WEG, e.aktion!, { ok: true }, plus(131));
    expect(l4).toMatchObject({ status: 'wartet', wartet: { art: 'freigabe', wirkung: e.aktion!.kennung } });
    const l5 = freigabeEntschieden(l4, WEG, e.aktion!.kennung, 'nein', plus(200));
    expect(l5.aktuell).toBe(fk(20));
    const ende = voran(l5, WEG, umfeld(plus(200)));
    expect(ende.lauf).toMatchObject({ status: 'fertig', ergebnis: 'abbruch' });
    // Ansicht: je Knoten der Stand; Kurzform mit Dauer.
    const st = knotenStand(ende.lauf);
    expect(st[fk(10)]).toMatchObject({ status: 'erledigt', wirkung: [{ art: 'aufgabe', id: kennung }] });
    expect(st[fk(12)]).toMatchObject({ ausgang: 'nein', grund: 'abgelehnt' });
    expect(laufKurz(ende.lauf, plus(300))).toMatchObject({ status: 'fertig', dauerMin: 200, version: 1 });
  });
  it('Entscheidung abgelaufen → nein; Freigabe ja → weiter', () => {
    const l = lauf(WEG);
    const a = voran(l, WEG, umfeld());
    let x = aufgabeFertig(nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J), WEG, a.aktion!.kennung, 'erledigt', J);
    x = weckenZeit(voran(x, WEG, umfeld()).lauf, WEG, plus(500));
    const e = voran(x, WEG, umfeld(plus(500)));
    const w = nachAktion(e.lauf, WEG, e.aktion!, { ok: true }, plus(500));
    expect(freigabeEntschieden(w, WEG, e.aktion!.kennung, 'abgelaufen', plus(600)).aktuell).toBe(fk(20));
    const ja = freigabeEntschieden(w, WEG, e.aktion!.kennung, 'ja', plus(600));
    expect(voran(ja, WEG, umfeld(plus(600))).lauf).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
  });
  it('Aufgabe abgebrochen ohne Fehlerkante → Lauf hält an (Fehler); „erneut ab hier“ plant dieselbe Kennung', () => {
    const l = lauf(WEG);
    const a = voran(l, WEG, umfeld());
    const w = nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J);
    const f = aufgabeFertig(w, WEG, a.aktion!.kennung, 'abgebrochen', J);
    expect(f).toMatchObject({ status: 'fehler', grund: 'aufgabe-abgebrochen' });
    const n = erneutAbHier(f, plus(5))!;
    expect(n.status).toBe('laeuft');
    expect(voran(n, WEG, umfeld(plus(5))).aktion?.kennung).toBe(a.aktion!.kennung);
    expect(erneutAbHier(n, J)).toBeNull();
  });
  it('vorübergehender Fehler → Pause mit Backoff (5 · 3^(n−1) min), danach derselbe Schritt mit derselben Kennung; nach `versuche` dauerhaft', () => {
    const l = lauf(WEG);
    const a = voran(l, WEG, umfeld());
    let x = nachAktion(a.lauf, WEG, a.aktion!, { ok: false, art: 'voruebergehend', grund: 'voruebergehend' }, J);
    expect(x).toMatchObject({ status: 'wartet', wartet: { art: 'fehler', bis: plus(5) } });
    x = weckenZeit(x, WEG, plus(6));
    expect(x.status).toBe('laeuft');
    expect(voran(x, WEG, umfeld(plus(6))).aktion?.kennung).toBe(a.aktion!.kennung);
    for (let i = 1; i < LAUF_GRENZEN.versuche; i++) {
      const p = voran(x, WEG, umfeld(plus(6)));
      x = nachAktion(p.lauf, WEG, p.aktion!, { ok: false, art: 'voruebergehend', grund: 'voruebergehend' }, plus(6));
      if (x.status === 'wartet') x = weckenZeit(x, WEG, plus(10_000));
    }
    expect(x).toMatchObject({ status: 'fehler', grund: 'voruebergehend' });
  });
});

describe('Probelauf (Schatten) — derselbe Motor, keine Wirkung', () => {
  it('geht den ganzen Weg ohne Aktion; Zeilen „würde“, „wartet“, „Freigabe“', () => {
    const l = lauf(WEG, { modus: 'schatten' });
    const r = voran(l, WEG, umfeld(), 'schatten');
    expect(r.aktion).toBeNull();
    expect(r.lauf).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    const z = probeZeilen(r.lauf, WEG);
    const je = Object.fromEntries(z.schritte.map(s => [s.knotenId, s.status]));
    expect(je).toMatchObject({ [fk(10)]: 'wuerde', [fk(11)]: 'wartet', [fk(12)]: 'freigabe' });
    expect(z.kostenSchaetzungCent).toBe(0);
  });
  it('Schatten ohne Person ist erlaubt (es wirkt nichts) — scharf ohne Person nie (Regel 5)', () => {
    expect(start(WEG, { modus: 'schatten', person: null }).ok).toBe(true);
    expect(start(WEG, { modus: 'scharf', person: null })).toMatchObject({ ok: false, grund: 'ohne-person' });
  });
});

describe('Starten — Fall, Wiedereintritt, Kette, Flutschutz', () => {
  it('ein offener Lauf je Fall; nach dem Ende nur mit „erneut“ bzw. nach `erneutNachTagen`', () => {
    const r1 = start(WEG);
    if (!r1.ok) throw new Error('kein Start');
    expect(start(WEG, { id: lid(2) }, r1.datei)).toMatchObject({ ok: false, grund: 'offen' });
    const fertig = { ...r1.lauf, status: 'fertig' as const, ende: J };
    const d: LaeufeDatei = { ...r1.datei, laeufe: [fertig] };
    expect(start(WEG, { id: lid(2) }, d)).toMatchObject({ ok: false, grund: 'schon' });
    const erneut = start(WEG, { id: lid(2), erneut: true }, d);
    expect(erneut).toMatchObject({ ok: true, lauf: { durchgang: 2 } });
    const mitTagen: LaeufeDatei = { ...d, prozesse: { [PZ]: { ...leererStand(), einstellung: { erneutNachTagen: 3 } } } };
    expect(start(WEG, { id: lid(2), jetzt: plus(60 * 24 * 2) }, mitTagen)).toMatchObject({ ok: false, grund: 'schon' });
    expect(start(WEG, { id: lid(2), jetzt: plus(60 * 24 * 4) }, mitTagen).ok).toBe(true);
    // Ein anderer Fall startet unabhängig.
    expect(start(WEG, { id: lid(3), fall: { art: 'deal', id: 'ch-zwei' } }, r1.datei).ok).toBe(true);
  });
  it('Kette höchstens drei tief (Schleifenschutz) — gezählt, nie still', () => {
    const r = start(WEG, { tiefe: LAUF_GRENZEN.kettenTiefe + 1 });
    expect(r).toMatchObject({ ok: false, grund: 'kette' });
    expect(r.datei.prozesse[PZ]?.nicht?.kette).toBe(1);
  });
  it('Flutschutz: über `flutJeStunde` automatische Starts werden zurückgehalten (scharf) bzw. gezählt (Schatten); von Hand gilt er nicht', () => {
    let d: LaeufeDatei = { ...leereLaeufe(), prozesse: { [PZ]: { ...leererStand(), einstellung: { flutJeStunde: 2 } } } };
    for (let i = 1; i <= 2; i++) { const r = start(WEG, { id: lid(i), fall: { art: 'deal', id: `ch-${i}` }, automatisch: true }, d); expect(r.ok).toBe(true); d = r.datei; }
    const drei = start(WEG, { id: lid(3), fall: { art: 'deal', id: 'ch-3' }, automatisch: true }, d);
    expect(drei).toMatchObject({ ok: false, grund: 'flut' });
    expect(drei.datei.zurueckgehalten).toHaveLength(1);
    expect(drei.datei.zurueckgehalten[0]).toMatchObject({ prozessId: PZ, fall: { id: 'ch-3' }, person: 'pia' });
    expect(start(WEG, { id: lid(4), fall: { art: 'deal', id: 'ch-4' }, automatisch: true, modus: 'schatten' }, d)).toMatchObject({ ok: false, grund: 'schatten-voll' });
    expect(start(WEG, { id: lid(5), fall: { art: 'deal', id: 'ch-5' }, automatisch: false }, d).ok).toBe(true);
    // Die nächste Stunde zählt neu.
    expect(start(WEG, { id: lid(6), fall: { art: 'deal', id: 'ch-6' }, automatisch: true, jetzt: plus(61) }, d).ok).toBe(true);
  });
  it('Bestand voll → neue Starts abgelehnt (gezählt), nie ein vorhandener gekürzt', () => {
    const r1 = start(WEG);
    if (!r1.ok) throw new Error('kein Start');
    const voll: LaeufeDatei = { ...r1.datei, laeufe: Array.from({ length: LAUF_GRENZEN.laeufe }, (_, i) => ({ ...r1.lauf, id: lid(100 + i), schluessel: `s-${i}` })) };
    const r = start(WEG, { id: lid(2), fall: { art: 'deal', id: 'ch-neu' } }, voll);
    expect(r).toMatchObject({ ok: false, grund: 'voll' });
    expect(r.datei.laeufe).toHaveLength(LAUF_GRENZEN.laeufe);
  });
});

describe('Feste Regeln vor jedem Schritt', () => {
  it('Art. 18 bzw. Werbesperre einer Person des Falls beendet den Lauf; Fall gelöscht ebenso', () => {
    const l = lauf(WEG);
    expect(voran(l, WEG, umfeld(J, { ausgenommen: 'art18' })).lauf).toMatchObject({ status: 'abgebrochen', grund: 'art18', ergebnis: 'abbruch' });
    expect(voran(l, WEG, umfeld(J, { ausgenommen: 'werbesperre' })).lauf).toMatchObject({ status: 'abgebrochen', grund: 'werbesperre' });
    expect(voran(l, WEG, umfeld(J, { fallFehlt: true })).lauf).toMatchObject({ status: 'abgebrochen', grund: 'fall-weg' });
  });
  it('Ziel erreicht → fertig (Ziel); Abbruch-Kriterium → abgebrochen', () => {
    const l = lauf(WEG);
    const ziel = { bedingungen: [{ feld: 'deal.stufe', op: 'gleich' as const, wert: 'gewonnen' }] };
    expect(voran(l, WEG, umfeld(J, { daten: { 'deal.stufe': 'gewonnen' }, einstellung: { ziel } })).lauf).toMatchObject({ status: 'fertig', grund: 'ziel' });
    expect(voran(l, WEG, umfeld(J, { daten: { 'deal.stufe': 'verloren' }, einstellung: { abbruch: { bedingungen: [{ feld: 'deal.stufe', op: 'gleich', wert: 'verloren' }] } } })).lauf)
      .toMatchObject({ status: 'abgebrochen', grund: 'abbruch-kriterium' });
  });
  it('Modell-Raute entscheidet nie (Entscheidung 21.10.) — der Lauf hält an', () => {
    const d = definition([schritt(10, 'Modell?', 1, { form: 'entscheidung', raute: { art: 'modell', frage: 'Passt es?', warumKeineRegel: 'Probe', modell: 'haiku', budgetCent: 5 } })]);
    expect(voran(lauf(d), d, umfeld()).lauf).toMatchObject({ status: 'fehler', grund: 'modell-raute' });
  });
  it('Regel-Raute rechnet aus den Fall-Feldern', () => {
    const d = definition([
      schritt(10, 'Gewonnen?', 1, { form: 'entscheidung', raute: { art: 'regel', bedingungen: [{ feld: 'deal.stufe', op: 'gleich', wert: 'gewonnen' }] }, zweige: { nein: fk(20) } }),
      schritt(11, 'Ende ja', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
      schritt(20, 'Ende nein', 3, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
    ]);
    expect(voran(lauf(d), d, umfeld(J, { daten: { 'deal.stufe': 'gewonnen' } })).lauf).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    expect(voran(lauf(d), d, umfeld(J, { daten: { 'deal.stufe': 'angebot' } })).lauf).toMatchObject({ status: 'fertig', ergebnis: 'abbruch' });
  });
});

describe('Außenwirkung nur über das Schloss (Punkte 61, N12)', () => {
  const MAIL = schlossSetzen(definition([
    schritt(30, 'Danke-Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'gmail', an: 'fall.kontakt', betreff: 'Danke, {{kontakt.vorname}}', text: 'Schön, dass wir gesprochen haben.' } } }),
    schritt(31, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ])).definition;
  const erika = { kontaktId: 'c-probe', name: 'Erika Beispiel', email: 'erika@example.invalid' };
  it('der Knoten bereitet nur vor; das Schloss legt den Vorschlag mit Empfänger und Text — Senden erst nach der Freigabe', () => {
    const r = voran(lauf(MAIL), MAIL, umfeld(J, { empfaenger: () => erika, platzhalter: { 'kontakt.vorname': 'Erika' } }));
    expect(r.aktion).toMatchObject({ art: 'vorschlag', sorte: 'freigabe', sende: { kanal: 'mail', postfach: 'gmail', an: erika, betreff: 'Danke, Erika' } });
    if (r.aktion?.art !== 'vorschlag') throw new Error('kein Vorschlag');
    expect(r.aktion.nachher).toContain('erika@example.invalid');
    expect(r.aktion.nachher).toContain('Betreff: Danke, Erika');
    // Der Lauf selbst trägt nie Namen oder Adressen (nur Kennungen).
    expect(JSON.stringify(r.lauf)).not.toContain('Erika');
    expect(JSON.stringify(r.lauf)).not.toContain('example.invalid');
  });
  it('ohne Empfänger aus dem Fall: nichts vorgeschlagen (übersprungen „kein Empfänger“) — fremder Text bestimmt nie den Empfänger', () => {
    const r = voran(lauf(MAIL), MAIL, umfeld(J, { empfaenger: () => null }));
    expect(r.aktion).toBeNull();
    expect(r.lauf.schritte.find(s => s.grund === 'kein-empfaenger')?.status).toBe('uebersprungen');
  });
  it('Kanal-Ampel rot → übersprungen', () => {
    const r = voran(lauf(MAIL), MAIL, umfeld(J, { empfaenger: () => erika, ansprache: () => ({ erlaubt: false, farbe: 'rot', grund: 'Werbesperre' } as never) }));
    expect(r.aktion).toBeNull();
    expect(r.lauf.schritte.some(s => s.grund === 'kanal-rot')).toBe(true);
  });
  it('Außenwirkung ohne Schloss hält an (nie ohne Freigabe)', () => {
    const ohne = definition([schritt(30, 'Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: {} } })]);
    expect(voran(lauf(ohne), ohne, umfeld()).lauf).toMatchObject({ status: 'fehler', grund: 'schloss-fehlt' });
  });
});

describe('Agenten-Schritte, Budget, Notbremse', () => {
  const AG = definition([schritt(40, 'Recherche', 1, { form: 'agent', agent: { auftrag: 'Fasse zusammen.', modell: 'haiku', budgetCent: 10, werkzeuge: [], ausgabe: 'text' } as never })]);
  it('Agent nicht erlaubt (Budget) → Lauf angehalten, Prozess soll pausieren; Fenster → wartet bis 7 Uhr', () => {
    const p = voran(lauf(AG), AG, umfeld(J, { agent: () => ({ ok: false, grund: 'budget', pause: true }) }));
    expect(p.pause).toBe('budget');
    expect(p.lauf).toMatchObject({ status: 'angehalten', grund: 'budget' });
    const f = voran(lauf(AG), AG, umfeld(J, { agent: () => ({ ok: false, grund: 'fenster', bis: '2026-10-22T05:00:00.000Z' }) }));
    expect(f.lauf).toMatchObject({ status: 'wartet', wartet: { art: 'fenster', bis: '2026-10-22T05:00:00.000Z' } });
    expect(voran(lauf(AG), AG, umfeld()).lauf).toMatchObject({ status: 'fehler', grund: 'ki-aus' });
  });
  it('fortsetzen nach der Pause: der Schritt läuft wieder', () => {
    const p = voran(lauf(AG), AG, umfeld(J, { agent: () => ({ ok: false, grund: 'budget', pause: true }) }));
    const w = fortsetzen(p.lauf, plus(5));
    expect(w.status).toBe('laeuft');
    expect(voran(w, AG, umfeld(plus(5), { agent: () => ({ ok: true, kostenCent: 3 }) })).aktion).toMatchObject({ art: 'agent', kostenCent: 3 });
  });
  it('Budget je Monat: 80 % einmal Hinweis, an der Grenze Pause; ohne Scharfschalten nie Budget', () => {
    let st = { ...leererStand(), einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 100, schaetzungCent: 50, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } } };
    expect(budgetReicht(leererStand(), 1, J)).toBe(false);
    expect(budgetReicht(st, 100, J)).toBe(true);
    let r = kostenBuchen(st, 79, J); st = r.stand;
    expect(r).toMatchObject({ hinweis80: false, grenze: false });
    r = kostenBuchen(st, 2, J); st = r.stand;
    expect(r).toMatchObject({ hinweis80: true, grenze: false });
    r = kostenBuchen(st, 1, J); st = r.stand;
    expect(r.hinweis80).toBe(false);
    r = kostenBuchen(st, 30, J);
    expect(r.grenze).toBe(true);
    expect(budgetReicht(r.stand, 1, J)).toBe(false);
    // Nächster Monat beginnt neu.
    expect(budgetReicht(r.stand, 50, '2026-11-02T08:00:00.000Z')).toBe(true);
  });
  it('Notbremse: mehr Wirkungen je Stunde als erlaubt → der Prozess pausiert sich', () => {
    let st = { ...leererStand(), einstellung: { notbremseJeStunde: 2 } };
    const a = wirkungZaehlen(st, J); st = a.stand;
    const b = wirkungZaehlen(st, J); st = b.stand;
    expect([a.notbremse, b.notbremse]).toEqual([false, false]);
    expect(wirkungZaehlen(st, J).notbremse).toBe(true);
    expect(wirkungZaehlen(st, plus(61)).notbremse).toBe(false);
  });
});

describe('Versionen, Anhalten, Abbrechen', () => {
  it('die Version bleibt am Lauf; Umzug nur mit Zuordnung (Vorschau zeigt, was fehlt)', () => {
    const a = voran(lauf(WEG), WEG, umfeld());
    const l = nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J);
    expect(l.version).toBe(1);
    const ohne10 = { knoten: WEG.knoten.filter(k => k.id !== fk(10)) };
    const [z] = umzugVorschau([l], ohne10);
    expect(z).toMatchObject({ ok: false, knoten: fk(10), nach: null });
    expect(umziehen(l, 2, z, J)).toBe(l);
    const [z2] = umzugVorschau([l], ohne10, { [fk(10)]: fk(12) });
    const um = umziehen(l, 2, z2, J);
    expect(um).toMatchObject({ version: 2, aktuell: fk(12), wartet: { knoten: fk(12) } });
  });
  it('anhalten/fortsetzen merkt sich „wartet“; abbrechen beendet nur offene Läufe', () => {
    const a = voran(lauf(WEG), WEG, umfeld());
    const w = nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J);
    const h = anhalten(w, J);
    expect(h.status).toBe('angehalten');
    expect(fortsetzen(h, J)).toMatchObject({ status: 'wartet', wartet: { art: 'aufgabe' } });
    const ab = abbrechen(w, J)!;
    expect(ab).toMatchObject({ status: 'abgebrochen', grund: 'hand', ergebnis: 'abbruch' });
    expect(abbrechen(ab, J)).toBeNull();
  });
});

describe('Zeit in Arbeitsstunden (M1) und Lage', () => {
  it('Freitag 17 Uhr + 2 Arbeitsstunden = Montag 10 Uhr (Berlin, Zeitumstellung dazwischen)', () => {
    expect(arbeitsstundenPlus('2026-10-23T15:00:00.000Z', 2)).toBe('2026-10-26T09:00:00.000Z');
    expect(zeitPlus('2026-10-23T15:00:00.000Z', { tage: 1, arbeitszeit: true })).toBe('2026-10-26T16:00:00.000Z');
    expect(zeitPlus(J, { stunden: 3 })).toBe(plus(180));
  });
  it('Lage nur als Zähler (HOI, Punkt 88)', () => {
    const a = voran(lauf(WEG), WEG, umfeld());
    const w = nachAktion(a.lauf, WEG, a.aktion!, { ok: true }, J);
    const lage = laufLage({ ...leereLaeufe(), laeufe: [w, { ...w, id: lid(2), status: 'fehler' }] }, plus(60 * 24 * 8));
    expect(lage).toMatchObject({ laeufe: 2, offen: 2, wartend: 1, fehler: 1, haengend: 1 });
    expect(JSON.stringify(lage)).not.toContain('pl-');
  });
  it('Schleifenschutz beim Veröffentlichen: ein Prozess, der sein eigenes Ereignis auslösen kann, bekommt einen Hinweis', () => {
    const d = definition([schritt(10, 'Stufe setzen', 1, { katalog: { id: 'crm.deal-stufe', werte: { stufe: 'angebot' } } })]);
    d.knoten = d.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: { art: 'ereignis', ereignis: 'deal-stufe' }, katalog: { id: 'ausloeser.ereignis' } } as typeof k : k));
    expect(schleifenBefunde(d).map(b => b.knotenId)).toEqual([fk(10)]);
  });
});

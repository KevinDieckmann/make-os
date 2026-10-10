// ─── Erholung je Person — Modell und Rechnungen (10.10., Kevin: „Einen Erholungsbereich … überall mit einstellbar“) ─────────────────
// Rein (lib/gesundheit/erholung.ts, erholung-lage.ts): Schritte, Grenzen (413, nie gekürzt), ungültig (400), Säuberung, fremde Sicht ohne
// Unterlagen/Kalender-Verweise, heute fällig, Woche, Tag aus allen Quellen, Streak, Ziele, Behandlungen, Vorschlag (EINE Regel), Zusammenhang
// (ab Mindestmenge, nie als Ursache), Pausen. Erfundene Werte.
import { describe, it, expect } from 'vitest';
import {
  erholungAnwenden, erholungSaeubern, erholungFuerBetrachter, leereErholung, nurEntfernen, erholungName, ErholungFehler, ERHOLUNG_GRENZEN, ERHOLUNG_VORLAGEN,
  type ErholungStand,
} from '@/lib/gesundheit/erholung';
import {
  heuteFaellig, wochenFortschritt, tagesErholung, erholteTage, erholungStreak, zielFortschritt, behandlungLage, erholungVorschlag, erholungZusammenhang,
  naechstePause, programmMinuten, ZUSAMMENHANG_MIN, erholungZoeZeilen,
} from '@/lib/gesundheit/erholung-lage';
import { tagPlus } from '@/lib/zeit/kalender-kern';

const J = '2026-10-10T08:00:00.000Z';
let n = 0;
const id = (p: string) => `${p}-t${++n}`;
const an = (s: ErholungStand | null, ops: unknown[]) => erholungAnwenden(s, ops, J, id);
const fehler = (f: () => unknown): ErholungFehler => { try { f(); } catch (e) { if (e instanceof ErholungFehler) return e; throw e; } throw new Error('kein Fehler'); };
// 2026-10-07 ist ein Mittwoch.
const MI = '2026-10-07';

describe('Bestand und Schritte', () => {
  it('Bestandsname immer mit Suffix', () => {
    expect(erholungName('kevin')).toBe('erholung--kevin');
    expect(erholungName('a b/../x')).toBe('erholung--abx');
  });

  it('Programm anlegen, ändern, entfernen — das Ziel verliert die Bindung, Einheiten bleiben', () => {
    let s = an(null, [{ op: 'programm', programm: { name: 'Mobility', art: 'mobility', proWoche: 3, tage: [3, 1, 3], uebungen: [{ name: 'Durchbewegen', minuten: 10 }, { name: 'Dehnen', minuten: 5, wiederholungen: 8 }] } }]);
    const p = s.programme[0];
    expect(p).toMatchObject({ name: 'Mobility', art: 'mobility', proWoche: 3, tage: [1, 3], status: 'aktiv', angelegt: J });
    expect(programmMinuten(p)).toBe(15);
    s = an(s, [{ op: 'programm', id: p.id, programm: { status: 'pausiert', stufe: 'Phase 2' } }]);
    expect(s.programme[0]).toMatchObject({ name: 'Mobility', status: 'pausiert', stufe: 'Phase 2', uebungen: p.uebungen });
    s = an(s, [{ op: 'ziel', ziel: { titel: '3×', zeitraum: 'woche', einheiten: 3, programmId: p.id } }, { op: 'einheit', einheit: { tag: MI, programmId: p.id } }]);
    s = an(s, [{ op: 'weg', liste: 'programme', id: p.id }]);
    expect(s.programme).toEqual([]);
    expect(s.ziele[0].programmId).toBeUndefined();
    expect(s.einheiten).toHaveLength(1);
  });

  it('Abhaken ist je Programm und Tag idempotent; Zurücknehmen über Programm + Tag', () => {
    let s = an(null, [{ op: 'programm', programm: { name: 'Atem', art: 'atem' } }]);
    const pid = s.programme[0].id;
    s = an(s, [{ op: 'einheit', einheit: { tag: MI, programmId: pid } }, { op: 'einheit', einheit: { tag: MI, programmId: pid } }]);
    expect(s.einheiten).toHaveLength(1);
    expect(s.einheiten[0]).toMatchObject({ art: 'atem', tag: MI, am: J });
    s = an(s, [{ op: 'einheit', einheit: { tag: MI, art: 'spaziergang', minuten: 20 } }, { op: 'einheit', einheit: { tag: MI, art: 'spaziergang', minuten: 10 } }]);
    expect(s.einheiten).toHaveLength(3);
    s = an(s, [{ op: 'einheit-weg', programmId: pid, tag: MI }]);
    expect(s.einheiten.map(e => e.art)).toEqual(['spaziergang', 'spaziergang']);
  });

  it('Behandlung mit Terminen (Kalender nur als Kennung) und Unterlagen nur als gu-…', () => {
    let s = an(null, [{ op: 'behandlung', behandlung: { art: 'Massage', geplant: 10, unterlagen: ['gu-11111111-2222-4333-8444-555555555555'] } }]);
    const b = s.behandlungen[0];
    s = an(s, [
      { op: 'behandlung-termin', id: b.id, termin: { tag: '2026-10-12', uhr: '17:00', terminId: 'kal-1|uid-abc', erledigt: false } },
      { op: 'behandlung-termin', id: b.id, termin: { tag: '2026-10-01', erledigt: true } },
    ]);
    expect(s.behandlungen[0].termine.map(t => t.tag)).toEqual(['2026-10-01', '2026-10-12']);
    expect(behandlungLage(s.behandlungen[0], MI)).toMatchObject({ erledigt: 1, geplant: 10, text: '1 von 10', naechster: { tag: '2026-10-12', uhr: '17:00', terminId: 'kal-1|uid-abc' } });
    expect(fehler(() => an(s, [{ op: 'behandlung', id: b.id, behandlung: { unterlagen: ['../geheim'] } }])).status).toBe(400);
    expect(fehler(() => an(s, [{ op: 'behandlung-termin', id: b.id, termin: { tag: '2026-10-12', terminId: 'mit leerzeichen' } }])).status).toBe(400);
  });

  it('Grenzen → 413 (nie gekürzt), Unsinn → 400, Unbekanntes → 404', () => {
    expect(fehler(() => an(null, [])).status).toBe(400);
    expect(fehler(() => an(null, Array.from({ length: ERHOLUNG_GRENZEN.ops + 1 }, () => ({ op: 'fokus', text: 'x' })))).status).toBe(413);
    expect(fehler(() => an(null, [{ op: 'fokus', text: 'x'.repeat(ERHOLUNG_GRENZEN.fokus + 1) }])).status).toBe(413);
    expect(fehler(() => an(null, [{ op: 'programm', programm: { name: 'x', uebungen: Array.from({ length: ERHOLUNG_GRENZEN.uebungen + 1 }, () => ({ name: 'u' })) } }])).status).toBe(413);
    expect(fehler(() => an(null, [{ op: 'programm', programm: { art: 'mobility' } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'programm', programm: { name: 'x', art: 'unbekannt' } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'programm', programm: { name: 'x', tage: [8] } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'einheit', einheit: { tag: '10.10.2026' } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'ziel', ziel: { titel: 'leer', zeitraum: 'woche' } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'weg', liste: 'programme', id: 'ep-gibtsnicht' }])).status).toBe(404);
    expect(fehler(() => an(null, [{ op: 'einstellungen', einstellungen: { pausen: { an: true, alleMin: 60, von: '18:00', bis: '09:00' } } }])).status).toBe(400);
    expect(fehler(() => an(null, [{ op: 'gibtsnicht' }])).status).toBe(400);
    // Ein ungültiger Schritt lässt den ganzen Stapel liegen (der reine Teil wirft — die Sperre schreibt dann nichts).
    expect(fehler(() => an(null, [{ op: 'fokus', text: 'ok' }, { op: 'gibtsnicht' }])).status).toBe(400);
  });

  it('nurEntfernen erkennt reines Entfernen (ohne Einwilligungs-Sperre erlaubt)', () => {
    expect(nurEntfernen([{ op: 'weg', liste: 'ziele', id: 'x' }, { op: 'einheit-weg', id: 'y' }])).toBe(true);
    expect(nurEntfernen([{ op: 'weg', liste: 'ziele', id: 'x' }, { op: 'fokus', text: '' }])).toBe(false);
    expect(nurEntfernen([])).toBe(false);
  });

  it('Säuberung beim Lesen: Fremdes fällt weg, nichts wird gekürzt; die fremde Sicht ohne Unterlagen, Kalender-Verweise, Pausen', () => {
    const roh = { v: 1, programme: [{ id: 'ep-1', name: 'P', art: 'xx', uebungen: [{ id: 'eu-1', name: 'U', minuten: 9999 }], proWoche: 99, tage: [1, 9], status: 'quatsch', fremd: 'weg' }],
      einheiten: [{ id: 'ee-1', tag: 'kaputt' }, { id: 'ee-2', tag: MI, art: 'atem', am: J }], behandlungen: [{ id: 'eb-1', art: 'B', termine: [{ id: 'et-1', tag: MI, terminId: 'k|u', erledigt: true }], unterlagen: ['gu-1', 'evil'] }],
      ziele: [], fokus: 'F', einstellungen: { pausen: { an: true, alleMin: 60, von: '08:00', bis: '16:00' }, vorschlag: false }, extra: 'weg' };
    const s = erholungSaeubern(roh)!;
    expect(s.programme[0]).toMatchObject({ art: 'eigene', proWoche: 1, tage: [1], status: 'aktiv' });
    expect(s.programme[0].uebungen[0].minuten).toBeUndefined();
    expect(s.einheiten.map(e => e.id)).toEqual(['ee-2']);
    expect(s.behandlungen[0].unterlagen).toEqual(['gu-1']);
    expect(JSON.stringify(s)).not.toContain('fremd');
    const f = erholungFuerBetrachter(s);
    expect(f.behandlungen[0].unterlagen).toEqual([]);
    expect(JSON.stringify(f)).not.toContain('k|u');
    expect(f.einstellungen).toEqual({ vorschlag: false });
    expect(erholungSaeubern(null)).toBeNull();
  });

  it('Vorlagen sind allgemein (keine Diagnose, keine Körperstelle)', () => {
    expect(ERHOLUNG_VORLAGEN.length).toBeGreaterThanOrEqual(10);
    for (const v of ERHOLUNG_VORLAGEN) expect(v.name).not.toMatch(/rücken|nacken|knie|haut|schulter|hüfte|gelenk/i);
  });
});

describe('Rechnungen', () => {
  const basis = () => {
    const s = an(null, [
      { op: 'programm', programm: { name: 'Fest Mo+Mi', art: 'mobility', proWoche: 2, tage: [1, 3] } },
      { op: 'programm', programm: { name: 'Flexibel 2×', art: 'dehnen', proWoche: 2 } },
      { op: 'programm', programm: { name: 'Pausiert', art: 'atem', proWoche: 7, status: 'pausiert' } },
    ]);
    return s;
  };

  it('heute fällig: fester Tag, flexibel bis zum Soll, Erledigtes bleibt sichtbar, Pausiertes nie', () => {
    let s = basis();
    const [fest, flex] = s.programme;
    expect(heuteFaellig(s, MI).map(f => f.programm.name)).toEqual(['Fest Mo+Mi', 'Flexibel 2×']);
    expect(heuteFaellig(s, '2026-10-08').map(f => f.programm.name)).toEqual(['Flexibel 2×']); // Do: kein fester Tag
    s = an(s, [{ op: 'einheit', einheit: { tag: '2026-10-05', programmId: flex.id } }, { op: 'einheit', einheit: { tag: '2026-10-06', programmId: flex.id } }]);
    expect(heuteFaellig(s, MI).map(f => f.programm.name)).toEqual(['Fest Mo+Mi']); // Soll erreicht
    s = an(s, [{ op: 'einheit', einheit: { tag: MI, programmId: fest.id } }]);
    expect(heuteFaellig(s, MI)).toEqual([expect.objectContaining({ erledigt: true, grund: '1 von 2 diese Woche' })]);
    expect(wochenFortschritt(s, MI)).toEqual([
      { id: fest.id, name: 'Fest Mo+Mi', soll: 2, ist: 1, heuteErledigt: true },
      { id: flex.id, name: 'Flexibel 2×', soll: 2, ist: 2, heuteErledigt: false },
    ]);
  });

  it('Tag aus allen Quellen; Streak zählt bis heute bzw. ab gestern', () => {
    let s = basis();
    s = an(s, [{ op: 'einheit', einheit: { tag: tagPlus(MI, -1), art: 'spaziergang', minuten: 20 } }]);
    const q = { aufgabenJeTag: { [tagPlus(MI, -2)]: 1 }, routinenJeTag: { [tagPlus(MI, -3)]: 2 }, zeitJeTag: { [tagPlus(MI, -4)]: 600, [tagPlus(MI, -5)]: 120 }, geplantJeTag: { [MI]: 30 } };
    expect(tagesErholung(s, q, tagPlus(MI, -1))).toMatchObject({ einheiten: 1, minuten: 20, erholt: true });
    expect(tagesErholung(s, q, tagPlus(MI, -4))).toMatchObject({ zeitMin: 10, erholt: true });
    expect(tagesErholung(s, q, tagPlus(MI, -5))).toMatchObject({ zeitMin: 2, erholt: false }); // unter 5 Minuten zählt nicht
    expect(tagesErholung(s, q, MI)).toMatchObject({ geplantMin: 30, erholt: false }); // geplant ist noch nicht erholt
    const tage = erholteTage(s, q, MI, 30);
    expect(erholungStreak(tage, MI)).toEqual({ tage: 4, heuteDabei: false });
    expect(erholungStreak(new Set([MI, tagPlus(MI, -1)]), MI)).toEqual({ tage: 2, heuteDabei: true });
    expect(erholungStreak(new Set(), MI)).toEqual({ tage: 0, heuteDabei: false });
  });

  it('Ziele: an ein Programm gebunden oder jede Erholung; mit zwei Sollwerten zählt der kleinere Anteil', () => {
    let s = basis();
    const flex = s.programme[1];
    s = an(s, [
      { op: 'einheit', einheit: { tag: '2026-10-05', programmId: flex.id } },
      { op: 'einheit', einheit: { tag: '2026-10-06', art: 'waerme', minuten: 30 } },
      { op: 'einheit', einheit: { tag: '2026-09-28', programmId: flex.id } }, // Vorwoche zählt nicht
      { op: 'ziel', ziel: { titel: 'Flex', zeitraum: 'woche', einheiten: 2, programmId: flex.id } },
      { op: 'ziel', ziel: { titel: 'Alles', zeitraum: 'woche', einheiten: 4, minuten: 60 } },
      { op: 'ziel', ziel: { titel: 'Monat', zeitraum: 'monat', einheiten: 3 } },
    ]);
    const q = { aufgabenJeTag: { [MI]: 1 }, zeitJeTag: { [MI]: 900 } };
    const [z1, z2, z3] = s.ziele.map(z => zielFortschritt(z, s, q, MI));
    expect(z1).toMatchObject({ ist: { einheiten: 1 }, anteil: 0.5, erreicht: false });
    // 2 Einheiten + 1 Aufgabe = 3 von 4; Minuten: Dehnen-Vorlage 10 + 30 + 15 gemessen = 55 von 60 → kleinerer Anteil 0,75
    expect(z2.ist).toEqual({ einheiten: 3, minuten: 55 });
    expect(z2.anteil).toBeCloseTo(0.75);
    expect(z3).toMatchObject({ ist: { einheiten: 3 }, erreicht: true, anteil: 1 });
  });

  it('Vorschlag: EINE Regel mit Vorrang, ohne Werte null', () => {
    expect(erholungVorschlag({})).toBeNull();
    expect(erholungVorschlag({ rec: 30 })?.art).toBe('erholungstag');
    expect(erholungVorschlag({ rec: 30, entlastung: { vorschlag: true, text: 'Trend' } })?.art).toBe('erholungstag');
    expect(erholungVorschlag({ rec: 80, entlastung: { vorschlag: true, text: 'Trend auffällig' } })).toMatchObject({ art: 'entlastungswoche', gruende: expect.arrayContaining(['Trend auffällig']) });
    expect(erholungVorschlag({ rec: 80, schlafSchuldH: 2.5 })?.art).toBe('schlaf');
    expect(erholungVorschlag({ rec: 80, schlafSchuldH: 1.5 })?.art).toBe('normal');
    expect(erholungVorschlag({ rec: 50 })?.art).toBe('leicht');
    expect(erholungVorschlag({ rec: 80, strainGestern: 19, recGestern: 50 })?.art).toBe('leicht'); // gestern über dem Rahmen (gelb: bis 14)
    expect(erholungVorschlag({ strainGestern: 12, recGestern: 80 })).toBeNull(); // nur gestern im Rahmen, heute ohne Wert
    expect(erholungVorschlag({ rec: 80 })).toMatchObject({ art: 'normal', titel: 'Normal belastbar' });
  });

  it('Zusammenhang Erholung ↔ Beschwerde am Folgetag: erst ab Mindestmenge, als Zusammenhang formuliert', () => {
    const heute = '2026-10-31';
    const erholt = new Set<string>();
    const sym: Record<string, { juckreiz: number }> = {};
    for (let i = 1; i <= 2 * ZUSAMMENHANG_MIN; i++) {
      const tag = tagPlus(heute, -i);
      if (i % 2) erholt.add(tag);
      sym[tagPlus(tag, 1)] = { juckreiz: erholt.has(tag) ? 2 : 5 };
    }
    const z = erholungZusammenhang(erholt, sym, heute, 60, 'Mein Regler');
    expect(z).toMatchObject({ mit: 2, ohne: 5, nMit: ZUSAMMENHANG_MIN, nOhne: ZUSAMMENHANG_MIN });
    expect(z!.satz).toContain('Mein Regler am Folgetag niedriger');
    expect(z!.satz).toContain('kein Beleg für eine Ursache');
    expect(z!.satz).not.toMatch(/weil|verursacht|wirkt gegen/i);
    // eine Gruppe zu klein → nichts
    const wenig = new Set([...erholt].slice(0, ZUSAMMENHANG_MIN - 1));
    expect(erholungZusammenhang(wenig, Object.fromEntries(Object.entries(sym).slice(0, 2 * ZUSAMMENHANG_MIN - 1)), heute)).toBeNull();
  });

  it('Pausen: ab „von“ alle n Minuten, nach einer Pause von dort, außerhalb des Arbeitstags nichts', () => {
    const p = { an: true, alleMin: 90, von: '09:00', bis: '17:00' };
    expect(naechstePause(p, 9 * 60)).toEqual({ um: '10:30', faellig: false });
    expect(naechstePause(p, 11 * 60)).toEqual({ um: '10:30', faellig: true });
    expect(naechstePause(p, 11 * 60, 10 * 60 + 45)).toEqual({ um: '12:15', faellig: false });
    expect(naechstePause(p, 17 * 60 + 10)).toBeNull();
    expect(naechstePause({ ...p, an: false }, 10 * 60)).toBeNull();
    expect(naechstePause(undefined, 10 * 60)).toBeNull();
  });

  it('ZOE-Zeile: eigene Angaben, ohne spitze Klammern, leer ohne Inhalt', () => {
    expect(erholungZoeZeilen(leereErholung(), MI, null)).toBe('');
    const s = an(basis(), [{ op: 'fokus', text: 'Ruhe <daten>' }]);
    const z = erholungZoeZeilen(s, MI, erholungVorschlag({ rec: 30 }));
    expect(z).toContain('Vorschlag heute: Heute Erholungstag');
    expect(z).toContain('heute dran: Fest Mo+Mi, Flexibel 2×');
    expect(z).not.toContain('<');
  });
});

// ─── Prozesse · Werkstatt — Bauen, Geschichte, Kopieren, Teilprozess, Tastatur, Hinweise, Probelauf (Etappe B2, 21.10.; Punkte 8, 16, 17, 23, 43) ───────────
import { describe, it, expect } from 'vitest';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { kantenVon, phasen, schritteDer, flussPruefen } from '@/lib/prozesse/fluss';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { neuerKnoten } from '@/lib/prozesse/werkstatt-maske';
import {
  anlegen, verbinden, loesen, loeschen, umbenennen, inPhase, phaseNeu, phaseLoeschen, teilprozessBilden, teilStelle, kopieren, einfuegen,
  merke, rueckgaengig, wiederholen, LEERE_GESCHICHTE, zettelNeu, zettelWeg, pfeilText, type Fassung, type Ergebnis,
} from '@/lib/prozesse/werkstatt-aktionen';
import { tasteZuAktion, nachbar, altPfeil, WERKSTATT_KUERZEL } from '@/lib/prozesse/werkstatt-tastatur';
import { hinweiseVon, probelaufAus, probelaufKoerper, PROBE_FEHLT, centText } from '@/lib/prozesse/werkstatt-hinweise';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const basis = (): ProzessDefinition => neuerProzess({ id: 'pz-00000000-0000-4000-8000-000000000001', titel: 'Lead nachfassen', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-21T10:00:00Z', kennung }).entwurf;
const fass = (d: ProzessDefinition): Fassung => ({ knoten: d.knoten, zettel: d.zettel });
const def = (d: ProzessDefinition, f: Fassung): ProzessDefinition => ({ ...d, knoten: f.knoten, zettel: f.zettel });
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const knoten = (id: string, titel?: string) => neuerKnoten(katalogEintrag(id)!, kennung(), titel);
const start = (d: ProzessDefinition) => d.knoten.find(k => k.form === 'ausloeser')!;
const phase = (d: Pick<ProzessDefinition, 'knoten'>) => phasen(d)[0];

describe('Anlegen am Ausgang (Punkt 17: „+“, Tab, Alt+Pfeil)', () => {
  it('weiter hängt direkt dahinter in den Strang — die Kante kommt aus kantenVon, dieselbe Stelle wie der Motor', () => {
    const d = basis();
    const a = knoten('aufgabe.anlegen', 'Angebot vorbereiten');
    const f = gut(anlegen(fass(d), a, { nach: start(d).id }));
    expect(kantenVon(f).some(k => k.von === start(d).id && k.nach === a.id && k.ausgang === 'weiter')).toBe(true);
    const b = knoten('inbox.mail-entwurf', 'Angebot senden');
    const f2 = gut(anlegen(f, b, { nach: start(d).id }));
    expect(schritteDer(f2, phase(d).id).map(s => s.id)).toEqual([start(d).id, b.id, a.id]);
  });
  it('nein an einer Entscheidung wird ein Abzweig (Zweig gesetzt); ein zweites nein kommt dazwischen (Werkstatt-Fäden 24.10.: die Kette bleibt ganz)', () => {
    const d = basis();
    const r = knoten('entscheidung.mensch', 'Antwort erhalten?');
    let f = gut(anlegen(fass(d), r, { nach: start(d).id }));
    const e = knoten('erinnerung.runde', 'Erinnerung senden');
    f = gut(anlegen(f, e, { nach: r.id, ausgang: 'nein' }));
    expect(f.knoten.find(k => k.id === r.id)?.zweige?.nein).toBe(e.id);
    const x = knoten('aufgabe.anlegen', 'Vorher klären');
    const g = gut(anlegen(f, x, { nach: r.id, ausgang: 'nein' }));
    expect(g.knoten.find(k => k.id === r.id)?.zweige?.nein).toBe(x.id);
    expect(kantenVon(g).find(k => k.von === x.id && k.ausgang === 'weiter')?.nach).toBe(e.id);
  });
  it('ein Sprung „weiter bei …“ des Vorgängers wandert an den neuen Knoten (Kette bleibt ganz)', () => {
    const d = basis();
    const a = knoten('aufgabe.anlegen', 'Lead prüfen'), z = knoten('ende.ziel', 'Lead qualifiziert');
    let f = gut(anlegen(fass(d), a, { nach: start(d).id }));
    f = gut(anlegen(f, z, { nach: a.id }));
    f = { ...f, knoten: f.knoten.map(k => (k.id === a.id ? { ...k, zweige: { ja: z.id } } : k)) };
    const m = knoten('crm.kontakt-notiz', 'Notiz schreiben');
    f = gut(anlegen(f, m, { nach: a.id }));
    // a → m (der Strang), m → z — wohin es vorher ging (ob als Sprung oder im Strang, rechnet kantenVon gleich).
    expect(f.knoten.find(k => k.id === a.id)?.zweige).toBeUndefined();
    expect(kantenVon(f).find(k => k.von === a.id && k.ausgang === 'weiter')?.nach).toBe(m.id);
    expect(kantenVon(f).find(k => k.von === m.id && k.ausgang === 'weiter')?.nach).toBe(z.id);
  });
  it('ein Auslöser kommt immer an den Anfang; vor einem Auslöser steht nichts', () => {
    const d = basis();
    const f = gut(anlegen(fass(d), knoten('aufgabe.anlegen', 'Etwas tun'), { nach: start(d).id }));
    const t = knoten('ausloeser.ereignis', 'Neuer Lead');
    const f2 = gut(anlegen(f, t, { nach: f.knoten.at(-1)!.id }));
    expect(schritteDer(f2, phase(d).id).slice(0, 2).every(s => s.form === 'ausloeser')).toBe(true);
    expect(anlegen(f, knoten('aufgabe.anlegen'), { vor: start(d).id }).ok).toBe(false);
  });
  it('hinter einer Außenwirkung steht das Schloss — ein neuer Schritt kommt hinter das Schloss, das Speichern ändert nichts mehr daran', () => {
    const d = basis();
    const m = knoten('inbox.mail-entwurf', 'Angebot senden');
    const mit = schlossSetzen(def(d, gut(anlegen(fass(d), m, { nach: start(d).id })))).definition;
    const schloss = mit.knoten.find(k => k.schloss?.fuer === m.id)!;
    const x = knoten('aufgabe.anlegen', 'Nachfassen planen');
    const f = gut(anlegen(fass(mit), x, { nach: m.id }));
    expect(schritteDer(f, phase(d).id).map(s => s.id)).toEqual([start(d).id, m.id, schloss.id, x.id]);
    expect(schlossSetzen(def(mit, f)).definition.knoten).toEqual(f.knoten);
    expect(kantenVon(f).some(k => k.von === schloss.id && k.nach === x.id && k.ausgang === 'ja')).toBe(true);
  });
  it('Platz schaffen: Schritte rechts vom neuen Platz rücken weiter', () => {
    const d = basis();
    const a = { ...knoten('aufgabe.anlegen', 'Eins tun'), pos: { x: 300, y: 20 } };
    let f = gut(anlegen(fass(d), a, { nach: start(d).id }));
    f = gut(anlegen(f, knoten('aufgabe.anlegen', 'Zwei tun'), { nach: start(d).id, platz: { x: 300, y: 20 }, platzSchaffen: 256 }));
    expect(f.knoten.find(k => k.id === a.id)?.pos?.x).toBe(556);
  });
});

describe('Verbinden, lösen, löschen', () => {
  const kette = () => {
    const d = basis();
    const a = knoten('aufgabe.anlegen', 'Eins tun'), b = knoten('aufgabe.anlegen', 'Zwei tun'), r = knoten('entscheidung.mensch', 'Passt es?');
    let f = gut(anlegen(fass(d), a, { nach: start(d).id }));
    f = gut(anlegen(f, r, { nach: a.id }));
    f = gut(anlegen(f, b, { nach: r.id }));
    return { d, f, a, b, r };
  };
  it('weiter: das Ziel folgt danach direkt (Reihenfolge aus den Fäden); nein setzt den Zweig', () => {
    const { d, f, a, b, r } = kette();
    const f1 = gut(verbinden(f, start(d).id, 'weiter', b.id));
    expect(schritteDer(f1, phase(d).id).map(s => s.id)).toEqual([start(d).id, b.id, a.id, r.id]);
    const f2 = gut(verbinden(f, r.id, 'nein', a.id));
    expect(f2.knoten.find(k => k.id === r.id)?.zweige?.nein).toBe(a.id);
    expect(verbinden(f, a.id, 'weiter', a.id).ok).toBe(false);
    expect(verbinden(f, a.id, 'weiter', start(d).id).ok).toBe(false);
  });
  it('Fäden bleiben in ihrer Phase', () => {
    const { f, a } = kette();
    const p2 = kennung();
    let g = gut(phaseNeu(f, { id: p2, titel: 'Zweite Phase' }));
    const c = knoten('aufgabe.anlegen', 'Drei tun');
    g = gut(anlegen(g, c, { phaseId: p2 }));
    const x = verbinden(g, a.id, 'nein', c.id);
    expect(x.ok).toBe(false);
  });
  it('lösen: nur Zweige — der Strang lässt sich nur umhängen', () => {
    const { f, a, r } = kette();
    const f2 = gut(verbinden(f, r.id, 'nein', a.id));
    expect(gut(loesen(f2, r.id, 'nein')).knoten.find(k => k.id === r.id)?.zweige).toBeUndefined();
    expect(loesen(f2, r.id, 'weiter').ok).toBe(false);
  });
  it('löschen: Zweige auf den Gelöschten lösen sich; das Freigabe-Schloss bleibt (nicht entfernbar)', () => {
    const { f, a, r } = kette();
    const f2 = gut(verbinden(f, r.id, 'nein', a.id));
    const f3 = gut(loeschen(f2, [a.id]));
    expect(f3.knoten.some(k => k.id === a.id)).toBe(false);
    expect(f3.knoten.find(k => k.id === r.id)?.zweige).toBeUndefined();
    const schloss = { id: kennung(), elternId: phase(f).id, titel: 'Freigabe', rang: 99, form: 'freigabe' as const, bahn: 'mensch' as const, schloss: { fuer: r.id, grund: 'aussen' as const } };
    const mit = { ...f, knoten: [...f.knoten, schloss] };
    const x = loeschen(mit, [schloss.id]);
    expect(x.ok).toBe(false);
    if (!x.ok) expect(x.grund).toContain('Freigabe-Schloss');
  });
  it('umbenennen, Beschriftung, in eine andere Phase', () => {
    const { f, a, r } = kette();
    expect(umbenennen(f, a.id, '  ').ok).toBe(false);
    expect(gut(umbenennen(f, a.id, 'Angebot senden')).knoten.find(k => k.id === a.id)?.titel).toBe('Angebot senden');
    expect(gut(pfeilText(f, r.id, 'nein', 'kein Interesse')).knoten.find(k => k.id === r.id)?.pfeilText?.nein).toBe('kein Interesse');
    const p2 = kennung();
    const g = gut(phaseNeu(f, { id: p2, titel: 'Zweite Phase' }));
    expect(gut(inPhase(g, a.id, p2)).knoten.find(k => k.id === a.id)?.elternId).toBe(p2);
    expect(phaseLoeschen(g, phase(g).id).ok).toBe(false);
    expect(gut(phaseLoeschen(g, p2)).knoten.some(k => k.id === p2)).toBe(false);
  });
});

describe('Rückgängig, Wiederholen, Kopieren mit Kanten (Punkt 16)', () => {
  it('Geschichte: merken, zurück, vor — Wiederholen verfällt nach einer neuen Änderung', () => {
    const d = basis();
    const f0 = fass(d);
    const f1 = gut(anlegen(f0, knoten('aufgabe.anlegen', 'Eins tun'), { nach: start(d).id }));
    let g = merke(LEERE_GESCHICHTE, f0);
    const z = rueckgaengig(g, f1)!;
    expect(z.fassung).toEqual(f0);
    const v = wiederholen(z.geschichte, z.fassung)!;
    expect(v.fassung).toEqual(f1);
    g = merke(v.geschichte, f1);
    expect(g.vor).toEqual([]);
    expect(rueckgaengig(LEERE_GESCHICHTE, f0)).toBeNull();
  });
  it('kopieren nimmt Zweige zwischen den Gewählten mit, Einfügen erzeugt neue Kennungen und biegt die Zweige um', () => {
    const d = basis();
    const r = knoten('entscheidung.mensch', 'Antwort erhalten?'), e = knoten('erinnerung.runde', 'Erinnerung senden'), x = knoten('aufgabe.anlegen', 'Weiter machen');
    let f = gut(anlegen(fass(d), r, { nach: start(d).id }));
    f = gut(anlegen(f, e, { nach: r.id, ausgang: 'nein' }));
    f = gut(anlegen(f, x, { nach: r.id }));
    const ab = kopieren(f, [r.id, e.id, start(d).id])!;
    expect(ab.knoten.map(k => k.id)).toEqual([r.id, e.id]); // der Auslöser bleibt am Anfang
    const g = gut(einfuegen(f, ab, { phaseId: phase(d).id, nach: x.id, kennung }));
    const neu = g.knoten.filter(k => !f.knoten.some(o => o.id === k.id));
    expect(neu).toHaveLength(2);
    const rNeu = neu.find(k => k.form === 'entscheidung')!, eNeu = neu.find(k => k.form === 'erinnerung')!;
    expect(rNeu.zweige?.nein).toBe(eNeu.id);
    expect(flussPruefen(g).filter(b => b.stufe === 'fehler')).toEqual([]);
    // Ohne die Erinnerung kopiert, fällt der Zweig weg (nie ein Verweis ins Leere).
    expect(kopieren(f, [r.id])!.knoten[0].zweige).toBeUndefined();
  });
});

describe('Teilprozess bilden (Punkt 8)', () => {
  const lang = () => {
    const d = basis();
    let f = fass(d);
    let vor = start(d).id;
    for (let i = 0; i < 11; i++) { const k = knoten('aufgabe.anlegen', `Schritt ${i + 1} tun`); f = gut(anlegen(f, k, { nach: vor })); vor = k.id; }
    return { d, f };
  };
  it('ab zehn Schritten ein ruhiger Hinweis „Teilprozess bilden?“ — nie ein Fehler', () => {
    const { f } = lang();
    const h = hinweiseVon(f).find(x => x.aktion === 'teilprozess');
    expect(h?.text).toContain('einen Teilprozess bilden?');
    expect(flussPruefen(f).find(b => b.text.includes('Teilprozess'))?.stufe).toBe('hinweis');
  });
  it('ein Klick teilt die Phase nahe der Mitte — danach kein Hinweis mehr, keine Fehler', () => {
    const { d, f } = lang();
    const g = gut(teilprozessBilden(f, phase(d).id, { id: kennung() }));
    expect(phasen(g)).toHaveLength(2);
    expect(phasen(g).map(p => schritteDer(g, p.id).length)).toEqual([6, 6]);
    expect(hinweiseVon(g).some(x => x.aktion === 'teilprozess')).toBe(false);
    expect(definitionPruefen(def(d, g)).filter(b => b.stufe === 'fehler')).toEqual([]);
  });
  it('nie quer durch einen Zweig: eine Entscheidung mit ihrem Nein-Zweig bleibt beisammen', () => {
    const d = basis();
    const r = knoten('entscheidung.mensch', 'Passt es?'), e = knoten('erinnerung.runde', 'Nachfassen senden'), z = knoten('ende.ziel', 'Mandat aktiv');
    let f = gut(anlegen(fass(d), r, { nach: start(d).id }));
    f = gut(anlegen(f, z, { nach: r.id }));
    f = gut(anlegen(f, e, { nach: r.id, ausgang: 'nein' }));
    // Reihenfolge: Start, r, e (Abzweig), z — zwischen r und e liegt der Zweig quer.
    expect(teilStelle(f, phase(d).id, e.id)).toBeNull();
    expect(teilprozessBilden(f, phase(d).id, { id: kennung(), ab: e.id }).ok).toBe(false);
    expect(teilStelle(f, phase(d).id, r.id)).toBe(1); // vor der Entscheidung geht es (der Auslöser bleibt vorn)
  });
});

describe('Tastatur (Punkt 17)', () => {
  it('Alt+Pfeil legt an, Tab öffnet die Formauswahl, ⇧+Pfeil schiebt, ⌘Z/⌘⇧Z, ⌘C/⌘V/⌘D', () => {
    expect(tasteZuAktion({ key: 'ArrowRight', altKey: true })).toEqual({ art: 'anlegen', richtung: 'rechts' });
    expect(tasteZuAktion({ key: 'Tab' })).toEqual({ art: 'formauswahl' });
    expect(tasteZuAktion({ key: 'ArrowDown', shiftKey: true })).toEqual({ art: 'schieben', dx: 0, dy: 20 });
    expect(tasteZuAktion({ key: 'ArrowLeft' })).toEqual({ art: 'waehlen', richtung: 'links' });
    expect(tasteZuAktion({ key: 'z', metaKey: true })).toEqual({ art: 'rueckgaengig' });
    expect(tasteZuAktion({ key: 'z', metaKey: true, shiftKey: true })).toEqual({ art: 'wiederholen' });
    expect(tasteZuAktion({ key: 'z', ctrlKey: true }, false)).toEqual({ art: 'rueckgaengig' });
    expect(tasteZuAktion({ key: 'd', metaKey: true })).toEqual({ art: 'duplizieren' });
    expect(tasteZuAktion({ key: 'Delete' })).toEqual({ art: 'loeschen' });
    expect(tasteZuAktion({ key: 'x' })).toBeNull();
    expect(WERKSTATT_KUERZEL.map(k => k.taste)).toContain('Alt + Pfeil');
  });
  it('Alt+Pfeil: rechts dahinter (Entscheidung „ja“), links davor, unten der Abzweig bzw. die Bahn darunter', () => {
    expect(altPfeil({ form: 'entscheidung' }, 'rechts', {})).toEqual({ ausgang: 'ja' });
    expect(altPfeil({ form: 'entscheidung' }, 'unten', {})).toEqual({ ausgang: 'nein' });
    expect(altPfeil({ form: 'entscheidung', zweige: { nein: 'x' } }, 'unten', {})).toBeNull();
    expect(altPfeil({ form: 'schritt' }, 'unten', { darunter: 'agent' })).toEqual({ ausgang: 'weiter', bahn: 'agent' });
    expect(altPfeil({ form: 'ausloeser' }, 'links', {})).toBeNull();
    expect(altPfeil({ form: 'warten' }, 'unten', {})).toEqual({ ausgang: 'abgelaufen' });
  });
  it('Pfeile wählen den nächsten Nachbarn in der Richtung', () => {
    const b = { x: 0, y: 0, b: 100, h: 100 };
    const andere = [{ id: 'rechts', x: 300, y: 10, b: 100, h: 100 }, { id: 'unten', x: 0, y: 300, b: 100, h: 100 }, { id: 'schraeg', x: 200, y: 400, b: 100, h: 100 }];
    expect(nachbar(b, andere, 'rechts')).toBe('rechts');
    expect(nachbar(b, andere, 'unten')).toBe('unten');
    expect(nachbar(b, andere, 'links')).toBeNull();
  });
});

describe('Hinweise der Beschriftung (Punkt 23)', () => {
  it('Einzelwort → Verb + Gegenstand; leerer Nein-Ausgang = Warnung; allgemeines Ende → Zustand nennen', () => {
    const d = basis();
    let f = gut(anlegen(fass(d), knoten('aufgabe.anlegen', 'Angebot'), { nach: start(d).id }));
    const r = knoten('entscheidung.mensch', 'Antwort erhalten?');
    f = gut(anlegen(f, r, { nach: f.knoten.at(-1)!.id }));
    f = gut(anlegen(f, knoten('ende.ziel', 'Ende'), { nach: r.id }));
    const h = hinweiseVon(f);
    expect(h.some(x => x.art === 'rat' && x.text.includes('Verb + Gegenstand'))).toBe(true);
    expect(h.find(x => x.knotenId === r.id)?.art).toBe('warnung');
    expect(h.some(x => x.text.includes('Mandat aktiv'))).toBe(true);
    expect(h.some(x => x.text.includes('„Start“'))).toBe(false); // Auslöser brauchen kein Verb
  });
});

describe('Notiz-Zettel', () => {
  it('anlegen und löschen — nur Text, nie ein Knoten', () => {
    const d = basis();
    const f = gut(zettelNeu(fass(d), { id: 'zt-1', text: 'Auftrag an den Agenten: freundlich bleiben', pos: { x: 10, y: 10 } }));
    expect(f.zettel).toHaveLength(1);
    expect(f.knoten).toEqual(d.knoten);
    expect(gut(zettelWeg(f, ['zt-1'])).zettel).toBeUndefined();
  });
});

describe('Probelauf (Vertrag mit dem Lauf-Motor)', () => {
  it('404 = kommt mit dem Lauf-Motor; Ergebnis je Knoten, unbekannte Status fallen weg', () => {
    expect(probelaufAus(404, null)).toEqual({ art: 'fehlt' });
    expect(PROBE_FEHLT).toBe('Probelauf kommt mit dem Lauf-Motor.');
    const r = probelaufAus(200, { schritte: [{ knotenId: 'a', status: 'wuerde', text: 'legt Aufgabe an' }, { knotenId: 'b', status: 'quatsch', text: '' }], kostenSchaetzungCent: 42 });
    expect(r).toEqual({ art: 'ergebnis', ergebnis: { schritte: [{ knotenId: 'a', status: 'wuerde', text: 'legt Aufgabe an' }], kostenSchaetzungCent: 42 } });
    expect(probelaufAus(409, { fehler: 'Noch nicht fertig' })).toEqual({ art: 'fehler', text: 'Noch nicht fertig' });
    expect(probelaufKoerper('pz-x', 'entwurf')).toEqual({ prozessId: 'pz-x', quelle: 'entwurf', fall: 'beispiel' });
    expect(centText(42)).toBe('0,42 €');
  });
});

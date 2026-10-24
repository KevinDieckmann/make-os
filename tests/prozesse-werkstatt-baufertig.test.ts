// ─── Prozesse · Werkstatt bau-fertig (22.10., n8n-Niveau; research/prozesse/WERKSTATT_BAUFERTIG.md) ─────────────────────────────────────────────────────
// Rein: „+“ mitten auf dem Faden (dazwischen einfügen), Verbinden über Phasen ohne Fehler, Kantenende umhängen, Mitte eines Fadens, Tastatur (Enter, F2, Zoom,
// Karte), Knoten-Auswahl in Gruppen (Zuletzt benutzt, Daten, Anbindungen). Dazu Wächter der Oberfläche (Hinweise schweben, Namensfeld, Seitenleiste).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { kantenVon, phasen, schritteDer, flussPruefen, seitenZiele } from '@/lib/prozesse/fluss';
import { katalogEintrag, BAUSTEIN_KATALOG } from '@/lib/prozesse/baustein-katalog';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { neuerKnoten, formauswahlGruppen, zuletztMerken, zuletztAus, DATEN_BAUSTEINE, ZULETZT_MAX } from '@/lib/prozesse/werkstatt-maske';
import {
  anlegen, phaseNeu, zwischenEinfuegen, zwischenGrund, verbindenFrei, umhaengen, neuerFlussFehler, ABZWEIG_EINER, type Fassung, type Ergebnis,
} from '@/lib/prozesse/werkstatt-aktionen';
import { kantenMitte, kantenPlus, werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { tasteZuAktion, WERKSTATT_KUERZEL } from '@/lib/prozesse/werkstatt-tastatur';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const basis = (): ProzessDefinition => neuerProzess({ id: 'pz-00000000-0000-4000-8000-000000000001', titel: 'Lead nachfassen', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-21T10:00:00Z', kennung }).entwurf;
const fass = (d: Pick<ProzessDefinition, 'knoten' | 'zettel'>): Fassung => ({ knoten: d.knoten, ...(d.zettel ? { zettel: d.zettel } : {}) });
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const knoten = (id: string, titel?: string) => neuerKnoten(katalogEintrag(id)!, kennung(), titel);
const start = (f: Pick<ProzessDefinition, 'knoten'>) => f.knoten.find(k => k.form === 'ausloeser')!;
const kante = (f: Pick<ProzessDefinition, 'knoten'>, von: string, nach: string) => kantenVon(f).find(k => k.von === von && k.nach === nach)!;
const weiterVon = (f: Pick<ProzessDefinition, 'knoten'>, von: string) => kantenVon(f).find(k => k.von === von && (k.ausgang === 'weiter' || k.ausgang === 'ja'))?.nach ?? null;
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

/** Auslöser → A → B → C in einer Phase. */
function kette(): { f: Fassung; a: string; b: string; c: string } {
  const d = basis();
  const a = knoten('aufgabe.anlegen', 'Lead prüfen'), b = knoten('crm.kontakt-notiz', 'Notiz schreiben'), c = knoten('ende.ziel', 'Lead qualifiziert');
  let f = gut(anlegen(fass(d), a, { nach: start(d).id }));
  f = gut(anlegen(f, b, { nach: a.id }));
  f = gut(anlegen(f, c, { nach: b.id }));
  return { f, a: a.id, b: b.id, c: c.id };
}

describe('Punkt 3 · „+“ mitten auf dem Faden: dazwischen einfügen', () => {
  it('Strang: der Neue steht danach zwischen Quelle und Ziel — dieselben Kanten, die der Motor geht', () => {
    const { f, a, b } = kette();
    const x = knoten('aufgabe.anlegen', 'Unterlagen sammeln');
    const r = gut(zwischenEinfuegen(f, kante(f, a, b), x));
    expect(weiterVon(r, a)).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(b);
    expect(flussPruefen(r).filter(z => z.stufe === 'fehler')).toEqual([]);
  });
  it('Sprung „weiter bei …“: der Neue übernimmt den Sprung, das Ziel bleibt dasselbe', () => {
    const { f: f0, a, c } = kette();
    const f = { ...f0, knoten: f0.knoten.map(k => (k.id === a ? { ...k, zweige: { ja: c } } : k)) };
    expect(weiterVon(f, a)).toBe(c);
    const x = knoten('aufgabe.anlegen', 'Kurz prüfen');
    const r = gut(zwischenEinfuegen(f, kante(f, a, c), x));
    expect(weiterVon(r, a)).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(c);
  });
  it('Entscheidung „ja“ mit eigenem Ziel: ja zeigt auf den Neuen, der Neue springt zum alten Ziel', () => {
    const d = basis();
    const e = knoten('entscheidung.mensch', 'Passt es?'), m = knoten('aufgabe.anlegen', 'Mitte'), z = knoten('ende.ziel', 'Erledigt');
    let f = gut(anlegen(fass(d), e, { nach: start(d).id }));
    f = gut(anlegen(f, m, { nach: e.id }));
    f = gut(anlegen(f, z, { nach: m.id }));
    f = { ...f, knoten: f.knoten.map(k => (k.id === e.id ? { ...k, zweige: { ja: z.id } } : k)) };
    const x = knoten('aufgabe.anlegen', 'Vorher klären');
    const r = gut(zwischenEinfuegen(f, kante(f, e.id, z.id), x));
    expect(r.knoten.find(k => k.id === e.id)?.zweige?.ja).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(z.id);
  });
  it('mehrere Auslöser: der Neue kommt hinter den letzten — jeder Auslöser führt in ihn', () => {
    const { f: f0, a } = kette();
    const f = gut(anlegen(f0, knoten('ausloeser.zeitplan', 'Montags'), {}));
    const st = f.knoten.filter(k => k.form === 'ausloeser');
    expect(st).toHaveLength(2);
    const x = knoten('aufgabe.anlegen', 'Liste holen');
    const r = gut(zwischenEinfuegen(f, kante(f, st[0].id, a), x));
    for (const s of st) expect(weiterVon(r, s.id)).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(a);
  });
  it('hinter einem Freigabe-Schloss einfügen geht, VOR das Schloss nie; Abzweige tragen genau einen Schritt (Grund, nichts geändert)', () => {
    const d = basis();
    const m = knoten('inbox.mail-entwurf', 'Angebot senden'), z = knoten('ende.ziel', 'Gesendet');
    let f = gut(anlegen(fass(d), m, { nach: start(d).id }));
    f = gut(anlegen(f, z, { nach: m.id }));
    f = fass(schlossSetzen({ ...d, knoten: f.knoten }).definition);
    const s = f.knoten.find(k => k.schloss?.fuer === m.id)!;
    expect(zwischenGrund(f, kante(f, m.id, s.id))).toMatch(/Schloss/);
    const x = knoten('aufgabe.anlegen', 'Ablage');
    const r = gut(zwischenEinfuegen(f, kante(f, s.id, z.id), x));
    expect(weiterVon(r, s.id)).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(z.id);
    // nein am Schloss bzw. an einer Entscheidung: kein „+“.
    const e = knoten('entscheidung.mensch', 'Antwort?'), er = knoten('erinnerung.runde', 'Erinnern');
    const d2 = basis();
    let g = gut(anlegen(fass(d2), e, { nach: start(d2).id }));
    g = gut(anlegen(g, er, { nach: e.id, ausgang: 'nein' }));
    const nein = kantenVon(g).find(k => k.von === e.id && k.ausgang === 'nein')!;
    expect(zwischenGrund(g, nein)).toBe(ABZWEIG_EINER);
    const r2 = zwischenEinfuegen(g, nein, knoten('aufgabe.anlegen'));
    expect(r2.ok).toBe(false);
  });
});

describe('Punkt 4 · Verbinden über Phasen ohne Fehler, Kantenende umhängen', () => {
  function zweiPhasen() {
    const d = basis();
    const p1 = phasen(d)[0].id;
    let f = gut(phaseNeu(fass(d), { id: kennung(), titel: 'Nachfassen', nach: p1 }));
    const p2 = phasen(f)[1].id;
    const a = knoten('aufgabe.anlegen', 'Lead prüfen'), b = knoten('crm.kontakt-notiz', 'Notiz schreiben'), c = knoten('aufgabe.anlegen', 'Anrufen');
    f = gut(anlegen(f, a, { nach: start(d).id }));
    f = gut(anlegen(f, b, { phaseId: p2 }));
    f = gut(anlegen(f, c, { nach: b.id }));
    return { f, p1, p2, a: a.id, b: b.id, c: c.id };
  }
  it('ein Faden in eine andere Phase holt das Ziel in die Phase der Quelle — mit Ansage, ohne Fehler', () => {
    const { f, p1, a, b } = zweiPhasen();
    const r = verbindenFrei(f, a, 'weiter', b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ansage).toMatch(/liegt jetzt in der Phase „Ablauf“/);
    expect(schritteDer(r.fassung, p1).map(s => s.id)).toContain(b);
    expect(weiterVon(r.fassung, a)).toBe(b);
    expect(flussPruefen(r.fassung).filter(z => z.stufe === 'fehler')).toEqual([]);
  });
  it('ein Abzweig über Phasen: das Ziel kommt mit (es wird Seitenziel in der Phase der Quelle)', () => {
    const { f: f0, p1, b } = zweiPhasen();
    const e = knoten('entscheidung.mensch', 'Antwort?');
    const f = gut(anlegen(f0, e, { nach: start(f0).id }));
    const r = gut(verbindenFrei(f, e.id, 'nein', b));
    expect(r.knoten.find(k => k.id === e.id)?.zweige?.nein).toBe(b);
    expect(seitenZiele(r.knoten).get(b)).toBe(e.id);
    expect(schritteDer(r, p1).map(s => s.id)).toContain(b);
  });
  it('entstünde ein Fehler (ein Sprung aus der alten Phase zeigt aufs Ziel), bleibt alles, wie es war — mit Grund', () => {
    const { f: f0, a, b, c } = zweiPhasen();
    const x = knoten('aufgabe.anlegen', 'Vorab');
    let f = gut(anlegen(f0, x, { vor: b }));
    f = { ...f, knoten: f.knoten.map(k => (k.id === x.id ? { ...k, zweige: { ja: c } } : k)) };
    expect(flussPruefen(f).filter(z => z.stufe === 'fehler')).toEqual([]);
    const vorher = JSON.stringify(f);
    const r = verbindenFrei(f, a, 'weiter', c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.grund).toMatch(/in die Phase „Ablauf“ zu holen geht nicht: .*andere Phase/);
    expect(JSON.stringify(f)).toBe(vorher);
  });
  it('umhängen: ein Sprung zeigt aufs neue Ziel; der Strang holt das neue Ziel direkt dahinter; ein Abzweig zeigt woandershin', () => {
    const { f: f0, a, b, c } = kette();
    const x = knoten('aufgabe.anlegen', 'Extra');
    let f = gut(anlegen(f0, x, { nach: b }));
    // Strang a → b, umhängen auf x: x folgt direkt auf a, b danach.
    let r = gut(umhaengen(f, kante(f, a, b), x.id));
    expect(weiterVon(r, a)).toBe(x.id);
    expect(weiterVon(r, x.id)).toBe(b);
    // Sprung a ⇒ c, umhängen auf b: der Sprung zeigt auf b.
    f = { ...f, knoten: f.knoten.map(k => (k.id === a ? { ...k, zweige: { ja: c } } : k)) };
    r = gut(umhaengen(f, kante(f, a, c), b));
    expect(r.knoten.find(k => k.id === a)?.zweige?.ja).toBe(b);
    // Abzweig nein → zeigt auf das neue Ziel.
    const e = knoten('entscheidung.mensch', 'Antwort?'), er = knoten('erinnerung.runde', 'Erinnern'), t = knoten('aufgabe.anlegen', 'Anderes');
    const d3 = basis();
    let g = gut(anlegen(fass(d3), e, { nach: start(d3).id }));
    g = gut(anlegen(g, er, { nach: e.id, ausgang: 'nein' }));
    g = gut(anlegen(g, t, { nach: e.id, ausgang: 'fehler' }));
    const nein = kantenVon(g).find(k => k.von === e.id && k.ausgang === 'nein')!;
    expect(umhaengen(g, nein, er.id).ok).toBe(false); // hängt schon dort
    const w2 = knoten('aufgabe.anlegen', 'Zweiter Versuch');
    g = gut(anlegen(g, w2, { nach: e.id }));
    const g2 = gut(umhaengen(g, nein, w2.id));
    expect(g2.knoten.find(k => k.id === e.id)?.zweige?.nein).toBe(w2.id);
  });
  it('vom Abzweig zurück: umhängen setzt „weiter bei …“; der Faden ins Schloss lässt sich nicht umhängen', () => {
    const d = basis();
    const e = knoten('entscheidung.mensch', 'Antwort?'), w = knoten('aufgabe.anlegen', 'Weiter'), z = knoten('ende.ziel', 'Ziel'), er = knoten('aufgabe.anlegen', 'Nachhaken');
    let f = gut(anlegen(fass(d), e, { nach: start(d).id }));
    f = gut(anlegen(f, w, { nach: e.id }));
    f = gut(anlegen(f, z, { nach: w.id }));
    f = gut(anlegen(f, er, { nach: e.id, ausgang: 'nein' }));
    const zurueck = kantenVon(f).find(k => k.von === er.id)!;
    const r = gut(umhaengen(f, zurueck, z.id));
    expect(r.knoten.find(k => k.id === er.id)?.zweige?.ja).toBe(z.id);
    const m = knoten('inbox.mail-entwurf', 'Senden');
    let g = gut(anlegen(fass(d), m, { nach: start(d).id }));
    g = fass(schlossSetzen({ ...d, knoten: g.knoten }).definition);
    const s = g.knoten.find(k => k.schloss?.fuer === m.id)!;
    expect(umhaengen(g, kante(g, m.id, s.id), start(g).id).ok).toBe(false);
  });
});

describe('Mitte eines Fadens (das „+“ steht dort)', () => {
  it('halbe Länge auf dem Weg; liegt dort die Beschriftung, rückt das „+“ weiter', () => {
    expect(kantenMitte([[0, 0], [100, 0]])).toEqual([50, 0]);
    expect(kantenMitte([[0, 0], [100, 0], [100, 100]])).toEqual([100, 0]);
    expect(kantenMitte([])).toEqual([0, 0]);
    const k = { punkte: [[0, 0], [200, 0]] as [number, number][], text: 'nein', textOrt: [90, 0] as [number, number], zurueck: true };
    expect(kantenPlus(k)[0]).toBeGreaterThan(100);
    const l = werkstattLage(kette().f);
    for (const x of l.kanten) { const p = kantenPlus(x); expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true); }
  });
});

describe('Tastatur bau-fertig', () => {
  it('Enter öffnet das große Fenster, F2 benennt, + − 0 zoomen, M schaltet die Karte; in der Hilfe steht es', () => {
    expect(tasteZuAktion({ key: 'Enter' })).toEqual({ art: 'oeffnen' });
    expect(tasteZuAktion({ key: 'F2' })).toEqual({ art: 'benennen' });
    expect(tasteZuAktion({ key: '+' })).toEqual({ art: 'zoom', wie: 'groesser' });
    expect(tasteZuAktion({ key: '-' })).toEqual({ art: 'zoom', wie: 'kleiner' });
    expect(tasteZuAktion({ key: '0' })).toEqual({ art: 'zoom', wie: 'alles' });
    expect(tasteZuAktion({ key: 'm' })).toEqual({ art: 'karte' });
    expect(tasteZuAktion({ key: 'x' })).toBeNull();
    const k = WERKSTATT_KUERZEL.map(x => x.taste).join(' | ');
    for (const t of ['Doppelklick · F2', 'Enter · zweiter Doppelklick', '+ · − · 0', 'M']) expect(k).toContain(t);
  });
});

describe('Punkt 5 · Knoten-Auswahl als Seitenleiste: Gruppen, Zuletzt benutzt, Daten', () => {
  it('ohne Suche zuerst „Zuletzt benutzt“, dann Auslöser, Daten, Anbindungen; Daten nicht doppelt bei ihrer Anbindung', () => {
    const g = formauswahlGruppen(BAUSTEIN_KATALOG, { zuletzt: ['inbox.mail-entwurf', 'aufgabe.anlegen'] });
    expect(g[0]).toMatchObject({ id: 'zuletzt', titel: 'Zuletzt benutzt' });
    expect(g[0].eintraege.map(e => e.id)).toEqual(['inbox.mail-entwurf', 'aufgabe.anlegen']);
    expect(g[1].id).toBe('ausloeser');
    expect(g[2].id).toBe('daten');
    expect(g[2].eintraege.map(e => e.id)).toEqual(expect.arrayContaining([...DATEN_BAUSTEINE]));
    const crm = g.find(x => x.id === 'a:CRM')!;
    expect(crm.eintraege.some(e => e.id === 'crm.abfragen')).toBe(false);
    // Jeder Baustein steht (außer in „Zuletzt“) genau einmal — feste Schritte einer Überführung (Paket Ü) kommen nur mit „In die Werkstatt überführen“.
    const ohneZuletzt = g.filter(x => x.id !== 'zuletzt').flatMap(x => x.eintraege.map(e => e.id));
    expect(new Set(ohneZuletzt).size).toBe(ohneZuletzt.length);
    expect(ohneZuletzt.length).toBe(BAUSTEIN_KATALOG.filter(e => !e.nurUeberfuehrung).length);
  });
  it('mit Suche kein „Zuletzt“; beim Anhängen Auslöser ganz hinten, ohne Auslöser gar nicht; Kategorie filtert', () => {
    expect(formauswahlGruppen(BAUSTEIN_KATALOG, { suche: 'mail', zuletzt: ['aufgabe.anlegen'] }).some(x => x.id === 'zuletzt')).toBe(false);
    const an = formauswahlGruppen(BAUSTEIN_KATALOG, { anhaengen: true });
    expect(an.at(-1)?.id).toBe('ausloeser');
    expect(formauswahlGruppen(BAUSTEIN_KATALOG, { ohneAusloeser: true }).some(x => x.id === 'ausloeser')).toBe(false);
    const nurWarten = formauswahlGruppen(BAUSTEIN_KATALOG, { kategorie: 'warten' }).flatMap(x => x.eintraege);
    expect(nurWarten.length).toBeGreaterThan(0);
    expect(nurWarten.every(e => e.kategorie === 'warten')).toBe(true);
  });
  it('„Zuletzt benutzt“ merkt höchstens sechs, vorn der jüngste, nur Bausteine des Katalogs (robust gelesen)', () => {
    let l: string[] = [];
    for (const id of BAUSTEIN_KATALOG.slice(0, 9).map(e => e.id)) l = zuletztMerken(l, id);
    expect(l).toHaveLength(ZULETZT_MAX);
    expect(l[0]).toBe(BAUSTEIN_KATALOG[8].id);
    expect(zuletztMerken(l, l[3])[0]).toBe(l[3]);
    expect(zuletztAus('kaputt')).toEqual([]);
    expect(zuletztAus(JSON.stringify(['gibt-es-nicht', 'aufgabe.anlegen', 3]))).toEqual(['aufgabe.anlegen']);
  });
});

describe('Oberfläche bau-fertig (Quelltext-Wächter)', () => {
  const w = lies('components/os/prozesse/Werkstatt.tsx');
  const fl = lies('components/os/prozesse/WerkstattFlaeche.tsx');
  const css = lies('app/globals.css');
  it('Punkt 1: Hinweise schweben über der Fläche (Bauen) — außerhalb wie im Werkzeugmodus; gute Meldungen gehen von selbst', () => {
    expect(w).toContain("'pw-hinweise-schwebe'");
    expect(w).toContain('{hinweisBlock(true)}');
    expect(css).toContain('.pw-hinweise-schwebe { position: absolute;');
    expect(w).toContain("meldung?.art !== 'gut'");
  });
  it('Punkt 2: Doppelklick benennt direkt auf der Fläche, der zweite öffnet die Einstellungen', () => {
    expect(fl).toContain('onDoubleClick={doppel}');
    expect(fl).toContain('className="pw-namensfeld"');
    expect(w).toContain('umbenennen === id');
  });
  it('Punkt 3/4: „+“ mitten auf dem Faden, Kantenende greifen; Verbinden über Phasen', () => {
    expect(fl).toContain('data-ws-zwischen={k.id}');
    expect(fl).toContain('data-ws-ende={k.id}');
    expect(w).toContain('verbindenFrei(f, von, ausgang, nach)');
    expect(w).toContain('umhaengen(f, k, ziel)');
  });
  it('Punkt 5: die Knoten-Auswahl ist eine Seitenleiste in voller Höhe mit Gruppen', () => {
    const fa = lies('components/os/prozesse/WerkstattFormauswahl.tsx');
    expect(fa).toContain('className="pw-auswahl-leiste"');
    expect(fa).toContain('formauswahlGruppen(');
    expect(css).toContain('.pw-auswahl-leiste { position: absolute; z-index: 6; top: 0; right: 0; bottom: 0;');
  });
});

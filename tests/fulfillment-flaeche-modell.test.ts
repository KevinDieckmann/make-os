// ─── Fulfillment · Prozess-Editor › Fläche — Modell, Ableitung, Schreibweg (17.10.) ───────────────────────────────────────────────────────
// Die Fläche ist eine andere Ansicht DERSELBEN Vorlage: Lage (`pos`) und Pfeil-Beschriftung (`pfeilText`) sind optional; Pfeile sind die Reihenfolge und die
// Zweige, die die Vorlage schon trägt. Geprüft: Auto-Layout ohne Lage, Pfeile und ihre Wege, Reihenfolge aus Pfeilen, `verbinden` (vorwärts = umhängen,
// zurück = Kreis 409, Entscheidung = Zweig), Lage (Grenzen, Stand, keine neue Fassung), Rahmen in der Reihenfolge der Phasen, Rückgängig, Fluss ↔ Fläche
// ohne Verlust und die Update-Probe mit Altbestand. Erfundene Daten, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { vorlagenAnwenden, type VorlagenKontext } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { editorAnwenden, editorModell, type EditorKontext, type EditorOp } from '@/lib/fulfillment/prozesse/editor';
import { geschichteFuer } from '@/lib/fulfillment/prozesse/editor-geschichte';
import { flaecheBild, pfeilWeg, wegKreuzungen, reiheAusPfeilen, lageVorrang, lagenAlle, allesFest, rahmenBei, knotenBei, pfadVon, FL } from '@/lib/fulfillment/prozesse/flaeche';
import { phasenSchritte } from '@/lib/fulfillment/prozesse/fluss-struktur';
import { vorlagenDiff, fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { vergleicheBestand } from '@/lib/betrieb/update-probe';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import type { ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-17T09:00:00.000Z';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const kx: EditorKontext = { person: 'pia', jetzt: J, standVon: stand, neueId: p => `${p}-s${++N}` };
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const roh = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const V = (): ProzessVorlage => ({
  id: 'fp-test', art: 'paket', titel: 'Testpaket', fassung: 3, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], phasenVonHand: true,
  freigaben: [{ id: 'A1', titel: 'Rahmen bestätigt', wer: 'beide' }],
  knoten: [
    { id: 'fk-w', titel: 'Testpaket', rang: 1 },
    { id: 'fk-p1', elternId: 'fk-w', titel: 'Auftakt', rang: 1, kundeSichtbar: true, freigabe: 'A1' },
    { id: 'fk-p2', elternId: 'fk-w', titel: 'Umsetzung', rang: 2 },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off planen', rang: 1, form: 'termin' },
    { id: 'fk-e', elternId: 'fk-p1', titel: 'Unterlagen da?', rang: 2, form: 'entscheidung', zweige: { nein: 'fk-r' } },
    { id: 'fk-r', elternId: 'fk-p1', titel: 'Erinnern', rang: 3, form: 'erinnerung', zweige: { ja: 'fk-e' }, zustaendig: 'kunde' },
    { id: 'fk-b', elternId: 'fk-p1', titel: 'Begrüßung senden', rang: 4, form: 'nachricht', frist: 2 },
    { id: 'fk-c', elternId: 'fk-p1', titel: 'Zugang anlegen', rang: 5 },
    { id: 'fk-x', elternId: 'fk-p2', titel: 'Umsetzen', rang: 1 },
    { id: 'fk-g', elternId: 'fk-p2', titel: 'Skripte', rang: 2 },
    { id: 'fk-g1', elternId: 'fk-g', titel: 'Leitfaden', rang: 1 },
  ],
});
const datei = (v = V()): VorlagenDatei => ({ ...leerVorlagen(), prozesse: [v] });
const anwenden = (d: VorlagenDatei, ops: EditorOp[]) => {
  const v = d.prozesse[0];
  return editorAnwenden(d, { vorlageId: v.id, stand: stand(v), ops }, kx);
};
const ok = (r: ReturnType<typeof anwenden>): VorlagenDatei => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };
const reihe = (v: ProzessVorlage, phase: string) => phasenSchritte(v.knoten, phase).map(x => x.id);

describe('Auto-Layout: jede Vorlage öffnet sich ohne Lage sofort sauber', () => {
  const b = flaecheBild(V());
  it('Rahmen von links nach rechts in der Reihenfolge der Phasen, nie kleiner als ihr Inhalt', () => {
    expect(b.rahmen.map(r => r.id)).toEqual(['fk-p1', 'fk-p2']);
    const [r1, r2] = b.rahmen;
    expect(r1).toMatchObject({ x: 0, y: 0, auto: true, nr: 1, titel: 'Auftakt' });
    expect(r2.x).toBe(r1.x + r1.b + FL.rahmenAbstand);
    for (const k of b.knoten) {
      const r = b.rahmen.find(x => x.id === k.phaseId)!;
      expect(k.x >= r.x && k.y >= r.y && k.x + k.b <= r.x + r.b && k.y + k.h <= r.y + r.h, k.id).toBe(true);
      expect(k.auto).toBe(true);
    }
  });
  it('Start oben, Schritte untereinander, der Nein-Zweig rechts neben seiner Entscheidung, der Abstimmungspunkt am Ende', () => {
    const k = (id: string) => b.knoten.find(x => x.id === id)!;
    const s1 = b.starts.find(s => s.phaseId === 'fk-p1')!;
    expect(s1.titel).toBe('Start');
    expect(b.starts.find(s => s.phaseId === 'fk-p2')!.titel).toBe('Nach Abstimmung 1');
    expect(k('fk-a').y).toBeGreaterThan(s1.y + s1.h);
    expect(k('fk-e').y).toBeGreaterThan(k('fk-a').y);
    expect(k('fk-b').y).toBeGreaterThan(k('fk-e').y);
    expect(k('fk-r').x).toBeGreaterThan(k('fk-e').x + k('fk-e').b);
    expect(k('fk-r').y + k('fk-r').h / 2).toBe(k('fk-e').y + k('fk-e').h / 2);
    expect(k('fk-e').umriss).toBe('raute');
    expect(k('fk-a').umriss).toBe('termin');
    const ab = b.abstimmungen.find(a => a.phaseId === 'fk-p1')!;
    expect(ab.titel).toBe('Abstimmungspunkt 1 · Rahmen bestätigt');
    expect(ab.y).toBeGreaterThan(k('fk-c').y);
    expect(b.gruppen).toEqual([expect.objectContaining({ id: 'fk-g', titel: 'Skripte', phaseId: 'fk-p2' })]);
    expect(k('fk-b').unter).toBe('Frist 2 Tage');
    expect(k('fk-r').unter).toBe('macht der Kunde');
  });
  it('Pfeile = Reihenfolge + Zweige (keine zweite Liste): ja/nein, zurück, über die Abstimmung in die nächste Phase', () => {
    const p = (von: string, nach: string) => b.pfeile.find(x => x.von === von && x.nach === nach);
    expect(p('start:fk-p1', 'fk-a')).toMatchObject({ art: 'weiter' });
    expect(p('fk-a', 'fk-e')).toMatchObject({ art: 'weiter' });
    expect(p('fk-e', 'fk-b')).toMatchObject({ art: 'ja', text: 'ja' });
    expect(p('fk-e', 'fk-r')).toMatchObject({ art: 'nein', text: 'nein', zweig: { knotenId: 'fk-e', art: 'nein' } });
    expect(p('fk-r', 'fk-e')).toMatchObject({ art: 'zurueck', text: 'zurück', zweig: { knotenId: 'fk-r', art: 'ja' } });
    expect(p('fk-c', 'ab:fk-p1')).toMatchObject({ art: 'weiter' });
    expect(p('ab:fk-p1', 'start:fk-p2')).toMatchObject({ art: 'ja', zwischen: true });
    expect(p('start:fk-p2', 'fk-x')).toBeTruthy();
    expect(p('fk-x', 'fk-g1')).toBeTruthy();
    // Der Pfeil der Reihenfolge lässt sich nicht lösen (nur umhängen) — Zweige schon.
    expect(p('fk-a', 'fk-e')!.zweig).toBeUndefined();
  });
  it('Wege: gewinkelt (nur waagerecht/senkrecht), Anfang am Rand der Quelle, Ende am Rand des Ziels; Nein geht nach rechts', () => {
    for (const pf of b.pfeile) {
      for (let i = 1; i < pf.punkte.length; i++) {
        const [a, c] = [pf.punkte[i - 1], pf.punkte[i]];
        expect(a[0] === c[0] || a[1] === c[1], pf.id).toBe(true);
      }
    }
    const nein = b.pfeile.find(x => x.art === 'nein')!;
    const e = b.knoten.find(x => x.id === 'fk-e')!;
    expect(nein.punkte[0][0]).toBe(e.x + e.b);
    expect(pfadVon(nein.punkte)).toMatch(/^M/);
  });
  it('Wege weichen Knoten aus, so gut es einfach geht', () => {
    const a = { x: 0, y: 0, b: 100, h: 60 }, z = { x: 0, y: 400, b: 100, h: 60 }, im_weg = { x: 0, y: 180, b: 100, h: 60 };
    const w = pfeilWeg(a, z, [a, z, im_weg]);
    expect(wegKreuzungen(w, [im_weg], a, z)).toBe(0);
    expect(wegKreuzungen([[50, 60], [50, 400]], [im_weg], a, z)).toBe(1);
  });
  it('Treffer: Knoten (Raute als Raute) und Rahmen unter einem Punkt', () => {
    const e = b.knoten.find(x => x.id === 'fk-e')!;
    expect(knotenBei(b, e.x + e.b / 2, e.y + e.h / 2)?.id).toBe('fk-e');
    expect(knotenBei(b, e.x + 2, e.y + 2)).toBeNull(); // Ecke des Kastens, außerhalb der Raute
    expect(rahmenBei(b, b.rahmen[1].x + 5, b.rahmen[1].y + 5)?.id).toBe('fk-p2');
    expect(rahmenBei(b, b.rahmen[0].x + b.rahmen[0].b + 50, 5)).toBeNull();
  });
});

describe('Reihenfolge aus Pfeilen (topologisch, Zweige wie bisher)', () => {
  it('die Pfeile der Fläche ergeben genau die Reihenfolge der Vorlage — die Schleife zurück zählt nicht', () => {
    const v = V();
    const b = flaecheBild(v);
    for (const p of ['fk-p1', 'fk-p2']) {
      const ids = b.knoten.filter(k => k.phaseId === p).map(k => k.id).reverse(); // Eingabe absichtlich verdreht
      expect(reiheAusPfeilen(ids, b.pfeile, lageVorrang(b))).toEqual(reihe(v, p));
    }
  });
  it('ein Kreis ohne Erinnerung bleibt nicht hängen (der Rest kommt ans Ende)', () => {
    expect(reiheAusPfeilen(['a', 'b', 'c'], [{ von: 'a', nach: 'b', art: 'weiter' }, { von: 'b', nach: 'a', art: 'weiter' }, { von: 'c', nach: 'a', art: 'weiter' }])).toEqual(['c', 'a', 'b']);
  });
  it('verbinden A → B (vorwärts): B hängt direkt hinter A — die Pfeile lesen sich danach so, die Reihenfolge folgt', () => {
    const d = ok(anwenden(datei(), [{ op: 'verbinden', von: 'fk-a', nach: 'fk-c' }]));
    const v = d.prozesse[0];
    expect(reihe(v, 'fk-p1')).toEqual(['fk-a', 'fk-c', 'fk-e', 'fk-r', 'fk-b']);
    const b = flaecheBild(v);
    expect(b.pfeile.some(p => p.von === 'fk-a' && p.nach === 'fk-c')).toBe(true);
    expect(b.pfeile.some(p => p.von === 'fk-c' && p.nach === 'fk-e')).toBe(true);
    expect(reiheAusPfeilen(b.knoten.filter(k => k.phaseId === 'fk-p1').map(k => k.id), b.pfeile, lageVorrang(b))).toEqual(reihe(v, 'fk-p1'));
  });
  it('verbinden über Phasen (vorwärts): der Schritt kommt in die Phase von A', () => {
    const v = ok(anwenden(datei(), [{ op: 'verbinden', von: 'fk-b', nach: 'fk-x' }])).prozesse[0];
    expect(reihe(v, 'fk-p1')).toEqual(['fk-a', 'fk-e', 'fk-r', 'fk-b', 'fk-x', 'fk-c']);
  });
  it('ein Pfeil zurück (ohne Erinnerung) ist ein Kreis → 409, nichts gespeichert', () => {
    const r = anwenden(datei(), [{ op: 'verbinden', von: 'fk-c', nach: 'fk-a' }]);
    expect(r).toMatchObject({ ok: false, status: 409 });
    if (!r.ok) expect(r.fehler).toMatch(/Kreis/);
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-x', nach: 'fk-a' }])).toMatchObject({ ok: false, status: 409 });
  });
  it('an einer Entscheidung setzt der Pfeil ihren Ja- bzw. Nein-Zweig; an einer Erinnerung „danach zu …“; Zweige bleiben in ihrer Phase', () => {
    let v = ok(anwenden(datei(), [{ op: 'verbinden', von: 'fk-e', nach: 'fk-c' }])).prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-e')!.zweige).toEqual({ nein: 'fk-r', ja: 'fk-c' });
    v = ok(anwenden(datei(), [{ op: 'verbinden', von: 'fk-r', nach: 'fk-c' }])).prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-r')!.zweige).toEqual({ ja: 'fk-c' });
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-e', nach: 'fk-x' }])).toMatchObject({ ok: false, status: 409 });
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-a', nach: 'fk-c', zweig: 'nein' }])).toMatchObject({ ok: false, status: 400 });
    // Ein Ja zurück auf einen gewöhnlichen Schritt wäre ein Kreis.
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-e', nach: 'fk-a' }])).toMatchObject({ ok: false, status: 409 });
    // Nein-Zweige hängt man nicht als gewöhnlichen Schritt um.
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-a', nach: 'fk-r' }])).toMatchObject({ ok: false, status: 409 });
    expect(anwenden(datei(), [{ op: 'verbinden', von: 'fk-a', nach: 'fk-a' }])).toMatchObject({ ok: false, status: 400 });
  });
});

describe('Lage und Beschriftung im Schreibweg', () => {
  it('Lage setzen: Rahmen absolut mit Größe, Schritt relativ — keine neue Fassung (laufende Fälle sehen nichts), Stand ändert sich', () => {
    const d0 = datei();
    const d = ok(anwenden(d0, [{ op: 'lage', eintraege: [{ id: 'fk-p1', pos: { x: 100, y: 40, b: 900, h: 1200 } }, { id: 'fk-a', pos: { x: 60.4, y: 300 } }] }]));
    const v = d.prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-p1')!.pos).toEqual({ x: 100, y: 40, b: 900, h: 1200 });
    expect(v.knoten.find(x => x.id === 'fk-a')!.pos).toEqual({ x: 60, y: 300 });
    expect(v.fassung).toBe(3);
    expect(stand(v)).not.toBe(stand(d0.prozesse[0]));
    const b = flaecheBild(v);
    expect(b.rahmen[0]).toMatchObject({ x: 100, y: 40, b: 900, h: 1200, auto: false });
    expect(b.knoten.find(x => x.id === 'fk-a')).toMatchObject({ x: 160, y: 340, auto: false });
    // Schritte ohne Lage stehen UNTER den festen (nichts überlappt den gesetzten).
    expect(b.knoten.find(x => x.id === 'fk-e')!.y).toBeGreaterThan(340 + 60);
    // Der Fall: reine Lage ist keine neue Fassung → kein „Vorlage geändert“.
    const fall = fallStarten({ mandatId: 'm-1', vorlage: d0.prozesse[0], person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-f${++N}` });
    expect(vorlagenDiff(fall, v)).toBeNull();
    // Inhalt ändern ist eine neue Fassung.
    expect(ok(anwenden(d, [{ op: 'schritt', id: 'fk-a', titel: 'Kick-off' }])).prozesse[0].fassung).toBe(4);
  });
  it('Grenzen: Unsinn 400, unbekannt 404, zu viele 413, veralteter Stand 409 — nichts gespeichert', () => {
    const d = datei();
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-a', pos: { x: 1, y: 2, b: 300 } }] }])).toMatchObject({ ok: false, status: 400 }); // Größe nur am Rahmen
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-a', pos: { x: 999_999, y: 0 } }] }])).toMatchObject({ ok: false, status: 400 });
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-p1', pos: { x: 0, y: 0, b: 20 } }] }])).toMatchObject({ ok: false, status: 400 });
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-w', pos: { x: 0, y: 0 } }] }])).toMatchObject({ ok: false, status: 400 }); // der Start (Wurzel) steht nicht auf der Fläche
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-g', pos: { x: 0, y: 0 } }] }])).toMatchObject({ ok: false, status: 400 }); // eine Gruppe folgt ihren Schritten
    expect(anwenden(d, [{ op: 'lage', eintraege: [{ id: 'fk-nix', pos: { x: 0, y: 0 } }] }])).toMatchObject({ ok: false, status: 404 });
    expect(anwenden(d, [{ op: 'lage', eintraege: Array.from({ length: 401 }, () => ({ id: 'fk-a', pos: { x: 0, y: 0 } })) }])).toMatchObject({ ok: false, status: 413 });
    expect(anwenden(d, [{ op: 'pfeil-text', id: 'fk-a', art: 'weiter', text: 'x'.repeat(61) }])).toMatchObject({ ok: false, status: 413 });
    expect(editorAnwenden(d, { vorlageId: 'fp-test', stand: 'alt', ops: [{ op: 'lage', eintraege: [{ id: 'fk-a', pos: { x: 0, y: 0 } }] }] }, kx)).toMatchObject({ ok: false, status: 409 });
    expect(anwenden(d, Array.from({ length: 61 }, () => ({ op: 'pfeil-text', id: 'fk-a', art: 'weiter', text: 'a' })))).toMatchObject({ ok: false, status: 413 });
  });
  it('Beschriftung eines Pfeils: setzen, zeigen, entfernen (null)', () => {
    let d = ok(anwenden(datei(), [{ op: 'pfeil-text', id: 'fk-e', art: 'nein', text: 'fehlt noch' }, { op: 'pfeil-text', id: 'fk-a', art: 'weiter', text: 'danach' }]));
    const b = flaecheBild(d.prozesse[0]);
    expect(b.pfeile.find(p => p.von === 'fk-e' && p.art === 'nein')!.text).toBe('fehlt noch');
    expect(b.pfeile.find(p => p.von === 'fk-a')!.text).toBe('danach');
    d = ok(anwenden(d, [{ op: 'pfeil-text', id: 'fk-e', art: 'nein', text: null }, { op: 'pfeil-text', id: 'fk-a', art: 'weiter', text: null }]));
    expect(d.prozesse[0].knoten.find(x => x.id === 'fk-e')!.pfeilText).toBeUndefined();
  });
  it('Rahmen bleiben in der Reihenfolge der Phasen: vorbeigezogen → sie rücken in die Reihe (y bleibt)', () => {
    const d = ok(anwenden(datei(), [{ op: 'lage', eintraege: [{ id: 'fk-p1', pos: { x: 2000, y: 80 } }, { id: 'fk-p2', pos: { x: 0, y: 300 } }] }]));
    const v = d.prozesse[0];
    const p1 = v.knoten.find(x => x.id === 'fk-p1')!.pos!, p2 = v.knoten.find(x => x.id === 'fk-p2')!.pos!;
    const b1 = flaecheBild(v).rahmen[0].b;
    expect(p1).toEqual({ x: 0, y: 80 });
    expect(p2).toEqual({ x: b1 + FL.rahmenAbstand, y: 300 });
    // Phase in der Reise verschieben → die Rahmen tauschen ihren Platz.
    const w = ok(anwenden(d, [{ op: 'phase-schieben', id: 'fk-p2', nach: null }])).prozesse[0];
    expect(w.knoten.find(x => x.id === 'fk-p2')!.pos!.x).toBe(0);
    expect(w.knoten.find(x => x.id === 'fk-p1')!.pos!.x).toBeGreaterThan(0);
  });
  it('wechselt ein Schritt die Phase ohne neue Lage, steht er automatisch in seinem neuen Rahmen; mit Lage in derselben Änderung behält er sie', () => {
    const d = ok(anwenden(datei(), [{ op: 'lage', eintraege: [{ id: 'fk-c', pos: { x: 40, y: 900 } }] }]));
    let v = ok(anwenden(d, [{ op: 'schritt-schieben', id: 'fk-c', ziel: { phaseId: 'fk-p2' } }])).prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-c')!.pos).toBeUndefined();
    v = ok(anwenden(d, [{ op: 'schritt-schieben', id: 'fk-c', ziel: { phaseId: 'fk-p2' } }, { op: 'lage', eintraege: [{ id: 'fk-c', pos: { x: 60, y: 200 } }] }])).prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-c')!.pos).toEqual({ x: 60, y: 200 });
  });
  it('alles festhalten (beim ersten Verschieben): danach steht jeder Rahmen und jeder Schritt genau dort, wo er vorher automatisch stand', () => {
    const v0 = V();
    const b0 = flaecheBild(v0);
    expect(allesFest(b0)).toBe(false);
    const v = ok(anwenden(datei(v0), [{ op: 'lage', eintraege: lagenAlle(b0, v0) }])).prozesse[0];
    const b = flaecheBild(v);
    expect(allesFest(b)).toBe(true);
    expect(b.knoten.map(k => [k.id, k.x, k.y])).toEqual(b0.knoten.map(k => [k.id, k.x, k.y]));
    expect(b.rahmen.map(r => [r.id, r.x, r.y, r.b, r.h])).toEqual(b0.rahmen.map(r => [r.id, r.x, r.y, r.b, r.h]));
  });
});

describe('Rückgängig und Wiederholen auf der Fläche', () => {
  const zurueck = (d: VorlagenDatei, ops: EditorOp[]) => {
    const vorher = d.prozesse[0];
    const g = geschichteFuer(vorher, ops)!;
    expect(g).not.toBeNull();
    const nach = ok(anwenden(d, ops));
    const wieder = ok(anwenden(nach, g.rueck)).prozesse[0];
    expect(wieder.knoten.map(x => ({ ...x }))).toEqual(vorher.knoten);
    expect(wieder.freigaben).toEqual(vorher.freigaben);
    return { nach, g };
  };
  it('Lage, Beschriftung, verbinden (umhängen und Zweig), über Phasen samt Lage — zurück ist alles wie vorher', () => {
    zurueck(datei(), [{ op: 'lage', eintraege: lagenAlle(flaecheBild(V()), V()) }]);
    zurueck(datei(), [{ op: 'pfeil-text', id: 'fk-e', art: 'ja', text: 'passt' }]);
    zurueck(datei(), [{ op: 'verbinden', von: 'fk-a', nach: 'fk-c' }]);
    zurueck(datei(), [{ op: 'verbinden', von: 'fk-e', nach: 'fk-c' }]);
    const fest = ok(anwenden(datei(), [{ op: 'lage', eintraege: lagenAlle(flaecheBild(V()), V()) }]));
    zurueck(fest, [{ op: 'verbinden', von: 'fk-x', nach: 'fk-g1' }]);
    zurueck(fest, [{ op: 'schritt-schieben', id: 'fk-c', ziel: { phaseId: 'fk-p2' } }]);
    zurueck(fest, [{ op: 'phase-schieben', id: 'fk-p2', nach: null }]);
  });
});

describe('Fluss ↔ Fläche ohne Verlust', () => {
  it('Lage und Beschriftung ändern nichts am Fluss; Änderungen im Fluss lassen die Lage stehen', () => {
    const v0 = V();
    const fluss0 = editorModell(v0);
    const d = ok(anwenden(datei(v0), [{ op: 'lage', eintraege: lagenAlle(flaecheBild(v0), v0) }, { op: 'pfeil-text', id: 'fk-e', art: 'ja', text: 'passt' }]));
    const ohneFassung = (m: ReturnType<typeof editorModell>) => ({ ...m, fassung: 0 });
    expect(ohneFassung(editorModell(d.prozesse[0]))).toEqual(ohneFassung(fluss0));
    const lage = d.prozesse[0].knoten.find(x => x.id === 'fk-a')!.pos;
    const w = ok(anwenden(d, [{ op: 'schritt', id: 'fk-a', titel: 'Kick-off', frist: 3 }, { op: 'abstimmung', phaseId: 'fk-p2', an: true }])).prozesse[0];
    expect(w.knoten.find(x => x.id === 'fk-a')!.pos).toEqual(lage);
    expect(w.knoten.find(x => x.id === 'fk-e')!.pfeilText).toEqual({ ja: 'passt' });
  });
  it('gelesen = geschrieben: der Säuberer kennt Lage und Beschriftung (nichts fällt weg)', () => {
    const d = ok(anwenden(datei(), [{ op: 'lage', eintraege: lagenAlle(flaecheBild(V()), V()) }, { op: 'lage', eintraege: [{ id: 'fk-p1', pos: { x: 0, y: 0, b: 1000, h: 1400 } }] }, { op: 'pfeil-text', id: 'fk-e', art: 'nein', text: 'fehlt' }]));
    expect(vergleicheBestand('fulfillment--h', roh(d), roh(vorlagenAus(roh(d)))).abweichungen).toEqual([]);
    // Unsinn in der Datei fällt beim Lesen weg (nie ein Absturz, nie eine erfundene Angabe).
    const kaputt = roh(d);
    (kaputt.prozesse[0].knoten[3] as unknown as Record<string, unknown>).pos = { x: 'a', y: 2 };
    (kaputt.prozesse[0].knoten[1] as unknown as Record<string, unknown>).pos = { x: 1, y: 2, b: 5 };
    const g = vorlagenAus(kaputt);
    expect(g.prozesse[0].knoten[3].pos).toBeUndefined();
    expect(g.prozesse[0].knoten[1].pos).toEqual({ x: 1, y: 2 });
  });
});

describe('Update-Probe mit Altbestand', () => {
  it('Vorlagen der Online-Fassung (ohne Lage): lesen, auf der Fläche bearbeiten, lesen → kein Verlust', () => {
    const vk: VorlagenKontext = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: stand, neueId: p => `${p}-v${++N}` };
    const r = vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], vk);
    if (!r.ok) throw new Error(r.fehler);
    const alt = roh(r.datei);
    expect(JSON.stringify(alt)).not.toMatch(/"pos"|"pfeilText"/);
    const gelesen = vorlagenAus(alt);
    expect(vergleicheBestand('fulfillment--h', alt, roh(gelesen)).abweichungen).toEqual([]);
    const p1 = gelesen.prozesse.find(p => p.titel === MUSTER_P1.titel)!;
    // Auf der Fläche: alles festhalten und einen Rahmen verschieben.
    const b = flaecheBild(p1);
    expect(b.rahmen.length).toBeGreaterThan(1);
    const ops: EditorOp[] = [{ op: 'lage', eintraege: lagenAlle(b, p1) }];
    const nach = editorAnwenden(gelesen, { vorlageId: p1.id, stand: stand(p1), ops }, kx);
    if (!nach.ok) throw new Error(nach.fehler);
    const a = vergleicheBestand('fulfillment--h', alt, roh(vorlagenAus(roh(nach.datei)))).abweichungen;
    // Erlaubt: nur Zeitstempel/Person der Änderung und die Reihenfolge-Marke — kein Feld, keine Kennung fällt weg.
    expect(a.every(x => /(geaendert|geaendertVon|phasenVonHand)$/.test(x.pfad)), JSON.stringify(a.slice(0, 5))).toBe(true);
    const v = vorlagenAus(roh(nach.datei)).prozesse.find(p => p.id === p1.id)!;
    expect(v.fassung).toBe(p1.fassung);
    for (const k of p1.knoten) expect(v.knoten.some(x => x.id === k.id), k.titel).toBe(true);
  });
});

// ─── Fulfillment · Prozess-Editor — Modell und Schreibregeln (17.10.) ───────────────────────────────────────────────────────────────────────
// Säuberung der neuen Felder (form, frist, zweige, Papierkorb), das Editor-Modell (dieselben Schritte wie die Ansicht), die Editor-Ops (Plätze, Sammel-
// Teilprozess nur bei Bedarf, Papierkorb mit Zurückholen), Zweige (ja/nein, Kreise nur über Erinnerung → Entscheidung), Stand (409) und Grenzen (413),
// Rückgängig/Wiederholen, Wirkung auf Fälle (Diff mit Reihenfolge, Übernahme ohne Verlust, Entscheidung „ja“ → Nein-Zweig entfällt, Frist).
// Erfundene Daten, kein Netz, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen, vorlagenAus, faelleAus } from '@/lib/fulfillment/lesen';
import { editorAnwenden, editorModell, neuerAblauf, positionVon, type EditorKontext, type EditorOp } from '@/lib/fulfillment/prozesse/editor';
import { geschichteFuer } from '@/lib/fulfillment/prozesse/editor-geschichte';
import { phasenSchritte, zweigePruefen } from '@/lib/fulfillment/prozesse/fluss-struktur';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { fallStarten, fallAnwenden, vorlagenDiff, vorlageUebernehmen, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { phasenFluss, flussKnoten } from '@/lib/fulfillment/prozesse/reise-bild';
import { GRENZEN } from '@/lib/fulfillment/grenzen';
import type { ProzessVorlage, VorlagenDatei, Fall, Baustein } from '@/lib/fulfillment/typen';

const J = '2026-10-17T09:00:00.000Z';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const k: EditorKontext = { person: 'pia', jetzt: J, standVon: stand, neueId: p => `${p}-s${++N}` };
/** Eine Kennung, wie sie der Browser schickt (`fk-<uuid>`). */
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const MAIL: Baustein = { id: 'fb-mail', art: 'mail', titel: 'Begrüßungsmail', gliederung: [], platzhalter: [], tags: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: J, geaendertVon: 'pia' };
const V = (): ProzessVorlage => ({
  id: 'fp-test', art: 'paket', titel: 'Testpaket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [],
  freigaben: [{ id: 'F0', titel: 'Rahmen', wer: 'beide' }],
  knoten: [
    { id: 'fk-w', titel: 'Testpaket', rang: 1 },
    { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1, kundeSichtbar: true, freigabe: 'F0' },
    { id: 'fk-p2', elternId: 'fk-w', titel: 'Umsetzung', rang: 2, kundeSichtbar: true },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1 },
    { id: 'fk-b', elternId: 'fk-p1', titel: 'Fragebogen', rang: 2 },
    { id: 'fk-g', elternId: 'fk-p2', titel: 'Skripte', rang: 1 },
    { id: 'fk-g1', elternId: 'fk-g', titel: 'Leitfaden', rang: 1 },
    { id: 'fk-g2', elternId: 'fk-g', titel: 'Einwände', rang: 2 },
    { id: 'fk-c', elternId: 'fk-p2', titel: 'Training', rang: 2 },
  ],
});
const datei = (v = V()): VorlagenDatei => ({ ...leerVorlagen(), prozesse: [v], bausteine: [MAIL] });
const vorlage = (d: VorlagenDatei) => d.prozesse.find(p => p.id === 'fp-test')!;

function ok(r: { ok: true; datei: VorlagenDatei } | { ok: false; status: number; fehler: string }): VorlagenDatei {
  if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
  return r.datei;
}
const anwenden = (d: VorlagenDatei, ops: EditorOp[], st?: string) => editorAnwenden(d, { vorlageId: 'fp-test', stand: st ?? stand(vorlage(d)), ops }, k);
const tun = (d: VorlagenDatei, ...ops: EditorOp[]) => ok(anwenden(d, ops));
/** Das Bild des Editors als Text: „Phase[Strang | Gruppe(…)]“. */
const bild = (d: VorlagenDatei) => editorModell(vorlage(d), [MAIL]).phasen
  .map(p => `${p.titel}${p.abstimmung ? '◆' : ''}[${p.abschnitte.map(a => (a.art === 'gruppe' ? `${a.titel}(${a.knoten.map(x => x.titel).join(',')})` : a.knoten.map(x => x.titel).join(','))).join(' | ')}]`).join(' ');

// ── Säuberung ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Säuberung: neue Felder nur gültig, nichts erfunden', () => {
  it('form, frist, zweige und Papierkorb bleiben beim Lesen — Ungültiges fällt weg', () => {
    const roh = JSON.parse(JSON.stringify(datei()));
    const kn = roh.prozesse[0].knoten;
    kn[3] = { ...kn[3], form: 'entscheidung', frist: 3, zweige: { ja: 'fk-b', nein: 'kaputt kennung!' } };
    kn[4] = { ...kn[4], form: 'quatsch', frist: -2 };
    kn[7] = { ...kn[7], frist: 2.5 };
    roh.prozesse[0].papierkorb = [{ id: 'fk-x', am: J, von: 'pia', art: 'schritt', phaseId: 'fk-p1', knoten: [{ id: 'fk-x', titel: 'X', rang: 1 }], verweise: [{ knotenId: 'fk-a', zweig: 'ja', ziel: 'fk-x' }, { knotenId: 'fk-a', zweig: 'vielleicht' }] }, { id: 'fk-leer', am: J, knoten: [] }];
    const v = vorlagenAus(roh).prozesse[0];
    expect(v.knoten.find(x => x.id === 'fk-a')).toMatchObject({ form: 'entscheidung', frist: 3, zweige: { ja: 'fk-b' } });
    expect(v.knoten.find(x => x.id === 'fk-a')!.zweige).not.toHaveProperty('nein');
    expect(v.knoten.find(x => x.id === 'fk-b')).not.toHaveProperty('form');
    expect(v.knoten.find(x => x.id === 'fk-b')).not.toHaveProperty('frist');
    expect(v.knoten.find(x => x.id === 'fk-g2')).not.toHaveProperty('frist');
    expect(v.papierkorb).toHaveLength(1);
    expect(v.papierkorb![0].verweise).toEqual([{ knotenId: 'fk-a', zweig: 'ja', ziel: 'fk-x' }]);
    // Ohne die neuen Felder: genau wie bisher (kein Feld taucht auf).
    const alt = vorlagenAus(JSON.parse(JSON.stringify(datei()))).prozesse[0];
    expect(JSON.stringify(alt)).not.toMatch(/"form"|"frist"|"zweige"|"papierkorb"/);
  });
  it('Fall-Knoten tragen form, frist und zweige (gesäubert)', () => {
    const f = faelleAus({ faelle: { 'm-1': { mandatId: 'm-1', vorlageId: 'fp-test', gestartetAm: J, status: 'laeuft', knoten: [{ id: 'fk-a', titel: 'A', rang: 1, status: 'offen', form: 'erinnerung', frist: 7, zweige: { ja: 'fk-b' } }, { id: 'fk-b', titel: 'B', rang: 2, status: 'offen', form: 'x' }] } } });
    expect(f.faelle['m-1'].knoten[0]).toMatchObject({ form: 'erinnerung', frist: 7, zweige: { ja: 'fk-b' } });
    expect(f.faelle['m-1'].knoten[1]).not.toHaveProperty('form');
  });
});

// ── Modell ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Editor-Modell: dieselben Schritte wie die Ansicht', () => {
  it('Phasen mit Abstimmungspunkt, Stränge und Gruppen, abgeleitete Formen', () => {
    const m = editorModell(V(), [MAIL]);
    expect(m.phasen.map(p => p.titel)).toEqual(['Start', 'Umsetzung']);
    expect(m.phasen[0].abstimmung).toMatchObject({ id: 'F0', nr: 1, titel: 'Rahmen', wer: 'beide' });
    expect(bild(datei())).toBe('Start◆[Kick-off,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
    expect(m.phasen[0].abschnitte[0].knoten.every(x => x.form === 'schritt' && !x.gesetzt)).toBe(true);
    expect(phasenSchritte(V().knoten, 'fk-p2').map(x => x.id)).toEqual(['fk-g1', 'fk-g2', 'fk-c']);
  });
  it('„Neuer Ablauf“: leere Paket-Vorlage mit Start und EINER Phase, Reihenfolge von Hand', () => {
    const d = ok(neuerAblauf(leerVorlagen(), { titel: 'Mein Ablauf' }, k));
    const v = d.prozesse[0];
    expect(v).toMatchObject({ art: 'paket', titel: 'Mein Ablauf', phasenVonHand: true, fassung: 1 });
    expect(v.knoten).toHaveLength(2);
    expect(editorModell(v).phasen).toMatchObject([{ titel: 'Phase 1', schritte: 0, abschnitte: [] }]);
    expect(neuerAblauf(leerVorlagen(), { titel: '' }, k).ok).toBe(false);
    const voll = { ...leerVorlagen(), prozesse: Array.from({ length: GRENZEN.vorlagen }, (_, i) => ({ ...V(), id: `fp-v${i}` })) };
    const r = neuerAblauf(voll, { titel: 'Zu viel' }, k);
    expect(!r.ok && r.status).toBe(413);
  });
});

// ── Ops ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Editor-Ops: Phasen und Abstimmungspunkte', () => {
  it('Phase anlegen (vorn, dazwischen, hinten), umbenennen, umsortieren — Fassung zählt, Reihenfolge gehört der Hand', () => {
    let d = tun(datei(), { op: 'phase-neu', id: u(1), titel: 'Vorlauf', nach: null }, { op: 'phase-neu', id: u(2), titel: 'Mitte', nach: 'fk-p1' }, { op: 'phase-neu', id: u(3), titel: 'Ende' });
    expect(editorModell(vorlage(d)).phasen.map(p => p.titel)).toEqual(['Vorlauf', 'Start', 'Mitte', 'Umsetzung', 'Ende']);
    expect(vorlage(d)).toMatchObject({ fassung: 2, phasenVonHand: true });
    d = tun(d, { op: 'phase', id: u(2), titel: 'Mittelteil' }, { op: 'phase-schieben', id: 'fk-p2', nach: null });
    expect(editorModell(vorlage(d)).phasen.map(p => p.titel)).toEqual(['Umsetzung', 'Vorlauf', 'Start', 'Mittelteil', 'Ende']);
    expect(anwenden(d, [{ op: 'phase-schieben', id: 'fk-p2' }]).ok).toBe(false);
    // Gelesen (Säuberer) bleibt die Reihenfolge der Hand.
    expect(editorModell(vorlagenAus(JSON.parse(JSON.stringify(d))).prozesse[0]).phasen.map(p => p.titel)).toEqual(['Umsetzung', 'Vorlauf', 'Start', 'Mittelteil', 'Ende']);
  });
  it('Abstimmungspunkt an/aus: neuer Punkt A1, aus und wieder an gibt denselben zurück; Muster-Punkte werden nie neu vergeben', () => {
    let d = tun(datei(), { op: 'abstimmung', phaseId: 'fk-p2', an: true });
    const v = vorlage(d);
    expect(v.knoten.find(x => x.id === 'fk-p2')!.freigabe).toBe('A1');
    expect(v.freigaben.find(f => f.id === 'A1')).toEqual({ id: 'A1', titel: 'Umsetzung abgestimmt', wer: 'beide' });
    d = tun(d, { op: 'abstimmung', phaseId: 'fk-p2', an: false }, { op: 'abstimmung', phaseId: 'fk-p1', an: false });
    expect(vorlage(d).knoten.some(x => x.freigabe)).toBe(false);
    d = tun(d, { op: 'abstimmung', phaseId: 'fk-p2', an: true, titel: 'Abnahme', wer: 'kunde' });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-p2')!.freigabe).toBe('A1');
    expect(vorlage(d).freigaben.find(f => f.id === 'A1')).toMatchObject({ titel: 'Abnahme', wer: 'kunde' });
    d = tun(d, { op: 'abstimmung', phaseId: 'fk-p1', an: true });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-p1')!.freigabe).toBe('A2');
  });
});

describe('Editor-Ops: Schritte an jeden Platz, Sammel-Teilprozess nur bei Bedarf', () => {
  it('nach / vor / Anfang / in Gruppe / nach Gruppe / Ende — mit Form, Frist, Verantwortung, Sichtbarkeit', () => {
    const d = tun(datei(),
      { op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p1', nach: 'fk-a' }, form: 'nachricht', titel: 'Mail senden', frist: 2, zustaendig: 'intern', kundeSichtbar: true },
      { op: 'schritt-neu', id: u(2), ziel: { phaseId: 'fk-p1', vor: 'fk-a' }, form: 'termin', titel: 'Termin' },
      { op: 'schritt-neu', id: u(3), ziel: { phaseId: 'fk-p2', anfang: true }, titel: 'Vorbereiten' },
      { op: 'schritt-neu', id: u(4), ziel: { phaseId: 'fk-p2', inGruppe: 'fk-g' }, form: 'erinnerung', titel: 'Nachhaken' },
      { op: 'schritt-neu', id: u(5), ziel: { phaseId: 'fk-p2', nachGruppe: 'fk-g' }, titel: 'Zwischen' },
      { op: 'schritt-neu', id: u(6), ziel: { phaseId: 'fk-p2' }, titel: 'Schluss' });
    expect(bild(d)).toBe('Start◆[Termin,Kick-off,Mail senden,Fragebogen] Umsetzung[Vorbereiten | Skripte(Leitfaden,Einwände,Nachhaken) | Zwischen,Training,Schluss]');
    const m = editorModell(vorlage(d), [MAIL]);
    expect(m.phasen[0].abschnitte[0].knoten[2]).toMatchObject({ form: 'nachricht', gesetzt: true, frist: 2, zustaendig: 'intern', kundeSichtbar: true });
    // Kein Sammel-Teilprozess, solange niemand Ebene 4 braucht.
    expect(vorlage(d).knoten.filter(x => x.titel === 'Start' || x.titel === 'Umsetzung')).toHaveLength(2);
  });
  it('Baustein an einen Schritt direkt in der Phase: ein Sammel-Teilprozess entsteht — das Bild bleibt gleich; leer fällt er wieder weg', () => {
    let d = tun(datei(), { op: 'baustein-dazu', id: u(1), schrittId: 'fk-a', bausteinId: 'fb-mail' });
    expect(bild(d)).toBe('Start◆[Kick-off,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
    const v = vorlage(d);
    const sammel = v.knoten.find(x => x.elternId === 'fk-p1' && x.titel === 'Start')!;
    expect(v.knoten.find(x => x.id === 'fk-a')!.elternId).toBe(sammel.id);
    expect(v.knoten.find(x => x.id === u(1))).toMatchObject({ elternId: 'fk-a', bausteinId: 'fb-mail', titel: 'Begrüßungsmail' });
    expect(editorModell(v, [MAIL]).phasen[0].abschnitte[0].knoten[0]).toMatchObject({ form: 'nachricht', gesetzt: false, bausteine: [{ bausteinId: 'fb-mail' }] });
    expect(anwenden(d, [{ op: 'baustein-dazu', id: u(2), schrittId: 'fk-a', bausteinId: 'fb-mail' }]).ok).toBe(false);
    // Mit Baustein in eine Gruppe und zurück hinter „Training“: bleibt Ebene 4 (eigener Sammel), der leere Sammel in „Start“ fällt weg.
    d = tun(d, { op: 'schritt-schieben', id: 'fk-a', ziel: { phaseId: 'fk-p2', nach: 'fk-c' } });
    expect(bild(d)).toBe('Start◆[Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training,Kick-off]');
    expect(vorlage(d).knoten.some(x => x.id === sammel.id)).toBe(false);
    d = tun(d, { op: 'schritt-schieben', id: 'fk-a', ziel: { phaseId: 'fk-p2', vor: 'fk-g1' } });
    expect(bild(d)).toBe('Start◆[Fragebogen] Umsetzung[Skripte(Kick-off,Leitfaden,Einwände) | Training]');
    expect(vorlage(d).knoten.filter(x => x.elternId === 'fk-p2').map(x => x.titel)).toEqual(['Skripte', 'Training']);
  });
  it('Felder ändern, Gruppe umbenennen; ein Teilprozess lässt sich hier nicht als Schritt verschieben', () => {
    const d = tun(datei(), { op: 'schritt', id: 'fk-b', titel: 'Fragebogen senden', form: 'nachricht', frist: 5 }, { op: 'gruppe', id: 'fk-g', titel: 'Gesprächsleitfäden' });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-b')).toMatchObject({ titel: 'Fragebogen senden', form: 'nachricht', frist: 5 });
    const d2 = tun(d, { op: 'schritt', id: 'fk-b', frist: null });
    expect(vorlage(d2).knoten.find(x => x.id === 'fk-b')).not.toHaveProperty('frist');
    expect(bild(d)).toContain('Gesprächsleitfäden(Leitfaden,Einwände)');
    expect(anwenden(d, [{ op: 'schritt', id: 'fk-b', frist: 1.5 }]).ok).toBe(false);
    expect(anwenden(d, [{ op: 'schritt', id: 'fk-p1', titel: 'x' }]).ok).toBe(false);
    expect(anwenden(d, [{ op: 'schritt-schieben', id: 'fk-g', ziel: { phaseId: 'fk-p1' } }]).ok).toBe(false);
  });
  it('Phase umbenennen nimmt ihren Sammel-Teilprozess mit (er bleibt ohne Überschrift)', () => {
    let d = tun(datei(), { op: 'baustein-dazu', id: u(1), schrittId: 'fk-b', bausteinId: 'fb-mail' });
    d = tun(d, { op: 'phase', id: 'fk-p1', titel: 'Auftakt' });
    expect(bild(d)).toBe('Auftakt◆[Kick-off,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
  });
  it('neue Kennungen nur fk-<uuid> und nie doppelt', () => {
    expect(anwenden(datei(), [{ op: 'schritt-neu', id: 'fk-a', ziel: { phaseId: 'fk-p1' }, titel: 'X' }]).ok).toBe(false);
    expect(anwenden(datei(), [{ op: 'schritt-neu', id: 'quatsch', ziel: { phaseId: 'fk-p1' }, titel: 'X' }]).ok).toBe(false);
    const d = tun(datei(), { op: 'schritt-neu', id: u(9), ziel: { phaseId: 'fk-p1' }, titel: 'X' });
    const r = anwenden(d, [{ op: 'schritt-neu', id: u(9), ziel: { phaseId: 'fk-p1' }, titel: 'Y' }]);
    expect(!r.ok && r.status).toBe(409);
  });
});

describe('Papierkorb: löschen, zurückholen, leeren — nichts geht still verloren', () => {
  it('Schritt und Phase in den Papierkorb, Zweige gelöst und beim Zurückholen wieder gesetzt, an ihrem Platz', () => {
    let d = tun(datei(), { op: 'schritt', id: 'fk-a', form: 'entscheidung' }, { op: 'nein-erinnerung', id: u(1), entscheidungId: 'fk-a' });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-a')!.zweige).toEqual({ nein: u(1) });
    d = tun(d, { op: 'weg', id: u(1) });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-a')).not.toHaveProperty('zweige');
    expect(editorModell(vorlage(d)).papierkorb).toMatchObject([{ id: u(1), art: 'schritt', titel: 'Erinnern', wo: 'Start' }]);
    d = tun(d, { op: 'zurueck', id: u(1) });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-a')!.zweige).toEqual({ nein: u(1) });
    expect(bild(d)).toBe('Start◆[Kick-off,Erinnern,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
    expect(vorlage(d)).not.toHaveProperty('papierkorb');
    // Ganze Phase samt Abstimmungspunkt.
    d = tun(d, { op: 'weg', id: 'fk-p1' });
    expect(bild(d)).toBe('Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
    expect(vorlage(d).freigaben.map(f => f.id)).toEqual(['F0']);
    d = tun(d, { op: 'zurueck', id: 'fk-p1' });
    expect(bild(d)).toBe('Start◆[Kick-off,Erinnern,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
  });
  it('ein leer gewordener Sammel fällt weg; Zurückholen setzt den Schritt nach seinem Vorgänger in der Anzeige', () => {
    let d = tun(datei(), { op: 'baustein-dazu', id: u(1), schrittId: 'fk-b', bausteinId: 'fb-mail' });
    d = tun(d, { op: 'weg', id: 'fk-b' });
    expect(vorlage(d).knoten.filter(x => x.elternId === 'fk-p1').map(x => x.titel)).toEqual(['Kick-off']);
    d = tun(d, { op: 'zurueck', id: 'fk-b' });
    expect(bild(d)).toBe('Start◆[Kick-off,Fragebogen] Umsetzung[Skripte(Leitfaden,Einwände) | Training]');
    expect(vorlage(d).knoten.find(x => x.id === u(1))!.elternId).toBe('fk-b');
  });
  it('still (Rückgängig) steht nicht in der Liste; nach 30 Tagen fällt ein Eintrag beim nächsten Schreiben weg; leeren ist endgültig', () => {
    let d = tun(datei(), { op: 'weg', id: 'fk-c', still: true }, { op: 'weg', id: 'fk-b' });
    expect(editorModell(vorlage(d)).papierkorb.map(x => x.id)).toEqual(['fk-b']);
    expect(vorlage(d).papierkorb).toHaveLength(2);
    const spaeter: EditorKontext = { ...k, jetzt: '2026-11-20T09:00:00.000Z' };
    d = ok(editorAnwenden(d, { vorlageId: 'fp-test', stand: stand(vorlage(d)), ops: [{ op: 'phase', id: 'fk-p1', titel: 'Start 2' }] }, spaeter));
    expect(vorlage(d)).not.toHaveProperty('papierkorb');
    d = tun(d, { op: 'weg', id: 'fk-a' });
    d = tun(d, { op: 'papierkorb-leeren' });
    expect(vorlage(d)).not.toHaveProperty('papierkorb');
    expect(anwenden(d, [{ op: 'zurueck', id: 'fk-a' }]).ok).toBe(false);
  });
});

describe('Zweige: Entscheidung mit ja/nein, Kreise nur über eine Erinnerung zurück zur Entscheidung', () => {
  const mitEntscheidung = () => tun(datei(), { op: 'schritt', id: 'fk-a', form: 'entscheidung', titel: 'Unterlagen da?' });
  it('Nein-Zweig → Erinnerung, die zurück zur Entscheidung läuft (Schleife erlaubt); weiter statt zurück ebenso', () => {
    let d = tun(mitEntscheidung(), { op: 'nein-erinnerung', id: u(1), entscheidungId: 'fk-a' });
    const v = vorlage(d);
    expect(v.knoten.find(x => x.id === u(1))).toMatchObject({ form: 'erinnerung', zweige: { ja: 'fk-a' } });
    const m = editorModell(v);
    expect(m.phasen[0].abschnitte[0].knoten.find(x => x.id === u(1))!.neinVon).toBe('fk-a');
    d = tun(d, { op: 'zweig', id: u(1), ja: null });
    expect(vorlage(d).knoten.find(x => x.id === u(1))).not.toHaveProperty('zweige');
    expect(() => zweigePruefen(vorlage(d).knoten)).not.toThrow();
  });
  it('Kreis ohne Erinnerung → 409; Ziel in anderer Phase → 409; Nein-Zweig doppelt → 409; Nein an einem Schritt → 400', () => {
    const d = mitEntscheidung();
    const kreis = anwenden(d, [{ op: 'schritt', id: 'fk-b', form: 'entscheidung' }, { op: 'zweig', id: 'fk-b', ja: 'fk-a' }]);
    expect(!kreis.ok && kreis.status).toBe(409);
    const fremd = anwenden(d, [{ op: 'zweig', id: 'fk-a', nein: 'fk-c' }]);
    expect(!fremd.ok && fremd.status).toBe(409);
    const d2 = tun(d, { op: 'zweig', id: 'fk-a', nein: 'fk-b' });
    const doppelt = anwenden(d2, [{ op: 'schritt-neu', id: u(3), ziel: { phaseId: 'fk-p1' }, form: 'entscheidung', titel: 'Zweite' }, { op: 'zweig', id: u(3), nein: 'fk-b' }]);
    expect(!doppelt.ok && doppelt.status).toBe(409);
    const schritt = anwenden(datei(), [{ op: 'zweig', id: 'fk-a', nein: 'fk-b' }]);
    expect(!schritt.ok && schritt.status).toBe(400);
    // Ein Schritt mit Zweig zieht nicht in eine andere Phase.
    const zieht = anwenden(d2, [{ op: 'schritt-schieben', id: 'fk-b', ziel: { phaseId: 'fk-p2' } }]);
    expect(!zieht.ok && zieht.status).toBe(409);
  });
  it('eine andere Form nimmt unpassende Zweige mit; der alte Baum-Weg (knoten-weg) löst Zweige auf Entferntes', () => {
    let d = tun(mitEntscheidung(), { op: 'nein-erinnerung', id: u(1), entscheidungId: 'fk-a' });
    d = tun(d, { op: 'schritt', id: 'fk-a', form: 'schritt' });
    expect(vorlage(d).knoten.find(x => x.id === 'fk-a')).not.toHaveProperty('zweige');
    let d2 = tun(mitEntscheidung(), { op: 'nein-erinnerung', id: u(2), entscheidungId: 'fk-a' });
    d2 = ok(vorlagenAnwenden(d2, [{ op: 'knoten-weg', vorlageId: 'fp-test', id: u(2) }], { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: stand, neueId: p => `${p}-x${++N}` }));
    expect(vorlage(d2).knoten.find(x => x.id === 'fk-a')).not.toHaveProperty('zweige');
  });
});

describe('Stand und Grenzen', () => {
  it('veralteter Stand → 409 mit Konflikt (die Route schickt die aktuelle Fassung); ohne Stand → 400', () => {
    const r = anwenden(datei(), [{ op: 'titel', titel: 'Neu' }], 'veraltet');
    expect(!r.ok && r.status).toBe(409);
    expect(!r.ok && r.konflikte?.[0]).toMatchObject({ id: 'fp-test' });
    const ohne = editorAnwenden(datei(), { vorlageId: 'fp-test', ops: [{ op: 'titel', titel: 'Neu' }] }, k);
    expect(!ohne.ok && ohne.status).toBe(400);
  });
  it('413: zu viele Ops, zu viele Knoten, zu langer Titel, voller Papierkorb — nichts gespeichert', () => {
    const viele = Array.from({ length: GRENZEN.opsJeAnfrage + 1 }, () => ({ op: 'titel', titel: 'x' }));
    expect((r => !r.ok && r.status)(anwenden(datei(), viele))).toBe(413);
    expect((r => !r.ok && r.status)(anwenden(datei(), [{ op: 'titel', titel: 'x'.repeat(121) }]))).toBe(413);
    const gross = V();
    gross.knoten.push(...Array.from({ length: GRENZEN.knotenJeVorlage - gross.knoten.length }, (_, i) => ({ id: `fk-f${i}`, elternId: 'fk-p2', titel: `F${i}`, rang: 10 + i })));
    expect((r => !r.ok && r.status)(anwenden(datei(gross), [{ op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p1' }, titel: 'Einer zu viel' }]))).toBe(413);
    const voll = V();
    voll.papierkorb = Array.from({ length: GRENZEN.papierkorbJeVorlage }, (_, i) => ({ id: `fk-k${i}`, am: J, von: 'pia', art: 'schritt' as const, phaseId: 'fk-p1', knoten: [{ id: `fk-k${i}`, titel: 'K', rang: 1 }] }));
    expect((r => !r.ok && r.status)(anwenden(datei(voll), [{ op: 'weg', id: 'fk-c' }]))).toBe(413);
  });
  it('nur Paket-Vorlagen', () => {
    const d = datei({ ...V(), art: 'landkarte' });
    expect((r => !r.ok && r.status)(anwenden(d, [{ op: 'titel', titel: 'X' }]))).toBe(400);
  });
});

// ── Rückgängig / Wiederholen ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Rückgängig und Wiederholen (Sitzung)', () => {
  const faelle: [string, EditorOp[]][] = [
    ['Schritt anlegen', [{ op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p1', nach: 'fk-a' }, form: 'nachricht', titel: 'Mail' }]],
    ['Schritt mit Baustein (ein Stapel)', [{ op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p2', nachGruppe: 'fk-g' }, form: 'nachricht', titel: 'Mail' }, { op: 'baustein-dazu', id: u(2), schrittId: u(1), bausteinId: 'fb-mail' }]],
    ['Phase anlegen', [{ op: 'phase-neu', id: u(1), titel: 'Neu', nach: 'fk-p1' }]],
    ['Phase umbenennen', [{ op: 'phase', id: 'fk-p1', titel: 'Auftakt', kundeSichtbar: false }]],
    ['Phase verschieben', [{ op: 'phase-schieben', id: 'fk-p2', nach: null }]],
    ['Abstimmung aus', [{ op: 'abstimmung', phaseId: 'fk-p1', an: false }]],
    ['Abstimmung an', [{ op: 'abstimmung', phaseId: 'fk-p2', an: true }]],
    ['Felder ändern', [{ op: 'schritt', id: 'fk-g1', titel: 'Leitfaden neu', form: 'termin', frist: 3, zustaendig: 'kunde', kundeSichtbar: true }]],
    ['in eine Gruppe verschieben', [{ op: 'schritt-schieben', id: 'fk-c', ziel: { phaseId: 'fk-p2', vor: 'fk-g1' } }]],
    ['aus der Gruppe an den Anfang', [{ op: 'schritt-schieben', id: 'fk-g1', ziel: { phaseId: 'fk-p2', anfang: true } }]],
    ['in eine andere Phase', [{ op: 'schritt-schieben', id: 'fk-b', ziel: { phaseId: 'fk-p2' } }]],
    ['löschen', [{ op: 'weg', id: 'fk-g' }]],
    ['Gruppe umbenennen', [{ op: 'gruppe', id: 'fk-g', titel: 'Andere' }]],
    ['Titel', [{ op: 'titel', titel: 'Neuer Titel' }]],
  ];
  for (const [name, ops] of faelle) {
    it(name, () => {
      const d0 = datei();
      const g = geschichteFuer(vorlage(d0), ops)!;
      expect(g).not.toBeNull();
      const d1 = tun(d0, ...ops);
      const nach = bild(d1);
      const d2 = tun(d1, ...g.rueck);
      expect(bild(d2)).toBe(bild(d0));
      expect(editorModell(vorlage(d2)).phasen).toEqual(editorModell(vorlage(d0)).phasen);
      const d3 = tun(d2, ...g.wieder);
      expect(bild(d3)).toBe(nach);
      // Und noch einmal zurück.
      expect(bild(tun(d3, ...g.rueck))).toBe(bild(d0));
    });
  }
  it('Nein-Erinnerung und Formwechsel samt Zweigen', () => {
    const d0 = tun(datei(), { op: 'schritt', id: 'fk-a', form: 'entscheidung' });
    const ops: EditorOp[] = [{ op: 'nein-erinnerung', id: u(1), entscheidungId: 'fk-a' }];
    const g = geschichteFuer(vorlage(d0), ops)!;
    const d1 = tun(d0, ...ops);
    const d2 = tun(d1, ...g.rueck);
    expect(vorlage(d2).knoten.find(x => x.id === 'fk-a')).not.toHaveProperty('zweige');
    const d3 = tun(d2, ...g.wieder);
    expect(vorlage(d3).knoten.find(x => x.id === 'fk-a')!.zweige).toEqual({ nein: u(1) });
    const form: EditorOp[] = [{ op: 'schritt', id: 'fk-a', form: 'schritt' }];
    const g2 = geschichteFuer(vorlage(d3), form)!;
    const d4 = tun(tun(d3, ...form), ...g2.rueck);
    expect(vorlage(d4).knoten.find(x => x.id === 'fk-a')).toMatchObject({ form: 'entscheidung', zweige: { nein: u(1) } });
  });
  it('Papierkorb leeren lässt sich nicht zurücknehmen; positionVon kennt jeden Platz', () => {
    expect(geschichteFuer(V(), [{ op: 'papierkorb-leeren' }])).toBeNull();
    expect(positionVon(V().knoten, 'fk-a')).toEqual({ phaseId: 'fk-p1', vor: 'fk-b' });
    expect(positionVon(V().knoten.filter(x => x.id !== 'fk-b'), 'fk-a')).toEqual({ phaseId: 'fk-p1', anfang: true });
    expect(positionVon(V().knoten, 'fk-b')).toEqual({ phaseId: 'fk-p1', nach: 'fk-a' });
    expect(positionVon(V().knoten, 'fk-g1')).toEqual({ phaseId: 'fk-p2', vor: 'fk-g2' });
    expect(positionVon(V().knoten, 'fk-c')).toEqual({ phaseId: 'fk-p2', nachGruppe: 'fk-g' });
    expect(positionVon(V().knoten, 'fk-p1')).toBeNull();
  });
});

// ── Wirkung auf Fälle ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const fk = (x: Partial<FallKontext> = {}): FallKontext => ({ person: 'pia', jetzt: J, heute: '2026-10-17', standVon: stand, neueId: p => `${p}-f${++N}`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['F0', 'A1'], ...x });
const fallOk = (r: { ok: true; datei: Fall } | { ok: false; status: number; fehler: string }): Fall => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };

describe('Wirkung auf Fälle: neue Fälle sofort, laufende nur per Übernahme — nichts geht verloren', () => {
  it('Diff zeigt neu, geändert, entfernt und Reihenfolge; Übernahme behält Erledigtes, eigene Schritte und ihren Platz', () => {
    const v0 = V();
    let fall = fallStarten({ mandatId: 'm-1', vorlage: v0, person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-f${++N}` });
    fall = fallOk(fallAnwenden(fall, [{ op: 'knoten-status', id: 'fk-b', status: 'erledigt' }, { op: 'knoten-extra', eintrag: { elternId: 'fk-p2', titel: 'Eigener Schritt' } }], fk()));
    const extra = fall.knoten.find(x => x.extra && x.titel === 'Eigener Schritt')!;
    const d = tun(datei(v0),
      { op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p1', anfang: true }, form: 'nachricht', titel: 'Willkommen' },
      { op: 'schritt', id: 'fk-b', titel: 'Fragebogen senden' },
      { op: 'schritt-schieben', id: 'fk-c', ziel: { phaseId: 'fk-p2', anfang: true } },
      { op: 'weg', id: 'fk-g2' });
    const v1 = vorlage(d);
    const diff = vorlagenDiff(fall, v1)!;
    expect(diff.neu.map(x => x.titel)).toEqual(['Willkommen']);
    expect(diff.geaendert.find(x => x.id === 'fk-b')!.felder).toEqual(['titel']);
    expect(diff.entfernt.map(x => x.titel)).toContain('Einwände');
    expect(diff.reihenfolge.map(x => x.titel)).toEqual(['Umsetzung']);
    const neu = vorlageUebernehmen(fall, v1, J, 'pia');
    // Nichts fällt weg: jeder Knoten von vorher ist noch da — mit seinem Stand.
    for (const x of fall.knoten) expect(neu.knoten.some(y => y.id === x.id), x.titel).toBe(true);
    expect(neu.knoten.find(x => x.id === 'fk-b')).toMatchObject({ status: 'erledigt', titel: 'Fragebogen senden' });
    expect(neu.knoten.find(x => x.id === u(1))).toMatchObject({ status: 'offen', form: 'nachricht' });
    // Reihenfolge der Vorlage; der eigene Schritt bleibt hinter dem Knoten, hinter dem er stand („Training“).
    const p2 = neu.knoten.filter(x => x.elternId === 'fk-p2').sort((a, b) => a.rang - b.rang).map(x => x.id);
    expect(p2).toEqual(['fk-c', extra.id, 'fk-g']);
    expect(neu.vorlageFassung).toBe(v1.fassung);
    expect(neu.phasenVonHand).toBe(true);
    expect(vorlagenDiff(neu, v1)).toBeNull();
    // Ein neuer Fall nimmt die neue Fassung sofort.
    const frisch = fallStarten({ mandatId: 'm-2', vorlage: v1, person: 'pia', jetzt: J, start: '2026-10-17', neueId: p => `${p}-f${++N}` });
    expect(frisch.knoten.some(x => x.id === u(1))).toBe(true);
    expect(frisch.knoten.some(x => x.id === 'fk-g2')).toBe(false);
  });
  it('Entscheidung erledigt (= ja) → ihre Erinnerung entfällt; Frist setzt die Fälligkeit des nächsten Schritts; der Fluss zeigt den Nein-Zweig daneben', () => {
    const d = tun(datei(),
      { op: 'schritt', id: 'fk-a', form: 'entscheidung', titel: 'Unterlagen da?' },
      { op: 'nein-erinnerung', id: u(1), entscheidungId: 'fk-a' },
      { op: 'schritt', id: 'fk-b', frist: 3 });
    let fall = fallStarten({ mandatId: 'm-1', vorlage: vorlage(d), person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-f${++N}` });
    const freigaben = vorlage(d).freigaben;
    const fl = phasenFluss({ fall, freigaben, heute: '2026-10-17' }, 'fk-p1')!;
    const alle = flussKnoten(fl);
    const e = alle.find(x => x.id === 'fk-a')!;
    expect(e).toMatchObject({ form: 'entscheidung', entscheid: true, ja: 'weiter', nein: { titel: 'Erinnern', unter: 'danach zurück zur Entscheidung' } });
    expect(e.neinKnoten?.id).toBe(u(1));
    // Nicht doppelt: die Erinnerung steht nur neben der Entscheidung.
    const strang = fl.teile.flatMap(t => (t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten))).map(x => x.id);
    expect(strang).not.toContain(u(1));
    fall = fallOk(fallAnwenden(fall, [{ op: 'knoten-status', id: 'fk-a', status: 'erledigt' }], fk()));
    expect(fall.knoten.find(x => x.id === u(1))).toMatchObject({ status: 'entfaellt', grund: 'Entscheidung: ja' });
    expect(fall.knoten.find(x => x.id === 'fk-b')!.faelligAm).toBe('2026-10-20');
  });
  it('Frist am ersten Schritt zählt ab dem Start des Falls', () => {
    const d = tun(datei(), { op: 'schritt', id: 'fk-a', frist: 5 });
    const fall = fallStarten({ mandatId: 'm-1', vorlage: vorlage(d), person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-f${++N}` });
    expect(fall.knoten.find(x => x.id === 'fk-a')!.faelligAm).toBe('2026-10-15');
  });
});

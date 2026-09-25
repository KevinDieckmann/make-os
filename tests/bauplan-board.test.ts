// Bauplan als Board (25.09.): Spalten, Ziehen, Eingang, Etappen, Warteschlange.
import { describe, it, expect } from 'vitest';
import type { BacklogItem } from '../lib/make-one/backlog-data';
import { spalteVon, statusAus, artVon, board, verschieben, neueKarte, felderSaeubern, bereichAusSeite, etappenStand, warteschlange, bildNameOk } from '../lib/bauplan/board';

const J = '2026-09-25T10:00:00.000Z';
const k = (id: string, x: Partial<BacklogItem> = {}): BacklogItem => ({ id, titel: id, warum: '', kategorie: 'idee', status: 'offen', prio: 2, block: 'frei', angelegt: J, ...x });

describe('Spalten aus altem Stand', () => {
  it('offen+P1 → Bereit, offen → Ideen, laufend → In Arbeit, erledigt → Fertig; Status folgt der Spalte', () => {
    expect([k('a', { prio: 1 }), k('b'), k('c', { status: 'laufend' }), k('d', { status: 'erledigt' })].map(spalteVon)).toEqual(['bereit', 'idee', 'arbeit', 'fertig']);
    expect(spalteVon(k('e', { spalte: 'test', status: 'offen' }))).toBe('test');
    expect(['idee', 'bereit', 'arbeit', 'test', 'fertig'].map(s => statusAus(s as never))).toEqual(['offen', 'offen', 'laufend', 'laufend', 'erledigt']);
    expect(artVon(k('f', { kategorie: 'anbindung' }))).toBe('anbindung');
  });
});

describe('Ziehen', () => {
  it('an eine Position in einer anderen Spalte — die Spalte wird neu nummeriert, Status wandert mit', () => {
    const items = [k('a', { spalte: 'bereit', rang: 10 }), k('b', { spalte: 'bereit', rang: 20 }), k('c', { spalte: 'idee' })];
    const n = verschieben(items, 'c', 'bereit', 1, J);
    expect(board(n).bereit.map(i => [i.id, i.rang])).toEqual([['a', 10], ['c', 20], ['b', 30]]);
    expect(n.find(i => i.id === 'c')).toMatchObject({ spalte: 'bereit', status: 'offen', geaendert: J });
    const t = verschieben(n, 'a', 'test', 0, J);
    expect(t.find(i => i.id === 'a')).toMatchObject({ spalte: 'test', status: 'laufend' });
    expect(board(t).bereit.map(i => i.id)).toEqual(['c', 'b']);
  });
  it('innerhalb der Spalte nach oben; Index außerhalb wird begrenzt; Verworfenes zählt nicht', () => {
    const items = [k('a', { spalte: 'bereit', rang: 10 }), k('b', { spalte: 'bereit', rang: 20 }), k('x', { spalte: 'bereit', rang: 5, verworfen: true })];
    expect(board(verschieben(items, 'b', 'bereit', 0, J)).bereit.map(i => i.id)).toEqual(['b', 'a']);
    expect(board(verschieben(items, 'a', 'bereit', 99, J)).bereit.map(i => i.id)).toEqual(['b', 'a']);
  });
});

describe('Eingang', () => {
  it('neue Karte: Titel Pflicht, Auswahl nur aus Listen, Bereich aus der Seite, oben in Ideen', () => {
    const n = neueKarte({ titel: '  Knopf fehlt  ', art: 'fehler', seite: '/os/markttraktion?s=kontakte', prio: 1, problem: 'X', bilder: ['0d7c2f3e-1111-2222-3333-444455556666.jpg', '../../etc/passwd'], ziel: '2026-10-01' }, 'malin', J, 'bp-1')!;
    expect(n).toMatchObject({ titel: 'Knopf fehlt', art: 'fehler', bereich: 'Markttraktion', prio: 1, spalte: 'idee', status: 'offen', von: 'malin', problem: 'X', ziel: '2026-10-01', seite: '/os/markttraktion?s=kontakte' });
    expect(n.bilder).toEqual(['0d7c2f3e-1111-2222-3333-444455556666.jpg']);
    expect(neueKarte({ titel: ' ' }, 'kevin', J, 'x')).toBeNull();
    expect(neueKarte({ titel: 'a', art: 'quatsch', bereich: 'Nirgendwo' }, 'kevin', J, 'x')).toMatchObject({ art: 'verbesserung', bereich: 'Allgemein', prio: 2 });
  });
  it('Bereich aus dem Pfad; Bildnamen nur sicher', () => {
    expect([bereichAusSeite('/os/mandate?s=produkte'), bereichAusSeite('/os'), bereichAusSeite('/os/bauplan'), bereichAusSeite('/jarvis'), bereichAusSeite('/os/finanzen?s=privat')]).toEqual(['Mandate', 'Heute', 'System', 'Jarvis', 'Zahlen']);
    expect(neueKarte({ titel: 'a', seite: '//boese.example' }, 'kevin', J, 'x')!.seite).toBeUndefined();
    expect(neueKarte({ titel: 'a', seite: '/os/fokus' }, 'kevin', J, 'x')).toMatchObject({ seite: '/os/fokus', bereich: 'Fokus' });
    expect(bildNameOk('abc.jpg')).toBe(false);
    expect(bildNameOk('0d7c2f3e-1111-2222-3333-444455556666.png')).toBe(true);
  });
  it('Felder ändern: nur Erlaubtes, Leeres löscht', () => {
    expect(felderSaeubern({ titel: 'Neu', art: 'neu', prio: 9, block: 'kevin', etappe: 'e-live', warum: '', status: 'erledigt', ergebnis: 'Gebaut' })).toEqual({ titel: 'Neu', art: 'neu', block: 'kevin', etappe: 'e-live', warum: undefined, ergebnis: 'Gebaut' });
  });
});

describe('Planung und Warteschlange', () => {
  it('Etappen-Fortschritt; Claude baut Bereit von oben, ohne Karten, die auf Kevin warten', () => {
    const items = [k('a', { etappe: 'e-1', spalte: 'fertig' }), k('b', { etappe: 'e-1', spalte: 'test' }), k('c', { etappe: 'e-1', spalte: 'bereit', rang: 20 }), k('d', { spalte: 'bereit', rang: 10, block: 'kevin' }), k('e', { spalte: 'bereit', rang: 30 })];
    expect(etappenStand(items, { id: 'e-1' })).toEqual({ gesamt: 3, fertig: 1, imTest: 1, anteil: 1 / 3 });
    expect(warteschlange(items).map(i => i.id)).toEqual(['c', 'e']);
  });
});

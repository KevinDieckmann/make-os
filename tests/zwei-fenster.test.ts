// Das Zwei-Fenster-Fundament: nur die Unterschiede gehen raus. Diese Diffs
// entscheiden, ob Kevins Klick Malins Arbeit überschreibt — der wichtigste
// Regelkreis der ganzen Software, deshalb zuerst getestet.

import { describe, expect, it } from 'vitest';
import { listenOps } from '@/lib/make-one/liste-sync';
import { planOps } from '@/lib/make-one/wochenplan-sync';
import { opsLesen } from '@/lib/store/patch-liste';

describe('listenOps (Kunden, Meilensteine, Routinen …)', () => {
  const alt = [
    { id: 'a', name: 'OneBanking', status: 'aktiv' },
    { id: 'b', name: 'Gregor', status: 'gespraech' },
  ];

  it('meldet nichts, wenn nichts geändert wurde', () => {
    expect(listenOps(alt, [...alt])).toEqual([]);
  });

  it('schickt NUR den geänderten Eintrag — nicht die Liste', () => {
    const neu = [alt[0], { ...alt[1], status: 'aktiv' }];
    const ops = listenOps(alt, neu);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'upsert', eintrag: { id: 'b', status: 'aktiv' } });
  });

  it('erkennt Neuanlage und Löschung nebeneinander', () => {
    const neu = [alt[0], { id: 'c', name: 'ACME', status: 'gespraech' }];
    const ops = listenOps(alt, neu);
    expect(ops).toContainEqual({ op: 'upsert', eintrag: neu[1] });
    expect(ops).toContainEqual({ op: 'delete', id: 'b' });
    expect(ops).toHaveLength(2);
  });
});

describe('planOps (Wochenplaner)', () => {
  it('ein verschobener Block erzeugt genau eine Änderung', () => {
    const alt = [
      { id: 'x', startMin: 600, dauerMin: 60 },
      { id: 'y', startMin: 720, dauerMin: 30 },
    ];
    const neu = [{ ...alt[0], startMin: 660 }, alt[1]];
    const ops = planOps(alt, neu);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'upsert', block: { id: 'x', startMin: 660 } });
  });
});

describe('opsLesen (Server-Seite)', () => {
  const saeubern = (e: unknown) => {
    const k = e as { id?: string; name?: string };
    return k.name ? { id: k.id ?? 'neu', name: k.name } : null;
  };

  it('verwirft Unbrauchbares statt es durchzulassen', () => {
    const ops = opsLesen([
      { op: 'upsert', eintrag: { id: '1', name: 'gültig' } },
      { op: 'upsert', eintrag: { id: '2' } },          // ohne Name → raus
      { op: 'delete', id: '3' },
      { op: 'quatsch' },                                // unbekannt → raus
      { op: 'delete' },                                 // ohne id → raus
    ], saeubern);
    expect(ops).toHaveLength(2);
    expect(ops![0]).toMatchObject({ op: 'upsert', eintrag: { name: 'gültig' } });
    expect(ops![1]).toEqual({ op: 'delete', id: '3' });
  });

  it('gibt null zurück, wenn gar keine Liste kam', () => {
    expect(opsLesen(undefined, saeubern)).toBeNull();
    expect(opsLesen('kaputt', saeubern)).toBeNull();
  });
});

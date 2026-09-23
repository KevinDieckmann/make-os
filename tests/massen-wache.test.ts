// ─── Der zweite Weg, auf dem Arbeit verschwindet ────────────────────────────
// Am 06.09. wurden 57 von 64 Aufgaben in drei Minuten auf erledigt gesetzt.
// Der bestehende Schutz sah das nicht — und konnte es nicht sehen: er zählt
// die Länge der Liste, und die bleibt beim Erledigen gleich.
//
// Gelöschte Aufgaben vermisst man. Erledigte glaubt man erledigt zu haben.
// Deshalb ist dieser Weg der gefährlichere von beiden.

import { describe, it, expect } from 'vitest';
import { neuErledigt, brauchtBestaetigung, MASSEN_GRENZE } from '../lib/store/massen-wache';

const aufgaben = (n: number, status = 'todo') =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, status }));

const alleErledigt = (liste: { id: string; status?: string }[], wieViele: number) =>
  liste.map((t, i) => (i < wieViele ? { ...t, status: 'done' } : t));

describe('Massen-Erledigung', () => {
  it('erkennt genau den Fall vom 06.09.: 57 von 64', () => {
    const alt = aufgaben(64);
    const neu = alleErledigt(alt, 57);
    expect(neuErledigt(alt, neu)).toHaveLength(57);
    expect(brauchtBestaetigung(alt, neu).noetig).toBe(true);
  });

  it('lässt normales Abhaken durch', () => {
    const alt = aufgaben(64);
    for (const n of [1, 3, 8, MASSEN_GRENZE]) {
      expect(brauchtBestaetigung(alt, alleErledigt(alt, n)).noetig, `${n} Stück`).toBe(false);
    }
    // Erst über der Grenze wird nachgefragt.
    expect(brauchtBestaetigung(alt, alleErledigt(alt, MASSEN_GRENZE + 1)).noetig).toBe(true);
  });

  it('zählt nur die gefährliche Richtung — Aufmachen ist nie ein Problem', () => {
    const alt = aufgaben(40, 'done');
    const neu = alt.map(t => ({ ...t, status: 'todo' }));
    expect(neuErledigt(alt, neu)).toHaveLength(0);
    expect(brauchtBestaetigung(alt, neu).noetig).toBe(false);
  });

  it('zählt neu angelegte Aufgaben nicht mit', () => {
    // 20 neue Aufgaben, die gleich als erledigt ankommen (z.B. ein Import),
    // sind keine Massen-Erledigung — es ging nichts verloren.
    const alt = aufgaben(5);
    const neu = [...alt, ...aufgaben(20, 'done').map(t => ({ ...t, id: `neu-${t.id}` }))];
    expect(neuErledigt(alt, neu)).toHaveLength(0);
  });

  it('lässt es durch, wenn es ausdrücklich bestätigt wurde', () => {
    const alt = aufgaben(64);
    const neu = alleErledigt(alt, 57);
    expect(brauchtBestaetigung(alt, neu, true).noetig).toBe(false);
    // Die Zahl wird trotzdem gemeldet — die Oberfläche soll sie nennen können.
    expect(brauchtBestaetigung(alt, neu, true).anzahl).toBe(57);
  });

  it('kommt mit leeren Beständen klar', () => {
    expect(brauchtBestaetigung([], []).noetig).toBe(false);
    expect(brauchtBestaetigung([], aufgaben(30, 'done')).noetig).toBe(false);
  });
});

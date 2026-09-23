// ─── Warteschlange: der Schlüssel gegen Doppelausführung ────────────────────
// Der Idempotenz-Schlüssel ist das, was verhindert, dass ein Wiederholungslauf
// die Rechnung zweimal ins Buch schreibt. Er muss deshalb allein von der
// Wirkung abhängen — nicht von der Reihenfolge, in der die Felder ankommen,
// und nicht von der Zeit.

import { describe, it, expect } from 'vitest';
import { schluesselFuer } from '../lib/jarvis/auftraege';

describe('Auftrags-Schlüssel', () => {
  it('ist gleich, egal in welcher Reihenfolge die Felder kommen', () => {
    const a = schluesselFuer('werkzeug', 'setze_kontostand', { firma: 'kdc', betrag: 100 });
    const b = schluesselFuer('werkzeug', 'setze_kontostand', { betrag: 100, firma: 'kdc' });
    expect(a).toBe(b);
  });

  it('unterscheidet verschiedene Wirkungen', () => {
    const a = schluesselFuer('werkzeug', 'setze_kontostand', { firma: 'kdc', betrag: 100 });
    const b = schluesselFuer('werkzeug', 'setze_kontostand', { firma: 'kdc', betrag: 200 });
    const c = schluesselFuer('werkzeug', 'setze_kontostand', { firma: 'kdv', betrag: 100 });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('trennt Agenten nach ihrem Auftrag', () => {
    const a = schluesselFuer('agent', 'research', {}, 'Marktlage Fintech');
    const b = schluesselFuer('agent', 'research', {}, 'Marktlage Versicherung');
    const c = schluesselFuer('agent', 'research', {}, 'Marktlage Fintech');
    expect(a).not.toBe(b);
    expect(a).toBe(c);
  });

  it('ändert sich nicht mit der Zeit — sonst schützt er vor gar nichts', () => {
    const a = schluesselFuer('agent', 'board', {});
    const b = schluesselFuer('agent', 'board', {});
    expect(a).toBe(b);
  });
});

// ─── Der Stapel darf dieselbe Sache nicht zweimal enthalten ─────────────────
// Am 07.09. lief der Morgenlauf zweimal — einmal durch den Takt, einmal von
// Hand — und legte fünf Vorschläge doppelt hin. Der Schlüssel dagegen wird
// genauso gebildet wie der der Warteschlange: aus der Wirkung.

describe('Stapel-Kennung', () => {
  // Dieselbe Regel, deshalb derselbe Test wie für die Warteschlange: die
  // Reihenfolge der Felder darf keinen Unterschied machen.
  it('sieht gleiche Eingaben als gleich an, egal in welcher Reihenfolge', () => {
    const a = schluesselFuer('werkzeug', 'create_task', { title: 'X', priority: 'high' });
    const b = schluesselFuer('werkzeug', 'create_task', { priority: 'high', title: 'X' });
    expect(a).toBe(b);
  });

  it('unterscheidet verschiedene Aufgaben', () => {
    const a = schluesselFuer('werkzeug', 'create_task', { title: 'Rechnung stellen' });
    const b = schluesselFuer('werkzeug', 'create_task', { title: 'Zahlung begleichen' });
    expect(a).not.toBe(b);
  });
});

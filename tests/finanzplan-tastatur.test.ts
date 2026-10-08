// ─── Finanzplanung — Tastatur bei mehreren Blatt-Tabellen auf einer Seite (08.10. abends) ─────────────────────────────
// Befund der Prüfung: Auf dem Blatt „Gesellschaften“ stehen bis zu drei Blatt-Tabellen (MAKE, Töpfe, KD Ventures). Jede hört auf `keydown` am
// Fenster und merkte sich ihre Auswahl — nach je einem Klick in zwei Tabellen wirkte jede Taste in BEIDEN: Entf setzte zwei Handwerte zurück,
// eine Ziffer öffnete zwei Felder und landete still als Handwert in der anderen Tabelle. Regel jetzt (components/os/finanzplan/tastatur.ts):
// höchstens eine aktive Tabelle, die anderen verlieren ihre Auswahl; eine Taste gilt nur der Tabelle mit dem Fokus bzw. — Fokus nirgends — der aktiven.
// Ohne DOM-Testumgebung im Repo spielt der Test zwei Tabellen genau so durch, wie Blatt.tsx die Regel anwendet (Anmelden, Klick = aktivieren,
// Taste am Fenster an JEDE Tabelle), und prüft dazu, dass Blatt.tsx die Regel wirklich nutzt. Erfundene Kennungen, keine Daten.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { blattAnmelden, blattAktivieren, aktivesBlatt, tastenOrt, tasteGilt, blattTaste, type TastenOrt } from '@/components/os/finanzplan/tastatur';
import { FinanzplanKontext, rechne, type PlanKontext } from '@/components/os/finanzplan/daten';
import { BlattSeite } from '@/components/os/finanzplan/Blaetter';
import type { FinanzDaten } from '@/lib/finanzen/rechenkern';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const MONATE = [1, 2, 3, 4];
const ZEILEN = ['a.umsatz', 'a.kosten', 'a.konto'];

/** Eine Blatt-Tabelle im Test — derselbe Zustand, den Blatt.tsx hält (Auswahl, offenes Feld). */
interface Tabelle { id: string; sel: { e: string; m: number } | null; feld: string | null; ab: () => void }
const angelegt: Tabelle[] = [];
function tabelle(id: string): Tabelle {
  const t: Tabelle = { id, sel: null, feld: null, ab: () => {} };
  t.ab = blattAnmelden(id, () => { t.sel = null; });
  angelegt.push(t);
  return t;
}
afterEach(() => { for (const t of angelegt.splice(0)) t.ab(); });

/** Klick in eine Zelle: pointerdown (Erfassung) aktiviert die Tabelle, der Klick beginnt die Eingabe (Auswahl + offenes Feld). */
function klick(t: Tabelle, e: string, m: number) { blattAktivieren(t.id); t.sel = { e, m }; t.feld = ''; }
/** Enter im Feld: übernehmen — das Feld geht zu, der Fokus liegt danach auf der Seite (body). */
function enterImFeld(t: Tabelle) { t.feld = null; }

type Fokus = { auf: 'seite' } | { auf: 'tabelle'; id: string } | { auf: 'knopf'; id?: string } | { auf: 'feld'; id?: string };
/** Eine Taste am Fenster: JEDE Tabelle bekommt sie (wie der window-Hörer in Blatt.tsx) und entscheidet nach der Regel. Rückgabe: was passiert ist. */
function taste(tabellen: Tabelle[], key: string, fokus: Fokus, modifier = false): string[] {
  const wirkung: string[] = [];
  for (const t of tabellen) {
    const ort: TastenOrt = fokus.auf === 'seite' ? tastenOrt(null, { seite: true, inWurzel: false })
      : fokus.auf === 'knopf' ? tastenOrt({ tagName: 'BUTTON' }, { seite: false, inWurzel: fokus.id === t.id })
        : fokus.auf === 'feld' ? tastenOrt({ tagName: 'INPUT' }, { seite: false, inWurzel: fokus.id === t.id })
          : tastenOrt({ tagName: 'DIV' }, { seite: false, inWurzel: fokus.id === t.id });
    if (!t.sel || !tasteGilt({ ort, aktiv: aktivesBlatt() === t.id, gewaehlt: true, offen: t.feld !== null, modifier })) continue;
    const a = blattTaste(key, t.sel, MONATE, ZEILEN);
    if (!a) continue;
    if (a.art === 'zuruecksetzen') wirkung.push(`${t.id}: Handwert ${t.sel.e}:${t.sel.m} zurückgesetzt`);
    else if (a.art === 'bearbeiten') { t.feld = a.start ?? ''; wirkung.push(`${t.id}: Feld ${t.sel.e}:${t.sel.m} offen${a.start ? ` mit „${a.start}“` : ''}`); }
    else if (a.art === 'abwaehlen') { t.sel = null; wirkung.push(`${t.id}: abgewählt`); }
    else { t.sel = { e: a.e, m: a.m }; wirkung.push(`${t.id}: → ${a.e}:${a.m}`); }
  }
  return wirkung;
}

describe('Zwei Blatt-Tabellen auf einer Seite — die Tastatur gehört nur einer', () => {
  it('der Fall aus der Prüfung: Klick + Enter in MAKE, dann in Töpfe — Entf und Ziffer wirken nur in Töpfe', () => {
    const make = tabelle('make'), toepfe = tabelle('toepfe');
    klick(make, 'a.konto', 1); enterImFeld(make);
    expect(make.sel).toEqual({ e: 'a.konto', m: 1 });
    klick(toepfe, 'a.umsatz', 2); enterImFeld(toepfe);
    // Die andere Tabelle hat ihre Auswahl verloren — kein zweiter Rahmen, keine zweite Wirkung.
    expect(make.sel).toBeNull();
    expect(taste([make, toepfe], 'Delete', { auf: 'seite' })).toEqual(['toepfe: Handwert a.umsatz:2 zurückgesetzt']);
    expect(taste([make, toepfe], 'Backspace', { auf: 'seite' })).toEqual(['toepfe: Handwert a.umsatz:2 zurückgesetzt']);
    expect(taste([make, toepfe], '7', { auf: 'seite' })).toEqual(['toepfe: Feld a.umsatz:2 offen mit „7“']);
    // Kein zweites Feld in MAKE, das beim Verlassen still einen Handwert schriebe.
    expect(make.feld).toBeNull();
  });

  it('auch mit (veralteter) Auswahl in beiden: Fokus auf der Seite → nur die aktive; Fokus in einer Tabelle → nur diese', () => {
    const make = tabelle('make'), kdv = tabelle('kdv');
    klick(make, 'a.kosten', 3); enterImFeld(make);
    klick(kdv, 'a.konto', 1); enterImFeld(kdv);
    make.sel = { e: 'a.kosten', m: 3 }; // so, als wäre die Auswahl stehen geblieben
    expect(taste([make, kdv], 'ArrowRight', { auf: 'seite' })).toEqual(['kdv: → a.konto:2']);
    expect(taste([make, kdv], 'Delete', { auf: 'tabelle', id: 'make' })).toEqual(['make: Handwert a.kosten:3 zurückgesetzt']);
    expect(taste([make, kdv], 'Delete', { auf: 'tabelle', id: 'kdv' })).toEqual(['kdv: Handwert a.konto:2 zurückgesetzt']);
    // Fokus in einer dritten Tabelle ohne Auswahl: keine der beiden reagiert.
    const drei = tabelle('drei'); blattAktivieren('drei');
    expect(taste([make, kdv, drei], 'Delete', { auf: 'tabelle', id: 'drei' })).toEqual([]);
  });

  it('Fokus auf einem Knopf oder in einem Eingabefeld: keine Tabelle nimmt die Taste (Enter bleibt beim Knopf)', () => {
    const make = tabelle('make'), toepfe = tabelle('toepfe');
    klick(make, 'a.umsatz', 1); enterImFeld(make);
    for (const f of [{ auf: 'knopf' } as const, { auf: 'knopf', id: 'make' } as const, { auf: 'feld' } as const, { auf: 'feld', id: 'make' } as const]) {
      for (const k of ['Enter', 'Delete', '5', 'ArrowDown']) expect(taste([make, toepfe], k, f), `${k} ${JSON.stringify(f)}`).toEqual([]);
    }
    // Cmd/Strg/Alt gehören dem Browser (Cmd+Z = Rückgängig der Seite).
    expect(taste([make, toepfe], 'Delete', { auf: 'seite' }, true)).toEqual([]);
    // Ein offenes Feld nimmt die Tasten selbst.
    klick(make, 'a.umsatz', 1);
    expect(taste([make, toepfe], 'Delete', { auf: 'seite' })).toEqual([]);
  });

  it('Pfeile, Enter, Esc wirken nur in der aktiven Tabelle; nach Ausbau der aktiven ist keine mehr aktiv', () => {
    const make = tabelle('make'), toepfe = tabelle('toepfe');
    klick(make, 'a.umsatz', 1); enterImFeld(make);
    expect(taste([make, toepfe], 'ArrowDown', { auf: 'seite' })).toEqual(['make: → a.kosten:1']);
    expect(taste([make, toepfe], 'Enter', { auf: 'seite' })).toEqual(['make: Feld a.kosten:1 offen']);
    enterImFeld(make);
    expect(taste([make, toepfe], 'Escape', { auf: 'seite' })).toEqual(['make: abgewählt']);
    klick(make, 'a.umsatz', 1); enterImFeld(make);
    make.ab();
    expect(aktivesBlatt()).toBeNull();
    expect(taste([make, toepfe], 'Delete', { auf: 'seite' })).toEqual([]);
  });

  it('Aktivieren wählt nur die ANDEREN ab, nie die eigene Auswahl; nochmal aktivieren ändert nichts', () => {
    const a = tabelle('a'), b = tabelle('b'), c = tabelle('c');
    a.sel = { e: 'a.umsatz', m: 1 }; b.sel = { e: 'a.umsatz', m: 2 }; c.sel = { e: 'a.umsatz', m: 3 };
    blattAktivieren('b');
    expect([a.sel, b.sel, c.sel]).toEqual([null, { e: 'a.umsatz', m: 2 }, null]);
    a.sel = { e: 'a.umsatz', m: 1 };
    blattAktivieren('b');
    expect(a.sel).toEqual({ e: 'a.umsatz', m: 1 }); // schon aktiv → nichts passiert
    // Abmelden einer anderen Tabelle lässt die aktive aktiv.
    c.ab();
    expect(aktivesBlatt()).toBe('b');
  });
});

describe('Tastenbelegung (blattTaste) — wie bisher', () => {
  const sel = { e: 'a.kosten', m: 2 };
  it('Pfeile bewegen bis zum Rand, Enter bearbeitet, Entf/Rücktaste setzen zurück, Esc wählt ab, Ziffer beginnt eine Eingabe', () => {
    expect(blattTaste('ArrowRight', sel, MONATE, ZEILEN)).toEqual({ art: 'gehe', e: 'a.kosten', m: 3 });
    expect(blattTaste('ArrowLeft', sel, MONATE, ZEILEN)).toEqual({ art: 'gehe', e: 'a.kosten', m: 1 });
    expect(blattTaste('ArrowDown', sel, MONATE, ZEILEN)).toEqual({ art: 'gehe', e: 'a.konto', m: 2 });
    expect(blattTaste('ArrowUp', sel, MONATE, ZEILEN)).toEqual({ art: 'gehe', e: 'a.umsatz', m: 2 });
    expect(blattTaste('ArrowRight', { e: 'a.konto', m: 4 }, MONATE, ZEILEN)).toBeNull();
    expect(blattTaste('ArrowDown', { e: 'a.konto', m: 4 }, MONATE, ZEILEN)).toBeNull();
    expect(blattTaste('ArrowLeft', { e: 'a.umsatz', m: 1 }, MONATE, ZEILEN)).toBeNull();
    expect(blattTaste('ArrowUp', { e: 'a.umsatz', m: 1 }, MONATE, ZEILEN)).toBeNull();
    expect(blattTaste('Enter', sel, MONATE, ZEILEN)).toEqual({ art: 'bearbeiten' });
    expect(blattTaste('Delete', sel, MONATE, ZEILEN)).toEqual({ art: 'zuruecksetzen' });
    expect(blattTaste('Backspace', sel, MONATE, ZEILEN)).toEqual({ art: 'zuruecksetzen' });
    expect(blattTaste('Escape', sel, MONATE, ZEILEN)).toEqual({ art: 'abwaehlen' });
    for (const z of ['0', '9', ',', '.', '-']) expect(blattTaste(z, sel, MONATE, ZEILEN)).toEqual({ art: 'bearbeiten', start: z });
    for (const z of ['a', 'Tab', ' ', 'F5']) expect(blattTaste(z, sel, MONATE, ZEILEN)).toBeNull();
  });
  it('Ort des Fokus: Seite, eigene Tabelle, Bedienelement, anderswo', () => {
    expect(tastenOrt(null, { seite: false, inWurzel: false })).toBe('seite');
    expect(tastenOrt({ tagName: 'BODY' }, { seite: true, inWurzel: false })).toBe('seite');
    expect(tastenOrt({ tagName: 'DIV' }, { seite: false, inWurzel: true })).toBe('eigenes');
    expect(tastenOrt({ tagName: 'TD' }, { seite: false, inWurzel: false })).toBe('anderswo');
    for (const t of ['INPUT', 'select', 'TEXTAREA', 'BUTTON', 'A']) expect(tastenOrt({ tagName: t }, { seite: false, inWurzel: true })).toBe('bedienelement');
    expect(tastenOrt({ tagName: 'DIV', isContentEditable: true }, { seite: false, inWurzel: true })).toBe('bedienelement');
  });
});

describe('Blatt.tsx nutzt die Regel — und „Gesellschaften“ hat wirklich mehrere Blatt-Tabellen', () => {
  it('Anmelden, Aktivieren bei Klick/Fokus, Prüfung je Taste', () => {
    const f = readFileSync(path.resolve(__dirname, '../components/os/finanzplan/Blatt.tsx'), 'utf8');
    expect(f).toContain('blattAnmelden(blattId, () => setSel(null))');
    expect(f).toContain('onPointerDownCapture={aktivieren}');
    expect(f).toContain('onFocusCapture={aktivieren}');
    expect(f).toMatch(/tasteGilt\(\{ ort, aktiv: aktivesBlatt\(\) === blattId/);
    expect(f).toContain('blattTaste(ev.key, sel, planMonate, editZeilen)');
    // Der window-Hörer prüft nicht mehr nur Eingabefelder (die alte Prüfung ließ jede Tabelle reagieren).
    expect(f).not.toContain("['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)");
  });
  it('Gesellschaften (alle Abschnitte offen) zeigt mindestens zwei bearbeitbare Blatt-Tabellen auf einer Seite', () => {
    const d: FinanzDaten = { ...planFix(14000), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1' };
    const kontext: PlanKontext = { d, ...rechne(d), person: 'kevin', verbergen: false, aendere: async () => true, melde: () => {}, geh: () => {}, params: new URLSearchParams() };
    const html = renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: kontext }, h(BlattSeite, { u: 'gesellschaften', alleOffen: true })));
    const mitZellen = html.split('class="ui-tabelle"').slice(1).filter(t => /data-e="[^"]+" data-m="\d+"/.test(t));
    expect(mitZellen.length).toBeGreaterThanOrEqual(2);
  });
});

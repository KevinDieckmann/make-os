// ─── Fulfillment · Prozess-Editor › Fläche — Oberfläche, Kamera, Eingabe (17.10.) ──────────────────────────────────────────────────────────
// Struktur-Wächter ohne Browser: die Fläche hängt Zoom/Schieben NUR an ihr SVG (Rad, Geste, Touch mit passive:false — außerhalb rollt die Seite), Kamera-Rechnung
// (Zoom zum Zeiger, „Alles zeigen“, Raster), serverseitig gerendert: Palette, Leiste (− + Alles zeigen, Zurücksetzen, Raster, Bild), Rahmen/Knoten/Pfeile mit
// Vorleser-Text, Anfasser, Ziele ≥ 44 px, am Handy nur ansehen, „nur ansehen“ ohne Palette; keine React-Zustände je Mausbewegung. Erfundene Daten, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));

import { EditorAnsicht, type EditorDaten } from '@/components/os/fulfillment/editor/ProzessEditor';
import { FLAECHE_PALETTE, paletteTitel } from '@/components/os/fulfillment/editor/Flaeche';
import { exportRahmen, dateiName, EXPORT_MASS } from '@/components/os/fulfillment/editor/flaeche-export';
import { zoomUm, allesZeigen, weltAus, bildAus, einrasten, ZOOM_MIN, ZOOM_MAX, flaecheHinweis } from '@/components/os/ui/flaeche/kamera';
import { flaecheEingabe, FLAECHE_LAUSCHER, FLAECHE_AKTIV } from '@/components/os/ui/flaeche/eingabe';
import { textZeilen } from '@/components/os/ui/reise/flaeche-formen';
import { flaecheBild } from '@/lib/fulfillment/prozesse/flaeche';
import type { ProzessKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';

const WURZEL = path.resolve(__dirname, '..');
const lies = (f: string) => readFileSync(path.join(WURZEL, f), 'utf8');
const J = '2026-10-17T09:00:00.000Z';
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
    { id: 'fk-x', elternId: 'fk-p2', titel: 'Umsetzen', rang: 1 },
  ],
});
const daten = (x: Partial<EditorDaten> = {}): EditorDaten => ({ vorlage: V(), stand: 'st-1', bausteine: [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail' }], darfBearbeiten: true, laufend: 0, ...x });
const html = (x: Partial<EditorDaten> = {}, handy = false) => renderToStaticMarkup(h(EditorAnsicht, { start: daten(x), handy, ansicht: 'flaeche' }));

describe('Kamera (rein): Zoom zum Zeiger, Grenzen, „Alles zeigen“, Raster', () => {
  it('der Punkt unter dem Zeiger bleibt beim Zoomen stehen; Zoom bleibt in seinen Grenzen', () => {
    const k0 = { s: 1, x: 30, y: -20 };
    const w = weltAus(k0, 200, 150);
    const k1 = zoomUm(k0, 1.7, 200, 150);
    const b = bildAus(k1, w[0], w[1]);
    expect(b[0]).toBeCloseTo(200, 6); expect(b[1]).toBeCloseTo(150, 6);
    expect(zoomUm(k0, 1000, 0, 0).s).toBe(ZOOM_MAX);
    expect(zoomUm(k0, 0.0001, 0, 0).s).toBe(ZOOM_MIN);
    expect(zoomUm(k0, NaN, 0, 0)).toEqual(k0);
  });
  it('„Alles zeigen“ setzt den Inhalt mittig mit Rand, höchstens 100 %', () => {
    const k = allesZeigen({ x: 100, y: 50, b: 2000, h: 1000 }, 1000, 600, 40);
    const [x0, y0] = bildAus(k, 100, 50), [x1, y1] = bildAus(k, 2100, 1050);
    expect(x0).toBeGreaterThanOrEqual(39); expect(x1).toBeLessThanOrEqual(961);
    expect(y0).toBeGreaterThanOrEqual(39); expect(y1).toBeLessThanOrEqual(561);
    expect(allesZeigen({ x: 0, y: 0, b: 100, h: 100 }, 1000, 600).s).toBe(1);
  });
  it('Raster: einrasten an/aus; Hinweis nennt ⌘ bzw. Strg und zwei Finger', () => {
    expect(einrasten(29, 20, true)).toBe(20); expect(einrasten(31, 20, true)).toBe(40); expect(einrasten(31.4, 20, false)).toBe(31);
    expect(flaecheHinweis(true, false, true)).toContain('⌘ + Scrollen');
    expect(flaecheHinweis(false, false, false)).toContain('Strg + Scrollen');
    expect(flaecheHinweis(true, true, false)).toContain('Zwei Finger');
  });
});

// ── Eingabe am SVG (ohne Browser: ein nachgebautes Element) ──
function nachbau(o: { frei?: boolean } = {}) {
  const lauscher: { typ: string; fn: (e: unknown) => void; opt?: AddEventListenerOptions }[] = [];
  const el = {
    style: { cursor: '' },
    addEventListener: (typ: string, fn: (e: unknown) => void, opt?: AddEventListenerOptions) => { lauscher.push({ typ, fn, opt }); },
    removeEventListener: (typ: string, fn: (e: unknown) => void) => { const i = lauscher.findIndex(l => l.typ === typ && l.fn === fn); if (i >= 0) lauscher.splice(i, 1); },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 500 }),
    setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), focus: vi.fn(),
  };
  const sende = (typ: string, e: Record<string, unknown> = {}) => {
    const ev = { type: typ, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(), cancelable: true, ...e };
    for (const l of lauscher.filter(x => x.typ === typ)) l.fn(ev);
    return ev;
  };
  let k = { s: 1, x: 0, y: 0 };
  const hinweis = vi.fn();
  let t = 0;
  const eingabe = flaecheEingabe(el as unknown as HTMLElement, { kamera: () => k, setze: n => { k = n; }, freiSchiebt: () => !!o.frei, istFrei: () => true, hinweis, uhr: () => t });
  return { el, lauscher, sende, eingabe, kamera: () => k, hinweis, uhr: (n: number) => { t = n; } };
}

describe('Eingabe: nur an der Fläche — außerhalb rollt die Seite weiter', () => {
  it('jeder Lauscher hängt am Element; Rad, Geste und Touch nie passiv; Abbauen nimmt alle ab', () => {
    const n = nachbau();
    expect(n.lauscher.map(l => l.typ).sort()).toEqual([...FLAECHE_LAUSCHER].sort());
    for (const typ of ['wheel', 'gesturestart', 'gesturechange', 'gestureend', 'touchmove']) {
      expect(FLAECHE_AKTIV).toContain(typ);
      expect(n.lauscher.find(l => l.typ === typ)?.opt).toEqual({ passive: false });
    }
    for (const typ of ['pointerdown', 'pointermove', 'pointerup', 'keydown']) expect(n.lauscher.find(l => l.typ === typ)?.opt).toBeUndefined();
    n.eingabe.abbauen();
    expect(n.lauscher).toHaveLength(0);
  });
  it('Pinch bzw. ⌘ + Rad zoomt zum Zeiger (die Seite zoomt nicht mit); ein Mausrad ohne ⌘ lässt die Seite rollen (+ Hinweis)', () => {
    const n = nachbau();
    const e = n.sende('wheel', { ctrlKey: true, deltaY: -40, deltaMode: 0, clientX: 410, clientY: 270 });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(n.kamera().s).toBeGreaterThan(1);
    const s = n.kamera().s;
    const rad = n.sende('wheel', { deltaY: 120, deltaX: 0, deltaMode: 1 });
    expect(rad.preventDefault).not.toHaveBeenCalled();
    expect(n.hinweis).toHaveBeenCalled();
    expect(n.kamera().s).toBe(s);
  });
  it('zwei Finger am Trackpad verschieben', () => {
    const n = nachbau();
    const e = n.sende('wheel', { deltaY: 3, deltaX: 5, deltaMode: 0 });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(n.kamera()).toMatchObject({ x: -5, y: -3 });
  });
  it('Leertaste + Ziehen verschiebt — und die Ansicht sieht diesen Zeiger nicht (kein Aufziehen, kein Knoten-Ziehen)', () => {
    const n = nachbau();
    n.sende('keydown', { key: ' ' });
    expect(n.eingabe.leertaste()).toBe(true);
    const d = n.sende('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    expect(d.stopPropagation).toHaveBeenCalled();
    n.sende('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 140, clientY: 90 });
    expect(n.kamera()).toMatchObject({ x: 40, y: -10 });
    expect(n.eingabe.schiebt()).toBe(true);
    n.sende('pointerup', { pointerId: 1 });
    n.sende('keyup', { key: ' ' });
    expect(n.eingabe.leertaste()).toBe(false);
    // Ohne Leertaste gehört ein Zug mit der linken Taste der Ansicht (Aufziehen/Ziehen).
    const z = n.sende('pointerdown', { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    expect(z.stopPropagation).not.toHaveBeenCalled();
  });
  it('nur ansehen (freiSchiebt): Ziehen auf freier Fläche verschiebt; zwei Finger zoomen und schieben', () => {
    const n = nachbau({ frei: true });
    n.sende('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
    n.sende('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 120, clientY: 100 });
    expect(n.kamera().x).toBe(20);
    n.sende('pointerup', { pointerId: 1 });
    const m = nachbau();
    m.sende('pointerdown', { pointerId: 5, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 });
    m.sende('pointerdown', { pointerId: 6, pointerType: 'touch', button: 0, clientX: 200, clientY: 100 });
    m.sende('pointermove', { pointerId: 6, pointerType: 'touch', clientX: 300, clientY: 100 });
    expect(m.kamera().s).toBeGreaterThan(1.5);
    const t = m.sende('touchmove', { touches: [{}, {}] });
    expect(t.preventDefault).toHaveBeenCalled();
  });
  it('Quelltext: nie an Fenster oder Dokument; die Fläche hängt die Eingabe an ihr SVG; die Bühne lässt die Seite senkrecht rollen', () => {
    const e = lies('components/os/ui/flaeche/eingabe.ts');
    expect(e).not.toMatch(/(window|document)\.addEventListener/);
    expect(e).toContain('el.addEventListener(typ');
    expect(e).toContain("from '../../kugel/steuerung'"); // dieselbe Rad-/Pinch-Erkennung wie die Kugel
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    expect(f).not.toMatch(/(window|document)\.addEventListener\(\s*['"](wheel|gesture|touch|pointer|key)/);
    expect(f).toContain('flaecheEingabe(el, {');
    expect(f).toContain('requestAnimationFrame');
    expect(lies('app/globals.css')).toMatch(/\.ff-flaeche-buehne \{[^}]*touch-action: pan-y/);
  });
  it('Leistung: keine React-Zustände je Mausbewegung — die Bewegung schreibt direkt ins SVG', () => {
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    const bewegt = f.slice(f.indexOf('const bewegt = '), f.indexOf('/** Markierung „hier landet es“'));
    expect(bewegt.length).toBeGreaterThan(200);
    expect(bewegt).not.toMatch(/(?<![.\w])set[A-Z]\w*\(/);
    const palette = f.slice(f.indexOf('const paletteBewegt = '), f.indexOf('const paletteHoch = '));
    expect(palette).not.toMatch(/(?<![.\w])set[A-Z]\w*\(/);
    const zeichne = f.slice(f.indexOf('const zeichne = '), f.indexOf('const setzeKamera = '));
    expect(zeichne).toContain('requestAnimationFrame');
    expect(zeichne).not.toMatch(/(?<![.\w])set[A-Z]\w*\(/);
  });
  it('Leistung: 300 Knoten rechnen schnell (Bild samt Pfeilwegen)', () => {
    const kn: ProzessKnoten[] = [{ id: 'fk-w', titel: 'Groß', rang: 1 }];
    for (let p = 0; p < 6; p++) {
      kn.push({ id: `fk-p${p}`, elternId: 'fk-w', titel: `Phase ${p}`, rang: p + 1 });
      for (let i = 0; i < 50; i++) kn.push({ id: `fk-p${p}-${i}`, elternId: `fk-p${p}`, titel: `Schritt ${i}`, rang: i + 1, ...(i % 10 === 3 ? { form: 'entscheidung' as const, zweige: { nein: `fk-p${p}-${i + 1}` } } : {}) });
    }
    const v: ProzessVorlage = { ...V(), knoten: kn, freigaben: [] };
    const t0 = performance.now();
    const b = flaecheBild(v);
    expect(b.knoten).toHaveLength(300);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});

describe('Oberfläche (serverseitig gerendert)', () => {
  const s = html();
  it('Umschalter Fluss ↔ Fläche; auf der Fläche keine Reise-Zeile daneben (keine zweite Darstellung)', () => {
    expect(s).toContain('aria-label="Ansicht des Ablaufs"');
    expect(s).toMatch(/aria-checked="true"[^>]*>Fläche</);
    expect(s).not.toContain('class="ff-reise"');
    expect(s).toContain('data-ff-flaeche');
  });
  it('Fläche: SVG mit Vorleser-Text, Rahmen = Phasen, Knoten mit Form + Titel, Pfeile, Anfasser, Größe', () => {
    expect(s).toContain('role="application"');
    expect(s).toContain('aria-label="Fläche des Ablaufs „Testpaket“: 2 Phasen als Rahmen, 5 Schritte');
    expect(s).toContain('PHASE 1');
    expect(s).toContain('PHASE 2 · INTERN');
    expect(s).toContain('aria-label="Termin: Kick-off planen — Phase 1"');
    expect(s).toContain('aria-label="Erinnerung: Erinnern, macht der Kunde — Phase 1, Nein-Zweig"');
    expect(s).toMatch(/data-fl-pfeil="fk-e&gt;fk-r:nein"/);
    expect(s).toContain('data-fl-anfasser="rechts"');
    expect(s).toContain('data-fl-groesse="fk-p1"');
    expect(s).toContain('tabindex="0"');
  });
  it('Leiste: − / + / Alles zeigen / Zurücksetzen / Raster / Bild (PNG, SVG); Palette mit Start · Phase und allen Formen', () => {
    for (const t of ['aria-label="Verkleinern (−)"', 'aria-label="Vergrößern (+)"', 'Alles zeigen', 'Zurücksetzen', 'Raster an', 'Bild (PNG)', '>SVG<']) expect(s, t).toContain(t);
    expect(FLAECHE_PALETTE).toEqual(['phase', 'schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'baustein']);
    expect(s).toContain('aria-label="Palette — auf die Fläche ziehen oder antippen"');
    for (const f of FLAECHE_PALETTE) expect(s, f).toContain(`${paletteTitel(f)} einfügen — oder auf die Fläche ziehen`);
  });
  it('Ziele ≥ 44 px: Palette, Leiste, Anfasser (Trefferkreis r = 22), Größen-Ecke 44 × 44', () => {
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    expect(f).toContain('const knopf: CSSProperties = { minHeight: ZIEL_PX, minWidth: ZIEL_PX }');
    expect(f).toContain('minHeight: ZIEL_PX, padding: \'6px 12px\'');
    expect(f).toContain('<circle data-fl-anfasser={s} r={22}');
    expect(f).toContain('<rect width={44} height={44} fill="transparent" />');
    expect(s).toMatch(/min-height:44px/);
    for (const markup of [s, html({}, true), html({ darfBearbeiten: false })]) {
      for (const k of markup.match(/<(button|select|input)\b[^>]*>/g) ?? []) {
        const hoehe = /min-height:\s*(\d+)px/.exec(k)?.[1] ?? /[^-]height:\s*(\d+)px/.exec(k)?.[1];
        expect(hoehe !== undefined && Number(hoehe) >= 44, k.slice(0, 160)).toBe(true);
      }
    }
  });
  it('am Handy: nur ansehen — keine Palette, keine Anfasser, kein Ziehen; „Liste“ bearbeitet', () => {
    const t = html({}, true);
    expect(t).toContain('Fläche (ansehen)');
    expect(t).toContain('>Liste<');
    expect(t).not.toContain('aria-label="Palette — auf die Fläche ziehen oder antippen"');
    expect(t).not.toContain('data-fl-anfasser');
    expect(t).not.toContain('data-fl-groesse');
    expect(t).toContain('Zwei Finger: zoomen und schieben');
  });
  it('nur ansehen („nur Business“): keine Palette, keine Anfasser — Zoomen und Schieben gehen', () => {
    const t = html({ darfBearbeiten: false });
    expect(t).not.toContain('Palette — auf die Fläche ziehen');
    expect(t).not.toContain('data-fl-anfasser');
    expect(t).toContain('Alles zeigen');
  });
  it('dieselben Formen wie überall: die Fläche zeichnet mit components/os/ui/reise (keine eigene Form im Bereich)', () => {
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    expect(f).toContain("from '../../ui/reise/flaeche-formen'");
    expect(f).not.toMatch(/<polygon/);
    expect(lies('components/os/ui/reise/flaeche-formen.tsx')).not.toMatch(/from '@\/lib\/(fulfillment|crm|planung)/);
  });
});

describe('Als Bild speichern', () => {
  it('Ausschnitt = Inhalt mit Rand, Titelzeile und Legende; Dateiname ohne Umlaute', () => {
    const r = exportRahmen({ x: 0, y: 0, b: 1000, h: 600 });
    expect(r).toEqual({ x: -EXPORT_MASS.rand, y: -EXPORT_MASS.rand - EXPORT_MASS.titel, b: 1000 + 2 * EXPORT_MASS.rand, h: 600 + 2 * EXPORT_MASS.rand + EXPORT_MASS.titel + EXPORT_MASS.legende, inhaltY: 0, legendeY: 600 + EXPORT_MASS.rand });
    expect(dateiName('Begrüßung & Übergabe', 'png')).toBe('begrussung-ubergabe.png');
    expect(dateiName('', 'svg')).toBe('ablauf.svg');
  });
  it('Text in Knoten: Zeilen nach Breite, höchstens zwei, Rest mit „…“', () => {
    expect(textZeilen('Kick-off planen', 200, 15)).toEqual(['Kick-off planen']);
    const z = textZeilen('Ein sehr langer Titel für einen Schritt mit vielen Wörtern darin', 120, 15);
    expect(z).toHaveLength(2);
    expect(z[1].endsWith('…')).toBe(true);
  });
});

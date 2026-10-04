// ─── Lichtfäden v2 — Oberfläche: Render (Server), Brotkrumen, Legende, Engstellen, Zeichner mit/ohne Bewegung ─
// Kein Browser: Bauteile werden serverseitig gezeichnet (fängt Laufzeitfehler, prüft Knöpfe/Rollen/Maße); der Zeichner
// läuft gegen eine Attrappe der Leinwand (zählt Striche, prüft Übergang und „Bewegung reduzieren“).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { baueBaum, ansicht } from '@/lib/lichtfaeden/baum';
import { BEIDE, themaPfad, type Strang } from '@/lib/lichtfaeden/modell';
import type { Engstelle } from '@/lib/lichtfaeden/fokus';
import { faedenband, UEBERGANG_MS, type BandBild } from '@/lib/lichtfaeden/faedenband';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/planung/jahr' }));
const h = (c: unknown, props: unknown) => createElement(c as never, props as never);

const BIZ = themaPfad('business', 'planung');
const st: Strang[] = [
  { id: 'ms:1', quelle: 'meilenstein', titel: 'Neun Mandate', pfad: [...BIZ, 'ziel:z'], person: BEIDE, zeit: { tag: '2026-10-30' }, gewicht: 3, status: 'offen', link: '/os/planung/meilenstein/1' },
  { id: 'a:1', quelle: 'aufgabe', titel: 'Angebot', pfad: [...BIZ, 'ziel:z'], person: BEIDE, zeit: { tag: '2026-10-28' }, gewicht: 1, status: 'offen' },
  { id: 't:1', quelle: 'termin', titel: 'Arzt', pfad: themaPfad('privat', 'gesundheit'), person: 'malin', zeit: { tag: '2026-10-21' }, gewicht: 0.5, status: 'offen' },
];
const baum = baueBaum([{ id: 'ziel:z', art: 'ziel', name: 'Zwölf Mandate', farbe: '#FFC93C', eltern: BIZ.at(-1)!, rang: 1, link: '/os/planung/ziel/z' }], st);
const A = ansicht(baum, { wurzel: 'gesamt', von: '2026-10-01', bis: '2027-03-31', heute: '2026-10-03', person: { art: 'alle' } })!;
const E: Engstelle[] = [{ woche: '2026-10-26', kw: 44, last: 9, ziele: 3, fristen: 9, termine: 4, buendel: 3, text: 'KW 44: 3 Ziele · 9 Fristen · 4 Termine', top: [{ id: 'ms:1', titel: 'Neun Mandate', tag: '2026-10-30', quelle: 'meilenstein', link: '/os/planung/meilenstein/1', buendel: 'space:business', ueberfaellig: false }] }];

describe('Bauteile zeichnen (Server)', () => {
  it('Faedenband: Leinwand aria-hidden, Markierungen als Links, Engstelle als Knopf, Monate und HEUTE', async () => {
    const { Faedenband } = await import('@/components/os/lichtfaeden/Faedenband');
    const html = renderToStaticMarkup(h(Faedenband, { ansicht: A, engstellen: E, uebergang: null, hervor: null, onHervor: () => {}, onTiefer: () => {}, label: 'Lichtfäden Gesamt' }));
    expect(html).toContain('<canvas aria-hidden="true" data-lichtfaeden=""');
    expect(html).toContain('role="group" aria-label="Lichtfäden Gesamt"');
    expect(html).toMatch(/<a[^>]+class="licht-marke"[^>]+href="\/os\/planung\/meilenstein\/1"/);
    expect(html).toContain('aria-label="Engstelle KW 44: 3 Ziele · 9 Fristen · 4 Termine"');
    expect(html).toContain('>Nov<');
  });
  it('Brotkrumen: Ebenen darüber sind Knöpfe (44 px), die aktuelle trägt aria-current; „oben“ kürzt', async () => {
    const { Brotkrumen } = await import('@/components/os/lichtfaeden/Brotkrumen');
    const pfad = [{ id: 'gesamt', art: 'gesamt', name: 'Gesamt', farbe: '#fff', rang: 0 }, { id: 'space:privat', art: 'space', name: 'Privat', farbe: '#3DE28B', rang: 1 }, { id: 'thema:privat:gesundheit', art: 'thema', name: 'Gesundheit', farbe: '#3DE28B', rang: 1 }];
    const html = renderToStaticMarkup(h(Brotkrumen, { pfad, onWahl: () => {} }));
    expect((html.match(/<button/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('min-height:44px');
    expect(html.indexOf('Gesamt')).toBeLessThan(html.indexOf('Privat'));
    const kurz = renderToStaticMarkup(h(Brotkrumen, { pfad, onWahl: () => {}, oben: 'space:privat' }));
    expect(kurz).not.toContain('Gesamt');
  });
  it('Legende: Bündel mit Tiefe = Knopf „eine Ebene tiefer“, Zahl der Stränge, 44 px', async () => {
    const { Legende } = await import('@/components/os/lichtfaeden/Legende');
    const html = renderToStaticMarkup(h(Legende, { buendel: A.buendel, hervor: null, onHervor: () => {}, onTiefer: () => {} }));
    expect(html).toContain('aria-label="Business, 2 Stränge — eine Ebene tiefer"');
    expect(html).toContain('min-height:44px');
  });
  it('Engstellen: Satz als Knopf (aria-expanded), offen zeigt die Stränge als Links', async () => {
    const { Engstellen } = await import('@/components/os/lichtfaeden/Engstellen');
    const zu = renderToStaticMarkup(h(Engstellen, { liste: E, offen: null, onOffen: () => {} }));
    expect(zu).toContain('aria-expanded="false"');
    expect(zu).not.toContain('Neun Mandate');
    const auf = renderToStaticMarkup(h(Engstellen, { liste: E, offen: '2026-10-26', onOffen: () => {} }));
    expect(auf).toContain('href="/os/planung/meilenstein/1"');
    expect(auf).toContain('Neun Mandate');
  });
  it('Lichtfäden-Karte: Platzhalter beim Laden (aria-busy), Zeitraum-Wahl und „Heute“', async () => {
    const { Lichtfaeden } = await import('@/components/os/lichtfaeden/Lichtfaeden');
    const html = renderToStaticMarkup(h(Lichtfaeden, { wurzel: 'gesamt' }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Bis Ende nächsten Jahres');
    expect(html).toContain('Heute');
  });
});

// ── Zeichner gegen eine Attrappe ─────────────────────────────────────────────
function attrappe() {
  let striche = 0;
  const ctx = new Proxy({}, { get: (_, k) => (k === 'stroke' ? () => { striche++; } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: () => {} }) : () => {}), set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, striche: () => striche };
}
function uhr() {
  const warte: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} rect() {} arc() {} });
  return (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); };
}
const BILD: BandBild = {
  breite: 600, hoehe: 260, bandOben: 40, bandHoehe: 150, wochenVersatz: 3, tage: 182,
  buendel: A.buendel.map(b => ({ id: b.id, farbe: b.farbe, dichte: b.dichte, faeden: b.faeden })),
  heuteX: 10, heuteFarbe: '#4FC3F7', verbinder: [], engstellen: [{ x0: 100, x1: 123 }], engstelleFarbe: '#FFC93C', hervor: null, handy: false,
};

describe('Zeichner', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('mit Bewegung: Aufklappen läuft ~0,7 s (Fortschritt 0 → 1), danach normal; Treffer findet ein Bündel', () => {
    const tick = uhr();
    const a = attrappe();
    const z = faedenband(a.canvas, null as unknown as Element, false);
    z.setze(BILD);
    tick(1000);
    expect(a.striche()).toBeGreaterThan(0);
    z.setze(BILD, { richtung: 'auf', fokus: BILD.buendel[0].id, oben: BILD.buendel, unten: BILD.buendel });
    tick(1100); tick(1100 + UEBERGANG_MS / 2);
    const mitte = z.fortschritt();
    expect(mitte).toBeGreaterThan(0.3); expect(mitte).toBeLessThan(0.7);
    tick(1100 + UEBERGANG_MS + 20);
    expect(z.fortschritt()).toBeNull();
    const y = Array.from({ length: 150 }, (_, i) => 40 + i).find(yy => z.treffer(300, yy));
    expect(y).toBeDefined();
    expect(z.treffer(300, 5)).toBeNull(); // über dem Band
    z.stop();
  });
  it('Bewegung reduziert: Standbild, kein Übergang, keine Eigenbewegung', () => {
    const tick = uhr();
    const a = attrappe();
    const z = faedenband(a.canvas, null as unknown as Element, true);
    z.setze(BILD, { richtung: 'auf', fokus: BILD.buendel[0].id, oben: BILD.buendel, unten: BILD.buendel });
    tick(1000);
    const nachEins = a.striche();
    expect(nachEins).toBeGreaterThan(0);
    expect(z.fortschritt()).toBeNull();
    tick(2000); tick(3000);
    expect(a.striche()).toBe(nachEins); // nichts nachgezeichnet
    expect(z.lauf.messung().bilder).toBe(1);
    z.stop();
  });
});

describe('Ein Zeichner, keine Doppelungen', () => {
  it('die v1-Dateien sind ersetzt und niemand importiert sie mehr', () => {
    const w = path.resolve(__dirname, '..');
    for (const f of ['components/os/HorizontView.tsx', 'components/os/Zeitstrahl.tsx', 'components/os/lichtfaeden/Faedenband.tsx']) {
      const t = readFileSync(path.join(w, f), 'utf8');
      expect(t).not.toMatch(/lichtfaeden\/(dichte|farben|zeitband)'|LichtBand/);
    }
  });
});

describe('Übergang, „heute“ und Messpunkt (Review 03.10.)', () => {
  const w = path.resolve(__dirname, '..');
  const lies = (f: string) => readFileSync(path.join(w, f), 'utf8');
  it('der Übergang hängt am Anfrage-Schlüssel (Ebene|Person|Zeitraum) — Person/Zeitraum-Wechsel spielen ihn nicht erneut', async () => {
    const { lichtSchluessel } = await import('@/components/os/lichtfaeden/useLichtfaeden');
    const o = { wurzel: 'ziel:z', person: 'alle', von: '2026-01-01', bis: '2026-12-31' };
    expect(lichtSchluessel(o)).toBe('ziel:z|alle|2026-01-01|2026-12-31');
    expect(lichtSchluessel({ ...o, person: 'ich' })).not.toBe(lichtSchluessel(o));
    expect(lichtSchluessel({ ...o, von: '2026-02-01' })).not.toBe(lichtSchluessel(o));
    const huelle = lies('components/os/lichtfaeden/Lichtfaeden.tsx');
    expect(huelle).not.toMatch(/useRef<FaedenUebergang/); // kein Ref, der im Render gelesen wird
    expect(huelle).toMatch(/useState<FaedenUebergang \| null>/);
    expect(huelle).toMatch(/onUebergangAngewandt=\{\(\) => setUebergang\(null\)\}/);
    expect(huelle).toMatch(/useEffect\(\(\) => \{ setUebergang\(null\); \}, \[person, von, bis\]\)/);
    const band = lies('components/os/lichtfaeden/Faedenband.tsx');
    expect(band).toContain('uebergang.fuer === schluessel');
    expect(band).not.toContain('uebergang.fuer === ansicht.wurzel.id');
  });
  it('„heute“ kommt vom Server, nicht aus der Uhr des Browsers', () => {
    const huelle = lies('components/os/lichtfaeden/Lichtfaeden.tsx');
    expect(huelle).not.toMatch(/tag\(new Date\(\)\)|const tag = \(d: Date\)/);
    expect(huelle).toContain('daten?.heute');
  });
  it('der 250-ms-Messpunkt läuft nur außerhalb der Produktion oder mit data-messen', () => {
    const band = lies('components/os/lichtfaeden/Faedenband.tsx');
    expect(band).toMatch(/const messen = process\.env\.NODE_ENV !== 'production' \|\| !!c\.closest\('\[data-messen\]'\)/);
    expect(band).toMatch(/const messe = messen \? window\.setInterval/);
  });
});

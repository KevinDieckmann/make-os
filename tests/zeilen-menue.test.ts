// ─── Zeilen-Aktionen: „⋯“ in eigener Spalte, ein Menü, Wischen nach Einstellung (10.10., DESIGN_STANDARD.md › Zeilen-Aktionen) ─────
// Kevin 10.10. (Bildschirmfoto Mandate): Archivieren/Löschen lagen beim Überfahren als Knöpfe ÜBER dem Inhalt. „Löschen und Archivieren muss
// anders laufen — z. B. nach links wischen oder rechts mit drei Punkten und Einstellungen … Bau den Standard überall mit ein.“
// Der Wächter hält fest: nichts liegt über dem Inhalt (eigene Spalte, keine Rand-Knöpfe), „⋯“ ist ein Menü-Knopf (aria-haspopup, 44 px),
// das Menü hat eine feste Reihenfolge (Allgemeines · Liste · ─ · Archiv/Löschen), ohne Recht gibt es nichts, die Wisch-Richtungen kommen aus
// der Einstellung des Geräts, und die Einstellungen sind unter Einstellungen › Bedienung zu finden. Keine echten Daten.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BEDIENUNG_VORGABE, BEDIENUNG_MERKER, bedienungLesen, bedienungSchreiben, bedienungSaeubern, wischZiel, wischSchwelle, wischVersatz, wischScharf,
  internerWeg, WISCH_WAHLEN, MENUE_GRUPPEN, type Bedienung,
} from '@/lib/make-one/bedienung';
import { EINSTELLUNGEN_GRUPPEN } from '@/lib/make-one/einstellungen';
import { SEITEN_SUCHE } from '@/lib/make-one/seiten';
import { WEG } from '@/lib/wege';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

/** Ein Speicher wie localStorage, nur im Test. */
function speicher(start: Record<string, string> = {}) {
  const m = new Map(Object.entries(start));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
}

// ── 1 · Einstellungen je Gerät (rein) ───────────────────────────────────────────────────────────────────────────────
describe('Bedienung: Einstellungen je Gerät', () => {
  it('Vorgabe: links Archivieren, rechts Löschen, ohne Rückfrage (mit Rückgängig), „⋯“ nur beim Überfahren, normal, ohne Vibrieren', () => {
    expect(BEDIENUNG_VORGABE).toEqual({ wischenLinks: 'archivieren', wischenRechts: 'loeschen', loeschenNachfragen: false, mehrImmer: false, dichte: 'normal', haptik: false });
    expect(WISCH_WAHLEN.map(w => w.label)).toEqual(['Archivieren', 'Löschen', 'Aktionen zeigen', 'Aus']);
  });
  it('leer, gesperrt oder kaputt → Vorgabe; Unsinn fällt einzeln zurück', () => {
    expect(bedienungLesen(speicher())).toEqual(BEDIENUNG_VORGABE);
    expect(bedienungLesen(null)).toEqual(BEDIENUNG_VORGABE);
    expect(bedienungLesen(speicher({ [BEDIENUNG_MERKER]: '{kaputt' }))).toEqual(BEDIENUNG_VORGABE);
    expect(bedienungLesen({ getItem: () => { throw new Error('gesperrt'); } })).toEqual(BEDIENUNG_VORGABE);
    expect(bedienungSaeubern({ wischenLinks: 'sprengen', wischenRechts: 'aus', dichte: 'riesig', haptik: 'ja' })).toEqual({ ...BEDIENUNG_VORGABE, wischenRechts: 'aus' });
  });
  it('schreibt nur Abweichungen; alles Vorgabe → Merker weg; Speicher-Fehler → false', () => {
    const s = speicher();
    const b: Bedienung = { ...BEDIENUNG_VORGABE, wischenRechts: 'aktionen', loeschenNachfragen: true };
    expect(bedienungSchreiben(b, s)).toBe(true);
    expect(JSON.parse(s.m.get(BEDIENUNG_MERKER)!)).toEqual({ wischenRechts: 'aktionen', loeschenNachfragen: true });
    expect(bedienungLesen(s)).toEqual(b);
    expect(bedienungSchreiben({ ...BEDIENUNG_VORGABE }, s)).toBe(true);
    expect(s.m.has(BEDIENUNG_MERKER)).toBe(false);
    expect(bedienungSchreiben(b, { setItem: () => { throw new Error('voll'); }, removeItem: () => {} })).toBe(false);
  });
});

// ── 2 · Wischen (rein) ──────────────────────────────────────────────────────────────────────────────────────────────
describe('Wischen: Richtung aus der Einstellung, nur mit Aktion, ab der Schwelle', () => {
  const alle = { archivieren: true, loeschen: true, menue: true };
  it('Vorgabe: links = Archivieren, rechts = Löschen', () => {
    expect(wischZiel('links', BEDIENUNG_VORGABE, alle)).toBe('archivieren');
    expect(wischZiel('rechts', BEDIENUNG_VORGABE, alle)).toBe('loeschen');
  });
  it('umgestellt, „Aktionen zeigen“ und „aus“', () => {
    const b = { wischenLinks: 'loeschen' as const, wischenRechts: 'aktionen' as const };
    expect(wischZiel('links', b, alle)).toBe('loeschen');
    expect(wischZiel('rechts', b, alle)).toBe('aktionen');
    expect(wischZiel('links', { wischenLinks: 'aus', wischenRechts: 'aus' }, alle)).toBeNull();
  });
  it('ohne Archivieren/Löschen in der Liste gibt es in diese Richtung kein Wischen', () => {
    expect(wischZiel('links', BEDIENUNG_VORGABE, { archivieren: false, loeschen: true, menue: true })).toBeNull();
    expect(wischZiel('rechts', BEDIENUNG_VORGABE, { archivieren: true, loeschen: false, menue: true })).toBeNull();
  });
  it('Schwelle ≈ ein Drittel der Zeile (72–140 px), darunter schnappt sie zurück; darüber zäh', () => {
    expect(wischSchwelle(340)).toBe(109);
    expect(wischSchwelle(100)).toBe(72);
    expect(wischSchwelle(2000)).toBe(140);
    expect(wischScharf(-108, 109)).toBe(false);
    expect(wischScharf(-109, 109)).toBe(true);
    expect(wischVersatz(-50, 100)).toBe(-50);
    expect(wischVersatz(225, 100)).toBeCloseTo(125 + 100 * 0.3);
  });
});

// ── 3 · Das Menü ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Menü „⋯“: feste Reihenfolge, Gefahr unten, ohne Recht nichts', () => {
  const nichts = () => {};
  it('Allgemeines · Einträge der Liste · Archiv · Löschen (unten, Achtung-Farbe)', async () => {
    const { zeilenMenueEintraege } = await import('@/components/os/ui');
    const l = zeilenMenueEintraege({
      titel: 'Kickoff', href: WEG.mandat('m-1'), onOeffnen: nichts, onArchivieren: nichts, onLoeschen: nichts, kopieren: nichts,
      mehr: [{ id: 'firma', label: 'Firma öffnen', tun: nichts }, { id: 'verschieben', label: 'Verschieben nach', auswahl: { titel: 'x', eintraege: [], waehlen: nichts } }],
    });
    expect(l.map(e => e.id)).toEqual(['oeffnen', 'link', 'tab', 'firma', 'verschieben', 'archiv', 'loeschen']);
    expect(l.map(e => e.gruppe)).toEqual(['allgemein', 'allgemein', 'allgemein', 'mehr', 'mehr', 'ablage', 'ablage']);
    expect(MENUE_GRUPPEN).toEqual(['allgemein', 'mehr', 'ablage']);
    expect(l.at(-1)).toMatchObject({ label: 'Löschen', gefahr: true });
    expect(l.filter(e => e.gefahr).map(e => e.id)).toEqual(['loeschen']);
    // Öffnen nimmt die eigene Funktion (Seitenfenster) — In neuem Tab den Weg.
    expect(l[0].tun).toBe(nichts);
    expect(l.find(e => e.id === 'tab')).toMatchObject({ href: '/os/mandate?k=m-1', neuerTab: true });
  });
  it('ohne Recht keine Einträge; ohne Aktion und Weg auch nicht; fremde Adressen nie', async () => {
    const { zeilenMenueEintraege } = await import('@/components/os/ui');
    expect(zeilenMenueEintraege({ titel: 'X', darf: false, href: '/os/x', onLoeschen: nichts, mehr: [{ id: 'a', label: 'A', tun: nichts }] })).toEqual([]);
    expect(zeilenMenueEintraege({ titel: 'X' })).toEqual([]);
    expect(zeilenMenueEintraege({ titel: 'X', href: 'https://example.invalid/os', kopieren: nichts })).toEqual([]);
    expect(internerWeg('/os/aufgaben?offen=a')).toBe(true);
    expect(internerWeg('//boese.example')).toBe(false);
    expect(internerWeg('/api/x')).toBe(false);
    expect(internerWeg('javascript:alert(1)')).toBe(false);
  });
  it('Einträge ohne Wirkung fallen weg, doppelte Kennungen auch; deaktiviert bleibt sichtbar mit Grund', async () => {
    const { zeilenMenueEintraege } = await import('@/components/os/ui');
    const l = zeilenMenueEintraege({ titel: 'X', mehr: [{ id: 'leer', label: 'Leer' }, { id: 'a', label: 'A', tun: nichts }, { id: 'a', label: 'A2', tun: nichts }, { id: 'b', label: 'B', tun: nichts, deaktiviert: true, grund: 'erst speichern' }] });
    expect(l.map(e => e.label)).toEqual(['A', 'B']);
    expect(l[1]).toMatchObject({ deaktiviert: true, grund: 'erst speichern' });
  });
  it('Render: Rollen menuitem, Trenner vor jeder neuen Gruppe, Löschen ganz unten, neuer Tab mit noopener', async () => {
    const { MenueListe, zeilenMenueEintraege } = await import('@/components/os/ui');
    const l = zeilenMenueEintraege({ titel: 'X', href: '/os/planung/ziel/z-1', onArchivieren: nichts, onLoeschen: nichts, kopieren: nichts, mehr: [{ id: 'umbenennen', label: 'Umbenennen', tun: nichts }] });
    const html = renderToStaticMarkup(h(MenueListe, { eintraege: l, onWahl: nichts }));
    expect(html.match(/role="menuitem"/g)).toHaveLength(6);
    expect(html.match(/role="separator"/g)).toHaveLength(2);
    const reihe = Array.from(html.matchAll(/data-menue-punkt="([^"]+)"/g)).map(m => m[1]);
    expect(reihe).toEqual(['oeffnen', 'link', 'tab', 'umbenennen', 'archiv', 'loeschen']);
    expect(html).toMatch(/target="_blank" rel="noopener noreferrer"/);
    expect(html.lastIndexOf('Löschen')).toBeGreaterThan(html.lastIndexOf('Archivieren'));
  });
});

// ── 4 · Der Baustein ────────────────────────────────────────────────────────────────────────────────────────────────
describe('ZeileAktionen: „⋯“ in eigener Spalte, nie über dem Inhalt', () => {
  it('Menü-Knopf mit aria-haspopup, Beschriftung, eigene Spalte; nur ein Weg (href) reicht für ein Menü', async () => {
    const { ZeileAktionen } = await import('@/components/os/ui');
    const html = renderToStaticMarkup(h(ZeileAktionen, { titel: 'Probe', href: '/os/mandate?k=m-1' }, h('span', null, 'Zeile')));
    expect(html).toMatch(/<div class="ui-za-kern"><span>Zeile<\/span><\/div><div class="ui-za-spalte"><button[^>]*class="ui-za-mehr fassbar"[^>]*aria-haspopup="menu"/);
    expect(html).toContain('aria-label="Aktionen für „Probe“"');
  });
  it('ohne Recht nur die Zeile — kein „⋯“, kein Wischen', async () => {
    const { ZeileAktionen } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(ZeileAktionen, { titel: 'X', darf: false, href: '/os/x', onLoeschen: () => {} }, h('i', null, 'z')))).toBe('<i>z</i>');
  });
  it('Quelle: Wisch-Richtung aus der Einstellung, Pointer ohne Maus, kein Rand-Knopf, Rückfrage nur nach Einstellung', () => {
    const q = lies('components/os/ui/zeile-aktionen.tsx');
    expect(q).toContain("wischZiel(dx < 0 ? 'links' : 'rechts', b, kann)");
    expect(q).toContain("e.pointerType === 'mouse'");
    expect(q).toContain('b.loeschenNachfragen && !loeschenFragt');
    expect(q).not.toMatch(/ui-za-schnell|ui-za-knopf|offeneZeile/);
    expect(q).toMatch(/aria-haspopup="menu"/);
  });
  it('CSS: Spalte 44 px, Knopf 44 × 44, sichtbar bei Hover/Fokus/Touch/Einstellung, Trenner unter der ganzen Zeile, keine Sonderregel fürs Aufgaben-Menü', () => {
    const css = lies('app/globals.css');
    expect(css).toContain('.ui-za-spalte { flex: 0 0 44px; width: 44px;');
    expect(css).toMatch(/\.ui-za-mehr \{ width: 44px; height: 44px; min-height: 44px;/);
    expect(css).toContain('.ui-za:hover .ui-za-mehr, .ui-za:focus-within .ui-za-mehr, .ui-za-mehr[aria-expanded="true"], :root[data-za-mehr="immer"] .ui-za-mehr { opacity: 1; }');
    expect(css).toContain(':root[data-dichte="kompakt"] .ui-zeile { min-height: 44px;');
    expect(css).not.toMatch(/ui-za-schnell|aufgaben-zeilenmenue/);
    // Nichts am rechten Rand ÜBER dem Inhalt: weder absolute Rand-Knöpfe noch ein z-index im Baustein.
    const block = css.slice(css.indexOf('/* ─── Zeilen-Aktionen'), css.indexOf('.ui-rueckgaengig {'));
    expect(block).not.toMatch(/\.ui-za-(mehr|spalte)[^{]*\{[^}]*position: absolute/);
  });
});

// ── 5 · Überall: Aufgaben, Einstellungen, Rahmen ───────────────────────────────────────────────────────────────────
describe('Standard überall', () => {
  it('Aufgaben: EINE Menü-Mechanik — das eigene ZeilenMenue ist aufgegangen, Umwandeln/Verschieben stehen als `mehr`', () => {
    expect(existsSync(path.join(wurzel, 'components/os/aufgaben/ZeilenMenue.tsx'))).toBe(false);
    const b = lies('components/os/aufgaben/BaumAnsicht.tsx');
    expect(b).toContain('mehr={aufgabenMenue(t, tiefe)}');
    expect(b).toContain('mehr={!p.fremd ? listenMenue(p, l) : undefined}');
    expect(b).not.toMatch(/<ZeilenMenue\b/);
  });
  it('wichtige Listen tragen einen Weg (Öffnen · Link kopieren · neuer Tab)', () => {
    const muss: [string, string][] = [
      ['components/os/crm/Kunden.tsx', 'href={WEG.mandat(m.id)}'],
      ['components/os/crm/Kartei.tsx', 'href={WEG.akte(x.id)}'],
      ['components/os/crm/Firmen.tsx', 'href={WEG.firma(x.id)}'],
      ['components/os/crm/Pipeline.tsx', 'href={WEG.deal(c.id)}'],
      ['components/os/crm/angebot/Liste.tsx', 'href={WEG.angebot({ angebotId: a.id })}'],
      ['components/os/planung/ZieleMeilensteine.tsx', 'href={WEG.ziel(z.id)}'],
      ['components/os/planung/ZieleMeilensteine.tsx', 'href={WEG.meilenstein(m.id)}'],
      ['components/os/bauplan/BauplanBoard.tsx', 'href={WEG.bauplan(k.id)}'],
      ['components/os/aufgaben/BaumAnsicht.tsx', 'href={WEG.aufgabe(t.id)}'],
    ];
    for (const [d, t] of muss) expect(lies(d), d).toContain(t);
  });
  it('Routinen und Einkaufsliste: kein ✕ mehr in der Zeile — Löschen über den Baustein mit Rückgängig', () => {
    const r = lies('components/os/RoutinenPlanerView.tsx');
    expect(r).not.toContain('aria-label="Routine löschen"');
    expect(r).toMatch(/<ZeileAktionen key=\{r\.id\} titel=\{r\.label\} onLoeschen=\{\(\) => routineLoeschen\(r\)\}/);
    const e = lies('components/os/ErnaehrungView.tsx');
    expect(e).not.toContain('aria-label="Posten entfernen"');
    expect(e).toContain('onLoeschen={() => postenWeg(p)}');
  });
  it('Einstellungen › Bedienung: Gruppe, Seite, Schnellsuche, Rahmen setzt die Merkmale', () => {
    const g = EINSTELLUNGEN_GRUPPEN.find(x => x.id === 'bedienung');
    expect(g?.eintraege.map(e => e.href)).toEqual([WEG.bedienung()]);
    expect(SEITEN_SUCHE.some(s => s.href === WEG.bedienung())).toBe(true);
    expect(existsSync(path.join(wurzel, 'app/os/system/bedienung/page.tsx'))).toBe(true);
    expect(lies('app/os/layout.tsx')).toContain('<BedienungAnwenden />');
    const v = lies('components/os/BedienungView.tsx');
    for (const t of ['Nach links wischen', 'Nach rechts wischen', 'Vor dem Löschen nachfragen', '„⋯“ immer sichtbar', 'Dichte', 'Kurz vibrieren beim Wischen']) expect(v).toContain(t);
  });
  it('DESIGN_STANDARD.md beschreibt den Standard', () => {
    const md = lies('DESIGN_STANDARD.md');
    expect(md).toContain('## Zeilen-Aktionen (10.10.)');
    expect(md).toContain('Einstellungen › Bedienung');
  });
});

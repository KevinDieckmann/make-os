// ─── Fulfillment · Prozess-Editor — Oberfläche (17.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Struktur-Wächter (ohne Browser, serverseitig gerendert): Reise-Zeile mit Phasen, Rauten-Schaltern und „+ Phase“; Palette mit allen sechs Formen; der
// Fluss mit Ablage-Stellen; Rückgängig/Wiederholen; Tastatur-Alternativen (Alt+Pfeile, Entf, Enter, „Einfügen nach …“, Verschieben); jedes Bedienziel ≥ 44 px;
// am Handy eine Liste mit Pfeilen statt Ziehen; „nur ansehen“ ohne Palette und Ziehen; dieselbe Knoten-Zeichnung wie die Ansicht (kein zweites Bauteil);
// Erfundene Daten, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));

import { EditorAnsicht, PALETTE, type EditorDaten } from '@/components/os/fulfillment/editor/ProzessEditor';
import { MAUS_AB_PX, LANG_MS } from '@/components/os/fulfillment/editor/ziehen';
import { editorSpalten } from '@/components/os/fulfillment/editor/bild';
import { SchrittFeld } from '@/components/os/fulfillment/editor/SeitenFeld';
import { editorModell } from '@/lib/fulfillment/prozesse/editor';
import { fulfillmentLink, fulfillmentAusAdresse } from '@/lib/fulfillment/adresse';
import type { ProzessVorlage } from '@/lib/fulfillment/typen';

const WURZEL = path.resolve(__dirname, '..');
const quelle = (f: string) => readFileSync(path.join(WURZEL, f), 'utf8');
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
    { id: 'fk-g', elternId: 'fk-p2', titel: 'Skripte', rang: 1 },
    { id: 'fk-g1', elternId: 'fk-g', titel: 'Leitfaden', rang: 1 },
  ],
});
const daten = (x: Partial<EditorDaten> = {}): EditorDaten => ({ vorlage: V(), stand: 'st-1', bausteine: [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail' }], darfBearbeiten: true, laufend: 2, ...x });
const html = (x: Partial<EditorDaten> = {}, handy = false) => renderToStaticMarkup(h(EditorAnsicht, { start: daten(x), handy }));

describe('Rechner: Reise, Palette, Fluss, Seitenfeld', () => {
  const s = html();
  it('Reise-Zeile mit den Phasen, Rauten-Schalter zwischen JEDER Phase (auch hinter der letzten), „+ Phase“', () => {
    expect(s).toContain('class="ff-reise"');
    expect(s).toContain('Auftakt');
    expect(s).toContain('Umsetzung');
    expect(s).toContain('Abstimmungspunkt am Ende von „Auftakt“ — bearbeiten');
    expect(s).toContain('Abstimmungspunkt am Ende von „Umsetzung“ einfügen');
    expect(s).toMatch(/data-ff-ziel="phase"/);
    expect(s).toContain('>Phase</span>');
  });
  it('Palette: Schritt · Nachricht · Entscheidung · Erinnerung · Termin · Baustein — ziehen oder antippen', () => {
    expect(PALETTE).toEqual(['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'baustein']);
    expect(s).toContain('role="toolbar" aria-label="Palette — ziehen oder antippen"');
    for (const t of ['Schritt einfügen', 'Nachricht einfügen', 'Entscheidung einfügen', 'Erinnerung einfügen', 'Termin einfügen', 'Baustein einfügen']) expect(s, t).toContain(t);
  });
  it('Fluss: Start, Ablage-Stellen, Entscheidung mit Nein-Zweig daneben (nicht doppelt), Abstimmungspunkt am Ende, Ende', () => {
    expect(s).toContain('Ablauf der Phase 1: Auftakt — bearbeiten');
    for (const z of ['anfang', 'schritt', 'ende']) expect(s, z).toContain(`data-ff-ziel="${z}"`);
    expect((s.match(/data-ff-knoten="fk-r"/g) ?? []).length).toBe(1);
    expect(s).toContain('Entscheidung: Unterlagen da?');
    expect(s).toContain('Abstimmungspunkt 1 · Rahmen bestätigt');
    expect(s).toContain('Phase 2 · Umsetzung ›');
    expect(s).toContain('Frist 2 Tage');
    expect(s).toContain('data-formen-legende');
  });
  it('Knoten tragen Tastatur-Alternativen; Rückgängig/Wiederholen mit Kürzel; ohne Auswahl ein Satz', () => {
    expect(s).toContain('aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Delete Enter"');
    expect(s).toContain('aria-keyshortcuts="ArrowLeft ArrowRight Alt+ArrowLeft Alt+ArrowRight Delete Enter"');
    expect(s).toContain('aria-label="Rückgängig (⌘Z)"');
    expect(s).toContain('aria-label="Wiederholen (⇧⌘Z)"');
    // Ohne gewählten Knoten steht das Feld der Phase da (Titel, Sichtbarkeit, Abstimmungspunkt am Ende).
    expect(s).toContain('Der Kunde sieht diese Phase');
    expect(s).toContain('Abstimmungspunkt am Ende der Phase');
    expect(s).toContain('Änderungen gelten für neue Fälle — die 2 laufenden Fälle zeigen „Vorlage geändert“');
  });
  it('jedes Bedienziel ist mindestens 44 px hoch', () => {
    for (const markup of [s, html({}, true), renderToStaticMarkup(h(EditorAnsicht, { start: daten() }))]) {
      const knoepfe = markup.match(/<(button|select|input)\b[^>]*>/g) ?? [];
      expect(knoepfe.length).toBeGreaterThan(10);
      for (const k of knoepfe) {
        const hoehe = /min-height:\s*(\d+)px/.exec(k)?.[1] ?? /[^-]height:\s*(\d+)px/.exec(k)?.[1];
        const klasse = /class="([^"]*)"/.exec(k)?.[1] ?? '';
        const ok = (hoehe !== undefined && Number(hoehe) >= 44) || /ui-schalter|treffer44|ui-erklaer/.test(klasse);
        expect(ok, k.slice(0, 160)).toBe(true);
      }
    }
  });
});

describe('Seitenfeld eines Schritts: Titel, Art, Frist, Verantwortung, Sichtbarkeit, Bausteine, Zweige, Tastatur-Alternativen', () => {
  it('rendert alle Felder und die Alternativen zum Ziehen', () => {
    const m = editorModell(V(), [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail' }]);
    const api = { darf: true, laeuft: false, tun: async () => true, einfuegen: () => {}, schritt: () => {}, loeschen: () => {}, phaseSchieben: () => {}, phaseNeu: () => {}, bausteine: [{ id: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail' }], neueId: () => 'fk-x', mehr: () => {} };
    const e = m.phasen[0].abschnitte[0].knoten.find(x => x.id === 'fk-e')!;
    const r = m.phasen[0].abschnitte[0].knoten.find(x => x.id === 'fk-r')!;
    const se = renderToStaticMarkup(h(SchrittFeld, { modell: m, phase: m.phasen[0], k: e, api }));
    for (const t of ['Titel', 'Art', 'Verantwortung', 'Für den Kunden sichtbar', 'Ja führt zu', 'Nein führt zu', 'Nach oben', 'Nach unten', 'Einfügen nach …', 'Verschieben nach Phase …', 'Löschen', '+ Baustein verknüpfen …']) expect(se, t).toContain(t);
    expect(se).toContain('role="radio" aria-checked="true"');
    const sr = renderToStaticMarkup(h(SchrittFeld, { modell: m, phase: m.phasen[0], k: r, api }));
    expect(sr).toContain('zurück zu „Unterlagen da?“');
    for (const markup of [se, sr]) {
      for (const k of markup.match(/<(button|select|input)\b[^>]*>/g) ?? []) {
        const hoehe = /min-height:\s*(\d+)px/.exec(k)?.[1];
        expect((hoehe !== undefined && Number(hoehe) >= 44) || /ui-schalter|treffer44|ui-erklaer/.test(k), k.slice(0, 160)).toBe(true);
      }
    }
    const src = quelle('components/os/fulfillment/editor/SeitenFeld.tsx');
    for (const t of ['Titel', 'Art', 'Frist (Tage nach dem Schritt davor)', 'Verantwortung', 'Für den Kunden sichtbar', 'Bausteine aus der Bibliothek', 'Ja führt zu', 'Nein führt zu', 'Danach', 'Nach oben', 'Nach unten', 'Einfügen nach …', 'Verschieben nach Phase …', 'Löschen', '2–6 Wörter']) {
      expect(src, t).toContain(t);
    }
  });
});

describe('Bedienung: Maus ab 5 px, Finger 0,45 s, Tastatur für alles', () => {
  it('Schwellen und Tasten', () => {
    expect(MAUS_AB_PX).toBe(5);
    expect(LANG_MS).toBe(450);
    const e = quelle('components/os/fulfillment/editor/ProzessEditor.tsx');
    for (const t of ["e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')", "e.key === 'Delete' || e.key === 'Backspace'", "e.key === 'Enter'", "e.key === 'Insert'", "e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')", "e.key === 'Escape'"].slice(0, 5)) expect(e, t).toContain(t);
    expect(quelle('components/os/fulfillment/editor/ziehen.tsx')).toContain("e.key === 'Escape'");
  });
});

describe('Handy: Liste mit Pfeilen statt Ziehen', () => {
  const s = html({}, true);
  it('Phasen und Schritte als Liste mit ▲ ▼, Nein-Zweig eingerückt, „Hinzufügen“ — keine Palette zum Ziehen, keine Reise-Zeile', () => {
    expect(s).toContain('class="ff-editor-liste"');
    expect(s).toContain('aria-label="„Auftakt“ nach oben"');
    expect(s).toContain('aria-label="„Kick-off planen“ nach unten"');
    expect(s).toContain('nein →');
    expect(s).toContain('Hinzufügen');
    expect(s).not.toContain('ff-editor-palette');
    expect(s).not.toContain('class="ff-reise"');
  });
});

describe('Rechte in der Oberfläche', () => {
  it('nur ansehen: keine Palette, kein „+ Phase“, kein Ziehen — ein Satz', () => {
    const s = html({ darfBearbeiten: false });
    expect(s).toContain('Nur ansehen — Abläufe bearbeiten volle Mitglieder.');
    expect(s).not.toContain('ff-editor-palette');
    expect(s).not.toContain('>Phase</span>');
    expect(s).not.toContain('Alt+ArrowUp');
  });
});

describe('Ein Darstellungs-Bauteil für Ansicht und Editor', () => {
  it('der Editor zeichnet Knoten mit `KnotenKnopf` aus Fluss.tsx und die Phasen mit `ReiseBild` — kein eigenes Knoten-Bauteil', () => {
    const f = quelle('components/os/fulfillment/editor/EditorFluss.tsx');
    expect(f).toContain("import { KnotenKnopf, Pfeil, SeitenPfeil } from '../reise/Fluss'");
    expect(quelle('components/os/fulfillment/editor/ProzessEditor.tsx')).toContain("import { ReiseBild, FormZeichen } from '../reise/ReiseBild'");
    expect(quelle('components/os/fulfillment/reise/Fluss.tsx')).toContain('export function KnotenKnopf');
    const sp = editorSpalten(editorModell(V(), []));
    expect(sp[0].kaestchen.map(k => k.titel)).toEqual(['Kick-off planen', 'Unterlagen da?', 'Begrüßung senden']);
    expect(sp[0].raute).toMatchObject({ titel: 'Abstimmungspunkt 1 · Rahmen bestätigt' });
  });
});

describe('Adresse: ?e=<Ablauf> öffnet den Editor (nur unter Landkarte)', () => {
  it('Link und Lesen', () => {
    expect(fulfillmentLink('prozesse', { e: 'fp-abc' })).toBe('/os/mandate/fulfillment?e=fp-abc');
    expect(fulfillmentLink('bausteine', { e: 'fp-abc' })).toBe('/os/mandate/fulfillment?u=bausteine');
    expect(fulfillmentAusAdresse(new URLSearchParams('e=fp-abc')).e).toBe('fp-abc');
    expect(fulfillmentAusAdresse(new URLSearchParams('e=<script>')).e).toBeUndefined();
  });
});

describe('Laufender Fall: „Vorlage geändert — übernehmen?“ mit Vorschau — nichts automatisch', () => {
  it('Hinweis mit Zählern, Satz „nichts geht verloren“, Knopf „Übernehmen“ und „Was sich ändert ›“; auch, wenn sich nur die Reihenfolge ändert', async () => {
    const { VorlageGeaendert } = await import('@/components/os/fulfillment/prozesse/FallUeberblick');
    const daten = { mandat: { id: 'm-1' }, diff: { von: 2, nach: 3, neu: [{ id: 'a', titel: 'Willkommen' }], geaendert: [], entfernt: [], reihenfolge: [{ id: 'p', titel: 'Umsetzung' }] } } as never;
    const s = renderToStaticMarkup(h(VorlageGeaendert, { daten, onMeldung: () => {} }));
    expect(s).toContain('Vorlage geändert — übernehmen? (Fassung 2 → 3)');
    expect(s).toContain('1 neu · neue Reihenfolge in 1');
    expect(s).toContain('nichts geht verloren');
    expect(s).toContain('Was sich ändert ›');
    expect(s).toContain('>Übernehmen<');
    const nurReihe = renderToStaticMarkup(h(VorlageGeaendert, { daten: { mandat: { id: 'm-1' }, diff: { von: 2, nach: 3, neu: [], geaendert: [], entfernt: [], reihenfolge: [{ id: 'p', titel: 'X' }] } } as never, onMeldung: () => {} }));
    expect(nurReihe).toContain('neue Reihenfolge in 1');
    const nichts = renderToStaticMarkup(h(VorlageGeaendert, { daten: { mandat: { id: 'm-1' }, diff: { von: 2, nach: 3, neu: [], geaendert: [], entfernt: [{ id: 'x', titel: 'X' }], reihenfolge: [] } } as never, onMeldung: () => {} }));
    expect(nichts).toBe('');
  });
});

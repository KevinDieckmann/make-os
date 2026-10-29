// Arbeitsfläche (29.10., DESIGN_STANDARD.md › Arbeitsfläche) — Kevin: „die Aufteilung in der Inbox schlecht von der Darstellung her … bei den Kontakten
// auch … das Thema mit Scrolling macht manchmal keinen Sinn.“ Wächter: EIN Baustein, Kopf in einer Zeile, Filter im Popover, Gruppen als Abschnitte
// einer Liste, kein Scrollkasten im Gespräch, Runden und Adressen bleiben erreichbar.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const lies = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');

describe('Arbeitsfläche — der Baustein', () => {
  it('steht im Standard (ein Import aus ../ui) und ist im DESIGN_STANDARD beschrieben', () => {
    expect(lies('components/os/ui/index.ts')).toMatch(/export \{ Arbeitsflaeche, MehrMenue, FilterKnopf, FilterGruppe, ListenAbschnitt, useArbeitsflaeche, useBreite, ZWEI_AB \} from '\.\/arbeitsflaeche';/);
    expect(lies('DESIGN_STANDARD.md')).toContain('## Arbeitsfläche (29.10.)');
    const css = lies('app/globals.css');
    for (const k of ['.af-kopf', '.af-leiste', '.af-koerper', '.af-spalte', '.af-liste-kopf', '.af-abschnitt-kopf', '.af-pop-filter', '.af-frei']) expect(css, k).toContain(k);
    // Jede Spalte rollt für sich; die Köpfe in der Liste kleben.
    expect(css).toMatch(/\.af-spalte \{[^}]*overflow-y: auto/);
    expect(css).toMatch(/\.af-liste-kopf \{ position: sticky; top: 0;/);
    expect(css).toMatch(/\.af-abschnitt-kopf \{ position: sticky; top: 0;/);
  });

  it('zeichnet Kopf in EINER Zeile (Titel · Zähler · ⋯ · Hauptaktion), Leiste, Liste — Funktionen bekommen den Stand der Fläche', async () => {
    const { Arbeitsflaeche, ListenAbschnitt, FilterKnopf } = await import('@/components/os/ui/arbeitsflaeche');
    const stand: unknown[] = [];
    const html = renderToStaticMarkup(h(Arbeitsflaeche, {
      titel: 'Liste', zaehler: '3 offen', haupt: h('button', null, '+ Neu'), mehr: h('button', null, 'Nebenbei'),
      leiste: h(FilterKnopf, { aktiv: 2, children: h('span', null, 'Inhalt') }),
      liste: (s: unknown) => { stand.push(s); return h(ListenAbschnitt, { titel: 'Antworten', rechts: '2', children: h('div', null, 'Zeile A') }); },
      detail: null, leer: 'Nichts gewählt',
    }));
    expect(html).toContain('class="af-kopf');
    expect(html).toContain('>Liste</h1>');
    expect(html).toContain('class="af-zaehler">3 offen<');
    expect(html).toContain('aria-label="Weitere Aktionen"');
    expect(html).not.toContain('>Nebenbei<'); // das „⋯“-Menü ist zu, bis man es öffnet
    expect(html).toContain('+ Neu');
    expect(html).toContain('class="af-filter-zahl" aria-label="2 aktiv">2<');
    expect(html).not.toContain('>Inhalt<');   // Filter-Popover zu
    expect(html).toContain('class="af-abschnitt-titel"');
    expect(html).toContain('Zeile A');
    expect(stand).toEqual([{ zwei: false, frei: false }]);
  });
});

describe('Inbox als Arbeitsfläche', () => {
  const i = lies('components/os/inbox/InboxZwei.tsx');
  const g = lies('components/os/inbox/Gespraech.tsx');
  it('Kopf in einer Zeile mit Zähler, Postfächer und Abgleichen im „⋯“; Suche + Ordnung + „Filter ▾“ in einer Zeile', () => {
    expect(i).toContain('<Arbeitsflaeche titel="Inbox"');
    expect(i).toMatch(/brauchen'\} Antwort/);
    expect(i).toContain('<FilterKnopf aktiv={filterAktiv}');
    expect(i).toContain('data-inbox="postfach-wahl"');
    expect(i).toContain('data-inbox="bereiche-auswahl"');
    expect(i).toContain('className="af-suche"');
    expect(i).toContain('setAnsicht(\'postfaecher\')}>Postfächer</Knopf>');
    // Keine eigene Zeile „Bereiche in ‚Alle‘ ▾“ und keine einzeilige (abgeschnittene) Pillenreihe mehr in der Seite.
    expect(i).not.toContain('<Pillen einzeilig');
  });
  it('Fächer und Tage sind Abschnitte EINER Liste (keine Karten in Karten); das Lagebild steht rechts bzw. kurz über der Liste', () => {
    expect(i).not.toMatch(/<Karte key=\{gr\.id\}/);
    expect(i).toContain('<ListenAbschnitt key={gr.id}');
    expect(i).toContain('leer={st => lagebild(st.zwei)} leerOben');
    expect(i).toContain('data-inbox="lage"');
    expect(i).toContain('data-inbox="zoe-satz"');
    expect(lies('components/os/inbox/Teilen.tsx')).toContain('if (abschnitt) return <ListenAbschnitt id="uebergeben"');
  });
  it('das Gespräch: kein eigener Scrollkasten für den Mailtext; Kontext nur mit Inhalt, sonst eine kurze Zeile mit „Kontakt anlegen“', () => {
    expect(g).not.toMatch(/maxHeight: letzte \? 480/);
    expect(g).toContain('data-inbox="kontext-leer"');
    expect(g).toContain('if (!hatKontext) return <div ref={wurzel}>{inhalt}</div>;');
    expect(g).toContain('(eigeneBreite ?? 0) >= KONTEXT_DANEBEN_AB');
    expect(g).not.toContain('<Leer>Noch keine Person in der Kartei.</Leer>');
    // „‹ Zurück zur Liste“ richtet sich nach der Fläche (stehen Liste und Gespräch nebeneinander?), nicht nach dem Fenster.
    expect(g).toContain('{onZurueck && !nebeneinander &&');
  });
  it('Tasten bleiben (/ j k Enter e s a r Esc)', () => {
    for (const t of ["ev.key === '/'", "k === 'j'", "k === 'k'", "k === 'enter'", "k === 'e'", "k === 's'", "k === 'a'", "k === 'r'", "k === 'escape'"]) expect(i, t).toContain(t);
  });
});

describe('Markttraktion › Kontakte als Arbeitsfläche', () => {
  const k = lies('components/os/crm/Kartei.tsx');
  const m = lies('components/os/crm/Markttraktion.tsx');
  it('die Kartei der Personen IST die Seite: Kopf „Kontakte“ · Zahl · ⋯ · „+ Person“; Head/ZOE daneben, „+ Aktivität“/„+ Angebot“ im ⋯', () => {
    expect(k).toContain('<Arbeitsflaeche titel="Kontakte"');
    expect(k).toContain('haupt={<Knopf haupt onClick={() => setAnlegen(!anlegen)}>+ Person</Knopf>}');
    expect(m).toContain("if (!runde && !akteId && bereich === 'kontakte') {");
    expect(m).toContain('kopf={{ neben: zoeKnopf, mehr: kopfAktionen }}');
    expect(m).toContain("{!runde && !akteId && bereich === 'firmen' && <Kartei {...karteiProps} modus=\"firmen\" />}");
  });
  it('Filter im Popover (Ansicht, BEAN, Lifecycle, Einordnung) mit Zähler; aktive Filter als Chips — keine abgeschnittene Chip-Reihe', () => {
    expect(k).toContain('<FilterKnopf aktiv={filterZahl} onZuruecksetzen={filterWeg}>');
    expect(k).toContain('<FilterGruppe titel="Ansicht">');
    expect(k).not.toContain('<Pillen einzeilig liste={ANSICHTEN}');
    expect(k).toContain('className="af-chip-weg fassbar"');
  });
  it('Runden und Qualifizierung bleiben erreichbar (im ⋯); Tabellenkopf klebt in der Liste; Tasten / j k Enter Esc bleiben', () => {
    for (const r of ["zuRunde('kreis')", "zuRunde('chancen')", "zuRunde('vernetzen')"]) expect(k, r).toContain(r);
    expect(k).toContain("listeKopf={st => (st.zwei && ansicht !== 'dubletten' ? tabellenKopf : null)}");
    for (const t of ["e.key === '/'", "e.key === 'j'", "e.key === 'k'", "e.key === 'Enter'", "e.key === 'Escape'"]) expect(k, t).toContain(t);
  });
});

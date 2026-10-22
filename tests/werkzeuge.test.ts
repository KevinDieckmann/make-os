// ─── Werkzeug-Muster (22.10.) — Konfiguration, Leiste, Werkzeugmodus, „Automationen & Head“ ─────────────────────────────────────────────────────────
// Kevin: „Wenn ich Prozesse aufmache, kommt im Grunde ein neues Tool — wie bei Miro. Genauso bei Markttraktion wie bei HubSpot.“ Der Wächter hält fest:
//   1. Konfiguration: jede Adresse eines Unterpunkts gibt es (Seite unter app/os) und sie bleibt im Werkzeug; eine Adresse gehört höchstens EINEM Werkzeug;
//      der Leistenpunkt öffnet das Werkzeug; höchstens zwei Ebenen; Gruppen stehen beieinander; jede Aktion hört die Seite des Werkzeugs.
//   2. Leiste: das Werkzeug-Menü erscheint NUR auf Werkzeug-Adressen, mit Rückweg „← MAKE OS“; unten bleiben Einstellungen und Melden; am Handy bleibt die
//      untere Leiste, wie sie ist.
//   3. Werkzeugmodus: EIN Parameter (`voll=1`), Rahmen mit Kopfzeile, Symbol-Leiste, schwebenden Orten; außerhalb zeichnet ein Ort nichts.
//   4. „Automationen & Head“: dieselben Daten wie das Werkzeug Prozesse, nach Bereich gefiltert, Zustand wie in der Werkstatt, Head-Karte mit vorhandenen Wegen.
// Kein Browser: reine Regeln, Server-Render und Quelltext.
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { List } from 'lucide-react';

const nav = vi.hoisted(() => ({ pfad: '/os', suche: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(nav.suche),
  usePathname: () => nav.pfad,
}));

import {
  WERKZEUGE, PROZESSE_WERKZEUG, werkzeugFuer, werkzeugVonHref, werkzeugKontext, werkzeugPunkte, alleUnterpunkte, automationPunkt, vollAdresse, imWerkzeugModus,
  AUTOMATION_LABEL, RUECKWEG_LABEL, type Werkzeug, type WerkzeugPunkt,
} from '@/lib/make-one/werkzeuge';
import { SPACES, leisteFuer, passtZu } from '@/lib/make-one/spaces';
import { prozesseAusAdresse } from '@/lib/prozesse/adresse';
import { WEG } from '@/lib/wege';
import { BEREICH_IDS } from '@/lib/prozesse/definition';
import { headDef } from '@/lib/agenten/katalog';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { landkarteAnsicht } from '@/lib/prozesse/landkarte-anpassung';
import { automationenFuer, automationZeile, automationLage } from '@/lib/prozesse/bereich-automationen';
import type { ProzessDef } from '@/lib/prozesse/typen';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const pfadVon = (href: string) => href.split(/[?#]/)[0];
/** Gibt es zu der Adresse eine Seite unter app/os (bzw. app/…)? */
const seiteDa = (href: string) => existsSync(path.join(wurzel, 'app', pfadVon(href).replace(/^\//, ''), 'page.tsx'));
const PZ = 'pz-11111111-2222-4333-8444-555555555555';
/** Die Seite eines Werkzeugs, die seine Aktionen hört — ein neues Werkzeug trägt sich hier ein (sonst rot). */
const SEITE_DES_WERKZEUGS: Record<string, string> = { prozesse: 'components/os/prozesse/ProzesseSeite.tsx' };

/** Beispiel-Adressen, an denen die Unterpunkte aufgelöst werden. */
const ORTE = ['', '?ansicht=liste', '?ansicht=werkstatt', `?p=${PZ}&ansicht=werkstatt`, `?p=${PZ}&ansicht=werkstatt&w=laeufe`, `?p=${PZ}&ansicht=werkstatt&w=tests`, '?p=sp-deal', '?modus=praesentieren', '?voll=1'];
const alle = (w: Werkzeug, suche: string, handy = false) => {
  const k = werkzeugKontext(w.pfade[0], suche, handy);
  return [...werkzeugPunkte(w, k), ...werkzeugPunkte(w, k, 'fuss')].flatMap(p => [p, ...p.unter]);
};

// ── Ein Beispiel-Werkzeug wie der kommende Markttraktion-Hub: Gruppen, Fuß, „Automationen & Head“ (nur im Test, nie in WERKZEUGE) ──
const HUB: Werkzeug = {
  id: 'hub-test', name: 'Hub', icon: List, spaces: ['business'], pfade: ['/os/markttraktion'], start: '/os/markttraktion', leistenPunkt: 'Markttraktion',
  punkte: [
    { id: 'ueberblick', label: 'Überblick', icon: List, href: () => '/os/markttraktion' },
    { id: 'kontakte', label: 'Kontakte', icon: List, href: () => '/os/markttraktion?s=kontakte', gruppe: 'CRM' },
    { id: 'firmen', label: 'Firmen', icon: List, href: () => '/os/markttraktion?s=firmen', gruppe: 'CRM' },
    { id: 'deals', label: 'Deals', icon: List, href: () => '/os/markttraktion?s=deals', aktiv: k => k.q.get('s') === 'deals', gruppe: 'Vertrieb' },
    { id: 'planung', label: 'Planung', icon: List, href: () => '/os/markttraktion?s=planung', gruppe: 'Steuerung' },
    { id: 'auswertung', label: 'Auswertung', icon: List, href: () => '/os/markttraktion?s=auswertung', gruppe: 'Steuerung' },
  ],
  fuss: [{ id: 'stammdaten', label: 'Stammdaten', icon: List, href: () => '/os/markttraktion?s=stammdaten' }],
  automation: { bereiche: ['marketing', 'sales'], head: 'sales', gruppe: 'Steuerung', href: () => '/os/markttraktion?s=automationen', aktiv: k => k.q.get('s') === 'automationen' },
};

describe('Werkzeug-Konfiguration', () => {
  it('jedes Werkzeug: eindeutig, gehört zu Spaces, sein Leistenpunkt öffnet es', () => {
    expect(new Set(WERKZEUGE.map(w => w.id)).size).toBe(WERKZEUGE.length);
    for (const w of WERKZEUGE) {
      expect(w.spaces.length, w.id).toBeGreaterThan(0);
      expect(w.pfade.length, w.id).toBeGreaterThan(0);
      expect(werkzeugVonHref(w.start)?.id, w.id).toBe(w.id);
      for (const sp of w.spaces) {
        const e = leisteFuer(sp).find(x => x.label === w.leistenPunkt);
        expect(e, `${w.id}: Leistenpunkt in ${sp}`).toBeDefined();
        expect(werkzeugVonHref(e!.href)?.id).toBe(w.id);
      }
    }
  });
  it('Pfad-Zuordnung eindeutig: eine Adresse gehört höchstens einem Werkzeug; nur die Werkzeug-Punkte der Leisten öffnen eines', () => {
    for (const a of WERKZEUGE) for (const b of WERKZEUGE) if (a !== b) for (const m of a.pfade) expect(werkzeugVonHref(m)?.id, `${m} in ${b.id}`).not.toBe(b.id);
    for (const s of SPACES) for (const e of leisteFuer(s.id)) {
      const treffer = WERKZEUGE.filter(w => werkzeugVonHref(e.href)?.id === w.id);
      expect(treffer.length, e.href).toBeLessThanOrEqual(1);
      expect(!!werkzeugVonHref(e.href), e.label).toBe(WERKZEUGE.some(w => w.leistenPunkt === e.label && w.spaces.includes(s.id)));
    }
    expect(werkzeugFuer('/os')).toBeNull();
    expect(werkzeugFuer('/os/markttraktion', '?s=kontakte')).toBeNull();
    expect(werkzeugFuer('/os/prozesse', '?p=sp-deal&voll=1')?.id).toBe('prozesse');
    expect(werkzeugFuer('/os/prozessebuch')).toBeNull();
  });
  it('jede Adresse eines Unterpunkts gibt es und bleibt im Werkzeug (an allen Beispiel-Orten, Rechner und Handy)', () => {
    for (const w of WERKZEUGE) for (const o of ORTE) for (const handy of [false, true]) for (const p of alle(w, o, handy)) {
      if (!p.href) { expect(p.aktion, `${w.id}:${p.id}`).toBeTruthy(); continue; }
      expect(seiteDa(p.href), `${w.id}:${p.id} → ${p.href}`).toBe(true);
      expect(werkzeugVonHref(p.href)?.id, `${w.id}:${p.id} → ${p.href}`).toBe(w.id);
    }
  });
  it('Prozesse: nur vorhandene Orte über WEG — alte Adressen gelten weiter', () => {
    const k = werkzeugKontext('/os/prozesse', `?p=${PZ}&ansicht=werkstatt&w=laeufe`);
    const p = Object.fromEntries(werkzeugPunkte(PROZESSE_WERKZEUG, k).flatMap(x => [x, ...x.unter]).map(x => [x.id, x]));
    expect(p.landkarte.href).toBe(WEG.prozesse());
    expect(p.liste.href).toBe(WEG.prozesse({ ansicht: 'liste' }));
    expect(p.werkstatt.href).toBe(WEG.prozesse({ ansicht: 'werkstatt' }));
    expect(prozesseAusAdresse(new URLSearchParams(p.laeufe.href!.split('?')[1]))).toEqual({ p: PZ, ansicht: 'werkstatt', w: 'laeufe' });
    expect(prozesseAusAdresse(new URLSearchParams(p.tests.href!.split('?')[1]))).toEqual({ p: PZ, ansicht: 'werkstatt', w: 'tests' });
    expect(p.bauen.href).toBe(WEG.prozesse({ p: PZ, ansicht: 'werkstatt' }));
    expect(p.vorlagen.aktion).toBe('vorlagen');
    expect(werkzeugPunkte(PROZESSE_WERKZEUG, k, 'fuss').map(x => x.aktion)).toEqual(['praesentieren']);
  });
  it('was leuchtet: genau ein Unterpunkt je Ort; Läufe/Tests nur mit eigenem Prozess in der Werkstatt; am Handy Liste vorn, ohne Vorlagen und Präsentieren', () => {
    const an = (suche: string, handy = false) => alle(PROZESSE_WERKZEUG, suche, handy).filter(p => p.an).map(p => p.id);
    expect(an('')).toEqual(['landkarte']);
    expect(an('?p=sp-deal')).toEqual(['landkarte']);
    expect(an('?modus=praesentieren&ansicht=werkstatt')).toEqual(['landkarte']);
    expect(an('?ansicht=liste')).toEqual(['liste']);
    expect(an('?ansicht=werkstatt')).toEqual(['werkstatt']);
    expect(an(`?p=${PZ}&ansicht=werkstatt`)).toEqual(['werkstatt', 'bauen']);
    expect(an(`?p=${PZ}&ansicht=werkstatt&w=laeufe`)).toEqual(['werkstatt', 'laeufe']);
    expect(an('', true)).toEqual(['liste']);
    const kinder = (suche: string) => werkzeugPunkte(PROZESSE_WERKZEUG, werkzeugKontext('/os/prozesse', suche)).find(p => p.id === 'werkstatt')!.unter.map(u => u.id);
    expect(kinder('?ansicht=werkstatt')).toEqual([]);
    expect(kinder('?p=sp-deal&ansicht=werkstatt')).toEqual([]); // System-Prozesse haben keine Läufe
    expect(kinder(`?p=${PZ}&ansicht=werkstatt`)).toEqual(['bauen', 'laeufe', 'tests']);
    expect(kinder(`?p=${PZ}`)).toEqual([]);
    expect(alle(PROZESSE_WERKZEUG, '', true).map(p => p.id)).not.toEqual(expect.arrayContaining(['vorlagen']));
    expect(alle(PROZESSE_WERKZEUG, '', true).map(p => p.id)).not.toContain('praesentieren');
  });
  it('höchstens zwei Ebenen; Gruppen stehen beieinander', () => {
    const tiefe = (p: WerkzeugPunkt): number => 1 + Math.max(0, ...(p.unter ?? []).map(tiefe));
    for (const w of [...WERKZEUGE, HUB]) {
      for (const p of [...alleUnterpunkte(w), ...(w.fuss ?? [])]) expect(tiefe(p), `${w.id}:${p.id}`).toBeLessThanOrEqual(2);
      const reihe = alleUnterpunkte(w).map(p => p.gruppe ?? '');
      const gesehen = new Set<string>();
      reihe.forEach((g, i) => { if (g && g !== reihe[i - 1]) { expect(gesehen.has(g), `${w.id}: Gruppe „${g}“ zweimal`).toBe(false); gesehen.add(g); } });
    }
  });
  it('jede Aktion eines Unterpunkts hört die Seite des Werkzeugs', () => {
    for (const w of WERKZEUGE) {
      const datei = SEITE_DES_WERKZEUGS[w.id];
      expect(datei, `${w.id}: Seite in SEITE_DES_WERKZEUGS eintragen`).toBeDefined();
      const q = lies(datei);
      expect(q).toContain('WERKZEUG_EREIGNIS');
      for (const p of [...alleUnterpunkte(w), ...(w.fuss ?? [])].flatMap(x => [x, ...(x.unter ?? [])])) if (p.aktion) expect(q, `${w.id}:${p.aktion}`).toContain(`'${p.aktion}'`);
    }
  });
  it('Werkzeugmodus = derselbe Parameter wie das Vollbild der Flächen (`voll=1`); Links im Modus bleiben im ganzen Bildschirm', () => {
    expect(vollAdresse('/os/prozesse', 'p=sp-deal', true)).toBe('/os/prozesse?p=sp-deal&voll=1');
    expect(vollAdresse('/os/prozesse', '?p=sp-deal&voll=1&modus=praesentieren', false)).toBe('/os/prozesse?p=sp-deal');
    expect(imWerkzeugModus(WEG.prozesse({ ansicht: 'liste' }))).toBe('/os/prozesse?ansicht=liste&voll=1');
    expect(prozesseAusAdresse(new URLSearchParams(imWerkzeugModus(WEG.prozesse()).split('?')[1])).voll).toBe(true);
    expect(lies('components/os/ui/flaeche/vollbild.ts')).toContain("import { vollAdresse } from '@/lib/make-one/werkzeuge';");
  });
});

describe('„Automationen & Head“ im Muster (Gruppen, Fuß, Standard-Unterpunkt)', () => {
  it('Prozesse trägt keinen eigenen Punkt (dort ist es die ganze Landkarte)', () => {
    expect(automationPunkt(PROZESSE_WERKZEUG)).toBeNull();
    expect(alleUnterpunkte(PROZESSE_WERKZEUG)).toBe(PROZESSE_WERKZEUG.punkte);
  });
  it('ein Werkzeug mit `automation` bekommt den Punkt in seiner Gruppe — Name überall gleich', () => {
    const l = werkzeugPunkte(HUB, werkzeugKontext('/os/markttraktion', '?s=automationen'));
    expect(l.map(p => p.id)).toEqual(['ueberblick', 'kontakte', 'firmen', 'deals', 'planung', 'auswertung', 'automationen']);
    const a = l.find(p => p.id === 'automationen')!;
    expect([a.label, a.gruppe, a.an, a.href]).toEqual([AUTOMATION_LABEL, 'Steuerung', true, '/os/markttraktion?s=automationen']);
    // Ohne Gruppe: am Ende der Unterpunkte.
    const ohne: Werkzeug = { ...HUB, automation: { ...HUB.automation!, gruppe: undefined } };
    expect(alleUnterpunkte(ohne).at(-1)?.id).toBe('automationen');
  });
  it('jedes echte Werkzeug mit `automation`: Bereiche der Landkarte, ein Business-Head, Ort im Werkzeug', () => {
    for (const w of [...WERKZEUGE, HUB]) {
      const a = w.automation;
      if (!a) continue;
      for (const b of a.bereiche) expect(BEREICH_IDS as readonly string[], `${w.id}:${b}`).toContain(b);
      if (a.head) expect(headDef(a.head)?.bereich, `${w.id}:${a.head}`).toBe('business');
      const ziel = a.href(werkzeugKontext(w.pfade[0]));
      expect(w.pfade.some(m => passtZu(pfadVon(ziel), ziel.includes('?') ? ziel.slice(ziel.indexOf('?')) : '', m)), w.id).toBe(true);
    }
  });
});

describe('Leiste: das Werkzeug-Menü nur auf Werkzeug-Adressen', () => {
  const render = async (pfad: string, suche = '') => {
    nav.pfad = pfad; nav.suche = suche;
    const { Leiste } = await import('@/components/os/Leiste');
    const html = renderToStaticMarkup(h(Leiste));
    const [desktop, mobil] = html.split('class="leiste-mobil"');
    return { desktop, mobil };
  };
  it('auf /os/prozesse: „← MAKE OS“, Name, Unterpunkte — statt der Punkte des Space; unten Einstellungen, Melden, Konto', async () => {
    const { desktop, mobil } = await render('/os/prozesse');
    expect(desktop).toContain('data-werkzeug="prozesse"');
    expect(desktop).toContain(`>${RUECKWEG_LABEL}</span>`);
    for (const t of ['Landkarte', 'Liste', 'Werkstatt', 'Vorlagen', 'Präsentieren']) expect(desktop, t).toContain(`>${t}</span>`);
    expect(desktop.indexOf(`>${RUECKWEG_LABEL}</span>`)).toBeLessThan(desktop.indexOf('>Landkarte</span>'));
    expect(desktop).not.toContain('title="Markttraktion"');
    expect(desktop).toContain('title="Einstellungen"');
    expect(desktop).toContain('title="Problem oder Idee melden"');
    expect(desktop).toContain('href="/os/konto"');
    // Handy: die untere Leiste bleibt, wie sie ist.
    for (const t of ['>Heute<', '>Inbox<', '>Menü<', '>ZOE<', '>Netzwerken<']) expect(mobil, t).toContain(t);
    expect(mobil).not.toContain('data-werkzeug');
  });
  it('mit offenem Prozess der Werkstatt: Bauen · Läufe · Tests unter „Werkstatt“', async () => {
    const { desktop } = await render('/os/prozesse', `?p=${PZ}&ansicht=werkstatt&w=laeufe`);
    for (const t of ['Bauen', 'Läufe', 'Tests']) expect(desktop, t).toContain(`>${t}</span>`);
    const laeufe = desktop.match(new RegExp(`<a [^>]*href="/os/prozesse\\?p=${PZ}&amp;ansicht=werkstatt&amp;w=laeufe"[^>]*>`))?.[0] ?? '';
    expect(laeufe).toContain('aria-current="page"');
    expect(laeufe).toContain('data-werkzeug-punkt="laeufe"');
  });
  it('überall sonst die Leiste des Space — kein Werkzeug-Menü, kein Rückweg', async () => {
    for (const [pfad, suche] of [['/os', ''], ['/os/markttraktion', '?s=kontakte'], ['/os/aufgaben', '']] as const) {
      const { desktop } = await render(pfad, suche);
      expect(desktop, pfad).not.toContain('data-werkzeug');
      expect(desktop, pfad).not.toContain(`>${RUECKWEG_LABEL}</span>`);
      expect(desktop, pfad).toContain('title="Prozesse"');
    }
  });
  it('Quelltext: „← MAKE OS“ zeigt wieder die Punkte des Space (kein Seitenwechsel); der Punkt des Werkzeugs klappt zurück; Blatt am Handy trägt das Werkzeug oben', () => {
    const l = lies('components/os/Leiste.tsx');
    expect(l).toContain('onZurueck={() => setSpaceZeigen(true)}');
    expect(l).toContain('onClick={() => setSpaceZeigen(false)}');
    expect(l).toContain('window.addEventListener(WERKZEUG_ZURUECK, zurueck)');
    expect(l).toContain('variante="blatt"');
    expect(l).toContain('leisteFuer(wahl, !!nurBusiness).map(');
  });
});

describe('Das Menü als Bauteil: Gruppen-Überschriften, Fuß, schmal, Blatt', () => {
  it('Überschriften über den Gruppen, Fuß unten hinter einem Strich, Rückweg zuerst', async () => {
    const { WerkzeugMenue } = await import('@/components/os/werkzeug/menue');
    const k = werkzeugKontext('/os/markttraktion', '?s=deals');
    const html = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: HUB, kontext: k, variante: 'leiste', farbe: '#6E7EF5', onZurueck: () => {} }));
    const reihe = [`>${RUECKWEG_LABEL}<`, '>Überblick<', '>CRM<', '>Kontakte<', '>Firmen<', '>Vertrieb<', '>Deals<', '>Steuerung<', '>Planung<', '>Auswertung<', `>${AUTOMATION_LABEL.replace('&', '&amp;')}<`, '>Stammdaten<'].map(t => html.indexOf(t));
    expect(reihe.every(i => i > -1)).toBe(true);
    expect([...reihe].sort((a, b) => a - b)).toEqual(reihe);
    expect((html.match(/role="heading"/g) ?? []).length).toBe(3);
    expect(html).toContain('aria-current="page"'); // Deals
    const schmal = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: HUB, kontext: k, variante: 'leiste', schmal: true, farbe: '#6E7EF5', onZurueck: () => {} }));
    expect(schmal).not.toContain('role="heading"');
    expect((schmal.match(/role="separator"/g) ?? []).length).toBe(3);
    expect(schmal).not.toContain('>Kontakte</span>');
    expect(schmal).toContain('aria-label="Kontakte"');
    const blatt = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: HUB, kontext: k, variante: 'blatt', farbe: '#6E7EF5' }));
    expect(blatt).toContain('>Hub</div>');
    expect(blatt).toContain('grid-column:1 / -1');
    expect(blatt).not.toContain(RUECKWEG_LABEL);
  });
  it('Symbol-Leiste (Werkzeugmodus): nur Symbole mit Namen als Tooltip, jeder Link bleibt im ganzen Bildschirm', async () => {
    const { WerkzeugMenue } = await import('@/components/os/werkzeug/menue');
    const html = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: PROZESSE_WERKZEUG, kontext: werkzeugKontext('/os/prozesse', '?voll=1'), variante: 'schiene', farbe: '#6E7EF5', onZurueck: () => {} }));
    expect(html).toContain('href="/os/prozesse?ansicht=liste&amp;voll=1"');
    expect(html).toContain('href="/os/prozesse?voll=1"');
    expect(html).not.toContain('>Liste</span>');
    expect(html).toContain('title="Liste — Alle Prozesse als Liste"');
  });
});

describe('Werkzeugmodus: Rahmen und Orte', () => {
  it('außerhalb des Rahmens zeichnet ein Ort nichts — die Seite legt ihre Leisten selbst hin', async () => {
    const { WerkzeugSlot } = await import('@/components/os/werkzeug/rahmen');
    expect(renderToStaticMarkup(h(WerkzeugSlot, { ort: 'links', children: h('b', null, 'x') }))).toBe('');
  });
  it('Rahmen: Overlay über allem (Portal, aria-modal), Kopfzeile mit Rückweg · Werkzeug · Titel, „Vollbild verlassen“, Esc, Symbol-Leiste, fünf Orte', () => {
    const r = lies('components/os/werkzeug/rahmen.tsx');
    for (const t of ['createPortal(', 'aria-modal="true"', 'role="dialog"', 'variante="schiene"', 'Vollbild verlassen', "e.key !== 'Escape'", 'zurUebersicht()', '--wz-oben']) expect(r, t).toContain(t);
    for (const o of ['titel', 'aktionen', 'links', 'unten-links', 'unten-rechts']) expect(r, o).toContain(`'${o}'`);
    // Keine Transformation und kein Weichzeichner an den schwebenden Leisten (Fenster mit position: fixed blieben sonst darin gefangen).
    const css = lies('app/globals.css');
    const wz = css.split('\n').filter(z => z.startsWith('.wz-schwebe') || z.startsWith('.wz-kopf') || z.startsWith('.wz-links'));
    for (const z of wz) { expect(z, z).not.toMatch(/transform|backdrop-filter|filter:/); }
    expect(css).toMatch(/\.wz-modus \{ position: fixed; inset: 0; z-index: 1500;/);
    expect(css).toContain('.wz-schwebe:empty { display: none; }');
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .wz-modus *');
  });
  it('Prozesse: Werkzeugmodus über den Rahmen (Esc führt die Seite), der Pfeil ⤢ in der Fläche, Präsentieren bleibt, wie es ist', () => {
    const s = lies('components/os/prozesse/ProzesseSeite.tsx');
    expect(s).toContain('<WerkzeugRahmen werkzeug={PROZESSE_WERKZEUG}');
    expect(s).toContain('esc={false}');
    expect(s).toContain('{!voll && <GanzerBildschirmKnopf onClick={() => vollbild.an()} kuerzel="F" />}');
    expect(s).toContain('<WerkzeugSlot ort="unten-rechts">{landkarteZoom}</WerkzeugSlot>');
    expect(s).toContain('<WerkzeugFeld titel={feldTitel}');
    expect(s).toContain('className="pz-voll pz-praesentieren"');
    expect(s).toContain("if (d.aktion === 'vorlagen') setVorlageOffen(true);");
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    for (const t of ['<WerkzeugSlot ort="links">', '<WerkzeugSlot ort="unten-rechts">', '<WerkzeugSlot ort="aktionen">{probeKnopf}{versionenKnopf}</WerkzeugSlot>', '<WerkzeugSlot ort="titel">{kopfZustand}</WerkzeugSlot>', '<WerkzeugFeld titel="Einstellungen"', '{!modus && onGanzerBildschirm && <GanzerBildschirmKnopf']) expect(w, t).toContain(t);
    expect(lies('components/os/prozesse/PaketWerkstatt.tsx')).toContain('{onGanzerBildschirm && <GanzerBildschirmKnopf onClick={onGanzerBildschirm} />}');
    // Der Maßstab kommt aus der Kamera der Flächen — kein React-Zustand je Bild.
    expect(lies('components/os/prozesse/Buehne.tsx')).toContain('stand.current.onMassstab?.(k.s);');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('stand.current.onMassstab?.(k.s);');
  });
  it('Standard: keine Farb-Literale, keine Schrift unter 11 px, kein <a href="/os…">, nichts Persönliches in den neuen Dateien', () => {
    const ordner = 'components/os/werkzeug';
    const dateien = [...readdirSync(path.join(wurzel, ordner)).map(n => `${ordner}/${n}`), 'lib/make-one/werkzeuge.ts', 'lib/prozesse/bereich-automationen.ts'];
    for (const f of dateien) {
      const q = lies(f).split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
      expect(q, f).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}['"`]/);
      expect(q, f).not.toMatch(/rgba?\(/);
      expect(q, f).not.toMatch(/fontSize[=:]\s*\{?\s*(9|10)(?![\d.])/);
      expect(q, f).not.toMatch(/<a href=["'{`]\/os/);
      expect(lies(f), f).not.toMatch(/\b(kevin|malin|kemaris|ventures)\b/i);
    }
  });
});

describe('„Automationen & Head“: dieselben Daten wie das Werkzeug Prozesse', () => {
  const eigen = (id: string, stufe: ProzessDef['stufe'], status: NonNullable<ProzessDef['werkstatt']>['status'], version: number | null): ProzessDef => ({
    id, titel: `Eigener ${id.slice(-4)}`, quelle: 'werkstatt', band: 'kern', stufe, steckbrief: { ausloeser: '', eingang: '', ergebnis: '', empfaenger: '', eigner: '' }, phasen: [], werkstatt: { status, version, schritte: 4 },
  });
  const A = 'pz-aaaaaaaa-2222-4333-8444-555555555555', B = 'pz-bbbbbbbb-2222-4333-8444-555555555555', P = 'pz-cccccccc-2222-4333-8444-555555555555';
  const prozesse = [...SYSTEM_PROZESSE, eigen(A, 'sales', 'aktiv', 2), eigen(B, 'sales', 'aktiv', 1), eigen(P, 'marketing', 'pausiert', 1)];
  const ansicht = landkarteAnsicht(prozesse, null);
  it('nach Bereich (in Reihenfolge der Bereiche), Zustand wie in der Werkstatt: scharf aus dem Laufzeit-Stand, sonst Probelauf', () => {
    const g = automationenFuer(ansicht, ['sales', 'marketing', 'gibt-es-nicht'], { [A]: { offen: 2, wartend: 1, fehler: 0, zurueckgehalten: 0, scharf: true } });
    expect(g.map(x => x.bereich.id)).toEqual(['sales', 'marketing']);
    const sales = g[0].zeilen;
    expect(sales.map(z => z.id)).toEqual(ansicht.jeBereich.sales.map(p => p.id));
    expect(sales.find(z => z.id === A)).toMatchObject({ art: 'werkstatt', zustand: 'scharf', zustandName: 'scharf', href: WEG.prozesse({ p: A, ansicht: 'werkstatt' }) });
    expect(sales.find(z => z.id === A)!.satz).toBe('Version 2 · 4 Schritte · 2 Läufe offen');
    expect(sales.find(z => z.id === B)!.zustand).toBe('probelauf');
    expect(g[1].zeilen.find(z => z.id === P)!.zustand).toBe('pausiert');
    const sys = sales.find(z => z.art === 'system')!;
    expect(sys.href).toBe(WEG.prozesse({ p: sys.id }));
    expect(automationLage(g)).toMatchObject({ scharf: 1, probelauf: 1, pausiert: 1 });
    expect(automationZeile(eigen(A, 'sales', 'entwurf', null)).satz).toBe('noch nicht veröffentlicht · 4 Schritte');
  });
  it('die Ansicht: Bereiche mit ihren Prozessen, „+ Prozess“ und „Aus Vorlage“ nur mit Recht, Head-Karte mit Freigaben, Gespräch, Einstellungen, „Head fragen“', async () => {
    const { BereichAutomationenAnsicht } = await import('@/components/os/werkzeug/BereichAutomationen');
    const g = automationenFuer(ansicht, ['sales'], {});
    const head = { id: 'sales', name: 'Head of Sales', kurz: 'Sales', auftrag: 'Führt Vertrieb.', aktiv: true, zaehler: { freigaben: 3, laufend: 0 } };
    const basis = { werkzeug: HUB, gruppen: g, headId: 'sales', schrauben: {}, onNeu: () => {}, onVorlage: () => {}, onHead: () => {}, onGespeichert: () => {} };
    const html = renderToStaticMarkup(h(BereichAutomationenAnsicht, { ...basis, head, darfBauen: true }));
    expect(html).toContain(`${AUTOMATION_LABEL.replace('&', '&amp;')} · Hub`);
    expect(html).toContain('Head of Sales');
    expect(html).toContain('3 offene Vorschläge');
    expect(html).toContain(`href="${WEG.agenten({ h: 'sales', r: 'einstellungen' }).replace(/&/g, '&amp;')}"`);
    expect(html).toContain(`href="${WEG.freigaben(undefined, 'business').replace(/&/g, '&amp;')}"`);
    for (const t of ['Aus Vorlage', '>Prozess<', 'Head fragen']) expect(html, t).toContain(t);
    for (const z of g[0].zeilen) expect(html).toContain(`href="${z.href.replace(/&/g, '&amp;')}"`);
    const ohne = renderToStaticMarkup(h(BereichAutomationenAnsicht, { ...basis, head: null, darfBauen: false }));
    for (const t of ['Aus Vorlage', 'Head fragen']) expect(ohne, t).not.toContain(t);
    expect(ohne).toContain('Zu den Agenten');
  });
  it('Galerie und Head nehmen den Bereich (additiv, ohne Angabe wie bisher)', () => {
    expect(lies('components/os/prozesse/VorlagenGalerie.tsx')).toContain('const imBereich = (b: string) => !nurBereiche?.length || nurBereiche.includes(b);');
    expect(lies('components/os/prozesse/HeadFragen.tsx')).toContain("useState<ProzessBereich>(prozess?.bereich ?? bereichVorgabe ?? 'sales')");
  });
});

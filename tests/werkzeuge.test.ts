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
  WERKZEUGE, PROZESSE_WERKZEUG, MARKTTRAKTION_WERKZEUG, werkzeugFuer, werkzeugVonHref, werkzeugKontext, werkzeugPunkte, alleUnterpunkte, automationPunkt, automationHeads,
  automationenVon, vollAdresse, imWerkzeugModus, AUTOMATION_LABEL, RUECKWEG_LABEL, type Werkzeug, type WerkzeugPunkt,
} from '@/lib/make-one/werkzeuge';
import { HUB_MENUE, HUB_PUNKTE, hubGruppenAnzeige, hubOrtFuer, markttraktion } from '@/lib/crm/adresse';
import { HUB_SYMBOLE } from '@/lib/crm/hub-symbole';
import { SPACES, leisteFuer, passtZu } from '@/lib/make-one/spaces';
import { prozesseAusAdresse } from '@/lib/prozesse/adresse';
import { WEG } from '@/lib/wege';
import { BEREICH_IDS } from '@/lib/prozesse/definition';
import { headDef } from '@/lib/agenten/katalog';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { landkarteAnsicht } from '@/lib/prozesse/landkarte-anpassung';
import { automationenFuer, automationZeile, automationLage } from '@/lib/prozesse/bereich-automationen';
import type { ProzessDef } from '@/lib/prozesse/typen';
import * as W from '@/lib/make-one/werkzeuge';
import { FULFILLMENT_BEREICHE } from '@/lib/fulfillment/adresse';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const pfadVon = (href: string) => href.split(/[?#]/)[0];
/** Gibt es zu der Adresse eine Seite unter app/os (bzw. app/…)? Dynamische Segmente (`[horizont]`, `[id]`) zählen für ein Pfadstück. */
const seiteDa = (href: string): boolean => {
  let ordner = path.join(wurzel, 'app');
  for (const teil of pfadVon(href).split('/').filter(Boolean)) {
    if (existsSync(path.join(ordner, teil))) { ordner = path.join(ordner, teil); continue; }
    const dyn = readdirSync(ordner).find(n => /^\[[^.]/.test(n));
    if (!dyn) return false;
    ordner = path.join(ordner, dyn);
  }
  return existsSync(path.join(ordner, 'page.tsx'));
};
const PZ = 'pz-11111111-2222-4333-8444-555555555555';
/** Die Seite eines Werkzeugs, die seine Aktionen hört — ein neues Werkzeug trägt sich hier ein (sonst rot). */
const SEITE_DES_WERKZEUGS: Record<string, string> = {
  prozesse: 'components/os/prozesse/ProzesseSeite.tsx', markttraktion: 'components/os/crm/Markttraktion.tsx', 'produkte-mandate': 'components/os/mandate/ProdukteMandate.tsx',
};

/** Beispiel-Adressen, an denen die Unterpunkte aufgelöst werden. */
const ORTE = ['', '?ansicht=liste', '?ansicht=werkstatt', `?p=${PZ}&ansicht=werkstatt`, `?p=${PZ}&ansicht=werkstatt&w=laeufe`, `?p=${PZ}&ansicht=werkstatt&w=tests`, '?p=sp-deal', '?modus=praesentieren', '?voll=1'];
const alle = (w: Werkzeug, suche: string, handy = false, space?: 'privat' | 'business') => {
  const k = werkzeugKontext(w.pfade[0], suche, handy, space ? { space } : {});
  return [...werkzeugPunkte(w, k), ...werkzeugPunkte(w, k, 'fuss')].flatMap(p => [p, ...p.unter]);
};

// ── Ein Beispiel-Werkzeug (Gruppen, Fuß, „Automationen & Head“) für die allgemeinen Regeln — nur im Test, nie in WERKZEUGE; das echte Markttraktion-Werkzeug
// prüft der Block „Markttraktion als Werkzeug“ unten. ──
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
    expect(werkzeugFuer('/os/markttraktion', '?s=kontakte')?.id).toBe('markttraktion');
    expect(werkzeugFuer('/os/netzwerken')?.id).toBe('markttraktion');
    expect(werkzeugFuer('/os/netzwerken/karte')?.id).toBe('markttraktion');
    expect(werkzeugFuer('/os/netzwerkenx')).toBeNull();
    expect(werkzeugFuer('/os/mandate')?.id).toBe('produkte-mandate'); // seit 22.10. abends ein Werkzeug (Gruppe A)
    expect(werkzeugFuer('/os/mandate/fulfillment', '?u=bausteine')?.id).toBe('produkte-mandate');
    expect(werkzeugFuer('/os/kalender')).toBeNull(); // Kalender ist (noch) kein Werkzeug
    expect(werkzeugFuer('/os/menschen')).toBeNull(); // Kontakte privat
    expect(werkzeugFuer('/os/prozesse', '?p=sp-deal&voll=1')?.id).toBe('prozesse');
    expect(werkzeugFuer('/os/prozessebuch')).toBeNull();
  });
  it('jede Adresse eines Unterpunkts gibt es und bleibt im Werkzeug (an allen Beispiel-Orten, Rechner und Handy, in jedem Space des Werkzeugs)', () => {
    for (const w of WERKZEUGE) for (const sp of w.spaces) for (const o of ORTE) for (const handy of [false, true]) for (const p of alle(w, o, handy, sp)) {
      if (!p.href) { expect(p.aktion, `${w.id}:${p.id}`).toBeTruthy(); continue; }
      expect(seiteDa(p.href), `${w.id}:${p.id} → ${p.href}`).toBe(true);
      // Ein Punkt, der in einen anderen Bereich führt (`wechselt`, z. B. Planung › „Woche planen“ → Kalender), verlässt das Werkzeug — ausdrücklich.
      if (p.wechselt) { expect(werkzeugVonHref(p.href)?.id, `${w.id}:${p.id}`).not.toBe(w.id); continue; }
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
      const aktionen = [...alleUnterpunkte(w), ...(w.fuss ?? [])].flatMap(x => [x, ...(x.unter ?? [])]).filter(p => p.aktion);
      // Ein Werkzeug ohne Aktionen (Markttraktion: jeder Punkt ist eine Adresse) braucht keinen Hörer — sonst muss die Seite lauschen.
      if (aktionen.length) expect(q, w.id).toContain('WERKZEUG_EREIGNIS');
      for (const p of aktionen) expect(q, `${w.id}:${p.aktion}`).toContain(`'${p.aktion}'`);
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
    const ohne: Werkzeug = { ...HUB, automation: { ...automationenVon(HUB)[0], gruppe: undefined } };
    expect(alleUnterpunkte(ohne).at(-1)?.id).toBe('automationen');
  });
  it('jedes echte Werkzeug mit `automation`: Bereiche/Prozesse der Landkarte, Heads des Space (in Privat keine Prozesse), Ort im Werkzeug', () => {
    const prozessIds = SYSTEM_PROZESSE.map(p => p.id);
    for (const w of [...WERKZEUGE, HUB]) for (const a of automationenVon(w)) for (const sp of a.spaces ?? w.spaces) {
      for (const b of a.bereiche) expect(BEREICH_IDS as readonly string[], `${w.id}:${b}`).toContain(b);
      for (const p of a.prozesse ?? []) expect(prozessIds, `${w.id}:${p}`).toContain(p);
      for (const id of automationHeads(a)) expect(headDef(id)?.bereich, `${w.id}:${sp}:${id}`).toBe(sp);
      if (sp === 'privat') expect([...a.bereiche, ...(a.prozesse ?? [])], `${w.id}: Prozesse gibt es nur im Business`).toEqual([]);
      const ziel = a.href(werkzeugKontext(w.pfade[0], '', false, { space: sp }));
      expect(w.pfade.some(m => passtZu(pfadVon(ziel), ziel.includes('?') ? ziel.slice(ziel.indexOf('?')) : '', m)), w.id).toBe(true);
      expect(seiteDa(ziel), `${w.id}: ${ziel}`).toBe(true);
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
    for (const [pfad, suche] of [['/os', ''], ['/os/kalender', ''], ['/os/aufgaben', '']] as const) {
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
    const dateien = [...readdirSync(path.join(wurzel, ordner)).map(n => `${ordner}/${n}`), 'lib/make-one/werkzeuge.ts', 'lib/prozesse/bereich-automationen.ts', 'lib/crm/hub-symbole.ts'];
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
  it('mehrere Heads (Markttraktion): je eine Karte nebeneinander — Sales zuerst, dann Marketing und Event; „Head fragen“ nur einmal', async () => {
    const { BereichAutomationenAnsicht } = await import('@/components/os/werkzeug/BereichAutomationen');
    const kopf = (id: string, name: string, freigaben: number) => ({ id, name, kurz: name, auftrag: `${name} führt.`, aktiv: true, zaehler: { freigaben, laufend: 0 } });
    const html = renderToStaticMarkup(h(BereichAutomationenAnsicht, {
      werkzeug: MARKTTRAKTION_WERKZEUG, gruppen: automationenFuer(ansicht, automationenVon(MARKTTRAKTION_WERKZEUG)[0].bereiche, {}), headId: 'sales', head: kopf('sales', 'Head of Sales', 2),
      weitere: [{ id: 'marketing', head: kopf('marketing', 'Head of Marketing', 0) }, { id: 'event', head: null }],
      darfBauen: true, schrauben: {}, onNeu: () => {}, onVorlage: () => {}, onHead: () => {}, onGespeichert: () => {},
    }));
    expect(html).toContain(`${AUTOMATION_LABEL.replace('&', '&amp;')} · Markttraktion`);
    for (const t of ['Head of Sales', 'Head of Marketing', '2 offene Vorschläge', 'Keine offenen Vorschläge', 'Der Head ist für dich hier nicht zu sehen']) expect(html, t).toContain(t);
    expect(html.indexOf('Head of Sales')).toBeLessThan(html.indexOf('Head of Marketing'));
    expect((html.match(/>Head fragen</g) ?? []).length).toBe(1);
    for (const id of ['sales', 'marketing']) expect(html).toContain(`href="${WEG.agenten({ h: id, r: 'einstellungen' }).replace(/&/g, '&amp;')}"`);
    for (const b of ['Marketing', 'Sales', 'Übergabe']) expect(html, b).toContain(`>${b}</div>`);
    // Ohne weitere Heads bleibt die Ansicht, wie sie war (eine Karte, kein Raster).
    const eins = renderToStaticMarkup(h(BereichAutomationenAnsicht, { werkzeug: HUB, gruppen: [], headId: 'sales', head: kopf('sales', 'Head of Sales', 0), darfBauen: true, schrauben: {}, onNeu: () => {}, onVorlage: () => {}, onHead: () => {}, onGespeichert: () => {} }));
    expect(eins).not.toContain('class="raster"');
  });
  it('Galerie und Head nehmen den Bereich (additiv, ohne Angabe wie bisher)', () => {
    expect(lies('components/os/prozesse/VorlagenGalerie.tsx')).toContain('const imBereich = (b: string) => !nurBereiche?.length || nurBereiche.includes(b);');
    expect(lies('components/os/prozesse/HeadFragen.tsx')).toContain("useState<ProzessBereich>(prozess?.bereich ?? bereichVorgabe ?? 'sales')");
  });
});

// ── Markttraktion als Werkzeug (22.10. abends): die Punkte aus HUB_MENUE in der linken Leiste — das Übergangs-Menü der Seite ist weg ──────────────────
describe('Markttraktion als Werkzeug (HubSpot-Art, Punkte aus HUB_MENUE)', () => {
  const M = MARKTTRAKTION_WERKZEUG;
  const leuchtet = (pfad: string, suche = '', handy = false) => {
    const k = werkzeugKontext(pfad, suche, handy);
    return [...werkzeugPunkte(M, k), ...werkzeugPunkte(M, k, 'fuss')].filter(p => p.an).map(p => p.id);
  };
  it('Punkte = HUB_MENUE (Reihenfolge, Name, Symbol, Ziel, Gruppe); Fuß Stammdaten; „Automationen & Head“ am Ende von Steuerung; keine dritte Ebene', () => {
    const k = werkzeugKontext('/os/markttraktion');
    const l = werkzeugPunkte(M, k);
    expect(l.map(p => p.id)).toEqual(hubGruppenAnzeige().flatMap(g => g.punkte.map(p => p.id)));
    expect(l.map(p => p.gruppe ?? null)).toEqual(hubGruppenAnzeige().flatMap(g => g.punkte.map(() => g.titel)));
    for (const p of l.filter(x => x.id !== 'automationen')) {
      const hp = HUB_PUNKTE.find(x => x.id === p.id)!;
      expect([p.label, p.href, p.titel], p.id).toEqual([hp.name, hp.ziel, hp.titel]);
      expect(p.icon, p.id).toBe(HUB_SYMBOLE[hp.symbol]);
    }
    const a = l.find(p => p.id === 'automationen')!;
    expect([a.label, a.href, a.gruppe]).toEqual([HUB_MENUE.automation.name, HUB_MENUE.automation.ziel, 'Steuerung']);
    expect(AUTOMATION_LABEL).toBe(HUB_MENUE.automation.name);
    expect(werkzeugPunkte(M, k, 'fuss').map(p => [p.id, p.label, p.href])).toEqual(HUB_MENUE.fuss.map(p => [p.id, p.name, p.ziel]));
    expect(l.every(p => p.unter.length === 0 && !p.aktion)).toBe(true); // die dritte Ebene bleibt als Reiter in der Seite
    expect([M.leistenPunkt, M.start, M.spaces]).toEqual(['Markttraktion', markttraktion(), ['business']]);
    expect(WERKZEUGE).toContain(M);
  });
  it('genau ein Punkt leuchtet je Adresse — auch auf Netzwerken, bei alten Adressen und „Automationen & Head“ (EINE Regel: hubOrtFuer)', () => {
    const faelle: [string, string, string][] = [
      ['/os/markttraktion', '', 'ueberblick'], ['/os/markttraktion', '?s=kontakte&a=akte&k=c-1', 'kontakte'], ['/os/markttraktion', '?s=firmen', 'firmen'],
      ['/os/markttraktion', '?s=firmen&a=leads', 'qualifizierung'], ['/os/markttraktion', '?s=deals&a=liste', 'deals'], ['/os/markttraktion', '?s=deals&a=auswertung', 'auswertung'],
      ['/os/markttraktion', '?s=angebot&k=ang-1', 'angebot'], ['/os/markttraktion', '?s=followup&a=powerhour', 'followup'], ['/os/markttraktion', '?s=sales&a=kampagnen', 'marketing'],
      ['/os/markttraktion', '?s=event&k=ev-1', 'events'], ['/os/markttraktion', '?s=besuche&a=wirkung', 'events'], ['/os/markttraktion', '?s=planung&a=ziele', 'planung'],
      ['/os/markttraktion', '?s=automationen', 'automationen'], ['/os/markttraktion', '?s=stammdaten&a=datenschutz', 'stammdaten'],
      ['/os/netzwerken', '', 'netzwerken'], ['/os/netzwerken/karte', '', 'netzwerken'], ['/os/netzwerken', '?event=ev-1', 'netzwerken'],
    ];
    for (const [pfad, suche, id] of faelle) {
      for (const handy of [false, true]) expect(leuchtet(pfad, suche, handy), `${pfad}${suche}`).toEqual([id]);
      expect(hubOrtFuer(pfad, suche)).toBe(id);
    }
  });
  it('jedes Ziel (Punkt, Fuß, „Automationen & Head“) gibt es, bleibt im Werkzeug und lässt genau seinen Punkt leuchten', () => {
    const k = werkzeugKontext('/os/markttraktion');
    for (const p of [...werkzeugPunkte(M, k), ...werkzeugPunkte(M, k, 'fuss')]) {
      expect(seiteDa(p.href!), p.id).toBe(true);
      expect(werkzeugVonHref(p.href!)?.id, p.id).toBe('markttraktion');
      const [pfad, suche] = p.href!.split('?');
      expect(leuchtet(pfad, suche ?? ''), p.id).toEqual([p.id]);
    }
  });
  it('„Automationen & Head“: Prozess-Bereiche Marketing · Sales · Übergabe, Heads Sales (zuerst) · Marketing · Event', () => {
    const a = automationenVon(M)[0];
    expect(a.bereiche).toEqual(['marketing', 'sales', 'uebergabe']);
    expect(a.head).toBe('sales');
    expect(automationHeads(a)).toEqual(['sales', 'marketing', 'event']);
    expect(automationenVon(PROZESSE_WERKZEUG)).toEqual([]);
    expect(automationHeads(null)).toEqual([]);
    expect(automationHeads({ ...automationenVon(HUB)[0], weitereHeads: ['sales', 'event'] })).toEqual(['sales', 'event']);
  });
  const render = async (pfad: string, suche = '') => {
    nav.pfad = pfad; nav.suche = suche;
    const { Leiste } = await import('@/components/os/Leiste');
    const html = renderToStaticMarkup(h(Leiste));
    const [desktop, mobil] = html.split('class="leiste-mobil"');
    return { desktop, mobil };
  };
  it('Leiste auf /os/markttraktion: Rückweg, Name, vier Gruppen-Überschriften, alle Punkte, genau ein leuchtender; Handy-Leiste wie bisher', async () => {
    const { desktop, mobil } = await render('/os/markttraktion', '?s=deals&a=liste');
    expect(desktop).toContain('data-werkzeug="markttraktion"');
    expect(desktop.indexOf(`>${RUECKWEG_LABEL}</span>`)).toBeLessThan(desktop.indexOf('>Überblick</span>'));
    expect((desktop.match(/role="heading"/g) ?? []).length).toBe(4);
    for (const t of ['Überblick', 'Kontakte', 'Firmen', 'Leads &amp; Qualifizierung', 'Deals', 'Angebote', 'Follow-up &amp; Power Hour', 'Marketing', 'Events', 'Netzwerken', 'Planung', 'Auswertung', 'Automationen &amp; Head', 'Stammdaten']) {
      expect(desktop, t).toContain(`>${t}</span>`);
    }
    const deals = desktop.match(/<a [^>]*href="\/os\/markttraktion\?s=deals"[^>]*>/)?.[0] ?? '';
    expect(deals).toContain('aria-current="page"');
    expect((desktop.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(desktop).not.toContain('title="Prozesse"'); // die Punkte des Space stehen erst nach „← MAKE OS“
    expect(desktop).toContain('title="Einstellungen"');
    for (const t of ['>Heute<', '>Inbox<', '>Menü<', '>ZOE<', '>Netzwerken<']) expect(mobil, t).toContain(t);
    expect(mobil).not.toContain('data-werkzeug');
  });
  it('Leiste auf /os/netzwerken: dasselbe Menü, „Netzwerken“ leuchtet', async () => {
    const { desktop } = await render('/os/netzwerken');
    expect(desktop).toContain('data-werkzeug="markttraktion"');
    const netz = desktop.match(/<a [^>]*href="\/os\/netzwerken"[^>]*>/)?.[0] ?? '';
    expect(netz).toContain('aria-current="page"');
    expect(netz).toContain('data-werkzeug-punkt="netzwerken"');
  });
  it('Blatt am Handy: das Werkzeug oben mit seinen Gruppen und dem Fuß', async () => {
    const { WerkzeugMenue } = await import('@/components/os/werkzeug/menue');
    const html = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: M, kontext: werkzeugKontext('/os/markttraktion', '?s=kontakte', true), variante: 'blatt', farbe: '#6E7EF5' }));
    expect(html).toContain('>Markttraktion</div>');
    expect((html.match(/role="heading"/g) ?? []).length).toBe(4);
    for (const p of [...HUB_PUNKTE, HUB_MENUE.automation]) expect(html, p.id).toContain(`data-werkzeug-punkt="${p.id}"`);
    expect(html).not.toContain(RUECKWEG_LABEL);
  });
});

// ── Gruppe A (22.10. abends, Entscheidung: „Ja, alle Empfehlungen“): Produkte & Mandate, Unternehmen, Finanzen, Planung als Werkzeuge ───────────
// Je Werkzeug: die Punkte (Namen, Gruppen, Reihenfolge — Finanzen NUR aus lib/finanzen/navigation.ts), genau EIN leuchtender Punkt je Adresse (auch alte
// Adressen), jedes Ziel lässt genau seinen Punkt leuchten, „Automationen & Head“ mit den Heads aus SEITEN_REGELN, die Reiterleisten der Seiten sind weg.
const { automationVon, headsDerSeiten } = W;
const PM = W.PRODUKTE_WERKZEUG;
type Sp = 'privat' | 'business';
const kx = (pfad: string, suche = '', space?: Sp, o: { handy?: boolean; nurBusiness?: boolean } = {}) => werkzeugKontext(pfad, suche, !!o.handy, { ...(space ? { space } : {}), nurBusiness: o.nurBusiness });
const leuchtet = (w: Werkzeug, pfad: string, suche = '', space?: Sp, o: { handy?: boolean; nurBusiness?: boolean } = {}) => {
  const k = kx(pfad, suche, space, o);
  return [...werkzeugPunkte(w, k), ...werkzeugPunkte(w, k, 'fuss')].flatMap(p => [p, ...p.unter]).filter(p => p.an).map(p => p.id);
};
const teilen = (href: string) => { const [p, rest = ''] = href.split('#')[0].split('?'); return { pfad: p, suche: rest ? `?${rest}` : '' }; };
/** Jedes Ziel (Punkt, Fuß, „Automationen & Head“) gibt es, bleibt im Werkzeug und lässt — dort aufgerufen — genau seinen Punkt leuchten (Anker leuchten nie). */
const zieleLeuchten = (w: Werkzeug, space: Sp, o: { nurBusiness?: boolean } = {}) => {
  const k = kx(w.pfade[0], '', space, o);
  for (const p of [...werkzeugPunkte(w, k), ...werkzeugPunkte(w, k, 'fuss')].flatMap(x => [x, ...x.unter])) {
    expect(seiteDa(p.href!), `${w.id}:${space}:${p.id} → ${p.href}`).toBe(true);
    if (p.wechselt) continue;
    expect(werkzeugVonHref(p.href!)?.id, `${w.id}:${p.id}`).toBe(w.id);
    const g = teilen(p.href!);
    const an = leuchtet(w, g.pfad, g.suche, space, o);
    if (p.href!.includes('#')) expect(an, `${w.id}:${p.id} (Anker)`).not.toContain(p.id);
    else expect(an, `${w.id}:${space}:${p.id} → ${p.href}`).toEqual([p.id]);
  }
};
/** Die Leiste am Rechner an einer Adresse (Server-Render). */
const leiste = async (pfad: string, suche = '') => {
  nav.pfad = pfad; nav.suche = suche;
  const { Leiste } = await import('@/components/os/Leiste');
  return renderToStaticMarkup(h(Leiste)).split('class="leiste-mobil"')[0];
};

describe('Gruppe A — gemeinsam: Heads NUR aus SEITEN_REGELN, „Automationen & Head“ je Space und mit einzelnen Prozessen', () => {
  it('jedes Werkzeug mit „Automationen & Head“: die Heads sind die der Seiten seiner Punkte (auch Markttraktion: dieselben wie HUB_MENUE)', () => {
    for (const w of WERKZEUGE) for (const sp of w.spaces) {
      const a = automationVon(w, sp);
      if (!a) continue;
      const k = kx(w.start.split('?')[0], '', sp);
      const ziele = [w.start, ...werkzeugPunkte(w, k).filter(p => p.id !== 'automationen' && !p.wechselt).map(p => p.href!)];
      expect(automationHeads(a), `${w.id}:${sp}`).toEqual(headsDerSeiten(ziele, sp));
    }
  });
  const ansicht = landkarteAnsicht(SYSTEM_PROZESSE, null);
  it('einzelne Prozesse stehen unter ihrem Bereich der Landkarte, nach den ganzen Bereichen, nie doppelt; unbekannte fallen weg', () => {
    const g = automationenFuer(ansicht, [], {}, ['sp-rechnung', 'sp-monatsabschluss', 'sp-gibt-es-nicht']);
    expect(g.map(x => [x.bereich.id, x.zeilen.map(z => z.id)])).toEqual([['fuehrung', ['sp-monatsabschluss']], ['unterstuetzung', ['sp-rechnung']]]);
    const z = automationenFuer(ansicht, ['unterstuetzung'], {}, ['sp-rechnung', 'sp-meilensteine']);
    expect(z.map(x => x.bereich.id)).toEqual(['unterstuetzung', 'fuehrung']);
    expect(z[0].zeilen.filter(x => x.id === 'sp-rechnung').length).toBe(1);
  });
  it('der Baustein lädt die Landkarte nur mit Prozessen (Business) und die Heads der Sicht (GET /api/agenten?space=…)', () => {
    const b = lies('components/os/werkzeug/BereichAutomationen.tsx');
    expect(b).toContain("const mitProzessen = space === 'business' && (a.bereiche.length > 0 || (a.prozesse?.length ?? 0) > 0 || weitereProzesse.length > 0);");
    expect(b).toContain('fetch(`/api/agenten?space=${space}`');
  });
  it('ein Punkt ohne Gruppe hinter einer Gruppe bekommt einen Strich; ein Punkt, der das Werkzeug verlässt, trägt ↗', async () => {
    const { WerkzeugMenue } = await import('@/components/os/werkzeug/menue');
    const T: Werkzeug = { ...HUB, id: 'test', automation: { ...automationenVon(HUB)[0], gruppe: undefined }, fuss: [{ id: 'raus', label: 'Raus', icon: List, href: () => '/os/kalender', wechselt: 'Kalender' }] };
    const html = renderToStaticMarkup(h(WerkzeugMenue, { werkzeug: T, kontext: werkzeugKontext('/os/markttraktion'), variante: 'leiste', farbe: '#6E7EF5', onZurueck: () => {} }));
    const vorAuto = html.slice(0, html.indexOf('data-werkzeug-punkt="automationen"'));
    expect(vorAuto.lastIndexOf('role="separator"')).toBeGreaterThan(vorAuto.lastIndexOf('data-werkzeug-punkt="auswertung"'));
    expect(html).toContain('title="Raus (öffnet Kalender)"');
  });
});

describe('Gruppe A · Produkte & Mandate', () => {
  it('Kunden: Mandate · Angebot: Produkte · Fulfillment: fünf Bereiche (Namen aus FULFILLMENT_BEREICHE) · Automationen & Head; Leistenpunkt öffnet', () => {
    const l = werkzeugPunkte(PM, kx('/os/mandate'));
    expect(l.map(p => [p.id, p.label, p.gruppe ?? null])).toEqual([
      ['mandate', 'Mandate', 'Kunden'], ['produkte', 'Produkte', 'Angebot'],
      ...FULFILLMENT_BEREICHE.map(b => [b.id === 'prozesse' ? 'fulfillment' : b.id, b.label, 'Fulfillment']),
      ['automationen', AUTOMATION_LABEL, null],
    ]);
    expect(FULFILLMENT_BEREICHE[0].label).toBe('Übersicht');
    expect([PM.leistenPunkt, PM.spaces, PM.start]).toEqual(['Produkte & Mandate', ['business'], '/os/mandate']);
    expect(WERKZEUGE).toContain(PM);
    expect(l.every(p => !p.unter.length && !p.aktion)).toBe(true); // die dritte Ebene bleibt in der Seite
  });
  it('genau ein Punkt je Adresse — Akte, Fall, Editor, Knoten, Baustein und alte Adressen eingeschlossen', () => {
    const faelle: [string, string, string][] = [
      ['/os/mandate', '', 'mandate'], ['/os/mandate', '?k=m-1', 'mandate'], ['/os/mandate', '?k=m-1&beenden=1', 'mandate'], ['/os/mandate', '?s=quatsch', 'mandate'],
      ['/os/mandate', '?s=produkte', 'produkte'], ['/os/mandate', '?s=produkte&k=l-1', 'produkte'], ['/os/mandate', '?s=automationen', 'automationen'],
      ['/os/mandate/fulfillment', '', 'fulfillment'], ['/os/mandate/fulfillment', '?k=fk-a', 'fulfillment'], ['/os/mandate/fulfillment', '?e=fp-a', 'fulfillment'],
      ['/os/mandate/fulfillment', '?m=m-1', 'fulfillment'], ['/os/mandate/fulfillment', '?m=m-1&r=kunde', 'fulfillment'], ['/os/mandate/fulfillment', '?m=m-1&r=ablauf', 'fulfillment'],
      ['/os/mandate/fulfillment', '?u=visualisierung', 'fulfillment'], ['/os/mandate/fulfillment', '?u=onboarding', 'onboarding'],
      ['/os/mandate/fulfillment', '?u=bausteine&b=fb-x', 'bausteine'], ['/os/mandate/fulfillment', '?u=analysen', 'analysen'], ['/os/mandate/fulfillment', '?u=kreislauf', 'kreislauf'],
    ];
    for (const [pfad, suche, id] of faelle) for (const handy of [false, true]) expect(leuchtet(PM, pfad, suche, 'business', { handy }), `${pfad}${suche}`).toEqual([id]);
    zieleLeuchten(PM, 'business');
  });
  it('„Automationen & Head“: Übergabe · Fulfillment · Ausbau + die Prozesse der Produkte; Heads Kundenerfolg, unter Produkte Sales', () => {
    const a = automationVon(PM, 'business')!;
    expect([a.bereiche, a.head, a.weitereHeads]).toEqual([['uebergabe', 'fulfillment', 'ausbau'], 'kundenerfolg', ['sales']]);
    expect(automationVon(PM, 'privat')).toBeNull();
    const s = lies('components/os/mandate/ProdukteMandate.tsx');
    expect(s).toContain('<BereichAutomationen werkzeug={PRODUKTE_WERKZEUG} space="business" weitereProzesse={produktProzesse} />');
    expect(s).toContain('.map(l => l.prozessId)');
  });
  it('die Reiterzeile Mandate · Produkte · Fulfillment und die Unter-Reiter des Fulfillments sind weg — Ebene 3 (Fall) bleibt', () => {
    const s = lies('components/os/mandate/ProdukteMandate.tsx');
    expect(s).not.toContain('<Segmente');
    expect(s).toContain('mandateOrt(params.get(\'s\'))'); // die Seite folgt der Adresse
    const f = lies('components/os/fulfillment/FulfillmentSeite.tsx');
    expect(f).not.toContain('<Segmente');
    expect(f).not.toContain('FULFILLMENT_BEREICHE');
    expect(f).toContain('<Reiter<FallReiter>');
  });
  it('Leiste: das Menü mit den Gruppen Kunden · Angebot · Fulfillment; genau der Bereich leuchtet', async () => {
    const m = await leiste('/os/mandate/fulfillment', '?u=bausteine');
    expect(m).toContain('data-werkzeug="produkte-mandate"');
    for (const t of ['>Kunden<', '>Angebot<', '>Fulfillment<']) expect(m, t).toContain(t);
    expect(m.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0]).toContain('data-werkzeug-punkt="bausteine"');
  });
});


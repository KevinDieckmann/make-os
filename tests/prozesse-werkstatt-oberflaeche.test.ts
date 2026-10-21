// ─── Prozesse · Werkstatt — Oberfläche (Etappe B2, 21.10.; Punkte 8, 16–19, 22, 23, 25, 43; Kevins Bild der Werkstatt) ─────────────────────────────────────
// Ohne Browser: die Zeichnung der Knoten (n8n-Stil, Andockpunkte, Raute mit vier Punkten, „+“), die Fläche (Bahnen, Rahmen, Fäden als Flow, Fehlerkante rot
// gestrichelt), das Panel (Maske, Agent mit drei Andockpunkten, Schloss), die Verdrahtung in der Seite und Wächter (ein Schreibweg, keine toten Reiter, Flow,
// reduzierte Bewegung, ein Tor der Routen).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/prozesse' }));

import { neuerProzess } from '@/lib/prozesse/bestand';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { anlegen, type Fassung, type Ergebnis } from '@/lib/prozesse/werkstatt-aktionen';
import { neuerKnoten, maskeAnwenden, knotenUnterzeile } from '@/lib/prozesse/werkstatt-maske';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { KnotenZeichnung } from '@/components/os/prozesse/WerkstattKnoten';
import { WerkstattFlaeche } from '@/components/os/prozesse/WerkstattFlaeche';
import { WerkstattPanel, type PanelProps } from '@/components/os/prozesse/WerkstattPanel';
import { WERKSTATT_REITER } from '@/components/os/prozesse/Werkstatt';
import { prozesseZugang } from '@/lib/prozesse/zugang';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';

const wurzel = process.cwd();
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
let n = 0;
const kennung = () => `fk-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const knoten = (id: string, titel?: string) => neuerKnoten(katalogEintrag(id)!, kennung(), titel);
const team = [{ id: 'konto-a', name: 'Person A' }];

function beispiel(): ProzessDefinition {
  const d = neuerProzess({ id: 'pz-00000000-0000-4000-8000-000000000001', titel: 'Lead nachfassen', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-21T10:00:00Z', kennung }).entwurf;
  const st = d.knoten.find(k => k.form === 'ausloeser')!;
  const r = knoten('entscheidung.mensch', 'Antwort erhalten?');
  const m = knoten('inbox.mail-entwurf', 'Angebot senden');
  const a = maskeAnwenden(knoten('agent.zoe', 'Antwort einordnen'), katalogEintrag('agent.zoe')!, { auftrag: 'Einordnen', budgetCent: 5, brain: true, akte: true, werkzeuge: ['create_task'], warumKeineRegel: 'Freie Antworten lassen sich nicht über Felder prüfen.' });
  const t = knoten('aufgabe.anlegen', 'Nachfassen planen');
  let f: Fassung = { knoten: d.knoten };
  f = gut(anlegen(f, r, { nach: st.id }));
  f = gut(anlegen(f, m, { nach: r.id }));
  f = gut(anlegen(f, a, { nach: m.id }));
  f = gut(anlegen(f, t, { nach: r.id, ausgang: 'nein' }));
  f = { ...f, knoten: f.knoten.map(k => (k.id === a.id ? { ...k, zweige: { fehler: t.id } } : k)) };
  return schlossSetzen({ ...d, knoten: f.knoten }).definition;
}
const svg = (kind: ReturnType<typeof h>) => renderToStaticMarkup(h('svg', null, kind));

describe('Knoten im n8n-Stil (Punkt 22)', () => {
  const d = beispiel();
  const l = werkstattLage(d, { team });
  const k = (form: string) => d.knoten.find(x => x.form === form && !x.schloss)!;
  const zeichne = (x: ReturnType<typeof k>, o: Partial<Parameters<typeof KnotenZeichnung>[0]> = {}) =>
    svg(h(KnotenZeichnung, { k: x, l: l.knoten.get(x.id)!, unterzeile: knotenUnterzeile(x), belegt: new Set<string>(), ...o }));
  it('Auslöser mit Blitz-Marke, ohne Eingang; Name und Unterzeile unter dem Körper', () => {
    const html = zeichne(k('ausloeser'));
    expect(html).toContain('lucide-zap');
    expect(html).not.toContain('|ein"');
    expect(html).toContain('>Start<');
    expect(html).toContain('von Hand');
  });
  it('Raute: vier feste Andockpunkte (Eingang, ja, nein, Fehler) — freie Ausgänge mit „+“ und Namen, „nein · offen“', () => {
    const r = k('entscheidung');
    const html = zeichne({ ...r, zweige: undefined }, { gewaehlt: true });
    for (const a of ['ein', 'ja', 'nein', 'fehler']) expect(html).toContain(`data-ws-anschluss="${r.id}|${a}"`);
    expect(html).toContain(`data-ws-plus="${r.id}|nein"`);
    expect(html).toContain('nein · offen');
  });
  it('Agent: breiter, drei Andockpunkte mit den angedockten Teilen darunter (Modell · Gedächtnis · Werkzeuge)', () => {
    const html = zeichne(k('agent'));
    for (const w of ['MODELL', 'GEDÄCHTNIS', 'WERKZEUGE']) expect(html).toContain(w);
    expect(html).toContain('data-ws-unter=');
    expect(html).toContain('>Brain<');
    expect(html).toContain('>Akte<');
  });
  it('Freigabe-Schloss sichtbar (Schloss-Marke, „nicht entfernbar“) und am Knoten davor die Marke „mit Freigabe“', () => {
    const s = d.knoten.find(x => x.schloss)!;
    expect(zeichne(s)).toContain('lucide-lock');
    expect(knotenUnterzeile(s)).toBe('Freigabe · nicht entfernbar');
    const m = d.knoten.find(x => x.id === s.schloss!.fuer)!;
    expect(knotenUnterzeile(m, { mitSchloss: true })).toBe('Mail-Entwurf · Stapel');
  });
});

describe('Die Fläche: Bahnen, Rahmen, Fäden (Punkte 18, 19, 25)', () => {
  const d = beispiel();
  const l = werkstattLage(d, { team });
  const nichts = () => {};
  const html = renderToStaticMarkup(h(WerkstattFlaeche, {
    d, lage: l, szene: 's', auswahl: [], kanteWahl: null, rahmenWahl: null, andockWahl: null, probe: null, befundJe: new Map<string, 'fehler' | 'offen'>(), unterzeile: k => knotenUnterzeile(k),
    mitSchloss: new Set<string>(), nurLesen: false, raster: true, label: 'Werkstatt', onAuswahl: nichts, onKante: nichts, onRahmen: nichts, onUnter: nichts, onZiehen: nichts,
    onVerbinden: nichts, onAnhaengen: nichts, onZuklappen: nichts, onTaste: () => false,
  }));
  it('Punktraster, Faden-Ebene unter dem SVG, Bahnen mit Namen, Rahmen mit Zuklappen', () => {
    expect(html).toContain('class="ff-flow-ebene"');
    expect(html).toContain('ff-flaeche-buehne pw-buehne');
    expect(html).toMatch(/<pattern[^>]+id="ws-raster-/);
    for (const b of l.bahnen) expect(html).toContain(b.titel.split(' ')[0]);
    expect(html).toContain('PHASE 1');
    expect(html).toContain('zuklappen');
  });
  it('jede Kante: Strich für die Zeit ohne Flow (data-teil="pfad"), breite Trefferfläche, Fehlerkante zusätzlich rot gestrichelt; Rauten-Ausgänge beschriftet', () => {
    expect((html.match(/data-ws-kante=/g) ?? []).length).toBe(l.kanten.length);
    expect((html.match(/data-teil="pfad"/g) ?? []).length).toBe(l.kanten.length);
    expect(html).toMatch(/stroke-dasharray="6 5"/);
    expect(html).toContain('>nein<');
    expect(html).toContain('>Fehler<');
  });
  it('Quelltext: der Flow ist die Linie (flowEbene, reduzierte Bewegung = Standbild), Eingabe nur am SVG, der mitlaufende Faden beim Ziehen', () => {
    const f = lies('components/os/prozesse/WerkstattFlaeche.tsx');
    expect(f).toContain('flowEbene(c, b, { ruhig: bewegungReduziert()');
    expect(f).toContain('flaecheEingabe(el, {');
    expect(f).toContain('ebene.current?.zug(');
    expect(f).toContain('hilfslinien(box, andere');
    expect(f).not.toMatch(/(window|document)\.addEventListener\(\s*['"](wheel|gesture|touch|pointer)/);
    expect(f).toContain('if (ruhig()) { setze(ziel); return; }');
  });
});

describe('Das Panel (Maske, Agent, Schloss — Punkte 22, 55, 62)', () => {
  const d = beispiel();
  const l = werkstattLage(d, { team });
  const nichts = () => {};
  const basis: PanelProps = {
    d, auswahl: { 'team-person': [{ id: 'konto-a', label: 'Person A' }], werkzeug: [{ id: 'create_task', label: 'create_task' }] }, modelle: [], befunde: [], raete: [], probe: null, kanten: l.kanten, nurLesen: false,
    knoten: null, phase: null, kante: null, zettel: null, andock: null, titelFokus: 0, onKnoten: nichts, onSteckbrief: nichts, onZweig: nichts, onPfeilText: nichts, onLoeschen: nichts,
    onKopieren: nichts, onPhase: nichts, onZettel: nichts, agentName: () => 'ZOE',
  };
  it('ohne Auswahl der Steckbrief: Bereich, Fall, Eigner aus dem Team, Kriterien', () => {
    const html = renderToStaticMarkup(h(WerkstattPanel, basis));
    for (const w of ['Steckbrief', 'Bereich', 'Woran hängt ein Lauf?', 'Eigner', 'Person A', 'Startkriterium', 'Endkriterium']) expect(html, w).toContain(w);
  });
  it('Agent: Maske nach den drei Andockpunkten, Rechte-Profil mit Ampel', () => {
    const a = d.knoten.find(x => x.form === 'agent')!;
    const html = renderToStaticMarkup(h(WerkstattPanel, { ...basis, knoten: a }));
    for (const w of ['Andockpunkt Modell', 'Andockpunkt Gedächtnis', 'Andockpunkt Werkzeuge', 'Rechte-Profil', 'Warum reicht keine Regel?']) expect(html, w).toContain(w);
  });
  it('Freigabe-Schloss: sichtbar, nicht entfernbar (kein Löschen-Knopf); der Schritt davor sagt „Mit Freigabe“', () => {
    const s = d.knoten.find(x => x.schloss)!;
    const html = renderToStaticMarkup(h(WerkstattPanel, { ...basis, knoten: s }));
    expect(html).toContain('lässt sich nicht entfernen');
    expect(html).not.toContain('>Löschen<');
    const m = d.knoten.find(x => x.id === s.schloss!.fuer)!;
    expect(renderToStaticMarkup(h(WerkstattPanel, { ...basis, knoten: m }))).toContain('Mit Freigabe');
  });
});

describe('Verdrahtung und Wächter', () => {
  it('Werkstatt: EIN Schreibweg, Stand/409 mit „Deine Fassung“, Sitzungsspeicher, Probelauf über den Vertrag, keine toten Reiter', () => {
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain("aktion: 'entwurf', id: prozessId, stand: stand.current");
    expect(w).toContain('Meine Fassung speichern');
    expect(w).toContain('Andere Fassung übernehmen');
    expect(w).toContain('make-prozess-entwurf:');
    expect(w).toContain("addEventListener('beforeunload'");
    expect(w).toContain('PROBELAUF_PFAD');
    expect(w).toContain('setProbeHinweis(PROBE_FEHLT)');
    // Seit 22.10. (Läufe-Ansicht): Bauen · Läufe · Tests — die Reiter kamen mit dem Lauf-Motor (tests/prozesse-laeufe-oberflaeche.test.ts).
    expect(WERKSTATT_REITER.map(r => r.id)).toEqual(['bauen', 'laeufe', 'tests']);
    expect(w).toContain('WERKSTATT_REITER.length > 1 &&');
    expect(w).not.toMatch(/fetch\([^)]*prozesse\/werkstatt[^)]*method/); // geschrieben wird nur über werkstattSenden
    expect(lies('components/os/prozesse/werkstatt-daten.ts')).toContain("kette = lauf.catch(() => undefined);");
  });
  it('Seite: dritte Darstellung „Werkstatt“, „+ Prozess“, unter 768 px nur ansehen, Esc der Werkstatt verlässt kein Vollbild', () => {
    const s = lies('components/os/prozesse/ProzesseSeite.tsx');
    expect(s).toContain("ansicht === 'werkstatt'");
    expect(s).toContain("useMedien('(max-width: 767px)')");
    expect(s).toContain('<NeuerProzessFenster');
    expect(s).toContain('e.defaultPrevented');
    expect(lies('app/globals.css')).toContain('.pz-voll .pw-werkstatt { display: flex; flex-direction: column; height: 100%; }');
  });
  it('EIN Tor der Routen: werkstattZugang IST prozesseZugang', () => {
    expect(werkstattZugang).toBe(prozesseZugang);
  });
});

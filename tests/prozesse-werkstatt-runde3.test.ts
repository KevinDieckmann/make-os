// ─── Prozesse · Werkstatt — Feinschliff Runde 3 (24.10., Befunde aus dem zweiten Bau-Test im Demo) ─────────────────────────────────────────────────────────
// Je Befund ein Wächter: (1) Mehrfach-Dialog mit derselben Wertauswahl wie das Panel (Kennung statt Name) und eine Meldung je Fall, die genau sagt, was fehlt.
// Erfundene Werte, kein Netz, kein Modell.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { mehrfachEntscheidung, mehrfachFallFehlt, mehrfachMeldung, type Ergebnis, type Fassung, type MehrfachFall } from '@/lib/prozesse/werkstatt-aktionen';
import { bedingungWertBefunde, feldWerte } from '@/lib/prozesse/feld-werte';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { feldTitelVon } from '@/lib/prozesse/ausloeser';
import { starten, voran, probeZeilen } from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe } from '@/lib/prozesse/lauf-typen';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-9300-${String(++n).padStart(12, '0')}`;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

// Erfundene Produkte (Kennung + Name), wie sie GET /api/prozesse/katalog?auswahl=1 liefert.
const PRODUKTE = [{ id: 'l-probe-cockpit', label: 'Cockpit-Lizenz' }, { id: 'l-probe-diagnose', label: 'Klarheits-Diagnose' }, { id: 'l-probe-aufbau', label: 'Vertriebsaufbau' }];
const AUSWAHL = { produkt: PRODUKTE };

describe('(1) Mehrfach-Dialog: Wertauswahl wie im Panel, Meldung je Fall', () => {
  it('der Dialog nimmt dieselbe Wertauswahl wie das Panel (feldWerte mit den Auswahllisten) — kein Freitext für Kennungs-Felder', () => {
    const q = lies('components/os/prozesse/WerkstattMehrfach.tsx');
    expect(q).toContain("feldWerte(feldId, auswahl, d)");
    expect(q).toContain('werteVon={werteVon}');
    expect(lies('components/os/prozesse/Werkstatt.tsx')).toContain('auswahl={auswahlListen}');
    // Dieselbe Quelle: das Produkt-Feld bietet Namen an und speichert die Kennung.
    expect(feldWerte('mandat.produkt', AUSWAHL)).toEqual(PRODUKTE);
  });
  const bauen = () => {
    const e = neuerProzess({ id: 'pz-00000000-0000-4000-9300-000000000001', titel: 'Mandat-Start (Probe)', bereich: 'uebergabe', fallArt: 'mandat', von: 'test', jetzt: '2026-10-24T10:00:00Z', kennung });
    const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
    const fall = (titel: string, id: string): MehrfachFall => ({ titel, bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert: id }] });
    const f = gut(mehrfachEntscheidung({ knoten: e.entwurf.knoten }, { nach: start.id, faelle: [fall('Cockpit', 'l-probe-cockpit'), fall('Diagnose', 'l-probe-diagnose'), fall('Aufbau', 'l-probe-aufbau')], sonst: 'aufgabe', kennung, feldName: feldTitelVon }));
    const d: ProzessDefinition = { ...e.entwurf, knoten: f.knoten };
    return { d };
  };
  it('Produkt aus der Liste → Rauten mit Kennung, kein Befund „ist ein Name“/„nicht in der Liste“', () => {
    const { d } = bauen();
    const rauten = d.knoten.filter(k => k.form === 'entscheidung');
    expect(rauten.map(r => r.raute?.art === 'regel' ? r.raute.bedingungen?.[0]?.wert : null)).toEqual(['l-probe-cockpit', 'l-probe-diagnose', 'l-probe-aufbau']);
    const ids = (q: string) => (q === 'produkt' ? PRODUKTE.map(p => p.id) : null);
    for (const r of rauten) {
      expect(bedingungWertBefunde(r.raute?.art === 'regel' ? r.raute.bedingungen : [], { ids: ids as never, d, wo: r.titel, feldName: feldTitelVon })).toEqual([]);
    }
    const befunde = definitionPruefen(d, { auswahl: ids as never });
    expect(befunde.filter(b => /steht nicht in der Liste|ist ein Name/.test(b.text))).toEqual([]);
  });
  it('der Probelauf trifft: Produkt = Kennung der Diagnose → genau die Raute „Diagnose“ sagt ja', () => {
    const { d } = bauen();
    const s = starten(leereLaeufe(), { id: 'pl-00000000-0000-4000-9300-000000000001', prozessId: d.id, version: 1, def: d, fall: { art: 'mandat', id: 'm-probe' }, modus: 'schatten', person: null, ausloeser: { art: 'hand', knoten: d.knoten.find(k => k.form === 'ausloeser')!.id }, automatisch: false, jetzt: '2026-10-24T10:00:00Z' });
    if (!s.ok) throw new Error(s.grund);
    const v = voran(s.lauf, d, { jetzt: '2026-10-24T10:00:00Z', titel: d.titel, daten: { 'mandat.produkt': 'l-probe-diagnose' }, rolle: () => ({ speicher: 'probe' }) as never }, 'schatten');
    const z = probeZeilen(v.lauf, d).schritte;
    const titel = (id: string) => d.knoten.find(k => k.id === id)?.titel;
    expect(z.filter(x => /→ ja/.test(x.text)).map(x => titel(x.knotenId))).toEqual(['Diagnose']);
    expect(z.some(x => titel(x.knotenId) === 'Sonst: von Hand prüfen')).toBe(false);
  });
  it('die Meldung nennt je Fall genau, was fehlt — nie „Name“, wenn der Name gesetzt ist', () => {
    const name = (id: string) => feldTitelVon(id);
    expect(mehrfachFallFehlt({ titel: 'Diagnose', bedingungen: [] }, name)).toEqual(['Bedingung']);
    expect(mehrfachFallFehlt({ titel: '  ', bedingungen: [] }, name)).toEqual(['Name', 'Bedingung']);
    expect(mehrfachFallFehlt({ titel: 'Cockpit', bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert: '' }] }, name)).toEqual([`Wert bei „${name('mandat.produkt')}“`]);
    expect(mehrfachFallFehlt({ titel: 'Cockpit', bedingungen: [{ feld: 'mandat.produkt', op: 'gesetzt' }] }, name)).toEqual([]);
    expect(mehrfachFallFehlt({ titel: 'Cockpit', bedingungen: [{ feld: 'mandat.produkt', op: 'einer-von', wert: [] }, { feld: 'mandat.status', op: 'gleich', wert: 'aktiv' }] }, name))
      .toEqual([`Wert bei „${name('mandat.produkt')}“ (Bedingung 1)`]);
    const m = mehrfachMeldung([
      { titel: 'Cockpit', bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert: 'l-probe-cockpit' }] },
      { titel: 'Diagnose', bedingungen: [] },
      { titel: '', bedingungen: [{ feld: 'mandat.produkt', op: 'gleich', wert: '' }] },
    ], name)!;
    expect(m).toBe(`Fall 2 „Diagnose“: Bedingung fehlt. Fall 3: Name und Wert bei „${name('mandat.produkt')}“ fehlen.`);
    expect(m).not.toMatch(/Fall 1/);
    // Dieselbe Meldung kommt aus der Bau-Hilfe — nichts wird angelegt.
    const e = neuerProzess({ id: 'pz-00000000-0000-4000-9300-000000000002', titel: 'Probe', bereich: 'uebergabe', fallArt: 'mandat', von: 'test', jetzt: '2026-10-24T10:00:00Z', kennung });
    const r = mehrfachEntscheidung({ knoten: e.entwurf.knoten }, { nach: e.entwurf.knoten.find(k => k.form === 'ausloeser')!.id, faelle: [{ titel: 'A', bedingungen: [{ feld: 'mandat.status', op: 'gleich', wert: 'aktiv' }] }, { titel: 'Diagnose', bedingungen: [] }], kennung, feldName: name });
    expect(r).toEqual({ ok: false, grund: 'Fall 2 „Diagnose“: Bedingung fehlt.' });
  });
});

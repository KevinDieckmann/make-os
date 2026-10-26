// Werkstatt-Prozesse als Datei (26.10.): „Als Datei sichern“ und Import (Vorschau → Entwurf). Rein — ohne Server.
import { describe, it, expect } from 'vitest';
import { ALLE_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { leerProzesse } from '@/lib/prozesse/bestand';
import { prozessAlsDatei, prozessDateiAnwenden, prozessDateiLesen, prozessDateiName, PROZESS_DATEI_GRENZEN } from '@/lib/prozesse/datei-import';
import { alleSchritte } from '@/lib/prozesse/fluss';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import type { ProzessRechte } from '@/lib/prozesse/rollen';

let n = 0;
const neueKennung = (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-a000-${String(++n).padStart(12, '0')}`;
const VOLL: ProzessRechte = { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true };
const J = '2026-10-26T20:00:00.000Z';
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
// Eine Vorlage mit Auslöser UND Agent-Schritt (Bauplan: „Ein Produkt-Prozess mit Auslöser und Agent-Schritt kommt per Datei rein“).
const MIT_AGENT = ALLE_VORLAGEN.find(v => alleSchritte(v.definition).some(s => s.schritt.form === 'agent') && alleSchritte(v.definition).some(s => s.schritt.form === 'ausloeser'))!;

describe('Als Datei sichern → importieren', () => {
  it('Rundweg: gleiche Struktur, neue Kennungen, ohne Personen, als Entwurf', () => {
    expect(MIT_AGENT).toBeTruthy();
    const eintrag = { entwurf: { ...MIT_AGENT.definition, eigner: 'pia' } as ProzessDefinition };
    const { datei } = prozessAlsDatei(eintrag);
    expect(datei.format).toBe('make-os/prozess');
    expect(datei.prozesse[0]).not.toHaveProperty('eigner');
    const g = prozessDateiLesen(json(datei), { neueKennung });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const d = g.prozesse[0].definition;
    expect(d.id).toMatch(/^pz-/);
    expect(d.knoten.every(k => !MIT_AGENT.definition.knoten.some(a => a.id === k.id))).toBe(true);
    expect(alleSchritte(d).length).toBe(alleSchritte(MIT_AGENT.definition).length);
    expect(g.prozesse[0].vorschau.agenten).toBeGreaterThan(0);
    expect(g.prozesse[0].vorschau.ausloeser.length).toBeGreaterThan(0);
    const r = prozessDateiAnwenden(leerProzesse(), json(datei), { person: 'pia', jetzt: J, rechte: VOLL, dateiName: 'prozess-probe.json', neueKennung });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datei.prozesse).toHaveLength(1);
    expect(r.datei.prozesse[0]).toMatchObject({ status: 'entwurf', versionen: [] });
    expect(r.datei.prozesse[0].entwurf.herkunft).toEqual({ art: 'import', datei: 'prozess-probe.json', am: J });
    expect(r.datei.prozesse[0].entwurf).not.toHaveProperty('eigner');
    // Dieselbe Datei noch einmal: der zweite heißt „… (Import)“ (Liste ohne doppelte Namen), auch sein oberster Knoten.
    const r2 = prozessDateiAnwenden(r.datei, json(datei), { person: 'pia', jetzt: J, rechte: VOLL, neueKennung });
    expect(r2.ok && r2.datei.prozesse[1].entwurf.titel).toBe(`${MIT_AGENT.definition.titel} (Import)`);
    expect(r2.ok && r2.datei.prozesse[1].entwurf.knoten.find(k => !k.elternId)?.titel).toBe(`${MIT_AGENT.definition.titel} (Import)`);
  });
  it('lesbare Kennungen in einer handgeschriebenen Datei — Verweise folgen den neuen Kennungen', () => {
    const quelle = MIT_AGENT.definition;
    const karte = new Map(quelle.knoten.map((k, i) => [k.id, `s-${i + 1}`]));
    const m = (x?: string) => (x ? karte.get(x) ?? x : x);
    const hand = json({ titel: 'Von Hand', bereich: quelle.bereich, fallArt: quelle.fallArt, knoten: quelle.knoten.map(k => ({
      ...k, id: m(k.id), ...(k.elternId ? { elternId: m(k.elternId) } : {}),
      ...(k.zweige ? { zweige: Object.fromEntries(Object.entries(k.zweige).map(([a, b]) => [a, m(b)])) } : {}),
      ...(k.schloss ? { schloss: { ...k.schloss, fuer: m(k.schloss.fuer) } } : {}),
    })) });
    const g = prozessDateiLesen(hand, { neueKennung });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const d = g.prozesse[0].definition;
    const ids = new Set(d.knoten.map(k => k.id));
    expect(d.knoten.every(k => !k.elternId || ids.has(k.elternId))).toBe(true);
    expect(d.knoten.every(k => Object.values(k.zweige ?? {}).every(z => !z || ids.has(z)))).toBe(true);
    expect(d.titel).toBe('Von Hand');
  });
  it('lehnt ab: fremdes Format, leere Datei, zu viele, Knoten ohne Titel, ohne Recht; Dateiname sauber', () => {
    expect(prozessDateiLesen({ format: 'make-os/pakete', pakete: [] }, { neueKennung })).toMatchObject({ ok: false, status: 400 });
    expect(prozessDateiLesen({ format: 'make-os/prozess', prozesse: [] }, { neueKennung })).toMatchObject({ ok: false, status: 400 });
    expect(prozessDateiLesen('quatsch', { neueKennung })).toMatchObject({ ok: false, status: 400 });
    const viele = { format: 'make-os/prozess', prozesse: Array.from({ length: PROZESS_DATEI_GRENZEN.prozesse + 1 }, () => MIT_AGENT.definition) };
    expect(prozessDateiLesen(json(viele), { neueKennung })).toMatchObject({ ok: false, status: 413 });
    const kaputt = json({ ...MIT_AGENT.definition, knoten: [...MIT_AGENT.definition.knoten, { id: 's-x', elternId: MIT_AGENT.definition.knoten[0].id, rang: 9 }] });
    const k = prozessDateiLesen(kaputt, { neueKennung });
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.fehler).toContain('ohne Kennung oder Titel');
    expect(prozessDateiAnwenden(leerProzesse(), json(MIT_AGENT.definition), { person: 'pia', jetzt: J, rechte: { ...VOLL, entwurf: false }, neueKennung })).toMatchObject({ ok: false, status: 403 });
    expect(prozessDateiName('Kick-off & Übergabe: Prüfen')).toBe('prozess-kick-off-uebergabe-pruefen.json');
  });
});

// ─── Prozesse · Werkstatt bau-fertig — Kopieren zwischen Prozessen (Punkt 13) und Mehrfach-Entscheidung (Punkt 15) (22.10.) ───────────────────────────────
// Rein: die Ablage im Browser-Speicher trägt keine Personen (ohnePersonen), wird beim Lesen gesäubert (Schlösser, Auslöser, Unlesbares fallen weg), ist nach 24 h
// leer; Einfügen in einem anderen Prozess gibt neue Kennungen. Die Mehrfach-Entscheidung wird zu einer Kaskade aus Rauten nach Regel — das Modell bleibt.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ablageAus, ablageFuerSpeicher, ABLAGE_STUNDEN } from '@/lib/prozesse/ablage';
import { kopieren, einfuegen, mehrfachEntscheidung, type Fassung, type Ergebnis } from '@/lib/prozesse/werkstatt-aktionen';
import { kantenVon, flussPruefen, seitenZiele } from '@/lib/prozesse/fluss';
import { katalogEintrag, ROLLE_ZUSTAENDIG, POSTFACH_DES_LAUFS } from '@/lib/prozesse/baustein-katalog';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { definition, schritt, fk, J } from './fixtures/prozess-bau';

const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
let n = 500;
const kennung = () => fk(++n);
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('Punkt 13 · Kopieren und Einfügen zwischen Prozessen — ohne Personen', () => {
  const def = schlossSetzen(definition([
    schritt(30, 'Aufgabe für Anna', 1, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Anrufen', wer: 'team-anna' } } }),
    schritt(31, 'Mail', 2, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'pf-0000', an: 'fall.kontakt', betreff: 'Hallo', text: 'Text' } } }),
    schritt(32, 'Telegram', 3, { form: 'nachricht', katalog: { id: 'telegram.hinweis', werte: { an: 'pia', hinweis: 'wartet' } } }),
  ])).definition;
  const f: Fassung = { knoten: def.knoten, zettel: [{ id: fk(90), text: 'Notiz', pos: { x: 0, y: 0 }, von: 'pia', am: J }] };
  it('die Ablage im Browser-Speicher: Personen → „Zuständig im Fall“, eigenes Postfach → Postfach des Laufs, Konten leer, Zettel ohne Verfasser', () => {
    const a = kopieren(f, [fk(30), fk(31), fk(32), fk(90)])!;
    const sp = ablageFuerSpeicher(a, { quelle: def.id, jetzt: J });
    const w = (id: string) => sp.ablage.knoten.find(k => k.id === id)?.katalog?.werte ?? {};
    expect(w(fk(30)).wer).toBe(ROLLE_ZUSTAENDIG);
    expect(w(fk(31)).postfach).toBe(POSTFACH_DES_LAUFS);
    expect(w(fk(32)).an).toBeUndefined();
    expect(sp.ablage.zettel[0]).not.toHaveProperty('von');
    expect(sp.hinweise.length).toBeGreaterThan(0);
    const roh = JSON.stringify(sp);
    for (const x of ['team-anna', 'pf-0000', '"pia"']) expect(roh).not.toContain(x);
  });
  it('gelesen wird gesäubert: Schlösser und Auslöser fallen weg, Unlesbares bzw. Altes (> 24 h) ergibt nichts', () => {
    const a = kopieren(f, [fk(31)])!;
    const sp = ablageFuerSpeicher(a, { quelle: def.id, jetzt: J });
    const manipuliert = { ...sp, ablage: { ...sp.ablage, knoten: [...sp.ablage.knoten, { id: fk(91), titel: 'Schloss', rang: 1, form: 'freigabe', schloss: { fuer: fk(31), grund: 'aussen' } }, { id: fk(92), titel: 'Start', rang: 0, form: 'ausloeser' }, { kaputt: true }] } };
    const g = ablageAus(JSON.stringify(manipuliert), J)!;
    expect(g.ablage.knoten.map(k => k.id)).toEqual([fk(31)]);
    expect(ablageAus('kaputt', J)).toBeNull();
    expect(ablageAus(JSON.stringify(sp), new Date(Date.parse(J) + (ABLAGE_STUNDEN + 1) * 3_600_000).toISOString())).toBeNull();
  });
  it('in einem anderen Prozess eingefügt: neue Kennungen, Verbindungen zwischen den Kopierten bleiben', () => {
    const a = kopieren(f, [fk(30), fk(31)])!;
    const g = ablageAus(JSON.stringify(ablageFuerSpeicher(a, { quelle: def.id, jetzt: J })), J)!;
    const ziel = definition([schritt(40, 'Erster Schritt', 1)]);
    const r = gut(einfuegen({ knoten: ziel.knoten }, g.ablage, { phaseId: fk(2), nach: fk(40), kennung }));
    const neu = r.knoten.filter(k => !ziel.knoten.some(x => x.id === k.id));
    expect(neu).toHaveLength(2);
    expect(neu.every(k => k.id !== fk(30) && k.id !== fk(31))).toBe(true);
  });
});

describe('Punkt 15 · Mehrfach-Entscheidung — eine Kaskade aus Rauten nach Regel', () => {
  const basis = () => {
    const d = definition([schritt(10, 'Lead prüfen', 1), schritt(11, 'Groß betreuen', 2), schritt(12, 'Ende', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } })]);
    return { knoten: d.knoten } as Fassung;
  };
  const fall = (titel: string, wert: string, ziel?: string) => ({ titel, bedingungen: [{ feld: 'deal.stufe', op: 'gleich' as const, wert }], ...(ziel ? { ziel } : {}) });
  it('drei Fälle → drei Rauten: Fall 1 im Ablauf, jeder weitere am „nein“ der vorigen, „sonst“ als Aufgabe; der Fluss bleibt fehlerfrei', () => {
    const f = basis();
    const r = gut(mehrfachEntscheidung(f, { nach: fk(10), faelle: [fall('Angebot', 'angebot'), fall('Verhandlung', 'verhandlung', fk(11)), fall('Abschluss', 'abschluss', fk(12))], sonst: 'aufgabe', kennung }));
    const rauten = r.knoten.filter(k => k.form === 'entscheidung');
    expect(rauten).toHaveLength(3);
    expect(rauten.every(k => k.raute?.art === 'regel' && k.katalog?.id === 'entscheidung.regel')).toBe(true);
    const [r1, r2, r3] = ['Angebot', 'Verhandlung', 'Abschluss'].map(t => r.knoten.find(k => k.titel === t)!);
    expect(kantenVon(r).find(k => k.von === fk(10) && k.ausgang === 'weiter')?.nach).toBe(r1.id);
    expect(r1.zweige?.nein).toBe(r2.id);
    expect(r2.zweige).toMatchObject({ nein: r3.id, ja: fk(11) });
    const sonst = r.knoten.find(k => k.titel === 'Sonst: von Hand prüfen')!;
    expect(r3.zweige?.nein).toBe(sonst.id);
    expect(seitenZiele(r.knoten).get(sonst.id)).toBe(r3.id);
    expect(flussPruefen(r).filter(b => b.stufe === 'fehler')).toEqual([]);
    expect(katalogEintrag(sonst.katalog!.id)).toBeTruthy();
  });
  it('Regeln: mindestens zwei Fälle, je Fall Name und Bedingung, Ziel in derselben Phase; ein Kreis → Grund, nichts geändert', () => {
    const f = basis();
    expect(mehrfachEntscheidung(f, { nach: fk(10), faelle: [fall('A', 'a')], kennung }).ok).toBe(false);
    expect(mehrfachEntscheidung(f, { nach: fk(10), faelle: [fall('A', 'a'), { titel: 'B', bedingungen: [] }], kennung }).ok).toBe(false);
    expect(mehrfachEntscheidung(f, { nach: fk(10), faelle: [fall('A', 'a'), fall('B', 'b', fk(999))], kennung }).ok).toBe(false);
    // Ziel = der Schritt davor → Kreis im Ablauf.
    const k = mehrfachEntscheidung(f, { nach: fk(11), faelle: [fall('A', 'a'), fall('B', 'b', fk(10))], kennung });
    expect(k.ok).toBe(false);
    if (!k.ok) expect(k.grund).toMatch(/Kreis/);
  });
  it('die Oberfläche: Bau-Hilfe in der Knoten-Auswahl, ein eigenes Fenster', () => {
    expect(lies('components/os/prozesse/WerkstattFormauswahl.tsx')).toContain('Mehrfach-Entscheidung …');
    expect(lies('components/os/prozesse/Werkstatt.tsx')).toContain('mehrfachEntscheidung(f, { nach: mehrfach, faelle, sonst');
    // Kopieren zwischen Prozessen läuft über den Browser-Speicher (nie über den Server).
    expect(lies('components/os/prozesse/Werkstatt.tsx')).toContain('ablageFuerSpeicher(a, { quelle: prozessId, jetzt: am })');
  });
});


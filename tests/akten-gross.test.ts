// Akten öffnen groß (30.10., Kevin: „Wenn ich hier auf einen Kunden gehe, möchte ich, dass sich die Kundenakte wirklich groß öffnet … auch wenn ich
// in Firmen bin. In der Markttraktion genau das Gleiche … wir müssen immer sauber in die Akte gehen können und alles sauber anpassen können.“)
// Wächter: ein Klick auf Kontakt, Firma, Mandat oder Deal (Liste) öffnet die ganze Akte als eigene Seite; jeder Link mit Kennung — auch alte
// Adressen aus Meldungen, Aufgaben und Brain — landet in derselben Akte; die Listen tragen kein schmales Detail rechts mehr.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { aufloesen, mitAkte, markttraktion, mandantZiel, mandateOrt, hubOrtFuer, firmaAkte, MANDATE_PFAD, PFAD } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';

const lies = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');

/** Was die Seite aus einer Adresse macht — dieselbe Regel wie in Markttraktion.tsx (`mitAkte(aufloesen(s, a), k)`). */
function ziel(href: string): { pfad: string; s?: string; a?: string; k: string | null } {
  const [pfad, suche = ''] = href.split('?');
  const q = new URLSearchParams(suche);
  if (pfad !== PFAD) return { pfad, k: q.get('k') };
  return { pfad, ...mitAkte(aufloesen(q.get('s'), q.get('a')), q.get('k')), k: q.get('k') };
}

describe('Adressen — eine Kennung öffnet die Akte', () => {
  it('mitAkte: Kontakte, Firmen und Deals › Liste mit Kennung werden zur Akte; Runden, Board und Listen ohne Kennung bleiben', () => {
    expect(mitAkte({ s: 'kontakte' }, 'c-1')).toEqual({ s: 'kontakte', a: 'akte' });
    expect(mitAkte({ s: 'kontakte', a: 'dubletten' }, 'c-1')).toEqual({ s: 'kontakte', a: 'akte' });
    expect(mitAkte({ s: 'kontakte' }, 'f-nord')).toEqual({ s: 'firmen', a: 'akte' });
    expect(mitAkte({ s: 'firmen' }, 'f-nord')).toEqual({ s: 'firmen', a: 'akte' });
    expect(mitAkte({ s: 'deals', a: 'liste' }, 'ch-1')).toEqual({ s: 'deals', a: 'akte' });
    expect(mitAkte({ s: 'kontakte', a: 'runde-vernetzen' }, 'kp-1')).toEqual({ s: 'kontakte', a: 'runde-vernetzen' });
    expect(mitAkte({ s: 'deals' }, 'ch-1')).toEqual({ s: 'deals' });
    expect(mitAkte({ s: 'kontakte' }, null)).toEqual({ s: 'kontakte' });
    expect(mitAkte({ s: 'firmen' })).toEqual({ s: 'firmen' });
    expect(mitAkte({ s: 'besuche' }, 'ev-1')).toEqual({ s: 'besuche' });
  });
  it('WEG.kontakt/akte/firma(id) und die Firmenakte bauen eine Akte; ohne Kennung bleibt es die Liste', () => {
    for (const href of [WEG.kontakt('c-1'), WEG.akte('c-1')]) expect(ziel(href)).toMatchObject({ s: 'kontakte', a: 'akte', k: 'c-1' });
    for (const href of [WEG.firma('f-nord'), firmaAkte('f-nord')]) expect(ziel(href)).toMatchObject({ s: 'firmen', a: 'akte', k: 'f-nord' });
    expect(WEG.firma('f-nord')).toBe('/os/markttraktion?s=firmen&a=akte&k=f-nord');
    expect(WEG.kontakt()).toBe('/os/markttraktion?s=kontakte');
    expect(WEG.firma()).toBe('/os/markttraktion?s=firmen');
    expect(ziel(WEG.deal('ch-1'))).toMatchObject({ s: 'deals', a: 'akte', k: 'ch-1' });
  });
  it('WEG.mandat(id) öffnet die Mandatsakte (`/os/mandate?k=<Mandat>`); ohne Kennung die Liste', () => {
    const href = WEG.mandat('m-1');
    expect(href).toBe(`${MANDATE_PFAD}?k=m-1`);
    const q = new URLSearchParams(href.split('?')[1]);
    expect(mandateOrt(q.get('s'))).toBe('mandate');
    expect(q.get('k')).toBe('m-1');
    expect(WEG.mandat()).toBe(MANDATE_PFAD);
  });
  it('alte Adressen (Meldungen, Aufgaben, Brain, Suche) landen in derselben Akte', () => {
    expect(ziel('/os/markttraktion?s=kontakte&k=c-1')).toMatchObject({ s: 'kontakte', a: 'akte' });
    expect(ziel('/os/markttraktion?s=kartei&k=c-1')).toMatchObject({ s: 'kontakte', a: 'akte' });
    expect(ziel('/os/markttraktion?s=firmen&k=f-nord')).toMatchObject({ s: 'firmen', a: 'akte' });
    expect(ziel('/os/markttraktion?s=kontakte&k=f-nord')).toMatchObject({ s: 'firmen', a: 'akte' });
    expect(ziel('/os/markttraktion?s=deals&a=liste&k=ch-1')).toMatchObject({ s: 'deals', a: 'akte' });
    // Der Mandant-Link: Mandat → Mandatsakte, sonst Firma → Firmenakte.
    expect(mandantZiel({ mandatId: 'm-1' }).href).toBe(`${MANDATE_PFAD}?k=m-1`);
    const f = mandantZiel({ firmaId: 'f-nord', mandatDa: false, mandatId: 'm-1' });
    expect(f.art).toBe('firma');
    expect(ziel(f.href!)).toMatchObject({ s: 'firmen', a: 'akte', k: 'f-nord' });
  });
  it('der Punkt „Firmen“ bzw. „Kontakte“ leuchtet auch in der Akte', () => {
    expect(hubOrtFuer(PFAD, '?s=firmen&a=akte&k=f-nord')).toBe('firmen');
    expect(hubOrtFuer(PFAD, '?s=kontakte&a=akte&k=c-1')).toBe('kontakte');
  });
});

describe('Oberfläche — die Listen öffnen die Akte, kein schmales Detail rechts', () => {
  const m = lies('components/os/crm/Markttraktion.tsx');
  const k = lies('components/os/crm/Kartei.tsx');
  const f = lies('components/os/crm/Firmen.tsx');
  const kd = lies('components/os/crm/Kunden.tsx');
  const p = lies('components/os/crm/Pipeline.tsx');
  const v = lies('components/os/Verlauf.tsx');
  it('Markttraktion: Adresse über mitAkte, Personen/Firmen öffnen als Akte, die Firmenakte als eigene Seite in voller Breite', () => {
    expect(m).toContain("mitAkte(aufloesen(params.get('s'), params.get('a')), params.get('k'))");
    expect(m).toContain("const zuKontakt = (id: string) => gehe('kontakte', 'akte', id);");
    expect(m).toContain("const zuFirma = (id: string) => gehe('firmen', 'akte', id);");
    expect(m).toContain('<FirmenAkte api={api} id={firmaAkteId}');
    expect(m).toContain('breit: AKTE_BREIT');
    // „‹ Zurück“ führt in die Liste (nicht zurück in dieselbe Akte).
    expect(m).toContain("zurueck={() => zurueckWie(markttraktion('kontakte'))}");
    expect(m).toContain("zurueck={() => zurueckWie(markttraktion('firmen'))}");
  });
  it('Kontakte: Klick und Enter öffnen die Akte; die Liste trägt kein Detail', () => {
    expect(k).toContain('if (zuAkte) zuAkte(x.id); else setAuswahl');
    expect(k).toContain("e.key === 'Enter' && sichtbar[markiert]) { if (zuAkte) zuAkte(sichtbar[markiert].id)");
    expect(k).toContain('detail={null} />');
    expect(k).not.toContain('data-karteikarte');
  });
  it('Firmen: Klick öffnet die Firmenakte; Karte und Akte teilen EINE Stelle für die Teile (keine zweite Logik)', () => {
    expect(f).toContain('onClick={() => zuAkte(x.id)}');
    expect(f).not.toContain('data-firmenkarte');
    expect(f).toContain('function useFirmenTeile(');
    expect(f).toContain('export function FirmenAkte(');
    expect((f.match(/useFirmenTeile\(/g) ?? []).length).toBe(3); // Definition + Karte + Akte
    // Kopf mit den Kennzahlen, Umsatz über dieselbe Zuordnung wie „Kontakt öffnen“ (umsatzBezug), Dateien nur lesen.
    for (const t of ['label="Personen"', 'label="Offene Deals"', 'label="Aktive Mandate"', 'label="Umsatz"']) expect(f, t).toContain(t);
    expect(f).toContain("fetch('/api/rechnung?umsatz=1'");
    expect(f).toContain('umsatzBezug(');
    expect(f).toContain('<TermineAkte');
    expect(f).toContain('<AufgabenAkte');
    expect(f).toContain('<ZoeVorschlaege');
  });
  it('Firmenakte › Dateien: ablegen direkt an der Firma (Bezug firmaId) über denselben Weg wie die Kontakt-Akte', () => {
    expect(f).toContain("import { DateiWahl, hochladen } from './kontakt/UmsatzReiter';");
    expect(f).toContain('<FirmaDateiAblegen firmaId={f.id}');
    expect(f).toContain('await hochladen({ art, ...(titel.trim() ? { titel: titel.trim() } : {}), firmaId }, datei)');
    const u = lies('components/os/crm/kontakt/UmsatzReiter.tsx');
    expect(u).toContain('export async function hochladen(meta');
    expect(u).toContain("fetch('/api/crm/dateien', { method: 'POST', body: f })");
  });
  it('Mandate: ein Mandat (`?k=`) öffnet die Mandatsakte, breit und zweispaltig; der Überblick bleibt in der Liste', () => {
    expect(kd).toContain('if (sel) {');
    expect(kd).toContain('function MandatAkte(');
    expect(kd).toContain('<MandatDetail {...p} zwei={zwei} />');
    expect(kd).toContain('<MandatZeitleiste');
    expect(kd).toContain("zurueck={() => zurueckWie(mandateLink())}");
    expect(kd).toContain('leer={st => ueberblick(st.zwei)} leerOben');
    expect(kd).not.toContain('Mandat schließen');
  });
  it('Deals › Liste: Klick öffnet die Deal-Akte; rechts bleibt die Prognose', () => {
    expect(p).toContain('onKlick={() => (zuAkte ? zuAkte(c.id) : setAuswahl(auswahl === c.id ? null : c.id))}');
    expect(p).not.toContain('aria-label="Deal schließen"');
    expect(p).toContain('{prognoseKarte(false)}<HeadPanel head="sales"');
  });
  it('Deals › Board (30.10. nachts): Klick auf eine Karte öffnet die Deal-Akte, Ziehen zwischen den Spalten bleibt', () => {
    expect(p).toContain("title={zuAkte ? 'Klick: Deal-Akte · Ziehen: Stufe wechseln'");
    expect(p).toContain("onClick={() => (zuAkte ? zuAkte(c.id) : setAuswahl(auswahl === c.id ? null : c.id))}");
    expect(p).toContain("draggable onDragStart={e => { e.dataTransfer.setData('text/plain', c.id)");
    expect(p).toContain('onDrop={e => zieh(e, s.id)}');
    expect(p).not.toContain('onDoubleClick');
  });
  it('Zurück aus der Akte: die Liste einer Arbeitsfläche steht wieder dort, wo man war (Verlauf merkt ihre Scrollposition)', () => {
    expect(v).toContain('const LISTE = \'[data-af="liste"]\';');
    expect(v).toContain('positionen.set(verlaufStand().id, { main: zuletzt, liste: zuletztListe });');
    expect(lies('components/os/ui/arbeitsflaeche.tsx')).toContain('data-af="liste"');
  });
  it('„Was ist neu“ nennt es (u-2026-10-31-5, eindeutig)', () => {
    const n = lies('lib/neuigkeiten/eintraege.ts');
    expect((n.match(/id: 'u-2026-10-31-5'/g) ?? []).length).toBe(1);
  });
});

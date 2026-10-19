// ─── Produkte & Mandate · Produkt-Import (P4, 19.10.) ──────────────────────────────────────────────────────────────────────────
// Erfundene Produkte, Preise und Namen — nie echte Inhalte einer Instanz (Plattform-Regel). Eigener Datenordner für die Route.
// Geprüft wird:
//   · Planen: neu · ändert (Feld alt → neu) · gleich · Fehler · übersprungen (Papierkorb/Archiv nur Hinweis, nie wiederbelebt)
//   · Teil-Merge: nur gelieferte Felder; Vertrag/Regeln/Ziel je Unterfeld; Kennungen der Preis-Teile bleiben stabil
//   · Namensbezüge (Anrechnung, inklusive) gegen die Lieferung und den Katalog; unbekannt/Papierkorb → Fehler
//   · Fehler: unbekannte Felder, Preis-Form, zu lang (413, nie gekürzt), „aktiv“ ohne Leistungstext, Gesellschaft, „nur Business“ + Privat
//   · Tabelle: Semikolon/Tab, deutsche Beträge, mehrere Zeilen = ein Produkt mit mehreren Preis-Teilen, Inklusive „1 × … je Quartal“
//   · Route: Vorschau schreibt nicht, Anlegen + Protokoll „import“, zweiter Lauf „gleich“, Ablauf über den Fulfillment-Weg, Rechte, Grenzen
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importPlanen, importAusTabelle, nameSchluessel, euroAus, gesellschaftAus, IMPORT_GRENZEN, type ImportKontext, type ProduktImport } from '@/lib/crm/produkt-import';
import type { Leistung } from '@/lib/crm/typen';

const J = '2026-10-19T08:00:00.000Z';
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'entwurf', geaendert: J, ...x } as Leistung);
let zaehler = 0;
const kontext = (x: Partial<ImportKontext> = {}): ImportKontext => ({ neueId: () => `l-neu-${++zaehler}`, register: [], vorlagen: [], zuordnung: {}, ...x });

// Erfundener Bestand: eine Karte, ein Altprodukt ohne Karte, eins im Papierkorb, eins im Archiv.
const STEUER = leistung({
  id: 'l-steuer', name: 'Steuerungs-Begleitung', status: 'aktiv', angebot: { leistungstext: 'Monatliche Begleitung der Steuerung.' }, lieferumfang: ['Monatsgespräch'],
  preise: [{ id: 'pt-a', art: 'monatlich', betragCent: 250_000, rolle: 'grund' }], vertrag: { mindestlaufzeitMonate: 3, zahlungszielTage: 14 }, ebene: 3,
});
const ALT = leistung({ id: 'l-alt', name: 'Alte Analyse', preis: { betrag: 1200, einheit: 'pauschal netto', basis: 'einmalig' } });
const WEG = leistung({ id: 'l-weg', name: 'Gelöschtes Paket', geloeschtAm: '2026-10-10T08:00:00.000Z' });
const ARCHIV = leistung({ id: 'l-archiv', name: 'Ruhendes Paket', status: 'eingestellt' });
const BESTAND = { leistungen: [STEUER, ALT, WEG, ARCHIV] };

describe('Planen — neu, ändert, gleich, übersprungen', () => {
  it('ordnet über den Namen ohne Groß/Klein und Leerzeichen zu und legt Neues mit Vorgaben an', () => {
    expect(nameSchluessel('  Steuerungs - Begleitung ')).toBe(nameSchluessel('steuerungs-begleitung'));
    const p = importPlanen(BESTAND, [
      { name: 'steuerungs-Begleitung' },
      { name: 'Erfundener Schnell-Check', preise: [{ art: 'kostenlos' }], ebene: 1 },
      { name: 'Ruhendes Paket', status: 'aktiv' },
      { name: 'gelöschtes paket' },
    ], kontext());
    expect(p.status).toBe(200);
    expect(p.zeilen.map(z => z.art)).toEqual(['aendert', 'neu', 'uebersprungen', 'uebersprungen']);
    // Nur die Schreibweise des Namens ändert sich — der Schlüssel bleibt.
    expect(p.zeilen[0].felder).toEqual([{ feld: 'name', label: 'Name', alt: 'Steuerungs-Begleitung', neu: 'steuerungs-Begleitung' }]);
    expect(p.zeilen[1]).toMatchObject({ id: expect.stringMatching(/^l-neu-/), hinweise: expect.arrayContaining([expect.stringMatching(/Entwurf/), expect.stringMatching(/Gesellschaft offen/)]) });
    expect(p.zeilen[2].hinweise.join(' ')).toMatch(/archiviert — es wird nicht wiederbelebt/);
    expect(p.zeilen[3].hinweise.join(' ')).toMatch(/Papierkorb — es wird nicht wiederbelebt/);
    expect(p.zahlen).toEqual({ neu: 1, aendert: 1, gleich: 0, fehler: 0, uebersprungen: 2 });
    const neu = p.ops.find(o => o.op === 'upsert')!.eintrag!;
    expect(neu).toMatchObject({ name: 'Erfundener Schnell-Check', status: 'entwurf', gesellschaft: 'offen', typ: 'diagnose', ebene: 1, preise: [{ id: 'pt-1', art: 'kostenlos', rolle: 'grund' }] });
    // Nie ein Op auf Archiv oder Papierkorb.
    expect(p.ops.some(o => o.id === 'l-archiv' || o.id === 'l-weg' || o.eintrag?.id === 'l-archiv')).toBe(false);
  });

  it('gleich, wenn die gelieferten Felder schon so im Katalog stehen (auch Beträge in Euro, Text mit Leerraum)', () => {
    const p = importPlanen(BESTAND, [{ name: 'Steuerungs-Begleitung', status: 'aktiv', leistungstext: '  Monatliche Begleitung der Steuerung. ', preise: [{ art: 'monatlich', betrag: '2.500' }], vertrag: { mindestlaufzeitMonate: '3 Monate' }, ebene: 3 }], kontext());
    expect(p.zeilen[0]).toMatchObject({ art: 'gleich', felder: [] });
    expect(p.ops).toEqual([]);
  });
});

describe('Teil-Merge — nur gelieferte Felder', () => {
  it('Vertrag je Unterfeld (Zahlungsziel bleibt), Preis-Teil behält seine Kennung, nichts sonst im Teil', () => {
    const p = importPlanen(BESTAND, [{ name: 'Steuerungs-Begleitung', vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich kündbar' }, preise: [{ art: 'monatlich', betrag: 2800 }, { art: 'erfolg', text: 'Bonus bei erreichten Zielen' }] }], kontext());
    expect(p.status).toBe(200);
    const op = p.ops[0];
    expect(op).toMatchObject({ liste: 'leistungen', op: 'teil', id: 'l-steuer' });
    expect(Object.keys(op.felder!).sort()).toEqual(['preise', 'vertrag']);
    expect(op.felder!.vertrag).toEqual({ mindestlaufzeitMonate: 6, zahlungszielTage: 14, danach: 'monatlich_kuendbar' });
    expect((op.felder!.preise as { id: string }[]).map(t => t.id)).toEqual(['pt-a', 'pt-2']);
    const felder = Object.fromEntries(p.zeilen[0].felder.map(f => [f.feld, `${f.alt} → ${f.neu}`]));
    expect(felder['vertrag.mindestlaufzeitMonate']).toBe('3 → 6');
    expect(felder['vertrag.danach']).toBe('— → monatlich kündbar');
    expect(felder.preise).toBe('2.500 € netto/Monat → 2.800 € netto/Monat · Bonus bei erreichten Zielen');
    expect(felder['vertrag.zahlungszielTage']).toBeUndefined();
  });
  it('null leert ein Feld; Lieferumfang wird als Ganzes ersetzt', () => {
    const p = importPlanen(BESTAND, [{ name: 'Steuerungs-Begleitung', vertrag: null, lieferumfang: ['Monatsgespräch', 'Quartalsbericht'], ebene: null }], kontext());
    const f = p.ops[0].felder!;
    expect(f).toEqual({ vertrag: null, lieferumfang: ['Monatsgespräch', 'Quartalsbericht'], ebene: null });
  });
});

describe('Namensbezüge — Anrechnung und inklusive', () => {
  it('auf ein neues Produkt derselben Lieferung und auf den Katalog; Anteil ohne Angabe 100 %', () => {
    const p = importPlanen(BESTAND, [
      { name: 'Erfundener Tagesworkshop', status: 'aktiv', leistungstext: 'Ein Tag Klarheit.', preise: [{ art: 'fest', betrag: 3900 }], regeln: { anrechnung: { auf: ['Erfundene Vertriebsleitung', 'steuerungs-begleitung'] } } },
      { name: 'Erfundene Vertriebsleitung', preise: [{ art: 'monatlich', betrag: '4.200,00 €' }], regeln: { inklusive: [{ produkt: 'Erfundenes Messe-Modul', menge: 1, je: 'Quartal' }], maxGleichzeitig: 2 } },
      { name: 'Erfundenes Messe-Modul', rolle: 'Zusatzmodul', preise: [{ art: 'fest', betrag: 1500 }, { art: 'je Event', betrag: 900, optional: true, anzahlungProzent: 50 }] },
    ], kontext());
    expect(p.status).toBe(200);
    const id = (n: string) => p.zeilen.find(z => z.name === n)!.id!;
    const eintrag = (n: string) => p.ops.find(o => o.eintrag?.id === id(n))!.eintrag!;
    expect(eintrag('Erfundener Tagesworkshop').regeln).toEqual({ anrechnung: { auf: [id('Erfundene Vertriebsleitung'), 'l-steuer'], anteilProzent: 100 } });
    expect(eintrag('Erfundene Vertriebsleitung').regeln).toEqual({ maxGleichzeitig: 2, inklusive: [{ leistungId: id('Erfundenes Messe-Modul'), menge: 1, je: 'quartal' }] });
    expect(eintrag('Erfundenes Messe-Modul')).toMatchObject({ rolle: 'zusatz', typ: 'sprint', preise: [{ art: 'fest', betragCent: 150_000, rolle: 'grund' }, { art: 'je_einheit', einheit: 'je Event', betragCent: 90_000, rolle: 'option', zahlplan: { anzahlungProzent: 50 } }] });
    // Die Vorschau nennt Namen, nie Kennungen.
    const ws = p.zeilen.find(z => z.name === 'Erfundener Tagesworkshop')!.felder.find(f => f.feld === 'regeln.anrechnung')!;
    expect(ws.neu).toBe('voll angerechnet auf Erfundene Vertriebsleitung, Steuerungs-Begleitung');
  });
  it('unbekannt oder im Papierkorb → Fehler, nichts geplant', () => {
    const p = importPlanen(BESTAND, [
      { name: 'Erfundenes A', regeln: { anrechnung: { auf: ['Gibt es nicht'] } } },
      { name: 'Erfundenes B', regeln: { inklusive: [{ produkt: 'Gelöschtes Paket', je: 'jahr' }] } },
    ], kontext());
    expect(p.status).toBe(400);
    expect(p.zeilen[0].fehler.join(' ')).toMatch(/„Gibt es nicht“ gibt es weder in der Lieferung noch im Katalog/);
    expect(p.zeilen[1].fehler.join(' ')).toMatch(/liegt im Papierkorb/);
    expect(p.ops).toEqual([]);
  });
});

describe('Fehler — nie still', () => {
  it('unbekannte Felder, Preis-Form, Gesellschaft, Status „eingestellt“, doppelte Namen', () => {
    const p = importPlanen(BESTAND, [
      { name: 'Erfundenes X', preis: 100 },
      { name: 'Erfundenes Y', preise: [{ art: 'gelegentlich', betrag: 5 }] },
      { name: 'Erfundenes Z', gesellschaft: 'Unbekannte AG' },
      { name: 'Erfundenes Q', status: 'eingestellt' },
      { name: 'Doppelt' }, { name: 'doppelt ' },
    ], kontext());
    const f = p.zeilen.map(z => z.fehler.join(' '));
    expect(f[0]).toMatch(/Unbekannte Felder: „preis“/);
    expect(f[1]).toMatch(/unbekannte Preis-Form „gelegentlich“/);
    expect(f[2]).toMatch(/Gesellschaft „Unbekannte AG“ kenne ich nicht/);
    expect(f[3]).toMatch(/archivieren bitte in der Produkt-Karte/);
    expect(f[4]).toMatch(/mehrfach in der Lieferung \(Nr\. 5, 6\)/);
    expect(p.status).toBe(400);
  });
  it('zu lang → 413 (nie gekürzt); „aktiv“ ohne Leistungstext; Prüfregeln der Karte (Grund-Teil, Deckel nur beim Stundensatz)', () => {
    const lang = importPlanen(BESTAND, [{ name: 'Erfundenes L', beschreibung: 'x'.repeat(1501) }], kontext());
    expect(lang.status).toBe(413);
    expect(lang.zeilen[0].fehler[0]).toMatch(/zu lang .* nichts gekürzt/);
    const p = importPlanen(BESTAND, [
      { name: 'Erfundenes M', status: 'aktiv' },
      { name: 'Erfundenes N', preise: [{ art: 'monatlich', betrag: 100, optional: true }] },
      { name: 'Erfundenes O', preise: [{ art: 'fest', betrag: 100, stundenJeMonat: 10 }] },
      { name: 'Steuerungs-Begleitung', leistungstext: null },
    ], kontext());
    expect(p.zeilen[0].fehler.join(' ')).toMatch(/„aktiv“ geht erst mit Leistungstext/);
    expect(p.zeilen[1].fehler.join(' ')).toMatch(/Mindestens ein Preis-Teil muss immer gelten/);
    expect(p.zeilen[2].fehler.join(' ')).toMatch(/Deckel gibt es nur beim Stundensatz/);
    expect(p.zeilen[3].fehler.join(' ')).toMatch(/Leistungstext bleibt Pflicht/);
    expect(importPlanen(BESTAND, Array.from({ length: IMPORT_GRENZEN.produkte + 1 }, (_, i) => ({ name: `P${i}` })), kontext()).status).toBe(413);
    expect(importPlanen(BESTAND, {}, kontext()).status).toBe(400);
  });
  it('Konto „nur Business“: kein Produkt einer Privat-Einheit; Gesellschaft über Kennung, Kern- oder Register-Namen', () => {
    const p = importPlanen(BESTAND, [{ name: 'Erfundenes P', gesellschaft: 'kdc' }], kontext({ nurBusiness: true }));
    expect(p.zeilen[0].fehler.join(' ')).toMatch(/nicht zum Business-Bereich/);
    const reg = [{ id: 'g-beispiel-labs', name: 'Beispiel Labs Nord GmbH' }];
    expect(gesellschaftAus('Beispiel Labs Nord GmbH', reg)).toBe('g-beispiel-labs');
    expect(gesellschaftAus('g-beispiel-labs', reg)).toBe('g-beispiel-labs');
    expect(gesellschaftAus('g-unbekannt-x', reg)).toBeNull();
    expect(gesellschaftAus('ug', reg)).toBe('ug');
    expect(gesellschaftAus('offen', reg)).toBe('offen');
  });
  it('deutsche Beträge', () => {
    expect([euroAus('2.990'), euroAus('2.990,50 €'), euroAus('1500.5'), euroAus(' 4 200 EUR '), euroAus('abc')]).toEqual([2990, 2990.5, 1500.5, 4200, NaN]);
  });
});

describe('Ablauf (Fulfillment-Vorlage) — nur Hinweis, wenn es ihn nicht gibt', () => {
  it('genau eine Vorlage → zuordnen; gleich → nichts; fehlt/mehrdeutig → Hinweis', () => {
    const k = kontext({ vorlagen: [{ id: 'fp-a', titel: 'Begleitung Ablauf' }, { id: 'fp-b', titel: 'Zweimal' }, { id: 'fp-c', titel: 'zweimal' }], zuordnung: { 'l-alt': { vorlageId: 'fp-a' } } });
    const p = importPlanen(BESTAND, [
      { name: 'Steuerungs-Begleitung', ablauf: 'begleitung ablauf' },
      { name: 'Alte Analyse', ablauf: 'Begleitung Ablauf' },
      { name: 'Erfundenes R', ablauf: 'Gibt es nicht' },
      { name: 'Erfundenes S', ablauf: 'Zweimal' },
    ], k);
    expect(p.zeilen.map(z => z.ablauf?.stand)).toEqual(['neu', 'gleich', 'fehlt', 'mehrdeutig']);
    expect(p.zeilen[0]).toMatchObject({ art: 'aendert', felder: [{ feld: 'ablauf', alt: '—', neu: 'Begleitung Ablauf' }] });
    expect(p.zeilen[1].art).toBe('gleich');
    expect(p.zuordnungen).toEqual([{ leistungId: 'l-steuer', vorlageId: 'fp-a' }]);
    expect(p.zeilen[2].hinweise.join(' ')).toMatch(/gibt es \(noch\) nicht/);
    expect(p.status).toBe(200);
  });
});

describe('Gleichnamige Treppen-Stufe ohne Produkt — verknüpfen statt doppelt', () => {
  const stufe = (id: string, name: string, leistungIds: string[] = []) => ({ id, name, leistungIds, stand: `stand-${id}` });
  it('eindeutig und ohne vorhandenes Produkt → verknüpfen (Produkt vorn, alte tote Verweise bleiben); schon verknüpft → gleich', () => {
    const p = importPlanen(BESTAND, [{ name: 'Erfundenes Coaching' }, { name: 'Steuerungs-Begleitung' }], kontext({
      stufen: [stufe('ts-alt-coaching', 'erfundenes  Coaching', ['l-weg']), stufe('ts-steuer', 'Steuerungs-Begleitung', ['l-steuer'])],
    }));
    expect(p.status).toBe(200);
    const coaching = p.zeilen[0];
    expect(coaching.stufe).toEqual({ id: 'ts-alt-coaching', name: 'erfundenes  Coaching', stand: 'verknuepfen' });
    expect(coaching.felder).toContainEqual({ feld: 'stufe', label: 'Leistungstreppe', alt: '—', neu: 'verknüpft Stufe „erfundenes  Coaching“' });
    expect(p.stufen).toEqual([{ stufeId: 'ts-alt-coaching', leistungId: coaching.id, leistungIds: [coaching.id, 'l-weg'], stand: 'stand-ts-alt-coaching' }]);
    expect(p.zeilen[1]).toMatchObject({ art: 'gleich', stufe: { id: 'ts-steuer', stand: 'gleich' } });
  });
  it('mehrdeutig, schon vergeben oder Produkt hängt schon an einer anderen Stufe → nur Hinweis, nichts verknüpft', () => {
    const p = importPlanen(BESTAND, [{ name: 'Doppelte Stufe' }, { name: 'Vergebene Stufe' }, { name: 'Steuerungs-Begleitung' }], kontext({
      stufen: [stufe('ts-d1', 'Doppelte Stufe'), stufe('ts-d2', 'doppelte stufe'), stufe('ts-v', 'Vergebene Stufe', ['l-alt']),
        stufe('ts-steuer-alt', 'Begleitung alt', ['l-steuer']), stufe('ts-steuer-neu', 'Steuerungs-Begleitung')],
    }));
    expect(p.stufen).toEqual([]);
    expect(p.zeilen.map(z => z.stufe?.stand)).toEqual(['mehrdeutig', 'vergeben', 'vergeben']);
    expect(p.zeilen[0].hinweise.join(' ')).toMatch(/2 Stufen der Leistungstreppe heißen „Doppelte Stufe“ — nichts verknüpft/);
    expect(p.zeilen[1].hinweise.join(' ')).toMatch(/gehört schon zu „Alte Analyse“ — nichts verknüpft/);
    expect(p.zeilen[2].hinweise.join(' ')).toMatch(/hängt schon an der Stufe „Begleitung alt“/);
    expect(p.zeilen[2].art).toBe('gleich');
  });
});

describe('Tabelle (CSV)', () => {
  it('Semikolon, deutsche Beträge, gleiche Namen = ein Produkt mit mehreren Preis-Teilen, Listen und Inklusive', () => {
    const csv = [
      'Name;Stufe;Preis-Art;Betrag;Einheit;Optional;Anzahlung;Mindestlaufzeit;Danach;Lieferumfang;Anrechnung auf;Inklusive;Gesellschaft;Unbekannt',
      'Erfundenes Modul;;Festpreis;"1.500,00";;;50/50;;;Briefing | Nachbereitung;;;ug;egal',
      'Erfundenes Modul;;je Event;900;je Event;ja;50;;;;;;;',
      'Erfundene Begleitung;3;monatlich;3.200;;;;6 Monate;monatlich kündbar;;;1 × Erfundenes Modul je Quartal;ug;',
      'Erfundener Check;1;kostenlos;;;;;;;;Erfundene Begleitung;;ug;',
    ].join('\n');
    const t = importAusTabelle(csv);
    expect(t.fehler).toEqual([]);
    expect(t.hinweise.join(' ')).toMatch(/Spalte „Unbekannt“ kenne ich nicht/);
    expect(t.produkte.map(p => p.name)).toEqual(['Erfundenes Modul', 'Erfundene Begleitung', 'Erfundener Check']);
    expect(t.produkte[0].preise).toHaveLength(2);
    expect(t.produkte[0].lieferumfang).toEqual(['Briefing', 'Nachbereitung']);
    const p = importPlanen({ leistungen: [] }, t.produkte, kontext());
    expect(p.status).toBe(200);
    const e = (n: string) => p.ops.find(o => o.eintrag?.name === n)!.eintrag!;
    expect(e('Erfundenes Modul').preise).toEqual([
      { id: 'pt-1', art: 'fest', betragCent: 150_000, rolle: 'grund', zahlplan: { anzahlungProzent: 50 } },
      { id: 'pt-2', art: 'je_einheit', betragCent: 90_000, einheit: 'je Event', rolle: 'option', zahlplan: { anzahlungProzent: 50 } },
    ]);
    expect(e('Erfundene Begleitung')).toMatchObject({ ebene: 3, vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar' }, regeln: { inklusive: [{ menge: 1, je: 'quartal' }] } });
    expect(e('Erfundener Check').regeln).toMatchObject({ anrechnung: { anteilProzent: 100 } });
  });
  it('Tab-getrennt (aus der Zwischenablage); ohne Namensspalte bzw. widersprüchlich → Fehler', () => {
    expect(importAusTabelle('Name\tPreis-Art\tBetrag\nErfundenes T\tTagessatz\t1.400').produkte[0]).toMatchObject({ name: 'Erfundenes T', preise: [{ art: 'Tagessatz', betrag: '1.400' }] });
    expect(importAusTabelle('Titel;Betrag\nA;1').fehler[0]).toMatch(/Spalte „Name“ fehlt/);
    expect(importAusTabelle('Name;Stufe\nA;1\nA;2').fehler[0]).toMatch(/widerspricht Zeile 2/);
    expect(importAusTabelle('Name;Betrag\nA;100').fehler[0]).toMatch(/ohne „Preis-Art“/);
  });
});

// ── Oberfläche (rein: was geschickt wird; gerendert ohne Browser) ──────────────────────────────────────────────────

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate' }));
describe('Oberfläche „Produkte importieren“', () => {
  it('schickt JSON-Liste, { produkte } oder ein einzelnes Produkt als `produkte`, sonst die Tabelle als `csv`', async () => {
    const { importKoerper } = await import('@/components/os/mandate/ProduktImport');
    expect(importKoerper('[{"name":"A"}]')).toEqual({ produkte: [{ name: 'A' }] });
    expect(importKoerper('{"produkte":[{"name":"A"}]}')).toEqual({ produkte: [{ name: 'A' }] });
    expect(importKoerper(' {"name":"A"} ')).toEqual({ produkte: [{ name: 'A' }] });
    expect(importKoerper('Name;Betrag\nA;1')).toEqual({ csv: 'Name;Betrag\nA;1' });
    expect(importKoerper('[{"name":')).toHaveProperty('fehler');
    expect(importKoerper('   ')).toHaveProperty('fehler');
  });
  it('Knopf + Fenster: Vorschau und „Übernehmen“ (ohne Vorschau gesperrt)', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { ProduktImportKnopf, ProduktImport } = await import('@/components/os/mandate/ProduktImport');
    expect(renderToStaticMarkup(createElement(ProduktImportKnopf))).toContain('Produkte importieren');
    const f = renderToStaticMarkup(createElement(ProduktImport, { onZu: () => {} }));
    expect(f).toContain('role="dialog"');
    expect(f).toContain('Vorschau');
    expect(f).toMatch(/<button[^>]*disabled=""[^>]*>Übernehmen<\/button>/);
  });
});

// ── Route ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-produkt-import-'));
const D = 'example.invalid';
type Mod = { POST: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
const kopf = (person?: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', ...(person ? { 'x-make-user': person } : {}), ...extra });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POST = async (body: unknown, person?: string, extra: Record<string, string> = {}): Promise<{ status: number; d: Record<string, any> }> => {
  const r = await route.POST(new Request('http://test/api/crm/produkte/import', { method: 'POST', headers: kopf(person, extra), body: typeof body === 'string' ? body : JSON.stringify(body) }));
  return { status: r.status, d: await r.json().catch(() => ({})) };
};
const LIEFERUNG: ProduktImport[] = [
  { name: 'Erfundener Kurz-Check', status: 'aktiv', gesellschaft: 'ug', leistungstext: 'Eine Woche, ein Befund.', preise: [{ art: 'kostenlos' }], ebene: 1, ablauf: 'Beispiel-Lieferung' },
  { name: 'Erfundene Begleitung', status: 'aktiv', gesellschaft: 'ug', leistungstext: 'Monatliche Begleitung.', preise: [{ art: 'monatlich', betrag: 2900 }, { art: 'erfolg', text: 'Bonus bei Zielen' }], vertrag: { mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar' }, regeln: { maxGleichzeitig: 3 }, ebene: 2, ablauf: 'Beispiel-Lieferung' },
  { name: 'Bestandsprodukt', beschreibung: 'Jetzt mit Kurzbeschreibung.' },
];

beforeAll(async () => {
  process.env.MAKE_OS_DATEN_DIR = ordner;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-produkt-import';
  process.env.MAKE_OS_OHNE_APPLE = '1';
  db = await import('@/lib/store/local-db');
  route = await import('@/app/api/crm/produkte/import/route') as unknown as Mod;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: `pa@${D}`, name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', teilt: { gesundheit: [] } },
    { id: '2', speicher: 'pb', email: `pb@${D}`, name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business', teilt: { gesundheit: [] } },
    { id: '3', speicher: 'px', email: `px@${D}`, name: 'Testkunde', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-fremd', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], leistungen: [{ id: 'l-bestand', name: 'Bestandsprodukt', typ: 'retainer', stufe: 'kern', preis: { betrag: 900, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'entwurf', geaendert: J }], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] });
  // Eine Paket-Vorlage im Fulfillment (über dessen reinen Weg) — der Import ordnet nur zu, was es gibt.
  const { fulfillmentAendern, eintragStand } = await import('@/lib/fulfillment/speicher');
  const { vorlagenAnwenden } = await import('@/lib/fulfillment/prozesse/vorlagen-anwenden');
  const { neueKennung } = await import('@/lib/kennung');
  const r = await fulfillmentAendern('vorlagen', d => vorlagenAnwenden(d, [{ op: 'vorlage', eintrag: { titel: 'Beispiel-Lieferung', art: 'paket' } }], { person: 'pa', jetzt: J, heute: '2026-10-19', standVon: eintragStand, neueId: p => neueKennung(p) }));
  expect(r.ok).toBe(true);
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route — wer darf', () => {
  it('ohne Person, fremder Haushalt, Dienstweg ohne bzw. mit fremder Person → 403; nichts gelesen, nichts geschrieben', async () => {
    const vorher = JSON.stringify(await db.loadJson('crm'));
    expect((await POST({ produkte: LIEFERUNG })).status).toBe(403);
    const fremd = await POST({ produkte: LIEFERUNG }, 'px');
    expect(fremd.status).toBe(403);
    expect(JSON.stringify(fremd.d)).not.toContain('Bestandsprodukt');
    const key = process.env.MAKE_OS_KEY!;
    expect((await POST({ produkte: LIEFERUNG, vorschau: false }, undefined, { 'x-make-key': key })).status).toBe(403);
    expect((await POST({ produkte: LIEFERUNG, vorschau: false }, undefined, { 'x-make-key': key, 'x-make-person': 'px' })).status).toBe(403);
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
  });
  it('Konto „nur Business“ darf (Vorschau), aber kein Produkt einer Privat-Einheit', async () => {
    const b = await POST({ produkte: LIEFERUNG }, 'pb');
    expect(b.status).toBe(200);
    expect(b.d.plan.zahlen).toMatchObject({ neu: 2, aendert: 1 });
    const privat = await POST({ produkte: [{ name: 'Erfundenes Privates', gesellschaft: 'kdc' }], vorschau: false }, 'pb');
    expect(privat.status).toBe(400);
    expect(privat.d.plan.zeilen[0].fehler.join(' ')).toMatch(/nicht zum Business-Bereich/);
  });
});

describe('Route — Vorschau, Anlegen, zweiter Lauf', () => {
  it('Vorschau schreibt nicht (auch ohne „vorschau“-Angabe)', async () => {
    const vorher = JSON.stringify(await db.loadJson('crm'));
    const v = await POST({ produkte: LIEFERUNG }, 'pa');
    expect(v.status).toBe(200);
    expect(v.d.vorschau).toBe(true);
    expect(v.d.plan.zeilen.map((z: { art: string }) => z.art)).toEqual(['neu', 'neu', 'aendert']);
    expect(v.d.plan.zeilen[0].ablauf).toMatchObject({ stand: 'neu', name: 'Beispiel-Lieferung' });
    expect(v.d.plan).not.toHaveProperty('ops');
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
    expect((await db.loadJson<{ zuordnung: Record<string, unknown> }>('fulfillment--h-pruef'))?.zuordnung ?? {}).toEqual({});
  });
  it('Anlegen über den CRM-Schreibweg (gespiegelt, Teil-Merge, Protokoll „import“), Ablauf zugeordnet', async () => {
    const r = await POST({ produkte: LIEFERUNG, vorschau: false }, 'pa');
    expect(r.status).toBe(200);
    expect(r.d).toMatchObject({ ok: true, angelegt: 2, geaendert: 1, ablauf: { zugeordnet: 2 } });
    const crm = (await db.loadJson<{ leistungen: Leistung[] }>('crm'))!;
    const beg = crm.leistungen.find(l => l.name === 'Erfundene Begleitung')!;
    expect(beg.id).toMatch(/^l-[0-9a-f-]{36}$/);
    expect(beg).toMatchObject({ status: 'aktiv', gesellschaft: 'ug', ebene: 2, laufzeitMonate: 6, preis: { betrag: 2900, einheit: 'Monat netto', basis: 'monat' }, regeln: { maxGleichzeitig: 3 }, geaendertVon: 'pa' });
    const best = crm.leistungen.find(l => l.id === 'l-bestand')!;
    expect(best).toMatchObject({ beschreibung: 'Jetzt mit Kurzbeschreibung.', preis: { betrag: 900, einheit: 'Monat netto' }, status: 'entwurf' });
    const ff = await db.loadJson<{ zuordnung: Record<string, { vorlageId: string }> }>('fulfillment--h-pruef');
    expect(Object.keys(ff!.zuordnung).sort()).toEqual([beg.id, crm.leistungen.find(l => l.name === 'Erfundener Kurz-Check')!.id].sort());
    const { protokollMonat } = await import('@/lib/store/aenderungsprotokoll');
    const { localDay } = await import('@/lib/zeit');
    const prot = await protokollMonat('h-pruef', localDay().slice(0, 7));
    expect(prot.some(e => e.bestand === 'crm' && e.wer === 'import' && e.person === 'pa')).toBe(true);
  });
  it('zweimal derselbe Import = beim zweiten Mal alles „gleich“, nichts geschrieben', async () => {
    const vorher = JSON.stringify(await db.loadJson('crm'));
    const r = await POST({ produkte: LIEFERUNG, vorschau: false }, 'pa');
    expect(r.status).toBe(200);
    expect(r.d.plan.zahlen).toEqual({ neu: 0, aendert: 0, gleich: 3, fehler: 0, uebersprungen: 0 });
    expect(r.d.plan.zeilen.map((z: { ablauf?: { stand: string } }) => z.ablauf?.stand)).toEqual(['gleich', 'gleich', undefined]);
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
  });
  it('Dienstweg MIT Person des Haushalts darf (Import im Namen einer Person); Tabelle geht denselben Weg', async () => {
    const r = await POST({ csv: 'Name;Preis-Art;Betrag;Gesellschaft;Leistungstext;Status\nErfundener Sparring-Tag;Tagessatz;1.400;ug;Ein Tag Sparring.;aktiv', vorschau: false }, undefined, { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pa' });
    expect(r.status).toBe(200);
    expect(r.d.angelegt).toBe(1);
    const crm = (await db.loadJson<{ leistungen: Leistung[] }>('crm'))!;
    expect(crm.leistungen.find(l => l.name === 'Erfundener Sparring-Tag')).toMatchObject({ preise: [{ art: 'tagessatz', betragCent: 140_000 }], preis: { betrag: 1400, einheit: 'Tag netto' } });
  });
  it('Fehler in der Lieferung → 400, nichts gespeichert; Vorschau zeigt dieselben Fehler mit 200', async () => {
    const vorher = JSON.stringify(await db.loadJson('crm'));
    const bad = [...LIEFERUNG, { name: 'Erfundenes Kaputtes', preise: [{ art: 'monatlich', betragCent: 1.5 }] }];
    expect((await POST({ produkte: bad }, 'pa')).status).toBe(200);
    const r = await POST({ produkte: bad, vorschau: false }, 'pa');
    expect(r.status).toBe(400);
    expect(r.d.fehler).toMatch(/nichts gespeichert/);
    expect(JSON.stringify(await db.loadJson('crm'))).toBe(vorher);
  });
});

describe('Route — Altstufe ohne Produkt (live-ähnlich): verknüpfen, Kundenfortschritt bleibt, EINE Stufe in der Katalog-Treppe', () => {
  const COACHING: ProduktImport[] = [
    { name: 'Erfundenes Coaching', status: 'aktiv', gesellschaft: 'ug', leistungstext: 'Monatliches Coaching.', preise: [{ art: 'monatlich', betrag: 1800 }], ebene: 2 },
    { name: 'Doppelte Stufe', status: 'aktiv', gesellschaft: 'ug', leistungstext: 'Erfunden.', preise: [{ art: 'fest', betrag: 500 }], ebene: 3 },
  ];
  it('Vorschau nennt die Verknüpfung, Übernehmen verknüpft über den Treppen-Schreibweg, zweiter Lauf „gleich“', async () => {
    const { treppeSchreiben, ladeTreppe } = await import('@/lib/crm/treppe-server');
    const { katalogTreppe } = await import('@/lib/crm/produkt-karte');
    // Altbestand wie aus „Aus Dokument übernehmen“: eine Stufe ohne Produkt (mit totem Verweis), ein Kunde steht in ihr; dazu zwei gleichnamige Stufen.
    const t = await treppeSchreiben([
      { op: 'stufe', eintrag: { id: 'ts-alt-coaching', name: 'erfundenes coaching', ebene: 2, preis: { art: 'fest', betrag: 1000 }, leistungIds: ['l-geloescht-alt'], lieferobjekte: ['Altes Lieferobjekt'], kennzahl: 'Alte Kennzahl' } },
      { op: 'stufe', eintrag: { id: 'ts-doppel-a', name: 'Doppelte Stufe', ebene: 3, preis: { art: 'fest' } } },
      { op: 'stufe', eintrag: { id: 'ts-doppel-b', name: 'Doppelte Stufe', ebene: 3, preis: { art: 'fest' } } },
      { op: 'kunde', mandatId: 'm-alt-kunde', felder: { stufeId: 'ts-alt-coaching' } },
    ], 'pa');
    expect(t.ok).toBe(true);
    const vorher = await ladeTreppe();

    const v = await POST({ produkte: COACHING }, 'pa');
    expect(v.status).toBe(200);
    expect(v.d.plan.zeilen[0].stufe).toEqual({ id: 'ts-alt-coaching', name: 'erfundenes coaching', stand: 'verknuepfen' });
    expect(v.d.plan.zeilen[0].felder.map((f: { neu: string }) => f.neu)).toContain('verknüpft Stufe „erfundenes coaching“');
    expect(v.d.plan.zeilen[1].stufe.stand).toBe('mehrdeutig');
    expect(JSON.stringify(await ladeTreppe())).toBe(JSON.stringify(vorher));

    const r = await POST({ produkte: COACHING, vorschau: false }, 'pa');
    expect(r.status).toBe(200);
    expect(r.d.treppe).toEqual({ verknuepft: 1, hinweise: [] });
    const nach = await ladeTreppe();
    const crm = (await db.loadJson<{ leistungen: Leistung[] }>('crm'))!;
    const id = crm.leistungen.find(l => l.name === 'Erfundenes Coaching')!.id;
    const alt = nach.stufen.find(s => s.id === 'ts-alt-coaching')!;
    // Nur `leistungIds` ändert sich — Name, Lieferobjekte, Kennzahl der Stufe bleiben gespeichert; der Kunde steht weiter in ihr.
    expect(alt).toMatchObject({ name: 'erfundenes coaching', leistungIds: [id, 'l-geloescht-alt'], lieferobjekte: ['Altes Lieferobjekt'], kennzahl: 'Alte Kennzahl' });
    expect(nach.kunden['m-alt-kunde'].stufeId).toBe('ts-alt-coaching');
    expect(nach.stufen.filter(s => s.id.startsWith('ts-doppel')).map(s => s.leistungIds)).toEqual([[], []]);
    // Katalog-Treppe: EINE Stufe für das Produkt — die alte Kennung, die Karte gewinnt; nicht mehr „ohne Produkt“.
    const kt = katalogTreppe(crm.leistungen, nach.stufen);
    const coaching = kt.stufen.filter(s => s.leistungIds.includes(id) || nameSchluessel(s.name) === nameSchluessel('Erfundenes Coaching'));
    expect(coaching.map(s => s.id)).toEqual(['ts-alt-coaching']);
    expect(coaching[0]).toMatchObject({ name: 'Erfundenes Coaching', preis: { art: 'monat', betrag: 1800 }, lieferobjekte: ['Altes Lieferobjekt'] });
    expect(kt.herkunft['ts-alt-coaching']).toEqual({ leistungId: id, gespeichert: true, karte: true });
    expect(kt.ohneProdukt.map(s => s.id)).not.toContain('ts-alt-coaching');

    const zweiter = await POST({ produkte: COACHING, vorschau: false }, 'pa');
    expect(zweiter.d.plan.zahlen).toMatchObject({ neu: 0, aendert: 0, gleich: 2 });
    expect(zweiter.d.plan.zeilen[0].stufe.stand).toBe('gleich');
    expect(zweiter.d.treppe.verknuepft).toBe(0);
    expect(JSON.stringify(await ladeTreppe())).toBe(JSON.stringify(nach));
  });
});

describe('Route — Grenzen', () => {
  it('mehr als 100 Produkte bzw. mehr als 1 MB → 413; beides oder keins → 400', async () => {
    expect((await POST({ produkte: Array.from({ length: 101 }, (_, i) => ({ name: `Erfunden ${i}` })) }, 'pa')).status).toBe(413);
    expect((await POST({ produkte: [{ name: 'X', beschreibung: 'x'.repeat(IMPORT_GRENZEN.bytes) }] }, 'pa')).status).toBe(413);
    expect((await POST({ produkte: [], csv: 'Name\nA' }, 'pa')).status).toBe(400);
    expect((await POST({ vorschau: true }, 'pa')).status).toBe(400);
  });
});

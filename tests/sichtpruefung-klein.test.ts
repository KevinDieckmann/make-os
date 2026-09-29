// ─── Sichtprüfung 29.09. — kleine Funde ─────────────────────────────────────
// · Produkt „einmalig“ behielt die Einheit „Monat netto“ (Produkte-Formular + Angebots-Produktwahl).
// · Fokus mit Mandat: der Kopf nannte nur den Bereich („MAKE OS“), „Zeit je Einheit“ buchte „ohne Einheit“.
// · F3: „nur ich“ im Schnell-Anlegen blieb nach dem Anlegen an.
// Rein bzw. als Quelltext-Wächter (keine Oberfläche im Test), erfundene Daten.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { einheitFuerBasis, produktEinheit, EINHEIT_VORGABE } from '@/lib/finanzen/produkte';
import { einheitVonBlock, brauchtMandate, auswerten, type AufgabeKurz } from '@/lib/zeitmessung/einheiten';
import { fokusTitel } from '@/lib/zeitmessung/fokus-regeln';
import type { FokusBlock, ZeitDatei } from '@/lib/zeitmessung/modell';

describe('Produkt: Einheit folgt der Basis', () => {
  it('einmalig mit „Monat netto“ → „pauschal netto“; passende und freie Einheiten bleiben', () => {
    expect(einheitFuerBasis('Monat netto', 'einmalig')).toBe(EINHEIT_VORGABE.einmalig);
    expect(einheitFuerBasis('Monat netto', 'jahr')).toBe('Jahr netto');
    expect(einheitFuerBasis('pauschal netto', 'monat')).toBe('Monat netto');
    expect(einheitFuerBasis('Monat netto', 'monat')).toBe('Monat netto');
    expect(einheitFuerBasis('Workshop-Tag', 'einmalig')).toBe('Workshop-Tag');
    expect(einheitFuerBasis('Paket', 'monat')).toBe('Paket');
    expect(einheitFuerBasis('', 'jahr')).toBe('Jahr netto');
    expect(einheitFuerBasis('Monat netto', null)).toBe('Monat netto');
  });
  it('Anzeige im Katalog: gespeicherte Basis einmalig, Einheit noch „Monat netto“ → „pauschal netto“', () => {
    expect(produktEinheit({ preis: { betrag: 900, einheit: 'Monat netto', basis: 'einmalig' } })).toBe('pauschal netto');
    expect(produktEinheit({ preis: { betrag: 900, einheit: 'Monat netto' } })).toBe('Monat netto');
  });
});

describe('Fokus mit Mandat', () => {
  const H = '2026-09-29T08:00:00.000Z';
  const block = (x: Partial<FokusBlock>): FokusBlock => ({ von: H, bis: '2026-09-29T09:00:00.000Z', sek: 3600, schluessel: 'business:sonstiges', label: 'MAKE OS', ...x } as FokusBlock);
  const aufgaben = new Map<string, AufgabeKurz>([['t-1', { id: 't-1', titel: 'Konzept', business: true, offen: true, mandatId: 'm-1' }]]);
  it('Einheit live aus dem Mandat — auch wenn die Gesellschaft erst nach dem Block gesetzt wurde', () => {
    const mandate = new Map([['m-1', { einheit: 'KD Ventures' }]]);
    expect(einheitVonBlock(block({ mandatId: 'm-1' }), new Map(), mandate)).toBe('KD Ventures');
    // Über die Aufgabe (Task.bezug.mandatId) genauso.
    expect(einheitVonBlock(block({ aufgabeId: 't-1' }), aufgaben, mandate)).toBe('KD Ventures');
    // Ohne Mandate-Karte: die am Block gespeicherte Einheit (wie bisher).
    expect(einheitVonBlock(block({ mandatId: 'm-1', einheit: 'Selbstständigkeit' }), new Map())).toBe('Selbstständigkeit');
    const a = auswerten([block({ mandatId: 'm-1' })], new Map(), mandate);
    expect(a.zeilen.find(z => z.art === 'ohne')!.sek).toBe(0);
    expect(a.zeilen.find(z => z.label === 'KD Ventures')!.sek).toBe(3600);
  });
  it('Mandate nur laden, wenn Blöcke oder Aufgaben eins tragen', () => {
    const datei = (b: FokusBlock[]): ZeitDatei => ({ tage: { '2026-09-29': { auto: {}, bewusst: {}, bloecke: b } } });
    expect(brauchtMandate([datei([block({})])], [])).toBe(false);
    expect(brauchtMandate([datei([block({ mandatId: 'm-1' })])], [])).toBe(true);
    expect(brauchtMandate([datei([])], Array.from(aufgaben.values()))).toBe(true);
  });
  it('Kopf nennt Aufgabe, sonst Mandat, sonst Bereich', () => {
    expect(fokusTitel({ label: 'MAKE OS', mandatId: 'm-1' }, undefined, { firma: 'Muster GmbH', titel: 'Retainer' })).toBe('Muster GmbH · Retainer');
    expect(fokusTitel({ label: 'MAKE OS', mandatId: 'm-1' }, 'Konzept schreiben', { firma: 'Muster GmbH', titel: 'Retainer' })).toBe('Konzept schreiben');
    expect(fokusTitel({ label: 'MAKE OS', mandatId: 'm-1' })).toBe('Mandat');
    expect(fokusTitel({ label: 'MAKE OS' })).toBe('MAKE OS');
  });
});

describe('F3: „nur ich“ gilt nur für die eine Aufgabe', () => {
  it('SchnellAnlegen setzt den Schalter nach dem Anlegen zurück', () => {
    const q = readFileSync(path.join(__dirname, '..', 'components/os/aufgaben/SchnellAnlegen.tsx'), 'utf8');
    const anlegen = q.slice(q.indexOf('const anlegen = () => {'), q.indexOf('const chip = '));
    expect(anlegen).toMatch(/setText\(''\);[\s\S]*setNurIch\(false\);/);
    // Der Hinweis nennt „nur ich“ noch für die gerade angelegte Aufgabe (Wert aus dem Rendern, nicht der zurückgesetzte).
    expect(anlegen).toContain("${nurIch ? ' · nur ich' : ''}");
  });
});

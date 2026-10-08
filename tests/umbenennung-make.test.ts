// Umbenennung 30.09. (Kevin: „Ändere bitte überall in der Software MAKE UG in MAKE Innovation GmbH.“)
// Die Gesellschaft mit der Kennung `ug` heißt jetzt „MAKE Innovation GmbH“ (kurz „MAKE“). Die Kennung
// bleibt überall; Altnamen werden beim Lesen erkannt und mit dem neuen Namen angezeigt; der Name steht
// NUR in lib/einheiten.ts. KD Ventures UG (kdv) bleibt unverändert.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  UG_NAME, UG_KURZ, UG_ALTNAMEN, KERN_EINHEITEN_NAMEN, einheitAusGesellschaft, gesellschaftAusEinheit, einheitName,
  finanzOrtAus, finanzOrtName, finanzOrtKurz, firmaAusAngabe, firmaFuerGesellschaft, kontoName,
} from '../lib/einheiten';
import { einheitKurz, passtEinheitFilter, einheitFilterOptionen } from '../lib/aufgaben/einheit';
import { sauberEinheit, passtEinheit, einheitenListe, sauberEinheitenDatei } from '../lib/planung/einheiten';
import { sauberFile, UG_FIRMA } from '../lib/finanzen/finanzplan-bestand';
import { sauberEinstellungen } from '../lib/flaeche/modell';
import { firmierungNochUG, firmierungVorschlag, mitVorgaben } from '../lib/crm/gesellschaften';
import { UG_NICHT_HINTERLEGT, EINHEIT_LABEL as STEUER_LABEL } from '../lib/steuern/rechnen';
import { ABSCHNITTE } from '../lib/finanzen/plan/hilfen';

describe('eine Quelle: lib/einheiten.ts', () => {
  it('ug heißt MAKE Innovation GmbH, kurz MAKE — Kennungen und KD Ventures bleiben', () => {
    expect(UG_NAME).toBe('MAKE Innovation GmbH');
    expect(UG_KURZ).toBe('MAKE');
    expect(einheitAusGesellschaft('ug')).toBe(UG_NAME);
    expect(finanzOrtName('ug')).toBe(UG_NAME);
    expect(finanzOrtKurz('ug')).toBe('MAKE');
    expect(KERN_EINHEITEN_NAMEN).toEqual(['Selbstständigkeit', 'KD Ventures', UG_NAME]);
    expect(finanzOrtName('kdv')).toBe('KD Ventures');
  });
  it('abgeleitete Namen folgen: Steuern, Finanzplan-Menü, UG-Konto', () => {
    expect(STEUER_LABEL.ug).toBe(UG_NAME);
    expect(UG_NICHT_HINTERLEGT).toContain(UG_NAME);
    expect(UG_NICHT_HINTERLEGT).not.toContain('MAKE OS UG');
    // 08.10. abends: MAKE und die Töpfe sind Abschnitte des Blatts „Gesellschaften“ — Titel aus lib/einheiten.ts.
    expect(ABSCHNITTE.gesellschaften.find(a => a.id === 'ug')?.label).toBe(UG_NAME);
    expect(ABSCHNITTE.gesellschaften.find(a => a.id === 'toepfe')?.label).toBe('Töpfe MAKE');
    expect(UG_FIRMA).toEqual({ id: 'ug', name: UG_NAME, bank: '', kontostand: null, stand: null });
  });
});

describe('Altnamen → ug → neuer Anzeigename', () => {
  const alt = [...UG_ALTNAMEN, 'make os ug', 'neue ug', '  MAKE   OS UG ', 'ug', 'MAKE'];
  it.each(alt)('„%s“', a => {
    expect(gesellschaftAusEinheit(a)).toBe('ug');
    expect(finanzOrtAus(a)).toBe('ug');
    expect(firmaFuerGesellschaft(a)).toBe('ug');
    expect(einheitName(a)).toBe(UG_NAME);
    expect(sauberEinheit(a)).toBe(UG_NAME);
    expect(einheitKurz(a)).toBe('MAKE');
    // Filter: ein gespeicherter Altname passt zum heutigen Namen (Aufgaben, Ziele/Meilensteine).
    expect(passtEinheitFilter(a, UG_NAME)).toBe(true);
    expect(passtEinheit(a, UG_NAME)).toBe(true);
  });
  it('die Altnamen stehen in der Liste, die alle Leser nutzen', () => {
    for (const a of ['MAKE OS UG', 'MAKE UG', 'Neue UG', 'UG']) expect(UG_ALTNAMEN).toContain(a);
  });
  it('KD Ventures UG und fremde GmbHs werden NICHT zur MAKE', () => {
    expect(finanzOrtAus('KD Ventures UG')).toBe('kdv');
    expect(finanzOrtAus('KD Management UG')).toBe('kdv');
    expect(firmaAusAngabe('KD Ventures UG')).toBe('kdv');
    expect(einheitName('KD Ventures UG')).not.toBe(UG_NAME);
    expect(gesellschaftAusEinheit('Pilot GmbH')).toBeUndefined();
    expect(einheitName('Pilot GmbH')).toBe('Pilot GmbH');
    expect(firmaAusAngabe('Pilot GmbH')).toBe('kdc');
  });
  it('ZOE-Zuruf: „MAKE“, „MAKE Innovation“, „die UG“ → ug', () => {
    expect(['MAKE', 'MAKE Innovation', 'für die MAKE Innovation GmbH', 'die UG', 'MAKE OS UG'].map(firmaAusAngabe)).toEqual(['ug', 'ug', 'ug', 'ug', 'ug']);
  });
  it('Werteliste des Haushalts: ein gespeicherter Altname verschwindet in der Kerneinheit (keine Doppelte)', () => {
    // 05.10.: Business-Einheiten ohne die Selbstständigkeit (sie gehört zu Privat).
    expect(einheitenListe(['MAKE OS UG', 'Kunde Nord'])).toEqual(['KD Ventures', UG_NAME, 'Kunden', 'Kunde Nord']);
    expect(sauberEinheitenDatei({ eigene: ['Neue UG', 'MAKE OS UG', 'Kunde Nord'] })).toEqual({ eigene: ['Kunde Nord'] });
  });
  it('Filter-Pillen: Aufgaben mit Alt- und Neuname zählen zusammen', () => {
    const o = einheitFilterOptionen(['MAKE OS UG', UG_NAME, 'Neue UG', 'KD Ventures']);
    expect(o.find(x => x.label === UG_NAME)?.anzahl).toBe(3);
    expect(o.some(x => x.label === 'MAKE OS UG')).toBe(false);
  });
});

describe('Finanzplan: das Konto ug heißt beim Lesen neu, eigene Namen bleiben', () => {
  it('Altname am Konto ug → neuer Name; anderes Konto und eigener Name unverändert; keine Formänderung', () => {
    const f = sauberFile({ firmen: [
      { id: 'ug', name: 'MAKE OS UG', bank: 'B', kontostand: 10, stand: '2026-09-01' },
      { id: 'kdv', name: 'KD Ventures UG', bank: '', kontostand: null, stand: null },
      { id: 'f-x', name: 'UG', bank: '', kontostand: null, stand: null },
    ] });
    expect(f.firmen).toEqual([
      { id: 'ug', name: UG_NAME, bank: 'B', kontostand: 10, stand: '2026-09-01' },
      { id: 'kdv', name: 'KD Ventures UG', bank: '', kontostand: null, stand: null },
      { id: 'f-x', name: 'UG', bank: '', kontostand: null, stand: null },
    ]);
    expect(kontoName('ug', 'MAKE Geschäftskonto')).toBe('MAKE Geschäftskonto');
    expect(kontoName('ug', 'Neue UG')).toBe(UG_NAME);
  });
});

describe('Widget-Einstellung „Einheit“: Altname → heutiger Name', () => {
  it('nur die Einheit, nur Kerneinheiten; „alle“/„ohne“/eigene bleiben', () => {
    expect(sauberEinstellungen({ einheit: 'MAKE OS UG', nur: 'dran' })).toEqual({ einheit: UG_NAME, nur: 'dran' });
    expect(sauberEinstellungen({ einheit: 'alle' })).toEqual({ einheit: 'alle' });
    expect(sauberEinstellungen({ einheit: 'ohne' })).toEqual({ einheit: 'ohne' });
    expect(sauberEinstellungen({ einheit: 'Kunde Nord' })).toEqual({ einheit: 'Kunde Nord' });
    expect(sauberEinstellungen({ titel: 'MAKE OS UG' })).toEqual({ titel: 'MAKE OS UG' });
  });
});

describe('Gesellschaften-Stammdaten: Vorschlag ja, still überschreiben nie', () => {
  it('ohne gespeicherte Firmierung gilt der neue Name (Vorschlag und Absender)', () => {
    expect(firmierungVorschlag('ug')).toBe(UG_NAME);
    expect(firmierungVorschlag('kdv')).toBeUndefined();
    expect(mitVorgaben({ id: 'ug' }).name).toBe(UG_NAME);
  });
  it('eine gespeicherte UG-Firmierung bleibt stehen — dafür der Hinweis', () => {
    const g = { id: 'ug' as const, firmierung: 'MAKE OS UG (haftungsbeschränkt)' };
    expect(mitVorgaben(g).name).toBe('MAKE OS UG (haftungsbeschränkt)');
    expect(firmierungNochUG(g)).toBe(true);
    expect(firmierungNochUG({ id: 'ug', firmierung: 'MAKE Unternehmergesellschaft' })).toBe(true);
    expect(firmierungNochUG({ id: 'ug', firmierung: UG_NAME })).toBe(false);
    expect(firmierungNochUG({ id: 'ug' })).toBe(false);
    // KD Ventures ist und bleibt eine UG — kein Hinweis.
    expect(firmierungNochUG({ id: 'kdv', firmierung: 'KD Ventures UG (haftungsbeschränkt)' })).toBe(false);
  });
});

// ── Wächter ─────────────────────────────────────────────────────────────────
const WURZEL = path.resolve(__dirname, '..');
function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const n of readdirSync(path.join(WURZEL, ordner))) {
    const rel = path.join(ordner, n);
    const s = statSync(path.join(WURZEL, rel));
    if (s.isDirectory()) aus.push(...dateien(rel));
    else if (/\.(ts|tsx)$/.test(n)) aus.push(rel);
  }
  return aus;
}
const QUELLEN = ['app', 'components', 'lib'].flatMap(dateien);
const istKommentar = (z: string) => /^\s*(\/\/|\*|\/\*)/.test(z);

describe('Wächter: der Name steht nur in lib/einheiten.ts', () => {
  it('„MAKE OS UG“ kommt in app/components/lib nur noch in lib/einheiten.ts vor (Altnamen-Liste)', () => {
    const treffer = QUELLEN.filter(d => d !== path.join('lib', 'einheiten.ts') && readFileSync(path.join(WURZEL, d), 'utf8').includes('MAKE OS UG'));
    expect(treffer).toEqual([]);
  });
  it('„MAKE Innovation GmbH“ steht in keinem Code außerhalb lib/einheiten.ts fest (nur in Kommentaren)', () => {
    const treffer: string[] = [];
    for (const d of QUELLEN) {
      if (d === path.join('lib', 'einheiten.ts')) continue;
      readFileSync(path.join(WURZEL, d), 'utf8').split('\n').forEach((z, i) => {
        if (z.includes('MAKE Innovation GmbH') && !istKommentar(z)) treffer.push(`${d}:${i + 1}`);
      });
    }
    expect(treffer).toEqual([]);
  });
});

// Umzug aus Malins Supabase: blättern über die 1.000er-Grenze, exakt zählen,
// sauber umwandeln, nichts in MAKE OS Bearbeitetes überschreiben.
// Alles mit einer nachgebauten Supabase-Antwort und erfundenen Daten.

import { describe, it, expect } from 'vitest';
import { tabelleLesen, umwandeln, zusammenfuehren, anmelden, TABELLEN, type Tabelle } from '../lib/finanzen/haushalt/supabase-umzug';

const V = { url: 'https://beispiel.supabase.co', schluessel: 'sb_publishable_beispiel' };

function falscheSupabase(zeilen: Record<string, unknown>[], maxJeAbfrage = 1000): typeof fetch {
  return (async (_url: string, opt?: RequestInit) => {
    const range = String((opt?.headers as Record<string, string>)?.Range ?? '0-999');
    const [von, bis] = range.split('-').map(Number);
    const teil = zeilen.slice(von, Math.min(bis + 1, von + maxJeAbfrage));
    return new Response(JSON.stringify(teil), { status: 206, headers: { 'content-range': `${von}-${von + teil.length - 1}/${zeilen.length}` } });
  }) as unknown as typeof fetch;
}

describe('Supabase lesen', () => {
  it('blättert über die 1.000er-Grenze und zählt exakt', async () => {
    const zeilen = Array.from({ length: 2234 }, (_, i) => ({ id: `b${i}` }));
    const e = await tabelleLesen(V, 'token', 'buchungen', falscheSupabase(zeilen));
    expect(e.zeilen.length).toBe(2234);
    expect(e.gesamt).toBe(2234);
  });
  it('verweigerter Zugriff wird klar gemeldet', async () => {
    const nein = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(tabelleLesen(V, 'token', 'konten', nein)).rejects.toThrow(/Mitgliederliste/);
  });
  it('falsches Passwort: verständliche Meldung, kein Rohfehler', async () => {
    const falsch = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch;
    await expect(anmelden(V, 'x@example.invalid', 'falsch', falsch)).rejects.toThrow('E-Mail oder Passwort stimmt nicht.');
  });
});

describe('Umwandeln', () => {
  const leer = () => Object.fromEntries(TABELLEN.map(t => [t, { zeilen: [], gesamt: 0 }])) as unknown as Record<Tabelle, { zeilen: Record<string, unknown>[]; gesamt: number }>;
  const roh = leer();
  roh.konten = { zeilen: [{ id: 'k1', name: 'Testkonto', inhaber: 'Kevin', einheit: 'privat', iban_suffix: '0001', bank: 'Beispielbank', waehrung: 'EUR', aktiv: true, created_at: 'x' }], gesamt: 1 };
  roh.kategorien = { zeilen: [{ id: 'c1', name: 'Lebensmittel', typ: 'ausgabe', sortierung: 30, monatsbudget: 600 }], gesamt: 1 };
  roh.buchungen = { zeilen: [
    { id: 'b1', konto_id: 'k1', datum: '2026-08-03', betrag: -47.82, beschreibung: 'Supermarkt Beispiel', empfaenger: 'Supermarkt Beispiel', kategorie_id: 'c1', ist_umbuchung: false, einheit: 'privat', zeilen_hash: 'fpx', turnus: 'monatlich', ist_fixkosten: false, updated_at: '2026-08-04T10:00:00Z', neues_feld: 1 },
    { id: 'b2', konto_id: 'k1', datum: '2026-08-05', betrag: '1234.56', beschreibung: 'Gehalt Beispiel', empfaenger: 'Gehalt Beispiel', kategorie_id: 'fehlt', einheit: 'privat' },
    { id: 'b3', konto_id: 'k1', datum: '2026-08-06', betrag: -10, beschreibung: 'X', einheit: 'kemaris' },
    { id: 'b4', konto_id: 'unbekannt', datum: '2026-08-06', betrag: -10, beschreibung: 'Y', einheit: 'privat' },
  ], gesamt: 4 };
  roh.schulden = { zeilen: [{ id: 's1', bezeichnung: 'Kredit Beispiel', einheit: 'privat', startbetrag: 5000, restbetrag: 4200.5, rate: 150, zinssatz: 5.9, aus_buchung_id: 'b2' }], gesamt: 1 };
  roh.belege = { zeilen: [{ id: 'bl1', bezeichnung: 'Quittung Beispiel', einheit: 'selbst', art: 'beleg', erledigt: false }], gesamt: 1 };
  const { haushalt: h, bericht } = umwandeln(roh, '2026-09-24T12:00:00Z');

  it('Euro → Cent, auch aus Text', () => {
    expect(h.buchungen.find(b => b.id === 'b1')!.betrag).toBe(-4782);
    expect(h.buchungen.find(b => b.id === 'b2')!.betrag).toBe(123456);
    expect(h.stamm.kategorien[0].monatsbudget).toBe(60000);
    expect(h.schulden[0]).toMatchObject({ startbetrag: 500000, restbetrag: 420050, rate: 15000, aus_buchung_id: 'b2' });
  });
  it('unbekannte Einheit und unbekanntes Konto werden abgewiesen, nicht geraten', () => {
    expect(h.buchungen.map(b => b.id)).toEqual(['b1', 'b2']);
    expect(bericht.abgewiesen.map(a => [a.id, a.grund])).toEqual([['b3', 'unbekannte Einheit „kemaris“'], ['b4', 'Konto unbekannt']]);
    expect(bericht.zaehlung.buchungen).toEqual({ supabase: 4, gelesen: 4, uebernommen: 2, abgewiesen: 2 });
  });
  it('alte Einheit „selbst“ wird vereinheitlicht, fehlende Kategorie wird „offen“ und gemeldet', () => {
    expect(h.belege[0].einheit).toBe('selbststaendigkeit');
    expect(h.buchungen.find(b => b.id === 'b2')!.kategorie_id).toBeNull();
    expect(bericht.hinweise.join(' ')).toMatch(/nicht vorhandene Kategorien/);
  });
  it('meldet Felder, die das Modell nicht kennt (Schema-Abweichung)', () => {
    expect(bericht.unbekannteFelder.buchungen).toEqual(['neues_feld']);
  });
  it('Summen je Konto und Monat für den Abgleich', () => {
    expect(bericht.summen).toEqual([{ konto: 'Testkonto', monat: '2026-08', anzahl: 2, summe: -4782 + 123456 }]);
  });
});

describe('Zusammenführen', () => {
  it('in MAKE OS Bearbeitetes bleibt, Neues kommt dazu, nur in MAKE OS Angelegtes bleibt', () => {
    const echt = [{ id: 'a', stand: 3, w: 'make-os' }, { id: 'b', stand: 1, w: 'alt' }, { id: 'nur', stand: 1, w: 'make-os' }];
    const probe = [{ id: 'a', stand: 1, w: 'supabase' }, { id: 'b', stand: 1, w: 'supabase' }, { id: 'c', stand: 1, w: 'supabase' }];
    const z = zusammenfuehren(echt, probe);
    expect(Object.fromEntries(z.liste.map(x => [x.id, x.w]))).toEqual({ a: 'make-os', b: 'supabase', nur: 'make-os', c: 'supabase' });
    expect([z.neu, z.ersetzt, z.behalten, z.nurMakeOs]).toEqual([1, 1, 1, 1]);
  });
});

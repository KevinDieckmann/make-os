// ─── N26-Parser gegen den echten Januar-Auszug 2026 ─────────────────────────
// Die Zeilen stammen aus pdf.js selbst (Malins Aufnahme). Echte Kontodaten:
// Datei und Sollwerte liegen nur in .data/pruefdaten/ (von Git ausgeschlossen).
// Fehlen sie — etwa auf Malins Rechner oder im Rohbau für Alex —, überspringt
// sich dieser Test, statt zu scheitern.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ausN26Zeilen, pruefen } from '../lib/finanzen/haushalt/import';

const ORDNER = join(process.cwd(), '.data', 'pruefdaten');
const ZEILEN = join(ORDNER, 'n26-januar-2026-zeilen.json');
const SOLL = join(ORDNER, 'n26-januar-2026-erwartung.json');
const da = existsSync(ZEILEN) && existsSync(SOLL);

describe.skipIf(!da)('N26-PDF: echter Januar-Auszug', () => {
  const zeilen = da ? JSON.parse(readFileSync(ZEILEN, 'utf8')) as string[] : [];
  const soll = da ? JSON.parse(readFileSync(SOLL, 'utf8')) : {};
  const e = ausN26Zeilen(zeilen);
  const k = pruefen(e.buchungen, e.kontrolle);

  it('liest alle Buchungen, Summen stimmen auf den Cent mit dem Auszug', () => {
    expect(e.buchungen.length).toBe(soll.buchungen);
    expect(k.stimmt).toBe(true);
    expect(k.ein).toBe(soll.ein);
    expect(k.aus).toBe(soll.aus);
    expect(e.buchungen.filter(x => x.betrag > 0).length).toBe(soll.anzahlEin);
    expect(e.buchungen.filter(x => x.betrag < 0).length).toBe(soll.anzahlAus);
  });
  it('Summenzeilen und Tabellenkopf sind keine Buchungen', () => {
    expect(e.buchungen.some(x => /Transaktionen|Kontostand/.test(x.beschreibung))).toBe(false);
    expect(e.buchungen.some(x => /^Beschreibung$/.test(x.beschreibung))).toBe(false);
  });
  it('Sparziel-Umbuchungen erkannt, echte Einnahmen ohne sie, N26-Kategorien übernommen', () => {
    expect(e.buchungen.filter(x => x.istUmbuchung).length).toBe(soll.umbuchungen);
    expect(e.buchungen.filter(x => x.betrag > 0 && !x.istUmbuchung).reduce((s, x) => s + x.betrag, 0)).toBe(soll.echteEinnahmen);
    expect(e.buchungen.filter(x => x.n26Kategorie).length).toBe(soll.n26Kategorien);
    expect([e.buchungen[0].beschreibung, e.buchungen[0].datum, e.buchungen[0].betrag]).toEqual(soll.ersteBuchung);
  });
});

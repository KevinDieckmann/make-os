// ─── Finanzen-Säule im Wachstums-Score: Business + Privat ───────────────────
// Kevin, 24.09.: „Privat und Business zusammen.“ Jede Hälfte wird für sich
// aus ihren ECHTEN Faktoren gemittelt; die Säule ist der Schnitt der Hälften,
// die es gibt. Fehlt eine Hälfte, zählt nur die andere — keine erfundene Null.
// Veraltete Haushaltsdaten (letzte Buchung > 45 Tage) sind eine Lücke, kein
// schlechter Wert: die privaten Faktoren gelten dann als nicht gemessen.

import type { Haushalt } from './typen';
import { eur } from './typen';
import { katNamen } from './einordnung';
import { kennzahlen, schuldenbild } from './kennzahlen';
import { luft } from './fixkosten';
import { vollMonate, heuteBerlin, tageZwischen, datumDe } from './monat';

export interface Faktor { label: string; wert: number; quelle: string; echt: boolean }
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function privatFaktoren(h: Haushalt, heute: string = heuteBerlin()): Faktor[] {
  const katName = katNamen(h.stamm);
  const b = h.buchungen.filter(x => x.einheit === 'privat');
  const schulden = h.schulden.filter(s => s.einheit === 'privat');
  const juengste = b.reduce((m, x) => (x.datum > m ? x.datum : m), '');
  const frisch = !!juengste && tageZwischen(juengste, heute) <= 45;
  const alt = juengste ? ` — Daten zu alt (letzte Buchung ${datumDe(juengste)})` : ' — noch keine Buchungen';
  const monate = vollMonate(6, 0, heute);
  const k = kennzahlen(b, monate, katName);
  const l = luft(b, schulden, katName, heute);
  const s = schuldenbild(b, schulden, monate, katName);
  const hatDaten = k.anzahl > 0 && k.ein > 0;
  const anteil = l.einnahmenSchnitt > 0 ? l.luft / l.einnahmenSchnitt : 0;
  return [
    { label: 'Sparquote', wert: clamp(k.sparquote * 5), echt: hatDaten && frisch,
      quelle: hatDaten ? `${k.sparquote.toFixed(0)} % über 6 volle Monate — 20 % = 100${frisch ? '' : alt}` : `keine Einnahmen in 6 vollen Monaten${frisch ? '' : alt}` },
    { label: 'Luft pro Monat', wert: clamp(50 + anteil * 250), echt: l.einnahmenSchnitt > 0 && frisch,
      quelle: l.einnahmenSchnitt > 0 ? `${eur(l.luft, false)} nach Sockel — 20 % des Einkommens = 100, 0 = 50${frisch ? '' : alt}` : `kein Einkommen in 3 vollen Monaten${frisch ? '' : alt}` },
    { label: 'Schuldenabbau', wert: s.rate > 0 ? clamp(s.proMonat / s.rate * 100) : clamp(s.proMonat > 0 ? 100 : 0), echt: schulden.length > 0 && frisch,
      quelle: schulden.length ? `${eur(s.proMonat, false)} getilgt pro Monat gg. ${eur(s.rate, false)} vereinbarte Rate${frisch ? '' : alt}` : 'keine Schulden erfasst' },
  ];
}

function haelfte(f: Faktor[]): number | null {
  const echt = f.filter(x => x.echt);
  return echt.length ? clamp(echt.reduce((a, x) => a + x.wert, 0) / echt.length) : null;
}

/** Die Säule aus beiden Hälften — mit klarer Deckungsregel. */
export function finanzSaeule(business: Faktor[], privat: Faktor[]): { score: number | null; abdeckung: number; teile: { business: number | null; privat: number | null } } {
  const teile = { business: haelfte(business), privat: haelfte(privat) };
  const da = [teile.business, teile.privat].filter((x): x is number => x !== null);
  const alle = [...business, ...(privat.length ? privat : [])];
  return {
    score: da.length ? clamp(da.reduce((a, x) => a + x, 0) / da.length) : null,
    abdeckung: alle.length ? alle.filter(x => x.echt).length / alle.length : 0,
    teile,
  };
}

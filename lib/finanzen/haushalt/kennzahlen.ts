// ─── Kennzahlen und Auswertungen (aus Malins Ansichten) ─────────────────────
// Alles über VOLLE Monate, der laufende bleibt draußen. Verglichen wird mit dem
// gleich langen Zeitraum davor. Jede Zahl ist aus den Buchungen belegbar; wo
// etwas nicht folgt, gibt es keine Zahl statt einer geschätzten.

import type { Beleg, Buchung, Haushalt, Planwert, Posten, Schuld } from './typen';
import { einordnen, summen, istAusgabe, TILGUNG, SPAREN, type KatName, type Summen, artVon } from './einordnung';
import { heuteBerlin, monatVon, monatPlus, tagPlus, tageZwischen, type Monat } from './monat';
import { normal } from './regeln';

export function inMonaten(buchungen: Buchung[], monate: Monat[]): Buchung[] {
  const set = new Set(monate);
  return buchungen.filter(b => set.has(monatVon(b.datum)));
}

export interface Kennzahlen extends Summen {
  monate: number;
  einProMonat: number; ausProMonat: number; fixProMonat: number; varProMonat: number; saldoProMonat: number;
  sparquote: number; fixquote: number;
}

export function kennzahlen(buchungen: Buchung[], monate: Monat[], katName: KatName): Kennzahlen {
  const s = summen(inMonaten(buchungen, monate), katName);
  const n = monate.length || 1;
  return {
    ...s,
    monate: n,
    einProMonat: s.ein / n, ausProMonat: s.aus / n, fixProMonat: s.ausFix / n, varProMonat: s.ausVar / n,
    saldoProMonat: s.saldo / n,
    sparquote: s.ein > 0 ? (s.ein - s.aus) / s.ein * 100 : 0,
    fixquote: s.ein > 0 ? s.ausFix / s.ein * 100 : 0,
  };
}

/** Einordnung der Sparquote — Faustregeln aus der Haushaltsplanung, keine Wahrheit. */
export function bewertungSparquote(q: number): { stufe: 'rot' | 'gelb' | 'gruen'; text: string } {
  if (q < 0) return { stufe: 'rot', text: 'ihr gebt mehr aus, als ihr einnehmt' };
  if (q < 10) return { stufe: 'gelb', text: 'wenig Puffer' };
  if (q < 20) return { stufe: 'gruen', text: 'solide' };
  return { stufe: 'gruen', text: 'sehr gut' };
}

export interface Schuldenbild {
  rest: number; start: number; rate: number; getilgt: number; proMonat: number;
  restMonate: number | null; abgebaut: number;
}

/** Schuldenabbau im Zeitraum. Prognose nur, wenn wirklich getilgt wurde. */
export function schuldenbild(buchungen: Buchung[], schulden: Schuld[], monate: Monat[], katName: KatName): Schuldenbild {
  const rest = schulden.reduce((s, x) => s + (Number(x.restbetrag) || 0), 0);
  const start = schulden.reduce((s, x) => s + (Number(x.startbetrag) || 0), 0);
  const rate = schulden.reduce((s, x) => s + (Number(x.rate) || 0), 0);
  const getilgt = inMonaten(buchungen, monate)
    .filter(b => !b.ist_umbuchung && b.betrag < 0 && b.kategorie_id && TILGUNG.includes(katName(b.kategorie_id)))
    .reduce((s, b) => s + Math.abs(b.betrag), 0);
  const proMonat = getilgt / (monate.length || 1);
  return { rest, start, rate, getilgt, proMonat, restMonate: proMonat > 0 ? Math.ceil(rest / proMonat) : null, abgebaut: start > 0 ? (start - rest) / start * 100 : 0 };
}

/** Der jüngste Monat, für den es echte Buchungen gibt — sonst stünden überall Nullen. */
export function letzterMonatMitDaten(buchungen: Buchung[], heute: string = heuteBerlin()): Monat {
  let m = '';
  for (const b of buchungen) if (!b.ist_umbuchung) { const x = monatVon(b.datum); if (x > m) m = x; }
  return m || monatVon(heute);
}

export function monateMitDaten(buchungen: Buchung[]): Monat[] {
  return Array.from(new Set(buchungen.map(b => monatVon(b.datum)))).sort().reverse();
}

// ── Wofür geht das Geld? ────────────────────────────────────────────────────

export interface Bereich {
  id: string; name: string; summe: number; anzahl: number; anteil: number;
  haendler: { name: string; summe: number; anzahl: number; anteilImBereich: number }[];
}

/** Ausgaben nach Kategorie, darunter die Empfänger. Prozente der Empfänger beziehen sich auf den Bereich. */
export function aufschluesselung(liste: Buchung[], katName: KatName): { gesamt: number; anzahl: number; bereiche: Bereich[] } {
  const aus = liste.filter(b => istAusgabe(einordnen(b, katName)));
  const gesamt = aus.reduce((s, b) => s + Math.abs(b.betrag), 0);
  const nachId = new Map<string, { id: string; name: string; summe: number; anzahl: number; h: Map<string, { name: string; summe: number; anzahl: number }> }>();
  for (const b of aus) {
    const id = b.kategorie_id || '__offen';
    const g = nachId.get(id) ?? { id, name: b.kategorie_id ? (katName(b.kategorie_id) || 'Unbekannt') : 'Noch nicht zugeordnet', summe: 0, anzahl: 0, h: new Map() };
    const betrag = Math.abs(b.betrag);
    g.summe += betrag; g.anzahl++;
    const hn = b.empfaenger || b.beschreibung || 'ohne Namen';
    const hk = normal(hn);
    const e = g.h.get(hk) ?? { name: hn, summe: 0, anzahl: 0 };
    e.summe += betrag; e.anzahl++;
    g.h.set(hk, e); nachId.set(id, g);
  }
  const bereiche = Array.from(nachId.values()).map(g => ({
    id: g.id, name: g.name, summe: g.summe, anzahl: g.anzahl, anteil: gesamt ? g.summe / gesamt * 100 : 0,
    haendler: Array.from(g.h.values()).sort((a, c) => c.summe - a.summe).map(h => ({ ...h, anteilImBereich: g.summe ? h.summe / g.summe * 100 : 0 })),
  })).sort((a, c) => c.summe - a.summe);
  return { gesamt, anzahl: aus.length, bereiche };
}

// ── Woher kommt das Geld? ───────────────────────────────────────────────────

export interface Einnahmebild {
  gesamt: number;
  toepfe: { planbar: number; einmalig: number; durchlauf: number; schuld: number; offen: number; offeneZeilen: number };
  arten: { name: string; topf: 'planbar' | 'einmalig' | 'durchlauf' | 'schuld' | 'offen'; summe: number; anzahl: number; anteil: number }[];
}

/** Eingänge (ohne Umbuchungen) nach Art und Topf. */
export function einnahmebild(liste: Buchung[], katName: KatName): Einnahmebild {
  const rein = liste.filter(b => !b.ist_umbuchung && b.betrag > 0);
  const gesamt = rein.reduce((s, b) => s + b.betrag, 0);
  const nach = new Map<string, { name: string; summe: number; anzahl: number }>();
  for (const b of rein) {
    const name = b.kategorie_id ? (katName(b.kategorie_id) || 'Noch nicht zugeordnet') : 'Noch nicht zugeordnet';
    const e = nach.get(name) ?? { name, summe: 0, anzahl: 0 };
    e.summe += b.betrag; e.anzahl++; nach.set(name, e);
  }
  const toepfe = { planbar: 0, einmalig: 0, durchlauf: 0, schuld: 0, offen: 0, offeneZeilen: 0 };
  const arten = Array.from(nach.values()).map(a => {
    const topf = a.name === 'Noch nicht zugeordnet' ? 'offen' as const : artVon(a.name);
    toepfe[topf] += a.summe;
    if (topf === 'offen') toepfe.offeneZeilen += a.anzahl;
    return { ...a, topf, anteil: gesamt ? a.summe / gesamt * 100 : 0 };
  }).sort((a, c) => c.summe - a.summe);
  return { gesamt, toepfe, arten };
}

// ── Ist gegen Soll ──────────────────────────────────────────────────────────

/** Ist-Wert je Posten — über die eine Einordnung. „Umsatz“ ist echtes Einkommen (ohne Kredit, ohne Durchlauf). */
export function istWert(posten: Posten, buchungen: Buchung[], monat: Monat, katName: KatName): number {
  const b = buchungen.filter(x => monatVon(x.datum) === monat);
  const s = summen(b, katName);
  const inKat = (x: Buchung, namen: string[]) => !x.ist_umbuchung && x.betrag < 0 && namen.includes(katName(x.kategorie_id));
  const betragVon = (l: Buchung[]) => l.reduce((a, x) => a + Math.abs(x.betrag), 0);
  if (posten === 'Umsatz') return s.ein;
  if (posten === 'Sparrate') return betragVon(b.filter(x => inKat(x, SPAREN)));
  if (posten === 'Tilgung') return betragVon(b.filter(x => inKat(x, TILGUNG)));
  return s.aus - betragVon(b.filter(x => inKat(x, [...SPAREN, ...TILGUNG])));
}

export function sollWert(posten: Posten, planwerte: Planwert[], monat: Monat, einheit = 'privat'): number | null {
  const j = Number(monat.slice(0, 4)), m = Number(monat.slice(5, 7));
  const p = planwerte.find(x => x.einheit === einheit && x.jahr === j && x.monat === m && x.posten === posten);
  return p ? p.sollwert : null;
}

// ── Wichtig diese Woche ─────────────────────────────────────────────────────

export interface Punkt { dringend: boolean; text: string; art: 'rate' | 'rechnung' | 'beleg' | 'zuordnen' | 'minus' | 'import' }

/** Was steht an? Überfälliges zuerst. Gleiche Regeln wie Malins Übersicht. */
export function wichtig(h: Pick<Haushalt, 'buchungen' | 'schulden' | 'belege'>, katName: KatName, heute: string = heuteBerlin(), eurFn: (c: number) => string = c => String(c / 100)): Punkt[] {
  const punkte: Punkt[] = [];
  const bis = tagPlus(heute, 14);
  for (const x of h.schulden) {
    if (x.naechste_faelligkeit && x.naechste_faelligkeit <= bis) {
      punkte.push({ art: 'rate', dringend: x.naechste_faelligkeit <= heute, text: `Rate „${x.bezeichnung}“${x.rate ? ` über ${eurFn(x.rate)}` : ''} ist am ${deutsch(x.naechste_faelligkeit)} fällig.` });
    }
  }
  const rechnungen = h.belege.filter(b => !b.erledigt && b.art === 'rechnung');
  for (const b of rechnungen.filter(x => x.faellig_am && x.faellig_am <= bis)) {
    const spaet = b.faellig_am! <= heute;
    punkte.push({ art: 'rechnung', dringend: spaet, text: `${spaet ? 'Überfällig' : 'Zu zahlen'}: ${b.betrag ? `${eurFn(b.betrag)} an ` : ''}${b.empfaenger || b.bezeichnung} — ${spaet ? 'war fällig am' : 'fällig'} ${deutsch(b.faellig_am)}${b.verursacher ? ` (${b.verursacher})` : ''}` });
  }
  const ohneBetrag = rechnungen.filter(b => !b.betrag).length;
  if (ohneBetrag) punkte.push({ art: 'rechnung', dringend: false, text: `${ohneBetrag} offene Rechnung${ohneBetrag === 1 ? ' hat' : 'en haben'} keinen Betrag. Solange das so ist, stimmt „Noch zu zahlen“ nicht.` });
  for (const b of h.belege.filter(x => !x.erledigt && x.art === 'beleg' && x.faellig_am && x.faellig_am <= bis)) {
    punkte.push({ art: 'beleg', dringend: b.faellig_am! <= heute, text: `Beleg fehlt: ${b.bezeichnung}${b.verursacher ? ` (${b.verursacher})` : ''} — fällig ${deutsch(b.faellig_am)}` });
  }
  const offen = h.buchungen.filter(b => !b.kategorie_id && !b.ist_umbuchung).length;
  if (offen) punkte.push({ art: 'zuordnen', dringend: offen > 50, text: `${offen} Buchung${offen === 1 ? ' ist' : 'en sind'} noch keiner Kategorie zugeordnet. Solange das so ist, stimmt keine Auswertung ganz.` });
  const laufend = monatVon(heute);
  const s = summen(h.buchungen.filter(b => monatVon(b.datum) === laufend), katName);
  if (s.anzahl && s.saldo < 0) punkte.push({ art: 'minus', dringend: false, text: `Dieser Monat liegt aktuell ${eurFn(Math.abs(s.saldo))} im Minus.` });
  const juengste = h.buchungen.reduce((m, b) => (b.datum > m ? b.datum : m), '');
  if (juengste && tageZwischen(juengste, heute) > 40) punkte.push({ art: 'import', dringend: true, text: `Die letzte Buchung ist vom ${deutsch(juengste)} — seitdem wurde kein Kontoauszug eingelesen.` });
  return punkte.sort((a, c) => Number(c.dringend) - Number(a.dringend));
}

function deutsch(tag: string | null | undefined): string {
  const m = String(tag ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '–';
}

/** Offene Rechnungen und Belege einer Einheit. */
export function offeneBelege(belege: Beleg[], art: 'rechnung' | 'beleg', einheit?: string): Beleg[] {
  return belege.filter(b => b.art === art && !b.erledigt && (!einheit || b.einheit === einheit));
}

export { monatPlus };

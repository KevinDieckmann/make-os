// ─── Zuordnungsregeln — das Gedächtnis (aus Malins regeln.js) ───────────────
// Einmal gelernt, wird nie wieder gefragt. Wortgrenzen sind Pflicht: in
// Version 1 passte die OBI-Regel auf „Miles mOBIlity“.
//
// Abweichung von Malin, bewusst: Eigene Regeln haben VORRANG vor der
// Kategorie, die N26 mitliefert. Bei ihr stand das im Kommentar, der Code tat
// das Gegenteil (die Regel setzte nur, wenn noch nichts gesetzt war).

import type { Buchung, Regel, Turnus } from './typen';

export function normal(s: unknown): string {
  return String(s ?? '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim();
}

/** Trifft das Muster den Text? ganzesWort: nur an Wortgrenzen (Standard). */
export function trifft(muster: string, text: string, ganzesWort = true): boolean {
  const m = normal(muster), t = normal(text);
  if (!m) return false;
  if (!ganzesWort) return t.includes(m);
  const flucht = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${flucht}([^a-z0-9]|$)`, 'i').test(t);
}

/** Beste Regel: niedrigere Priorität zuerst, dann das längere (spezifischere) Muster. */
export function finde(b: Pick<Buchung, 'empfaenger' | 'beschreibung'>, regeln: Regel[]): Regel | null {
  const kandidaten = regeln.filter(r => trifft(r.muster, b.empfaenger, r.ganzes_wort) || trifft(r.muster, b.beschreibung, r.ganzes_wort));
  kandidaten.sort((a, c) => (a.prioritaet - c.prioritaet) || (String(c.muster).length - String(a.muster).length));
  return kandidaten[0] ?? null;
}

/** Regel auf eine (neue) Buchung anwenden. Die Regel gewinnt gegen die N26-Kategorie. */
export function anwenden<B extends Pick<Buchung, 'empfaenger' | 'beschreibung' | 'kategorie_id' | 'ist_umbuchung' | 'ist_fixkosten' | 'turnus'>>(b: B, regeln: Regel[]): B {
  const r = finde(b, regeln);
  if (!r) return b;
  const neu = { ...b };
  if (r.kategorie_id) neu.kategorie_id = r.kategorie_id;
  if (r.ist_umbuchung) neu.ist_umbuchung = true;
  if (r.ist_fixkosten) { neu.ist_fixkosten = true; neu.turnus = r.turnus || 'monatlich'; }
  return neu;
}

/** Welche vorhandenen Buchungen eine Regel rückwirkend trifft (die gerade bearbeitete ausgenommen). */
export function rueckwirkendTreffer(muster: string, ganzesWort: boolean, buchungen: Buchung[], ausserId?: string | null): string[] {
  return buchungen
    .filter(b => (!ausserId || b.id !== ausserId) && (trifft(muster, b.empfaenger, ganzesWort) || trifft(muster, b.beschreibung, ganzesWort)))
    .map(b => b.id);
}

export const TURNUS: Record<Turnus, { faktor: number; name: string }> = {
  monatlich: { faktor: 1, name: 'monatlich' },
  quartal: { faktor: 1 / 3, name: 'quartalsweise' },
  jahr: { faktor: 1 / 12, name: 'jährlich' },
};

export function turnusAus(roh: unknown): Turnus {
  return roh === 'quartal' || roh === 'jahr' ? roh : 'monatlich';
}

/** Monatswert einer Zahlung: Quartal durch 3, Jahr durch 12. Betrag in Cent, Ergebnis in Cent. */
export function proMonat(betrag: number, turnus: unknown): number {
  const t = TURNUS[turnusAus(turnus)];
  return Math.abs(Number(betrag) || 0) * t.faktor;
}

export function turnusName(turnus: unknown): string { return TURNUS[turnusAus(turnus)].name; }

/** Der Selbsttest aus Malins Cockpit — hier als Funktion, die Tests rufen sie. */
export function selbsttest(): string[] {
  const f: string[] = [];
  if (trifft('OBI', 'Miles Mobility GmbH')) f.push('OBI trifft fälschlich Miles Mobility');
  if (!trifft('OBI', 'OBI Markt Berlin')) f.push('OBI trifft OBI Markt nicht');
  if (!trifft('REWE', 'REWE Markt GmbH')) f.push('REWE trifft REWE Markt nicht');
  if (trifft('Rossmann', 'Grossmannstrasse 4')) f.push('Rossmann trifft fälschlich Grossmannstrasse');
  if (!trifft('dm', 'dm-drogerie markt')) f.push('dm trifft dm-drogerie nicht');
  if (!trifft('Müller', 'MUELLER HANDEL GMBH')) f.push('Umlaut-Normalisierung kaputt');
  if (trifft('dm', 'Amsterdam Ticket')) f.push('dm trifft fälschlich Amsterdam');
  return f;
}

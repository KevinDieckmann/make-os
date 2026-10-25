// ─── Fulfillment · Kunden-Seite — der Kopf ohne Doppelungen (24.10., Kern-Bau-Test: „Firmenname steht doppelt“) ────────────────────────────────────────
// Ein Mandat heißt oft „<Firma> · <Produkt>“ (so legt es der Weg vom Deal an). Der Kopf der Kunden-Seite zeigte darum die Firma zweimal (Überschrift UND
// „für <Firma>“) und das Produkt zweimal (Überschrift UND „· <Ablauf>“). Regel (rein, client-sicher — die öffentliche Seite bündelt sie mit): die Überschrift
// ohne den Firmennamen am Anfang bzw. Ende (er steht darunter), der Zusatz nur, wenn er nicht schon in der Überschrift steht. Nichts geht verloren: bleibt nach dem
// Entfernen nichts übrig, steht der Titel wie er ist.

const norm = (s: string): string => s.toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
const TRENNER = /^[\s·•|:–—-]+|[\s·•|:–—-]+$/g;

/** Der Firmenname am Anfang bzw. Ende eines Titels (mit Trennern) entfernt — sonst der Titel unverändert. */
export function ohneFirma(titel: string, firma: string): string {
  const t = titel.trim(), f = firma.trim();
  if (!f || norm(t) === norm(f)) return t;
  const tl = t.toLocaleLowerCase('de'), fl = f.toLocaleLowerCase('de');
  let rest = t;
  if (tl.startsWith(fl)) rest = t.slice(f.length);
  else if (tl.endsWith(fl)) rest = t.slice(0, t.length - f.length);
  else return t;
  const sauber = rest.replace(TRENNER, '').trim();
  return sauber || t;
}

/** Was der Kopf zeigt: Überschrift, „für <Firma>“ (nur mit Mandat) und der Ablauf (nur, wenn er nicht schon in der Überschrift steht). */
export function kundenKopf(s: { mandat?: string; firma: string; paket?: string }): { titel: string; firma?: string; paket?: string } {
  const titel = s.mandat ? ohneFirma(s.mandat, s.firma) : s.firma;
  const paket = s.paket && !norm(titel).includes(norm(s.paket)) ? s.paket : undefined;
  return { titel, ...(s.mandat ? { firma: s.firma } : {}), ...(paket ? { paket } : {}) };
}

/**
 * Der Kopf des Falls INTERN (25.10., Kern-Reste 4 — Fulfillment › Fall nannte die Firma zweimal: Titel „<Firma> · <Produkt>“ und darunter „Fulfillment · <Firma>“):
 * dieselbe Regel wie die Kunden-Seite — der Titel ohne den Firmennamen (`ohneFirma`), die Firma genau einmal darunter. Ohne Mandat „Fall“.
 */
export function fallKopf(s: { titel?: string; firma?: string } | null): { titel: string; unter: string } {
  if (!s?.titel) return { titel: 'Fall', unter: 'Fulfillment · Fall' };
  const firma = s.firma?.trim() ?? '';
  return { titel: firma ? ohneFirma(s.titel, firma) : s.titel, unter: firma ? `Fulfillment · ${firma}` : 'Fulfillment' };
}

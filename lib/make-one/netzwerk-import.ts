// ─── MAKE OS — Kontakte einfügen ────────────────────────────────────────────
// Kevin und Malin haben ihre Kontakte in Kopf, Handy, LinkedIn und im
// Postfach. Diese Datei zerlegt eingefügten Text in saubere Kontaktkarten —
// deterministisch, damit man vor dem Übernehmen sieht, was passiert.
//
// Client-safe: keine Server-Importe.

import type { Kontakt, Naehe } from './netzwerk-data';

export interface Rohling {
  name: string;
  firma?: string;
  rolle?: string;
  email?: string;
  telefon?: string;
  /** Die Zeile, aus der er stammt — für die Vorschau. */
  quelleZeile: string;
  /** Gibt es den Namen oder die E-Mail schon? */
  doppelt?: boolean;
}

const MAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const TEL = /(\+?\d[\d\s/()-]{7,}\d)/;

/** Trennzeichen, die in Exporten üblich sind — Komma, Semikolon, Tab, Pipe. */
const SPALTE = /\s*[;,|\t]\s*|\s+[–—]\s+/;

/**
 * Eine Zeile in einen Rohling zerlegen. Erkennt E-Mail und Telefon überall,
 * der Rest wird nach Position gelesen: Name, Firma, Rolle.
 */
export function zeileLesen(zeile: string): Rohling | null {
  const roh = zeile.trim();
  if (!roh || roh.length < 2) return null;

  const email = roh.match(MAIL)?.[0];
  let rest = email ? roh.replace(email, ' ') : roh;
  // Telefon erst nach der E-Mail suchen, sonst frisst es Ziffern daraus.
  const telefon = rest.match(TEL)?.[0]?.trim();
  if (telefon) rest = rest.replace(telefon, ' ');
  // Klammer-Zusatz gilt als Rolle: „Frank Mathick (Finanzen)".
  const klammer = rest.match(/\(([^)]{2,60})\)/)?.[1];
  if (klammer) rest = rest.replace(`(${klammer})`, ' ');

  const teile = rest.split(SPALTE).map(t => t.replace(/[<>"]/g, '').trim()).filter(Boolean);
  let name = teile[0] ?? '';
  // Ohne Namen, aber mit E-Mail: aus der Adresse einen lesbaren Namen bauen.
  if (!name && email) {
    name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!name) return null;

  return {
    name: name.slice(0, 120),
    firma: teile[1]?.slice(0, 120),
    rolle: (klammer ?? teile[2])?.slice(0, 120),
    email,
    telefon,
    quelleZeile: roh.slice(0, 200),
  };
}

/** Mehrere Zeilen auf einmal — leere Zeilen und Kopfzeilen fliegen raus. */
export function textLesen(text: string, vorhanden: Kontakt[] = []): Rohling[] {
  const namen = new Set(vorhanden.map(k => k.name.toLowerCase().trim()));
  const mails = new Set(vorhanden.map(k => k.email?.toLowerCase().trim()).filter(Boolean));
  const gesehen = new Set<string>();

  return text.split(/\r?\n/)
    .map(zeileLesen)
    .filter((r): r is Rohling => !!r)
    // Kopfzeilen aus Exporten wegwerfen.
    .filter(r => !/^(name|vorname|first ?name|kontakt|e-?mail)$/i.test(r.name))
    .filter(r => {
      // Doppelte innerhalb des Einfügens nur einmal. Name UND Mail prüfen —
      // dieselbe Person steht oft einmal mit und einmal ohne Adresse drin.
      const nk = r.name.toLowerCase().trim();
      const mk = r.email?.toLowerCase().trim();
      if (gesehen.has(nk) || (mk && gesehen.has(mk))) return false;
      gesehen.add(nk);
      if (mk) gesehen.add(mk);
      return true;
    })
    .map(r => ({
      ...r,
      doppelt: namen.has(r.name.toLowerCase().trim()) || (!!r.email && mails.has(r.email.toLowerCase().trim())),
    }));
}

/** Rohling zu Kontakt — Nähe und Besitzer kommen aus der Einfüge-Einstellung. */
export function zuKontakt(r: Rohling, naehe: Naehe, besitzer: Kontakt['besitzer'], quelle: string, i: number): Kontakt {
  return {
    id: `k-${Date.now().toString(36)}-${i}`,
    name: r.name,
    firma: r.firma,
    rolle: r.rolle,
    email: r.email,
    telefon: r.telefon,
    naehe,
    besitzer,
    quelle: quelle || undefined,
  };
}

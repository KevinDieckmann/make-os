// ─── MAKE OS — Bremse gegen Passwort-Raten (25.09.) ─────────────────────────
// Kevin: „sicher in der höchsten Stufe“. Die Anmeldung vergleicht schon
// zeitkonstant gegen scrypt-Hashes — aber ohne Bremse ließe sich online raten.
// Hier: je Schlüssel (Adresse bzw. E-Mail) fünf Fehlversuche frei, danach
// wächst die Wartezeit (30 s, 60 s, 2 min … höchstens 15 min). Ein Erfolg setzt
// den Schlüssel zurück. Im Speicher des einen App-Prozesses — für einen Server
// genau richtig, und nach einem Neustart beginnt niemand gesperrt.

const FREI = 5;
const FENSTER_MS = 15 * 60_000;
const MAX_MS = 15 * 60_000;

interface Eintrag { fehl: number; erster: number; gesperrtBis: number }
const stand = new Map<string, Eintrag>();

/** Darf dieser Schlüssel es gerade versuchen? Sonst: wie viele Sekunden warten. */
export function pruefe(schluessel: string, jetzt = Date.now()): { erlaubt: boolean; warteSek: number } {
  const e = stand.get(schluessel);
  if (!e) return { erlaubt: true, warteSek: 0 };
  if (jetzt - e.erster > FENSTER_MS && jetzt >= e.gesperrtBis) { stand.delete(schluessel); return { erlaubt: true, warteSek: 0 }; }
  return jetzt < e.gesperrtBis ? { erlaubt: false, warteSek: Math.ceil((e.gesperrtBis - jetzt) / 1000) } : { erlaubt: true, warteSek: 0 };
}

/** Ein Fehlversuch: ab dem sechsten wird die Wartezeit jedes Mal doppelt so lang. */
export function fehlschlag(schluessel: string, jetzt = Date.now()): void {
  const alt = stand.get(schluessel);
  const e: Eintrag = alt && jetzt - alt.erster <= FENSTER_MS ? { ...alt, fehl: alt.fehl + 1 } : { fehl: 1, erster: jetzt, gesperrtBis: 0 };
  if (e.fehl > FREI) e.gesperrtBis = jetzt + Math.min(30_000 * 2 ** (e.fehl - FREI - 1), MAX_MS);
  stand.set(schluessel, e);
  if (stand.size > 5000) for (const [k, v] of Array.from(stand.entries())) if (jetzt - v.erster > FENSTER_MS && jetzt >= v.gesperrtBis) stand.delete(k);
}

export function erfolg(schluessel: string): void { stand.delete(schluessel); }

/**
 * Adresse des Aufrufers: der LETZTE Eintrag in X-Forwarded-For — den setzt der
 * eigene Vorbau (Caddy); frühere Einträge könnte ein Angreifer selbst schicken.
 */
export function adresse(req: Request): string {
  // Den Kopfzeilen nur hinter dem eigenen Vorbau trauen (Caddy auf dem Server) — sonst könnte ein
  // direkter Aufrufer sich mit jedem Versuch eine neue Adresse geben (26.09.).
  const vorbau = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1';
  if (!vorbau) return 'direkt';
  const xff = req.headers.get('x-forwarded-for');
  const letzte = xff?.split(',').map(s => s.trim()).filter(Boolean).pop();
  return letzte || req.headers.get('x-real-ip') || 'unbekannt';
}

/** Nur für Tests. */
export function _zuruecksetzen(): void { stand.clear(); }

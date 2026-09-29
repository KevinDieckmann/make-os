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
export function pruefe(schluessel: string, jetzt: number = Date.now()): { erlaubt: boolean; warteSek: number } {
  const e = stand.get(schluessel);
  if (!e) return { erlaubt: true, warteSek: 0 };
  if (jetzt - e.erster > FENSTER_MS && jetzt >= e.gesperrtBis) { stand.delete(schluessel); return { erlaubt: true, warteSek: 0 }; }
  return jetzt < e.gesperrtBis ? { erlaubt: false, warteSek: Math.ceil((e.gesperrtBis - jetzt) / 1000) } : { erlaubt: true, warteSek: 0 };
}

/**
 * Ein Fehlversuch: ab dem sechsten wird die Wartezeit jedes Mal doppelt so lang. `frei` (F1 #13): eigenes Budget für
 * Zähler, die keine Fehlversuche sind (z. B. Aufrufe der öffentlichen Buchungsseite) — Standard 5.
 */
export function fehlschlag(schluessel: string, jetzt: number = Date.now(), frei: number = FREI): void {
  const alt = stand.get(schluessel);
  const e: Eintrag = alt && jetzt - alt.erster <= FENSTER_MS ? { ...alt, fehl: alt.fehl + 1 } : { fehl: 1, erster: jetzt, gesperrtBis: 0 };
  if (e.fehl > frei) e.gesperrtBis = jetzt + Math.min(30_000 * 2 ** (e.fehl - frei - 1), MAX_MS);
  stand.set(schluessel, e);
  if (stand.size > 5000) for (const [k, v] of Array.from(stand.entries())) if (jetzt - v.erster > FENSTER_MS && jetzt >= v.gesperrtBis) stand.delete(k);
}

export function erfolg(schluessel: string): void { stand.delete(schluessel); }

/**
 * Adresse des Aufrufers: der LETZTE Eintrag in X-Forwarded-For — den setzt der
 * eigene Vorbau (Caddy); frühere Einträge könnte ein Angreifer selbst schicken.
 */
export function adresse(req: Request): string {
  return adresseAusKoepfen(req.headers);
}
/** Wie `adresse`, aus den Köpfen allein (Server-Seiten mit `headers()` — S1 #21, Drosselung von /buchen/<slug>). */
export function adresseAusKoepfen(h: { get(n: string): string | null }): string {
  // Den Kopfzeilen nur hinter dem eigenen Vorbau trauen (Caddy auf dem Server) — sonst könnte ein
  // direkter Aufrufer sich mit jedem Versuch eine neue Adresse geben (26.09.).
  const vorbau = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1';
  if (!vorbau) return 'direkt';
  const xff = h.get('x-forwarded-for');
  const letzte = xff?.split(',').map(s => s.trim()).filter(Boolean).pop();
  return letzte || h.get('x-real-ip') || 'unbekannt';
}

/**
 * Netz einer Adresse für die Drosselung öffentlicher Seiten (F1 #13): IPv4 wie sie ist, IPv6 auf das /64 gekürzt — ein
 * Anschluss bekommt meist ein ganzes /64 und könnte sonst mit jeder Anfrage eine neue Adresse nehmen.
 */
export function netzVon(ip: string): string {
  const v = ip.trim().replace(/^\[|\]$/g, '').split('%')[0];
  if (!v.includes(':')) return v;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(v);
  if (v4) return v4[1];
  const [kopf, rumpf] = v.split('::');
  const a = kopf ? kopf.split(':') : [];
  const b = rumpf !== undefined && rumpf ? rumpf.split(':') : [];
  const voll = rumpf !== undefined ? [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return `${voll.slice(0, 4).map(x => (parseInt(x, 16) || 0).toString(16)).join(':')}::/64`;
}
/** `adresse(req)` als Netz (IPv6 /64) — für die Drosselung der öffentlichen Buchungsseite. */
export const adresseNetz = (req: Request): string => netzVon(adresse(req));

/** Nur für Tests. */
export function _zuruecksetzen(): void { stand.clear(); }

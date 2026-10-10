// ─── Öffentliche Netz-Ziele erkennen (10.10., Fulfillment C3; FULFILLMENT_KONZEPT.md 4.8) — rein ─────────────────────────────────────────
// EINE Regel für „ist diese Adresse im eigenen/privaten Netz?“ — vorher nur in lib/postfach/transport.ts (IMAP/SMTP der Postfächer),
// jetzt auch für den Web-Abruf der Analyse-Agenten (lib/fulfillment/analyse/web-lesen.ts). Beide prüfen jede aufgelöste Adresse damit;
// ein Ziel im eigenen Netz (Loopback, privat, link-lokal, Carrier-NAT, Multicast, IPv6 ULA/link-lokal, IPv4-mapped) wird abgelehnt — so kann
// eine fremde Seite oder ein Postfach-Eintrag nie Dienste hinter der Firewall (Docker-Netz, Metadaten-Dienst der Cloud) erreichen.
// Unbekannte Formen gelten als intern (fail-closed). Rein und ohne Node-Module (die Auflösung macht der Aufrufer).

/** IPv4 als vier Zahlen (nur die Punkt-Schreibweise, je Teil 0–255) — sonst null. */
function ipv4Teile(ip: string): number[] | null {
  const t = ip.split('.');
  if (t.length !== 4 || !t.every(x => /^\d{1,3}$/.test(x))) return null;
  const n = t.map(Number);
  return n.every(x => x >= 0 && x <= 255) ? n : null;
}

/** Ist das eine IPv6-Adresse (grobe Form: hexadezimale Gruppen mit Doppelpunkten, optional eingebettetes IPv4 am Ende)? */
const IPV6 = /^[0-9a-f:]+(?:\d{1,3}(?:\.\d{1,3}){3})?$/i;

/** Ist diese IP-Adresse im eigenen/privaten Netz (oder kein gültiges Ziel)? Rein. */
export function ipIntern(ip: string): boolean {
  const roh = String(ip ?? '').trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = ipv4Teile(roh);
  if (v4) {
    const [a, b, c] = v4;
    return a === 10 || a === 127 || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)          // Carrier-NAT
      || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF-Protokoll, Dokumentation
      || (a === 198 && (b === 18 || b === 19))        // Benchmark-Netz
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // Dokumentation
      || a >= 224;                                    // Multicast, reserviert, Broadcast
  }
  if (roh.includes(':') && IPV6.test(roh)) {
    const x = roh.toLowerCase();
    if (x === '::1' || x === '::') return true;
    // IPv4-mapped/-kompatibel: Punkt-Schreibweise oder zwei Hex-Gruppen am Ende.
    const mapped = /^(?:0*:)*(?:::)?ffff:(.+)$/.exec(x) ?? /^::(\d{1,3}(?:\.\d{1,3}){3})$/.exec(x);
    if (mapped) {
      const rest = mapped[1];
      if (ipv4Teile(rest)) return ipIntern(rest);
      const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
      if (hex) { const h = parseInt(hex[1], 16), l = parseInt(hex[2], 16); return ipIntern(`${h >> 8}.${h & 255}.${l >> 8}.${l & 255}`); }
      return true;
    }
    if (x.startsWith('64:ff9b:')) return true; // NAT64 — könnte auf interne IPv4 zeigen
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff') || x.startsWith('2001:db8') || x.startsWith('::');
  }
  return true;
}

/** Ist das überhaupt eine IP-Adresse (dann wird nicht aufgelöst)? */
export const istIpAdresse = (host: string): boolean => !!ipv4Teile(host) || (host.includes(':') && IPV6.test(host.replace(/^\[|\]$/g, '')));

/** Eine aufgelöste Adresse — die, mit der verbunden wird (gegen DNS-Rebinding festgehalten). */
export interface Ziel { adresse: string; familie: 4 | 6 }

/**
 * Aus den Antworten einer DNS-Auflösung das Ziel wählen (rein): leer → null; IRGENDEINE interne Adresse → null (ein Name, der auch nach
 * innen zeigt, ist nie ein öffentliches Ziel); sonst die erste Adresse.
 */
export function oeffentlichesZiel(antworten: readonly { address: string; family?: number }[]): Ziel | null {
  if (!antworten.length || antworten.some(a => ipIntern(a.address))) return null;
  const a = antworten[0];
  return { adresse: a.address, familie: a.family === 6 || a.address.includes(':') ? 6 : 4 };
}

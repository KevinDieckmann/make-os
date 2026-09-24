// ─── MAKE OS — Die eigene Adresse von innen (24.09.) ────────────────────────
// Mehrere Routen rufen andere Routen desselben Servers auf, mit dem
// Dienstschlüssel im Kopf. Bisher nahmen sie dafür die Adresse, unter der die
// Anfrage kam. Seit Malin über Tailscale kommt (und später alles über
// Hetzner), ist das die Adresse eines Vorbaus — von innen nicht immer
// erreichbar. Und schlimmer: der Schlüssel ginge an einen Host, den die
// Anfrage selbst benennt. Deshalb ruft sich der Server immer direkt an.

/** Wohin sich der Server selbst ruft — nie die Adresse aus der Anfrage. */
export function innenAdresse(req?: Request): string {
  const fest = process.env.MAKE_OS_INTERN?.trim();
  if (fest) return fest.replace(/\/+$/, '');
  if (req) {
    const u = new URL(req.url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.origin;
  }
  return `http://localhost:${process.env.PORT || 3001}`;
}

/**
 * Die Adresse, unter der Menschen MAKE OS öffnen (für Einladungslinks).
 * Steht in .env.local als MAKE_OS_ADRESSE, etwa die Tailscale-Adresse.
 */
export function aussenAdresse(): string | null {
  const a = process.env.MAKE_OS_ADRESSE?.trim();
  return a ? a.replace(/\/+$/, '') : null;
}

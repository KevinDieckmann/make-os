// ─── Dienstweg erkennen (Arbeiter, Bote, Takt) ──────────────────────────────
// Eine Prüfung für alle Routen, die nur der Dienstschlüssel öffnen darf —
// zeitkonstanter Vergleich, damit der Schlüssel nicht zeichenweise erraten
// werden kann. Seit 05.10. nur von innen (Docker-Netz, Loopback — lib/zugang/intern.ts):
// derselbe Schlüssel über Caddy ist KEIN Dienstweg mehr (die Middleware weist ihn dort ab).

import { gleich } from './sitzung';
import { anfrageIntern } from './intern';

export function istDienst(req: Request): boolean {
  const schluessel = process.env.MAKE_OS_KEY;
  const kopf = req.headers.get('x-make-key');
  return !!schluessel && !!kopf && gleich(kopf, schluessel) && anfrageIntern(req.headers);
}

/**
 * Der Mac-Zulieferer (05.10.): die Middleware setzt `x-make-zulieferer` (`1` = eigener Zulieferer-Schlüssel, `alt` =
 * Übergang mit MAKE_OS_KEY von außen) und löscht den Kopf bei allen anderen Anfragen. Der Dienstweg von innen darf weiter.
 */
export function istZulieferer(req: Request): boolean {
  const z = req.headers.get('x-make-zulieferer');
  return z === '1' || z === 'alt' || istDienst(req);
}

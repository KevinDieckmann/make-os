// ─── Dienstweg erkennen (Arbeiter, Bote, Takt) ──────────────────────────────
// Eine Prüfung für alle Routen, die nur der Dienstschlüssel öffnen darf —
// zeitkonstanter Vergleich, damit der Schlüssel nicht zeichenweise erraten
// werden kann.

import { gleich } from './sitzung';

export function istDienst(req: Request): boolean {
  const schluessel = process.env.MAKE_OS_KEY;
  const kopf = req.headers.get('x-make-key');
  return !!schluessel && !!kopf && gleich(kopf, schluessel);
}

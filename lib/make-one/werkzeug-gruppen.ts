// ─── Werkzeug-Menü · Gruppen zuklappen (31.10.) ───────────────────────────────────────────────────────────────────────────────────────────
// Rückmeldung 30.10.: „die Punkte z. B. bei Markttraktion links immer zuklappbar, z. B. Vertrieb, Marketing — also die Oberthemen, dann kriegt man das
// noch übersichtlicher rein.“ Rein (Server UND Browser): welche Gruppen zu sind, merkt sich der Browser je Werkzeug (nur Bequemlichkeit, nie Daten).
// Regel: eine Gruppe, in der der aktive Punkt steht, ist immer offen — man verliert nie die Orientierung. Vorgabe: alles offen.
import type { PunktAnsicht } from './werkzeuge';

/** Schlüssel im Browser-Speicher je Werkzeug. */
export const gruppenSchluessel = (werkzeugId: string) => `make-wz-zu:${werkzeugId}`;

/** Steht der aktive Punkt (oder eines seiner Kinder) in dieser Gruppe? */
export function gruppeAktiv(punkte: readonly PunktAnsicht[], gruppe: string): boolean {
  return punkte.some(p => p.gruppe === gruppe && (p.an || p.unter.some(u => u.an)));
}

/** Ist die Gruppe gerade zugeklappt? Nie, solange sie den aktiven Punkt trägt. */
export function gruppeZu(zu: ReadonlySet<string>, punkte: readonly PunktAnsicht[], gruppe: string): boolean {
  return zu.has(gruppe) && !gruppeAktiv(punkte, gruppe);
}

/** Gespeicherten Stand lesen — kaputt oder fremd = alles offen. */
export function gruppenLesen(roh: string | null): Set<string> {
  if (!roh) return new Set();
  try {
    const w = JSON.parse(roh);
    return new Set(Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 60).slice(0, 30) : []);
  } catch { return new Set(); }
}

/** Eine Gruppe umschalten (neue Menge, die alte bleibt unberührt). */
export function gruppeUmschalten(zu: ReadonlySet<string>, gruppe: string): Set<string> {
  const neu = new Set(zu);
  if (neu.has(gruppe)) neu.delete(gruppe); else neu.add(gruppe);
  return neu;
}

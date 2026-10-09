// ─── MAKE OS — Start-Riegel (05.10., Paket „Zugang & Schlüssel härten“ Punkt 2) ──────────────────────────────
// Kevin 05.10.: „Die Software muss auf allen Standards der DSGVO sein, damit wir Kundendaten aufnehmen können.“ Eine
// Instanz ohne Datenschlüssel schriebe Klartext, ohne SESSION_SECRET signierte sie Sitzungen mit dem Dienstschlüssel,
// ohne Pepper wären Gelöschte per Mail-Liste wiedererkennbar. Der Riegel prüft das beim Start (instrumentation.ts) und
// lässt eine öffentliche Instanz ohne die Pflicht-Geheimnisse gar nicht erst laufen.
//
// Modus (riegelModus):
//   entwicklung  NODE_ENV ≠ production (next dev, Tests)                          → nur Warnungen
//   aus          MAKE_OS_START_RIEGEL=aus (ausdrücklich, z. B. Sandbox)           → nur Warnungen, HOI rot
//   lokal        production OHNE https-Adresse (Prüfbau am Mac, 3011)              → nur Warnungen
//   scharf       production MIT https-Adresse (Server, Demo-Container)            → fehlende Pflicht-Geheimnisse: kein Start
//   streng       MAKE_OS_START_RIEGEL=streng (Vorgabe neuer Instanzen)            → zusätzlich Länge ≥ 32 und Pepper Pflicht
// Pflicht in „scharf“: MAKE_OS_KEY, SESSION_SECRET, Datenschlüssel (Umgebung oder Datei) — vorhanden. Länge und Pepper
// sind dort nur Warnung (HOI gelb), weil die laufende Instanz (Stand 05.10.) den Pepper noch nicht gesetzt hat
// (UPDATES.md, Paket D-B „erst auf Kevins Wort“) — ein Abbruch würde sie beim Upload stilllegen. „streng“ schaltet Kevin,
// sobald alles gesetzt ist (UPDATES.md › „Zugang & Schlüssel härten“).
//
// Seit 09.10. (Agenten live durchgeklickt): ein gesetzter KI-Prüfendpunkt (MAKE_OS_KI_PRUEFENDPUNKT, lib/ki/pruefendpunkt.ts) ist in „scharf“
// und „streng“ ein harter Mangel — eine öffentliche Instanz startet damit nicht; sonst nur Warnung (die Umlenkung selbst prüft loopback + Demo).
//
// Rein und ohne Node-Module — die Middleware nutzt `riegelModus`/`MIN_LAENGE`; das Lesen der Dateien macht
// lib/zugang/start-riegel-lauf.ts (nur Node).

import { PRUEF_VARIABLE } from '../ki/pruefendpunkt';

export type RiegelModus = 'entwicklung' | 'aus' | 'lokal' | 'scharf' | 'streng';
export type RiegelWas = 'MAKE_OS_KEY' | 'SESSION_SECRET' | 'Datenschlüssel' | 'Pepper' | 'KI-Prüfendpunkt';
export interface Mangel { was: RiegelWas; art: 'fehlt' | 'zu-kurz' | 'gesetzt'; /** Bricht den Start in diesem Modus ab. */ hart: boolean }
export interface RiegelBild { modus: RiegelModus; maengel: Mangel[]; blockiert: boolean }

/** Mindestlänge jedes Geheimnisses (Zeichen) — `openssl rand -hex 32` ergibt 64. */
export const MIN_LAENGE = 32;

type Env = Record<string, string | undefined>;

export function riegelModus(env: Env = process.env): RiegelModus {
  if (env.NODE_ENV !== 'production') return 'entwicklung';
  const w = (env.MAKE_OS_START_RIEGEL ?? '').trim().toLowerCase();
  if (w === 'aus') return 'aus';
  if (w === 'streng') return 'streng';
  return (env.MAKE_OS_ADRESSE ?? '').trim().startsWith('https://') ? 'scharf' : 'lokal';
}

/** Riegel auswerten. `laengen` aus Dateien/Umgebung (0 = fehlt) — nie die Werte selbst. */
export function startPruefung(env: Env, laengen: { datenSchluessel: number; pepper: number }): RiegelBild {
  const modus = riegelModus(env);
  const streng = modus === 'streng';
  const pflicht = modus === 'scharf' || streng;
  const maengel: Mangel[] = [];
  const pruefe = (was: RiegelWas, laenge: number, vorhandenPflicht: boolean) => {
    if (laenge === 0) maengel.push({ was, art: 'fehlt', hart: streng || (pflicht && vorhandenPflicht) });
    else if (laenge < MIN_LAENGE) maengel.push({ was, art: 'zu-kurz', hart: streng });
  };
  pruefe('MAKE_OS_KEY', (env.MAKE_OS_KEY ?? '').trim().length, true);
  pruefe('SESSION_SECRET', (env.SESSION_SECRET ?? '').trim().length, true);
  pruefe('Datenschlüssel', laengen.datenSchluessel, true);
  pruefe('Pepper', laengen.pepper, false);
  // KI-Prüfendpunkt: auf einer öffentlichen Instanz nie (hart), sonst nur Warnung — wirksam ist er ohnehin nur loopback + Demo/Entwicklung.
  if ((env[PRUEF_VARIABLE] ?? '').trim()) maengel.push({ was: 'KI-Prüfendpunkt', art: 'gesetzt', hart: pflicht });
  return { modus, maengel, blockiert: pflicht && maengel.some(m => m.hart) };
}

/** Ein Satz je Mangel — für Log und HOI, ohne Werte. */
export function mangelSatz(m: Mangel): string {
  if (m.was === 'KI-Prüfendpunkt') return `${PRUEF_VARIABLE} ist gesetzt (nur für lokale Prüfungen mit dem nachgebauten Modell — auf dieser Instanz entfernen)`;
  const name = m.was === 'Datenschlüssel' ? 'Datenschlüssel (MAKE_OS_DATEN_SCHLUESSEL bzw. …_DATEI)' : m.was === 'Pepper' ? 'Pepper (MAKE_OS_PEPPER bzw. …_DATEI)' : m.was;
  return m.art === 'fehlt' ? `${name} fehlt` : `${name} ist kürzer als ${MIN_LAENGE} Zeichen`;
}

/** SESSION_SECRET für die Middleware (Edge): 503 statt Rückfall, wenn der Riegel es verlangt. */
export function sitzungsGeheimnisFehlt(env: Env = process.env): string | null {
  const modus = riegelModus(env);
  const n = (env.SESSION_SECRET ?? '').trim().length;
  // Wie bisher (26.09.): in Produktion ohne SESSION_SECRET nie — auch im Prüfbau nicht (sonst signierte der Dienstschlüssel).
  if (env.NODE_ENV === 'production' && n === 0) return 'SESSION_SECRET fehlt in .env';
  if (modus === 'streng' && n < MIN_LAENGE) return `SESSION_SECRET ist kürzer als ${MIN_LAENGE} Zeichen`;
  return null;
}

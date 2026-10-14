// ─── Kalender — AppleScript-Altweg: welche Apple-Kalender gelesen werden und wem sie gehören (rein, 14.10., Abnahme-Reste 2) ─────────
// Nur auf dem Mac ohne iCloud-Verbindung (app/api/apple-calendar, `AUF_DEM_MAC`): osascript liest einzelne Kalender nach NAMEN. Vorher
// standen die Namen fest im Code („Privat <Vorname>“ zweier Personen, ein voller Personenname). Jetzt aus den Kalender-Einstellungen (gespeicherter
// Name gewinnt, sonst „Privat <Vorname>“ aus den Konten — lib/kalender/einstellungen.ts) und dem vollen Namen der Person im ersten Fach (Apples
// Vorgabe-Kalender trägt den Namen des Kontos). Apples Standard-Kalender „Kalender“ ist kein Personenname und bleibt.
// Für eine Instanz mit den Konten des Altbestands ergibt das dieselben Kalender, dieselbe Zuordnung und dieselbe Reihenfolge wie vorher
// (Wächter tests/oberflaeche-neutral.test.ts). Jeder Name wird auch mit Leerzeichen am Ende gefragt — Apple-Kalender wurden teils so angelegt;
// beim Lesen wird der Name ohnehin gekürzt.

/** Apples Standard-Kalender — gemeinsam (kein Personenname). */
export const APPLE_STANDARD_KALENDER = 'Kalender';

export interface AltwegZuordnung { category: string; owner: string }
export interface AltwegKalender {
  /** Namen für die AppleScript-Liste (in dieser Reihenfolge, je mit und ohne Leerzeichen am Ende). */
  liste: string[];
  /** Name (ohne Leerzeichen am Ende) → Kategorie/Besitzer — Kennungen der Fächer wie im `calendar-cache`. */
  zuordnung: Record<string, AltwegZuordnung>;
}

const sauber = (n: string | null | undefined): string => String(n ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();

/**
 * Die Kalender des Altwegs. `kalender` = Zuordnung der Einstellungen (Fach → Name), `vollerName` = voller Name der Person im ersten Fach
 * (Konto) — fehlt er, wird kein Personen-Kalender nach Namen gelesen. Gleiche Namen zählen einmal (der erste gewinnt).
 */
export function altwegKalender(kalender: { kevin: string; malin: string }, vollerName?: string | null): AltwegKalender {
  const reihe: [string, AltwegZuordnung][] = [
    [sauber(kalender.kevin), { category: 'private-kevin', owner: 'kevin' }],
    [sauber(kalender.malin), { category: 'private-malin', owner: 'malin' }],
    [sauber(vollerName), { category: 'holding', owner: 'kevin' }],
    [APPLE_STANDARD_KALENDER, { category: 'joint', owner: 'both' }],
  ];
  const zuordnung: Record<string, AltwegZuordnung> = {};
  const liste: string[] = [];
  for (const [name, z] of reihe) {
    if (!name || Object.prototype.hasOwnProperty.call(zuordnung, name)) continue;
    zuordnung[name] = z;
    liste.push(name, `${name} `);
  }
  return { liste, zuordnung };
}

/** Ein Name als AppleScript-Text (Anführungszeichen und Rückstriche maskiert). */
export const appleText = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Das AppleScript für die Liste (Fenster: gestern bis +21 Tage, wie bisher). */
export function altwegSkript(liste: readonly string[]): string {
  return `
tell application "Calendar"
  set startDate to (current date) - (1 * days)
  set endDate to (current date) + (21 * days)
  set out to ""
  set calNames to {${liste.map(appleText).join(', ')}}
  repeat with calName in calNames
    try
      set cal to calendar calName
      set evts to (every event of cal whose start date >= startDate and start date <= endDate)
      repeat with ev in evts
        set evLoc to ""
        try
          set evLoc to location of ev
          if evLoc is missing value then set evLoc to ""
        end try
        set out to out & calName & "||" & (summary of ev) & "||" & ((start date of ev) as string) & "||" & ((end date of ev) as string) & "||" & (allday event of ev) & "||" & evLoc & linefeed
      end repeat
    end try
  end repeat
  return out
end tell
`;
}

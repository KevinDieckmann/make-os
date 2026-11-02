// ─── Morgenlauf: gescheiterte Schritte sichtbar machen (02.11., Prüfung C „vom Lead zum zahlenden Kunden“) ───────────────────────────
// Vorher wirkten gescheiterte Schritte wie Erfolg: der Lauf lief durch, `lastRun` stand da, und niemand sah das ✕ — der Morgenlauf ist ein
// Systemlauf, seine Antwort liest kein Mensch. Jetzt:
//   gescheiterteSchritte   rein: welche Schritte zählen (ein „nur im Haushalt des Inhabers“ eines fremden Aufrufers nicht — das ist Zugang, kein Fehler)
//   morgenlaufFehlerMelden EINE Glocke je Tag an jede Person im Haushalt des Inhabers, die den Head of IT sieht (`hoiSiehtPerson`, nie „nur Business“) (Art „prozess“ — eine neue Art bräche den Rückweg, die alte Glocke
//                          kennt sie nicht; Bezug `morgenlauf-<tag>`, eine neuere ersetzt). Titel neutral: nur die Zahl, keine Namen, keine Inhalte.
// Der Zähler steht zusätzlich im Bestand `tagesstart` (`fehler`, nur Tag + Zahl + Schrittnamen) — der Head of IT zeigt ihn (lib/hoi/lage.ts `taktRobustBefunde`).

export interface Schritt { name: string; ok: boolean; info?: string }
/** Info eines Schritts, der nur wegen des Aufrufers nicht lief (Zugang) — kein Fehler des Laufs. */
export const NUR_HAUSHALT_INFO = 'nur im Haushalt des Inhabers';

export function gescheiterteSchritte(schritte: readonly Schritt[]): string[] {
  return schritte.filter(s => !s.ok && s.info !== NUR_HAUSHALT_INFO).map(s => s.name);
}

/** Was im Bestand `tagesstart` festgehalten wird (nur Tag, Zahl, Schrittnamen — nie Inhalte). */
export interface MorgenlaufFehler { tag: string; anzahl: number; schritte: string[] }
export const morgenlaufFehler = (tag: string, schritte: readonly Schritt[]): MorgenlaufFehler | undefined => {
  const namen = gescheiterteSchritte(schritte);
  return namen.length ? { tag, anzahl: namen.length, schritte: namen.slice(0, 30).map(n => n.slice(0, 80)) } : undefined;
};

/** Neutraler Titel der Glocke (nur die Zahl). */
export const morgenlaufTitel = (n: number) => `Morgenlauf: ${n === 1 ? 'ein Schritt ist' : `${n} Schritte sind`} gescheitert — bitte im Head of IT nachsehen`;

/** EINE Glocke je Tag an den Haushalt des Inhabers. Wirft nie. */
export async function morgenlaufFehlerMelden(tag: string, f: MorgenlaufFehler | undefined): Promise<number> {
  if (!f) return 0;
  try {
    const [{ melde }, { WEG }, { haushaltsSpeicher }, { hoiSiehtPerson }] = await Promise.all([import('@/lib/meldungen/melden'), import('@/lib/wege'), import('@/lib/aufgaben/sicht'), import('@/lib/hoi/zugang')]);
    let n = 0;
    // R2-4 Fund 13: der Link führt in den Head of IT — nur an Personen, die ihn sehen (nie ein Konto „nur Business“, das bekäme 403).
    for (const an of await haushaltsSpeicher()) { if (!(await hoiSiehtPerson(an))) continue; await melde({ an, art: 'prozess', titel: morgenlaufTitel(f.anzahl), link: WEG.hoi(), bezug: { art: 'prozess', id: `morgenlauf-${tag}` } }); n++; }
    return n;
  } catch { return 0; }
}

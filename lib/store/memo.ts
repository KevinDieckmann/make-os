// ─── MAKE OS — Zwischenspeicher für teure Berechnungen (26.09., Tempo) ──────
// Die Indizes (Wachstums-Score, Business-, Privat-, Gesundheits-Index,
// Traktion) rechnen über viele Bestände — auf dem 1-CPU-Server bei jedem
// Seitenwechsel neu. Hier: einmal rechnen, kurz behalten. Jede Schreibung in
// einen Bestand (local-db) erhöht den Stand → alles Gemerkte ist ungültig.
// Schlüssel tragen Person/Haushalt, damit nie jemand fremde Werte sieht.

const stand = { v: 0 };
const ablage = new Map<string, { v: number; t: number; wert: unknown; laeuft?: Promise<unknown> }>();

/**
 * Bestände, die ständig geschrieben werden, aber in keinen Index eingehen (27.09., Stufe 1):
 * Anwesenheit (alle 30 s je Fenster), Nutzung, Änderungsprotokoll, Läufe, Warteschlange,
 * Verbrauch, Anmeldungen, Fehler, HOI-Zähler. Vorher machte jede dieser Schreibungen ALLES
 * Gemerkte ungültig — der Zwischenspeicher war praktisch nie warm.
 */
// 27.09. (Tempo-Prüfung): dazu Zeit & Fokus (`zeit`, schreibt alle zwei Minuten je Person), Tageslauf, CRM-Signale,
// die Kalender-Stände von iCloud, Verläufe (Traktion, Business, Performance) und die Flächen-Gestaltung — keiner dieser
// Bestände ist Eingang eines Index, aber jeder machte bis dahin ALLES Gemerkte ungültig; der Speicher war nie warm.
// 29.09.: dazu das Änderungsprotokoll (Monatsdateien), ZOE-Stapel/-Protokoll/-Entscheidungen, der Brain-Spiegel der App
// und der laufende Fokus je Person — viel geschrieben, Eingang höchstens mit TTL (wie agent-log/zoe-auftraege).
// 29.09. (Paket D-C): dazu die Idempotenz-Ablage (`anfragen-ergebnis`, jede wiederholbare Wirkung schreibt zweimal), das
// Absichtsprotokoll (`absichten--*`, je Schritt eines Mehr-Bestand-Vorgangs) und die Weiterleitungstabelle des
// Kennungs-Umzugs (`kennung-alias--*`) — keiner davon geht in einen Index ein.
const RAUSCHEN = /^(anfragen-ergebnis|absichten--.*|kennung-alias--.*|anwesenheit|nutzung|aenderungen|agent-log|zoe-auftraege|zoe-verlauf(--.*)?|verbrauch|anmeldungen|client-fehler|hoi-.*|ki-stand|delegation-runde|content-entwuerfe|ernaehrung-vorschlag|sitzungs-stand.*|zeit(--.*)?|tageslauf|crm-signale|kalender-icloud|calendar-cache|performance(--.*)?|.*-verlauf|flaeche(--.*)?|willkommen(--.*)?|brain-konsolidierung|meldungen--.*|aenderungsprotokoll--.*|zoe-stapel|zoe-protokoll|zoe-entscheidungen--.*|brain-app-spiegel|fokus-laufend--.*)$/;
export const istRauschen = (name?: string): boolean => !!name && RAUSCHEN.test(name);

/** local-db ruft das nach jedem Schreiben — dann rechnet der nächste Aufruf neu. Rauschen (siehe oben) lässt den Stand stehen. */
export function standErhoehen(name?: string): void {
  if (istRauschen(name)) return;
  stand.v++;
  if (ablage.size > 200) ablage.clear();
}

/** In Tests aus (die Prüfungen schreiben über Attrappen, die den Stand nicht erhöhen) — außer ein Test schaltet ihn an. */
export const memoAktiv = (): boolean => process.env.MAKE_OS_MEMO === 'an' || (process.env.NODE_ENV !== 'test' && process.env.MAKE_OS_MEMO !== 'aus');

/** Ergebnis von `rechne` höchstens `ttlMs` lang und nur bis zur nächsten Schreibung wiederverwenden. Gleichzeitige Aufrufe teilen sich EINE Berechnung. */
export async function merken<T>(schluessel: string, ttlMs: number, rechne: () => Promise<T>): Promise<T> {
  if (!memoAktiv()) return rechne();
  const e = ablage.get(schluessel);
  if (e && e.v === stand.v && Date.now() - e.t < ttlMs) {
    if (e.laeuft) return e.laeuft as Promise<T>;
    return e.wert as T;
  }
  const v = stand.v;
  // Gemerkt wird unter dem Stand vom START der Rechnung (Prüfbericht 28.09.): schreibt WÄHREND der Rechnung jemand einen
  // Bestand, kann das Ergebnis den alten Stand zeigen — es darf dann nicht unter dem neuen Stand als frisch gelten. Der
  // nächste Aufruf rechnet neu. (Die Verläufe, die die Indizes selbst schreiben, sind Rauschen und erhöhen den Stand nicht.)
  // Eine ältere Rechnung überschreibt nie das Ergebnis einer jüngeren.
  const laeuft: Promise<T> = rechne().then(wert => {
    const jetzt = ablage.get(schluessel);
    if (!jetzt || jetzt.laeuft === laeuft) ablage.set(schluessel, { v, t: Date.now(), wert });
    return wert;
  }, err => {
    if (ablage.get(schluessel)?.laeuft === laeuft) ablage.delete(schluessel);
    throw err;
  });
  ablage.set(schluessel, { v, t: Date.now(), wert: undefined, laeuft });
  return laeuft;
}

export function memoLeeren(): void { ablage.clear(); }

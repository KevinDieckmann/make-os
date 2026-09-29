// ─── Verbindungsprüfung: Buchung ↔ Seite ↔ Kontakt ↔ Termin (rein, 29.09., Paket K4) ─
// Kevin: „Die Kennungen zwischen Buchung, Kontakt und Termin werden in der Verbindungsprüfung geprüft.“
// Eingehängt in lib/crm/verbindungen.ts (Prüfungen) und lib/crm/verbindungen-laden.ts (Laden, nur Kennungen):
//   buchung-seite-tot     Buchung zeigt auf eine Buchungsseite, die es nicht mehr gibt
//   buchung-kontakt-tot   Buchung zeigt auf eine Person, die es nicht mehr gibt (z. B. nach Art. 17 in der Kartei,
//                         bevor die Buchung selbst geräumt wurde) — die Löschfrist räumt sie
//   buchung-termin-tot    bestätigte Buchung, deren Termin im iCloud-Stand fehlt (in Apple gelöscht/verschoben?)
// Nicht reparierbar per Knopf: Buchungen gehören dem Buchenden — die Oberfläche zeigt, wo nachsehen.
// Beispiele sind nur Buchungs-Kennungen (bu-…), nie Namen.

/** Was die Prüfung von einer Buchung braucht — nur Kennungen und Status. */
export interface BuchungKurz { id: string; seiteId: string; status: string; kontaktId?: string; terminUid?: string; start: string }
export interface BuchungenStand { buchungen: BuchungKurz[]; seiten: string[] }
/** Der iCloud-Teil der Prüfung (K1, lib/crm/verbindungen-kalender.ts `KalenderPruefBestand`): UIDs + Holfenster. */
export interface IcloudUids { fenster: { von: string; bis: string } | null; objekte: readonly { uid: string; schluessel?: string }[] }

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_BUCHUNG = {
  'buchung-seite-tot': { schwere: 'warnung', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'Buchung zeigt', 'Buchungen zeigen')} auf eine Buchungsseite, die es nicht mehr gibt — die Löschfrist räumt sie.` },
  'buchung-kontakt-tot': { schwere: 'warnung', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'Buchung zeigt', 'Buchungen zeigen')} auf eine Person, die es nicht mehr gibt — die Buchung bleibt bis zur Löschfrist, der Verweis ist tot.` },
  'buchung-termin-tot': { schwere: 'hinweis', bereich: 'kalender', reparierbar: false, art: 'kennung', text: (n: number) => `${n} ${e(n, 'bestätigte Buchung hat', 'bestätigte Buchungen haben')} keinen Termin mehr im Kalender — in Apple gelöscht? Im Kalender unter Buchungsseiten nachsehen.` },
} as const;
export type BuchungPruefungId = keyof typeof PRUEFUNGEN_BUCHUNG;

/**
 * Die Prüfung: meldet je Befund die Buchungs-Kennung. Den Termin prüft sie nur im Holfenster eines gelungenen
 * iCloud-Stands (dieselben UIDs wie K1 `termin-uid-tot`); ohne Stand (`icloud.fenster` null) nie.
 */
export function buchungenPruefen(s: BuchungenStand | null | undefined, kontakte: ReadonlySet<string>, icloud: IcloudUids | null | undefined, melde: (id: BuchungPruefungId, kennung: string) => void): void {
  if (!s) return;
  const seiten = new Set(s.seiten);
  const fenster = icloud?.fenster ?? null;
  // Seit R-K2 trägt eine Buchung den Schlüssel Kalender + UID, ältere die nackte UID — beide Formen zählen.
  const uids = fenster ? new Set(icloud!.objekte.flatMap(o => (o.schluessel ? [o.uid, o.schluessel] : [o.uid]))) : null;
  for (const b of s.buchungen) {
    if (!seiten.has(b.seiteId)) melde('buchung-seite-tot', b.id);
    if (b.kontaktId && !kontakte.has(b.kontaktId)) melde('buchung-kontakt-tot', b.id);
    const imFenster = !!fenster && b.start.slice(0, 10) >= fenster.von && b.start.slice(0, 10) < fenster.bis;
    if (b.status === 'bestaetigt' && b.terminUid && uids && imFenster && !uids.has(b.terminUid)) melde('buchung-termin-tot', b.id);
  }
}

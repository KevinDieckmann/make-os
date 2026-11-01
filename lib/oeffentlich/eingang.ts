// ─── Website-Eingänge — die Eingangszeile VOR der Antwort (rein, 02.11., Prüfung A „Eingänge und Datenbasis“) ─────────────────────────────
// Kevin: „Im Thema Kundengewinnung soll nichts dem Zufall überlassen werden.“ Unterlage anfordern und Newsletter-Anmeldung antworteten dem Gast
// sofort und arbeiteten danach NUR im Arbeitsspeicher (`nachDerAntwort`): ein Neustart, ein Absturz oder ein Fehler im CRM — und die Anforderung
// war weg, ohne dass es jemand merkte. Jetzt (Vorbild Bestellung): erst eine Eingangszeile fest speichern (Bestand `website-eingang`, je Instanz;
// Speicherfehler → 503, der Gast weiß es), dann die Arbeit nach der Antwort — Schritt für Schritt abgehakt (`schritte`), damit ein zweiter Versuch
// keine Mail doppelt schickt. Was offen bleibt, holen Takt und Morgenlauf nach (lib/oeffentlich/eingang-server.ts); nach `EINGANG_VERSUCHE`
// gescheiterten Versuchen steht die Zeile auf „fehler“ — eine neutrale Glocke, der Head of IT zählt sie.
// Datenschutz: `daten` (Adresse, Vorname, Firma) nur, solange die Zeile offen ist — beim Abschluss geleert; fertige fallen nach 7 Tagen weg,
// nie fertig gewordene nach 30 Tagen (Frist im Register). Art. 17: Zeilen, die die Person nennen, raus (lib/crm/person-weitere.ts).

export const EINGANG_SPEICHER = 'website-eingang';
export type EingangArt = 'unterlage' | 'newsletter';
export type EingangStatus = 'offen' | 'laeuft' | 'fertig' | 'fehler';

export interface EingangDaten {
  email: string;
  vorname: string;
  firma?: string;
  /** Unterlage: Kennung im Katalog und der Newsletter-Wunsch (Häkchen mit passender Fassung). */
  unterlageId?: string;
  newsletter?: boolean;
  /** Feste Kennungen der Anfrage im CRM — ein zweiter Versuch legt nichts doppelt an (lib/crm/anfrage-anlegen.ts `ids`). */
  ids?: { kontakt: string; followUp: string };
}

export interface WebsiteEingang {
  id: string;
  art: EingangArt;
  am: string;
  status: EingangStatus;
  /** Gescheiterte Versuche bisher. */
  versuche: number;
  /** Seit wann ein Versuch läuft (beansprucht) bzw. wann der letzte war. */
  seit?: string;
  /** Kurzer technischer Grund (ohne Adresse, ohne Inhalte). */
  grund?: string;
  /** Abgehakte Schritte (`mail`, `crm`, `newsletter`) mit ihrem Ergebnis — nur Wörter, nie Inhalte. */
  schritte?: Record<string, string>;
  fertigAm?: string;
  daten?: EingangDaten;
}
export interface EingangDatei { eintraege: WebsiteEingang[] }

/** Mehr Zeilen nimmt der Bestand nicht an (503, nie gekürzt). */
export const EINGANG_MAX = 5000;
/** Nach so vielen gescheiterten Versuchen: „fehler“ — nur noch die Glocke und der Head of IT. */
export const EINGANG_VERSUCHE = 3;
/** Ein laufender Versuch gilt nach so vielen Minuten als abgebrochen (Absturz, Neustart). */
export const EINGANG_LAEUFT_MIN = 10;
/** Erst nach so vielen Minuten holt der Takt eine offene Zeile nach (die Arbeit nach der Antwort hatte ihre Chance). */
export const EINGANG_WARTE_MIN = 2;
/** Fertige Zeilen bleiben so lange (Nachvollziehbarkeit, ohne Daten). */
export const EINGANG_FERTIG_TAGE = 7;
/** Nie fertig gewordene Zeilen (samt Daten) fallen nach so vielen Tagen weg. */
export const EINGANG_FRIST_TAGE = 30;

const MIN = 60_000, TAG = 86_400_000;

/** Ist die Zeile zum (Nach-)Holen dran? Offen nach der Wartezeit, abgebrochen (läuft zu lange), Fehlversuch nach dem Rückzug. Rein. */
export function eingangFaellig(e: WebsiteEingang, jetztMs: number, sofort = false): boolean {
  if (e.status === 'fertig') return false;
  if (e.status === 'laeuft') return !!e.seit && jetztMs - Date.parse(e.seit) >= EINGANG_LAEUFT_MIN * MIN;
  if (e.status === 'offen') return sofort || jetztMs - Date.parse(e.am) >= EINGANG_WARTE_MIN * MIN;
  // fehler: höchstens EINGANG_VERSUCHE, mit wachsendem Abstand (30 min je Versuch).
  return e.versuche < EINGANG_VERSUCHE && (!e.seit || jetztMs - Date.parse(e.seit) >= 30 * MIN * Math.max(1, e.versuche));
}

/** Fristen anwenden (rein): fertige nach 7 Tagen, alle übrigen nach 30 Tagen. */
export function eingangAufraeumen(l: readonly WebsiteEingang[], jetztMs: number): WebsiteEingang[] {
  return l.filter(e => (e.status === 'fertig' ? jetztMs - Date.parse(e.fertigAm ?? e.am) < EINGANG_FERTIG_TAGE * TAG : jetztMs - Date.parse(e.am) < EINGANG_FRIST_TAGE * TAG));
}

/** Zähler für den Head of IT (rein, nur Zahlen): offen (wartet), gescheitert (alle Versuche verbraucht). */
export function eingangZaehler(l: readonly WebsiteEingang[], jetztMs: number): { wartend: number; gescheitert: number } {
  let wartend = 0, gescheitert = 0;
  for (const e of l) {
    if (e.status === 'fertig') continue;
    if (e.status === 'fehler' && e.versuche >= EINGANG_VERSUCHE) gescheitert++;
    else if (jetztMs - Date.parse(e.am) >= EINGANG_LAEUFT_MIN * MIN) wartend++;
  }
  return { wartend, gescheitert };
}

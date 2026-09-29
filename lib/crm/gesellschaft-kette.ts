// ─── Stammdaten › Gesellschaften — Schreibkette im Browser (29.09., Sichtprüfung F5) ──
// Vorher schickte jedes Feld sofort mit dem Stand aus dem letzten Rendern: zwei schnelle Änderungen gingen mit
// demselben Stand hinaus, die zweite bekam 409 — und eine später eintreffende 200 der ersten löschte die Meldung wieder.
// Jetzt wie `components/os/crm/daten.ts`: nacheinander senden (`nacheinanderKette`), jeder Schreibvorgang liest den
// Stand erst beim Absenden aus der LETZTEN Server-Antwort; eine Meldung verschwindet erst, wenn die Person wieder
// schreibt (nie durch eine andere, gelungene Antwort). Was nicht gespeichert wurde, hält die Oberfläche als
// „nicht gespeichert“ fest (erneut speichern / verwerfen) — die Eingabe geht nie still verloren. Rein, getestet
// (tests/gesellschaften-kette.test.ts).

import { nacheinanderKette } from './kontakt-schreiben';

export interface GesellschaftAntwort<G> { ok?: boolean; gesellschaft?: G; aktuell?: G; fehler?: string; neuLaden?: boolean }

export interface KettenHaken<G> {
  /** Neuer Serverstand der Gesellschaft (Antwort oder Konflikt). */
  uebernehmen: (g: G) => void;
  /** Meldung setzen (Text) bzw. löschen (null) — gelöscht wird nur beim Start eines neuen Schreibvorgangs. */
  meldung: (t: string | null) => void;
  /** Wie viele Schreibvorgänge unterwegs sind (Anzeige „speichert …“). */
  offen?: (n: number) => void;
}

export const GESELLSCHAFT_KONFLIKT = 'Wurde inzwischen geändert — Stand neu geladen. Deine Eingabe ist unten als „nicht gespeichert“ markiert: prüfen und erneut speichern.';
export const KEINE_VERBINDUNG = 'Keine Verbindung — nichts gespeichert.';

export interface GesellschaftKette<G> {
  /** Der zuletzt bekannte Stand (aus der letzten Antwort bzw. dem letzten Laden). */
  stand: () => string;
  /** Stand vom Laden übernehmen — nur, wenn gerade nichts unterwegs ist (sonst gewinnt die Antwort in der Kette). */
  standSetzen: (s: string) => void;
  /** Einen Schreibvorgang einreihen; `senden` bekommt den Stand erst, wenn er dran ist. */
  schreibe: (senden: (stand: string) => Promise<GesellschaftAntwort<G>>, sonst?: string) => Promise<{ ok: boolean; fehler?: string }>;
}

export function gesellschaftKette<G extends { stand: string }>(startStand: string, h: KettenHaken<G>): GesellschaftKette<G> {
  const kette = nacheinanderKette();
  let stand = startStand;
  let offen = 0;
  return {
    stand: () => stand,
    standSetzen: s => { if (!offen && s) stand = s; },
    schreibe: (senden, sonst = 'Nicht gespeichert.') => {
      // Die Person schreibt wieder: die alte Meldung hat ihren Zweck erfüllt.
      h.meldung(null);
      offen++; h.offen?.(offen);
      return kette(async () => {
        try {
          let r: GesellschaftAntwort<G>;
          try { r = await senden(stand); } catch { r = { ok: false, fehler: KEINE_VERBINDUNG }; }
          if (r.ok && r.gesellschaft) { stand = r.gesellschaft.stand; h.uebernehmen(r.gesellschaft); return { ok: true }; }
          if (r.aktuell) { stand = r.aktuell.stand; h.uebernehmen(r.aktuell); h.meldung(GESELLSCHAFT_KONFLIKT); return { ok: false, fehler: GESELLSCHAFT_KONFLIKT }; }
          const t = r.fehler ?? sonst;
          h.meldung(t);
          return { ok: false, fehler: t };
        } finally { offen--; h.offen?.(offen); }
      });
    },
  };
}

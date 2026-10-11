// ─── Fulfillment · Kunde — Kunden-Link: Schalter, Ablauf, Status, Änderungen (rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4) ──────────
// Der Kunden-Link kommt AUSGESCHALTET. Zwei Schlüssel müssen an sein, sonst antwortet jeder öffentliche Weg mit derselben 404:
//   1. Umgebung `MAKE_OS_KUNDENLINK=an` (setzt der Betrieb erst nach der Prüfung in 12.4) — gelesen nur auf dem Server (lib/fulfillment/kunde/server.ts),
//   2. Schalter der Instanz `einstellungen.kundenLink.an` (Bestand `fulfillment--<h>`, umlegen nur der Inhaber per Sitzung).
// Je Mandat gibt es höchstens EINEN aktiven Link; ein neuer widerruft den alten. Ablauf: Vorgabe 90 Tage, verlängerbar, nie über Mandatsende + 30 Tage.
// Gespeichert wird nur der Hash des Tokens (lib/fulfillment/kunde/token.ts); hier wird nur gerechnet. Alles oder nichts, nie gekürzt.

import { tagePlus } from '@/lib/zeit';
import { KENNUNG, MANDAT_ID } from '../grenzen';
import type { AnwendenErgebnis, FulfillmentEinstellungen, KundeDatei, KundenLink } from '../typen';

/** Der eine Satz für jede Fehlerart der öffentlichen Wege (unbekannt, falsches Token, abgelaufen, Schalter aus, Recht aus). */
export const NICHT_GUELTIG = 'Dieser Link ist nicht (mehr) gültig.';
/** Vorgabe für die Gültigkeit eines neuen Links (Tage). */
export const LINK_TAGE = 90;
/** Ein Link gilt höchstens so viele Tage nach dem Mandatsende. */
export const NACH_ENDE_TAGE = 30;
/** Rechte eines neuen Links (Entscheidung 10.10., 23:25: Upload freigegeben — nur sichere Dateitypen, am Inhalt geprüft; je Link abschaltbar). */
export const RECHTE_VORGABE: KundenLink['rechte'] = { formular: true, upload: true, puls: true };
/** Fassung des Datenschutzhinweises (Art. 13) auf der Kunden-Seite — hochzählen, wenn sich der Text ändert. */
export const HINWEIS_VERSION = 1;

/**
 * Die Adresse aus der Antwort von `POST /api/fulfillment/kunde { aktion: 'link-anlegen' }` — EINE Form (zusammengeführt 11.10.): `url` (mit
 * `MAKE_OS_ADRESSE`), sonst `pfad` (`/kunde/kl-…#t=…`) an den Ursprung des Browsers gehängt. Nur `/kunde/kl-…`-Pfade bzw. http(s); sonst null.
 * Genutzt von der Willkommen-Karte (C1) — nie selbst aus Kennung und Token zusammensetzen.
 */
export function linkAdresseAus(j: { url?: unknown; pfad?: unknown } | null | undefined, ursprung: string): string | null {
  if (!j) return null;
  if (typeof j.url === 'string' && /^https?:\/\/[^\s]+\/kunde\/kl-[a-f0-9]{24}#t=[A-Za-z0-9_-]+$/.test(j.url)) return j.url;
  if (typeof j.pfad === 'string' && /^\/kunde\/kl-[a-f0-9]{24}#t=[A-Za-z0-9_-]+$/.test(j.pfad)) return `${ursprung.replace(/\/+$/, '')}${j.pfad}`;
  return null;
}

/** Stand der zwei Schlüssel. `grund` sagt, welcher fehlt (Betrieb zuerst). */
export interface SchalterStand { umgebung: boolean; instanz: boolean; an: boolean; grund?: 'betrieb' | 'instanz' }
export function schalterStand(einst: Pick<FulfillmentEinstellungen, 'kundenLink'>, umgebungAn: boolean): SchalterStand {
  const instanz = einst.kundenLink?.an === true;
  const an = umgebungAn && instanz;
  return { umgebung: umgebungAn, instanz, an, ...(an ? {} : { grund: umgebungAn ? 'instanz' as const : 'betrieb' as const }) };
}

/** Bis wann ein Link höchstens gilt: Mandatsende + 30 Tage (läuft das Mandat noch: unbegrenzt = null). */
export const linkGrenze = (mandatEnde: string | null): string | null => (mandatEnde ? tagePlus(mandatEnde, NACH_ENDE_TAGE) : null);

/** Ablauf eines neuen bzw. verlängerten Links: heute + Tage, gekappt am Mandatsende + 30 Tage. */
export function linkAblauf(heute: string, mandatEnde: string | null, tage = LINK_TAGE): string {
  const wunsch = tagePlus(heute, tage);
  const grenze = linkGrenze(mandatEnde);
  return grenze && grenze < wunsch ? grenze : wunsch;
}

/** Wirksamer Status eines Links heute (ein „aktiver“ Link nach seinem Ablauf bzw. nach Mandatsende + 30 Tagen ist „abgelaufen“). */
export function linkStatus(l: Pick<KundenLink, 'status' | 'ablaufAm'>, heute: string, mandatEnde: string | null = null): KundenLink['status'] {
  if (l.status !== 'aktiv') return l.status;
  const grenze = linkGrenze(mandatEnde);
  if (l.ablaufAm < heute || (grenze && grenze < heute)) return 'abgelaufen';
  return 'aktiv';
}

/** Der aktive Link eines Mandats (wirksam heute) — sonst null. */
export function aktiverLink(d: Pick<KundeDatei, 'links'>, mandatId: string, heute: string, mandatEnde: string | null = null): KundenLink | null {
  return d.links.filter(l => l.mandatId === mandatId && linkStatus(l, heute, mandatEnde) === 'aktiv').sort((a, b) => (a.erstelltAm < b.erstelltAm ? 1 : -1))[0] ?? null;
}

/** Der jüngste Link eines Mandats (egal welcher Status). */
export const letzterLink = (d: Pick<KundeDatei, 'links'>, mandatId: string): KundenLink | null =>
  d.links.filter(l => l.mandatId === mandatId).sort((a, b) => (a.erstelltAm < b.erstelltAm ? 1 : -1))[0] ?? null;

/** Was intern über einen Link gezeigt wird — nie der Hash. */
export interface LinkOeffentlich { id: string; status: KundenLink['status']; erstelltAm: string; erstelltVon: string; ablaufAm: string; rechte: KundenLink['rechte']; zuletztAm?: string; hinweisFassung: string }
export function linkOeffentlich(l: KundenLink, heute: string, mandatEnde: string | null = null): LinkOeffentlich {
  return { id: l.id, status: linkStatus(l, heute, mandatEnde), erstelltAm: l.erstelltAm, erstelltVon: l.erstelltVon, ablaufAm: l.ablaufAm, rechte: { ...l.rechte }, ...(l.zuletztAm ? { zuletztAm: l.zuletztAm } : {}), hinweisFassung: l.hinweisFassung };
}

export type LinkOp =
  | { op: 'anlegen'; mandatId: string; id: string; tokenHash: string; rechte?: Partial<KundenLink['rechte']>; hinweisFassung: string }
  | { op: 'widerrufen'; id: string }
  | { op: 'verlaengern'; id: string; tage?: number }
  | { op: 'rechte'; id: string; rechte: Partial<KundenLink['rechte']> }
  | { op: 'gesehen'; id: string };
export interface LinkKontext { heute: string; jetzt: string; person: string; mandatEnde: string | null }

const nein = (status: 400 | 404 | 409, fehler: string): AnwendenErgebnis<KundeDatei> => ({ ok: false, status, fehler });
const rechteAus = (r: Partial<KundenLink['rechte']> | undefined, basis: KundenLink['rechte']): KundenLink['rechte'] | null => {
  if (r === undefined) return { ...basis };
  if (!r || typeof r !== 'object') return null;
  const aus = { ...basis };
  for (const k of ['formular', 'upload', 'puls'] as const) {
    if (r[k] === undefined) continue;
    if (typeof r[k] !== 'boolean') return null;
    aus[k] = r[k] as boolean;
  }
  return aus;
};

/** Eine Änderung an den Links (rein, alles oder nichts). Ein neuer Link widerruft den bisher aktiven des Mandats. */
export function linkAnwenden(d: KundeDatei, op: LinkOp, k: LinkKontext): AnwendenErgebnis<KundeDatei> {
  if (op.op === 'anlegen') {
    if (!MANDAT_ID.test(op.mandatId)) return nein(400, 'Unzulässige Mandat-Kennung.');
    if (!KENNUNG.kundenLink.test(op.id) || !/^[a-f0-9]{64}$/.test(op.tokenHash)) return nein(400, 'Unzulässiger Link.');
    if (d.links.some(l => l.id === op.id)) return nein(409, 'Diese Kennung gibt es schon — bitte noch einmal.');
    const grenze = linkGrenze(k.mandatEnde);
    if (grenze && grenze < k.heute) return nein(409, 'Das Mandat ist seit mehr als 30 Tagen beendet — ein neuer Kunden-Link ist nicht mehr möglich.');
    const rechte = rechteAus(op.rechte, RECHTE_VORGABE);
    if (!rechte) return nein(400, 'Rechte: nur formular, upload, puls (an/aus).');
    const geaendert: string[] = [];
    const links = d.links.map(l => {
      if (l.mandatId !== op.mandatId || l.status !== 'aktiv') return l;
      geaendert.push(l.id);
      return { ...l, status: 'widerrufen' as const };
    });
    const neu: KundenLink = { id: op.id, mandatId: op.mandatId, tokenHash: op.tokenHash, erstelltAm: k.jetzt, erstelltVon: k.person, ablaufAm: linkAblauf(k.heute, k.mandatEnde), status: 'aktiv', rechte, hinweisFassung: op.hinweisFassung };
    return { ok: true, datei: { ...d, links: [...links, neu] }, geaendert: [...geaendert, op.id] };
  }
  const i = d.links.findIndex(l => l.id === op.id);
  if (i < 0) return nein(404, 'Diesen Kunden-Link gibt es nicht (mehr).');
  const l = d.links[i];
  const status = linkStatus(l, k.heute, k.mandatEnde);
  let neu: KundenLink;
  if (op.op === 'widerrufen') {
    if (l.status === 'widerrufen') return { ok: true, datei: d, geaendert: [] };
    neu = { ...l, status: 'widerrufen' };
  } else if (op.op === 'verlaengern') {
    if (status !== 'aktiv' && status !== 'abgelaufen') return nein(409, 'Ein widerrufener Link lässt sich nicht verlängern — bitte einen neuen anlegen.');
    const tage = op.tage ?? LINK_TAGE;
    if (!Number.isInteger(tage) || tage < 1 || tage > 180) return nein(400, 'Verlängern: 1 bis 180 Tage.');
    const ablauf = linkAblauf(k.heute, k.mandatEnde, tage);
    if (ablauf < k.heute) return nein(409, 'Das Mandat ist seit mehr als 30 Tagen beendet — der Link lässt sich nicht mehr verlängern.');
    neu = { ...l, status: 'aktiv', ablaufAm: ablauf };
  } else if (op.op === 'rechte') {
    if (status !== 'aktiv') return nein(409, 'Rechte ändern geht nur an einem aktiven Link.');
    const rechte = rechteAus(op.rechte, l.rechte);
    if (!rechte) return nein(400, 'Rechte: nur formular, upload, puls (an/aus).');
    neu = { ...l, rechte };
  } else {
    if (l.zuletztAm === k.heute) return { ok: true, datei: d, geaendert: [] };
    neu = { ...l, zuletztAm: k.heute };
  }
  const links = [...d.links];
  links[i] = neu;
  return { ok: true, datei: { ...d, links }, geaendert: [op.id] };
}

/** Morgenlauf: „aktive“ Links nach ihrem Ablauf als „abgelaufen“ markieren (Ende je Mandat). Liefert die Datei und die Zahl. */
export function abgelaufeneMarkieren(d: KundeDatei, heute: string, endeVon: (mandatId: string) => string | null): { datei: KundeDatei; n: number } {
  let n = 0;
  const links = d.links.map(l => {
    if (l.status !== 'aktiv' || linkStatus(l, heute, endeVon(l.mandatId)) !== 'abgelaufen') return l;
    n++;
    return { ...l, status: 'abgelaufen' as const };
  });
  return { datei: n ? { ...d, links } : d, n };
}

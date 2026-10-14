// ─── CRM — Veranstaltungsmarke (27.09., rein) ───────────────────────────────
// Kevin: „Unter den Events heißt unsere Marke Make.One — unter der Marke laufen
// die Events.“ Eine Stelle statt Streuung: Kopf des Events-Reiters, Formular,
// ICS-Export und Nachfass-Text lesen die Marke von hier. Eigenes Modul ohne
// Abhängigkeiten, damit events.ts und eventplanung.ts sie beide nutzen können,
// ohne sich gegenseitig zu laden.

import type { Event, Teilnahme } from './typen';

/**
 * Die Veranstaltungsmarke DIESER Instanz (14.10., Abnahme A1: stand fest im Code und erschien so in jeder fremden Instanz). Je Instanz über
 * `NEXT_PUBLIC_MAKE_OS_EVENT_MARKE` (wie `NEXT_PUBLIC_MAKE_OS_EINHEITEN`: beim Bauen eingesetzt, Dockerfile-Argument; ≤ MARKE_MAX Zeichen,
 * Ungültiges zählt nicht). Ohne Variable gilt die Vorgabe unserer Instanz — die Live-Instanz bleibt gleich. Angezeigt wird die Marke NUR über
 * diese Konstante bzw. `markeVon`/`eventName` (Wächter tests/oberflaeche-neutral.test.ts: kein fester Markenname in der Oberfläche).
 */
export const MARKE_EVENTS = markeAusUmgebung() ?? 'Make.One';
function markeAusUmgebung(): string | null {
  const roh = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAKE_OS_EVENT_MARKE : undefined;
  const m = typeof roh === 'string' ? roh.trim() : '';
  return m && m.length <= 40 && !/[<>]/.test(m) && ![...m].some(c => c < ' ') ? m : null;
}
/** Höchstlänge einer Marke im Bestand (Säuberung in lib/crm/speicher.ts). */
export const MARKE_MAX = 40;
/** Die Marke eines Events: gesetzt, sonst Make.One — abgeleitet, nie in den Bestand zurückgeschrieben. */
export const markeVon = (e: Pick<Event, 'marke'>): string => e.marke?.trim() || MARKE_EVENTS;
/**
 * Wie ein Event nach außen heißt: „Make.One · Stammtisch Maschinenbau“ — für Nachfass-Texte, Export, Herkunft und ZOE.
 * Läuft es in einer Reihe (03.10., z. B. Fokus Innovation), steht die Reihe vor dem Titel: „Make.One · Fokus Innovation · Dinner“;
 * nennt der Titel sie schon („Fokus Innovation Hamburg“), nicht doppelt: „Make.One · Fokus Innovation Hamburg“.
 * Ein besuchtes Event (Netzwerken, fremde Veranstaltung) trägt nicht unsere Marke — es heißt, wie es heißt (der Titel).
 */
export const eventName = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string => (istNetzwerkenEvent(e) ? e.titel : `${markeVon(e)} · ${titelMitReihe(e)}`);

/** DER Nachfass-Text zu einem Event (Follow-up-Ebene, Heute, Netzwerken, Teilnahme-Brücke): „Nachfassen nach „Make.One · …““. */
export const nachfassText = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string => `Nachfassen nach „${eventName(e)}“`;
/** DER Text der Aktivität nach dem Nachfassen: „Nachgefasst nach „…“ — Gespräch“. */
export const nachgefasstText = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>, ergebnis?: string | null): string => `Nachgefasst nach „${eventName(e)}“${ergebnis ? ` — ${ergebnis}` : ''}`;

// ── Reihen unter Make.One (03.10.) ───────────────────────────────────────────
// Kevin: „Fokus Innovation = Event-Reihe unter Make.One“ — das Leit-Format der Innovations-Abende (Berlin, Hamburg, Bielefeld,
// Köln, München). Make.One bleibt die Marke (`marke`), die Art des Abends bleibt `format` (Stammtisch, Dinner, Workshop …);
// die Reihe ist das dritte, optionale Merkmal (`Event.reihe`, Kennung aus dieser Werteliste). Ein Event ohne Reihe ist ein
// gewöhnlicher Make.One-Abend — der Altbestand liest ohne Migration. Besuchte Events (Netzwerken) haben nie eine Reihe.

//
// Seit 14.10. (Kevins Entscheidung) sind Reihen INSTANZ-DATEN — keine Reihe steht mehr im Code:
//   · gespeichert in den Wertelisten (`crm.wertelisten.reihen`, Stammdaten › Wertelisten — dort legt eine Instanz eigene an);
//   · Startwert ohne Server-Schritt: jede Kennung, die im Bestand an einem eigenen Event steht (Altbestand), und in der Betreiber-
//     Instanz deren Start-Kennungen (`BETREIBER_REIHEN`, lib/crm/reihen-server.ts) — der Name entsteht dann aus der Kennung
//     („fokus-innovation“ → „Fokus Innovation“, `nameAusKennung`); eine neue Instanz startet ohne Reihe.
//   · `EVENT_REIHEN` ist die Liste DIESER Instanz zur Laufzeit (dasselbe Array, an Ort und Stelle gesetzt über `reihenSetzen`: auf dem
//     Server beim Laden des CRM, im Browser aus der Antwort von GET /api/crm/bestand) — alle Leser bleiben synchron.

/** Eine Reihe: feste Kennung (gespeichert) und ihr Name (angezeigt). */
export interface EventReihe { id: string; name: string }
/** Die Reihen dieser Instanz (Laufzeit-Liste, anfangs leer — siehe oben). Kennungen nie ändern, sie stehen im Bestand. */
export const EVENT_REIHEN: EventReihe[] = [];
/** Höchstlänge einer Reihen-Kennung im Bestand. */
export const REIHE_MAX = 40;
/** Start-Kennungen der Betreiber-Instanz, sobald der Server sie kennt (lib/crm/reihen-server.ts) — der Laufzeit-Stand für `ladeCrm`. */
let startKennungen: string[] = [];
export const reihenStart = (): readonly string[] => startKennungen;
export const reihenStartSetzen = (l: readonly string[]): void => { startKennungen = [...l]; };
/** Die Liste der Instanz an Ort und Stelle ersetzen (dasselbe Array). Gleiche Liste: nichts. */
export function reihenSetzen(liste: readonly EventReihe[] | null | undefined): void {
  if (!liste) return;
  if (liste.length === EVENT_REIHEN.length && liste.every((r, i) => r.id === EVENT_REIHEN[i].id && r.name === EVENT_REIHEN[i].name)) return;
  EVENT_REIHEN.splice(0, EVENT_REIHEN.length, ...liste.map(r => ({ id: r.id, name: r.name })));
}
/** Name aus einer Kennung, wenn keine Liste ihn kennt: „fokus-innovation“ → „Fokus Innovation“. Rein. */
export const nameAusKennung = (id: string): string => id.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || id;
/** Kennung aus einem Namen (Umlaute ausgeschrieben, klein, Bindestriche, höchstens REIHE_MAX) — leer, wenn nichts übrig bleibt. Rein. */
export function kennungAusName(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, REIHE_MAX).replace(/-+$/g, '');
}
/**
 * Die Reihen einer Instanz (rein): gespeicherte (Wertelisten) zuerst, dann Start-Kennungen (Betreiber-Instanz), dann jede gültige Kennung
 * an einem eigenen Event, die noch fehlt — ohne Doppelte, Name aus der Liste bzw. aus der Kennung.
 */
export function reihenListe(q: { gespeichert?: readonly EventReihe[] | null; start?: readonly string[]; events?: readonly Pick<Event, 'reihe' | 'marke'>[] }): EventReihe[] {
  const aus: EventReihe[] = [];
  const da = new Set<string>();
  const dazu = (id: string | undefined, name?: string) => { if (!id || da.has(id)) return; da.add(id); aus.push({ id, name: name?.trim() || nameAusKennung(id) }); };
  for (const r of q.gespeichert ?? []) dazu(reiheKennung(r?.id), r?.name);
  for (const id of q.start ?? []) dazu(reiheKennung(id));
  for (const e of q.events ?? []) if (!istNetzwerkenEvent(e)) dazu(reiheKennung(e.reihe));
  return aus;
}
/** Pillen-Kennung für „Events ohne Reihe“ im Filter und in der Übersicht (keine gültige Reihen-Kennung, kollidiert also nie). */
export const OHNE_REIHE = '-';
/** Eine gültige Reihen-Kennung (klein, Ziffern, Bindestriche) — sonst undefined. Unbekannte, aber gültige Kennungen bleiben (Rückweg). */
export const reiheKennung = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length <= REIHE_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : undefined;
/** Der Name einer Reihe; eine unbekannte Kennung (z. B. aus einem neueren Stand) bekommt ihren Namen aus der Kennung. */
export const reiheName = (id: string): string => EVENT_REIHEN.find(r => r.id === id)?.name ?? nameAusKennung(id);
/** Die Reihe eines Events — nur bei eigenen Abenden (Make.One), nie bei besuchten Events. */
export function reiheVon(e: Pick<Event, 'reihe' | 'marke'>): EventReihe | undefined {
  if (istNetzwerkenEvent(e)) return undefined;
  const id = reiheKennung(e.reihe);
  return id ? { id, name: reiheName(id) } : undefined;
}
/** Titel mit Reihe davor („Fokus Innovation · Dinner“) — steht die Reihe schon im Titel, bleibt er, wie er ist. */
export function titelMitReihe(e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string {
  const r = reiheVon(e);
  return r && !e.titel.toLocaleLowerCase('de').includes(r.name.toLocaleLowerCase('de')) ? `${r.name} · ${e.titel}` : e.titel;
}

/**
 * Titel-Vorschlag für ein neues Event (Praxis-Fund 04.10.): mit Reihe und Vorlage „Fokus Innovation · Dinner“ (statt nur
 * „Dinner“), nur Reihe „Fokus Innovation“, nur Vorlage ihr Name, sonst „Neues Event“. Steht die Reihe im Titel, schreibt
 * `eventName` sie nicht doppelt.
 */
export function eventTitelVorschlag(reihe: string | undefined, vorlage: string | undefined): string {
  const r = reihe ? reiheName(reihe) : '';
  return [r, vorlage ?? ''].filter(Boolean).join(' · ') || 'Neues Event';
}

/**
 * Zählt diese Teilnahme als Anmeldung zu einem EIGENEN Event — die Marketing-Herkunft „event“ (lib/crm/scoring.ts
 * `marketingHerkunft`)? Zugesagt oder da, bei einem Make.One-Abend, nicht persönlich/telefonisch eingeladen (das ist
 * Direktansprache). EINE Regel für Scoring, Qualifizierung und die Kennzahlen je Reihe (lib/crm/reihen.ts).
 */
export function alsMarketingAnmeldung(t: Pick<Teilnahme, 'status' | 'einladungsweg'>, e: Pick<Event, 'marke'>): boolean {
  if (t.status !== 'zugesagt' && t.status !== 'da') return false;
  if (istNetzwerkenEvent(e)) return false;
  return t.einladungsweg !== 'persoenlich' && t.einladungsweg !== 'telefon';
}

/**
 * Kennzeichen eines Events, das über „Netzwerken“ unterwegs angelegt wurde (fremde Veranstaltung, nicht unsere Marke — 03.10.).
 * Solche Events zählen NICHT in Erscheinensquote, Folgegespräche je Event und Gästemischung (Kevin: getrennt ausweisen).
 */
export const NETZWERKEN_MARKE = 'Netzwerken';
export const istNetzwerkenEvent = (e: Pick<Event, 'marke'>): boolean => e.marke?.trim() === NETZWERKEN_MARKE;

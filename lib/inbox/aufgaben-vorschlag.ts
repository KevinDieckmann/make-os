// ─── Inbox — Aufgaben-Vorschläge aus Mails und WhatsApp (rein, client-sicher, 10.10.2026) ───────────────────────────
// ROADMAP_Q4.md › Phase 1 „Aufgaben: Vorschläge aus Mails/WhatsApp“ (Kevin & Malin). Ein REGELWERK ohne Modell erkennt in der jüngsten echten
// Nachricht von außen einen Handlungsauftrag und macht daraus einen VORSCHLAG im Freigabe-Stapel der Postfach-Person — angelegt wird die
// Aufgabe erst mit ihrem Klick (Stapel-Art „inbox“, lib/inbox/aufgaben-vorschlag-server.ts), über den vorhandenen Weg aus aus-gespraech.ts
// (`aufgabeAusGespraech`: Titel aus dem Betreff, Link zurück ins Gespräch, Bezug zu Kontakt/Firma/Deal).
//
// Erkannt wird, in dieser Rangfolge:
//   frist     eine Frist im Text („bis Freitag“, „bis 15.10.“) — über DIESELBE Regel wie die Inbox (`fristAus`)
//   dokument  ein Anhang „Rechnung/Vertrag/Angebot/Mahnung …“ bzw. eine Mahnung/Kündigung im Betreff
//   bitte     eine Bitte an uns („Könnten Sie … schicken“, „bitte … bestätigen“, „um Rückmeldung“)
//   frage     eine direkte Frage an uns („Haben Sie …?“, „Passt dir …?“) — ohne Smalltalk
// Zitierte ältere Nachrichten („Am … schrieb …“, „> …“) zählen nicht — sonst schlüge unsere eigene frühere Bitte an.
// Diese Datei sieht nur Betreff, Text und Anhang-Namen EINER Nachricht und gibt nur zurück, was sie gefunden hat. Kein Paket, kein Server.

import { fristAus } from './faecher';
import { aufgabeAusGespraech, betreffOhneRe, type AufgabeAusGespraech, type GespraechKurz } from './aus-gespraech';
import type { Gespraech } from './strom';

export type HandlungGrund = 'frist' | 'dokument' | 'bitte' | 'frage';

export interface Handlung {
  grund: HandlungGrund;
  /** Fälligkeit (nur `frist`). */
  datum?: string;
  /** Art des Dokuments (nur `dokument`): „Rechnung“, „Vertrag“ … */
  dokument?: string;
  /** Das gefundene Stück (kurz, ≤ 100 Zeichen) — nur für die Anzeige im Stapel, nie ins Protokoll. */
  stueck: string;
}

export const INBOX_VORSCHLAG_GRENZEN = {
  /** Höchstens so viele neue Vorschläge je Lauf (Takt oder Klick) — der Rest kommt beim nächsten Lauf. */
  jeLauf: 5,
  /** Höchstens so viele Nachrichten prüft ein Lauf (1 vCPU). */
  pruefenJeLauf: 40,
  /** Nur Nachrichten der letzten Tage — ältere gelten als gesehen. */
  tage: 14,
  /** So lange merkt sich der Bestand, welche Nachricht schon geprüft ist (Tage) — danach fällt der Merker weg (die Nachricht ist dann alt). */
  merkerTage: 60,
  /** Höchstens so viele Zeichen Text je Nachricht werden geprüft. */
  textMax: 4000,
  /** Abstand zwischen zwei automatischen Läufen je Person (Minuten). */
  taktMinuten: 15,
} as const;

/** Welche Gespräche überhaupt in Frage kommen (rein, getestet): nur Fächer mit Arbeit, nie Rundschreiben, Screener, Warten, Art. 18. */
export function vorschlagKandidat(g: Pick<Gespraech, 'fach' | 'inArbeit' | 'quelle' | 'zuordnung' | 'team'>, person: string): boolean {
  if (!g.inArbeit || (g.fach !== 'antworten' && g.fach !== 'termine' && g.fach !== 'geld')) return false;
  if (g.zuordnung?.sperre === 'eingeschraenkt') return false;
  // Team-Postfach und WhatsApp-Business-Nummer gehören mehreren: Vorschläge nur für die Person, die sich kümmert — nie für alle.
  if (g.team) return g.team.kuemmert?.person === person;
  return g.quelle === 'gmail' || g.quelle === 'imap';
}

/** Zitate älterer Nachrichten abschneiden (rein): ab „Am … schrieb …:“ / „On … wrote:“ / „-----Ursprüngliche Nachricht-----“, ohne „> …“. */
export function ohneZitat(text: string): string {
  const zeilen = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const raus: string[] = [];
  for (const z of zeilen) {
    const t = z.trim();
    if (/^(am|on)\b.{3,200}\b(schrieb|wrote)\b.{0,60}:?\s*$/i.test(t) || /^-{2,}\s*(ursprüngliche nachricht|original message|weitergeleitete nachricht|forwarded message)/i.test(t) || /^(von|from):\s.+@/i.test(t)) break;
    if (t.startsWith('>')) continue;
    raus.push(z);
  }
  return raus.join('\n').slice(0, INBOX_VORSCHLAG_GRENZEN.textMax);
}

/** Sätze (rein): an . ! ? und Zeilenenden getrennt, Fragezeichen bleibt am Satz. */
const saetze = (text: string): string[] => text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\s*\n\s*/).map(s => s.trim()).filter(s => s.length >= 8);

const VERB = /(send|schick|zusend|zuschick|übermittel|prüf|check|bestätig|unterschreib|unterzeichn|freigeb|zurückmeld|rückmeld|ausfüll|überweis|bezahl|abstimm|vorbereit|liefer|einreich|nachreich|anpass|korrigier|erstell|buch|reservier|weiterleit|beantwort|klär|anruf|zurückruf|hochlad|aktualisier|durchseh|anseh|mitteil|nenn|geben sie|gib mir)\w*/i;
const VERB_EN = /\b(send|confirm|review|sign|check|share|provide|let (me|us) know|update|approve|forward|call)\b/i;
const BITTE = /\b(bitte|bitten (wir|sie|dich)|ich bitte|wir bitten)\b/i;
const KOENNEN = /\b(könnten|können|würden|könntest|kannst|würdest|könnt)\s+(sie|du|ihr)\b/i;
const UM = /\bum\s+(eine\s+)?(kurze\s+)?(rückmeldung|bestätigung|freigabe|zusendung|antwort|rückruf|prüfung|unterschrift)\b/i;
const PLEASE = /\b(please|could you|can you|would you|kindly)\b/i;
/** Floskeln, die keine Bitte sind (Signaturen, Hinweise, Vertraulichkeit). */
const FLOSKEL = /bitte (beachten|nicht (auf diese|antworten)|denken sie an die umwelt|melden sie sich ab)|diese (e-?mail|nachricht) (ist|enthält) vertraulich|if you are not the intended|bei fragen (stehe|stehen) (ich|wir)|melden sie sich gern|melde dich gern|zögern sie nicht/i;
const SIE_FORM = /\b(Sie|Ihnen|Ihre?[mnrs]?)\b/;
const DU_FORM = /\b(du|dir|dich|dein(e[mnrs]?)?|euch|eure?[mnrs]?|you|your)\b/i;
const SMALLTALK = /wie geht('s| es)|alles (gut|klar|fit)|wie war (dein|ihr|euer)|schönes wochenende|gut angekommen|oder\?$/i;
const DOKUMENT: [RegExp, string][] = [
  [/rechnung|invoice|receipt|quittung/i, 'Rechnung'],
  [/mahnung|zahlungserinnerung/i, 'Mahnung'],
  [/vertrag|contract|vereinbarung|agreement/i, 'Vertrag'],
  [/angebot|offer|quote|kostenvoranschlag/i, 'Angebot'],
  [/kündigung/i, 'Kündigung'],
  [/bescheid|finanzamt/i, 'Bescheid'],
  [/auftragsbestätigung|bestellung/i, 'Auftragsbestätigung'],
  [/vollmacht|formular|antrag/i, 'Formular'],
];
const kurz = (t: string, n = 100) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };

/** Eine Nachricht, wie das Regelwerk sie sieht. */
export interface HandlungsNachricht { betreff: string; text: string; anhaenge?: readonly { name: string; eingebettet?: boolean }[] }

/** Der Handlungsauftrag einer Nachricht — oder null (rein, getestet). `heute` = Berliner Tag. */
export function handlungAus(n: HandlungsNachricht, heute: string): Handlung | null {
  const text = ohneZitat(n.text);
  const frist = fristAus(`${n.betreff}\n${text}`, heute);
  if (frist) return { grund: 'frist', datum: frist.datum, stueck: kurz(frist.text) };
  for (const a of (n.anhaenge ?? []).filter(x => !x.eingebettet)) {
    const d = DOKUMENT.find(([re]) => re.test(a.name));
    if (d) return { grund: 'dokument', dokument: d[1], stueck: kurz(a.name) };
  }
  const imBetreff = /\b(mahnung|zahlungserinnerung|kündigung)\b/i.exec(n.betreff);
  if (imBetreff) return { grund: 'dokument', dokument: imBetreff[1].toLowerCase().startsWith('k') ? 'Kündigung' : 'Mahnung', stueck: kurz(n.betreff) };
  const liste = saetze(text);
  for (const s of liste) {
    if (FLOSKEL.test(s)) continue;
    const de = (BITTE.test(s) || KOENNEN.test(s)) && VERB.test(s);
    const en = PLEASE.test(s) && VERB_EN.test(s);
    if (de || en || UM.test(s)) return { grund: 'bitte', stueck: kurz(s) };
  }
  for (const s of liste) {
    if (!s.endsWith('?') || FLOSKEL.test(s) || SMALLTALK.test(s) || s.length < 12) continue;
    if (SIE_FORM.test(s.slice(1)) || DU_FORM.test(s)) return { grund: 'frage', stueck: kurz(s) };
  }
  return null;
}

/** „TT.MM.“ aus „JJJJ-MM-TT“. */
export const tagKurz = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Der Titel des Stapel-Eintrags — OHNE Betreff, Namen oder Mailtext (er steht dauerhaft in den ZOE-Entscheidungen). Rein. */
export function stapelTitel(h: Handlung): string {
  const was = h.grund === 'frist' ? `Frist ${h.datum ? tagKurz(h.datum) : ''}`.trim() : h.grund === 'dokument' ? `${h.dokument ?? 'Dokument'} prüfen` : h.grund === 'bitte' ? 'eine Bitte an dich' : 'eine Frage an dich';
  return `Aufgabe aus der Inbox — ${was}`;
}

/** Warum (für den Stapel, nur dort — nie ins Protokoll). Rein. */
export function stapelAnlass(h: Handlung): string {
  switch (h.grund) {
    case 'frist': return `In der Nachricht steht eine Frist („${h.stueck}“).`;
    case 'dokument': return `Im Gespräch liegt „${h.stueck}“ — ${h.dokument ?? 'ein Dokument'} prüfen.`;
    case 'bitte': return `Eine Bitte an dich: „${h.stueck}“`;
    case 'frage': return `Eine Frage an dich: „${h.stueck}“`;
  }
}

/** Die Aufgabe aus Gespräch + Handlung — über DENSELBEN Weg wie „Aufgabe daraus machen“ (`aufgabeAusGespraech`). Rein, getestet. */
export function aufgabeAusHandlung(g: GespraechKurz, h: Handlung): AufgabeAusGespraech {
  const basis = aufgabeAusGespraech(g, h.datum);
  const betreff = betreffOhneRe(g.betreff) || basis.title;
  const titel = h.grund === 'dokument' ? `${h.dokument ?? 'Dokument'} prüfen: ${betreff}` : h.grund === 'bitte' ? `Erledigen: ${betreff}` : h.grund === 'frage' ? `Beantworten: ${betreff}` : betreff;
  return { ...basis, title: titel.length > 300 ? `${titel.slice(0, 299)}…` : titel };
}

/** Die Eingabe der Aufgabe im Stapel prüfen (sie kommt aus dem Bestand) — null, wenn unbrauchbar. Rein. */
export function aufgabeEingabe(roh: unknown): AufgabeAusGespraech | null {
  const e = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const title = typeof e.title === 'string' ? e.title.trim() : '';
  const description = typeof e.description === 'string' ? e.description : '';
  if (!title || title.length > 300 || description.length > 4000) return null;
  const space = e.space === 'privat' || e.space === 'business' ? e.space : null;
  if (!space) return null;
  const b = e.bezug && typeof e.bezug === 'object' ? e.bezug as Record<string, unknown> : null;
  const id = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(v) ? v : undefined);
  const bezug = b ? { ...(id(b.kontaktId) ? { kontaktId: id(b.kontaktId) } : {}), ...(id(b.firmaId) ? { firmaId: id(b.firmaId) } : {}), ...(id(b.dealId) ? { dealId: id(b.dealId) } : {}) } : null;
  return {
    title, description, priority: 'medium', space,
    ...(typeof e.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.dueDate) ? { dueDate: e.dueDate } : {}),
    ...(bezug && Object.keys(bezug).length ? { bezug } : {}),
  };
}

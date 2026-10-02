// ─── Heute & Glocke: was ansteht — reine Regeln (K6a, 29.09.) ─────────────────
// Kalender-Verbindungskarte, Verbindungen 8/9 (KALENDER_VERBINDUNGEN.md): Glocke und Heute kannten nur Aufgaben und
// Geburtstage. Jetzt sehen beide dasselbe, abgeleitet aus den vorhandenen Quellen — NICHTS wird kopiert oder gespeichert:
//   termine       kommende Termine heute (iCloud-Stand, maskiert, `betrifft` wie die Verfügbarkeit; abgesagte/abgelehnte
//                 nicht — R-K1 #68; Arbeitsort nicht)
//   nachbereiten  Termine der letzten Tage ohne festgehaltenes Ergebnis — Regel `nachbereitung` (lib/crm/erfassen.ts),
//                 Meeting-Zeit aus dem Termin
//   fristen       Stichtage aus lib/kalender/eintraege.ts `fristen` (Kündigungsfrist über `mandatFristen`, EINE Rechnung):
//                 heute/morgen, Kündigungsfristen mit Vorlauf (Kalender-Einstellungen `kuendigungVorlaufTage`)
//   followups     fällige Follow-ups aus `faellige` (lib/crm/followup.ts — EINE Quelle für alle Nachfass-Stellen, auch die
//                 Wiedervorlage geparkter Deals); ohne Kadenz (die steht in der Power Hour) und ohne Follow-ups mit
//                 verknüpfter Aufgabe (die Aufgabe führt und meldet sich selbst — „Follow-up = Aufgabe“)
//   buchungen     offene Buchungsanfragen der eigenen Buchungsseiten (die Glocke hat dafür schon die gespeicherte
//                 Meldung „Terminanfrage“ — hier nur für Heute)
//   vorschlaege   Kalender-Vorschläge im ZOE-Stapel (Zahl, Link in den Stapel)
//   geburtstage   Geburtstage ab heute (14 Tage, Familie mit längerem Vorlauf ab dessen Beginn) — auf Heute NUR hier (die
//                 Anlässe-Zeile zeigt dort nur Feiertage, F2 M2). Geschenk: Familie → der „Wichtige Tag“ (Vorlauf, Aktion,
//                 erledigt je Jahr, lib/familie/logik.ts) ist die Quelle; CRM → Aufgabe mit `bezug.kontaktId` + `anlass`
//                 (Kennung Kontakt+Jahr, `geschenkStand`), erst der Klick legt an
// Die Glocke leitet daraus Meldungen ab (lib/meldungen/regeln.ts `anstehendAbleiten`); Heute zeigt die Liste
// (components/os/heute/Anstehend.tsx über GET /api/heute/anstehend).

import type { TerminMitBezug } from '@/lib/kalender/bezug';
import type { Frist } from '@/lib/kalender/eintraege';
import type { Faellig } from '@/lib/crm/followup';
import type { Nachbereitung } from '@/lib/crm/erfassen';
import { geburtstagFuer, type Geburtstag, type AnlassAktion } from '@/lib/kalender/geburtstag';
import type { TerminZeit } from '@/lib/crm/aktivitaeten';
import { WEG } from '@/lib/wege';
import { tagPlus } from '@/lib/kalender/zeit';

export interface ATermin { id: string; titel: string; start: string; ende: string; ganztags: boolean; ort?: string; art: string; href: string; laeuft: boolean }
export interface AFrist { id: string; art: Frist['art']; tag: string; titel: string; unter?: string; href: string; inTagen: number; kuendigung?: true }
export interface AFollowup { id: string; text: string; name: string; faellig: string; uhrzeit?: string; tageUeber: number; quelle: string; href: string }
export interface ANachbereiten { kontaktId: string; name: string; titel: string; tag: string; zeit?: string; href: string }
export interface ABuchung { id: string; titel: string; start: string; href: string }
export interface AGeburtstag {
  id: string; name: string; tag: string; alter?: number; href: string; herkunft: Geburtstag['herkunft']; kontaktId?: string; menschId?: string;
  /** Vorschlag: Geschenk-Aufgabe (CRM) bzw. „Geschenk vormerken“ (Familie) mit dieser Deadline (10 Tage vorher, frühestens heute). */
  aufgabeTag: string;
  /** Familie: der Wichtige Tag dazu — `ab` = Geburtstag − Vorlauf, `erledigt` für dieses Jahr (F2 M2). */
  anlass?: { tagId: string; aktion: AnlassAktion; ab: string; erledigt: boolean };
}

/** Danke-Mails, die zu einem Event bereitliegen (Netzwerken, 02.10.) — nur die Zahl und das Ziel. */
export interface ADanke { id: string; n: number; eventTitel: string; href: string }

export interface Anstehend {
  heute: string;
  termine: ATermin[];
  nachbereiten: ANachbereiten[];
  fristen: AFrist[];
  followups: AFollowup[];
  buchungen: ABuchung[];
  vorschlaege: { kalender: number; gesamt: number };
  geburtstage: AGeburtstag[];
  /** Danke-Mails nach einem Event (Netzwerken, 02.10.) — fehlt in älteren Ständen. */
  danke?: ADanke[];
  /**
   * Zeiten der Termine hinter Meetings der letzten Tage (nur Schlüssel, auf die ein Meeting zeigt) — damit die Power Hour
   * „Wie lief's?“ aus der Kartei auf der Seite rechnen kann (lib/crm/erfassen.ts `nachbereitung` mit `termine`).
   */
  nachbereitZeiten: Record<string, TerminZeit>;
}

/** So viele Tage vor dem Geburtstag steht die Geschenk-Aufgabe (Zusatzthema #12). */
export const GEBURTSTAG_VORLAUF = 10;
/** So weit schaut Heute nach Geburtstagen voraus (für den Vorschlag). */
export const GEBURTSTAG_FENSTER = 14;

const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);

/** Wessen Termin? — `wer` des Kalenders; gemeinsam zählt für beide (Abwesend/Arbeitsort nur für `von`). Wie K1 `betrifft`. */
function betrifftPerson(t: { wer?: string; von?: string; art?: string }, person: string): boolean {
  if (t.wer === person) return true;
  if (t.wer !== 'beide') return false;
  if (t.art === 'abwesend' || t.art === 'arbeitsort') return !t.von || t.von === person;
  return true;
}

/** Kommende (und laufende) Termine heute der Person. `jetztWand` = Berliner Wandzeit. */
export function termineHeute(termine: readonly (TerminMitBezug & { wer?: string })[], person: string, heute: string, jetztWand: string): ATermin[] {
  const morgen = `${tagPlus(heute, 1)}T00:00:00`, tagesbeginn = `${heute}T00:00:00`;
  return termine
    // Maskierte Termine (privat der anderen Person, „Belegt“) nicht — sie hätten nur einen toten Link (F2 N1).
    .filter(t => !t.abgesagt && !t.maskiert && t.art !== 'arbeitsort' && betrifftPerson(t, person))
    .filter(t => t.start < morgen && (t.ganztags ? t.ende > tagesbeginn : t.ende > jetztWand))
    .map(t => ({
      id: t.id, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags, ...(t.ort ? { ort: t.ort } : {}), art: t.art,
      href: WEG.termin(t.id, heute), laeuft: !t.ganztags && t.start <= jetztWand,
    }))
    .sort((a, b) => Number(b.ganztags) - Number(a.ganztags) || a.start.localeCompare(b.start));
}

/**
 * Fristen, die jetzt zählen: heute und morgen; Kündigungsfristen schon `vorlauf` Tage vorher. Nur die eigenen (`fuer`
 * = Person oder „beide“) bzw. die ohne Zuständigkeit (Haushalt). Erledigte Meilensteine nicht.
 */
export function fristenAnstehend(fristen: readonly Frist[], person: string, heute: string, vorlauf: number): AFrist[] {
  const morgen = tagPlus(heute, 1), grenze = tagPlus(heute, Math.max(1, vorlauf));
  return fristen
    // Mandats-Reviews meldet die Follow-up-Ebene (`v:review`, eine Quelle — F2 M1), nicht zusätzlich als Frist.
    .filter(f => !f.erledigt && !f.review && (!f.fuer || f.fuer === person || f.fuer === 'beide'))
    .filter(f => f.tag >= heute && (f.tag <= morgen || (f.kuendigung && f.tag <= grenze)))
    .map(f => ({ id: f.id, art: f.art, tag: f.tag, titel: f.titel, ...(f.unter ? { unter: f.unter } : {}), href: f.href, inTagen: tageZwischen(heute, f.tag), ...(f.kuendigung ? { kuendigung: true as const } : {}) }));
}

/**
 * Fällige Follow-ups der Person (heute/überfällig) — ohne Kadenz und ohne die mit verknüpfter Aufgabe. Hängt eines am
 * Termin (`terminUid`, F2 M4), nennt die Anzeige dessen Titel aus dem Termin (`zeiten`) — gespeichert wird er nie.
 */
export function followupsAnstehend(liste: readonly Faellig[], person: string, mitAufgabe: ReadonlySet<string>, zeiten?: Readonly<Record<string, TerminZeit>>): AFollowup[] {
  return liste
    .filter(f => (f.gruppe === 'ueberfaellig' || f.gruppe === 'heute') && f.quelle !== 'kadenz' && !mitAufgabe.has(f.id))
    .filter(f => f.zustaendig === person || f.zustaendig === 'beide')
    .map(f => ({
      id: f.id, text: followupAnzeige(f, zeiten), name: f.name, faellig: f.faellig, ...(f.uhrzeit ? { uhrzeit: f.uhrzeit } : {}), tageUeber: f.tageUeber, quelle: String(f.quelle),
      href: f.bezug.art === 'chance' ? WEG.deal(f.bezug.id) : f.kontaktId ? WEG.akte(f.kontaktId) : WEG.followup(),
    }));
}

/** Text eines Follow-ups zur Anzeige: am Termin (`terminUid`) mit dessen Titel, sofern er im Stand lesbar ist. */
export function followupAnzeige(f: { text: string; terminUid?: string }, zeiten?: Readonly<Record<string, TerminZeit>>): string {
  const titel = f.terminUid ? zeiten?.[f.terminUid]?.titel?.trim() : undefined;
  return titel && !f.text.includes(titel) ? `${f.text} — „${titel}“` : f.text;
}

/** Nachbereitungen als Einträge (Link in die Kontaktakte). */
export function nachbereitenAnstehend(liste: readonly Nachbereitung[]): ANachbereiten[] {
  return liste.map(n => ({ kontaktId: n.kontaktId, name: n.name, titel: n.titel, tag: n.tag, ...(/T\d{2}:\d{2}/.test(n.am) && !/Z$/.test(n.am) ? { zeit: n.am.slice(11, 16) } : {}), href: WEG.akte(n.kontaktId) }));
}

/**
 * Geburtstage ab heute bis 14 Tage (Familie mit Wichtigem Tag: schon ab Beginn seines Vorlaufs, höchstens 60 Tage) mit dem
 * Geschenk-Vorlauf. Sichtregel wie die Glocke (`geburtstagFuer`, CRM nur bei der Person, die die Beziehung hält).
 */
export function geburtstageVorlauf(liste: readonly Geburtstag[], person: string, heute: string): AGeburtstag[] {
  const bis = tagPlus(heute, GEBURTSTAG_FENSTER);
  return liste
    .filter(g => g.tag >= heute && geburtstagFuer(g, person))
    .filter(g => g.tag <= bis || (!!g.anlass && tagPlus(g.tag, -g.anlass.vorlaufTage) <= heute))
    .map(g => {
      const vorher = tagPlus(g.tag, -GEBURTSTAG_VORLAUF);
      return {
        id: g.id, name: g.name, tag: g.tag, ...(g.alter !== undefined ? { alter: g.alter } : {}), href: g.href, herkunft: g.herkunft,
        ...(g.kontaktId ? { kontaktId: g.kontaktId } : {}), ...(g.menschId ? { menschId: g.menschId } : {}),
        aufgabeTag: vorher < heute ? heute : vorher,
        ...(g.anlass ? { anlass: { tagId: g.anlass.tagId, aktion: g.anlass.aktion, ab: tagPlus(g.tag, -g.anlass.vorlaufTage), erledigt: g.anlass.erledigt } } : {}),
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Titel der Geschenk-Aufgabe — nur der Name, kein Datum, kein Alter (Datensparsamkeit; das Datum kommt aus dem Kontakt). */
export const geschenkAufgabeTitel = (name: string) => `Geschenk für ${name}`;

/** Das Stichwort der Aktion eines Wichtigen Tages (Familie). */
export const ANLASS_WORT: Record<AnlassAktion, string> = { geschenk: 'Geschenk', karte: 'Karte', anruf: 'Anruf', feier: 'Feier' };

/**
 * Gibt es zur Geschenk-Aufgabe dieses CRM-Geburtstags schon eine Aufgabe? Verknüpft per Kennung (Kontakt + Jahr:
 * `bezug.kontaktId` + `anlass`), nie per Titel. Papierkorb, Archiv („Neu anfangen“) und abgebrochene zählen nicht.
 * 'erledigt' = fertig, 'offen' = vorgemerkt, null = keine.
 */
export function geschenkStand(
  tasks: readonly { status: string; bezug?: { kontaktId?: string }; anlass?: { art: string; jahr: number }; geloeschtAm?: string; archiviertAm?: string }[],
  g: Pick<AGeburtstag, 'kontaktId' | 'tag'>,
): 'offen' | 'erledigt' | null {
  if (!g.kontaktId) return null;
  const jahr = Number(g.tag.slice(0, 4));
  const passend = tasks.filter(t => t.anlass?.art === 'geschenk' && t.anlass.jahr === jahr && t.bezug?.kontaktId === g.kontaktId && !t.geloeschtAm && !t.archiviertAm && t.status !== 'cancelled');
  return passend.some(t => t.status !== 'done') ? 'offen' : passend.length ? 'erledigt' : null;
}

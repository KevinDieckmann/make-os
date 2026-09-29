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
//   geburtstage   Geburtstage in den nächsten 14 Tagen mit Vorschlag „Geschenk-Aufgabe 10 Tage vorher“ (Zusatzthema #12,
//                 erst der Klick legt die Aufgabe an)
// Die Glocke leitet daraus Meldungen ab (lib/meldungen/regeln.ts `anstehendAbleiten`); Heute zeigt die Liste
// (components/os/heute/Anstehend.tsx über GET /api/heute/anstehend).

import type { TerminMitBezug } from '@/lib/kalender/bezug';
import type { Frist } from '@/lib/kalender/eintraege';
import type { Faellig } from '@/lib/crm/followup';
import type { Nachbereitung } from '@/lib/crm/erfassen';
import type { Geburtstag } from '@/lib/kalender/geburtstag';
import type { TerminZeit } from '@/lib/crm/aktivitaeten';
import { WEG } from '@/lib/wege';
import { tagPlus } from '@/lib/kalender/zeit';

export interface ATermin { id: string; titel: string; start: string; ende: string; ganztags: boolean; ort?: string; art: string; href: string; laeuft: boolean }
export interface AFrist { id: string; art: Frist['art']; tag: string; titel: string; unter?: string; href: string; inTagen: number; kuendigung?: true }
export interface AFollowup { id: string; text: string; name: string; faellig: string; uhrzeit?: string; tageUeber: number; quelle: string; href: string }
export interface ANachbereiten { kontaktId: string; name: string; titel: string; tag: string; zeit?: string; href: string }
export interface ABuchung { id: string; titel: string; start: string; href: string }
export interface AGeburtstag { id: string; name: string; tag: string; alter?: number; href: string; herkunft: Geburtstag['herkunft']; kontaktId?: string; /** Vorschlag: Geschenk-Aufgabe mit dieser Deadline (10 Tage vorher, frühestens heute). */ aufgabeTag: string }

export interface Anstehend {
  heute: string;
  termine: ATermin[];
  nachbereiten: ANachbereiten[];
  fristen: AFrist[];
  followups: AFollowup[];
  buchungen: ABuchung[];
  vorschlaege: { kalender: number; gesamt: number };
  geburtstage: AGeburtstag[];
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
    .filter(t => !t.abgesagt && t.art !== 'arbeitsort' && betrifftPerson(t, person))
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
    .filter(f => !f.erledigt && (!f.fuer || f.fuer === person || f.fuer === 'beide'))
    .filter(f => f.tag >= heute && (f.tag <= morgen || (f.kuendigung && f.tag <= grenze)))
    .map(f => ({ id: f.id, art: f.art, tag: f.tag, titel: f.titel, ...(f.unter ? { unter: f.unter } : {}), href: f.href, inTagen: tageZwischen(heute, f.tag), ...(f.kuendigung ? { kuendigung: true as const } : {}) }));
}

/** Fällige Follow-ups der Person (heute/überfällig) — ohne Kadenz und ohne die mit verknüpfter Aufgabe. */
export function followupsAnstehend(liste: readonly Faellig[], person: string, mitAufgabe: ReadonlySet<string>): AFollowup[] {
  return liste
    .filter(f => (f.gruppe === 'ueberfaellig' || f.gruppe === 'heute') && f.quelle !== 'kadenz' && !mitAufgabe.has(f.id))
    .filter(f => f.zustaendig === person || f.zustaendig === 'beide')
    .map(f => ({
      id: f.id, text: f.text, name: f.name, faellig: f.faellig, ...(f.uhrzeit ? { uhrzeit: f.uhrzeit } : {}), tageUeber: f.tageUeber, quelle: String(f.quelle),
      href: f.bezug.art === 'chance' ? WEG.deal(f.bezug.id) : f.kontaktId ? WEG.akte(f.kontaktId) : WEG.followup(),
    }));
}

/** Nachbereitungen als Einträge (Link in die Kontaktakte). */
export function nachbereitenAnstehend(liste: readonly Nachbereitung[]): ANachbereiten[] {
  return liste.map(n => ({ kontaktId: n.kontaktId, name: n.name, titel: n.titel, tag: n.tag, ...(/T\d{2}:\d{2}/.test(n.am) && !/Z$/.test(n.am) ? { zeit: n.am.slice(11, 16) } : {}), href: WEG.akte(n.kontaktId) }));
}

/**
 * Geburtstage der nächsten 14 Tage mit dem Vorschlag „Geschenk-Aufgabe“ (Deadline 10 Tage vorher, frühestens heute).
 * CRM-Geburtstage nur bei der Person, die die Beziehung hält (wie die Glocke, `zustaendig`).
 */
export function geburtstageVorlauf(liste: readonly Geburtstag[], person: string, heute: string): AGeburtstag[] {
  const bis = tagPlus(heute, GEBURTSTAG_FENSTER);
  return liste
    .filter(g => g.tag > heute && g.tag <= bis && (!g.zustaendig || g.zustaendig === person || g.zustaendig === 'beide'))
    .map(g => {
      const vorher = tagPlus(g.tag, -GEBURTSTAG_VORLAUF);
      return { id: g.id, name: g.name, tag: g.tag, ...(g.alter !== undefined ? { alter: g.alter } : {}), href: g.href, herkunft: g.herkunft, ...(g.kontaktId ? { kontaktId: g.kontaktId } : {}), aufgabeTag: vorher < heute ? heute : vorher };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Titel der Geschenk-Aufgabe (Vorschlag) — ohne Geburtsjahr, ohne Alter (Datensparsamkeit). */
export const geschenkAufgabeTitel = (name: string, tag: string) => `Geschenk für ${name} (Geburtstag ${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}.)`;

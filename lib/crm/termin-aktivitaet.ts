// ─── CRM — Der Termin wird zur Aktivität „Meeting“ (rein, getestet, 30.09., Paket K3) ─
// Kevin 29.09.: „CRM und Aufgaben am Termin: Kontakt/Firma/Mandat verknüpfen → Aktivität im CRM“ — und aus der
// Verbindungskarte (Befund 7): ein Meeting darf nicht doppelt zählen. Deshalb EINE Quelle:
//
//   Termin (iCloud)        Wahrheit für Zeit, Ort, Titel. Der Bezug zum Kontakt steht NUR in `kalender-bezug`
//                          (`kontaktId` + `gastKontakte`, lib/kalender/bezug.ts).
//   Aktivität „Meeting“    genau EINE je Kontakt und Termin bzw. Vorkommen (`terminUid` = `uid` oder `uid::RID`),
//                          idempotent. Sie trägt KEIN `wann` — die Akte liest die Zeit über `terminUid` aus dem Termin
//                          (`terminZeitFuer` in lib/crm/aktivitaeten.ts). Verschiebt sich der Termin, zeigt die
//                          Aktivität die neue Zeit.
//   Kontaktpflege          Liegt der Termin schon hinter uns, zählt er beim Anlegen als Kontakt (letzter Kontakt = sein
//                          Tag, Stufe/Wiedervorlage nach Regel). Ein geplantes Meeting zählt erst, wenn es vorbei ist —
//                          das zieht der Signal-Lauf nach (`terminKontaktNachziehen`, app/api/crm/signale).
//   Kalender-Signal        (lib/crm/signale.ts) legt KEINE zweite Aktivität an, wenn es schon eine mit diesem
//                          `terminUid` gibt (oder die Buchungs-Aktivität mit `bezug = bezugTermin(uid)`).
//
// Art. 18: an eingeschränkten Personen wird nichts festgehalten. Werbesperre: ein 1:1-Termin ist keine Werbung — die
// Aktivität entsteht. Private Termine: nur „Meeting (privat)“, nie der Titel.

import { wendeAktivitaetAn, type Kontakt, type Aktivitaet } from '@/lib/make-one/crm';
import { aktivitaetMarke, markenMit } from './aktivitaet-marke';
import { bezugTermin, terminMs } from './signale';
import { schluesselPasst, schluesselGehoertZu, altSchluessel } from '@/lib/kalender/bezug';

export interface TerminFuerCrm {
  /**
   * Schlüssel des Termins bzw. Vorkommens (`kalender|uid` bzw. `kalender|uid::RECURRENCE-ID`, R-K1 #46; ältere Aktivitäten
   * tragen noch `uid` bzw. `uid::RID` — beide Formen treffen) — wird `terminUid`.
   */
  id: string;
  uid: string;
  titel: string;
  /** Berliner Wandzeit YYYY-MM-DDTHH:mm:ss (ganztags 00:00). */
  start: string;
  privat?: boolean;
  /** Verknüpfter Kontakt + Gäste aus dem CRM. */
  kontaktIds: readonly string[];
  /** Deal am Termin — wird `bezug` der Aktivität (Deal-Ampel). */
  dealId?: string;
  /** Wer verknüpft hat (Speichername). */
  von: string;
}

/** Text der Aktivität — der Titel bleibt als Rückfall, falls der Termin einmal nicht mehr lesbar ist. */
export const meetingTextAusTermin = (t: Pick<TerminFuerCrm, 'titel' | 'privat'>): string => (t.privat ? 'Meeting (privat)' : `Meeting: ${t.titel.replace(/\s+/g, ' ').trim().slice(0, 200)}`);

/** Hat der Kontakt schon eine Aktivität zu diesem Termin/Vorkommen? (auch die Buchungs-Aktivität von K4) */
export function hatTerminAktivitaet(k: Pick<Kontakt, 'aktivitaeten'>, t: Pick<TerminFuerCrm, 'id' | 'uid'>): boolean {
  const einzel = altSchluessel(t.id) === t.uid;
  return (k.aktivitaeten ?? []).some(a => schluesselPasst(a.terminUid, t.id) || (einzel && a.bezug === bezugTermin(t.uid)));
}

/** Ist der Termin schon vorbei (Berliner Wandzeit gegen jetzt, nie über new Date(wandzeit))? */
export const terminVorbei = (start: string, jetztIso: string): boolean => terminMs(start) <= Date.parse(jetztIso);

/**
 * Eine Aktivität „Meeting“ an einen Kontakt (rein): die Regeln von `wendeAktivitaetAn` (letzter Kontakt, Stufe,
 * Wiedervorlage — ein geplantes Meeting zählt noch nicht), danach OHNE `wann`, MIT `terminUid`.
 */
export function terminAktivitaetAnwenden(k: Kontakt, t: TerminFuerCrm, e: { text?: string; heute: string; jetztIso: string; tagePlus: (d: string, n: number) => string }): Kontakt {
  const neu = wendeAktivitaetAn(k, { art: 'termin', text: e.text ?? meetingTextAusTermin(t), von: t.von, wann: t.start.slice(0, 16), ...(t.dealId ? { bezug: t.dealId } : {}) }, e.heute, e.jetztIso, e.tagePlus);
  const l = [...(neu.aktivitaeten ?? [])];
  const { wann: _w, ...ohneWann } = l[l.length - 1];
  l[l.length - 1] = { ...ohneWann, terminUid: t.id };
  return { ...neu, aktivitaeten: l };
}

/**
 * Meeting-Aktivitäten für einen Termin (rein, idempotent): je Kontakt aus `kontaktIds` höchstens eine. Eingeschränkte
 * (Art. 18) und unbekannte Personen werden übersprungen.
 */
export function terminAktivitaeten(kontakte: readonly Kontakt[], t: TerminFuerCrm, heute: string, jetztIso: string, tagePlus: (d: string, n: number) => string): { kontakte: Kontakt[]; neu: string[]; eingeschraenkt: string[] } {
  const ids = new Set(t.kontaktIds);
  const neu: string[] = [], eingeschraenkt: string[] = [];
  const raus = kontakte.map(k => {
    if (!ids.has(k.id)) return k;
    if (k.eingeschraenkt) { eingeschraenkt.push(k.id); return k; }
    if (hatTerminAktivitaet(k, t)) return k;
    neu.push(k.id);
    return terminAktivitaetAnwenden(k, t, { heute, jetztIso, tagePlus });
  });
  return { kontakte: neu.length ? raus : [...kontakte], neu, eingeschraenkt };
}

/**
 * Geplante Meetings, die inzwischen vorbei sind, zählen als Kontakt (rein): letzter Kontakt = Tag des Termins — nur
 * vorwärts, nie in die Zukunft. `termine` = Zeiten je `terminUid` aus dem Kalender.
 */
export function terminKontaktNachziehen(kontakte: readonly Kontakt[], termine: ReadonlyMap<string, { start: string }>, heute: string, jetztIso: string): { kontakte: Kontakt[]; geaendert: number } {
  let geaendert = 0;
  const raus = kontakte.map(k => {
    let letzter = k.letzterKontakt;
    for (const a of k.aktivitaeten ?? []) {
      const t = a.terminUid ? termine.get(a.terminUid) ?? termine.get(altSchluessel(a.terminUid)) : undefined;
      if (!t || !terminVorbei(t.start, jetztIso)) continue;
      const tag = t.start.slice(0, 10) > heute ? heute : t.start.slice(0, 10);
      if (!letzter || tag > letzter) letzter = tag;
    }
    if (letzter === k.letzterKontakt) return k;
    geaendert++;
    return { ...k, letzterKontakt: letzter };
  });
  return { kontakte: geaendert ? raus : [...kontakte], geaendert };
}

/**
 * Ein Termin fand nicht statt (in MAKE OS gelöscht oder der Kontakt wieder gelöst, solange er noch in der Zukunft lag):
 * die Meeting-Aktivitäten dazu fallen weg — mit Löschmarke, damit ein älterer Stand sie nicht zurückholt (rein).
 * `id` = Schlüssel des Termins; bei einer ganzen Serie (`uid`) auch alle Vorkommen `uid::…`. `nur` = nur diese Kontakte.
 */
export function terminAktivitaetenEntfernen(kontakte: readonly Kontakt[], id: string, nur?: ReadonlySet<string>): { kontakte: Kontakt[]; weg: number } {
  let weg = 0;
  const trifft = (a: Aktivitaet) => schluesselGehoertZu(a.terminUid, id);
  const raus = kontakte.map(k => {
    if (nur && !nur.has(k.id)) return k;
    const treffer = (k.aktivitaeten ?? []).filter(trifft);
    if (!treffer.length) return k;
    weg += treffer.length;
    return { ...k, aktivitaeten: (k.aktivitaeten ?? []).filter(a => !trifft(a)), geloeschteAktivitaeten: markenMit(k.geloeschteAktivitaeten, treffer.map(aktivitaetMarke)) };
  });
  return { kontakte: weg ? raus : [...kontakte], weg };
}

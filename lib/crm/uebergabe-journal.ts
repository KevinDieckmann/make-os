// ─── Übergabe-Journal (Server, 03.10., Paket „netz-recht“) ───────────────────
// Jede Übergabe von Kontakten an einen Kunden (Event › „An Kunden übergeben“) steht im Protokoll am Event (`Event.uebergaben`). Wird das
// Event GELÖSCHT (oder ist das Protokoll voll), geht der Nachweis nicht mit: die Einträge wandern in dieses Journal und bleiben ~3 Jahre
// (`UEBERGABE_JOURNAL_MONATE`, Löschfristen-Lauf, FristArt `uebergabe-protokolle`). Wozu: Auskunft (Art. 15 — an wen wurde die Person
// übergeben?) und Mitteilung bei Löschung/Berichtigung (Art. 19) müssen auch nach dem Löschen des Events möglich sein; ein Verantwortlicher
// muss Übermittlungen nachweisen können (Art. 5 Abs. 2).
//
// Inhalt je Eintrag: Event (Titel, Tag), Empfänger (Firma + Name zum Zeitpunkt), Tag, wer, Anzahl, Dateiname, Kennungen der Personen,
// Haken „Rolle/Vertrag geklärt“ — nie Namen, Mails oder Gesprächsinhalt. Art. 17: die Kennungen der Person werden getilgt (Register:
// `uebergabe-journal--*`, „tilgen“). Idempotent: derselbe Eintrag (Event + Tag + wer) liegt nur einmal darin.

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import type { Event, EventUebergabe, Firma } from './typen';
import { monateZurueck } from './loeschfristen';
import { uebergabenSaeubern } from './besuche-form';
import type { UebergabeVermerk } from './netzwerken-recht';

export const UEBERGABE_JOURNAL_PRAEFIX = 'uebergabe-journal--';
export const journalName = (haushalt: string): string => `uebergabe-journal--${haushalt}`;
/** Wie lange ein Eintrag bleibt (Monate ab dem Tag der Übergabe). */
export const UEBERGABE_JOURNAL_MONATE = 36;
const DATEI = /^uebergabe-journal--([a-z0-9-]+)\.json$/;

export interface JournalUebergabe extends EventUebergabe {
  eventId: string;
  eventTitel: string;
  eventDatum: string;
  /** Name des Empfängers zum Zeitpunkt der Übergabe (die Firma kann später umbenannt oder gelöscht sein). */
  empfaengerName?: string;
  verschobenAm: string;
  grund: 'event-geloescht' | 'protokoll-voll';
}
export interface JournalDatei { eintraege: JournalUebergabe[] }

const schluessel = (e: Pick<JournalUebergabe, 'eventId' | 'am' | 'von'>) => `${e.eventId}|${e.am}|${e.von}`;

/** Die Protokoll-Einträge eines Events ins Journal übernehmen (idempotent) — VOR dem Löschen bzw. Kürzen des Protokolls aufrufen. */
export async function uebergabenInsJournal(haushalt: string, event: Pick<Event, 'id' | 'titel' | 'datum'>, eintraege: readonly EventUebergabe[], firmen: readonly Pick<Firma, 'id' | 'name'>[], grund: JournalUebergabe['grund'], jetztIso: string): Promise<number> {
  if (!eintraege.length) return 0;
  let neu = 0;
  await updateJson<JournalDatei>(journalName(haushalt), cur => {
    const liste = [...(cur?.eintraege ?? [])];
    const da = new Set(liste.map(schluessel));
    for (const u of eintraege) {
      const j: JournalUebergabe = { ...u, eventId: event.id, eventTitel: event.titel, eventDatum: event.datum, ...(u.empfaengerFirmaId && firmen.find(f => f.id === u.empfaengerFirmaId) ? { empfaengerName: firmen.find(f => f.id === u.empfaengerFirmaId)!.name } : {}), verschobenAm: jetztIso, grund };
      if (da.has(schluessel(j))) continue;
      da.add(schluessel(j));
      liste.push(j);
      neu++;
    }
    return neu ? { eintraege: liste } : (cur ?? { eintraege: liste });
  });
  return neu;
}

const alsJournal = (v: unknown): JournalUebergabe[] => {
  const l = (v && typeof v === 'object' && Array.isArray((v as JournalDatei).eintraege) ? (v as JournalDatei).eintraege : []) as unknown as Record<string, unknown>[];
  return l.flatMap(x => {
    const u = uebergabenSaeubern([x], 1)?.[0];
    if (!u || typeof x.eventId !== 'string' || typeof x.eventTitel !== 'string') return [];
    return [{ ...u, eventId: String(x.eventId), eventTitel: String(x.eventTitel).slice(0, 200), eventDatum: String(x.eventDatum ?? '').slice(0, 10), ...(typeof x.empfaengerName === 'string' ? { empfaengerName: x.empfaengerName.slice(0, 200) } : {}), verschobenAm: String(x.verschobenAm ?? '').slice(0, 30), grund: x.grund === 'protokoll-voll' ? 'protokoll-voll' as const : 'event-geloescht' as const }];
  });
};

async function journalHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => DATEI.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}

/** Alle Übergaben (aller Haushalte), in denen diese Person stand — für Art. 15 und den Art.-17-Bericht (Art. 19). */
export async function journalUebergabenVon(kontaktId: string): Promise<UebergabeVermerk[]> {
  const raus: UebergabeVermerk[] = [];
  for (const h of await journalHaushalte()) {
    for (const j of alsJournal(await loadJson<JournalDatei>(journalName(h)))) {
      if (!j.kontaktIds?.includes(kontaktId)) continue;
      raus.push({ eventId: j.eventId, eventTitel: j.eventTitel, am: j.am.slice(0, 10), von: j.von, ...(j.empfaengerFirmaId ? { empfaengerFirmaId: j.empfaengerFirmaId } : {}), empfaenger: j.empfaengerName ?? 'einem Kunden', ...(j.dateiname ? { dateiname: j.dateiname } : {}) });
    }
  }
  return raus;
}

/** Einträge älter als die Frist (Tag der Übergabe) entfernen — Löschfristen-Lauf. Liefert die Zahl der entfernten. */
export async function journalAufraeumen(heute: string, monate = UEBERGABE_JOURNAL_MONATE): Promise<number> {
  const grenze = monateZurueck(heute, monate);
  let n = 0;
  for (const h of await journalHaushalte()) {
    await updateJson<JournalDatei>(journalName(h), cur => {
      const l = cur?.eintraege ?? [];
      const rest = l.filter(x => String(x.am ?? '').slice(0, 10) >= grenze);
      n += l.length - rest.length;
      return rest.length === l.length ? (cur ?? { eintraege: l }) : { eintraege: rest };
    });
  }
  return n;
}

// ─── Meldungen (Glocke) — Speicher je Person (28.09. abends, Paket B2) ────────
// Bestand `meldungen--<person>` über local-db (verschlüsselt wie jeder Bestand, eine Sperre je
// Schreibvorgang). Die Regeln (Entdoppeln, Grenze ohne Verlust ungelesener, fällig/überfällig)
// stehen rein in ./regeln.ts. Fällig/überfällig werden beim Lesen aus dem Aufgaben-Bestand
// `tasks` abgeleitet (nur lesen) — es gibt keinen Dauerlauf, der Meldungen schreibt.
//
// Telegram (Kevin/Malin 28.09.: „mitdenken, kommt später“): Einstellung `einstellungen.telegram`
// je Person, standardmäßig aus. Der einzige Ort, an dem später versendet wird, ist
// `telegramHaken` unten — heute versendet er NICHTS.

import { randomBytes } from 'crypto';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { wandzeit, ausWandzeit, tagVon } from '@/lib/kalender/zeit';
import { WEG } from '@/lib/wege';
import type { MeldungEingabe } from './melden';
import {
  MELDUNGEN_MAX, PERSON_OK, bestandSaeubern, eintragAus, einfuegen, faelligAbleiten, gelesenSetzen, pruefeEingabe, sichtBauen,
  type GelesenAuswahl, type Meldung, type MeldungenBestand, type MeldungenSicht,
} from './regeln';

/** Speichername je Person — für alle Konten gleich gebaut (auch „kevin“), nie im Code mit Daten. */
export function meldungenSpeicher(person: string): string {
  if (!PERSON_OK.test(person)) throw new Error('[meldungen] Person ungültig');
  return `meldungen--${person}`;
}

/** Heutiger Tag in Europe/Berlin — unabhängig von der Zeitzone der Maschine (auf dem Server gleich `localDay`, TZ=Europe/Berlin). */
export function heuteBerlin(jetzt: Date = new Date()): string {
  return tagVon(wandzeit(jetzt));
}
/** Berliner Tag eines ISO-Zeitstempels. */
const tagVonIso = (iso: string) => tagVon(wandzeit(new Date(iso)));

/**
 * Haken für den Telegram-Kanal. HEUTE: tut nichts, versendet nichts.
 * SPÄTER (eigenes Paket, mit Kevins Wort): hier `sendeAnPerson(person, text)` aus
 * `@/lib/telegram` aufrufen — nur wenn `einstellungen.telegram` an ist, nie im Seitenpfad
 * blockierend, Titel ohne vertrauliche Werte (steht schon so in der Schnittstelle).
 */
export async function telegramHaken(_person: string, _meldung: Meldung): Promise<void> {
  // TELEGRAM-HAKEN (vorgesehen, aus): await sendeAnPerson(_person, `${_meldung.titel}`) — kommt später.
}

/** Eine Meldung ablegen. Wirft nie nach außen weiter als bis `melde()`; Grund bei Ablehnung. */
export async function meldungAblegen(m: MeldungEingabe, jetzt: Date = new Date()): Promise<{ ok: boolean; grund?: string }> {
  const p = pruefeEingabe(m);
  if (!p.ok) return p;
  // Nur an Personen im Haushalt des Inhabers — nie ein Bestand für ein fremdes Konto.
  if (!(await personImHaushaltDesInhabers(m.an))) return { ok: false, grund: 'Empfänger nicht im Haushalt des Inhabers' };
  const neu = eintragAus(m, `m-${jetzt.getTime().toString(36)}-${randomBytes(4).toString('hex')}`, jetzt.toISOString());
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(m.an), cur => einfuegen(bestandSaeubern(cur), neu, MELDUNGEN_MAX));
  if (next.einstellungen.telegram) await telegramHaken(m.an, neu).catch(() => {});
  return { ok: true };
}

/** Stand für das ETag: eigener Bestand + Aufgaben (Tag und Person nimmt die Route dazu). */
export function meldungenStand(person: string): Promise<string> {
  return speicherStand([meldungenSpeicher(person), 'tasks']);
}

async function aufgabenLesen(): Promise<unknown[]> {
  const s = await loadJson<{ tasks?: unknown }>('tasks');
  return Array.isArray(s?.tasks) ? s.tasks : [];
}

function abgeleitet(bestand: MeldungenBestand, aufgaben: unknown[], person: string, heute: string): Meldung[] {
  return faelligAbleiten(aufgaben, {
    person, heute, am: ausWandzeit(`${heute}T00:00:00`).toISOString(),
    link: WEG.aufgabe, tagVonIso, gelesen: bestand.faelligGelesen,
  });
}

/** Die Glocke einer Person: eigene Meldungen + fällig/überfällig von heute. */
export async function meldungenSicht(person: string, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const [roh, aufgaben] = await Promise.all([loadJson<unknown>(meldungenSpeicher(person)), aufgabenLesen()]);
  const bestand = bestandSaeubern(roh);
  return sichtBauen(bestand, abgeleitet(bestand, aufgaben, person, heute), heute);
}

/** „Gelesen“ setzen — nur im eigenen Bestand der Person. */
export async function meldungenGelesen(person: string, auswahl: GelesenAuswahl, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const aufgaben = await aufgabenLesen();
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => {
    const b = bestandSaeubern(cur);
    const ids = abgeleitet(b, aufgaben, person, heute).map(m => m.id);
    return gelesenSetzen(b, auswahl, heute, ids);
  });
  return sichtBauen(next, abgeleitet(next, aufgaben, person, heute), heute);
}

/** Kanal-Einstellung der Person (Telegram vorgesehen, versendet noch nichts). */
export async function meldungenEinstellen(person: string, e: { telegram: boolean }, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const aufgaben = await aufgabenLesen();
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => ({ ...bestandSaeubern(cur), einstellungen: { telegram: e.telegram === true } }));
  return sichtBauen(next, abgeleitet(next, aufgaben, person, heute), heute);
}

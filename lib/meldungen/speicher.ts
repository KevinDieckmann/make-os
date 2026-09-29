// ─── Meldungen (Glocke) — Speicher je Person (28.09. abends, Paket B2) ────────
// Bestand `meldungen--<person>` über local-db (verschlüsselt wie jeder Bestand, eine Sperre je
// Schreibvorgang). Die Regeln (Entdoppeln, Grenze ohne Verlust ungelesener, fällig/überfällig)
// stehen rein in ./regeln.ts. Fällig/überfällig werden beim Lesen aus dem Aufgaben-Bestand
// `tasks` abgeleitet (nur lesen) — es gibt keinen Dauerlauf, der Meldungen schreibt.
//
// Telegram (Kevin/Malin 28.09.: „mitdenken, kommt später“): Einstellung `einstellungen.telegram`
// je Person, standardmäßig aus. Der einzige Ort, an dem später versendet wird, ist
// `telegramHaken` unten — heute versendet er NICHTS.

import { merken } from '@/lib/store/memo';
import { randomBytes } from 'crypto';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { wandzeit, ausWandzeit, tagVon } from '@/lib/kalender/zeit';
import { WEG } from '@/lib/wege';
import type { MeldungEingabe } from './melden';
import {
  MELDUNGEN_MAX, PERSON_OK, bestandSaeubern, buchungenErledigen, eintragAus, einfuegen, faelligAbleiten, geburtstagAbleiten, anstehendAbleiten, gelesenSetzen, pruefeEingabe, sichtBauen,
  type BuchungenLage, type GelesenAuswahl, type Meldung, type MeldungenBestand, type MeldungenSicht, type AnstehendFuerGlocke,
} from './regeln';
import { lebendAus, verweisLebt } from '@/lib/kalender/bezug';
import { anstehendLesen, anstehendStand } from '@/lib/heute/anstehend-server';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { geburtstageIm } from '@/lib/kalender/quellen-geburtstage-server';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { familieName } from '@/lib/familie/speicher';
import type { Geburtstag } from '@/lib/kalender/geburtstag';
import { tagPlus } from '@/lib/kalender/zeit';
import { ladeBuchungBestand, buchungHaushalt } from '@/lib/kalender/buchung-speicher';
import { OFFEN } from '@/lib/kalender/buchung';

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

/** Stand für das ETag: eigener Bestand + Aufgaben + Geburtstags-Quellen (Kartei, Familie) — Tag und Person nimmt die Route dazu. */
export async function meldungenStand(person: string, jetzt: Date = new Date()): Promise<string> {
  const h = await haushaltFuer(person).catch(() => null);
  const bh = await buchungHaushalt().catch(() => null);
  // K6a: dazu die Quellen von „Was ansteht“ (Termine, Fristen, Follow-ups …) samt 10-Minuten-Uhr (Termin „gleich“).
  // Nachtrag F1: der Buchungs-Bestand (Terminanfrage freigegeben/abgelehnt/abgesagt → Meldung erledigt).
  return `${await speicherStand([meldungenSpeicher(person), 'tasks', 'kontakte', ...(h ? [familieName(h.haushalt)] : []), ...(bh ? [`buchung--${bh}`] : [])])}|${await anstehendStand(jetzt)}`;
}

/**
 * Was die Buchungs-Meldungen erledigt (lib/meldungen/regeln.ts `buchungenErledigen`) — nur, wenn der Bestand eine ungelesene
 * Buchungs-Meldung hat (sonst gar nicht lesen). null = nicht lesbar → nichts ausblenden.
 *  offen      Buchungen, die noch auf eine Entscheidung warten (vorläufig/angefragt, Ablauf nachgezogen).
 *  mitTermin  (Restpunkte 29.09.) Buchungen mit Termin-Verweis, deren Termin noch steht. „Steht nicht mehr“ nur, wenn der
 *             iCloud-Stand es sicher weiß (gelungener Abgleich, Tag im Holfenster) — sonst gilt er als da.
 */
async function buchungenLage(b: MeldungenBestand, jetzt: Date): Promise<BuchungenLage | null> {
  const ungelesen = b.eintraege.filter(e => !e.gelesen && (e.bezug?.art === 'buchung' || e.bezug?.art === 'buchung-termin'));
  if (!ungelesen.length) return null;
  try {
    const buchungen = (await ladeBuchungBestand(jetzt)).buchungen;
    const mitVerweis = buchungen.filter(x => !!x.terminUid);
    let lebt: (x: { terminUid?: string; start: string }) => boolean = () => true;
    // Den iCloud-Stand nur lesen, wenn eine „Termin entfernen?“-Meldung offen ist und es einen Verweis zu prüfen gibt.
    if (mitVerweis.length && ungelesen.some(e => e.bezug?.art === 'buchung-termin')) {
      const { ladeStand, holfenster, objekteKurz } = await import('@/lib/kalender/icloud');
      const s = await ladeStand();
      const f = holfenster(s);
      if (f) {
        const da = lebendAus(objekteKurz(s));
        lebt = x => { const tag = x.start.slice(0, 10); return tag < f.von || tag >= f.bis || verweisLebt(x.terminUid!, da); };
      }
    }
    return {
      offen: new Set(buchungen.filter(x => OFFEN.includes(x.status)).map(x => x.id)),
      mitTermin: new Set(mitVerweis.filter(lebt).map(x => x.id)),
    };
  } catch { return null; }
}

const LEER_ANSTEHEND: AnstehendFuerGlocke = { termine: [], nachbereiten: [], fristen: [], followups: [] };
/** Was ansteht (K6a) — wirft nie; ohne Quellen nichts. */
const anstehendFuerGlocke = (person: string, jetzt: Date): Promise<AnstehendFuerGlocke> => anstehendLesen(person, jetzt).catch(() => LEER_ANSTEHEND);

/** Geburtstage heute und morgen (K2) — wirft nie. */
const geburtstageLesen = (person: string, heute: string): Promise<Geburtstag[]> => geburtstageIm({ von: heute, bis: tagPlus(heute, 2) }, person);

async function aufgabenLesen(person: string): Promise<unknown[]> {
  const s = await ladeAufgabenSicht(person); // Sichtfilter „nur ich“ (29.09.)
  return Array.isArray(s?.tasks) ? s.tasks : [];
}

function abgeleitet(bestand: MeldungenBestand, aufgaben: unknown[], person: string, heute: string, geburtstage: readonly Geburtstag[] = [], anstehend: AnstehendFuerGlocke = LEER_ANSTEHEND, jetztWand = `${heute}T00:00:00`): Meldung[] {
  const am = ausWandzeit(`${heute}T00:00:00`).toISOString();
  return [
    ...faelligAbleiten(aufgaben, { person, heute, am, link: WEG.aufgabe, tagVonIso, gelesen: bestand.faelligGelesen }),
    ...geburtstagAbleiten(geburtstage, { person, heute, morgen: tagPlus(heute, 1), am, gelesen: bestand.faelligGelesen }),
    ...anstehendAbleiten(anstehend, { heute, jetztWand, am, gelesen: bestand.faelligGelesen }),
  ];
}

/**
 * Alles, woraus die abgeleiteten Meldungen entstehen (Aufgaben, Geburtstage, was ansteht). F2 N9: gemerkt (lib/store/memo.ts
 * `merken`, 60 s, je Person und 10-Minuten-Uhr) — Glocke, „gelesen“ und Kanal-Einstellung rechneten sonst jedes Mal alle
 * Quellen neu. Jede Schreibung in einen Quell-Bestand macht es ungültig; die Meldungen selbst (`meldungen--*`) sind Rauschen,
 * „gelesen“ lässt die Quellen also warm. `jetztWand` bleibt die echte Uhrzeit.
 */
async function quellenLesen(person: string, heute: string, jetzt: Date) {
  const uhr = wandzeit(jetzt);
  const q = await merken(`glocke-quellen:${person}:${uhr.slice(0, 15)}`, 60_000, async () => {
    const [aufgaben, geburtstage, anstehend] = await Promise.all([aufgabenLesen(person), geburtstageLesen(person, heute), anstehendFuerGlocke(person, jetzt)]);
    return { aufgaben, geburtstage, anstehend };
  });
  return { ...q, jetztWand: uhr };
}

/** Die Glocke einer Person: eigene Meldungen + fällig/überfällig von heute + was ansteht (K6a). */
export async function meldungenSicht(person: string, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const [roh, q] = await Promise.all([loadJson<unknown>(meldungenSpeicher(person)), quellenLesen(person, heute, jetzt)]);
  const gespeichert = bestandSaeubern(roh);
  // Nachtrag F1: entschiedene Terminanfragen zählen nicht mehr an der Glocke; Restpunkte 29.09.: gelöste Termine auch nicht.
  const bestand = buchungenErledigen(gespeichert, await buchungenLage(gespeichert, jetzt));
  return sichtBauen(bestand, abgeleitet(bestand, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute);
}

/** „Gelesen“ setzen — nur im eigenen Bestand der Person. */
export async function meldungenGelesen(person: string, auswahl: GelesenAuswahl, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const q = await quellenLesen(person, heute, jetzt);
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => {
    const b = bestandSaeubern(cur);
    const ids = abgeleitet(b, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand).map(m => m.id);
    return gelesenSetzen(b, auswahl, heute, ids);
  });
  const sicht = buchungenErledigen(next, await buchungenLage(next, jetzt));
  return sichtBauen(sicht, abgeleitet(sicht, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute);
}

/** Kanal-Einstellung der Person (Telegram vorgesehen, versendet noch nichts). */
export async function meldungenEinstellen(person: string, e: { telegram: boolean }, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const q = await quellenLesen(person, heute, jetzt);
  const gespeichert = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => ({ ...bestandSaeubern(cur), einstellungen: { telegram: e.telegram === true } }));
  const next = buchungenErledigen(gespeichert, await buchungenLage(gespeichert, jetzt));
  return sichtBauen(next, abgeleitet(next, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute);
}

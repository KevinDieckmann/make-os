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
import { businessFreiJetzt, eigenerRahmenName } from '@/lib/arbeitsrahmen/server';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { businessFreiIdsAufloesen, businessFreiSammeln, istBusinessMeldung, type BusinessFreiLage } from './regeln';

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
  // TELEGRAM-HAKEN (vorgesehen, aus): await sendeAnPerson(_person, telegramText(_meldung)) — kommt später.
}

/**
 * Der Text für Telegram (Datenschutz, 03.10., netz-recht): ein Messenger-Dienst bekommt keine Namen von Veranstaltungs-Kontakten. Für die
 * Arten `netzwerken` („X hat dir <Person> zugeteilt …“, „Termin mit <Person> …“) und `danke` nur der neutrale Satz — Namen, Firmen, Events und
 * Termin-Einzelheiten stehen dann nur in MAKE OS. Alle anderen Arten: der Titel wie bisher (er trägt nie vertrauliche Werte).
 */
export function telegramText(m: Pick<Meldung, 'art' | 'titel'> & Partial<Pick<Meldung, 'bezug'>>): string {
  if (m.art === 'netzwerken') return 'Neue Person zugeteilt — Details in MAKE OS';
  // DSGVO-Prüfung 04.10.: auch „fällig/überfällig“ der Vertrags-Erinnerung (Aufgabe `vte-…`) nennt Vertrag und Gesellschaft nicht.
  if (m.bezug?.art === 'aufgabe' && m.bezug.id.startsWith('vte-')) return 'Eine Vertragsfrist naht — Details in MAKE OS';
  if (m.art === 'sicherheit') return 'Am Zugang wurde etwas geändert — Details in MAKE OS';
  if (m.art === 'vertrag') return 'Eine Vertragsfrist naht — Details in MAKE OS';
  if (m.art === 'verbindung') return 'Eine Verbindung braucht eine neue Anmeldung — Details in MAKE OS';
  // Agenten-Bereich (09.10.): nie Inhalte eines Laufs auf einen Messenger — nur, dass etwas bereitliegt.
  if (m.art === 'agenten') return 'Ein Agenten-Ergebnis liegt bereit — Details in MAKE OS';
  if (m.art === 'danke') return 'Danke-Mails bereit — Details in MAKE OS';
  return m.titel;
}

/** Eine Meldung ablegen. Wirft nie nach außen weiter als bis `melde()`; Grund bei Ablehnung. */
export async function meldungAblegen(m: MeldungEingabe, jetzt: Date = new Date()): Promise<{ ok: boolean; grund?: string }> {
  const p = pruefeEingabe(m);
  if (!p.ok) return p;
  // Nur an Personen im Haushalt des Inhabers — nie ein Bestand für ein fremdes Konto.
  if (!(await personImHaushaltDesInhabers(m.an))) return { ok: false, grund: 'Empfänger nicht im Haushalt des Inhabers' };
  const roh = eintragAus(m, `m-${jetzt.getTime().toString(36)}-${randomBytes(4).toString('hex')}`, jetzt.toISOString());
  // Business-frei (08.10., Lücke 7, Regel 6): in einer Business-freien Zeit der Empfängerin trägt die Meldung das Ende des
  // Fensters — ob sie Business ist, entscheidet die Sicht (lib/meldungen/regeln.ts); Business ruht dann bis danach.
  const frei = await businessFreiJetzt(m.an, jetzt).catch(() => ({ frei: false as const, bisIso: undefined }));
  const neu = frei.frei && frei.bisIso ? { ...roh, freiBis: frei.bisIso } : roh;
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(m.an), cur => einfuegen(bestandSaeubern(cur), neu, MELDUNGEN_MAX));
  // Telegram (heute aus) stellt in der freien Zeit nichts zu — auch später nicht ungefragt.
  if (next.einstellungen.telegram && !neu.freiBis) await telegramHaken(m.an, neu).catch(() => {});
  return { ok: true };
}

/** Stand für das ETag: eigener Bestand + Aufgaben + Geburtstags-Quellen (Kartei, Familie) — Tag und Person nimmt die Route dazu. */
export async function meldungenStand(person: string, jetzt: Date = new Date()): Promise<string> {
  const h = await haushaltFuer(person).catch(() => null);
  const bh = await buchungHaushalt().catch(() => null);
  // K6a: dazu die Quellen von „Was ansteht“ (Termine, Fristen, Follow-ups …) samt 10-Minuten-Uhr (Termin „gleich“).
  // Nachtrag F1: der Buchungs-Bestand (Terminanfrage freigegeben/abgelehnt/abgesagt → Meldung erledigt).
  // Business-frei (Lücke 7): Beginn und Ende eines Fensters ändern die Sicht ohne Schreibung — der Zustand gehört ins ETag.
  const bf = await businessFreiJetzt(person, jetzt).catch(() => ({ frei: false, bisIso: undefined }));
  return `${await speicherStand([meldungenSpeicher(person), 'tasks', 'kontakte', eigenerRahmenName(person), ...(h ? [familieName(h.haushalt)] : []), ...(bh ? [`buchung--${bh}`] : [])])}|${await anstehendStand(jetzt)}|bf:${bf.frei ? bf.bisIso : '-'}`;
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

/**
 * Business-frei (08.10., Lücke 7, Regel 6): die Lage für die Sicht — ist die Person JETZT Business-frei, und welche Meldung ist
 * Business (Aufgaben über ihren Space aus der Sicht der Person). Ein Lesefehler sperrt nichts (dann wie bisher).
 */
async function businessFreiLage(person: string, aufgaben: unknown[], jetzt: Date): Promise<BusinessFreiLage> {
  const frei = await businessFreiJetzt(person, jetzt).catch(() => ({ frei: false }));
  const bereich = new Map<string, 'privat' | 'business'>();
  for (const t of aufgaben as Parameters<typeof spaceVonAufgabe>[0][]) {
    if (t && typeof t === 'object' && typeof t.id === 'string') { try { bereich.set(t.id, spaceVonAufgabe(t)); } catch { /* unlesbar → privat */ } }
  }
  return { jetzt: jetzt.toISOString(), frei: frei.frei, istBusiness: m => istBusinessMeldung(m, id => bereich.get(id) ?? null) };
}

/** Die Glocke einer Person: eigene Meldungen + fällig/überfällig von heute + was ansteht (K6a). */
export async function meldungenSicht(person: string, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const [roh, q] = await Promise.all([loadJson<unknown>(meldungenSpeicher(person)), quellenLesen(person, heute, jetzt)]);
  const gespeichert = bestandSaeubern(roh);
  // Nachtrag F1: entschiedene Terminanfragen zählen nicht mehr an der Glocke; Restpunkte 29.09.: gelöste Termine auch nicht.
  const bestand = buchungenErledigen(gespeichert, await buchungenLage(gespeichert, jetzt));
  return sichtBauen(bestand, abgeleitet(bestand, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute, await businessFreiLage(person, q.aufgaben, jetzt));
}

/** „Gelesen“ setzen — nur im eigenen Bestand der Person. Eine Sammelmeldung „aus der freien Zeit“ setzt alle ihre Meldungen. */
export async function meldungenGelesen(person: string, auswahl: GelesenAuswahl, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const q = await quellenLesen(person, heute, jetzt);
  const lage = await businessFreiLage(person, q.aufgaben, jetzt);
  const next = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => {
    const b = bestandSaeubern(cur);
    const abg = abgeleitet(b, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand);
    const s = businessFreiSammeln([...abg, ...b.eintraege.map(e => ({ ...e, gelesen: !!e.gelesen }))], lage);
    const ids = auswahl.ids ? businessFreiIdsAufloesen(auswahl.ids, s.gruppen) : undefined;
    return gelesenSetzen(b, { ...auswahl, ...(ids ? { ids } : {}) }, heute, abg.map(m => m.id), s.ruhen);
  });
  const sicht = buchungenErledigen(next, await buchungenLage(next, jetzt));
  return sichtBauen(sicht, abgeleitet(sicht, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute, lage);
}

/** Kanal-Einstellung der Person (Telegram vorgesehen, versendet noch nichts). */
export async function meldungenEinstellen(person: string, e: { telegram: boolean }, jetzt: Date = new Date()): Promise<MeldungenSicht> {
  const heute = heuteBerlin(jetzt);
  const q = await quellenLesen(person, heute, jetzt);
  const gespeichert = await updateJson<MeldungenBestand>(meldungenSpeicher(person), cur => ({ ...bestandSaeubern(cur), einstellungen: { telegram: e.telegram === true } }));
  const next = buchungenErledigen(gespeichert, await buchungenLage(gespeichert, jetzt));
  return sichtBauen(next, abgeleitet(next, q.aufgaben, person, heute, q.geburtstage, q.anstehend, q.jetztWand), heute, await businessFreiLage(person, q.aufgaben, jetzt));
}

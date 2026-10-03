// ─── Netzwerken — Erfassen (Server, 02.10.) ──────────────────────────────────
// EINE Erfassung (Karte, Felder, nächster Schritt, Info, Sprachnotiz) wirkt in mehreren Beständen. Sie läuft in festen,
// einzeln abgehakten Schritten — jeder ist idempotent, und das Journal (`netzwerken-erfassungen--<haushalt>`) hält fest,
// welcher schon getan ist. Die Kennung der Erfassung (UUID) kommt vom Browser; derselbe Körper ein zweites Mal (Netz weg,
// Warteschlange, Doppelklick) tut nichts doppelt, ein abgebrochener Lauf macht beim ersten offenen Schritt weiter:
//
//   event     das Event anlegen, wenn es unterwegs ohne Netz entstand (`eventNeu`); ein Event von heute/früher gilt danach als
//             „durchgeführt“ — so zählen Event-Kennzahlen und Traktions-Index (Teilnahme „da“)
//   firma     bestehende Firma verknüpfen (Name ohne Rechtsform oder Kennung) — sonst neu, mit fester Kennung (nie zwei).
//             Nur für eine NEUE Person: hängt die Erfassung an einer bestehenden, entsteht keine verwaiste Firma (03.10.)
//   kontakt   neue Person: feste Kennung `c-<Erfassungs-UUID>`, Quelle „Netzwerken“, Herkunft „Veranstaltung“, Typ „Netzwerk“,
//             Label „Netzwerken“, Rechtsgrundlage „berechtigtes Interesse“ (B2B-Anbahnung, Art. 6 Abs. 1 f), Beziehung bei der
//             zuständigen Person, Sperrliste, Datenschutz-Stempel — und NIE ein Eintrag in `einwilligungen` (eine Visitenkarte ist
//             keine Einwilligung, § 7 UWG). Gleiche Mail — oder gleiche Nummer UND gleicher Nachname — wie eine bestehende Person
//             (ohne `neuErzwingen`): nicht doppelt anlegen, die Erfassung hängt an der bestehenden und füllt deren LEERE Felder
//             (Telefon, Handy, Position, LinkedIn, Website; nichts wird überschrieben). Gleiche Nummer mit anderem Nachnamen:
//             neue Person + Hinweis. Gleicher Name + Firma ohne Beleg: neue Person + „Gibt es vermutlich schon“ + Label
//             „Dublette prüfen“. Art. 18 → 409.
//   dateien   Fotos der Karte und die Sprachnotiz verschlüsselt in der Dateiablage am Kontakt (Art. 17: fällt mit der Person)
//   teilnahme Teilnahme „da“ am Event + `netzwerken` (Schritt, Zuständigkeit, Info) — Quelle von Abendbericht und Danke-Mail
//   verlauf   Aktivität „Kennengelernt bei <Event>“ (+ Vermerk „keine Einwilligung“ bei neuer Person), Sprachnotiz-Aktivität
//   schritt   Lead-Status zuerst (neue Leads → „Kontaktiert“, damit sie in „In Arbeit“ stehen; Qualifizieren → „Qualifizierung“;
//             nie über Kein Fit/Ruht/SQL/Kunde und nie bei Dienstleister/Investor/Wettbewerber — dann Hinweis + Label „Lead prüfen“),
//             dann je nach Wahl: Follow-up (FollowUp) · Vermitteln (Deal) · Andere/Make.One (Aufgabe mit Bezug) · Angebot (Entwurf
//             im Angebots-Tool) · Nur Kontakt (nichts) · Termin (eigener Schritt unten). Termin/Angebot/Vermitteln/Make.One
//             gelten als nachgefasst (`followUpAm` = Erfassungstag)
//   termin    Termin im Kalender der ZUSTÄNDIGEN Person (feste UID, ohne Gäste/Einladung) + Meeting-Aktivität wie K3; erst DANACH
//             steht `terminAm`/`terminId` an der Teilnahme (Danke-Mail und Bericht nennen nie einen Termin, den es nicht gibt).
//             Geht der Termin nicht (kein Kalender, iCloud weg → 409 `teilweise`), schließt `ohneTermin` die Erfassung mit
//             einem Follow-up ab (nächster Werktag, „Termin vereinbaren“)
//   melden    Glocke an die andere Person (Art „netzwerken“): Termin gebucht bzw. Person zugeteilt — das Pop-up zeigt sie einmal
//
// Nichts wird versendet. Zugang und Haushalt prüft die Route; hier gilt: die zuständige Person muss im Haushalt sein.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename, wendeAktivitaetAn, bezuegeSynchron, serverStempel } from '@/lib/make-one/crm';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { aendereKontakte } from './kartei-schreiben';
import { aendereCrm, ladeCrm } from './speicher';
import { sperrlisteLaden, neuanlageSperre } from './sperrliste';
import { datenschutzStempeln } from './datenschutz-stempel';
import { kontaktAusKarte, firmaZurKarte, type VisitenkartenDaten } from './visitenkarte';
import { domainVon, firmenId, bestehendeFirma } from './firmen';
import { neuesFollowUp } from './followup';
import { leereKriterien } from './leads';
import { dealAnlegen } from './deal-anlegen';
import { kontextAus } from './segmente';
import { gastVormerken, einladungswegAus } from './eventplanung';
import { kanalStatus } from './recht';
import { angebotSpeichern } from './angebot-server';
import { terminAktivitaetenSetzen } from './termin-aktivitaet-server';
import { MARKE_EVENTS, istNetzwerkenEvent } from './marke';
import { besuchAbgesagt } from './besuche-form';
import { zusammenfuehrung, trifftEingeschraenkte, luekenFuellen, neuesEvent, gleichesBesuchEvent, followupFrist, followupFristEinTag, ergebnisZiel, eventDatumPlausibel, wandPlusMinuten, schrittLabel, terminArtLabel, stadtAusAnschrift, NETZWERKEN_QUELLE, KEINE_EINWILLIGUNG, LABEL_NETZWERKEN, LABEL_DUBLETTE, LABEL_LEAD_PRUEFEN, type Erfassung } from './netzwerken';
import type { CrmBestand, Firma, NetzwerkenAngabe, Teilnahme } from './typen';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { ablageListe, ablegen, AblageFehler } from '@/lib/dateien/ablage';
import { typErkennen, sprachnotizTypErkennen, dateinameSaeubern, SPRACHNOTIZ_TYPEN } from '@/lib/dateien/regeln';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { terminAnlegenServer } from '@/lib/kalender/termin-server';
import { ladeEinstellungen, type Wer as KalenderWer } from '@/lib/kalender/einstellungen';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { freieZeitFuer, arbeitszeitAus, belegungenAus } from '@/lib/kalender/freie-zeit';
import { istFrei } from '@/lib/kalender/verfuegbar';
import { verfuegbarkeitFuer } from '@/lib/kalender/verfuegbarkeit';
import { melde } from '@/lib/meldungen/melden';
import { localDay } from '@/lib/zeit';
import { tagVon, wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { WEG } from '@/lib/wege';

// ── Journal ──────────────────────────────────────────────────────────────────

export const JOURNAL_PRAEFIX = 'netzwerken-erfassungen--';
export const journalName = (haushalt: string): string => `netzwerken-erfassungen--${haushalt}`;
/** Die Schritte in ihrer Reihenfolge — ein Lauf macht beim ersten nicht abgehakten weiter. */
export const ERFASSUNG_SCHRITTE = ['event', 'firma', 'kontakt', 'dateien', 'teilnahme', 'verlauf', 'schritt', 'termin', 'melden'] as const;
export type ErfassungSchritt = typeof ERFASSUNG_SCHRITTE[number];
/** Fertige Einträge bleiben so lange (Idempotenz für späte Wiederholungen aus der Warteschlange), dann fallen sie weg. */
export const JOURNAL_TAGE = 60;

/**
 * Das Journal trägt KEINE Personendaten: Erfassungs-Kennung (Zufall), abgehakte Schritte, Zeiten. Bis zum Abschluss steht
 * dazu die Kennung der Person (`kontaktId`, nötig, wenn die Erfassung an einer BESTEHENDEN Person hängt) und der Schlüssel
 * des Termins (`terminSchluessel`) — beides wird beim Abschluss geleert.
 */
export interface JournalEintrag {
  id: string; angelegt: string; schritte: string[]; fertig?: string; kontaktId?: string; terminSchluessel?: string;
  /** Das Event, an dem die Erfassung wirklich hängt, wenn es von `eventId` des Körpers abweicht (ein gleichnamiges Event gleichen Tages gab es schon — M7). Keine Personendaten, bleibt auch nach dem Abschluss. */
  eventId?: string;
}
interface JournalDatei { eintraege: JournalEintrag[] }

/** Fertige UND nie fertig gewordene Einträge fallen nach 60 Tagen weg (die Kennung der Person verschwindet so spätestens dann). */
const aufraeumen = (l: JournalEintrag[], jetzt: Date): JournalEintrag[] => l.filter(e => Date.parse(e.fertig ?? e.angelegt) >= jetzt.getTime() - JOURNAL_TAGE * 864e5);

export async function journalLesen(haushalt: string, id: string): Promise<JournalEintrag | null> {
  const d = await loadJson<JournalDatei>(journalName(haushalt));
  return (d?.eintraege ?? []).find(e => e.id === id) ?? null;
}
async function journalAendern(haushalt: string, id: string, f: (e: JournalEintrag) => JournalEintrag, jetzt: Date): Promise<void> {
  await updateJson<JournalDatei>(journalName(haushalt), cur => {
    const l = (cur?.eintraege ?? []).map(e => ({ ...e, schritte: [...e.schritte] }));
    const i = l.findIndex(e => e.id === id);
    const e0 = i >= 0 ? l[i] : { id, angelegt: jetzt.toISOString(), schritte: [] };
    const neu = f(e0);
    if (i >= 0) l[i] = neu; else l.push(neu);
    return { eintraege: aufraeumen(l, jetzt) };
  });
}

// ── Fehler ───────────────────────────────────────────────────────────────────

/** Art. 18: die Person ist eingeschränkt — Text für jeden Weg, der darauf stößt (nennt sie nie). */
const EINGESCHRAENKT_TEXT = 'Diese Person ist eingeschränkt (Art. 18) — sie wird nicht verarbeitet.';

export class ErfassungFehler extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message); this.name = 'ErfassungFehler'; }
}

export interface ErfassungKontext { person: string; haushalt: string; wer: Wer; jetzt?: Date }
export interface ErfassungErgebnis {
  ok: true;
  /** Der Lauf war schon abgeschlossen (Wiederholung) — dann ohne Kennung der Person. */
  schonDa?: boolean;
  kontaktId?: string;
  /** Neu angelegt (false: an eine bestehende Person gehängt). */
  neu?: boolean;
  /** Gleiche Mail/Nummer wie diese bestehende Person — nicht doppelt angelegt. */
  zusammengefuehrt?: boolean;
  eventId: string;
  terminUid?: string;
  /** Tag des Termins (YYYY-MM-DD) — für den Sprung in den Kalender. */
  terminTag?: string;
  angebotId?: string;
  /** Make.One-Event, für das die Person vorgemerkt wurde (Schritt „Zu Make.One einladen“) — für den Sprung in die Gästeliste. */
  makeoneEventId?: string;
  /** Das Event ist ein besuchtes (Reiter „Events“) — der Sprung geht dann in die Event-Akte, sonst in den Make.One-Reiter. */
  eventBesuch?: boolean;
  /** Kennung des Deals (Schritt „Vermitteln“) bzw. des Follow-ups (Schritt „Follow-up“ oder „Ohne Termin abschließen“) — feste Kennungen. */
  dealId?: string;
  followupId?: string;
  hinweise: string[];
}

// Läuft dieselbe Erfassung gerade (Doppelklick, zwei Wiederholungen gleichzeitig), teilen sich die Aufrufe EINEN Lauf.
const G = globalThis as unknown as { __makeosNetzwerkenLaeuft?: Map<string, Promise<ErfassungErgebnis>> };
const LAEUFT: Map<string, Promise<ErfassungErgebnis>> = (G.__makeosNetzwerkenLaeuft ??= new Map());

/** Nur für Tests: simuliert einen Abbruch NACH diesem Schritt (Wirkung getan, abgehakt) bzw. VOR dem Abhaken. */
export const netzwerkenTest: { nachSchritt: ((s: string) => void) | null; vorAbhaken: ((s: string) => void) | null } = { nachSchritt: null, vorAbhaken: null };

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const wochentag = (tag: string) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()];
const datumKurz = (wand: string) => `${wochentag(wand.slice(0, 10))} ${wand.slice(8, 10)}.${wand.slice(5, 7)}.`;

/** Bild-Endung nach Typ. */
const bildEndung = (typ: string) => (typ === 'image/png' ? 'png' : 'jpg');

/**
 * Eine Erfassung ausführen. Wirft `ErfassungFehler` (mit Status) — die Route macht daraus die Antwort. Wiederholbar:
 * `schonDa` bei abgeschlossenem Lauf.
 */
export async function erfassungAusfuehren(e: Erfassung, ctx: ErfassungKontext): Promise<ErfassungErgebnis> {
  if (!HAUSHALT_OK.test(ctx.haushalt)) throw new ErfassungFehler('Kein Haushalt für diese Person.', 403);
  const schluessel = `${ctx.haushalt}:${e.erfassungId}`;
  const laeuft = LAEUFT.get(schluessel);
  if (laeuft) return laeuft;
  const p = lauf(e, ctx).finally(() => { LAEUFT.delete(schluessel); });
  LAEUFT.set(schluessel, p);
  return p;
}

async function lauf(e: Erfassung, ctx: ErfassungKontext): Promise<ErfassungErgebnis> {
  const jetzt = ctx.jetzt ?? new Date();
  const h = ctx.haushalt;
  const hinweise: string[] = [];

  // Eine Erfassung liegt im Browser, bis sie gesendet ist — melden sich dort inzwischen andere an, geht sie NICHT unter deren Namen
  // raus (Kevin hat sie gemacht, nicht Malin: Beziehung, „kennengelernt von“, Danke-Mail wären falsch). 409 mit Hinweis, nichts geschrieben.
  if (e.erfasstVon && e.erfasstVon !== ctx.person) {
    const namen = new Map((await kontenDesHaushalts(h)).map(k => [k.speicher, k.name]));
    throw new ErfassungFehler(`Diese Erfassung hat ${namen.get(e.erfasstVon) ?? e.erfasstVon} gemacht — sie wird nur unter diesem Konto gesendet. Bitte dort anmelden.`, 409, { andere: true, erfasstVon: e.erfasstVon });
  }

  const vorher = await journalLesen(h, e.erfassungId);
  if (vorher?.fertig) return { ok: true, schonDa: true, eventId: vorher.eventId ?? e.eventId, hinweise: [] };

  // Zuständig = Person des Haushalts (nie ein fremdes Konto) — vor jedem Schreiben.
  if (!(await personImHaushaltDesInhabers(e.zustaendig))) throw new ErfassungFehler('Zuständig kann nur eine Person aus eurem Haushalt sein.', 400);

  const erfasstTag = tagVon(wandzeit(new Date(e.erfasstAm)));
  const heute = localDay(jetzt);
  const jetztIso = jetzt.toISOString();
  const erledigt = new Set(vorher?.schritte ?? []);
  if (!vorher) await journalAendern(h, e.erfassungId, x => x, jetzt);

  /** Einen Schritt tun, wenn er noch nicht abgehakt ist, und danach abhaken. */
  const schritt = async <T>(name: ErfassungSchritt, fn: () => Promise<T>, daten?: (r: T) => Partial<JournalEintrag>): Promise<T | undefined> => {
    if (erledigt.has(name)) return undefined;
    const r = await fn();
    netzwerkenTest.vorAbhaken?.(name);
    await journalAendern(h, e.erfassungId, x => ({ ...x, schritte: x.schritte.includes(name) ? x.schritte : [...x.schritte, name], ...(daten ? daten(r) : {}) }), jetzt);
    erledigt.add(name);
    netzwerkenTest.nachSchritt?.(name);
    return r;
  };

  // ── event ──
  // Das Event, an dem die Erfassung hängt: der Körper nennt eine Kennung; gab es ein gleichnamiges Event desselben Tages schon (M7), hängt
  // sie daran (das Journal merkt es sich) — der Client bekommt die echte Kennung in der Antwort und hängt `wahl` um.
  const eventNeuAnlegen = (b: CrmBestand, id: string): CrmBestand => {
    const n = e.eventNeu!;
    if (!eventDatumPlausibel(n.datum, heute)) throw new ErfassungFehler('Das Datum des Events liegt mehr als ein Jahr entfernt — bitte das Event prüfen oder ein anderes wählen.', 400, { eventFehler: true });
    // „Für“ nur, wenn es die Kunden-Firma (und das Mandat) noch gibt — sonst als MAKE anlegen, nie ein Verweis ins Leere.
    const nf = n.fuer?.art === 'kunde' ? n.fuer : undefined;
    const fuer = nf && b.firmen.some(f => f.id === nf.firmaId) && (!nf.mandatId || b.mandate.some(m => m.id === nf.mandatId && m.firmaId === nf.firmaId)) ? nf : undefined;
    if (n.fuer && !fuer) hinweise.push('Die Kunden-Firma des Events gibt es nicht mehr — das Event wurde ohne „für wen“ angelegt.');
    return { ...b, events: [...b.events, neuesEvent({ id, titel: n.titel, datum: n.datum, ...(n.ort ? { ort: n.ort } : {}), ...(fuer ? { fuer } : {}), person: ctx.person, heute, jetztIso })] };
  };
  const EVENT_WEG = 'Das Event gibt es nicht (mehr) — bitte „Heute bei“ neu wählen.';
  const eventErsatz = await schritt('event', async () => {
    let fehlt = false, abgesagt = false;
    let ersatz: string | undefined;
    await aendereCrm(b => {
      let ev = b.events.find(x => x.id === e.eventId);
      if (!ev) {
        if (!e.eventNeu) { fehlt = true; return b; }
        const da = gleichesBesuchEvent(b.events, e.eventNeu.titel, e.eventNeu.datum);
        if (!da) return eventNeuAnlegen(b, e.eventId);
        ev = da; ersatz = da.id;
      }
      // Ein abgesagtes Event bekommt keine Begegnung (N4) — sie hinge an einer Veranstaltung, die nicht stattfand.
      if (besuchAbgesagt(ev)) { abgesagt = true; return b; }
      // Wer „Heute bei“ wählt, ist dort: ein Event von heute oder früher, das noch „geplant“ steht, gilt als durchgeführt.
      if (ev.datum <= heute && (ev.status === 'geplant' || ev.status === 'einladung' || ev.status === 'idee')) {
        const evId = ev.id;
        // Hat das Event einen Anmeldestand (Events-Reiter, 03.10.), zieht er mit: wer dort erfasst, hat es besucht.
        return { ...b, events: b.events.map(x => (x.id === evId ? { ...x, status: 'durchgefuehrt' as const, ...(x.anmeldung ? { anmeldung: 'besucht' as const } : {}), geaendert: jetztIso, geaendertVon: ctx.person } : x)) };
      }
      return b;
    }, ctx.wer);
    if (fehlt) throw new ErfassungFehler(EVENT_WEG, 404, { eventFehler: true });
    if (abgesagt) throw new ErfassungFehler('Das Event ist abgesagt — bitte ein anderes Event wählen.', 409, { eventFehler: true });
    return ersatz;
  }, id => (id ? { eventId: id } : {}));
  let eventId = eventErsatz ?? vorher?.eventId ?? e.eventId;
  let crm0 = await ladeCrm();
  let event = crm0.events.find(x => x.id === eventId);
  if (!event) {
    // Das Event wurde gelöscht, nachdem der Schritt schon abgehakt war (Erfassung hing in der Warteschlange): aus `eventNeu` neu anlegen (H1);
    // ohne `eventNeu` (ältere Körper) bleibt es beim 404. Die Teilnahme hing am gelöschten Event (Kaskade) — der Schritt läuft noch einmal.
    if (!e.eventNeu) throw new ErfassungFehler(EVENT_WEG, 404, { eventFehler: true });
    await aendereCrm(b => (b.events.some(x => x.id === eventId) ? b : eventNeuAnlegen(b, eventId)), ctx.wer);
    hinweise.push(`Das Event „${e.eventNeu.titel}“ war gelöscht — es wurde neu angelegt.`);
    erledigt.delete('teilnahme');
    crm0 = await ladeCrm();
    event = crm0.events.find(x => x.id === eventId);
    if (!event) throw new ErfassungFehler(EVENT_WEG, 404, { eventFehler: true });
  }

  const nameDa = e.vorhandenKontaktId !== undefined;
  const firmaName = e.kontakt.firma;

  const eigeneId = `c-${e.erfassungId}`;
  // ── Art. 18 bei „Dublette“: gehört die Karte (Mail, oder Nummer + Nachname) zu einer EINGESCHRÄNKTEN Person, geschieht nichts —
  // weder wird angehängt noch daneben neu angelegt (derselbe Befund wie beim Pfad `vorhandenKontaktId`). VOR Firma und Kontakt,
  // damit auch keine verwaiste Firma entsteht; die Meldung nennt die Person nie.
  if (!nameDa) {
    const { kontakteFuerVerarbeitung } = await import('./verarbeitung');
    if (trifftEingeschraenkte(e, await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), eigeneId)) throw new ErfassungFehler(EINGESCHRAENKT_TEXT, 409, { eingeschraenkt: true });
  }
  // ── firma ── (nur für neue Personen; an einer bestehenden Person bleibt ihre Firma, wie sie ist — und hängt die Erfassung
  // an einer bestehenden Person, entsteht keine verwaiste Firma: dieselbe Zusammenführungs-Regel wie im Schritt „kontakt“)
  await schritt('firma', async () => {
    if (nameDa || !firmaName) return;
    if (!e.neuErzwingen && zusammenfuehrung(e, await kontakteLesen(), eigeneId).ziel) return;
    let fehlt = false;
    await aendereCrm(b => {
      if (e.firmaId) { if (!b.firmen.some(f => f.id === e.firmaId)) fehlt = true; return b; }
      if (bestehendeFirma(b.firmen, firmaName) || firmaZurKarte({ firma: firmaName, email: e.kontakt.email, webseite: e.kontakt.webseite }, b.firmen)) return b;
      const domain = domainVon({ email: e.kontakt.email, firmaWebseite: e.kontakt.webseite });
      const stadt = stadtAusAnschrift(e.kontakt.anschrift);
      const neu: Firma = { id: firmenId(firmaName), name: firmaName, rolle: 'offen', ...(e.kontakt.webseite ? { webseite: e.kontakt.webseite } : {}), ...(domain ? { domain } : {}), ...(stadt ? { stadt } : {}), geaendert: jetztIso };
      return { ...b, firmen: [...b.firmen, neu] };
    }, ctx.wer);
    if (fehlt) throw new ErfassungFehler('Die gewählte Firma gibt es nicht mehr.', 404);
  });
  const firmenJetzt = (await ladeCrm()).firmen;
  const firma = nameDa || !firmaName ? undefined : (e.firmaId ? firmenJetzt.find(f => f.id === e.firmaId) : undefined) ?? firmaZurKarte({ firma: firmaName, email: e.kontakt.email, webseite: e.kontakt.webseite }, firmenJetzt) ?? bestehendeFirma(firmenJetzt, firmaName);

  // ── kontakt ──
  const kontaktResultat = await schritt('kontakt', async () => {
    const sperrEintraege = nameDa ? [] : await sperrlisteLaden();
    let r: { id: string; neu: boolean; zusammengefuehrt?: boolean; hinweise: string[] } = { id: e.vorhandenKontaktId ?? eigeneId, neu: false, hinweise: [] };
    let fehler: ErfassungFehler | null = null;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      /** An eine bestehende Person hängen: ihre leeren Felder füllen (nichts überschreiben), Quelle und Besitzer bleiben. */
      const anhaengen = (k: Kontakt, hinweis?: string, zus?: boolean) => {
        const l = luekenFuellen(k, e.kontakt, heute);
        r = { id: k.id, neu: false, ...(zus ? { zusammengefuehrt: true } : {}), hinweise: [...(hinweis ? [hinweis] : []), ...(l.ergaenzt.length ? [`Bei ${anzeigename(k)} ergänzt: ${l.ergaenzt.join(', ')} (nichts überschrieben).`] : [])] };
        return l.ergaenzt.length ? { ...f, kontakte: f.kontakte.map(x => (x.id === k.id ? l.kontakt : x)) } : f;
      };
      if (nameDa) {
        const k = f.kontakte.find(x => x.id === e.vorhandenKontaktId);
        if (!k) { fehler = new ErfassungFehler('Die gewählte Person gibt es nicht mehr.', 404); return f; }
        if (k.eingeschraenkt) { fehler = new ErfassungFehler(EINGESCHRAENKT_TEXT, 409, { eingeschraenkt: true }); return f; }
        return anhaengen(k);
      }
      if (f.kontakte.some(x => x.id === eigeneId)) { r = { id: eigeneId, neu: true, hinweise: [] }; return f; } // Abbruch zwischen Wirkung und Abhaken
      // Zwischen der Vorprüfung oben und diesem Schreiben kann die Person eingeschränkt worden sein — hier noch einmal, auf dem Stand der Kartei.
      if (trifftEingeschraenkte(e, f.kontakte, eigeneId)) { fehler = new ErfassungFehler(EINGESCHRAENKT_TEXT, 409, { eingeschraenkt: true }); return f; }
      // Ähnliche Person? Auch wenn die Prüfung am Handy ohne Netz entfiel. Mail — oder Nummer UND Nachname — hängt an; Nummer mit
      // anderem Nachnamen (Zentrale, Familie) und Name + Firma ohne Beleg legen NEU an, mit Hinweis.
      const z = e.neuErzwingen ? {} as ReturnType<typeof zusammenfuehrung> : zusammenfuehrung(e, f.kontakte, eigeneId);
      if (z.ziel) return anhaengen(z.ziel.kontakt, `${anzeigename(z.ziel.kontakt)} gab es schon (${z.ziel.grund}) — die Erfassung hängt an dieser Person, es entstand keine zweite.`, true);
      const hinweiseNeu: string[] = [];
      if (z.gleicheNummer) hinweiseNeu.push(`Gleiche Nummer wie ${anzeigename(z.gleicheNummer.kontakt)} (anderer Nachname) — als neue Person angelegt, bitte bei Gelegenheit prüfen.`);
      if (z.vermutlich) hinweiseNeu.push(`Gibt es vermutlich schon: ${anzeigename(z.vermutlich.kontakt)}${z.vermutlich.kontakt.firma ? ` (${z.vermutlich.kontakt.firma})` : ''} — ${z.vermutlich.grund}. Neue Person angelegt, Label „${LABEL_DUBLETTE}“ gesetzt.`);
      const d: VisitenkartenDaten = { vorname: e.kontakt.vorname, nachname: e.kontakt.nachname, firma: e.kontakt.firma, position: e.kontakt.position, email: e.kontakt.email, telefon: e.kontakt.telefon, mobil: e.kontakt.mobil, linkedin: e.kontakt.linkedin, webseite: e.kontakt.webseite };
      const stadt = stadtAusAnschrift(e.kontakt.anschrift);
      const roh = kontaktAusKarte(d, { id: eigeneId, heute, jetzt: e.erfasstAm, von: e.zustaendig, herkunft: 'veranstaltung', ...(firma ? { firma: { id: firma.id, name: firma.name } } : {}), anlass: `Per Visitenkarte erfasst — Netzwerken: ${event.titel}` });
      const mitZusatz: Kontakt = {
        ...roh, quelle: NETZWERKEN_QUELLE, typ: 'Netzwerk', anrede: e.kontakt.anrede ?? 'Sie',
        // B2B-Anbahnung nach einer persönlichen Begegnung: berechtigtes Interesse (Art. 6 Abs. 1 f DSGVO) — ausdrücklich KEINE Einwilligung.
        rechtsgrundlage: 'berechtigt',
        labels: [LABEL_NETZWERKEN, ...(z.vermutlich ? [LABEL_DUBLETTE] : [])],
        ...(stadt ? { firmaStadt: stadt } : {}),
        // Es gibt kein Anschrift-Feld an der Person — die Zeilen der Karte stehen in der Notiz (sichtbar in der Akte).
        ...(e.kontakt.anschrift ? { notiz: `Anschrift (Visitenkarte): ${e.kontakt.anschrift.split('\n').join(', ')}` } : {}),
      };
      const sperre = neuanlageSperre(mitZusatz, sperrEintraege, heute);
      const namen = new Map(firmenJetzt.map(x => [x.id, x.name]));
      const fertig = serverStempel(bezuegeSynchron(datenschutzStempeln(sperre.kontakt, undefined, ctx.person, jetztIso, heute), undefined, heute, id => namen.get(id)), undefined, heute);
      r = { id: eigeneId, neu: true, hinweise: [...(sperre.hinweis ? [sperre.hinweis] : []), ...hinweiseNeu] };
      return { ...f, kontakte: [...f.kontakte, fertig] };
    }, ctx.wer);
    if (fehler) throw fehler;
    return r;
  }, r => ({ kontaktId: r.id }));
  const jetztJournal = await journalLesen(h, e.erfassungId);
  const kontaktId = kontaktResultat?.id ?? jetztJournal?.kontaktId ?? e.vorhandenKontaktId ?? eigeneId;
  if (kontaktResultat) hinweise.push(...kontaktResultat.hinweise);
  const neuAngelegt = kontaktResultat ? kontaktResultat.neu : !nameDa && kontaktId === eigeneId;

  const kontakt0 = (await ladeKontakt(kontaktId));
  if (!kontakt0) throw new ErfassungFehler('Die Person gibt es nicht mehr.', 404);
  if (kontakt0.eingeschraenkt) throw new ErfassungFehler(EINGESCHRAENKT_TEXT, 409, { eingeschraenkt: true });
  const name = anzeigename(kontakt0);

  // ── dateien ──
  await schritt('dateien', async () => {
    if (!e.bilder.length && !e.sprachnotiz) return;
    const vorhanden = await ablageListe(h);
    const marke = e.erfassungId.slice(0, 8);
    const gibt = (titel: string) => vorhanden.some(x => x.kontaktId === kontaktId && x.titel === titel);
    for (const [i, b] of e.bilder.entries()) {
      const titel = `Visitenkarte ${i + 1}/${e.bilder.length} · ${marke}`;
      if (gibt(titel)) continue;
      const bytes = Buffer.from(b.daten, 'base64');
      const dateiName = dateinameSaeubern(`visitenkarte-${i + 1}.${bildEndung(b.typ)}`);
      const typ = typErkennen(dateiName, bytes.subarray(0, 16));
      if (!typ) throw new ErfassungFehler(`Foto ${i + 1} ist keine gültige Bilddatei.`, 415);
      try { await ablegen(h, ctx.person, { art: 'sonstig', titel, kontaktId, notiz: `Netzwerken bei „${event.titel}“` }, { bytes, name: dateiName, typ }, jetztIso); }
      catch (err) { throw uebersetzen(err); }
    }
    if (e.sprachnotiz) {
      const titel = `Sprachnotiz · ${marke}`;
      if (!gibt(titel)) {
        const bytes = Buffer.from(e.sprachnotiz.daten, 'base64');
        const typ = sprachnotizTypErkennen(bytes.subarray(0, 16));
        if (!typ) throw new ErfassungFehler('Die Sprachnotiz hat ein unbekanntes Format.', 415);
        try { await ablegen(h, ctx.person, { art: 'sonstig', titel, kontaktId, notiz: `Sprachnotiz bei „${event.titel}“ — Abschrift folgt (KI)` }, { bytes, name: dateinameSaeubern(`sprachnotiz.${SPRACHNOTIZ_TYPEN[typ][0]}`), typ }, jetztIso); }
        catch (err) { throw uebersetzen(err); }
      }
    }
  });

  // ── teilnahme ──
  const angabe: NetzwerkenAngabe = {
    erfassungId: e.erfassungId, schritt: e.schritt, zustaendig: e.zustaendig, erfasstVon: ctx.person, erfasstAm: e.erfasstAm,
    ...(e.info ? { info: e.info } : {}),
    // `terminAm`/`terminId` kommen erst im Schritt „termin“ dazu, wenn der Termin wirklich im Kalender steht.
    ...(e.kontakt.anrede ? { danke: { anrede: e.kontakt.anrede } } : {}),
  };
  await schritt('teilnahme', async () => {
    await aendereCrm(b => {
      const i = b.teilnahmen.findIndex(t => t.eventId === eventId && t.kontaktId === kontaktId);
      if (i >= 0) {
        const t = b.teilnahmen[i];
        if (t.netzwerken?.erfassungId === e.erfassungId) return b;
        // Zweite Begegnung beim selben Event: die neuere Angabe gilt, eine schon bestätigte Danke-Mail bleibt vermerkt.
        const danke = t.netzwerken?.danke?.rausAm ? { ...(angabe.danke ?? {}), rausAm: t.netzwerken.danke.rausAm } : angabe.danke;
        const neu = { ...t, status: 'da' as const, ...(t.eingechecktVon ? {} : { eingechecktVon: ctx.person }), ...(t.einladenDurch ? {} : { einladenDurch: e.zustaendig }),
          ...(e.info && !t.notiz ? { notiz: e.info.slice(0, 1500) } : {}), netzwerken: { ...angabe, ...(danke ? { danke } : {}) }, geaendert: jetztIso, geaendertVon: ctx.person };
        return { ...b, teilnahmen: b.teilnahmen.map((x, j) => (j === i ? neu : x)) };
      }
      return { ...b, teilnahmen: [...b.teilnahmen, { id: `t-${e.erfassungId}`, eventId: eventId, kontaktId, status: 'da' as const, rolle: 'gast' as const, einladenDurch: e.zustaendig, eingechecktVon: ctx.person, ...(e.info ? { notiz: e.info.slice(0, 1500) } : {}), netzwerken: angabe, geaendert: jetztIso, geaendertVon: ctx.person }] };
    }, ctx.wer);
  });

  // ── verlauf ──
  await schritt('verlauf', async () => {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      const i = f.kontakte.findIndex(k => k.id === kontaktId);
      if (i < 0) return f;
      let k = f.kontakte[i];
      if (k.eingeschraenkt) return f;
      const text = [`Kennengelernt bei ${event.titel}`, ...(e.info ? [`Info: ${e.info.replace(/\s+/g, ' ')}`] : []), ...(neuAngelegt ? [KEINE_EINWILLIGUNG] : [])].join(' — ');
      const schon = (art: string, marker: string) => (k.aktivitaeten ?? []).some(a => a.art === art && a.am === e.erfasstAm && a.bezug === eventId && (a.text ?? '').includes(marker));
      if (!schon('event', 'Kennengelernt bei')) k = wendeAktivitaetAn(k, { art: 'event', text: text.slice(0, 2900), von: ctx.person, bezug: eventId }, erfasstTag > heute ? heute : erfasstTag, e.erfasstAm, tagPlusLokal);
      if (e.sprachnotiz && !schon('notiz', 'Sprachnotiz')) k = wendeAktivitaetAn({ ...k }, { art: 'notiz', text: `Sprachnotiz aufgenommen — Abschrift folgt (KI)${e.sprachnotiz.dauerSek ? ` · ${Math.floor(e.sprachnotiz.dauerSek / 60)}:${String(e.sprachnotiz.dauerSek % 60).padStart(2, '0')} min` : ''}`, von: ctx.person, bezug: eventId }, erfasstTag > heute ? heute : erfasstTag, e.erfasstAm, tagPlusLokal);
      // Jede über „Netzwerken“ erfasste Person trägt das Label — auch eine bestehende (Kartei-Filter „Label: Netzwerken“).
      if (!(k.labels ?? []).includes(LABEL_NETZWERKEN)) k = { ...k, labels: [...(k.labels ?? []), LABEL_NETZWERKEN], geaendertAm: heute };
      return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? k : x)) };
    }, ctx.wer);
  });

  /** An der Teilnahme dieser Erfassung nachtragen (nur bei der Erfassung, die die Angabe hält — eine spätere Begegnung bleibt unberührt). */
  const angabeAendern = (f: (a: NetzwerkenAngabe) => NetzwerkenAngabe, zusatz: (t: Teilnahme) => Partial<Teilnahme> = () => ({})) => aendereCrm(bs => ({ ...bs, teilnahmen: bs.teilnahmen.map(t => (t.eventId === eventId && t.kontaktId === kontaktId && t.netzwerken?.erfassungId === e.erfassungId
    ? { ...t, ...zusatz(t), netzwerken: f(t.netzwerken), geaendert: jetztIso, geaendertVon: ctx.person } : t)) }), ctx.wer);
  // ── schritt ──
  let makeoneEventId: string | undefined;
  let makeoneGesperrt = false;
  let angebotId: string | undefined;
  /** Aufgabe mit Bezug zum Kontakt (feste Kennung `nw-<Erfassung>` — nie doppelt); der Aufgaben-Weg meldet die Zuweisung selbst. */
  const aufgabeAnlegen = (titel: string, faellig: string) => systemAufgabenAendern(stand => {
    const id = `nw-${e.erfassungId}`;
    if (stand.tasks.some(t => t.id === id)) return {};
    return { neu: [{
      id, title: titel.slice(0, 300), description: [`Kennengelernt bei „${event.titel}“ (Netzwerken).`, ...(e.info ? [`Info: ${e.info}`] : []), WEG.akte(kontaktId)].join('\n').slice(0, 4000),
      status: 'todo', priority: 'medium', assignee: e.zustaendig, tags: ['crm', 'netzwerken'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, dueDate: faellig, bezug: { kontaktId },
    }] };
  }, { person: ctx.person, wer: ctx.wer, jetzt: jetztIso });
  /** Der Tag der Begegnung (nie in der Zukunft) — daran hängen Fristen und „nachgefasst“. */
  const begegnungsTag = erfasstTag > heute ? heute : erfasstTag;
  /** Die Begegnung zählt als nachgefasst (Termin, Angebot, Vermitteln, Make.One: ein nächster Schritt ist getan, kein Gast bleibt in der 48-h-Liste hängen). */
  const nachgefasst = () => aendereCrm(b => ({ ...b, teilnahmen: b.teilnahmen.map(t => (t.eventId === eventId && t.kontaktId === kontaktId && !t.followUpAm ? { ...t, followUpAm: begegnungsTag, geaendert: jetztIso, geaendertVon: ctx.person } : t)) }), ctx.wer);
  /** Label an der Person (einmal) — z. B. „Lead prüfen“. */
  const labelSetzen = (label: string) => aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    return { ...f, kontakte: f.kontakte.map(k => (k.id === kontaktId && !k.eingeschraenkt && !(k.labels ?? []).includes(label) ? { ...k, labels: [...(k.labels ?? []), label], geaendertAm: heute } : k)) };
  }, ctx.wer);
  /**
   * Der Lead-Status: eine neue Person aus „Netzwerken“ ist angesprochen — sie soll in „In Arbeit“ stehen, nicht unter „Neu“ verschwinden.
   * Ziel „Kontaktiert“ (bei „Qualifizieren“: „Qualifizierung“). Bestehende aktive Status bleiben; Kein Fit, Ruht, SQL und Kunde ebenfalls,
   * und eine Firma ohne Vertrieb (Dienstleister, Investor, Wettbewerber) bekommt keinen Lead — dann ein Hinweis und das Label „Lead prüfen“.
   */
  const leadStellen = async () => {
    const ziel = e.schritt === 'qualifizieren' ? 'qualifizierung' as const : 'kontaktiert' as const;
    const firmaDa = kontakt0.firmaId ? (await ladeCrm()).firmen.find(x => x.id === kontakt0.firmaId) : undefined;
    const subjekt = firmaDa ? 'Firma' : 'Person';
    const ohneVertrieb = firmaDa && (firmaDa.rolle === 'dienstleister' || firmaDa.rolle === 'investor' || firmaDa.rolle === 'wettbewerb');
    const alt = firmaDa ? firmaDa.lead : kontakt0.lead;
    const grund = ohneVertrieb ? { dienstleister: 'Dienstleister', investor: 'Investor', wettbewerb: 'Wettbewerber' }[firmaDa!.rolle as 'dienstleister' | 'investor' | 'wettbewerb']
      : alt && (alt.status === 'kein_fit' || alt.status === 'ruht' || alt.status === 'sql') ? { kein_fit: 'Kein Fit', ruht: 'Ruht', sql: 'SQL' }[alt.status] : null;
    if (grund) {
      hinweise.push(`${subjekt} ist als „${grund}“ geführt — Lead nicht geändert.`);
      await labelSetzen(LABEL_LEAD_PRUEFEN);
      return;
    }
    const aenderbar = !alt || alt.status === 'neu' || (ziel === 'qualifizierung' && (alt.status === 'kontaktiert' || alt.status === 'im_gespraech'));
    if (!aenderbar) return; // bestehender aktiver Status (oder Kunde) bleibt
    const stelle = (a: Kontakt['lead'] | Firma['lead']) => ({ ...(a ?? { kriterien: leereKriterien() }), status: ziel, geaendert: jetztIso, geaendertVon: ctx.person });
    if (firmaDa) await aendereCrm(b => ({ ...b, firmen: b.firmen.map(x => (x.id === firmaDa.id ? { ...x, lead: stelle(x.lead), geaendert: jetztIso } : x)) }), ctx.wer);
    else await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      return { ...f, kontakte: f.kontakte.map(k => (k.id === kontaktId && !k.eingeschraenkt ? { ...k, lead: stelle(k.lead), geaendertAm: heute } : k)) };
    }, ctx.wer);
  };
  await schritt('schritt', async () => {
    const frist = followupFrist(begegnungsTag);
    await leadStellen();
    switch (e.schritt) {
      case 'followup': {
        await aendereCrm(b => {
          const id = `fu-${e.erfassungId}`;
          if ((b.followups ?? []).some(x => x.id === id)) return b;
          const text = `Nachfassen nach „${event.titel}“${e.info ? `: ${e.info.replace(/\s+/g, ' ')}` : ''}`.slice(0, 300);
          const fu = neuesFollowUp({ id, bezug: { art: 'event', id: eventId }, kontaktId, art: 'nachricht', text, faellig: e.followup?.faellig ?? frist, quelle: 'event', zustaendig: e.zustaendig }, kontakt0, ctx.person, jetztIso);
          return { ...b, followups: [...(b.followups ?? []), { ...fu, geaendertVon: ctx.person }] };
        }, ctx.wer);
        break;
      }
      case 'qualifizieren': break; // der Lead-Status steht oben (`leadStellen`, Ziel „Qualifizierung“)
      case 'vermitteln': {
        // Dieselbe Logik wie „Vermitteln“ in der Kontaktakte (Paket B): ein Deal der Art „Vermittlung“ über den EINEN Anlageweg.
        const id = `ch-nw-${e.erfassungId}`;
        if ((await ladeCrm()).chancen.some(c => c.id === id)) break;
        const r = await dealAnlegen({
          id, art: 'vermittlung', kontaktIds: [kontaktId], wert: { betrag: 0, basis: 'einmalig' }, schritt: { text: `Vermitteln an ${e.vermitteln!.an}`, datum: frist },
          quelle: 'event', quelleBezug: eventId, besitzer: e.zustaendig, trotzdem: true,
          notiz: [`Kennengelernt bei „${event.titel}“ (Netzwerken).`, ...(e.info ? [`Info: ${e.info}`] : [])].join('\n'),
        }, ctx.person, jetztIso, ctx.wer);
        if (!r.ok) throw new ErfassungFehler(r.fehler, r.status);
        break;
      }
      case 'makeone': {
        // Wie „Make.One einladen“ in der Kontaktakte: Gast für ein KOMMENDES Event vormerken (Teilnahme „vorgemerkt“), der Einladungsweg
        // folgt der Ampel (Mail nur bei grün, sonst persönlich) — gesendet wird nichts. Ohne wählbares Event: Aufgabe + Label als Vormerkung.
        // Eine Person mit Werbesperre (Art. 21) wird NICHT vorgemerkt — weder als Gast noch als Aufgabe/Label: das wäre die Einladung, die sie ausgeschlossen hat.
        if (kontakt0.werbesperre) { hinweise.push('Werbesperre — nicht für Make.One vorgemerkt (Widerspruch, Art. 21 DSGVO).'); makeoneGesperrt = true; break; }
        const crmJetzt = await ladeCrm();
        const ziel = e.makeone?.eventId ? crmJetzt.events.find(x => x.id === e.makeone!.eventId && x.id !== eventId && !istNetzwerkenEvent(x) && x.datum >= heute && (x.status === 'idee' || x.status === 'geplant' || x.status === 'einladung')) : undefined;
        if (ziel) {
          const kx = kontextAus(crmJetzt, heute);
          const einl = kanalStatus(kontakt0, 'einladung', { hatMandat: kx.mitMandat.has(kontaktId), hatChance: kx.mitChance.has(kontaktId) });
          // EIN Weg (`gastVormerken`, lib/crm/eventplanung.ts) — dieselbe Teilnahme wie in der Kontaktakte, mit Herkunft und Nachfass-Stempel.
          await aendereCrm(b => gastVormerken(b, { id: `t-nwm-${e.erfassungId}`, eventId: ziel.id, kontaktId, weg: einladungswegAus(einl.farbe), einladenDurch: e.zustaendig, jetztIso, person: ctx.person,
            herkunft: { art: 'netzwerken', eventId, erfassungId: e.erfassungId }, nachgefasst: begegnungsTag }).bestand, ctx.wer);
          makeoneEventId = ziel.id;
          await angabeAendern(a => ({ ...a, makeone: { eventId: ziel.id } }));
          break;
        }
        await aufgabeAnlegen(`Zu ${MARKE_EVENTS} einladen: ${name}`, frist);
        const label = `${MARKE_EVENTS}-Einladung`;
        await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
          const f = cur ?? { kontakte: [] };
          return { ...f, kontakte: f.kontakte.map(k => (k.id === kontaktId && !k.eingeschraenkt && !(k.labels ?? []).includes(label) ? { ...k, labels: [...(k.labels ?? []), label], geaendertAm: heute } : k)) };
        }, ctx.wer);
        break;
      }
      case 'andere': {
        await aufgabeAnlegen(e.andere!.text, e.andere?.faellig ?? frist);
        break;
      }
      case 'angebot': {
        const id = `ang-nw-${e.erfassungId}`;
        angebotId = id;
        const da = (await ladeCrm()).angebote?.some(a => a.id === id);
        if (!da) {
          try { await angebotSpeichern({ id, felder: { kontaktId, ...(kontakt0.firmaId ? { firmaId: kontakt0.firmaId } : {}), titel: `Angebot für ${name}` }, person: ctx.person, haushalt: ctx.haushalt, wer: ctx.wer, jetzt }); }
          catch (err) { throw new ErfassungFehler(err instanceof Error ? err.message : 'Das Angebot ließ sich nicht anlegen.', (err as { status?: number })?.status ?? 500); }
        }
        break;
      }
      default: break; // 'termin' (eigener Schritt) und 'nur-kontakt' (nichts)
    }
    if (e.schritt === 'angebot' || e.schritt === 'vermitteln' || (e.schritt === 'makeone' && !makeoneGesperrt)) await nachgefasst();
  });

  // ── termin ──
  let terminSchluessel = (await journalLesen(h, e.erfassungId))?.terminSchluessel;
  if (e.schritt === 'termin' && e.termin && e.ohneTermin) {
    // „Ohne Termin abschließen“: der Termin ging nicht (kein Kalender, iCloud weg) — stattdessen ein Follow-up zum nächsten Werktag,
    // damit die Person nicht verloren geht. Aus dem Schritt „Termin“ wird an der Teilnahme „Follow-up“ (Bericht, Danke-Mail).
    await schritt('termin', async () => {
      await aendereCrm(b => {
        const id = `fu-${e.erfassungId}`;
        if ((b.followups ?? []).some(x => x.id === id)) return b;
        const text = `Termin vereinbaren — kennengelernt bei „${event.titel}“${e.info ? `: ${e.info.replace(/\s+/g, ' ')}` : ''}`.slice(0, 300);
        const fu = neuesFollowUp({ id, bezug: { art: 'event', id: eventId }, kontaktId, art: 'nachricht', text, faellig: followupFristEinTag(begegnungsTag), quelle: 'event', zustaendig: e.zustaendig }, kontakt0, ctx.person, jetztIso);
        return { ...b, followups: [...(b.followups ?? []), { ...fu, geaendertVon: ctx.person }] };
      }, ctx.wer);
      await angabeAendern(({ terminAm: _a, terminId: _i, ...rest }) => ({ ...rest, schritt: 'followup' }));
      hinweise.push('Ohne Termin abgeschlossen — stattdessen steht ein Follow-up „Termin vereinbaren“ für den nächsten Werktag bereit.');
    });
  } else if (e.schritt === 'termin' && e.termin) {
    const t = e.termin;
    const r = await schritt('termin', async () => {
      const einst = await ladeEinstellungen();
      const kalender = (einst.kalender as Record<string, string | undefined>)[e.zustaendig];
      if (!kalender || e.zustaendig === 'beide') throw new ErfassungFehler(`Für diese Person ist in den Kalender-Einstellungen kein Kalender hinterlegt — der Termin wurde nicht angelegt.`, 409, { teilweise: true });
      const ende = wandPlusMinuten(t.start, t.dauer);
      // Ist die Zeit noch frei? Nur ein Hinweis (der Termin steht dann trotzdem) — kein Netz-/Kalenderfehler bricht die Erfassung.
      try {
        const grund = await terminKonflikt({ person: e.zustaendig, start: t.start, ende, dauer: t.dauer, jetzt });
        if (grund) hinweise.push(grund);
      } catch { /* ohne Kalenderstand keine Prüfung */ }
      const titel = `${terminArtLabel(t.art)} · ${name}`.slice(0, 300);
      const notiz = [`Netzwerken: kennengelernt bei „${event.titel}“.`, ...(e.info ? [`Info: ${e.info}`.slice(0, 500)] : [])].join('\n');
      let angelegt;
      try {
        angelegt = await terminAnlegenServer({ titel, start: `${t.start}:00`, ende: `${ende}:00`, wer: e.zustaendig as KalenderWer, kalender, art: 'termin', beschaeftigt: true, notiz, uid: `makeos-t-nw-${e.erfassungId}`, bezug: { kontaktId }, von: ctx.person }, ctx.wer);
      } catch (err) {
        if (err instanceof KalenderFehler) throw new ErfassungFehler(err.message, err.status >= 500 ? 502 : err.status, { teilweise: true });
        throw err;
      }
      // Erst jetzt, wo der Termin im Kalender steht, trägt die Teilnahme ihn — und die Begegnung gilt als nachgefasst.
      await angabeAendern(a => ({ ...a, terminAm: t.start, terminId: angelegt.schluessel }), x => (x.followUpAm ? {} : { followUpAm: begegnungsTag }));
      // Meeting-Aktivität wie K3 (Zeit liest die Akte aus dem Termin) — idempotent.
      await terminAktivitaetenSetzen({ id: angelegt.schluessel, uid: angelegt.uid, titel, start: `${t.start}:00`, kontaktIds: [kontaktId], von: ctx.person }, ctx.wer, jetzt).catch(() => { hinweise.push('Die Aktivität im CRM entsteht beim nächsten Abgleich.'); });
      return angelegt;
    }, a => ({ terminSchluessel: a.schluessel }));
    if (r) terminSchluessel = r.schluessel;
  }
  /** Was die Erfassung am Ende wirklich ist (ohne Termin → Follow-up) — für Meldung und Antwort. */
  const wirklichTermin = e.schritt === 'termin' && !!e.termin && !e.ohneTermin;
  const wirklichSchritt = e.schritt === 'termin' && e.ohneTermin ? 'followup' as const : e.schritt;

  // ── melden ──
  await schritt('melden', async () => {
    // „Andere“ und Make.One ohne Event sind Aufgaben: die meldet der Aufgaben-Schreibweg schon („hat dir … zugewiesen“) — keine zweite Meldung.
    if (e.zustaendig === ctx.person || e.schritt === 'andere' || (e.schritt === 'makeone' && !e.makeone?.eventId)) return;
    const namen = new Map((await kontenDesHaushalts(h)).map(k => [k.speicher, k.name]));
    const von = txt(namen.get(ctx.person) ?? ctx.person, 60);
    let titel: string, link: string;
    if (wirklichTermin && e.termin) {
      titel = `${von} hat dir einen Termin gebucht: ${terminArtLabel(e.termin.art)} mit ${name}, ${datumKurz(e.termin.start)} um ${e.termin.start.slice(11, 16)} Uhr`;
      link = terminSchluessel ? WEG.termin(terminSchluessel, e.termin.start.slice(0, 10)) : WEG.kalender(e.termin.start.slice(0, 10));
    } else {
      titel = `${von} hat dir ${name} (${event.titel}) zugeteilt — nächster Schritt: ${schrittLabel(wirklichSchritt)}${e.ohneTermin ? ' (Termin vereinbaren)' : ''}`;
      // Der Sprung geht zu dem, was die Erfassung angelegt hat (Deal, Angebot, Follow-up …), sonst zur Person (M10).
      link = ergebnisZiel({ schritt: wirklichSchritt, erfassungId: e.erfassungId, kontaktId });
    }
    await melde({ an: e.zustaendig, art: 'netzwerken', titel: titel.slice(0, 300), link, von: ctx.person, bezug: { art: 'netzwerken', id: e.erfassungId } });
  });

  // Abschluss: Kennungen aus dem Journal räumen.
  await journalAendern(h, e.erfassungId, x => { const { kontaktId: _k, terminSchluessel: _t, ...rest } = x; return { ...rest, fertig: jetztIso }; }, jetzt);

  return {
    ok: true, kontaktId, neu: neuAngelegt, ...(kontaktResultat?.zusammengefuehrt ? { zusammengefuehrt: true } : {}), eventId: eventId,
    ...(terminSchluessel && wirklichTermin ? { terminUid: terminSchluessel, ...(e.termin ? { terminTag: e.termin.start.slice(0, 10) } : {}) } : {}), ...(angebotId ? { angebotId } : {}), ...(makeoneEventId ? { makeoneEventId } : {}), ...(istNetzwerkenEvent(event) ? { eventBesuch: true } : {}),
    ...(wirklichSchritt === 'vermitteln' ? { dealId: `ch-nw-${e.erfassungId}` } : {}), ...(wirklichSchritt === 'followup' ? { followupId: `fu-${e.erfassungId}` } : {}), hinweise,
  };
}

const tagPlusLokal = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Die Kartei zum Vergleichen (ohne eingeschränkte Personen — die zählen nie als Treffer). */
async function kontakteLesen(): Promise<Kontakt[]> {
  const { kontakteFuerVerarbeitung } = await import('./verarbeitung');
  return kontakteFuerVerarbeitung();
}

/** Eine Person der Kartei lesen (Art. 18 prüft der Aufrufer). */
async function ladeKontakt(id: string): Promise<Kontakt | undefined> {
  const { kontakteFuerVerarbeitung } = await import('./verarbeitung');
  // Eingeschränkte Personen fehlen hier absichtlich — „nicht gefunden“ und „eingeschränkt“ führen zum selben Abbruch.
  return (await kontakteFuerVerarbeitung()).find(k => k.id === id);
}

function uebersetzen(err: unknown): ErfassungFehler {
  if (err instanceof AblageFehler) return new ErfassungFehler(err.message, err.status);
  return new ErfassungFehler('Die Dateiablage ist gerade nicht erreichbar.', 502);
}

// ── Termin: belegt oder außerhalb der Arbeitszeit? ───────────────────────────

/**
 * Warum passt die Zeit vielleicht nicht? Ein Satz oder null. Unterscheidet Feiertag, „außerhalb der Arbeitszeit“ und „belegt“
 * (ein anderer Termin, Abwesenheit oder eine gehaltene Buchung) — vorher stand für alles derselbe Satz. Nur ein Hinweis.
 */
export async function terminKonflikt(a: { person: string; start: string; ende: string; dauer: number; jetzt: Date }): Promise<string | null> {
  const tag = a.start.slice(0, 10);
  const s = `${a.start}:00`, e = `${a.ende}:00`;
  const v = await verfuegbarkeitFuer(a.person, tag, tagPlus(tag, 1));
  const t = v.tage.find(x => x.tag === tag);
  if (t?.feiertag) return `Der ${tag.slice(8, 10)}.${tag.slice(5, 7)}. ist ein Feiertag (${t.feiertag}) — bitte im Kalender prüfen.`;
  const belegt = belegungenAus(v).some(b => b.start < e && b.ende > s);
  if (belegt) return 'Die Zeit ist belegt — sie überschneidet sich mit einem anderen Termin oder einer Abwesenheit. Bitte im Kalender prüfen.';
  const az = arbeitszeitAus(v)[tag] ?? [];
  if (!az.some(x => x.start <= s && x.ende >= e)) return 'Die Zeit liegt außerhalb der Arbeitszeit — bitte im Kalender prüfen.';
  // Weder belegt noch außerhalb: noch eine gehaltene Buchung oder ein krummes Raster?
  const frei = await freieZeitFuer({ personen: [a.person], dauerMin: a.dauer, von: tag, tage: 1, rasterMin: 5, grenze: 400, jetzt: a.jetzt });
  return istFrei(s, e, frei.vorschlaege) ? null : 'Die Zeit ist belegt (gehaltene Buchung) — bitte im Kalender prüfen.';
}

// ── Danke-Mail: „ist raus“ ───────────────────────────────────────────────────

/**
 * Die Danke-Mail wurde im Mail-Programm geschickt — die Person bestätigt es mit einem Klick. Vermerkt: `danke.rausAm` an der
 * Teilnahme, `followUpAm` (zählt als nachgefasst, wenn noch nichts da war) und eine Aktivität „Mail“ OHNE Folgen für Stufe
 * und Wiedervorlage (eine Danke-Mail ist keine Akquise-Mail). Nur die Person, die die Karte erfasst hat.
 */
export async function dankeRausVermerken(a: { eventId: string; kontaktId: string; anrede?: 'Du' | 'Sie'; person: string; wer: Wer; jetzt?: Date }): Promise<{ ok: true; schonDa?: boolean } | { ok: false; status: number; fehler: string }> {
  const jetzt = a.jetzt ?? new Date();
  const heute = localDay(jetzt), jetztIso = jetzt.toISOString();
  let fehler: { status: number; fehler: string } | null = null;
  let schonDa = false;
  let eventTitel = '';
  await aendereCrm(b => {
    const t = b.teilnahmen.find(x => x.eventId === a.eventId && x.kontaktId === a.kontaktId);
    if (!t?.netzwerken) { fehler = { status: 404, fehler: 'Zu dieser Person gibt es keine Erfassung bei diesem Event.' }; return b; }
    if (t.netzwerken.erfasstVon !== a.person) { fehler = { status: 403, fehler: 'Die Danke-Mail schickt, wer die Person kennengelernt hat.' }; return b; }
    if (t.netzwerken.danke?.rausAm) { schonDa = true; return b; }
    eventTitel = b.events.find(x => x.id === a.eventId)?.titel ?? '';
    const danke = { ...(a.anrede ?? t.netzwerken.danke?.anrede ? { anrede: (a.anrede ?? t.netzwerken.danke?.anrede) as 'Du' | 'Sie' } : {}), rausAm: heute };
    return { ...b, teilnahmen: b.teilnahmen.map(x => (x === t ? { ...x, ...(x.followUpAm ? {} : { followUpAm: heute }), netzwerken: { ...t.netzwerken!, danke }, geaendert: jetztIso, geaendertVon: a.person } : x)) };
  }, a.wer);
  if (fehler) return { ok: false, ...(fehler as { status: number; fehler: string }) };
  if (schonDa) return { ok: true, schonDa: true };
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    return { ...f, kontakte: f.kontakte.map(k => {
      if (k.id !== a.kontaktId || k.eingeschraenkt) return k;
      const neu = wendeAktivitaetAn(k, { art: 'mail', text: `Danke-Mail nach „${eventTitel}“ — im Mail-Programm geöffnet und als verschickt bestätigt`, von: a.person, bezug: a.eventId, stufe: k.stufe, wiedervorlage: k.wiedervorlage }, heute, jetztIso, tagPlusLokal);
      // Eine Danke-Mail ändert weder die Stufe noch die Wiedervorlage.
      return { ...neu, stufe: k.stufe, wiedervorlage: k.wiedervorlage };
    }) };
  }, a.wer);
  return { ok: true };
}

/** Freie Zeiten der Person für die nächsten Werktage — nur Zeiten (maskiert), höchstens `proTag` je Tag, gleichmäßig verteilt. */
export async function freieVorschlaege(a: { person: string; dauer: number; werktage?: number; proTag?: number; jetzt?: Date }): Promise<{ tag: string; zeiten: { start: string; ende: string }[] }[]> {
  const jetzt = a.jetzt ?? new Date();
  const r = await freieZeitFuer({ personen: [a.person], dauerMin: a.dauer, von: localDay(jetzt), tage: 21, rasterMin: 30, grenze: 800, jetzt, vorlaufMin: 30 });
  const werktage = a.werktage ?? 10, proTag = a.proTag ?? 6;
  const jeTag = new Map<string, { start: string; ende: string }[]>();
  for (const f of r.vorschlaege) { if (r.feiertage[f.tag]) continue; jeTag.set(f.tag, [...(jeTag.get(f.tag) ?? []), { start: f.start.slice(0, 16), ende: f.ende.slice(0, 16) }]); }
  return Array.from(jeTag.entries()).sort((x, y) => x[0].localeCompare(y[0])).slice(0, werktage).map(([tag, l]) => {
    if (l.length <= proTag) return { tag, zeiten: l };
    const schritt = (l.length - 1) / (proTag - 1);
    return { tag, zeiten: Array.from({ length: proTag }, (_, i) => l[Math.round(i * schritt)]) };
  });
}

// ─── Netzwerken — Erfassen (Server, 02.10.) ──────────────────────────────────
// EINE Erfassung (Karte, Felder, nächster Schritt, Info, Sprachnotiz) wirkt in mehreren Beständen. Sie läuft in festen,
// einzeln abgehakten Schritten — jeder ist idempotent, und das Journal (`netzwerken-erfassungen--<haushalt>`) hält fest,
// welcher schon getan ist. Die Kennung der Erfassung (UUID) kommt vom Browser; derselbe Körper ein zweites Mal (Netz weg,
// Warteschlange, Doppelklick) tut nichts doppelt, ein abgebrochener Lauf macht beim ersten offenen Schritt weiter:
//
//   event     das Event anlegen, wenn es unterwegs ohne Netz entstand (`eventNeu`); ein Event von heute/früher gilt danach als
//             „durchgeführt“ — so zählen Event-Kennzahlen und Traktions-Index (Teilnahme „da“)
//   firma     bestehende Firma verknüpfen (Name ohne Rechtsform oder Kennung) — sonst neu, mit fester Kennung (nie zwei)
//   kontakt   neue Person: feste Kennung `c-<Erfassungs-UUID>`, Quelle „Netzwerken“, Herkunft „Veranstaltung“, Typ „Netzwerk“,
//             Beziehung bei der zuständigen Person, Sperrliste, Datenschutz-Stempel — und NIE ein Eintrag in `einwilligungen`
//             (eine Visitenkarte ist keine Einwilligung, § 7 UWG). Gleiche Mail/Nummer wie eine bestehende Person (ohne
//             `neuErzwingen`): nicht doppelt anlegen, die Erfassung hängt an der bestehenden. Art. 18 → 409.
//   dateien   Fotos der Karte und die Sprachnotiz verschlüsselt in der Dateiablage am Kontakt (Art. 17: fällt mit der Person)
//   teilnahme Teilnahme „da“ am Event + `netzwerken` (Schritt, Zuständigkeit, Info) — Quelle von Abendbericht und Danke-Mail
//   verlauf   Aktivität „Kennengelernt bei <Event>“ (+ Vermerk „keine Einwilligung“ bei neuer Person), Sprachnotiz-Aktivität
//   schritt   je nach Wahl: Follow-up (FollowUp) · Qualifizieren (Lead-Status) · Vermitteln/Andere/Make.One (Aufgabe mit Bezug)
//             · Angebot (Entwurf im Angebots-Tool) · Nur Kontakt (nichts) · Termin (eigener Schritt unten)
//   termin    Termin im Kalender der ZUSTÄNDIGEN Person (feste UID, ohne Gäste/Einladung) + Meeting-Aktivität wie K3
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
import { angebotSpeichern } from './angebot-server';
import { terminAktivitaetenSetzen } from './termin-aktivitaet-server';
import { MARKE_EVENTS } from './marke';
import { kenntWirSchon, neuesEvent, followupFrist, wandPlusMinuten, schrittLabel, terminArtLabel, stadtAusAnschrift, NETZWERKEN_QUELLE, KEINE_EINWILLIGUNG, type Erfassung } from './netzwerken';
import type { Firma, NetzwerkenAngabe } from './typen';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { ablageListe, ablegen, AblageFehler } from '@/lib/dateien/ablage';
import { typErkennen, sprachnotizTypErkennen, dateinameSaeubern, SPRACHNOTIZ_TYPEN } from '@/lib/dateien/regeln';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { terminAnlegenServer } from '@/lib/kalender/termin-server';
import { ladeEinstellungen, type Wer as KalenderWer } from '@/lib/kalender/einstellungen';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { freieZeitFuer } from '@/lib/kalender/freie-zeit';
import { istFrei } from '@/lib/kalender/verfuegbar';
import { melde } from '@/lib/meldungen/melden';
import { localDay } from '@/lib/zeit';
import { tagVon, wandzeit } from '@/lib/kalender/zeit';
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
export interface JournalEintrag { id: string; angelegt: string; schritte: string[]; fertig?: string; kontaktId?: string; terminSchluessel?: string }
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
  angebotId?: string;
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

  const vorher = await journalLesen(h, e.erfassungId);
  if (vorher?.fertig) return { ok: true, schonDa: true, eventId: e.eventId, hinweise: [] };

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
  await schritt('event', async () => {
    let fehlt = false;
    await aendereCrm(b => {
      const ev = b.events.find(x => x.id === e.eventId);
      if (!ev) {
        if (!e.eventNeu) { fehlt = true; return b; }
        const neu = neuesEvent({ id: e.eventId, titel: e.eventNeu.titel, datum: e.eventNeu.datum, ...(e.eventNeu.ort ? { ort: e.eventNeu.ort } : {}), person: ctx.person, heute, jetztIso });
        return { ...b, events: [...b.events, neu] };
      }
      // Wer „Heute bei“ wählt, ist dort: ein Event von heute oder früher, das noch „geplant“ steht, gilt als durchgeführt.
      if (ev.datum <= heute && (ev.status === 'geplant' || ev.status === 'einladung' || ev.status === 'idee')) {
        return { ...b, events: b.events.map(x => (x.id === ev.id ? { ...x, status: 'durchgefuehrt' as const, geaendert: jetztIso, geaendertVon: ctx.person } : x)) };
      }
      return b;
    }, ctx.wer);
    if (fehlt) throw new ErfassungFehler('Das Event gibt es nicht (mehr) — bitte „Heute bei“ neu wählen.', 404);
  });
  const crm0 = await ladeCrm();
  const event = crm0.events.find(x => x.id === e.eventId);
  if (!event) throw new ErfassungFehler('Das Event gibt es nicht (mehr) — bitte „Heute bei“ neu wählen.', 404);

  const nameDa = e.vorhandenKontaktId !== undefined;
  const firmaName = e.kontakt.firma;

  // ── firma ── (nur für neue Personen; an einer bestehenden Person bleibt ihre Firma, wie sie ist)
  await schritt('firma', async () => {
    if (nameDa || !firmaName) return;
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
  const eigeneId = `c-${e.erfassungId}`;
  const kontaktResultat = await schritt('kontakt', async () => {
    const sperrEintraege = nameDa ? [] : await sperrlisteLaden();
    let r: { id: string; neu: boolean; zusammengefuehrt?: boolean; hinweis?: string } = { id: e.vorhandenKontaktId ?? eigeneId, neu: false };
    let fehler: ErfassungFehler | null = null;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      if (nameDa) {
        const k = f.kontakte.find(x => x.id === e.vorhandenKontaktId);
        if (!k) { fehler = new ErfassungFehler('Die gewählte Person gibt es nicht mehr.', 404); return f; }
        if (k.eingeschraenkt) { fehler = new ErfassungFehler('Diese Person ist eingeschränkt (Art. 18) — sie wird nicht verarbeitet.', 409, { eingeschraenkt: true }); return f; }
        r = { id: k.id, neu: false };
        return f;
      }
      if (f.kontakte.some(x => x.id === eigeneId)) { r = { id: eigeneId, neu: true }; return f; } // Abbruch zwischen Wirkung und Abhaken
      // Gleiche Mail/Nummer: nicht doppelt anlegen (außer „trotzdem neu“) — auch wenn die Prüfung am Handy ohne Netz entfiel.
      if (!e.neuErzwingen) {
        const t = kenntWirSchon({ vorname: e.kontakt.vorname, nachname: e.kontakt.nachname, firma: e.kontakt.firma, email: e.kontakt.email, telefon: e.kontakt.telefon, mobil: e.kontakt.mobil }, f.kontakte.filter(x => !x.eingeschraenkt), 1)[0];
        if (t && (t.staerke === 'mail' || t.staerke === 'telefon')) {
          r = { id: t.kontakt.id, neu: false, zusammengefuehrt: true, hinweis: `${anzeigename(t.kontakt)} gab es schon (${t.grund}) — die Erfassung hängt an dieser Person, es entstand keine zweite.` };
          return f;
        }
      }
      const d: VisitenkartenDaten = { vorname: e.kontakt.vorname, nachname: e.kontakt.nachname, firma: e.kontakt.firma, position: e.kontakt.position, email: e.kontakt.email, telefon: e.kontakt.telefon, mobil: e.kontakt.mobil, linkedin: e.kontakt.linkedin, webseite: e.kontakt.webseite };
      const stadt = stadtAusAnschrift(e.kontakt.anschrift);
      const roh = kontaktAusKarte(d, { id: eigeneId, heute, jetzt: e.erfasstAm, von: e.zustaendig, herkunft: 'veranstaltung', ...(firma ? { firma: { id: firma.id, name: firma.name } } : {}), anlass: `Per Visitenkarte erfasst — Netzwerken: ${event.titel}` });
      const mitZusatz: Kontakt = {
        ...roh, quelle: NETZWERKEN_QUELLE, typ: 'Netzwerk', anrede: e.kontakt.anrede ?? 'Sie',
        ...(stadt ? { firmaStadt: stadt } : {}),
        // Es gibt kein Anschrift-Feld an der Person — die Zeilen der Karte stehen in der Notiz (sichtbar in der Akte).
        ...(e.kontakt.anschrift ? { notiz: `Anschrift (Visitenkarte): ${e.kontakt.anschrift.split('\n').join(', ')}` } : {}),
      };
      const sperre = neuanlageSperre(mitZusatz, sperrEintraege, heute);
      const namen = new Map(firmenJetzt.map(x => [x.id, x.name]));
      const fertig = serverStempel(bezuegeSynchron(datenschutzStempeln(sperre.kontakt, undefined, ctx.person, jetztIso, heute), undefined, heute, id => namen.get(id)), undefined, heute);
      r = { id: eigeneId, neu: true, ...(sperre.hinweis ? { hinweis: sperre.hinweis } : {}) };
      return { ...f, kontakte: [...f.kontakte, fertig] };
    }, ctx.wer);
    if (fehler) throw fehler;
    return r;
  }, r => ({ kontaktId: r.id }));
  const jetztJournal = await journalLesen(h, e.erfassungId);
  const kontaktId = kontaktResultat?.id ?? jetztJournal?.kontaktId ?? e.vorhandenKontaktId ?? eigeneId;
  if (kontaktResultat?.hinweis) hinweise.push(kontaktResultat.hinweis);
  const neuAngelegt = kontaktResultat ? kontaktResultat.neu : !nameDa && kontaktId === eigeneId;

  const kontakt0 = (await ladeKontakt(kontaktId));
  if (!kontakt0) throw new ErfassungFehler('Die Person gibt es nicht mehr.', 404);
  if (kontakt0.eingeschraenkt) throw new ErfassungFehler('Diese Person ist eingeschränkt (Art. 18) — sie wird nicht verarbeitet.', 409, { eingeschraenkt: true });
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
    ...(e.info ? { info: e.info } : {}), ...(e.schritt === 'termin' && e.termin ? { terminAm: e.termin.start } : {}),
    ...(e.kontakt.anrede ? { danke: { anrede: e.kontakt.anrede } } : {}),
  };
  await schritt('teilnahme', async () => {
    await aendereCrm(b => {
      const i = b.teilnahmen.findIndex(t => t.eventId === e.eventId && t.kontaktId === kontaktId);
      if (i >= 0) {
        const t = b.teilnahmen[i];
        if (t.netzwerken?.erfassungId === e.erfassungId) return b;
        // Zweite Begegnung beim selben Event: die neuere Angabe gilt, eine schon bestätigte Danke-Mail bleibt vermerkt.
        const danke = t.netzwerken?.danke?.rausAm ? { ...(angabe.danke ?? {}), rausAm: t.netzwerken.danke.rausAm } : angabe.danke;
        const neu = { ...t, status: 'da' as const, ...(t.eingechecktVon ? {} : { eingechecktVon: ctx.person }), ...(t.einladenDurch ? {} : { einladenDurch: e.zustaendig }),
          ...(e.info && !t.notiz ? { notiz: e.info.slice(0, 1500) } : {}), netzwerken: { ...angabe, ...(danke ? { danke } : {}) }, geaendert: jetztIso, geaendertVon: ctx.person };
        return { ...b, teilnahmen: b.teilnahmen.map((x, j) => (j === i ? neu : x)) };
      }
      return { ...b, teilnahmen: [...b.teilnahmen, { id: `t-${e.erfassungId}`, eventId: e.eventId, kontaktId, status: 'da' as const, rolle: 'gast' as const, einladenDurch: e.zustaendig, eingechecktVon: ctx.person, ...(e.info ? { notiz: e.info.slice(0, 1500) } : {}), netzwerken: angabe, geaendert: jetztIso, geaendertVon: ctx.person }] };
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
      const schon = (art: string, marker: string) => k.aktivitaeten.some(a => a.art === art && a.am === e.erfasstAm && a.bezug === e.eventId && (a.text ?? '').includes(marker));
      if (!schon('event', 'Kennengelernt bei')) k = wendeAktivitaetAn(k, { art: 'event', text: text.slice(0, 2900), von: ctx.person, bezug: e.eventId }, erfasstTag > heute ? heute : erfasstTag, e.erfasstAm, tagPlusLokal);
      if (e.sprachnotiz && !schon('notiz', 'Sprachnotiz')) k = wendeAktivitaetAn({ ...k }, { art: 'notiz', text: `Sprachnotiz aufgenommen — Abschrift folgt (KI)${e.sprachnotiz.dauerSek ? ` · ${Math.floor(e.sprachnotiz.dauerSek / 60)}:${String(e.sprachnotiz.dauerSek % 60).padStart(2, '0')} min` : ''}`, von: ctx.person, bezug: e.eventId }, erfasstTag > heute ? heute : erfasstTag, e.erfasstAm, tagPlusLokal);
      return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? k : x)) };
    }, ctx.wer);
  });

  // ── schritt ──
  let angebotId: string | undefined;
  await schritt('schritt', async () => {
    const frist = followupFrist(erfasstTag > heute ? heute : erfasstTag);
    switch (e.schritt) {
      case 'followup': {
        await aendereCrm(b => {
          const id = `fu-${e.erfassungId}`;
          if ((b.followups ?? []).some(x => x.id === id)) return b;
          const text = `Nachfassen nach „${event.titel}“${e.info ? `: ${e.info.replace(/\s+/g, ' ')}` : ''}`.slice(0, 300);
          const fu = neuesFollowUp({ id, bezug: { art: 'event', id: e.eventId }, kontaktId, art: 'nachricht', text, faellig: e.followup?.faellig ?? frist, quelle: 'event', zustaendig: e.zustaendig }, kontakt0, ctx.person, jetztIso);
          return { ...b, followups: [...(b.followups ?? []), { ...fu, geaendertVon: ctx.person }] };
        }, ctx.wer);
        break;
      }
      case 'qualifizieren': {
        const stelle = (alt: Kontakt['lead'] | Firma['lead']) => (alt && !['neu', 'kontaktiert', 'im_gespraech'].includes(alt.status) ? alt : { ...(alt ?? { kriterien: leereKriterien() }), status: 'qualifizierung' as const, geaendert: jetztIso, geaendertVon: ctx.person });
        if (kontakt0.firmaId) {
          await aendereCrm(b => ({ ...b, firmen: b.firmen.map(x => (x.id === kontakt0.firmaId ? { ...x, lead: stelle(x.lead), geaendert: jetztIso } : x)) }), ctx.wer);
        } else {
          await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
            const f = cur ?? { kontakte: [] };
            return { ...f, kontakte: f.kontakte.map(k => (k.id === kontaktId && !k.eingeschraenkt ? { ...k, lead: stelle(k.lead), geaendertAm: heute } : k)) };
          }, ctx.wer);
        }
        break;
      }
      case 'vermitteln':
      case 'andere':
      case 'makeone': {
        const titel = e.schritt === 'vermitteln' ? `Vermitteln: ${name} an ${e.vermitteln?.an}` : e.schritt === 'andere' ? e.andere!.text : `Zu ${MARKE_EVENTS} einladen: ${name}`;
        const faellig = e.schritt === 'andere' && e.andere?.faellig ? e.andere.faellig : frist;
        await systemAufgabenAendern(stand => {
          const id = `nw-${e.erfassungId}`;
          if (stand.tasks.some(t => t.id === id)) return {};
          return { neu: [{
            id, title: titel.slice(0, 300), description: [`Kennengelernt bei „${event.titel}“ (Netzwerken).`, ...(e.info ? [`Info: ${e.info}`] : []), WEG.akte(kontaktId)].join('\n').slice(0, 4000),
            status: 'todo', priority: 'medium', assignee: e.zustaendig, tags: ['crm', 'netzwerken'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetztIso, updatedAt: jetztIso, dueDate: faellig, bezug: { kontaktId },
          }] };
        }, { person: ctx.person, wer: ctx.wer, jetzt: jetztIso });
        if (e.schritt === 'makeone') {
          // Vormerkung am Kontakt: das Label (frei vergebbar, filterbar) — die Aufgabe oben ist die Handlung.
          const label = `${MARKE_EVENTS}-Einladung`;
          await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
            const f = cur ?? { kontakte: [] };
            return { ...f, kontakte: f.kontakte.map(k => (k.id === kontaktId && !k.eingeschraenkt && !(k.labels ?? []).includes(label) ? { ...k, labels: [...(k.labels ?? []), label], geaendertAm: heute } : k)) };
          }, ctx.wer);
        }
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
  });

  // ── termin ──
  let terminSchluessel = (await journalLesen(h, e.erfassungId))?.terminSchluessel;
  if (e.schritt === 'termin' && e.termin) {
    const t = e.termin;
    const r = await schritt('termin', async () => {
      const einst = await ladeEinstellungen();
      const kalender = (einst.kalender as Record<string, string | undefined>)[e.zustaendig];
      if (!kalender || e.zustaendig === 'beide') throw new ErfassungFehler(`Für diese Person ist in den Kalender-Einstellungen kein Kalender hinterlegt — der Termin wurde nicht angelegt.`, 409, { teilweise: true });
      const ende = wandPlusMinuten(t.start, t.dauer);
      // Ist die Zeit noch frei? Nur ein Hinweis (der Termin steht dann trotzdem) — kein Netz-/Kalenderfehler bricht die Erfassung.
      try {
        const frei = await freieZeitFuer({ personen: [e.zustaendig], dauerMin: t.dauer, von: t.start.slice(0, 10), tage: 1, rasterMin: 5, grenze: 400, jetzt });
        if (!istFrei(`${t.start}:00`, `${ende}:00`, frei.vorschlaege)) hinweise.push('Die Zeit überschneidet sich mit einem anderen Termin oder liegt außerhalb der Arbeitszeit — bitte im Kalender prüfen.');
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
      // Meeting-Aktivität wie K3 (Zeit liest die Akte aus dem Termin) — idempotent.
      await terminAktivitaetenSetzen({ id: angelegt.schluessel, uid: angelegt.uid, titel, start: `${t.start}:00`, kontaktIds: [kontaktId], von: ctx.person }, ctx.wer, jetzt).catch(() => { hinweise.push('Die Aktivität im CRM entsteht beim nächsten Abgleich.'); });
      return angelegt;
    }, a => ({ terminSchluessel: a.schluessel }));
    if (r) terminSchluessel = r.schluessel;
  }

  // ── melden ──
  await schritt('melden', async () => {
    // Aufgaben-Schritte meldet der Aufgaben-Schreibweg schon („hat dir … zugewiesen“) — keine zweite Meldung.
    if (e.zustaendig === ctx.person || e.schritt === 'vermitteln' || e.schritt === 'andere' || e.schritt === 'makeone') return;
    const namen = new Map((await kontenDesHaushalts(h)).map(k => [k.speicher, k.name]));
    const von = txt(namen.get(ctx.person) ?? ctx.person, 60);
    let titel: string, link: string;
    if (e.schritt === 'termin' && e.termin) {
      titel = `${von} hat dir einen Termin gebucht: ${terminArtLabel(e.termin.art)} mit ${name}, ${datumKurz(e.termin.start)} um ${e.termin.start.slice(11, 16)} Uhr`;
      link = terminSchluessel ? WEG.termin(terminSchluessel, e.termin.start.slice(0, 10)) : WEG.kalender(e.termin.start.slice(0, 10));
    } else {
      titel = `${von} hat dir ${name} (${event.titel}) zugeteilt — nächster Schritt: ${schrittLabel(e.schritt)}`;
      link = WEG.akte(kontaktId);
    }
    await melde({ an: e.zustaendig, art: 'netzwerken', titel: titel.slice(0, 300), link, von: ctx.person, bezug: { art: 'netzwerken', id: e.erfassungId } });
  });

  // Abschluss: Kennungen aus dem Journal räumen.
  await journalAendern(h, e.erfassungId, x => { const { kontaktId: _k, terminSchluessel: _t, ...rest } = x; return { ...rest, fertig: jetztIso }; }, jetzt);

  return { ok: true, kontaktId, neu: neuAngelegt, ...(kontaktResultat?.zusammengefuehrt ? { zusammengefuehrt: true } : {}), eventId: e.eventId, ...(terminSchluessel ? { terminUid: terminSchluessel } : {}), ...(angebotId ? { angebotId } : {}), hinweise };
}

const tagPlusLokal = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

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

// ─── Kalender — Buchung als EIN CRM-Vorgang (Server, 29.09., Paket K4; R-K2 29.09.) ─
// Kevin: „Eine Buchung ist im CRM EIN Vorgang, keine Kopien.“ Zwei Abschnitte, jeder über das Absichtsprotokoll
// (lib/store/absichten.ts, Art „buchung“), weil sie nacheinander mehrere Bestände schreiben — jeder Schritt ist
// idempotent und wird nach getaner Arbeit abgehakt; bricht der Lauf ab, setzt `buchungFortsetzen` ihn fort
// (Start, Takt, Durchsicht über lib/store/absichten-fortsetzen.ts).
//
//   anfrage   (der Buchende hat auf seiner Status-Seite bestätigt)
//     melden    Glocke an die Person der Seite. SONST NICHTS — im CRM entsteht bis zur Freigabe kein Kontakt
//               (R-K2 #79: so steht es im Datenschutz-Hinweis; abgelehnte/abgelaufene Anfragen hinterlassen nichts).
//   freigabe  (Kevin oder Malin geben frei — vorher: erzwungener iCloud-Abgleich + „ist der Platz noch frei?“, #73)
//     kontakt   Anfrage über lib/crm/anfragen.ts `anfrageBauen` (Tag der Anfrage): Dublette über alle Adressen,
//               Sperrliste (`neuanlageSperre`), Einwilligung „Antwort auf Anfrage“ mit vollem Nachweis (Wortlaut,
//               Fassung, Beleg `buchung:<id>`, Zeitpunkt, erfasst von) — Nachweis-Text sagt, ob die E-Mail-Adresse
//               bestätigt ist (#76), Aktivität „Anfrage über Website: Terminbuchung …“, Lead → „kontaktiert“.
//               Werbesperre einer VORHANDENEN Person → nur verknüpfen; Art. 18 → nichts im CRM, Hinweis an der Buchung.
//               Kontakt-Kennung an die Buchung.
//     termin    fester Termin im Zielkalender (iCloud, lib/kalender/icloud.ts `anlegen`, Art „termin“, beschäftigt) — Gast
//               als Notiz ODER (K3) nach bestätigter Rückfrage als echte Einladung (ATTENDEE, iCloud verschickt;
//               Kennung als `gastKontakte`; unbestätigte Adresse nur nach dem Warnhinweis). FESTE UID je Buchung
//               (`buchungTerminUid`, F1 #1): iCloud nimmt sie nur einmal (`schonDa`) — auch zwei Läufe gleichzeitig
//               oder eine Wiederaufnahme legen nie zwei Termine an. Termine von vorher: Marke in der Notiz
//               (`terminMarke`). Kontaktbezug NUR in `kalender-bezug` (K1 `bezugSetzen`). Audit.
//     buchung   Status „bestätigt“ + Termin-UID an der Buchung — NUR von „angefragt“ (in der Sperre geprüft).
//     kartei    Aktivität „Termin gebucht“ als Meeting mit `terminUid` (K3 — Zeit aus dem Termin, kein `wann`) — genau
//               eine je Termin; Kalender-Signal und Bezug-Lauf legen keine zweite an.
//     crm       Follow-up „Termin vorbereiten“ (Vortag, Art „termin“ — nie ein Mail-Follow-up) — nur, wenn die Kennung fehlt.
// Ein Deal- oder Qualifizierungsvorschlag entsteht NUR als Vorschlag (`folgeVorschlag`) — nie automatisch.
// Absichten von vor R-K2 (anfrage mit kartei/crm/buchung, freigabe ohne „kontakt“) laufen weiter: fehlende Schritte
// werden übersprungen.
//
// Freigabe gegen Absage (F1, Prüfer 1 #2): Die Schritte `kontakt` und `termin` lesen den Status frisch, `buchung` prüft
// ihn in der Sperre des Bestands. Ist die Buchung inzwischen abgesagt, abgelehnt oder abgelaufen (oder hat eine andere
// Freigabe sie schon bestätigt), wird die Absicht „verworfen“: kein Kontakt, kein Termin, keine Einladung, der Status
// bleibt. Lag der Termin schon in iCloud, entfernt MAKE OS ihn NICHT selbst — die Glocke fragt „Termin entfernen?“
// (Human-in-the-Loop), die Buchung trägt den Verweis für den Knopf „Termin entfernen“. Dieselbe Prüfung gilt für die
// Wiederaufnahme im Takt (`buchungFortsetzen`).
//
// E-Mail bestätigt (#76, Klick des Gasts auf den Bestätigungslink): `mailBestaetigtNachtragen` hängt — falls der
// Kontakt schon besteht — eine zweite Einwilligung „Antwort auf Anfrage“ mit „E-Mail-Adresse bestätigt“ an (die Liste
// wächst nur, lib/crm/einwilligung.ts).

import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { absichtBeginnen, absichtAbschliessen, absichtenLaden, istOffen, laeuftGerade, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen } from '@/lib/crm/anfragen';
import { alleAdressen } from '@/lib/crm/emails';
import { sperrlisteLaden, neuanlageSperre, sperren } from '@/lib/crm/sperrliste';
import { datenschutzStempeln } from '@/lib/crm/datenschutz-stempel';
import { neuesFollowUp, tagPlus as crmTagPlus } from '@/lib/crm/followup';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { wendeAktivitaetAn, type Kontakt, type Einwilligung } from '@/lib/make-one/crm';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { melde } from '@/lib/meldungen/melden';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { hatTerminAktivitaet, terminAktivitaetAnwenden } from '@/lib/crm/termin-aktivitaet';
import { abgleichen, anlegen, ladeStand, termineImZeitraum, verbunden } from './icloud';
import { verfuegbarkeitFuer, istFrei } from './verfuegbarkeit';
import { gaestePruefenCrm } from './gaeste-server';
import { bezugSetzen } from './bezug-server';
import { objektSchluessel, uidVonSchluessel } from './bezug';
import { tagVon, tagPlus } from './zeit';
import { aendereBuchungBestand, ladeBuchungBestand, buchungHaushalt, buchungProtokoll } from './buchung-speicher';
import { nameTeilen, terminMarke, buchungTerminUid, vorbereitenTag, EINWILLIGUNG_VERSION, type Buchung, type BuchungsSeite, type BuchungStatus } from './buchung';

export const ANFRAGE_SCHRITTE = ['melden'] as const;
export const FREIGABE_SCHRITTE = ['kontakt', 'termin', 'buchung', 'kartei', 'crm'] as const;
type Phase = 'anfrage' | 'freigabe';

const datumText = (b: Pick<Buchung, 'start' | 'ende'>) => `${b.start.slice(8, 10)}.${b.start.slice(5, 7)}.${b.start.slice(0, 4)}, ${b.start.slice(11, 16)}–${b.ende.slice(11, 16)} Uhr`;
/** Text der Anfrage-Aktivität (nach „Anfrage über Website: “). Nie mit Kennungen. */
const anfrageText = (b: Buchung, s: BuchungsSeite) => `Terminbuchung „${s.titel}“ für ${datumText(b)}${b.anliegen ? ` — ${b.anliegen}` : ''}`;
/** Nachweis-Text der Einwilligung — sagt, ob der Gast seine Adresse bestätigt hat (#76). */
export const nachweisText = (s: Pick<BuchungsSeite, 'titel'>, tag: string, bestaetigtAm: string | undefined) =>
  `Buchungsseite „${s.titel}“ am ${tag} — E-Mail-Adresse ${bestaetigtAm ? `per Bestätigungslink bestätigt am ${localDay(new Date(bestaetigtAm))}` : 'unbestätigt (Bestätigungslink nicht angeklickt)'}`;

async function buchungUndSeite(id: string): Promise<{ b: Buchung; s: BuchungsSeite }> {
  const bestand = await ladeBuchungBestand();
  const b = bestand.buchungen.find(x => x.id === id);
  const s = b ? bestand.seiten.find(x => x.id === b.seiteId) : undefined;
  if (!b || !s) throw new Error('Buchung oder Seite nicht (mehr) da.');
  return { b, s };
}

const hatSchritt = (a: Absicht, name: string) => a.schritte.some(s => s.name === name);

/**
 * Die Buchung ist für DIESE Freigabe nicht mehr freizugeben (F1 #2): abgesagt, abgelehnt, abgelaufen — oder schon
 * bestätigt (eine andere Freigabe war schneller). `terminUid`: der Termin, den dieser Lauf schon angelegt hatte.
 */
class FreigabeVerworfen extends Error {
  constructor(public buchungStatus: BuchungStatus, public terminUid?: string) { super(`Buchung nicht mehr offen (${buchungStatus}).`); this.name = 'FreigabeVerworfen'; }
}
/** Vor `kontakt` und `termin`: nur eine angefragte Buchung wird weiter freigegeben. */
function nochAngefragt(b: Buchung): void {
  if (b.status !== 'angefragt') throw new FreigabeVerworfen(b.status);
}
const STATUS_WORT: Record<BuchungStatus, string> = { vorlaeufig: 'vorläufig', angefragt: 'angefragt', bestaetigt: 'bestätigt', abgelehnt: 'abgelehnt', abgesagt: 'vom Gast abgesagt', abgelaufen: 'abgelaufen' };

// ── Abschnitt 1: Anfrage (nur die Glocke) ───────────────────────────────────

async function anfrageLauf(h: string, a: Absicht): Promise<void> {
  await mitVorgang(h, a, async v => {
    const id = String(v.daten<string>('buchungId'));
    await v.schritt('melden', async () => {
      const { b, s } = await buchungUndSeite(id);
      await melde({ an: s.person, art: 'buchung', titel: `Neue Terminanfrage: „${s.titel}“ am ${datumText(b)} — bitte freigeben oder ablehnen`, link: '/os/kalender?buchungen=1' });
    });
  });
  await absichtAbschliessen(h, a.id, 'fertig');
}

/**
 * Nach der Bestätigung durch den Buchenden: Glocke an die Person der Seite. Idempotent (je Buchung eine Absicht).
 * Wirft nicht in die öffentliche Antwort — ein Fehler bleibt als offene Absicht stehen und wird fortgesetzt.
 */
export async function buchungAnfragen(buchungId: string, person: string, jetzt = new Date()): Promise<void> {
  const h = await buchungHaushalt();
  const { absicht, neu } = await absichtBeginnen(h, {
    art: 'buchung', schluessel: `${buchungId}:anfrage`, schritte: ANFRAGE_SCHRITTE, person,
    daten: { phase: 'anfrage', buchungId, jetzt: jetzt.toISOString(), heute: localDay(jetzt) },
  });
  if (!neu && absicht.status !== 'offen') return;
  await anfrageLauf(h, absicht);
}

// ── Abschnitt 2: Freigabe ───────────────────────────────────────────────────

/** Einen schon angelegten Termin dieser Buchung im iCloud-Stand finden (Marke in der Notiz). */
async function vorhandenerTermin(b: Buchung): Promise<{ uid: string; kalender: string } | null> {
  const s = await ladeStand();
  const t = termineImZeitraum(s, tagVon(b.start), tagPlus(tagVon(b.start), 1)).find(x => (x.notiz ?? '').includes(terminMarke(b.id)));
  // R-K1: Verweis = Schlüssel Kalender + UID (`objektSchluessel`), nicht die nackte UID.
  return t ? { uid: objektSchluessel(t), kalender: t.kalender } : null;
}

/** Schritt „kontakt“: die Anfrage im CRM (erst jetzt, bei der Freigabe — #79). */
async function kontaktSchritt(id: string, ids: { kontakt: string; followUp: string }, jetzt: string, heute: string, von: string) {
  const { b, s } = await buchungUndSeite(id);
  if (b.kontaktId) return { kontaktId: b.kontaktId };
  const crm = await ladeCrm();
  const sperrEintraege = await sperrlisteLaden();
  const { vorname, nachname } = nameTeilen(b.name);
  // Die Anfrage trägt den Tag, an dem der Gast angefragt hat — nicht den der Freigabe.
  const tag = localDay(new Date(b.angefragtAm ?? b.angelegt));
  const am = tag === heute ? jetzt : `${tag}T12:00:00.000Z`;
  let ergebnis: { kontaktId?: string; hinweis?: string; neuePerson?: boolean; gesperrt?: boolean; ohneFollowUp?: boolean } = {};
  const text = anfrageText(b, s);
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    // Schon geschehen (Abbruch zwischen Wirkung und Abhaken)? Die Aktivität trägt genau diesen Zeitpunkt.
    const schon = f.kontakte.find(k => k.id === ids.kontakt || k.aktivitaeten.some(x => x.am === am && (x.text ?? '').endsWith(text)));
    if (schon) { ergebnis = { kontaktId: schon.id }; return f; }
    const r = anfrageBauen({ neu: { vorname, nachname, email: b.email, ...(b.firma ? { firma: b.firma } : {}) }, kanal: 'website', text, datum: tag },
      { kontakte: f.kontakte, crm, person: s.person, heute, jetzt, ids, sperre: k => neuanlageSperre(k, sperrEintraege, heute) });
    if (!r.ok) {
      // Werbesperre einer vorhandenen Person: ihre eigene Anfrage — verknüpfen, aber nichts Werbliches festhalten.
      // Art. 18 (eingeschränkt): gar nichts verknüpfen.
      const da = f.kontakte.find(k => alleAdressen(k).includes(b.email));
      ergebnis = da && da.werbesperre && !da.eingeschraenkt ? { kontaktId: da.id, hinweis: r.fehler, ohneFollowUp: true } : { hinweis: r.fehler };
      return f;
    }
    // Einwilligung „Antwort auf Anfrage“ mit vollem Nachweis (Wortlaut + Fassung + Beleg) — nur die eben entstandene;
    // der Nachweis-Text sagt, ob die Adresse bestätigt ist (#76).
    const ew = (r.bau.kontakt.einwilligungen ?? []).map(e => (e.grundlage === 'anfrage' && e.kanal === 'mail' && e.erteiltAm === tag && !e.wortlaut && !e.zeitpunkt
      ? { ...e, nachweis: nachweisText(s, tag, b.emailBestaetigtAm), wortlaut: b.einwilligung.wortlaut, wortlautVersion: b.einwilligung.version || EINWILLIGUNG_VERSION, belegRef: `buchung:${b.id}` } : e));
    const i = f.kontakte.findIndex(x => x.id === r.bau.kontakt.id);
    const alt = i >= 0 ? f.kontakte[i] : undefined;
    let neu: Kontakt = { ...r.bau.kontakt, einwilligungen: ew, ...(alt?.hinweisBeiErhebung ? {} : { hinweisBeiErhebung: { am: tag } }) };
    neu = datenschutzStempeln(neu, alt, von, jetzt, heute);
    ergebnis = { kontaktId: neu.id, neuePerson: r.bau.neuePerson, gesperrt: !!(r.bau.neuePerson && neu.werbesperre), ...(r.bau.hinweis ? { hinweis: r.bau.hinweis } : {}) };
    if (!alt) return { ...f, kontakte: [...f.kontakte, neu] };
    // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt; derselbe Eintrag (gleicher Zeitpunkt) nie doppelt.
    const verlauf = [...alt.aktivitaeten.filter(x => !neu.aktivitaeten.some(y => y.am === x.am && y.art === x.art && y.text === x.text)), ...neu.aktivitaeten].sort((x, y) => x.am.localeCompare(y.am));
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? { ...neu, aktivitaeten: verlauf } : x)) };
  }, { art: 'person', person: von });
  const e = ergebnis as { kontaktId?: string; hinweis?: string; gesperrt?: boolean; ohneFollowUp?: boolean };
  if (e.gesperrt && e.kontaktId) {
    const k = (await kontakteFuerVerarbeitung()).find(x => x.id === e.kontaktId);
    if (k) await sperren([k], 'werbesperre', heute);
  }
  const crmHinweis = e.ohneFollowUp || !e.kontaktId ? (e.hinweis ?? 'Nicht ins CRM übernommen.') : null;
  await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.map(x => (x.id === id ? { ...x, ...(e.kontaktId ? { kontaktId: e.kontaktId } : {}), ...(crmHinweis ? { crmHinweis } : {}) } : x)) }));
  await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['kontaktId'] }], { art: 'person', person: von });
  return { kontaktId: e.kontaktId ?? null };
}

async function freigabeLauf(h: string, a: Absicht): Promise<'fertig' | 'verworfen'> {
  try {
    await freigabeSchritte(h, a);
  } catch (e) {
    if (!(e instanceof FreigabeVerworfen)) throw e;
    await freigabeVerwerfen(h, a, e);
    return 'verworfen';
  }
  await absichtAbschliessen(h, a.id, 'fertig');
  return 'fertig';
}

/**
 * Verworfen (F1 #2): Absicht schließen, Status der Buchung NICHT anfassen. Liegt schon ein Termin dieses Laufs in iCloud
 * (angelegt, bevor die Absage ankam — oder von einem abgebrochenen Lauf), bleibt er stehen: Verweis an die Buchung (für
 * „Termin entfernen“) und Glocke „Termin entfernen?“ an die Person der Seite. Nie automatisch löschen.
 */
async function freigabeVerwerfen(h: string, a: Absicht, e: FreigabeVerworfen): Promise<void> {
  const id = String(a.daten.buchungId ?? '');
  const bestand = await ladeBuchungBestand().catch(() => null);
  const b = bestand?.buchungen.find(x => x.id === id);
  const s = b ? bestand?.seiten.find(x => x.id === b.seiteId) : undefined;
  let uid = e.terminUid ?? (typeof a.daten.terminUid === 'string' ? a.daten.terminUid : undefined);
  if (!uid && b && e.buchungStatus !== 'bestaetigt') uid = (await vorhandenerTermin(b).catch(() => null))?.uid;
  // Eine andere Freigabe hat bestätigt und trägt denselben Termin (feste UID) — nichts zu entfernen.
  const stehtNoch = !!uid && !!b && !(b.status === 'bestaetigt' && b.terminUid === uid);
  if (stehtNoch && b && s) {
    const kal = typeof a.daten.terminKalender === 'string' ? a.daten.terminKalender : s.zielKalender;
    await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.map(x => (x.id === id && x.status !== 'bestaetigt' && !x.terminUid ? { ...x, terminUid: uid, terminKalender: kal } : x)) }));
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['terminUid'] }], { art: 'system' });
    await melde({ an: s.person, art: 'buchung', titel: `Freigabe „${s.titel}“ am ${datumText(b)} kam zu spät (Buchung ${STATUS_WORT[b.status]}) — der Termin steht schon im Kalender. Termin entfernen?`, link: '/os/kalender?buchungen=1' });
  }
  console.warn(`[buchung] Freigabe verworfen (${e.buchungStatus})${stehtNoch ? ' — Termin blieb stehen, die Glocke fragt' : ''}`);
  await absichtAbschliessen(h, a.id, 'verworfen');
}

async function freigabeSchritte(h: string, a: Absicht): Promise<void> {
  await mitVorgang(h, a, async v => {
    const id = String(v.daten<string>('buchungId'));
    const jetzt = String(v.daten<string>('jetzt'));
    const heute = String(v.daten<string>('heute'));
    const von = String(v.daten<string>('von'));
    const vorbereitenId = String(v.daten<string>('vorbereitenId'));
    // K3 (30.09.): der Gast als echte Einladung — nur, wenn bei der Freigabe ausdrücklich bestätigt (Absicht-Daten).
    const einladen = v.daten<boolean>('einladen') === true;

    // R-K2 (#79): der CRM-Kontakt entsteht erst hier. Absichten von vor R-K2 kennen den Schritt nicht (Kontakt schon da).
    if (hatSchritt(a, 'kontakt')) {
      const ids = { kontakt: String(v.daten<string>('kontaktNeu') ?? neueKennung('c')), followUp: String(v.daten<string>('followUpId') ?? neueKennung('fu')) };
      await v.schritt('kontakt', async () => {
        // F1 #2: abgesagt/abgelehnt/abgelaufen → kein Kontakt im CRM (#79 gilt auch mitten in der Freigabe).
        const { b } = await buchungUndSeite(id);
        if (!b.kontaktId) nochAngefragt(b);
        return kontaktSchritt(id, ids, jetzt, heute, von);
      });
    }

    await v.schritt('termin', async () => {
      const { b, s } = await buchungUndSeite(id);
      nochAngefragt(b);
      let r: { uid: string; kalender: string } | null = b.terminUid ? { uid: b.terminUid, kalender: b.terminKalender ?? s.zielKalender } : await vorhandenerTermin(b);
      // Direkt vor dem Anlegen noch einmal frisch lesen (der Abgleich davor dauert) — sagt der Gast gerade ab, entsteht nichts.
      if (!r) nochAngefragt((await buchungUndSeite(id)).b);
      if (!r) {
        const notiz = [
          `Gebucht über die Buchungsseite „${s.titel}“.`,
          // Eingeladen: die Adresse steht als Gast im Termin, nicht zusätzlich in der Notiz.
          einladen ? `Gast: ${b.name}${b.firma ? ` · ${b.firma}` : ''} (eingeladen)` : `Gast: ${b.name} <${b.email}>${b.firma ? ` · ${b.firma}` : ''}`,
          ...(b.anliegen ? [`Anliegen: ${b.anliegen}`] : []),
          terminMarke(b.id),
        ].join('\n');
        // Feste UID (F1 #1): gibt es den Termin schon (zweiter Lauf, Absturz nach dem PUT), kommt `schonDa` — nichts doppelt.
        const n = await anlegen({ uid: buchungTerminUid(b.id), titel: `${s.titel} · ${b.name}`.slice(0, 300), kalender: s.zielKalender, start: b.start, ende: b.ende, art: 'termin', beschaeftigt: true, ...(s.ort ? { ort: s.ort } : {}), notiz: notiz.slice(0, 2000), ...(einladen ? { gaeste: [{ email: b.email.toLowerCase(), name: b.name }] } : {}) }, { einladungBestaetigt: einladen });
        r = { uid: n.schluessel, kalender: n.kalender };
        // Audit wie die Termin-Route (K1): Bestand „kalender“, Liste „termine“, UID + Feldnamen — nie Titel oder Namen.
        if (!n.schonDa) await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.uid, felder: ['buchung', ...(b.kontaktId ? ['kontaktId'] : [])] }, ...(n.gaeste ? [{ liste: 'einladungen', op: 'neu' as const, id: r.uid, felder: [`gaeste:${n.gaeste}`] }] : [])], { art: 'person', person: von });
      }
      // Kontaktbezug am Termin NUR im Bestand `kalender-bezug` (K1) — nie im Termin selbst. Idempotent (Teil-Änderung).
      // `r.uid` ist der Schlüssel (Kalender + UID); Buchungen von vor R-K1 tragen die alte Form (= nackte UID).
      if (b.kontaktId) await bezugSetzen(r.uid, { kontaktId: b.kontaktId, ...(einladen ? { gastKontakte: [b.kontaktId] } : {}), von, tag: tagVon(b.start) });
      return r;
    }, r => (r ? { terminUid: r.uid, terminKalender: r.kalender } : {}));

    await v.schritt('buchung', async () => {
      const uid = v.daten<string>('terminUid'), kal = v.daten<string>('terminKalender');
      // F1 #2: der Statuswechsel NUR von „angefragt“ — in der Sperre des Bestands entschieden (die Absage des Gasts läuft
      // über dieselbe Sperre). Schon „bestätigt“ mit genau diesem Termin = dieser Lauf (Abbruch vor dem Abhaken) → nichts.
      let nichtMehr: BuchungStatus | null = null, geaendert = false;
      await aendereBuchungBestand(bs => {
        const x = bs.buchungen.find(y => y.id === id);
        if (!x) { nichtMehr = 'abgelaufen'; return bs; }
        if (x.status === 'bestaetigt' && (!uid || x.terminUid === uid)) return bs;
        if (x.status !== 'angefragt') { nichtMehr = x.status; return bs; }
        geaendert = true;
        return { ...bs, buchungen: bs.buchungen.map(y => (y.id === id ? { ...y, status: 'bestaetigt' as const, statusAm: jetzt, entschiedenAm: jetzt, entschiedenVon: von, ...(uid ? { terminUid: uid } : {}), ...(kal ? { terminKalender: kal } : {}), vorbereitenId } : y)) };
      });
      if (nichtMehr) throw new FreigabeVerworfen(nichtMehr, uid);
      if (geaendert) await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['status', 'terminUid'] }], { art: 'person', person: von });
    });

    await v.schritt('kartei', async () => {
      const { b, s } = await buchungUndSeite(id);
      if (!b.kontaktId) return;
      // N10 (F1): mit Termin-Verweis kein kopiertes Datum im Text — die Akte leitet die Zeit aus dem Termin ab
      // (verschoben → stimmt weiter). Ohne Verweis (Altfall) bleibt das Datum im Text.
      const text = b.terminUid ? `Termin gebucht: „${s.titel}“` : `Termin gebucht: „${s.titel}“ am ${datumText(b)}`;
      // Genau EINE Aktivität zum Termin (K3): die Meeting-Aktivität mit `terminUid` — Zeit und Ort liest die Akte aus dem
      // Termin (kein `wann`); das Kalender-Signal und der Bezug-Lauf legen dann keine zweite an.
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
        const f = cur ?? { kontakte: [] };
        const i = f.kontakte.findIndex(k => k.id === b.kontaktId);
        if (i < 0) return f;
        const k = f.kontakte[i];
        if (k.eingeschraenkt) return f; // Art. 18: nichts festhalten
        const termin = { id: b.terminUid ?? '', uid: uidVonSchluessel(b.terminUid ?? ''), titel: s.titel, start: b.start, kontaktIds: [k.id], von };
        if ((b.terminUid && hatTerminAktivitaet(k, termin)) || k.aktivitaeten.some(x => x.am === jetzt && x.art === 'termin' && x.text === text)) return f;
        const neu = b.terminUid
          ? terminAktivitaetAnwenden(k, termin, { text, heute, jetztIso: jetzt, tagePlus: crmTagPlus })
          : wendeAktivitaetAn(k, { art: 'termin', text, von, wann: b.start.slice(0, 16), ...(s.ort ? { ort: s.ort } : {}) }, heute, jetzt, crmTagPlus);
        return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
      }, { art: 'person', person: von });
    });

    await v.schritt('crm', async () => {
      const { b, s } = await buchungUndSeite(id);
      if (!b.kontaktId) return;
      const k = (await kontakteFuerVerarbeitung()).find(x => x.id === b.kontaktId);
      if (!k || k.eingeschraenkt) return;
      await aendereCrm(c => {
        if ((c.followups ?? []).some(f => f.id === vorbereitenId)) return c;
        // F2 M3: am Termin verknüpft (`terminUid` = Schlüssel Kalender|UID wie R-K1) — verschiebt er sich, zieht die
        // Verbindungsprüfung das Datum nach. Das Datum steht NICHT im Text (die Anzeige leitet es aus dem Termin ab).
        const fu = neuesFollowUp({ id: vorbereitenId, bezug: { art: 'kontakt', id: b.kontaktId! }, kontaktId: b.kontaktId, art: 'termin', text: `Termin vorbereiten — „${s.titel.slice(0, 60)}“`, faellig: vorbereitenTag(b.start, heute), quelle: 'hand', ...(b.terminUid ? { terminUid: b.terminUid } : {}), ...(b.anliegen ? { notiz: `Anliegen: ${b.anliegen}`.slice(0, 1000) } : {}) }, k, von, jetzt);
        return { ...c, followups: [...(c.followups ?? []), { ...fu, zustaendig: s.person, geaendertVon: von }] };
      }, { art: 'person', person: von });
    });
  });
}

/** Fehler der Freigabe mit HTTP-Status und Zusatz für die Oberfläche (`konflikt`, `unbestaetigt`). */
export class FreigabeFehler extends Error {
  constructor(message: string, public status = 409, public extra: Record<string, unknown> = {}) { super(message); }
}

export interface FreigabeOptionen {
  /** K3: Gast als echte Einladung (die Route prüft vorher `einladungBestaetigt`). */
  einladen?: boolean;
  /** #76: Einladen an eine UNBESTÄTIGTE Adresse — nur nach dem Warnhinweis in der Oberfläche. */
  adresseUnbestaetigt?: boolean;
  /** #73: Der Platz ist inzwischen belegt — trotzdem freigeben (nach der Rückfrage im Panel). */
  trotzKonflikt?: boolean;
}

/**
 * Freigabe durch Kevin oder Malin: Kontakt, fester Termin, Aktivität, Follow-up. Idempotent (je Buchung eine Absicht).
 * Vorher (#73): erzwungener iCloud-Abgleich; ist der Platz nicht mehr frei (Termin am iPhone, Abwesend, Feiertag) →
 * 409 `{ konflikt: true }` — freigegeben wird dann nur mit `trotzKonflikt`. Ohne erreichbares iCloud keine Freigabe.
 * `einladen` (K3): echte Einladung über iCloud; an eine unbestätigte Adresse nur mit `adresseUnbestaetigt` (#76);
 * Art. 18 → 409.
 */
export async function buchungFreigeben(buchungId: string, von: string, jetzt = new Date(), opt: FreigabeOptionen = {}): Promise<void> {
  // F1 #1: je Buchung nur EINE Freigabe zugleich in diesem Prozess (Doppelklick, Kevin und Malin gleichzeitig) — die
  // zweite bekommt 409, statt parallel denselben Vorgang zu fahren. Über Prozesse hinweg schützt die feste UID.
  if (FREIGABE_LAEUFT.has(buchungId)) throw new FreigabeFehler('Die Freigabe läuft gerade schon — bitte einen Moment.', 409, { laeuft: true });
  FREIGABE_LAEUFT.add(buchungId);
  try { await freigebenGesperrt(buchungId, von, jetzt, opt); }
  finally { FREIGABE_LAEUFT.delete(buchungId); }
}
const G = globalThis as unknown as { __makeosFreigabeLaeuft?: Set<string> };
const FREIGABE_LAEUFT: Set<string> = (G.__makeosFreigabeLaeuft ??= new Set());

async function freigebenGesperrt(buchungId: string, von: string, jetzt: Date, opt: FreigabeOptionen): Promise<void> {
  const bestand = await ladeBuchungBestand(jetzt);
  const b = bestand.buchungen.find(x => x.id === buchungId);
  const s = b ? bestand.seiten.find(x => x.id === b.seiteId) : undefined;
  if (!b || !s) throw new FreigabeFehler('Buchung nicht gefunden.', 404);
  if (!b.terminUid && !verbunden()) throw new FreigabeFehler('iCloud ist nicht verbunden — ein fester Termin kann gerade nicht angelegt werden.', 409);
  if (b.status !== 'angefragt' && b.status !== 'bestaetigt') throw new FreigabeFehler(b.status === 'vorlaeufig' ? 'Noch nicht vom Buchenden bestätigt.' : 'Diese Buchung ist nicht mehr offen.');
  const h = await buchungHaushalt();
  // Schon bestätigt und kein Vorgang mehr offen (zweiter Klick nach getaner Freigabe) → nichts zu tun.
  if (b.status === 'bestaetigt' && !(await absichtenLaden(h)).some(a => a.art === 'buchung' && a.schluessel === `${buchungId}:freigabe` && istOffen(a))) return;
  if (opt.einladen && !b.emailBestaetigtAm && !opt.adresseUnbestaetigt) {
    throw new FreigabeFehler('Die E-Mail-Adresse ist nicht bestätigt — einladen nur nach dem Warnhinweis.', 409, { unbestaetigt: true });
  }
  if (!b.terminUid) {
    // #73: nie auf einem alten Stand entscheiden — erst frisch mit iCloud abgleichen.
    try { await abgleichen({ erzwingen: true }); } catch {
      throw new FreigabeFehler('iCloud ist gerade nicht erreichbar — freigeben geht erst mit einem frischen Kalender.', 503);
    }
    if (!opt.trotzKonflikt && !(await vorhandenerTermin(b))) {
      const v = await verfuegbarkeitFuer(s.person, tagVon(b.start), tagPlus(tagVon(b.ende), 1));
      if (!istFrei(v, b.start, b.ende)) throw new FreigabeFehler(`Der Platz ${datumText(b)} ist inzwischen nicht mehr frei (Termin, Abwesenheit oder Feiertag im Kalender).`, 409, { konflikt: true });
    }
  }
  if (opt.einladen) {
    const g = await gaestePruefenCrm([{ email: b.email.toLowerCase(), name: b.name, ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}) }]);
    if (!g.ok) throw new FreigabeFehler(g.fehler, 409);
  }
  const { absicht, neu } = await absichtBeginnen(h, {
    art: 'buchung', schluessel: `${buchungId}:freigabe`, schritte: FREIGABE_SCHRITTE, person: von,
    daten: { phase: 'freigabe', buchungId, von, jetzt: jetzt.toISOString(), heute: localDay(jetzt), vorbereitenId: neueKennung('fu'), kontaktNeu: neueKennung('c'), followUpId: neueKennung('fu'), ...(opt.einladen ? { einladen: true } : {}) },
  });
  if (!neu && absicht.status !== 'offen') return;
  // Dieselbe Absicht läuft gerade (Wiederaufnahme im Takt) — nicht ein zweites Mal daneben.
  if (!neu && laeuftGerade(absicht.id)) throw new FreigabeFehler('Die Freigabe läuft gerade schon — bitte einen Moment.', 409, { laeuft: true });
  if (await freigabeLauf(h, absicht) === 'verworfen') {
    const danach = (await ladeBuchungBestand().catch(() => null))?.buchungen.find(x => x.id === buchungId);
    // Eine andere Freigabe war schneller → erledigt. Sonst: abgesagt/abgelehnt/abgelaufen, während freigegeben wurde.
    if (danach?.status === 'bestaetigt') return;
    throw new FreigabeFehler(`Diese Buchung ist nicht mehr offen (${danach ? STATUS_WORT[danach.status] : 'nicht mehr da'}) — nicht freigegeben.`, 409, { verworfen: true });
  }
}

/** Wiederaufnahme für lib/store/absichten-fortsetzen.ts. */
export async function buchungFortsetzen(h: string, a: Absicht): Promise<void> {
  const phase = a.daten.phase as Phase | undefined;
  if (phase === 'anfrage') return anfrageLauf(h, a);
  if (phase === 'freigabe') { await freigabeLauf(h, a); return; }
  // Ohne Phase (Daten fehlen) ist nichts mehr fortzusetzen.
  await absichtAbschliessen(h, a.id, 'verworfen');
}

// ── E-Mail bestätigt (#76) ───────────────────────────────────────────────────

/**
 * Der Gast hat den Bestätigungslink angeklickt. Steht der Kontakt schon (Freigabe war vorher), bekommt er eine zweite
 * Einwilligung „Antwort auf Anfrage“ mit „E-Mail-Adresse bestätigt“ (Beleg `buchung:<id>`) — die Liste wächst nur.
 * Art. 18 → nichts. Idempotent. Vor der Freigabe tut das nichts: der Kontaktschritt liest `emailBestaetigtAm` selbst.
 */
export async function mailBestaetigtNachtragen(buchungId: string, jetzt = new Date()): Promise<void> {
  const { b, s } = await buchungUndSeite(buchungId);
  if (!b.kontaktId || !b.emailBestaetigtAm) return;
  const heute = localDay(jetzt), jetztIso = jetzt.toISOString();
  const nachweis = nachweisText(s, heute, b.emailBestaetigtAm);
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const i = f.kontakte.findIndex(k => k.id === b.kontaktId);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    if (alt.eingeschraenkt) return f;
    if ((alt.einwilligungen ?? []).some(e => e.belegRef === `buchung:${b.id}` && e.nachweis.includes('per Bestätigungslink bestätigt'))) return f;
    const dazu: Einwilligung = { kanal: 'mail', grundlage: 'anfrage', erteiltAm: heute, nachweis, wortlaut: b.einwilligung.wortlaut, wortlautVersion: b.einwilligung.version || EINWILLIGUNG_VERSION, belegRef: `buchung:${b.id}` };
    const neu = datenschutzStempeln({ ...alt, einwilligungen: [...(alt.einwilligungen ?? []), dazu] }, alt, s.person, jetztIso, heute);
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
  }, { art: 'system' });
}

// ── Folge-Vorschlag (nur Vorschlag) ─────────────────────────────────────────

export interface FolgeVorschlag { art: 'qualifizierung' | 'deal'; text: string; kontaktId: string }
/**
 * Passt nach der Freigabe ein nächster Schritt? Nur als Vorschlag für die Oberfläche — nie angelegt.
 *  · Person ohne offenen Deal und Lead noch vor der Qualifizierung → „Qualifizierung starten“
 *  · Lead qualifiziert/SQL, aber kein offener Deal → „Deal anlegen“
 */
export function folgeVorschlag(k: Kontakt | undefined, firmaLead: { status?: string } | undefined, chancen: readonly { stufe: string; kontaktIds: string[] }[]): FolgeVorschlag | null {
  if (!k || k.eingeschraenkt || k.werbesperre) return null;
  if (chancen.some(c => OFFENE_STUFEN.includes(c.stufe as (typeof OFFENE_STUFEN)[number]) && c.kontaktIds.includes(k.id))) return null;
  const status = firmaLead?.status ?? k.lead?.status ?? 'neu';
  if (status === 'qualifizierung' || status === 'sql') return { art: 'deal', text: 'Lead ist qualifiziert — Deal anlegen?', kontaktId: k.id };
  if (status === 'neu' || status === 'kontaktiert' || status === 'im_gespraech') return { art: 'qualifizierung', text: 'Erstgespräch gebucht — Qualifizierung starten?', kontaktId: k.id };
  return null;
}

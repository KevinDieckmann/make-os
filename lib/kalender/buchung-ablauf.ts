// ─── Kalender — Buchung als EIN CRM-Vorgang (Server, 29.09., Paket K4) ───────
// Kevin: „Eine Buchung ist im CRM EIN Vorgang, keine Kopien.“ Zwei Abschnitte, jeder über das Absichtsprotokoll
// (lib/store/absichten.ts, Art „buchung“), weil sie nacheinander mehrere Bestände schreiben — jeder Schritt ist
// idempotent und wird nach getaner Arbeit abgehakt; bricht der Lauf ab, setzt `buchungFortsetzen` ihn fort
// (Start, Takt, Durchsicht über lib/store/absichten-fortsetzen.ts).
//
//   anfrage   (der Buchende hat auf seiner Status-Seite bestätigt)
//     kartei    Anfrage über lib/crm/anfragen.ts `anfrageBauen`: Dublette über alle Adressen, Sperrliste
//               (`neuanlageSperre`), Einwilligung „Antwort auf Anfrage“ mit vollem Nachweis (Wortlaut, Fassung,
//               Beleg `buchung:<id>`, Zeitpunkt, erfasst von), Aktivität „Anfrage über Website: Terminbuchung …“,
//               Lead → „kontaktiert“. Werbesperre einer VORHANDENEN Person / Art. 18 → nichts im CRM, Hinweis an der Buchung.
//     crm       Follow-up „Anfrage beantworten“ (heute) + Firmen-Lead — nur, wenn die Kennung noch fehlt.
//     buchung   Kontakt- und Follow-up-Kennung an die Buchung.
//     melden    Glocke an die Person der Seite.
//   freigabe  (Kevin oder Malin geben frei)
//     termin    fester Termin im Zielkalender (iCloud, lib/kalender/icloud.ts `anlegen`, Art „termin“, beschäftigt) — Gast
//               als Notiz ODER (K3, 30.09.) nach bestätigter Rückfrage als echte Einladung (ATTENDEE, iCloud verschickt;
//               Kennung als `gastKontakte`); echte UID. Wiedererkannt über die Marke in der Notiz
//               (`terminMarke`), nie doppelt angelegt. Kontaktbezug NUR in `kalender-bezug` (K1 `bezugSetzen`). Audit.
//     buchung   Status „bestätigt“ + Termin-UID an der Buchung.
//     kartei    Aktivität „Termin gebucht“ als Meeting mit `terminUid` (K3 — Zeit aus dem Termin, kein `wann`) — genau
//               eine je Termin; Kalender-Signal und Bezug-Lauf legen keine zweite an.
//     crm       Follow-up „Termin vorbereiten“ (Vortag) — nur, wenn die Kennung noch fehlt.
// Ein Deal- oder Qualifizierungsvorschlag entsteht NUR als Vorschlag (`folgeVorschlag`) — nie automatisch.

import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { absichtBeginnen, absichtAbschliessen, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen } from '@/lib/crm/anfragen';
import { alleAdressen } from '@/lib/crm/emails';
import { sperrlisteLaden, neuanlageSperre, sperren } from '@/lib/crm/sperrliste';
import { datenschutzStempeln } from '@/lib/crm/datenschutz-stempel';
import { neuesFollowUp, tagPlus as crmTagPlus } from '@/lib/crm/followup';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { wendeAktivitaetAn, type Kontakt } from '@/lib/make-one/crm';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { melde } from '@/lib/meldungen/melden';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { hatTerminAktivitaet, terminAktivitaetAnwenden } from '@/lib/crm/termin-aktivitaet';
import { anlegen, ladeStand, termineImZeitraum, verbunden } from './icloud';
import { gaestePruefenCrm } from './gaeste-server';
import { bezugSetzen } from './bezug-server';
import { bezugSchluessel } from './bezug';
import { tagVon, tagPlus } from './zeit';
import { aendereBuchungBestand, ladeBuchungBestand, buchungHaushalt, buchungProtokoll } from './buchung-speicher';
import { nameTeilen, terminMarke, vorbereitenTag, EINWILLIGUNG_VERSION, type Buchung, type BuchungsSeite } from './buchung';

export const ANFRAGE_SCHRITTE = ['kartei', 'crm', 'buchung', 'melden'] as const;
export const FREIGABE_SCHRITTE = ['termin', 'buchung', 'kartei', 'crm'] as const;
type Phase = 'anfrage' | 'freigabe';

const datumText = (b: Pick<Buchung, 'start' | 'ende'>) => `${b.start.slice(8, 10)}.${b.start.slice(5, 7)}.${b.start.slice(0, 4)}, ${b.start.slice(11, 16)}–${b.ende.slice(11, 16)} Uhr`;
/** Text der Anfrage-Aktivität (nach „Anfrage über Website: “). Nie mit Kennungen. */
const anfrageText = (b: Buchung, s: BuchungsSeite) => `Terminbuchung „${s.titel}“ für ${datumText(b)}${b.anliegen ? ` — ${b.anliegen}` : ''}`;

async function buchungUndSeite(id: string): Promise<{ b: Buchung; s: BuchungsSeite }> {
  const bestand = await ladeBuchungBestand();
  const b = bestand.buchungen.find(x => x.id === id);
  const s = b ? bestand.seiten.find(x => x.id === b.seiteId) : undefined;
  if (!b || !s) throw new Error('Buchung oder Seite nicht (mehr) da.');
  return { b, s };
}

// ── Abschnitt 1: Anfrage ────────────────────────────────────────────────────

async function anfrageLauf(h: string, a: Absicht): Promise<void> {
  await mitVorgang(h, a, async v => {
    const id = String(v.daten<string>('buchungId'));
    const jetzt = String(v.daten<string>('jetzt'));
    const heute = String(v.daten<string>('heute'));
    const ids = { kontakt: String(v.daten<string>('kontaktNeu')), followUp: String(v.daten<string>('followUpId')) };

    await v.schritt('kartei', async () => {
      const { b, s } = await buchungUndSeite(id);
      const crm = await ladeCrm();
      const sperrEintraege = await sperrlisteLaden();
      const { vorname, nachname } = nameTeilen(b.name);
      let ergebnis: { kontaktId?: string; hinweis?: string; neuePerson?: boolean; gesperrt?: boolean; ohneFollowUp?: boolean } = {};
      const text = anfrageText(b, s);
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
        const f = cur ?? { kontakte: [] };
        // Schon geschehen (Abbruch zwischen Wirkung und Abhaken)? Die Aktivität trägt genau diesen Zeitpunkt.
        const schon = f.kontakte.find(k => k.id === ids.kontakt || k.aktivitaeten.some(x => x.am === jetzt && (x.text ?? '').endsWith(text)));
        if (schon) { ergebnis = { kontaktId: schon.id }; return f; }
        const r = anfrageBauen({ neu: { vorname, nachname, email: b.email, ...(b.firma ? { firma: b.firma } : {}) }, kanal: 'website', text, datum: heute },
          { kontakte: f.kontakte, crm, person: s.person, heute, jetzt, ids, sperre: k => neuanlageSperre(k, sperrEintraege, heute) });
        if (!r.ok) {
          // Werbesperre einer vorhandenen Person: ihre eigene Anfrage — verknüpfen, aber nichts Werbliches festhalten
          // (Antwort in der Karteikarte). Art. 18 (eingeschränkt): gar nichts verknüpfen.
          const da = f.kontakte.find(k => alleAdressen(k).includes(b.email));
          ergebnis = da && da.werbesperre && !da.eingeschraenkt ? { kontaktId: da.id, hinweis: r.fehler, ohneFollowUp: true } : { hinweis: r.fehler };
          return f;
        }
        // Einwilligung „Antwort auf Anfrage“ mit vollem Nachweis (Wortlaut + Fassung + Beleg) — nur die eben entstandene.
        const ew = (r.bau.kontakt.einwilligungen ?? []).map(e => (e.grundlage === 'anfrage' && e.kanal === 'mail' && e.erteiltAm === heute && !e.wortlaut && !e.zeitpunkt
          ? { ...e, nachweis: `Buchungsseite „${s.titel}“ am ${heute}`, wortlaut: b.einwilligung.wortlaut, wortlautVersion: b.einwilligung.version || EINWILLIGUNG_VERSION, belegRef: `buchung:${b.id}` } : e));
        const i = f.kontakte.findIndex(x => x.id === r.bau.kontakt.id);
        const alt = i >= 0 ? f.kontakte[i] : undefined;
        let neu: Kontakt = { ...r.bau.kontakt, einwilligungen: ew, ...(alt?.hinweisBeiErhebung ? {} : { hinweisBeiErhebung: { am: heute } }) };
        neu = datenschutzStempeln(neu, alt, s.person, jetzt, heute);
        ergebnis = { kontaktId: neu.id, neuePerson: r.bau.neuePerson, gesperrt: !!(r.bau.neuePerson && neu.werbesperre), ...(r.bau.hinweis ? { hinweis: r.bau.hinweis } : {}) };
        if (!alt) return { ...f, kontakte: [...f.kontakte, neu] };
        // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt; derselbe Eintrag (gleicher Zeitpunkt) nie doppelt.
        const verlauf = [...alt.aktivitaeten.filter(x => !neu.aktivitaeten.some(y => y.am === x.am && y.art === x.art && y.text === x.text)), ...neu.aktivitaeten].sort((x, y) => x.am.localeCompare(y.am));
        return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? { ...neu, aktivitaeten: verlauf } : x)) };
      }, { art: 'person', person: s.person });
      const e = ergebnis as { kontaktId?: string; hinweis?: string; gesperrt?: boolean; ohneFollowUp?: boolean };
      if (e.gesperrt && e.kontaktId) {
        const k = (await kontakteFuerVerarbeitung()).find(x => x.id === e.kontaktId);
        if (k) await sperren([k], 'werbesperre', heute);
      }
      return e;
    }, r => ({ kontaktId: r.kontaktId ?? null, ohneFollowUp: !!r.ohneFollowUp, crmHinweis: r.ohneFollowUp || !r.kontaktId ? (r.hinweis ?? 'Nicht ins CRM übernommen.') : null }));

    const kontaktId = v.daten<string | null>('kontaktId');
    const ohneFollowUp = v.daten<boolean>('ohneFollowUp') === true;
    await v.schritt('crm', async () => {
      if (!kontaktId || ohneFollowUp) return;
      const { b, s } = await buchungUndSeite(id);
      const k = (await kontakteFuerVerarbeitung()).find(x => x.id === kontaktId);
      await aendereCrm(c => {
        if ((c.followups ?? []).some(f => f.id === ids.followUp)) return c;
        const fu = neuesFollowUp({ id: ids.followUp, bezug: { art: 'kontakt', id: kontaktId }, kontaktId, art: 'mail', text: `Anfrage beantworten — Terminbuchung „${s.titel.slice(0, 60)}“`, faellig: heute, quelle: 'hand', notiz: anfrageText(b, s).slice(0, 1000) }, k, s.person, jetzt);
        return { ...c, followups: [...(c.followups ?? []), { ...fu, geaendertVon: s.person }] };
      }, { art: 'person', person: s.person });
    });

    await v.schritt('buchung', async () => {
      const hinweis = v.daten<string | null>('crmHinweis');
      await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['kontaktId', 'followUpId'] }], { art: 'system' });
      await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.map(x => (x.id === id ? { ...x, ...(kontaktId ? { kontaktId, ...(ohneFollowUp ? {} : { followUpId: ids.followUp }) } : {}), ...(hinweis ? { crmHinweis: hinweis } : {}) } : x)) }));
    });

    await v.schritt('melden', async () => {
      const { b, s } = await buchungUndSeite(id);
      await melde({ an: s.person, art: 'buchung', titel: `Neue Terminanfrage: „${s.titel}“ am ${datumText(b)} — bitte freigeben oder ablehnen`, link: '/os/kalender?buchungen=1' });
    });
  });
  await absichtAbschliessen(h, a.id, 'fertig');
}

/**
 * Nach der Bestätigung durch den Buchenden: Anfrage im CRM + Glocke. Idempotent (je Buchung eine Absicht).
 * Wirft nicht in die öffentliche Antwort — ein Fehler bleibt als offene Absicht stehen und wird fortgesetzt.
 */
export async function buchungAnfragen(buchungId: string, person: string, jetzt = new Date()): Promise<void> {
  const h = await buchungHaushalt();
  const { absicht, neu } = await absichtBeginnen(h, {
    art: 'buchung', schluessel: `${buchungId}:anfrage`, schritte: ANFRAGE_SCHRITTE, person,
    daten: { phase: 'anfrage', buchungId, jetzt: jetzt.toISOString(), heute: localDay(jetzt), kontaktNeu: neueKennung('c'), followUpId: neueKennung('fu') },
  });
  if (!neu && absicht.status !== 'offen') return;
  await anfrageLauf(h, absicht);
}

// ── Abschnitt 2: Freigabe ───────────────────────────────────────────────────

/** Einen schon angelegten Termin dieser Buchung im iCloud-Stand finden (Marke in der Notiz). */
async function vorhandenerTermin(b: Buchung): Promise<{ uid: string; kalender: string } | null> {
  const s = await ladeStand();
  const t = termineImZeitraum(s, tagVon(b.start), tagPlus(tagVon(b.start), 1)).find(x => (x.notiz ?? '').includes(terminMarke(b.id)));
  return t ? { uid: t.uid, kalender: t.kalender } : null;
}

async function freigabeLauf(h: string, a: Absicht): Promise<void> {
  await mitVorgang(h, a, async v => {
    const id = String(v.daten<string>('buchungId'));
    const jetzt = String(v.daten<string>('jetzt'));
    const heute = String(v.daten<string>('heute'));
    const von = String(v.daten<string>('von'));
    const vorbereitenId = String(v.daten<string>('vorbereitenId'));
    // K3 (30.09.): der Gast als echte Einladung — nur, wenn bei der Freigabe ausdrücklich bestätigt (Absicht-Daten).
    const einladen = v.daten<boolean>('einladen') === true;

    await v.schritt('termin', async () => {
      const { b, s } = await buchungUndSeite(id);
      let r: { uid: string; kalender: string } | null = b.terminUid ? { uid: b.terminUid, kalender: b.terminKalender ?? s.zielKalender } : await vorhandenerTermin(b);
      if (!r) {
        const notiz = [
          `Gebucht über die Buchungsseite „${s.titel}“.`,
          // Eingeladen: die Adresse steht als Gast im Termin, nicht zusätzlich in der Notiz.
          einladen ? `Gast: ${b.name}${b.firma ? ` · ${b.firma}` : ''} (eingeladen)` : `Gast: ${b.name} <${b.email}>${b.firma ? ` · ${b.firma}` : ''}`,
          ...(b.anliegen ? [`Anliegen: ${b.anliegen}`] : []),
          terminMarke(b.id),
        ].join('\n');
        const n = await anlegen({ titel: `${s.titel} · ${b.name}`.slice(0, 300), kalender: s.zielKalender, start: b.start, ende: b.ende, art: 'termin', beschaeftigt: true, ...(s.ort ? { ort: s.ort } : {}), notiz: notiz.slice(0, 2000), ...(einladen ? { gaeste: [{ email: b.email.toLowerCase(), name: b.name }] } : {}) }, { einladungBestaetigt: einladen });
        r = { uid: n.uid, kalender: n.kalender };
        // Audit wie die Termin-Route (K1): Bestand „kalender“, Liste „termine“, UID + Feldnamen — nie Titel oder Namen.
        await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.uid, felder: ['buchung', ...(b.kontaktId ? ['kontaktId'] : [])] }, ...(n.gaeste ? [{ liste: 'einladungen', op: 'neu' as const, id: r.uid, felder: [`gaeste:${n.gaeste}`] }] : [])], { art: 'person', person: von });
      }
      // Kontaktbezug am Termin NUR im Bestand `kalender-bezug` (K1) — nie im Termin selbst. Idempotent (Teil-Änderung).
      if (b.kontaktId) await bezugSetzen(bezugSchluessel(r.uid), { kontaktId: b.kontaktId, ...(einladen ? { gastKontakte: [b.kontaktId] } : {}), von, tag: tagVon(b.start) });
      return r;
    }, r => (r ? { terminUid: r.uid, terminKalender: r.kalender } : {}));

    await v.schritt('buchung', async () => {
      const uid = v.daten<string>('terminUid'), kal = v.daten<string>('terminKalender');
      await aendereBuchungBestand(bs => ({ ...bs, buchungen: bs.buchungen.map(x => (x.id === id ? { ...x, status: 'bestaetigt' as const, statusAm: jetzt, entschiedenAm: jetzt, entschiedenVon: von, ...(uid ? { terminUid: uid } : {}), ...(kal ? { terminKalender: kal } : {}), vorbereitenId } : x)) }));
      await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id, felder: ['status', 'terminUid'] }], { art: 'person', person: von });
    });

    await v.schritt('kartei', async () => {
      const { b, s } = await buchungUndSeite(id);
      if (!b.kontaktId) return;
      const text = `Termin gebucht: „${s.titel}“ am ${datumText(b)}`;
      // Genau EINE Aktivität zum Termin (K3): die Meeting-Aktivität mit `terminUid` — Zeit und Ort liest die Akte aus dem
      // Termin (kein `wann`); das Kalender-Signal und der Bezug-Lauf legen dann keine zweite an.
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
        const f = cur ?? { kontakte: [] };
        const i = f.kontakte.findIndex(k => k.id === b.kontaktId);
        if (i < 0) return f;
        const k = f.kontakte[i];
        if (k.eingeschraenkt) return f; // Art. 18: nichts festhalten
        const termin = { id: b.terminUid ?? '', uid: b.terminUid ?? '', titel: s.titel, start: b.start, kontaktIds: [k.id], von };
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
        const fu = neuesFollowUp({ id: vorbereitenId, bezug: { art: 'kontakt', id: b.kontaktId! }, kontaktId: b.kontaktId, art: 'termin', text: `Termin vorbereiten — „${s.titel.slice(0, 60)}“ am ${datumText(b)}`, faellig: vorbereitenTag(b.start, heute), quelle: 'hand', ...(b.anliegen ? { notiz: `Anliegen: ${b.anliegen}`.slice(0, 1000) } : {}) }, k, von, jetzt);
        return { ...c, followups: [...(c.followups ?? []), { ...fu, zustaendig: s.person, geaendertVon: von }] };
      }, { art: 'person', person: von });
    });
  });
  await absichtAbschliessen(h, a.id, 'fertig');
}

export class FreigabeFehler extends Error { constructor(message: string, public status = 409) { super(message); } }

/**
 * Freigabe durch Kevin oder Malin: fester Termin, Aktivität, Follow-up. Idempotent (je Buchung eine Absicht).
 * `einladen` (K3): der Gast bekommt eine echte Einladung über iCloud — nur, wenn die Oberfläche es nach der Rückfrage
 * bestätigt hat (die Route prüft `einladungBestaetigt`); Art. 18 → 409.
 */
export async function buchungFreigeben(buchungId: string, von: string, jetzt = new Date(), opt: { einladen?: boolean } = {}): Promise<void> {
  const bestand = await ladeBuchungBestand(jetzt);
  const b = bestand.buchungen.find(x => x.id === buchungId);
  if (!b) throw new FreigabeFehler('Buchung nicht gefunden.', 404);
  if (!b.terminUid && !verbunden()) throw new FreigabeFehler('iCloud ist nicht verbunden — ein fester Termin kann gerade nicht angelegt werden.', 409);
  if (b.status !== 'angefragt' && b.status !== 'bestaetigt') throw new FreigabeFehler(b.status === 'vorlaeufig' ? 'Noch nicht vom Buchenden bestätigt.' : 'Diese Buchung ist nicht mehr offen.');
  if (opt.einladen) {
    const g = await gaestePruefenCrm([{ email: b.email.toLowerCase(), name: b.name, ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}) }]);
    if (!g.ok) throw new FreigabeFehler(g.fehler, 409);
  }
  const h = await buchungHaushalt();
  const { absicht, neu } = await absichtBeginnen(h, {
    art: 'buchung', schluessel: `${buchungId}:freigabe`, schritte: FREIGABE_SCHRITTE, person: von,
    daten: { phase: 'freigabe', buchungId, von, jetzt: jetzt.toISOString(), heute: localDay(jetzt), vorbereitenId: neueKennung('fu'), ...(opt.einladen ? { einladen: true } : {}) },
  });
  if (!neu && absicht.status !== 'offen') return;
  await freigabeLauf(h, absicht);
}

/** Wiederaufnahme für lib/store/absichten-fortsetzen.ts. */
export async function buchungFortsetzen(h: string, a: Absicht): Promise<void> {
  const phase = a.daten.phase as Phase | undefined;
  if (phase === 'anfrage') return anfrageLauf(h, a);
  if (phase === 'freigabe') return freigabeLauf(h, a);
  // Ohne Phase (Daten fehlen) ist nichts mehr fortzusetzen.
  await absichtAbschliessen(h, a.id, 'verworfen');
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


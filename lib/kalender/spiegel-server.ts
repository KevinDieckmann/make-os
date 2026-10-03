// ─── Kalender — Spiegel anlegen und nachziehen (Server, 29.09., Paket K5) ────
// Was ein Spiegel ist: lib/kalender/spiegel.ts. Geschrieben wird nur über lib/kalender/termin-server.ts (iCloud →
// kalender-bezug → Änderungsprotokoll). Idempotenz ohne Absichtsprotokoll: die UID ist FEST je Eintrag — bricht ein
// Vorgang zwischen iCloud und Modul ab, findet der nächste Aufruf den Termin (`schonDa`) und schreibt nur die UID nach.
//
// Wer ruft:
//   · Anlegen/Verknüpfen auf Klick — POST /api/kalender/spiegel (Event-Seite „Termin anlegen“ bzw. „Mit dem Kalender
//     verknüpfen“ für alte `mac-…`-Kennungen, Familie „in den Kalender“), Löschen des Termins eines abgesagten Events
//     ebenfalls nur auf Klick (`aktion: 'loeschen'`).
//   · Nachziehen nach jeder Änderung im Modul durch eine Person — /api/crm/bestand (Events: Datum, Uhrzeit, Titel, Ort,
//     Status) und /api/familie (Dates, Gespräche, Einstellungen), im Hintergrund; ein Fehler kostet die Änderung nie.
//   · Der Takt (alle 30 Min., `eventSpiegelImTakt`) — Upload U1 B3: NUR künftige Events, deren Termin nachweislich von
//     MAKE OS stammt (Bezug `eventId` = dieses Event), nie alte `mac-…`-Kennungen; eine Absage LÖSCHT im Takt nie, sondern
//     meldet in die Glocke (einmal, Marke `weg`).
// Überschrieben wird nur, wenn sich das Modul seit dem letzten Spiegeln geändert hat (Änderungsmarke am Bezug,
// lib/kalender/spiegel.ts `spiegelSchritt`) — eine Änderung in Apple bleibt sonst stehen.
// Nur mit iCloud; nur Einzeltermine, die MAKE OS ändern darf (`bearbeitbar`) — sonst bleibt es beim Hinweis.
// F1 (Prüfer 1 #5): Das Nachziehen läuft JE EINTRAG in try/catch — ein Termin, der nicht mehr geht (Serie, Gäste, nur
// lesbar, Konflikt), hält die anderen nicht auf; was geklappt hat, wird gespeichert (Teilergebnis). Die Fehler kommen
// als `hinweise` zurück (Kennung + technischer Grund, nie Titel oder Adressen) und gehen über `spiegelHinweiseMelden`
// ins Server-Protokoll und — wenn eine Person die Änderung ausgelöst hat — in ihre Glocke. Nie mehr still.

import { ladeStand, termineImZeitraum, findeObjekt, KalenderFehler, HOLEN_VON, HOLEN_BIS, type IcloudStand } from './icloud';
import { kalenderQuelleDa as quelleDa } from './google/namen';
import { termineAus, type Termin } from './ics';
import { tagPlus } from './zeit';
import { ladeEinstellungen } from './einstellungen';
import { terminAnlegenServer, terminAendernServer, terminLoeschenServer } from './termin-server';
import { eventSoll, dateSoll, gespraechSoll, spiegelAbweichung, spiegelUid, istScheinUid, scheinAufloesen, gespraecheUmziehen, spiegelMarke, spiegelSchritt, type Soll, type SpiegelArt } from './spiegel';
import { bezugVon, type BezugBestand, type TerminBezug } from './bezug';
import { ladeBezuege, bezugSetzen } from './bezug-server';
import { haushaltsPersonen } from '@/lib/aufgaben/sicht';
import { WEG } from '@/lib/wege';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { ladeFamilie, familieName } from '@/lib/familie/speicher';
import { naechstesGespraech } from '@/lib/familie/logik';
import { updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { fehlerGrund } from '@/lib/store/absichten';
import { melde } from '@/lib/meldungen/melden';
import type { Familie } from '@/lib/familie/typen';
import type { Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';

/**
 * Der Termin einer UID (erstes Vorkommen) im gespeicherten Stand — null, wenn es ihn nicht (mehr) gibt. Nimmt auch den
 * Schlüssel `kalender|uid` (R-K1 #46); die Spiegel selbst tragen ihre feste UID.
 */
export function terminNachUid(s: IcloudStand, uid: string): Termin | null {
  const f = findeObjekt(s, uid);
  if (!f) return null;
  const heute = localDay();
  return termineAus(f.obj, f.kal, tagPlus(heute, HOLEN_VON), tagPlus(heute, HOLEN_BIS))[0] ?? null;
}

export interface SpiegelLage { lage: 'da' | 'fehlt' | 'schein' | 'keiner' | 'ohne-icloud'; uid?: string; grund?: string; bearbeitbar?: boolean }

/** Ein Eintrag, dessen Termin sich nicht nachziehen ließ (F1 #5) — nur Kennung und technischer Grund. */
export interface SpiegelHinweis { art: SpiegelArt; id: string; grund: string }
export interface SpiegelErgebnis { geprueft: number; hinweise: SpiegelHinweis[] }

/**
 * Hinweise melden (F1 #5): Server-Protokoll (für den Head of IT und die Logs — Kennung + Grund, nie Titel/Adressen)
 * und, wenn eine Person die Änderung ausgelöst hat, die Glocke. Wirft nie.
 */
export async function spiegelHinweiseMelden(hinweise: readonly SpiegelHinweis[], an?: string): Promise<void> {
  if (!hinweise.length) return;
  console.warn(`[spiegel] ${hinweise.length} Termin(e) nicht nachgezogen: ${hinweise.map(h => `${h.art}:${h.id} (${h.grund})`).join(' · ').slice(0, 600)}`);
  if (!an) return;
  const was = Array.from(new Set(hinweise.map(h => (h.art === 'event' ? 'Event' : h.art === 'date' ? 'Date' : 'Paar-Gespräch'))));
  await melde({ an, art: 'kalender', titel: `${hinweise.length} Kalender-Termin${hinweise.length === 1 ? '' : 'e'} (${was.join(', ')}) ließ${hinweise.length === 1 ? '' : 'en'} sich nicht nachziehen — bitte im Kalender prüfen.`, link: '/os/kalender' });
}

interface AbgleichOpt {
  /** Bezüge (einmal je Lauf geladen). */
  bezuege: BezugBestand;
  /** Ist das UNSER Spiegel? Standard: es gibt einen Bezug zu diesem Termin (angelegt/verknüpft von MAKE OS). */
  gehoert?: (b: TerminBezug | undefined) => boolean;
  /** Klick „Termin anlegen/verknüpfen“: immer auf das Soll bringen. */
  erzwingen?: boolean;
  /** Eine Person hat die Absage ausgelöst → Termin löschen; sonst (Takt) nur melden. */
  loeschenErlaubt: boolean;
}

/**
 * Ein Spiegel mit dem Soll abgleichen (U1 B3: nur mit Änderungsmarke, siehe `spiegelSchritt`). Liefert, ob die UID im
 * Modul bleiben soll (`weg` = gelöscht) oder eine Absage gemeldet werden muss (`abgesagt`, nur ohne `loeschenErlaubt`).
 */
async function abgleichen(s: IcloudStand, uid: string, soll: Soll, wer: ProtokollWer, o: AbgleichOpt): Promise<'bleibt' | 'weg' | 'abgesagt'> {
  const ist = terminNachUid(s, uid);
  if (!ist) return 'bleibt'; // in Apple gelöscht? meldet die Verbindungsprüfung, nie still neu anlegen
  const b = bezugVon(o.bezuege, ist);
  const schritt = spiegelSchritt(soll, b?.spiegel, { bekannt: o.gehoert ? o.gehoert(b) : !!b, erzwingen: o.erzwingen, loeschenErlaubt: o.loeschenErlaubt });
  const marke = spiegelMarke(soll);
  const markeSetzen = async () => { if (marke) await bezugSetzen(ist.id, { spiegel: marke }, undefined, { altSchluessel: ist.uid }); };
  switch (schritt) {
    case 'nichts': return 'bleibt';
    case 'merken': await markeSetzen(); return 'bleibt';
    case 'melden': await markeSetzen(); return 'abgesagt';
    case 'loeschen':
      if (!ist.bearbeitbar) return 'bleibt';
      await terminLoeschenServer(uid, wer);
      return 'weg';
    case 'aendern': {
      if (soll.art !== 'soll' || !ist.bearbeitbar) return 'bleibt';
      const a = spiegelAbweichung(ist, soll.t);
      if (a) await terminAendernServer(uid, a, wer, marke ? { spiegel: marke } : undefined);
      else await markeSetzen();
      return 'bleibt';
    }
  }
}

/** Frischer Stand + Bezüge für einen Klick-Abgleich (erzwingen). */
async function klickAbgleich(uid: string, soll: Soll, wer: ProtokollWer): Promise<void> {
  await abgleichen(await ladeStand(), uid, soll, wer, { bezuege: await ladeBezuege(), erzwingen: true, loeschenErlaubt: false });
}

// ── Events (Make.One) ───────────────────────────────────────────────────────

async function eventUidSetzen(id: string, uid: string | null, wer: ProtokollWer): Promise<void> {
  await aendereCrm(b => ({ ...b, events: b.events.map(e => {
    if (e.id !== id) return e;
    if (uid) return { ...e, kalenderUid: uid };
    const { kalenderUid: _k, ...rest } = e;
    return rest;
  }) }), wer);
}

export async function eventSpiegelLage(id: string): Promise<SpiegelLage> {
  const e = (await ladeCrm()).events.find(x => x.id === id);
  if (!e) throw new KalenderFehler('Event nicht gefunden.', 404);
  const soll = eventSoll(e);
  if (!(await quelleDa())) return { lage: 'ohne-icloud', ...(e.kalenderUid ? { uid: e.kalenderUid } : {}) };
  if (!e.kalenderUid) return soll.art === 'keiner' ? { lage: 'keiner', grund: soll.grund } : { lage: 'fehlt' };
  if (istScheinUid(e.kalenderUid)) return { lage: 'schein', uid: e.kalenderUid };
  const t = terminNachUid(await ladeStand(), e.kalenderUid);
  return t ? { lage: 'da', uid: e.kalenderUid, bearbeitbar: t.bearbeitbar } : { lage: 'fehlt', uid: e.kalenderUid };
}

/** Termin zum Event anlegen (Kalender „Gemeinsam“, echte feste UID, Bezug eventId) — auf Klick. */
export async function eventSpiegelAnlegen(id: string, person: string, wer: ProtokollWer): Promise<{ uid: string }> {
  const e = (await ladeCrm()).events.find(x => x.id === id);
  if (!e) throw new KalenderFehler('Event nicht gefunden.', 404);
  const soll = eventSoll(e);
  if (soll.art === 'weg') throw new KalenderFehler('Das Event ist abgesagt — kein Termin.', 400);
  if (soll.art !== 'soll') throw new KalenderFehler(soll.art === 'keiner' ? soll.grund : 'Kein Termin nötig.', 400);
  const s = await ladeStand();
  // Alte Schein-Kennung (Befund 4): steht der Termin eindeutig im Kalender, wird er verknüpft statt doppelt angelegt —
  // NUR hier, auf Klick (U1 B3).
  if (istScheinUid(e.kalenderUid)) {
    const t = scheinAufloesen(termineImZeitraum(s, e.datum, tagPlus(e.datum, 1)), e);
    if (t?.bearbeitbar) {
      await terminAendernServer(t.uid, {}, wer, { eventId: e.id });
      await eventUidSetzen(e.id, t.uid, wer);
      await klickAbgleich(t.uid, soll, wer);
      return { uid: t.uid };
    }
  }
  if (e.kalenderUid && !istScheinUid(e.kalenderUid) && terminNachUid(s, e.kalenderUid)) {
    await klickAbgleich(e.kalenderUid, soll, wer);
    return { uid: e.kalenderUid };
  }
  // Wessen Kalender: geht genau EINE Person hin (Event.wer, besuchte Events), kommt der Termin in deren Kalender, sonst „beide“ (Gemeinsam).
  const einst = await ladeEinstellungen();
  const hin = e.wer?.length === 1 ? e.wer[0] : undefined;
  const kalenderWer = (hin && (einst.kalender as Record<string, string | undefined>)[hin] ? hin : 'beide') as 'beide';
  // Business (03.10., Google): ein besuchtes Event einer Person kommt in deren Google Kalender (MAKE), sobald sie verbunden ist — sonst wie bisher iCloud.
  const r = await terminAnlegenServer({ ...soll.t, wer: kalenderWer, bereich: 'business', art: 'termin', beschaeftigt: true, uid: spiegelUid('event', e.id), von: person, bezug: { eventId: e.id }, notiz: 'Aus MAKE OS · Event' }, wer);
  // Marke setzen (und bei `schonDa` auf das Soll bringen) — ab jetzt zieht der Abgleich nur nach Änderungen im Event nach.
  await klickAbgleich(r.uid, soll, wer);
  await eventUidSetzen(e.id, r.uid, wer);
  return { uid: r.uid };
}

/**
 * Den Termin eines ABGESAGTEN Events löschen — nur auf Klick (Event-Seite; der Takt meldet die Absage nur, U1 B3).
 * Nur unser Spiegel (Bezug `eventId`), nur Einzeltermine, die MAKE OS ändern darf.
 */
export async function eventSpiegelLoeschen(id: string, wer: ProtokollWer): Promise<{ geloescht: boolean }> {
  const e = (await ladeCrm()).events.find(x => x.id === id);
  if (!e) throw new KalenderFehler('Event nicht gefunden.', 404);
  if (e.status !== 'abgesagt') throw new KalenderFehler('Nur der Termin eines abgesagten Events wird hier gelöscht.', 400);
  if (!(await quelleDa())) throw new KalenderFehler('iCloud ist noch nicht verbunden.', 409);
  if (!e.kalenderUid || istScheinUid(e.kalenderUid)) throw new KalenderFehler('Kein verknüpfter Termin.', 400);
  const r = await abgleichen(await ladeStand(), e.kalenderUid, eventSoll(e), wer, { bezuege: await ladeBezuege(), gehoert: b => b?.eventId === e.id, loeschenErlaubt: true });
  if (r === 'weg') await eventUidSetzen(e.id, null, wer);
  else if (!terminNachUid(await ladeStand(), e.kalenderUid)) await eventUidSetzen(e.id, null, wer);
  else throw new KalenderFehler('Der Termin lässt sich hier nicht löschen (nicht von MAKE OS angelegt, Serie oder mit Gästen) — bitte in Apple löschen.', 409);
  return { geloescht: r === 'weg' };
}

/**
 * Beim LÖSCHEN eines Events (Klick auf „Event löschen“, nie über den Dienstweg): der Spiegel-Termin geht mit — sonst bliebe ein Termin im Kalender, der auf ein
 * Event zeigt, das es nicht mehr gibt (M8). Wie bei einer Absage: nur unser Spiegel (Bezug `eventId`), nur Einzeltermine, die MAKE OS ändern darf.
 * Wirft nie: ein nicht erreichbares iCloud darf das Löschen nicht aufhalten — das Ergebnis sagt, was geschah.
 */
export async function eventSpiegelBeimLoeschen(e: { id: string; kalenderUid?: string } & Parameters<typeof eventSoll>[0], wer: ProtokollWer): Promise<'weg' | 'keiner' | 'bleibt' | 'ohne-icloud' | 'fehler'> {
  if (!e.kalenderUid || istScheinUid(e.kalenderUid)) return 'keiner';
  if (!(await quelleDa())) return 'ohne-icloud';
  try {
    const r = await abgleichen(await ladeStand(), e.kalenderUid, eventSoll({ ...e, status: 'abgesagt' }), wer, { bezuege: await ladeBezuege(), gehoert: b => b?.eventId === e.id, loeschenErlaubt: true });
    return r === 'weg' || !terminNachUid(await ladeStand(), e.kalenderUid) ? 'weg' : 'bleibt';
  } catch { return 'fehler'; }
}

/**
 * Events mit Termin nachziehen. `ids` null = alle. Liefert die Zahl der geprüften, die Hinweise der Einträge, die nicht
 * gingen (F1 #5: je Eintrag abgefangen — die übrigen laufen weiter), und die abgesagten Events, deren Termin noch steht
 * (nur im Takt: dort wird nicht gelöscht, sondern gemeldet).
 * U1 B3: nur Termine, die nachweislich von MAKE OS zu DIESEM Event stammen (Bezug `eventId`); alte `mac-…`-Kennungen nie
 * (die verknüpft nur der Klick); im Takt nur künftige Events (ab heute).
 */
export async function eventSpiegelNachziehen(ids: readonly string[] | null, wer: ProtokollWer, o: { imTakt?: boolean; heute?: string } = {}): Promise<SpiegelErgebnis & { abgesagt: { id: string; titel: string; zustaendig?: string }[] }> {
  const leer = { geprueft: 0, hinweise: [], abgesagt: [] };
  if (!(await quelleDa())) return leer;
  const heute = o.heute ?? localDay();
  const events = (await ladeCrm()).events.filter(e => e.kalenderUid && !istScheinUid(e.kalenderUid) && (!ids || ids.includes(e.id)) && (!o.imTakt || e.datum >= heute));
  if (!events.length) return leer;
  const hinweise: SpiegelHinweis[] = [];
  const abgesagt: { id: string; titel: string; zustaendig?: string }[] = [];
  const s = await ladeStand();
  const bezuege = await ladeBezuege();
  for (const e of events) {
    try {
      const r = await abgleichen(s, e.kalenderUid!, eventSoll(e), wer, { bezuege, gehoert: b => b?.eventId === e.id, loeschenErlaubt: !o.imTakt });
      if (r === 'weg') await eventUidSetzen(e.id, null, wer);
      if (r === 'abgesagt') abgesagt.push({ id: e.id, titel: e.titel, ...(e.zustaendig ? { zustaendig: e.zustaendig } : {}) });
    } catch (err) { hinweise.push({ art: 'event', id: e.id, grund: fehlerGrund(err) }); }
  }
  return { geprueft: events.length, hinweise, abgesagt };
}

/**
 * Abgesagte Events mit stehendem Termin in die Glocke (U1 B3, aus dem Takt — einmal je Absage, die Marke `weg` am Bezug
 * verhindert die Wiederholung). An die Zuständige des Events, bei „beide“/ohne Angabe an alle im Haushalt des Inhabers.
 */
async function absagenMelden(abgesagt: readonly { id: string; titel: string; zustaendig?: string }[]): Promise<void> {
  if (!abgesagt.length) return;
  const personen = (await haushaltsPersonen()).map(p => p.speicher);
  console.warn(`[spiegel] ${abgesagt.length} abgesagte(s) Event(s) mit Termin im Kalender gemeldet: ${abgesagt.map(a => a.id).join(', ').slice(0, 400)}`);
  for (const a of abgesagt) {
    const an = a.zustaendig && personen.includes(a.zustaendig) ? [a.zustaendig] : personen;
    const titel = a.titel.trim().slice(0, 60) || 'Event';
    for (const p of an) await melde({ an: p, art: 'kalender', titel: `„${titel}“ ist abgesagt — der Termin steht noch im Kalender. Löschen auf der Event-Seite.`, link: WEG.event(a.id) });
  }
}

/** Zuletzt im Takt nachgezogen (Prozess-Merker) — der Abgleich läuft höchstens alle 30 Minuten. */
let taktZuletzt = 0;
export const SPIEGEL_TAKT_MS = 30 * 60_000;

/**
 * Events im vorhandenen Takt nachziehen (K6a, 29.09.): Änderungen am Event, die NICHT über den Bestand-PATCH kamen (ZOE,
 * Heads, Import), ziehen den Termin trotzdem nach — höchstens alle 30 Min., nie blockierend, nur mit iCloud. Schreibt
 * wie jeder Spiegel über `terminAendernServer` (Änderungsprotokoll). Liefert die Zahl der geprüften Events (0 = übersprungen).
 */
export async function eventSpiegelImTakt(jetzt = Date.now()): Promise<number> {
  if (jetzt - taktZuletzt < SPIEGEL_TAKT_MS || !(await quelleDa())) return 0;
  taktZuletzt = jetzt;
  const r = await eventSpiegelNachziehen(null, { art: 'system' }, { imTakt: true, heute: localDay(new Date(jetzt)) });
  // Im Takt löst niemand aus — Fehler nur ins Server-Protokoll (F1 #5), keine Glocke alle 30 Minuten. Absagen gehen
  // einmal in die Glocke (Löschen nur auf Klick, U1 B3).
  await spiegelHinweiseMelden(r.hinweise);
  await absagenMelden(r.abgesagt);
  return r.geprueft;
}

/** Nur für Tests: den 30-Minuten-Merker zurücksetzen. */
export function spiegelTaktZuruecksetzen(): void { taktZuletzt = 0; }

// ── Familie (Dates, Paar-Gespräche) ─────────────────────────────────────────

async function familieAendern(h: string, f: (x: Familie) => Familie): Promise<void> {
  await updateJson<Familie>(familieName(h), cur => (cur ? f(cur) : cur as unknown as Familie));
}

/** Date oder Paar-Gespräch in den gemeinsamen Kalender (auf Klick). `id` = Date-Kennung bzw. Datum des Gesprächs. */
export async function familieSpiegelAnlegen(h: string, art: Exclude<SpiegelArt, 'event'>, id: string, person: string, wer: ProtokollWer): Promise<{ uid: string }> {
  const f = await ladeFamilie(h);
  let soll: Soll;
  let vorhanden: string | undefined;
  if (art === 'date') {
    const d = f.dates.find(x => x.id === id);
    if (!d) throw new KalenderFehler('Date nicht gefunden.', 404);
    soll = dateSoll(d); vorhanden = d.kalenderUid;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) throw new KalenderFehler('Datum fehlt.', 400);
    soll = gespraechSoll(id, f.einstellungen.gespraech, f.gespraeche.find(g => g.datum === id)?.status);
    vorhanden = f.einstellungen.kalenderTermine?.[id];
  }
  if (soll.art !== 'soll') throw new KalenderFehler(soll.art === 'keiner' ? soll.grund : 'Kein Termin nötig.', 400);
  const s = await ladeStand();
  if (vorhanden && terminNachUid(s, vorhanden)) { await klickAbgleich(vorhanden, soll, wer); return { uid: vorhanden }; }
  const uid = spiegelUid(art, art === 'date' ? id : `${h}-${id}`);
  const r = await terminAnlegenServer({ ...soll.t, wer: 'beide', art: 'termin', beschaeftigt: true, uid, von: person, notiz: 'Aus MAKE OS · Familie & Partnerschaft' }, wer);
  // Marke setzen (U1 B3; bei `schonDa` zugleich auf das Soll bringen).
  await klickAbgleich(r.uid, soll, wer);
  await familieAendern(h, x => art === 'date'
    ? { ...x, dates: x.dates.map(d => (d.id === id ? { ...d, kalenderUid: r.uid } : d)) }
    : { ...x, einstellungen: { ...x.einstellungen, kalenderTermine: { ...(x.einstellungen.kalenderTermine ?? {}), [id]: r.uid } } });
  return { uid: r.uid };
}

/**
 * Dates und Paar-Gespräche nachziehen (nach einer Änderung in der Familie durch eine Person). F1 #5: je Eintrag
 * abgefangen; was ging, wird gespeichert (Teilergebnis), der Rest kommt als Hinweis zurück. U1 B3: nur künftige
 * Einträge, nur Termine mit Bezug (von MAKE OS angelegt — Termine aus dem alten Stand ohne Bezug bleiben unberührt),
 * überschrieben nur nach einer Änderung im Modul (Marke).
 */
export async function familieSpiegelNachziehen(h: string, wer: ProtokollWer, heute = localDay()): Promise<SpiegelHinweis[]> {
  if (!(await quelleDa())) return [];
  const f = await ladeFamilie(h);
  let s = await ladeStand();
  const bezuege = await ladeBezuege();
  const opt: AbgleichOpt = { bezuege, loeschenErlaubt: true };
  const hinweise: SpiegelHinweis[] = [];
  /** Einen Eintrag abgleichen — ein Fehler wird zum Hinweis, nie zum Abbruch der übrigen. */
  const einzeln = async (art: SpiegelArt, id: string, f2: () => Promise<'bleibt' | 'weg' | 'abgesagt'>): Promise<'bleibt' | 'weg' | 'abgesagt'> => {
    try { return await f2(); } catch (err) { hinweise.push({ art, id, grund: fehlerGrund(err) }); return 'bleibt'; }
  };
  const datesWeg: string[] = [];
  for (const d of f.dates) if (d.kalenderUid && d.datum >= heute && await einzeln('date', d.id, () => abgleichen(s, d.kalenderUid!, dateSoll(d), wer, opt)) === 'weg') datesWeg.push(d.id);
  const termine = { ...(f.einstellungen.kalenderTermine ?? {}) };
  const termineWeg: string[] = [];
  let umgezogen: { von: string; nach: string; uid: string } | null = null;
  // Wochentag geändert → der gemerkte künftige Termin zieht auf das nächste Gespräch um (statt stehen zu bleiben).
  const naechstes = naechstesGespraech(f.einstellungen, heute, f.gespraeche).datum;
  const umzug = gespraecheUmziehen(termine, naechstes, heute, new Set(f.gespraeche.map(g => g.datum)));
  if (umzug) {
    const uid = termine[umzug.von];
    const soll = gespraechSoll(umzug.nach, f.einstellungen.gespraech);
    const ist = terminNachUid(s, uid);
    if (ist?.bearbeitbar && soll.art === 'soll' && bezugVon(bezuege, ist)) {
      try {
        const marke = spiegelMarke(soll);
        await terminAendernServer(uid, { start: soll.t.start, ende: soll.t.ende }, wer, marke ? { spiegel: marke } : undefined);
        umgezogen = { ...umzug, uid };
        delete termine[umzug.von]; termine[umzug.nach] = uid;
        s = await ladeStand();
      } catch (err) { hinweise.push({ art: 'gespraech', id: umzug.von, grund: fehlerGrund(err) }); }
    }
  }
  for (const [datum, uid] of Object.entries(termine)) {
    if (datum < heute) continue;
    const soll = gespraechSoll(datum, f.einstellungen.gespraech, f.gespraeche.find(g => g.datum === datum)?.status);
    if (await einzeln('gespraech', datum, () => abgleichen(s, uid, soll, wer, opt)) === 'weg') termineWeg.push(datum);
  }
  if (!datesWeg.length && !termineWeg.length && !umgezogen) return hinweise;
  // Nur die eigenen Änderungen auf den AKTUELLEN Stand legen (dazwischen gemerkte Termine bleiben).
  await familieAendern(h, x => {
    const t = { ...(x.einstellungen.kalenderTermine ?? {}) };
    if (umgezogen && t[umgezogen.von] === umgezogen.uid && !t[umgezogen.nach]) { delete t[umgezogen.von]; t[umgezogen.nach] = umgezogen.uid; }
    for (const d of termineWeg) delete t[d];
    return {
      ...x,
      dates: x.dates.map(d => { if (!datesWeg.includes(d.id)) return d; const { kalenderUid: _k, ...rest } = d; return rest; }),
      einstellungen: { ...x.einstellungen, kalenderTermine: t },
    };
  });
  return hinweise;
}

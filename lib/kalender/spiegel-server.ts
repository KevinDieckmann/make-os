// ─── Kalender — Spiegel anlegen und nachziehen (Server, 29.09., Paket K5) ────
// Was ein Spiegel ist: lib/kalender/spiegel.ts. Geschrieben wird nur über lib/kalender/termin-server.ts (iCloud →
// kalender-bezug → Änderungsprotokoll). Idempotenz ohne Absichtsprotokoll: die UID ist FEST je Eintrag — bricht ein
// Vorgang zwischen iCloud und Modul ab, findet der nächste Aufruf den Termin (`schonDa`) und schreibt nur die UID nach.
//
// Wer ruft:
//   · Anlegen auf Klick — POST /api/kalender/spiegel (Event-Seite „Termin anlegen“, Familie „in den Kalender“).
//   · Nachziehen nach jeder Änderung im Modul — /api/crm/bestand (Events: Datum, Uhrzeit, Titel, Ort, Status) und
//     /api/familie (Dates, Gespräche, Einstellungen), im Hintergrund; ein Fehler kostet die Änderung im Modul nie.
// Nur mit iCloud; nur Einzeltermine, die MAKE OS ändern darf (`bearbeitbar`) — sonst bleibt es beim Hinweis.
// F1 (Prüfer 1 #5): Das Nachziehen läuft JE EINTRAG in try/catch — ein Termin, der nicht mehr geht (Serie, Gäste, nur
// lesbar, Konflikt), hält die anderen nicht auf; was geklappt hat, wird gespeichert (Teilergebnis). Die Fehler kommen
// als `hinweise` zurück (Kennung + technischer Grund, nie Titel oder Adressen) und gehen über `spiegelHinweiseMelden`
// ins Server-Protokoll und — wenn eine Person die Änderung ausgelöst hat — in ihre Glocke. Nie mehr still.

import { verbunden, ladeStand, termineImZeitraum, findeObjekt, KalenderFehler, HOLEN_VON, HOLEN_BIS, type IcloudStand } from './icloud';
import { termineAus, type Termin } from './ics';
import { tagPlus } from './zeit';
import { terminAnlegenServer, terminAendernServer, terminLoeschenServer } from './termin-server';
import { eventSoll, dateSoll, gespraechSoll, spiegelAbweichung, spiegelUid, istScheinUid, scheinAufloesen, gespraecheUmziehen, type Soll, type SpiegelArt } from './spiegel';
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

/** Ein Spiegel mit dem Soll abgleichen (ändern oder löschen). Liefert, ob die UID im Modul bleiben soll. */
async function abgleichen(s: IcloudStand, uid: string, soll: Soll, wer: ProtokollWer): Promise<'bleibt' | 'weg'> {
  const ist = terminNachUid(s, uid);
  if (!ist) return 'bleibt'; // in Apple gelöscht? meldet die Verbindungsprüfung, nie still neu anlegen
  if (soll.art === 'weg') {
    if (!ist.bearbeitbar) return 'bleibt';
    await terminLoeschenServer(uid, wer);
    return 'weg';
  }
  if (soll.art !== 'soll' || !ist.bearbeitbar) return 'bleibt';
  const a = spiegelAbweichung(ist, soll.t);
  if (a) await terminAendernServer(uid, a, wer);
  return 'bleibt';
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
  if (!verbunden()) return { lage: 'ohne-icloud', ...(e.kalenderUid ? { uid: e.kalenderUid } : {}) };
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
  // Alte Schein-Kennung (Befund 4): steht der Termin eindeutig im Kalender, wird er verknüpft statt doppelt angelegt.
  if (istScheinUid(e.kalenderUid)) {
    const t = scheinAufloesen(termineImZeitraum(s, e.datum, tagPlus(e.datum, 1)), e);
    if (t?.bearbeitbar) {
      await terminAendernServer(t.uid, {}, wer, { eventId: e.id });
      await eventUidSetzen(e.id, t.uid, wer);
      await abgleichen(await ladeStand(), t.uid, soll, wer);
      return { uid: t.uid };
    }
  }
  if (e.kalenderUid && !istScheinUid(e.kalenderUid) && terminNachUid(s, e.kalenderUid)) {
    await abgleichen(s, e.kalenderUid, soll, wer);
    return { uid: e.kalenderUid };
  }
  const r = await terminAnlegenServer({ ...soll.t, wer: 'beide', art: 'termin', beschaeftigt: true, uid: spiegelUid('event', e.id), von: person, bezug: { eventId: e.id }, notiz: 'Aus MAKE OS · Event' }, wer);
  if (r.schonDa) await abgleichen(await ladeStand(), r.uid, soll, wer);
  await eventUidSetzen(e.id, r.uid, wer);
  return { uid: r.uid };
}

/**
 * Events mit Termin nachziehen (nach einer Änderung im CRM). `ids` null = alle. Liefert die Zahl der geprüften und die
 * Hinweise der Einträge, die nicht gingen (F1 #5: je Eintrag abgefangen — die übrigen laufen weiter).
 */
export async function eventSpiegelNachziehen(ids: readonly string[] | null, wer: ProtokollWer): Promise<SpiegelErgebnis> {
  if (!verbunden()) return { geprueft: 0, hinweise: [] };
  const events = (await ladeCrm()).events.filter(e => e.kalenderUid && (!ids || ids.includes(e.id)));
  if (!events.length) return { geprueft: 0, hinweise: [] };
  const hinweise: SpiegelHinweis[] = [];
  let s = await ladeStand();
  for (const e of events) {
    try {
      let uid = e.kalenderUid!;
      if (istScheinUid(uid)) {
        // Befund 4: die erfundene Kennung durch die echte ersetzen — nur bei eindeutigem Treffer (Tag + Titel).
        const t = scheinAufloesen(termineImZeitraum(s, e.datum, tagPlus(e.datum, 1)), e);
        if (!t || !t.bearbeitbar) continue;
        uid = t.uid;
        await terminAendernServer(uid, {}, wer, { eventId: e.id });
        await eventUidSetzen(e.id, uid, wer);
        s = await ladeStand();
      }
      if (await abgleichen(s, uid, eventSoll(e), wer) === 'weg') await eventUidSetzen(e.id, null, wer);
    } catch (err) { hinweise.push({ art: 'event', id: e.id, grund: fehlerGrund(err) }); }
  }
  return { geprueft: events.length, hinweise };
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
  if (!verbunden() || jetzt - taktZuletzt < SPIEGEL_TAKT_MS) return 0;
  taktZuletzt = jetzt;
  const r = await eventSpiegelNachziehen(null, { art: 'system' });
  // Im Takt löst niemand aus — nur das Server-Protokoll (F1 #5), keine Glocke alle 30 Minuten.
  await spiegelHinweiseMelden(r.hinweise);
  return r.geprueft;
}

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
  if (vorhanden && terminNachUid(s, vorhanden)) { await abgleichen(s, vorhanden, soll, wer); return { uid: vorhanden }; }
  const uid = spiegelUid(art, art === 'date' ? id : `${h}-${id}`);
  const r = await terminAnlegenServer({ ...soll.t, wer: 'beide', art: 'termin', beschaeftigt: true, uid, von: person, notiz: 'Aus MAKE OS · Familie & Partnerschaft' }, wer);
  if (r.schonDa) await abgleichen(await ladeStand(), r.uid, soll, wer);
  await familieAendern(h, x => art === 'date'
    ? { ...x, dates: x.dates.map(d => (d.id === id ? { ...d, kalenderUid: r.uid } : d)) }
    : { ...x, einstellungen: { ...x.einstellungen, kalenderTermine: { ...(x.einstellungen.kalenderTermine ?? {}), [id]: r.uid } } });
  return { uid: r.uid };
}

/**
 * Dates und Paar-Gespräche nachziehen (nach einer Änderung in der Familie). F1 #5: je Eintrag abgefangen; was ging,
 * wird gespeichert (Teilergebnis), der Rest kommt als Hinweis zurück.
 */
export async function familieSpiegelNachziehen(h: string, wer: ProtokollWer, heute = localDay()): Promise<SpiegelHinweis[]> {
  if (!verbunden()) return [];
  const f = await ladeFamilie(h);
  let s = await ladeStand();
  const hinweise: SpiegelHinweis[] = [];
  /** Einen Eintrag abgleichen — ein Fehler wird zum Hinweis, nie zum Abbruch der übrigen. */
  const einzeln = async (art: SpiegelArt, id: string, f2: () => Promise<'bleibt' | 'weg'>): Promise<'bleibt' | 'weg'> => {
    try { return await f2(); } catch (err) { hinweise.push({ art, id, grund: fehlerGrund(err) }); return 'bleibt'; }
  };
  const datesWeg: string[] = [];
  for (const d of f.dates) if (d.kalenderUid && await einzeln('date', d.id, () => abgleichen(s, d.kalenderUid!, dateSoll(d), wer)) === 'weg') datesWeg.push(d.id);
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
    if (ist?.bearbeitbar && soll.art === 'soll') {
      try {
        await terminAendernServer(uid, { start: soll.t.start, ende: soll.t.ende }, wer);
        umgezogen = { ...umzug, uid };
        delete termine[umzug.von]; termine[umzug.nach] = uid;
        s = await ladeStand();
      } catch (err) { hinweise.push({ art: 'gespraech', id: umzug.von, grund: fehlerGrund(err) }); }
    }
  }
  for (const [datum, uid] of Object.entries(termine)) {
    if (datum < heute) continue;
    const soll = gespraechSoll(datum, f.einstellungen.gespraech, f.gespraeche.find(g => g.datum === datum)?.status);
    if (await einzeln('gespraech', datum, () => abgleichen(s, uid, soll, wer)) === 'weg') termineWeg.push(datum);
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

// ─── Google Kalender — Schreiben aus MAKE OS (Server, 03.10.2026) ────────────
// Anlegen, Ändern, Löschen und als Gast Antworten — dieselben Regeln wie bei iCloud, mit Googles Mitteln:
//   · ETag: jede Änderung/Löschung geht mit `If-Match` (Google: 412 → Konflikt). `stand` aus der Oberfläche, der ETag des
//     Bestands und der von Google müssen passen, sonst `KalenderKonflikt` (409) mit dem aktuellen Termin — „deine
//     Fassung“ bleibt im Browser. Regel bei gleichzeitiger Änderung: GOOGLE GEWINNT (wir überschreiben nie); die
//     Oberfläche zeigt die andere Fassung und bietet „Meine Fassung speichern“ auf dem neuen Stand an.
//   · Gäste/Einladungen nur nach Klick: ohne `einladungBestaetigt` wirft jeder Weg `EinladungNoetig` (409) VOR dem Aufruf;
//     Google bekommt `sendUpdates=all` NUR nach der Bestätigung, sonst `none` — Google verschickt dann nie Post.
//   · Eigene Kennung: jedes Ereignis trägt `extendedProperties.private.makeOsId` (= UID in MAKE OS); die Google-ID ist aus
//     der UID abgeleitet (`eventIdFuer`) → dasselbe Anlegen zweimal ergibt nie ein Duplikat (409 → `schonDa`). Ein
//     früher gelöschtes Ereignis mit derselben ID wird wiederhergestellt (Google hält die ID reserviert).
//   · Echo: der ETag der Antwort wird als „eigene Schreibung“ gemerkt (`eigene`); der nächste Abgleich erkennt ihn und
//     zählt nichts als „von außen“.
//   · Serien: Anlegen ja (RRULE), Ändern/Löschen NEIN (wie bei iCloud: „in Google Kalender ändern“).
// Nach jedem Schreiben steht das Ergebnis sofort im Bestand (kein Warten auf Push oder Takt).

import { einladungsLage, nichtBearbeitbar, type Aenderung, type Teilnahme } from '../ics';
import { beschaeftigtStandard } from '../arten';
import { kalenderKennung, terminSchluessel } from '../bezug';
import {
  KalenderFehler, KalenderVerboten, KalenderUeberlastet, KalenderZeitueberschreitung, KalenderKonflikt, EinladungNoetig,
  aktuellerTermin, ladeStand, cacheNeuSchreiben, type Fund, type KalenderEintrag, type NeuEingabe,
} from '../icloud';
import { googleAnfrage, GoogleApiFehler, GoogleUeberlastet, type GoogleAntwort } from '@/lib/google/http';
import { GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { ladeGoogleStand, aendereGoogleStand, ereignisseAnwenden, type GoogleKalenderStand } from './stand';
import { schlank, neuBody, patchBody, antwortBody, type GBody, type GEvent } from './abbilden';
import { googleAbgleichen } from './abgleich';

const API = 'https://www.googleapis.com/calendar/v3';
const eventsUrl = (s: Pick<GoogleKalenderStand, 'kalenderId'>, id?: string) => `${API}/calendars/${encodeURIComponent(s.kalenderId)}/events${id ? `/${encodeURIComponent(id)}` : ''}`;

/** Google-Fehler → die Fehler, die die Routen schon kennen (iCloud-Klassen, gleiche Statuscodes). */
export function alsKalenderFehler(e: unknown): never {
  if (e instanceof KalenderFehler) throw e;
  if (e instanceof GoogleVerbindungsFehler) throw new KalenderFehler(e.message, e.status);
  if (e instanceof GoogleUeberlastet) throw new KalenderUeberlastet(e.message, e.sekunden);
  if (e instanceof GoogleApiFehler) {
    if (e.grund === 'timeout') throw new KalenderZeitueberschreitung();
    if (e.status === 403) throw new KalenderVerboten(e.message);
    throw new KalenderFehler(e.message, e.status >= 500 ? 502 : e.status);
  }
  throw e;
}

const googleText = (r: GoogleAntwort): string => {
  const m = (r.json as { error?: { message?: string } } | null)?.error?.message;
  return typeof m === 'string' ? ` — ${m.replace(/[\u0000-\u001f]/g, ' ').slice(0, 160)}` : '';
};

async function standOder404(person: string): Promise<GoogleKalenderStand> {
  const s = await ladeGoogleStand(person);
  if (!s) throw new KalenderFehler('Der Google-Kalender ist noch nicht eingerichtet — bitte in den Kalender-Einstellungen verbinden.', 409);
  return s;
}

/** Ein Ergebnis von Google in den Bestand legen (sofort sichtbar) und als eigene Schreibung merken. */
async function anwenden(person: string, ev: GEvent | null, entfernenId?: string): Promise<void> {
  await aendereGoogleStand(person, cur => {
    const eigene = { ...(cur.eigene ?? {}) };
    let events = cur.events;
    if (ev) { events = ereignisseAnwenden(events, [ev]); if (ev.etag) eigene[ev.id] = ev.etag; }
    if (entfernenId) events = ereignisseAnwenden(events, [{ id: entfernenId, status: 'cancelled' }]);
    return { ...cur, events, eigene: Object.fromEntries(Object.entries(eigene).slice(-200)) };
  });
  await cacheNeuSchreiben();
}

const masterIdVon = (href: string): string => { try { return decodeURIComponent(href.split('/').filter(Boolean).pop() ?? ''); } catch { return ''; } };

// ── Anlegen ─────────────────────────────────────────────────────────────────

export async function googleAnlegen(kal: KalenderEintrag, e: Omit<NeuEingabe, 'kalender' | 'uid'> & { uid: string }, opt: { einladungBestaetigt?: boolean } = {}): Promise<{ uid: string; schluessel: string; kalender: string; gaeste: number; schonDa?: true }> {
  const person = kal.person!;
  const schluessel = terminSchluessel(kalenderKennung(kal.id), e.uid);
  try {
    const st = await standOder404(person);
    const ich = new Set((kal.ich ?? []).map(x => x.toLowerCase()));
    const gaeste = (e.gaeste ?? []).filter(g => !ich.has(g.email.toLowerCase()));
    // Ohne Bestätigung hat `anlegen` (icloud.ts) schon abgelehnt; hier zur Sicherheit noch einmal — Google bekommt nie Gäste ungefragt.
    if (gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('einladung', gaeste.map(g => g.email));
    const body: GBody = neuBody({ ...e, gaeste }, beschaeftigtStandard(e.art ?? 'termin', !!e.ganztags));
    const query = { sendUpdates: gaeste.length ? 'all' : 'none' };
    const id = body.id!;
    let r: GoogleAntwort;
    try { r = await googleAnfrage(person, 'kalender', eventsUrl(st), { method: 'POST', body, query }); }
    catch (err) {
      // Zeitüberschreitung: ob es ankam, ist offen — erst nachsehen, nie ein Duplikat (die ID ist aus der UID abgeleitet).
      if (!(err instanceof GoogleApiFehler) || err.grund !== 'timeout') throw err;
      const da = await googleAnfrage(person, 'kalender', eventsUrl(st, id)).catch(() => null);
      r = da && da.status === 200 ? da : await googleAnfrage(person, 'kalender', eventsUrl(st), { method: 'POST', body, query });
    }
    if (r.status === 409) {
      const da = await googleAnfrage(person, 'kalender', eventsUrl(st, id));
      const vorhanden = schlank(da.json);
      if (da.status !== 200 || !vorhanden) throw new KalenderFehler(`Google hat den Termin nicht angenommen (${r.status})${googleText(r)}.`, 409);
      if (vorhanden.status === 'cancelled') {
        // Früher gelöscht: Google hält die ID reserviert — wiederherstellen (events.update mit status: confirmed).
        const w = await googleAnfrage(person, 'kalender', eventsUrl(st, id), { method: 'PUT', body: { ...body, status: 'confirmed' }, query });
        const ev = schlank(w.json);
        if (w.status !== 200 || !ev) throw new KalenderFehler(`Google hat den Termin nicht angenommen (${w.status})${googleText(w)}.`, w.status);
        await anwenden(person, ev);
        return { uid: e.uid, schluessel, kalender: kal.name, gaeste: gaeste.length };
      }
      await anwenden(person, vorhanden);
      return { uid: e.uid, schluessel, kalender: kal.name, gaeste: 0, schonDa: true };
    }
    const ev = schlank(r.json);
    if (r.status !== 200 || !ev) throw new KalenderFehler(`Google hat den Termin nicht angenommen (${r.status})${googleText(r)}.`, r.status >= 500 ? 502 : r.status === 403 ? 403 : 400);
    await anwenden(person, ev);
    return { uid: e.uid, schluessel, kalender: kal.name, gaeste: gaeste.length };
  } catch (err) { return alsKalenderFehler(err); }
}

// ── Ändern ──────────────────────────────────────────────────────────────────

const inGoogle = (t: string) => t.replace(/Apple Kalender/g, 'Google Kalender').replace(/in Apple/g, 'in Google');

async function konflikt(person: string, ref: string, text: string): Promise<never> {
  await googleAbgleichen(person).catch(() => { /* der Stand zeigt den Fehler */ });
  throw new KalenderKonflikt(text, aktuellerTermin(await ladeStand(), ref));
}

export async function googleAendern(f: Fund, a: Aenderung, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number; schluessel: string; uid: string; eindeutig: boolean }> {
  const person = f.kal.person!;
  try {
    const st = await standOder404(person);
    const ev = st.events[masterIdVon(f.obj.href)];
    if (!ev) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Google gelöscht.', 404);
    const ich = f.kal.ich ?? [];
    const lage = einladungsLage(f.obj.ics, ich);
    if (lage.serie) throw new KalenderFehler('Serientermin — bitte in Google Kalender ändern.', 400);
    if (lage.gast) throw new KalenderFehler('Du bist hier Gast — nur zusagen oder absagen; ändern kann nur, wer eingeladen hat.', 400);
    if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — deine Fassung ist unten noch da.', aktuellerTermin(await ladeStand(), f.schluessel));
    const lower = ich.map(x => x.toLowerCase());
    const betroffen = Array.from(new Set([...lage.gaeste, ...(a.gaeste ?? []).map(g => g.email.toLowerCase()).filter(m => !lower.includes(m))]));
    if (betroffen.length && !opt.einladungBestaetigt) throw new EinladungNoetig(lage.gaeste.length ? 'aenderung' : 'einladung', betroffen);
    const body = patchBody(a, ev);
    if (!Object.keys(body).length) return { gaeste: betroffen.length, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
    const r = await googleAnfrage(person, 'kalender', eventsUrl(st, ev.id), { method: 'PATCH', body, kopf: ev.etag ? { 'If-Match': ev.etag } : {}, query: { sendUpdates: betroffen.length ? 'all' : 'none' } });
    if (r.status === 412) await konflikt(person, f.schluessel, 'Der Termin wurde gerade woanders geändert — deine Fassung ist unten noch da.');
    if (r.status === 404 || r.status === 410) { await anwenden(person, null, ev.id); throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Google gelöscht.', 404); }
    const neu = schlank(r.json);
    if (r.status !== 200 || !neu) throw new KalenderFehler(`Google hat die Änderung nicht angenommen (${r.status})${googleText(r)}.`, r.status >= 500 ? 502 : r.status === 403 ? 403 : 400);
    await anwenden(person, neu);
    return { gaeste: betroffen.length, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
  } catch (err) { return alsKalenderFehler(err); }
}

// ── Löschen ─────────────────────────────────────────────────────────────────

export async function googleLoeschen(f: Fund, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<{ gaeste: number; schluessel?: string; uid?: string; eindeutig?: boolean }> {
  const person = f.kal.person!;
  try {
    const st = await standOder404(person);
    const ev = st.events[masterIdVon(f.obj.href)];
    if (!ev) return { gaeste: 0, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
    const ich = f.kal.ich ?? [];
    if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), f.schluessel));
    const grund = nichtBearbeitbar(f.obj.ics, ich);
    if (grund) throw new KalenderFehler(inGoogle(grund).replace('ändern', 'löschen'), 400);
    const lage = einladungsLage(f.obj.ics, ich);
    if (lage.gaeste.length && !opt.einladungBestaetigt) throw new EinladungNoetig('absage', lage.gaeste);
    const r = await googleAnfrage(person, 'kalender', eventsUrl(st, ev.id), { method: 'DELETE', kopf: ev.etag ? { 'If-Match': ev.etag } : {}, query: { sendUpdates: lage.gaeste.length ? 'all' : 'none' } });
    if (r.status === 412) await konflikt(person, f.schluessel, 'Der Termin wurde gerade woanders geändert — bitte erst ansehen.');
    if (![200, 204, 404, 410].includes(r.status)) throw new KalenderFehler(`Google hat das Löschen nicht angenommen (${r.status})${googleText(r)}.`, r.status >= 500 ? 502 : r.status === 403 ? 403 : 400);
    await anwenden(person, null, ev.id);
    return { gaeste: lage.gaeste.length, schluessel: f.schluessel, uid: f.uid, eindeutig: f.eindeutig };
  } catch (err) { return alsKalenderFehler(err); }
}

// ── Als Gast antworten ──────────────────────────────────────────────────────

export async function googleAntwort(f: Fund, status: Exclude<Teilnahme, 'offen'>, opt: { stand?: string; einladungBestaetigt?: boolean } = {}): Promise<void> {
  const person = f.kal.person!;
  try {
    const st = await standOder404(person);
    const ev = st.events[masterIdVon(f.obj.href)];
    if (!ev) throw new KalenderFehler('Termin nicht gefunden — vielleicht gerade in Google gelöscht.', 404);
    const ich = f.kal.ich ?? [];
    if (opt.stand && f.obj.etag && opt.stand !== f.obj.etag) throw new KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — bitte erst ansehen.', aktuellerTermin(await ladeStand(), f.schluessel));
    const lage = einladungsLage(f.obj.ics, ich);
    if (!lage.gast) throw new KalenderFehler(lage.ichOrganisator ? 'Du hast eingeladen — zusagen oder absagen können nur die Gäste.' : 'Dieser Termin hat keine Einladung.', 400);
    if (!opt.einladungBestaetigt) throw new EinladungNoetig('antwort', lage.empfaenger);
    const r = await googleAnfrage(person, 'kalender', eventsUrl(st, ev.id), { method: 'PATCH', body: antwortBody(ev, ich.map(x => x.toLowerCase()), status), kopf: ev.etag ? { 'If-Match': ev.etag } : {}, query: { sendUpdates: 'all' } });
    if (r.status === 412) await konflikt(person, f.schluessel, 'Der Termin wurde gerade woanders geändert — bitte erst ansehen.');
    const neu = schlank(r.json);
    if (r.status !== 200 || !neu) throw new KalenderFehler(`Google hat die Antwort nicht angenommen (${r.status})${googleText(r)}.`, r.status >= 500 ? 502 : r.status === 403 ? 403 : 400);
    await anwenden(person, neu);
  } catch (err) { return alsKalenderFehler(err); }
}

// ─── Gmail — Abgleich (Server, 03.10.2026) ───────────────────────────────────
// Gmail → MAKE OS (nur Lesen; Schreiben nur auf Klick: lib/gmail/senden.ts, aktion.ts):
//   · Erstabgleich („voll“): die letzten 30 Tage Posteingang + Gesendet (`messages.list`, je Nachricht `format=full`),
//     VORHER wird der `historyId` aus `users.getProfile` gemerkt — was während des Lesens ankommt, holt der nächste Lauf.
//   · danach inkrementell über `history.list` ab dem gemerkten `historyId` (neue Nachrichten, Labels, Löschungen); bei
//     `404` (historyId zu alt, Google hält nur etwa eine Woche) wird der Spiegel verworfen und SOFORT voll neu gelesen.
//   · gespiegelt wird nur, was im Posteingang oder bei „Gesendet“ steht — nie Entwürfe, Spam, Papierkorb.
//   · Echtzeit optional: `users.watch` + Pub/Sub-Push (lib/gmail/meldung.ts). Ohne Pub/Sub fragt der Takt alle 2 Minuten
//     (mit Push alle 15 Minuten als Rückfall).
//   · Fehler: 401 → Token erneuern (lib/google/http.ts), `invalid_grant` → Verbindung „getrennt“ (EINE Glocke), 403-Kontingent/
//     429 → Pause nach `Retry-After`, 5xx/Netz → Backoff. Alles landet im Stand, nie ein Betreff im Protokoll.
//   · Nach jedem Lauf: Aufbewahrung (Frist „Mail-Spiegel“) und der Verlauf der Kontaktakten — seit 06.10. nur für zugeordnete Gespräche
//     (lib/inbox/verlauf.ts).
// Mail-INHALT steht nie in Logs: Fehlerzeilen tragen Statuscodes und Zähler.

import { localDay } from '@/lib/zeit';
import { loadJson } from '@/lib/store/local-db';
import { melde } from '@/lib/meldungen/melden';
import { googleAnfrage, GoogleApiFehler, GoogleUeberlastet } from '@/lib/google/http';
import { ladeVerbindung, GoogleVerbindungsFehler, GOOGLE_FUNKTIONEN, scopesFehlen } from '@/lib/google/verbindung';
import { ladeGoogleStand } from '@/lib/kalender/google/stand';
import { pauseMs, abgleichAlter } from '@/lib/kalender/icloud';
import { LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { nachrichtAus, type GMessage } from './mime';
import { aendereGmailStand, aendereGmailTexte, aufbewahren, ladeGmailStand, setzeGmailStand, adressenText } from './stand';
import { GMAIL_GRENZEN, PERSON_OK, type GmailAlias, type GmailKopf, type GmailStand } from './typen';

export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
/** Was im Spiegel liegt: Posteingang und Gesendet. */
const SPIEGEL_LABELS = ['INBOX', 'SENT'] as const;
/** Was NIE gespiegelt wird. */
const NIE_LABELS = ['DRAFT', 'SPAM', 'TRASH'] as const;

/** Soll eine Nachricht mit diesen Labels im Spiegel liegen? Rein. */
export const gehoertInSpiegel = (labels: readonly string[]): boolean => SPIEGEL_LABELS.some(l => labels.includes(l)) && !NIE_LABELS.some(l => labels.includes(l));

class VerlaufAbgelaufen extends Error { constructor() { super('historyId abgelaufen'); } }

export interface GmailAbgleichErgebnis { voll: boolean; neu: number; geaendert: number; entfernt: number; nachrichten: number }

const laeuft = new Map<string, Promise<GmailAbgleichErgebnis>>();
/** Während eines Laufs kam noch ein Anstoß (Push): danach EINMAL noch einmal lesen. */
const nachlauf = new Set<string>();
export const gmailAbgleichLaeuft = (person: string): boolean => laeuft.has(person);

// ── Google-Aufrufe ──────────────────────────────────────────────────────────

const api = <T = Record<string, unknown>>(person: string, pfad: string, opt: Parameters<typeof googleAnfrage>[3] = {}) => googleAnfrage<T>(person, 'gmail', `${GMAIL_API}${pfad}`, opt);

/** Eine Nachricht vollständig holen — `null`, wenn es sie nicht (mehr) gibt (404). */
export async function nachrichtHolen(person: string, id: string): Promise<GMessage | null> {
  const r = await api<GMessage>(person, `/messages/${encodeURIComponent(id)}`, { query: { format: 'full' } });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.json?.id) throw new GoogleApiFehler(`Nachricht nicht lesbar (${r.status}).`, r.status);
  return r.json;
}

/** Nur Labels (minimal) — für Label-Änderungen. */
async function labelsHolen(person: string, id: string): Promise<{ id: string; threadId: string; labelIds: string[] } | null> {
  const r = await api<{ id: string; threadId: string; labelIds?: string[] }>(person, `/messages/${encodeURIComponent(id)}`, { query: { format: 'minimal' } });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.json?.id) throw new GoogleApiFehler(`Nachricht nicht lesbar (${r.status}).`, r.status);
  return { id: r.json.id, threadId: r.json.threadId, labelIds: r.json.labelIds ?? [] };
}

/** Mit begrenzter Gleichzeitigkeit abarbeiten (Google erlaubt nur so viele Aufrufe je Sekunde; ein Fehler bricht ab). */
async function parallel<T, R>(liste: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const raus: R[] = new Array(liste.length);
  let i = 0;
  const lauf = async () => { while (true) { const k = i++; if (k >= liste.length) return; raus[k] = await fn(liste[k]); } };
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, lauf));
  return raus;
}

async function profil(person: string): Promise<{ emailAddress: string; historyId: string }> {
  const r = await api<{ emailAddress?: string; historyId?: string }>(person, '/profile');
  if (r.status !== 200 || !r.json.historyId || !r.json.emailAddress) throw new GoogleApiFehler(`Postfach nicht lesbar (${r.status}).`, r.status);
  return { emailAddress: r.json.emailAddress.toLowerCase(), historyId: String(r.json.historyId) };
}

async function idsAuflisten(person: string, tage: number): Promise<string[]> {
  const ids = new Set<string>();
  for (const label of SPIEGEL_LABELS) {
    let seite: string | undefined;
    do {
      const r = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(person, '/messages', { query: { labelIds: label, q: `newer_than:${tage}d`, maxResults: 100, pageToken: seite } });
      if (r.status !== 200) throw new GoogleApiFehler(`Postfach nicht lesbar (${r.status}).`, r.status);
      for (const m of r.json.messages ?? []) ids.add(m.id);
      seite = r.json.nextPageToken;
    } while (seite && ids.size < GMAIL_GRENZEN.proLauf * 2);
  }
  return Array.from(ids);
}

interface Verlauf { neu: Set<string>; geloescht: Set<string>; labels: Set<string>; historyId: string }

/** `history.list` ab einem `historyId` lesen. 404 → `VerlaufAbgelaufen` (voller Neuabgleich). */
async function verlaufLesen(person: string, ab: string): Promise<Verlauf> {
  const v: Verlauf = { neu: new Set(), geloescht: new Set(), labels: new Set(), historyId: ab };
  let seite: string | undefined;
  do {
    const r = await api<{ history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[]; messagesDeleted?: { message: { id: string } }[]; labelsAdded?: { message: { id: string } }[]; labelsRemoved?: { message: { id: string } }[] }[]; historyId?: string; nextPageToken?: string }>(
      person, '/history', { query: { startHistoryId: ab, maxResults: 500, pageToken: seite } });
    if (r.status === 404) throw new VerlaufAbgelaufen();
    if (r.status !== 200) throw new GoogleApiFehler(`Verlauf nicht lesbar (${r.status}).`, r.status);
    for (const h of r.json.history ?? []) {
      for (const a of h.messagesAdded ?? []) v.neu.add(a.message.id);
      for (const d of h.messagesDeleted ?? []) v.geloescht.add(d.message.id);
      for (const l of [...(h.labelsAdded ?? []), ...(h.labelsRemoved ?? [])]) v.labels.add(l.message.id);
    }
    if (r.json.historyId) v.historyId = String(r.json.historyId);
    seite = r.json.nextPageToken;
  } while (seite);
  return v;
}

// ── Aufbewahrung ────────────────────────────────────────────────────────────

/** Die Grenze für den Spiegel (Tag) — Frist „Mail-Spiegel“ aus den Löschfristen (Standard 180 Tage). */
export async function spiegelGrenze(heute = localDay()): Promise<string> {
  const f = fristenWirksam((await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER))?.fristen);
  return stichtag('mail-spiegel', f['mail-spiegel'], heute);
}

// ── Ein Lauf ────────────────────────────────────────────────────────────────

interface Neues { kopf: GmailKopf; text: string }

async function laden(person: string, ids: readonly string[], max = Number.POSITIVE_INFINITY): Promise<Neues[]> {
  const liste = await parallel(ids.slice(0, max), 6, async id => {
    const m = await nachrichtHolen(person, id);
    if (!m) return null;
    const { kopf, text } = nachrichtAus(m);
    return gehoertInSpiegel(kopf.labels) ? { kopf, text } : null;
  });
  return liste.filter((x): x is Neues => !!x);
}

async function einmal(person: string, voll: boolean): Promise<GmailAbgleichErgebnis> {
  const alt = await ladeGmailStand(person);
  const heute = localDay();
  const grenze = await spiegelGrenze(heute);
  let neuKoepfe: Neues[] = [];
  let entfernt: string[] = [];
  let labelsNeu: Record<string, string[]> = {};
  let historyId = alt?.historyId ?? '';
  let email = alt?.email ?? '';
  let wirklichVoll = voll || !alt?.historyId;

  if (!wirklichVoll) {
    try {
      const v = await verlaufLesen(person, alt!.historyId!);
      historyId = v.historyId;
      entfernt = Array.from(v.geloescht).filter(id => !!alt!.koepfe[id]);
      const unbekannt = Array.from(v.neu).filter(id => !alt!.koepfe[id] && !v.geloescht.has(id));
      // Label-Änderungen: bekannte Nachrichten → neue Labels (fällt etwas in Spam/Papierkorb → raus); unbekannte mit INBOX/SENT → laden.
      const labelIds = Array.from(v.labels).filter(id => !v.geloescht.has(id) && !unbekannt.includes(id));
      const minimal = await parallel(labelIds, 6, id => labelsHolen(person, id));
      const nachladen = [...unbekannt];
      minimal.forEach((m, i) => {
        const id = labelIds[i];
        if (!m) { if (alt!.koepfe[id]) entfernt.push(id); return; }
        // Eine schon gespiegelte Nachricht bleibt, auch wenn sie archiviert wurde (kein INBOX mehr) — raus nur bei Spam/Papierkorb/Entwurf.
        if (alt!.koepfe[id]) { if (!NIE_LABELS.some(l => m.labelIds.includes(l))) labelsNeu[id] = m.labelIds; else entfernt.push(id); }
        else if (gehoertInSpiegel(m.labelIds)) nachladen.push(id);
      });
      neuKoepfe = await laden(person, nachladen);
    } catch (e) {
      if (e instanceof VerlaufAbgelaufen) wirklichVoll = true; else throw e;
    }
  }
  if (wirklichVoll) {
    // Erst den Zähler merken, dann lesen — nichts geht zwischen den beiden Schritten verloren.
    const p = await profil(person);
    email = p.emailAddress;
    historyId = p.historyId;
    const ids = await idsAuflisten(person, GMAIL_GRENZEN.erstTage);
    neuKoepfe = await laden(person, ids, GMAIL_GRENZEN.proLauf);
    entfernt = []; labelsNeu = {};
  }

  const jetzt = new Date().toISOString();
  let geaendert = 0, neuZahl = 0, weg = 0;
  const neuerStand = await (async () => {
    const f = (s: GmailStand): GmailStand => {
      const basis = wirklichVoll ? {} : { ...s.koepfe };
      for (const id of entfernt) if (basis[id]) { delete basis[id]; weg++; }
      for (const [id, labels] of Object.entries(labelsNeu)) if (basis[id] && JSON.stringify(basis[id].labels) !== JSON.stringify(labels)) { basis[id] = { ...basis[id], labels }; geaendert++; }
      for (const n of neuKoepfe) { if (!basis[n.kopf.id]) neuZahl++; else if (JSON.stringify(basis[n.kopf.id].labels) !== JSON.stringify(n.kopf.labels)) geaendert++; basis[n.kopf.id] = n.kopf; }
      const { rest, weg: alte } = aufbewahren(basis, grenze);
      alte.forEach(() => { weg++; });
      const { fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, getrenntGemeldet: _g, ...ohneFehler } = s;
      return { ...ohneFehler, email: email || s.email, historyId, koepfe: rest, at: jetzt, ...(wirklichVoll ? { letzterVoll: jetzt, fensterAb: grenze } : {}), zuletzt: { neu: neuZahl, geaendert, entfernt: weg, voll: wirklichVoll } };
    };
    if (alt) return aendereGmailStand(person, f);
    const leer: GmailStand = { v: 1, person, email, koepfe: {} };
    await setzeGmailStand(person, f(leer));
    return ladeGmailStand(person);
  })();
  if (!neuerStand) throw new GoogleApiFehler('Der Gmail-Spiegel wurde währenddessen entfernt.', 409);

  // Texte: neue dazu, entfernte und aufgebrauchte weg.
  await aendereGmailTexte(person, t => {
    const texte = wirklichVoll ? {} : { ...t.texte };
    for (const n of neuKoepfe) texte[n.kopf.id] = { adressen: adressenText(n.kopf), t: n.text };
    for (const id of Object.keys(texte)) if (!neuerStand.koepfe[id]) delete texte[id];
    return { v: 1, texte };
  });

  // Ereignisse (09.10., E1): neue EINGEHENDE Nachrichten → Agenten (nur Kennungen, nur für diese Person) — nie beim vollen Neu-Lesen.
  if (!wirklichVoll && neuKoepfe.length) await import('@/lib/ereignisse/quellen').then(q => q.gmailEreignisse(person, neuKoepfe.map(n => n.kopf), neuerStand)).catch(() => 0);
  // Verlauf der Kontaktakten (Betreff + Link, nie der Text) — Fehler hier stören den Abgleich nie.
  // „Senden als“-Aliase (Cache 6 Std.) — gehören zu den eigenen Adressen (Zuordnung, Antwort an alle) und zur Absenderwahl.
  await aliaseSicherstellen(person).catch(() => { /* später */ });
  // Inbox 2 (06.10., Kevin: „jede Übernahme braucht einen Klick“): nur Gespräche, die die Person „Zugeordnet“ hat (lib/inbox/verlauf.ts).
  await import('@/lib/inbox/verlauf').then(v => v.verlaufNachziehen(person)).catch(e => console.warn(`[gmail] Verlauf: ${e instanceof Error ? e.name : 'Fehler'}`));
  return { voll: wirklichVoll, neu: neuZahl, geaendert, entfernt: weg, nachrichten: Object.keys(neuerStand.koepfe).length };
}

/** Fehler in den Zustand des Bestands übersetzen (Pause, Anmeldung getrennt …). */
function fehlerZustand(e: unknown, alt: GmailStand): Pick<GmailStand, 'fehler' | 'fehlerAt' | 'fehlerAnmeldung' | 'fehlerFolge' | 'pauseBis'> {
  const anmeldung = e instanceof GoogleVerbindungsFehler && (e.code === 'getrennt' || e.code === 'scope-fehlt' || e.code === 'nicht-verbunden');
  const sekunden = e instanceof GoogleUeberlastet ? e.sekunden : undefined;
  const folge = (alt.fehlerFolge ?? 0) + 1;
  const jetzt = Date.now();
  const text = e instanceof Error ? e.message.slice(0, 300) : 'Gmail nicht erreichbar.';
  return { fehler: text, fehlerAt: new Date(jetzt).toISOString(), fehlerAnmeldung: anmeldung, fehlerFolge: folge, pauseBis: new Date(jetzt + pauseMs(folge, anmeldung, sekunden)).toISOString() };
}

/** Ist Gmail für diese Person eingerichtet (verbunden, Funktion zugeschaltet, Scope gewährt)? */
export async function gmailBereit(person: string): Promise<boolean> {
  const v = await ladeVerbindung(person);
  return !!v && v.status === 'verbunden' && v.funktionen.includes('gmail') && !scopesFehlen(v.scopes, GOOGLE_FUNKTIONEN.gmail.scopes).length;
}

/**
 * Mit Gmail abgleichen. Läuft nie doppelt je Person (ein laufender Abgleich wird geteilt). Fehler werfen weiter UND stehen im
 * Bestand (Pause, „vor X Min.“). `voll`: den Spiegel verwerfen und neu lesen.
 */
export async function gmailAbgleichen(person: string, opt: { voll?: boolean; nachlauf?: boolean } = {}): Promise<GmailAbgleichErgebnis> {
  if (!PERSON_OK.test(person)) throw new GoogleVerbindungsFehler('person', 'Diese Verbindung gehört einer anderen Person.', 403);
  const l = laeuft.get(person);
  if (l && !opt.voll) { if (opt.nachlauf) nachlauf.add(person); return l; }
  while (laeuft.has(person)) await laeuft.get(person)!.catch(() => { /* der Fehler steht im Stand */ });
  const p = (async () => {
    try {
      const v = await ladeVerbindung(person);
      if (!v || v.status !== 'verbunden') throw new GoogleVerbindungsFehler(v ? 'getrennt' : 'nicht-verbunden', v ? 'Die Google-Verbindung ist getrennt — bitte neu verbinden.' : 'Google ist für diese Person nicht verbunden.', 409);
      if (!(await gmailBereit(person))) throw new GoogleVerbindungsFehler('scope-fehlt', 'Gmail ist für diese Person nicht freigegeben — bitte „Gmail verbinden“ in der Inbox.', 409);
      return await einmal(person, !!opt.voll);
    } catch (e) {
      const alt = await ladeGmailStand(person);
      if (alt) {
        const z = fehlerZustand(e, alt);
        let melden = false;
        await aendereGmailStand(person, cur => { melden = !!z.fehlerAnmeldung && !cur.getrenntGemeldet; return { ...cur, ...z, ...(z.fehlerAnmeldung ? { getrenntGemeldet: true } : {}) }; });
        // Eine Verbindung, EINE Glocke: hat der Kalender es schon gemeldet, meldet Gmail nicht noch einmal.
        if (melden && !(await ladeGoogleStand(person))?.getrenntGemeldet) await melde({ an: person, art: 'kalender', titel: 'Die Google-Verbindung ist getrennt — bitte in der Inbox („Gmail verbinden“) neu verbinden.', link: '/os/inbox' });
      }
      throw e;
    }
  })().finally(() => {
    laeuft.delete(person);
    if (nachlauf.delete(person)) void gmailAbgleichen(person).catch(() => { /* der Fehler steht im Stand */ });
  });
  laeuft.set(person, p);
  return p;
}

/** Ist ein Abgleich fällig? (frisch bis `minAlterMs`, nach Fehler erst nach der Pause) */
export function gmailFaellig(s: { at?: string; fehlerAt?: string; pauseBis?: string; fehlerAnmeldung?: boolean; watch?: { ablauf: number } } | null, jetzt = Date.now()): boolean {
  if (!s) return true;
  const intervall = s.watch && s.watch.ablauf > jetzt ? 15 * 60_000 : 2 * 60_000;
  if (s.at && jetzt - Date.parse(s.at) < intervall) return false;
  if (s.fehlerAt && (!s.at || s.fehlerAt > s.at)) {
    if (s.pauseBis && Number.isFinite(Date.parse(s.pauseBis))) return jetzt >= Date.parse(s.pauseBis);
    return jetzt - Date.parse(s.fehlerAt) >= (s.fehlerAnmeldung ? 30 * 60_000 : 2 * 60_000);
  }
  return true;
}

/** „Letzter Abgleich vor X Min.“ — dieselbe Form wie Kalender (`abgleichAlter`). */
export function gmailAlter(s: GmailStand | null, jetzt = Date.now()): ReturnType<typeof abgleichAlter> | null {
  return s ? abgleichAlter(s, jetzt) : null;
}

// ── Senden-als und Push ─────────────────────────────────────────────────────

/** „Senden als“-Adressen (Gmail: Einstellungen › Konten) — nur verifizierte, die eigene Adresse zuerst. */
export async function aliaseLaden(person: string): Promise<GmailAlias[]> {
  const r = await api<{ sendAs?: { sendAsEmail?: string; displayName?: string; isDefault?: boolean; isPrimary?: boolean; verificationStatus?: string }[] }>(person, '/settings/sendAs');
  if (r.status !== 200) throw new GoogleApiFehler(`Senden-als nicht lesbar (${r.status}).`, r.status);
  const liste: GmailAlias[] = (r.json.sendAs ?? []).flatMap(a => {
    const email = (a.sendAsEmail ?? '').trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return [];
    return [{ email, ...(a.displayName ? { name: a.displayName.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) } : {}), ...(a.isDefault || a.isPrimary ? { standard: true } : {}), verifiziert: !a.verificationStatus || a.verificationStatus === 'accepted' }];
  });
  return liste.sort((a, b) => Number(!!b.standard) - Number(!!a.standard));
}

/** Aliase im Stand auffrischen (höchstens alle 6 Stunden, sonst Cache). */
export async function aliaseSicherstellen(person: string, erzwingen = false): Promise<GmailAlias[]> {
  const s = await ladeGmailStand(person);
  if (!s) return [];
  if (!erzwingen && s.aliase && s.aliaseAt && Date.now() - Date.parse(s.aliaseAt) < 6 * 3600_000) return s.aliase;
  const liste = await aliaseLaden(person);
  await aendereGmailStand(person, cur => ({ ...cur, aliase: liste, aliaseAt: new Date().toISOString() }));
  return liste;
}

/** Erste Einrichtung nach dem Verbinden: voller Abgleich + Aliase (Fehler stehen im Stand, der Takt versucht es wieder). */
export async function gmailEinrichten(person: string): Promise<GmailAbgleichErgebnis> {
  const r = await gmailAbgleichen(person, { voll: true });
  await aliaseSicherstellen(person, true).catch(() => { /* später */ });
  return r;
}

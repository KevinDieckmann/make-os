// ─── Postfächer — IMAP-Abgleich (Server, 06.10.2026) ────────────────────────────────────────────────────────────
// Anbieter → MAKE OS (nur Lesen; Schreiben nur auf Klick: lib/postfach/aktion.ts, senden.ts):
//   · je Postfach Posteingang und Gesendet (SPECIAL-USE \Sent bzw. bekannter Name), Fenster: Erstabgleich die letzten 30 Tage, danach
//     dieselben Tage weiter (nie vor der Frist „Mail-Spiegel“); höchstens `proLauf` neue Nachrichten je Lauf (der Rest folgt)
//   · stabile Kennung `<postfach>:<ordner>:<UIDVALIDITY>:<UID>`; ändert der Server UIDVALIDITY → Abschnitt verwerfen, neu lesen
//   · neue UIDs: Flags, Eingang, BODYSTRUCTURE und die Quelle bis 256 KB (Kopf + Text; große Anhänge bleiben beim Anbieter);
//     bekannte UIDs: nur die Flags (gelesen/markiert); verschwundene UIDs fallen aus dem Spiegel (woanders verschoben/gelöscht)
//   · gelesen wird mit `\Seen`-freiem Abruf (BODY.PEEK) — MAKE OS markiert nie still als gelesen
// Fehler: Anmeldung abgelehnt → „Verbindung erneuern“ (EINE Glocke), danach KEINE weiteren Anmeldeversuche (Apple sperrt sonst), bis
// die Person erneuert oder ausdrücklich neu versucht; Netz/Server → Pause 5 · 3^(n−1) Min. (wie Kalender/Gmail). Nie Betreff oder
// Adresse im Protokoll.

import { localDay, tagePlus } from '@/lib/zeit';
import { loadJson } from '@/lib/store/local-db';
import { melde } from '@/lib/meldungen/melden';
import { pauseMs } from '@/lib/kalender/icloud';
import { LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { nachrichtAus } from '@/lib/gmail/mime';
import { adressenText } from '@/lib/gmail/stand';
import { ladePostfach, zugangLesen } from './register';
import { leitungen, PostfachFehler, FEHLER_TEXT, fehlerUebersetzen, type Abruf, type ImapSitzung } from './transport';
import { anhaengeAusStruktur, ausschnittAus, istAutomatisch, rohZuNachricht } from './rfc822';
import { aendereImapStand, aendereImapTexte, imapAufbewahren, kopfId, koepfeVon, ladeImapStand, type ImapKopf, type OrdnerArt, type PostfachSync } from './spiegel';
import { POSTFACH_GRENZEN, PERSON_OK, type Postfach } from './typen';

/** Die Grenze für den Spiegel (Tag) — Frist „Mail-Spiegel“ aus den Löschfristen (Standard 180 Tage), wie Gmail. */
export async function spiegelGrenze(heute = localDay()): Promise<string> {
  const f = fristenWirksam((await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER))?.fristen);
  return stichtag('mail-spiegel', f['mail-spiegel'], heute);
}

/** IMAP-Flags → die Labels der Gmail-Form (rein). */
export function labelsAus(o: OrdnerArt, flags: readonly string[]): string[] {
  const l: string[] = [];
  if (o === 'e') l.push('INBOX');
  if (o === 'g') l.push('SENT');
  if (o !== 'g' && !flags.includes('\\Seen')) l.push('UNREAD');
  if (flags.includes('\\Flagged')) l.push('STARRED');
  return l;
}

/** Eine geholte Nachricht → Kopf + Text (rein). */
export function kopfAusAbruf(postfach: string, o: OrdnerArt, uidValidity: string, a: Abruf): { kopf: ImapKopf; text: string } {
  const id = kopfId(postfach, o, uidValidity, a.uid);
  const m = rohZuNachricht(a.quelle, { id, threadId: '', labels: labelsAus(o, a.flags), ...(a.internalDate ? { internalDateMs: Date.parse(a.internalDate) } : {}), ...(a.groesse ? { groesse: a.groesse } : {}) });
  const { kopf, text } = nachrichtAus(m);
  const h = m.payload?.headers ?? [];
  const listeId = h.some(x => x.name.toLowerCase() === 'list-id');
  const automatisch = istAutomatisch(h);
  const anhaenge = a.struktur ? anhaengeAusStruktur(a.struktur) : kopf.anhaenge;
  const wurzel = kopf.references?.[0] ?? kopf.inReplyTo ?? kopf.messageId ?? `<${id}>`;
  return {
    kopf: { ...kopf, threadId: '', ausschnitt: ausschnittAus(text), anhaenge, ...(listeId ? { liste: true } : {}), ...(automatisch ? { automatisch: true } : {}), postfachId: postfach, ordner: o, uidValidity, uid: a.uid, wurzel },
    text,
  };
}

export interface ImapAbgleichErgebnis { neu: number; geaendert: number; entfernt: number; nachrichten: number }

const laeuft = new Map<string, Promise<ImapAbgleichErgebnis>>();
const nachlauf = new Set<string>();
const schluessel = (person: string, postfach: string) => `${person}|${postfach}`;
export const imapAbgleichLaeuft = (person: string, postfach: string): boolean => laeuft.has(schluessel(person, postfach));

/** Zugang für die Leitung (nur serverseitig). Wirft `anmeldung`, wenn das Passwort fehlt. */
export async function zugangFuer(person: string, p: Postfach): Promise<{ host: string; port: number; benutzer: string; passwort: string }> {
  const passwort = await zugangLesen(person, p.id);
  if (!passwort || !p.imap) throw new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
  return { host: p.imap.host, port: p.imap.port, benutzer: p.benutzer ?? p.adresse, passwort };
}

/** Eine angemeldete Sitzung für ein Postfach (Demo oder echt). */
export async function sitzungFuer(person: string, p: Postfach): Promise<ImapSitzung> {
  const l = await leitungen(p.anbieter === 'demo');
  return l.imap(await zugangFuer(person, p));
}

interface Gelesen { kopf: ImapKopf; text: string }

async function ordnerLesen(s: ImapSitzung, p: Postfach, o: 'e' | 'g', pfad: string, alt: PostfachSync, bekannte: ImapKopf[], seit: string): Promise<{ uidValidity: string; neu: Gelesen[]; flags: Map<string, string[]>; weg: string[]; verworfen: boolean }> {
  const stand = await s.oeffnen(pfad);
  const verworfen = !!alt.ordner[o] && alt.ordner[o]!.uidValidity !== stand.uidValidity;
  const imOrdner = bekannte.filter(k => k.ordner === o && (!verworfen && k.uidValidity === stand.uidValidity));
  const jetzt = new Set(await s.uids(seit));
  const bekanntUid = new Map(imOrdner.map(k => [k.uid, k]));
  const neuUids = Array.from(jetzt).filter(u => !bekanntUid.has(u)).sort((a, b) => b - a).slice(0, POSTFACH_GRENZEN.proLauf);
  const weg = imOrdner.filter(k => !jetzt.has(k.uid)).map(k => k.id);
  const abrufe = await s.holen(neuUids, POSTFACH_GRENZEN.quelleMax);
  const neu = abrufe.map(a => kopfAusAbruf(p.id, o, stand.uidValidity, a));
  const flags = new Map<string, string[]>();
  const bleiben = imOrdner.filter(k => jetzt.has(k.uid)).map(k => k.uid);
  for (const f of await s.flags(bleiben)) { const k = bekanntUid.get(f.uid); if (k) flags.set(k.id, labelsAus(o, f.flags)); }
  return { uidValidity: stand.uidValidity, neu, flags, weg, verworfen };
}

async function einmal(person: string, p: Postfach): Promise<ImapAbgleichErgebnis> {
  const heute = localDay();
  const grenze = await spiegelGrenze(heute);
  const alt = await ladeImapStand(person);
  const sync: PostfachSync = alt.postfaecher[p.id] ?? { ordner: {} };
  const fensterAb = sync.fensterAb ?? tagePlus(heute, -POSTFACH_GRENZEN.erstTage);
  const seit = fensterAb > grenze ? fensterAb : grenze;
  const bekannte = koepfeVon(alt, p.id);
  const s = await sitzungFuer(person, p);
  const ergebnisse: { o: 'e' | 'g'; pfad: string; r: Awaited<ReturnType<typeof ordnerLesen>> }[] = [];
  try {
    const ordner = p.ordner ?? { posteingang: 'INBOX' };
    ergebnisse.push({ o: 'e', pfad: ordner.posteingang, r: await ordnerLesen(s, p, 'e', ordner.posteingang, sync, bekannte, seit) });
    if (ordner.gesendet) ergebnisse.push({ o: 'g', pfad: ordner.gesendet, r: await ordnerLesen(s, p, 'g', ordner.gesendet, sync, bekannte, seit) });
  } finally { await s.schliessen(); }

  const jetzt = new Date().toISOString();
  let neuZahl = 0, geaendert = 0, entfernt = 0;
  let wegTexte: string[] = [];
  const neueTexte: Gelesen[] = ergebnisse.flatMap(e => e.r.neu);
  const st = await aendereImapStand(person, cur => {
    const koepfe = { ...cur.koepfe };
    for (const { o, r } of ergebnisse) {
      if (r.verworfen) for (const k of Object.values(koepfe)) if (k.postfachId === p.id && k.ordner === o) { delete koepfe[k.id]; entfernt++; }
      for (const id of r.weg) if (koepfe[id]) { delete koepfe[id]; entfernt++; }
      for (const [id, labels] of r.flags) if (koepfe[id] && JSON.stringify(koepfe[id].labels) !== JSON.stringify(labels)) { koepfe[id] = { ...koepfe[id], labels }; geaendert++; }
      for (const n of r.neu) { if (!koepfe[n.kopf.id]) neuZahl++; koepfe[n.kopf.id] = n.kopf; }
    }
    const { rest, weg } = imapAufbewahren(koepfe, grenze);
    wegTexte = weg.concat(Object.keys(cur.koepfe).filter(id => !rest[id]));
    entfernt += weg.length;
    const { fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, getrenntGemeldet: _g, ...ohneFehler } = cur.postfaecher[p.id] ?? { ordner: {} };
    const ordnerStand = { ...ohneFehler.ordner };
    for (const e of ergebnisse) ordnerStand[e.o] = { pfad: e.pfad, uidValidity: e.r.uidValidity };
    return { ...cur, koepfe: rest, postfaecher: { ...cur.postfaecher, [p.id]: { ...ohneFehler, ordner: ordnerStand, fensterAb, at: jetzt, zuletzt: { neu: neuZahl, geaendert, entfernt } } } };
  });
  const w = new Set(wegTexte);
  await aendereImapTexte(person, t => {
    const texte = { ...t.texte };
    for (const n of neueTexte) texte[n.kopf.id] = { adressen: adressenText(n.kopf), t: n.text };
    for (const id of Object.keys(texte)) if (w.has(id) || (!st.koepfe[id] && id.startsWith(`${p.id}:`))) delete texte[id];
    return { v: 1, texte };
  });
  // Verlauf der Kontaktakte nur für Gespräche, die die Person „Zugeordnet“ hat (lib/inbox/verlauf.ts) — Fehler stören den Abgleich nie.
  if (neuZahl) await import('@/lib/inbox/verlauf').then(v => v.verlaufNachziehen(person)).catch(x => console.warn(`[postfach] Verlauf: ${x instanceof Error ? x.name : 'Fehler'}`));
  return { neu: neuZahl, geaendert, entfernt, nachrichten: koepfeVon(st, p.id).length };
}

/** Fehler in den Zustand des Postfachs übersetzen (rein). */
export function fehlerZustand(e: PostfachFehler, alt: PostfachSync, jetzt = Date.now()): Pick<PostfachSync, 'fehler' | 'fehlerAt' | 'fehlerAnmeldung' | 'fehlerFolge' | 'pauseBis'> {
  const anmeldung = e.code === 'anmeldung';
  const folge = (alt.fehlerFolge ?? 0) + 1;
  return { fehler: e.message.slice(0, 300), fehlerAt: new Date(jetzt).toISOString(), fehlerAnmeldung: anmeldung, fehlerFolge: folge, pauseBis: new Date(jetzt + pauseMs(folge, anmeldung)).toISOString() };
}

/**
 * Ein Postfach abgleichen. Läuft nie doppelt je Person × Postfach (ein laufender Lauf wird geteilt; ein Anstoß währenddessen
 * führt zu EINEM Nachlauf). `erzwingen`: auch nach abgelehnter Anmeldung (Knopf „Noch einmal versuchen“ der Person).
 */
export async function imapAbgleichen(person: string, postfach: string, opt: { erzwingen?: boolean; nachlauf?: boolean } = {}): Promise<ImapAbgleichErgebnis> {
  if (!PERSON_OK.test(person)) throw new PostfachFehler('ziel', 'Keine Person.', 403);
  const key = schluessel(person, postfach);
  const l = laeuft.get(key);
  if (l) { if (opt.nachlauf) nachlauf.add(key); return l; }
  const lauf = (async () => {
    const p = await ladePostfach(person, postfach);
    if (!p || p.quelle !== 'imap') throw new PostfachFehler('ordner', 'Dieses Postfach gibt es nicht (mehr).', 404);
    const zustand = (await ladeImapStand(person)).postfaecher[postfach];
    if (zustand?.fehlerAnmeldung && !opt.erzwingen) throw new PostfachFehler('anmeldung', 'Die Anmeldung wurde abgelehnt — bitte „Verbindung erneuern“.');
    try {
      return await einmal(person, p);
    } catch (roh) {
      const e = fehlerUebersetzen(roh);
      let melden = false;
      await aendereImapStand(person, cur => {
        const alt = cur.postfaecher[postfach] ?? { ordner: {} };
        const z = fehlerZustand(e, alt);
        melden = !!z.fehlerAnmeldung && !alt.getrenntGemeldet;
        return { ...cur, postfaecher: { ...cur.postfaecher, [postfach]: { ...alt, ...z, ...(z.fehlerAnmeldung ? { getrenntGemeldet: true } : {}) } } };
      });
      // EINE Glocke je Abbruch — ohne Adresse, ohne Anbieter-Text (Telegram-Regel: neutral).
      if (melden) await melde({ an: person, art: 'postfach', titel: `Ein Postfach braucht eine neue Anmeldung — bitte in der Inbox „Verbindung erneuern“.`, link: '/os/inbox?postfaecher=1' });
      throw e;
    }
  })().finally(() => {
    laeuft.delete(key);
    if (nachlauf.delete(key)) void imapAbgleichen(person, postfach).catch(() => { /* der Fehler steht im Stand */ });
  });
  laeuft.set(key, lauf);
  return lauf;
}

/** Ist ein Abgleich fällig? Ohne IDLE alle 2 Min., mit laufendem IDLE alle 15 Min.; nach Fehler erst nach der Pause; nach abgelehnter Anmeldung nie. Rein. */
export function imapFaellig(s: PostfachSync | undefined, jetzt = Date.now()): boolean {
  if (!s) return true;
  if (s.fehlerAnmeldung) return false;
  const intervall = s.idleSeit ? 15 * 60_000 : 2 * 60_000;
  if (s.fehlerAt && (!s.at || s.fehlerAt > s.at)) return s.pauseBis ? jetzt >= Date.parse(s.pauseBis) : jetzt - Date.parse(s.fehlerAt) >= 2 * 60_000;
  return !s.at || jetzt - Date.parse(s.at) >= intervall;
}

// ─── Postfächer — das Register je Person und die Zugangsdaten (Server, 06.10.2026) ────────────────────────────────
// Zwei Bestände je Person (verschlüsselte Hülle wie jeder Bestand, lib/store/local-db.ts):
//   `postfaecher--<person>`       die Postfächer OHNE Geheimnisse (Quelle, Bereich, Anzeigename, Absender, Signatur, Server, Ordner)
//   `postfach-zugang--<person>`   NUR die Passwörter je Postfach — nie im Export, nie an den Browser, nie im Protokoll
// Gmail steht als Eintrag `gmail` im Register, sobald die Person ihm einen Bereich gibt; die Verbindung selbst bleibt die Google-
// Verbindung der Person (lib/google/verbindung.ts). Ein verbundenes Gmail ohne Eintrag erscheint mit `bereich: null` (nur „Alle“).
// Bereich = `privat` | feste Gesellschaft | `g-…` aus dem Gesellschafts-Register des Haushalts — sonst 400. Wer welches Postfach
// sieht, entscheidet der Bestandsname: es gibt keinen Weg, das Register einer anderen Person zu lesen.

import { loadJson, updateJson, saveJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { KERN_EINHEITEN, istGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { alleGesellschaften, anzeigeName } from '@/lib/gesellschaften/modell';
import { zeilenfrei, adresseGueltig, adresseKlein } from '@/lib/gmail/mime';
import { VOREINSTELLUNGEN, hostOk, portOk } from './anbieter';
import { GMAIL_POSTFACH, PERSON_OK, POSTFACH_GRENZEN, istAnbieter, registerName, zugangName, type Anbieter, type Ordner, type Postfach, type ServerAdresse } from './typen';

export class RegisterFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

interface RegisterDatei { v: 1; postfaecher: Postfach[] }
interface ZugangDatei { v: 1; zugang: Record<string, { passwort: string; gesetztAm: string }> }

export async function ladePostfaecher(person: string): Promise<Postfach[]> {
  if (!PERSON_OK.test(person)) return [];
  const d = await loadJson<RegisterDatei>(registerName(person));
  return d && d.v === 1 && Array.isArray(d.postfaecher) ? d.postfaecher : [];
}

export async function ladePostfach(person: string, id: string): Promise<Postfach | null> {
  return (await ladePostfaecher(person)).find(p => p.id === id) ?? null;
}

/** Passwort eines Postfachs — NUR serverseitig (Abgleich, Senden, Prüfen). */
export async function zugangLesen(person: string, id: string): Promise<string | null> {
  if (!PERSON_OK.test(person)) return null;
  const d = await loadJson<ZugangDatei>(zugangName(person));
  return d && d.v === 1 ? d.zugang?.[id]?.passwort ?? null : null;
}

async function zugangSetzen(person: string, id: string, passwort: string | null): Promise<void> {
  await updateJson<ZugangDatei>(zugangName(person), cur => {
    const zugang = { ...(cur && cur.v === 1 ? cur.zugang : {}) };
    if (passwort === null) delete zugang[id]; else zugang[id] = { passwort, gesetztAm: new Date().toISOString() };
    return { v: 1, zugang };
  });
}

// ── Bereiche ────────────────────────────────────────────────────────────────

/** Namen der Bereiche dieser Instanz: feste Gesellschaften + Register des Haushalts (`g-…`). */
export async function bereichNamen(): Promise<Record<string, string>> {
  const namen: Record<string, string> = Object.fromEntries(KERN_EINHEITEN.map(e => [e.id, e.label]));
  const h = await haushaltDesInhabers().catch(() => null);
  if (h) for (const g of alleGesellschaften(await ladeRegister(h).catch(() => null))) namen[g.id] = anzeigeName(g);
  return namen;
}

async function bereichPruefen(b: unknown): Promise<string> {
  if (b === 'privat' || istGesellschaft(b)) return b as string;
  if (istRegisterKennung(b) && (await bereichNamen())[b]) return b;
  throw new RegisterFehler('Bitte einen Bereich wählen: Privat oder eine Gesellschaft aus dem Register.');
}

// ── Eingaben säubern (rein) ─────────────────────────────────────────────────

const text = (v: unknown, max: number, feld: string): string => {
  const t = zeilenfrei(String(v ?? ''));
  if (t.length > max) throw new RegisterFehler(`${feld} ist zu lang (höchstens ${max} Zeichen).`, 413);
  return t;
};
const signaturSauber = (v: unknown): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const t = String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  if (t.length > POSTFACH_GRENZEN.signatur) throw new RegisterFehler(`Die Signatur ist zu lang (höchstens ${POSTFACH_GRENZEN.signatur} Zeichen).`, 413);
  return t || undefined;
};

/** Server-Angaben aus der Eingabe bzw. der Voreinstellung (rein, wirft `RegisterFehler`). */
export function serverAus(anbieter: Anbieter, roh: { imap?: unknown; smtp?: unknown }): { imap: ServerAdresse; smtp: ServerAdresse } {
  const v = VOREINSTELLUNGEN[anbieter];
  const lies = (x: unknown, art: 'imap' | 'smtp'): ServerAdresse => {
    const o = (x ?? {}) as Partial<ServerAdresse>;
    const host = String(o.host ?? '').trim().toLowerCase();
    const port = Number(o.port);
    if (!hostOk(host)) throw new RegisterFehler(`${art.toUpperCase()}-Server: bitte einen gültigen Namen eintragen (z. B. ${art}.anbieter.de).`);
    if (!portOk(port)) throw new RegisterFehler(`${art.toUpperCase()}-Port fehlt.`);
    const sicherheit = art === 'imap' ? 'ssl' : o.sicherheit === 'starttls' ? 'starttls' : 'ssl';
    return { host, port, sicherheit };
  };
  if (anbieter === 'eigen') return { imap: lies(roh.imap, 'imap'), smtp: lies(roh.smtp, 'smtp') };
  return { imap: v.imap!, smtp: v.smtp! };
}

export interface NeuesPostfach {
  quelle: 'imap';
  anbieter: Anbieter;
  adresse: string;
  passwort: string;
  bereich: string;
  anzeigename?: string;
  absenderName?: string;
  signatur?: string;
  imap?: unknown;
  smtp?: unknown;
  /** Beim Prüfen gefunden (lib/postfach/pruefen.ts). */
  ordner: Ordner;
  idle: boolean;
}

/** Eingabe eines neuen IMAP-Postfachs prüfen (rein bis auf den Bereich). */
export async function neuesPostfachPruefen(b: Record<string, unknown>, demoErlaubt: boolean): Promise<Omit<NeuesPostfach, 'ordner' | 'idle'>> {
  if (!istAnbieter(b.anbieter) || (b.anbieter === 'demo' && !demoErlaubt)) throw new RegisterFehler('Bitte einen Anbieter wählen.');
  const adresse = adresseKlein(String(b.adresse ?? ''));
  if (!adresseGueltig(adresse)) throw new RegisterFehler('Bitte eine gültige E-Mail-Adresse eintragen.');
  const passwort = String(b.passwort ?? '');
  if (!passwort || passwort.length > POSTFACH_GRENZEN.passwort || /[\r\n\u0000]/.test(passwort)) throw new RegisterFehler('Bitte das Passwort eintragen.');
  const bereich = await bereichPruefen(b.bereich);
  serverAus(b.anbieter, { imap: b.imap, smtp: b.smtp });
  return {
    quelle: 'imap', anbieter: b.anbieter, adresse, passwort, bereich,
    ...(b.anzeigename ? { anzeigename: text(b.anzeigename, POSTFACH_GRENZEN.anzeigename, 'Der Name') } : {}),
    ...(b.absenderName ? { absenderName: text(b.absenderName, POSTFACH_GRENZEN.absenderName, 'Der Absendername') } : {}),
    ...(signaturSauber(b.signatur) ? { signatur: signaturSauber(b.signatur) } : {}),
    ...(b.anbieter === 'eigen' ? { imap: b.imap, smtp: b.smtp } : {}),
  };
}

/** Ein geprüftes IMAP-Postfach anlegen (Register + Zugang). Gleiche Adresse zweimal → 409. */
export async function postfachAnlegen(person: string, n: NeuesPostfach): Promise<Postfach> {
  if (!PERSON_OK.test(person)) throw new RegisterFehler('Keine Person.', 403);
  const v = VOREINSTELLUNGEN[n.anbieter];
  const { imap, smtp } = serverAus(n.anbieter, { imap: n.imap, smtp: n.smtp });
  const neu: Postfach = {
    id: neueKennung('pf'), quelle: 'imap', bereich: n.bereich, anzeigename: n.anzeigename || n.adresse, adresse: n.adresse,
    ...(n.absenderName ? { absenderName: n.absenderName } : {}), ...(n.signatur ? { signatur: n.signatur } : {}),
    anbieter: n.anbieter, imap, smtp, benutzer: v.imapBenutzer(n.adresse), smtpBenutzer: v.smtpBenutzer(n.adresse),
    ordner: n.ordner, idle: n.idle, angelegtAm: new Date().toISOString(),
  };
  let fehler: RegisterFehler | null = null;
  await updateJson<RegisterDatei>(registerName(person), cur => {
    const liste = cur && cur.v === 1 ? cur.postfaecher : [];
    if (liste.length >= POSTFACH_GRENZEN.jePerson) { fehler = new RegisterFehler(`Höchstens ${POSTFACH_GRENZEN.jePerson} Postfächer je Person.`, 413); return cur ?? { v: 1, postfaecher: [] }; }
    if (liste.some(p => p.quelle === 'imap' && p.adresse === n.adresse)) { fehler = new RegisterFehler('Dieses Postfach ist schon verbunden — „Verbindung erneuern“ setzt ein neues Passwort.', 409); return cur!; }
    return { v: 1, postfaecher: [...liste, neu] };
  });
  if (fehler) throw fehler;
  await zugangSetzen(person, neu.id, n.passwort);
  return neu;
}

/** Bereich, Anzeigename, Absendername, Signatur ändern (auch für Gmail: legt den Eintrag `gmail` an). */
export async function postfachAendern(person: string, id: string, b: Record<string, unknown>, gmailAdresse?: string | null): Promise<Postfach> {
  const felder: Partial<Postfach> = {};
  if ('bereich' in b) felder.bereich = await bereichPruefen(b.bereich);
  if ('anzeigename' in b) felder.anzeigename = text(b.anzeigename, POSTFACH_GRENZEN.anzeigename, 'Der Name');
  if ('absenderName' in b) felder.absenderName = text(b.absenderName, POSTFACH_GRENZEN.absenderName, 'Der Absendername') || undefined;
  if ('signatur' in b) felder.signatur = signaturSauber(b.signatur);
  let ergebnis: Postfach | null = null;
  let fehler: RegisterFehler | null = null;
  await updateJson<RegisterDatei>(registerName(person), cur => {
    const liste = cur && cur.v === 1 ? [...cur.postfaecher] : [];
    const i = liste.findIndex(p => p.id === id);
    if (i < 0 && id === GMAIL_POSTFACH && gmailAdresse) {
      if (!felder.bereich) { fehler = new RegisterFehler('Bitte einen Bereich wählen.'); return cur ?? { v: 1, postfaecher: [] }; }
      const neu: Postfach = { id: GMAIL_POSTFACH, quelle: 'gmail', bereich: felder.bereich, anzeigename: felder.anzeigename || 'Google Workspace', adresse: '', angelegtAm: new Date().toISOString(), ...(felder.absenderName ? { absenderName: felder.absenderName } : {}), ...(felder.signatur ? { signatur: felder.signatur } : {}) };
      ergebnis = neu;
      return { v: 1, postfaecher: [...liste, neu] };
    }
    if (i < 0) { fehler = new RegisterFehler('Dieses Postfach gibt es nicht.', 404); return cur ?? { v: 1, postfaecher: [] }; }
    const neu = { ...liste[i], ...felder, geaendertAm: new Date().toISOString() } as Postfach;
    for (const k of Object.keys(neu) as (keyof Postfach)[]) if (neu[k] === undefined) delete neu[k];
    liste[i] = neu; ergebnis = neu;
    return { v: 1, postfaecher: liste };
  });
  if (fehler) throw fehler;
  return ergebnis!;
}

/** Neues Passwort (nach „Verbindung erneuern“ geprüft) und ggf. neu gefundene Ordner. */
export async function zugangErneuern(person: string, id: string, passwort: string, o: { ordner?: Ordner; idle?: boolean } = {}): Promise<void> {
  if (!passwort || passwort.length > POSTFACH_GRENZEN.passwort || /[\r\n\u0000]/.test(passwort)) throw new RegisterFehler('Bitte das Passwort eintragen.');
  if (!(await ladePostfach(person, id))) throw new RegisterFehler('Dieses Postfach gibt es nicht.', 404);
  await zugangSetzen(person, id, passwort);
  if (o.ordner || o.idle !== undefined) {
    await updateJson<RegisterDatei>(registerName(person), cur => cur && cur.v === 1 ? { v: 1, postfaecher: cur.postfaecher.map(p => (p.id === id ? { ...p, ...(o.ordner ? { ordner: o.ordner } : {}), ...(o.idle !== undefined ? { idle: o.idle } : {}), geaendertAm: new Date().toISOString() } : p)) } : (cur ?? { v: 1, postfaecher: [] }));
  }
}

/** Den Archiv-Ordner merken (MAKE OS hat ihn beim ersten „Erledigt“ angelegt). */
export async function ordnerMerken(person: string, id: string, ordner: Ordner): Promise<void> {
  await updateJson<RegisterDatei>(registerName(person), cur => cur && cur.v === 1 ? { v: 1, postfaecher: cur.postfaecher.map(p => (p.id === id ? { ...p, ordner } : p)) } : (cur ?? { v: 1, postfaecher: [] }));
}

/** Aus dem Register nehmen und das Passwort löschen. (Spiegel und Inbox-Zustand räumt `postfachTrennen` in lib/postfach/trennen.ts.) */
export async function registerEntfernen(person: string, id: string): Promise<boolean> {
  let war = false;
  await updateJson<RegisterDatei>(registerName(person), cur => {
    const liste = cur && cur.v === 1 ? cur.postfaecher : [];
    war = liste.some(p => p.id === id);
    return { v: 1, postfaecher: liste.filter(p => p.id !== id) };
  });
  await zugangSetzen(person, id, null);
  return war;
}

/** Alles einer Person leeren (Konto löschen) — Register und Zugang. */
export async function registerLeeren(person: string): Promise<void> {
  if (!PERSON_OK.test(person)) return;
  await saveJson(registerName(person), { v: 1, postfaecher: [] });
  await saveJson(zugangName(person), { v: 1, zugang: {} });
}


/** Wie viele Postfächer sind in dieser Instanz verbunden (alle Konten; IMAP-Register + Gmail)? Nur ein Zähler (Einrichtung/HOI). */
export async function postfaecherGezaehlt(): Promise<number> {
  const { alleSpeicher } = await import('@/lib/zugang/konten');
  const { ladeGmailStand } = await import('@/lib/gmail/stand');
  let n = 0;
  for (const p of await alleSpeicher().catch(() => [] as string[])) {
    n += (await ladePostfaecher(p)).filter(x => x.quelle === 'imap').length;
    if (await ladeGmailStand(p).catch(() => null)) n++;
  }
  return n;
}

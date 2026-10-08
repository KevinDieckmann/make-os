// ─── ZOE auf WhatsApp — Kanal verwalten: Status, Verbinden mit Code, Ausnahme, Test, Trennen (Server, 08.10.2026) ──────────
// Nur die Person selbst (Route /api/zoe/whatsapp mit `eigenePerson`, Dienstweg 403) — auch der Inhaber nicht für andere.
// Einwilligung und Ausnahme als Nachweis (Ereignis mit Zeit, Fassung, Fingerabdruck des Wortlauts, Person, Quelle) — nur anhängend.
// Die eigene Nummer geht nur maskiert an den Browser, der Code nur einmal in der Antwort auf „Verbinden“ (gespeichert nur sein
// Fingerabdruck, 15 Minuten).

import { createHash, randomInt } from 'node:crypto';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { pruefe, fehlschlag } from '@/lib/zugang/drossel';
import { melde } from '@/lib/meldungen/melden';
import { zoeWhatsappFehlend, zoeWhatsappKonfig, zoeWhatsappKonflikt, zoeWebhookAdresse } from './konfig';
import {
  CODE_ZEICHEN, EINWILLIGUNG_TEXT, INHALTE_TEXT, KANAL_GRENZEN, KANAL_TEXTE, ZOE_INHALTE_FASSUNG, ZOE_KANAL_FASSUNG,
  kanalSicht, nummerAus, nummerMaskiert, waMeLink, type KanalEreignis, type ZoeKanal, type ZoeWhatsappStatus,
} from './kanal';
import { aendereKanal, alleKanaele, ladeKanal, ladeZoeZustand } from './speicher';
import { WhatsappFehler } from '@/lib/whatsapp/graph';
import { briefingVorlagePruefen, zoeNummerRegistrieren, zoeTelefonAngaben, zoeVorlagenLaden } from './meta';
import { sprachnachrichtenEntfernen } from './medien';
import { zoeAnPersonSenden } from './senden';

export type VerwaltenErgebnis<T = unknown> = ({ ok: true } & T) | { ok: false; status: number; fehler: string };

/** Fingerabdruck des Codes — an die Person gebunden (rein). */
export const codeHash = (person: string, code: string): string => createHash('sha256').update(`make-os|zoe-wa-code|${person}|${code.toUpperCase()}`).digest('hex');

/** Fingerabdruck des Wortlauts, dem zugestimmt wurde (rein). */
export const wortlautFingerabdruck = (art: 'einwilligung' | 'inhalte'): string => {
  const t = art === 'einwilligung' ? { f: ZOE_KANAL_FASSUNG, ...EINWILLIGUNG_TEXT } : { f: ZOE_INHALTE_FASSUNG, ...INHALTE_TEXT };
  return createHash('sha256').update(`${t.f}|${t.titel}|${t.text}`).digest('hex').slice(0, 16);
};

/** Ein neuer Code bzw. eine neue Kennung aus CODE_ZEICHEN (kryptografischer Zufall). */
export function zufallsKennung(laenge: number): string {
  let c = '';
  for (let i = 0; i < laenge; i++) c += CODE_ZEICHEN[randomInt(CODE_ZEICHEN.length)];
  return c;
}

const ereignis = (person: string, art: KanalEreignis['art'], quelle: KanalEreignis['quelle'], zeit: string, extra: Partial<KanalEreignis> = {}): KanalEreignis =>
  ({ zeit, art, von: person, quelle, ...extra });

/** Was die Karte zeigt (nie Schlüssel; fehlende Variablen nur als Namen und nur für den Inhaber; Nummer maskiert). Schreibt nie. */
export async function zoeWhatsappStatus(person: string, o: { pruefen?: boolean } = {}): Promise<ZoeWhatsappStatus> {
  const k = zoeWhatsappKonfig();
  const inhaber = await istInhaber(person);
  const kanal = kanalSicht(await ladeKanal(person));
  const basis = { ok: true as const, inhaber, kanal, fassung: { einwilligung: ZOE_KANAL_FASSUNG, inhalte: ZOE_INHALTE_FASSUNG }, webhookAdresse: zoeWebhookAdresse() };
  if (!k) return { ...basis, eingerichtet: false, konflikt: zoeWhatsappKonflikt(), fehlend: inhaber ? zoeWhatsappFehlend() : [], verbindung: 'ungeprueft' };
  // Nur auf ausdrücklichen Wunsch (POST „pruefen“) bei Meta nachsehen — GET liest nur den Cache.
  if (o.pruefen) {
    await zoeTelefonAngaben(k, true);
    await zoeVorlagenLaden(k, { neu: true }).catch(() => []);
  }
  const z = await ladeZoeZustand();
  const tokenKaputt = !!z.token?.fehlerAt && (!z.token.okAt || z.token.fehlerAt > z.token.okAt);
  const v = z.vorlagen ? briefingVorlagePruefen(z.vorlagen.liste, k.vorlage.name, k.vorlage.sprache) : null;
  const vorlageStatus = !z.vorlagen ? 'ungeprüft' : v?.ok ? 'APPROVED' : (z.vorlagen.liste.find(x => x.name === k.vorlage.name && x.sprache === k.vorlage.sprache)?.status ?? 'fehlt');
  return {
    ...basis, eingerichtet: true, konflikt: false, fehlend: [],
    ...(z.telefon?.nummer ? { zoeNummer: z.telefon.nummer } : {}),
    vorlage: { name: k.vorlage.name, sprache: k.vorlage.sprache, status: vorlageStatus },
    verbindung: tokenKaputt ? 'token' : z.telefon?.nummer ? 'ok' : 'ungeprueft',
    ...(inhaber && z.registriert ? { registriert: z.registriert } : {}),
  };
}

/** Die ZOE-Nummer registrieren — nur der Inhaber (PIN nie gespeichert, Speicherort Deutschland als Vorgabe). */
export async function registrieren(person: string, pin: unknown, speicherort: unknown): Promise<VerwaltenErgebnis> {
  if (!(await istInhaber(person))) return { ok: false, status: 403, fehler: 'Registrieren darf nur der Inhaber.' };
  const k = zoeWhatsappKonfig();
  if (!k) return { ok: false, status: 404, fehler: 'ZOE auf WhatsApp ist auf dieser Instanz nicht eingerichtet.' };
  if (speicherort !== 'DE' && speicherort !== 'ohne') return { ok: false, status: 400, fehler: 'Bitte den Speicherort wählen.' };
  try { await zoeNummerRegistrieren(k, typeof pin === 'string' ? pin : '', speicherort); }
  catch (e) { if (e instanceof WhatsappFehler) return { ok: false, status: e.status, fehler: e.message }; throw e; }
  await zoeTelefonAngaben(k, true);
  return { ok: true };
}

/**
 * Verbinden beginnen: Nummer + Einwilligung (Fassung muss stimmen) → Code (15 Minuten). Die Person schickt ihn von DIESER Nummer an die
 * ZOE-Nummer — erst dann ist der Kanal verbunden (lib/zoe-whatsapp/eingang.ts). Eine Nummer gehört höchstens einer Person (409).
 */
export async function verbindenStarten(person: string, nummerRoh: unknown, fassung: unknown, jetzt = Date.now()): Promise<VerwaltenErgebnis<{ code: string; bis: string; nummer: string; zoeNummer?: string; link?: string }>> {
  const k = zoeWhatsappKonfig();
  if (!k) return { ok: false, status: 404, fehler: 'ZOE auf WhatsApp ist auf dieser Instanz nicht eingerichtet.' };
  if (fassung !== ZOE_KANAL_FASSUNG) return { ok: false, status: 409, fehler: 'Der Einwilligungstext hat sich geändert — bitte die Seite neu laden und erneut zustimmen.' };
  const nummer = nummerAus(nummerRoh);
  if (!nummer) return { ok: false, status: 400, fehler: 'Bitte die Handynummer mit Vorwahl eingeben, z. B. +49 170 1234567 oder 0170 1234567.' };
  const vorher = await ladeKanal(person);
  if (vorher.status === 'verbunden' && vorher.nummer === nummer) return { ok: false, status: 409, fehler: 'Diese Nummer ist schon verbunden.' };
  const bremse = `zoe-wa-code:${person}`;
  if (!pruefe(bremse, jetzt).erlaubt) return { ok: false, status: 429, fehler: 'Zu viele Codes in kurzer Zeit — bitte in ein paar Minuten noch einmal.' };
  for (const x of await alleKanaele()) {
    if (x.person === person || x.kanal.nummer !== nummer) continue;
    if (x.kanal.status === 'verbunden' || (x.kanal.status === 'wartet' && x.kanal.code && Date.parse(x.kanal.code.bis) > jetzt)) return { ok: false, status: 409, fehler: 'Diese Nummer ist schon mit einem anderen Konto verbunden.' };
  }
  fehlschlag(bremse, jetzt, 5); // Budget: fünf Codes je 15 Minuten
  const code = zufallsKennung(6);
  const zeit = new Date(jetzt).toISOString();
  const bis = new Date(jetzt + KANAL_GRENZEN.codeMinuten * 60_000).toISOString();
  await aendereKanal(person, cur => ({
    ...cur,
    status: 'wartet', nummer, code: { hash: codeHash(person, code), bis, versuche: 0 },
    // Eine neue Nummer beginnt ohne alten Eingang/Fenster/Ausstehendes; die Einwilligung wird (erneut) als Nachweis festgehalten.
    eingang: [], ausstehend: {}, zuletztEingehend: undefined, letzteVorlage: undefined,
    ereignisse: [...cur.ereignisse, ereignis(person, 'einwilligung', 'app', zeit, { fassung: ZOE_KANAL_FASSUNG, wortlaut: wortlautFingerabdruck('einwilligung') })],
  }), jetzt);
  const z = await ladeZoeZustand();
  const link = waMeLink(z.telefon?.nummer, code);
  return { ok: true, code, bis, nummer: nummerMaskiert(nummer)!, ...(z.telefon?.nummer ? { zoeNummer: z.telefon.nummer } : {}), ...(link ? { link } : {}) };
}

/** Ausnahme „Inhalte senden“ an/aus — nur mit verbundenem Kanal; Nachweis wie die Einwilligung. */
export async function inhalteSetzen(person: string, an: unknown, fassung: unknown, jetzt = Date.now()): Promise<VerwaltenErgebnis> {
  if (typeof an !== 'boolean') return { ok: false, status: 400, fehler: 'an: true oder false.' };
  if (an && fassung !== ZOE_INHALTE_FASSUNG) return { ok: false, status: 409, fehler: 'Der Text der Ausnahme hat sich geändert — bitte die Seite neu laden.' };
  const k = await ladeKanal(person);
  if (an && k.status !== 'verbunden') return { ok: false, status: 409, fehler: 'Erst verbinden, dann die Ausnahme einschalten.' };
  if (!!k.inhalte?.seit === an) return { ok: true };
  const zeit = new Date(jetzt).toISOString();
  await aendereKanal(person, cur => {
    if (an) return { ...cur, inhalte: { seit: zeit, fassung: ZOE_INHALTE_FASSUNG }, ereignisse: [...cur.ereignisse, ereignis(person, 'inhalte-an', 'app', zeit, { fassung: ZOE_INHALTE_FASSUNG, wortlaut: wortlautFingerabdruck('inhalte') })] };
    const { inhalte: _i, ...rest } = cur;
    return { ...rest, ereignisse: [...cur.ereignisse, ereignis(person, 'inhalte-aus', 'app', zeit)] };
  }, jetzt);
  return { ok: true };
}

/**
 * Trennen („Trennen“ in MAKE OS oder „STOP“ an die ZOE-Nummer): Nummer, Code, Ausstehendes, Eingang, Verweise und Sprachnachrichten weg,
 * die Ausnahme endet mit; der Nachweis (Ereignisse) bleibt. Idempotent.
 */
export async function trennen(person: string, quelle: 'app' | 'whatsapp', jetzt = Date.now()): Promise<VerwaltenErgebnis<{ war: boolean }>> {
  const vorher = await ladeKanal(person);
  if (vorher.status !== 'verbunden' && vorher.status !== 'wartet') return { ok: true, war: false };
  await sprachnachrichtenEntfernen(person);
  const zeit = new Date(jetzt).toISOString();
  await aendereKanal(person, cur => {
    const ev = [...cur.ereignisse, ereignis(person, 'widerruf', quelle, zeit, { fassung: ZOE_KANAL_FASSUNG })];
    if (cur.inhalte?.seit) ev.push(ereignis(person, 'inhalte-aus', quelle, zeit, { folge: 'widerruf' }));
    return { v: 1, status: 'getrennt', ereignisse: ev };
  }, jetzt);
  return { ok: true, war: true };
}

/** Test-Nachricht über den Kanal (im Fenster frei, sonst Vorlage „Briefing bereit“). */
export async function testSenden(person: string): Promise<VerwaltenErgebnis<{ wie: string }>> {
  const r = await zoeAnPersonSenden(person, 'test', KANAL_TEXTE.test, { link: '/os/konto' });
  if (r.ok) return { ok: true, wie: r.wie === 'frei' ? 'als Nachricht' : r.wie === 'vorlage' ? 'als Vorlage „Briefing bereit“ (24-Stunden-Fenster zu)' : 'gesammelt — eine Vorlage ging schon hinaus, sie kommt mit deiner nächsten Nachricht' };
  if (r.grund === 'nicht-eingerichtet') return { ok: false, status: 404, fehler: 'ZOE auf WhatsApp ist auf dieser Instanz nicht eingerichtet.' };
  if (r.grund === 'nicht-verbunden') return { ok: false, status: 409, fehler: 'Erst verbinden.' };
  return { ok: false, status: 502, fehler: r.fehler ?? 'Meta hat nicht angenommen.' };
}

/** Nach dem Bestätigen per Code: Hinweis in der Glocke der Person (eine fremde Verbindung fällt so auf). */
export async function verbundenMelden(person: string, kanal: ZoeKanal): Promise<void> {
  await melde({ an: person, art: 'sicherheit', titel: `ZOE auf WhatsApp ist jetzt mit ${nummerMaskiert(kanal.nummer) ?? 'deiner Nummer'} verbunden — warst du das nicht, bitte sofort trennen.`, link: '/os/konto#zoe-whatsapp' });
}

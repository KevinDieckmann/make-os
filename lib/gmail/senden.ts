// ─── Gmail — Antworten und Senden (Server, 03.10.2026) ───────────────────────
// Kevin 03.10.: „Bei uns in der Inbox bekommen wir die Antworten und formulieren das Ganze.“ Formuliert wird in MAKE OS
// (optional mit dem Entwurf von ZOE) — GESENDET wird nur auf den Einzelklick der Person (die Route lehnt den Dienstweg ab:
// ZOE, Takt und Arbeiter können nie senden; Versand-Regel „jede Mail erst Entwurf + Einzelklick“).
//   · Antwort im Thread: `threadId`, `In-Reply-To` (Message-ID der beantworteten Mail), `References` (bisherige + diese), `Re:`
//   · Absender: die eigene Adresse der Person oder ein verifizierter „Senden als“-Alias aus Gmail (`sendAs.list`) — nie eine
//     andere Adresse (Absender-Fälschung); bei einer Antwort der Alias, an den die Mail ging
//   · Empfänger: nie frei erfunden — bei einer Antwort Absender (bzw. Reply-To), bei „Allen antworten“ zusätzlich An/Cc ohne die
//     eigenen Adressen; Adressen werden geprüft (kein Zeilenumbruch, kein `<`), höchstens 20
//   · § 7 UWG / Art. 18 (`pruefeEmpfaenger`): eingeschränkte Personen nie (409); bei Werbesperre/roter Mail-Ampel und werblichen
//     Wörtern im Text eine Rückfrage (409 `uwg`) — die Person entscheidet, MAKE OS blockiert nie die 1:1-Antwort
//   · danach die gesendete Mail sofort im Spiegel (Verlauf der Kontaktakte nur für zugeordnete Gespräche, lib/inbox/verlauf.ts)
// Der Text bleibt außerhalb von Protokollen: das Änderungsprotokoll trägt nur die Nachrichten-Kennung.

import { googleAnfrage } from '@/lib/google/http';
import { werbeWoerter } from '@/lib/crm/netzwerken-recht';
import { kanalStatus } from '@/lib/crm/recht';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import { anzeigename } from '@/lib/make-one/crm';
import { GMAIL_API, aliaseSicherstellen, nachrichtHolen } from './abgleich';
import { adresseGueltig, adresseKlein, antwortBetreff, bytesBase64url, mimeBauen, referenzenFuer, zeilenfrei, nachrichtAus } from './mime';
import { adressIndex, eigeneAdressen } from './zuordnung';
import { aendereGmailStand, aendereGmailTexte, adressenText, ladeGmailStand } from './stand';
import type { Adr, GmailAlias, GmailKopf, GmailStand } from './typen';
import { GMAIL_GRENZEN } from './typen';

export const TEXT_MAX = 100_000;
export const EMPFAENGER_MAX = 20;

export type SendenCode = 'nicht-verbunden' | 'kein-text' | 'zu-lang' | 'kein-empfaenger' | 'adresse' | 'zu-viele' | 'absender' | 'nicht-gefunden' | 'betreff' | 'eingeschraenkt' | 'uwg' | 'google' | 'versand';
export class SendenFehler extends Error {
  constructor(public code: SendenCode, message: string, public status = 400, public extra?: Record<string, unknown>) { super(message); }
}

export interface SendenEingabe {
  person: string;
  /** Antwort auf diese Nachricht (Kennung im Spiegel der Person) — fehlt = neue Mail. */
  ausNachricht?: string;
  /** Nur bei neuer Mail bzw. zum Überschreiben der Standard-Empfänger (dann geprüft). */
  an?: Adr[];
  cc?: Adr[];
  betreff?: string;
  text: string;
  /** Absender-Adresse (eigene oder Alias) — Standard: siehe `absenderFuer`. */
  von?: string;
  /** Die Rückfrage zu § 7 UWG wurde beantwortet. */
  uwgBestaetigt?: boolean;
}

export interface SendenErgebnis { id: string; threadId: string; von: string; an: string[] }

/** Die Standard-Empfänger einer Antwort: Reply-To bzw. Absender; „alle“ zusätzlich An/Cc ohne die eigenen Adressen. Rein. */
export function antwortEmpfaenger(k: GmailKopf, eigene: readonly string[], alle = false): { an: Adr[]; cc: Adr[] } {
  const ich = new Set(eigene);
  const vonMir = ich.has(k.von.email) || k.labels.includes('SENT');
  const erste: Adr[] = vonMir ? k.an : [k.antwortAn ?? k.von];
  const an = erste.filter(a => !ich.has(a.email));
  if (!alle) return { an: an.length ? an : erste.slice(0, 1), cc: [] };
  const schon = new Set(an.map(a => a.email));
  const cc = [...(vonMir ? k.cc : [...k.an, ...k.cc])].filter(a => !ich.has(a.email) && !schon.has(a.email));
  return { an, cc: cc.filter((a, i, l) => l.findIndex(b => b.email === a.email) === i) };
}

/** Welche Adresse sendet? Ausdrücklich gewählt (muss eigene/verifizierter Alias sein), sonst der Alias, an den die Mail ging, sonst der Standard. Rein. */
export function absenderFuer(k: GmailKopf | null, aliase: readonly GmailAlias[], eigene: string, gewaehlt?: string): GmailAlias | null {
  const nutzbar = aliase.filter(a => a.verifiziert);
  const liste = nutzbar.some(a => a.email === eigene) ? nutzbar : [{ email: eigene, verifiziert: true, standard: true } as GmailAlias, ...nutzbar];
  if (gewaehlt) return liste.find(a => a.email === adresseKlein(gewaehlt)) ?? null;
  if (k) { const empf = [...k.an, ...k.cc].map(a => a.email); const treffer = liste.find(a => empf.includes(a.email)); if (treffer) return treffer; }
  return liste.find(a => a.standard) ?? liste[0] ?? null;
}

const adressenSauber = (l: readonly Adr[] | undefined): Adr[] => {
  const raus: Adr[] = [];
  for (const a of l ?? []) {
    const email = adresseKlein(String(a?.email ?? ''));
    if (!adresseGueltig(email)) throw new SendenFehler('adresse', `„${zeilenfrei(String(a?.email ?? '')).slice(0, 80)}“ ist keine gültige E-Mail-Adresse.`, 400);
    if (!raus.some(x => x.email === email)) raus.push({ ...(a.name ? { name: zeilenfrei(a.name).slice(0, 120) } : {}), email });
  }
  return raus;
};

export interface EmpfaengerPruefung {
  /** Eingeschränkte Personen (Art. 18) unter den Empfängern — nie senden. */
  eingeschraenkt: string[];
  /** Werbesperre bzw. rote Mail-Ampel — nur mit werblichen Wörtern ein Hinweis. */
  hinweise: { name: string; grund: string }[];
  woerter: string[];
}

/** Empfänger und Text prüfen (§ 7 UWG, Art. 18) — rein auf der Kartei, ohne zu schreiben. */
export async function pruefeEmpfaenger(adressen: readonly string[], text: string): Promise<EmpfaengerPruefung> {
  const [kontakte, crm] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm()]);
  const index = adressIndex(kontakte);
  const raus: EmpfaengerPruefung = { eingeschraenkt: [], hinweise: [], woerter: werbeWoerter(text) };
  const gesehen = new Set<string>();
  for (const a of adressen) {
    const k = index.get(a);
    if (!k || gesehen.has(k.id)) continue;
    gesehen.add(k.id);
    if (k.eingeschraenkt) { raus.eingeschraenkt.push(anzeigename(k)); continue; }
    const hatMandat = crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id));
    const s = kanalStatus(k, 'mail', { hatMandat });
    if (s.farbe === 'rot') raus.hinweise.push({ name: anzeigename(k), grund: s.grund });
  }
  return raus;
}

/**
 * Eine Mail senden — NUR auf den Einzelklick der Person (die Route prüft Sitzung/Dienstweg). Wirft `SendenFehler`
 * (400/404/409) oder `GoogleApiFehler`.
 */
export async function gmailSenden(e: SendenEingabe): Promise<SendenErgebnis> {
  const stand = await ladeGmailStand(e.person);
  if (!stand) throw new SendenFehler('nicht-verbunden', 'Gmail ist für diese Person nicht eingerichtet.', 409);
  const text = String(e.text ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  if (!text.trim()) throw new SendenFehler('kein-text', 'Die Mail hat keinen Text.', 400);
  if (text.length > TEXT_MAX) throw new SendenFehler('zu-lang', `Der Text ist zu lang (höchstens ${TEXT_MAX} Zeichen).`, 413);

  const antwortAuf = e.ausNachricht ? stand.koepfe[e.ausNachricht] : undefined;
  if (e.ausNachricht && !antwortAuf) throw new SendenFehler('nicht-gefunden', 'Die Mail, auf die geantwortet wird, gibt es im Spiegel nicht (mehr).', 404);
  const eigene = eigeneAdressen(stand);
  const standard = antwortAuf ? antwortEmpfaenger(antwortAuf, eigene, false) : { an: [], cc: [] };
  const an = adressenSauber(e.an?.length ? e.an : standard.an);
  const cc = adressenSauber(e.cc);
  if (!an.length) throw new SendenFehler('kein-empfaenger', 'Es fehlt ein Empfänger.', 400);
  if (an.length + cc.length > EMPFAENGER_MAX) throw new SendenFehler('zu-viele', `Höchstens ${EMPFAENGER_MAX} Empfänger.`, 400);
  const betreff = antwortAuf ? antwortBetreff(antwortAuf.betreff) : zeilenfrei(e.betreff ?? '');
  if (!betreff) throw new SendenFehler('betreff', 'Es fehlt ein Betreff.', 400);

  const aliase = await aliaseSicherstellen(e.person).catch(() => stand.aliase ?? []);
  const absender = absenderFuer(antwortAuf ?? null, aliase, stand.email, e.von);
  if (!absender) throw new SendenFehler('absender', 'Diese Absender-Adresse gehört nicht zu deinem Postfach („Senden als“ in Gmail).', 400);

  // Art. 18 / § 7 UWG: auf dem frischen Stand der Kartei, vor dem Senden.
  const alle = [...an, ...cc].map(a => a.email);
  const pr = await pruefeEmpfaenger(alle, text);
  if (pr.eingeschraenkt.length) throw new SendenFehler('eingeschraenkt', `${pr.eingeschraenkt.join(', ')}: Verarbeitung eingeschränkt (Art. 18) — keine Mail aus MAKE OS. Erst unter Kontakt › Datenschutz klären.`, 409);
  if (pr.hinweise.length && pr.woerter.length && !e.uwgBestaetigt) {
    throw new SendenFehler('uwg', 'Der Text klingt werblich, und für mindestens eine Person fehlt die Grundlage für Werbung (§ 7 UWG). Nur senden, wenn es eine persönliche 1:1-Antwort bleibt.', 409, { uwg: { woerter: pr.woerter, empfaenger: pr.hinweise } });
  }

  const roh = mimeBauen({
    von: { ...(absender.name ? { name: absender.name } : {}), email: absender.email }, an, ...(cc.length ? { cc } : {}), betreff, text,
    ...(antwortAuf?.messageId ? { inReplyTo: antwortAuf.messageId, references: referenzenFuer(antwortAuf.references, antwortAuf.messageId) } : {}),
  });
  const r = await googleAnfrage<{ id?: string; threadId?: string }>(e.person, 'gmail', `${GMAIL_API}/messages/send`, {
    method: 'POST', body: { raw: bytesBase64url(roh), ...(antwortAuf ? { threadId: antwortAuf.threadId } : {}) }, zeitMs: 60_000,
  });
  if (r.status !== 200 || !r.json.id) {
    const grund = r.status === 400 ? 'Google hat die Mail abgelehnt (400).' : r.status === 403 ? 'Google erlaubt das Senden nicht (403) — bitte „Gmail verbinden“ erneut.' : `Google hat nicht gesendet (${r.status}).`;
    throw new SendenFehler('google', grund, r.status === 403 ? 409 : 502);
  }
  await gesendetSpiegeln(e.person, r.json.id).catch(() => { /* der nächste Abgleich holt sie */ });
  return { id: r.json.id, threadId: r.json.threadId ?? antwortAuf?.threadId ?? '', von: absender.email, an: an.map(a => a.email) };
}

/** Die gerade gesendete Nachricht holen und in Spiegel + Verlauf legen — sie steht so sofort im Thread. */
async function gesendetSpiegeln(person: string, id: string): Promise<void> {
  const m = await nachrichtHolen(person, id);
  if (!m) return;
  const { kopf, text } = nachrichtAus(m);
  await aendereGmailStand(person, s => ({ ...s, koepfe: { ...s.koepfe, [kopf.id]: kopf } }));
  await aendereGmailTexte(person, t => ({ v: 1, texte: { ...t.texte, [kopf.id]: { adressen: adressenText(kopf), t: text.slice(0, GMAIL_GRENZEN.textMax) } } }));
  // Verlauf nur für zugeordnete Gespräche (Inbox 2, 06.10.).
  await import('@/lib/inbox/verlauf').then(v => v.verlaufNachziehen(person)).catch(() => { /* nachgezogen beim nächsten Lauf */ });
}

// Für Tests/Oberfläche: die Standard-Empfänger zu einer Nachricht aus dem Stand.
export function standardEmpfaenger(s: GmailStand, id: string, alle = false): { an: Adr[]; cc: Adr[] } | null {
  const k = s.koepfe[id];
  return k ? antwortEmpfaenger(k, eigeneAdressen(s), alle) : null;
}

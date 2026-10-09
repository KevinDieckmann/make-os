// ─── Markttraktion · EIN Weg „Person anlegen“ (09.10., Woche 2 · 1.8, rein, getestet) ─────────────────────────────────────
// Befund 1.8: sechs Anlege-Wege (Kartei, Anfrage, Inbox, Netzwerken, Make.One-Abend, Import) hatten verschiedene Regeln — Firma anlegen
// ja/nein, Lebensphase, Lead-Status, Herkunft, Follow-up, Zuständig. Hier stehen diese Entscheidungen EINMAL, mit dem Weg als Parameter:
//   · `ANLEGE_REGELN`     die Tabelle je Weg (Herkunft, Rechtsgrundlage, Lebensphase, Lead, Firma, Follow-up, Zuständig, Quelle) — und
//                         warum ein Weg bewusst anders ist (`anders`)
//   · `personEntwurf`     der neue Kartei-Eintrag aus der Eingabe (nie eine Einwilligung — die gibt es nur mit Wortlaut + Beleg)
//   · `dublettePruefen`   dieselbe Dublettenregel wie Netzwerken (`zusammenfuehrung`: Mail, oder Nummer UND Nachname; Name + Firma = Hinweis)
//   · `firmaPlanen`       vorhandene Firma (Name, Kennung, Domain) — sonst neu; liegt sie im Papierkorb, wird sie zurückgeholt (1.6)
//   · `leadZiel`          wohin der Lead nach dem Anlegen geht (Netzwerken, Anfrage) — Kein Fit/Ruht/SQL/Kunde und Firmen ohne Vertrieb bleiben
//   · `zustaendigFuer`    gewählt, sonst je Weg: wer anlegt oder die Verantwortliche der Welt (1.10)
// Geschrieben wird in lib/crm/person-anlegen-server.ts (`personAnlegen`, Route POST /api/crm/person) — Kartei, Firmenkarte, „+ Aktivität“,
// Prospecting und Make.One-Abend gehen dort durch. Anfrage/Inbox (/api/crm/anfrage) und Netzwerken (lib/crm/netzwerken-server.ts) behalten
// ihre eigenen idempotenten Schritte, entscheiden aber mit DIESEN Funktionen (Entwurf, Firma, Lead). Der Import bleibt der Massenweg
// (`importieren`, lib/make-one/crm.ts — Dubletten über `schluessel`, Konflikte statt Überschreiben); seine Regeln stehen nur zur Doku hier.

import { HERKUNFT, anzeigename, type Herkunft, type Kontakt, type Lebensphase, type Rechtsgrundlage, LEBENSPHASEN } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Lead, LeadStatus } from './typen';
import type { Welt } from './traktion';
import { verantwortlich, wer } from './team';
import { leereKriterien, frischAngelegt } from './leads';
import { OFFENE_STUFEN } from './pipeline';
import { ausgenommen } from './einschraenkung';
import { leadSaeubern } from './lead-form';
import { bestehendeFirma, domainVon, firmenId } from './firmen';
import { firmaZurKarte } from './visitenkarte';
import { zusammenfuehrung, NETZWERKEN_QUELLE, type Treffer } from './netzwerken';
import { istKalendertag } from '@/lib/zeit';
import { firmaZurueckholen } from './ablage';

export type AnlegeWeg = 'kartei' | 'firmenkarte' | 'schnell' | 'prospecting' | 'makeone' | 'anfrage' | 'netzwerken' | 'import';
/** Die Wege, die über POST /api/crm/person anlegen (von Hand, eine Person). */
export const PERSON_WEGE = ['kartei', 'firmenkarte', 'schnell', 'prospecting', 'makeone'] as const;
export type PersonWeg = typeof PERSON_WEGE[number];
export const istPersonWeg = (v: unknown): v is PersonWeg => (PERSON_WEGE as readonly string[]).includes(String(v));

export interface AnlegeRegel {
  label: string;
  /** Welt der Vorgabe „Zuständig“ (Verantwortliche dieser Welt), wenn niemand gewählt hat. */
  welt: Welt;
  /** Wer zuständig wird, wenn die Eingabe niemanden nennt: wer anlegt, oder die Verantwortliche der Welt. */
  zustaendig: 'wer-anlegt' | 'welt';
  /** Datenschutz-Herkunft (Art. 14). `null` = die Eingabe wählt (Kartei). */
  herkunft: Herkunft | null;
  rechtsgrundlage?: Rechtsgrundlage;
  /** Lebensphase — Vorgabe; die Kartei darf eine andere wählen. */
  lebensphase: Lebensphase;
  /** Lead nach dem Anlegen: bleibt (neu/abgeleitet) oder geht auf einen aktiven Status (`leadZiel`). */
  lead: 'bleibt' | 'kontaktiert' | 'qualifizierung';
  /** Firma anlegen, wenn es sie noch nicht gibt (sonst nur verknüpfen bzw. den Namen am Kontakt lassen). */
  firmaAnlegen: boolean;
  /** Follow-up: immer (der Weg legt eines an), aus dem „Nächsten Schritt“ der Eingabe, oder nie. */
  followUp: 'immer' | 'aus-schritt' | 'nie';
  /** Quelle (Kanal-Erkennung `kanalVon`) — nie ein Wort, das eine Anfrage oder Kampagne vortäuscht. */
  quelle: string;
  /** Text der ersten Aktivität (System). */
  vermerk: string;
  /** Warum dieser Weg bewusst anders ist. */
  anders?: string;
}

export const ANLEGE_REGELN: Record<AnlegeWeg, AnlegeRegel> = {
  kartei: { label: 'Kartei', welt: 'sales', zustaendig: 'welt', herkunft: null, lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: true, followUp: 'aus-schritt', quelle: 'Von Hand angelegt', vermerk: 'Von Hand angelegt',
    anders: 'Herkunft, Lebensphase und Anrede wählt man im Dialog (Visitenkarte → Veranstaltung).' },
  firmenkarte: { label: 'Firmenkarte', welt: 'sales', zustaendig: 'welt', herkunft: null, lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: false, followUp: 'aus-schritt', quelle: 'Von Hand angelegt', vermerk: 'Von Hand angelegt (Firmenkarte)',
    anders: 'Die Firma steht fest (die Karte, aus der man anlegt) — es entsteht keine neue.' },
  schnell: { label: '+ Aktivität', welt: 'sales', zustaendig: 'welt', herkunft: null, lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: true, followUp: 'nie', quelle: 'Von Hand angelegt', vermerk: 'Von Hand angelegt (beim Festhalten einer Aktivität)',
    anders: 'Die Aktivität im selben Dialog ist der nächste Schritt — kein eigenes Follow-up.' },
  prospecting: { label: 'Prospecting', welt: 'sales', zustaendig: 'welt', herkunft: 'recherche', rechtsgrundlage: 'berechtigt', lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: true, followUp: 'aus-schritt', quelle: 'Prospecting (Recherche)', vermerk: 'Aus der Zielliste (Prospecting) übernommen',
    anders: 'Recherche: die Daten stammen nicht von der Person — Art. 14 (Information binnen eines Monats) gilt.' },
  makeone: { label: 'Make.One-Abend', welt: 'event', zustaendig: 'wer-anlegt', herkunft: 'veranstaltung', lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: true, followUp: 'nie', quelle: 'Visitenkarte', vermerk: 'Per Visitenkarte am Einlass angelegt',
    anders: 'Wer am Einlass eincheckt, hat die Person getroffen und hält die Beziehung; nachgefasst wird über die Teilnahme (Nachfassen nach dem Abend).' },
  anfrage: { label: 'Anfrage / Inbox', welt: 'marketing', zustaendig: 'wer-anlegt', herkunft: 'selbst', rechtsgrundlage: 'vertrag', lebensphase: 'interessent', lead: 'kontaktiert', firmaAnlegen: true, followUp: 'immer', quelle: 'Anfrage über …', vermerk: 'Anfrage über …',
    anders: 'Die Person hat selbst angefragt (Art. 6 Abs. 1 lit. b) — wer die Anfrage aufnimmt, beantwortet sie (Follow-up heute).' },
  netzwerken: { label: 'Netzwerken', welt: 'sales', zustaendig: 'welt', herkunft: 'veranstaltung', rechtsgrundlage: 'berechtigt', lebensphase: 'kontakt', lead: 'kontaktiert', firmaAnlegen: true, followUp: 'immer', quelle: NETZWERKEN_QUELLE, vermerk: 'Per Visitenkarte erfasst — Netzwerken',
    anders: 'Eigene idempotente Schritte (Offline-Warteschlange, feste Kennungen); „Qualifizieren“ setzt den Lead auf Qualifizierung; Zuständig wählt man beim Erfassen.' },
  import: { label: 'Import (Liste)', welt: 'sales', zustaendig: 'welt', herkunft: null, lebensphase: 'kontakt', lead: 'bleibt', firmaAnlegen: true, followUp: 'nie', quelle: 'Liste', vermerk: '',
    anders: 'Massenweg: Herkunft und Besitzer kommen aus der Datei, Dubletten über den Schlüssel, Konflikte statt Überschreiben; kalte Leads gehen ins Segment „Vernetzen“, kein Follow-up.' },
};

// ── Eingabe ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface PersonEingabe {
  vorname?: string; nachname?: string; email?: string; telefon?: string; mobil?: string; position?: string; linkedin?: string; webseite?: string;
  /** Firma: Name (bestehend oder neu) oder feste Kennung (Firmenkarte). */
  firma?: string; firmaId?: string;
  lebensphase?: Lebensphase; herkunft?: Herkunft; anrede?: 'Sie' | 'Du';
  /** Zuständig („Hält die Beziehung“): Team-Kürzel oder „beide“ (1.10). */
  zustaendig?: string;
  /** Nächster Schritt → Follow-up (1.12). */
  naechsterSchritt?: { text: string; datum: string };
  /** Die Daten kommen von einer Visitenkarte (Quelle „Visitenkarte“). */
  vonKarte?: boolean;
  /** Eigener Text der ersten Aktivität (z. B. „… am Einlass angelegt — <Event>“). */
  anlass?: string;
  /**
   * Angaben zur Firma, nur für eine NEU angelegte (Prospecting: Branche, Größe) — eine vorhandene behält, was dort steht (`firmaSichern`).
   * Nahtstellen 09.10.: vorher gingen sie nur über „aktion: firma“ mit — mit Ansprechpartner fielen Branche und Größe weg.
   */
  firmaZusatz?: { branche?: string; stadt?: string; mitarbeiter?: string };
}
export const PERSON_GRENZEN = { name: 80, email: 160, telefon: 60, position: 160, firma: 160, link: 300, schritt: 300, anlass: 300 } as const;

const ANREDEN = ['Sie', 'Du'] as const;
/**
 * Eingabe aus dem Netz säubern. Nie kürzen (28.09.): zu lange Felder → `zuGross` (413). Ohne Vor- und Nachname → Fehler.
 */
export function eingabeSaeubern(roh: unknown): { ok: true; e: PersonEingabe } | { ok: false; fehler: string; status: 400 | 413 } {
  const o = roh && typeof roh === 'object' ? (roh as Record<string, unknown>) : {};
  const zuLang: string[] = [];
  const t = (feld: string, n: number) => {
    const v = typeof o[feld] === 'string' ? (o[feld] as string).replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '';
    if (v.length > n) zuLang.push(feld);
    return v || undefined;
  };
  const G = PERSON_GRENZEN;
  const email = t('email', G.email)?.toLowerCase();
  const e: PersonEingabe = {
    vorname: t('vorname', G.name), nachname: t('nachname', G.name), email: email && email.includes('@') ? email : undefined,
    telefon: t('telefon', G.telefon), mobil: t('mobil', G.telefon), position: t('position', G.position), linkedin: t('linkedin', G.link), webseite: t('webseite', G.link),
    firma: t('firma', G.firma), firmaId: typeof o.firmaId === 'string' && /^f-[a-z0-9-]{2,63}$/.test(o.firmaId) ? o.firmaId : undefined,
    lebensphase: (LEBENSPHASEN as readonly string[]).includes(String(o.lebensphase)) ? o.lebensphase as Lebensphase : undefined,
    herkunft: HERKUNFT.some(h => h.id === o.herkunft) ? o.herkunft as Herkunft : undefined,
    anrede: (ANREDEN as readonly string[]).includes(String(o.anrede)) ? o.anrede as 'Sie' | 'Du' : undefined,
    zustaendig: wer(o.zustaendig), vonKarte: o.vonKarte === true, anlass: t('anlass', G.anlass),
  };
  const z = o.firmaZusatz && typeof o.firmaZusatz === 'object' ? o.firmaZusatz as Record<string, unknown> : null;
  if (z) {
    const zusatz = Object.fromEntries((['branche', 'stadt', 'mitarbeiter'] as const).map(k => [k, typeof z[k] === 'string' ? (z[k] as string).replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '']).filter(([, v]) => v));
    if (Object.values(zusatz).some(v => v.length > G.firma)) zuLang.push('firmaZusatz');
    else if (Object.keys(zusatz).length) e.firmaZusatz = zusatz;
  }
  if (email && !e.email) return { ok: false, fehler: 'Die E-Mail sieht unvollständig aus — bitte prüfen oder leeren.', status: 400 };
  const s = o.naechsterSchritt && typeof o.naechsterSchritt === 'object' ? o.naechsterSchritt as Record<string, unknown> : null;
  if (s) {
    const text = typeof s.text === 'string' ? s.text.replace(/\s+/g, ' ').trim() : '';
    const datum = typeof s.datum === 'string' ? s.datum : '';
    if (text.length > G.schritt) zuLang.push('naechsterSchritt');
    else if (text && !istKalendertag(datum)) return { ok: false, fehler: 'Der nächste Schritt braucht ein Datum.', status: 400 };
    else if (!text && datum) return { ok: false, fehler: 'Zum Datum fehlt der nächste Schritt (was ist zu tun?).', status: 400 };
    else if (text) e.naechsterSchritt = { text, datum };
  }
  if (zuLang.length) return { ok: false, fehler: `Zu lang (nichts gespeichert): ${zuLang.join(', ')}.`, status: 413 };
  if (!e.vorname && !e.nachname) return { ok: false, fehler: 'Vor- oder Nachname fehlt.', status: 400 };
  return { ok: true, e };
}

/** Wer zuständig wird (1.10): gewählt (Team oder „beide“) — sonst je Weg wer anlegt bzw. die Verantwortliche der Welt. Nie ein fester Name. */
export function zustaendigFuer(weg: AnlegeWeg, gewaehlt: string | undefined, person: string | null | undefined): string {
  const r = ANLEGE_REGELN[weg];
  return wer(gewaehlt) ?? (r.zustaendig === 'wer-anlegt' && wer(person) ? (wer(person) as string) : verantwortlich(r.welt));
}

/** Der Kartei-Eintrag aus der Eingabe — Herkunft ja, Einwilligung nie. Stempeln/Säubern/Sperrliste macht der Server danach. */
export function personEntwurf(e: PersonEingabe, weg: AnlegeWeg, o: { id: string; heute: string; jetzt: string; person: string | null; firma?: { id: string; name: string } }): Kontakt {
  const r = ANLEGE_REGELN[weg];
  const herkunft = r.herkunft ?? e.herkunft ?? (e.vonKarte ? 'veranstaltung' : undefined);
  const herk = HERKUNFT.find(h => h.id === herkunft);
  const firma = o.firma?.name ?? e.firma;
  const quelle = e.vonKarte ? 'Visitenkarte' : r.quelle;
  const vermerk = e.anlass ?? (e.vonKarte && weg === 'kartei' ? 'Per Visitenkarte angelegt' : r.vermerk);
  return {
    id: o.id, vorname: e.vorname ?? '', nachname: e.nachname ?? '',
    ...(e.email ? { email: e.email } : {}), ...(e.telefon ? { telefon: e.telefon } : {}), ...(e.mobil ? { sms: e.mobil } : {}),
    ...(e.position ? { position: e.position } : {}), ...(e.linkedin ? { linkedin: e.linkedin } : {}), ...(e.webseite ? { firmaWebseite: e.webseite } : {}),
    ...(firma ? { firma, ...(o.firma ? { firmaId: o.firma.id } : {}) } : {}),
    eignung: '', prio: '', stufe: 'neu', lebensphase: r.herkunft === null ? (e.lebensphase ?? r.lebensphase) : r.lebensphase, anrede: e.anrede ?? 'Sie',
    besitzer: zustaendigFuer(weg, e.zustaendig, o.person),
    ...(herkunft ? { herkunft, ...(herk?.fremd ? { fremddaten: true } : {}) } : {}), ...(r.rechtsgrundlage ? { rechtsgrundlage: r.rechtsgrundlage } : {}),
    quelle, aktivitaeten: vermerk ? [{ am: o.jetzt, art: 'system', text: vermerk.slice(0, 300), von: o.person || 'system' }] : [],
    importiertAm: o.heute, geaendertAm: o.heute,
  };
}

/** Dublette (dieselbe Regel wie Netzwerken): gleiche Mail, oder Nummer UND Nachname = dieselbe Person; Name + Firma = nur ein Hinweis. */
export function dublettePruefen(e: Pick<PersonEingabe, 'vorname' | 'nachname' | 'firma' | 'email' | 'telefon' | 'mobil'>, kontakte: readonly Kontakt[], eigeneId: string): { gleich?: Treffer; vermutlich?: Treffer } {
  const z = zusammenfuehrung({ kontakt: { vorname: e.vorname, nachname: e.nachname, firma: e.firma, email: e.email, telefon: e.telefon, mobil: e.mobil } }, kontakte, eigeneId);
  return { ...(z.ziel ? { gleich: z.ziel } : {}), ...(z.vermutlich ? { vermutlich: z.vermutlich } : {}) };
}
export const dublettenText = (t: Treffer) => `${anzeigename(t.kontakt)}${t.kontakt.firma ? ` (${t.kontakt.firma})` : ''} steht schon in der Kartei (${t.grund}) — nicht doppelt angelegt.`;

// ── Firma ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type FirmaPlan = { art: 'vorhanden'; firma: Firma } | { art: 'neu'; firma: Firma } | { art: 'zurueck'; firma: Firma };
export { firmaZurueckholen, ZURUECK_VERMERK } from './ablage';

/**
 * Welche Firma gehört zur Eingabe? `sicht` = ohne Papierkorb (was alle sehen), `alle` = mit Papierkorb. Vorhanden über Name/Kennung
 * (`bestehendeFirma`) oder Name + Domain (`firmaZurKarte`) — sonst neu mit der Kennung aus dem Namen; liegt diese Kennung im Papierkorb, zurück.
 */
export function firmaPlanen(sicht: readonly Firma[], alle: readonly Firma[], name: string | undefined, kontakt: { email?: string; webseite?: string }, heute: string, jetzt: string): FirmaPlan | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  const da = bestehendeFirma(sicht, n) ?? firmaZurKarte({ firma: n, email: kontakt.email, webseite: kontakt.webseite }, sicht as Firma[]);
  if (da) return { art: 'vorhanden', firma: da };
  const id = firmenId(n);
  const imKorb = alle.find(f => f.id === id && f.geloeschtAm) ?? alle.find(f => f.geloeschtAm && bestehendeFirma([f], n));
  if (imKorb) return { art: 'zurueck', firma: firmaZurueckholen(imKorb, heute, jetzt) };
  const domain = domainVon({ email: kontakt.email, firmaWebseite: kontakt.webseite });
  return { art: 'neu', firma: { id, name: n, rolle: 'offen', ...(kontakt.webseite ? { webseite: kontakt.webseite } : {}), ...(domain ? { domain } : {}), geaendert: jetzt } };
}

export { firmaAusDomain } from './firmen';

// ── Lead nach dem Anlegen ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Firmen ohne Vertrieb bekommen keinen Lead (sie sind kein Vertrieb, `leads()` lässt sie aus). */
const OHNE_VERTRIEB: Partial<Record<Firma['rolle'], string>> = { dienstleister: 'Dienstleister', investor: 'Investor', wettbewerb: 'Wettbewerber' };
const STEHT: Partial<Record<LeadStatus, string>> = { kein_fit: 'Kein Fit', ruht: 'Ruht', sql: 'SQL' };
export type LeadZielErgebnis =
  | { art: 'setzen'; lead: Lead }
  | { art: 'bleibt' }
  /** Bewusst nicht geändert — ein Mensch soll prüfen (Netzwerken setzt dann das Label „Lead prüfen“). */
  | { art: 'pruefen'; grund: string };

/**
 * Wohin der Lead nach einem Anlege-Weg geht (EINE Regel für Netzwerken und Anfrage, 09.10.): Ziel „Kontaktiert“ bzw. „Qualifizierung“.
 *  · ohne Lead oder „Neu“ → Ziel; „Kontaktiert“/„Im Gespräch“ → nur bei Ziel „Qualifizierung“
 *  · Kein Fit, Ruht, SQL und eine Firma ohne Vertrieb bleiben stehen — `pruefen` mit Grund (der Weg entscheidet, ob er es meldet)
 *  · übrige aktive Status und Kunde bleiben (`bleibt`)
 */
export function leadZiel(alt: Lead | undefined, ziel: 'kontaktiert' | 'qualifizierung', o: { firmaRolle?: Firma['rolle']; jetzt: string; person: string; notiz?: string }): LeadZielErgebnis {
  const ohne = o.firmaRolle ? OHNE_VERTRIEB[o.firmaRolle] : undefined;
  if (ohne) return { art: 'pruefen', grund: ohne };
  const steht = alt ? STEHT[alt.status] : undefined;
  if (steht) return { art: 'pruefen', grund: steht };
  const aenderbar = !alt || alt.status === 'neu' || (ziel === 'qualifizierung' && (alt.status === 'kontaktiert' || alt.status === 'im_gespraech'));
  if (!aenderbar) return { art: 'bleibt' };
  const lead = leadSaeubern({ ...(alt ?? { kriterien: leereKriterien() }), status: ziel, ...(o.notiz !== undefined ? { notiz: o.notiz } : {}), geaendert: o.jetzt, geaendertVon: o.person });
  return lead ? { art: 'setzen', lead } : { art: 'bleibt' };
}

// ── Neue Leads ohne nächsten Schritt (1.12, Überblick) ─────────────────────────────────────────────────────────────────────────
/**
 * Frisch von Hand angelegte Personen (`frischAngelegt`: ≤ 14 Tage, mit Anlege-Vermerk — Listen-Importe zählen nicht) ohne nächsten Schritt,
 * ohne offenes Follow-up und ohne offenen Deal — sie fallen sonst durch „Für dich“. Ohne Archivierte, Art. 18 und Werbesperre (`ausgenommen`),
 * ohne Kein Fit/Ruht. Jüngste zuerst.
 */
export function neueOhneSchritt(kontakte: readonly Kontakt[], crm: Pick<CrmBestand, 'followups' | 'chancen' | 'firmen'>, heute: string): Kontakt[] {
  const mitFollowUp = new Set((crm.followups ?? []).filter(f => f.status === 'offen' && f.kontaktId).map(f => f.kontaktId!));
  const mitDeal = new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds));
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  const steht = (k: Kontakt) => { const l = k.firmaId ? firmen.get(k.firmaId)?.lead : k.lead; return l?.status === 'kein_fit' || l?.status === 'ruht'; };
  return kontakte
    .filter(k => !k.archiviertAm && !ausgenommen(k) && frischAngelegt(k, heute) && !k.naechsterSchritt && !mitFollowUp.has(k.id) && !mitDeal.has(k.id) && !steht(k))
    .sort((a, b) => (b.importiertAm ?? '').localeCompare(a.importiertAm ?? '') || anzeigename(a).localeCompare(anzeigename(b), 'de'));
}

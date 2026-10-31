// ─── Newsletter-Anmeldung — Anmelden, Bestätigen, ins CRM (Server, 30.10., Branch `newsletter-anmeldung`) ──────────────────────────────
// `newsletterBereit()`  ob die Anmeldung läuft: eingeschaltet + nutzbares Absender-Postfach (absenderPruefen, wie „Angebot anfordern“) + Verantwortlicher
//                       (Einstellung oder Einrichtung der Instanz) + Adresse der Website (Einstellung oder MAKE_OS_ADRESSE). Sonst: aus (Seite neutral, 404).
// `anmeldungVerarbeiten` läuft NACH der Antwort (die Antwort an den Gast ist für jede Adresse dieselbe, auch in der Zeit): Art. 18 → nichts gespeichert;
//                       Werbesperre/Sperrliste → Zeile „gesperrt“ ohne Mail; schon angemeldet (volle Einwilligung) → nichts; sonst Zeile mit neuem Token
//                       und die Bestätigungsmail (lib/newsletter/versand.ts), höchstens `MAILS_JE_TAG` je Adresse und Tag.
// `bestaetigen`         Token zeitkonstant, einmalig, 7 Tage → bestätigt; dann `insCrm`: Kontakt finden oder über den EINEN Weg `personAnlegen` (Weg
//                       „newsletter“) anlegen und die Einwilligung „Newsletter“ mit vollem Nachweis setzen (Kartei-Sperre, `datenschutzStempeln`) —
//                       Art. 18 → nichts geschrieben, Werbesperre/Sperrliste → keine Einwilligung. Was davon gilt, sieht nur der Haushalt.
// `newsletterFristLauf` Löschfrist im Morgenlauf (lib/crm/loeschfristen-lauf.ts).

import { after } from 'next/server';
import { localDay, tagVon } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { UG_NAME } from '@/lib/einheiten';
import { firmaOhneRechtsform } from '@/lib/kalender/verbinden-anzeige';
import { datenschutzLink } from '@/lib/kalender/buchung';
import { alleAdressen } from '@/lib/crm/emails';
import { nachweisLuecken } from '@/lib/crm/einwilligung';
import type { Aktivitaet, Kontakt } from '@/lib/make-one/crm';
import {
  ANMELDUNGEN_MAX, MAILS_JE_TAG, TOKEN_TAGE, belegRefVon, einwilligungAus, fassungKennung, hatVolleNewsletterEinwilligung, websiteSauber, wortlautFuer,
  anmeldungenAufraeumen, type NewsletterAnmeldung, type NewsletterEinstellungen,
} from './regeln';
import { aendereAnmeldung, aendereAnmeldungen, ladeAnmeldungen, ladeEinstellungen, neuesToken, tokenHash, tokenIndex } from './speicher';

/** Die geprüfte Lage der Instanz — nur damit wird angemeldet und gesendet. */
export interface Bereit {
  e: NewsletterEinstellungen;
  absender: NonNullable<NewsletterEinstellungen['absender']>;
  marke: string;
  wortlaut: string;
  fassung: string;
  verantwortlich: string;
  datenschutzLink: string | null;
  website: string;
}

/** Name in Seite und Mail: Einstellung, sonst die Firma der Instanz ohne Rechtsform (wie der Check). */
export const markeVon = (e: NewsletterEinstellungen): string => e.marke || firmaOhneRechtsform(UG_NAME);
/** Adresse der Website: Einstellung, sonst MAKE_OS_ADRESSE (nur als https-Ursprung) — sonst null. */
export const websiteVon = (e: NewsletterEinstellungen): string | null => e.website || websiteSauber(process.env.MAKE_OS_ADRESSE ?? '') || null;

/** Verantwortlicher und Link: Abweichung in den Einstellungen, sonst die Einrichtung der Instanz (Einstellungen › Datenschutz). */
export async function datenschutzVon(e: NewsletterEinstellungen): Promise<{ verantwortlich: string | null; link: string | null; einrichtung: { verantwortlich: string | null; link: string | null } }> {
  const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const ds = await datenschutzOeffentlichLaden().catch(() => ({ verantwortlich: null, seite: null }));
  const einrichtung = { verantwortlich: (ds.verantwortlich ?? '').trim() || null, link: datenschutzLink(ds) };
  return { verantwortlich: e.verantwortlich || einrichtung.verantwortlich, link: e.datenschutzLink || einrichtung.link, einrichtung };
}

/** Warum die Anmeldung nicht läuft (leer = sie läuft) — und die Lage, wenn sie läuft. `ohneSchalter`: so, als wäre sie eingeschaltet (Einschalten prüfen). */
export async function bereitPruefen(e: NewsletterEinstellungen, o: { ohneSchalter?: boolean } = {}): Promise<{ bereit: Bereit | null; gruende: string[] }> {
  const gruende: string[] = [];
  if (!e.aktiv && !o.ohneSchalter) gruende.push('Die Anmeldung ist ausgeschaltet.');
  const { absenderPruefen } = await import('@/lib/crm/angebot-versand');
  const abs = await absenderPruefen(e.absender).catch(() => ({ ok: false as const, grund: 'Das Absender-Postfach ließ sich nicht prüfen.' }));
  if (!abs.ok) gruende.push(e.absender ? abs.grund : 'Absender-Postfach fehlt — ohne Absender geht keine Bestätigungsmail raus.');
  const ds = await datenschutzVon(e);
  if (!ds.verantwortlich) gruende.push('Verantwortlicher fehlt (Einstellungen › Datenschutz oder hier als Abweichung).');
  const website = websiteVon(e);
  if (!website) gruende.push('Adresse der Website fehlt (https://…).');
  if (gruende.length || !e.absender || !ds.verantwortlich || !website) return { bereit: null, gruende };
  const marke = markeVon(e);
  return { bereit: { e, absender: e.absender, marke, wortlaut: wortlautFuer(e, marke), fassung: fassungKennung(e.fassung), verantwortlich: ds.verantwortlich, datenschutzLink: ds.link, website }, gruende: [] };
}

/** Läuft die Anmeldung? — die Lage oder null (dann: Seite neutral, Schnittstelle 404). */
export async function newsletterBereit(): Promise<Bereit | null> {
  return (await bereitPruefen(await ladeEinstellungen())).bereit;
}

/** Für das Verzeichnis (Art. 30): eingeschaltet mit gewähltem Absender — dann findet die Verarbeitung statt (oder kann jederzeit). Wirft nie. */
export async function newsletterEingerichtet(): Promise<boolean> {
  try { const e = await ladeEinstellungen(); return e.aktiv && !!e.absender; } catch { return false; }
}

// ── Arbeit nach der Antwort ─────────────────────────────────────────────────────────────────────────────────────────────────────

const offen = new Set<Promise<unknown>>();
/** Nur für Tests: wartet, bis die Arbeit nach der Antwort fertig ist. */
export const _nachlauf = async (): Promise<void> => { await Promise.all(Array.from(offen)); };
/** Arbeit NACH der Antwort (`after`) — außerhalb einer Anfrage (Tests) sofort im Hintergrund. Fehler nur ins Log, ohne Adresse. */
export function nachDerAntwort(arbeit: () => Promise<unknown>): void {
  const los = () => {
    const p = arbeit().catch(e => { console.error('[newsletter] Anmeldung:', e instanceof Error ? e.message.slice(0, 200) : 'Fehler'); });
    offen.add(p);
    void p.finally(() => offen.delete(p));
    return p;
  };
  try { after(los); } catch { void los(); }
}

// ── Anmelden ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AnmeldeErgebnis = 'gesendet' | 'versandFehler' | 'grenze' | 'schon' | 'eingeschraenkt' | 'gesperrt' | 'voll';

/** Die Person zu einer Adresse (alle Adressen der Akte) — auch eingeschränkte (die werden hier nie verarbeitet, nur erkannt). */
async function personZurAdresse(email: string): Promise<Kontakt | undefined> {
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  return (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(k => alleAdressen(k).includes(email));
}
async function aufSperrliste(email: string): Promise<boolean> {
  const { sperrlisteLaden, sperrTreffer } = await import('@/lib/crm/sperrliste');
  return !!sperrTreffer(await sperrlisteLaden(), { email });
}

/**
 * Eine Anmeldung verarbeiten — nach der Antwort an den Gast (siehe Kopf). `email` ist schon geprüft (`emailSauber`), `vorname` (`vornameSauber`).
 * Wirft nicht für Fachfälle; das Ergebnis sieht nur der Aufrufer (Tests, Log ohne Adresse).
 */
export async function anmeldungVerarbeiten(eingabe: { email: string; vorname: string }, b: Bereit, jetzt = new Date()): Promise<AnmeldeErgebnis> {
  const { email, vorname } = eingabe;
  const k = await personZurAdresse(email);
  // Art. 18: eine eingeschränkte Person wird nicht verarbeitet — keine Zeile, keine Mail.
  if (k?.eingeschraenkt) return 'eingeschraenkt';
  const gesperrt: NewsletterAnmeldung['gesperrt'] = k?.werbesperre ? 'werbesperre' : !k && (await aufSperrliste(email)) ? 'sperrliste' : undefined;
  if (!gesperrt && k && hatVolleNewsletterEinwilligung(k.einwilligungen, nachweisLuecken)) return 'schon';
  const jetztIso = jetzt.toISOString(), heute = localDay(jetzt);
  // Ergebnis der Sperre (in der Sperre gesetzt — als Objekt, damit die Typprüfung nicht beim Anfangswert stehen bleibt).
  const lauf: { ergebnis: AnmeldeErgebnis; token: string | null; ziel: string | null } = { ergebnis: 'voll', token: null, ziel: null };
  await aendereAnmeldungen(bestand => {
    // Eine wartende (bzw. gesperrte) Zeile je Adresse: eine erneute Anmeldung erneuert sie, statt eine zweite anzulegen.
    const i = bestand.anmeldungen.findIndex(a => a.email === email && !a.bestaetigt);
    const alt = i >= 0 ? bestand.anmeldungen[i] : undefined;
    if (!alt && bestand.anmeldungen.length >= ANMELDUNGEN_MAX) { lauf.ergebnis = 'voll'; return bestand; }
    const { tokenHash: _t, gueltigBis: _g, gesperrt: _s, versandFehler: _v, crm: _c, ...basis } = alt ?? ({} as Partial<NewsletterAnmeldung>);
    const kopf = { ...basis, id: alt?.id ?? neueKennung('nl'), email, ...(vorname ? { vorname } : alt?.vorname ? { vorname: alt.vorname } : {}), angemeldet: jetztIso, wortlaut: b.wortlaut, fassung: b.fassung };
    let neu: NewsletterAnmeldung;
    if (gesperrt) {
      // Gesperrt: keine Mail, kein Token — die Zeile zeigt dem Haushalt nur, dass es eine Anmeldung gab (zum Klären, Frist 30 Tage).
      neu = { ...kopf, gesperrt };
      lauf.ergebnis = 'gesperrt';
    } else {
      const heuteSchon = alt?.mails?.tag === heute ? alt.mails.anzahl : 0;
      if (heuteSchon >= MAILS_JE_TAG) { lauf.ergebnis = 'grenze'; return bestand; }
      const token = neuesToken();
      lauf.token = token;
      neu = { ...kopf, tokenHash: tokenHash(token), gueltigBis: new Date(jetzt.getTime() + TOKEN_TAGE * 86_400_000).toISOString(), mails: { tag: heute, anzahl: heuteSchon + 1 } };
      lauf.ziel = neu.id;
    }
    return { ...bestand, anmeldungen: i >= 0 ? bestand.anmeldungen.map((x, j) => (j === i ? neu : x)) : [...bestand.anmeldungen, neu] };
  });
  if (!lauf.token || !lauf.ziel) return lauf.ergebnis;
  const { bestaetigungsmailSenden } = await import('./versand');
  return (await bestaetigungsmailSenden(lauf.ziel, lauf.token, b)).ok ? 'gesendet' : 'versandFehler';
}

// ── Bestätigen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Den Bestätigungslink einlösen: Token zeitkonstant über alle wartenden Zeilen, höchstens 7 Tage alt, genau einmal (der Hash fällt weg).
 * `ok: false` für unbekannt, benutzt, abgelaufen und kaputt — von außen nicht zu unterscheiden. Danach die Übernahme ins CRM (`insCrm`).
 */
export async function bestaetigen(token: unknown, jetzt = new Date()): Promise<{ ok: boolean; id?: string; crm?: NewsletterAnmeldung['crm'] }> {
  let treffer: NewsletterAnmeldung | null = null;
  await aendereAnmeldungen(bestand => {
    const i = tokenIndex(bestand.anmeldungen, token);
    if (i < 0) return bestand;
    const a = bestand.anmeldungen[i];
    if (a.bestaetigt || a.gesperrt || !a.gueltigBis || Date.parse(a.gueltigBis) < jetzt.getTime()) return bestand;
    const { tokenHash: _t, ...rest } = a;
    treffer = { ...rest, bestaetigt: jetzt.toISOString() };
    return { ...bestand, anmeldungen: bestand.anmeldungen.map((x, j) => (j === i ? treffer! : x)) };
  });
  const a = treffer as NewsletterAnmeldung | null;
  if (!a) return { ok: false };
  const crm = await insCrm(a, jetzt);
  await aendereAnmeldung(a.id, x => ({ ...x, crm }));
  return { ok: true, id: a.id, crm };
}

/** Kennung des Kontakts aus der Anmeldung (`nl-<uuid>` → `c-<uuid>`) — eine Wiederholung legt nie eine zweite Person an. */
export const kontaktKennungFuer = (id: string): string => `c-${id.slice(3)}`;

/**
 * Nach der Bestätigung ins CRM (auch „noch einmal“ aus dem Haushalt): Person finden (alle Adressen) oder über `personAnlegen` (Weg „newsletter“)
 * anlegen, dann die Einwilligung „Newsletter“ mit vollem Nachweis in EINER Kartei-Sperre auf dem frischen Stand. Idempotent über den Beleg.
 */
export async function insCrm(a: NewsletterAnmeldung, jetzt = new Date()): Promise<NonNullable<NewsletterAnmeldung['crm']>> {
  const am = jetzt.toISOString();
  const abgelehnt = (grund: string) => ({ status: 'abgelehnt' as const, am, grund });
  if (!a.bestaetigt) return { status: 'fehler', am, grund: 'nicht bestätigt' };
  try {
    const k = await personZurAdresse(a.email);
    if (k?.eingeschraenkt) return abgelehnt('Verarbeitung eingeschränkt (Art. 18) — nichts übernommen.');
    if (k?.werbesperre) return abgelehnt('Werbesperre — keine Einwilligung angelegt; bitte am Kontakt klären.');
    let id = k?.id;
    let neuePerson = false;
    if (!k) {
      if (await aufSperrliste(a.email)) return abgelehnt('Die Adresse steht auf der Sperrliste — nichts übernommen; bitte klären.');
      const { personAnlegen } = await import('@/lib/crm/person-anlegen-server');
      const r = await personAnlegen({ email: a.email, ...(a.vorname ? { vorname: a.vorname } : {}) }, { weg: 'newsletter', person: null, wer: { art: 'system' }, id: kontaktKennungFuer(a.id) });
      if (r.ok) { id = r.kontaktId; neuePerson = r.neu; }
      else if (r.eingeschraenkt) return abgelehnt('Verarbeitung eingeschränkt (Art. 18) — nichts übernommen.');
      else if (r.dublette) id = r.dublette.id;
      else return { status: 'fehler', am, grund: r.fehler.slice(0, 200) };
    }
    const { aendereKontakte } = await import('@/lib/crm/kartei-schreiben');
    const { datenschutzStempeln } = await import('@/lib/crm/datenschutz-stempel');
    const heute = localDay(jetzt);
    const lage: { aus: 'ok' | 'weg' | 'eingeschraenkt' | 'werbesperre' } = { aus: 'weg' };
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      const i = f.kontakte.findIndex(x => x.id === id);
      if (i < 0) { lage.aus = 'weg'; return f; }
      const alt = f.kontakte[i];
      if (alt.eingeschraenkt) { lage.aus = 'eingeschraenkt'; return f; }
      if (alt.werbesperre) { lage.aus = 'werbesperre'; return f; }
      lage.aus = 'ok';
      if ((alt.einwilligungen ?? []).some(e => e.belegRef === belegRefVon(a.id))) return f; // schon übernommen
      const ew = einwilligungAus(a, tagVon(a.bestaetigt!));
      // Eine vorhandene Person bekommt einen Vermerk im Verlauf (eine neue trägt ihn schon aus `personAnlegen`).
      const vermerk: Aktivitaet[] = neuePerson ? [] : [{ am, art: 'system', text: 'Newsletter über die Website angemeldet (Double-Opt-in bestätigt)', von: 'system' }];
      const neu = datenschutzStempeln({ ...alt, einwilligungen: [...(alt.einwilligungen ?? []), ew], aktivitaeten: [...(alt.aktivitaeten ?? []), ...vermerk] }, alt, 'system', am, heute);
      return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
    }, { art: 'system' });
    const { aus } = lage;
    if (aus === 'eingeschraenkt') return abgelehnt('Verarbeitung eingeschränkt (Art. 18) — nichts übernommen.');
    if (aus === 'werbesperre') return abgelehnt('Werbesperre — keine Einwilligung angelegt; bitte am Kontakt klären.');
    if (aus === 'weg' || !id) return { status: 'fehler', am, grund: 'Der Kontakt ließ sich nicht finden oder anlegen.' };
    return { status: 'ok', am, kontaktId: id };
  } catch (x) {
    return { status: 'fehler', am, grund: String((x as Error)?.message ?? x).slice(0, 200) };
  }
}

// ── Löschfrist (Morgenlauf) ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Löschfrist anwenden (`anmeldungenAufraeumen`) — schreibt nur, wenn etwas wegfällt. Ist die Kartei nicht lesbar, bleiben bestätigte. */
export async function newsletterFristLauf(jetzt = new Date()): Promise<number> {
  const b = await ladeAnmeldungen();
  if (!b.anmeldungen.length) return 0;
  let belege: Set<string> | null = null;
  try {
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const kontakte = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
    belege = new Set(kontakte.flatMap(k => (k.einwilligungen ?? []).filter(e => e.kanal === 'newsletter' && !e.widerrufenAm && e.belegRef?.startsWith('newsletter:')).map(e => e.belegRef!)));
  } catch { belege = null; }
  let entfernt = 0;
  await aendereAnmeldungen(cur => {
    const r = anmeldungenAufraeumen(cur, jetzt, belege);
    entfernt = r.entfernt;
    return r.entfernt ? r.bestand : cur;
  });
  return entfernt;
}

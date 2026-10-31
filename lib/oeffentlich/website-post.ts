// ─── Website-Absender — die EINE Sendefunktion der öffentlichen Website-Wege (nur Server, 31.10.) ─────────────────────────────────────
// Kevin 31.10.: „bei den großen sachen müssen sie nachher ihre email abgeben … damit wir denen das ganze zuschicken können.“ Zwei Wege schicken
// seitdem automatisch eine Mail an die Person, die auf der Website selbst etwas angefordert hat — beide über `websiteMailSenden` (allgemein, ohne
// Wissen über den auslösenden Weg; ein späteres Kontaktformular setzt für seine Eingangsbestätigung genauso darauf auf):
//   · „Unterlage per E-Mail anfordern“ (lib/unterlagen/*, POST /api/unterlage) — die Download-Links einer großen Vorlage
//   · der Bericht eines Checks (lib/check/bericht*.ts) — sobald es ein Ergebnis gibt und die Person ihre Adresse angegeben hat
// Eiserne Regel 3 („nichts verlässt das System ohne Freigabe“) hat dafür eine weitere dokumentierte Ausnahme neben „Angebot anfordern“
// (lib/crm/angebot-versand.ts) und der Newsletter-Bestätigung (lib/newsletter/versand.ts) — genauso eng:
//   · die Freigabe ist die Wahl des **Website-Absenders** durch einen Inhaber: das Absender-Postfach der Newsletter-Einstellungen
//     (Markttraktion › Marketing › Newsletter › „Anmeldung über die Website“). Ohne Absender geht nichts raus (Unterlagen: aus, Check: kein Versand)
//   · nur an die Adresse, die die Person selbst eingetragen hat, und nur auf ihre eigene Anforderung (Formular bzw. Kontakt-Frage des Checks)
//   · nur fester Text aus einer Vorlage (lib/unterlagen/regeln.ts `unterlageMail`, lib/check/bericht.ts `berichtMail`) — KEINE KI, vom Aufrufer
//     nur der Vorname (geprüft wie beim Newsletter: nur Buchstaben), sonst nur Daten der Instanz und das gerechnete Ergebnis
//   · höchstens `WEBSITE_MAILS_JE_TAG` Mails je Adresse und Berliner Tag über alle diese Wege (Zähler im Arbeitsspeicher, je Fingerabdruck)
//   · nie an eine eingeschränkte Person (Art. 18), nie bei Werbesperre oder Sperrliste (`adresseGesperrt`) — die Antwort nach außen bleibt dieselbe
//   · gesendet über den vorhandenen Weg der Inbox (`inboxSenden`: Absender = das gewählte Postfach, Art. 18 dort noch einmal, Spiegel, Protokoll
//     ohne Text) — keine zweite Sendelogik
// Dazu die Lage der Website (Marke, Adresse, Verantwortlicher) an EINER Stelle (`websiteLage`) und die Arbeit nach der Antwort (`nachDerAntwort`,
// auch von der Newsletter-Anmeldung genutzt).

import { after } from 'next/server';
import { createHash } from 'node:crypto';
import { localDay } from '@/lib/zeit';
import { UG_NAME } from '@/lib/einheiten';
import { firmaOhneRechtsform } from '@/lib/kalender/verbinden-anzeige';
import { datenschutzLink as einrichtungLinkVon } from '@/lib/kalender/buchung';
import { alleAdressen } from '@/lib/crm/emails';
import { adresseMaskiert } from '@/lib/zugang/konten';

// ── Arbeit nach der Antwort ─────────────────────────────────────────────────────────────────────────────────────────────────────

const offen = new Set<Promise<unknown>>();
/** Nur für Tests: wartet, bis die Arbeit nach der Antwort fertig ist (auch, was währenddessen neu dazukam). */
export const _nachlauf = async (): Promise<void> => { while (offen.size) await Promise.all(Array.from(offen)); };
/** Arbeit NACH der Antwort (`after`) — außerhalb einer Anfrage (Tests) sofort im Hintergrund. Fehler nur ins Log, ohne Adresse. */
export function nachDerAntwort(arbeit: () => Promise<unknown>, bereich = 'website'): void {
  const los = () => {
    const p = arbeit().catch(e => { console.error(`[${bereich}] nach der Antwort:`, e instanceof Error ? e.message.slice(0, 200) : 'Fehler'); });
    offen.add(p);
    void p.finally(() => offen.delete(p));
    return p;
  };
  try { after(los); } catch { void los(); }
}

// ── Lage der Website ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WebsiteLage {
  /** Der Website-Absender: Postfach eines Inhabers (aus den Newsletter-Einstellungen), geprüft verbunden. */
  absender: { person: string; postfach: string };
  /** Adresse des Absenders, maskiert (nur Anzeige im Haushalt). */
  ueber: string;
  marke: string;
  /** https-Ursprung der Website — Links in den Mails gehen über sie (Caddy leitet die öffentlichen Pfade an die App). */
  website: string;
  verantwortlich: string;
  datenschutzLink: string | null;
}

const httpsUrsprung = (x: string | undefined): string | null => {
  if (!x || !/^https:\/\//i.test(x)) return null;
  try { const u = new URL(x); return u.protocol === 'https:' && u.hostname && !u.username ? u.origin : null; } catch { return null; }
};

/**
 * Die Lage der Website — `lage` nur, wenn ALLES da ist: Website-Absender verbunden, Verantwortlicher, Adresse der Website. Reihenfolge je Angabe:
 * Check-Einstellungen (die Website kann einer anderen Gesellschaft gehören als die Instanz) → Newsletter-Einstellungen → Einrichtung der Instanz
 * (Verantwortlicher) bzw. `MAKE_OS_ADRESSE` (Website). Wirft nie.
 */
export async function websiteLagePruefen(): Promise<{ lage: WebsiteLage | null; gruende: string[] }> {
  const gruende: string[] = [];
  const { ladeEinstellungen } = await import('@/lib/newsletter/speicher');
  const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
  const nl = await ladeEinstellungen().catch(() => null);
  const ce = await ladeCheckEinstellungen().catch(() => null);
  const { absenderPruefen } = await import('@/lib/crm/angebot-versand');
  const abs = await absenderPruefen(nl?.absender).catch(() => ({ ok: false as const, grund: 'Das Website-Absender-Postfach ließ sich nicht prüfen.' }));
  if (!abs.ok) gruende.push(nl?.absender ? abs.grund : 'Website-Absender fehlt (Marketing › Newsletter › Absender-Postfach) — ohne ihn geht keine Mail raus.');
  // Verantwortlicher: Abweichung der Checks, sonst des Newsletters, sonst die Einrichtung der Instanz (wie `hinweisLaden` und `datenschutzVon`).
  let verantwortlich: string | null = null; let link: string | null = null;
  if (ce?.verantwortlich?.trim()) { verantwortlich = ce.verantwortlich.trim(); link = ce.datenschutzLink ?? null; }
  else {
    const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
    const ds = await datenschutzOeffentlichLaden().catch(() => ({ verantwortlich: null, seite: null }));
    const einrichtung = { verantwortlich: (ds.verantwortlich ?? '').trim() || null, link: einrichtungLinkVon(ds) };
    verantwortlich = nl?.verantwortlich || einrichtung.verantwortlich;
    link = nl?.datenschutzLink || einrichtung.link;
  }
  if (!verantwortlich) gruende.push('Verantwortlicher fehlt (Einstellungen › Datenschutz).');
  const { websiteSauber } = await import('@/lib/newsletter/regeln');
  const website = httpsUrsprung(ce?.website) || nl?.website || websiteSauber(process.env.MAKE_OS_ADRESSE ?? '') || null;
  if (!website) gruende.push('Adresse der Website fehlt (https://…).');
  if (gruende.length || !abs.ok || !nl?.absender || !verantwortlich || !website) return { lage: null, gruende };
  return {
    lage: {
      absender: { person: nl.absender.person, postfach: nl.absender.postfach }, ueber: adresseMaskiert(abs.adresse),
      marke: ce?.marke || nl.marke || firmaOhneRechtsform(UG_NAME), website, verantwortlich, datenschutzLink: link,
    },
    gruende: [],
  };
}

/** Die Lage der Website — oder null (dann: kein Versand; die Unterlagen sind aus). */
export async function websiteLage(): Promise<WebsiteLage | null> {
  return (await websiteLagePruefen()).lage;
}

/** Ein Pfad der Website (`/…`) als volle Adresse über die Website; https bleibt, alles andere fällt weg. Rein. */
export function websiteLink(website: string, pfad: string | undefined): string | null {
  if (!pfad) return null;
  if (/^https:\/\//i.test(pfad)) return pfad;
  return pfad.startsWith('/') && !pfad.startsWith('//') ? `${website}${pfad}` : null;
}

// ── Grenze je Adresse ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Höchstens so viele Mails je Adresse und Berliner Tag über alle Website-Wege (Unterlagen + Bericht) — darüber geht nichts mehr raus. */
export const WEBSITE_MAILS_JE_TAG = 3;
/** Zähler im Arbeitsspeicher (je Fingerabdruck der Adresse, nie die Adresse selbst) — nach einem Neustart beginnt der Tag neu. */
const zaehler = new Map<string, number>();
let zaehlerTag = '';
const fingerabdruck = (email: string) => createHash('sha256').update(`make-os-website-post|${email.trim().toLowerCase()}`).digest('base64url');
function tagFrisch(jetzt: Date) { const t = localDay(jetzt); if (t !== zaehlerTag) { zaehler.clear(); zaehlerTag = t; } }

/** Geht heute noch eine Mail an diese Adresse? */
export function adresseFrei(email: string, jetzt = new Date()): boolean {
  tagFrisch(jetzt);
  return (zaehler.get(fingerabdruck(email)) ?? 0) < WEBSITE_MAILS_JE_TAG;
}
/** Nur für Tests. */
export function _websitePostZuruecksetzen(): void { zaehler.clear(); zaehlerTag = ''; }

// ── Sperren ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Darf an diese Adresse nichts gehen? Eine Person der Kartei (alle Adressen) mit Einschränkung (Art. 18) oder Werbesperre — bzw. ohne Person ein
 * Treffer auf der Sperrliste. Wirft nicht; ist die Kartei nicht lesbar, gilt „gesperrt“ (lieber keine Mail).
 */
export async function adresseGesperrt(email: string): Promise<'eingeschraenkt' | 'werbesperre' | 'sperrliste' | 'unklar' | null> {
  try {
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const e = email.trim().toLowerCase();
    const k = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => alleAdressen(x).includes(e));
    if (k?.eingeschraenkt) return 'eingeschraenkt';
    if (k?.werbesperre) return 'werbesperre';
    if (k) return null;
    const { sperrlisteLaden, sperrTreffer } = await import('@/lib/crm/sperrliste');
    return sperrTreffer(await sperrlisteLaden(), { email: e }) ? 'sperrliste' : null;
  } catch { return 'unklar'; }
}

// ── Senden ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Wofür die Mail ist (nur für Log und Fehlertext) — z. B. `unterlage`, `bericht`, `eingang`. */
export type WebsiteMailArt = string;
export type WebsiteMailGrund = 'aus' | 'adresse' | 'grenze' | 'eingeschraenkt' | 'werbesperre' | 'sperrliste' | 'unklar' | 'fehler';
export type WebsiteMailErgebnis = { ok: true; ueber: string } | { ok: false; grund: WebsiteMailGrund; text: string };

/**
 * EINE Mail über den Website-Absender (siehe Kopf) — allgemein, ohne Wissen über den Weg, der sie auslöst. `betreff`/`text` kommen nur aus einer
 * festen Vorlage des Aufrufers; `an` und `vorname` prüft die Funktion selbst (wie beim Newsletter), ein ungültiger Vorname fällt weg. Reihenfolge:
 * Lage (ohne Absender: `aus`) → Adresse → Grenze je Adresse → Sperren (Art. 18, Werbesperre, Sperrliste; Kartei nicht lesbar: `unklar`) → Senden.
 * Zählt gegen die Grenze, sobald gesendet wird — auch ein gescheiterter Versuch. Wirft nie.
 */
export async function websiteMailSenden(m: { an: string; vorname?: string; betreff: string; text: string; art: WebsiteMailArt; lage?: WebsiteLage | null; /** Abmeldelink-Köpfe (RFC 8058) — Willkommensstrecke (31.10., lib/crm/willkommen.ts). */ listeAbmelden?: { link: string } }, jetzt = new Date()): Promise<WebsiteMailErgebnis> {
  const nein = (grund: WebsiteMailGrund, text: string): WebsiteMailErgebnis => ({ ok: false, grund, text });
  const lage = m.lage === undefined ? await websiteLage().catch(() => null) : m.lage;
  if (!lage) return nein('aus', 'Kein Website-Absender eingerichtet — nichts verschickt.');
  const { emailSauber, vornameSauber } = await import('@/lib/newsletter/regeln');
  const an = emailSauber(m.an);
  if (!an) return nein('adresse', 'Die Adresse lässt sich nicht beschicken.');
  const name = vornameSauber(m.vorname) || '';
  if (!adresseFrei(an, jetzt)) return nein('grenze', 'Heute gingen schon genug Mails an diese Adresse.');
  const sperre = await adresseGesperrt(an);
  if (sperre) return nein(sperre, sperre === 'eingeschraenkt' ? 'Verarbeitung eingeschränkt (Art. 18) — nichts verschickt.' : sperre === 'unklar' ? 'Die Kartei ließ sich nicht prüfen — nichts verschickt.' : 'Werbesperre bzw. Sperrliste — nichts verschickt; bitte am Kontakt klären.');
  const f = fingerabdruck(an);
  zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  let r: { status: number; body: Record<string, unknown> };
  try {
    // `uwgBestaetigt`: die Mail ist die Antwort auf die eigene Anforderung der Person, fester Text — die Rückfrage zu § 7 UWG (für frei
    // geschriebene Mails) gilt hier nicht; gesperrte Personen bekommen sie nie (oben). Art. 18 prüft der Sendeweg trotzdem noch einmal.
    r = await inboxSenden(lage.absender.person, {
      neu: { postfach: lage.absender.postfach, betreff: m.betreff }, an: [{ email: an, ...(name ? { name } : {}) }], text: m.text, uwgBestaetigt: true,
    }, { art: 'system' }, m.listeAbmelden ? { listeAbmelden: m.listeAbmelden } : {});
  } catch (err) { r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.' } }; }
  if (r.status !== 200 || r.body.ok !== true) {
    const text = `Nicht verschickt: ${String(r.body.fehler ?? 'unbekannter Fehler').slice(0, 200)}`;
    console.warn(`[website-post] ${String(m.art).slice(0, 30)}: ${text}`);
    return nein('fehler', text);
  }
  return { ok: true, ueber: adresseMaskiert(String(r.body.von ?? '')) };
}

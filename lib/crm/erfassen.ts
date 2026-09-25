// ─── Markttraktion — Erfassen ohne Reibung (rein, getestet) ─────────────────
// Stand 25.09.: 453 Personen in der Kartei, zwei echte Aktivitäten. Die
// Gespräche finden statt — am Telefon, im Termin, auf LinkedIn —, landen aber
// nicht in MAKE OS. Ohne sie bleiben Kennzahlen, Traction-Score und Heads
// blind. Deshalb muss Festhalten schneller sein als Vergessen:
//   kanalLink            Anrufen/Öffnen per Tipp — nur, was die Ampel erlaubt
//                        (§ 7 UWG, lib/crm/recht.ts). MAKE OS versendet nichts:
//                        tel:, mailto: und das LinkedIn-Profil öffnen nur das
//                        Programm des Nutzers.
//   nachbereitung        „Wie lief's?“ nach Terminen aus dem Geschäftskalender
//                        (lib/crm/signale.ts legt sie als System-Aktivität an).
//   einwilligungUebernehmen  das ausdrückliche Ja im Gespräch als Einwilligung
//                        mit Wortlaut — eine Visitenkarte ist keine Einwilligung.
//   jarvisNotiz / erfassungAnwenden  die Jarvis-Schnellnotiz: Verlauf, Notiz und
//                        nächster Schritt in einem Aufruf, nach denselben Regeln
//                        wie die Power Hour (app/api/crm/aktivitaet/route.ts).

import {
  anzeigename, wendeAktivitaetAn, ERGEBNISSE,
  type Kontakt, type AktivitaetArt, type Ergebnis, type NotizVorlage, type Stufe,
} from '@/lib/make-one/crm';
import type { KanalStatus } from './recht';
import { haeltBeziehung, BEIDE } from './team';
import { tagePlus } from '@/lib/zeit';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

// ── Anrufen / Öffnen per Tipp ───────────────────────────────────────────────

/**
 * Telefonnummer → tel:-Link. Leerzeichen, Klammern, Striche und Schrägstriche
 * raus; die führende 0 bleibt, +49 bleibt. „+49 (0) 30 …“ ist eine deutsche
 * Schreibweise, bei der die (0) NICHT gewählt wird — sie fällt weg. Stehen
 * mehrere Nummern im Feld („030 … , 0171 …“), zählt die erste.
 */
export function telLink(nummer?: string | null): string | null {
  let t = String(nummer ?? '').split(/[,;|]| oder /i)[0].trim();
  if (!t) return null;
  const plus = t.startsWith('+');
  if (plus) t = t.replace(/\(\s*0\s*\)/g, '');
  let ziffern = t.replace(/\D/g, '');
  if (ziffern.length < 3) return null;
  // „+49 0171 …“ — die 0 nach der Ländervorwahl (DACH) wird ebenfalls nicht gewählt.
  if (plus) ziffern = ziffern.replace(/^(49|43|41)0/, '$1');
  return `tel:${plus ? '+' : ''}${ziffern}`;
}

/** Mailadresse → mailto:-Link (nur eine plausible Adresse, nichts anderes). */
export function mailLink(adresse?: string | null): string | null {
  const t = String(adresse ?? '').trim();
  return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(t) ? `mailto:${t}` : null;
}

/**
 * LinkedIn-Profil → https-Link. Nur linkedin.com (und lnkd.in) — ein anderes
 * Ziel hinter dem Chip „LinkedIn“ wäre eine Überraschung, und alles außer
 * http(s) (etwa „javascript:“ aus einem Import) wird nie ein Link.
 */
export function linkedinLink(profil?: string | null): string | null {
  const t = String(profil ?? '').trim();
  if (!t) return null;
  const linkedin = /^([a-z0-9-]+\.)*(linkedin\.com|lnkd\.in)(\/|$)/i;
  if (/^https?:\/\//i.test(t)) return linkedin.test(t.replace(/^https?:\/\//i, '')) ? t : null;
  if (linkedin.test(t)) return `https://${t.replace(/^\/+/, '')}`;
  if (/^[A-Za-z0-9_-]{3,100}$/.test(t)) return `https://www.linkedin.com/in/${t}`;
  return null;
}

/** Der Link hinter einem Kanal-Chip — null, wenn die Ampel rot ist oder die Adresse fehlt. */
export function kanalLink(s: Pick<KanalStatus, 'kanal' | 'farbe'>, ziele: { telefon?: string; email?: string; linkedin?: string }): string | null {
  if (s.farbe === 'rot') return null;
  if (s.kanal === 'telefon') return telLink(ziele.telefon);
  if (s.kanal === 'mail') return mailLink(ziele.email);
  if (s.kanal === 'linkedin' || s.kanal === 'vernetzen') return linkedinLink(ziele.linkedin);
  return null;
}

// ── „Wie lief's?“ nach Terminen ─────────────────────────────────────────────

/** So weit zurück fragt MAKE OS nach — reicht am Montag bis zum Termin am Freitag. */
export const NACHBEREITEN_TAGE = 3;

export interface Nachbereitung {
  kontaktId: string; name: string; firma?: string;
  /** Termintitel aus dem Kalender (ohne „Termin: “). */
  titel: string;
  /** Beginn des Termins (wie im Verlauf) und sein Tag. */
  am: string; tag: string;
  /** Bezugsschlüssel des Termins (termin-…) — die Nachbereitung hängt sich daran. */
  bezug: string;
  /** Wer nachbereitet: wer die Beziehung hält (kevin, malin oder beide). */
  fuer: string;
}

/** Kam a nach b? Über die Uhrzeit, wenn beide lesbar sind — Kalender liefern teils ohne Zeitzone. */
function nach(a: string, b: string): boolean {
  const x = Date.parse(a), y = Date.parse(b);
  return Number.isNaN(x) || Number.isNaN(y) ? a > b : x > y;
}
/** Menschliche Aktivität: nicht vom System, keine Übergabe (die ist Verteilen, kein Kontakt). */
const menschlich = (a: { von: string; art: string }) => a.von !== 'system' && a.art !== 'system' && a.art !== 'uebergabe';

/**
 * Termine der letzten drei Tage (bis heute) aus dem Geschäftskalender, nach
 * denen an dieser Person noch nichts Menschliches festgehalten wurde — je
 * Person höchstens einmal (der jüngste Termin), jüngste zuerst. Mit `person`
 * nur, was bei ihr liegt (hält die Beziehung oder „beide“). Gesperrte
 * Personen tauchen nirgends auf, auch hier nicht.
 */
export function nachbereitung(kontakte: Kontakt[], heute: string, person?: string): Nachbereitung[] {
  const ab = tagePlus(heute, -NACHBEREITEN_TAGE);
  const raus: Nachbereitung[] = [];
  for (const k of kontakte) {
    if (k.werbesperre) continue;
    const fuer = haeltBeziehung(k);
    if (person && fuer !== person && fuer !== BEIDE) continue;
    const l = k.aktivitaeten ?? [];
    const termine = l.filter(a => a.art === 'termin' && a.von === 'system' && a.bezug?.startsWith('termin-') && a.am.slice(0, 10) >= ab && a.am.slice(0, 10) <= heute);
    if (!termine.length) continue;
    const t = termine.reduce((j, x) => (nach(x.am, j.am) ? x : j));
    if (l.some(a => menschlich(a) && (nach(a.am, t.am) || a.bezug === t.bezug))) continue;
    raus.push({
      kontaktId: k.id, name: anzeigename(k), ...(k.firma ? { firma: k.firma } : {}),
      titel: (t.text ?? '').replace(/^Termin:\s*/, '').trim() || 'Termin', am: t.am, tag: t.am.slice(0, 10), bezug: t.bezug!, fuer,
    });
  }
  return raus.sort((a, b) => (nach(a.am, b.am) ? -1 : nach(b.am, a.am) ? 1 : 0));
}

// ── Einwilligung im Gespräch ────────────────────────────────────────────────

/** Die Frage, deren ausdrückliches Ja als Wortlaut festgehalten wird — in der Anrede der Person. */
export const einwilligungVorlage = (anrede?: 'Sie' | 'Du') =>
  anrede === 'Du' ? 'Darf ich dir dazu etwas per Mail schicken? — Ja' : 'Darf ich Ihnen dazu etwas per Mail schicken? — Ja';

/**
 * Das Ja aus dem Gespräch übernehmen: Mail-Einwilligung mit Wortlaut und Tag,
 * Rechtsgrundlage „Einwilligung“ (wie im Recht-Reiter der Kartei). Ohne
 * Wortlaut keine Einwilligung (Nachweispflicht, Art. 7 Abs. 1 DSGVO). Gibt es
 * schon eine gültige Mail-Einwilligung, bleibt alles, wie es ist (null).
 * `von` (kevin/malin) kommt in den Nachweis — wer gefragt hat, gehört dazu.
 */
export function einwilligungUebernehmen(k: Kontakt, wortlaut: string, heute: string, von?: string): Kontakt | null {
  const w = wortlaut.trim();
  if (!w) return null;
  if ((k.einwilligungen ?? []).some(e => e.kanal === 'mail' && e.grundlage === 'einwilligung' && !e.widerrufenAm)) return null;
  const wer = von && von !== 'system' ? ` (${von.charAt(0).toUpperCase()}${von.slice(1)})` : '';
  const nachweis = `Im Gespräch${wer}: ${w}`.slice(0, 400);
  // Die Einwilligung gilt für die Werbung per Mail (§ 7 UWG); eine vorhandene Rechtsgrundlage der Verarbeitung (z. B. Vertrag) bleibt.
  return { ...k, einwilligungen: [...(k.einwilligungen ?? []), { kanal: 'mail', grundlage: 'einwilligung', erteiltAm: heute, nachweis }], ...(k.rechtsgrundlage ? {} : { rechtsgrundlage: 'einwilligung' as const }) };
}

// ── Jarvis-Schnellnotiz ─────────────────────────────────────────────────────

export const JARVIS_ARTEN: readonly AktivitaetArt[] = ['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'gespraech', 'notiz', 'stufe'];

export interface JarvisNotiz {
  art: AktivitaetArt; ergebnis?: Ergebnis; text?: string; notiz?: NotizVorlage;
  naechster?: { text: string; datum: string };
  /** Kein Datum genannt — der nächste Schritt steht in fünf Tagen (wie in der Notizvorlage). */
  datumAngenommen: boolean;
  wiedervorlage?: string;
}

/**
 * „Hab mit Marc telefoniert, will Angebot bis Freitag“ → art anruf, ergebnis
 * gespraech, bedarf „Angebot“, naechster_schritt „Angebot schicken“, faellig
 * = Freitag. Zerlegt die Werkzeug-Eingabe; bei ungültiger Art ein Fehlertext.
 */
export function jarvisNotiz(input: Record<string, unknown>, heute: string): JarvisNotiz | string {
  const art = String(input.art ?? 'notiz') as AktivitaetArt;
  if (!JARVIS_ARTEN.includes(art)) return `Fehlgeschlagen: art muss ${JARVIS_ARTEN.join('|')} sein.`;
  const ergebnis = ERGEBNISSE.includes(input.ergebnis as Ergebnis) ? (input.ergebnis as Ergebnis) : undefined;
  const text = String(input.text ?? '').trim().slice(0, 1200) || undefined;
  const bedarf = String(input.bedarf ?? '').trim().slice(0, 1500);
  const schritt = String(input.naechster_schritt ?? '').trim().slice(0, 300);
  const faellig = TAG.test(String(input.faellig ?? '')) ? String(input.faellig) : undefined;
  const wv = TAG.test(String(input.wiedervorlage ?? '')) ? String(input.wiedervorlage) : undefined;
  return {
    art, ...(ergebnis ? { ergebnis } : {}), ...(text ? { text } : {}), ...(bedarf ? { notiz: { bedarf } } : {}),
    ...(schritt ? { naechster: { text: schritt, datum: faellig ?? tagePlus(heute, 5) } } : {}),
    datumAngenommen: !!schritt && !faellig, ...(wv ? { wiedervorlage: wv } : {}),
  };
}

/** Was die Regel zum Ergebnis sagt (lib/crm/heute.ts folgeAus) — hier nur die Felder, die wirken. */
export interface Folge { stufe?: Stufe; wiedervorlage?: string; werbesperre?: boolean }

/**
 * Eine Erfassung auf den Kontakt anwenden — dieselbe Reihenfolge wie
 * app/api/crm/aktivitaet/route.ts: protokollieren (wendeAktivitaetAn), der
 * genannte nächste Schritt gewinnt, ein erledigter fälliger Schritt fällt nach
 * einem echten Gespräch weg, „Sperre“ sperrt sofort und dauerhaft (Art. 21).
 */
export function erfassungAnwenden(
  alt: Kontakt,
  e: { art: AktivitaetArt; von: string; text?: string; ergebnis?: Ergebnis; notiz?: NotizVorlage; bezug?: string; stufe?: Stufe; wiedervorlage?: string; naechster?: { text: string; datum: string } },
  folge: Folge | null, heute: string, jetztIso: string,
): Kontakt {
  let neu = wendeAktivitaetAn(alt, {
    art: e.art, text: e.text, von: e.von, ergebnis: e.ergebnis, notiz: e.notiz && Object.keys(e.notiz).length ? e.notiz : undefined, bezug: e.bezug,
    stufe: e.stufe ?? folge?.stufe, wiedervorlage: e.wiedervorlage ?? e.naechster?.datum ?? folge?.wiedervorlage,
  }, heute, jetztIso, tagePlus);
  if (e.naechster) neu = { ...neu, naechsterSchritt: e.naechster };
  else if (e.ergebnis && alt.naechsterSchritt && alt.naechsterSchritt.datum <= heute && (e.ergebnis === 'gespraech' || e.ergebnis === 'termin')) neu = { ...neu, naechsterSchritt: undefined };
  if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: e.text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
  return neu;
}

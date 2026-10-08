// ─── ZOE auf WhatsApp — der Kanal je Person: Typen, Texte, reine Regeln (client-sicher, 08.10.2026) ─────────────────────
// Jede Person verbindet IHRE Handynummer selbst: Nummer + Einwilligung in MAKE OS (Konto bzw. Verbindungen), dann schickt sie den
// Code aus MAKE OS von genau dieser Nummer an die ZOE-Nummer — erst dann ist der Kanal „verbunden“ (die Sitzung beweist das Konto,
// die Nachricht beweist die Nummer). „STOP“ oder der Knopf „Trennen“ beendet ihn; der Nachweis der Einwilligung bleibt (nur anhängend).
//
// Bestand `zoe-kanal--<person>` (immer mit Suffix, lib/zoe-whatsapp/speicher.ts) — gehört der Person: Konto-Export und Konto löschen
// (lib/datenschutz/konto-daten.ts PERSON_BESTAENDE). Die Nummer geht nur maskiert an den Browser (`kanalSicht`).
//
// Was über diesen Kanal geht (lib/zoe/an-person.ts `anPersonMelden`): ohne die Ausnahme „Inhalte senden“ nur neutrale Hinweise mit
// Link — dieselbe Regel wie Telegram (lib/datenschutz/telegram-text.ts). Außerhalb des 24-h-Fensters nur die genehmigte Vorlage
// „Briefing bereit“; was sie ankündigt, liegt bereit (`ausstehend`) und kommt, sobald die Person antwortet.
//
// Diese Datei ist rein (kein Server-Import): Oberfläche und Server nutzen DIESELBEN Texte, Regeln und Grenzen.

import { fensterBerechnen, WA_NUMMER } from '@/lib/whatsapp/typen';

// ── Einwilligung und Ausnahme (Wortlaut + Fassung; ändert sich der Wortlaut, ändert sich die Fassung) ──────────────────

export const ZOE_KANAL_FASSUNG = 'zoe-whatsapp-2026-10-08';
export const ZOE_INHALTE_FASSUNG = 'zoe-whatsapp-inhalte-2026-10-08';

export const EINWILLIGUNG_TEXT = {
  titel: 'ZOE darf mich auf WhatsApp erreichen',
  text: 'Ich willige ein, dass MAKE OS mir über die WhatsApp-Business-Nummer von ZOE Hinweise schickt (Briefing am Morgen, Wochenstart, Rückblick, Erinnerungen, Sicherheits-Hinweise) und meine Nachrichten an diese Nummer verarbeitet — Fragen beantwortet ZOE, „Aufgabe: …“ und „Notiz: …“ legt sie als Vorschlag in meine Freigaben. Dafür verarbeitet Meta (WhatsApp Ireland Limited, Auftragsverarbeiter; Verarbeitung auch in Rechenzentren außerhalb der EU möglich, gespeichert höchstens 30 Tage) meine Handynummer und die Nachrichten. Ohne die Ausnahme „Inhalte senden“ kommen nur neutrale Hinweise mit Link. Widerruf jederzeit: „STOP“ an die ZOE-Nummer oder hier „Trennen“.',
} as const;

export const INHALTE_TEXT = {
  titel: 'Ausnahme: Inhalte über WhatsApp senden',
  text: 'Schalte ich das ein, schickt ZOE mir Antworten, Briefings und Erinnerungen im Wortlaut über WhatsApp statt nur eines Hinweises mit Link. Sie können Gesundheits-, Kontakt-, Finanz- und Vertragsangaben enthalten; sie liegen dann bei Meta (höchstens 30 Tage) und auf meinem Handy. Jederzeit wieder ausschaltbar.',
} as const;

// ── Bestand ─────────────────────────────────────────────────────────────────

export type KanalStatus = 'aus' | 'wartet' | 'verbunden' | 'getrennt';
export type KanalEreignisArt = 'einwilligung' | 'bestaetigt' | 'widerruf' | 'inhalte-an' | 'inhalte-aus';

/** Nachweis — nur anhängend, nie verändert (Art. 7 Abs. 1 DSGVO). Ohne Nummer (die steht nur, solange verbunden). */
export interface KanalEreignis {
  zeit: string;
  art: KanalEreignisArt;
  /** Fassung und Fingerabdruck des Wortlauts (Einwilligung bzw. Ausnahme). */
  fassung?: string;
  wortlaut?: string;
  /** Immer die Person selbst (Sitzung bzw. ihre bestätigte Nummer). */
  von: string;
  quelle: 'app' | 'whatsapp';
  /** Folge-Ereignis (die Ausnahme endet mit dem Widerruf). */
  folge?: 'widerruf';
}

/** Eine eingegangene Nachricht, die noch verarbeitet wird (kurzlebig — nach der Verarbeitung weg). */
export interface EingangEintrag {
  wamid: string;
  am: string;
  art: 'text' | 'sprachnachricht' | 'sonstiges';
  text?: string;
  /** `context.id` — die Person hat auf diese Nachricht von ZOE geantwortet. */
  antwortAuf?: string;
  medium?: { mediaId: string; mime: string; sha256?: string; groesse?: number };
  versuche?: number;
  inArbeitSeit?: string;
}

export interface Sprachnachricht {
  id: string;
  am: string;
  mime: string;
  groesse?: number;
  /** Datei in `<daten>/zoe-whatsapp-medien/` (verschlüsselt, lib/store/bild-ablage.ts). */
  datei?: string;
  zustand: 'abgelegt' | 'fehler' | 'zu-gross';
}

/** Ein Vorschlag aus „Aufgabe: …“/„Notiz: …“ — Kennung im Text, damit „ja <Kennung>“ genau ihn freigibt. */
export interface VorschlagVerweis { stapelId: string; am: string; was: 'aufgabe' | 'notiz'; /** WAMID der Nachricht von ZOE, die ihn ankündigte. */ wamid?: string }

export interface ZoeKanal {
  v: 1;
  status: KanalStatus;
  /** wa_id (Ziffern, international ohne +) — nur solange „wartet“ oder „verbunden“. */
  nummer?: string;
  verbundenSeit?: string;
  /** Code zum Bestätigen — nur der Fingerabdruck, 15 Minuten, höchstens CODE_VERSUCHE Fehlversuche. */
  code?: { hash: string; bis: string; versuche: number };
  /** Ausnahme „Inhalte senden“ (nur mit Einwilligung, endet mit dem Widerruf). */
  inhalte?: { seit: string; fassung: string };
  ereignisse: KanalEreignis[];
  /** Letzte Nachricht der Person — daraus das 24-h-Fenster. */
  zuletztEingehend?: string;
  zuletztGesendet?: string;
  /** Letzte Vorlage „Briefing bereit“ (außerhalb des Fensters). */
  letzteVorlage?: string;
  /** Was die Vorlage angekündigt hat — je Art die jüngste Nachricht; geht raus, sobald die Person antwortet. */
  ausstehend?: Record<string, { text: string; am: string }>;
  eingang?: EingangEintrag[];
  /** WAMID → Zeitpunkt (Idempotenz: Meta wiederholt bis zu 36 h); älter als 7 Tage fällt heraus. */
  gesehen?: Record<string, string>;
  vorschlaege?: Record<string, VorschlagVerweis>;
  sprachnachrichten?: Sprachnachricht[];
}

export const leererKanal = (): ZoeKanal => ({ v: 1, status: 'aus', ereignisse: [] });

export const KANAL_GRENZEN = {
  /** Code gilt so lange (Minuten). */
  codeMinuten: 15,
  codeVersuche: 5,
  /** Unverarbeitete Nachrichten je Person — darüber wird nichts Neues angenommen (gezählt, nie still). */
  eingang: 50,
  /** Idempotenz-Fenster (Meta wiederholt bis zu 36 h). */
  gesehenTage: 7,
  /** Sprachnachrichten werden so lange aufbewahrt (Tage), dann gelöscht. */
  sprachTage: 30,
  /** Offene Vorschläge über WhatsApp verfallen (nur der Verweis — der Vorschlag selbst bleibt in den Freigaben). */
  vorschlagTage: 30,
  aufgabeTitel: 300,
  notizText: 4000,
  /** Text an Meta je Nachricht (Annahme wie lib/whatsapp/typen.ts: 4096). */
  text: 4096,
  /** Höchstens eine Vorlage „Briefing bereit“ je so viele Stunden, solange die Person nicht geantwortet hat (Kosten, Ruhe). */
  vorlageStunden: 20,
  versuche: 3,
} as const;

/** Zeichen für Codes und Kennungen — ohne 0/O, 1/I (wie Telegram). */
export const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ── Nummer ──────────────────────────────────────────────────────────────────

/**
 * Handynummer aus der Eingabe → wa_id (Ziffern ohne +). „+49 170 …“, „0049 …“, „0170 …“ (Inland = `vorwahl`). null bei Unsinn. Rein.
 * Die Vorwahl ist ein Parameter (Plattform-Regel: nichts fest) — Vorgabe Deutschland.
 */
export function nummerAus(eingabe: unknown, vorwahl = '49'): string | null {
  if (typeof eingabe !== 'string') return null;
  const roh = eingabe.normalize('NFC').replace(/\(0\)/g, '').trim();
  if (!roh || roh.length > 40 || /[^0-9+\s()./-]/.test(roh)) return null;
  const plus = roh.startsWith('+');
  let z = roh.replace(/[^0-9]/g, '');
  if (plus) { /* schon international */ } else if (z.startsWith('00')) z = z.slice(2);
  else if (z.startsWith('0')) z = `${vorwahl}${z.slice(1)}`;
  else return null; // ohne +, 00 oder 0 ist die Nummer nicht eindeutig
  return WA_NUMMER.test(z) && z.length >= 8 ? z : null;
}

/** Nummer nur maskiert (Browser, Status): „+49 ••• 678“. Rein. */
export const nummerMaskiert = (n: string | undefined): string | undefined => (n && WA_NUMMER.test(n) ? `+${n.slice(0, 2)} ••• ${n.slice(-3)}` : undefined);

// ── Was eine eingehende Nachricht bedeutet (rein) ──────────────────────────

export type Deutung =
  | { art: 'stop' }
  | { art: 'ja' | 'nein'; kennung?: string }
  | { art: 'aufgabe' | 'notiz'; text: string }
  | { art: 'quittung' }
  | { art: 'frage'; text: string };

const KENNUNG = new RegExp(`\\b([${CODE_ZEICHEN}]{4})\\b`, 'i');

/** Code aus einer Nachricht („ZOE 7K4P2Q“ oder „7K4P2Q“) — nur, solange die Person „wartet“. Rein. */
export function codeAus(text: string | undefined): string | null {
  const m = new RegExp(`^\\s*(?:zoe[\\s:–-]*)?([${CODE_ZEICHEN}]{6})\\s*[.!]?\\s*$`, 'i').exec(text ?? '');
  return m ? m[1].toUpperCase() : null;
}

/** Was die verbundene Person meint (rein, getestet). */
export function deuten(roh: string | undefined): Deutung {
  const text = (roh ?? '').replace(/\r\n?/g, '\n').trim();
  if (/^(stop|stopp|abmelden|abbestellen|unsubscribe)\s*[.!]?$/i.test(text)) return { art: 'stop' };
  const jn = /^(ja|freigeben|nein|ablehnen)\b([\s\S]*)$/i.exec(text);
  if (jn && jn[2].trim().length <= 30) {
    const k = KENNUNG.exec(jn[2]);
    return { art: /^(ja|freigeben)$/i.test(jn[1]) ? 'ja' : 'nein', ...(k ? { kennung: k[1].toUpperCase() } : {}) };
  }
  const a = /^(aufgabe|notiz)\s*[:–-]\s*([\s\S]+)$/i.exec(text);
  if (a && a[2].trim()) return { art: a[1].toLowerCase() === 'aufgabe' ? 'aufgabe' : 'notiz', text: a[2].trim() };
  if (/^(zeig|zeigen|zeig mal|ok|okay|hallo|hi|hey|da|los|mehr|danke|👍)\s*[.!]*$/i.test(text) || !text) return { art: 'quittung' };
  return { art: 'frage', text };
}

/** Titel einer Notiz aus ihrem Text (rein): erste Zeile, höchstens 80 Zeichen an einer Wortgrenze — der volle Text bleibt der Inhalt. */
export function notizTitel(text: string): string {
  const z = text.split('\n')[0].trim();
  if (z.length <= 80) return z || 'Notiz';
  const cut = z.slice(0, 80);
  const i = cut.lastIndexOf(' ');
  return `${(i > 40 ? cut.slice(0, i) : cut).trim()} …`;
}

// ── Texte an die Person — neutral, ohne Namen, ohne Werte (Plattform-Regel; Wächter in tests/zoe-whatsapp-*.test.ts) ──

export const KANAL_TEXTE = {
  verbunden: 'Verbunden. Ab jetzt erreicht dich ZOE hier mit kurzen Hinweisen — die Inhalte bleiben in MAKE OS. „STOP“ beendet das jederzeit.',
  stop: 'Abgemeldet. ZOE schreibt dir hier nicht mehr. Wieder verbinden: in MAKE OS unter Konto › ZOE auf WhatsApp.',
  codeFalsch: 'Dieser Code passt nicht. Bitte den Code aus MAKE OS (Konto › ZOE auf WhatsApp) genau so schicken.',
  codeAbgelaufen: 'Der Code ist abgelaufen. Bitte in MAKE OS einen neuen holen.',
  erstCode: 'Bitte zuerst den Code aus MAKE OS schicken (Konto › ZOE auf WhatsApp).',
  nurText: 'Hier nehme ich nur Text und Sprachnachrichten an.',
  hilfe: 'Frag mich etwas — oder schreib „Aufgabe: …“ bzw. „Notiz: …“, dann lege ich es dir als Vorschlag in die Freigaben.',
  nichtErreichbar: 'ZOE ist gerade nicht erreichbar. Versuch es gleich noch einmal.',
  ausstehendKopf: 'Seit deiner letzten Nachricht:',
  test: 'Test: ZOE erreicht dich auf diesem Weg.',
  zuLang: (n: number) => `Das ist zu lang (höchstens ${n} Zeichen) — bitte kürzer schicken. Nichts angelegt.`,
  sprachnachricht: (link: string) => `Sprachnachricht erhalten — bitte als Text schicken oder in MAKE OS anhören: ${link}`,
  antwortInApp: (link: string) => `Antwort liegt in MAKE OS — ${link}`,
  vorschlag: (k: string, was: 'aufgabe' | 'notiz', link: string, titel?: string) =>
    `Vorschlag ${k} liegt in deinen Freigaben: ${was === 'aufgabe' ? 'eine Aufgabe' : 'eine Notiz'}${titel ? ` „${titel}“` : ''}. Antworte „ja ${k}“ zum Freigeben oder „nein ${k}“ — oder in MAKE OS: ${link}`,
  freigegeben: (k: string, link: string, ergebnis?: string) => (ergebnis ? `Freigegeben (${k}): ${ergebnis}` : `Freigegeben (${k}). Ergebnis in MAKE OS: ${link}`),
  fehlgeschlagen: (k: string, link: string) => `Vorschlag ${k} ließ sich nicht übernehmen — bitte in MAKE OS ansehen: ${link}`,
  abgelehnt: (k: string) => `Vorschlag ${k} abgelehnt.`,
  schonEntschieden: (k: string) => `Vorschlag ${k} ist schon entschieden.`,
  welcher: (offen: readonly string[]) => (offen.length ? `Welcher Vorschlag? Antworte „ja <Kennung>“ — offen: ${offen.join(', ')}.` : 'Gerade liegt kein Vorschlag von hier offen.'),
} as const;

// ── Sicht für den Browser (rein): nie die volle Nummer, nie der Code, nie Texte ──────────────────────────────────────

export interface ZoeKanalSicht {
  status: KanalStatus;
  nummer?: string;
  verbundenSeit?: string;
  /** Solange „wartet“: bis wann der Code gilt (der Code selbst nur in der Antwort auf „Verbinden“). */
  wartetBis?: string;
  inhalte: { an: boolean; seit?: string };
  fenster: { offen: boolean; bis: string | null };
  sprachnachrichten: { id: string; am: string; zustand: Sprachnachricht['zustand']; mime: string; groesse?: number }[];
  offeneVorschlaege: number;
  ereignisse: { zeit: string; art: KanalEreignisArt; quelle: KanalEreignis['quelle'] }[];
}

export function kanalSicht(k: ZoeKanal, jetzt: number = Date.now()): ZoeKanalSicht {
  const f = fensterBerechnen(k.status === 'verbunden' ? k.zuletztEingehend : undefined, jetzt);
  const wartet = k.status === 'wartet' && k.code && Date.parse(k.code.bis) > jetzt;
  return {
    status: k.status === 'wartet' && !wartet ? 'aus' : k.status,
    ...(k.status === 'verbunden' || wartet ? { nummer: nummerMaskiert(k.nummer) } : {}),
    ...(k.status === 'verbunden' && k.verbundenSeit ? { verbundenSeit: k.verbundenSeit } : {}),
    ...(wartet ? { wartetBis: k.code!.bis } : {}),
    inhalte: k.inhalte?.seit ? { an: true, seit: k.inhalte.seit } : { an: false },
    fenster: { offen: f.offen, bis: f.bis },
    sprachnachrichten: (k.sprachnachrichten ?? []).map(s => ({ id: s.id, am: s.am, zustand: s.zustand, mime: s.mime, ...(s.groesse ? { groesse: s.groesse } : {}) })).sort((a, b) => b.am.localeCompare(a.am)),
    offeneVorschlaege: Object.keys(k.vorschlaege ?? {}).length,
    ereignisse: k.ereignisse.map(e => ({ zeit: e.zeit, art: e.art, quelle: e.quelle })),
  };
}

/** Was GET /api/zoe/whatsapp liefert (nie Schlüssel, nie Geheimnisse, nie die volle eigene Nummer). */
export interface ZoeWhatsappStatus {
  ok: true;
  eingerichtet: boolean;
  /** ZOE-Nummer = Business-Nummer → aus (der Head of IT zeigt es rot). */
  konflikt: boolean;
  /** Fehlende Umgebungsvariablen (nur Namen) — nur für den Inhaber. */
  fehlend: string[];
  webhookAdresse: string | null;
  /** Die ZOE-Nummer zum Anschreiben (öffentlich bei Meta) und der Link „wa.me“. */
  zoeNummer?: string;
  vorlage?: { name: string; sprache: string; status: string };
  /** `ok` · `token` (Schlüssel abgelehnt) · `ungeprueft`. */
  verbindung: 'ok' | 'token' | 'ungeprueft';
  /** Aus MAKE OS registriert (Zeitpunkt, Speicherort) — nur für den Inhaber. */
  registriert?: { am: string; speicherort: 'DE' | 'ohne' };
  inhaber: boolean;
  kanal: ZoeKanalSicht;
  fassung: { einwilligung: string; inhalte: string };
}

/** Link zum Anschreiben der ZOE-Nummer mit dem Code als Text (offizielles Format wa.me — Annahme: Meta nennt ihn „Click to Chat“). Rein. */
export function waMeLink(zoeNummer: string | undefined, code: string): string | null {
  const z = (zoeNummer ?? '').replace(/[^0-9]/g, '');
  return WA_NUMMER.test(z) ? `https://wa.me/${z}?text=${encodeURIComponent(`ZOE ${code}`)}` : null;
}

// ─── Kampagnen-Motor — Mail-Stapel, Druckliste, Drossel, Rückfluss (rein, client-sicher, 31.10., Welle A · KUNDENGEWINNUNG_PLAN.md › S3) ──────
// Der Motor (lib/crm/kampagnen-motor.ts) legt je fälligem Mail-Schritt EINEN Entwurf je Ziel an (Vorlage + Platzhalter), je Brief-Schritt eine Zeile
// der Druckliste. Hier: die Form der Einträge, Kennungen, das Füllen der Vorlagen (unbekannter Platzhalter bzw. fehlender Wert = Fehler, nie ein
// Text mit Lücke), die Pflicht-Fußzeile jeder Kampagnen-Mail (Absender/Impressum, Art.-14-Hinweis, Abmeldelink), die Drossel (Zeitfenster werktags
// 8–18 Uhr Berlin, Tagesgrenze je Postfach — Kevin 31.10.: 30, einstellbar bis 50) und das Erkennen von Antwort und Rückläufer.
// Kein Öffnungs-Tracking — es gibt nichts, was ein Öffnen messen könnte.

import type { KampagnenZiel, SequenzKanal, SequenzSchritt } from './typen';
import { platzhalterPruefen, platzhalterFuellen, grussZeile, KAMPAGNE_BEIM_VERSAND, PRODUKT_TEXT_GRENZEN } from './vorlage-platzhalter';
import { istWerktag } from '@/lib/zeit/kalender-kern';
import { localDay } from '@/lib/zeit';

export type PostStatus = 'entwurf' | 'freigegeben' | 'sendet' | 'gesendet' | 'fehler' | 'gesperrt' | 'verworfen' | 'unklar' | 'bounce' | 'gedruckt';
export interface PostEintrag {
  /** `km-<fnv(kampagne|ziel|schritt)>` — je Ziel und Schritt genau einer (idempotent). */
  id: string;
  kampagneId: string;
  ziel: KampagnenZiel;
  schrittId: string;
  kanal: Extract<SequenzKanal, 'mail' | 'brief'>;
  /** Empfänger (Mail) — Name nur zur Anzeige. Bei Briefen: Name + Ort (Druckliste). */
  an: { email?: string; name: string; ort?: string };
  betreff: string;
  text: string;
  status: PostStatus;
  /** Warum nicht sendbar bzw. was beim Senden schiefging (ohne Adresse). */
  fehler?: string;
  /** Ampel rot, aber Playbook auf „eigenes Risiko“ — nur mit eingeschaltetem Schalter freigebbar. */
  risiko?: true;
  /** Von Hand oder mit ZOE überarbeitet. */
  bearbeitet?: { von: string; am: string; zoe?: true };
  freigabe?: { von: string; am: string; postfach: string; eigenesRisiko?: { seit: string; von: string } };
  /** Zeitpunkt, an dem der Versand begann (Neustart-Schutz: hängt er, wird er „unklar“, nie zweimal gesendet). */
  sendetSeit?: string;
  gesendet?: { am: string; id?: string; threadId?: string; messageId?: string };
  rueckfluss?: { art: 'antwort' | 'bounce' | 'abmeldung'; am: string };
  gedruckt?: { von: string; am: string };
  angelegt: string;
  geaendert: string;
}

export interface WillkommenStufe { tag: number; betreff: string; text: string }
export interface MotorEinstellungen {
  /** Mails je Tag und Postfach (Kevin 31.10.: 30, höchstens 50). */
  tagesgrenze: number;
  /** Absender-/Impressumszeile unter jeder Kampagnen-Mail (Instanz-Daten — nie fest im Code). Ohne sie: kein Versand. */
  fusszeile?: string;
  /** Art.-14-Hinweis, wenn das Ziel `fremddaten` trägt — leer = die neutrale Vorgabe `ART14_VORGABE`. */
  art14Text?: string;
  /** Willkommensstrecke nach Einwilligung (K2) — Vorgabe AUS; Inhaber schaltet ein, `seit` begrenzt auf Einwilligungen ab dann. */
  willkommen?: { an: true; seit: string; von: string };
  willkommenStufen?: WillkommenStufe[];
}

export const TAGESGRENZE_VORGABE = 30;
export const TAGESGRENZE_MAX = 50;
/** Je Lauf und Postfach höchstens so viele — die Mails verteilen sich über den Tag. */
export const JE_LAUF_MAX = 5;
/** Versand nur werktags von 8 bis 18 Uhr (Berlin). */
export const ZEITFENSTER = { von: 8, bis: 18 } as const;
/** Ein Versand, der länger „sendet“, gilt als unklar (nie automatisch noch einmal). */
export const SENDET_HAENGT_MS = 15 * 60_000;
export const POST_GRENZEN = { eintraege: 20_000, fusszeile: 600, art14: 1500, stufen: 6 } as const;

/** Neutrale Vorgabe des Art.-14-Hinweises (keine Namen, keine Firma — die stehen in der Fußzeile der Instanz). */
export const ART14_VORGABE = 'Datenschutz-Hinweis (Art. 14 DSGVO): Ihre geschäftlichen Kontaktdaten stammen aus öffentlich zugänglichen Quellen. Wir nutzen sie nur, um Ihnen dieses Angebot zu machen (Art. 6 Abs. 1 lit. f DSGVO). Sie können jederzeit widersprechen — ein Klick auf den Abmeldelink genügt, dann löschen wir Ihre Daten bzw. sperren sie für Werbung.';
/** Neutrale Vorgabe der Willkommensstrecke (Tag 3 und Tag 10) — die Instanz ersetzt sie in den Einstellungen. */
export const WILLKOMMEN_VORGABE: readonly WillkommenStufe[] = [
  { tag: 3, betreff: 'Danke für Ihr Interesse', text: '{{anrede}},\n\nschön, dass Sie dabei sind. In den nächsten Tagen schicken wir Ihnen ab und zu etwas, das Ihnen in der Praxis hilft — kurz und ohne Werbeflut.\n\nViele Grüße\n{{absender}}' },
  { tag: 10, betreff: 'Eine Frage an Sie', text: '{{anrede}},\n\nwelches Thema beschäftigt Sie gerade am meisten? Eine kurze Antwort auf diese Mail genügt — wir melden uns persönlich.\n\nViele Grüße\n{{absender}}' },
];

/** FNV-1a 32 Bit als Hex (rein, Browser und Server). */
export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const schl = (kampagneId: string, z: KampagnenZiel, schrittId: string) => `${kampagneId}|${z.art}:${z.id}|${schrittId}`;
export const postEintragId = (kampagneId: string, z: KampagnenZiel, schrittId: string): string => `km-${fnv(schl(kampagneId, z, schrittId))}${fnv(`x${schl(kampagneId, z, schrittId)}`)}`;
/** Follow-up eines Sequenz-Schritts (Anruf, LinkedIn, Besuch) — echtes Follow-up in `crm.followups`, idempotent über die Kennung. */
export const sequenzFollowupId = (kampagneId: string, z: KampagnenZiel, schrittId: string): string => `fu-ks-${fnv(schl(kampagneId, z, schrittId))}${fnv(`y${schl(kampagneId, z, schrittId)}`)}`;
/** Follow-up „Antwort bearbeiten“ nach einer Antwort auf einen Eintrag. */
export const antwortFollowupId = (postId: string): string => `fu-kr-${postId.slice(3)}`;
/** Follow-up „Adresse prüfen“ nach einem Rückläufer. */
export const bounceFollowupId = (postId: string): string => `fu-kb-${postId.slice(3)}`;

/** Werte der Platzhalter eines Ziels (was es nicht gibt, fehlt im Objekt — dann ist ein Text, der es nutzt, ein Fehler). */
export interface ZielWerte { anrede?: 'Sie' | 'Du'; vorname?: string; nachname?: string; betrieb?: string; bezirk?: string; befund?: string; absender?: string; heute: string }
export function platzhalterWerte(w: ZielWerte): Record<string, string | undefined> {
  const v = (x?: string) => (x && x.trim() ? x.trim() : undefined);
  return {
    // Ohne Person „Guten Tag“ (Betrieb) — die Grußzeile gibt es immer.
    anrede: grussZeile(w.anrede, w.vorname, w.nachname),
    vorname: v(w.vorname), nachname: v(w.nachname), betrieb: v(w.betrieb), bezirk: v(w.bezirk), befund: v(w.befund), absender: v(w.absender), heute: w.heute,
  };
}

const MUSTER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]{0,59})\s*(?:\|\s*([a-z-]{1,20})\s*)?\}\}/g;

/**
 * Entwurf aus der Vorlage eines Schritts: unbekannte Platzhalter (Prüfung wie bei den Produkt-Texten) oder ein benutzter Platzhalter ohne Wert →
 * `{ fehler }` (der Eintrag ist dann nicht freigebbar). {{vorschauLink}}/{{abmeldeLink}} bleiben für den Versand stehen.
 */
export function entwurfFuellen(s: Pick<SequenzSchritt, 'betreff' | 'text'>, werte: Record<string, string | undefined>): { betreff: string; text: string; fehler?: string } {
  const betreffRoh = (s.betreff ?? '').trim(), textRoh = (s.text ?? '').trim();
  const fehler = [...platzhalterPruefen(betreffRoh, 'kampagne', 'Betreff'), ...platzhalterPruefen(textRoh, 'kampagne', 'Text')];
  const spaeter = new Set<string>(KAMPAGNE_BEIM_VERSAND);
  const fehlt = new Set<string>();
  for (const t of [betreffRoh, textRoh]) for (const m of t.matchAll(MUSTER)) if (!spaeter.has(m[1]) && m[1] in werte && !werte[m[1]]) fehlt.add(m[1]);
  if (spaeter.has('vorschauLink') && /\{\{\s*vorschauLink/.test(betreffRoh)) fehler.push('Betreff: {{vorschauLink}} gehört in den Text.');
  if (fehlt.size) fehler.push(`Für dieses Ziel fehlt ein Wert: ${Array.from(fehlt).map(f => `{{${f}}}`).join(', ')} — Vorlage anpassen oder Angabe ergänzen.`);
  const gefuellt = (t: string) => platzhalterFuellen(t, Object.fromEntries(Object.entries(werte).filter(([, x]) => x !== undefined)) as Record<string, string>);
  return { betreff: gefuellt(betreffRoh).replace(/\s+/g, ' ').slice(0, PRODUKT_TEXT_GRENZEN.betreff), text: gefuellt(textRoh), ...(fehler.length ? { fehler: Array.from(new Set(fehler)).join(' ') } : {}) };
}

/** Steht nach dem Versand noch ein Platzhalter im Text? (dann wird nicht gesendet) */
export const restPlatzhalter = (t: string): string[] => Array.from(t.matchAll(MUSTER)).map(m => m[1]);

/**
 * Die fertige Mail für den Versand: Links einsetzen, dann die Pflicht-Fußzeile (Absender/Impressum, Art.-14-Hinweis bei Fremddaten, Abmeldelink —
 * steht {{abmeldeLink}} schon im Text, kommt er dort hin und unten nur der Satz ohne Link). Rein.
 */
export function mailFertig(text: string, o: { abmeldeLink: string; vorschauLink?: string | null; fusszeile: string; art14?: string | null }): { text: string; fehler?: string } {
  let t = text;
  if (/\{\{\s*vorschauLink\s*\}\}/.test(t)) {
    if (!o.vorschauLink) return { text: t, fehler: 'Der Vorschau-Link ließ sich nicht erzeugen (keine Vorschau für dieses Ziel bzw. Adresse der Instanz fehlt) — nicht gesendet.' };
    t = t.replace(/\{\{\s*vorschauLink\s*\}\}/g, o.vorschauLink);
  }
  const imText = /\{\{\s*abmeldeLink\s*\}\}/.test(t);
  t = t.replace(/\{\{\s*abmeldeLink\s*\}\}/g, o.abmeldeLink);
  const rest = restPlatzhalter(t);
  if (rest.length) return { text: t, fehler: `Im Text steht noch ein Platzhalter (${rest.map(x => `{{${x}}}`).join(', ')}) — nicht gesendet.` };
  const fuss = [
    '—',
    o.fusszeile.trim(),
    ...(o.art14 ? [o.art14.trim()] : []),
    imText ? 'Keine weiteren Nachrichten von uns? Der Abmeldelink steht oben.' : `Keine weiteren Nachrichten von uns? Hier abmelden: ${o.abmeldeLink}`,
  ];
  return { text: `${t.replace(/\s+$/, '')}\n\n${fuss.join('\n')}` };
}

const STUNDE = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' });
/** Berliner Stunde (0–23). */
export const berlinStunde = (jetzt: Date): number => Number(STUNDE.formatToParts(jetzt).find(t => t.type === 'hour')?.value ?? NaN);
/** Liegt der Zeitpunkt im Versandfenster? Werktags (Mo–Fr ohne Feiertage NRW) 8–18 Uhr Berlin. */
export function imZeitfenster(jetzt: Date): boolean {
  const h = berlinStunde(jetzt);
  return istWerktag(localDay(jetzt)) && h >= ZEITFENSTER.von && h < ZEITFENSTER.bis;
}
/** Zähler-Schlüssel der Tagesgrenze: Tag (Berlin) · sendende Person · Postfach. */
export const zaehlerSchluessel = (tag: string, person: string, postfach: string): string => `${tag}|${person}|${postfach}`;

/** Einstellungen säubern (Form, Grenzen) — Unbekanntes fällt weg. */
export function einstellungenSaeubern(v: unknown): MotorEinstellungen {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : {};
  const g = Number(o.tagesgrenze);
  const zeilen = (x: unknown, n: number) => (typeof x === 'string' && x.trim() ? x.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n) : undefined);
  const w = o.willkommen as Record<string, unknown> | undefined;
  const stufen = Array.isArray(o.willkommenStufen) ? (o.willkommenStufen as Record<string, unknown>[]).slice(0, POST_GRENZEN.stufen).map(x => ({ tag: Number(x?.tag), betreff: zeilen(x?.betreff, PRODUKT_TEXT_GRENZEN.betreff)?.replace(/\s+/g, ' ') ?? '', text: zeilen(x?.text, PRODUKT_TEXT_GRENZEN.text) ?? '' }))
    .filter(x => Number.isInteger(x.tag) && x.tag >= 0 && x.tag <= 90 && x.betreff && x.text) : undefined;
  const fusszeile = zeilen(o.fusszeile, POST_GRENZEN.fusszeile), art14Text = zeilen(o.art14Text, POST_GRENZEN.art14);
  return {
    tagesgrenze: Number.isInteger(g) && g >= 1 && g <= TAGESGRENZE_MAX ? g : TAGESGRENZE_VORGABE,
    ...(fusszeile ? { fusszeile } : {}), ...(art14Text ? { art14Text } : {}),
    ...(w && w.an === true && typeof w.seit === 'string' && typeof w.von === 'string' ? { willkommen: { an: true as const, seit: w.seit.slice(0, 40), von: w.von.slice(0, 60) } } : {}),
    ...(stufen?.length ? { willkommenStufen: stufen } : {}),
  };
}
/** Einstellungen prüfen (vor dem Speichern): Grenzen 413, Platzhalter der Willkommens-Stufen 400. */
export function einstellungenPruefen(v: Record<string, unknown>): { status: 400 | 413; text: string }[] {
  const f: { status: 400 | 413; text: string }[] = [];
  if (v.tagesgrenze !== undefined) { const g = Number(v.tagesgrenze); if (!Number.isInteger(g) || g < 1 || g > TAGESGRENZE_MAX) f.push({ status: 400, text: `Mails je Tag und Postfach: 1 bis ${TAGESGRENZE_MAX}.` }); }
  if (typeof v.fusszeile === 'string' && v.fusszeile.trim().length > POST_GRENZEN.fusszeile) f.push({ status: 413, text: `Die Fußzeile ist zu lang (höchstens ${POST_GRENZEN.fusszeile} Zeichen).` });
  if (typeof v.art14Text === 'string' && v.art14Text.trim().length > POST_GRENZEN.art14) f.push({ status: 413, text: `Der Art.-14-Hinweis ist zu lang (höchstens ${POST_GRENZEN.art14} Zeichen).` });
  if (Array.isArray(v.willkommenStufen)) {
    if (v.willkommenStufen.length > POST_GRENZEN.stufen) f.push({ status: 413, text: `Höchstens ${POST_GRENZEN.stufen} Willkommens-Mails.` });
    (v.willkommenStufen as Record<string, unknown>[]).forEach((s, i) => {
      for (const k of ['betreff', 'text'] as const) {
        const w = s?.[k];
        if (typeof w !== 'string' || !w.trim()) { f.push({ status: 400, text: `Willkommens-Mail ${i + 1}: ${k === 'betreff' ? 'Betreff' : 'Text'} fehlt.` }); continue; }
        f.push(...platzhalterPruefen(w, 'kampagne', `Willkommens-Mail ${i + 1}`).map(text => ({ status: 400 as const, text })));
        if (/\{\{\s*(vorschauLink|befund|bezirk|betrieb)\s*\}\}/.test(w)) f.push({ status: 400, text: `Willkommens-Mail ${i + 1}: nur {{anrede}}, {{vorname}}, {{nachname}}, {{absender}}, {{heute}} und {{abmeldeLink}} — Kampagnen-Werte gibt es hier nicht.` });
      }
    });
  }
  return f;
}

// ── Rückfluss: Antwort und Rückläufer erkennen ──────────────────────────────────────────────────────────────────────────────────────

/** Ein Kopf aus dem Gmail- bzw. IMAP-Spiegel (die Felder, die der Rückfluss braucht). */
export interface RueckKopf {
  id: string; threadId: string; am: string; von: { email: string }; antwortAn?: { email: string }; betreff: string; ausschnitt: string;
  messageId?: string; inReplyTo?: string; references?: string[]; labels: string[]; liste?: boolean; automatisch?: boolean; ordner?: string;
}
const DAEMON = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const BOUNCE_BETREFF = /(undeliver|unzustellbar|delivery (status|failure|has failed)|nicht zugestellt|returned mail|mail delivery (failed|subsystem)|failure notice|zustellung fehlgeschlagen|unbekannt.*empf)/i;
const ABWESEND = /(abwesen|out of office|automatic reply|automatische antwort|auto-reply|autoreply|urlaub)/i;

/**
 * Was ist dieser Kopf für einen gesendeten Eintrag? `bounce` (Rückläufer: Absender mailer-daemon/postmaster oder automatischer Zustellbericht, der
 * auf unsere Mail zeigt — gleicher Thread, References/In-Reply-To oder die Empfänger-Adresse im Ausschnitt), `antwort` (der Empfänger schreibt nach
 * dem Versand — gleicher Thread, Bezug auf unsere Message-ID oder dieselbe Adresse), sonst null (auch Abwesenheitsnotizen und Rundschreiben). Rein.
 */
export function rueckflussArt(e: Pick<PostEintrag, 'an' | 'gesendet'>, k: RueckKopf, eigene: readonly string[]): 'antwort' | 'bounce' | null {
  if (!e.gesendet || !e.an.email) return null;
  if (k.am <= e.gesendet.am) return null;
  if (k.labels.includes('SENT') || k.ordner === 'g' || eigene.includes(k.von.email.toLowerCase())) return null;
  const an = e.an.email.toLowerCase();
  const mid = e.gesendet.messageId;
  const bezug = (!!e.gesendet.threadId && k.threadId === e.gesendet.threadId) || (!!mid && (k.inReplyTo === mid || (k.references ?? []).includes(mid)));
  const daemon = DAEMON.test(k.von.email) || (!!k.automatisch && BOUNCE_BETREFF.test(k.betreff)) || (DAEMON.test(k.von.email) && BOUNCE_BETREFF.test(k.betreff));
  if (daemon && (bezug || k.ausschnitt.toLowerCase().includes(an))) return 'bounce';
  if (daemon) return null;
  if (k.liste || k.automatisch || ABWESEND.test(k.betreff)) return null;
  const vonIhm = k.von.email.toLowerCase() === an || k.antwortAn?.email.toLowerCase() === an;
  return vonIhm || bezug ? 'antwort' : null;
}

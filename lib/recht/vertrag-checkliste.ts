// ─── Head of Recht: Vertrag → Checkliste mit Fundstellen — Regelwerk, KEINE Bewertung (rein, client-sicher, 10.10.) ───────────────────
// Kevin 10.10.: „Neuer Vertrag → Checkliste: Text auslesen, Checkliste Laufzeit · Kündigung · Haftung · Datenschutz/AVV · Gerichtsstand · IP — als
// Fundstellen mit Zitat, keine Bewertung; Fristen als Vorschlag in Kalender/Vertragsfristen.“ (research › 6 A6/A8, Grenze 6a: Checkliste ja,
// „rechtliche Bewertung“ nein). Die Regeln suchen nur nach Wörtern, die an diesen Stellen üblich sind, und zeigen die Sätze wörtlich — ob eine
// Klausel passt, sagt die Kanzlei. „Keine Stelle gefunden“ heißt nur: hier selbst nachsehen. Der Text ist Text DRITTER — gelesen wird er nur hier
// (Regelwerk, ohne Modell) bzw. gekapselt über `fremd()` im Werkzeug des Heads (lib/agenten/recht-werkzeuge.ts). Lineare Muster (keine
// verschachtelten Wiederholungen) — sicher auch bei großen Dokumenten.

import { istTag } from '@/lib/gesellschaften/schild/zeit';
import type { Checkliste, ChecklistePunkt, ChecklistePunktId, ErkannteFrist, Fundstelle } from './typen';

/** Höchstens so viel Text wird durchsucht (große Anlagen-Konvolute) — darüber steht ein Hinweis, nie still. */
export const CHECKLISTE_MAX_ZEICHEN = 400_000;
const ZITAT_MAX = 260;
const FUNDE_JE_PUNKT = 3;
const FRISTEN_MAX = 5;

interface PunktDef { id: ChecklistePunktId; titel: string; frage: string; muster: readonly RegExp[] }
/** Die sechs Punkte (Entscheidung 10.10.) — Kennungen nie ändern. Wörter, die an diesen Stellen üblich sind (Annahme). */
export const CHECKLISTE_PUNKTE: readonly PunktDef[] = [
  { id: 'laufzeit', titel: 'Laufzeit & Verlängerung', frage: 'Wie lange läuft der Vertrag, ab wann, und verlängert er sich von selbst?',
    muster: [/laufzeit/i, /vertragsdauer/i, /in kraft/i, /inkrafttreten/i, /verlänger/i, /mindestlaufzeit/i, /befristet/i, /\bendet\b/i] },
  { id: 'kuendigung', titel: 'Kündigung', frage: 'Wer kann wie, in welcher Form und mit welcher Frist kündigen — auch aus wichtigem Grund?',
    muster: [/kündig/i, /kuendig/i] },
  { id: 'haftung', titel: 'Haftung, Gewährleistung, Vertragsstrafe', frage: 'Ist die Haftung begrenzt, gibt es Freistellungen, Vertragsstrafen oder besondere Gewährleistung?',
    muster: [/haft/i, /schadensersatz/i, /schadenersatz/i, /freistell/i, /vertragsstrafe/i, /pönale/i, /gewährleist/i] },
  { id: 'datenschutz', titel: 'Datenschutz / AVV', frage: 'Werden personenbezogene Daten im Auftrag verarbeitet — braucht es einen Auftragsverarbeitungsvertrag (Art. 28 DSGVO)?',
    muster: [/datenschutz/i, /personenbezogen/i, /auftragsverarbeit/i, /\bart\.?\s*28\b/i, /\bAVV\b/, /\bDS-?GVO\b/i, /\bGDPR\b/i] },
  { id: 'gerichtsstand', titel: 'Gerichtsstand & Rechtswahl', frage: 'Welches Recht gilt, wo ist der Gerichtsstand, gibt es ein Schiedsverfahren?',
    muster: [/gerichtsstand/i, /anwendbare[sn]? recht/i, /recht der bundesrepublik/i, /deutsche[sm]? recht/i, /rechtswahl/i, /schiedsgericht/i, /erfüllungsort/i, /\bUN-Kaufrecht\b/i] },
  { id: 'ip', titel: 'Rechte an Ergebnissen (IP) & Nutzung', frage: 'Wem gehören die Ergebnisse, welche Nutzungsrechte werden eingeräumt — ausschließlich, zeitlich, räumlich?',
    muster: [/nutzungsrecht/i, /urheber/i, /geistige[sn]? eigentum/i, /intellectual property/i, /rechteübertragung/i, /lizenz/i, /einräum/i, /verwertungsrecht/i] },
];

const MONATE: Readonly<Record<string, number>> = { januar: 1, februar: 2, maerz: 3, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
const FRIST_WOERTER = /kündig|kuendig|laufzeit|verlänger|endet|beginnt|in kraft|befristet|frist|ablauf/i;

interface Einheit { text: string; stelle?: string }

/**
 * Text in Einheiten (Sätze) mit Stelle („§ 5“, „Seite 2“) — linear, ohne Rückverfolgung. Eine Zeile wird an „. “ vor einem Großbuchstaben bzw. „§“
 * geteilt (nicht vor einer Ziffer — „Abs. 2“ bleibt zusammen); beginnt ein Satz mit „§ n“, „Ziffer n“, „Nr. n“ bzw. „n.“, gilt diese Stelle bis zur nächsten.
 */
export function einheiten(roh: string): Einheit[] {
  const raus: Einheit[] = [];
  let paragraf: string | undefined;
  let seite: string | undefined;
  for (const zeile0 of roh.normalize('NFC').replace(/\r\n?/g, '\n').split('\n')) {
    const zeile = zeile0.replace(/\s+/g, ' ').trim();
    if (!zeile) continue;
    const s = /^— Seite (\d{1,4}) —$/.exec(zeile);
    if (s) { seite = `Seite ${s[1]}`; continue; }
    for (const t0 of zeile.split(/(?<=[.;!?])\s+(?=[A-ZÄÖÜ§(])/)) {
      const t = t0.trim();
      if (!t) continue;
      const p = /^(§\s?\d{1,3}[a-z]?|Ziffer \d{1,3}|Nr\.\s?\d{1,3}|\d{1,2}\.(?:\d{1,2}\.?)?)\s/.exec(t);
      if (p) paragraf = p[1].replace(/\s+/g, ' ').replace(/\.$/, '');
      const stelle = [paragraf, seite].filter(Boolean).join(' · ') || undefined;
      raus.push({ text: t, ...(stelle ? { stelle } : {}) });
    }
  }
  return raus;
}

const zitat = (t: string): string => (t.length > ZITAT_MAX ? `${t.slice(0, ZITAT_MAX - 1).trimEnd()}…` : t);

/** Alle Tage in einem Satz mit ihrer Stelle im Satz (rein) — „31.12.2027“, „2027-12-31“, „31. Dezember 2027“; nur echte Kalendertage. */
export function tageMitStelle(t: string): { datum: string; index: number }[] {
  const raus: { datum: string; index: number }[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const m of t.matchAll(/\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\b/g)) raus.push({ datum: `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`, index: m.index ?? 0 });
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) raus.push({ datum: `${m[1]}-${m[2]}-${m[3]}`, index: m.index ?? 0 });
  for (const m of t.matchAll(/\b(\d{1,2})\.\s?(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s(\d{4})\b/gi)) {
    const mo = MONATE[m[2].toLowerCase()];
    if (mo) raus.push({ datum: `${m[3]}-${pad(mo)}-${pad(Number(m[1]))}`, index: m.index ?? 0 });
  }
  return raus.filter(x => istTag(x.datum)).sort((a, b) => a.index - b.index);
}
/** Alle Tage in einem Satz (rein, ohne Doppelte). */
export const tageIn = (t: string): string[] => Array.from(new Set(tageMitStelle(t).map(x => x.datum)));

/** Art eines Stichtags aus dem ganzen Satz (Rückfall, wenn unmittelbar davor kein Wort steht). */
const fristArt = (t: string): ErkannteFrist['art'] =>
  /kündig|kuendig/i.test(t) ? 'kuendigung' : /endet|ende |bis zum|befristet|ablauf/i.test(t) ? 'ende' : /beginnt|in kraft|inkrafttreten|ab dem|beginn/i.test(t) ? 'beginn' : 'sonstig';

/**
 * Art eines Stichtags aus den Wörtern UNMITTELBAR davor (60 Zeichen; rein): „kündig…“ gewinnt (der wichtigste Stichtag), sonst das spätere von
 * „beginnt/in Kraft/ab dem“ und „endet/bis zum/befristet/Ablauf“; ohne Wort davor der ganze Satz.
 */
export function fristArtBei(t: string, index: number): ErkannteFrist['art'] {
  const vor = t.slice(Math.max(0, index - 60), index).toLowerCase();
  if (/kündig|kuendig/.test(vor)) return 'kuendigung';
  const letzte = (re: RegExp) => { let n = -1; for (const m of vor.matchAll(re)) n = Math.max(n, m.index ?? -1); return n; };
  const ende = letzte(/endet|ende |bis zum|befristet|ablauf/g), beginn = letzte(/beginnt|in kraft|inkrafttreten|ab dem|beginn/g);
  if (ende >= 0 || beginn >= 0) return ende > beginn ? 'ende' : 'beginn';
  return fristArt(t);
}

/** Kündigungsfrist als Text („3 Monate zum Jahresende“) — die erste Fundstelle in einem Satz über Kündigung. */
export function kuendigungsfristAus(t: string): string | undefined {
  if (!/kündig|kuendig/i.test(t)) return undefined;
  const m = /(\d{1,2}|eine[mnr]?|zwei|drei|vier|sechs|zwölf)\s(Monat(?:e|en)?|Woche(?:n)?|Tag(?:e|en)?)(\s(?:zum|vor dem|vor)\s[^.,;]{1,40})?/i.exec(t);
  return m ? m[0].trim().slice(0, 120) : undefined;
}

/**
 * Die Checkliste eines Vertragstexts (rein): je Punkt höchstens drei Fundstellen mit wörtlichem Zitat und Stelle; erkannte Tage in Sätzen über
 * Laufzeit/Kündigung als Fristen-Kandidaten; eine Kündigungsfrist als Text. Keine Wertung — weder „gut“ noch „riskant“.
 */
export function vertragCheckliste(text: string): Checkliste {
  const gekuerzt = text.length > CHECKLISTE_MAX_ZEICHEN;
  const e = einheiten(gekuerzt ? text.slice(0, CHECKLISTE_MAX_ZEICHEN) : text);
  const punkte: ChecklistePunkt[] = CHECKLISTE_PUNKTE.map(p => {
    const funde: Fundstelle[] = [];
    for (const x of e) {
      if (funde.length >= FUNDE_JE_PUNKT) break;
      if (x.text.length < 12 || !p.muster.some(m => m.test(x.text))) continue;
      const z = zitat(x.text);
      if (funde.some(f => f.zitat === z)) continue;
      funde.push({ zitat: z, ...(x.stelle ? { stelle: x.stelle } : {}) });
    }
    return { id: p.id, titel: p.titel, frage: p.frage, fundstellen: funde };
  });
  const fristen: ErkannteFrist[] = [];
  let kuendigungsfrist: string | undefined;
  for (const x of e) {
    if (!kuendigungsfrist) kuendigungsfrist = kuendigungsfristAus(x.text);
    if (fristen.length >= FRISTEN_MAX || !FRIST_WOERTER.test(x.text)) continue;
    for (const { datum, index } of tageMitStelle(x.text)) {
      const art = fristArtBei(x.text, index);
      if (fristen.length < FRISTEN_MAX && !fristen.some(f => f.datum === datum && f.art === art)) fristen.push({ datum, art, zitat: zitat(x.text) });
    }
  }
  const leer = !text.replace(/— Seite \d+ —/g, '').trim();
  const hinweis = [leer ? 'Kein Text gefunden (vermutlich ein Scan ohne Texterkennung) — die Checkliste bitte selbst durchgehen.' : '', gekuerzt ? `Nur die ersten ${CHECKLISTE_MAX_ZEICHEN.toLocaleString('de-DE')} Zeichen durchsucht.` : ''].filter(Boolean).join(' ');
  return { punkte, fristen, ...(kuendigungsfrist ? { kuendigungsfrist } : {}), ...(hinweis ? { hinweis } : {}), zeichen: text.length };
}

const ART_TEXT: Record<ErkannteFrist['art'], string> = { kuendigung: 'Kündigung', ende: 'Ende', beginn: 'Beginn', sonstig: 'Stichtag' };
export const fristArtText = (a: ErkannteFrist['art']) => ART_TEXT[a];

/** Die Checkliste als Text (Entwurf in der Firmen-Akte, Stapel, Head) — mit Hinweis, ohne Wertung. */
export function checklisteText(c: Checkliste, kopf: string, hinweis: string): string {
  const tag = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
  const z: string[] = [kopf, hinweis, ''];
  for (const p of c.punkte) {
    z.push(`${p.fundstellen.length ? '■' : '□'} ${p.titel} — ${p.frage}`);
    if (!p.fundstellen.length) z.push('   Keine Stelle gefunden — selbst nachsehen.');
    for (const f of p.fundstellen) z.push(`   ${f.stelle ? `[${f.stelle}] ` : ''}„${f.zitat}“`);
    z.push('');
  }
  if (c.kuendigungsfrist) z.push(`Kündigungsfrist laut Text: ${c.kuendigungsfrist}`);
  if (c.fristen.length) z.push('Erkannte Stichtage (Vorschlag für Vertragsfristen und Kalender):', ...c.fristen.map(f => `   ${tag(f.datum)} — ${ART_TEXT[f.art]}: „${f.zitat}“`));
  if (c.hinweis) z.push('', c.hinweis);
  return z.join('\n').trim();
}

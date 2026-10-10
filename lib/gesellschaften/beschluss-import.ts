// ─── Unternehmen › Beschlüsse & Satzung: Beschluss- bzw. Satzungs-PDF → Vorschlag — Regelwerk OHNE Modell (rein, client-sicher, 10.10.) ────
// Vorbild Vertrags-Checkliste (lib/recht/vertrag-checkliste.ts): der Text wird in Sätze mit Stelle geteilt (`einheiten`), gesucht wird nur nach Wörtern,
// die an diesen Stellen üblich sind — jede Fundstelle steht WÖRTLICH mit Seite bzw. Paragraf da, nichts wird bewertet. Daraus ein Vorschlag für die
// Felder (Datum, Art, Gremium, Titel) und Änderungen (Gegenstand-Wortlaut, Stammkapital, Sitz, Firmierung); Beteiligte NUR als Text zur Ansicht (nie
// gespeichert — zugeordnet werden sie im Formular als Gesellschafter-Einträge). Übernommen wird erst per Klick. Der Text ist Text DRITTER: gelesen
// nur hier (Regelwerk); lineare Muster, sicher auch bei großen Dokumenten.

import { einheiten, tageMitStelle } from '@/lib/recht/vertrag-checkliste';
import { centAus, type BeschlussAenderung, type BeschlussArt, type Gremium } from './modell';

/** Höchstens so viel Text wird durchsucht — darüber steht ein Hinweis, nie still. */
export const IMPORT_MAX_ZEICHEN = 400_000;
const ZITAT_MAX = 300;
const zitat = (t: string) => (t.length > ZITAT_MAX ? `${t.slice(0, ZITAT_MAX - 1).trimEnd()}…` : t);

export type ImportFeld = 'datum' | 'art' | 'gremium' | 'titel' | 'gegenstand' | 'stammkapital' | 'sitz' | 'firmierung' | 'abstimmung' | 'beteiligte';
export interface ImportFundstelle { feld: ImportFeld; zitat: string; stelle?: string }
export interface ImportVorschlag {
  felder: { datum?: string; art?: BeschlussArt; gremium?: Gremium; titel?: string };
  /** Vorschläge für Änderungen bzw. Fassungen (Satzung: Gegenstand, Kapital, Sitz, Firmierung). */
  aenderungen: BeschlussAenderung[];
  fundstellen: ImportFundstelle[];
  /** Sätze, die Beteiligte nennen — NUR zur Ansicht, nie gespeichert. */
  beteiligteText: string[];
  /** Ist das eher eine Satzung (Gesellschaftsvertrag) als ein Beschluss? */
  satzung: boolean;
  hinweis?: string;
  zeichen: number;
}

/** Art eines Beschlusses — die erste Regel, die in einem Satz trifft, gewinnt (Reihenfolge = Vorrang). */
const ART_REGELN: readonly { art: BeschlussArt; muster: RegExp }[] = [
  { art: 'kapitalmassnahme', muster: /kapitalerhöhung|kapitalerhoehung|kapitalherabsetzung|stammkapital[^.]{0,60}(erhöht|herabgesetzt)|einziehung von geschäftsanteil/i },
  { art: 'satzungsaenderung', muster: /satzungsänderung|änderung des gesellschaftsvertrag|gesellschaftsvertrag[^.]{0,40}(geändert|neu gefasst)|neufassung (der satzung|des gesellschaftsvertrag)|sitz der gesellschaft wird[^.]{0,40}verlegt/i },
  { art: 'gf-bestellung', muster: /zu[mr]? geschäftsführer(in)? bestellt|bestellung[^.]{0,30}geschäftsführ|als geschäftsführer(in)? abberufen|abberufung[^.]{0,30}geschäftsführ/i },
  { art: 'jahresabschluss', muster: /jahresabschluss[^.]{0,80}festgestellt|feststellung des jahresabschluss/i },
  { art: 'gewinnverwendung', muster: /gewinnverwendung|ergebnisverwendung|verwendung des (jahres)?(ergebnisses|überschusses|gewinns)|ausgeschüttet|vortrag auf neue rechnung/i },
  { art: 'umlaufbeschluss', muster: /umlaufverfahren|im umlauf|schriftlichen verfahren|§\s?48 abs\.?\s?2/i },
  { art: 'gf-beschluss', muster: /beschluss der geschäftsführung|die geschäftsführung beschließt/i },
  { art: 'gesellschafterbeschluss', muster: /gesellschafterbeschluss|gesellschafterversammlung|die gesellschafter(in)? beschließ|alleinige[rn]? gesellschafter/i },
];
const GREMIUM_REGELN: readonly { gremium: Gremium; muster: RegExp }[] = [
  { gremium: 'alleingesellschafter', muster: /alleinige[rn]? gesellschafter|einpersonen|§\s?48 abs\.?\s?3/i },
  { gremium: 'geschaeftsfuehrung', muster: /beschluss der geschäftsführung|die geschäftsführung beschließt/i },
  { gremium: 'beirat', muster: /\bbeirat\b/i },
  { gremium: 'aufsichtsrat', muster: /\baufsichtsrat\b/i },
  { gremium: 'gesellschafterversammlung', muster: /gesellschafterversammlung|die gesellschafter(in)? beschließ/i },
];
const DATUM_SATZ = /beschl|versammlung|niederschrift|protokoll|, den\s|\bam\s+\d|gefasst|umlauf/i;
const BETEILIGT_SATZ = /anwesend|erschienen|vertreten durch|gesellschafter(in)?\s*:|stimmberechtigt|unterzeichne|teilnehm/i;
const ABSTIMMUNG_SATZ = /einstimmig|ja-?stimmen|nein-?stimmen|enthaltung|stimmenmehrheit|mit\s+\d+\s*%/i;
const TITEL_ZEILE = /^(gesellschafterbeschluss|niederschrift|protokoll|beschluss|umlaufbeschluss|gesellschaftsvertrag|satzung)\b/i;
const SATZUNG_DOK = /gesellschaftsvertrag|satzung der|§\s?1\s+firma|firma und sitz/i;

/** Gegenstand-Wortlaut: ab „Gegenstand des Unternehmens ist …“ bis zum Satzende (folgende Sätze desselben Paragrafen dazu). */
function gegenstandAus(e: { text: string; stelle?: string }[]): { text: string; fund: ImportFundstelle } | undefined {
  const i = e.findIndex(x => /gegenstand des unternehmens/i.test(x.text));
  if (i < 0) return undefined;
  const start = e[i];
  const ab = start.text.search(/gegenstand des unternehmens/i);
  let text = start.text.slice(ab).replace(/^gegenstand des unternehmens\s*(ist|sind|:)?\s*/i, '').replace(/^[„"]/, '').trim();
  // Folgesätze desselben Paragrafen (z. B. „Die Gesellschaft ist berechtigt, …“) — höchstens drei, ohne neuen Paragrafen.
  for (let j = i + 1; j < Math.min(e.length, i + 4); j++) {
    if (e[j].stelle !== start.stelle || /^(§|\d{1,2}\.)\s?\d*/.test(e[j].text) || /^(gesellschafterbeschluss|abstimmung|unterschrift)/i.test(e[j].text)) break;
    if (!/gesellschaft (ist|darf|kann) (berechtigt|sich)|zweigniederlassung|geschäfte/i.test(e[j].text)) break;
    text = `${text} ${e[j].text}`;
  }
  text = text.replace(/[“"]\s*$/, '').trim();
  if (text.length < 8) return undefined;
  return { text: text.slice(0, 6000), fund: { feld: 'gegenstand', zitat: zitat(start.text), ...(start.stelle ? { stelle: start.stelle } : {}) } };
}

/**
 * Den Vorschlag aus dem Text eines Beschluss- bzw. Satzungs-PDFs (rein). `heute` begrenzt Daten (nichts aus der Zukunft als Beschlusstag).
 * Keine Wertung — nur Fundstellen und ein Vorschlag, den ein Mensch übernimmt oder verwirft.
 */
export function beschlussAusText(roh: string, heute: string): ImportVorschlag {
  const gekuerzt = roh.length > IMPORT_MAX_ZEICHEN;
  const text = gekuerzt ? roh.slice(0, IMPORT_MAX_ZEICHEN) : roh;
  const e = einheiten(text);
  const fundstellen: ImportFundstelle[] = [];
  const fund = (feld: ImportFeld, x: { text: string; stelle?: string }) => { if (fundstellen.filter(f => f.feld === feld).length < 2) fundstellen.push({ feld, zitat: zitat(x.text), ...(x.stelle ? { stelle: x.stelle } : {}) }); };
  const felder: ImportVorschlag['felder'] = {};

  // Titel: die erste Zeile, die wie eine Überschrift aussieht.
  const erste = text.split(/\r?\n/).map(z => z.replace(/\s+/g, ' ').trim()).filter(z => z && !/^— Seite \d+ —$/.test(z)).slice(0, 8);
  const ueberschrift = erste.find(z => TITEL_ZEILE.test(z) && z.length <= 160);
  if (ueberschrift) { felder.titel = ueberschrift.slice(0, 160); fund('titel', { text: ueberschrift }); }

  // Art und Gremium.
  for (const r of ART_REGELN) {
    const x = e.find(y => r.muster.test(y.text));
    if (x) { felder.art = r.art; fund('art', x); break; }
  }
  for (const r of GREMIUM_REGELN) {
    const x = e.find(y => r.muster.test(y.text));
    if (x) { felder.gremium = r.gremium; fund('gremium', x); break; }
  }

  // Datum: zuerst ein Tag in einem Satz über Beschluss/Versammlung/Ort-und-Datum, sonst der erste Tag — nie in der Zukunft.
  const tage = (x: { text: string }) => tageMitStelle(x.text).map(t => t.datum).filter(t => t <= heute);
  const satz = e.find(x => DATUM_SATZ.test(x.text) && tage(x).length) ?? e.find(x => tage(x).length);
  if (satz) { felder.datum = tage(satz)[0]; fund('datum', satz); }

  // Abstimmung und Beteiligte: nur als Fundstelle (Text) — zugeordnet wird von Hand.
  for (const x of e.filter(y => ABSTIMMUNG_SATZ.test(y.text)).slice(0, 2)) fund('abstimmung', x);
  const beteiligteText = e.filter(x => BETEILIGT_SATZ.test(x.text) && x.text.length >= 8).slice(0, 6).map(x => zitat(x.text));

  // Änderungen bzw. Satzungsinhalte.
  const aenderungen: BeschlussAenderung[] = [];
  const geg = gegenstandAus(e);
  if (geg) { aenderungen.push({ merkmal: 'gegenstand', text: geg.text }); fundstellen.push(geg.fund); }
  // Der erste Satz über das Stammkapital mit einem Betrag in Euro; davon der letzte Betrag („… von 25.000 € auf 50.000 € erhöht“ → der neue).
  const betraegeIn = (t: string) => [...t.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?\s*(?:€|EUR|Euro)/gi)].map(m => centAus(`${m[1]}${m[2] ? `,${m[2]}` : ''}`)).filter((c): c is number => typeof c === 'number' && c > 0);
  const kap = e.find(x => /stammkapital/i.test(x.text) && betraegeIn(x.text).length);
  if (kap) { const b = betraegeIn(kap.text); aenderungen.push({ merkmal: 'stammkapital', cent: b[b.length - 1] }); fund('stammkapital', kap); }
  const sitz = e.map(x => ({ x, m: /sitz der gesellschaft (?:ist|wird[^.]{0,30}nach)\s+([A-ZÄÖÜ][\wäöüß.\- ]{1,60}?)(?:\s+verlegt)?[.;,]?$/i.exec(x.text) ?? /sitz der gesellschaft (?:ist|wird[^.]{0,30}nach)\s+([A-ZÄÖÜ][\wäöüß\-]{1,40})/i.exec(x.text) })).find(y => y.m);
  if (sitz?.m) { aenderungen.push({ merkmal: 'sitz', text: sitz.m[1].replace(/\s+verlegt$/i, '').trim() }); fund('sitz', sitz.x); }
  const firma = e.map(x => ({ x, m: /die firma der gesellschaft lautet:?\s*[„"]?([^“".]{3,150})/i.exec(x.text) })).find(y => y.m);
  if (firma?.m) { aenderungen.push({ merkmal: 'firmierung', text: firma.m[1].trim() }); fund('firmierung', firma.x); }

  const satzung = SATZUNG_DOK.test(erste.join(' ')) && !ART_REGELN.slice(2).some(r => r.muster.test(erste.join(' ')));
  const leer = !text.replace(/— Seite \d+ —/g, '').trim();
  const hinweis = [leer ? 'Kein Text gefunden (vermutlich ein Scan ohne Texterkennung) — bitte die Felder selbst eintragen.' : '', gekuerzt ? `Nur die ersten ${IMPORT_MAX_ZEICHEN.toLocaleString('de-DE')} Zeichen durchsucht.` : '',
    !leer && !felder.art ? 'Keine Art erkannt — bitte wählen.' : ''].filter(Boolean).join(' ');
  return { felder, aenderungen, fundstellen, beteiligteText, satzung, ...(hinweis ? { hinweis } : {}), zeichen: roh.length };
}

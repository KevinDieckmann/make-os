// ─── Der Prüfer — Code kontrolliert den Head of Finance ────────────────────
// Nach jeder Antwort, bevor irgendwer sie sieht:
//   1. Form: Pflichtfelder, erlaubte Werte, Längen — sonst wird repariert/gekürzt.
//   2. Zahlen: jede €- und %-Angabe muss im Datenpaket stehen (pruefung.ts).
//   3. Quellen: jeder Pfad in "quelle" muss im Datenpaket existieren.
//   4. Beträge: betrag_eur eines Vorschlags steht so in den Daten.
//   5. Fristen: nur Daten, die im Paket vorkommen (Steuertermine, Fälligkeiten).
//   6. Keine Vollzugsmeldung („habe überwiesen“), keine Anlageprodukte.
//   7. Steuerbefunde enden mit „Hinweis, keine Steuerberatung.“ (wird ergänzt).
// Findet der Prüfer etwas, bekommt das Modell genau eine Korrekturrunde mit
// der Fehlerliste; was danach noch hakt, wird sichtbar markiert.

import { MODI, ARTEN, type Modus } from './prompt';
import { zahlenImText, zahlenAus, belegt, type Fund } from './pruefung';

export type Farbe = 'gruen' | 'gelb' | 'rot' | 'grau';
export interface Befund { titel: string; was: string; bedeutung: string; typ: 'fakt' | 'annahme' | 'hinweis'; schwere: 'hoch' | 'mittel' | 'niedrig'; bereich: string; steuerhinweis: boolean; quelle: string[] }
export interface VorschlagRoh { titel: string; begruendung: string; betrag_eur: number | null; frist: string | null; prioritaet: 'hoch' | 'mittel' | 'niedrig'; verantwortlich: 'kevin' | 'malin' | 'beide' | 'steuerberater'; bereich: string; art: string; quelle: string[]; dedup_schluessel: string }
export interface Antwort {
  modus: Modus; status: 'ruhig' | 'beobachten' | 'handeln'; zusammenfassung: string;
  ampel: { bereich: 'business' | 'haushalt' | 'gesamt'; farbe: Farbe; grund: string }[];
  befunde: Befund[]; vorschlaege: VorschlagRoh[];
  fragen: { frage: string; warum: string; an: string }[];
  datenluecken: { was: string; auswirkung: string }[];
  antwort: string | null; bericht_markdown: string | null;
}

const S = (v: unknown, max = 600) => String(v ?? '').trim().slice(0, max);
const aus = <T extends string>(v: unknown, werte: readonly T[], std: T): T => (werte as readonly string[]).includes(String(v)) ? v as T : std;
const liste = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
const BEREICHE = ['business', 'haushalt', 'gesamt', 'steuern', 'daten'] as const;
const WER = ['kevin', 'malin', 'beide', 'steuerberater'] as const;
export const STEUER_SATZ = 'Hinweis, keine Steuerberatung.';

/** Form sicherstellen — was fehlt oder falsch ist, wird ersetzt statt zu scheitern. */
export function normalisiere(roh: unknown, modus: Modus): Antwort {
  const r = (roh ?? {}) as Record<string, unknown>;
  const befunde = liste(r.befunde).slice(0, 8).map(b => {
    const steuer = b.steuerhinweis === true || b.bereich === 'steuern';
    let bedeutung = S(b.bedeutung, 700);
    if (steuer && !bedeutung.includes('keine Steuerberatung')) bedeutung = `${bedeutung.replace(/\s*$/, '')} ${STEUER_SATZ}`.trim();
    return {
      titel: S(b.titel, 120), was: S(b.was, 500), bedeutung,
      typ: aus(b.typ, ['fakt', 'annahme', 'hinweis'] as const, 'fakt'),
      schwere: aus(b.schwere, ['hoch', 'mittel', 'niedrig'] as const, 'mittel'),
      bereich: aus(b.bereich, BEREICHE, 'business'), steuerhinweis: steuer,
      quelle: liste(b.quelle).map(q => S(q, 120)).filter(Boolean).slice(0, 8),
    };
  }).filter(b => b.titel || b.was);
  const vorschlaege = liste(r.vorschlaege).slice(0, 5).map(v => ({
    titel: S(v.titel, 140), begruendung: S(v.begruendung, 500),
    betrag_eur: typeof v.betrag_eur === 'number' && Number.isFinite(v.betrag_eur) ? Math.round(v.betrag_eur * 100) / 100 : null,
    frist: /^\d{4}-\d{2}-\d{2}$/.test(String(v.frist ?? '')) ? String(v.frist) : null,
    prioritaet: aus(v.prioritaet, ['hoch', 'mittel', 'niedrig'] as const, 'mittel'),
    verantwortlich: aus(v.verantwortlich, WER, 'beide'),
    bereich: aus(v.bereich, BEREICHE, 'business'),
    // „abschluss“ gehört nur dem Monatsabschluss — sonst ist es eine Klärung.
    art: modus !== 'monatsabschluss' && v.art === 'abschluss' ? 'klaeren' : aus(v.art, ARTEN, 'klaeren'),
    quelle: liste(v.quelle).map(q => S(q, 120)).filter(Boolean).slice(0, 8),
    dedup_schluessel: S(v.dedup_schluessel, 120).toLowerCase() || `${S(v.art, 30) || 'klaeren'}:${S(v.titel, 60).toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}`,
  })).filter(v => v.titel);
  return {
    modus: aus(r.modus, MODI, modus), status: aus(r.status, ['ruhig', 'beobachten', 'handeln'] as const, 'beobachten'),
    zusammenfassung: S(r.zusammenfassung, 900),
    ampel: liste(r.ampel).slice(0, 3).map(a => ({ bereich: aus(a.bereich, ['business', 'haushalt', 'gesamt'] as const, 'business'), farbe: aus(a.farbe, ['gruen', 'gelb', 'rot', 'grau'] as const, 'grau'), grund: S(a.grund, 240) })),
    befunde, vorschlaege,
    fragen: liste(r.fragen).slice(0, 3).map(f => ({ frage: S(f.frage, 300), warum: S(f.warum, 300), an: aus(f.an, WER, 'beide') })).filter(f => f.frage),
    datenluecken: liste(r.datenluecken).slice(0, 6).map(d => ({ was: S(d.was, 240), auswirkung: S(d.auswirkung, 300) })).filter(d => d.was),
    antwort: r.antwort == null || r.antwort === '' ? null : S(r.antwort, 2400),
    bericht_markdown: r.bericht_markdown == null || r.bericht_markdown === '' ? null : S(r.bericht_markdown, 4000),
  };
}

/** Alle Freitexte einer Antwort — die Zahlenprüfung liest genau diese. */
export function texte(a: Antwort): string[] {
  return [a.zusammenfassung, a.antwort ?? '', a.bericht_markdown ?? '',
    ...a.ampel.map(x => x.grund), ...a.befunde.flatMap(b => [b.titel, b.was, b.bedeutung]),
    ...a.vorschlaege.flatMap(v => [v.titel, v.begruendung]), ...a.fragen.flatMap(f => [f.frage, f.warum]),
    ...a.datenluecken.flatMap(d => [d.was, d.auswirkung])].filter(Boolean);
}

/** Existiert der Pfad im Datenpaket? „a.b.0.c“, Werkzeug-Quellen gelten, wenn das Werkzeug lief. */
export function pfadDa(daten: unknown, pfad: string, werkzeuge: string[] = []): boolean {
  if (pfad.startsWith('werkzeug:')) return werkzeuge.includes(pfad.slice(9));
  let x: unknown = daten;
  for (const teil of pfad.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (x && typeof x === 'object' && teil in (x as Record<string, unknown>)) x = (x as Record<string, unknown>)[teil];
    else return false;
  }
  return true;
}

/** Alle ISO-Daten im Paket — gültige Fristen. */
export function datenIn(daten: unknown): Set<string> {
  const raus = new Set<string>();
  const lauf = (v: unknown) => {
    if (typeof v === 'string') { for (const m of Array.from(v.matchAll(/\d{4}-\d{2}-\d{2}/g))) raus.add(m[0]); return; }
    if (Array.isArray(v)) v.forEach(lauf); else if (v && typeof v === 'object') Object.values(v).forEach(lauf);
  };
  lauf(daten);
  return raus;
}

// Kein \b vor „überwiesen“: in JavaScript ist „ü“ kein Wortzeichen, \b greift dort nicht.
const VOLLZUG = /\b(habe|hab)\b[^.]{0,60}?(überwiesen|gebucht|gekündigt|bezahlt|umgebucht|verschoben|angewiesen|ausgeführt)(?![a-zäöüß])/i;
const ANLAGE = /\b(ETF|ETFs|Aktie|Aktien|Fonds|Krypto|Bitcoin|Ethereum|ISIN|Anleihe|Tagesgeld bei|Festgeld bei|MSCI|S&P ?500|Robo-?Advisor)\b|\b[A-Z]{2}[0-9A-Z]{9}[0-9]\b/;

export interface Pruefung {
  geprueft: number; unbelegt: Fund[];
  quellenFehlen: string[]; betraegeUnbelegt: string[]; fristenUnbelegt: string[];
  verstoesse: string[];
}

export function pruefe(a: Antwort, daten: unknown, werkzeugWerte: number[] = [], werkzeuge: string[] = []): Pruefung {
  const basis = [...zahlenAus(daten), ...werkzeugWerte];
  const alle = texte(a).join('\n');
  const funde = zahlenImText(alle);
  const unbelegt = funde.filter(f => !belegt(f.wert, basis, f.art));
  const quellen = [...a.befunde.flatMap(b => b.quelle), ...a.vorschlaege.flatMap(v => v.quelle)];
  const quellenFehlen = Array.from(new Set(quellen.filter(q => !pfadDa(daten, q, werkzeuge))));
  const betraegeUnbelegt = a.vorschlaege.filter(v => v.betrag_eur != null && !belegt(v.betrag_eur, basis, 'euro')).map(v => `${v.titel}: ${v.betrag_eur} €`);
  const daten_ = datenIn(daten);
  const fristenUnbelegt = a.vorschlaege.filter(v => v.frist && !daten_.has(v.frist)).map(v => `${v.titel}: ${v.frist}`);
  const verstoesse: string[] = [];
  if (VOLLZUG.test(alle)) verstoesse.push('Vollzugsformulierung — der Agent führt nichts aus, er schlägt vor.');
  const anlage = alle.match(ANLAGE);
  if (anlage) verstoesse.push(`Anlageprodukt genannt („${anlage[0]}“) — keine Anlageberatung.`);
  return { geprueft: funde.length, unbelegt, quellenFehlen, betraegeUnbelegt, fristenUnbelegt, verstoesse };
}

export const sauber = (p: Pruefung) => !p.unbelegt.length && !p.quellenFehlen.length && !p.betraegeUnbelegt.length && !p.fristenUnbelegt.length && !p.verstoesse.length;

/** Die Fehlerliste für die eine Korrekturrunde — konkret, damit das Modell weiterarbeiten kann. */
export function korrekturAuftrag(p: Pruefung): string {
  const z: string[] = [];
  if (p.unbelegt.length) z.push(`Diese Zahlen stehen nicht in <daten> und sind keine Summe/Differenz zweier Werte: ${p.unbelegt.map(f => `„${f.text}“`).join(', ')}. Ersetze sie durch Werte aus den Daten oder lass sie weg.`);
  if (p.quellenFehlen.length) z.push(`Diese Quellen-Pfade gibt es im Datenpaket nicht: ${p.quellenFehlen.join(', ')}. Nenne existierende Pfade.`);
  if (p.betraegeUnbelegt.length) z.push(`betrag_eur ohne Beleg: ${p.betraegeUnbelegt.join('; ')}. Nur Beträge aus den Daten, sonst null.`);
  if (p.fristenUnbelegt.length) z.push(`Fristen, die nicht in den Daten stehen: ${p.fristenUnbelegt.join('; ')}. Nur Daten aus steuern.termine_60_tage oder Fälligkeiten in den Daten, sonst null.`);
  if (p.verstoesse.length) z.push(...p.verstoesse);
  return `<pruefung>\nDer Prüfer hat in deiner Antwort gefunden:\n- ${z.join('\n- ')}\nGib die vollständige, korrigierte Antwort im selben JSON-Schema zurück. Ändere nur, was nötig ist.\n</pruefung>`;
}

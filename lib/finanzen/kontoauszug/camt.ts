// ─── Kontoauszug einlesen — CAMT.053 (ISO 20022) (09.10., rein: Server UND Browser) ─────────────────────────────────────────────────────
// CAMT.053 ist seit dem Ende von MT940 (DK, Nov. 2025 — research/bank/FAKTEN_BANK.md › 3) der Kontoauszug der Banken. Gelesen werden die
// Fassungen camt.053.001.02 bis .08 (dieselben Elementnamen; ab .06 steht der Status als `<Sts><Cd>BOOK</Cd></Sts>`, ab .08 der Name der
// Gegenseite unter `<Pty><Nm>`) — dazu camt.052/.054 mit demselben Aufbau (dort meist ohne Endsaldo).
//
// SICHERHEIT: ein eigener, kleiner XML-Leser — KEINE Dokumenttyp-Deklaration, KEINE Entitäten außer den fünf vordefinierten und Zeichen-
// referenzen. Eine Datei mit `<!DOCTYPE` oder `<!ENTITY` wird abgelehnt (kein XXE, keine „Billion Laughs“), unbekannte `&name;` bleiben
// wörtlich stehen (nie aufgelöst), Tiefe begrenzt. Nichts wird nachgeladen, nichts ausgeführt — Verwendungszwecke sind fremder Text (Daten).

import { betragCent, datumAus, textGlaetten } from './text';
import { AUSZUG_GRENZEN, type Auszug, type AuszugEintrag, type AuszugSaldo, type EintragStatus, type LeseErgebnis, type Pruefsumme } from './typen';
import { ibanGrundform, ibanGueltig } from '@/lib/crm/zahlung';

// ── XML ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface XmlKnoten { name: string; attr: Record<string, string>; kinder: XmlKnoten[]; text: string }
export class XmlFehler extends Error { constructor(readonly grund: 'dtd' | 'aufbau' | 'tiefe', text: string) { super(text); this.name = 'XmlFehler'; } }

const ENTITAET: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** Vordefinierte Entitäten und Zeichenreferenzen auflösen — sonst nichts (unbekannte bleiben wörtlich). */
function entitaeten(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,4});/g, (ganz, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ganz;
    }
    return ENTITAET[e] ?? ganz;
  });
}
const lokal = (n: string) => { const i = n.indexOf(':'); return i >= 0 ? n.slice(i + 1) : n; };

/** XML → Baum (iterativ, ohne Rekursion). Wirft `XmlFehler` bei DTD/Entitäten-Deklaration, kaputtem Aufbau oder zu tiefer Schachtelung. */
export function xmlLesen(text: string): XmlKnoten {
  if (/<!DOCTYPE|<!ENTITY|<!ELEMENT|<!ATTLIST/i.test(text)) throw new XmlFehler('dtd', 'Die Datei enthält eine Dokumenttyp-Deklaration (DTD/Entitäten) — aus Sicherheitsgründen wird sie nicht gelesen.');
  const wurzel: XmlKnoten = { name: '#wurzel', attr: {}, kinder: [], text: '' };
  const stapel: XmlKnoten[] = [wurzel];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) { stapel[stapel.length - 1].text += entitaeten(text.slice(i)); break; }
    if (lt > i) stapel[stapel.length - 1].text += entitaeten(text.slice(i, lt));
    if (text.startsWith('<?', lt)) { const e = text.indexOf('?>', lt + 2); if (e < 0) throw new XmlFehler('aufbau', 'XML-Deklaration ohne Ende.'); i = e + 2; continue; }
    if (text.startsWith('<!--', lt)) { const e = text.indexOf('-->', lt + 4); if (e < 0) throw new XmlFehler('aufbau', 'Kommentar ohne Ende.'); i = e + 3; continue; }
    if (text.startsWith('<![CDATA[', lt)) { const e = text.indexOf(']]>', lt + 9); if (e < 0) throw new XmlFehler('aufbau', 'CDATA ohne Ende.'); stapel[stapel.length - 1].text += text.slice(lt + 9, e); i = e + 3; continue; }
    if (text.startsWith('<!', lt)) throw new XmlFehler('dtd', 'Unbekannte Deklaration im XML — nicht gelesen.');
    if (text.startsWith('</', lt)) {
      const e = text.indexOf('>', lt + 2);
      if (e < 0) throw new XmlFehler('aufbau', 'End-Tag ohne Ende.');
      const name = lokal(text.slice(lt + 2, e).trim());
      const oben = stapel.pop();
      if (!oben || oben === wurzel || oben.name !== name) throw new XmlFehler('aufbau', `End-Tag „${name.slice(0, 40)}“ passt nicht.`);
      i = e + 1;
      continue;
    }
    // Start-Tag: Ende suchen, dabei Anführungszeichen in Attributwerten beachten.
    let j = lt + 1, quote = '';
    for (; j < n; j++) {
      const c = text[j];
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    if (j >= n) throw new XmlFehler('aufbau', 'Tag ohne Ende.');
    let inhalt = text.slice(lt + 1, j);
    const leer = inhalt.endsWith('/');
    if (leer) inhalt = inhalt.slice(0, -1);
    const m = /^([^\s/>]+)/.exec(inhalt);
    if (!m) throw new XmlFehler('aufbau', 'Tag ohne Namen.');
    const attr: Record<string, string> = {};
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a: RegExpExecArray | null;
    const rest = inhalt.slice(m[1].length);
    while ((a = re.exec(rest))) attr[lokal(a[1])] = entitaeten(a[3] ?? a[4] ?? '');
    const k: XmlKnoten = { name: lokal(m[1]), attr, kinder: [], text: '' };
    stapel[stapel.length - 1].kinder.push(k);
    if (!leer) {
      stapel.push(k);
      if (stapel.length > AUSZUG_GRENZEN.tiefe) throw new XmlFehler('tiefe', 'Das XML ist zu tief verschachtelt — nicht gelesen.');
    }
    i = j + 1;
  }
  if (stapel.length !== 1) throw new XmlFehler('aufbau', 'Das XML endet mitten in einem Element.');
  return wurzel;
}

/** Kind (bzw. Pfad aus Kindern) nach lokalem Namen. */
export function kind(k: XmlKnoten | undefined, ...pfad: string[]): XmlKnoten | undefined {
  let x = k;
  for (const p of pfad) { x = x?.kinder.find(c => c.name === p); if (!x) return undefined; }
  return x;
}
export const kinder = (k: XmlKnoten | undefined, name: string): XmlKnoten[] => (k ? k.kinder.filter(c => c.name === name) : []);
const wert = (k: XmlKnoten | undefined, ...pfad: string[]): string | undefined => { const x = kind(k, ...pfad); const t = x ? textGlaetten(x.text) : ''; return t || undefined; };

// ── CAMT ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sieht der Text wie ein CAMT-Dokument aus? (für die Erkennung CAMT vs. CSV) */
export function istCamt(text: string): boolean {
  const kopf = text.slice(0, 4000);
  return /^\s*</.test(kopf) && (/<([A-Za-z0-9_]+:)?Document[\s>]/.test(kopf) || /camt\.05[234]/.test(kopf));
}

const datumVon = (k: XmlKnoten | undefined): string | undefined => {
  const d = wert(k, 'Dt') ?? wert(k, 'DtTm');
  return d ? datumAus(d) ?? undefined : undefined;
};
const betragVon = (k: XmlKnoten | undefined): { cent: number; waehrung?: string } | null => {
  const amt = kind(k, 'Amt');
  const c = amt ? betragCent(textGlaetten(amt.text), 'punkt') : null;
  if (c === null) return null;
  const neg = wert(k, 'CdtDbtInd') === 'DBIT';
  return { cent: neg ? -Math.abs(c) : Math.abs(c), waehrung: amt?.attr.Ccy };
};
/** Name einer Partei: `<Nm>` (bis .07) oder `<Pty><Nm>` (ab .08). */
const nameVon = (k: XmlKnoten | undefined) => wert(k, 'Nm') ?? wert(k, 'Pty', 'Nm');
const ibanVon = (k: XmlKnoten | undefined) => { const i = wert(k, 'Id', 'IBAN'); return i && ibanGueltig(i) ? ibanGrundform(i) : undefined; };

function statusVon(ntry: XmlKnoten): EintragStatus {
  const s = (wert(ntry, 'Sts', 'Cd') ?? wert(ntry, 'Sts') ?? 'BOOK').toUpperCase();
  return s === 'BOOK' ? 'gebucht' : s === 'PDNG' || s === 'INFO' || s === 'FUTR' ? 'vorgemerkt' : 'abgelehnt';
}

function eintragAus(ntry: XmlKnoten, nr: number, kontoWaehrung: string): AuszugEintrag | null {
  const b = betragVon(ntry);
  const datum = datumVon(kind(ntry, 'BookgDt')) ?? datumVon(kind(ntry, 'ValDt'));
  if (!b || !datum) return null;
  const valuta = datumVon(kind(ntry, 'ValDt'));
  const eingang = b.cent > 0;
  const tx = kinder(ntry, 'NtryDtls').flatMap(d => kinder(d, 'TxDtls'));
  const parteien = tx.map(t => {
    const r = kind(t, 'RltdPties');
    const name = eingang ? nameVon(kind(r, 'Dbtr')) ?? nameVon(kind(r, 'UltmtDbtr')) : nameVon(kind(r, 'Cdtr')) ?? nameVon(kind(r, 'UltmtCdtr'));
    const iban = eingang ? ibanVon(kind(r, 'DbtrAcct')) : ibanVon(kind(r, 'CdtrAcct'));
    const rmt = kind(t, 'RmtInf');
    const ustrd = kinder(rmt, 'Ustrd').map(u => textGlaetten(u.text)).filter(Boolean).join(' ');
    const strd = kinder(rmt, 'Strd').map(s => wert(s, 'CdtrRefInf', 'Ref')).filter(Boolean).join(' ');
    return { name, iban, zweck: ustrd || strd || wert(t, 'AddtlTxInf') || '', ref: wert(t, 'Refs', 'AcctSvcrRef') };
  });
  const namen = Array.from(new Set(parteien.map(p => p.name).filter((x): x is string => !!x)));
  const gegenpartei = namen.length === 1 ? namen[0] : namen.length > 1 ? `Sammelbuchung (${tx.length} Posten)` : '';
  const zwecke = parteien.map(p => p.zweck).filter(Boolean);
  const zweck = (tx.length > 1 ? wert(ntry, 'AddtlNtryInf') ?? zwecke.join(' · ') : zwecke[0] ?? wert(ntry, 'AddtlNtryInf') ?? '') || '';
  const externeId = wert(ntry, 'AcctSvcrRef') ?? wert(ntry, 'NtryRef') ?? (tx.length === 1 ? parteien[0].ref : undefined);
  return {
    datum, ...(valuta ? { valuta } : {}), cent: b.cent, waehrung: b.waehrung ?? kontoWaehrung,
    gegenpartei: textGlaetten(gegenpartei), ...(parteien.length === 1 && parteien[0].iban ? { gegenIban: parteien[0].iban } : {}),
    zweck: textGlaetten(zweck), ...(externeId ? { externeId: externeId.slice(0, 120) } : {}), status: statusVon(ntry), zeile: nr,
  };
}

interface StmtRoh { iban?: string; waehrung: string; anfang?: AuszugSaldo; ende?: AuszugSaldo; eintraege: AuszugEintrag[]; hinweise: string[]; id?: string }

function stmtAus(stmt: XmlKnoten, nrStart: number): StmtRoh {
  const acct = kind(stmt, 'Acct');
  const iban = ibanVon(acct);
  const hinweise: string[] = [];
  let waehrung = wert(acct, 'Ccy') ?? '';
  let anfang: AuszugSaldo | undefined, ende: AuszugSaldo | undefined;
  for (const bal of kinder(stmt, 'Bal')) {
    const code = (wert(bal, 'Tp', 'CdOrPrtry', 'Cd') ?? wert(bal, 'Tp', 'CdOrPrtry', 'Prtry') ?? '').toUpperCase();
    const b = betragVon(bal);
    const datum = datumVon(kind(bal, 'Dt'));
    if (!b || !datum) continue;
    if (!waehrung && b.waehrung) waehrung = b.waehrung;
    if (code === 'CLBD') ende = { cent: b.cent, datum };
    else if ((code === 'OPBD' || code === 'PRCD') && !anfang) anfang = { cent: b.cent, datum };
  }
  waehrung = (waehrung || 'EUR').toUpperCase();
  const eintraege: AuszugEintrag[] = [];
  let nr = nrStart, kaputt = 0;
  for (const ntry of kinder(stmt, 'Ntry')) {
    nr++;
    const e = eintragAus(ntry, nr, waehrung);
    if (e) eintraege.push(e); else kaputt++;
  }
  if (kaputt) hinweise.push(`${kaputt} ${kaputt === 1 ? 'Eintrag ohne lesbaren Betrag oder Buchungstag wurde' : 'Einträge ohne lesbaren Betrag oder Buchungstag wurden'} übersprungen.`);
  return { iban, waehrung, anfang, ende, eintraege, hinweise, id: wert(stmt, 'Id') };
}

/** Saldo-Prüfung eines Auszugs: Anfang + Summe der gebuchten Umsätze in Kontowährung = Ende. */
export function pruefsumme(anfang: AuszugSaldo | undefined, ende: AuszugSaldo | undefined, eintraege: readonly AuszugEintrag[], waehrung: string): Pruefsumme | null {
  if (!anfang || !ende) return null;
  const summe = eintraege.filter(e => e.status === 'gebucht' && e.waehrung === waehrung).reduce((s, e) => s + e.cent, 0);
  const abweichung = ende.cent - (anfang.cent + summe);
  return { anfang: anfang.cent, summe, ende: ende.cent, stimmt: abweichung === 0, abweichung };
}

/** CAMT-Text → Auszüge je Konto (mehrere Tagesauszüge desselben Kontos zusammengefasst, jeder für sich gegengerechnet). */
export function camtLesen(text: string): LeseErgebnis {
  let baum: XmlKnoten;
  try { baum = xmlLesen(text); }
  catch (e) { return { ok: false, status: e instanceof XmlFehler && e.grund === 'dtd' ? 415 : 400, fehler: e instanceof Error ? e.message : 'Das XML ist nicht lesbar.' }; }
  const doc = kind(baum, 'Document');
  const xmlns = doc?.attr.xmlns ?? Object.entries(doc?.attr ?? {}).find(([k]) => k.startsWith('xmlns'))?.[1] ?? '';
  const version = /camt\.05[234]\.001\.\d{2}/.exec(xmlns)?.[0];
  const huelle = kind(doc, 'BkToCstmrStmt') ?? kind(doc, 'BkToCstmrAcctRpt') ?? kind(doc, 'BkToCstmrDbtCdtNtfctn');
  if (!doc || !huelle) return { ok: false, status: 415, fehler: 'Das ist kein CAMT-Kontoauszug (camt.053, auch .052/.054) — erwartet wird `Document` mit `BkToCstmrStmt`.' };
  const stmts = [...kinder(huelle, 'Stmt'), ...kinder(huelle, 'Rpt'), ...kinder(huelle, 'Ntfctn')];
  if (!stmts.length) return { ok: false, status: 400, fehler: 'Der Auszug enthält keinen Kontoauszug (`Stmt`).' };
  const hinweise: string[] = [];
  if (version && !/^camt\.053/.test(version)) hinweise.push(`Fassung ${version}: kein Tagesabschluss — ein Endsaldo fehlt meist, dann wird nur gebucht, was gebucht ist.`);
  // Zusammenfassen je Konto (IBAN + Währung) — z. B. eine Datei mit 30 Tagesauszügen.
  const gruppen = new Map<string, { roh: StmtRoh[] }>();
  let nr = 0, anzahl = 0;
  for (const s of stmts) {
    const r = stmtAus(s, nr);
    nr += kinder(s, 'Ntry').length;
    anzahl += r.eintraege.length;
    if (anzahl > AUSZUG_GRENZEN.eintraege) return { ok: false, status: 413, fehler: `Mehr als ${AUSZUG_GRENZEN.eintraege.toLocaleString('de-DE')} Umsätze in einer Datei — bitte in kleineren Zeiträumen herunterladen. Nichts gelesen.` };
    const schluessel = `${r.iban ?? '?'}|${r.waehrung}`;
    const g = gruppen.get(schluessel) ?? { roh: [] };
    g.roh.push(r);
    gruppen.set(schluessel, g);
  }
  const auszuege: Auszug[] = [];
  for (const { roh } of Array.from(gruppen.values())) {
    const sortiert = [...roh].sort((a, b) => (a.anfang?.datum ?? a.ende?.datum ?? '').localeCompare(b.anfang?.datum ?? b.ende?.datum ?? ''));
    const eintraege = sortiert.flatMap(r => r.eintraege);
    const waehrung = sortiert[0].waehrung;
    const anfang = sortiert.map(r => r.anfang).filter((x): x is AuszugSaldo => !!x).sort((a, b) => a.datum.localeCompare(b.datum))[0];
    const ende = sortiert.map(r => r.ende).filter((x): x is AuszugSaldo => !!x).sort((a, b) => b.datum.localeCompare(a.datum))[0];
    const hinw = sortiert.flatMap(r => r.hinweise);
    // Je Tagesauszug gegenrechnen — eine Lücke zwischen zwei Auszügen fiele sonst in der Gesamtsumme nicht auf.
    let geprueft = 0, falsch = 0, abweichung = 0;
    for (const r of sortiert) {
      const p = pruefsumme(r.anfang, r.ende, r.eintraege, r.waehrung);
      if (!p) continue;
      geprueft++;
      if (!p.stimmt) { falsch++; abweichung += p.abweichung; }
    }
    let pruefung: Pruefsumme | null = null;
    if (geprueft) {
      const summe = eintraege.filter(e => e.status === 'gebucht' && e.waehrung === waehrung).reduce((s, e) => s + e.cent, 0);
      pruefung = { anfang: anfang?.cent ?? 0, summe, ende: ende?.cent ?? 0, stimmt: falsch === 0, abweichung };
      if (falsch) hinw.push(`Saldo-Prüfung: ${falsch} von ${geprueft} Tagesauszügen gehen nicht auf (Anfang + Umsätze ≠ Ende).`);
    } else if (!anfang || !ende) hinw.push('Kein Anfangs- und Endsaldo im Auszug — die Saldo-Prüfung entfällt.');
    const vorgemerkt = eintraege.filter(e => e.status === 'vorgemerkt').length;
    if (vorgemerkt) hinw.push(`${vorgemerkt} vorgemerkte ${vorgemerkt === 1 ? 'Umsatz wird' : 'Umsätze werden'} nicht übernommen (erst, wenn sie gebucht sind).`);
    auszuege.push({ ...(sortiert[0].iban ? { iban: sortiert[0].iban } : {}), waehrung, ...(ende ? { saldo: ende } : {}), ...(anfang ? { anfang } : {}), eintraege, hinweise: hinw, pruefung });
  }
  return { ok: true, format: 'camt', ...(version ? { version } : {}), auszuege, hinweise };
}

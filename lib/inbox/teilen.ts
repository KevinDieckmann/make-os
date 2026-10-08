// ─── Inbox teilen — Übergaben, Team-Postfächer, „wer kümmert sich“, Suche (rein, client-sicher, 08.10.2026) ───────────
// ROADMAP_Q4.md › Lücke 6 („Business Couple“, Kevin 08.10.): „Mail nicht übergebbar, keine Inbox-Suche → ‚An <Person> übergeben‘
// (freigegebene Kopie), gemeinsames Postfach je Gesellschaft mit ‚wer kümmert sich‘, Suche über die eigenen Spiegel.“
//
// Grundregel bleibt: eine Person liest NIE die Post der anderen. Geteilt wird nur ausdrücklich per Klick —
//   · Übergabe   eine KOPIE eines eigenen Gesprächs (Köpfe + Texte bis jetzt, Anhänge nur als Liste) an eine Person des Haushalts,
//                die den Bereich des Postfachs sehen darf (Business: jedes Konto des Haushalts; Privat: nur volle Mitglieder).
//                Neue Nachrichten wandern NICHT mit — „Kopie aktualisieren“ macht die übergebende Person.
//   · Team-Postfach  ein IMAP-Postfach mit Business-Bereich, das die einrichtende Person „mit dem Team teilt“. Sichtbar für alle
//                Konten des Haushalts mit Zugang zum Bereich; Zugang (Passwort), Abgleich und Senden bleiben beim Besitzer.
//   · „wer kümmert sich“ je Gespräch eines Team-Postfachs bzw. der WhatsApp-Business-Nummer (die gehört ohnehin der Instanz).
// Diese Datei entscheidet nur (Sicht, Regeln, Grenzen, Suche) — gespeichert und gefiltert wird auf dem Server
// (lib/inbox/teilen-server.ts, uebergaben-*.ts, suche-server.ts). Kein Paket, keine Server-Importe.

import { bereichVon } from '@/lib/einheiten';
import { suchNorm, suchWoerter } from '@/lib/text/such-norm';
import type { Adr } from '@/lib/gmail/typen';
import type { GespraechZustand } from './strom';

// ── Sicht ───────────────────────────────────────────────────────────────────

/** Wer schaut: Speichername + (optional) das eingeschränkte Finanzrecht des Kontos. */
export interface Betrachter { speicher: string; finanzRecht?: 'business' }

/** Raum eines Postfach-Bereichs. Ohne Bereich (Gmail noch ohne Zuordnung) gilt STRENG Privat — nie „aus Versehen Business“. Rein. */
export const raumVon = (bereich: string | null | undefined): 'privat' | 'business' => (bereich ? bereichVon(bereich) : 'privat');

/**
 * Darf diese Person Post aus diesem Bereich sehen? Business: jedes Konto des Haushalts (auch `finanzRecht: 'business'`);
 * Privat: nur volle Mitglieder (ohne `finanzRecht: 'business'`). Die Haushalts-Zugehörigkeit prüft der Server vorher. Rein.
 */
export function bereichZugang(b: Pick<Betrachter, 'finanzRecht'>, bereich: string | null | undefined): boolean {
  return raumVon(bereich) === 'business' || b.finanzRecht !== 'business';
}

/** Kann ein Postfach mit dem Team geteilt werden? Nur IMAP mit Business-Bereich — Gmail bleibt persönlich, WhatsApp gehört der Instanz. */
export const postfachTeilbar = (p: { quelle: string; bereich: string | null }): boolean => p.quelle === 'imap' && raumVon(p.bereich) === 'business';

/**
 * DIE Filterstelle für Team-Postfächer (neben `imBereich` in strom-server.ts): sieht `b` das Postfach von `besitzer`? Das eigene immer;
 * ein fremdes nur, wenn es ausdrücklich geteilt ist, teilbar ist (IMAP + Business) und `b` den Bereich sehen darf. Ein Postfach mit
 * Privat-Bereich bleibt privat — auch wenn im Bestand fälschlich `geteilt` stünde. Rein, getestet.
 */
export function postfachSichtbar(p: { quelle: string; bereich: string | null; geteilt?: boolean }, besitzer: string, b: Betrachter): boolean {
  if (besitzer === b.speicher) return true;
  return p.geteilt === true && postfachTeilbar(p) && bereichZugang(b, p.bereich);
}

// ── Gemeinsamer Zustand eines Team-Gesprächs ───────────────────────────────────

/** „Wer kümmert sich“ — eine Person des Haushalts (Speichername), gesetzt von `von`. */
export interface Kuemmert { person: string; seit: string; von: string }
/** Zustand eines Gesprächs eines Team-Postfachs (bzw. „wer kümmert sich“ bei WhatsApp) — für alle mit Zugang derselbe. */
export interface TeamZustand extends GespraechZustand { kuemmert?: Kuemmert }

/** Was ein Gespräch im Strom zusätzlich trägt, wenn es dem Team gehört (Team-Postfach oder WhatsApp). */
export interface GespraechTeam {
  /** Nur Team-Postfach (IMAP): wessen Zugang abholt und sendet; `eigenes` = die schauende Person ist der Besitzer. */
  postfach?: { besitzer: string; besitzerName: string; eigenes: boolean };
  kuemmert?: { person: string; name: string; seit: string };
  /** Wer sich kümmern kann (Speichername + Vorname) — nur Personen mit Zugang. */
  personen: { speicher: string; name: string }[];
  /** Stand des gemeinsamen Zustands dieses Gesprächs — „wer kümmert sich“ ändern nur mit diesem Stand (sonst 409). */
  stand: string;
}

/** FNV-1a (32 Bit) als Hex — Fingerabdruck für Stände, kein Geheimnis. Rein. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** Stand eines Eintrags (zwei Durchläufe, damit Zufallstreffer praktisch ausgeschlossen sind). Ohne Eintrag „0“. Rein. */
export const standVon = (x: unknown): string => (x === undefined || x === null ? '0' : `${fnv(JSON.stringify(x))}${fnv(`*${JSON.stringify(x)}`)}`);

export const TEAM_GRENZEN = { gespraeche: 5000 } as const;

// ── Übergaben ───────────────────────────────────────────────────────────────

export interface UebergabeAnhang { teil: string; name: string; typ: string; groesse: number }
/** Eine Nachricht der Kopie — Kopf + Text zum Zeitpunkt der Übergabe (bzw. „Kopie aktualisieren“). Nie Anhang-Inhalte. */
export interface UebergabeNachricht {
  id: string;
  am: string;
  von: Adr;
  an: Adr[];
  cc: Adr[];
  antwortAn?: Adr;
  betreff: string;
  text: string;
  vonUns: boolean;
  automatisch?: boolean;
  /** Für eine Antwort im Gespräch (In-Reply-To/References) — die Antwort der Empfängerin läuft über IHR Postfach. */
  messageId?: string;
  references?: string[];
  anhaenge: UebergabeAnhang[];
}

export type UebergabeStatus = 'offen' | 'zurueck' | 'erledigt';
export type UebergabeSchrittArt = 'uebergeben' | 'aktualisiert' | 'zurueck' | 'erledigt' | 'wieder' | 'kuemmert' | 'geantwortet';
export interface UebergabeSchritt { am: string; von: string; was: UebergabeSchrittArt; notiz?: string; wer?: string }

export interface Uebergabe {
  id: string;
  /** Wer übergibt (Besitzer des Original-Postfachs). */
  von: string;
  /** An wen. */
  an: string;
  /** Das Original-Gespräch (Kennung im Spiegel von `von`). */
  gespraech: string;
  quelle: 'gmail' | 'imap';
  postfachId: string;
  /** Bereich des Original-Postfachs — entscheidet, wer die Kopie sehen darf (`bereichZugang`). */
  bereich: string | null;
  betreff: string;
  gegenueber: Adr;
  /** Notiz der übergebenden Person. */
  notiz?: string;
  /** Wer sich kümmert: `an` oder `von`. */
  kuemmert: string;
  status: UebergabeStatus;
  /** Notiz bei „zurück an …“. */
  zurueckNotiz?: string;
  angelegtAm: string;
  kopieAm: string;
  geaendertAm: string;
  erledigtAm?: string;
  nachrichten: UebergabeNachricht[];
  verlauf: UebergabeSchritt[];
}

export const UEBERGABE_GRENZEN = {
  notiz: 2000,
  /** Nachrichten je Kopie — mehr → 413 (nie still gekürzt). */
  nachrichten: 100,
  /** Zeichen aller Texte einer Kopie. */
  textGesamt: 1_000_000,
  /** Offene (nicht erledigte) Übergaben je Haushalt. */
  offen: 300,
  /** Schritte im Verlauf einer Übergabe. */
  verlauf: 200,
  /** Erledigte Übergaben bleiben so lange, dann räumt der nächste Schreibvorgang sie weg (Löschfrist, Speicher-Register). */
  aufbewahrungTage: 90,
} as const;

export class TeilenFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Sieht `b` diese Übergabe? Die übergebende Person immer; die Empfängerin nur, solange sie den Bereich sehen darf. Rein, getestet. */
export function uebergabeSichtbar(u: Pick<Uebergabe, 'von' | 'an' | 'bereich'>, b: Betrachter): boolean {
  if (u.von === b.speicher) return true;
  return u.an === b.speicher && bereichZugang(b, u.bereich);
}

/** Wer eine Übergabe dieses Bereichs bekommen darf (rein): alle anderen Personen des Haushalts mit Zugang zum Bereich. */
export function uebergabeEmpfaenger<P extends Betrachter>(team: readonly P[], von: string, bereich: string | null): P[] {
  return team.filter(p => p.speicher !== von && bereichZugang(p, bereich));
}

/** Notiz säubern (rein): Zeilenumbrüche bleiben, Steuerzeichen weg; zu lang → 413, nie gekürzt. */
export function notizSauber(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const t = String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  if (t.length > UEBERGABE_GRENZEN.notiz) throw new TeilenFehler(`Die Notiz ist zu lang (höchstens ${UEBERGABE_GRENZEN.notiz} Zeichen).`, 413);
  return t || undefined;
}

/** Eine Kopie prüfen (rein): Anzahl und Gesamtlänge — zu groß → 413 mit Satz, nie still gekürzt. */
export function kopiePruefen(n: readonly UebergabeNachricht[]): void {
  if (!n.length) throw new TeilenFehler('Dieses Gespräch hat keine Nachrichten (mehr).', 404);
  if (n.length > UEBERGABE_GRENZEN.nachrichten) throw new TeilenFehler(`Das Gespräch ist zu lang für eine Übergabe (höchstens ${UEBERGABE_GRENZEN.nachrichten} Nachrichten).`, 413);
  const z = n.reduce((s, x) => s + x.text.length, 0);
  if (z > UEBERGABE_GRENZEN.textGesamt) throw new TeilenFehler('Die Texte dieses Gesprächs sind zu lang für eine Übergabe.', 413);
}

const schritt = (u: Uebergabe, s: UebergabeSchritt): UebergabeSchritt[] => {
  if (u.verlauf.length >= UEBERGABE_GRENZEN.verlauf) throw new TeilenFehler('Diese Übergabe hat zu viele Schritte — bitte erledigen und neu übergeben.', 413);
  return [...u.verlauf, s];
};

export type UebergabeAktion =
  | { art: 'zurueck'; notiz?: string }
  | { art: 'erledigt' }
  | { art: 'wieder'; notiz?: string }
  | { art: 'kuemmert'; wer: string }
  | { art: 'aktualisiert'; nachrichten: UebergabeNachricht[] }
  | { art: 'geantwortet' };

/**
 * Eine Aktion auf eine Übergabe anwenden (rein, getestet) — wer darf was:
 *   zurueck      nur die Empfängerin, nur offen → Status „zurück“, die übergebende Person kümmert sich
 *   erledigt     beide (gilt für beide), nicht doppelt
 *   wieder       nur die übergebende Person, nach „zurück“ oder „erledigt“ → wieder offen bei der Empfängerin
 *   kuemmert     beide; nur eine der beiden Personen
 *   aktualisiert nur die übergebende Person (neue Kopie aus ihrem Spiegel)
 *   geantwortet  nur die Empfängerin (Vermerk, kein Text)
 * Fremde Personen → 403; unpassender Status → 409.
 */
export function uebergabeAnwenden(u: Uebergabe, a: UebergabeAktion, person: string, jetzt: string): Uebergabe {
  const beteiligt = person === u.von || person === u.an;
  if (!beteiligt) throw new TeilenFehler('Diese Übergabe gehört dir nicht.', 403);
  const nurVon = () => { if (person !== u.von) throw new TeilenFehler('Das kann nur die Person, die übergeben hat.', 403); };
  const nurAn = () => { if (person !== u.an) throw new TeilenFehler('Das kann nur die Person, an die übergeben wurde.', 403); };
  switch (a.art) {
    case 'zurueck': {
      nurAn();
      if (u.status !== 'offen') throw new TeilenFehler('Diese Übergabe ist nicht mehr offen.', 409);
      const notiz = notizSauber(a.notiz);
      return { ...u, status: 'zurueck', kuemmert: u.von, ...(notiz ? { zurueckNotiz: notiz } : {}), geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'zurueck', ...(notiz ? { notiz } : {}) }) };
    }
    case 'erledigt': {
      if (u.status === 'erledigt') throw new TeilenFehler('Schon erledigt.', 409);
      return { ...u, status: 'erledigt', erledigtAm: jetzt, geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'erledigt' }) };
    }
    case 'wieder': {
      nurVon();
      if (u.status === 'offen') throw new TeilenFehler('Diese Übergabe ist schon offen.', 409);
      const notiz = notizSauber(a.notiz);
      const { erledigtAm: _e, zurueckNotiz: _z, ...rest } = u;
      return { ...rest, status: 'offen', kuemmert: u.an, ...(notiz ? { notiz } : u.notiz ? { notiz: u.notiz } : {}), geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'wieder', ...(notiz ? { notiz } : {}) }) };
    }
    case 'kuemmert': {
      if (a.wer !== u.von && a.wer !== u.an) throw new TeilenFehler('Kümmern kann sich nur eine der beiden Personen.', 400);
      if (u.status === 'erledigt') throw new TeilenFehler('Diese Übergabe ist erledigt.', 409);
      return { ...u, kuemmert: a.wer, geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'kuemmert', wer: a.wer }) };
    }
    case 'aktualisiert': {
      nurVon();
      kopiePruefen(a.nachrichten);
      return { ...u, nachrichten: a.nachrichten, kopieAm: jetzt, geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'aktualisiert' }) };
    }
    case 'geantwortet': {
      nurAn();
      return { ...u, geaendertAm: jetzt, verlauf: schritt(u, { am: jetzt, von: person, was: 'geantwortet' }) };
    }
  }
}

/** Erledigte Übergaben nach der Aufbewahrung entfernen (rein). */
export function uebergabenAufbewahren(liste: readonly Uebergabe[], jetzt: Date): Uebergabe[] {
  const grenze = jetzt.getTime() - UEBERGABE_GRENZEN.aufbewahrungTage * 86_400_000;
  return liste.filter(u => !(u.status === 'erledigt' && u.erledigtAm && Date.parse(u.erledigtAm) < grenze));
}

/** Was die Liste einer Person zeigt — ohne Texte (die holt die Ansicht). */
export interface UebergabeZeile {
  id: string;
  rolle: 'erhalten' | 'gegeben';
  von: string; vonName: string; an: string; anName: string;
  gespraech: string; quelle: 'gmail' | 'imap'; bereich: string | null;
  betreff: string; gegenueber: Adr; notiz?: string; zurueckNotiz?: string;
  kuemmert: string; kuemmertName: string;
  status: UebergabeStatus;
  angelegtAm: string; kopieAm: string; geaendertAm: string;
  anzahl: number; ausschnitt: string; anhaenge: number;
  /** Eine neuere Nachricht kam seit der Kopie — nur für die übergebende Person (aus ihrem Spiegel). */
  neuer?: boolean;
  stand: string;
}

/** Zeile für eine Person (rein). `namen`: Speichername → Vorname. */
export function uebergabeZeile(u: Uebergabe, person: string, namen: Readonly<Record<string, string>>): UebergabeZeile {
  const letzte = u.nachrichten[u.nachrichten.length - 1];
  const name = (p: string) => namen[p] ?? p;
  return {
    id: u.id, rolle: u.von === person ? 'gegeben' : 'erhalten', von: u.von, vonName: name(u.von), an: u.an, anName: name(u.an),
    gespraech: u.gespraech, quelle: u.quelle, bereich: u.bereich, betreff: u.betreff, gegenueber: u.gegenueber,
    ...(u.notiz ? { notiz: u.notiz } : {}), ...(u.zurueckNotiz ? { zurueckNotiz: u.zurueckNotiz } : {}),
    kuemmert: u.kuemmert, kuemmertName: name(u.kuemmert), status: u.status,
    angelegtAm: u.angelegtAm, kopieAm: u.kopieAm, geaendertAm: u.geaendertAm,
    anzahl: u.nachrichten.length, ausschnitt: (letzte?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
    anhaenge: u.nachrichten.reduce((s, n) => s + n.anhaenge.length, 0),
    stand: standVon(u),
  };
}

/** Die Nachricht, auf die eine Antwort der Empfängerin sich bezieht: die jüngste echte von außen (sonst die jüngste). Rein. */
export function antwortBezugAus(u: Pick<Uebergabe, 'nachrichten' | 'betreff'>): { messageId?: string; references?: string[]; betreff: string; empfaenger: Adr[] } {
  const n = [...u.nachrichten].reverse().find(x => !x.vonUns && !x.automatisch) ?? u.nachrichten[u.nachrichten.length - 1];
  const empfaenger = n ? (n.vonUns ? n.an.slice(0, 1) : [n.antwortAn ?? n.von]) : [];
  return { ...(n?.messageId ? { messageId: n.messageId } : {}), ...(n?.references?.length ? { references: n.references } : {}), betreff: n?.betreff || u.betreff, empfaenger };
}

// ── Suche: Treffer, Ausschnitt, Hervorhebung (EINE Such-Regel: lib/text/such-norm.ts) ──────────────────────────────

export const SUCHE_GRENZEN = { seite: 40, frageMax: 120, ausschnitt: 180 } as const;

/** Text in Suchform — mit der Stelle im (NFC-)Original je Zeichen der Suchform. Rein. */
function normMitIndex(text: string): { t: string; n: string; idx: number[] } {
  const t = String(text ?? '').normalize('NFC');
  let n = '';
  const idx: number[] = [];
  let i = 0;
  for (const ch of t) {
    const x = suchNorm(ch);
    for (let k = 0; k < x.length; k++) { n += x[k]; idx.push(i); }
    i += ch.length;
  }
  idx.push(t.length);
  return { t, n, idx };
}

/** Bereiche im Original, die ein Suchwort treffen (sortiert, verschmolzen). Rein. */
function trefferBereiche(text: string, frage: string, max = 50): { t: string; bereiche: [number, number][] } {
  const { t, n, idx } = normMitIndex(text);
  const roh: [number, number][] = [];
  for (const w of suchWoerter(frage)) {
    let p = n.indexOf(w);
    while (p >= 0 && roh.length < max) {
      const start = idx[p];
      let q = p + w.length;
      while (q < idx.length - 1 && idx[q] === idx[p + w.length - 1]) q++;
      roh.push([start, idx[q]]);
      p = n.indexOf(w, p + w.length);
    }
  }
  roh.sort((a, b) => a[0] - b[0]);
  const bereiche: [number, number][] = [];
  for (const b of roh) { const l = bereiche[bereiche.length - 1]; if (l && b[0] <= l[1]) l[1] = Math.max(l[1], b[1]); else bereiche.push([b[0], b[1]]); }
  return { t, bereiche };
}

/** Teile eines Textes mit Markierung der Suchwörter (für die Hervorhebung, rein, getestet). */
export function markieren(text: string, frage: string): { t: string; an: boolean }[] {
  const { t, bereiche } = trefferBereiche(text, frage);
  if (!bereiche.length) return t ? [{ t, an: false }] : [];
  const raus: { t: string; an: boolean }[] = [];
  let i = 0;
  for (const [a, b] of bereiche) { if (a > i) raus.push({ t: t.slice(i, a), an: false }); raus.push({ t: t.slice(a, b), an: true }); i = b; }
  if (i < t.length) raus.push({ t: t.slice(i), an: false });
  return raus;
}

/** Ein Ausschnitt um den ersten Treffer (Leerraum zusammengezogen), höchstens `breite` Zeichen, mit „…“. Rein. */
export function ausschnittUm(text: string, frage: string, breite: number = SUCHE_GRENZEN.ausschnitt): string {
  const flach = String(text ?? '').replace(/\s+/g, ' ').trim();
  const { t, bereiche } = trefferBereiche(flach, frage, 1);
  if (t.length <= breite) return t;
  const mitte = bereiche[0]?.[0] ?? 0;
  const a = Math.max(0, Math.min(t.length - breite, mitte - Math.floor(breite / 3)));
  return `${a > 0 ? '… ' : ''}${t.slice(a, a + breite).trim()}${a + breite < t.length ? ' …' : ''}`;
}

/** Eine Nachricht für die Suche (Kopf + Text). */
export interface SuchNachricht { betreff: string; von: Adr; an: Adr[]; cc: Adr[]; text: string }
export type TrefferOrt = 'betreff' | 'absender' | 'empfaenger' | 'text';

const adrText = (l: readonly Adr[]) => l.map(a => `${a.name ?? ''} ${a.email}`).join(' ');

/**
 * Passt eine Nachricht? Alle Suchwörter müssen in Betreff, Absender, Empfängern oder Text derselben Nachricht stehen (EINE Regel:
 * `suchPasst`-Logik über suchNorm). Liefert den Ort des ersten Treffers und den Ausschnitt — oder null. Rein, getestet.
 */
export function nachrichtTreffer(n: SuchNachricht, frage: string): { wo: TrefferOrt; ausschnitt: string } | null {
  const w = suchWoerter(frage);
  if (!w.length) return null;
  const felder: [TrefferOrt, string][] = [['betreff', n.betreff], ['absender', `${n.von.name ?? ''} ${n.von.email}`], ['empfaenger', adrText([...n.an, ...n.cc])], ['text', n.text]];
  const alle = suchNorm(felder.map(f => f[1]).join(' '));
  if (!w.every(x => alle.includes(x))) return null;
  const ort = felder.find(([, t]) => w.some(x => suchNorm(t).includes(x)))!;
  // Der Ausschnitt zeigt den Text, wenn er trifft (Zusammenhang), sonst das Feld selbst.
  const imText = w.some(x => suchNorm(n.text).includes(x));
  return { wo: ort[0], ausschnitt: imText ? ausschnittUm(n.text, frage) : ausschnittUm(ort[1], frage) };
}

/** Suchbegriff säubern (rein): leer/zu kurz → null; zu lang → 400 (nie gekürzt). */
export function frageSauber(v: unknown): string | null {
  const t = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > SUCHE_GRENZEN.frageMax) throw new TeilenFehler(`Der Suchbegriff ist zu lang (höchstens ${SUCHE_GRENZEN.frageMax} Zeichen).`, 400);
  return suchNorm(t).replace(/\s/g, '').length >= 2 ? t : null;
}

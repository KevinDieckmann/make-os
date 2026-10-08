// ─── Das Anbieter-Tor: EINE Prüfung je KI-Aufruf über alle Anbieter (09.10.2026, Paket 6a) — Server ─────────────────────────
// Kevin 08.10. (Antwort 24): „EIN Anbieter-Tor, Rückfall nie in schwächeren Datenschutz.“ Es liegt NEBEN askText in lib/anthropic.ts,
// das unverändert nutzbar bleibt, und baut auf dem KI-Tor (lib/datenschutz/ki-tor.ts) auf — Reihenfolge je Aufruf:
//
//   1. KI-Tor wie bisher: Hintergrund-KI, Bereiche, Gesundheits-Einwilligung (b), Web-Suche, Pseudonymisierung
//   2. Fähigkeit eingeschaltet? (Text immer; Bild/Video/Tiefenbericht/Transkription nur, wenn der Inhaber sie einschaltet)
//   3. Anbieter wählen (lib/ki/anbieter.ts `anbieterWaehlen`): Mindeststufe je Kategorie (Gesundheit nur EU + ZDR), Rückfall nie schwächer,
//      eingerichtet, im Empfänger-Register nicht archiviert, AVV bestätigt (neue Anbieter immer; Anthropic direkt im Modus „streng“)
//   4. Kosten: Grenze je Auftrag, Monatsbudget (Vorgabe: kein Budget — „erster Monat nur messen“); bei 100 % gesperrt + EINE Glocke im Monat
//      (die Läufe fallen auf ihr Regelwerk zurück — `kiGesperrt`)
//   5. Klick: Video und Tiefenbericht nur mit bestätigter Schätzung (die Oberfläche zeigt `kostenSchaetzen`, der Klick schickt den Betrag)
//
// Gesperrt → `{ ok: false, grund }`; die Aufrufer melden `ki-gesperrt:<grund>` (Text: `kiSperrText` in lib/anthropic.ts). Jede
// Entscheidung (auch gesperrt) bekommt eine Zeile im KI-Protokoll — das schreiben die Aufrufer (askText bzw. lib/ki/aufruf.ts).

import type { KiKontext } from '@/lib/datenschutz/ki-tor';
import type { KiLauf } from '@/lib/datenschutz/ki-lauf';
import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';
import { anbieterVon, anbieterWaehlen, KI_ANBIETER, type AnbieterId, type AnbieterZustand, type DatenschutzStufe, type Faehigkeit } from './anbieter';
import { anbieterEingerichtet, torModus, zdrBestaetigt } from './konfig';
import { NUR_MIT_KLICK, usdEurKurs, inEuroCent, euroText, type Schaetzung } from './kosten';
import type { Empfaenger } from '@/lib/datenschutz/einrichtung';

export type AnbieterTorEntscheid =
  | { ok: true; lauf: KiLauf; person: string | null; websuche: boolean; pseudonym: boolean; anbieter: AnbieterId; stufe: DatenschutzStufe; region: string; rueckfall: boolean }
  | { ok: false; lauf: KiLauf; person: string | null; grund: string; schaetzung?: Schaetzung };

/** Vorgabe der Grenze je Auftrag (Medien) in Euro-Cent — ANNAHME 10 €, je Instanz einstellbar (Einstellung bzw. MAKE_OS_KI_GRENZE_AUFTRAG_EURO). */
export const GRENZE_AUFTRAG_VORGABE_CENT = 1000;

/**
 * Instanz-Budget in Euro (Kevin 08.10. „Budget-Balken“; Koordination 09.10.: Test-Budget von 50 €): EINE Grenze für die ganze Instanz je
 * Kalendermonat (Berlin) — Inhaber-Einstellung (`ki-einstellungen` › instanz.budget.monatEuroCent) vor Umgebung (`MAKE_OS_KI_BUDGET_MONAT_EURO`,
 * gleichbedeutend `MAKE_OS_KI_BUDGET_EURO`). Ohne beides: kein Budget, nur messen. Gezählt wird ALLES aus der Kostenmessung (lib/zoe/verbrauch.ts:
 * Text über askText — auch ohne Anbieter-Tor —, Bilder, Video, Tiefenbericht, Transkription), umgerechnet mit dem Kurs der Instanz.
 * Warnungen bei 80 % und 95 % an die Glocke des Inhabers; bei 100 % ruft kein Weg mehr ein Modell auf (`ki-gesperrt:budget` → die Läufe
 * nehmen ihr Regelwerk) + Glocke. Zusätzlich gilt die Grenze je Auftrag (Medien). Jede Stufe meldet sich höchstens einmal im Monat.
 */
export interface BudgetStand { monatGrenzeCent: number | null; verbrauchtCent: number; auftragGrenzeCent: number; quelle: 'einstellung' | 'umgebung' | null }
export const BUDGET_WARNSTUFEN = [80, 95, 100] as const;
export type BudgetStufe = 0 | (typeof BUDGET_WARNSTUFEN)[number];
export interface BudgetLage { verbrauchtCent: number; grenzeCent: number | null; prozent: number | null; stufe: BudgetStufe; text: string }

/** Die Lage für Budget-Balken und Glocke (rein): Verbrauch, Grenze, Prozent, erreichte Warnstufe. */
export function budgetLage(b: Pick<BudgetStand, 'monatGrenzeCent' | 'verbrauchtCent'>): BudgetLage {
  const verbraucht = Math.max(0, b.verbrauchtCent);
  if (b.monatGrenzeCent === null) return { verbrauchtCent: verbraucht, grenzeCent: null, prozent: null, stufe: 0, text: `${euroText(verbraucht)} in diesem Monat (kein Budget — nur gemessen)` };
  const grenze = Math.max(0, b.monatGrenzeCent);
  const prozent = grenze > 0 ? (verbraucht / grenze) * 100 : 100;
  const stufe: BudgetStufe = prozent >= 100 ? 100 : prozent >= 95 ? 95 : prozent >= 80 ? 80 : 0;
  return { verbrauchtCent: verbraucht, grenzeCent: grenze, prozent, stufe, text: `${euroText(verbraucht)} von ${euroText(grenze)} (${Math.floor(prozent)} %)` };
}

/** Kosten und Klick prüfen (rein). Ohne Schätzung (Text) zählt nur das Monatsbudget. */
export function kostenPruefen(e: { budget: Pick<BudgetStand, 'monatGrenzeCent' | 'verbrauchtCent' | 'auftragGrenzeCent'>; faehigkeit: Faehigkeit; schaetzung?: Schaetzung; bestaetigtCent?: number }): string | null {
  const { budget: b, schaetzung: s } = e;
  if (b.monatGrenzeCent !== null && b.verbrauchtCent >= b.monatGrenzeCent) return 'budget';
  if (s) {
    if (s.euroCent > b.auftragGrenzeCent) return 'grenze-auftrag';
    if (b.monatGrenzeCent !== null && b.verbrauchtCent + s.euroCent > b.monatGrenzeCent) return 'budget';
  }
  if (NUR_MIT_KLICK.includes(e.faehigkeit)) {
    if (!s) return 'kosten-rueckfrage';
    // Der Klick bestätigt einen Betrag; wird es teurer (neue Schätzung), fragt das Tor erneut. Rundung auf ganze Cent.
    if (typeof e.bestaetigtCent !== 'number' || !Number.isFinite(e.bestaetigtCent) || Math.round(s.euroCent) > Math.round(e.bestaetigtCent)) return 'kosten-rueckfrage';
  }
  return null;
}

/** Register-Zustand eines Zugangs aus der wirksamen Empfänger-Liste (rein). */
export function registerZustand(liste: readonly Empfaenger[], empfaengerId: string): AnbieterZustand['register'] {
  const e = liste.find(x => x.id === empfaengerId);
  if (!e) return 'fehlt';
  if (e.archiviert) return 'archiviert';
  return e.avv.status === 'bestaetigt' || e.avv.status === 'nicht-noetig' ? 'bestaetigt' : 'avv-offen';
}

/** Zustand aller Zugänge in dieser Instanz (Umgebung + Register). */
export async function anbieterZustaende(): Promise<Partial<Record<AnbieterId, AnbieterZustand>>> {
  const { empfaengerLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const liste = await empfaengerLaden();
  return Object.fromEntries(KI_ANBIETER.map(a => [a.id, { eingerichtet: anbieterEingerichtet(a.id), zdr: zdrBestaetigt(a.id), register: registerZustand(liste, a.empfaengerId) }]));
}

/** Ist die Fähigkeit in dieser Instanz eingeschaltet? Text immer; die neuen nur durch den Inhaber (Vorgabe aus). */
export async function faehigkeitAn(f: Faehigkeit): Promise<boolean> {
  if (f === 'text') return true;
  const { ladeKiEinstellungen } = await import('@/lib/datenschutz/ki-einstellungen');
  const d = await ladeKiEinstellungen();
  if (d.instanz?.medien?.[f] !== true) return false;
  if (f === 'transkript') { const { transkriptionAn } = await import('@/lib/crm/netzwerken-karte'); return transkriptionAn(); }
  return true;
}

const euroAusUmgebung = (v: string | undefined): number | null => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && String(v ?? '').trim() !== '' ? Math.round(n * 100) : null;
};

/** Nur die Grenzen (ohne Verbrauch zu lesen) — billig; askText ohne Anbieter-Tor fragt damit, ob überhaupt ein Budget gilt. */
export async function budgetGrenzen(env: Record<string, string | undefined> = process.env): Promise<Pick<BudgetStand, 'monatGrenzeCent' | 'auftragGrenzeCent' | 'quelle'>> {
  const { ladeKiEinstellungen } = await import('@/lib/datenschutz/ki-einstellungen');
  const b = (await ladeKiEinstellungen()).instanz?.budget ?? {};
  const umgebung = euroAusUmgebung(env.MAKE_OS_KI_BUDGET_MONAT_EURO) ?? euroAusUmgebung(env.MAKE_OS_KI_BUDGET_EURO);
  const monat = typeof b.monatEuroCent === 'number' ? b.monatEuroCent : umgebung;
  const auftrag = typeof b.auftragEuroCent === 'number' ? b.auftragEuroCent : euroAusUmgebung(env.MAKE_OS_KI_GRENZE_AUFTRAG_EURO) ?? GRENZE_AUFTRAG_VORGABE_CENT;
  return { monatGrenzeCent: monat, auftragGrenzeCent: auftrag, quelle: typeof b.monatEuroCent === 'number' ? 'einstellung' : umgebung !== null ? 'umgebung' : null };
}

/** Budget-Stand (Server): Grenzen + Verbrauch des laufenden Monats in Euro-Cent. Für den Budget-Balken: `budgetLage(await budgetStand())`. */
export async function budgetStand(): Promise<BudgetStand> {
  const { monatUsdCent } = await import('@/lib/zoe/verbrauch');
  return { ...(await budgetGrenzen()), verbrauchtCent: inEuroCent(await monatUsdCent().catch(() => 0), usdEurKurs()) };
}

const MELDUNG: Record<Exclude<BudgetStufe, 0>, string> = {
  80: 'Das KI-Budget des Monats ist zu 80 % verbraucht',
  95: 'Das KI-Budget des Monats ist zu 95 % verbraucht — bald nutzen automatische Läufe ihr Regelwerk',
  100: 'Das KI-Budget des Monats ist erreicht — es wird kein Modell mehr aufgerufen, automatische Läufe nutzen ihr Regelwerk',
};

/** Die erreichte Warnstufe EINMAL je Monat an die Glocke des Inhabers (neutral, ohne Beträge). Wirft nie. */
export async function budgetMelden(stufe: BudgetStufe, jetzt = new Date()): Promise<boolean> {
  if (!stufe) return false;
  try {
    const [{ updateJson }, { inhaberSpeicher }, { melde }, { WEG }] = await Promise.all([
      import('@/lib/store/local-db'), import('@/lib/zugang/haushalt-inhaber'), import('@/lib/meldungen/melden'), import('@/lib/wege'),
    ]);
    const monat = jetzt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 7);
    let neu = false;
    await updateJson<{ budgetMeldungen?: { monat: string; stufen: number[] } }>('ki-stand', cur => {
      const m = cur?.budgetMeldungen?.monat === monat ? cur.budgetMeldungen : { monat, stufen: [] };
      if (m.stufen.includes(stufe)) return cur ?? {};
      neu = true;
      return { ...(cur ?? {}), budgetMeldungen: { monat, stufen: [...m.stufen, stufe] } };
    });
    const an = neu ? await inhaberSpeicher() : null;
    if (an) await melde({ an, art: 'zoe', titel: MELDUNG[stufe], link: WEG.datenschutz('ki') });
    return neu;
  } catch { return false; /* die Glocke darf nie einen Lauf aufhalten */ }
}

/**
 * Für askText OHNE Anbieter-Tor (lib/anthropic.ts): gilt ein Instanz-Budget und ist es erreicht? Ohne Budget kein weiterer Lesezugriff —
 * der Weg bleibt dann wie vor dem Paket. Meldet 80/95/100 % an die Glocke.
 */
export async function budgetSperre(): Promise<'budget' | null> {
  const g = await budgetGrenzen().catch(() => null);
  if (!g || g.monatGrenzeCent === null) return null;
  const { monatUsdCent } = await import('@/lib/zoe/verbrauch');
  const lage = budgetLage({ monatGrenzeCent: g.monatGrenzeCent, verbrauchtCent: inEuroCent(await monatUsdCent().catch(() => 0), usdEurKurs()) });
  if (lage.stufe) void budgetMelden(lage.stufe);
  return lage.stufe === 100 ? 'budget' : null;
}

/**
 * Ist für diese Kategorien überhaupt ein Text-Zugang erlaubt? Für Prompt-Bauer, die besondere Daten nur dann HINEINNEHMEN, wenn sie
 * hinaus dürfen (Gesundheit: lib/datenschutz/gesundheit-einwilligung.ts `gesundheitAnKi`; Privat-Finanzen: ZOE-Gespräch, Morgenlauf,
 * Empfang) — ohne Tor wie bisher ja.
 */
export async function kategorienMoeglich(kategorien: readonly KiKategorie[]): Promise<boolean> {
  const modus = torModus();
  if (modus === 'aus') return true;
  return anbieterWaehlen({ faehigkeit: 'text', kategorien, zustand: await anbieterZustaende(), streng: modus === 'streng' }).ok;
}

/**
 * Das Tor. `bestaetigtCent` = der Betrag, den die Person per Klick bestätigt hat (nur Video/Tiefenbericht). `ausgefallen` = Zugänge,
 * die in diesem Auftrag schon gescheitert sind (die nächste erlaubte Wahl, nie schwächer).
 */
export async function anbieterTor(e: {
  faehigkeit: Faehigkeit;
  ki: KiKontext | undefined;
  webGewuenscht?: boolean;
  schaetzung?: Schaetzung;
  bestaetigtCent?: number;
  ausgefallen?: readonly AnbieterId[];
}): Promise<AnbieterTorEntscheid> {
  const { kiTor } = await import('@/lib/datenschutz/ki-tor');
  const t = await kiTor(e.ki, !!e.webGewuenscht);
  if (!t.ok) return t;
  const basis = { lauf: t.lauf, person: t.person };
  if (!(await faehigkeitAn(e.faehigkeit))) return { ...basis, ok: false, grund: 'faehigkeit-aus' };
  const kategorien = e.ki?.kategorien?.length ? e.ki.kategorien : ['allgemein' as const];
  const w = anbieterWaehlen({ faehigkeit: e.faehigkeit, kategorien, zustand: await anbieterZustaende(), streng: torModus() === 'streng', ausgefallen: e.ausgefallen });
  if (!w.ok) return { ...basis, ok: false, grund: w.grund };
  // Ohne Instanz-Budget wird der Verbrauch nicht gelesen (nur messen) — die Grenze je Auftrag gilt trotzdem.
  const grenzen = await budgetGrenzen();
  const budget: BudgetStand = grenzen.monatGrenzeCent === null ? { ...grenzen, verbrauchtCent: 0 } : await budgetStand();
  const lage = budgetLage(budget);
  if (lage.stufe) void budgetMelden(lage.stufe);
  const k = kostenPruefen({ budget, faehigkeit: e.faehigkeit, schaetzung: e.schaetzung, bestaetigtCent: e.bestaetigtCent });
  // Sprengt nur die Schätzung den Rest des Budgets, wird dieser Auftrag abgelehnt (`budget`), die Glocke meldet aber nicht „erreicht“.
  if (k) {
    return { ...basis, ok: false, grund: k, ...(e.schaetzung ? { schaetzung: e.schaetzung } : {}) };
  }
  return { ...basis, ok: true, websuche: t.websuche, pseudonym: t.pseudonym, anbieter: w.anbieter, stufe: w.stufe, region: anbieterVon(w.anbieter).region, rueckfall: w.rueckfall };
}

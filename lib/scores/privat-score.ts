// ─── Privat-Score (21.10., E4) — rein, client- und server-sicher ────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: „Am Ende müssen wir Privat wie auch im Business einen Score haben, der alles zusammenbringt, dann haben wir es sauber.“ Der
// Wachstums-Score (Privat und Business gemischt) fällt weg — es gibt nur noch zwei Scores: den Business-Score (= Business-Index, Gesamtsicht,
// lib/business) und diesen Privat-Score JE PERSON:
//
//   Gesundheit                 — der EIGENE Gesundheits-Index (lib/gesundheit), nur mit Einwilligung (a) der Person; ohne sie zählt die Säule nicht
//   Finanzen privat            — der Privat-Index des Haushalts (lib/privat)
//   Planung                    — die eigenen offenen Aufgaben im Privat-Bereich (wie die Planungs-Säule des früheren Wachstums-Scores)
//   Familie & Partnerschaft    — der Pflege-Rhythmus des Paares (lib/familie)
//
// Gewichte (E4): der frühere Wachstums-Score ohne Business und Agenten — Gesundheit 35 · Finanzen 15 · Planung 10 · Familie 10, auf 100 %
// gerechnet (≈ 50 · 21 · 14 · 14). Sie stehen als Daten hier (`PRIVAT_SCORE_GEWICHTE`) und lassen sich je Aufruf ersetzen (später einstellbar).
// Gerechnet NUR über den gemeinsamen Kern (lib/kennzahlen/kern.ts `berechneModell`) — keine eigene Punkte-Logik. Eine Säule, die es für die
// Person gar nicht geben kann (keine Einwilligung, kein Haushalt, Ausnahmezeit der Familie), trägt `nurMitMessung`: sie fällt dann ganz heraus.
// Alles andere ohne Wert ist eine Messlücke — nie eine Null.
//
// „Eine Wahrheit“: die Säulen Gesundheit, Finanzen privat und Familie tragen GENAU die Zahl ihres Index (eine Kennzahl, `direkt`), die Teile
// dahinter stehen als Punkte mit Weg dorthin. Die Planung misst vier Kennzahlen mit Schwellen.

import { berechneModell, indexStatus, type Detail, type IndexErgebnis, type KennzahlDefBasis, type Messung, type SaeuleDef, type Schwelle } from '@/lib/kennzahlen/kern';
import { WEG } from '@/lib/wege';

export type PrivatScoreSaeule = 'ge' | 'fi' | 'pl' | 'fa';
export const PRIVAT_SCORE_SAEULEN_IDS: readonly PrivatScoreSaeule[] = ['ge', 'fi', 'pl', 'fa'];

/** Gewichte als Daten (E4, Kevin 21.10.): relativ — der Kern rechnet mit dem Anteil. Später je Instanz/Person einstellbar. */
export const PRIVAT_SCORE_GEWICHTE: Readonly<Record<PrivatScoreSaeule, number>> = { ge: 35, fi: 15, pl: 10, fa: 10 };

/** Speicherbasis je Person (immer mit Suffix: `privat-score--<speicher>`, lib/datenschutz/konto-daten.ts). */
export const PRIVAT_SCORE_BASIS = 'privat-score';
export const PRIVAT_SCORE_SCOPE = 'privat-score';
export { PRIVAT_SCORE_GESUNDHEIT } from './sicht';

/** Ein Index als Quelle einer Säule: seine Zahl, sein Status-Satz und die Säulen dahinter (nur Zahlen und Namen). */
export interface QuellIndex {
  index: number | null;
  label: string;
  /** Der Status-Satz des Index (lib/kennzahlen/kern.ts `indexStatus`) — steht als Quelle bzw. Lücke an der Kennzahl. */
  satz: string;
  teile: { id: string; label: string; score: number | null; zuDuenn?: boolean }[];
  /** Größter Hebel dort (Kennzahl · Säule), nur als Name. */
  hebel?: string | null;
}

/** Quelle aus einem Index-Ergebnis (Gesundheits-, Privat-Index). */
export function quelleAus(pi: Pick<IndexErgebnis, 'index' | 'label' | 'abdeckung' | 'luecken' | 'saeulen' | 'hebel'> & Partial<Pick<IndexErgebnis, 'teil' | 'vorlaeufig'>>): QuellIndex {
  return {
    index: pi.index, label: pi.label, satz: indexStatus(pi).satz,
    teile: pi.saeulen.filter(s => s.gewicht > 0).map(s => ({ id: s.id, label: s.label, score: s.score, ...(s.zuDuenn ? { zuDuenn: true } : {}) })),
    hebel: pi.hebel ? `${pi.hebel.label} (${pi.hebel.saeule})` : null,
  };
}

/** Die eigene Aufgabenlage im Privat-Bereich (nur Zahlen, Titel nur für die Punkte der eigenen Ansicht). */
export interface PlanungsLage {
  offen: number;
  ueberfaellig: number;
  kritisch: number;
  /** In den letzten 7 Tagen erledigt (Server-Zeit `completedAt`). */
  erledigt7: number;
  /** Höchstens drei Beispiele je Art — nur eigene Aufgaben der Person. */
  beispiele?: { ueberfaellig?: { id: string; titel: string; faellig?: string }[]; kritisch?: { id: string; titel: string }[] };
}

export interface PrivatScoreBestand {
  heute: string;
  /** `erlaubt` = Einwilligung (a) der Person; ohne sie gibt es keine Werte und die Säule zählt nicht. */
  gesundheit: { erlaubt: boolean; quelle: QuellIndex | null };
  /** `haushalt` = die Person gehört zu einem Haushalt mit vollem Zugang (sonst zählt die Säule nicht). `frisch` = Buchungen ≤ 45 Tage. */
  finanzen: { haushalt: boolean; quelle: QuellIndex | null; frisch: boolean };
  /** Pflege-Rhythmus des Paares (lib/familie/logik.ts) — `stufe: 'pause'` = Ausnahmezeit, die Säule zählt nicht. */
  familie: { haushalt: boolean; rhythmus: { score: number | null; stufe: string; hinweis: string; bausteine: { id: string; titel: string; gewicht: number; wert: number; text: string }[] } | null };
  /** null = keine eigenen privaten Aufgaben (Lücke). */
  planung: PlanungsLage | null;
  schwellen?: Record<string, Schwelle>;
  /** Eigene Gewichte (später einstellbar) — fehlt eine, gilt die Vorgabe. */
  gewichte?: Partial<Record<PrivatScoreSaeule, number>>;
}

export type PrivatScore = IndexErgebnis;

const SAEULE_TEXT: Record<PrivatScoreSaeule, { label: string; satz: string }> = {
  ge: { label: 'Gesundheit', satz: 'Dein Gesundheits-Index — Erholung & Schlaf, Bewegung & Aufbau, Ernährung & Körper' },
  fi: { label: 'Finanzen privat', satz: 'Der Privat-Index des Haushalts — Reserve, Ausgaben, Vermögen und Schulden' },
  pl: { label: 'Planung', satz: 'Deine offenen Aufgaben im Privat-Bereich — nichts überfällig, Last tragbar, es geht voran' },
  fa: { label: 'Familie & Partnerschaft', satz: 'Der Pflege-Rhythmus des Paares über 28 Tage — gemeinsame Rhythmen, nie eine Person' },
};

/** Die Gewichte als Anteile (Summe 1) — eigene Werte ersetzen die Vorgabe; ungültige fallen auf die Vorgabe zurück. */
export function privatScoreGewichte(eigen?: Partial<Record<PrivatScoreSaeule, number>>): Record<PrivatScoreSaeule, number> {
  const roh = Object.fromEntries(PRIVAT_SCORE_SAEULEN_IDS.map(id => {
    const w = eigen?.[id];
    return [id, typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : PRIVAT_SCORE_GEWICHTE[id]];
  })) as Record<PrivatScoreSaeule, number>;
  const summe = PRIVAT_SCORE_SAEULEN_IDS.reduce((a, id) => a + roh[id], 0) || 1;
  return Object.fromEntries(PRIVAT_SCORE_SAEULEN_IDS.map(id => [id, roh[id] / summe])) as Record<PrivatScoreSaeule, number>;
}

/** Säulen der Person: eine Säule, die es für sie gar nicht geben kann, zählt nur mit Messung (fällt sonst ganz heraus). */
export function privatScoreSaeulen(b: Pick<PrivatScoreBestand, 'gesundheit' | 'finanzen' | 'familie' | 'gewichte'>): SaeuleDef[] {
  const g = privatScoreGewichte(b.gewichte);
  const strukturellAus: Record<PrivatScoreSaeule, boolean> = {
    ge: !b.gesundheit.erlaubt,
    fi: !b.finanzen.haushalt,
    pl: false,
    fa: !b.familie.haushalt || b.familie.rhythmus?.stufe === 'pause',
  };
  return PRIVAT_SCORE_SAEULEN_IDS.map(id => ({ id, label: SAEULE_TEXT[id].label, gewicht: g[id], satz: SAEULE_TEXT[id].satz, ...(strukturellAus[id] ? { nurMitMessung: true } : {}) }));
}

const GESUNDHEIT_WEG = { text: 'Gesundheits-Index öffnen', href: WEG.gesundheit('index') };
const FINANZEN_WEG = { text: 'Privat-Index öffnen', href: WEG.privatIndex() };
const FAMILIE_WEG = { text: 'Familie öffnen', href: WEG.familie() };
const AUFGABEN_WEG = { text: 'Aufgaben öffnen', href: WEG.aufgaben({ space: 'privat' }) };

export const PRIVAT_SCORE_KENNZAHLEN: KennzahlDefBasis[] = [
  { id: 'ps_gesundheit', label: 'Gesundheits-Index', saeule: 'ge', gruppe: 'Gesundheit', einheit: 'punkte', richtung: 'hoch', gruen: 80, rot: 40, direkt: true,
    formel: 'Dein Gesundheits-Index — dieselbe Zahl wie unter Gesundheit › Index', quelle: 'Gesundheits-Index der Person (nur mit Einwilligung)',
    luecke: 'Der Gesundheits-Index hat noch keine Zahl', pflegen: GESUNDHEIT_WEG },
  { id: 'ps_finanzen', label: 'Privat-Index', saeule: 'fi', gruppe: 'Finanzen', einheit: 'punkte', richtung: 'hoch', gruen: 80, rot: 40, direkt: true,
    formel: 'Der Privat-Index des Haushalts — dieselbe Zahl wie unter Finanzen › Privat', quelle: 'Privat-Index (Buchungen höchstens 45 Tage alt)',
    luecke: 'Der Privat-Index hat noch keine Zahl', pflegen: FINANZEN_WEG },
  { id: 'ps_ueberfaellig', label: 'Überfällige Aufgaben', saeule: 'pl', gruppe: 'Aufgaben', gewicht: 1.5, einheit: 'prozent', richtung: 'niedrig', gruen: 0, rot: 25,
    formel: 'Anteil überfälliger an deinen offenen Aufgaben im Privat-Bereich', quelle: 'Aufgaben (verantwortlich oder beteiligt, Privat-Bereich)',
    luecke: 'Keine offenen privaten Aufgaben', pflegen: AUFGABEN_WEG },
  { id: 'ps_offen', label: 'Offene Aufgaben', saeule: 'pl', gruppe: 'Aufgaben', einheit: 'anzahl', richtung: 'niedrig', gruen: 12, rot: 25,
    formel: 'Deine offenen Aufgaben im Privat-Bereich — bis 12 gilt als tragbar', quelle: 'Aufgaben (verantwortlich oder beteiligt, Privat-Bereich)',
    luecke: 'Keine privaten Aufgaben', pflegen: AUFGABEN_WEG },
  { id: 'ps_kritisch', label: 'Kritische offen', saeule: 'pl', gruppe: 'Aufgaben', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 3,
    formel: 'Offene Aufgaben mit Priorität „kritisch“ im Privat-Bereich', quelle: 'Aufgaben (verantwortlich oder beteiligt, Privat-Bereich)',
    luecke: 'Keine offenen privaten Aufgaben', pflegen: AUFGABEN_WEG },
  { id: 'ps_erledigt', label: 'Erledigt in 7 Tagen', saeule: 'pl', gruppe: 'Aufgaben', einheit: 'anzahl', richtung: 'hoch', gruen: 5, rot: 0,
    formel: 'Private Aufgaben, die du in den letzten 7 Tagen erledigt hast — es geht voran', quelle: 'Aufgaben (Zeitpunkt „erledigt“ vom Server)',
    luecke: 'Keine privaten Aufgaben', pflegen: AUFGABEN_WEG },
  { id: 'ps_familie', label: 'Pflege-Rhythmus', saeule: 'fa', gruppe: 'Familie', einheit: 'punkte', richtung: 'hoch', gruen: 80, rot: 40, direkt: true,
    formel: 'Der Pflege-Rhythmus des Paares — dieselbe Zahl wie unter Familie & Partnerschaft', quelle: 'Familie & Partnerschaft (28 Tage)',
    luecke: 'Noch nichts eingetragen', pflegen: FAMILIE_WEG },
];

const teilDetails = (q: QuellIndex, href: string): Detail[] => [
  ...q.teile.map(t => ({ titel: t.label, wert: t.score == null ? '—' : `${t.score}${t.zuDuenn ? '*' : ''}`, href })),
  ...(q.hebel ? [{ titel: 'Größter Hebel dort', wert: q.hebel, href }] : []),
];

function quellMessung(q: QuellIndex | null, zusatzLuecke: string | null, weg: { text: string; href: string }, leer: string): Messung {
  const zu: Detail[] = [{ titel: weg.text, href: weg.href }];
  if (zusatzLuecke) return { luecke: zusatzLuecke, details: zu };
  if (!q) return { luecke: leer, details: zu };
  if (q.index == null) return { luecke: `${leer} — ${q.satz}`, details: [...teilDetails(q, weg.href), ...zu] };
  return { wert: q.index, anzeige: String(q.index), quelle: `${q.label} · ${q.satz}`, details: teilDetails(q, weg.href) };
}

export const OHNE_EINWILLIGUNG_SCORE = 'ohne Einwilligung — zählt erst nach „In MAKE OS verarbeiten“ (Gesundheit › Einwilligung)';
export const OHNE_HAUSHALT_SCORE = 'kein Haushalt mit Privatzugang — zählt nicht';

const pzt = (n: number) => `${Math.round(n)} %`;
const aufgabeDetail = (t: { id: string; titel: string; faellig?: string }): Detail => ({ titel: t.titel, ...(t.faellig ? { wert: `${t.faellig.slice(8, 10)}.${t.faellig.slice(5, 7)}.` } : {}), href: WEG.aufgabe(t.id) });

export const PRIVAT_SCORE_MESSEN: Record<string, (b: PrivatScoreBestand) => Messung> = {
  ps_gesundheit: b => quellMessung(b.gesundheit.quelle, b.gesundheit.erlaubt ? null : OHNE_EINWILLIGUNG_SCORE, GESUNDHEIT_WEG, 'Der Gesundheits-Index hat noch keine Zahl'),
  ps_finanzen: b => quellMessung(b.finanzen.quelle,
    !b.finanzen.haushalt ? OHNE_HAUSHALT_SCORE : b.finanzen.quelle && !b.finanzen.frisch ? 'Buchungen älter als 45 Tage — Kontoauszug einlesen, dann zählt der Privat-Index wieder' : null,
    FINANZEN_WEG, 'Der Privat-Index hat noch keine Zahl'),
  ps_familie: b => {
    const r = b.familie.rhythmus;
    const zu: Detail[] = [{ titel: FAMILIE_WEG.text, href: FAMILIE_WEG.href }];
    if (!b.familie.haushalt) return { luecke: OHNE_HAUSHALT_SCORE, details: zu };
    if (!r) return { luecke: 'Noch nichts eingetragen', details: zu };
    if (r.stufe === 'pause') return { luecke: r.hinweis || 'Ausnahmezeit — pausiert', details: zu };
    if (r.score == null) return { luecke: r.hinweis || 'Noch nichts eingetragen', details: zu };
    const schwach = [...r.bausteine].filter(x => x.wert < 1).sort((x, y) => y.gewicht * (1 - y.wert) - x.gewicht * (1 - x.wert)).slice(0, 3);
    return { wert: r.score, anzeige: String(r.score), quelle: r.hinweis || 'Pflege-Rhythmus über 28 Tage',
      details: (schwach.length ? schwach : r.bausteine.slice(0, 3)).map(x => ({ titel: x.titel, wert: `${Math.round(x.wert * 100)}`, unter: x.text, href: FAMILIE_WEG.href })) };
  },
  ps_ueberfaellig: b => {
    const p = b.planung;
    if (!p || !p.offen) return { luecke: 'Keine offenen privaten Aufgaben', details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
    const w = (p.ueberfaellig / p.offen) * 100;
    return { wert: w, anzeige: pzt(w), quelle: `${p.ueberfaellig} von ${p.offen} offenen überfällig`, details: (p.beispiele?.ueberfaellig ?? []).slice(0, 3).map(aufgabeDetail) };
  },
  ps_offen: b => {
    const p = b.planung;
    if (!p) return { luecke: 'Keine privaten Aufgaben', details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
    return { wert: p.offen, anzeige: String(p.offen), quelle: `${p.offen} offen — bis 12 gilt als tragbar`, details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
  },
  ps_kritisch: b => {
    const p = b.planung;
    if (!p || !p.offen) return { luecke: 'Keine offenen privaten Aufgaben', details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
    return { wert: p.kritisch, anzeige: String(p.kritisch), quelle: `${p.kritisch} kritische offen`, details: (p.beispiele?.kritisch ?? []).slice(0, 3).map(aufgabeDetail) };
  },
  ps_erledigt: b => {
    const p = b.planung;
    if (!p) return { luecke: 'Keine privaten Aufgaben', details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
    return { wert: p.erledigt7, anzeige: String(p.erledigt7), quelle: `${p.erledigt7} in den letzten 7 Tagen erledigt`, details: [{ titel: AUFGABEN_WEG.text, href: AUFGABEN_WEG.href }] };
  },
};

/** Der Privat-Score einer Person (rein). */
export function berechnePrivatScore(b: PrivatScoreBestand): PrivatScore {
  return berechneModell({
    saeulen: privatScoreSaeulen(b), kennzahlen: PRIVAT_SCORE_KENNZAHLEN, messen: PRIVAT_SCORE_MESSEN,
    bestand: b, schwellen: b.schwellen, stand: b.heute, scope: PRIVAT_SCORE_SCOPE,
  });
}

/** Die Gewichte als Text („Gesundheit 50 % · …“) — EINE Quelle für Seite, ZOE und Erklärungen. */
export function privatScoreGewichteText(eigen?: Partial<Record<PrivatScoreSaeule, number>>): string {
  const g = privatScoreGewichte(eigen);
  return PRIVAT_SCORE_SAEULEN_IDS.map(id => `${SAEULE_TEXT[id].label} ${Math.round(g[id] * 100)} %`).join(' · ');
}

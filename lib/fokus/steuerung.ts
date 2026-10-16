// ─── MAKE OS — Fokus-Steuerung: Prioritäten und Zeit je Bereich (10.10.) — rein, Server und Browser ──────────────────────────────
// Entscheidung 10.10.: „Fokus und Kompass zusammenlegen und bei Planung rausnehmen — Planung soll nur Planung sein. Prio und Fokus
// geben wir im Fokus-Bereich … Dort auch das Thema Zeit — Privat wie Business einzeln, ausgebaut auf die spezifischen Themen. Eine
// riesige Steuerungsseite: was und wie wir etwas machen wollen, welche Zeit wir dafür reingeben wollen und wo der Fokus draufgeht.“
// Dazu der Befund am Bildschirm: die Business-Sicht zeigte Familie, Gesundheit, Tagesform und die Privat-Einheit — Business zeigt
// nie Privat-Themen, Privat nie Business-Themen.
//
// Darum liegen die Prioritäten in GETRENNTEN Beständen (lib/fokus/steuerung-server.ts):
//   · Themen · Privat    → `fokus-steuerung-privat--<haushalt>`    (Reihenfolge = Rang, Gewicht 0–100, Zeit-Quellen, optional Privat-Einheit)
//   · Themen · Business  → `fokus-steuerung-business--<haushalt>`  (dazu je Business-Gesellschaft ein Thema)
//   · Soll · Privat      → `fokus-soll-privat--<person>`           (h/Woche je Thema — jede Person für sich)
//   · Soll · Business    → `fokus-soll-business--<person>`
// Ohne eigenen Bestand gilt die Vorgabe (nur allgemeine Themen, nichts Persönliches); die Gewichte der früheren, gemischten Regler
// (`fokus-regler`: health · social · business · finance · planning) und die Themen-Reihenfolge (`ordnung`) werden beim Lesen auf die
// Bereiche verteilt — nichts geht verloren, der Altbestand wird nie umgeschrieben.
// Ist-Zeit: die Zeitmessung (`zeit--<person>`) der eigenen Person, NUR Schlüssel des eigenen Bereichs (`privat:…` bzw. `business:…`) und
// Fokus-Blöcke der eigenen Einheiten — Business liest nie einen Privat-Schlüssel, Privat nie einen Business-Schlüssel.

import { leisteFuer } from '@/lib/make-one/spaces';
import { bereichVon } from '@/lib/zeitmessung/bereich';
import { ERHOLUNG_ZEIT_BEREICH } from '@/lib/zeitmessung/erholung';
import type { ZeitSumme } from '@/lib/zeitmessung/modell';
import { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN, finanzOrtName, privatArbeitsEinheit, istBusinessGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';

export type SteuerBereich = 'privat' | 'business';
export const istSteuerBereich = (v: unknown): v is SteuerBereich => v === 'privat' || v === 'business';

/** Ein Thema der Prioritäten. Die Reihenfolge in der Liste ist der Rang (oben = zählt zuerst). */
export interface SteuerThema {
  /** Kennung `[a-z0-9-]{1,40}` — bleibt beim Umbenennen. */
  id: string;
  label: string;
  /** Wie viel Energie hineingeht, 0–100 (Schritt 5). */
  gewicht: number;
  /** Zeit-Quellen: Bereiche der Zeitmessung (Seiten des eigenen Bereichs), deren Zeit für dieses Thema zählt. */
  zeit: string[];
  /** Eine Einheit des eigenen Bereichs (Business: Business-Gesellschaft; Privat: Privat-Arbeits-Einheit) — Zeit aus deren Fokus-Blöcken. */
  einheit?: string;
}
export interface SteuerDatei { themen?: SteuerThema[] }
export interface SollDatei { soll?: Record<string, number> }

export const THEMEN_MAX = 24;
export const LABEL_MAX = 60;
export const ZEIT_QUELLEN_MAX = 8;
/** Soll-Zeit je Thema und Woche, höchstens (h). */
export const SOLL_MAX = 80;
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Ab hier gilt ein Thema als „hohe Priorität“ (wie der Fokus-Regler bisher: lib/make-one/fokus-data.ts FOKUS_SCHWELLE). */
export const HOCH_AB = 65;
/** Darunter gilt ein Thema als „niedrige Priorität“. */
export const NIEDRIG_UNTER = 35;
/** Unter so viel gemessener Zeit im Bereich (7 Tage) gibt es kein Urteil ohne Soll. */
export const MIN_MESSUNG_SEK = 3600;

/** Kennung des Themas einer Einheit (Gesellschaft bzw. Privat-Arbeits-Einheit). */
export const einheitThemaId = (g: string) => `einheit-${g}`;

/** Die Einheiten, die ein Bereich als Thema führen darf — Business: die Business-Gesellschaften; Privat: Privat-Einheiten, deren Zeit Arbeit ist. */
export function einheitenFuer(b: SteuerBereich): { id: Gesellschaftskennung; name: string }[] {
  const liste = b === 'business' ? BUSINESS_GESELLSCHAFTEN : PRIVAT_GESELLSCHAFTEN.filter(g => !!privatArbeitsEinheit(g));
  return liste.map(g => ({ id: g, name: finanzOrtName(g) }));
}
const einheitErlaubt = (b: SteuerBereich, e: string) => (b === 'business' ? istBusinessGesellschaft(e) : !!privatArbeitsEinheit(e));

/**
 * Die Zeit-Quellen eines Bereichs: die Punkte seiner Leiste (Kennung so, wie die Zeitmessung sie verbucht — `bereichVon`), dazu ZOE-Seiten,
 * die Fokus-Seite und (nur Privat) die bewusste Erholung. Business bekommt nie eine Privat-Quelle und umgekehrt (der Schlüssel trägt den Bereich).
 */
export function zeitQuellenFuer(b: SteuerBereich): { id: string; label: string }[] {
  const aus = new Map<string, string>();
  for (const e of leisteFuer(b)) {
    const [pfad, q] = e.href.split('?');
    const t = bereichVon(pfad, q ? `?${q}` : '');
    if (!aus.has(t.id)) aus.set(t.id, t.label);
  }
  for (const [id, label] of [['agenten', 'Agenten'], ['brain', 'Brain'], ['fokus', 'Fokus']] as const) if (!aus.has(id)) aus.set(id, label);
  if (b === 'privat' && !aus.has(ERHOLUNG_ZEIT_BEREICH)) aus.set(ERHOLUNG_ZEIT_BEREICH, 'Erholung');
  return [...aus.entries()].map(([id, label]) => ({ id, label }));
}

/** Säulen des früheren Fokus-Reglers (`fokus-regler`, lib/make-one/fokus-data.ts) — für die Übernahme und das Spiegeln. */
export type SaeuleKey = 'health' | 'business' | 'planning' | 'finance' | 'social';
/** Welche Säule ein Vorgabe-Thema im früheren Regler hatte (Übernahme beim Lesen, Spiegel beim Schreiben). */
const SAEULE_JE_THEMA: Readonly<Record<string, SaeuleKey>> = {
  familie: 'social', freunde: 'social', gesundheit: 'health', erholung: 'health',
  sales: 'business', marketing: 'business', kunden: 'business', netzwerken: 'business', finanzen: 'finance', produkt: 'planning',
};
/** Welche Säulen ein Bereich im Spiegel setzen darf — Privat nie die Business-Säulen und umgekehrt. */
const SAEULEN_JE_BEREICH: Readonly<Record<SteuerBereich, readonly SaeuleKey[]>> = { privat: ['health', 'social'], business: ['business', 'finance', 'planning'] };
/** Die frühere Themen-Reihenfolge (lib/make-one/ordnung-data.ts) → Business-Themen (für den Rang der Übernahme). */
const ORDNUNG_JE_THEMA: Readonly<Record<string, string>> = { finanzen: 'recht', sales: 'umsatz', kunden: 'umsatz', marketing: 'umsatz', netzwerken: 'umsatz', produkt: 'produkt' };

/** Die Vorgabe — nur allgemeine Themen (je Instanz/Haushalt umbenennbar, ergänzbar, löschbar). */
export function vorgabeThemen(b: SteuerBereich): SteuerThema[] {
  const t = (id: string, label: string, zeit: string[] = []): SteuerThema => ({ id, label, gewicht: 50, zeit });
  const einheiten = einheitenFuer(b).map(e => ({ id: einheitThemaId(e.id), label: e.name, gewicht: 50, zeit: [], einheit: e.id }));
  if (b === 'privat') {
    return [
      t('familie', 'Familie & Partnerschaft', ['familie']),
      t('gesundheit', 'Gesundheit & Sport', ['gesundheit']),
      t('erholung', 'Erholung', [ERHOLUNG_ZEIT_BEREICH]),
      t('haushalt', 'Haushalt', ['finanzen', 'aufgaben']),
      t('freunde', 'Freunde', ['kontakte']),
      t('lernen', 'Lernen', ['brain']),
      ...einheiten,
    ];
  }
  return [
    t('sales', 'Sales', ['markttraktion']),
    t('marketing', 'Marketing'),
    t('produkt', 'Produkt'),
    t('kunden', 'Kunden & Mandate', ['mandate']),
    t('finanzen', 'Finanzen & Admin', ['finanzen', 'unternehmen']),
    t('netzwerken', 'Netzwerken'),
    ...einheiten,
  ];
}

export interface Altbestand { regler?: Partial<Record<SaeuleKey, number>> | null; reihenfolge?: readonly string[] | null }
export type ThemenQuelle = 'neu' | 'alt' | 'vorgabe';

const gewichtSauber = (v: unknown, sonst = 50): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n / 5) * 5)) : sonst;
};

/** Die Vorgabe mit den Werten des Altbestands: Gewichte aus den früheren Reglern, Business-Rang aus der früheren Themen-Reihenfolge. */
export function themenAusAltbestand(b: SteuerBereich, alt: Altbestand | null | undefined): { themen: SteuerThema[]; quelle: ThemenQuelle } {
  const basis = vorgabeThemen(b);
  const regler = alt?.regler && typeof alt.regler === 'object' ? alt.regler : null;
  const reihe = Array.isArray(alt?.reihenfolge) ? alt!.reihenfolge! : null;
  if (!regler && !reihe) return { themen: basis, quelle: 'vorgabe' };
  const mitGewicht = basis.map(t => {
    const s = t.einheit ? (b === 'business' ? 'business' : undefined) : SAEULE_JE_THEMA[t.id];
    const v = s && regler ? regler[s] : undefined;
    return typeof v === 'number' ? { ...t, gewicht: gewichtSauber(v) } : t;
  });
  if (b !== 'business' || !reihe) return { themen: mitGewicht, quelle: 'alt' };
  // Stabil nach der früheren Reihenfolge (recht → Finanzen & Admin, umsatz → Sales/Kunden/Marketing/Netzwerken, produkt → Produkt); Einheiten danach.
  const rang = (t: SteuerThema) => { const o = ORDNUNG_JE_THEMA[t.id]; const i = o ? reihe.indexOf(o) : -1; return t.einheit ? 1000 : i < 0 ? 500 : i; };
  return { themen: mitGewicht.map((t, i) => ({ t, i })).sort((x, y) => rang(x.t) - rang(y.t) || x.i - y.i).map(x => x.t), quelle: 'alt' };
}

/** Die wirksame Liste: der eigene Bestand, sobald er eine Liste trägt (auch leer = bewusst geleert), sonst Vorgabe + Altbestand. */
export function wirksameThemen(b: SteuerBereich, datei: SteuerDatei | null | undefined, alt: Altbestand | null | undefined): { themen: SteuerThema[]; quelle: ThemenQuelle } {
  if (Array.isArray(datei?.themen)) return { themen: datei!.themen!.map(t => ({ ...t, zeit: [...(t.zeit ?? [])] })), quelle: 'neu' };
  return themenAusAltbestand(b, alt);
}

/** Stand der Liste (FNV-1a über Quelle + Inhalt) — der Browser schickt ihn beim Schreiben mit, sonst 409. */
export function themenStand(themen: readonly SteuerThema[], quelle: ThemenQuelle): string {
  let h = 0x811c9dc5;
  for (const c of `${quelle}\u0000${JSON.stringify(themen)}`) { h ^= c.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return `t${h.toString(36)}${themen.length.toString(36)}`;
}

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; status: 400 | 413; fehler: string };

/** Eine neue Liste prüfen (nie gekürzt): Form, Grenzen, Zeit-Quellen und Einheiten NUR des eigenen Bereichs. */
export function themenPruefen(roh: unknown, b: SteuerBereich): Pruefung<SteuerThema[]> {
  if (!Array.isArray(roh)) return { ok: false, status: 400, fehler: 'themen fehlt.' };
  if (roh.length > THEMEN_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${THEMEN_MAX} Themen je Bereich. Nichts gespeichert.` };
  const quellen = new Set(zeitQuellenFuer(b).map(q => q.id));
  const ids = new Set<string>();
  const aus: SteuerThema[] = [];
  for (const x of roh) {
    const t = (x ?? {}) as Record<string, unknown>;
    const id = typeof t.id === 'string' ? t.id : '';
    if (!ID.test(id)) return { ok: false, status: 400, fehler: 'Ungültige Kennung eines Themas.' };
    if (ids.has(id)) return { ok: false, status: 400, fehler: 'Ein Thema steht doppelt in der Liste.' };
    ids.add(id);
    const label = typeof t.label === 'string' ? t.label.trim() : '';
    if (!label) return { ok: false, status: 400, fehler: 'Jedes Thema braucht einen Namen.' };
    if (label.length > LABEL_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${LABEL_MAX} Zeichen je Name. Nichts gespeichert.` };
    const gewicht = Number(t.gewicht);
    if (!Number.isFinite(gewicht) || gewicht < 0 || gewicht > 100) return { ok: false, status: 400, fehler: 'Gewicht 0–100.' };
    const einheit = t.einheit == null || t.einheit === '' ? undefined : String(t.einheit);
    if (einheit && !einheitErlaubt(b, einheit)) return { ok: false, status: 400, fehler: b === 'business' ? 'Nur Business-Gesellschaften gehören zu den Business-Themen.' : 'Nur Privat-Einheiten gehören zu den Privat-Themen.' };
    const zeitRoh = t.zeit == null ? [] : t.zeit;
    if (!Array.isArray(zeitRoh)) return { ok: false, status: 400, fehler: 'Zeit-Quellen als Liste.' };
    if (zeitRoh.length > ZEIT_QUELLEN_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${ZEIT_QUELLEN_MAX} Zeit-Quellen je Thema. Nichts gespeichert.` };
    const zeit: string[] = [];
    for (const z of zeitRoh) {
      if (typeof z !== 'string' || !quellen.has(z)) return { ok: false, status: 400, fehler: 'Diese Zeit-Quelle gehört nicht zu diesem Bereich.' };
      if (!zeit.includes(z)) zeit.push(z);
    }
    // Eine Einheit zählt NUR ihre Fokus-Blöcke — Seiten-Zeit daneben würde dieselbe Zeit doppelt zählen.
    aus.push({ id, label, gewicht: gewichtSauber(gewicht), zeit: einheit ? [] : zeit, ...(einheit ? { einheit } : {}) });
  }
  return { ok: true, wert: aus };
}

/** Soll-Werte prüfen: nur bekannte Themen, 0–SOLL_MAX h/Woche in halben Stunden; `null` (oder 0) entfernt den Wert. */
export function sollPruefen(roh: unknown, themen: readonly SteuerThema[]): Pruefung<Record<string, number | null>> {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'soll fehlt.' };
  const eintraege = Object.entries(roh as Record<string, unknown>);
  if (eintraege.length > THEMEN_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${THEMEN_MAX} Werte. Nichts gespeichert.` };
  const bekannt = new Set(themen.map(t => t.id));
  const aus: Record<string, number | null> = {};
  for (const [id, v] of eintraege) {
    if (!bekannt.has(id)) return { ok: false, status: 400, fehler: 'Dieses Thema gibt es in diesem Bereich nicht.' };
    if (v === null || v === '' || v === 0) { aus[id] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > SOLL_MAX) return { ok: false, status: 400, fehler: `Soll-Zeit 0–${SOLL_MAX} Stunden je Woche.` };
    const h = Math.round(n * 2) / 2;
    aus[id] = h > 0 ? h : null;
  }
  return { ok: true, wert: aus };
}

/** Soll anwenden (rein): gesetzte Werte überschreiben, `null` entfernt; Werte gelöschter Themen bleiben liegen (wirken nicht). */
export function sollAnwenden(d: SollDatei | null | undefined, neu: Record<string, number | null>): SollDatei {
  const soll = { ...(d?.soll ?? {}) };
  for (const [id, v] of Object.entries(neu)) { if (v == null) delete soll[id]; else soll[id] = v; }
  return { ...(d ?? {}), soll };
}

/** Der Spiegel in den früheren Fokus-Regler: je Säule das höchste Gewicht ihrer Themen — NUR die Säulen des eigenen Bereichs. */
export function reglerAusThemen(b: SteuerBereich, themen: readonly SteuerThema[]): Partial<Record<SaeuleKey, number>> {
  const erlaubt = SAEULEN_JE_BEREICH[b];
  const aus: Partial<Record<SaeuleKey, number>> = {};
  for (const t of themen) {
    const s = t.einheit ? (b === 'business' ? 'business' : undefined) : SAEULE_JE_THEMA[t.id];
    if (!s || !erlaubt.includes(s)) continue;
    aus[s] = Math.max(aus[s] ?? 0, t.gewicht);
  }
  return aus;
}

// ── Ist gegen Soll ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ThemaIst {
  /** Gemessene Zeit der letzten 7 Tage (Seiten + bewusst), Sekunden. */
  sek: number;
  /** Davon bewusst (Fokus-Zähler). */
  bewusstSek: number;
  /** In dieser Woche als Block im Kalender eingeplant (nur Privat: Erholung, Reha), Sekunden. */
  eingeplantSek: number;
}

/**
 * Ist je Thema (rein): die Schlüssel `<bereich>:<quelle>` der Zeit-Summe (7 Tage) — nur der eigene Bereich —, Einheiten-Themen aus den
 * Sekunden ihrer Fokus-Blöcke, dazu (Privat) eingeplante Blöcke je Zeit-Quelle.
 */
export function istJeThema(
  b: SteuerBereich, themen: readonly SteuerThema[], summe: Pick<ZeitSumme, 'jeSchluessel' | 'bewusstJeSchluessel'>,
  einheitSek: Readonly<Record<string, number>> = {}, eingeplant: Readonly<Record<string, number>> = {},
): Record<string, ThemaIst> {
  const aus: Record<string, ThemaIst> = {};
  for (const t of themen) {
    if (t.einheit) { const s = Math.round(einheitSek[t.einheit] ?? 0); aus[t.id] = { sek: s, bewusstSek: s, eingeplantSek: 0 }; continue; }
    let sek = 0, bewusst = 0, plan = 0;
    for (const z of t.zeit) {
      const k = `${b}:${z}`;
      sek += summe.jeSchluessel[k] ?? 0;
      bewusst += summe.bewusstJeSchluessel[k] ?? 0;
      plan += eingeplant[z] ?? 0;
    }
    aus[t.id] = { sek: Math.round(sek), bewusstSek: Math.round(bewusst), eingeplantSek: Math.round(plan) };
  }
  return aus;
}

/** Kalender-Blöcke → Zeit-Quelle (nur Privat): Erholung zählt auf Erholung, Reha auf Gesundheit. */
export const BLOCK_ZEIT_QUELLE: Readonly<Record<string, string>> = { erholung: ERHOLUNG_ZEIT_BEREICH, reha: 'gesundheit' };

export type PassStufe = 'gut' | 'achtung' | 'kritisch' | 'offen';
export interface PassZeile { id: string; stufe: PassStufe; satz: string }
export interface Passung { stufe: PassStufe; satz: string; zeilen: PassZeile[] }
const STUFE_RANG: Record<PassStufe, number> = { offen: 0, gut: 1, achtung: 2, kritisch: 3 };
const stunden = (sek: number) => { const h = sek / 3600; return h >= 10 ? `${Math.round(h)} h` : `${(Math.round(h * 10) / 10).toLocaleString('de-DE')} h`; };

/**
 * Passen Fokus und Zeit zusammen? (rein) Je Thema: mit Soll das Verhältnis Ist ÷ Soll; ohne Soll der Anteil an der gemessenen Zeit des Bereichs
 * gegen den Anteil am Gewicht. Hohe Priorität (Rang 1–2 oder Gewicht ≥ HOCH_AB) mit wenig Zeit = kritisch; niedrige Priorität mit viel Zeit =
 * Achtung. `gesamtSek` = alle gemessene Zeit des Bereichs in den 7 Tagen.
 */
export function passung(themen: readonly SteuerThema[], soll: Readonly<Record<string, number>>, ist: Readonly<Record<string, ThemaIst>>, gesamtSek: number): Passung {
  const summeGewicht = themen.reduce((s, t) => s + t.gewicht, 0);
  // Grundeinstellung ist keine Priorität (16.10., Abnahme 2 · C4): stehen alle Regler gleich (z. B. überall die Vorgabe 50), hat niemand
  // priorisiert — dann macht der Rang allein kein Thema „hoch“, und die rote Warnung entsteht nur aus dem, was wirklich eingestellt ist.
  const gleich = themen.length > 0 && themen.every(t => t.gewicht === themen[0].gewicht);
  const zeilen: PassZeile[] = themen.map((t, rang) => {
    const i = ist[t.id] ?? { sek: 0, bewusstSek: 0, eingeplantSek: 0 };
    const hoch = t.gewicht > 0 && (t.gewicht >= HOCH_AB || (rang < 2 && !gleich));
    const niedrig = t.gewicht < NIEDRIG_UNTER && rang >= 2;
    const s = soll[t.id];
    if (s && s > 0) {
      const q = i.sek / (s * 3600);
      const text = `${stunden(i.sek)} von ${stunden(s * 3600)}`;
      if (q < 0.5) return { id: t.id, stufe: hoch ? 'kritisch' : 'achtung', satz: hoch ? `Hohe Priorität, aber nur ${text}.` : `Weniger als geplant: ${text}.` };
      if (q < 0.8) return { id: t.id, stufe: 'achtung', satz: `Knapp unter dem Soll: ${text}.` };
      if (q > 1.5 && niedrig) return { id: t.id, stufe: 'achtung', satz: `Mehr Zeit als geplant, obwohl niedrige Priorität: ${text}.` };
      return { id: t.id, stufe: 'gut', satz: `Passt: ${text}.` };
    }
    if (gesamtSek < MIN_MESSUNG_SEK || !summeGewicht) return { id: t.id, stufe: 'offen', satz: 'Noch kein Soll und zu wenig gemessen.' };
    const anteilZeit = i.sek / gesamtSek, anteilGewicht = t.gewicht / summeGewicht;
    const pz = Math.round(anteilZeit * 100);
    if (hoch && anteilZeit < anteilGewicht * 0.5) return { id: t.id, stufe: 'kritisch', satz: `Hohe Priorität, aber nur ${pz} % der Zeit.` };
    if (niedrig && anteilZeit > Math.max(0.25, anteilGewicht * 2)) return { id: t.id, stufe: 'achtung', satz: `${pz} % der Zeit in ein Thema mit niedriger Priorität.` };
    return { id: t.id, stufe: 'gut', satz: `${pz} % der Zeit.` };
  });
  const schlimmste = zeilen.reduce<PassStufe>((m, z) => (STUFE_RANG[z.stufe] > STUFE_RANG[m] ? z.stufe : m), 'offen');
  const namen = (st: PassStufe) => zeilen.filter(z => z.stufe === st).map(z => themen.find(t => t.id === z.id)?.label ?? z.id);
  const satz = !themen.length ? 'Noch keine Themen — oben anlegen.'
    : schlimmste === 'kritisch' ? `Fokus und Zeit passen nicht zusammen: ${namen('kritisch').join(', ')}.`
      : schlimmste === 'achtung' ? `Fokus und Zeit passen nur teilweise: ${namen('achtung').join(', ')}.`
        : schlimmste === 'gut' ? 'Fokus und Zeit passen zusammen.'
          : 'Noch zu wenig gemessen — Soll eintragen oder Fokus starten.';
  return { stufe: schlimmste, satz, zeilen };
}

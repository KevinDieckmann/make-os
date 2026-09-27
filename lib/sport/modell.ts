// ─── MAKE OS — Sport: Datenmodell (27.09.) ──────────────────────────────────
// Kevins Auftrag: „Im Gesundheitsbereich einen Sport-Bereich einbauen — für
// Malin ausgebaut mit Hyrox, Running, Gym und Erholung, damit sie ihre Ziele
// am Anfang schon perfekt planen kann.“
//
// Ein Bestand je Person (`sport--<person>`, Kevin ohne Suffix wie überall).
// Änderungen laufen als kleine Schritte (`Op`) über `wendeAn` — zu zweit und
// am Handy überschreibt so niemand den anderen. `saeubere` macht aus allem,
// was in der Datei liegt, einen gültigen Stand: nichts Erfundenes, keine Null.
// Reine Logik, keine Ein-/Ausgabe — getestet in tests/sport-*.test.ts.

export type Disziplin = 'hyrox' | 'lauf' | 'kraft' | 'grundlagen';
export type PlanArt = 'hyrox' | 'lauf' | 'gym' | 'ruhe' | 'frei';
export type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export const WOCHENTAGE: Wochentag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const WOCHENTAG_LABEL: Record<Wochentag, string> = { mo: 'Mo', di: 'Di', mi: 'Mi', do: 'Do', fr: 'Fr', sa: 'Sa', so: 'So' };
export const DISZIPLIN_LABEL: Record<Disziplin, string> = { hyrox: 'Hyrox', lauf: 'Laufen', kraft: 'Kraft', grundlagen: 'Grundlagen' };
export const PLAN_LABEL: Record<PlanArt, string> = { hyrox: 'Hyrox', lauf: 'Lauf', gym: 'Gym', ruhe: 'Ruhe', frei: 'frei' };

export type StationId = 'skierg' | 'sledPush' | 'sledPull' | 'bbj' | 'rudern' | 'farmers' | 'lunges' | 'wallballs';
export type LaufArt = 'locker' | 'intervall' | 'tempo' | 'longrun' | 'wettkampf';
export const LAUF_ARTEN: { id: LaufArt; label: string }[] = [
  { id: 'locker', label: 'locker' }, { id: 'intervall', label: 'Intervall' }, { id: 'tempo', label: 'Tempo' }, { id: 'longrun', label: 'Longrun' }, { id: 'wettkampf', label: 'Wettkampf' },
];
export type Quelle = 'hand' | 'apple-health' | 'strava' | 'whoop';

export interface Ziel {
  id: string;
  art: Disziplin;
  titel: string;
  /** Zieldatum (Wettkampf, Stichtag) — YYYY-MM-DD. */
  datum?: string;
  /** Zielzeit in Sekunden (Hyrox gesamt, Lauf über `distanzKm`). */
  zielzeitSek?: number;
  /** Lauf: Distanz in km (5 · 10 · 21,1). */
  distanzKm?: number;
  /** Kraft: Übung und Zielgewicht (e1RM oder Arbeitsgewicht). */
  uebung?: string;
  zielKg?: number;
  notiz?: string;
  angelegt: string;
  erledigt?: boolean;
}

export interface Ausgang {
  /** Aktuelle Bestzeiten in Sekunden — der Punkt, von dem aus geplant wird. */
  lauf5kSek?: number;
  lauf10kSek?: number;
  hyroxSek?: number;
  /** Kraft: Arbeitsgewicht je Übung (kg). */
  kraft: Record<string, number>;
  /** Trainingstage, die die Woche hergibt (2–7). */
  tageProWoche?: number;
}

export interface PlanTag { art: PlanArt; dauerMin?: number; notiz?: string }
export type Woche = Record<Wochentag, PlanTag>;

export interface HyroxEinheit {
  id: string;
  datum: string;
  art: 'training' | 'simulation' | 'wettkampf';
  /** Zeit je Station in Sekunden — nur die gemessenen. */
  stationen: Partial<Record<StationId, number>>;
  /** Die 8 Läufe (Sekunden) — leer, wenn nicht gemessen. */
  laeufe: number[];
  /** Gesamtzeit in Sekunden — vom Wettkampf übernommen oder gerechnet. */
  gesamtSek?: number;
  ort?: string;
  notiz?: string;
}

export interface Lauf {
  id: string;
  datum: string;
  distanzKm: number;
  dauerSek: number;
  art: LaufArt;
  /** Gefühl 1 (zäh) … 5 (fliegt). */
  gefuehl?: number;
  notiz?: string;
  /** Woher kommt der Lauf — heute von Hand, später Import (Apple Health, Strava). */
  quelle: Quelle;
  /** Kennung beim Import, damit ein zweiter Import nichts doppelt anlegt. */
  externeId?: string;
}

export interface Satz { kg: number; wdh: number }
export interface Satzgruppe { uebung: string; saetze: Satz[] }
export interface GymEinheit {
  id: string;
  datum: string;
  /** Aus welcher Vorlage die Einheit kam (Anzeige, kein Zwang). */
  vorlage?: string;
  uebungen: Satzgruppe[];
  dauerMin?: number;
  notiz?: string;
}
export type Muskelgruppe = 'beine' | 'ruecken' | 'brust' | 'schulter' | 'rumpf' | 'ganzkoerper' | 'hyrox';
export interface Uebung { id: string; name: string; gruppe: Muskelgruppe; /** von der Person angelegt */ eigen?: boolean }
export interface VorlageUebung { uebung: string; saetze: number; wdh: string }
export interface Vorlage { id: string; name: string; uebungen: VorlageUebung[]; eigen?: boolean }

export interface ErholungTag {
  schlafH?: number;
  ruhepuls?: number;
  hrv?: number;
  /** Wie fühlst du dich 1–5 (5 = frisch). */
  gefuehl?: number;
  /** Muskelkater 1–5 (5 = überall). */
  muskelkater?: number;
  notiz?: string;
  quelle?: Quelle;
}

export interface SportStand {
  version: 1;
  einstieg: { fertig: boolean; am?: string };
  ziele: Ziel[];
  ausgang: Ausgang;
  woche: Woche;
  /** Montag der Woche, ab der der Plan gilt — Bezug für den Deload-Rhythmus. */
  planStart?: string;
  hyrox: HyroxEinheit[];
  laeufe: Lauf[];
  gym: { uebungen: Uebung[]; einheiten: GymEinheit[]; vorlagen: Vorlage[] };
  /** Je Tag (YYYY-MM-DD) die Erholung. */
  erholung: Record<string, ErholungTag>;
}

// ── Grundzustand und Prüfung ─────────────────────────────────────────────────

export const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const STATION_IDS: StationId[] = ['skierg', 'sledPush', 'sledPull', 'bbj', 'rudern', 'farmers', 'lunges', 'wallballs'];
const DISZIPLINEN: Disziplin[] = ['hyrox', 'lauf', 'kraft', 'grundlagen'];
const PLAN_ARTEN: PlanArt[] = ['hyrox', 'lauf', 'gym', 'ruhe', 'frei'];
const LAUF_ART_IDS: LaufArt[] = ['locker', 'intervall', 'tempo', 'longrun', 'wettkampf'];
const QUELLEN: Quelle[] = ['hand', 'apple-health', 'strava', 'whoop'];
const GRUPPEN: Muskelgruppe[] = ['beine', 'ruecken', 'brust', 'schulter', 'rumpf', 'ganzkoerper', 'hyrox'];

export function leereWoche(): Woche {
  return { mo: { art: 'frei' }, di: { art: 'frei' }, mi: { art: 'frei' }, do: { art: 'frei' }, fr: { art: 'frei' }, sa: { art: 'frei' }, so: { art: 'frei' } };
}

export function leererStand(): SportStand {
  return { version: 1, einstieg: { fertig: false }, ziele: [], ausgang: { kraft: {} }, woche: leereWoche(), hyrox: [], laeufe: [], gym: { uebungen: [], einheiten: [], vorlagen: [] }, erholung: {} };
}

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const zahl = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const ganz = (v: unknown, min: number, max: number): number | undefined => { const n = zahl(v, min, max); return n === undefined ? undefined : Math.round(n); };
const tag = (v: unknown): string | undefined => (typeof v === 'string' && TAG.test(v) ? v : undefined);
const id = (v: unknown): string | undefined => (typeof v === 'string' && ID.test(v) ? v : undefined);
const aus = <T extends string>(v: unknown, liste: readonly T[]): T | undefined => (liste as readonly unknown[]).includes(v) ? (v as T) : undefined;

export function saeubereZiel(e: unknown): Ziel | null {
  if (!istObj(e)) return null;
  const zid = id(e.id); const art = aus(e.art, DISZIPLINEN); const titel = text(e.titel, 120);
  if (!zid || !art || !titel) return null;
  const z: Ziel = { id: zid, art, titel, angelegt: typeof e.angelegt === 'string' ? e.angelegt : new Date().toISOString() };
  const d = tag(e.datum); if (d) z.datum = d;
  const zz = ganz(e.zielzeitSek, 1, 24 * 3600); if (zz) z.zielzeitSek = zz;
  const km = zahl(e.distanzKm, 0.1, 500); if (km) z.distanzKm = Math.round(km * 100) / 100;
  const u = id(e.uebung); if (u) z.uebung = u;
  const kg = zahl(e.zielKg, 0.5, 1000); if (kg) z.zielKg = Math.round(kg * 10) / 10;
  const n = text(e.notiz, 600); if (n) z.notiz = n;
  if (e.erledigt === true) z.erledigt = true;
  return z;
}

export function saeubereAusgang(a: unknown): Ausgang {
  const o = istObj(a) ? a : {};
  const r: Ausgang = { kraft: {} };
  const s5 = ganz(o.lauf5kSek, 600, 3 * 3600); if (s5) r.lauf5kSek = s5;
  const s10 = ganz(o.lauf10kSek, 1200, 5 * 3600); if (s10) r.lauf10kSek = s10;
  const hx = ganz(o.hyroxSek, 30 * 60, 5 * 3600); if (hx) r.hyroxSek = hx;
  const t = ganz(o.tageProWoche, 1, 7); if (t) r.tageProWoche = t;
  if (istObj(o.kraft)) for (const [k, v] of Object.entries(o.kraft)) { const kid = id(k); const kg = zahl(v, 0.5, 1000); if (kid && kg) r.kraft[kid] = Math.round(kg * 10) / 10; }
  return r;
}

export function saeuberePlanTag(t: unknown): PlanTag {
  if (!istObj(t)) return { art: 'frei' };
  const art = aus(t.art, PLAN_ARTEN) ?? 'frei';
  const p: PlanTag = { art };
  const d = ganz(t.dauerMin, 5, 600); if (d && art !== 'ruhe' && art !== 'frei') p.dauerMin = d;
  const n = text(t.notiz, 200); if (n) p.notiz = n;
  return p;
}

export function saeubereWoche(w: unknown): Woche {
  const o = istObj(w) ? w : {};
  const r = leereWoche();
  for (const t of WOCHENTAGE) r[t] = saeuberePlanTag(o[t]);
  return r;
}

export function saeubereHyrox(e: unknown): HyroxEinheit | null {
  if (!istObj(e)) return null;
  const hid = id(e.id); const datum = tag(e.datum);
  if (!hid || !datum) return null;
  const h: HyroxEinheit = { id: hid, datum, art: aus(e.art, ['training', 'simulation', 'wettkampf'] as const) ?? 'training', stationen: {}, laeufe: [] };
  if (istObj(e.stationen)) for (const s of STATION_IDS) { const v = ganz(e.stationen[s], 1, 3600); if (v) h.stationen[s] = v; }
  if (Array.isArray(e.laeufe)) h.laeufe = e.laeufe.slice(0, 8).map(v => ganz(v, 1, 3600)).filter((v): v is number => v !== undefined);
  const g = ganz(e.gesamtSek, 60, 8 * 3600); if (g) h.gesamtSek = g;
  const ort = text(e.ort, 80); if (ort) h.ort = ort;
  const n = text(e.notiz, 600); if (n) h.notiz = n;
  return h;
}

export function saeubereLauf(e: unknown): Lauf | null {
  if (!istObj(e)) return null;
  const lid = id(e.id); const datum = tag(e.datum); const km = zahl(e.distanzKm, 0.1, 500); const sek = ganz(e.dauerSek, 10, 48 * 3600);
  if (!lid || !datum || !km || !sek) return null;
  const l: Lauf = { id: lid, datum, distanzKm: Math.round(km * 100) / 100, dauerSek: sek, art: aus(e.art, LAUF_ART_IDS) ?? 'locker', quelle: aus(e.quelle, QUELLEN) ?? 'hand' };
  const g = ganz(e.gefuehl, 1, 5); if (g) l.gefuehl = g;
  const n = text(e.notiz, 600); if (n) l.notiz = n;
  const x = text(e.externeId, 120); if (x) l.externeId = x;
  return l;
}

export function saeubereGym(e: unknown): GymEinheit | null {
  if (!istObj(e)) return null;
  const gid = id(e.id); const datum = tag(e.datum);
  if (!gid || !datum) return null;
  const g: GymEinheit = { id: gid, datum, uebungen: [] };
  if (Array.isArray(e.uebungen)) {
    for (const u of e.uebungen.slice(0, 30)) {
      if (!istObj(u)) continue;
      const uid = id(u.uebung); if (!uid) continue;
      const saetze: Satz[] = Array.isArray(u.saetze) ? u.saetze.slice(0, 20).map(s => {
        if (!istObj(s)) return null;
        const kg = zahl(s.kg, 0, 1000); const wdh = ganz(s.wdh, 1, 200);
        return kg !== undefined && wdh ? { kg: Math.round(kg * 10) / 10, wdh } : null;
      }).filter((s): s is Satz => !!s) : [];
      if (saetze.length) g.uebungen.push({ uebung: uid, saetze });
    }
  }
  const v = id(e.vorlage); if (v) g.vorlage = v;
  const d = ganz(e.dauerMin, 1, 600); if (d) g.dauerMin = d;
  const n = text(e.notiz, 600); if (n) g.notiz = n;
  return g;
}

export function saeubereUebung(e: unknown): Uebung | null {
  if (!istObj(e)) return null;
  const uid = id(e.id); const name = text(e.name, 60);
  if (!uid || !name) return null;
  return { id: uid, name, gruppe: aus(e.gruppe, GRUPPEN) ?? 'ganzkoerper', eigen: true };
}

export function saeubereVorlage(e: unknown): Vorlage | null {
  if (!istObj(e)) return null;
  const vid = id(e.id); const name = text(e.name, 60);
  if (!vid || !name) return null;
  const uebungen: VorlageUebung[] = Array.isArray(e.uebungen) ? e.uebungen.slice(0, 20).map(u => {
    if (!istObj(u)) return null;
    const uid = id(u.uebung); const saetze = ganz(u.saetze, 1, 20); const wdh = text(u.wdh, 20) ?? '8';
    return uid && saetze ? { uebung: uid, saetze, wdh } : null;
  }).filter((u): u is VorlageUebung => !!u) : [];
  return { id: vid, name, uebungen, eigen: true };
}

export function saeubereErholung(e: unknown): ErholungTag | null {
  if (!istObj(e)) return null;
  const t: ErholungTag = {};
  const s = zahl(e.schlafH, 0, 24); if (s !== undefined) t.schlafH = Math.round(s * 10) / 10;
  const rp = ganz(e.ruhepuls, 25, 200); if (rp) t.ruhepuls = rp;
  const hrv = ganz(e.hrv, 1, 300); if (hrv) t.hrv = hrv;
  const g = ganz(e.gefuehl, 1, 5); if (g) t.gefuehl = g;
  const m = ganz(e.muskelkater, 1, 5); if (m) t.muskelkater = m;
  const n = text(e.notiz, 300); if (n) t.notiz = n;
  const q = aus(e.quelle, QUELLEN); if (q) t.quelle = q;
  return Object.keys(t).length ? t : null;
}

const nachDatum = <T extends { datum: string }>(l: T[]) => [...l].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
const eindeutig = <T extends { id: string }>(l: T[]) => { const m = new Map<string, T>(); for (const e of l) m.set(e.id, e); return [...m.values()]; };

/** Aus allem, was in der Datei liegt, ein gültiger Stand. Unbekanntes fällt weg, nichts wird erfunden. */
export function saeubere(raw: unknown): SportStand {
  const s = leererStand();
  if (!istObj(raw)) return s;
  if (istObj(raw.einstieg)) { s.einstieg.fertig = raw.einstieg.fertig === true; const am = typeof raw.einstieg.am === 'string' ? raw.einstieg.am : undefined; if (am) s.einstieg.am = am; }
  if (Array.isArray(raw.ziele)) s.ziele = eindeutig(raw.ziele.map(saeubereZiel).filter((z): z is Ziel => !!z)).slice(0, 50);
  s.ausgang = saeubereAusgang(raw.ausgang);
  s.woche = saeubereWoche(raw.woche);
  const ps = tag(raw.planStart); if (ps) s.planStart = ps;
  if (Array.isArray(raw.hyrox)) s.hyrox = nachDatum(eindeutig(raw.hyrox.map(saeubereHyrox).filter((h): h is HyroxEinheit => !!h))).slice(0, 1000);
  if (Array.isArray(raw.laeufe)) s.laeufe = nachDatum(eindeutig(raw.laeufe.map(saeubereLauf).filter((l): l is Lauf => !!l))).slice(0, 5000);
  if (istObj(raw.gym)) {
    if (Array.isArray(raw.gym.uebungen)) s.gym.uebungen = eindeutig(raw.gym.uebungen.map(saeubereUebung).filter((u): u is Uebung => !!u)).slice(0, 200);
    if (Array.isArray(raw.gym.einheiten)) s.gym.einheiten = nachDatum(eindeutig(raw.gym.einheiten.map(saeubereGym).filter((g): g is GymEinheit => !!g))).slice(0, 5000);
    if (Array.isArray(raw.gym.vorlagen)) s.gym.vorlagen = eindeutig(raw.gym.vorlagen.map(saeubereVorlage).filter((v): v is Vorlage => !!v)).slice(0, 50);
  }
  if (istObj(raw.erholung)) for (const [d, e] of Object.entries(raw.erholung)) { if (!TAG.test(d)) continue; const t = saeubereErholung(e); if (t) s.erholung[d] = t; }
  return s;
}

// ── Schritte ─────────────────────────────────────────────────────────────────

export type Op =
  | { op: 'einstieg'; fertig: boolean }
  | { op: 'ziel'; eintrag: unknown }
  | { op: 'ziel-weg'; id: string }
  | { op: 'ausgang'; werte: unknown }
  | { op: 'woche'; tage: unknown; planStart?: string }
  | { op: 'hyrox'; eintrag: unknown }
  | { op: 'hyrox-weg'; id: string }
  | { op: 'lauf'; eintrag: unknown }
  | { op: 'lauf-weg'; id: string }
  | { op: 'gym'; eintrag: unknown }
  | { op: 'gym-weg'; id: string }
  | { op: 'uebung'; eintrag: unknown }
  | { op: 'uebung-weg'; id: string }
  | { op: 'vorlage'; eintrag: unknown }
  | { op: 'vorlage-weg'; id: string }
  | { op: 'erholung'; tag: string; werte: unknown }
  | { op: 'erholung-weg'; tag: string };

const setze = <T extends { id: string }>(liste: T[], e: T) => [e, ...liste.filter(x => x.id !== e.id)];

/** Ein Schritt auf den Stand — gibt den neuen Stand zurück oder wirft mit einem Satz, den man zeigen kann. */
export function wendeAn(stand: SportStand, op: Op): SportStand {
  const s: SportStand = { ...stand, ziele: [...stand.ziele], hyrox: [...stand.hyrox], laeufe: [...stand.laeufe], gym: { uebungen: [...stand.gym.uebungen], einheiten: [...stand.gym.einheiten], vorlagen: [...stand.gym.vorlagen] }, erholung: { ...stand.erholung } };
  switch (op.op) {
    case 'einstieg': s.einstieg = { fertig: op.fertig === true, ...(op.fertig ? { am: new Date().toISOString() } : {}) }; return s;
    case 'ziel': { const z = saeubereZiel(op.eintrag); if (!z) throw new Error('Ziel unvollständig: Art, Titel und eine Kennung braucht es.'); s.ziele = setze(s.ziele, z).sort((a, b) => (a.datum ?? '9999') < (b.datum ?? '9999') ? -1 : 1); return s; }
    case 'ziel-weg': s.ziele = s.ziele.filter(z => z.id !== op.id); return s;
    case 'ausgang': s.ausgang = saeubereAusgang({ ...s.ausgang, ...(istObj(op.werte) ? op.werte : {}), kraft: { ...s.ausgang.kraft, ...(istObj(op.werte) && istObj(op.werte.kraft) ? op.werte.kraft : {}) } }); return s;
    case 'woche': s.woche = saeubereWoche(op.tage); { const ps = tag(op.planStart); if (ps) s.planStart = ps; } return s;
    case 'hyrox': { const h = saeubereHyrox(op.eintrag); if (!h) throw new Error('Hyrox-Einheit braucht Datum und Kennung.'); s.hyrox = nachDatum(setze(s.hyrox, h)); return s; }
    case 'hyrox-weg': s.hyrox = s.hyrox.filter(h => h.id !== op.id); return s;
    case 'lauf': { const l = saeubereLauf(op.eintrag); if (!l) throw new Error('Lauf braucht Datum, Distanz und Zeit.'); s.laeufe = nachDatum(setze(s.laeufe, l)); return s; }
    case 'lauf-weg': s.laeufe = s.laeufe.filter(l => l.id !== op.id); return s;
    case 'gym': { const g = saeubereGym(op.eintrag); if (!g) throw new Error('Einheit braucht Datum und Kennung.'); if (!g.uebungen.length) throw new Error('Mindestens ein Satz mit Gewicht und Wiederholungen.'); s.gym.einheiten = nachDatum(setze(s.gym.einheiten, g)); return s; }
    case 'gym-weg': s.gym.einheiten = s.gym.einheiten.filter(g => g.id !== op.id); return s;
    case 'uebung': { const u = saeubereUebung(op.eintrag); if (!u) throw new Error('Übung braucht einen Namen.'); s.gym.uebungen = setze(s.gym.uebungen, u); return s; }
    case 'uebung-weg': s.gym.uebungen = s.gym.uebungen.filter(u => u.id !== op.id); return s;
    case 'vorlage': { const v = saeubereVorlage(op.eintrag); if (!v) throw new Error('Vorlage braucht einen Namen.'); s.gym.vorlagen = setze(s.gym.vorlagen, v); return s; }
    case 'vorlage-weg': s.gym.vorlagen = s.gym.vorlagen.filter(v => v.id !== op.id); return s;
    case 'erholung': {
      if (!TAG.test(op.tag)) throw new Error('Tag ungültig.');
      const t = saeubereErholung({ ...(s.erholung[op.tag] ?? {}), ...(istObj(op.werte) ? op.werte : {}) });
      if (t) s.erholung[op.tag] = t; else delete s.erholung[op.tag];
      return s;
    }
    case 'erholung-weg': delete s.erholung[op.tag]; return s;
    default: throw new Error('Unbekannter Schritt.');
  }
}

/** Kurze Kennung für neue Einträge — lesbar, eindeutig genug für eine Person. */
export const neueId = (praefix: string) => `${praefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

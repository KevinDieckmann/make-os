// ─── Körper-Profil je Person (08.10. abends, Fragebogen Teil 3, Frage 2) ────────────────────────────────────────────
// Kevin: „Alles als eigene Daten je Person/Instanz (pflegbar, verschlüsselt) … Körper-Reiter sieht nur die Person selbst.“
// Vorher standen Profil-Leitsatz, Beschwerden, Hebel, Stufenplan, Zusammenhänge und ein Hinweistext EINER Person als
// Konstanten im Code, und der Reiter „Körper“ zeigte sie JEDEM Konto. Jetzt sind es Daten der Person: Bestand
// `gesundheit-koerper` (Erstkonto) bzw. `gesundheit-koerper--<person>` (speicherFuer), verschlüsselt wie jeder Bestand,
// gelesen und geschrieben NUR über /api/gesundheit/koerper und NUR von der Person selbst — auch wer seine Gesundheit
// teilt, teilt den Körper-Reiter nicht. An die KI nur über `eigenerGesundheitsKontext` mit Einwilligung (b).
//
// Dazu zwei Anzeige-Einstellungen, die vorher fest für eine Person im Code standen: der Name des Symptom-Reglers (die Werte
// liegen wie bisher im Bestand `haut`) und der Zähler „Sauber geblieben“. Seit 09.10. schaltet die Person die beiden
// Tagebücher als MODULE ein oder aus (`module`, lib/gesundheit/module.ts — EINE Regel `moduleWirksam`); `symptom` bleibt
// der eigene Name des Reglers, `sauberZaehler` folgt dem Modul `serie` (der ältere Stand liest nur dieses Feld).
//
// Rein (Server UND Browser): Form, Säuberung beim Lesen (nie kürzen), Grenzen, Änderungs-Schritte. Über einer Grenze
// wird abgelehnt (413), nie gekürzt; ein ungültiger Schritt lässt den ganzen Stapel liegen (400).

import { neueKennung } from '@/lib/kennung';
import { GESUNDHEIT_MODULE, modulEinstellungSaeubern, type GesundheitModul, type ModulEinstellung } from './module';

/** Basisname des Bestands (je Person über `speicherFuer`). */
export const KOERPER_BASIS = 'gesundheit-koerper';

export type KoerperTon = 'gut' | 'achtung' | 'kritisch';
export type StufenZustand = 'jetzt' | 'danach' | 'spaeter';
export const KOERPER_TOENE: readonly KoerperTon[] = ['gut', 'achtung', 'kritisch'];
export const STUFEN_ZUSTAENDE: readonly StufenZustand[] = ['jetzt', 'danach', 'spaeter'];
export const TON_NAME: Record<KoerperTon, string> = { gut: 'gut', achtung: 'beobachten', kritisch: 'kritisch' };
export const ZUSTAND_NAME: Record<StufenZustand, string> = { jetzt: 'Jetzt', danach: 'Danach', spaeter: 'Später' };

export interface KoerperBeschwerde { id: string; name: string; status: string; notiz: string; ton: KoerperTon }
/** `kennzahl` = Kennung einer Kennzahl des Gesundheits-Index (Link und Live-Wert) — statt fester Namenszuordnung. */
export interface KoerperHebel { id: string; name: string; notiz: string; kennzahl?: string }
export interface KoerperStufe { id: string; phase: string; name: string; beschreibung: string; zustand: StufenZustand }
export interface KoerperZusammenhang { id: string; text: string }
/** Ein eigener Satz unter einer Routine der Tagesliste (Kennung der Routine). */
export interface RoutinenHinweis { id: string; routine: string; text: string }
export interface KoerperSymptom { name: string }

export interface KoerperStand {
  v: 1;
  leitsatz: string;
  beschwerden: KoerperBeschwerde[];
  hebel: KoerperHebel[];
  stufen: KoerperStufe[];
  zusammenhaenge: KoerperZusammenhang[];
  /** Eigener Hinweistext unter den Zusammenhängen. */
  hinweis: string;
  /** Eigener Name des Symptom-Reglers auf „Heute“ (Werte im Bestand `haut`, Modul `haut`) — null = allgemeiner Name. */
  symptom: KoerperSymptom | null;
  /** Zähler „Sauber geblieben“ auf „Heute“ — aus = nicht anzeigen. Seit 09.10. Spiegel des Moduls `serie` (Rückweg). */
  sauberZaehler: boolean;
  /** Module, die die Person ausdrücklich ein- oder ausgeschaltet hat (fehlt = Altbestand-Regel, lib/gesundheit/module.ts). */
  module?: ModulEinstellung;
  routinenHinweise: RoutinenHinweis[];
  /** Tag der einmaligen Übernahme des Altbestands (lib/altbestand/uebernahme.ts) — Marke, damit sie nie zweimal läuft. */
  altbestand?: string;
  /** Zeitpunkt der letzten Änderung (setzt der Server). */
  geaendert?: string;
}

export const KOERPER_LISTEN = ['beschwerden', 'hebel', 'stufen', 'zusammenhaenge', 'routinenHinweise'] as const;
export type KoerperListe = typeof KOERPER_LISTEN[number];
const PRAEFIX: Record<KoerperListe, string> = { beschwerden: 'kb', hebel: 'kh', stufen: 'ks', zusammenhaenge: 'kz', routinenHinweise: 'kr' };

/** Grenzen (Zeichen bzw. Anzahl). Darüber → 413, nie gekürzt. */
export const KOERPER_GRENZEN = { name: 120, status: 60, lang: 1000, satz: 400, leitsatz: 300, eintraege: 50, ops: 100 } as const;

export const KENNZAHL_OK = /^[a-z0-9_-]{1,40}$/;
const ID_OK = /^[a-z0-9-]{1,80}$/;
const ROUTINE_OK = /^[A-Za-z0-9_-]{1,80}$/;

/** Fehler eines Änderungs-Schritts: 400 ungültig, 404 unbekannter Eintrag, 413 über einer Grenze. */
export class KoerperFehler extends Error {
  constructor(readonly status: 400 | 404 | 413, nachricht: string) { super(nachricht); }
}

export function leererKoerper(): KoerperStand {
  return { v: 1, leitsatz: '', beschwerden: [], hebel: [], stufen: [], zusammenhaenge: [], hinweis: '', symptom: null, sauberZaehler: false, routinenHinweise: [] };
}

// ── Säuberung beim Lesen: Form herstellen, nichts kürzen ──────────────────────────────────────────────────────────

const obj = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);
const str = (x: unknown): string => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '');
const liste = <T>(x: unknown, eins: (e: Record<string, unknown>) => T | null): T[] =>
  (Array.isArray(x) ? x : []).map(e => { const o = obj(e); return o && typeof o.id === 'string' && ID_OK.test(o.id) ? eins(o) : null; }).filter((e): e is T => e !== null);

/** Ein gelesener Bestand in sauberer Form — oder null, wenn es keinen gibt. Kürzt nie. */
export function koerperSaeubern(roh: unknown): KoerperStand | null {
  const o = obj(roh);
  if (!o) return null;
  const sym = obj(o.symptom);
  const k: KoerperStand = {
    v: 1,
    leitsatz: str(o.leitsatz),
    beschwerden: liste(o.beschwerden, e => ({ id: e.id as string, name: str(e.name), status: str(e.status), notiz: str(e.notiz), ton: KOERPER_TOENE.includes(e.ton as KoerperTon) ? e.ton as KoerperTon : 'achtung' })),
    hebel: liste(o.hebel, e => ({ id: e.id as string, name: str(e.name), notiz: str(e.notiz), ...(typeof e.kennzahl === 'string' && KENNZAHL_OK.test(e.kennzahl) ? { kennzahl: e.kennzahl } : {}) })),
    stufen: liste(o.stufen, e => ({ id: e.id as string, phase: str(e.phase), name: str(e.name), beschreibung: str(e.beschreibung), zustand: STUFEN_ZUSTAENDE.includes(e.zustand as StufenZustand) ? e.zustand as StufenZustand : 'spaeter' })),
    zusammenhaenge: liste(o.zusammenhaenge, e => ({ id: e.id as string, text: str(e.text) })),
    hinweis: str(o.hinweis),
    symptom: sym && str(sym.name).trim() ? { name: str(sym.name) } : null,
    sauberZaehler: o.sauberZaehler === true,
    routinenHinweise: liste(o.routinenHinweise, e => (typeof e.routine === 'string' && ROUTINE_OK.test(e.routine) ? { id: e.id as string, routine: e.routine, text: str(e.text) } : null)),
  };
  const modulEinstellung = modulEinstellungSaeubern(o.module);
  if (modulEinstellung) k.module = modulEinstellung;
  if (typeof o.altbestand === 'string') k.altbestand = o.altbestand;
  if (typeof o.geaendert === 'string') k.geaendert = o.geaendert;
  return k;
}

/** Steht etwas im Profil (KI-Kontext)? Die Anzeige-Einstellungen (Symptom-Regler, Zähler, Module) zählen nicht. */
export function koerperHatInhalt(k: KoerperStand | null): boolean {
  if (!k) return false;
  return !!(k.leitsatz.trim() || k.hinweis.trim() || k.beschwerden.length || k.hebel.length || k.stufen.length || k.zusammenhaenge.length);
}

/** Der Hinweis unter einer Routine der Tagesliste (oder undefined). */
export function routinenHinweis(k: KoerperStand | null, routine: string): string | undefined {
  return k?.routinenHinweise.find(h => h.routine === routine)?.text || undefined;
}

// ── Änderungs-Schritte ──────────────────────────────────────────────────────────────────────────────────────────────

export type KoerperOp =
  | { op: 'anlegen' }
  | { op: 'felder'; felder: { leitsatz?: string; hinweis?: string; symptom?: KoerperSymptom | null; sauberZaehler?: boolean } }
  | { op: 'eintrag'; liste: KoerperListe; eintrag: Record<string, unknown> }
  | { op: 'weg'; liste: KoerperListe; id: string }
  /** Ein Modul ein- oder ausschalten (09.10.) — `serie` stellt `sauberZaehler` mit (der ältere Stand liest nur dieses Feld). */
  | { op: 'modul'; modul: GesundheitModul; an: boolean };

/** Nur Module ausschalten? Das darf die Person auch ohne Einwilligung (a) — es verarbeitet nichts, es hört auf (Route). */
export function nurModuleAus(ops: unknown): boolean {
  return Array.isArray(ops) && ops.length > 0 && ops.every(o => !!o && typeof o === 'object' && (o as { op?: unknown }).op === 'modul' && (o as { an?: unknown }).an === false);
}

function text(x: unknown, feld: string, max: number, pflicht = false): string {
  if (x === undefined || x === null) { if (pflicht) throw new KoerperFehler(400, `${feld} fehlt.`); return ''; }
  if (typeof x !== 'string') throw new KoerperFehler(400, `${feld}: bitte als Text.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x)) throw new KoerperFehler(400, `${feld}: enthält Steuerzeichen.`);
  if (x.length > max) throw new KoerperFehler(413, `${feld} ist länger als ${max} Zeichen — nicht gespeichert (es wird nichts gekürzt).`);
  if (pflicht && !x.trim()) throw new KoerperFehler(400, `${feld} fehlt.`);
  return x;
}

function eintragPruefen(l: KoerperListe, e: Record<string, unknown>, id: string): KoerperStand[KoerperListe][number] {
  const G = KOERPER_GRENZEN;
  switch (l) {
    case 'beschwerden': {
      if (e.ton !== undefined && !KOERPER_TOENE.includes(e.ton as KoerperTon)) throw new KoerperFehler(400, 'Ton: gut, achtung oder kritisch.');
      return { id, name: text(e.name, 'Name', G.name, true), status: text(e.status, 'Status', G.status), notiz: text(e.notiz, 'Notiz', G.lang), ton: (e.ton as KoerperTon | undefined) ?? 'achtung' };
    }
    case 'hebel': {
      const kz = e.kennzahl === undefined || e.kennzahl === null || e.kennzahl === '' ? undefined : e.kennzahl;
      if (kz !== undefined && (typeof kz !== 'string' || !KENNZAHL_OK.test(kz))) throw new KoerperFehler(400, 'Kennzahl: ungültige Kennung.');
      return { id, name: text(e.name, 'Name', G.name, true), notiz: text(e.notiz, 'Notiz', G.lang), ...(kz ? { kennzahl: kz as string } : {}) };
    }
    case 'stufen': {
      if (e.zustand !== undefined && !STUFEN_ZUSTAENDE.includes(e.zustand as StufenZustand)) throw new KoerperFehler(400, 'Zustand: jetzt, danach oder spaeter.');
      return { id, phase: text(e.phase, 'Phase', G.status), name: text(e.name, 'Name', G.name, true), beschreibung: text(e.beschreibung, 'Beschreibung', G.lang), zustand: (e.zustand as StufenZustand | undefined) ?? 'spaeter' };
    }
    case 'zusammenhaenge':
      return { id, text: text(e.text, 'Text', G.satz, true) };
    case 'routinenHinweise': {
      if (typeof e.routine !== 'string' || !ROUTINE_OK.test(e.routine)) throw new KoerperFehler(400, 'Routine: ungültige Kennung.');
      return { id, routine: e.routine, text: text(e.text, 'Text', G.satz, true) };
    }
  }
}

/**
 * Wendet Schritte an (rein). Ohne Bestand legt jeder Schritt das Profil an. Wirft `KoerperFehler` — dann gilt KEIN
 * Schritt des Stapels (die Route speichert nichts). `neueId` nur für Tests austauschbar.
 */
export function koerperAnwenden(alt: KoerperStand | null, ops: unknown, neueId: (praefix: string) => string = neueKennung): KoerperStand {
  if (!Array.isArray(ops) || !ops.length) throw new KoerperFehler(400, 'Keine Änderungen.');
  if (ops.length > KOERPER_GRENZEN.ops) throw new KoerperFehler(413, `Mehr als ${KOERPER_GRENZEN.ops} Schritte auf einmal — nichts gespeichert.`);
  const k: KoerperStand = alt ? structuredClone(alt) : leererKoerper();
  for (const roh of ops) {
    const o = obj(roh);
    if (!o) throw new KoerperFehler(400, 'Ungültiger Schritt.');
    if (o.op === 'anlegen') continue;
    if (o.op === 'modul') {
      if (typeof o.modul !== 'string' || !(GESUNDHEIT_MODULE as readonly string[]).includes(o.modul)) throw new KoerperFehler(400, 'Unbekanntes Modul.');
      if (typeof o.an !== 'boolean') throw new KoerperFehler(400, 'Modul: an oder aus.');
      const m = o.modul as GesundheitModul;
      k.module = { ...(k.module ?? {}), [m]: o.an };
      if (m === 'serie') k.sauberZaehler = o.an;
      continue;
    }
    if (o.op === 'felder') {
      const f = obj(o.felder);
      if (!f) throw new KoerperFehler(400, 'Felder fehlen.');
      for (const key of Object.keys(f)) if (!['leitsatz', 'hinweis', 'symptom', 'sauberZaehler'].includes(key)) throw new KoerperFehler(400, `Unbekanntes Feld „${key.slice(0, 40)}“.`);
      if ('leitsatz' in f) k.leitsatz = text(f.leitsatz, 'Leitsatz', KOERPER_GRENZEN.leitsatz);
      if ('hinweis' in f) k.hinweis = text(f.hinweis, 'Hinweistext', KOERPER_GRENZEN.lang);
      if ('symptom' in f) {
        const s = f.symptom === null ? null : obj(f.symptom);
        if (f.symptom !== null && !s) throw new KoerperFehler(400, 'Symptom: bitte { name } oder null.');
        const name = s ? text(s.name, 'Name des Symptoms', KOERPER_GRENZEN.name) : '';
        k.symptom = name.trim() ? { name } : null;
      }
      if ('sauberZaehler' in f) {
        if (typeof f.sauberZaehler !== 'boolean') throw new KoerperFehler(400, 'Zähler: an oder aus.');
        k.sauberZaehler = f.sauberZaehler;
        k.module = { ...(k.module ?? {}), serie: f.sauberZaehler }; // der Zähler IST das Modul `serie` (ausdrücklich gesetzt)
      }
      continue;
    }
    const l = o.liste as KoerperListe;
    if (!KOERPER_LISTEN.includes(l)) throw new KoerperFehler(400, 'Unbekannte Liste.');
    if (o.op === 'weg') {
      if (typeof o.id !== 'string') throw new KoerperFehler(400, 'Kennung fehlt.');
      const listen = k as unknown as Record<KoerperListe, { id: string }[]>;
      const vorher = listen[l].length;
      listen[l] = listen[l].filter(e => e.id !== o.id);
      if (listen[l].length === vorher) throw new KoerperFehler(404, 'Eintrag nicht gefunden.');
      continue;
    }
    if (o.op === 'eintrag') {
      const e = obj(o.eintrag);
      if (!e) throw new KoerperFehler(400, 'Eintrag fehlt.');
      const vorhanden = typeof e.id === 'string' ? (k[l] as { id: string }[]).findIndex(x => x.id === e.id) : -1;
      if (typeof e.id === 'string' && vorhanden < 0) throw new KoerperFehler(404, 'Eintrag nicht gefunden.');
      if (e.id !== undefined && typeof e.id !== 'string') throw new KoerperFehler(400, 'Kennung: bitte als Text.');
      const id = vorhanden >= 0 ? e.id as string : neueId(PRAEFIX[l]);
      const neu = eintragPruefen(l, e, id);
      const arr = [...k[l]] as unknown[];
      if (vorhanden >= 0) arr[vorhanden] = neu;
      else {
        if (arr.length >= KOERPER_GRENZEN.eintraege) throw new KoerperFehler(413, `Höchstens ${KOERPER_GRENZEN.eintraege} Einträge je Liste — nichts gespeichert.`);
        arr.push(neu);
      }
      (k as unknown as Record<KoerperListe, unknown[]>)[l] = arr;
      continue;
    }
    throw new KoerperFehler(400, 'Unbekannter Schritt.');
  }
  return k;
}

/** Link auf eine Kennzahl des Gesundheits-Index (eigene Ansicht). */
export const kennzahlLink = (kennzahl: string): string => `/os/gesundheit?s=index&k=${encodeURIComponent(kennzahl)}`;

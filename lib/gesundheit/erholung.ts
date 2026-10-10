// ─── Erholung je Person — das Modell (Auftrag 10.10.: „Einen Erholungsbereich … der muss auch überall mit einstellbar sein“) ──────
// Auftrag 10.10.: manche müssen extrem viel erholen bzw. Reha machen, andere nach dem Sport. Darum EIN eigener Bestand je Person:
// `erholung--<person>` (IMMER mit Suffix — auch beim Erstkonto; `erholungName`), verschlüsselt wie jeder Bestand, Art. 9 (Gesundheit).
// Gelesen und geschrieben NUR über /api/gesundheit/erholung: schreiben nur die Person selbst (Einwilligung (a) zuerst), lesen eine
// andere Person nur, wenn die Person ihre Gesundheit mit ihr teilt (`darfGesundheitSehen`) — und dann ohne Unterlagen-Verweise
// (`erholungFuerBetrachter`).
//
// Inhalt (alles Daten der Person — NIE eine Beschwerde, Diagnose oder ein Programm einer bestimmten Person im Code):
//   programme     eigene Reha-/Übungsprogramme: Name, Ziel, Übungen (Dauer/Wiederholungen), Häufigkeit je Woche, feste Tage oder
//                 flexibel, Stufe/Phase, aktiv · pausiert · beendet
//   einheiten     erledigte Einheiten (Tag, Programm oder Erholungsart aus der Vorlagen-Bibliothek, Minuten) — ein Protokoll
//   behandlungen  Behandlungsserien (Art frei, „6 von 10“, Termine mit Verweis auf einen Kalender-Termin NUR über die Kennung —
//                 nie der Titel —, Verweise auf eigene Gesundheits-Unterlagen NUR über die Kennung `gu-…`)
//   ziele         Erholungs-Ziele je Woche/Monat (Einheiten und/oder Minuten, optional an EIN Programm gebunden)
//   fokus         ein eigener Satz „Worauf es bei meiner Erholung gerade ankommt“
//   einstellungen Pausen-Erinnerung im Arbeitstag, Vorschlag aus den Körperwerten an/aus
//
// Rein (Server UND Browser): Form, Säuberung beim Lesen (nie kürzen), Grenzen, Änderungs-Schritte. Über einer Grenze wird abgelehnt
// (413), nie gekürzt; ein ungültiger Schritt lässt den ganzen Stapel liegen (400). Die Rechnungen (heute fällig, Woche, Streak,
// Vorschlag, Zusammenhang) stehen in ./erholung-lage.ts.

import { neueKennung } from '@/lib/kennung';

/** Bestandsname — IMMER mit Suffix (auch das Erstkonto), damit nie ein Bestand ohne Person entsteht. */
export const erholungName = (person: string): string => `erholung--${person.replace(/[^a-z0-9-]/g, '')}`;

/** Hinweis an jeder Karte, die etwas vorschlägt. */
export const ERHOLUNG_HINWEIS = 'Vorschlag aus deinen eigenen Werten und Einträgen — keine ärztliche oder therapeutische Beratung.';

// ── Vorlagen-Bibliothek: NEUTRALE Erholungsarten (keine Diagnosen, keine Körperstelle einer Person) ──────────────────────────────

export type ErholungArt =
  | 'mobility' | 'dehnen' | 'kraeftigung' | 'atem' | 'waerme' | 'kaelte' | 'massage' | 'physio' | 'spaziergang' | 'mittagsruhe' | 'bildschirmpause' | 'eigene';
export interface ErholungVorlage { id: ErholungArt; name: string; minuten: number; proWoche: number; satz: string }
export const ERHOLUNG_VORLAGEN: readonly ErholungVorlage[] = [
  { id: 'mobility', name: 'Mobility', minuten: 15, proWoche: 4, satz: 'Ruhig durch den ganzen Bewegungsumfang — ohne Druck.' },
  { id: 'dehnen', name: 'Dehnen', minuten: 10, proWoche: 4, satz: 'Langsam, ohne Schmerz, mit ruhigem Atem.' },
  { id: 'kraeftigung', name: 'Kräftigung', minuten: 20, proWoche: 3, satz: 'Leichte Kräftigung mit sauberer Technik.' },
  { id: 'atem', name: 'Atemübung', minuten: 5, proWoche: 7, satz: 'Ein paar Minuten langsam ausatmen — zwischendurch oder abends.' },
  { id: 'waerme', name: 'Wärme / Sauna', minuten: 20, proWoche: 2, satz: 'Wärme zum Runterkommen.' },
  { id: 'kaelte', name: 'Kälte', minuten: 5, proWoche: 2, satz: 'Kurz und kontrolliert.' },
  { id: 'massage', name: 'Massage / Faszienrolle', minuten: 10, proWoche: 2, satz: 'Selbst oder mit Unterstützung.' },
  { id: 'physio', name: 'Physiotherapie-Übungen', minuten: 20, proWoche: 3, satz: 'Die Übungen aus deiner Behandlung — selbst eingetragen.' },
  { id: 'spaziergang', name: 'Spaziergang', minuten: 20, proWoche: 5, satz: 'Locker gehen, am besten draußen.' },
  { id: 'mittagsruhe', name: 'Mittagsruhe', minuten: 15, proWoche: 5, satz: 'Kurz hinlegen oder still sitzen.' },
  { id: 'bildschirmpause', name: 'Bildschirmpause', minuten: 5, proWoche: 10, satz: 'Aufstehen, weg vom Bildschirm, kurz bewegen.' },
];
export const ERHOLUNG_ARTEN: readonly ErholungArt[] = [...ERHOLUNG_VORLAGEN.map(v => v.id), 'eigene'];
export const istErholungArt = (v: unknown): v is ErholungArt => typeof v === 'string' && (ERHOLUNG_ARTEN as readonly string[]).includes(v);
export const erholungArtName = (a?: string): string => ERHOLUNG_VORLAGEN.find(v => v.id === a)?.name ?? 'Erholung';

// ── Form ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ProgrammStatus = 'aktiv' | 'pausiert' | 'beendet';
export const PROGRAMM_STATUS: readonly ProgrammStatus[] = ['aktiv', 'pausiert', 'beendet'];
export const PROGRAMM_STATUS_NAME: Record<ProgrammStatus, string> = { aktiv: 'aktiv', pausiert: 'pausiert', beendet: 'beendet' };

export interface ErholungUebung {
  id: string; name: string;
  /** Dauer in Minuten (1–600). */
  minuten?: number;
  /** Wiederholungen je Satz (1–500). */
  wiederholungen?: number;
  /** Sätze (1–50). */
  saetze?: number;
  notiz?: string;
}
export interface ErholungProgramm {
  id: string; name: string;
  /** Wofür (eigener Satz der Person). */
  ziel?: string;
  /** Erholungsart aus der Vorlagen-Bibliothek (Anzeige, Farbe) — `eigene` = frei. */
  art: ErholungArt;
  uebungen: ErholungUebung[];
  /** Häufigkeit je Woche (1–14). */
  proWoche: number;
  /** Feste Wochentage 1 = Mo … 7 = So — leer = flexibel (fällig, bis die Woche ihr Soll hat). */
  tage: number[];
  /** Stufe/Phase (frei, z. B. „Phase 2“). */
  stufe?: string;
  status: ProgrammStatus;
  angelegt: string;
}
export interface ErholungEinheit {
  id: string;
  /** Berliner Tag YYYY-MM-DD. */
  tag: string;
  programmId?: string;
  art: ErholungArt;
  /** Minuten (1–600) — ohne Angabe die Dauer des Programms bzw. der Vorlage. */
  minuten?: number;
  notiz?: string;
  /** Zeitpunkt des Eintrags (ISO, setzt der Server). */
  am: string;
}
export interface BehandlungTermin {
  id: string;
  tag: string;
  /** HH:MM (optional). */
  uhr?: string;
  /** Verweis auf einen Kalender-Termin (Schlüssel `kalender|uid` bzw. UID) — nur die Kennung, nie der Titel. */
  terminId?: string;
  erledigt: boolean;
}
export type BehandlungStatus = 'laeuft' | 'pausiert' | 'abgeschlossen';
export const BEHANDLUNG_STATUS: readonly BehandlungStatus[] = ['laeuft', 'pausiert', 'abgeschlossen'];
export const BEHANDLUNG_STATUS_NAME: Record<BehandlungStatus, string> = { laeuft: 'läuft', pausiert: 'pausiert', abgeschlossen: 'abgeschlossen' };
export interface Behandlung {
  id: string;
  /** Art frei (z. B. „Physiotherapie“, „Massage“) — Text der Person. */
  art: string;
  /** Wie viele Termine die Serie hat („von 10“) — optional. */
  geplant?: number;
  termine: BehandlungTermin[];
  /** Kennungen eigener Gesundheits-Unterlagen (`gu-…`) — nur die Person selbst sieht sie. */
  unterlagen: string[];
  notiz?: string;
  status: BehandlungStatus;
  angelegt: string;
}
export type ZielZeitraum = 'woche' | 'monat';
export interface ErholungZiel {
  id: string; titel: string;
  zeitraum: ZielZeitraum;
  /** Soll an Einheiten im Zeitraum. */
  einheiten?: number;
  /** Soll an Minuten im Zeitraum. */
  minuten?: number;
  /** Nur Einheiten dieses Programms zählen (sonst jede Erholung). */
  programmId?: string;
}
export interface PausenEinstellung {
  an: boolean;
  /** Alle wie viele Minuten (30–240). */
  alleMin: number;
  /** Arbeitstag von/bis HH:MM. */
  von: string; bis: string;
}
export interface ErholungEinstellungen {
  pausen?: PausenEinstellung;
  /** Vorschlag aus den Körperwerten zeigen (Vorgabe an). */
  vorschlag?: boolean;
}
export interface ErholungStand {
  v: 1;
  programme: ErholungProgramm[];
  einheiten: ErholungEinheit[];
  behandlungen: Behandlung[];
  ziele: ErholungZiel[];
  fokus: string;
  einstellungen: ErholungEinstellungen;
  /** Zeitpunkt der letzten Änderung (setzt der Server). */
  geaendert?: string;
}

export const ERHOLUNG_GRENZEN = {
  ops: 50, programme: 40, uebungen: 40, einheiten: 5000, behandlungen: 40, termine: 200, unterlagen: 20, ziele: 20,
  name: 120, ziel: 300, notiz: 1000, fokus: 300, stufe: 60, art: 80,
} as const;

export class ErholungFehler extends Error { constructor(readonly status: 400 | 404 | 413, msg: string) { super(msg); } }

export const leereErholung = (): ErholungStand => ({ v: 1, programme: [], einheiten: [], behandlungen: [], ziele: [], fokus: '', einstellungen: {} });

// ── Säuberung beim Lesen (nie kürzen — was die Grenze sprengt, kommt beim Schreiben gar nicht erst hinein) ────────────────────

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const UNTERLAGE = /^gu-[a-z0-9-]{1,80}$/;
const TERMIN = /^[^\s<>"'`]{1,400}$/;
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined);
const zahl = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);
const istTag = (v: unknown): v is string => typeof v === 'string' && TAG.test(v);
const ohneUndef = <T extends object>(o: T): T => { for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k]; return o; };

function uebungLesen(v: unknown): ErholungUebung | null {
  const o = obj(v); if (!o || typeof o.id !== 'string') return null;
  const name = str(o.name, ERHOLUNG_GRENZEN.name); if (!name) return null;
  return ohneUndef({ id: o.id.slice(0, 90), name, minuten: zahl(o.minuten, 1, 600), wiederholungen: zahl(o.wiederholungen, 1, 500), saetze: zahl(o.saetze, 1, 50), notiz: str(o.notiz, ERHOLUNG_GRENZEN.notiz) });
}
function programmLesen(v: unknown): ErholungProgramm | null {
  const o = obj(v); if (!o || typeof o.id !== 'string') return null;
  const name = str(o.name, ERHOLUNG_GRENZEN.name); if (!name) return null;
  return ohneUndef({
    id: o.id.slice(0, 90), name, ziel: str(o.ziel, ERHOLUNG_GRENZEN.ziel), art: istErholungArt(o.art) ? o.art : 'eigene',
    uebungen: Array.isArray(o.uebungen) ? o.uebungen.map(uebungLesen).filter((x): x is ErholungUebung => !!x) : [],
    proWoche: zahl(o.proWoche, 1, 14) ?? 1,
    tage: Array.isArray(o.tage) ? Array.from(new Set(o.tage.filter((t): t is number => Number.isInteger(t) && (t as number) >= 1 && (t as number) <= 7))).sort() : [],
    stufe: str(o.stufe, ERHOLUNG_GRENZEN.stufe),
    status: (PROGRAMM_STATUS as readonly unknown[]).includes(o.status) ? o.status as ProgrammStatus : 'aktiv',
    angelegt: typeof o.angelegt === 'string' ? o.angelegt.slice(0, 40) : '',
  });
}
function einheitLesen(v: unknown): ErholungEinheit | null {
  const o = obj(v); if (!o || typeof o.id !== 'string' || !istTag(o.tag)) return null;
  return ohneUndef({
    id: o.id.slice(0, 90), tag: o.tag, programmId: typeof o.programmId === 'string' ? o.programmId.slice(0, 90) : undefined,
    art: istErholungArt(o.art) ? o.art : 'eigene', minuten: zahl(o.minuten, 1, 600), notiz: str(o.notiz, ERHOLUNG_GRENZEN.notiz),
    am: typeof o.am === 'string' ? o.am.slice(0, 40) : '',
  });
}
function terminLesen(v: unknown): BehandlungTermin | null {
  const o = obj(v); if (!o || typeof o.id !== 'string' || !istTag(o.tag)) return null;
  return ohneUndef({ id: o.id.slice(0, 90), tag: o.tag, uhr: typeof o.uhr === 'string' && UHR.test(o.uhr) ? o.uhr : undefined, terminId: typeof o.terminId === 'string' && TERMIN.test(o.terminId) ? o.terminId : undefined, erledigt: o.erledigt === true });
}
function behandlungLesen(v: unknown): Behandlung | null {
  const o = obj(v); if (!o || typeof o.id !== 'string') return null;
  const art = str(o.art, ERHOLUNG_GRENZEN.art); if (!art) return null;
  return ohneUndef({
    id: o.id.slice(0, 90), art, geplant: zahl(o.geplant, 1, 200),
    termine: Array.isArray(o.termine) ? o.termine.map(terminLesen).filter((x): x is BehandlungTermin => !!x).sort((a, b) => a.tag.localeCompare(b.tag) || (a.uhr ?? '').localeCompare(b.uhr ?? '')) : [],
    unterlagen: Array.isArray(o.unterlagen) ? Array.from(new Set(o.unterlagen.filter((u): u is string => typeof u === 'string' && UNTERLAGE.test(u)))) : [],
    notiz: str(o.notiz, ERHOLUNG_GRENZEN.notiz),
    status: (BEHANDLUNG_STATUS as readonly unknown[]).includes(o.status) ? o.status as BehandlungStatus : 'laeuft',
    angelegt: typeof o.angelegt === 'string' ? o.angelegt.slice(0, 40) : '',
  });
}
function zielLesen(v: unknown): ErholungZiel | null {
  const o = obj(v); if (!o || typeof o.id !== 'string') return null;
  const titel = str(o.titel, ERHOLUNG_GRENZEN.name); if (!titel) return null;
  const einheiten = zahl(o.einheiten, 1, 100), minuten = zahl(o.minuten, 1, 10_000);
  if (!einheiten && !minuten) return null;
  return ohneUndef({ id: o.id.slice(0, 90), titel, zeitraum: (o.zeitraum === 'monat' ? 'monat' : 'woche') as ZielZeitraum, einheiten, minuten, programmId: typeof o.programmId === 'string' ? o.programmId.slice(0, 90) : undefined });
}
function pausenLesen(v: unknown): PausenEinstellung | undefined {
  const o = obj(v); if (!o) return undefined;
  const von = typeof o.von === 'string' && UHR.test(o.von) ? o.von : '09:00', bis = typeof o.bis === 'string' && UHR.test(o.bis) ? o.bis : '17:00';
  return { an: o.an === true, alleMin: zahl(o.alleMin, 30, 240) ?? 90, von, bis };
}

/** Bestand säubern — null ohne Bestand. Nur bekannte Felder, nie gekürzt. */
export function erholungSaeubern(roh: unknown): ErholungStand | null {
  const o = obj(roh); if (!o) return null;
  const e = obj(o.einstellungen) ?? {};
  return ohneUndef({
    v: 1 as const,
    programme: Array.isArray(o.programme) ? o.programme.map(programmLesen).filter((x): x is ErholungProgramm => !!x) : [],
    einheiten: Array.isArray(o.einheiten) ? o.einheiten.map(einheitLesen).filter((x): x is ErholungEinheit => !!x) : [],
    behandlungen: Array.isArray(o.behandlungen) ? o.behandlungen.map(behandlungLesen).filter((x): x is Behandlung => !!x) : [],
    ziele: Array.isArray(o.ziele) ? o.ziele.map(zielLesen).filter((x): x is ErholungZiel => !!x) : [],
    fokus: typeof o.fokus === 'string' ? o.fokus.slice(0, ERHOLUNG_GRENZEN.fokus) : '',
    einstellungen: ohneUndef({ pausen: pausenLesen(e.pausen), vorschlag: typeof e.vorschlag === 'boolean' ? e.vorschlag : undefined }),
    geaendert: typeof o.geaendert === 'string' ? o.geaendert.slice(0, 40) : undefined,
  });
}

/** Hat die Person überhaupt etwas eingetragen? (Leerzustand der Oberfläche, Demo.) */
export const erholungHatInhalt = (s: ErholungStand | null | undefined): boolean =>
  !!s && (s.programme.length > 0 || s.einheiten.length > 0 || s.behandlungen.length > 0 || s.ziele.length > 0 || !!s.fokus.trim());

/**
 * Was eine ANDERE Person sieht, mit der die Gesundheit geteilt ist (lesen, nie schreiben): alles außer den Verweisen auf die eigenen
 * Gesundheits-Unterlagen (die sieht auch bei „Teilen“ nur die Person selbst) und den Verweisen auf Kalender-Termine (deren Inhalt
 * sieht die andere Person ohnehin nur „Belegt“). Die Pausen-Einstellung ist Arbeitsalltag der Person — bleibt bei ihr.
 */
export function erholungFuerBetrachter(s: ErholungStand): ErholungStand {
  return {
    ...s,
    behandlungen: s.behandlungen.map(b => ({ ...b, unterlagen: [], termine: b.termine.map(t => { const { terminId: _t, ...rest } = t; void _t; return rest; }) })),
    einstellungen: s.einstellungen.vorschlag === undefined ? {} : { vorschlag: s.einstellungen.vorschlag },
  };
}

// ── Änderungs-Schritte ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Text prüfen: Pflicht/optional, Länge (sonst 413). */
function text(v: unknown, was: string, max: number, pflicht = false): string | undefined {
  if (v === undefined || v === null) { if (pflicht) throw new ErholungFehler(400, `${was} fehlt.`); return undefined; }
  if (typeof v !== 'string') throw new ErholungFehler(400, `${was}: bitte Text.`);
  const t = v.trim();
  if (t.length > max) throw new ErholungFehler(413, `${was}: höchstens ${max} Zeichen — nichts gespeichert.`);
  if (pflicht && !t) throw new ErholungFehler(400, `${was} fehlt.`);
  return t || undefined;
}
function ganz(v: unknown, was: string, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new ErholungFehler(400, `${was}: eine ganze Zahl von ${min} bis ${max}.`);
  return v;
}
function tagPruefen(v: unknown, was = 'Tag'): string {
  if (!istTag(v)) throw new ErholungFehler(400, `${was}: bitte JJJJ-MM-TT.`);
  return v;
}
function uebungenPruefen(v: unknown, neueId: (p: string) => string): ErholungUebung[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ErholungFehler(400, 'Übungen: bitte eine Liste.');
  if (v.length > ERHOLUNG_GRENZEN.uebungen) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.uebungen} Übungen je Programm — nichts gespeichert.`);
  return v.map((u, i) => {
    const o = obj(u); if (!o) throw new ErholungFehler(400, `Übung ${i + 1}: ungültig.`);
    return ohneUndef({
      id: typeof o.id === 'string' && /^[a-z0-9-]{1,90}$/.test(o.id) ? o.id : neueId('eu'),
      name: text(o.name, `Übung ${i + 1}: Name`, ERHOLUNG_GRENZEN.name, true)!,
      minuten: ganz(o.minuten, 'Minuten', 1, 600), wiederholungen: ganz(o.wiederholungen, 'Wiederholungen', 1, 500), saetze: ganz(o.saetze, 'Sätze', 1, 50),
      notiz: text(o.notiz, 'Notiz der Übung', ERHOLUNG_GRENZEN.notiz),
    });
  });
}
function tagePruefen(v: unknown): number[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some(t => !Number.isInteger(t) || t < 1 || t > 7)) throw new ErholungFehler(400, 'Tage: Liste von 1 (Mo) bis 7 (So).');
  return Array.from(new Set(v as number[])).sort();
}

type Liste = 'programme' | 'behandlungen' | 'ziele' | 'einheiten';
const LISTEN: readonly Liste[] = ['programme', 'behandlungen', 'ziele', 'einheiten'];
const finde = <T extends { id: string }>(l: T[], id: unknown, was: string): T => {
  const x = typeof id === 'string' ? l.find(e => e.id === id) : undefined;
  if (!x) throw new ErholungFehler(404, `${was} nicht gefunden — vielleicht schon entfernt. Neu laden.`);
  return x;
};

/**
 * Schritte auf den Bestand anwenden (rein). Arten:
 *   programm        { programm: {name, ziel?, art?, uebungen?, proWoche?, tage?, stufe?, status?}, id? }  anlegen bzw. ändern (id)
 *   behandlung      { behandlung: {art, geplant?, notiz?, status?, unterlagen?}, id? }
 *   behandlung-termin { id, termin: {tag, uhr?, terminId?, erledigt?}, terminKennung? }  Termin anlegen/ändern
 *   behandlung-termin-weg { id, terminKennung }
 *   ziel            { ziel: {titel, zeitraum, einheiten?, minuten?, programmId?}, id? }
 *   einheit         { einheit: {tag, programmId?, art?, minuten?, notiz?} }   erledigt eintragen (je Programm und Tag einmal)
 *   einheit-weg     { id }  bzw. { programmId, tag }  (Abhaken zurücknehmen)
 *   weg             { liste, id }
 *   fokus           { text }
 *   einstellungen   { pausen?, vorschlag? }
 */
export function erholungAnwenden(alt: ErholungStand | null, ops: unknown, jetzt: string, neueId: (praefix: string) => string = neueKennung): ErholungStand {
  if (!Array.isArray(ops) || !ops.length) throw new ErholungFehler(400, 'Keine Änderungen.');
  if (ops.length > ERHOLUNG_GRENZEN.ops) throw new ErholungFehler(413, `Mehr als ${ERHOLUNG_GRENZEN.ops} Schritte auf einmal — nichts gespeichert.`);
  const s: ErholungStand = alt ? structuredClone(alt) : leereErholung();
  for (const roh of ops) {
    const o = obj(roh);
    if (!o) throw new ErholungFehler(400, 'Ungültiger Schritt.');
    switch (o.op) {
      case 'programm': {
        const p = obj(o.programm); if (!p) throw new ErholungFehler(400, 'Programm fehlt.');
        const vorher = o.id !== undefined ? finde(s.programme, o.id, 'Programm') : null;
        if (!vorher && s.programme.length >= ERHOLUNG_GRENZEN.programme) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.programme} Programme — erst ein beendetes entfernen. Nichts gespeichert.`);
        if (p.art !== undefined && !istErholungArt(p.art)) throw new ErholungFehler(400, 'Unbekannte Erholungsart.');
        if (p.status !== undefined && !(PROGRAMM_STATUS as readonly unknown[]).includes(p.status)) throw new ErholungFehler(400, 'Status: aktiv, pausiert oder beendet.');
        const neu: ErholungProgramm = ohneUndef({
          id: vorher?.id ?? neueId('ep'),
          name: 'name' in p ? text(p.name, 'Name des Programms', ERHOLUNG_GRENZEN.name, true)! : vorher?.name ?? text(undefined, 'Name des Programms', ERHOLUNG_GRENZEN.name, true)!,
          ziel: 'ziel' in p ? text(p.ziel, 'Ziel', ERHOLUNG_GRENZEN.ziel) : vorher?.ziel,
          art: (p.art as ErholungArt | undefined) ?? vorher?.art ?? 'eigene',
          uebungen: 'uebungen' in p ? uebungenPruefen(p.uebungen, neueId) : vorher?.uebungen ?? [],
          proWoche: 'proWoche' in p ? ganz(p.proWoche, 'Häufigkeit je Woche', 1, 14) ?? 1 : vorher?.proWoche ?? 3,
          tage: 'tage' in p ? tagePruefen(p.tage) : vorher?.tage ?? [],
          stufe: 'stufe' in p ? text(p.stufe, 'Stufe', ERHOLUNG_GRENZEN.stufe) : vorher?.stufe,
          status: (p.status as ProgrammStatus | undefined) ?? vorher?.status ?? 'aktiv',
          angelegt: vorher?.angelegt ?? jetzt,
        });
        s.programme = vorher ? s.programme.map(x => (x.id === vorher.id ? neu : x)) : [...s.programme, neu];
        break;
      }
      case 'behandlung': {
        const b = obj(o.behandlung); if (!b) throw new ErholungFehler(400, 'Behandlung fehlt.');
        const vorher = o.id !== undefined ? finde(s.behandlungen, o.id, 'Behandlung') : null;
        if (!vorher && s.behandlungen.length >= ERHOLUNG_GRENZEN.behandlungen) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.behandlungen} Behandlungen — erst eine abgeschlossene entfernen. Nichts gespeichert.`);
        if (b.status !== undefined && !(BEHANDLUNG_STATUS as readonly unknown[]).includes(b.status)) throw new ErholungFehler(400, 'Status: läuft, pausiert oder abgeschlossen.');
        let unterlagen = vorher?.unterlagen ?? [];
        if ('unterlagen' in b) {
          if (!Array.isArray(b.unterlagen) || b.unterlagen.some(u => typeof u !== 'string' || !UNTERLAGE.test(u))) throw new ErholungFehler(400, 'Unterlagen: Kennungen deiner Gesundheits-Unterlagen (gu-…).');
          if (b.unterlagen.length > ERHOLUNG_GRENZEN.unterlagen) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.unterlagen} Unterlagen je Behandlung — nichts gespeichert.`);
          unterlagen = Array.from(new Set(b.unterlagen as string[]));
        }
        const neu: Behandlung = ohneUndef({
          id: vorher?.id ?? neueId('eb'),
          art: 'art' in b ? text(b.art, 'Art der Behandlung', ERHOLUNG_GRENZEN.art, true)! : vorher?.art ?? text(undefined, 'Art der Behandlung', ERHOLUNG_GRENZEN.art, true)!,
          geplant: 'geplant' in b ? ganz(b.geplant, 'Anzahl Termine', 1, 200) : vorher?.geplant,
          termine: vorher?.termine ?? [],
          unterlagen,
          notiz: 'notiz' in b ? text(b.notiz, 'Notiz', ERHOLUNG_GRENZEN.notiz) : vorher?.notiz,
          status: (b.status as BehandlungStatus | undefined) ?? vorher?.status ?? 'laeuft',
          angelegt: vorher?.angelegt ?? jetzt,
        });
        s.behandlungen = vorher ? s.behandlungen.map(x => (x.id === vorher.id ? neu : x)) : [...s.behandlungen, neu];
        break;
      }
      case 'behandlung-termin': {
        const b = finde(s.behandlungen, o.id, 'Behandlung');
        const t = obj(o.termin); if (!t) throw new ErholungFehler(400, 'Termin fehlt.');
        const vorher = o.terminKennung !== undefined ? finde(b.termine, o.terminKennung, 'Termin') : null;
        if (!vorher && b.termine.length >= ERHOLUNG_GRENZEN.termine) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.termine} Termine je Behandlung — nichts gespeichert.`);
        if ('uhr' in t && t.uhr !== null && t.uhr !== '' && (typeof t.uhr !== 'string' || !UHR.test(t.uhr))) throw new ErholungFehler(400, 'Uhrzeit: HH:MM.');
        if ('terminId' in t && t.terminId !== null && t.terminId !== '' && (typeof t.terminId !== 'string' || !TERMIN.test(t.terminId))) throw new ErholungFehler(400, 'Kalender-Verweis: ungültige Kennung.');
        const neu: BehandlungTermin = ohneUndef({
          id: vorher?.id ?? neueId('et'),
          tag: 'tag' in t ? tagPruefen(t.tag) : vorher?.tag ?? tagPruefen(undefined),
          uhr: 'uhr' in t ? (typeof t.uhr === 'string' && t.uhr ? t.uhr : undefined) : vorher?.uhr,
          terminId: 'terminId' in t ? (typeof t.terminId === 'string' && t.terminId ? t.terminId : undefined) : vorher?.terminId,
          erledigt: 'erledigt' in t ? t.erledigt === true : vorher?.erledigt ?? false,
        });
        const termine = vorher ? b.termine.map(x => (x.id === vorher.id ? neu : x)) : [...b.termine, neu];
        b.termine = termine.sort((x, y) => x.tag.localeCompare(y.tag) || (x.uhr ?? '').localeCompare(y.uhr ?? ''));
        break;
      }
      case 'behandlung-termin-weg': {
        const b = finde(s.behandlungen, o.id, 'Behandlung');
        finde(b.termine, o.terminKennung, 'Termin');
        b.termine = b.termine.filter(t => t.id !== o.terminKennung);
        break;
      }
      case 'ziel': {
        const z = obj(o.ziel); if (!z) throw new ErholungFehler(400, 'Ziel fehlt.');
        const vorher = o.id !== undefined ? finde(s.ziele, o.id, 'Ziel') : null;
        if (!vorher && s.ziele.length >= ERHOLUNG_GRENZEN.ziele) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.ziele} Erholungs-Ziele — nichts gespeichert.`);
        const einheiten = 'einheiten' in z ? ganz(z.einheiten, 'Einheiten', 1, 100) : vorher?.einheiten;
        const minuten = 'minuten' in z ? ganz(z.minuten, 'Minuten', 1, 10_000) : vorher?.minuten;
        if (!einheiten && !minuten) throw new ErholungFehler(400, 'Ein Ziel braucht Einheiten oder Minuten.');
        const programmId = 'programmId' in z ? (typeof z.programmId === 'string' && z.programmId ? finde(s.programme, z.programmId, 'Programm').id : undefined) : vorher?.programmId;
        const neu: ErholungZiel = ohneUndef({
          id: vorher?.id ?? neueId('ez'),
          titel: 'titel' in z ? text(z.titel, 'Titel', ERHOLUNG_GRENZEN.name, true)! : vorher?.titel ?? text(undefined, 'Titel', ERHOLUNG_GRENZEN.name, true)!,
          zeitraum: 'zeitraum' in z ? (z.zeitraum === 'monat' ? 'monat' : z.zeitraum === 'woche' ? 'woche' : (() => { throw new ErholungFehler(400, 'Zeitraum: woche oder monat.'); })()) : vorher?.zeitraum ?? 'woche',
          einheiten, minuten, programmId,
        });
        s.ziele = vorher ? s.ziele.map(x => (x.id === vorher.id ? neu : x)) : [...s.ziele, neu];
        break;
      }
      case 'einheit': {
        const e = obj(o.einheit); if (!e) throw new ErholungFehler(400, 'Einheit fehlt.');
        const tag = tagPruefen(e.tag);
        const programm = e.programmId !== undefined ? finde(s.programme, e.programmId, 'Programm') : null;
        if (e.art !== undefined && !istErholungArt(e.art)) throw new ErholungFehler(400, 'Unbekannte Erholungsart.');
        // Ein Programm zählt je Tag einmal (Abhaken ist idempotent) — freie Einheiten dürfen sich wiederholen.
        if (programm && s.einheiten.some(x => x.programmId === programm.id && x.tag === tag)) break;
        if (s.einheiten.length >= ERHOLUNG_GRENZEN.einheiten) throw new ErholungFehler(413, `Höchstens ${ERHOLUNG_GRENZEN.einheiten} Einheiten im Protokoll — nichts gespeichert.`);
        s.einheiten.push(ohneUndef({
          id: neueId('ee'), tag, programmId: programm?.id, art: (e.art as ErholungArt | undefined) ?? programm?.art ?? 'eigene',
          minuten: ganz(e.minuten, 'Minuten', 1, 600), notiz: text(e.notiz, 'Notiz', ERHOLUNG_GRENZEN.notiz), am: jetzt,
        }));
        break;
      }
      case 'einheit-weg': {
        if (typeof o.id === 'string') { finde(s.einheiten, o.id, 'Einheit'); s.einheiten = s.einheiten.filter(x => x.id !== o.id); break; }
        const tag = tagPruefen(o.tag);
        if (typeof o.programmId !== 'string') throw new ErholungFehler(400, 'Kennung oder Programm + Tag fehlen.');
        s.einheiten = s.einheiten.filter(x => !(x.programmId === o.programmId && x.tag === tag));
        break;
      }
      case 'weg': {
        if (!(LISTEN as readonly unknown[]).includes(o.liste)) throw new ErholungFehler(400, 'Unbekannte Liste.');
        const l = o.liste as Liste;
        const liste = s[l] as { id: string }[];
        finde(liste, o.id, 'Eintrag');
        (s as unknown as Record<Liste, { id: string }[]>)[l] = liste.filter(x => x.id !== o.id);
        // Ein entferntes Programm nimmt seine Ziel-Bindung mit (die Ziele zählen danach jede Erholung); erledigte Einheiten bleiben im Protokoll.
        if (l === 'programme') s.ziele = s.ziele.map(z => (z.programmId === o.id ? (({ programmId: _p, ...r }) => { void _p; return r; })(z) : z));
        break;
      }
      case 'fokus': {
        s.fokus = text(o.text ?? '', 'Fokus-Satz', ERHOLUNG_GRENZEN.fokus) ?? '';
        break;
      }
      case 'einstellungen': {
        const e = obj(o.einstellungen); if (!e) throw new ErholungFehler(400, 'Einstellungen fehlen.');
        for (const k of Object.keys(e)) if (k !== 'pausen' && k !== 'vorschlag') throw new ErholungFehler(400, `Unbekannte Einstellung „${k.slice(0, 40)}“.`);
        if ('vorschlag' in e) { if (typeof e.vorschlag !== 'boolean') throw new ErholungFehler(400, 'Vorschlag: an oder aus.'); s.einstellungen.vorschlag = e.vorschlag; }
        if ('pausen' in e) {
          const p = obj(e.pausen); if (!p) throw new ErholungFehler(400, 'Pausen: { an, alleMin, von, bis }.');
          if (typeof p.an !== 'boolean') throw new ErholungFehler(400, 'Pausen: an oder aus.');
          const alleMin = ganz(p.alleMin, 'Pause alle … Minuten', 30, 240) ?? 90;
          const von = typeof p.von === 'string' && UHR.test(p.von) ? p.von : null, bis = typeof p.bis === 'string' && UHR.test(p.bis) ? p.bis : null;
          if (!von || !bis || von >= bis) throw new ErholungFehler(400, 'Arbeitstag: von und bis als HH:MM, von vor bis.');
          s.einstellungen.pausen = { an: p.an, alleMin, von, bis };
        }
        break;
      }
      default:
        throw new ErholungFehler(400, 'Unbekannter Schritt.');
    }
  }
  return s;
}

/** Schreibt der Stapel NUR das Zurücknehmen/Entfernen (verarbeitet nichts Neues)? — dann ohne Einwilligungs-Sperre erlaubt. */
export function nurEntfernen(ops: unknown): boolean {
  return Array.isArray(ops) && ops.length > 0 && ops.every(o => { const x = obj(o); return !!x && (x.op === 'weg' || x.op === 'einheit-weg' || x.op === 'behandlung-termin-weg'); });
}

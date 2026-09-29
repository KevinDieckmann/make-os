// ─── Meldungen (Glocke) — die reinen Regeln (28.09. abends, Paket B2) ─────────
// Ohne Platte, ohne Netz, ohne Uhr: alles, was entscheidet, WAS in der Glocke steht,
// steht hier und ist prüfbar (tests/meldungen.test.ts). Der Speicher (speicher.ts)
// liest/schreibt nur und ruft diese Regeln in EINER Sperre (updateJson).
//
// Regeln:
//  1. Nie an sich selbst: `von === an` wird nicht abgelegt.
//  2. Entdoppeln: je (Art, Bezug) höchstens EINE ungelesene Meldung — eine neuere ersetzt
//     die ältere ungelesene (Kevin weist dieselbe Aufgabe zweimal zu → eine Meldung).
//     Gelesene mit demselben Bezug bleiben als Verlauf stehen.
//  3. Grenze je Person `MELDUNGEN_MAX` (500): zuerst fallen die ältesten GELESENEN weg.
//     Ungelesene gehen nie still verloren — reicht das nicht, werden die ältesten
//     ungelesenen zu EINER Sammelmeldung „+N weitere Meldungen“ zusammengefasst
//     (Zähler `anzahl`, eine vorhandene Sammelmeldung wird mitgezählt).
//  4. Fällig/überfällig werden nie gespeichert, sondern beim Lesen aus den Aufgaben
//     abgeleitet (keine Dauer-Schreibläufe, Tempo-Befund 27.09.). Ihr Gelesen-Merker
//     gilt je Berliner Tag: morgen meldet sich eine noch offene überfällige Aufgabe neu.
//  5. Zuständig „both“ (gemeinsam) zählt für jede Person, die die Glocke sehen darf
//     (der Zugang ist schon auf den Haushalt des Inhabers begrenzt).

import type { MeldungArt, MeldungEingabe } from './melden';

export const MELDUNGEN_MAX = 500;
/** Längster Titel — länger wird abgelehnt, nicht gekürzt (Regel „nie abschneiden“). */
export const TITEL_MAX = 300;
/** Höchstens so viele Kennungen je „gelesen“-Aufruf — mehr → 413. */
export const GELESEN_IDS_MAX = 2000;

export const PERSON_OK = /^[a-z0-9-]{1,40}$/;
const BEZUG_ID_OK = /^[A-Za-z0-9_-]{1,80}$/;
export const MELDUNG_ID_OK = /^[A-Za-z0-9:_.-]{1,160}$/;
export const ARTEN: readonly MeldungArt[] = ['zuweisung', 'kommentar', 'erwaehnung', 'faellig', 'ueberfaellig', 'zoe', 'buchung'];

/** Gespeicherte Arten: die fünf der Schnittstelle + die Sammelmeldung der Grenze. */
export type GespeicherteArt = MeldungArt | 'sammel';
/** Nur abgeleitet, nie gespeichert (29.09., K2): Geburtstag am Vortag und am Tag (lib/kalender/quellen-geburtstage). */
export type AbgeleiteteArt = 'geburtstag';

export interface Meldung {
  id: string;
  art: GespeicherteArt | AbgeleiteteArt;
  titel: string;
  link: string;
  von?: string;
  bezug?: { art: 'aufgabe'; id: string };
  /** ISO-Zeitpunkt. */
  am: string;
  gelesen?: boolean;
  /** Nur bei `sammel`: wie viele Meldungen darin stecken. */
  anzahl?: number;
  /** Abgeleitet (fällig/überfällig), nicht gespeichert. */
  virtuell?: boolean;
}

export interface MeldungEinstellungen {
  /** Auch per Telegram melden — vorgesehen, standardmäßig aus; es wird noch NICHTS versendet. */
  telegram: boolean;
}

export interface MeldungenBestand {
  eintraege: Meldung[];
  einstellungen: MeldungEinstellungen;
  /** Gelesen-Merker der abgeleiteten Meldungen — gilt nur für diesen Berliner Tag. */
  faelligGelesen?: { tag: string; ids: string[] };
}

export const leererBestand = (): MeldungenBestand => ({ eintraege: [], einstellungen: { telegram: false } });

const istText = (v: unknown): v is string => typeof v === 'string';
const istArt = (v: unknown): v is GespeicherteArt => v === 'sammel' || (ARTEN as readonly unknown[]).includes(v);
const istLink = (v: unknown): v is string => istText(v) && v.length <= 500 && /^\/(?!\/)/.test(v);

/** Was von der Platte kommt, tolerant lesen — Unbrauchbares fällt weg, nie der ganze Bestand. */
export function bestandSaeubern(roh: unknown): MeldungenBestand {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Partial<MeldungenBestand>;
  const eintraege = (Array.isArray(o.eintraege) ? o.eintraege : []).filter((e): e is Meldung => {
    const m = e as Partial<Meldung> | null;
    return !!m && istText(m.id) && istArt(m.art) && istText(m.titel) && istText(m.link) && istText(m.am);
  });
  const fg = o.faelligGelesen;
  return {
    eintraege,
    einstellungen: { telegram: o.einstellungen?.telegram === true },
    ...(fg && istText(fg.tag) && Array.isArray(fg.ids) ? { faelligGelesen: { tag: fg.tag, ids: fg.ids.filter(istText) } } : {}),
  };
}

/** Eingabe der Schnittstelle prüfen. Nie kürzen — Unpassendes wird abgelehnt (mit Grund fürs Protokoll). */
export function pruefeEingabe(m: MeldungEingabe): { ok: true } | { ok: false; grund: string } {
  if (!m || typeof m !== 'object') return { ok: false, grund: 'keine Meldung' };
  if (!istText(m.an) || !PERSON_OK.test(m.an)) return { ok: false, grund: 'Empfänger ungültig' };
  if (m.von !== undefined && (!istText(m.von) || !PERSON_OK.test(m.von))) return { ok: false, grund: 'Auslöser ungültig' };
  if (m.von === m.an) return { ok: false, grund: 'nie an sich selbst' };
  if (!(ARTEN as readonly unknown[]).includes(m.art)) return { ok: false, grund: 'Art unbekannt' };
  if (!istText(m.titel) || !m.titel.trim()) return { ok: false, grund: 'Titel fehlt' };
  if (m.titel.length > TITEL_MAX) return { ok: false, grund: `Titel länger als ${TITEL_MAX} Zeichen` };
  if (!istLink(m.link)) return { ok: false, grund: 'Link muss ein Weg in MAKE OS sein' };
  if (m.bezug !== undefined && (m.bezug?.art !== 'aufgabe' || !istText(m.bezug.id) || !BEZUG_ID_OK.test(m.bezug.id))) return { ok: false, grund: 'Bezug ungültig' };
  return { ok: true };
}

/** Aus der geprüften Eingabe den gespeicherten Eintrag bauen. */
export function eintragAus(m: MeldungEingabe, id: string, am: string): Meldung {
  return {
    id, art: m.art, titel: m.titel.trim(), link: m.link, am,
    ...(m.von ? { von: m.von } : {}),
    ...(m.bezug ? { bezug: { art: 'aufgabe' as const, id: m.bezug.id } } : {}),
  };
}

const schluessel = (e: Meldung): string | null => (e.bezug ? `${e.art}|${e.bezug.art}:${e.bezug.id}` : null);
const neuesteZuerst = (a: Meldung, b: Meldung) => (a.am < b.am ? 1 : a.am > b.am ? -1 : 0);

/** Regel 2 + 3: einfügen, gleiche ungelesene (Art + Bezug) ersetzen, dann begrenzen. */
export function einfuegen(bestand: MeldungenBestand, neu: Meldung, max = MELDUNGEN_MAX): MeldungenBestand {
  const k = schluessel(neu);
  const rest = bestand.eintraege.filter(e => !(k && !e.gelesen && schluessel(e) === k));
  return { ...bestand, eintraege: begrenzen([neu, ...rest], max) };
}

/**
 * Regel 3: höchstens `max` Einträge. Erst die ältesten gelesenen weg; reicht das nicht,
 * die ältesten ungelesenen zu einer Sammelmeldung zusammenfassen — nie still löschen.
 */
export function begrenzen(eintraege: Meldung[], max = MELDUNGEN_MAX): Meldung[] {
  const liste = [...eintraege].sort(neuesteZuerst);
  if (liste.length <= max) return liste;
  let zuViel = liste.length - max;
  const weg = new Set<number>();
  for (let i = liste.length - 1; i >= 0 && zuViel > 0; i--) {
    if (liste[i].gelesen) { weg.add(i); zuViel--; }
  }
  const bleibt = liste.filter((_, i) => !weg.has(i));
  if (zuViel <= 0) return bleibt;
  // Nur noch Ungelesene übrig: die ältesten (zuViel + 1) werden EINE Sammelmeldung.
  const grenze = Math.max(1, max - 1);
  const oben = bleibt.filter((_, i) => i < grenze);
  const gefaltet = bleibt.filter((_, i) => i >= grenze);
  const anzahl = gefaltet.reduce((s, e) => s + (e.art === 'sammel' ? Math.max(1, e.anzahl ?? 1) : 1), 0);
  const am = gefaltet[0]?.am ?? new Date(0).toISOString();
  const sammel: Meldung = {
    id: `sammel-${Date.parse(am) || 0}-${anzahl}`, art: 'sammel', anzahl, am,
    titel: `+${anzahl} weitere Meldungen`, link: '/os/aufgaben',
  };
  return [...oben, sammel];
}

// ── Fällig / überfällig (abgeleitet) ────────────────────────────────────────

const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Tag einer Deadline: „YYYY-MM-DD“ direkt, ein Zeitstempel über `tagVon` (Berlin) des Aufrufers. */
function deadlineTag(roh: unknown, tagVonIso: (iso: string) => string): string | null {
  if (!istText(roh) || !roh) return null;
  if (TAG.test(roh)) return roh;
  if (/^\d{4}-\d{2}-\d{2}T/.test(roh) && !Number.isNaN(Date.parse(roh))) return tagVonIso(roh);
  return null;
}

/** Ist die Person zuständig? `assignee` (heute) oder `zustaendig` (Umbau), je Wert oder Liste; „both“ = gemeinsam. */
export function istZustaendig(t: Record<string, unknown>, person: string): boolean {
  const werte: unknown[] = [];
  for (const feld of ['assignee', 'zustaendig']) {
    const v = t[feld];
    if (Array.isArray(v)) werte.push(...v); else if (v !== undefined) werte.push(v);
  }
  return werte.some(v => v === person || v === 'both');
}

const tagText = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

export interface FaelligOptionen {
  person: string;
  /** Berliner Tag „YYYY-MM-DD“. */
  heute: string;
  /** ISO-Zeitpunkt, den abgeleitete Meldungen tragen (Beginn des Berliner Tages). */
  am: string;
  /** Aufgaben-Link (WEG.aufgabe). */
  link: (id: string) => string;
  /** ISO-Zeitstempel → Berliner Tag. */
  tagVonIso: (iso: string) => string;
  /** Gelesen-Merker des Bestands. */
  gelesen?: { tag: string; ids: string[] };
}

/** Kennung einer abgeleiteten Meldung — trägt den Tag, damit der Merker je Tag gilt. */
export const faelligId = (art: 'faellig' | 'ueberfaellig', heute: string, aufgabeId: string) => `${art}:${heute}:${aufgabeId}`;

/**
 * Regel 4 + 5: eigene, offene Aufgaben mit Deadline heute (fällig) oder früher (überfällig). Abgebrochene zählen nicht
 * (29.09.). Wartet die Aufgabe noch auf eine andere (`abhaengigVon`, nicht erledigt), heißt es „wartet auf …“ statt
 * „überfällig“ (#36) — wer nicht anfangen kann, soll nicht gemahnt werden.
 */
export function faelligAbleiten(aufgaben: unknown[], o: FaelligOptionen): Meldung[] {
  const merker = o.gelesen?.tag === o.heute ? new Set(o.gelesen.ids) : new Set<string>();
  const raus: (Meldung & { tag: string })[] = [];
  const nachId = new Map<string, Record<string, unknown>>();
  for (const roh of aufgaben) if (roh && typeof roh === 'object' && istText((roh as Record<string, unknown>).id)) nachId.set((roh as Record<string, unknown>).id as string, roh as Record<string, unknown>);
  for (const roh of aufgaben) {
    if (!roh || typeof roh !== 'object') continue;
    const t = roh as Record<string, unknown>;
    if (!istText(t.id) || !BEZUG_ID_OK.test(t.id) || !istText(t.title)) continue;
    if (t.status === 'done' || t.status === 'cancelled' || (istText(t.completedAt) && t.completedAt)) continue;
    if (!istZustaendig(t, o.person)) continue;
    const tag = deadlineTag(t.dueDate, o.tagVonIso);
    if (!tag || tag > o.heute) continue;
    const art = tag === o.heute ? 'faellig' : 'ueberfaellig';
    const id = faelligId(art, o.heute, t.id);
    const name = t.title.trim() || 'Ohne Titel';
    const wartet = (Array.isArray(t.abhaengigVon) ? t.abhaengigVon : []).map(x => (istText(x) ? nachId.get(x) : undefined)).filter((x): x is Record<string, unknown> => !!x && x.status !== 'done');
    const aufWen = wartet.length ? `„${istText(wartet[0].title) ? wartet[0].title.trim() : 'eine Aufgabe'}“${wartet.length > 1 ? ` und ${wartet.length - 1} weitere` : ''}` : '';
    raus.push({
      id, art, tag, am: o.am, link: o.link(t.id), virtuell: true, gelesen: merker.has(id),
      bezug: { art: 'aufgabe', id: t.id },
      titel: wartet.length ? `„${name}“ wartet auf ${aufWen} (fällig ${art === 'faellig' ? 'heute' : `seit ${tagText(tag)}`})`
        : art === 'faellig' ? `„${name}“ ist heute fällig` : `„${name}“ ist überfällig — fällig seit ${tagText(tag)}`,
    });
  }
  // Überfällige zuerst, darin die älteste Deadline zuerst.
  raus.sort((a, b) => (a.art === b.art ? a.tag.localeCompare(b.tag) : a.art === 'ueberfaellig' ? -1 : 1));
  return raus.map(({ tag: _t, ...m }) => m);
}

// ── Geburtstage (29.09., K2) ────────────────────────────────────────────────
// Regel 4 gilt genauso: nie gespeichert, beim Lesen aus `geburtstageIm` abgeleitet — am Vortag („morgen“) und am Tag
// („heute“); der Gelesen-Merker gilt je Berliner Tag. Wer: Familie = wer den Eintrag sieht, CRM = wer die Beziehung
// hält (`zustaendig`, „beide“ = beide). Eingeschränkte Kontakte (Art. 18) kommen gar nicht erst an.

export const geburtstagId = (heute: string, gid: string) => `geburtstag:${heute}:${gid}`;

export function geburtstagAbleiten(
  liste: readonly { id: string; name: string; tag: string; alter?: number; href: string; zustaendig?: string }[],
  o: { person: string; heute: string; morgen: string; am: string; gelesen?: { tag: string; ids: string[] } },
): Meldung[] {
  const merker = o.gelesen?.tag === o.heute ? new Set(o.gelesen.ids) : new Set<string>();
  const raus: Meldung[] = [];
  for (const g of liste) {
    if (g.tag !== o.heute && g.tag !== o.morgen) continue;
    if (g.zustaendig && g.zustaendig !== o.person && g.zustaendig !== 'beide') continue;
    if (!istLink(g.href)) continue;
    const id = geburtstagId(o.heute, g.id.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120));
    const wann = g.tag === o.heute ? 'heute' : 'morgen';
    const alter = g.alter !== undefined && g.alter > 0 ? ` (wird ${g.alter})` : '';
    raus.push({ id, art: 'geburtstag', titel: `${g.name} hat ${wann} Geburtstag${alter}`.slice(0, TITEL_MAX), link: g.href, am: o.am, virtuell: true, gelesen: merker.has(id) });
  }
  // Heute vor morgen.
  return raus.sort((a, b) => Number(b.titel.includes(' heute ')) - Number(a.titel.includes(' heute ')));
}

// ── Sicht und „gelesen“ ─────────────────────────────────────────────────────

export interface MeldungenSicht {
  meldungen: Meldung[];
  /** Zahl an der Glocke — eine Sammelmeldung zählt mit ihrer Anzahl. */
  ungelesen: number;
  einstellungen: MeldungEinstellungen;
  heute: string;
}

export function ungelesenZahl(liste: Meldung[]): number {
  return liste.reduce((s, m) => s + (m.gelesen ? 0 : m.art === 'sammel' ? Math.max(1, m.anzahl ?? 1) : 1), 0);
}

/** Gespeichertes + Abgeleitetes zu einer Liste, neueste zuerst (abgeleitete stehen am Tagesbeginn). */
export function sichtBauen(bestand: MeldungenBestand, abgeleitet: Meldung[], heute: string): MeldungenSicht {
  const gespeichert = bestand.eintraege.map(e => ({ ...e, gelesen: !!e.gelesen }));
  // Stabil sortieren: die Reihenfolge der abgeleiteten (überfällig vor fällig) bleibt erhalten.
  const meldungen = [...abgeleitet, ...gespeichert].map((m, i) => ({ m, i })).sort((a, b) => neuesteZuerst(a.m, b.m) || a.i - b.i).map(x => x.m);
  return { meldungen, ungelesen: ungelesenZahl(meldungen), einstellungen: bestand.einstellungen, heute };
}

export interface GelesenAuswahl { ids?: string[]; alle?: boolean }

/**
 * „Gelesen“ setzen — nur auf eigene Einträge (der Bestand gehört der Person) und nur auf
 * abgeleitete Kennungen, die es heute wirklich gibt (`abgeleiteteIds`); fremde Kennungen
 * ändern nichts. Der Tages-Merker wird beim Tageswechsel ersetzt, nicht fortgeschrieben.
 */
export function gelesenSetzen(bestand: MeldungenBestand, auswahl: GelesenAuswahl, heute: string, abgeleiteteIds: string[]): MeldungenBestand {
  const ids = new Set(auswahl.ids ?? []);
  const alle = auswahl.alle === true;
  const eintraege = bestand.eintraege.map(e => (!e.gelesen && (alle || ids.has(e.id)) ? { ...e, gelesen: true } : e));
  const vorher = bestand.faelligGelesen?.tag === heute ? bestand.faelligGelesen.ids : [];
  const neu = abgeleiteteIds.filter(id => alle || ids.has(id));
  const merker = Array.from(new Set([...vorher.filter(id => abgeleiteteIds.includes(id)), ...neu]));
  return { ...bestand, eintraege, ...(merker.length || bestand.faelligGelesen ? { faelligGelesen: { tag: heute, ids: merker } } : {}) };
}

// ── Anzeige ─────────────────────────────────────────────────────────────────

/** „gerade eben“, „vor 5 Min“, „vor 3 Std“, „gestern“, „vor 4 Tagen“, sonst „am 12.09.“. */
export function vorZeit(am: string, jetzt: number): string {
  const t = Date.parse(am);
  if (Number.isNaN(t)) return '';
  const min = Math.floor((jetzt - t) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  const tage = Math.floor(std / 24);
  if (tage === 1) return 'gestern';
  if (tage < 7) return `vor ${tage} Tagen`;
  const d = new Date(t);
  return `am ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

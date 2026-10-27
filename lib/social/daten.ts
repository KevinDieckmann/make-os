// ─── MAKE OS — Social: Säubern und Schreiben (rein, Server UND Browser) — 26.10.2026 ───────────────────────────────────────────────
// EIN Bestand je Haushalt (`social--<haushalt>`, lib/social/server.ts). Geschrieben wird nur über Einzel-Schritte (`SocialOp`) — nie die ganze
// Datei aus dem Browser. Ändern/Entfernen eines Eintrags nur mit dem Stand, den die Person gesehen hat (sonst Konflikt → 409). Über den
// Grenzen (`SOCIAL_GRENZEN`) wird die GANZE Änderung abgelehnt (413), nie gekürzt; Unsinn → 400. Kein Schritt setzt Server-Felder aus dem
// Browser: `geaendert`/`geaendertVon`, die Freigabe eines Formats und die Kennungen neuer Einträge setzt nur der Schreibweg.

import { istKalendertag } from '@/lib/zeit';
import {
  SOCIAL_PLATTFORMEN, FOLGE_STATUS, LEITPLANKEN_VORGABE, SOCIAL_GRENZEN as G, leereSocial,
  type SocialDatei, type SocialKanal, type SocialFormat, type SocialFolge, type Messung, type Hook, type Leitplanken, type SocialPlattform,
  type FolgeStatus, type Veroeffentlichung, type AutonomieStufe,
} from './typen';

const KENNUNG = /^[a-z]{2}-[a-z0-9-]{1,64}$/;
const istKennung = (v: unknown): v is string => typeof v === 'string' && KENNUNG.test(v);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim() : '').slice(0, max);
const zahl = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const istPlattform = (v: unknown): v is SocialPlattform => (SOCIAL_PLATTFORMEN as readonly unknown[]).includes(v);
const nurHttps = (v: unknown): string | undefined => { const s = text(v, 500); return /^https:\/\/[^\s]+$/.test(s) ? s : undefined; };
const liste = <T>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] =>
  (Array.isArray(v) ? v : []).flatMap(x => (x && typeof x === 'object' ? [f(x as Record<string, unknown>)] : [])).filter((x): x is T => x !== null);
const woerter = (v: unknown): string[] => [...new Set(liste(Array.isArray(v) ? v.map(w => ({ w })) : [], x => text(x.w, 60) || null))];
const ohneLeere = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined && w !== '')) as T;

// ── Säubern (Lesen UND Schreiben: ungültige Felder fallen weg, gültige bleiben bit-gleich) ─────────────────────────────────────────
function leitplankenAus(v: unknown): Leitplanken {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const st = o.autonomie;
  return {
    autonomie: (st === 0 || st === 1 || st === 2 ? st : LEITPLANKEN_VORGABE.autonomie) as AutonomieStufe,
    postsProTag: zahl(o.postsProTag, 0, 50) ?? LEITPLANKEN_VORGABE.postsProTag,
    antwortenProTag: zahl(o.antwortenProTag, 0, 2000) ?? LEITPLANKEN_VORGABE.antwortenProTag,
    dmsProTag: zahl(o.dmsProTag, 0, 2000) ?? LEITPLANKEN_VORGABE.dmsProTag,
    postenAus: o.postenAus === true,
    antwortenAus: o.antwortenAus === true,
    negativSchwelle: zahl(o.negativSchwelle, 1, 100) ?? LEITPLANKEN_VORGABE.negativSchwelle,
  };
}

export function kanalAus(o: Record<string, unknown>): SocialKanal | null {
  if (!istKennung(o.id) || !text(o.name, G.text)) return null;
  const m = (o.marke && typeof o.marke === 'object' ? o.marke : {}) as Record<string, unknown>;
  const p = o.persona && typeof o.persona === 'object' ? o.persona as Record<string, unknown> : null;
  return ohneLeere({
    id: o.id, name: text(o.name, G.text), handle: text(o.handle, 60).replace(/^@/, '') || undefined,
    sprache: o.sprache === 'en' ? 'en' : 'de',
    plattformen: [...new Set((Array.isArray(o.plattformen) ? o.plattformen : []).filter(istPlattform))],
    kiKanal: o.kiKanal === true,
    persona: p && text(p.name, 60) ? ohneLeere({ name: text(p.name, 60), look: text(p.look, G.langtext) || undefined }) : undefined,
    marke: ohneLeere({
      versprechen: text(m.versprechen, G.text) || undefined, zielgruppe: text(m.zielgruppe, G.langtext) || undefined, ton: text(m.ton, G.langtext) || undefined,
      nieSagen: woerter(m.nieSagen), saeulen: woerter(m.saeulen), cta: text(m.cta, G.text) || undefined, bio: text(m.bio, G.text) || undefined,
    }),
    leitplanken: leitplankenAus(o.leitplanken),
    status: o.status === 'pausiert' ? 'pausiert' : 'aktiv',
    archiviertAm: typeof o.archiviertAm === 'string' ? o.archiviertAm : undefined,
    geaendert: typeof o.geaendert === 'string' ? o.geaendert : '',
    geaendertVon: text(o.geaendertVon, 60) || undefined,
  }) as SocialKanal;
}

export function formatAus(o: Record<string, unknown>): SocialFormat | null {
  if (!istKennung(o.id) || !istKennung(o.kanalId) || !text(o.name, G.text)) return null;
  return ohneLeere({
    id: o.id, kanalId: o.kanalId, name: text(o.name, G.text), beschreibung: text(o.beschreibung, G.langtext) || undefined,
    laengeSek: zahl(o.laengeSek, 3, 3600),
    freigegebenAm: typeof o.freigegebenAm === 'string' ? o.freigegebenAm : undefined, freigegebenVon: text(o.freigegebenVon, 60) || undefined,
    geaendert: typeof o.geaendert === 'string' ? o.geaendert : '', geaendertVon: text(o.geaendertVon, 60) || undefined,
  }) as SocialFormat;
}

function hookAus(o: Record<string, unknown>): Hook | null {
  const t = text(o.text, G.text);
  return istKennung(o.id) && t ? ohneLeere({ id: o.id, text: t, bildschirm: text(o.bildschirm, 120) || undefined }) as Hook : null;
}

export function messungAus(o: Record<string, unknown>): Messung | null {
  const views = zahl(o.views, 0);
  if (!istKennung(o.id) || !istPlattform(o.plattform) || !istKalendertag(o.am) || views === undefined) return null;
  const pz = (v: unknown) => zahl(v, 0, 100);
  return ohneLeere({
    id: o.id, plattform: o.plattform, am: o.am, views: Math.round(views),
    halte3s: pz(o.halte3s), durchsehen: pz(o.durchsehen), schnittSek: zahl(o.schnittSek, 0, 3600),
    likes: zahl(o.likes, 0), kommentare: zahl(o.kommentare, 0), shares: zahl(o.shares, 0), saves: zahl(o.saves, 0), follows: zahl(o.follows, 0),
    hookId: istKennung(o.hookId) ? o.hookId : undefined,
    quelle: o.quelle === 'import' || o.quelle === 'api' ? o.quelle : 'hand',
  }) as Messung;
}

function veroeffentlichungAus(o: Record<string, unknown>): Veroeffentlichung | null {
  return istPlattform(o.plattform) && istKalendertag(o.am) ? ohneLeere({ plattform: o.plattform, am: o.am, link: nurHttps(o.link) }) as Veroeffentlichung : null;
}

export function folgeAus(o: Record<string, unknown>): SocialFolge | null {
  if (!istKennung(o.id) || !istKennung(o.kanalId) || !text(o.titel, G.text)) return null;
  const st = (FOLGE_STATUS as readonly unknown[]).includes(o.status) ? o.status as FolgeStatus : 'idee';
  const hooks = liste(o.hooks, hookAus);
  return ohneLeere({
    id: o.id, kanalId: o.kanalId, formatId: istKennung(o.formatId) ? o.formatId : undefined,
    titel: text(o.titel, G.text), saeule: text(o.saeule, 60) || undefined,
    skript: typeof o.skript === 'string' ? o.skript.slice(0, G.skript) : '',
    hooks, hookId: istKennung(o.hookId) && hooks.some(h => h.id === o.hookId) ? o.hookId : undefined,
    cta: text(o.cta, G.text) || undefined,
    quellen: liste(Array.isArray(o.quellen) ? o.quellen.map(q => ({ q })) : [], x => text(x.q, 500) || null),
    kiInhalt: o.kiInhalt !== false,
    status: st, geplantAm: istKalendertag(o.geplantAm) ? o.geplantAm : undefined,
    veroeffentlicht: liste(o.veroeffentlicht, veroeffentlichungAus),
    messungen: liste(o.messungen, messungAus),
    geaendert: typeof o.geaendert === 'string' ? o.geaendert : '', geaendertVon: text(o.geaendertVon, 60) || undefined,
  }) as SocialFolge;
}

/** Den gespeicherten Bestand lesen — beschädigte Einträge fallen heraus, nie das Ganze. */
export function socialAus(roh: unknown): SocialDatei {
  if (!roh || typeof roh !== 'object') return leereSocial();
  const o = roh as Record<string, unknown>;
  return { kanaele: liste(o.kanaele, kanalAus), formate: liste(o.formate, formatAus), folgen: liste(o.folgen, folgeAus) };
}

// ── Schreiben ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type SocialOp =
  | { op: 'kanal'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'kanal-archiv'; id: string; archiv: boolean; stand: string }
  | { op: 'notaus'; id: string; posten?: boolean; antworten?: boolean; stand: string }
  | { op: 'format'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'format-freigeben'; id: string; freigeben: boolean; stand: string }
  | { op: 'format-weg'; id: string; stand: string }
  | { op: 'folge'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'folge-weg'; id: string; stand: string }
  | { op: 'messung'; folgeId: string; messung: Record<string, unknown> }
  | { op: 'veroeffentlicht'; folgeId: string; plattform: SocialPlattform; am: string; link?: string };

export interface AnwendenKontext {
  /** Speichername der schreibenden Person (nie aus dem Körper). */
  person: string;
  jetzt: string;
  standVon: (x: object) => string;
  neueId: (praefix: string) => string;
}

export type AnwendenErgebnis =
  | { ok: true; datei: SocialDatei; geaendert: string[] }
  | { ok: false; status: 400 | 404 | 409 | 413; fehler: string; konflikte?: { op: number; id: string }[] };

class Abgelehnt extends Error { constructor(readonly status: 400 | 404 | 413, msg: string) { super(msg); } }
const nein = (msg: string, status: 400 | 404 | 413 = 400): never => { throw new Abgelehnt(status, msg); };

/** Server-Felder, die der Browser nie setzen darf. */
const OHNE_SERVERFELDER = (e: Record<string, unknown>) => {
  const { geaendert: _g, geaendertVon: _v, freigegebenAm: _f, freigegebenVon: _fv, messungen: _m, veroeffentlicht: _ve, stand: _s, ...rest } = e;
  void _g; void _v; void _f; void _fv; void _m; void _ve; void _s;
  return rest;
};

/**
 * Schritte der Reihe nach auf eine Kopie anwenden — alles oder nichts. Neue Einträge (ohne `id`) bekommen eine Kennung vom Server;
 * bestehende nur mit passendem `stand`. Messungen und Veröffentlichungen hängen an (keine Stand-Prüfung nötig, nie überschrieben).
 */
export function socialAnwenden(datei: SocialDatei, opsRoh: unknown, k: AnwendenKontext): AnwendenErgebnis {
  if (!Array.isArray(opsRoh) || !opsRoh.length) return { ok: false, status: 400, fehler: 'ops: eine Liste von Änderungen.' };
  if (opsRoh.length > G.ops) return { ok: false, status: 413, fehler: `Höchstens ${G.ops} Änderungen auf einmal — nichts gespeichert.` };
  const d: SocialDatei = { kanaele: [...datei.kanaele], formate: [...datei.formate], folgen: [...datei.folgen] };
  const konflikte: { op: number; id: string }[] = [];
  const geaendert: string[] = [];
  const vermerk = { geaendert: k.jetzt, geaendertVon: k.person };
  const finde = <T extends { id: string }>(l: T[], id: unknown, was: string): number => {
    const i = typeof id === 'string' ? l.findIndex(x => x.id === id) : -1;
    if (i < 0) nein(`${was} nicht gefunden.`, 404);
    return i;
  };
  const standPasst = (x: object, stand: unknown, i: number, id: string) => { if (stand !== k.standVon(x)) konflikte.push({ op: i, id }); };
  try {
    opsRoh.forEach((roh, i) => {
      if (!roh || typeof roh !== 'object') nein(`Änderung ${i + 1} ist kein Objekt.`);
      const op = roh as SocialOp & Record<string, unknown>;
      switch (op.op) {
        case 'kanal': {
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          const alt = istKennung(e.id) ? d.kanaele.findIndex(x => x.id === e.id) : -1;
          if (alt >= 0) standPasst(d.kanaele[alt], op.stand, i, d.kanaele[alt].id);
          else if (e.id !== undefined) nein('Diesen Kanal gibt es nicht (mehr) — neu laden.', 404);
          // Leitplanken: der Not-Aus wird nur über den eigenen Schritt geschaltet — beim Bearbeiten bleibt er, wie er war.
          const lp = { ...((e.leitplanken ?? {}) as Record<string, unknown>) };
          if (alt >= 0) { lp.postenAus = d.kanaele[alt].leitplanken.postenAus; lp.antwortenAus = d.kanaele[alt].leitplanken.antwortenAus; }
          const neu = kanalAus({ ...(alt >= 0 ? d.kanaele[alt] : {}), ...e, leitplanken: lp, id: alt >= 0 ? d.kanaele[alt].id : k.neueId('sk'), ...vermerk });
          if (!neu) nein('Ein Kanal braucht einen Namen.');
          if (alt >= 0) d.kanaele[alt] = neu!; else { if (d.kanaele.length >= G.kanaele) nein(`Höchstens ${G.kanaele} Kanäle.`, 413); d.kanaele.push(neu!); }
          geaendert.push(neu!.id);
          break;
        }
        case 'kanal-archiv': case 'notaus': {
          const j = finde(d.kanaele, op.id, 'Kanal');
          standPasst(d.kanaele[j], op.stand, i, d.kanaele[j].id);
          const c = d.kanaele[j];
          d.kanaele[j] = op.op === 'kanal-archiv'
            ? kanalAus({ ...c, archiviertAm: op.archiv ? k.jetzt : undefined, ...vermerk })!
            : { ...c, leitplanken: { ...c.leitplanken, postenAus: typeof op.posten === 'boolean' ? op.posten : c.leitplanken.postenAus, antwortenAus: typeof op.antworten === 'boolean' ? op.antworten : c.leitplanken.antwortenAus }, ...vermerk };
          geaendert.push(c.id);
          break;
        }
        case 'format': {
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          const alt = istKennung(e.id) ? d.formate.findIndex(x => x.id === e.id) : -1;
          if (alt >= 0) standPasst(d.formate[alt], op.stand, i, d.formate[alt].id);
          else if (e.id !== undefined) nein('Dieses Format gibt es nicht (mehr) — neu laden.', 404);
          const kanalId = alt >= 0 ? d.formate[alt].kanalId : e.kanalId;
          if (!d.kanaele.some(c => c.id === kanalId)) nein('Das Format braucht einen vorhandenen Kanal.');
          const vorher = alt >= 0 ? d.formate[alt] : null;
          // Inhalt geändert → Freigabe fällt weg (der Agent darf nur, was eine Person so gesehen hat).
          const neu = formatAus({ ...(vorher ?? {}), ...e, kanalId, id: vorher?.id ?? k.neueId('sf'), ...vermerk });
          if (!neu) nein('Ein Format braucht einen Namen.');
          const inhaltNeu = vorher && (vorher.name !== neu!.name || vorher.beschreibung !== neu!.beschreibung || vorher.laengeSek !== neu!.laengeSek);
          const fertig = inhaltNeu ? formatAus({ ...neu!, freigegebenAm: undefined, freigegebenVon: undefined })! : neu!;
          if (alt >= 0) d.formate[alt] = fertig; else { if (d.formate.length >= G.formate) nein(`Höchstens ${G.formate} Formate.`, 413); d.formate.push(fertig); }
          geaendert.push(fertig.id);
          break;
        }
        case 'format-freigeben': {
          const j = finde(d.formate, op.id, 'Format');
          standPasst(d.formate[j], op.stand, i, d.formate[j].id);
          d.formate[j] = formatAus({ ...d.formate[j], freigegebenAm: op.freigeben ? k.jetzt : undefined, freigegebenVon: op.freigeben ? k.person : undefined, ...vermerk })!;
          geaendert.push(d.formate[j].id);
          break;
        }
        case 'format-weg': {
          const j = finde(d.formate, op.id, 'Format');
          standPasst(d.formate[j], op.stand, i, d.formate[j].id);
          const id = d.formate[j].id;
          d.formate.splice(j, 1);
          // Folgen behalten ihren Inhalt, verlieren nur den Verweis.
          d.folgen = d.folgen.map(f => (f.formatId === id ? folgeAus({ ...f, formatId: undefined })! : f));
          geaendert.push(id);
          break;
        }
        case 'folge': {
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          const alt = istKennung(e.id) ? d.folgen.findIndex(x => x.id === e.id) : -1;
          if (alt >= 0) standPasst(d.folgen[alt], op.stand, i, d.folgen[alt].id);
          else if (e.id !== undefined) nein('Diese Folge gibt es nicht (mehr) — neu laden.', 404);
          const vorher = alt >= 0 ? d.folgen[alt] : null;
          const kanalId = vorher?.kanalId ?? e.kanalId;
          if (!d.kanaele.some(c => c.id === kanalId)) nein('Die Folge braucht einen vorhandenen Kanal.');
          if (istKennung(e.formatId) && !d.formate.some(f => f.id === e.formatId && f.kanalId === kanalId)) nein('Das Format gehört nicht zu diesem Kanal.');
          if (typeof e.skript === 'string' && e.skript.length > G.skript) nein(`Das Skript ist länger als ${G.skript} Zeichen — nichts gespeichert.`, 413);
          if (Array.isArray(e.hooks) && e.hooks.length > G.hooks) nein(`Höchstens ${G.hooks} Hook-Varianten.`, 413);
          if (Array.isArray(e.quellen) && e.quellen.length > G.quellen) nein(`Höchstens ${G.quellen} Quellen.`, 413);
          // Hooks ohne Kennung bekommen eine vom Server.
          const hooks = Array.isArray(e.hooks) ? e.hooks.map(h => (h && typeof h === 'object' ? { ...(h as object), id: istKennung((h as { id?: unknown }).id) ? (h as { id: string }).id : k.neueId('hk') } : h)) : undefined;
          const neu = folgeAus({ ...(vorher ?? {}), ...e, ...(hooks ? { hooks } : {}), kanalId, id: vorher?.id ?? k.neueId('sv'), ...vermerk });
          if (!neu) nein('Eine Folge braucht einen Titel.');
          if (alt >= 0) d.folgen[alt] = neu!; else { if (d.folgen.length >= G.folgen) nein(`Höchstens ${G.folgen} Folgen.`, 413); d.folgen.push(neu!); }
          geaendert.push(neu!.id);
          break;
        }
        case 'folge-weg': {
          const j = finde(d.folgen, op.id, 'Folge');
          standPasst(d.folgen[j], op.stand, i, d.folgen[j].id);
          // Veröffentlichtes mit Messungen bleibt (Lerngrundlage) — nur verwerfen, nie löschen.
          if (d.folgen[j].veroeffentlicht.length || d.folgen[j].messungen.length) nein('Veröffentlichte Folgen mit Zahlen bleiben als Lerngrundlage — stattdessen „Verworfen“ setzen.', 400);
          geaendert.push(d.folgen[j].id);
          d.folgen.splice(j, 1);
          break;
        }
        case 'messung': {
          const j = finde(d.folgen, op.folgeId, 'Folge');
          const m = messungAus({ ...((op.messung ?? {}) as Record<string, unknown>), id: k.neueId('sm') });
          if (!m) nein('Eine Messung braucht Plattform, Tag (JJJJ-MM-TT) und Aufrufe.');
          if (d.folgen[j].messungen.length >= G.messungenJeFolge) nein(`Höchstens ${G.messungenJeFolge} Messungen je Folge.`, 413);
          d.folgen[j] = { ...d.folgen[j], messungen: [...d.folgen[j].messungen, m!], ...vermerk };
          geaendert.push(d.folgen[j].id);
          break;
        }
        case 'veroeffentlicht': {
          const j = finde(d.folgen, op.folgeId, 'Folge');
          const v = veroeffentlichungAus({ plattform: op.plattform, am: op.am, link: op.link });
          if (!v) nein('Veröffentlichung braucht Plattform und Tag (JJJJ-MM-TT); Links nur https.');
          if (d.folgen[j].veroeffentlicht.length >= G.veroeffentlichungen) nein('Zu viele Veröffentlichungen für eine Folge.', 413);
          d.folgen[j] = { ...d.folgen[j], status: 'veroeffentlicht', veroeffentlicht: [...d.folgen[j].veroeffentlicht.filter(x => x.plattform !== v!.plattform), v!], ...vermerk };
          geaendert.push(d.folgen[j].id);
          break;
        }
        default: nein(`Unbekannte Änderung „${String((op as { op?: unknown }).op)}“.`);
      }
    });
  } catch (e) {
    if (e instanceof Abgelehnt) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
  if (konflikte.length) return { ok: false, status: 409, fehler: 'Inzwischen geändert — neu laden.', konflikte };
  return { ok: true, datei: d, geaendert };
}

// ── Konto löschen / Export (Art. 15/17 der Mitglieder — Dritte stehen hier nicht) ────────────────────────────────────────────────
export const SOCIAL_GETILGT = '[gelöscht]';

/** Konto löschen: Einträge bleiben (Arbeit des Haushalts), der Speichername in „geändert von“/„freigegeben von“ wird „[gelöscht]“. Rein. */
export function socialOhnePerson(d: SocialDatei, speicher: string): { neu: SocialDatei; n: number } {
  let n = 0;
  const v = <T extends { geaendertVon?: string; freigegebenVon?: string }>(x: T): T => {
    let y = x;
    if (y.geaendertVon === speicher) { n++; y = { ...y, geaendertVon: SOCIAL_GETILGT }; }
    if (y.freigegebenVon === speicher) { n++; y = { ...y, freigegebenVon: SOCIAL_GETILGT }; }
    return y;
  };
  return { neu: { kanaele: d.kanaele.map(v), formate: d.formate.map(v), folgen: d.folgen.map(v) }, n };
}

/** Export: was die Person in Social gestempelt hat — Art, Kennung, Zeit. Rein. */
export function socialEintraegeVon(d: SocialDatei, speicher: string): { art: string; id: string; am?: string }[] {
  const raus: { art: string; id: string; am?: string }[] = [];
  for (const [art, l] of [['kanal', d.kanaele], ['format', d.formate], ['folge', d.folgen]] as const) {
    for (const x of l as readonly { id: string; geaendert: string; geaendertVon?: string; freigegebenVon?: string; freigegebenAm?: string }[]) {
      if (x.geaendertVon === speicher) raus.push({ art: `${art} geändert`, id: x.id, am: x.geaendert });
      if (x.freigegebenVon === speicher) raus.push({ art: `${art} freigegeben`, id: x.id, am: x.freigegebenAm });
    }
  }
  return raus;
}

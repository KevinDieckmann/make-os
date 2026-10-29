// ─── MAKE OS — Social: Säubern und Schreiben (rein, Server UND Browser) — 26.10.2026 ───────────────────────────────────────────────
// EIN Bestand je Haushalt (`social--<haushalt>`, lib/social/server.ts). Geschrieben wird nur über Einzel-Schritte (`SocialOp`) — nie die ganze
// Datei aus dem Browser. Ändern/Entfernen eines Eintrags nur mit dem Stand, den die Person gesehen hat (sonst Konflikt → 409). Über den
// Grenzen (`SOCIAL_GRENZEN`) wird die GANZE Änderung abgelehnt (413), nie gekürzt; Unsinn → 400. Kein Schritt setzt Server-Felder aus dem
// Browser: `geaendert`/`geaendertVon`, die Freigabe eines Formats und die Kennungen neuer Einträge setzt nur der Schreibweg.

import { istKalendertag, tagVon } from '@/lib/zeit';
import { gehoertZuPrivat } from '@/lib/einheiten';
import {
  SOCIAL_PLATTFORMEN, FOLGE_STATUS, LEITPLANKEN_VORGABE, PLAN_VORGABE, SOCIAL_GRENZEN as G, leereSocial, KONTO_ARTEN, INHALT_ARTEN, ZIEL_METRIKEN, ZIEL_MIT_LINIE,
  type SocialDatei, type SocialKanal, type SocialFormat, type SocialFolge, type Messung, type Hook, type Leitplanken, type SocialPlattform,
  type FolgeStatus, type Veroeffentlichung, type AutonomieStufe, type Redaktionsplan, type PostVersuch, type KontoArt, type InhaltArt, type KanalZiel, type KontoStand, type ZielMetrik,
} from './typen';
import { zielStartwert } from './ziele';
import { vorlageVon } from './vorlagen';

const KENNUNG = /^[a-z]{2}-[a-z0-9-]{1,64}$/;
/** Speichername eines Kontos (wie `x-make-user`). */
const SPEICHER = /^[a-z0-9-]{1,40}$/;
/** Feste Gesellschaft (kdc · kdv · ug) oder Register-Kennung `g-…` — ob sie existiert und Business ist, prüft der Schreibweg. */
const GESELLSCHAFT = /^(kdc|kdv|ug|g-[a-z0-9][a-z0-9-]{3,62})$/;
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

const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;
export const istUhrzeit = (v: unknown): v is string => typeof v === 'string' && UHRZEIT.test(v);

/** Redaktionsplan säubern — fehlt er ganz, bleibt er weg (dann gilt `PLAN_VORGABE`). */
export function planAus(v: unknown): Redaktionsplan | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const tage = [...new Set((Array.isArray(o.tage) ? o.tage : []).filter((t): t is number => Number.isInteger(t) && (t as number) >= 1 && (t as number) <= 7))].sort();
  const pw = zahl(o.proWoche, 1, 21);
  return ohneLeere({
    agent: o.agent === true, proWoche: pw === undefined ? undefined : Math.round(pw),
    tage: tage.length ? tage : [...PLAN_VORGABE.tage], uhrzeit: istUhrzeit(o.uhrzeit) ? o.uhrzeit : PLAN_VORGABE.uhrzeit,
    vorlauf: Math.round(zahl(o.vorlauf, 1, 21) ?? PLAN_VORGABE.vorlauf),
    autoReel: o.autoReel === true ? true : undefined,
    rohAlbum: typeof o.rohAlbum === 'string' && /^al-[a-z0-9][a-z0-9-]{0,94}$/.test(o.rohAlbum) ? o.rohAlbum : undefined,
  }) as Redaktionsplan;
}

export function kanalAus(o: Record<string, unknown>): SocialKanal | null {
  if (!istKennung(o.id) || !text(o.name, G.text)) return null;
  const m = (o.marke && typeof o.marke === 'object' ? o.marke : {}) as Record<string, unknown>;
  const p = o.persona && typeof o.persona === 'object' ? o.persona as Record<string, unknown> : null;
  const art: KontoArt = (KONTO_ARTEN as readonly unknown[]).includes(o.art) ? o.art as KontoArt : 'faceless';
  const person = art === 'person' && typeof o.person === 'string' && SPEICHER.test(o.person) ? o.person : undefined;
  return ohneLeere({
    id: o.id, name: text(o.name, G.text), art: art === 'faceless' ? undefined : art, person,
    gesellschaft: typeof o.gesellschaft === 'string' && GESELLSCHAFT.test(o.gesellschaft) ? o.gesellschaft : undefined,
    sichtbarkeit: o.sichtbarkeit === 'person' && person ? 'person' : undefined,
    vorlage: typeof o.vorlage === 'string' && /^[a-z0-9-]{1,40}$/.test(o.vorlage) ? o.vorlage : undefined,
    handle: text(o.handle, 60).replace(/^@/, '') || undefined,
    sprache: o.sprache === 'en' ? 'en' : 'de',
    plattformen: [...new Set((Array.isArray(o.plattformen) ? o.plattformen : []).filter(istPlattform))],
    kiKanal: o.kiKanal === true,
    persona: p && text(p.name, 60) ? ohneLeere({ name: text(p.name, 60), look: text(p.look, G.langtext) || undefined }) : undefined,
    marke: ohneLeere({
      versprechen: text(m.versprechen, G.text) || undefined, zielgruppe: text(m.zielgruppe, G.langtext) || undefined, ton: text(m.ton, G.langtext) || undefined,
      nieSagen: woerter(m.nieSagen), saeulen: woerter(m.saeulen), cta: text(m.cta, G.text) || undefined, bio: text(m.bio, G.text) || undefined,
    }),
    leitplanken: leitplankenAus(o.leitplanken),
    ziele: liste(o.ziele, zielAus),
    staende: liste(o.staende, standAus),
    plan: planAus(o.plan),
    status: o.status === 'pausiert' ? 'pausiert' : 'aktiv',
    archiviertAm: typeof o.archiviertAm === 'string' ? o.archiviertAm : undefined,
    geaendert: typeof o.geaendert === 'string' ? o.geaendert : '',
    geaendertVon: text(o.geaendertVon, 60) || undefined,
  }) as SocialKanal;
}

function zielAus(o: Record<string, unknown>): KanalZiel | null {
  const metrik = (ZIEL_METRIKEN as readonly unknown[]).includes(o.metrik) ? o.metrik as ZielMetrik : null;
  const zielwert = zahl(o.zielwert, 0, 1e12);
  if (!istKennung(o.id) || !metrik || zielwert === undefined || zielwert <= 0 || !istKalendertag(o.von)) return null;
  const linie = (ZIEL_MIT_LINIE as readonly ZielMetrik[]).includes(metrik);
  const bis = istKalendertag(o.bis) && o.bis > o.von ? o.bis : undefined;
  if (linie && !bis) return null;
  return ohneLeere({
    id: o.id, metrik, zielwert, plattform: istPlattform(o.plattform) ? o.plattform : undefined, von: o.von, bis: linie ? bis : undefined,
    startwert: zahl(o.startwert, 0, 1e12) ?? 0, notiz: text(o.notiz, G.text) || undefined,
  }) as KanalZiel;
}

function standAus(o: Record<string, unknown>): KontoStand | null {
  const follower = zahl(o.follower, 0, 1e10);
  if (!istKennung(o.id) || !istPlattform(o.plattform) || !istKalendertag(o.am) || follower === undefined) return null;
  return { id: o.id, plattform: o.plattform, am: o.am, follower: Math.round(follower), quelle: o.quelle === 'import' || o.quelle === 'api' ? o.quelle : 'hand' };
}

export function formatAus(o: Record<string, unknown>): SocialFormat | null {
  if (!istKennung(o.id) || !istKennung(o.kanalId) || !text(o.name, G.text)) return null;
  return ohneLeere({
    id: o.id, kanalId: o.kanalId, name: text(o.name, G.text), beschreibung: text(o.beschreibung, G.langtext) || undefined,
    art: (INHALT_ARTEN as readonly unknown[]).includes(o.art) && o.art !== 'video' ? o.art as InhaltArt : undefined,
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
  return istPlattform(o.plattform) && istKalendertag(o.am) ? ohneLeere({
    plattform: o.plattform, am: o.am, link: nurHttps(o.link), externeId: text(o.externeId, 200) || undefined, durch: o.durch === 'automatik' ? 'automatik' : undefined,
  }) as Veroeffentlichung : null;
}

function versuchAus(o: Record<string, unknown>): PostVersuch | null {
  if (!istPlattform(o.plattform) || typeof o.seit !== 'string') return null;
  const zustand = o.zustand === 'laeuft' || o.zustand === 'unklar' ? o.zustand : 'fehler';
  return ohneLeere({ plattform: o.plattform, seit: o.seit, zustand, text: text(o.text, G.text) || undefined, warten: zustand === 'laeuft' && typeof o.warten === 'string' && o.warten.length <= 2000 ? o.warten : undefined }) as PostVersuch;
}

/** Medien-Kennungen einer Folge: nur `md-<uuid>`, jede einmal, Reihenfolge bleibt — nie gekürzt (die Grenze prüft der Schreibweg vorher → 413). */
export const MEDIUM_KENNUNG = /^md-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function medienAus(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const l = Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && MEDIUM_KENNUNG.test(x))));
  return l.length ? l : undefined;
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
    beschriftung: typeof o.beschriftung === 'string' && o.beschriftung.trim() ? o.beschriftung.trim().slice(0, G.beschriftung) : undefined,
    quellen: liste(Array.isArray(o.quellen) ? o.quellen.map(q => ({ q })) : [], x => text(x.q, 500) || null),
    medien: medienAus(o.medien),
    kiInhalt: o.kiInhalt !== false,
    personenImBild: o.personenImBild === 'offen' || o.personenImBild === 'einwilligung' ? o.personenImBild : undefined,
    werbung: o.werbung === true ? true : undefined,
    freigegebenAm: typeof o.freigegebenAm === 'string' ? o.freigegebenAm : undefined, freigegebenVon: text(o.freigegebenVon, 60) || undefined,
    status: st, geplantAm: istKalendertag(o.geplantAm) ? o.geplantAm : undefined,
    geplantUm: istKalendertag(o.geplantAm) && istUhrzeit(o.geplantUm) ? o.geplantUm : undefined,
    quelle: o.quelle === 'agent' ? 'agent' : undefined,
    platz: typeof o.platz === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.platz) ? o.platz : undefined,
    versuche: (() => { const l = liste(o.versuche, versuchAus); return l.length ? l : undefined; })(),
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
  | { op: 'veroeffentlicht'; folgeId: string; plattform: SocialPlattform; am: string; link?: string }
  | { op: 'vorlage'; vorlageId: string; eintrag: Record<string, unknown> }
  | { op: 'ziel'; kanalId: string; eintrag: Record<string, unknown>; stand: string }
  | { op: 'ziel-weg'; kanalId: string; id: string; stand: string }
  | { op: 'kontostand'; kanalId: string; plattform: SocialPlattform; am: string; follower: number }
  | { op: 'plan'; kanalId: string; plan: Record<string, unknown>; stand: string }
  | { op: 'versuch-loesen'; folgeId: string; plattform: SocialPlattform; stand: string }
  // ── nur der Server (Redaktions-Agent, Veröffentlicher) — aus dem Browser 403 ──
  | { op: 'entwurf'; kanalId: string; platz: string; eintrag: Record<string, unknown> }
  | { op: 'post-start'; folgeId: string; plattform: SocialPlattform }
  | { op: 'post-ok'; folgeId: string; plattform: SocialPlattform; externeId?: string; link?: string }
  | { op: 'post-fehler'; folgeId: string; plattform: SocialPlattform; text: string; unklar?: boolean }
  | { op: 'post-warten'; folgeId: string; plattform: SocialPlattform; warten: string }
  | { op: 'medien-setzen'; folgeId: string; medien: string[] };

/** Schritte, die nur der Server selbst schreibt (Agent, Veröffentlicher) — nie aus dem Browser. */
export const NUR_SYSTEM_OPS: readonly string[] = ['entwurf', 'post-start', 'post-ok', 'post-fehler', 'post-warten', 'medien-setzen'];
/** Speichername, unter dem der Agent stempelt („geändert von“). */
export const AGENT_STEMPEL = 'zoe';

export interface AnwendenKontext {
  /** Speichername der schreibenden Person (nie aus dem Körper). */
  person: string;
  jetzt: string;
  /** Heutiger Berliner Tag (Ziele, Kontostände). Fehlt = Tag aus `jetzt`. */
  heute?: string;
  /** Speichernamen der Konten im Haushalt — eine Personenmarke gehört nur einer davon. Fehlt = keine Prüfung (Tests, Altweg). */
  personen?: readonly string[];
  /** Gültige Business-Gesellschaften (feste + Register) — fehlt = nur die Form wird geprüft. */
  gesellschaften?: readonly string[];
  standVon: (x: object) => string;
  neueId: (praefix: string) => string;
  /** Systemlauf (Agent/Veröffentlicher): sieht alle Kanäle und darf die Server-Schritte (`NUR_SYSTEM_OPS`). Nie aus einer Anfrage. */
  system?: boolean;
}

export type AnwendenErgebnis =
  | { ok: true; datei: SocialDatei; geaendert: string[] }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikte?: { op: number; id: string }[] };

class Abgelehnt extends Error { constructor(readonly status: 400 | 403 | 404 | 413, msg: string) { super(msg); } }
const nein = (msg: string, status: 400 | 403 | 404 | 413 = 400): never => { throw new Abgelehnt(status, msg); };

/** Sieht `person` diesen Kanal? „Nur die Person der Marke“ sieht nur sie — die EINE Regel für Lesen (Server) und Schreiben. */
export const kanalSichtbar = (k: Pick<SocialKanal, 'sichtbarkeit' | 'person'>, person: string | null | undefined): boolean =>
  k.sichtbarkeit !== 'person' || !k.person || k.person === person;

/** Die Datei so, wie `person` sie sehen darf: fremde „nur ich“-Kanäle samt Formaten und Folgen fehlen ganz. Rein. */
export function socialFuerPerson(d: SocialDatei, person: string | null | undefined): SocialDatei {
  const weg = new Set(d.kanaele.filter(k => !kanalSichtbar(k, person)).map(k => k.id));
  if (!weg.size) return d;
  return { kanaele: d.kanaele.filter(k => !weg.has(k.id)), formate: d.formate.filter(f => !weg.has(f.kanalId)), folgen: d.folgen.filter(f => !weg.has(f.kanalId)) };
}

export const NUR_PERSON_SELBST = 'Bei einer Personenmarke entscheidet das nur die Person selbst.';
export const GEHOERT_ZU_PRIVAT_SOCIAL = 'Diese Einheit gehört zu Privat — Social ist Business. Bitte eine Business-Gesellschaft wählen.';
/** Inhalt einer Folge, den eine Freigabe gesehen haben muss — ändert sich einer davon, fällt die Freigabe weg. */
const folgeInhalt = (f: SocialFolge) => JSON.stringify([f.titel, f.skript, f.hooks.map(h => [h.text, h.bildschirm ?? '']), f.cta ?? '', f.personenImBild ?? 'keine', f.werbung === true, f.quellen, f.medien ?? [], f.beschriftung ?? '']);

/** Server-Felder, die der Browser nie setzen darf. */
const OHNE_SERVERFELDER = (e: Record<string, unknown>) => {
  const { geaendert: _g, geaendertVon: _v, freigegebenAm: _f, freigegebenVon: _fv, messungen: _m, veroeffentlicht: _ve, stand: _s, ziele: _z, staende: _st, quelle: _q, platz: _p, versuche: _vs, plan: _pl, ...rest } = e;
  void _g; void _v; void _f; void _fv; void _m; void _ve; void _s; void _z; void _st; void _q; void _p; void _vs; void _pl;
  return rest;
};

/** Termin-Platz → Tag + Uhrzeit. */
export const platzTeile = (platz: string): { tag: string; um: string } => ({ tag: platz.slice(0, 10), um: platz.slice(11, 16) });
/** Ist der Platz belegt? (eine nicht verworfene Folge des Kanals auf diesem Platz bzw. Termin). */
export const platzBelegt = (folgen: readonly SocialFolge[], kanalId: string, platz: string, uhrzeitVorgabe: string): boolean =>
  folgen.some(f => f.kanalId === kanalId && f.status !== 'verworfen' && (f.platz === platz || (!!f.geplantAm && `${f.geplantAm}T${f.geplantUm ?? uhrzeitVorgabe}` === platz)));

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
  const heute = k.heute ?? tagVon(k.jetzt);
  /** Kanal, den die schreibende Person sehen darf — sonst „nicht gefunden“ (wer ihn nicht sieht, erfährt nicht, dass es ihn gibt). */
  const sichtbarerKanal = (id: unknown): number => {
    const j = typeof id === 'string' ? d.kanaele.findIndex(x => x.id === id) : -1;
    if (j < 0 || (!k.system && !kanalSichtbar(d.kanaele[j], k.person))) nein('Kanal nicht gefunden.', 404);
    return j;
  };
  const folgeSichtbar = (id: unknown): number => { const j = finde(d.folgen, id, 'Folge'); sichtbarerKanal(d.folgen[j].kanalId); return j; };
  const formatSichtbar = (id: unknown): number => { const j = finde(d.formate, id, 'Format'); sichtbarerKanal(d.formate[j].kanalId); return j; };
  /** Regeln für einen Kanal nach der Änderung (Personenmarke, Absender, Sichtbarkeit, Stufe 2). */
  const kanalRegeln = (neu: SocialKanal, alt: SocialKanal | null) => {
    if (neu.art === 'person' && neu.person && k.personen && !k.personen.includes(neu.person)) nein('Diese Person gehört nicht zum Haushalt.');
    if (neu.gesellschaft) {
      if (gehoertZuPrivat(neu.gesellschaft)) nein(GEHOERT_ZU_PRIVAT_SOCIAL);
      if (k.gesellschaften && !k.gesellschaften.includes(neu.gesellschaft) && neu.gesellschaft !== alt?.gesellschaft) nein('Diese Gesellschaft gibt es nicht (mehr) — im Register prüfen.');
    }
    const personenmarke = neu.art === 'person' && neu.person;
    if (neu.sichtbarkeit === 'person' && neu.person !== k.person && (alt?.sichtbarkeit !== 'person' || alt.person !== neu.person)) nein(`Nur die Person der Marke kann den Kanal auf „nur ich“ stellen. ${NUR_PERSON_SELBST}`, 403);
    if (personenmarke && neu.leitplanken.autonomie === 2 && alt?.leitplanken.autonomie !== 2 && k.person !== neu.person) nein(`Stufe 2 (selbstständig) schaltet nur die Person der Marke ein. ${NUR_PERSON_SELBST}`, 403);
  };
  try {
    opsRoh.forEach((roh, i) => {
      if (!roh || typeof roh !== 'object') nein(`Änderung ${i + 1} ist kein Objekt.`);
      const op = roh as SocialOp & Record<string, unknown>;
      if (NUR_SYSTEM_OPS.includes(String(op.op)) && !k.system) nein('Diesen Schritt schreibt nur der Server (Redaktions-Agent, Veröffentlicher).', 403);
      switch (op.op) {
        case 'kanal': {
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          const alt = istKennung(e.id) ? d.kanaele.findIndex(x => x.id === e.id && kanalSichtbar(x, k.person)) : -1;
          if (alt >= 0) standPasst(d.kanaele[alt], op.stand, i, d.kanaele[alt].id);
          else if (e.id !== undefined) nein('Diesen Kanal gibt es nicht (mehr) — neu laden.', 404);
          // Leitplanken: der Not-Aus wird nur über den eigenen Schritt geschaltet — beim Bearbeiten bleibt er, wie er war.
          const lp = { ...((e.leitplanken ?? {}) as Record<string, unknown>) };
          if (alt >= 0) { lp.postenAus = d.kanaele[alt].leitplanken.postenAus; lp.antwortenAus = d.kanaele[alt].leitplanken.antwortenAus; }
          const neu = kanalAus({ ...(alt >= 0 ? d.kanaele[alt] : {}), ...e, leitplanken: lp, id: alt >= 0 ? d.kanaele[alt].id : k.neueId('sk'), ...vermerk });
          if (!neu) nein('Ein Kanal braucht einen Namen.');
          kanalRegeln(neu!, alt >= 0 ? d.kanaele[alt] : null);
          if (alt >= 0) d.kanaele[alt] = neu!; else { if (d.kanaele.length >= G.kanaele) nein(`Höchstens ${G.kanaele} Kanäle.`, 413); d.kanaele.push(neu!); }
          geaendert.push(neu!.id);
          break;
        }
        case 'kanal-archiv': case 'notaus': {
          const j = sichtbarerKanal(op.id);
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
          const alt = istKennung(e.id) ? d.formate.findIndex(x => x.id === e.id && d.kanaele.some(c => c.id === x.kanalId && kanalSichtbar(c, k.person))) : -1;
          if (alt >= 0) standPasst(d.formate[alt], op.stand, i, d.formate[alt].id);
          else if (e.id !== undefined) nein('Dieses Format gibt es nicht (mehr) — neu laden.', 404);
          const kanalId = alt >= 0 ? d.formate[alt].kanalId : e.kanalId;
          if (!d.kanaele.some(c => c.id === kanalId && kanalSichtbar(c, k.person))) nein('Das Format braucht einen vorhandenen Kanal.');
          const vorher = alt >= 0 ? d.formate[alt] : null;
          // Inhalt geändert → Freigabe fällt weg (der Agent darf nur, was eine Person so gesehen hat).
          const neu = formatAus({ ...(vorher ?? {}), ...e, kanalId, id: vorher?.id ?? k.neueId('sf'), ...vermerk });
          if (!neu) nein('Ein Format braucht einen Namen.');
          const inhaltNeu = vorher && (vorher.name !== neu!.name || vorher.beschreibung !== neu!.beschreibung || vorher.laengeSek !== neu!.laengeSek || vorher.art !== neu!.art);
          const fertig = inhaltNeu ? formatAus({ ...neu!, freigegebenAm: undefined, freigegebenVon: undefined })! : neu!;
          if (alt >= 0) d.formate[alt] = fertig; else { if (d.formate.length >= G.formate) nein(`Höchstens ${G.formate} Formate.`, 413); d.formate.push(fertig); }
          geaendert.push(fertig.id);
          break;
        }
        case 'format-freigeben': {
          const j = formatSichtbar(op.id);
          standPasst(d.formate[j], op.stand, i, d.formate[j].id);
          const kn = d.kanaele.find(c => c.id === d.formate[j].kanalId)!;
          if (op.freigeben && kn.art === 'person' && kn.person && kn.person !== k.person) nein(`Formate einer Personenmarke gibt nur die Person selbst frei. ${NUR_PERSON_SELBST}`, 403);
          d.formate[j] = formatAus({ ...d.formate[j], freigegebenAm: op.freigeben ? k.jetzt : undefined, freigegebenVon: op.freigeben ? k.person : undefined, ...vermerk })!;
          geaendert.push(d.formate[j].id);
          break;
        }
        case 'format-weg': {
          const j = formatSichtbar(op.id);
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
          const alt = istKennung(e.id) ? d.folgen.findIndex(x => x.id === e.id && d.kanaele.some(c => c.id === x.kanalId && kanalSichtbar(c, k.person))) : -1;
          if (alt >= 0) standPasst(d.folgen[alt], op.stand, i, d.folgen[alt].id);
          else if (e.id !== undefined) nein('Diese Folge gibt es nicht (mehr) — neu laden.', 404);
          const vorher = alt >= 0 ? d.folgen[alt] : null;
          const kanalId = vorher?.kanalId ?? e.kanalId;
          if (!d.kanaele.some(c => c.id === kanalId && kanalSichtbar(c, k.person))) nein('Die Folge braucht einen vorhandenen Kanal.');
          if (istKennung(e.formatId) && !d.formate.some(f => f.id === e.formatId && f.kanalId === kanalId)) nein('Das Format gehört nicht zu diesem Kanal.');
          if (typeof e.skript === 'string' && e.skript.length > G.skript) nein(`Das Skript ist länger als ${G.skript} Zeichen — nichts gespeichert.`, 413);
          if (Array.isArray(e.hooks) && e.hooks.length > G.hooks) nein(`Höchstens ${G.hooks} Hook-Varianten.`, 413);
          if (Array.isArray(e.quellen) && e.quellen.length > G.quellen) nein(`Höchstens ${G.quellen} Quellen.`, 413);
          if (typeof e.beschriftung === 'string' && e.beschriftung.trim().length > G.beschriftung) nein(`Die Beschriftung ist länger als ${G.beschriftung} Zeichen (Instagram-Grenze) — nichts gespeichert.`, 413);
          if (Array.isArray(e.medien) && e.medien.length > G.medien) nein(`Höchstens ${G.medien} Fotos oder Videos je Beitrag (Instagram-Karussell: 20).`, 413);
          // Hooks ohne Kennung bekommen eine vom Server.
          const hooks = Array.isArray(e.hooks) ? e.hooks.map(h => (h && typeof h === 'object' ? { ...(h as object), id: istKennung((h as { id?: unknown }).id) ? (h as { id: string }).id : k.neueId('hk') } : h)) : undefined;
          const roh = folgeAus({ ...(vorher ?? {}), ...e, ...(hooks ? { hooks } : {}), kanalId, id: vorher?.id ?? k.neueId('sv'), ...vermerk });
          if (!roh) nein('Eine Folge braucht einen Titel.');
          // Freigabe = eine Person hat GENAU diesen Inhalt gesehen: Status „Freigegeben“ neu gesetzt → stempeln; Inhalt geändert ohne neue
          // Freigabe → die alte fällt weg (aus „Freigegeben“/„Geplant“ wird wieder „Entwurf“).
          const freigebenNeu = roh!.status === 'freigegeben' && (vorher?.status !== 'freigegeben' || e.status === 'freigegeben' && !vorher?.freigegebenAm);
          const inhaltGeaendert = vorher && folgeInhalt(vorher) !== folgeInhalt(roh!);
          let neu = roh!;
          if (freigebenNeu || (inhaltGeaendert && e.status === 'freigegeben')) neu = { ...neu, freigegebenAm: k.jetzt, freigegebenVon: k.person };
          else if (inhaltGeaendert && neu.freigegebenAm) neu = folgeAus({ ...neu, freigegebenAm: undefined, freigegebenVon: undefined, status: neu.status === 'freigegeben' || neu.status === 'geplant' ? 'entwurf' : neu.status })!;
          else if (!['freigegeben', 'geplant', 'veroeffentlicht'].includes(neu.status) && neu.freigegebenAm) neu = folgeAus({ ...neu, freigegebenAm: undefined, freigegebenVon: undefined })!;
          if (alt >= 0) d.folgen[alt] = neu; else { if (d.folgen.length >= G.folgen) nein(`Höchstens ${G.folgen} Folgen.`, 413); d.folgen.push(neu); }
          geaendert.push(neu.id);
          break;
        }
        case 'folge-weg': {
          const j = folgeSichtbar(op.id);
          standPasst(d.folgen[j], op.stand, i, d.folgen[j].id);
          // Veröffentlichtes mit Messungen bleibt (Lerngrundlage) — nur verwerfen, nie löschen.
          if (d.folgen[j].veroeffentlicht.length || d.folgen[j].messungen.length) nein('Veröffentlichte Folgen mit Zahlen bleiben als Lerngrundlage — stattdessen „Verworfen“ setzen.', 400);
          geaendert.push(d.folgen[j].id);
          d.folgen.splice(j, 1);
          break;
        }
        case 'messung': {
          const j = folgeSichtbar(op.folgeId);
          const m = messungAus({ ...((op.messung ?? {}) as Record<string, unknown>), id: k.neueId('sm') });
          if (!m) nein('Eine Messung braucht Plattform, Tag (JJJJ-MM-TT) und Aufrufe.');
          if (d.folgen[j].messungen.length >= G.messungenJeFolge) nein(`Höchstens ${G.messungenJeFolge} Messungen je Folge.`, 413);
          d.folgen[j] = { ...d.folgen[j], messungen: [...d.folgen[j].messungen, m!], ...vermerk };
          geaendert.push(d.folgen[j].id);
          break;
        }
        case 'veroeffentlicht': {
          const j = folgeSichtbar(op.folgeId);
          const v = veroeffentlichungAus({ plattform: op.plattform, am: op.am, link: op.link });
          if (!v) nein('Veröffentlichung braucht Plattform und Tag (JJJJ-MM-TT); Links nur https.');
          if (d.folgen[j].veroeffentlicht.length >= G.veroeffentlichungen) nein('Zu viele Veröffentlichungen für eine Folge.', 413);
          d.folgen[j] = { ...d.folgen[j], status: 'veroeffentlicht', veroeffentlicht: [...d.folgen[j].veroeffentlicht.filter(x => x.plattform !== v!.plattform), v!], ...vermerk };
          geaendert.push(d.folgen[j].id);
          break;
        }
        case 'vorlage': {
          // Neuer Kanal aus einer Vorlage (lib/social/vorlagen.ts): Markenprofil, Leitplanken, Ziel-Vorschläge mit Wert und die Serienformate
          // in EINEM Schritt — Formate nie freigegeben. Name, Handle, Sprache, Person und Gesellschaft kommen aus der Eingabe.
          const v = vorlageVon(op.vorlageId);
          if (!v) nein('Diese Vorlage gibt es nicht.', 404);
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          if (d.kanaele.length >= G.kanaele) nein(`Höchstens ${G.kanaele} Kanäle.`, 413);
          if (d.formate.length + v!.formate.length > G.formate) nein(`Höchstens ${G.formate} Formate.`, 413);
          const id = k.neueId('sk');
          const neu = kanalAus({
            id, name: e.name, handle: e.handle, sprache: e.sprache, art: v!.art, person: e.person, gesellschaft: e.gesellschaft,
            sichtbarkeit: e.sichtbarkeit, vorlage: v!.id, kiKanal: v!.kiKanal === true, persona: e.persona,
            plattformen: Array.isArray(e.plattformen) && e.plattformen.length ? e.plattformen : v!.plattformen,
            marke: { ton: v!.ton, saeulen: v!.saeulen, nieSagen: v!.nieSagen, cta: v!.cta, versprechen: e.versprechen, zielgruppe: e.zielgruppe },
            leitplanken: { ...LEITPLANKEN_VORGABE, ...v!.leitplanken, postenAus: false, antwortenAus: false },
            ziele: [], staende: [], ...vermerk,
          });
          if (!neu) nein('Ein Kanal braucht einen Namen.');
          kanalRegeln(neu!, null);
          const ziele = v!.ziele.filter(z => z.zielwert !== undefined && !(ZIEL_MIT_LINIE as readonly ZielMetrik[]).includes(z.metrik))
            .filter(z => !z.plattform || neu!.plattformen.includes(z.plattform))
            .map(z => zielAus({ id: k.neueId('sz'), metrik: z.metrik, zielwert: z.zielwert, plattform: z.plattform, von: heute, startwert: 0 })!).filter(Boolean);
          d.kanaele.push({ ...neu!, ziele });
          for (const f of v!.formate) d.formate.push(formatAus({ id: k.neueId('sf'), kanalId: id, name: f.name, beschreibung: f.beschreibung, art: f.art, laengeSek: f.laengeSek, ...vermerk })!);
          geaendert.push(id);
          break;
        }
        case 'ziel': case 'ziel-weg': {
          const j = sichtbarerKanal(op.kanalId);
          standPasst(d.kanaele[j], op.stand, i, d.kanaele[j].id);
          const c = d.kanaele[j];
          if (op.op === 'ziel-weg') {
            if (!c.ziele.some(z => z.id === op.id)) nein('Ziel nicht gefunden.', 404);
            d.kanaele[j] = { ...c, ziele: c.ziele.filter(z => z.id !== op.id), ...vermerk };
          } else {
            const e = (op.eintrag ?? {}) as Record<string, unknown>;
            const altZ = istKennung(e.id) ? c.ziele.find(z => z.id === e.id) : undefined;
            if (e.id !== undefined && !altZ) nein('Ziel nicht gefunden.', 404);
            if (!altZ && c.ziele.length >= G.ziele) nein(`Höchstens ${G.ziele} Ziele je Kanal.`, 413);
            const metrik = (ZIEL_METRIKEN as readonly unknown[]).includes(e.metrik) ? e.metrik as ZielMetrik : nein('Welche Kennzahl? (follower, aufrufe, posts-woche, halte3s, shares-je-tsd)');
            const vonRoh = e.von === undefined || e.von === '' ? altZ?.von ?? heute : e.von;
            if (!istKalendertag(vonRoh) || vonRoh > heute) nein('Start: ein Tag bis heute.');
            const von = vonRoh as string;
            const linie = (ZIEL_MIT_LINIE as readonly ZielMetrik[]).includes(metrik);
            if (linie && !(istKalendertag(e.bis) && e.bis > von)) nein('Bis wann? Ein Tag nach dem Start.');
            if (istPlattform(e.plattform) && !c.plattformen.includes(e.plattform)) nein('Diese Plattform gehört nicht zum Kanal.');
            const grundlage = { metrik, plattform: istPlattform(e.plattform) ? e.plattform : undefined, von: von as string };
            // Startwert rechnet der Server — neu nur, wenn sich Kennzahl, Plattform oder Start ändern.
            const gleich = altZ && altZ.metrik === grundlage.metrik && altZ.plattform === grundlage.plattform && altZ.von === grundlage.von;
            const startwert = gleich ? altZ!.startwert : zielStartwert(grundlage, c, d.folgen, heute);
            const z = zielAus({ ...grundlage, id: altZ?.id ?? k.neueId('sz'), zielwert: e.zielwert, bis: e.bis, notiz: e.notiz, startwert });
            if (!z) nein('Ein Ziel braucht einen Zielwert über 0.');
            d.kanaele[j] = { ...c, ziele: altZ ? c.ziele.map(x => (x.id === altZ.id ? z! : x)) : [...c.ziele, z!], ...vermerk };
          }
          geaendert.push(c.id);
          break;
        }
        case 'kontostand': {
          const j = sichtbarerKanal(op.kanalId);
          const c = d.kanaele[j];
          const st = standAus({ id: k.neueId('ks'), plattform: op.plattform, am: op.am, follower: op.follower, quelle: 'hand' });
          if (!st) nein('Kontostand: Plattform, Tag (JJJJ-MM-TT) und Follower.');
          if (st!.am > heute) nein('Ein Kontostand gilt höchstens bis heute.');
          if (!c.plattformen.includes(st!.plattform)) nein('Diese Plattform gehört nicht zum Kanal.');
          if (c.staende.length >= G.staende) nein(`Höchstens ${G.staende} Kontostände je Kanal.`, 413);
          // Ein Stand je Plattform und Tag — ein neuer Wert am selben Tag ersetzt den alten.
          d.kanaele[j] = { ...c, staende: [...c.staende.filter(x => !(x.plattform === st!.plattform && x.am === st!.am)), st!], ...vermerk };
          geaendert.push(c.id);
          break;
        }
        case 'plan': {
          const j = sichtbarerKanal(op.kanalId);
          standPasst(d.kanaele[j], op.stand, i, d.kanaele[j].id);
          const plan = planAus(op.plan);
          if (!plan) nein('Plan: Tage, Uhrzeit (HH:MM), Vorlauf.');
          d.kanaele[j] = { ...d.kanaele[j], plan, ...vermerk };
          geaendert.push(d.kanaele[j].id);
          break;
        }
        case 'versuch-loesen': {
          // Eine Person hat bei der Plattform nachgesehen: der gescheiterte bzw. unklare Versuch geht weg — der nächste Lauf darf wieder posten.
          const j = folgeSichtbar(op.folgeId);
          standPasst(d.folgen[j], op.stand, i, d.folgen[j].id);
          const f = d.folgen[j];
          if (!(f.versuche ?? []).some(v => v.plattform === op.plattform && v.zustand !== 'laeuft')) nein('Kein gescheiterter Versuch für diese Plattform.', 404);
          d.folgen[j] = folgeAus({ ...f, versuche: (f.versuche ?? []).filter(v => v.plattform !== op.plattform), ...vermerk })!;
          geaendert.push(f.id);
          break;
        }
        case 'entwurf': {
          // Redaktions-Agent: EIN Entwurf je Termin-Platz — ist der Platz schon belegt (zweiter Lauf, Person hat dort etwas geplant), passiert nichts.
          const j = sichtbarerKanal(op.kanalId);
          const c = d.kanaele[j];
          if (typeof op.platz !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(op.platz) || !istKalendertag(op.platz.slice(0, 10))) nein('Platz: JJJJ-MM-TTTHH:MM.');
          if (platzBelegt(d.folgen, c.id, op.platz, (c.plan ?? PLAN_VORGABE).uhrzeit)) break;
          const e = OHNE_SERVERFELDER((op.eintrag ?? {}) as Record<string, unknown>);
          if (istKennung(e.formatId) && !d.formate.some(f => f.id === e.formatId && f.kanalId === c.id)) nein('Das Format gehört nicht zu diesem Kanal.');
          const { tag, um } = platzTeile(op.platz);
          const hooks = Array.isArray(e.hooks) ? e.hooks.slice(0, G.hooks).map(h => ({ ...(h as object), id: k.neueId('hk') })) : [];
          const neu = folgeAus({
            ...e, hooks, id: k.neueId('sv'), kanalId: c.id, quelle: 'agent', platz: op.platz, geplantAm: tag, geplantUm: um,
            status: e.status === 'geplant' ? 'geplant' : 'entwurf', veroeffentlicht: [], messungen: [], ...vermerk,
          });
          if (!neu) nein('Ein Entwurf braucht einen Titel.');
          if (neu!.skript.length >= G.skript) nein(`Das Skript ist länger als ${G.skript} Zeichen.`, 413);
          if (d.folgen.length >= G.folgen) nein(`Höchstens ${G.folgen} Folgen.`, 413);
          d.folgen.push({ ...neu!, hookId: neu!.hooks[0]?.id });
          geaendert.push(neu!.id);
          break;
        }
        case 'medien-setzen': {
          // Die Reel-Werkstatt hängt ihr Ergebnis an (nur der Server). Neuer Inhalt → die Freigabe fällt zurück (wie bei jeder Inhaltsänderung);
          // ein schon veröffentlichter Beitrag wird nie angefasst.
          const j = folgeSichtbar(op.folgeId);
          const f = d.folgen[j];
          if (f.status === 'veroeffentlicht' || f.veroeffentlicht.length) { konflikte.push({ op: i, id: f.id }); break; }
          if (!Array.isArray(op.medien) || op.medien.length > G.medien || !op.medien.every(x => MEDIUM_KENNUNG.test(x))) nein('Ungültige Medien.');
          const zurueck = f.freigegebenAm ? { freigegebenAm: undefined, freigegebenVon: undefined, status: f.status === 'freigegeben' || f.status === 'geplant' ? 'entwurf' : f.status } : {};
          d.folgen[j] = folgeAus({ ...f, medien: op.medien, ...zurueck, ...vermerk })!;
          geaendert.push(f.id);
          break;
        }
        case 'post-start': case 'post-ok': case 'post-fehler': case 'post-warten': {
          const j = folgeSichtbar(op.folgeId);
          const f = d.folgen[j];
          if (!istPlattform(op.plattform)) nein('Unbekannte Plattform.');
          const andere = (f.versuche ?? []).filter(v => v.plattform !== op.plattform);
          const meiner = (f.versuche ?? []).find(v => v.plattform === op.plattform);
          if (op.op === 'post-start') {
            // Nie doppelt: schon online, ein Versuch läuft oder endete unklar → abgelehnt (der Lauf fragt vorher, das hier ist die Sperre).
            if (f.veroeffentlicht.some(v => v.plattform === op.plattform) || meiner) { konflikte.push({ op: i, id: f.id }); break; }
            d.folgen[j] = folgeAus({ ...f, versuche: [...andere, { plattform: op.plattform, seit: k.jetzt, zustand: 'laeuft' }], ...vermerk })!;
          } else if (op.op === 'post-warten') {
            // Nur ein laufender Versuch darf weiter warten (der Anbieter verarbeitet noch) — nie ein neuer.
            if (meiner?.zustand !== 'laeuft' || typeof op.warten !== 'string' || op.warten.length > 2000) { konflikte.push({ op: i, id: f.id }); break; }
            d.folgen[j] = folgeAus({ ...f, versuche: [...andere, { ...meiner, warten: op.warten }], ...vermerk })!;
          } else if (op.op === 'post-ok') {
            const v = veroeffentlichungAus({ plattform: op.plattform, am: heute, link: op.link, externeId: op.externeId, durch: 'automatik' });
            d.folgen[j] = folgeAus({ ...f, status: 'veroeffentlicht', versuche: andere, veroeffentlicht: [...f.veroeffentlicht.filter(x => x.plattform !== op.plattform), v!], ...vermerk })!;
          } else {
            d.folgen[j] = folgeAus({ ...f, versuche: [...andere, { plattform: op.plattform, seit: meiner?.seit ?? k.jetzt, zustand: op.unklar ? 'unklar' : 'fehler', text: text(op.text, G.text) }], ...vermerk })!;
          }
          geaendert.push(f.id);
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
  // Personenmarke einer gelöschten Person: der Kanal bleibt (Arbeit des Haushalts), ohne Person und ohne „nur ich“ — sonst sähe ihn niemand mehr.
  const kanaele = d.kanaele.map(v).map(k => {
    if (k.person !== speicher) return k;
    n++;
    const { person: _p, sichtbarkeit: _s, ...rest } = k; void _p; void _s;
    return rest as SocialKanal;
  });
  return { neu: { kanaele, formate: d.formate.map(v), folgen: d.folgen.map(v) }, n };
}

/** Export: was die Person in Social gestempelt hat — Art, Kennung, Zeit. Rein. */
export function socialEintraegeVon(d: SocialDatei, speicher: string): { art: string; id: string; am?: string }[] {
  const raus: { art: string; id: string; am?: string }[] = [];
  for (const k of d.kanaele) if (k.person === speicher) raus.push({ art: 'Personenmarke', id: k.id, am: k.geaendert });
  for (const [art, l] of [['kanal', d.kanaele], ['format', d.formate], ['folge', d.folgen]] as const) {
    for (const x of l as readonly { id: string; geaendert: string; geaendertVon?: string; freigegebenVon?: string; freigegebenAm?: string }[]) {
      if (x.geaendertVon === speicher) raus.push({ art: `${art} geändert`, id: x.id, am: x.geaendert });
      if (x.freigegebenVon === speicher) raus.push({ art: `${art} freigegeben`, id: x.id, am: x.freigegebenAm });
    }
  }
  return raus;
}

// ─── Kalender — Bezüge zu MAKE OS am Termin (rein, getestet, 29.09., K1) ────
// Wo jede Termin-Information liegt (Kevin 29.09.: „alles sauber mit allen verbunden,
// Datenhaltung sauber“; Datenregel KALENDER_VERBINDUNGEN.md 4a):
//
//   iCloud (VEVENT)       DIE Wahrheit für den Termin: Titel, Zeit, Zone (TZID), ganztags,
//                         Ort, Notiz, Serie (RRULE/EXDATE), Erinnerungen (VALARM), frei/
//                         beschäftigt (TRANSP), Sichtbarkeit (CLASS), Farbe (COLOR), Art
//                         (X-MAKE-ART). Der Arbeitsort steht im Titel.
//   `kalender-bezug`      (dieser Bestand, verschlüsselt wie jeder Bestand) NUR, was es im
//                         Standard nicht gibt: Kennungen zu MAKE OS (Aufgabe, Mandat, Kontakt,
//                         Firma, Deal, Event), wer den Termin in MAKE OS angelegt hat (`von`,
//                         Speichername), den Starttag (für die Verbindungsprüfung) und eine
//                         SICHERUNG von Art und „privat“ — Apple verliert X-Eigenschaften und
//                         CLASS, wenn man den Termin in Apple bearbeitet. Nie Namen, nie Titel.
//                         Schlüssel `kalender|uid` (ganze Serie) bzw. `kalender|uid::RECURRENCE-ID` (ein Vorkommen)
//                         — seit R-K1 (#46) mit der Kalender-Kennung, weil dieselbe UID in zwei Kalendern stehen kann.
//                         Alte Schlüssel ohne Kalender (`uid`, `uid::RID`) bleiben lesbar; eindeutige zieht der
//                         Abgleich auf die neue Form um (`bezugUmzugPlan`).
//   Aufgabe als Termin    ist KEIN Termin: dieselbe Aufgabe im Aufgaben-Modell (`dueDate` +
//                         `dueTime`) — eine Stelle, keine Kopie.
//   Fokus-Block           trägt `terminUid` (lib/zeitmessung/modell.ts) — geprüft in der
//                         Verbindungsprüfung (`zeit-termin-tot`).
//   Gäste (K3, 30.09.)    Die Adressen stehen NUR im Termin (ATTENDEE, iCloud verschickt nach Klick). Hier nur die
//                         Kontakt-Kennungen der Gäste aus dem CRM (`gastKontakte`) — nie Adressen, nie Namen.
//   CRM-Meeting (K3)      Die Aktivität „Meeting“ am Kontakt trägt `terminUid` (= Schlüssel des Termins bzw. Vorkommens);
//                         ihre Zeit liest sie über diesen Verweis aus dem Termin (lib/crm/termin-aktivitaet.ts).
//
// Vorrang beim Lesen (`mitBezug`): der iCloud-Text gewinnt; die Sicherung füllt nur, was dort
// fehlt (Art verloren → Sicherung; „privat“ gilt, wenn EINE Seite privat sagt — Privatheit geht
// nie still verloren). Abgleich nach jedem iCloud-Lauf (`bezugAbgleichPlan`): Termine mit
// X-MAKE-ART ohne Eintrag bekommen ihre Sicherung; Einträge, deren X-MAKE-ART fehlt, meldet die
// Verbindungsprüfung (`termin-art-verloren`) — beim nächsten Speichern in MAKE OS wird sie wieder
// geschrieben. Speicher/Sperre: lib/kalender/bezug-server.ts.

import type { Termin, IcsZusatz } from './ics';
import { istIcsArt, farbeSauber, farbeHex, type IcsArt } from './arten';

export const BEZUG_FELDER = ['kontaktId', 'firmaId', 'mandatId', 'dealId', 'aufgabeId', 'eventId'] as const;
export type BezugFeld = (typeof BEZUG_FELDER)[number];
export type BezugKennungen = Partial<Record<BezugFeld, string>>;

/** Höchstzahl der Gast-Kennungen je Termin (die Adressen selbst stehen nur im Termin). */
export const GAST_KONTAKTE_MAX = 50;

export interface TerminBezug extends BezugKennungen {
  /** Kontakt-Kennungen der Gäste aus dem CRM (K3) — nie Adressen. */
  gastKontakte?: string[];
  /** Wer ihn in MAKE OS angelegt hat (Speichername) — Eigentümer für „privat“ im gemeinsamen Kalender. */
  von?: string;
  /** Sicherung der Art (X-MAKE-ART). */
  art?: IcsArt;
  /** Sicherung „privat“ (CLASS:PRIVATE). */
  privat?: true;
  /** Sicherung der eigenen Farbe (COLOR, Farb-Kennung) — Apple verliert COLOR beim Bearbeiten wie X-MAKE-ART (#47). */
  farbe?: string;
  /** Starttag YYYY-MM-DD (Berlin) — „UID tot“ prüft nur im Holfenster. */
  tag?: string;
  /**
   * Änderungsmarke eines Spiegels (Upload U1 B3, 29.09.): Fingerabdruck des Solls (Titel, Zeit, Ort) beim letzten Spiegeln
   * bzw. `weg` nach einer gemeldeten Absage (lib/kalender/spiegel.ts `spiegelMarke`). Der Abgleich schreibt nur, wenn sich
   * das Modul seitdem geändert hat — Änderungen in Apple werden nicht bei jedem Takt überschrieben. Nie Titel, nur der Hash.
   */
  spiegel?: string;
  geaendert: string;
}
export interface BezugBestand { bezuege: Record<string, TerminBezug> }
export const LEER_BEZUG: BezugBestand = { bezuege: {} };
/** Höchstzahl der Einträge — darüber lehnt der Schreibweg ab (413), nie still kürzen. */
export const BEZUG_MAX = 20_000;

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UID = /^[^\u0000-\u001f\u007f]{1,300}$/;
const SPIEGEL_MARKE = /^[a-z0-9]{1,24}$/;

// ── Schlüssel (R-K1 #46: Kalender + UID + RECURRENCE-ID) ────────────────────
// Eine UID ist nur innerhalb EINES Kalenders eindeutig (Apple kopiert beim Duplizieren in einen anderen Kalender die UID
// mit). Deshalb trägt jeder Schlüssel die Kennung des Kalenders: `kalender|uid` bzw. `kalender|uid::RID`. Die Kennung ist
// das letzte Stück der Kalender-Adresse (iCloud: eine GUID oder „home“) — stabil, auch wenn iCloud den Server wechselt
// (p12-caldav → p34-caldav). Ältere Verweise ohne Kalender (`uid`, `uid::RID`) gelten weiter: Lesen nimmt beide Formen.

const KAL_KENNUNG = /^[A-Za-z0-9_.-]{1,48}$/;
const KAL_TRENNER = '|';

/** Kurzer, stabiler Hash (FNV-1a) — client- und serversicher. */
export function fnv(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/** Kennung eines Kalenders aus seiner Adresse (letztes Pfadstück, sonst ein Hash) — ohne `|` und `::`. */
export function kalenderKennung(kalenderId: string): string {
  let teil = '';
  try { teil = decodeURIComponent(new URL(kalenderId).pathname.split('/').filter(Boolean).pop() ?? ''); } catch { teil = kalenderId.split('/').filter(Boolean).pop() ?? ''; }
  return KAL_KENNUNG.test(teil) ? teil : `k${fnv(kalenderId)}`;
}

/** Schlüssel eines Termins: `kalender|uid` (ganze Serie) oder `kalender|uid::RID` (ein Vorkommen); ohne Kalender die alte Form. */
export const terminSchluessel = (kal: string | undefined, uid: string, rid?: string): string => `${kal ? `${kal}${KAL_TRENNER}` : ''}${uid}${rid ? `::${rid}` : ''}`;

/** Zerlegen: Kalender (nur neue Form), UID, RECURRENCE-ID. */
export function schluesselTeile(s: string): { kal?: string; uid: string; rid?: string } {
  const i = s.indexOf(KAL_TRENNER);
  const kal = i > 0 && KAL_KENNUNG.test(s.slice(0, i)) ? s.slice(0, i) : undefined;
  const rest = kal ? s.slice(i + 1) : s;
  const j = rest.indexOf('::');
  return { ...(kal ? { kal } : {}), uid: j < 0 ? rest : rest.slice(0, j), ...(j >= 0 ? { rid: rest.slice(j + 2) } : {}) };
}

/** Schlüssel eines Eintrags ohne Kalender (alte Form) — für Übergang und Lesen alter Verweise. */
export const bezugSchluessel = (uid: string, rid?: string): string => terminSchluessel(undefined, uid, rid);
/** UID eines Schlüssels (beide Formen). */
export const uidVonSchluessel = (s: string): string => schluesselTeile(s).uid;
/** Der Schlüssel der ganzen Serie bzw. des Objekts (ohne RECURRENCE-ID), Kalender bleibt. */
export const serienSchluessel = (s: string): string => { const t = schluesselTeile(s); return terminSchluessel(t.kal, t.uid); };
/** Derselbe Schlüssel in der alten Form (ohne Kalender). */
export const altSchluessel = (s: string): string => { const t = schluesselTeile(s); return terminSchluessel(undefined, t.uid, t.rid); };
/** Der Verweis auf das Objekt eines Termins (für Ändern/Löschen/Bezug): Kalender + UID, ohne Vorkommen. */
export const objektSchluessel = (t: { id: string }): string => serienSchluessel(t.id);
export const schluesselGueltig = (s: unknown): s is string => typeof s === 'string' && UID.test(s) && !!uidVonSchluessel(s);

/**
 * Zeigt ein gespeicherter Verweis (Aktivität `terminUid`, Fokus-Block, Bezug-Schlüssel) auf diesen Termin bzw. dieses
 * Vorkommen? Neue Form: genau (mit Kalender). Alte Form (ohne Kalender): über die UID — gilt, solange sie eindeutig ist.
 * `serie`: ein Verweis auf die ganze Serie trifft auch jedes Vorkommen.
 */
export function schluesselPasst(ref: string | undefined, id: string, opt: { serie?: boolean } = {}): boolean {
  if (!ref) return false;
  const r = schluesselTeile(ref), t = schluesselTeile(id);
  if (r.uid !== t.uid) return false;
  if (r.kal && t.kal && r.kal !== t.kal) return false;
  if ((r.rid ?? '') === (t.rid ?? '')) return true;
  return !!opt.serie && !r.rid;
}

/**
 * Gehört ein Verweis zu diesem Termin bzw. dieser Serie (`id` ohne RECURRENCE-ID = die ganze Serie mit allen Vorkommen)?
 * Kalender nur verglichen, wenn beide Seiten einen tragen (alte Verweise gelten über die UID).
 */
export function schluesselGehoertZu(ref: string | undefined, id: string): boolean {
  if (!ref) return false;
  const r = schluesselTeile(ref), t = schluesselTeile(id);
  if (r.uid !== t.uid || (r.kal && t.kal && r.kal !== t.kal)) return false;
  return !t.rid || r.rid === t.rid;
}

/** Was im iCloud-Stand lebt — UIDs und Schlüssel (`kalender|uid`) — für „gibt es den Termin zu diesem Verweis noch?“. */
export interface Lebend { uids: ReadonlySet<string>; schluessel: ReadonlySet<string> }
export function lebendAus(objekte: readonly { uid: string; schluessel?: string }[]): Lebend {
  return { uids: new Set(objekte.map(o => o.uid)), schluessel: new Set(objekte.map(o => o.schluessel).filter((x): x is string => !!x)) };
}
/** Lebt der Termin zu einem Verweis? Neue Form: genau dieser Kalender; alte Form (nur UID): irgendwo im Stand. */
export function verweisLebt(ref: string, l: Lebend): boolean {
  const t = schluesselTeile(ref);
  return t.kal ? l.schluessel.has(terminSchluessel(t.kal, t.uid)) : l.uids.has(t.uid);
}

/** Der Eintrag eines Termins in beiden Schlüssel-Formen: Vorkommen vor Serie, neue Form vor alter. */
export function bezugVon(bestand: BezugBestand | null | undefined, t: { id: string; uid?: string }): TerminBezug | undefined {
  const b = bestand?.bezuege;
  if (!b) return undefined;
  const teile = schluesselTeile(t.id);
  const uid = teile.uid || t.uid || '';
  const kandidaten = [t.id, terminSchluessel(teile.kal, uid), terminSchluessel(undefined, uid, teile.rid), uid];
  for (const k of kandidaten) if (k && b[k]) return b[k];
  return undefined;
}

/** Nur die Kennungen (für Prüfung, Anzeige, Art. 17). */
export function kennungenVon(b: Partial<TerminBezug> | undefined | null): BezugKennungen {
  const raus: BezugKennungen = {};
  for (const f of BEZUG_FELDER) { const v = b?.[f]; if (typeof v === 'string' && KENNUNG.test(v)) raus[f] = v; }
  return raus;
}

/** Gast-Kennungen säubern (nur gültige Kennungen, ohne Doppelte, höchstens GAST_KONTAKTE_MAX). */
export function gastKontakteSauber(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && KENNUNG.test(x)))).slice(0, GAST_KONTAKTE_MAX);
}

/** Alle Kontakte eines Termins: der verknüpfte Kontakt und die Gäste aus dem CRM (ohne Doppelte). */
export function kontakteVon(b: Partial<Pick<TerminBezug, 'kontaktId' | 'gastKontakte'>> | undefined | null): string[] {
  return Array.from(new Set([...(b?.kontaktId ? [b.kontaktId] : []), ...gastKontakteSauber(b?.gastKontakte)]));
}

/** Einen Eintrag säubern — null, wenn nichts Gültiges übrig bleibt (dann fällt er weg). */
export function bezugSauber(v: unknown, jetzt = new Date().toISOString()): TerminBezug | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const gaeste = gastKontakteSauber(o.gastKontakte);
  const raus: TerminBezug = {
    ...kennungenVon(o as Partial<TerminBezug>),
    ...(gaeste.length ? { gastKontakte: gaeste } : {}),
    ...(typeof o.von === 'string' && PERSON.test(o.von) ? { von: o.von } : {}),
    ...(istIcsArt(o.art) ? { art: o.art } : {}),
    ...(o.privat === true ? { privat: true as const } : {}),
    ...(farbeSauber(o.farbe) ? { farbe: farbeSauber(o.farbe)! } : {}),
    ...(typeof o.tag === 'string' && TAG.test(o.tag) ? { tag: o.tag } : {}),
    ...(typeof o.spiegel === 'string' && SPIEGEL_MARKE.test(o.spiegel) ? { spiegel: o.spiegel } : {}),
    geaendert: typeof o.geaendert === 'string' && Number.isFinite(Date.parse(o.geaendert)) ? o.geaendert : jetzt,
  };
  const inhalt = Object.keys(raus).filter(k => k !== 'geaendert' && k !== 'tag');
  return inhalt.length ? raus : null;
}

/**
 * Teil-Änderung eines Eintrags (rein): nur mitgekommene Felder, `null`/'' entfernt ein Feld. Liefert null, wenn danach
 * nichts mehr drinsteht (Eintrag fällt weg).
 */
export function bezugAendern(alt: TerminBezug | undefined, teil: Record<string, unknown>, jetzt: string): TerminBezug | null {
  const neu: Record<string, unknown> = { ...(alt ?? {}) };
  for (const [k, v] of Object.entries(teil)) {
    if (![...BEZUG_FELDER, 'gastKontakte', 'von', 'art', 'privat', 'farbe', 'tag', 'spiegel'].includes(k)) continue;
    if (v === null || v === '' || v === false || v === undefined || (Array.isArray(v) && !v.length)) delete neu[k]; else neu[k] = v;
  }
  neu.geaendert = jetzt;
  return bezugSauber(neu, jetzt);
}

/** Ein Termin mit seinem Eintrag (Sicherung angewandt, Kennungen, Gast-Kontakte und `von` dazu). */
export type TerminMitBezug = Termin & { bezug?: BezugKennungen; gastKontakte?: string[]; von?: string; maskiert?: true };

/** Bezug + Sicherung auf einen Termin anwenden (Vorrang siehe Kopf). Serien: erst das Vorkommen, dann die Serie. */
export function mitBezug(t: Termin, bestand: BezugBestand | null | undefined): TerminMitBezug {
  // `id` = kalender|uid bzw. kalender|uid::RECURRENCE-ID (lib/kalender/ics.ts termineAus) — alte Schlüssel gelten weiter.
  const b = bezugVon(bestand, t);
  if (!b) return t;
  const kennungen = kennungenVon(b);
  const gaeste = gastKontakteSauber(b.gastKontakte);
  // Art verloren (Apple hat X-MAKE-ART beim Bearbeiten weggelassen) → Sicherung. Der iCloud-Text sagt „termin“ nur ohne X-MAKE-ART.
  const art = t.art === 'termin' && b.art && b.art !== 'termin' ? b.art : t.art;
  return {
    ...t,
    art,
    ...(b.privat && t.sichtbarkeit !== 'privat' ? { sichtbarkeit: 'privat' as const } : {}),
    // Farbe verloren (Apple hat COLOR weggelassen) → Sicherung; der iCloud-Text gewinnt, wenn er eine Farbe trägt.
    ...(!t.farbeId && b.farbe ? { farbeId: b.farbe, ...(farbeHex(b.farbe) ? { farbeEigen: farbeHex(b.farbe) } : {}) } : {}),
    ...(Object.keys(kennungen).length ? { bezug: kennungen } : {}),
    ...(gaeste.length ? { gastKontakte: gaeste } : {}),
    ...(b.von ? { von: b.von } : {}),
  };
}

/** Wem gehört der Termin für „privat“? Wer ihn angelegt hat, sonst der Inhaber des Kalenders (nicht beim gemeinsamen). */
export function eigentuemer(t: { von?: string; wer?: string }): string | undefined {
  if (t.von) return t.von;
  return t.wer && t.wer !== 'beide' ? t.wer : undefined;
}

/**
 * Privat in geteilten Sichten (Kevin 29.09.): die andere Person sieht nur „Belegt“ — Zeit ja, sonst nichts (kein Titel,
 * Ort, Notiz, Bezug, keine Erinnerungen), nie änderbar. Ohne bekannten Eigentümer bleibt der Termin sichtbar.
 */
export function maskieren<T extends TerminMitBezug & { wer?: string }>(t: T, betrachter: string | null | undefined): T {
  if (t.sichtbarkeit !== 'privat') return t;
  const e = eigentuemer(t);
  if (!e || e === betrachter) return t;
  const { ort: _o, notiz: _n, bezug: _b, gastKontakte: _g, teilnehmer: _t, organisator: _og, erinnerungen: _e, farbeEigen: _f, farbeId: _fi, arbeitsort: _a, stand: _s, link: _l, ...rest } = t as T & { link?: string };
  // R-K1 #96: nach außen keine echte UID (mit ihr ließe sich der Termin per API ansprechen) — eine Kennung, die nur für
  // die Anzeige eindeutig ist; die Route lehnt Ändern/Löschen fremd-privater Termine ohnehin mit 403 ab.
  const verdeckt = verdeckteKennung(t.id);
  return { ...rest, id: verdeckt, uid: verdeckt, href: '', titel: 'Belegt', bearbeitbar: false, maskiert: true } as T;
}

/** Anzeige-Kennung eines maskierten Termins („belegt-…“) — nie die echte UID (R-K1 #96). */
export const verdeckteKennung = (id: string): string => `belegt-${fnv(id)}`;

/** Wäre der Termin für diese Person maskiert (privat einer anderen Person)? — Rechte-Prüfung für Ändern/Löschen (R-K1 #96). */
export const fremdPrivat = (t: TerminMitBezug & { wer?: string }, person: string | null | undefined): boolean => !!t.maskiert || !!maskieren(t, person).maskiert;

/** Ein Objekt aus dem iCloud-Stand im Kurzbild: UID, Schlüssel (Kalender + UID), Starttag, Zusätze aus dem Text. */
export interface ObjektKurz { uid: string; schluessel?: string; tag?: string; zusatz: IcsZusatz | null }

/** UIDs, die in mehr als einem Kalender stehen — alte Verweise ohne Kalender sind für sie mehrdeutig. */
export function mehrdeutigeUids(objekte: readonly Pick<ObjektKurz, 'uid' | 'schluessel'>[]): Set<string> {
  const je = new Map<string, Set<string>>();
  for (const o of objekte) { const s = je.get(o.uid) ?? new Set<string>(); s.add(o.schluessel ?? o.uid); je.set(o.uid, s); }
  return new Set(Array.from(je).filter(([, s]) => s.size > 1).map(([u]) => u));
}

/**
 * Abgleich nach einem iCloud-Lauf (rein): für Termine mit X-MAKE-ART ohne Eintrag die Sicherung anlegen (Art, privat,
 * Farbe, Starttag); bei vorhandenem Eintrag Starttag und Farbe nachziehen. Liefert nur die zu schreibenden Einträge
 * (unter dem neuen Schlüssel, falls das Objekt einen hat). Alte Einträge ohne Kalender zählen, solange die UID eindeutig ist.
 */
export function bezugAbgleichPlan(objekte: readonly ObjektKurz[], bestand: BezugBestand | null | undefined, jetzt: string): Record<string, TerminBezug> {
  const raus: Record<string, TerminBezug> = {};
  const doppelt = mehrdeutigeUids(objekte);
  for (const o of objekte) {
    const key = o.schluessel ?? o.uid;
    const altKey = bestand?.bezuege[key] ? key : !doppelt.has(o.uid) && bestand?.bezuege[o.uid] ? o.uid : undefined;
    const alt = altKey ? bestand!.bezuege[altKey] : undefined;
    if (!alt && o.zusatz?.art) {
      const neu = bezugSauber({ art: o.zusatz.art, ...(o.zusatz.sichtbarkeit === 'privat' ? { privat: true } : {}), ...(o.zusatz.farbe ? { farbe: o.zusatz.farbe } : {}), ...(o.tag ? { tag: o.tag } : {}), geaendert: jetzt }, jetzt);
      if (neu) raus[key] = neu;
    } else if (alt) {
      const tag = o.tag && alt.tag !== o.tag ? o.tag : undefined;
      const farbe = o.zusatz?.farbe && alt.farbe !== o.zusatz.farbe ? o.zusatz.farbe : undefined;
      if (tag || farbe) raus[altKey!] = { ...alt, ...(tag ? { tag } : {}), ...(farbe ? { farbe } : {}) };
    }
  }
  return raus;
}

/**
 * Umzug alter Schlüssel (rein, R-K1 #46): ein Eintrag `uid` bzw. `uid::RID` ohne Kalender zieht auf `kalender|uid(::RID)`,
 * wenn die UID im Stand genau EINMAL vorkommt und unter dem neuen Schlüssel noch nichts steht. Mehrdeutige bleiben (sie
 * gelten beim Lesen für jede Kopie — die sichere Seite, „privat“ geht nie verloren). Liefert [alt, neu]-Paare.
 */
export function bezugUmzugPlan(objekte: readonly ObjektKurz[], bestand: BezugBestand | null | undefined): [string, string][] {
  const b = bestand?.bezuege;
  if (!b) return [];
  const doppelt = mehrdeutigeUids(objekte);
  const kalVon = new Map<string, string>();
  for (const o of objekte) if (o.schluessel && !doppelt.has(o.uid)) { const k = schluesselTeile(o.schluessel).kal; if (k) kalVon.set(o.uid, k); }
  const raus: [string, string][] = [];
  for (const alt of Object.keys(b)) {
    const t = schluesselTeile(alt);
    if (t.kal) continue;
    const kal = kalVon.get(t.uid);
    if (!kal) continue;
    const neu = terminSchluessel(kal, t.uid, t.rid);
    if (!b[neu]) raus.push([alt, neu]);
  }
  return raus;
}

/** Einträge, deren Art-Sicherung im iCloud-Text fehlt (Apple hat X-MAKE-ART verloren) — für die Verbindungsprüfung. */
export function artVerloren(objekte: readonly Pick<ObjektKurz, 'uid' | 'schluessel' | 'zusatz'>[], bestand: BezugBestand | null | undefined): string[] {
  const raus: string[] = [];
  for (const o of objekte) {
    const b = (o.schluessel ? bestand?.bezuege[o.schluessel] : undefined) ?? bestand?.bezuege[o.uid];
    if (b?.art && b.art !== 'termin' && !o.zusatz?.art) raus.push(o.schluessel ?? o.uid);
  }
  return raus;
}

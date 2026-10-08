// ─── Agenten-Seite: reine Regeln der Oberfläche (09.10., Paket 2 „Oberfläche“; AGENTEN_KONZEPT.md C2 + C11) ─────────────
// Alles, was die Seite rechnet, ohne zu laden oder zu zeichnen: Auswahl aus der Adresse, Ansprechen per @, Eisenhower-
// Reihenfolge, Gruppen der Hintergrundaufgaben, Risiko-Ampel der Freigaben, Zeit- und Geldtexte, Prüfung eines Skill-Entwurfs,
// Leistung je Head. Rein und client-sicher (nur Typ-Importe aus Server-Modulen) — getestet in tests/agenten-oberflaeche.test.ts.
// Nichts Persönliches (Plattform-Regel): keine Namen, keine Firmen, kein fester Speichername.

import type {
  AgentRef, Eisenhower, FadenKurz, HeadKarte, KiKategorie, Lauf, LaufStatus, Naechstes, Rhythmus, SkillAusloeser,
  SkillEingabeFeld, SkillEreignis, SkillErfolg, SkillKurz, SkillTest, SkillBeispiel, ModelTier, UeberblickZeile,
} from '@/lib/agenten/typen';
import { EISENHOWER_REIHE, GRENZEN, type HeadDef } from '@/lib/agenten/typen';

/** Zeitzone aller Anzeigen — wie überall in der App (Berliner Wandzeit). */
const ZONE = 'Europe/Berlin';

// ── Auswahl aus der Adresse (`WEG.agenten({ h, f })`) ──────────────────────────────────────────────────────────────────

/** Was die Mitte zeigt: ZOE (ohne Auswahl), einen Head (mit oder ohne Thread) oder einen Mitarbeiter-Thread. */
export type Auswahl =
  | { art: 'zoe' }
  | { art: 'head'; headId: string; fadenId?: string }
  | { art: 'faden'; fadenId: string; headId?: string };

/**
 * Liest die Auswahl aus `h` (Head) und `f` (Thread). Ein Thread eines Heads öffnet den Head mit diesem Thread im Reiter Chat;
 * ein Mitarbeiter-Thread öffnet die Thread-Ansicht mit Brotkrumen. Kennt die Seite den Thread noch nicht, entscheidet `h`.
 */
export function auswahlAus(h: string | null | undefined, f: string | null | undefined, faeden: readonly FadenKurz[] = []): Auswahl {
  const head = h && /^[a-z0-9-]{1,64}$/.test(h) ? h : null;
  const faden = f && /^[A-Za-z0-9-]{1,80}$/.test(f) ? f : null;
  if (faden) {
    const k = faeden.find(x => x.id === faden);
    if (k?.agent.art === 'head') return { art: 'head', headId: k.agent.headId, fadenId: faden };
    if (k?.agent.art === 'zoe') return { art: 'zoe' };
    if (!k && head) return { art: 'head', headId: head, fadenId: faden };
    return { art: 'faden', fadenId: faden, ...(k?.agent.art === 'mitarbeiter' ? { headId: k.agent.headId } : head ? { headId: head } : {}) };
  }
  if (head) return { art: 'head', headId: head };
  return { art: 'zoe' };
}

// ── Kürzel, Farben, Ansprechen ──────────────────────────────────────────────────────────────────────────────────────────

const FUELLWOERTER = new Set(['of', 'und', '&', 'der', 'die', 'das', '·', '-']);

/** Kürzel für die Kugel: zwei Anfangsbuchstaben („Nachfassen & Power Hour“ → „NP“), ein Wort → „Sa“. */
export function kuerzel(name: string): string {
  const woerter = name.replace(/[()]/g, ' ').split(/\s+/).filter(w => w && !FUELLWOERTER.has(w.toLowerCase()));
  if (!woerter.length) return '?';
  if (woerter.length === 1) {
    const w = woerter[0];
    return (w[0].toUpperCase() + (w[1] ?? '').toLowerCase());
  }
  return (woerter[0][0] + woerter[woerter.length - 1][0]).toUpperCase();
}

export interface Ansprechbar { id: string; name: string; art: 'head' | 'mitarbeiter'; headId: string }

/**
 * Ansprechen per @ am Anfang der Nachricht („@Marketing plan die Herbst-Kampagne“). Der längste passende Name gewinnt
 * (Mitarbeiter-Namen dürfen Leerzeichen tragen). Groß/klein egal; nach dem Namen muss ein Leerzeichen, Satzzeichen oder das Ende stehen.
 */
export function ansprache(text: string, kandidaten: readonly Ansprechbar[]): { ziel: Ansprechbar; rest: string } | null {
  const t = text.trimStart();
  if (!t.startsWith('@')) return null;
  const klein = t.slice(1).toLowerCase();
  const passend = [...kandidaten]
    .sort((a, b) => b.name.length - a.name.length)
    .find(k => {
      const n = k.name.toLowerCase();
      if (!klein.startsWith(n)) return false;
      const danach = klein.charAt(n.length);
      return danach === '' || /[\s,.:;!?]/.test(danach);
    });
  if (!passend) return null;
  const rest = t.slice(1 + passend.name.length).replace(/^[\s,.:;!?]+/, '').trim();
  return { ziel: passend, rest };
}

/** Wen man in einem Feld ansprechen kann: im ZOE-Feld die Heads (Kurzname), im Head-Feld seine Mitarbeiter. */
export function ansprechbarFuer(ort: 'zoe' | 'head', heads: readonly HeadKarte[], headId?: string): Ansprechbar[] {
  if (ort === 'zoe') return heads.filter(h => h.aktiv && !h.gesperrt).map(h => ({ id: h.id, name: h.kurz, art: 'head' as const, headId: h.id }));
  const h = heads.find(x => x.id === headId);
  return (h?.mitarbeiter ?? []).filter(m => m.aktiv).map(m => ({ id: m.id, name: m.name, art: 'mitarbeiter' as const, headId: h!.id }));
}

/** Der Agent hinter einer Ansprache bzw. einer Auswahl. */
export const agentVon = (a: Ansprechbar): AgentRef =>
  a.art === 'head' ? { art: 'head', headId: a.id } : { art: 'mitarbeiter', headId: a.headId, mitarbeiterId: a.id };

// ── Sieht / sieht nicht (Muster 20 der Recherche: aus den KI-Kategorien des Heads) ─────────────────────────────────────

export const KATEGORIE_NAME: Readonly<Record<KiKategorie, string>> = {
  crm: 'CRM', kalender: 'Kalender', aufgaben: 'Aufgaben', finanzen: 'Finanzen', brain: 'Brain', gesundheit: 'Gesundheit',
  postfach: 'Postfach', web: 'Web', konto: 'Konto', allgemein: 'Allgemeines', familie: 'Familie', 'finanzen-privat': 'Private Finanzen',
};
/** Was ein Head sieht und — als Vergleich — die großen Bereiche, die er NICHT sieht. */
export function sichtVon(h: Pick<HeadDef, 'kategorien' | 'kategorienMitEinwilligung'>): { sieht: string[]; mitEinwilligung: string[]; siehtNicht: string[] } {
  const gross: KiKategorie[] = ['crm', 'kalender', 'aufgaben', 'finanzen', 'finanzen-privat', 'familie', 'gesundheit', 'postfach', 'web'];
  const hat = new Set<KiKategorie>([...h.kategorien, ...(h.kategorienMitEinwilligung ?? [])]);
  return {
    sieht: h.kategorien.map(k => KATEGORIE_NAME[k]),
    mitEinwilligung: (h.kategorienMitEinwilligung ?? []).map(k => KATEGORIE_NAME[k]),
    siehtNicht: gross.filter(k => !hat.has(k)).map(k => KATEGORIE_NAME[k]),
  };
}

// ── Zeit und Geld ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Berliner Tag („YYYY-MM-DD“) eines Zeitpunkts. */
export function berlinTag(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function berlinUhr(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
/** Wochentag (0 = So) eines Berliner Tages „YYYY-MM-DD“. */
const wochentagVon = (tag: string) => new Date(`${tag}T12:00:00Z`).getUTCDay();
const tagPlus = (tag: string, n: number) => new Date(Date.parse(`${tag}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const tagKurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

/**
 * Zeitpunkt kurz und ruhig: heute „08:41“, gestern „gestern 18:00“, in derselben Woche „Mo 07:00“, sonst „09.10.“.
 * Ein reiner Tag („YYYY-MM-DD“) zeigt „heute“, „morgen“, „Fr 10.10.“.
 */
export function zeitKurz(wert: string, jetzt: Date = new Date()): string {
  const heute = berlinTag(jetzt);
  if (/^\d{4}-\d{2}-\d{2}$/.test(wert)) {
    if (wert === heute) return 'heute';
    if (wert === tagPlus(heute, 1)) return 'morgen';
    if (wert === tagPlus(heute, -1)) return 'gestern';
    return `${WOCHENTAG[wochentagVon(wert)]} ${tagKurz(wert)}`;
  }
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return '';
  const tag = berlinTag(d);
  const uhr = berlinUhr(d);
  if (tag === heute) return uhr;
  if (tag === tagPlus(heute, -1)) return `gestern ${uhr}`;
  if (tag === tagPlus(heute, 1)) return `morgen ${uhr}`;
  const abstand = Math.abs(Date.parse(`${tag}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86_400_000;
  if (abstand < 7) return `${WOCHENTAG[wochentagVon(tag)]} ${uhr}`;
  return tagKurz(tag);
}

/** Dauer: „42 s“, „1 Min. 42 s“, „7 Min.“, ab einer Stunde „1 h 05“ — nie wie eine Uhrzeit. */
export function dauerText(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} Min.${s % 60 ? ` ${s % 60} s` : ''}`;
  const m = Math.floor(s / 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Cent in Euro („0,04 €“, „12,50 €“) — immer Euro, nie Credits (Recherche: „bewusst nicht übernehmen“). */
export function euro(cent: number | undefined | null): string {
  if (cent == null || !Number.isFinite(cent)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cent / 100);
}

/** Prozent als Text, ohne Nenner „—“ (nie eine erfundene Null). */
export function quote(zaehler: number, nenner: number): string {
  if (!nenner) return '—';
  return `${Math.round((zaehler / nenner) * 100)} %`;
}

// ── Hintergrund: Läuft · Fertig · Fehler · Als Nächstes ────────────────────────────────────────────────────────────────

export interface LaufGruppen { laeuft: Lauf[]; fertig: Lauf[]; fehler: Lauf[] }
const LAEUFT: readonly LaufStatus[] = ['laeuft', 'wartet'];
/** Läufe in drei Gruppen (Antwort 8 / Fragerunde 4): laufende zuerst (ältester Start oben), Fertig und Fehler jüngste zuerst. */
export function laufGruppen(laeufe: readonly Lauf[]): LaufGruppen {
  const nachStart = (a: Lauf, b: Lauf) => Date.parse(b.start) - Date.parse(a.start);
  return {
    laeuft: laeufe.filter(l => LAEUFT.includes(l.status)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    fertig: laeufe.filter(l => l.status === 'fertig').sort(nachStart),
    fehler: laeufe.filter(l => l.status === 'fehler' || l.status === 'abgebrochen').sort(nachStart),
  };
}

/** Anteil der fertigen Schritte (0–1) — ohne Schritte null. */
export const schrittAnteil = (l: Pick<Lauf, 'schritte'>): number | null =>
  l.schritte && l.schritte.gesamt > 0 ? Math.min(1, l.schritte.fertig / l.schritte.gesamt) : null;

const zeitwert = (w: string) => { const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(w) ? `${w}T23:59:00Z` : w); return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t; };
/** „Als Nächstes“ nach Eisenhower: wichtig+dringend → wichtig → dringend → Rest; innerhalb nach Zeit. */
export function nachEisenhower(liste: readonly Naechstes[]): Naechstes[] {
  const rang = (q: Eisenhower) => EISENHOWER_REIHE.indexOf(q);
  return [...liste].sort((a, b) => rang(a.quadrant) - rang(b.quadrant) || zeitwert(a.wann) - zeitwert(b.wann));
}
export const QUADRANT_NAME: Readonly<Record<Eisenhower, string>> = {
  q1: 'Wichtig & dringend', q2: 'Wichtig', q3: 'Dringend', q4: 'Später',
};

/** Geld des laufenden Berliner Monats aus den Läufen (Budget-Balken; Fragerunde 16: „erster Monat nur messen“). */
export function kostenImMonat(laeufe: readonly Lauf[], jetzt: Date = new Date()): number {
  const monat = berlinTag(jetzt).slice(0, 7);
  return laeufe.reduce((s, l) => (berlinTag(new Date(l.start)).slice(0, 7) === monat ? s + (l.kosten?.cent ?? 0) : s), 0);
}

// ── Freigaben: Risiko-Ampel (Handy: Daumen-Wischen nur für risikoarme) ─────────────────────────────────────────────────

/** Was die Seite von einem Vorschlag im Stapel braucht (GET /api/zoe/stapel). */
export interface VorschlagKurz {
  id: string; titel: string; nachher?: string; werkzeug: string; gruppe?: string; zeit?: string; anlass?: string;
  bezug?: { art: string; id: string }; status?: string;
}
export type Risiko = 'risikoarm' | 'intern' | 'aussen';
export const RISIKO_NAME: Readonly<Record<Risiko, string>> = { risikoarm: 'Risikoarm', intern: 'Ändert Daten', aussen: 'Nach außen' };
const NACH_AUSSEN = /send|mail|versand|nachricht|einlad|whatsapp|telegram|stell|post|veroeffentl|ansprache|danke|newsletter/i;
/**
 * Risiko-Ampel einer Freigabe — VORSICHTIG gerechnet: risikoarm ist nur, was der Server auch in die Sammelfreigabe nimmt
 * (ZOE-Aufgaben-Vorschläge mit Bezug Aufgabe: nur Notiz und Unteraufgaben). Alles, was nach Versand aussieht, gilt als
 * „nach außen“ (öffnet immer die Karte). Die Entscheidung trifft der Server; die Ampel ist nur Anzeige.
 */
export function risikoVon(v: VorschlagKurz): Risiko {
  if (NACH_AUSSEN.test(v.werkzeug) || NACH_AUSSEN.test(v.gruppe ?? '')) return 'aussen';
  if (v.bezug?.art === 'aufgabe') return 'risikoarm';
  return 'intern';
}

// ── Delegation: Auftrag mit Ziel, Format, Grenzen, Quellen (C3) ─────────────────────────────────────────────────────────

export interface Delegation { ziel?: string; format?: string; grenzen?: string; quellen?: string }
const TEILE: readonly (keyof Delegation)[] = ['ziel', 'format', 'grenzen', 'quellen'];
/** Liest „Ziel: … Format: … Grenzen: … Quellen: …“ aus dem Auftrag. Ohne eins der vier Felder: null. */
export function delegationTeile(text: string): Delegation | null {
  const muster = /(Ziel|Format|Grenzen|Quellen)\s*:/gi;
  const treffer = [...text.matchAll(muster)];
  if (!treffer.length) return null;
  const d: Delegation = {};
  treffer.forEach((m, i) => {
    const schluessel = m[1].toLowerCase() as keyof Delegation;
    const start = (m.index ?? 0) + m[0].length;
    const ende = i + 1 < treffer.length ? treffer[i + 1].index ?? text.length : text.length;
    const wert = text.slice(start, ende).trim().replace(/[.;·]\s*$/, '').trim();
    if (wert && TEILE.includes(schluessel)) d[schluessel] = wert;
  });
  return Object.keys(d).length ? d : null;
}

// ── Skills: Auslöser in Klartext, nächster Lauf, Prüfung ────────────────────────────────────────────────────────────────

export const RHYTHMUS_NAME: Readonly<Record<Rhythmus, string>> = { taeglich: 'täglich', werktags: 'werktags', woechentlich: 'wöchentlich', monatlich: 'monatlich' };
export const EREIGNIS_NAME: Readonly<Record<SkillEreignis, string>> = {
  'neue-mail': 'neue Mail', 'neuer-lead': 'neuer Lead', zahlungseingang: 'Zahlungseingang', 'neue-aufgabe': 'neue Aufgabe',
  'termin-vorbei': 'Termin vorbei', 'frist-naht': 'Frist naht', 'neues-medium': 'neues Bild oder Video',
};
const TAG_LANG = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Der Auslöser in einem Satz („werktags 08:00“, „wöchentlich Fr 15:00“, „bei neuer Mail · nur Kunden“). */
export function ausloeserText(a: SkillAusloeser): string {
  if (a.art === 'hand') return 'von Hand';
  if (a.art === 'ereignis') return `bei: ${EREIGNIS_NAME[a.ereignis]}${a.filter ? ` · ${a.filter}` : ''}`;
  if (a.rhythmus === 'woechentlich' && a.tage?.length) return `wöchentlich ${a.tage.map(t => TAG_LANG[t] ?? '').filter(Boolean).join(', ')} ${a.uhrzeit}`;
  if (a.rhythmus === 'monatlich' && a.tage?.length) return `monatlich am ${a.tage.join('., ')}. ${a.uhrzeit}`;
  return `${RHYTHMUS_NAME[a.rhythmus]} ${a.uhrzeit}`;
}

/** Trifft der Zeitplan diesen Berliner Tag? (1 = Mo … 7 = So; monatlich = Monatstag.) */
function zeitplanTrifft(a: Extract<SkillAusloeser, { art: 'zeitplan' }>, tag: string): boolean {
  const wt = wochentagVon(tag) || 7;
  if (a.rhythmus === 'taeglich') return true;
  if (a.rhythmus === 'werktags') return wt <= 5;
  if (a.rhythmus === 'woechentlich') return (a.tage?.length ? a.tage : [1]).includes(wt);
  const tagImMonat = Number(tag.slice(8, 10));
  return (a.tage?.length ? a.tage : [1]).includes(tagImMonat);
}
/**
 * Bestätigung in Klartext vor dem Speichern (Muster 10 der Recherche): „nächster Lauf Fr 10.10. 08:00“. Nur Zeitpläne;
 * gerechnet in Berliner Wandzeit über höchstens 62 Tage — die eine Planung bleibt der Takt (Paket 3), das hier ist nur Vorschau.
 */
export function naechsterLaufText(a: SkillAusloeser, jetzt: Date = new Date()): string | null {
  if (a.art !== 'zeitplan' || !/^\d{2}:\d{2}$/.test(a.uhrzeit)) return null;
  const heute = berlinTag(jetzt);
  const uhr = berlinUhr(jetzt);
  for (let n = 0; n <= 62; n++) {
    const tag = tagPlus(heute, n);
    if (n === 0 && a.uhrzeit <= uhr) continue;
    if (zeitplanTrifft(a, tag)) return `nächster Lauf ${WOCHENTAG[wochentagVon(tag)]} ${tagKurz(tag)} ${a.uhrzeit}`;
  }
  return null;
}

/** Was der Skill-Editor bearbeitet (die Felder, die die Person setzt — Kennung, Version, Erfolg setzt der Server). */
export interface SkillEntwurf {
  headId: string;
  mitarbeiterId?: string;
  name: string;
  beschreibung: string;
  anleitung: string;
  beispiele: SkillBeispiel[];
  werkzeuge: string[];
  ausloeser: SkillAusloeser;
  eingabeFelder: SkillEingabeFeld[];
  freigabePflicht: boolean;
  ergebnis: 'faden' | 'stapel';
  stufe: ModelTier;
  kostenGrenzeCent?: number;
  tests: SkillTest[];
  quelle: 'hand' | 'gespraech' | 'import' | 'vorschlag';
}

export function leererSkill(headId: string, vorlage?: Partial<SkillEntwurf>): SkillEntwurf {
  return {
    headId, name: '', beschreibung: '', anleitung: '', beispiele: [], werkzeuge: [], ausloeser: { art: 'hand' }, eingabeFelder: [],
    freigabePflicht: true, ergebnis: 'stapel', stufe: 'ausgewogen', tests: [], quelle: 'hand', ...vorlage,
  };
}

/** Name eines Skills aus einem Satz („Angebot nachfassen!“ → „angebot-nachfassen“) — Vorschlag, nie still gekürzt gespeichert. */
export function skillName(text: string): string {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Prüft einen Skill-Entwurf wie der Server (Grenzen aus lib/agenten/typen.ts) — die Seite zeigt die Sätze, bevor sie sendet.
 * Nie kürzen: was zu lang ist, steht als Fehler da.
 */
export function skillPruefen(e: SkillEntwurf, headWerkzeuge: readonly string[], grenzen: typeof GRENZEN = GRENZEN): string[] {
  const f: string[] = [];
  if (!e.name.trim()) f.push('Der Skill braucht einen Namen.');
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.name)) f.push('Der Name besteht nur aus Kleinbuchstaben, Ziffern und Bindestrichen (z. B. „angebot-nachfassen“).');
  if (e.name.length > grenzen.skillName) f.push(`Der Name ist länger als ${grenzen.skillName} Zeichen.`);
  if (!e.beschreibung.trim()) f.push('Die Beschreibung fehlt — sie sagt, was der Skill tut und wann er gebraucht wird.');
  if (e.beschreibung.length > grenzen.skillBeschreibung) f.push(`Die Beschreibung ist länger als ${grenzen.skillBeschreibung} Zeichen.`);
  if (!e.anleitung.trim()) f.push('Die Anleitung fehlt.');
  if (e.anleitung.length > grenzen.skillAnleitung) f.push(`Die Anleitung ist länger als ${grenzen.skillAnleitung.toLocaleString('de-DE')} Zeichen.`);
  const fremd = e.werkzeuge.filter(w => !headWerkzeuge.includes(w));
  if (fremd.length) f.push(`Diese Werkzeuge hat der Head nicht: ${fremd.join(', ')}.`);
  if (e.ausloeser.art === 'zeitplan' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.ausloeser.uhrzeit)) f.push('Die Uhrzeit des Zeitplans hat die Form „HH:MM“.');
  if (e.eingabeFelder.length > grenzen.skillEingabeFelder) f.push(`Höchstens ${grenzen.skillEingabeFelder} Eingabe-Felder.`);
  if (e.eingabeFelder.some(x => !x.label.trim())) f.push('Jedes Eingabe-Feld braucht eine Beschriftung.');
  if (e.tests.length > grenzen.skillTestsMax) f.push(`Höchstens ${grenzen.skillTestsMax} Tests.`);
  if (e.tests.some(t => !t.eingabe.trim() || !t.erwartet.some(x => x.trim()))) f.push('Jeder Test braucht eine Eingabe und mindestens ein erwartetes Ergebnis.');
  if (e.kostenGrenzeCent != null && (!Number.isFinite(e.kostenGrenzeCent) || e.kostenGrenzeCent < 0)) f.push('Die Kostengrenze ist kein gültiger Betrag.');
  return f;
}

/** Aktivieren erst mit genug Tests und bestandenem Testlauf (Teil B: „Tests zuerst“). */
export function aktivierenFehlt(tests: number, testlaufOk: boolean | undefined, grenzen: typeof GRENZEN = GRENZEN): string | null {
  if (tests < grenzen.skillTestsMin) return `Zum Einschalten braucht der Skill mindestens ${grenzen.skillTestsMin} Tests (jetzt ${tests}).`;
  if (!testlaufOk) return 'Zum Einschalten muss ein Testlauf bestanden sein — er läuft ohne Wirkung.';
  return null;
}

// ── Leistung je Head (Fragerunde 17: Annahmequote, Erfolgsquote je Skill, Kosten je Ergebnis) ──────────────────────────

export interface Leistung {
  annahme: { angenommen: number; abgelehnt: number; text: string };
  jeSkill: { id: string; name: string; text: string; laeufe: number }[];
  kostenJeErgebnis: string;
  laeufe: number;
}
/** Leistung eines Heads — nur aus gemessenen Zählern (Skills, Läufe), nie geschätzt. Bewertet Agenten, nie Menschen (KI-VO). */
export function leistungVon(headId: string, skills: readonly SkillKurz[], laeufe: readonly Lauf[]): Leistung {
  const eigene = skills.filter(s => s.headId === headId && s.erfolg);
  const summe = eigene.reduce<SkillErfolg>((s, k) => ({
    laeufe: s.laeufe + (k.erfolg?.laeufe ?? 0), angenommen: s.angenommen + (k.erfolg?.angenommen ?? 0),
    abgelehnt: s.abgelehnt + (k.erfolg?.abgelehnt ?? 0), fehler: s.fehler + (k.erfolg?.fehler ?? 0),
  }), { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 });
  const vomHead = laeufe.filter(l => l.headId === headId);
  const fertig = vomHead.filter(l => l.status === 'fertig');
  const kosten = vomHead.reduce((s, l) => s + (l.kosten?.cent ?? 0), 0);
  return {
    annahme: { angenommen: summe.angenommen, abgelehnt: summe.abgelehnt, text: quote(summe.angenommen, summe.angenommen + summe.abgelehnt) },
    jeSkill: eigene.map(s => ({ id: s.id, name: s.name, laeufe: s.erfolg?.laeufe ?? 0, text: quote(s.erfolg?.angenommen ?? 0, (s.erfolg?.angenommen ?? 0) + (s.erfolg?.abgelehnt ?? 0)) })),
    kostenJeErgebnis: fertig.length ? euro(Math.round(kosten / fertig.length)) : '—',
    laeufe: vomHead.length,
  };
}

// ── Absender einer Nachricht ────────────────────────────────────────────────────────────────────────────────────────────

/** Der Agent hinter `Nachricht.von` (`zoe` · `head:<id>` · `mitarbeiter:<head>:<id>`) — sonst null (Person, System). */
export function agentAusSchluessel(von: string): AgentRef | null {
  if (von === 'zoe') return { art: 'zoe' };
  const h = /^head:([a-z0-9-]{1,64})$/.exec(von);
  if (h) return { art: 'head', headId: h[1] };
  const m = /^mitarbeiter:([a-z0-9-]{1,64}):([A-Za-z0-9-]{1,80})$/.exec(von);
  if (m) return { art: 'mitarbeiter', headId: m[1], mitarbeiterId: m[2] };
  return null;
}

/** Name und Farb-Token eines Absenders: Head-Kurzname, Mitarbeiter-Name, „ZOE“; sonst null (Person, System). */
export function absenderVon(von: string, heads: readonly HeadKarte[]): { name: string; headId?: string; farbe?: HeadKarte['farbe']; bereich?: HeadKarte['bereich']; art: AgentRef['art'] } | null {
  const a = agentAusSchluessel(von);
  if (!a) return null;
  if (a.art === 'zoe') return { name: 'ZOE', art: 'zoe' };
  const h = heads.find(x => x.id === a.headId);
  if (a.art === 'head') return { name: h?.kurz ?? a.headId, headId: a.headId, farbe: h?.farbe, bereich: h?.bereich, art: 'head' };
  const m = h?.mitarbeiter.find(x => x.id === a.mitarbeiterId);
  return { name: m?.name ?? a.mitarbeiterId, headId: a.headId, farbe: h?.farbe, bereich: h?.bereich, art: 'mitarbeiter' };
}

/**
 * Das bisherige ZOE-Gespräch der Seite als Text für `context` (bis Paket 4 die Threads bringt): die letzten Züge, höchstens
 * `max` Zeichen, das Jüngste zählt. Leer ohne Vorgeschichte.
 */
export function gespraechAlsKontext(zuege: readonly { wer: 'ich' | 'zoe'; text: string }[], max = 3_500): string {
  const zeilen = zuege.map(z => `${z.wer === 'ich' ? 'Ich' : 'ZOE'}: ${z.text.replace(/\s+/g, ' ').trim()}`);
  let raus = '';
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const neu = raus ? `${zeilen[i]}\n${raus}` : zeilen[i];
    if (neu.length > max) break;
    raus = neu;
  }
  return raus ? `Bisheriges Gespräch auf der Agenten-Seite:\n${raus}` : '';
}

/** Eine Zeile des Überblicks mit der Farbe ihres Heads (Anzeige). */
export type UeberblickZeileMitHead = UeberblickZeile & { farbe?: string };

// ── Vorschläge für heute (Zeile unter dem Überblick; Fragerunde 3) ─────────────────────────────────────────────────────

export interface VorschlagHeute { id: string; text: string; frage: string }
/**
 * Arbeit für heute als anklickbare Sätze an ZOE — nur aus dem, was wirklich ansteht (Freigaben, wichtige Fristen, wartende
 * Threads). Ohne Anlass bleibt die Frage nach dem Tag. Höchstens vier.
 */
export function vorschlaegeHeute(o: { freigaben: number; naechstes: readonly Naechstes[]; wartend: number; jetzt?: Date }): VorschlagHeute[] {
  const raus: VorschlagHeute[] = [];
  if (o.freigaben > 0) raus.push({ id: 'freigaben', text: `${o.freigaben} Freigabe${o.freigaben === 1 ? '' : 'n'} durchgehen`, frage: 'Geh mit mir die offenen Freigaben durch — was ist wichtig, was kann weg?' });
  if (o.wartend > 0) raus.push({ id: 'wartend', text: `${o.wartend} Thread${o.wartend === 1 ? ' wartet' : 's warten'} auf Antwort`, frage: 'Welche Threads warten auf meine Antwort, und was brauchen sie von mir?' });
  for (const n of nachEisenhower(o.naechstes).filter(n => n.quadrant === 'q1' && n.art !== 'freigabe').slice(0, 2)) {
    raus.push({ id: `n-${n.id}`, text: `${n.titel} vorbereiten`, frage: `Hilf mir, „${n.titel}“ vorzubereiten — was ist zu tun?` });
  }
  raus.push({ id: 'tag', text: 'Was braucht heute meine Aufmerksamkeit?', frage: 'Was braucht heute meine Aufmerksamkeit? Bitte in drei Punkten.' });
  return raus.slice(0, 4);
}

/** Euro-Eingabe („0,50“, „2“, „1.5“) in Cent; leer → undefined, Unsinn → NaN (die Prüfung zeigt dann einen Satz). */
export function centAus(text: string): number | undefined {
  const t = text.trim().replace(/\s|€/g, '');
  if (!t) return undefined;
  const z = Number(t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(z) && z >= 0 ? Math.round(z * 100) : Number.NaN;
}

/** Ein Auftrag aus den vier Teilen (C3: Ziel, Format, Grenzen, Quellen) — leere Teile fallen weg. */
export function auftragText(d: Delegation): string {
  return (['ziel', 'format', 'grenzen', 'quellen'] as const)
    .filter(k => d[k]?.trim())
    .map(k => `${k[0].toUpperCase()}${k.slice(1)}: ${d[k]!.trim().replace(/[.\s]+$/, '')}.`)
    .join(' ');
}

/** Wartende Threads (Status „wartet“ = der Agent braucht eine Antwort der Person). */
export const wartendeFaeden = (faeden: readonly FadenKurz[]): FadenKurz[] => faeden.filter(f => f.status === 'wartet');

/** Status eines Threads in Worten. */
export const FADEN_STATUS_NAME: Readonly<Record<FadenKurz['status'], string>> = {
  offen: 'offen', wartet: 'wartet auf dich', laeuft: 'läuft', fertig: 'fertig', fehler: 'Fehler', abgebrochen: 'abgebrochen',
};

// ─── Agenten-Bereich: Zeitpläne der Skills und Hintergrundaufgaben im Takt (09.10., Paket 3; AGENTEN_KONZEPT.md C3/C7/C11) ──
// Entscheidung 08.10. (Antworten 7–9): Skills mit Zeitplan, Hintergrundaufgaben „einmalig · geplant · wiederkehrend“, „Als Nächstes“ mit
// Uhrzeit — und KEIN zweiter Hintergrund-Mechanismus (C7): fällige Läufe werden Aufträge `LAUF_AGENT` (= 'faden') in der einen
// Warteschlange (`zoe-auftraege`); ausgeführt wird nur über /api/agenten/faden/lauf (Paket 1).
//
// EINE Regel für „wann“ — Takt (`zeitplaeneFaellig`, eine Zeile in lib/zoe/takt.ts) und „Als Nächstes“ (lib/agenten/naechstes.ts)
// rechnen beide mit `slotsAmTag` + `wirksamAb` (Gold-Fälle: tests/agenten-naechstes.test.ts). Regeln:
//   • Rhythmus: täglich · werktags (Mo–Fr ohne Feiertage NRW, wie die Aufgaben-Serien) · wöchentlich (`tage` = ISO-Wochentage 1–7,
//     Vorgabe Montag) · monatlich (`tage` = Monatstage 1–31, über das Monatsende hinaus = letzter Tag, Vorgabe der 1.) · einmalig.
//   • Der Takt arbeitet für Agenten nur zwischen `TAKT_VON` und `TAKT_BIS` Uhr (= VON/BIS in lib/zoe/takt.ts — Wächter): ein Slot
//     davor läuft ab `TAKT_VON`, einer danach an diesem Tag gar nicht.
//   • Business-frei (lib/arbeitsrahmen): Läufe von BUSINESS-Heads ruhen in den Business-freien Zeiten der Person, für die sie laufen,
//     und kommen danach von selbst — am selben Tag. Verpasstes wird nicht über den Tag hinaus nachgeholt (wie die täglichen Head-Läufe).
//   • Hintergrund-KI aus (System › Datenschutz): nichts wird eingereiht (`faden` steht in `KI_LAEUFE`).
//   • Höchstzahl automatischer Läufe je Tag und Head (`AUTO_LAEUFE_JE_TAG`, Fragerunde 15) — darüber ruht der Head bis morgen.
//   • Riegel = die Warteschlange selbst (wie Morgen-/Abendlauf im Takt) plus die Threads der Person (Paket 1 legt sie mit `skillId`
//     bzw. `planId` an) — kein zweiter Zähler.
//   • Wer: ein Lauf rechnet immer für eine PERSON (Regel 5/7): Privat-Skills und Pläne für ihre Besitzerin, Business-Skills für die
//     Person, die ihn angelegt hat (nach Konto-Löschen der Inhaber), sonst die, die ihn freigegeben hat — nie ein Systemlauf.
//   • Reviews (Stufe „stark“) tragen `batch: true` — das Feld genügt (Fragerunde 14 „Batch nachts“); den Batch-Weg selbst baut das
//     Anbieter-Tor, bis dahin läuft der Auftrag normal.

import { HEAD_IDS, headDef } from './katalog';
import { LAUF_AGENT, einstellungBestand, planBestand, fadenBestand, skillsHaushaltBestand, skillsPersonBestand,
  type AgentRef, type AgentenEinstellung, type Bereich, type Faden, type FadenBestand, type Hintergrundaufgabe, type LaufAuftrag, type ModelTier, type PlanBestand,
  type Rhythmus, type Skill, type SkillAusloeser, type WerkstattBestand, type Zeitplan } from './typen';
import { ausWandzeit, tagPlus, tagVon, wandAus, wandzeit } from '@/lib/kalender/zeit';
import { istWerktag, wochentag } from '@/lib/zeit/kalender-kern';
import { istBusinessFrei, type Spanne } from '@/lib/arbeitsrahmen/regel';
import type { Faellig } from '@/lib/zoe/takt';

/** Agenten-Läufe des Takts nur in diesem Fenster (Berliner Stunden) — dieselben Werte wie VON/BIS in lib/zoe/takt.ts (Wächter). */
export const TAKT_VON = 7;
export const TAKT_BIS = 22;
/** Höchstzahl automatischer Läufe je Head und Berliner Tag (Fragerunde 15: „Höchstzahl Auto-Läufe“). */
export const AUTO_LAEUFE_JE_TAG = 12;
/** Kennung im Bestand für ZOE-Pläne (kein Head) — zählt in die Tageshöchstzahl wie ein Head. */
export const ZOE_SCHLUESSEL = 'zoe';

const UHRZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** Ein Slot ab `TAKT_BIS` liefe an seinem Tag nie (Nachtruhe des Takts) — davor geplante laufen ab `TAKT_VON`. */
export const FENSTER_FEHLER = `Agenten-Läufe starten zwischen ${TAKT_VON}:00 und ${TAKT_BIS}:00 Uhr — frühere Zeiten laufen um ${TAKT_VON}:00, spätere gar nicht.`;
const WAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const RHYTHMEN: readonly Rhythmus[] = ['taeglich', 'werktags', 'woechentlich', 'monatlich'];

/** Die Regel eines Zeitplans — aus einem Skill-Auslöser oder dem Zeitplan einer Hintergrundaufgabe. */
export type ZeitRegel =
  | { art: 'wiederkehrend'; rhythmus: Rhythmus; uhrzeit: string; tage?: number[] }
  | { art: 'einmalig'; wann: string };

export function regelVon(x: SkillAusloeser | Zeitplan): ZeitRegel | null {
  if (x.art === 'zeitplan' || x.art === 'wiederkehrend') return { art: 'wiederkehrend', rhythmus: x.rhythmus, uhrzeit: x.uhrzeit, ...(x.tage?.length ? { tage: [...x.tage] } : {}) };
  if (x.art === 'einmalig') return { art: 'einmalig', wann: x.wann };
  return null;
}

// ── Prüfen (Eingaben aus Skill-Editor und „+ Hintergrundaufgabe“) ─────────────────────────────────────────────────────────

export type Pruefung<T> = { ok: true; wert: T } | { ok: false; status: 400 | 413; fehler: string };

/** Ist der Tag ein echter Kalendertag (Rundweg über UTC-Mittag)? */
const istTag = (t: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(t) && new Date(`${t}T12:00:00Z`).toISOString().slice(0, 10) === t;

/** Rhythmus, Uhrzeit, Tage eines wiederkehrenden Zeitplans prüfen (rein). */
export function wiederkehrendPruefen(roh: { rhythmus?: unknown; uhrzeit?: unknown; tage?: unknown }): Pruefung<{ rhythmus: Rhythmus; uhrzeit: string; tage?: number[] }> {
  if (!RHYTHMEN.includes(roh.rhythmus as Rhythmus)) return { ok: false, status: 400, fehler: 'Rhythmus: täglich, werktags, wöchentlich oder monatlich.' };
  const rhythmus = roh.rhythmus as Rhythmus;
  if (typeof roh.uhrzeit !== 'string' || !UHRZEIT.test(roh.uhrzeit)) return { ok: false, status: 400, fehler: 'Uhrzeit als „HH:MM“ (Berliner Zeit).' };
  if (Number(roh.uhrzeit.slice(0, 2)) >= TAKT_BIS) return { ok: false, status: 400, fehler: FENSTER_FEHLER };
  let tage: number[] | undefined;
  if (roh.tage !== undefined && roh.tage !== null) {
    if (!Array.isArray(roh.tage)) return { ok: false, status: 400, fehler: 'Tage als Liste.' };
    const max = rhythmus === 'woechentlich' ? 7 : rhythmus === 'monatlich' ? 31 : 0;
    if (!max && roh.tage.length) return { ok: false, status: 400, fehler: 'Tage gibt es nur bei „wöchentlich“ (1 = Montag … 7 = Sonntag) und „monatlich“ (1–31).' };
    if (roh.tage.length > max) return { ok: false, status: 413, fehler: `Höchstens ${max} Tage.` };
    if (!roh.tage.every(t => Number.isInteger(t) && (t as number) >= 1 && (t as number) <= max)) return { ok: false, status: 400, fehler: rhythmus === 'woechentlich' ? 'Wochentage 1 (Montag) bis 7 (Sonntag).' : 'Monatstage 1 bis 31.' };
    tage = Array.from(new Set(roh.tage as number[])).sort((a, b) => a - b);
    if (!tage.length) tage = undefined;
  }
  return { ok: true, wert: { rhythmus, uhrzeit: roh.uhrzeit, ...(tage ? { tage } : {}) } };
}

/** Zeitplan einer Hintergrundaufgabe prüfen (rein). Einmalig: Berliner Wandzeit `YYYY-MM-DDTHH:mm:ss`, nicht in der Vergangenheit. */
export function zeitplanPruefen(roh: unknown, jetztWand?: string): Pruefung<Zeitplan> {
  if (!roh || typeof roh !== 'object') return { ok: false, status: 400, fehler: 'Zeitplan fehlt.' };
  const z = roh as Record<string, unknown>;
  if (z.art === 'einmalig') {
    if (typeof z.wann !== 'string' || !WAND.test(z.wann) || !istTag(z.wann.slice(0, 10)) || !UHRZEIT.test(z.wann.slice(11, 16))) return { ok: false, status: 400, fehler: 'Zeitpunkt als Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“.' };
    if (jetztWand && z.wann < jetztWand) return { ok: false, status: 400, fehler: 'Der Zeitpunkt liegt in der Vergangenheit.' };
    if (Number(z.wann.slice(11, 13)) >= TAKT_BIS) return { ok: false, status: 400, fehler: FENSTER_FEHLER };
    return { ok: true, wert: { art: 'einmalig', wann: z.wann } };
  }
  if (z.art === 'wiederkehrend') {
    const w = wiederkehrendPruefen(z);
    return w.ok ? { ok: true, wert: { art: 'wiederkehrend', ...w.wert } } : w;
  }
  return { ok: false, status: 400, fehler: 'Zeitplan: „einmalig“ oder „wiederkehrend“.' };
}

// ── Die EINE Regel für „wann“ ────────────────────────────────────────────────────────────────────────────────────────────

const monatsLetzter = (tag: string): number => new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)), 0)).getUTCDate();

/** Geplante Zeitpunkte einer Regel an einem Berliner Tag (Wandzeiten, aufsteigend). Rein. */
export function slotsAmTag(r: ZeitRegel, tag: string): string[] {
  if (r.art === 'einmalig') return tagVon(r.wann) === tag ? [r.wann] : [];
  const zeit = `${tag}T${r.uhrzeit}:00`;
  switch (r.rhythmus) {
    case 'taeglich': return [zeit];
    case 'werktags': return istWerktag(tag) ? [zeit] : [];
    case 'woechentlich': return (r.tage?.length ? r.tage : [1]).includes(wochentag(tag)) ? [zeit] : [];
    case 'monatlich': {
      const d = Number(tag.slice(8, 10)), letzter = monatsLetzter(tag);
      return (r.tage?.length ? r.tage : [1]).some(t => t === d || (t > letzter && d === letzter)) ? [zeit] : [];
    }
  }
}

/**
 * Ab wann der Takt einen Slot wirklich einreiht (Wandzeit) — oder null (an diesem Tag nicht mehr): frühestens `TAKT_VON`, in einer
 * Business-freien Spanne erst an ihrem Ende, nie ab `TAKT_BIS` und nie am Folgetag. Rein.
 */
export function wirksamAb(slot: string, frei: readonly Spanne[] = []): string | null {
  const tag = tagVon(slot);
  const anfang = wandAus(tag, TAKT_VON * 60), schluss = wandAus(tag, TAKT_BIS * 60);
  let t = slot < anfang ? anfang : slot;
  for (let i = 0; i < 50; i++) {
    const s = frei.find(x => x.start <= t && t < x.ende);
    if (!s) break;
    t = s.ende;
  }
  return t < schluss && tagVon(t) === tag ? t : null;
}

/** Ist jetzt (Wandzeit) ein Takt-Moment für Agenten-Läufe dieser Person (Fenster, nicht Business-frei)? Rein. */
export const taktOffen = (jetztWand: string, frei: readonly Spanne[] = []): boolean => {
  const h = Number(jetztWand.slice(11, 13));
  return h >= TAKT_VON && h < TAKT_BIS && !istBusinessFrei(frei, jetztWand);
};

/** Der heute fällige Slot (der späteste, dessen wirksamer Zeitpunkt erreicht ist) — oder null. Rein. */
export function faelligerSlot(r: ZeitRegel, jetztWand: string, frei: readonly Spanne[] = []): string | null {
  if (!taktOffen(jetztWand, frei)) return null;
  const tag = tagVon(jetztWand);
  const da = slotsAmTag(r, tag).filter(s => { const w = wirksamAb(s, frei); return !!w && w <= jetztWand; });
  return da.length ? da[da.length - 1] : null;
}

/** Die kommenden Zeitpunkte im Fenster [vonWand, bisWand): geplant (`slot`) und wann der Takt ihn wirklich einreiht (`wirksam`). Rein. */
export function naechsteSlots(r: ZeitRegel, vonWand: string, bisWand: string, freiFuer: (tag: string) => readonly Spanne[] = () => []): { slot: string; wirksam: string }[] {
  const raus: { slot: string; wirksam: string }[] = [];
  for (let tag = tagVon(vonWand), n = 0; tag <= tagVon(bisWand) && n < 400; tag = tagPlus(tag, 1), n++) {
    for (const slot of slotsAmTag(r, tag)) {
      const wirksam = wirksamAb(slot, freiFuer(tag));
      if (wirksam && wirksam >= vonWand && wirksam < bisWand) raus.push({ slot, wirksam });
    }
  }
  return raus;
}

/** Klartext eines Zeitplans („werktags 08:00“) — Anzeige und Prüfung „läuft effektiv: …“ (Markt-UX Muster 10). Rein. */
export function zeitplanText(r: ZeitRegel): string {
  if (r.art === 'einmalig') return `einmalig am ${r.wann.slice(8, 10)}.${r.wann.slice(5, 7)}.${r.wann.slice(0, 4)} um ${r.wann.slice(11, 16)}`;
  const WT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  if (r.rhythmus === 'taeglich') return `täglich ${r.uhrzeit}`;
  if (r.rhythmus === 'werktags') return `werktags ${r.uhrzeit}`;
  if (r.rhythmus === 'woechentlich') return `wöchentlich ${(r.tage?.length ? r.tage : [1]).map(t => WT[t]).join(', ')} ${r.uhrzeit}`;
  return `monatlich am ${(r.tage?.length ? r.tage : [1]).map(t => `${t}.`).join(', ')} ${r.uhrzeit}`;
}

// ── Fällig im Takt (rein) ────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Skill bzw. eine Hintergrundaufgabe mit Zeitplan — fertig aufgelöst (Person, Head, Bereich). */
export interface ZeitplanKandidat {
  art: 'skill' | 'plan';
  /** `sk-…` bzw. `hg-…`. */
  id: string;
  /** Head-Kennung bzw. `ZOE_SCHLUESSEL`. */
  headId: string;
  bereich: Bereich;
  /** Für wen der Lauf rechnet (Speichername). */
  person: string;
  regel: ZeitRegel;
  stufe?: ModelTier;
  /** Der Auftrag für /api/agenten/faden/lauf. */
  eingabe: LaufAuftrag;
}

/** Was eingereiht wird: der `LaufAuftrag` plus zwei Felder für Zählung und Batch — Paket 1 liest nur den `LaufAuftrag`. */
export type ZeitplanEingabe = LaufAuftrag & { headId?: string; batch?: true };

/** Ein Auftrag der Warteschlange, so weit der Riegel ihn braucht. */
export interface AuftragSpurAgent { name: string; zeit: string; tag: string; status: string; anlass?: string; eingabe?: Record<string, unknown> }

export interface ZeitplanLage {
  jetzt: Date;
  /** Hintergrund-KI der Instanz an? */
  kiHintergrund: boolean;
  /** Business-freie Spannen je Person (heute) — nur für Läufe von Business-Heads. */
  frei: (person: string) => readonly Spanne[];
  auftraege: readonly AuftragSpurAgent[];
  /** Threads (aller betroffenen Personen) mit Herkunft. */
  faeden: readonly { skillId?: string; planId?: string; erstellt: string }[];
}

const betrifft = (e: Record<string, unknown> | undefined, k: Pick<ZeitplanKandidat, 'art' | 'id'>): boolean =>
  !!e && e.art === k.art && (k.art === 'skill' ? e.skillId === k.id : e.planId === k.id);

/** Lief (oder läuft) dieser Kandidat für den Slot schon? Riegel = Warteschlange + Threads. Rein. */
export function schonGelaufen(k: Pick<ZeitplanKandidat, 'art' | 'id'>, slot: string, lage: Pick<ZeitplanLage, 'auftraege' | 'faeden'>): boolean {
  const ab = ausWandzeit(slot).getTime();
  if (lage.auftraege.some(a => a.name === LAUF_AGENT && betrifft(a.eingabe, k) && Date.parse(a.zeit) >= ab)) return true;
  return lage.faeden.some(f => (k.art === 'skill' ? f.skillId === k.id : f.planId === k.id) && Date.parse(f.erstellt) >= ab);
}

/** Automatische Läufe eines Heads heute (Takt-Aufträge `faden` mit diesem Head). Rein. */
export function autoLaeufeHeute(headId: string, heute: string, auftraege: readonly AuftragSpurAgent[]): number {
  return auftraege.filter(a => a.name === LAUF_AGENT && a.tag === heute && /^Takt:/.test(a.anlass ?? '') && a.eingabe?.headId === headId).length;
}

/** Was jetzt einzureihen ist (rein) — höchstens ein Lauf je Kandidat, Tageshöchstzahl je Head. Titel nie im Grund (Takt-Vorschau sieht der Haushalt). */
export function zeitplaeneFaelligRein(kandidaten: readonly ZeitplanKandidat[], lage: ZeitplanLage): Faellig[] {
  if (!lage.kiHintergrund) return [];
  const jetztWand = wandzeit(lage.jetzt), heute = tagVon(jetztWand);
  const zaehler = new Map<string, number>();
  const raus: Faellig[] = [];
  for (const k of kandidaten) {
    const frei = k.bereich === 'business' ? lage.frei(k.person) : [];
    const slot = faelligerSlot(k.regel, jetztWand, frei);
    if (!slot || schonGelaufen(k, slot, lage)) continue;
    const n = zaehler.get(k.headId) ?? autoLaeufeHeute(k.headId, heute, lage.auftraege);
    if (n >= AUTO_LAEUFE_JE_TAG) continue;
    zaehler.set(k.headId, n + 1);
    const eingabe: ZeitplanEingabe = { ...k.eingabe, headId: k.headId, ...(k.stufe === 'stark' ? { batch: true as const } : {}) };
    raus.push({
      id: `agenten-${k.art}-${k.id}`,
      grund: k.art === 'skill' ? 'Agenten: Skill nach Zeitplan' : 'Agenten: geplante Hintergrundaufgabe',
      auftrag: { art: 'agent', name: LAUF_AGENT, auftrag: JSON.stringify(eingabe), eingabe: eingabe as unknown as Record<string, unknown>, person: k.person, anlass: 'Takt: Agenten-Zeitplan' },
    });
  }
  return raus;
}

// ── Kandidaten aus den Beständen (rein) ──────────────────────────────────────────────────────────────────────────────────

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Für wen ein Business-Skill läuft: die Person, die ihn angelegt hat, sonst die, die ihn freigegeben hat — nur Personen im Haushalt. */
export function laufPersonFuerSkill(s: Pick<Skill, 'angelegtVon' | 'freigegebenVon'>, personen: ReadonlySet<string>): string | null {
  for (const p of [s.angelegtVon, s.freigegebenVon]) if (p && PERSON.test(p) && personen.has(p)) return p;
  return null;
}

/** Bereich und Head-Schlüssel eines Agenten (ZOE: Privat, Schlüssel `zoe`). */
export function agentHead(a: AgentRef): { headId: string; bereich: Bereich } | null {
  if (a.art === 'zoe') return { headId: ZOE_SCHLUESSEL, bereich: 'privat' };
  const h = headDef(a.headId);
  return h ? { headId: h.id, bereich: h.bereich } : null;
}

/** Skill → Kandidat (nur aktiv, mit Zeitplan, bekannter Head). Rein. */
export function skillKandidat(s: Skill, person: string | null): ZeitplanKandidat | null {
  if (!s.aktiv || s.ausloeser.art !== 'zeitplan' || !person) return null;
  const h = headDef(s.headId);
  const regel = regelVon(s.ausloeser);
  if (!h || !regel) return null;
  return { art: 'skill', id: s.id, headId: h.id, bereich: h.bereich, person, regel, stufe: s.stufe, eingabe: { art: 'skill', skillId: s.id, headId: h.id, ausloeser: 'zeitplan' } };
}

/**
 * Hintergrundaufgabe → Kandidat (nur aktiv). Rein. Eine (alte) Aufgabe bei ZOE wird nie eingereiht — ein ZOE-Thread läuft nicht im Hintergrund
 * (Planen lehnt sie seit dem Feinschliff 09.10. ab, lib/agenten/plan-server.ts `ZOE_NICHT_GEPLANT`); sonst stünde sie jeden Tag neu in der Schlange.
 */
export function planKandidat(p: Hintergrundaufgabe): ZeitplanKandidat | null {
  if (!p.aktiv || !PERSON.test(p.besitzer) || p.agent.art === 'zoe') return null;
  const ah = agentHead(p.agent);
  const regel = regelVon(p.zeitplan);
  if (!ah || !regel) return null;
  return { art: 'plan', id: p.id, headId: ah.headId, bereich: ah.bereich, person: p.besitzer, regel, eingabe: { art: 'plan', planId: p.id } };
}

// ── Server: Kandidaten laden, Lage lesen (eine Zeile im Takt) ─────────────────────────────────────────────────────────────

/** Die Schnittstelle zur Sicht (Paket 1, lib/agenten/sicht.ts): darf diese Person den Head sehen? Beim Zusammenführen verdrahtet. */
export type HeadSichtPruefer = (person: string, headId: string) => Promise<boolean>;

export interface KandidatenStand {
  kandidaten: ZeitplanKandidat[];
  personen: string[];
  /** Ist der Haushalt im Not-Aus? Dann nichts. */
  notAus: boolean;
}

/** Alle Kandidaten der Instanz: Werkstatt des Haushalts, Werkstatt je Person, Pläne je Person — nur Personen im Haushalt des Inhabers. */
export async function kandidatenLaden(sicht?: HeadSichtPruefer): Promise<KandidatenStand> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const pruefer = sicht ?? (await import('./skills-server')).headSichtbar;
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const haushalt = inhaber?.haushalt ?? null;
  const personen = konten.filter(k => k.speicher === inhaber?.speicher || (!!haushalt && k.haushalt === haushalt)).map(k => k.speicher).filter(p => PERSON.test(p));
  const personSet = new Set(personen);
  // Roh mit den Abschnitten der Personen (Paket 4b) — `headEinstellungVon` wählt je Kandidat den richtigen; nie nach außen gegeben.
  const roh = haushalt ? await loadJson<AgentenEinstellung>(einstellungBestand(haushalt)).catch(() => null) : null;
  const einst: AgentenEinstellung | null = roh ? { ...roh, heads: roh.heads ?? {} } : null;
  const kandidaten: ZeitplanKandidat[] = [];
  const { headEinstellungVon } = await import('./einstellung');
  const darf = async (k: ZeitplanKandidat): Promise<boolean> => {
    if (k.headId === ZOE_SCHLUESSEL) return true;
    const h = headDef(k.headId);
    // Paket 4b: ausgeschaltet oder Not-Aus des Heads (Privat-Heads: der Abschnitt der Person) → kein Zeitplan-Lauf.
    const e = einst && h ? headEinstellungVon(einst, h, k.person) : null;
    if (e?.aktiv === false || e?.notAus) return false;
    return pruefer(k.person, k.headId).catch(() => false);
  };
  const sicher = async <T,>(p: Promise<T>): Promise<T | null> => p.catch(e => { console.error('[agenten-zeitplan] Bestand nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return null; });
  if (haushalt) {
    const w = await sicher(loadJson<WerkstattBestand>(skillsHaushaltBestand(haushalt)));
    for (const s of w?.skills ?? []) {
      const k = skillKandidat(s, laufPersonFuerSkill(s, personSet));
      if (k && headDef(s.headId)?.ebene === 'haushalt' && (await darf(k))) kandidaten.push(k);
    }
  }
  for (const p of personen) {
    const w = await sicher(loadJson<WerkstattBestand>(skillsPersonBestand(p)));
    for (const s of w?.skills ?? []) {
      const k = skillKandidat(s, p);
      if (k && headDef(s.headId)?.ebene === 'person' && (await darf(k))) kandidaten.push(k);
    }
    const plan = await sicher(loadJson<PlanBestand>(planBestand(p)));
    for (const a of plan?.aufgaben ?? []) {
      const k = a.besitzer === p ? planKandidat(a) : null;
      if (k && (await darf(k))) kandidaten.push(k);
    }
  }
  return { kandidaten, personen, notAus: !!einst?.notAus };
}

/** Die Lage für den Riegel: Warteschlange, Threads der betroffenen Personen, Business-frei, Hintergrund-KI. */
export async function zeitplanLage(jetzt: Date, personen: readonly string[], business: ReadonlySet<string>): Promise<ZeitplanLage> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { lies } = await import('@/lib/zoe/auftraege');
  const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
  const { businessFreiFensterFuer } = await import('@/lib/arbeitsrahmen/server');
  const heute = tagVon(wandzeit(jetzt));
  const [auftraege, ki] = await Promise.all([lies().catch(() => []), kiSchalterFuer(null).catch(() => ({ hintergrund: false }))]);
  const faeden: { skillId?: string; planId?: string; erstellt: string }[] = [];
  for (const p of personen) {
    const f = await loadJson<FadenBestand>(fadenBestand(p)).catch(() => null);
    for (const x of f?.faeden ?? []) if (x.skillId || x.planId) faeden.push({ ...(x.skillId ? { skillId: x.skillId } : {}), ...(x.planId ? { planId: x.planId } : {}), erstellt: x.erstellt });
  }
  const frei = new Map<string, readonly Spanne[]>();
  for (const p of business) frei.set(p, await businessFreiFensterFuer(p, tagPlus(heute, -1), tagPlus(heute, 1)).catch(() => []));
  return { jetzt, kiHintergrund: !!ki.hintergrund, frei: p => frei.get(p) ?? [], auftraege, faeden };
}

// ── Business-frei vorbei: wartende Läufe nachholen (Paket 4b) ──────────────────────────────────────────────────────────

/** Ein Lauf, der wegen Business-frei wartet — Feld `wartetAuf` (Vertrag) oder, ohne Feld, der Grund, den der Kern schreibt. Rein. */
export const wartetAufBusinessFrei = (f: Pick<Faden, 'lauf'>): boolean =>
  !!f.lauf && f.lauf.status === 'wartet' && (f.lauf.wartetAuf === 'business-frei' || (!f.lauf.wartetAuf && /business-frei/i.test(f.lauf.fehler ?? '')));
/** Höchstens so viele Nachhol-Läufe je Thread und Tag (Schutz, falls der Rahmen am Server anders rechnet als im Takt). */
export const NACHHOLEN_JE_TAG = 2;
export const NACHHOLEN_ANLASS = 'Takt: Business-frei vorbei';

/**
 * Was der Takt nachholt (rein): Threads von Business-Heads, deren Lauf wegen Business-frei wartet, sobald der Rahmen der Person vorbei ist
 * (und das Takt-Fenster offen) — EINMAL je Wartezeit: nicht, wenn für den Thread schon ein Auftrag offen ist oder seit dem letzten Warten
 * einer eingereiht wurde, höchstens `NACHHOLEN_JE_TAG` je Tag. Hintergrund-KI aus → nichts.
 */
export function businessFreiNachholenRein(faeden: readonly { person: string; faden: Faden }[], lage: Pick<ZeitplanLage, 'jetzt' | 'kiHintergrund' | 'frei' | 'auftraege'>): Faellig[] {
  if (!lage.kiHintergrund) return [];
  const jetztWand = wandzeit(lage.jetzt), heute = tagVon(jetztWand);
  const raus: Faellig[] = [];
  for (const { person, faden: f } of faeden) {
    if (f.besitzer !== person || f.agent.art === 'zoe' || !wartetAufBusinessFrei(f)) continue;
    if (headDef(f.agent.headId)?.bereich !== 'business') continue;
    if (!taktOffen(jetztWand, lage.frei(person))) continue;
    const zuDiesem = lage.auftraege.filter(a => a.name === LAUF_AGENT && a.eingabe?.fadenId === f.id);
    if (zuDiesem.some(a => a.status === 'offen' || a.status === 'laeuft')) continue;
    if (zuDiesem.some(a => a.anlass === NACHHOLEN_ANLASS && Date.parse(a.zeit) >= Date.parse(f.aktualisiert))) continue;
    if (zuDiesem.filter(a => a.anlass === NACHHOLEN_ANLASS && a.tag === heute).length >= NACHHOLEN_JE_TAG) continue;
    const eingabe: ZeitplanEingabe = { art: 'faden', fadenId: f.id, headId: f.agent.headId };
    raus.push({
      id: `agenten-nachholen-${f.id}`,
      grund: 'Agenten: Lauf nach Business-frei fortsetzen',
      auftrag: { art: 'agent', name: LAUF_AGENT, auftrag: JSON.stringify(eingabe), eingabe: eingabe as unknown as Record<string, unknown>, person, anlass: NACHHOLEN_ANLASS },
    });
  }
  return raus;
}

/**
 * Die EINE Zeile im Takt (lib/zoe/takt.ts): Skill- und Plan-Zeitpläne als Aufträge `faden` — dazu (Paket 4b) Läufe, die wegen Business-frei
 * warteten und deren Rahmen vorbei ist. Liest nur — eingereiht wird vom Takt (POST /api/zoe/takt), die Vorschau (GET ?in=) bleibt ohne
 * Wirkung. Fehler → nichts (der Takt läuft weiter).
 */
export async function zeitplaeneFaellig(jetzt: Date = new Date()): Promise<Faellig[]> {
  try {
    const { kandidaten, personen, notAus } = await kandidatenLaden();
    if (notAus) return [];
    // Härtetest 09.10.: ist das Instanz-Budget (Monat bzw. gesamt) erreicht, reiht der Takt keine Agenten-Läufe ein — sie scheiterten nur am
    // KI-Tor, jeder mit Thread „fehler“ und Glocke (bis zu 12 je Head und Tag). Die Glocke „Budget erreicht“ kommt einmal aus dem Tor.
    if (await import('@/lib/ki/tor').then(m => m.budgetSperre()).catch(() => null)) return [];
    const { loadJson } = await import('@/lib/store/local-db');
    const wartend: { person: string; faden: Faden }[] = [];
    for (const p of personen) {
      const b = await loadJson<FadenBestand>(fadenBestand(p)).catch(() => null);
      for (const f of b?.faeden ?? []) if (wartetAufBusinessFrei(f)) wartend.push({ person: p, faden: f });
    }
    if (!kandidaten.length && !wartend.length) return [];
    const business = new Set([...kandidaten.filter(k => k.bereich === 'business').map(k => k.person), ...wartend.map(w => w.person)]);
    const lage = await zeitplanLage(jetzt, personen, business);
    return [...zeitplaeneFaelligRein(kandidaten, lage), ...businessFreiNachholenRein(wartend, lage)];
  } catch (err) {
    console.error('[agenten-zeitplan] übersprungen:', err instanceof Error ? err.message.slice(0, 200) : err);
    return [];
  }
}

/** Für Wächter und Oberfläche: alle Head-Kennungen, für die Zeitpläne gelten können. */
export const ZEITPLAN_HEADS: readonly string[] = [...HEAD_IDS, ZOE_SCHLUESSEL];

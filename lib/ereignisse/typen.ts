// ─── Ereignisse — Form des Bestands und die reinen Regeln (09.10., E1 „Ereignisstelle“; Server UND Browser) ────────────────────
// Bis hierher lief MAKE OS nur nach der Uhr: kein Agent erfuhr von einer neuen Mail, einem Zahlungseingang, einer Deal-Stufe oder „An ZOE
// geben“ (Analyse 3 „Ereignisse, Takt, Aktualität“). Jetzt gibt es EINE Ereignisstelle:
//
//   Bestand `ereignisse--<haushalt>` (nur anhängend, rollend: Einträge älter als die Frist „ereignisse“ fallen beim Schreiben und im
//   Löschfristen-Lauf weg; über `EREIGNIS_GRENZEN.bestand` werden NEUE abgelehnt und gezählt — nie ein vorhandener gekürzt).
//   Ein Eintrag trägt NUR Kennungen — nie Betreff, Text, Beträge, Namen oder Adressen:
//     id       deterministisch je Wirkung (`gmail:<msgId>`, `imap:<Kennung>`, `wa:<WAMID>`, `bank:<Buchung>`, `rechnung:<id>:bezahlt`,
//              `crm:deal:<id>:<stufe>`, `crm:lead:<firma|kontakt>:sql`, `crm:anfrage:<Follow-up>`, `aufgabe:<id>:zoe:<Zeit>`,
//              `kalender:<uid>:abgesagt`) — über 80 Zeichen als Fingerabdruck (`ereignisKennung`); dieselbe Kennung = dasselbe Ereignis
//     art      `SkillEreignis` (lib/agenten/typen.ts — keine zweite Liste), quelle, bezug (Kennungen), bereich (privat | business | null)
//     person   für wen sichtbar (Mail: NUR die Person des Postfachs) — bzw. `personen` (WhatsApp mit Personen-Liste)
//   Gespeist NUR über `ereignis(e)` (lib/ereignisse/server.ts): wirft nie (wie `melde()`), Dedup über die Kennung unter der Sperre,
//   aufgerufen NACH dem Speichern der Quelle. Gelesen wird mit einem Cursor je Konsument (Skill mit Auslöser „Ereignis“, ZOE-Aufgaben).
//
// Rein und getestet (tests/ereignisse.test.ts): Kennung, Sichtregel, Bezug-Schlüssel, die Auswertung im Takt (`auswerten`).

import type { ModelTier, SkillEreignis } from '@/lib/agenten/typen';
import type { Spanne } from '@/lib/arbeitsrahmen/regel';

export type EreignisArt = SkillEreignis;
export const EREIGNIS_QUELLEN = ['gmail', 'imap', 'whatsapp', 'kontoauszug', 'finanzplan', 'crm', 'kartei', 'anfrage', 'aufgaben', 'kalender'] as const;
export type EreignisQuelle = typeof EREIGNIS_QUELLEN[number];
/** Die Kennungen, die ein Ereignis tragen darf — sonst nichts. */
export const BEZUG_FELDER = ['kontaktId', 'firmaId', 'dealId', 'mandatId', 'rechnungId', 'buchungId', 'kontoId', 'aufgabeId', 'terminUid', 'gespraech', 'followupId'] as const;
export type BezugFeld = typeof BEZUG_FELDER[number];
export type EreignisBezug = Partial<Record<BezugFeld, string>>;
export type EreignisBereich = 'privat' | 'business';

export interface Ereignis {
  /** Laufende Nummer im Bestand (Cursor der Konsumenten). */
  nr: number;
  id: string;
  art: EreignisArt;
  quelle: EreignisQuelle;
  bezug: EreignisBezug;
  /** null = ohne Bereich (z. B. Gmail ohne Bereich im Postfach-Register) — dann gilt nur die Person. */
  bereich: EreignisBereich | null;
  /** Nur diese Person sieht/löst aus (Mail: die Person des Postfachs; „An ZOE geben“: die Auftraggeberin). */
  person?: string;
  /** Nur diese Personen (WhatsApp mit `WHATSAPP_PERSONEN`). Fehlen `person` und `personen`: alle im Haushalt, die den Bereich sehen. */
  personen?: string[];
  /** Kennung einer Stufe (Deal) — nie Text. */
  stufe?: string;
  /** Wann MAKE OS davon erfuhr (ISO). */
  am: string;
}

/** Was eine Quelle meldet (`nr`/`am` setzt die Ereignisstelle). */
export type EreignisEingabe = Omit<Ereignis, 'nr' | 'am'> & { am?: string };

export interface KonsumentStand { nr: number; am: string }
export interface EreignisBestand {
  v: 1;
  /** Zuletzt vergebene Nummer. */
  nr: number;
  eintraege: Ereignis[];
  /** Je Konsument (`skill:<id>`, `zoe-aufgaben`): alles bis `nr` ist für ihn erledigt. */
  cursor: Record<string, KonsumentStand>;
  /** Lagebild des letzten Takts (nur Zahlen, Head of IT). */
  lage?: { am: string; wartend: number; gestaut: number; faellig: number };
  /** Neue Ereignisse abgelehnt, weil der Bestand voll war (je Berliner Tag, nur Zähler). */
  abgelehnt?: { tag: string; anzahl: number };
}

export const ereignisBestand = (haushalt: string) => `ereignisse--${haushalt}`;
export const LEER: EreignisBestand = { v: 1, nr: 0, eintraege: [], cursor: {} };

export const EREIGNIS_GRENZEN = {
  /** Höchstzahl im Bestand — darüber werden NEUE abgelehnt (gezählt), nie gekürzt. */
  bestand: 20_000,
  /** Höchstzahl je Aufruf von `ereignis()` (ein Kontoauszug, ein Abgleich) — darüber abgelehnt und gezählt. */
  jeAufruf: 300,
  /** Länge der Kennung (die Lauf-Route nimmt `ereignisId` bis 80 Zeichen). */
  idZeichen: 80,
  /** Ein Ereignis löst höchstens so lange etwas aus (deckt Nachtruhe und ein Business-freies Wochenende) — danach verfällt es. */
  hoechstalterStunden: 72,
  /** Entprellen: höchstens ein Lauf je Konsument und Bezug in diesem Fenster. */
  entprellenMinuten: 60,
  /** Ab so vielen Minuten gilt ein wartendes Ereignis ohne zeitlichen Grund als „gestaut“ (Head of IT). */
  gestautMinuten: 60,
  /** „Gerade geschrieben“ (Power Hour): so lange zählt eine eingehende Nachricht. */
  geradeStunden: 72,
  /** Höchstzahl der Einträge im Heads-Paket „seit dem letzten Lauf“. */
  headsPaket: 30,
} as const;

// ── Kennung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

const PERSON = /^[a-z0-9-]{1,40}$/;
/** Eine Kennung im Bezug: ohne Leerzeichen/Steuerzeichen, höchstens 200 Zeichen (Termin-UIDs sind lang). */
const WERT = /^[^\s\u0000-\u001f\u007f]{1,200}$/;

/** FNV-1a 64 Bit (zwei 32-Bit-Runden) als hex — rein, deterministisch. */
function fnv(s: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** Die Kennung eines Ereignisses aus Teilen (`gmail`, `<msgId>` …) — über 80 Zeichen: `<erstes Teil>:h<Fingerabdruck>`. Rein. */
export function ereignisKennung(...teile: string[]): string {
  const roh = teile.join(':');
  if (roh.length <= EREIGNIS_GRENZEN.idZeichen && WERT.test(roh)) return roh;
  return `${(teile[0] ?? 'x').replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'x'}:h${fnv(roh)}`;
}

/** Eine Eingabe säubern: nur bekannte Felder, nur Kennungen. null = unbrauchbar (wird nicht gespeichert). Rein. */
export function eingabeSauber(e: EreignisEingabe, istArt: (a: unknown) => boolean): EreignisEingabe | null {
  if (!e || typeof e.id !== 'string' || !e.id || e.id.length > EREIGNIS_GRENZEN.idZeichen || !WERT.test(e.id)) return null;
  if (!istArt(e.art) || !(EREIGNIS_QUELLEN as readonly string[]).includes(e.quelle)) return null;
  const bezug: EreignisBezug = {};
  for (const f of BEZUG_FELDER) { const v = e.bezug?.[f]; if (typeof v === 'string' && WERT.test(v)) bezug[f] = v; }
  const personen = Array.isArray(e.personen) ? Array.from(new Set(e.personen.filter(p => typeof p === 'string' && PERSON.test(p)))).slice(0, 20) : undefined;
  return {
    id: e.id, art: e.art, quelle: e.quelle, bezug,
    bereich: e.bereich === 'privat' || e.bereich === 'business' ? e.bereich : null,
    ...(typeof e.person === 'string' && PERSON.test(e.person) ? { person: e.person } : {}),
    ...(personen?.length ? { personen } : {}),
    ...(typeof e.stufe === 'string' && /^[a-z0-9_-]{1,40}$/.test(e.stufe) ? { stufe: e.stufe } : {}),
    ...(typeof e.am === 'string' && Number.isFinite(Date.parse(e.am)) ? { am: e.am } : {}),
  };
}

// ── Sichtregel ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was die Sichtregel über eine Person wissen muss (aus `KontoSicht`, lib/agenten/sicht.ts). */
export interface Betrachter { person: string; vollesMitglied: boolean; privatFinanzen: boolean }

/**
 * Sieht diese Person das Ereignis? (rein, EINE Stelle — Takt, Heads-Paket, Power Hour)
 *  · `person` gesetzt → nur genau diese Person (Mail der anderen Person löst für mich nie etwas aus)
 *  · `personen` gesetzt → nur diese Personen
 *  · Privat nur für volle Mitglieder; ein privater Zahlungseingang nur mit privatem Finanzzugang (nie „nur Business“)
 */
export function ereignisSichtbar(e: Pick<Ereignis, 'person' | 'personen' | 'bereich' | 'art'>, b: Betrachter | null | undefined): boolean {
  if (!b || !PERSON.test(b.person)) return false;
  if (e.person && e.person !== b.person) return false;
  if (e.personen && !e.personen.includes(b.person)) return false;
  if (e.bereich === 'privat') {
    if (!b.vollesMitglied) return false;
    if (e.art === 'zahlungseingang' && !b.privatFinanzen) return false;
  }
  return true;
}

/** Passt das Ereignis zum Bereich eines Heads? Business-Heads nie Privates, Privat-Heads nie Business; ohne Bereich beide (die Person gilt). */
export const passtZumBereich = (e: Pick<Ereignis, 'bereich'>, headBereich: EreignisBereich | null): boolean =>
  !e.bereich || !headBereich || e.bereich === headBereich;

/** Worauf sich ein Ereignis bezieht — für das Entprellen (ein Lauf je Bezug und Stunde). Rein. */
export function bezugSchluessel(e: Pick<Ereignis, 'bezug' | 'id'>): string {
  for (const f of ['kontaktId', 'firmaId', 'dealId', 'mandatId', 'rechnungId', 'aufgabeId', 'terminUid', 'gespraech', 'buchungId'] as const) {
    const v = e.bezug[f];
    if (v) return `${f}:${v}`.slice(0, 220);
  }
  return `id:${e.id}`;
}

// ── Auswertung im Takt (rein) ────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Konsument: ein Skill mit Auslöser „Ereignis“ oder der ZOE-Aufgaben-Lauf. */
export interface Konsument {
  /** `skill:<id>` bzw. `zoe-aufgaben`. */
  schluessel: string;
  art: 'skill' | 'zoe-aufgaben';
  arten: readonly EreignisArt[];
  /** Head-Kennung (Tageshöchstzahl) — ZOE: `zoe`. */
  headId: string;
  headBereich: EreignisBereich | null;
  /** Skill: für wen er läuft (aufgelöst wie ein Zeitplan); ZOE-Aufgaben: null (die Auftraggeberin aus dem Ereignis). */
  person: string | null;
  betrachter: Betrachter | null;
  /** Ereignisse vor diesem Zeitpunkt zählen nicht (Skill neu bzw. geändert). */
  seit?: string;
  /** Skill aus, Head aus/Not-Aus, Head für die Person nicht sichtbar → Ereignisse verfallen für ihn (wie ein verpasster Zeitplan). */
  ruht?: boolean;
  skillId?: string;
  /** Bedingung des Skills (Satz — Daten, keine Anweisung): geht als Eingabe an den Lauf. */
  filter?: string;
  stufe?: ModelTier;
}

/** Was die Auswertung vom Zustand braucht (geladen in lib/ereignisse/takt.ts). */
export interface AuswertungsLage {
  jetzt: Date;
  /** Berliner Wandzeit `YYYY-MM-DDTHH:mm:ss`. */
  jetztWand: string;
  heute: string;
  auftraege: readonly { name: string; zeit: string; tag: string; status: string; anlass?: string; eingabe?: Record<string, unknown>; person?: string }[];
  /** Instanz: frei · aus (Not-Aus für alle, Instanz-Budget erreicht, Hintergrund-KI aus — Ereignisse verfallen) · unlesbar (fail-closed: warten). */
  instanz: 'frei' | 'aus' | 'unlesbar';
  /** Hintergrund-KI der Person (die Person kann nur einschränken). */
  kiPerson: (p: string) => boolean;
  /** Business-freie Spannen der Person (heute ± 1). */
  frei: (p: string) => readonly Spanne[];
  /** Takt-Fenster offen? (Nachtruhe, Business-frei — lib/agenten/zeitplan.ts `taktOffen`). */
  taktOffen: (jetztWand: string, frei: readonly Spanne[]) => boolean;
  /** Höchstzahl automatischer Läufe je Head und Tag + wie viele heute schon liefen (lib/agenten/zeitplan.ts). */
  hoechstzahl: number;
  autoLaeufeHeute: (headId: string) => number;
  /** ZOE-Aufgaben: liegt die Aufgabe noch offen bei ZOE (und ist sie Business)? null = nicht mehr offen / unbekannt. */
  zoeAufgabe: (aufgabeId: string) => { business: boolean } | null;
}

export type Urteil = 'faellig' | 'erledigt' | 'verfallen' | 'wartet';
export type Wartegrund = 'ruhezeit' | 'business-frei' | 'entprellt' | 'hoechstzahl' | 'laeuft' | 'unlesbar';
export interface FaelligesEreignis { konsument: Konsument; ereignis: Ereignis; bezugSchluessel: string; person: string }
export interface Auswertung {
  faellig: FaelligesEreignis[];
  /** Neue Cursor je Konsument (nur, wo er weiterrückt; entfernte Konsumenten fehlen). */
  cursor: Record<string, KonsumentStand>;
  /** Ereignisse, die noch warten (alle Konsumenten). */
  wartend: number;
  /**
   * … davon ohne zeitlichen Grund (Sperre nicht lesbar, Tageshöchstzahl, ZOE arbeitet noch) und älter als `gestautMinuten`. Fällige zählen nicht
   * (nach der Nachtruhe sind sie alt, aber gleich eingereiht); was der Takt danach noch filtert (Head-Budget), zeigt das Budget selbst.
   */
  gestaut: number;
}

const ZEITLICH: ReadonlySet<Wartegrund> = new Set(['ruhezeit', 'business-frei', 'entprellt']);
const ZOE = 'zoe';

/** Gab es für diesen Konsumenten schon einen Lauf zu genau diesem Ereignis (Riegel = die Warteschlange)? Rein. */
export function schonEingereiht(k: Pick<Konsument, 'art' | 'skillId'>, ereignisId: string, auftraege: AuswertungsLage['auftraege']): boolean {
  return auftraege.some(a => a.eingabe?.ereignisId === ereignisId && (k.art === 'skill' ? a.name === 'faden' && a.eingabe?.skillId === k.skillId : a.name === 'zoe-aufgaben'));
}

/**
 * Die Auswertung (rein, EINE Regel für Takt, „sofort“ und Cursor): je Konsument die Ereignisse nach seinem Cursor —
 *   erledigt   andere Art, vor `seit`, nicht sichtbar (Person/Bereich), schon eingereiht (Riegel), von einem neueren mit demselben Bezug überholt,
 *              ZOE-Aufgabe nicht mehr offen
 *   verfallen  älter als `hoechstalterStunden`, Konsument ruht (Skill/Head aus, Not-Aus des Heads), Instanz aus (Not-Aus, Budget, Hintergrund-KI),
 *              Hintergrund-KI der Person aus — wie ein verpasster Zeitplan, nie später nachgeholt
 *   wartet     Nachtruhe, Business-frei, Entprellen (ein Lauf je Bezug und Stunde), Tageshöchstzahl, ZOE arbeitet schon für die Person,
 *              Sperre nicht lesbar (fail-closed)
 *   fällig     → ein Lauf (je Konsument und Bezug höchstens einer)
 * Der Cursor rückt bis vor das erste Ereignis, das noch wartet oder fällig ist.
 */
export function auswerten(bestand: Pick<EreignisBestand, 'eintraege' | 'cursor'>, konsumenten: readonly Konsument[], lage: AuswertungsLage): Auswertung {
  const raus: Auswertung = { faellig: [], cursor: {}, wartend: 0, gestaut: 0 };
  const jetzt = lage.jetzt.getTime();
  const maxAlter = EREIGNIS_GRENZEN.hoechstalterStunden * 3_600_000;
  const entprellen = EREIGNIS_GRENZEN.entprellenMinuten * 60_000;
  const gestautAb = EREIGNIS_GRENZEN.gestautMinuten * 60_000;
  const sortiert = [...bestand.eintraege].sort((a, b) => a.nr - b.nr);
  const zaehler = new Map<string, number>();
  const zoeLaeuft = new Set(lage.auftraege.filter(a => a.name === 'zoe-aufgaben' && (a.status === 'offen' || a.status === 'laeuft') && a.person).map(a => a.person!));

  for (const k of konsumenten) {
    const alt = bestand.cursor[k.schluessel];
    const ab = alt?.nr ?? 0;
    const liste = sortiert.filter(e => e.nr > ab);
    const urteil = new Map<number, Urteil>();
    const offen: Ereignis[] = [];
    for (const e of liste) {
      const person = k.art === 'skill' ? k.person : e.person ?? null;
      if (!k.arten.includes(e.art) || (k.seit && e.am < k.seit)) { urteil.set(e.nr, 'erledigt'); continue; }
      if (k.art === 'skill' ? !ereignisSichtbar(e, k.betrachter) || !passtZumBereich(e, k.headBereich) : !person || !e.bezug.aufgabeId) { urteil.set(e.nr, 'erledigt'); continue; }
      if (schonEingereiht(k, e.id, lage.auftraege)) { urteil.set(e.nr, 'erledigt'); continue; }
      if (jetzt - Date.parse(e.am) > maxAlter || k.ruht || lage.instanz === 'aus' || (person && !lage.kiPerson(person))) { urteil.set(e.nr, 'verfallen'); continue; }
      offen.push(e);
    }
    // Entprellen: je Bezug zählt nur das jüngste offene Ereignis — die älteren sind von ihm überholt (es trägt sie mit).
    const juengstes = new Map<string, Ereignis>();
    for (const e of offen) juengstes.set(bezugSchluessel(e), e);
    for (const e of offen) {
      const key = bezugSchluessel(e);
      if (juengstes.get(key) !== e) { urteil.set(e.nr, 'erledigt'); continue; }
      const person = (k.art === 'skill' ? k.person : e.person)!;
      let w: Wartegrund | null = null;
      let business = k.headBereich === 'business';
      if (k.art === 'zoe-aufgaben') {
        const a = lage.zoeAufgabe(e.bezug.aufgabeId!);
        if (!a) { urteil.set(e.nr, 'erledigt'); continue; }
        business = a.business;
      }
      const frei = business ? lage.frei(person) : [];
      if (lage.instanz === 'unlesbar') w = 'unlesbar';
      else if (!lage.taktOffen(lage.jetztWand, frei)) w = lage.taktOffen(lage.jetztWand, []) ? 'business-frei' : 'ruhezeit';
      else if (k.art === 'skill' && lage.auftraege.some(a => a.name === 'faden' && a.eingabe?.skillId === k.skillId && a.eingabe?.bezugSchluessel === key && jetzt - Date.parse(a.zeit) < entprellen)) w = 'entprellt';
      else if (k.art === 'zoe-aufgaben' && zoeLaeuft.has(person)) w = 'laeuft';
      else {
        const kopf = k.art === 'skill' ? k.headId : ZOE;
        const n = zaehler.get(kopf) ?? lage.autoLaeufeHeute(kopf);
        if (n >= lage.hoechstzahl) w = 'hoechstzahl';
        else {
          zaehler.set(kopf, n + 1);
          if (k.art === 'zoe-aufgaben') zoeLaeuft.add(person);
          urteil.set(e.nr, 'faellig');
          raus.faellig.push({ konsument: k, ereignis: e, bezugSchluessel: key, person });
          continue;
        }
      }
      urteil.set(e.nr, 'wartet');
      raus.wartend++;
      if (!ZEITLICH.has(w) && jetzt - Date.parse(e.am) >= gestautAb) raus.gestaut++;
    }
    // Cursor: bis vor das erste Ereignis, das noch wartet oder fällig ist.
    let bis = ab;
    for (const e of liste) { const u = urteil.get(e.nr); if (u === 'wartet' || u === 'faellig') break; bis = e.nr; }
    if (bis !== ab || !alt) raus.cursor[k.schluessel] = { nr: bis, am: lage.jetzt.toISOString() };
    else raus.cursor[k.schluessel] = alt;
  }
  return raus;
}

/** Die Ereignisse, die eine Person sieht — für Leser außerhalb des Takts (Heads-Paket, Power Hour). Rein. */
export function ereignisseFuer(eintraege: readonly Ereignis[], b: Betrachter, opt: { seit?: string; arten?: readonly EreignisArt[]; bereich?: EreignisBereich } = {}): Ereignis[] {
  return eintraege.filter(e => (!opt.seit || e.am > opt.seit) && (!opt.arten || opt.arten.includes(e.art)) && (!opt.bereich || passtZumBereich(e, opt.bereich)) && ereignisSichtbar(e, b))
    .sort((a, x) => a.nr - x.nr);
}

/**
 * „Gerade geschrieben“ (Power Hour, Heads): Kontakte, von denen in den letzten `geradeStunden` eine Nachricht kam, die die Person sieht
 * (eigene Postfächer, geteilte WhatsApp-Nummer — nie fremde Postfächer). Rein.
 */
export function geradeGeschriebenAus(eintraege: readonly Ereignis[], b: Betrachter, jetzt: Date): Set<string> {
  const ab = new Date(jetzt.getTime() - EREIGNIS_GRENZEN.geradeStunden * 3_600_000).toISOString();
  return new Set(ereignisseFuer(eintraege, b, { seit: ab, arten: ['neue-mail', 'neue-whatsapp'] }).map(e => e.bezug.kontaktId).filter((x): x is string => !!x));
}

// ─── MAKE OS — Brain-Kugel: Modell, Sicht-Regel, Deckel, Wege (rein, 05.10.2026) ─
// Kevin (04.10., UMBAU_ABEND_0410.md 3): „Alles in MAKE OS als Datenpunkte“ — Kontakte, Firmen, Deals, Mandate, Aufgaben,
// Ziele/Meilensteine, Termine, Wissen/Notizen, Gesellschaften; eingefärbt nach Bereich, gruppiert, Größe/Helligkeit nach
// Aktualität; Zeiger zeigt Titel + Verbindungen, Klick öffnet den Datensatz. „Privat bleibt privat.“
//
// EINE reine Filterstelle (Plattform-Regel „Trennung serverseitig, nie nur versteckt“): Der Lader (kugel-server.ts) liest
// mit den vorhandenen Sicht-Funktionen und markiert je Punkt, ob er privat ist und wem er gehört; `kugelPunkteFuer`
// entscheidet für den Betrachter und gibt NUR Kennung, Art, Bereich, Titel (gekürzt), Datum und Verknüpfungs-Kennungen
// heraus — keine Inhalte, keine Notiztexte, keine Merkmale der Sicht-Regel. Gesundheitsdaten werden nie Punkte (Art. 9) —
// es gibt dafür keine Art. Wächter: tests/brain-kugel.test.ts.

import { WEG } from '@/lib/wege';

export const KUGEL_ARTEN = ['kontakt', 'firma', 'deal', 'mandat', 'aufgabe', 'ziel', 'meilenstein', 'termin', 'notiz', 'gesellschaft'] as const;
export type KugelArt = (typeof KUGEL_ARTEN)[number];
export const KUGEL_BEREICHE = ['markttraktion', 'planung', 'kalender', 'wissen', 'unternehmen'] as const;
export type KugelBereich = (typeof KUGEL_BEREICHE)[number];

/** Welcher Bereich (Cluster, Farbe) zu welcher Art gehört — eine Tabelle. */
export const ART_BEREICH: Record<KugelArt, KugelBereich> = {
  kontakt: 'markttraktion', firma: 'markttraktion', deal: 'markttraktion', mandat: 'markttraktion',
  aufgabe: 'planung', ziel: 'planung', meilenstein: 'planung',
  termin: 'kalender',
  notiz: 'wissen',
  gesellschaft: 'unternehmen',
};
export const ART_NAME: Record<KugelArt, { ein: string; viele: string }> = {
  kontakt: { ein: 'Kontakt', viele: 'Kontakte' }, firma: { ein: 'Firma', viele: 'Firmen' }, deal: { ein: 'Deal', viele: 'Deals' },
  mandat: { ein: 'Mandat', viele: 'Mandate' }, aufgabe: { ein: 'Aufgabe', viele: 'Aufgaben' }, ziel: { ein: 'Ziel', viele: 'Ziele' },
  meilenstein: { ein: 'Meilenstein', viele: 'Meilensteine' }, termin: { ein: 'Termin', viele: 'Termine' },
  notiz: { ein: 'Notiz', viele: 'Notizen' }, gesellschaft: { ein: 'Gesellschaft', viele: 'Gesellschaften' },
};
export const BEREICH_NAME: Record<KugelBereich, string> = {
  markttraktion: 'Markttraktion', planung: 'Ziele & Aufgaben', kalender: 'Kalender', wissen: 'Wissen', unternehmen: 'Unternehmen',
};

/** Ein Punkt, wie er die Route verlässt — mehr nicht. */
export interface BrainPunkt {
  /** `<art>:<kennung>` — eindeutig über alle Arten. */
  id: string;
  art: KugelArt;
  bereich: KugelBereich;
  /** Gekürzt (`TITEL_MAX`). */
  titel: string;
  /** Aktualität (letzte Änderung bzw. Termin), JJJJ-MM-TT oder null. */
  datum: string | null;
  /** Kennungen verknüpfter Punkte (nur solche, die der Betrachter auch bekommt). */
  links: string[];
}

/** Was der Lader liefert: dazu die Merkmale der Sicht-Regel — sie verlassen den Server nie. */
export interface RohPunkt {
  art: KugelArt;
  kennung: string;
  titel: string;
  datum?: string | null;
  /** Verknüpfungen als fertige Punkt-Kennungen (`punktId`). */
  links?: string[];
  /** Gehört in den Privat-Space (privater Kalender, Privat-Ziel, private Aufgabe, private Notiz …). */
  privat?: boolean;
  /** Gehört einer Person allein („nur ich“, eigenes Ziel, private Notiz): Speichername oder `beide`. */
  gehoert?: string;
}

/** Wer schaut: Person der Sitzung und ob die Rolle Privates sehen darf (`planZugangFuer(...).sicht === 'privat'`). */
export interface Betrachter { person: string; privat: boolean }

/** Höchstzahl der Punkte: darüber fallen die ÄLTESTEN weg (sie tragen am wenigsten zur Lage bei) — gemeldet als `gekuerzt`. */
export const PUNKTE_DECKEL = 3000;
export const TITEL_MAX = 80;
/** Höchstens so viele Verknüpfungen je Punkt (ein Kontakt mit 400 Aufgaben würde sonst die Kugel überziehen). */
export const LINKS_MAX = 24;

export const punktId = (art: KugelArt, kennung: string) => `${art}:${kennung}`;
export const kennungVon = (id: string) => id.slice(id.indexOf(':') + 1);
export const istKugelArt = (a: unknown): a is KugelArt => typeof a === 'string' && (KUGEL_ARTEN as readonly string[]).includes(a);

export function titelKurz(t: string): string {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return 'Ohne Titel';
  return s.length > TITEL_MAX ? `${s.slice(0, TITEL_MAX - 1).trimEnd()}…` : s;
}
const tagAus = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Darf der Betrachter diesen Rohpunkt sehen? (die eine Regel) */
export function darfPunktSehen(r: Pick<RohPunkt, 'privat' | 'gehoert'>, b: Betrachter): boolean {
  if (r.privat && !b.privat) return false;
  if (r.gehoert && r.gehoert !== 'beide' && r.gehoert !== b.person) return false;
  return true;
}

export interface KugelAntwort {
  punkte: BrainPunkt[];
  /** Wie viele Punkte wegen des Deckels nicht mitkamen (älteste zuerst). 0 = vollständig. */
  gekuerzt: number;
  deckel: number;
  jeArt: Record<KugelArt, number>;
}

/**
 * Die Sicht des Betrachters + Deckel: filtern → entdoppeln → nach Aktualität (neueste zuerst) → deckeln → Verknüpfungen
 * nur innerhalb der ausgelieferten Menge. Gibt nur die erlaubten Felder heraus.
 */
export function kugelPunkteFuer(roh: readonly RohPunkt[], b: Betrachter, deckel = PUNKTE_DECKEL): KugelAntwort {
  const gesehen = new Set<string>();
  const sichtbar: { p: BrainPunkt; roh: RohPunkt }[] = [];
  for (const r of roh) {
    if (!istKugelArt(r.art) || !r.kennung || !darfPunktSehen(r, b)) continue;
    const id = punktId(r.art, r.kennung);
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    sichtbar.push({ roh: r, p: { id, art: r.art, bereich: ART_BEREICH[r.art], titel: titelKurz(r.titel), datum: tagAus(r.datum), links: [] } });
  }
  // Neueste zuerst; ohne Datum ans Ende; bei Gleichstand fest nach Kennung (stabil zwischen zwei Abrufen).
  sichtbar.sort((x, y) => (y.p.datum ?? '').localeCompare(x.p.datum ?? '') || x.p.id.localeCompare(y.p.id));
  const behalten = sichtbar.slice(0, Math.max(0, deckel));
  const da = new Set(behalten.map(x => x.p.id));
  const jeArt = Object.fromEntries(KUGEL_ARTEN.map(a => [a, 0])) as Record<KugelArt, number>;
  const punkte = behalten.map(({ p, roh: r }) => {
    jeArt[p.art]++;
    const links = Array.from(new Set((r.links ?? []).filter(l => l !== p.id && da.has(l)))).slice(0, LINKS_MAX);
    return { ...p, links };
  });
  return { punkte, gekuerzt: sichtbar.length - behalten.length, deckel, jeArt };
}

/** Wohin ein Punkt führt — NUR über die WEG-Funktionen (lib/wege.ts), damit kein Punkt ins Leere zeigt. */
export function wegFuer(p: Pick<BrainPunkt, 'id' | 'art' | 'datum'>): string {
  const k = kennungVon(p.id);
  switch (p.art) {
    case 'kontakt': return WEG.akte(k);
    case 'firma': return WEG.firma(k);
    case 'deal': return WEG.deal(k);
    case 'mandat': return WEG.mandat(k);
    case 'aufgabe': return WEG.aufgabe(k);
    case 'ziel': return WEG.ziel(k);
    case 'meilenstein': return WEG.meilenstein(k);
    case 'termin': return WEG.termin(k, p.datum ?? undefined);
    case 'notiz': return WEG.notiz(k);
    case 'gesellschaft': return WEG.unternehmen(k);
  }
}

/** Nachbarn in beide Richtungen (die Route liefert je Punkt nur seine eigenen Verweise). */
export function nachbarn(punkte: readonly Pick<BrainPunkt, 'id' | 'links'>[]): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); };
  const da = new Set(punkte.map(p => p.id));
  for (const p of punkte) for (const l of p.links) if (da.has(l)) { add(p.id, l); add(l, p.id); }
  return new Map([...m].map(([k, v]) => [k, [...v]]));
}

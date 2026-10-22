'use client';

// ─── Fulfillment · Prozesse — Daten im Browser (Paket C1, 10.10.) ──────────────────────────────────────────────────────────────────────
// Lesen nur über die Routen (GET /api/fulfillment, /api/fulfillment/fall?m=, /api/fulfillment/cockpit); Schreiben nur als Einzel-Ops mit Stand
// (PATCH), Antworten werden nie geraten — nach jedem Schreiben lädt die Ansicht neu (Ereignis `make-fulfillment-geaendert`). Fehler bleiben als
// Satz sichtbar (Hinweis-Karte), nichts wird still verworfen.

import { tagVon } from '@/lib/zeit';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Baustein, Fall, FallKnoten, FallKurz, Freigabepunkt, KundeKurz, ProzessKnoten, ProzessVorlage, RitualVorlage, Rolle, Stakeholder, Entscheidung, Unterschrift, WartetPunkt, WertKontoZeile, FulfillmentEinstellungen, OnboardingKandidat, KnotenStatus } from '@/lib/fulfillment/typen';
import type { OnboardingStand, WillkommenUhr } from '@/lib/fulfillment/prozesse/onboarding';
import type { VorlagenDiff } from '@/lib/fulfillment/prozesse/fall';
import type { FfKennzahl } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { CockpitZeile, Haenger } from '@/lib/fulfillment/prozesse/cockpit';
import type { HeuteDeal } from '@/lib/fulfillment/prozesse/heute';
import type { MusterWahl } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import type { Mandat } from '@/lib/crm/typen';
import type { NachsorgePunkt } from '@/lib/fulfillment/prozesse/ansichten';
import { abstimmungsNummern, ohneKuerzel } from '@/lib/fulfillment/prozesse/darstellung';
import type { AblaufKnotenStand } from '@/lib/fulfillment/prozesse/ausfuehrung';

export const EREIGNIS = 'make-fulfillment-geaendert';
export const geaendert = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EREIGNIS)); };
export const neueAnfrageId = () => `ff-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

export type MitStand<T> = T & { stand: string };
export type BausteinKurz = MitStand<Omit<Baustein, 'text' | 'fragen' | 'gliederung'>> & { gliederungAnzahl: number; fragenAnzahl: number; nurIntern: boolean; rechtOffen: boolean; vorVerkaufOffen: boolean; steckt: number; /** läuft im Onboarding jedes Falls (Playbook, Willkommensmail) */ imOnboarding?: boolean };
export type VorlageMitStand = MitStand<Omit<ProzessVorlage, 'knoten'>> & { knoten: MitStand<ProzessKnoten>[] };
export interface Kandidat extends OnboardingKandidat { uhr: WillkommenUhr; vorlage?: { id: string; titel: string }; vorgeschlagen: boolean }
export interface FallZeile extends FallKurz { vorlageId: string; kunde: string; titel: string; /** Angehängte Zusatzmodule (Kennungen ihrer Vorlagen, 17.10. spät). */ zusaetze?: string[] }
export interface Uebersicht {
  inhaber: boolean;
  /** Darf Abläufe bearbeiten (volle Mitglieder; Rolle „nur Business“ sieht nur — Prozess-Editor, 17.10.). */
  darfBearbeiten?: boolean;
  prozesse: VorlageMitStand[];
  bausteine: BausteinKurz[];
  rituale: MitStand<RitualVorlage>[];
  zuordnung: Record<string, { vorlageId: string }>;
  einstellungen: FulfillmentEinstellungen;
  importLaeufe: { id: string; am: string; von: string; datei: string; neu: number; geaendert: number }[];
  musterOffen: MusterWahl[];
  kandidaten: Kandidat[];
  faelle: Record<string, FallZeile>;
  zaehler: Record<string, Record<string, string[]>>;
  mandate: Record<string, { kunde: string; titel: string; leistungId: string | null; status: string }>;
  kennzahlen: FfKennzahl[];
  leistungen: { id: string; name: string; status: string }[];
  /** E4 (22.10.): Pakete, die in der Werkstatt bearbeitet werden (`paketBearbeitenLink`). */
  werkstatt?: string[];
}
export interface UebersichtKurz {
  kandidaten: Kandidat[]; zuordnung: Record<string, { vorlageId: string }>; faelle: Record<string, FallZeile>; prozesse: { id: string; titel: string; art: string; zusatz?: true }[];
  /** Gewonnene Deals (Business) ohne Mandat — für „Heute im Fulfillment“ (17.10. spät). */
  deals?: HeuteDeal[];
  /** E4 (22.10.): Pakete, die in der Werkstatt bearbeitet werden. */
  werkstatt?: string[];
}

export interface MandatKurz { id: string; titel: string; kunde: string; firmaId: string | null; kontaktIds: string[]; leistungId: string | null; ziele: Mandat['ziele']; gesellschaft: string; status: string; start: string | null; zustaendig: string | null; business: boolean;
  /** Zusatzmodule am Mandat (19.10., P3): Produkt und Beginn — für den Vorschlag „Zusatzmodul anhängen“. */
  zusatz?: { leistungId: string; ab?: string }[] }
export interface FallAntwort {
  inhaber: boolean;
  mandat: MandatKurz;
  unterschrift: Unterschrift | null;
  fall: (Omit<Fall, 'knoten' | 'stakeholder' | 'entscheidungen'> & { knoten: MitStand<FallKnoten>[]; stakeholder: MitStand<Stakeholder>[]; entscheidungen: MitStand<Entscheidung>[] }) | null;
  staende?: { vereinbarung: string; wertKonto: Record<string, string> };
  onboarding?: OnboardingStand;
  diff?: VorlagenDiff | null;
  /** Alter Fall ohne Formen, die Vorlage hat welche: die Ausführung startet erst mit „Vorlage übernehmen“ (17.10. abends, `ausfuehrungNachUebernahme`). */
  ausfuehrungWartet?: boolean;
  vorlage?: { id: string; titel: string; fassung: number; freigaben: Freigabepunkt[]; rollen: Rolle[]; zusatz?: true };
  wartet?: WartetPunkt[];
  wertKonto?: WertKontoZeile[];
  fortschritt?: number;
  aktuell?: { phase: FallKnoten | null; schritt: FallKnoten | null };
  bausteine?: { id: string; titel: string; art: string; kundeFuellt: boolean; nurIntern: boolean; rechtOffen: boolean; vorVerkaufOffen: boolean; lieferobjekt: string | null }[];
  personen?: { id: string; name: string; position: string | null; email: string | null; firmaId: string | null }[];
  rituale?: RitualVorlage[];
  termine?: Record<string, string | null>;
  /** Alle Termine mit dem Kunden ab dem Montag dieser Woche (Bezug zum Mandat bzw. zur Firma) — je mit Ritual, wenn er an einem hängt (15.10.). */
  kalender?: { uid: string; tag: string; von?: string; titel?: string; ritualId?: string }[];
  /** Was der Kunde auf seiner Seite als Nächstes liest (`kundenTeile`) — der Fall-Kopf nennt es, wenn es vom internen Punkt abweicht. */
  kundeNaechster?: { text: string | null; gleich: boolean; wartet: boolean };
  kunde?: KundeKurz | null;
  report?: { erstelltAm?: string; gesendetAm?: string } | null;
  /** Erstellte Fortschritts-Reports (Kennung + Zeit) — die Report-Zeitachse (12.10.). */
  reports?: { id: string; am: string }[];
  /** Follow-ups am Mandat (Nachsorge, Puls-Gespräch, Empfehlung) — Text, Tag, Stand. */
  followups?: { id: string; text: string; faellig: string; status: string }[];
  /** Was aus der Diagnose (Dossier, nach F2) noch nicht im Fall steht. */
  analyse?: { f2: boolean; diagnose: boolean; quickWins: string[]; fragen: number; massnahmen: string[]; ziel: string | null } | null;
  /** Die Nachsorge als Plan ab Mandatsende. */
  nachsorge?: { ende: string | null; plan: NachsorgePunkt[] };
  /** Ausführung der Abläufe (17.10. abends): Stand je Knoten mit Form — dran, Runde, Frist, Aufgabe und ihr Stand. */
  ablauf?: { aktiv: boolean; knoten: Record<string, AblaufKnotenStand & { aufgabeStatus?: string }> };
  /** Angehängte Zusatzmodule (17.10. spät): Titel, Starttag, Fassung im Fall und — bei neuer Fassung — der Diff. */
  zusaetze?: { vorlageId: string; titel: string; startAm: string; fassung: number; diff: VorlagenDiff | null }[];
}
export interface CockpitAntwort { heute: string; zeilen: CockpitZeile[]; haengt: Haenger[]; kapa: { stundenWoche: number; frei: number | null; ueber: boolean } | null }
export type { KnotenStatus };

export interface Antwort<T> { ok: boolean; status: number; j: T & { ok?: boolean; fehler?: string; error?: string; konflikte?: { id: string; stand: string }[] } }

export async function holeJson<T>(url: string, init?: RequestInit): Promise<Antwort<T>> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, ...(init?.body ? { headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } } : {}) });
    const j = await r.json().catch(() => ({})) as Antwort<T>['j'];
    return { ok: r.ok && j.ok !== false, status: r.status, j };
  } catch { return { ok: false, status: 0, j: { fehler: 'Keine Verbindung — bitte noch einmal.' } as Antwort<T>['j'] }; }
}
export const fehlerText = (a: Antwort<unknown>) => a.j.fehler ?? a.j.error ?? (a.status === 409 ? 'Inzwischen geändert — bitte neu laden.' : 'Nicht gespeichert.');

/** Einen Bestand lesen und bei `make-fulfillment-geaendert` neu laden. */
function useLaden<T>(url: string | null) {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const lauf = useRef(0);
  const laden = useCallback(async () => {
    if (!url) return;
    const n = ++lauf.current;
    const a = await holeJson<T>(url);
    if (n !== lauf.current) return;
    if (a.ok) { setDaten(a.j as T); setFehler(null); } else setFehler(fehlerText(a));
  }, [url]);
  useEffect(() => {
    void laden();
    const neu = () => { void laden(); };
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, [laden]);
  return { daten, fehler, laden };
}

export const useUebersicht = () => useLaden<Uebersicht>('/api/fulfillment');
/** `an: false` lädt nichts (17.10., Tempo B2: der Deal-Einhänger fragt nur bei gewonnenen Deals). */
export const useUebersichtKurz = (an = true) => useLaden<UebersichtKurz>(an ? '/api/fulfillment?nur=kurz' : null);
export const useFall = (mandatId: string) => useLaden<FallAntwort>(`/api/fulfillment/fall?m=${encodeURIComponent(mandatId)}`);
export const useCockpit = () => useLaden<CockpitAntwort>('/api/fulfillment/cockpit');

/**
 * Texte ohne Freigabe-Kürzel (F0–F7) für die Anzeige im Fall — „Abstimmungspunkt n („Titel“)“ mit den Nummern des Ablaufs dieses Falls (15.10., Abnahme B5).
 * Liest dieselbe Antwort wie die Reiter (`useFall`, der Anfrage-Bündler teilt sie).
 */
export function useOhneKuerzel(mandatId: string): (t: string) => string {
  const { daten } = useFall(mandatId);
  const nummern = abstimmungsNummern(daten?.fall?.knoten ?? []);
  const freigaben = daten?.vorlage?.freigaben ?? [];
  return (t: string) => ohneKuerzel(t, nummern, freigaben);
}

/** Vorlagen-Ops (PATCH /api/fulfillment) — bei Erfolg laden alle Ansichten neu. */
export async function vorlagenOps(ops: Record<string, unknown>[]): Promise<Antwort<{ geaendert?: string[] }>> {
  const a = await holeJson<{ geaendert?: string[] }>('/api/fulfillment', { method: 'PATCH', body: JSON.stringify({ ops }) });
  if (a.ok) geaendert();
  return a;
}
/** Fall-Ops (PATCH /api/fulfillment/fall). */
export async function fallOps(mandatId: string, ops: Record<string, unknown>[]): Promise<Antwort<{ nachzug?: { phase?: string; lieferobjekte?: number; ziele?: number; fehler?: string } }>> {
  const a = await holeJson<{ nachzug?: { phase?: string; lieferobjekte?: number; ziele?: number; fehler?: string } }>('/api/fulfillment/fall', { method: 'PATCH', body: JSON.stringify({ mandatId, ops }) });
  if (a.ok) geaendert();
  return a;
}
/** Aktionen am Fall (POST /api/fulfillment/fall). */
export async function fallAktion(body: Record<string, unknown>): Promise<Antwort<Record<string, unknown>>> {
  const a = await holeJson<Record<string, unknown>>('/api/fulfillment/fall', { method: 'POST', body: JSON.stringify(body) });
  if (a.ok) geaendert();
  return a;
}

export const STATUS_TEXT: Record<KnotenStatus, string> = { offen: 'offen', in_arbeit: 'in Arbeit', wartet_kunde: 'wartet auf Kunde', erledigt: 'erledigt', entfaellt: 'entfällt' };
// Ein Zeitstempel (ISO mit Uhrzeit) zählt als Berliner Tag (17.10., Gesamtprüfung L1 B2 — vorher der UTC-Tag: „bis 17.10.“ neben „bis 18.10.“).
const berlinTag = (t: string) => (t.length > 10 && t.includes('T') ? tagVon(t) : t);
export const tagKurz = (t?: string | null) => { const x = t ? berlinTag(t) : t; return x && /^\d{4}-\d{2}-\d{2}/.test(x) ? `${x.slice(8, 10)}.${x.slice(5, 7)}.` : '—'; };
export const tagLang = (t?: string | null) => { const x = t ? berlinTag(t) : t; return x && /^\d{4}-\d{2}-\d{2}/.test(x) ? `${x.slice(8, 10)}.${x.slice(5, 7)}.${x.slice(0, 4)}` : '—'; };

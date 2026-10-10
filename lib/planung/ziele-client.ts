'use client';

// ─── MAKE OS — Ziele & Meilensteine im Browser lesen: EIN Zwischenspeicher (Review 03.10.) ─
// Vorher holten drei Bausteine dieselben Planungsdaten je mit eigenem Speicher (Ziel-Chip, Ziel-Bezug, Meilenstein-Verweis —
// einer davon ohne `r.ok`-Prüfung). Jetzt: EINE Ladung je 30 Sekunden für alle Chips einer Seite, nur lesend.
//   · Ziele aller Horizonte des gemeinsamen Bestands, je mit `horizont` und der Farbe vom Server (`farbe`,
//     lib/planung/ziel-farben-server.ts) — der Browser rechnet keine Ziel-Farbe selbst.
//   · Meilensteine (gemeinsamer Bestand).
// Fehler (offline, 401, 500) ergeben leere Listen — und werden nicht gemerkt, der nächste Aufruf versucht es neu.
// Seit 09.10. (Kevin: „zusammen unsere Ziele — und jeder für sich … irgendwie müssen wir das Ganze ja sehen“) auch die Spalten
// „Unsere · Meine · <Name>“ (nur lesen, z. B. für Heute): `usePlanPersonen` (wer bin ich, wer sind die Partner — Namen aus den Konten)
// und `useZieleSpalten(horizont)` (gemeinsam, eigen, je Partner NUR das Geteilte — gefiltert vom Server). Geschrieben wird weiter nur über
// usePlanung (components/os/planung/usePlanung.ts, `fuer: 'ich'`).

import { useEffect, useState } from 'react';
import { zielJahr } from './zeitstrahl';
import { wirksamerSpace } from './bereich';
import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZielHorizont } from './typen';

/** Ein Ziel, wie der Browser es liest: mit Horizont und der Farbe vom Server. */
export type ZielMitFarbe = Ziel & { horizont: ZielHorizont; farbe: string };
export interface ZieleUndMeilensteine { ziele: ZielMitFarbe[]; meilensteine: Meilenstein[] }

const MERKEN_MS = 30_000;
let ladung: { zeit: number; wert: Promise<ZieleUndMeilensteine> } | null = null;

const holeJson = (pfad: string): Promise<Record<string, unknown> | null> =>
  fetch(pfad, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);

/** Aus der Antwort von GET /api/state/ziele: alle Ziele mit Horizont (jedes nur einmal, nur mit Farbe vom Server). */
export function zieleAusAntwort(d: Record<string, unknown> | null): ZielMitFarbe[] {
  const aus: ZielMitFarbe[] = [];
  const gesehen = new Set<string>();
  for (const horizont of ZIEL_HORIZONTE) {
    const l = d?.[horizont];
    if (!Array.isArray(l)) continue;
    for (const z of l as Partial<ZielMitFarbe>[]) {
      if (!z || typeof z.id !== 'string' || typeof z.farbe !== 'string' || gesehen.has(z.id)) continue;
      gesehen.add(z.id);
      aus.push({ ...(z as Ziel), horizont, farbe: z.farbe });
    }
  }
  return aus;
}

/** Ziele und Meilensteine — einmal je halbe Minute für alle Bausteine der Seite (`neu` = frisch holen). */
export function zieleUndMeilensteineHolen(neu = false): Promise<ZieleUndMeilensteine> {
  if (!neu && ladung && Date.now() - ladung.zeit < MERKEN_MS) return ladung.wert;
  const wert = Promise.all([holeJson('/api/state/ziele'), holeJson('/api/state/meilensteine')]).then(([z, m]) => {
    if ((!z || !m) && ladung?.wert === wert) ladung = null; // ein Fehler wird nicht gemerkt
    return { ziele: zieleAusAntwort(z), meilensteine: Array.isArray(m?.meilensteine) ? (m!.meilensteine as Meilenstein[]) : [] };
  });
  ladung = { zeit: Date.now(), wert };
  return wert;
}

/** Hook: die Planungsdaten (null, solange sie laden). Mit `aktiv = false` wird nichts geladen. */
export function useZieleUndMeilensteine(aktiv = true): ZieleUndMeilensteine | null {
  const [daten, setDaten] = useState<ZieleUndMeilensteine | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    void zieleUndMeilensteineHolen().then(d => { if (lebt) setDaten(d); });
    return () => { lebt = false; };
  }, [aktiv]);
  return daten;
}

// ── Unsere · Meine · <Name> (09.10.) ──────────────────────────────────────────────────────────────────────────────────────

/** Eine Person für die Spalten: Speichername + Vorname (aus dem Konto). */
export interface PlanPerson { speicher: string; vorname: string }
export interface PlanPersonen { ich: PlanPerson | null; partner: PlanPerson[] }

const vornameVon = (k: { speicher: string; name?: string }) => (k.name ?? '').trim().split(/\s+/)[0] || k.speicher;
let personenLadung: Promise<PlanPersonen> | null = null;

/** Wer bin ich, wer sind die Partner (andere volle Mitglieder des Haushalts, Feld `partner` aus /api/konto/ich) — einmal je Seite. */
export function planPersonenHolen(): Promise<PlanPersonen> {
  if (!personenLadung) {
    const wert: Promise<PlanPersonen> = holeJson('/api/konto/ich').then(d => {
      const ich = (d?.ich ?? null) as { speicher?: string; name?: string } | null;
      const andere = Array.isArray(d?.andere) ? (d!.andere as { speicher: string; name?: string; partner?: boolean }[]) : [];
      if (!d && personenLadung === wert) personenLadung = null; // ein Fehler wird nicht gemerkt
      return {
        ich: ich?.speicher ? { speicher: ich.speicher, vorname: vornameVon({ speicher: ich.speicher, name: ich.name }) } : null,
        partner: andere.filter(a => a.partner === true && typeof a.speicher === 'string').map(a => ({ speicher: a.speicher, vorname: vornameVon(a) })),
      };
    });
    personenLadung = wert;
  }
  return personenLadung;
}

/** Hook: ich + Partner (null, solange es lädt). */
export function usePlanPersonen(): PlanPersonen | null {
  const [p, setP] = useState<PlanPersonen | null>(null);
  useEffect(() => { let lebt = true; void planPersonenHolen().then(x => { if (lebt) setP(x); }); return () => { lebt = false; }; }, []);
  return p;
}

/** Die Ziele einer Spalte für einen Horizont (im Jahr nur das laufende Planungsjahr), ohne Archiv. */
export function spaltenZiele<Z extends Ziel>(liste: readonly Z[] | undefined, horizont: ZielHorizont, laufend: number, nurPrivat = false): Z[] {
  return (liste ?? []).filter(z => !z.archiviertAm && (horizont !== 'jahr' || zielJahr(z, laufend) === laufend) && (!nurPrivat || wirksamerSpace(z) !== 'business'));
}

export interface ZieleSpalten {
  personen: PlanPersonen;
  /** Gemeinsam (Privat + ohne Bereich). */
  unsere: Ziel[];
  meine: Ziel[];
  partner: { person: PlanPerson; ziele: Ziel[]; nichtGeteilt: boolean }[];
}

/**
 * Hook (nur lesen): die drei Spalten eines Horizonts — Partner NUR mit dem, was der Server ausliefert (einzeln geteilt bzw. alles).
 * `bereich` (10.10., Sicht Privat · Business): ALLE drei Spalten nur aus diesem Bereich — der Server filtert (`?space=`); vorher war nur
 * „Unsere“ auf Privat begrenzt, „Meine“ und die geteilten Ziele zeigten auch Business-Ziele.
 */
export function useZieleSpalten(horizont: ZielHorizont, laufend: number, aktiv = true, bereich: 'privat' | 'business' = 'privat'): ZieleSpalten | null {
  const [d, setD] = useState<ZieleSpalten | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    void (async () => {
      const personen = await planPersonenHolen();
      const sp = `space=${bereich}`;
      const [wir, ich, ...andere] = await Promise.all([
        holeJson(`/api/state/ziele?${sp}`), holeJson(`/api/state/ziele?fuer=ich&${sp}`),
        ...personen.partner.map(p => fetch(`/api/state/ziele?fuer=${encodeURIComponent(p.speicher)}&${sp}`, { cache: 'no-store' }).then(r => r.json().catch(() => null)).catch(() => null) as Promise<Record<string, unknown> | null>),
      ]);
      const liste = (x: Record<string, unknown> | null) => (Array.isArray(x?.[horizont]) ? (x![horizont] as Ziel[]) : []);
      if (!lebt) return;
      setD({
        personen,
        unsere: spaltenZiele(liste(wir), horizont, laufend, bereich === 'privat'),
        meine: spaltenZiele(liste(ich), horizont, laufend),
        partner: personen.partner.map((person, k) => ({ person, ziele: spaltenZiele(liste(andere[k]), horizont, laufend), nichtGeteilt: andere[k]?.geteilt === false })),
      });
    })();
    return () => { lebt = false; };
  }, [horizont, laufend, aktiv, bereich]);
  return d;
}

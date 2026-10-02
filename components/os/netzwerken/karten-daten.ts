'use client';
// ─── Netzwerken · Meine Visitenkarten — Daten im Browser (02.10., Paket B) ──────
// Lädt GET /api/netzwerken/karten und schreibt über PATCH (Einzeländerungen mit Stand: bei 409 liegt der aktuelle
// Stand schon in der Sicht, die Person bekommt einen Satz). Merkt für unterwegs ein Offline-Abbild der eigenen Profile
// (localStorage `make-karten-cache`) — der QR-Code soll auch im Funkloch auf einer Messe erscheinen. Das Abbild sind
// nur die EIGENEN Profile; Abmelden räumt es weg (`karteCacheLeeren`, KontoView). Ohne Speicher (privater Modus) läuft
// alles weiter, nur ohne Offline-Abbild. Die Auswahl „Unterwegs für“ merkt sich pro Gerät (`make-karte-aktiv`).

import { useCallback, useEffect, useState } from 'react';
import { nachRang, type KarteMitStand, type Visitenkarte } from '@/lib/netzwerken/karte';

export const CACHE_KEY = 'make-karten-cache';
export const AKTIV_KEY = 'make-karte-aktiv';

export interface Gesellschaftsvorschlag { id: string; firma: string; strasse: string; plz: string; ort: string; land: string; web: string; telefon: string; email: string }
export interface KartenZustand {
  geladen: boolean;
  /** Offline-Abbild statt Serverstand (Funkloch) — Bearbeiten ist dann gesperrt. */
  offline: boolean;
  fehler: string | null;
  karten: KarteMitStand[];
  gesellschaften: Gesellschaftsvorschlag[];
  konto: { name: string; email: string } | null;
  /** Wessen Profile gerade gezeigt werden (Kennung der Person) — bei „für andere“ nicht die eigene. */
  person: string | null;
  fuerAndere: boolean;
  /** Nur für die Inhaberin/den Inhaber: Personen des Haushalts, für die Profile anlegbar sind. */
  personen: { person: string; name: string; ich: boolean }[];
}
const LEER: KartenZustand = { geladen: false, offline: false, fehler: null, karten: [], gesellschaften: [], konto: null, person: null, fuerAndere: false, personen: [] };

export type KartenOp = { op: 'upsert'; eintrag: Visitenkarte; stand?: string } | { op: 'teil'; id: string; felder: Partial<Visitenkarte>; stand?: string } | { op: 'delete'; id: string; stand?: string };

/** Das Offline-Abbild räumen (beim Abmelden). */
export function karteCacheLeeren(): void {
  try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(AKTIV_KEY); } catch { /* ohne Speicher nichts zu tun */ }
}

function cacheLesen(): KarteMitStand[] | null {
  try {
    const roh = localStorage.getItem(CACHE_KEY);
    const d = roh ? (JSON.parse(roh) as { karten?: KarteMitStand[] }) : null;
    return d && Array.isArray(d.karten) && d.karten.length ? d.karten : null;
  } catch { return null; }
}
function cacheSchreiben(karten: KarteMitStand[]): void {
  const am = new Date().toISOString();
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ karten, am })); return; } catch { /* zu groß (Logos)? */ }
  // Der Speicher des Browsers ist klein: dann das Abbild ohne Logos — Name und QR zählen unterwegs.
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ karten: karten.map(({ logo: _l, ...rest }) => rest), am })); } catch { /* ohne Abbild */ }
}

interface Antwort { ok?: boolean; person?: string; fuerAndere?: boolean; personen?: KartenZustand['personen']; fehler?: string; neuLaden?: boolean; karten?: KarteMitStand[]; gesellschaften?: Gesellschaftsvorschlag[]; konto?: { name: string; email: string } | null; konflikte?: unknown[] }

/** `fuer`: Kennung einer anderen Person des Haushalts (nur Inhaber) — dann keine Offline-Abbilder (die gehören der eigenen Person). */
export function useKarten(fuer: string | null = null) {
  const [z, setZ] = useState<KartenZustand>(LEER);
  const url = `/api/netzwerken/karten${fuer ? `?fuer=${encodeURIComponent(fuer)}` : ''}`;

  const uebernehmen = useCallback((d: Antwort) => {
    const karten = Array.isArray(d.karten) ? nachRang(d.karten) : [];
    if (!d.fuerAndere) cacheSchreiben(karten);
    setZ({ geladen: true, offline: false, fehler: null, karten, gesellschaften: d.gesellschaften ?? [], konto: d.konto ?? null, person: d.person ?? null, fuerAndere: !!d.fuerAndere, personen: d.personen ?? [] });
  }, []);

  const laden = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const d = (await r.json().catch(() => ({}))) as Antwort;
      if (r.ok && d.ok) { uebernehmen(d); return; }
      // 403/401 sind eine echte Antwort — kein Funkloch, also kein Abbild zeigen.
      setZ(s => ({ ...s, geladen: true, fehler: d.fehler ?? 'Die Visitenkarten konnten nicht geladen werden.' }));
    } catch {
      const abbild = fuer ? null : cacheLesen();
      setZ(s => ({ ...s, geladen: true, offline: !!abbild, karten: abbild ?? s.karten, fehler: abbild ? null : 'Keine Verbindung — und noch kein Offline-Abbild auf diesem Gerät.' }));
    }
  }, [uebernehmen, url, fuer]);

  useEffect(() => { setZ(s => ({ ...LEER, personen: s.personen })); void laden(); }, [laden]);

  /** Änderungen senden. `{ ok }` oder `{ ok: false, fehler }`; bei 409 steht der aktuelle Stand schon in der Sicht. */
  const schreiben = useCallback(async (ops: KartenOp[]): Promise<{ ok: boolean; fehler?: string }> => {
    try {
      const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) });
      const d = (await r.json().catch(() => ({}))) as Antwort;
      if (Array.isArray(d.karten)) uebernehmen(d);
      if (r.ok && d.ok) return { ok: true };
      if (r.status === 409 && d.konflikte) return { ok: false, fehler: 'Das Profil wurde inzwischen auf einem anderen Gerät geändert — der aktuelle Stand ist geladen. Bitte noch einmal.' };
      return { ok: false, fehler: d.fehler ?? 'Nicht gespeichert.' };
    } catch { return { ok: false, fehler: 'Nicht gespeichert — keine Verbindung.' }; }
  }, [uebernehmen, url]);

  return { ...z, laden, schreiben };
}

/** Die gemerkte Auswahl „Unterwegs für“ (pro Gerät). */
export function aktivLesen(): string | null { try { return localStorage.getItem(AKTIV_KEY); } catch { return null; } }
export function aktivMerken(id: string): void { try { localStorage.setItem(AKTIV_KEY, id); } catch { /* egal */ } }

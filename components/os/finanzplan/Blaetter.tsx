'use client';

// ─── Finanzplanung jetzt — die Blätter (08.10. abends, Fragebogen Teil 3 Frage 10) ───
// Kevin: „Vorschlag so übernehmen · MAKE und KD Ventures zusammen als ‚Gesellschaften‘ · Wochen-Check bleibt eigenes Blatt“.
// Ein Blatt = optional ein Kopf (immer offen, z. B. der Baukasten unter Planen) + seine Abschnitte zum Auf- und Zuklappen (lib/finanzen/plan/hilfen.ts
// › ABSCHNITTE). Die Bausteine sind die früheren Blätter, unverändert — hier wird nur zusammengestellt, nichts gerechnet.
// - Zugeklappt wird ein Abschnitt nicht gerendert (Handy, Rechenlast). Offen: gemerkt im Browser, sonst die Vorgabe des Abschnitts.
// - Sprung per Anker (#buchungen): beim Öffnen des Blatts aus der Adresse, danach über `anker` aus dem Kontext (geh, alte Adresse, hashchange).
// - Private Abschnitte (Budget, Entwicklung, Geldfluss) rendert die Business-Sicht gar nicht (`abschnitteFuer`) — der Server liefert dort ohnehin kein Privat.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Klappbar } from '../ui';
import { abschnitteFuer, offeneBuchungen, faelligeZahl, type AbschnittDef, type AbschnittId, type Unterseite } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { Lage, Check, LageBusiness } from './Ueberblick';
import { Privat, UG, Toepfe, KDV, Selbst, Szenarien, Ziele } from './Planen';
import { Budget, Buchungen } from './Monat';
import { Schulden, ZuErledigen, Kalender } from './Verpflichtungen';
import { Entwicklung, Geldfluss, Protokoll } from './Auswerten';
import { Baukasten } from './Baukasten';
import { Gesamt } from './Gesamt';

/** Inhalt je Abschnitt — die früheren Blätter. */
export const ABSCHNITT_INHALT: Record<AbschnittId, () => JSX.Element> = {
  ziele: Ziele, budget: Budget, buchungen: Buchungen, ug: UG, toepfe: Toepfe, kdv: KDV,
  entwicklung: Entwicklung, geldfluss: Geldfluss, posten: ZuErledigen, kalender: Kalender, schulden: Schulden, protokoll: Protokoll,
};
/** Kopf je Blatt (immer offen, über den Abschnitten). Die Lage wählt je Sicht (Privat bzw. Business). */
export const BLATT_KOPF: Partial<Record<Unterseite, () => JSX.Element>> = {
  check: Check, planen: Baukasten, privat: Privat, selbst: Selbst, gesamt: Gesamt, szenarien: Szenarien,
};

/** Offen-Zustand der Abschnitte — im Browser gemerkt (nur Bequemlichkeit; ohne Speicher gilt die Vorgabe). */
const MERKER = 'make-fp-abschnitte';
function useAbschnittOffen() {
  const [merk, setMerk] = useState<Partial<Record<AbschnittId, boolean>>>({});
  useEffect(() => {
    try { const m = JSON.parse(localStorage.getItem(MERKER) ?? 'null'); if (m && typeof m === 'object') setMerk(m as Partial<Record<AbschnittId, boolean>>); } catch { /* ohne Speicher: Vorgabe */ }
  }, []);
  // Speichern im Effekt, nie im setState-Updater (StrictMode führt Updater doppelt aus). Erst nach einer eigenen Änderung — das Laden oben
  // schreibt so nie eine leere Vorgabe über den gemerkten Stand.
  const geaendert = useRef(false);
  const setze = useCallback((id: AbschnittId, offen: boolean) => {
    geaendert.current = true;
    setMerk(m => ({ ...m, [id]: offen }));
  }, []);
  useEffect(() => {
    if (!geaendert.current) return;
    try { localStorage.setItem(MERKER, JSON.stringify(merk)); } catch { /* egal */ }
  }, [merk]);
  return { merk, setze };
}

/**
 * Zurück/Vor im Browser: dann stellt components/os/Verlauf.tsx die gemerkte Scrollposition wieder her — der Anker öffnet den Abschnitt nur,
 * holt ihn aber nicht zusätzlich ins Bild (sonst sprünge die Seite von der alten Stelle weg).
 */
let zuletztZurueck = 0;
let zurueckHorcht = false;
function horcheZurueck() {
  if (zurueckHorcht || typeof window === 'undefined') return;
  zurueckHorcht = true;
  window.addEventListener('popstate', () => { zuletztZurueck = Date.now(); });
}

/** Den Abschnitt ins Bild holen (nach dem Aufklappen, wenn der Inhalt steht). */
function zeige(id: AbschnittId) {
  return window.setTimeout(() => {
    const ruhig = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
  }, 60);
}

/**
 * Ein Blatt der Finanzplanung. `alleOffen`: jeden Abschnitt zeigen (Tests, Druck) — sonst gemerkt bzw. Vorgabe.
 */
export function BlattSeite({ u, alleOffen }: { u: Unterseite; alleOffen?: boolean }) {
  const { d, sicht, bereich, params, anker } = usePlan();
  const s = sicht === 'business' ? 'business' : 'privat';
  const liste = abschnitteFuer(u, s);
  const { merk, setze } = useAbschnittOffen();
  const offen = (a: AbschnittDef) => !!alleOffen || (merk[a.id] ?? !!a.offen);

  // Anker aus der Adresse beim Öffnen des Blatts (Lesezeichen, Link „…#kalender“) — nach Zurück/Vor nur aufklappen.
  useEffect(() => {
    horcheZurueck();
    const h = window.location.hash.slice(1);
    const a = liste.find(x => x.id === h);
    if (!a) return;
    setze(a.id, true);
    if (Date.now() - zuletztZurueck < 1000) return;
    const t = zeige(a.id);
    return () => window.clearTimeout(t);
    // Nur beim Öffnen des Blatts — spätere Sprünge kommen über `anker`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Sprung innerhalb der Finanzplanung (geh, alte Adresse, hashchange — nach Zurück/Vor nur aufklappen).
  useEffect(() => {
    if (!anker || !liste.some(x => x.id === anker.id)) return;
    setze(anker.id, true);
    if (Date.now() - zuletztZurueck < 1000) return;
    const t = zeige(anker.id);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anker?.n]);

  const Kopf = u === 'lage' ? (bereich === 'business' || s === 'business' ? LageBusiness : Lage) : BLATT_KOPF[u];
  const zaehler: Partial<Record<AbschnittId, number>> = { buchungen: offeneBuchungen(d), posten: faelligeZahl(d) };
  return (
    <>
      {Kopf && <Kopf />}
      {liste.map(a => {
        const Inhalt = ABSCHNITT_INHALT[a.id];
        const auf = offen(a);
        // Ist-Buchungen lesen Monat und Zeile nur beim Aufbau — ein Sprung aus dem Budget auf derselben Seite baut sie neu auf.
        const schluessel = a.id === 'buchungen' ? `${params.get('monat') ?? ''}|${params.get('zeile') ?? ''}` : a.id;
        return (
          <Klappbar key={a.id} id={a.id} titel={a.label} zaehler={zaehler[a.id]} offen={auf} umschalten={() => setze(a.id, !auf)}>
            <Inhalt key={schluessel} />
          </Klappbar>
        );
      })}
    </>
  );
}

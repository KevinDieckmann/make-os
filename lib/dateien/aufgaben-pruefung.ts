// ─── Dateien an Projekten und Aufgaben · Verbindungsprüfung (rein, getestet, 28.09. C2) ───
// Dateien hängen nicht an Personen (Art. 17 ändert hier nichts), aber an Projekten und Aufgaben. Wird eine
// Aufgabe oder ein Projekt gelöscht, bleibt die Datei liegen — niemand sieht sie mehr auf einer Projektseite.
// Diese Prüfung meldet das (nur Kennungen), repariert nichts und löscht nichts. Eingehängt in
// lib/crm/verbindungen.ts (Stammdaten › Datenqualität): „aufgaben-datei-verweis-tot“, „aufgaben-datei-fehlt“.

import { istSonstigeProjekt } from '@/lib/aufgaben/struktur';

interface Eintrag { id: string; projektId?: string; aufgabeId?: string; datei?: unknown }
export interface AufgabenDateiBefunde {
  /** Einträge, deren Projekt oder Aufgabe es nicht (mehr) gibt. */
  verweisTot: string[];
  /** Einträge ohne Inhalt auf der Platte. */
  fehlt: string[];
}

/**
 * `aufgaben`/`projekte`: Kennungen im Aufgaben-Bestand (null = nicht geladen → Verweise nicht prüfen).
 * „Sonstige“ eines Space (`sonstige-<space>`) ist ein gültiges, virtuelles Projekt.
 */
export function aufgabenDateienPruefen(eintraege: readonly Eintrag[], bestand: { aufgaben: readonly string[]; projekte: readonly string[] } | null, aufPlatte: readonly string[]): AufgabenDateiBefunde {
  const platte = new Set(aufPlatte);
  const aufgaben = bestand ? new Set(bestand.aufgaben) : null;
  const projekte = bestand ? new Set(bestand.projekte) : null;
  const verweisTot: string[] = [], fehlt: string[] = [];
  for (const e of eintraege) {
    if (aufgaben && projekte) {
      const projektTot = !e.projektId || (!projekte.has(e.projektId) && !istSonstigeProjekt(e.projektId));
      if (projektTot || (e.aufgabeId && !aufgaben.has(e.aufgabeId))) verweisTot.push(e.id);
    }
    if (e.datei && !platte.has(e.id)) fehlt.push(e.id);
  }
  return { verweisTot, fehlt };
}

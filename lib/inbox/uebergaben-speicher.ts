// ─── Inbox teilen — der Bestand der Übergaben (Server, 08.10.2026, Lücke 6) ──────────────────────────────────────────
// EIN Bestand je Haushalt `inbox-uebergaben--<haushalt>` (verschlüsselte Hülle): jede Übergabe ist eine freigegebene KOPIE eines
// Gesprächs (Köpfe + Texte, Anhänge nur als Liste) von einer Person an eine andere des Haushalts. Gelesen wird NUR über
// `uebergabenFuer(person)` — die Sicht entscheidet `uebergabeSichtbar` (lib/inbox/teilen.ts): die übergebende Person und die
// Empfängerin, diese nur, solange sie den Bereich sehen darf (Privat nie an ein Konto mit `finanzRecht: 'business'`).
// Erledigte Übergaben bleiben 90 Tage (Löschfrist im Speicher-Register), dann räumt der nächste Schreibvorgang sie weg.
// Mitgegebene Anhänge (10.10.) liegen verschlüsselt in der Bild-Ablage (Ordner `inbox-uebergaben`): fällt eine Übergabe weg (zurückziehen,
// Aufbewahrung, Art. 17, Konto löschen), löscht `aendereUebergaben` ihre Dateien gleich mit; was trotzdem verwaist (z. B. Art. 17 über
// person-weitere.ts, der den Bestand direkt ändert), räumt der tägliche Löschfristen-Lauf weg (`uebergabenAufraeumen`).
// Diese Datei kennt den Strom nicht (kein Kreis mit strom-server.ts) — Anlegen/Aktualisieren steht in uebergaben-server.ts.

import { promises as fs } from 'fs';
import path from 'path';
import { loadJson, updateJson, datenOrdner } from '@/lib/store/local-db';
import { bildEntfernen } from '@/lib/store/bild-ablage';
import { registerName, imapStandName } from '@/lib/postfach/typen';
import { geteiltName, geteiltePostfaecherFuer, teamHaushalt, teamPersonen, type TeamPerson } from './teilen-server';
import {
  TeilenFehler, UEBERGABE_GRENZEN, UEBERGABE_ABLAGE_NAME, UEBERGABE_ABLAGE_ORDNER, ablageNamen, ablageWeg, standVon, uebergabeSichtbar, uebergabeZeile,
  uebergabenAufbewahren, uebergabenNachMailFrist, type Uebergabe, type UebergabeZeile,
} from './teilen';

interface Datei { v: 1; uebergaben: Uebergabe[] }
export const uebergabenName = (haushalt: string) => `inbox-uebergaben--${haushalt}`;

/** Alle Übergaben des Haushalts — NUR für Filter, Art. 15/17 und Konto-Wege; Antworten gehen über `uebergabenFuer`. */
export async function ladeUebergabenRoh(): Promise<Uebergabe[]> {
  const d = await loadJson<Datei>(uebergabenName(await teamHaushalt()));
  return d && d.v === 1 && Array.isArray(d.uebergaben) ? d.uebergaben : [];
}

/** Die Übergaben, die diese Person sehen darf (Server-Filter). `team` optional (schon geladen). */
export async function uebergabenFuer(person: string, team?: TeamPerson[]): Promise<Uebergabe[]> {
  const t = team ?? await teamPersonen();
  const ich = t.find(x => x.speicher === person);
  if (!ich) return [];
  return (await ladeUebergabenRoh()).filter(u => uebergabeSichtbar(u, ich));
}

/** Zeilen für die Liste einer Person (ohne Texte). */
export async function uebergabeZeilenFuer(person: string, team?: TeamPerson[]): Promise<UebergabeZeile[]> {
  const t = team ?? await teamPersonen();
  const namen = Object.fromEntries(t.map(x => [x.speicher, x.name]));
  return (await uebergabenFuer(person, t)).map(u => uebergabeZeile(u, person, namen)).sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
}

/**
 * Den Bestand ändern (EINE Sperre). `mutate` bekommt die Liste und liefert die neue (oder wirft `TeilenFehler`). Danach: Aufbewahrung
 * (erledigte nach 90 Tagen weg) und die Grenze offener Übergaben (→ 413, nie still gekürzt).
 */
export async function aendereUebergaben<T>(mutate: (l: Uebergabe[]) => { liste: Uebergabe[]; wert: T }, jetzt = new Date()): Promise<T> {
  let wert: T | undefined;
  let fehler: Error | null = null;
  let weg: string[] = [];
  await updateJson<Datei>(uebergabenName(await teamHaushalt()), cur => {
    const basis = cur && cur.v === 1 && Array.isArray(cur.uebergaben) ? cur : { v: 1 as const, uebergaben: [] };
    try {
      const r = mutate([...basis.uebergaben]);
      const liste = uebergabenAufbewahren(r.liste, jetzt);
      if (liste.filter(u => u.status !== 'erledigt').length > UEBERGABE_GRENZEN.offen) throw new TeilenFehler(`Zu viele offene Übergaben (höchstens ${UEBERGABE_GRENZEN.offen}) — bitte erst welche erledigen.`, 413);
      wert = r.wert;
      weg = ablageWeg(basis.uebergaben, liste);
      return { v: 1, uebergaben: liste };
    } catch (e) { fehler = e as Error; return basis; }
  });
  if (fehler) throw fehler;
  // Erst NACH dem Schreiben: Dateien, auf die keine Übergabe mehr zeigt (zurückgezogen, aufbewahrt, aktualisiert ohne den Anhang).
  for (const n of weg) await bildEntfernen(UEBERGABE_ABLAGE_ORDNER, n).catch(() => { /* der tägliche Lauf räumt nach */ });
  return wert as T;
}

/** Stand-Prüfung (409) — `stand` ist optional; fehlt er, gilt der aktuelle. */
export function standPruefen(u: Uebergabe, stand: string | undefined): void {
  if (stand !== undefined && standVon(u) !== stand) throw new TeilenFehler('Jemand hat diese Übergabe gerade geändert — bitte neu laden.', 409);
}

/**
 * Bestandsnamen, deren Stand die Antwort des Stroms (ETag) mitbestimmt (08.10.): gemeinsamer Zustand, Übergaben und — nur für Team-
 * Postfächer, die die Person sieht — Register und Spiegel der Besitzer. Nie Bestände einer Person ohne geteiltes Postfach.
 */
export async function teilenStandNamen(person: string): Promise<string[]> {
  const h = await teamHaushalt();
  const besitzer = Array.from(new Set((await geteiltePostfaecherFuer(person)).map(f => f.besitzer)));
  return [geteiltName(h), uebergabenName(h), ...besitzer.flatMap(b => [registerName(b), imapStandName(b)])];
}

/**
 * Löschfristen-Lauf (täglich): erledigte Übergaben nach 90 Tagen weg — auch, wenn sonst niemand schreibt —, mit `mailStichtag` (Frist
 * „Mail-Spiegel“, 10.10.) auch Kopien, deren jüngste Nachricht älter ist als der Spiegel hält, und verwaiste mitgegebene
 * Anhänge (Datei in der Ablage, auf die keine Übergabe des Haushalts mehr zeigt; nur Dateien älter als eine Stunde, damit ein laufendes
 * „Übergeben“ zwischen Ablegen und Schreiben nichts verliert). Liefert die Zahl der entfernten Übergaben + Dateien.
 */
export async function uebergabenAufraeumen(jetzt = new Date(), mailStichtag?: string): Promise<number> {
  const alle = await ladeUebergabenRoh();
  const frist = (l: readonly Uebergabe[]) => (mailStichtag ? uebergabenNachMailFrist(l, mailStichtag) : [...l]);
  let n = 0;
  if (uebergabenAufbewahren(frist(alle), jetzt).length !== alle.length) {
    await aendereUebergaben(l => { const raus = frist(l); n = l.length - uebergabenAufbewahren(raus, jetzt).length; return { liste: raus, wert: null }; }, jetzt);
  }
  return n + await ablageVerwaisteRaeumen(jetzt);
}

/** Verwaiste Dateien der Übergaben-Ablage entfernen (siehe oben). Liefert die Zahl. */
export async function ablageVerwaisteRaeumen(jetzt = new Date()): Promise<number> {
  const ordner = path.join(datenOrdner(), UEBERGABE_ABLAGE_ORDNER);
  const dateien = (await fs.readdir(ordner).catch(() => [] as string[])).filter(d => UEBERGABE_ABLAGE_NAME.test(d));
  if (!dateien.length) return 0;
  const genutzt = new Set(ablageNamen(await ladeUebergabenRoh()));
  let n = 0;
  for (const d of dateien) {
    if (genutzt.has(d)) continue;
    const st = await fs.stat(path.join(ordner, d)).catch(() => null);
    if (!st || jetzt.getTime() - st.mtimeMs < 3600_000) continue;
    await bildEntfernen(UEBERGABE_ABLAGE_ORDNER, d);
    n++;
  }
  return n;
}

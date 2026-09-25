// ─── Bauplan als Board (rein, getestet) ─────────────────────────────────────
// Kevin 25.09.: „Den Bauplan komplett umbauen, dass wir darin richtig spielen
// können und die Aufgaben sauber reinbekommen … bessere Auswahlmöglichkeiten,
// vielleicht ein Bild anhängen — dann können wir die Software verbessern“ und
// „wir müssen Planung in den Bau bekommen“. Entschieden: alles —
//   Board        Ideen → Bereit → In Arbeit → Zum Testen → Fertig, ziehen und sortieren
//   Eingang      Knopf auf jeder Seite (nimmt die Seite mit), Vorlage (Problem ·
//                Wunsch · Warum · Fertig wenn), Jarvis, Bildschirmfoto
//   Zusammen     Claude baut „Bereit“ von oben ab und gibt mit „So testet ihr“
//                nach „Zum Testen“; Daumen und Kommentare; erst eure Abnahme
//                macht eine Karte fertig („Passt noch nicht“ → zurück nach Bereit)
//   Planung      Etappen mit Zieldatum und Fortschritt, Zieldatum je Karte
// Alte Punkte (nur status) gelten ohne Umzug weiter: spalteVon leitet ab.
// Der Status bleibt immer mitgeführt — Roadmap, Selbstbild und Loop lesen ihn.

import type { BacklogItem, BacklogStatus } from '@/lib/make-one/backlog-data';
import { SPALTEN, ARTEN, BEREICHE, type Spalte, type Art } from './form';

export { SPALTEN, ARTEN, BEREICHE, type Spalte, type Art };

export interface Etappe { id: string; name: string; ziel?: string; beschreibung?: string }
export interface BauplanDatei { items: BacklogItem[]; etappen?: Etappe[] }

/** Spalte einer Karte — gesetzt oder aus dem alten Status. */
export function spalteVon(i: Pick<BacklogItem, 'spalte' | 'status' | 'prio'>): Spalte {
  if (i.spalte) return i.spalte;
  if (i.status === 'erledigt') return 'fertig';
  if (i.status === 'laufend') return 'arbeit';
  return i.prio === 1 ? 'bereit' : 'idee';
}

/** Der alte Status zur Spalte — damit Roadmap, Selbstbild und Loop weiter stimmen. */
export function statusAus(s: Spalte): BacklogStatus {
  return s === 'fertig' ? 'erledigt' : s === 'arbeit' || s === 'test' ? 'laufend' : 'offen';
}

/** Art einer Karte — gesetzt oder aus der alten Kategorie. */
export function artVon(i: Pick<BacklogItem, 'art' | 'kategorie'>): Art {
  if (i.art) return i.art;
  return i.kategorie === 'anbindung' ? 'anbindung' : i.kategorie === 'qualitaet' ? 'verbesserung' : 'neu';
}

/** Reihenfolge in einer Spalte: gesetzter Rang, sonst Priorität, dann Neueste zuerst. */
export function sortiert(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.prio - b.prio || (b.angelegt ?? '').localeCompare(a.angelegt ?? ''));
}

/** Die Karten je Spalte, sortiert; Verworfenes nie. */
export function board(items: BacklogItem[]): Record<Spalte, BacklogItem[]> {
  const raus = Object.fromEntries(SPALTEN.map(s => [s.id, [] as BacklogItem[]])) as Record<Spalte, BacklogItem[]>;
  for (const i of items) if (!i.verworfen) raus[spalteVon(i)].push(i);
  for (const s of SPALTEN) raus[s.id] = sortiert(raus[s.id]);
  return raus;
}

/**
 * Eine Karte verschieben: in `ziel` an Position `index` (0 = oben). Die
 * Zielspalte wird neu durchnummeriert (10, 20, 30 …) — ein Schritt, keine
 * Lücken, egal wie oft gezogen wurde. Status wandert mit.
 */
export function verschieben(items: BacklogItem[], id: string, ziel: Spalte, index: number, jetzt: string): BacklogItem[] {
  const karte = items.find(i => i.id === id);
  if (!karte) return items;
  const spalte = sortiert(items.filter(i => !i.verworfen && i.id !== id && spalteVon(i) === ziel));
  const pos = Math.max(0, Math.min(index, spalte.length));
  const neu = [...spalte.slice(0, pos), karte, ...spalte.slice(pos)];
  const rang = new Map(neu.map((x, n) => [x.id, (n + 1) * 10]));
  return items.map(i => {
    if (i.id === id) return { ...i, spalte: ziel, status: statusAus(ziel), rang: rang.get(id)!, geaendert: jetzt };
    return rang.has(i.id) ? { ...i, spalte: spalteVon(i), rang: rang.get(i.id)! } : i;
  });
}

const t = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const opt = (v: unknown, n: number) => t(v, n) || undefined;
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
export const bildNameOk = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{8,60}\.(jpg|png|webp)$/.test(v);

/** Bereich aus dem Pfad der Seite, auf der es aufgefallen ist. */
export function bereichAusSeite(pfad?: string): string {
  const p = (pfad ?? '').split('?')[0];
  const regeln: [RegExp, string][] = [
    [/^\/jarvis/, 'Jarvis'], [/^\/os\/wissen/, 'Brain'], [/^\/os\/(markttraktion|crm|prospecting)/, 'Markttraktion'], [/^\/os\/mandate/, 'Mandate'],
    [/^\/os\/(fokus|kompass)/, 'Fokus'], [/^\/os\/(aufgaben|board|meeting)/, 'Aufgaben'], [/^\/os\/planung/, 'Planung'], [/^\/os\/(finanzen|zahlen|controlling|liquiditaet)/, 'Zahlen'],
    [/^\/os\/(gesundheit|energie|ernaehrung)/, 'Gesundheit'], [/^\/os\/familie/, 'Familie'], [/^\/os\/inbox/, 'Inbox'], [/^\/os\/(agenten|stapel)/, 'Agenten'],
    [/^\/os\/(system|bauplan|roadmap|konto|verbindungen|datenbasis|stammdaten)/, 'System'], [/^\/os\/?$/, 'Heute'],
  ];
  return regeln.find(([r]) => r.test(p))?.[1] ?? 'Allgemein';
}

/**
 * Eine neue Karte aus dem Formular, dem Knopf auf jeder Seite oder von Jarvis
 * säubern: Titel Pflicht, Auswahlfelder nur aus den Listen, Texte begrenzt,
 * höchstens vier Bilder mit gültigem Namen. Neu landet sie in „Ideen“ oben.
 */
export function neueKarte(roh: Record<string, unknown>, von: string, jetzt: string, id: string): BacklogItem | null {
  const titel = t(roh.titel, 160);
  if (!titel) return null;
  const art = ARTEN.some(a => a.id === roh.art) ? (roh.art as Art) : 'verbesserung';
  // Nur Seiten dieser App (kein „//fremd.de“) — die Karte verlinkt dorthin zurück.
  const seite = typeof roh.seite === 'string' && /^\/(os|jarvis)(\/|\?|$)/.test(roh.seite) ? t(roh.seite, 200) : undefined;
  const bereich = (BEREICHE as readonly string[]).includes(String(roh.bereich)) ? String(roh.bereich) : bereichAusSeite(seite);
  const prio = [1, 2, 3].includes(Number(roh.prio)) ? (Number(roh.prio) as 1 | 2 | 3) : 2;
  return {
    id, titel, warum: t(roh.warum, 800), art, bereich, prio,
    kategorie: art === 'anbindung' ? 'anbindung' : art === 'neu' ? 'idee' : 'qualitaet',
    status: 'offen', spalte: 'idee', rang: 0, block: 'frei', von, angelegt: jetzt, geaendert: jetzt,
    ...(opt(roh.problem, 800) ? { problem: opt(roh.problem, 800) } : {}), ...(opt(roh.wunsch, 800) ? { wunsch: opt(roh.wunsch, 800) } : {}),
    ...(opt(roh.fertigWenn, 600) ? { fertigWenn: opt(roh.fertigWenn, 600) } : {}), ...(seite ? { seite } : {}),
    ...(Array.isArray(roh.bilder) && roh.bilder.filter(bildNameOk).length ? { bilder: (roh.bilder as unknown[]).filter(bildNameOk).slice(0, 4) } : {}),
    ...(tagOk(roh.ziel) ? { ziel: tagOk(roh.ziel) } : {}), ...(opt(roh.quelle, 120) ? { quelle: opt(roh.quelle, 120) } : {}),
  };
}

/** Änderbare Felder einer Karte säubern — nur was erlaubt ist, im erlaubten Format. */
export function felderSaeubern(f: Record<string, unknown>): Partial<BacklogItem> {
  const raus: Partial<BacklogItem> = {};
  if ('titel' in f && t(f.titel, 160)) raus.titel = t(f.titel, 160);
  for (const [k, n] of [['warum', 800], ['problem', 800], ['wunsch', 800], ['fertigWenn', 600], ['brauche', 600], ['ergebnis', 2000], ['testen', 1500]] as const) if (k in f) (raus as Record<string, unknown>)[k] = t(f[k], n) || undefined;
  if ('art' in f && ARTEN.some(a => a.id === f.art)) raus.art = f.art as Art;
  if ('bereich' in f && (BEREICHE as readonly string[]).includes(String(f.bereich))) raus.bereich = String(f.bereich);
  if ('prio' in f && [1, 2, 3].includes(Number(f.prio))) raus.prio = Number(f.prio) as 1 | 2 | 3;
  if ('block' in f && ['frei', 'kevin', 'extern'].includes(String(f.block))) raus.block = f.block as BacklogItem['block'];
  if ('ziel' in f) raus.ziel = tagOk(f.ziel);
  if ('etappe' in f) raus.etappe = /^e-[a-z0-9-]{2,40}$/.test(String(f.etappe ?? '')) ? String(f.etappe) : undefined;
  if ('bilder' in f && Array.isArray(f.bilder)) raus.bilder = f.bilder.filter(bildNameOk).slice(0, 6);
  if ('verworfen' in f) raus.verworfen = f.verworfen === true || undefined;
  return raus;
}

/** Fortschritt einer Etappe: fertige ÷ alle (ohne Verworfenes). */
export function etappenStand(items: BacklogItem[], e: Pick<Etappe, 'id'>): { gesamt: number; fertig: number; imTest: number; anteil: number } {
  const l = items.filter(i => i.etappe === e.id && !i.verworfen);
  const fertig = l.filter(i => spalteVon(i) === 'fertig').length;
  return { gesamt: l.length, fertig, imTest: l.filter(i => spalteVon(i) === 'test').length, anteil: l.length ? fertig / l.length : 0 };
}

/** Die Warteschlange für Claude: „Bereit“ von oben, ohne Karten, die auf Kevin oder Dritte warten. */
export function warteschlange(items: BacklogItem[]): BacklogItem[] {
  return board(items).bereit.filter(i => i.block === 'frei');
}

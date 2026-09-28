// ─── Einzel-Restore aus einer Tageskopie (29.09., Paket D-A #63) ───────────────
// Nach einem misslungenen Zusammenführen, einem falschen Massen-Klick oder einem Sprung, den die Durchsicht
// meldet, blieb nur der Dateitausch per SSH — und damit gingen alle späteren Änderungen verloren. Jetzt:
//   1. `tageskopien(bestand)` — welche Tage liegen in backup/ (14 Tage je Bestand);
//   2. `vorschau(bestand, tag)` — je Liste (Felder mit `{ id }`-Einträgen): nur in der Kopie (seitdem gelöscht),
//      geändert, seitdem neu, gleich — mit dem Stand (Fingerabdruck) des HEUTIGEN Eintrags;
//   3. `uebernehmen(bestand, tag, liste, auswahl)` — einzelne Datensätze aus der Kopie zurück, in der
//      Schreibsperre, nur wenn der heutige Stand noch der aus der Vorschau ist (sonst 409, nichts geschrieben).
//      Protokolliert (Kennung + Feldnamen, nie Werte) als Systemweg mit der auslösenden Person.
// Grenze aus Datenschutz: gelöschte PERSONEN (Bestand `kontakte`) holt das Werkzeug nie zurück — eine Löschung
// kann Art. 17 gewesen sein (Sperrliste/Löschprotokoll prüfen, dann von Hand). Nur Inhaber (Route).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, rohOeffnen, sicherungenVon, updateJson, loadJson } from './local-db';
import { migriere } from './schema';
import { fingerabdruck } from './fingerabdruck';
import { protokolliere, listenDiff, type Wer } from './aenderungsprotokoll';

const NAME_OK = /^[a-z0-9][a-z0-9-]*$/;
const TAG_OK = /^\d{4}-\d{2}-\d{2}$/;
/** Personen nie aus einer Kopie wiederbeleben (Art. 17). */
const KEINE_WIEDERBELEBUNG = new Set(['kontakte']);
const MAX_AUSWAHL = 200;

type Zeile = { id: string } & Record<string, unknown>;
type Daten = Record<string, unknown> | Zeile[];

export class RestoreFehler extends Error { constructor(msg: string, readonly status: number) { super(msg); } }

const istZeile = (x: unknown): x is Zeile => !!x && typeof x === 'object' && !Array.isArray(x) && typeof (x as { id?: unknown }).id === 'string';
/** Die Listen eines Bestands: Felder (bzw. die Wurzel ''), deren Einträge alle `{ id }` tragen. */
function listen(d: Daten | null): Map<string, Zeile[]> {
  const m = new Map<string, Zeile[]>();
  if (!d) return m;
  if (Array.isArray(d)) { if (d.every(istZeile)) m.set('', d); return m; }
  for (const [k, v] of Object.entries(d)) if (Array.isArray(v) && v.length && v.every(istZeile)) m.set(k, v as Zeile[]);
  return m;
}
const abdruck = (z: Zeile) => fingerabdruck(z);

function pruefe(bestand: string, tag?: string): void {
  if (!NAME_OK.test(bestand)) throw new RestoreFehler('Unzulässiger Bestand.', 400);
  if (tag !== undefined && !TAG_OK.test(tag)) throw new RestoreFehler('Tag als JJJJ-MM-TT.', 400);
}

export async function tageskopien(bestand: string): Promise<string[]> {
  pruefe(bestand);
  const dateien = await fs.readdir(path.join(datenOrdner(), 'backup')).catch(() => [] as string[]);
  return sicherungenVon(bestand, dateien).map(f => f.slice(bestand.length + 1, bestand.length + 11)).reverse();
}

async function kopieLesen(bestand: string, tag: string): Promise<Daten> {
  pruefe(bestand, tag);
  let roh: string;
  try { roh = await fs.readFile(path.join(datenOrdner(), 'backup', `${bestand}-${tag}.json`), 'utf8'); }
  catch { throw new RestoreFehler('Keine Tageskopie für diesen Tag.', 404); }
  const g = rohOeffnen(roh, bestand);
  return migriere<Daten>(bestand, JSON.parse(g.text) as Daten).daten;
}

export interface ListenVorschau {
  liste: string;
  /** seitdem gelöscht (nur in der Kopie) */
  nurInKopie: { id: string }[];
  /** in beiden, aber anders — `stand` = Fingerabdruck des HEUTIGEN Eintrags (für die Übernahme mitschicken) */
  geaendert: { id: string; stand: string; felder: string[] }[];
  neuSeitdem: number;
  gleich: number;
  wiederbelebenErlaubt: boolean;
}

export async function vorschau(bestand: string, tag: string): Promise<{ bestand: string; tag: string; listen: ListenVorschau[] }> {
  const kopie = listen(await kopieLesen(bestand, tag));
  const heute = listen(await loadJson<Daten>(bestand));
  const raus: ListenVorschau[] = [];
  for (const [liste, alt] of kopie) {
    const jetzt = new Map((heute.get(liste) ?? []).map(z => [z.id, z]));
    const v: ListenVorschau = { liste, nurInKopie: [], geaendert: [], neuSeitdem: 0, gleich: 0, wiederbelebenErlaubt: !KEINE_WIEDERBELEBUNG.has(bestand) };
    const inKopie = new Set<string>();
    for (const z of alt) {
      inKopie.add(z.id);
      const j = jetzt.get(z.id);
      if (!j) v.nurInKopie.push({ id: z.id });
      else if (abdruck(j) !== abdruck(z)) v.geaendert.push({ id: z.id, stand: abdruck(j), felder: listenDiff([j], [z])[0]?.felder ?? [] });
      else v.gleich++;
    }
    v.neuSeitdem = Array.from(jetzt.keys()).filter(id => !inKopie.has(id)).length;
    raus.push(v);
  }
  return { bestand, tag, listen: raus };
}

/** Die Einträge der Kopie zu bestimmten Kennungen (für die Anzeige vor der Übernahme — nur Inhaber). */
export async function kopieZeilen(bestand: string, tag: string, liste: string, ids: string[]): Promise<Zeile[]> {
  const l = listen(await kopieLesen(bestand, tag)).get(liste) ?? [];
  const w = new Set(ids.slice(0, MAX_AUSWAHL));
  return l.filter(z => w.has(z.id));
}

/**
 * Einzelne Datensätze aus der Tageskopie übernehmen. `auswahl[id]` = Stand des heutigen Eintrags aus der Vorschau
 * (bzw. null, wenn er heute fehlt). Passt ein Stand nicht mehr → 409 mit den Kennungen, nichts geschrieben.
 */
export async function uebernehmen(bestand: string, tag: string, liste: string, auswahl: Record<string, string | null>, wer: Wer): Promise<{ ok: true; uebernommen: number } | { ok: false; status: number; fehler: string; konflikte?: string[] }> {
  pruefe(bestand, tag);
  const ids = Object.keys(auswahl);
  if (!ids.length) return { ok: false, status: 400, fehler: 'Keine Auswahl.' };
  if (ids.length > MAX_AUSWAHL) return { ok: false, status: 413, fehler: `Höchstens ${MAX_AUSWAHL} Datensätze auf einmal.` };
  const kopie = new Map((listen(await kopieLesen(bestand, tag)).get(liste) ?? []).map(z => [z.id, z]));
  const fehlend = ids.filter(id => !kopie.has(id));
  if (fehlend.length) return { ok: false, status: 404, fehler: `Nicht in der Kopie: ${fehlend.slice(0, 5).join(', ')}` };
  if (KEINE_WIEDERBELEBUNG.has(bestand) && ids.some(id => auswahl[id] === null)) return { ok: false, status: 409, fehler: 'Gelöschte Personen holt das Werkzeug nicht zurück (Art. 17 möglich) — Sperrliste und Löschprotokoll prüfen, dann von Hand.' };

  const konflikte: string[] = [];
  let vorher: Zeile[] = [], nachher: Zeile[] = [];
  await updateJson<Daten>(bestand, cur => {
    const basis: Daten = cur ?? (liste === '' ? [] : {});
    const heute = liste === '' ? (Array.isArray(basis) ? basis as Zeile[] : []) : ((basis as Record<string, unknown>)[liste] as Zeile[] | undefined) ?? [];
    const nachId = new Map(heute.map(z => [z.id, z]));
    for (const id of ids) {
      const j = nachId.get(id);
      const soll = auswahl[id];
      if (soll === null ? !!j : !j || abdruck(j) !== soll) konflikte.push(id);
    }
    if (konflikte.length) return basis;
    vorher = heute;
    const neu = heute.map(z => (auswahl[z.id] !== undefined ? kopie.get(z.id)! : z));
    for (const id of ids) if (auswahl[id] === null) neu.push(kopie.get(id)!);
    nachher = neu;
    return liste === '' ? neu : { ...(basis as Record<string, unknown>), [liste]: neu };
  });
  if (konflikte.length) return { ok: false, status: 409, fehler: 'Inzwischen geändert — Vorschau neu laden.', konflikte };
  await protokolliere(bestand, listenDiff(vorher, nachher, liste || undefined), wer);
  return { ok: true, uebernommen: ids.length };
}

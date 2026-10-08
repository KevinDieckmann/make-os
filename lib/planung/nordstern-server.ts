// ─── MAKE OS — Nordstern des Haushalts: Lesen und Schreiben (Server) — 08.10. abends, Fragebogen Teil 3 ─────────────────
// EINE Stelle für den Bestand `nordstern--<haushalt>` (Regeln rein in lib/planung/nordstern.ts). Wer zum Haushalt gehört, liest
// ihn — auch Konten mit `finanzRecht: 'business'`, denn der Nordstern ist das gemeinsame (Business-)Ziel (`planZugangFuer`).
// Schreiben nur Mitglieder mit vollem Zugang (Sicht „privat“) und nur mit dem Stand, den sie gesehen haben (sonst Konflikt).
// ZOE und die Agenten-Prompts lesen ihn NUR über `nordsternFuerPerson`/`nordsternSatzFuer` — nie wieder als Konstante im Code.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { nordsternSatz, nordsternTextVon, type NordsternDatei } from './nordstern';

/** Bestandsname je Haushalt (Speicher-Register `nordstern--*`). */
export const nordsternName = (haushalt: string) => `nordstern--${haushalt}`;

/** Stand = Fingerabdruck des gespeicherten Nordsterns (ohne die Übernahme-Marken — die ändern nichts an dem, was man sieht). */
export const nordsternStand = (d: NordsternDatei | null | undefined): string => fingerabdruck({ nordstern: d?.nordstern?.text ? d.nordstern : null });

export interface NordsternStand { text: string; geaendertAm: string | null; stand: string }

const stand = (d: NordsternDatei | null | undefined): NordsternStand => ({
  text: nordsternTextVon(d),
  geaendertAm: d?.nordstern?.text ? (d.nordstern.geaendertAm ?? null) : null,
  stand: nordsternStand(d),
});

/** Den Nordstern eines Haushalts lesen (schreibt nie). */
export async function nordsternLaden(haushalt: string): Promise<NordsternStand> {
  return stand(await loadJson<NordsternDatei>(nordsternName(haushalt)));
}

/** Kontrollfluss in der Sperre: nichts schreiben (Konflikt oder unverändert) — `updateJson` schreibt dann nicht. */
class NichtSchreiben extends Error { constructor(readonly grund: 'konflikt' | 'gleich') { super(grund); } }

export type NordsternSchreibErgebnis = { ok: true; geaendert: boolean; aktuell: NordsternStand } | { ok: false; konflikt: true; aktuell: NordsternStand };

/**
 * Den Nordstern setzen (leer = entfernen). `basis` = der Stand, den die Person gesehen hat — passt er nicht mehr, wird nichts
 * geschrieben (Konflikt, die Route antwortet 409 mit dem aktuellen Stand). Prüfung und Schreiben in EINER Sperre.
 * Protokoll: nur Feldname, nie der Text.
 */
export async function nordsternSchreiben(haushalt: string, text: string, basis: string, wer: Wer, jetzt: Date = new Date()): Promise<NordsternSchreibErgebnis> {
  const name = nordsternName(haushalt);
  try {
    const neu = await updateJson<NordsternDatei>(name, cur => {
      if (nordsternStand(cur) !== basis) throw new NichtSchreiben('konflikt');
      if (nordsternTextVon(cur) === text) throw new NichtSchreiben('gleich');
      return { ...(cur ?? {}), nordstern: text ? { text, geaendertAm: jetzt.toISOString() } : null };
    });
    await protokolliere(name, [{ op: 'geaendert', id: 'nordstern', felder: ['text'] }], wer, jetzt);
    return { ok: true, geaendert: true, aktuell: stand(neu) };
  } catch (e) {
    if (!(e instanceof NichtSchreiben)) throw e;
    const aktuell = await nordsternLaden(haushalt);
    return e.grund === 'konflikt' ? { ok: false, konflikt: true, aktuell } : { ok: true, geaendert: false, aktuell };
  }
}

/**
 * Der Nordstern des Haushalts einer Person — für ZOE/Agenten. Ohne Haushalt am Konto: null (kein Rückfall auf einen anderen
 * Haushalt, keine feste Person). Wirft nie.
 */
export async function nordsternFuerPerson(person: string | null | undefined): Promise<string | null> {
  try {
    const z = await planZugangFuer(person);
    if (!z) return null;
    const t = (await nordsternLaden(z.haushalt)).text;
    return t || null;
  } catch { return null; }
}

/** Eine Zeile für Agenten-Prompts: „Nordstern des Haushalts: …“ bzw. ehrlich „keiner hinterlegt“. */
export async function nordsternSatzFuer(person: string | null | undefined): Promise<string> {
  return nordsternSatz(await nordsternFuerPerson(person));
}

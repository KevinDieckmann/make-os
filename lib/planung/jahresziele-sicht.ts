// ─── Jahresziele für eine Person — EINE Lesestelle für den Agenten-Überblick und den Kontext von ZOE und den Heads (Durchstich 09.10.) ─
// Kevin 09.10.: „Bekommen Heads/ZOE Ziele … so, wie die Seite sie zeigt?“ — Vorher zeigte der Agenten-Bereich „Jahresziele“, ZOE und die
// Heads kannten sie aber nicht (das Brain trug nur Nordstern und Business-Meilensteine). Jetzt liest beides HIER:
//   • Bestand `ziele` (geteilte Ziele des Haushalts), Horizont Jahr, offen, Jahr über `zielJahr` (laufendes Jahr, Berliner Tag);
//   • Bereich über `wirksamerSpace` (Privat-Einheit → privat) — nie `z.space` direkt;
//   • Privat-Ziele nur für volle Mitglieder (Konto mit Haushalt, nicht „nur Business“) — dieselbe Regel wie die Agenten-Sicht.
// Lesen schreibt nie; Fehler → leere Liste (der Kontext sagt dann „keine hinterlegt“).

import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { zielJahr } from './zeitstrahl';
import { wirksamerSpace } from './bereich';
import type { ZieleDatei } from './typen';

export interface JahreszielKurz { id: string; titel: string; bereich: 'privat' | 'business'; fortschritt: number | null }

/** Offene Jahresziele des laufenden Jahres, die diese Person sehen darf (Privat nur mit `privat`). */
export async function jahreszieleFuer(o: { privat: boolean; heute?: string }): Promise<JahreszielKurz[]> {
  try {
    const jahr = Number((o.heute ?? localDay()).slice(0, 4));
    const d = await loadJson<ZieleDatei>('ziele');
    const raus: JahreszielKurz[] = [];
    for (const z of d?.jahr ?? []) {
      if (z.erledigt || zielJahr(z, jahr) !== jahr) continue;
      const bereich = wirksamerSpace(z) === 'privat' ? 'privat' : 'business';
      if (bereich === 'privat' && !o.privat) continue;
      raus.push({ id: z.id, titel: z.titel, bereich, fortschritt: typeof z.fortschritt === 'number' ? z.fortschritt : null });
    }
    return raus;
  } catch {
    return [];
  }
}

/** Was ein eingebauter Head (Sales/Marketing/Event, Head of Finance) zu den Zielen sieht: Nordstern (Text ohne Rahmen-Marken) + Jahresziele. */
export interface HeadZiele { nordstern: string | null; jahresziele: JahreszielKurz[] }

/**
 * Ziele für das Datenpaket der eingebauten Heads (Nachschliff 09.10.: Sales/Marketing/Event in lib/heads/lauf.ts, Head of Finance in
 * lib/finanzen/chef/lauf.ts) — dieselbe Lesestelle wie Überblick, ZOE und Agenten-Heads. Regeln:
 *   • Jahresziele (Bestand `ziele`) gehören dem Haushalt des Inhabers — nur für eine Person dieses Haushalts, einen Systemlauf ohne Person bzw.
 *     den Haushalt des Inhabers (`haushalt`); jede andere Sicht bekommt keine. `privat: false` = nur Business (Business-Heads immer).
 *   • Nordstern NUR über die vorhandenen Wege (`nordsternFuerPerson` bzw. `nordsternLaden` des Haushalts; Systemlauf: der des Inhabers).
 *   • Texte ohne Rahmen-Marken (`ohneRahmenMarken`) — sie stehen im Datenblock des Heads und beenden ihn nie.
 * Lesen schreibt nie; Fehler → leer (das Paket sagt dann „keine hinterlegt“).
 */
export async function zieleFuerHead(o: { person: string | null; privat: boolean; haushalt?: string | null; heute?: string }): Promise<HeadZiele> {
  try {
    const [{ haushaltDesInhabers, personImHaushaltDesInhabers }, { nordsternFuerPerson, nordsternLaden }, { ohneRahmenMarken }] = await Promise.all([
      import('@/lib/zugang/haushalt-inhaber'), import('./nordstern-server'), import('./nordstern'),
    ]);
    const inhaberHaushalt = await haushaltDesInhabers().catch(() => null);
    const imHaushalt = o.haushalt !== undefined && o.haushalt !== null
      ? !!inhaberHaushalt && o.haushalt === inhaberHaushalt
      : o.person ? await personImHaushaltDesInhabers(o.person).catch(() => false) : !!inhaberHaushalt;
    const roh = o.haushalt
      ? ((await nordsternLaden(o.haushalt).catch(() => null))?.text || null)
      : o.person ? await nordsternFuerPerson(o.person) : inhaberHaushalt ? ((await nordsternLaden(inhaberHaushalt).catch(() => null))?.text || null) : null;
    const nordstern = roh ? ohneRahmenMarken(roh).replace(/\s+/g, ' ').trim() || null : null;
    const jahresziele = imHaushalt ? (await jahreszieleFuer({ privat: o.privat, ...(o.heute ? { heute: o.heute } : {}) })).map(z => ({ ...z, titel: ohneRahmenMarken(z.titel) })) : [];
    return { nordstern, jahresziele };
  } catch {
    return { nordstern: null, jahresziele: [] };
  }
}

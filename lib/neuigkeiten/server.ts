// ─── Was ist neu — gelesen je Person (Server, 18.10.) ───────────────────────────────────────────────────────────────────────────────
// Bestand `neuigkeiten--<speicher>` (IMMER mit Suffix): nur die Kennung des zuletzt gesehenen Updates und der Zeitpunkt — keine Inhalte. Lesen
// und schreiben nur die Person selbst (Route /api/neuigkeiten, Tor `eigenePerson`). Lesen schreibt nie. Die Liste selbst ist Code
// (lib/neuigkeiten/eintraege.ts); welche Punkte ein Konto bekommt, entscheidet hier die Konto-Sicht (ein Konto „nur Business“ nie Privat-Punkte).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { kontoSicht } from '@/lib/zugang/konto-sicht-server';
import { kontoFuerSpeicher } from '@/lib/zugang/konten';
import { tagVon } from '@/lib/zeit';
import { NEUIGKEITEN, neuigkeitenFuer, ungelesene, istNeuigkeit, type Neuigkeit } from './eintraege';

export interface GesehenDatei { gesehen?: string; am?: string }
/** Der persönliche Bestand — immer `neuigkeiten--<speicher>`. */
export const neuigkeitenName = (person: string) => `neuigkeiten--${person}`;

export interface NeuigkeitenStand { eintraege: Neuigkeit[]; ungelesen: Neuigkeit[]; gesehen: string | null }

/** Was die Person sehen darf und was davon neu für sie ist. Lesen schreibt nie. */
export async function neuigkeitenStand(person: string): Promise<NeuigkeitenStand> {
  const [sicht, datei, konto] = await Promise.all([
    kontoSicht(person),
    loadJson<GesehenDatei>(neuigkeitenName(person)).catch(() => null),
    kontoFuerSpeicher(person).catch(() => undefined),
  ]);
  const eintraege = neuigkeitenFuer(NEUIGKEITEN, { nurBusiness: sicht ? sicht.nurBusiness : null });
  const gesehen = istNeuigkeit(datei?.gesehen) ? datei!.gesehen! : null;
  const angelegt = typeof konto?.angelegt === 'string' && konto.angelegt ? tagVon(konto.angelegt) : null;
  return { eintraege, ungelesen: ungelesene(eintraege, gesehen, angelegt), gesehen };
}

/** Merkt sich, dass die Person ein Update gesehen hat — nur bekannte Kennungen, nie rückwärts (ein älteres macht neuere nicht wieder neu). */
export async function gesehenSetzen(person: string, id: string, jetzt = new Date()): Promise<{ ok: true } | { ok: false; status: number; fehler: string }> {
  if (!istNeuigkeit(id)) return { ok: false, status: 400, fehler: 'Unbekanntes Update. Nichts gespeichert.' };
  await updateJson<GesehenDatei>(neuigkeitenName(person), alt => {
    const iAlt = alt?.gesehen ? NEUIGKEITEN.findIndex(n => n.id === alt.gesehen) : -1;
    const iNeu = NEUIGKEITEN.findIndex(n => n.id === id);
    if (iAlt >= 0 && iAlt <= iNeu) return alt ?? {};
    return { gesehen: id, am: jetzt.toISOString() };
  });
  return { ok: true };
}

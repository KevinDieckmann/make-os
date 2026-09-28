// ─── Zeit & Fokus — Zeit je Mandat für Server-Leser (29.09., B2/B4) ──────────
// Dieselbe Rechnung wie GET /api/state/zeit/mandate (lib/zeitmessung/mandate.ts), für Leser ohne Anfrage:
// ZOE (`mandate_lage`) und den App-Tagesbericht fürs Brain (lib/brain/app-bericht.ts). Ausgewertet wird der
// Haushalt der Person (alle Konten mit demselben Haushalt, `zeitPersonenVon`) — nur bewusste Business-Blöcke.

import { ladeZeit } from './speicher';
import { berlinTag, type Zeitraum } from './einheiten';
import { zeitJeMandat, type ZeitJeMandat } from './mandate';
import { zeitPersonenVon } from './personen';
import { mandateKurz } from '@/lib/planung/mandat-server';

export async function zeitJeMandatFuer(person: string, zeitraum: Zeitraum = 'woche', stichtag = berlinTag(new Date().toISOString())): Promise<ZeitJeMandat> {
  const { personen } = await zeitPersonenVon(person);
  const [mandate, dateien] = await Promise.all([mandateKurz(), Promise.all(personen.map(p => ladeZeit(p.person as Parameters<typeof ladeZeit>[0])))]);
  return zeitJeMandat(personen.map((p, i) => ({ ...p, datei: dateien[i] })), mandate, zeitraum, stichtag);
}

/** Stunden mit einer Nachkommastelle, deutsch („3,5 h“). */
export const stundenText = (sek: number): string => `${(Math.round((sek / 3600) * 10) / 10).toLocaleString('de-DE')} h`;

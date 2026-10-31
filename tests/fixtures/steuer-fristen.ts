// Test-Hilfe (31.10., Zeitreise-Prüfung): alle Steuerfristen um `heute` (−30 … +365 Tage, lib/steuern `fristen`) als abgehakt ablegen.
// Wozu: Tests, die in den Lichtfäden die dichteste Woche lesen (Engstellen, `top`), sollen ihre eigenen Aufgaben finden — nicht je nach
// Kalendertag von überfälligen Steuerfristen verdrängt werden (nach dem 10.12./31.12. stehen fünf davon in der ersten Januarwoche).
import { saveJson } from '@/lib/store/local-db';

export async function steuerFristenAbhaken(heute: string): Promise<number> {
  const [{ ladeSteuerEinstellungenMitPlan, STEUERN }, { fristen }] = await Promise.all([import('@/lib/steuern/speicher'), import('@/lib/steuern/rechnen')]);
  const liste = fristen(await ladeSteuerEinstellungenMitPlan(heute), heute);
  await saveJson(STEUERN, { abgehakt: Object.fromEntries(liste.map(f => [`f:${f.id}`, true])) });
  return liste.length;
}

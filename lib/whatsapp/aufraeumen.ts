// ─── WhatsApp — Fristen anwenden (Morgenlauf, lib/crm/loeschfristen-lauf.ts Schritt 11c; Server, 07.10.2026) ─────────────
// `whatsapp-spiegel`: Nachrichten vor dem Stichtag fallen weg (und mit ihnen ihre Dateien); `whatsapp-medien`: Dateien vor dem
// Stichtag werden gelöscht, die Nachricht bleibt („abgelaufen“). Läuft auch ohne Einrichtung (ein Spiegel kann nach dem Entfernen der
// Variablen liegen bleiben — die Frist gilt trotzdem). Ohne Spiegel: nichts (es wird nie ein leerer Bestand angelegt).

import { loadJson } from '@/lib/store/local-db';
import { bildEntfernen } from '@/lib/store/bild-ablage';
import { medienAufraeumen, MEDIEN_ORDNER } from './medien';
import { aendereWaSpiegel, waAufbewahren, WA_SPIEGEL } from './spiegel';

export async function whatsappAufraeumen(grenzeSpiegel: string, grenzeMedien: string): Promise<{ nachrichten: number; medien: number }> {
  if ((await loadJson<unknown>(WA_SPIEGEL)) === null) return { nachrichten: 0, medien: 0 };
  let weg = 0;
  let dateien: string[] = [];
  await aendereWaSpiegel(s => { const r = waAufbewahren(s, grenzeSpiegel); weg = r.weg; dateien = r.dateien; return r.weg ? r.spiegel : null; });
  for (const d of dateien) await bildEntfernen(MEDIEN_ORDNER, d);
  const medien = await medienAufraeumen(grenzeMedien);
  return { nachrichten: weg, medien: medien + dateien.length };
}

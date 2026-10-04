// ─── MAKE OS — Papierkorb der Produkte im Morgenlauf (Server, 04.10.) ───────
// Schritt „Produkte-Papierkorb“ in /api/tagesstart: Produkte, die länger als 30 Tage im Papierkorb liegen und an denen
// nichts mehr hängt (Mandat, Deal, Angebots-Position), endgültig entfernen — in EINER Sperre auf „crm“, Protokoll „System“.
// Liest erst ohne Sperre und schreibt nur, wenn etwas fällig ist. Regel rein: lib/crm/produkte.ts `produkteAbgelaufen`.

import { ladeCrm, aendereCrm } from './speicher';
import { produkteAbgelaufen } from './produkte';

export async function produktePapierkorbAufraeumen(jetzt = new Date()): Promise<{ produkte: number }> {
  const iso = jetzt.toISOString();
  if (!produkteAbgelaufen(await ladeCrm(), iso).length) return { produkte: 0 };
  let weg = 0;
  await aendereCrm(b => {
    const ids = new Set(produkteAbgelaufen(b, iso));
    weg = ids.size;
    return ids.size ? { ...b, leistungen: b.leistungen.filter(l => !ids.has(l.id)) } : b;
  }, { art: 'system' });
  return { produkte: weg };
}

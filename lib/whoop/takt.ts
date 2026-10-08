// ─── WHOOP — Jobs im Takt (Server, 08.10.2026) ───────────────────────────────────────────────────────────────────────────
// Der Takt (app/api/zoe/takt, jede Minute) hält die Werte frisch: je Person mit aktiver WHOOP-Verbindung ein Abgleich, wenn fällig —
// jede Stunde, mit kürzlich eingegangenem Webhook alle 6 Stunden (Strain hat keinen Webhook). Nie während einer Pause nach Fehler/429.
// Nie blockierend: im Hintergrund gestartet; Fehler als EINE Zeile `[whoop] …` ohne Werte. Nichts im Seitenpfad.

import { alleSpeicher } from '@/lib/zugang/konten';
import { whoopKonfiguriert } from './konfig';
import { personenMitWhoop } from './verbindung';
import { whoopAbgleichen, whoopAbgleichLaeuft, whoopFaellig, ladeWhoopStand } from './abgleich';

export async function whoopJobsImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  if (!whoopKonfiguriert()) return { gestartet: [] };
  const gestartet: string[] = [];
  for (const p of await personenMitWhoop(await alleSpeicher().catch(() => [] as string[]))) {
    if (whoopAbgleichLaeuft(p)) continue;
    const s = await ladeWhoopStand(p).catch(() => null);
    if (!whoopFaellig(s, jetzt)) continue;
    gestartet.push(p);
    void whoopAbgleichen(p, { jetzt }).then(r => { if (!r.ok && r.grund === 'fehler') console.warn(`[whoop] Abgleich: ${r.fehler ?? 'Fehler'}`); }).catch(e => console.warn(`[whoop] Abgleich: ${e instanceof Error ? e.name : 'Fehler'}`));
  }
  return { gestartet };
}

/** Für den Morgenlauf (Gesundheits-Takt): frisch holen, wenn der letzte Erfolg älter als 30 Minuten ist — wartet höchstens 30 s. */
export async function whoopFrischFuer(person: string, jetzt = Date.now()): Promise<void> {
  if (!whoopKonfiguriert()) return;
  const s = await ladeWhoopStand(person).catch(() => null);
  if (s?.letzterErfolg && jetzt - Date.parse(s.letzterErfolg) < 30 * 60_000) return;
  if (s?.pauseBis && s.pauseBis > jetzt) return;
  let uhr: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([whoopAbgleichen(person, { jetzt }).catch(() => null), new Promise(r => { uhr = setTimeout(r, 30_000); })]);
  if (uhr) clearTimeout(uhr);
}

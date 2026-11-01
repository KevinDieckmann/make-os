// ─── Kundengewinnung: was im Tagesgeschäft wartet — Laden (nur Server, 02.11., Prüfung D) ──────────────────────────────────────────────
// Liest Mail-Stapel/Druckliste (lib/crm/kampagnen-motor.ts `ladePost`) und Homepage-Funde (lib/funde/speicher.ts `ladeFunde`) und rechnet über
// lib/crm/motor-dran.ts. Jede Quelle für sich — scheitert eine, fehlt nur sie. Wirft nie. Genutzt von Heute › Steht an / Glocke
// (lib/heute/anstehend-server.ts) und „Für dich“ (app/api/crm/traktion/route.ts).

import type { CrmBestand } from './typen';
import { motorDranFuer, type MotorDran } from './motor-dran';

async function sicher<T>(f: () => Promise<T>, sonst: T): Promise<T> { try { return await f(); } catch { return sonst; } }

export async function motorDranLesen(person: string, crm: Pick<CrmBestand, 'kampagnen'> | null): Promise<MotorDran[]> {
  if (!crm) return [];
  const [post, funde] = await Promise.all([
    sicher(async () => (await (await import('./kampagnen-motor')).ladePost()).eintraege, [] as { kampagneId: string; kanal: string; status: string }[]),
    sicher(async () => await (await import('@/lib/funde/speicher')).ladeFunde(), null),
  ]);
  return motorDranFuer(person, crm.kampagnen ?? [], post, funde?.funde ?? [], funde?.einstellungen.kampagneId);
}

/** Bestandsnamen für ETags (Glocke, Heute) — damit eine Freigabe oder ein neuer Fund die Zahl sofort ändert. */
export async function motorDranBestaende(): Promise<string[]> {
  return sicher(async () => {
    const [{ kampagnenPostName }, { fundeName }, { karteiHaushalt }] = await Promise.all([import('./kampagnen-motor'), import('@/lib/funde/speicher'), import('./sperrliste')]);
    const h = await karteiHaushalt();
    return [kampagnenPostName(h), fundeName(h)];
  }, []);
}

// ─── Gesellschafts-Sicht einer Person laden (Server, 15.10., Abnahme 2 A1) — die Regel steht rein in ./sicht.ts ─────────────────────────
// Aus den zwei vorhandenen Regeln, nichts neu erfunden: Privat-Bereich (`privatAusgeblendetFuer`, EINE Konto-Sicht) und Firmen-Akte
// (`firmenAkteAusgeblendetFuer` → `rechtZugangFuer`). Systemlauf (ohne Person) → alles. Unlesbar → nur Business ohne Register (fail-closed).

import { KERN_EINHEITEN } from '@/lib/einheiten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { EINHEITEN_ALLES, EINHEITEN_NUR_BUSINESS, type EinheitenSicht } from './sicht';

export type { EinheitenSicht } from './sicht';

/** Was `person` an Gesellschaften/Einheiten sieht. */
export async function einheitenSichtFuer(person: string | null | undefined): Promise<EinheitenSicht> {
  if (!person) return EINHEITEN_ALLES;
  try {
    const [{ privatAusgeblendetFuer }, { firmenAkteAusgeblendetFuer }] = await Promise.all([import('@/lib/zugang/konto-sicht-server'), import('@/lib/aufgaben/sicht')]);
    const [ohnePrivat, ohneAkte] = await Promise.all([privatAusgeblendetFuer(person), firmenAkteAusgeblendetFuer(person)]);
    return { privat: !ohnePrivat, register: !ohneAkte };
  } catch {
    return EINHEITEN_NUR_BUSINESS;
  }
}

/** Name → Kennung aller Gesellschaften der Instanz (feste aus lib/einheiten.ts samt Kurzname, dazu das Register des Haushalts). */
export async function einheitenNamen(): Promise<Map<string, string>> {
  const namen = new Map<string, string>();
  for (const e of KERN_EINHEITEN) { namen.set(e.label, e.id); if (e.kurz) namen.set(e.kurz, e.id); }
  const h = await haushaltDesInhabers().catch(() => null);
  if (!h) return namen;
  const [{ ladeRegister }, { alleGesellschaften, anzeigeName }] = await Promise.all([import('./server'), import('./modell')]);
  for (const g of alleGesellschaften(await ladeRegister(h).catch(() => null), { mitPapierkorb: true })) if (!namen.has(anzeigeName(g))) namen.set(anzeigeName(g), g.id);
  return namen;
}

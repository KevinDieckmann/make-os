// ─── Demo-Instanz: Prozesse aus den Vorlagen der Kundengewinnung (Server, 22.10.) ─────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: „Kundengewinnung wird unser Herzstück“ — die Demo zeigt, wie es aussieht: einige der 18 Vorlagen übernimmt Lena über den EINEN Schreibweg der
// Werkstatt (POST /api/prozesse/werkstatt `aus-vorlage`, wie der Knopf „Aus Vorlage“), mit sich selbst als Eignerin — sie stehen danach veröffentlicht im
// Probelauf (nichts läuft scharf, nichts geht nach außen). Über die Routen wie die übrige Saat (lib/demo/saat.ts `rufe`); keine Namen, keine Beträge — die
// Vorlagen tragen nur Rollen und Kennungen.

import type { DemoModul, DemoRufe, SaatSchritt } from './saat-fulfillment';

/** Welche Vorlagen die Demo übernimmt: Leadeingang (mit Teilprozess), Sales-Übergabe, Verloren-Auswertung, Netzwerken-Nachlauf, Angebot nachfassen. */
export const DEMO_VORLAGEN = ['kg-v09', 'kg-v12', 'kg-v13', 'kg-v02', 'kg-v10'] as const;

export const PROZESSE_ROUTEN = {
  werkstatt: () => import('@/app/api/prozesse/werkstatt/route') as Promise<DemoModul>,
};

export async function prozesseAusVorlagenSaen(k: { lena: string; eigner: string; rufe: DemoRufe }): Promise<SaatSchritt[]> {
  let angelegt = 0, probelauf = 0;
  for (const vorlageId of DEMO_VORLAGEN) {
    const r = await k.rufe(PROZESSE_ROUTEN.werkstatt(), 'POST', '/api/prozesse/werkstatt?space=business', k.lena, { aktion: 'aus-vorlage', vorlageId, eigner: k.eigner }) as { eintrag?: { status?: string }; teile?: unknown[] };
    angelegt += 1 + (r.teile?.length ?? 0);
    if (r.eintrag?.status === 'probelauf') probelauf++;
  }
  return [{ name: 'Prozesse aus Vorlagen', anzahl: angelegt }, { name: 'Prozesse im Probelauf', anzahl: probelauf }];
}

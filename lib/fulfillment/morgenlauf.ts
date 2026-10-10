// ─── Fulfillment — Morgenlauf (Hub, Server, C0, 10.10.) ────────────────────────────────────────────────────────────────────────────
// Ein Schritt „Fulfillment“ im Morgenlauf (app/api/tagesstart/route.ts) ruft die drei Pakete nacheinander — jedes in eigener Fehlerhülle,
// ein Fehler hält die anderen nicht auf. Die Pakete legen NUR Vorschläge in den Freigabe-Stapel (+ Glocke) und sind idempotent über Marken;
// verschickt, eingeladen oder gestartet wird hier nie etwas (Human-in-the-Loop). Diese Datei gehört C0 — die Pakete füllen ihre Teile.

import type { MorgenlaufTeil } from './typen';

export interface FulfillmentMorgenlauf { vorschlaege: number; teile: Record<'prozesse' | 'kunde' | 'analyse', MorgenlaufTeil | { fehler: string }>; text: string }

export async function fulfillmentMorgenlauf(h: string, heute: string): Promise<FulfillmentMorgenlauf> {
  const sicher = async (f: () => Promise<MorgenlaufTeil>): Promise<MorgenlaufTeil | { fehler: string }> => {
    try { return await f(); } catch (e) { return { fehler: e instanceof Error ? e.message.slice(0, 200) : 'Fehler' }; }
  };
  const prozesse = await sicher(async () => (await import('./prozesse/server')).prozesseMorgenlauf(h, heute));
  const kunde = await sicher(async () => (await import('./kunde/server')).kundeMorgenlauf(h, heute));
  const analyse = await sicher(async () => (await import('./analyse/server')).analyseMorgenlauf(h, heute));
  const teile = { prozesse, kunde, analyse };
  const vorschlaege = Object.values(teile).reduce((n, t) => n + ('vorschlaege' in t ? t.vorschlaege : 0), 0);
  const fehler = Object.entries(teile).filter(([, t]) => 'fehler' in t).map(([k]) => k);
  const text = [vorschlaege ? `${vorschlaege} Vorschl${vorschlaege === 1 ? 'ag' : 'äge'} im Stapel` : 'nichts fällig', fehler.length ? `Fehler: ${fehler.join(', ')}` : ''].filter(Boolean).join(' · ');
  return { vorschlaege, teile, text };
}

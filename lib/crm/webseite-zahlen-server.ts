// ─── Website-Zahlen für den Traktions-Index — Laden (Server, 31.10., Website-Anbau) ─────────────────────────────────────────────────────
// EINE Lesestelle für alle Aufrufer des Traktions-Index (Überblick, Business-Index, ZOE, Agenten-Kontext) — eine Zahl überall. Nur Schalter und
// Tage abgeschlossener Checks, nie Adressen. Wirft nie (Fehler → undefined = Lücke, der Index ist dann der bisherige).

import { tagVon } from '@/lib/zeit';
import type { WebseiteStand } from './webseite-zahlen';

export async function webseiteStandLaden(): Promise<WebseiteStand | undefined> {
  try {
    const { ladeCheckEinstellungen, ladeCheckBestand } = await import('@/lib/check/speicher');
    const { ladeKontaktformularEinstellungen } = await import('@/lib/kontaktformular/server');
    const [c, k] = await Promise.all([ladeCheckEinstellungen(), ladeKontaktformularEinstellungen()]);
    const aktiv = c.aktiv || k.aktiv;
    if (!aktiv) return { aktiv: false, checks: [] };
    const { vorlageVon } = await import('@/lib/check/katalog');
    const b = await ladeCheckBestand();
    return { aktiv, checks: b.sitzungen.filter(s => !!s.abgeschlossen).map(s => ({ tag: tagVon(s.abgeschlossen!), name: vorlageVon(s.vorlage)?.name ?? 'Check' })) };
  } catch { return undefined; }
}

// ─── Head of IT — die Lage einsammeln (Server, 27.09.) ──────────────────────
// innen: was der Prozess und die Bestände hergeben · host: deploy/lage-sammeln.sh
// (Cron, alle 5 min → <daten>/system/lage.json, Klartext, nur Zähler) · außen:
// die letzte Meldung der GitHub-Aktion (Speicher hoi-aussen). Zusammengeführt
// von lib/hoi/lage.ts (rein, getestet).

import fs from 'node:fs/promises';
import path from 'node:path';
import { loadJson, datenOrdner, datenSchluessel } from '@/lib/store/local-db';
import { lies, stand } from '@/lib/jarvis/auftraege';
import { alle } from '@/lib/zugang/anmeldungen';
import { befundeAus, gesamt, kurzbericht, nachRang, type InnenLage, type HostLage, type AussenLage, type Befund } from './lage';
import { fehlerquote24h, fehlanmeldungen24h, neueNetze7d, cspBild, type CspMeldung } from './rechnen';

export const HOI_AUSSEN = 'hoi-aussen';
export const HOI_CSP = 'hoi-csp';
export interface AussenSpeicher { meldungen: (AussenLage & { laeufer?: string })[] }
export interface CspSpeicher { meldungen: CspMeldung[] }

const systemOrdner = () => path.join(datenOrdner(), 'system');

/** Der Arbeiter meldet sich bei jedem Takt — eine winzige Datei mit Zeitstempel, kein Bestand, keine Verschlüsselung nötig. */
export async function herzschlag(): Promise<void> {
  try { await fs.mkdir(systemOrdner(), { recursive: true }); await fs.writeFile(path.join(systemOrdner(), 'takt.txt'), new Date().toISOString()); } catch { /* ohne Datei bleibt der Takt grau */ }
}

async function letzterTakt(jetzt: string): Promise<number | null> {
  try { const t = (await fs.readFile(path.join(systemOrdner(), 'takt.txt'), 'utf8')).trim(); const z = Date.parse(t); return Number.isNaN(z) ? null : Math.max(0, Math.round((Date.parse(jetzt) - z) / 60_000)); } catch { return null; }
}

async function bestaende(): Promise<InnenLage['bestaende']> {
  try {
    const ordner = datenOrdner();
    const namen = (await fs.readdir(ordner)).filter(f => f.endsWith('.json') && !f.includes('.corrupt-'));
    const groessen = await Promise.all(namen.map(async n => { try { const st = await fs.stat(path.join(ordner, n)); return { name: n.replace(/\.json$/, ''), mb: st.size / 1_048_576 }; } catch { return null; } }));
    const liste = groessen.filter((g): g is { name: string; mb: number } => !!g);
    return { anzahl: liste.length, gesamtMb: liste.reduce((s, g) => s + g.mb, 0), groesste: [...liste].sort((a, b) => b.mb - a.mb).slice(0, 3).map(g => ({ name: g.name, mb: Math.round(g.mb * 100) / 100 })) };
  } catch { return { anzahl: 0, gesamtMb: 0, groesste: [] }; }
}

export async function innenLage(jetzt = new Date().toISOString()): Promise<InnenLage> {
  const [auftraege, warte, anmeldungen, takt, best, fehlerDatei, csp] = await Promise.all([
    lies().catch(() => []), stand().catch(() => ({ offen: 0, laeuft: 0, fertig: 0, fehler: 0 })), alle().catch(() => []), letzterTakt(jetzt), bestaende(),
    loadJson<{ meldungen: { at: string; text: string; anzahl: number }[] }>('client-fehler').catch(() => null),
    loadJson<CspSpeicher>(HOI_CSP).catch(() => null),
  ]);
  const ab24 = Date.parse(jetzt) - 24 * 3_600_000;
  const frischeFehler = (fehlerDatei?.meldungen ?? []).filter(m => Date.parse(m.at) >= ab24);
  const mem = process.memoryUsage();
  return {
    zeit: jetzt,
    prozess: { laufzeitStunden: process.uptime() / 3600, heapMb: Math.round(mem.heapUsed / 1_048_576), rssMb: Math.round(mem.rss / 1_048_576), node: process.version },
    bestaende: best,
    takt: { letzterLaufMinuten: takt, fehlerquote24h: fehlerquote24h(auftraege, jetzt), wartend: warte.offen, laufend: warte.laeuft },
    fehler: { client24h: frischeFehler.reduce((s, m) => s + (m.anzahl || 1), 0), ...(frischeFehler.length ? { letzter: frischeFehler[frischeFehler.length - 1].text.slice(0, 120) } : {}) },
    anmeldungen: { fehl24h: fehlanmeldungen24h(anmeldungen, jetzt), neueNetze7d: neueNetze7d(anmeldungen, jetzt) },
    csp: cspBild(csp?.meldungen ?? [], jetzt),
    verschluesselt: datenSchluessel() !== null,
  };
}

/** Der Lagebericht des Hosts — Klartext-JSON vom Cron-Skript, kein Bestand der App. */
export async function hostLage(): Promise<HostLage | null> {
  try { const t = await fs.readFile(path.join(systemOrdner(), 'lage.json'), 'utf8'); const j = JSON.parse(t); return j && typeof j === 'object' ? j as HostLage : null; } catch { return null; }
}

export async function aussenLage(): Promise<AussenLage | null> {
  const s = await loadJson<AussenSpeicher>(HOI_AUSSEN).catch(() => null);
  return s?.meldungen?.length ? s.meldungen[s.meldungen.length - 1] : null;
}

export interface Lage { zeit: string; innen: InnenLage; host: HostLage | null; aussen: AussenLage | null; befunde: Befund[]; gesamt: ReturnType<typeof gesamt>; kurz: string; produktion: boolean }

/** Alles zusammen — für /api/hoi/lage, die Seite und den Kurzbericht. */
export async function lage(jetzt = new Date().toISOString()): Promise<Lage> {
  const [innen, host, aussen] = await Promise.all([innenLage(jetzt), hostLage(), aussenLage()]);
  const befunde = nachRang(befundeAus(innen, host, aussen, jetzt));
  return { zeit: jetzt, innen, host, aussen, befunde, gesamt: gesamt(befunde), kurz: kurzbericht(befunde, jetzt), produktion: process.env.NODE_ENV === 'production' };
}

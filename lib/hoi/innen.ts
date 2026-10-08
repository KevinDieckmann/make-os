// ─── Head of IT — die Lage einsammeln (Server, 27.09.) ──────────────────────
// innen: was der Prozess und die Bestände hergeben · host: deploy/lage-sammeln.sh
// (Cron, alle 5 min → <daten>/system/lage.json, Klartext, nur Zähler) · außen:
// die letzte Meldung der GitHub-Aktion (Speicher hoi-aussen). Zusammengeführt
// von lib/hoi/lage.ts (rein, getestet).

import { absichtenLage, MINDEST_ALTER_MS } from '@/lib/store/absichten-fortsetzen';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadJson, datenOrdner, datenSchluessel, datenschichtLage } from '@/lib/store/local-db';
import { messBild } from '@/lib/store/messwerte';
import { schluesselQuelle, formatModus, formatModusUnbekannt } from '@/lib/store/huelle.mjs';
import { fremderSchreiber } from '@/lib/store/betrieb';
import { tmpResteZaehlen, DURCHSICHT_SPEICHER, type DurchsichtErgebnis } from '@/lib/store/durchsicht';
import { lies, stand } from '@/lib/zoe/auftraege';
import { alle } from '@/lib/zugang/anmeldungen';
import { befundeAus, gesamt, kurzbericht, nachRang, type InnenLage, type HostLage, type AussenLage, type Befund, type DatenschichtLage, type SicherungLauf, type DurchsichtKurz, type KalenderLage, type GoogleKalenderLage, type GmailLage, type IcloudPersonenLage } from './lage';
import { verbunden as kalenderVerbunden, ladeStand as kalenderStand, abgleichAlter, tzVersion } from '@/lib/kalender/icloud';
import { ladeSicherungStand } from '@/lib/kalender/sicherung-server';
import { googleLage } from '@/lib/kalender/google/lage';
import { gmailLage } from '@/lib/gmail/lage';
import { fehlerquote24h, fehlanmeldungen24h, neueNetze7d, cspBild, type CspMeldung } from './rechnen';
import { hasAnthropicKey, guthabenStand } from '@/lib/anthropic';
import { pepperGesetzt } from '@/lib/datenschutz/pepper';
import { grabsteinOrdnerKonfiguriert } from '@/lib/datenschutz/grabsteine';
import { zuliefererSchluessel } from '@/lib/zugang/intern';
import { altSchluesselZuletzt } from '@/lib/zugang/zulieferer';
import { riegelBild } from '@/lib/zugang/start-riegel-lauf';
import { ladeKonten } from '@/lib/zugang/konten';
import type { BrainIndexLage, KettenLage } from './lage';

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

/** Beiseitegelegte Bestände (`<name>.json.corrupt-<zeit>`, lib/store/local-db.ts) — nur Dateinamen, nie Inhalte (28.09., K1 #39). */
export function beschaedigteAus(dateien: string[]): { anzahl: number; bestaende: string[] } {
  const kaputt = dateien.filter(f => /\.json\.corrupt-\d+$/.test(f));
  return { anzahl: kaputt.length, bestaende: Array.from(new Set(kaputt.map(f => f.replace(/\.json\.corrupt-\d+$/, '')))).sort() };
}

async function bestaende(): Promise<InnenLage['bestaende']> {
  try {
    const ordner = datenOrdner();
    const alle = await fs.readdir(ordner);
    const beschaedigt = beschaedigteAus(alle);
    const namen = alle.filter(f => f.endsWith('.json') && !f.includes('.corrupt-'));
    const groessen = await Promise.all(namen.map(async n => { try { const st = await fs.stat(path.join(ordner, n)); return { name: n.replace(/\.json$/, ''), mb: st.size / 1_048_576 }; } catch { return null; } }));
    const liste = groessen.filter((g): g is { name: string; mb: number } => !!g);
    return { anzahl: liste.length, gesamtMb: liste.reduce((s, g) => s + g.mb, 0), groesste: [...liste].sort((a, b) => b.mb - a.mb).slice(0, 3).map(g => ({ name: g.name, mb: Math.round(g.mb * 100) / 100 })), beschaedigt };
  } catch { return { anzahl: 0, gesamtMb: 0, groesste: [] }; }
}

/** Datenschicht-Messwerte dieses Prozesses (29.09., Paket D-A #87/#75/#8/#9/#50) — nur Zähler. */
async function datenschicht(): Promise<DatenschichtLage> {
  const m = messBild();
  const l = datenschichtLage();
  return {
    sperrWarten: m.sperrWarten, sperrHalten: m.sperrHalten, schreiben: m.schreiben, zaehler: m.zaehler, parseLangsam: m.parseLangsam,
    sicherungFehler: l.sicherungFehler, klartext: l.klartext, tmpReste: await tmpResteZaehlen(datenOrdner()).catch(() => 0),
    fremderSchreiber: fremderSchreiber(), schluesselQuelle: schluesselQuelle(),
    format: formatModus(), formatUnbekannt: formatModusUnbekannt(),
  };
}

/** Ergebnis der nächtlichen Sicherung (Klartext-JSON von deploy/sicherung.sh, nur Zahlen) — null, wenn noch keins da ist. */
async function sicherungLauf(): Promise<SicherungLauf | null> {
  try { const j = JSON.parse(await fs.readFile(path.join(systemOrdner(), 'sicherung.json'), 'utf8')); return j && typeof j === 'object' ? j as SicherungLauf : null; } catch { return null; }
}

/** iCloud-Kalender (R-K1 #51/#K5): nur Alter, Zähler, Fehlertext — nie Titel. null = nicht verbunden. */
async function kalenderLage(jetzt: string): Promise<KalenderLage | null> {
  if (!kalenderVerbunden()) return null;
  try {
    // U1 N2: ein unlesbarer Sicherungs-Stand wird sichtbar (Fehler), statt die ganze Kalender-Lage zu verschlucken.
    const [s, sich] = await Promise.all([kalenderStand(), ladeSicherungStand().catch(() => ({ dateien: [], fehler: [{ kalender: 'Stand', grund: 'Stand der Kalender-Sicherung nicht lesbar' }] }) as Awaited<ReturnType<typeof ladeSicherungStand>>)]);
    const a = abgleichAlter(s, Date.parse(jetzt));
    return {
      vorMin: a.vorMin, veraltet: a.veraltet, ...(a.fehler ? { fehler: a.fehler.slice(0, 160) } : {}), ...(a.anmeldung ? { anmeldung: true } : {}),
      hinweise: a.hinweise?.length ?? 0, tz: tzVersion(),
      sicherung: { letzter: sich.letzter ?? null, kalender: sich.dateien.filter(d => d.at === sich.letzter).length, fehler: sich.fehler?.length ?? 0 },
    };
  } catch { return null; }
}

/** iCloud je Person (07.10.): nur Zähler und Alter — nie Namen, Apple-IDs oder Titel. null = niemand mit eigener Verbindung. */
async function icloudPersonenLage(jetzt: string): Promise<IcloudPersonenLage | null> {
  const P = await import('@/lib/kalender/icloud-person');
  const personen = await P.personenMitIcloud();
  if (!personen.length) return null;
  let vorMin: number | null = 0; let veraltet = 0; let anmeldung = 0;
  for (const p of personen) {
    const s = await P.ladePersonStand(p).catch(() => null);
    const a = s ? abgleichAlter(s, Date.parse(jetzt)) : null;
    if (!a || a.vorMin === null) vorMin = null; else if (vorMin !== null) vorMin = Math.max(vorMin, a.vorMin);
    if (!a || a.veraltet) veraltet++;
    if (a?.anmeldung) anmeldung++;
  }
  return { personen: personen.length, vorMin, veraltet, anmeldung };
}

async function durchsichtKurz(): Promise<DurchsichtKurz | null> {
  const d = (await loadJson<{ letzter?: DurchsichtErgebnis }>(DURCHSICHT_SPEICHER).catch(() => null))?.letzter;
  if (!d) return null;
  return { zeit: d.zeit, bestaende: d.bestaende, zeilen: d.zeilen, fehler: d.fehler.length, klartext: d.klartext, alteHuellen: d.alteHuellen, alteForm: d.alteForm, spruenge: d.spruenge, tmpReste: d.tmpReste, verbindungen: d.verbindungen };
}

/** Brain-Index (05.10.): Ort, Größe, tmpfs-Grenze, Neubau — nur Zahlen. null, wenn der Index aus ist. */
export async function brainIndexLage(): Promise<BrainIndexLage | null> {
  if (process.env.MAKE_OS_BRAIN_INDEX === 'aus') return null;
  try {
    const ix = await import('@/lib/brain/index');
    const ort = ix.indexOrt();
    let grenzeMb: number | null = null;
    if (ort.art === 'tmpfs') {
      try { const st = await fs.statfs(path.dirname(ort.pfad)); grenzeMb = Math.round((st.blocks * st.bsize) / 1_048_576); } catch { grenzeMb = null; }
    }
    const st = ix.indexStand();
    const nb = ix.neubauStand();
    return { ort: ort.art, grund: ort.grund, klartextAufPlatte: ort.klartextAufPlatte, altDateiDa: await ix.alterIndexDa(), groesseMb: ix.indexGroesseMb(), grenzeMb, notizen: st.notizen, bereit: ix.indexBereit(), neubau: { fertig: nb.fertig, dauerMs: nb.dauerMs, fehler: nb.fehler } };
  } catch { return null; }
}

/** Letzte Prüfung der Protokoll-Kette (05.10.) — null: noch keine. */
async function kettenLage(): Promise<KettenLage | null> {
  const { letztePruefung } = await import('@/lib/store/protokoll-kette');
  const p = await letztePruefung();
  return p ? { zeit: p.zeit, ok: p.ok, dateien: p.dateien, eintraege: p.eintraege, fehler: p.fehler, warnungen: p.warnungen, getilgt: p.getilgt, namen: p.befunde.filter(b => b.stand === 'fehler').map(b => b.name) } : null;
}

export async function innenLage(jetzt = new Date().toISOString()): Promise<InnenLage> {
  const [auftraege, warte, anmeldungen, takt, best, fehlerDatei, csp, ds, sl, dk] = await Promise.all([
    lies().catch(() => []), stand().catch(() => ({ offen: 0, laeuft: 0, fertig: 0, fehler: 0 })), alle().catch(() => []), letzterTakt(jetzt), bestaende(),
    loadJson<{ meldungen: { at: string; text: string; anzahl: number }[] }>('client-fehler').catch(() => null),
    loadJson<CspSpeicher>(HOI_CSP).catch(() => null),
    datenschicht(), sicherungLauf(), durchsichtKurz(),
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
    ki: { schluessel: hasAnthropicKey(), guthabenLeerSeit: guthabenStand().leerSeit },
    datenschicht: ds, sicherungLauf: sl, durchsicht: dk,
    datenschutz: { pepper: pepperGesetzt(), grabsteinOrdner: grabsteinOrdnerKonfiguriert(), produktion: process.env.NODE_ENV === 'production' },
    absichten: await absichtenLage(new Date(jetzt), MINDEST_ALTER_MS),
    kalender: await kalenderLage(jetzt),
    kalenderGoogle: await googleLage(Date.parse(jetzt)).catch((): GoogleKalenderLage | null => null),
    kalenderIcloudPersonen: await icloudPersonenLage(jetzt).catch((): IcloudPersonenLage | null => null),
    gmail: await gmailLage(Date.parse(jetzt)).catch((): GmailLage | null => null),
    postfaecher: await import('@/lib/postfach/lage').then(m => m.postfachLage(Date.parse(jetzt))).catch(() => null),
    whatsapp: await import('@/lib/whatsapp/lage').then(m => m.whatsappLage(Date.parse(jetzt))).catch(() => null),
    whoop: await import('@/lib/whoop/lage').then(m => m.whoopLage(Date.parse(jetzt))).catch(() => null),
    einrichtung: await (async () => {
      const [g, w, h] = await Promise.all([import('@/lib/google/verbindung'), import('@/lib/whatsapp/konfig'), import('@/lib/whoop/konfig')]);
      return { google: !!g.googleKonfig(), whatsapp: !!w.whatsappKonfig(), whoop: h.whoopFehlt().length === 0 };
    })().catch(() => null),
    zugang: {
      zuliefererSchluessel: zuliefererSchluessel() !== null, zuliefererAltZuletzt: await altSchluesselZuletzt(),
      riegel: (({ modus, maengel }) => ({ modus, maengel }))(riegelBild()),
      zweiFaktor: await ladeKonten().then(st => ({ pflicht: !!st.einstellungen?.zweiFaktorPflicht, ohne: st.konten.filter(k => !k.zweiterFaktor).length, konten: st.konten.length })).catch(() => undefined),
    },
    brainIndex: await brainIndexLage(),
    protokollKette: await kettenLage().catch(() => null),
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

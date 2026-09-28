// ─── Nächtliche Durchsicht der Bestände (29.09., Paket D-A #85/#31/#89/#75) ─────
// Ein still falsch verschlüsselter, schemafremder oder schleichend schrumpfender Bestand fiel bisher
// erst auf, wenn ihn jemand brauchte — dann steckte er schon in allen Sicherungen. Der Takt stößt
// deshalb einmal am Tag (ab 4 Uhr, nach der Sicherung) diese Durchsicht an:
//   · jeden Bestand <name>.json roh lesen, entschlüsseln (Hülle v1/v2), parsen (Zeit gemessen), Zeilen zählen;
//   · Hüllen-Fassung und Schemaversion zählen (alte Hüllen/alte Form = Migration offen);
//   · Zeilenzahl-Sprünge gegen den Vortag melden (−20 % und mehr bzw. Bestand verschwunden);
//   · die Verbindungsprüfung des CRM laufen lassen (nur Zähler je Schwere, repariert nichts);
//   · liegengebliebene .tmp-Reste zählen.
// Ergebnis im Bestand `hoi-durchsicht` (Rauschen, nur Zahlen und Bestandsnamen, keine Inhalte); der Head of IT
// macht daraus Befunde. Liest ohne Sperre (nur lesen) und schreibt nie in fremde Bestände.

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, rohOeffnen, updateJson, loadJson } from './local-db';
import { aktuelleVersion } from './schema';
import { schluesselRing } from './huelle.mjs';
import { parseMessen } from './messwerte';
import { localDay } from '@/lib/zeit';

export const DURCHSICHT_SPEICHER = 'hoi-durchsicht';
/** Ab dieser Größe zählt ein Rückgang als Sprung. */
const SPRUNG_AB = 10;
const SPRUNG_ANTEIL = 0.2;
const TAGE_BEHALTEN = 31;

export interface DurchsichtErgebnis {
  zeit: string;
  tag: string;
  dauerMs: number;
  bestaende: number;
  zeilen: number;
  /** nicht lesbar/parsbar (Name + kurzer Grund, nie Inhalt) */
  fehler: { name: string; grund: string }[];
  klartext: number;
  alteHuellen: number;
  alteForm: number;
  spruenge: { name: string; vorher: number; nachher: number }[];
  langsam: { name: string; ms: number; mb: number }[];
  tmpReste: number;
  verbindungen: { fehler: number; warnung: number; hinweis: number } | { nichtGeprueft: string };
}
interface DurchsichtSpeicher { letzter?: DurchsichtErgebnis; zeilen?: { tag: string; je: Record<string, number> }[] }

/** Datensätze: Liste → Länge; Objekt → Summe seiner Listen (sonst 1). Rein. */
export function zeilenZaehlen(x: unknown): number {
  if (Array.isArray(x)) return x.length;
  if (x && typeof x === 'object') return Object.entries(x).filter(([k, v]) => k !== '_v' && Array.isArray(v)).reduce((s, [, l]) => s + (l as unknown[]).length, 0) || 1;
  return 1;
}

/** Sprünge gegenüber dem Vortag — rein. Rückgang um ≥ 20 % (ab 10 Zeilen) oder verschwunden. */
export function spruengeFinden(vorher: Record<string, number>, jetzt: Record<string, number>): { name: string; vorher: number; nachher: number }[] {
  const raus: { name: string; vorher: number; nachher: number }[] = [];
  for (const [name, v] of Object.entries(vorher)) {
    const n = jetzt[name] ?? 0;
    if (v >= SPRUNG_AB && n <= v * (1 - SPRUNG_ANTEIL)) raus.push({ name, vorher: v, nachher: n });
  }
  return raus.sort((a, b) => (a.nachher / a.vorher) - (b.nachher / b.vorher));
}

async function tmpResteZaehlen(ordner: string): Promise<number> {
  const alt = Date.now() - 10 * 60_000; // laufende Schreibungen nicht mitzählen
  let n = 0;
  for (const o of [ordner, path.join(ordner, 'backup'), path.join(ordner, 'archiv')]) {
    for (const f of await fs.readdir(o).catch(() => [] as string[])) {
      if (!f.endsWith('.tmp')) continue;
      try { if ((await fs.stat(path.join(o, f))).mtimeMs < alt) n++; } catch { /* inzwischen weg */ }
    }
  }
  return n;
}
export { tmpResteZaehlen };

export async function durchsicht(jetzt = new Date(), vorherJe: Record<string, number> = {}): Promise<{ ergebnis: DurchsichtErgebnis; je: Record<string, number> }> {
  const t0 = Date.now();
  const ordner = datenOrdner();
  const je: Record<string, number> = {};
  const fehler: DurchsichtErgebnis['fehler'] = [];
  const langsam: DurchsichtErgebnis['langsam'] = [];
  let klartext = 0, alteHuellen = 0, alteForm = 0, zeilen = 0;
  const namen = (await fs.readdir(ordner).catch(() => [] as string[])).filter(f => /^[a-z0-9][a-z0-9-]*\.json$/.test(f)).sort();
  for (const datei of namen) {
    const name = datei.replace(/\.json$/, '');
    try {
      const roh = await fs.readFile(path.join(ordner, datei), 'utf8');
      const g = rohOeffnen(roh, name);
      const p0 = performance.now();
      const daten = JSON.parse(g.text) as unknown;
      const ms = performance.now() - p0;
      parseMessen(name, ms, g.text.length);
      if (ms >= 50) langsam.push({ name, ms: Math.round(ms), mb: Math.round((g.text.length / 1_048_576) * 100) / 100 });
      if (g.version === 0 && schluesselRing().aktiv) klartext++; // nur mit Migrationsschalter lesbar
      if (g.version === 1) alteHuellen++;
      if (daten && typeof daten === 'object' && !Array.isArray(daten)) {
        const v = (daten as { _v?: unknown })._v;
        if ((typeof v === 'number' ? v : 0) < aktuelleVersion(name)) alteForm++;
      }
      je[name] = zeilenZaehlen(daten);
      zeilen += je[name];
    } catch (e) {
      const grund = e instanceof Error ? e.message.replace(/^\[local-db\] [^:]+: /, '').slice(0, 90) : 'unbekannt';
      if (/Klartext/.test(grund)) klartext++;
      fehler.push({ name, grund });
    }
  }
  let verbindungen: DurchsichtErgebnis['verbindungen'];
  try {
    const { ladeVerbindungsBestaende } = await import('@/lib/crm/verbindungen-laden');
    const { verbindungenPruefen } = await import('@/lib/crm/verbindungen');
    const b = verbindungenPruefen(await ladeVerbindungsBestaende(localDay(jetzt)));
    const zahl = (s: string) => b.filter(x => x.schwere === s).reduce((n, x) => n + (x.anzahl ?? 1), 0);
    verbindungen = { fehler: zahl('fehler'), warnung: zahl('warnung'), hinweis: zahl('hinweis') };
  } catch (e) { verbindungen = { nichtGeprueft: e instanceof Error ? e.message.slice(0, 90) : 'unbekannt' }; }
  const ergebnis: DurchsichtErgebnis = {
    zeit: jetzt.toISOString(), tag: localDay(jetzt), dauerMs: Date.now() - t0, bestaende: Object.keys(je).length + fehler.length, zeilen,
    fehler, klartext, alteHuellen, alteForm, spruenge: spruengeFinden(vorherJe, je), langsam: langsam.sort((a, b) => b.ms - a.ms).slice(0, 5),
    tmpReste: await tmpResteZaehlen(ordner), verbindungen,
  };
  return { ergebnis, je };
}

/** Der Takt-Lauf: einmal am Tag (Riegel = Tag im Bestand), `erzwingen` übergeht ihn. Vergleicht mit dem letzten Tag davor. */
export async function durchsichtLauf(jetzt = new Date(), erzwingen = false): Promise<{ ok: boolean; uebersprungen?: boolean; text: string; ergebnis?: DurchsichtErgebnis }> {
  const heute = localDay(jetzt);
  const alt = (await loadJson<DurchsichtSpeicher>(DURCHSICHT_SPEICHER)) ?? {};
  if (!erzwingen && alt.letzter?.tag === heute) return { ok: true, uebersprungen: true, text: 'heute schon gelaufen' };
  const vortag = [...(alt.zeilen ?? [])].filter(z => z.tag < heute).sort((a, b) => a.tag.localeCompare(b.tag)).pop();
  const { ergebnis, je } = await durchsicht(jetzt, vortag?.je ?? {});
  await updateJson<DurchsichtSpeicher>(DURCHSICHT_SPEICHER, cur => {
    const zeilen = [...(cur?.zeilen ?? []).filter(z => z.tag !== heute), { tag: heute, je }].sort((a, b) => a.tag.localeCompare(b.tag));
    // Nur die Zahlen der letzten 31 Tage — ältere Tage fallen heraus (keine Inhalte, reine Zähler).
    return { letzter: ergebnis, zeilen: zeilen.slice(-TAGE_BEHALTEN) };
  });
  const v = 'fehler' in ergebnis.verbindungen ? `Verbindungen ${ergebnis.verbindungen.fehler} Fehler/${ergebnis.verbindungen.warnung} Warnungen` : 'Verbindungen nicht geprüft';
  const text = `${ergebnis.bestaende} Bestände, ${ergebnis.zeilen} Zeilen, ${ergebnis.fehler.length} unlesbar, ${ergebnis.spruenge.length} Sprünge, ${ergebnis.klartext} Klartext, ${ergebnis.alteHuellen} alte Hüllen, ${ergebnis.tmpReste} .tmp-Reste, ${v} (${ergebnis.dauerMs} ms)`;
  return { ok: ergebnis.fehler.length === 0, text, ergebnis };
}

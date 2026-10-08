// ─── Arbeitsrahmen je Person — Laden und Speichern (Server, 08.10., Lücke 7) ──────────────────────────────────────────
// Die Regel steht rein in lib/arbeitsrahmen/regel.ts. Hier nur: woher die Fenster kommen und wer sie sieht.
//   Familie   `familie--<haushalt>` › `einstellungen.businessFrei` — gilt für jedes VOLLE Mitglied des Haushalts (dieselbe
//             Grenze wie die Familie selbst: `haushaltFuer`, Konten mit `finanzRecht: 'business'` gehören nicht dazu).
//             Nur LESEN (nie `ladeFamilie` — das legte einen fehlenden Bestand an): fehlt der Bestand, gibt es keine Fenster;
//             fehlen nur die Einstellungen darin, gilt der Standard der Familie (wie die Oberfläche ihn zeigt).
//   Eigene    `arbeitsrahmen--<person>` (immer mit Suffix) — nur die Person selbst liest und schreibt sie (Route
//             /api/arbeitsrahmen), sie kann nur einschränken.
// Ein Lesefehler sperrt nichts (offen statt blockiert, mit Warnung im Protokoll) — Business-frei ist ein Schutz, kein Riegel,
// der die Arbeit lahmlegt, wenn ein Bestand gerade nicht lesbar ist.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { wandzeit, ausWandzeit, tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { familieName, STANDARD_EINSTELLUNGEN } from '@/lib/familie/speicher';
import { businessFreiFenster, fensterLesen, fensterPruefen, freiBis, type BusinessFreiFenster, type Rahmen, type Spanne } from './regel';

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Bestand der eigenen Ergänzung — immer `arbeitsrahmen--<speicher>` (auch beim Erstkonto). */
export const eigenerRahmenName = (person: string): string => {
  if (!PERSON.test(person)) throw new Error('[arbeitsrahmen] Person ungültig');
  return `arbeitsrahmen--${person}`;
};

export interface EigeneDatei { businessFrei: BusinessFreiFenster[]; geaendertAm?: string }

/** Fingerabdruck der eigenen Ergänzung für „Stand“ (409 bei fremder Änderung) — ohne Uhrzeit, nur der Inhalt. */
export const eigenerStand = (d: EigeneDatei | null): string => JSON.stringify(d?.businessFrei ?? []);

async function familieFenster(haushalt: string): Promise<BusinessFreiFenster[]> {
  const f = await loadJson<{ einstellungen?: { businessFrei?: unknown } }>(familieName(haushalt));
  if (!f) return [];
  return fensterLesen(f.einstellungen ? f.einstellungen.businessFrei : STANDARD_EINSTELLUNGEN.businessFrei);
}

/** Der Rahmen einer Person: Familie (nur volle Haushaltsmitglieder) + eigene Ergänzung. Gemerkt 30 s je Person. */
export async function rahmenFuer(person: string): Promise<Rahmen & { ausFamilie: boolean }> {
  if (!PERSON.test(person)) return { familie: [], eigene: [], ausFamilie: false };
  return merken(`arbeitsrahmen:${person}`, 30_000, async () => {
    let familie: BusinessFreiFenster[] = [], eigene: BusinessFreiFenster[] = [], ausFamilie = false;
    try {
      const h = await haushaltFuer(person);
      if (h) { ausFamilie = true; familie = await familieFenster(h.haushalt); }
    } catch (e) { console.warn(`[arbeitsrahmen] Familie nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); }
    try { eigene = fensterLesen((await loadJson<EigeneDatei>(eigenerRahmenName(person)))?.businessFrei); }
    catch (e) { console.warn(`[arbeitsrahmen] eigener Rahmen nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); }
    return { familie, eigene, ausFamilie };
  });
}

/** Die Business-freien Spannen einer Person in [von, bis) (Berliner Tage). */
export async function businessFreiFensterFuer(person: string, von: string, bis: string): Promise<Spanne[]> {
  return businessFreiFenster(await rahmenFuer(person), von, bis);
}

export interface FreiJetzt { frei: boolean; /** Ende als Berliner Wandzeit (exklusiv). */ bisWand?: string; /** Ende als echter Zeitpunkt (ISO). */ bisIso?: string }

/** Aus Spannen um `jetzt`: frei? und bis wann (über Mitternacht und angrenzende Fenster hinweg). */
export function freiAus(spannen: readonly Spanne[], jetzt: Date): FreiJetzt {
  const b = freiBis(spannen, wandzeit(jetzt));
  return b ? { frei: true, bisWand: b, bisIso: ausWandzeit(b).toISOString() } : { frei: false };
}

/** Ist die Person JETZT Business-frei — und bis wann? Schaut zwei Tage voraus (Sonntag + Montagabend …). */
export async function businessFreiJetzt(person: string, jetzt: Date = new Date()): Promise<FreiJetzt> {
  const heute = localDay(jetzt);
  return freiAus(await businessFreiFensterFuer(person, heute, tagPlus(heute, 3)), jetzt);
}

/**
 * Der Haushalt des Inhabers ist JETZT Business-frei (nur die gemeinsamen Zeiten der Familie — die eigene Ergänzung einer
 * Person hält nicht das ganze Team auf). Für Systemläufe ohne Person (Heads, Head of Finance, Takt).
 */
export async function haushaltFensterFuer(von: string, bis: string): Promise<Spanne[]> {
  try {
    const h = await haushaltDesInhabers();
    if (!h) return [];
    return businessFreiFenster(await merken(`arbeitsrahmen-haushalt:${h}`, 30_000, () => familieFenster(h)), von, bis);
  } catch { return []; }
}
export async function haushaltBusinessFreiJetzt(jetzt: Date = new Date()): Promise<FreiJetzt> {
  const heute = localDay(jetzt);
  return freiAus(await haushaltFensterFuer(tagPlus(heute, -1), tagPlus(heute, 3)), jetzt);
}

/** Wer von diesen Personen ist JETZT nicht Business-frei? (Markttraktion-Nachrichten, Power Hour.) */
export async function nichtBusinessFrei(personen: readonly string[], jetzt: Date = new Date()): Promise<string[]> {
  const raus: string[] = [];
  for (const p of personen) if (!(await businessFreiJetzt(p, jetzt).catch(() => ({ frei: false }))).frei) raus.push(p);
  return raus;
}

/** Die eigene Ergänzung lesen (nur für die Person selbst). */
export async function eigeneLesen(person: string): Promise<{ fenster: BusinessFreiFenster[]; stand: string; geaendertAm?: string }> {
  const d = await loadJson<EigeneDatei>(eigenerRahmenName(person));
  return { fenster: fensterLesen(d?.businessFrei), stand: eigenerStand(d), ...(d?.geaendertAm ? { geaendertAm: d.geaendertAm } : {}) };
}

/** Die eigene Ergänzung schreiben — mit Stand (409, wenn ein anderes Gerät inzwischen geändert hat), Grenzen 400/413. */
export async function eigeneSetzen(person: string, roh: unknown, stand: unknown, jetzt: Date = new Date()): Promise<{ ok: true; fenster: BusinessFreiFenster[]; stand: string } | { ok: false; status: 400 | 409 | 413; fehler: string }> {
  const p = fensterPruefen(roh);
  if (!p.ok) return p;
  let konflikt = false;
  const neu = await updateJson<EigeneDatei>(eigenerRahmenName(person), cur => {
    if (typeof stand === 'string' && stand !== eigenerStand(cur)) { konflikt = true; return cur as EigeneDatei; }
    if (eigenerStand(cur) === JSON.stringify(p.fenster)) return cur as EigeneDatei;
    return { businessFrei: p.fenster, geaendertAm: jetzt.toISOString() };
  });
  if (konflikt) return { ok: false, status: 409, fehler: 'Inzwischen auf einem anderen Gerät geändert — bitte neu laden.' };
  return { ok: true, fenster: fensterLesen(neu?.businessFrei), stand: eigenerStand(neu) };
}

/**
 * Status der anderen Konten im Haushalt des Inhabers — NUR ja/nein (Plattform-Regel: Trennung serverseitig). Volle Mitglieder
 * des Haushalts bekommen zusätzlich „bis“ (sie kennen die gemeinsamen Zeiten ohnehin); Konten mit `finanzRecht: 'business'`
 * und Team-Personen nie Zeiten, nie Familieninhalte.
 */
export async function andereStatus(ich: string, jetzt: Date = new Date()): Promise<{ person: string; name: string; frei: boolean; bisWand?: string }[]> {
  const [{ konten }, h, volles] = await Promise.all([ladeKonten(), haushaltDesInhabers(), haushaltFuer(ich)]);
  const raus: { person: string; name: string; frei: boolean; bisWand?: string }[] = [];
  for (const k of konten) {
    if (k.speicher === ich || !h || k.haushalt !== h) continue;
    const s = await businessFreiJetzt(k.speicher, jetzt).catch(() => ({ frei: false } as FreiJetzt));
    raus.push({ person: k.speicher, name: (k.name ?? '').split(' ')[0] || k.speicher, frei: s.frei, ...(volles && s.frei && s.bisWand ? { bisWand: s.bisWand } : {}) });
  }
  return raus;
}

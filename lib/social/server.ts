// ─── MAKE OS — Social: Bestand und Lage (Server) — 26.10.2026 ───────────────────────────────────────────────────────────────────────
// Bestand `social--<haushalt>` (Haushalt des Inhabers — dieselbe Grenze wie die Markttraktion-Planung; Bereich Business, Speicher-Register).
// Die Lage rechnet der Server aus dem Bestand: je Folge die Prüfung (lib/social/pruefer.ts) und die Leitplanken-Entscheidung
// (lib/social/autonomie.ts), je Kanal die Analyse (lib/social/analyse.ts) und die Woche. Keine Personendaten Dritter in diesem Bestand
// (Kommentare/DMs kommen erst mit den Plattform-Anbindungen — dann eigener Bestand mit Register-Eintrag, Art. 15/17 und Löschfrist).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { socialAus, socialAnwenden, type AnwendenErgebnis } from './daten';
import { folgePruefen, type Befund } from './pruefer';
import { autonomieFuer, type AutonomieErgebnis } from './autonomie';
import { kanalAnalyse, wochenbericht, type KanalAnalyse, type Wochenbericht } from './analyse';
import type { SocialDatei, SocialFolge } from './typen';

export const socialSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `social--${h}` : 'social--inhaber');
export async function socialSpeicher(): Promise<string> { return socialSpeicherFuer(await haushaltDesInhabers()); }
export async function ladeSocial(): Promise<SocialDatei> { return socialAus(await loadJson<unknown>(await socialSpeicher())); }

/** Stand eines Eintrags (Fingerabdruck) — der Browser schickt ihn zurück; passt er nicht mehr, 409. */
export const eintragStand = (x: object): string => fingerabdruck(x as Record<string, unknown>);

export async function socialSchreiben(ops: unknown, person: string, wer?: Wer, jetzt = new Date()): Promise<AnwendenErgebnis> {
  const name = await socialSpeicher();
  let ergebnis: AnwendenErgebnis = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  let vorher: SocialDatei | null = null;
  const nachher = await updateJson<SocialDatei>(name, cur => {
    const d = socialAus(cur);
    vorher = d;
    ergebnis = socialAnwenden(d, ops, { person, jetzt: jetzt.toISOString(), standVon: eintragStand, neueId: p => neueKennung(p) });
    return ergebnis.ok ? ergebnis.datei : (cur as SocialDatei | null) ?? d;
  });
  if (ergebnis.ok) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

export interface FolgeLage { befunde: Befund[]; weg: AutonomieErgebnis }
export interface SocialLage {
  heute: string;
  datei: ReturnType<typeof mitStaenden>;
  folgen: Record<string, FolgeLage>;
  analyse: Record<string, KanalAnalyse>;
  woche: Record<string, Wochenbericht>;
}

/** Die Datei für den Browser: jeder Eintrag mit `stand`. */
export function mitStaenden(d: SocialDatei) {
  const s = <T extends object>(l: T[]) => l.map(x => ({ ...x, stand: eintragStand(x) }));
  return { kanaele: s(d.kanaele), formate: s(d.formate), folgen: s(d.folgen) };
}

export function lageAus(d: SocialDatei, heute: string): SocialLage {
  const folgen: Record<string, FolgeLage> = {};
  const heutePosts = (kanalId: string) => d.folgen.filter((f: SocialFolge) => f.kanalId === kanalId && f.veroeffentlicht.some(v => v.am === heute)).length;
  for (const f of d.folgen) {
    const kanal = d.kanaele.find(k => k.id === f.kanalId);
    if (!kanal) continue;
    const format = f.formatId ? d.formate.find(x => x.id === f.formatId) ?? null : null;
    const befunde = folgePruefen(f, { kanal, format, andere: d.folgen });
    folgen[f.id] = { befunde, weg: autonomieFuer(f, { kanal, format, befunde, heutePosts: heutePosts(kanal.id) }) };
  }
  const formatName = (id: string) => d.formate.find(x => x.id === id)?.name ?? id;
  const analyse: Record<string, KanalAnalyse> = {};
  const woche: Record<string, Wochenbericht> = {};
  for (const k of d.kanaele) {
    analyse[k.id] = kanalAnalyse(d.folgen, k.id, { formatName });
    woche[k.id] = wochenbericht(d.folgen, k.id, heute, (t, n) => tagPlus(t, -n));
  }
  return { heute, datei: mitStaenden(d), folgen, analyse, woche };
}

export async function socialLage(jetzt = new Date()): Promise<SocialLage> {
  return lageAus(await ladeSocial(), localDay(jetzt));
}

// ─── MAKE OS — Social: Was der Agent selbst darf (Stufe 2 mit Leitplanken, rein) — 26.10.2026 ────────────────────────────────────────
// Kevin 26.10.: „Selbstständig mit Leitplanken“. Die EINE Entscheidung, ob eine Folge ohne Klick veröffentlicht werden darf — jeder spätere
// Veröffentlichungs-Weg (Scheduler, Plattform-API, ZOE) fragt NUR hier. Bis dahin veröffentlicht MAKE OS nichts selbst: die Funktion
// entscheidet, die Oberfläche zeigt das Ergebnis („würde selbst posten“ / „geht in den Stapel, weil …“).
// Selbst nur, wenn ALLES stimmt: Stufe 2 · Kanal aktiv und nicht archiviert · Posten nicht angehalten · Format freigegeben · Prüfer ohne
// Stopp und ohne „Person nötig“ · Tageslimit nicht erreicht · Status „Entwurf“ oder „Freigegeben“. Sonst Stapel mit Grund — oder gar nicht.

import type { SocialFolge, SocialKanal, SocialFormat } from './typen';
import { hatStopp, brauchtMensch, BLEIBT_NACH_FREIGABE, type Befund } from './pruefer';

export type AutonomieErgebnis =
  | { weg: 'selbst'; grund: string }
  | { weg: 'bereit'; grund: string }
  | { weg: 'stapel'; grund: string }
  | { weg: 'gesperrt'; grund: string };

export interface AutonomieKontext {
  kanal: SocialKanal;
  format: SocialFormat | null | undefined;
  befunde: Befund[];
  /** Einrichtung des Kanals (pruefer.ts `kanalPruefen`) — fehlt etwas Wichtiges, darf der Agent nichts selbst. */
  kanalBefunde?: Befund[];
  /** Heute schon veröffentlicht in diesem Kanal (alle Plattformen zusammen). */
  heutePosts: number;
}

export function autonomieFuer(f: SocialFolge, k: AutonomieKontext): AutonomieErgebnis {
  const lp = k.kanal.leitplanken;
  if (hatStopp(k.befunde)) return { weg: 'gesperrt', grund: 'Der Prüfer hat einen Stopp gefunden — erst beheben.' };
  if (f.status === 'veroeffentlicht' || f.status === 'verworfen') return { weg: 'gesperrt', grund: f.status === 'veroeffentlicht' ? 'Schon veröffentlicht.' : 'Verworfen.' };
  if (k.kanal.archiviertAm || k.kanal.status === 'pausiert') return { weg: 'gesperrt', grund: 'Der Kanal ist pausiert oder archiviert.' };
  if (lp.postenAus) return { weg: 'gesperrt', grund: 'Not-Aus: Posten ist für diesen Kanal angehalten.' };
  if (f.status === 'idee') return { weg: 'gesperrt', grund: 'Noch eine Idee — erst ein Entwurf mit Skript und Hook.' };
  const einrichtung = (k.kanalBefunde ?? []).filter(b => b.stufe !== 'hinweis');
  // Eine Person hat GENAU diesen Inhalt freigegeben (27.10.): dann geht er zum Termin raus — außer bei dem, was eine Freigabe nicht klärt
  // (eigenes Erlebnis einer Personenmarke ohne ihre Freigabe, Personen im Bild ohne Einwilligung) und über dem Tageslimit.
  if (f.freigegebenAm) {
    const offen = k.befunde.find(b => b.stufe === 'mensch' && BLEIBT_NACH_FREIGABE.includes(b.code)) ?? einrichtung[0];
    if (offen) return { weg: 'stapel', grund: offen.text };
    if (k.heutePosts >= lp.postsProTag) return { weg: 'stapel', grund: `Freigegeben — Tageslimit erreicht (${lp.postsProTag} Posts), geht morgen raus.` };
    return { weg: 'bereit', grund: 'Von einer Person freigegeben — geht zum geplanten Termin raus.' };
  }
  if (lp.autonomie === 0) return { weg: 'stapel', grund: 'Stufe 0: Der Agent bereitet nur vor, ihr veröffentlicht selbst.' };
  if (lp.autonomie === 1) return { weg: 'stapel', grund: 'Stufe 1: Jede Veröffentlichung braucht einen Klick.' };
  if (!k.format) return { weg: 'stapel', grund: 'Ohne Serienformat — Neues geht immer über den Stapel.' };
  if (!k.format.freigegebenAm) return { weg: 'stapel', grund: `Das Format „${k.format.name}“ ist noch nicht freigegeben.` };
  if (k.kanal.art === 'person' && k.kanal.person && k.format.freigegebenVon !== k.kanal.person) return { weg: 'stapel', grund: 'Bei einer Personenmarke gilt nur ein Format, das die Person selbst freigegeben hat.' };
  if (einrichtung.length) return { weg: 'stapel', grund: `Einrichtung des Kanals: ${einrichtung[0].text}` };
  if (brauchtMensch(k.befunde)) return { weg: 'stapel', grund: k.befunde.filter(b => b.stufe === 'mensch').map(b => b.text)[0] ?? 'Eine Person muss es sehen.' };
  if (k.heutePosts >= lp.postsProTag) return { weg: 'stapel', grund: `Tageslimit erreicht (${lp.postsProTag} Posts) — der Rest wartet im Stapel.` };
  return { weg: 'selbst', grund: `Freigegebenes Format „${k.format.name}“, Prüfung ohne Befund, unter dem Tageslimit.` };
}

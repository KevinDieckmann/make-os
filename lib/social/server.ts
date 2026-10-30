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
import { wandzeit } from '@/lib/kalender/zeit';
import type { PostSchritt } from './veroeffentlichen';
import type { VerbindungSicht } from './verbindungen';
import type { LaufStand } from './lauf-stand';
import type { PlanLuecke } from './plan';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { socialAus, socialAnwenden, socialFuerPerson, AGENT_STEMPEL, type AnwendenErgebnis } from './daten';
import { folgePruefen, kanalPruefen, type Befund } from './pruefer';
import type { SocialMedium } from './medien';
import { kanalZiele, type ZielStand } from './ziele';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { BUSINESS_GESELLSCHAFTEN, istRegisterKennung } from '@/lib/einheiten';
import { imPapierkorb } from '@/lib/eintraege/sicher';
import { autonomieFuer, type AutonomieErgebnis } from './autonomie';
import { kanalAnalyse, wochenbericht, type KanalAnalyse, type Wochenbericht } from './analyse';
import type { SocialDatei, SocialFolge } from './typen';

export const socialSpeicherFuer = (h: string | null | undefined) => (h && HAUSHALT_OK.test(h) ? `social--${h}` : 'social--inhaber');
export async function socialSpeicher(): Promise<string> { return socialSpeicherFuer(await haushaltDesInhabers()); }
export async function ladeSocial(): Promise<SocialDatei> { return socialAus(await loadJson<unknown>(await socialSpeicher())); }

/** Stand eines Eintrags (Fingerabdruck) — der Browser schickt ihn zurück; passt er nicht mehr, 409. */
export const eintragStand = (x: object): string => fingerabdruck(x as Record<string, unknown>);

/** Wer und was im Haushalt gilt: Konten (Personenmarke) und Business-Gesellschaften (feste + Register, ohne Papierkorb). */
async function schreibUmfeld(): Promise<{ personen: string[]; gesellschaften: string[] }> {
  const h = await haushaltDesInhabers();
  if (!h) return { personen: [], gesellschaften: [...BUSINESS_GESELLSCHAFTEN] };
  const [konten, register] = await Promise.all([kontenDesHaushalts(h), ladeRegister(h).catch(() => null)]);
  const weitere = (register?.gesellschaften ?? []).filter(g => istRegisterKennung(g.id) && !imPapierkorb(g as never)).map(g => g.id);
  return { personen: konten.map(k => k.speicher), gesellschaften: [...BUSINESS_GESELLSCHAFTEN, ...weitere] };
}

/** Der Agent bzw. Veröffentlicher schreibt (Systemlauf): stempelt als `AGENT_STEMPEL`, sieht alle Kanäle, darf die Server-Schritte. */
export const socialSystemSchreiben = (ops: unknown, jetzt = new Date()): Promise<AnwendenErgebnis> =>
  socialSchreiben(ops, AGENT_STEMPEL, { art: 'zoe' }, jetzt, { system: true });

export async function socialSchreiben(ops: unknown, person: string, wer?: Wer, jetzt = new Date(), opt: { system?: boolean } = {}): Promise<AnwendenErgebnis> {
  const name = await socialSpeicher();
  const umfeld = await schreibUmfeld();
  let ergebnis: AnwendenErgebnis = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  let vorher: SocialDatei | null = null;
  const nachher = await updateJson<SocialDatei>(name, cur => {
    const d = socialAus(cur);
    vorher = d;
    ergebnis = socialAnwenden(d, ops, { person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), ...umfeld, standVon: eintragStand, neueId: p => neueKennung(p), system: opt.system === true });
    return ergebnis.ok ? ergebnis.datei : (cur as SocialDatei | null) ?? d;
  });
  if (ergebnis.ok) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

export interface FolgeLage { befunde: Befund[]; weg: AutonomieErgebnis }
export interface SocialLage {
  heute: string;
  /** Speichername der fragenden Person (für „nur ich“ und „nur die Person der Marke“ in der Oberfläche). */
  ich: string | null;
  /** Je Kanal: Einrichtung (was am Account fehlt) und Ziele mit Stand. */
  kanaele: Record<string, { befunde: Befund[]; ziele: ZielStand[] }>;
  datei: ReturnType<typeof mitStaenden>;
  folgen: Record<string, FolgeLage>;
  analyse: Record<string, KanalAnalyse>;
  woche: Record<string, Wochenbericht>;
  /** Die angehängten Medien der sichtbaren Folgen (Lese-Form, ohne Schlüssel) — für Vorschau und Freigabe-Status. */
  medien: Record<string, SocialMedium | null>;
}

/** Die Datei für den Browser: jeder Eintrag mit `stand`. */
export function mitStaenden(d: SocialDatei) {
  const s = <T extends object>(l: T[]) => l.map(x => ({ ...x, stand: eintragStand(x) }));
  return { kanaele: s(d.kanaele), formate: s(d.formate), folgen: s(d.folgen) };
}

/** Die Lage für EINE Person: fremde „nur ich“-Kanäle fehlen ganz (Filter vor jeder Rechnung, `socialFuerPerson`). */
export function lageAus(alle: SocialDatei, heute: string, person: string | null, medien?: ReadonlyMap<string, SocialMedium | null>): SocialLage {
  const d = socialFuerPerson(alle, person);
  const kanalLage: SocialLage['kanaele'] = {};
  for (const k of d.kanaele) kanalLage[k.id] = { befunde: kanalPruefen(k), ziele: kanalZiele(k, d.folgen, heute) };
  const folgen: Record<string, FolgeLage> = {};
  const heutePosts = (kanalId: string) => d.folgen.filter((f: SocialFolge) => f.kanalId === kanalId && f.veroeffentlicht.some(v => v.am === heute)).length;
  for (const f of d.folgen) {
    const kanal = d.kanaele.find(k => k.id === f.kanalId);
    if (!kanal) continue;
    const format = f.formatId ? d.formate.find(x => x.id === f.formatId) ?? null : null;
    const befunde = folgePruefen(f, { kanal, format, andere: d.folgen, medien });
    folgen[f.id] = { befunde, weg: autonomieFuer(f, { kanal, format, befunde, kanalBefunde: kanalLage[kanal.id].befunde, heutePosts: heutePosts(kanal.id) }) };
  }
  const formatName = (id: string) => d.formate.find(x => x.id === id)?.name ?? id;
  const analyse: Record<string, KanalAnalyse> = {};
  const woche: Record<string, Wochenbericht> = {};
  for (const k of d.kanaele) {
    analyse[k.id] = kanalAnalyse(d.folgen, k.id, { formatName });
    woche[k.id] = wochenbericht(d.folgen, k.id, heute, (t, n) => tagPlus(t, -n));
  }
  const sichtbareMedien: Record<string, SocialMedium | null> = {};
  for (const id of d.folgen.flatMap(f => f.medien ?? [])) sichtbareMedien[id] = medien?.get(id) ?? null;
  return { heute, ich: person, kanaele: kanalLage, datei: mitStaenden(d), folgen, analyse, woche, medien: sichtbareMedien };
}

/** Automatik (27.10.): je Folge und Plattform, was der Veröffentlicher tun wird (dieselbe Regel wie der Lauf), Verbindungen ohne Geheimteil. */
export interface AutomatikLage {
  folgen: Record<string, PostSchritt[]>;
  verbindungen: VerbindungSicht[];
  wege: { linkedin: boolean; instagram: boolean; probe: boolean };
  lauf: LaufStand;
  /** Je Kanal: die nächsten freien Plätze des Plans (Vorschau dessen, was der Agent füllen würde). */
  luecken: Record<string, PlanLuecke[]>;
}

export async function socialLage(person: string | null, jetzt = new Date()): Promise<SocialLage & { automatik: AutomatikLage }> {
  const alle = await ladeSocial();
  const d = socialFuerPerson(alle, person);
  const { socialMedienLesen } = await import('./medien');
  const medien = await socialMedienLesen(d.folgen.flatMap(f => f.medien ?? []));
  const lage = lageAus(alle, localDay(jetzt), person, medien);
  const [{ planFuer }, { ladeVerbindungen, verbindungSicht }, { ladeLaufStand }, { linkedinEingerichtet }, { instagramEingerichtet }, { probeErlaubt }, { planLuecken }] = await Promise.all([
    import('./veroeffentlichen-server'), import('./verbindungen'), import('./lauf-stand'), import('./anbieter/linkedin'), import('./anbieter/instagram'), import('./anbieter/probe'), import('./plan'),
  ]);
  const verbindungen = (await ladeVerbindungen().catch(() => [])).filter(v => d.kanaele.some(k => k.id === v.kanalId));
  const jetztWand = wandzeit(jetzt).slice(0, 16);
  const folgen: AutomatikLage['folgen'] = {};
  for (const f of d.folgen) {
    if (f.status === 'verworfen' || f.status === 'idee') continue;
    const k = d.kanaele.find(x => x.id === f.kanalId);
    if (!k) continue;
    const format = f.formatId ? d.formate.find(x => x.id === f.formatId) ?? null : null;
    folgen[f.id] = await planFuer(f, k, format, d, verbindungen, lage.heute, jetztWand, medien);
  }
  const luecken: AutomatikLage['luecken'] = {};
  for (const k of d.kanaele) luecken[k.id] = planLuecken(k, d.formate, d.folgen, jetztWand).slice(0, 7);
  return { ...lage, automatik: { folgen, verbindungen: verbindungen.map(verbindungSicht), wege: { linkedin: linkedinEingerichtet(), instagram: instagramEingerichtet(), probe: probeErlaubt() }, lauf: await ladeLaufStand().catch(() => ({})), luecken } };
}

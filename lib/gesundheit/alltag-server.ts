// ─── Gesundheit im Alltag — Server (09.10.2026) ─────────────────────────────────────────────────────────────────────────
// Liest und schreibt die Einstellungen je Person (`gesundheit-alltag`, lib/gesundheit/alltag.ts) und baut daraus die Sicht der drei
// Karten: Schlaf-Hilfe (lib/gesundheit/schlaf.ts), Tages-Check (lib/gesundheit/tages-check.ts), Essen & Trinken
// (lib/ernaehrung/orientierung.ts). Gelesen werden NUR die eigenen Bestände der Person (Vitalwerte, WHOOP-Spiegel, Journal, Sport,
// Routinen-Log, eigene Routinen) — wer welche Person anfragen darf, entscheidet allein die Route (/api/gesundheit/alltag: nur die
// Person selbst). Hier gibt es keinen Personen-Parameter von außen.
//
// Dazu der Takt der Abend-Erinnerung (`schlafJobsImTakt`, app/api/zoe/takt — jede Minute): je Person mit eingeschalteter Erinnerung,
// Einwilligung (a) und fälliger Erinnerungszeit EINE Meldung in die eigene Glocke (neutral) und — nur mit „auch aufs Handy“ — über
// den ZOE-Kanal (`anPersonMelden`, neutraler Text mit Link; das Sicherheitsnetz `telegramSicher` greift zusätzlich). Idempotent je Tag
// über den Riegel `erinnert` (in der Sperre gesetzt, bevor gemeldet wird — zwei Takte gleichzeitig melden nie doppelt).

import { createHash } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import { wandzeit } from '@/lib/kalender/zeit';
import type { VitalsLog } from '@/lib/vitals';
import { alltagAnwenden, alltagEinstellungen, alltagSaeubern, AlltagFehler, ALLTAG_BASIS, type AlltagStand } from './alltag';
import { schlafLage, erinnerungFaellig, type SchlafLage } from './schlaf';
import { naechteAus } from './schlaf-naechte';
import { aktiveFragen, checkAuswertung, checkSaeubern, checkTagFuer, ANSPANNUNG_ID, CHECK_FRAGEN, CHECK_MAX, type CheckAntworten, type CheckBefund, type CheckFortschritt, type CheckFrage } from './tages-check';
import { essenOrientierung, planBelastung, wTagVon, ERGAENZUNG_VORLAGEN, type EssenSicht, type ErgaenzungId, type ErgaenzungVorlage } from '@/lib/ernaehrung/orientierung';

/** Stand der Einstellungen (Fingerabdruck ohne Riegel/Zeitstempel); ohne Bestand `leer`. */
export function alltagFingerabdruck(a: AlltagStand | null): string {
  return a ? createHash('sha256').update(JSON.stringify(alltagEinstellungen(a))).digest('hex').slice(0, 20) : 'leer';
}

/** Die Einstellungen der Person (Vorgaben, wenn sie noch nichts eingestellt hat). Liest nur. */
export async function alltagLaden(person: string): Promise<{ alltag: AlltagStand; stand: string }> {
  const roh = await loadJson<unknown>(speicherFuer(ALLTAG_BASIS, person));
  const alltag = alltagSaeubern(roh);
  return { alltag, stand: roh ? alltagFingerabdruck(alltag) : 'leer' };
}

export type AlltagAenderung =
  | { ok: true; alltag: AlltagStand; stand: string }
  | { ok: false; status: 400 | 409 | 413; fehler: string; alltag?: AlltagStand; stand?: string };

class StandVeraltet extends Error { constructor(readonly alltag: AlltagStand, readonly stand: string) { super('Stand veraltet'); } }

/** Schritte anwenden — in EINER Sperre, nur wenn `basisStand` passt (sonst 409 mit dem aktuellen Stand). */
export async function alltagAendern(person: string, basisStand: unknown, ops: unknown, jetzt = new Date()): Promise<AlltagAenderung> {
  const heute = localDay(jetzt);
  try {
    const roh = await updateJson<unknown>(speicherFuer(ALLTAG_BASIS, person), cur => {
      const alt = alltagSaeubern(cur);
      const stand = cur ? alltagFingerabdruck(alt) : 'leer';
      if (basisStand !== stand) throw new StandVeraltet(alt, stand);
      return { ...alltagAnwenden(alt, ops, heute), geaendert: jetzt.toISOString() };
    });
    const alltag = alltagSaeubern(roh);
    return { ok: true, alltag, stand: alltagFingerabdruck(alltag) };
  } catch (e) {
    if (e instanceof StandVeraltet) return { ok: false, status: 409, fehler: 'Die Einstellungen wurden inzwischen geändert (anderes Gerät?) — neu geladen, bitte noch einmal.', alltag: e.alltag, stand: e.stand };
    if (e instanceof AlltagFehler) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
}

/** Riegel der Abend-Erinnerung setzen — true nur, wenn DIESER Aufruf ihn gesetzt hat (vorher ein anderer Tag oder keiner). */
export async function erinnertSetzen(person: string, tag: string): Promise<boolean> {
  let gesetzt = false;
  await updateJson<unknown>(speicherFuer(ALLTAG_BASIS, person), cur => {
    const a = alltagSaeubern(cur);
    if (a.erinnert === tag) return cur ?? a;
    gesetzt = true;
    return { ...(cur && typeof cur === 'object' ? cur as object : a), erinnert: tag };
  });
  return gesetzt;
}

// ── Die Sicht der Karten ─────────────────────────────────────────────────────────────────────────────────────────────

export interface CheckSicht {
  /** Aktive Fragen (Reihenfolge des Katalogs) und der ganze Katalog mit „aktiv“. */
  fragen: CheckFrage[];
  katalog: (CheckFrage & { aktiv: boolean })[];
  max: number;
  /** Nach welchem Tag gerade gefragt wird und die Antworten dort; dazu die von heute und gestern. */
  tag: string;
  welcher: 'heute' | 'gestern';
  antworten: CheckAntworten;
  befunde: CheckBefund[];
  fortschritt: CheckFortschritt[];
}
export interface ErgaenzungZeile { routine: string; label: string; vorlage: ErgaenzungId; erledigt: boolean }
export interface EssenSichtVoll {
  an: boolean;
  orientierung: EssenSicht | null;
  ergaenzungen: ErgaenzungZeile[];
  vorlagen: readonly ErgaenzungVorlage[];
}
export interface AlltagSicht {
  heute: string;
  schlaf: SchlafLage;
  check: CheckSicht;
  essen: EssenSichtVoll;
}

interface RoutineKurz { id: string; label: string; aktiv?: boolean; owner?: string }

/** Nächte der Person (Vitalwerte + WHOOP-Spiegel, nur lesen). */
async function naechteFuer(person: string, vitals?: VitalsLog | null) {
  const { ladeWhoopStand } = await import('@/lib/whoop/abgleich');
  const [log, spiegel] = await Promise.all([vitals !== undefined ? Promise.resolve(vitals) : loadJson<VitalsLog>(speicherFuer('vitals', person)), ladeWhoopStand(person).catch(() => null)]);
  return naechteAus(log, spiegel?.schlaf ?? null);
}

/** Die Schlaf-Lage der Person heute (nur lesen). */
export async function schlafLageFuer(person: string, alltag: AlltagStand, heute: string, vitals?: VitalsLog | null): Promise<SchlafLage> {
  return schlafLage(await naechteFuer(person, vitals), alltag.schlaf, heute);
}

/** Die ganze Sicht für die Karten (nur lesen). Ohne Einwilligung (a) ruft die Route das gar nicht erst auf. */
export async function alltagSicht(person: string, alltag: AlltagStand, jetzt = new Date()): Promise<AlltagSicht> {
  const heute = localDay(jetzt);
  const { saeubere } = await import('@/lib/sport/modell');
  const [vitals, journal, sportRoh, routinenF, hl] = await Promise.all([
    loadJson<VitalsLog>(speicherFuer('vitals', person)),
    loadJson<Record<string, { check?: unknown; stress?: unknown } | null>>(speicherFuer('journal', person)),
    loadJson<unknown>(speicherFuer('sport', person)),
    loadJson<{ routinen?: RoutineKurz[] }>('routinen'),
    loadJson<Record<string, string[]>>(speicherFuer('health-log', person)),
  ]);
  const schlaf = await schlafLageFuer(person, alltag, heute, vitals);

  // Tages-Check: aktive Fragen, Tag (vor 14 Uhr gestern), Antworten, Auswertung (nur eigene Tage). Stress zählt immer mit — nicht als
  // Frage, sondern aus der Anspannung 1–5 des Morgen-Checks (10.10., `ANSPANNUNG_ID`); abgelöste Antworten (`check.stress`) nie.
  const fragen = aktiveFragen(alltag.check);
  const { tag, welcher } = checkTagFuer(wandzeit(jetzt));
  const aus = checkAuswertung(journal, vitals, [...fragen.map(f => f.id), ANSPANNUNG_ID], heute);
  const check: CheckSicht = {
    fragen, katalog: CHECK_FRAGEN.map(f => ({ ...f, aktiv: fragen.some(x => x.id === f.id) })), max: CHECK_MAX,
    tag, welcher, antworten: checkSaeubern(journal?.[tag]?.check) ?? {}, befunde: aus.befunde, fortschritt: aus.fortschritt,
  };

  // Essen & Trinken: Trainingsplan des Wochentags (eigener Sport-Bestand), Lauf heute, eigene Ergänzungs-Routinen.
  const sport = saeubere(sportRoh);
  const planTag = sport.woche?.[wTagVon(heute)];
  const plan = planBelastung(planTag);
  const lauftag = planTag?.art === 'lauf' || planTag?.art === 'hyrox' || sport.laeufe.some(l => l.datum === heute);
  const erledigt = new Set(hl?.[heute] ?? []);
  const ergaenzungen: ErgaenzungZeile[] = (routinenF?.routinen ?? [])
    .filter(r => r.owner === person && r.aktiv !== false && alltag.ergaenzungen[r.id])
    .map(r => ({ routine: r.id, label: r.label, vorlage: alltag.ergaenzungen[r.id], erledigt: erledigt.has(r.id) }));
  const essen: EssenSichtVoll = {
    an: alltag.essen.orientierung,
    orientierung: alltag.essen.orientierung ? essenOrientierung({ log: vitals, heute, plan, lauftag }) : null,
    ergaenzungen, vorlagen: ERGAENZUNG_VORLAGEN,
  };
  return { heute, schlaf, check, essen };
}

// ── Takt: Abend-Erinnerung ───────────────────────────────────────────────────────────────────────────────────────────

/** Die Erinnerungszeit je Person kurz merken (die Lage ändert sich nur mit neuen Schlafwerten) — der Takt läuft jede Minute. */
const MERKEN_MS = 10 * 60_000;
const gemerkt = new Map<string, { bis: number; stand: string; tag: string; um?: string }>();

export async function schlafJobsImTakt(jetzt = new Date()): Promise<{ erinnert: number }> {
  const { alleSpeicher } = await import('@/lib/zugang/konten');
  const wand = wandzeit(jetzt);
  const heute = localDay(jetzt);
  let erinnert = 0;
  for (const person of await alleSpeicher().catch(() => [] as string[])) {
    try {
      const { alltag, stand } = await alltagLaden(person);
      if (!alltag.schlaf.erinnerung) continue;
      let m = gemerkt.get(person);
      if (!m || m.bis < jetzt.getTime() || m.stand !== stand || m.tag !== heute) {
        const lage = await schlafLageFuer(person, alltag, heute);
        m = { bis: jetzt.getTime() + MERKEN_MS, stand, tag: heute, ...(lage.erinnerungUm ? { um: lage.erinnerungUm } : {}) };
        gemerkt.set(person, m);
      }
      const f = erinnerungFaellig(m.um, wand, alltag.erinnert);
      if (!f.faellig) continue;
      const { gesundheitVerarbeitungErlaubt } = await import('@/lib/datenschutz/gesundheit-einwilligung');
      if (!(await gesundheitVerarbeitungErlaubt(person))) continue;
      if (!(await erinnertSetzen(person, f.tag))) continue;
      await schlafErinnern(person, alltag.schlaf.handy);
      erinnert++;
    } catch (e) {
      console.warn(`[schlaf] Erinnerung übersprungen: ${e instanceof Error ? e.name : 'Fehler'}`);
    }
  }
  return { erinnert };
}

/** Die Erinnerung selbst: Glocke (immer) und — nur auf Wunsch — der ZOE-Kanal. Beides neutral, ohne Uhrzeit und Werte. */
export async function schlafErinnern(person: string, handy: boolean): Promise<void> {
  const { SCHLAF_ERINNERUNG_TITEL, hinweisSchlafenszeit, appLink } = await import('@/lib/datenschutz/telegram-text');
  const { melde } = await import('@/lib/meldungen/melden');
  await melde({ an: person, art: 'gesundheit', titel: SCHLAF_ERINNERUNG_TITEL, link: '/os/gesundheit' });
  if (!handy) return;
  const { anPersonMelden } = await import('@/lib/zoe/an-person');
  const { aussenAdresse } = await import('@/lib/innen');
  await anPersonMelden(person, 'erinnerung', hinweisSchlafenszeit(appLink(aussenAdresse(), '/os/gesundheit')), { link: '/os/gesundheit' });
}

/** Für Tests: Merker leeren. */
export const schlafMerkerLeeren = () => gemerkt.clear();

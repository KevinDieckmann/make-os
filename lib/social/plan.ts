// ─── MAKE OS — Social: Redaktionsplan (rein) — 27.10.2026 ──────────────────────────────────────────────────────────────────────────
// Kevin 27.10.: „Bau tiefer und besser — es soll voll automatisiert laufen.“ Diese Stelle sagt, WANN ein Kanal etwas braucht und WAS
// (Format, Säule) — der Redaktions-Agent (agent-server.ts) füllt genau diese Plätze, der Veröffentlicher postet sie zum Termin.
// Regeln:
//   · Plätze = Wochentage des Plans × Uhrzeit, ab jetzt + `PLATZ_VORLAUF_MIN` bis heute + `vorlauf` Tage (Berliner Wandzeit).
//   · Je Kalenderwoche höchstens `proWoche` Beiträge — von Hand geplante oder schon veröffentlichte zählen mit (nie mehr als geplant).
//   · Format: die freigegebenen zuerst (nur sie darf der Agent auf Stufe 2 selbst posten), darunter das am längsten nicht genutzte.
//   · Säule: die am seltensten genutzte der letzten 10 Folgen — so bleibt der Kanal breit.
// Startannahmen, keine Plattform-Angaben: die Uhrzeit ist eine Vorgabe, die die Person ändert; die Analyse zeigt später, was wirkt.

import { montagVon, tagPlus, wochentag } from '@/lib/zeit/kalender-kern';
import { PLAN_VORGABE, type Redaktionsplan, type SocialFolge, type SocialFormat, type SocialKanal } from './typen';
import { platzBelegt } from './daten';

/** So viele Minuten vor einem Termin schreibt der Agent nichts mehr hinein (Zeit für die Prüfung und einen Blick). */
export const PLATZ_VORLAUF_MIN = 90;

export const planVon = (k: Pick<SocialKanal, 'plan'>): Redaktionsplan => k.plan ?? PLAN_VORGABE;

/** Beiträge je Woche: Plan, sonst das Ziel „Veröffentlichungen je Woche“, sonst 3 — nie mehr als Plan-Tage. */
export function proWocheVon(k: Pick<SocialKanal, 'plan' | 'ziele'>): number {
  const p = planVon(k);
  const ziel = k.ziele.find(z => z.metrik === 'posts-woche')?.zielwert;
  const soll = p.proWoche ?? (ziel ? Math.ceil(ziel) : 3);
  return Math.max(1, Math.min(soll, p.tage.length));
}

export interface PlanLuecke { platz: string; formatId?: string; saeule?: string }

/** Berliner Wandzeit `JJJJ-MM-TTTHH:MM` plus Minuten (nur für den Vergleich mit Plätzen). */
function wandPlus(wand: string, min: number): string {
  const [t, u] = [wand.slice(0, 10), wand.slice(11, 16)];
  const ges = Number(u.slice(0, 2)) * 60 + Number(u.slice(3, 5)) + min;
  const tage = Math.floor(ges / 1440);
  const rest = ((ges % 1440) + 1440) % 1440;
  return `${tagPlus(t, tage)}T${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}`;
}

/** Wurde die Folge in dieser Woche geplant bzw. veröffentlicht? (Woche = Montag) */
const wocheVon = (f: SocialFolge): string | null => {
  const tag = f.geplantAm ?? f.veroeffentlicht[0]?.am;
  return tag ? montagVon(tag) : null;
};

/**
 * Freie Plätze des Kanals mit Format- und Säulen-Vorschlag. `jetztWand` = Berliner Wandzeit `JJJJ-MM-TTTHH:MM`.
 * Rein — dieselbe Antwort für dieselben Daten (der Agent und die Vorschau in der Oberfläche fragen beide hier).
 */
export function planLuecken(k: SocialKanal, formate: readonly SocialFormat[], folgen: readonly SocialFolge[], jetztWand: string): PlanLuecke[] {
  const p = planVon(k);
  const heute = jetztWand.slice(0, 10);
  const frueheste = wandPlus(jetztWand, PLATZ_VORLAUF_MIN);
  const proWoche = proWocheVon(k);
  const eigene = folgen.filter(f => f.kanalId === k.id && f.status !== 'verworfen');
  const jeWoche = new Map<string, number>();
  for (const f of eigene) { const w = wocheVon(f); if (w) jeWoche.set(w, (jeWoche.get(w) ?? 0) + 1); }

  const plaetze: string[] = [];
  for (let i = 0; i < p.vorlauf; i++) {
    const tag = tagPlus(heute, i);
    if (!p.tage.includes(wochentag(tag))) continue;
    const platz = `${tag}T${p.uhrzeit}`;
    if (platz < frueheste || platzBelegt(eigene, k.id, platz, p.uhrzeit)) continue;
    const w = montagVon(tag);
    if ((jeWoche.get(w) ?? 0) >= proWoche) continue;
    jeWoche.set(w, (jeWoche.get(w) ?? 0) + 1);
    plaetze.push(platz);
  }

  // Rotation über die jüngsten Folgen (inklusive der eben verteilten Plätze).
  const juengste = [...eigene].sort((a, b) => (b.geplantAm ?? b.geaendert).localeCompare(a.geplantAm ?? a.geaendert)).slice(0, 10);
  const genutztFormat = new Map<string, number>();
  const genutztSaeule = new Map<string, number>();
  juengste.forEach((f, idx) => {
    if (f.formatId && !genutztFormat.has(f.formatId)) genutztFormat.set(f.formatId, idx);
    if (f.saeule) genutztSaeule.set(f.saeule, (genutztSaeule.get(f.saeule) ?? 0) + 1);
  });
  const kanalFormate = formate.filter(f => f.kanalId === k.id);
  // Freigegebene zuerst, dann das am längsten nicht genutzte (nie genutzt = am längsten).
  const formatReihe = () => [...kanalFormate].sort((a, b) =>
    Number(!!b.freigegebenAm) - Number(!!a.freigegebenAm) || (genutztFormat.get(b.id) ?? 99) - (genutztFormat.get(a.id) ?? 99) || a.name.localeCompare(b.name));
  const saeulenReihe = () => [...k.marke.saeulen].sort((a, b) => (genutztSaeule.get(a) ?? 0) - (genutztSaeule.get(b) ?? 0) || k.marke.saeulen.indexOf(a) - k.marke.saeulen.indexOf(b));

  return plaetze.map(platz => {
    const f = formatReihe()[0];
    const s = saeulenReihe()[0];
    // Das Verteilte zählt für den nächsten Platz als „gerade genutzt“.
    if (f) { for (const [id, n] of genutztFormat) genutztFormat.set(id, n + 1); genutztFormat.set(f.id, 0); }
    if (s) genutztSaeule.set(s, (genutztSaeule.get(s) ?? 0) + 1);
    return { platz, ...(f ? { formatId: f.id } : {}), ...(s ? { saeule: s } : {}) };
  });
}

/** Termin einer Folge als Wandzeit (Uhrzeit aus der Folge, sonst aus dem Plan) — null ohne Termin. */
export const terminVon = (f: Pick<SocialFolge, 'geplantAm' | 'geplantUm'>, k: Pick<SocialKanal, 'plan'>): string | null =>
  f.geplantAm ? `${f.geplantAm}T${f.geplantUm ?? planVon(k).uhrzeit}` : null;

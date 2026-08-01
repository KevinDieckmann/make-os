// ─── MAKE OS — Risk-Shields ─────────────────────────────────────────────────
// Kevins Ansage: „Warnungen, bevor es weh tut." Rein deterministische Regeln
// über die echten Stores — kein KI-Raten, keine falschen Alarme. Jede Warnung
// nennt die Zahl, den Grund und den direkten Absprung.
// NIEMALS aus Client-Komponenten importieren (zieht fs über local-db).

import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { computeMetrics, type FinanceState } from '@/lib/make-one/finance-data';
import { schwellen } from '@/lib/schwellen';

export interface Shield {
  id: string;
  stufe: 'rot' | 'amber';
  text: string;
  href: string;
  label: string;
}

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));

export async function computeShields(today = localDay()): Promise<Shield[]> {
  const [fplan, fin, tasksF, msF, wplanF] = await Promise.all([
    loadJson<{ rechnungen: { status: string; betrag: number; faellig?: string }[]; zahlungen: { status: string; betrag: number; faellig?: string; an: string }[]; uhrwerk?: { letztesMeeting: string | null } }>('finanzplan'),
    loadJson<FinanceState>('finance'),
    loadJson<{ tasks: { title: string; status: string; priority: string; dueDate?: string }[] }>('tasks'),
    loadJson<{ meilensteine: { titel: string; bereich: string; faellig?: string; erledigt: boolean }[] }>('meilensteine'),
    loadJson<Record<string, { date: string; art: string }[]>>('wochenplan'),
  ]);

  const shields: Shield[] = [];

  // ── Geld: überfällige Forderungen (rein) und überfällige Zahlungen (raus) ──
  const forderungenUeberfaellig = (fplan?.rechnungen ?? []).filter(r => r.status === 'gestellt' && r.faellig && r.faellig < today);
  if (forderungenUeberfaellig.length) {
    shields.push({
      id: 'forderungen', stufe: 'rot',
      text: `${eur(forderungenUeberfaellig.reduce((s, r) => s + r.betrag, 0))} Forderungen überfällig — nachfassen kostet einen Anruf.`,
      href: '/os/finanzen', label: 'Finanzplanung',
    });
  }
  const zahlungenUeberfaellig = (fplan?.zahlungen ?? []).filter(z => z.status === 'offen' && z.faellig && z.faellig < today);
  if (zahlungenUeberfaellig.length) {
    shields.push({
      id: 'zahlungen', stufe: 'rot',
      text: `${zahlungenUeberfaellig.length} eigene Zahlung${zahlungenUeberfaellig.length > 1 ? 'en' : ''} überfällig (${eur(zahlungenUeberfaellig.reduce((s, z) => s + z.betrag, 0))}) — Mahnkosten vermeiden.`,
      href: '/os/finanzen', label: 'Zahlungs-Prioritäten',
    });
  }

  // ── Runway: die Grenzen kommen aus dem Kompass, nicht aus dem Code ──
  if (fin) {
    const m = computeMetrics(fin);
    const s = await schwellen();
    if (m.runwayMonate != null && m.aktiveMonate > 0) {
      if (m.runwayMonate < s.runwayRot) shields.push({ id: 'runway', stufe: 'rot', text: `Runway ${m.runwayMonate.toFixed(1)} Monate — Liquidität ist DAS Thema.`, href: '/os/controlling', label: 'Controlling' });
      else if (m.runwayMonate < s.runwayAmber) shields.push({ id: 'runway', stufe: 'amber', text: `Runway ${m.runwayMonate.toFixed(1)} Monate — Puffer schrumpft.`, href: '/os/controlling', label: 'Controlling' });
    }
  }

  // ── Ausführung: kritische Aufgaben überfällig ──
  const kritischSpaet = (tasksF?.tasks ?? []).filter(t => t.status !== 'done' && t.priority === 'critical' && t.dueDate && t.dueDate < today);
  if (kritischSpaet.length) {
    shields.push({
      id: 'kritisch', stufe: 'rot',
      text: `${kritischSpaet.length} kritische Aufgabe${kritischSpaet.length > 1 ? 'n' : ''} überfällig: ${kritischSpaet.slice(0, 2).map(t => t.title).join(' · ')}${kritischSpaet.length > 2 ? ' …' : ''}`,
      href: '/os/aufgaben', label: 'Taskmanagement',
    });
  }

  // ── Meilensteine: überfällig heißt Kurs-Korrektur, nicht Kosmetik ──
  const msSpaet = (msF?.meilensteine ?? []).filter(m => !m.erledigt && m.faellig && m.faellig < today);
  if (msSpaet.length) {
    shields.push({
      id: 'meilensteine', stufe: 'amber',
      text: `${msSpaet.length} Meilenstein${msSpaet.length > 1 ? 'e' : ''} überfällig: ${msSpaet.slice(0, 2).map(m => m.titel).join(' · ')} — schieben oder ehrlich neu terminieren.`,
      href: '/os/planung/jahr', label: 'Meilensteine',
    });
  }

  // ── Finanz-Uhrwerk: alle 2 Wochen, sonst reißt der Takt ──
  const letztes = fplan?.uhrwerk?.letztesMeeting;
  if (letztes) {
    const tage = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${letztes}T12:00:00`).getTime()) / 86_400_000);
    if (tage > 16) shields.push({ id: 'finanzmeeting', stufe: 'amber', text: `Letztes Finanzmeeting vor ${tage} Tagen — der Takt ist 2× im Monat.`, href: '/os/finanzen', label: 'Finanzmeeting' });
  }

  // ── Rücken: heute kein Reha-Block im Plan (Bandscheibe — nicht verhandelbar) ──
  const heuteBloecke = Object.values(wplanF ?? {}).flat().filter(b => b?.date === today);
  if (heuteBloecke.length && !heuteBloecke.some(b => b.art === 'reha')) {
    shields.push({ id: 'reha', stufe: 'amber', text: 'Heute ist kein Reha-Block geplant — 30 Minuten, nicht verhandelbar.', href: '/os/planung', label: 'Tagesplanung' });
  }

  // Rot zuerst — was weh tut, steht oben.
  return shields.sort((a, b) => (a.stufe === 'rot' ? 0 : 1) - (b.stufe === 'rot' ? 0 : 1));
}

/** Für Brain/Loops: kompakte Textzeilen. */
export function shieldZeilen(shields: Shield[]): string {
  if (!shields.length) return '';
  return `RISK-SHIELDS (deterministisch — sprich sie aktiv an):\n${shields.map(s => `${s.stufe === 'rot' ? '🔴' : '🟠'} ${s.text}`).join('\n')}`;
}

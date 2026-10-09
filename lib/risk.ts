// ─── MAKE OS — Risk-Shields ─────────────────────────────────────────────────
// Kevins Ansage: „Warnungen, bevor es weh tut." Rein deterministische Regeln
// über die echten Stores — kein KI-Raten, keine falschen Alarme. Jede Warnung
// nennt die Zahl, den Grund und den direkten Absprung.
// NIEMALS aus Client-Komponenten importieren (zieht fs über local-db).

import { mitEroeffnung } from '@/lib/business/eroeffnung-server';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { computeMetrics, mitKasse, type FinanceState } from '@/lib/make-one/finance-data';
import { schwellen } from '@/lib/schwellen';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { planBloeckeLesen } from '@/lib/planung/bloecke-server';
import { tagPlus } from '@/lib/kalender/zeit';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { WEG } from '@/lib/wege';
import { meilensteineSichtbarFuer } from '@/lib/planung/eigene-ziele-sicht-server';
import { bereichVonFirma } from '@/lib/einheiten';

// Reha-Regel rein und browser-tauglich in lib/planung/reha-regel.ts (auch für die Tagesplanung) — hier nur weitergereicht.
import { REHA_GEWOHNHEIT_TAGE, rehaFehltHeute } from '@/lib/planung/reha-regel';
export { REHA_GEWOHNHEIT_TAGE, rehaFehltHeute };

export interface Shield {
  id: string;
  stufe: 'rot' | 'amber';
  text: string;
  href: string;
  label: string;
}

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n || 0));

/**
 * `person` = wessen Planungsblöcke heute zählen (05.10.: die anfragende Person aus dem Haushalts-Tor). Ohne Angabe
 * (Brain/ZOE) der Inhaber der Instanz — aus den Konten, nie ein fester Name (Plattform-Regel).
 */
export async function computeShields(today = localDay(), person?: string | null): Promise<Shield[]> {
  const fuer = person ?? await inhaberSpeicher();
  const [fplanRoh, fin, tasksF, msF, wplanF] = await Promise.all([
    loadJson<{ firmen?: { id: string; kontostand?: number | null; stand?: string | null }[]; rechnungen: { status: string; betrag: number; faellig?: string; firmaId?: string }[]; zahlungen: { status: string; betrag: number; faellig?: string; an: string }[]; uhrwerk?: { letztesMeeting: string | null } }>('finanzplan'),
    loadJson<FinanceState>('finance'),
    ladeAufgabenSicht(null), // Systemsicht: ohne „nur ich“ (29.09.)
    // Nur, was die Person sehen darf (08.10.: kein Meilenstein an einem nicht geteilten eigenen Ziel einer anderen Person; ohne Person keiner an einem eigenen Ziel).
    loadJson<{ meilensteine: { titel: string; bereich: string; faellig?: string; erledigt: boolean; zielId?: string; abgeleitetVon?: string }[] }>('meilensteine')
      .then(async f => (f ? { ...f, meilensteine: await meilensteineSichtbarFuer(f.meilensteine, person ?? null) } : f)),
    // Blöcke (K5: Kalender-Termine der Art Fokus/Block) der Person (bzw. des Inhabers) — heute und die 14 Tage davor (ob Reha
    // zur eigenen Routine gehört, `rehaFehltHeute`); ohne Konto keine.
    fuer ? planBloeckeLesen({ person: fuer, von: tagPlus(today, -REHA_GEWOHNHEIT_TAGE), bis: tagPlus(today, 1) }).catch(() => []) : Promise.resolve([] as Awaited<ReturnType<typeof planBloeckeLesen>>),
  ]);

  // 0-Punkt (05.10.): Posten vor der Eröffnung einer Gesellschaft sind archiviert — sie lösen keinen Alarm mehr aus (lib/business/eroeffnung.ts).
  const fplan = fplanRoh ? await mitEroeffnung(fplanRoh) : null;
  const shields: Shield[] = [];

  // ── Geld: überfällige Forderungen (rein) und überfällige Zahlungen (raus) ──
  // Bereich je Einheit (09.10., K3): nur Business-Posten (`bereichVonFirma`) — die Schilde gehen ins Brain jeder Person im Haushalt, auch
  // „nur Business“; Posten einer Privat-Einheit (Selbstständigkeit unter Privat) stehen unter Privat › Finanzen, nicht hier.
  const forderungenUeberfaellig = (fplan?.rechnungen ?? []).filter(r => r.status === 'gestellt' && r.faellig && r.faellig < today && bereichVonFirma(r.firmaId) === 'business');
  if (forderungenUeberfaellig.length) {
    shields.push({
      id: 'forderungen', stufe: 'rot',
      text: `${eur(forderungenUeberfaellig.reduce((s, r) => s + r.betrag, 0))} Forderungen überfällig — nachfassen kostet einen Anruf.`,
      href: '/os/finanzen', label: 'Finanzplanung',
    });
  }
  // Nur Business-Zahlungen (Bereich je Einheit) — private und die einer Privat-Einheit nie.
  const zahlungenUeberfaellig = (fplan?.zahlungen ?? []).filter(z => z.status === 'offen' && z.faellig && z.faellig < today && bereichVonFirma((z as { firmaId?: string }).firmaId) === 'business');
  if (zahlungenUeberfaellig.length) {
    shields.push({
      id: 'zahlungen', stufe: 'rot',
      text: `${zahlungenUeberfaellig.length} eigene Zahlung${zahlungenUeberfaellig.length > 1 ? 'en' : ''} überfällig (${eur(zahlungenUeberfaellig.reduce((s, z) => s + z.betrag, 0))}) — Mahnkosten vermeiden.`,
      href: '/os/finanzen', label: 'Zahlungs-Prioritäten',
    });
  }

  // ── Runway: die Grenzen kommen aus dem Kompass, nicht aus dem Code ──
  if (fin) {
    const m = computeMetrics(mitKasse(fin, fplan?.firmen));
    const s = await schwellen();
    if (m.runwayMonate != null && m.aktiveMonate > 0) {
      if (m.runwayMonate < s.runwayRot) shields.push({ id: 'runway', stufe: 'rot', text: `Runway ${m.runwayMonate.toFixed(1)} Monate — Liquidität ist DAS Thema.`, href: WEG.controlling(), label: 'Controlling' });
      else if (m.runwayMonate < s.runwayAmber) shields.push({ id: 'runway', stufe: 'amber', text: `Runway ${m.runwayMonate.toFixed(1)} Monate — Puffer schrumpft.`, href: WEG.controlling(), label: 'Controlling' });
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

  // ── Reha: heute kein Reha-Block, obwohl er zur eigenen Routine gehört (08.10. abends: kein Ziel EINER Person mehr im
  //    Code — der Schild gilt nur, wer in den letzten 14 Tagen selbst Reha-Blöcke geplant hat; Regel `rehaFehltHeute`) ──
  if (rehaFehltHeute(wplanF, today)) {
    shields.push({ id: 'reha', stufe: 'amber', text: 'Heute ist kein Reha-Block geplant — in den letzten zwei Wochen gehörte er zu deiner Routine.', href: '/os/planung', label: 'Tagesplanung' });
  }

  // Rot zuerst — was weh tut, steht oben.
  return shields.sort((a, b) => (a.stufe === 'rot' ? 0 : 1) - (b.stufe === 'rot' ? 0 : 1));
}

/** Für Brain/Loops: kompakte Textzeilen. */
export function shieldZeilen(shields: Shield[]): string {
  if (!shields.length) return '';
  return `RISK-SHIELDS (deterministisch — sprich sie aktiv an):\n${shields.map(s => `${s.stufe === 'rot' ? '🔴' : '🟠'} ${s.text}`).join('\n')}`;
}

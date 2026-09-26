// ─── MAKE OS — Startfläche (Kennzahlen der Bereiche) ────────────────────────
// Regel aus Kevins Vorbild: „Kennzahlen stehen nur dort, wo sie aus echten
// Daten kommen." Ein Bereich ohne gepflegte Quelle bekommt hier bewusst keine
// Zahl — lieber eine leere Kachel als eine erfundene.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { lesen, kennzahlen as finanzKennzahlen, type MalinExport } from '@/lib/make-one/grundlage';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { fortschritt } from '@/lib/onboarding-status';
import { computeIndex, indexLabel } from '@/lib/performance';
import { personAus, darfGesundheitSehen } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Aufgabe { status?: string; priority?: string; dueDate?: string }

export async function GET(req: Request) {
  const heute = localDay();
  const [ob, tasks, perf, netz, plan, grund] = await Promise.all([
    fortschritt(),
    loadJson<{ tasks?: Aufgabe[] }>('tasks'),
    loadJson<{ snapshots?: { date: string; index: number; abdeckung?: number; label?: string; hebel?: string; saeulen?: Record<string, number | null> }[] }>('performance'),
    loadJson<{ kontakte?: unknown[]; chancen?: { wert?: number; stufe?: string }[] }>('netzwerk'),
    loadJson<{ firmen?: { kontostand?: number }[]; zahlungen?: { status?: string }[] }>('finanzplan'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
  ]);

  const offen = (tasks?.tasks ?? []).filter(t => t.status !== 'done');
  const heuteFaellig = offen.filter(t => t.dueDate === heute).length;
  const ueberfaellig = offen.filter(t => t.dueDate && t.dueDate < heute).length;
  const kritisch = offen.filter(t => t.priority === 'critical').length;

  const letzter = (perf?.snapshots ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).at(-1);

  const fin = grund?.roh ? finanzKennzahlen(lesen(grund.roh, grund.stand)) : null;
  // Business: private Konten und Zahlungen stehen seit 24.09. unter Zahlen → Privat.
  const konten = (plan?.firmen ?? []).filter(f => (f as { id?: string }).id !== 'privat').reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const offenePosten = (plan?.zahlungen ?? []).filter(z => z.status === 'offen' && (z as { firmaId?: string }).firmaId !== 'privat').length;

  const eur0 = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n));

  // Der MAKE Score steht dauerhaft oben auf der Startfläche (Kevins Ansage:
  // „nicht auf Knopfdruck, sondern permanent") — mit Einordnung, nicht nur Zahl.
  // Gerechnet wird mit computeIndex, damit es NICHT zwei Sätze Schwellen gibt.
  // Je Person ihr Score — Gesundheit, Journal, Rituale sind persönlich; den der anderen Person nur mit Freigabe (26.09.).
  const ich = personAus(req);
  const idx = await computeIndex(undefined, ich);
  const andere = ich === 'kevin' ? 'malin' : 'kevin';
  const idxAndere = (await darfGesundheitSehen(req, andere)) ? await computeIndex(undefined, andere) : null;
  const idxKevin = ich === 'kevin' ? idx : idxAndere, idxMalin = ich === 'malin' ? idx : idxAndere;
  const reihe = (perf?.snapshots ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const vorher = reihe.filter(s => s.date < idx.stand).at(-1);
  /**
   * Kevins Ansage: „Wenn man bei Kevin dann Alles, Business oder Privat
   * auswählt, soll der Score jeweils für die Themen berechnet werden — so
   * bekommen wir auch einen privaten MAKE Score." Also derselbe Rechenweg,
   * nur über die Säulen, die zum jeweiligen Leben gehören. Planung zählt in
   * beiden: geplant wird privat wie geschäftlich.
   */
  const SAEULEN_JE_MODUS: Record<string, string[]> = {
    alles: ['health', 'business', 'planning', 'finance', 'social'],
    business: ['business', 'finance', 'planning'],
    privat: ['health', 'social', 'planning', 'finance'],
  };
  const teilIndex = (keys: string[], modus?: 'business' | 'privat') => {
    // Finanzen: im Business-Modus nur die Business-Hälfte, im Privat-Modus nur die private.
    const saeulen = idx.saeulen.map(s => (s.key === 'finance' && modus && s.teile ? { ...s, score: s.teile[modus] } : s));
    const gezaehlt = saeulen.filter(s => keys.includes(s.key) && s.score != null && !s.zuDuenn);
    const summe = gezaehlt.reduce((s, x) => s + x.gewicht, 0);
    if (!summe) return { index: null as number | null, label: indexLabel(null), abdeckung: 0 };
    const wert = Math.round(gezaehlt.reduce((s, x) => s + (x.score as number) * x.gewicht, 0) / summe);
    // Wie viel des möglichen Gewichts wirklich auf Daten steht.
    const moeglich = idx.saeulen.filter(s => keys.includes(s.key)).reduce((s, x) => s + x.gewicht, 0) || 1;
    return { index: wert, label: indexLabel(wert), abdeckung: summe / moeglich };
  };

  const score = {
    index: idx.index,
    label: idx.label,
    hebel: idx.hebel,
    abdeckung: idx.abdeckung,
    stand: idx.stand,
    trend: vorher?.index != null && idx.index != null ? idx.index - vorher.index : null,
    saeulen: idx.saeulen.map(s => ({
      key: s.key, label: s.label, wert: s.score, gewicht: s.gewicht, zuDuenn: s.zuDuenn, hinweis: s.hinweis,
    })),
    // Je Leben ein eigener Wert — dokumentierbar, nicht nur ein Gesamtgefühl.
    modi: Object.fromEntries(Object.entries(SAEULEN_JE_MODUS).map(([m, keys]) => [m, teilIndex(keys, m === 'business' || m === 'privat' ? m : undefined)])),
    // Und je Person: Malin hat eine andere Gesundheit und andere Ziele.
    person: {
      kevin: idxKevin ? { index: idxKevin.index, label: idxKevin.label, abdeckung: idxKevin.abdeckung } : null,
      malin: idxMalin ? { index: idxMalin.index, label: idxMalin.label, abdeckung: idxMalin.abdeckung } : null,
    },
  };

  return NextResponse.json({
    heute,
    score,
    lage: {
      tag: {
        status: { text: 'live', farbe: 'gut' },
        kennzahlen: [
          { wert: String(heuteFaellig), label: 'heute fällig' },
          { wert: String(ueberfaellig), label: 'überfällig', farbe: ueberfaellig ? 'warn' : undefined },
        ],
      },
      aufgaben: {
        status: { text: 'live', farbe: 'gut' },
        kennzahlen: [
          { wert: String(offen.length), label: 'offen' },
          { wert: String(kritisch), label: 'kritisch', farbe: kritisch ? 'krit' : undefined },
        ],
      },
      finanzen: fin ? {
        status: { text: `Grundlage ${grund!.stand.slice(8)}.${grund!.stand.slice(5, 7)}.`, farbe: 'gut' },
        kennzahlen: [
          { wert: `${eur0(fin.umsatzNetto)} €`, label: 'Umsatz netto', farbe: 'gut' },
          { wert: `${eur0(konten)} €`, label: 'auf den Konten' },
          { wert: String(offenePosten), label: 'offene Posten', farbe: offenePosten ? 'warn' : undefined },
        ],
      } : { status: { text: 'keine Grundlage geladen', farbe: 'still' } },
      gesundheit: {
        status: { text: 'wenig gepflegt', farbe: 'warn' },
      },
      score: letzter ? {
        status: { text: `Stand ${letzter.date.slice(8)}.${letzter.date.slice(5, 7)}.`, farbe: 'gut' },
        kennzahlen: [
          { wert: String(letzter.index), label: 'Index', farbe: 'gut' },
          { wert: `${Math.round((letzter.abdeckung ?? 0) * 100)} %`, label: 'Abdeckung', farbe: (letzter.abdeckung ?? 0) < 0.6 ? 'warn' : undefined },
        ],
      } : { status: { text: 'noch kein Wert', farbe: 'still' } },
      wachstum: {
        status: { text: (netz?.chancen?.length ?? 0) ? 'live' : 'teilweise live', farbe: (netz?.chancen?.length ?? 0) ? 'gut' : 'warn' },
        kennzahlen: [
          { wert: String(netz?.kontakte?.length ?? 0), label: 'Kontakte' },
          { wert: String(netz?.chancen?.length ?? 0), label: 'Chancen', farbe: (netz?.chancen?.length ?? 0) ? undefined : 'warn' },
        ],
      },
      onboarding: {
        status: ob.fertig === ob.gesamt
          ? { text: 'fertig', farbe: 'gut' }
          : { text: `noch ${Math.round(ob.offeneMinuten / 60 * 10) / 10} h`, farbe: 'warn' },
        kennzahlen: [
          { wert: `${ob.fertig}/${ob.gesamt}`, label: 'Schritte', farbe: ob.fertig === ob.gesamt ? 'gut' : undefined },
        ],
      },
      system: {
        status: { text: 'live', farbe: 'gut' },
        kennzahlen: [{ wert: String(LIVE_AGENTS.length), label: 'Agenten' }],
      },
    },
  });
}

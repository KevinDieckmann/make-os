// ─── MAKE OS — Startfläche (Kennzahlen der Bereiche) ────────────────────────
// Regel aus Kevins Vorbild: „Kennzahlen stehen nur dort, wo sie aus echten
// Daten kommen." Ein Bereich ohne gepflegte Quelle bekommt hier bewusst keine
// Zahl — lieber eine leere Kachel als eine erfundene.

import { mitEroeffnung } from '@/lib/business/eroeffnung-server';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { lesen, kennzahlen as finanzKennzahlen, type MalinExport } from '@/lib/make-one/grundlage';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { fortschritt } from '@/lib/onboarding-status';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const heute = localDay();
  const [ob, tasks, netz, plan, grund] = await Promise.all([
    // Onboarding (08.10. spät): ein Fehler der Einrichtungs-Prüfung legt die Startfläche nie lahm.
    fortschritt(personStreng(req)).catch(() => null),
    ladeAufgabenSicht(personStreng(req)), // Sichtfilter „nur ich“ (29.09.)
    loadJson<{ kontakte?: unknown[]; chancen?: { wert?: number; stufe?: string }[] }>('netzwerk'),
    // 0-Punkt (05.10.): Konten und Zahlungen ab der Eröffnung je Gesellschaft (lib/business/eroeffnung.ts).
    loadJson<{ firmen?: { id: string; kontostand?: number | null }[]; zahlungen?: { status?: string; firmaId?: string; faellig?: string }[] }>('finanzplan').then(f => (f ? mitEroeffnung(f) : f)),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
  ]);

  const offen = (tasks?.tasks ?? []).filter(t => t.status !== 'done');
  const heuteFaellig = offen.filter(t => t.dueDate === heute).length;
  const ueberfaellig = offen.filter(t => t.dueDate && t.dueDate < heute).length;
  const kritisch = offen.filter(t => t.priority === 'critical').length;

  const fin = grund?.roh ? finanzKennzahlen(lesen(grund.roh, grund.stand)) : null;
  // Business: private Konten und Zahlungen stehen seit 24.09. unter Zahlen → Privat.
  const konten = (plan?.firmen ?? []).filter(f => (f as { id?: string }).id !== 'privat').reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const offenePosten = (plan?.zahlungen ?? []).filter(z => z.status === 'offen' && (z as { firmaId?: string }).firmaId !== 'privat').length;

  const eur0 = (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n));

  // Kein Score mehr hier (21.10., Kevin: nur noch Privat-Score und Business-Score — der gemischte „MAKE Score“ ist weg). Die zwei Scores liefert
  // nur GET /api/scores, und zwar nur der Person selbst (lib/scores/sicht.ts).

  return NextResponse.json({
    heute,
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
      wachstum: {
        status: { text: (netz?.chancen?.length ?? 0) ? 'live' : 'teilweise live', farbe: (netz?.chancen?.length ?? 0) ? 'gut' : 'warn' },
        kennzahlen: [
          { wert: String(netz?.kontakte?.length ?? 0), label: 'Kontakte' },
          { wert: String(netz?.chancen?.length ?? 0), label: 'Chancen', farbe: (netz?.chancen?.length ?? 0) ? undefined : 'warn' },
        ],
      },
      onboarding: !ob ? { status: { text: 'nicht prüfbar', farbe: 'warn' } } : {
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

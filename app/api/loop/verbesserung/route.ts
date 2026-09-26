// ─── MAKE OS — Verbesserungs-Loop ───────────────────────────────────────────
// Kevins Ansage: „Bau einen Loop ein, der nach und nach aufnimmt, wie wir
// arbeiten, damit wir uns in der Software selbst verbessern. Schlag in
// angemessenen Abständen Optimierungen vor, die wir dann umsetzen können."
//
// Der Loop liest, was wirklich passiert ist — welche Seiten benutzt werden,
// welche seit Wochen niemand mehr angefasst hat, welche Fehler aufgelaufen
// sind und was im Backlog liegt — und schlägt daraus konkrete Verbesserungen
// vor. Die Vorschläge landen als Punkte im Backlog, nicht als Textwand.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { localDay } from '@/lib/zeit';
import { ALLE_SEITEN } from '@/lib/make-one/bereiche';
import { modellSchranke } from '@/lib/zugang/umfang';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BacklogItem {
  id: string; titel: string; warum: string; kategorie: string;
  status: string; prio: number; block: string; quelle?: string; angelegt: string;
}

/** Was der Melder je Seite mitschreibt — inkl. Verweildauer und wer dort war. */
interface Seitennutzung { anzahl: number; zuletzt: string; sekunden?: number; person?: string }

const QUELLE = 'Verbesserungs-Loop';
/** So oft darf der Loop von selbst laufen — sonst wird aus Hilfe Rauschen. */
const ABSTAND_TAGE = 7;

export async function POST(req: Request) {
  const schranke = modellSchranke(req); if (schranke) return schranke;
  // „jetzt=1“ umgeht den 7-Tage-Abstand — nur der Inhaber (26.09.).
  const erzwingen = new URL(req.url).searchParams.get('jetzt') === '1' && (await nurInhaber(req));

  const [nutzung, backlog, fehler, aenderungen] = await Promise.all([
    loadJson<{ seiten?: Record<string, Seitennutzung>; tage?: Record<string, number>; letzteAnalyse?: string }>('nutzung'),
    loadJson<{ items?: BacklogItem[] }>('backlog'),
    loadJson<{ meldungen?: { text: string; seite: string; anzahl: number }[] }>('client-fehler'),
    loadJson<{ eintraege?: { at: string; person: string; bestand: string }[] }>('aenderungen'),
  ]);

  // Abstand einhalten, außer Kevin drückt selbst auf den Knopf.
  const letzte = nutzung?.letzteAnalyse;
  if (!erzwingen && letzte) {
    const tage = (Date.now() - new Date(letzte).getTime()) / 864e5;
    if (tage < ABSTAND_TAGE) {
      return NextResponse.json({ ok: true, uebersprungen: true, grund: `zuletzt vor ${Math.round(tage)} Tagen gelaufen` });
    }
  }

  const seiten = Object.entries(nutzung?.seiten ?? {}).map(([pfad, s]) => ({ pfad, ...s }));
  const gesamt = seiten.reduce((s, x) => s + x.anzahl, 0);
  if (gesamt < 20 && !erzwingen) {
    return NextResponse.json({ ok: true, uebersprungen: true, grund: 'noch zu wenig Nutzung, um etwas Belastbares zu sagen' });
  }

  const benutzt = seiten.slice().sort((a, b) => b.anzahl - a.anzahl).slice(0, 15);
  const bekannt = new Set(seiten.map(s => s.pfad));
  const nieBenutzt = ALLE_SEITEN.filter(s => !bekannt.has(s.href)).map(s => `${s.label} (${s.href})`);
  const offeneP1 = (backlog?.items ?? []).filter(i => i.status === 'offen' && i.prio === 1).map(i => i.titel);
  const fehlerZeilen = (fehler?.meldungen ?? []).slice(0, 8).map(m => `${m.seite}: ${String(m.text).split('\n')[0].slice(0, 110)} (${m.anzahl}×)`);

  if (!hasAnthropicKey()) {
    return NextResponse.json({ ok: false, error: 'Kein ANTHROPIC_API_KEY — der Loop kann nicht denken.' }, { status: 200 });
  }

  const system = [
    'Du schaust auf MAKE OS — das private Betriebssystem von Kevin und Malin — und schlägst Verbesserungen an der SOFTWARE vor.',
    'Grundlage sind echte Nutzungsdaten, keine Vermutungen. Was nie geöffnet wurde, ist ein Kandidat zum Entfernen oder Zusammenlegen; was ständig geöffnet wird, verdient weniger Klicks.',
    'Die Verweildauer liest du zusammen mit den Aufrufen: viele Aufrufe bei wenig Zeit heißt, die Seite liefert nicht, wonach dort gesucht wird. Viel Zeit bei wenigen Aufrufen heißt, dort wird echt gearbeitet — die verdient Werkzeug, keine Vereinfachung.',
    'Kevin und Malin arbeiten in einer Instanz. Wenn beide denselben Bestand ändern, ist das ein Hinweis auf fehlende Absprache oder eine fehlende gemeinsame Ansicht.',
    'REGELN: Höchstens 4 Vorschläge. Jeder muss aus den Daten unten begründbar sein — schreibe den Beleg dazu. Keine Allgemeinplätze („bessere UX"), sondern eine konkrete Änderung an einer benannten Seite. Wenn die Daten für einen Vorschlag nicht reichen, mach weniger Vorschläge.',
    'Antworte als reines JSON: {"vorschlaege":[{"titel":"kurz und konkret","warum":"Beleg aus den Daten plus erwarteter Nutzen","prio":1|2|3}]}',
  ].join('\n');

  // Verweildauer: Kevins Ansage fürs Wochen-Reflexionsmeeting — „wie lange
  // waren wir drauf". Viele Aufrufe bei wenig Zeit heißt: die Seite liefert
  // nicht, was man dort sucht. Viel Zeit bei wenigen Aufrufen heißt: hier wird
  // wirklich gearbeitet.
  const min = (s?: number) => Math.round((s ?? 0) / 60);
  const zeitProSeite = seiten
    .filter(s => (s.sekunden ?? 0) >= 60)
    .sort((a, b) => (b.sekunden ?? 0) - (a.sekunden ?? 0))
    .slice(0, 12)
    .map(s => `${s.pfad} ${min(s.sekunden)}min/${s.anzahl}× (${s.person ?? '—'})`);

  // Wer welchen Bestand anfasst — die Arbeitsteilung, wie sie wirklich ist.
  const jeBestand = new Map<string, { kevin: number; malin: number }>();
  for (const e of (aenderungen?.eintraege ?? []).slice(-200)) {
    const z = jeBestand.get(e.bestand) ?? { kevin: 0, malin: 0 };
    if (e.person === 'Malin') z.malin++; else z.kevin++;
    jeBestand.set(e.bestand, z);
  }
  const arbeitsteilung = Array.from(jeBestand.entries())
    .sort((a, b) => (b[1].kevin + b[1].malin) - (a[1].kevin + a[1].malin))
    .slice(0, 10)
    .map(([b, z]) => `${b}: Kevin ${z.kevin}× / Malin ${z.malin}×`);

  const user = [
    `MEIST GEÖFFNET (Pfad × Aufrufe): ${benutzt.map(s => `${s.pfad}×${s.anzahl}`).join(', ') || '—'}`,
    `VERWEILDAUER (Seite, Minuten gesamt / Aufrufe, wer): ${zeitProSeite.join(', ') || '—'}`,
    `NIE GEÖFFNET (${nieBenutzt.length}): ${nieBenutzt.slice(0, 25).join(', ') || '—'}`,
    `AUFRUFE JE TAG: ${Object.entries(nutzung?.tage ?? {}).slice(-14).map(([t, n]) => `${t.slice(5)}:${n}`).join(' ') || '—'}`,
    `WER ÄNDERT WAS: ${arbeitsteilung.join(' | ') || '—'}`,
    `OFFENE P1 IM BACKLOG: ${offeneP1.slice(0, 12).join(' · ') || '—'}`,
    `AUFGELAUFENE FEHLER: ${fehlerZeilen.join(' | ') || 'keine'}`,
  ].join('\n');

  const r = await askText({ zweck: 'loop-verbesserung', system, user, maxTokens: 1400, timeoutMs: 120_000 });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error?.slice(0, 200) ?? 'Analyse fehlgeschlagen' }, { status: 200 });

  let vorschlaege: { titel: string; warum: string; prio?: number }[] = [];
  try {
    const roh = r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1);
    vorschlaege = (JSON.parse(roh).vorschlaege ?? []).slice(0, 4);
  } catch { return NextResponse.json({ ok: false, error: 'Antwort war kein gültiges JSON.' }, { status: 200 }); }

  // Als Backlog-Punkte ablegen — dort, wo Kevin ohnehin entscheidet.
  const heute = localDay();
  const angelegt: string[] = [];
  await updateJson<{ items: BacklogItem[] }>('backlog', current => {
    const f = current ?? { items: [] };
    f.items = Array.isArray(f.items) ? f.items : [];
    vorschlaege.forEach((v, i) => {
      const titel = String(v.titel ?? '').trim().slice(0, 160);
      if (!titel) return;
      const id = `vb-${heute}-${i}`;
      if (f.items.some(x => x.id === id)) return;
      f.items.push({
        id, titel,
        warum: String(v.warum ?? '').trim().slice(0, 600),
        kategorie: 'idee', status: 'offen',
        prio: [1, 2, 3].includes(Number(v.prio)) ? Number(v.prio) : 2,
        block: 'frei', quelle: QUELLE, angelegt: new Date().toISOString(),
      });
      angelegt.push(titel);
    });
    return f;
  });

  await updateJson<Record<string, unknown>>('nutzung', current => ({ ...(current ?? {}), letzteAnalyse: new Date().toISOString() }));
  return NextResponse.json({ ok: true, angelegt, anzahl: angelegt.length });
}

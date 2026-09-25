// ─── Evals der Heads (rein, getestet) ──────────────────────────────────────
// Die besten Teams ändern Prompt oder Modell nie im Blindflug (Anthropic
// „Demystifying evals for AI agents“): erst messen, dann ändern. Hier:
//   · bewerte()  feste, deterministische Prüfungen je Antwort — dieselben
//                Kriterien, die der Prüfer anlegt, als Bestanden/Nicht-bestanden
//   · passK()    „pass^k“: Eine Prüfung gilt erst, wenn sie in ALLEN k
//                Wiederholungen besteht (75 % je Lauf → bei k=3 nur ~42 %)
// Die Datenpakete für Nachläufe legt jeder Head-Lauf in `.data` ab
// (heads-replay-<head>) — echte Fälle, nie im Repo. Ausgeführt wird über
// /api/heads/eval: offline (gespeicherte Antworten bewerten) oder live
// (dieselben Pakete k-mal mit dem aktuellen Prompt und Modell).

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import { pruefe, qualitaet, signalTraegt, type Antwort } from './pruefer';
import { belege } from './belege';

export interface Pruefpunkt { id: string; label: string; bestanden: boolean; detail?: string }
export interface Bewertung { punkte: Pruefpunkt[]; bestanden: number; von: number }

export const PRUEFUNGEN: { id: string; label: string }[] = [
  { id: 'ids', label: 'nur echte IDs' },
  { id: 'kanal', label: 'nur zulässige Kanäle' },
  { id: 'vollzug', label: 'keine Vollzugsmeldung' },
  { id: 'zahlen', label: 'alle Zahlen belegt' },
  { id: 'umfang', label: 'höchstens fünf Vorschläge' },
  { id: 'frist', label: 'jede Handlung mit Frist' },
  { id: 'belege', label: 'Quellen treffen' },
  { id: 'signal', label: '„hoch“ nur mit frischem Signal' },
  { id: 'entwurf', label: 'Entwürfe: Anrede, Länge, keine Platzhalter' },
];

/** Eine Antwort gegen die festen Kriterien — roh, also VOR dem Prüfer (so misst man das Modell, nicht den Prüfer). */
export function bewerte(roh: Antwort, daten: unknown, kontakte: Kontakt[], crm: CrmBestand, heute: string): Bewertung {
  const { pruefung } = pruefe({ ...roh, vorschlaege: roh.vorschlaege.map(v => ({ ...v })) }, daten, kontakte, crm, heute);
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const idWeg = pruefung.gestrichen.filter(g => /gibt es nicht|ohne Person|Vorgehen/.test(g.grund));
  const kanalWeg = pruefung.gestrichen.filter(g => /Kanal|Werbesperre/.test(g.grund));
  const ohneFrist = roh.vorschlaege.filter(v => !v.frist && v.art !== 'merken');
  const insLeere = roh.vorschlaege.flatMap(v => belege(daten, v.quelle).insLeere);
  const hochOhne = roh.vorschlaege.filter(v => v.prioritaet === 'hoch' && !signalTraegt(v, heute));
  const entwurfMaengel = roh.vorschlaege.flatMap(v => (v.entwurf ? qualitaet(v, v.kontakt_id ? nachId.get(v.kontakt_id) : undefined, heute).maengel.filter(m => /Anrede|Platzhalter|zu lang|verbotenes Wort im Entwurf/.test(m)) : []));
  const punkte: Pruefpunkt[] = [
    { id: 'ids', label: 'nur echte IDs', bestanden: !idWeg.length, detail: idWeg.map(g => g.titel).join(' · ') || undefined },
    { id: 'kanal', label: 'nur zulässige Kanäle', bestanden: !kanalWeg.length, detail: kanalWeg.map(g => `${g.titel} (${g.grund})`).join(' · ') || undefined },
    { id: 'vollzug', label: 'keine Vollzugsmeldung', bestanden: !pruefung.verstoesse.length },
    { id: 'zahlen', label: 'alle Zahlen belegt', bestanden: !pruefung.unbelegt.length, detail: pruefung.unbelegt.join(' · ') || undefined },
    { id: 'umfang', label: 'höchstens fünf Vorschläge', bestanden: roh.vorschlaege.length <= 5 },
    { id: 'frist', label: 'jede Handlung mit Frist', bestanden: !ohneFrist.length, detail: ohneFrist.map(v => v.titel).join(' · ') || undefined },
    { id: 'belege', label: 'Quellen treffen', bestanden: !insLeere.length, detail: insLeere.join(', ') || undefined },
    { id: 'signal', label: '„hoch“ nur mit frischem Signal', bestanden: !hochOhne.length, detail: hochOhne.map(v => v.titel).join(' · ') || undefined },
    { id: 'entwurf', label: 'Entwürfe: Anrede, Länge, keine Platzhalter', bestanden: !entwurfMaengel.length, detail: entwurfMaengel.join(' · ') || undefined },
  ];
  return { punkte, bestanden: punkte.filter(p => p.bestanden).length, von: punkte.length };
}

/** pass^k je Prüfung über Fälle mit je k Wiederholungen: bestanden nur, wenn alle k bestehen. */
export function passK(faelle: Bewertung[][]): { id: string; label: string; quote: number; faelle: number }[] {
  return PRUEFUNGEN.map(p => {
    const ok = faelle.filter(wdh => wdh.length && wdh.every(b => b.punkte.find(x => x.id === p.id)?.bestanden)).length;
    return { id: p.id, label: p.label, quote: faelle.length ? Math.round((ok / faelle.length) * 100) : 0, faelle: faelle.length };
  });
}

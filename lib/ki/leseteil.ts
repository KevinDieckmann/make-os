// ─── Leseteil „Tiefenbericht — nur für dich“ (10.10., Fulfillment C3; FULFILLMENT_KONZEPT.md 4.7) — Server ─────────────────────────────────
// Der Tiefenbericht (Google Deep Research) darf NUR der Person gezeigt werden, die ihn ausgelöst hat — mit den Suchvorschlägen und Quellen; nie an
// Agenten, Synthese, Prüfer, Brain, Suche oder ZOE (Google-Bedingungen, die Regeln in ./tiefenbericht.ts bleiben unverändert). Diese Datei liegt
// bewusst IN lib/ki: sie ist die einzige Tür von außen. Lesen darf sie genau EINE Stelle — die Route app/api/fulfillment/dossier/leseteil (Klasse
// `person`, Person der Sitzung). Wächter: kein Modul unter lib/fulfillment/** importiert diese Datei (tests/fulfillment-c3-routen.test.ts), außerhalb
// von lib/ki nennt niemand den Bestand (tests/ki-anbieter-tor.test.ts).

import { tiefenberichtFuer, TIEFENBERICHT_TAGE } from './tiefenbericht';

export interface Leseteil {
  status: 'laeuft' | 'fertig' | 'fehler' | 'abgelaufen';
  frage: string;
  gestartet: string;
  fertigAm?: string;
  /** Nur „fertig“: der Text, die Suchvorschläge (HTML, nur im abgeschotteten iframe zeigen) und die Quellen. */
  text?: string;
  suchvorschlaegeHtml?: string;
  quellen?: { url: string; titel?: string }[];
  /** Die Suchbegriffe, die der Dienst benutzt hat (gehören zu den Suchvorschlägen). */
  suchbegriffe?: string[];
  fehler?: string;
  /** Tage, die der Bericht noch gezeigt wird. */
  restTage?: number;
}

/**
 * Den Leseteil einer Person lesen — `person` ist IMMER die Person der Sitzung (nie ein Parameter der Anfrage, nie der Dienstweg). Gibt es den
 * Bericht bei ihr nicht (eine andere Person hat ihn ausgelöst, oder er ist nach der Frist gelöscht), kommt „abgelaufen“ bzw. null.
 */
export async function leseteilFuer(person: string, id: string, jetzt = new Date()): Promise<Leseteil | null> {
  const b = (await tiefenberichtFuer(person)).find(x => x.id === id);
  if (!b) return null;
  const basis = { frage: b.frage, gestartet: b.gestartet, ...(b.fertigAm ? { fertigAm: b.fertigAm } : {}) };
  if (b.status === 'laeuft') return { status: 'laeuft', ...basis };
  if (b.status === 'fehler') return { status: 'fehler', ...basis, fehler: b.fehler ?? 'Der Bericht ist gescheitert.' };
  const alter = (jetzt.getTime() - Date.parse(b.fertigAm ?? b.gestartet)) / 86_400_000;
  if (alter > TIEFENBERICHT_TAGE) return { status: 'abgelaufen', ...basis };
  const r = b.bericht;
  return {
    status: 'fertig', ...basis, text: r?.text ?? '', ...(r?.suchvorschlaegeHtml ? { suchvorschlaegeHtml: r.suchvorschlaegeHtml } : {}),
    suchbegriffe: r?.suchbegriffe ?? [],
    quellen: (r?.quellen ?? []).filter(q => /^https?:\/\//i.test(q.url)).map(q => ({ url: q.url, ...(q.titel ? { titel: q.titel } : {}) })),
    restTage: Math.max(0, Math.ceil(TIEFENBERICHT_TAGE - alter)),
  };
}

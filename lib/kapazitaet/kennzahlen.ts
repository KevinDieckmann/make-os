// ─── MAKE OS — Säule „Kapazität“ im Business-Index (rein) ───────────────────
// Kevin 04.10.: Kapazität bekommt 15 %, alle anderen Säulen schrumpfen im gleichen Verhältnis („Verhältnis halten“,
// ×0,85). Fehlt die Messung (nichts verplant, kein Aufwand), zählt die Säule nicht — und weil sie `nurMitMessung` trägt,
// ist der Index dann exakt der ohne sie (lib/kennzahlen/kern.ts). Gerechnet wird NUR aus Summen des Kapazitäts-Stands
// (lib/kapazitaet/modell.ts) — keine Einzelwerte von Personen, Erholung nur als Team-Faktor.
//
// Bewusst NICHT hier (sonst doppelt gezählt): „Auslastung“ (fakturierte Tage ÷ Beratertage) und „Meeting-Last“ stehen in
// „Personal“ — die Meeting-Last wirkt hier nur als Umschaltzeit in der verfügbaren Kapa, nicht als eigene Kennzahl.

import type { KennzahlDefBasis, Messung, Detail } from '@/lib/kennzahlen/kern';
import { WEG } from '@/lib/wege';
import type { KapaKennzahlen } from './typen';
import { MACHBAR_LABEL } from './typen';

export const KP_ID = 'kp';
export const KP_GEWICHT = 0.15;
export const KP_SAEULE = { id: KP_ID, label: 'Kapazität', gewicht: KP_GEWICHT, satz: 'Reicht die Zeit für Ziele und Meilensteine — realistisch geplant', nurMitMessung: true };

const PFLEGEN = { text: 'Kapazität planen', href: WEG.kapazitaet() };
const AUFWAND = { text: 'Aufwand an Meilensteinen eintragen', href: WEG.jahr() };

export const KP_KENNZAHLEN: KennzahlDefBasis[] = [
  { id: 'kp_last', label: 'Last nächste 4 Wochen', saeule: KP_ID, gruppe: 'Last', gewicht: 1.5, einheit: 'prozent', richtung: 'niedrig', gruen: 85, rot: 100,
    formel: 'verplante Stunden (Zuweisungen + Aufwand bis zum Termin) ÷ belastbare Stunden des Teams, nächste 4 Wochen',
    quelle: 'Kapazität (Grundwert, Wochenvorlage, Kalender, Urlaub) + Aufwand an Meilensteinen/Zielen', luecke: 'Noch nichts verplant', pflegen: PFLEGEN },
  { id: 'kp_machbar', label: 'Machbare Meilensteine', saeule: KP_ID, gruppe: 'Machbarkeit', gewicht: 1.5, einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'machbare (eng zählt halb) ÷ bewertete offene Meilensteine und Ziele mit Aufwand und Termin',
    quelle: 'Machbarkeit je Meilenstein/Ziel (Restbedarf ÷ freie Zeit bis zum Termin)', luecke: 'Noch kein Meilenstein mit Aufwand und Termin', pflegen: AUFWAND },
  { id: 'kp_treue', label: 'Plan-Treue', saeule: KP_ID, gruppe: 'Umsetzung', einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'Ø gemessene Business-Fokuszeit je Woche (letzte 4 Wochen) ÷ Ø verplante Stunden je Woche (nächste 4 Wochen)',
    quelle: 'Fokus-Zähler (Zeit & Fokus) + Kapazität', luecke: 'Noch keine Fokus-Zeit gemessen oder nichts verplant', pflegen: { text: 'Oben im Kopf „Fokus“ starten', href: WEG.kapazitaet() } },
  { id: 'kp_puffer', label: 'Puffer je Woche', saeule: KP_ID, gruppe: 'Last', einheit: 'stunden', richtung: 'hoch', gruen: 8, rot: 0,
    formel: 'Ø (belastbare − verplante Stunden) je Woche, nächste 4 Wochen — Team gesamt',
    quelle: 'Kapazität', luecke: 'Noch nichts verplant', pflegen: PFLEGEN },
  { id: 'kp_kopf', label: 'Kopf & Energie (Team)', saeule: KP_ID, gruppe: 'Kopf & Energie', einheit: 'prozent', richtung: 'hoch', gruen: 95, rot: 80,
    formel: 'Ø Faktor aus der Erholung (grün 100 % · gelb 90 % · rot 75 %) — nur Personen, die ihre Gesundheit im Haushalt teilen; nur als Summe',
    quelle: 'Erholung (Whoop, 7 Tage) — wirkt auf die nächsten 14 Tage', luecke: 'Keine geteilte Erholung gemessen', pflegen: PFLEGEN },
];

const z = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const wocheKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
/** Jede gemessene Kennzahl hat mindestens einen Punkt dahinter (Kevin: „Verbindungen, die nicht enden“). */
const jePerson: Detail = { titel: 'Kapazität je Person und Woche', href: WEG.kapazitaet() };
const mindestens = (l: Detail[]): Detail[] => (l.length ? l : [jePerson]);
const postenDetails = (k: KapaKennzahlen): Detail[] => k.kritisch.map(p => ({
  titel: p.titel, wert: MACHBAR_LABEL[p.status], unter: p.text, href: p.art === 'ziel' ? WEG.ziel(p.id) : WEG.meilenstein(p.id),
  ampel: p.status === 'eng' ? 'gelb' : 'rot',
}));

/** Eine Messung der Säule aus den Summen des Kapazitäts-Stands. */
export function kpMessung(id: string, k: KapaKennzahlen | null | undefined): Messung {
  if (!k) return { luecke: 'Kapazität noch nicht gerechnet', details: [{ titel: 'Kapazität öffnen', href: WEG.kapazitaet() }] };
  switch (id) {
    case 'kp_last': {
      if (k.last4 == null) return { luecke: 'Noch nichts verplant — Aufwand an Meilensteinen oder Zuweisungen fehlen', details: [{ titel: 'Aufwand eintragen', href: WEG.jahr() }, { titel: 'Kapazität öffnen', href: WEG.kapazitaet() }] };
      return { wert: k.last4, anzeige: `${z(k.last4)} %`, quelle: `${z(k.bedarf4)} h verplant ÷ ${z(k.belastbar4)} h belastbar (4 Wochen)`,
        details: mindestens(k.engpassWochen.slice(0, 4).map(w => ({ titel: `Woche ab ${wocheKurz(w)}`, wert: 'Engpass', href: WEG.kapazitaet(), ampel: 'rot' as const }))) };
    }
    case 'kp_machbar': {
      if (k.machbarAnteil == null) return { luecke: k.machbar.ohneAufwand ? `${k.machbar.ohneAufwand} Meilenstein${k.machbar.ohneAufwand === 1 ? '' : 'e'} ohne Aufwand — ohne Schätzung keine Aussage` : 'Noch kein Meilenstein mit Aufwand und Termin', details: [{ titel: 'Aufwand eintragen', href: WEG.jahr() }] };
      const m = k.machbar;
      return { wert: k.machbarAnteil, anzeige: `${z(k.machbarAnteil)} %`, quelle: `${m.machbar} machbar · ${m.eng} eng · ${m.nicht} nicht machbar${m.ueberfaellig ? ` · ${m.ueberfaellig} überfällig` : ''}${m.ohneAufwand ? ` · ${m.ohneAufwand} ohne Aufwand` : ''}`, details: mindestens(postenDetails(k)) };
    }
    case 'kp_treue': {
      if (k.planTreue == null) return { luecke: k.planStdWoche > 0 ? 'Noch keine Business-Fokuszeit gemessen (letzte 4 Wochen)' : 'Noch nichts verplant' };
      return { wert: k.planTreue, anzeige: `${z(k.planTreue)} %`, quelle: `Ø ${z(k.istStdWoche ?? 0)} h gemessen ÷ Ø ${z(k.planStdWoche)} h verplant je Woche`,
        details: [{ titel: 'Gemessen je Woche', wert: `${z(k.istStdWoche ?? 0)} h`, unter: 'bewusste Business-Fokuszeit, letzte 4 Wochen', href: WEG.kapazitaet() }, { titel: 'Verplant je Woche', wert: `${z(k.planStdWoche)} h`, unter: 'nächste 4 Wochen', href: WEG.kapazitaet() }] };
    }
    case 'kp_puffer': {
      if (k.pufferStdWoche == null) return { luecke: 'Noch nichts verplant' };
      return { wert: k.pufferStdWoche, anzeige: `${z(k.pufferStdWoche)} h/Woche`, quelle: `${z(k.belastbar4 - k.bedarf4)} h frei in 4 Wochen (Team)`, details: mindestens(postenDetails(k).slice(0, 3)) };
    }
    case 'kp_kopf': {
      if (k.erholung == null) return { luecke: 'Keine geteilte Erholung gemessen — Kopf & Energie zählt dann neutral (100 %)' };
      return { wert: k.erholung, anzeige: `${k.erholung} %`, quelle: `Team-Faktor aus ${k.erholungPersonen} Person${k.erholungPersonen === 1 ? '' : 'en'} · wirkt auf die nächsten 14 Tage`, details: [jePerson] };
    }
    default: return { luecke: 'Keine Messung hinterlegt' };
  }
}

/** Messfunktionen für ein Modell, das die Summen hält: `kpMessen(b => b.kapa)`. */
export function kpMessen<B>(kapaVon: (b: B) => KapaKennzahlen | null | undefined): Record<string, (b: B) => Messung> {
  return Object.fromEntries(KP_KENNZAHLEN.map(k => [k.id, (b: B) => kpMessung(k.id, kapaVon(b))]));
}

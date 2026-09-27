// ─── Zeit & Fokus — die Säule „Fokus & Zeit“ für Privat- und Business-Index ──
// Kevin (26.09. spät): „Neue Säule Fokus & Zeit in beiden Indizes“ — geplante
// Fokus-Zeit gegen tatsächliche Zeit im Bereich, über die Indizes in den
// Wachstums-Score. Beide Indizes nehmen dieselben vier Kennzahlen mit eigenen
// Schwellen; bewusste Zeit wiegt mehr (1,25).
//
// Gewicht 10 % je Index; die übrigen Säulen behalten ihr Verhältnis (50/30/20
// bzw. 40/35/25), weil sie um denselben Faktor 0,9 skaliert sind. Solange
// noch nichts gemessen ist, hat die Säule keinen Wert und zieht nichts nach
// unten (Kern: Säulen ohne Wert zählen nicht).

import type { KennzahlDefBasis, Messung, Detail } from '@/lib/kennzahlen/kern';
import type { SpaceId } from '@/lib/make-one/space-regeln';
import { SPACE_LABEL } from '@/lib/make-one/space-regeln';
import { stunden, zeitText, bereicheNachZeit, bereichZeit, FOKUS_TAG_SEK, type ZeitBild } from './modell';

export const FZ_ID = 'fz';
/** Unter so viel gemessener Zeit im Space (7 Tage) zählt die Säule noch nicht — sonst drückt der erste Klick den Index (26.09.: 6 s Fokus → Privat-Index 80 → 74). */
export const MIN_MESSUNG_SEK = 3600;
export const FZ_GEWICHT = 0.1;
export const FZ_SAEULE = { id: FZ_ID, label: 'Fokus & Zeit', gewicht: FZ_GEWICHT, satz: 'Wo eure Zeit hingeht und wie viel davon bewusster Fokus ist' };

interface Schwellen { woche: [number, number]; bewusst: [number, number]; tage: [number, number]; bereich: { id: string; label: string; gruen: number; rot: number } }
/** Schwellen je Space (Stunden bzw. Tage in 7 Tagen) — Annahmen vom 26.09., über die Index-Seite anpassbar. */
const SCHWELLEN: Record<SpaceId, Schwellen> = {
  privat: { woche: [8, 2], bewusst: [3, 0.5], tage: [4, 1], bereich: { id: 'gesundheit', label: 'Zeit für Gesundheit', gruen: 3, rot: 0.5 } },
  business: { woche: [25, 8], bewusst: [8, 2], tage: [4, 1], bereich: { id: 'markttraktion', label: 'Zeit in Markttraktion', gruen: 5, rot: 1 } },
};

/** Wo die Säule lebt: die Index-Seite des Space. Den Fokus startet man oben im Kopf, auf jeder Seite. */
export const fzZiel = (space: SpaceId): string => (space === 'privat' ? '/os/finanzen?s=privat#index' : '/os/finanzen?s=business');
const start = (space: SpaceId) => ({ text: 'Oben im Kopf „Fokus“ starten', href: fzZiel(space) });
const BEREICH_LABEL: Record<string, string> = {
  home: 'Home', heute: 'Heute', wachstum: 'Wachstum', system: 'System', zoe: 'ZOE', inbox: 'Inbox', kalender: 'Kalender', uebersicht: 'Übersicht',
  finanzen: 'Finanzen', aufgaben: 'Aufgaben', 'ziele-planung': 'Ziele & Planung', gesundheit: 'Gesundheit', familie: 'Familie', kontakte: 'Kontakte',
  markttraktion: 'Markttraktion', mandate: 'Mandate', agenten: 'Agenten', brain: 'Brain', sonstiges: 'MAKE OS',
};
export const bereichLabel = (id: string): string => BEREICH_LABEL[id] ?? id.replace(/-/g, ' ');

export function fzKennzahlen(space: SpaceId): KennzahlDefBasis[] {
  const s = SCHWELLEN[space], name = SPACE_LABEL[space];
  return [
    { id: 'zeit_woche', label: `Zeit im ${name}-Modus (7 Tage)`, saeule: FZ_ID, gruppe: 'Zeit', einheit: 'stunden', richtung: 'hoch', gruen: s.woche[0], rot: s.woche[1],
      formel: 'Sichtbare Zeit in MAKE OS im Space + bewusste Fokus-Zeit, letzte 7 Tage', quelle: 'Anwesenheit (alle 30 s, nur sichtbares Fenster) + Fokus-Zähler',
      luecke: 'Noch keine Zeit gemessen', pflegen: start(space) },
    { id: 'bewusst_woche', label: 'Bewusste Fokus-Zeit (7 Tage)', saeule: FZ_ID, gruppe: 'Fokus', gewicht: 1.25, einheit: 'stunden', richtung: 'hoch', gruen: s.bewusst[0], rot: s.bewusst[1],
      formel: 'Summe der mit dem Fokus-Zähler gestarteten Blöcke, letzte 7 Tage', quelle: 'Fokus-Zähler im Kopf',
      luecke: 'Noch kein Fokus-Block gestartet', pflegen: start(space) },
    { id: 'fokus_tage', label: 'Fokus-Tage (7 Tage)', saeule: FZ_ID, gruppe: 'Fokus', einheit: 'anzahl', richtung: 'hoch', gruen: s.tage[0], rot: s.tage[1],
      formel: `Tage mit mindestens ${Math.round(FOKUS_TAG_SEK / 60)} min bewusster Fokus-Zeit`, quelle: 'Fokus-Zähler im Kopf',
      luecke: 'Noch kein Fokus-Block gestartet', pflegen: start(space) },
    { id: 'bereich_zeit', label: `${s.bereich.label} (7 Tage)`, saeule: FZ_ID, gruppe: 'Zeit', einheit: 'stunden', richtung: 'hoch', gruen: s.bereich.gruen, rot: s.bereich.rot,
      formel: `Zeit im Bereich ${bereichLabel(s.bereich.id)}, sichtbar + bewusst, letzte 7 Tage`, quelle: 'Anwesenheit + Fokus-Zähler',
      luecke: 'Noch keine Zeit gemessen', pflegen: start(space) },
  ];
}

const h = (sek: number) => stunden(sek);
const hText = (sek: number) => `${h(sek).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`;

function bereichDetails(space: SpaceId, zeit: ZeitBild): Detail[] {
  return bereicheNachZeit(zeit.sieben, space, 6).map(x => ({
    titel: bereichLabel(x.bereich), wert: zeitText(x.sek), unter: x.bewusst ? `davon ${zeitText(x.bewusst)} bewusst` : 'nur mitgelaufen', href: fzZiel(space),
  }));
}

/** Eine Messung der Säule — für beide Indizes dieselbe Rechnung. */
export function fzMessung(id: string, space: SpaceId, zeit: ZeitBild | undefined | null): Messung {
  if (!zeit) return { luecke: 'Noch keine Zeit gemessen' };
  const gesamt = zeit.sieben.gesamt[space], bewusst = zeit.sieben.bewusst[space];
  const s = SCHWELLEN[space];
  // Anlaufphase: erst ab einer Stunde in 7 Tagen wird bewertet — vorher ist es eine Lücke mit Stand, keine schlechte Note.
  if (gesamt > 0 && gesamt < MIN_MESSUNG_SEK) return { luecke: `Erst ${zeitText(gesamt)} gemessen — ab 1 h in 7 Tagen zählt die Säule`, details: bereichDetails(space, zeit) };
  switch (id) {
    case 'zeit_woche': {
      if (gesamt <= 0) return { luecke: `Noch keine Zeit im ${SPACE_LABEL[space]}-Modus gemessen`, details: [{ titel: 'Fokus starten', unter: 'oben im Kopf — oder einfach im Modus arbeiten, die Zeit läuft mit', href: fzZiel(space) }] };
      return { wert: h(gesamt), anzeige: hText(gesamt), quelle: `heute ${zeitText(zeit.tagHeute.gesamt[space])} · 7 Tage ${zeitText(gesamt)}`, details: bereichDetails(space, zeit) };
    }
    case 'bewusst_woche': {
      if (gesamt <= 0) return { luecke: `Noch keine Zeit im ${SPACE_LABEL[space]}-Modus gemessen` };
      const anteil = gesamt ? Math.round((bewusst / gesamt) * 100) : 0;
      return { wert: h(bewusst), anzeige: hText(bewusst), quelle: `${anteil} % der Zeit im Modus war bewusster Fokus`,
        details: zeit.bloecke.filter(b => b.schluessel.startsWith(`${space}:`)).slice(0, 6).map(b => ({ titel: b.label || bereichLabel(b.schluessel.split(':')[1] ?? ''), wert: zeitText(b.sek), unter: `${b.tag.slice(8, 10)}.${b.tag.slice(5, 7)}. · ${b.von.slice(11, 16)} Uhr` })) };
    }
    case 'fokus_tage': {
      if (gesamt <= 0) return { luecke: `Noch keine Zeit im ${SPACE_LABEL[space]}-Modus gemessen` };
      const n = zeit.fokusTage[space];
      // Die Tage dahinter: bewusste Sekunden je Tag aus den Blöcken dieses Space.
      const jeTag = new Map<string, number>();
      for (const b of zeit.bloecke) if (b.schluessel.startsWith(`${space}:`)) jeTag.set(b.tag, (jeTag.get(b.tag) ?? 0) + b.sek);
      const details: Detail[] = [...jeTag.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)
        .map(([tag, sek]) => ({ titel: `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`, wert: zeitText(sek), ampel: sek >= FOKUS_TAG_SEK ? 'gruen' : 'gelb', href: fzZiel(space) }));
      return { wert: n, anzeige: `${n} von 7`, quelle: `Tage mit ≥ ${Math.round(FOKUS_TAG_SEK / 60)} min bewusstem Fokus`, details };
    }
    case 'bereich_zeit': {
      if (gesamt <= 0) return { luecke: `Noch keine Zeit im ${SPACE_LABEL[space]}-Modus gemessen` };
      const sek = bereichZeit(zeit.sieben, space, s.bereich.id);
      return { wert: h(sek), anzeige: hText(sek), quelle: `${bereichLabel(s.bereich.id)}: heute ${zeitText(bereichZeit(zeit.tagHeute, space, s.bereich.id))}`, details: bereichDetails(space, zeit) };
    }
    default: return { luecke: 'Keine Messung hinterlegt' };
  }
}

/** Die Messfunktionen für ein Modell, das den Bestand hält: `messen(b => b.zeit)`. */
export function fzMessen<B>(space: SpaceId, zeitVon: (b: B) => ZeitBild | undefined | null): Record<string, (b: B) => Messung> {
  return Object.fromEntries(fzKennzahlen(space).map(k => [k.id, (b: B) => fzMessung(k.id, space, zeitVon(b))]));
}

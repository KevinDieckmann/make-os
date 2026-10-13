// ─── Fulfillment · Prozesse — Wirkungsbericht und Nachsorge (C1, 10.10.; FULFILLMENT_KONZEPT.md 5.3) ────────────────────────────────
// Der Wirkungsbericht schließt den Kreis: Wert-Konto vorher → nachher, erledigte Quick Wins, Lieferobjekte (erledigte, für Kunden sichtbare
// Schritte), Befähigung „läuft ohne uns“ und — nur mit vermerkter Einwilligung (Tag, wie) — ein Kundenzitat. Er geht an den Kunden, also:
// nie Bausteine, die `fuerKundenFrei` sperrt („nur intern“, ungeprüft „vor Verkauf“/„rechtlich“), keine internen Schritte, keine Health, kein Honorar. Keine Garantie, kein Erfolgshonorar (Satz im Bericht).
// Daraus per Klick: Testimonial anfragen (Aufgabe), Fallstudie (Baustein-Entwurf, anonym ohne Einwilligung), Empfehlung erfragen
// (Follow-up), nächste Stufe (vorhandener Vorschlag der Leistungstreppe). Nachsorge: an Tag +14/+45/+90 nach Mandatsende je ein Vorschlag
// im Stapel (Check-in · Empfehlung · nächste Stufe), Marken `nachsorge:<mandat>:<tag>` gegen Doppelte. Rein und client-sicher.

import type { Baustein, Fall, Freigabepunkt, VorlagenDatei, WertKontoZeile } from '../typen';
import type { Mandat } from '@/lib/crm/typen';
import { wertKontoZeilen } from '../regeln';
import { kundenGesperrt } from './bausteine';
import { fnv } from './pruefen';
import { zielErreichung } from './wert';
import { kundenTeile, kundenText, type KundenPhase, type KundenQuickWin } from '../kunde/bild';

export interface WirkungsDokument {
  titel: string; kunde: string; mandat: string; paket?: string; absender?: string;
  zeitraum: string; stand: string;
  /** Mit `anteil` (0–100, seit 12.10.), wenn das Ziel messbar ist — für die Vorher/Nachher-Grafik. */
  wertKonto: (WertKontoZeile & { anteil?: number })[];
  quickWins: string[];
  lieferobjekte: string[];
  befaehigung: { text: string; erfuellt: boolean }[];
  zitat?: { text: string };
  hinweis: string;
  // Seit 12.10. (Fulfillment extern, „ein Bild“) — dieselben Teile wie Kunden-Seite und Report (lib/fulfillment/kunde/bild.ts):
  /** Die Meilensteine als Phasen-Strahl (nur geteilte Phasen, Abstimmungspunkte nur mit Kunde). */
  phasen?: KundenPhase[];
  /** Erreichte erste Erfolge mit Datum (dieselben wie `quickWins`, strukturiert für die Grafik). */
  erfolge?: KundenQuickWin[];
  /** Wie es weitergehen kann: die nächste Stufe der Leistungstreppe — Name und Ergebnis, nie ein Preis. */
  naechsteStufe?: { name: string; text?: string };
}

const datum = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);
export const WIRKUNG_HINWEIS = 'Dieser Bericht hält fest, was gemeinsam erreicht wurde. Er ist keine Garantie künftiger Ergebnisse; es gibt kein Erfolgshonorar.';

export function wirkungsDokument(e: {
  fall: Fall; mandat: Pick<Mandat, 'kunde' | 'titel' | 'ziele' | 'start'>; paket?: string; absender?: string; heute: string;
  bausteine: readonly Pick<Baustein, 'id' | 'tags' | 'urheberPruefen' | 'rechtPruefen' | 'rechtGeprueft'>[];
  /** Marken der Vorlagen-Datei (Vermerk „vor Verkauf geprüft“) — für die EINE Regel `fuerKundenFrei`. */
  marken?: VorlagenDatei['marken'];
  /** Ein Kundenzitat — nur mit vermerkter Einwilligung (der Aufrufer prüft `einwilligungAm`). */
  zitat?: { text: string; einwilligungAm: string; wie: string };
  /** Abstimmungspunkte der Vorlage (für die Meilensteine am Strahl; seit 12.10.). */
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  /** Die nächste Stufe der Leistungstreppe (Name, Ergebnis) — als Hinweis „Wie es weitergehen kann“, nie mit Preis (seit 12.10.). */
  naechsteStufe?: { name: string; text?: string };
}): WirkungsDokument {
  const intern = kundenGesperrt(e.bausteine, { marken: e.marken ?? {} });
  const lieferobjekte = e.fall.knoten
    .filter(k => k.status === 'erledigt' && k.kundeSichtbar === true && !(k.bausteinId && intern.has(k.bausteinId)) && !k.id.startsWith('fk-ob-'))
    .map(k => { const t = kundenText(k.titel); return k.ergebnis ? `${t}: ${k.ergebnis}` : t; });
  const von = (e.mandat.start ?? e.fall.gestartetAm).slice(0, 10);
  const teile = kundenTeile({ fall: e.fall, mandat: e.mandat, heute: e.heute, anrede: 'sie', gesperrt: intern, ...(e.freigaben ? { freigaben: e.freigaben } : {}) });
  return {
    titel: 'Wirkungsbericht', kunde: e.mandat.kunde, mandat: e.mandat.titel, ...(e.paket ? { paket: e.paket } : {}), ...(e.absender ? { absender: e.absender } : {}),
    zeitraum: `${datum(von)} – ${datum(e.heute)}`, stand: datum(e.heute),
    wertKonto: wertKontoZeilen(e.fall, e.mandat).map(z => { const a = zielErreichung(e.fall.wertKonto?.[z.zielId]); return a != null ? { ...z, anteil: a } : z; }),
    quickWins: e.fall.quickWins.filter(q => q.erledigtAm).map(q => `${kundenText(q.text)} (erledigt am ${datum(q.erledigtAm!)})`),
    lieferobjekte,
    befaehigung: e.fall.befaehigung.map(b => ({ text: kundenText(b.text), erfuellt: b.erfuellt })),
    ...(e.zitat?.einwilligungAm ? { zitat: { text: e.zitat.text } } : {}),
    hinweis: WIRKUNG_HINWEIS,
    ...(teile.phasen.length ? { phasen: teile.phasen } : {}),
    ...(teile.quickWins.some(q => q.erledigt) ? { erfolge: teile.quickWins.filter(q => q.erledigt) } : {}),
    ...(e.naechsteStufe?.name ? { naechsteStufe: { name: e.naechsteStufe.name, ...(e.naechsteStufe.text ? { text: e.naechsteStufe.text } : {}) } } : {}),
  };
}

/**
 * Name des PDFs im verschlüsselten Ordner `fulfillment-unterlagen` — nur Fingerabdruck der Mandat-Kennung + Tag (kein Kundenname auf der Platte).
 * Die Ablage nimmt nur Namen der Form `[a-z0-9-]{8,60}.bin` (`BILD_NAME`, lib/store/datei-huelle.mjs) — der frühere Name `wirkung-<mandat>-<tag>.pdf`
 * wurde dort abgelehnt (zusammengeführt 11.10.). Der Name steht im Fall (`wirkung.dateiName`), damit die Fristen von C2 die Datei nicht als verwaist
 * entfernen. Heruntergeladen bzw. angehängt wird sie als `wirkungAnzeigename`.
 */
export const wirkungDateiname = (mandatId: string, heute: string) => `wirkung-${fnv(mandatId)}-${heute}.bin`;
/** Name beim Herunterladen und in der Dateiablage (für den Mail-Anhang). */
export const wirkungAnzeigename = (heute: string) => `Wirkungsbericht-${heute}.pdf`;

/**
 * Fallstudie als Baustein-Entwurf (Art „dokument“): ohne Einwilligung anonym („ein Kunde aus dem Bestand“), mit Einwilligung mit Namen.
 * Nie mit Health, Honorar oder internen Schritten.
 */
export function fallstudieEntwurf(d: WirkungsDokument, mitNamen: boolean): { titel: string; text: string; gliederung: string[] } {
  const wer = mitNamen ? d.kunde : 'ein Kunde';
  const zeilen = [
    `Ausgangslage und Ziel: ${d.wertKonto.map(z => `${z.name} (vorher ${z.vorher}, Ziel ${z.ziel})`).join('; ') || '—'}`,
    `Was wir gemeinsam umgesetzt haben: ${d.lieferobjekte.join('; ') || '—'}`,
    `Ergebnis: ${d.wertKonto.map(z => `${z.name}: jetzt ${z.jetzt}`).join('; ') || '—'}`,
    ...(d.quickWins.length ? [`Schnelle Erfolge: ${d.quickWins.join('; ')}`] : []),
    ...(mitNamen && d.zitat ? [`Stimme des Kunden: „${d.zitat.text}“`] : []),
  ];
  return { titel: `Fallstudie: ${mitNamen ? d.kunde : 'Kunde (anonym)'}`.slice(0, 120), text: `Fallstudie über ${wer}.\n\n${zeilen.join('\n\n')}`.slice(0, 30_000), gliederung: ['Ausgangslage', 'Umsetzung', 'Ergebnis', ...(mitNamen && d.zitat ? ['Stimme des Kunden'] : [])] };
}

export type NachsorgeArt = 'checkin' | 'empfehlung' | 'stufe';
export const NACHSORGE_TEXT: Record<NachsorgeArt, string> = { checkin: 'Check-in nach dem Mandat', empfehlung: 'Nach einer Empfehlung fragen', stufe: 'Nächste Stufe anbieten' };
export const markeNachsorge = (mandatId: string, tag: number) => `nachsorge:${mandatId}:${tag}`;

/**
 * Welche Nachsorge-Vorschläge heute fällig sind: je Fall nach Mandatsende die Tage aus den Einstellungen (Vorgabe 14, 45, 90) — die erste
 * Stufe ist ein Check-in, die mittlere die Empfehlung, die letzte die nächste Stufe. Schon vorgeschlagen (Marke) → nicht noch einmal.
 */
export function nachsorgeFaellig(e: {
  faelle: readonly Pick<Fall, 'mandatId' | 'marken'>[]; enden: Readonly<Record<string, string | null>>; tage: readonly number[]; heute: string;
}): { mandatId: string; tag: number; art: NachsorgeArt; faelligAm: string }[] {
  const tage = [...e.tage].sort((a, b) => a - b);
  const art = (i: number): NachsorgeArt => (i === 0 ? 'checkin' : i === tage.length - 1 ? 'stufe' : 'empfehlung');
  const raus: { mandatId: string; tag: number; art: NachsorgeArt; faelligAm: string }[] = [];
  for (const f of e.faelle) {
    const ende = e.enden[f.mandatId];
    if (!ende) continue;
    tage.forEach((t, i) => {
      const am = plusTage(ende, t);
      if (am <= e.heute && !f.marken[markeNachsorge(f.mandatId, t)]) raus.push({ mandatId: f.mandatId, tag: t, art: art(i), faelligAm: am });
    });
  }
  return raus;
}
function plusTage(t: string, n: number): string { const d = new Date(`${t.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

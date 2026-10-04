// ─── Überblick „Für dich“ — die Reihen je Bereich (04.10.2026 abends, rein) ──
// Je Bereich EINE reine Funktion: schmale, schon gefilterte Eingänge (der Server lädt und filtert, lib/fluss/server.ts) →
// `FlussReihe`. Keine Server-Importe, kein Datum aus der Uhr — `heute` kommt vom Aufrufer. Getestet mit erfundenen Daten
// (tests/fluss.test.ts). Die Prognose rechnet nur aus dem, was terminiert ist; ohne Grundlage bleibt sie leer.
//
//   Bereich             Raster  Ist (letzte 3 Monate)                Prognose (nächste 3 Monate)
//   markttraktion       Monat   gewonnener Umsatz                    offene Deals × Wahrscheinlichkeit, nach erwartetem Abschluss
//   finanzen-privat     Monat   Ausgaben (Buchungen)                 bekannte Ausgaben: Raten, offene Rechnungen, feste Kosten
//   finanzen-business   Woche   Saldo der Buchungen (ein − aus)      Liquiditäts-Vorschau (Rechnungen, Zahlungen, Planposten)
//   planung             Woche   erreichte Meilensteine/Ziele         fällige Meilensteine/Ziel-Fristen
//   aufgaben            Woche   erledigte Aufgaben                   fällige offene Aufgaben
//   kalender            Woche   Termin-Stunden                       Termin-Stunden der eingetragenen Termine
//   gesundheit          Woche   Trainingseinheiten                   Einheiten aus dem Wochenplan + Routinen mit Datum
//   familie             Woche   gemeinsame Momente (Dates, Gespräche) geplante Dates, Gespräche, Vereinbarungen, Tage
//   netzwerken          Woche   erfasste Kontakte                    fälliges Nachfassen der Kontakte
//   inbox               Woche   eingegangene Mails                   Wiedervorlagen

import {
  FLUSS_ZEILEN_MAX, istReihe, mitGrundlage, prognoseReihe, flussZahl, type FlussEintrag, type FlussReihe, type FlussZeile,
} from './modell';

const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const zeilen = (l: (FlussZeile | null | false | undefined)[]): FlussZeile[] => l.filter((z): z is FlussZeile => !!z).slice(0, FLUSS_ZEILEN_MAX);
const tagVon = (v: string | null | undefined): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const wochenEnde = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ── Markttraktion ────────────────────────────────────────────────────────────
export interface MtDealEingang { id: string; titel: string; wert: number; gewichtet: number; stufe: string; erwartetAm?: string | null; gewonnenAm?: string | null; offen: boolean; link?: string }
export function flussMarkttraktion(i: { heute: string; deals: readonly MtDealEingang[] }): FlussReihe {
  const gewonnen = i.deals.filter(d => !d.offen && d.gewonnenAm).map(d => ({ tag: d.gewonnenAm, wert: d.wert }));
  const offen = i.deals.filter(d => d.offen && tagVon(d.erwartetAm));
  const p = prognoseReihe(offen.map(d => ({ tag: d.erwartetAm, wert: d.gewichtet })), i.heute, 'monat');
  return {
    bereich: 'markttraktion', titel: 'Umsatz je Monat', einheit: 'euro', raster: 'monat', heute: i.heute,
    ist: istReihe(gewonnen, i.heute, 'monat'), istLabel: 'gewonnen',
    ...mitGrundlage(p, offen.length, 'aus der Pipeline × Wahrscheinlichkeit'), prognoseLabel: 'gewichtet erwartet',
    zeilen: zeilen([...offen].sort((a, b) => b.gewichtet - a.gewichtet).map(d => ({
      id: d.id, titel: d.titel, unter: `Deal · ${d.stufe} · erwartet ${kurz(d.erwartetAm!)}${d.erwartetAm! < i.heute ? ' — überfällig' : ''}`,
      zahl: flussZahl(d.gewichtet, 'euro'), ton: d.erwartetAm! < i.heute ? 'achtung' as const : 'info' as const, ...(d.link ? { link: d.link } : {}),
    }))),
    leer: 'Noch keine Deals — Umsatz und Prognose erscheinen, sobald Deals mit erwartetem Abschluss da sind.',
  };
}

// ── Finanzen ─────────────────────────────────────────────────────────────────
export interface BekannteAusgabe { titel: string; tag: string; wert: number; art: 'rate' | 'rechnung' | 'fix' }
/** Privat (Monat): Ist = Ausgaben der Buchungen (positiv, €), Prognose = bekannte Ausgaben (Raten, offene Rechnungen, feste Kosten). */
export function flussFinanzenPrivat(i: { heute: string; ausgaben: readonly FlussEintrag[]; bekannt: readonly BekannteAusgabe[]; link?: string }): FlussReihe {
  const p = prognoseReihe(i.bekannt, i.heute, 'monat');
  // Je Rate bzw. Rechnung nur die nächste Fälligkeit (eine Zeile je Posten, nicht jede Monatsrate).
  const gesehen = new Set<string>();
  const naechste = [...i.bekannt].filter(b => b.art !== 'fix' && b.tag >= i.heute).sort((a, b) => a.tag.localeCompare(b.tag))
    .filter(b => (gesehen.has(`${b.art}:${b.titel}`) ? false : (gesehen.add(`${b.art}:${b.titel}`), true)));
  const ueber = i.bekannt.filter(b => b.art === 'rechnung' && b.tag < i.heute);
  return {
    bereich: 'finanzen-privat', titel: 'Ausgaben je Monat', einheit: 'euro', raster: 'monat', heute: i.heute,
    ist: istReihe(i.ausgaben, i.heute, 'monat'), istLabel: 'ausgegeben',
    ...mitGrundlage(p, i.bekannt.length, 'aus Raten, offenen Rechnungen und festen Kosten'), prognoseLabel: 'bekannte Ausgaben',
    zeilen: zeilen([
      ueber.length > 0 && { id: 'ueberfaellig', titel: `${ueber.length} Rechnung${ueber.length === 1 ? '' : 'en'} überfällig`, unter: 'Finanzen · jetzt bezahlen oder erledigen', zahl: flussZahl(ueber.reduce((s, b) => s + b.wert, 0), 'euro'), ton: 'kritisch' as const, ...(i.link ? { link: i.link } : {}) },
      ...naechste.slice(0, 3).map(b => ({ id: `${b.art}:${b.titel}:${b.tag}`, titel: b.titel, unter: `${b.art === 'rate' ? 'Rate' : 'Rechnung'} · fällig ${kurz(b.tag)}`, zahl: flussZahl(b.wert, 'euro'), ton: 'info' as const, ...(i.link ? { link: i.link } : {}) })),
    ]),
    leer: 'Noch keine privaten Buchungen — der Verlauf erscheint nach dem ersten Kontoauszug.',
  };
}
/** Business (Woche): Ist = Saldo der Firmen-Buchungen je Woche (€), Prognose = Liquiditäts-Vorschau (ein − aus je Woche). */
export function flussFinanzenBusiness(i: { heute: string; saldo: readonly FlussEintrag[]; vorschau: readonly FlussEintrag[]; faellig: readonly { id: string; titel: string; tag: string; wert: number; eingang: boolean; link?: string }[]; link?: string }): FlussReihe {
  const p = prognoseReihe(i.vorschau, i.heute, 'woche');
  return {
    bereich: 'finanzen-business', titel: 'Saldo je Woche', einheit: 'euro', raster: 'woche', heute: i.heute,
    ist: istReihe(i.saldo, i.heute, 'woche'), istLabel: 'ein − aus',
    ...mitGrundlage(p, i.vorschau.filter(v => v.wert).length, 'aus der Liquiditäts-Vorschau'), prognoseLabel: 'ein − aus geplant',
    zeilen: zeilen([...i.faellig].sort((a, b) => a.tag.localeCompare(b.tag)).map(f => ({
      id: f.id, titel: f.titel, unter: `${f.eingang ? 'Eingang' : 'Zahlung'} · ${f.tag < i.heute ? `überfällig seit ${kurz(f.tag)}` : `fällig ${kurz(f.tag)}`}`,
      zahl: `${f.eingang ? '+' : '−'}${flussZahl(f.wert, 'euro')}`, ton: f.tag < i.heute ? 'kritisch' as const : f.eingang ? 'gut' as const : 'info' as const, ...((f.link ?? i.link) ? { link: f.link ?? i.link } : {}),
    }))),
    leer: 'Noch keine Firmen-Buchungen und keine Vorschau — beides erscheint mit Kontostand, Rechnungen und Zahlungen.',
  };
}

// ── Planung ──────────────────────────────────────────────────────────────────
export interface PlanPunkt { id: string; titel: string; art: 'meilenstein' | 'ziel'; faellig?: string | null; erledigt: boolean; erledigtAm?: string | null; link?: string }
export function flussPlanung(i: { heute: string; punkte: readonly PlanPunkt[] }): FlussReihe {
  const offen = i.punkte.filter(p => !p.erledigt && tagVon(p.faellig));
  const ueber = offen.filter(p => p.faellig! < i.heute).sort((a, b) => a.faellig!.localeCompare(b.faellig!));
  const kommend = offen.filter(p => p.faellig! >= i.heute).sort((a, b) => a.faellig!.localeCompare(b.faellig!));
  return {
    bereich: 'planung', titel: 'Meilensteine & Ziele je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.punkte.filter(p => p.erledigt).map(p => ({ tag: tagVon(p.erledigtAm) ?? tagVon(p.faellig) })), i.heute, 'woche'), istLabel: 'erreicht',
    ...mitGrundlage(prognoseReihe(offen.map(p => ({ tag: p.faellig })), i.heute, 'woche'), offen.length, 'aus Fälligkeiten'), prognoseLabel: 'fällig',
    zeilen: zeilen([
      ...ueber.map(p => ({ id: p.id, titel: p.titel, unter: `${p.art === 'ziel' ? 'Ziel' : 'Meilenstein'} · überfällig seit ${kurz(p.faellig!)} — neu planen oder abschließen`, ton: 'kritisch' as const, ...(p.link ? { link: p.link } : {}) })),
      ...kommend.map(p => ({ id: p.id, titel: p.titel, unter: `${p.art === 'ziel' ? 'Ziel' : 'Meilenstein'} · fällig ${kurz(p.faellig!)}`, ton: 'info' as const, ...(p.link ? { link: p.link } : {}) })),
    ]),
    leer: 'Noch keine Meilensteine mit Datum — sie erscheinen hier, sobald ein Ziel einen Termin hat.',
  };
}

// ── Aufgaben ─────────────────────────────────────────────────────────────────
export interface AufgabePunkt { id: string; titel: string; erledigt: boolean; faellig?: string | null; erledigtAm?: string | null; link?: string }
export function flussAufgaben(i: { heute: string; aufgaben: readonly AufgabePunkt[]; link?: string }): FlussReihe {
  const offen = i.aufgaben.filter(a => !a.erledigt && tagVon(a.faellig));
  const ueber = offen.filter(a => a.faellig! < i.heute);
  const woche = offen.filter(a => a.faellig! >= i.heute && a.faellig! <= wochenEnde(i.heute, 6));
  const erledigtWoche = i.aufgaben.filter(a => a.erledigt && (tagVon(a.erledigtAm) ?? '') > wochenEnde(i.heute, -7)).length;
  return {
    bereich: 'aufgaben', titel: 'Aufgaben je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.aufgaben.filter(a => a.erledigt).map(a => ({ tag: tagVon(a.erledigtAm) })), i.heute, 'woche'), istLabel: 'erledigt',
    ...mitGrundlage(prognoseReihe(offen.map(a => ({ tag: a.faellig })), i.heute, 'woche'), offen.length, 'aus Fälligkeiten'), prognoseLabel: 'fällig',
    zeilen: zeilen([
      ueber.length > 0 && { id: 'ueberfaellig', titel: `${ueber.length} überfällig`, unter: 'Aufgaben · heute erledigen, verschieben oder abgeben', zahl: String(ueber.length), ton: 'kritisch' as const, ...(i.link ? { link: i.link } : {}) },
      woche.length > 0 && { id: 'woche', titel: `${woche.length} fällig in den nächsten 7 Tagen`, unter: 'Aufgaben · einplanen', zahl: String(woche.length), ton: 'achtung' as const, ...(i.link ? { link: i.link } : {}) },
      { id: 'erledigt', titel: `${erledigtWoche} erledigt in den letzten 7 Tagen`, unter: 'Aufgaben · was geschafft ist', zahl: String(erledigtWoche), ton: 'gut' as const },
    ]),
    leer: 'Noch keine Aufgaben — sie erscheinen hier, sobald etwas erledigt oder terminiert ist.',
  };
}

// ── Kalender ─────────────────────────────────────────────────────────────────
export interface TerminPunkt { id: string; titel: string; start: string; ende: string; ganztags?: boolean; /** Ort zum Handeln (z. B. der Tag im Kalender) — sonst der Bereich. */ link?: string }
export function flussKalender(i: { heute: string; termine: readonly TerminPunkt[]; link?: string }): FlussReihe {
  const zeitlich = i.termine.filter(t => !t.ganztags && tagVon(t.start));
  const stunden = (t: TerminPunkt) => Math.max(0, Math.min(24, (Date.parse(t.ende) - Date.parse(t.start)) / 36e5)) || 0;
  const kuenftig = zeitlich.filter(t => t.start.slice(0, 10) >= i.heute);
  return {
    bereich: 'kalender', titel: 'Termin-Stunden je Woche', einheit: 'stunden', raster: 'woche', heute: i.heute,
    ist: istReihe(zeitlich.filter(t => t.start.slice(0, 10) <= i.heute).map(t => ({ tag: t.start, wert: stunden(t) })), i.heute, 'woche'), istLabel: 'in Terminen',
    ...mitGrundlage(prognoseReihe(kuenftig.map(t => ({ tag: t.start, wert: stunden(t) })), i.heute, 'woche', { ueberfaelligHeute: false }), kuenftig.length, 'aus eingetragenen Terminen'), prognoseLabel: 'eingetragen',
    zeilen: zeilen([...kuenftig].sort((a, b) => a.start.localeCompare(b.start)).map(t => ({
      id: t.id, titel: t.titel, unter: `Termin · ${kurz(t.start)} ${t.start.slice(11, 16)}`, zahl: flussZahl(stunden(t), 'stunden'), ton: 'info' as const, ...((t.link ?? i.link) ? { link: t.link ?? i.link } : {}),
    }))),
    leer: 'Noch keine Termine — der Verlauf erscheint, sobald der Kalender verbunden ist.',
  };
}

// ── Gesundheit ───────────────────────────────────────────────────────────────
export function flussGesundheit(i: { heute: string; einheiten: readonly string[]; planJeWoche: number; planAb?: string | null; termine: readonly { id: string; titel: string; tag: string; link?: string }[]; link?: string }): FlussReihe {
  // Plan: je Woche ab der laufenden (bzw. ab Planstart) so viele Einheiten, wie der Wochenplan vorsieht — ein Plan, keine Schätzung.
  const plan: FlussEintrag[] = [];
  if (i.planJeWoche > 0) for (let w = 0; w < 13; w++) { const tag = wochenEnde(i.heute, 7 * w); if (!i.planAb || tag >= i.planAb) plan.push({ tag, wert: i.planJeWoche }); }
  const kommend = i.termine.filter(t => t.tag >= i.heute).sort((a, b) => a.tag.localeCompare(b.tag));
  return {
    bereich: 'gesundheit', titel: 'Training je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.einheiten.map(tag => ({ tag })), i.heute, 'woche'), istLabel: 'Einheiten',
    ...mitGrundlage(prognoseReihe(plan, i.heute, 'woche', { ueberfaelligHeute: false }), plan.length, 'aus deinem Wochenplan'), prognoseLabel: 'geplant',
    zeilen: zeilen(kommend.map(t => ({ id: t.id, titel: t.titel, unter: `Gesundheit · ${kurz(t.tag)}`, ton: 'info' as const, ...((t.link ?? i.link) ? { link: t.link ?? i.link } : {}) }))),
    leer: 'Noch keine Einheiten — trag ein Training ein oder lege deinen Wochenplan an.',
  };
}

// ── Familie ──────────────────────────────────────────────────────────────────
export interface MomentPunkt { id: string; titel: string; tag: string; art: 'date' | 'gespraech' | 'vereinbarung' | 'tag' | 'wertschaetzung' }
const MOMENT: Record<MomentPunkt['art'], string> = { date: 'Date', gespraech: 'Paar-Gespräch', vereinbarung: 'Vereinbarung', tag: 'Wichtiger Tag', wertschaetzung: 'Wertschätzung' };
export function flussFamilie(i: { heute: string; gewesen: readonly MomentPunkt[]; geplant: readonly MomentPunkt[]; link?: string }): FlussReihe {
  const kommend = i.geplant.filter(m => m.tag >= i.heute).sort((a, b) => a.tag.localeCompare(b.tag));
  return {
    bereich: 'familie', titel: 'Gemeinsame Momente je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.gewesen.map(m => ({ tag: m.tag })), i.heute, 'woche'), istLabel: 'erlebt',
    ...mitGrundlage(prognoseReihe(i.geplant.map(m => ({ tag: m.tag })), i.heute, 'woche'), i.geplant.length, 'aus Geplantem'), prognoseLabel: 'geplant',
    zeilen: zeilen(kommend.map(m => ({ id: m.id, titel: m.titel, unter: `${MOMENT[m.art]} · ${kurz(m.tag)}`, ton: 'info' as const, ...(i.link ? { link: i.link } : {}) }))),
    leer: 'Noch nichts eingetragen — Dates, Gespräche und wichtige Tage erscheinen hier.',
  };
}

// ── Netzwerken ───────────────────────────────────────────────────────────────
export function flussNetzwerken(i: { heute: string; erfasst: readonly string[]; nachfassen: readonly { id: string; titel: string; tag: string; link?: string }[]; link?: string }): FlussReihe {
  const ueber = i.nachfassen.filter(n => n.tag < i.heute);
  const kommend = i.nachfassen.filter(n => n.tag >= i.heute).sort((a, b) => a.tag.localeCompare(b.tag));
  return {
    bereich: 'netzwerken', titel: 'Kontakte je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.erfasst.map(tag => ({ tag })), i.heute, 'woche'), istLabel: 'erfasst',
    ...mitGrundlage(prognoseReihe(i.nachfassen.map(n => ({ tag: n.tag })), i.heute, 'woche'), i.nachfassen.length, 'aus fälligem Nachfassen'), prognoseLabel: 'nachfassen',
    zeilen: zeilen([
      ueber.length > 0 && { id: 'ueberfaellig', titel: `${ueber.length} Kontakt${ueber.length === 1 ? '' : 'e'} nachfassen — überfällig`, unter: 'Netzwerken · Danke-Mail oder Anruf', zahl: String(ueber.length), ton: 'kritisch' as const, ...(i.link ? { link: i.link } : {}) },
      ...kommend.map(n => ({ id: n.id, titel: n.titel, unter: `Nachfassen · ${kurz(n.tag)}`, ton: 'info' as const, ...((n.link ?? i.link) ? { link: n.link ?? i.link } : {}) })),
    ]),
    leer: 'Noch niemand erfasst — auf der nächsten Veranstaltung „Erfassen“ öffnen.',
  };
}

// ── Inbox ────────────────────────────────────────────────────────────────────
export function flussInbox(i: { heute: string; eingang: readonly string[]; wiedervorlagen: readonly string[]; offen: number; verbunden: boolean; link?: string }): FlussReihe {
  return {
    bereich: 'inbox', titel: 'Mails je Woche', einheit: 'anzahl', raster: 'woche', heute: i.heute,
    ist: istReihe(i.eingang.map(tag => ({ tag })), i.heute, 'woche'), istLabel: 'eingegangen',
    ...mitGrundlage(prognoseReihe(i.wiedervorlagen.map(tag => ({ tag })), i.heute, 'woche'), i.wiedervorlagen.length, 'aus Wiedervorlagen'), prognoseLabel: 'kommt wieder',
    zeilen: zeilen([
      i.offen > 0 && { id: 'offen', titel: `${i.offen} ungelesen im Posteingang`, unter: 'Inbox · sichten, erledigen oder zur Aufgabe machen', zahl: String(i.offen), ton: 'achtung' as const, ...(i.link ? { link: i.link } : {}) },
      i.wiedervorlagen.length > 0 && { id: 'wv', titel: `${i.wiedervorlagen.length} Wiedervorlage${i.wiedervorlagen.length === 1 ? '' : 'n'}`, unter: 'Inbox · kommen zum Termin zurück', zahl: String(i.wiedervorlagen.length), ton: 'info' as const },
    ]),
    leer: i.verbunden ? 'Noch keine Mails im Abgleich.' : 'Kein Postfach verbunden — der Verlauf erscheint, sobald dein Postfach verbunden ist.',
  };
}

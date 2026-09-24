// ─── Jarvis und die Haushaltsfinanzen ───────────────────────────────────────
// Kevin, 24.09.: Jarvis darf die privaten Zahlen nutzen — im Gespräch und in
// den Briefings an Kevin und Malin, auch mit Beträgen. Die Business-Agenten
// (Board, OKR, Controlling, Loop, Tageslauf) bekommen NICHTS davon: ihre
// Ergebnisse können an Dritte gehen.
//
// Deshalb steht der Haushalt NICHT in gatherBrain(), sondern hier — und wird
// nur dort dazugeholt, wo eine Person mit Haushalt ausdrücklich benannt ist.

import type { Haushalt } from './typen';
import { eur } from './typen';
import { katNamen } from './einordnung';
import { kennzahlen, letzterMonatMitDaten, wichtig, offeneBelege } from './kennzahlen';
import { luft } from './fixkosten';
import { monatVon, monatName, vollMonate, datumDe, heuteBerlin, tageZwischen } from './monat';
import { normal } from './regeln';

/** Der Lageblock für Jarvis' Anweisung. */
export function blockHaushalt(h: Haushalt, heute: string = heuteBerlin()): string {
  const b = h.buchungen.filter(x => x.einheit === 'privat');
  if (!b.length) return 'HAUSHALT (privat): noch keine Daten — der Umzug aus Malins Cockpit steht aus.';
  const katName = katNamen(h.stamm);
  const m = letzterMonatMitDaten(b, heute);
  const k1 = kennzahlen(b, [m], katName);
  const k6 = kennzahlen(b, vollMonate(6, 0, heute), katName);
  const l = luft(b, h.schulden.filter(s => s.einheit === 'privat'), katName, heute);
  const juengste = b.reduce((x, y) => (y.datum > x ? y.datum : x), '');
  const punkte = wichtig({ buchungen: b, schulden: h.schulden.filter(s => s.einheit === 'privat'), belege: h.belege.filter(x => x.einheit === 'privat') }, katName, heute, c => eur(c));
  const rest = h.schulden.filter(s => s.einheit === 'privat').reduce((s, x) => s + x.restbetrag, 0);
  return [
    'HAUSHALT (PRIVAT — Kevins und Malins eigene Finanzen). Nutze das im Gespräch mit Kevin oder Malin und in ihren Briefings, auch mit Beträgen. NIE in Texte an Dritte, nie in Business-Auswertungen, Mails oder Entwürfe an andere.',
    `- ${monatName(m)}${m !== monatVon(heute) ? ' (jüngster Monat mit Buchungen)' : ''}: Einkommen ${eur(k1.ein)}, Ausgaben ${eur(k1.aus)}, Saldo ${eur(k1.saldo)}.`,
    `- Letzte 6 volle Monate: Sparquote ${k6.sparquote.toFixed(0)} %, Überschuss Ø ${eur(k6.saldoProMonat)}/Monat.`,
    `- Sockel (Fixkosten + Raten) ${eur(l.sockel.gesamt)}/Monat, Luft ${eur(l.luft)}/Monat.`,
    rest ? `- Restschuld privat ${eur(rest)}.` : '',
    `- Letzte Buchung ${datumDe(juengste)}${tageZwischen(juengste, heute) > 40 ? ' — seitdem kein Kontoauszug eingelesen' : ''}.`,
    punkte.length ? `- Wichtig: ${punkte.slice(0, 5).map(p => p.text).join(' | ')}` : '- Nichts Dringendes.',
    'Kennzahlen-Regeln: Einkommen ohne Kredite, ohne zurückgeflossenes Geld, ohne Umbuchungen. Kontostände und Depots kennt das System nicht.',
  ].filter(Boolean).join('\n');
}

/** Werkzeug: Stand in Kurzform. */
export function standText(h: Haushalt, heute: string = heuteBerlin()): string {
  return blockHaushalt(h, heute).split('\n').slice(1).join('\n');
}

/** Werkzeug: Buchungen suchen — Text, Monat, Kategorie. */
export function buchungenSuchen(h: Haushalt, e: { suche?: string; monat?: string; kategorie?: string }): string {
  const katName = katNamen(h.stamm);
  const s = normal(e.suche ?? '');
  const kat = normal(e.kategorie ?? '');
  const monat = /^\d{4}-\d{2}$/.test(e.monat ?? '') ? e.monat! : '';
  const treffer = h.buchungen.filter(b => (!s || normal(b.empfaenger).includes(s) || normal(b.beschreibung).includes(s))
    && (!monat || monatVon(b.datum) === monat) && (!kat || normal(katName(b.kategorie_id)).includes(kat)))
    .sort((a, b) => b.datum.localeCompare(a.datum));
  if (!treffer.length) return `Keine Buchungen gefunden${s ? ` zu „${e.suche}“` : ''}${monat ? ` im ${monatName(monat)}` : ''}.`;
  const aus = treffer.filter(b => b.betrag < 0 && !b.ist_umbuchung).reduce((x, b) => x + b.betrag, 0);
  const ein = treffer.filter(b => b.betrag > 0 && !b.ist_umbuchung).reduce((x, b) => x + b.betrag, 0);
  return [
    `${treffer.length} Buchungen${s ? ` zu „${e.suche}“` : ''}${monat ? ` im ${monatName(monat)}` : ''}: raus ${eur(Math.abs(aus))}, rein ${eur(ein)} (ohne Umbuchungen).`,
    ...treffer.slice(0, 20).map(b => `${datumDe(b.datum)} · ${b.empfaenger || b.beschreibung} · ${eur(b.betrag)} · ${katName(b.kategorie_id) || 'offen'}${b.ist_umbuchung ? ' · Umbuchung' : ''}`),
    treffer.length > 20 ? `… und ${treffer.length - 20} weitere.` : '',
  ].filter(Boolean).join('\n');
}

/** Offene Rechnungen als Liste (für Briefings). */
export function faelligeZeilen(h: Haushalt, heute: string = heuteBerlin()): string[] {
  const katName = katNamen(h.stamm);
  return wichtig({ buchungen: h.buchungen.filter(b => b.einheit === 'privat'), schulden: h.schulden.filter(s => s.einheit === 'privat'), belege: offeneBelege(h.belege, 'rechnung', 'privat') }, katName, heute, c => eur(c))
    .filter(p => p.art === 'rate' || p.art === 'rechnung' || p.art === 'import')
    .map(p => p.text);
}

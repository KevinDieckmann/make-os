// ─── CRM — Kennzahlen mit Ampel (rein, getestet) ───────────────────────────
// Die Startschwellen aus dem Konzept (Head of Sales / Marketing), nach acht
// Wochen zu kalibrieren. Jede Zahl sagt, woraus sie gerechnet ist, und ist
// „grau“, solange es noch nichts zu messen gibt — nie eine erfundene Null.
// Operations-Prinzip übernommen: Datenreife als eigene Kennzahl.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { OFFENE_STUFEN, prognose, gesundheit, gesamtwert } from './pipeline';
import { winLoss, zyklus as dealZyklus, haengtNachWert } from './deal-auswertung';
import { faellige, puenktlichkeit } from './followup';
import { mrr, konzentration } from './kunden';
import { ampel as kanalAmpel } from './recht';

export type KpiAmpel = 'gruen' | 'gelb' | 'rot' | 'grau';
export interface Kpi { id: string; label: string; wert: number | null; anzeige: string; ampel: KpiAmpel; ziel: string; quelle: string }

const tagMinus = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const echtesGespraech = (a: { art: string; ergebnis?: string }) => a.ergebnis === 'gespraech' || a.ergebnis === 'termin' || a.art === 'gespraech' || a.art === 'termin';
const stufe = (v: number, gruen: number, gelb: number, hoeherBesser = true): KpiAmpel => (hoeherBesser ? (v >= gruen ? 'gruen' : v >= gelb ? 'gelb' : 'rot') : (v <= gruen ? 'gruen' : v <= gelb ? 'gelb' : 'rot'));

export function kennzahlen(kontakte: Kontakt[], crm: CrmBestand, heute: string): Kpi[] {
  const vor7 = tagMinus(heute, 6), vor30 = tagMinus(heute, 29);
  const ph7 = crm.sitzungen.filter(s => s.datum >= vor7 && s.datum <= heute).length;
  const phJe = crm.sitzungen.length > 0;
  const akt = kontakte.flatMap(k => (k.aktivitaeten ?? []).map(a => ({ ...a, k: k.id })));
  const gespraeche7 = akt.filter(a => a.am.slice(0, 10) >= vor7 && echtesGespraech(a)).length;
  const erste = kontakte.filter(k => { const g = (k.aktivitaeten ?? []).filter(echtesGespraech).map(a => a.am.slice(0, 10)).sort()[0]; return g && g >= vor30; }).length;
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const sql30 = crm.chancen.filter(c => c.angelegt.slice(0, 10) >= vor30 && c.angelegt.slice(0, 10) <= heute).length;
  const ohneSchritt = offen.filter(c => !c.naechsterSchritt).length;
  const p = prognose(crm.chancen, heute, crm.wahrscheinlichkeiten);
  const m = mrr(crm.mandate), kz = konzentration(crm.mandate);
  const aktiv = kontakte.filter(k => !k.werbesperre);
  const ansprechbar = aktiv.filter(k => kanalAmpel(k).some(s => s.farbe !== 'rot' && s.kanal !== 'vernetzen')).length;
  const reif = kontakte.filter(k => (k.email || k.telefon) && (k.firma || k.firmaId) && (k.position || k.jobtitel)).length;
  const reife = kontakte.length ? Math.round((reif / kontakte.length) * 100) : null;
  const hatVerlauf = akt.some(a => a.art !== 'system');
  // ── Deal- und Follow-up-Ebene (27.09.): Win Rate, Zyklus, hängender Wert, Pünktlichkeit, Überfälliges, Neuumsatz gegen Ziel ──
  const wl = winLoss(crm.chancen, heute);
  const zy = dealZyklus(crm.chancen);
  const hw = haengtNachWert(crm.chancen, Object.fromEntries(offen.map(c => [c.id, gesundheit(c, heute)])));
  const fus = crm.followups ?? [];
  const pk = puenktlichkeit(fus, heute);
  const faellig = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten });
  const ueberfaellig = faellig.filter(f => f.gruppe === 'ueberfaellig').length;
  const hatFollowups = fus.length > 0 || faellig.length > 0;
  const monat = heute.slice(0, 7);
  const gewonnenMonat = crm.chancen.filter(c => c.stufe === 'gewonnen' && (c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert).slice(0, 7) === monat);
  const neuumsatz = gewonnenMonat.reduce((a, c) => a + gesamtwert(c), 0);
  const zielUmsatz = crm.wertelisten?.ziele?.umsatzNeuMonat ?? 0;
  const zielQuote = zielUmsatz > 0 ? Math.round((neuumsatz / zielUmsatz) * 100) : null;
  const tEuro = (n: number) => `${(n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} T€`;
  return [
    { id: 'power_hours', label: 'Power Hours · 7 Tage', wert: phJe ? ph7 : null, anzeige: phJe ? String(ph7) : '—', ampel: phJe ? stufe(ph7, 4, 2) : 'grau', ziel: '≥ 4 je Woche', quelle: `${crm.sitzungen.length} Power Hours insgesamt` },
    { id: 'gespraeche', label: 'Echte Gespräche · 7 Tage', wert: hatVerlauf ? gespraeche7 : null, anzeige: hatVerlauf ? String(gespraeche7) : '—', ampel: hatVerlauf ? stufe(gespraeche7, 8, 4) : 'grau', ziel: '≥ 8 je Woche', quelle: 'Gespräche und Termine im Verlauf' },
    { id: 'erstgespraeche', label: 'Neue Erstgespräche · 30 Tage', wert: hatVerlauf ? erste : null, anzeige: hatVerlauf ? String(erste) : '—', ampel: hatVerlauf ? stufe(erste, 4, 2) : 'grau', ziel: '≥ 4 je Monat', quelle: 'erstes Gespräch je Person' },
    // Ebene 1 → 2 (25.09.): Wie viele Leads wurden in 30 Tagen zum SQL, also zum Deal?
    { id: 'sql_30', label: 'Neue SQL · 30 Tage', wert: crm.chancen.length ? sql30 : null, anzeige: crm.chancen.length ? String(sql30) : '—', ampel: crm.chancen.length ? stufe(sql30, 2, 1) : 'grau', ziel: '≥ 2 je Monat', quelle: 'Leads, die zum Deal wurden (angelegte Deals)' },
    { id: 'ohne_schritt', label: 'Deals ohne nächsten Schritt', wert: offen.length ? ohneSchritt : null, anzeige: offen.length ? String(ohneSchritt) : '—', ampel: offen.length ? stufe(ohneSchritt, 0, 2, false) : 'grau', ziel: '0', quelle: `${offen.length} offene Deals` },
    { id: 'pipeline', label: 'Pipeline gewichtet', wert: offen.length ? p.gewichtet : null, anzeige: offen.length ? `${Math.round(p.gewichtet / 1000)} T€` : '—', ampel: 'grau', ziel: '≥ 3 × Umsatzlücke 90 Tage', quelle: `offen ${Math.round(p.offen / 1000)} T€, Commit ${Math.round(p.commit / 1000)} T€` },
    { id: 'mrr', label: 'Wiederkehrend je Monat', wert: m || null, anzeige: m ? `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} T€` : '—', ampel: kz ? (kz.anteil > 50 ? 'rot' : 'gruen') : 'grau', ziel: 'größter Kunde ≤ 50 %', quelle: kz ? `größter Kunde ${kz.kunde}: ${kz.anteil} %` : 'keine aktiven Monatsmandate' },
    { id: 'win_rate', label: 'Win Rate · 180 Tage', wert: wl.quote, anzeige: wl.quote !== null ? `${wl.quote} %` : `${wl.gewonnen} · ${wl.verloren}`, ampel: wl.quote !== null ? stufe(wl.quote, 40, 20) : 'grau', ziel: '≥ 40 %', quelle: wl.quote !== null ? `${wl.gewonnen} gewonnen, ${wl.verloren} verloren` : `erst ab 5 Entscheidungen (${wl.gewonnen} gewonnen · ${wl.verloren} verloren)` },
    { id: 'zyklus', label: 'Sales-Zyklus · Median', wert: zy.median, anzeige: zy.median !== null ? `${zy.median} Tage` : '—', ampel: zy.median !== null ? stufe(zy.median, 60, 120, false) : 'grau', ziel: '≤ 60 Tage', quelle: zy.median !== null ? `${zy.n} gewonnene Deals, Anlage bis gewonnen` : `erst ab 5 gewonnenen Deals (${zy.n})` },
    { id: 'haengt_wert', label: 'Hängt · nach Wert', wert: hw.anteil, anzeige: hw.anteil !== null ? `${hw.anteil} %` : '—', ampel: hw.anteil !== null ? stufe(hw.anteil, 15, 40, false) : 'grau', ziel: '≤ 15 %', quelle: hw.anteil !== null ? `${tEuro(hw.wert)} von ${tEuro(hw.gesamt)} ohne Bewegung oder überfällig` : 'keine offenen Deals mit Wert' },
    { id: 'followup_puenktlich', label: 'Follow-ups pünktlich · 30 Tage', wert: pk.quote, anzeige: pk.quote !== null ? `${pk.quote} %` : `${pk.puenktlich} · ${pk.erledigt}`, ampel: pk.quote !== null ? stufe(pk.quote, 80, 60) : 'grau', ziel: '≥ 80 %', quelle: pk.quote !== null ? `${pk.puenktlich} von ${pk.erledigt + pk.verpasst} am Tag oder davor` : `erst ab 5 erledigten Follow-ups (${pk.erledigt})` },
    { id: 'ueberfaellig', label: 'Überfällige Follow-ups', wert: hatFollowups ? ueberfaellig : null, anzeige: hatFollowups ? String(ueberfaellig) : '—', ampel: hatFollowups ? stufe(ueberfaellig, 0, 5, false) : 'grau', ziel: '0', quelle: hatFollowups ? `Zusagen, Wiedervorlagen, Deal-Schritte, Nachfassen, Kadenz — ${faellig.length} in 14 Tagen` : 'noch keine Zusagen oder Wiedervorlagen' },
    { id: 'umsatz_ziel', label: 'Neuumsatz gegen Ziel · Monat', wert: zielQuote, anzeige: zielQuote !== null ? `${zielQuote} %` : tEuro(neuumsatz), ampel: zielQuote !== null ? stufe(zielQuote, 100, 50) : 'grau', ziel: zielUmsatz > 0 ? `${tEuro(zielUmsatz)} je Monat` : 'Ziel eintragen', quelle: zielUmsatz > 0 ? `${tEuro(neuumsatz)} gewonnen im ${monat} (${gewonnenMonat.length} Deals)` : 'Ziel fehlt — Stammdaten › Wertelisten › Ziele' },
    { id: 'ansprechbar', label: 'Ansprechbar', wert: ansprechbar, anzeige: `${ansprechbar}/${aktiv.length}`, ampel: aktiv.length ? stufe(ansprechbar / aktiv.length, 0.3, 0.15) : 'grau', ziel: 'Anteil mit zulässigem Kanal steigt', quelle: 'Kanal-Ampel grün oder gelb (ohne Vernetzen)' },
    { id: 'reife', label: 'Datenreife', wert: reife, anzeige: reife === null ? '—' : `${reife} %`, ampel: reife === null ? 'grau' : stufe(reife, 70, 40), ziel: '≥ 70 %', quelle: 'Mail oder Telefon + Firma + Position' },
  ];
}

/** Vollständigkeit je Feld — für die Datenqualität. */
export function vollstaendigkeit(kontakte: Kontakt[]): { feld: string; label: string; anzahl: number; anteil: number }[] {
  const F: [string, string, (k: Kontakt) => unknown][] = [
    ['email', 'E-Mail', k => k.email], ['telefon', 'Telefon', k => k.telefon || k.sms], ['linkedin', 'LinkedIn', k => k.linkedin],
    ['firma', 'Firma', k => k.firma || k.firmaId], ['position', 'Position', k => k.position || k.jobtitel], ['aufhaenger', 'Aufhänger', k => k.aufhaenger],
    ['kreis', 'Kreis', k => k.kreis], ['anrede', 'Anrede', k => k.anrede], ['lebensphase', 'Lebensphase', k => k.lebensphase && k.lebensphase !== 'kontakt'],
  ];
  return F.map(([feld, label, f]) => { const n = kontakte.filter(k => !!f(k)).length; return { feld, label, anzahl: n, anteil: kontakte.length ? n / kontakte.length : 0 }; });
}

/** R12: Interessenten ohne echte Interaktion seit 24 Monaten → löschen oder anonymisieren prüfen. */
export function speicherbegrenzung(kontakte: Kontakt[], heute: string): Kontakt[] {
  const grenze = tagMinus(heute, 730);
  return kontakte.filter(k => !['kunde', 'ex_kunde', 'partner', 'multiplikator'].includes(k.lebensphase ?? '') && (k.importiertAm || heute) < grenze && !(k.letzterKontakt && k.letzterKontakt >= grenze));
}

// ─── Auffälligkeiten im Haushalt — gerechnet, bevor der Agent schreibt ──────
// Der Finanzagent soll nicht suchen, sondern einordnen. Was auffällt, findet
// Code: Ausreißer je Kategorie, ungewöhnlich große Einzelausgaben, mögliche
// Doppelabbuchungen, neue wiederkehrende Zahlungen, überschrittene Budgets.
// Jeder Fund trägt seine Zahlen und seine Regel — nachprüfbar.

import type { Haushalt } from '../haushalt/typen';
import { katNamen, einordnen, istAusgabe } from '../haushalt/einordnung';
import { wiederkehrend } from '../haushalt/fixkosten';
import { vollMonate, monatVon, heuteBerlin, tageZwischen, tageImMonat } from '../haushalt/monat';
import { normal } from '../haushalt/regeln';

export interface Auffaelligkeit { art: 'kategorie' | 'einzelausgabe' | 'doppelt' | 'neu-wiederkehrend' | 'budget'; schwere: 'hoch' | 'mittel' | 'niedrig'; text: string; betrag_cent: number | null; regel: string }

export function auffaelligkeiten(h: Haushalt, heute: string = heuteBerlin()): Auffaelligkeit[] {
  const katName = katNamen(h.stamm);
  const privat = h.buchungen.filter(b => b.einheit === 'privat' && !b.ist_umbuchung);
  const ausgaben = privat.filter(b => istAusgabe(einordnen(b, katName)));
  const raus: Auffaelligkeit[] = [];
  const [letzter, ...davor] = vollMonate(4, 0, heute);
  const jeKatMonat = new Map<string, number>();
  for (const b of ausgaben) {
    const k = `${b.kategorie_id ?? '__offen'}|${monatVon(b.datum)}`;
    jeKatMonat.set(k, (jeKatMonat.get(k) ?? 0) + Math.abs(b.betrag));
  }
  // 1. Kategorie deutlich über dem Schnitt der drei Monate davor
  const kats = new Set(ausgaben.map(b => b.kategorie_id ?? '__offen'));
  for (const kat of Array.from(kats)) {
    if (kat === '__offen') continue;
    const jetzt = jeKatMonat.get(`${kat}|${letzter}`) ?? 0;
    const schnitt = davor.reduce((s, m) => s + (jeKatMonat.get(`${kat}|${m}`) ?? 0), 0) / davor.length;
    if (schnitt > 0 && jetzt > schnitt * 1.5 && jetzt - schnitt >= 5000) {
      raus.push({ art: 'kategorie', schwere: jetzt - schnitt >= 30000 ? 'hoch' : 'mittel', betrag_cent: Math.round(jetzt - schnitt),
        text: `${katName(kat)} im ${letzter}: ${Math.round(jetzt / 100)} € statt Ø ${Math.round(schnitt / 100)} € (+${Math.round((jetzt / schnitt - 1) * 100)} %)`,
        regel: 'Monat > 150 % des Schnitts der 3 Monate davor und mindestens 50 € mehr' });
    }
  }
  // 2. Große Einzelausgaben im letzten vollen Monat (variabel)
  const variabel = ausgaben.filter(b => !b.ist_fixkosten).map(b => Math.abs(b.betrag)).sort((a, b) => a - b);
  const median = variabel.length ? variabel[Math.floor(variabel.length / 2)] : 0;
  ausgaben.filter(b => monatVon(b.datum) === letzter && !b.ist_fixkosten && Math.abs(b.betrag) >= Math.max(20000, median * 5))
    .sort((a, b) => a.betrag - b.betrag).slice(0, 3).forEach(b => raus.push({
      art: 'einzelausgabe', schwere: Math.abs(b.betrag) >= 100000 ? 'hoch' : 'niedrig', betrag_cent: Math.abs(b.betrag),
      text: `${b.datum}: ${b.empfaenger || b.beschreibung} ${Math.round(Math.abs(b.betrag) / 100)} € (${katName(b.kategorie_id) || 'ohne Kategorie'})`,
      regel: 'variable Ausgabe ≥ 200 € und ≥ 5× Median aller variablen Ausgaben' }));
  // 3. Mögliche Doppelabbuchung: gleicher Empfänger, gleicher Betrag, ≤ 3 Tage, letzte 60 Tage
  const jung = ausgaben.filter(b => tageZwischen(b.datum, heute) <= 60).sort((a, b) => a.datum.localeCompare(b.datum));
  const gemeldet = new Set<string>();
  for (let i = 0; i < jung.length; i++) for (let j = i + 1; j < jung.length; j++) {
    const a = jung[i], c = jung[j];
    if (tageZwischen(a.datum, c.datum) > 3) break;
    if (a.betrag === c.betrag && Math.abs(a.betrag) >= 1000 && normal(a.empfaenger) === normal(c.empfaenger) && a.konto_id === c.konto_id && !gemeldet.has(a.id)) {
      gemeldet.add(a.id); gemeldet.add(c.id);
      raus.push({ art: 'doppelt', schwere: 'mittel', betrag_cent: Math.abs(a.betrag), text: `${a.empfaenger || a.beschreibung}: zweimal ${Math.round(Math.abs(a.betrag) / 100)} € (${a.datum} und ${c.datum})`, regel: 'gleicher Empfänger, Betrag und Konto innerhalb von 3 Tagen — kann auch Absicht sein' });
    }
  }
  // 4. Wiederkehrende Zahlung, die noch nicht als Fixkosten markiert ist
  for (const w of wiederkehrend(privat, katName, heute).filter(x => !x.teilweiseMarkiert).slice(0, 5)) {
    raus.push({ art: 'neu-wiederkehrend', schwere: 'niedrig', betrag_cent: Math.round(w.proMonat), text: `${w.name}: ${w.monate}× in 12 Monaten, Ø ${Math.round(w.mittel / 100)} € (${w.vorschlag ?? 'Rhythmus unklar'}) — noch nicht als Fixkosten markiert`, regel: 'regelmäßig, Schwankung ≤ 20 % — Sockel ist ohne sie zu niedrig' });
  }
  // 5. Budget im laufenden Monat überschritten oder auf Kurs dahin
  const laufend = monatVon(heute), tag = Number(heute.slice(8, 10)), tage = tageImMonat(laufend);
  for (const k of h.stamm.kategorien.filter(x => x.monatsbudget)) {
    const ist = ausgaben.filter(b => b.kategorie_id === k.id && monatVon(b.datum) === laufend).reduce((s, b) => s + Math.abs(b.betrag), 0);
    const hoch = ist / Math.max(1, tag) * tage;
    if (ist > k.monatsbudget!) raus.push({ art: 'budget', schwere: 'mittel', betrag_cent: ist - k.monatsbudget!, text: `Budget ${k.name}: ${Math.round(ist / 100)} € von ${Math.round(k.monatsbudget! / 100)} € — schon überschritten`, regel: 'Ausgaben im laufenden Monat > Monatsbudget' });
    else if (tag >= 10 && hoch > k.monatsbudget! * 1.15) raus.push({ art: 'budget', schwere: 'niedrig', betrag_cent: Math.round(hoch - k.monatsbudget!), text: `Budget ${k.name}: auf Kurs zu ${Math.round(hoch / 100)} € bei ${Math.round(k.monatsbudget! / 100)} € Budget`, regel: 'hochgerechnet auf den Monat > 115 % des Budgets' });
  }
  const rang = { hoch: 0, mittel: 1, niedrig: 2 };
  return raus.sort((a, b) => rang[a.schwere] - rang[b.schwere]);
}

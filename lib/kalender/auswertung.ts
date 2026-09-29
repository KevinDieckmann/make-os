// ─── Kalender — Zeit-Auswertung „wie Google Time Insights“ (29.09., Paket K2, rein, getestet) ─
// Kevin 29.09.: „Stunden in Meetings, Fokus, Mandaten, privat je Woche.“ Diese Datei rechnet NUR — ohne Platte, ohne
// Netz, ohne Uhr. Gelesen wird in auswertung-server.ts (Termine aus dem iCloud-Stand, Fokus-Blöcke aus der Zeitmessung,
// Einheit/Mandat über `einheitVonBlock`/`mandateKurz` — nichts wird doppelt gerechnet).
//
// Die Woche ist die Berliner Woche Mo 00:00 – Mo 00:00 in ECHTER Zeit (ausWandzeit): die Woche der Zeitumstellung hat
// 167 bzw. 169 Stunden, eine Stunde „02:30“ Ende März zählt nicht doppelt.
//
// Arten (je Minute genau eine — Überlappungen zählen nie doppelt, Vorrang abwesend > Meeting > Fokus):
//   abwesend  Termin der Art „abwesend“ (ganztägig: die Arbeitszeit dieses Tages)
//   meeting   Termin mit Gästen oder der Art „termin“ (ohne Art = Termin) — außer „frei“ (TRANSP) ohne Gäste
//   fokus     Termin der Art „fokuszeit“ und bewusste Fokus-Blöcke der Zeitmessung
//   frei      Arbeitszeit ohne jede der drei Arten — Soll aus der Wochenvorlage (K1 Verfügbarkeit, `arbeitszeitJeTag`),
//             sonst Einstellungen vonStunde–bisStunde Mo–Fr; nie an Feiertagen NRW
// Aufgaben/Arbeitsort-Einträge ohne Gäste und sonstige ganztägige Termine (Geburtstage, Feiertage) zählen nicht.
// Privat/Business, Einheit, Mandat und Kontakte kommen je Minute von dem, was dort gewinnt.

import { ausWandzeit, tagPlus } from './zeit';
import { kalenderwoche, montagVon } from '@/lib/zeit/kalender-kern';

export type AuswertungKategorie = 'meeting' | 'fokus' | 'abwesend';
export type ZeitSpaceA = 'privat' | 'business';

/** Ein Termin, wie die Auswertung ihn braucht (aus lib/kalender/ics.ts `Termin` + Space; K1/K3-Felder optional). */
export interface ATermin {
  id?: string;
  /** Berliner Wandzeit „YYYY-MM-DDTHH:mm:ss“; ganztags 00:00, Ende exklusiv. */
  start: string;
  ende: string;
  ganztags: boolean;
  space: ZeitSpaceA;
  /** K1: termin · aufgabe · abwesend · fokuszeit · arbeitsort (fehlt = termin). */
  art?: string;
  mitTeilnehmern?: boolean;
  /** K1: TRANSP=TRANSPARENT („frei“). */
  frei?: boolean;
  /** K3: Mandat/Einheit/Kontakte am Termin — Schnittstelle, heute meist leer. */
  mandatId?: string;
  einheit?: string;
  kontakte?: string[];
}

/** Ein bewusster Fokus-Block (lib/zeitmessung `FokusBlock`, Einheit schon aufgelöst). */
export interface ABlock { von: string; bis: string; space: ZeitSpaceA | 'gemeinsam'; einheit?: string; mandatId?: string }

export interface AuswertungEingabe {
  termine: readonly ATermin[];
  bloecke: readonly ABlock[];
  /** Arbeitsfenster (Kalender-Einstellungen), Wochentage 1=Mo … 7=So (Standard Mo–Fr). */
  arbeitszeit: { vonStunde: number; bisStunde: number; tage?: readonly number[] };
  /** Feiertag? (quellen-feiertage `istFeiertag`) — an Feiertagen gibt es keine Arbeitszeit. */
  feiertag?: (tag: string) => boolean;
  /**
   * Soll-Arbeitszeit je Tag aus der Verfügbarkeit (K1 `verfuegbarkeitAus`: Wochenvorlage, ohne Feiertage und ganz
   * abwesende Tage) — Wandzeit-Fenster. Gesetzt, ersetzt sie `arbeitszeit` für alle Tage (fehlender Tag = keine).
   */
  arbeitszeitJeTag?: Readonly<Record<string, readonly { start: string; ende: string }[]>>;
}

export interface Minuten { meetings: number; fokus: number; abwesend: number; frei: number; arbeitszeit: number; belegt: number }
export interface WochenZahlen {
  /** Montag „YYYY-MM-DD“, Sonntag, ISO-KW, Länge der Woche in Minuten (Zeitumstellung!). */
  von: string; bis: string; kw: number; label: string; laenge: number;
  minuten: Minuten;
  /** Belegte Zeit (Meetings + Fokus) nach Space. */
  space: Record<ZeitSpaceA, number>;
  jeEinheit: { einheit: string; minuten: number }[];
  jeMandat: { mandatId: string; minuten: number }[];
  /** Meistbesuchte Kontakte (K3-Schnittstelle: `ATermin.kontakte`) — Termine und Minuten je Kontakt. */
  kontakte: { id: string; termine: number; minuten: number }[];
  /** Je Tag Mo–So: Meetings und Fokus in Minuten. */
  tage: { tag: string; meetings: number; fokus: number; abwesend: number }[];
  /** Anzahl Meetings (Termine, nicht Minuten). */
  anzahlMeetings: number;
}
export interface Auswertung {
  woche: WochenZahlen;
  /** Die n Wochen davor (älteste zuerst). */
  vorher: WochenZahlen[];
  /** Schnitt der Vorwochen je Kennzahl (Minuten, gerundet). */
  schnitt: Minuten & { privat: number; business: number };
  /** Woche − Schnitt je Kennzahl. */
  abweichung: Minuten & { privat: number; business: number };
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const MIN = 60_000;
const RANG: Record<AuswertungKategorie, number> = { fokus: 1, meeting: 2, abwesend: 3 };


/** Montag der Berliner Woche eines Tages (Kalender-Kern). */
export const montagDer = montagVon;

const wochentag = (tag: string) => { const w = new Date(`${tag}T12:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; };
const zwei = (n: number) => String(n).padStart(2, '0');
const wand = (tag: string, stunde: number) => (stunde >= 24 ? `${tagPlus(tag, 1)}T00:00:00` : `${tag}T${zwei(stunde)}:00:00`);

/** Was ein Termin in der Auswertung ist — oder null (zählt nicht). */
export function terminKategorie(t: Pick<ATermin, 'art' | 'mitTeilnehmern' | 'frei' | 'ganztags'>): AuswertungKategorie | null {
  const art = (t.art ?? 'termin').toLowerCase();
  if (art === 'abwesend' || art === 'abwesenheit') return 'abwesend';
  if (t.ganztags) return null;
  if (art === 'fokuszeit' || art === 'fokus') return 'fokus';
  if (t.mitTeilnehmern) return 'meeting';
  if (t.frei) return null;
  return art === 'termin' ? 'meeting' : null;
}

interface Quelle { kat: AuswertungKategorie; space: ZeitSpaceA | null; einheit?: string; mandatId?: string; kontakte?: string[] }

/** Eine Woche auswerten. `stichtag` = irgendein Tag der Woche. */
export function wocheAuswerten(e: AuswertungEingabe, stichtag: string): WochenZahlen {
  const von = montagDer(TAG.test(stichtag) ? stichtag : '1970-01-05');
  const bis = tagPlus(von, 6);
  const t0 = ausWandzeit(`${von}T00:00:00`).getTime();
  const t1 = ausWandzeit(`${tagPlus(von, 7)}T00:00:00`).getTime();
  const laenge = Math.round((t1 - t0) / MIN);
  const belegung = new Int32Array(laenge).fill(-1);
  const arbeit = new Uint8Array(laenge);
  const quellen: Quelle[] = [];
  const tagesStart = Array.from({ length: 8 }, (_, i) => Math.round((ausWandzeit(`${tagPlus(von, i)}T00:00:00`).getTime() - t0) / MIN));
  const index = (ms: number) => Math.max(0, Math.min(laenge, Math.round((ms - t0) / MIN)));

  const legen = (a: number, b: number, q: Quelle) => {
    const i0 = index(a), i1 = index(b);
    if (i1 <= i0) return;
    const nr = quellen.push(q) - 1;
    for (let i = i0; i < i1; i++) { const alt = belegung[i]; if (alt < 0 || RANG[quellen[alt].kat] < RANG[q.kat]) belegung[i] = nr; }
  };

  // Arbeitszeit je Tag (ohne Feiertage).
  const tageArbeit = new Set(e.arbeitszeit.tage ?? [1, 2, 3, 4, 5]);
  const fenster: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const tag = tagPlus(von, i);
    if (e.arbeitszeitJeTag) {
      // Vorlage (K1): mehrere Fenster je Tag möglich; das „Tagesfenster“ für ganztägig abwesend spannt vom ersten bis zum letzten.
      const f = (e.arbeitszeitJeTag[tag] ?? []).map(z => { try { return [ausWandzeit(z.start).getTime(), ausWandzeit(z.ende).getTime()] as [number, number]; } catch { return [0, 0] as [number, number]; } }).filter(([a, b]) => b > a);
      for (const [a, b] of f) for (let x = index(a); x < index(b); x++) arbeit[x] = 1;
      fenster.push(f.length ? [Math.min(...f.map(z => z[0])), Math.max(...f.map(z => z[1]))] : [0, 0]);
      continue;
    }
    if (!tageArbeit.has(wochentag(tag)) || e.feiertag?.(tag)) { fenster.push([0, 0]); continue; }
    const a = ausWandzeit(wand(tag, Math.max(0, Math.min(23, e.arbeitszeit.vonStunde)))).getTime();
    const b = ausWandzeit(wand(tag, Math.max(1, Math.min(24, e.arbeitszeit.bisStunde)))).getTime();
    fenster.push(b > a ? [a, b] : [0, 0]);
    if (b > a) for (let x = index(a); x < index(b); x++) arbeit[x] = 1;
  }

  const kontaktTermine = new Map<string, number>();
  let anzahlMeetings = 0;
  for (const t of e.termine) {
    const kat = terminKategorie(t);
    if (!kat) continue;
    const q: Quelle = { kat, space: t.space, ...(t.einheit ? { einheit: t.einheit } : {}), ...(t.mandatId ? { mandatId: t.mandatId } : {}), ...(t.kontakte?.length ? { kontakte: t.kontakte } : {}) };
    let a: number, b: number;
    try { a = ausWandzeit(t.start).getTime(); b = ausWandzeit(t.ende).getTime(); } catch { continue; }
    if (!(b > a) || b <= t0 || a >= t1) continue;
    if (t.ganztags) {
      // Ganztägig abwesend: die Arbeitszeit jedes berührten Tages.
      for (let i = 0; i < 7; i++) {
        const tag = tagPlus(von, i);
        if (tag < t.start.slice(0, 10) || tag >= t.ende.slice(0, 10)) continue;
        const [fa, fb] = fenster[i];
        if (fb > fa) legen(fa, fb, q);
      }
      continue;
    }
    legen(a, b, q);
    if (kat === 'meeting') {
      anzahlMeetings++;
      for (const k of new Set(t.kontakte ?? [])) kontaktTermine.set(k, (kontaktTermine.get(k) ?? 0) + 1);
    }
  }
  for (const bl of e.bloecke) {
    const a = Date.parse(bl.von), b = Date.parse(bl.bis);
    if (!(b > a) || b <= t0 || a >= t1) continue;
    legen(a, b, { kat: 'fokus', space: bl.space === 'gemeinsam' ? null : bl.space, ...(bl.einheit ? { einheit: bl.einheit } : {}), ...(bl.mandatId ? { mandatId: bl.mandatId } : {}) });
  }

  // Zählen — je Minute genau eine Quelle.
  const m: Minuten = { meetings: 0, fokus: 0, abwesend: 0, frei: 0, arbeitszeit: 0, belegt: 0 };
  const space: Record<ZeitSpaceA, number> = { privat: 0, business: 0 };
  const einheit = new Map<string, number>(), mandat = new Map<string, number>(), kontaktMin = new Map<string, number>();
  const tage = Array.from({ length: 7 }, (_, i) => ({ tag: tagPlus(von, i), meetings: 0, fokus: 0, abwesend: 0 }));
  let tagNr = 0;
  for (let i = 0; i < laenge; i++) {
    while (tagNr < 6 && i >= tagesStart[tagNr + 1]) tagNr++;
    if (arbeit[i]) m.arbeitszeit++;
    const nr = belegung[i];
    if (nr < 0) { if (arbeit[i]) m.frei++; continue; }
    const q = quellen[nr];
    if (q.kat === 'abwesend') { m.abwesend++; tage[tagNr].abwesend++; continue; }
    if (q.kat === 'meeting') { m.meetings++; tage[tagNr].meetings++; } else { m.fokus++; tage[tagNr].fokus++; }
    m.belegt++;
    if (q.space) space[q.space]++;
    if (q.einheit) einheit.set(q.einheit, (einheit.get(q.einheit) ?? 0) + 1);
    if (q.mandatId) mandat.set(q.mandatId, (mandat.get(q.mandatId) ?? 0) + 1);
    for (const k of q.kontakte ?? []) kontaktMin.set(k, (kontaktMin.get(k) ?? 0) + 1);
  }
  const absteigend = <K extends string>(map: Map<string, number>, feld: K) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => ({ [feld]: k, minuten: v }) as { [P in K]: string } & { minuten: number });
  const kontakte = [...kontaktTermine.entries()].map(([id, n]) => ({ id, termine: n, minuten: kontaktMin.get(id) ?? 0 }))
    .sort((a, b) => b.termine - a.termine || b.minuten - a.minuten || a.id.localeCompare(b.id)).slice(0, 10);
  const kw = kalenderwoche(von);
  return {
    von, bis, kw, label: `KW ${kw} · ${Number(von.slice(8, 10))}.${Number(von.slice(5, 7))}. – ${Number(bis.slice(8, 10))}.${Number(bis.slice(5, 7))}.${bis.slice(0, 4)}`, laenge,
    minuten: m, space, jeEinheit: absteigend(einheit, 'einheit'), jeMandat: absteigend(mandat, 'mandatId'), kontakte, tage, anzahlMeetings,
  };
}

const KENNZAHLEN: (keyof Minuten)[] = ['meetings', 'fokus', 'abwesend', 'frei', 'arbeitszeit', 'belegt'];

/** Die Woche des Stichtags + `wochen` Vorwochen, Schnitt und Abweichung. */
export function zeitAuswertung(e: AuswertungEingabe, stichtag: string, wochen = 4): Auswertung {
  const woche = wocheAuswerten(e, stichtag);
  const vorher = Array.from({ length: Math.max(0, wochen) }, (_, i) => wocheAuswerten(e, tagPlus(woche.von, -7 * (wochen - i))));
  const mittel = (f: (w: WochenZahlen) => number) => (vorher.length ? Math.round(vorher.reduce((s, w) => s + f(w), 0) / vorher.length) : 0);
  const schnitt = { ...Object.fromEntries(KENNZAHLEN.map(k => [k, mittel(w => w.minuten[k])])), privat: mittel(w => w.space.privat), business: mittel(w => w.space.business) } as Auswertung['schnitt'];
  const abweichung = { ...Object.fromEntries(KENNZAHLEN.map(k => [k, woche.minuten[k] - schnitt[k]])), privat: woche.space.privat - schnitt.privat, business: woche.space.business - schnitt.business } as Auswertung['abweichung'];
  return { woche, vorher, schnitt, abweichung };
}

/** „12,5 h“ — Minuten als Stunden mit einer Nachkommastelle. */
export const stundenAus = (min: number): string => `${(Math.round((min / 60) * 10) / 10).toLocaleString('de-DE')} h`;

/** „+1,5 h“ / „−2 h“ / „±0 h“ gegenüber dem Schnitt. */
export const abweichungText = (min: number): string => (Math.abs(min) < 3 ? '±0 h' : `${min > 0 ? '+' : '−'}${stundenAus(Math.abs(min))}`);

/** Anteil in Prozent (0 bei leerem Ganzen). */
export const anteil = (teil: number, ganz: number): number => (ganz > 0 ? Math.round((teil / ganz) * 100) : 0);

/**
 * Die Woche als Markdown-Zeilen — rein, für den Brain-Spiegel `_App/Woche/<JJJJ>-KW<NN>.md` (lib/brain/app-spiegel.ts)
 * und ZOE. Nur Zahlen und Namen, die der Aufrufer liefert (`name` für Einheit/Mandat/Kontakt) — keine Termin-Titel.
 */
export function auswertungMarkdown(a: Auswertung, name: { einheit?: (k: string) => string; mandat?: (id: string) => string; kontakt?: (id: string) => string } = {}): string {
  const w = a.woche, m = w.minuten;
  const z = (label: string, wert: number, schnitt: number) => `- ${label}: ${stundenAus(wert)} (Ø 4 Wochen ${stundenAus(schnitt)}, ${abweichungText(wert - schnitt)})`;
  const zeilen = [
    `## Zeit ${w.label}`,
    z('Meetings', m.meetings, a.schnitt.meetings) + ` · ${w.anzahlMeetings} Termine`,
    z('Fokus', m.fokus, a.schnitt.fokus),
    z('Abwesend', m.abwesend, a.schnitt.abwesend),
    z('Frei in der Arbeitszeit', m.frei, a.schnitt.frei),
    `- Privat/Business: ${anteil(w.space.privat, w.space.privat + w.space.business)} % / ${anteil(w.space.business, w.space.privat + w.space.business)} %`,
  ];
  if (w.jeEinheit.length) zeilen.push('', '### Je Firma', ...w.jeEinheit.map(x => `- ${name.einheit?.(x.einheit) ?? x.einheit}: ${stundenAus(x.minuten)}`));
  if (w.jeMandat.length) zeilen.push('', '### Je Mandat', ...w.jeMandat.map(x => `- ${name.mandat?.(x.mandatId) ?? x.mandatId}: ${stundenAus(x.minuten)}`));
  if (w.kontakte.length) zeilen.push('', '### Meistbesuchte Kontakte', ...w.kontakte.slice(0, 5).map(x => `- ${name.kontakt?.(x.id) ?? x.id}: ${x.termine} Termine, ${stundenAus(x.minuten)}`));
  return zeilen.join('\n');
}



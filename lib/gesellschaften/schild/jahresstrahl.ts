// ─── Unternehmen › Pflichten als Jahres-Zeitstrahl und Jahresplan (rein, client-sicher, 11.10.) ───────────────────────────────────────
// Kevin 11.10.: „Bild statt Liste“ — die Fristen eines Jahres auf EINER Linie: Monate, Fristen als Marken, verstrichen rot (nur wenn gesetzlich, siehe
// ./blick.ts `pflichtTon`), die nächsten 90 Tage hervorgehoben. Dieselbe Rechnung für eine Gesellschaft (Reiter „Pflichten & Fristen“) und für alle
// (Jahresplan). Der Zeichner (components/os/unternehmen/blick/Jahresstrahl.tsx) setzt nur die hier gerechneten Lagen (0–1) und Reihen.
// Export in den Kalender: die Fristen stehen ohnehin in der Fristen-Ebene des Kalenders (./ampel.ts `schildFristen`, eine Quelle); `fristenIcs` gibt sie
// zusätzlich als Kalenderdatei (.ics) zum Herunterladen — nichts verlässt das System ohne Klick. Hinweis, keine Rechtsberatung.

import { WEG } from '@/lib/wege';
import { SCHILD_HINWEIS } from './typen';
import type { Lage } from './ampel';
import { pflichtTon } from './blick';
import { monatsletzter, tagePlus, tageZwischen, tagText } from './zeit';

export type StrahlTon = 'rot' | 'gelb' | 'neutral' | 'erledigt';
export interface StrahlEintrag {
  id: string;
  tag: string;
  titel: string;
  /** Gesellschaft · Norm. */
  unter: string;
  ton: StrahlTon;
  href: string;
  gesellschaftId: string;
  gesellschaft: string;
  art: 'pflicht' | 'schutz';
}

/** Wie weit der Strahl reicht: 2 Monate zurück, 9 voraus (12 Monate) — und was „bald“ heißt. */
export const STRAHL = { vorMonate: 2, monate: 12, baldTage: 90, abstand: 0.022 } as const;

/** Die Einträge des Strahls aus der Lage (Pflichten + Fristen bei Marken, Domains, Versicherungen); `nur` = eine Gesellschaft. */
export function strahlEintraege(lage: Pick<Lage, 'heute' | 'gesellschaften'>, nur?: string): StrahlEintrag[] {
  const raus: StrahlEintrag[] = [];
  for (const g of lage.gesellschaften) {
    if (nur && g.id !== nur) continue;
    for (const p of g.pflichten) {
      if (p.status === 'nicht-zutreffend') continue;
      const ton: StrahlTon = p.status === 'erledigt' ? 'erledigt' : (pflichtTon(p) as 'rot' | 'gelb' | null) ?? 'neutral';
      raus.push({ id: `pf-${g.id}-${p.schluessel}`, tag: p.frist, titel: `${p.titel} (${p.periodeLabel})`, unter: `${g.name} · ${p.norm}`, ton, href: WEG.schild('pflichten', g.id), gesellschaftId: g.id, gesellschaft: g.name, art: 'pflicht' });
    }
    for (const x of g.schutz) {
      const ton: StrahlTon = x.tag < lage.heute ? 'neutral' : tagePlus(x.tag, -x.vorlauf) <= lage.heute ? 'gelb' : 'neutral';
      raus.push({ id: `ps-${g.id}-${x.id}`, tag: x.tag, titel: x.titel, unter: g.name, ton, href: WEG.schild('schutz', g.id), gesellschaftId: g.id, gesellschaft: g.name, art: 'schutz' });
    }
  }
  return raus.sort((a, b) => a.tag.localeCompare(b.tag) || a.titel.localeCompare(b.titel, 'de'));
}

export interface StrahlMonat { key: string; label: string; jahr: number; von: number; bis: number; jahresbeginn: boolean; heute: boolean }
export interface StrahlMarke extends StrahlEintrag { x: number; reihe: number }
export interface Strahl {
  von: string;
  bis: string;
  monate: StrahlMonat[];
  heuteX: number;
  /** Die nächsten 90 Tage (hervorgehoben). */
  bald: { von: number; bis: number };
  marken: StrahlMarke[];
  /** Verstrichen VOR dem Fenster — gezählt, nicht gezeichnet. */
  vorher: { anzahl: number; rot: number };
  /** Nach dem Fenster. */
  danach: number;
  reihen: number;
}

const MONAT_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monatErster = (tag: string, n: number) => {
  const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)) - 1 + n;
  const jj = j + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return `${jj}-${String(mm + 1).padStart(2, '0')}-01`;
};

/**
 * Lagen auf dem Strahl (rein): Fenster aus ganzen Monaten (zwei zurück, zehn voraus), x = Anteil der Tage (0–1), Marken, die sich zu nahe kommen,
 * in eine weitere Reihe. Verstrichenes vor dem Fenster zählt in `vorher`, Erledigtes davor fällt weg.
 */
export function jahresStrahl(eintraege: readonly StrahlEintrag[], heute: string): Strahl {
  const von = monatErster(heute, -STRAHL.vorMonate);
  const letzterMonat = monatErster(heute, STRAHL.monate - STRAHL.vorMonate - 1);
  const bis = monatsletzter(Number(letzterMonat.slice(0, 4)), Number(letzterMonat.slice(5, 7)));
  const tage = tageZwischen(von, bis) + 1;
  const x = (tag: string) => Math.max(0, Math.min(1, tageZwischen(von, tag) / tage));
  const monate: StrahlMonat[] = [];
  for (let i = 0; i < STRAHL.monate; i++) {
    const a = monatErster(von, i), e = monatsletzter(Number(a.slice(0, 4)), Number(a.slice(5, 7)));
    monate.push({ key: a.slice(0, 7), label: MONAT_KURZ[Number(a.slice(5, 7)) - 1], jahr: Number(a.slice(0, 4)), von: x(a), bis: (tageZwischen(von, e) + 1) / tage, jahresbeginn: a.slice(5, 7) === '01', heute: heute.slice(0, 7) === a.slice(0, 7) });
  }
  const im = eintraege.filter(e => e.tag >= von && e.tag <= bis);
  const vor = eintraege.filter(e => e.tag < von && e.ton !== 'erledigt' && e.ton !== 'neutral');
  const letzte: number[] = [];
  const marken: StrahlMarke[] = [];
  for (const e of [...im].sort((a, b) => a.tag.localeCompare(b.tag))) {
    const px = x(e.tag);
    let r = letzte.findIndex(l => px - l >= STRAHL.abstand);
    if (r < 0) { r = letzte.length; letzte.push(px); } else letzte[r] = px;
    marken.push({ ...e, x: px, reihe: r });
  }
  return {
    von, bis, monate, heuteX: x(heute), bald: { von: x(heute), bis: x(tagePlus(heute, STRAHL.baldTage)) }, marken,
    vorher: { anzahl: vor.length, rot: vor.filter(e => e.ton === 'rot').length }, danach: eintraege.filter(e => e.tag > bis).length, reihen: Math.max(1, letzte.length),
  };
}

export interface MonatsGruppe { key: string; titel: string; eintraege: StrahlEintrag[] }
/**
 * Dieselben Fristen als Liste je Monat (Handy, Bildschirmleser): zuerst „Verstrichen“ (alles Offene vor heute, egal wie alt), dann die Monate ab heute
 * bis zum Ende des Fensters; Erledigtes nur im laufenden und vergangenen Fenster-Monat ausgeblendet.
 */
export function jeMonat(eintraege: readonly StrahlEintrag[], heute: string, s: Pick<Strahl, 'bis'>): MonatsGruppe[] {
  const raus: MonatsGruppe[] = [];
  const verstrichen = eintraege.filter(e => e.tag < heute && e.ton !== 'erledigt' && e.ton !== 'neutral');
  if (verstrichen.length) raus.push({ key: 'verstrichen', titel: 'Verstrichen', eintraege: verstrichen });
  const kommend = eintraege.filter(e => e.tag >= heute && e.tag <= s.bis && e.ton !== 'erledigt');
  for (const e of kommend) {
    const k = e.tag.slice(0, 7);
    let gr = raus.find(x => x.key === k);
    if (!gr) { gr = { key: k, titel: `${MONAT_KURZ[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, eintraege: [] }; raus.push(gr); }
    gr.eintraege.push(e);
  }
  return raus;
}

// ── Kalenderdatei (.ics) ─────────────────────────────────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Zeilen über 75 Byte falten (RFC 5545 § 3.1) — nach UTF-8-Bytes, nie mitten in einem Zeichen. */
export function falten(zeile: string): string {
  const raus: string[] = [];
  let teil = '', bytes = 0;
  for (const z of Array.from(zeile)) {
    const b = new TextEncoder().encode(z).length;
    if (bytes + b > (raus.length ? 74 : 75)) { raus.push(teil); teil = ''; bytes = 0; }
    teil += z; bytes += b;
  }
  raus.push(teil);
  return raus.join('\r\n ');
}
const kurz = (t: string) => t.replace(/[^a-z0-9-]/gi, '').slice(0, 60);

/**
 * Die offenen Fristen als Kalenderdatei (rein): je Frist ein ganztägiger Termin mit Erinnerung, Titel „Frist: …“, Beschreibung mit Gesellschaft, Norm
 * und Hinweis; erledigte bleiben draußen. `jetzt` = Zeitstempel (ISO) für DTSTAMP — von außen, damit das Ergebnis prüfbar ist.
 */
export function fristenIcs(eintraege: readonly StrahlEintrag[], jetzt: string, name = 'Pflichten-Kalender'): string {
  const stempel = jetzt.replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
  const tag = (t: string) => t.replace(/-/g, '');
  const zeilen = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAKE OS//Unternehmen//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`];
  for (const e of eintraege) {
    if (e.ton === 'erledigt') continue;
    zeilen.push('BEGIN:VEVENT', `UID:${kurz(e.id)}-${tag(e.tag)}@make-os`, `DTSTAMP:${stempel}`, `DTSTART;VALUE=DATE:${tag(e.tag)}`, `DTEND;VALUE=DATE:${tag(tagePlus(e.tag, 1))}`,
      `SUMMARY:${esc(`Frist: ${e.titel}`)}`, `DESCRIPTION:${esc(`${e.unter} — fällig am ${tagText(e.tag)}. ${SCHILD_HINWEIS}`)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Frist: ${e.titel}`)}`, 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT');
  }
  zeilen.push('END:VCALENDAR');
  return zeilen.map(falten).join('\r\n') + '\r\n';
}

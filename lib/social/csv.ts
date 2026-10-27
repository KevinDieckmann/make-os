// ─── MAKE OS — Social: Kennzahlen aus Plattform-Exporten (CSV, rein) — 26.10.2026 ─────────────────────────────────────────────────────
// Bis die API-Prüfungen von TikTok, Meta und Google durch sind, kommen die Zahlen als Export aus TikTok Studio, Meta Business Suite bzw.
// YouTube Studio. Die Spaltennamen unterscheiden sich je Plattform, Sprache und Version — deshalb eine Liste von Synonymen (DE/EN) statt fester
// Formate. Ablauf wie überall: erst Vorschau (nichts geschrieben), dann übernehmen. Zuordnung zu Folgen über den Link, sonst über den Titel;
// was nicht eindeutig passt, bleibt in der Vorschau stehen und wird nicht geraten.

import { csvLesenMitBefund } from '@/lib/make-one/csv';
import { istKalendertag } from '@/lib/zeit';
import type { SocialFolge, SocialPlattform } from './typen';

type Feld = 'titel' | 'link' | 'am' | 'views' | 'likes' | 'kommentare' | 'shares' | 'saves' | 'follows' | 'halte3s' | 'durchsehen' | 'schnittSek';

/** Spaltennamen (klein, ohne Satzzeichen) → Feld. Erweiterbar, sobald ein Export anders heißt. */
const SYNONYME: Record<Feld, string[]> = {
  titel: ['titel', 'title', 'video title', 'videotitel', 'beschreibung', 'description', 'caption', 'inhalt'],
  link: ['link', 'url', 'permalink', 'video link', 'videolink', 'post link'],
  am: ['datum', 'date', 'post time', 'veröffentlicht', 'veroeffentlicht', 'publish time', 'video publish time', 'veröffentlichungszeit', 'posted', 'erstellt'],
  // YouTube zählt seit 31.03.2025 (Shorts) jeden Start als Aufruf — „Engaged views“ (die alte Zählung) geht vor, wenn der Export sie hat.
  views: ['engaged views', 'engagierte aufrufe', 'views', 'aufrufe', 'video views', 'total views', 'plays', 'wiedergaben', 'videoaufrufe', 'ansichten'],
  likes: ['likes', 'total likes', 'gefällt mir', 'gefaellt mir', 'reactions', 'reaktionen'],
  kommentare: ['comments', 'kommentare', 'total comments'],
  shares: ['shares', 'geteilt', 'teilungen', 'total shares', 'sends'],
  saves: ['saves', 'gespeichert', 'total saves', 'favorites', 'favoriten'],
  follows: ['follows', 'new followers', 'neue follower', 'follower gewonnen', 'subscribers', 'abonnenten', 'subscribers gained', 'abonnenten gewonnen'],
  halte3s: ['3s retention', 'hook rate', '3 sekunden', 'halterate 3s', 'retention 3s', 'stayed to watch'],
  durchsehen: ['completion rate', 'watched full video', 'full video watch rate', 'durchsehquote', 'vollständig angesehen', 'average percentage viewed', 'durchschnittlich angesehen in prozent'],
  schnittSek: ['average watch time', 'durchschnittliche wiedergabedauer', 'avg watch time', 'average view duration', 'durchschnittliche anzeigedauer'],
};

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase('de-DE').replace(/[()[\]%:#]/g, ' ').replace(/\s+/g, ' ').trim();

function spalteFuer(kopf: string[], feld: Feld): string | null {
  const syn = SYNONYME[feld];
  // Reihenfolge der Synonyme entscheidet (z. B. „Engaged views“ vor „Views“), erst genaue Treffer, dann Anfänge.
  for (const s of syn) { const k = kopf.find(x => norm(x) === s); if (k) return k; }
  for (const s of syn) { const k = kopf.find(x => norm(x).startsWith(s)); if (k) return k; }
  return null;
}

/** „1.234“, „1,234“, „1.2K“, „3,4 Mio.“, „45 %“ → Zahl. */
export function zahlAus(v: string | undefined): number | undefined {
  if (!v) return undefined;
  let s = v.trim().toLocaleLowerCase('de-DE').replace(/\s|%/g, '');
  if (!s || s === '-' || s === '–') return undefined;
  let faktor = 1;
  const m = s.match(/(k|tsd\.?|mio\.?|m|mrd\.?|b)$/);
  if (m) { faktor = /^k|^tsd/.test(m[1]) ? 1e3 : /^mio|^m$/.test(m[1]) ? 1e6 : 1e9; s = s.slice(0, -m[1].length); }
  // Tausendertrenner: „1.234.567“ bzw. „1,234,567“ — ein einzelnes Trennzeichen mit genau 3 Ziffern danach ist ein Tausender, sonst Dezimal.
  if (/^\d{1,3}([.,]\d{3})+$/.test(s) && faktor === 1) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * faktor * 100) / 100 : undefined;
}

/** „2026-10-27“, „27.10.2026“, „Oct 27, 2026“, ISO-Zeitstempel → JJJJ-MM-TT; sonst undefined. */
export function tagAus(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso && istKalendertag(`${iso[1]}-${iso[2]}-${iso[3]}`)) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) { const t = `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`; if (istKalendertag(t)) return t; }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && /[a-z]/i.test(s)) {
    const t = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    if (istKalendertag(t)) return t;
  }
  return undefined;
}

export interface ImportZeile {
  zeile: number;
  titel: string;
  link?: string;
  folgeId: string | null;
  /** Warum keine Folge passt (oder mehrere). */
  hinweis?: string;
  messung: { plattform: SocialPlattform; am: string; views: number; likes?: number; kommentare?: number; shares?: number; saves?: number; follows?: number; halte3s?: number; durchsehen?: number; schnittSek?: number; quelle: 'import' };
}

export interface ImportVorschau {
  spalten: Partial<Record<Feld, string>>;
  zeilen: ImportZeile[];
  fehler: string[];
}

const titelNorm = (s: string) => norm(s).replace(/[^\p{L}\p{N} ]/gu, '').trim();

/**
 * Datei lesen und den Folgen eines Kanals zuordnen. `heute` gilt, wenn die Datei keinen Tag trägt (die Zahlen sind „Stand heute“).
 * Trenner wird erkannt (Semikolon, Komma, Tab). Ohne Spalte für Aufrufe: Fehler, keine Zeilen.
 */
export function importVorschau(text: string, plattform: SocialPlattform, folgen: SocialFolge[], heute: string): ImportVorschau {
  const ersteZeile = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? '';
  const trenner = [';', '\t', ','].map(t => ({ t, n: ersteZeile.split(t).length })).sort((a, b) => b.n - a.n)[0].t;
  const { kopf, zeilen, zeileNr } = csvLesenMitBefund(text, trenner);
  const spalten: Partial<Record<Feld, string>> = {};
  for (const f of Object.keys(SYNONYME) as Feld[]) { const s = spalteFuer(kopf, f); if (s) spalten[f] = s; }
  if (!spalten.views) return { spalten, zeilen: [], fehler: ['Keine Spalte für Aufrufe gefunden (z. B. „Views“, „Aufrufe“, „Plays“).'] };
  const jeLink = new Map(folgen.flatMap(f => f.veroeffentlicht.filter(v => v.link).map(v => [v.link!.replace(/\/$/, ''), f.id] as const)));
  const jeTitel = new Map<string, string[]>();
  for (const f of folgen) { const t = titelNorm(f.titel); if (t) jeTitel.set(t, [...(jeTitel.get(t) ?? []), f.id]); }
  const fehler: string[] = [];
  const aus: ImportZeile[] = [];
  zeilen.forEach((z, i) => {
    const views = zahlAus(z[spalten.views!]);
    if (views === undefined) { fehler.push(`Zeile ${zeileNr[i]}: keine Zahl bei den Aufrufen — übersprungen.`); return; }
    const titel = (spalten.titel ? z[spalten.titel] : '')?.trim() ?? '';
    const link = spalten.link ? (z[spalten.link] ?? '').trim() : '';
    const am = (spalten.am ? tagAus(z[spalten.am]) : undefined) ?? heute;
    let folgeId: string | null = null, hinweis: string | undefined;
    if (link && jeLink.has(link.replace(/\/$/, ''))) folgeId = jeLink.get(link.replace(/\/$/, ''))!;
    else {
      const treffer = jeTitel.get(titelNorm(titel)) ?? [];
      if (treffer.length === 1) folgeId = treffer[0];
      else hinweis = treffer.length > 1 ? 'Mehrere Folgen heißen so — von Hand zuordnen.' : 'Keine Folge mit diesem Link oder Titel.';
    }
    const n = (f: Feld) => (spalten[f] ? zahlAus(z[spalten[f]!]) : undefined);
    const pz = (f: Feld) => { const v = n(f); return v !== undefined && v <= 1 && v > 0 && !String(z[spalten[f]!] ?? '').includes('%') ? Math.round(v * 1000) / 10 : v; };
    aus.push({
      zeile: zeileNr[i], titel: titel.slice(0, 200), link: /^https:\/\//.test(link) ? link : undefined, folgeId, hinweis,
      messung: Object.fromEntries(Object.entries({
        plattform, am, views: Math.round(views), likes: n('likes'), kommentare: n('kommentare'), shares: n('shares'), saves: n('saves'), follows: n('follows'),
        halte3s: pz('halte3s'), durchsehen: pz('durchsehen'), schnittSek: n('schnittSek'), quelle: 'import' as const,
      }).filter(([, v]) => v !== undefined)) as ImportZeile['messung'],
    });
  });
  return { spalten, zeilen: aus, fehler };
}

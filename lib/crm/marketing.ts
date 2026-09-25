// ─── CRM — Marketing: Kennzahlen, Redaktionsplan, Newsletter, Export (rein, getestet)
// Der Head of Marketing laut docs/konzepte/crm-sales-marketing-events.md:
// Wirkung wird an Gesprächen und Chancen gemessen, nicht an Likes und nicht
// an Öffnungsraten (technisch unzuverlässig). Jede Zahl ist „grau“, solange
// es nichts zu messen gibt — nie eine erfundene Null.
//
// Die Rechtsregeln sind hart (R1, R6, R7, R9 im Konzept):
//   · Newsletter nur an Personen mit Double-Opt-in (Kanal-Ampel „newsletter“ grün)
//   · Mail-Adressen im Segment-Export nur, wo Werbung per Mail zulässig ist
//   · Personen mit Werbesperre stehen in keiner Liste und keinem Export
//   · Privatnotizen verlassen die Kartei nie
// MAKE OS versendet und veröffentlicht nichts — Export und Zahlen von Hand.

import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, Freigabe, MarketingEinstellung, NewsletterAusgabe, Segment, SegmentKriterien } from './typen';
import type { Kpi, KpiAmpel } from './kennzahlen';
import { art14, kanalStatus, type Kanal, type Kontext } from './recht';
import { segmentAuswerten, type SegmentKontext } from './segmente';
import { TEAM, BEIDE, zustaendig, istMeins, mitglied, nameVon } from './team';

// ── Kleine Helfer ───────────────────────────────────────────────────────────
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tag = (v?: string) => (v ?? '').slice(0, 10);
const stufe = (v: number, gruen: number, gelb: number): KpiAmpel => (v >= gruen ? 'gruen' : v >= gelb ? 'gelb' : 'rot');
/** Prozent ohne überflüssige Nullen: 0,5 · 0,35 · 1. */
export const prozent = (q: number) => `${String(Number((q * 100).toFixed(2))).replace('.', ',')} %`;
const kurz = (t: string, n: number) => t.replace(/\s+/g, ' ').trim().slice(0, n);

// ── Wertelisten ─────────────────────────────────────────────────────────────
export const BEITRAG_STATUS: { id: Beitrag['status']; label: string }[] = [
  { id: 'idee', label: 'Idee' }, { id: 'entwurf', label: 'Entwurf' }, { id: 'geplant', label: 'Geplant' }, { id: 'veroeffentlicht', label: 'Veröffentlicht' },
];
export const BEITRAG_KANAELE: { id: Beitrag['kanal']; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'blog', label: 'Blog' },
  { id: 'podcast', label: 'Podcast' }, { id: 'vortrag', label: 'Vortrag' }, { id: 'sonstig', label: 'Sonstiges' },
];
export const WIRKUNG_ARTEN: { id: Beitrag['wirkung'][number]['art']; label: string }[] = [
  { id: 'reaktion', label: 'Reaktion' }, { id: 'gespraech', label: 'Gespräch' }, { id: 'anfrage', label: 'Anfrage' },
];
export const AUSGABE_STATUS: { id: NewsletterAusgabe['status']; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'bereit', label: 'Bereit' }, { id: 'versendet', label: 'Versendet' },
];
/** Chancen-Quellen, die Marketing zugerechnet werden. Events zählt der Head of Event. */
export const MARKETING_QUELLEN: readonly NonNullable<Chance['quelle']>[] = ['content', 'inbound'];

// ── Einstellung (Positionierung, ICP, Ton, Säulen) ─────────────────────────
export const EINSTELLUNG_GRENZEN = { positionierung: 3000, icp: 3000, ton: 300, saeulen: 8, name: 60, beschreibung: 400 } as const;
export const leereEinstellung = (): MarketingEinstellung => ({ positionierung: '', icp: '', ton: '', saeulen: [] });
export const einstellungAus = (crm: Pick<CrmBestand, 'marketing'>): MarketingEinstellung => ({ ...leereEinstellung(), ...(crm.marketing ?? {}) });

const slug = (t: string) => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
/** Für Dateinamen: nur ASCII, nie leer. */
export const dateiTeil = (t: string) => slug(t).slice(0, 40) || 'segment';

/** Was vom Netz kommt, wird hart begrenzt — Länge, Anzahl, Form der IDs. */
export function saeubereEinstellung(roh: unknown): MarketingEinstellung {
  const o = roh && typeof roh === 'object' ? (roh as Record<string, unknown>) : {};
  const G = EINSTELLUNG_GRENZEN;
  const t = (v: unknown, n: number) => (typeof v === 'string' ? v : '').replace(/\u0000/g, '').trim().slice(0, n);
  const gesehen = new Set<string>();
  const saeulen: MarketingEinstellung['saeulen'] = [];
  const eingang = (Array.isArray(o.saeulen) ? o.saeulen : []).slice(0, 50) as unknown[];
  for (let i = 0; i < eingang.length && saeulen.length < G.saeulen; i++) {
    const x = eingang[i] && typeof eingang[i] === 'object' ? (eingang[i] as Record<string, unknown>) : {};
    const name = t(x.name, G.name).replace(/\s+/g, ' ');
    if (!name) continue;
    let id = /^[a-z0-9][a-z0-9-]{0,39}$/.test(String(x.id ?? '')) ? String(x.id) : slug(name) || `s${i + 1}`;
    while (gesehen.has(id)) id = `${id.slice(0, 36)}-${i + 1}`;
    gesehen.add(id);
    saeulen.push({ id, name, beschreibung: t(x.beschreibung, G.beschreibung) });
  }
  return { positionierung: t(o.positionierung, G.positionierung), icp: t(o.icp, G.icp), ton: t(o.ton, G.ton), saeulen };
}

// ── Redaktionsplan ─────────────────────────────────────────────────────────
export type PlanSicht = 'woche' | 'monat' | 'alle';
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Kalenderwoche nach ISO 8601 (Donnerstag entscheidet). */
export function kalenderwoche(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 864e5));
}

export interface PlanFenster { von: string; bis: string; label: string }
/** Woche (Mo–So) oder Kalendermonat um heute, verschoben um `versatz`; „alle“ hat kein Fenster. */
export function planFenster(heute: string, sicht: PlanSicht, versatz = 0): PlanFenster | null {
  if (sicht === 'alle') return null;
  if (sicht === 'woche') {
    const d = new Date(`${heute}T12:00:00Z`);
    const von = tagPlus(heute, -((d.getUTCDay() + 6) % 7) + 7 * versatz);
    const bis = tagPlus(von, 6);
    return { von, bis, label: `KW ${kalenderwoche(von)} · ${Number(von.slice(8))}.${Number(von.slice(5, 7))}.–${Number(bis.slice(8))}.${Number(bis.slice(5, 7))}.` };
  }
  const [j, m] = heute.split('-').map(Number);
  const erster = new Date(Date.UTC(j, m - 1 + versatz, 1, 12));
  const letzter = new Date(Date.UTC(erster.getUTCFullYear(), erster.getUTCMonth() + 1, 0, 12));
  return { von: erster.toISOString().slice(0, 10), bis: letzter.toISOString().slice(0, 10), label: `${MONATE[erster.getUTCMonth()]} ${erster.getUTCFullYear()}` };
}
/** Beiträge ohne Datum (meist Ideen) stehen in jedem Fenster — sie sind der Vorrat. */
export const imFenster = (b: Pick<Beitrag, 'datum'>, f: PlanFenster | null) => !f || !b.datum || (b.datum >= f.von && b.datum <= f.bis);

export function nachStatus(beitraege: Beitrag[]): Record<Beitrag['status'], Beitrag[]> {
  const r: Record<Beitrag['status'], Beitrag[]> = { idee: [], entwurf: [], geplant: [], veroeffentlicht: [] };
  for (const b of beitraege) (r[b.status] ?? r.idee).push(b);
  for (const s of Object.keys(r) as Beitrag['status'][]) {
    r[s].sort((a, b) => (s === 'veroeffentlicht' ? (b.datum ?? '').localeCompare(a.datum ?? '') : (a.datum ?? '9999').localeCompare(b.datum ?? '9999')) || b.geaendert.localeCompare(a.geaendert));
  }
  return r;
}

/** Wirkung je Beitrag — jede Person je Art nur einmal. */
export function wirkungZahlen(b: Pick<Beitrag, 'wirkung'>): { reaktionen: number; gespraeche: number; anfragen: number } {
  const je = (art: string) => new Set((b.wirkung ?? []).filter(w => w.art === art).map(w => w.kontaktId)).size;
  return { reaktionen: je('reaktion'), gespraeche: je('gespraech'), anfragen: je('anfrage') };
}

/**
 * Durch Content ausgelöste Gespräche im Zeitraum: Wirkung „Gespräch“ oder
 * „Anfrage“ an einem Beitrag. Dieselbe Person am selben Beitrag zählt einmal —
 * wer zuerst anfragt und dann ein Gespräch führt, ist EIN ausgelöstes Gespräch.
 */
export function contentGespraeche(beitraege: Beitrag[], von: string, bis: string): number {
  const s = new Set<string>();
  for (const b of beitraege) for (const w of b.wirkung ?? []) if ((w.art === 'gespraech' || w.art === 'anfrage') && w.am >= von && w.am <= bis) s.add(`${b.id}|${w.kontaktId}`);
  return s.size;
}

/**
 * Stammt eine Chance aus dem Marketing? Ja, wenn die Quelle Content oder
 * Anfrage ist — oder wenn eine ihrer Personen in den 90 Tagen vor Anlage über
 * einen Beitrag ins Gespräch kam (Attribution per Kontakt, nicht per Klick).
 */
export function ausMarketing(c: Pick<Chance, 'quelle' | 'kontaktIds' | 'angelegt'>, beitraege: Beitrag[]): boolean {
  if (c.quelle && MARKETING_QUELLEN.includes(c.quelle)) return true;
  const bis = tag(c.angelegt), von = tagPlus(bis, -90);
  const ids = new Set(c.kontaktIds);
  return beitraege.some(b => (b.wirkung ?? []).some(w => ids.has(w.kontaktId) && (w.art === 'gespraech' || w.art === 'anfrage') && w.am >= von && w.am <= bis));
}

// ── Stimme der Kunden ──────────────────────────────────────────────────────
export interface Stimme { kontaktId: string; name: string; am: string; bedarf: string }
/** „Bedarf / Schmerz“ aus den Gesprächsnotizen, jüngste zuerst — ohne gesperrte Personen. */
export function stimmenAus(kontakte: Kontakt[], max = 30): Stimme[] {
  return kontakte.filter(k => !k.werbesperre)
    .flatMap(k => (k.aktivitaeten ?? []).filter(a => (a.notiz?.bedarf ?? '').trim()).map(a => ({ kontaktId: k.id, name: anzeigename(k), am: tag(a.am), bedarf: a.notiz!.bedarf!.trim() })))
    .sort((a, b) => b.am.localeCompare(a.am)).slice(0, max);
}
export const ideeTitel = (bedarf: string) => kurz(bedarf, 120);
/** Aus einer Stimme wird eine Beitragsidee. Der Kundenname steht NICHT im Text (Referenz nur mit Freigabe) — nur als Quelle. */
export function ideeAusStimme(s: Stimme, id: string, jetzt: string): Beitrag {
  return { id, titel: ideeTitel(s.bedarf), kanal: 'linkedin', status: 'idee', text: `Aus einem Kundengespräch (${s.am}): „${kurz(s.bedarf, 1500)}“`, wirkung: [], quellen: [s.kontaktId], geaendert: jetzt };
}
export const schonUebernommen = (s: Stimme, beitraege: Beitrag[]) => beitraege.some(b => b.quellen.includes(s.kontaktId) && b.titel === ideeTitel(s.bedarf));

// ── Newsletter ─────────────────────────────────────────────────────────────
/** Nur Double-Opt-in. Eine Mail-Einwilligung oder ein Mandat reicht für den Newsletter NICHT. */
export function newsletterEmpfaenger(kontakte: Kontakt[]): Kontakt[] {
  return kontakte.filter(k => !k.werbesperre && kanalStatus(k, 'newsletter').farbe === 'gruen');
}
/** Abmeldungen je Empfänger — nur für versendete Ausgaben mit beiden Zahlen. */
export function abmeldequote(a: Pick<NewsletterAusgabe, 'status' | 'empfaenger' | 'abmeldungen'>): number | null {
  if (a.status !== 'versendet' || !a.empfaenger || a.abmeldungen === undefined || a.abmeldungen === null) return null;
  return a.abmeldungen / a.empfaenger;
}
/** < 0,5 % grün · 0,5–1 % gelb · > 1 % rot. */
export const quotenAmpel = (q: number): KpiAmpel => (q < 0.005 ? 'gruen' : q <= 0.01 ? 'gelb' : 'rot');

// ── Kennzahlen ─────────────────────────────────────────────────────────────
export function marketingKennzahlen(kontakte: Kontakt[], crm: CrmBestand, heute: string): Kpi[] {
  const beitraege = crm.beitraege ?? [];
  const ausgaben = crm.newsletter ?? [];
  const vor7 = tagPlus(heute, -6), vor28 = tagPlus(heute, -27), vor30 = tagPlus(heute, -29), vor90 = tagPlus(heute, -89);
  const veroeffentlicht = beitraege.filter(b => b.status === 'veroeffentlicht' && b.datum);
  const v7 = veroeffentlicht.filter(b => b.datum! >= vor7 && b.datum! <= heute).length;
  const v28 = veroeffentlicht.filter(b => b.datum! >= vor28 && b.datum! <= heute).length;

  const hatWirkung = beitraege.some(b => (b.wirkung ?? []).length > 0);
  const gespraeche = contentGespraeche(beitraege, vor30, heute);
  const gespraecheMessbar = veroeffentlicht.length > 0 || hatWirkung;

  const neu = (crm.chancen ?? []).filter(c => tag(c.angelegt) >= vor90 && tag(c.angelegt) <= heute);
  const ausMk = neu.filter(c => ausMarketing(c, beitraege)).length;
  const anteil = neu.length ? ausMk / neu.length : null;

  const letzte = ausgaben.filter(a => abmeldequote(a) !== null).sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '') || b.geaendert.localeCompare(a.geaendert))[0];
  const quote = letzte ? abmeldequote(letzte)! : null;

  const faellig = kontakte.filter(k => art14(k, heute)?.faellig).length;
  const laufend = kontakte.filter(k => { const a = art14(k, heute); return a && !a.faellig; }).length;

  // Netto-Wachstum des Newsletters: neue Double-Opt-ins minus Widerrufe und Sperren in 30 Tagen.
  const nl = kontakte.flatMap(k => (k.einwilligungen ?? []).filter(e => e.kanal === 'newsletter').map(e => ({ e, k })));
  const zugang = nl.filter(({ e, k }) => !k.werbesperre && !e.widerrufenAm && e.erteiltAm >= vor30 && e.erteiltAm <= heute).length;
  const abgang = nl.filter(({ e, k }) => (e.widerrufenAm && e.widerrufenAm >= vor30 && e.widerrufenAm <= heute) || (!e.widerrufenAm && k.werbesperre && k.werbesperre.seit >= vor30 && k.werbesperre.seit <= heute)).length;
  const netto = zugang - abgang;
  const doi = newsletterEmpfaenger(kontakte).length;

  return [
    { id: 'veroeffentlichungen', label: 'Veröffentlichungen · 7 Tage', wert: beitraege.length ? v7 : null, anzeige: beitraege.length ? String(v7) : '—', ampel: beitraege.length ? stufe(v7, 2, 1) : 'grau', ziel: '≥ 2 je Woche', quelle: beitraege.length ? `${v28} in 4 Wochen · Redaktionsplan` : 'noch kein Beitrag im Redaktionsplan' },
    { id: 'content_gespraeche', label: 'Gespräche aus Content · 30 Tage', wert: gespraecheMessbar ? gespraeche : null, anzeige: gespraecheMessbar ? String(gespraeche) : '—', ampel: gespraecheMessbar ? stufe(gespraeche, 2, 1) : 'grau', ziel: '≥ 2 je Monat', quelle: 'Wirkung „Gespräch“ oder „Anfrage“ an Beiträgen, je Person und Beitrag einmal' },
    { id: 'marketing_anteil', label: 'Neue Deals aus Marketing · 90 Tage', wert: anteil, anzeige: anteil === null ? '—' : `${Math.round(anteil * 100)} %`, ampel: anteil === null ? 'grau' : stufe(anteil, 0.25, 0.1), ziel: '≥ 25 %', quelle: neu.length ? `${ausMk} von ${neu.length} neuen Deals · Quelle Content/Anfrage oder Gespräch aus einem Beitrag` : 'kein neuer Deal in 90 Tagen' },
    { id: 'abmeldequote', label: 'Abmeldequote letzte Ausgabe', wert: quote, anzeige: quote === null ? '—' : prozent(quote), ampel: quote === null ? 'grau' : quotenAmpel(quote), ziel: '< 0,5 %', quelle: letzte ? `„${kurz(letzte.titel, 60)}“: ${letzte.abmeldungen} von ${letzte.empfaenger}` : 'noch keine versendete Ausgabe mit Zahlen' },
    { id: 'newsletter_netto', label: 'Newsletter netto · 30 Tage', wert: nl.length ? netto : null, anzeige: nl.length ? (netto > 0 ? `+${netto}` : String(netto)) : '—', ampel: nl.length ? (netto > 0 ? 'gruen' : netto === 0 ? 'gelb' : 'rot') : 'grau', ziel: '> 0 je Monat', quelle: nl.length ? `${doi} mit Double-Opt-in · ${zugang} neu, ${abgang} weg` : 'noch keine Newsletter-Einwilligung' },
    { id: 'art14', label: 'Art. 14 überfällig', wert: kontakte.length ? faellig : null, anzeige: kontakte.length ? String(faellig) : '—', ampel: kontakte.length ? (faellig ? 'rot' : 'gruen') : 'grau', ziel: '0', quelle: `${laufend} Fristen laufen noch` },
  ];
}

// ── Segmente ───────────────────────────────────────────────────────────────
/** Drei Startsegmente — angelegt wird nur auf Klick („Vorlage übernehmen“). */
export const SEGMENT_VORLAGEN: { name: string; beschreibung: string; kriterien: SegmentKriterien }[] = [
  { name: 'Kunden & Multiplikatoren', beschreibung: 'Wer uns kennt und weiterempfehlen kann — für Einladungen, Fallstudien und Empfehlungen.', kriterien: { lebensphase: ['kunde', 'multiplikator'] } },
  { name: 'Zielkunden Prio A', beschreibung: 'Noch keine Kunden, höchste Priorität — für Beiträge und persönliche Ansprache.', kriterien: { prio: ['A'], lebensphase: ['kontakt', 'interessent'] } },
  { name: 'Kreis A/B ohne Kontakt seit 60 Tagen', beschreibung: 'Enge Beziehungen, die gerade einschlafen.', kriterien: { kreis: ['A', 'B'], ohneKontaktSeitTagen: 60 } },
];
/**
 * Kriterien in fester Form: Texte getrimmt, Listen sortiert und ohne Doppelte,
 * Leeres entfernt, Schlüssel in fester Reihenfolge. So wird gespeichert und so
 * wird verglichen („ist der Entwurf gespeichert?“) — egal in welcher Reihenfolge
 * geklickt wurde.
 */
export function kriterienSauber(kr: SegmentKriterien): SegmentKriterien {
  const r: SegmentKriterien = {};
  for (const f of ['lebensphase', 'kreis', 'prio', 'firmaRolle', 'herkunft'] as const) {
    const l = Array.from(new Set((kr[f] ?? []).map(x => String(x).trim()).filter(Boolean))).sort().slice(0, 12);
    if (l.length) r[f] = l;
  }
  for (const f of ['branche', 'stadt', 'stichwort'] as const) { const t = (kr[f] ?? '').trim().slice(0, 80); if (t) r[f] = t; }
  if (kr.kanal) r.kanal = kr.kanal;
  if (typeof kr.mitChance === 'boolean') r.mitChance = kr.mitChance;
  const n = Math.round(Number(kr.ohneKontaktSeitTagen ?? 0));
  if (n > 0) r.ohneKontaktSeitTagen = Math.min(n, 3650);
  return r;
}
export const kriterienGleich = (a: SegmentKriterien, b: SegmentKriterien) => JSON.stringify(kriterienSauber(a)) === JSON.stringify(kriterienSauber(b));

export const vorlageAlsSegment = (v: (typeof SEGMENT_VORLAGEN)[number], id: string, jetzt: string): Segment => ({ id, name: v.name, beschreibung: v.beschreibung, kriterien: kriterienSauber(v.kriterien), geaendert: jetzt });

const PHASE_TEXT: Record<string, string> = { kontakt: 'Kontakt', interessent: 'Interessent', kunde: 'Kunde', ex_kunde: 'Ex-Kunde', partner: 'Partner', multiplikator: 'Multiplikator' };
const KANAL_TEXT: Record<string, string> = { mail: 'Mail', telefon: 'Telefon', linkedin: 'LinkedIn', newsletter: 'Newsletter', einladung: 'Einladung' };
/** Kriterien in einer Zeile — „Kreis A, B · ohne Kontakt seit 60 Tagen“. */
export function kriterienText(kr: SegmentKriterien): string {
  const t: string[] = [];
  if (kr.lebensphase?.length) t.push(kr.lebensphase.map(p => PHASE_TEXT[p] ?? p).join(', '));
  if (kr.kreis?.length) t.push(`Kreis ${kr.kreis.join(', ')}`);
  if (kr.prio?.length) t.push(`Prio ${kr.prio.join(', ')}`);
  if (kr.firmaRolle?.length) t.push(`Firma: ${kr.firmaRolle.join(', ')}`);
  if (kr.herkunft?.length) t.push(`Herkunft: ${kr.herkunft.join(', ')}`);
  if (kr.branche) t.push(`Branche „${kr.branche}“`);
  if (kr.stadt) t.push(`Ort „${kr.stadt}“`);
  if (kr.stichwort) t.push(`Stichwort „${kr.stichwort}“`);
  if (kr.kanal) t.push(`${KANAL_TEXT[kr.kanal] ?? kr.kanal} zulässig`);
  if (kr.mitChance !== undefined) t.push(kr.mitChance ? 'mit offener Chance' : 'ohne offene Chance');
  if (kr.ohneKontaktSeitTagen) t.push(`ohne Kontakt seit ${kr.ohneKontaktSeitTagen} Tagen`);
  return t.join(' · ') || 'alle Personen ohne Werbesperre';
}

// ── CSV ────────────────────────────────────────────────────────────────────
/** Eine Zelle: Semikolon-sicher und ohne Formel-Einschleusung (=, @, +/- vor Nicht-Ziffer). */
export function csvZelle(v?: string | number | null): string {
  let t = String(v ?? '').replace(/\r?\n/g, ' ');
  if (/^[=@\t\r]/.test(t) || /^[+-][^\d\s]/.test(t)) t = `'${t}`;
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
/** UTF-8 mit BOM, damit Excel die Umlaute richtig liest. */
export const csvText = (kopf: string[], zeilen: (string | number | null | undefined)[][]) => '﻿' + [kopf.join(';'), ...zeilen.map(z => z.map(csvZelle).join(';'))].join('\n');

const FARB_TEXT = { gruen: 'grün', gelb: 'gelb', rot: 'rot' } as const;
/** Kanal-Ampel als Text: „Mail grün, Telefon gelb“ — Kanäle ohne Adresse fehlen. */
export function kanalText(k: Kontakt, ctx: Kontext = {}): string {
  return (['mail', 'telefon', 'linkedin', 'newsletter'] as Kanal[]).map(kanal => { const s = kanalStatus(k, kanal, ctx); return s.grund === 'keine Adresse' ? null : `${KANAL_TEXT[kanal]} ${FARB_TEXT[s.farbe]}`; }).filter(Boolean).join(', ') || 'keine Adresse';
}

/** Segment-Export: nur Mitglieder (nie Gesperrte), Mail-Adresse nur bei grüner Mail-Ampel, keine Privatnotiz. */
export function segmentCsv(kontakte: Kontakt[], kriterien: SegmentKriterien, ctx: SegmentKontext): string {
  const a = segmentAuswerten(kontakte, kriterien, ctx);
  const zeilen = a.mitglieder.filter(k => !k.werbesperre).map(k => {
    const c: Kontext = { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) };
    const f = k.firmaId ? ctx.firmen.get(k.firmaId) : undefined;
    return [anzeigename(k), f?.name ?? k.firma, kanalStatus(k, 'mail', c).farbe === 'gruen' ? k.email : '', k.telefon ?? k.sms, k.kreis, PHASE_TEXT[k.lebensphase ?? 'kontakt'], kanalText(k, c)];
  });
  return csvText(['name', 'firma', 'email', 'telefon', 'kreis', 'phase', 'kanal_status'], zeilen);
}

/** Newsletter-Empfänger: ausschließlich Double-Opt-in, nur Name und Adresse. */
export function newsletterCsv(kontakte: Kontakt[]): string {
  return csvText(['name', 'email'], newsletterEmpfaenger(kontakte).map(k => [anzeigename(k), k.email]));
}

// ── Zu zweit: Autor, Stimme, Freigabe (25.09.) ─────────────────────────────
// Kevin: Marketing verantwortet Malin, beide sehen alles und arbeiten überall mit.
//   Autor    `zustaendig` am Beitrag — wer schreibt. Ohne Eintrag die/der
//            Verantwortliche für Marketing (Malin, lib/crm/team.ts).
//   Stimme   `stimme` — in wessen Namen es erscheint: kevin, malin oder „marke“.
//   Freigabe Erscheint ein Beitrag im Namen einer Person, die ihn nicht selbst
//            schreibt, braucht er vor „geplant“/„veröffentlicht“ ihr Okay. Wer
//            schreibt, bittet darum (offen, an = Stimme); die Stimme gibt frei
//            (ok) oder wünscht eine Änderung (aenderung, mit Notiz). Plant die
//            Stimme selbst, ist das ihr Okay. Das Okay gilt dem Text: Ändert
//            danach jemand anderes Titel oder Text, liegt es wieder offen bei ihr.
//   Newsletter  Freigabe freiwillig, Ziel wählbar (Kevin/Malin). Ist sie
//            angefragt, gilt dieselbe Sperre vor „bereit“/„versendet“.
// Alles hier liefert Einzeländerungen (Felder für api.teil) — `null` löscht ein Feld.

export const MARKE = 'marke';
/** Wählbare Stimmen: jede Person im Team und die Marke. */
export const STIMMEN_WAHL: { id: string; label: string }[] = [...TEAM.map(t => ({ id: t.id, label: t.name })), { id: MARKE, label: 'Marke' }];
/** Felder einer Einzeländerung — `null` löscht ein Feld (der Server-Säuberer lässt es weg). */
export type Teil<T> = { [K in keyof T]?: T[K] | null };
export type FreigabeStand = 'nicht_noetig' | 'fehlt' | 'offen' | 'aenderung' | 'ok';
type ZuZweit = { zustaendig?: string | null; stimme?: string | null; freigabe?: Freigabe | null };
type MitFreigabe = { zustaendig?: string | null; freigabe?: Freigabe | null };

const NACH_AENDERUNG = 'Nach der Freigabe geändert — bitte noch einmal ansehen.';
const kurzTag = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
/** „Kevins“, „Malins“ — bei Namen auf s/x/z/ß nur ein Apostroph. */
export const genitiv = (name: string) => (/[sxzß]$/i.test(name) ? `${name}’` : `${name}s`);

/** Person hinter der Stimme — null bei „Marke“ oder ohne Eintrag. */
export function stimmPerson(b: { stimme?: string | null }): string | null {
  const s = b.stimme ?? '';
  return TEAM.some(t => t.id === s) ? s : null;
}
export const stimmeText = (s?: string | null) => (s === MARKE ? 'Marke' : mitglied(s)?.name ?? 'offen');
/** Wer schreibt — die Eintragung, sonst die/der Verantwortliche für Marketing. */
export const autorVon = (x: { zustaendig?: string | null }) => zustaendig(x.zustaendig ?? undefined, 'marketing');

/** Braucht der Beitrag ein Okay? Ja, wenn er im Namen einer Person erscheint, die ihn nicht (mit)schreibt. */
export function freigabeNoetig(b: { zustaendig?: string | null; stimme?: string | null }): boolean {
  const p = stimmPerson(b);
  if (!p) return false;
  const a = autorVon(b);
  return a !== p && a !== BEIDE;
}

/** Stand der Freigabe eines Beitrags. Eine Freigabe an jemand anderen als die jetzige Stimme zählt nicht. */
export function freigabeStand(b: ZuZweit): FreigabeStand {
  if (!freigabeNoetig(b)) return 'nicht_noetig';
  const f = b.freigabe;
  return f && f.an === stimmPerson(b) ? f.status : 'fehlt';
}
/** Newsletter: ohne Anfrage keine Freigabe nötig. */
export const ausgabeFreigabeStand = (a: { freigabe?: Freigabe | null }): FreigabeStand => (a.freigabe ? a.freigabe.status : 'nicht_noetig');

function sperreText(stand: FreigabeStand, an: string): string | null {
  const n = nameVon(an);
  if (stand === 'offen') return `Wartet auf ${genitiv(n)} Freigabe.`;
  if (stand === 'aenderung') return `${n} wünscht eine Änderung — einarbeiten und erneut zur Freigabe schicken.`;
  if (stand === 'fehlt') return `Erscheint in ${genitiv(n)} Namen — vor dem Planen zur Freigabe an ${n}.`;
  return null;
}

/** Warum der Beitrag (noch) nicht geplant oder veröffentlicht werden darf — null = darf. Plant die Stimme selbst, ist das ihr Okay. */
export function planSperre(b: ZuZweit, ich: string | null): string | null {
  const stand = freigabeStand(b);
  if (stand === 'nicht_noetig' || stand === 'ok') return null;
  const p = stimmPerson(b)!;
  return ich === p ? null : sperreText(stand, p);
}
export const darfPlanen = (b: ZuZweit, ich: string | null) => planSperre(b, ich) === null;

/** Newsletter: Sperre vor „bereit“/„versendet“, solange eine angefragte Freigabe nicht erteilt ist. Die angefragte Person selbst darf — das ist ihr Okay. */
export function ausgabeSperre(a: { freigabe?: Freigabe | null }, ich: string | null): string | null {
  const f = a.freigabe;
  if (!f || f.status === 'ok' || ich === f.an) return null;
  return sperreText(f.status, f.an);
}

// Freigaben bauen — immer als ganzes Objekt (api.teil ersetzt das Feld „freigabe“ vollständig).
export const freigabeAnfrage = (an: string, ich: string | null, jetzt: string): Freigabe => ({ status: 'offen', an, ...(ich && ich !== BEIDE ? { von: ich } : {}), am: jetzt });
export const freigabeOk = (f: Freigabe | null | undefined, an: string, jetzt: string): Freigabe => ({ status: 'ok', an, ...(f?.von ? { von: f.von } : {}), am: jetzt });
/** Änderungswunsch — nur mit Notiz (was soll anders werden?). */
export function aenderungsWunsch(f: Freigabe | null | undefined, an: string, notiz: string, jetzt: string): Freigabe | null {
  const t = notiz.trim().slice(0, 600);
  return t ? { status: 'aenderung', an, ...(f?.von ? { von: f.von } : {}), am: jetzt, notiz: t } : null;
}

export type Wechsel<T> = { ok: true; felder: Teil<T> } | { ok: false; grund: string };

/**
 * Statuswechsel eines Beitrags. Vor „geplant“/„veröffentlicht“ gilt die
 * Freigabe-Regel; setzt die Stimme selbst den Status, wird ihr Okay mit
 * eingetragen. „Veröffentlicht“ ohne Datum bekommt heute.
 */
export function beitragStatusWechsel(b: ZuZweit & Pick<Beitrag, 'status' | 'datum'>, neu: Beitrag['status'], ich: string | null, heute: string, jetzt: string): Wechsel<Beitrag> {
  const felder: Teil<Beitrag> = { status: neu };
  if (neu === 'geplant' || neu === 'veroeffentlicht') {
    const sperre = planSperre(b, ich);
    if (sperre) return { ok: false, grund: sperre };
    const stand = freigabeStand(b);
    if (stand !== 'nicht_noetig' && stand !== 'ok' && ich) felder.freigabe = freigabeOk(b.freigabe, ich, jetzt);
  }
  if (neu === 'veroeffentlicht' && !b.datum) felder.datum = heute;
  return { ok: true, felder };
}

/** Statuswechsel einer Newsletter-Ausgabe — dieselbe Regel vor „bereit“/„versendet“. */
export function ausgabeStatusWechsel(a: Pick<NewsletterAusgabe, 'status' | 'datum'> & MitFreigabe, neu: NewsletterAusgabe['status'], ich: string | null, heute: string, jetzt: string): Wechsel<NewsletterAusgabe> {
  const felder: Teil<NewsletterAusgabe> = { status: neu };
  if (neu === 'bereit' || neu === 'versendet') {
    const sperre = ausgabeSperre(a, ich);
    if (sperre) return { ok: false, grund: sperre };
    if (a.freigabe && a.freigabe.status !== 'ok' && ich === a.freigabe.an) felder.freigabe = freigabeOk(a.freigabe, ich, jetzt);
  }
  if (neu === 'versendet' && !a.datum) felder.datum = heute;
  return { ok: true, felder };
}

/** Nach einer Änderung an Titel oder Text: Das Okay gilt dem freigegebenen Text. Null = Freigabe bleibt, wie sie ist. */
export function beitragNachTextAenderung(b: ZuZweit & Pick<Beitrag, 'status'>, ich: string | null, jetzt: string): Freigabe | null {
  if (b.status === 'veroeffentlicht' || freigabeStand(b) !== 'ok') return null;
  const an = stimmPerson(b)!;
  return ich === an ? null : { status: 'offen', an, ...(ich ? { von: ich } : b.freigabe?.von ? { von: b.freigabe.von } : {}), am: jetzt, notiz: NACH_AENDERUNG };
}
export function ausgabeNachTextAenderung(a: Pick<NewsletterAusgabe, 'status'> & MitFreigabe, ich: string | null, jetzt: string): Freigabe | null {
  const f = a.freigabe;
  if (a.status === 'versendet' || !f || f.status !== 'ok' || ich === f.an) return null;
  return { status: 'offen', an: f.an, ...(ich ? { von: ich } : f.von ? { von: f.von } : {}), am: jetzt, notiz: NACH_AENDERUNG };
}

/**
 * Autor oder Stimme wechseln. Passt eine vorhandene Freigabe danach nicht
 * mehr (keine nötig oder an jemand anderen), fällt sie weg — sonst stünde
 * sie weiter in „Warten auf deine Freigabe“.
 */
export function rollenWechsel(b: ZuZweit, neu: { zustaendig?: string | null; stimme?: string | null }): Teil<Beitrag> {
  const danach = { zustaendig: 'zustaendig' in neu ? neu.zustaendig : b.zustaendig, stimme: 'stimme' in neu ? neu.stimme : b.stimme };
  const f = b.freigabe;
  const passt = !!f && freigabeNoetig(danach) && f.an === stimmPerson(danach);
  return { ...neu, ...(f && !passt ? { freigabe: null } : {}) };
}

/** Was als Nächstes an diesem Beitrag zu tun ist — aus Sicht von `ich`. */
export function naechsterSchritt(b: Beitrag, ich: string | null, heute: string): string {
  const stand = freigabeStand(b);
  const p = stimmPerson(b);
  const n = p ? nameVon(p) : '';
  if (b.status === 'veroeffentlicht') return (b.wirkung ?? []).length ? 'Wirkung weiter pflegen — wer kam darüber ins Gespräch?' : 'Wirkung eintragen: Wer hat reagiert, wer kam ins Gespräch?';
  if (stand === 'offen') return ich === p ? 'Lesen, dann freigeben oder Änderung wünschen.' : `Wartet auf ${genitiv(n)} Freigabe.`;
  if (stand === 'aenderung') return ich === p ? `Dein Änderungswunsch liegt bei ${nameVon(autorVon(b))}.` : `${genitiv(n)} Änderungswunsch einarbeiten, dann erneut zur Freigabe.`;
  if (b.status === 'idee') return b.stimme ? 'Entwurf schreiben.' : 'Entwurf schreiben — und festlegen, in wessen Namen es erscheint.';
  if (stand === 'fehlt') {
    if (ich === p) return 'Erscheint in deinem Namen: lesen und freigeben.';
    return b.status === 'geplant' ? `Geplant ohne ${genitiv(n)} Okay — zur Freigabe an ${n}.` : `Fertig? Zur Freigabe an ${n}.`;
  }
  if (b.status === 'entwurf') return b.datum ? `Fertig? Auf „Geplant“ für den ${kurzTag(b.datum)} setzen.` : 'Datum setzen und planen.';
  if (!b.datum) return 'Datum setzen.';
  if (b.datum < heute) return 'Überfällig — veröffentlichen oder neu planen.';
  if (b.datum === heute) return 'Heute veröffentlichen, dann Status und Link eintragen.';
  return `Erscheint am ${kurzTag(b.datum)} — veröffentlichen bleibt bei euch.`;
}

/** Was als Nächstes an einer Newsletter-Ausgabe zu tun ist. */
export function ausgabeNaechsterSchritt(a: NewsletterAusgabe, ich: string | null, empfaenger: number): string {
  const f = a.freigabe;
  if (a.status === 'versendet') return a.empfaenger == null || a.abmeldungen == null ? 'Empfänger, Antworten und Abmeldungen aus dem Versandwerkzeug eintragen.' : 'Antworten nachfassen — wer antwortet, ist ein Gespräch.';
  if (f?.status === 'offen') return ich === f.an ? 'Lesen, dann freigeben oder Änderung wünschen.' : `Wartet auf ${genitiv(nameVon(f.an))} Freigabe.`;
  if (f?.status === 'aenderung') return ich === f.an ? `Dein Änderungswunsch liegt bei ${nameVon(autorVon(a))}.` : `${genitiv(nameVon(f.an))} Änderungswunsch einarbeiten, dann erneut zur Freigabe.`;
  if (a.status === 'entwurf') return a.inhalt.trim() ? 'Fertig? Auf „Bereit“ setzen — oder vorher zur Freigabe schicken.' : 'Inhalt schreiben — eine Einsicht, konkret.';
  return empfaenger ? 'Empfänger exportieren, im Versandwerkzeug verschicken, dann „Versendet“ setzen.' : 'Ohne Empfänger mit Double-Opt-in nicht versenden.';
}

// ── Was bei wem liegt ──────────────────────────────────────────────────────
export interface FreigabePosten {
  art: 'beitrag' | 'newsletter'; id: string; titel: string;
  /** offen = liegt bei der freigebenden Person · aenderung = zurück beim Autor · fehlt = geplant, aber nie angefragt. */
  stand: 'offen' | 'aenderung' | 'fehlt';
  /** Bei wem es gerade liegt (Team-Kürzel oder „beide“). */
  bei: string; an: string; autor: string; von?: string; seit?: string; notiz?: string; datum?: string;
}
/** Alle offenen Freigaben über Beiträge und Newsletter — am längsten Wartendes zuerst. Veröffentlichtes und Versendetes zählt nicht mehr. */
export function freigabeLage(crm: { beitraege?: Beitrag[]; newsletter?: NewsletterAusgabe[] }): FreigabePosten[] {
  const r: FreigabePosten[] = [];
  for (const b of crm.beitraege ?? []) {
    if (b.status === 'veroeffentlicht') continue;
    const stand = freigabeStand(b);
    if (stand !== 'offen' && stand !== 'aenderung' && !(stand === 'fehlt' && b.status === 'geplant')) continue;
    const an = stimmPerson(b)!, autor = autorVon(b);
    const f = stand === 'fehlt' ? undefined : b.freigabe ?? undefined;
    r.push({ art: 'beitrag', id: b.id, titel: b.titel, stand, bei: stand === 'offen' ? an : autor, an, autor, ...(f?.von ? { von: f.von } : {}), ...(f?.am ? { seit: f.am } : {}), ...(f?.notiz ? { notiz: f.notiz } : {}), ...(b.datum ? { datum: b.datum } : {}) });
  }
  for (const a of crm.newsletter ?? []) {
    const f = a.freigabe;
    if (a.status === 'versendet' || !f || (f.status !== 'offen' && f.status !== 'aenderung')) continue;
    const autor = autorVon(a);
    r.push({ art: 'newsletter', id: a.id, titel: a.titel, stand: f.status, bei: f.status === 'offen' ? f.an : autor, an: f.an, autor, ...(f.von ? { von: f.von } : {}), ...(f.am ? { seit: f.am } : {}), ...(f.notiz ? { notiz: f.notiz } : {}), ...(a.datum ? { datum: a.datum } : {}) });
  }
  return r.sort((x, y) => (x.seit ?? '9999').localeCompare(y.seit ?? '9999') || x.titel.localeCompare(y.titel));
}
/** Liegt der Posten bei dieser Person? „beide“ liegt bei beiden. */
export const liegtBei = (p: Pick<FreigabePosten, 'bei'>, person: string | null) => !!person && (p.bei === person || p.bei === BEIDE);

// ── Für dich im Redaktionsplan ─────────────────────────────────────────────
export interface RedaktionAufgabe { id: string; titel: string; was: string; art: 'freigabe' | 'aenderung' | 'faellig' | 'anfragen' | 'wirkung' }
/**
 * Was im Redaktionsplan bei dieser Person liegt, Wichtigstes zuerst:
 * Freigaben in ihrem Namen → Änderungswünsche an ihren Texten → heute oder
 * überfällig zu veröffentlichen → fertige Entwürfe, die noch zur Freigabe
 * müssen → Veröffentlichtes der letzten 14 Tage ohne eingetragene Wirkung.
 */
export function redaktionFuerMich(beitraege: Beitrag[], ich: string | null, heute: string, max = 6): RedaktionAufgabe[] {
  if (!ich) return [];
  const vor14 = tagPlus(heute, -13);
  const l: (RedaktionAufgabe & { rang: number; sort: string })[] = [];
  for (const b of beitraege) {
    const stand = freigabeStand(b);
    const p = stimmPerson(b);
    const meins = istMeins(b.zustaendig, 'marketing', ich);
    const sort = b.datum ?? '9999';
    if (stand === 'offen' && p === ich && b.status !== 'veroeffentlicht') l.push({ id: b.id, titel: b.titel, was: 'wartet auf deine Freigabe', art: 'freigabe', rang: 0, sort });
    else if (stand === 'aenderung' && meins && b.status !== 'veroeffentlicht') l.push({ id: b.id, titel: b.titel, was: `${nameVon(p)} wünscht eine Änderung${b.freigabe?.notiz ? `: „${kurz(b.freigabe.notiz, 80)}“` : ''}`, art: 'aenderung', rang: 1, sort });
    else if (b.status === 'geplant' && b.datum && b.datum <= heute && meins) l.push({ id: b.id, titel: b.titel, was: b.datum < heute ? 'überfällig — veröffentlichen oder neu planen' : 'heute veröffentlichen', art: 'faellig', rang: 2, sort });
    else if (stand === 'fehlt' && meins && (b.status === 'geplant' || (b.status === 'entwurf' && (b.text ?? '').trim()))) l.push({ id: b.id, titel: b.titel, was: `zur Freigabe an ${nameVon(p)} schicken`, art: 'anfragen', rang: 3, sort });
    else if (b.status === 'veroeffentlicht' && b.datum && b.datum >= vor14 && b.datum <= heute && !(b.wirkung ?? []).length && meins) l.push({ id: b.id, titel: b.titel, was: 'Wirkung eintragen', art: 'wirkung', rang: 4, sort });
  }
  return l.sort((a, b) => a.rang - b.rang || a.sort.localeCompare(b.sort)).slice(0, max).map(x => ({ id: x.id, titel: x.titel, was: x.was, art: x.art }));
}

// ── Diese Woche: wer schreibt was ──────────────────────────────────────────
export interface WocheJePerson { von: string; bis: string; label: string; je: { person: string; beitraege: Beitrag[] }[] }
/**
 * Beiträge mit Datum in dieser Woche (Mo–So) je Autor — dazu Liegengebliebenes
 * aus früheren Wochen (Datum vorbei, noch nicht veröffentlicht). Beide
 * Personen stehen immer da, „Beide“ nur, wenn es Gemeinsames gibt.
 */
export function wocheWerSchreibt(beitraege: Beitrag[], heute: string): WocheJePerson {
  const f = planFenster(heute, 'woche')!;
  const drin = beitraege.filter(b => b.datum && ((b.datum >= f.von && b.datum <= f.bis) || (b.datum < f.von && b.status !== 'veroeffentlicht')));
  const je = [...TEAM.map(t => t.id), BEIDE].map(person => ({ person, beitraege: drin.filter(b => autorVon(b) === person).sort((a, b) => a.datum!.localeCompare(b.datum!) || a.titel.localeCompare(b.titel)) }));
  return { von: f.von, bis: f.bis, label: f.label, je: je.filter(x => x.person !== BEIDE || x.beitraege.length) };
}

// ── Beiträge je Person ─────────────────────────────────────────────────────
export interface PersonBeitraege {
  person: string;
  /** Veröffentlicht im Zeitraum als Autor (gemeinsame zählen bei beiden) — null, solange die Person keinen Beitrag hat. */
  veroeffentlicht: number | null;
  /** Veröffentlicht im Zeitraum in ihrem Namen (Stimme) — null, solange nichts in ihrem Namen geplant ist. */
  inIhremNamen: number | null;
  /** Gespräche/Anfragen aus der Wirkung ihrer Beiträge im Zeitraum, je Person und Beitrag einmal — null, solange nichts veröffentlicht und nichts eingetragen ist. */
  gespraeche: number | null;
  /** Die gezählten Veröffentlichungen — damit jede Zahl belegbar ist. */
  belege: { id: string; titel: string; datum: string }[];
}
export function beitraegeJePerson(beitraege: Beitrag[], heute: string, tage = 30): PersonBeitraege[] {
  const von = tagPlus(heute, -(tage - 1));
  const imZeitraum = (b: Beitrag) => b.status === 'veroeffentlicht' && !!b.datum && b.datum >= von && b.datum <= heute;
  return TEAM.map(t => {
    const eigene = beitraege.filter(b => { const a = autorVon(b); return a === t.id || a === BEIDE; });
    const inNamen = beitraege.filter(b => stimmPerson(b) === t.id);
    const pub = eigene.filter(imZeitraum).sort((a, b) => b.datum!.localeCompare(a.datum!));
    const paare = new Set<string>();
    for (const b of eigene) for (const w of b.wirkung ?? []) if ((w.art === 'gespraech' || w.art === 'anfrage') && w.am >= von && w.am <= heute) paare.add(`${b.id}|${w.kontaktId}`);
    const messbar = eigene.some(b => b.status === 'veroeffentlicht' || (b.wirkung ?? []).length > 0);
    return {
      person: t.id,
      veroeffentlicht: eigene.length ? pub.length : null,
      inIhremNamen: inNamen.length ? inNamen.filter(imZeitraum).length : null,
      gespraeche: messbar ? paare.size : null,
      belege: pub.map(b => ({ id: b.id, titel: b.titel, datum: b.datum! })),
    };
  });
}

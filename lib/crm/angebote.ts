// ─── Markttraktion · Angebote — Regeln (rein, client-sicher, getestet, 28.09.) ─
// Kevin 28.09.: „Das Angebots-Tool, direkt verbunden mit Kunden, Mandaten,
// Produktinhalten und Preisen. Im Call muss es extrem schnell gehen.“
//
// Hier steht alles, was ohne Platte geht:
//   · Summen in CENT: je Position menge × Einzelpreis − Rabatt (kaufmännisch), Steuer je
//     Satz auf die Summe der Basis über lib/finanzen/ust.ts (eine Funktion, kaufmännisch je
//     Angebot) — einmalig, monatlich, jährlich getrennt, dazu der Gesamtwert über die Laufzeit.
//   · Nummern: Format der Gesellschaft (`{KURZ}-A-{JAHR}-{NR4}`), laufende Nummer je
//     Gesellschaft und Jahr — lückenlos, weil gestellte Angebote nie gelöscht werden und die
//     Vergabe in EINER Schreibsperre läuft (lib/crm/angebot-server.ts).
//   · Säubern eines Entwurfs, Prüfen vor dem Stellen, Ablauf nach „gültig bis“,
//     Vorlagen (Anrede Sie/Du), Position aus einem Produkt, Deal-Wert und Mandat-Vorbelegung.
//   · Personenbezug (Art. 15/17, Dubletten): Entwürfe fallen weg, gestellte Angebote sind
//     Geschäftsunterlagen — der Bezug wird gelöst, das Angebot bleibt (§ 257 HGB, § 147 AO).
// Keine Rechts- oder Steuerberatung — Pflichtangaben einmal mit dem Steuerberater abstimmen.

import type { Angebot, AngebotBasis, AngebotPosition, AngebotsStatus, Chance, CrmBestand, FollowUp, Leistung, Mandat } from './typen';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { KERN_EINHEITEN, UG_KURZ } from '@/lib/einheiten';
import { inCent, ausCent, ustAusNetto, kaufmaennisch } from '@/lib/finanzen/ust';
import { preisBasisVon } from '@/lib/finanzen/produkte';
import { werktagePlus as kernWerktagePlus } from '@/lib/zeit/kalender-kern';

// ── Grundwerte ───────────────────────────────────────────────────────────────

export const ANGEBOT_STATUS: readonly { id: AngebotsStatus; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'gestellt', label: 'gestellt' }, { id: 'angenommen', label: 'angenommen' },
  { id: 'abgelehnt', label: 'abgelehnt' }, { id: 'abgelaufen', label: 'abgelaufen' }, { id: 'ersetzt', label: 'ersetzt' },
];
export const ANGEBOT_STATUS_LABEL = Object.fromEntries(ANGEBOT_STATUS.map(s => [s.id, s.label])) as Record<AngebotsStatus, string>;
export const BASIS_LABEL: Record<AngebotBasis, string> = { einmalig: 'einmalig', monat: 'monatlich', jahr: 'jährlich' };
export const UST_SAETZE = [19, 7, 0] as const;
export const GESELLSCHAFTEN: readonly Gesellschaftskennung[] = ['kdc', 'kdv', 'ug'];
export const istGesellschaft = (v: unknown): v is Gesellschaftskennung => typeof v === 'string' && (GESELLSCHAFTEN as readonly string[]).includes(v);
export const gesellschaftLabel = (g: string | undefined) => KERN_EINHEITEN.find(e => e.id === g)?.label ?? 'offen';

/** Vorgabe des Nummernformats (Kevin 28.09.). */
export const NUMMER_VORGABE = '{KURZ}-A-{JAHR}-{NR4}';
/** Vorgaben je Gesellschaft, solange in den Stammdaten nichts steht. */
export const GUELTIG_VORGABE_TAGE = 30;
export const ZAHLUNGSZIEL_VORGABE_TAGE = 14;
/** Nachfassen nach dem Stellen: +5 Werktage (Kevin), änderbar. */
export const NACHFASSEN_WERKTAGE = 5;

/** Grenzen — darüber lehnt der Server ab (413), nie still kürzen. */
export const ANGEBOT_GRENZEN = { positionen: 200, titel: 200, text: 6000, einleitung: 6000, schluss: 6000, grund: 600 } as const;
/** Höchstwerte je Position (Schutz vor Tippfehlern: 10 Mio. € je Einzelpreis, 100.000 Stück). */
export const POSITION_MAX = { menge: 100000, einzelpreisCent: 1_000_000_000, laufzeitMonate: 600 } as const;

/** Nach dem Stellen unveränderlich — Status und die Felder, die der Server beim Übergang setzt. */
export const istEntwurf = (a: Pick<Angebot, 'status'>) => a.status === 'entwurf';
/** Offen im Sinne von „wartet auf Antwort“ (BEAN: Angebotskunde). */
export const istOffen = (a: Pick<Angebot, 'status'>) => a.status === 'gestellt';

// ── Summen (Cent) ────────────────────────────────────────────────────────────

/** Netto einer Position in Cent: menge × Einzelpreis × (1 − Rabatt), kaufmännisch auf den Cent. */
export function positionNettoCent(p: Pick<AngebotPosition, 'menge' | 'einzelpreisCent' | 'rabattProzent'>): number {
  const menge = Number.isFinite(p.menge) ? p.menge : 0;
  const preis = Number.isFinite(p.einzelpreisCent) ? p.einzelpreisCent : 0;
  const rabatt = Math.max(0, Math.min(100, Number(p.rabattProzent) || 0));
  return kaufmaennisch(menge * preis * (1 - rabatt / 100));
}

/** Steuer in Cent aus einem Netto in Cent — über die EINE Funktion in lib/finanzen/ust.ts. */
export const ustCent = (nettoCent: number, satz: number) => inCent(ustAusNetto(ausCent(nettoCent), satz));

export interface Summe { netto: number; ust: number; brutto: number; /** Steuer je Satz (Cent). */ jeSatz: { satz: number; netto: number; ust: number }[] }
export interface AngebotSummen {
  einmalig: Summe;
  monat: Summe;
  jahr: Summe;
  /** Gesamtwert über die Laufzeit: einmalig + monatlich × Laufzeit (Vorgabe 12) + jährlich × Jahre (Vorgabe 1). */
  gesamt: Summe;
  /** Positionen mit laufender Basis ohne Laufzeit — dort gilt die Vorgabe (Hinweis in der Oberfläche). */
  ohneLaufzeit: number;
  kleinunternehmer: boolean;
}

const leer = (): Summe => ({ netto: 0, ust: 0, brutto: 0, jeSatz: [] });
/** Summe über Posten (Netto je Satz) — Steuer je Satz EINMAL auf die Summe gerechnet (kaufmännisch je Angebot). */
function summeAus(posten: { netto: number; satz: number }[], kleinunternehmer: boolean): Summe {
  const jeSatz = new Map<number, number>();
  for (const p of posten) jeSatz.set(kleinunternehmer ? 0 : p.satz, (jeSatz.get(kleinunternehmer ? 0 : p.satz) ?? 0) + p.netto);
  const l = Array.from(jeSatz.entries()).sort((a, b) => b[0] - a[0]).map(([satz, netto]) => ({ satz, netto, ust: satz ? ustCent(netto, satz) : 0 }));
  const netto = l.reduce((a, x) => a + x.netto, 0);
  const ust = l.reduce((a, x) => a + x.ust, 0);
  return { netto, ust, brutto: netto + ust, jeSatz: l };
}

/** Laufzeit-Faktor einer Position für den Gesamtwert. */
export function laufzeitFaktor(p: Pick<AngebotPosition, 'basis' | 'laufzeitMonate'>): number {
  if (p.basis === 'einmalig') return 1;
  const m = p.laufzeitMonate && p.laufzeitMonate > 0 ? p.laufzeitMonate : p.basis === 'monat' ? 12 : 12;
  return p.basis === 'monat' ? m : m / 12;
}

/** Alle Summen eines Angebots — in Cent, kaufmännisch je Angebot. Kleinunternehmer (§ 19 UStG): keine Steuer. */
export function angebotSummen(a: Pick<Angebot, 'positionen'>, opt: { kleinunternehmer?: boolean } = {}): AngebotSummen {
  const ku = !!opt.kleinunternehmer;
  const nach = (b: AngebotBasis) => a.positionen.filter(p => p.basis === b).map(p => ({ netto: positionNettoCent(p), satz: p.ustSatz }));
  const gesamt = a.positionen.map(p => ({ netto: kaufmaennisch(positionNettoCent(p) * laufzeitFaktor(p)), satz: p.ustSatz }));
  return {
    einmalig: summeAus(nach('einmalig'), ku), monat: summeAus(nach('monat'), ku), jahr: summeAus(nach('jahr'), ku),
    gesamt: gesamt.length ? summeAus(gesamt, ku) : leer(),
    ohneLaufzeit: a.positionen.filter(p => p.basis !== 'einmalig' && !(p.laufzeitMonate && p.laufzeitMonate > 0)).length,
    kleinunternehmer: ku,
  };
}

/** Cent → „1.234,56 €“. */
export const euroCent = (cent: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cent || 0) / 100);
/** Eingabe „1.234,5“ / „1234.50“ / „1234“ → Cent (null = keine Zahl). */
export function centAusEingabe(t: string): number | null {
  const s = String(t ?? '').replace(/\s|€/g, '');
  if (!s) return null;
  // Deutsche Schreibweise: Punkt als Tausender, Komma als Dezimal. Nur ein Punkt ohne Komma mit ≠ 3 Nachstellen = Dezimalpunkt.
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? inCent(n) : null;
}
/** Cent → Eingabetext „1234,50“. */
export const eingabeAusCent = (cent: number) => (cent % 100 === 0 ? String(cent / 100) : (cent / 100).toFixed(2).replace('.', ','));
/** Menge „1,5“ → 1.5 (null = keine Zahl). */
export function mengeAusEingabe(t: string): number | null {
  const n = Number(String(t ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}
export const mengeText = (m: number) => m.toLocaleString('de-DE', { maximumFractionDigits: 3 });

// ── Nummern ──────────────────────────────────────────────────────────────────

/** Ein Kurzname als Nummern-Kürzel: nur Großbuchstaben und Ziffern, höchstens 8 Zeichen (Umlaute ausgeschrieben). */
export function kuerzelAus(name: string, rueckfall: string): string {
  const k = String(name ?? '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return k || rueckfall;
}
/**
 * Kürzel für die Nummer, solange die Gesellschaft keines trägt. `ug` kommt aus dem Kurznamen der Instanz (`UG_KURZ`, lib/einheiten.ts —
 * 08.10., Markttraktion Woche 2 · 3.15: vorher stand hier noch das Kürzel des Altnamens). Vergebene Nummern bleiben, wie sie sind.
 */
export const KURZ_VORGABE: Record<Gesellschaftskennung, string> = { kdc: 'KDC', kdv: 'KDV', ug: kuerzelAus(UG_KURZ, 'UG') };

/** Ein Format ist gültig, wenn es genau eine laufende Nummer trägt und nur erlaubte Zeichen. */
export function nummernformatOk(f: string): boolean {
  const t = String(f ?? '');
  if (!t || t.length > 60 || !/^[A-Za-z0-9{}._\-/]+$/.test(t)) return false;
  const nr = t.match(/\{NR[3-6]?\}/g) ?? [];
  const rest = t.replace(/\{(KURZ|JAHR|JJ|NR[3-6]?)\}/g, '');
  return nr.length === 1 && !/[{}]/.test(rest);
}

/** Nummer aus Format, Kürzel, Jahr und laufender Nummer: `{KURZ}-A-{JAHR}-{NR4}` → „KDV-A-2026-0001“. */
export function nummerAusFormat(format: string, kurz: string, jahr: number, nr: number): string {
  const f = nummernformatOk(format) ? format : NUMMER_VORGABE;
  return f.replace(/\{KURZ\}/g, kurz).replace(/\{JAHR\}/g, String(jahr)).replace(/\{JJ\}/g, String(jahr).slice(-2))
    .replace(/\{NR([3-6])?\}/g, (_m, s: string | undefined) => String(nr).padStart(s ? Number(s) : 1, '0'));
}

/** Nächste laufende Nummer je Gesellschaft und Jahr — Höchstwert + 1 über ALLE Angebote (gestellte werden nie gelöscht). */
export function naechsteLaufnummer(angebote: readonly Pick<Angebot, 'gesellschaft' | 'lauf'>[], gesellschaft: Gesellschaftskennung, jahr: number): number {
  let max = 0;
  for (const a of angebote) if (a.gesellschaft === gesellschaft && a.lauf?.jahr === jahr && a.lauf.nr > max) max = a.lauf.nr;
  return max + 1;
}

// ── Tage ─────────────────────────────────────────────────────────────────────

const tagMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const tagAus = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(tagMs(v));
export const plusTage = (d: string, n: number) => tagAus(tagMs(d) + n * 864e5);
/** +n Werktage (Mo–Fr ohne Feiertage NRW, Kalender-Kern — 29.09., K2: vorher zählten Feiertage mit). */
export const werktagePlus = (d: string, n: number): string => (n > 0 ? kernWerktagePlus(d, n) : d);

// ── Säubern (Entwurf aus dem Browser) ────────────────────────────────────────

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n);
const zeile = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const idOk = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
export const kontaktIdOk = (v: unknown): v is string => typeof v === 'string' && /^c-[a-z0-9-]{4,60}$/.test(v);
export const firmaIdOk = (v: unknown): v is string => typeof v === 'string' && /^f-[a-z0-9-]{2,63}$/.test(v);
const BASEN: readonly AngebotBasis[] = ['einmalig', 'monat', 'jahr'];

/** Welche Grenze eine Eingabe überschreitet — Texte für 413 (leer = alles gut). Nie still kürzen. */
export function angebotGrenzen(roh: Record<string, unknown>): string[] {
  const f: string[] = [];
  const lang = (feld: keyof typeof ANGEBOT_GRENZEN, v: unknown) => { if (typeof v === 'string' && v.length > ANGEBOT_GRENZEN[feld]) f.push(`„${feld}“ ist länger als ${ANGEBOT_GRENZEN[feld]} Zeichen — nichts gekürzt, bitte kürzen.`); };
  lang('titel', roh.titel); lang('einleitung', roh.einleitung); lang('schluss', roh.schluss);
  if (Array.isArray(roh.positionen)) {
    if (roh.positionen.length > ANGEBOT_GRENZEN.positionen) f.push(`${roh.positionen.length} Positionen — höchstens ${ANGEBOT_GRENZEN.positionen}. Abgelehnt, nichts gekürzt.`);
    for (const p of roh.positionen as Record<string, unknown>[]) { lang('text', p?.text); lang('titel', p?.titel); }
  }
  return f;
}

/** Eine Position säubern — null, wenn sie nichts taugt (kein Titel). */
export function positionSaeubern(o: Record<string, unknown>, i: number): AngebotPosition | null {
  const titel = zeile(o.titel, ANGEBOT_GRENZEN.titel);
  if (!titel) return null;
  const menge = Math.max(0, Math.min(POSITION_MAX.menge, Math.round((Number(o.menge) || 0) * 1000) / 1000));
  const preis = Math.max(0, Math.min(POSITION_MAX.einzelpreisCent, Math.round(Number(o.einzelpreisCent) || 0)));
  const rabatt = Math.max(0, Math.min(100, Math.round((Number(o.rabattProzent) || 0) * 100) / 100));
  const satz = (UST_SAETZE as readonly number[]).includes(Number(o.ustSatz)) ? Number(o.ustSatz) : 19;
  const basis = BASEN.includes(o.basis as AngebotBasis) ? (o.basis as AngebotBasis) : 'einmalig';
  const lz = Math.round(Number(o.laufzeitMonate) || 0);
  return {
    id: idOk(o.id) ? o.id : `p${i + 1}`, ...(idOk(o.leistungId) ? { leistungId: o.leistungId } : {}),
    titel, text: txt(o.text, ANGEBOT_GRENZEN.text), menge, einheit: zeile(o.einheit, 30) || 'pauschal', einzelpreisCent: preis,
    ...(rabatt ? { rabattProzent: rabatt } : {}), ustSatz: satz, basis,
    ...(basis !== 'einmalig' && lz > 0 ? { laufzeitMonate: Math.min(POSITION_MAX.laufzeitMonate, lz) } : {}),
  };
}

/** Die Felder, die ein Browser an einem ENTWURF setzen darf. Alles andere (Nummer, Status, Prüfsumme …) setzt der Server. */
export const ENTWURF_FELDER = ['gesellschaft', 'kontaktId', 'firmaId', 'dealId', 'mandatId', 'titel', 'positionen', 'einleitung', 'schluss', 'gueltigBis', 'zahlungszielTage'] as const;

/**
 * Entwurf säubern: nur ENTWURF_FELDER aus `roh`, auf den bisherigen Entwurf gelegt. Status bleibt „entwurf“,
 * Version/Vorgänger bleiben, wie der Server sie setzte. Kennungen nur in ihrer Form (tote prüft die Verbindungsprüfung).
 */
/** `gesellschaftVorgabe` (08.10.): Absender eines NEUEN Entwurfs ohne Angabe — die operative Business-Gesellschaft (Server: `absenderVorgabe`). */
export function entwurfSaeubern(roh: Record<string, unknown>, alt: Angebot | null, basis: { id: string; jetzt: string; person: string; heute: string; gueltigTage?: number; zielTage?: number; gesellschaftVorgabe?: Gesellschaftskennung }): Angebot {
  const r = (f: (typeof ENTWURF_FELDER)[number]) => (f in roh ? roh[f] : alt ? (alt as unknown as Record<string, unknown>)[f] : undefined);
  const g = r('gesellschaft');
  const pos = r('positionen');
  const positionen = Array.isArray(pos) ? (pos as Record<string, unknown>[]).map((p, i) => positionSaeubern(p ?? {}, i)).filter((p): p is AngebotPosition => !!p) : [];
  // Doppelte Positions-Kennungen (zwei Fenster): hinten nummerieren, nichts wegwerfen.
  const gesehen = new Set<string>();
  for (const p of positionen) { let id = p.id; let n = 2; while (gesehen.has(id)) id = `${p.id}-${n++}`; p.id = id; gesehen.add(id); }
  const gb = r('gueltigBis');
  const ziel = Math.round(Number(r('zahlungszielTage')));
  return {
    // Rückfall `kdc` nur noch, wenn das Register keine eindeutige operative Business-Gesellschaft kennt (Altverhalten, im Editor sichtbar).
    id: basis.id, gesellschaft: istGesellschaft(g) ? g : alt?.gesellschaft ?? basis.gesellschaftVorgabe ?? 'kdc',
    ...(kontaktIdOk(r('kontaktId')) ? { kontaktId: r('kontaktId') as string } : {}),
    ...(firmaIdOk(r('firmaId')) ? { firmaId: r('firmaId') as string } : {}),
    ...(idOk(r('dealId')) ? { dealId: r('dealId') as string } : {}),
    ...(idOk(r('mandatId')) ? { mandatId: r('mandatId') as string } : {}),
    titel: zeile(r('titel'), ANGEBOT_GRENZEN.titel), positionen,
    einleitung: txt(r('einleitung'), ANGEBOT_GRENZEN.einleitung), schluss: txt(r('schluss'), ANGEBOT_GRENZEN.schluss),
    gueltigBis: tagOk(gb) ? gb : plusTage(basis.heute, basis.gueltigTage ?? GUELTIG_VORGABE_TAGE),
    zahlungszielTage: Number.isFinite(ziel) && ziel >= 0 ? Math.min(180, ziel) : basis.zielTage ?? ZAHLUNGSZIEL_VORGABE_TAGE,
    status: 'entwurf', version: alt?.version ?? 1, ...(alt?.vorgaengerId ? { vorgaengerId: alt.vorgaengerId } : {}),
    angelegt: alt?.angelegt ?? basis.jetzt, ...(alt?.angelegtVon ? { angelegtVon: alt.angelegtVon } : { angelegtVon: basis.person }),
    geaendert: basis.jetzt, geaendertVon: basis.person,
  };
}

/** Säuberung aus dem Speicher (Lesen/fremde Schreiber): hält die Form, lässt Server-Felder, wie sie sind. */
export function angebotAusSpeicher(o: Record<string, unknown>): Angebot | null {
  if (!idOk(o.id)) return null;
  const a = o as unknown as Angebot;
  if (!Array.isArray(a.positionen) || !istGesellschaft(a.gesellschaft)) return null;
  return a;
}

// ── Prüfen vor dem Stellen ───────────────────────────────────────────────────

/** Was fehlt, um das Angebot zu stellen? (leer = kann gestellt werden) */
/** Ablehnung, wenn ein Angebot über 0 € gestellt werden soll (3.12) — derselbe Text in Editor-Liste und Server-Antwort. */
export const SUMME_NULL = 'Die Summe ist 0 € — ein Angebot über nichts belegt nur eine Nummer.';
export function stellenFehlt(a: Angebot, heute: string): string[] {
  const f: string[] = [];
  if (!istEntwurf(a)) f.push('Nur ein Entwurf kann gestellt werden.');
  if (!a.kontaktId) f.push('Empfänger fehlt — erst einen Kontakt wählen.');
  if (!a.positionen.length) f.push('Keine Position — mindestens ein Produkt oder eine freie Position.');
  if (a.positionen.some(p => !(p.menge > 0))) f.push('Eine Position hat Menge 0.');
  // 3.12 (08.10.): ein Angebot über 0 € belegte eine feste Nummer — die Summe muss über 0 liegen (der Server antwortet 409).
  if (a.positionen.length && !(angebotSummen(a).gesamt.netto > 0)) f.push(SUMME_NULL);
  if (!a.titel.trim()) f.push('Titel fehlt.');
  if (a.gueltigBis < heute) f.push('„Gültig bis“ liegt in der Vergangenheit.');
  return f;
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

/** Gestellte Angebote nach „gültig bis“ → abgelaufen. Liefert die neue Liste und die Kennungen, die sich änderten. */
export function ablaufen(liste: readonly Angebot[], heute: string, jetzt: string): { liste: Angebot[]; ids: string[] } {
  const ids: string[] = [];
  const neu = liste.map(a => {
    if (a.status !== 'gestellt' || !(a.gueltigBis < heute)) return a;
    ids.push(a.id);
    return { ...a, status: 'abgelaufen' as const, abgelaufenAm: heute, geaendert: jetzt, geaendertVon: 'system' };
  });
  return { liste: ids.length ? neu : [...liste], ids };
}

/** Der Follow-up-Hinweis, wenn ein gestelltes Angebot abläuft (28.09.). */
export const ABLAUF_FOLLOWUP_TEXT = 'Angebot abgelaufen — nachfassen oder Version 2';

/**
 * Follow-ups zu frisch abgelaufenen Angeboten (28.09.): steht das „Angebot nachfassen“ (`fu-<angebot>`) noch offen,
 * bekommt es den Hinweis und wird heute fällig (nie später als vorher); sonst ein neues `fu-<angebot>-ablauf` —
 * höchstens einmal je Angebot. Ohne Person und ohne Deal kein Follow-up; `ausgenommen` (Art. 18) auch nicht.
 */
export function ablaufFollowUps(followups: readonly FollowUp[], abgelaufen: readonly Angebot[], ctx: {
  heute: string; jetzt: string; zustaendig: (a: Angebot) => string; ausgenommen?: (kontaktId: string) => boolean;
}): FollowUp[] {
  const liste = [...followups];
  for (const a of abgelaufen) {
    if (a.kontaktId && ctx.ausgenommen?.(a.kontaktId)) continue;
    const bezug: FollowUp['bezug'] | null = a.dealId ? { art: 'chance', id: a.dealId } : a.kontaktId ? { art: 'kontakt', id: a.kontaktId } : null;
    if (!bezug) continue;
    const text = `${ABLAUF_FOLLOWUP_TEXT}${a.nummer ? ` (${a.nummer})` : ''}`;
    const i = liste.findIndex(f => f.id === `fu-${a.id}` && f.status === 'offen');
    if (i >= 0) {
      const f = liste[i];
      liste[i] = { ...f, text, faellig: f.faellig < ctx.heute ? f.faellig : ctx.heute, geaendert: ctx.jetzt, geaendertVon: 'system' };
      continue;
    }
    const id = `fu-${a.id}-ablauf`;
    if (liste.some(f => f.id === id)) continue;
    liste.push({
      id, bezug, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), art: 'anruf', text, faellig: ctx.heute, zustaendig: ctx.zustaendig(a),
      status: 'offen', quelle: 'deal', angelegt: ctx.jetzt, geaendert: ctx.jetzt, geaendertVon: 'system',
    });
  }
  return liste;
}

// ── Produkte ─────────────────────────────────────────────────────────────────

/** Was einem Produkt für Angebote fehlt (Kevin: Leistungstext ist Pflicht). */
export function produktAngebotFehlt(l: Pick<Leistung, 'angebot'>): string[] {
  return l.angebot?.leistungstext?.trim() ? [] : ['Leistungstext'];
}

/** Säuberung der Angebotstexte eines Produkts (lib/crm/speicher.ts). */
export function leistungAngebotSaeubern(v: unknown): Leistung['angebot'] | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const t = (x: unknown, n: number) => { const s = txt(x, n); return s || undefined; };
  const out = { ...(t(o.titel, 200) ? { titel: t(o.titel, 200) } : {}), ...(t(o.einleitung, 3000) ? { einleitung: t(o.einleitung, 3000) } : {}), leistungstext: txt(o.leistungstext, ANGEBOT_GRENZEN.text), ...(t(o.ergebnis, 2000) ? { ergebnis: t(o.ergebnis, 2000) } : {}), ...(t(o.hinweise, 2000) ? { hinweise: t(o.hinweise, 2000) } : {}) };
  return out.leistungstext || Object.keys(out).length > 1 ? out : undefined;
}

/** Positionstext aus den Angebotstexten des Produkts (Leistungstext, Ergebnis, Hinweise). */
export function positionsText(l: Pick<Leistung, 'angebot' | 'beschreibung' | 'lieferumfang' | 'ergebnis'>): string {
  const a = l.angebot;
  if (a?.leistungstext?.trim()) return [a.leistungstext.trim(), a.ergebnis?.trim() ? `Ergebnis: ${a.ergebnis.trim()}` : '', a.hinweise?.trim() ?? ''].filter(Boolean).join('\n\n');
  // Altbestand ohne Angebotstext: Beschreibung + Lieferumfang als Vorschlag (die Oberfläche markiert „Text fehlt“).
  return [l.beschreibung?.trim() ?? '', l.lieferumfang?.length ? l.lieferumfang.map(x => `• ${x}`).join('\n') : '', l.ergebnis?.trim() ? `Ergebnis: ${l.ergebnis.trim()}` : ''].filter(Boolean).join('\n\n');
}

const EINHEIT_JE_BASIS: Record<AngebotBasis, string> = { einmalig: 'pauschal', monat: 'Monat', jahr: 'Jahr' };
/** Eine Position aus einem Produkt: Menge 1, Preis (Cent), Basis, Laufzeit, Titel und Text aus dem Produkt. */
export function positionAusProdukt(l: Leistung, id: string, opt: { kleinunternehmer?: boolean } = {}): AngebotPosition {
  const basis: AngebotBasis = preisBasisVon(l) ?? 'einmalig';
  return {
    id, leistungId: l.id, titel: (l.angebot?.titel?.trim() || l.name).slice(0, ANGEBOT_GRENZEN.titel), text: positionsText(l).slice(0, ANGEBOT_GRENZEN.text),
    menge: 1, einheit: EINHEIT_JE_BASIS[basis], einzelpreisCent: inCent(l.preis.betrag || 0), ustSatz: opt.kleinunternehmer ? 0 : 19, basis,
    ...(basis !== 'einmalig' && l.laufzeitMonate ? { laufzeitMonate: Math.round(l.laufzeitMonate) } : {}),
  };
}

/** Produkte für den Katalog im Tool: aktive der Gesellschaft (dazu die ohne Gesellschaft), „Text fehlt“ markiert. */
export function katalog(leistungen: readonly Leistung[], gesellschaft: Gesellschaftskennung | null): { l: Leistung; textFehlt: boolean; andere: boolean }[] {
  return leistungen.filter(l => l.status === 'aktiv' && !l.geloeschtAm)
    .map(l => ({ l, textFehlt: produktAngebotFehlt(l).length > 0, andere: l.gesellschaft !== gesellschaft && l.gesellschaft !== 'offen' }))
    .sort((a, b) => Number(a.andere) - Number(b.andere) || a.l.name.localeCompare(b.l.name, 'de'));
}

// ── Vorlagen (Anrede Sie/Du) ─────────────────────────────────────────────────

export interface VorlageEingabe { anrede?: 'Sie' | 'Du'; vorname?: string; nachname?: string; titel: string; absender?: string; nummer?: string; gueltigBis?: string; person?: string }
const datumLang = (d?: string) => (d && tagOk(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '');
const gruss = (e: VorlageEingabe) => {
  const name = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
  return e.anrede === 'Du' ? `Hallo ${e.vorname?.trim() || name || ''},`.replace(' ,', ',') : name ? `Guten Tag ${name},` : 'Guten Tag,';
};
/** Einleitung und Schluss für das Angebot — Anrede aus dem Kontakt (Du nur, wenn dort „Du“ steht). */
export function angebotVorlage(e: VorlageEingabe): { einleitung: string; schluss: string } {
  const du = e.anrede === 'Du';
  return {
    einleitung: `${gruss(e)}\n\n${du ? 'vielen Dank für das gute Gespräch. Wie besprochen, bekommst du hier unser Angebot' : 'vielen Dank für das Gespräch und Ihr Interesse. Wie besprochen, erhalten Sie hier unser Angebot'} für „${e.titel || 'die besprochene Leistung'}“.`,
    schluss: du
      ? `Das Angebot gilt bis zum ${datumLang(e.gueltigBis) || '…'}. Melde dich gern, wenn du Fragen hast oder etwas anpassen möchtest — ich freue mich auf die Zusammenarbeit.\n\nViele Grüße`
      : `Das Angebot gilt bis zum ${datumLang(e.gueltigBis) || '…'}. Bei Fragen oder Änderungswünschen melden Sie sich gern — wir freuen uns auf die Zusammenarbeit.\n\nMit freundlichen Grüßen`,
  };
}
/** Betreff und Text der Mail (Kevin: „Angebot {Nummer} – {Titel}“). Ohne Nummer (Entwurf): „Angebot – {Titel}“. */
export function mailVorlage(e: VorlageEingabe): { betreff: string; text: string } {
  const du = e.anrede === 'Du';
  const betreff = `Angebot${e.nummer ? ` ${e.nummer}` : ''} – ${e.titel || 'Angebot'}`;
  const text = `${gruss(e)}\n\n${du ? 'anbei, wie besprochen, unser Angebot' : 'anbei erhalten Sie, wie besprochen, unser Angebot'}${e.nummer ? ` ${e.nummer}` : ''} für „${e.titel || 'die besprochene Leistung'}“${e.gueltigBis ? ` (gültig bis ${datumLang(e.gueltigBis)})` : ''}.\n\n${du ? 'Melde dich gern bei Fragen.' : 'Bei Fragen melden Sie sich gern.'}\n\n${du ? 'Viele Grüße' : 'Mit freundlichen Grüßen'}${e.person ? `\n${e.person}` : ''}${e.absender ? `\n${e.absender}` : ''}`;
  return { betreff, text };
}
/** mailto:-Link (Adresse, Betreff, Text) — die Person hängt das PDF an und schickt ab (Versand zurückgestellt). */
export function mailtoLink(an: string | undefined, betreff: string, text: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '%20');
  return `mailto:${an ? encodeURIComponent(an).replace(/%40/g, '@') : ''}?subject=${enc(betreff)}&body=${enc(text)}`;
}

// ── Verbindungen: Deal-Wert, Mandat-Vorbelegung ─────────────────────────────

/** Deal-Wert aus dem Angebot (Euro): laufend monatlich (Jahr/12 dazu), sonst jährlich, sonst einmalig. */
export function dealWertAusAngebot(a: Pick<Angebot, 'positionen'>): Chance['wert'] {
  const s = angebotSummen(a);
  const lz = Math.max(0, ...a.positionen.filter(p => p.basis !== 'einmalig').map(p => p.laufzeitMonate ?? 0));
  // Gemischtes Angebot (einmalig + laufend): der Einmal-Anteil verteilt sich auf die Laufzeit (ohne Laufzeit: 12 Monate),
  // damit der Deal den ganzen Auftragswert trägt — vorher fiel er weg (Sandbox-Prüfung 28.09.). Der Deal hat nur EINE Basis.
  const laufzeit = lz || 12;
  const einmalAnteil = s.einmalig.netto > 0 && (s.monat.netto > 0 || s.jahr.netto > 0);
  if (s.monat.netto > 0) return { betrag: ausCent(s.monat.netto + kaufmaennisch(s.jahr.netto / 12) + (einmalAnteil ? kaufmaennisch(s.einmalig.netto / laufzeit) : 0)), basis: 'monat', ...(lz || einmalAnteil ? { laufzeitMonate: laufzeit } : {}) };
  if (s.jahr.netto > 0) return { betrag: ausCent(s.jahr.netto + (einmalAnteil ? kaufmaennisch(s.einmalig.netto * 12 / laufzeit) : 0)), basis: 'jahr', ...(lz || einmalAnteil ? { laufzeitMonate: laufzeit } : {}) };
  return { betrag: ausCent(s.einmalig.netto), basis: 'einmalig' };
}

/** Vorbelegung eines Mandats aus einem angenommenen Angebot (bestehender Mandat-Weg, /api/crm/lead aktion „mandat“). */
export function mandatVorbelegung(a: Angebot): Partial<Mandat> {
  const s = angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer });
  const laufend = s.monat.netto + kaufmaennisch(s.jahr.netto / 12);
  const lz = Math.max(0, ...a.positionen.filter(p => p.basis !== 'einmalig').map(p => p.laufzeitMonate ?? 0));
  // Das Mandat trägt die laufende Leistung (Retainer), nicht den einmaligen Auftakt — sonst die erste mit Produkt.
  const leistungId = (a.positionen.find(p => p.leistungId && p.basis !== 'einmalig') ?? a.positionen.find(p => p.leistungId))?.leistungId;
  const saetze = Array.from(new Set(a.positionen.map(p => p.ustSatz)));
  return {
    gesellschaft: a.gesellschaft, titel: a.titel || undefined,
    honorar: laufend > 0 ? { betrag: ausCent(laufend), basis: 'monat', netto: true } : { betrag: ausCent(s.einmalig.netto), basis: 'einmalig', netto: true },
    ...(lz ? { mindestlaufzeitMonate: Math.min(120, lz) } : {}),
    ...(leistungId ? { leistungId } : {}),
    ustSatz: a.absender?.kleinunternehmer ? 0 : saetze.length === 1 && [0, 7, 19].includes(saetze[0]) ? saetze[0] : 19,
    rechnungsrhythmus: laufend > 0 ? 'monatlich' : 'einmalig', zahlungszielTage: a.zahlungszielTage,
    leistungen: a.positionen.map(p => p.titel),
  };
}

/** Das angenommene Angebot zu einem Deal (jüngstes) — für die Mandat-Vorbelegung. */
export const angenommenZuDeal = (angebote: readonly Angebot[] | undefined, dealId: string) =>
  (angebote ?? []).filter(a => a.dealId === dealId && a.status === 'angenommen').sort((x, y) => (y.angenommenAm ?? '').localeCompare(x.angenommenAm ?? ''))[0];

// ── Personenbezug (Art. 15/17, Dubletten) ────────────────────────────────────

export const GELOEST_NAME = '[Person gelöst]';
/** Art. 17: Entwürfe der Person fallen weg; gestellte Angebote verlieren den Personenbezug (Geschäftsunterlage). */
export function angebotePersonOhne(liste: readonly Angebot[], id: string, heute: string): Angebot[] {
  return liste.flatMap(a => {
    if (a.kontaktId !== id) return [a];
    if (istEntwurf(a)) return [];
    const { kontaktId: _k, ...rest } = a;
    return [{ ...rest, personGeloest: heute, ...(a.empfaenger ? { empfaenger: { ...a.empfaenger, name: GELOEST_NAME, email: undefined } } : {}) }];
  });
}
/** Dubletten: Verweise von alt auf neu. */
export const angebotePersonUm = (liste: readonly Angebot[], alt: string, neu: string): Angebot[] => liste.map(a => (a.kontaktId === alt ? { ...a, kontaktId: neu } : a));
/** Art. 15: die Angebote der Person (Nummer, Titel, Status, Summen — ohne PDF-Inhalt). */
export function angebotePersonAuskunft(liste: readonly Angebot[], id: string) {
  return liste.filter(a => a.kontaktId === id).map(a => ({ id: a.id, ...(a.nummer ? { nummer: a.nummer } : {}), titel: a.titel, status: a.status, gesellschaft: a.gesellschaft, gueltigBis: a.gueltigBis, ...(a.gestelltAm ? { gestelltAm: a.gestelltAm } : {}), nettoGesamtCent: angebotSummen(a).gesamt.netto }));
}

// ── Lesen für Oberflächen ────────────────────────────────────────────────────

/** Angebote zu einer Person bzw. ihrer Firma — neueste zuerst. */
export function angeboteZu(liste: readonly Angebot[] | undefined, p: { kontaktId?: string; firmaId?: string; dealId?: string }): Angebot[] {
  return (liste ?? []).filter(a => (p.kontaktId && a.kontaktId === p.kontaktId) || (p.firmaId && a.firmaId === p.firmaId) || (p.dealId && a.dealId === p.dealId))
    .sort((x, y) => (y.gestelltAm ?? y.geaendert).localeCompare(x.gestelltAm ?? x.geaendert));
}

/**
 * Wohin ein ANGENOMMENES Angebot weiterführt (08.10., Markttraktion Woche 2 · 3.10 — vorher hatte es im Umsatz-Reiter keinen Weg):
 *   mandat   es gibt schon ein Mandat (am Angebot vermerkt oder aus dem Deal des Angebots) → „Mandat ›“
 *   anlegen  ein gewonnener Deal ohne Mandat → „Mandat anlegen ›“ (derselbe Weg wie in der Angebots-Ansicht, `/api/crm/lead` aktion „mandat“)
 *   null     nicht angenommen bzw. ohne Deal (dann bleibt „→ Rechnung schreiben“).
 * Gelöschte Mandate (Papierkorb) zählen nicht.
 */
export function angebotMandatWeg(a: Pick<Angebot, 'status' | 'dealId' | 'mandatId'>, crm: { chancen: readonly Pick<Chance, 'id' | 'stufe'>[]; mandate: readonly Pick<Mandat, 'id' | 'chanceId' | 'geloeschtAm'>[] }): { art: 'mandat'; mandatId: string } | { art: 'anlegen'; dealId: string } | null {
  if (a.status !== 'angenommen') return null;
  const lebt = crm.mandate.filter(m => !m.geloeschtAm);
  const amAngebot = a.mandatId ? lebt.find(m => m.id === a.mandatId) : undefined;
  if (amAngebot) return { art: 'mandat', mandatId: amAngebot.id };
  if (!a.dealId) return null;
  const ausDeal = lebt.find(m => m.chanceId === a.dealId);
  if (ausDeal) return { art: 'mandat', mandatId: ausDeal.id };
  return crm.chancen.some(c => c.id === a.dealId && c.stufe === 'gewonnen') ? { art: 'anlegen', dealId: a.dealId } : null;
}

/** Der Kopf des Vermerks am Kontakt — „Angebot <Nummer> gestellt“ bzw. „… gesendet“ (an ihm erkennt der Vermerk sich selbst wieder). */
export const angebotVermerkKopf = (nummer: string, art: 'gestellt' | 'gesendet') => `Angebot ${nummer} ${art}`;
/** Steht am Kontakt schon „Angebot <Nummer> gesendet“ (Woche 2 · 3.15)? Die Oberfläche zeigt „Mail ist raus“ nur, solange nicht. */
export const angebotGesendetVermerkt = (k: { aktivitaeten?: readonly { text?: string }[] } | undefined, nummer: string | undefined): boolean =>
  !!k && !!nummer && (k.aktivitaeten ?? []).some(a => (a.text ?? '').startsWith(angebotVermerkKopf(nummer, 'gesendet')));

/** Filter der Liste „Angebote“. */
export function angeboteFiltern(liste: readonly Angebot[], f: { status?: AngebotsStatus | 'offen' | null; gesellschaft?: Gesellschaftskennung | null; suche?: string }, name: (a: Angebot) => string, passt: (felder: string[], frage: string) => boolean): Angebot[] {
  return liste.filter(a => (!f.status || (f.status === 'offen' ? a.status === 'gestellt' : a.status === f.status))
    && (!f.gesellschaft || a.gesellschaft === f.gesellschaft)
    && (!f.suche?.trim() || passt([a.nummer ?? '', a.titel, name(a)], f.suche)))
    .sort((x, y) => (y.gestelltAm ?? y.geaendert).localeCompare(x.gestelltAm ?? x.geaendert));
}

/** BEAN (lib/crm/bean.ts): offene Angebote als Hinweise (nur Bezüge). */
export const offeneAngeboteHinweise = (b: Pick<CrmBestand, 'angebote'> | Partial<Pick<CrmBestand, 'angebote'>>) =>
  (b.angebote ?? []).filter(istOffen).map(a => ({ titel: a.titel, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.firmaId ? { firmaId: a.firmaId } : {}), ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.mandatId ? { mandatId: a.mandatId } : {}) }));

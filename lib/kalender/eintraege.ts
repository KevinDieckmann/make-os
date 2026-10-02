// ─── Kalender — Fristen und Erinnerungen (rein, getestet) ───────────────────
// Kevin 25.09.: „Dann können wir darin auch alles sehen, was wir machen
// müssen.“ Neben den Terminen gehören in den Kalender die Stichtage aus dem
// ganzen System: Meilensteine, Bauplan-Etappen, Mandate (Ende, Kündigungs-
// frist, Review), offene Zahlungen und erwartete Zahlungseingänge — dazu die
// Apple-Erinnerungen, wenn der Mac sie zuliefert (iCloud gibt Erinnerungen
// seit iOS 13 nicht mehr über CalDAV heraus). Aufgaben mit Datum kommen im
// Browser aus dem Aufgaben-Bestand (abhakbar), nicht von hier.
// Mandanten klickbar (28.09.): Mandatsfristen führen direkt ins Mandat (`WEG.mandat(id)`),
// nicht mehr nur in die Liste; der Name ist die CRM-Firma (die Route setzt `kunde` aus der Kennung).

// K6a (29.09.): Kündigungsfrist und Periodenende rechnet NUR `mandatFristen` (lib/crm/kunden.ts) — dieselbe Rechnung wie
// die Mandatsseite (Befund 6: vorher hier nur `ende`). Steuertermine (Zusatzthema #11) kommen als abschaltbare VORLAGE
// aus dem Steuer-Modul (lib/kalender/fristen-server.ts `steuerFristenLesen`, Werktag nach § 108 AO) — Standard aus,
// ohne Beträge, mit Hinweis. Zahlungen/Eingänge auf Wochenende/Feiertag tragen den Hinweis auf den nächsten Werktag.

import { WEG } from '@/lib/wege';
import { mandatFristen, type MandatFristFelder } from '@/lib/crm/kunden';
import { reviewZaehlt } from '@/lib/crm/review';
import { werktagAbOder } from '@/lib/zeit/kalender-kern';
import { wartetText } from '@/lib/planung/meilenstein-kette';

export type FristArt = 'meilenstein' | 'etappe' | 'mandat' | 'zahlung' | 'eingang' | 'steuer' | 'dsgvo' | 'angebot' | 'deal';
/**
 * `bereich` (29.09., K1): Privat oder Business — Mandate, Zahlungen, Eingänge, Bauplan-Etappen sind Business, Meilensteine
 * nach ihrem Space. `fuer` (K6a): wer zuständig ist (Mandat: `zustaendig`) — ohne Angabe der ganze Haushalt (Glocke).
 * `kuendigung` (K6a): die Frist ist eine Kündigungsfrist (Glocke/Heute melden sie mit Vorlauf).
 */
export interface Frist { id: string; art: FristArt; tag: string; titel: string; unter?: string; href: string; erledigt?: boolean; bereich: 'privat' | 'business'; fuer?: string; kuendigung?: true;
  /** Review eines Mandats — führt als Follow-up `v:review`; hier nur für die Kalenderansicht (F2 M1). */
  review?: true }
export interface Erinnerung { id: string; tag: string; zeit?: string; titel: string; liste?: string }

/** Pflicht-Hinweis an jedem Steuertermin aus der Vorlage (Kevin 29.09., Zusatzthema #11). */
export const STEUER_HINWEIS = 'Hinweis, keine Steuerberatung; Termine gegen BMF-Steuerkalender prüfen';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const imZeitraum = (tag: string | undefined, von: string, bis: string): tag is string => !!tag && TAG.test(tag.slice(0, 10)) && tag.slice(0, 10) >= von && tag.slice(0, 10) < bis;
const eur = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : undefined);
const kurzTag = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
/** Fällt eine Zahlungsfrist auf Wochenende/Feiertag NRW, zählt der nächste Werktag (§ 193 BGB) — als Hinweis, der Tag bleibt. */
const werktagHinweis = (tag: string): string | undefined => { const w = werktagAbOder(tag); return w !== tag ? `zählt bis ${kurzTag(w)} (nächster Werktag)` : undefined; };

export interface Quellen {
  meilensteine?: { id: string; titel: string; faellig?: string; erledigt?: boolean; bereich?: string; space?: string; wartetAuf?: string[] }[];
  etappen?: { id: string; name: string; ziel?: string }[];
  mandate?: ({ id: string; kunde: string; titel?: string; status?: string; naechstesReview?: string; zustaendig?: string } & Partial<MandatFristFelder>)[];
  zahlungen?: { id: string; an?: string; titel?: string; betrag?: number; status?: string; faellig?: string }[];
  rechnungen?: { id: string; kunde?: string; titel?: string; betrag?: number; status?: string; faellig?: string }[];
  /** K6a (Verbindung 7): gesetzliche Frist offener Betroffenenanträge (Art. 12 Abs. 3 DSGVO) — ohne Namen im Titel. */
  antraege?: { id: string; art: string; frist: string; status: string }[];
  /** K6a: „gültig bis“ gestellter Angebote. */
  angebote?: { id: string; titel: string; status: string; gueltigBis: string }[];
  /** K6a (Verbindung 4): „Entscheidung bis“ offener Deals (`erwartetAm`) — Zuständig = Besitzer. */
  deals?: { id: string; titel: string; stufe: string; erwartetAm?: string; besitzer?: string; offen: boolean }[];
  /** Steuertermine aus der Vorlage (nur wenn in den Kalender-Einstellungen eingeschaltet) — ohne Beträge. */
  steuer?: { datum: string; art: string; titel: string; hinweis: string; privat?: boolean }[];
}

/** Alle Stichtage im Zeitraum [von, bis) — Berliner Tage. `heute` für die laufende Periode eines Mandats (Verlängerung). */
export function fristen(q: Quellen, von: string, bis: string, heute: string = von): Frist[] {
  const raus: Frist[] = [];
  for (const m of q.meilensteine ?? []) {
    // Kette (01.10.): wartet er noch auf einen offenen Vorgänger, sagt es der Titel — so auch in Glocke und Heute (eine Frist, keine zweite Meldung).
    const wartet = wartetText(m, q.meilensteine ?? []);
    if (imZeitraum(m.faellig, von, bis)) raus.push({ id: `ms-${m.id}`, art: 'meilenstein', tag: m.faellig.slice(0, 10), titel: wartet ? `${m.titel} — ${wartet}` : m.titel, unter: m.bereich, href: `/os/planung/jahr?m=${encodeURIComponent(m.id)}`, erledigt: !!m.erledigt, bereich: (m.space ?? m.bereich) === 'business' ? 'business' : 'privat' });
  }
  for (const e of q.etappen ?? []) {
    if (imZeitraum(e.ziel, von, bis)) raus.push({ id: `et-${e.id}`, art: 'etappe', tag: e.ziel, titel: e.name, unter: 'Bauplan-Etappe', href: '/os/bauplan?s=plan', bereich: 'business' });
  }
  for (const m of q.mandate ?? []) {
    if (m.status && !['aktiv', 'pausiert'].includes(m.status)) continue;
    const name = m.kunde || m.titel || 'Mandat';
    const fuer = m.zustaendig ? { fuer: m.zustaendig } : {};
    // EINE Rechnung für Periodenende und Kündigungsfrist (lib/crm/kunden.ts `mandatFristen`, K6a — Befund 6).
    const f = mandatFristen(m, heute);
    if (imZeitraum(f.endeAm ?? undefined, von, bis)) raus.push({ id: `md-ende-${m.id}`, art: 'mandat', tag: f.endeAm!, titel: m.ende ? `Mandat endet: ${name}` : `Laufzeit-Ende: ${name}`, ...(m.ende ? {} : { unter: m.verlaengerung === 'auto' ? 'verlängert sich sonst automatisch' : 'nach der Mindestlaufzeit' }), href: WEG.mandat(m.id), bereich: 'business', ...fuer });
    if (imZeitraum(f.frist ?? undefined, von, bis)) raus.push({ id: `md-frist-${m.id}`, art: 'mandat', tag: f.frist!, titel: `Kündigungsfrist: ${name}`, unter: `${m.kuendigungsfristTage} Tage vor Ende ${kurzTag(f.endeAm!)}`, href: WEG.mandat(m.id), bereich: 'business', kuendigung: true, ...fuer });
    // Review: dieselbe Regel wie das Follow-up `v:review` (`reviewZaehlt` — pausiert zählt nicht, F2 M1).
    if (reviewZaehlt(m) && imZeitraum(m.naechstesReview, von, bis)) raus.push({ id: `md-review-${m.id}`, art: 'mandat', tag: m.naechstesReview.slice(0, 10), titel: `Review: ${name}`, href: WEG.mandat(m.id), bereich: 'business', review: true, ...fuer });
  }
  for (const z of q.zahlungen ?? []) {
    if (z.status === 'bezahlt' || z.status === 'erledigt') continue;
    if (imZeitraum(z.faellig, von, bis)) raus.push({ id: `za-${z.id}`, art: 'zahlung', tag: z.faellig.slice(0, 10), titel: `Zahlung: ${z.an || z.titel || '—'}`, unter: [z.titel && z.an ? z.titel : undefined, eur(z.betrag), werktagHinweis(z.faellig.slice(0, 10))].filter(Boolean).join(' · ') || undefined, href: '/os/finanzen', bereich: 'business' });
  }
  for (const r of q.rechnungen ?? []) {
    // Nur gestellte Rechnungen: da wartet Geld. Geplante sind noch keine Frist.
    if (r.status && r.status !== 'gestellt' && r.status !== 'offen') continue;
    if (imZeitraum(r.faellig, von, bis)) raus.push({ id: `re-${r.id}`, art: 'eingang', tag: r.faellig.slice(0, 10), titel: `Zahlungseingang: ${r.kunde || r.titel || '—'}`, unter: [r.titel && r.kunde ? r.titel : undefined, eur(r.betrag), werktagHinweis(r.faellig.slice(0, 10))].filter(Boolean).join(' · ') || undefined, href: '/os/finanzen', bereich: 'business' });
  }
  // CRM-Fristen (K6a, Verbindung 4/7): DSGVO-Anträge (ohne Namen), Angebote „gültig bis“, Deals „Entscheidung bis“.
  for (const a of q.antraege ?? []) {
    if (a.status === 'offen' && imZeitraum(a.frist, von, bis)) raus.push({ id: `ds-${a.id}`, art: 'dsgvo', tag: a.frist.slice(0, 10), titel: `DSGVO-Antrag (${a.art}): Frist`, unter: 'Art. 12 Abs. 3 DSGVO — Hinweis, keine Rechtsberatung', href: WEG.stammdaten('datenschutz'), bereich: 'business' });
  }
  for (const a of q.angebote ?? []) {
    if (a.status === 'gestellt' && imZeitraum(a.gueltigBis, von, bis)) raus.push({ id: `an-${a.id}`, art: 'angebot', tag: a.gueltigBis.slice(0, 10), titel: `Angebot gültig bis: ${a.titel}`, href: WEG.angebot({ angebotId: a.id }), bereich: 'business' });
  }
  for (const d of q.deals ?? []) {
    if (d.offen && imZeitraum(d.erwartetAm, von, bis)) raus.push({ id: `dl-${d.id}`, art: 'deal', tag: d.erwartetAm.slice(0, 10), titel: `Entscheidung erwartet: ${d.titel}`, href: WEG.deal(d.id), bereich: 'business', ...(d.besitzer ? { fuer: d.besitzer } : {}) });
  }
  // Steuertermine (Vorlage, Zusatzthema #11): schon auf den Werktag geschoben (§ 108 AO), nie mit Betrag.
  for (const s of q.steuer ?? []) {
    if (imZeitraum(s.datum, von, bis)) raus.push({ id: `st-${s.art}-${s.datum}`, art: 'steuer', tag: s.datum.slice(0, 10), titel: s.titel, unter: `${s.hinweis} · ${STEUER_HINWEIS}`, href: WEG.steuern('fristen'), bereich: s.privat ? 'privat' : 'business' });
  }
  return raus.sort((a, b) => a.tag.localeCompare(b.tag) || a.titel.localeCompare(b.titel));
}

/**
 * Fälligkeit einer Erinnerung → Berliner Wandzeit (R-K1 #8): ein reines Datum bleibt der Tag (ohne Uhrzeit — nicht als
 * UTC-Mitternacht gelesen, sonst stünde „02:00“ daran), eine Wandzeit ohne Zone gilt als Berliner Zeit, nur ein Wert mit
 * Zone („Z“, „+02:00“) wird umgerechnet. Unlesbar → null.
 */
export function faelligWand(due: string, wand: (d: Date) => string): string | null {
  const s = due.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00`;
  const ohneZone = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(s);
  if (ohneZone) return `${ohneZone[1]}T${ohneZone[2]}:${ohneZone[3]}:${ohneZone[4] ?? '00'}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : wand(d);
}

/** Apple-Erinnerungen (vom Mac zugeliefert) mit Datum im Zeitraum. */
export function erinnerungen(roh: unknown, von: string, bis: string, wand: (d: Date) => string): Erinnerung[] {
  if (!Array.isArray(roh)) return [];
  const raus: Erinnerung[] = [];
  for (const r of roh as { id?: string; title?: string; due?: string; list?: string }[]) {
    if (!r?.title || !r.due) continue;
    const w = faelligWand(String(r.due), wand);
    if (!w) continue;
    const tag = w.slice(0, 10);
    if (tag < von || tag >= bis) continue;
    raus.push({ id: `er-${r.id ?? `${tag}-${r.title}`}`, tag, ...(w.slice(11, 16) !== '00:00' ? { zeit: w.slice(11, 16) } : {}), titel: String(r.title).slice(0, 200), ...(r.list ? { liste: String(r.list).slice(0, 80) } : {}) });
  }
  return raus;
}

/**
 * Was eine Person von Fristen und Apple-Erinnerungen sieht (S1 #20, 29.09., rein) — serverseitig statt nur im Browser:
 *   · Apple-Erinnerungen kommen vom Mac des Inhabers (sein Apple-Konto, wie Postfach und Adressbuch: `nurInhaber`) —
 *     nur der Inhaber sieht sie; andere Personen des Haushalts bekommen keine.
 *   · Private Fristen (`bereich: 'privat'`: private Meilensteine, private Steuertermine) nur für Personen mit
 *     eingetragenem Haushalt (Regel der Haushaltsfinanzen, `haushaltFuer`) — Business-Fristen sieht der ganze Haushalt
 *     des Inhabers (wie bisher, `fuer` nennt nur die Zuständige).
 */
export function fuerPersonFiltern<F extends Pick<Frist, 'bereich'>, E>(x: { fristen: F[]; erinnerungen: E[] }, recht: { inhaber: boolean; privat: boolean }): { fristen: F[]; erinnerungen: E[] } {
  return {
    fristen: recht.privat ? x.fristen : x.fristen.filter(f => f.bereich !== 'privat'),
    erinnerungen: recht.inhaber ? x.erinnerungen : [],
  };
}

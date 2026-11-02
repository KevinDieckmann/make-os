// ─── Buchhaltung — ein vorbereitetes Buchhaltungs-Paket einlesen (02.11., rein) ─────────────────────────────────────────────────────────
// Kevin 02.11.: Die Kontoauszüge (CSV-Statement-Export der Bank) werden über den vorhandenen Kontoauszug-Weg eingelesen; ein vorbereitetes Paket legt dann für
// jede Buchung einen VORSCHLAG an (Kategorie, Frage, Notiz, Beleg, Bewirtung) und bringt Regeln mit — ein Mensch gibt in „Zu prüfen“ frei.
// Format (`art: 'make-buchhaltung-paket'`, `version: 1`) steht in `Paket`. Regeln:
//   • erst Vorschau (nichts geschrieben), dann „Übernehmen“ — derselbe Plan, idempotent (zweimal einlesen ändert nichts mehr),
//   • eine Kategorie von Hand (`kategorieHand`) oder eine schon bestätigte Prüfung wird NIE überschrieben; Notiz/Beleg/Bewirtung füllen nur Lücken,
//   • Zuordnung Eintrag → Buchung: eigenes Konto (IBAN → Konten-Register) + Datum + Betrag auf den Cent; mehrere Kandidaten → die mit passender
//     Gegenseite; gleiche Doppelte der Reihe nach (jede Buchung höchstens einmal),
//   • Grenzen → 413 (nie gekürzt), unbekannte Kategorie/Gesellschaft → 400, Gesellschaft außerhalb der Sicht → 403.

import { suchNorm } from '@/lib/text/such-norm';
import { istGesellschaft } from '@/lib/einheiten';
import { ibanGrundform } from '@/lib/crm/zahlung';
import { istKalendertag } from '@/lib/zeit';
import { BUSINESS_PRAEFIX, kontoMarke } from '@/lib/finanzen/kontoauszug/plan';
import { kategorieSauber, kategorienFuer, ohneSteuerzeichen } from './kategorien';
import { MUSTER_MAX, regelPruefen, type BuchungsRegel, type RegelBestand } from './regeln';
import { belegHinweisSauber, bewirtungSauber, frageSauber, type BelegHinweis, type Bewirtung, type PruefFrage } from './pruefung';
import type { BhBuchung } from './arbeitsliste';
import { NOTIZ_MAX } from './teil';

export const PAKET_ART = 'make-buchhaltung-paket';
export const PAKET_EINTRAEGE_MAX = 10_000;
export const PAKET_REGELN_MAX = 500;
const GEGENSEITE_MAX = 200;

export interface PaketRegel { gesellschaft: string; muster: { gegenseite?: string; zweck?: string }; kategorie: string; notiz?: string }
export interface PaketEintrag {
  gesellschaft: string; konto: string; datum: string; betragCent: number; gegenseite: string;
  kategorie?: string; notiz?: string; frage?: PruefFrage; beleg?: BelegHinweis; bewirtung?: Bewirtung;
}
export interface Paket { art: typeof PAKET_ART; version: 1; erstellt: string; regeln: PaketRegel[]; eintraege: PaketEintrag[] }

export type PaketPruefung = { ok: true; paket: Paket } | { ok: false; status: 400 | 403 | 413; fehler: string };
const nein = (status: 400 | 403 | 413, fehler: string): PaketPruefung => ({ ok: false, status, fehler });
const wo = (art: 'Regel' | 'Eintrag', i: number) => `${art} ${i + 1}`;

/**
 * Prüft das Paket vollständig, bevor irgendetwas zugeordnet wird. `orteErlaubt` = Gesellschaften der Sicht (Business-Konto: nur Business-
 * Gesellschaften), `eigene` = eigene Kategorien des Haushalts.
 */
export function paketPruefen(roh: unknown, ctx: { orteErlaubt: (o: string) => boolean; eigene?: readonly string[] }): PaketPruefung {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return nein(400, 'Das ist kein Buchhaltungs-Paket — nichts eingelesen.');
  const o = roh as Record<string, unknown>;
  if (o.art !== PAKET_ART) return nein(400, `Das ist kein Buchhaltungs-Paket („art“ muss „${PAKET_ART}“ sein) — nichts eingelesen.`);
  if (o.version !== 1) return nein(400, 'Diese Fassung des Pakets kennt MAKE OS nicht (nur „version“: 1) — nichts eingelesen.');
  const erstellt = typeof o.erstellt === 'string' && istKalendertag(o.erstellt) ? o.erstellt : null;
  if (!erstellt) return nein(400, '„erstellt“ muss ein Tag (JJJJ-MM-TT) sein — nichts eingelesen.');
  const regelnRoh = o.regeln === undefined ? [] : o.regeln;
  const eintraegeRoh = o.eintraege === undefined ? [] : o.eintraege;
  if (!Array.isArray(regelnRoh) || !Array.isArray(eintraegeRoh)) return nein(400, '„regeln“ und „eintraege“ müssen Listen sein — nichts eingelesen.');
  if (regelnRoh.length > PAKET_REGELN_MAX) return nein(413, `Höchstens ${PAKET_REGELN_MAX} Regeln je Paket (jetzt ${regelnRoh.length}) — gekürzt wird nie, nichts eingelesen.`);
  if (eintraegeRoh.length > PAKET_EINTRAEGE_MAX) return nein(413, `Höchstens ${PAKET_EINTRAEGE_MAX.toLocaleString('de-DE')} Einträge je Paket (jetzt ${eintraegeRoh.length.toLocaleString('de-DE')}) — gekürzt wird nie, nichts eingelesen.`);
  const erlaubt = kategorienFuer(ctx.eigene ?? []);
  const kat = (v: unknown): string | null => { const k = kategorieSauber(v); return k ? erlaubt.find(x => x.localeCompare(k, 'de', { sensitivity: 'base' }) === 0) ?? null : null; };
  const ort = (v: unknown, w: string): string | PaketPruefung => {
    if (!istGesellschaft(v)) return nein(400, `${w}: „gesellschaft“ ist keine Gesellschaft dieser Instanz — nichts eingelesen.`);
    if (!ctx.orteErlaubt(v)) return nein(403, `${w}: diese Gesellschaft gehört nicht zu deiner Sicht — nichts eingelesen.`);
    return v;
  };
  const txt = (v: unknown, max: number, w: string, feld: string): string | undefined | PaketPruefung => {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== 'string') return nein(400, `${w}: „${feld}“ muss Text sein — nichts eingelesen.`);
    const t = ohneSteuerzeichen(v.normalize('NFC').replace(/\r?\n/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t.length > max) return nein(413, `${w}: „${feld}“ ist zu lang (höchstens ${max} Zeichen) — gekürzt wird nie, nichts eingelesen.`);
    return t || undefined;
  };
  const fehler = (x: unknown): x is PaketPruefung => !!x && typeof x === 'object' && 'ok' in (x as object);

  const regeln: PaketRegel[] = [];
  for (let i = 0; i < regelnRoh.length; i++) {
    const r = regelnRoh[i] as Record<string, unknown> | null;
    const w = wo('Regel', i);
    if (!r || typeof r !== 'object') return nein(400, `${w} hat die falsche Form — nichts eingelesen.`);
    const g = ort(r.gesellschaft, w); if (fehler(g)) return g;
    const m = r.muster && typeof r.muster === 'object' ? r.muster as Record<string, unknown> : null;
    if (!m) return nein(400, `${w}: „muster“ fehlt — nichts eingelesen.`);
    const gegenseite = txt(m.gegenseite, MUSTER_MAX, w, 'muster.gegenseite'); if (fehler(gegenseite)) return gegenseite;
    const zweck = txt(m.zweck, MUSTER_MAX, w, 'muster.zweck'); if (fehler(zweck)) return zweck;
    if (!gegenseite && !zweck) return nein(400, `${w}: „muster“ braucht „gegenseite“ oder „zweck“ — nichts eingelesen.`);
    if (gegenseite && zweck) return nein(400, `${w}: bitte nur EIN Muster (gegenseite ODER zweck) je Regel — sonst zwei Regeln. Nichts eingelesen.`);
    const k = kat(r.kategorie); if (!k) return nein(400, `${w}: die Kategorie „${String(r.kategorie ?? '')}“ gibt es nicht — nichts eingelesen.`);
    const notiz = txt(r.notiz, NOTIZ_MAX, w, 'notiz'); if (fehler(notiz)) return notiz;
    regeln.push({ gesellschaft: g as string, muster: gegenseite ? { gegenseite } : { zweck: zweck as string }, kategorie: k, ...(notiz ? { notiz } : {}) });
  }

  const eintraege: PaketEintrag[] = [];
  for (let i = 0; i < eintraegeRoh.length; i++) {
    const e = eintraegeRoh[i] as Record<string, unknown> | null;
    const w = wo('Eintrag', i);
    if (!e || typeof e !== 'object') return nein(400, `${w} hat die falsche Form — nichts eingelesen.`);
    const g = ort(e.gesellschaft, w); if (fehler(g)) return g;
    const konto = typeof e.konto === 'string' ? ibanGrundform(e.konto) : '';
    if (konto.length < 15) return nein(400, `${w}: „konto“ muss die IBAN des eigenen Kontos sein — nichts eingelesen.`);
    if (typeof e.datum !== 'string' || !istKalendertag(e.datum)) return nein(400, `${w}: „datum“ muss ein Tag (JJJJ-MM-TT) sein — nichts eingelesen.`);
    if (typeof e.betragCent !== 'number' || !Number.isSafeInteger(e.betragCent) || e.betragCent === 0) return nein(400, `${w}: „betragCent“ muss eine ganze Zahl in Cent sein (nicht 0) — nichts eingelesen.`);
    const gegenseite = txt(e.gegenseite, GEGENSEITE_MAX, w, 'gegenseite'); if (fehler(gegenseite)) return gegenseite;
    let kategorie: string | undefined;
    if (e.kategorie !== undefined && e.kategorie !== null && e.kategorie !== '') {
      const k = kat(e.kategorie); if (!k) return nein(400, `${w}: die Kategorie „${String(e.kategorie)}“ gibt es nicht — nichts eingelesen.`);
      kategorie = k;
    }
    const notiz = txt(e.notiz, NOTIZ_MAX, w, 'notiz'); if (fehler(notiz)) return notiz;
    const frage = frageSauber(e.frage); if (!frage.ok) return nein(frage.status, `${w}: ${frage.fehler}`);
    const beleg = belegHinweisSauber(e.beleg); if (!beleg.ok) return nein(beleg.status, `${w}: ${beleg.fehler}`);
    const bewirtung = bewirtungSauber(e.bewirtung); if (!bewirtung.ok) return nein(bewirtung.status, `${w}: ${bewirtung.fehler}`);
    eintraege.push({
      gesellschaft: g as string, konto, datum: e.datum, betragCent: e.betragCent, gegenseite: (gegenseite as string | undefined) ?? '',
      ...(kategorie ? { kategorie } : {}), ...(notiz ? { notiz: notiz as string } : {}), ...(frage.wert ? { frage: frage.wert } : {}),
      ...(beleg.wert ? { beleg: beleg.wert } : {}), ...(bewirtung.wert ? { bewirtung: bewirtung.wert } : {}),
    });
  }
  const paket: Paket = { art: PAKET_ART, version: 1, erstellt, regeln, eintraege };
  const rf = paketRegelFehler(paket)[0];
  if (rf) return nein(400, `Regel ${rf.nr}: ${rf.fehler.replace(/ Nichts gespeichert\.$| — nichts gespeichert\.$/, '')} — nichts eingelesen.`);
  return { ok: true, paket };
}

/** Ein eigenes Konto aus dem Register (nur, was die Zuordnung braucht). */
export interface PaketKonto { id: string; name: string; iban: string; ort: string }

export interface OhneBuchung { nr: number; datum: string; betragCent: number; gegenseite: string; grund: string }
export interface PaketPlan {
  /** Kennung → neue Fassung (nur, was sich wirklich ändert). */
  aenderungen: Map<string, BhBuchung>;
  zugeordnet: number;
  unveraendert: number;
  /** Kategorie von Hand bzw. Prüfung schon bestätigt — der Vorschlag des Pakets bleibt außen vor. */
  handBehalten: number;
  ohneBuchung: OhneBuchung[];
  regelnNeu: BuchungsRegel[];
  regelnGeaendert: BuchungsRegel[];
  regelnGleich: number;
}

const cent = (b: Pick<BhBuchung, 'betrag'>) => Math.round(Number(b.betrag) * 100);
const gegenseitePasst = (wer: string, g: string) => { const a = suchNorm(wer).trim(), b = suchNorm(g).trim(); return !!a && !!b && (a.includes(b) || b.includes(a)); };
const regelSchluessel = (r: Pick<BuchungsRegel, 'ort' | 'feld' | 'muster'>) => `${r.ort ?? ''}|${r.feld}|${suchNorm(r.muster).trim()}`;
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Ein Eintrag auf eine Buchung angewandt (Hand gewinnt, Lücken füllen). Liefert die neue Fassung und ob die Kategorie von Hand blieb. */
export function eintragAnwenden(b: BhBuchung, e: PaketEintrag): { neu: BhBuchung; handBehalten: boolean } {
  const neu: BhBuchung = { ...b };
  const fest = !!b.kategorieHand || b.pruefung?.status === 'bestaetigt';
  if (!fest && (e.kategorie || e.frage)) {
    const p = { ...(b.pruefung ?? {}), status: 'offen' as const };
    if (e.kategorie) p.vorschlag = e.kategorie;
    if (e.frage) p.frage = e.frage;
    neu.pruefung = p;
  }
  if (e.notiz && !b.notiz) neu.notiz = e.notiz;
  if (e.beleg && !b.belegHinweis) neu.belegHinweis = e.beleg;
  if (e.bewirtung) {
    const w = { ...(b.bewirtung ?? {}) };
    if (e.bewirtung.anlass && !w.anlass) w.anlass = e.bewirtung.anlass;
    if (e.bewirtung.teilnehmer && !w.teilnehmer) w.teilnehmer = e.bewirtung.teilnehmer;
    if (w.anlass || w.teilnehmer) neu.bewirtung = w;
  }
  return { neu, handBehalten: fest && !!e.kategorie && e.kategorie !== b.kategorie };
}

/**
 * Der Plan des Pakets gegen den Bestand: was würde sich ändern? (Vorschau UND Übernahme rechnen genau das — die Übernahme frisch in der Sperre.)
 * `neueId` vergibt Kennungen neuer Regeln (nur Übernahme braucht sie stabil; die Vorschau zeigt sie nicht).
 */
export function paketPlanen(paket: Paket, ctx: { buchungen: readonly BhBuchung[]; konten: readonly PaketKonto[]; regeln: RegelBestand; jetzt: string; neueId: () => string }): PaketPlan {
  const nachIban = new Map(ctx.konten.filter(k => k.iban).map(k => [ibanGrundform(k.iban), k]));
  const benutzt = new Set<string>();
  const aenderungen = new Map<string, BhBuchung>();
  const ohneBuchung: OhneBuchung[] = [];
  let zugeordnet = 0, unveraendert = 0, handBehalten = 0;

  paket.eintraege.forEach((e, nr) => {
    const ohne = (grund: string) => ohneBuchung.push({ nr: nr + 1, datum: e.datum, betragCent: e.betragCent, gegenseite: e.gegenseite, grund });
    const k = nachIban.get(e.konto);
    if (!k) return ohne('Konto nicht im Konten-Register');
    if (k.ort !== e.gesellschaft) return ohne('Konto gehört zu einer anderen Gesellschaft');
    const marke = `${BUSINESS_PRAEFIX}${kontoMarke(k.id)}-`;
    const kandidaten = ctx.buchungen.filter(b => !benutzt.has(b.id) && b.ort === e.gesellschaft && b.datum === e.datum && cent(b) === e.betragCent
      && (b.konto === k.name || b.id.startsWith(marke)));
    if (!kandidaten.length) return ohne('keine Buchung mit diesem Konto, Tag und Betrag');
    const passend = kandidaten.filter(b => gegenseitePasst(b.wer, e.gegenseite));
    const wahl = (passend.length ? passend : kandidaten).slice().sort((a, b) => a.id.localeCompare(b.id))[0];
    benutzt.add(wahl.id);
    zugeordnet++;
    const basis = aenderungen.get(wahl.id) ?? wahl;
    const r = eintragAnwenden(basis, e);
    if (r.handBehalten) handBehalten++;
    if (gleich(r.neu, wahl)) unveraendert++;
    else aenderungen.set(wahl.id, r.neu);
  });

  // Regeln: gleicher Schlüssel (Gesellschaft, Feld, Suchtext) = dieselbe Regel; andere Kategorie/Notiz → geändert, sonst gleich (idempotent).
  const vorhanden = new Map(ctx.regeln.regeln.map(r => [regelSchluessel(r), r]));
  const regelnNeu: BuchungsRegel[] = [], regelnGeaendert: BuchungsRegel[] = [];
  let regelnGleich = 0;
  for (const pr of paket.regeln) {
    const feld = pr.muster.gegenseite ? 'wer' : 'zweck';
    const muster = (pr.muster.gegenseite ?? pr.muster.zweck)!;
    const schl = regelSchluessel({ ort: pr.gesellschaft, feld, muster });
    const alt = vorhanden.get(schl) ?? regelnNeu.find(r => regelSchluessel(r) === schl);
    if (alt) {
      if (alt.kategorie === pr.kategorie && (alt.notiz ?? undefined) === (pr.notiz ?? undefined)) { regelnGleich++; continue; }
      const neu = { ...alt, kategorie: pr.kategorie, ...(pr.notiz ? { notiz: pr.notiz } : {}) };
      if (!pr.notiz) delete neu.notiz;
      if (regelnNeu.includes(alt)) regelnNeu[regelnNeu.indexOf(alt)] = neu; else regelnGeaendert.push(neu);
      continue;
    }
    const r = regelPruefen({ ort: pr.gesellschaft, feld, muster, kategorie: pr.kategorie }, { id: ctx.neueId(), jetzt: ctx.jetzt, erlaubteOrte: () => true });
    if (!r.ok) continue; // geprüft in paketPruefen
    regelnNeu.push({ ...r.wert, ...(pr.notiz ? { notiz: pr.notiz } : {}) });
  }
  return { aenderungen, zugeordnet, unveraendert, handBehalten, ohneBuchung, regelnNeu, regelnGeaendert, regelnGleich };
}

/** Regeln, die `regelPruefen` ablehnt (z. B. „Umbuchung“ — die ergibt sich aus dem Gegenkonto): vor dem Planen sichtbar machen. */
export function paketRegelFehler(paket: Paket): { nr: number; fehler: string }[] {
  const raus: { nr: number; fehler: string }[] = [];
  paket.regeln.forEach((pr, i) => {
    const r = regelPruefen({ ort: pr.gesellschaft, feld: pr.muster.gegenseite ? 'wer' : 'zweck', muster: pr.muster.gegenseite ?? pr.muster.zweck, kategorie: pr.kategorie }, { id: 'br-pruefen', jetzt: '', erlaubteOrte: () => true });
    if (!r.ok) raus.push({ nr: i + 1, fehler: r.fehler });
  });
  return raus;
}

/** Zusammenfassung für die Vorschau (ohne Inhalte der Buchungen). */
export const paketSatz = (p: PaketPlan): string =>
  `${p.zugeordnet} zugeordnet (${p.aenderungen.size} mit Änderung), ${p.ohneBuchung.length} ohne Buchung, ${p.regelnNeu.length + p.regelnGeaendert.length} Regeln neu/geändert`;

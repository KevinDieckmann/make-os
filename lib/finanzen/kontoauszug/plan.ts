// ─── Kontoauszug einlesen — Zuordnung, Dublettenschutz, Vorschau-Plan (09.10., rein: Server UND Browser) ───────────────────────────────
// Ein gelesener Auszug wird EINEM Konto des Konten-Registers zugeordnet; daraus werden (a) der Saldo als Stand (`quelle: 'bank'`) und (b) die
// gebuchten Umsätze als Buchungen des passenden Bereichs:
//   • Konto privat/gemeinsam → Haushalt (`haushalt-buchungen--<h>`, ein Haushalts-Konto, Einordnung über die Regeln des Haushalts),
//   • Konto einer Gesellschaft → Business-Buchungen (`buchungen`, Feld `ort`) — die Selbstständigkeit ebenso (dort im Privat-Bereich gezeigt).
// Immer Vorschau → Bestätigen → Rückgängig. Der Plan ist rein; `basis` = Kennung GENAU dieser Vorschau (Übernehmen nur damit, sonst 409).
//
// Dublettenschutz (ein zweiter Import derselben Datei legt nichts doppelt an):
//   1. externe Kennung der Bank (CAMT `AcctSvcrRef`, CSV „Transaktions-ID“) — nur, wenn sie in der Datei eindeutig ist,
//   2. Fingerabdruck aus (Datum, Betrag, Gegenseite, Zweck) als MENGE: zwei gleiche Kaffees am selben Tag sind zwei Buchungen; schon da ist
//      nur, was im Bestand mindestens so oft vorkommt (auch von Hand erfasste oder mit dem bisherigen Haushalts-Import eingelesene Zeilen),
//   3. im Haushalt zusätzlich der Fingerabdruck des bisherigen Imports (`zeilen_hash`, lib/finanzen/haushalt/import.ts) — kompatibel.
// Business-Buchungen bekommen eine feste Kennung `bu-ka-<Konto>-<Schlüssel>` (idempotent wie `bu-re-<id>`).

import { centZuEuro, kurzHash, vergleichsText } from './text';
import type { Auszug, AuszugEintrag, LeseErgebnis, Pruefsumme } from './typen';
import { ibanGrundform, ibanMaskiert } from '@/lib/crm/zahlung';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { N26_KATEGORIEN, istUmbuchungText, katIdFinder, vorbereiten, type Entwurf, type Rohbuchung } from '@/lib/finanzen/haushalt/import';
import type { Buchung as HaushaltBuchung, Einheit, Regel } from '@/lib/finanzen/haushalt/typen';
import { einordnen, katNamen, type Einordnung } from '@/lib/finanzen/haushalt/einordnung';

// ── Zuordnung Datei → Konto ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KontoKurz { id: string; name: string; iban?: string }

export type Zuordnung =
  | { ok: true; auszug: Auszug; hinweise: string[] }
  | { ok: false; status: 400 | 409; fehler: string; anderesKonto?: { id: string; name: string } };

/**
 * Welcher Auszug der Datei gehört zum gewählten Konto? Per IBAN (Grundform), sonst — wenn die Datei nur ein Konto enthält — per Wahl. Nennt die
 * Datei die IBAN eines ANDEREN Kontos im Register, wird nicht still ins falsche Konto gebucht (409 mit dem passenden Konto).
 */
export function auszugZuordnen(l: Extract<LeseErgebnis, { ok: true }>, konto: KontoKurz, andere: readonly KontoKurz[]): Zuordnung {
  const meine = konto.iban ? ibanGrundform(konto.iban) : undefined;
  const hinweise: string[] = [];
  const treffer = meine ? l.auszuege.find(a => a.iban === meine) : undefined;
  if (treffer) return { ok: true, auszug: treffer, hinweise };
  if (l.auszuege.length === 1) {
    const a = l.auszuege[0];
    if (a.iban && meine && a.iban !== meine) {
      const anderes = andere.find(k => k.iban && ibanGrundform(k.iban) === a.iban);
      return anderes
        ? { ok: false, status: 409, fehler: `Dieser Auszug gehört zum Konto „${anderes.name}“ (IBAN ${ibanMaskiert(a.iban)}) — dort einlesen.`, anderesKonto: { id: anderes.id, name: anderes.name } }
        : { ok: false, status: 409, fehler: `Der Auszug gehört zu IBAN ${ibanMaskiert(a.iban)}, das Konto „${konto.name}“ hat eine andere — nichts übernommen.` };
    }
    if (a.iban && !meine) {
      const anderes = andere.find(k => k.iban && ibanGrundform(k.iban) === a.iban);
      if (anderes) return { ok: false, status: 409, fehler: `Dieser Auszug gehört zum Konto „${anderes.name}“ (IBAN ${ibanMaskiert(a.iban)}) — dort einlesen.`, anderesKonto: { id: anderes.id, name: anderes.name } };
      hinweise.push(`Die Datei nennt IBAN ${ibanMaskiert(a.iban)}; am Konto ist keine hinterlegt — zugeordnet nach deiner Wahl.`);
    }
    if (!a.iban) hinweise.push('Die Datei nennt keine IBAN — zugeordnet nach deiner Wahl.');
    return { ok: true, auszug: a, hinweise };
  }
  const anzahl = l.auszuege.length;
  return { ok: false, status: 400, fehler: meine
    ? `Die Datei enthält ${anzahl} Konten, aber keins mit der IBAN von „${konto.name}“.`
    : `Die Datei enthält ${anzahl} Konten — bitte am Konto die IBAN hinterlegen, dann wird das richtige gewählt.` };
}

// ── Ziel und Bestand ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Wohin die Umsätze gehen. `keins`: nur der Saldo (z. B. Gesellschafts-Konto außerhalb des Inhaber-Haushalts). */
export type Ziel =
  | { art: 'haushalt'; haushaltKontoId: string; kontoName: string; neu: boolean; /** Vorhandenes Haushalts-Konto, das jetzt mit dem Register-Konto verknüpft wird. */ verknuepfen?: boolean; einheit: Einheit }
  | { art: 'business'; ort: Gesellschaftskennung }
  | { art: 'keins'; grund: string };

/** Eine Buchung des Business-Bestands (`buchungen`) — so, wie app/api/state/buchungen sie speichert. */
export interface BusinessBuchung {
  id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string; konto?: string; ort?: string; rechnungId?: string;
  /** Lauf des Kontoauszug-Imports, der sie angelegt hat (nur Rückgängig; optional). */
  auszug?: string;
}

export interface PlanZeile {
  /** Index im Auszug (`eintraege`). */
  i: number;
  /** Zeile in der Datei bzw. Nummer des Eintrags. */
  nr: number;
  datum: string;
  cent: number;
  gegenpartei: string;
  zweck: string;
  status: 'neu' | 'vorhanden' | 'uebersprungen';
  grund?: string;
  /** Dubletten-Schlüssel (`x:<externe Kennung>` oder `f:<Fingerabdruck>#<n>`). */
  schluessel: string;
  /** Eigene Umbuchung (Gegen-IBAN ist ein eigenes Konto im Register). */
  umbuchung?: true;
}

export interface SaldoPlan { cent: number; datum: string; status: 'neu' | 'vorhanden' | 'nicht'; grund?: string; /** Wird er der geltende Stand? */ geltend: boolean }

export interface Plan {
  kontoId: string;
  ziel: Ziel;
  zeilen: PlanZeile[];
  saldo: SaldoPlan | null;
  zahlen: { gelesen: number; neu: number; vorhanden: number; uebersprungen: number };
  /** Haushalt: wie die neuen Buchungen eingeordnet würden (lib/finanzen/haushalt/einordnung.ts) — Einordnung → Anzahl, dazu „ohne Kategorie“. */
  einordnung?: Partial<Record<Einordnung | 'ohneKategorie', number>>;
  zeitraum: { von: string; bis: string } | null;
  pruefung: Pruefsumme | null;
  hinweise: string[];
  /** IBAN der Datei, maskiert. */
  ibanMaskiert?: string;
  /** Kennung genau dieser Vorschau. */
  basis: string;
}

export interface PlanEingabe {
  auszug: Auszug;
  konto: KontoKurz & { staende: readonly { betrag: number; datum: string; zurueckgenommenAm?: string }[] };
  ziel: Ziel;
  /** Ziel `business`: der ganze Bestand `buchungen`. */
  business?: readonly BusinessBuchung[];
  /** Ziel `haushalt`: Buchungen und Regeln/Kategorien des Haushalts. */
  haushalt?: { buchungen: readonly HaushaltBuchung[]; regeln: Regel[]; kategorien: { id: string; name: string }[] };
  /** IBANs der eigenen Konten im Register (Grundform) — Umsätze dorthin sind Umbuchungen. */
  eigeneIbans?: ReadonlySet<string>;
  heute: string;
  /** Weitere Hinweise (Zuordnung). */
  hinweise?: string[];
}

// ── Schlüssel und Fingerabdrücke ─────────────────────────────────────────────────────────────────────────────────────────────────

export const WER_MAX = 120, ZWECK_MAX = 200, BESCHREIBUNG_MAX = 900, EMPFAENGER_MAX = 200;

/** Kurze, stabile Marke des Register-Kontos in den Kennungen seiner Business-Buchungen. */
export const kontoMarke = (kontoId: string): string => kurzHash(`konto|${kontoId}`).slice(0, 6);
export const BUSINESS_PRAEFIX = 'bu-ka-';
/** Kennung einer Business-Buchung aus dem Kontoauszug: fest (idempotent) aus Konto + Dubletten-Schlüssel. */
export const businessId = (kontoId: string, schluessel: string): string => `${BUSINESS_PRAEFIX}${kontoMarke(kontoId)}-${kurzHash(schluessel)}`;
/** Stammt eine Business-Buchung aus dem Kontoauszug eines ANDEREN Kontos? (dann zählt sie für dieses Konto nicht als Dublette) */
const vonAnderemKonto = (id: string, kontoId: string) => id.startsWith(BUSINESS_PRAEFIX) && !id.startsWith(`${BUSINESS_PRAEFIX}${kontoMarke(kontoId)}-`);

const fp = (datum: string, cent: number, wer: string, zweck: string) => kurzHash([datum, Math.round(cent), vergleichsText(wer), vergleichsText(zweck)].join('|'));
/** Fingerabdruck einer gespeicherten Business-Buchung (über die gespeicherten, ggf. gekürzten Felder). */
export const fpBusiness = (b: Pick<BusinessBuchung, 'datum' | 'betrag' | 'wer' | 'zweck'>): string => fp(b.datum, Math.round(Number(b.betrag) * 100), b.wer ?? '', b.zweck ?? '');
/** Fingerabdruck einer gespeicherten Haushalts-Buchung. */
export const fpHaushalt = (b: Pick<HaushaltBuchung, 'datum' | 'betrag' | 'empfaenger' | 'beschreibung'>): string => fp(b.datum, b.betrag, b.empfaenger ?? '', b.beschreibung ?? '');

/** Was ein Umsatz im Business-Bestand wäre (Felder wie gespeichert). */
export function businessFelder(e: AuszugEintrag): { wer: string; zweck: string } {
  return { wer: (e.gegenpartei || e.zweck || 'Buchung').slice(0, WER_MAX), zweck: e.zweck.slice(0, ZWECK_MAX) };
}
/** Rohbuchung für den Haushalt (dieselbe Form wie der bisherige Import — Regeln, Kategorien, `zeilen_hash`). */
export function haushaltRoh(e: AuszugEintrag, umbuchung: boolean): Rohbuchung {
  const beschreibung = e.zweck || e.gegenpartei || 'Buchung';
  const kat = e.kategorie ? N26_KATEGORIEN[e.kategorie.toLowerCase().trim()] ?? e.kategorie : null;
  return { beschreibung, datum: e.datum, betrag: e.cent, empfaenger: e.gegenpartei || beschreibung, n26Kategorie: kat, zahlungsart: null, istUmbuchung: umbuchung || istUmbuchungText(beschreibung) };
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const zaehle = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** Die Vorschau: was neu ist, was schon da ist, was übersprungen wird — und was mit dem Saldo geschieht. Schreibt nichts. */
export function planBauen(x: PlanEingabe): Plan {
  const { auszug, konto, ziel, heute } = x;
  const hinweise = [...(x.hinweise ?? []), ...auszug.hinweise];
  const fremdWaehrung = auszug.waehrung !== 'EUR';
  if (fremdWaehrung) hinweise.push(`Das Konto im Auszug führt ${auszug.waehrung} — es werden nur Euro-Konten übernommen. Nichts übernommen.`);
  if (ziel.art === 'keins') hinweise.push(ziel.grund);
  // Externe Kennungen nur nutzen, wenn sie in der Datei eindeutig sind (manche Banken wiederholen sie).
  const extZahl = new Map<string, number>();
  for (const e of auszug.eintraege) if (e.externeId) zaehle(extZahl, e.externeId);

  // Bestand des Ziels: Kennungen bzw. `zeilen_hash`, Fingerabdrücke als Menge.
  const vorhandenFp = new Map<string, number>();
  const genutzt = new Map<string, number>();
  const idFp = new Map<string, string>();
  let entwuerfe: Entwurf[] = [];
  const geb = auszug.eintraege.map((e, i) => ({ e, i })).filter(({ e }) => e.status === 'gebucht' && e.waehrung === 'EUR');
  const umbuchung = (e: AuszugEintrag) => !!(e.gegenIban && x.eigeneIbans?.has(e.gegenIban));
  if (ziel.art === 'business') {
    for (const b of x.business ?? []) {
      if (b.ort !== ziel.ort || vonAnderemKonto(b.id, konto.id)) continue;
      const f = fpBusiness(b);
      zaehle(vorhandenFp, f);
      idFp.set(b.id, f);
    }
  } else if (ziel.art === 'haushalt') {
    const h = x.haushalt ?? { buchungen: [], regeln: [], kategorien: [] };
    for (const b of h.buchungen) {
      if (b.konto_id !== ziel.haushaltKontoId) continue;
      const f = fpHaushalt(b);
      zaehle(vorhandenFp, f);
      if (b.zeilen_hash) idFp.set(b.zeilen_hash, f);
    }
    // Alle gebuchten Euro-Umsätze in Datei-Reihenfolge — die laufende Nummer im `zeilen_hash` zählt über die ganze Datei (wie bisher).
    entwuerfe = vorbereiten(geb.map(({ e }) => haushaltRoh(e, umbuchung(e))), ziel.haushaltKontoId, h.regeln, katIdFinder(h.kategorien), ziel.einheit, 'vorschau', null);
  }

  const vorkommen = new Map<string, number>();
  const zeilen: PlanZeile[] = [];
  const einordnung: Plan['einordnung'] | undefined = ziel.art === 'haushalt' ? {} : undefined;
  const katName = ziel.art === 'haushalt' ? katNamen({ kategorien: (x.haushalt?.kategorien ?? []) as Parameters<typeof katNamen>[0]['kategorien'], aliase: {} }) : undefined;
  let gebNr = 0;
  auszug.eintraege.forEach((e, i) => {
    const basis = { i, nr: e.zeile, datum: e.datum, cent: e.cent, gegenpartei: e.gegenpartei, zweck: e.zweck, ...(umbuchung(e) ? { umbuchung: true as const } : {}) };
    const skip = (grund: string): PlanZeile => ({ ...basis, status: 'uebersprungen', grund, schluessel: `s:${i}` });
    if (e.status === 'vorgemerkt') { zeilen.push(skip('vorgemerkt — noch nicht gebucht')); return; }
    if (e.status === 'abgelehnt') { zeilen.push(skip('storniert/abgelehnt')); return; }
    if (e.waehrung !== 'EUR' || fremdWaehrung) { zeilen.push(skip(`fremde Währung (${e.waehrung})`)); gebNr += e.status === 'gebucht' && e.waehrung === 'EUR' ? 1 : 0; return; }
    const entwurf = ziel.art === 'haushalt' ? entwuerfe[gebNr] : undefined;
    gebNr++;
    if (e.datum > heute) { zeilen.push(skip('Buchungstag liegt in der Zukunft')); return; }
    if (ziel.art === 'keins') { zeilen.push(skip('Umsätze nicht übernommen')); return; }
    // Fingerabdruck über die Felder, wie sie gespeichert würden.
    const f = ziel.art === 'business'
      ? (() => { const bf = businessFelder(e); return fp(e.datum, e.cent, bf.wer, bf.zweck); })()
      : fp(e.datum, e.cent, entwurf!.empfaenger, entwurf!.beschreibung);
    const n = zaehle(vorkommen, f).get(f)!;
    const ext = e.externeId && extZahl.get(e.externeId) === 1 ? `x:${e.externeId}` : null;
    const schluessel = ext ?? `f:${f}#${n}`;
    // 1. Kennung (Business) bzw. `zeilen_hash` (Haushalt) schon im Bestand?
    const kennung = ziel.art === 'business' ? businessId(konto.id, schluessel) : entwurf!.zeilen_hash!;
    const treffer = idFp.get(kennung);
    if (treffer !== undefined) { zaehle(genutzt, treffer); zeilen.push({ ...basis, status: 'vorhanden', schluessel }); return; }
    // 2. Fingerabdruck als Menge.
    if ((genutzt.get(f) ?? 0) < (vorhandenFp.get(f) ?? 0)) { zaehle(genutzt, f); zeilen.push({ ...basis, status: 'vorhanden', schluessel }); return; }
    zeilen.push({ ...basis, status: 'neu', schluessel });
    if (entwurf && einordnung) {
      const art = einordnen(entwurf, katName!);
      einordnung[art] = (einordnung[art] ?? 0) + 1;
      if (!entwurf.kategorie_id && !entwurf.ist_umbuchung) einordnung.ohneKategorie = (einordnung.ohneKategorie ?? 0) + 1;
    }
  });

  // Saldo → Stand im Register.
  let saldo: SaldoPlan | null = null;
  if (auszug.saldo) {
    const s = auszug.saldo;
    const aktive = konto.staende.filter(st => !st.zurueckgenommenAm);
    const juengster = aktive.reduce<string>((m, st) => (st.datum > m ? st.datum : m), '');
    const grund = fremdWaehrung ? `Saldo in ${auszug.waehrung} — nicht übernommen` : s.datum > heute ? 'Saldo-Datum liegt in der Zukunft — nicht übernommen' : undefined;
    const da = aktive.some(st => Math.round(st.betrag * 100) === s.cent && st.datum === s.datum);
    saldo = { cent: s.cent, datum: s.datum, status: grund ? 'nicht' : da ? 'vorhanden' : 'neu', ...(grund ? { grund } : {}), geltend: !grund && s.datum >= juengster };
    if (saldo.status === 'neu' && !saldo.geltend) hinweise.push('Der Saldo ist älter als der geltende Stand des Kontos — er kommt in den Verlauf, gilt aber nicht.');
  }

  const zahlen = {
    gelesen: auszug.eintraege.length,
    neu: zeilen.filter(z => z.status === 'neu').length,
    vorhanden: zeilen.filter(z => z.status === 'vorhanden').length,
    uebersprungen: zeilen.filter(z => z.status === 'uebersprungen').length,
  };
  const daten = auszug.eintraege.map(e => e.datum).sort();
  const zielSchluessel = ziel.art === 'haushalt' ? `h:${ziel.neu ? `neu:${ziel.kontoName}` : ziel.haushaltKontoId}` : ziel.art === 'business' ? `b:${ziel.ort}` : 'k';
  const basis = kurzHash(JSON.stringify({ k: konto.id, z: zielSchluessel, l: zeilen.map(z => [z.schluessel, z.status]), s: saldo ? [saldo.cent, saldo.datum, saldo.status] : null }));
  return {
    kontoId: konto.id, ziel, zeilen, saldo, zahlen, ...(einordnung ? { einordnung } : {}), zeitraum: daten.length ? { von: daten[0], bis: daten[daten.length - 1] } : null,
    pruefung: auszug.pruefung, hinweise, ...(auszug.iban ? { ibanMaskiert: ibanMaskiert(auszug.iban) } : {}), basis,
  };
}

/** Hat der Plan überhaupt etwas zu schreiben? */
export const planHatWirkung = (p: Plan): boolean => p.zahlen.neu > 0 || p.saldo?.status === 'neu';

// ── Zeilen bauen (für die Übernahme) ─────────────────────────────────────────────────────────────────────────────────────────────

/** Die neuen Business-Buchungen des Plans (feste Kennungen, Lauf-Marke `auszug`). */
export function businessZeilen(p: Plan, auszug: Auszug, konto: KontoKurz, laufId: string): BusinessBuchung[] {
  if (p.ziel.art !== 'business') return [];
  const ort = p.ziel.ort;
  return p.zeilen.filter(z => z.status === 'neu').map(z => {
    const e = auszug.eintraege[z.i];
    const f = businessFelder(e);
    return {
      id: businessId(konto.id, z.schluessel), datum: e.datum, wer: f.wer, betrag: centZuEuro(e.cent),
      kategorie: z.umbuchung ? 'Umbuchung' : (e.kategorie || 'Sonstiges').slice(0, 60),
      ...(f.zweck ? { zweck: f.zweck } : {}), konto: konto.name.slice(0, 60), ort, auszug: laufId,
    };
  });
}

/** Die neuen Haushalts-Buchungen des Plans (Regeln des Haushalts angewandt, `import_id` = Lauf, `zeilen_hash` wie der bisherige Import). */
export function haushaltZeilen(p: Plan, auszug: Auszug, h: { regeln: Regel[]; kategorien: { id: string; name: string }[] }, laufId: string, person: string, jetzt: string, neueId: () => string, eigeneIbans?: ReadonlySet<string>): HaushaltBuchung[] {
  if (p.ziel.art !== 'haushalt') return [];
  const geb = auszug.eintraege.map((e, i) => ({ e, i })).filter(({ e }) => e.status === 'gebucht' && e.waehrung === 'EUR');
  const umb = (e: AuszugEintrag) => !!(e.gegenIban && eigeneIbans?.has(e.gegenIban));
  const entwuerfe = vorbereiten(geb.map(({ e }) => haushaltRoh(e, umb(e))), p.ziel.haushaltKontoId, h.regeln, katIdFinder(h.kategorien), p.ziel.einheit, laufId, person);
  const nachIndex = new Map(geb.map(({ i }, n) => [i, entwuerfe[n]]));
  return p.zeilen.filter(z => z.status === 'neu').map(z => ({ ...nachIndex.get(z.i)!, id: neueId(), stand: 1, geaendert: jetzt }));
}

/** Für die Anzeige: Ziel in einem Satz. */
export function zielSatz(z: Ziel, ortName: (o: Gesellschaftskennung) => string): string {
  if (z.art === 'haushalt') return z.neu ? `Haushalt — neues Haushalts-Konto „${z.kontoName}“` : `Haushalt — Konto „${z.kontoName}“`;
  if (z.art === 'business') return `Buchungen der Gesellschaft ${ortName(z.ort)}`;
  return 'nur der Saldo';
}

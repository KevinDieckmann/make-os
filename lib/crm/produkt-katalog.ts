// ─── Produkte & Mandate · Katalog und Karte — die Regeln der Oberfläche (rein, Server + Browser, P2 19.10.) ─────────────────────
// PRODUKTE_KONZEPT.md „Oberfläche“: oben EINE Ansicht — die Leistungstreppe aus den Karten (Stufen links → rechts, Alternativen übereinander),
// darunter „Ohne Stufe“; „+ Produkt“ = geführtes Anlegen; die Karte mit Abschnitten (Preis · Vertrag · Regeln · Texte · Lieferumfang · Ablauf ·
// Aufwand · Ziel · Mandate). Hier steht NUR, was die Oberfläche rechnet bzw. als Änderung baut — die Produkt-Regeln selbst (Preis-Teile,
// Spiegeln, Prüfen, Treppe aus dem Katalog) liegen in lib/crm/produkt-karte.ts; hier wird von dort gelesen, nie daneben gerechnet.
// Jede Änderung, die hier entsteht, geht als Teil-Änderung (`api.teil` mit Stand) an den Bestand; vorher prüft `produktPruefen` dieselben
// Regeln wie der Server (400/413 sichtbar an der Stelle, nie still gekürzt). Keine echten Produkte, Preise oder Namen hier.

import type { Gesellschaft, Leistung, Mandat, PreisTeil, PreisTeilArt, ProduktRolle, ProduktVertrag } from './typen';
import type { TreppenStufe } from './treppe-daten';
import { TREPPE_GRENZEN, TEXT_MAX } from './treppe-daten';
import {
  katalogTreppe, produktKarte, preisText, preisteileVon, hatPreisteile, preisAusTeil, produktPruefen, wochenStunden, stufenTakt, vertragVon, hauptpreisAus,
  PREIS_TEIL_ARTEN, PRODUKT_GRENZEN, artikelnummerSaeubern, type PruefFehler,
} from './produkt-karte';
import { produktZustand, linieVon, LINIEN } from './produkte';
import { centAusEingabe, ANGEBOT_GRENZEN } from './angebote';
import { planungFehlt } from '@/lib/finanzen/produkte';
import { inCent } from '@/lib/finanzen/ust';
import { bereichVonGesellschaft } from '@/lib/einheiten';
import { weglaenge, type FlowFaden, type FlowFarbe, type FlowPunkt } from '@/lib/lichtfaeden/flow';
import { feldAbschluss } from '@/lib/make-one/feld-abschluss';

// ── Die Treppe als Bild ──────────────────────────────────────────────────────

/** Eine Kachel der Treppe bzw. eine Zeile „Ohne Stufe“. */
export interface KatalogKachel {
  /** Kennung der Stufe (gespeichert oder `ts-k-…`) — null bei „Ohne Stufe“. */
  stufeId: string | null;
  /** Das Produkt — null nur bei einer gespeicherten Stufe ohne Produkt. */
  leistungId: string | null;
  name: string;
  preisText: string;
  status: Leistung['status'] | null;
  rolle: ProduktRolle;
  linie: string;
  /** Aktive Kunden jetzt (Treppe: auf dieser Stufe; „Ohne Stufe“: aktive Mandate des Produkts). */
  kunden: number;
  /** Plätze, wenn „höchstens N gleichzeitig“ gilt. */
  plaetze: { max: number; voll: boolean; ueber: boolean } | null;
  /** Leistungstext fehlt (ohne ihn geht das Produkt nicht auf „aktiv“). */
  textFehlt: boolean;
  /** Eine gespeicherte Stufe ohne Produkt („Als Produkt anlegen“). */
  ohneProdukt?: true;
  /** Ein Satz, warum ein Produkt nicht auf der Treppe steht (nur „Ohne Stufe“). */
  hinweis?: string;
}
export interface KatalogEbene { ebene: number; kacheln: KatalogKachel[] }
export interface KatalogAnsicht {
  ebenen: KatalogEbene[];
  ohneStufe: KatalogKachel[];
  /** Die Linien der aktiven Produkte (Filter) — bekannte zuerst. */
  linien: string[];
}
/** Belegung je Stufe (Server: `lage.kapa.jeStufe`). */
export interface StufenBelegung { stufeId: string; kunden: number; max?: number; voll: boolean; ueber: boolean }

const textFehltVon = (l: Pick<Leistung, 'angebot'>) => !l.angebot?.leistungstext?.trim();

/**
 * Die Ansicht des Katalogs — die Treppe aus den Karten (`katalogTreppe`), nie mehr aus der gespeicherten Treppe allein. Archiv und Papierkorb
 * stehen nicht auf der Treppe; gespeicherte Stufen ohne Produkt stehen gestrichelt an ihrer Stelle (sie rechnen weiter mit). `linie` filtert.
 */
export function katalogAnsicht(e: {
  leistungen: readonly Leistung[];
  gespeicherte: readonly TreppenStufe[];
  belegung?: readonly StufenBelegung[];
  mandate?: readonly Pick<Mandat, 'leistungId' | 'status'>[];
  linie?: string | null;
}): KatalogAnsicht {
  const kat = katalogTreppe(e.leistungen, e.gespeicherte);
  const nach = new Map(e.leistungen.map(l => [l.id, l]));
  const ohne = new Set(kat.ohneProdukt.map(s => s.id));
  const beleg = new Map((e.belegung ?? []).map(b => [b.stufeId, b]));
  const plaetzeVon = (b: StufenBelegung | undefined, max: number | undefined): KatalogKachel['plaetze'] => {
    const m = b?.max ?? max;
    if (!m) return null;
    const k = b?.kunden ?? 0;
    return { max: m, voll: k >= m, ueber: k > m };
  };
  const passt = (linie: string) => !e.linie || linie === e.linie;
  const gezeigt = new Set<string>();
  const je = new Map<number, KatalogKachel[]>();
  for (const s of kat.stufen) {
    const b = beleg.get(s.id);
    if (ohne.has(s.id)) {
      if (e.linie) continue;
      je.set(s.ebene, [...(je.get(s.ebene) ?? []), {
        stufeId: s.id, leistungId: null, name: s.name, preisText: preisTextStufe(s), status: null, rolle: 'haupt', linie: '', kunden: b?.kunden ?? 0,
        plaetze: plaetzeVon(b, s.regeln.maxGleichzeitig), textFehlt: false, ohneProdukt: true,
      }]);
      continue;
    }
    const lid = kat.herkunft[s.id]?.leistungId;
    const l = lid ? nach.get(lid) : undefined;
    if (!l || produktZustand(l) !== 'aktiv') continue;
    gezeigt.add(l.id);
    const linie = linieVon(l);
    if (!passt(linie)) continue;
    const gespeichert = e.gespeicherte.find(x => x.id === s.id);
    je.set(s.ebene, [...(je.get(s.ebene) ?? []), {
      stufeId: s.id, leistungId: l.id, name: l.name, preisText: produktKarte(l, gespeichert ?? null, e.leistungen).preisText, status: l.status, rolle: l.rolle ?? 'haupt',
      linie, kunden: b?.kunden ?? 0, plaetze: plaetzeVon(b, s.regeln.maxGleichzeitig), textFehlt: textFehltVon(l),
    }]);
  }
  const ebenen = Array.from(je.entries()).sort(([a], [b]) => a - b)
    .map(([ebene, kacheln]) => ({ ebene, kacheln: kacheln.sort((a, b) => Number(!!a.ohneProdukt) - Number(!!b.ohneProdukt) || a.name.localeCompare(b.name, 'de')) }));
  const aktive = e.leistungen.filter(l => produktZustand(l) === 'aktiv');
  const ohneStufe = aktive.filter(l => !gezeigt.has(l.id) && passt(linieVon(l))).map((l): KatalogKachel => {
    const verknuepft = e.gespeicherte.find(s => s.leistungIds.includes(l.id));
    const hinweis = l.ebene != null && bereichVonGesellschaft(l.gesellschaft) !== 'business'
      ? `Stufe ${l.ebene} gewählt — die Gesellschaft gehört zu Privat, auf der Treppe stehen nur Business-Produkte.`
      : verknuepft ? `Mit der Stufe „${verknuepft.name}“ verknüpft, die ein anderes Produkt führt — eine eigene Stufe wählen, dann steht es auf der Treppe.` : undefined;
    const kunden = (e.mandate ?? []).filter(m => m.leistungId === l.id && m.status === 'aktiv').length;
    const max = l.regeln?.maxGleichzeitig;
    return {
      stufeId: null, leistungId: l.id, name: l.name, preisText: produktKarte(l, null, e.leistungen).preisText, status: l.status, rolle: l.rolle ?? 'haupt', linie: linieVon(l),
      kunden, plaetze: max ? { max, voll: kunden >= max, ueber: kunden > max } : null, textFehlt: textFehltVon(l), ...(hinweis ? { hinweis } : {}),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const bekannt = LINIEN as readonly string[];
  const linien = Array.from(new Set(aktive.map(linieVon))).sort((a, b) => (bekannt.indexOf(a) + 1 || 99) - (bekannt.indexOf(b) + 1 || 99) || a.localeCompare(b, 'de'));
  return { ebenen, ohneStufe, linien };
}

/** Preis einer gespeicherten Stufe ohne Produkt — in derselben Sprache wie die Karten. */
export function preisTextStufe(s: Pick<TreppenStufe, 'preis'>): string {
  const p = s.preis;
  if (p.art === 'kostenlos') return 'kostenlos';
  const art: PreisTeilArt = p.art === 'monat' ? 'monatlich' : p.art === 'jahr' ? 'jaehrlich' : 'fest';
  return preisText({ id: 'pt-stufe', art, rolle: 'grund', ...(typeof p.betrag === 'number' ? { betragCent: inCent(p.betrag) } : {}) });
}

/** Wie die Belegung einer Kachel heißt: „2 Kunden jetzt · 1/2 Plätze“, „noch kein Kunde“. */
export function belegungText(k: Pick<KatalogKachel, 'kunden' | 'plaetze'>): string {
  const kunden = k.kunden ? `${k.kunden} ${k.kunden === 1 ? 'Kunde' : 'Kunden'} jetzt` : 'noch kein Kunde';
  return k.plaetze ? `${kunden} · ${k.kunden}/${k.plaetze.max} ${k.plaetze.max === 1 ? 'Platz' : 'Plätze'}` : kunden;
}

// ── Der Faden unter der Treppe (DESIGN_STANDARD.md › Markenzeichen: der Flow) ─────────────────────────────────────

/** Ein Balken einer Stufe, gemessen in px der Leinwand: quer = von x0 bis x1 auf Höhe y; senkrecht = auf x von y0 bis y1. */
export interface TreppenBalken { a0: number; a1: number; q: number; farbe: string; kunden: number; ueber?: boolean }

/**
 * Der Faden einer Treppe: von Stufe zu Stufe (quer am Rechner, senkrecht am Handy), jede Stufe in ihrer Farbe. Hell bis zur höchsten Stufe, auf
 * der gerade Kunden stehen („Hier“), dahinter gedämpft und ausgefranst (dort steht noch niemand); ohne Kunden ganz gedämpft. Über der Platzgrenze
 * färbt sich die Stufe in der Warnfarbe. Weniger als zwei Stufen = kein Weg = kein Faden.
 */
export function treppenFaden(balken: readonly TreppenBalken[], achse: 'quer' | 'senkrecht', ton: { basis: string; rot: string }): FlowFaden | null {
  if (balken.length < 2) return null;
  const pt = (a: number, q: number): FlowPunkt => (achse === 'quer' ? [a, q] : [q, a]);
  const punkte: FlowPunkt[] = [];
  const enden: number[] = [];
  for (const b of balken) { punkte.push(pt(b.a0, b.q), pt(b.a1, b.q)); enden.push(punkte.length - 1); }
  const L = weglaenge(punkte);
  if (!(L > 4)) return null;
  const bis = (i: number) => weglaenge(punkte.slice(0, i + 1)) / L;
  const farben: FlowFarbe[] = balken.map((b, i) => ({ von: i ? bis(enden[i - 1]) : 0, bis: bis(enden[i]), farbe: b.ueber ? ton.rot : b.farbe }));
  let letzte = -1;
  balken.forEach((b, i) => { if (b.kunden > 0) letzte = i; });
  const bisHier = letzte < 0 ? 0 : bis(enden[letzte]);
  return { id: 'treppe', punkte, farbe: ton.basis, staerke: 'mittel', farben, bisHier, hier: letzte >= 0 && bisHier < 1, frans: bisHier < 1 };
}

// ── Geführtes Anlegen ────────────────────────────────────────────────────────

export const ANLEGEN_ARTEN = [
  { id: 'einmalig', label: 'einmalig' }, { id: 'monatlich', label: 'laufend monatlich' }, { id: 'jaehrlich', label: 'jährlich' },
  { id: 'kostenlos', label: 'kostenlos' }, { id: 'aufwand', label: 'nach Aufwand' },
] as const;
export type AnlegenArt = typeof ANLEGEN_ARTEN[number]['id'];
export interface NeuesProduktEingabe {
  name: string; art: AnlegenArt; /** nur „nach Aufwand“ */ satz?: 'stunde' | 'tag'; preis: string; gesellschaft: Gesellschaft; ebene: number | null; leistungstext: string;
}
export const NAME_MAX = 160;
const ART_TEIL: Record<AnlegenArt, PreisTeilArt> = { einmalig: 'fest', monatlich: 'monatlich', jaehrlich: 'jaehrlich', kostenlos: 'kostenlos', aufwand: 'stundensatz' };
const ART_TYP: Record<AnlegenArt, Leistung['typ']> = { einmalig: 'sprint', monatlich: 'retainer', jaehrlich: 'retainer', kostenlos: 'diagnose', aufwand: 'sprint' };

/**
 * Das neue Produkt aus dem Dialog — als Entwurf, gleich mit EINEM Preis-Teil (die Karte führt ab dem ersten Speichern). Fehler je Feld (ganze
 * Sätze); ein leerer Preis ist erlaubt („Preis offen“). Keine Vorgaben erfunden: nur, was eingegeben wurde.
 */
export function neuesProdukt(e: NeuesProduktEingabe, id: string): { ok: true; eintrag: Leistung } | { ok: false; fehler: Partial<Record<'name' | 'preis' | 'leistungstext', string>> } {
  const fehler: Partial<Record<'name' | 'preis' | 'leistungstext', string>> = {};
  const name = e.name.replace(/\s+/g, ' ').trim();
  if (!name) fehler.name = 'Bitte einen Namen eingeben.';
  else if (name.length > NAME_MAX) fehler.name = `Der Name ist zu lang (höchstens ${NAME_MAX} Zeichen).`;
  const art = e.art === 'aufwand' && e.satz === 'tag' ? 'tagessatz' : ART_TEIL[e.art];
  let betragCent: number | undefined;
  if (art !== 'kostenlos' && e.preis.trim()) {
    const c = centAusEingabe(e.preis);
    if (c === null) fehler.preis = 'Der Preis ist keine Zahl — z. B. 2.500 oder 2.500,50.';
    else if (c > PRODUKT_GRENZEN.betragCent) fehler.preis = 'Der Preis ist zu hoch.';
    else betragCent = c;
  }
  const text = e.leistungstext.trim();
  if (text.length > ANGEBOT_GRENZEN.text) fehler.leistungstext = `Der Leistungstext ist zu lang (höchstens ${ANGEBOT_GRENZEN.text} Zeichen).`;
  if (Object.keys(fehler).length) return { ok: false, fehler };
  const teil: PreisTeil = { id: 'pt-1', art, rolle: 'grund', ...(betragCent !== undefined ? { betragCent } : {}) };
  return {
    ok: true,
    eintrag: {
      id, name, typ: ART_TYP[e.art], stufe: 'kern', preis: preisAusTeil(teil), preise: [teil], lieferumfang: [], gesellschaft: e.gesellschaft, status: 'entwurf',
      ...(e.ebene ? { ebene: e.ebene } : {}), ...(text ? { angebot: { leistungstext: text } } : {}), geaendert: '',
    },
  };
}

/**
 * Die Karte aus einer gespeicherten Stufe ohne Produkt („Als Produkt anlegen“, nur auf Klick): Name, Ebene, Preis, Aufgabe, Ergebnis,
 * Lieferumfang, Kennzahl, Dauer, Mindestlaufzeit, Plätze, Ziel — und ein Bonus als Erfolgsanteil. Danach wird die Stufe mit dem Produkt
 * verknüpft (ihre Kennung bleibt — Kundenfortschritt und Verlauf stimmen weiter); was die Karte nicht trägt (Anrechnung als Text), füllt die Stufe.
 */
export function karteAusStufe(s: TreppenStufe, id: string): Leistung {
  const art: PreisTeilArt = s.preis.art === 'kostenlos' ? 'kostenlos' : s.preis.art === 'monat' ? 'monatlich' : s.preis.art === 'jahr' ? 'jaehrlich' : 'fest';
  const preise: PreisTeil[] = [{ id: 'pt-1', art, rolle: 'grund', ...(art !== 'kostenlos' && typeof s.preis.betrag === 'number' ? { betragCent: inCent(s.preis.betrag) } : {}) }];
  if (s.regeln.bonus) preise.push({ id: 'pt-2', art: 'erfolg', rolle: 'grund', text: s.regeln.bonus.slice(0, PRODUKT_GRENZEN.text) });
  const w = s.aufwandStunden ? wochenStunden(s.aufwandStunden, stufenTakt(s.preis.art), s.dauerTage) : null;
  // Ergebnis: das Feld am Produkt fasst 600 Zeichen — längeres bleibt an der Stufe (sie füllt Leeres) und steht im Angebotstext.
  const ergebnis = s.ergebnis && s.ergebnis.length <= ERGEBNIS_MAX ? s.ergebnis : undefined;
  return {
    id, name: s.name, typ: art === 'monatlich' || art === 'jaehrlich' ? 'retainer' : art === 'kostenlos' ? 'diagnose' : 'sprint', stufe: 'kern', preis: preisAusTeil(preise[0]), preise,
    lieferumfang: [...s.lieferobjekte], gesellschaft: 'offen', status: 'entwurf', ebene: s.ebene,
    ...(s.aufgabe ? { aufgabe: s.aufgabe } : {}), ...(ergebnis ? { ergebnis } : {}),
    ...(s.ergebnis ? { angebot: { leistungstext: '', ergebnis: s.ergebnis.slice(0, 2000) } } : {}),
    ...(s.kennzahl ? { kennzahl: s.kennzahl } : {}), ...(s.dauerTage ? { dauerTage: s.dauerTage } : {}),
    ...(s.regeln.mindestlaufzeitMonate ? { vertrag: { mindestlaufzeitMonate: s.regeln.mindestlaufzeitMonate } } : {}),
    ...(s.regeln.maxGleichzeitig ? { regeln: { maxGleichzeitig: s.regeln.maxGleichzeitig } } : {}),
    ...(s.ziel && (s.ziel.umsatz || s.ziel.kunden) ? { ziel: { ...s.ziel } } : {}),
    // Nur ein echter Aufwand (keine Annahme „vier Wochen“) — sonst rechnet die Stufe weiter mit ihrer Angabe.
    ...(w && !w.annahme ? { aufwandStundenWoche: Math.round(w.stunden * 100) / 100 } : {}),
    geaendert: '',
  };
}

// ── Preis-Teile bearbeiten ───────────────────────────────────────────────────

export type PreisTeilFeld = 'betrag' | 'bis' | 'einheit' | 'anzahlung' | 'kontingent' | 'deckel' | 'menge' | 'text' | 'artikelnummer';
/** Je Preis-Form nur die passenden Felder (Reihenfolge = Anzeige). */
export const PREIS_TEIL_FELDER: Record<PreisTeilArt, readonly PreisTeilFeld[]> = {
  kostenlos: ['text'],
  // Artikelnummer (25.10.) je Teil, der auf Angebot und Rechnung steht — „kostenlos“ wird nie berechnet.
  fest: ['betrag', 'bis', 'anzahlung', 'text', 'artikelnummer'],
  monatlich: ['betrag', 'bis', 'text', 'artikelnummer'],
  jaehrlich: ['betrag', 'bis', 'kontingent', 'anzahlung', 'text', 'artikelnummer'],
  je_einheit: ['betrag', 'bis', 'einheit', 'anzahlung', 'text', 'artikelnummer'],
  // Geplante Menge je Monat (21.10., Kevin: Tages-/Stundensätze „mit geplanter Menge je Monat“) — Planung und Liquidität rechnen Satz × Menge.
  tagessatz: ['betrag', 'bis', 'menge', 'text', 'artikelnummer'],
  stundensatz: ['betrag', 'bis', 'deckel', 'menge', 'text', 'artikelnummer'],
  erfolg: ['betrag', 'text', 'artikelnummer'],
};
export const PREIS_FELD_LABEL: Record<PreisTeilFeld, string> = {
  betrag: 'Betrag (€ netto)', bis: 'bis (€, optional)', einheit: 'Einheit (z. B. Event)', anzahlung: 'Anzahlung (%)', kontingent: 'Enthalten (Kontingent)',
  deckel: 'Höchstens Std./Monat', menge: 'Geplant je Monat', text: 'Kurze Erklärung', artikelnummer: 'Artikelnummer',
};

/** Den Teil auf eine andere Preis-Form stellen — Felder, die es dort nicht gibt, fallen weg (sonst lehnte der Server ab). */
export function teilFuerArt(t: PreisTeil, art: PreisTeilArt): PreisTeil {
  const f = PREIS_TEIL_FELDER[art];
  return {
    id: t.id, art, rolle: t.rolle,
    ...(f.includes('betrag') && typeof t.betragCent === 'number' ? { betragCent: t.betragCent } : {}),
    ...(f.includes('bis') && typeof t.bisCent === 'number' && typeof t.betragCent === 'number' ? { bisCent: t.bisCent } : {}),
    ...(f.includes('einheit') && t.einheit ? { einheit: t.einheit } : {}),
    ...(f.includes('anzahlung') && t.zahlplan ? { zahlplan: t.zahlplan } : {}),
    ...(f.includes('kontingent') && t.kontingent ? { kontingent: t.kontingent } : {}),
    ...(f.includes('deckel') && t.deckel ? { deckel: t.deckel } : {}),
    ...(f.includes('menge') && typeof t.mengeJeMonat === 'number' ? { mengeJeMonat: t.mengeJeMonat } : {}),
    ...(t.text ? { text: t.text } : {}),
    ...(f.includes('artikelnummer') && t.artikelnummer ? { artikelnummer: t.artikelnummer } : {}),
  };
}
/** Ein neuer Preis-Teil der Form `art` mit freier Kennung `pt-<n>` (gilt immer — „optional“ stellt man danach um). */
export function neuerPreisTeil(preise: readonly PreisTeil[], art: PreisTeilArt): PreisTeil {
  const ids = new Set(preise.map(t => t.id));
  let n = preise.length + 1;
  while (ids.has(`pt-${n}`)) n++;
  return { id: `pt-${n}`, art, rolle: 'grund' };
}
/** Teil `i` um `d` verschieben (nur die Anzeige-Reihenfolge — den Hauptpreis bestimmt seit 24.10. die Form, `hauptpreisAus`). */
export function preiseVerschieben(preise: readonly PreisTeil[], i: number, d: -1 | 1): PreisTeil[] {
  const n = [...preise]; const j = i + d;
  if (i < 0 || i >= n.length || j < 0 || j >= n.length) return n;
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}
/** Kennung des Hauptpreis-Teils — dieselbe Regel wie überall (`hauptpreisAus`, 24.10.: laufend vor einmalig; die Reihenfolge entscheidet nicht). */
export const hauptpreisId = (preise: readonly PreisTeil[]): string | null => hauptpreisAus(preise)?.id ?? null;

/** Eingabe eines Feldes in den Teil übernehmen — leer = entfernen; Unsinn = Satz. */
export function teilFeldSetzen(t: PreisTeil, feld: PreisTeilFeld, roh: string): { ok: true; teil: PreisTeil } | { ok: false; fehler: string } {
  const v = roh.trim();
  const ohne = <K extends keyof PreisTeil>(k: K): PreisTeil => { const n = { ...t }; delete n[k]; return n; };
  const ganz = (min: number, max: number, name: string): number | string => {
    const n = Number(v.replace(/\./g, '').replace(',', '.'));
    return Number.isInteger(n) && n >= min && n <= max ? n : `${name}: eine ganze Zahl von ${min} bis ${max.toLocaleString('de-DE')}.`;
  };
  switch (feld) {
    case 'betrag': case 'bis': {
      if (!v) return { ok: true, teil: feld === 'betrag' ? (({ betragCent: _b, bisCent: _c, ...r }) => r)(t) as PreisTeil : ohne('bisCent') };
      const c = centAusEingabe(v);
      if (c === null) return { ok: false, fehler: `${feld === 'betrag' ? 'Betrag' : '„bis“'}: eine Zahl in Euro, z. B. 2.500 oder 2.500,50.` };
      if (c > PRODUKT_GRENZEN.betragCent) return { ok: false, fehler: 'Der Betrag ist zu hoch.' };
      if (feld === 'bis') {
        if (typeof t.betragCent !== 'number') return { ok: false, fehler: '„bis“ geht nur mit einem Betrag davor.' };
        if (c <= t.betragCent) return { ok: false, fehler: '„bis“ muss größer sein als der Betrag.' };
        return { ok: true, teil: { ...t, bisCent: c } };
      }
      const n: PreisTeil = { ...t, betragCent: c };
      if (typeof n.bisCent === 'number' && n.bisCent <= c) delete n.bisCent;
      return { ok: true, teil: n };
    }
    case 'anzahlung': {
      if (!v) return { ok: true, teil: ohne('zahlplan') };
      const n = ganz(1, 99, 'Anzahlung');
      return typeof n === 'string' ? { ok: false, fehler: n } : { ok: true, teil: { ...t, zahlplan: { anzahlungProzent: n } } };
    }
    case 'deckel': {
      if (!v) return { ok: true, teil: ohne('deckel') };
      const n = ganz(1, PRODUKT_GRENZEN.stundenJeMonat, 'Stunden je Monat');
      return typeof n === 'string' ? { ok: false, fehler: n } : { ok: true, teil: { ...t, deckel: { stundenJeMonat: n } } };
    }
    case 'menge': {
      // Tage bzw. Stunden je Monat, auch halbe („1,5“); leer = Vorgabe (Deckel bzw. 0, `geplanteMenge` in lib/crm/produkt-karte.ts).
      if (!v) return { ok: true, teil: ohne('mengeJeMonat') };
      const n = Number(v.replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > PRODUKT_GRENZEN.stundenJeMonat) return { ok: false, fehler: `Geplant je Monat: eine Zahl von 0 bis ${PRODUKT_GRENZEN.stundenJeMonat.toLocaleString('de-DE')}.` };
      if (t.deckel?.stundenJeMonat && n > t.deckel.stundenJeMonat) return { ok: false, fehler: 'Geplant je Monat: höchstens so viel wie der Deckel.' };
      return { ok: true, teil: { ...t, mengeJeMonat: Math.round(n * 100) / 100 } };
    }
    case 'artikelnummer': {
      if (!v) return { ok: true, teil: ohne('artikelnummer') };
      if (v.length > PRODUKT_GRENZEN.artikelnummer) return { ok: false, fehler: `Artikelnummer: höchstens ${PRODUKT_GRENZEN.artikelnummer} Zeichen — nicht gespeichert.` };
      const a = artikelnummerSaeubern(v);
      return a ? { ok: true, teil: { ...t, artikelnummer: a } } : { ok: false, fehler: 'Artikelnummer: nur Buchstaben, Ziffern, Leerzeichen und - _ . / (vorn ein Buchstabe oder eine Ziffer).' };
    }
    case 'einheit': case 'kontingent': case 'text': {
      const max = feld === 'einheit' ? PRODUKT_GRENZEN.einheit : feld === 'kontingent' ? PRODUKT_GRENZEN.kontingent : PRODUKT_GRENZEN.text;
      if (v.length > max) return { ok: false, fehler: `Zu lang (höchstens ${max} Zeichen) — nicht gespeichert.` };
      return { ok: true, teil: v ? { ...t, [feld]: v.replace(/\s+/g, ' ') } : ohne(feld) };
    }
  }
}
/** Der Wert eines Feldes zum Bearbeiten (deutsche Schreibweise). */
export function teilFeldWert(t: PreisTeil, feld: PreisTeilFeld): string {
  const euro = (c: number | undefined) => (typeof c === 'number' ? (c / 100).toLocaleString('de-DE', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }) : '');
  switch (feld) {
    case 'betrag': return euro(t.betragCent);
    case 'bis': return euro(t.bisCent);
    case 'anzahlung': return t.zahlplan ? String(t.zahlplan.anzahlungProzent) : '';
    case 'deckel': return t.deckel?.stundenJeMonat ? String(t.deckel.stundenJeMonat) : '';
    case 'menge': return typeof t.mengeJeMonat === 'number' ? t.mengeJeMonat.toLocaleString('de-DE') : '';
    case 'einheit': return t.einheit ?? '';
    case 'kontingent': return t.kontingent ?? '';
    case 'text': return t.text ?? '';
    case 'artikelnummer': return t.artikelnummer ?? '';
  }
}
/** Die Preis-Teile zum Bearbeiten (ohne eigene: der eine Teil aus dem alten Preis). */
export const preiseZumBearbeiten = (l: Pick<Leistung, 'preis' | 'preise'>): PreisTeil[] => preisteileVon(l);
/** Prüfen wie der Server — leer = in Ordnung. */
export const preisePruefen = (preise: readonly PreisTeil[]): PruefFehler[] => produktPruefen({ preise });

// ── Vertrag, Regeln, Ziel ────────────────────────────────────────────────────

/**
 * Ein Feld des Vertrags ändern (leer = entfernen). Wird die Mindestlaufzeit geleert, leert sich auch die alte Laufzeit — sonst käme sie über
 * `vertragVon` gleich wieder. Geprüft wie der Server.
 */
export function vertragAenderung(l: Pick<Leistung, 'vertrag' | 'laufzeitMonate'>, feld: keyof ProduktVertrag, wert: ProduktVertrag[keyof ProduktVertrag] | null): { ok: true; felder: Record<string, unknown> } | { ok: false; fehler: string } {
  const v: Record<string, unknown> = { ...(l.vertrag ?? {}) };
  if (wert === null || wert === undefined) delete v[feld]; else v[feld] = wert;
  const f = produktPruefen({ vertrag: v });
  if (f.length) return { ok: false, fehler: f.map(x => x.text).join(' ') };
  return { ok: true, felder: { vertrag: Object.keys(v).length ? v : null, ...(feld === 'mindestlaufzeitMonate' && (wert === null || wert === undefined) && l.laufzeitMonate ? { laufzeitMonate: null } : {}) } };
}
export const DANACH_LABEL: Record<NonNullable<ProduktVertrag['danach']>, string> = { monatlich_kuendbar: 'monatlich kündbar', verlaengert_um_laufzeit: 'verlängert sich um die Laufzeit', endet: 'endet' };
export const RHYTHMUS_LABEL: Record<NonNullable<ProduktVertrag['rechnungsrhythmus']>, string> = { monatlich: 'monatlich', quartal: 'je Quartal', einmalig: 'einmalig' };
/** Der Vertrag in einer Zeile („6 Monate, danach monatlich kündbar · 30 Tage Frist · Rechnung monatlich“); leer: „nichts festgelegt“. */
export function vertragText(v: ProduktVertrag): string {
  const t = [
    v.mindestlaufzeitMonate ? `${v.mindestlaufzeitMonate} ${v.mindestlaufzeitMonate === 1 ? 'Monat' : 'Monate'}${v.danach ? `, danach ${DANACH_LABEL[v.danach]}` : ''}` : v.danach ? `danach ${DANACH_LABEL[v.danach]}` : '',
    v.kuendigungsfristTage != null ? `${v.kuendigungsfristTage} Tage Frist` : '',
    v.rechnungsrhythmus ? `Rechnung ${RHYTHMUS_LABEL[v.rechnungsrhythmus]}` : '',
    v.zahlungszielTage != null ? `Ziel ${v.zahlungszielTage} Tage` : '',
    v.ustSatz != null && v.ustSatz !== 19 ? `USt ${v.ustSatz} %` : '',
    v.reisekosten ? `Reisekosten ${v.reisekosten}` : '',
  ].filter(Boolean);
  return t.join(' · ') || 'nichts festgelegt';
}

/** Die Regeln ändern (ganzes Objekt, leer = entfernen) — geprüft wie der Server (`bekannt`: Produkte des Katalogs). */
export function regelnAenderung(l: Pick<Leistung, 'id' | 'regeln'>, teil: Partial<NonNullable<Leistung['regeln']>> | Record<string, unknown>, bekannt: (id: string) => boolean): { ok: true; felder: Record<string, unknown> } | { ok: false; fehler: string } {
  const r: Record<string, unknown> = { ...(l.regeln ?? {}), ...teil };
  for (const k of Object.keys(r)) if (r[k] === null || r[k] === undefined || (Array.isArray(r[k]) && !(r[k] as unknown[]).length)) delete r[k];
  const f = produktPruefen({ regeln: r }, { id: l.id, bekannt });
  if (f.length) return { ok: false, fehler: f.map(x => x.text).join(' ') };
  return { ok: true, felder: { regeln: Object.keys(r).length ? r : null } };
}
/** Die Regeln in einer Zeile. */
export function regelnText(r: Leistung['regeln'] | undefined, namen: (id: string) => string): string {
  if (!r) return 'keine';
  const t = [
    r.anrechnung?.auf.length ? `${r.anrechnung.anteilProzent === 100 ? 'voll' : `${r.anrechnung.anteilProzent} %`} angerechnet auf ${r.anrechnung.auf.map(namen).join(', ')}` : '',
    r.maxGleichzeitig ? `höchstens ${r.maxGleichzeitig} gleichzeitig` : '',
    r.inklusive?.length ? `inklusive ${r.inklusive.map(x => `${x.menge}× ${namen(x.leistungId)} je ${x.je === 'monat' ? 'Monat' : x.je === 'quartal' ? 'Quartal' : 'Jahr'}`).join(', ')}` : '',
  ].filter(Boolean);
  return t.join(' · ') || 'keine';
}

/** Eine Zahl aus einem Eingabefeld (deutsche Schreibweise) — '' = null, Unsinn = NaN. */
export function zahlAus(t: string): number | null {
  const s = t.trim();
  if (!s) return null;
  const n = Number(s.replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// ── Texte: genau EINE Stelle je Text ─────────────────────────────────────────
// Bis 19.10. standen Ergebnis und Grenzen doppelt (am Produkt und in den Angebotstexten). Die Karte zeigt sie EINMAL; gespeichert wird an
// beiden Stellen derselbe Text (alle Leser — Angebot, Treppe, Mandat — sehen ihn). Standen bisher zwei verschiedene Texte, zeigt das Feld
// beide (nichts geht verloren); beim nächsten Speichern gilt der eine.

export type TextFeld = 'kurz' | 'leistungstext' | 'ergebnis' | 'grenzen' | 'titel' | 'einleitung';
export const ERGEBNIS_MAX = 600;
export const TEXT_FELDER: readonly { id: TextFeld; label: string; max: number; zeilen: number; platzhalter: string; nurWennDa?: true }[] = [
  { id: 'kurz', label: 'Kurzbeschreibung', max: 1500, zeilen: 2, platzhalter: 'Ein Satz: was es ist und für wen' },
  { id: 'leistungstext', label: 'Leistungstext', max: ANGEBOT_GRENZEN.text, zeilen: 5, platzhalter: 'Was genau geliefert wird — steht so im Angebot (Pflicht für „aktiv“)' },
  { id: 'ergebnis', label: 'Ergebnis', max: ERGEBNIS_MAX, zeilen: 2, platzhalter: 'Was der Kunde danach hat' },
  { id: 'grenzen', label: 'Grenzen & Hinweise', max: ERGEBNIS_MAX, zeilen: 2, platzhalter: 'Voraussetzungen, Mitwirkung, was nicht dazugehört' },
  { id: 'titel', label: 'Titel im Angebot', max: 200, zeilen: 1, platzhalter: 'leer = der Name', nurWennDa: true },
  { id: 'einleitung', label: 'Einleitung im Angebot', max: 3000, zeilen: 2, platzhalter: 'optional', nurWennDa: true },
];
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
/** Zwei Texte derselben Bedeutung: der eine, oder — wenn sie verschieden sind — beide untereinander (nichts geht verloren). */
export function zusammen(a: string | undefined, b: string | undefined): string {
  const x = a?.trim() ?? '', y = b?.trim() ?? '';
  if (!x || !y) return x || y;
  const nx = norm(x), ny = norm(y);
  if (nx === ny || nx.includes(ny)) return x;
  if (ny.includes(nx)) return y;
  return `${x}\n\n${y}`;
}
/** Die Texte der Karte (je Feld EIN Wert). */
export function texteVon(l: Pick<Leistung, 'beschreibung' | 'ergebnis' | 'grenzen' | 'angebot'>): Record<TextFeld, string> {
  const a = l.angebot;
  return {
    kurz: l.beschreibung?.trim() ?? '', leistungstext: a?.leistungstext?.trim() ?? '', ergebnis: zusammen(a?.ergebnis, l.ergebnis), grenzen: zusammen(a?.hinweise, l.grenzen),
    titel: a?.titel?.trim() ?? '', einleitung: a?.einleitung?.trim() ?? '',
  };
}
/**
 * Einen Text speichern — an genau die Stellen, an denen er gelesen wird (Ergebnis: Produkt + Angebotstext, Grenzen: Produkt + Hinweise).
 * Zu lang → Satz, nichts gesendet (der Server kürzte sonst still). Ein aktives Produkt verliert den Leistungstext nicht.
 */
export function textAenderung(l: Pick<Leistung, 'status' | 'angebot'>, feld: TextFeld, roh: string): { ok: true; felder: Record<string, unknown> } | { ok: false; fehler: string } {
  const wert = roh.replace(/\r\n?/g, '\n').trim();
  const def = TEXT_FELDER.find(f => f.id === feld)!;
  if (wert.length > def.max) return { ok: false, fehler: `${def.label} ist zu lang (${wert.length.toLocaleString('de-DE')} von höchstens ${def.max.toLocaleString('de-DE')} Zeichen) — nicht gespeichert.` };
  if (feld === 'leistungstext' && !wert && l.status === 'aktiv') return { ok: false, fehler: 'Das Produkt ist aktiv — der Leistungstext bleibt Pflicht. Erst auf „Entwurf“ stellen, dann leeren.' };
  const angebot = (k: 'leistungstext' | 'ergebnis' | 'hinweise' | 'titel' | 'einleitung') => {
    const a: Record<string, unknown> = { ...(l.angebot ?? {}), leistungstext: l.angebot?.leistungstext ?? '' };
    if (wert || k === 'leistungstext') a[k] = wert; else delete a[k];
    return a;
  };
  switch (feld) {
    case 'kurz': return { ok: true, felder: { beschreibung: wert || null } };
    case 'leistungstext': return { ok: true, felder: { angebot: angebot('leistungstext') } };
    case 'ergebnis': return { ok: true, felder: { ergebnis: wert || null, angebot: angebot('ergebnis') } };
    case 'grenzen': return { ok: true, felder: { grenzen: wert || null, angebot: angebot('hinweise') } };
    case 'titel': return { ok: true, felder: { angebot: angebot('titel') } };
    case 'einleitung': return { ok: true, felder: { angebot: angebot('einleitung') } };
  }
}

// ── Lieferumfang ─────────────────────────────────────────────────────────────

/** Grenzen des Lieferumfangs = die der Treppe (dort wird jeder Punkt je Kunde abgehakt). */
export const LIEFER_MAX = { zeichen: TEXT_MAX.lieferobjekt, anzahl: TREPPE_GRENZEN.lieferobjekte } as const;
/** Einen Punkt anhängen — leer, doppelt, zu lang oder zu viele: Satz statt Änderung (Enter + Verlassen hängt nie zweimal an). */
export function lieferumfangDazu(liste: readonly string[], roh: string): { ok: true; liste: string[] } | { ok: false; fehler: string; grund: 'leer' | 'lang' | 'doppelt' | 'voll' } {
  const t = roh.replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, fehler: 'Leer — nichts hinzugefügt.', grund: 'leer' };
  if (t.length > LIEFER_MAX.zeichen) return { ok: false, fehler: `Zu lang (${t.length} von höchstens ${LIEFER_MAX.zeichen} Zeichen) — bitte kürzer fassen.`, grund: 'lang' };
  if (liste.some(x => norm(x).toLowerCase() === t.toLowerCase())) return { ok: false, fehler: `„${t}“ steht schon in der Liste.`, grund: 'doppelt' };
  if (liste.length >= LIEFER_MAX.anzahl) return { ok: false, fehler: `Höchstens ${LIEFER_MAX.anzahl} Punkte — nichts hinzugefügt.`, grund: 'voll' };
  return { ok: true, liste: [...liste, t] };
}

/**
 * Beim Schließen (Karte „Fertig“/×, Abschnitt zugeklappt — 21.10., Rundgang B9): ein getippter, noch nicht übernommener Punkt geht nicht still verloren.
 * Dieselbe Regel wie das Anlege-Feld (`feldAbschluss`, lib/make-one/feld-abschluss.ts): ein leeres Feld speichert nichts; sonst über `lieferumfangDazu`
 * — ein Punkt, der schon in der Liste steht, kommt nie doppelt. Passt er nicht (zu lang, Liste voll), bleibt er als Entwurf (`behalten`, mit Satz).
 */
export function lieferumfangBeimSchliessen(liste: readonly string[], text: string): { art: 'nichts' } | { art: 'speichern'; liste: string[] } | { art: 'behalten'; fehler: string } {
  const a = feldAbschluss(text, '', true);
  if (a.speichern === null) return { art: 'nichts' };
  const r = lieferumfangDazu(liste, a.speichern);
  if (r.ok) return { art: 'speichern', liste: r.liste };
  return r.grund === 'doppelt' || r.grund === 'leer' ? { art: 'nichts' } : { art: 'behalten', fehler: r.fehler };
}

// ── Aufwand & Kapazität ──────────────────────────────────────────────────────

/** Der Aufwand je Kunde und Woche, wie die Kapazität ihn rechnet, mit Satz zur Herkunft (Annahme sichtbar). */
export function aufwandText(k: { aufwand: { stunden: number; annahme: boolean } | null }, l: Pick<Leistung, 'aufwandStundenWoche'>): { wert: string; satz: string } {
  if (!k.aufwand) return { wert: 'offen', satz: 'Ohne Aufwand zählt dieses Produkt in der Kapazität nicht mit.' };
  const h = Math.round(k.aufwand.stunden * 10) / 10;
  const wert = `${h.toLocaleString('de-DE')} h/Woche`;
  if (typeof l.aufwandStundenWoche === 'number') return { wert, satz: 'Eingetragen je Kunde und Woche.' };
  return k.aufwand.annahme
    ? { wert, satz: 'Annahme: der Aufwand verteilt sich auf vier Wochen — mit der Dauer (Tage) wird es genau.' }
    : { wert, satz: 'Aus dem bisherigen Aufwand je Preis-Einheit umgerechnet — eintragen macht es fest.' };
}

// ── Antwort zuerst: was fehlt ────────────────────────────────────────────────

export type KartenAbschnitt = 'kopf' | 'preis' | 'vertrag' | 'regeln' | 'texte' | 'liefer' | 'ablauf' | 'aufwand' | 'ziel' | 'mandate' | 'unterlagen';
export interface KartenLuecke { abschnitt: KartenAbschnitt; text: string }
/** Was an der Karte fehlt — höchstens drei, das Wichtigste zuerst (der Weg führt in den Abschnitt). `ablauf`: null = unbekannt (kein Fulfillment). */
export function kartenLuecken(l: Leistung, o: { ablauf?: boolean | null } = {}): KartenLuecke[] {
  const out: KartenLuecke[] = [];
  if (!l.angebot?.leistungstext?.trim()) out.push({ abschnitt: 'texte', text: l.status === 'aktiv' ? 'Leistungstext fehlt — im Angebots-Tool steht „Text fehlt“.' : 'Leistungstext fehlt — ohne ihn geht das Produkt nicht auf „aktiv“.' });
  const p = planungFehlt(l);
  if (p.includes('Preis') || p.some(x => x.startsWith('Basis'))) out.push({ abschnitt: 'preis', text: 'Preis fehlt — für Angebot und Planung.' });
  if (p.includes('Laufzeit')) out.push({ abschnitt: 'vertrag', text: 'Mindestlaufzeit fehlt — die Planung weiß nicht, wie lange der Umsatz läuft.' });
  if (p.includes('Gesellschaft')) out.push({ abschnitt: 'kopf', text: 'Gesellschaft fehlt — wer stellt die Rechnung?' });
  if (o.ablauf === false) out.push({ abschnitt: 'ablauf', text: 'Kein Ablauf zugeordnet — ein neuer Kunde bekommt keinen Fall.' });
  return out.slice(0, 3);
}

/** Die Ebenen zur Wahl: 1 … (höchste vorhandene + 1), höchstens die Grenze der Treppe. */
export function ebenenWahl(vorhanden: readonly number[]): number[] {
  const max = Math.min(PRODUKT_GRENZEN.ebene, Math.max(1, ...vorhanden) + 1);
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** Mindestlaufzeit, wie die Karte sie zeigt (Vertrag, sonst alte Laufzeit). */
export const mindestlaufzeitVon = (l: Pick<Leistung, 'vertrag' | 'laufzeitMonate'>): number | undefined => vertragVon(l).mindestlaufzeitMonate;

// ── Angebots-Tool: die Kachel eines Produkts ─────────────────────────────────

/** Preis der Grund-Teile in einer Zeile und die Optionen zum Anhaken (Rolle „option“). Ohne Preis-Teile: der alte Preis, keine Optionen. */
export function angebotKachel(l: Pick<Leistung, 'preis' | 'preise'>): { preisText: string; optionen: { id: string; text: string }[] } {
  const t = preisteileVon(l);
  return {
    preisText: t.filter(x => x.rolle === 'grund').map(preisText).join(' · ') || 'Preis offen',
    optionen: hatPreisteile(l) ? t.filter(x => x.rolle === 'option').map(x => ({ id: x.id, text: preisText(x) })) : [],
  };
}

// ── Finanzplanung: mit vorgewähltem Produkt (B15) ────────────────────────────

/** Die Sicht der Finanzplanung, in der das Produkt geplant wird (Bereich seiner Gesellschaft; „offen“ = Business) — Link: `WEG.finanzplanungProdukt`. */
export const planungsSicht = (l: Pick<Leistung, 'gesellschaft'>): 'privat' | 'business' => (bereichVonGesellschaft(l.gesellschaft) === 'privat' ? 'privat' : 'business');

export { PREIS_TEIL_ARTEN };

// ─── MAKE OS — Finanzplan: Bestand, Säuberung, Grenzen, „bezahlt“ (28.09.) ──
// Der Schreibweg der Route /api/state/finanzplan — hier, damit er prüfbar ist
// und die Route nur ihre Handler exportiert. Die ZOE-Werkzeuge und die
// Beleg-Übernahme prüfen dieselben Grenzen.
//
// Prüfbericht 28.09.: Die Säuberung kürzte jede Liste still (Firmen 10,
// Rechnungen 200, Zahlungen 100, Produkte 30) — und weil der PATCH vom
// gesäuberten Bestand ausging, verschwand ab der 201. Rechnung bei jedem
// Speichern der Rest. Regel seitdem: beim Lesen NIE etwas wegwerfen; wer eine
// Liste über die Grenze wachsen lassen will, bekommt eine Ablehnung mit Text.

import { fingerabdruck } from '@/lib/store/fingerabdruck';

export interface Firma {
  id: string;
  name: string;
  bank: string;
  /** Kontostand in €, von Hand gepflegt (null = noch nie eingetragen). */
  kontostand: number | null;
  /** Tag des letzten Eintrags YYYY-MM-DD. */
  stand: string | null;
}
/**
 * geplant → gestellt → bezahlt; `storniert` (28.09., K3) ersetzt das Löschen ab „gestellt“:
 * der Eintrag bleibt (mit Datum und Grund), zählt aber in Liquidität und Umsatz nicht mehr.
 */
export type RechnungStatus = 'geplant' | 'gestellt' | 'bezahlt' | 'storniert';
export interface Rechnung {
  id: string;
  firmaId: string;
  /** Das Mandat, aus dem die Rechnung stammt (26.09.). */
  mandatId?: string;
  kunde: string;
  titel: string;
  /** Rechnungsbetrag BRUTTO in €, auf den Cent (28.09., K3 — vorher auf ganze Euro gerundet). */
  betrag: number;
  status: RechnungStatus;
  faellig?: string;
  /** Storno (nur bei Status `storniert`): Tag und Grund. */
  storniertAm?: string;
  stornoGrund?: string;
  /** Der ganze Vorgang: Angebot → Rechnung → Eingang (Kevins Ansage 02.08.). */
  nummer?: string;
  datum?: string;
  angebot?: string;
  angebotAm?: string;
  bezahltAm?: string;
  netto?: number;
  ustSatz?: number;
  leistungVon?: string;
  leistungBis?: string;
  notiz?: string;
}
export interface Merkposten {
  id: string;
  firmaId: string;
  titel: string;
  /** Positiv = erhalten (z.B. Kredit), negativ = zu zahlen. */
  betrag: number;
  art: 'kredit' | 'sonstig';
  datum?: string;
  notiz?: string;
}
/** Zu zahlende Posten — die Reihenfolge im Array IST die Prioritätenliste. */
export interface Zahlung {
  id: string;
  firmaId: string;
  an: string;
  titel: string;
  /** Betrag brutto in €, auf den Cent. */
  betrag: number;
  status: 'offen' | 'bezahlt';
  faellig?: string;
}
export interface Produkt {
  id: string;
  name: string;
  beschreibung: string;
  preis: number;
  einheit: 'einmalig' | 'monatlich' | 'projekt';
  status: 'entwurf' | 'aktiv';
}
/** Das Finanz-Uhrwerk: 2× im Monat Meeting, Checkliste läuft immer wieder durch. */
export interface Uhrwerk {
  letztesMeeting: string | null;
  agenda: { id: string; label: string; done: boolean }[];
}
export interface FinanzplanFile {
  firmen: Firma[];
  rechnungen: Rechnung[];
  merkposten: Merkposten[];
  zahlungen: Zahlung[];
  produkte: Produkt[];
  uhrwerk: Uhrwerk;
}

export const STATI: RechnungStatus[] = ['geplant', 'gestellt', 'bezahlt', 'storniert'];

/** Geldbetrag auf den Cent (28.09., K3): 1.190,50 € bleibt 1.190,50 € — vorher wurde auf ganze Euro gerundet. */
const cent = (v: unknown): number => (isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);

// Echter Startbestand (Kevins Ansage 31.07.2026) — alles editierbar.
export const SEED: FinanzplanFile = {
  firmen: [
    { id: 'kdv', name: 'KD Ventures', bank: 'Vivid', kontostand: null, stand: null },
    { id: 'kdc', name: 'Kevin Dieckmann Consulting', bank: 'Vivid', kontostand: null, stand: null },
  ],
  rechnungen: [
    { id: 'r-onebanking', firmaId: 'kdc', kunde: 'OneBanking', titel: 'Beratung/Umsetzung — Leistung abrechnen', betrag: 0, status: 'geplant', faellig: '2026-08-02', notiz: 'Betrag eintragen, dann stellen.' },
    { id: 'r-acme', firmaId: 'kdc', kunde: 'ACME', titel: 'Neues Mandat — Einstieg', betrag: 0, status: 'geplant', notiz: 'Kunde im Aufbau — Umfang klären.' },
  ],
  merkposten: [
    { id: 'm-bjoern', firmaId: 'kdc', titel: 'Björn-Kredit erhalten', betrag: 17_000, art: 'kredit', datum: '2026-07-30', notiz: 'Eingang 30.07 — Rückzahlung offen halten.' },
  ],
  zahlungen: [],
  // Entwürfe fürs Finanzmeeting — zum Festzurren, alles editierbar.
  produkte: [
    { id: 'p-sprint', name: 'Klarheits-Sprint', beschreibung: 'Kompakter Einstieg: Analyse + Maßnahmenplan mit klarem Ergebnis.', preis: 0, einheit: 'einmalig', status: 'entwurf' },
    { id: 'p-mandat', name: 'Begleitungs-Mandat', beschreibung: 'Laufende Beratung & Steuerung im monatlichen Mandat.', preis: 0, einheit: 'monatlich', status: 'entwurf' },
    { id: 'p-umsetzung', name: 'Umsetzungs-Mandat', beschreibung: 'Projekt mit definiertem Ergebnis — wie OneBanking.', preis: 0, einheit: 'projekt', status: 'entwurf' },
  ],
  uhrwerk: {
    letztesMeeting: null,
    agenda: [
      { id: 'a-konten', label: 'Kontostände beider Vivid-Konten eintragen', done: false },
      { id: 'a-rechnungen', label: 'Alle offenen Rechnungen zusammenziehen (rein & raus)', done: false },
      { id: 'a-prio', label: 'Zahlungs-Prioritätenliste festlegen — was zuerst?', done: false },
      { id: 'a-kredit', label: 'Kreditvertrag Firma → privat aufsetzen (mit Steuerberater absichern)', done: false },
      { id: 'a-plan', label: 'Finanzplan füllen: Monats-Umsatz & Kosten im Controlling', done: false },
      { id: 'a-produkte', label: 'Produktpakete festzurren (Entwürfe unten)', done: false },
      { id: 'a-vertrieb', label: 'Vertriebsziele festlegen → in Jahr & Ziele eintragen', done: false },
    ],
  },
};

/** Ein Datum oder gar nichts — spart die Wiederholung bei jedem Feld. */
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function sauberFile(f: Partial<FinanzplanFile> | null): FinanzplanFile {
  return {
    firmen: (Array.isArray(f?.firmen) ? f!.firmen : []).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `f-${Math.random().toString(36).slice(2, 8)}`,
      name: String(x.name ?? '').slice(0, 120),
      bank: String(x.bank ?? '').slice(0, 60),
      kontostand: x.kontostand == null || !isFinite(Number(x.kontostand)) ? null : Math.round(Number(x.kontostand)),
      stand: typeof x.stand === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.stand) ? x.stand : null,
    })).filter(x => x.name),
    rechnungen: (Array.isArray(f?.rechnungen) ? f!.rechnungen : []).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      kunde: String(x.kunde ?? '').slice(0, 120),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: Math.max(0, cent(x.betrag)),
      status: STATI.includes(x.status as RechnungStatus) ? x.status as RechnungStatus : 'geplant',
      faellig: tag(x.faellig),
      ...(x.status === 'storniert' ? { storniertAm: tag(x.storniertAm), stornoGrund: x.stornoGrund ? String(x.stornoGrund).slice(0, 300) : undefined } : {}),
      // Der ganze Vorgang, nicht nur der Betrag: Angebot → Rechnung → Eingang.
      nummer: x.nummer ? String(x.nummer).slice(0, 60) : undefined,
      datum: tag(x.datum),
      angebot: x.angebot ? String(x.angebot).slice(0, 60) : undefined,
      angebotAm: tag(x.angebotAm),
      bezahltAm: tag(x.bezahltAm),
      netto: x.netto == null || !isFinite(Number(x.netto)) ? undefined : Math.round(Number(x.netto) * 100) / 100,
      ustSatz: x.ustSatz == null || !isFinite(Number(x.ustSatz)) ? undefined : Math.max(0, Math.min(30, Number(x.ustSatz))),
      mandatId: x.mandatId ? String(x.mandatId).slice(0, 40) : undefined,
      leistungVon: tag(x.leistungVon),
      leistungBis: tag(x.leistungBis),
      notiz: x.notiz ? String(x.notiz).slice(0, 300) : undefined,
    })).filter(x => x.kunde || x.titel),
    merkposten: (Array.isArray(f?.merkposten) ? f!.merkposten : []).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: isFinite(Number(x.betrag)) ? Math.round(Number(x.betrag)) : 0,
      art: (x.art === 'kredit' ? 'kredit' : 'sonstig') as Merkposten['art'],
      datum: typeof x.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.datum) ? x.datum : undefined,
      notiz: x.notiz ? String(x.notiz).slice(0, 300) : undefined,
    })).filter(x => x.titel),
    zahlungen: (Array.isArray(f?.zahlungen) ? f!.zahlungen : []).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      firmaId: String(x.firmaId ?? '').slice(0, 40),
      an: String(x.an ?? '').slice(0, 120),
      titel: String(x.titel ?? '').slice(0, 200),
      betrag: Math.max(0, cent(x.betrag)),
      status: (x.status === 'bezahlt' ? 'bezahlt' : 'offen') as Zahlung['status'],
      faellig: typeof x.faellig === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.faellig) ? x.faellig : undefined,
    })).filter(x => x.an || x.titel),
    produkte: (Array.isArray(f?.produkte) ? f!.produkte : []).map(x => ({
      id: String(x.id ?? '').slice(0, 40) || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(x.name ?? '').slice(0, 120),
      beschreibung: String(x.beschreibung ?? '').slice(0, 300),
      preis: isFinite(Number(x.preis)) ? Math.max(0, Math.round(Number(x.preis))) : 0,
      einheit: (['einmalig', 'monatlich', 'projekt'].includes(x.einheit as string) ? x.einheit : 'einmalig') as Produkt['einheit'],
      status: (x.status === 'aktiv' ? 'aktiv' : 'entwurf') as Produkt['status'],
    })).filter(x => x.name),
    uhrwerk: {
      letztesMeeting: typeof f?.uhrwerk?.letztesMeeting === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.uhrwerk.letztesMeeting) ? f.uhrwerk.letztesMeeting : null,
      agenda: (Array.isArray(f?.uhrwerk?.agenda) ? f!.uhrwerk!.agenda : []).map(x => ({
        id: String(x.id ?? '').slice(0, 40) || `a-${Math.random().toString(36).slice(2, 8)}`,
        label: String(x.label ?? '').slice(0, 200),
        done: x.done === true,
      })).filter(x => x.label),
    },
  };
}

/** Obergrenzen je Liste — großzügig; bei Überschreitung wird ABGELEHNT, nie gekürzt. */
export const GRENZEN = {
  firmen: 50,
  rechnungen: 5000,
  zahlungen: 5000,
  merkposten: 500,
  produkte: 200,
  agenda: 100,
} as const;
export type GrenzListe = keyof typeof GRENZEN;

const NAMEN: Record<GrenzListe, string> = {
  firmen: 'Firmen', rechnungen: 'Rechnungen', zahlungen: 'Zahlungen', merkposten: 'Merkposten', produkte: 'Produkte', agenda: 'Punkte im Finanzmeeting',
};

const laenge = (f: Partial<FinanzplanFile> | null | undefined, l: GrenzListe): number => {
  if (l === 'agenda') return Array.isArray(f?.uhrwerk?.agenda) ? f!.uhrwerk!.agenda.length : 0;
  const v = f?.[l];
  return Array.isArray(v) ? v.length : 0;
};

/**
 * Wächst eine Liste über ihre Grenze? Dann der Ablehnungstext, sonst null.
 * Mit `vorher`: nur WACHSEN wird abgelehnt — ein Bestand, der (von früher)
 * schon darüber liegt, bleibt bearbeit- und abbaubar.
 */
export function ueberGrenze(neu: Partial<FinanzplanFile> | null | undefined, vorher?: Partial<FinanzplanFile> | null): string | null {
  for (const l of Object.keys(GRENZEN) as GrenzListe[]) {
    const n = laenge(neu, l);
    if (n > GRENZEN[l] && (vorher === undefined || n > laenge(vorher, l))) {
      return `Abgelehnt: höchstens ${GRENZEN[l]} ${NAMEN[l]} im Finanzplan (jetzt wären es ${n}). Erst Erledigtes aufräumen — gekürzt wird nie.`;
    }
  }
  return null;
}

/** Fehlertexte mit diesem Anfang meinen „zu viele Einträge“ (HTTP 413). */
export const istGrenzFehler = (t: string | null | undefined): boolean => !!t && t.startsWith('Abgelehnt: höchstens');

// ── „Bezahlt“ + Buchung in einem Schritt (28.09.) ─────────────────────────────
// Vorher setzte der Browser den Status und schickte die Buchung getrennt mit
// `.catch(() => {})` hinterher — ging der zweite Aufruf verloren, stand die
// Rechnung auf bezahlt ohne Zahlungseingang. Jetzt macht es der Server in EINER
// Sperre; die Buchung heißt immer `bu-re-<rechnungId>` und ist damit idempotent.

/** Die Buchung (Zahlungseingang) zu einer bezahlten Rechnung — Form wie /api/state/buchungen. */
export interface RechnungsBuchung {
  id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string; ort: 'kdv' | 'kdc'; rechnungId: string;
}
export const buchungsId = (rechnungId: string) => `bu-re-${rechnungId}`.slice(0, 40);

export function buchungFuer(r: Rechnung, am: string): RechnungsBuchung {
  return {
    id: buchungsId(r.id), datum: am, wer: (r.kunde || r.titel || 'Rechnung').slice(0, 120), betrag: r.betrag, kategorie: 'Umsatz',
    ...(r.titel ? { zweck: r.titel.slice(0, 200) } : {}), ort: r.firmaId === 'kdv' ? 'kdv' : 'kdc', rechnungId: r.id,
  };
}

export type BezahltErgebnis =
  | { ok: true; datei: FinanzplanFile; rechnung: Rechnung; schonBezahlt: boolean; buchung: RechnungsBuchung | null }
  | { ok: false; status: 404 | 409; fehler: string; aktuell?: Rechnung };

/**
 * Rein: Rechnung `id` auf bezahlt setzen (Status + `bezahltAm`). `stand` (optional)
 * = Fingerabdruck, den der Browser kannte — passt er nicht, 409 mit dem aktuellen
 * Eintrag. Schon bezahlt → nichts ändern, aber die Buchung trotzdem liefern (so
 * heilt ein Wiederholen eine fehlende Buchung). Betrag 0 → keine Buchung.
 */
export function bezahltAnwenden(f: FinanzplanFile, id: string, am: string, stand?: string): BezahltErgebnis {
  const alt = f.rechnungen.find(r => r.id === id);
  if (!alt) return { ok: false, status: 404, fehler: 'Die Rechnung gibt es nicht (mehr).' };
  if (stand && fassung(alt) !== stand) {
    return { ok: false, status: 409, fehler: 'Jemand hat die Rechnung inzwischen geändert — Stand neu geladen, bitte noch einmal.', aktuell: alt };
  }
  if (alt.status === 'storniert') return { ok: false, status: 409, fehler: 'Die Rechnung ist storniert — bezahlt geht nicht mehr. Bei Bedarf neu stellen.', aktuell: alt };
  const schonBezahlt = alt.status === 'bezahlt';
  const rechnung: Rechnung = schonBezahlt ? alt : { ...alt, status: 'bezahlt', bezahltAm: am };
  const datei = schonBezahlt ? f : { ...f, rechnungen: f.rechnungen.map(r => (r.id === id ? rechnung : r)) };
  return { ok: true, datei, rechnung, schonBezahlt, buchung: rechnung.betrag > 0 ? buchungFuer(rechnung, rechnung.bezahltAm ?? am) : null };
}

// ── Fassung je Eintrag + Stand-Prüfung (28.09., K3 · #107) ────────────────────
// Wie `listePatchen` (lib/store/patch-liste.ts), nur über fünf Listen in EINER
// Sperre: GET liefert je Eintrag `fassung` (Fingerabdruck), der Browser schickt
// sie mit zurück; passt sie nicht mehr, hat inzwischen jemand geändert → 409 mit
// dem aktuellen Eintrag, nichts wird überschrieben. Das Feld heißt hier `fassung`,
// weil `Firma.stand` schon das Datum des Kontostands ist. Gespeichert wird die
// Fassung nie (sauberFile kennt das Feld nicht).

/** Fingerabdruck eines Eintrags — eingewickelt, damit `Firma.stand` (Datum) mitzählt. */
export const fassung = (e: object): string => fingerabdruck({ e } as Record<string, unknown>);

export const FP_LISTEN = ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'] as const;
export type FpListe = typeof FP_LISTEN[number];

/** So geht der Finanzplan an den Browser: jede Zeile der fünf Listen mit `fassung`. */
export function mitFassung(f: FinanzplanFile): FinanzplanFile {
  const aus = { ...f } as FinanzplanFile & Record<string, unknown>;
  for (const l of FP_LISTEN) aus[l] = (f[l] as object[]).map(e => ({ ...e, fassung: fassung(e) })) as never;
  return aus;
}

// ── Rechnungen ab „gestellt“: nicht löschen, nicht umschreiben (28.09., K3 · #50/#81) ──
// Eine gestellte Rechnung liegt beim Kunden — sie wird nicht gelöscht und ihr
// Betrag, ihre Nummer, ihr Datum nicht still geändert. Stattdessen: stornieren
// (`aktion: 'storno'`, mit Datum und Grund). Nachtragen (leer → Wert) bleibt
// erlaubt, weil der Status oft vor der Nummer gesetzt wird.

/** Felder, die ab „gestellt“ feststehen (Nachtragen erlaubt, Ändern nicht). */
export const FEST_AB_GESTELLT = ['betrag', 'nummer', 'datum', 'netto', 'ustSatz'] as const;
const FELD_NAME: Record<typeof FEST_AB_GESTELLT[number], string> = { betrag: 'Betrag', nummer: 'Rechnungsnummer', datum: 'Rechnungsdatum', netto: 'Nettobetrag', ustSatz: 'USt-Satz' };
const RANG: Record<RechnungStatus, number> = { geplant: 0, gestellt: 1, bezahlt: 2, storniert: 3 };
const leerWert = (v: unknown) => v === undefined || v === null || v === '' || v === 0;

/**
 * Darf die Rechnung `alt` so geändert (`neu`) bzw. gelöscht (`neu === null`) werden?
 * null = ja, sonst der Ablehnungstext (HTTP 409).
 */
export function rechnungSchutz(alt: Rechnung | undefined, neu: Rechnung | null): string | null {
  if (!alt) return neu?.status === 'storniert' ? 'Eine Rechnung wird nicht als „storniert“ angelegt.' : null;
  if (neu === null) {
    if (alt.status === 'geplant') return null;
    return `Die Rechnung ist ${alt.status} — sie wird nicht gelöscht, sondern storniert (mit Datum und Grund).`;
  }
  if (alt.status === 'geplant') return neu.status === 'storniert' ? 'Eine geplante Rechnung wird gelöscht, nicht storniert.' : null;
  if (alt.status === 'storniert') {
    return JSON.stringify(neu) === JSON.stringify(alt) ? null : 'Die Rechnung ist storniert — sie bleibt, wie sie ist. Bei Bedarf eine neue anlegen.';
  }
  if (neu.status === 'storniert') return 'Stornieren nur über „stornieren“ (mit Datum und Grund).';
  if (RANG[neu.status] < RANG[alt.status]) {
    return `Die Rechnung ist ${alt.status} — zurück auf „${neu.status}“ geht nicht. Stornieren und neu stellen.`;
  }
  for (const k of FEST_AB_GESTELLT) {
    const a = alt[k], n = neu[k];
    if (a === n || leerWert(a)) continue;
    return `Die Rechnung ist ${alt.status} — ${FELD_NAME[k]} steht fest. Stornieren und neu stellen.`;
  }
  return null;
}

/** Eine Einzeländerung an einer der fünf Listen (PATCH /api/state/finanzplan). `stand` = die Fassung, die der Browser kannte. */
export interface FpOp { liste: FpListe; op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string; stand?: string }
export interface FpKonflikt { liste: FpListe; id: string; grund: 'inzwischen geändert' | 'inzwischen gelöscht'; aktuell?: unknown }

/** Rohe Änderungen lesen. Die Fassung kommt aus `op.stand` oder `eintrag.fassung` (nie aus `Firma.stand` — das ist ein Datum). */
export function fpOpsLesen(roh: unknown[]): FpOp[] {
  const ops: FpOp[] = [];
  for (const o of roh as Record<string, unknown>[]) {
    const l = String(o?.liste ?? '') as FpListe;
    if (!(FP_LISTEN as readonly string[]).includes(l)) continue;
    const eintrag = o.eintrag && typeof o.eintrag === 'object' ? o.eintrag as Record<string, unknown> : undefined;
    const s = typeof o.stand === 'string' && o.stand ? o.stand : typeof o.fassung === 'string' && o.fassung ? o.fassung
      : typeof eintrag?.fassung === 'string' && eintrag.fassung ? eintrag.fassung : undefined;
    if (o.op === 'delete' && typeof o.id === 'string') ops.push({ liste: l, op: 'delete', id: o.id, ...(s ? { stand: s } : {}) });
    else if (o.op === 'upsert' && eintrag) ops.push({ liste: l, op: 'upsert', eintrag, ...(s ? { stand: s } : {}) });
  }
  return ops;
}

export type FpErgebnis =
  | { ok: true; datei: FinanzplanFile; angewandt: number }
  | { ok: false; status: 409; fehler: string; konflikte?: FpKonflikt[] };

/**
 * Rein: Einzeländerungen auf den (gesäuberten) Bestand legen — Stand-Prüfung je Eintrag,
 * Rechnungs-Schutz, dieselbe Säuberung wie beim Vollschreiben. Ein Konflikt oder eine
 * verbotene Änderung lehnt die GANZE Änderung ab (halbe Stände sind schlimmer als eine Nachfrage).
 */
export function fpOpsAnwenden(f: FinanzplanFile, ops: FpOp[]): FpErgebnis {
  const aus = { ...f } as FinanzplanFile;
  const konflikte: FpKonflikt[] = [];
  let angewandt = 0;
  for (const o of ops) {
    const liste = aus[o.liste] as { id: string }[];
    const nachId = new Map(liste.map(x => [x.id, x]));
    const vorher = new Map((f[o.liste] as { id: string }[]).map(x => [x.id, x]));
    const geprueft = o.op === 'upsert'
      ? (sauberFile({ [o.liste]: [o.eintrag] } as Partial<FinanzplanFile>)[o.liste] as { id: string }[])[0]
      : undefined;
    const id = o.op === 'delete' ? o.id! : geprueft?.id;
    if (!id) continue;
    const alt = nachId.get(id);
    if (o.stand !== undefined) {
      const bekannt = vorher.get(id);
      if (!bekannt) { konflikte.push({ liste: o.liste, id, grund: 'inzwischen gelöscht' }); continue; }
      if (fassung(bekannt) !== o.stand) { konflikte.push({ liste: o.liste, id, grund: 'inzwischen geändert', aktuell: { ...bekannt, fassung: fassung(bekannt) } }); continue; }
    }
    if (o.liste === 'rechnungen') {
      const grund = rechnungSchutz(alt as Rechnung | undefined, o.op === 'delete' ? null : geprueft as Rechnung);
      if (grund) return { ok: false, status: 409, fehler: grund, ...(alt ? { konflikte: [{ liste: o.liste, id, grund: 'inzwischen geändert' as const, aktuell: { ...alt, fassung: fassung(alt) } }] } : {}) };
    }
    if (o.op === 'delete') { if (nachId.delete(id)) angewandt++; }
    else if (geprueft) { nachId.set(id, geprueft); angewandt++; }
    (aus[o.liste] as unknown) = Array.from(nachId.values());
  }
  if (konflikte.length) return { ok: false, status: 409, fehler: 'Jemand hat inzwischen geändert — Stand neu geladen, bitte noch einmal.', konflikte };
  return { ok: true, datei: aus, angewandt };
}

/** Rechnungs-Schutz für das Vollschreiben (PUT): jede Rechnung ab „gestellt“ muss bleiben und darf nur erlaubt geändert sein. */
export function rechnungenSchutzVoll(vorher: FinanzplanFile | null, neu: FinanzplanFile): string | null {
  if (!vorher) return null;
  const nachId = new Map(neu.rechnungen.map(r => [r.id, r]));
  for (const alt of vorher.rechnungen) {
    const grund = rechnungSchutz(alt, nachId.get(alt.id) ?? null);
    if (grund) return grund;
  }
  const alteIds = new Set(vorher.rechnungen.map(r => r.id));
  for (const r of neu.rechnungen) if (!alteIds.has(r.id) && r.status === 'storniert') return rechnungSchutz(undefined, r);
  return null;
}

// ── Stornieren (28.09., K3 · #50/#81) ─────────────────────────────────────────
// Storno = Status `storniert` mit Datum und Grund; der Eintrag bleibt. Gab es zur
// Rechnung schon einen Zahlungseingang (`bu-re-<id>`), bekommt er eine
// Gegenbuchung `bu-st-<id>` (negativ, gleicher Betrag) — so steht kein verwaister
// Ist-Eingang in den Buchungen, und gelöscht wird trotzdem nichts.

export const stornoBuchungsId = (rechnungId: string) => `bu-st-${rechnungId}`.slice(0, 40);

/** Gegenbuchung zu einem Zahlungseingang einer stornierten Rechnung. */
export function stornoBuchungFuer(eingang: RechnungsBuchung, r: Rechnung, am: string): RechnungsBuchung {
  return {
    ...eingang, id: stornoBuchungsId(r.id), datum: am, betrag: -Math.abs(eingang.betrag),
    zweck: `Storno${r.nummer ? ` Rechnung ${r.nummer}` : ''}${r.stornoGrund ? ` — ${r.stornoGrund}` : ''}`.slice(0, 200), rechnungId: r.id,
  };
}

export type StornoErgebnis =
  | { ok: true; datei: FinanzplanFile; rechnung: Rechnung; schonStorniert: boolean }
  | { ok: false; status: 400 | 404 | 409; fehler: string; aktuell?: Rechnung };

/** Rein: Rechnung `id` stornieren (nur ab „gestellt“), Datum + Grund Pflicht. `stand` wie bei „bezahlt“. */
export function stornoAnwenden(f: FinanzplanFile, id: string, am: string, grund: string, stand?: string): StornoErgebnis {
  const alt = f.rechnungen.find(r => r.id === id);
  if (!alt) return { ok: false, status: 404, fehler: 'Die Rechnung gibt es nicht (mehr).' };
  if (stand && fassung(alt) !== stand) {
    return { ok: false, status: 409, fehler: 'Jemand hat die Rechnung inzwischen geändert — Stand neu geladen, bitte noch einmal.', aktuell: alt };
  }
  if (alt.status === 'storniert') return { ok: true, datei: f, rechnung: alt, schonStorniert: true };
  if (alt.status === 'geplant') return { ok: false, status: 409, fehler: 'Eine geplante Rechnung wird gelöscht, nicht storniert.', aktuell: alt };
  const g = grund.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (g.length < 3) return { ok: false, status: 400, fehler: 'Bitte einen Grund für das Storno angeben.' };
  const rechnung: Rechnung = { ...alt, status: 'storniert', storniertAm: am, stornoGrund: g };
  return { ok: true, datei: { ...f, rechnungen: f.rechnungen.map(r => (r.id === id ? rechnung : r)) }, rechnung, schonStorniert: false };
}

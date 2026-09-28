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
export type RechnungStatus = 'geplant' | 'gestellt' | 'bezahlt';
export interface Rechnung {
  id: string;
  firmaId: string;
  /** Das Mandat, aus dem die Rechnung stammt (26.09.). */
  mandatId?: string;
  kunde: string;
  titel: string;
  betrag: number;
  status: RechnungStatus;
  faellig?: string;
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

export const STATI: RechnungStatus[] = ['geplant', 'gestellt', 'bezahlt'];

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
      betrag: isFinite(Number(x.betrag)) ? Math.max(0, Math.round(Number(x.betrag))) : 0,
      status: STATI.includes(x.status as RechnungStatus) ? x.status as RechnungStatus : 'geplant',
      faellig: tag(x.faellig),
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
      betrag: isFinite(Number(x.betrag)) ? Math.max(0, Math.round(Number(x.betrag))) : 0,
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
  if (stand && fingerabdruck(alt as unknown as Record<string, unknown>) !== stand) {
    return { ok: false, status: 409, fehler: 'Jemand hat die Rechnung inzwischen geändert — Stand neu geladen, bitte noch einmal.', aktuell: alt };
  }
  const schonBezahlt = alt.status === 'bezahlt';
  const rechnung: Rechnung = schonBezahlt ? alt : { ...alt, status: 'bezahlt', bezahltAm: am };
  const datei = schonBezahlt ? f : { ...f, rechnungen: f.rechnungen.map(r => (r.id === id ? rechnung : r)) };
  return { ok: true, datei, rechnung, schonBezahlt, buchung: rechnung.betrag > 0 ? buchungFuer(rechnung, rechnung.bezahltAm ?? am) : null };
}

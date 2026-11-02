// ─── Produkte & Mandate (rein, getestet) ────────────────────────────────────
// Kevin 25.09.: „Das Mandaten-Abteil auf die linke Seite unter Aufgaben — da
// ist das Thema Produkte und Mandate abgebildet.“ Entscheidungen: eigener
// Bereich (/os/mandate), Sales verlinkt dorthin; je Produkt Zahlen,
// Unterlagen, Produktlinie und Ablauf in Phasen.
// Ein Produkt ist eine Leistung aus dem Katalog (CRM-Liste „leistungen“);
// Mandate und Deals zeigen über leistungId darauf.

import type { CrmBestand, Leistung, Mandat, ChancenStufe } from './typen';
import { imPapierkorb, papierkorbAbgelaufen, papierkorbBis } from '@/lib/eintraege/sicher';
import { istKostenlos as karteKostenlos } from './produkt-karte';
import { honorarMonatswert, monatswertVon, zusatzMonatswert } from './monatswert';

/**
 * Ein kostenloses Produkt (16.10., Abnahme 2 · C7: der Kennzahlen-Check der Treppe steht als Produkt im Katalog): Betrag 0 und Einheit
 * „kostenlos“ — das IST ein Preis (nicht „Preis offen“, nicht „für die Planung unvollständig“). EINE Regel für Katalog und Planung.
 * Seit 19.10. aus der Produkt-Karte (lib/crm/produkt-karte.ts): mit Preis-Teilen = alle Grund-Teile kostenlos, sonst wie bisher.
 */
export const istKostenlos = (l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise'>>): boolean => karteKostenlos(l);

/** Die Linien in ihrer Reihenfolge — weitere (frei eingetragene) folgen alphabetisch. */
export const LINIEN = ['Beratung & Begleitung', 'Workshops & Formate', 'Vermittlung & Provision', 'Software'] as const;
const LINIE_AUS_TYP: Record<Leistung['typ'], string> = {
  retainer: 'Beratung & Begleitung', diagnose: 'Beratung & Begleitung', sprint: 'Beratung & Begleitung',
  workshop: 'Workshops & Formate', vermittlung: 'Vermittlung & Provision', software: 'Software',
};
const STUFE_RANG = { einstieg: 0, kern: 1, premium: 2 } as const;
const STATUS_RANG = { aktiv: 0, entwurf: 1, eingestellt: 2 } as const;
const OFFEN: ChancenStufe[] = ['qualifiziert', 'bedarf', 'diagnose', 'angebot', 'abschluss'];

/** Linie eines Produkts: eingetragen, sonst aus dem Typ. */
export function linieVon(l: Pick<Leistung, 'linie' | 'typ'>): string {
  return l.linie?.trim() || LINIE_AUS_TYP[l.typ] || 'Weitere';
}

/** Produkte nach Linie: bekannte Linien zuerst, darin aktiv vor Entwurf, Einstieg → Kern → Premium. */
export function linienGruppen(leistungen: Leistung[]): { linie: string; produkte: Leistung[] }[] {
  const je = new Map<string, Leistung[]>();
  for (const l of leistungen) je.set(linieVon(l), [...(je.get(linieVon(l)) ?? []), l]);
  const rang = (x: string) => { const i = (LINIEN as readonly string[]).indexOf(x); return i < 0 ? 100 : i; };
  return Array.from(je.entries())
    .sort(([a], [b]) => rang(a) - rang(b) || a.localeCompare(b))
    .map(([linie, produkte]) => ({ linie, produkte: [...produkte].sort((a, b) => STATUS_RANG[a.status] - STATUS_RANG[b.status] || STUFE_RANG[a.stufe] - STUFE_RANG[b.stufe] || a.name.localeCompare(b.name)) }));
}

export interface ProduktZahlen {
  mandateAktiv: number; mandateGesamt: number;
  /** Aktive Mandate, an denen das Produkt als Zusatzmodul hängt (02.11., R2-3 Fund 9 — sein Monatswert zählt in `mrr`, sein Einmalbetrag in `einmalig`). */
  alsZusatz?: number;
  /** Monatliche Honorare der aktiven Mandate (netto). */
  mrr: number;
  /** Einmalige Honorare aller nicht verworfenen Mandate. */
  einmalig: number;
  dealsOffen: number; pipelineWert: number;
  gewonnen: number; verloren: number;
  /** Gewonnen ÷ (gewonnen + verloren) — null ohne abgeschlossenen Deal. */
  quote: number | null;
}

/** Monatswert eines Deals (einmalig zählt einmal, Jahr ÷ 12). */
const dealMonat = (w: { betrag: number; basis: 'monat' | 'jahr' | 'einmalig' }) => (w.basis === 'jahr' ? w.betrag / 12 : w.betrag);

/**
 * Zahlen je Produkt. Seit 02.11. (R2-3 Fund 9) mit der EINEN Monatswert-Regel (lib/crm/monatswert.ts): das Hauptprodukt eines Mandats zählt Honorar + seine
 * eigenen Preis-Teile (Zusatzmodule mit `preisTeilId`), ein Produkt als Zusatzmodul eines anderen Mandats zählt dessen Modul (laufend, jährlich ÷ 12,
 * geplante Sätze; einmalig unter `einmalig`).
 */
export function produktZahlen(l: Pick<Leistung, 'id'>, crm: Pick<CrmBestand, 'mandate' | 'chancen'>): ProduktZahlen {
  const m = crm.mandate.filter(x => x.leistungId === l.id);
  const aktiv = m.filter(x => x.status === 'aktiv');
  const c = crm.chancen.filter(x => x.leistungId === l.id);
  const offen = c.filter(x => OFFEN.includes(x.stufe));
  const gewonnen = c.filter(x => x.stufe === 'gewonnen').length;
  const verloren = c.filter(x => x.stufe === 'verloren').length;
  // Module dieses Produkts an Mandaten eines ANDEREN Hauptprodukts (die eigenen Teile des Hauptprodukts zählen beim Mandat selbst).
  const fremdeModule = crm.mandate.filter(x => x.leistungId !== l.id).flatMap(x => (x.zusatz ?? []).filter(z => z.leistungId === l.id).map(z => ({ m: x, z })));
  const eigeneTeile = (x: Mandat) => (x.zusatz ?? []).filter(z => z.leistungId === l.id && z.leistungId === x.leistungId);
  const rund = (n: number) => Math.round(n * 100) / 100;
  const mrr = aktiv.reduce((s, x) => s + honorarMonatswert(x) + eigeneTeile(x).reduce((a, z) => a + zusatzMonatswert(z), 0), 0)
    + fremdeModule.filter(x => x.m.status === 'aktiv').reduce((s, x) => s + zusatzMonatswert(x.z), 0);
  const einmalModul = (z: NonNullable<Mandat['zusatz']>[number]) => (!z.inklusive && z.honorar?.basis === 'einmalig' ? z.honorar.betragCent / 100 : 0);
  const einmalig = m.filter(x => x.honorar.basis === 'einmalig').reduce((s, x) => s + x.honorar.betrag, 0)
    + m.filter(x => x.status !== 'beendet').reduce((s, x) => s + eigeneTeile(x).reduce((a, z) => a + einmalModul(z), 0), 0)
    + fremdeModule.filter(x => x.m.status !== 'beendet').reduce((s, x) => s + einmalModul(x.z), 0);
  const alsZusatz = new Set(fremdeModule.filter(x => x.m.status === 'aktiv').map(x => x.m.id)).size;
  return {
    mandateAktiv: aktiv.length, mandateGesamt: m.length, ...(alsZusatz ? { alsZusatz } : {}),
    mrr: rund(mrr),
    einmalig: rund(einmalig),
    dealsOffen: offen.length, pipelineWert: Math.round(offen.reduce((s, x) => s + dealMonat(x.wert), 0)),
    gewonnen, verloren, quote: gewonnen + verloren ? gewonnen / (gewonnen + verloren) : null,
  };
}

/** Kennzahlen des ganzen Bestands für den Kopf der Seite. */
export function portfolio(crm: Pick<CrmBestand, 'mandate' | 'leistungen'>): { aktiv: number; mrr: number; ohneProdukt: number; produkteAktiv: number; groessterKunde: { kunde: string; anteil: number } | null } {
  const aktiv = crm.mandate.filter(m => m.status === 'aktiv');
  // Monatswert je Mandat (02.11., R2-3 Fund 9) — dieselbe Regel wie der MRR im CRM (`monatswertVon`, inkl. Zusatzmodule).
  const mrr = Math.round(aktiv.reduce((s, m) => s + monatswertVon(m), 0) * 100) / 100;
  const jeKunde = new Map<string, number>();
  for (const m of aktiv) if (monatswertVon(m) > 0) jeKunde.set(m.kunde, (jeKunde.get(m.kunde) ?? 0) + monatswertVon(m));
  const top = Array.from(jeKunde.entries()).sort((a, b) => b[1] - a[1])[0];
  return {
    aktiv: aktiv.length, mrr,
    ohneProdukt: crm.mandate.filter(m => m.status !== 'beendet' && !m.leistungId).length,
    produkteAktiv: crm.leistungen.filter(l => l.status === 'aktiv' && !imPapierkorb(l)).length,
    groessterKunde: top && mrr ? { kunde: top[0], anteil: top[1] / mrr } : null,
  };
}

/** Wo steht ein Mandat im Ablauf seines Produkts? null ohne Produkt oder Phasen. */
export function mandatPhase(m: Pick<Mandat, 'phase'>, l: Pick<Leistung, 'phasen'> | undefined): { nr: number; von: number; name: string; naechste?: string } | null {
  const ph = l?.phasen ?? [];
  if (!ph.length) return null;
  const i = Math.max(0, ph.findIndex(p => p.id === m.phase));
  return { nr: i + 1, von: ph.length, name: ph[i].name, ...(ph[i + 1] ? { naechste: ph[i + 1].name } : {}) };
}

/** Neue Phase-Id, die es im Produkt noch nicht gibt. */
export function neuePhasenId(l: Pick<Leistung, 'phasen'>): string {
  const da = new Set((l.phasen ?? []).map(p => p.id));
  let i = (l.phasen ?? []).length + 1;
  while (da.has(`p${i}`)) i++;
  return `p${i}`;
}

// ── Archiv und Papierkorb der Produkte (04.10., Kevin: „man kann keine Produkte löschen“) ─────────────────────────
// Archivieren = Status „eingestellt“ (bleibt an Deals und Mandaten lesbar, steht unter „Archiv“) und merkt den Status davor
// (`statusVorArchiv`); Zurückholen stellt ihn wieder her (Kevin 04.10.: „wieder aktiv“) — „aktiv“ nur mit Leistungstext
// (dieselbe Regel wie beim Anlegen, sonst „Entwurf“). Löschen = Papierkorb
// (`geloeschtAm`, lib/eintraege/sicher.ts), 30 Tage; endgültig nur, wenn nichts mehr darauf zeigt.

export type ProduktZustand = 'aktiv' | 'archiv' | 'papierkorb';
/** Wo ein Produkt steht: Papierkorb vor Archiv (eingestellt) vor aktiv (aktiv/Entwurf). */
export const produktZustand = (l: Pick<Leistung, 'status' | 'geloeschtAm'>): ProduktZustand => (imPapierkorb(l) ? 'papierkorb' : l.status === 'eingestellt' ? 'archiv' : 'aktiv');
/** Wählbar in Mandat, Deal, Angebot und Planung: nicht im Papierkorb und nicht eingestellt. */
export const produktWaehlbar = (l: Pick<Leistung, 'status' | 'geloeschtAm'>): boolean => produktZustand(l) === 'aktiv';
/** Archivieren / Zurückholen als Einzelfelder (api.teil). */
export const produktArchivieren = (l: Pick<Leistung, 'status'>): Partial<Leistung> =>
  ({ status: 'eingestellt', ...(l.status === 'aktiv' || l.status === 'entwurf' ? { statusVorArchiv: l.status } : {}) });
/** Zurückholen: der Status vor dem Archivieren (ohne Merker: „aktiv“); „aktiv“ nur, wenn der Leistungstext da ist. */
export const produktZurueck = (l: Pick<Leistung, 'statusVorArchiv'>, aktivErlaubt: boolean): Partial<Leistung> =>
  ({ status: (l.statusVorArchiv ?? 'aktiv') === 'aktiv' && aktivErlaubt ? 'aktiv' : 'entwurf' });

export interface ProduktVerweise {
  mandateLaufend: number; mandate: number; dealsOffen: number; deals: number;
  /**
   * Weitere Verweise (02.11., Prüfung R2-3 Fund 2 — optional, damit alte Aufrufer gleich bleiben): Mandate, an denen das Produkt als Zusatzmodul hängt,
   * Angebote mit einer Position des Produkts, andere Produkte, deren Regel (Anrechnung, inklusive) darauf zeigt, und Rechnungspositionen mit dem
   * Produkt (nur mit `rechnungen`). Solange etwas davon zählt, wird das Produkt nie endgültig gelöscht.
   */
  zusatz?: number; angebote?: number; regeln?: number; rechnungen?: number;
}
type VerweisBestand = Pick<CrmBestand, 'mandate' | 'chancen'> & { angebote?: CrmBestand['angebote']; leistungen?: readonly Pick<Leistung, 'id' | 'regeln'>[] };
/** Rechnungen (nur die Positionen mit Produkt) — für die Zählung, ob eine Rechnung ein Produkt trägt. */
export type VerweisRechnung = { positionen?: readonly { leistungId?: string }[] };
/**
 * Was auf ein Produkt zeigt — „laufend“ = Mandat nicht beendet, „offen“ = Deal noch nicht gewonnen/verloren. EINE Zählung für die Löschsperre
 * (lib/crm/crm-stand.ts), den Papierkorb und den Morgenlauf (`produkteAbgelaufen`): Haupt-Produkt UND Zusatzmodul der Mandate, Deals, Angebots-Positionen,
 * Regeln anderer Produkte (`anrechnung.auf`, `inklusive`) und — mit `rechnungen` — Rechnungspositionen.
 */
export function produktVerweise(id: string, crm: VerweisBestand, rechnungen?: readonly VerweisRechnung[]): ProduktVerweise {
  const m = crm.mandate.filter(x => x.leistungId === id);
  const c = crm.chancen.filter(x => x.leistungId === id);
  const zusatz = crm.mandate.filter(x => (x.zusatz ?? []).some(z => z.leistungId === id && x.leistungId !== id)).length;
  const angebote = (crm.angebote ?? []).filter(a => (a.positionen ?? []).some(p => p.leistungId === id)).length;
  const regeln = (crm.leistungen ?? []).filter(l => l.id !== id && ((l.regeln?.anrechnung?.auf ?? []).includes(id) || (l.regeln?.inklusive ?? []).some(x => x.leistungId === id))).length;
  const rech = rechnungen ? rechnungen.filter(r => (r.positionen ?? []).some(p => p.leistungId === id)).length : 0;
  return {
    mandateLaufend: m.filter(x => x.status !== 'beendet').length, mandate: m.length, dealsOffen: c.filter(x => OFFEN.includes(x.stufe)).length, deals: c.length,
    ...(zusatz ? { zusatz } : {}), ...(angebote ? { angebote } : {}), ...(regeln ? { regeln } : {}), ...(rech ? { rechnungen: rech } : {}),
  };
}
/** Hängt überhaupt etwas am Produkt (dann nie endgültig löschen)? */
export const produktHaengt = (v: ProduktVerweise): boolean => v.mandate + v.deals + (v.zusatz ?? 0) + (v.angebote ?? 0) + (v.regeln ?? 0) + (v.rechnungen ?? 0) > 0;
/** „2 laufende Mandate und 1 offener Deal“ — leer, wenn nichts Laufendes daran hängt. */
export function verweisSatz(v: ProduktVerweise): string {
  const teile = [v.mandateLaufend ? `${v.mandateLaufend} ${v.mandateLaufend === 1 ? 'laufendes Mandat' : 'laufende Mandate'}` : '', v.dealsOffen ? `${v.dealsOffen} ${v.dealsOffen === 1 ? 'offener Deal' : 'offene Deals'}` : '',
    v.zusatz ? `${v.zusatz} ${v.zusatz === 1 ? 'Mandat mit diesem Zusatzmodul' : 'Mandate mit diesem Zusatzmodul'}` : ''].filter(Boolean);
  return teile.join(' und ');
}

export interface ProduktImPapierkorb { id: string; name: string; geloeschtAm: string; bisTag: string; verweise: ProduktVerweise; /** Bleibt über die Frist hinaus, solange etwas daran hängt. */ haengt: boolean }
/** Der Papierkorb der Produkte, neueste zuerst. */
export function produktePapierkorb(crm: Pick<CrmBestand, 'leistungen' | 'mandate' | 'chancen'> & { angebote?: CrmBestand['angebote'] }): ProduktImPapierkorb[] {
  return crm.leistungen.filter(imPapierkorb).map(l => {
    const verweise = produktVerweise(l.id, crm);
    return { id: l.id, name: l.name, geloeschtAm: l.geloeschtAm!, bisTag: papierkorbBis(l.geloeschtAm!), verweise, haengt: produktHaengt(verweise) };
  }).sort((a, b) => b.geloeschtAm.localeCompare(a.geloeschtAm));
}
/**
 * Morgenlauf: Produkte, die länger als 30 Tage im Papierkorb liegen UND an denen nichts mehr hängt (Mandat — auch als Zusatzmodul —, Deal, Angebots-Position,
 * Regel eines anderen Produkts, Rechnungsposition — `produktVerweise`) — nur die gehen endgültig. Alles andere bleibt im Papierkorb (sonst zeigten Verweise ins
 * Leere: ein Zusatzmodul verlöre Name, Deckel und Optionen). `rechnungen` = die Rechnungen des Finanzplans (ohne: keine Zählung der Rechnungen).
 */
export function produkteAbgelaufen(crm: Pick<CrmBestand, 'leistungen' | 'mandate' | 'chancen'> & { angebote?: CrmBestand['angebote'] }, jetzt: string, rechnungen?: readonly VerweisRechnung[]): string[] {
  return crm.leistungen.filter(l => papierkorbAbgelaufen(l, jetzt)).filter(l => !produktHaengt(produktVerweise(l.id, crm, rechnungen))).map(l => l.id);
}

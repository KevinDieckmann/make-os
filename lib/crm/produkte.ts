// ─── Produkte & Mandate (rein, getestet) ────────────────────────────────────
// Kevin 25.09.: „Das Mandaten-Abteil auf die linke Seite unter Aufgaben — da
// ist das Thema Produkte und Mandate abgebildet.“ Entscheidungen: eigener
// Bereich (/os/mandate), Sales verlinkt dorthin; je Produkt Zahlen,
// Unterlagen, Produktlinie und Ablauf in Phasen.
// Ein Produkt ist eine Leistung aus dem Katalog (CRM-Liste „leistungen“);
// Mandate und Deals zeigen über leistungId darauf.

import type { CrmBestand, Leistung, Mandat, ChancenStufe } from './typen';
import { imPapierkorb, papierkorbAbgelaufen, papierkorbBis } from '@/lib/eintraege/sicher';

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

export function produktZahlen(l: Pick<Leistung, 'id'>, crm: Pick<CrmBestand, 'mandate' | 'chancen'>): ProduktZahlen {
  const m = crm.mandate.filter(x => x.leistungId === l.id);
  const aktiv = m.filter(x => x.status === 'aktiv');
  const c = crm.chancen.filter(x => x.leistungId === l.id);
  const offen = c.filter(x => OFFEN.includes(x.stufe));
  const gewonnen = c.filter(x => x.stufe === 'gewonnen').length;
  const verloren = c.filter(x => x.stufe === 'verloren').length;
  return {
    mandateAktiv: aktiv.length, mandateGesamt: m.length,
    mrr: aktiv.filter(x => x.honorar.basis === 'monat').reduce((s, x) => s + x.honorar.betrag, 0),
    einmalig: m.filter(x => x.status !== 'beendet' || x.honorar.basis === 'einmalig').filter(x => x.honorar.basis === 'einmalig').reduce((s, x) => s + x.honorar.betrag, 0),
    dealsOffen: offen.length, pipelineWert: Math.round(offen.reduce((s, x) => s + dealMonat(x.wert), 0)),
    gewonnen, verloren, quote: gewonnen + verloren ? gewonnen / (gewonnen + verloren) : null,
  };
}

/** Kennzahlen des ganzen Bestands für den Kopf der Seite. */
export function portfolio(crm: Pick<CrmBestand, 'mandate' | 'leistungen'>): { aktiv: number; mrr: number; ohneProdukt: number; produkteAktiv: number; groessterKunde: { kunde: string; anteil: number } | null } {
  const aktiv = crm.mandate.filter(m => m.status === 'aktiv');
  const mrr = aktiv.filter(m => m.honorar.basis === 'monat').reduce((s, m) => s + m.honorar.betrag, 0);
  const jeKunde = new Map<string, number>();
  for (const m of aktiv) if (m.honorar.basis === 'monat') jeKunde.set(m.kunde, (jeKunde.get(m.kunde) ?? 0) + m.honorar.betrag);
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
// Archivieren = Status „eingestellt“ (bleibt an Deals und Mandaten lesbar, steht unter „Archiv“); Zurückholen = „Entwurf“
// (aktiv geht ein Produkt erst wieder mit Leistungstext — dieselbe Regel wie beim Anlegen). Löschen = Papierkorb
// (`geloeschtAm`, lib/eintraege/sicher.ts), 30 Tage; endgültig nur, wenn nichts mehr darauf zeigt.

export type ProduktZustand = 'aktiv' | 'archiv' | 'papierkorb';
/** Wo ein Produkt steht: Papierkorb vor Archiv (eingestellt) vor aktiv (aktiv/Entwurf). */
export const produktZustand = (l: Pick<Leistung, 'status' | 'geloeschtAm'>): ProduktZustand => (imPapierkorb(l) ? 'papierkorb' : l.status === 'eingestellt' ? 'archiv' : 'aktiv');
/** Wählbar in Mandat, Deal, Angebot und Planung: nicht im Papierkorb und nicht eingestellt. */
export const produktWaehlbar = (l: Pick<Leistung, 'status' | 'geloeschtAm'>): boolean => produktZustand(l) === 'aktiv';
/** Archivieren / Zurückholen als Einzelfelder (api.teil). */
export const PRODUKT_ARCHIVIEREN = { status: 'eingestellt' } as const satisfies Partial<Leistung>;
export const PRODUKT_ZURUECK = { status: 'entwurf' } as const satisfies Partial<Leistung>;

export interface ProduktVerweise { mandateLaufend: number; mandate: number; dealsOffen: number; deals: number }
/** Was auf ein Produkt zeigt — „laufend“ = Mandat nicht beendet, „offen“ = Deal noch nicht gewonnen/verloren. */
export function produktVerweise(id: string, crm: Pick<CrmBestand, 'mandate' | 'chancen'>): ProduktVerweise {
  const m = crm.mandate.filter(x => x.leistungId === id);
  const c = crm.chancen.filter(x => x.leistungId === id);
  return { mandateLaufend: m.filter(x => x.status !== 'beendet').length, mandate: m.length, dealsOffen: c.filter(x => OFFEN.includes(x.stufe)).length, deals: c.length };
}
/** „2 laufende Mandate und 1 offener Deal“ — leer, wenn nichts Laufendes daran hängt. */
export function verweisSatz(v: ProduktVerweise): string {
  const teile = [v.mandateLaufend ? `${v.mandateLaufend} ${v.mandateLaufend === 1 ? 'laufendes Mandat' : 'laufende Mandate'}` : '', v.dealsOffen ? `${v.dealsOffen} ${v.dealsOffen === 1 ? 'offener Deal' : 'offene Deals'}` : ''].filter(Boolean);
  return teile.join(' und ');
}

export interface ProduktImPapierkorb { id: string; name: string; geloeschtAm: string; bisTag: string; verweise: ProduktVerweise; /** Bleibt über die Frist hinaus, solange etwas daran hängt. */ haengt: boolean }
/** Der Papierkorb der Produkte, neueste zuerst. */
export function produktePapierkorb(crm: Pick<CrmBestand, 'leistungen' | 'mandate' | 'chancen'>): ProduktImPapierkorb[] {
  return crm.leistungen.filter(imPapierkorb).map(l => {
    const verweise = produktVerweise(l.id, crm);
    return { id: l.id, name: l.name, geloeschtAm: l.geloeschtAm!, bisTag: papierkorbBis(l.geloeschtAm!), verweise, haengt: verweise.mandate + verweise.deals > 0 };
  }).sort((a, b) => b.geloeschtAm.localeCompare(a.geloeschtAm));
}
/**
 * Morgenlauf: Produkte, die länger als 30 Tage im Papierkorb liegen UND an denen nichts mehr hängt (Mandat, Deal,
 * Angebots-Position) — nur die gehen endgültig. Alles andere bleibt im Papierkorb (sonst zeigten Verweise ins Leere).
 */
export function produkteAbgelaufen(crm: Pick<CrmBestand, 'leistungen' | 'mandate' | 'chancen'> & { angebote?: CrmBestand['angebote'] }, jetzt: string): string[] {
  const inAngebot = new Set((crm.angebote ?? []).flatMap(a => (a.positionen ?? []).map(p => p.leistungId).filter((x): x is string => !!x)));
  return crm.leistungen.filter(l => papierkorbAbgelaufen(l, jetzt) && !inAngebot.has(l.id)).filter(l => { const v = produktVerweise(l.id, crm); return !v.mandate && !v.deals; }).map(l => l.id);
}

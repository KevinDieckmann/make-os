// ─── MAKE OS — Liquiditäts-Vorschau ─────────────────────────────────────────
// Die Frage, die zählt: Wie viel Geld ist wann da — und wann wird es eng?
//
// Gerechnet wird aus dem, was schon im System steht: Kontostände, gestellte
// und geplante Rechnungen, fällige Zahlungen, wiederkehrende Fixkosten.
// Deterministisch, damit man jeder Zahl ansehen kann, woher sie kommt.
//
// Client-safe: keine Server-Importe.

export interface Firma { id: string; name: string; kontostand: number | null; stand: string | null }
/**
 * Kevins Ansage: „Was bringt es, 3.000 € einzutragen, wenn die Abläufe dahinter
 * nicht funktionieren — Angebotsnummer, Datum und so weiter fehlen." Deshalb
 * trägt eine Rechnung jetzt ihren ganzen Vorgang: vom Angebot bis zum Eingang.
 */
export interface Rechnung {
  id: string;
  kunde: string;
  titel: string;
  betrag: number;
  status: string;
  faellig?: string;
  /** Rechnungsnummer, wie sie beim Kunden liegt. */
  nummer?: string;
  /** Wann gestellt (YYYY-MM-DD). */
  datum?: string;
  /** Angebotsnummer und -datum — der Schritt davor. */
  angebot?: string;
  angebotAm?: string;
  /** Wann das Geld gekommen ist. */
  bezahltAm?: string;
  /** Netto, wenn abweichend gerechnet wird. */
  netto?: number;
  ustSatz?: number;
  /** Leistungszeitraum, für die Buchhaltung. */
  leistungVon?: string;
  leistungBis?: string;
  notiz?: string;
}
export interface Zahlung { id: string; an: string; titel: string; betrag: number; status: string; faellig?: string; firmaId?: string }
export interface Merkposten { id: string; titel: string; betrag: number; art: string; notiz?: string; firmaId?: string }

// ── Privat ist nie Business (Kevin, 24.09.) ─────────────────────────────────
// Die privaten Finanzen leben seit dem Umzug von Malins Cockpit unter
// „Zahlen → Privat“. In den Business-Speichern stehen noch alte Einträge mit
// firmaId „privat“ — die zählen in keiner Business-Rechnung mehr. Was NICHT
// ausdrücklich privat markiert ist, gilt als Business (ältere Einträge ohne
// Firma sind Firmen-Posten; die Prüfliste unter Privat zeigt sie zum Zuordnen).
export const PRIVAT_ID = 'privat';
export const istPrivatPosten = (x: { firmaId?: string; kategorie?: string }) => x.firmaId === PRIVAT_ID || x.kategorie === PRIVAT_ID;
export const nurBusiness = <T extends { firmaId?: string; kategorie?: string }>(l: T[]): T[] => l.filter(x => !istPrivatPosten(x));
export const businessFirmen = <F extends { id: string }>(f: F[]): F[] => f.filter(x => x.id !== PRIVAT_ID);

export interface Bewegung {
  datum: string;
  text: string;
  betrag: number;
  art: 'eingang' | 'ausgang' | 'fix';
  /** Wie sicher ist das Geld? Gestellte Rechnungen sind belastbarer als geplante. */
  sicher: boolean;
  kategorie?: string;
  firmaId?: string;
}

export interface Woche {
  von: string;
  bis: string;
  label: string;
  eingang: number;
  ausgang: number;
  /** Kontostand am Ende der Woche. */
  stand: number;
  bewegungen: Bewegung[];
}

export interface Vorschau {
  start: number;
  wochen: Woche[];
  /** Erste Woche, in der der Stand negativ wird — null wenn es hält. */
  engpass: Woche | null;
  /** Tiefster Punkt im Zeitraum. */
  tiefpunkt: { stand: number; label: string };
  summeEin: number;
  summeAus: number;
  /** Wie viel davon nur geplant und nicht belastbar ist. */
  unsicher: number;
}

const tage = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monatlich wiederkehrende Belastung aus den Merkposten herauslesen. */
export function monatlicheLast(merkposten: Merkposten[]): { text: string; betrag: number }[] {
  const raus: { text: string; betrag: number }[] = [];
  for (const m of merkposten) {
    // Fixkosten stehen als negativer Merkposten mit „monatlich" in der Notiz.
    if (/monatlich/i.test(m.notiz ?? '') && m.betrag < 0) {
      raus.push({ text: m.titel.replace(/^Fixkosten:\s*/i, ''), betrag: Math.abs(m.betrag) });
      continue;
    }
    // Kredite tragen ihre Rate in der Notiz: „Rate 90 €/Monat".
    const rate = (m.notiz ?? '').match(/Rate\s+([\d.]+)\s*€?\s*\/?\s*Monat/i);
    if (rate && m.betrag < 0) raus.push({ text: `${m.titel} (Rate)`, betrag: Math.round(Number(rate[1])) });
  }
  return raus;
}

/**
 * Vorschau über N Wochen. „geplant" zählt nur mit, wenn optimistisch=true —
 * sonst rechnen wir nur mit dem, was wirklich gestellt ist.
 */
export type Rhythmus = 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
export interface Planposten {
  id: string; titel: string; betrag: number; rhythmus: Rhythmus;
  ab: string; bis?: string; sicher: boolean; notiz?: string;
  /** Wessen Geld — erlaubt eine Planung je Firma statt nur im Topf. */
  firmaId?: string;
  /** Wofür — für die Aufschlüsselung nach Kategorien. */
  kategorie?: string;
  /** 0–100: wie wahrscheinlich der Posten eintritt (für Szenarien). */
  wahrscheinlich?: number;
  /** Ersetzt einen importierten Plan-Posten (Excel-Import legt ihn nicht wieder an). */
  ersetzt?: string;
}

/** Die Kategorien, in denen bei uns gedacht wird. */
export const KATEGORIEN: { id: string; label: string; farbe: string; art: 'ein' | 'aus' }[] = [
  { id: 'mandat', label: 'Mandate & Honorare', farbe: '#58D9CD', art: 'ein' },
  { id: 'produkt', label: 'Produkte & Lizenzen', farbe: '#4A6CF7', art: 'ein' },
  { id: 'sonstige-ein', label: 'Sonstige Einnahmen', farbe: '#8A7CE0', art: 'ein' },
  { id: 'personal', label: 'Personal & Gehälter', farbe: '#DE9E63', art: 'aus' },
  { id: 'raum', label: 'Raum & Infrastruktur', farbe: '#B08968', art: 'aus' },
  { id: 'steuern', label: 'Steuern & Abgaben', farbe: '#E4572E', art: 'aus' },
  { id: 'kredite', label: 'Kredite & Tilgung', farbe: '#C9603A', art: 'aus' },
  { id: 'betrieb', label: 'Betrieb & Werkzeuge', farbe: '#8A9BA8', art: 'aus' },
  { id: 'privat', label: 'Privates', farbe: '#58D9CD', art: 'aus' },
];
export const KATEGORIE = Object.fromEntries(KATEGORIEN.map(k => [k.id, k])) as Record<string, typeof KATEGORIEN[number]>;

/** Drei Sichtweisen auf dieselben Zahlen. */
export type Szenario = 'schlecht' | 'real' | 'gut';
export const SZENARIO_LABEL: Record<Szenario, string> = {
  schlecht: 'Wenn es schlecht läuft', real: 'Realistisch', gut: 'Wenn es gut läuft',
};
/** Ab welcher Wahrscheinlichkeit ein unsicherer Eingang im Szenario zählt. */
const SZENARIO_SCHWELLE: Record<Szenario, number> = { schlecht: 100, real: 60, gut: 1 };

/** Fällt der Posten in dieser Woche an? Liefert das Datum oder null. */
function faelligIn(p: Planposten, vonISO: string, bisISO: string): string | null {
  if (p.ab > bisISO) return null;
  if (p.bis && p.bis < vonISO) return null;
  if (p.rhythmus === 'einmalig') return p.ab >= vonISO && p.ab <= bisISO ? p.ab : null;

  // Wiederkehrend: am selben Tag des Monats wie im Startdatum.
  const tag = Number(p.ab.slice(8, 10));
  const von = new Date(`${vonISO}T00:00:00`);
  const bis = new Date(`${bisISO}T00:00:00`);
  for (let d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
    if (d.getDate() !== tag) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso < p.ab) continue;
    const monateSeitStart = (d.getFullYear() - Number(p.ab.slice(0, 4))) * 12 + (d.getMonth() - (Number(p.ab.slice(5, 7)) - 1));
    if (p.rhythmus === 'monatlich') return iso;
    if (p.rhythmus === 'quartal' && monateSeitStart % 3 === 0) return iso;
    if (p.rhythmus === 'jaehrlich' && monateSeitStart % 12 === 0) return iso;
  }
  return null;
}

export function vorschau(
  firmen: Firma[],
  rechnungen: Rechnung[],
  zahlungen: Zahlung[],
  merkposten: Merkposten[],
  heute: string,
  wochenAnzahl = 12,
  optimistisch = false,
  planposten: Planposten[] = [],
  szenario: Szenario = 'real',
  nurFirma?: string,
  /** true: Privates bleibt draußen (Business-Sicht). Standard für alle Firmen-Rechnungen. */
  ohnePrivat = false,
): Vorschau {
  if (ohnePrivat && nurFirma !== PRIVAT_ID) {
    firmen = businessFirmen(firmen); rechnungen = nurBusiness(rechnungen as (Rechnung & { firmaId?: string })[]);
    zahlungen = nurBusiness(zahlungen); merkposten = nurBusiness(merkposten); planposten = nurBusiness(planposten);
  }
  // „optimistisch" bleibt als Kurzform erhalten: es entspricht dem guten Fall.
  const schwelle = optimistisch ? SZENARIO_SCHWELLE.gut : SZENARIO_SCHWELLE[szenario];
  const start = (nurFirma ? firmen.filter(f => f.id === nurFirma) : firmen)
    .reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const fix = monatlicheLast(merkposten);
  const fixSumme = fix.reduce((s, f) => s + f.betrag, 0);

  const heuteD = new Date(`${heute}T00:00:00`);
  const wochen: Woche[] = [];
  let stand = start;
  let summeEin = 0, summeAus = 0, unsicher = 0;

  for (let i = 0; i < wochenAnzahl; i++) {
    const von = tage(heuteD, i * 7);
    const bis = tage(heuteD, i * 7 + 6);
    const vonISO = iso(von), bisISO = iso(bis);
    const bewegungen: Bewegung[] = [];

    // Eingänge: offene Rechnungen mit Fälligkeit in dieser Woche.
    for (const r of rechnungen) {
      if (r.status === 'bezahlt' || !r.betrag) continue;
      if (nurFirma && (r as { firmaId?: string }).firmaId && (r as { firmaId?: string }).firmaId !== nurFirma) continue;
      const geplant = r.status === 'geplant';
      if (geplant && !optimistisch) continue;
      // Ohne Fälligkeit: gestellte in der ersten Woche, geplante in der vierten.
      const faellig = r.faellig ?? iso(tage(heuteD, geplant ? 28 : 7));
      if (faellig < vonISO || faellig > bisISO) continue;
      // Überfälliges landet in der laufenden Woche, nicht in der Vergangenheit.
      bewegungen.push({ datum: faellig, text: `${r.kunde}: ${r.titel}`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: !geplant });
      if (geplant) unsicher += r.betrag;
    }
    // Überfällige Rechnungen in Woche 1 mitnehmen.
    if (i === 0) {
      for (const r of rechnungen) {
        if (r.status === 'bezahlt' || !r.betrag || !r.faellig || r.faellig >= vonISO) continue;
        if (r.status === 'geplant' && !optimistisch) continue;
        bewegungen.push({ datum: r.faellig, text: `${r.kunde}: ${r.titel} (überfällig)`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: false });
        unsicher += r.betrag;
      }
    }

    // Ausgänge: offene Zahlungen.
    for (const z of zahlungen) {
      if (z.status !== 'offen' || !z.betrag) continue;
      if (nurFirma && (z as { firmaId?: string }).firmaId && (z as { firmaId?: string }).firmaId !== nurFirma) continue;
      const faellig = z.faellig ?? iso(tage(heuteD, 14));
      const inWoche = faellig >= vonISO && faellig <= bisISO;
      const ueberfaellig = i === 0 && faellig < vonISO;
      if (!inWoche && !ueberfaellig) continue;
      bewegungen.push({ datum: faellig, text: `${z.an}${ueberfaellig ? ' (überfällig)' : ''}`.slice(0, 60), betrag: -z.betrag, art: 'ausgang', sicher: true });
    }

    // Geplante Posten — wiederkehrend oder einmalig.
    for (const p of planposten) {
      // Filter je Firma: erlaubt eine Planung pro Gesellschaft statt im Topf.
      if (nurFirma && p.firmaId && p.firmaId !== nurFirma) continue;
      const datum = faelligIn(p, vonISO, bisISO);
      if (!datum) continue;
      // Einnahmen zählen nur, wenn sie im gewählten Szenario überhaupt eintreten.
      // Ausgaben, die an unsicheren Einnahmen hängen (z. B. die USt-Zahllast
      // aus geplanten Umsätzen), tragen eine Wahrscheinlichkeit und folgen ihr —
      // sonst stünde im schlechten Fall Steuer auf Umsatz, der nie kam.
      if (!p.sicher && (p.betrag > 0 || p.wahrscheinlich != null)) {
        const chance = p.wahrscheinlich ?? 50;
        if (chance < schwelle) { if (p.betrag > 0) unsicher += p.betrag; continue; }
      }
      bewegungen.push({
        datum, text: p.titel.slice(0, 60), betrag: p.betrag,
        art: p.betrag > 0 ? 'eingang' : 'fix', sicher: p.sicher,
        kategorie: p.kategorie, firmaId: p.firmaId,
      });
      if (!p.sicher && p.betrag > 0) unsicher += p.betrag;
    }

    // Fixkosten aus den Merkposten — nur, solange es keine eigenen Planposten
    // gibt. Sonst würde dasselbe Geld zweimal abgezogen.
    if (fixSumme && i % 4 === 0 && !planposten.length) {
      bewegungen.push({ datum: vonISO, text: `Fixkosten (${fix.map(f => f.text).join(', ')})`.slice(0, 60), betrag: -fixSumme, art: 'fix', sicher: true });
    }

    const eingang = bewegungen.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const ausgang = bewegungen.filter(b => b.betrag < 0).reduce((s, b) => s + Math.abs(b.betrag), 0);
    stand = stand + eingang - ausgang;
    summeEin += eingang; summeAus += ausgang;

    wochen.push({
      von: vonISO, bis: bisISO,
      label: i === 0 ? 'diese Woche' : `KW +${i}`,
      eingang, ausgang, stand,
      bewegungen: bewegungen.sort((a, b) => a.datum.localeCompare(b.datum)),
    });
  }

  const engpass = wochen.find(w => w.stand < 0) ?? null;
  const tief = wochen.reduce((min, w) => (w.stand < min.stand ? { stand: w.stand, label: w.label } : min), { stand: start, label: 'heute' });

  return { start, wochen, engpass, tiefpunkt: tief, summeEin, summeAus, unsicher };
}

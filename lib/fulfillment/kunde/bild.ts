// ─── Fulfillment · Kunde — EIN Bild für alles, was der Kunde sieht (rein, client-sicher; 12.10., Fulfillment extern) ──────────────────────────────
// Rückmeldung 12.10.: „Das ganze Fulfillment massiv überarbeiten — intern wie extern muss alles sauber sein.“ Kunden-Seite, 2-Wochen-Report (PDF + Mail),
// Wirkungsbericht und die Präsentation „Dem Kunden zeigen“ teilen DIESELBEN Bausteine: Phasen-Strahl („hier stehen wir“), Wert-Balken (vorher → jetzt →
// Ziel), Lage mit Ampel und drei Sätzen, erste Erfolge (Quick Wins), „Das braucht es von euch“, nächster Termin. Gerechnet wird NUR hier — die
// Oberfläche (components/os/fulfillment/kunde/bilder.tsx) und die PDFs (lib/fulfillment/kunde/pdf-bild.ts) zeichnen nur.
//
// Regeln (gelten für jeden Kunden-Weg):
//   · Nur geteilte Inhalte: Phasen und Schritte mit `kundeSichtbar`, nie Knoten an Bausteinen, die `fuerKundenFrei` sperrt (die EINE Regel aus
//     lib/fulfillment/prozesse/bausteine.ts — hier als Menge `gesperrt` übergeben), nur geteilte Entscheidungen, Abstimmungspunkte nur, wenn der Kunde
//     beteiligt ist (Freigabe `wer` ≠ intern).
//   · Keine internen Begriffe: Freigabe-Kürzel (F0–F7) heißen „Abstimmungspunkt“ (bzw. tragen den Titel der Abstimmung), Zusätze wie „(nur Prozess)“
//     fallen weg (`kundenText`). Keine Kosten, keine Health, keine Namen außer der Ansprechperson (die setzt der Server).
//   · Du oder Sie nach der Akte der Ansprechperson (ohne Angabe: Sie) — die Wörter stehen in `WORTE`, nie in den Ansichten.
//
// Fallbeispiel (erfunden): „Beispiel Werkzeugbau“ steht in Phase 2 von 4 („Analyse“), 3 von 10 Schritten sind erledigt, die Preisliste wartet seit
// neun Tagen beim Kunden → Ampel gelb „Wir warten auf euren Input“, Satz 3 „Von euch brauchen wir eine Sache — sie wartet seit 9 Tagen.“

import { aktuellerKnoten, ebeneVon, fallFortschritt, inReihenfolge, jetztPhasen, kinderVon, phaseFertig, teilbaum, wartetAufEuch, wertKontoZeilen } from '../regeln';
import { tagePlus, tagVon } from '@/lib/zeit';
import { zielErreichung } from '../prozesse/wert';
import { RHYTHMUS_TEXT, naechsterFallTermin } from '../prozesse/rituale';
import { titelOhneZusatz, kundenLageAus, KUNDEN_LAGE_TEXT } from '../prozesse/darstellung';
import { fallReise, istSammelSchritt, naechsterPunkt, type NaechsterPunkt } from '../prozesse/reise';
import { obSchluessel } from '../prozesse/onboarding';
import type { Fall, FallKnoten, Freigabepunkt, RitualVorlage } from '../typen';
import type { Mandat } from '@/lib/crm/typen';
import { satz, wort } from '@/lib/text/zahlwort';

// ── Anrede und Wörter ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type KundenAnrede = 'du' | 'sie';
/** Du/Sie aus der Akte (`Kontakt.anrede`): nur ein ausdrückliches „Du“ duzt — ohne Angabe gilt Sie (wie der 2-Wochen-Report). */
export const anredeAus = (a: unknown): KundenAnrede => (a === 'Du' || a === 'du' ? 'du' : 'sie');

/** Alle festen Wörter der Kunden-Wege je Anrede — EINE Tabelle (Seite, Report, Präsentation). Du = „ihr/euch“ (ein Team liest mit). */
export const WORTE = {
  du: {
    soWeit: 'So weit sind wir', ziel: 'Euer Ziel', erfolge: 'Erste Erfolge', braucht: 'Das braucht es von euch', naechstes: 'Als Nächstes',
    termin: 'Nächster Termin', takt: 'Unser Takt', unterlagen: 'Unterlagen', puls: 'Wie zufrieden seid ihr?', entscheidungen: 'Gemeinsam entschieden', entscheidungenOffen: 'Noch offen',
    wartetAuf: 'Wartet auf euch', wartetLeer: 'Gerade wartet nichts auf euch — danke!', zielLeer: 'Die Ziele legen wir gemeinsam fest — sie erscheinen hier, sobald sie stehen.',
    erfolgeLeer: 'Die ersten Erfolge planen wir gemeinsam — sie erscheinen hier mit Datum.', naechstesLeer: 'Die nächsten Schritte stimmen wir im nächsten Termin ab.',
    zielSatz: 'Wert-Konto: vorher → jetzt → Ziel. Die Werte tragen wir gemeinsam ein — ein Zielbild, keine Garantie.',
    pulsFrage: 'Wie zufrieden seid ihr gerade mit unserer Zusammenarbeit? 0 = gar nicht, 10 = sehr.',
    pulsDanke: 'Eure Rückmeldung ist angekommen — danke!', pulsZu: 'Gerade ist keine Rückfrage offen.',
    uploadText: 'Ladet hier Unterlagen für das Projekt hoch. Wir prüfen jede Datei, bevor wir mit ihr arbeiten.',
    uploadDanke: 'Danke — die Datei ist sicher bei uns eingegangen. Wir prüfen sie und melden uns, falls etwas fehlt.',
    uploadVoll: 'Über diesen Link sind schon so viele Dateien eingegangen, wie er annimmt — bitte schickt weitere über eure Ansprechperson.',
    formularHinweis: 'Ihr könnt jederzeit zwischenspeichern und später weitermachen — der Link bleibt gleich.',
    formularFertig: 'Danke — alles ist bei uns angekommen. Ihr könnt Antworten jederzeit noch ändern.',
    ansprechperson: 'Eure Ansprechperson', fuerEuch: 'für', gruss: 'Schön, dass ihr da seid.', beiEuch: 'Bei euch',
    ungueltig: 'Bitte wendet euch an eure Ansprechperson — sie schickt euch bei Bedarf einen neuen Link.',
    euch: 'euch', eure: 'eure', euer: 'euer', ihr: 'ihr',
  },
  sie: {
    soWeit: 'So weit sind wir', ziel: 'Ihr Ziel', erfolge: 'Erste Erfolge', braucht: 'Das brauchen wir von Ihnen', naechstes: 'Als Nächstes',
    termin: 'Nächster Termin', takt: 'Unser Takt', unterlagen: 'Unterlagen', puls: 'Wie zufrieden sind Sie?', entscheidungen: 'Gemeinsam entschieden', entscheidungenOffen: 'Noch offen',
    wartetAuf: 'Wartet auf Sie', wartetLeer: 'Gerade wartet nichts auf Sie — vielen Dank!', zielLeer: 'Die Ziele legen wir gemeinsam fest — sie erscheinen hier, sobald sie stehen.',
    erfolgeLeer: 'Die ersten Erfolge planen wir gemeinsam — sie erscheinen hier mit Datum.', naechstesLeer: 'Die nächsten Schritte stimmen wir im nächsten Termin ab.',
    zielSatz: 'Wert-Konto: vorher → jetzt → Ziel. Die Werte tragen wir gemeinsam ein — ein Zielbild, keine Garantie.',
    pulsFrage: 'Wie zufrieden sind Sie gerade mit unserer Zusammenarbeit? 0 = gar nicht, 10 = sehr.',
    pulsDanke: 'Ihre Rückmeldung ist angekommen — vielen Dank!', pulsZu: 'Gerade ist keine Rückfrage offen.',
    uploadText: 'Laden Sie hier Unterlagen für das Projekt hoch. Wir prüfen jede Datei, bevor wir mit ihr arbeiten.',
    uploadDanke: 'Vielen Dank — die Datei ist sicher bei uns eingegangen. Wir prüfen sie und melden uns, falls etwas fehlt.',
    uploadVoll: 'Über diesen Link sind schon so viele Dateien eingegangen, wie er annimmt — bitte senden Sie weitere über Ihre Ansprechperson.',
    formularHinweis: 'Sie können jederzeit zwischenspeichern und später weitermachen — der Link bleibt gleich.',
    formularFertig: 'Vielen Dank — alles ist bei uns angekommen. Sie können Antworten jederzeit noch ändern.',
    ansprechperson: 'Ihre Ansprechperson', fuerEuch: 'für', gruss: 'Schön, dass Sie da sind.', beiEuch: 'Bei Ihnen',
    ungueltig: 'Bitte wenden Sie sich an Ihre Ansprechperson — sie sendet Ihnen bei Bedarf einen neuen Link.',
    euch: 'Sie', eure: 'Ihre', euer: 'Ihr', ihr: 'Sie',
  },
} as const;
export type Worte = (typeof WORTE)[KundenAnrede];

// ── Texte säubern: keine internen Begriffe ──────────────────────────────────────────────────────────────────────────────────────────

/** Ein Freigabe-Kürzel (F0, F7 …) als ganzes Wort. */
const KUERZEL = /\bF\d{1,2}\b/g;

/**
 * Ein Titel, wie der Kunde ihn liest: Freigabe-Kürzel → „Abstimmungspunkt“ (ist der Titel nur „F0 bestätigt“ und der Abstimmungspunkt bekannt, sein
 * Titel), interne Klammer-Zusätze weg, Leerraum geglättet. Rein.
 */
export function kundenText(titel: string, abstimmung?: string): string {
  const roh = String(titel ?? '');
  if (abstimmung && /^\s*F\d{1,2}\b\s*(bestätigt|erteilt|vermerkt|freigegeben)?\s*$/i.test(roh)) return `Abstimmung: ${abstimmung}`;
  // Interne Zusätze („(nur Prozess)“) nur an EINER Stelle (lib/fulfillment/prozesse/darstellung.ts `titelOhneZusatz`) — intern und für Kunden dieselbe.
  const t = titelOhneZusatz(roh).replace(KUERZEL, 'Abstimmungspunkt').replace(/\s+/g, ' ').trim();
  return t || 'Abstimmungspunkt';
}

// ── Entscheidungen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Geteilte Entscheidungen getrennt nach „Entschieden“ (entschieden oder verworfen — beides ist eine Entscheidung) und „Offen“ — EINE Regel für
 * die Kunden-Seite, die Vorschau im Fall und „Dem Kunden zeigen“ (16.10., Abnahme 2 · C6: unter „Gemeinsam entschieden“ stand ein offener Punkt).
 * Die Reihenfolge innerhalb einer Gruppe bleibt, wie sie kommt.
 */
export function entscheidungenTeilen<T extends { status: 'offen' | 'entschieden' | 'verworfen' }>(liste: readonly T[]): { entschieden: T[]; offen: T[] } {
  return { entschieden: liste.filter(x => x.status !== 'offen'), offen: liste.filter(x => x.status === 'offen') };
}

// ── Datum ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** „14.10.2026“ aus einem Tag/ISO-Zeitpunkt (sonst unverändert). */
export const tagText = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** „Di, 14.10.2026“ — für Termine. */
export function tagMitWochentag(t: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return t;
  return `${WOCHENTAG[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]}, ${m[3]}.${m[2]}.${m[1]}`;
}

// ── Die Teile (aus dem Fall) ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KundenPhase {
  titel: string;
  stand: 'erledigt' | 'aktuell' | 'kommt';
  /**
   * Erledigter Anteil der Phase (0–1, zwei Stellen) — nur bei Phasen mit Schritten. DIESELBE Zählung wie intern (`fallReise`: ein Schritt mit seinen
   * Bausteinen ist EINE Zeile): intern „1 von 3“, beim Kunden „33 % der Schritte“ (17.10., dritte Abnahme B5: vorher 20 % aus den Blättern). Die Zahl der
   * Schritte selbst geht nicht an den Kunden (Positivliste unverändert).
   */
  anteil?: number;
  /** Abstimmungspunkt am Ende der Phase (nur, wenn der Kunde beteiligt ist). */
  abstimmung?: { titel: string; erledigt: boolean };
}
export interface KundenWartet { titel: string; seit?: string; frist?: string; ueberfaellig?: true; formular?: string }
/**
 * Ein Hänger des Falls, wie ihn das Cockpit rechnet (`wasHaengt`, lib/fulfillment/prozesse/cockpit.ts) — nur Art, Schwere und Alter in Tagen. Die
 * Kunden-Seite übersetzt ihn nur in Worte (`kundenLage`), nie den internen Text (14.10., Abnahme A3: „im Plan“ neben internem Rot).
 */
export interface KundenHaenger { art: string; schwere: 'rot' | 'gelb'; tage?: number; /** nur „wartet“: sieht der Kunde den Punkt selbst? (Cockpit `kundeSiehtWartend`) */ kundeSieht?: boolean }
export interface KundenWert { name: string; vorher: string; jetzt: string; ziel: string; bis?: string; anteil?: number }
export interface KundenQuickWin { text: string; erledigt: boolean; am?: string; bis?: string }
export interface KundenRitual { titel: string; rhythmus: string; naechster?: string }
export type KundenAmpel = 'gruen' | 'gelb' | 'rot';
export interface KundenLage { ampel: KundenAmpel; titel: string; saetze: string[] }

export interface KundenTeile {
  phasen: KundenPhase[];
  /** Fortschritt des ganzen Falls (0–100; Anteil erledigter Schritte — dieselbe Regel wie intern `fallFortschritt`). */
  fortschritt: number | null;
  erledigt: string[];
  naechstes: string[];
  wartet: KundenWartet[];
  wertKonto: KundenWert[];
  quickWins: KundenQuickWin[];
  rituale: KundenRitual[];
  naechsterTermin?: { titel: string; am: string };
  lage: KundenLage;
}

export interface TeileEingabe {
  fall: Fall | null;
  mandat: Pick<Mandat, 'ziele'>;
  heute: string;
  anrede: KundenAnrede;
  /** Bausteine, die (noch) nicht an Kunden gehen (`kundenGesperrt`). */
  gesperrt: ReadonlySet<string>;
  /** Abstimmungspunkte der Vorlage des Falls (Titel, wer) — ohne: keine Abstimmungen am Strahl. */
  freigaben?: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[];
  /** Baustein-Kennung → öffentlicher Formular-Schlüssel (nur Formulare, die der Kunde über den Link ausfüllt). */
  formulare?: ReadonlyMap<string, string>;
  /** Ritual-Vorlagen (Titel, Rhythmus). */
  rituale?: readonly Pick<RitualVorlage, 'id' | 'titel' | 'rhythmus'>[];
  /** Die Termine mit Bezug zum Mandat (lib/fulfillment/prozesse/termine-server.ts `fallTermine`): Kennung, Tag, ggf. Uhrzeit und Titel. */
  terminTage?: readonly { uid: string; tag: string; von?: string; titel?: string }[];
  /**
   * Öffentliche Schlüssel der Formulare, die der Kunde noch ausfüllt (ein Abschnitt offen) — sie zählen in „Von Ihnen brauchen wir …“ mit, genau wie
   * in der Karte „Das brauchen wir von Ihnen“ (`brauchtAnzahl`; 14.10., Abnahme A3: „nichts nötig“ neben „1 offen“).
   */
  formulareOffen?: readonly string[];
  /**
   * Was intern hängt (dieselbe Rechnung wie das Cockpit `wasHaengt`) — die Lage ist NUR seine Übersetzung (15.10., Abnahme B1: keine eigenen Schwellen
   * mehr). Ohne Angabe hängt nichts.
   */
  haengt?: readonly KundenHaenger[];
}
/** So viele Einträge je Liste zeigt die Zusammenfassung (Report Seite 1); die Kunden-Seite zeigt alle. */
export const KURZ_MAX = 4;

const sichtbarMit = (gesperrt: ReadonlySet<string>) => (k: Pick<FallKnoten, 'kundeSichtbar' | 'status' | 'bausteinId'>) =>
  k.kundeSichtbar === true && k.status !== 'entfaellt' && !(k.bausteinId && gesperrt.has(k.bausteinId));

/**
 * Wie viele Dinge der Kunde gerade liefern soll — EINE Zählung für die Lage („Von Ihnen brauchen wir …“) und die Karte „Das brauchen wir von Ihnen“:
 * alles unter „wartet“ und jedes offene Formular, das nicht schon über ein „wartet“ verlinkt ist.
 */
export function brauchtAnzahl(wartet: readonly Pick<KundenWartet, 'formular'>[], formulareOffen: readonly string[]): number {
  return wartet.length + formulareOffen.filter(f => !wartet.some(w => w.formular === f)).length;
}
/** Ein Formular ist offen, solange ein Abschnitt nicht abgeschlossen ist — EINE Regel für Lage, Karte und Report. */
export const formularOffen = (f: { abschnitte: readonly { fertig: boolean }[] }): boolean => f.abschnitte.some(a => !a.fertig);

/** Die Teile, die der Kunde sieht — EINE Rechnung für Seite, Report, Präsentation. Ohne Fall nur das Wert-Konto des Mandats. */
export function kundenTeile(e: TeileEingabe): KundenTeile {
  const f = e.fall;
  const l = f?.knoten ?? [];
  const sichtbar = sichtbarMit(e.gesperrt);
  const reihe = inReihenfolge(l);
  const akt = f ? aktuellerKnoten(f) : { phase: null, schritt: null };
  // Laufende Phasen: die des Pakets und je angehängtem Zusatzmodul seine (17.10. spät — dieselbe Regel wie die Reise intern, `jetztPhasen`).
  const jetzt = f ? jetztPhasen(f) : new Set<string>();
  const nach = new Map(l.map(k => [k.id, k]));
  const freigabe = new Map((e.freigaben ?? []).map(x => [x.id, x]));
  const abstimmungTitel = (k: Pick<FallKnoten, 'freigabe'>) => { const x = k.freigabe ? freigabe.get(k.freigabe) : undefined; return x && x.wer !== 'intern' ? kundenText(x.titel) : undefined; };

  // Phasen (Ebene 2), nur geteilte — mit Anteil der erledigten Schritte (Blätter darunter) und Abstimmungspunkt am Ende. Die LAUFENDE Phase steht immer
  // da (14.10., Abnahme A3: sonst fehlte „hier stehen wir“, wenn sie nicht geteilt war) — mit neutralem Titel (`kundenText`).
  // Schritte je Phase aus DERSELBEN Rechnung wie intern (`fallReise` — Reise-Zeile, Ablauf), nicht aus den Blättern (17.10., dritte Abnahme B5).
  const schritteJe = new Map((f ? fallReise(f, e.freigaben ?? [], e.heute).phasen : []).map(p => [p.id, { erledigt: p.erledigt, gesamt: p.gesamt }]));
  const phasen: KundenPhase[] = reihe.filter(k => ebeneVon(k, l) === 2 && (sichtbar(k) || (jetzt.has(k.id) && k.status !== 'entfaellt' && !(k.bausteinId && e.gesperrt.has(k.bausteinId))))).map(p => {
    const fertig = phaseFertig(p, l);
    const s = schritteJe.get(p.id);
    const a = abstimmungTitel(p);
    return {
      titel: kundenText(p.titel, a), stand: fertig ? 'erledigt' as const : jetzt.has(p.id) ? 'aktuell' as const : 'kommt' as const,
      ...(s && s.gesamt ? { anteil: fertig ? 1 : Math.round((s.erledigt / s.gesamt) * 100) / 100 } : {}),
      ...(a && p.freigabe ? { abstimmung: { titel: a, erledigt: !!f?.freigaben?.[p.freigabe] } } : {}),
    };
  });

  const seit = tagePlus(e.heute, -14);
  const erledigt = reihe.filter(k => ebeneVon(k, l) >= 2 && sichtbar(k) && k.status === 'erledigt' && k.erledigtAm && tagVon(k.erledigtAm) >= seit && tagVon(k.erledigtAm) <= e.heute)
    .map(k => `${kundenText(k.titel, abstimmungTitel(k))} (${tagText(tagVon(k.erledigtAm!))})`);
  // Als Nächstes: offene, sichtbare Schritte — ein Knoten nur, wenn unter ihm kein offener sichtbarer Schritt steht (dann stehen diese da).
  const offenSichtbar = (k: FallKnoten | undefined) => !!k && sichtbar(k) && (k.status === 'offen' || k.status === 'in_arbeit');
  // Nur die laufende Phase und die danach (Sichtprüfung 12.10.: Schritte aus späten Phasen standen sonst schon heute unter „Als Nächstes“).
  const phasenReihe = reihe.filter(k => ebeneVon(k, l) === 2);
  const jetztIdx = akt.phase ? phasenReihe.findIndex(p => p.id === akt.phase!.id) : -1;
  // Ein angehängtes Zusatzmodul (17.10. spät) läuft daneben — seine laufende Phase zählt mit (ihre Schritte stehen dann unter „Danach in …“).
  const naheIds = jetztIdx >= 0 ? new Set([...phasenReihe.slice(jetztIdx, jetztIdx + 2), ...phasenReihe.filter(p => p.zusatz && jetzt.has(p.id))].flatMap(p => teilbaum(p.id, l))) : null;
  // Ein Sammel-Schritt des Imports („Zugeordnete Bausteine“) steht nie als „Als Nächstes“ da — höchstens seine geteilten Bausteine.
  // 15.10. (Abnahme B1): der ERSTE Eintrag ist DERSELBE nächste Punkt wie intern (`naechsterPunkt` — Fall-Kopf, Cockpit, Leistungstreppe), nur in Kunden-
  // Worten; danach weitere geteilte offene Schritte. Nie eine Phase selbst (Ebene 2 — „Als Nächstes: Diagnose“ neben „Phase 3: Diagnose“).
  const np = f ? kundenNaechsterPunkt(f, e.freigaben ?? [], e.gesperrt, e.heute) : null;
  const punkt = np?.punkt ?? null;
  const anzeigeKnoten = np?.anzeigeId ? nach.get(np.anzeigeId) : undefined;
  const punktText = np?.text ?? null;
  const naechsteKnoten = reihe.filter(k => ebeneVon(k, l) >= 3 && k.id !== punkt?.id && k.id !== anzeigeKnoten?.id && (!naheIds || naheIds.has(k.id)) && offenSichtbar(k) && !istSammelSchritt(k) && !phaseFertig(k, l) && !teilbaum(k.id, l).some(x => x !== k.id && offenSichtbar(nach.get(x))));
  // 17.10. (dritte Abnahme C6): EIN klarer nächster Schritt; was danach kommt, steht mit Kontext da — „Danach: …“ (dieselbe Phase) bzw. „Danach in
  // „<Phase>“: …“ (die nächste) — statt nackter Wörter („Prozess · CRM · Skripte · Einwände“). Eine Frist nur, wenn sie noch nicht verstrichen ist (B4).
  const phaseVon = (k: FallKnoten): FallKnoten | undefined => { let x: FallKnoten | undefined = k; while (x && ebeneVon(x, l) > 2) x = x.elternId ? nach.get(x.elternId) : undefined; return x; };
  const knotenText = (k: FallKnoten) => kundenText(k.titel, abstimmungTitel(k));
  const ersterKnoten = punktText ? undefined : naechsteKnoten[0];
  const erster = punktText ?? (ersterKnoten ? kundenNaechsterText({ art: 'schritt', titel: knotenText(ersterKnoten), ...(ersterKnoten.faelligAm ? { faelligAm: ersterKnoten.faelligAm } : {}) }, e.freigaben ?? [], e.heute) : null);
  const danach = new Map<string, { phase: FallKnoten | undefined; titel: string[] }>();
  for (const k of naechsteKnoten) {
    if (k === ersterKnoten) continue;
    const ph = phaseVon(k);
    const schluessel = ph?.id ?? '';
    if (!danach.has(schluessel)) danach.set(schluessel, { phase: ph, titel: [] });
    // In der Liste „Danach …“ steht ein Abstimmungspunkt als „Abstimmung „Titel““ (kein zweiter Doppelpunkt nach „Danach in „Phase“:“).
    const t = knotenText(k).replace(/^Abstimmung: (.+)$/, 'Abstimmung „$1“');
    const g = danach.get(schluessel)!;
    if (!g.titel.includes(t) && t !== erster) g.titel.push(t);
  }
  const naechstes = [
    ...(erster ? [erster] : []),
    ...[...danach.values()].filter(g => g.titel.length).map(g => danachText(g.phase && g.phase.id !== akt.phase?.id ? kundenText(g.phase.titel, abstimmungTitel(g.phase)) : null, g.titel)),
  ];

  // Wartet auf euch: nur geteilte Entscheidungen, keine gesperrten Knoten — mit Frist und (wenn es ein Formular ist) dem Formular zum Ausfüllen.
  const wartendRoh = f ? wartetAufEuch({ ...f, knoten: l.filter(k => !(k.bausteinId && e.gesperrt.has(k.bausteinId))), entscheidungen: (f.entscheidungen ?? []).filter(x => x.geteilt) }, e.heute) : [];
  const formularVon = (k: FallKnoten | undefined): string | undefined => {
    if (!k || !e.formulare) return undefined;
    if (k.bausteinId && e.formulare.has(k.bausteinId)) return e.formulare.get(k.bausteinId);
    for (const c of kinderVon(k.id, l)) if (c.bausteinId && e.formulare.has(c.bausteinId)) return e.formulare.get(c.bausteinId);
    return undefined;
  };
  const wartet: KundenWartet[] = wartendRoh.map(w => {
    const k = w.art === 'entscheidung' ? undefined : nach.get(w.id);
    const frist = w.art === 'entscheidung' ? f?.entscheidungen.find(x => x.id === w.id)?.frist : k?.faelligAm;
    const fo = formularVon(k);
    return {
      titel: kundenText(w.titel, k ? abstimmungTitel(k) : undefined), ...(w.seit ? { seit: tagText(tagVon(w.seit)) } : {}),
      ...(frist ? { frist: tagText(frist) } : {}), ...(frist && frist < e.heute ? { ueberfaellig: true as const } : {}), ...(fo ? { formular: fo } : {}),
    };
  });

  // Wert-Konto: dieselben Zeilen wie intern (`wertKontoZeilen`) + Anteil des Wegs (`zielErreichung`), nur wenn messbar.
  const wertKonto: KundenWert[] = wertKontoZeilen(f, e.mandat).map(z => {
    const anteil = zielErreichung(f?.wertKonto?.[z.zielId]);
    return { name: z.name, vorher: z.vorher, jetzt: z.jetzt, ziel: z.ziel, ...(z.bis ? { bis: tagText(z.bis) } : {}), ...(anteil != null ? { anteil } : {}) };
  });

  const quickWins: KundenQuickWin[] = [...(f?.quickWins ?? [])].filter(q => q.text?.trim())
    .sort((a, b) => (a.erledigtAm ? 0 : 1) - (b.erledigtAm ? 0 : 1) || (a.erledigtAm && b.erledigtAm ? (a.erledigtAm < b.erledigtAm ? 1 : -1) : (a.bis < b.bis ? -1 : a.bis > b.bis ? 1 : 0)))
    .map(q => ({ text: kundenText(q.text), erledigt: !!q.erledigtAm, ...(q.erledigtAm ? { am: tagText(tagVon(q.erledigtAm)) } : {}), ...(!q.erledigtAm && q.bis ? { bis: tagText(q.bis) } : {}) }));

  // Takt: Rituale des Falls mit dem nächsten Termin (Tag aus `kalender-bezug`); „Nächster Termin“ = DIE Regel `naechsterFallTermin` (wie Takt, Cockpit,
  // Health „Termine“ — 14.10., Abnahme B8), nur mit bekanntem Ritual (Titel).
  const ritNach = new Map((e.rituale ?? []).map(r => [r.id, r]));
  const rituale: KundenRitual[] = (f?.rituale ?? []).map(r => {
    const v = ritNach.get(r.ritualId);
    if (!v) return null;
    const uids = new Set(r.terminUids);
    const tag = (e.terminTage ?? []).filter(t => uids.has(t.uid) && t.tag >= e.heute).map(t => t.tag).sort()[0];
    return { titel: kundenText(v.titel), rhythmus: RHYTHMUS_TEXT[v.rhythmus], ...(tag ? { naechster: tagMitWochentag(tag) } : {}) };
  }).filter((r): r is KundenRitual => !!r);
  const nt = f ? naechsterFallTermin({ fallRituale: (f.rituale ?? []).filter(r => ritNach.has(r.ritualId)), terminTage: e.terminTage ?? [], heute: e.heute, rituale: e.rituale ?? [] }) : null;
  const naechsterTermin = nt ? { titel: kundenText(nt.titel ?? 'Gemeinsamer Termin'), am: tagMitWochentag(nt.tag) } : undefined;

  const fortschritt = f ? fallFortschritt(f) : null;
  const lage = kundenLage({
    phasen, fortschritt, erledigt: erledigt.length, quickWinsErledigt: quickWins.filter(q => q.erledigt).length, naechstes, wertKonto,
    wartetTage: wartendRoh.map(w => w.tage ?? 0), anrede: e.anrede,
    ...(e.formulareOffen ? { braucht: brauchtAnzahl(wartet, e.formulareOffen) } : {}), ...(e.haengt ? { haengt: e.haengt } : {}),
  });
  return {
    phasen, fortschritt, erledigt, naechstes, wartet, wertKonto, quickWins, rituale,
    ...(naechsterTermin ? { naechsterTermin } : {}), lage,
  };
}

// ── Lage: Ampel und drei Sätze ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const AMPEL_KURZ: Record<KundenAmpel, string> = { gruen: 'im Plan', gelb: 'braucht einen Blick', rot: 'braucht ein Gespräch' };

/**
 * „Als Nächstes“ in Kunden-Worten — derselbe Punkt wie intern (`naechsterPunkt`), nur übersetzt: ein Abstimmungspunkt mit dem Kunden heißt „Abstimmung: <Titel>“,
 * einer ohne Kunden „Interne Prüfung: <Titel>“, sonst der Titel ohne interne Kürzel/Zusätze; mit Frist „— bis TT.MM.JJJJ“.
 */
export function kundenNaechsterText(p: Pick<NaechsterPunkt, 'art' | 'titel' | 'freigabe' | 'faelligAm'> & { id?: string }, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[], heute?: string): string {
  const fg = p.art === 'freigabe' && p.freigabe ? freigaben.find(x => x.id === p.freigabe) : undefined;
  const ob = p.id ? obSchluessel(p.id) : null;
  const intern = !!ob && !!OB_KUNDEN_TITEL[ob];
  const titel = fg ? (fg.wer === 'intern' ? `Interne Prüfung: ${kundenText(fg.titel)}` : `Abstimmung: ${kundenText(fg.titel)}`) : p.id ? kundenPunktTitel({ id: p.id, titel: p.titel }) : kundenText(p.titel);
  // 17.10. (dritte Abnahme B4): eine verstrichene Frist ist nie ein Datum für den Kunden; eine interne Reaktionszeit (Willkommensmail) auch nicht.
  return p.faelligAm && !intern && (!heute || p.faelligAm >= heute) ? `${titel} — bis ${tagText(p.faelligAm)}` : titel;
}

/**
 * Onboarding-Schritte in Kunden-Worten — nie der Name einer internen Reaktionszeit (17.10., dritte Abnahme B4: der Kunde las „Willkommen in 24 Stunden —
 * bis 14.10.“ am 17.10.). Ihre Frist ist unsere Uhr, nicht seine — sie steht beim Kunden nie.
 */
const OB_KUNDEN_TITEL: Partial<Record<string, string>> = { willkommen: 'Willkommensmail mit den ersten Schritten' };
/** Der Titel eines Punkts beim Kunden — EINE Übersetzung (Kunden-Seite, Report, Präsentation; Wächter fulfillment-stimmigkeit). */
export function kundenPunktTitel(p: { id: string; titel: string }): string {
  const ob = obSchluessel(p.id);
  return (ob && OB_KUNDEN_TITEL[ob]) || kundenText(p.titel);
}

/** „Danach: a, b, c“ bzw. „Danach in „Phase“: a, b, c und n weitere“ — EIN Format für Kunden-Seite, Report und Reise-Zeile (`naechstesGliedern` liest es). */
export const DANACH_MAX = 4;
export function danachText(phase: string | null, titel: readonly string[]): string {
  const liste = titel.slice(0, DANACH_MAX).join(', ') + (titel.length > DANACH_MAX ? ` und ${titel.length - DANACH_MAX} weitere` : '');
  return phase ? `Danach in „${phase}“: ${liste}` : `Danach: ${liste}`;
}
/** Liest „Als Nächstes“ zurück in Kästchen: was in der laufenden Phase ansteht (`jetzt`) und je spätere Phase ihre Schritte — das Gegenstück zu `danachText`. */
export function naechstesGliedern(naechstes: readonly string[]): { jetzt: string[]; jetztMehr: number; spaeter: { phase: string; titel: string[]; mehr: number }[] } {
  const liste = (s: string) => { const m = / und (\d+) weitere$/.exec(s); return { titel: (m ? s.slice(0, m.index) : s).split(', ').filter(Boolean), mehr: m ? Number(m[1]) : 0 }; };
  const jetzt: string[] = []; let jetztMehr = 0;
  const spaeter: { phase: string; titel: string[]; mehr: number }[] = [];
  for (const t of naechstes) {
    const ph = /^Danach in „(.+?)“: (.+)$/.exec(t);
    if (ph) { spaeter.push({ phase: ph[1], ...liste(ph[2]) }); continue; }
    if (t.startsWith('Danach: ')) { const l = liste(t.slice(8)); jetzt.push(...l.titel); jetztMehr += l.mehr; continue; }
    jetzt.push(t);
  }
  return { jetzt, jetztMehr, spaeter };
}

/**
 * DER nächste Punkt für den Kunden (15.10., Abnahme B1: Fall „Diagnosebericht“, Kunde „Diagnose · Aufbau“, Leistungstreppe „Quartals-Review“) —
 * derselbe Punkt wie intern (`naechsterPunkt`: Fall-Kopf, Cockpit, Leistungstreppe), nur übersetzt. Ist er selbst nicht geteilt, steht der nächste geteilte
 * Schritt darüber (unter der Phase) für ihn — derselbe Punkt in der Ebene, die der Kunde sieht. Wartet er auf den Kunden, steht er unter „Das brauchen wir
 * von Ihnen“ (Text null, nicht doppelt); hängt er an einem gesperrten Baustein ohne geteilten Schritt darüber, nie. Nie eine Phase selbst. Rein.
 */
/** Onboarding-Schritte, die den Kunden betreffen — sie dürfen als „Als Nächstes“ auf seiner Seite stehen (neutrale Muster-Titel). */
const OB_FUER_KUNDE: ReadonlySet<string> = new Set(['willkommen', 'kickoff', 'vereinbarung', 'playbook', 'wertkonto', 'f0']);
export function kundenNaechsterPunkt(f: Fall, freigaben: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[], gesperrt: ReadonlySet<string>, heute: string): { punkt: NaechsterPunkt; text: string | null; anzeigeId?: string } | null {
  const l = f.knoten;
  const nach = new Map(l.map(k => [k.id, k]));
  const sichtbar = sichtbarMit(gesperrt);
  const punkt = naechsterPunkt(f, freigaben, heute);
  if (!punkt) return null;
  const freigabe = new Map(freigaben.map(x => [x.id, x]));
  const abstimmungTitel = (k: Pick<FallKnoten, 'freigabe'>) => { const x = k.freigabe ? freigabe.get(k.freigabe) : undefined; return x && x.wer !== 'intern' ? kundenText(x.titel) : undefined; };
  const punktKnoten = nach.get(punkt.id);
  // Geteilt ist der Punkt, wenn der Kunde ihn sieht — oder er ist ein Onboarding-Schritt, der den Kunden betrifft (neutrale Muster-Titel: Willkommen,
  // Kick-off, Vereinbarung, Playbook, Wert-Konto, erster Abstimmungspunkt; Stakeholder-Karte und Entscheidungs-Log bleiben intern). Ein Abstimmungspunkt
  // ohne Kunden (intern) ist nie geteilt. Ein Baustein, den der Kunde nicht sieht, wird durch seinen geteilten Schritt darüber vertreten. Sonst: kein Text —
  // der Kunde liest dann den nächsten geteilten Schritt, intern steht „Der Kunde sieht als Nächstes: …“ (Fall-Kopf).
  const ob = punktKnoten ? obSchluessel(punktKnoten.id) : null;
  const fg = punkt.art === 'freigabe' && punkt.freigabe ? freigabe.get(punkt.freigabe) : undefined;
  const geteilt = punkt.art === 'freigabe' ? !!fg && fg.wer !== 'intern'
    : !!punktKnoten && (sichtbar(punktKnoten) || (!!ob && OB_FUER_KUNDE.has(ob) && !(punktKnoten.bausteinId && gesperrt.has(punktKnoten.bausteinId))));
  let anzeige: FallKnoten | undefined;
  if (!geteilt && punkt.art !== 'freigabe' && punktKnoten?.bausteinId) {
    for (let x = punktKnoten.elternId ? nach.get(punktKnoten.elternId) : undefined; x && ebeneVon(x, l) >= 3; x = x.elternId ? nach.get(x.elternId) : undefined) if (sichtbar(x)) { anzeige = x; break; }
  }
  const text = punkt.zustand === 'wartet_kunde' ? null
    : geteilt ? kundenNaechsterText(punkt, freigaben, heute)
      : anzeige ? kundenNaechsterText({ art: 'schritt', titel: kundenText(anzeige.titel, abstimmungTitel(anzeige)), ...(anzeige.faelligAm ? { faelligAm: anzeige.faelligAm } : {}) }, freigaben, heute)
        : null;
  return { punkt, text, ...(anzeige ? { anzeigeId: anzeige.id } : {}) };
}

/**
 * Die Lage in Worten (Kunden-Sicht): Ampel und Titel sind die ÜBERSETZUNG der internen Rechnung (`kundenLageAus` aus den Hängern des Cockpits,
 * lib/fulfillment/prozesse/darstellung.ts — 15.10., Abnahme B1: keine eigenen Schwellen mehr): wartet beim Kunden (gelb, rot ab 21 Tagen) → „Wir warten auf …“,
 * nur interne Punkte → „Wir sind dran“, sonst „im Plan“. Health zählt nicht (unsere Einschätzung der Beziehung). Dazu drei Sätze: wo wir stehen · was passiert
 * ist · was wir brauchen. `braucht` = dieselbe Zählung wie die Karte „Das brauchen wir von Ihnen“.
 */
export function kundenLage(e: {
  phasen: readonly KundenPhase[]; fortschritt: number | null; erledigt: number; quickWinsErledigt: number; naechstes: readonly string[];
  wertKonto: readonly KundenWert[]; wartetTage: readonly number[]; anrede: KundenAnrede;
  braucht?: number; haengt?: readonly KundenHaenger[];
}): KundenLage {
  const du = e.anrede === 'du';
  const n = e.phasen.length;
  const j = e.phasen.findIndex(p => p.stand === 'aktuell');
  const alle = n > 0 && e.phasen.every(p => p.stand === 'erledigt');
  const wartetMax = e.wartetTage.length ? Math.max(...e.wartetTage) : -1;
  const prozent = e.fortschritt ? ` — insgesamt ${e.fortschritt === 100 ? 'ist der ganze Weg' : `sind ${e.fortschritt} % des Weges`} geschafft` : '';
  const s1 = alle ? `Alle ${n} ${n === 1 ? 'Phase ist' : 'Phasen sind'} abgeschlossen.`
    : j >= 0 ? `Wir sind in Phase ${j + 1} von ${n} („${e.phasen[j].titel}“)${prozent}.`
      : e.fortschritt ? `Insgesamt ${e.fortschritt === 100 ? 'ist der ganze Weg' : `sind ${e.fortschritt} % des Weges`} geschafft.` : 'Wir haben gemeinsam gestartet.';
  const bestesZiel = [...e.wertKonto].filter(w => w.anteil != null).sort((a, b) => (b.anteil ?? 0) - (a.anteil ?? 0))[0];
  const s2 = e.erledigt > 0 ? `In den letzten zwei Wochen haben wir ${e.erledigt === 1 ? 'einen Schritt' : `${e.erledigt} Schritte`} abgeschlossen.`
    : e.quickWinsErledigt > 0 ? (e.quickWinsErledigt === 1 ? 'Ein erster Erfolg ist schon erreicht.' : `${e.quickWinsErledigt} erste Erfolge sind schon erreicht.`)
      : bestesZiel ? `Beim Ziel „${bestesZiel.name}“ ${bestesZiel.anteil! >= 100 ? 'ist der Zielwert erreicht' : `sind ${bestesZiel.anteil} % des Weges geschafft`}.`
        : e.naechstes.length ? satz(`Als Nächstes steht an: ${e.naechstes[0]}`) : 'Die nächsten Schritte stimmen wir im nächsten Termin ab.';
  const wer = du ? 'euch' : 'Ihnen';
  const anzahl = e.braucht ?? e.wartetTage.length;
  const s3 = !anzahl ? (du ? 'Von euch brauchen wir gerade nichts — danke!' : 'Von Ihnen brauchen wir gerade nichts — vielen Dank!')
    : `Von ${wer} brauchen wir ${anzahl === 1 ? 'eine Sache' : `${anzahl} Dinge`}${wartetMax >= 1 ? ` — ${anzahl === 1 ? 'sie' : 'die älteste'} wartet seit ${wartetMax} ${wartetMax === 1 ? 'Tag' : 'Tagen'}` : ''}.`;
  // Ein wartender Punkt, den der Kunde nicht in seiner Liste sieht, ist für ihn kein „Wir warten auf …“ (sonst stünde daneben „brauchen gerade nichts“).
  const haengt = (e.haengt ?? []).map(h => (h.art === 'wartet' && !anzahl ? { ...h, kundeSieht: false } : h));
  const k = kundenLageAus(haengt, alle);
  return { ampel: k.ampel, titel: KUNDEN_LAGE_TEXT[k.art][du ? 'du' : 'sie'], saetze: [s1, s2, s3] };
}

// ── Zeichen-Modelle (dieselben für Oberfläche und PDF) ───────────────────────────────────────────────────────────────────────────────

/** Eine Phase der Kunden-Reise in der Form der Reise-Zeile (components/os/ui/reise/ReiseBild.tsx `BildSpalte`, Typ lib/reise/bild.ts). */
export interface KundenReiseSpalte {
  id: string; nr: number; titel: string; zustand: 'fertig' | 'jetzt' | 'offen'; unter?: string;
  kaestchen: { id: string; titel: string; zustand: 'hier' | 'offen' }[]; mehr: number;
  raute?: { titel: string; gegeben: boolean };
  band?: { text?: string; achtung?: boolean };
}
/** So viele „als Nächstes“ stehen als Kästchen unter der laufenden Phase (Rest „+n“) — dieselbe Zahl wie intern (`KAESTCHEN_MAX`). */
export const KUNDEN_KAESTCHEN = 4;

/**
 * Die Reise des Kunden als EINE Zeile (17.10., Miro-Standard) — NUR aus den Teilen der Positivliste (`zeitstrahl`, `naechstes`, Zahl „brauchen
 * wir“): Phasen nebeneinander (erledigt · hier stehen wir · kommt), unter der laufenden Phase höchstens vier „als Nächstes“ (das erste hervorgehoben),
 * der Abstimmungspunkt als Raute, im Band („Bei Ihnen“ bzw. „Bei euch“) unter der laufenden Phase, wie viel gerade beim Kunden liegt. Dieselbe Rechnung für Seite, Präsentation und PDF.
 */
export function kundenReise(phasen: readonly KundenPhase[], naechstes: readonly string[], braucht: number): KundenReiseSpalte[] {
  const jetzt = phasen.findIndex(p => p.stand === 'aktuell');
  const g = naechstesGliedern(naechstes);
  return phasen.map((p, i) => {
    const hier = i === jetzt;
    // Unter der laufenden Phase ihre nächsten Schritte; unter einer späteren Phase, was „danach in …“ dort ansteht (17.10., dritte Abnahme C6).
    const spaeter = !hier && p.stand !== 'erledigt' ? g.spaeter.find(x => x.phase === p.titel) : undefined;
    const titel = hier ? g.jetzt : spaeter?.titel ?? [];
    const mehr = Math.max(0, titel.length - KUNDEN_KAESTCHEN) + (hier ? g.jetztMehr : spaeter?.mehr ?? 0);
    return {
      id: `phase-${i + 1}`, nr: i + 1, titel: p.titel, zustand: p.stand === 'erledigt' ? 'fertig' as const : hier ? 'jetzt' as const : 'offen' as const,
      // „33 % der Schritte“ — dieselbe Grundlage wie intern „1 von 3“ (B5), als Anteil übersetzt.
      ...(p.stand === 'erledigt' ? { unter: 'erledigt' } : hier && p.anteil != null ? { unter: `${Math.round(p.anteil * 100)}\u00A0% der Schritte` } : {}),
      kaestchen: titel.slice(0, KUNDEN_KAESTCHEN).map((t, j) => ({ id: `n-${i + 1}-${j + 1}`, titel: t, zustand: hier && j === 0 ? 'hier' as const : 'offen' as const })),
      mehr,
      ...(p.abstimmung ? { raute: { titel: p.abstimmung.titel, gegeben: p.abstimmung.erledigt } } : {}),
      ...(hier && braucht ? { band: { text: `${braucht} ${wort(braucht, 'Punkt', 'Punkte')} offen`, achtung: true } } : {}),
    };
  });
}

export interface StrahlSegment { titel: string; stand: KundenPhase['stand']; von: number; bis: number; fuellung: number; abstimmung?: KundenPhase['abstimmung'] }
/**
 * Der Phasen-Strahl als Geometrie (0–1 je Achse): gleich breite Abschnitte, gefüllt nach Stand (erledigt ganz, aktuell mit dem erledigten Anteil — mindestens
 * ein sichtbarer Anfang —, kommend leer), dazu „hier stehen wir“ (Index) und die Zeile „Phase n von m · Titel“.
 */
export function strahlModell(phasen: readonly KundenPhase[]): { segmente: StrahlSegment[]; jetzt: number; text: string } {
  const n = phasen.length;
  const segmente = phasen.map((p, i) => ({
    titel: p.titel, stand: p.stand, von: i / Math.max(1, n), bis: (i + 1) / Math.max(1, n),
    fuellung: p.stand === 'erledigt' ? 1 : p.stand === 'aktuell' ? Math.max(0.08, Math.min(1, p.anteil ?? 0)) : 0,
    ...(p.abstimmung ? { abstimmung: p.abstimmung } : {}),
  }));
  const jetzt = phasen.findIndex(p => p.stand === 'aktuell');
  const text = jetzt >= 0 ? `Phase ${jetzt + 1} von ${n} · ${phasen[jetzt].titel}` : n && phasen.every(p => p.stand === 'erledigt') ? (n === 1 ? 'Phase abgeschlossen' : `Alle ${n} Phasen abgeschlossen`) : n ? `${n} ${wort(n, 'Phase', 'Phasen')}` : '';
  return { segmente, jetzt, text };
}

/** Ein leeres Ziel (weder vorher noch jetzt noch Ziel) — ein ruhiger Satz statt „vorher — → jetzt — → Ziel —“ (14.10., Abnahme A3). */
export const WERT_LEER_SATZ = 'Ausgangswert und Zielwert legen wir im Kick-off gemeinsam fest.';
const leerWert = (x: string) => !x.trim() || x.trim() === '—';
/** Ein Wert-Balken: Anteil des Wegs (0–1) oder null (nicht messbar), dazu die Zeile „vorher → jetzt → Ziel“ — bzw. bei leerem Ziel der ruhige Satz (`leer`). */
export function wertModell(w: KundenWert): { anteil: number | null; erreicht: boolean; zeile: string; leer?: true } {
  const anteil = w.anteil != null ? Math.max(0, Math.min(1, w.anteil / 100)) : null;
  if (anteil == null && leerWert(w.vorher) && leerWert(w.jetzt) && leerWert(w.ziel)) return { anteil, erreicht: false, zeile: WERT_LEER_SATZ, leer: true };
  return { anteil, erreicht: anteil != null && anteil >= 1, zeile: `${w.vorher} → ${w.jetzt} → ${w.ziel}${w.bis ? ` (bis ${w.bis})` : ''}` };
}

/** Zahl und Einheit nie getrennt (Abnahme B18: „36 / %“ brach um) — für jede Anzeige auf Kunden-Wegen. */
export const ohneUmbruch = (t: string): string => t.replace(/(\d) (%|€|Tage?n?\b)/g, '$1\u00A0$2');

// ── Formulare: wie weit, was fehlt ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Beantwortet/gesamt und offene Pflichtfragen (Text) — für „3 von 8 Fragen“ und verständliche Fehler. */
export function formularZaehlung(fragen: readonly { id: string; frage: string; pflicht?: boolean }[], werte: Readonly<Record<string, string>>): { beantwortet: number; gesamt: number; pflichtOffen: string[] } {
  const da = (id: string) => !!(werte[id] ?? '').trim();
  return { beantwortet: fragen.filter(q => da(q.id)).length, gesamt: fragen.length, pflichtOffen: fragen.filter(q => q.pflicht && !da(q.id)).map(q => q.frage) };
}
/** „3 von 8 Fragen beantwortet“. */
export const fragenText = (z: { beantwortet: number; gesamt: number }) => `${z.beantwortet} von ${z.gesamt} ${z.gesamt === 1 ? 'Frage' : 'Fragen'} beantwortet`;

/** Upload-Status in Worten: „3 eingegangen · 2 geprüft · 1 wird geprüft“. */
export function uploadText(u: { eingegangen: number; geprueft?: number; offen?: number }): string {
  if (!u.eingegangen) return 'Noch keine Datei eingegangen.';
  return [`${u.eingegangen} ${u.eingegangen === 1 ? 'Datei' : 'Dateien'} eingegangen`, u.geprueft ? `${u.geprueft} geprüft` : '', u.offen ? `${u.offen} ${u.offen === 1 ? 'wird' : 'werden'} geprüft` : ''].filter(Boolean).join(' · ') + '.';
}

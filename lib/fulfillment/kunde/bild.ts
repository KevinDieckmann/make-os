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

import { aktuellerKnoten, ebeneVon, fallFortschritt, inReihenfolge, kinderVon, phaseFertig, tageZwischen, teilbaum, wartetAufEuch, wertKontoZeilen } from '../regeln';
import { tagePlus, tagVon } from '@/lib/zeit';
import { zielErreichung } from '../prozesse/wert';
import { RHYTHMUS_TEXT } from '../prozesse/rituale';
import type { Fall, FallKnoten, Freigabepunkt, RitualVorlage } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

// ── Anrede und Wörter ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type KundenAnrede = 'du' | 'sie';
/** Du/Sie aus der Akte (`Kontakt.anrede`): nur ein ausdrückliches „Du“ duzt — ohne Angabe gilt Sie (wie der 2-Wochen-Report). */
export const anredeAus = (a: unknown): KundenAnrede => (a === 'Du' || a === 'du' ? 'du' : 'sie');

/** Alle festen Wörter der Kunden-Wege je Anrede — EINE Tabelle (Seite, Report, Präsentation). Du = „ihr/euch“ (ein Team liest mit). */
export const WORTE = {
  du: {
    soWeit: 'So weit sind wir', ziel: 'Euer Ziel', erfolge: 'Erste Erfolge', braucht: 'Das braucht es von euch', naechstes: 'Als Nächstes',
    termin: 'Nächster Termin', takt: 'Unser Takt', unterlagen: 'Unterlagen', puls: 'Wie zufrieden seid ihr?', entscheidungen: 'Gemeinsam entschieden',
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
    ansprechperson: 'Eure Ansprechperson', fuerEuch: 'für', gruss: 'Schön, dass ihr da seid.',
    ungueltig: 'Bitte wendet euch an eure Ansprechperson — sie schickt euch bei Bedarf einen neuen Link.',
    euch: 'euch', eure: 'eure', euer: 'euer', ihr: 'ihr',
  },
  sie: {
    soWeit: 'So weit sind wir', ziel: 'Ihr Ziel', erfolge: 'Erste Erfolge', braucht: 'Das brauchen wir von Ihnen', naechstes: 'Als Nächstes',
    termin: 'Nächster Termin', takt: 'Unser Takt', unterlagen: 'Unterlagen', puls: 'Wie zufrieden sind Sie?', entscheidungen: 'Gemeinsam entschieden',
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
    ansprechperson: 'Ihre Ansprechperson', fuerEuch: 'für', gruss: 'Schön, dass Sie da sind.',
    ungueltig: 'Bitte wenden Sie sich an Ihre Ansprechperson — sie sendet Ihnen bei Bedarf einen neuen Link.',
    euch: 'Sie', eure: 'Ihre', euer: 'Ihr', ihr: 'Sie',
  },
} as const;
export type Worte = (typeof WORTE)[KundenAnrede];

// ── Texte säubern: keine internen Begriffe ──────────────────────────────────────────────────────────────────────────────────────────

/** Ein Freigabe-Kürzel (F0, F7 …) als ganzes Wort. */
const KUERZEL = /\bF\d{1,2}\b/g;
/** Interne Zusätze in Klammern: „(nur Prozess)“, „(intern)“, „(nur intern …)“. */
const INTERN_ZUSATZ = /\s*\((?:nur\b[^)]*|intern[^)]*)\)/gi;

/**
 * Ein Titel, wie der Kunde ihn liest: Freigabe-Kürzel → „Abstimmungspunkt“ (ist der Titel nur „F0 bestätigt“ und der Abstimmungspunkt bekannt, sein
 * Titel), interne Klammer-Zusätze weg, Leerraum geglättet. Rein.
 */
export function kundenText(titel: string, abstimmung?: string): string {
  const roh = String(titel ?? '');
  if (abstimmung && /^\s*F\d{1,2}\b\s*(bestätigt|erteilt|vermerkt|freigegeben)?\s*$/i.test(roh)) return `Abstimmung: ${abstimmung}`;
  const t = roh.replace(INTERN_ZUSATZ, '').replace(KUERZEL, 'Abstimmungspunkt').replace(/\s+/g, ' ').trim();
  return t || 'Abstimmungspunkt';
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
  /** Erledigter Anteil der Phase (0–1, zwei Stellen) — nur bei Phasen mit Schritten. */
  anteil?: number;
  /** Abstimmungspunkt am Ende der Phase (nur, wenn der Kunde beteiligt ist). */
  abstimmung?: { titel: string; erledigt: boolean };
}
export interface KundenWartet { titel: string; seit?: string; frist?: string; ueberfaellig?: true; formular?: string }
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
  /** Tage der Termine mit Bezug zum Mandat (aus `kalender-bezug`): Kennung des Termins + Tag. */
  terminTage?: readonly { uid: string; tag: string }[];
}

/** Ab so vielen Tagen „wartet“ wird die Lage gelb bzw. rot; ab so vielen Tagen Verzug rot. */
export const LAGE_GRENZEN = { wartetGelb: 7, wartetRot: 21, verzugRot: 14 } as const;
/** So viele Einträge je Liste zeigt die Zusammenfassung (Report Seite 1); die Kunden-Seite zeigt alle. */
export const KURZ_MAX = 4;

const sichtbarMit = (gesperrt: ReadonlySet<string>) => (k: Pick<FallKnoten, 'kundeSichtbar' | 'status' | 'bausteinId'>) =>
  k.kundeSichtbar === true && k.status !== 'entfaellt' && !(k.bausteinId && gesperrt.has(k.bausteinId));

/** Die Teile, die der Kunde sieht — EINE Rechnung für Seite, Report, Präsentation. Ohne Fall nur das Wert-Konto des Mandats. */
export function kundenTeile(e: TeileEingabe): KundenTeile {
  const f = e.fall;
  const l = f?.knoten ?? [];
  const sichtbar = sichtbarMit(e.gesperrt);
  const reihe = inReihenfolge(l);
  const akt = f ? aktuellerKnoten(f) : { phase: null, schritt: null };
  const nach = new Map(l.map(k => [k.id, k]));
  const freigabe = new Map((e.freigaben ?? []).map(x => [x.id, x]));
  const abstimmungTitel = (k: Pick<FallKnoten, 'freigabe'>) => { const x = k.freigabe ? freigabe.get(k.freigabe) : undefined; return x && x.wer !== 'intern' ? kundenText(x.titel) : undefined; };

  // Phasen (Ebene 2), nur geteilte — mit Anteil der erledigten Schritte (Blätter darunter) und Abstimmungspunkt am Ende.
  const phasen: KundenPhase[] = reihe.filter(k => ebeneVon(k, l) === 2 && sichtbar(k)).map(p => {
    const fertig = phaseFertig(p, l);
    const blaetter = teilbaum(p.id, l).filter(x => x !== p.id && kinderVon(x, l).length === 0).map(x => nach.get(x)!).filter(k => k && k.status !== 'entfaellt');
    const a = abstimmungTitel(p);
    return {
      titel: kundenText(p.titel, a), stand: fertig ? 'erledigt' as const : akt.phase?.id === p.id ? 'aktuell' as const : 'kommt' as const,
      ...(blaetter.length ? { anteil: fertig ? 1 : Math.round((blaetter.filter(k => k.status === 'erledigt').length / blaetter.length) * 100) / 100 } : {}),
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
  const naheIds = jetztIdx >= 0 ? new Set(phasenReihe.slice(jetztIdx, jetztIdx + 2).flatMap(p => teilbaum(p.id, l))) : null;
  const naechsteKnoten = reihe.filter(k => ebeneVon(k, l) >= 2 && (!naheIds || naheIds.has(k.id)) && offenSichtbar(k) && !phaseFertig(k, l) && !teilbaum(k.id, l).some(x => x !== k.id && offenSichtbar(nach.get(x)))).slice(0, 5);
  const naechstes = naechsteKnoten.map(k => (k.faelligAm ? `${kundenText(k.titel, abstimmungTitel(k))} — bis ${tagText(k.faelligAm)}` : kundenText(k.titel, abstimmungTitel(k))));
  const verzug = naechsteKnoten.map(k => (k.faelligAm && k.faelligAm < e.heute ? tageZwischen(k.faelligAm, e.heute) ?? 0 : 0));

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

  // Takt: Rituale des Falls mit dem nächsten Termin (Tag aus `kalender-bezug`); der früheste ist „Nächster Termin“.
  const ritNach = new Map((e.rituale ?? []).map(r => [r.id, r]));
  let naechsterTermin: { titel: string; am: string; tag: string } | undefined;
  const rituale: KundenRitual[] = (f?.rituale ?? []).map(r => {
    const v = ritNach.get(r.ritualId);
    if (!v) return null;
    const uids = new Set(r.terminUids);
    const tag = (e.terminTage ?? []).filter(t => uids.has(t.uid) && t.tag >= e.heute).map(t => t.tag).sort()[0];
    if (tag && (!naechsterTermin || tag < naechsterTermin.tag)) naechsterTermin = { titel: kundenText(v.titel), am: tagMitWochentag(tag), tag };
    return { titel: kundenText(v.titel), rhythmus: RHYTHMUS_TEXT[v.rhythmus], ...(tag ? { naechster: tagMitWochentag(tag) } : {}) };
  }).filter((r): r is KundenRitual => !!r);

  const fortschritt = f ? fallFortschritt(f) : null;
  const lage = kundenLage({
    phasen, fortschritt, erledigt: erledigt.length, quickWinsErledigt: quickWins.filter(q => q.erledigt).length, naechstes, wertKonto,
    wartetTage: wartendRoh.map(w => w.tage ?? 0), verzugTage: verzug, anrede: e.anrede,
  });
  return {
    phasen, fortschritt, erledigt, naechstes, wartet, wertKonto, quickWins, rituale,
    ...(naechsterTermin ? { naechsterTermin: { titel: naechsterTermin.titel, am: naechsterTermin.am } } : {}), lage,
  };
}

// ── Lage: Ampel und drei Sätze ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const AMPEL_KURZ: Record<KundenAmpel, string> = { gruen: 'im Plan', gelb: 'braucht einen Blick', rot: 'braucht ein Gespräch' };

/**
 * Die Lage in Worten (Kunden-Sicht): Ampel nach dem, was hakt — beim Kunden (wartet ≥ 7 Tage gelb, ≥ 21 rot) oder bei uns (Schritte über der Frist:
 * gelb, ≥ 14 Tage rot) — und drei Sätze: wo wir stehen · was passiert ist · was wir brauchen. Ehrlich, ohne Health und ohne interne Gründe.
 */
export function kundenLage(e: {
  phasen: readonly KundenPhase[]; fortschritt: number | null; erledigt: number; quickWinsErledigt: number; naechstes: readonly string[];
  wertKonto: readonly KundenWert[]; wartetTage: readonly number[]; verzugTage: readonly number[]; anrede: KundenAnrede;
}): KundenLage {
  const du = e.anrede === 'du';
  const n = e.phasen.length;
  const j = e.phasen.findIndex(p => p.stand === 'aktuell');
  const alle = n > 0 && e.phasen.every(p => p.stand === 'erledigt');
  const wartetMax = e.wartetTage.length ? Math.max(...e.wartetTage) : -1;
  const verzugMax = e.verzugTage.length ? Math.max(...e.verzugTage) : 0;
  const prozent = e.fortschritt ? ` — insgesamt ${e.fortschritt === 100 ? 'ist der ganze Weg' : `sind ${e.fortschritt} % des Weges`} geschafft` : '';
  const s1 = alle ? `Alle ${n} ${n === 1 ? 'Phase ist' : 'Phasen sind'} abgeschlossen.`
    : j >= 0 ? `Wir sind in Phase ${j + 1} von ${n} („${e.phasen[j].titel}“)${prozent}.`
      : e.fortschritt ? `Insgesamt ${e.fortschritt === 100 ? 'ist der ganze Weg' : `sind ${e.fortschritt} % des Weges`} geschafft.` : 'Wir haben gemeinsam gestartet.';
  const bestesZiel = [...e.wertKonto].filter(w => w.anteil != null).sort((a, b) => (b.anteil ?? 0) - (a.anteil ?? 0))[0];
  const s2 = e.erledigt > 0 ? `In den letzten zwei Wochen haben wir ${e.erledigt === 1 ? 'einen Schritt' : `${e.erledigt} Schritte`} abgeschlossen.`
    : e.quickWinsErledigt > 0 ? (e.quickWinsErledigt === 1 ? 'Ein erster Erfolg ist schon erreicht.' : `${e.quickWinsErledigt} erste Erfolge sind schon erreicht.`)
      : bestesZiel ? `Beim Ziel „${bestesZiel.name}“ ${bestesZiel.anteil! >= 100 ? 'ist der Zielwert erreicht' : `sind ${bestesZiel.anteil} % des Weges geschafft`}.`
        : e.naechstes.length ? `Als Nächstes steht an: ${e.naechstes[0]}.` : 'Die nächsten Schritte stimmen wir im nächsten Termin ab.';
  const wer = du ? 'euch' : 'Ihnen';
  const anzahl = e.wartetTage.length;
  const s3 = !anzahl ? (du ? 'Von euch brauchen wir gerade nichts — danke!' : 'Von Ihnen brauchen wir gerade nichts — vielen Dank!')
    : `Von ${wer} brauchen wir ${anzahl === 1 ? 'eine Sache' : `${anzahl} Dinge`}${wartetMax >= 1 ? ` — ${anzahl === 1 ? 'sie' : 'die älteste'} wartet seit ${wartetMax} ${wartetMax === 1 ? 'Tag' : 'Tagen'}` : ''}.`;
  let ampel: KundenAmpel = 'gruen';
  let titel = alle ? 'Alles abgeschlossen' : 'Wir liegen im Plan';
  if (wartetMax >= LAGE_GRENZEN.wartetRot) { ampel = 'rot'; titel = du ? 'Wir kommen gerade nur mit euch weiter' : 'Wir kommen gerade nur mit Ihnen weiter'; }
  else if (verzugMax >= LAGE_GRENZEN.verzugRot) { ampel = 'rot'; titel = du ? 'Wir sind im Verzug — lasst uns kurz sprechen' : 'Wir sind im Verzug — lassen Sie uns kurz sprechen'; }
  else if (wartetMax >= LAGE_GRENZEN.wartetGelb) { ampel = 'gelb'; titel = du ? 'Wir warten auf euren Input' : 'Wir warten auf Ihren Input'; }
  else if (verzugMax > 0) { ampel = 'gelb'; titel = 'Leicht im Verzug'; }
  return { ampel, titel, saetze: [s1, s2, s3] };
}

// ── Zeichen-Modelle (dieselben für Oberfläche und PDF) ───────────────────────────────────────────────────────────────────────────────

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
  const text = jetzt >= 0 ? `Phase ${jetzt + 1} von ${n} · ${phasen[jetzt].titel}` : n && phasen.every(p => p.stand === 'erledigt') ? `Alle ${n} Phasen abgeschlossen` : n ? `${n} Phasen` : '';
  return { segmente, jetzt, text };
}

/** Ein Wert-Balken: Anteil des Wegs (0–1) oder null (nicht messbar), dazu die Zeile „vorher → jetzt → Ziel“. */
export function wertModell(w: KundenWert): { anteil: number | null; erreicht: boolean; zeile: string } {
  const anteil = w.anteil != null ? Math.max(0, Math.min(1, w.anteil / 100)) : null;
  return { anteil, erreicht: anteil != null && anteil >= 1, zeile: `${w.vorher} → ${w.jetzt} → ${w.ziel}${w.bis ? ` (bis ${w.bis})` : ''}` };
}

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

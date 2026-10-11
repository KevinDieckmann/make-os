// ─── Fulfillment · Kunde — die Kunden-Sicht (Positivliste; rein, client-sicher; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4, 6.4) ────────────────────────
// EINE Stelle für „was sieht der Kunde“: die öffentliche Seite (`/kunde/kl-…`) UND die interne Vorschau „So sieht der Kunde es“ bekommen genau dieses
// Objekt (serverseitig gebaut, dieselbe Komponente `KundenAnsicht`). Es enthält NUR die Schlüssel aus `SICHT_SCHLUESSEL` (Wächter mit einem Fall voller
// interner Daten: tests/fulfillment-c2-sicht.test.ts). Was er NIE sieht: Stakeholder-Karte, Haltungen, Notizen, interne Knoten, Health/Ampel, Zahlungen,
// Honorar, Rechnungen, Dossier, Personenteil, Leseteil, Kosten, andere Mandate, die Liste der Dateien, Namen oder Adressen unseres Teams, Kennungen
// anderer Bestände (Formulare tragen einen eigenen Schlüssel `fo-…`, nie die Baustein-Kennung).
// Bausteine nur nach der EINEN Regel `fuerKundenFrei` (lib/fulfillment/prozesse/bausteine.ts, zusammengeführt 11.10.): nie „nur intern“ (Material der
// früheren Agentur), nie „vor Verkauf prüfen“ bzw. „vor Einsatz rechtlich prüfen“, solange nicht als geprüft vermerkt — das gilt für Formulare UND für
// Knoten, die auf einen solchen Baustein zeigen (Zeitstrahl, erledigt, als Nächstes).

import { aktuellerKnoten, ebeneVon, inReihenfolge, kinderVon, teilbaum, wartetAufEuch, wertKontoZeilen } from '../regeln';
import { tagePlus, tagVon } from '@/lib/zeit';
import { abschnitteVon, formularProzent, formularSchluessel, formularStandVon, formulareDesFalls } from './formular';
import { offeneAnfrage } from './puls';
import { HINWEIS_VERSION } from './link';
import { fuerKundenFrei, kundenGesperrt } from '../prozesse/bausteine';
import { RHYTHMUS_TEXT } from '../prozesse/rituale';
import type { Baustein, Fall, FallKnoten, Frage, KundeDatei, RitualVorlage, VorlagenDatei } from '../typen';
import type { Mandat } from '@/lib/crm/typen';

/** Taugt ein Baustein für Kunden? Nur die Regel aus C1 (`fuerKundenFrei`) — hier kein eigenes Urteil. */
export const kundeTauglich = (b: Baustein, d: Pick<VorlagenDatei, 'marken'>): boolean => fuerKundenFrei(b, d).frei;


export interface KundenFrage { id: string; frage: string; art: Frage['art']; optionen?: string[]; pflicht?: boolean; hilfe?: string }
export interface KundenFormular {
  schluessel: string; titel: string; zweck?: string; prozent: number; stand: string;
  abschnitte: { schluessel: string; titel: string; fertig: boolean; fragen: KundenFrage[] }[];
  antworten: Record<string, string>;
}
export interface KundenSicht {
  modus: 'voll' | 'puls';
  firma: string;
  mandat?: string;
  paket?: string;
  stand: string;
  zeitstrahl: { titel: string; stand: 'erledigt' | 'aktuell' | 'kommt' }[];
  erledigt: string[];
  naechstes: string[];
  wartet: { titel: string; seit?: string }[];
  wertKonto: { name: string; vorher: string; jetzt: string; ziel: string; bis?: string }[];
  rituale: { titel: string; rhythmus: string }[];
  entscheidungen: { titel: string; am: string; status: 'offen' | 'entschieden' | 'verworfen'; inhalt?: string }[];
  formulare: KundenFormular[];
  upload: { erlaubt: boolean; eingegangen: number; frei: number } | null;
  puls: { offen: boolean } | null;
  datenschutz: { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] };
}
/** Die erlaubten Schlüssel — Positivliste (oberste Ebene). Ein neuer Schlüssel braucht eine bewusste Änderung HIER und im Wächter. */
export const SICHT_SCHLUESSEL = ['modus', 'firma', 'mandat', 'paket', 'stand', 'zeitstrahl', 'erledigt', 'naechstes', 'wartet', 'wertKonto', 'rituale', 'entscheidungen', 'formulare', 'upload', 'puls', 'datenschutz'] as const;

export interface SichtEingabe {
  modus: 'voll' | 'puls';
  heute: string;
  mandat: Pick<Mandat, 'id' | 'titel' | 'kunde' | 'ziele'>;
  paket?: string;
  fall: Fall | null;
  bausteine: readonly Baustein[];
  /** Marken der Vorlagen-Datei (Vermerk „vor Verkauf geprüft“ = `urheber-geprueft:<id>`) — für `fuerKundenFrei`. */
  marken: VorlagenDatei['marken'];
  rituale: readonly RitualVorlage[];
  kunde: KundeDatei;
  rechte: { formular: boolean; upload: boolean; puls: boolean };
  /** Stand eines Formular-Stands (Fingerabdruck; vom Server). */
  standVon: (f: KundeDatei['formulare'][number]) => string;
  datenschutz: { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] };
  /** Upload-Grenzen je Link (frei = so viele Dateien gehen noch). */
  uploadFrei: number;
  /** Mit Puls-Token: ist genau DIESE Anfrage noch offen? (sonst gilt die jüngste offene Anfrage des Mandats) */
  pulsOffen?: boolean;
}

const tagText = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);
const FERTIG = new Set(['erledigt', 'entfaellt']);
/** Zeigt der Knoten auf einen Baustein, der (noch) nicht an Kunden geht? Dann taucht er auf keinem Kunden-Weg auf (auch nicht unter „wartet“). */
export const knotenGesperrt = (k: Pick<FallKnoten, 'bausteinId'>, gesperrt: ReadonlySet<string>): boolean => !!k.bausteinId && gesperrt.has(k.bausteinId);
const sichtbarMit = (gesperrt: ReadonlySet<string>) => (k: Pick<FallKnoten, 'kundeSichtbar' | 'status' | 'bausteinId'>) =>
  k.kundeSichtbar === true && k.status !== 'entfaellt' && !knotenGesperrt(k, gesperrt);

/** Ist eine Phase (Ebene 2) abgeschlossen? Eigener Status fertig — oder sie hat Blätter, und alle sind fertig (wie lib/fulfillment/regeln.ts). */
function phaseFertig(p: FallKnoten, l: readonly FallKnoten[]): boolean {
  if (FERTIG.has(p.status)) return true;
  const blaetter = teilbaum(p.id, l).filter(x => x !== p.id && kinderVon(x, l).length === 0);
  const nach = new Map(l.map(k => [k.id, k]));
  return blaetter.length > 0 && blaetter.every(x => FERTIG.has(nach.get(x)!.status));
}

/** Die Kunden-Sicht bauen — nur die Schlüssel der Positivliste, nur geteilte Inhalte. Mit `modus: 'puls'` nur Kopf + Puls + Hinweis. */
export function kundenSicht(e: SichtEingabe): KundenSicht {
  const basis = { firma: e.mandat.kunde, stand: tagText(e.heute), datenschutz: { ...e.datenschutz, absaetze: [...e.datenschutz.absaetze] } };
  const pulsOffen = e.pulsOffen ?? !!offeneAnfrage(e.kunde, e.mandat.id, e.heute);
  if (e.modus === 'puls') {
    return { modus: 'puls', ...basis, zeitstrahl: [], erledigt: [], naechstes: [], wartet: [], wertKonto: [], rituale: [], entscheidungen: [], formulare: [], upload: null, puls: { offen: pulsOffen } };
  }
  const f = e.fall;
  const l = f?.knoten ?? [];
  const gesperrt = kundenGesperrt(e.bausteine, { marken: e.marken });
  const sichtbar = sichtbarMit(gesperrt);
  const reihe = inReihenfolge(l);
  const akt = f ? aktuellerKnoten(f) : { phase: null, schritt: null };
  const zeitstrahl = reihe.filter(k => ebeneVon(k, l) === 2 && sichtbar(k))
    .map(k => ({ titel: k.titel, stand: phaseFertig(k, l) ? 'erledigt' as const : akt.phase?.id === k.id ? 'aktuell' as const : 'kommt' as const }));
  const seit = tagePlus(e.heute, -14);
  const erledigt = reihe.filter(k => ebeneVon(k, l) >= 2 && sichtbar(k) && k.status === 'erledigt' && k.erledigtAm && tagVon(k.erledigtAm) >= seit && tagVon(k.erledigtAm) <= e.heute)
    .map(k => `${k.titel} (${tagText(tagVon(k.erledigtAm!))})`);
  // Als Nächstes: offene, sichtbare Schritte — ein Knoten nur, wenn unter ihm kein offener sichtbarer Schritt steht (dann stehen diese da).
  const nach = new Map(l.map(k => [k.id, k]));
  const offenSichtbar = (k: FallKnoten | undefined) => !!k && sichtbar(k) && (k.status === 'offen' || k.status === 'in_arbeit');
  const naechstes = reihe.filter(k => ebeneVon(k, l) >= 2 && offenSichtbar(k) && !phaseFertig(k, l) && !teilbaum(k.id, l).some(x => x !== k.id && offenSichtbar(nach.get(x))))
    .slice(0, 5).map(k => (k.faelligAm ? `${k.titel} — bis ${tagText(k.faelligAm)}` : k.titel));
  const wartet = f ? wartetAufEuch({ ...f, knoten: l.filter(k => !knotenGesperrt(k, gesperrt)) }, e.heute).map(w => ({ titel: w.titel, ...(w.seit ? { seit: tagText(tagVon(w.seit)) } : {}) })) : [];
  const wertKonto = wertKontoZeilen(f, e.mandat).map(z => ({ name: z.name, vorher: z.vorher, jetzt: z.jetzt, ziel: z.ziel, ...(z.bis ? { bis: tagText(z.bis) } : {}) }));
  const ritNach = new Map(e.rituale.map(r => [r.id, r]));
  const rituale = (f?.rituale ?? []).map(r => ritNach.get(r.ritualId)).filter((r): r is RitualVorlage => !!r).map(r => ({ titel: r.titel, rhythmus: RHYTHMUS_TEXT[r.rhythmus] }));
  const entscheidungen = (f?.entscheidungen ?? []).filter(x => x.geteilt).sort((a, b) => (a.am < b.am ? 1 : -1))
    .map(x => ({ titel: x.titel, am: tagText(tagVon(x.am)), status: x.status, ...(x.inhalt ? { inhalt: x.inhalt } : {}) }));
  const formulare: KundenFormular[] = e.rechte.formular
    ? formulareDesFalls(f, e.bausteine).filter(b => b.kundeFuellt === true && kundeTauglich(b, { marken: e.marken })).map(b => {
      const st = formularStandVon(e.kunde, e.mandat.id, b.id);
      return {
        schluessel: formularSchluessel(e.mandat.id, b.id), titel: b.titel, ...(b.zweck ? { zweck: b.zweck } : {}), prozent: formularProzent(b, st), stand: st ? e.standVon(st) : 'neu',
        abschnitte: abschnitteVon(b).map(a => ({ schluessel: a.schluessel, titel: a.titel, fertig: !!st?.fertig.includes(a.schluessel), fragen: a.fragen.map(q => ({ id: q.id, frage: q.frage, art: q.art, ...(q.optionen?.length ? { optionen: [...q.optionen] } : {}), ...(q.pflicht ? { pflicht: true } : {}), ...(q.hilfe ? { hilfe: q.hilfe } : {}) })) })),
        antworten: Object.fromEntries(Object.entries(st?.antworten ?? {}).filter(([k]) => (b.fragen ?? []).some(q => q.id === k))),
      };
    })
    : [];
  const eingegangen = e.kunde.unterlagen.filter(u => u.mandatId === e.mandat.id && u.herkunft === 'kunde').length;
  return {
    modus: 'voll', ...basis, mandat: e.mandat.titel, ...(e.paket ? { paket: e.paket } : {}),
    zeitstrahl, erledigt, naechstes, wartet, wertKonto, rituale, entscheidungen, formulare,
    upload: e.rechte.upload ? { erlaubt: e.uploadFrei > 0, eingegangen, frei: e.uploadFrei } : null,
    puls: e.rechte.puls ? { offen: pulsOffen } : null,
  };
}

/** Der Datenschutzhinweis (Art. 13) der Kunden-Seite — Verantwortlicher aus der Einrichtung, Fristen aus der Löschfristen-Tabelle. Hinweis, keine Rechtsberatung. */
export function kundeHinweis(e: { verantwortlich: string | null; seite: string | null; mandatsdatenMonate: number; unterlagenTage: number }): { verantwortlich: string; seite?: string; fassung: string; absaetze: string[] } {
  const absaetze = [
    'Diese Seite gehört zu eurem Projekt mit uns. Hier seht ihr den Stand, beantwortet Fragen (Playbook) und könnt Unterlagen hochladen.',
    'Zweck und Grundlage: Durchführung unseres Vertrags mit euch (Art. 6 Abs. 1 lit. b DSGVO). Wir speichern eure Antworten, hochgeladene Dateien und eure Rückmeldung (Kunden-Puls) — verschlüsselt auf unserem Server in Deutschland. Kein Tracking, keine Cookies für Werbung.',
    `Speicherdauer: Antworten und Rückmeldungen bis ${e.mandatsdatenMonate} Monate nach Ende der Zusammenarbeit, Dateien bis ${e.unterlagenTage} Tage danach — außer, wir müssen sie als Beleg aufbewahren.`,
    'Ihr habt das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Aufsichtsbehörde. Schreibt uns einfach.',
    'Bitte ladet keine Gesundheitsdaten oder Unterlagen über Dritte hoch, die wir für das Projekt nicht brauchen.',
  ];
  return {
    verantwortlich: e.verantwortlich ?? 'Der Verantwortliche ist noch nicht eingetragen — bitte fragt eure Ansprechperson.',
    ...(e.seite ? { seite: e.seite } : {}),
    fassung: `k${HINWEIS_VERSION}-${e.mandatsdatenMonate}m-${e.unterlagenTage}t`,
    absaetze,
  };
}

/** Zum Wächter: alle Schlüssel (tief) eines Objekts als Pfade (Listen ohne Index). */
export function schluesselPfade(x: unknown, pfad = ''): string[] {
  if (Array.isArray(x)) return Array.from(new Set(x.flatMap(y => schluesselPfade(y, `${pfad}[]`))));
  if (!x || typeof x !== 'object') return [];
  return Object.entries(x as Record<string, unknown>).flatMap(([k, v]) => {
    const p = pfad ? `${pfad}.${k}` : k;
    if (/^(antworten)$/.test(k) && v && typeof v === 'object' && !Array.isArray(v)) return [p];
    return [p, ...schluesselPfade(v, p)];
  });
}

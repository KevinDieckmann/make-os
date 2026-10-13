// ─── Produkte · Fortschritts-Report an den Kunden — Aufbau und Mail-Vorlage (rein, client-sicher, getestet) ──────────
// Entscheidung 10.10.: je aktivem Mandat alle zwei Wochen ein Fortschritts-Report — PDF (erreicht, nächste Schritte, Kennzahlen) und eine
// vorformulierte Mail (Du/Sie nach der Akte), PDF angehängt, gesendet NUR per Klick über den vorhandenen Senden-Weg der Inbox.
// Hier steht nur der Aufbau (dieselbe Quelle für PDF, Vorschau und Mail); das PDF baut lib/crm/treppe-pdf.ts (Server), den Versand
// app/api/inbox/senden (Art. 18, § 7 UWG, Absender = Postfach). Keine festen Namen, Firmen oder Texte einer Instanz.

import type { Mandat } from './typen';
import type { KundenZeile } from './treppe';
import type { TreppenStufe } from './treppe-daten';
import { mandatZieleLesen } from './mandat-ziele';
import type { KundenAnrede, KundenLage, KundenPhase, KundenQuickWin } from '@/lib/fulfillment/kunde/bild';

export interface ReportDokument {
  titel: string;
  kunde: string;
  /** Mandat-Titel (Anzeige unter dem Kunden). */
  mandat: string;
  paket?: string;
  /** Stand (TT.MM.JJJJ). */
  stand: string;
  absender?: string;
  schritt?: string;
  erreicht: string[];
  naechste: string[];
  kennzahlen: { name: string; wert: string }[];
  hinweis: string;
  // ── Fulfillment (C2, 10.10., FULFILLMENT_KONZEPT.md 5.2) — nur mit Fall gesetzt (`mitZusatz`); ohne Fall fehlen sie, und Dokument, PDF und Mail
  //    bleiben Byte für Byte wie vorher. Mit Fall heißen die Abschnitte „Erledigt · Als Nächstes · Wartet auf euch · Wert-Konto · Kunden-Puls“.
  /** Was beim Kunden liegt (Knoten „wartet auf Kunde“, offene Entscheidungen des Kunden) — ältester zuerst. */
  wartetAufEuch?: string[];
  /** Wert-Konto: vorher → jetzt → Ziel je Ziel des Mandats (`anteil` 0–100, wenn messbar — für den Balken). */
  wertKonto?: { name: string; vorher: string; jetzt: string; ziel: string; bis?: string; anteil?: number }[];
  /** Letzter Kunden-Puls (0–10) der letzten 90 Tage. */
  puls?: { wert: number; am: string };
  /** Die Mail fragt nach dem Puls (nur bei aktivem Kunden-Link mit Recht „Puls“) — der Link entsteht erst beim Senden (`PULS_PLATZHALTER`). */
  pulsFrage?: boolean;
  // ── Seit 12.10. (Fulfillment extern, „ein Bild“) — nur mit Fall: dieselben Teile wie die Kunden-Seite (lib/fulfillment/kunde/bild.ts `kundenTeile`).
  //    Seite 1 des PDFs ist die Zusammenfassung (Ampel, drei Sätze, Phasen-Strahl, Wert-Balken, erledigt · als Nächstes · wartet, erste Erfolge, Puls).
  /** Anrede der Ansprechperson (du = „ihr/euch“, sonst Sie) — für die Wörter im PDF. */
  anrede?: KundenAnrede;
  lage?: KundenLage;
  phasen?: KundenPhase[];
  fortschritt?: number;
  quickWins?: KundenQuickWin[];
  naechsterTermin?: { titel: string; am: string };
}

/** Platzhalter, wenn es (noch) nichts gibt — dieselben Sätze wie bisher (die Bytes des Reports ohne Fall bleiben gleich). */
export const ERREICHT_LEER = 'Seit dem letzten Stand: noch nichts abgeschlossen — die nächsten Schritte stehen unten.';
export const NAECHSTE_LEER = 'Die nächsten Schritte stimmen wir im nächsten Termin ab.';

/** Platzhalter für den Puls-Link in der Mail — der Browser ersetzt ihn beim Klick „Senden“ durch den frisch angelegten Link (Konzept 5.2). */
export const PULS_PLATZHALTER = '[Puls-Link]';

/** Der Zusatz aus Fulfillment (lib/fulfillment/kunde/report-zusatz.ts) — ohne Zusatz (kein Fall) bleibt das Dokument genau dasselbe Objekt. */
export function mitZusatz(d: ReportDokument, z: {
  wartetAufEuch: string[]; wertKonto: { name: string; vorher: string; jetzt: string; ziel: string; bis?: string; anteil?: number }[]; puls?: { wert: number; am: string }; pulsFrage?: boolean;
  anrede?: KundenAnrede; lage?: KundenLage; phasen?: KundenPhase[]; fortschritt?: number; erledigt?: string[]; naechstes?: string[]; quickWins?: KundenQuickWin[]; naechsterTermin?: { titel: string; am: string };
} | null): ReportDokument {
  if (!z) return d;
  // Die Ziele stehen dann im Wert-Konto (vorher → jetzt → Ziel) — nicht noch einmal unter „Kennzahlen“.
  const ziele = new Set(z.wertKonto.map(w => w.name));
  // Erledigt/als Nächstes: zuerst die Schritte des Falls (wie die Kunden-Seite), dann die der Leistungstreppe — ohne Doppelte, Platzhalter nur, wenn leer.
  const zusammen = (vorne: readonly string[] | undefined, hinten: readonly string[], leer: string) => {
    const l = Array.from(new Set([...(vorne ?? []), ...hinten.filter(x => x !== leer)]));
    return l.length ? l : [leer];
  };
  return {
    ...d, kennzahlen: d.kennzahlen.filter(k => !ziele.has(k.name)), wartetAufEuch: [...z.wartetAufEuch],
    erreicht: zusammen(z.erledigt, d.erreicht, ERREICHT_LEER), naechste: zusammen(z.naechstes, d.naechste, NAECHSTE_LEER),
    wertKonto: z.wertKonto.map(w => ({ name: w.name, vorher: w.vorher, jetzt: w.jetzt, ziel: w.ziel, ...(w.bis ? { bis: datum(w.bis) } : {}), ...(w.anteil != null ? { anteil: w.anteil } : {}) })),
    ...(z.puls ? { puls: { wert: z.puls.wert, am: datum(z.puls.am) } } : {}), ...(z.pulsFrage ? { pulsFrage: true } : {}),
    ...(z.anrede ? { anrede: z.anrede } : {}), ...(z.lage ? { lage: { ...z.lage, saetze: [...z.lage.saetze] } } : {}), ...(z.phasen ? { phasen: z.phasen.map(p => ({ ...p })) } : {}),
    ...(z.fortschritt != null ? { fortschritt: z.fortschritt } : {}), ...(z.quickWins ? { quickWins: z.quickWins.map(q => ({ ...q })) } : {}),
    ...(z.naechsterTermin ? { naechsterTermin: { ...z.naechsterTermin } } : {}),
  };
}
/** Hat das Dokument den Fulfillment-Zusatz? */
export const hatZusatz = (d: Pick<ReportDokument, 'wartetAufEuch'>): boolean => Array.isArray(d.wartetAufEuch);

const datum = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Der Report eines Kunden — aus der Zeile „Fortschritt im Paket“, der Stufe und den Zielen des Mandats. */
export function reportDokument(z: KundenZeile, stufe: TreppenStufe | null, m: Pick<Mandat, 'kunde' | 'titel' | 'ziele'>, heute: string, absender?: string): ReportDokument {
  const erreicht = [
    ...z.lieferobjekte.filter(x => x.erledigt).map(x => `${x.was}${x.am ? ` (${datum(x.am)})` : ''}`),
    ...(z.schritt && z.schritt.nr > 1 ? [`Schritt ${z.schritt.nr} von ${z.schritt.von} erreicht: ${z.schritt.name}`] : []),
  ];
  const naechste = [
    ...(z.naechster ? [`${z.naechster.text} — bis ${datum(z.naechster.datum)}`] : []),
    ...(z.schritt?.naechste ? [`Nächster Schritt im Ablauf: ${z.schritt.naechste}`] : []),
    ...z.lieferobjekte.filter(x => !x.erledigt).slice(0, 4).map(x => x.was),
  ];
  const kennzahlen = [
    ...(stufe?.kennzahl ? [{ name: 'Woran wir es messen', wert: stufe.kennzahl }] : []),
    ...mandatZieleLesen(m.ziele).map(x => ({ name: x.text, wert: [x.ist ? `Ist: ${x.ist}` : '', x.ziel ? `Ziel: ${x.ziel}` : ''].filter(Boolean).join(' · ') || 'noch offen' })),
    ...(z.lieferobjekte.length ? [{ name: 'Lieferobjekte', wert: `${z.lieferobjekte.filter(x => x.erledigt).length} von ${z.lieferobjekte.length} erledigt` }] : []),
  ];
  return {
    titel: 'Fortschrittsbericht', kunde: m.kunde, mandat: m.titel, ...(stufe ? { paket: stufe.name } : {}), stand: datum(heute),
    ...(absender ? { absender } : {}), ...(z.schritt ? { schritt: `${z.schritt.name} (Schritt ${z.schritt.nr} von ${z.schritt.von})` } : {}),
    erreicht: erreicht.length ? erreicht : [ERREICHT_LEER],
    naechste: naechste.length ? naechste : [NAECHSTE_LEER],
    kennzahlen,
    hinweis: 'Dieser Bericht fasst den Stand aus unserer Projektarbeit zusammen. Fragen oder Ergänzungen gern direkt als Antwort auf die Mail.',
  };
}

export interface MailEntwurfReport { betreff: string; text: string }
/**
 * Die vorformulierte Mail (Vorlage ohne KI): Du oder Sie nach der Akte (ohne Angabe Sie). Kurz, persönlich, der Bericht hängt an.
 * `absender` = Name der sendenden Person (aus dem Konto) — fehlt er, endet die Mail ohne Namen.
 * Ohne Fall bleibt der Text Byte für Byte wie vor C2 (Schnappschuss tests/fulfillment-c2-rein.test.ts). Mit Fall (neu gefasst 12.10., Entscheidung: „kurz und
 * persönlich — ‚Hey …, wollte dich gerade updaten‘“): die Lage in einem Satz, erledigt · als Nächstes · wartet auf euch, das Ziel, der nächste Termin,
 * die Puls-Frage (nur bei aktivem Kunden-Link) und der Hinweis auf den Bericht im Anhang. Die Wörter folgen der Mail-Anrede (Akte der Empfängerin).
 */
export function mailVorlage(e: { anrede?: 'Du' | 'Sie'; vorname?: string; nachname?: string; doc: Pick<ReportDokument, 'kunde' | 'paket' | 'erreicht' | 'naechste' | 'stand'> & Partial<Pick<ReportDokument, 'wartetAufEuch' | 'wertKonto' | 'pulsFrage' | 'lage' | 'naechsterTermin'>>; absender?: string }): MailEntwurfReport {
  const du = e.anrede === 'Du';
  const gruss = du ? `Hey${e.vorname ? ` ${e.vorname}` : ''},` : e.nachname ? `Guten Tag ${[e.vorname, e.nachname].filter(Boolean).join(' ')},` : 'Guten Tag,';
  const punkte = (l: string[]) => l.slice(0, 4).map(x => `- ${x}`).join('\n');
  const betreff = `Fortschritt${e.doc.paket ? ` ${e.doc.paket}` : ''} — Stand ${e.doc.stand}`;
  const ende = [du ? 'Viele Grüße' : 'Freundliche Grüße', ...(e.absender ? [e.absender] : [])];
  if (!hatZusatz(e.doc)) {
    const einstieg = du ? 'ich wollte dich gerade updaten — das ist der Stand:' : 'ich möchte Sie kurz auf den aktuellen Stand bringen:';
    const anhang = du ? 'Den ausführlichen Bericht findest du im Anhang. Melde dich gern, wenn du Fragen hast.' : 'Den ausführlichen Bericht finden Sie im Anhang. Melden Sie sich gern, wenn Sie Fragen haben.';
    return { betreff, text: [gruss, '', einstieg, '', 'Erreicht:', punkte(e.doc.erreicht), '', 'Als Nächstes:', punkte(e.doc.naechste), '', anhang, '', ...ende].join('\n') };
  }
  // Fulfillment (C2, neu gefasst 12.10.): Lage zuerst, dann die drei Listen, das Ziel, der nächste Termin, die Puls-Frage.
  const lage = e.doc.lage;
  const einstieg = du ? `ich wollte dich gerade updaten — kurz der Stand${lage ? `: ${lage.titel}.` : ':'}` : `ich möchte Sie kurz auf den aktuellen Stand bringen${lage ? `: ${lage.titel}.` : ':'}`;
  const wartet = e.doc.wartetAufEuch ?? [];
  const ziele = (e.doc.wertKonto ?? []).slice(0, 4);
  const text = [
    gruss, '', einstieg, ...(lage?.saetze[0] ? [lage.saetze[0]] : []), '',
    'Erledigt:', punkte(e.doc.erreicht), '', 'Als Nächstes:', punkte(e.doc.naechste), '',
    ...(wartet.length ? [du ? 'Wartet auf euch:' : 'Wartet auf Sie:', punkte(wartet), ''] : [du ? 'Von euch brauchen wir gerade nichts — danke!' : 'Von Ihnen brauchen wir gerade nichts — vielen Dank!', '']),
    ...(ziele.length ? [du ? 'Euer Ziel (vorher → jetzt → Ziel):' : 'Ihr Ziel (vorher → jetzt → Ziel):', ziele.map(w => `- ${w.name}: ${w.vorher} → ${w.jetzt} → ${w.ziel}`).join('\n'), ''] : []),
    ...(e.doc.naechsterTermin ? [`Nächster Termin: ${e.doc.naechsterTermin.titel}, ${e.doc.naechsterTermin.am}.`, ''] : []),
    ...(e.doc.pulsFrage ? [du ? `Eine kurze Frage: Wie zufrieden bist du gerade mit unserer Zusammenarbeit (0–10)? Ein Klick genügt: ${PULS_PLATZHALTER}` : `Eine kurze Frage: Wie zufrieden sind Sie gerade mit unserer Zusammenarbeit (0–10)? Ein Klick genügt: ${PULS_PLATZHALTER}`, ''] : []),
    du ? 'Alle Details stehen im Bericht im Anhang. Melde dich gern, wenn du Fragen hast.' : 'Alle Details stehen im Bericht im Anhang. Melden Sie sich gern, wenn Sie Fragen haben.', '',
    ...ende,
  ].join('\n');
  return { betreff, text };
}

/** Dateiname des Reports (nur sichere Zeichen). */
export function reportDateiname(kunde: string, heute: string): string {
  const k = kunde.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Kunde';
  return `Fortschritt-${k}-${heute}.pdf`;
}

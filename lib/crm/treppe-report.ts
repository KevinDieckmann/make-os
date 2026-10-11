// ─── Produkte · Fortschritts-Report an den Kunden — Aufbau und Mail-Vorlage (rein, client-sicher, getestet) ──────────
// Entscheidung 10.10.: je aktivem Mandat alle zwei Wochen ein Fortschritts-Report — PDF (erreicht, nächste Schritte, Kennzahlen) und eine
// vorformulierte Mail (Du/Sie nach der Akte), PDF angehängt, gesendet NUR per Klick über den vorhandenen Senden-Weg der Inbox.
// Hier steht nur der Aufbau (dieselbe Quelle für PDF, Vorschau und Mail); das PDF baut lib/crm/treppe-pdf.ts (Server), den Versand
// app/api/inbox/senden (Art. 18, § 7 UWG, Absender = Postfach). Keine festen Namen, Firmen oder Texte einer Instanz.

import type { Mandat } from './typen';
import type { KundenZeile } from './treppe';
import type { TreppenStufe } from './treppe-daten';
import { mandatZieleLesen } from './mandat-ziele';

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
  /** Wert-Konto: vorher → jetzt → Ziel je Ziel des Mandats. */
  wertKonto?: { name: string; vorher: string; jetzt: string; ziel: string; bis?: string }[];
  /** Letzter Kunden-Puls (0–10) der letzten 90 Tage. */
  puls?: { wert: number; am: string };
  /** Die Mail fragt nach dem Puls (nur bei aktivem Kunden-Link mit Recht „Puls“) — der Link entsteht erst beim Senden (`PULS_PLATZHALTER`). */
  pulsFrage?: boolean;
}

/** Platzhalter für den Puls-Link in der Mail — der Browser ersetzt ihn beim Klick „Senden“ durch den frisch angelegten Link (Konzept 5.2). */
export const PULS_PLATZHALTER = '[Puls-Link]';

/** Der Zusatz aus Fulfillment (lib/fulfillment/kunde/report-zusatz.ts) — ohne Zusatz (kein Fall) bleibt das Dokument genau dasselbe Objekt. */
export function mitZusatz(d: ReportDokument, z: { wartetAufEuch: string[]; wertKonto: { name: string; vorher: string; jetzt: string; ziel: string; bis?: string }[]; puls?: { wert: number; am: string }; pulsFrage?: boolean } | null): ReportDokument {
  if (!z) return d;
  // Die Ziele stehen dann im Wert-Konto (vorher → jetzt → Ziel) — nicht noch einmal unter „Kennzahlen“.
  const ziele = new Set(z.wertKonto.map(w => w.name));
  return {
    ...d, kennzahlen: d.kennzahlen.filter(k => !ziele.has(k.name)), wartetAufEuch: [...z.wartetAufEuch],
    wertKonto: z.wertKonto.map(w => ({ name: w.name, vorher: w.vorher, jetzt: w.jetzt, ziel: w.ziel, ...(w.bis ? { bis: datum(w.bis) } : {}) })),
    ...(z.puls ? { puls: { wert: z.puls.wert, am: datum(z.puls.am) } } : {}), ...(z.pulsFrage ? { pulsFrage: true } : {}),
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
    erreicht: erreicht.length ? erreicht : ['Seit dem letzten Stand: noch nichts abgeschlossen — die nächsten Schritte stehen unten.'],
    naechste: naechste.length ? naechste : ['Die nächsten Schritte stimmen wir im nächsten Termin ab.'],
    kennzahlen,
    hinweis: 'Dieser Bericht fasst den Stand aus unserer Projektarbeit zusammen. Fragen oder Ergänzungen gern direkt als Antwort auf die Mail.',
  };
}

export interface MailEntwurfReport { betreff: string; text: string }
/**
 * Die vorformulierte Mail (Vorlage ohne KI): Du oder Sie nach der Akte (ohne Angabe Sie). Kurz, persönlich, der Bericht hängt an.
 * `absender` = Name der sendenden Person (aus dem Konto) — fehlt er, endet die Mail ohne Namen.
 */
export function mailVorlage(e: { anrede?: 'Du' | 'Sie'; vorname?: string; nachname?: string; doc: Pick<ReportDokument, 'kunde' | 'paket' | 'erreicht' | 'naechste' | 'stand'> & Partial<Pick<ReportDokument, 'wartetAufEuch' | 'wertKonto' | 'pulsFrage'>>; absender?: string }): MailEntwurfReport {
  const du = e.anrede === 'Du';
  const gruss = du ? `Hey${e.vorname ? ` ${e.vorname}` : ''},` : e.nachname ? `Guten Tag ${[e.vorname, e.nachname].filter(Boolean).join(' ')},` : 'Guten Tag,';
  const punkte = (l: string[]) => l.slice(0, 4).map(x => `- ${x}`).join('\n');
  const einstieg = du ? 'ich wollte dich gerade updaten — das ist der Stand:' : 'ich möchte Sie kurz auf den aktuellen Stand bringen:';
  const anhang = du ? 'Den ausführlichen Bericht findest du im Anhang. Melde dich gern, wenn du Fragen hast.' : 'Den ausführlichen Bericht finden Sie im Anhang. Melden Sie sich gern, wenn Sie Fragen haben.';
  // Fulfillment (C2): mit Fall die Abschnitte „Erledigt · Als Nächstes · Wartet auf euch · Wert-Konto“ und — bei aktivem Kunden-Link — die Puls-Frage.
  const mitFall = hatZusatz(e.doc);
  const fallTeil = !mitFall ? [] : [
    ...(e.doc.wartetAufEuch!.length ? [du ? 'Wartet auf euch:' : 'Wartet auf Sie:', punkte(e.doc.wartetAufEuch!), ''] : []),
    ...((e.doc.wertKonto ?? []).length ? ['Wert-Konto (vorher → jetzt → Ziel):', (e.doc.wertKonto ?? []).slice(0, 4).map(w => `- ${w.name}: ${w.vorher} → ${w.jetzt} → ${w.ziel}`).join('\n'), ''] : []),
    ...(e.doc.pulsFrage ? [du ? `Eine kurze Frage: Wie zufrieden bist du gerade mit unserer Zusammenarbeit (0–10)? Ein Klick genügt: ${PULS_PLATZHALTER}` : `Eine kurze Frage: Wie zufrieden sind Sie gerade mit unserer Zusammenarbeit (0–10)? Ein Klick genügt: ${PULS_PLATZHALTER}`, ''] : []),
  ];
  const text = [
    gruss, '', einstieg, '', mitFall ? 'Erledigt:' : 'Erreicht:', punkte(e.doc.erreicht), '', 'Als Nächstes:', punkte(e.doc.naechste), '', ...fallTeil, anhang, '',
    du ? 'Viele Grüße' : 'Freundliche Grüße', ...(e.absender ? [e.absender] : []),
  ].join('\n');
  return { betreff: `Fortschritt${e.doc.paket ? ` ${e.doc.paket}` : ''} — Stand ${e.doc.stand}`, text };
}

/** Dateiname des Reports (nur sichere Zeichen). */
export function reportDateiname(kunde: string, heute: string): string {
  const k = kunde.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Kunde';
  return `Fortschritt-${k}-${heute}.pdf`;
}

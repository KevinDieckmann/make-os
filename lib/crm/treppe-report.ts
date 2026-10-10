// ─── Produkte · Fortschritts-Report an den Kunden — Aufbau und Mail-Vorlage (rein, client-sicher, getestet) ──────────
// Entscheidung 10.10.: je aktivem Mandat alle zwei Wochen ein Fortschritts-Report — PDF (erreicht, nächste Schritte, Kennzahlen) und eine
// vorformulierte Mail (Du/Sie nach der Akte), PDF angehängt, gesendet NUR per Klick über den vorhandenen Senden-Weg der Inbox.
// Hier steht nur der Aufbau (dieselbe Quelle für PDF, Vorschau und Mail); das PDF baut lib/crm/treppe-pdf.ts (Server), den Versand
// app/api/inbox/senden (Art. 18, § 7 UWG, Absender = Postfach). Keine festen Namen, Firmen oder Texte einer Instanz.

import type { Mandat } from './typen';
import type { KundenZeile } from './treppe';
import type { TreppenStufe } from './treppe-daten';

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
}

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
    ...(m.ziele ?? []).map(x => ({ name: x.text, wert: [x.ist ? `Ist: ${x.ist}` : '', x.ziel ? `Ziel: ${x.ziel}` : ''].filter(Boolean).join(' · ') || 'noch offen' })),
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
export function mailVorlage(e: { anrede?: 'Du' | 'Sie'; vorname?: string; nachname?: string; doc: Pick<ReportDokument, 'kunde' | 'paket' | 'erreicht' | 'naechste' | 'stand'>; absender?: string }): MailEntwurfReport {
  const du = e.anrede === 'Du';
  const gruss = du ? `Hey${e.vorname ? ` ${e.vorname}` : ''},` : e.nachname ? `Guten Tag ${[e.vorname, e.nachname].filter(Boolean).join(' ')},` : 'Guten Tag,';
  const punkte = (l: string[]) => l.slice(0, 4).map(x => `- ${x}`).join('\n');
  const einstieg = du ? 'ich wollte dich gerade updaten — das ist der Stand:' : 'ich möchte Sie kurz auf den aktuellen Stand bringen:';
  const anhang = du ? 'Den ausführlichen Bericht findest du im Anhang. Melde dich gern, wenn du Fragen hast.' : 'Den ausführlichen Bericht finden Sie im Anhang. Melden Sie sich gern, wenn Sie Fragen haben.';
  const text = [
    gruss, '', einstieg, '', 'Erreicht:', punkte(e.doc.erreicht), '', 'Als Nächstes:', punkte(e.doc.naechste), '', anhang, '',
    du ? 'Viele Grüße' : 'Freundliche Grüße', ...(e.absender ? [e.absender] : []),
  ].join('\n');
  return { betreff: `Fortschritt${e.doc.paket ? ` ${e.doc.paket}` : ''} — Stand ${e.doc.stand}`, text };
}

/** Dateiname des Reports (nur sichere Zeichen). */
export function reportDateiname(kunde: string, heute: string): string {
  const k = kunde.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Kunde';
  return `Fortschritt-${k}-${heute}.pdf`;
}

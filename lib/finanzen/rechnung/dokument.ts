// ─── Rechnungen schreiben mit PDF — das Dokument (rein, client-sicher, 08.10.) ─
// EIN Aufbau für beide Ausgaben, wie beim Angebot: die HTML-Vorschau im Editor (components/os/crm/angebot/Blatt.tsx) und
// das PDF auf dem Server (lib/crm/angebot-pdf.ts `belegPdf`). Dasselbe Gerüst trägt `art` „Rechnung“ bzw. „Stornorechnung“.
// Pflichtangaben nach § 14 Abs. 4 UStG stehen im Dokument: Absender (Kopf + Fuß mit Steuernummer/USt-IdNr., Bank), Empfänger,
// Rechnungsnummer, Rechnungsdatum, Leistungszeitpunkt bzw. -zeitraum, Positionen (Menge, Art), Entgelt je Steuersatz, Steuersatz
// und Steuerbetrag bzw. der Hinweis (Kleinunternehmer § 19, Reverse Charge § 13b, steuerfrei mit Grund), Fälligkeit und Bank.
// Beträge kommen in Cent herein (Positionen) und gehen als Text hinaus.

import type { AngebotAbsender } from '@/lib/crm/typen';
import type { AngebotDokument, DokumentSumme } from '@/lib/crm/angebot-dokument';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { RechnungEmpfaenger } from './typen';
import { euroCent, mengeText } from '@/lib/crm/angebote';
import { rechnungSummen, positionNetto, plusTage } from './regeln';

const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

/** Empfänger als Anschriftzeilen (Firma, z. Hd. Person, Straße, PLZ Ort, Land, USt-IdNr.). */
export function empfaengerZeilen(e: RechnungEmpfaenger | undefined): string[] {
  if (!e) return [];
  const ort = [e.plz, e.ort].filter(Boolean).join(' ');
  return [
    e.firma ?? '', e.name ? (e.firma ? `z. Hd. ${e.name}` : e.name) : '', e.strasse ?? '', ort,
    e.land && !/^(deutschland|germany|de)$/i.test(e.land) ? e.land : '', e.ustId ? `USt-IdNr. ${e.ustId}` : '',
  ].filter(Boolean);
}

/** Leistungszeitpunkt bzw. -zeitraum als Text. */
export function leistungText(r: Pick<Rechnung, 'leistungVon' | 'leistungBis'>): string {
  if (!r.leistungVon) return '';
  return r.leistungBis && r.leistungBis !== r.leistungVon ? `${datumDe(r.leistungVon)} – ${datumDe(r.leistungBis)}` : datumDe(r.leistungVon);
}

export interface RechnungDokumentOpt {
  /** Rechnungsdatum (beim Stellen = heute; im Entwurf: heute als Vorschau). */
  datum: string;
  /** Zahlungszeile mit Bank und IBAN (im PDF voll, in der Vorschau maskiert) — fehlt sie, steht nur „auf das unten genannte Konto“. */
  bank?: string;
  /** Kleinunternehmer (§ 19 UStG) — aus dem Absender. */
  kleinunternehmer?: boolean;
  /** Stornorechnung: die Original-Rechnung (Nummer, Datum) für den Bezug. */
  original?: Pick<Rechnung, 'nummer' | 'datum'>;
}

/** Das Dokument für Vorschau und PDF (Rechnung bzw. Stornorechnung). */
export function rechnungDokument(r: Rechnung, absender: AngebotAbsender, opt: RechnungDokumentOpt): AngebotDokument {
  const storno = r.art === 'storno';
  const ku = !!(opt.kleinunternehmer ?? absender.kleinunternehmer);
  const pos = r.positionen ?? [];
  const s = rechnungSummen(pos, { kleinunternehmer: ku, vorzeichen: storno ? -1 : 1 });
  const art = storno ? 'Stornorechnung' : 'Rechnung';
  const nummer = r.nummer ?? 'Entwurf';
  const faellig = storno ? undefined : r.faellig ?? (r.zahlungszielTage != null ? plusTage(opt.datum, r.zahlungszielTage) : undefined);
  const summen: DokumentSumme[] = ku
    ? [{ label: 'Rechnungsbetrag', wert: euroCent(s.brutto), stark: true }]
    : [
      ...s.jeSatz.map(x => ({ label: s.jeSatz.length > 1 ? `Netto ${x.satz} %` : 'Summe netto', wert: euroCent(x.netto) })),
      ...s.jeSatz.map(x => ({ label: x.satz ? `zzgl. ${x.satz} % USt` : 'Umsatzsteuer 0 %', wert: euroCent(x.ust), leise: true })),
      { label: storno ? 'Gutschrift brutto' : 'Rechnungsbetrag', wert: euroCent(s.brutto), stark: true },
    ];
  const vorz = (c: number) => euroCent(storno ? -c : c);
  const hinweise = [
    ...(storno && opt.original?.nummer ? [`Diese Stornorechnung hebt die Rechnung ${opt.original.nummer}${opt.original.datum ? ` vom ${datumDe(opt.original.datum)}` : ''} vollständig auf.`] : []),
    ...(ku ? ['Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'] : []),
    ...(!ku && r.steuerHinweis === 'reverse-charge' ? ['Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).'] : []),
    ...(!ku && r.steuerHinweis === 'steuerfrei' && r.steuerfreiGrund ? [`Steuerfrei: ${r.steuerfreiGrund}.`] : []),
    ...(!storno && faellig ? [`Zahlbar ohne Abzug bis zum ${datumDe(faellig)}${opt.bank ? ` auf das Konto ${opt.bank}` : ' auf das unten genannte Konto'} unter Angabe der Rechnungsnummer.`] : []),
  ];
  return {
    art, ueberschrift: storno ? `Stornorechnung zu Rechnung ${opt.original?.nummer ?? ''}`.trim() : `Rechnung: ${r.titel || 'Leistung'}`,
    absender, absenderZeile: [absender.firmierung, ...absender.zeilen].join(' · '),
    empfaenger: empfaengerZeilen(r.empfaenger).length ? empfaengerZeilen(r.empfaenger) : [r.kunde || '—'],
    nummer, entwurf: !r.nummer,
    meta: [
      { label: storno ? 'Stornorechnung' : 'Rechnungsnummer', wert: nummer, fett: true },
      { label: 'Rechnungsdatum', wert: datumDe(r.datum ?? opt.datum) },
      ...(leistungText(r) ? [{ label: r.leistungBis && r.leistungBis !== r.leistungVon ? 'Leistungszeitraum' : 'Leistungsdatum', wert: leistungText(r) }] : []),
      ...(faellig ? [{ label: 'Fällig am', wert: datumDe(faellig) }] : []),
      ...(storno && opt.original?.nummer ? [{ label: 'Zu Rechnung', wert: opt.original.nummer }] : []),
      ...(r.empfaenger?.referenz ? [{ label: 'Ihre Referenz', wert: r.empfaenger.referenz }] : []),
    ],
    titel: r.titel || 'Rechnung', einleitung: r.einleitung ?? '',
    positionen: pos.map((p, i) => ({
      nr: String(i + 1), titel: p.titel, text: p.text, menge: `${mengeText(p.menge)} ${p.einheit}`.trim(), einzelpreis: vorz(p.einzelpreisCent),
      ...(p.rabattProzent ? { rabatt: `${p.rabattProzent.toLocaleString('de-DE')} %` } : {}), betrag: vorz(positionNetto(p)),
      basis: !ku && s.jeSatz.length > 1 ? `${p.ustSatz} % USt` : '',
    })),
    summen, hinweise, schluss: r.schluss ?? '',
  };
}

/** Zahlungszeile für das PDF bzw. die Vorschau: „IBAN …, BIC … (Bank)“ — die IBAN kommt schon voll oder maskiert herein. */
export function bankZeile(b: { iban?: string; bic?: string; bank?: string } | undefined): string | undefined {
  if (!b?.iban) return undefined;
  const iban = b.iban.includes('•') ? b.iban : b.iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  return `IBAN ${iban}${b.bic ? `, BIC ${b.bic}` : ''}${b.bank ? ` (${b.bank})` : ''}`;
}

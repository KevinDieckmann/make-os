// ─── Markttraktion · Angebot als Dokument (rein, client-sicher, 28.09.) ──────
// EIN Aufbau für beide Ausgaben: die HTML-Vorschau im Tool (components/os/crm/
// angebot/Blatt.tsx) und das PDF auf dem Server (lib/crm/angebot-pdf.ts). So sieht
// die Vorschau aus wie das PDF — Absender, Empfänger, Nummer/Datum/gültig bis,
// Positionen, Summen (einmalig · monatlich · jährlich · Gesamtwert), Texte, Fußtext
// mit Pflichtangaben. Beträge kommen in Cent herein und gehen als Text hinaus.

import type { Angebot, AngebotAbsender, AngebotEmpfaenger } from './typen';
import type { Gesellschaft } from './gesellschaften';
import { mitVorgaben } from './gesellschaften';
import { angebotSummen, euroCent, mengeText, positionNettoCent, BASIS_LABEL, type Summe } from './angebote';
import { ibanMaskiert } from './zahlung';

const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

/**
 * Absender aus den Stammdaten der Gesellschaft. `ibanVoll` nur für das PDF auf dem Server — im Angebot
 * gespeichert (Schnappschuss beim Stellen) und in der Vorschau steht sie maskiert.
 */
export function absenderAus(roh: Gesellschaft, opt: { ibanVoll?: boolean } = {}): AngebotAbsender {
  const g = mitVorgaben(roh);
  const ort = [g.plz, g.ort].filter(Boolean).join(' ');
  const zeilen = [g.strasse, ort, g.land && g.land !== 'Deutschland' ? g.land : ''].filter((x): x is string => !!x);
  const kontakt = [g.telefon ? `Tel. ${g.telefon}` : '', g.email ?? '', g.web ?? ''].filter(Boolean);
  const iban = g.bank?.iban ? (opt.ibanVoll ? g.bank.iban.replace(/(.{4})/g, '$1 ').trim() : ibanMaskiert(g.bank.iban) ?? '') : '';
  const fuss = [
    [g.name, ...zeilen].join(' · '),
    [g.geschaeftsfuehrung ? `Geschäftsführung: ${g.geschaeftsfuehrung}` : '', g.register ?? ''].filter(Boolean).join(' · '),
    [g.steuernummer ? `Steuernummer ${g.steuernummer}` : '', g.ustId ? `USt-IdNr. ${g.ustId}` : ''].filter(Boolean).join(' · '),
    [g.bank?.bank ?? '', iban ? `IBAN ${iban}` : '', g.bank?.bic ? `BIC ${g.bank.bic}` : '', g.bank?.inhaber ? `Inhaber ${g.bank.inhaber}` : ''].filter(Boolean).join(' · '),
    g.fusstext ?? '',
  ].filter(Boolean);
  return { firmierung: g.name, zeilen, kontakt, fuss, kleinunternehmer: !!g.kleinunternehmer };
}

/** Empfänger aus Kontakt und Firma (Anschrift: Rechnungsempfänger der Zahlungsdaten, sonst Ort der Firma). */
export function empfaengerAus(k: { vorname?: string; nachname?: string; email?: string; firma?: string } | undefined, f: { name: string; stadt?: string; zahlung?: { empfaenger?: { name?: string; anschrift?: string } } } | undefined): AngebotEmpfaenger {
  const name = `${k?.vorname ?? ''} ${k?.nachname ?? ''}`.trim() || f?.zahlung?.empfaenger?.name || '';
  const firma = f?.name ?? k?.firma;
  const anschrift = (f?.zahlung?.empfaenger?.anschrift ?? '').split(/\n|,\s*(?=\d{4,5}\s)/).map(s => s.trim()).filter(Boolean);
  const zeilen = [firma ?? '', name && firma ? `z. Hd. ${name}` : name, ...(anschrift.length ? anschrift : f?.stadt ? [f.stadt] : [])].filter(Boolean);
  return { name, ...(firma ? { firma } : {}), zeilen, ...(k?.email ? { email: k.email } : {}) };
}

export interface DokumentPosition { nr: string; titel: string; text: string; menge: string; einzelpreis: string; rabatt?: string; betrag: string; basis: string }
export interface DokumentSumme { label: string; wert: string; stark?: boolean; leise?: boolean }
export interface AngebotDokument {
  absender: AngebotAbsender;
  /** Kleine Zeile über dem Empfänger (Rücksendeangabe). */
  absenderZeile: string;
  empfaenger: string[];
  nummer: string;
  entwurf: boolean;
  meta: { label: string; wert: string }[];
  titel: string;
  einleitung: string;
  positionen: DokumentPosition[];
  summen: DokumentSumme[];
  hinweise: string[];
  schluss: string;
}

function summenZeilen(label: string, s: Summe, ku: boolean): DokumentSumme[] {
  if (!s.netto && !s.jeSatz.length) return [];
  if (ku) return [{ label: `${label} (netto = gesamt)`, wert: euroCent(s.netto), stark: true }];
  return [
    { label: `${label} netto`, wert: euroCent(s.netto) },
    ...s.jeSatz.filter(x => x.satz > 0).map(x => ({ label: `zzgl. ${x.satz} % USt`, wert: euroCent(x.ust), leise: true })),
    { label: `${label} brutto`, wert: euroCent(s.brutto), stark: true },
  ];
}

/** Das Dokument für Vorschau und PDF. `datum` = Angebotsdatum (gestellt am, sonst heute). */
export function angebotDokument(a: Angebot, absender: AngebotAbsender, empfaenger: AngebotEmpfaenger, datum: string): AngebotDokument {
  const ku = absender.kleinunternehmer;
  const s = angebotSummen(a, { kleinunternehmer: ku });
  const laufend = a.positionen.some(p => p.basis !== 'einmalig');
  const arten = new Set(a.positionen.map(p => p.basis));
  const summen: DokumentSumme[] = [
    ...summenZeilen('Einmalig', s.einmalig, ku),
    ...summenZeilen('Monatlich', s.monat, ku),
    ...summenZeilen('Jährlich', s.jahr, ku),
    ...(laufend || arten.size > 1 ? [{ label: `Gesamtwert über die Laufzeit${ku ? '' : ' (netto)'}`, wert: euroCent(s.gesamt.netto), stark: true }, ...(ku ? [] : [{ label: 'Gesamtwert brutto', wert: euroCent(s.gesamt.brutto), leise: true }])] : []),
  ];
  return {
    absender, absenderZeile: [absender.firmierung, ...absender.zeilen].join(' · '),
    empfaenger: empfaenger.zeilen.length ? empfaenger.zeilen : [empfaenger.name || '—'],
    nummer: a.nummer ?? 'Entwurf', entwurf: !a.nummer,
    meta: [
      { label: 'Angebot', wert: a.nummer ?? 'Entwurf' },
      { label: 'Datum', wert: datumDe(datum) },
      { label: 'Gültig bis', wert: datumDe(a.gueltigBis) },
      ...(a.version > 1 ? [{ label: 'Fassung', wert: `Version ${a.version}` }] : []),
    ],
    titel: a.titel || 'Angebot', einleitung: a.einleitung,
    positionen: a.positionen.map((p, i) => ({
      nr: String(i + 1), titel: p.titel, text: p.text, menge: `${mengeText(p.menge)} ${p.einheit}`.trim(), einzelpreis: euroCent(p.einzelpreisCent),
      ...(p.rabattProzent ? { rabatt: `${p.rabattProzent.toLocaleString('de-DE')} %` } : {}), betrag: euroCent(positionNettoCent(p)),
      basis: p.basis === 'einmalig' ? BASIS_LABEL.einmalig : `${BASIS_LABEL[p.basis]}${p.laufzeitMonate ? ` · ${p.laufzeitMonate} Monate` : ''}`,
    })),
    summen,
    hinweise: [
      ...(ku ? ['Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'] : []),
      ...(s.ohneLaufzeit ? ['Laufende Positionen ohne Laufzeit sind im Gesamtwert mit 12 Monaten gerechnet.'] : []),
      `Zahlungsziel: ${a.zahlungszielTage ? `${a.zahlungszielTage} Tage nach Rechnungsstellung ohne Abzug` : 'sofort nach Rechnungsstellung'}.`,
      'Alle Preise netto zuzüglich der gesetzlichen Umsatzsteuer, soweit ausgewiesen.',
    ].filter((x, i, l) => !(ku && x.startsWith('Alle Preise')) && l.indexOf(x) === i),
    schluss: a.schluss,
  };
}

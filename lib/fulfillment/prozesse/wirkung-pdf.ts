// ─── Fulfillment · Prozesse — Wirkungsbericht als PDF (nur Server, C1, 10.10.; neu gezeichnet 12.10.; FULFILLMENT_KONZEPT.md 5.3) ────────────────────
// Seit 12.10. (Fulfillment extern, „ein Bild“) mit dem gemeinsamen Gerüst der Kunden-Dokumente (lib/fulfillment/kunde/pdf-bild.ts): Kopf mit Anbieter,
// Kunde/Mandat/Zeitraum; „Vorher und nachher“ je Ziel als Grafik (Wert-Balken vorher → jetzt → Ziel, groß); „Meilensteine“ als Phasen-Strahl mit den
// Abstimmungspunkten; „Erste Erfolge“ mit Datum; „Geliefert“; „Läuft ohne uns“ als Checkliste; „Stimme des Kunden“ NUR mit vermerkter Einwilligung (der
// Aufrufer prüft — das Dokument trägt das Zitat sonst gar nicht); „Wie es weitergehen kann“ (nächste Stufe, nie ein Preis); der Hinweis „keine Garantie“.
// Inhalt aus `wirkungsDokument` (lib/fulfillment/prozesse/wirkung.ts); die Ablage bleibt, wie sie ist. `erstellt` fest übergeben → gleiche Bytes.

import { PdfBlatt, PDF_FARBE } from '../kunde/pdf-bild';
import type { WirkungsDokument } from './wirkung';
import { wort } from '@/lib/text/zahlwort';

export async function wirkungPdf(d: WirkungsDokument, opt: { erstellt: Date }): Promise<Uint8Array> {
  const b = await PdfBlatt.neu({ titel: `${d.titel} – ${d.kunde}`, betreff: d.mandat, ...(d.absender ? { autor: d.absender } : {}), erstellt: opt.erstellt });
  b.kopf({ ...(d.absender ? { anbieter: d.absender } : {}), titel: d.titel, kunde: d.kunde, zeile: [d.mandat, d.paket, `Zeitraum ${d.zeitraum}`].filter(Boolean).join(' · '), stand: d.stand });
  b.absatz('Was wir gemeinsam erreicht haben — vorher, jetzt und was als Nächstes möglich ist.', 11, { farbe: PDF_FARBE.leise });

  if (d.wertKonto.length) {
    b.abschnitt('Vorher und nachher', 'je Ziel');
    for (const z of d.wertKonto) b.wertBalken({ name: z.name, vorher: z.vorher, jetzt: z.jetzt, ziel: z.ziel, ...(z.bis ? { bis: datum(z.bis) } : {}), ...(z.anteil != null ? { anteil: z.anteil } : {}) }, { gross: true });
  }
  if (d.phasen?.length) {
    const fertig = d.phasen.filter(p => p.stand === 'erledigt').length;
    b.abschnitt('Meilensteine', `${fertig} von ${d.phasen.length} ${wort(d.phasen.length, 'Phase', 'Phasen')} abgeschlossen`);
    b.strahl(d.phasen, { hier: 'Hier stehen wir' });
    const abgestimmt = d.phasen.filter(p => p.abstimmung?.erledigt).map(p => `${p.abstimmung!.titel} — abgestimmt`);
    if (abgestimmt.length) b.punkte(abgestimmt, { groesse: 9.5 });
  }
  if (d.erfolge?.length) { b.abschnitt('Erste Erfolge', `${d.erfolge.length} erreicht`); b.erfolge(d.erfolge, 50); }
  else if (d.quickWins.length) { b.abschnitt('Erste Erfolge'); b.punkte(d.quickWins); }
  if (d.lieferobjekte.length) { b.abschnitt('Geliefert'); b.punkte(d.lieferobjekte); }
  if (d.befaehigung.length) {
    b.abschnitt('Läuft ohne uns', `${d.befaehigung.filter(x => x.erfuellt).length} von ${d.befaehigung.length} erfüllt`);
    b.erfolge(d.befaehigung.map(x => ({ text: x.text, erledigt: x.erfuellt })), 50, { ja: 'erfüllt', nein: 'noch offen' });
  }
  if (d.zitat) { b.abschnitt('Stimme des Kunden'); b.zitat(d.zitat.text); }
  if (d.naechsteStufe) b.hinweis(`${d.naechsteStufe.name}${d.naechsteStufe.text ? ` — ${d.naechsteStufe.text}` : ''}. Wenn das für Sie passt, sprechen wir gern darüber.`, { titel: 'Wie es weitergehen kann', farbe: PDF_FARBE.akzentTief });
  b.abstand(12);
  b.absatz(d.hinweis, 9, { farbe: PDF_FARBE.leise });
  return b.fertig(`${d.titel} · ${d.kunde} · ${d.stand}`);
}

const datum = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);

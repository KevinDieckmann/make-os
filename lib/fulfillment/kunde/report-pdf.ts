// ─── Fulfillment · Kunde — der 2-Wochen-Report MIT Fall als PDF (nur Server; 12.10., Fulfillment extern) ─────────────────────────────────────────
// Entscheidung 12.10.: „eine Seite Zusammenfassung zuerst, dann Details.“ Seite 1 = dasselbe Bild wie die Kunden-Seite: Lage (Ampel + drei Sätze, nächster
// Termin), „So weit sind wir“ (die Reise als EINE Zeile mit „als Nächstes“ — seit 17.10.), „Euer Ziel“ (Wert-Balken vorher → jetzt → Ziel), Spalten „Erledigt ·
// Wartet auf euch“, „Erste Erfolge“ und die Puls-Frage (der Link steht in der Mail — er entsteht erst beim Senden). Ab Seite 2 „Im Detail“: alle Punkte,
// die Ziele mit Datum, der aktuelle Schritt, die Kennzahlen der Leistungstreppe, der Hinweis. Ohne Fall zeichnet lib/crm/treppe-pdf.ts wie bisher
// (Byte für Byte). Gezeichnet mit dem gemeinsamen Gerüst lib/fulfillment/kunde/pdf-bild.ts; `erstellt` fest → gleiche Eingabe, gleiche Bytes.

import { NAECHSTE_LEER, type ReportDokument } from '@/lib/crm/treppe-report';
import { PdfBlatt, PDF_FARBE, RAND } from './pdf-bild';
import { KURZ_MAX, WORTE, kundenReise } from './bild';

export async function reportPdfMitFall(d: ReportDokument, opt: { erstellt: Date }): Promise<Uint8Array> {
  const w = WORTE[d.anrede ?? 'sie'];
  const du = (d.anrede ?? 'sie') === 'du';
  const b = await PdfBlatt.neu({ titel: `${d.titel} – ${d.kunde}`, betreff: d.paket ?? d.titel, ...(d.absender ? { autor: d.absender } : {}), erstellt: opt.erstellt });
  b.kopf({ ...(d.absender ? { anbieter: d.absender } : {}), titel: d.titel, kunde: d.kunde, zeile: [d.mandat, d.paket].filter(Boolean).join(' · '), stand: d.stand });

  // ── Seite 1: die Zusammenfassung ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (d.lage) b.lage(d.lage, d.naechsterTermin ? `${w.termin}: ${d.naechsterTermin.titel}, ${d.naechsterTermin.am}` : undefined);
  const wartet = d.wartetAufEuch ?? [];
  if (d.phasen?.length) {
    b.abschnitt(w.soWeit, d.fortschritt != null ? `${d.fortschritt} % geschafft` : undefined);
    // Dieselbe Reise-Zeile wie die Kunden-Seite (17.10.): „als Nächstes“ als Kästchen unter der laufenden Phase, im Band, was bei euch liegt.
    b.reise(kundenReise(d.phasen, d.naechste.filter(x => x !== NAECHSTE_LEER), wartet.length), { naechstes: w.naechstes, band: w.beiEuch });
  }
  const ziele = d.wertKonto ?? [];
  if (ziele.length) {
    b.abschnitt(w.ziel, 'vorher · jetzt · Ziel');
    for (const z of ziele.slice(0, 3)) b.wertBalken(z);
  }
  // „Als Nächstes“ steht schon in der Reise (nichts doppelt) — hier, was erledigt ist und was bei euch liegt (ohne Reise: alle drei Spalten).
  b.spalten([
    { titel: 'Erledigt', punkte: d.erreicht, leer: 'Noch nichts abgeschlossen.' },
    ...(d.phasen?.length ? [] : [{ titel: 'Als Nächstes', punkte: d.naechste, leer: 'Stimmen wir im nächsten Termin ab.' }]),
    { titel: w.wartetAuf, punkte: wartet, leer: w.wartetLeer, ...(wartet.length ? { farbe: PDF_FARBE.achtung } : {}) },
  ], KURZ_MAX);
  if (d.quickWins?.length) {
    b.abschnitt(w.erfolge, `${d.quickWins.filter(q => q.erledigt).length} von ${d.quickWins.length} erreicht`);
    b.erfolge(d.quickWins, KURZ_MAX);
  }
  if (d.pulsFrage || d.puls) {
    const satz = [
      d.pulsFrage ? (du ? 'Eine Antwort mit einem Klick — den Link findet ihr in der Mail zu diesem Bericht.' : 'Eine Antwort mit einem Klick — den Link finden Sie in der Mail zu diesem Bericht.') : '',
      d.puls ? `${du ? 'Eure' : 'Ihre'} letzte Rückmeldung: ${d.puls.wert} von 10 (${d.puls.am}).` : '',
    ].filter(Boolean).join(' ');
    b.hinweis(satz, { titel: w.puls });
  }

  // ── Ab Seite 2: im Detail ────────────────────────────────────────────────────────────────────────────────────────────────────────
  b.neueSeite();
  b.text('Im Detail', RAND, b.y - 20, 18, { fett: true });
  b.abstand(28);
  if (d.schritt) b.absatz(`Aktueller Schritt: ${d.schritt}`, 10, { farbe: PDF_FARBE.leise });
  b.abschnitt('Erledigt');
  b.punkte(d.erreicht);
  b.abschnitt('Als Nächstes');
  b.punkte(d.naechste);
  b.abschnitt(w.wartetAuf);
  b.punkte(wartet.length ? wartet : [w.wartetLeer]);
  if (ziele.length) {
    b.abschnitt(`${w.ziel} im Detail`);
    for (const z of ziele) {
      b.absatz(z.name, 10.5, { fett: true });
      b.absatz(`vorher ${z.vorher} · jetzt ${z.jetzt} · Ziel ${z.ziel}${z.bis ? ` (bis ${z.bis})` : ''}${z.anteil != null ? ` · ${z.anteil} % des Wegs` : ''}`, 10, { farbe: PDF_FARBE.leise });
      b.abstand(4);
    }
    b.absatz(w.zielSatz.replace(/ → /g, ' – '), 9, { farbe: PDF_FARBE.leise });
  }
  if ((d.quickWins?.length ?? 0) > KURZ_MAX) { b.abschnitt(w.erfolge); b.erfolge(d.quickWins!, 50); }
  if (d.kennzahlen.length) {
    b.abschnitt('Kennzahlen');
    for (const k of d.kennzahlen) { b.absatz(k.name, 10.5, { fett: true }); b.absatz(k.wert, 10, { farbe: PDF_FARBE.leise }); b.abstand(4); }
  }
  b.abstand(10);
  b.absatz(d.hinweis, 9, { farbe: PDF_FARBE.leise });
  return b.fertig(`${d.titel} · ${d.kunde} · ${d.stand}`);
}

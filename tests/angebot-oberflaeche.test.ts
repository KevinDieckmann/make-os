// ─── Angebots-Tool (28.09.): die Oberfläche zeichnet ohne Fehler (Server-Render, erfundene Daten) ──
// Kein Browser, kein Netz: Editor (neu, vorbelegt), Vorschau, Ansicht eines gestellten Angebots,
// Liste und Blatt werden mit einem erfundenen Bestand gezeichnet — fängt Laufzeitfehler beim Zeichnen.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Angebot, CrmBestand, Leistung } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '@/components/os/crm/daten';
import type { AngebotDaten, AngebotMitStand } from '@/components/os/crm/angebot/angebot-daten';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const J = '2026-09-28T10:00:00.000Z';
const L: Leistung = { id: 'l-strategie', name: 'Strategie-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 2500, einheit: 'Monat netto', basis: 'monat' }, laufzeitMonate: 6, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', angebot: { leistungstext: 'Zwei Termine im Monat.' }, geaendert: J };
const K: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', email: 'c-anna1@example.invalid', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], firmaId: 'f-muster', anrede: 'Sie', importiertAm: '2026-08-01', geaendertAm: '2026-08-01' };
const A: AngebotMitStand = { id: 'ang-test1', nummer: 'KDV-A-2026-0001', lauf: { jahr: 2026, nr: 1 }, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', dealId: 'ch-1', titel: 'Retainer', positionen: [{ id: 'p1', leistungId: 'l-strategie', titel: 'Strategie', text: 'Zwei Termine im Monat.', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19, basis: 'monat', laufzeitMonate: 6 }], einleitung: 'Guten Tag Anna Beispiel,', schluss: 'Mit freundlichen Grüßen', gueltigBis: '2026-10-28', zahlungszielTage: 14, status: 'gestellt', version: 1, gestelltAm: J, gestelltVon: 'kevin', pruefsumme: 'ab'.repeat(32), pdfDateiId: 'd-pdf1', absender: { firmierung: 'Beispiel Ventures UG', zeilen: ['Weg 1', '12345 Musterstadt'], kontakt: [], fuss: ['Beispiel Ventures UG · Weg 1'], kleinunternehmer: false }, empfaenger: { name: 'Anna Beispiel', firma: 'Muster GmbH', zeilen: ['Muster GmbH', 'z. Hd. Anna Beispiel'] }, angelegt: J, geaendert: J, stand: 'x' };
const stand: CrmBestand = {
  firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', geaendert: J }], chancen: [{ id: 'ch-1', titel: 'Retainer Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', art: 'retainer', leistungId: 'l-strategie', wert: { betrag: 2500, basis: 'monat' }, stufe: 'diagnose', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdv', besitzer: 'kevin', angelegt: J, geaendert: J }],
  mandate: [], leistungen: [L], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [A],
};
const api = { crm: { ok: true, heute: '2026-09-28', stand, ich: 'kevin', stufen: [{ id: 'diagnose', label: 'Diagnose', p: 60, weiterWenn: '', offen: true }], prognose: {}, gewinnquote: {}, ampel: {}, mandate: {}, zahlung: {}, mrr: 0, konzentration: null, events: {}, termine: {} }, kontakte: [K], fehler: null, laden: async () => {} } as unknown as CrmApi;
const daten = { angebote: [A], gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel Ventures UG', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt', stand: 's', luecken: [] }], fehler: null, gesperrt: false, laden: async () => {}, uebernehmen: () => {}, entfernen: () => {}, setFehler: () => {} } as unknown as AngebotDaten;

describe('Angebots-Tool zeichnet', () => {
  it('Editor: neu aus der Deal-Vorbelegung — Kontakt, Deal, Gesellschaft, Produkt-Position, Summenleiste', async () => {
    const { Editor } = await import('@/components/os/crm/angebot/Editor');
    const html = renderToStaticMarkup(h(Editor, { api, daten, id: 'ang-neu1', start: null, vorbelegung: { dealId: 'ch-1' }, onGespeichert: () => {}, onGestellt: () => {}, onListe: () => {} }));
    expect(html).toContain('Anna Beispiel');
    expect(html).toContain('Retainer Muster');
    expect(html).toContain('KD Ventures');
    expect(html).toContain('value="Strategie-Retainer"');
    expect(html).toContain('2.500,00');
    expect(html).toContain('Mail versenden');
  });
  it('Vorschau: Mail klein, Angebot groß', async () => {
    const { Vorschau } = await import('@/components/os/crm/angebot/Vorschau');
    const { angebotDokument } = await import('@/lib/crm/angebot-dokument');
    const dok = angebotDokument({ ...A, nummer: undefined, status: 'entwurf' } as Angebot, A.absender!, A.empfaenger!, '2026-09-28');
    const html = renderToStaticMarkup(h(Vorschau, { dok, mail: { an: 'c-anna1@example.invalid', betreff: 'Angebot {Nummer} – Retainer', text: 'Guten Tag' }, setMail: () => {}, ampel: { hinweise: ['Hinweis gelb'] }, luecken: [], nachfassen: '2026-10-05', setNachfassen: () => {}, onZurueck: () => {}, onSenden: async () => {} }));
    expect(html).toContain('Mail-Entwurf');
    expect(html).toContain('ENTWURF');
    expect(html).toContain('Senden');
    expect(html).toContain('Hinweis gelb');
  });
  it('Ansicht eines gestellten Angebots und die Liste', async () => {
    const { Ansicht } = await import('@/components/os/crm/angebot/Ansicht');
    const { AngebotListe } = await import('@/components/os/crm/angebot/Liste');
    const html = renderToStaticMarkup(h(Ansicht, { a: A, api, daten, onOeffnen: () => {}, onListe: () => {} }));
    expect(html).toContain('KDV-A-2026-0001');
    expect(html).toContain('Angenommen');
    expect(html).toContain('PDF laden');
    const liste = renderToStaticMarkup(h(AngebotListe, { api, daten, onOeffnen: () => {}, onNeu: () => {} }));
    expect(liste).toContain('1 offen');
    expect(liste).toContain('Anna Beispiel · Muster GmbH');
  });
  // Sichtprüfung 29.09., F2: bei 375 px war das Blatt abgeschnitten — das Raster ohne Spaltenvorgabe wuchs auf die
  // Mindestbreite der Positions-Tabelle. Jetzt: Raster `minmax(0, 1fr)`, Blatt `width: 100%` + `min-width: 0`, die
  // Tabelle scrollt in sich (overflow-x: auto).
  it('schmal: Ansicht und Vorschau schrumpfen, das Blatt bleibt in der Breite, die Tabelle scrollt in sich (F2)', async () => {
    const { Ansicht } = await import('@/components/os/crm/angebot/Ansicht');
    const { Vorschau } = await import('@/components/os/crm/angebot/Vorschau');
    const { angebotDokument } = await import('@/lib/crm/angebot-dokument');
    const ansicht = renderToStaticMarkup(h(Ansicht, { a: A, api, daten, onOeffnen: () => {}, onListe: () => {} }));
    expect(ansicht).toMatch(/^<div style="display:grid;grid-template-columns:minmax\(0, 1fr\);gap:14px;min-width:0"/);
    const blatt = /<div role="document"[^>]*style="([^"]*)"/.exec(ansicht)?.[1] ?? '';
    expect(blatt).toContain('width:100%');
    expect(blatt).toContain('min-width:0');
    expect(ansicht).toContain('overflow-x:auto');
    const dok = angebotDokument({ ...A, nummer: undefined, status: 'entwurf' } as Angebot, A.absender!, A.empfaenger!, '2026-09-28');
    const vorschau = renderToStaticMarkup(h(Vorschau, { dok, mail: { an: '', betreff: '', text: '' }, setMail: () => {}, ampel: { hinweise: [] }, luecken: [], nachfassen: '', setNachfassen: () => {}, onZurueck: () => {}, onSenden: async () => {} }));
    expect(vorschau).toMatch(/grid-template-columns:(minmax\(0, 1fr\)|minmax\(300px, 380px\) minmax\(0, 1fr\))/);
    expect(vorschau).not.toMatch(/grid-template-columns:1fr[;"]/);
  });
  it('AngebotStart: ohne Kennung die Liste, mit Kennung die Ansicht', async () => {
    const mod = await import('@/components/os/crm/angebot/angebot-daten');
    vi.spyOn(mod, 'useAngebote').mockReturnValue(daten);
    const { AngebotStart } = await import('@/components/os/crm/angebot/AngebotStart');
    expect(renderToStaticMarkup(h(AngebotStart, { api }))).toContain('+ Neues Angebot');
    expect(renderToStaticMarkup(h(AngebotStart, { api, angebotId: 'ang-test1' }))).toContain('Prüfsumme');
  });
});

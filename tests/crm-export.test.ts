// Exporte als CSV (Stammdaten › Import & Export, 27.09.): fünf Tabellen, BOM + Semikolon, Firma per Kennung, nie die Privatnotiz. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { EXPORTE, EXPORT_SPALTEN, exportCsv, exportDateiname, istExportArt, csvTabelle, bezugTitel, type ExportQuelle } from '../lib/crm/export';
import { leererBestand } from '../lib/crm/speicher';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, CrmBestand, FollowUp, Mandat } from '../lib/crm/typen';

const HEUTE = '2026-09-27', J = `${HEUTE}T10:00:00Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const chance = (x: Partial<Chance> = {}): Chance => ({ id: 'ch-1', titel: 'Retainer Alpha', kontaktIds: ['c-anna'], art: 'retainer', wert: { betrag: 2500, basis: 'monat', laufzeitMonate: 12 }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, naechsterSchritt: { text: 'Angebot; live besprechen', datum: '2026-10-01' }, ...x });
const mandat = (x: Partial<Mandat> = {}): Mandat => ({ id: 'm-1', kunde: 'Alpha (alt)', firmaId: 'f-alpha', kontaktIds: ['c-anna'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: 80, umsetzung: null, wirkung: null, zahlung: 100, stimmung: null }, leistungen: [], offen: ['Kickoff-Termin'], geaendert: J, ...x });
const fu = (x: Partial<FollowUp> = {}): FollowUp => ({ id: 'fu-1', bezug: { art: 'chance', id: 'ch-1' }, kontaktId: 'c-anna', art: 'anruf', text: 'Nachfassen', faellig: '2026-09-30', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J, ...x });

const crm: CrmBestand = {
  ...leererBestand(),
  firmen: [{ id: 'f-alpha', name: 'Alpha GmbH', domain: 'alpha.de', branche: 'Maschinenbau', stadt: 'Berlin', rolle: 'kunde', lead: { status: 'sql', kriterien: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' }, sqlAm: '2026-09-01' }, geaendert: J }, { id: 'f-beta', name: 'Beta AG', rolle: 'zielkunde', geaendert: J }],
  chancen: [chance(), chance({ id: 'ch-2', titel: 'Verloren', stufe: 'verloren', grund: 'Preis', firma: 'Beta AG', kontaktIds: [], wert: { betrag: 5000, basis: 'einmalig' } })],
  mandate: [mandat()],
  followups: [fu(), fu({ id: 'fu-2', bezug: { art: 'mandat', id: 'm-1' }, faellig: '2026-09-28', status: 'erledigt', ergebnis: 'gespraech', erledigtAm: J }), fu({ id: 'fu-3', bezug: { art: 'kontakt', id: 'c-ben' }, kontaktId: 'c-ben', faellig: '2026-09-29', notiz: 'GEHEIM-NOTIZ-NEIN' })],
  wahrscheinlichkeiten: { angebot: 80 },
};
const kontakte = [
  k('anna', { firmaId: 'f-alpha', email: 'anna@alpha.de', kreis: 'A', privatNotiz: 'PRIVAT-GEHEIM', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Mail', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Darf ich Ihnen … schicken? — Ja', belegRef: 'Gespräch vom 01.09.' }], rollen: ['partner'] }),
  k('ben', { firma: 'Beta AG', werbesperre: { seit: '2026-09-10', grund: 'Widerspruch' }, privatNotiz: 'AUCH-PRIVAT' }),
];
const q: ExportQuelle = { kontakte, crm };
const zeilen = (csv: string) => csv.replace(/^﻿/, '').split('\n');
/** Eine CSV-Zeile in Zellen — mit Anführungszeichen („;“ im Text, "" als Maskierung), so wie Excel sie liest. */
const zellen = (zeile: string): string[] => {
  const raus: string[] = [];
  let z = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inAnf) { if (c === '"') { if (zeile[i + 1] === '"') { z += '"'; i++; } else inAnf = false; } else z += c; }
    else if (c === '"') inAnf = true;
    else if (c === ';') { raus.push(z); z = ''; }
    else z += c;
  }
  raus.push(z);
  return raus;
};
const tabelle = (csv: string) => { const [kopf, ...rest] = zeilen(csv).map(zellen); return rest.map(r => Object.fromEntries(kopf.map((h, i) => [h, r[i]]))); };

describe('Export — Form', () => {
  it('BOM, Semikolon, Kopfzeile, eine Zeile je Eintrag — für alle fünf Tabellen', () => {
    for (const was of EXPORTE) {
      const csv = exportCsv(was, q);
      expect(csv.startsWith('﻿')).toBe(true);
      const z = zeilen(csv);
      expect(z[0]).toBe(EXPORT_SPALTEN[was].join(';'));
      const erwartet = { kontakte: 2, firmen: 2, deals: 2, followups: 3, mandate: 1 }[was];
      expect(z.length - 1).toBe(erwartet);
      for (const zeile of z.slice(1)) expect(zellen(zeile).length).toBe(EXPORT_SPALTEN[was].length);
    }
  });
  it('Zellen sind maskiert (Semikolon im Text), Dateiname und Art-Prüfung', () => {
    const d = tabelle(exportCsv('deals', q)).find(z => z.ID === 'ch-1')!;
    expect(zeilen(exportCsv('deals', q))[1]).toContain('"Angebot; live besprechen"');
    expect(d.STUFE_NAME).toBe('Angebot');
    expect(exportDateiname('followups', HEUTE)).toBe('MAKE-OS-Follow-ups-2026-09-27.csv');
    expect(istExportArt('deals')).toBe(true);
    expect(istExportArt('alles')).toBe(false);
    expect(csvTabelle<{ a: string }>([['A', z => z.a]], [{ a: 'x' }])).toBe('﻿A\nx');
  });
  it('die Privatnotiz steht in keiner Tabelle — weder als Spalte noch als Wert', () => {
    for (const was of EXPORTE) {
      const csv = exportCsv(was, q);
      expect(csv).not.toContain('PRIVAT-GEHEIM');
      expect(csv).not.toContain('AUCH-PRIVAT');
      expect(EXPORT_SPALTEN[was].some(s => /PRIVAT/i.test(s))).toBe(false);
    }
  });
});

describe('Export — Inhalt', () => {
  it('Kontakte: Firma über die Kennung, Kanal-Freigabe, Werbesperre markiert statt weggelassen', () => {
    const t = tabelle(exportCsv('kontakte', q));
    const anna = t.find(z => z.ID === 'c-anna')!, ben = t.find(z => z.ID === 'c-ben')!;
    expect(anna).toMatchObject({ FIRMA: 'Alpha GmbH', FIRMA_ID: 'f-alpha', BRANCHE: 'Maschinenbau', KREIS: 'A', ROLLEN: 'partner', MAIL_ERLAUBT: 'ja' });
    expect(ben).toMatchObject({ FIRMA: 'Beta AG', WERBESPERRE: 'seit 2026-09-10', MAIL_ERLAUBT: 'nein' });
  });
  it('Firmen: Lead-Status, Personen, offene Deals und aktive Mandate — Deal per Kennung UND per altem Namen', () => {
    const t = tabelle(exportCsv('firmen', q));
    expect(t.find(z => z.ID === 'f-alpha')).toMatchObject({ NAME: 'Alpha GmbH', LEAD_STATUS: 'sql', SQL_AM: '2026-09-01', PERSONEN: '1', DEALS_OFFEN: '0', MANDATE_AKTIV: '1' });
    expect(t.find(z => z.ID === 'f-beta')).toMatchObject({ PERSONEN: '0', DEALS_OFFEN: '0', MANDATE_AKTIV: '0' });
  });
  it('Deals: Firma per firmaId (Name der Firma, nicht der alte Text), Personen, Gesamtwert und Wahrscheinlichkeit von Hand', () => {
    const t = tabelle(exportCsv('deals', q));
    const d1 = t.find(z => z.ID === 'ch-1')!, d2 = t.find(z => z.ID === 'ch-2')!;
    // ch-1 hat keine firmaId, aber Anna → keine Firma am Deal selbst; ch-2 trägt den alten Namen „Beta AG“ → eindeutig aufgelöst
    expect(d1).toMatchObject({ PERSONEN: 'anna Test', GESAMTWERT: '30000', WAHRSCHEINLICHKEIT_PROZENT: '80', GEWICHTET: '24000', NAECHSTER_SCHRITT_DATUM: '2026-10-01', ANGELEGT: HEUTE });
    expect(d2).toMatchObject({ FIRMA: 'Beta AG', FIRMA_ID: 'f-beta', STUFE: 'verloren', GRUND: 'Preis', GESAMTWERT: '5000', WAHRSCHEINLICHKEIT_PROZENT: '0' });
  });
  it('Follow-ups: Person, Firma der Person und Bezug in Klartext, nach Fälligkeit sortiert', () => {
    const t = tabelle(exportCsv('followups', q));
    expect(t.map(z => z.ID)).toEqual(['fu-2', 'fu-3', 'fu-1']);
    expect(t.find(z => z.ID === 'fu-1')).toMatchObject({ PERSON: 'anna Test', FIRMA: 'Alpha GmbH', BEZUG_ART: 'chance', BEZUG: 'Retainer Alpha', STATUS: 'offen' });
    expect(t.find(z => z.ID === 'fu-2')).toMatchObject({ BEZUG_ART: 'mandat', BEZUG: 'Alpha GmbH', ERGEBNIS: 'gespraech', ERLEDIGT_AM: HEUTE });
    expect(t.find(z => z.ID === 'fu-3')).toMatchObject({ PERSON: 'ben Test', BEZUG_ART: 'kontakt', BEZUG: 'ben Test', NOTIZ: 'GEHEIM-NOTIZ-NEIN' });
    expect(bezugTitel({ bezug: { art: 'event', id: 'ev-x' } }, q)).toBeUndefined();
  });
  it('Mandate: Kunde über die Firmen-Kennung (nicht der alte Text), Honorar, Health, offene Punkte', () => {
    const t = tabelle(exportCsv('mandate', q));
    expect(t[0]).toMatchObject({ KUNDE: 'Alpha GmbH', FIRMA_ID: 'f-alpha', PERSONEN: 'anna Test', HONORAR_BETRAG: '2500', HONORAR_BASIS: 'monat', NETTO: 'ja', UST_SATZ: '19', HEALTH_BETEILIGUNG: '80', HEALTH_UMSETZUNG: '', OFFENE_PUNKTE: '1', VERTRAG_UNTERSCHRIEBEN: 'ja' });
  });
});

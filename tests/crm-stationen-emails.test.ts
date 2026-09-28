// ─── Stationen, mehrere E-Mail-Adressen, Mutterfirmen, Mehrfachwerte (28.09.) ──
// Kevins Entscheidung 28.09. (#2/#3/#7/#11, „CRM grundsätzlich fertig“). Oberstes Gebot:
// kein Datenverlust, voll rückwärtskompatibel — deshalb zuerst der Migrationstest mit einem
// Bestand im alten Format. Alle Daten erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import { saeubereKontakt, serverStempel, bezuegeSynchron, teilAnwenden, kontaktVereinen, importieren, identitaetsMerkmale, wendeAktivitaetAn, findeKontakte, type Kontakt } from '../lib/make-one/crm';
import { firmaWechselAnwenden, firmaWechselFehlt, stationenVon, hauptStation, personenDerFirma, personenJeFirma, personenAufteilen, firmenDerPerson, stationWechseln, stationHinzufuegen, stationBeenden, stationenFelder, stationenSynchron, aktivitaetZurFirma, stationenBefund, stationenSaeubern, STATIONEN_MAX } from '../lib/crm/stationen';
import { emailsVon, emailsSynchron, emailsFelder, alleAdressen, emailsBefund, emailsSaeubern } from '../lib/crm/emails';
import { typenVon, kategorienVon, hatTyp, mehrfachSynchron, typenFelder } from '../lib/crm/mehrfach';
import { firmenGruppe, mutterPruefen, kreisFirmen, toechter } from '../lib/crm/konzern';
import { leererBestand, wendeCrmAn, crmGrenzen, LISTEN_GRENZEN } from '../lib/crm/speicher';
import { loeschSperren } from '../lib/crm/crm-stand';
import { dubletten, zusammenfuehren } from '../lib/crm/dubletten';
import { firmenAbgleich } from '../lib/crm/firmen';
import { leads } from '../lib/crm/leads';
import { beanFirma, beanGruppe } from '../lib/crm/bean';
import { kontakteCsv, firmenCsv } from '../lib/crm/export';
import { imSegment, kontextAus } from '../lib/crm/segmente';
import { umsatzBezug } from '../lib/crm/umsatz';
import type { CrmBestand, Firma, Mandat, Chance } from '../lib/crm/typen';

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Probe${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), firmen: [firma('f-alpha'), firma('f-beta'), firma('f-gamma')], ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: 'Firma f-beta', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const Q = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: { ...Q }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });

/** Der Schreibweg der Kartei-Route (PATCH /api/state/kontakte): Säuberung → Vereinen → Stationen/E-Mails → Server-Stempel. */
const speichereTeil = (alt: Kontakt, felder: Record<string, unknown>, name?: (id: string) => string | undefined): Kontakt => {
  const neu = saeubereKontakt(teilAnwenden(alt, felder))!;
  return serverStempel(bezuegeSynchron(kontaktVereinen(neu, alt), alt, HEUTE, name), alt, HEUTE);
};
const speichereGanz = (alt: Kontakt, eintrag: Kontakt, name?: (id: string) => string | undefined): Kontakt =>
  serverStempel(bezuegeSynchron(kontaktVereinen(saeubereKontakt(eintrag)!, alt), alt, HEUTE, name), alt, HEUTE);
const namen = (id: string) => ({ 'f-alpha': 'Firma f-alpha', 'f-beta': 'Firma f-beta', 'f-gamma': 'Firma f-gamma' } as Record<string, string>)[id];

describe('Migration: Bestand im alten Format (nur firmaId/email/position) — nichts geht verloren', () => {
  const alt = k('c-alt1', { email: 'vera.alt@example.invalid', firmaId: 'f-alpha', firma: 'Firma f-alpha', position: 'Leitung Einkauf', typ: 'Zielkunde', kategorie: 'Mittelstand' });

  it('Lesen leitet eine aktive Hauptstation und eine Haupt-Adresse ab — ohne zu schreiben', () => {
    expect(stationenVon(alt)).toEqual([{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: true, haupt: true }]);
    expect(emailsVon(alt)).toEqual([{ adresse: 'vera.alt@example.invalid', haupt: true }]);
    expect(typenVon(alt)).toEqual(['Zielkunde']);
    expect(alt.stationen).toBeUndefined();
    expect(alt.emails).toBeUndefined();
    // Säubern (Lesen/Laden) ändert den Altbestand nicht.
    expect(saeubereKontakt(alt)).toEqual(alt);
  });

  it('eine fremde Änderung (Notiz) schreibt keine neuen Felder, alte Felder stimmen', () => {
    const n = speichereTeil(alt, { notiz: 'neue Notiz' }, namen);
    expect(n.stationen).toBeUndefined();
    expect(n.emails).toBeUndefined();
    expect(n.typen).toBeUndefined();
    expect(n).toMatchObject({ firmaId: 'f-alpha', firma: 'Firma f-alpha', position: 'Leitung Einkauf', email: 'vera.alt@example.invalid', typ: 'Zielkunde', notiz: 'neue Notiz' });
  });

  it('eine neue Position (nur Rolle) bleibt trivial — alte Felder genügen', () => {
    const n = speichereTeil(alt, { position: 'Geschäftsführung' }, namen);
    expect(n.stationen).toBeUndefined();
    expect(n.position).toBe('Geschäftsführung');
    expect(stationenVon(n)[0].rolle).toBe('Geschäftsführung');
  });

  it('alter Weg (nur firmaId, ohne Absicht) beim Altbestand = Korrektur wie früher — nichts Neues geschrieben', () => {
    const n = speichereTeil(alt, { firmaId: 'f-beta', firma: 'Firma f-beta' }, namen);
    expect(n.firmaId).toBe('f-beta');
    expect(n.firma).toBe('Firma f-beta');
    expect(n.position).toBe('Leitung Einkauf');
    expect(n.stationen).toBeUndefined();
  });

  it('mit gespeicherten Stationen und ohne Absicht endet in der reinen Rechnung nie eine Station (die Route lehnt vorher ab)', () => {
    const mit = { ...alt, stationen: [{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: true, haupt: true }, { firmaId: 'f-gamma', aktiv: false, bis: '2019-01-01' }] };
    expect(firmaWechselFehlt(mit, { firmaId: 'f-beta' })).toBe(true);
    expect(firmaWechselFehlt(mit, { firmaId: 'f-beta', firmaWechsel: 'korrektur' })).toBe(false);
    expect(firmaWechselFehlt(mit, { notiz: 'x' })).toBe(false);
    expect(firmaWechselFehlt(alt, { firmaId: 'f-beta' })).toBe(false);
    const n = stationenSynchron<Kontakt>({ ...mit, firmaId: 'f-beta' }, mit, HEUTE, namen);
    expect(n.stationen!.filter(s => s.aktiv).map(s => s.firmaId).sort()).toEqual(['f-alpha', 'f-beta']);
    expect(n.stationen!.some(s => s.firmaId === 'f-alpha' && s.bis)).toBe(false);
  });

  it('die drei Absichten (rein): Jobwechsel · Zusätzlich · Korrektur, auch ohne neue Firma', () => {
    const mit = { ...alt, stationen: [{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: true, haupt: true }] };
    expect(firmaWechselAnwenden(mit, 'f-beta', 'jobwechsel', HEUTE)).toEqual([{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: false, bis: HEUTE }, { firmaId: 'f-beta', von: HEUTE, aktiv: true, haupt: true }]);
    expect(firmaWechselAnwenden(mit, 'f-beta', 'zusaetzlich', HEUTE)).toEqual([{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: true, haupt: true }, { firmaId: 'f-beta', aktiv: true }]);
    expect(firmaWechselAnwenden(mit, 'f-beta', 'korrektur', HEUTE)).toEqual([{ firmaId: 'f-beta', rolle: 'Leitung Einkauf', aktiv: true, haupt: true }]);
    expect(firmaWechselAnwenden(mit, undefined, 'jobwechsel', HEUTE)).toEqual([{ firmaId: 'f-alpha', rolle: 'Leitung Einkauf', aktiv: false, bis: HEUTE }]);
    expect(firmaWechselAnwenden(mit, undefined, 'korrektur', HEUTE)).toEqual([]);
    // Altbestand (nur firmaId/position) wird dabei aus den alten Feldern abgeleitet.
    expect(firmaWechselAnwenden(alt, 'f-beta', 'jobwechsel', HEUTE)[0]).toMatchObject({ firmaId: 'f-alpha', aktiv: false, bis: HEUTE });
  });

  it('ein älteres Fenster ohne `stationen`/`emails` (ganzer Eintrag) löscht die gespeicherten nie', () => {
    const mit = speichereTeil(alt, { stationen: stationWechseln(alt, { firmaId: 'f-beta', rolle: 'CFO' }, HEUTE), emails: [{ adresse: 'vera.alt@example.invalid', haupt: true }, { adresse: 'vera.privat@example.invalid', art: 'privat' }] }, namen);
    const { stationen: _s, emails: _e, ...ohne } = mit;
    const n = speichereGanz(mit, { ...ohne, notiz: 'aus altem Fenster' } as Kontakt, namen);
    expect(n.stationen).toEqual(mit.stationen);
    expect(n.emails).toEqual(mit.emails);
    expect(n.firmaId).toBe('f-beta');
    expect(n.position).toBe('CFO');
    expect(n.email).toBe('vera.alt@example.invalid');
  });

  it('`null` im teil leert Stationen/Adressen nie still (nur ein ausdrückliches [] tut es)', () => {
    const mit = speichereTeil(alt, { emails: [{ adresse: 'vera.alt@example.invalid', haupt: true }, { adresse: 'vera.zwei@example.invalid' }] });
    expect(speichereTeil(mit, { emails: null }).emails).toEqual(mit.emails);
    expect(speichereTeil(mit, { emails: [] }).email).toBeUndefined();
  });
});

describe('Stationen — mehrere Firmen, Hauptstation, Historie', () => {
  const vera = k('c-vera1', { firmaId: 'f-alpha', firma: 'Firma f-alpha', position: 'GF' });

  it('Jobwechsel (Oberfläche) erhält die Historie, Aktivitäten behalten ihre Firma', () => {
    const mitAkt = wendeAktivitaetAn(vera, { art: 'anruf', von: 'kevin', text: 'Gespräch' }, HEUTE, '2026-09-10T10:00:00.000Z', (d, n) => d.slice(0, 8) + String(Number(d.slice(8)) + n).padStart(2, '0'));
    expect(mitAkt.aktivitaeten[0].firmaId).toBe('f-alpha');
    const n = speichereTeil(mitAkt, stationenFelder(mitAkt, stationWechseln(mitAkt, { firmaId: 'f-beta', rolle: 'CEO', art: 'geschaeftsfuehrung', von: '2026-09-20' }, HEUTE), HEUTE, namen) as Record<string, unknown>, namen);
    expect(n).toMatchObject({ firmaId: 'f-beta', firma: 'Firma f-beta', position: 'CEO' });
    expect(n.stationen).toEqual([
      { firmaId: 'f-alpha', rolle: 'GF', aktiv: false, bis: '2026-09-20' },
      { firmaId: 'f-beta', rolle: 'CEO', art: 'geschaeftsfuehrung', von: '2026-09-20', aktiv: true, haupt: true },
    ]);
    // Zeitlinie der alten Firma behält die Aktivität, auch nach dem Wechsel.
    expect(aktivitaetZurFirma(n, n.aktivitaeten[0], 'f-alpha')).toBe(true);
    expect(aktivitaetZurFirma(n, n.aktivitaeten[0], 'f-beta')).toBe(false);
    // Altbestand ohne firmaId an der Aktivität: über den Zeitraum der Station.
    expect(aktivitaetZurFirma(n, { am: '2026-09-05T08:00:00Z' }, 'f-alpha')).toBe(true);
    expect(aktivitaetZurFirma(n, { am: '2026-09-25T08:00:00Z' }, 'f-alpha')).toBe(false);
    expect(aktivitaetZurFirma(n, { am: '2026-09-25T08:00:00Z' }, 'f-beta')).toBe(true);
  });

  it('weitere Firma: zwei laufende Stationen, die Hauptstation bleibt; Personen einer Firma über die Stationen', () => {
    const n = speichereTeil(vera, stationenFelder(vera, stationHinzufuegen(vera, { firmaId: 'f-gamma', rolle: 'Beirätin', art: 'beirat' }), HEUTE, namen) as Record<string, unknown>, namen);
    expect(n.firmaId).toBe('f-alpha');
    expect(firmenDerPerson(n)).toEqual(['f-alpha', 'f-gamma']);
    const andere = k('c-otto1', { firmaId: 'f-gamma' });
    expect(personenDerFirma([n, andere], 'f-gamma').map(x => x.id)).toEqual(['c-vera1', 'c-otto1']);
    expect(personenDerFirma([n, andere], 'f-alpha').map(x => x.id)).toEqual(['c-vera1']);
    const beendet = speichereTeil(n, stationenFelder(n, stationBeenden(n, 1, HEUTE), HEUTE, namen) as Record<string, unknown>, namen);
    expect(personenAufteilen([beendet, andere], 'f-gamma')).toEqual({ aktuell: [andere], ehemalig: [beendet] });
    expect(personenDerFirma([beendet], 'f-gamma', { nurAktiv: false })).toHaveLength(1);
  });

  it('genau eine Hauptstation; Hauptstation beenden macht eine andere laufende zur Hauptstation', () => {
    const l = stationenSaeubern([{ firmaId: 'f-alpha', aktiv: true, haupt: true }, { firmaId: 'f-beta', aktiv: true, haupt: true }, { firmaId: 'f-gamma', aktiv: false, haupt: true, bis: '2026-01-01' }])!;
    expect(l.filter(s => s.haupt)).toHaveLength(1);
    const n = stationenSynchron<Kontakt>({ ...k('c-x0001'), stationen: [{ firmaId: 'f-alpha', aktiv: false, bis: HEUTE }, { firmaId: 'f-beta', aktiv: true }] }, k('c-x0001', { firmaId: 'f-alpha' }), HEUTE, namen);
    expect(n.firmaId).toBe('f-beta');
    expect(hauptStation(n.stationen!)?.firmaId).toBe('f-beta');
    expect(n.stationen!.find(s => s.firmaId === 'f-beta')?.haupt).toBe(true);
  });

  it('ausgeschieden ohne neue Firma: firmaId/firma/position fallen, die Historie bleibt', () => {
    const n = speichereTeil(vera, stationenFelder(vera, stationBeenden(vera, 0, HEUTE), HEUTE, namen) as Record<string, unknown>, namen);
    expect(n.firmaId).toBeUndefined();
    expect(n.firma).toBeUndefined();
    expect(n.position).toBeUndefined();
    expect(n.stationen).toEqual([{ firmaId: 'f-alpha', rolle: 'GF', aktiv: false, bis: HEUTE }]);
    // Der Firmen-Abgleich verknüpft sie nicht still neu (Stationen sind die Wahrheit).
    expect(firmenAbgleich([{ ...n, firma: 'Firma f-alpha' }], [firma('f-alpha')], J).kontakte[0].firmaId).toBeUndefined();
  });

  it('Obergrenze: über STATIONEN_MAX abgelehnt statt gekürzt', () => {
    const viele = Array.from({ length: STATIONEN_MAX + 1 }, (_, i) => ({ firmaId: `f-x${i}`, aktiv: false, bis: '2020-01-01' }));
    expect(saeubereKontakt({ ...vera, stationen: viele })).toBeNull();
  });

  it('Leser: Leads, BEAN, Export, Segmente zählen die Person bei jeder laufenden Firma', () => {
    const n = { ...vera, stationen: [{ firmaId: 'f-alpha', rolle: 'GF', aktiv: true, haupt: true }, { firmaId: 'f-beta', rolle: 'Beirat', aktiv: true }] };
    const crm = bestand({ mandate: [mandat('m-1', { firmaId: 'f-beta' })] });
    expect(leads([n], crm, HEUTE).filter(z => z.art === 'firma').map(z => z.id).sort()).toEqual(['f-alpha', 'f-beta']);
    expect(beanFirma(firma('f-beta'), crm, [n]).bean).toBe('B');
    expect(personenJeFirma([n]).get('f-beta')).toHaveLength(1);
    const csv = firmenCsv({ kontakte: [n], crm, heute: HEUTE });
    expect(csv.split('\n').find(z => z.includes('f-beta'))).toMatch(/;1;/);
    expect(kontakteCsv({ kontakte: [n], crm, heute: HEUTE })).toContain('Firma f-beta, Beirat');
    const ctx = kontextAus({ ...crm, firmen: [firma('f-alpha', { rolle: 'zielkunde' }), firma('f-beta', { rolle: 'kunde' })] }, HEUTE);
    expect(imSegment(n, { firmaRolle: ['kunde'] }, ctx)).toBe(true);
  });

  it('Verbindungsprüfung: tote Station, falsche Hauptstation', () => {
    const da = (id: string) => id !== 'f-weg';
    expect(stationenBefund({ firmaId: 'f-alpha', stationen: [{ firmaId: 'f-alpha', aktiv: true, haupt: true }] }, da)).toEqual({ firmaTot: false, hauptFalsch: false });
    expect(stationenBefund({ firmaId: 'f-alpha', stationen: [{ firmaId: 'f-alpha', aktiv: true, haupt: true }, { firmaId: 'f-weg', aktiv: false }] }, da).firmaTot).toBe(true);
    expect(stationenBefund({ firmaId: 'f-beta', stationen: [{ firmaId: 'f-alpha', aktiv: true, haupt: true }] }, da).hauptFalsch).toBe(true);
    expect(stationenBefund({ firmaId: 'f-alpha', stationen: [{ firmaId: 'f-alpha', aktiv: true }] }, da).hauptFalsch).toBe(true);
  });
});

describe('Mehrere E-Mail-Adressen', () => {
  const eva = k('c-eva01', { vorname: 'Eva', nachname: 'Beispiel', email: 'eva@example.invalid', hubspotId: '4711', firma: 'Musterwerk AG' });

  it('alter Schreiber ändert `email`: die neue wird Haupt-Adresse, die alte bleibt als weitere', () => {
    const n = emailsSynchron({ ...eva, email: 'eva.neu@example.invalid' }, eva);
    expect(n.email).toBe('eva.neu@example.invalid');
    expect(n.emails).toEqual([{ adresse: 'eva.neu@example.invalid', haupt: true }, { adresse: 'eva@example.invalid' }]);
  });

  it('Liste ist die Wahrheit: Haupt wählen, `email` folgt; Doppelte fallen weg', () => {
    const l = emailsSaeubern([{ adresse: 'EVA@example.invalid ' }, { adresse: 'eva@example.invalid', haupt: true }, { adresse: 'eva.p@example.invalid', art: 'privat' }])!;
    expect(l).toEqual([{ adresse: 'eva@example.invalid', haupt: true }, { adresse: 'eva.p@example.invalid', art: 'privat' }]);
    const f = emailsFelder(eva, [{ adresse: 'eva@example.invalid' }, { adresse: 'eva.p@example.invalid', art: 'privat', haupt: true }]);
    expect(f.email).toBe('eva.p@example.invalid');
    expect(emailsBefund({ email: 'eva@example.invalid', emails: f.emails })).toBe(true);
    expect(emailsBefund({ email: f.email, emails: f.emails })).toBe(false);
  });

  it('Import: eine zweite Adresse (gleiche HubSpot-ID) wird angehängt — nicht überschrieben, nicht doppelt angelegt', () => {
    const r = importieren([eva], [{ VORNAME: 'Eva', NACHNAME: 'Beispiel', EMAIL: 'eva.zwei@example.invalid', HUBSPOT_ID: '4711', FIRMA: 'Musterwerk AG' }], HEUTE);
    expect(r).toMatchObject({ neu: 0, aktualisiert: 1, weitereAdressen: 1 });
    expect(r.kontakte).toHaveLength(1);
    expect(r.kontakte[0].email).toBe('eva@example.invalid');
    expect(alleAdressen(r.kontakte[0])).toEqual(['eva@example.invalid', 'eva.zwei@example.invalid']);
    // Idempotent: die Zeile trifft jetzt über die zweite Adresse direkt.
    const r2 = importieren(r.kontakte, [{ VORNAME: 'Eva', NACHNAME: 'Beispiel', EMAIL: 'eva.zwei@example.invalid', HUBSPOT_ID: '4711', FIRMA: 'Musterwerk AG' }], HEUTE);
    expect(r2).toMatchObject({ neu: 0, aktualisiert: 0, unveraendert: 1, weitereAdressen: 0 });
  });

  it('Import: Rückfall über Name + Firma nur eindeutig; ein anderer Name bleibt eine neue Person', () => {
    const r = importieren([eva], [{ VORNAME: 'Eva', NACHNAME: 'Beispiel', EMAIL: 'vp@example.invalid', FIRMA: 'Musterwerk GmbH' }], HEUTE);
    expect(r.neu).toBe(0);
    expect(alleAdressen(r.kontakte[0])).toContain('vp@example.invalid');
    const zwei = importieren([eva], [{ VORNAME: 'Otto', NACHNAME: 'Anders', EMAIL: 'otto@example.invalid', FIRMA: 'Musterwerk AG' }], HEUTE);
    expect(zwei.neu).toBe(1);
  });

  it('Online gewinnt: eine von Hand geleerte Adresse wird nicht still gefüllt (Konflikt)', () => {
    const leer = { ...eva, email: undefined, vonHand: ['email'] };
    const r = importieren([leer], [{ VORNAME: 'Eva', NACHNAME: 'Beispiel', EMAIL: 'eva@example.invalid', HUBSPOT_ID: '4711' }], HEUTE);
    expect(r.konflikte.map(x => x.feld)).toContain('email');
    expect(r.kontakte[0].email).toBeUndefined();
  });

  it('Sperrliste, Suche und Dubletten prüfen alle Adressen', () => {
    const mit = { ...eva, emails: [{ adresse: 'eva@example.invalid', haupt: true }, { adresse: 'eva.alt@example.invalid', art: 'alt' as const }] };
    expect(identitaetsMerkmale(mit)).toEqual(expect.arrayContaining(['m:eva@example.invalid', 'm:eva.alt@example.invalid']));
    expect(findeKontakte([mit], 'eva.alt@example.invalid').map(x => x.id)).toEqual([mit.id]);
    const zwilling = k('c-zwill1', { vorname: 'E.', nachname: 'Anders', email: 'eva.alt@example.invalid' });
    expect(dubletten([mit, zwilling]).map(([a, b]) => [a.id, b.id].sort().join('|'))).toEqual([[mit.id, zwilling.id].sort().join('|')]);
  });
});

describe('Dubletten zusammenführen vereint Stationen, Adressen und Mehrfachwerte ohne Doppelte', () => {
  it('beide Historien, eine Hauptstation, alle Adressen, Typen vereinigt', () => {
    const a = k('c-a0001', { email: 'a@example.invalid', firmaId: 'f-alpha', position: 'GF', typ: 'Kunde', labels: ['VIP'] });
    const b = k('c-b0001', { email: 'b@example.invalid', stationen: [{ firmaId: 'f-alpha', rolle: 'Geschäftsführerin', von: '2020-01-01', aktiv: true, haupt: true }, { firmaId: 'f-beta', aktiv: false, bis: '2019-12-31' }], typen: ['Netzwerk', 'kunde'], labels: ['VIP', 'Messe'] });
    const m = zusammenfuehren(a, b, 'kevin', `${HEUTE}T10:00:00Z`);
    expect(m.email).toBe('a@example.invalid');
    expect(m.emails?.map(x => x.adresse)).toEqual(['a@example.invalid', 'b@example.invalid']);
    expect(m.stationen).toEqual([{ firmaId: 'f-alpha', rolle: 'GF', von: '2020-01-01', aktiv: true, haupt: true }, { firmaId: 'f-beta', aktiv: false, bis: '2019-12-31' }]);
    expect(m.firmaId).toBe('f-alpha');
    expect(typenVon(m)).toEqual(['Kunde', 'Netzwerk']);
    expect(m.labels).toEqual(['VIP', 'Messe']);
  });
});

describe('Typ, Kategorie, Labels mehrfach', () => {
  it('alter Schreiber (Import, Einzelwahl) ersetzt den ersten Wert; Liste ist die Wahrheit; „enthält“', () => {
    const alt = k('c-t0001', { typ: 'Lead', typen: ['Lead', 'Netzwerk'] });
    expect(mehrfachSynchron({ ...alt, typ: 'Kunde' }, alt)).toMatchObject({ typ: 'Kunde', typen: ['Kunde', 'Netzwerk'] });
    expect(mehrfachSynchron({ ...alt, ...typenFelder(['Netzwerk', 'Partner']) }, alt)).toMatchObject({ typ: 'Netzwerk', typen: ['Netzwerk', 'Partner'] });
    expect(hatTyp(alt, 'netzwerk')).toBe(true);
    expect(kategorienVon(k('c-t0002', { kategorie: 'Mittelstand' }))).toEqual(['Mittelstand']);
    // Altbestand ohne Liste bleibt ohne Liste.
    const leg = k('c-t0003', { typ: 'Lead' });
    expect(mehrfachSynchron({ ...leg, typ: 'Kunde' }, leg).typen).toBeUndefined();
  });

  it('Segmente: Kriterium „enthält einen von“', () => {
    const ctx = kontextAus(bestand(), HEUTE);
    const p = k('c-s0001', { typen: ['Zielkunde', 'Multiplikator'], typ: 'Zielkunde', labels: ['Messe 2026'] });
    expect(imSegment(p, { typ: ['multiplikator'] }, ctx)).toBe(true);
    expect(imSegment(p, { label: ['Messe 2026'] }, ctx)).toBe(true);
    expect(imSegment(p, { typ: ['Presse'] }, ctx)).toBe(false);
  });
});

describe('Mutter- und Tochterfirmen', () => {
  const liste = [firma('f-mutter'), firma('f-tochter', { mutterId: 'f-mutter' }), firma('f-enkel', { mutterId: 'f-tochter' }), firma('f-allein')];

  it('Gruppe = oberste Mutter und alle Nachfahren', () => {
    expect(firmenGruppe(liste, 'f-enkel').sort()).toEqual(['f-enkel', 'f-mutter', 'f-tochter']);
    expect(firmenGruppe(liste, 'f-allein')).toEqual(['f-allein']);
    expect(toechter(liste, 'f-mutter').map(f => f.id)).toEqual(['f-tochter']);
  });

  it('Zyklus Mutter/Tochter wird abgelehnt — nur diese Änderung, der Rest gilt', () => {
    const b = { ...leererBestand(), firmen: liste };
    const r = wendeCrmAn(b, [{ liste: 'firmen', op: 'teil', id: 'f-mutter', felder: { mutterId: 'f-enkel' } }, { liste: 'firmen', op: 'teil', id: 'f-allein', felder: { notiz: 'bleibt' } }], J, 'kevin');
    expect(r.fehler.join(' ')).toMatch(/Kreis/);
    expect(r.bestand.firmen.find(f => f.id === 'f-mutter')?.mutterId).toBeUndefined();
    expect(r.bestand.firmen.find(f => f.id === 'f-allein')?.notiz).toBe('bleibt');
    expect(kreisFirmen(r.bestand.firmen)).toEqual([]);
    // Tote Mutter und Selbstbezug ebenso.
    expect(wendeCrmAn(b, [{ liste: 'firmen', op: 'teil', id: 'f-allein', felder: { mutterId: 'f-gibtsnicht' } }], J, 'kevin').fehler.join(' ')).toMatch(/gibt es nicht/);
    expect(wendeCrmAn(b, [{ liste: 'firmen', op: 'teil', id: 'f-allein', felder: { mutterId: 'f-allein' } }], J, 'kevin').bestand.firmen.find(f => f.id === 'f-allein')?.mutterId).toBeUndefined();
    expect(mutterPruefen(liste, liste).fehler).toEqual([]);
  });

  it('Löschsperre: eine Mutter mit Töchtern und eine Firma mit ehemaligen Personen werden nicht gelöscht', () => {
    const b = { ...leererBestand(), firmen: liste };
    expect(loeschSperren(b, [{ liste: 'firmen', op: 'delete', id: 'f-mutter' }])[0]?.anzahl.toechter).toBe(1);
    const ehemalig = k('c-ex001', { stationen: [{ firmaId: 'f-allein', aktiv: false, bis: '2025-01-01' }] });
    expect(loeschSperren(b, [{ liste: 'firmen', op: 'delete', id: 'f-allein' }], { kontakte: [ehemalig] })[0]?.anzahl.personen).toBe(1);
  });

  it('Umsatz und BEAN für die ganze Gruppe', () => {
    const crm = { ...leererBestand(), firmen: liste, mandate: [mandat('m-t', { firmaId: 'f-tochter', kunde: 'Firma f-tochter' })], chancen: [deal('d-e', { firmaId: 'f-enkel' })] };
    const p = k('c-g0001', { firmaId: 'f-mutter' });
    expect(umsatzBezug(p, crm, [], HEUTE).mandate).toHaveLength(0);
    const g = umsatzBezug(p, crm, [{ id: 'r-1', kunde: 'Firma f-tochter', titel: 'x', betrag: 100, status: 'bezahlt', mandatId: 'm-t' }], HEUTE, { gruppe: true });
    expect(g.mandate.map(m => m.id)).toEqual(['m-t']);
    expect(g.deals.map(c => c.id)).toEqual(['d-e']);
    expect(g.rechnungen).toHaveLength(1);
    expect(g.gruppe?.map(f => f.id).sort()).toEqual(['f-enkel', 'f-mutter', 'f-tochter']);
    expect(beanGruppe(firmenGruppe(liste, 'f-mutter'), crm, []).bean).toBe('B');
  });
});

describe('Nie abschneiden: Listen im CRM-Bestand (28.09.)', () => {
  it('Kampagne mit mehr als 1.000 Ergebnissen und 500 Kontakten wird nicht mehr gekürzt; über der Grenze 413', () => {
    const ergebnisse = Array.from({ length: 1500 }, (_, i) => ({ kontaktId: `c-p${String(i).padStart(4, '0')}`, ergebnis: 'angesprochen', am: HEUTE }));
    const kontaktIds = ergebnisse.map(e => e.kontaktId).slice(0, 800);
    const kampagne = { id: 'kp-gross', name: 'Groß', playbook: 'eigen', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds, ergebnisse, von: 'hand' };
    const r = wendeCrmAn(leererBestand(), [{ liste: 'kampagnen', op: 'upsert', eintrag: kampagne }], J, 'kevin');
    expect(r.grenze).toEqual([]);
    expect(r.bestand.kampagnen[0].ergebnisse).toHaveLength(1500);
    expect(r.bestand.kampagnen[0].kontaktIds).toHaveLength(800);
    const zuViel = { ...kampagne, ergebnisse: Array.from({ length: LISTEN_GRENZEN.kampagnen!.ergebnisse + 1 }, () => ergebnisse[0]) };
    expect(crmGrenzen([{ liste: 'kampagnen', op: 'upsert', eintrag: zuViel }])[0]).toMatch(/Abgelehnt, nichts gekürzt/);
    const abgelehnt = wendeCrmAn(leererBestand(), [{ liste: 'kampagnen', op: 'upsert', eintrag: zuViel }], J, 'kevin');
    expect(abgelehnt.grenze).toHaveLength(1);
    expect(abgelehnt.bestand.kampagnen).toEqual([]);
  });

  it('Beitrags-Wirkung über 200 und Deal-Personen über 20 bleiben vollständig', () => {
    const wirkung = Array.from({ length: 350 }, (_, i) => ({ kontaktId: `c-w${String(i).padStart(4, '0')}`, art: 'reaktion', am: HEUTE }));
    const r = wendeCrmAn(leererBestand(), [{ liste: 'beitraege', op: 'upsert', eintrag: { id: 'b-gross', titel: 'B', kanal: 'linkedin', status: 'idee', wirkung, quellen: [] } }], J, 'kevin');
    expect(r.bestand.beitraege[0].wirkung).toHaveLength(350);
    const personen = Array.from({ length: 30 }, (_, i) => `c-d${String(i).padStart(4, '0')}`);
    const b = { ...leererBestand(), chancen: [deal('d-1')] };
    const d = wendeCrmAn(b, [{ liste: 'chancen', op: 'teil', id: 'd-1', felder: { kontaktIds: personen } }], J, 'kevin');
    expect(d.bestand.chancen[0].kontaktIds).toHaveLength(30);
  });
});

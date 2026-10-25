// ─── Kleine Bauten (25.10., Übernahme echter Produkte) — die reinen Regeln je Punkt ─────────────────────────────────────────
// Alle Werte erfunden. Ohne neue Felder/Einstellungen bleibt alles bit-gleich (Gold in tests/kleine-bauten-gold.test.ts).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import type { Leistung, Mandat } from '@/lib/crm/typen';
import { preisteilSaeubern, preisteilPruefen, angebotPositionenAusProdukt, artikelnummerSaeubern, PRODUKT_GRENZEN } from '@/lib/crm/produkt-karte';
import { teilFeldSetzen, PREIS_TEIL_FELDER } from '@/lib/crm/produkt-katalog';
import { positionSaeubern as angebotPositionSaeubern } from '@/lib/crm/angebote';
import { positionSaeubern as rechnungPositionSaeubern, positionenAusAngebot } from '@/lib/finanzen/rechnung/regeln';
import { monatsPositionen, abrechnenPositionen } from '@/lib/crm/mandat-zusatz';
import { angebotDokument } from '@/lib/crm/angebot-dokument';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { rechnungDokument } from '@/lib/finanzen/rechnung/dokument';
import { importPlanen } from '@/lib/crm/produkt-import';
import { GOLD_ABSENDER, GOLD_ANGEBOT, GOLD_RECHNUNG } from './fixtures/kleine-bauten-gold';

const J = '2026-10-25T08:00:00.000Z';
const produkt = (x: Partial<Leistung> = {}): Leistung => ({
  id: 'l-beispiel', name: 'Beispiel-Begleitung', typ: 'retainer', stufe: 'kern', preis: { betrag: 2000, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: [],
  gesellschaft: 'ug', status: 'aktiv', angebot: { leistungstext: 'Monatliche Begleitung.' }, geaendert: J,
  preise: [
    { id: 'pt-1', art: 'monatlich', betragCent: 200_000, rolle: 'grund', artikelnummer: 'BSP-BEG-06' },
    { id: 'pt-2', art: 'tagessatz', betragCent: 120_000, rolle: 'option', artikelnummer: 'BSP-TAG' },
  ],
  vertrag: { mindestlaufzeitMonate: 6 }, ...x,
} as Leistung);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('1 · Artikelnummer am Preis-Teil → Angebots- und Rechnungsposition → PDF', () => {
  it('Säuberer behält sie (Leerraum zusammengezogen), fremde Form fällt weg; Prüfung: zu lang 413, fremde Form 400', () => {
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100, artikelnummer: '  AB-12/3  ' }, 'pt-x')?.artikelnummer).toBe('AB-12/3');
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100, artikelnummer: '<script>' }, 'pt-x')).not.toHaveProperty('artikelnummer');
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100 }, 'pt-x')).not.toHaveProperty('artikelnummer');
    expect(preisteilPruefen({ art: 'fest', artikelnummer: 'X'.repeat(PRODUKT_GRENZEN.artikelnummer + 1) }).map(f => f.status)).toContain(413);
    expect(preisteilPruefen({ art: 'fest', artikelnummer: '-A' }).map(f => f.status)).toContain(400);
    expect(preisteilPruefen({ art: 'fest', artikelnummer: 'A-1' })).toEqual([]);
    expect(artikelnummerSaeubern('Ä-1 .x')).toBe('Ä-1 .x');
  });
  it('Karte: Feld „Artikelnummer“ je Form (außer kostenlos), setzen/leeren/ablehnen', () => {
    expect(PREIS_TEIL_FELDER.monatlich).toContain('artikelnummer');
    expect(PREIS_TEIL_FELDER.kostenlos).toEqual(['text']);
    const t = { id: 'pt-1', art: 'fest' as const, rolle: 'grund' as const };
    const r = teilFeldSetzen(t, 'artikelnummer', ' AB 1 ');
    expect(r.ok && r.teil.artikelnummer).toBe('AB 1');
    const leer = teilFeldSetzen({ ...t, artikelnummer: 'AB' }, 'artikelnummer', '');
    expect(leer.ok && 'artikelnummer' in leer.teil).toBe(false);
    expect(teilFeldSetzen(t, 'artikelnummer', '#1').ok).toBe(false);
  });
  it('Angebotsposition aus dem Preis-Teil trägt sie, der Entwurf-Säuberer behält sie; ohne Nummer am Teil kein Feld', () => {
    const pos = angebotPositionenAusProdukt(produkt(), ['pt-2']);
    expect(pos.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-TAG']);
    expect(angebotPositionSaeubern(pos[0] as unknown as Record<string, unknown>, 0)?.artikelnummer).toBe('BSP-BEG-06');
    const ohne = angebotPositionenAusProdukt(produkt({ preise: [{ id: 'pt-1', art: 'monatlich', betragCent: 200_000, rolle: 'grund' }] }));
    expect(ohne[0]).not.toHaveProperty('artikelnummer');
  });
  it('Rechnung aus dem Angebot und aus dem Mandat (Monatshonorar, Zusatzmodul, abrechnen) trägt die Nummer des Preis-Teils', () => {
    expect(positionenAusAngebot({ positionen: angebotPositionenAusProdukt(produkt(), ['pt-2']) }).map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-TAG']);
    expect(rechnungPositionSaeubern({ titel: 'x', artikelnummer: 'R-1', menge: 1, einzelpreisCent: 1 }, 0)?.artikelnummer).toBe('R-1');
    const modul = produkt({ id: 'l-modul', name: 'Beispiel-Modul', rolle: 'zusatz', preise: [{ id: 'pt-m', art: 'monatlich', betragCent: 30_000, rolle: 'grund', artikelnummer: 'BSP-MOD' }] });
    const m = {
      id: 'm-1', titel: 'Begleitung', honorar: { betrag: 2000, basis: 'monat', netto: true }, ustSatz: 19, leistungen: [], start: '2026-10-01', leistungId: 'l-beispiel',
      zusatz: [{ id: 'mz-a', leistungId: 'l-modul', honorar: { betragCent: 30_000, basis: 'monat' } }, { id: 'mz-e-2', leistungId: 'l-beispiel', preisTeilId: 'pt-2', honorar: { betragCent: 120_000, basis: 'tag' } }],
    } as unknown as Mandat;
    const ctx = { katalog: [produkt(), modul], nettoAusBrutto: (b: number) => b };
    const pos = monatsPositionen(m, '2026-11', ctx);
    expect(pos.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-MOD']);
    const ab = abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-e-2', menge: 2 }], ctx);
    expect(ab.ok && ab.positionen[0].artikelnummer).toBe('BSP-TAG');
    // Ohne Katalog (bzw. ohne Nummer): bit-gleich wie bisher — kein Feld.
    expect(monatsPositionen(m, '2026-11', { nettoAusBrutto: (b: number) => b }).some(p => 'artikelnummer' in p)).toBe(false);
  });
  it('Dokument, Vorschau und PDF: Spalte „Art.-Nr.“ nur mit Nummer; mit Nummer ändert sich das PDF', async () => {
    const mit = { ...GOLD_ANGEBOT, positionen: GOLD_ANGEBOT.positionen.map((p, i) => (i === 0 ? { ...p, artikelnummer: 'BSP-BEG-06' } : p)) };
    const d = angebotDokument(mit, GOLD_ABSENDER, { name: 'Max Muster', zeilen: ['Beispielkunde GmbH'] }, '2026-10-20');
    expect(d.positionen.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', undefined]);
    const { Blatt } = await import('@/components/os/crm/angebot/Blatt');
    expect(renderToStaticMarkup(createElement(Blatt, { d }))).toContain('Art.-Nr.');
    const ohne = angebotDokument(GOLD_ANGEBOT, GOLD_ABSENDER, { name: 'Max Muster', zeilen: ['Beispielkunde GmbH'] }, '2026-10-20');
    expect(renderToStaticMarkup(createElement(Blatt, { d: ohne }))).not.toContain('Art.-Nr.');
    const erstellt = new Date(J);
    expect(sha(await angebotPdf(d, { erstellt }))).not.toBe(sha(await angebotPdf(ohne, { erstellt })));
    const r = rechnungDokument({ ...GOLD_RECHNUNG, positionen: GOLD_RECHNUNG.positionen!.map(p => ({ ...p, artikelnummer: 'X'.repeat(40) })) }, GOLD_ABSENDER, { datum: '2026-10-20' });
    expect(r.positionen[0].artikelnummer).toHaveLength(40);
    expect((await angebotPdf(r, { erstellt })).length).toBeGreaterThan(1000);
  });
  it('Import: Artikelnummer je Preis-Teil (auch aus der Tabelle), zu lang → 413, zweiter Lauf „gleich“', async () => {
    const k = { neueId: () => 'l-neu-1' };
    const p = importPlanen({ leistungen: [] }, [{ name: 'Beispiel-Begleitung', leistungstext: 'x', gesellschaft: 'ug', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-1' }] }], k);
    expect(p.status).toBe(200);
    const eintrag = (p.ops[0] as { eintrag: Record<string, unknown> }).eintrag;
    expect((eintrag.preise as { artikelnummer?: string }[])[0].artikelnummer).toBe('BSP-1');
    expect(p.zeilen[0].felder.find(f => f.feld === 'preise')?.neu).toContain('Art.-Nr. BSP-1');
    const bestand = { leistungen: [produkt({ id: 'l-neu-1', name: 'Beispiel-Begleitung', angebot: { leistungstext: 'x' }, preise: eintrag.preise as Leistung['preise'] })] };
    const zweiter = importPlanen(bestand, [{ name: 'Beispiel-Begleitung', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-1' }] }], k);
    expect(zweiter.zeilen[0].art).toBe('gleich');
    const anders = importPlanen(bestand, [{ name: 'Beispiel-Begleitung', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-2' }] }], k);
    expect(anders.zeilen[0]).toMatchObject({ art: 'aendert' });
    expect(anders.zeilen[0].felder[0]).toMatchObject({ alt: expect.stringContaining('BSP-1'), neu: expect.stringContaining('BSP-2') });
    const lang = importPlanen({ leistungen: [] }, [{ name: 'Y', preise: [{ art: 'fest', betrag: 1, artikelnummer: 'X'.repeat(41) }] }], k);
    expect(lang.status).toBe(413);
    const { importAusTabelle } = await import('@/lib/crm/produkt-import');
    expect(importAusTabelle('Name;Preis-Art;Betrag;Artikelnummer\nBeispiel;monatlich;100;BSP-9').produkte[0].preise?.[0]).toMatchObject({ artikelnummer: 'BSP-9' });
  });
});

describe('2 · Rechnungsnummer-Format je Gesellschaft (Vorgabe wie heute, ein Kreis mit Storno)', () => {
  it('Vorgabe ohne Einstellung = {KURZ}-R-{JAHR}-{NR4}, Storno wie Rechnung', async () => {
    const { mitVorgaben } = await import('@/lib/crm/gesellschaften');
    const v = mitVorgaben({ id: 'kdv' });
    expect(v.rechnungsformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
    expect(v.stornoformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
    expect(mitVorgaben({ id: 'kdv', rechnungsformat: 'RE-{JJ}-{NR5}' }).stornoformat).toBe('RE-{JJ}-{NR5}');
    expect(mitVorgaben({ id: 'kdv', rechnungsformat: 'RE-{NR5}' }).rechnungsformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
  });
  it('Speichern: gültig → übernommen, ohne Jahr bzw. ohne laufende Nummer → Fehler (nichts still verworfen), leer → Vorgabe', async () => {
    const { gesellschaftAnwenden } = await import('@/lib/crm/gesellschaften');
    const a = gesellschaftAnwenden({ id: 'kdv' }, { rechnungsformat: 'RE-{JJ}-{NR5}', stornoformat: 'ST-{JAHR}-{NR4}' }, J, 'pa');
    expect(a.fehler).toEqual([]);
    expect(a.g).toMatchObject({ rechnungsformat: 'RE-{JJ}-{NR5}', stornoformat: 'ST-{JAHR}-{NR4}' });
    const b = gesellschaftAnwenden(a.g, { rechnungsformat: 'RE-{NR5}' }, J, 'pa');
    expect(b.fehler.map(f => f.feld)).toEqual(['rechnungsformat']);
    expect(gesellschaftAnwenden(a.g, { stornoformat: 'ST-{JAHR}' }, J, 'pa').fehler.map(f => f.feld)).toEqual(['stornoformat']);
    expect(gesellschaftAnwenden(a.g, { rechnungsformat: '' }, J, 'pa').g).not.toHaveProperty('rechnungsformat');
  });
  it('Nächste Nummer im eigenen Format — derselbe Zähler für Rechnung und Storno, lückenlos; ungültiges Format → Vorgabe', async () => {
    const { naechsteNummer } = await import('@/lib/finanzen/rechnung/regeln');
    const l = [{ firmaId: 'kdv', lauf: { jahr: 2026, nr: 4 }, nummer: 'RE-26-00004' }] as never;
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'RE-{JJ}-{NR5}')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'RE-26-00005' });
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'ST-{JAHR}-{NR4}')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'ST-2026-0005' });
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'kaputt')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'BW-R-2026-0005' });
  });
});

describe('3 · Einleitung und Begleit-Mail je Produkt im Angebot', () => {
  const e = { anrede: 'Sie' as const, vorname: 'Max', nachname: 'Muster', titel: 'Begleitung', nummer: 'BW-A-2026-0007', gueltigBis: '2026-11-30', absender: 'Beispiel Werkstatt GmbH', person: 'Erika Muster', firma: 'Beispielkunde GmbH', heute: '2026-10-25' };
  it('Einleitung des Hauptprodukts ersetzt die feste — ohne eigene Grußzeile steht der Gruß davor; Platzhalter gefüllt; Schluss bleibt', async () => {
    const { angebotVorlage } = await import('@/lib/crm/angebote');
    const fest = angebotVorlage(e);
    const ohneGruss = angebotVorlage(e, { einleitung: 'danke für das Gespräch mit {{firma.name}}. Gültig bis {{angebot.gueltigBis}}.' });
    expect(ohneGruss.einleitung).toBe('Guten Tag Max Muster,\n\ndanke für das Gespräch mit Beispielkunde GmbH. Gültig bis 30.11.2026.');
    expect(ohneGruss.schluss).toBe(fest.schluss);
    const mitGruss = angebotVorlage({ ...e, anrede: 'Du' }, { einleitung: '{{kontakt.gruss}},\n\nschön, dass es losgeht.' });
    expect(mitGruss.einleitung).toBe('Hallo Max,\n\nschön, dass es losgeht.');
    expect(angebotVorlage(e, null)).toEqual(fest);
    expect(angebotVorlage(e, { mail: { text: 'x' } })).toEqual(fest);
  });
  it('Begleit-Mail des Produkts ersetzt Betreff bzw. Text (Unterschrift über Platzhalter); nur Betreff → fester Text', async () => {
    const { mailVorlage } = await import('@/lib/crm/angebote');
    const m = mailVorlage(e, { mail: { betreff: 'Ihr Angebot {{angebot.nummer}}', text: '{{kontakt.gruss}},\n\nanbei {{angebot.titel}} für {{firma.name}}.\n\nViele Grüße\n{{person.name}}\n{{absender.name}}' } });
    expect(m).toEqual({ betreff: 'Ihr Angebot BW-A-2026-0007', text: 'Guten Tag Max Muster,\n\nanbei Begleitung für Beispielkunde GmbH.\n\nViele Grüße\nErika Muster\nBeispiel Werkstatt GmbH' });
    const nurBetreff = mailVorlage(e, { mail: { betreff: 'Kurz: {{angebot.titel}}' } });
    expect(nurBetreff.betreff).toBe('Kurz: Begleitung');
    expect(nurBetreff.text).toBe(mailVorlage(e).text);
  });
  it('Hauptprodukt entscheidet (laufend vor einmalig, kein reines Zusatzmodul); ohne eigene Texte null', async () => {
    const { produktTexteFuer } = await import('@/lib/crm/angebote');
    const a = { positionen: [{ leistungId: 'l-modul', basis: 'monat' }, { leistungId: 'l-beispiel', basis: 'monat' }] } as never;
    const katalog = [produkt({ angebot: { leistungstext: 'x', einleitung: 'Haupt-Einleitung' } }), produkt({ id: 'l-modul', rolle: 'zusatz', angebot: { leistungstext: 'y', einleitung: 'Modul-Einleitung' } })];
    expect(produktTexteFuer(a, katalog)?.einleitung).toBe('Haupt-Einleitung');
    expect(produktTexteFuer(a, [produkt()])).toBeNull();
  });
  it('Säubern behält die Begleit-Mail; Prüfung: unbekannter Platzhalter 400, zu lang 413; Karte prüft vorher', async () => {
    const { leistungAngebotSaeubern } = await import('@/lib/crm/angebote');
    const { produktPruefen } = await import('@/lib/crm/produkt-karte');
    const { textAenderung } = await import('@/lib/crm/produkt-katalog');
    expect(leistungAngebotSaeubern({ leistungstext: 'x', mail: { betreff: ' A\nB ', text: 'T' } })?.mail).toEqual({ betreff: 'A B', text: 'T' });
    expect(produktPruefen({ angebot: { leistungstext: 'x', mail: { text: 'Hallo {{kunde.vorname}}' } } }).map(f => f.status)).toEqual([400]);
    expect(produktPruefen({ angebot: { leistungstext: 'x', einleitung: 'Hallo {{kontakt.vorname}}' } })).toEqual([]);
    expect(produktPruefen({ angebot: { leistungstext: 'x', einleitung: 'Hallo {{x}}' } }).map(f => f.status)).toEqual([400]);
    expect(produktPruefen({ angebot: { leistungstext: 'x', mail: { text: 'a'.repeat(4001) } } }).map(f => f.status)).toEqual([413]);
    const l = produkt();
    const r = textAenderung(l, 'mailText', 'Text {{angebot.nummer}}');
    expect(r.ok && (r.felder.angebot as { mail?: unknown }).mail).toEqual({ text: 'Text {{angebot.nummer}}' });
    expect(textAenderung(l, 'mailText', '{{unbekannt}}').ok).toBe(false);
    const leer = textAenderung({ ...l, angebot: { leistungstext: 'x', mail: { text: 'T' } } }, 'mailText', '');
    expect(leer.ok && 'mail' in (leer.felder.angebot as object)).toBe(false);
  });
});

describe('4 · Willkommensmail je Produkt bzw. Paket (Fulfillment-Onboarding)', () => {
  const b = (id: string, tags: string[], text: string) => ({ id, art: 'mail' as const, titel: id, text, tags, gliederung: [], platzhalter: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: J, geaendertVon: 'pa' });
  const bausteine = [b('fb-instanz', ['willkommen', 'sie'], 'Betreff: Instanz\n\n{{anrede}}, Instanz.'), b('fb-paket', ['willkommen'], 'Betreff: Paket\n\n{{anrede}}, Paket.')] as never;
  const prozesse = [{ id: 'fp-1', knoten: [{ id: 'k5', bausteinId: 'fb-paket' }] }, { id: 'fp-2', knoten: [] }] as never;
  const mandat = { titel: 'Begleitung Beispielkunde', start: '2026-11-01' };
  it('Produkt (Platzhalter der Werkstatt gefüllt, die des Onboardings bleiben) → Paket → Instanz wie bisher', async () => {
    const { willkommenQuelle } = await import('@/lib/crm/produkt-willkommen');
    const mitProdukt = willkommenQuelle({ bausteine, prozesse, vorlageId: 'fp-1', produkt: { id: 'l-beispiel', name: 'Beispiel-Begleitung', willkommen: { betreff: 'Start: {{mandat.titel}}', text: '{{kontakt.gruss}},\n\nab {{mandat.start}} geht es los.\n\n{{kickoff_vorschlaege}}\n\n{{gruss}}' } }, mandat, anrede: 'Du', kontakt: { vorname: 'Max' }, heute: '2026-10-25' });
    expect(mitProdukt).toEqual({ id: 'produkt:l-beispiel', titel: 'Willkommensmail · Beispiel-Begleitung', quelle: 'produkt', text: 'Betreff: Start: Begleitung Beispielkunde\n\nHallo Max,\n\nab 01.11.2026 geht es los.\n\n{{kickoff_vorschlaege}}\n\n{{gruss}}' });
    // Die Mail entsteht danach wie bisher über `willkommenMail` (Onboarding füllt seine Platzhalter).
    const { willkommenMail } = await import('@/lib/fulfillment/prozesse/onboarding');
    const mail = willkommenMail(mitProdukt!.text, { anrede: 'Du', vorname: 'Max', kickoffVorschlaege: ['Di, 03.11., 10:00–11:30 Uhr'], absender: 'Erika' });
    expect(mail.betreff).toBe('Start: Begleitung Beispielkunde');
    expect(mail.text).toContain('– Di, 03.11., 10:00–11:30 Uhr');
    expect(mail.text).toContain('Viele Grüße\nErika');
    const paket = willkommenQuelle({ bausteine, prozesse, vorlageId: 'fp-1', produkt: { id: 'l-x', name: 'X' }, mandat, anrede: 'Sie', heute: '2026-10-25' });
    expect(paket).toMatchObject({ id: 'fb-paket', quelle: 'paket' });
    const { willkommenVorlage } = await import('@/lib/fulfillment/prozesse/onboarding');
    const instanz = willkommenQuelle({ bausteine, prozesse, vorlageId: 'fp-2', produkt: null, mandat, anrede: 'Sie', heute: '2026-10-25' });
    const alt = willkommenVorlage(bausteine, 'Sie')!;
    expect(instanz).toEqual({ id: alt.id, titel: alt.titel, text: alt.text, quelle: 'instanz' });
  });
  it('Prüfung und Karte: Platzhalter der Werkstatt und des Onboardings erlaubt, fremde 400, zu lang 413; leeren entfernt das Feld', async () => {
    const { produktPruefen } = await import('@/lib/crm/produkt-karte');
    const { textAenderung, texteVon } = await import('@/lib/crm/produkt-katalog');
    expect(produktPruefen({ willkommen: { text: '{{kontakt.gruss}} {{playbook_link}} {{mandat.titel}}' } })).toEqual([]);
    expect(produktPruefen({ willkommen: { text: '{{angebot.nummer}}' } }).map(f => f.status)).toEqual([400]);
    expect(produktPruefen({ willkommen: { betreff: 'x'.repeat(201) } }).map(f => f.status)).toEqual([413]);
    const l = produkt();
    const r = textAenderung(l, 'willkommenText', 'Hallo {{kontakt.vorname}}');
    expect(r.ok && r.felder).toEqual({ willkommen: { text: 'Hallo {{kontakt.vorname}}' } });
    expect(texteVon({ ...l, willkommen: { betreff: 'B' } }).willkommenBetreff).toBe('B');
    expect(textAenderung({ ...l, willkommen: { text: 'T' } }, 'willkommenText', '')).toEqual({ ok: true, felder: { willkommen: null } });
  });
});

describe('5 · Import erweitert: Unterlagen, Prozess der Werkstatt, Begleit-Mail, Willkommensmail', () => {
  const PZ = 'pz-11111111-2222-4333-8444-555555555555', PZ2 = 'pz-11111111-2222-4333-8444-666666666666';
  const k = () => ({ neueId: () => 'l-neu-5', prozesse: [{ id: PZ, titel: 'Beispiel-Lieferung' }, { id: PZ2, titel: 'Doppelt' }, { id: 'pz-11111111-2222-4333-8444-777777777777', titel: 'Doppelt' }], vorlagen: [{ id: 'fp-paket', titel: 'Paket A' }], zuordnung: {} as Record<string, { vorlageId: string }> });
  const voll = {
    name: 'Beispiel-Begleitung', leistungstext: 'x', gesellschaft: 'ug',
    angebot: { einleitung: '{{kontakt.gruss}},\n\nschön.', mail: { betreff: 'Angebot {{angebot.nummer}}', text: '{{kontakt.gruss}},\n\nanbei.' } },
    willkommen: { betreff: 'Willkommen', text: '{{kontakt.gruss}},\n\nlos geht es am {{mandat.start}}.' },
    unterlagen: [{ titel: 'Produktblatt', art: 'Produktblatt', url: 'https://example.invalid/blatt.pdf' }, { titel: 'Notiz', url: '/os/wissen?n=Beispiel' }],
    prozess: 'Beispiel-Lieferung',
  };
  it('neu: alle Felder in der Vorschau (mit Titel des Prozesses), im Eintrag die Kennung; zweiter Lauf „gleich“', () => {
    const p = importPlanen({ leistungen: [] }, [voll], k());
    expect(p.status, JSON.stringify(p.zeilen[0].fehler)).toBe(200);
    expect(p.zeilen[0].art).toBe('neu');
    const felder = Object.fromEntries(p.zeilen[0].felder.map(f => [f.feld, f.neu]));
    expect(felder.prozess).toBe('Beispiel-Lieferung');
    expect(felder['angebot.mail']).toContain('Angebot {{angebot.nummer}}');
    expect(felder.willkommen).toContain('Willkommen');
    expect(felder.unterlagen).toContain('Produktblatt');
    const e = (p.ops[0] as { eintrag: Record<string, unknown> }).eintrag;
    expect(e).toMatchObject({ prozessId: PZ, willkommen: voll.willkommen, unterlagen: [{ id: 'u0', titel: 'Produktblatt', art: 'onepager', url: 'https://example.invalid/blatt.pdf' }, { id: 'u1', titel: 'Notiz', art: 'sonstiges', url: '/os/wissen?n=Beispiel' }] });
    expect((e.angebot as { mail: unknown }).mail).toEqual(voll.angebot.mail);
    const bestand = { leistungen: [produkt({ id: 'l-neu-5', name: 'Beispiel-Begleitung', status: 'aktiv', ...(e as object) } as Partial<Leistung>)] };
    const zweiter = importPlanen(bestand, [voll], k());
    expect(zweiter.zeilen[0].art, JSON.stringify(zweiter.zeilen[0].felder)).toBe('gleich');
    expect(zweiter.zeilen[0].prozess?.stand).toBe('gleich');
  });
  it('Fehler und Hinweise: lokale Datei 400, fremder Platzhalter 400, zu lang 413, Prozess fehlt/mehrdeutig nur Hinweis, Paket UND Prozess zugleich 400', () => {
    const f = (x: Record<string, unknown>) => importPlanen({ leistungen: [] }, [{ name: 'Y', ...x }], k());
    expect(f({ unterlagen: [{ titel: 'Lokal', url: 'Vorlagen/x.md' }] }).status).toBe(400);
    expect(f({ willkommen: { text: '{{angebot.nummer}}' } }).status).toBe(400);
    expect(f({ angebot: { mail: { text: 'a'.repeat(4001) } } }).status).toBe(413);
    expect(f({ angebot: { einleitung: 'Hallo [Name] {{unbekannt}}' } }).status).toBe(400);
    expect(f({ unterlagen: [{ titel: 'x'.repeat(121), url: 'https://example.invalid' }] }).status).toBe(413);
    const fehlt = f({ prozess: 'Gibt es nicht' });
    expect(fehlt.status).toBe(200);
    expect(fehlt.zeilen[0].prozess?.stand).toBe('fehlt');
    expect(f({ prozess: 'Doppelt' }).zeilen[0].prozess?.stand).toBe('mehrdeutig');
    expect(f({ prozess: PZ }).zeilen[0].prozess).toMatchObject({ stand: 'neu', name: 'Beispiel-Lieferung' });
    expect(f({ prozess: 'Beispiel-Lieferung', ablauf: 'Paket A' }).status).toBe(400);
  });
  it('genau EIN Ablauf: ein Prozess löst die Paket-Zuordnung, ein Paket den Prozess (wie die Karte)', () => {
    const kx = k(); kx.zuordnung = { 'l-a1': { vorlageId: 'fp-paket' } };
    const mitPaket = { leistungen: [produkt({ id: 'l-a1', name: 'A1' })] };
    const p = importPlanen(mitPaket, [{ name: 'A1', prozess: 'Beispiel-Lieferung' }], kx);
    expect(p.zuordnungen).toEqual([{ leistungId: 'l-a1', vorlageId: null }]);
    expect(p.ops[0]).toMatchObject({ op: 'teil', felder: { prozessId: PZ } });
    const mitProzess = { leistungen: [produkt({ id: 'l-a2', name: 'A2', prozessId: PZ })] };
    const q = importPlanen(mitProzess, [{ name: 'A2', ablauf: 'Paket A' }], k());
    expect(q.zuordnungen).toEqual([{ leistungId: 'l-a2', vorlageId: 'fp-paket' }]);
    expect(q.ops[0]).toMatchObject({ op: 'teil', felder: { prozessId: null } });
    const loesen = importPlanen(mitProzess, [{ name: 'A2', prozess: null }], k());
    expect(loesen.ops[0]).toMatchObject({ felder: { prozessId: null } });
  });
});

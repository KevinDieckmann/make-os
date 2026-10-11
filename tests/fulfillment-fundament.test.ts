// ─── Fulfillment · Fundament (C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 11 „Wächter C0“) ──────────────────────────────────────────────
// Säuberer (Unsinn fällt weg, Grenzen, leere Bestände), reine Regeln (Ebenen, Kreis, Fortschritt, aktueller Knoten, Onboarding-Kandidaten,
// Unterschrift, Mandatsende …), Muster neutral (keine Eurobeträge, keine Namen), Orte lösen in Seiten auf, Adressen, Register und die Sicht:
// `?space=privat` auf /api/fulfillment → 403, fremder Haushalt/Testkunde → 403, Dienstweg schreibt nie, Personenteil nie für „nur Business“.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WURZEL = path.resolve(__dirname, '..');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-c0-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-c0';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

import { vorlagenAus, faelleAus, kundeAus, dossiersAus, personenAus, leerVorlagen, leerFaelle, leerKunde, leerDossiers, leerPersonen, EINSTELLUNGEN_VORGABE } from '@/lib/fulfillment/lesen';
import { grenzenPruefen, textZuLang, GRENZEN, KENNUNG } from '@/lib/fulfillment/grenzen';
import {
  ebeneVon, kreisBei, teilbaum, kinderVon, KREIS, fallFortschritt, aktuellerKnoten, wartetAufEuch, wertKontoZeilen, pulsStufe, mandatsEnde,
  unterschriftAm, onboardingKandidaten, kundenJeKnoten, speichernameTilgen, markeOnboardingAus,
} from '@/lib/fulfillment/regeln';
import { MUSTER_VORLAGEN, MUSTER_LANDKARTE, MUSTER_ONBOARDING, MUSTER_RITUALE, MUSTER_PLAYBOOK, MUSTER_FREIGABEN } from '@/lib/fulfillment/muster';
import { ORTE, ORT_IDS, ortHref } from '@/lib/fulfillment/orte';
import { fulfillmentLink, fallLink, fulfillmentAusAdresse, FULFILLMENT_PFAD } from '@/lib/fulfillment/adresse';
import { WEG } from '@/lib/wege';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';

// ── Säuberer ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Säuberer: Unsinn fällt weg, nichts wird gekürzt, leere Bestände', () => {
  it('fehlender oder kaputter Bestand ergibt die leere Datei', () => {
    for (const roh of [null, undefined, 'x', 7, []]) {
      expect(vorlagenAus(roh)).toEqual(leerVorlagen());
      expect(faelleAus(roh)).toEqual(leerFaelle());
      expect(kundeAus(roh)).toEqual(leerKunde());
      expect(dossiersAus(roh)).toEqual(leerDossiers());
      expect(personenAus(roh)).toEqual(leerPersonen());
    }
    expect(leerVorlagen().einstellungen).toEqual(EINSTELLUNGEN_VORGABE);
    expect(leerVorlagen().einstellungen.kundenLink.an).toBe(false);
  });

  it('Vorlagen: Einträge ohne Pflichtfelder fallen weg, ungültige Felder fehlen ganz, gültige bleiben unverändert', () => {
    const d = vorlagenAus({
      version: 1,
      prozesse: [
        { id: 'fp-a', art: 'paket', titel: 'Paket A', knoten: [
          { id: 'fk-1', titel: 'Wurzel', rang: 1 },
          { id: 'fk-2', elternId: 'fk-1', titel: 'Phase', rang: 1, zone: 'quatsch', kreislauf: ['fulfillment', 'erfunden'], kundeSichtbar: 'ja' },
          { id: 'fk-3', rang: 2 },                     // ohne Titel → weg
          'unsinn',
        ], uebergaenge: [{ von: 'fk-1', nach: 'fk-2', art: 'weiter' }, { von: 'fk-1', art: 'weiter' }], freigaben: [{ id: 'F0', titel: 'Rahmen', wer: 'nie' }], rollen: [], fassung: 2, geaendert: 'x', geaendertVon: 'p' },
        { id: 'fp-b', art: 'erfunden', titel: 'Kaputt', knoten: [] },
        { art: 'paket', titel: 'ohne Kennung' },
      ],
      bausteine: [{ id: 'fb-1', art: 'skript', titel: 'Skript', gliederung: ['a', 3], platzhalter: [], tags: ['x'], text: '  Text mit Leerzeichen  ', wer: 'kunde', kundeSichtbar: true, fassung: 1, geaendert: '', geaendertVon: '' }, { id: 'fb-2', art: 'unbekannt', titel: 'x' }],
      zuordnung: { 'l-1': { vorlageId: 'fp-a' }, 'l-2': {} },
      einstellungen: { pulsSchwelle: 99, kundenLink: { an: true, am: '2026-10-10' } },
      marken: { 'onboarding-aus:m-1': '2026-10-10', kaputt: 3 },
    });
    expect(d.prozesse.map(p => p.id)).toEqual(['fp-a']);
    const p = d.prozesse[0];
    expect(p.knoten.map(k => k.id)).toEqual(['fk-1', 'fk-2']);
    expect(p.knoten[1]).toEqual({ id: 'fk-2', elternId: 'fk-1', titel: 'Phase', rang: 1, kreislauf: ['fulfillment'] });
    expect('zone' in p.knoten[1]).toBe(false);
    expect(p.uebergaenge).toEqual([{ von: 'fk-1', nach: 'fk-2', art: 'weiter' }]);
    expect(p.freigaben).toEqual([{ id: 'F0', titel: 'Rahmen', wer: 'beide' }]);
    expect(d.bausteine.map(b => b.id)).toEqual(['fb-1']);
    expect(d.bausteine[0].text).toBe('  Text mit Leerzeichen  '); // nie getrimmt
    expect(d.bausteine[0].gliederung).toEqual(['a']);
    expect(d.zuordnung).toEqual({ 'l-1': { vorlageId: 'fp-a' } });
    expect(d.einstellungen.pulsSchwelle).toBe(EINSTELLUNGEN_VORGABE.pulsSchwelle);
    expect(d.einstellungen.kundenLink).toEqual({ an: true, am: '2026-10-10' });
    expect(d.marken).toEqual({ 'onboarding-aus:m-1': '2026-10-10' });
  });

  it('Listen werden beim Lesen nie gekürzt — die Grenze meldet erst der Schreibweg (413)', () => {
    const knoten = Array.from({ length: GRENZEN.knotenJeVorlage + 5 }, (_, i) => ({ id: `fk-${i}`, titel: `K${i}`, rang: i }));
    const d = vorlagenAus({ prozesse: [{ id: 'fp-gross', art: 'paket', titel: 'Groß', knoten }] });
    expect(d.prozesse[0].knoten).toHaveLength(GRENZEN.knotenJeVorlage + 5);
    expect(grenzenPruefen('vorlagen', d)).toMatch(/höchstens 400/);
    expect(grenzenPruefen('vorlagen', leerVorlagen())).toBeNull();
    const viele = { ...leerKunde(), unterlagen: Array.from({ length: GRENZEN.unterlagen + 1 }, () => ({})) } as unknown as ReturnType<typeof leerKunde>;
    expect(grenzenPruefen('kunde', viele)).toMatch(/Unterlagen/);
    expect(textZuLang('titel', 'x'.repeat(121))).toMatch(/höchstens 120/);
    expect(textZuLang('titel', 'kurz')).toBeNull();
  });

  it('Fälle, Kunde, Dossiers, Personen: Schlüssel muss zur Kennung passen, Hashes und Werte geprüft', () => {
    const f = faelleAus({ faelle: {
      'm-1': { mandatId: 'm-1', vorlageId: 'fp-a', gestartetAm: '2026-10-01', status: 'onboarding', knoten: [{ id: 'fk-1', titel: 'W', rang: 1, status: 'offen' }, { id: 'fk-2', titel: 'X', rang: 1, status: 'erfunden' }], stakeholder: [{ id: 'fs-1', kontaktId: 'c-1', rolle: 'entscheider', einfluss: 3 }, { id: 'fs-2', kontaktId: 'c-2', rolle: 'entscheider', einfluss: 9 }] },
      'm-2': { mandatId: 'm-anders', vorlageId: 'fp-a', gestartetAm: '2026-10-01', status: 'laeuft' },
    } });
    expect(Object.keys(f.faelle)).toEqual(['m-1']);
    expect(f.faelle['m-1'].knoten.map(k => k.id)).toEqual(['fk-1']);
    expect(f.faelle['m-1'].stakeholder.map(s => s.id)).toEqual(['fs-1']);
    expect(f.faelle['m-1'].onboarding).toEqual({});
    const hash = 'a'.repeat(64);
    const k = kundeAus({ links: [
      { id: 'kl-0123456789abcdef01234567', mandatId: 'm-1', tokenHash: hash, erstelltAm: 'x', ablaufAm: 'y', status: 'aktiv', rechte: { formular: true } },
      { id: 'kl-kurz', mandatId: 'm-1', tokenHash: hash, erstelltAm: 'x', ablaufAm: 'y', status: 'aktiv' },
      { id: 'kl-0123456789abcdef01234567', mandatId: 'm-1', tokenHash: 'klartext-token', erstelltAm: 'x', ablaufAm: 'y', status: 'aktiv' },
    ], puls: [{ id: 'pu-1', mandatId: 'm-1', am: 'x', wert: 11, quelle: 'link' }, { id: 'pu-2', mandatId: 'm-1', am: 'x', wert: 8, quelle: 'link' }] });
    expect(k.links).toHaveLength(1);
    expect(k.links[0].rechte).toEqual({ formular: true, upload: false, puls: false });
    expect(k.puls.map(p => p.id)).toEqual(['pu-2']);
    const d = dossiersAus({ dossiers: { 'm-1': { mandatId: 'm-1', eingaben: { firma: 'Beispiel GmbH', domains: ['beispiel.example'], urls: ['https://beispiel.example', 'javascript:x'] }, abschnitte: { markt: { aussagen: [], status: 'entwurf' }, erfunden: {} }, quellen: [], laeufe: [{ id: 'al-1', agent: 'a99', status: 'bereit' }] } } });
    expect(d.dossiers['m-1'].eingaben.urls).toEqual(['https://beispiel.example']);
    expect(Object.keys(d.dossiers['m-1'].abschnitte)).toEqual(['markt']);
    expect(d.dossiers['m-1'].laeufe).toEqual([]);
    expect(personenAus({ karten: [{ id: 'pp-1', mandatId: 'm-1', funktion: 'Geschäftsführung', name: 'Erika Beispiel', erfasstAm: 'x', identitaet: 'hoch', status: 'entwurf', art14: { faelligAm: '2026-11-10' } }, { id: 'pp-2' }] }).karten).toHaveLength(1);
  });
});

// ── Regeln ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const fk = (id: string, eltern: string | undefined, rang: number, status: FallKnoten['status'] = 'offen', extra: Partial<FallKnoten> = {}): FallKnoten =>
  ({ id, ...(eltern ? { elternId: eltern } : {}), titel: id, rang, status, ...extra });
const fall = (knoten: FallKnoten[], extra: Partial<Fall> = {}): Fall => ({
  mandatId: 'm-1', vorlageId: 'fp-a', vorlageFassung: 1, gestartetAm: '2026-10-01', gestartetVon: 'p', status: 'laeuft', knoten, freigaben: {}, onboarding: {},
  stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: '', geaendertVon: '', ...extra,
});

describe('Regeln: Ebenen, Kreis, Teilbaum', () => {
  const l = [fk('w', undefined, 1), fk('p2', 'w', 2), fk('p1', 'w', 1), fk('t', 'p1', 1), fk('s', 't', 1), fk('b', 's', 1)];
  it('Ebene aus der Kette (Wurzel = 1), Kinder nach Rang, Teilbaum in Lese-Reihenfolge', () => {
    expect(['w', 'p1', 't', 's', 'b'].map(id => ebeneVon(l.find(k => k.id === id)!, l))).toEqual([1, 2, 3, 4, 5]);
    expect(kinderVon('w', l).map(k => k.id)).toEqual(['p1', 'p2']);
    expect(kinderVon(undefined, l).map(k => k.id)).toEqual(['w']);
    expect(teilbaum('w', l)).toEqual(['w', 'p1', 't', 's', 'b', 'p2']);
    expect(teilbaum('fehlt', l)).toEqual([]);
  });
  it('ein Kreis hat keine Ebene und wird gefunden', () => {
    const kreis = [fk('a', 'c', 1), fk('b', 'a', 1), fk('c', 'b', 1), fk('x', undefined, 1)];
    expect(ebeneVon(kreis[0], kreis)).toBe(KREIS);
    expect(kreisBei(kreis)).toBe('a');
    expect(kreisBei(l)).toBeNull();
    expect(teilbaum('a', kreis)).toEqual(['a', 'b', 'c']); // kreisfest
  });
});

describe('Regeln: Fortschritt, aktueller Knoten, wartet auf euch', () => {
  const knoten = [
    fk('w', undefined, 1),
    fk('ph1', 'w', 1), fk('t1', 'ph1', 1), fk('s1', 't1', 1, 'erledigt'), fk('s2', 't1', 2, 'entfaellt'),
    fk('ph2', 'w', 2), fk('t2', 'ph2', 1), fk('s3', 't2', 1, 'erledigt'), fk('s4', 't2', 2, 'wartet_kunde', { seit: '2026-10-01', freigabe: 'F3' }), fk('b4', 's4', 1, 'offen', { bausteinId: 'fb-1' }),
  ];
  it('Fortschritt = erledigte Knoten auf Ebene 4/5, „entfällt“ zählt nicht', () => {
    // Ebene 4/5 ohne „entfällt“: s1 (erledigt), s3 (erledigt), s4, b4 → 2 von 4
    expect(fallFortschritt(fall(knoten))).toBe(50);
    expect(fallFortschritt(fall([]))).toBe(0);
    // ohne Einzelschritte zählen die Blätter ab Ebene 2 (Fall aus einem Muster bis Ebene 3)
    expect(fallFortschritt(fall([fk('w', undefined, 1), fk('a', 'w', 1, 'erledigt'), fk('b', 'w', 2)]))).toBe(50);
  });
  it('aktueller Knoten: erste nicht abgeschlossene Phase, darin der erste offene Einzelschritt', () => {
    const a = aktuellerKnoten(fall(knoten));
    expect(a.phase?.id).toBe('ph2');
    expect(a.schritt?.id).toBe('s4');
    const fertig = aktuellerKnoten(fall(knoten.map(k => ({ ...k, status: 'erledigt' as const }))));
    expect(fertig).toEqual({ phase: null, schritt: null });
  });
  it('wartet auf euch: Knoten beim Kunden und offene Kunden-Entscheidungen, ältester zuerst', () => {
    const f = fall(knoten, { entscheidungen: [
      { id: 'fe-1', am: '2026-09-20', titel: 'Budget freigeben', status: 'offen', wer: 'kunde', geteilt: true, von: 'p' },
      { id: 'fe-2', am: '2026-09-01', titel: 'Intern', status: 'offen', wer: 'intern', geteilt: false, von: 'p' },
    ] });
    const w = wartetAufEuch(f, '2026-10-10');
    expect(w.map(x => [x.art, x.id, x.tage])).toEqual([['entscheidung', 'fe-1', 20], ['freigabe', 's4', 9]]);
    const mitFreigabe = wartetAufEuch({ ...f, freigaben: { F3: { am: '2026-10-05', von: 'p' } } }, '2026-10-10');
    expect(mitFreigabe.find(x => x.id === 's4')?.art).toBe('knoten');
  });
});

describe('Regeln: Wert-Konto, Puls, Mandatsende', () => {
  it('vorher → jetzt → Ziel aus Fall und Mandat; ohne Fall die Werte des Mandats', () => {
    const mandat = { ziele: [{ id: 'z1', text: 'Abschlussquote', ziel: '30 %', ist: '18 %' }, { id: 'z2', text: 'Neue Termine' }] };
    const f = fall([], { wertKonto: { z1: { ausgangZahl: 15, zielZahl: 30, einheit: '%', zielBis: '2027-03-31', festgelegtAm: '2026-10-05', messungen: [{ am: '2026-10-08', wert: 21, quelle: 'hand' }, { am: '2026-10-01', wert: 17, quelle: 'hand' }] } } });
    expect(wertKontoZeilen(f, mandat)).toEqual([
      { zielId: 'z1', name: 'Abschlussquote', vorher: '15 %', jetzt: '21 %', ziel: '30 %', bis: '2027-03-31', festgelegt: true },
      { zielId: 'z2', name: 'Neue Termine', vorher: '—', jetzt: '—', ziel: '—', festgelegt: false },
    ]);
    expect(wertKontoZeilen(null, mandat)[0]).toMatchObject({ vorher: '—', jetzt: '18 %', ziel: '30 %', festgelegt: false });
  });
  it('Puls-Stufe mit Schwelle (Vorgabe 6)', () => {
    expect([0, 6, 7, 8, 9, 10].map(w => pulsStufe(w))).toEqual(['kritisch', 'kritisch', 'neutral', 'neutral', 'gut', 'gut']);
    expect(pulsStufe(7, 7)).toBe('kritisch');
  });
  it('Mandatsende: beendet → Ende (sonst letzte Änderung), Papierkorb → Löschtag, laufend → null', () => {
    expect(mandatsEnde({ status: 'beendet', ende: '2026-09-30', geaendert: '2026-10-05T10:00:00.000Z' })).toBe('2026-09-30');
    expect(mandatsEnde({ status: 'beendet', geaendert: '2026-10-05T10:00:00.000Z' })).toBe('2026-10-05');
    expect(mandatsEnde({ status: 'aktiv', geloeschtAm: '2026-10-02T08:00:00.000Z', geaendert: '' })).toBe('2026-10-02');
    expect(mandatsEnde({ status: 'aktiv', ende: '2026-12-31', geaendert: '' })).toBeNull();
  });
});

// Fixture für Unterschrift und Onboarding-Kandidaten (erfunden).
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: `Kunde ${id}`, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: false, verlaengerung: 'offen',
  honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: '2026-10-01', ...x,
});
const crm = (mandate: Mandat[], angebote: unknown[] = [], chancen: unknown[] = []) => ({ mandate, angebote, chancen }) as unknown as Pick<CrmBestand, 'mandate' | 'angebote' | 'chancen'>;

describe('Regeln: Unterschrift und Onboarding-Kandidaten (3.1)', () => {
  it('Unterschrift: Angebot angenommen → Deal gewonnen → Start → Fall angelegt', () => {
    const m = mandat('m-1', { chanceId: 'd-1', start: '2026-09-15' });
    const angebote = [{ id: 'a-1', mandatId: 'm-1', status: 'angenommen', angenommenAm: '2026-09-10T09:00:00.000Z' }];
    const chancen = [{ id: 'd-1', stufe: 'gewonnen', historie: [{ stufe: 'angebot', am: '2026-09-01T00:00:00.000Z', von: 'p' }, { stufe: 'gewonnen', am: '2026-09-12T00:00:00.000Z', von: 'p' }] }];
    expect(unterschriftAm(m, crm([m], angebote, chancen))).toEqual({ am: '2026-09-10T09:00:00.000Z', quelle: 'angebot' });
    expect(unterschriftAm(m, crm([m], [], chancen))).toEqual({ am: '2026-09-12T00:00:00.000Z', quelle: 'deal' });
    expect(unterschriftAm(m, crm([m]))).toEqual({ am: '2026-09-15', quelle: 'start' });
    expect(unterschriftAm(mandat('m-2'), crm([]), '2026-10-01T10:00:00.000Z')).toEqual({ am: '2026-10-01T10:00:00.000Z', quelle: 'fall' });
    expect(unterschriftAm(mandat('m-2'), crm([]))).toBeNull();
  });
  it('Kandidaten: aktiv/Angebot, Business, nicht gelöscht, ohne Fall, nicht ausgeblendet — und unterschrieben/angenommen/gewonnen', () => {
    const mandate = [
      mandat('m-vertrag', { vertragUnterschrieben: true, start: '2026-09-20' }),
      mandat('m-angebot', { status: 'angebot' }),
      mandat('m-deal', { chanceId: 'd-1' }),
      mandat('m-ohne'),                                                    // nichts unterschrieben
      mandat('m-privat', { vertragUnterschrieben: true, gesellschaft: 'kdc' }), // Selbstständigkeit gehört zu Privat
      mandat('m-beendet', { vertragUnterschrieben: true, status: 'beendet' }),
      mandat('m-papierkorb', { vertragUnterschrieben: true, geloeschtAm: '2026-10-01T00:00:00.000Z' }),
      mandat('m-fall', { vertragUnterschrieben: true }),
      mandat('m-aus', { vertragUnterschrieben: true }),
    ];
    const angebote = [{ id: 'a-1', mandatId: 'm-angebot', status: 'angenommen', angenommenAm: '2026-09-01T00:00:00.000Z' }];
    const chancen = [{ id: 'd-1', stufe: 'gewonnen', historie: [{ stufe: 'gewonnen', am: '2026-09-25T00:00:00.000Z', von: 'p' }] }];
    const k = onboardingKandidaten(crm(mandate, angebote, chancen), { 'm-fall': {} }, { [markeOnboardingAus('m-aus')]: '2026-10-01' }, '2026-10-10');
    expect(k.map(x => [x.mandatId, x.grund])).toEqual([['m-angebot', 'angebot'], ['m-vertrag', 'vertrag'], ['m-deal', 'deal']]);
    expect(k[1].unterschrift).toEqual({ am: '2026-09-20', quelle: 'start' });
  });
});

describe('Regeln: welcher Kunde steht wo, Speichername tilgen', () => {
  it('kundenJeKnoten: aktueller Knoten samt Vorfahren; Verweise zählen die Fälle der Paket-Vorlage', () => {
    const vorlage = { id: 'fp-a', knoten: [fk('w', undefined, 1), fk('ph1', 'w', 1), fk('s1', 'ph1', 1), fk('ph2', 'w', 2)] };
    const landkarte = { id: 'fp-lk', knoten: [fk('lw', undefined, 1), fk('etage5', 'lw', 1), { ...fk('verweis', 'etage5', 1), verweis: 'fp-a' } as FallKnoten] };
    const f1 = fall(vorlage.knoten.map(k => ({ ...k })), { mandatId: 'm-1' });
    const f2 = fall(vorlage.knoten.map(k => ({ ...k, status: 'erledigt' as const })), { mandatId: 'm-2', status: 'abgeschlossen' });
    // aktueller Knoten von m-1 ist der Teilprozess s1 (keine Einzelschritte) → s1, ph1, w
    expect(kundenJeKnoten(vorlage, [f1, f2])).toEqual({ s1: ['m-1'], ph1: ['m-1'], w: ['m-1'] });
    expect(kundenJeKnoten(landkarte, [f1, f2])).toEqual({ verweis: ['m-1'], etage5: ['m-1'], lw: ['m-1'] });
  });
  it('speichernameTilgen: nur Personen-Felder mit genau diesem Namen, sonst unverändert (derselbe Wert)', () => {
    const d = { geaendertVon: 'pia', faelle: { m: { gestartetVon: 'pia', titel: 'pia', entscheidungen: [{ von: 'olaf' }, { von: 'pia' }] } } };
    const r = speichernameTilgen(d, 'pia');
    expect(r.n).toBe(3);
    expect(r.wert).toEqual({ geaendertVon: '[gelöscht]', faelle: { m: { gestartetVon: '[gelöscht]', titel: 'pia', entscheidungen: [{ von: 'olaf' }, { von: '[gelöscht]' }] } } });
    const ohne = speichernameTilgen(d, 'niemand');
    expect(ohne.n).toBe(0);
    expect(ohne.wert).toBe(d);
  });
});

// ── Muster neutral, Orte, Adressen ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Namen früherer Firmen/Prozesse und Personen — NUR hier (Konzept 12.6), zur Laufzeit zusammengesetzt, damit diese Datei sich nicht selbst meldet. */
const VERBOTEN = new RegExp(['Infin' + 'ity', 'Circula' + 'tree', 'Sales' + 'Manager', 'Wired' + '[- ]?Heads', 'KEMA' + 'RIS', 'POIN' + 'CAP', 'Ke' + 'vin', 'Ma' + 'lin\\b', 'Dieck' + 'mann', 'KD ' + 'Ventures', 'Make Inno' + 'vation GmbH'].join('|'), 'i');
const EURO = /\d[\d.,]*\s?€/;
function dateien(dir: string): string[] {
  const p = path.join(WURZEL, dir);
  if (!existsSync(p)) return [];
  return readdirSync(p).flatMap(n => { const rel = `${dir}/${n}`; return statSync(path.join(WURZEL, rel)).isDirectory() ? dateien(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : []; });
}

describe('Muster und Code neutral (keine Namen, keine Preise)', () => {
  const quellen = [...dateien('lib/fulfillment'), ...dateien('components/os/fulfillment'), ...readdirSync(path.join(WURZEL, 'lib/erklaerungen')).filter(n => n.startsWith('fulfillment-')).map(n => `lib/erklaerungen/${n}`)];
  it('lib/fulfillment/**, components/os/fulfillment/**, lib/erklaerungen/fulfillment-*: keine Eurobeträge, keine Namen', () => {
    expect(quellen.length).toBeGreaterThan(15);
    const funde = quellen.flatMap(f => readFileSync(path.join(WURZEL, f), 'utf8').split('\n').map((z, i) => ({ f, i, z })))
      .filter(x => EURO.test(x.z) || VERBOTEN.test(x.z)).map(x => `${x.f}:${x.i + 1}: ${x.z.trim().slice(0, 100)}`);
    expect(funde).toEqual([]);
  });
  it('Muster: nur Muster-Kennungen, je Vorlage genau eine Wurzel, Pakete bis Ebene 3, Rang lückenlos je Eltern', () => {
    const json = JSON.stringify([MUSTER_VORLAGEN, MUSTER_ONBOARDING, MUSTER_RITUALE, MUSTER_PLAYBOOK]);
    expect(EURO.test(json) || VERBOTEN.test(json)).toBe(false);
    for (const v of MUSTER_VORLAGEN) {
      expect(v.id).toMatch(/^fp-muster-/);
      expect(v.knoten.every(k => k.id.startsWith('fk-muster-'))).toBe(true);
      expect(kinderVon(undefined, v.knoten)).toHaveLength(1);
      expect(kreisBei(v.knoten)).toBeNull();
      const tiefe = Math.max(...v.knoten.map(k => ebeneVon(k, v.knoten)));
      expect(tiefe, v.id).toBeLessThanOrEqual(3);
      for (const k of v.knoten) {
        const geschwister = kinderVon(k.elternId && v.knoten.some(x => x.id === k.elternId) ? k.elternId : undefined, v.knoten).map(x => x.rang);
        expect(geschwister).toEqual(geschwister.map((_, i) => i + 1));
      }
      for (const k of v.knoten) if (k.freigabe) expect(v.freigaben.map(f => f.id)).toContain(k.freigabe);
    }
    expect(MUSTER_FREIGABEN.map(f => f.id)).toEqual(['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);
    expect(MUSTER_ONBOARDING).toHaveLength(8);
    expect(MUSTER_ONBOARDING.filter(s => !s.zaehltFuerFertig).map(s => s.schluessel)).toEqual(['playbook']);
    expect(MUSTER_PLAYBOOK.fragen).toHaveLength(9);
    expect(MUSTER_RITUALE.map(r => [r.rhythmus, r.dauerMin])).toEqual([['einmal', 90], ['woche', 15], ['monat', 60], ['quartal', 120]]);
    // Zonen der Landkarte: Dach 4, Etagen 6, Fundament 5 — Etage 5 verweist auf die drei Pakete
    const zonen = MUSTER_LANDKARTE.knoten.filter(k => k.zone).map(k => k.zone);
    expect([zonen.filter(z => z === 'dach').length, zonen.filter(z => z === 'etage').length, zonen.filter(z => z === 'fundament').length]).toEqual([4, 6, 5]);
    expect(MUSTER_LANDKARTE.knoten.filter(k => k.verweis).map(k => k.verweis)).toEqual(['fp-muster-p1', 'fp-muster-p2', 'fp-muster-p3']);
  });
  it('jeder Ort der Landkarte ist eine bekannte Kennung, und jede Kennung löst in eine Seite unter app/os auf', () => {
    for (const k of MUSTER_LANDKARTE.knoten) if (k.ort) expect(ORT_IDS, k.ort).toContain(k.ort);
    // Seiten unter app/os als Muster (dynamische Teile wie [horizont] passen auf jedes Segment) — wie tests/aufraeumen-etappe1.test.ts.
    const seiten = (function alle(dir: string): string[] {
      return readdirSync(path.join(WURZEL, dir)).flatMap(n => { const rel = `${dir}/${n}`; return statSync(path.join(WURZEL, rel)).isDirectory() ? alle(rel) : n === 'page.tsx' ? [`/${dir.replace(/^app\//, '')}`] : []; });
    })('app/os').map(s => new RegExp(`^${s.replace(/\[[^\]]+\]/g, '[^/]+')}$`));
    for (const id of ORT_IDS) {
      const pfad = ORTE[id].href().split(/[?#]/)[0];
      expect(pfad.startsWith('/os'), id).toBe(true);
      expect(seiten.some(r => r.test(pfad)), `${id} → ${pfad}`).toBe(true);
    }
    expect(ortHref('gibt-es-nicht')).toBeNull();
  });
  it('Adressen: WEG baut, fulfillmentAusAdresse liest — Ungültiges fällt weg', () => {
    expect(WEG.fulfillment()).toBe(FULFILLMENT_PFAD);
    expect(WEG.fulfillment('prozesse', { k: 'fk-a1' })).toBe(`${FULFILLMENT_PFAD}?k=fk-a1`);
    expect(WEG.fulfillment('bausteine', { b: 'fb-x', k: 'fk-a1' })).toBe(`${FULFILLMENT_PFAD}?u=bausteine&b=fb-x`);
    expect(WEG.fall('m-1')).toBe(`${FULFILLMENT_PFAD}?m=m-1`);
    expect(WEG.dossier('m-1')).toBe(fallLink('m-1', 'analyse'));
    expect(fallLink('../boese')).toBe(FULFILLMENT_PFAD);
    expect(fulfillmentLink('onboarding')).toBe(`${FULFILLMENT_PFAD}?u=onboarding`);
    const q = (s: string) => new URLSearchParams(s);
    expect(fulfillmentAusAdresse(q('u=bausteine&b=fb-1'))).toEqual({ u: 'bausteine', r: 'ueberblick', b: 'fb-1' });
    expect(fulfillmentAusAdresse(q('u=quatsch&k=fk-1&r=analyse&m=m-1'))).toEqual({ u: 'prozesse', r: 'analyse', k: 'fk-1', m: 'm-1' });
    expect(fulfillmentAusAdresse(q('k=<script>&b=fb-1'))).toEqual({ u: 'prozesse', r: 'ueberblick' });
    expect(KENNUNG.kundenLink.test('kl-0123456789abcdef01234567')).toBe(true);
    expect(KENNUNG.kundenLink.test('kl-0123456789abcdef0123456')).toBe(false);
  });
});

// ── Register, Fristen, Art. 17 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Register, Löschfristen, Art. 17', () => {
  it('fünf Bestände + Datei-Ordner im Speicher-Register, alle Business, mit Angaben', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    for (const n of ['fulfillment--h', 'fulfillment-faelle--h', 'fulfillment-kunde--h', 'fulfillment-dossiers--h', 'fulfillment-personen--h', 'fulfillment-unterlagen']) {
      const e = registerEintrag(n);
      expect(e?.bereich, n).toBe('business');
      expect(e?.rechtsgrundlage, n).toMatch(/Art\. 6/);
      expect(e?.art15?.length, n).toBeGreaterThan(20);
    }
    expect(registerEintrag('fulfillment-faelle--h')?.muster).toBe('fulfillment-faelle--*');
    expect(registerEintrag('fulfillment-personen--h')?.frist).toBe('fulfillment-personen');
  });
  it('drei Löschfristen mit Vorgabe und Spanne', async () => {
    const { LOESCHFRISTEN, fristenWirksam } = await import('@/lib/crm/loeschfristen');
    const f = fristenWirksam({});
    expect([f['fulfillment-personen'], f['fulfillment-unterlagen'], f['fulfillment-mandatsdaten']]).toEqual([90, 90, 12]);
    expect(LOESCHFRISTEN.find(x => x.id === 'fulfillment-personen')).toMatchObject({ einheit: 'tage', min: 30, max: 365 });
    expect(LOESCHFRISTEN.find(x => x.id === 'fulfillment-mandatsdaten')).toMatchObject({ einheit: 'monate', min: 3, max: 120 });
  });
  it('Art. 17: Fall behält den Stakeholder ohne Kennung und Notiz; Kunde verliert Antworten, die die Person nennen; Karten der Person fallen weg', async () => {
    const { weitererSpeicher, merkmaleVon } = await import('@/lib/crm/person-weitere');
    const m = merkmaleVon('c-person-1', { vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid' });
    const faelle = { faelle: { 'm-1': { mandatId: 'm-1', stakeholder: [{ id: 'fs-1', kontaktId: 'c-person-1', rolle: 'entscheider', einfluss: 3, haltung: 'positiv', notiz: 'sehr direkt' }, { id: 'fs-2', kontaktId: 'c-andere', rolle: 'nutzer', einfluss: 1 }] } } };
    const r = weitererSpeicher('fulfillment-faelle--h')!.wirkung(faelle, m);
    const st = (r.neu.faelle as Record<string, { stakeholder: Record<string, unknown>[] }>)['m-1'].stakeholder;
    expect(st[0]).toEqual({ id: 'fs-1', kontaktId: '[gelöscht]', rolle: 'entscheider', einfluss: 3, haltung: 'positiv' });
    expect(st[1].kontaktId).toBe('c-andere');
    const kunde = { links: [], formulare: [{ mandatId: 'm-1', antworten: { 'pb-1': 'Entscheidet: Erika Beispiel' } }, { mandatId: 'm-1', antworten: { 'pb-2': 'neutral' } }], pulsAnfragen: [], puls: [], unterlagen: [] };
    const k = weitererSpeicher('fulfillment-kunde--h')!.wirkung(kunde, m);
    expect((k.neu.formulare as unknown[]).length).toBe(1);
    const p = weitererSpeicher('fulfillment-personen--h')!.wirkung({ karten: [{ id: 'pp-1', kontaktId: 'c-person-1' }, { id: 'pp-2', name: 'Jemand Anders' }] }, m);
    expect((p.neu.karten as { id: string }[]).map(x => x.id)).toEqual(['pp-2']);
    expect(weitererSpeicher('fulfillment-dossiers--h')?.behandlung).toBe('tilgen');
  });
  it('Verzeichnis: drei Fulfillment-Verarbeitungen werden einmal nachgetragen', async () => {
    const { verzeichnisVervollstaendigen } = await import('@/lib/crm/datenschutz');
    const a = verzeichnisVervollstaendigen([], '2026-10-10T10:00:00.000Z');
    for (const id of ['vv-fulfillment', 'vv-fulfillment-analyse', 'vv-kundenlink']) expect(a.liste.some(v => v.id === id), id).toBe(true);
    expect(verzeichnisVervollstaendigen(a.liste, '2026-10-11T10:00:00.000Z').geaendert).toBe(false);
  });
});

// ── Routen: Tor, Sicht, Stubs, Hubs ────────────────────────────────────────────────────────────────────────────────────────────────────

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
const rufe = async (pfad: string, methode: string, kopf: Record<string, string>, suche = '') => {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  return m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: '{}' }) }));
};

describe('Routen: Business only, Tor, Stubs', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }),
      konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
      konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }),
      konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
      konto('k5', 'kunde', 'mitglied'),
    ], einladungen: [] });
  });
  afterAll(async () => {
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
    rmSync(ordner, { recursive: true, force: true });
  });

  it('?space=privat → 403 (Route und Middleware), ?space=business → Stub', async () => {
    expect((await rufe('fulfillment', 'GET', sitzung('pia'), '?space=privat')).status).toBe(403);
    expect((await rufe('fulfillment/fall', 'GET', sitzung('olaf'), '?space=privat')).status).toBe(403);
    const { sichtFremd } = await import('@/lib/zugang/sicht-bereich');
    for (const p of ['/api/fulfillment', '/api/fulfillment/fall', '/api/fulfillment/personen', '/api/kunde/kl-0123456789abcdef01234567']) expect(sichtFremd(p, 'privat'), p).toBe(true);
    const r = await rufe('fulfillment', 'GET', sitzung('pia'), '?space=business');
    expect(r.status).toBe(501);
    expect(await r.json()).toEqual({ ok: false, fehler: 'kommt mit Paket C1' });
  });

  it('fremder Haushalt und Testkunde → 403; Dienstweg schreibt nie (403), liest mit Person aus dem Haushalt', async () => {
    for (const [pfad, m] of [['fulfillment', 'GET'], ['fulfillment', 'PATCH'], ['fulfillment/fall', 'POST'], ['fulfillment/kunde', 'GET'], ['fulfillment/dossier', 'GET'], ['fulfillment/analyse', 'POST'], ['fulfillment/cockpit', 'GET']] as const) {
      expect((await rufe(pfad, m, sitzung('gast'))).status, `${pfad} ${m} gast`).toBe(403);
      expect((await rufe(pfad, m, sitzung('kunde'))).status, `${pfad} ${m} kunde`).toBe(403);
    }
    expect((await rufe('fulfillment', 'PATCH', dienst('pia'))).status).toBe(403);
    expect((await rufe('fulfillment/fall', 'POST', dienst('pia'))).status).toBe(403);
    expect((await rufe('fulfillment', 'GET', dienst('pia'))).status).toBe(501);
  });

  it('Personenteil: nie für ein Konto „nur Business“; Inhaber und volle Mitglieder erreichen den Stub', async () => {
    expect((await rufe('fulfillment/personen', 'GET', sitzung('partnerin'))).status).toBe(403);
    // C3 (10.10.): Inhaber und volle Mitglieder kommen durch das Tor — ohne Mandat (?m=) antwortet die Route mit 400.
    expect((await rufe('fulfillment/personen', 'GET', sitzung('pia'))).status).toBe(400);
    expect((await rufe('fulfillment/personen', 'GET', sitzung('olaf'))).status).toBe(400);
    // der Rest von Fulfillment ist Business — auch für „nur Business“ sichtbar
    expect((await rufe('fulfillment', 'GET', sitzung('partnerin'))).status).toBe(501);
  });

  it('Leseteil nur per Sitzung; öffentliche Wege antworten bis C2 mit derselben 404', async () => {
    expect((await rufe('fulfillment/dossier/leseteil', 'GET', dienst('pia'))).status).toBe(401);
    // C3 (10.10.): ohne Leseteil dieser Person (hier: kein Dossier) → 404.
    expect((await rufe('fulfillment/dossier/leseteil', 'GET', sitzung('pia'))).status).toBe(404);
    for (const [pfad, m] of [['kunde/[link]', 'GET'], ['kunde/[link]/formular', 'POST'], ['kunde/[link]/upload', 'POST'], ['kunde/[link]/puls', 'POST']] as const) {
      const r = await rufe(pfad, m, {});
      expect(r.status, pfad).toBe(404);
      expect(await r.json()).toEqual({ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' });
    }
  });

  it('Hubs: Morgenlauf ohne Wirkung, Fristen ohne Zähler, Auskunft leer, Stapel verteilt nach Präfix', async () => {
    const { fulfillmentMorgenlauf } = await import('@/lib/fulfillment/morgenlauf');
    expect(await fulfillmentMorgenlauf('haus-ff', '2026-10-10')).toMatchObject({ vorschlaege: 0, text: 'nichts fällig' });
    const { fulfillmentFristen } = await import('@/lib/fulfillment/fristen-server');
    expect(await fulfillmentFristen({ heute: '2026-10-10', jetzt: new Date(), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } })).toEqual({});
    const { fulfillmentAuskunft } = await import('@/lib/fulfillment/auskunft');
    const { merkmaleVon } = await import('@/lib/crm/person-weitere');
    expect(await fulfillmentAuskunft(merkmaleVon('c-1'))).toEqual({ stakeholder: [], kunde: [], personen: [] });
    const { stapelArtVon } = await import('@/lib/zoe/stapel-arten');
    const art = await stapelArtVon({ bezug: { art: 'fulfillment', id: 'p:onboarding:m-1' } });
    expect(art).not.toBeNull();
    const v = { bezug: { art: 'fulfillment' as const, id: 'x:unbekannt' } } as unknown as Parameters<NonNullable<typeof art>['freigeben']>[0];
    expect(await art!.freigeben(v, 'pia', {})).toMatchObject({ ok: false, status: 409 });
  });

  it('Speicher: Lesen schreibt nie; Ändern in der Sperre, Grenze 413, unverändert = kein Schreiben', async () => {
    const sp = await import('@/lib/fulfillment/speicher');
    const db = await import('@/lib/store/local-db');
    expect(sp.fulfillmentSpeicherFuer('faelle', 'haus-ff')).toBe('fulfillment-faelle--haus-ff');
    expect(sp.fulfillmentSpeicherFuer('vorlagen', '../x')).toBe('fulfillment--inhaber');
    expect(await sp.fulfillmentLesen('vorlagen', 'haus-ff')).toEqual(leerVorlagen());
    expect(await db.loadJson('fulfillment--haus-ff')).toBeNull();
    const zuViel = await sp.fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, rituale: Array.from({ length: GRENZEN.rituale + 1 }, (_, i) => ({ id: `fr-${i}`, titel: 'R', rhythmus: 'woche' as const, dauerMin: 15, agenda: [], teilnehmende: [], geaendert: '', geaendertVon: '' })) }, geaendert: ['rituale'] }), undefined, 'haus-ff');
    expect(zuViel).toMatchObject({ ok: false, status: 413 });
    expect(await db.loadJson('fulfillment--haus-ff')).toBeNull();
    const gleich = await sp.fulfillmentAendern('vorlagen', d => ({ ok: true, datei: d, geaendert: [] }), undefined, 'haus-ff');
    expect(gleich.ok).toBe(true);
    expect(await db.loadJson('fulfillment--haus-ff')).toBeNull();
    const neu = await sp.fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, marken: { probe: '2026-10-10' } }, geaendert: ['marken'] }), { art: 'person', person: 'pia' }, 'haus-ff');
    expect(neu.ok).toBe(true);
    expect((await sp.fulfillmentLesen('vorlagen', 'haus-ff')).marken).toEqual({ probe: '2026-10-10' });
    expect(sp.eintragStand({ a: 1 })).toBe(sp.eintragStand({ a: 1 }));
  });
});

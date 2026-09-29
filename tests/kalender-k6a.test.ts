// ─── K6a (29.09.): Verbindungsrunde Kalender außerhalb des Kerns — reine Regeln ─
// Erfundene Daten (@example.invalid). Je Punkt des Auftrags ein Block.
import { describe, it, expect } from 'vitest';
import { zeitenAus, mitTerminZeit, kontakteMitTerminZeit, hatTerminVerweise, wannAusTermin } from '../lib/crm/aktivitaeten';
import { nachbereitung } from '../lib/crm/erfassen';
import { faellige, dealWiedervorlagen, virtuell } from '../lib/crm/followup';
import { werIstDran } from '../lib/crm/heute';
import { mandatFristen, mandatLage } from '../lib/crm/kunden';
import { fristen, STEUER_HINWEIS } from '../lib/kalender/eintraege';
import { termineHeute, fristenAnstehend, followupsAnstehend, geburtstageVorlauf, geschenkAufgabeTitel } from '../lib/heute/anstehend';
import { anstehendAbleiten, MELDUNG_ID_OK } from '../lib/meldungen/regeln';
import { wocheAuswerten, zeitAuswertung, auswertungMarkdown, terminKategorie } from '../lib/kalender/auswertung';
import { verwaisteEventTermine, waisenPaare, followupsNachTermin, buchungFollowupsOhneTermin, termineReparieren, vortagVon } from '../lib/crm/verbindungen-termine';
import { dealSignale } from '../lib/heads/daten';
import { vorgabeAusFreierZeit } from '../components/os/crm/angebot/TerminVorschlag';
import { steuerVorlageSauber, einstellungenSauber } from '../lib/kalender/einstellungen';
import { leererBestand } from '../lib/crm/speicher';
import { istFeiertag } from '../lib/zeit/kalender-kern';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import type { Chance, CrmBestand, FollowUp, Mandat } from '../lib/crm/typen';
import type { KalenderPruefBestand } from '../lib/crm/verbindungen-kalender';
import type { TerminMitBezug } from '../lib/kalender/bezug';

const HEUTE = '2026-09-29';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Test', nachname: id.toUpperCase(), email: `${id}@example.invalid`, eignung: 'hoch', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, besitzer: 'kevin', ...x } as Kontakt);
const meeting = (terminUid: string, x: Partial<Aktivitaet> = {}): Aktivitaet => ({ art: 'termin', am: '2026-09-20T08:00:00.000Z', von: 'kevin', text: 'Meeting: Strategie', terminUid, ...x } as Aktivitaet);
const fu = (x: Partial<FollowUp>): FollowUp => ({ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'sonstig', text: 'Termin vorbereiten', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });
const deal = (x: Partial<Chance>): Chance => ({ id: 'ch-1', titel: 'Deal Test', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'bedarf', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: HEUTE, geaendert: HEUTE, ...x } as Chance);

// ── 1 · Termin-Zeiten überall aus dem Termin ────────────────────────────────
describe('1 · Meeting-Zeit kommt aus dem Termin (nie aus am)', () => {
  const termine = [{ id: 'kal1|u-1', start: '2026-10-02T14:00:00', ende: '2026-10-02T15:00:00', ganztags: false, ort: 'Büro', titel: 'Strategie' }];
  const zeiten = zeitenAus(termine);
  it('Zeiten unter neuer UND alter Schlüsselform (R-K1 #46), maskierte fallen heraus', () => {
    expect(zeiten['kal1|u-1']).toMatchObject({ start: '2026-10-02T14:00:00', ort: 'Büro' });
    expect(zeiten['u-1']).toBe(zeiten['kal1|u-1']);
    expect(zeitenAus([{ ...termine[0], id: 'belegt-x', maskiert: true }])).toEqual({});
  });
  it('mitTerminZeit setzt wann (Tag + Uhrzeit) und Ort — alles andere bleibt', () => {
    const a = mitTerminZeit(meeting('u-1'), zeiten);
    expect(a.wann).toBe('2026-10-02T14:00');
    expect(a.ort).toBe('Büro');
    expect(mitTerminZeit({ art: 'notiz', am: 'x', von: 'kevin' } as Aktivitaet, zeiten)).toEqual({ art: 'notiz', am: 'x', von: 'kevin' });
    expect(wannAusTermin({ start: '2026-10-02T00:00:00', ganztags: true })).toBe('2026-10-02');
  });
  it('Kartei: nur Kontakte mit Verweis werden kopiert, die Kartei selbst bleibt unverändert', () => {
    const kartei = [k('c-a', { aktivitaeten: [meeting('u-1')] }), k('c-b')];
    const neu = kontakteMitTerminZeit(kartei, zeiten);
    expect(neu[0].aktivitaeten[0].wann).toBe('2026-10-02T14:00');
    expect(kartei[0].aktivitaeten[0].wann).toBeUndefined();
    expect(neu[1]).toBe(kartei[1]);
    expect(hatTerminVerweise(kartei)).toBe(true);
  });
  it('Heads: ein geplantes Meeting mit Termin ist ein eigenes Signal', () => {
    const personen = [k('c-a', { aktivitaeten: [mitTerminZeit(meeting('u-1', { am: '2026-09-28T08:00:00Z' }), zeiten)] })];
    expect(dealSignale(deal({}), personen, HEUTE).positiv).toContain('Meeting geplant am 2026-10-02 14:00');
  });
});

// ── 2 · Nachbereitung mit Termin-Zeit ───────────────────────────────────────
describe('2 · Nachbereitung: Meetings mit Termin zählen erst, wenn der Termin vorbei ist', () => {
  const zeiten = zeitenAus([
    { id: 'kal1|u-vorbei', start: '2026-09-28T10:00:00', ende: '2026-09-28T11:00:00', titel: 'Erstgespräch' },
    { id: 'kal1|u-spaeter', start: '2026-09-29T16:00:00', ende: '2026-09-29T17:00:00', titel: 'Später' },
    { id: 'kal1|u-abgesagt', start: '2026-09-28T09:00:00', ende: '2026-09-28T10:00:00', titel: 'Abgesagt', abgesagt: true },
  ]);
  const jetzt = '2026-09-29T12:00:00';
  it('vergangener Termin ohne Ergebnis → nachbereiten, mit Termin-Titel und -Zeit', () => {
    const l = nachbereitung([k('c-a', { aktivitaeten: [meeting('kal1|u-vorbei', { am: '2026-09-27T08:00:00Z' })] })], HEUTE, 'kevin', zeiten, jetzt);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ kontaktId: 'c-a', titel: 'Erstgespräch', am: '2026-09-28T10:00:00', tag: '2026-09-28' });
    expect(l[0].bezug).toMatch(/^termin-/);
  });
  it('danach festgehalten, zukünftig oder abgesagt → nichts', () => {
    const danach = { art: 'gespraech', am: '2026-09-28T12:00:00.000Z', von: 'kevin', text: 'lief gut' } as Aktivitaet;
    expect(nachbereitung([k('c-a', { aktivitaeten: [meeting('kal1|u-vorbei'), danach] })], HEUTE, 'kevin', zeiten, jetzt)).toEqual([]);
    expect(nachbereitung([k('c-a', { aktivitaeten: [meeting('kal1|u-spaeter')] })], HEUTE, 'kevin', zeiten, jetzt)).toEqual([]);
    expect(nachbereitung([k('c-a', { aktivitaeten: [meeting('kal1|u-abgesagt')] })], HEUTE, 'kevin', zeiten, jetzt)).toEqual([]);
    // Ohne Zeiten (alter Aufruf) bleibt alles wie vorher.
    expect(nachbereitung([k('c-a', { aktivitaeten: [meeting('kal1|u-vorbei')] })], HEUTE, 'kevin')).toEqual([]);
  });
});

// ── 3 · Deal-Wiedervorlage ──────────────────────────────────────────────────
describe('3 · Wiedervorlage am geparkten Deal kommt wieder hoch (eine Regel)', () => {
  const kontakte = [k('c-a')];
  const crm: CrmBestand = { ...leererBestand(), chancen: [deal({ stufe: 'geparkt', wiedervorlage: '2026-09-28', grund: 'Budget 2027' }), deal({ id: 'ch-2', stufe: 'geparkt', wiedervorlage: '2026-12-01' })] };
  it('in der Follow-up-Ebene als virtueller Eintrag (überfällig), Kennung zerlegbar', () => {
    const l = faellige(kontakte, crm, HEUTE);
    const f = l.find(x => x.id === 'v:dealwiedervorlage:ch-1');
    expect(f).toMatchObject({ quelle: 'dealwiedervorlage', gruppe: 'ueberfaellig', bezug: { art: 'chance', id: 'ch-1' }, kontaktId: 'c-a', zustaendig: 'kevin' });
    expect(f!.text).toContain('Budget 2027');
    expect(l.some(x => x.id === 'v:dealwiedervorlage:ch-2')).toBe(false);
    expect(virtuell('v:dealwiedervorlage:ch-1')).toEqual({ quelle: 'dealwiedervorlage', ziel: 'ch-1' });
    expect(dealWiedervorlagen(crm, HEUTE).map(c => c.id)).toEqual(['ch-1']);
  });
  it('in der Power Hour („Wer ist dran“) über dieselbe Regel', () => {
    const r = werIstDran([k('c-a', { telefon: '+49 30 000000', einwilligungen: [] })], crm, HEUTE, 'kevin');
    const karte = r.karten.find(x => x.kontakt.id === 'c-a');
    expect(karte?.gruende.some(g => g.includes('geparkt — Wiedervorlage'))).toBe(true);
  });
  it('Heute/Glocke: fällige Follow-ups ohne Kadenz und ohne verknüpfte Aufgabe', () => {
    const l = faellige([k('c-a', { kreis: 'A', letzterKontakt: '2026-07-01' })], { ...crm, followups: [fu({ id: 'fu-auf', aufgabeId: 't-1', faellig: HEUTE })] }, HEUTE, { horizont: 0 });
    const a = followupsAnstehend(l, 'kevin', new Set(['fu-auf']));
    expect(a.map(x => x.id)).toEqual(['v:dealwiedervorlage:ch-1']);
    expect(a[0].href).toContain('ch-1');
  });
});

// ── 2b · Fristen: Kündigungsfrist aus EINER Rechnung ─────────────────────────
describe('2 · Kündigungsfrist einmal gerechnet — Mandatsseite und Kalender gleich', () => {
  const m = { id: 'm-1', kunde: 'Testfirma', status: 'aktiv', start: '2026-01-01', mindestlaufzeitMonate: 12, kuendigungsfristTage: 90, verlaengerung: 'manuell' as const, zustaendig: 'malin' };
  it('ohne `ende`: Ende aus Start + Mindestlaufzeit, Frist davor (vorher im Kalender: keine)', () => {
    expect(mandatFristen(m, HEUTE)).toEqual({ endeAm: '2027-01-01', frist: '2026-10-03' });
    const f = fristen({ mandate: [m] }, HEUTE, '2027-02-01', HEUTE);
    expect(f.find(x => x.id === 'md-frist-m-1')).toMatchObject({ tag: '2026-10-03', kuendigung: true, fuer: 'malin' });
    expect(f.find(x => x.id === 'md-ende-m-1')).toMatchObject({ tag: '2027-01-01', titel: 'Laufzeit-Ende: Testfirma' });
    const lage = mandatLage({ ...m, titel: 'x', kontaktIds: [], honorar: { betrag: 0, basis: 'monat' }, health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, offen: [], gesellschaft: 'kdc' } as unknown as Mandat, HEUTE);
    expect(lage.fristBis).toBe('2026-10-03');
  });
  it('Zahlung am Wochenende trägt den Werktag-Hinweis; Steuer-Vorlage mit Pflicht-Hinweis, ohne Betrag', () => {
    const f = fristen({ zahlungen: [{ id: 'z1', an: 'Vermieter', faellig: '2026-10-03', betrag: 100 }], steuer: [{ datum: '2026-10-12', art: 'kdc-ust', titel: 'Selbstständigkeit: Umsatzsteuer-Voranmeldung Q3/2026', hinweis: 'Anmeldung und Zahlung' }] }, HEUTE, '2026-11-01', HEUTE);
    expect(f.find(x => x.id === 'za-z1')!.unter).toContain('zählt bis 05.10.');
    const st = f.find(x => x.art === 'steuer')!;
    expect(st.unter).toContain(STEUER_HINWEIS);
    expect(st.titel).not.toMatch(/€/);
  });
  it('CRM-Fristen: DSGVO-Antrag ohne Namen, gestelltes Angebot, offener Deal (Zuständig = Besitzer)', () => {
    const f = fristen({ antraege: [{ id: 'a-1', art: 'auskunft', frist: '2026-10-20', status: 'offen' }, { id: 'a-2', art: 'loeschung', frist: '2026-10-20', status: 'erledigt' }],
      angebote: [{ id: 'ang-1', titel: 'Retainer', status: 'gestellt', gueltigBis: '2026-10-15' }, { id: 'ang-2', titel: 'Alt', status: 'entwurf', gueltigBis: '2026-10-15' }],
      deals: [{ id: 'ch-1', titel: 'Deal Test', stufe: 'angebot', erwartetAm: '2026-10-31', besitzer: 'malin', offen: true }, { id: 'ch-2', titel: 'Zu', stufe: 'verloren', erwartetAm: '2026-10-31', offen: false }] }, HEUTE, '2026-11-01', HEUTE);
    expect(f.map(x => x.id)).toEqual(['an-ang-1', 'ds-a-1', 'dl-ch-1']);
    expect(f[1].titel).toBe('DSGVO-Antrag (auskunft): Frist');
    expect(f[2].fuer).toBe('malin');
  });
  it('Heute: heute/morgen und Kündigungsfristen mit Vorlauf, nur die eigenen', () => {
    const f = fristen({ mandate: [m], zahlungen: [{ id: 'z2', an: 'X', faellig: '2026-09-30' }, { id: 'z3', an: 'Y', faellig: '2026-10-10' }] }, HEUTE, '2026-11-01', HEUTE);
    expect(fristenAnstehend(f, 'malin', HEUTE, 14).map(x => x.id).sort()).toEqual(['md-frist-m-1', 'za-z2']);
    expect(fristenAnstehend(f, 'kevin', HEUTE, 14).map(x => x.id)).toEqual(['za-z2']);
    expect(fristenAnstehend(f, 'malin', HEUTE, 2).map(x => x.id)).toEqual(['za-z2']);
  });
  it('Steuer-Vorlage ist Standard AUS und nie still eingeschaltet', () => {
    expect(einstellungenSauber(null).steuerVorlage).toEqual({ an: false });
    expect(steuerVorlageSauber({ an: 'ja' })).toEqual({ an: false });
    expect(steuerVorlageSauber({ an: true })).toEqual({ an: true });
    expect(einstellungenSauber(null).kuendigungVorlaufTage).toBe(14);
  });
});

// ── 2c · Heute & Glocke ─────────────────────────────────────────────────────
describe('2 · Glocke & Heute: abgeleitet, nie gespeichert', () => {
  const t = (id: string, start: string, ende: string, x: Partial<TerminMitBezug & { wer: string }> = {}) => ({ id, uid: id, href: '', titel: id, start, ende, ganztags: false, kalender: 'Privat Kevin', kalenderId: 'k', serie: false, mitTeilnehmern: false, bearbeitbar: true, art: 'termin' as const, beschaeftigt: true, sichtbarkeit: 'standard' as const, wer: 'kevin', ...x });
  const termine = [
    t('kal|a', '2026-09-29T13:00:00', '2026-09-29T14:00:00'),
    t('kal|b', '2026-09-29T08:00:00', '2026-09-29T09:00:00'),
    t('kal|c', '2026-09-29T15:00:00', '2026-09-29T16:00:00', { abgesagt: true }),
    t('kal|d', '2026-09-29T11:30:00', '2026-09-29T12:30:00'),
    t('kal|e', '2026-09-29T17:00:00', '2026-09-29T18:00:00', { wer: 'malin' }),
  ];
  const heute = termineHeute(termine, 'kevin', HEUTE, '2026-09-29T12:00:00');
  it('Heute: kommende und laufende eigene Termine, nie abgesagte', () => {
    expect(heute.map(x => x.id)).toEqual(['kal|d', 'kal|a']);
    expect(heute[0].laeuft).toBe(true);
  });
  it('Glocke: Termin erst ≤ 2 h vorher, Kennungen gültig, gelesen je Tag', () => {
    const m = anstehendAbleiten({ termine: heute, nachbereiten: [{ kontaktId: 'c-a', name: 'Test A', titel: 'Erstgespräch', href: '/os/x' }], fristen: [{ id: 'md-frist-m-1', titel: 'Kündigungsfrist: X', tag: '2026-10-03', href: '/os/y', inTagen: 4, kuendigung: true }], followups: [{ id: 'v:dealwiedervorlage:ch-1', text: 'Wiedervorlage', name: 'Test A', tageUeber: 1, href: '/os/z' }] },
      { heute: HEUTE, jetztWand: '2026-09-29T12:00:00', am: '2026-09-28T22:00:00.000Z' });
    expect(m.map(x => x.art)).toEqual(['termin', 'termin', 'nachbereiten', 'frist', 'followup']);
    expect(m[0].titel).toContain('Läuft gerade');
    expect(m[1].titel).toContain('Um 13:00');
    expect(m[3].titel).toContain('In 4 Tagen');
    for (const x of m) { expect(MELDUNG_ID_OK.test(x.id)).toBe(true); expect(x.virtuell).toBe(true); }
    const gelesen = anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [], followups: [{ id: 'fu-1', text: 'a', name: '', tageUeber: 0, href: '/os/z' }] }, { heute: HEUTE, jetztWand: '2026-09-29T12:00:00', am: 'x', gelesen: { tag: HEUTE, ids: [`followup:${HEUTE}:fu-1`] } });
    expect(gelesen[0].gelesen).toBe(true);
    const v = anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [], followups: [], vorschlaege: { kalender: 2 } }, { heute: HEUTE, jetztWand: '2026-09-29T12:00:00', am: 'x' });
    expect(v).toMatchObject([{ art: 'vorschlag', link: '/os/stapel', titel: '2 Kalender-Vorschläge von ZOE warten auf Freigabe' }]);
    // Termin um 16:00 ist mehr als 2 h weg → keine Meldung.
    expect(anstehendAbleiten({ termine: [heute[1]], nachbereiten: [], fristen: [], followups: [] }, { heute: HEUTE, jetztWand: '2026-09-29T10:30:00', am: 'x' })).toEqual([]);
  });
  it('Geburtstage: Geschenk-Aufgabe 10 Tage vorher als Vorschlag (frühestens heute), CRM nur bei der Beziehung', () => {
    const g = geburtstageVorlauf([
      { id: 'g1', name: 'Test Eins', tag: '2026-10-12', herkunft: 'familie', space: 'privat', href: '/os/familie' },
      { id: 'g2', name: 'Test Zwei', tag: '2026-10-02', herkunft: 'crm', space: 'business', href: '/os/m', kontaktId: 'c-z', zustaendig: 'malin' },
      { id: 'g3', name: 'Test Drei', tag: '2026-10-01', herkunft: 'crm', space: 'business', href: '/os/m', kontaktId: 'c-y', zustaendig: 'kevin' },
    ], 'kevin', HEUTE);
    expect(g.map(x => [x.id, x.aufgabeTag])).toEqual([['g3', HEUTE], ['g1', '2026-10-02']]);
    expect(geschenkAufgabeTitel('Test Eins', '2026-10-12')).toBe('Geschenk für Test Eins (Geburtstag 12.10.)');
  });
});

// ── 5 · Angebot → Termin-Entwurf ────────────────────────────────────────────
describe('5 · Angebot: freie Zeit → Termin-Entwurf mit Bezug', () => {
  it('Vorgabe aus der freien Zeit trägt Kontakt/Firma/Deal', () => {
    expect(vorgabeAusFreierZeit({ start: '2026-10-01T10:00:00', ende: '2026-10-01T10:45:00', tag: '2026-10-01' }, { titel: 'Retainer', kontaktId: 'c-a', dealId: 'ch-1' }))
      .toEqual({ tag: '2026-10-01', von: '10:00', bis: '10:45', art: 'termin', titel: 'Angebot besprechen: Retainer', crm: { kontaktId: 'c-a', dealId: 'ch-1' } });
  });
});

// ── 7 · Auswertung: Planen-Blöcke als eigene Kategorien ─────────────────────
describe('7 · Zeit-Auswertung zählt Planen-Blöcke je Unterart', () => {
  const E = { bloecke: [], arbeitszeit: { vonStunde: 9, bisStunde: 17 }, feiertag: istFeiertag };
  it('Block = eigene Kategorie, unter Fokus, je Unterart', () => {
    expect(terminKategorie({ ganztags: false, art: 'block' })).toBe('block');
    const w = wocheAuswerten({ ...E, termine: [
      { start: '2026-09-29T07:00:00', ende: '2026-09-29T07:30:00', ganztags: false, space: 'privat', art: 'block', blockArt: 'reha' },
      { start: '2026-09-29T10:00:00', ende: '2026-09-29T11:00:00', ganztags: false, space: 'business', art: 'block' },
      { start: '2026-09-29T10:30:00', ende: '2026-09-29T11:30:00', ganztags: false, space: 'business', art: 'fokus' },
    ] }, HEUTE);
    expect(w.minuten.bloecke).toBe(60); // Reha 30 + Blockzeit 10:00–10:30 (danach gewinnt Fokus)
    expect(w.minuten.fokus).toBe(60);
    expect(w.jeBlock).toEqual([{ art: 'block', minuten: 30 }, { art: 'reha', minuten: 30 }]);
    expect(w.minuten.belegt).toBe(120);
    const md = auswertungMarkdown(zeitAuswertung({ ...E, termine: [{ start: '2026-09-29T07:00:00', ende: '2026-09-29T08:00:00', ganztags: false, space: 'privat', art: 'block', blockArt: 'routine' }] }, HEUTE));
    expect(md).toContain('Blöcke (Planen): 1 h');
    expect(md).toContain('- Routine: 1 h');
  });
});

// ── 6 · Verbindungsprüfung: Event gelöscht, Waisen, Follow-ups am Termin ────
describe('6 · Verbindungsprüfung K6a', () => {
  const kal: KalenderPruefBestand = {
    fenster: { von: '2026-07-01', bis: '2027-11-01' },
    objekte: [{ uid: 'makeos-event-ev-weg', schluessel: 'kal|makeos-event-ev-weg', mitArt: false }, { uid: 'neu-1', schluessel: 'kal|neu-1', mitArt: false }, { uid: 'neu-2', schluessel: 'kal|neu-2', mitArt: false }],
    bezuege: [
      { schluessel: 'kal|makeos-event-ev-weg', tag: '2026-10-10', kennungen: { eventId: 'ev-weg' } },
      { schluessel: 'kal|alt-1', tag: '2026-10-05', kennungen: { kontaktId: 'c-a' } },
    ],
  };
  const termineStand = {
    termine: [{ id: 'kal|neu-1', tag: '2026-10-06', titel: 'Strategie', mitTeilnehmern: false }, { id: 'kal|neu-2', tag: '2026-10-20', titel: 'Strategie', mitTeilnehmern: false }, { id: 'kal|t-9', tag: '2026-10-08', titel: 'Buchung', mitTeilnehmern: false }],
    buchungFollowups: [{ buchungId: 'b-1', terminUid: 'kal|t-9', followUpId: 'fu-b' }],
  };
  const kontakte = [k('c-a', { aktivitaeten: [meeting('kal|alt-1')] })];
  it('Termin eines gelöschten Events wird gemeldet — nur, solange er lebt', () => {
    expect(verwaisteEventTermine(kal, new Set())).toEqual(['kal|makeos-event-ev-weg']);
    expect(verwaisteEventTermine(kal, new Set(['ev-weg']))).toEqual([]);
  });
  it('#100 Waise: genau EIN neuer Termin mit gleichem Titel ±1 Tag → Paar; mehrdeutig → nichts', () => {
    expect(waisenPaare(kal, termineStand, kontakte, [])).toEqual([['kal|alt-1', 'kal|neu-1']]);
    const zwei = { ...termineStand, termine: [...termineStand.termine, { id: 'kal|neu-3', tag: '2026-10-04', titel: 'strategie ', mitTeilnehmern: false }] };
    expect(waisenPaare(kal, zwei, kontakte, [])).toEqual([]);
    expect(waisenPaare({ ...kal, fenster: null }, termineStand, kontakte, [])).toEqual([]);
  });
  it('Follow-up am Termin: Vortag nachziehen, von Hand verschobene bleiben; Buchung verknüpfen', () => {
    const fus = [fu({ id: 'fu-b', faellig: '2026-10-01' }), fu({ id: 'fu-t', terminUid: 'kal|t-9', faellig: '2026-10-01' }), fu({ id: 'fu-h', terminUid: 'kal|t-9', faellig: '2026-10-01', verschoben: 1 })];
    expect(Array.from(followupsNachTermin(fus, termineStand, HEUTE))).toEqual([['fu-t', '2026-10-07']]);
    expect(Array.from(buchungFollowupsOhneTermin(fus, termineStand))).toEqual([['fu-b', 'kal|t-9']]);
    expect(vortagVon(HEUTE, HEUTE)).toBe(HEUTE);
    const r = termineReparieren({ kalender: kal, termine: termineStand, kontakte, aufgaben: null, followups: fus, heute: HEUTE }, new Set(['followup-termin-verschoben', 'buchung-followup-ohne-termin', 'termin-waise-neu']), '2026-09-29T10:00:00Z', 'kevin', new Set());
    expect(r.followups.find(f => f.id === 'fu-t')!.faellig).toBe('2026-10-07');
    expect(r.followups.find(f => f.id === 'fu-b')!.terminUid).toBe('kal|t-9');
    expect(r.kontakte[0].aktivitaeten[0].terminUid).toBe('kal|neu-1');
    expect(r.aenderungen.map(a => a.befundId)).toEqual(['followup-termin-verschoben', 'buchung-followup-ohne-termin', 'termin-waise-neu', 'termin-waise-neu']);
  });
});

// ── 5b · ZOE-Werkzeug freie_zeit: registriert, nur lesend ───────────────────
describe('5 · ZOE freie_zeit', () => {
  it('ist im Register frei, gilt als lesend (läuft auch nach Fremdtext) und hat eine Implementierung', async () => {
    const { risikoVon } = await import('../lib/zoe/register');
    const { LESEND, nurVorschlag } = await import('../lib/zoe/gespraech-schutz');
    const { WERKZEUGE } = await import('../lib/zoe/werkzeuge');
    expect(risikoVon('freie_zeit')).toBe('frei');
    expect(LESEND.has('freie_zeit')).toBe(true);
    expect(nurVorschlag('freie_zeit', {}, true)).toBe(false);
    expect(typeof WERKZEUGE.freie_zeit.lauf).toBe('function');
  });
});

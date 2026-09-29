// ─── F2 (29.09.): Funde der adversarialen Prüfung 2 — je Fund die Gegenprobe (reine Regeln) ─────────────────────
// Erfundene Daten (@example.invalid). Vorlage: die Beleg-Tests des Prüfers (P1–P4) — hier mit dem richtigen Ergebnis.
// H1 (Einwilligung Zeit im Vault) prüft tests/brain-app-bruecke.test.ts, M8 (plan_block über den Stapel) auch
// tests/werkzeug-register.test.ts.
import { describe, it, expect } from 'vitest';
import { faellige } from '@/lib/crm/followup';
import { fristen } from '@/lib/kalender/eintraege';
import { fristenAnstehend, followupsAnstehend, termineHeute, geburtstageVorlauf, geschenkAufgabeTitel, geschenkStand, followupAnzeige } from '@/lib/heute/anstehend';
import { anstehendAbleiten, geburtstagAbleiten } from '@/lib/meldungen/regeln';
import { termineReparieren, followupsNachTermin, followupsTerminTot, terminePruefen } from '@/lib/crm/verbindungen-termine';
import { leererBestand } from '@/lib/crm/speicher';
import { nachbereitung } from '@/lib/crm/erfassen';
import { maskieren } from '@/lib/kalender/bezug';
import { familieQuellen, geburtstageAus } from '@/lib/kalender/quellen-geburtstage';
import { geburtstagFuer, type Geburtstag } from '@/lib/kalender/geburtstag';
import { aufgabenAnonymisieren } from '@/lib/crm/person-bestaende';
import { blockKollision } from '@/lib/planung/bloecke';
import { vorschlagSichtbar } from '@/lib/zoe/stapel';
import { risikoVon, gruppeVon } from '@/lib/zoe/register';
import { familieTageTot, familieTageBereinigen, familieReparieren } from '@/lib/crm/verbindungen-familie';
import { wendeFamilieAn, startBestand } from '@/lib/familie/speicher';
import { anlassSauber } from '@/lib/aufgaben/saeubern';
import { reviewZaehlt } from '@/lib/crm/review';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUp, Mandat } from '@/lib/crm/typen';

const HEUTE = '2026-09-29';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Test', nachname: id.toUpperCase(), email: `${id}@example.invalid`, eignung: 'hoch', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, besitzer: 'kevin', ...x } as Kontakt);
const fu = (x: Partial<FollowUp>): FollowUp => ({ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'sonstig', text: 'x', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });
const mandat = (x: Partial<Mandat>) => ({ id: 'md-1', kunde: 'Firma Test', titel: 'M', status: 'aktiv', naechstesReview: HEUTE, zustaendig: 'kevin', kontaktIds: ['c-a'], ...x }) as unknown as Mandat;

describe('M1 · Mandats-Review an EINER Stelle', () => {
  it('Review heute erscheint in der Glocke genau einmal (als Follow-up `v:review`)', () => {
    const m = mandat({});
    const crm: CrmBestand = { ...leererBestand(), mandate: [m] };
    const fr = fristenAnstehend(fristen({ mandate: [m] }, HEUTE, '2026-10-15', HEUTE), 'kevin', HEUTE, 14);
    const fus = followupsAnstehend(faellige([k('c-a')], crm, HEUTE, { horizont: 0 }), 'kevin', new Set());
    const g = anstehendAbleiten({ termine: [], nachbereiten: [], fristen: fr, followups: fus }, { heute: HEUTE, jetztWand: `${HEUTE}T09:00:00`, am: 'x' });
    expect(g.filter(x => /Review/.test(x.titel))).toHaveLength(1);
    expect(g.find(x => /Review/.test(x.titel))?.art).toBe('followup');
    // Die Kalenderansicht behält die Frist (Kennzeichen `review`).
    expect(fristen({ mandate: [m] }, HEUTE, '2026-10-15', HEUTE).find(f => f.id === 'md-review-md-1')).toMatchObject({ review: true });
  });
  it('pausiertes Mandat: kein Review — weder als Follow-up noch als Frist (eine Regel `reviewZaehlt`)', () => {
    const m = mandat({ status: 'pausiert' as Mandat['status'] });
    expect(reviewZaehlt(m)).toBe(false);
    expect(fristen({ mandate: [m] }, HEUTE, '2026-10-15', HEUTE).some(f => f.id.startsWith('md-review-'))).toBe(false);
    expect(faellige([k('c-a')], { ...leererBestand(), mandate: [m] }, HEUTE, { horizont: 0 }).some(f => f.id.startsWith('v:review:'))).toBe(false);
  });
});

describe('M2 · Geburtstage: eine Stelle auf Heute, Geschenk-Vorlauf aus der Familie, Kennung statt Titel', () => {
  const g = (x: Partial<Geburtstag>): Geburtstag => ({ id: 'g', name: 'Test Person', tag: '2026-10-05', herkunft: 'crm', space: 'business', href: '/os/m', ...x });
  it('ab heute; Sichtregel `geburtstagFuer` wie die Glocke (CRM nur bei der Person, die die Beziehung hält)', () => {
    const liste = [g({ id: 'heute', tag: HEUTE, zustaendig: 'kevin' }), g({ id: 'malins', zustaendig: 'malin' }), g({ id: 'beide', zustaendig: 'beide' })];
    expect(geburtstageVorlauf(liste, 'kevin', HEUTE).map(x => x.id)).toEqual(['heute', 'beide']);
    expect(geburtstagFuer({ zustaendig: 'malin' }, 'kevin')).toBe(false);
    const glocke = geburtstagAbleiten(liste, { person: 'kevin', heute: HEUTE, morgen: '2026-09-30', am: 'x' });
    expect(glocke.map(m => m.titel)).toEqual(['Test Person hat heute Geburtstag']);
  });
  it('Familie: der Wichtige Tag führt (Vorlauf 21 Tage → schon jetzt dabei, „erledigt“ je Jahr)', () => {
    const fam = familieQuellen({
      menschen: [{ id: 'm1', name: 'Oma Test', geburtstag: '20.10.' }, { id: 'm2', name: 'Opa Test', geburtstag: '02.10.' }],
      tage: [{ id: 't1', titel: 'Geburtstag Oma', art: 'geburtstag', datum: '', menschId: 'm1', aktion: 'geschenk', vorlaufTage: 21, erledigt: [2025] }],
    }, { mensch: '/os/menschen', tag: '/os/familie' });
    const liste = geburtstageAus(fam.map(q => ({ ...q, zustaendig: 'kevin' })), HEUTE, '2026-12-01');
    const v = geburtstageVorlauf(liste, 'kevin', HEUTE);
    expect(v.map(x => x.name)).toEqual(['Opa Test', 'Oma Test']); // Oma am 20.10. (> 14 Tage), aber im Vorlauf von 21 Tagen
    expect(v[1].anlass).toEqual({ tagId: 't1', aktion: 'geschenk', ab: '2026-09-29', erledigt: false });
    expect(v[0].anlass).toBeUndefined(); // ohne Wichtigen Tag: „Geschenk vormerken“ legt ihn an (menschId)
    expect(v[0].menschId).toBe('m2');
    const naechstesJahr = geburtstageAus(fam.map(q => ({ ...q, zustaendig: 'kevin' })), '2025-10-01', '2025-11-01').find(x => x.name === 'Oma Test');
    expect(naechstesJahr?.anlass?.erledigt).toBe(true);
  });
  it('CRM: vorgemerkt per Kennung (Kontakt + Jahr), nie per Titel; Papierkorb/Archiv/abgebrochen zählen nicht', () => {
    const b = { kontaktId: 'c-a', tag: '2026-10-05' };
    type A = { status: string; bezug?: { kontaktId?: string }; anlass?: { art: string; jahr: number }; geloeschtAm?: string; archiviertAm?: string };
    const t = (x: Partial<A>): A => ({ status: 'todo', bezug: { kontaktId: 'c-a' }, anlass: { art: 'geschenk', jahr: 2026 }, ...x });
    expect(geschenkStand([t({})], b)).toBe('offen');
    expect(geschenkStand([t({ status: 'done' })], b)).toBe('erledigt');
    expect(geschenkStand([t({ geloeschtAm: '2026-09-28T10:00:00Z' })], b)).toBeNull();
    expect(geschenkStand([t({ archiviertAm: '2026-09-28T10:00:00Z' })], b)).toBeNull();
    expect(geschenkStand([t({ status: 'cancelled' })], b)).toBeNull();
    expect(geschenkStand([t({ anlass: { art: 'geschenk', jahr: 2025 } })], b)).toBeNull();
    // Gleicher Titel ohne Kennung zählt nicht.
    const nurTitel = { status: 'todo', title: geschenkAufgabeTitel('Test Person') };
    expect(geschenkStand([nurTitel], b)).toBeNull();
    expect(anlassSauber({ art: 'geschenk', jahr: 2026 })).toEqual({ art: 'geschenk', jahr: 2026 });
    expect(anlassSauber({ art: 'sonst', jahr: 2026 })).toBeUndefined();
  });
  it('N5: Titel ohne Geburtsdatum; Art. 17 entpersonalisiert die Geschenk-Aufgabe (Name weg, Kontakt-Bezug weg)', () => {
    expect(geschenkAufgabeTitel('Test Person')).toBe('Geschenk für Test Person');
    const tasks = [{ id: 't1', title: geschenkAufgabeTitel('Test Person'), status: 'todo', bezug: { kontaktId: 'c-a' }, anlass: { art: 'geschenk', jahr: 2026 } }];
    const r = aufgabenAnonymisieren(tasks, 'c-a', [], 'Test Person');
    expect(r.n).toBe(1);
    expect(r.tasks[0].title).toBe('Geschenk für [gelöscht]');
    expect(r.tasks[0].bezug).toBeUndefined();
    expect(JSON.stringify(r.tasks[0])).not.toContain('c-a');
  });
});

describe('M3 · Follow-up am Termin: Kennung, Waisen hängen um, toter Termin', () => {
  const kal = { fenster: { von: '2026-07-01', bis: '2027-11-01' }, objekte: [{ uid: 'neu-1', schluessel: 'kal|neu-1', mitArt: false }], bezuege: [{ schluessel: 'kal|alt-1', tag: '2026-10-05', kennungen: { kontaktId: 'c-a' } }] };
  const termine = { termine: [{ id: 'kal|neu-1', tag: '2026-10-06', titel: 'Strategie', mitTeilnehmern: false }], buchungFollowups: [] };
  const kont = [k('c-a', { aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'termin', text: 'Meeting: Strategie', von: 'kevin', terminUid: 'kal|alt-1' } as never] })];
  it('„Neu zuordnen“ hängt auch Follow-ups um — danach zieht die Prüfung sie mit dem Termin nach', () => {
    const f = fu({ id: 'fu-t', terminUid: 'kal|alt-1', faellig: '2026-10-04' });
    const r = termineReparieren({ kalender: kal as never, termine, kontakte: kont, aufgaben: null, followups: [f], heute: HEUTE }, new Set(['termin-waise-neu']), 'x', 'kevin', new Set());
    expect((r.kontakte[0].aktivitaeten![0] as { terminUid?: string }).terminUid).toBe('kal|neu-1');
    expect(r.followups[0].terminUid).toBe('kal|neu-1');
    expect(r.aenderungen.some(a => a.speicher === 'crm' && a.befundId === 'termin-waise-neu')).toBe(true);
    expect(followupsNachTermin(r.followups, termine, HEUTE).get('fu-t')).toBe('2026-10-05');
  });
  it('`followup-termin-tot`: Termin weg und kein Waisen-Paar → melden; „Vom Termin lösen“ nimmt nur die Kennung', () => {
    const ohnePaar = { ...kal, bezuege: [] };
    const f = fu({ id: 'fu-tot', terminUid: 'kal|weg-1', faellig: '2026-10-04' });
    expect(followupsTerminTot([f], ohnePaar as never)).toEqual(['fu-tot']);
    expect(followupsTerminTot([f], { ...ohnePaar, fenster: null } as never)).toEqual([]); // ohne Stand: unentschieden
    const funde: string[] = [];
    terminePruefen({ kalender: ohnePaar as never, termine, kontakte: [], aufgaben: null, followups: [f], heute: HEUTE }, new Set(), (id, x) => funde.push(`${id}:${x}`));
    expect(funde).toContain('followup-termin-tot:fu-tot');
    const r = termineReparieren({ kalender: ohnePaar as never, termine, kontakte: [], aufgaben: null, followups: [f], heute: HEUTE }, new Set(['followup-termin-tot']), 'x', 'kevin', new Set());
    expect(r.followups[0]).not.toHaveProperty('terminUid');
    expect(r.followups[0]).toMatchObject({ id: 'fu-tot', faellig: '2026-10-04', status: 'offen' });
    // Ein Waisen-Paar wird umgehängt, nicht als tot gemeldet.
    const paar: string[] = [];
    terminePruefen({ kalender: kal as never, termine, kontakte: kont, aufgaben: null, followups: [fu({ id: 'fu-p', terminUid: 'kal|alt-1' })], heute: HEUTE }, new Set(), id => paar.push(id));
    expect(paar).toContain('termin-waise-neu');
    expect(paar).not.toContain('followup-termin-tot');
  });
});

describe('M4 · Nachbereiten am Termin: keine Doppelmeldung, Titel nur abgeleitet', () => {
  it('offenes Follow-up mit derselben `terminUid` → „Wie lief’s?“ fragt nicht zusätzlich', () => {
    const kont = [k('c-a', { aktivitaeten: [{ am: '2026-09-27T08:00:00Z', art: 'termin', text: 'Meeting: X', von: 'kevin', terminUid: 'kal|v' } as never] })];
    const zeiten = { 'kal|v': { start: '2026-09-28T10:00:00', ende: '2026-09-28T11:00:00', titel: 'X' } };
    expect(nachbereitung(kont, HEUTE, 'kevin', zeiten, `${HEUTE}T09:00:00`)).toHaveLength(1);
    expect(nachbereitung(kont, HEUTE, 'kevin', zeiten, `${HEUTE}T09:00:00`, [fu({ terminUid: 'kal|v' })])).toHaveLength(0);
    // Erledigt zählt nicht als „in Arbeit“ (dann entscheidet wie bisher das Festgehaltene).
    expect(nachbereitung(kont, HEUTE, 'kevin', zeiten, `${HEUTE}T09:00:00`, [fu({ terminUid: 'kal|v', status: 'erledigt' })])).toHaveLength(1);
  });
  it('die Anzeige nennt den Titel aus dem Termin — gespeichert ist nur „Termin nachbereiten“', () => {
    expect(followupAnzeige({ text: 'Termin nachbereiten', terminUid: 'kal|v' }, { 'kal|v': { start: '2026-09-28T10:00:00', titel: 'Strategie' } })).toBe('Termin nachbereiten — „Strategie“');
    expect(followupAnzeige({ text: 'Termin nachbereiten', terminUid: 'kal|v' }, {})).toBe('Termin nachbereiten');
  });
});

describe('M5 · plan_block-Kollision', () => {
  type B = Parameters<typeof blockKollision>[0][number];
  const T = (x: Partial<B>): B => ({ titel: 'Fest', start: '2026-10-01T10:00:00', ende: '2026-10-01T11:00:00', ganztags: false, art: 'termin', wer: 'kevin', ...x });
  it('abgesagte und freie zählen nicht; beschäftigte schon', () => {
    expect(blockKollision([T({})], 'kevin', '2026-10-01', 600, 660)?.titel).toBe('Fest');
    expect(blockKollision([T({ abgesagt: true })], 'kevin', '2026-10-01', 600, 660)).toBeNull();
    expect(blockKollision([T({ beschaeftigt: false })], 'kevin', '2026-10-01', 600, 660)).toBeNull();
    expect(blockKollision([T({ wer: 'malin' })], 'kevin', '2026-10-01', 600, 660)).toBeNull();
  });
  it('ganztägige Abwesenheit belegt den Tag; ein Feiertag/ganztägiger Termin nicht', () => {
    expect(blockKollision([T({ ganztags: true, art: 'abwesend', start: '2026-10-01', ende: '2026-10-02', von: 'kevin' })], 'kevin', '2026-10-01', 540, 600)).toMatchObject({ s: 0, e: 1440 });
    expect(blockKollision([T({ ganztags: true, art: 'abwesend', start: '2026-09-30', ende: '2026-10-03' })], 'kevin', '2026-10-01', 540, 600)).not.toBeNull();
    expect(blockKollision([T({ ganztags: true, art: 'termin', start: '2026-10-01', ende: '2026-10-02' })], 'kevin', '2026-10-01', 540, 600)).toBeNull();
  });
  it('über Tagesgrenzen: Beginn gestern, Ende heute früh', () => {
    const nacht = T({ start: '2026-09-30T22:00:00', ende: '2026-10-01T07:30:00' });
    expect(blockKollision([nacht], 'kevin', '2026-10-01', 420, 480)).toMatchObject({ s: 0, e: 450 });
    expect(blockKollision([nacht], 'kevin', '2026-10-01', 480, 540)).toBeNull();
  });
});

describe('M6 · ZOE-Vorschläge nur der Person (Heute = Stapel)', () => {
  it('eigene und die des Systems; Haushalt nur für Mitglieder', () => {
    expect(vorschlagSichtbar({ person: 'kevin', gruppe: 'kalender' }, 'kevin', true)).toBe(true);
    expect(vorschlagSichtbar({ person: 'malin', gruppe: 'kalender' }, 'kevin', true)).toBe(false);
    // S1 #2 (29.09.): Vorschläge des Systems (ohne Person) nur im Haushalt des Inhabers.
    expect(vorschlagSichtbar({ gruppe: 'kalender' }, 'kevin', true)).toBe(true);
    expect(vorschlagSichtbar({ gruppe: 'kalender' }, 'kevin', false)).toBe(false);
    expect(vorschlagSichtbar({ gruppe: 'haushalt' }, 'kevin', false)).toBe(false);
  });
});

describe('M8 · plan_block nur über den Stapel', () => {
  it('freigabepflichtig, Gruppe „kalender“ (zählt in Heute/Glocke als Kalender-Vorschlag)', () => {
    expect(risikoVon('plan_block')).toBe('freigabe');
    expect(gruppeVon('plan_block')).toBe('kalender');
  });
});

describe('N1 · Glocke/Heute: maskierte Termine fehlen (kein toter Link)', () => {
  it('privat der anderen Person im gemeinsamen Kalender → nicht in Heute, nicht in der Glocke', () => {
    const t = { id: 'kal|u1', uid: 'u1', kalender: 'Gemeinsam', titel: 'Arzt', start: `${HEUTE}T10:00:00`, ende: `${HEUTE}T11:00:00`, ganztags: false, art: 'termin', sichtbarkeit: 'privat', von: 'malin', wer: 'beide' } as never;
    const l = termineHeute([maskieren(t, 'kevin')] as never, 'kevin', HEUTE, `${HEUTE}T09:30:00`);
    expect(l).toEqual([]);
    expect(termineHeute([maskieren(t, 'malin')] as never, 'malin', HEUTE, `${HEUTE}T09:30:00`).map(x => x.titel)).toEqual(['Arzt']);
  });
});

describe('N4 · Familie: `Mensch.kontaktId` entfernt, verwaiste Wichtige Tage mit Reparatur', () => {
  it('der Schreibweg verwirft `kontaktId`', () => {
    const f = startBestand('2026-09-29T10:00:00Z');
    const r = wendeFamilieAn(f, [{ liste: 'menschen', op: 'upsert', eintrag: { id: 'm1', name: 'Test', rolle: 'sonstig', geburtstag: '01.01.', kontaktAlleTage: null, letzterKontakt: null, notiz: '', kontaktId: 'c-abcd-test' } }], 'kevin', '2026-09-29T10:00:00Z');
    expect(r.familie.menschen[0]).not.toHaveProperty('kontaktId');
  });
  it('Tag mit totem Menschen-Verweis: gemeldet und entfernt (auch mit Datums-Kopie für den Rückweg)', () => {
    const stand = { menschen: ['m1'], tage: [{ id: 't-ok', menschId: 'm1' }, { id: 't-tot', menschId: 'm9' }, { id: 't-alt', menschId: 'm8' }] };
    expect(familieTageTot(stand)).toEqual(['t-tot', 't-alt']);
    const v = familieReparieren(stand, new Set(['familie-tag-mensch-tot']));
    expect(v.aenderungen).toMatchObject([{ speicher: 'familie', anzahl: 2 }]);
    expect(familieTageTot(v.familie)).toEqual([]);
    const datei = { menschen: [{ id: 'm1' }], tage: [{ id: 't-ok', menschId: 'm1', datum: '' }, { id: 't-tot', menschId: 'm9', datum: '' }, { id: 't-alt', menschId: 'm8', datum: '03-03' }], dates: [] };
    const r = familieTageBereinigen(datei);
    expect(r.n).toBe(2);
    expect(r.datei.tage).toEqual([{ id: 't-ok', menschId: 'm1', datum: '' }]);
    expect(familieTageBereinigen(r.datei).n).toBe(0);
  });
});

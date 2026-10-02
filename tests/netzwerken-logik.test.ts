// ─── Netzwerken — Erfassen (02.10., rein): Prüfung, „Kennen wir schon?“, Danke-Mail, Bericht, Warteschlange ──
// Keine Platte, kein Netz, erfundene Personen (@example.invalid).
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Event, Teilnahme, Firma, FollowUp } from '@/lib/crm/typen';
import {
  erfassungPruefen, kenntWirSchon, kennenText, firmaVorschlaege, followupFrist, dankeEntwurf, dankeMailtoLink, dankeZeilen, dankeOffen, berichtAus,
  netzwerkenAngabeSaeubern, stadtAusAnschrift, wandPlusMinuten, abstand, neuesEvent, SCHRITTE, INFO_MAX, MAX_BILDER,
} from '@/lib/crm/netzwerken';
import { karteAuslesen, ausgelesenesUebernehmen, KARTE_AUSLESEN_AN } from '@/lib/crm/netzwerken-karte';
import { bewerten, Warteschlange, ramSpeicher, WARTET_TEXT, type Sender } from '@/lib/netzwerken/warteschlange';
import { sprachnotizTypErkennen } from '@/lib/dateien/regeln';
import { anstehendAbleiten, pruefeEingabe, ARTEN } from '@/lib/meldungen/regeln';
import { kanalStatus } from '@/lib/crm/recht';

const ID = '3f2b9c1e-1a2b-4c3d-8e4f-0123456789ab';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
const jetzt = new Date('2026-10-02T09:00:00+02:00');
const roh = (x: Record<string, unknown> = {}) => ({ erfassungId: ID, erfasstAm: jetzt.toISOString(), eventId: 'ev-test-1', kontakt: { vorname: 'Anna', nachname: 'Beispiel' }, bilder: [], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x });
const pruefen = (x?: Record<string, unknown>) => erfassungPruefen(roh(x), { jetzt, heute: '2026-10-02' });

const k = (id: string, v: string, n: string, f: string | undefined, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: v, nachname: n, ...(f ? { firma: f } : {}), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);

describe('Erfassung prüfen', () => {
  it('gültiger Körper: gesäubert (E-Mail klein, Telefon mit Vorwahl, Webseite https), Standard-Frist +2 Werktage', () => {
    const r = pruefen({ kontakt: { vorname: ' Anna ', nachname: 'Beispiel', email: ' Anna.Beispiel@Example.INVALID ', telefon: '0221 / 123 45-67', webseite: 'beispiel.example.invalid', anrede: 'Du' }, schritt: 'followup' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.wert.kontakt).toMatchObject({ vorname: 'Anna', email: 'anna.beispiel@example.invalid', telefon: '+49 221 123 45 67', anrede: 'Du' });
    expect(r.wert.kontakt.webseite).toMatch(/^https:\/\/beispiel\.example\.invalid/);
    expect(r.wert.followup?.faellig).toBe('2026-10-06');
  });
  it.each([
    [{ erfassungId: 'x' }, 400, /Kennung/],
    [{ eventId: '' }, 400, /Event/],
    [{ kontakt: { vorname: 'Nur' } }, 400, /Nachname/],
    [{ kontakt: { nachname: 'A', email: 'kaputt@' } }, 400, /E-Mail/],
    [{ kontakt: { nachname: 'A', telefon: '12345' } }, 400, /Vorwahl/],
    [{ kontakt: { nachname: 'A', linkedin: 'https://example.invalid/in/x' } }, 400, /LinkedIn/],
    [{ kontakt: { nachname: 'A'.repeat(81) } }, 400, /zu lang/],
    [{ schritt: 'nix' }, 400, /Schritt/],
    [{ zustaendig: 'Ge heim' }, 400, /zuständig/],
    [{ info: 'x'.repeat(INFO_MAX + 1) }, 413, /zu lang/],
    [{ bilder: Array.from({ length: MAX_BILDER + 1 }, () => ({ typ: 'image/jpeg', daten: JPEG })) }, 413, /Höchstens/],
    [{ bilder: [{ typ: 'image/gif', daten: JPEG }] }, 415, /JPEG/],
    [{ sprachnotiz: { typ: 'video/mp4', daten: JPEG } }, 415, /Format/],
    [{ schritt: 'termin', termin: { art: 'x', dauer: 30, start: '2026-10-05T10:00' } }, 400, /Art/],
    [{ schritt: 'termin', termin: { art: 'video', dauer: 20, start: '2026-10-05T10:00' } }, 400, /Dauer/],
    [{ schritt: 'termin', termin: { art: 'video', dauer: 30, start: '2026-10-05' } }, 400, /Wann/],
    [{ schritt: 'termin', termin: { art: 'video', dauer: 30, start: '2026-09-20T10:00' } }, 400, /Vergangenheit/],
    [{ schritt: 'vermitteln' }, 400, /vermitteln/],
    [{ schritt: 'andere', andere: { text: 'x' } }, 400, /getan/],
  ])('lehnt ab: %j', (x, status, text) => {
    const r = pruefen(x as Record<string, unknown>);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(status); expect(r.fehler).toMatch(text); }
  });
  it('„diesen nehmen“ braucht keinen Nachnamen; alte Erfassungen werden nicht in die Zukunft/Vergangenheit datiert', () => {
    expect(pruefen({ vorhandenKontaktId: 'c-abc-1234', kontakt: {} }).ok).toBe(true);
    const zukunft = pruefen({ erfasstAm: '2027-01-01T00:00:00Z' });
    const alt = pruefen({ erfasstAm: '2026-08-01T00:00:00Z' });
    if (zukunft.ok && alt.ok) { expect(zukunft.wert.erfasstAm).toBe(jetzt.toISOString()); expect(alt.wert.erfasstAm).toBe(jetzt.toISOString()); }
    const gestern = pruefen({ erfasstAm: '2026-10-01T18:00:00Z' });
    if (gestern.ok) expect(gestern.wert.erfasstAm).toBe('2026-10-01T18:00:00.000Z');
  });
  it('Termin: Wandzeit + Dauer, Mitternacht inklusive', () => {
    expect(wandPlusMinuten('2026-10-05T10:00', 45)).toBe('2026-10-05T10:45');
    expect(wandPlusMinuten('2026-10-05T23:45', 30)).toBe('2026-10-06T00:15');
  });
  it('alle acht Schritte sind in der Liste (Reihenfolge wie im Auftrag)', () => {
    expect(SCHRITTE.map(s => s.label)).toEqual(['Termin', 'Qualifizieren', 'Follow-up', 'Vermitteln', 'Andere', 'Angebot schicken', 'Zu Make.One einladen', 'Nur Kontakt']);
  });
});

describe('Kennen wir schon?', () => {
  const liste: Kontakt[] = [
    k('c-1', 'Anna', 'Beispiel', 'Beispielwerk Nord GmbH', { email: 'anna.beispiel@example.invalid', telefon: '+49 221 1234567', besitzer: 'malin', letzterKontakt: '2026-09-20' }),
    k('c-2', 'Dr. Bert', 'Müller', 'Musterhandel AG', { email: 'info@musterhandel.example.invalid' }),
    k('c-3', 'Carla', 'Probe', 'Probe & Söhne'),
    k('c-4', 'Anna', 'Beispiel', 'Andere Firma KG'),
    k('c-5', 'Eva', 'Gesperrt', 'Firma Z', { eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'kevin' } }),
  ];
  it('Mail, Telefon, Name + Firma, ähnlicher Name, nur Name — in dieser Stärke', () => {
    expect(kenntWirSchon({ email: 'ANNA.Beispiel@example.invalid' }, liste)[0]).toMatchObject({ staerke: 'mail', grund: 'gleiche E-Mail-Adresse' });
    expect(kenntWirSchon({ mobil: '0221 12 34 567' }, liste)[0]).toMatchObject({ staerke: 'telefon' });
    const nf = kenntWirSchon({ vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord' }, liste);
    expect(nf[0]).toMatchObject({ staerke: 'name-firma' });
    expect(nf[1]).toMatchObject({ staerke: 'name' }); // dieselbe Person in „Andere Firma KG“
    expect(kenntWirSchon({ vorname: 'Karla', nachname: 'Probe', firma: 'Probe und Söhne' }, liste)[0]).toMatchObject({ staerke: 'aehnlich' });
    expect(kenntWirSchon({ vorname: 'Anna', nachname: 'Beispiel' }, liste, 5).map(t => t.grund)).toEqual(['gleicher Name', 'gleicher Name']); // ohne Firma: nicht „andere Firma“
  });
  it('tolerant: Titel, Umlaute, Rechtsform, abgekürzter Vorname', () => {
    expect(kenntWirSchon({ vorname: 'Bert', nachname: 'Mueller', firma: 'Musterhandel' }, liste)[0]).toMatchObject({ staerke: 'name-firma', kontakt: { id: 'c-2' } });
    expect(kenntWirSchon({ vorname: 'A.', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH' }, liste)[0]).toMatchObject({ staerke: 'name-firma', kontakt: { id: 'c-1' } });
  });
  it('Sammeladressen (info@) sind kein Beweis; leere/kurze Eingaben finden nichts', () => {
    expect(kenntWirSchon({ email: 'info@musterhandel.example.invalid' }, liste)).toEqual([]);
    expect(kenntWirSchon({}, liste)).toEqual([]);
    expect(kenntWirSchon({ vorname: 'A', nachname: 'B' }, liste)).toEqual([]);
    expect(kenntWirSchon({ nachname: 'Pr' }, liste)).toEqual([]);
  });
  it('Art. 18: eingeschränkte Person wird als „gesperrt“ gemeldet — nicht auswählbar', () => {
    const t = kenntWirSchon({ vorname: 'Eva', nachname: 'Gesperrt', firma: 'Firma Z' }, liste)[0];
    expect(t).toMatchObject({ gesperrt: true, staerke: 'name-firma' });
  });
  it('Zeile „Kennen wir schon: Name · Firma · zuständig X · zuletzt Datum“', () => {
    const t = kenntWirSchon({ email: 'anna.beispiel@example.invalid' }, liste)[0];
    expect(kennenText(t, id => ({ malin: 'Malin Test', kevin: 'Kevin Test' }[id] ?? id))).toEqual({ name: 'Anna Beispiel', firma: 'Beispielwerk Nord GmbH', zustaendig: 'Malin Test', zuletzt: '2026-09-20' });
  });
  it('Editierabstand', () => { expect(abstand('anna', 'anna')).toBe(0); expect(abstand('carla', 'karla')).toBe(1); expect(abstand('abcdef', 'uvwxyz')).toBeGreaterThan(2); });
  it('Firma: genau (ohne Rechtsform) zuerst, dann Teilübereinstimmung', () => {
    const firmen = [{ id: 'f-a', name: 'Beispielwerk Nord GmbH' }, { id: 'f-b', name: 'Beispielwerk Süd' }, { id: 'f-c', name: 'Anderes' }] as Firma[];
    expect(firmaVorschlaege('beispielwerk nord', firmen).map(v => [v.firma.id, v.exakt])).toEqual([['f-a', true]]);
    expect(firmaVorschlaege('Beispielwerk', firmen).map(v => v.firma.id)).toEqual(['f-a', 'f-b']);
    expect(firmaVorschlaege('x', firmen)).toEqual([]);
  });
  it('Stadt aus der Anschrift — nur mit PLZ, nie geraten', () => {
    expect(stadtAusAnschrift('Teststraße 1\n50667 Köln')).toBe('Köln');
    expect(stadtAusAnschrift('Teststraße 1')).toBeUndefined();
  });
});

describe('Frist', () => {
  it('+2 Werktage; Wochenende und Feiertag NRW zählen nicht mit', () => {
    expect(followupFrist('2026-10-02')).toBe('2026-10-06'); // Fr → Di (Sa/So)
    expect(followupFrist('2026-10-30')).toBe('2026-11-03'); // Fr → Di; 31.10. Sa, 01.11. (Allerheiligen, NRW) ist ein Sonntag
    expect(followupFrist('2026-10-01')).toBe('2026-10-05'); // Do → Mo
  });
});

describe('Danke-Mail', () => {
  const ev: Event = { id: 'ev-1', titel: 'Stammtisch Beispielstadt', format: 'stammtisch', ziel: 'x', datum: '2026-10-02', status: 'durchgefuehrt', geaendert: '2026-10-02' };
  const t = (kid: string, x: Partial<Teilnahme> = {}, n: Record<string, unknown> = {}): Teilnahme => ({ id: `t-${kid}`, eventId: 'ev-1', kontaktId: kid, status: 'da', geaendert: '2026-10-02', netzwerken: { erfassungId: ID, schritt: 'followup', zustaendig: 'malin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T17:00:00.000Z', ...n } as Teilnahme['netzwerken'], ...x });
  const kontakte = [
    k('c-1', 'Anna', 'Beispiel', 'X', { email: 'anna@example.invalid', stufe: 'gespraech' }),
    k('c-2', 'Bert', 'Ohnemail', 'X'),
    k('c-3', 'Carla', 'Gesperrt', 'X', { email: 'carla@example.invalid', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-4', 'Dora', 'Eingeschränkt', 'X', { email: 'dora@example.invalid', eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'kevin' } }),
    k('c-5', 'Emil', 'Fertig', 'X', { email: 'emil@example.invalid', stufe: 'gespraech' }),
  ];
  const teilnahmen = [t('c-1'), t('c-2'), t('c-3'), t('c-4'), t('c-5', {}, { danke: { anrede: 'Du', rausAm: '2026-10-03' } })];
  it('ab dem Folgetag: Entwurf je Person mit Adresse; vorher nichts; Art. 18 nie; Werbesperre/ohne Mail ohne Versand', () => {
    expect(dankeZeilen({ events: [ev], teilnahmen, kontakte, heute: '2026-10-02' })).toEqual([]);
    const z = dankeZeilen({ events: [ev], teilnahmen, kontakte, heute: '2026-10-03' });
    expect(z.map(x => x.kontakt.id)).toEqual(['c-1', 'c-2', 'c-3', 'c-5']); // c-4 (Art. 18) fehlt
    expect(z.find(x => x.kontakt.id === 'c-1')).toMatchObject({ mailOk: true });
    expect(z.find(x => x.kontakt.id === 'c-2')).toMatchObject({ mailOk: false, mailGrund: 'keine E-Mail' });
    expect(z.find(x => x.kontakt.id === 'c-3')).toMatchObject({ mailOk: false });
    expect(z.find(x => x.kontakt.id === 'c-3')?.mailGrund).toMatch(/Werbesperre/);
    expect(z.find(x => x.kontakt.id === 'c-5')?.raus).toBe('2026-10-03');
    expect(dankeOffen(z)).toBe(1); // nur Anna: Adresse, nicht gesperrt, nicht raus
  });
  it('nur die eigenen (wer kennengelernt hat) mit `person`; je Event filterbar', () => {
    expect(dankeZeilen({ events: [ev], teilnahmen, kontakte, heute: '2026-10-03', person: 'malin' })).toEqual([]);
    expect(dankeZeilen({ events: [ev], teilnahmen, kontakte, heute: '2026-10-03', person: 'kevin' })).toHaveLength(4);
    expect(dankeZeilen({ events: [ev], teilnahmen, kontakte, heute: '2026-10-03', eventId: 'ev-2' })).toEqual([]);
  });
  it('die Kanal-Ampel erlaubt die persönliche Nachricht an eine bekannte Person (gelb), nie Werbung', () => {
    expect(kanalStatus(kontakte[0], 'mail').farbe).toBe('gelb');
  });
  it('Entwurf Du und Sie, mit Schritt-Satz — und nie Werbung', () => {
    const du = dankeEntwurf({ vorname: 'Anna', nachname: 'Beispiel', anrede: 'Du', eventTitel: 'Stammtisch Beispielstadt', wann: 'gestern', schritt: 'termin', terminAm: '2026-10-05T10:30', absender: 'Kevin' });
    expect(du.betreff).toBe('Danke für das Gespräch bei Stammtisch Beispielstadt');
    expect(du.text).toBe('Hallo Anna,\n\nschön, dich gestern bei Stammtisch Beispielstadt kennengelernt zu haben.\nDanke für das Gespräch — ich habe es gern geführt.\n\nWie besprochen: Unser Termin ist am Montag, 05.10. um 10:30 Uhr.\n\nBis bald und viele Grüße\nKevin');
    const sie = dankeEntwurf({ vorname: 'Anna', nachname: 'Beispiel', anrede: 'Sie', eventTitel: 'Stammtisch Beispielstadt', wann: 'gestern', schritt: 'followup', absender: 'Kevin' });
    expect(sie.text).toContain('Guten Tag Anna Beispiel,');
    expect(sie.text).toContain('schön, Sie gestern bei Stammtisch Beispielstadt kennengelernt zu haben.');
    expect(sie.text).toContain('Ich melde mich in den nächsten Tagen bei Ihnen.');
    expect(sie.text).toContain('Mit freundlichen Grüßen\nKevin');
    for (const e of [du, sie]) expect(e.text).not.toMatch(/Angebot|Newsletter|jetzt buchen|kostenlos|Rabatt/i);
    expect(dankeEntwurf({ nachname: 'Beispiel', anrede: 'Du', eventTitel: 'X', wann: 'neulich', absender: 'Kevin' }).text).toContain('Hallo Beispiel,');
  });
  it('mailto-Link nur für eine plausible Adresse, Text kodiert', () => {
    const l = dankeMailtoLink('anna@example.invalid', { betreff: 'Danke & Gruß', text: 'Zeile 1\nZeile 2' })!;
    expect(l).toBe('mailto:anna@example.invalid?subject=Danke%20%26%20Gru%C3%9F&body=Zeile%201%0AZeile%202');
    expect(dankeMailtoLink('kaputt', { betreff: 'x', text: 'y' })).toBeNull();
    expect(dankeMailtoLink(undefined, { betreff: 'x', text: 'y' })).toBeNull();
  });
});

describe('Folgetag zählt in Berlin', () => {
  it('eine Erfassung kurz nach Mitternacht Berliner Zeit (UTC noch am Vortag) ist am selben Berliner Tag noch „ab morgen“', () => {
    const ev: Event = { id: 'ev-1', titel: 'S', format: 'stammtisch', ziel: 'x', datum: '2026-10-03', status: 'durchgefuehrt', geaendert: '2026-10-03' };
    const te = [{ id: 't1', eventId: 'ev-1', kontaktId: 'c-1', status: 'da', geaendert: 'x', netzwerken: { erfassungId: ID, schritt: 'followup', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T22:30:00.000Z' } }] as Teilnahme[];
    const ko = [k('c-1', 'Anna', 'Eins', 'X', { email: 'a@example.invalid', stufe: 'gespraech' })];
    expect(dankeZeilen({ events: [ev], teilnahmen: te, kontakte: ko, heute: '2026-10-03' })).toEqual([]);
    expect(dankeZeilen({ events: [ev], teilnahmen: te, kontakte: ko, heute: '2026-10-04' })).toHaveLength(1);
    expect(berichtAus({ event: ev, teilnahmen: te, kontakte: ko, heute: '2026-10-03' }).zeilen[0].offen).toContain('Danke-Mail ab morgen');
  });
});

describe('Abendbericht', () => {
  const ev: Event = { id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-02', status: 'durchgefuehrt', geaendert: '2026-10-02' };
  const t = (kid: string, schritt: string, zust: string, n: Record<string, unknown> = {}): Teilnahme => ({ id: `t-${kid}`, eventId: 'ev-1', kontaktId: kid, status: 'da', geaendert: '2026-10-02', netzwerken: { erfassungId: ID, schritt, zustaendig: zust, erfasstVon: 'kevin', erfasstAm: `2026-10-02T1${kid.slice(-1)}:00:00.000Z`, ...n } as Teilnahme['netzwerken'] });
  it('wer, welcher Schritt, wer zuständig, was offen ist — nach Zeit, je Person gezählt', () => {
    const kontakte = [k('c-1', 'Anna', 'Eins', 'X', { email: 'a@example.invalid' }), k('c-2', 'Bert', 'Zwei', 'Y'), k('c-3', 'Carla', 'Drei', 'Z', { email: 'c@example.invalid', eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'k' } })];
    const fu = [{ id: 'fu-1', kontaktId: 'c-1', status: 'offen' }] as FollowUp[];
    const b = berichtAus({ event: ev, teilnahmen: [t('c-2', 'angebot', 'malin'), t('c-1', 'followup', 'kevin', { info: 'Studie' }), t('c-3', 'nur-kontakt', 'kevin')], kontakte, followups: fu, heute: '2026-10-02' });
    expect(b.zeilen.map(z => z.name)).toEqual(['Anna Eins', 'Bert Zwei', 'Carla Drei']);
    expect(b.zeilen[0]).toMatchObject({ schrittText: 'Follow-up', zustaendig: 'kevin', info: 'Studie', offen: ['Danke-Mail ab morgen', 'Follow-up offen'] });
    expect(b.zeilen[1].offen).toEqual(['keine E-Mail — keine Danke-Mail', 'Angebot nur als Entwurf']);
    expect(b.zeilen[2].offen).toEqual(['Verarbeitung eingeschränkt (Art. 18)']);
    expect(b.jePerson).toEqual({ kevin: 2, malin: 1 });
    expect(b.offenGesamt).toBe(5);
    const morgen = berichtAus({ event: ev, teilnahmen: [t('c-1', 'followup', 'kevin')], kontakte, heute: '2026-10-03' });
    expect(morgen.zeilen[0].offen).toContain('Danke-Mail offen');
  });
});

describe('Angabe an der Teilnahme säubern', () => {
  it('behält Gültiges, verwirft Unsinn', () => {
    const gut = { erfassungId: ID, schritt: 'termin', zustaendig: 'malin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T09:00:00.000Z', info: 'x', terminAm: '2026-10-05T10:00', danke: { anrede: 'Du', rausAm: '2026-10-03', evil: 1 } };
    expect(netzwerkenAngabeSaeubern(gut)).toEqual({ ...gut, danke: { anrede: 'Du', rausAm: '2026-10-03' } });
    expect(netzwerkenAngabeSaeubern({ ...gut, schritt: 'quatsch' })).toBeUndefined();
    expect(netzwerkenAngabeSaeubern({ ...gut, erfassungId: 'x' })).toBeUndefined();
    expect(netzwerkenAngabeSaeubern({ ...gut, zustaendig: 'A B' })).toBeUndefined();
    expect(netzwerkenAngabeSaeubern(null)).toBeUndefined();
    expect(netzwerkenAngabeSaeubern({ ...gut, terminAm: 'morgen', danke: undefined })).toEqual({ erfassungId: ID, schritt: 'termin', zustaendig: 'malin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T09:00:00.000Z', info: 'x' });
  });
  it('ein Event unterwegs: heute → durchgeführt, später → geplant, Marke „Netzwerken“', () => {
    const e = neuesEvent({ id: 'ev-x', titel: 'Mixer', datum: '2026-10-02', person: 'kevin', heute: '2026-10-02', jetztIso: '2026-10-02T09:00:00.000Z' });
    expect(e).toMatchObject({ status: 'durchgefuehrt', marke: 'Netzwerken', zustaendig: 'kevin', format: 'sonstig' });
    expect(neuesEvent({ id: 'ev-y', titel: 'Später', datum: '2026-10-09', person: 'kevin', heute: '2026-10-02', jetztIso: 'x' }).status).toBe('geplant');
  });
});

describe('Karte automatisch auslesen: vorbereitet, aus', () => {
  it('liefert heute nichts; übernimmt später nur in leere Felder', async () => {
    expect(KARTE_AUSLESEN_AN).toBe(false);
    expect(await karteAuslesen([{ daten: JPEG, typ: 'image/jpeg' }])).toBeNull();
    expect(ausgelesenesUebernehmen({ anrede: 'Sie', vorname: 'Anna' }, null)).toEqual({ anrede: 'Sie', vorname: 'Anna' });
    expect(ausgelesenesUebernehmen({ anrede: 'Sie', vorname: 'Anna' }, { vorname: 'Anja', nachname: 'Beispiel', position: '  ' })).toEqual({ anrede: 'Sie', vorname: 'Anna', nachname: 'Beispiel' });
  });
});

describe('Sprachnotiz am Inhalt erkennen', () => {
  const b = (...x: number[]) => new Uint8Array([...x, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  it('webm, mp4/m4a, ogg, wav, mp3, aac — alles andere nicht', () => {
    expect(sprachnotizTypErkennen(b(0x1a, 0x45, 0xdf, 0xa3))).toBe('audio/webm');
    expect(sprachnotizTypErkennen(b(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70))).toBe('audio/mp4');
    expect(sprachnotizTypErkennen(b(0x4f, 0x67, 0x67, 0x53))).toBe('audio/ogg');
    expect(sprachnotizTypErkennen(b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBe('audio/wav');
    expect(sprachnotizTypErkennen(b(0x49, 0x44, 0x33))).toBe('audio/mpeg');
    expect(sprachnotizTypErkennen(b(0xff, 0xfb))).toBe('audio/mpeg');
    expect(sprachnotizTypErkennen(b(0xff, 0xf1))).toBe('audio/aac');
    expect(sprachnotizTypErkennen(b(0xff, 0xd8, 0xff))).toBeNull(); // JPEG
    expect(sprachnotizTypErkennen(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('Glocke: Art „netzwerken“ und „n Danke-Mails bereit“', () => {
  it('Meldung der Art netzwerken mit Bezug ist gültig; Link muss ein Weg in MAKE OS sein', () => {
    expect(ARTEN).toContain('netzwerken');
    expect(pruefeEingabe({ an: 'malin', art: 'netzwerken', titel: 'Kevin hat dir einen Termin gebucht', link: '/os/kalender?tag=2026-10-05', von: 'kevin', bezug: { art: 'netzwerken', id: ID } })).toEqual({ ok: true });
    expect(pruefeEingabe({ an: 'malin', art: 'netzwerken', titel: 'x', link: 'https://example.invalid', von: 'kevin' }).ok).toBe(false);
  });
  it('abgeleitet je Event mit der Zahl in der Kennung; ohne offene keine Meldung', () => {
    const leer = { termine: [], nachbereiten: [], fristen: [], followups: [] };
    const o = { heute: '2026-10-03', jetztWand: '2026-10-03T09:00:00', am: '2026-10-02T22:00:00.000Z' };
    const m = anstehendAbleiten({ ...leer, danke: [{ id: 'danke-ev-1', n: 3, eventTitel: 'Stammtisch', href: '/os/netzwerken?bericht=ev-1' }, { id: 'danke-ev-2', n: 0, eventTitel: 'Leer', href: '/os/netzwerken?bericht=ev-2' }] }, o);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ art: 'danke', titel: '3 Danke-Mails bereit — Stammtisch', link: '/os/netzwerken?bericht=ev-1', virtuell: true, id: 'danke:2026-10-03:danke-ev-1-3' });
    expect(anstehendAbleiten({ ...leer, danke: [{ id: 'danke-ev-1', n: 1, eventTitel: 'S', href: '/os/netzwerken' }] }, o)[0].titel).toBe('1 Danke-Mail bereit — S');
    expect(anstehendAbleiten(leer, o)).toEqual([]);
  });
});

describe('Bewertung und Warteschlange (Offline-Sicherheit)', () => {
  it('Netz/Server → wiederholen, Eingabefehler → Fehler, veralteter Tab → neu laden, ok → erledigt', () => {
    expect(bewerten(200, { ok: true })).toEqual({ art: 'erledigt' });
    expect(bewerten(0, null)).toMatchObject({ art: 'wiederholen', grund: WARTET_TEXT });
    expect(bewerten(500, { fehler: 'Gerade nicht möglich' })).toMatchObject({ art: 'wiederholen' });
    expect(bewerten(502, null)).toMatchObject({ art: 'wiederholen' });
    expect(bewerten(429, null)).toMatchObject({ art: 'wiederholen' });
    expect(bewerten(401, null)).toMatchObject({ art: 'wiederholen' });
    expect(bewerten(409, { ok: false, neuLaden: true })).toMatchObject({ art: 'neuladen' });
    expect(bewerten(409, { ok: false, fehler: 'Kein Kalender' })).toEqual({ art: 'fehler', text: 'Kein Kalender' });
    expect(bewerten(400, { fehler: 'Nachname fehlt' })).toEqual({ art: 'fehler', text: 'Nachname fehlt' });
    expect(bewerten(403, null)).toEqual({ art: 'fehler', text: 'Nicht gespeichert (Fehler 403).' });
  });

  const anzeige = { name: 'Anna Beispiel', schritt: 'Follow-up', eventTitel: 'Stammtisch' };
  const koerper = (id: string) => ({ erfassungId: id, bilder: [{ daten: JPEG }] });
  /** Ein Server, der zählt, was bei ihm ankam — idempotent über die Kennung wie der echte. */
  const server = (verhalten: (n: number) => { status: number; daten?: unknown } | 'netz') => {
    const gesehen = new Set<string>(); const aufrufe: string[] = []; let n = 0;
    const sender: Sender = async kp => {
      aufrufe.push(String(kp.erfassungId));
      const v = verhalten(++n);
      if (v === 'netz') throw new TypeError('Failed to fetch');
      if (v.status === 200) gesehen.add(String(kp.erfassungId));
      return { status: v.status, daten: v.daten ?? (v.status === 200 ? { ok: true } : { ok: false }) };
    };
    return { sender, gesehen, aufrufe };
  };

  it('ohne Netz bleibt alles liegen („wird gesendet, sobald Netz da ist“) und geht beim Wiederkehren genau einmal raus', async () => {
    const s = server(n => (n <= 2 ? 'netz' : { status: 200 }));
    const q = new Warteschlange(ramSpeicher(), s.sender);
    await q.ablegen(koerper('e1'), anzeige);
    const r1 = await q.senden();
    expect(r1).toMatchObject({ gesendet: [], wartend: 1 });
    expect((await q.alle())[0]).toMatchObject({ status: 'wartet', versuche: 1, hinweis: WARTET_TEXT });
    expect((await q.senden()).wartend).toBe(1);
    const r3 = await q.senden();
    expect(r3.gesendet.map(e => e.id)).toEqual(['e1']);
    expect(await q.alle()).toEqual([]);
    expect(s.gesehen.size).toBe(1);
    // nichts mehr zu senden → kein weiterer Aufruf
    const vorher = s.aufrufe.length;
    await q.senden();
    expect(s.aufrufe.length).toBe(vorher);
  });

  it('dieselbe Erfassung zweimal abgelegt = ein Eintrag; Reihenfolge ältestes zuerst; beim ersten Netzfehler Schluss', async () => {
    const s = server(n => (n === 2 ? 'netz' : { status: 200 }));
    const q = new Warteschlange(ramSpeicher(), s.sender);
    await q.ablegen(koerper('a'), anzeige, 1000);
    await q.ablegen(koerper('a'), anzeige, 2000);
    await q.ablegen(koerper('b'), anzeige, 3000);
    await q.ablegen(koerper('c'), anzeige, 4000);
    expect((await q.alle()).map(e => e.id)).toEqual(['a', 'b', 'c']);
    const r = await q.senden();
    expect(r.gesendet.map(e => e.id)).toEqual(['a']);
    expect(s.aufrufe).toEqual(['a', 'b']); // bei b fiel das Netz weg — c wurde gar nicht erst versucht
    expect(r.wartend).toBe(2);
  });

  it('Server-5xx: bleibt und wird wiederholt; 400: „Fehler“ mit Klartext, geht nicht verloren, die übrigen laufen weiter; „erneut“ gibt frei', async () => {
    let fehlerFall = true;
    const s = server(n => (n === 1 ? { status: 500, daten: { ok: false, fehler: 'Gerade nicht möglich' } } : n === 2 ? { status: 400, daten: { ok: false, fehler: 'Nachname fehlt — bitte eintragen.' } } : fehlerFall ? { status: 200 } : { status: 200 }));
    const q = new Warteschlange(ramSpeicher(), s.sender);
    await q.ablegen(koerper('x1'), anzeige, 1);
    await q.ablegen(koerper('x2'), anzeige, 2);
    const r1 = await q.senden();
    expect(r1.gesendet).toEqual([]); // 500 → Schluss
    expect((await q.alle())[0]).toMatchObject({ id: 'x1', status: 'wartet', hinweis: 'Gerade nicht möglich' });
    const r2 = await q.senden(); // x1: 400 → Fehler, dann x2: 200
    expect(r2.gesendet.map(e => e.id)).toEqual(['x2']);
    const rest = await q.alle();
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({ id: 'x1', status: 'fehler', hinweis: 'Nachname fehlt — bitte eintragen.' });
    expect(r2.fehler).toBe(1);
    // ein Fehler wird nicht automatisch wiederholt …
    const vorher = s.aufrufe.length;
    await q.senden();
    expect(s.aufrufe.length).toBe(vorher);
    // … aber auf Wunsch
    fehlerFall = false;
    await q.erneut('x1');
    expect((await q.senden()).gesendet.map(e => e.id)).toEqual(['x1']);
  });

  it('veralteter Tab (neu laden): bleibt liegen, Meldung steht im Ergebnis', async () => {
    const s = server(() => ({ status: 409, daten: { ok: false, neuLaden: true } }));
    const q = new Warteschlange(ramSpeicher(), s.sender);
    await q.ablegen(koerper('n1'), anzeige);
    const r = await q.senden();
    expect(r).toMatchObject({ neuLaden: true, wartend: 1 });
    expect((await q.alle())[0].hinweis).toMatch(/neu laden/);
  });

  it('kommt während eines Laufs etwas Neues dazu, wird es im selben Lauf noch gesendet; parallele Aufrufe senden nichts doppelt', async () => {
    const s = server(() => ({ status: 200 }));
    const q = new Warteschlange(ramSpeicher(), s.sender);
    await q.ablegen(koerper('p1'), anzeige, 1);
    const lauf = q.senden();
    await q.ablegen(koerper('p2'), anzeige, 2);
    const zweiter = q.senden(); // läuft schon → merkt „nochmal“
    await Promise.all([lauf, zweiter]);
    expect((await q.alle())).toEqual([]);
    expect(s.aufrufe.sort()).toEqual(['p1', 'p2']);
  });
});

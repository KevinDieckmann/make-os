// ─── Anfragen-Eingang (27.09.): aus einer Eingabe Person, Aktivität, Einwilligung, Wirkung, Follow-up, Lead — rein, ohne Dateien. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { anfrageBauen, anfragenListe, stufeNachAnfrage, leadNachAnfrage, anfrageText, ANFRAGE_KANAELE, type AnfrageKontext } from '../lib/crm/anfragen';
import { istAnfrage, ANFRAGE_FOLLOWUP } from '../lib/crm/marketing';

const HEUTE = '2026-09-27', JETZT = `${HEUTE}T10:00:00.000Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const crm = (x: Partial<CrmBestand> = {}): CrmBestand => ({
  ...leererBestand(),
  firmen: [{ id: 'f-kunde', name: 'Kunde GmbH', rolle: 'zielkunde', geaendert: HEUTE }, { id: 'f-quali', name: 'Quali AG', rolle: 'zielkunde', lead: { status: 'qualifizierung', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, geaendert: HEUTE }],
  beitraege: [{ id: 'bt-1', titel: 'Liquidität in 90 Tagen', kanal: 'linkedin', status: 'veroeffentlicht', datum: '2026-09-20', wirkung: [], quellen: [], geaendert: HEUTE }],
  kampagnen: [{ id: 'kp-1', name: 'Reaktivierung', playbook: 'reaktivierung', ziel: '', zielgruppe: {}, kanal: 'telefon', status: 'entwurf', schritte: [], kontaktIds: ['c-alt'], ergebnisse: [], von: 'hand', geaendert: HEUTE }],
  events: [{ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-09-20', status: 'durchgefuehrt', geaendert: HEUTE }],
  ...x,
});
const ctx = (kontakte: Kontakt[], c = crm()): AnfrageKontext => ({ kontakte, crm: c, person: 'malin', heute: HEUTE, jetzt: JETZT, ids: { kontakt: 'c-neu1', followUp: 'fu-neu1' } });

describe('Anfrage — neue Person', () => {
  const r = anfrageBauen({ neu: { vorname: 'Anna', nachname: 'Neu', email: 'Anna@Beispiel.de', firma: 'Neu GmbH' }, kanal: 'website', text: '  Wir brauchen Hilfe beim Liquiditätsplan.  ' }, ctx([]));
  it('legt die Person an: herkunft selbst, Grundlage Vertrag/Anbahnung, Interessent, Stufe angesprochen, Beziehung bei der erfassenden Person', () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.bau.kontakt;
    expect(r.bau.neuePerson).toBe(true);
    expect(p).toMatchObject({ id: 'c-neu1', vorname: 'Anna', nachname: 'Neu', email: 'anna@beispiel.de', firma: 'Neu GmbH', herkunft: 'selbst', rechtsgrundlage: 'vertrag', lebensphase: 'interessent', stufe: 'angesprochen', besitzer: 'malin', letzterKontakt: HEUTE, importiertAm: HEUTE });
    expect(p.firmaId).toBeUndefined(); // „Neu GmbH“ gibt es nicht als Firma — kein erfundener Verweis
    expect(p.fremddaten).toBeUndefined();
  });
  it('schreibt die Aktivität mit der Marke „Anfrage über …“ und die Einwilligung „Antwort auf Anfrage“ für Mail', () => {
    if (!r.ok) return;
    const a = r.bau.kontakt.aktivitaeten;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'antwort', von: 'malin', text: 'Anfrage über Website: Wir brauchen Hilfe beim Liquiditätsplan.' });
    expect(istAnfrage(a[0])).toBe(true);
    expect(r.bau.kontakt.einwilligungen).toEqual([{ kanal: 'mail', grundlage: 'anfrage', erteiltAm: HEUTE, nachweis: `Anfrage über Website am ${HEUTE}` }]);
  });
  it('Lead an der Person (keine Firma): kontaktiert mit Notiz; Follow-up „Anfrage beantworten“ heute, Art Mail, Quelle Hand', () => {
    if (!r.ok) return;
    expect(r.bau.kontakt.lead).toMatchObject({ status: 'kontaktiert', notiz: `Anfrage über Website (${HEUTE})`, geaendertVon: 'malin' });
    expect(r.bau.firmaLead).toBeUndefined();
    expect(r.bau.followUp).toMatchObject({ id: 'fu-neu1', kontaktId: 'c-neu1', bezug: { art: 'kontakt', id: 'c-neu1' }, art: 'mail', faellig: HEUTE, status: 'offen', quelle: 'hand', zustaendig: 'malin', notiz: 'Wir brauchen Hilfe beim Liquiditätsplan.' });
    expect(r.bau.followUp.text.startsWith(ANFRAGE_FOLLOWUP)).toBe(true);
    expect(r.bau.wirkung).toBeUndefined();
  });
  it('gleiche Mail = dieselbe Person: nichts Doppeltes, dafür ein Hinweis', () => {
    const alt = k('alt', { email: 'anna@beispiel.de', stufe: 'gespraech', besitzer: 'kevin' });
    const x = anfrageBauen({ neu: { vorname: 'Anna', email: 'ANNA@beispiel.de' }, kanal: 'mail', text: 'Nochmal' }, ctx([alt]));
    expect(x.ok && !x.bau.neuePerson && x.bau.kontakt.id === 'c-alt' && !!x.bau.hinweis).toBe(true);
    if (x.ok) { expect(x.bau.kontakt.stufe).toBe('gespraech'); expect(x.bau.followUp.zustaendig).toBe('kevin'); }
  });
  // Kevin 07.10.: Dubletten über die Telefonnummer auch beim Kanal „Telefon“ (nicht nur WhatsApp).
  it('Telefon: gleiche Nummer = dieselbe Person (Hinweis); mehrere Akten mit der Nummer → klare Ablehnung; gleiche Mail hat Vorrang', () => {
    const mitNr = k('alt', { email: 'anna@beispiel.de', stufe: 'gespraech', besitzer: 'kevin', telefon: '+49 151 12345678' });
    const x = anfrageBauen({ neu: { nachname: 'Unbekannt', telefon: '0151 12345678' }, kanal: 'telefon', text: 'Rückruf' }, ctx([mitNr]));
    expect(x.ok && !x.bau.neuePerson && x.bau.kontakt.id === 'c-alt' && /gleiche Nummer/.test(x.bau.hinweis ?? '')).toBe(true);
    const zwei = [mitNr, { ...mitNr, id: 'c-zwei', email: 'zwei@beispiel.de' } as Kontakt];
    const y = anfrageBauen({ neu: { nachname: 'Unbekannt', telefon: '+4915112345678' }, kanal: 'telefon', text: 'Rückruf' }, ctx(zwei));
    expect(y.ok).toBe(false); if (!y.ok) expect(y.fehler).toMatch(/mehreren Personen/);
    const z = anfrageBauen({ neu: { vorname: 'Zwei', email: 'zwei@beispiel.de', telefon: '+4915112345678' }, kanal: 'telefon', text: 'Rückruf' }, ctx(zwei));
    expect(z.ok && z.bau.kontakt.id === 'c-zwei').toBe(true);
  });
  it('ordnet eine bekannte Firma per Namen zu und stellt deren Lead auf kontaktiert', () => {
    const x = anfrageBauen({ neu: { nachname: 'Müller', firma: 'kunde gmbh' }, kanal: 'telefon', text: 'Rückruf erbeten' }, ctx([]));
    expect(x.ok).toBe(true);
    if (!x.ok) return;
    expect(x.bau.kontakt).toMatchObject({ firma: 'Kunde GmbH', firmaId: 'f-kunde' });
    expect(x.bau.kontakt.lead).toBeUndefined();
    expect(x.bau.firmaLead).toMatchObject({ firmaId: 'f-kunde', lead: { status: 'kontaktiert' } });
    // Telefon ohne Nummer: keine Einwilligung erfinden.
    expect(x.bau.kontakt.einwilligungen).toBeUndefined();
    expect(x.bau.followUp.art).toBe('anruf');
  });
});

describe('Anfrage — vorhandene Person und Bezüge', () => {
  it('Beitrag als Bezug: Wirkung „anfrage“ am Beitrag, Aktivität mit Bezug, Nachweis nennt den Beitrag', () => {
    const p = k('p', { email: 'p@x.de', firmaId: 'f-quali', stufe: 'termin' });
    const r = anfrageBauen({ kontaktId: 'c-p', kanal: 'linkedin', bezug: { art: 'beitrag', id: 'bt-1' }, text: 'Spannender Beitrag — können wir sprechen?', datum: '2026-09-25' }, ctx([p]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.wirkung).toEqual({ beitragId: 'bt-1', eintrag: { kontaktId: 'c-p', art: 'anfrage', am: '2026-09-25', notiz: 'Spannender Beitrag — können wir sprechen?' } });
    expect(r.bau.kontakt.aktivitaeten[0]).toMatchObject({ bezug: 'bt-1', am: '2026-09-25T12:00:00.000Z' });
    expect(r.bau.kontakt.stufe).toBe('termin');            // wer weiter ist, bleibt
    expect(r.bau.kontakt.letzterKontakt).toBe('2026-09-25');
    expect(r.bau.kontakt.einwilligungen?.[0]).toMatchObject({ kanal: 'social', grundlage: 'anfrage', erteiltAm: '2026-09-25' });
    expect(r.bau.firmaLead).toBeUndefined();               // Firma ist schon in der Qualifizierung — nichts zurücksetzen
    expect(r.bau.followUp.faellig).toBe(HEUTE);            // beantwortet wird heute, nicht rückdatiert
  });
  it('Kampagne als Bezug: Quelle des Follow-ups „kampagne“, Person kommt dazu, Ergebnis „reagiert“', () => {
    const p = k('p');
    const r = anfrageBauen({ kontaktId: 'c-p', kanal: 'empfehlung', bezug: { art: 'kampagne', id: 'kp-1' }, text: 'Kam über Herrn X' }, ctx([p]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.followUp.quelle).toBe('kampagne');
    expect(r.bau.kampagne).toEqual({ id: 'kp-1', kontaktIds: ['c-alt', 'c-p'], ergebnis: { kontaktId: 'c-p', ergebnis: 'reagiert', am: HEUTE, von: 'malin' } });
    expect(r.bau.kontakt.einwilligungen).toBeUndefined();  // Empfehlung: kein Kanal, über den die Person geschrieben hat
    expect(r.bau.kontakt.lead?.status).toBe('kontaktiert');
  });
  it('Event als Bezug hängt am Verlauf; keine zweite Wirkung, wenn die Person am Beitrag schon als Anfrage steht', () => {
    const p = k('p', { email: 'p@x.de', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'ok' }] });
    const e = anfrageBauen({ kontaktId: 'c-p', kanal: 'event', bezug: { art: 'event', id: 'ev-1' }, text: 'Nach dem Stammtisch' }, ctx([p]));
    expect(e.ok && e.bau.kontakt.aktivitaeten[0].bezug === 'ev-1' && e.bau.followUp.art === 'nachricht').toBe(true);
    const c = crm(); c.beitraege[0].wirkung.push({ kontaktId: 'c-p', art: 'anfrage', am: '2026-09-21' });
    const w = anfrageBauen({ kontaktId: 'c-p', kanal: 'mail', bezug: { art: 'beitrag', id: 'bt-1' }, text: 'Nochmal' }, ctx([p], c));
    expect(w.ok && w.bau.wirkung === undefined).toBe(true);
    if (w.ok) expect(w.bau.kontakt.einwilligungen).toHaveLength(1); // gültige Einwilligung bleibt, keine zweite
  });
  it('Fehler: ohne Text, ohne Person, unbekannter Kanal, fremder Bezug — Werbesperre hält fest (5.9)', () => {
    expect(anfrageBauen({ kontaktId: 'c-p', kanal: 'mail', text: '   ' }, ctx([k('p')]))).toMatchObject({ ok: false });
    expect(anfrageBauen({ neu: {}, kanal: 'mail', text: 'x' }, ctx([]))).toMatchObject({ ok: false });
    expect(anfrageBauen({ kontaktId: 'c-p', kanal: 'fax' as never, text: 'x' }, ctx([k('p')]))).toMatchObject({ ok: false });
    expect(anfrageBauen({ kontaktId: 'c-fehlt', kanal: 'mail', text: 'x' }, ctx([]))).toMatchObject({ ok: false, fehler: 'Person nicht gefunden.' });
    expect(anfrageBauen({ kontaktId: 'c-p', kanal: 'mail', bezug: { art: 'beitrag', id: 'bt-9' }, text: 'x' }, ctx([k('p')]))).toMatchObject({ ok: false, fehler: 'Bezug nicht gefunden.' });
    // Werbesperre (08.10., Woche 2 · 5.9): die Anfrage wird festgehalten — ohne Einwilligung, Follow-up „Sonstiges“, mit Hinweis.
    const ws = anfrageBauen({ kontaktId: 'c-p', kanal: 'mail', text: 'x' }, ctx([k('p', { email: 'p@x.de', werbesperre: { seit: HEUTE, grund: 'Widerspruch' } })]));
    expect(ws.ok).toBe(true);
    if (ws.ok) { expect(ws.bau.kontakt.einwilligungen ?? []).toHaveLength(0); expect(ws.bau.followUp.art).toBe('sonstig'); expect(ws.bau.hinweis).toMatch(/Werbesperre/); }
  });
  it('Helfer: Stufe nach Anfrage, Lead nach Anfrage, Text, Kanäle', () => {
    expect(stufeNachAnfrage('neu')).toBe('angesprochen');
    expect(stufeNachAnfrage('ruht')).toBe('angesprochen');
    expect(stufeNachAnfrage('angebot')).toBe('angebot');
    expect(stufeNachAnfrage('gewonnen')).toBe('gewonnen');
    expect(leadNachAnfrage(undefined, 'n', JETZT, 'kevin')?.status).toBe('kontaktiert');
    expect(leadNachAnfrage({ status: 'neu', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, notiz: 'alt' }, 'neu', JETZT, 'kevin')).toMatchObject({ status: 'kontaktiert', notiz: 'alt\nneu', kriterien: { schmerz: 'ja' } });
    expect(leadNachAnfrage({ status: 'sql', kriterien: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' } }, 'n', JETZT, 'kevin')).toBeUndefined();
    expect(anfrageText('linkedin', 'Hallo')).toBe('Anfrage über LinkedIn: Hallo');
    expect(ANFRAGE_KANAELE.map(x => x.id)).toEqual(['website', 'mail', 'linkedin', 'telefon', 'empfehlung', 'event', 'whatsapp']);
  });
});

describe('Anfragen-Liste', () => {
  it('liest die Anfragen aus den Verläufen (30 Tage), hängt Follow-up-Stand und Deal an — jüngste zuerst', () => {
    const c = crm();
    const r1 = anfrageBauen({ neu: { vorname: 'Anna', nachname: 'Neu', email: 'a@x.de' }, kanal: 'website', bezug: { art: 'beitrag', id: 'bt-1' }, text: 'Bitte melden' }, ctx([], c));
    if (!r1.ok) throw new Error(r1.fehler);
    const alt = k('alt', { aktivitaeten: [{ am: '2026-09-01T10:00:00.000Z', art: 'antwort', text: 'Anfrage über Mail: Frage zu Preisen', von: 'kevin' }, { am: '2026-06-01T10:00:00.000Z', art: 'antwort', text: 'Anfrage über Mail: uralt', von: 'kevin' }] });
    const bestand: CrmBestand = { ...c, followups: [r1.bau.followUp, { ...r1.bau.followUp, id: 'fu-alt', kontaktId: 'c-alt', bezug: { art: 'kontakt', id: 'c-alt' }, status: 'erledigt', angelegt: '2026-09-01T10:00:00.000Z', erledigtAm: '2026-09-01T12:00:00.000Z' }],
      chancen: [{ id: 'ch-1', titel: 'Alt · Retainer', kontaktIds: ['c-alt'], art: 'retainer', wert: { betrag: 1, basis: 'monat' }, stufe: 'bedarf', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: HEUTE, geaendert: HEUTE }] };
    const l = anfragenListe([r1.bau.kontakt, alt, k('still')], bestand, HEUTE);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ kontaktId: 'c-neu1', name: 'Anna Neu', kanal: 'Website', text: 'Bitte melden', offen: true, von: 'malin', bezug: { art: 'beitrag', id: 'bt-1', titel: 'Liquidität in 90 Tagen' }, followUp: { id: 'fu-neu1', status: 'offen' }, leadStatus: 'kontaktiert' });
    expect(l[1]).toMatchObject({ kontaktId: 'c-alt', kanal: 'Mail', text: 'Frage zu Preisen', offen: false, deal: { id: 'ch-1', titel: 'Alt · Retainer' }, followUp: { id: 'fu-alt', status: 'erledigt' } });
    expect(l[1].bezug).toBeUndefined();
  });
  it('Gesperrte stehen nicht in der Liste', () => {
    const p = k('p', { werbesperre: { seit: HEUTE, grund: 'x' }, aktivitaeten: [{ am: JETZT, art: 'antwort', text: 'Anfrage über Mail: x', von: 'kevin' }] });
    expect(anfragenListe([p], crm(), HEUTE)).toEqual([]);
  });
});

// ─── Netzwerken — Recht (03.10., Paket „netz-recht“), rein ─────────────────────────────────────────
// Kunden-Markierung am Kontakt (nur Server stempelt), Art.-13-Hinweis, UWG-Wörter, Danke-Fristen/Verzicht/kein Gespräch, Übergaben (Art. 15/19),
// Selbstprüfung, VVT, Löschfristen-Funktionen, Kampagnen-Ampel, Telegram-Text, Metadaten aus Fotos, Warteschlange (Alter, Verschlüsselung).
// Erfundene Personen (@example.invalid), keine Platte, kein Netz.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '@/lib/make-one/crm';
import { saeubereKontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event, Teilnahme } from '@/lib/crm/typen';
import { leererBestand } from '@/lib/crm/speicher';
import { datenschutzStempeln } from '@/lib/crm/datenschutz-stempel';
import { zusammenfuehren } from '@/lib/crm/dubletten';
import {
  LIA_NETZWERKEN, datenschutzHinweisText, werbeWoerter, kennengelerntZeilen, uebergabenVon, uebergabeAuskunftText, uebergabeHinweisText, informationOffen, DANKE_UWG_HINWEIS,
} from '@/lib/crm/netzwerken-recht';
import { dankeZeilen, dankeOffen, berichtAus, dankeEntwurf, netzwerkenAngabeSaeubern, erfassungPruefen } from '@/lib/crm/netzwerken';
import { selbstpruefung, verarbeitungenStart, verarbeitungenNachtragen, VV_NETZWERKEN_IDS } from '@/lib/crm/datenschutz';
import { uebergabenSaeubern, zielpersonGesperrt } from '@/lib/crm/besuche-form';
import { personEntfernen, personUmbiegen } from '@/lib/crm/person-verweise';
import { infoBereinigen, protokolleBereinigen, netzwerkenKontakteUeberFrist, istKartenfoto, istSprachnotiz } from '@/lib/crm/netzwerken-loeschen';
import { LOESCHFRISTEN, fristenWirksam } from '@/lib/crm/loeschfristen';
import { personenSchranke, kampagnenHinweise, kampagnenAmpel } from '@/lib/crm/personen-schranke';
import { telegramText } from '@/lib/meldungen/speicher';
import { transkriptionAn, sprachnotizTranskribieren } from '@/lib/crm/netzwerken-karte';
import { jpegOhneMetadaten, pngOhneMetadaten, base64OhneMetadaten, hatMetadaten } from '@/lib/netzwerken/bild-bereinigen';
import { Warteschlange, ramSpeicher, verschluesselterSpeicher, koerperVerschluesseln, koerperEntschluesseln, altHinweis, alterTage, istAlt, WARTE_VERWERFEN_TAGE, type WarteEintrag } from '@/lib/netzwerken/warteschlange';

const ID = '3f2b9c1e-1a2b-4c3d-8e4f-0123456789ab';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Muster', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-09-20', ...x } as unknown as Kontakt);
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-a', titel: 'Mittelstandstag', format: 'sonstig', ziel: '', datum: '2026-09-20', status: 'durchgefuehrt', marke: 'Netzwerken', geaendert: '2026-09-01', ...x });
const nw = (x: Record<string, unknown> = {}) => ({ erfassungId: ID, schritt: 'followup', zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-09-20T18:00:00.000Z', ...x } as unknown as Teilnahme['netzwerken']);
const t = (kid: string, x: Partial<Teilnahme> = {}, n: Record<string, unknown> = {}): Teilnahme => ({ id: `t-${kid}`, eventId: 'ev-a', kontaktId: kid, status: 'da', geaendert: '2026-09-20', netzwerken: nw(n), ...x });

describe('1 · Kunden-Markierung am Kontakt — nur der Server setzt sie', () => {
  const kf = [{ firmaId: 'f-kunde1', eventId: 'ev-a', am: '2026-09-20' }];
  it('die Säuberung behält gültige Werte und wirft Unsinn weg', () => {
    const s = saeubereKontakt({ ...k('anna'), rechtsgrundlageNotiz: LIA_NETZWERKEN, kennengelerntFuer: [...kf, { firmaId: 'kaputt', eventId: 'x', am: 'gestern' }, ...kf], datenschutzInformiertAm: '2026-09-21' })!;
    expect(s.rechtsgrundlageNotiz).toBe('LIA-Netzwerken v1');
    expect(s.kennengelerntFuer).toEqual(kf);          // Unsinn und Doppelte weg
    expect(s.datenschutzInformiertAm).toBe('2026-09-21');
    const leer = saeubereKontakt({ ...k('berta'), rechtsgrundlageNotiz: '<script>', kennengelerntFuer: 'x', datenschutzInformiertAm: 'morgen' })!;
    expect('rechtsgrundlageNotiz' in leer).toBe(false);
    expect('kennengelerntFuer' in leer).toBe(false);
    expect('datenschutzInformiertAm' in leer).toBe(false);
  });
  it('der Browser kann sie nicht setzen: das Stempeln nimmt den gespeicherten Wert (oder keinen)', () => {
    const roh = { ...k('a'), rechtsgrundlageNotiz: 'LIA-Netzwerken v1', kennengelerntFuer: kf, datenschutzInformiertAm: '2026-09-21' };
    const neu = datenschutzStempeln(roh, undefined, 'kevin', '2026-10-03T10:00:00.000Z', '2026-10-03');
    expect(neu.rechtsgrundlageNotiz).toBeUndefined();
    expect(neu.kennengelerntFuer).toBeUndefined();
    expect(neu.datenschutzInformiertAm).toBeUndefined();
    const alt = k('a', { rechtsgrundlageNotiz: 'LIA-Netzwerken v1', kennengelerntFuer: kf, datenschutzInformiertAm: '2026-09-21' });
    const behalten = datenschutzStempeln({ ...alt, rechtsgrundlageNotiz: 'selbst', kennengelerntFuer: [], datenschutzInformiertAm: '2020-01-01' }, alt, 'kevin', '2026-10-03T10:00:00.000Z', '2026-10-03');
    expect(behalten).toMatchObject({ rechtsgrundlageNotiz: 'LIA-Netzwerken v1', kennengelerntFuer: kf, datenschutzInformiertAm: '2026-09-21' });
  });
  it('Zusammenführen verliert die Markierung nicht (Vereinigung, frühester Hinweis-Tag)', () => {
    const a = k('a', { kennengelerntFuer: kf, datenschutzInformiertAm: '2026-09-25' });
    const b = k('b', { kennengelerntFuer: [{ firmaId: 'f-kunde2', eventId: 'ev-b', am: '2026-09-22' }, ...kf], rechtsgrundlageNotiz: LIA_NETZWERKEN, datenschutzInformiertAm: '2026-09-21' });
    const m = zusammenfuehren(a, b, 'kevin', '2026-10-03T10:00:00.000Z');
    expect(m.kennengelerntFuer).toHaveLength(2);
    expect(m.datenschutzInformiertAm).toBe('2026-09-21');
    expect(m.rechtsgrundlageNotiz).toBe(LIA_NETZWERKEN);
  });
  it('die Kontaktakte sagt „kennengelernt für <Kunde> bei <Event>“', () => {
    expect(kennengelerntZeilen(k('a', { kennengelerntFuer: kf }), [{ id: 'f-kunde1', name: 'Kundenwerk GmbH' }], [{ id: 'ev-a', titel: 'Mittelstandstag' }])).toEqual(['kennengelernt für Kundenwerk GmbH bei Mittelstandstag (20.09.2026)']);
    expect(kennengelerntZeilen(k('a'), [], [])).toEqual([]);
  });
});

describe('3 · Art. 13: der Datenschutzhinweis in der Danke-Mail', () => {
  const a = { mail: 'datenschutz@beispiel.example', seite: 'beispiel.example/datenschutz#kontakte', verantwortlich: 'Beispiel GmbH' };
  it('Sie und Du, kurz und freundlich: wozu, Rechtsgrundlage, Werbung nur mit Einwilligung, Rechte und wohin', () => {
    expect(datenschutzHinweisText({ du: false, angaben: a })).toBe('Datenschutz: Ich habe mir Ihre Kontaktdaten von Ihrer Visitenkarte notiert, um mit Ihnen in Verbindung zu bleiben (Art. 6 Abs. 1 lit. f DSGVO, Verantwortlich: Beispiel GmbH). Werbung sende ich nur mit Ihrer Einwilligung. Auskunft, Berichtigung, Löschung, Widerspruch: datenschutz@beispiel.example · beispiel.example/datenschutz#kontakte');
    expect(datenschutzHinweisText({ du: true, angaben: a })).toContain('deine Kontaktdaten von deiner Visitenkarte');
  });
  it('bei Kunden-Events nennt er den Empfänger der Übermittlung', () => {
    const h = datenschutzHinweisText({ du: false, kunde: 'Kundenwerk GmbH', angaben: a });
    expect(h).toContain('Wir waren für Kundenwerk GmbH auf der Veranstaltung und geben Ihre Kontaktdaten an Kundenwerk GmbH weiter.');
    expect(datenschutzHinweisText({ du: false, angaben: a })).not.toContain('Wir waren für');
  });
  it('steht am Ende der Entwurfs-Mail (nach Gruß und Absender); ohne Einrichtung sichtbar „fehlt“ statt fester Angaben aus dem Code', () => {
    const e = dankeEntwurf({ vorname: 'Anna', nachname: 'Beispiel', anrede: 'Sie', eventTitel: 'X', wann: 'gestern', absender: 'Kevin' });
    expect(e.text.split('\n').slice(-2)[0]).toBe('—');
    expect(e.text).toMatch(/Datenschutz: Ich habe mir Ihre Kontaktdaten .*Verantwortlich: Verantwortlicher fehlt — unter System › Datenschutz eintragen\).* \[Kontaktweg fehlt — unter System › Datenschutz eintragen\]$/);
    expect(e.text).not.toMatch(/makeinnovation|MAKE Innovation/);
    expect(dankeEntwurf({ nachname: 'B', anrede: 'Sie', eventTitel: 'X', wann: 'neulich', absender: 'Kevin', datenschutz: a }).text).toContain('datenschutz@beispiel.example');
  });
});

describe('4 · UWG: nur mit Gespräch, nur Dank, Warnung bei Werbewörtern, nach 14 Tagen weg, „Nicht senden“', () => {
  const kontakte = [k('c1', { email: 'a@example.invalid', stufe: 'gespraech' })];
  const zeilen = (n: Record<string, unknown>, heute: string, erfasstAm = '2026-09-20T18:00:00.000Z') => dankeZeilen({ events: [ev()], teilnahmen: [t('c-c1', {}, { erfasstAm, ...n })], kontakte, heute });
  it('ohne persönliches Gespräch gibt es keinen Danke-Entwurf — und der Bericht sagt, was stattdessen zu tun ist', () => {
    expect(zeilen({ keinGespraech: true }, '2026-09-22')).toEqual([]);
    expect(zeilen({}, '2026-09-22')).toHaveLength(1);
    const b = berichtAus({ event: ev(), teilnahmen: [t('c-c1', {}, { keinGespraech: true })], kontakte, heute: '2026-09-22' });
    expect(b.zeilen[0].offen).toEqual(['kein Gespräch — Datenschutzhinweis beim ersten Kontakt geben']);
  });
  it('der feste Hinweis und die Werbewörter', () => {
    expect(DANKE_UWG_HINWEIS).toBe('Nur Dank und Verabredetes. Keine Angebote, Einladungen oder Produktwerbung — ohne Einwilligung wäre das Werbung (§ 7 UWG).');
    expect(werbeWoerter('Schön, Sie getroffen zu haben. Anbei unser Angebot und eine Einladung zum Newsletter — 10 % Rabatt!').sort()).toEqual(['angebot', 'einladung', 'newsletter', 'rabatt']);
    expect(werbeWoerter(dankeEntwurf({ vorname: 'Anna', nachname: 'B', anrede: 'Sie', eventTitel: 'Stammtisch', wann: 'gestern', schritt: 'termin', terminAm: '2026-10-05T10:30', absender: 'Kevin' }).text)).toEqual([]);
  });
  it('nach 14 Tagen: abgelaufen, nicht mehr in Glocke und Heute (dankeOffen); verzichtet zählt nie; der Bericht bleibt ehrlich', () => {
    const frisch = zeilen({}, '2026-10-04'); // 14 Tage nach dem 20.09.
    expect(frisch[0].abgelaufen).toBeUndefined();
    expect(dankeOffen(frisch)).toBe(1);
    const alt = zeilen({}, '2026-10-05'); // 15 Tage
    expect(alt[0].abgelaufen).toBe(true);
    expect(dankeOffen(alt)).toBe(0);
    const verzicht = zeilen({ danke: { verzichtetAm: '2026-09-22' } }, '2026-09-23');
    expect(verzicht[0].verzichtet).toBe('2026-09-22');
    expect(dankeOffen(verzicht)).toBe(0);
    expect(berichtAus({ event: ev(), teilnahmen: [t('c-c1', {}, { danke: { verzichtetAm: '2026-09-22' } })], kontakte, heute: '2026-09-23' }).zeilen[0].offen[0]).toMatch(/Danke-Mail nicht gesendet — Datenschutzhinweis beim ersten Kontakt geben/);
    expect(berichtAus({ event: ev(), teilnahmen: [t('c-c1')], kontakte, heute: '2026-10-05' }).zeilen[0].offen[0]).toMatch(/nicht mehr angeboten/);
  });
  it('die Angabe an der Teilnahme: neue Felder gesäubert (nur true/Tag), alte unverändert', () => {
    const gut = { erfassungId: ID, schritt: 'termin', zustaendig: 'malin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T09:00:00.000Z', danke: { anrede: 'Du', verzichtetAm: '2026-10-03' }, neuAngelegt: true, kartenfoto: true, keinGespraech: true };
    expect(netzwerkenAngabeSaeubern(gut)).toEqual(gut);
    const schlecht = netzwerkenAngabeSaeubern({ ...gut, danke: { verzichtetAm: 'bald' }, neuAngelegt: 'ja', kartenfoto: 1, keinGespraech: 'x' })!;
    expect(schlecht).not.toHaveProperty('neuAngelegt');
    expect(schlecht).not.toHaveProperty('kartenfoto');
    expect(schlecht).not.toHaveProperty('keinGespraech');
    expect(schlecht).not.toHaveProperty('danke');
  });
  it('„persönlich gesprochen“ im Körper: false kommt an, fehlt = ja', () => {
    const roh = { erfassungId: ID, erfasstAm: new Date().toISOString(), eventId: 'ev-test-1', kontakt: { nachname: 'Beispiel' }, bilder: [], schritt: 'nur-kontakt', zustaendig: 'kevin' };
    const a = erfassungPruefen({ ...roh, gesprochen: false }, { heute: '2026-10-02' });
    const b = erfassungPruefen(roh, { heute: '2026-10-02' });
    expect(a.ok && a.wert.gesprochen).toBe(false);
    expect(b.ok && 'gesprochen' in b.wert).toBe(false);
  });
});

describe('Übergaben: Art. 15, 17 (Art. 19), Zusammenführen', () => {
  const uebergabe = { am: '2026-10-02T08:00:00.000Z', von: 'kevin', anzahl: 2, empfaengerFirmaId: 'f-kunde1', dateiname: 'kontakte-x.csv', kontaktIds: ['c-anna', 'c-berta'], avvBzwHinweisBestaetigt: true };
  const crm = (): CrmBestand => ({ ...leererBestand(), firmen: [{ id: 'f-kunde1', name: 'Kundenwerk GmbH', rolle: 'kunde', geaendert: '2026-09-01' }] as CrmBestand['firmen'], events: [ev({ fuer: { art: 'kunde', firmaId: 'f-kunde1' }, uebergaben: [uebergabe] })] });
  it('wer wurde an wen übergeben — mit Datum und Empfänger; fehlende Kennungen (altes Protokoll) nennen nie jemanden', () => {
    const l = uebergabenVon(crm(), 'c-anna');
    expect(l).toEqual([expect.objectContaining({ am: '2026-10-02', empfaenger: 'Kundenwerk GmbH', eventTitel: 'Mittelstandstag', dateiname: 'kontakte-x.csv' })]);
    expect(uebergabeAuskunftText(l[0])).toBe('übergeben am 02.10.2026 an Kundenwerk GmbH (Mittelstandstag)');
    expect(uebergabeHinweisText(l[0])).toBe('Person wurde am 02.10.2026 an Kundenwerk GmbH übergeben (Mittelstandstag) — dort informieren (Art. 19)');
    expect(uebergabenVon(crm(), 'c-niemand')).toEqual([]);
    const altProtokoll = { ...crm(), events: [ev({ uebergaben: [{ am: '2026-10-02T08:00:00.000Z', von: 'kevin', anzahl: 2 }] })] };
    expect(uebergabenVon(altProtokoll, 'c-anna')).toEqual([]);
  });
  it('Protokoll-Säuberung: Empfänger, Dateiname, Kennungen (nur gültige), Haken — nie mehr', () => {
    const u = uebergabenSaeubern([{ ...uebergabe, kontaktIds: ['c-anna', 'kein-kontakt', 'c-anna'], name: 'Anna Muster', mail: 'x@y.z', dateiname: '../../etc/passwd' }])![0];
    expect(u).toEqual({ am: uebergabe.am, von: 'kevin', anzahl: 2, empfaengerFirmaId: 'f-kunde1', kontaktIds: ['c-anna'], avvBzwHinweisBestaetigt: true });
    expect(uebergabenSaeubern([{ am: '2026-10-02', von: 'kevin', anzahl: 1 }])).toEqual([{ am: '2026-10-02', von: 'kevin', anzahl: 1 }]); // altes Protokoll bleibt lesbar
  });
  it('Art. 17: die Kennung fällt aus dem Protokoll, Datum/Anzahl/Empfänger bleiben; Zusammenführen biegt um', () => {
    const ohne = personEntfernen(crm(), 'c-anna');
    expect(ohne.events[0].uebergaben).toEqual([{ ...uebergabe, kontaktIds: ['c-berta'] }]);
    const beide = personEntfernen(personEntfernen(crm(), 'c-anna'), 'c-berta');
    expect(beide.events[0].uebergaben![0]).not.toHaveProperty('kontaktIds');
    expect(beide.events[0].uebergaben![0]).toMatchObject({ anzahl: 2, empfaengerFirmaId: 'f-kunde1' });
    const um = personUmbiegen(crm(), 'c-anna', 'c-berta');
    expect(um.events[0].uebergaben![0].kontaktIds).toEqual(['c-berta']);
    const unberuehrt = personEntfernen(crm(), 'c-fremd');
    expect(unberuehrt.events).toBe(crm().events === unberuehrt.events ? crm().events : unberuehrt.events);
  });
});

describe('Selbstprüfung: Information bei Veranstaltungs-Kontakten und VVT', () => {
  const heute = '2026-10-03';
  const konten = { konten: 2, mitPasswort: 2 };
  it('Netzwerken-Personen ohne Datenschutzhinweis seit mehr als 3 Tagen zählen; informierte und frische nicht', () => {
    const kontakte = [
      k('alt', { rechtsgrundlageNotiz: LIA_NETZWERKEN, importiertAm: '2026-09-20' }),
      k('frisch', { rechtsgrundlageNotiz: LIA_NETZWERKEN, importiertAm: '2026-10-02' }),
      k('info', { rechtsgrundlageNotiz: LIA_NETZWERKEN, importiertAm: '2026-09-20', datenschutzInformiertAm: '2026-09-21' }),
      k('sperre', { rechtsgrundlageNotiz: LIA_NETZWERKEN, importiertAm: '2026-09-20', eingeschraenkt: { seit: '2026-09-25', grund: 'x', von: 'kevin' } }),
      k('andere'),
    ];
    expect(informationOffen(kontakte, heute).map(x => x.id)).toEqual(['c-alt']);
    const p = selbstpruefung(kontakte, leererBestand(), heute, konten).find(x => x.id === 'info-veranstaltung')!;
    expect(p).toMatchObject({ titel: 'Information bei Veranstaltungs-Kontakten', norm: 'Art. 13 DSGVO' });
    expect(p.status).not.toBe('erfuellt');
    expect(p.befund).toMatch(/1 Personen aus Netzwerken seit über 3 Tagen ohne Datenschutzhinweis/);
    expect(selbstpruefung([k('x')], leererBestand(), heute, konten).find(x => x.id === 'info-veranstaltung')!.status).toBe('erfuellt');
    expect(selbstpruefung([kontakte[2]], leererBestand(), heute, konten).find(x => x.id === 'info-veranstaltung')!.status).toBe('erfuellt');
  });
  it('VVT: die drei Netzwerken-Verarbeitungen werden idempotent nachgetragen (nach id), vorhandene bleiben', () => {
    const start = verarbeitungenStart('2026-10-03T10:00:00.000Z');
    const neu = verarbeitungenNachtragen(start, '2026-10-03T10:00:00.000Z');
    expect(neu.map(v => v.id)).toEqual([...start.map(v => v.id), 'vv-netzwerken', 'vv-besuche-kunde', 'vv-kunden-export']);
    expect(VV_NETZWERKEN_IDS).toEqual(['vv-netzwerken', 'vv-besuche-kunde', 'vv-kunden-export']);
    expect(verarbeitungenNachtragen(neu, '2026-10-04T10:00:00.000Z')).toEqual(neu);        // zweiter Lauf: nichts Neues
    const geaendert = neu.map(v => (v.id === 'vv-netzwerken' ? { ...v, zweck: 'von Hand angepasst' } : v));
    expect(verarbeitungenNachtragen(geaendert, '2026-10-04T10:00:00.000Z').find(v => v.id === 'vv-netzwerken')!.zweck).toBe('von Hand angepasst');
    for (const v of neu.filter(x => VV_NETZWERKEN_IDS.includes(x.id))) {
      for (const f of ['zweck', 'personen', 'daten', 'rechtsgrundlage', 'empfaenger', 'drittland', 'loeschfrist', 'toms', 'verantwortlich'] as const) expect(v[f], `${v.id}.${f}`).toBeTruthy();
    }
    expect(neu.find(v => v.id === 'vv-netzwerken')!.empfaenger).toMatch(/Konten des Haushalts.*Hetzner.*Microsoft 365.*Apple iCloud.*Anthropic/);
    expect(neu.find(v => v.id === 'vv-besuche-kunde')!.rechtsgrundlage).toMatch(/lit\. f/);
  });
  it('fehlt eines davon im Verzeichnis, steht die Selbstprüfung auf „teilweise“ und nennt es', () => {
    const start = verarbeitungenStart('2026-10-03T10:00:00.000Z');
    const p = selbstpruefung([k('a', { herkunft: 'selbst', rechtsgrundlage: 'vertrag' })], { ...leererBestand(), verarbeitungen: start }, heute, konten).find(x => x.id === 'verzeichnis')!;
    expect(p.status).toBe('teilweise');
    expect(p.befund).toMatch(/es fehlt: Netzwerken — Kontakte von Veranstaltungen/);
    const voll = selbstpruefung([k('a', { herkunft: 'selbst', rechtsgrundlage: 'vertrag' })], { ...leererBestand(), verarbeitungen: verarbeitungenNachtragen(start, '2026-10-03T10:00:00.000Z') }, heute, konten).find(x => x.id === 'verzeichnis')!;
    expect(voll.status).toBe('erfuellt');
  });
});

describe('7 · Löschfristen der Erfassungs-Daten', () => {
  it('die Fristen stehen in der Tabelle (Standard 6 Monate Karte, 90 Tage Sprachnotiz, 12 Monate Kontakte/Info, 36 Monate Übergabe)', () => {
    const f = fristenWirksam({});
    expect([f['netzwerken-karten'], f['netzwerken-sprachnotizen'], f['netzwerken-kontakte'], f['netzwerken-info'], f['uebergabe-protokolle']]).toEqual([6, 90, 12, 12, 36]);
    expect(LOESCHFRISTEN.find(x => x.id === 'netzwerken-kontakte')!.wirkung).toBe('aufgabe');       // nie automatisch gelöscht
    for (const id of ['netzwerken-karten', 'netzwerken-sprachnotizen', 'netzwerken-info', 'uebergabe-protokolle'] as const) expect(LOESCHFRISTEN.find(x => x.id === id)!.wirkung).toBe('automatisch');
  });
  it('Medien erkennt man an Titel und Notiz — nie Belege oder andere Dateien', () => {
    expect(istKartenfoto({ titel: 'Visitenkarte 1/2 · 3f2b9c1e', notiz: 'Netzwerken bei „X“', kontaktId: 'c-a' })).toBe(true);
    expect(istKartenfoto({ titel: 'Visitenkarte 1/2 · 3f2b9c1e', notiz: 'Netzwerken bei „X“' })).toBe(false);   // ohne Kontakt
    expect(istKartenfoto({ titel: 'Vertrag', notiz: 'Netzwerken bei „X“', kontaktId: 'c-a' })).toBe(false);
    expect(istSprachnotiz({ titel: 'Sprachnotiz · 3f2b9c1e', notiz: 'Sprachnotiz bei „X“ — Abschrift folgt (KI)', kontaktId: 'c-a' })).toBe(true);
    expect(istSprachnotiz({ titel: 'Sprachnotiz · 3f2b9c1e', notiz: 'meine Notiz', kontaktId: 'c-a' })).toBe(false);
  });
  it('Gesprächs-Info und Personen der Zielliste 12 Monate nach dem Event weg — eine selbst geschriebene Notiz und Firmen bleiben, Kennzahlen bleiben', () => {
    const alt = ev({ id: 'ev-alt', datum: '2025-09-01', zielpersonen: [{ kontaktId: 'c-a', getroffen: true }, { firmaId: 'f-x1' }] });
    const neu = ev({ id: 'ev-neu', datum: '2026-09-01', zielpersonen: [{ kontaktId: 'c-a' }] });
    const crm: CrmBestand = { ...leererBestand(), events: [alt, neu], teilnahmen: [
      t('c-a', { id: 't-1', eventId: 'ev-alt', notiz: 'Studie' }, { info: 'Studie' }),
      t('c-b', { id: 't-2', eventId: 'ev-alt', notiz: 'MEINE EIGENE NOTIZ' }, { info: 'Studie' }),
      t('c-c', { id: 't-3', eventId: 'ev-neu', notiz: 'Studie' }, { info: 'Studie' }),
      t('c-d', { id: 't-4', eventId: 'ev-alt' }, {}),
    ] };
    const r = infoBereinigen(crm, '2025-10-03');
    expect(r.info).toBe(2);
    expect(r.ziele).toBe(1);
    const t1 = r.crm.teilnahmen.find(x => x.id === 't-1')!;
    expect(t1.netzwerken).not.toHaveProperty('info');
    expect(t1.notiz).toBeUndefined();
    expect(t1.netzwerken).toMatchObject({ schritt: 'followup', zustaendig: 'kevin' }); // Teilnahme/Schritt bleiben
    expect(r.crm.teilnahmen.find(x => x.id === 't-2')!.notiz).toBe('MEINE EIGENE NOTIZ');
    expect(r.crm.teilnahmen.find(x => x.id === 't-3')!.netzwerken!.info).toBe('Studie'); // jünger als 12 Monate
    expect(r.crm.events.find(x => x.id === 'ev-alt')!.zielpersonen).toEqual([{ firmaId: 'f-x1' }]);
    expect(r.crm.events.find(x => x.id === 'ev-neu')!.zielpersonen).toEqual([{ kontaktId: 'c-a' }]);
    expect(infoBereinigen(r.crm, '2025-10-03').crm).toBe(r.crm);                         // idempotent: nichts mehr zu tun (===)
  });
  it('Übergabe-Protokolle älter als 36 Monate fallen weg', () => {
    const crm: CrmBestand = { ...leererBestand(), events: [ev({ uebergaben: [{ am: '2023-01-01T08:00:00.000Z', von: 'kevin', anzahl: 1 }, { am: '2026-01-01T08:00:00.000Z', von: 'kevin', anzahl: 2 }] }), ev({ id: 'ev-b', uebergaben: [{ am: '2022-01-01T08:00:00.000Z', von: 'malin', anzahl: 1 }] })] };
    const r = protokolleBereinigen(crm, '2023-10-03');
    expect(r.n).toBe(2);
    expect(r.crm.events[0].uebergaben).toEqual([{ am: '2026-01-01T08:00:00.000Z', von: 'kevin', anzahl: 2 }]);
    expect(r.crm.events[1]).not.toHaveProperty('uebergaben');
    expect(protokolleBereinigen(r.crm, '2023-10-03').crm).toBe(r.crm);
  });
  it('Netzwerken-Kontakte ohne Zug seit 12 Monaten → Prüf-Aufgabe (nie löschen); wer in einem Deal hängt, Kunde ist oder schon in der 24-Monats-Liste steht, nicht', () => {
    const heute = '2026-10-03';
    const kontakte = [
      k('alt', { labels: ['Netzwerken'], importiertAm: '2025-08-01', aktivitaeten: [] }),
      k('aktiv', { labels: ['Netzwerken'], importiertAm: '2025-08-01', letzterKontakt: '2026-08-01' }),
      k('deal', { labels: ['Netzwerken'], importiertAm: '2025-08-01' }),
      k('kunde', { labels: ['Netzwerken'], importiertAm: '2025-08-01', lebensphase: 'kunde' }),
      k('fremd', { importiertAm: '2025-08-01' }),
      k('schon', { quelle: 'Netzwerken', importiertAm: '2024-01-01' }),
    ];
    const crm = { mandate: [], chancen: [{ id: 'ch-1', kontaktIds: ['c-deal'], stufe: 'angebot' }] } as unknown as Pick<CrmBestand, 'mandate' | 'chancen'>;
    expect(netzwerkenKontakteUeberFrist(kontakte, crm, heute, 12).map(x => x.id)).toEqual(['c-schon', 'c-alt']);
    expect(netzwerkenKontakteUeberFrist(kontakte, crm, heute, 12, new Set(['c-schon'])).map(x => x.id)).toEqual(['c-alt']);
  });
});

describe('9 · Kampagnen-Ampel: bei werblichem Kanal zählt sie hart', () => {
  const heute = '2026-10-03';
  const einw = (kanal: 'mail' | 'social') => ({ kanal, grundlage: 'einwilligung', erteiltAm: '2026-09-01', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'kevin', wortlaut: 'Ich möchte Mails.', belegRef: 'd-abc' });
  const gruen = k('gruen', { einwilligungen: [einw('mail')] as unknown as Kontakt['einwilligungen'] });
  const gelb = k('gelb', { kreis: 'A' });                                    // persönlich bekannt → gelb
  const rot = k('rot');                                                        // Kaltkontakt → rot
  const ohneMail = k('ohnemail', { email: undefined });                       // keine Adresse → rot
  const gesperrt = k('sperre', { werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } });
  const bestand = leererBestand();
  const op = (kanal: string, ids: string[], extra: Record<string, unknown> = {}) => [{ liste: 'kampagnen' as const, op: 'upsert' as const, id: 'kp-1', eintrag: { id: 'kp-1', name: 'Herbst', kanal, status: 'entwurf', kontaktIds: ids, ...extra } }];
  const alle = [gruen, gelb, rot, ohneMail, gesperrt];
  it('Mail: rot (kalt, ohne Adresse) wird abgelehnt — ohne Namen und Kennungen im Text; grün und gelb gehen', () => {
    expect(personenSchranke(bestand, op('mail', ['c-gruen', 'c-gelb']) as never, alle)).toEqual([]);
    const r = personenSchranke(bestand, op('mail', ['c-gruen', 'c-rot', 'c-ohnemail']) as never, alle);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/Kampagne „Herbst“ \(Mail\): 2 Personen mit roter Ampel kommen nicht hinein/);
    expect(r[0]).not.toMatch(/c-rot|rot@example|Muster/);
    expect(personenSchranke(bestand, op('mail', ['c-rot']) as never, alle)[0]).toMatch(/eine Person mit roter Ampel kommt nicht hinein/);
  });
  it('LinkedIn und Newsletter: dieselbe Regel (eigener Kanal der Ampel); persönlich, Telefon, Event, Mix: unverändert', () => {
    expect(personenSchranke(bestand, op('linkedin', ['c-gelb']) as never, [k('gelb', { kreis: 'A', linkedin: 'https://linkedin.example/gelb' })])).toEqual([]);
    expect(personenSchranke(bestand, op('linkedin', ['c-rot']) as never, [k('rot', { linkedin: 'https://linkedin.example/rot' })])[0]).toMatch(/\(LinkedIn\)/);
    expect(personenSchranke(bestand, op('newsletter', ['c-rot']) as never, alle)[0]).toMatch(/\(Newsletter\)/);
    for (const kanal of ['persoenlich', 'telefon', 'event', 'mix']) expect(personenSchranke(bestand, op(kanal, ['c-rot', 'c-ohnemail']) as never, alle), kanal).toEqual([]);
  });
  it('gelb geht, aber mit Hinweis (kampagnenHinweise); Altbestand in der Kampagne wird nicht rückwirkend abgelehnt', () => {
    const h = kampagnenHinweise(bestand, op('mail', ['c-gruen', 'c-gelb']) as never, alle);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatch(/Kampagne „Herbst“ \(Mail\): eine Person mit gelber Ampel — .*keine Werbung ohne Einwilligung/);
    expect(kampagnenHinweise(bestand, op('mail', ['c-gruen']) as never, alle)).toEqual([]);
    const mitAlt = { ...bestand, kampagnen: [{ id: 'kp-1', name: 'Herbst', kanal: 'mail', status: 'entwurf', kontaktIds: ['c-rot'], ergebnisse: [], schritte: [], von: 'hand', geaendert: 'x' }] } as unknown as CrmBestand;
    expect(personenSchranke(mitAlt, [{ liste: 'kampagnen', op: 'teil', id: 'kp-1', felder: { name: 'Neuer Name' } }] as never, alle)).toEqual([]);
    expect(personenSchranke(mitAlt, [{ liste: 'kampagnen', op: 'teil', id: 'kp-1', felder: { kontaktIds: ['c-rot', 'c-ohnemail'] } }] as never, alle)[0]).toMatch(/eine Person mit roter Ampel/);
  });
  it('Werbesperre bleibt bei ihrem eigenen Text (nicht doppelt als „rot“ gemeldet); Teil-Objekte ohne Kontaktfelder zählen nicht', () => {
    const r = personenSchranke(bestand, op('mail', ['c-sperre']) as never, alle);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatch(/Werbesperre/);
    expect(personenSchranke(bestand, op('mail', ['c-teil']) as never, [{ id: 'c-teil' }])).toEqual([]);
    expect(kampagnenAmpel('mail', ['c-gruen', 'c-gelb', 'c-rot'], alle, bestand, heute)).toMatchObject({ rot: [{ id: 'c-rot' }], gelb: [{ id: 'c-gelb' }] });
    expect(kampagnenAmpel('persoenlich', ['c-rot'], alle, bestand, heute)).toEqual({ rot: [], gelb: [] });
  });
});

describe('10 · Zielpersonen: später gesperrt → ausgegraut', () => {
  it('zielpersonGesperrt sagt, warum', () => {
    expect(zielpersonGesperrt(k('a'))).toBeNull();
    expect(zielpersonGesperrt(undefined)).toBeNull();
    expect(zielpersonGesperrt(k('a', { eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'kevin' } }))).toBe('eingeschraenkt');
    expect(zielpersonGesperrt(k('a', { werbesperre: { seit: '2026-09-01', grund: 'x' } }))).toBe('werbesperre');
  });
});

describe('11 · Telegram: keine Namen von Veranstaltungs-Kontakten', () => {
  it('netzwerken und danke nur der neutrale Satz; alles andere wie bisher', () => {
    expect(telegramText({ art: 'netzwerken', titel: 'Kevin hat dir Anna Beispiel (Stammtisch) zugeteilt — nächster Schritt: Termin' })).toBe('Neue Person zugeteilt — Details in MAKE OS');
    expect(telegramText({ art: 'danke', titel: '3 Danke-Mails bereit — Stammtisch' })).toBe('Danke-Mails bereit — Details in MAKE OS');
    expect(telegramText({ art: 'zuweisung', titel: 'Kevin hat dir eine Aufgabe zugewiesen' })).toBe('Kevin hat dir eine Aufgabe zugewiesen');
    // DSGVO-Prüfung 04.10.: Vertrags-Erinnerung — Glocke (Art „vertrag“) und Fälligkeit ihrer Aufgabe `vte-…` nur neutral.
    expect(telegramText({ art: 'vertrag', titel: 'Kündigen oder verlängern? GF-Vertrag Max Erfunden (Beispiel GmbH)' })).toBe('Eine Vertragsfrist naht — Details in MAKE OS');
    expect(telegramText({ art: 'faellig', titel: 'Fällig: Kündigen oder verlängern? GF-Vertrag Max Erfunden', bezug: { art: 'aufgabe', id: 'vte-abcd-20261231' } })).toBe('Eine Vertragsfrist naht — Details in MAKE OS');
  });
});

describe('12 · KI-Transkript: vorbereitet, aus', () => {
  it('der Server-Schalter ist ohne Umgebungsvariable aus und liefert nie ein Transkript', async () => {
    const vorher = process.env.TRANSKRIPTION_AN;
    delete process.env.TRANSKRIPTION_AN;
    expect(transkriptionAn()).toBe(false);
    expect(await sprachnotizTranskribieren(new Uint8Array([1, 2]), 'audio/webm')).toBeNull();
    process.env.TRANSKRIPTION_AN = '1';
    expect(transkriptionAn()).toBe(true);
    expect(await sprachnotizTranskribieren(new Uint8Array([1, 2]), 'audio/webm')).toBeNull();   // auch eingeschaltet: nichts nach außen, bis AVV/SCC stehen
    if (vorher === undefined) delete process.env.TRANSKRIPTION_AN; else process.env.TRANSKRIPTION_AN = vorher;
  });
});

describe('13 · Fotos: Exif/GPS/XMP raus', () => {
  const bytes = (...teile: (number[] | string)[]) => Uint8Array.from(teile.flatMap(x => (typeof x === 'string' ? Array.from(x).map(c => c.charCodeAt(0)) : x)));
  const seg = (marker: number, inhalt: string | number[]) => { const b = typeof inhalt === 'string' ? Array.from(inhalt).map(c => c.charCodeAt(0)) : inhalt; const n = b.length + 2; return [0xff, marker, n >> 8, n & 255, ...b]; };
  const scan = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9];
  const jfif = seg(0xe0, 'JFIF\u0000\u0001\u0001\u0000\u0000\u0001\u0000\u0001\u0000\u0000');
  const exif = seg(0xe1, 'Exif\u0000\u0000GPS:52.52N,13.40E');
  const xmp = seg(0xe1, 'http://ns.adobe.com/xap/1.0/\u0000<x:xmpmeta/>');
  it('JPEG: Exif (GPS), XMP, IPTC und Kommentar fallen weg; JFIF, ICC und Adobe bleiben; das Bild bleibt ein Bild', () => {
    const icc = seg(0xe2, 'ICC_PROFILE\u0000\u0001\u0001abc');
    const mit = bytes([0xff, 0xd8], jfif, exif, xmp, seg(0xed, 'Photoshop 3.0'), seg(0xfe, 'Kommentar'), icc, scan);
    expect(hatMetadaten(mit, 'jpeg')).toBe(true);
    const sauber = jpegOhneMetadaten(mit)!;
    expect(Buffer.from(sauber).toString('latin1')).not.toMatch(/Exif|GPS|xmpmeta|Photoshop|Kommentar/);
    expect(Buffer.from(sauber).toString('latin1')).toContain('JFIF');
    expect(Buffer.from(sauber).toString('latin1')).toContain('ICC_PROFILE');
    expect(Array.from(sauber.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(sauber.subarray(-2))).toEqual([0xff, 0xd9]);
    expect(jpegOhneMetadaten(sauber)).toBe(sauber);   // idempotent (===)
    expect(hatMetadaten(sauber, 'jpeg')).toBe(false);
  });
  it('JPEG ohne Metadaten bleibt unverändert (===); kein JPEG / beschädigter Aufbau → null', () => {
    const rein = bytes([0xff, 0xd8], jfif, scan);
    expect(jpegOhneMetadaten(rein)).toBe(rein);
    expect(jpegOhneMetadaten(bytes('GIF89a......'))).toBeNull();
    expect(jpegOhneMetadaten(bytes([0xff, 0xd8], [0xff, 0xe1, 0x7f, 0xff, 1, 2, 3]))).toBeNull();     // Segmentlänge über das Ende
    expect(jpegOhneMetadaten(bytes([0xff, 0xd8, 0x12, 0x34, 0x56, 0x78]))).toBeNull();               // Synchronität verloren
  });
  it('PNG: Text-, Exif- und Zeit-Blöcke fallen weg, Bildblöcke bleiben', () => {
    const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const chunk = (typ: string, daten: string) => { const d = Buffer.from(daten, 'latin1'); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(typ, 'latin1'), d, Buffer.alloc(4)]); };
    const iend = png1x1.subarray(png1x1.length - 12);
    const mitText = Buffer.concat([png1x1.subarray(0, png1x1.length - 12), chunk('tEXt', 'GPS\u000052.52N'), chunk('eXIf', 'Exif GPS'), chunk('tIME', '1234567'), iend]);
    expect(hatMetadaten(new Uint8Array(mitText), 'png')).toBe(true);
    const sauber = pngOhneMetadaten(new Uint8Array(mitText))!;
    expect(Buffer.from(sauber).toString('latin1')).not.toMatch(/tEXt|eXIf|tIME|GPS/);
    expect(Buffer.from(sauber).equals(png1x1)).toBe(true);                     // genau das Original ohne die drei Blöcke
    expect(pngOhneMetadaten(new Uint8Array(png1x1))).toEqual(new Uint8Array(png1x1));
    expect(pngOhneMetadaten(new Uint8Array(mitText.subarray(0, 40)))).toBeNull();   // abgeschnitten
  });
  it('Base64 → Base64: der Server speichert nie das Original mit Exif', () => {
    const mit = bytes([0xff, 0xd8], jfif, exif, scan);
    const b64 = Buffer.from(mit).toString('base64');
    const raus = base64OhneMetadaten(b64, 'jpeg')!;
    expect(raus).not.toBe(b64);
    expect(Buffer.from(raus, 'base64').toString('latin1')).not.toContain('GPS');
    const ohne = Buffer.from(bytes([0xff, 0xd8], jfif, scan)).toString('base64');
    expect(base64OhneMetadaten(ohne, 'jpeg')).toBe(ohne);
    expect(base64OhneMetadaten('@@@', 'jpeg')).toBeNull();
  });
  it('erfassungPruefen säubert das Foto vor dem ersten Schreiben und lehnt Beschädigtes ab (415)', () => {
    const mit = Buffer.from(bytes([0xff, 0xd8], jfif, exif, scan)).toString('base64');
    const roh = (daten: string) => ({ erfassungId: ID, erfasstAm: new Date().toISOString(), eventId: 'ev-test-1', kontakt: { nachname: 'Beispiel' }, bilder: [{ name: 'k.jpg', typ: 'image/jpeg', daten }], schritt: 'nur-kontakt', zustaendig: 'kevin' });
    const r = erfassungPruefen(roh(mit), { heute: '2026-10-02' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Buffer.from(r.wert.bilder[0].daten, 'base64').toString('latin1')).not.toContain('GPS');
    const kaputt = Buffer.from(bytes([0xff, 0xd8], [0xff, 0xe1, 0x7f, 0xff, 1, 2, 3])).toString('base64');
    expect(erfassungPruefen(roh(kaputt), { heute: '2026-10-02' })).toMatchObject({ ok: false, status: 415 });
  });
});

describe('8 · Offline-Warteschlange: Alter und Verschlüsselung', () => {
  const TAG = 864e5;
  const anzeige = { name: 'Anna Beispiel', schritt: 'Follow-up', eventTitel: 'Stammtisch' };
  const koerper = (id: string) => ({ erfassungId: id, erfasstVon: 'kevin', kontakt: { vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid' }, bilder: [{ daten: 'FOTO-BASE64' }] });
  const ok = async () => ({ status: 200, daten: { ok: true } });
  const jetzt = Date.UTC(2026, 9, 3, 10);
  it('ab 14 Tagen „Erfassung vom … noch nicht gesendet: senden oder verwerfen“, davor nichts', () => {
    expect(altHinweis({ angelegt: jetzt - 13 * TAG }, jetzt)).toBeNull();
    expect(istAlt({ angelegt: jetzt - 14 * TAG }, jetzt)).toBe(true);
    expect(altHinweis({ angelegt: jetzt - 14 * TAG }, jetzt)).toBe('Erfassung vom 19.09. noch nicht gesendet: senden oder verwerfen — nach 30 Tagen wird sie vom Gerät gelöscht (in 16 Tagen).');
    expect(alterTage({ angelegt: jetzt - 20 * TAG + 1000 }, jetzt)).toBe(19);
  });
  it('nach 30 Tagen automatisch verworfen — wartend wie Fehler, mit Anzeige; Jüngeres bleibt; senden() allein verwirft nie', async () => {
    const q = new Warteschlange(ramSpeicher(), ok);
    await q.ablegen(koerper('alt1'), anzeige, jetzt - 31 * TAG);
    await q.ablegen(koerper('alt2'), { ...anzeige, name: 'Bert Zwei' }, jetzt - WARTE_VERWERFEN_TAGE * TAG);
    await q.ablegen(koerper('jung'), anzeige, jetzt - 29 * TAG);
    const weg = await q.altVerwerfen(jetzt);
    expect(weg.map(x => x.id)).toEqual(['alt1', 'alt2']);
    expect((await q.alle()).map(x => x.id)).toEqual(['jung']);
    expect(q.verworfenAlt.map(x => x.name)).toEqual(['Anna Beispiel', 'Bert Zwei']);
    expect(await q.altVerwerfen(jetzt)).toEqual([]);
    const q2 = new Warteschlange(ramSpeicher(), ok);
    await q2.ablegen(koerper('x'), anzeige, 1);              // Fantasie-Zeit: senden() fasst das Alter nicht an
    await q2.senden();
    expect(await q2.alle()).toEqual([]);                     // gesendet, nicht verworfen
  });
  it('Körper nur verschlüsselt im Speicher (AES-GCM, nicht exportierbarer Schlüssel); alle() gibt ihn entschlüsselt zurück', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    const roh = ramSpeicher();
    const v = verschluesselterSpeicher(roh, async () => key);
    const q = new Warteschlange(v, ok);
    await q.ablegen(koerper('geheim'), anzeige, jetzt);
    const imSpeicher = JSON.stringify(Array.from((await roh.alle()), e => ({ ...e, verschluesselt: e.verschluesselt ? { v: 1, iv: Array.from(e.verschluesselt.iv), daten: Array.from(new Uint8Array(e.verschluesselt.daten)) } : undefined })));
    expect(imSpeicher).not.toContain('anna@example.invalid');
    expect(imSpeicher).not.toContain('FOTO-BASE64');
    expect(imSpeicher).not.toContain('"kontakt"'); // der ganze Körper ist verschlüsselt (die Kurzanzeige trägt den Namen bewusst)
    const e = (await q.alle())[0];
    expect(e.koerper).toEqual(koerper('geheim'));
    expect(e.verschluesselt).toBeUndefined();
    // Senden bekommt den Klartext-Körper.
    let gesendet: Record<string, unknown> | null = null;
    const q2 = new Warteschlange(verschluesselterSpeicher(ramSpeicher(), async () => key), async k => { gesendet = k; return { status: 200, daten: { ok: true } }; });
    await q2.ablegen(koerper('s1'), anzeige, jetzt);
    await q2.senden();
    expect(gesendet).toEqual(koerper('s1'));
  });
  it('Status-Änderungen (Versuche, Hinweis) behalten den Körper verschlüsselt und lesbar; „Ohne Termin abschließen“ ändert ihn lesbar', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const roh = ramSpeicher();
    const q = new Warteschlange(verschluesselterSpeicher(roh, async () => key), async () => ({ status: 0, daten: null }));
    await q.ablegen(koerper('a'), anzeige, jetzt);
    await q.senden();                                    // kein Netz: setzt Versuche/Hinweis
    const l = await q.alle();
    expect(l[0].versuche).toBe(1);
    expect(l[0].koerper).toEqual(koerper('a'));
    await q.ohneTermin('a');
    expect((await q.alle())[0].koerper).toMatchObject({ ohneTermin: true, erfassungId: 'a' });
    expect((await roh.alle())[0].koerper).toEqual({});   // im Speicher bleibt der Klartext-Körper leer
  });
  it('fehlt der Schlüssel (Browserdaten gelöscht), ist der Eintrag „unlesbar“ — sichtbar, nur verwerfbar, nie gesendet', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const anderer = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const roh = ramSpeicher();
    await new Warteschlange(verschluesselterSpeicher(roh, async () => key), ok).ablegen(koerper('x'), anzeige, jetzt);
    let gesendet = 0;
    const q = new Warteschlange(verschluesselterSpeicher(roh, async () => anderer), async () => { gesendet++; return { status: 200, daten: { ok: true } }; });
    const l = await q.alle();
    expect(l[0]).toMatchObject({ unlesbar: true, status: 'fehler', koerper: {} });
    expect(l[0].hinweis).toMatch(/nicht mehr lesbar/);
    await q.senden();
    expect(gesendet).toBe(0);
    await q.verwerfen(l[0].id);
    expect(await q.alle()).toEqual([]);
  });
  it('ohne WebCrypto (key() wirft) scheitert das Schreiben — `ausfallsicher` nimmt dann den Arbeitsspeicher, nie Klartext auf die Platte', async () => {
    const { ausfallsicher } = await import('@/lib/netzwerken/warteschlange');
    const platte = ramSpeicher();
    const q = new Warteschlange(ausfallsicher(verschluesselterSpeicher(platte, async () => { throw new Error('kein WebCrypto'); })), ok);
    await q.ablegen(koerper('ram'), anzeige, jetzt);
    expect(q.nurImArbeitsspeicher()).toBe(true);
    expect(await platte.alle()).toEqual([]);              // nichts im Speicher auf dem Gerät
    expect((await q.alle())[0].koerper).toEqual(koerper('ram'));
  });
  it('alte Einträge ohne Hülle (vor dem 03.10.) bleiben lesbar und werden beim nächsten Schreiben verschlüsselt', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const roh = ramSpeicher();
    const alt: WarteEintrag = { id: 'alt', angelegt: jetzt, versuche: 0, status: 'wartet', koerper: koerper('alt'), anzeige };
    await roh.setze(alt);
    const q = new Warteschlange(verschluesselterSpeicher(roh, async () => key), ok);
    expect((await q.alle())[0].koerper).toEqual(koerper('alt'));
    await q.erneut('alt');
    expect((await roh.alle())[0].verschluesselt).toBeDefined();
    expect((await roh.alle())[0].koerper).toEqual({});
  });
  it('die Verschlüsselung bindet den Chiffretext an die Kennung (AAD): umgehängt entschlüsselt er nicht', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const v = await koerperVerschluesseln(key, 'id-1', { a: 1 });
    expect(await koerperEntschluesseln(key, 'id-1', v)).toEqual({ a: 1 });
    await expect(koerperEntschluesseln(key, 'id-2', v)).rejects.toThrow();
  });
});

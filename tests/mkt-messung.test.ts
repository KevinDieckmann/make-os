// ─── Marketing-Projekt M3 „Messung und Verbindung“ (02.11.) — Wächter. Erfundene Daten, keine echten Namen/Firmen/Beträge.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Kontakt } from '../lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, Kampagne, NewsletterAusgabe } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import {
  dealAusMarketing, marketingDealKontext, marketingKennzahlen, marketingTrichter, veroeffentlichungen, veroeffentlichungenKpi, abmeldungenUeberLink, abmeldequote,
  istWebseiteAnfrage, MARKETING_QUELLEN, TRICHTER_QUELLEN, ANFRAGE_PRAEFIX, type SocialVeroeffentlichung,
} from '../lib/crm/marketing';
import { istMarketingKampagne, anfrageIstMarketing } from '../lib/crm/scoring';
import { traktionsIndex, MOTOR_KENNZAHLEN } from '../lib/crm/traktion-index';
import { motorKennzahlen, motorImBestand, MOTOR_MINDEST } from '../lib/crm/traktion-quellen';
import { webseiteTreffer } from '../lib/crm/webseite-zahlen';
import { anfrageBauen, kanalInfo, anfrageText, type AnfrageKontext } from '../lib/crm/anfragen';
import { folgenZurFreigabe, socialFuerPerson, folgeAus } from '../lib/social/daten';
import { markeMitVorgabe, markenVorgabeAus, vorgabeGilt } from '../lib/social/marke-vorgabe';
import { instagramKanalFuer, folgeZumBeitrag, folgeEintragAusBeitrag } from '../lib/social/beitrag-folge';
import { LEITPLANKEN_VORGABE, type SocialDatei, type SocialFolge, type SocialKanal } from '../lib/social/typen';
import { NEUIGKEITEN } from '../lib/neuigkeiten/eintraege';
import { teamWieKonten } from './fixtures/team-konten';
teamWieKonten();

const HEUTE = '2026-10-30', JETZT = `${HEUTE}T10:00:00.000Z`;
const tagMinus = (n: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const b = (id: string, x: Partial<Beitrag> = {}): Beitrag => ({ id: `bt-${id}`, titel: `Beitrag ${id}`, kanal: 'linkedin', status: 'veroeffentlicht', datum: tagMinus(2), wirkung: [], quellen: [], geaendert: JETZT, ...x });
const ch = (id: string, x: Partial<Chance> = {}): Chance => ({
  id: `ch-${id}`, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: `${tagMinus(1)}T09:00:00.000Z`, geaendert: HEUTE, ...x,
});
const kp = (id: string, x: Partial<Kampagne> = {}): Kampagne => ({ id: `kp-${id}`, name: `Kampagne ${id}`, playbook: 'lookalike', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', start: tagMinus(20), schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: HEUTE, ...x });
const nl = (id: string, x: Partial<NewsletterAusgabe> = {}): NewsletterAusgabe => ({ id: `nl-${id}`, titel: `Ausgabe ${id}`, status: 'versendet', datum: tagMinus(3), inhalt: '', beitragIds: [], geaendert: JETZT, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const anfrage = (am: string, kanal = 'Website', text = 'Bitte um Rückruf') => ({ am: `${am}T10:00:00.000Z`, art: 'antwort' as const, text: `${ANFRAGE_PRAEFIX}${kanal}: ${text}`, von: 'malin' });
const kanal = (x: Partial<SocialKanal> = {}): SocialKanal => ({ id: 'sk-a', name: 'Kanal A', ziele: [], staende: [], sprache: 'de', plattformen: ['instagram'], kiKanal: false, marke: { nieSagen: [], saeulen: [] }, leitplanken: LEITPLANKEN_VORGABE, status: 'aktiv', geaendert: '', ...x });
const folge = (id: string, x: Partial<SocialFolge> = {}): SocialFolge => ({ id: `sv-${id}`, kanalId: 'sk-a', titel: `Folge ${id}`, skript: 'Text', hooks: [], quellen: [], kiInhalt: false, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '', ...x });

describe('1 · Traktions-Index: Social, Website, Kampagnen-Motor', () => {
  it('Social-Veröffentlichungen zählen in „Veröffentlichungen“ — eine verknüpfte Folge nur einmal', () => {
    const crm = bestand({ beitraege: [b('a'), b('ig', { kanal: 'sonstig' })] });
    const social: SocialVeroeffentlichung[] = [
      { folgeId: 'sv-1', kanalName: 'Kanal A', titel: 'Folge eins', tag: tagMinus(1), plattformen: ['instagram'] },
      { folgeId: 'sv-2', kanalName: 'Kanal A', titel: 'Folge zum Beitrag', tag: tagMinus(1), plattformen: ['instagram'], beitragId: 'bt-ig' },
    ];
    expect(veroeffentlichungenKpi(crm, HEUTE).wert).toBe(2);
    expect(veroeffentlichungenKpi(crm, HEUTE, social).wert).toBe(3); // + Folge eins, die verknüpfte zählt als ihr Beitrag
    const ohne = traktionsIndex({ kontakte: [], crm, heute: HEUTE });
    const mit = traktionsIndex({ kontakte: [], crm, heute: HEUTE, social: { posts: social } });
    const v = (i: typeof ohne) => i.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'veroeffentlichungen')!;
    expect(v(ohne).wert).toBe(2);
    expect(v(mit).wert).toBe(3);
  });
  it('Newsletter-Beitrag einer versendeten Ausgabe zählt als die Ausgabe, nicht doppelt', () => {
    const crm = bestand({ beitraege: [b('n', { kanal: 'newsletter' })], newsletter: [nl('1', { beitragIds: ['bt-n'] })] });
    const l = veroeffentlichungen(crm, tagMinus(6), HEUTE);
    expect(l.map(x => x.art)).toEqual(['ausgabe']);
    expect(marketingTrichter([], crm, HEUTE).reichweite).toMatchObject({ beitraege: 0, ausgaben: 1 });
  });
  it('Website nicht doppelt: läuft sie, zählt „Anfragen · 90 Tage“ ohne die reinen Website-Anfragen', () => {
    const kontakte = [k('w', { aktivitaeten: [anfrage(tagMinus(3))] }), k('m', { aktivitaeten: [anfrage(tagMinus(4), 'Mail')] })];
    const crm = bestand();
    const a90 = (i: ReturnType<typeof traktionsIndex>) => i.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'anfragen_90')!;
    expect(a90(traktionsIndex({ kontakte, crm, heute: HEUTE })).wert).toBe(2);
    const mitWeb = traktionsIndex({ kontakte, crm, heute: HEUTE, webseite: { aktiv: true, checks: [] } });
    expect(a90(mitWeb).wert).toBe(1);
    expect(mitWeb.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'web_anfragen')!.wert).toBe(1);
  });
  it('EINE Erkennung für Website-Anfragen (Marketing › Anfragen, Website › Eingänge, Kennzahl)', () => {
    expect(istWebseiteAnfrage(anfrage(HEUTE))).toBe(true);
    expect(istWebseiteAnfrage(anfrage(HEUTE, 'Mail'))).toBe(false);
    expect(istWebseiteAnfrage({ art: 'system', text: `${ANFRAGE_PRAEFIX}Website: x` })).toBe(false);
    expect(kanalInfo('website')!.label).toBe('Website'); // die Beschriftung, an der die Erkennung hängt
    expect(webseiteTreffer([k('x', { aktivitaeten: [anfrage(HEUTE), { ...anfrage(HEUTE), art: 'system' as never }] })], HEUTE, 'anfrage')).toHaveLength(1);
  });
  it('Kampagnen-Motor: zwei Kennzahlen, nur im Modell, wenn er gesendet hat; Papierkorb-Kampagnen zählen nicht', () => {
    const crm = bestand({ kampagnen: [kp('a')] });
    const ids = (i: ReturnType<typeof traktionsIndex>) => i.saeulen.flatMap(s => s.kennzahlen).map(x => x.id);
    expect(ids(traktionsIndex({ kontakte: [], crm, heute: HEUTE }))).not.toContain('motor_gesendet');
    const mails = Array.from({ length: 10 }, (_, i) => ({ kampagneId: i < 8 ? 'kp-a' : 'kp-weg', tag: tagMinus(i), antwort: i === 0 }));
    const i = traktionsIndex({ kontakte: [], crm, heute: HEUTE, motor: { mails } });
    expect(ids(i)).toEqual(expect.arrayContaining(MOTOR_KENNZAHLEN.map(d => d.id)));
    const g = i.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'motor_gesendet')!;
    expect(g.wert).toBe(8); // die zwei Mails der gelöschten Kampagne fehlen
    expect(motorImBestand({ mails }, crm.kampagnen)!.mails).toHaveLength(8);
    const q = motorKennzahlen({ mails: mails.slice(0, 8) }, HEUTE).find(x => x.id === 'motor_antworten')!;
    expect(q.wert).toBeCloseTo(12.5);
    expect(motorKennzahlen({ mails: mails.slice(0, MOTOR_MINDEST - 1) }, HEUTE).find(x => x.id === 'motor_antworten')!.wert).toBeNull();
  });
});

describe('2 · EINE Quellen-Liste für „Deals aus Marketing“', () => {
  it('Liste: Content, Anfrage, Kampagne — der alte Name ist dieselbe Liste', () => {
    expect(MARKETING_QUELLEN).toEqual(['content', 'inbound', 'kampagne']);
    expect(TRICHTER_QUELLEN).toBe(MARKETING_QUELLEN);
  });
  it('Kampagne zählt nur als Marketing-Kampagne (dieselbe Regel wie die Lead-Herkunft)', () => {
    const kx = { beitraege: [], kampagnen: [kp('m'), kp('v', { playbook: 'vernetzen' }), kp('t', { kanal: 'telefon' })] };
    expect(dealAusMarketing(ch('1', { quelle: 'kampagne', quelleBezug: 'kp-m' }), kx)).toBe(true);
    expect(dealAusMarketing(ch('2', { quelle: 'kampagne', quelleBezug: 'kp-v' }), kx)).toBe(false);
    expect(dealAusMarketing(ch('3', { quelle: 'kampagne', quelleBezug: 'kp-t' }), kx)).toBe(false);
    expect(istMarketingKampagne(kp('e', { status: 'entwurf' }))).toBe(false);
  });
  it('Anfrage über Marketing vor der Anlage macht den Deal zu Marketing; eine Empfehlung nicht', () => {
    const kontakte = [k('a', { aktivitaeten: [anfrage(tagMinus(10), 'Mail')] }), k('e', { aktivitaeten: [anfrage(tagMinus(10), 'Empfehlung')] })];
    const crm = bestand();
    const kx = marketingDealKontext(kontakte, crm);
    expect(dealAusMarketing(ch('a', { kontaktIds: ['c-a'], quelle: 'empfehlung' }), kx)).toBe(true);
    expect(dealAusMarketing(ch('e', { kontaktIds: ['c-e'], quelle: 'empfehlung' }), kx)).toBe(false);
  });
  it('Kennzahl und Trichter zählen dieselben Deals', () => {
    const kontakte = Array.from({ length: 5 }, (_, i) => k(`p${i}`, { aktivitaeten: i < 2 ? [anfrage(tagMinus(5), 'Mail')] : [] }));
    const chancen = [...kontakte.map((p, i) => ch(`d${i}`, { kontaktIds: [p.id] })), ch('k', { quelle: 'kampagne', quelleBezug: 'kp-m' })];
    const crm = bestand({ chancen, kampagnen: [kp('m')] });
    const t = marketingTrichter(kontakte, crm, HEUTE);
    const anteil = marketingKennzahlen(kontakte, crm, HEUTE).find(x => x.id === 'marketing_anteil')!;
    expect(t.uebergabe.deals).toBe(3);
    expect(anteil.wert).toBeCloseTo(3 / 6);
  });
});

describe('3 · Kosten ohne Papierkorb, Social-Freigaben zählen', () => {
  it('Gelöschte Beiträge und Kampagnen kosten nichts — auch wenn der volle Bestand kommt', () => {
    const crm = bestand({ beitraege: [b('a', { kostenEuro: 100 }), b('x', { kostenEuro: 900, geloeschtAm: JETZT })], kampagnen: [kp('a', { kostenEuro: 50 }), kp('x', { kostenEuro: 700, geloeschtAm: JETZT })] });
    expect(marketingTrichter([], crm, HEUTE).kosten).toMatchObject({ beitraege: 100, kampagnen: 50, gesamt: 150 });
  });
  it('Folgen zur Freigabe: nur Entwürfe ohne Freigabe in laufenden Kanälen — und nur Kanäle, die die Person sieht', () => {
    const d: SocialDatei = {
      kanaele: [kanal(), kanal({ id: 'sk-p', art: 'person', person: 'malin', sichtbarkeit: 'person' }), kanal({ id: 'sk-z', archiviertAm: JETZT })],
      formate: [],
      folgen: [folge('1'), folge('2', { freigegebenAm: JETZT }), folge('3', { status: 'idee' }), folge('4', { kanalId: 'sk-p' }), folge('5', { kanalId: 'sk-z' })],
    };
    expect(folgenZurFreigabe(socialFuerPerson(d, 'malin')).map(f => f.id)).toEqual(['sv-1', 'sv-4']);
    // Sicht X bekommt nichts aus Y: den „nur ich“-Kanal einer anderen Person zählt niemand sonst.
    expect(folgenZurFreigabe(socialFuerPerson(d, 'kevin')).map(f => f.id)).toEqual(['sv-1']);
    expect(folgenZurFreigabe(socialFuerPerson(d, null)).map(f => f.id)).toEqual(['sv-1']);
  });
});

describe('4 · Social → CRM: „Als Anfrage übernehmen“', () => {
  const ctx = (kontakte: Kontakt[]): AnfrageContext => ({ kontakte, crm: bestand(), person: 'malin', heute: HEUTE, jetzt: JETZT, ids: { kontakt: 'c-neu', followUp: 'fu-neu' } });
  type AnfrageContext = AnfrageKontext;
  it('eigene Kanal-Kennung „instagram“, Marketing-Anfrage, ohne Einwilligung (geantwortet wird im Faden)', () => {
    const r = anfrageBauen({ neu: { vorname: 'beispiel.handle' }, kanal: 'instagram', text: 'Instagram-Kommentar von @beispiel.handle: Was kostet das?' }, ctx([]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bau.aktivitaetText.startsWith(`${ANFRAGE_PRAEFIX}Instagram: `)).toBe(true);
    expect(r.bau.kontakt.einwilligungen ?? []).toEqual([]);
    expect(r.bau.followUp.art).toBe('nachricht');
    expect(anfrageIstMarketing({ text: anfrageText('instagram', 'x') })).toBe(true);
    const kx = marketingDealKontext([r.bau.kontakt], bestand());
    expect(dealAusMarketing(ch('i', { kontaktIds: [r.bau.kontakt.id], angelegt: `${HEUTE}T12:00:00.000Z` }), kx)).toBe(true);
  });
  it('Art. 18: nichts festhalten; Werbesperre: festgehalten, aber mit Hinweis', () => {
    const gesperrt = k('g', { email: 'g@beispiel.invalid', werbesperre: { seit: '2026-01-01', grund: 'x' } });
    const eingeschraenkt = k('e', { eingeschraenkt: { seit: '2026-01-01', grund: 'x', von: 'kevin' } });
    expect(anfrageBauen({ kontaktId: 'c-e', kanal: 'instagram', text: 'x' }, ctx([eingeschraenkt])).ok).toBe(false);
    const r = anfrageBauen({ kontaktId: 'c-g', kanal: 'instagram', text: 'x' }, ctx([gesperrt]));
    expect(r.ok && r.bau.hinweis).toContain('Werbesperre');
  });
  it('die Oberfläche geht über den EINEN Anfrage-Weg und sendet nichts', () => {
    const src = readFileSync(join(process.cwd(), 'components/os/crm/social/Community.tsx'), 'utf8');
    expect(src).toContain("fetch('/api/crm/anfrage'");
    expect(src).toContain("kanal: 'instagram'");
  });
});

describe('5 · Redaktionsplan ↔ Social-Folge, Positionierung als Vorgabe', () => {
  it('Folge behält ihre Beitrags-Kennung (Säuberer), Instagram-Kanal nur, wenn eindeutig', () => {
    expect(folgeAus({ ...folge('1'), beitragId: 'bt-head-1' })!.beitragId).toBe('bt-head-1');
    expect(folgeAus({ ...folge('1'), beitragId: 'Unsinn mit Leerzeichen' })!.beitragId).toBeUndefined();
    expect(instagramKanalFuer({ kanaele: [kanal()] }).kanal?.id).toBe('sk-a');
    expect(instagramKanalFuer({ kanaele: [kanal(), kanal({ id: 'sk-b' })] }).kanal).toBeNull();
    expect(instagramKanalFuer({ kanaele: [kanal({ plattformen: ['linkedin'] })] }).kanal).toBeNull();
    const e = folgeEintragAusBeitrag('sk-a', { id: 'bt-1', titel: 'T', text: 'Text', mitEntwurf: true });
    expect(e).toMatchObject({ status: 'entwurf', beitragId: 'bt-1' });
    expect(e).not.toHaveProperty('freigegebenAm');
    expect(folgeZumBeitrag({ folgen: [folge('1', { beitragId: 'bt-1' })] }, 'bt-1')?.id).toBe('sv-1');
  });
  it('Positionierung füllt nur leere Felder, nur bei Firmen- und Personenkanälen', () => {
    const v = markenVorgabeAus({ positionierung: 'Wir machen Planung einfach.', icp: 'Kleine Betriebe', ton: 'klar', saeulen: [{ id: 's1', name: 'Planung', beschreibung: '' }] });
    expect(vorgabeGilt({ art: undefined })).toBe(false);
    const f = markeMitVorgabe(kanal({ art: 'firma', marke: { nieSagen: [], saeulen: [], ton: 'eigener Ton' } }), v);
    expect(f.marke).toMatchObject({ versprechen: 'Wir machen Planung einfach.', zielgruppe: 'Kleine Betriebe', ton: 'eigener Ton', saeulen: ['Planung'] });
    const faceless = kanal();
    expect(markeMitVorgabe(faceless, v)).toBe(faceless);
    expect(markenVorgabeAus({ positionierung: '', icp: '', ton: '', saeulen: [] })).toBeNull();
  });
});

describe('6 · Newsletter-Abmeldungen automatisch, eine Stelle je Weg, Neuigkeit', () => {
  const abgemeldet = (id: string, am: string) => k(id, { einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'Bestätigungsklick (erfunden)', widerrufenAm: am, widerrufenVon: 'abmeldelink' }] });
  it('zählt Widerrufe über den Abmeldelink je Ausgabe (bis vor die nächste, höchstens 30 Tage)', () => {
    const ausgaben = [nl('a', { datum: tagMinus(40), empfaenger: 100 }), nl('b', { datum: tagMinus(10), empfaenger: 200 })];
    const kontakte = [abgemeldet('1', tagMinus(39)), abgemeldet('2', tagMinus(12)), abgemeldet('3', tagMinus(5)), abgemeldet('5', tagMinus(60)), k('4', { einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'Bestätigungsklick (erfunden)', widerrufenAm: tagMinus(5) }] })];
    const m = abmeldungenUeberLink(ausgaben, kontakte);
    expect(m.get('nl-a')).toBe(2); // 39 und 12 Tage zurück — vor dem Versand (60) zählt nicht
    expect(m.get('nl-b')).toBe(1); // Widerruf von Hand zählt nicht automatisch
    expect(abmeldequote(ausgaben[1], m.get('nl-b'))).toBe(1 / 200);
    expect(abmeldequote({ ...ausgaben[1], abmeldungen: 3 }, 1)).toBe(3 / 200); // die größere Zahl, nie addiert
    expect(abmeldequote({ ...ausgaben[1], empfaenger: undefined }, 1)).toBeNull();
  });
  it('Newsletter-Anmeldung hat EINE Stelle: der Check meldet über `anmeldungVerarbeiten` an, die Einwilligung baut nur lib/newsletter', () => {
    const check = readFileSync(join(process.cwd(), 'app/api/check/route.ts'), 'utf8');
    expect(check).toContain('anmeldungVerarbeiten');
    const treffer: string[] = [];
    const lauf = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'node_modules') lauf(p); } else if (/\.tsx?$/.test(n) && /kanal: 'newsletter', grundlage: 'einwilligung'/.test(readFileSync(p, 'utf8'))) treffer.push(p.replace(`${process.cwd()}/`, '')); } };
    for (const d of ['lib', 'app', 'components']) lauf(join(process.cwd(), d));
    expect(treffer).toEqual(['lib/newsletter/regeln.ts']);
  });
  it('Neuigkeit u-2026-11-02-9 steht oben (danach nur neuere)', () => {
    expect(NEUIGKEITEN.slice(0, 4).map(n => n.id)).toContain('u-2026-11-02-9');
  });
});

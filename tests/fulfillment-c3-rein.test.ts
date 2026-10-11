// ─── Fulfillment C3 · reine Regeln der Analyse-Strecke (10.10.; FULFILLMENT_KONZEPT.md 4, Abschnitt 11 „Wächter C3“) ─────────────────────────
// Agenten als Daten (Abhängigkeiten, F1 hart, Umfang), Schätzung (Median ab 3 Messungen, Grenze 1,5×), Ausgabe säubern (ohne Quelle → offene Frage,
// gesperrte Domains raus, Negativliste raus mit Kategorie, Namen → Funktion, erfundene Adressen zählen nicht), deterministische Prüfung (F2 nur mit
// bestandener Prüfung, Datenschutz nie überstimmbar), Dossier-Schritte (409, F1 nur mit Interessenabwägung, Übernahme nur angehakter Abschnitte),
// Personenteil (Identität, Art.-14-Uhr), Netz-Regel (`ipIntern`), robots.txt. Alles erfunden, kein Netz.
import { describe, it, expect } from 'vitest';
import { AGENTEN, AGENT_IDS, MINIMALSET, sperrGruende, laufVerwaist, PACHT_MS, laufStatusAnzeige } from '@/lib/fulfillment/analyse/agenten';
import { schaetzen, median, grenzeCent } from '@/lib/fulfillment/analyse/schaetzen';
import { ausgabePruefen, type AusgabeKontext } from '@/lib/fulfillment/analyse/ausgabe';
import { pruefeDossier, pruefungZusammen, pruefungBestanden, namenErsetzen, belegQuote } from '@/lib/fulfillment/analyse/pruefen';
import { dossierAnwenden, eingabenSaeubern, type DossierKontext } from '@/lib/fulfillment/analyse/dossier-anwenden';
import { personenAnwenden, karteMaengel } from '@/lib/fulfillment/analyse/personen-anwenden';
import { negativTreffer, art14Stand, art14Text, loeschAmFuer, LIA_MUSTER } from '@/lib/fulfillment/analyse/dsgvo';
import { istGesperrt, domainSaeubern, GESPERRTE_DOMAINS } from '@/lib/fulfillment/analyse/quellen';
import { dossierFuerAntwort } from '@/lib/fulfillment/analyse/sicht';
import { ipIntern, oeffentlichesZiel } from '@/lib/netz/oeffentlich';
import { robotsLesen, robotsErlaubt, zielErlaubt, neuerWebLauf, teilVon, WEB } from '@/lib/fulfillment/analyse/web-lesen';
import { leerDossiers, leerPersonen, dossiersAus } from '@/lib/fulfillment/lesen';
import type { Dossier, DossierDatei, PersonenKarte, AnalyseLauf } from '@/lib/fulfillment/typen';

const HEUTE = '2026-10-10';
const MODELLE = { schnell: 'claude-haiku-4-5-20251001', ausgewogen: 'claude-sonnet-5', stark: 'claude-opus-5-5' };
let n = 0;
const kennung = (p: string) => `${p}-t${++n}`;
const ctx = (person = 'pia'): DossierKontext => ({ person, jetzt: `${HEUTE}T10:00:00.000Z`, heute: HEUTE, standVon: d => JSON.stringify(d).length.toString(36) + d.geaendert, kennung: p => kennung(p) });

const dossier = (x: Partial<Dossier> = {}): Dossier => ({
  mandatId: 'm-1', version: 1, eingaben: { firma: 'Beispiel GmbH', domains: ['beispiel-firma.example'], urls: [] }, abschnitte: {}, quellen: [], laeufe: [],
  geaendert: `${HEUTE}T09:00:00.000Z`, geaendertVon: 'pia', ...x,
});
const lauf = (agent: AnalyseLauf['agent'], status: AnalyseLauf['status'], x: Partial<AnalyseLauf> = {}): AnalyseLauf =>
  ({ id: kennung('al'), agent, status, schaetzungCent: 30, bestaetigtCent: 30, grenzeCent: 45, versuch: 1, ...x });
const karte = (x: Partial<PersonenKarte> = {}): PersonenKarte => ({
  id: 'pp-k1', mandatId: 'm-1', funktion: 'Vertriebsleitung', name: 'Erika Beispiel', werdegang: [{ id: 'da-w1', text: 'Seit 2022 Vertriebsleitung, vorher Key Account.', art: 'fakt', quellen: ['dq-p1'], stand: HEUTE, agent: 'a4' }],
  themen: [], auftritte: [], aufhaenger: [], identitaet: 'hoch', ausgelassen: [], quellen: [{ id: 'dq-p1', url: 'https://beispiel-firma.example/team', domain: 'beispiel-firma.example', abgerufenAm: HEUTE }],
  art14: { faelligAm: '2026-11-10' }, erfasstAm: HEUTE, status: 'entwurf', ...x,
});
const datei = (d: Dossier): DossierDatei => ({ ...leerDossiers(), dossiers: { [d.mandatId]: d } });

describe('Agenten als Daten', () => {
  it('jede Kennung hat einen Agenten; Minimalset und Wellen wie im Konzept', () => {
    expect(AGENT_IDS.sort()).toEqual(['a0', 'a1', 'a10', 'a11', 'a12', 'a13', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'ap', 'tb']);
    expect(MINIMALSET).toEqual(['a0', 'a1', 'a2', 'a6', 'a7', 'a12', 'a13']);
    expect(AGENTEN.a12.stufe).toBe('stark');
    expect(AGENTEN.a4.kategorien).toEqual(['crm', 'web']);
    expect(AGENTEN.a2.kategorien).toEqual(['crm']);
    for (const id of AGENT_IDS) expect(AGENTEN[id].kategorien.includes('allgemein' as never), id).toBe(false);
    // Neutral: keine Namen, keine Beträge im Kerntext.
    for (const id of AGENT_IDS) expect(AGENTEN[id].auftrag).not.toMatch(/€|\b(GmbH|AG)\b/);
  });
  it('Abhängigkeiten und F1 hart: A1 braucht A0, A4 braucht A1+A2+F1+LIA, A2 braucht den Registerauszug', () => {
    const k = { playbook: false, register: false, jetztMs: Date.now() };
    const leer = dossier();
    expect(sperrGruende(leer, 'a0', k)).toEqual([]);
    expect(sperrGruende(leer, 'a1', k).join(' ')).toMatch(/Erst Start-Prüfer/);
    const nachA0 = dossier({ laeufe: [lauf('a0', 'uebernommen')] });
    expect(sperrGruende(nachA0, 'a1', k)).toEqual([]);
    expect(sperrGruende(nachA0, 'a2', k).join(' ')).toMatch(/Registerauszug/);
    expect(sperrGruende(nachA0, 'a2', { ...k, register: true })).toEqual([]);
    const a4 = sperrGruende(nachA0, 'a4', k).join(' ');
    expect(a4).toMatch(/A1/); expect(a4).toMatch(/A2/); expect(a4).toMatch(/F1/);
    // F1 ohne Interessenabwägung zählt nicht; Umfang sperrt Agenten außerhalb
    const mitF1 = dossier({ laeufe: [lauf('a0', 'uebernommen'), lauf('a1', 'fertig'), lauf('a2', 'uebernommen')], f1: { am: HEUTE, von: 'pia', umfang: ['a1', 'a2'], funktionen: ['Vertriebsleitung'] } });
    expect(sperrGruende(mitF1, 'a4', k).join(' ')).toMatch(/Interessenabwägung fehlt/);
    expect(sperrGruende(mitF1, 'a4', k).join(' ')).toMatch(/Nicht im Umfang/);
    expect(sperrGruende(mitF1, 'a5', k)).toEqual(['Nicht im Umfang von F1.']);
    // Web-Agenten brauchen eine Domain
    expect(sperrGruende(dossier({ eingaben: { firma: 'Beispiel GmbH', domains: [], urls: [] }, laeufe: [lauf('a0', 'uebernommen')] }), 'a1', k).join(' ')).toMatch(/Domain/);
  });
  it('A11 wartet auf Welle 1–2; A12 auf A11; A13 auf A12', () => {
    const k = { playbook: false, register: true, jetztMs: Date.now() };
    expect(sperrGruende(dossier(), 'a11', k).join(' ')).toMatch(/mindestens eine Analyse/);
    expect(sperrGruende(dossier({ laeufe: [lauf('a1', 'uebernommen'), lauf('a5', 'laeuft', { laeuftSeit: new Date().toISOString() })] }), 'a11', k).join(' ')).toMatch(/A5/);
    expect(sperrGruende(dossier({ laeufe: [lauf('a1', 'uebernommen')] }), 'a11', k)).toEqual([]);
    expect(sperrGruende(dossier({ laeufe: [lauf('a1', 'uebernommen')] }), 'a12', k).join(' ')).toMatch(/A11/);
  });
  it('Pacht: ein Lauf ohne Lebenszeichen seit > 10 Minuten gilt als abgebrochen', () => {
    const jetzt = Date.parse('2026-10-10T12:00:00Z');
    const l = lauf('a1', 'laeuft', { laeuftSeit: new Date(jetzt - PACHT_MS - 1000).toISOString() });
    expect(laufVerwaist(l, jetzt)).toBe(true);
    expect(laufStatusAnzeige(l, jetzt)).toBe('abgebrochen');
    expect(laufVerwaist({ ...l, laeuftSeit: new Date(jetzt - 60_000).toISOString() }, jetzt)).toBe(false);
  });
});

describe('Schätzung', () => {
  it('Vorgabe aus Token + Suchen; A0 ohne Kosten; Grenze = 1,5 × bestätigt', () => {
    const a1 = schaetzen('a1', { messungen: [], modelle: MODELLE, kurs: 1 });
    // 80.000 × 2 $ + 4.000 × 10 $ je Mio. = 0,20 $; 5 Suchen = 0,05 $ → 25 Cent
    expect(a1.euroCent).toBeCloseTo(25, 5);
    expect(a1.cent).toBe(25);
    expect(a1.hoechstensCent).toBe(38);
    expect(a1.quelle).toBe('vorgabe');
    expect(schaetzen('a0', { messungen: [], modelle: MODELLE }).cent).toBe(0);
    expect(grenzeCent(100)).toBe(150);
    expect(schaetzen('a12', { messungen: [], modelle: MODELLE, kurs: 1 }).modell).toBe('claude-opus-5-5');
  });
  it('die Schätzung lernt: ab drei gemessenen Läufen gilt der Median', () => {
    expect(median([10, 40, 20])).toBe(20);
    expect(schaetzen('a1', { messungen: [10, 40], modelle: MODELLE }).quelle).toBe('vorgabe');
    const s = schaetzen('a1', { messungen: [10, 40, 20, 30], modelle: MODELLE });
    expect(s.quelle).toBe('gemessen');
    expect(s.euroCent).toBe(25);
  });
});

describe('Ausgabe säubern (Entwurf)', () => {
  const k = (x: Partial<AusgabeKontext> = {}): AusgabeKontext => ({
    heute: HEUTE, belegbareUrls: new Set(['https://beispiel-firma.example/', 'https://beispiel-firma.example/leistungen', 'https://www.linkedin.com/company/x']),
    unterlagen: new Set(['ud-reg1']), karten: [{ id: 'pp-k1', name: 'Erika Beispiel', funktion: 'Vertriebsleitung' }], kennung: p => kennung(p), ...x,
  });
  it('ohne Quelle → offene Frage; erfundene Adresse zählt nicht; gesperrte Domain raus; unbekannter Abschnitt weg', () => {
    const e = ausgabePruefen('a1', {
      quellen: [
        { ref: 'q1', url: 'https://beispiel-firma.example/leistungen', titel: 'Leistungen' },
        { ref: 'q2', url: 'https://erfunden.example/seite' },
        { ref: 'q3', url: 'https://www.linkedin.com/company/x' },
      ],
      abschnitte: {
        unternehmen: [
          { text: 'Drei Leistungsbereiche.', art: 'fakt', quellen: ['q1'] },
          { text: 'Rund 40 Mitarbeitende.', art: 'schaetzung', quellen: ['q2'] },
          { text: 'Profil auf einer Plattform.', art: 'fakt', quellen: ['q3'] },
        ],
        markt: [{ text: 'gehört A1 nicht', art: 'fakt', quellen: ['q1'] }],
        erfunden: [{ text: 'x' }],
      },
      offeneFragen: ['Wie viele Neukunden pro Jahr?'],
    }, k());
    expect(e.abschnitte.unternehmen?.map(a => a.text)).toEqual(['Drei Leistungsbereiche.']);
    expect(e.abschnitte.fragen?.map(a => a.text)).toEqual(['Ohne Beleg: Rund 40 Mitarbeitende.', 'Ohne Beleg: Profil auf einer Plattform.', 'Wie viele Neukunden pro Jahr?']);
    expect(e.abschnitte.markt).toBeUndefined();
    expect(e.quellen.map(q => q.url)).toEqual(['https://beispiel-firma.example/leistungen']);
    expect(e.zaehler.gesperrt).toBe(1);
    expect(e.zaehler.ohneQuelle).toBe(2);
    expect(e.quellen[0].abgerufenAm).toBe(HEUTE);
  });
  it('Negativliste raus (nur die Kategorie bleibt), Namen der Karten → Funktion, Texte gekürzt und markiert', () => {
    const e = ausgabePruefen('a5', {
      quellen: [{ ref: 'q1', url: 'https://beispiel-firma.example/' }],
      abschnitte: {
        reputation: [
          { text: 'Die Geschäftsführung ist erkrankt.', art: 'fakt', quellen: ['q1'] },
          { text: 'Erika Beispiel hat den Vertrieb umgebaut.', art: 'fakt', quellen: ['q1'] },
          { text: 'Anbieter im Gesundheitswesen mit drei Standorten.', art: 'fakt', quellen: ['q1'] },
          { text: 'x'.repeat(2500), art: 'fakt', quellen: ['q1'] },
        ],
      },
    }, k());
    const texte = e.abschnitte.reputation!.map(a => a.text);
    expect(texte).toContain('[Vertriebsleitung] hat den Vertrieb umgebaut.');
    expect(texte).toContain('Anbieter im Gesundheitswesen mit drei Standorten.'); // Branche ≠ Gesundheit einer Person
    expect(texte.some(t => /erkrankt/.test(t))).toBe(false);
    expect(e.ausgelassen).toEqual(['Gesundheit']);
    expect(JSON.stringify(e)).not.toContain('erkrankt');
    const lang = e.abschnitte.reputation!.find(a => a.gekuerzt);
    expect(lang?.text.length).toBe(2000);
    expect(e.zaehler.namen).toBe(1);
  });
  it('A4: eine Karte, nur belegte Angaben, Negativliste mit Kategorie, unsichere Identität verworfen', () => {
    const roh = (identitaet: string) => ({
      quellen: [{ ref: 'q1', url: 'https://beispiel-firma.example/' }],
      personen: [{ funktion: 'egal', name: 'Erika Beispiel', identitaet, rolleSeit: '04/2022',
        werdegang: [{ text: 'Seit 2022 Vertriebsleitung.', art: 'fakt', quellen: ['q1'] }, { text: 'Geboren am 01.02.1980.', art: 'fakt', quellen: ['q1'] }, { text: 'Ohne Beleg.', art: 'fakt' }],
        themen: [{ text: 'Verheiratet, zwei Kinder.', art: 'fakt', quellen: ['q1'] }] }],
    });
    const e = ausgabePruefen('a4', roh('hoch'), k({ funktion: 'Vertriebsleitung' }));
    expect(e.karte?.funktion).toBe('Vertriebsleitung');
    expect(e.karte?.werdegang.map(a => a.text)).toEqual(['Seit 2022 Vertriebsleitung.']);
    expect(e.karte?.themen).toEqual([]);
    expect(e.ausgelassen.sort()).toEqual(['Familie', 'Geburtsdatum']);
    expect(e.abschnitte).toEqual({});
    expect(ausgabePruefen('a4', roh('niedrig'), k({ funktion: 'Vertriebsleitung' })).karte).toBeUndefined();
  });
  it('A12: Diagnose-Entwurf mit höchstens 5 Maßnahmen und 3 Quick Wins; A13: nur Befunde', () => {
    const e = ausgabePruefen('a12', { diagnose: {
      top5: Array.from({ length: 7 }, (_, i) => ({ text: `Maßnahme ${i}`, hebel: 'umwandlung', wirkung: 'hoch', aufwand: 'klein', evidenz: 'B' })),
      quickWins: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }], fragen: [{ frage: 'Wer führt Erstgespräche?', an: 'vertrieb', warum: 'Lücke' }, { frage: 'x', an: 'niemand' }],
    } }, k());
    expect(e.diagnose?.top5).toHaveLength(5);
    expect(e.diagnose?.quickWins).toEqual(['A', 'B', 'C']);
    expect(e.diagnose?.fragen).toHaveLength(1);
    const p = ausgabePruefen('a13', { befunde: [{ art: 'dsgvo', text: 'Name im Text', bezug: 'da-x1' }, { art: 'quatsch', text: 'y' }], abschnitte: { fazit: [{ text: 'darf nicht', quellen: [] }] } }, k());
    expect(p.befunde).toEqual([{ art: 'dsgvo', text: 'Name im Text', bezug: 'da-x1' }]);
    expect(p.abschnitte).toEqual({});
  });
});

describe('Prüfung und Freigaben', () => {
  const q = { id: 'dq-1', url: 'https://beispiel-firma.example/', domain: 'beispiel-firma.example', abgerufenAm: HEUTE };
  it('deterministisch: ohne Quelle, gesperrte Domain, Negativliste, Name im Unternehmensteil, Karte ohne LIA/F1 → Befunde', () => {
    const d = dossier({
      quellen: [q, { id: 'dq-2', url: 'https://xing.com/profil', abgerufenAm: HEUTE }],
      abschnitte: { unternehmen: { id: 'unternehmen', status: 'entwurf', aussagen: [
        { id: 'da-1', text: 'Belegt.', art: 'fakt', quellen: ['dq-1'], stand: HEUTE, agent: 'a1' },
        { id: 'da-2', text: 'Unbelegt.', art: 'fakt', quellen: [], stand: HEUTE, agent: 'a1' },
        { id: 'da-3', text: 'Erika Beispiel leitet den Vertrieb.', art: 'fakt', quellen: ['dq-1'], stand: HEUTE, agent: 'hand' },
      ] }, hypothesen: { id: 'hypothesen', status: 'entwurf', aussagen: [{ id: 'da-4', text: 'Vermutung ohne Quelle.', art: 'hypothese', quellen: [], stand: HEUTE, agent: 'a12' }] } },
    });
    const b = pruefeDossier(d, [karte({ identitaet: 'niedrig' })], HEUTE);
    const texte = b.map(x => `${x.art}:${x.bezug ?? ''}`);
    expect(texte).toContain('quelle:dq-2');
    expect(texte).toContain('quelle:da-2');
    expect(texte).not.toContain('quelle:da-4'); // Hypothesen brauchen keine Quelle
    expect(texte).toContain('dsgvo:da-3');
    expect(b.some(x => x.art === 'dsgvo' && /Interessenabwägung/.test(x.text))).toBe(true);
    expect(b.some(x => x.art === 'dsgvo' && /unsicher/.test(x.text))).toBe(true);
    expect(pruefungBestanden(b)).toBe(false);
    expect(belegQuote(d)).toBeCloseTo(2 / 3);
  });
  it('Art.-14-Uhr: überfällig blockiert; Löschtag fehlt nur, wenn das Mandatsende feststeht', () => {
    const d = dossier({ interessenabwaegung: { ...LIA_MUSTER, am: HEUTE, von: 'pia' }, f1: { am: HEUTE, von: 'pia', umfang: ['a4'], funktionen: ['Vertriebsleitung'] } });
    expect(pruefeDossier(d, [karte()], HEUTE)).toEqual([]);
    expect(pruefeDossier(d, [karte({ erfasstAm: '2026-08-01', art14: { faelligAm: '2026-09-01' } })], HEUTE).map(b => b.text).join(' ')).toMatch(/überfällig/);
    expect(pruefeDossier(d, [karte()], HEUTE, { mandatsEnde: '2026-12-31' }).map(b => b.text).join(' ')).toMatch(/Löschtag fehlt/);
    expect(art14Stand(karte({ erfasstAm: '2026-09-12', art14: { faelligAm: '2026-10-12' } }), HEUTE).stufe).toBe('bald');
    expect(loeschAmFuer('2026-12-31', 90)).toBe('2027-03-31');
    expect(art14Text({ verantwortlicher: 'Beispiel GmbH', herkunft: 'beispiel-firma.example', funktion: 'Vertriebsleitung', frist: '90 Tage' })).toMatch(/Beispiel GmbH/);
    expect(art14Text({})).toMatch(/\[verantwortlicher fehlt\]/);
  });
  it('Modell-Befunde: Qualität mit Grund überstimmbar, Datenschutz nie; verschwundener Bezug fällt weg', () => {
    const p = pruefungZusammen([], undefined, [{ art: 'qualitaet', text: 'Zahl unklar', bezug: 'da-1' }, { art: 'dsgvo', text: 'heikel', bezug: 'da-weg' }], b => b === 'da-1', HEUTE);
    expect(p.befunde).toHaveLength(1);
    expect(p.bestanden).toBe(false);
    const d0 = dossier({ pruefung: p });
    const r = dossierAnwenden(datei(d0), { op: 'ueberstimmen', mandatId: 'm-1', stand: ctx().standVon(d0), index: 0, grund: 'Zahl stammt aus dem Kick-off.' }, ctx());
    expect(r.ok && r.datei.dossiers['m-1'].pruefung?.bestanden).toBe(true);
    const d1 = dossier({ pruefung: { am: HEUTE, bestanden: false, befunde: [{ art: 'dsgvo', text: 'Name' }] } });
    const n1 = dossierAnwenden(datei(d1), { op: 'ueberstimmen', mandatId: 'm-1', stand: ctx().standVon(d1), index: 0, grund: 'Ich will das trotzdem.' }, ctx());
    expect(n1).toMatchObject({ ok: false, status: 403 });
    // F2 nur mit bestandener Prüfung
    expect(dossierAnwenden(datei(d1), { op: 'f2', mandatId: 'm-1', stand: ctx().standVon(d1) }, ctx())).toMatchObject({ ok: false, status: 409 });
    // Überstimmte Qualität bleibt bei der nächsten Prüfung überstimmt
    const p2 = pruefungZusammen([], r.ok ? r.datei.dossiers['m-1'].pruefung : undefined, [{ art: 'qualitaet', text: 'Zahl unklar', bezug: 'da-1' }], () => true, HEUTE);
    expect(p2.bestanden).toBe(true);
  });
});

describe('Dossier-Schritte', () => {
  it('anlegen säubert Domains; fremder Stand → 409; F1 nur mit Interessenabwägung und Funktion für A4', () => {
    expect(eingabenSaeubern({ firma: 'Beispiel GmbH', domains: ['https://www.Beispiel-Firma.example/x'], urls: [] })).toMatchObject({ ok: true, eingaben: { domains: ['beispiel-firma.example'] } });
    expect(eingabenSaeubern({ firma: 'Beispiel GmbH', domains: ['linkedin.com'], urls: [] })).toMatchObject({ ok: false, status: 400 });
    expect(domainSaeubern('kein domain')).toBeNull();
    const a = dossierAnwenden(leerDossiers(), { op: 'anlegen', mandatId: 'm-1', eingaben: { firma: 'Beispiel GmbH', domains: ['beispiel-firma.example'], urls: [] } }, ctx());
    expect(a.ok).toBe(true);
    const d = a.ok ? a.datei.dossiers['m-1'] : dossier();
    expect(dossierAnwenden(a.ok ? a.datei : leerDossiers(), { op: 'anlegen', mandatId: 'm-1', eingaben: { firma: 'x', domains: [], urls: [] } }, ctx())).toMatchObject({ status: 409 });
    expect(dossierAnwenden(datei(d), { op: 'eingaben', mandatId: 'm-1', stand: 'alt', eingaben: { firma: 'Neu' } }, ctx())).toMatchObject({ ok: false, status: 409 });
    expect(dossierAnwenden(datei(d), { op: 'f1', mandatId: 'm-1', stand: ctx().standVon(d), umfang: ['a1'], funktionen: [] }, ctx())).toMatchObject({ ok: false, status: 400 });
    const mitLia = { ...d, interessenabwaegung: { ...LIA_MUSTER, am: HEUTE, von: 'pia' } };
    expect(dossierAnwenden(datei(mitLia), { op: 'f1', mandatId: 'm-1', stand: ctx().standVon(mitLia), umfang: ['a4'], funktionen: [] }, ctx())).toMatchObject({ ok: false, status: 400 });
    expect(dossierAnwenden(datei(mitLia), { op: 'f1', mandatId: 'm-1', stand: ctx().standVon(mitLia), umfang: ['a4'], funktionen: ['Vertriebsleitung'] }, ctx()).ok).toBe(true);
  });
  it('übernehmen: nur angehakte Abschnitte, gleicher Agent ersetzt, Handeinträge bleiben, F2 fällt zurück', () => {
    const ergebnis = { abschnitte: { unternehmen: [{ id: 'da-n1', text: 'Neu', art: 'fakt', quellen: ['dq-n1'], stand: HEUTE, agent: 'a1' }], finanzen: [{ id: 'da-n2', text: 'Nicht angehakt', art: 'fakt', quellen: ['dq-n1'], stand: HEUTE, agent: 'a1' }] },
      quellen: [{ id: 'dq-n1', url: 'https://beispiel-firma.example/', abgerufenAm: HEUTE }], zaehler: { verworfen: 0, ohneQuelle: 0, gesperrt: 0, gekuerzt: 0, negativ: 0, namen: 0 }, ausgelassen: [] };
    const l = lauf('a1', 'fertig', { ergebnis });
    const d = dossier({ laeufe: [l], f2: { am: HEUTE, von: 'pia' }, abschnitte: { unternehmen: { id: 'unternehmen', status: 'geprueft', aussagen: [
      { id: 'da-alt', text: 'Alt', art: 'fakt', quellen: [], stand: HEUTE, agent: 'a1' }, { id: 'da-hand', text: 'Hand', art: 'fakt', quellen: [], stand: HEUTE, agent: 'hand' },
    ] } } });
    const r = dossierAnwenden(datei(d), { op: 'uebernehmen', mandatId: 'm-1', stand: ctx().standVon(d), laufId: l.id, abschnitte: ['unternehmen'] }, ctx());
    expect(r.ok).toBe(true);
    const neu = r.ok ? r.datei.dossiers['m-1'] : d;
    expect(neu.abschnitte.unternehmen?.aussagen.map(a => a.text)).toEqual(['Hand', 'Neu']);
    expect(neu.abschnitte.finanzen).toBeUndefined();
    expect(neu.f2).toBeUndefined();
    expect(neu.laeufe[0].status).toBe('uebernommen');
    expect(neu.quellen.map(q => q.id)).toEqual(['dq-n1']);
    // Ein laufender Lauf ist kein Entwurf
    const d2 = dossier({ laeufe: [lauf('a1', 'laeuft')] });
    expect(dossierAnwenden(datei(d2), { op: 'uebernehmen', mandatId: 'm-1', stand: ctx().standVon(d2), laufId: d2.laeufe[0].id, abschnitte: ['unternehmen'] }, ctx())).toMatchObject({ status: 409 });
  });
  it('Handeintrag braucht eine Quelle (außer Hypothesen/Fragen); gesperrte Domain abgelehnt', () => {
    const d = dossier();
    expect(dossierAnwenden(datei(d), { op: 'aussage-hand', mandatId: 'm-1', stand: ctx().standVon(d), abschnitt: 'unternehmen', text: 'x', art: 'fakt' }, ctx())).toMatchObject({ status: 400 });
    expect(dossierAnwenden(datei(d), { op: 'aussage-hand', mandatId: 'm-1', stand: ctx().standVon(d), abschnitt: 'unternehmen', text: 'x', art: 'fakt', url: 'https://linkedin.com/in/x' }, ctx())).toMatchObject({ status: 400 });
    expect(dossierAnwenden(datei(d), { op: 'aussage-hand', mandatId: 'm-1', stand: ctx().standVon(d), abschnitt: 'fragen', text: 'Wer entscheidet?', art: 'hypothese' }, ctx()).ok).toBe(true);
  });
  it('Antwort der Route: A4-Entwurf nur als Zähler, Leseteil-Kennung nur für die auslösende Person', () => {
    const d = dossier({ laeufe: [lauf('a4', 'fertig', { ergebnis: { funktion: 'Vertriebsleitung', karten: ['pp-1'], zaehler: {}, ausgelassen: [] } })], leseteil: { id: 'tb-geheim', person: 'pia', gestartetAm: HEUTE } });
    const fremd = dossierFuerAntwort(d, 'olaf', Date.now());
    expect(fremd.leseteil).toEqual({ gestartetAm: HEUTE, eigen: false });
    expect(JSON.stringify(fremd)).not.toContain('tb-geheim');
    expect((fremd.laeufe[0].ergebnis as { karten: number }).karten).toBe(1);
    expect(dossierFuerAntwort(d, 'pia', Date.now()).leseteil).toEqual({ gestartetAm: HEUTE, eigen: true, id: 'tb-geheim' });
    // gespeicherte Datei bleibt lesbar (Säuberer von C0)
    expect(dossiersAus(JSON.parse(JSON.stringify(datei(d)))).dossiers['m-1'].laeufe).toHaveLength(1);
  });
});

describe('Personenteil', () => {
  const k = { person: 'pia', heute: HEUTE, standVon: (x: PersonenKarte) => `${x.id}:${x.status}:${x.art14.gegebenAm ?? ''}:${x.werdegang.length}` };
  it('prüfen nur ohne Mängel; Art. 14 vermerken; Angabe entfernen setzt auf Entwurf; Stand → 409', () => {
    const ok = karte();
    expect(karteMaengel(ok)).toEqual([]);
    expect(karteMaengel(karte({ identitaet: 'niedrig' })).join(' ')).toMatch(/unsicher/);
    const dat = { ...leerPersonen(), karten: [ok] };
    const p = personenAnwenden(dat, { op: 'pruefen', id: ok.id, stand: k.standVon(ok), loeschAm: '2027-03-31' }, k);
    expect(p.ok && p.datei.karten[0]).toMatchObject({ status: 'geprueft', loeschAm: '2027-03-31' });
    expect(personenAnwenden(dat, { op: 'art14', id: ok.id, stand: 'alt', gegebenAm: HEUTE, wie: 'mail' }, k)).toMatchObject({ status: 409 });
    expect(personenAnwenden(dat, { op: 'art14', id: ok.id, stand: k.standVon(ok), gegebenAm: '2099-01-01', wie: 'mail' }, k)).toMatchObject({ status: 400 });
    const a = personenAnwenden(dat, { op: 'art14', id: ok.id, stand: k.standVon(ok), gegebenAm: HEUTE, wie: 'kickoff' }, k);
    expect(a.ok && a.datei.karten[0].art14).toMatchObject({ gegebenAm: HEUTE, wie: 'kickoff', von: 'pia' });
    const e = personenAnwenden(dat, { op: 'angabe-entfernen', id: ok.id, stand: k.standVon(ok), angabeId: 'da-w1' }, k);
    expect(e.ok && e.datei.karten[0]).toMatchObject({ werdegang: [], quellen: [], status: 'entwurf' });
    const l = personenAnwenden(dat, { op: 'loeschen', id: ok.id, stand: k.standVon(ok) }, k);
    expect(l.ok && l.datei.karten).toEqual([]);
  });
  it('Negativliste im Personenteil kennt Familie und volles Datum; im Unternehmensteil nur mit Personenbezug', () => {
    expect(negativTreffer('Seit 01.03.2015 im Haus', 'person')).toBe('Geburtsdatum');
    expect(negativTreffer('Gründung am 01.03.2015', 'unternehmen')).toBeNull();
    expect(negativTreffer('Zwei Kinder', 'person')).toBe('Familie');
    expect(negativTreffer('Geschäftsführer ist seit Monaten krank', 'unternehmen')).toBe('Gesundheit');
    expect(negativTreffer('Daten aus dem Transparenzregister', 'unternehmen')).toBe('Transparenzregister');
    expect(negativTreffer('wohnhaft in Musterstadt', 'unternehmen')).toBe('Wohnort');
    expect(namenErsetzen('Erika Beispiel und erika beispiel', [{ name: 'Erika Beispiel', funktion: 'GF' }]).ersetzt).toBe(2);
  });
});

describe('Netz und Quellen', () => {
  it('ipIntern: privat, Loopback, CGNAT, link-lokal, ULA, IPv4-mapped (auch hex) → intern; öffentlich → nicht', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.5.5', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fd12::1', 'fe80::1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', 'kein-ip']) expect(ipIntern(ip), ip).toBe(true);
    for (const ip of ['93.184.216.34', '2606:4700::1111']) expect(ipIntern(ip), ip).toBe(false);
    expect(oeffentlichesZiel([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }])).toBeNull();
    expect(oeffentlichesZiel([{ address: '93.184.216.34', family: 4 }])).toEqual({ adresse: '93.184.216.34', familie: 4 });
  });
  it('gesperrte Domains samt Subdomains; erlaubte Ziele nur Domains des Mandats und genannte Adressen', () => {
    for (const d of GESPERRTE_DOMAINS) expect(istGesperrt(`https://www.${d}/x`), d).toBe(true);
    expect(istGesperrt('https://beispiel-firma.example/')).toBe(false);
    const l = neuerWebLauf({ domains: ['beispiel-firma.example'], urls: ['https://presse.example/artikel#x'], heute: HEUTE });
    expect(zielErlaubt(l, 'https://shop.beispiel-firma.example/preise')).toBe(true);
    expect(zielErlaubt(l, 'https://presse.example/artikel')).toBe(true);
    expect(zielErlaubt(l, 'https://presse.example/anderer')).toBe(false);
    expect(zielErlaubt(l, 'https://angreifer.example/')).toBe(false);
  });
  it('robots.txt: unsere Gruppe vor `*`, längste Regel gewinnt; Teile zu 30.000 Zeichen', () => {
    const r = robotsLesen('User-agent: *\nDisallow: /intern\nAllow: /intern/presse\n\nUser-agent: anderer-bot\nDisallow: /');
    expect(robotsErlaubt(r, '/intern/x')).toBe(false);
    expect(robotsErlaubt(r, '/intern/presse/1')).toBe(true);
    expect(robotsErlaubt(r, '/')).toBe(true);
    const ende = robotsLesen('User-agent: *\nDisallow: /*.pdf$');
    expect(robotsErlaubt(ende, '/unterlagen/a.pdf')).toBe(false);
    expect(robotsErlaubt(ende, '/unterlagen/a.pdf?x=1')).toBe(true);
    const eigen = robotsLesen('User-agent: *\nDisallow:\n\nUser-agent: MAKE-OS-Recherche\nDisallow: /');
    expect(robotsErlaubt(eigen, '/irgendwas')).toBe(false);
    const t = teilVon('a'.repeat(WEB.zeichen + 5), 2);
    expect(t).toMatchObject({ teil: 2, teile: 2 });
    expect(t.inhalt).toHaveLength(5);
  });
});

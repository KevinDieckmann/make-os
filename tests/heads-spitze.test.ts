// Die Heads auf Spitzenniveau (25.09.): Grundlauf, Signal-Pflicht, Qualitätsrubrik,
// Rückholung, Lernen, Autonomie, Belege, Evals, Fehlerbild.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { grundlauf } from '../lib/heads/grundlauf';
import { normalisiere, pruefe, qualitaet, signalTraegt, type Vorschlag, type Antwort } from '../lib/heads/pruefer';
import { pflichtZurueck, fehlerGrund, riegel } from '../lib/heads/lauf';
import { lernstand, aenderung, wirkungsStufe, merksatzNeu } from '../lib/heads/lernen';
import { automatisch, ruecknehmbar, OHNE_AUTO_MODI } from '../lib/heads/autonomie';
import { anPfad, belege, auszug } from '../lib/heads/belege';
import { bewerte, passK } from '../lib/heads/eval';
import { dealSignale } from '../lib/heads/daten';
import { datenBlock, SYSTEM } from '../lib/heads/prompt';
import type { HeadVorschlag } from '../lib/heads/stand';

const HEUTE = '2026-09-25';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const v = (x: Partial<Vorschlag> = {}): Vorschlag => ({ art: 'nachfassen', titel: 'Anna anrufen wegen Angebot', begruendung: 'Sie hat am 22.09. geantwortet und wartet seit drei Tagen auf uns.', kontakt_id: 'c-a', chance_id: null, mandat_id: null, event_id: null, frist: HEUTE, prioritaet: 'mittel', dedup_schluessel: 'nachfassen:c-a', quelle: ['karten[0]'], entwurf: null, kampagne: null, ...x });
const hv = (x: Partial<HeadVorschlag> = {}): HeadVorschlag => ({ ...v(), id: 'hs-1', status: 'offen', erstellt: '2026-09-20T08:00:00Z', aktualisiert: '2026-09-20T08:00:00Z', berichtId: 'hb-1', ...x });
const antwort = (vs: Vorschlag[], x: Partial<Antwort> = {}): Antwort => ({ status: 'handeln', zusammenfassung: 'x', befunde: [], vorschlaege: vs, fragen: [], datenluecken: [], antwort: '', ...x });

describe('Grundlauf — Vorschläge ohne Modell', () => {
  it('Power Hour: Zusagen hoch mit Signal, Pflege niedrig, Quelle je Karte', () => {
    const daten = { meta: { heute: HEUTE }, karten: [
      { id: 'c-a', name: 'Anna', firma: 'Acme', kategorie: 'versprechen', gruende: ['Zugesagt: Angebot schicken'], kanal_erlaubt: ['telefon'], naechster_schritt: { text: 'Angebot', datum: '2026-09-24' } },
      { id: 'c-b', name: 'Ben', kategorie: 'pflege', gruende: ['Kreis A: 42 Tage still'], kanal_erlaubt: ['telefon'], letzter_kontakt: '2026-08-14' },
    ] };
    const g = grundlauf('sales', 'power_hour', daten).antwort;
    expect(g.vorschlaege.map(x => [x.prioritaet, x.quelle[0], x.signal?.typ])).toEqual([['hoch', 'karten[0]', 'zusage'], ['niedrig', 'karten[1]', 'pflege']]);
    expect(g.vorschlaege[0].titel).toBe('Zusage einlösen: Anna (Acme)');
    expect(g.zusammenfassung).toContain('2 Vorschläge');
  });
  it('Kundenreview: abgelaufene Laufzeit bleibt „hoch“ (Fristsignal), Konzentration als Befund', () => {
    const daten = { meta: { heute: HEUTE }, mandate: [{ id: 'm-1', kunde: 'Acme', status: 'aktiv', lage: { kuendigungIn: -38, ampel: 'gelb', gruende: [], fristBis: null, endeAm: '2026-08-18' }, offene_punkte: ['Honorar offen'], ansprechpartner: [] }], konzentration: { kunde: 'Acme', anteil: 100 } };
    const g = grundlauf('sales', 'kundenreview', daten).antwort;
    const p = pruefe(g, daten, [], { ...leererBestand(), mandate: [{ id: 'm-1' } as never] }, HEUTE);
    expect(p.antwort.vorschlaege[0]).toMatchObject({ art: 'verlaengerung_ansprechen', prioritaet: 'hoch' });
    expect(g.befunde.map(b => b.titel)).toContain('Kundenkonzentration');
  });
  it('ohne Daten: ruhig mit Datenlücke statt erfundener Arbeit', () => {
    const g = grundlauf('sales', 'deal_review', { meta: { heute: HEUTE }, chancen: [] }).antwort;
    expect(g.status).toBe('ruhig');
    expect(g.datenluecken[0]).toContain('Keine offene Chance');
  });
});

describe('Prüfer — Signal-Pflicht und Qualitätsrubrik', () => {
  it('„hoch“ ohne frisches Signal wird „mittel“; Pflicht-Signale tragen auch älter', () => {
    expect(signalTraegt({ signal: { typ: 'antwort', datum: '2026-09-20', text: '' } }, HEUTE)).toBe(true);
    expect(signalTraegt({ signal: { typ: 'antwort', datum: '2026-08-01', text: '' } }, HEUTE)).toBe(false);
    expect(signalTraegt({ signal: { typ: 'frist', datum: null, text: '' } }, HEUTE)).toBe(true);
    const p = pruefe(antwort([v({ prioritaet: 'hoch', signal: null })]), {}, [k('a')], leererBestand(), HEUTE);
    expect(p.antwort.vorschlaege[0].prioritaet).toBe('mittel');
    expect(p.pruefung.maengel?.[0].maengel.join()).toContain('ohne frisches Signal');
  });
  it('Entwurf: falsche Anrede und Platzhalter machen ihn unbrauchbar, Länge ist nur ein Mangel', () => {
    const sie = k('a', { anrede: 'Sie' }), du = k('b', { anrede: 'Du' });
    expect(qualitaet(v({ entwurf: { kanal: 'telefon', text: 'Hallo Anna, hast du kurz Zeit?' } }), sie, HEUTE)).toMatchObject({ entwurfUnbrauchbar: true });
    expect(qualitaet(v({ entwurf: { kanal: 'telefon', text: 'Hallo Ben, passt Ihnen Freitag?' } }), du, HEUTE).maengel.join()).toContain('Sie statt Du');
    expect(qualitaet(v({ entwurf: { kanal: 'mail', text: 'Hallo [Name], kurze Frage.' } }), sie, HEUTE).entwurfUnbrauchbar).toBe(true);
    const lang = qualitaet(v({ entwurf: { kanal: 'mail', text: Array(95).fill('Wort').join(' ') } }), sie, HEUTE);
    expect(lang.entwurfUnbrauchbar).toBe(false);
    expect(lang.maengel.join()).toContain('zu lang');
  });
  it('dünne Begründung, fehlende Frist und fehlender Beleg sind Mängel', () => {
    const q = qualitaet(v({ begruendung: 'weil', frist: null, quelle: [] }), k('a'), HEUTE);
    expect(q.maengel).toEqual(expect.arrayContaining(['ohne Frist', 'ohne Beleg (quelle)', 'Begründung zu dünn — warum gerade jetzt?']));
  });
  it('normalisiert Signal und unbekannte Arten nie zu „merken“', () => {
    const n = normalisiere({ status: 'handeln', zusammenfassung: 'x', vorschlaege: [{ ...v(), art: 'quatsch', signal: { typ: 'bla', datum: '2026-09-22', text: 't' } }] }, 'sales');
    expect(n.vorschlaege[0].art).toBe('daten_pflegen');
    expect(n.vorschlaege[0].signal).toEqual({ typ: 'sonstiges', datum: '2026-09-22', text: 't' });
  });
});

describe('Evaluator-Optimizer: Pflicht aus dem Grundlauf kommt zurück', () => {
  it('„hoch“ aus dem Regelwerk, das das Modell weder übernahm noch begründet verwarf, kehrt zurück', () => {
    const g = [v({ prioritaet: 'hoch', dedup_schluessel: 'a' }), v({ prioritaet: 'hoch', dedup_schluessel: 'b' }), v({ prioritaet: 'mittel', dedup_schluessel: 'c' })];
    const ki = antwort([v({ dedup_schluessel: 'x' })], { verworfen: [{ dedup_schluessel: 'b', grund: 'schon erledigt laut Verlauf' }] });
    const r = pflichtZurueck(ki, g);
    expect(r.map(x => [x.dedup_schluessel, x.herkunft])).toEqual([['x', 'ki'], ['a', 'regelwerk']]);
  });
  it('Riegel je Person nur für die Power Hour', () => {
    expect(riegel('power_hour', 'malin')).toBe('power_hour:malin');
    expect(riegel('deal_review', 'malin')).toBe('deal_review');
  });
});

describe('Lernen aus Entscheidungen', () => {
  const kontakte = [k('a', { aktivitaeten: [{ am: '2026-09-21T10:00:00Z', art: 'termin', von: 'kevin' }] }), k('b')];
  it('Annahmequote je Art, Hinweis bei niedriger Quote, Selbst-Übernommenes zählt nicht als Zustimmung', () => {
    const l = lernstand([
      hv({ id: '1', art: 'anrufen', status: 'abgelehnt', grund: 'zeitpunkt' }), hv({ id: '2', art: 'anrufen', status: 'abgelehnt', grund: 'zeitpunkt' }),
      hv({ id: '3', art: 'anrufen', status: 'abgelehnt' }), hv({ id: '4', art: 'anrufen', status: 'angenommen', entschieden: '2026-09-20T09:00:00Z' }),
      hv({ id: '5', art: 'review_ansetzen', status: 'angenommen', auto: { am: '2026-09-20T09:00:00Z', wirkung: 'Aufgabe' }, entschieden: '2026-09-20T09:00:00Z' }),
    ], kontakte, HEUTE);
    expect(l.je_art.find(a => a.art === 'anrufen')?.quote).toBe(25);
    expect(l.je_art.find(a => a.art === 'review_ansetzen')).toBeUndefined();
    expect(l.hinweise.join()).toContain('falscher Zeitpunkt');
  });
  it('Wirkungsleiter: Termin nach dem Annehmen, keine Wirkung nach Fristablauf', () => {
    const m = new Map(kontakte.map(x => [x.id, x]));
    expect(wirkungsStufe(hv({ status: 'angenommen', entschieden: '2026-09-20T08:00:00Z', frist: '2026-09-22' }), m, HEUTE)).toBe('termin');
    expect(wirkungsStufe(hv({ kontakt_id: 'c-b', status: 'angenommen', entschieden: '2026-09-01T08:00:00Z', frist: '2026-09-02' }), m, HEUTE)).toBe('keine');
    const crm = { chancen: [{ kontaktIds: ['c-b'], angelegt: '2026-09-03T08:00:00Z' } as Chance] };
    expect(wirkungsStufe(hv({ kontakt_id: 'c-b', status: 'angenommen', entschieden: '2026-09-01T08:00:00Z', frist: '2026-09-02' }), m, HEUTE, crm)).toBe('chance');
  });
  it('Änderungsgrad: unverändert 0, neu geschrieben hoch', () => {
    expect(aenderung('Hallo Anna, passt Freitag?', 'Hallo Anna, passt Freitag?')).toBe(0);
    expect(aenderung('Hallo Anna, passt Freitag?', 'Liebe Frau Weber, wie wäre ein kurzer Anruf nächste Woche')).toBeGreaterThan(70);
  });
  it('Beispiele nach Ähnlichkeit: gleicher Modus zuerst', () => {
    const l = lernstand([hv({ id: 'a', titel: 'Aus Power Hour', modus: 'power_hour', status: 'angenommen', entschieden: '2026-09-24T08:00:00Z' }), hv({ id: 'b', titel: 'Aus Deal-Review', modus: 'deal_review', status: 'angenommen', entschieden: '2026-09-20T08:00:00Z' })], [], HEUTE, 'deal_review');
    expect(l.muster_angenommen[0].titel).toBe('Aus Deal-Review');
  });
  it('Merksätze: gesäubert, keine Dubletten, höchstens 30', () => {
    let m = merksatzNeu([], '  Kunden   immer per Du ', 'kevin', '2026-09-25T08:00:00Z', 'hand');
    m = merksatzNeu(m, 'kunden immer per du', 'malin', '2026-09-25T09:00:00Z', 'hand');
    expect(m.map(x => x.text)).toEqual(['Kunden immer per Du']);
  });
});

describe('Autonomie — interne Kleinigkeiten selbst, alles nach außen zur Freigabe', () => {
  it('Regeln', () => {
    expect(automatisch(hv({ entwurf: { kanal: 'mail', text: 'x' } }), k('a'))).toBeNull();
    expect(automatisch(hv({ kampagne: { playbook: 'p', name: 'n', ziel: 'z', kontakt_ids: [] } }), k('a'))).toBeNull();
    expect(automatisch(hv({ art: 'merken' }), undefined)).toBeNull();
    expect(automatisch(hv(), k('a'))).toBe('schritt');
    expect(automatisch(hv(), k('a', { naechsterSchritt: { text: 'schon da', datum: HEUTE } }))).toBe('aufgabe');
    expect(automatisch(hv({ art: 'daten_pflegen' }), k('a'))).toBe('aufgabe');
    expect(automatisch(hv(), k('a', { werbesperre: { seit: '2026-09-01', grund: 'x' } }))).toBeNull();
    expect(automatisch(hv({ kontakt_id: null }), undefined)).toBe('aufgabe');
    expect(OHNE_AUTO_MODI.has('power_hour')).toBe(true);
  });
  it('Rücknahme nur, wenn niemand inzwischen etwas geändert hat', () => {
    const s = hv({ auto: { am: HEUTE, wirkung: 'x', rueckgaengig: { art: 'schritt', kontaktId: 'c-a', vorher: null } } });
    expect(ruecknehmbar(s, k('a', { naechsterSchritt: { text: s.titel, datum: HEUTE } }), undefined)).toBe(true);
    expect(ruecknehmbar(s, k('a', { naechsterSchritt: { text: 'von Hand geändert', datum: HEUTE } }), undefined)).toBe(false);
    const a = hv({ auto: { am: HEUTE, wirkung: 'x', rueckgaengig: { art: 'aufgabe', aufgabeId: 'hd-1' } } });
    expect(ruecknehmbar(a, undefined, { status: 'todo', createdAt: 'x', updatedAt: 'x' })).toBe(true);
    expect(ruecknehmbar(a, undefined, { status: 'done', createdAt: 'x', updatedAt: 'y' })).toBe(false);
  });
});

describe('Belege', () => {
  const daten = { karten: [{ name: 'Anna', gruende: ['Zugesagt: Angebot'], kanal_erlaubt: ['telefon'] }], chancen: [{ naechster_schritt: { text: 'Angebot', datum: '2026-09-24' } }] };
  it('Pfade auflösen, Auszüge verdichten, leere Pfade melden', () => {
    expect(anPfad(daten, 'chancen[0].naechster_schritt.datum')).toBe('2026-09-24');
    expect(anPfad(daten, 'karten[5]')).toBeUndefined();
    expect(auszug(daten.karten[0])).toBe('name: Anna · gruende: Zugesagt: Angebot');
    expect(belege(daten, ['karten[0]', 'mandate[0]']).insLeere).toEqual(['mandate[0]']);
  });
});

describe('Evals — pass^k', () => {
  it('eine gute Antwort besteht alles, eine schlechte fällt genau dort durch', () => {
    const kontakte = [k('a', { telefon: '030 1', anrede: 'Sie' })];
    const daten = { meta: { heute: HEUTE }, karten: [{ id: 'c-a', wert: 3000 }] };
    const gut = bewerte(antwort([v({ signal: { typ: 'antwort', datum: '2026-09-22', text: 'Antwort' }, prioritaet: 'hoch' })]), daten, kontakte, leererBestand(), HEUTE);
    expect(gut.bestanden).toBe(gut.von);
    const schlecht = bewerte(antwort([v({ kontakt_id: 'c-erfunden', dedup_schluessel: 'x', quelle: ['nirgends[0]'] }), v({ prioritaet: 'hoch', entwurf: { kanal: 'persoenlich', text: 'Hey, hast du Zeit?' } })], { zusammenfassung: 'Ich habe die Mail gesendet.' }), daten, kontakte, leererBestand(), HEUTE);
    const nicht = schlecht.punkte.filter(p => !p.bestanden).map(p => p.id);
    expect(nicht).toEqual(expect.arrayContaining(['ids', 'vollzug', 'belege', 'signal', 'entwurf']));
    expect(nicht).not.toContain('kanal');
  });
  it('pass^k: nur bestanden, wenn alle Wiederholungen bestehen', () => {
    const ok = { punkte: [{ id: 'ids', label: '', bestanden: true }], bestanden: 1, von: 1 };
    const nein = { punkte: [{ id: 'ids', label: '', bestanden: false }], bestanden: 0, von: 1 };
    expect(passK([[ok, ok, ok], [ok, nein, ok]]).find(p => p.id === 'ids')?.quote).toBe(50);
  });
});

describe('Betrieb', () => {
  it('Fehlerbild nach Status, nicht nach Textsuche allein', () => {
    expect(fehlerGrund(400, 'Your credit balance is too low')).toBe('Guthaben aufgebraucht');
    expect(fehlerGrund(402, '')).toBe('Guthaben aufgebraucht');
    expect(fehlerGrund(429, '')).toContain('429');
    expect(fehlerGrund(529, 'overloaded')).toContain('überlastet');
  });
  it('Datenblock mit wechselnder Kennung; System-Text lang genug für den Prompt-Cache', () => {
    expect(datenBlock({ a: 1 }, 'x1y2')).toBe('<daten_x1y2>\n{\n "a": 1\n}\n</daten_x1y2>');
    // ~4 Zeichen je Token (Deutsch eher weniger): über 1.024 Token braucht es > 4.100 Zeichen.
    for (const h of ['sales', 'marketing', 'event'] as const) expect(SYSTEM[h].length).toBeGreaterThan(4100);
  });
  it('Deal-Signale aus dem Code: Lücken, negative und positive Signale', () => {
    const c = { id: 'ch-1', titel: 'x', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'diagnose', historie: [{ stufe: 'bedarf', am: '2026-08-01T00:00:00Z', von: 'kevin' }, { stufe: 'diagnose', am: '2026-09-20T00:00:00Z', von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'unklar', budget: 'nein', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: '2026-08-01T00:00:00Z', geaendert: '', letzteAktivitaet: '2026-09-01', erwartetAm: '2026-09-10' } as Chance;
    const s = dealSignale(c, [k('a', { aktivitaeten: [{ am: '2026-09-23T10:00:00Z', art: 'antwort', von: 'kevin' }] })], HEUTE);
    expect(s.luecken).toEqual(['Entscheider: unklar', 'Budget: nein']);
    expect(s.negativ).toEqual(expect.arrayContaining(['nur ein Ansprechpartner', 'kein datierter nächster Schritt', 'Entscheidungstermin 2026-09-10 verstrichen', 'ohne Wert', 'seit 24 Tagen keine Aktivität']));
    expect(s.positiv).toEqual(expect.arrayContaining(['Antwort am 2026-09-23', 'vorgerückt in diagnose am 2026-09-20', 'mindestens vier Qualifizierungsfragen geklärt']));
  });
});

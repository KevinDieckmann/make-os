// ─── Qualifizierung & Scoring — Herkunft, Editor-Hilfen, Vorschau, Gründe, Adressen, Lead-Zeile der Akte (03.10.) ──────
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event, Teilnahme } from '@/lib/crm/typen';
import { herkunftVon, letzteAktivitaetText } from '@/lib/crm/herkunft';
import { leadGruende, grundLabel, istGrundRaus, istGrundParken } from '@/lib/crm/lead-grund';
import { standardScoring, vorschlagScoring, scoringPruefen } from '@/lib/crm/scoring';
import { idAusName, frageNeu, kriteriumAusMessung, freieMessungen, kriteriumEntfernen, kriteriumHinzufuegen, teilEntfernen, teilHinzufuegen, maxPunkte, istGeaendert, kopie } from '@/lib/crm/scoring-bearbeiten';
import { scoringVorschau } from '@/lib/crm/scoring-vorschau';
import { leads, leadZeileFuer, offeneFragen } from '@/lib/crm/leads';
import { aufloesen, qualifizierungLink, markttraktion, LEISTE, BEREICHE } from '@/lib/crm/adresse';

const HEUTE = '2026-10-03';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] } as CrmBestand);
const ev = (id: string, x: Partial<Event> = {}): Event => ({ id, titel: `Event ${id}`, format: 'stammtisch', ziel: '', datum: '2026-09-12', status: 'durchgefuehrt', geaendert: '2026-09-12', ...x } as Event);
const tn = (eventId: string, kontaktId: string, status: Teilnahme['status'] = 'da'): Teilnahme => ({ id: `t-${eventId}-${kontaktId}`, eventId, kontaktId, status, geaendert: '2026-09-12' });

describe('Herkunft', () => {
  const crm = { ...leer(), firmen: [{ id: 'f-kunde', name: 'Kunde GmbH', rolle: 'kunde', geaendert: '' }], events: [ev('e1', { marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde' } }), ev('m1')], teilnahmen: [tn('e1', 'c-a1'), tn('m1', 'c-a1'), tn('m1', 'c-a1', 'abgesagt')],
    kampagnen: [{ id: 'kp-1', name: 'Frühjahr', kontaktIds: ['c-a1'], ergebnisse: [{ kontaktId: 'c-a1', ergebnis: 'gespraech', am: '2026-09-20T10:00:00Z' }] } as never] } as unknown as CrmBestand;
  it('besuchtes Event mit Kunde, Make.One, Kampagne, Empfehlung, letzte Aktivität', () => {
    const p = k('c-a1', { herkunft: 'empfehlung', quelle: 'Frau Muster', aktivitaeten: [{ am: '2026-09-30T10:00:00Z', art: 'anruf', von: 'kevin' }, { am: '2026-10-01T10:00:00Z', art: 'system', von: 'system' }] });
    const h = herkunftVon([p], crm);
    const texte = h.teile.map(t => t.text);
    expect(texte.some(t => t.startsWith('Besuchtes Event · Event e1') && t.includes('für Kunde Kunde GmbH'))).toBe(true);
    expect(texte.some(t => t.startsWith('Make.One · Event m1'))).toBe(true);
    expect(texte.some(t => t.startsWith('Kampagne · Frühjahr'))).toBe(true);
    expect(texte).toContain('Empfehlung · Frau Muster');
    expect(h.teile.find(t => t.art === 'event')!.href).toContain('s=besuche');
    expect(letzteAktivitaetText(h, HEUTE)).toBe('Letzte Aktivität: Anruf vor 3 Tagen');
    expect(letzteAktivitaetText({}, HEUTE)).toBe('Noch keine Aktivität');
  });
  it('Visitenkarte und Sprachnotiz aus der Ablage; kennengelernt für Kunde auch ohne Teilnahme', () => {
    const p = k('c-b1', { kennengelerntFuer: [{ firmaId: 'f-kunde', eventId: 'e1', am: '2026-09-12' }] } as Partial<Kontakt>);
    const h = herkunftVon([p], crm, [
      { id: 'd-1', kontaktId: 'c-b1', titel: 'Visitenkarte 1/1 · Netzwerken', datei: { typ: 'image/jpeg', name: 'v.jpg' } },
      { id: 'd-2', kontaktId: 'c-b1', titel: 'Sprachnotiz bei „Event e1“', datei: { typ: 'audio/webm', name: 's.webm' } },
      { id: 'd-3', kontaktId: 'c-b1', titel: 'Vertrag', datei: { typ: 'application/pdf', name: 'v.pdf' } },
      { id: 'd-4', kontaktId: 'c-fremd', titel: 'Visitenkarte', datei: { typ: 'image/png', name: 'x.png' } },
    ]);
    expect(h.teile.filter(t => t.dateiId).map(t => [t.art, t.dateiId])).toEqual([['visitenkarte', 'd-1'], ['sprache', 'd-2']]);
    expect(h.teile.some(t => t.text.startsWith('Kennengelernt für Kunde Kunde GmbH · Event e1'))).toBe(true);
  });
});

describe('Gründe für Raus und Parken', () => {
  it('feste Listen, Auswertung zählt ausgeschiedene und geparkte, „ohne Angabe“ für Altbestand', () => {
    expect(istGrundRaus('zu_klein')).toBe(true); expect(istGrundRaus('spaeter')).toBe(false); expect(istGrundParken('spaeter')).toBe(true);
    const g = leadGruende([{ status: 'kein_fit', grundArt: 'zu_klein' }, { status: 'kein_fit', grundArt: 'zu_klein' }, { status: 'kein_fit' }, { status: 'ruht', grundArt: 'spaeter' }, { status: 'neu' }]);
    expect(g).toMatchObject({ nAus: 3, nGeparkt: 1 });
    expect(g.ausgeschieden[0]).toMatchObject({ art: 'zu_klein', anzahl: 2, label: grundLabel('zu_klein') });
    expect(g.ausgeschieden[1]).toMatchObject({ art: 'ohne', label: 'ohne Angabe' });
  });
});

describe('Editor-Hilfen', () => {
  it('Kennungen: sauber und eindeutig', () => {
    expect(idAusName('Größe & Umsatz!', [])).toBe('grosse-umsatz');
    expect(idAusName('Schmerz', ['schmerz'])).toBe('schmerz-2');
    expect(idAusName('123', [])).toMatch(/^[a-z]/);
  });
  it('Frage hinzufügen/entfernen hält die Einstellungen gültig; Muss-Verweise fallen mit', () => {
    let e = vorschlagScoring();
    e = kriteriumHinzufuegen(e, 'sales', 'potenzial', frageNeu(e, 'Referenzkunde'));
    expect(scoringPruefen(e)).toEqual([]);
    expect(maxPunkte(e, 'sales')).toBe(75);
    e = kriteriumEntfernen(e, 'sales', 'zeitpunkt');
    expect(scoringPruefen(e)).toEqual([]);
    expect(e.sales.muss.find(m => m.kriterien.includes('budget'))!.kriterien).toEqual(['budget']);
    e = kriteriumEntfernen(e, 'sales', 'schmerz');
    expect(e.sales.muss.some(m => m.kriterien.includes('schmerz'))).toBe(false);
    expect(scoringPruefen(e)).toEqual([]);
  });
  it('Signal aus dem Katalog hinzufügen — nur noch nicht verwendete', () => {
    let e = standardScoring();
    expect(freieMessungen(e)).toContain('makeone');
    e = kriteriumHinzufuegen(e, 'marketing', 'waerme', kriteriumAusMessung(e, 'makeone'));
    expect(freieMessungen(e)).not.toContain('makeone');
    expect(scoringPruefen(e)).toEqual([]);
  });
  it('Blöcke: hinzufügen, entfernen (mit Kriterien), der letzte bleibt', () => {
    let e = vorschlagScoring();
    e = teilEntfernen(e, 'sales', 'potenzial');
    expect(e.sales.teile.map(t => t.id)).toEqual(['fit', 'qualifikation']);
    const r = teilHinzufuegen(e, 'sales', 'Neuer Block');
    expect(r.e.sales.teile.at(-1)).toMatchObject({ id: 'neuer-block', kriterien: [] });
    let eins = { ...e, sales: { ...e.sales, teile: [e.sales.teile[0]] } };
    expect(teilEntfernen(eins, 'sales', 'fit')).toBe(eins);
    eins = kopie(eins);
    expect(istGeaendert(e, kopie(e))).toBe(false);
    expect(istGeaendert(e, { ...kopie(e), sales: { ...kopie(e.sales), schwelle: 99 } })).toBe(true);
  });
});

describe('Vorschau der Wirkung', () => {
  const kontakte = [
    k('c-1', { firmaId: 'f-1', firma: 'Eins', eignung: 'ja', email: 'a@example.invalid', aktivitaeten: [{ am: '2026-09-25T10:00:00Z', art: 'gespraech', von: 'kevin' }] }),
    k('c-2', { firmaId: 'f-2', firma: 'Zwei' }),
  ];
  const crm = { ...leer(), firmen: [{ id: 'f-1', name: 'Eins', rolle: 'zielkunde', geaendert: '' }, { id: 'f-2', name: 'Zwei', rolle: 'zielkunde', geaendert: '' }] } as CrmBestand;
  it('gleiche Einstellungen: nichts ändert sich; Vorschlag: Zahlen vorher/nachher stimmen mit den Lead-Zeilen überein', () => {
    const gleich = scoringVorschau(kontakte, crm, HEUTE, undefined, standardScoring());
    expect(gleich).toMatchObject({ anzahl: 2, wechsler: 0, beispiele: [] });
    const v = scoringVorschau(kontakte, crm, HEUTE, undefined, vorschlagScoring());
    const nach = leads(kontakte, { ...crm, scoring: vorschlagScoring() }, HEUTE);
    expect(v.mql[1]).toBe(nach.filter(z => z.score.scoring!.marketing.erreicht).length);
    expect(v.temperatur.kalt[0] + v.temperatur.lau[0] + v.temperatur.warm[0] + v.temperatur.heiss[0]).toBe(2);
    expect(v.wechsler).toBeGreaterThan(0);
    expect(v.beispiele.length).toBeGreaterThan(0);
  });
});

describe('Lead-Zeile der Akte = Zeile der Leads-Liste', () => {
  it('derselbe Score, auch mit eigenen Einstellungen — mit Firma, ohne Firma, mit Haupt-Ansprechpartner', () => {
    const ks = [k('c-1', { firmaId: 'f-1', firma: 'Eins', eignung: 'ja', email: 'a@example.invalid' }), k('c-2', { firmaId: 'f-1', firma: 'Eins', telefon: '1' }), k('c-3', { eignung: 'vielleicht' })];
    const crm = { ...leer(), scoring: vorschlagScoring(), firmen: [{ id: 'f-1', name: 'Eins', rolle: 'zielkunde', geaendert: '', lead: { status: 'qualifizierung', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, stufen: { champion: 's5' }, hauptKontaktId: 'c-2' } }] } as CrmBestand;
    const alle = leads(ks, crm, HEUTE);
    for (const p of ks) {
      const z = leadZeileFuer(p, ks, crm, HEUTE)!;
      const voll = alle.find(x => x.id === z.id)!;
      expect(z.score, p.id).toEqual(voll.score);
      expect(z.hauptKontaktId).toBe(voll.hauptKontaktId);
    }
    expect(alle.find(z => z.id === 'f-1')!.hauptKontaktId).toBe('c-2');
    expect(offeneFragen(alle.find(z => z.id === 'f-1')!)).toBe(9); // 12 Fragen, „Fit“ aus der Liste (Messung) zählt nicht, Schmerz und Champion beantwortet
  });
});

describe('Adressen — alte Links bleiben', () => {
  it('„Qualifizierung & Scoring“: Kennung und leere Ansicht bleiben, neue Ansichten kommen dazu', () => {
    expect(BEREICHE).toContain('qualifizierung');
    expect([...LEISTE.links, ...LEISTE.mitte, ...LEISTE.rechts]).toContain('qualifizierung');
    expect(aufloesen('qualifizierung', null)).toEqual({ s: 'qualifizierung' });
    expect(aufloesen('qualifizierung', 'runde')).toEqual({ s: 'qualifizierung' });
    expect(aufloesen('qualifizierung', 'scoring')).toEqual({ s: 'qualifizierung', a: 'scoring' });
    expect(aufloesen('qualifizierung', 'scoring-sales')).toEqual({ s: 'qualifizierung', a: 'scoring-sales' });
    expect(aufloesen('qualifizierung', 'quatsch')).toEqual({ s: 'qualifizierung' });
    expect(markttraktion('qualifizierung')).toBe('/os/markttraktion?s=qualifizierung');
    expect(qualifizierungLink()).toBe('/os/markttraktion?s=qualifizierung');
    expect(qualifizierungLink('f-abc')).toBe('/os/markttraktion?s=qualifizierung&k=f-abc');
    expect(qualifizierungLink(undefined, 'scoring-sales')).toBe('/os/markttraktion?s=qualifizierung&a=scoring-sales');
    expect(qualifizierungLink('../böse')).toBe('/os/markttraktion?s=qualifizierung');
  });
});

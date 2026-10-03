// ─── Qualifizierung & Scoring: die Oberfläche zeichnet ohne Fehler (Server-Render, erfundene Daten, 03.10.) ───
// Kein Browser, kein Netz: Fragen, Score-Kopf, Herkunft, Gesprächsmodus, Scoring-Editor (Marketing, Sales), Vorschau, Dialoge.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmApi } from '@/components/os/crm/daten';
import { standardScoring, bisherigeRechnung } from '@/lib/crm/scoring';
import { leads } from '@/lib/crm/leads';
import { herkunftVon } from '@/lib/crm/herkunft';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

// Die Firmenkarte bettet Aufgaben und Termine ein (eigene Kontexte/Abrufe) — hier nur Platzhalter.
vi.mock('@/components/os/aufgaben/AufgabenAkte', () => ({ AufgabenAkte: () => null }));
vi.mock('@/components/os/kalender/TermineAkte', () => ({ TermineAkte: () => null, useNaechsterTermin: () => null, useTerminZeiten: () => undefined }));

const J = '2026-10-03T10:00:00.000Z';
const K: Kontakt[] = [
  { id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', telefon: '123', position: 'Einkauf', firmaId: 'f-muster', firma: 'Muster GmbH', eignung: 'ja', prio: '', stufe: 'gespraech', aktivitaeten: [{ am: '2026-09-30T10:00:00Z', art: 'anruf', von: 'kevin' }], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', besitzer: 'kevin' },
  { id: 'c-bert1', vorname: 'Bert', nachname: 'Chef', position: 'Geschäftsführer', firmaId: 'f-muster', firma: 'Muster GmbH', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' },
] as Kontakt[];
const stand = (scoring = standardScoring()): CrmBestand => ({ firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', geaendert: J, branche: 'Maschinenbau', stadt: 'Köln' }], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], scoring } as CrmBestand);
const api = (scoring = standardScoring()) => ({ crm: { ok: true, heute: '2026-10-03', stand: stand(scoring), ich: 'kevin' }, kontakte: K, ich: 'kevin', laden: async () => {}, setze: async () => {}, teil: async () => {}, kontaktTeil: async () => true, kontaktSetzen: async () => true, aktivitaet: async () => ({ ok: true }), fehler: null, hinweis: null, setFehler: () => {}, setHinweis: () => {}, uebergeben: async () => ({ ok: true }), weg: async () => {}, netzwerk: async () => ({ ok: true }) } as unknown as CrmApi);
const zeile = (scoring = standardScoring()) => leads(K, stand(scoring), '2026-10-03')[0];

describe('Qualifizierung zeichnet', () => {
  it('Fragen: Blöcke, Muss-Marken, Punkte, die Fit-Frage aus der Liste', async () => {
    const { Fragen } = await import('@/components/os/crm/quali/Fragen');
    const e = standardScoring(); const z = zeile(e);
    const html = renderToStaticMarkup(h(Fragen, { einstellungen: e, score: z.score, stufen: {}, antworten: {}, onStufe: () => {}, onAntwort: () => {} }));
    for (const t of ['Fit', 'Qualifikation (MEDDICC · BANT)', 'Potenzial', 'Schmerz', 'Entscheider', 'Fürsprecher im Haus', 'Folgeauftrag &amp; Empfehlung', 'Muss', 'aus der Liste: Passt']) expect(html, t).toContain(t);
  });
  it('Score-Kopf: Punkte, Temperatur, MQL und SQL gegen ihre Schwellen', async () => {
    const { ScoreKopf } = await import('@/components/os/crm/quali/ScoreAnzeige');
    const z = zeile();
    const html = renderToStaticMarkup(h(ScoreKopf, { score: z.score }));
    expect(html).toContain(`>${z.score.punkte}<`);
    // Kein Marketing-Lead (Netzwerk-Kontakt ohne Marketing-Herkunft): kein MQL-Balken, sondern „Lead · noch zu qualifizieren“ (03.10.).
    expect(html).toContain('Lead · noch zu qualifizieren');
    expect(html).not.toMatch(/MQL[^<]*\/8/);
    expect(html).toMatch(/SQL[^<]*\/28/);
    expect(html).toContain('fehlt: Schmerz, Entscheider');
    // Marketing-Lead (Anfrage über die Website): der MQL-Balken gegen die Schwelle 8.
    const mk = leads(K.map(k => ({ ...k, herkunft: 'selbst' as const })), stand(), '2026-10-03')[0];
    const html2 = renderToStaticMarkup(h(ScoreKopf, { score: mk.score }));
    expect(html2).toMatch(/MQL[^<]*\/8/);
    expect(html2).not.toContain('Lead · noch zu qualifizieren');
  });
  it('Herkunft: Kanal, Teile, letzte Aktivität', async () => {
    const { HerkunftBlock } = await import('@/components/os/crm/quali/HerkunftBlock');
    const hk = herkunftVon(K, stand(), [{ id: 'd-1', kontaktId: 'c-anna1', titel: 'Visitenkarte 1/1', datei: { typ: 'image/jpeg', name: 'v.jpg' } }, { id: 'd-2', kontaktId: 'c-anna1', titel: 'Sprachnotiz', datei: { typ: 'audio/webm', name: 's.webm' } }]);
    const html = renderToStaticMarkup(h(HerkunftBlock, { h: hk, heute: '2026-10-03' }));
    expect(html).toContain('Herkunft');
    expect(html).toContain('/api/crm/dateien?id=d-1');
    expect(html).toContain('<audio');
    expect(html).toContain('Letzte Aktivität: Anruf vor 3 Tagen');
  });
  it('Gesprächsmodus: erste offene Frage, Fortschritt, Notizen nebenbei', async () => {
    const { Gespraechsmodus } = await import('@/components/os/crm/quali/Gespraechsmodus');
    const e = standardScoring(); const z = zeile(e);
    const html = renderToStaticMarkup(h(Gespraechsmodus, { api: api(e), z, einstellungen: e, score: z.score, stufen: {}, antworten: {}, onStufe: () => {}, onAntwort: () => {}, onZu: () => {}, onFertig: () => {} }));
    expect(html).toContain('Gespräch');
    expect(html).toMatch(/Frage \d+ von 12/);
    expect(html).toContain('Notizen nebenbei');
    expect(html).toContain('Passt zu unserem Kundenprofil');
  });
  it('Scoring-Editor: Marketing und Sales mit Schwelle, Muss-Regeln, Blöcken, Temperatur und Vorschau', async () => {
    const { ScoringSeite, ScoringAktionen } = await import('@/components/os/crm/quali/ScoringEditor');
    const e = standardScoring();
    const z = { daten: { einstellungen: bisherigeRechnung(), stand: 's', standard: e, bisherig: bisherigeRechnung(), messungen: [], verlauf: [], zurueckMoeglich: true }, entwurf: e, setEntwurf: () => {}, geaendert: true, fehlerLive: [], fehler: '', hinweis: '', felder: [], laeuft: false, wiederhergestellt: false, speichern: async () => {}, aktion: async () => {}, verwerfen: () => {}, laden: async () => {} };
    const sales = renderToStaticMarkup(h(ScoringSeite, { api: api(), seite: 'sales', z }));
    for (const t of ['Sales-Scoring', 'Mindestpunktzahl SQL', 'Muss-Kriterien', 'Qualifikation (MEDDICC · BANT)', '+ Frage hinzufügen', '+ Block hinzufügen', 'Gesamtwert und Temperatur', 'So würden deine aktuellen Leads eingestuft']) expect(sales, t).toContain(t);
    const marketing = renderToStaticMarkup(h(ScoringSeite, { api: api(), seite: 'marketing', z }));
    for (const t of ['Marketing-Scoring', 'Mindestpunktzahl MQL', 'Interaktionen &amp; Signale', 'Make.One-Gast', 'Aus den Daten']) expect(marketing, t).toContain(t);
    const leiste = renderToStaticMarkup(h(ScoringAktionen, { api: api(), z }));
    for (const t of ['Speichern', 'Bisherige Rechnung (bis 03.10.)', 'Auf Standard zurück', 'Letzte Änderung zurücknehmen']) expect(leiste, t).toContain(t);
  });
  it('Dialoge: Firma wechseln, Zusammenführen, weitere Person, Abgeben, Parken, Raus', async () => {
    const z = zeile();
    const p = { api: api(), z, onZu: () => {}, onFertig: () => {} };
    const m = await import('@/components/os/crm/quali/FirmaWechseln');
    const zf = await import('@/components/os/crm/quali/Zusammenfuehren');
    const wp = await import('@/components/os/crm/quali/WeiterePerson');
    const kd = await import('@/components/os/crm/quali/KleineDialoge');
    expect(renderToStaticMarkup(h(m.FirmaWechselnDialog, p))).toContain('Firma wechseln oder neu');
    expect(renderToStaticMarkup(h(zf.ZusammenfuehrenDialog, p))).toContain('Zusammenführen');
    expect(renderToStaticMarkup(h(wp.WeiterePersonDialog, p))).toContain('Weitere Person dazu');
    expect(renderToStaticMarkup(h(kd.AbgebenDialog, p))).toContain('Abgeben');
    expect(renderToStaticMarkup(h(kd.ParkenDialog, p))).toContain('Wiedervorlage');
    const raus = renderToStaticMarkup(h(kd.RausDialog, p));
    expect(raus).toContain('Zu klein oder passt nicht zum Profil');
  });
  it('Seitenfenster: Kontakt (Erreichbar, Nächster Schritt, Einordnung, Person, Firma) und Firma', async () => {
    const s = await import('@/components/os/crm/quali/SeitenfensterInhalt');
    const k = renderToStaticMarkup(h(s.KontaktSeitenfenster, { api: api(), kontaktId: 'c-anna1', onZu: () => {}, zuFirma: () => {}, onFirmaGeaendert: () => {} }));
    for (const t of ['Anna Beispiel', 'Akte ganz öffnen', 'Erreichbar', 'Einordnung', 'Person', 'Beziehung']) expect(k, t).toContain(t);
    const f = renderToStaticMarkup(h(s.FirmaSeitenfenster, { api: api(), firmaId: 'f-muster', onZu: () => {}, zuKontakt: () => {}, zuFirma: () => {} }));
    expect(f).toContain('Muster GmbH');
    expect(f).toContain('Akte ganz öffnen');
  });
  it('Host: Qualifizierung & Scoring mit den Pillen', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}'));
    const { QualifizierungScoring } = await import('@/components/os/crm/quali/QualifizierungScoring');
    const a = renderToStaticMarkup(h(QualifizierungScoring, { api: api(), ansicht: 'scoring-sales', onAnsicht: () => {}, zuLeads: () => {} }));
    for (const t of ['Qualifizierung', 'Scoring', 'Marketing-Scoring · bis MQL', 'Sales-Scoring · MQL → SQL']) expect(a, t).toContain(t);
    const b = renderToStaticMarkup(h(QualifizierungScoring, { api: api(), ansicht: 'runde', onAnsicht: () => {}, zuLeads: () => {} }));
    expect(b).toContain('Qualifizierungsrunde');
    vi.unstubAllGlobals();
  });
});

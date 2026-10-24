// ─── Prozesse · Stellschrauben-Masken im Steckbrief (Restpunkte 24.10.) — Scoring, Buchungsseiten, Business-Heads ──────────────────────────────────────────
// Kevin 22.10.: „alles muss anpassbar sein und es muss auch immer mal wieder zu bearbeiten sein.“ Rein: mit Stand werden die Ansichts-Zeilen Felder (ohne Stand
// bleibt alles, wie es war); die Anfrage geht an den Weiterleiter. Route: der Weiterleiter schreibt über DIESELBE Stelle wie die Fachseite (Wert danach in der
// Fachroute sichtbar), Stand/409, ungültig 400 (die Buchungsseite klemmt hier nicht still), Dienstweg 403, Heads nur der Inhaber (403, Rechte „nur lesen“),
// fremder Haushalt 403. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stellschraubenBauen, type StellschraubenQuellen } from '@/lib/prozesse/stellschrauben-bau';
import { anfrageFuer, eingabeLesen, wertText, darfAendern, aenderbar, WEITER_URL, type Stellschraube } from '@/lib/prozesse/stellschrauben';
import { weiterAnfrage } from '@/lib/prozesse/stellschrauben-weiter-server';
import { SEITE_ZAHLEN } from '@/lib/kalender/buchung';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { StellschraubenKarte } from '@/components/os/prozesse/Stellschrauben';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-stellschrauben-masken-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-stellschrauben-masken';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const von = (je: Record<string, Stellschraube[]>, p: string, id: string) => je[p]?.find(s => s.id === id);
const SEITE = { id: 'bs-0000aaaa-1111', titel: 'Erstgespräch', aktiv: true, dauerMin: 30, vorlaufMin: 1440, maxJeTag: 4, pufferMin: 15, stand: '2026-10-01T08:00:00.000Z' };
const ZAHLEN = { dauerMin: { ...SEITE_ZAHLEN.dauerMin }, vorlaufMin: { ...SEITE_ZAHLEN.vorlaufMin }, maxJeTag: { ...SEITE_ZAHLEN.maxJeTag }, pufferMin: { ...SEITE_ZAHLEN.pufferMin } };
const MIT_STAND: StellschraubenQuellen = {
  scoring: { marketing: 8, sales: 28, mussMarketing: 0, mussSales: 2, temperatur: { lau: 5, warm: 12, heiss: 25 }, stand: 'sc-abc', vorgabe: { marketing: 8, sales: 28, temperatur: { lau: 5, warm: 12, heiss: 25 } }, schwelleMax: 1000 },
  heads: { sales: { stand: 'es-1', stufeVorgabe: 'ausgewogen', autonomieBoden: 'intern', autonomieWirksam: 'intern' }, marketing: { aktiv: false, budgetCentMonat: 2550, stand: 'es-2', stufeVorgabe: 'ausgewogen', autonomieBoden: 'vorschlag', autonomieWirksam: 'vorschlag' } },
  buchungsseiten: { aktiv: 1, gesamt: 1, seiten: [SEITE], zahlen: ZAHLEN },
  vorlagen: { playbooks: 2, events: 0 },
};

describe('Bau (rein): mit Stand werden die Zeilen Felder — ohne Stand bleibt es beim Ansehen', () => {
  const je = stellschraubenBauen(MIT_STAND);
  it('Scoring: MQL/SQL-Schwelle und drei Temperatur-Grenzen als Zahl mit Vorgabe und Weg; ohne Stand die alte Ansichts-Zeile', () => {
    expect(von(je, 'sp-lead-sql', 'scoring-mql')).toMatchObject({ art: 'zahl', wert: 8, vorgabe: 8, min: 0, max: 1000, weg: { art: 'scoring', feld: 'marketing', stand: 'sc-abc' } });
    expect(von(je, 'sp-lead-sql', 'scoring-sql')!.erklaerung).toContain('2 Muss-Kriterien');
    for (const k of ['lau', 'warm', 'heiss']) expect(von(je, 'sp-lead-sql', `scoring-${k}`)).toMatchObject({ art: 'zahl', min: 1, max: 100, weg: { art: 'scoring', feld: k } });
    expect(von(je, 'sp-lead-sql', 'scoring-temperatur')).toBeUndefined();
    const alt = stellschraubenBauen({ scoring: { marketing: 8, sales: 28, mussMarketing: 0, mussSales: 2, temperatur: { lau: 5, warm: 12, heiss: 25 } } });
    expect(von(alt, 'sp-lead-sql', 'scoring-sql')).toMatchObject({ art: 'info', wert: '28 Punkte · 2 Muss' });
  });
  it('Buchungsseiten: je Seite An/aus + vier Zahlen mit den Grenzen von `seiteSauber`; die Zusammenfassung bleibt', () => {
    expect(von(je, 'sp-buchung', 'buchungsseiten')).toMatchObject({ art: 'info', wert: '1 von 1 aktiv' });
    expect(von(je, 'sp-buchung', `buchung-${SEITE.id}-aktiv`)).toMatchObject({ art: 'schalter', wert: true, vorgabe: true, gruppe: 'Seite „Erstgespräch“', weg: { art: 'buchung', seite: SEITE.id, feld: 'aktiv', stand: SEITE.stand } });
    expect(von(je, 'sp-buchung', `buchung-${SEITE.id}-dauerMin`)).toMatchObject({ art: 'zahl', wert: 30, min: 10, max: 240, vorgabe: 30 });
    expect(von(je, 'sp-buchung', `buchung-${SEITE.id}-vorlaufMin`)).toMatchObject({ max: 60 * 24 * 14 });
    expect(stellschraubenBauen({ buchungsseiten: { aktiv: 0, gesamt: 2 } })['sp-buchung']).toHaveLength(1);
  });
  it('Heads: Schalter, Modell (Auswahl), Budget in Euro, Autonomie nur bis zum Boden; ohne Stand die alten Ansichts-Zeilen', () => {
    expect(von(je, 'sp-head-takt', 'head-sales-aktiv')).toMatchObject({ art: 'schalter', wert: true, weg: { art: 'head', head: 'sales', feld: 'aktiv', stand: 'es-1' } });
    const stufe = von(je, 'sp-head-takt', 'head-sales-stufe')!;
    expect(stufe).toMatchObject({ art: 'auswahl', wert: 'ausgewogen', vorgabe: 'ausgewogen' });
    expect(stufe.optionen!.map(o => o.wert)).toEqual(['schnell', 'ausgewogen', 'stark']);
    expect(von(je, 'sp-head-takt', 'head-marketing-budget')).toMatchObject({ art: 'zahl', einheit: '€', wert: 25.5 });
    expect(von(je, 'sp-head-takt', 'head-marketing-aktiv')!.wert).toBe(false);
    // Autonomie: mehr Freiheit als der Boden gibt es nicht — Marketing (Boden „vorschlag“) hat nur eine Wahl.
    expect(von(je, 'sp-head-takt', 'head-sales-autonomie')!.optionen!.map(o => o.wert)).toEqual(['vorschlag', 'intern']);
    expect(von(je, 'sp-head-takt', 'head-marketing-autonomie')!.optionen!.map(o => o.wert)).toEqual(['vorschlag']);
    // Head of Finance (Monatsabschluss) ohne Stand: wie bisher nur zu sehen.
    expect(von(je, 'sp-monatsabschluss', 'head-finanzen-aktiv')).toMatchObject({ art: 'info' });
  });
  it('Vorlagen: Zähler „n angepasst“ und der Weg in die Bearbeitung', () => {
    expect(von(je, 'sp-kampagnen', 'playbooks')).toMatchObject({ art: 'info', wert: '2 angepasst', wo: 'vorlagen', link: { text: 'Playbooks bearbeiten', href: expect.stringContaining('vorlagen=1') } });
    expect(von(je, 'sp-makeone', 'event-vorlagen')).toMatchObject({ wert: 'wie im System', link: { href: expect.stringContaining('s=event') } });
  });
  it('Anfrage: Feld + Wert + Stand an den Weiterleiter; Vorgabe = null; Rechte je Weg; Auswahl prüft die Optionen', () => {
    const mql = von(je, 'sp-lead-sql', 'scoring-mql')!;
    expect(anfrageFuer(mql, 12)).toEqual({ url: WEITER_URL, method: 'POST', body: { weg: { art: 'scoring', feld: 'marketing', stand: 'sc-abc' }, wert: 12 } });
    expect(anfrageFuer(mql, 'vorgabe')!.body).toMatchObject({ wert: null });
    const budget = von(je, 'sp-head-takt', 'head-marketing-budget')!;
    expect(eingabeLesen(budget, '')).toEqual({ ok: true, wert: null });
    expect(eingabeLesen(budget, '12,50')).toEqual({ ok: true, wert: 12.5 });
    const stufe = von(je, 'sp-head-takt', 'head-sales-stufe')!;
    expect(eingabeLesen(stufe, 'stark')).toEqual({ ok: true, wert: 'stark' });
    expect(eingabeLesen(stufe, 'turbo').ok).toBe(false);
    expect(wertText(stufe, 'schnell')).toBe('schnell');
    expect(aenderbar(stufe)).toBe(true);
    expect(darfAendern(stufe, { head: false, scoring: true })).toBe(false);
    expect(darfAendern(mql, { scoring: true })).toBe(true);
    // Der Weiterleiter liest nur bekannte Wege.
    expect(weiterAnfrage({ weg: { art: 'scoring', feld: 'muss', stand: 'x' }, wert: 1 }).ok).toBe(false);
    expect(weiterAnfrage({ weg: { art: 'head', head: 'assistenz', feld: 'stufe', stand: 'x' }, wert: 'stark' }).ok).toBe(false);
    expect(weiterAnfrage({ weg: { art: 'buchung', seite: SEITE.id, feld: 'dauerMin', stand: SEITE.stand } }).ok).toBe(false);
  });
});

describe('Oberfläche (ohne Browser): Auswahl, Schalter, Rechte', () => {
  const je = stellschraubenBauen(MIT_STAND);
  const karte = (rechte: Record<string, boolean>) => renderToStaticMarkup(h(StellschraubenKarte, { p: { ...SYSTEM_PROZESSE.find(x => x.id === 'sp-head-takt')!, stellschrauben: je['sp-head-takt'] }, rechte, stand: 's', onGespeichert: () => {}, offen: true }));
  it('Inhaber: Modell als Auswahl mit drei Stufen; andere sehen nur den Wert und den Satz „nur der Inhaber“', () => {
    const inhaber = karte({ head: true });
    expect(inhaber).toContain('aria-label="Modell"');
    for (const t of ['schnell', 'ausgewogen', 'stark', 'Budget je Monat']) expect(inhaber).toContain(t);
    const andere = karte({ head: false });
    expect(andere).not.toContain('aria-label="Modell"');
    expect(andere).toContain('Die Agenten-Regler der Heads ändert nur der Inhaber.');
  });
});

// ── Route ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json', ...(person ? { 'x-make-person': person } : {}) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
async function landkarte(person: string): Promise<J> {
  const { GET } = await import('@/app/api/prozesse/landkarte/route');
  const r = await GET(new Request('http://test/api/prozesse/landkarte?space=business', { headers: sitzung(person) }));
  expect(r.status).toBe(200);
  return r.json();
}
const schraube = (j: J, p: string, id: string): Stellschraube => (j.prozesse as { id: string; stellschrauben?: Stellschraube[] }[]).find(x => x.id === p)!.stellschrauben!.find(s => s.id === id)!;
async function weiter(body: unknown, kopf: Record<string, string>): Promise<{ status: number; j: J }> {
  const { POST } = await import('@/app/api/prozesse/stellschrauben/weiter/route');
  const r = await POST(new Request(`http://test${WEITER_URL}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const senden = (s: Stellschraube, wert: Parameters<typeof anfrageFuer>[1], person = 'pia') => weiter(anfrageFuer(s, wert)!.body, sitzung(person));

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ma' }),
    konto('k2', 'mira', 'mitglied', { haushalt: 'haus-ma' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ma', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
  const { POST } = await import('@/app/api/kalender/buchung/route');
  const r = await POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ aktion: 'seite', seite: {
    titel: 'Erstgespräch', person: 'pia', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5], von: '09:00', bis: '12:00' }], tageVoraus: 7, vorlaufMin: 1440, maxJeTag: 4, pufferMin: 15,
    rasterMin: 30, zielKalender: 'Probekalender', ort: 'Videoraum folgt', verantwortlich: 'Probe GmbH, datenschutz@example.invalid',
  } }) }));
  expect(r.status).toBe(200);
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route: Scoring über `scoringSchreiben`', () => {
  it('Schwelle ändern wirkt im Reiter Scoring; veralteter Stand 409; ungültig 400; Vorgabe setzt zurück; Dienstweg 403', async () => {
    const j = await landkarte('pia');
    expect(j.stellschraubenRechte).toMatchObject({ scoring: true, buchung: true, head: true });
    const mql = schraube(j, 'sp-lead-sql', 'scoring-mql');
    expect(mql.art).toBe('zahl');
    const ok = await senden(mql, 12, 'partnerin');
    expect(ok.status).toBe(200);
    const { GET } = await import('@/app/api/crm/scoring/route');
    const sc = await (await GET(new Request('http://test/api/crm/scoring', { headers: sitzung('pia') }))).json();
    expect(sc.einstellungen.marketing.schwelle).toBe(12);
    // Derselbe (alte) Stand noch einmal → 409, nichts geschrieben.
    expect((await senden(mql, 14)).status).toBe(409);
    const j2 = await landkarte('pia');
    expect(schraube(j2, 'sp-lead-sql', 'scoring-mql').wert).toBe(12);
    // lau < warm < heiß prüft die vorhandene Schreibstelle (`scoringPruefen`) → 400 mit Satz.
    const lau = schraube(j2, 'sp-lead-sql', 'scoring-lau');
    const zuHoch = await senden(lau, 90);
    expect(zuHoch.status).toBe(400);
    expect(zuHoch.j.fehler).toMatch(/lau < warm/);
    expect((await senden(lau, 4.5)).status).toBe(400);
    expect((await weiter(anfrageFuer(lau, 6)!.body, dienst('pia'))).status).toBe(403);
    expect((await senden(schraube(j2, 'sp-lead-sql', 'scoring-mql'), 'vorgabe')).status).toBe(200);
    expect(schraube(await landkarte('pia'), 'sp-lead-sql', 'scoring-mql').wert).toBe(8);
  });
});

describe('Route: Buchungsseite über `seiteSpeichern`', () => {
  it('Dauer und An/aus ändern wirkt in der Verwaltung; außerhalb der Grenzen 400 statt still klemmen; 409; fremder Haushalt 403', async () => {
    const j = await landkarte('pia');
    const seite = (j.prozesse as { id: string; stellschrauben: Stellschraube[] }[]).find(p => p.id === 'sp-buchung')!.stellschrauben.find(s => s.id.endsWith('-dauerMin'))!;
    expect(seite).toMatchObject({ art: 'zahl', wert: 30, vorgabe: 30 });
    expect((await senden(seite, 5)).status).toBe(400);
    expect((await senden(seite, 241)).status).toBe(400);
    const ok = await senden(seite, 45, 'mira');
    expect(ok.status).toBe(200);
    const { GET } = await import('@/app/api/kalender/buchung/route');
    const v = await (await GET(new Request('http://test/api/kalender/buchung', { headers: sitzung('pia') }))).json();
    expect(v.seiten[0]).toMatchObject({ dauerMin: 45, aktiv: true, geaendertVon: 'mira' });
    expect((await senden(seite, 60)).status).toBe(409);
    const j2 = await landkarte('pia');
    const aktiv = (j2.prozesse as { id: string; stellschrauben: Stellschraube[] }[]).find(p => p.id === 'sp-buchung')!.stellschrauben.find(s => s.id.endsWith('-aktiv'))!;
    expect((await senden(aktiv, false)).status).toBe(200);
    const v2 = await (await GET(new Request('http://test/api/kalender/buchung', { headers: sitzung('pia') }))).json();
    expect(v2.seiten[0].aktiv).toBe(false);
    expect((await weiter(anfrageFuer(aktiv, true)!.body, sitzung('gast'))).status).toBe(403);
  });
});

describe('Route: Business-Heads über `einstellungAendern` — nur der Inhaber', () => {
  it('Budget in Euro → Cent; Nicht-Inhaber nur lesen (Rechte) und 403; Autonomie nur verschärfen; 409', async () => {
    const j = await landkarte('pia');
    const budget = schraube(j, 'sp-head-takt', 'head-sales-budget');
    expect(budget).toMatchObject({ art: 'zahl', einheit: '€', wert: null });
    expect((await landkarte('mira')).stellschraubenRechte.head).toBe(false);
    const fremd = await senden(budget, 25, 'mira');
    expect(fremd.status).toBe(403);
    expect(fremd.j.fehler).toMatch(/nur der Inhaber/);
    expect((await senden(budget, 25.5)).status).toBe(200);
    const db = await import('@/lib/store/local-db');
    const { einstellungBestand } = await import('@/lib/agenten/typen');
    const roh = await db.loadJson<{ heads: Record<string, { budgetCentMonat?: number }> }>(einstellungBestand('haus-ma'));
    expect(roh!.heads.sales.budgetCentMonat).toBe(2550);
    expect((await senden(budget, 30)).status).toBe(409);
    const j2 = await landkarte('pia');
    expect(schraube(j2, 'sp-head-takt', 'head-sales-budget').wert).toBe(25.5);
    // Verschärfen geht; zurück auf den Boden ohne gute Annahmequote lehnt die vorhandene Schreibstelle ab (409).
    const auto = schraube(j2, 'sp-head-takt', 'head-sales-autonomie');
    expect((await senden(auto, 'vorschlag')).status).toBe(200);
    const auto2 = schraube(await landkarte('pia'), 'sp-head-takt', 'head-sales-autonomie');
    expect(auto2.wert).toBe('vorschlag');
    expect((await senden(auto2, 'intern')).status).toBe(409);
    expect((await senden(schraube(await landkarte('pia'), 'sp-head-takt', 'head-sales-stufe'), 'turbo')).status).toBe(400);
  });
});

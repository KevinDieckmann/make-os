// ─── Zahlen-Stimmigkeit: EINE Rechnung je Größe, alle Orte lesen sie (14.10., unabhängige Abnahme B1/B2/B3/B5/B12/B13/B14) ─────────────────────────
// Die Abnahme fand dieselbe Größe mit verschiedenen Zahlen je Ort: Index-Status „Noch zu wenig gemessen · 6 von 6 Säulen“ (Heute) neben „Noch keine
// Daten“ (Cockpit, Fachseiten); „Markttraktion 59“ neben „Traktions-Score 64“; Ziel-Fortschritt 33/0/0 (Heute) neben 25/13/17 (Seil); Leads 2/1/5;
// Mandats-Ansprechpartner unter „Neue Leads“, Filter „Kunden 0“; „0 / 0“ und „0 € von 0 € — gedeckt“ in Grün; „2083 im Monat“ ohne Einheit aus
// einem Monatsziel; Steuern der Hauptgesellschaft ohne Weg. Dieser Wächter sät die Demo (über die Routen, eigener Datenordner — Vorbild
// tests/fulfillment-stimmigkeit.test.ts) und vergleicht die Orte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-zahlen-stimmig-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-zahlen-stimmig', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return { wurzel };
});

import { localDay } from '@/lib/zeit';
import { indexStatus, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import { anteilStand, deckungStand } from '@/lib/kennzahlen/anteil';
import { SAEULEN, TRAKTION_IM_BUSINESS_INDEX } from '@/lib/business/register';
import { leads, passtLeadFilter, inArbeit, zuQualifizieren, inQualifizierungNichtInRunde, type LeadZeile, type Trichter } from '@/lib/crm/leads';
import { fuerDich } from '@/lib/crm/team';
import { istKunde, beanVon } from '@/lib/crm/bean';
import { neueOhneSchritt } from '@/lib/crm/person-anlegen';
import { abgeleiteterTitel, zahlenzielArt, istRatenziel, zielwertText } from '@/lib/planung/kaskade';
import { UG_NICHT_HINTERLEGT, UG_STEUER_WEG } from '@/lib/steuern/rechnen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Ziel } from '@/lib/planung/typen';
import type { Seil } from '@/lib/lichtfaeden/seil';

type H = (r: Request) => Promise<Response>;
const lese = async (pfad: string, suche = '') => {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m.GET(new Request(`http://test/api/${pfad}${suche}`, { headers: { 'x-make-user': 'lena' } }));
  return await r.json() as Record<string, unknown>;
};
const quelle = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

const HEUTE = localDay();
let bi: IndexErgebnis & { saeulen: (IndexErgebnis['saeulen'][number])[] };
let traktion: { index: IndexErgebnis; traktion: { score: number | null } };
let zieleJahr: Ziel[] = [];
let zieleTag: Ziel[] = [];
let zieleMonat: Ziel[] = [];
let seile: Seil[] = [];
let leadRoute: { leads: LeadZeile[]; trichter: Trichter };
let kreislauf: { id: string; anzahl: number }[] = [];
let kontakte: Kontakt[] = [];
let crm: CrmBestand;
let steuern: { prognose: { zeilen: { einheit: string; luecke?: string; href: string; betrag: number | null }[]; je: Record<string, { soll: number; ist: number | null }> } };

beforeAll(async () => {
  const server = await import('@/lib/demo/server');
  await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: HEUTE });
  bi = (await lese('business', '?scope=gesamt&kompakt=1')).bi as typeof bi;
  traktion = await lese('crm/traktion') as unknown as typeof traktion;
  const z = await lese('state/ziele', '?space=business');
  zieleJahr = z.jahr as Ziel[]; zieleTag = z.tag as Ziel[]; zieleMonat = z.monat as Ziel[];
  seile = ((await lese('seil', '?ebene=jahr&bereich=business')).ansicht as { seile: Seil[] }).seile;
  leadRoute = await lese('crm/lead') as unknown as typeof leadRoute;
  kreislauf = ((await lese('crm/planung')).kreislauf as { stufen: { id: string; anzahl: number }[] }).stufen;
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const { loadJson } = await import('@/lib/store/local-db');
  crm = await ladeCrm();
  kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
  steuern = await lese('steuern', '?space=business') as unknown as typeof steuern;
}, 240_000);
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('B1 · EIN Index-Status für alle Orte', () => {
  it('ohne Indexwert, aber gemessen: „Vorläufig — n % gemessen“ — nie „Noch keine Daten“ über Säulen mit Werten', () => {
    expect(bi.index).toBeNull();
    expect(bi.saeulen.some(s => s.score != null)).toBe(true);
    const st = indexStatus(bi);
    expect(st.titel).toBe('Vorläufig');
    expect(st.satz).toContain(`${Math.round(bi.abdeckung * 100)} % gemessen`);
    // Rein: mit Wert das Label, ganz ohne Messung „Noch keine Daten“.
    expect(indexStatus({ index: 64, label: 'Solide', abdeckung: 0.5, luecken: 2 }).titel).toBe('Solide');
    expect(indexStatus({ index: null, label: 'Noch keine Daten', abdeckung: 0, luecken: 4 }).titel).toBe('Noch keine Daten');
  });
  it('Heute, Cockpit, Fachseiten-Streifen und IndexAnsicht zeigen den Status nur über indexStatus', () => {
    expect(quelle('components/os/flaeche/widgets.tsx')).toContain('indexStatus(d)');
    expect(quelle('components/os/business/BusinessCockpit.tsx')).toContain('indexStatus(bi).titel');
    expect(quelle('components/os/business/BusinessCockpit.tsx')).toContain('indexStatus(bi).satz');
    expect(quelle('components/os/business/IndexStreifen.tsx')).toContain('indexStatus(bi).titel');
    expect(quelle('components/os/kennzahlen/IndexAnsicht.tsx')).toContain('indexStatus(pi).titel');
    for (const p of ['components/os/business/BusinessCockpit.tsx', 'components/os/business/IndexStreifen.tsx']) expect(quelle(p)).not.toMatch(/\{bi\.label\}|bi \? bi\.label/);
  });
});

describe('B2 · Traktion: eine Zahl, zwei Größen mit eigenem Namen', () => {
  it('der Traktions-Score ist überall derselbe (Markttraktion-Überblick, Heute-Widget, Kennzahl im Business-Index)', () => {
    const imIndex = bi.saeulen.flatMap(s => s.kennzahlen).find(k => k.id === 'traktion')!;
    expect(traktion.index.index).not.toBeNull();
    expect(imIndex.wert).toBe(traktion.index.index);
    expect(traktion.traktion.score).toBe(traktion.index.index);
  });
  it('die Business-Säule heißt nicht wie der Score — und ein Satz sagt, warum ihre Zahl eine andere ist', () => {
    const mt = SAEULEN.find(s => s.id === 'mt')!;
    expect(mt.label).not.toMatch(/Markttraktion|Traktion/);
    expect(bi.saeulen.find(s => s.id === 'mt')!.label).toBe(mt.label);
    expect(TRAKTION_IM_BUSINESS_INDEX).toContain(`„${mt.label}“`);
    expect(quelle('components/os/flaeche/widgets.tsx')).toContain('hinweis: TRAKTION_IM_BUSINESS_INDEX');
  });
});

describe('B3 · EIN Ziel-Fortschritt: Heute = Ziele-Liste = Seil', () => {
  it('jedes Seil zeigt den Fortschritt seines Ziels — dieselbe Zahl wie Heute und die Ziele-Liste', () => {
    expect(seile.length).toBeGreaterThan(0);
    for (const s of seile) {
      const z = zieleJahr.find(x => x.id === s.zielId);
      if (!z) continue; // Unterziel als Wurzel eines anderen Horizonts
      expect(Math.round(s.fortschritt * 100), z.titel).toBe(Math.round(z.erledigt ? 100 : z.fortschritt));
    }
    // Demo: das Umsatz-Ziel steht bei 33 % (1 von 3 Meilensteinen erledigt) — nicht beim Momentum der Stränge.
    expect(Math.round(seile.find(s => s.zielId === 'z-demo-umsatz')!.fortschritt * 100)).toBe(33);
  });
  it('die Oberfläche des Seils zeigt `fortschritt`, das Momentum nie als Zahl', () => {
    for (const p of ['components/os/seil/SeilBand.tsx', 'components/os/seil/SeilHandy.tsx', 'components/os/seil/Seil.tsx']) {
      expect(quelle(p), p).not.toMatch(/prozent\(s\.momentum\)|Momentum \{|momentum \* 100/);
    }
    expect(quelle('components/os/seil/SeilBand.tsx')).toContain('prozent(s.fortschritt)');
  });
});

describe('B5 · Leads: EINE Zählung über leads(), Kunden nie „neue Leads“', () => {
  it('Überblick („Leads in Qualifizierung“) = Leads-Liste (Filter Qualifizierung) = Trichter', () => {
    const zeilen = leads(kontakte, crm, HEUTE);
    expect(leadRoute.leads.map(z => [z.id, z.status])).toEqual(zeilen.map(z => [z.id, z.status]));
    const person = zeilen[0].besitzer;
    const liste = leadRoute.leads.filter(z => passtLeadFilter(z, 'qualifizierung') && (z.besitzer === person || z.besitzer === 'beide')).length;
    const zeile = fuerDich(person, kontakte, crm, HEUTE).find(f => f.id === 'qualifizierung');
    expect(liste).toBeGreaterThan(0);
    expect(zeile?.anzahl).toBe(liste);
    expect(zeile?.ziel.filter).toBe('qualifizierung');
    expect(leadRoute.trichter.stufen.find(s => s.id === 'qualifizierung')!.anzahl).toBe(leadRoute.leads.filter(z => passtLeadFilter(z, 'qualifizierung')).length);
  });
  it('Kreislauf „Leads & Qualifizierung · in Arbeit“ = Leads-Liste „In Arbeit“', () => {
    expect(kreislauf.find(s => s.id === 'leads')!.anzahl).toBe(leadRoute.leads.filter(inArbeit).length);
    expect(leadRoute.leads.filter(z => passtLeadFilter(z, 'aktiv')).length).toBe(leadRoute.leads.filter(inArbeit).length);
  });
  it('die Runde zeigt weniger als „in Qualifizierung“ nur mit Satz daneben (inQualifizierungNichtInRunde)', () => {
    const f = { wer: 'alle' as const, heute: HEUTE };
    const inQuali = leadRoute.leads.filter(z => passtLeadFilter(z, 'qualifizierung')).length;
    const runde = zuQualifizieren(leadRoute.leads, f).filter(z => passtLeadFilter(z, 'qualifizierung')).length;
    expect(runde + inQualifizierungNichtInRunde(leadRoute.leads, f)).toBe(inQuali);
    expect(quelle('components/os/crm/Qualifizierung.tsx')).toContain('inQualifizierungNichtInRunde(');
  });
  it('Heute führt keine eigene Lead-Zahl (kann also nicht abweichen)', () => {
    const h = quelle('components/os/HeuteView.tsx');
    const business = h.slice(h.indexOf('  business: ['), h.indexOf('};', h.indexOf('  business: [')));
    expect(business).not.toMatch(/art: '(kanal|leads)'/);
  });
  it('C8 (14.10.): keine Aktivität vor dem Anlagetag; „Neue Leads ohne Schritt“ und das Kreislauf-Ist zählen nach EINER Regel (neuerLeadAm)', async () => {
    const { tagVon } = await import('@/lib/zeit');
    const { neuerLeadAm } = await import('@/lib/crm/neue-leads');
    for (const k of kontakte) for (const a of k.aktivitaeten ?? []) expect(tagVon(a.am) >= k.importiertAm, `${k.vorname}: ${a.am} vor ${k.importiertAm}`).toBe(true);
    const neu = neueOhneSchritt(kontakte, crm, HEUTE);
    for (const k of neu) expect(neuerLeadAm(k), k.vorname).toBeTruthy();
    expect(quelle('lib/crm/person-anlegen.ts')).toContain('neuerLeadSeit(k, heute)');
  });
  it('kein Kunde (aktives Mandat bzw. BEAN „B“) steht unter „Neue Leads ohne nächsten Schritt“; der Filter „Kunden“ zählt BEAN „B“', () => {
    const kunden = kontakte.filter(k => istKunde(k, crm));
    expect(kunden.length).toBeGreaterThanOrEqual(2); // die Ansprechpartner der zwei Demo-Mandate
    for (const k of kunden) expect(beanVon(k, crm).bean).toBe('B');
    const neu = neueOhneSchritt(kontakte, crm, HEUTE).map(k => k.id);
    for (const k of kunden) expect(neu, `${k.vorname} ${k.nachname}`).not.toContain(k.id);
    expect(quelle('components/os/crm/Kartei.tsx')).toContain("kunden: k => beans.get(k.id)?.bean === 'B'");
  });
});

describe('B12/B14 · keine grüne Ampel bei „0 von 0“', () => {
  it('rein: ohne Gesamt bzw. Soll ist der Stand „leer“ (nie grün, nie „0 / 0“)', () => {
    expect(anteilStand(0, 0)).toEqual({ stufe: 'leer', wert: '—' });
    expect(anteilStand(2, 2).stufe).toBe('gut');
    expect(anteilStand(1, 2)).toEqual({ stufe: 'achtung', wert: '1 / 2' });
    expect(deckungStand(0, 0).stufe).toBe('leer');
    expect(deckungStand(100, 0).stufe).toBe('leer');
    expect(deckungStand(50, 100)).toEqual({ stufe: 'achtung', fehlt: 50 });
    expect(deckungStand(100, 100).stufe).toBe('gut');
  });
  it('Demo: die Steuerrücklage hat kein Soll → Leerzustand; die Ziele-Kacheln und die Rücklage lesen nur diese Regel', () => {
    const soll = Object.values(steuern.prognose.je).reduce((s, x) => s + x.soll, 0);
    const ist = Object.values(steuern.prognose.je).reduce((s, x) => s + (x.ist ?? 0), 0);
    expect(deckungStand(ist, soll).stufe).toBe(soll > 0 ? (ist >= soll ? 'gut' : 'achtung') : 'leer');
    expect(quelle('components/os/steuern/SteuernView.tsx')).toContain('deckungStand(summeIst, summeSoll)');
    const fp = quelle('components/os/finanzplan/Ueberblick.tsx');
    expect(fp).toContain('anteilStand(imPlan, gesamt)');
    expect(fp).not.toMatch(/wert=\{`\$\{imPlan\} \/ \$\{zs\.length\}`\}|wert=\{`\$\{aw\.ziele\.imPlan\} \/ \$\{aw\.ziele\.gesamt\}`\}/);
    expect(quelle('components/os/finanzplan/Baukasten.tsx')).not.toMatch(/wert=\{`\$\{g\.aw\.ziele\.imPlan\} \/ /);
  });
  it('B14: die Hauptgesellschaft nennt klar, dass keine Steuern gerechnet werden — mit Weg, ohne erfundenen Betrag', () => {
    const ug = steuern.prognose.zeilen.find(z => z.einheit === 'ug');
    expect(ug).toBeTruthy();
    expect(ug!.betrag).toBeNull();
    expect(ug!.luecke).toContain('rechnen wir noch keine Steuern');
    expect(ug!.href).toBe(UG_STEUER_WEG.href);
    expect(UG_STEUER_WEG.href).toContain('steuern=ug');
    expect(UG_NICHT_HINTERLEGT).toMatch(/Fristen und Schätzung fehlen/);
  });
});

describe('B13 · Kaskade mit Einheit — ein Monatsziel wird nie durch 12 geteilt', () => {
  it('Demo: „Wiederkehrender Umsatz 25.000 € je Monat“ ist eine Rate — Monat und Tag tragen dasselbe Ziel, ohne „2083“', () => {
    const umsatz = zieleJahr.find(z => z.id === 'z-demo-umsatz')!;
    expect(zahlenzielArt(umsatz)).toEqual({ einheit: '€', takt: 'monat' });
    expect(istRatenziel(umsatz)).toBe(true);
    expect(zielwertText(umsatz)).toBe('25.000 € je Monat');
    const abgeleitet = [...zieleMonat, ...zieleTag].filter(x => x.abgeleitetVon === umsatz.id);
    expect(abgeleitet.length).toBe(2);
    for (const z of abgeleitet) {
      expect(z.titel).not.toMatch(/2083|2\.083/);
      expect(z.zielwert).toBe(umsatz.zielwert);
    }
  });
  it('rein: eine Jahressumme wird aufgeteilt — mit der Einheit aus dem Titel', () => {
    const summe: Ziel = { id: 'z-s', titel: 'Umsatz 300.000 € im Jahr', fortschritt: 0, zielwert: 300000 };
    expect(istRatenziel(summe)).toBe(false);
    expect(abgeleiteterTitel(summe, 'monat', 2026)).toBe('Umsatz 300.000 € im Jahr · 25.000 € im Monat');
    const kunden: Ziel = { id: 'z-k', titel: '120 Neukunden', fortschritt: 0, zielwert: 120 };
    expect(abgeleiteterTitel(kunden, 'quartal', 2026)).toBe('120 Neukunden · 30 Neukunden im Quartal');
    // Ohne Zahl im Titel wie bisher.
    expect(abgeleiteterTitel({ id: 'z-o', titel: 'Neukunden gewinnen', fortschritt: 0, zielwert: 120 }, 'quartal', 2026)).toBe('Neukunden gewinnen · 30 im Quartal');
  });
});

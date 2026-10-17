// Wächter (17.10., dritte Abnahme außerhalb des Fulfillments — B1, B2, B7, B8, B11 und C1–C5, C8–C15): je Regel EINE Stelle und ein Fall.
// Rein bzw. statisch (Quelltext), ohne Server — die Konto-Sicht „nur Business“ (B9/B10) prüft tests/nur-business-sicht.test.ts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runwayRechnen, runwayAnzeige, RUNWAY_PLAN_NAME } from '@/lib/finanzen/runway';
import { computeMetrics, mitAbschluessen, mitKasse, DEFAULT_FINANCE, type FinanceState } from '@/lib/make-one/finance-data';
import { passtLeadFilter, imDeal, qualiStand, type LeadZeile } from '@/lib/crm/leads';
import { wegKlartext, personKlartext } from '@/lib/datenschutz/lese-klartext';
import { adresseLesbar } from '@/lib/zugang/adresse-anzeige';
import { v2FuerInstanz, v2Bereitschaft } from '@/lib/datenschutz/nachweise';
import { zoeSatz } from '@/lib/inbox/strom';
import { bereichName } from '@/lib/bauplan/form';

const lies = (d: string) => readFileSync(path.resolve(__dirname, '..', d), 'utf8');
/** Sichtbarer Code ohne Kommentarzeilen. */
const sichtbar = (d: string) => lies(d).split('\n').filter(z => !/^\s*(\/\/|\*|\{\/\*)/.test(z)).join('\n');

describe('B1 · EINE Runway (lib/finanzen/runway.ts)', () => {
  it('Kasse ÷ Ø Netto-Verbrauch der letzten drei Monate; profitabel = „kein Verbrauch“; ohne Kasse nie 0,0', () => {
    expect(runwayRechnen(30000, [{ umsatz: 0, kosten: 99999 }, { umsatz: 10000, kosten: 15000 }, { umsatz: 10000, kosten: 15000 }, { umsatz: 10000, kosten: 15000 }]).monate).toBe(6);
    const profitabel = runwayRechnen(48000, [{ umsatz: 17144, kosten: 15073 }, { umsatz: 17144, kosten: 15073 }]);
    expect(profitabel).toMatchObject({ monate: null, keinVerbrauch: true });
    expect(runwayAnzeige(profitabel)).toBe('kein Verbrauch');
    expect(runwayRechnen(null, [{ umsatz: 0, kosten: 1000 }])).toMatchObject({ monate: null, luecke: 'kasse' });
    expect(runwayRechnen(5000, [])).toMatchObject({ monate: null, luecke: 'monate' });
    expect(runwayAnzeige({ monate: 3.2, keinVerbrauch: false })).toBe('3,2 Monate');
  });
  it('Controlling (computeMetrics) rechnet keine eigene Runway mehr (17.10., L2 R1) — EINE Quelle: der Business-Index', () => {
    const f: FinanceState = { ...DEFAULT_FINANCE, jahr: 2026, months: DEFAULT_FINANCE.months.map((m, i) => (i < 9 ? { ...m, umsatz: 17144, kosten: 15073 } : { ...m })) };
    const m = computeMetrics(mitKasse(f, [{ id: 'ug', kontostand: 48000 }]), new Date('2026-10-17T10:00:00Z'));
    expect('runwayMonate' in m).toBe(false);
    expect('runway' in m).toBe(false);
  });
  it('alle Orte lesen sie: Business-Index, Controlling (vom Server), Head of Finance; die Finanzplanung nennt ihre Variante „Runway laut Plan“', () => {
    expect(lies('lib/business/messen.ts')).toContain('const r = runwayRechnen(k.betrag, ist);');
    expect(sichtbar('lib/make-one/finance-data.ts')).not.toMatch(/runwayRechnen/);
    expect(lies('app/api/state/finance/route.ts')).toContain('const runwayIst = await runwayDesIndex()');
    expect(sichtbar('components/os/ControllingView.tsx')).not.toMatch(/m\.runwayMonate/);
    expect(lies('components/os/ControllingView.tsx')).toContain('runwayIst.anzeige');
    expect(lies('lib/finanzen/chef/lauf.ts')).toContain('runwayDesIndex(heute)');
    expect(lies('app/api/finanzchef/route.ts')).toContain('runwayAnzeige: bild.business.controlling?.runway_anzeige');
    expect(lies('components/os/finanzplan/Ueberblick.tsx')).toContain('`${RUNWAY_PLAN_NAME} · ${UG_KURZ}`');
    expect(RUNWAY_PLAN_NAME).toBe('Runway laut Plan');
  });
});

describe('B2 · Head of Finance liest dieselben Quellen wie Controlling und Steuern', () => {
  it('Monatsabschlüsse gelten vor gepflegten Monaten — nur Business-Gesellschaften (die Selbstständigkeit gehört zu Privat)', () => {
    const f: FinanceState = { ...DEFAULT_FINANCE, jahr: 2026, months: DEFAULT_FINANCE.months.map(m => ({ ...m })) };
    const r = mitAbschluessen(f, [
      { firma: 'ug', monat: '2026-03', umsatz: 1000, kosten: 400 },
      { firma: 'kdv', monat: '2026-03', umsatz: 500, kosten: 100 },
      { firma: 'kdc', monat: '2026-03', umsatz: 99999, kosten: 1 },
    ], null);
    expect(r.months[2]).toMatchObject({ umsatz: 1500, kosten: 500 });
    expect(mitAbschluessen(f, [], null)).toBe(f);
    // EINE Lesestelle (17.10., L2 R1/R2): Monatsabschlüsse + 0-Punkt.
    expect(lies('lib/finanzen/chef/lauf.ts')).toContain('ladeControlling()');
    expect(lies('app/api/state/finance/route.ts')).toContain('ladeControlling(geltende)');
  });
  it('Fristen aus lib/steuern (Gewerbe-/Körperschaftsteuer je Gesellschaft); die Business-Sicht ohne Einkommensteuer', () => {
    // Seit L2 S1 ohne Rückfall auf die eigenen Steuer-Annahmen; Takt und Vorschau lesen dieselben Fristen.
    expect(lies('lib/finanzen/chef/finanzbild.ts')).toContain('const termine: Termin[] = e.steuerFristen ?? [];');
    expect(sichtbar('lib/finanzen/chef/finanzbild.ts')).not.toMatch(/steuertermine\(/);
    expect(lies('lib/finanzen/chef/takt.ts')).toContain('fristenAusSteuern(heute, nurBusiness)');
    expect(lies('lib/agenten/naechstes.ts')).toContain('fristenAusSteuern(heute, !haushalt)');
    expect(sichtbar('components/os/FinanzchefView.tsx')).not.toMatch(/estVorauszahlung|kstVorauszahlung|gewstVorauszahlung/);
    const lauf = lies('lib/finanzen/chef/lauf.ts');
    expect(lauf).toContain("import('@/lib/steuern/rechnen')");
    expect(lauf).toContain("(!nurBusiness || bereichVon(f.einheit) === 'business')");
    expect(lies('app/api/finanzchef/route.ts')).toContain(".filter(t => t.art !== 'est')");
  });
});

describe('B7 · Ein Lead mit offenem Deal ist kein Lead in Qualifizierung', () => {
  const zeile = (status: LeadZeile['status'], deal?: { offen: boolean }) => ({
    id: 'f-x', art: 'firma', name: 'X', personen: [], status, gesetzt: true, kriterien: {}, kanal: 'netzwerk', ohneBesitzer: false, besitzer: 'a', bean: 'N',
    score: { punkte: 40, temperatur: 'warm', teile: [] }, ...(deal ? { deal: { id: 'c-1', titel: 'D', stufe: 'angebot', wert: 1, offen: deal.offen } } : {}),
  }) as unknown as LeadZeile;
  it('Ebene 1 zählt ihn nie, „SQL · Deal“ schon — EINE Zählung für Liste, Trichter, Überblick', () => {
    const z = zeile('qualifizierung', { offen: true });
    expect(imDeal(z)).toBe(true);
    for (const f of ['qualifizierung', 'im_gespraech', 'kontaktiert', 'neu', 'aktiv'] as const) expect(passtLeadFilter(z, f), f).toBe(false);
    expect(passtLeadFilter(z, 'sql')).toBe(true);
    // Ohne offenen Deal wie bisher; ein entschiedener Deal hält ihn nicht mehr auf Ebene 2.
    expect(passtLeadFilter(zeile('qualifizierung'), 'qualifizierung')).toBe(true);
    expect(passtLeadFilter(zeile('qualifizierung', { offen: false }), 'qualifizierung')).toBe(true);
  });
  it('der Überblick „Leads in Qualifizierung“ und der Trichter zählen über `passtLeadFilter`; die Liste nennt „im Deal“ statt „SQL-bereit“', () => {
    expect(lies('lib/crm/team.ts')).toContain("passtLeadFilter(z, 'qualifizierung')");
    expect(lies('lib/crm/leads.ts')).toContain("const n = (s: LeadStatus) => zeilen.filter(z => passtLeadFilter(z, s)).length;");
    expect(lies('components/os/crm/Leads.tsx')).toContain('imDeal(z) ?');
    expect(qualiStand({ ...zeile('qualifizierung', { offen: true }), score: { punkte: 0, temperatur: 'warm', teile: [] } } as unknown as LeadZeile)).not.toBe('sql_bereit');
  });
});

describe('B8 · Handy: Akten laufen nicht quer', () => {
  it('Spalten wachsen nicht über ihren Platz; Firmenakte und Rechnungszeile mit minmax(0, 1fr)', () => {
    expect(lies('app/globals.css')).toMatch(/\.spalte \{ display: grid; gap: 14px; min-width: 0; align-content: start; grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(lies('components/os/crm/Firmen.tsx')).toContain("gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflowWrap: 'anywhere'");
    expect(lies('components/os/crm/Kunden.tsx')).toContain("<div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>");
  });
});

describe('B11 · Einrichtung: das Steuer-Modul rechnet auch für die Hauptgesellschaft', () => {
  it('kein „rechnet noch keine Fristen“ mehr', async () => {
    const { SCHRITTE } = await import('@/lib/make-one/onboarding-data');
    const s = SCHRITTE.find(x => x.id === 'steuerprofil')!;
    expect(s.warum).not.toMatch(/noch keine Fristen|nicht hinterlegt/);
    expect(s.warum).toMatch(/ab ihrer Gründung/);
  });
});

describe('C2 · Einzahl/Mehrzahl', () => {
  it('die gefundenen Stellen nutzen den Helfer', () => {
    expect(lies('components/os/ZugangEinstellungen.tsx')).toContain("anzahl(b.ohneZweitenFaktor, 'Konto', 'Konten')");
    expect(lies('components/os/FinanzchefView.tsx')).toContain("anzahl(b.antwort.befunde.length, 'Befund', 'Befunde')");
    expect(lies('components/os/crm/DealAkte.tsx')).toContain("anzahl(verlauf.reduce((a, v) => a + v.tage, 0), 'Tag', 'Tage')");
    expect(lies('lib/fulfillment/prozesse/kennzahlen.ts')).not.toMatch(/Fäll\$\{/);
    expect(sichtbar('components/os/familie/FamilieOrga.tsx')).not.toMatch(/Alle \{d\.familie\.tage\.length\} Tage/);
  });
});

describe('C4/C5 · Technik und fremde Systeme nur in der Betreiber-Instanz', () => {
  it('Lese-Protokoll in Klartext: kein Pfad, kein Speichername', () => {
    expect(wegKlartext('/api/gesundheit/koerper')).toBe('Gesundheit · Körper-Profil');
    expect(wegKlartext('/api/neu/etwas')).toBe('Neu · Etwas');
    expect(wegKlartext('zoe:fulfillment_lage')).toBe('ZOE · fulfillment lage');
    expect(wegKlartext(undefined)).toBeNull();
    expect(personKlartext('lena', { lena: 'Lena' })).toBe('Lena');
    expect(personKlartext('unbekannt', {})).toBe('ein Konto ohne Namen');
    expect(lies('app/api/datenschutz/nachweise/route.ts')).toContain('eintraege: await inKlartext(');
  });
  it('Netzadresse lesbar', () => {
    expect(adresseLesbar('::1:…')).toBe('dieses Gerät (lokal)');
    expect(adresseLesbar('127.0.0.1')).toBe('dieses Gerät (lokal)');
    expect(adresseLesbar('192.168.1.…')).toBe('im lokalen Netz');
    expect(adresseLesbar('84.12.…')).toBe('Netz 84.12.…');
  });
  it('Bereitschaft v2 für Kunden ohne HMAC, Dateipfade, Rückweg', () => {
    const b = v2FuerInstanz(v2Bereitschaft({ modus: 'kompatibel', unbekannt: false, verschluesselt: true, schluesselQuelle: 'datei', pepper: true, brainIndexKlartext: false, bilderKlartext: 0, alteHuellen: 0, klartextBestaende: 0 }), false);
    const text = b.punkte.map(p => p.text).join(' ');
    expect(text).not.toMatch(/HMAC|system\/|Rückweg|Kompatibilitätsmodus|Git/);
  });
  it('Konto, Controlling, Buchungen, Einstellungen, Cockpit', () => {
    expect(lies('components/os/KontoView.tsx')).toContain('{betreiber && <> · Daten unter');
    expect(lies('components/os/KontoView.tsx')).toContain('adresseLesbar(e.adresse)');
    expect(sichtbar('components/os/ControllingView.tsx')).not.toMatch(/eine Eingabe, eine Wahrheit|Altbestand pflegen/);
    expect(lies('components/os/BuchungenView.tsx')).toContain("betreiber ? ' und aus dem Altbestand des Finanz-Dashboards.'");
    expect(lies('lib/make-one/einstellungen.ts')).not.toContain('Mac-Zulieferer');
    expect(lies('components/os/zoe-whatsapp/ZoeWhatsappKarte.tsx')).toContain('{betreiber && s.inhaber && <div style={{ color: C.inkLeise }}>Webhook bei Meta');
    expect(sichtbar('components/os/business/BusinessCockpit.tsx')).not.toMatch(/KSI|50\/30\/20/);
    expect(lies('components/os/business/BusinessCockpit.tsx')).toContain('Säulen und Gewichte: {SAEULEN_TEXT}');
  });
});

describe('C3 · Business-Sicht der Inhaberin ohne die Selbstständigkeit', () => {
  it('Controlling zeigt nur Business-Konten, der Mandate-Filter keine Privat-Einheit im Business', () => {
    expect(lies('components/os/ControllingView.tsx')).toContain('{businessFirmen(firmen ?? fplan.firmen).map(f => (');
    expect(lies('components/os/crm/Kunden.tsx')).toContain('gesellschaftFilterFuer(nurBusiness || imBusiness)');
  });
});

describe('C8 · Brain-Kugel: Schilder nie unter Knöpfen, hineingezoomt nur mit freiem Platz', () => {
  it('eine Sperrfläche (Knopf) bekommt kein Schild; `frei` sagt, ob der Platz ohne Sterne ist', async () => {
    const { schilderLegen } = await import('@/components/os/kugel/BrainKugel');
    const sperre = { l: 220, o: 330, r: 370, u: 372 };
    const lage = schilderLegen([{ x: 300, y: 300, r: 20, w: 90, h: 18 }], { mitte: { x: 187, y: 187 }, radius: 120, breite: 375, hoehe: 375, sterne: [], sperren: [sperre] });
    const p = lage[0];
    const ueber = p.x - 45 < sperre.r && p.x + 45 > sperre.l && p.y - 9 < sperre.u && p.y + 9 > sperre.o;
    expect(ueber).toBe(false);
    expect(p.frei).toBe(true);
    const q = lies('components/os/kugel/BrainKugel.tsx');
    expect(q).toContain('(vergroessert && !lage[i]?.frei)');
    expect(q).toContain('[knoepfe.current, gesamtKnopf.current, titelKarte.current]');
  });
});

describe('C1 · Grafiken führen weiter', () => {
  it('Wirkung, Pflege-Rhythmus, Traction-Linie, Liquidität und Index-Verlauf', () => {
    expect(lies('components/os/fokus/Wirkung.tsx')).toMatch(/href=\{bereich === 'business'/);
    expect(lies('components/os/familie/WirZwei.tsx')).toContain('#kachel-dates');
    expect(lies('components/os/flaeche/Flaeche.tsx')).toContain('id={`kachel-${platz.id}`}');
    expect(lies('components/os/crm/Scoreboard.tsx')).toContain('#index-verlauf`} data-grafik-weiter=""');
    expect(lies('components/os/business/Verlauf.tsx')).toContain('#saeule-${id}');
  });
});

describe('C9–C15 · Kleinkram', () => {
  it('C9: der leere Pflege-Rhythmus widerspricht dem festen Gesprächstermin nicht', () => {
    expect(lies('lib/familie/logik.ts')).not.toContain('einen festen Termin fürs Paar-Gespräch setzen');
  });
  it('C10: das Wochen-Pack nennt keine Zahl privater Aufgaben', () => {
    expect(sichtbar('components/os/BoardView.tsx')).not.toMatch(/private Aufgaben ausgeblendet/);
  });
  it('C12: Agenten-Beispiele ohne das Geschäft des Herstellers', () => {
    expect(lies('components/os/ResearchView.tsx')).not.toMatch(/Controlling-Cockpit|BSFZ/);
    expect(lies('components/os/ContentView.tsx')).not.toMatch(/CFO|Kalt-E-Mail/);
  });
  it('C13: eine verstrichene Frist in der Inbox heißt so', () => {
    const g = [{ id: 'g1', inArbeit: true, betreff: 'Vertragsentwurf', fach: 'antworten', frist: { datum: '2026-10-15', text: 'bis 15.10.' }, gegenueber: { name: 'Beispiel', email: 'b@example.invalid' }, am: '2026-10-14' }] as unknown as Parameters<typeof zoeSatz>[0];
    expect(zoeSatz(g, '2026-10-17').text).toMatch(/^Frist verstrichen: .*bis 15\.10\./);
    expect(zoeSatz(g, '2026-10-14').text).toMatch(/am besten heute antworten/);
  });
  it('C14: Bauplan mit den heutigen Namen', () => {
    expect(bereichName('Zahlen')).toBe('Finanzen');
    expect(bereichName('Agenten')).toBe('ZOE-Agenten');
    expect(lies('components/os/bauplan/BauplanBoard.tsx')).toContain('„Problem oder Idee melden“ unten links');
  });
  it('C11: die Karten der Einrichtung zählen die eigenen Schritte (wie der Kopf)', () => {
    expect(lies('components/os/OnboardingView.tsx')).toContain('schritteAufEbene(ebene, ich).filter(s => schrittFuer(s, ich))');
  });
  it('C15: Schritt 1.1 nennt „Gerät merken“', async () => {
    expect(lies('lib/make-one/onboarding-data.ts')).toContain('„Dieses Gerät 90 Tage merken“');
  });
});

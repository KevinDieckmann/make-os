// ─── Markttraktion Woche 1 (08.10.) — die Befunde aus MARKTTRAKTION_BEFUND.md, Teil 2, je mit Wächter ──────────────────────────
// A · Leads, Runde, Texte (1.3, 1.4, 2.1, 2.2, 2.3, 2.5, 2.6, 2.8). Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Lead } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mt-woche1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mt-woche1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const T = '2026-10-08';
const J = '2026-10-08T09:00:00.000Z';
const vor = (n: number, ab = T) => { const d = new Date(`${ab}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: vor(90), geaendertAm: vor(90), besitzer: 'kevin', ...x });
const crmLeer = (x: Partial<CrmBestand> = {}): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], ...x } as unknown as CrmBestand);
const quelle = (datei: string) => readFileSync(path.join(process.cwd(), datei), 'utf8');
const KRIT = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
/** Ein Lead an einer Firma — mit gewählten Stufen der Standard-Einstellungen (s5 = beste Stufe). */
const firma = (id: string, lead?: Partial<Lead>) => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...(lead ? { lead: { status: 'qualifizierung', kriterien: { ...KRIT }, ...lead } } : {}) }) as unknown as CrmBestand['firmen'][number];

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── 2.1 · Die Runde leert sich ──────────────────────────────────────────────────────────────────────────────────────────────
describe('2.1 · Runde: nur Muss-Fragen halten offen, „Geprüft“ gibt Ruhe bis zur Wiedervorlage', () => {
  it('offeneMussFragen zählt nur Fragen in noch nicht erfüllten Muss-Kriterien (Standard: Schmerz, Entscheider, Budget oder Zeitpunkt)', async () => {
    const { leads, offeneMussFragen, offeneFragen } = await import('@/lib/crm/leads');
    const z = (stufen: Record<string, string>) => leads([k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', { stufen })] }), T)[0];
    expect(offeneMussFragen(z({}))).toBe(4); // Schmerz, Entscheider, Budget, Zeitpunkt
    expect(offeneMussFragen(z({ schmerz: 's5', entscheider: 's5', budget: 's5' }))).toBe(0); // Budget erfüllt die Gruppe „Budget oder Zeitpunkt“
    expect(offeneFragen(z({ schmerz: 's5', entscheider: 's5', budget: 's5' }))).toBeGreaterThan(0); // die übrigen Fragen sind noch offen
    // Ein schlecht beantwortetes Muss (s0) ist beantwortet — es hält den Lead nicht als „offen“ fest.
    expect(offeneMussFragen(z({ schmerz: 's0', entscheider: 's5', zeitpunkt: 's5' }))).toBe(0);
  });

  it('brauchtQualifizierung: offenes Muss → dran; Muss geklärt + frisch qualifiziert → Ruhe; „Geprüft“ → Ruhe, auch mit offenem Muss, bis zur Wiedervorlage', async () => {
    const { leads, brauchtQualifizierung, QUALI_WIEDERVORLAGE_TAGE, ruheBis } = await import('@/lib/crm/leads');
    const z = (lead: Partial<Lead>) => leads([k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', lead)] }), T)[0];
    expect(brauchtQualifizierung(z({}), T)).toBe(true);
    expect(brauchtQualifizierung(z({ stufen: { schmerz: 's3' }, qualifiziertAm: vor(2) }), T)).toBe(true); // Entscheider fehlt noch
    // Vorher blieb dieser Lead für immer drin (8 andere Fragen offen) — jetzt Ruhe bis zur Wiedervorlage.
    expect(brauchtQualifizierung(z({ stufen: { schmerz: 's3', entscheider: 's3', zeitpunkt: 's3' }, qualifiziertAm: vor(2) }), T)).toBe(false);
    expect(brauchtQualifizierung(z({ stufen: { schmerz: 's3', entscheider: 's3', zeitpunkt: 's3' }, qualifiziertAm: vor(QUALI_WIEDERVORLAGE_TAGE + 1) }), T)).toBe(true);
    // „Geprüft“ ist eine bewusste Entscheidung: Ruhe auch mit offenem Muss …
    const geprueft = z({ geprueftAm: vor(5), qualifiziertAm: vor(5) });
    expect(geprueft.geprueftAm).toBe(vor(5));
    expect(brauchtQualifizierung(geprueft, T)).toBe(false);
    expect(ruheBis(geprueft)).toBe(vor(5 - QUALI_WIEDERVORLAGE_TAGE));
    // … bis zur Wiedervorlage.
    expect(brauchtQualifizierung(z({ geprueftAm: vor(QUALI_WIEDERVORLAGE_TAGE + 1), qualifiziertAm: vor(QUALI_WIEDERVORLAGE_TAGE + 1) }), T)).toBe(true);
  });

  it('der Säuberer behält geprueftAm (nur Tag) und die Vermerke „direkt angelegt“', async () => {
    const { leadSaeubern } = await import('@/lib/crm/lead-form');
    const l = leadSaeubern({ status: 'qualifizierung', kriterien: KRIT, geprueftAm: T, direktAm: J, direktOffen: ['Schmerz', 'Entscheider'] });
    expect(l).toMatchObject({ geprueftAm: T, direktAm: J, direktOffen: ['Schmerz', 'Entscheider'] });
    expect(leadSaeubern({ status: 'qualifizierung', kriterien: KRIT, geprueftAm: 'gestern' })?.geprueftAm).toBeUndefined();
  });

  it('SQL-bereit ohne Entscheidung bleibt in der Runde, auch wenn geprüft', async () => {
    const { leads, zuQualifizieren } = await import('@/lib/crm/leads');
    const alleBest = { schmerz: 's5', entscheider: 's5', budget: 's5', zeitpunkt: 's5', fit: 'ja', groesse: 's5', passung: 's5', champion: 's5', prozess: 's5', wirkung: 's5', alternative: 's5', folge: 's5' };
    const z = leads([k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', { stufen: alleBest, geprueftAm: vor(1), qualifiziertAm: vor(1) })] }), T);
    expect(zuQualifizieren(z, { wer: 'alle', heute: T, auchKalt: true }).map(x => x.id)).toEqual(['f-a']);
  });
});

// ── 1.4 · Trichter zählt wie die Liste ──────────────────────────────────────────────────────────────────────────────────────
describe('1.4 · Trichter und Leads-Pillen zählen mit EINER Regel, der Sprung gibt den Filter mit', () => {
  it('Ebene 1 des Trichters = passtLeadFilter(Status) — kalte zählen nicht mit', async () => {
    const { leads, trichter, passtLeadFilter } = await import('@/lib/crm/leads');
    // c-kalt: Import ohne Kontakt (kalt) im Status „kontaktiert“ (aus der Stufe abgeleitet); c-warm: frisch von Hand angelegt.
    const kontakte = [k('kalt', { stufe: 'angesprochen', importiertAm: T }), k('warm', { stufe: 'angesprochen', importiertAm: T, aktivitaeten: [{ am: J, art: 'system', text: 'Von Hand angelegt', von: 'system' }] })];
    const z = leads(kontakte, crmLeer(), T);
    expect(z.map(x => x.status)).toEqual(['kontaktiert', 'kontaktiert']);
    const t = trichter(z, crmLeer());
    const stufe = t.stufen.find(s => s.id === 'kontaktiert')!;
    expect(stufe.anzahl).toBe(z.filter(x => passtLeadFilter(x, 'kontaktiert')).length);
    expect(stufe.anzahl).toBe(1);
    expect(stufe.ziel).toEqual({ s: 'qualifizierung', a: 'leads', filter: 'kontaktiert' });
  });
  it('Leads-Liste nimmt dieselbe Regel und hört auf den Sprung', () => {
    const src = quelle('components/os/crm/Leads.tsx');
    expect(src).toContain('const passtFilter = passtLeadFilter;');
    expect(src).toContain('leadsFilterSetzen(s.ziel.filter)');
    expect(src).toContain("window.addEventListener(LEADS_FILTER_EREIGNIS");
  });
});

// ── 1.3 / 2.6 · Texte aus den Einstellungen ─────────────────────────────────────────────────────────────────────────────────
describe('1.3/2.6 · leere Zustände und Regeltexte aus den Scoring-Einstellungen', () => {
  it('sqlRegelText nennt Muss-Kriterien und Schwelle der Einstellungen — eigene Einstellungen ändern den Text', async () => {
    const { sqlRegelText, standardScoring, mussText } = await import('@/lib/crm/scoring');
    const s = standardScoring();
    expect(sqlRegelText(s)).toBe('Muss: Schmerz · Entscheider · Budget oder Zeitpunkt — dazu mindestens 28 Sales-Punkte');
    expect(sqlRegelText({ sales: { ...s.sales, schwelle: 40, muss: [] } })).toBe('mindestens 40 Sales-Punkte');
    expect(mussText({ kriterien: ['a', 'b', 'c'], mindestens: 2, stufePunkte: 3 }, id => id.toUpperCase())).toBe('mindestens 2 von A, B, C');
  });
  it('keine veralteten festen Regeltexte mehr (SQL ohne Schwelle, „Firmen › Leads“, „25 Punkte“, „alle qualifiziert … 60 Tage“)', () => {
    const verboten: [string, RegExp][] = [
      ['components/os/crm/Leads.tsx', /Schmerz und Entscheider geklärt, dazu Budget oder Zeitpunkt/],
      ['components/os/crm/Pipeline.tsx', /Firmen › Leads: Schmerz/],
      ['lib/crm/team.ts', /Schmerz, Entscheider und Budget\/Zeitpunkt geklärt/],
      ['lib/crm/leads.ts', /weiterWenn: 'Schmerz und Entscheider geklärt/],
      ['components/os/crm/Qualifizierung.tsx', /Alle deine Leads sind qualifiziert|Nächste Runde in 60 Tagen/],
      ['components/os/crm/Leads.tsx', /25 Punkte/],
      ['lib/heads/grundlauf.ts', /Schmerz, Entscheider und Budget\/Zeitpunkt geklärt/],
    ];
    for (const [datei, re] of verboten) expect(re.test(quelle(datei)), datei).toBe(false);
    // Die Kalt-Grenze kommt aus den Einstellungen (temperaturAb.lau), Leads und Runde nennen sie.
    expect(quelle('components/os/crm/Leads.tsx')).toContain('einstellungen.temperaturAb.lau');
    expect(quelle('components/os/crm/Qualifizierung.tsx')).toContain('einstellungen.temperaturAb.lau');
  });
  it('„Für dich“: SQL-bereit nennt die Regel der Einstellungen und führt in die Runde', async () => {
    const { fuerDich } = await import('@/lib/crm/team');
    const alleBest = { schmerz: 's5', entscheider: 's5', budget: 's5', zeitpunkt: 's5', fit: 'ja', groesse: 's5', passung: 's5', champion: 's5', prozess: 's5', wirkung: 's5', alternative: 's5', folge: 's5' };
    const l = fuerDich('kevin', [k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', { stufen: alleBest })] }), T);
    const sql = l.find(x => x.id === 'sql_bereit')!;
    expect(sql.text).toContain('Muss-Kriterien und Sales-Schwelle');
    expect(sql.ziel).toEqual({ s: 'qualifizierung' });
  });
});

// ── 2.3 / 2.5 · EIN Regelwerk für SQL, Quelle aus der Herkunft ──────────────────────────────────────────────────────────────
describe('2.3/2.5 · Deal anlegen: SQL nur bei erfüllten Kriterien, sonst „direkt angelegt“; Quelle aus der Herkunft', () => {
  it('dealBauen: nicht bereit → sql false mit „fehlt“; bereit → sql true; Quelle aus Marketing-Herkunft bzw. Kanal', async () => {
    const { leads } = await import('@/lib/crm/leads');
    const { dealBauen } = await import('@/lib/crm/deal-anlegen');
    const alleBest = { schmerz: 's5', entscheider: 's5', budget: 's5', zeitpunkt: 's5', fit: 'ja', groesse: 's5', passung: 's5', champion: 's5', prozess: 's5', wirkung: 's5', alternative: 's5', folge: 's5' };
    const kontakte = [k('a', { firmaId: 'f-a', firma: 'Firma f-a', herkunft: 'empfehlung' }), k('b', { firmaId: 'f-b', firma: 'Firma f-b', quelle: 'Anfrage über Website', aktivitaeten: [{ am: J, art: 'antwort', text: 'Anfrage über Website: bitte melden', von: 'kevin' }] })];
    const crm = crmLeer({ firmen: [firma('f-a'), firma('f-b', { stufen: alleBest })] });
    const z = leads(kontakte, crm, T);
    const ctx = { kontakte, firmen: crm.firmen, chancen: [], leadZeilen: z, person: 'kevin', jetzt: J };
    const a = dealBauen({ firmaId: 'f-a', kontaktIds: ['c-a'], schritt: { text: 'Bedarf klären', datum: T } }, ctx);
    expect(a.ok && a.sql).toBe(false);
    if (a.ok) { expect(a.fehlt.length).toBeGreaterThan(0); expect(a.chance.quelle).toBe('empfehlung'); expect(a.text).toContain('direkt angelegt'); }
    const b = dealBauen({ firmaId: 'f-b', kontaktIds: ['c-b'], schritt: { text: 'Angebot', datum: T } }, ctx);
    expect(b.ok && b.sql).toBe(true);
    if (b.ok) expect(b.chance.quelle).toBe('inbound');
    // Eine ausdrückliche Quelle gewinnt.
    const c = dealBauen({ firmaId: 'f-a', kontaktIds: ['c-a'], schritt: { text: 'x', datum: T }, quelle: 'event' }, ctx);
    if (c.ok) expect(c.chance.quelle).toBe('event');
  });

  it('quelleAusLead: Marketing-Herkunft vor Kanal, Netzwerk zählt als Bestand, unbekannt bleibt leer', async () => {
    const { quelleAusLead } = await import('@/lib/crm/leads');
    const s = (herkunft: { quelle: string }[]) => ({ punkte: 0, temperatur: 'kalt' as const, teile: [], scoring: { marketingHerkunft: herkunft } as never });
    expect(quelleAusLead({ score: s([{ quelle: 'kampagne' }, { quelle: 'anfrage' }]), kanal: 'empfehlung' })).toBe('kampagne');
    expect(quelleAusLead({ score: s([{ quelle: 'inhalt' }]), kanal: 'event' })).toBe('content');
    expect(quelleAusLead({ score: s([]), kanal: 'netzwerk' })).toBe('bestand');
    expect(quelleAusLead({ score: s([]), kanal: 'unbekannt' })).toBeUndefined();
  });

  it('leadDirekt: kein SQL, Status Qualifizierung (SQL/Kunde bleiben), Vermerk mit dem Fehlenden; ein späteres SQL räumt den Vermerk weg', async () => {
    const { leadDirekt, leadWirdSql } = await import('@/lib/crm/deal-anlegen');
    const c = { id: 'ch-1', qualifizierung: { ...KRIT } };
    const l = leadDirekt({ status: 'ruht', kriterien: { ...KRIT }, grund: 'später', wiedervorlage: '2027-01-01', grundArt: 'spaeter', notiz: 'n' }, c, ['Schmerz'], J, 'kevin');
    expect(l).toMatchObject({ status: 'qualifizierung', chanceId: 'ch-1', direktAm: J, direktOffen: ['Schmerz'], notiz: 'n' });
    expect(l.grund).toBeUndefined();
    expect(l.wiedervorlage).toBeUndefined();
    expect(leadDirekt({ status: 'kunde', kriterien: { ...KRIT } }, c, [], J, 'kevin').status).toBe('kunde');
    const sql = leadWirdSql(l, c, J, 'kevin');
    expect(sql.status).toBe('sql');
    expect(sql.direktAm).toBeUndefined();
  });

  it('leads(): ein direkt angelegter Lead zählt nicht als SQL; ist sein Deal gewonnen, wird er Kunde', async () => {
    const { leads, trichter } = await import('@/lib/crm/leads');
    const deal = (stufe: string) => ({ id: 'ch-d', titel: 'D', kontaktIds: ['c-a'], firmaId: 'f-a', art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe, historie: [], qualifizierung: { ...KRIT }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J }) as unknown as CrmBestand['chancen'][number];
    const lead = { status: 'qualifizierung' as const, chanceId: 'ch-d', direktAm: J, direktOffen: ['Schmerz'] };
    const offen = leads([k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', lead)], chancen: [deal('bedarf')] }), T)[0];
    expect(offen.status).toBe('qualifizierung');
    expect(offen.direkt).toEqual({ am: J, offen: ['Schmerz'] });
    expect(trichter([offen], crmLeer()).gespraechZuSql).toBeNull();
    const gewonnen = leads([k('a', { firmaId: 'f-a', firma: 'Firma f-a' })], crmLeer({ firmen: [firma('f-a', lead)], chancen: [deal('gewonnen')] }), T)[0];
    expect(gewonnen.status).toBe('kunde');
  });

  it('keine fest vorbelegte Quelle mehr in Gesprächsmodus und ZOE', () => {
    expect(quelle('components/os/crm/quali/Gespraechsmodus.tsx')).not.toMatch(/quelle="empfehlung"/);
    expect(quelle('lib/zoe/werkzeuge.ts')).not.toMatch(/schritt: \{ text: schritt, datum \}, quelle: 'bestand'/);
    expect(quelle('lib/zoe/crm-vorschlag.ts')).not.toMatch(/schritt: e\.schritt, quelle: 'bestand'/);
  });
});

// ── 2.2 / 2.8 · Oberfläche ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('2.2/2.8 · Deal in der Runden-Karte, „Ruht“/„Kein Fit“ über die Dialoge', () => {
  it('Runde: „SQL → Deal anlegen“ öffnet DealAnlegen in der Karte (kein Sprung in die Leads-Liste)', () => {
    const src = quelle('components/os/crm/Qualifizierung.tsx');
    expect(src).toContain("setWerkzeug('deal')");
    expect(src).toContain("werkzeug === 'deal' && (");
    expect(src).not.toContain('onClick={() => zuLeads(z.id)}>SQL → Deal anlegen');
  });
  it('Leads: die Pillen „Ruht“ und „Kein Fit“ öffnen Parken/Raus statt den Status direkt zu setzen; zweiter Deal nur mit Knopf', () => {
    const src = quelle('components/os/crm/Leads.tsx');
    expect(src).toContain("if (s === 'kein_fit') { setDialog('raus'); return; }");
    expect(src).toContain("if (s === 'ruht') { setDialog('parken'); return; }");
    expect(src).toContain('<ParkenDialog');
    expect(src).toContain('<RausDialog');
    expect(src).toContain('Bewusst zweiten Deal anlegen');
    expect(src).not.toContain("void setze({ status: s, grund })");
  });
});

// ── Routen (2.1, 2.3) ───────────────────────────────────────────────────────────────────────────────────────────────────────
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
let db: typeof import('@/lib/store/local-db');
let heute: string;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('route', { firmaId: 'f-route', firma: 'Firma f-route', email: 'route@example.invalid' }),
    k('ohne', { email: 'ohne@example.invalid' }),
    k('zwei', { firmaId: 'f-zwei', firma: 'Firma f-zwei' }),
  ] });
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [firma('f-route'), firma('f-zwei')] });
});

describe('Routen · „Geprüft“ stempelt der Server, ein Deal ohne Kriterien macht kein SQL', () => {
  it('POST /api/crm/lead setze { geprueft } → geprueftAm (Berliner Tag) am Lead; die Runde lässt ihn danach in Ruhe', async () => {
    const route = await import('@/app/api/crm/lead/route');
    const r = await route.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'setze', id: 'f-route', felder: { geprueft: true } }));
    expect(r.status).toBe(200);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const f = (await ladeCrm()).firmen.find(x => x.id === 'f-route')!;
    expect(f.lead?.geprueftAm).toBe(heute);
    const { leads, brauchtQualifizierung } = await import('@/lib/crm/leads');
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const z = leads(kontakte, await ladeCrm(), heute).find(x => x.id === 'f-route')!;
    expect(brauchtQualifizierung(z, heute)).toBe(false);
  });

  it('POST /api/crm/deal ohne erfüllte Kriterien: Deal steht, der Lead bleibt in der Qualifizierung mit Vermerk (nie SQL)', async () => {
    const route = await import('@/app/api/crm/deal/route');
    const r = await route.POST(anfrage('/api/crm/deal', sitzung('kevin'), 'POST', { aktion: 'anlegen', firmaId: 'f-route', kontaktIds: ['c-route'], schritt: { text: 'Bedarf klären', datum: heute } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.text).toContain('direkt angelegt');
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const crm = await ladeCrm();
    const lead = crm.firmen.find(x => x.id === 'f-route')!.lead!;
    expect(lead.status).toBe('qualifizierung');
    expect(lead.sqlAm).toBeUndefined();
    expect(lead.direktAm).toBeTruthy();
    expect(lead.chanceId).toBe(d.chance.id);
    expect(lead.direktOffen?.length).toBeGreaterThan(0);
  });

  it('Person ohne Firma: derselbe Vermerk an ihrem Lead in der Kartei', async () => {
    const route = await import('@/app/api/crm/deal/route');
    const r = await route.POST(anfrage('/api/crm/deal', sitzung('kevin'), 'POST', { aktion: 'anlegen', kontaktIds: ['c-ohne'], schritt: { text: 'Bedarf klären', datum: heute } }));
    expect(r.status).toBe(200);
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const lead = kontakte.find(x => x.id === 'c-ohne')!.lead!;
    expect(lead.status).toBe('qualifizierung');
    expect(lead.direktAm).toBeTruthy();
  });

  it('Leads-Weg (sql + trotzdem): kein SQL mehr ohne Kriterien; ein zweiter offener Deal nur mit `zweiter`', async () => {
    const route = await import('@/app/api/crm/lead/route');
    const deal = { titel: 'Zwei', schritt: { text: 'Bedarf', datum: heute } };
    const ohne = await route.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'sql', id: 'f-zwei', deal }));
    expect(ohne.status).toBe(400);
    const eins = await route.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'sql', id: 'f-zwei', trotzdem: true, deal }));
    const e = await eins.json();
    expect(eins.status).toBe(200);
    expect(e.sql).toBe(false);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).firmen.find(x => x.id === 'f-zwei')!.lead!.status).toBe('qualifizierung');
    const nochmal = await route.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'sql', id: 'f-zwei', trotzdem: true, deal }));
    expect(nochmal.status).toBe(409);
    expect((await nochmal.json()).offen?.id).toBe(e.chanceId);
    const zweiter = await route.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'sql', id: 'f-zwei', trotzdem: true, zweiter: true, deal }));
    expect(zweiter.status).toBe(200);
  });
});

// ── B · Angebot (3.3, 3.4, 3.5, 3.6, 3.12) ──────────────────────────────────────────────────────────────────────────────────
describe('B · Angebot: Folgeauftrag, Rückfrage, Mandat-Link, Einmalposten, Summe > 0', () => {
  const plus = (n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const pos = (id: string, basis: 'einmalig' | 'monat', cent: number) => ({ id, titel: `Position ${id}`, text: '', menge: 1, einheit: basis === 'monat' ? 'Monat' : 'pauschal', einzelpreisCent: cent, ustSatz: 19, basis, ...(basis === 'monat' ? { laufzeitMonate: 6 } : {}) });
  const felder = (x: Record<string, unknown> = {}) => ({ gesellschaft: 'ug', kontaktId: 'c-folge', titel: 'Folgeauftrag', gueltigBis: plus(20), zahlungszielTage: 14, einleitung: 'Guten Tag', schluss: 'Gruß', positionen: [pos('p-1', 'einmalig', 150000), pos('p-2', 'monat', 200000)], ...x });

  beforeAll(async () => {
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), k('folge', { firmaId: 'f-folge', firma: 'Firma f-folge', email: 'folge@example.invalid', anrede: 'Sie', stufe: 'gespraech' })] }));
    const gewonnen = { id: 'ch-alt-gewonnen', titel: 'Erster Auftrag', kontaktIds: ['c-folge'], firmaId: 'f-folge', firma: 'Firma f-folge', art: 'projekt', wert: { betrag: 1000, basis: 'einmalig' }, stufe: 'gewonnen', historie: [{ stufe: 'gewonnen', am: J, von: 'kevin' }], qualifizierung: { ...KRIT }, gesellschaft: 'ug', besitzer: 'kevin', angelegt: J, geaendert: J };
    await db.updateJson<CrmBestand>('crm', cur => ({ ...(cur as CrmBestand), firmen: [...(cur?.firmen ?? []), firma('f-folge')], chancen: [...(cur?.chancen ?? []), gewonnen as never] }));
    await db.saveJson('gesellschaften--haus', { gesellschaften: [{ id: 'ug', firmierung: 'Beispiel Innovation GmbH', strasse: 'Musterweg 1', plz: '10115', ort: 'Berlin', email: 'info@example.invalid', geschaeftsfuehrung: 'Erika Muster', register: 'AG Beispiel HRB 1', steuernummer: '00/000/00000' }] });
  });

  it('3.12 · Summe 0 €: stellenFehlt nennt es, der Server antwortet 409 — keine Nummer verbraucht', async () => {
    const { stellenFehlt, SUMME_NULL } = await import('@/lib/crm/angebote');
    const a = { status: 'entwurf', kontaktId: 'c-x', titel: 'T', gueltigBis: plus(5), positionen: [pos('p-1', 'einmalig', 0)] } as never;
    expect(stellenFehlt(a, heute)).toContain(SUMME_NULL);
    const route = await import('@/app/api/crm/angebot/route');
    const s = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'speichern', id: 'ang-woche1-null', felder: felder({ positionen: [pos('p-1', 'einmalig', 0)] }) }));
    const st = (await s.json() as { angebot: { stand: string } }).angebot.stand;
    const r = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'stellen', id: 'ang-woche1-null', stand: st }));
    expect(r.status).toBe(409);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).angebote.find(x => x.id === 'ang-woche1-null')!.nummer).toBeUndefined();
  });

  it('3.3 · Angebot zu einem gewonnenen Deal (Folgeauftrag): beim Stellen entsteht ein NEUER Deal, der alte bleibt gewonnen', async () => {
    const route = await import('@/app/api/crm/angebot/route');
    const s = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'speichern', id: 'ang-woche1-folge', felder: felder({ dealId: 'ch-alt-gewonnen' }) }));
    expect(s.status).toBe(200);
    const st = (await s.json() as { angebot: { stand: string } }).angebot.stand;
    const r = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'stellen', id: 'ang-woche1-folge', stand: st }));
    const d = await r.json() as { angebot: { dealId?: string; stand: string }; fehler?: string };
    expect(r.status, d.fehler).toBe(200);
    expect(d.angebot.dealId).toBeTruthy();
    expect(d.angebot.dealId).not.toBe('ch-alt-gewonnen');
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const crm = await ladeCrm();
    expect(crm.chancen.find(c => c.id === 'ch-alt-gewonnen')!.stufe).toBe('gewonnen');
    expect(crm.chancen.find(c => c.id === d.angebot.dealId)!.stufe).toBe('angebot');
    // Angenommen → der NEUE Deal ist gewonnen, „Mandat anlegen“ gelingt (vorher 400).
    const an = await route.POST(anfrage('/api/crm/angebot', sitzung('kevin'), 'POST', { aktion: 'annehmen', id: 'ang-woche1-folge', stand: d.angebot.stand }));
    expect(an.status).toBe(200);
    const lead = await import('@/app/api/crm/lead/route');
    const m = await lead.POST(anfrage('/api/crm/lead', sitzung('kevin'), 'POST', { aktion: 'mandat', chanceId: d.angebot.dealId }));
    const md = await m.json() as { ok: boolean; mandatId?: string };
    expect(md.ok).toBe(true);
    expect(md.mandatId).toMatch(/^m-/);
  });

  it('3.6 · gemischtes Angebot: die Einmalposten werden EINE geplante Rechnung (feste Kennung, idempotent, nur einmalige Positionen)', async () => {
    const { entwurfNeu, einmalRechnungId } = await import('@/lib/finanzen/rechnung/server');
    const z = { person: 'kevin', haushalt: 'haus', sicht: 'business' as const };
    const e1 = await entwurfNeu({ quelle: 'angebot', angebotId: 'ang-woche1-folge', nur: 'einmalig', ...z });
    expect(e1.vorhanden).toBe(false);
    expect(e1.rechnung.id).toBe(einmalRechnungId('ang-woche1-folge'));
    expect(e1.rechnung.status).toBe('geplant');
    expect(e1.rechnung.firmaId).toBe('ug');
    expect((e1.rechnung.positionen ?? []).map(p => p.titel)).toEqual(['Position p-1']);
    // Brutto über ust.ts: 1.500 € netto + 19 % = 1.785 €.
    expect(e1.rechnung.betrag).toBe(1785);
    expect(e1.rechnung.mandatId).toBeTruthy();
    const e2 = await entwurfNeu({ quelle: 'angebot', angebotId: 'ang-woche1-folge', nur: 'einmalig', ...z });
    expect(e2.vorhanden).toBe(true);
    expect(e2.rechnung.id).toBe(e1.rechnung.id);
    // Ohne Einmalposten → 409.
    await expect(entwurfNeu({ quelle: 'angebot', angebotId: 'ang-woche1-null', nur: 'einmalig', ...z })).rejects.toMatchObject({ status: 409 });
  });

  it('3.4/3.5/3.6 · Oberfläche: „Angenommen“ fragt nach; nach „Mandat anlegen“ Link zum Mandat und „Erste Rechnung“; Einmalbetrag geplant', () => {
    const src = quelle('components/os/crm/angebot/Ansicht.tsx');
    expect(src).toContain("titel: 'Angebot als angenommen vermerken?'");
    expect(src).toContain('onClick={annehmen}');
    expect(src).toContain('WEG.mandat(mandatZiel)');
    expect(src).toContain("entwurfAnlegen({ quelle: 'mandat', mandatId: mandatZiel })");
    expect(src).toContain("entwurfAnlegen({ quelle: 'angebot', angebotId: a.id, nur: 'einmalig' })");
    expect(src).toContain("if (typeof r.mandatId === 'string') setMandatId(r.mandatId);");
  });

  it('3.3 · Editor und Deal-Akte übernehmen einen geschlossenen Deal nicht', () => {
    expect(quelle('components/os/crm/angebot/Editor.tsx')).toContain('const geschlossen = !!vorDeal && !OFFENE_STUFEN.includes(vorDeal.stufe);');
    expect(quelle('components/os/crm/DealAkte.tsx')).toContain('...(OFFENE_STUFEN.includes(c.stufe) ? { dealId: c.id } : {})');
  });
});

// ── C · Follow-up (4.4, 4.5, 4.6, 4.7, 4.8, 4.9) ────────────────────────────────────────────────────────────────────────────
describe('C · Follow-up: Deal-Schritt, ein Erledigen-Formular, Art nach Ergebnis, Aufgaben am Kontakt, Art. 18 in Glocke/Heute', () => {
  const deal = (x: Record<string, unknown> = {}) => ({ id: 'ch-fu', titel: 'Deal FU', kontaktIds: ['c-fu'], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'angebot', historie: [], qualifizierung: { ...KRIT }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, naechsterSchritt: { text: 'Angebot nachfassen', datum: T }, ...x }) as unknown as CrmBestand['chancen'][number];
  const fu = (x: Record<string, unknown> = {}) => ({ id: 'fu-deal', bezug: { art: 'chance', id: 'ch-fu' }, kontaktId: 'c-fu', art: 'anruf', text: 'Angebot nachfassen', faellig: T, zustaendig: 'kevin', status: 'offen', quelle: 'deal', angelegt: J, geaendert: J, ...x }) as unknown as NonNullable<CrmBestand['followups']>[number];

  it('4.4 · dealSchrittErledigt: fällig, gleicher Tag oder gleicher Text = derselbe Schritt; ein späterer anderer bleibt', async () => {
    const { dealSchrittErledigt } = await import('@/lib/crm/followup');
    const f = { text: 'Angebot nachfassen', faellig: T };
    expect(dealSchrittErledigt({ text: 'Etwas', datum: vor(1) }, f, T)).toBe(true);
    expect(dealSchrittErledigt({ text: 'Etwas', datum: T }, f, T)).toBe(true);
    expect(dealSchrittErledigt({ text: 'angebot nachfassen ', datum: vor(-20) }, f, T)).toBe(true);
    expect(dealSchrittErledigt({ text: 'Vertrag schicken', datum: vor(-20) }, f, T)).toBe(false);
    expect(dealSchrittErledigt(undefined, f, T)).toBe(false);
  });

  it('4.4 · Power Hour erledigt ein Deal-Follow-up: derselbe Schritt am Deal wird geleert, ein „nächster Schritt“ der Karte gesetzt, ein späterer bleibt', async () => {
    const { aktivitaetImCrm } = await import('@/lib/crm/aktivitaet-folgen');
    const ein = (x: Record<string, unknown> = {}) => ({ kontakt: k('fu'), ergebnis: 'gespraech' as const, von: 'kevin', heute: T, jetzt: J, followupId: 'fu-deal', ...x });
    const leer = aktivitaetImCrm(crmLeer({ chancen: [deal()], followups: [fu()] }), ein());
    expect(leer.crm.chancen[0].naechsterSchritt).toBeUndefined();
    const gesetzt = aktivitaetImCrm(crmLeer({ chancen: [deal()], followups: [fu()] }), ein({ naechster: { text: 'Vertrag schicken', datum: vor(-3) } }));
    expect(gesetzt.crm.chancen[0].naechsterSchritt).toEqual({ text: 'Vertrag schicken', datum: vor(-3) });
    const spaeter = aktivitaetImCrm(crmLeer({ chancen: [deal({ naechsterSchritt: { text: 'Workshop', datum: vor(-10) } })], followups: [fu()] }), ein());
    expect(spaeter.crm.chancen[0].naechsterSchritt).toEqual({ text: 'Workshop', datum: vor(-10) });
    // „nicht erreicht“: das Follow-up kommt wieder, der Deal bleibt unberührt.
    const nochmal = aktivitaetImCrm(crmLeer({ chancen: [deal()], followups: [fu()] }), ein({ ergebnis: 'nicht_erreicht', followupNochmalAm: vor(-2) }));
    expect(nochmal.crm.chancen[0].naechsterSchritt).toEqual({ text: 'Angebot nachfassen', datum: T });
  });

  it('4.6 · „Sonstiges“ mit Ergebnis wird Gespräch bzw. Anruf (zählt für letzten Kontakt und Kadenz), ohne Ergebnis bleibt es Notiz', async () => {
    const { aktivitaetArtNachErledigen } = await import('@/lib/crm/followup');
    const { echterKontakt } = await import('@/lib/make-one/crm');
    expect(aktivitaetArtNachErledigen('sonstig')).toBe('notiz');
    expect(aktivitaetArtNachErledigen('sonstig', 'gespraech')).toBe('gespraech');
    expect(aktivitaetArtNachErledigen('sonstig', 'termin')).toBe('gespraech');
    expect(aktivitaetArtNachErledigen('sonstig', 'mailbox')).toBe('anruf');
    expect(aktivitaetArtNachErledigen('nachricht', 'gespraech')).toBe('mail');
    expect(echterKontakt({ art: aktivitaetArtNachErledigen('sonstig', 'gespraech'), ergebnis: 'gespraech' })).toBe(true);
  });

  it('4.5/4.9 · Kontakt › Aktivitäten nimmt das Erledigen-Formular der Liste; „Sperre“ fragt nach', () => {
    const reiter = quelle('components/os/crm/kontakt/AktivitaetenReiter.tsx');
    expect(reiter).toContain('<Erledigen f={f}');
    expect(reiter).toContain("JSON.stringify({ aktion: 'erledigen', id, ...b })");
    expect(quelle('components/os/crm/FollowUp.tsx')).toContain('export function Erledigen(');
    expect(quelle('components/os/crm/FollowUp.tsx')).toContain("ergebnis === 'sperre' && !(await bestaetigen(");
    expect(quelle('components/os/crm/kontakt/aktivitaeten-teile.tsx')).not.toContain('onErledigen(e.followupId');
  });

  it('4.7 · aufgabenFuerAktivitaet: erledigte Aufgabe mit Kontakt-Bezug ja; „nur ich“, ohne Kontakt, über Follow-up schon erledigt nein', async () => {
    const { aufgabenFuerAktivitaet, aufgabenFuerPowerHour } = await import('@/lib/crm/followup-aufgabe');
    const t = (id: string, x: Record<string, unknown> = {}) => ({ id, title: `Aufgabe ${id}`, status: 'todo', assignee: 'malin', dueDate: T, bezug: { kontaktId: 'c-fu' }, ...x }) as never;
    const vorher = { tasks: [t('a'), t('b', { sichtbarkeit: 'nur-ich' }), t('c', { bezug: { firmaId: 'f-x' } }), t('d'), t('e')] };
    const nachher = { tasks: vorher.tasks.map(x => ({ ...(x as object), status: 'done' }) as never) };
    const fus = [fu({ id: 'fu-d', aufgabeId: 'd', status: 'erledigt', bezug: { art: 'kontakt', id: 'c-fu' } }), fu({ id: 'fu-e', aufgabeId: 'e', status: 'erledigt', bezug: { art: 'kontakt', id: 'c-fu' } })];
    // d: Follow-up war schon erledigt (der Follow-up-Weg schrieb die Aktivität) → nein; e: dieses Schreiben erledigte es → ja.
    expect(aufgabenFuerAktivitaet(vorher, nachher, fus, ['fu-e']).map(x => x.aufgabeId)).toEqual(['a', 'e']);
    expect(aufgabenFuerPowerHour([t('x'), t('y', { dueDate: vor(-3) }), t('z', { status: 'done' })], T).map(x => x.aufgabeId)).toEqual(['x']);
  });

  it('4.7 · Power Hour kennt fällige Aufgaben mit Kontakt-Bezug — die Karte gehört der Verantwortlichen', async () => {
    const { werIstDran, karteGehoert } = await import('@/lib/crm/heute');
    const p = k('fu', { email: 'fu@example.invalid', telefon: '+49 30 1', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'], stufe: 'gespraech', besitzer: 'kevin', letzterKontakt: vor(30) });
    const crm = crmLeer();
    const a = werIstDran([p], crm, T, 'malin', 12, [{ aufgabeId: 't-1', titel: 'Unterlagen schicken', faellig: T, kontaktId: 'c-fu', zustaendig: 'malin' }]);
    expect(a.karten).toHaveLength(1);
    expect(a.karten[0].aufgabe).toEqual({ id: 't-1', zustaendig: 'malin' });
    expect(karteGehoert(a.karten[0], crm)).toBe('malin');
    expect(werIstDran([p], crm, T, 'kevin', 12, [{ aufgabeId: 't-1', titel: 'Unterlagen schicken', faellig: T, kontaktId: 'c-fu', zustaendig: 'malin' }]).karten.some(x => x.aufgabe)).toBe(false);
  });

  it('4.7 · erledigte Aufgabe → EINE Notiz am Kontakt (idempotent), Kadenz ab heute; nie bei Art. 18 oder Werbesperre', async () => {
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []),
      k('aufg', { letzterKontakt: vor(100) }), k('aufg-sperre', { werbesperre: { seit: vor(5), grund: 'Widerspruch' } }), k('aufg-art18', { eingeschraenkt: { seit: vor(5), grund: 'Antrag', von: 'kevin' } as never }),
    ] }));
    const { aktivitaetenNachAufgaben } = await import('@/lib/crm/followup-aufgabe-server');
    const liste = [{ aufgabeId: 't-aufg-1', kontaktId: 'c-aufg', titel: 'Unterlagen schicken' }, { aufgabeId: 't-aufg-2', kontaktId: 'c-aufg-sperre', titel: 'x' }, { aufgabeId: 't-aufg-3', kontaktId: 'c-aufg-art18', titel: 'y' }];
    expect(await aktivitaetenNachAufgaben(liste, 'malin')).toBe(1);
    expect(await aktivitaetenNachAufgaben(liste, 'malin')).toBe(0);
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const a = kontakte.find(x => x.id === 'c-aufg')!;
    expect((a.aktivitaeten ?? []).filter(x => x.aufgabeId === 't-aufg-1')).toHaveLength(1);
    expect(a.aktivitaeten!.find(x => x.aufgabeId === 't-aufg-1')).toMatchObject({ art: 'notiz', von: 'malin', text: 'Aufgabe erledigt: Unterlagen schicken' });
    expect(a.letzterKontakt).toBe(heute);
    for (const id of ['c-aufg-sperre', 'c-aufg-art18']) expect((kontakte.find(x => x.id === id)!.aktivitaeten ?? []).some(x => x.aufgabeId)).toBe(false);
    // Der Säuberer behält die Kennung (sonst käme die Notiz nach dem nächsten Speichern doppelt).
    const { saeubereKontakt } = await import('@/lib/make-one/crm');
    expect(saeubereKontakt(a)?.aktivitaeten?.find(x => x.aufgabeId === 't-aufg-1')).toBeTruthy();
  });

  it('4.8 · Glocke/Heute: echte Follow-ups eingeschränkter Personen erscheinen nie (auch mit der verarbeitbaren Kartei)', async () => {
    const { faellige } = await import('@/lib/crm/followup');
    const crm = crmLeer({ followups: [fu({ id: 'fu-art18', kontaktId: 'c-weg', bezug: { art: 'kontakt', id: 'c-weg' }, text: 'Max Mustername anrufen' }), fu({ id: 'fu-ok', kontaktId: 'c-da', bezug: { art: 'kontakt', id: 'c-da' } })] });
    const kontakte = [k('da')]; // die verarbeitbare Kartei kennt c-weg nicht
    expect(faellige(kontakte, crm, T, { horizont: 0 }).map(f => f.id)).toContain('fu-art18'); // vorher: mit dem Text als Namen
    expect(faellige(kontakte, crm, T, { horizont: 0, ausgeblendet: new Set(['c-weg']) }).map(f => f.id)).toEqual(['fu-ok']);
    const { eingeschraenkteKennungen } = await import('@/lib/crm/verarbeitung');
    expect((await eingeschraenkteKennungen()).has('c-aufg-art18')).toBe(true);
    const src = quelle('lib/heute/anstehend-server.ts');
    expect(src).toContain('eingeschraenkteKennungen()');
    expect(src).toContain('ausgeblendet: ausgeblendet ?? ohneSichtbareKennung(crm, kontakte)');
  });

  it('4.4 · Follow-up-Route: ein Deal-Follow-up, dessen Schritt am Deal derselbe ist, braucht „Als Nächstes“ (sonst 400, nichts erledigt)', async () => {
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), k('fu', { email: 'fu@example.invalid', besitzer: 'kevin' })] }));
    await db.updateJson<CrmBestand>('crm', cur => ({ ...(cur as CrmBestand), chancen: [...(cur?.chancen ?? []), deal({ naechsterSchritt: { text: 'Angebot nachfassen', datum: heute } })], followups: [...(cur?.followups ?? []), fu({ faellig: heute })] }));
    const route = await import('@/app/api/crm/followup/route');
    const ohne = await route.POST(anfrage('/api/crm/followup', sitzung('kevin'), 'POST', { aktion: 'erledigen', id: 'fu-deal' }));
    expect(ohne.status).toBe(400);
    const mit = await route.POST(anfrage('/api/crm/followup', sitzung('kevin'), 'POST', { aktion: 'erledigen', id: 'fu-deal', ergebnis: 'gespraech', naechster: { text: 'Vertrag schicken', faellig: (await import('@/lib/zeit')).tagePlus(heute, 3) } }));
    expect(mit.status).toBe(200);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const c = await ladeCrm();
    expect(c.chancen.find(x => x.id === 'ch-fu')!.naechsterSchritt?.text).toBe('Vertrag schicken');
    // 4.6: das Ergebnis „Gespräch“ zählt am Kontakt als echter Kontakt.
    const kfu = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-fu')!;
    expect(kfu.letzterKontakt).toBe(heute);
  });
});

// ── D · Marketing & Netzwerken (5.1, 5.2, 5.3, 5.13, 5.14, dazu 1.5) ────────────────────────────────────────────────────────
describe('D · Marketing-Herkunft, Kampagne in der Power Hour, Netzwerken-Namen', () => {
  const anfrage = (text: string, bezug?: string) => ({ am: J, art: 'antwort' as const, text, von: 'kevin', ...(bezug ? { bezug } : {}) });
  it('5.1 · die Datenschutz-Herkunft macht keinen Marketing-Lead; Anfragen über Empfehlung/Event bzw. zu einem besuchten Event auch nicht', async () => {
    const { marketingHerkunft, istMarketingLead, anfrageIstMarketing, ANFRAGE_OHNE_MARKETING } = await import('@/lib/crm/scoring');
    const { anfrageText, ANFRAGE_KANAELE } = await import('@/lib/crm/anfragen');
    const besucht = { id: 'ev-besucht', titel: 'Messe', datum: vor(3), marke: 'Netzwerken', status: 'durchgefuehrt' } as never;
    const eigen = { id: 'ev-eigen', titel: 'Abend', datum: vor(3), status: 'durchgefuehrt' } as never;
    // Visitenkarte, „selbst angegeben“ (Art. 14) — keine Anfrage, kein Marketing.
    expect(istMarketingLead([k('karte', { herkunft: 'selbst', quelle: 'Visitenkarte' })])).toBe(false);
    // Website-Anfrage: Marketing.
    expect(marketingHerkunft([k('web', { herkunft: 'selbst', quelle: 'Anfrage über Website', aktivitaeten: [anfrage(anfrageText('website', 'Bitte um Rückruf'))] })]).map(g => g.quelle)).toEqual(['anfrage']);
    // Empfehlung/Event: kein Marketing — auch nicht über die Quelle „Anfrage über …“.
    expect(istMarketingLead([k('empf', { herkunft: 'selbst', quelle: 'Anfrage über Empfehlung', aktivitaeten: [anfrage(anfrageText('empfehlung', 'x'))] })])).toBe(false);
    expect(istMarketingLead([k('ev', { herkunft: 'selbst', quelle: 'Anfrage über Event', aktivitaeten: [anfrage(anfrageText('event', 'x'))] })])).toBe(false);
    // Website-Anfrage mit Bezug auf ein BESUCHTES Event: Begegnung, kein Marketing; Bezug auf ein eigenes Event: Marketing.
    const mitBezug = (ev: string) => [k('bez', { quelle: 'Anfrage über Website', aktivitaeten: [anfrage(anfrageText('website', 'x'), ev)] })];
    expect(istMarketingLead(mitBezug('ev-besucht'), { events: [besucht, eigen] })).toBe(false);
    expect(istMarketingLead(mitBezug('ev-eigen'), { events: [besucht, eigen] })).toBe(true);
    // Die Liste der „keine Marketing“-Kanäle passt zu den Beschriftungen des Anfragen-Eingangs.
    for (const kn of ANFRAGE_OHNE_MARKETING) expect(ANFRAGE_KANAELE.some(x => x.label === kn), kn).toBe(true);
    expect(anfrageIstMarketing({ text: anfrageText('linkedin', 'x') })).toBe(true);
  });
  it('5.1/1.5 · Kartei: Visitenkarte → Herkunft „Veranstaltung“; Anlegen prüft Firma und Kontakt, bevor die Karte öffnet', () => {
    const src = quelle('components/os/crm/Kartei.tsx');
    expect(src).toContain("herkunft: e.herkunft ?? 'veranstaltung'");
    expect(src).toContain("if (!(await api.setze('firmen'");
    expect(src).toContain('if (!gespeichert) return;');
  });
  it('5.3/5.2 · Kampagne: „heute in der Power Hour: n“ aus derselben Rechnung, ehrlicher Text; Ampel-Hinweis des Servers sichtbar', async () => {
    const { kampagneInPowerHour, NEU_MAX } = await import('@/lib/crm/heute');
    expect(kampagneInPowerHour([{ bezug: 'kp-1' }, { bezug: 'kp-2' }, { bezug: 'kp-1' }, {}], 'kp-1')).toBe(2);
    expect(NEU_MAX).toBe(4);
    const src = quelle('components/os/crm/Kampagnen.tsx');
    expect(src).toContain('heute in der Power Hour: ${inPowerHour}');
    expect(src).toContain('/api/crm/heute?n=12&fuer=');
    expect(src).not.toContain('— sie stehen in der Power Hour von');
    expect(src).toContain('r.hinweis');
    expect(quelle('app/api/crm/kampagnen/route.ts')).toContain('hinweis: ampelText.trim()');
  });
  it('5.14 · Netzwerken: Vorname ODER Nachname reicht (Browser und Server)', async () => {
    const { erfassungPruefen, nameOk, NAME_FEHLT } = await import('@/lib/crm/netzwerken');
    const roh = (kontakt: Record<string, unknown>) => ({ erfassungId: '3f2b9c1e-1a2b-4c3d-8e4f-0123456789ab', erfasstAm: J, eventId: 'ev-test-1', kontakt, bilder: [], schritt: 'nur-kontakt', zustaendig: 'kevin' });
    expect(erfassungPruefen(roh({ vorname: 'Nur' }), { heute: T, jetzt: new Date(J) }).ok).toBe(true);
    expect(erfassungPruefen(roh({ nachname: 'Beispiel' }), { heute: T, jetzt: new Date(J) }).ok).toBe(true);
    const ohne = erfassungPruefen(roh({ firma: 'Nur Firma' }), { heute: T, jetzt: new Date(J) });
    expect(ohne.ok).toBe(false);
    if (!ohne.ok) expect(ohne.fehler).toBe(NAME_FEHLT);
    expect(nameOk({ vorname: ' ' })).toBe(false);
    expect(quelle('components/os/netzwerken/Erfassen.tsx')).toContain('nameOk(f)');
  });
  it('5.14 · ohne Nachnamen hängt eine gleiche Nummer NIE an (die Dublettenregel bleibt sicher)', async () => {
    const { zusammenfuehrung } = await import('@/lib/crm/netzwerken');
    const da = k('da', { vorname: 'Max', nachname: 'Beispiel', telefon: '+49 30 1234567' });
    const r = zusammenfuehrung({ kontakt: { vorname: 'Max', telefon: '+49 30 1234567' } }, [da], 'c-neu');
    expect(r.ziel).toBeUndefined();
    expect(r.gleicheNummer?.kontakt.id).toBe('c-da');
  });
  it('5.13 · Netzwerken liest die Karte über /api/crm/visitenkarte; kein fester Personenname im Prompt der Route', () => {
    expect(quelle('lib/crm/netzwerken-karte.ts')).not.toContain('export const KARTE_AUSLESEN_AN');
    expect(quelle('lib/crm/netzwerken-karte.ts')).toContain("'/api/crm/visitenkarte'");
    expect(quelle('app/api/crm/visitenkarte/route.ts')).not.toMatch(/Kevin und Malin/);
  });
});

// ── E · Scoreboard & Index (6.3, 7.1, 7.2) ──────────────────────────────────────────────────────────────────────────────────
describe('6.3 · Sales-Anteile nur für Sales-Verantwortliche bzw. ab der eigenen Power Hour', () => {
  it('salesAnteilAb: Sales-Verantwortliche ab dem Team-Start, alle anderen erst ab ihrer ersten eigenen Power Hour', async () => {
    const { salesAnteilAb } = await import('@/lib/crm/scoreboard');
    const { TEAM } = await import('@/lib/crm/team');
    const sales = TEAM.find(t => t.verantwortet.includes('sales'))!, andere = TEAM.find(t => !t.verantwortet.includes('sales'))!;
    expect(salesAnteilAb([], vor(30))).toMatchObject({ [sales.id]: vor(30), [andere.id]: null });
    expect(salesAnteilAb([{ person: andere.id, datum: vor(10) }], vor(30))).toMatchObject({ [sales.id]: vor(30), [andere.id]: vor(10) });
    expect(salesAnteilAb([], null)[sales.id]).toBeNull();
  });

  it('Scoreboard: wer kein Sales macht und keine Power Hour hatte, hat kein Ziel (nie rot) — das Teamziel teilt sich nur auf Personen mit Anteil', async () => {
    const { wochenScoreboard, SCORE_ZIELE } = await import('@/lib/crm/scoreboard');
    const { TEAM } = await import('@/lib/crm/team');
    const sales = TEAM.find(t => t.verantwortet.includes('sales'))!, andere = TEAM.find(t => !t.verantwortet.includes('sales'))!;
    const ph = (id: string, person: string, datum: string) => ({ id, person, datum, start: `${datum}T09:00:00.000Z`, ziel: { gespraeche: 0, termine: 0 }, karten: [] });
    const sb = wochenScoreboard([], crmLeer({ sitzungen: [ph('s1', sales.id, vor(20)), ph('s2', sales.id, vor(3))] } as Partial<CrmBestand>), T, 4);
    const zeile = (id: string) => sb.zeilen.find(z => z.id === id)!;
    expect(zeile(`power_hours:${andere.id}`).ziel).toBeNull();
    expect(zeile(`power_hours:${andere.id}`).ampeln).not.toContain('rot');
    expect(zeile(`gespraeche:${andere.id}`).ziel).toBeNull();
    expect(zeile(`power_hours:${sales.id}`).ziel).toBe(SCORE_ZIELE.power_hours); // vorher die Hälfte — geteilt durch alle im Team
    // Sobald die andere Person selbst eine Power Hour macht, trägt sie ab dann einen Anteil.
    const mit = wochenScoreboard([], crmLeer({ sitzungen: [ph('s1', sales.id, vor(20)), ph('s3', andere.id, vor(2))] } as Partial<CrmBestand>), T, 4);
    expect(mit.zeilen.find(z => z.id === `power_hours:${andere.id}`)!.ziel).toBe(Math.ceil(SCORE_ZIELE.power_hours / 2));
  });
});

describe('7.1 · Kadenz ab Import, Index in der Anlaufphase vorläufig', () => {
  it('kadenzBasis: letzter Kontakt, aber nie vor dem Tag der Aufnahme in die Kartei', async () => {
    const { kadenzBasis } = await import('@/lib/crm/followup');
    expect(kadenzBasis(k('a', { letzterKontakt: vor(100), importiertAm: vor(10) }), T)).toBe(vor(10));
    expect(kadenzBasis(k('a', { letzterKontakt: vor(100), importiertAm: vor(200) }), T)).toBe(vor(100));
    expect(kadenzBasis(k('a', { letzterKontakt: vor(100), importiertAm: '2026-12-01' }), T)).toBe(vor(100)); // Zukunft zählt nicht
    expect(kadenzBasis(k('a', { importiertAm: vor(10) }), T)).toBeUndefined(); // ohne letzten Kontakt keine Kadenz (wie bisher)
  });

  it('frisch importierte Person mit altem letzten Kontakt erzeugt keine überfällige Kadenz', async () => {
    const { faellige } = await import('@/lib/crm/followup');
    const frisch = k('neu', { kreis: 'A', letzterKontakt: vor(200), importiertAm: vor(1) });
    const alt = k('alt', { kreis: 'A', letzterKontakt: vor(200), importiertAm: vor(300) });
    const liste = faellige([frisch, alt], crmLeer(), T);
    expect(liste.some(f => f.kontaktId === 'c-neu')).toBe(false);
    expect(liste.some(f => f.kontaktId === 'c-alt')).toBe(true);
  });

  it('Traktions-Index: ANLAUF_TAGE nach dem ersten Lauf „vorläufig“ (gerechnet wie immer), danach nicht mehr', async () => {
    const { traktionsIndex, alsTraktion, ersterLauf, ANLAUF_TAGE } = await import('@/lib/crm/traktion-index');
    expect(ersterLauf({ tage: { [vor(5)]: 1, [vor(40)]: 1 } }, T)).toBe(vor(40));
    expect(ersterLauf(null, T)).toBe(T);
    const anlauf = traktionsIndex({ kontakte: [], crm: crmLeer(), heute: T, ersterLauf: vor(3) });
    expect(anlauf.vorlaeufig?.bis).toBe(vor(3 - ANLAUF_TAGE));
    const spaeter = traktionsIndex({ kontakte: [], crm: crmLeer(), heute: T, ersterLauf: vor(ANLAUF_TAGE + 1) });
    expect(spaeter.vorlaeufig).toBeUndefined();
    expect(spaeter.index).toBe(anlauf.index); // keine eigene Punkte-Logik — nur die Beschriftung
    expect(traktionsIndex({ kontakte: [], crm: crmLeer(), heute: T }).vorlaeufig).toBeUndefined(); // ohne Angabe wie bisher
    // alsTraktion trägt die Anlaufphase in Kennzeichen und Hinweis.
    const gemessen = { ...anlauf, saeulen: anlauf.saeulen.map(s => ({ ...s, score: 50, zuDuenn: false })) };
    const t = alsTraktion(gemessen);
    expect(t.vorlaeufig).toBe(true);
    expect(t.hinweis).toMatch(/^Anlaufphase bis \d{2}\.\d{2}\. — vorläufig/);
  });
});

describe('7.2 · EINE Messlatte: Ziele der Wertelisten gelten für Kennzahl, Index und Scoreboard', () => {
  const ziele = { ziele: { gespraecheWoche: 12, sqlMonat: 8 } } as unknown as CrmBestand['wertelisten'];
  it('messlatte: Ziel = grün, rot unter der Hälfte; ohne Ziel die Startschwellen', async () => {
    const { messlatte, sqlJeWoche } = await import('@/lib/crm/kennzahlen');
    expect(messlatte(undefined)).toMatchObject({ gespraeche: { gruen: 8, rot: 4 }, sql30: { gruen: 2, rot: 1 }, ausZiel: { gespraeche: false, sql: false } });
    const m = messlatte(ziele);
    expect(m).toMatchObject({ gespraeche: { gruen: 12, rot: 6 }, sql30: { gruen: 8, rot: 4 }, ausZiel: { gespraeche: true, sql: true } });
    expect(sqlJeWoche(m)).toBe(2);
  });

  it('Traktions-Index rechnet mit dem Ziel — auch gegen eigene Index-Schwellen', async () => {
    const { traktionsIndex, zielSchwellen } = await import('@/lib/crm/traktion-index');
    expect(zielSchwellen(crmLeer())).toEqual({});
    const idx = traktionsIndex({ kontakte: [], crm: crmLeer({ wertelisten: ziele }), heute: T, schwellen: { gespraeche: { gruen: 5, rot: 2 }, power_hours: { gruen: 6, rot: 3 } } });
    const kz = (id: string) => idx.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === id)!;
    expect(kz('gespraeche')).toMatchObject({ gruen: 12, rot: 6 });
    expect(kz('sql_30')).toMatchObject({ gruen: 8, rot: 4 });
    expect(kz('power_hours')).toMatchObject({ gruen: 6, rot: 3 }); // eigene Schwellen ohne Ziel bleiben
  });

  it('Scoreboard: Gespräche und neue SQL messen am Ziel der Wertelisten', async () => {
    const { wochenScoreboard, SCORE_ZIELE } = await import('@/lib/crm/scoreboard');
    const ohne = wochenScoreboard([], crmLeer(), T, 2);
    expect(ohne.zeilen.find(z => z.id === 'gespraeche')!.ziel).toBe(SCORE_ZIELE.gespraeche);
    expect(ohne.zeilen.find(z => z.id === 'neue_chancen')!.ziel).toBe(SCORE_ZIELE.neue_chancen);
    const mit = wochenScoreboard([], crmLeer({ wertelisten: ziele }), T, 2);
    expect(mit.zeilen.find(z => z.id === 'gespraeche')!.ziel).toBe(12);
    expect(mit.zeilen.find(z => z.id === 'neue_chancen')!.ziel).toBe(2);
  });
});

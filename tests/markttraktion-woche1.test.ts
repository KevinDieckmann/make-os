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

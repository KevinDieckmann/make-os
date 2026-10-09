// ─── Markttraktion Woche 2 · Teil A (09.10.) — Anlegen, Leads, Qualifizierung (MARKTTRAKTION_BEFUND.md, Teil 2) je mit Wächter ─────────
// 1.6–1.15 und 2.4–2.17. Eigener Datenordner, erfundene Daten (keine echten Namen/Firmen/Beträge).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Lead } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mt-woche2a-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mt-woche2a';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const T = '2026-10-09';
const J = '2026-10-09T09:00:00.000Z';
const vor = (n: number, ab = T) => { const d = new Date(`${ab}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: vor(90), geaendertAm: vor(90), ...x });
const crmLeer = (x: Partial<CrmBestand> = {}): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], ...x } as unknown as CrmBestand);
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const quelle = (datei: string) => readFileSync(path.join(process.cwd(), datei), 'utf8');
const KRIT = { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
const lead = (x: Partial<Lead>): Lead => ({ status: 'neu', kriterien: { ...KRIT }, ...x } as Lead);

afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── 1.8 · EIN Weg „Person anlegen“ — die Regeln (rein) ─────────────────────────────────────────────────────────────────────────
describe('1.8 · Anlege-Regeln je Weg (rein)', () => {
  it('jeder Weg hat EINE Regel mit Herkunft, Lebensphase, Lead, Firma, Follow-up — und wo er bewusst anders ist, steht es dabei', async () => {
    const { ANLEGE_REGELN, PERSON_WEGE } = await import('@/lib/crm/person-anlegen');
    for (const w of ['kartei', 'firmenkarte', 'schnell', 'prospecting', 'makeone', 'anfrage', 'netzwerken', 'import'] as const) {
      expect(ANLEGE_REGELN[w].label, w).toBeTruthy();
      expect(ANLEGE_REGELN[w].anders, w).toBeTruthy();
    }
    expect([...PERSON_WEGE]).toEqual(['kartei', 'firmenkarte', 'schnell', 'prospecting', 'makeone']);
    expect(ANLEGE_REGELN.anfrage).toMatchObject({ herkunft: 'selbst', rechtsgrundlage: 'vertrag', lebensphase: 'interessent', lead: 'kontaktiert', followUp: 'immer' });
    expect(ANLEGE_REGELN.netzwerken).toMatchObject({ herkunft: 'veranstaltung', rechtsgrundlage: 'berechtigt', lead: 'kontaktiert' });
    expect(ANLEGE_REGELN.prospecting).toMatchObject({ herkunft: 'recherche', rechtsgrundlage: 'berechtigt' });
    // Keine Quelle täuscht eine Anfrage/Kampagne vor (MQL nur aus dem Marketing).
    const { kanalVon } = await import('@/lib/crm/kanal');
    for (const w of ['kartei', 'firmenkarte', 'schnell', 'prospecting', 'makeone'] as const) expect(['inbound', 'kampagne', 'content'], w).not.toContain(kanalVon({ quelle: ANLEGE_REGELN[w].quelle }));
  });

  it('personEntwurf: Kartei wählt Herkunft/Lebensphase, Prospecting = Recherche (Art. 14), Make.One = Veranstaltung; nie eine Einwilligung', async () => {
    const { personEntwurf } = await import('@/lib/crm/person-anlegen');
    const o = { id: 'c-x', heute: T, jetzt: J, person: 'malin' };
    const kartei = personEntwurf({ vorname: 'Erika', nachname: 'Muster', lebensphase: 'partner', herkunft: 'bekannt' }, 'kartei', o);
    expect(kartei).toMatchObject({ lebensphase: 'partner', herkunft: 'bekannt', quelle: 'Von Hand angelegt', stufe: 'neu', importiertAm: T });
    expect(kartei.aktivitaeten[0]).toMatchObject({ art: 'system', text: 'Von Hand angelegt', von: 'malin' });
    expect(kartei.einwilligungen).toBeUndefined();
    const karte = personEntwurf({ nachname: 'Muster', vonKarte: true }, 'kartei', o);
    expect(karte).toMatchObject({ herkunft: 'veranstaltung', quelle: 'Visitenkarte' });
    const pro = personEntwurf({ nachname: 'Muster', lebensphase: 'kunde' }, 'prospecting', o);
    expect(pro).toMatchObject({ herkunft: 'recherche', fremddaten: true, rechtsgrundlage: 'berechtigt', lebensphase: 'kontakt' });
    const abend = personEntwurf({ nachname: 'Muster', anlass: 'Am Einlass angelegt — Abend' }, 'makeone', { ...o, firma: { id: 'f-a', name: 'Firma A' } });
    expect(abend).toMatchObject({ herkunft: 'veranstaltung', besitzer: 'malin', firmaId: 'f-a', firma: 'Firma A' });
    expect(abend.aktivitaeten[0].text).toBe('Am Einlass angelegt — Abend');
  });

  it('1.10 · zustaendigFuer: gewählt gewinnt; Kartei ohne Wahl → Verantwortliche der Welt (nicht, wer anlegt); Make.One/Anfrage → wer anlegt', async () => {
    const { zustaendigFuer } = await import('@/lib/crm/person-anlegen');
    const { verantwortlich, BEIDE } = await import('@/lib/crm/team');
    expect(zustaendigFuer('kartei', 'malin', 'kevin')).toBe('malin');
    expect(zustaendigFuer('kartei', BEIDE, 'kevin')).toBe(BEIDE);
    expect(zustaendigFuer('kartei', undefined, 'malin')).toBe(verantwortlich('sales'));
    expect(zustaendigFuer('makeone', undefined, 'malin')).toBe('malin');
    expect(zustaendigFuer('anfrage', undefined, 'kevin')).toBe('kevin');
    expect(zustaendigFuer('anfrage', undefined, 'unbekannt')).toBe(verantwortlich('marketing'));
  });

  it('eingabeSaeubern: zu lang → 413 (nie gekürzt), ohne Namen → 400, Schritt nur mit Text UND Datum', async () => {
    const { eingabeSaeubern } = await import('@/lib/crm/person-anlegen');
    expect(eingabeSaeubern({ nachname: 'x'.repeat(81) })).toMatchObject({ ok: false, status: 413 });
    expect(eingabeSaeubern({ email: 'a@b.de' })).toMatchObject({ ok: false, status: 400 });
    expect(eingabeSaeubern({ nachname: 'M', naechsterSchritt: { text: 'Anrufen', datum: '' } })).toMatchObject({ ok: false, status: 400 });
    expect(eingabeSaeubern({ nachname: 'M', naechsterSchritt: { text: '', datum: T } })).toMatchObject({ ok: false, status: 400 });
    expect(eingabeSaeubern({ nachname: 'M', email: 'kaputt' })).toMatchObject({ ok: false, status: 400 });
    const r = eingabeSaeubern({ vorname: ' Erika ', nachname: 'Muster', email: 'Erika@Example.invalid', zustaendig: 'malin', naechsterSchritt: { text: 'Anrufen', datum: T } });
    expect(r).toMatchObject({ ok: true, e: { vorname: 'Erika', email: 'erika@example.invalid', zustaendig: 'malin', naechsterSchritt: { text: 'Anrufen', datum: T } } });
    expect(eingabeSaeubern({ nachname: 'M', zustaendig: 'fremd' })).toMatchObject({ ok: true, e: { zustaendig: undefined } });
  });

  it('dublettePruefen = die Regel von Netzwerken: gleiche Mail → dieselbe Person, Name + Firma → nur Hinweis', async () => {
    const { dublettePruefen } = await import('@/lib/crm/person-anlegen');
    const da = [k('erika', { vorname: 'Erika', nachname: 'Muster', email: 'erika@example.invalid', firma: 'Firma A' })];
    expect(dublettePruefen({ nachname: 'Anders', email: 'ERIKA@example.invalid' }, da, 'c-neu').gleich?.kontakt.id).toBe('c-erika');
    const v = dublettePruefen({ vorname: 'Erika', nachname: 'Muster', firma: 'Firma A' }, da, 'c-neu');
    expect(v.gleich).toBeUndefined();
    expect(v.vermutlich?.kontakt.id).toBe('c-erika');
  });

  it('leadZiel: EINE Regel für Netzwerken und Anfrage — Neu → Ziel; Kein Fit/Ruht/SQL und Firmen ohne Vertrieb → prüfen; aktive bleiben', async () => {
    const { leadZiel } = await import('@/lib/crm/person-anlegen');
    const o = { jetzt: J, person: 'kevin' };
    expect(leadZiel(undefined, 'kontaktiert', o)).toMatchObject({ art: 'setzen', lead: { status: 'kontaktiert', geaendertVon: 'kevin' } });
    expect(leadZiel(lead({ status: 'neu' }), 'kontaktiert', o)).toMatchObject({ art: 'setzen' });
    expect(leadZiel(lead({ status: 'kein_fit' }), 'kontaktiert', o)).toEqual({ art: 'pruefen', grund: 'Kein Fit' });
    expect(leadZiel(lead({ status: 'sql' }), 'qualifizierung', o)).toEqual({ art: 'pruefen', grund: 'SQL' });
    expect(leadZiel(undefined, 'kontaktiert', { ...o, firmaRolle: 'dienstleister' })).toEqual({ art: 'pruefen', grund: 'Dienstleister' });
    expect(leadZiel(lead({ status: 'im_gespraech' }), 'kontaktiert', o)).toEqual({ art: 'bleibt' });
    expect(leadZiel(lead({ status: 'im_gespraech' }), 'qualifizierung', o)).toMatchObject({ art: 'setzen', lead: { status: 'qualifizierung' } });
    expect(leadZiel(lead({ status: 'kunde' }), 'kontaktiert', o)).toEqual({ art: 'bleibt' });
    // Die Anfrage nimmt dieselbe Regel: SQL bleibt, eine Firma ohne Vertrieb bekommt keinen Lead.
    const { leadNachAnfrage } = await import('@/lib/crm/anfragen');
    expect(leadNachAnfrage(lead({ status: 'sql' }), 'n', J, 'kevin')).toBeUndefined();
    expect(leadNachAnfrage(undefined, 'n', J, 'kevin', 'investor')).toBeUndefined();
    expect(leadNachAnfrage(undefined, 'n', J, 'kevin')?.status).toBe('kontaktiert');
  });

  it('die bisherigen Wege entscheiden über diese Stelle (Anfrage, Netzwerken, Kartei, Firmenkarte, „+ Aktivität“, Make.One, Prospecting)', () => {
    expect(quelle('lib/crm/anfragen.ts')).toMatch(/personEntwurf\(/);
    expect(quelle('app/api/crm/anfrage/route.ts')).toMatch(/firmaSichern\(/);
    const nw = quelle('lib/crm/netzwerken-server.ts');
    expect(nw).toMatch(/firmaPlanen\(/);
    expect(nw).toMatch(/leadZiel\(/);
    expect(nw).not.toMatch(/firmenId\(firmaName\)/); // keine eigene Firmen-Anlage mehr
    expect(quelle('components/os/crm/Kartei.tsx')).toMatch(/api\.personAnlegen\('kartei'/);
    expect(quelle('components/os/crm/Firmen.tsx')).toMatch(/weg="firmenkarte"/);
    expect(quelle('components/os/crm/SchnellErfassen.tsx')).toMatch(/weg="schnell"/);
    expect(quelle('components/os/crm/events/Abend.tsx')).toMatch(/api\.personAnlegen\('makeone'/);
    expect(quelle('components/os/ProspectingView.tsx')).toMatch(/weg: 'prospecting'/);
    // Kein Weg baut mehr einen eigenen Kontakt im Browser (Kennung, Herkunft, Firma) an der Server-Regel vorbei.
    for (const d of ['components/os/crm/Kartei.tsx', 'components/os/crm/events/Abend.tsx']) expect(quelle(d), d).not.toMatch(/neueKontaktKennung\(|kontaktAusKarte\(/);
  });
});

// ── 1.6 · Firma im Papierkorb ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('1.6 · Firma mit gleichem Namen im Papierkorb wird zurückgeholt (mit Vermerk) — nie bleibt die Marke an einer Firma mit Personen', () => {
  it('firmaPlanen: vorhanden → verknüpfen; im Papierkorb → zurück ohne Marke, mit Vermerk; sonst neu mit Domain', async () => {
    const { firmaPlanen, ZURUECK_VERMERK } = await import('@/lib/crm/person-anlegen');
    const { firmenId } = await import('@/lib/crm/firmen');
    const da = firma('f-da', { name: 'Vorhanden GmbH' });
    const korb = firma(firmenId('Papierkorb AG'), { name: 'Papierkorb AG', geloeschtAm: J, notiz: 'alt' });
    expect(firmaPlanen([da], [da, korb], 'Vorhanden', {}, T, J)).toMatchObject({ art: 'vorhanden', firma: { id: 'f-da' } });
    const z = firmaPlanen([da], [da, korb], 'Papierkorb AG', {}, T, J);
    expect(z?.art).toBe('zurueck');
    expect(z?.firma.geloeschtAm).toBeUndefined();
    expect(z?.firma.notiz).toBe(`alt\n${T}: ${ZURUECK_VERMERK}.`);
    expect(firmaPlanen([], [], 'Neu GmbH', { email: 'a@neu-gmbh.example' }, T, J)).toMatchObject({ art: 'neu', firma: { name: 'Neu GmbH', domain: 'neu-gmbh.example', rolle: 'offen' } });
    expect(firmaPlanen([], [], '  ', {}, T, J)).toBeNull();
  });

  it('generischer Firmen-Upsert (wendeCrmAn): dieselbe Kennung im Papierkorb → zurückgeholt, Hinweis; die Person kann sie danach sehen', async () => {
    const { wendeCrmAn } = await import('@/lib/crm/speicher');
    const { crmSicht } = await import('@/lib/crm/ablage');
    const korb = firma('f-korb-ag', { name: 'Korb AG', geloeschtAm: J });
    const r = wendeCrmAn(crmLeer({ firmen: [korb] }), [{ liste: 'firmen', op: 'upsert', eintrag: { id: 'f-korb-ag', name: 'Korb AG', rolle: 'offen', geaendert: J } }], J, 'kevin');
    const f = r.bestand.firmen.find(x => x.id === 'f-korb-ag')!;
    expect(f.geloeschtAm).toBeUndefined();
    expect(f.notiz).toMatch(/Aus dem Papierkorb zurückgeholt/);
    expect(r.hinweise?.join(' ')).toMatch(/lag im Papierkorb/);
    expect(crmSicht(r.bestand).firmen.map(x => x.id)).toContain('f-korb-ag');
  });
});

// ── 1.9 · Inbox ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('1.9 · Inbox „Kontakt anlegen“ nur im Business-Bereich, Firma aus der Mail-Domain (nie Sammeldomains)', () => {
  it('kontaktAnlegenErlaubt: Business ja, Privat nein, ohne Bereich wie überall Business', async () => {
    const { kontaktAnlegenErlaubt } = await import('@/lib/inbox/aus-gespraech');
    const { PRIVAT_GESELLSCHAFTEN, BUSINESS_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    expect(kontaktAnlegenErlaubt('privat')).toBe(false);
    for (const g of PRIVAT_GESELLSCHAFTEN) expect(kontaktAnlegenErlaubt(g), g).toBe(false);
    for (const g of BUSINESS_GESELLSCHAFTEN) expect(kontaktAnlegenErlaubt(g), g).toBe(true);
    expect(kontaktAnlegenErlaubt(null)).toBe(true);
  });

  it('firmaAusDomain: Firma mit der Domain, sonst ein Name aus der Domain; gmail, web.de, gmx, icloud, outlook, t-online nie', async () => {
    const { firmaAusDomain } = await import('@/lib/crm/firmen');
    for (const d of ['gmail.com', 'web.de', 'gmx.de', 'icloud.com', 'outlook.com', 't-online.de']) expect(firmaAusDomain(`x@${d}`, []), d).toEqual({});
    expect(firmaAusDomain('x@beispiel-werke.de', [])).toEqual({ name: 'Beispiel Werke' });
    const f = firma('f-bw', { name: 'Beispielwerke AG', domain: 'beispiel-werke.de' });
    expect(firmaAusDomain('x@beispiel-werke.de', [f])).toMatchObject({ firma: { id: 'f-bw' }, name: 'Beispielwerke AG' });
  });

  it('kontaktAusGespraech trägt die Firma aus der Domain; der Vorschlag „Kontakt anlegen“ fehlt im Privat-Postfach; Route prüft das Gespräch', async () => {
    const { kontaktAusGespraech } = await import('@/lib/inbox/aus-gespraech');
    const g = (email: string, bereich: string | null) => ({ id: 'gm~abc', betreff: 'Anfrage', gegenueber: { name: 'Erika Muster', email }, bereich });
    expect(kontaktAusGespraech(g('erika@beispiel-werke.de', 'ug'), 'Hallo', T).neu).toMatchObject({ firma: 'Beispiel Werke', email: 'erika@beispiel-werke.de' });
    expect(kontaktAusGespraech(g('erika@gmail.com', 'ug'), 'Hallo', T).neu?.firma).toBeUndefined();
    const { vorschlaegeFuer } = await import('@/lib/inbox/gespraech-server');
    const gs = (bereich: string | null) => ({ id: 'gm~abc', quelle: 'gmail', postfachId: 'gmail', bereich, betreff: 'Frage', gegenueber: { email: 'x@beispiel.example' }, anzahl: 1, am: J, ausschnitt: '', vonUns: false, ungelesen: true, offen: true, anhaenge: 0, fach: 'antworten', absender: 'x@beispiel.example', juengste: 'n1' }) as never;
    expect(vorschlaegeFuer(gs('ug'), [], T).map(v => v.art)).toContain('kontakt');
    expect(vorschlaegeFuer(gs('privat'), [], T).map(v => v.art)).not.toContain('kontakt');
    const route = quelle('app/api/crm/anfrage/route.ts');
    expect(route).toMatch(/kontaktAnlegenErlaubt\(g\.gespraech\.bereich\)/);
    expect(quelle('components/os/inbox/Gespraech.tsx')).toMatch(/gespraechId: g\.id/);
    expect(quelle('components/os/inbox/Gespraech.tsx')).toMatch(/kontaktAnlegenErlaubt\(g\.bereich\)/);
  });
});

// ── 1.10 · 1.11 · 1.12 (rein) ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('1.10/1.11/1.12 · Runde „Meine“ nennt Leads anderer; aktives Mandat = Kunde; neue Leads ohne Schritt', () => {
  it('1.10 · leadsAnderer zählt Leads, die anderen gehören (nicht „ohne“, nicht „beide“) — für „alle“/„ohne“ 0', async () => {
    const { leads, leadsAnderer } = await import('@/lib/crm/leads');
    const frisch = (id: string, besitzer?: string) => k(id, { besitzer, importiertAm: T, aktivitaeten: [{ am: J, art: 'system', text: 'Von Hand angelegt', von: 'system' }] });
    const z = leads([frisch('a', 'kevin'), frisch('b', 'malin'), frisch('c', 'malin'), frisch('d'), frisch('e', 'beide')], crmLeer(), T);
    expect(leadsAnderer(z, { wer: 'kevin', heute: T })).toBe(2);
    expect(leadsAnderer(z, { wer: 'alle', heute: T })).toBe(0);
    expect(leadsAnderer(z, { wer: 'ohne', heute: T })).toBe(0);
    expect(quelle('components/os/crm/Qualifizierung.tsx')).toMatch(/leadsAnderer\(/);
  });

  it('1.11 · aktives Mandat (Firma oder Person) bzw. Firmenrolle „Kunde“ → Status „Kunde“; ein bewusst gesetzter Status bleibt', async () => {
    const { leads } = await import('@/lib/crm/leads');
    const mandat = (x: Record<string, unknown>) => ({ id: 'm-1', kunde: 'Firma f-m', kontaktIds: [], titel: 'M', art: 'retainer', status: 'aktiv', honorar: { betrag: 0, basis: 'monat', netto: true }, ziele: [], leistungen: [], offen: [], health: {}, geaendert: J, ...x }) as never;
    const st = (kontakte: Kontakt[], c: CrmBestand, id: string) => leads(kontakte, c, T).find(z => z.id === id)?.status;
    expect(st([k('m', { firmaId: 'f-m' })], crmLeer({ firmen: [firma('f-m')], mandate: [mandat({ firmaId: 'f-m' })] }), 'f-m')).toBe('kunde');
    expect(st([k('p')], crmLeer({ mandate: [mandat({ kontaktIds: ['c-p'] })] }), 'c-p')).toBe('kunde');
    expect(st([k('r', { firmaId: 'f-r' })], crmLeer({ firmen: [firma('f-r', { rolle: 'kunde' })] }), 'f-r')).toBe('kunde');
    // Gesetztes „Neu“ (nie bearbeitet) wird Kunde; eine bewusst gesetzte Qualifizierung (Folgeauftrag) bleibt.
    expect(st([k('n', { firmaId: 'f-n' })], crmLeer({ firmen: [firma('f-n', { lead: lead({ status: 'neu' }) })], mandate: [mandat({ firmaId: 'f-n' })] }), 'f-n')).toBe('kunde');
    expect(st([k('q', { firmaId: 'f-q' })], crmLeer({ firmen: [firma('f-q', { lead: lead({ status: 'qualifizierung' }) })], mandate: [mandat({ firmaId: 'f-q' })] }), 'f-q')).toBe('qualifizierung');
    // Beendetes Mandat zählt nicht.
    expect(st([k('b', { firmaId: 'f-b' })], crmLeer({ firmen: [firma('f-b')], mandate: [mandat({ firmaId: 'f-b', status: 'beendet' })] }), 'f-b')).toBe('neu');
  });

  it('1.12 · neueOhneSchritt: frisch von Hand angelegt, ohne Schritt/Follow-up/Deal — Importe, Gesperrte, Archivierte nie', async () => {
    const { neueOhneSchritt } = await import('@/lib/crm/person-anlegen');
    const angelegt = (id: string, x: Partial<Kontakt> = {}) => k(id, { importiertAm: vor(2), aktivitaeten: [{ am: J, art: 'system', text: 'Von Hand angelegt', von: 'system' }], ...x });
    const kontakte = [
      angelegt('offen'), angelegt('schritt', { naechsterSchritt: { text: 'x', datum: T } }), angelegt('fu'), angelegt('deal'),
      angelegt('alt', { importiertAm: vor(30) }), k('import', { importiertAm: vor(1) }), angelegt('sperre', { werbesperre: { seit: T, grund: 'Widerspruch' } }), angelegt('archiv', { archiviertAm: J }),
    ];
    const c = crmLeer({ followups: [{ id: 'fu-1', kontaktId: 'c-fu', status: 'offen' }] as never, chancen: [{ id: 'ch-1', stufe: 'qualifiziert', kontaktIds: ['c-deal'] }] as never });
    expect(neueOhneSchritt(kontakte, c, T).map(x => x.id)).toEqual(['c-offen']);
    expect(quelle('components/os/crm/Ueberblick.tsx')).toMatch(/neueOhneSchritt\(/);
  });
});

// ── 1.14 · Prospecting (rein + Quellen) ────────────────────────────────────────────────────────────────────────────────────────
describe('1.14 · Prospecting an die Kartei: ICP aus der Positionierung, Einzeländerungen mit Stand, keine feste Produktkennung', () => {
  it('wirksamesIcp: Marketing (Positionierung + ICP) vor dem eigenen Profil; leer bleibt leer', async () => {
    const { wirksamesIcp } = await import('@/lib/make-one/prospecting-data');
    expect(wirksamesIcp({ positionierung: 'Wir helfen X', icp: 'Mittelstand' }, 'eigenes')).toEqual({ text: 'Positionierung: Wir helfen X\nIdeales Kundenprofil: Mittelstand', quelle: 'marketing' });
    expect(wirksamesIcp({ positionierung: '', icp: '' }, ' eigenes ')).toEqual({ text: 'eigenes', quelle: 'eigen' });
    expect(wirksamesIcp(null, '')).toEqual({ text: '', quelle: 'leer' });
  });

  it('prospectSaeubern: Kennung p-…, Firma Pflicht, Score 0–100, Kartei-Verweis nur mit Kennungen; der Stand fällt weg', async () => {
    const { prospectSaeubern } = await import('@/lib/make-one/prospecting-data');
    expect(prospectSaeubern({ id: 'x-1', company: 'A' })).toBeNull();
    expect(prospectSaeubern({ id: 'p-a-1', company: '' })).toBeNull();
    const p = prospectSaeubern({ id: 'p-a-1', company: ' Beispiel AG ', score: 140, status: 'quatsch', stand: 'abc', kartei: { firmaId: 'f-beispiel-1', kontaktId: 'c-eins', am: J } });
    expect(p).toMatchObject({ id: 'p-a-1', company: 'Beispiel AG', score: 100, status: 'neu', kartei: { firmaId: 'f-beispiel-1', kontaktId: 'c-eins' } });
    expect((p as unknown as Record<string, unknown>).stand).toBeUndefined();
  });

  it('kein Produkt im Code; die Seite schreibt per PATCH (nicht mehr PUT), zeigt Fehler und ist aus Markttraktion › Firmen verlinkt', () => {
    for (const d of ['lib/make-one/prospecting-data.ts', 'components/os/ProspectingView.tsx']) expect(quelle(d), d).not.toMatch(/CapOS|CAPOS/);
    const v = quelle('components/os/ProspectingView.tsx');
    expect(v).toMatch(/method: 'PATCH'/);
    expect(v).not.toMatch(/method: 'PUT'/);
    expect(v).not.toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(v).toMatch(/setFehler\(/);
    expect(quelle('components/os/crm/Kartei.tsx')).toMatch(/WEG\.prospecting\(\)/);
  });
});

// ── 2.14 · Win-Rate-Texte ───────────────────────────────────────────────────────────────────────────────────────────────────────
describe('2.14 · Win-Rate-Texte aus WIN_RATE', () => {
  it('Texte nennen Mindestzahl und Schwelle der Regel; keine festen „ab 5“/„≥ 40 %“ mehr', async () => {
    const { WIN_RATE, WIN_RATE_TEXT, winRateStufe } = await import('@/lib/crm/pipeline');
    expect(WIN_RATE_TEXT.ohneQuote).toContain(`ab ${WIN_RATE.mindestens}`);
    expect(WIN_RATE_TEXT.ziel).toBe(`≥ ${WIN_RATE.gruen} %`);
    expect(winRateStufe(WIN_RATE.gruen)).toBe('gruen');
    expect(winRateStufe(WIN_RATE.rot - 1)).toBe('rot');
    expect(winRateStufe(WIN_RATE.rot)).toBe('gelb');
    expect(quelle('components/os/crm/Pipeline.tsx')).not.toMatch(/Quote ab 5/);
    expect(quelle('lib/crm/kennzahlen.ts')).not.toMatch(/'≥ 40 %'/);
    expect(quelle('lib/crm/traktion-index.ts')).not.toMatch(/Noch keine 5 Entscheidungen/);
    expect(quelle('components/os/crm/DealAkte.tsx')).not.toMatch(/wl\.quote >= 40/);
  });
});

// ── Routen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-mt-woche2a', 'x-make-person': p, 'x-forwarded-for': '127.0.0.1' });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
let db: typeof import('@/lib/store/local-db');
let heute: string;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'fremd', 'mitglied', 'anderer')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('da', { vorname: 'Vorhanden', nachname: 'Person', email: 'vorhanden@example.invalid' }),
    k('gesperrt', { vorname: 'Gesperrte', nachname: 'Person', email: 'gesperrt@example.invalid', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } }),
  ] });
  const speicher = await import('@/lib/crm/speicher');
  const { firmenId } = await import('@/lib/crm/firmen');
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [firma('f-karte', { name: 'Kartenfirma GmbH' }), firma(firmenId('Wieder Da AG'), { name: 'Wieder Da AG', geloeschtAm: J })] });
});

describe('Route POST /api/crm/person — der EINE Weg', () => {
  it('1.8/1.10/1.12 · Kartei: Person + neue Firma + Follow-up aus dem nächsten Schritt, Zuständig wie gewählt; Server stempelt', async () => {
    const route = await import('@/app/api/crm/person/route');
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'kartei', person: { vorname: 'Erika', nachname: 'Neu', email: 'erika.neu@neu-firma.example', firma: 'Neu Firma GmbH', zustaendig: 'malin', naechsterSchritt: { text: 'Erstgespräch vereinbaren', datum: heute } } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.firmaNeu).toBe(true);
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const p = kontakte.find(x => x.id === d.kontaktId)!;
    expect(p).toMatchObject({ vorname: 'Erika', nachname: 'Neu', besitzer: 'malin', firmaId: d.firmaId, quelle: 'Von Hand angelegt', importiertAm: heute });
    expect(p.id).toMatch(/^c-[0-9a-f-]{36}$/);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const crm = await ladeCrm();
    expect(crm.firmen.find(f => f.id === d.firmaId)).toMatchObject({ name: 'Neu Firma GmbH', domain: 'neu-firma.example' });
    expect(crm.followups.find(f => f.id === d.followUpId)).toMatchObject({ kontaktId: p.id, text: 'Erstgespräch vereinbaren', faellig: heute, zustaendig: 'malin', status: 'offen' });
    // Der Lead steht in der Liste (frisch angelegt → nie kalt).
    const { leads, nichtKalt } = await import('@/lib/crm/leads');
    const z = leads(kontakte, crm, heute).find(x => x.id === d.firmaId)!;
    expect(z && nichtKalt(z)).toBe(true);
  });

  it('Dublette (gleiche Mail) → 409 mit der vorhandenen Person, nichts angelegt; Art. 18 → 409 ohne Namen', async () => {
    const route = await import('@/app/api/crm/person/route');
    const vorher = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.length;
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'kartei', person: { nachname: 'Anders', email: 'VORHANDEN@example.invalid', firma: 'Soll Nicht GmbH' } }));
    expect(r.status).toBe(409);
    expect((await r.json()).dublette).toMatchObject({ id: 'c-da' });
    const g = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'kartei', person: { nachname: 'Wer', email: 'gesperrt@example.invalid' } }));
    expect(g.status).toBe(409);
    const gd = await g.json();
    expect(gd.eingeschraenkt).toBe(true);
    expect(JSON.stringify(gd)).not.toMatch(/Gesperrte/);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.length).toBe(vorher);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).firmen.some(f => f.name === 'Soll Nicht GmbH')).toBe(false);
  });

  it('1.6 · Firma im Papierkorb: Anlegen unter gleichem Namen holt sie zurück, die Person hängt an der sichtbaren Firma', async () => {
    const route = await import('@/app/api/crm/person/route');
    const r = await route.POST(anfrage('/api/crm/person', sitzung('malin'), 'POST', { aktion: 'anlegen', weg: 'kartei', person: { nachname: 'Rückkehr', firma: 'Wieder Da AG' } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.hinweise.join(' ')).toMatch(/Papierkorb/);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const f = (await ladeCrm()).firmen.find(x => x.id === d.firmaId)!;
    expect(f).toBeTruthy();
    expect(f.geloeschtAm).toBeUndefined();
    expect(f.notiz).toMatch(/Papierkorb zurückgeholt/);
  });

  it('1.13 · Firmenkarte: feste Firma; eine unbekannte Firma → 404; 1.7 · „+ Aktivität“ legt ohne Follow-up an', async () => {
    const route = await import('@/app/api/crm/person/route');
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'firmenkarte', person: { vorname: 'An', nachname: 'Karte', firmaId: 'f-karte' } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    const p = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === d.kontaktId)!;
    expect(p).toMatchObject({ firmaId: 'f-karte', firma: 'Kartenfirma GmbH' });
    expect((await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'firmenkarte', person: { nachname: 'X', firmaId: 'f-gibt-es-nicht' } }))).status).toBe(404);
    const s = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'schnell', person: { nachname: 'Schnell', naechsterSchritt: { text: 'egal', datum: heute } } }));
    const sd = await s.json();
    expect(s.status).toBe(200);
    expect(sd.followUpId).toBeUndefined();
  });

  it('Wiederholung mit derselben Kennung legt nicht doppelt an; Dienstweg 403; fremder Haushalt 403; falscher Weg 400', async () => {
    const route = await import('@/app/api/crm/person/route');
    const id = 'c-11111111-2222-4333-8444-555555555555';
    const body = { aktion: 'anlegen', weg: 'makeone', id, person: { nachname: 'Einlass', vonKarte: true } };
    expect((await route.POST(anfrage('/api/crm/person', sitzung('malin'), 'POST', body))).status).toBe(200);
    expect((await route.POST(anfrage('/api/crm/person', sitzung('malin'), 'POST', body))).status).toBe(200);
    const alle = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.filter(x => x.id === id);
    expect(alle).toHaveLength(1);
    expect(alle[0]).toMatchObject({ herkunft: 'veranstaltung', besitzer: 'malin', quelle: 'Visitenkarte' });
    expect((await route.POST(anfrage('/api/crm/person', dienst('kevin'), 'POST', body))).status).toBe(403);
    expect((await route.POST(anfrage('/api/crm/person', sitzung('fremd'), 'POST', body))).status).toBe(403);
    expect((await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { ...body, weg: 'import' }))).status).toBe(400);
  });

  it('aktion „firma“ (Prospecting ohne Ansprechpartner): Firma über denselben Weg, Zusatzangaben nur an einer neuen', async () => {
    const route = await import('@/app/api/crm/person/route');
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'firma', firma: { name: 'Ziel Industrie GmbH', webseite: 'https://ziel-industrie.example', branche: 'Maschinenbau' } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).firmen.find(f => f.id === d.firmaId)).toMatchObject({ name: 'Ziel Industrie GmbH', branche: 'Maschinenbau', domain: 'ziel-industrie.example' });
    const zwei = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'firma', firma: { name: 'Ziel Industrie', branche: 'Anders' } }));
    expect((await zwei.json())).toMatchObject({ firmaId: d.firmaId, art: 'vorhanden' });
    expect((await ladeCrm()).firmen.find(f => f.id === d.firmaId)?.branche).toBe('Maschinenbau');
    expect((await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'firma', firma: { name: 'x'.repeat(161) } }))).status).toBe(413);
  });
});

describe('Route /api/crm/anfrage — die Firma einer neuen Person über denselben Weg; aus der Inbox nur mit gültigem Gespräch', () => {
  it('neue Person mit Firmennamen → Firma angelegt und verknüpft, Lead an der FIRMA „kontaktiert“', async () => {
    const route = await import('@/app/api/crm/anfrage/route');
    const r = await route.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'website', text: 'Bitte um Rückruf', neu: { vorname: 'Anfra', nachname: 'Gende', email: 'anfra@anfrage-firma.example', firma: 'Anfrage Firma GmbH' } }));
    const d = await r.json();
    expect(r.status).toBe(200);
    const p = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === d.kontaktId)!;
    expect(p.firmaId).toBeTruthy();
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const f = (await ladeCrm()).firmen.find(x => x.id === p.firmaId)!;
    expect(f).toMatchObject({ name: 'Anfrage Firma GmbH' });
    expect(f.lead?.status).toBe('kontaktiert');
    expect(p).toMatchObject({ herkunft: 'selbst', rechtsgrundlage: 'vertrag', lebensphase: 'interessent', besitzer: 'kevin' });
  });

  it('eine gleiche Mail hängt an die vorhandene Person — es entsteht keine Firma aus dem Namen', async () => {
    const route = await import('@/app/api/crm/anfrage/route');
    const r = await route.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'Nochmal', neu: { nachname: 'Person', email: 'vorhanden@example.invalid', firma: 'Doppel Firma GmbH' } }));
    expect(r.status).toBe(200);
    const { ladeCrm } = await import('@/lib/crm/speicher');
    expect((await ladeCrm()).firmen.some(f => f.name === 'Doppel Firma GmbH')).toBe(false);
  });

  it('1.9 · mit gespraechId: ungültig bzw. fremd → 404, nichts angelegt', async () => {
    const route = await import('@/app/api/crm/anfrage/route');
    const vorher = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.length;
    expect((await route.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'x', gespraechId: 'quatsch', neu: { nachname: 'Inbox' } }))).status).toBe(404);
    expect((await route.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'x', gespraechId: 'gm~unbekannt1', neu: { nachname: 'Inbox' } }))).status).toBe(404);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.length).toBe(vorher);
  });
});

describe('1.14 · Route /api/state/prospects — Einzeländerungen mit Stand, ICP aus Marketing, Agent-PUT bleibt', () => {
  it('PATCH legt an, ändert mit Stand, lehnt einen veralteten Stand ab (409, nichts gespeichert); icp > 3000 → 413', async () => {
    const route = await import('@/app/api/state/prospects/route');
    const neu = await route.PATCH(anfrage('/api/state/prospects', sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', eintrag: { id: 'p-beispiel-1', company: 'Beispiel AG', status: 'neu', addedAt: J } }] }));
    const n = await neu.json();
    expect(neu.status).toBe(200);
    const stand = n.zeilen[0].stand as string;
    expect((await route.PATCH(anfrage('/api/state/prospects', sitzung('kevin'), 'PATCH', { ops: [{ op: 'teil', id: 'p-beispiel-1', felder: { status: 'qualifiziert' }, stand }] }))).status).toBe(200);
    const alt = await route.PATCH(anfrage('/api/state/prospects', sitzung('malin'), 'PATCH', { ops: [{ op: 'teil', id: 'p-beispiel-1', felder: { status: 'verworfen' }, stand }] }));
    expect(alt.status).toBe(409);
    const g = await (await route.GET(anfrage('/api/state/prospects', sitzung('kevin')))).json();
    expect(g.state.prospects[0]).toMatchObject({ id: 'p-beispiel-1', status: 'qualifiziert' });
    expect(g.state.prospects[0].stand).toBeTruthy();
    expect((await route.PATCH(anfrage('/api/state/prospects', sitzung('kevin'), 'PATCH', { icp: 'x'.repeat(3001) }))).status).toBe(413);
    expect((await route.PATCH(anfrage('/api/state/prospects', sitzung('fremd'), 'PATCH', { icp: 'x' }))).status).toBe(403);
  });

  it('GET liefert das wirksame ICP: eigenes ohne Einstellung, Marketing mit Einstellung; der Agent-PUT überschreibt das eigene dann nicht', async () => {
    const route = await import('@/app/api/state/prospects/route');
    await route.PATCH(anfrage('/api/state/prospects', sitzung('kevin'), 'PATCH', { icp: 'Eigenes Profil' }));
    let g = await (await route.GET(anfrage('/api/state/prospects', sitzung('kevin')))).json();
    expect(g).toMatchObject({ icpQuelle: 'eigen', state: { icp: 'Eigenes Profil' } });
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(c => ({ ...c, marketing: { positionierung: 'Wir machen Beispiele', icp: 'Firmen mit Beispielen', ton: '', saeulen: [] } }));
    g = await (await route.GET(anfrage('/api/state/prospects', sitzung('kevin')))).json();
    expect(g.icpQuelle).toBe('marketing');
    expect(g.state.icp).toMatch(/Wir machen Beispiele/);
    // Der Agent schreibt zurück, was er gelesen hat (mit Stand je Zeile) — gespeichert werden weder der Stand noch das Marketing-Profil.
    const put = await route.PUT(anfrage('/api/state/prospects', dienst('kevin'), 'PUT', { icp: g.state.icp, prospects: g.state.prospects }));
    expect(put.status).toBe(200);
    const roh = await db.loadJson<{ icp: string; prospects: Record<string, unknown>[] }>('prospects');
    expect(roh?.icp).toBe('Eigenes Profil');
    expect(roh?.prospects[0].stand).toBeUndefined();
  });
});

describe('1.15 · Segment „Vernetzen“ ab dem ersten Laden', () => {
  it('ladeCrm zeigt es ohne Import (Lesen schreibt nicht); die nächste Änderung legt es dauerhaft ab — genau einmal', async () => {
    const { ladeCrm, aendereCrm, SEGMENT_VERNETZEN_START } = await import('@/lib/crm/speicher');
    const { SEGMENT_VERNETZEN_ID } = await import('@/lib/crm/import-konflikte');
    await db.updateJson<CrmBestand>('crm', cur => ({ ...(cur as CrmBestand), segmente: [] }));
    const vorher = await db.loadJson<CrmBestand>('crm');
    expect(vorher?.segmente).toEqual([]);
    const seg = (await ladeCrm()).segmente.filter(s => s.id === SEGMENT_VERNETZEN_ID);
    expect(seg).toHaveLength(1);
    expect(seg[0]).toMatchObject({ name: 'Vernetzen · kalte Leads', kriterien: { temperatur: ['kalt'] }, geaendert: SEGMENT_VERNETZEN_START });
    expect((await db.loadJson<CrmBestand>('crm'))?.segmente).toEqual([]); // nur gelesen
    await aendereCrm(c => ({ ...c, firmen: [...c.firmen, firma('f-segment-anlass')] }));
    expect((await db.loadJson<CrmBestand>('crm'))?.segmente.filter(s => s.id === SEGMENT_VERNETZEN_ID)).toHaveLength(1);
    await aendereCrm(c => c);
    expect((await ladeCrm()).segmente.filter(s => s.id === SEGMENT_VERNETZEN_ID)).toHaveLength(1);
  });
});

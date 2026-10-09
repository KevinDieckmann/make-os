// ─── Markttraktion Woche 2 · Teil B (08.10.) — Befunde aus MARKTTRAKTION_BEFUND.md, Teil 2, je mit Wächter ────────────────────
// Angebot/Rechnung (3.10, 3.11, 3.13–3.16), Follow-up (4.10–4.18), Marketing & Events (5.4–5.10, 5.12, 5.15, 5.16), zu zweit &
// Kennzahlen (6.2, 6.6, 6.8, 7.3, 7.6) und der SQL-Satz im Prompt der Heads. Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mt-woche2b-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-mt-woche2b';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const T = '2026-10-08';
const J = '2026-10-08T09:00:00.000Z';
const vor = (n: number, ab = T) => { const d = new Date(`${ab}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: vor(90), geaendertAm: vor(90), besitzer: 'kevin', ...x });
const crmLeer = (x: Partial<CrmBestand> = {}): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [], ...x } as unknown as CrmBestand);
const quelle = (datei: string) => readFileSync(path.join(process.cwd(), datei), 'utf8');
const mandat = (x: Partial<Mandat> = {}): Mandat => ({ id: 'm-b1', kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 2000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: J, ...x } as unknown as Mandat);

type H = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [k('anna', { firmaId: 'f-muster', firma: 'Muster GmbH', email: 'anna@example.invalid', stufe: 'gespraech' })] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J }], mandate: [mandat(), mandat({ id: 'm-offen', gesellschaft: 'offen' })] } as unknown as CrmBestand);
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

// ══ Teil B · Angebot und Rechnung ═══════════════════════════════════════════════════════════════════════════════════════════

describe('3.10 · Angenommenes Tool-Angebot führt im Umsatz-Reiter weiter zum Mandat', () => {
  it('angebotMandatWeg: Mandat am Angebot bzw. aus dem Deal → „Mandat ›“; gewonnener Deal ohne Mandat → „Mandat anlegen ›“', async () => {
    const { angebotMandatWeg } = await import('@/lib/crm/angebote');
    const crm = { chancen: [{ id: 'ch-1', stufe: 'gewonnen' as const }, { id: 'ch-2', stufe: 'angebot' as const }], mandate: [{ id: 'm-1', chanceId: 'ch-9' }, { id: 'm-weg', chanceId: 'ch-3', geloeschtAm: J }] };
    expect(angebotMandatWeg({ status: 'angenommen', dealId: 'ch-9' }, crm)).toEqual({ art: 'mandat', mandatId: 'm-1' });
    expect(angebotMandatWeg({ status: 'angenommen', mandatId: 'm-1' }, crm)).toEqual({ art: 'mandat', mandatId: 'm-1' });
    expect(angebotMandatWeg({ status: 'angenommen', dealId: 'ch-1' }, crm)).toEqual({ art: 'anlegen', dealId: 'ch-1' });
    expect(angebotMandatWeg({ status: 'angenommen', dealId: 'ch-3' }, crm)).toBeNull(); // Mandat im Papierkorb, Deal unbekannt
    expect(angebotMandatWeg({ status: 'gestellt', dealId: 'ch-1' }, crm)).toBeNull();
    expect(angebotMandatWeg({ status: 'angenommen' }, crm)).toBeNull();
  });
  it('der Umsatz-Reiter zeigt beide Wege und legt das Mandat über DENSELBEN Aufruf an wie die Angebots-Ansicht', () => {
    const s = quelle('components/os/crm/kontakt/UmsatzReiter.tsx');
    expect(s).toContain('angebotMandatWeg(');
    expect(s).toContain('Mandat anlegen ›');
    expect(s).toContain('Mandat ›');
    expect(s).toContain('mandatAusDeal(');
    expect(quelle('components/os/crm/angebot/Ansicht.tsx')).toContain('mandatAusDeal(');
  });
});

describe('3.11 · Statuswechsel einer Rechnung mit Rückfrage, Fehler sichtbar', () => {
  it('statusWechselFehlt: gestellt braucht eine freie Nummer und ein Datum; bezahlt ein Datum nicht in der Zukunft', async () => {
    const { statusWechselFehlt } = await import('@/lib/finanzen/rechnung/regeln');
    const r = { id: 'r-1', firmaId: 'kdv', status: 'geplant' };
    const alle = [{ id: 'r-2', firmaId: 'kdv', nummer: 'R-7' }, { id: 'r-3', firmaId: 'ug', nummer: 'R-8' }];
    expect(statusWechselFehlt(r, 'gestellt', { nummer: '', datum: T }, alle, T)).toEqual(['Rechnungsnummer fehlt.']);
    expect(statusWechselFehlt(r, 'gestellt', { nummer: 'r-7', datum: T }, alle, T)[0]).toMatch(/schon vergeben/);
    expect(statusWechselFehlt(r, 'gestellt', { nummer: 'R-8', datum: T }, alle, T)).toEqual([]); // andere Gesellschaft, anderer Kreis
    expect(statusWechselFehlt(r, 'gestellt', { nummer: 'R-9', datum: '2026-10-09' }, alle, T)[0]).toMatch(/Zukunft/);
    expect(statusWechselFehlt({ ...r, positionen: [{}] }, 'gestellt', { nummer: 'R-9', datum: T }, alle, T)[0]).toMatch(/Editor/);
    const g = { id: 'r-1', firmaId: 'kdv', status: 'gestellt', datum: '2026-10-01' };
    expect(statusWechselFehlt(g, 'bezahlt', { am: T }, alle, T)).toEqual([]);
    expect(statusWechselFehlt(g, 'bezahlt', { am: '2026-09-30' }, alle, T)[0]).toMatch(/vor dem Rechnungsdatum/);
    expect(statusWechselFehlt(g, 'bezahlt', { am: '' }, alle, T)[0]).toMatch(/fehlt/);
  });
  it('Finanzen: der Status-Chip öffnet die Rückfrage; ein gescheitertes „bezahlt“ steht als Hinweis da, nicht in der Konsole', () => {
    const s = quelle('components/os/FinanzplanungView.tsx');
    expect(s).toContain('statusWechselFehlt(');
    expect(s).not.toMatch(/onClick=\{\(\) => rechnungAendern\(r\.id, \{ status: weiter \}\)\}/);
    expect(s).not.toMatch(/console\.error\('\[MAKE OS\] Rechnung nicht als bezahlt/);
    expect(s).toMatch(/setHinweis\(`Nicht als bezahlt gespeichert/);
  });
});

describe('3.13 · EIN Rechnungs-Anleger', () => {
  it('Vorlage aus einem abgelegten Angebot → EINE Position, netto über die eine USt-Rechnung', async () => {
    const { vorlageSaeubern, positionAusBrutto } = await import('@/lib/finanzen/rechnung/regeln');
    const { nettoAusBrutto } = await import('@/lib/finanzen/ust');
    expect(vorlageSaeubern({ titel: '  Sprint  ', bruttoCent: 119000, angebot: 'A-1', angebotAm: '2026-09-30', boese: 1 })).toEqual({ titel: 'Sprint', bruttoCent: 119000, angebot: 'A-1', angebotAm: '2026-09-30' });
    expect(vorlageSaeubern({ bruttoCent: -5, angebotAm: 'gestern' })).toBeUndefined();
    expect(vorlageSaeubern('kaputt')).toBeUndefined();
    expect(positionAusBrutto('Sprint', 119000, { nettoAusBrutto })).toMatchObject({ menge: 1, einheit: 'pauschal', einzelpreisCent: 100000, ustSatz: 19 });
    expect(positionAusBrutto('Sprint', 100000, { kleinunternehmer: true, nettoAusBrutto })).toMatchObject({ einzelpreisCent: 100000, ustSatz: 0 });
  });
  it('Server: frei mit Vorlage legt die Position an; ein Mandat mit Gesellschaft „offen“ → 409 (erst wählen), mit Wahl geht es', async () => {
    const s = await import('@/lib/finanzen/rechnung/server');
    const z = { person: 'kevin', haushalt: 'test-haus', sicht: 'privat' as const };
    const f = await s.entwurfNeu({ ...z, quelle: 'frei', firmaId: 'kdv', kontaktId: 'c-anna', vorlage: { titel: 'Sprint', bruttoCent: 238000, angebot: 'A-7', angebotAm: '2026-09-30' } });
    expect(f.rechnung).toMatchObject({ status: 'geplant', firmaId: 'kdv', titel: 'Sprint', betrag: 2380, netto: 2000, angebot: 'A-7', angebotAm: '2026-09-30', positionen: [{ einzelpreisCent: 200000, ustSatz: 19 }] });
    await expect(s.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-offen', monat: '2026-09' })).rejects.toMatchObject({ status: 409, extra: { grund: 'gesellschaft' } });
    const mitWahl = await s.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-offen', monat: '2026-09', firmaId: 'kdv' });
    expect(mitWahl.rechnung).toMatchObject({ firmaId: 'kdv', status: 'geplant', betrag: 2380 });
    const fest = await s.entwurfNeu({ ...z, quelle: 'mandat', mandatId: 'm-b1', monat: '2026-09' });
    expect(fest.rechnung).toMatchObject({ firmaId: 'kdv', betrag: 2380, netto: 2000 });
  });
  it('umsatzRechnungNeu: aktives Mandat mit Honorar → Monatsrechnung; sonst frei mit Kontakt/Firma/Gesellschaft; Register → Hinweis', async () => {
    const { umsatzRechnungNeu } = await import('@/lib/crm/umsatz');
    const firma = { id: 'f-muster', name: 'Muster GmbH' } as never;
    expect(umsatzRechnungNeu('c-anna', { firma, mandate: [mandat()] }, null)).toEqual({ quelle: 'mandat', mandatId: 'm-b1' });
    expect(umsatzRechnungNeu('c-anna', { firma, mandate: [mandat({ honorar: { betrag: 0, basis: 'monat', netto: true } })] }, 'ug')).toEqual({ quelle: 'frei', kontaktId: 'c-anna', kundeFirmaId: 'f-muster', mandatId: 'm-b1', firmaId: 'kdv' });
    expect(umsatzRechnungNeu('c-anna', { mandate: [] }, 'ug')).toEqual({ quelle: 'frei', kontaktId: 'c-anna', firmaId: 'ug' });
    expect(umsatzRechnungNeu('c-anna', { mandate: [] }, null)).toEqual({ quelle: 'frei', kontaktId: 'c-anna' });
    expect(umsatzRechnungNeu('c-anna', { mandate: [mandat({ gesellschaft: 'g-0f8fad5b-d9cb-469f-a165-70867728950e' as never })] }, 'ug')).toHaveProperty('fehler');
  });
  it('mandatGesellschaftOffen: „offen“ und Unbekanntes ja, feste und Register-Gesellschaften nein', async () => {
    const { mandatGesellschaftOffen } = await import('@/lib/crm/kunden');
    expect(mandatGesellschaftOffen('offen')).toBe(true);
    expect(mandatGesellschaftOffen(undefined)).toBe(true);
    expect(mandatGesellschaftOffen('kdv')).toBe(false);
    expect(mandatGesellschaftOffen('g-0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(false);
  });
  it('kein Anleger schreibt mehr an /api/rechnung vorbei in den Finanzplan; „+ Mandat“ fragt zuerst die Gesellschaft', () => {
    for (const f of ['components/os/crm/kontakt/UmsatzReiter.tsx', 'components/os/crm/Kunden.tsx', 'components/os/FinanzplanungView.tsx']) {
      const s = quelle(f);
      expect(s, f).not.toMatch(/liste: 'rechnungen', op: 'upsert'/);
      expect(s, f).toContain('entwurfAnlegen(');
    }
    expect(quelle('components/os/FinanzplanungView.tsx')).not.toMatch(/rechnungen: \[\.\.\.plan\.rechnungen, \{ id: neueKennung\('r'\)/);
    expect(quelle('components/os/crm/Kunden.tsx')).not.toContain('nur planen (ohne PDF)');
    expect(quelle('components/os/crm/Kunden.tsx')).toContain('Für welche Gesellschaft?');
    expect(quelle('components/os/crm/Kunden.tsx')).not.toMatch(/gesellschaft: ges !== 'alle' \? ges : 'offen'/);
  });
});

describe('3.14 · Angebots-Editor am Handy: Summenleiste über .ui-aktion, Teilen mit Datei', () => {
  it('Summenleiste ist die Aktionsleiste (kein eigenes sticky mehr)', () => {
    const s = quelle('components/os/crm/angebot/Editor.tsx');
    expect(s).toContain('<Aktionsleiste>');
    expect(s).not.toMatch(/position: 'sticky', bottom: 0, zIndex: 5/);
  });
  it('kannDateiTeilen: nur mit share + canShare(Dateien) — sonst Rückfall Download', async () => {
    const { kannDateiTeilen } = await import('@/components/os/crm/angebot/angebot-daten');
    const datei = new File([new Uint8Array([37, 80, 68, 70])], 'Angebot.pdf', { type: 'application/pdf' });
    expect(kannDateiTeilen(undefined, datei)).toBe(false);
    expect(kannDateiTeilen({ share: () => {} }, datei)).toBe(false);
    expect(kannDateiTeilen({ share: () => {}, canShare: () => false }, datei)).toBe(false);
    expect(kannDateiTeilen({ share: () => {}, canShare: d => !!d.files?.length }, datei)).toBe(true);
    expect(kannDateiTeilen({ share: () => {}, canShare: () => { throw new Error('x'); } }, datei)).toBe(false);
    expect(quelle('components/os/crm/angebot/Ansicht.tsx')).toContain('Teilen (mit PDF)');
  });
});

describe('3.15 · Kleinkram: Kürzel aus UG_KURZ, Schnellknopf behält den Kontakt, „gesendet“ erst nach Bestätigung, next/link', () => {
  it('Kürzel-Vorgabe der Gesellschaft ug kommt aus UG_KURZ (nur Großbuchstaben/Ziffern)', async () => {
    const { KURZ_VORGABE, kuerzelAus } = await import('@/lib/crm/angebote');
    const { UG_KURZ } = await import('@/lib/einheiten');
    expect(KURZ_VORGABE.ug).toBe(kuerzelAus(UG_KURZ, 'UG'));
    expect(kuerzelAus('Mähren & Söhne 2', 'X')).toBe('MAEHRENS');
    expect(kuerzelAus('···', 'UG')).toBe('UG');
  });
  it('angebotVonHier: offener Kontakt, Firma oder Deal geht mit; sonst ein leeres Angebot', async () => {
    const { angebotVonHier } = await import('@/lib/crm/adresse');
    expect(angebotVonHier('kontakte', 'akte', 'c-anna')).toBe('/os/markttraktion?s=angebot&kontakt=c-anna');
    expect(angebotVonHier('kontakte', undefined, 'f-muster')).toBe('/os/markttraktion?s=angebot&firma=f-muster');
    expect(angebotVonHier('firmen', undefined, 'f-muster')).toBe('/os/markttraktion?s=angebot&firma=f-muster');
    expect(angebotVonHier('deals', 'akte', 'ch-1')).toBe('/os/markttraktion?s=angebot&deal=ch-1');
    expect(angebotVonHier('deals', 'board', 'ch-1')).toBe('/os/markttraktion?s=angebot');
    expect(angebotVonHier('kontakte', undefined, null)).toBe('/os/markttraktion?s=angebot');
    expect(quelle('components/os/crm/Markttraktion.tsx')).toContain('angebotVonHier(bereich, ansicht, kParam)');
  });
  it('Stellen vermerkt „gestellt“ (Notiz, kein Kontakt) — „gesendet“ erst über die Bestätigung, je Nummer genau einmal', async () => {
    const { angebotKontaktVermerk } = await import('@/lib/crm/angebot-server');
    const { angebotGesendetVermerkt } = await import('@/lib/crm/angebote');
    const lese = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-anna')!;
    const p = { kontaktId: 'c-anna', nummer: 'KDV-A-2026-0042', titel: 'Sprint', heute: T, jetzt: J, person: 'kevin' };
    await angebotKontaktVermerk({ ...p, art: 'gestellt', nachfassen: '2026-10-15' });
    let a = await lese();
    expect(a.aktivitaeten.some(x => x.art === 'notiz' && x.text?.startsWith('Angebot KDV-A-2026-0042 gestellt'))).toBe(true);
    expect(a.letzterKontakt).toBeUndefined();
    expect(a.stufe).toBe('angebot');
    expect(a.wiedervorlage).toBe('2026-10-15');
    expect(angebotGesendetVermerkt(a, p.nummer)).toBe(false);
    expect((await angebotKontaktVermerk({ ...p, art: 'gesendet' })).schonDa).toBe(false);
    expect((await angebotKontaktVermerk({ ...p, art: 'gesendet' })).schonDa).toBe(true);
    a = await lese();
    expect(a.aktivitaeten.filter(x => x.art === 'mail' && x.text?.startsWith('Angebot KDV-A-2026-0042 gesendet')).length).toBe(1);
    expect(a.letzterKontakt).toBe(T);
    expect(a.wiedervorlage).toBe('2026-10-15'); // „gesendet“ verschiebt das Nachfassen nicht
    expect(angebotGesendetVermerkt(a, p.nummer)).toBe(true);
  });
  it('Route: „gesendet“ nie über den Dienstweg; unbekanntes Angebot → 404', async () => {
    const route = (await import('@/app/api/crm/angebot/route')) as unknown as { POST: H };
    const dienst = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' };
    const r1 = await route.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: dienst, body: JSON.stringify({ aktion: 'gesendet', id: 'ang-gibt-es-nicht' }) }));
    expect(r1.status).toBe(403);
    const sitzung = { 'content-type': 'application/json', 'x-make-user': 'kevin' };
    const r2 = await route.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: sitzung, body: JSON.stringify({ aktion: 'gesendet', id: 'ang-gibt-es-nicht' }) }));
    expect(r2.status).toBe(404);
  });
  it('interne Links im Umsatz-Reiter über next/link', () => {
    const s = quelle('components/os/crm/kontakt/UmsatzReiter.tsx');
    expect(s).not.toMatch(/<a href=\{WEG\./);
  });
});

describe('3.16 · 403 bei Rechnungen sauber anzeigen', () => {
  it('Mandat › Rechnungen unterscheidet „kein Zugang“ von „keine Rechnung“; der Anleger nennt den Grund', () => {
    const s = quelle('components/os/crm/Kunden.tsx');
    expect(s).toMatch(/r\.status === 403\) \{ setListe\('kein'\)/);
    expect(s).toContain('KEIN_RECHNUNGS_ZUGANG');
    expect(quelle('components/os/rechnung/daten.ts')).toMatch(/r\.status === 403 \? KEIN_RECHNUNGS_ZUGANG/);
  });
});

// ══ Teil B · Follow-up ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe('4.10 · Heute: „Steht an“ je Sicht serverseitig gefiltert, kein Doppel mit „Wer heute dran ist“', () => {
  const a = {
    heute: T, termine: [], buchungen: [], vorschlaege: { kalender: 0, gesamt: 0 }, nachbereitZeiten: { x: { start: J } },
    followups: [{ id: 'fu-1', text: 'Anrufen', name: 'A', faellig: T, tageUeber: 0, quelle: 'hand', href: '/' }],
    nachbereiten: [{ kontaktId: 'c-1', name: 'A', titel: 'Termin', tag: T, href: '/' }],
    fristen: [{ id: 'f-b', art: 'mandat' as const, tag: T, titel: 'Kündigungsfrist', href: '/', inTagen: 0, business: true as const }, { id: 'f-p', art: 'steuer' as const, tag: T, titel: 'Steuer privat', href: '/', inTagen: 0 }],
    geburtstage: [{ id: 'g-1', name: 'A', tag: T, href: '/', herkunft: 'crm' as const, aufgabeTag: T }, { id: 'g-2', name: 'B', tag: T, href: '/', herkunft: 'familie' as const, aufgabeTag: T }],
    danke: [{ id: 'danke-1', n: 2, eventTitel: 'Abend', href: '/' }],
  };
  it('Privat: keine Follow-ups, Nachbereitungen, Danke-Mails, keine Business-Fristen; Business: nur Business-Fristen', async () => {
    const { anstehendFuerSpace, anstehendSpaceAus } = await import('@/lib/heute/anstehend');
    const p = anstehendFuerSpace(a as never, 'privat');
    expect(p.followups).toEqual([]); expect(p.nachbereiten).toEqual([]); expect(p.danke).toEqual([]); expect(p.nachbereitZeiten).toEqual({});
    expect(p.fristen.map(f => f.id)).toEqual(['f-p']);
    expect(p.geburtstage.map(g => g.id)).toEqual(['g-2']);
    const b = anstehendFuerSpace(a as never, 'business');
    expect(b.followups).toHaveLength(1);
    expect(b.fristen.map(f => f.id)).toEqual(['f-b']);
    expect(b.geburtstage.map(g => g.id)).toEqual(['g-1']);
    expect(anstehendFuerSpace(a as never, null)).toBe(a);
    expect(anstehendSpaceAus('privat')).toBe('privat'); expect(anstehendSpaceAus('alles')).toBeNull(); expect(anstehendSpaceAus(null)).toBeNull();
  });
  it('„Wer heute dran ist“ zeigt Zusagen nicht noch einmal — nur deren Zahl', async () => {
    const { dranOhneZusagen } = await import('@/lib/heute/anstehend');
    const r = dranOhneZusagen([{ kategorie: 'versprechen', id: 1 }, { kategorie: 'signale', id: 2 }, { kategorie: 'versprechen', id: 3 }, { kategorie: 'pflege', id: 4 }]);
    expect(r.zusagen).toBe(2);
    expect(r.karten.map(x => x.id)).toEqual([2, 4]);
  });
  it('Route liest `space`, das Widget gibt die Sicht der Fläche mit', () => {
    expect(quelle('app/api/heute/anstehend/route.ts')).toContain("anstehendSpaceAus(new URL(req.url).searchParams.get('space'))");
    expect(quelle('components/os/flaeche/widgets.tsx')).toContain('<Anstehend i={i} space={spaceAusFlaeche(seite)} />');
    expect(quelle('components/os/heute/Anstehend.tsx')).toMatch(/api\/heute\/anstehend\$\{space === 'privat' \|\| space === 'business'/);
  });
});

describe('4.11 · Follow-up-Karte in „Kontakt öffnen“: Knopf in der Aufgaben-Karte, Bereich aus lib/einheiten.ts', () => {
  it('kein fester Space mehr; „+ Hinzufügen“ hängt an der Aufgaben-Karte, die Rückmeldung bleibt', async () => {
    const { BUSINESS_VORGABE_SPACE, BUSINESS_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    expect(BUSINESS_GESELLSCHAFTEN).toContain(BUSINESS_VORGABE_SPACE);
    for (const f of ['components/os/crm/KontaktSpalten.tsx', 'components/os/aufgaben/AufgabenAkte.tsx', 'components/os/heute/Anstehend.tsx']) expect(quelle(f), f).not.toMatch(/: 'kdv'/);
    const s = quelle('components/os/crm/KontaktSpalten.tsx');
    const followups = s.slice(s.indexOf('<Klappe id="r-followups"'), s.indexOf('<Klappe id="r-termine"'));
    expect(followups).not.toContain("plus('Hinzufügen'");
    const aufgaben = s.slice(s.indexOf('<Klappe id="r-aufgaben"'));
    expect(aufgaben).toContain("plus('Hinzufügen'");
    expect(aufgaben).toContain('setAufgabeHinweis(t)');
  });
});

describe('4.12 · Neues Follow-up: Vorauswahl Beziehung bzw. ich, eine Suche, keine gesperrten Personen', () => {
  it('suchPasst + ausgenommen; die Zuständigkeit folgt der gewählten Person', () => {
    const s = quelle('components/os/crm/FollowUp.tsx');
    const neu = s.slice(s.indexOf('function NeuesFollowUp('), s.indexOf('const WT = '));
    expect(neu).toContain('!ausgenommen(k) && suchPasst(');
    expect(neu).not.toContain('.toLowerCase().includes(');
    expect(neu).toContain('haeltBeziehung(p)');
    expect(neu).toContain('onClick={() => waehle(t.id)}');
  });
});

describe('4.13 · Anlass nach Quelle, „Anruf“ nur mit Ergebnis', () => {
  it('anlassNachQuelle und aktivitaetArtNachErledigen', async () => {
    const { anlassNachQuelle, aktivitaetArtNachErledigen } = await import('@/lib/crm/followup');
    expect(anlassNachQuelle('kadenz', 'Kreis A: seit 40 Tagen')).toBe('Beziehungspflege (Kadenz): Kreis A: seit 40 Tagen');
    expect(anlassNachQuelle('hand', 'Rückruf zugesagt')).toBe('Vereinbartes Follow-up: Rückruf zugesagt');
    expect(anlassNachQuelle('wiedervorlage', '')).toBe('Wiedervorlage aus der laufenden Beziehung');
    expect(anlassNachQuelle('event', 'x')).toMatch(/^Nachfassen nach einer Begegnung/);
    expect(aktivitaetArtNachErledigen('anruf')).toBe('notiz');
    expect(aktivitaetArtNachErledigen('anruf', 'nicht_erreicht')).toBe('anruf');
    expect(aktivitaetArtNachErledigen('anruf', 'gespraech')).toBe('anruf');
    expect(aktivitaetArtNachErledigen('mail')).toBe('mail');
    expect(aktivitaetArtNachErledigen('sonstig', 'gespraech')).toBe('gespraech');
    expect(quelle('app/api/crm/followup/route.ts')).toContain("anlassNachQuelle(herkunft === 'echt' ? anlassQuelle ?? 'hand' : herkunft, text)");
  });
});

describe('4.14 · Kadenz: Texte nach Quelle, Kreis-Runde, Kadenz ab Anlage', () => {
  it('ohne letzten Kontakt zählt die Kadenz ab der Anlage — mit eigenem Text', async () => {
    const { faellige, kadenzStart } = await import('@/lib/crm/followup');
    expect(kadenzStart({ importiertAm: vor(40), aktivitaeten: [] }, T)).toEqual({ tag: vor(40), ohneKontakt: true });
    expect(kadenzStart({ importiertAm: 'kaputt', aktivitaeten: [] }, T)).toBeUndefined();
    const l = faellige([k('neu', { kreis: 'A', importiertAm: vor(40), stufe: 'neu' }), k('frisch', { kreis: 'A', importiertAm: vor(5) })], crmLeer(), T);
    expect(l.find(f => f.id === 'v:kadenz:c-neu')?.text).toMatch(/seit der Anlage vor 40 Tagen noch kein Kontakt/);
    expect(l.some(f => f.kontaktId === 'c-frisch')).toBe(false);
  });
  it('Absagen-Rückfrage nach Quelle: Kadenz überspringt (nichts fällt weg), Zusage fällt weg', async () => {
    const { absagenText } = await import('@/lib/crm/followup');
    expect(absagenText('kadenz')).toMatchObject({ ja: 'Überspringen' });
    expect(absagenText('kadenz').text).toMatch(/nächste Anlauf/);
    expect(absagenText('schritt').text).toMatch(/Zusage fällt weg/);
    expect(absagenText('nachfassen').ja).toBe('Auslassen');
  });
  it('„Alle Kreise im Takt“ nur mit Kreisen, sonst der Weg in die Kreis-Runde', async () => {
    const { WEG } = await import('@/lib/wege');
    expect(WEG.kreisRunde()).toBe('/os/markttraktion?s=kontakte&a=runde-kreis');
    const s = quelle('components/os/crm/FollowUp.tsx');
    expect(s).toContain('mitKreis ? <Leer>Alle Kreise im Takt.</Leer>');
    expect(s).toContain('WEG.kreisRunde()');
    expect(s).toContain('absagenText(f.quelle)');
  });
});

describe('4.15 · Pünktlichkeit nach Berliner Tag, ohne Daten keine Kachel', () => {
  it('erledigt um 00:30 Berliner Zeit am Fälligkeitstag zählt als pünktlich', async () => {
    const { puenktlichkeit } = await import('@/lib/crm/followup');
    // 22:30 UTC am Vortag = 00:30 MESZ am Fälligkeitstag.
    const f = { id: 'fu-p', bezug: { art: 'kontakt' as const, id: 'c-a' }, art: 'anruf' as const, text: 'x', faellig: '2026-10-05', zustaendig: 'kevin', status: 'erledigt' as const, quelle: 'hand' as const, angelegt: J, geaendert: J, erledigtAm: '2026-10-05T22:30:00.000Z' };
    expect(puenktlichkeit([f], T).puenktlich).toBe(0); // 06.10. Berliner Zeit → nach dem Termin
    expect(puenktlichkeit([{ ...f, erledigtAm: '2026-10-04T22:30:00.000Z' }], T).puenktlich).toBe(1); // 05.10. 00:30 Berlin → pünktlich (UTC wäre 04.10.)
    expect(quelle('components/os/crm/FollowUp.tsx')).toContain('(d.puenktlich.erledigt > 0 || d.puenktlich.verpasst > 0) && <Zahl');
  });
});

describe('4.16 · Woche: Kalenderwoche, Zeilen antippbar mit denselben Aktionen, Aufgaben dabei', () => {
  it('kalenderWoche teilt in Vorwochen · Mo–So · nächste KW · später', async () => {
    const { kalenderWoche } = await import('@/lib/crm/followup');
    // 08.10.2026 ist ein Donnerstag → Woche 05.–11.10., nächste 12.–18.10.
    const w = kalenderWoche([{ faellig: '2026-10-04' }, { faellig: '2026-10-05' }, { faellig: '2026-10-11' }, { faellig: '2026-10-12' }, { faellig: '2026-10-19' }], T);
    expect(w.tage[0]).toBe('2026-10-05'); expect(w.tage[6]).toBe('2026-10-11');
    expect(w.vorher.map(f => f.faellig)).toEqual(['2026-10-04']);
    expect(w.jeTag.get('2026-10-05')).toHaveLength(1); expect(w.jeTag.get('2026-10-11')).toHaveLength(1);
    expect(w.naechste.map(f => f.faellig)).toEqual(['2026-10-12']);
    expect(w.spaeter.map(f => f.faellig)).toEqual(['2026-10-19']);
  });
  it('die Woche rendert die Zeile der angetippten Karte (Erledigen …) und die Aufgaben', () => {
    const s = quelle('components/os/crm/FollowUp.tsx');
    const w = s.slice(s.indexOf('function Wochenansicht('), s.indexOf('function Kadenz('));
    expect(w).toContain('kalenderWoche(liste, heute)');
    expect(w).toContain('kalenderWoche(aufgaben, heute)');
    expect(w).toContain('startOffen={gewaehlt === f.id}');
    expect(w).toContain('KW {kw}');
  });
});

describe('4.17 / 4.18 · Verschieben einer Zusage = echtes Follow-up mit Zähler; altes Nachfassen verjährt', () => {
  type M = { POST: H; GET: H };
  let fu: M;
  const kopf = () => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' });
  const req = (body?: unknown, method = 'POST') => new Request('http://test/api/crm/followup', { method, headers: kopf(), ...(body ? { body: JSON.stringify(body) } : {}) });
  beforeAll(async () => {
    const { localDay } = await import('@/lib/zeit');
    const heute = localDay();
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), k('zusage', { naechsterSchritt: { text: 'Unterlagen schicken', datum: heute }, stufe: 'gespraech', geaendertAm: heute }), k('wv', { wiedervorlage: heute, stufe: 'gespraech', geaendertAm: heute })] }));
    fu = (await import('@/app/api/crm/followup/route')) as unknown as M;
  });
  it('„+1 Tag“ auf eine Zusage: echtes Follow-up mit verschoben = 1, das Feld am Kontakt fällt weg; dreimal → Warnung', async () => {
    const r1 = await (await fu.POST(req({ aktion: 'verschieben', id: 'v:schritt:c-zusage', tage: 1 }))).json();
    expect(r1.ok, JSON.stringify(r1)).toBe(true);
    expect(r1.followup).toMatchObject({ kontaktId: 'c-zusage', text: 'Unterlagen schicken', verschoben: 1, status: 'offen' });
    const kontakt = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-zusage')!;
    expect(kontakt.naechsterSchritt).toBeUndefined();
    await fu.POST(req({ aktion: 'verschieben', id: r1.followup.id, tage: 1 }));
    const r3 = await (await fu.POST(req({ aktion: 'verschieben', id: r1.followup.id, tage: 1 }))).json();
    expect(r3.followup.verschoben).toBe(3);
    expect(r3.hinweis).toMatch(/dritten Mal/);
    const liste = (await (await fu.GET(req(undefined, 'GET'))).json()).liste as { id: string; kontaktId?: string }[];
    expect(liste.filter(f => f.kontaktId === 'c-zusage').map(f => f.id)).toEqual([r1.followup.id]); // kein virtueller Eintrag daneben
  });
  it('Wiedervorlage ebenso', async () => {
    const r = await (await fu.POST(req({ aktion: 'verschieben', id: 'v:wiedervorlage:c-wv', tage: 3 }))).json();
    expect(r.followup).toMatchObject({ kontaktId: 'c-wv', verschoben: 1 });
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-wv')!.wiedervorlage).toBeUndefined();
  });
  it('nächster Schritt zur Anzeige: Feld oder früheres echtes Follow-up', async () => {
    const { naechsterSchrittVon } = await import('@/lib/crm/followup');
    const f = (faellig: string) => ({ id: 'fu-x', kontaktId: 'c-a', status: 'offen', text: 'FU', faellig }) as never;
    expect(naechsterSchrittVon({ id: 'c-a' }, [f('2026-10-09')])).toEqual({ text: 'FU', datum: '2026-10-09' });
    expect(naechsterSchrittVon({ id: 'c-a', naechsterSchritt: { text: 'Feld', datum: '2026-10-08' } }, [f('2026-10-09')])).toEqual({ text: 'Feld', datum: '2026-10-08' });
    expect(naechsterSchrittVon({ id: 'c-a' }, [])).toBeUndefined();
  });
  it('4.18: Teilnahme „da“ ohne followUpAm älter als 60 Tage → kein Nachfassen mehr', async () => {
    const { faellige, NACHFASSEN_MAX_TAGE } = await import('@/lib/crm/followup');
    const crm = crmLeer({ events: [{ id: 'ev-alt', titel: 'Alt', datum: vor(NACHFASSEN_MAX_TAGE + 5), status: 'durchgefuehrt' }, { id: 'ev-neu', titel: 'Neu', datum: vor(2), status: 'durchgefuehrt' }] as never, teilnahmen: [{ id: 't-alt', eventId: 'ev-alt', kontaktId: 'c-x', status: 'da' }, { id: 't-neu', eventId: 'ev-neu', kontaktId: 'c-x', status: 'da' }] as never });
    const l = faellige([k('x')], crm, T, { horizont: 400 });
    expect(l.some(f => f.id === 'v:nachfassen:t-alt')).toBe(false);
    expect(l.some(f => f.id === 'v:nachfassen:t-neu')).toBe(true);
  });
});

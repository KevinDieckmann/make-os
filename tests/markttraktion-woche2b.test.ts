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

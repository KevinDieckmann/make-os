// ─── Gesamtprüfung 18.10. (L3 A1 / L2 R7): Head of Finance — Sicht Business bekommt nichts aus Privat ───────────────────────────────
// Kevins harte Regel „Business zeigt nie Privat“, serverseitig: `?space=business` (so fragt die Business-Ansicht) bzw. `umfang: 'business'`
// rechnet OHNE Haushalt — keine Berichte/Vorschläge aus `haushalt-chef--<h>`, keine Hinweise der Bereiche Haushalt/Gesamt, keine
// Einkommensteuer; Lauf, Vorschlag und Einstellung aus der Business-Sicht schreiben nie in den Haushalts-Stand bzw. nie private Felder.
// Vorher fing das niemand: `sicht-business-privat` sucht nur Marken-Texte, Hinweise tragen Zahlen.
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-hof-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-hof-sicht';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type H = (r: Request) => Promise<Response>;
let route: { GET: H; POST: H };
let db: typeof import('@/lib/store/local-db');
const kopf = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const get = (person: string, q = '') => route.GET(new Request(`http://test/api/finanzchef${q}`, { headers: kopf(person) }));
const post = (person: string, body: Record<string, unknown>) => route.POST(new Request('http://test/api/finanzchef', { method: 'POST', headers: kopf(person), body: JSON.stringify(body) }));

// Drei volle Monate vor heute (Berlin), je eine Einnahme und eine größere Ausgabe → Sparquote negativ, Sockel > Einnahmen.
const monatVor = (n: number) => {
  const [j, m] = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1 - n, 15));
  return d.toISOString().slice(0, 10);
};
const buchung = (id: string, datum: string, betrag: number, fix: boolean) => ({
  id, konto_id: 'k1', datum, betrag, beschreibung: 'Prüfbuchung', empfaenger: 'Prüf-Empfänger', kategorie_id: null, ist_umbuchung: false,
  ist_fixkosten: fix, turnus: fix ? 'monatlich' : 'einmalig', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: null,
  geaendert: '2026-10-01T10:00:00.000Z',
});

const HH_BERICHT = 'HAUSHALTSBERICHT-PRUEFMARKE';
const HH_VORSCHLAG = 'HAUSHALTSVORSCHLAG-PRUEFMARKE';
const BIZ_VORSCHLAG = 'BUSINESSVORSCHLAG-PRUEFMARKE';

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  route = (await import('@/app/api/finanzchef/route')) as unknown as { GET: H; POST: H };
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pd', email: 'pd@example.invalid', name: 'Dora Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
  ], einladungen: [] });
  const b = [1, 2, 3].flatMap(n => [buchung(`e${n}`, monatVor(n), 100_000, false), buchung(`a${n}`, monatVor(n), -250_000, true)]);
  await db.saveJson('haushalt-buchungen--h-pruef', { buchungen: b });
  await db.saveJson('haushalt-chef--h-pruef', {
    berichte: [{ id: 'b-hh', modus: 'wochenreview', zeit: '2026-10-10T08:00:00.000Z', umfang: 'business+haushalt', antwort: { status: 'handeln', zusammenfassung: HH_BERICHT } }],
    vorschlaege: [{ id: 'v-hh', titel: HH_VORSCHLAG, bereich: 'haushalt', status: 'offen', begruendung: 'x', prioritaet: 'hoch', verantwortlich: 'pa', dedup_schluessel: 'hh', quelle: [] }],
    letzte: {}, versuche: {},
  });
  await db.saveJson('finanzchef', {
    berichte: [], vorschlaege: [{ id: 'v-biz', titel: BIZ_VORSCHLAG, bereich: 'business', status: 'offen', begruendung: 'x', prioritaet: 'mittel', verantwortlich: 'pa', dedup_schluessel: 'biz', quelle: [] }],
    letzte: {}, versuche: {},
  });
  await db.saveJson('finanzchef-einstellung', {
    steuer: { ust: 'quartal', dauerfrist: false, estVorauszahlung: true, gewstVorauszahlung: false, kstVorauszahlung: false },
    ruecklageQuote: null, rechtsform: { kdv: 'UG (haftungsbeschränkt)', kdc: 'Einzelunternehmen' },
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

type Antwort = {
  umfang: string; berichte: { id: string }[]; vorschlaege: { id: string; titel: string }[];
  einstellung: { steuer: { estVorauszahlung: boolean }; rechtsform: Record<string, unknown> };
  lage: { hinweise: { bereich: string; quelle: string; text: string }[]; termine: { art: string }[]; haushalt: unknown; deckung: unknown };
};

const nichtsAusPrivat = (d: Antwort, txt: string) => {
  expect(d.umfang).toBe('business');
  expect(txt).not.toContain(HH_BERICHT);
  expect(txt).not.toContain(HH_VORSCHLAG);
  expect(d.berichte).toEqual([]);
  expect(d.vorschlaege.map(v => v.id)).toEqual(['v-biz']);
  for (const h of d.lage.hinweise) {
    expect(['haushalt', 'gesamt'], h.text).not.toContain(h.bereich);
    expect(h.quelle.startsWith('haushalt'), h.text).toBe(false);
    expect(h.quelle.startsWith('grundlage.entnahmen'), h.text).toBe(false);
  }
  expect(d.lage.termine.some(t => t.art === 'est')).toBe(false);
  expect(d.lage.haushalt).toBeNull();
  expect(d.lage.deckung).toBeNull();
  expect(d.einstellung.steuer.estVorauszahlung).toBe(false);
  expect(d.einstellung.rechtsform).not.toHaveProperty('kdc');
};

describe('A1: Head of Finance — Sicht Business bekommt nichts aus dem Haushalt', () => {
  it('Kontrolle: in der Haushalts-Sicht kommen Haushalts-Bericht, -Vorschlag und Haushalts-Hinweise (sonst prüfte der Wächter nichts)', async () => {
    const r = await get('pa');
    const txt = await r.text();
    const d = JSON.parse(txt) as Antwort;
    expect(d.umfang).toBe('business+haushalt');
    expect(txt).toContain(HH_BERICHT);
    expect(txt).toContain(HH_VORSCHLAG);
    expect(d.lage.hinweise.some(h => h.bereich === 'haushalt')).toBe(true);
  });
  it('?space=business (Business-Ansicht) und ?umfang=business: nur der Business-Stand, keine Hinweise aus Haushalt/Gesamt, keine ESt', async () => {
    for (const q of ['?space=business', '?umfang=business']) {
      const r = await get('pa', q);
      expect(r.status).toBe(200);
      const txt = await r.text();
      nichtsAusPrivat(JSON.parse(txt) as Antwort, txt);
    }
  });
  it('Konto „nur Business“: dasselbe, auch ohne Space', async () => {
    const r = await get('pd');
    const txt = await r.text();
    nichtsAusPrivat(JSON.parse(txt) as Antwort, txt);
  });
  it('Vorschlag aus der Business-Sicht entscheidet nur im Business-Stand — ein Haushalts-Vorschlag ist dort nicht zu finden (404)', async () => {
    expect((await post('pa', { aktion: 'vorschlag', id: 'v-hh', status: 'abgelehnt', umfang: 'business' })).status).toBe(404);
    expect((await post('pa', { aktion: 'vorschlag', id: 'v-hh', status: 'abgelehnt', space: 'business' })).status).toBe(404);
    const hh = await db.loadJson<{ vorschlaege: { id: string; status: string }[] }>('haushalt-chef--h-pruef');
    expect(hh!.vorschlaege.find(v => v.id === 'v-hh')!.status).toBe('offen');
    const r = await post('pa', { aktion: 'vorschlag', id: 'v-biz', status: 'abgelehnt', umfang: 'business' });
    expect(r.status).toBe(200);
    const biz = await db.loadJson<{ vorschlaege: { id: string; status: string }[] }>('finanzchef');
    expect(biz!.vorschlaege.find(v => v.id === 'v-biz')!.status).toBe('abgelehnt');
  });
  it('Lauf vom Business-Knopf rechnet ohne Haushalt: der Versuch steht im Business-Stand, der Haushalts-Stand bleibt unberührt', async () => {
    const vorher = JSON.stringify(await db.loadJson('haushalt-chef--h-pruef'));
    delete process.env.ANTHROPIC_API_KEY;
    await post('pa', { aktion: 'lauf', modus: 'wochenreview', umfang: 'business' });
    const biz = await db.loadJson<{ versuche?: Record<string, string> }>('finanzchef');
    expect(biz!.versuche?.wochenreview).toBeTruthy();
    expect(JSON.stringify(await db.loadJson('haushalt-chef--h-pruef'))).toBe(vorher);
  });
  it('Einstellung aus der Business-Sicht lässt ESt-Vorauszahlung und die Rechtsform der Privat-Einheit stehen', async () => {
    const r = await post('pa', { aktion: 'einstellung', umfang: 'business', einstellung: {
      steuer: { ust: 'monatlich', dauerfrist: true, estVorauszahlung: false }, rechtsform: { kdv: 'GmbH', kdc: null },
    } });
    expect(r.status).toBe(200);
    const d = await r.json() as { einstellung: { steuer: { estVorauszahlung: boolean }; rechtsform: Record<string, unknown> } };
    expect(d.einstellung.steuer.estVorauszahlung).toBe(false);
    expect(d.einstellung.rechtsform).not.toHaveProperty('kdc');
    const e = await db.loadJson<{ steuer: { ust: string; estVorauszahlung: boolean }; rechtsform: { kdv: string; kdc: string } }>('finanzchef-einstellung');
    expect(e!.steuer).toMatchObject({ ust: 'monatlich', estVorauszahlung: true });
    expect(e!.rechtsform).toEqual({ kdv: 'GmbH', kdc: 'Einzelunternehmen' });
  });
  it('Oberfläche: die Business-Ansicht schickt `umfang: business` bei Lauf und Vorschlag; Steuer-Annahmen sind nur ein Verweis (EINE Quelle, L2 S1)', () => {
    const q = readFileSync(path.join(process.cwd(), 'components/os/FinanzchefView.tsx'), 'utf8');
    expect(q).toContain("const umfang = bereich === 'business' ? { umfang: 'business' as const } : {};");
    expect(q).toContain("aktion: 'lauf', modus: m, ...umfang");
    expect(q).toContain("aktion: 'vorschlag', id: v.id, status, ...umfang");
    // Seit 18.10. (L2 S1) gibt es hier keine Eingabe der Steuer-Annahmen mehr — sie stehen unter Finanzen › Steuern (die Route bleibt für alte Fenster).
    expect(q).not.toContain("aktion: 'einstellung'");
  });
});

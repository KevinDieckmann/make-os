// ─── Nahtstellen Markttraktion · Kontakte · Team · Onboarding (09.10., Endprüfung der Nacht) ─────────────────────────────────────────
// Jedes Paket der Nacht (W1, W2a, W2b, Plattform neutral, zweite Inhaberin, Onboarding U2, Netzwerken) war für sich getestet — hier steht,
// was DAZWISCHEN brechen kann: dieselbe Person über verschiedene Anlege-Wege, Art. 18 auf jedem Weg, die Firma einer Anfrage, die Antwort
// einer Wiederholung, das Team zwischen Konten und Markttraktion. Über die echten Routen, eigener Datenordner, nur erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-nahtstellen-crm-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-nahtstellen-crm';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const HAUS = 'haus-naht';
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Route = { POST: (r: Request) => Promise<Response> };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]).toString('base64');
const IBAN = 'DE89370400440532013000';

let db: typeof import('@/lib/store/local-db');
let heute: string;
const kartei = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  heute = (await import('@/lib/zeit')).localDay();
  const konto = (speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id: `k-${speicher}`, speicher, email: `${speicher}@test.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
  // Zwei gleichwertige Inhaber (R9) im selben Haushalt + ein fremdes Konto.
  await db.saveJson('konten', { konten: [konto('kevin', 'inhaber', HAUS), konto('malin', 'inhaber', HAUS), konto('fremd', 'mitglied', 'anderer')], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt>): Kontakt => ({ id, vorname: 'Vor', nachname: 'Nach', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x });
  await db.saveJson('kontakte', { kontakte: [
    // Art. 18 — keine Wirkung über irgendeinen Weg.
    k('c-00000000-0000-4000-8000-00000000a018', { vorname: 'Einge', nachname: 'Schraenkt', email: 'art18@beispiel.example', telefon: '+49 30 5550001', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } }),
    // Eine Person mit privater Notiz der ANDEREN Person und einer IBAN — nie im Klartext in einer Antwort an kevin.
    k('c-00000000-0000-4000-8000-0000000000aa', { vorname: 'Privat', nachname: 'Notiert', email: 'notiert@beispiel.example', privatNotiz: 'nur fuer malin', privatNotizVon: 'malin', zahlung: { iban: IBAN } }),
  ] });
  const speicher = await import('@/lib/crm/speicher');
  const { firmenId } = await import('@/lib/crm/firmen');
  await db.saveJson('crm', { ...speicher.leererBestand(),
    // Eine Firma der Kartei mit Rechtsform und Domain — eine Anfrage nennt sie anders geschrieben (Inbox: Name aus der Mail-Domain).
    firmen: [{ id: firmenId('Beispiel Werke GmbH'), name: 'Beispiel Werke GmbH', rolle: 'zielkunde', domain: 'beispiel-werke.example', geaendert: '2026-09-01T09:00:00.000Z' }],
    events: [{ id: 'ev-naht-1', titel: 'Stammtisch Naht', format: 'stammtisch', ziel: 'Gespräche', datum: heute, status: 'geplant', marke: 'Netzwerken', geaendert: '2026-09-01' }],
  });
  for (const n of [`crm-dateien--${HAUS}`, `netzwerken-erfassungen--${HAUS}`]) await db.saveJson(n, { eintraege: [] });
  await db.saveJson('tasks', { projects: [], tasks: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── 1 · Person anlegen über alle Wege ─────────────────────────────────────────────────────────────────────────────────────────
describe('1 · dieselbe Person über verschiedene Wege → EINE Akte', () => {
  let id = '';
  it('Kartei legt an (Mail, Telefon, Firma)', async () => {
    const route = await import('@/app/api/crm/person/route') as unknown as Route;
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'kartei', person: { vorname: 'Erika', nachname: 'Wegemann', email: 'erika.wegemann@wege-firma.example', telefon: '+49 30 5551234', firma: 'Wege Firma GmbH' } }));
    const d = await r.json() as { ok: boolean; kontaktId: string };
    expect(r.status).toBe(200);
    id = d.kontaktId;
  });
  it('Anfrage (Mail in anderer Schreibweise) hängt an dieselbe Akte', async () => {
    const route = await import('@/app/api/crm/anfrage/route') as unknown as Route;
    const r = await route.POST(anfrage('/api/crm/anfrage', sitzung('malin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'Bitte um Rückruf', neu: { nachname: 'Wegemann', email: 'Erika.Wegemann@Wege-Firma.example' } }));
    const d = await r.json() as { ok: boolean; kontaktId: string; neuePerson: boolean };
    expect(r.status).toBe(200);
    expect(d).toMatchObject({ kontaktId: id, neuePerson: false });
  });
  it('Netzwerken (gleiche Mail) führt zusammen statt neu anzulegen', async () => {
    const route = await import('@/app/api/netzwerken/route') as unknown as Route;
    const e = { erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-naht-1', kontakt: { vorname: 'Erika', nachname: 'Wegemann', email: 'erika.wegemann@wege-firma.example', firma: 'Wege Firma GmbH' }, bilder: [{ name: 'karte.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'malin' };
    const r = await route.POST(anfrage('/api/netzwerken', sitzung('malin'), 'POST', e));
    const d = await r.json() as { ok: boolean; kontaktId: string; fehler?: string };
    expect(r.status, d.fehler).toBe(200);
    expect(d.kontaktId).toBe(id);
  });
  it('Make.One-Abend (gleiche Nummer + Nachname, ohne Mail) → 409 Dublette mit der vorhandenen Akte — der Einlass bietet „als da eintragen“ an', async () => {
    const route = await import('@/app/api/crm/person/route') as unknown as Route;
    const r = await route.POST(anfrage('/api/crm/person', sitzung('malin'), 'POST', { aktion: 'anlegen', weg: 'makeone', person: { vorname: 'E.', nachname: 'Wegemann', telefon: '030 5551234', vonKarte: true } }));
    const d = await r.json() as { ok: boolean; dublette?: { id: string } };
    expect(r.status).toBe(409);
    expect(d.dublette?.id).toBe(id);
    // Die Karte am Einlass kennt nur Mail/Name — die Nummern-Dublette kommt vom Server und wird mit einem Tipp eingecheckt (nicht nur „ließ sich nicht anlegen“).
    const abend = readFileSync(path.join(process.cwd(), 'components/os/crm/events/Abend.tsx'), 'utf8');
    expect(abend).toMatch(/if \(r\.dublette\) setServerDublette\(r\.dublette\)/);
    expect(abend).toMatch(/bestehend\(serverDublette\)/);
  });
  it('Import einer Zeile OHNE Mail (gleicher Name, gleiche Firma) legt keine zweite Akte an', async () => {
    const route = await import('@/app/api/crm/import/route') as unknown as Route;
    const csv = 'VORNAME;NACHNAME;FIRMA;POSITION_AKTUELL\nErika;Wegemann;Wege Firma GmbH;Leitung Einkauf\n';
    const r = await route.POST(anfrage('/api/crm/import', sitzung('kevin'), 'POST', { csv, name: 'liste.csv' }));
    expect(r.status).toBe(200);
    const alle = (await kartei()).filter(k => k.nachname === 'Wegemann');
    expect(alle.map(k => k.id)).toEqual([id]);
    // Die Lücke ist gefüllt, nichts überschrieben.
    expect(alle[0].position).toBe('Leitung Einkauf');
    expect(alle[0].email).toBe('erika.wegemann@wege-firma.example');
  });
});

describe('1 · Art. 18 auf jedem Weg — nichts angelegt, nichts angehängt', () => {
  const vorher = async () => (await kartei()).length;
  it('Person-Route, Anfrage, Netzwerken, Import', async () => {
    const n0 = await vorher();
    const person = await import('@/app/api/crm/person/route') as unknown as Route;
    for (const weg of ['kartei', 'makeone', 'prospecting', 'schnell'] as const) {
      const r = await person.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg, person: { vorname: 'Neu', nachname: 'Anders', email: 'ART18@beispiel.example' } }));
      expect(r.status, weg).toBe(409);
    }
    const anf = await import('@/app/api/crm/anfrage/route') as unknown as Route;
    expect((await anf.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'x', neu: { nachname: 'Anders', email: 'art18@beispiel.example' } }))).status).toBe(400);
    const nw = await import('@/app/api/netzwerken/route') as unknown as Route;
    const e = { erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-naht-1', kontakt: { vorname: 'Neu', nachname: 'Schraenkt', telefon: '+49 30 5550001' }, bilder: [{ name: 'k.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'kevin' };
    expect((await nw.POST(anfrage('/api/netzwerken', sitzung('kevin'), 'POST', e))).status).toBe(409);
    const imp = await import('@/app/api/crm/import/route') as unknown as Route;
    await imp.POST(anfrage('/api/crm/import', sitzung('kevin'), 'POST', { csv: 'VORNAME;NACHNAME;EMAIL;POSITION_AKTUELL\nEinge;Schraenkt;art18@beispiel.example;Neu\n', name: 'l.csv' }));
    expect(await vorher()).toBe(n0);
    const g = (await kartei()).find(k => k.id === 'c-00000000-0000-4000-8000-00000000a018')!;
    expect(g.position).toBeUndefined();
    expect(g.aktivitaeten).toEqual([]);
  });
});

// ── 1 · Anfrage aus der Inbox: die Firma, die `firmaSichern` gefunden hat, hängt auch an der Person ─────────────────────────────
describe('1 · Anfrage mit anders geschriebener Firma (Inbox: Name aus der Mail-Domain)', () => {
  it('die Person bekommt die vorhandene Firma (Kennung) — der Lead liegt an der Firma, nicht an der Person', async () => {
    const route = await import('@/app/api/crm/anfrage/route') as unknown as Route;
    const { firmaAusDomain } = await import('@/lib/crm/firmen');
    const vorschlag = firmaAusDomain('neu.kontakt@beispiel-werke.example', []).name; // „Beispiel Werke“ — ohne Rechtsform
    expect(vorschlag).toBe('Beispiel Werke');
    const r = await route.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'mail', text: 'Anfrage zum Angebot', neu: { vorname: 'Neu', nachname: 'Kontakt', email: 'neu.kontakt@beispiel-werke.example', firma: vorschlag } }));
    const d = await r.json() as { kontaktId: string };
    expect(r.status).toBe(200);
    const c = await crm();
    const f = c.firmen.filter(x => x.name.startsWith('Beispiel Werke'));
    expect(f.map(x => x.name)).toEqual(['Beispiel Werke GmbH']); // keine zweite Firma
    const k = (await kartei()).find(x => x.id === d.kontaktId)!;
    expect(k.firmaId).toBe(f[0].id);
    expect(f[0].lead?.status).toBe('kontaktiert');
    expect(k.lead).toBeUndefined();
  });
});

// ── 1 · Wiederholung mit vorhandener Kennung: die Antwort ist gefiltert wie jede andere ───────────────────────────────────────────
describe('1 · POST /api/crm/person mit vorhandener Kennung (Wiederholung) — keine fremde private Notiz, keine volle IBAN', () => {
  it('die Antwort läuft durch `fuerPerson`', async () => {
    const route = await import('@/app/api/crm/person/route') as unknown as Route;
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'kartei', id: 'c-00000000-0000-4000-8000-0000000000aa', person: { nachname: 'Egal' } }));
    const roh = await r.text();
    expect(r.status).toBe(200);
    expect(roh).not.toContain('nur fuer malin');
    expect(roh).not.toContain(IBAN);
  });
});

// ── 1 · Prospecting → Kartei mit Ansprechpartner: Branche und Größe der Zielfirma gehen nicht verloren ─────────────────────────
describe('1 · Prospecting mit Ansprechpartner: die neue Firma bekommt Branche und Größe (wie ohne Ansprechpartner)', () => {
  it('firmaZusatz wirkt nur an einer NEUEN Firma', async () => {
    const route = await import('@/app/api/crm/person/route') as unknown as Route;
    const r = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'prospecting', person: { vorname: 'Pro', nachname: 'Spekt', email: 'pro.spekt@ziel-industrie.example', firma: 'Ziel Industrie Naht GmbH', firmaZusatz: { branche: 'Maschinenbau', mitarbeiter: '50-200' } } }));
    const d = await r.json() as { firmaId: string };
    expect(r.status).toBe(200);
    expect((await crm()).firmen.find(f => f.id === d.firmaId)).toMatchObject({ branche: 'Maschinenbau', mitarbeiter: '50-200' });
    // An einer vorhandenen Firma ändert der Zusatz nichts.
    const r2 = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'prospecting', person: { vorname: 'Zwei', nachname: 'Spekt', email: 'zwei.spekt@ziel-industrie.example', firma: 'Ziel Industrie Naht', firmaZusatz: { branche: 'Anders' } } }));
    expect(r2.status).toBe(200);
    expect((await crm()).firmen.find(f => f.id === d.firmaId)?.branche).toBe('Maschinenbau');
    // Zu lang → 413, nichts gespeichert.
    const r3 = await route.POST(anfrage('/api/crm/person', sitzung('kevin'), 'POST', { aktion: 'anlegen', weg: 'prospecting', person: { nachname: 'Lang', firma: 'X', firmaZusatz: { branche: 'x'.repeat(161) } } }));
    expect(r3.status).toBe(413);
  });
});

// ── 1 · Import mit einer Firma, die im Papierkorb liegt: zurückholen wie „Person anlegen“ (1.6), nie an einer unsichtbaren Firma ───
describe('1 · Import → Firmen-Abgleich: Firma im Papierkorb wird zurückgeholt (wie Person anlegen, Netzwerken, Anfrage)', () => {
  it('die Person hängt an einer sichtbaren Firma, nicht an einer im Papierkorb', async () => {
    const { firmenId } = await import('@/lib/crm/firmen');
    const id = firmenId('Korb Firma GmbH');
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!, firmen: [...c!.firmen, { id, name: 'Korb Firma GmbH', rolle: 'offen', geaendert: '2026-09-01T09:00:00.000Z', geloeschtAm: '2026-10-01T09:00:00.000Z' }] }));
    const imp = await import('@/app/api/crm/import/route') as unknown as Route;
    const r = await imp.POST(anfrage('/api/crm/import', sitzung('kevin'), 'POST', { csv: 'VORNAME;NACHNAME;EMAIL;FIRMA\nKorb;Person;korb.person@korb-firma.example;Korb Firma GmbH\n', name: 'l3.csv' }));
    expect(r.status).toBe(200);
    const k = (await kartei()).find(x => x.email === 'korb.person@korb-firma.example')!;
    expect(k.firmaId).toBe(id);
    const f = (await crm()).firmen.find(x => x.id === id)!;
    expect(f.geloeschtAm).toBeUndefined();
    const { ZURUECK_VERMERK } = await import('@/lib/crm/ablage');
    expect(f.notiz ?? '').toContain(ZURUECK_VERMERK);
  });
});

// ── 1 · „Online gewinnt“ auch für Personen aus einer Anfrage: was die Person selbst angab, überschreibt kein späterer Import ────────
describe('1 · Anfrage → Import: Angaben der Person bleiben (vonHand wie bei „Person anlegen“ und Netzwerken)', () => {
  it('Telefon aus der Anfrage wird vom Import nicht still überschrieben, sondern als Konflikt vorgelegt', async () => {
    const anf = await import('@/app/api/crm/anfrage/route') as unknown as Route;
    const r = await anf.POST(anfrage('/api/crm/anfrage', sitzung('kevin'), 'POST', { aktion: 'anlegen', kanal: 'telefon', text: 'Rückruf bitte', neu: { vorname: 'Tele', nachname: 'Fonrufer', email: 'tele.fonrufer@ruf-firma.example', telefon: '+49 30 7770001' } }));
    const d = await r.json() as { kontaktId: string };
    expect(r.status).toBe(200);
    const vorher = (await kartei()).find(k => k.id === d.kontaktId)!;
    expect(vorher.vonHand).toEqual(expect.arrayContaining(['telefon']));
    const imp = await import('@/app/api/crm/import/route') as unknown as Route;
    await imp.POST(anfrage('/api/crm/import', sitzung('kevin'), 'POST', { csv: 'VORNAME;NACHNAME;EMAIL;TELEFON\nTele;Fonrufer;tele.fonrufer@ruf-firma.example;+49 30 9999999\n', name: 'l2.csv' }));
    const nachher = (await kartei()).find(k => k.id === d.kontaktId)!;
    expect(nachher.telefon).toBe('+49 30 7770001');
    const konf = (await db.loadJson<{ konflikte: { kontaktId: string; feld: string }[] }>('crm-import-konflikte'))?.konflikte ?? [];
    expect(konf.some(x => x.kontaktId === d.kontaktId && x.feld === 'telefon')).toBe(true);
  });
});

// ── 2 · Team: keine festen Namen in Laufzeit-Code der Markttraktion; unsere Instanz verhält sich wie vorher ──────────────────────
describe('2 · Team aus der Instanz — keine festen Namen (Übergabe-Text, Brain-Übernahme)', () => {
  it('Übergabe ohne gültiges „an“ nennt die Kürzel des Teams, nicht feste Namen', async () => {
    const src = readFileSync(path.join(process.cwd(), 'lib/crm/uebergabe.ts'), 'utf8');
    expect(src).not.toMatch(/['"`](kevin|malin)['"`]|\(kevin, malin/);
  });
  it('Brain-Übernahme: die Sales-Verantwortung hält die Beziehung selbst, sonst „beide“ (für unsere Kürzel wie vorher)', async () => {
    const { ausBrain } = await import('@/lib/crm/umzug');
    const { leererBestand } = await import('@/lib/crm/speicher');
    const { verantwortlich, TEAM } = await import('@/lib/crm/team');
    const d = { kunden: [{ name: 'Brain Kunde GmbH', ansprechpartner: [{ name: 'Bea Brain' }], status: 'kunde' }] };
    const v = verantwortlich('sales');
    const ander = TEAM.find(t => t.id !== v)?.id ?? 'andere-person';
    const besitzer = (p: string) => ausBrain(d, leererBestand(), [], '2026-10-09', '2026-10-09T09:00:00.000Z', p).kontakte.find(k => k.nachname === 'Brain')?.besitzer;
    expect(besitzer(v)).toBe(v);
    expect(besitzer(ander)).toBe('beide');
    expect(readFileSync(path.join(process.cwd(), 'lib/crm/umzug.ts'), 'utf8')).not.toMatch(/['"`](kevin|malin)['"`]/);
  });
});

// ─── Alle Listen anpassbar (04.10., UMBAU_ABEND_0410.md › 5 + 9, DESIGN_STANDARD.md › Löschen & Archivieren) ─────────────
// Kevin: „Mach weiter mit allen und den anderen Listen — wir müssen alles anpassbar haben, auch wenn wir mal einen Demo-Account
// machen.“ Der Wächter hält fest:
//   · JEDE Liste mit Einträgen hängt am Baustein `ZeileAktionen` (Liste der Komponenten unten) — neue Listen gehören dazu.
//   · Kein `window.confirm` mehr im Repo (Ausnahmen begründet), Rückfragen über `useRueckfrage`, „Rückgängig“ über `useRueckgaengig`.
//   · CRM-Archiv & -Papierkorb (lib/crm/ablage.ts): Server-Zeit, Papierkorb für alle Leser unsichtbar, endgültig nur aus dem
//     Papierkorb, Firmen/Mandate nur ohne Verweise, Morgenlauf; Angebote (Archiv jeder Status, Papierkorb nur Entwürfe).
//   · Rechte: fremder Haushalt (Testkunde/Partner) 403 auf jedem neuen Weg; fremde „nur ich“-Familieneinträge bleiben unberührt.
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { CrmBestand, Firma, Event, Segment, Mandat, Angebot } from '@/lib/crm/typen';
import { crmSicht, crmPapierkorb, crmAbgelaufen, papierkorbPflicht, neuImPapierkorb, ablageVomServer, ablageZusatz, angeboteAbgelaufen } from '@/lib/crm/ablage';
import { saeubereKontakt } from '@/lib/make-one/crm';
import { sauberZiel } from '@/lib/planung/ziele';
import { sauberMeilenstein } from '@/lib/planung/meilensteine';
import { wendeFamilieAn } from '@/lib/familie/speicher';
import type { Familie } from '@/lib/familie/typen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-listen-aktionen-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-listen-aktionen';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => { const rel = `${dir}/${n}`; return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.tsx?$/.test(n) ? [rel] : []; });
}

const J = '2026-10-04T10:00:00.000Z';
const ALT = '2026-08-01T00:00:00.000Z';
const F = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const S = (id: string, x: Partial<Segment> = {}): Segment => ({ id, name: `Segment ${id}`, kriterien: {}, geaendert: J, ...x });
const E = (id: string, x: Partial<Event> = {}): Event => ({ id, titel: `Event ${id}`, format: 'dinner', ziel: 'drei Gespräche', datum: '2026-11-01', status: 'geplant', geaendert: J, ...x } as Event);
const leer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] });

// ── 1 · Wächter: jede Liste, kein window.confirm ─────────────────────────────────────────────────────────────────
/** Jede Liste mit Einträgen nutzt den Baustein — kommt eine neue Liste dazu, gehört sie hierher. */
const LISTEN: [string, string][] = [
  ['Produkte', 'components/os/mandate/Produkte.tsx'],
  ['Aufgaben (Baum: Aufgabe, Projekt, Gruppe, Liste)', 'components/os/aufgaben/BaumAnsicht.tsx'],
  ['Aufgaben-Archiv', 'components/os/aufgaben/EinzelArchiv.tsx'],
  ['Mandate', 'components/os/crm/Kunden.tsx'],
  ['Angebote', 'components/os/crm/angebot/Liste.tsx'],
  ['Kontakte (Kartei)', 'components/os/crm/Kartei.tsx'],
  ['Firmen', 'components/os/crm/Firmen.tsx'],
  ['Deals', 'components/os/crm/Pipeline.tsx'],
  ['Events (Make.One)', 'components/os/crm/Events.tsx'],
  ['Events (besucht)', 'components/os/crm/besuche/BesuchKalender.tsx'],
  ['Kampagnen', 'components/os/crm/Kampagnen.tsx'],
  ['Segmente', 'components/os/crm/marketing/Segmente.tsx'],
  ['Beiträge', 'components/os/crm/marketing/Redaktionsplan.tsx'],
  ['Newsletter', 'components/os/crm/marketing/Newsletter.tsx'],
  ['Ziele & Meilensteine', 'components/os/planung/ZieleMeilensteine.tsx'],
  ['Brain-Regeln', 'components/os/wissen/Regeln.tsx'],
  ['Bauplan-Karten', 'components/os/bauplan/BauplanBoard.tsx'],
  ['Familie (Tage, Menschen, Karten, Traditionen)', 'components/os/familie/FamilieOrga.tsx'],
  ['Familie (Themen, Wünsche, Ideen)', 'components/os/familie/ablage.tsx'],
  ['Stammdaten-Kartei', 'components/os/StammdatenView.tsx'],
  ['Netzwerken (Visitenkarten-Profile)', 'components/os/netzwerken/MeineKarte.tsx'],
];

describe('Wächter: alle Listen am Baustein, keine Browser-Rückfrage', () => {
  it.each(LISTEN)('%s nutzt ZeileAktionen', (_name, datei) => {
    expect(lies(datei)).toMatch(/<ZeileAktionen\b/);
  });
  it('WirZwei (Familie) nutzt den Familien-Baustein', () => {
    expect(lies('components/os/familie/WirZwei.tsx')).toMatch(/<MitAktionen\b/);
  });
  it('kein window.confirm im Repo — Ausnahmen begründet', () => {
    // Keine Ausnahme mehr (Prüfung 04.10.: auch „IBAN entfernen“ fragt über useRueckfrage).
    const AUSNAHMEN = new Set<string>();
    const funde = ['app', 'components', 'lib', 'context', 'hooks'].flatMap(d => dateien(d))
      .filter(f => !AUSNAHMEN.has(f))
      .filter(f => lies(f).split('\n').some(z => !/^\s*(\/\/|\*)/.test(z) && /window\.confirm\(|(^|[^.\w])confirm\(/.test(z)));
    expect(funde).toEqual([]);
  });
  it('Rückgängig hat EINE Quelle: planung/Rueckgaengig.tsx ist aufgegangen, der Kalender nutzt useRueckgaengig', () => {
    expect(() => lies('components/os/planung/Rueckgaengig.tsx')).toThrow();
    expect(lies('components/os/kalender/verschieben.tsx')).toContain('useRueckgaengig');
    const eigene = dateien('components/os').filter(f => !f.startsWith('components/os/ui/') && /export (const|function) (useRueckgaengig|RUECKGAENGIG_MS)\b/.test(lies(f)) && !lies(f).includes("from '../ui'") && !lies(f).includes("from './ui'"));
    expect(eigene).toEqual([]);
  });
  it('Rückfrage als Promise: bestaetigen() im Baustein, Zeilenumbrüche sichtbar', () => {
    const q = lies('components/os/ui/zeile-aktionen.tsx');
    expect(q).toContain('bestaetigen: (b: Bestaetigung) => Promise<boolean>');
    expect(q).toContain("whiteSpace: 'pre-line'");
  });
});

// ── 2 · CRM-Ablage (rein) ────────────────────────────────────────────────────────────────────────────────────────
describe('lib/crm/ablage', () => {
  const b = (): CrmBestand => ({ ...leer(), firmen: [F('f-a'), F('f-korb', { geloeschtAm: ALT }), F('f-arch', { archiviertAm: J })], segmente: [S('sg-1', { geloeschtAm: J })], events: [E('ev-1'), E('ev-korb', { geloeschtAm: ALT, kalenderUid: 'u-1' })], angebote: [{ id: 'ang-e', status: 'entwurf', geloeschtAm: ALT, positionen: [], gesellschaft: 'kdv' } as unknown as Angebot] });
  it('Sicht: Papierkorb für alle Leser weg (auch Angebots-Entwürfe), Archiv bleibt lesbar', () => {
    const s = crmSicht(b());
    expect(s.firmen.map(f => f.id)).toEqual(['f-a', 'f-arch']);
    expect(s.segmente).toEqual([]);
    expect(s.events.map(e => e.id)).toEqual(['ev-1']);
    expect(s.angebote).toEqual([]);
    const ohne = { ...leer(), firmen: [F('f-a')] };
    expect(crmSicht(ohne)).toBe(ohne); // nichts im Papierkorb → derselbe Bestand (keine Kopie)
  });
  it('Papierkorb-Liste neueste zuerst, Frist 30 Tage, abgelaufen nur nach der Frist', () => {
    expect(crmPapierkorb(b()).map(e => `${e.liste}:${e.id}`)).toEqual(['segmente:sg-1', 'firmen:f-korb', 'events:ev-korb']);
    expect(crmPapierkorb(b()).find(e => e.id === 'f-korb')!.bisTag).toBe('2026-08-31');
    expect(crmAbgelaufen(b(), J).map(e => e.id)).toEqual(['f-korb', 'ev-korb']);
    expect(angeboteAbgelaufen(b(), J)).toEqual(['ang-e']);
  });
  it('endgültig nur aus dem Papierkorb; Unbekanntes lehnt nichts ab', () => {
    expect(papierkorbPflicht(b(), [{ liste: 'firmen', op: 'delete', id: 'f-a' }])[0]).toMatch(/nicht im Papierkorb/);
    expect(papierkorbPflicht(b(), [{ liste: 'firmen', op: 'delete', id: 'f-korb' }, { liste: 'firmen', op: 'delete', id: 'f-gibts-nicht' }])).toEqual([]);
    expect(papierkorbPflicht(b(), [{ liste: 'chancen', op: 'delete', id: 'x' }])).toEqual([]);
  });
  it('neu in den Papierkorb (Firmen/Mandate) wird wie Löschen geprüft — bereits drin nicht', () => {
    expect(neuImPapierkorb(b(), [{ liste: 'firmen', op: 'teil', id: 'f-a', felder: { geloeschtAm: J } }], ['firmen', 'mandate'])).toEqual([{ liste: 'firmen', op: 'delete', id: 'f-a' }]);
    expect(neuImPapierkorb(b(), [{ liste: 'firmen', op: 'teil', id: 'f-korb', felder: { geloeschtAm: J } }], ['firmen', 'mandate'])).toEqual([]);
    expect(neuImPapierkorb(b(), [{ liste: 'segmente', op: 'teil', id: 'sg-1', felder: { geloeschtAm: J } }], ['firmen', 'mandate'])).toEqual([]);
  });
  it('Marken: nur ISO, nur auf Listen, die sie kennen; Server-Zeit, bestehende bleibt', () => {
    expect(ablageZusatz('firmen', { geloeschtAm: J, archiviertAm: 'gestern' })).toEqual({ geloeschtAm: J });
    expect(ablageZusatz('mandate', { archiviertAm: J })).toEqual({}); // Mandate: Archiv = Status „beendet“
    expect(ablageZusatz('chancen', { geloeschtAm: J })).toEqual({});
    expect(ablageVomServer(undefined, { id: 'x', geloeschtAm: '1999-01-01T00:00:00.000Z', archiviertAm: '1999-01-01T00:00:00.000Z' }, J)).toEqual({ id: 'x', geloeschtAm: J, archiviertAm: J });
    expect(ablageVomServer({ id: 'x', archiviertAm: ALT }, { id: 'x', archiviertAm: J }, J).archiviertAm).toBe(ALT);
  });
});

describe('Archiv-Marken außerhalb des CRM (Kartei, Planung)', () => {
  it('Kontakt behält archiviertAm (nur ISO)', () => {
    expect(saeubereKontakt({ id: 'c-anna1', vorname: 'Anna', nachname: 'Test', stufe: 'neu', aktivitaeten: [], importiertAm: '', geaendertAm: '', archiviertAm: J })!.archiviertAm).toBe(J);
    expect(saeubereKontakt({ id: 'c-anna1', vorname: 'Anna', nachname: 'Test', stufe: 'neu', aktivitaeten: [], importiertAm: '', geaendertAm: '', archiviertAm: 'bald' })!.archiviertAm).toBeUndefined();
  });
  it('Ziel und Meilenstein behalten archiviertAm', () => {
    expect(sauberZiel({ id: 'z-1', titel: 'Ziel', fortschritt: 0, erledigt: false, archiviertAm: J })!.archiviertAm).toBe(J);
    expect(sauberMeilenstein({ id: 'ms-1', titel: 'MS', fortschritt: 0, erledigt: false, archiviertAm: J })!.archiviertAm).toBe(J);
    expect(sauberZiel({ id: 'z-1', titel: 'Ziel', archiviertAm: 'nie' })!.archiviertAm).toBeUndefined();
  });
  it('Familie: fremde „nur ich“-Einträge lassen sich weder archivieren noch löschen', () => {
    const f = { themen: [{ id: 't-1', von: 'kevin', am: J, sichtbarkeit: 'nur-ich', titel: 'Geheim', art: 'unklar', status: 'offen', hut: 'privat' }] } as unknown as Familie;
    const r = wendeFamilieAn(f, [{ liste: 'themen', op: 'upsert', eintrag: { ...f.themen[0], archiviertAm: J } }, { liste: 'themen', op: 'delete', id: 't-1' }], 'malin', J);
    expect(r.abgelehnt).toBe(2);
    expect(r.familie.themen[0].archiviertAm).toBeUndefined();
    const eigen = wendeFamilieAn(f, [{ liste: 'themen', op: 'upsert', eintrag: { ...f.themen[0], archiviertAm: J } }], 'kevin', J);
    expect(eigen.familie.themen[0].archiviertAm).toBe(J);
  });
});

// ── 3 · Server: Rechte, Papierkorb-Pflicht, Sicht, Morgenlauf ──────────────────────────────────────────────────────
describe('Server: CRM-Bestand und Angebote', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  let bestand: Route, angebot: Route, events: Route;
  let db: typeof import('@/lib/store/local-db');
  let speicher: typeof import('@/lib/crm/speicher');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const patch = (person: string, ops: unknown[]) => bestand.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf(person), body: JSON.stringify({ ops }) }));
  const angebotPost = (person: string, body: unknown) => angebot.POST(new Request('http://test/api/crm/angebot', { method: 'POST', headers: kopf(person), body: JSON.stringify(body) }));
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  const roh = async () => (await db.loadJson<CrmBestand>('crm'))!;
  const A = (id: string, status: Angebot['status'], x: Partial<Angebot> = {}): Angebot => ({ id, status, titel: `Angebot ${id}`, positionen: [], gesellschaft: 'kdv', gueltigBis: '2027-12-31', version: 1, geaendert: J, ...x } as unknown as Angebot);

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    speicher = await import('@/lib/crm/speicher');
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-person', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', firmaId: 'f-mit-person', firma: 'Firma f-mit-person', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
    await db.saveJson('crm', {
      ...speicher.leererBestand(),
      firmen: [F('f-leer'), F('f-mit-person'), F('f-alt-korb', { geloeschtAm: ALT })],
      segmente: [S('sg-1')],
      mandate: [{ id: 'm-1', kunde: 'Kunde', titel: 'Mandat', kontaktIds: [], art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: J } as unknown as Mandat],
      events: [E('ev-1')],
      angebote: [A('ang-entwurf', 'entwurf'), A('ang-gestellt', 'gestellt', { nummer: 'A-2026-001' })],
    });
    bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
    angebot = (await import('@/app/api/crm/angebot/route')) as unknown as Route;
    events = (await import('@/app/api/crm/events/route')) as unknown as Route;
  });

  it('fremder Haushalt (Testkunde, Partner): 403 für Papierkorb, Archiv, Wiederherstellen und Angebots-Ablage', async () => {
    for (const p of ['testkunde', 'partner']) {
      expect((await patch(p, [{ liste: 'firmen', op: 'teil', id: 'f-leer', felder: { geloeschtAm: J } }])).status).toBe(403);
      expect((await patch(p, [{ liste: 'segmente', op: 'teil', id: 'sg-1', felder: { archiviertAm: J } }])).status).toBe(403);
      expect((await patch(p, [{ liste: 'firmen', op: 'teil', id: 'f-alt-korb', felder: { geloeschtAm: null } }])).status).toBe(403);
      expect((await angebotPost(p, { aktion: 'ablage', id: 'ang-entwurf', art: 'papierkorb' })).status).toBe(403);
      expect((await angebot.GET(new Request('http://test/api/crm/angebot', { headers: kopf(p) }))).status).toBe(403);
    }
    const b = await roh();
    expect(b.firmen.find(f => f.id === 'f-leer')!.geloeschtAm).toBeUndefined();
    expect(b.segmente[0].archiviertAm).toBeUndefined();
    expect(b.firmen.find(f => f.id === 'f-alt-korb')!.geloeschtAm).toBe(ALT);
  });

  it('Papierkorb: Server-Zeit, für Leser unsichtbar (ladeCrm, GET stand), getrennt als `papierkorb`; zurück mit null', async () => {
    const vorher = Date.now();
    expect((await patch('malin', [{ liste: 'segmente', op: 'teil', id: 'sg-1', felder: { geloeschtAm: '1999-01-01T00:00:00.000Z' } }])).status).toBe(200);
    const am = (await roh()).segmente[0].geloeschtAm!;
    expect(Date.parse(am)).toBeGreaterThanOrEqual(vorher - 1000);
    expect((await speicher.ladeCrm()).segmente).toEqual([]);
    const g = await (await bestand.GET(new Request('http://test/api/crm/bestand', { headers: kopf('kevin') }))).json() as { stand: CrmBestand; papierkorb: { liste: string; id: string }[] };
    expect(g.stand.segmente).toEqual([]);
    expect(g.papierkorb.map(e => `${e.liste}:${e.id}`)).toEqual(expect.arrayContaining(['segmente:sg-1', 'firmen:f-alt-korb']));
    expect((await patch('kevin', [{ liste: 'segmente', op: 'teil', id: 'sg-1', felder: { geloeschtAm: null } }])).status).toBe(200);
    expect((await roh()).segmente[0].geloeschtAm).toBeUndefined();
  });

  it('Archiv: Server-Zeit, bleibt im Stand lesbar, zurückholbar', async () => {
    expect((await patch('malin', [{ liste: 'firmen', op: 'teil', id: 'f-mit-person', felder: { archiviertAm: '2000-01-01T00:00:00.000Z' } }])).status).toBe(200);
    const f = (await speicher.ladeCrm()).firmen.find(x => x.id === 'f-mit-person')!;
    expect(f.archiviertAm).not.toBe('2000-01-01T00:00:00.000Z');
    expect((await patch('malin', [{ liste: 'firmen', op: 'teil', id: 'f-mit-person', felder: { archiviertAm: null } }])).status).toBe(200);
    expect((await roh()).firmen.find(x => x.id === 'f-mit-person')!.archiviertAm).toBeUndefined();
  });

  it('endgültig nur aus dem Papierkorb (409 sonst); Firma mit Person kommt gar nicht in den Papierkorb (Sperre)', async () => {
    const r = await patch('kevin', [{ liste: 'firmen', op: 'delete', id: 'f-leer' }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { fehler: string }).fehler).toMatch(/nicht im Papierkorb/);
    const s = await patch('kevin', [{ liste: 'firmen', op: 'teil', id: 'f-mit-person', felder: { geloeschtAm: J } }]);
    expect(s.status).toBe(409);
    expect(((await s.json()) as { sperren?: unknown[] }).sperren?.length).toBe(1);
    expect((await roh()).firmen.find(x => x.id === 'f-mit-person')!.geloeschtAm).toBeUndefined();
    expect((await patch('kevin', [{ liste: 'firmen', op: 'teil', id: 'f-leer', felder: { geloeschtAm: J } }])).status).toBe(200);
    expect((await patch('kevin', [{ liste: 'firmen', op: 'delete', id: 'f-leer' }])).status).toBe(200);
    expect((await roh()).firmen.some(x => x.id === 'f-leer')).toBe(false);
  });

  it('Event: Endgültig über den Serverweg nur aus dem Papierkorb', async () => {
    const post = (body: unknown) => events.POST(new Request('http://test/api/crm/events', { method: 'POST', headers: kopf('kevin'), body: JSON.stringify(body) }));
    expect((await post({ aktion: 'loeschen', eventId: 'ev-1' })).status).toBe(409);
    expect((await patch('kevin', [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { geloeschtAm: J } }])).status).toBe(200);
    // Andere Aktionen sehen das Event im Papierkorb nicht mehr.
    expect((await post({ aktion: 'ziel', eventId: 'ev-1', aenderung: { op: 'hinzu', kontaktId: 'c-person' } })).status).toBe(404);
    expect((await post({ aktion: 'loeschen', eventId: 'ev-1' })).status).toBe(200);
    expect((await roh()).events.some(e => e.id === 'ev-1')).toBe(false);
  });

  it('Angebote: Archiv jeder Status; Papierkorb nur Entwürfe; endgültig nur aus dem Papierkorb; GET trennt den Papierkorb', async () => {
    const g0 = (await angebotPost('kevin', { aktion: 'ablage', id: 'ang-gestellt', art: 'papierkorb' }));
    expect(g0.status).toBe(409);
    expect((await angebotPost('malin', { aktion: 'ablage', id: 'ang-gestellt', art: 'archiv' })).status).toBe(200);
    expect((await roh()).angebote.find(a => a.id === 'ang-gestellt')!.archiviertAm).toBeTruthy();
    expect((await angebotPost('malin', { aktion: 'ablage', id: 'ang-gestellt', art: 'archiv', zurueck: true })).status).toBe(200);
    expect((await roh()).angebote.find(a => a.id === 'ang-gestellt')!.archiviertAm).toBeUndefined();
    expect((await angebotPost('kevin', { aktion: 'loeschen', id: 'ang-entwurf' })).status).toBe(409); // nicht im Papierkorb
    expect((await angebotPost('kevin', { aktion: 'ablage', id: 'ang-entwurf', art: 'papierkorb' })).status).toBe(200);
    const g = await (await angebot.GET(new Request('http://test/api/crm/angebot', { headers: kopf('kevin') }))).json() as { angebote: Angebot[]; papierkorb: (Angebot & { stand: string })[] };
    expect(g.angebote.map(a => a.id)).toEqual(['ang-gestellt']);
    expect(g.papierkorb.map(a => a.id)).toEqual(['ang-entwurf']);
    expect((await angebotPost('kevin', { aktion: 'loeschen', id: 'ang-entwurf', stand: g.papierkorb[0].stand })).status).toBe(200);
    expect((await roh()).angebote.map(a => a.id)).toEqual(['ang-gestellt']);
  });

  it('Morgenlauf: abgelaufen + ohne Verweise → weg; mit Kalender-Termin bleibt das Event; Angebots-Entwürfe nach der Frist', async () => {
    await db.saveJson('crm', { ...(await roh()), firmen: [F('f-x', { geloeschtAm: ALT })], events: [E('ev-termin', { geloeschtAm: ALT, kalenderUid: 'make-os-ev' }), E('ev-frei', { geloeschtAm: ALT })], kampagnen: [], angebote: [A('ang-alt', 'entwurf', { geloeschtAm: ALT })] });
    const { crmPapierkorbAufraeumen } = await import('@/lib/crm/produkte-server');
    const r = await crmPapierkorbAufraeumen(new Date(J));
    expect(r.eintraege).toBe(3);
    const b = await roh();
    expect(b.firmen).toEqual([]);
    expect(b.events.map(e => e.id)).toEqual(['ev-termin']);
    expect(b.angebote).toEqual([]);
  });
});

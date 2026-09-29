// ─── Paket D-C (29.09., #35, Kevin): Kennungs-Umzug alt → c-<uuid> an einem erfundenen Bestand mit 500 Kontakten ─
// Verweise in ALLEN Speichern (CRM, Ablage, Konflikte, Heads, Replay, Signale, Aufgaben inkl. bezug, Import- und
// Zusammenführ-Läufe, ZOE-Stapel/-Entscheidungen, Änderungsprotokoll, Meldungen). Geprüft: Vorschau schreibt nichts,
// Ausführen stellt alles um, alte Links leiten weiter, Rückweg stellt den alten Stand her (409 nach einer Änderung),
// Sperrliste/Grabsteine/Protokoll-Fingerabdrücke bleiben gültig, Abbruch → Wiederaufnahme.
// Alle Namen, Adressen und Kennungen erfunden (@example.invalid).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-dc-umzug-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_GRABSTEINE_DIR;
process.env.MAKE_OS_KEY = 'pruef-schluessel-d-c-umzug';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-d-c-umzug-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-d-c-umzug-nur-im-test-0123456789abcdef';

type Route = { POST: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let umzug: typeof import('@/lib/crm/kennungen-umzug');
let route: Route;
const HAUS = 'test-haus';
const N = 500;
const alteId = (i: number) => `c-p${i}testexampleinvalid-a${i.toString(36)}`;
const mail = (i: number) => `p${i}.test@example.invalid`;
const UUID = /^c-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const aufruf = (aktion: string, person = 'kevin') => route.POST(new Request('http://test/api/crm/kennungen-umzug', { method: 'POST', headers: { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person, 'content-type': 'application/json' }, body: JSON.stringify({ aktion }) }));

/** Alle Bestände entschlüsselt als Text (ohne konten; optional weitere ausnehmen) — Schlüssel sortiert (stabil). */
async function alles(ohne: RegExp = /^konten$/): Promise<string> {
  const { stabil } = await import('@/lib/store/fingerabdruck');
  const namen = readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(n => !ohne.test(n)).sort();
  return (await Promise.all(namen.map(async n => `${n}:${stabil(await db.loadJson(n))}`))).join('\n');
}
function allesLeeren() {
  for (const n of readdirSync(ordner)) if (n !== 'konten.json') rmSync(path.join(ordner, n), { recursive: true, force: true });
  db.leseCacheLeeren();
}

async function welt() {
  allesLeeren();
  const { protokollKennung } = await import('@/lib/store/aenderungsprotokoll');
  const { kontaktAbdruck } = await import('@/lib/crm/import-lauf');
  const { fingerabdruck } = await import('@/lib/store/fingerabdruck');
  const { neueKontaktKennung } = await import('@/lib/kennung');
  const kontakte: Kontakt[] = Array.from({ length: N }, (_, i) => ({
    id: alteId(i), vorname: `Testperson${i}`, nachname: 'Umzug', email: mail(i), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01',
    ...(i > 0 ? { notiz: `empfohlen von /os/markttraktion?s=kontakte&a=akte&k=${alteId(i - 1)}` } : {}),
  } as Kontakt));
  const schonNeu = [neueKontaktKennung(), neueKontaktKennung(), neueKontaktKennung()].map((id, j) => ({ id, vorname: `Neu${j}`, nachname: 'Schon', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' } as Kontakt));
  await db.saveJson('kontakte', { kontakte: [...kontakte, ...schonNeu] });
  const deal = (j: number) => ({ id: `ch${j}`, titel: `Deal ${j}`, kontaktIds: [alteId(j), alteId(j + 1)], personenRollen: { [alteId(j)]: 'entscheider' }, stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' });
  const crm: CrmBestand = {
    firmen: [], leistungen: [], verarbeitungen: [], segmente: [], newsletter: [], beitraege: [], sitzungen: [], antraege: [],
    chancen: Array.from({ length: 100 }, (_, j) => deal(j * 2)) as unknown as CrmBestand['chancen'],
    mandate: [{ id: 'm1', kunde: 'Probe', titel: 'Mandat', kontaktIds: [alteId(3)], status: 'aktiv', honorar: { betrag: 1, basis: 'monat' } }] as unknown as CrmBestand['mandate'],
    events: [{ id: 'ev1', titel: 'Abend', datum: '2026-09-20', status: 'durchgefuehrt' }] as unknown as CrmBestand['events'],
    teilnahmen: Array.from({ length: 50 }, (_, j) => ({ id: `t${j}`, eventId: 'ev1', kontaktId: alteId(j), status: 'da' })) as unknown as CrmBestand['teilnahmen'],
    followups: Array.from({ length: 50 }, (_, j) => ({ id: `fu${j}`, bezug: { art: 'kontakt', id: alteId(j + 10) }, kontaktId: alteId(j + 10), art: 'anruf', text: `Anrufen, siehe ?k=${alteId(j + 10)}`, faellig: '2026-10-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: 'x', geaendert: 'x' })) as unknown as CrmBestand['followups'],
    kampagnen: [{ id: 'kp1', name: 'Kampagne', kontaktIds: [alteId(5), alteId(6)], ergebnisse: [{ kontaktId: alteId(5), ergebnis: 'antwort' }], status: 'laeuft' }] as unknown as CrmBestand['kampagnen'],
    angebote: [{ id: 'ang1', kontaktId: alteId(7), titel: 'Angebot', status: 'entwurf', positionen: [] }] as unknown as CrmBestand['angebote'],
  };
  await db.saveJson('crm', crm);
  await db.saveJson(`crm-dateien--${HAUS}`, { eintraege: Array.from({ length: 20 }, (_, j) => ({ id: `d-probe-${j}`, art: 'vertrag', kontaktId: alteId(j), hochgeladenAm: 'x', hochgeladenVon: 'kevin' })) });
  await db.saveJson('crm-import-konflikte', { konflikte: [{ kontaktId: alteId(11), feld: 'notiz', online: 'a', liste: 'b' }], moeglicheDubletten: [{ kontaktId: alteId(12), mitId: alteId(13), grund: 'Name' }], ohneBesitzer: 0, stand: '', quelle: '' });
  // Grundform des Head-Stands (lib/heads/stand.ts leererStand) — das Umbiegen schreibt sie mit.
  await db.saveJson('head-sales', { vorschlaege: [{ id: 'hs-1', kontakt_id: alteId(20), titel: 'Anrufen', art: 'nachfassen', status: 'offen', erstellt: 'x', kampagne: { kontakt_ids: [alteId(21)] } }], berichte: [], letzte: {}, versuche: {} });
  await db.saveJson('heads-replay-sales', { faelle: [{ id: 'f1', paket: { karten: [{ id: alteId(22) }] } }] });
  await db.saveJson('crm-signale', { kommend: { [alteId(30)]: { titel: 'Kaffee', start: '2026-10-01T10:00:00Z' } } });
  await db.saveJson('tasks', { tasks: [
    { id: 'tk-1', title: 'Rückruf', bezug: { kontaktId: alteId(40), dealId: 'ch0' }, description: `/os/markttraktion?s=kontakte&k=${alteId(40)}`, kommentare: [{ id: 'km1', von: 'kevin', text: `siehe ?k=${alteId(41)}`, am: 'x' }] },
    { id: 'tk-2', title: 'Anderes' },
  ] });
  // Import-Lauf (Fingerabdruck danach = aktueller Kontakt) + Zusammenführ-Lauf (Verweis auf einen Deal).
  const k50 = kontakte[50];
  const d0 = crm.chancen[0] as unknown as Record<string, unknown> & { id: string };
  await db.saveJson(`crm-import-laeufe--${HAUS}`, { laeufe: [
    { id: 'imp-aaaaaa-000001', am: new Date().toISOString(), person: 'kevin', quelle: 'Probe', neu: [k50.id], vorher: [], nachher: { [k50.id]: kontaktAbdruck(k50) } },
    { id: 'imp-aaaaaa-000002', am: new Date().toISOString(), person: 'kevin', quelle: 'Dubletten', art: 'zusammenfuehren', neu: [], vorher: [kontakte[51]], nachher: { [kontakte[52].id]: kontaktAbdruck(kontakte[52]) }, zusammen: { behalten: kontakte[52].id, weg: 'c-weggefallen-x1', verweise: [{ speicher: 'crm:chancen', id: 'ch0', vorher: { ...d0, kontaktIds: ['c-weggefallen-x1'] }, nachher: fingerabdruck(d0) }] } },
  ] });
  await db.saveJson('zoe-stapel', { vorschlaege: [{ id: 'v-1', zeit: 'x', werkzeug: 'notiere_kontakt', status: 'offen', titel: 'Notiz', eingabe: { kontaktId: alteId(60) } }] });
  await db.saveJson(`zoe-entscheidungen--${HAUS}--2026-09`, { eintraege: [{ at: 'x', typ: 'entscheidung', quelleId: 'v-1', bezug: { art: 'crm', id: `aktivitaet:${protokollKennung(alteId(60))}` } }] });
  await db.saveJson(`aenderungsprotokoll--${HAUS}--2026-09`, { eintraege: [{ at: 'x', bestand: 'kontakte', op: 'geaendert', id: protokollKennung(alteId(70)), felder: ['notiz'], wer: 'person', person: 'kevin' }] });
  await db.saveJson('meldungen--kevin', { eintraege: [{ id: 'me1', text: 'Neue Notiz', link: `/os/markttraktion?k=${alteId(80)}` }] });
  // Sperrliste (Werbesperre einer Person) und ein Grabstein einer früher gelöschten Person (nicht in der Kartei).
  const { sperren } = await import('@/lib/crm/sperrliste');
  await sperren([kontakte[90]], 'werbesperre', '2026-09-01');
  const { grabsteinFuer, grabsteinSetzen } = await import('@/lib/datenschutz/grabsteine');
  await grabsteinSetzen(grabsteinFuer('c-geloeschtfrueherexampleinvalid-zz', { vorname: 'Testa', nachname: 'Frueher', email: 'testa.frueher@example.invalid' }, '2026-09-01'));
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  umzug = await import('@/lib/crm/kennungen-umzug');
  route = (await import('@/app/api/crm/kennungen-umzug/route')) as unknown as Route;
});
afterEach(async () => { const ab = await import('@/lib/store/absichten'); ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; ab.absichtTest.vorSchritt = null; });
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

/** Keine alte Kennung mehr in den Arbeitsbeständen (Archiv, Weiterleitung und Absichtsprotokoll ausgenommen). */
async function alteKennungenIn(): Promise<string[]> {
  const t = await alles(/^(konten|kennung-alias--.*|absichten--.*)$/);
  return Array.from(new Set(t.match(/c-p\d+testexampleinvalid-a[0-9a-z]+/g) ?? []));
}

describe('Kennungs-Umzug an 500 Kontakten', () => {
  const vorherStand: { text: string } = { text: '' };
  it('Vorschau: zählt, schreibt nichts; nur der Inhaber', async () => {
    await welt();
    vorherStand.text = await alles();
    const r = await aufruf('vorschau');
    expect(r.status).toBe(200);
    const v = await r.json() as import('@/lib/crm/kennungen-umzug').UmzugVorschau;
    expect(v.anzahl).toBe(N);
    expect(v.schonNeu).toBe(3);
    expect(v.jeKennung).toHaveLength(N);
    for (const s of ['kontakte', 'crm', `crm-dateien--${HAUS}`, 'crm-import-konflikte', 'head-sales', 'heads-replay-sales', 'crm-signale', 'tasks', `crm-import-laeufe--${HAUS}`, 'zoe-stapel', 'meldungen--kevin']) expect(v.speicher[s], s).toBeGreaterThan(0);
    expect(v.fingerabdruecke[`zoe-entscheidungen--${HAUS}--2026-09`]).toBe(1);
    expect(v.fingerabdruecke[`aenderungsprotokoll--${HAUS}--2026-09`]).toBe(1);
    expect(v.jeKennung.find(x => x.id === alteId(40))!.speicher).toMatchObject({ kontakte: 2, tasks: 2 });
    expect(v.rueckweg.moeglich).toBe(false);
    expect(await alles()).toBe(vorherStand.text);
    expect((await aufruf('vorschau', 'malin')).status).toBe(403);
    expect((await aufruf('ausfuehren', 'malin')).status).toBe(403);
  });

  let paare = new Map<string, string>();
  it('Ausführen: alle Kennungen zufällig, jeder Verweis mitgezogen, nichts Altes mehr in den Beständen', async () => {
    const t0 = Date.now();
    const r = await aufruf('ausfuehren');
    const d = await r.json() as { ok: boolean; anzahl: number; archiv: string; speicher: Record<string, number> };
    expect(r.status).toBe(200);
    expect(d.anzahl).toBe(N);
    expect(Date.now() - t0).toBeLessThan(20_000);
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(kontakte).toHaveLength(N + 3);
    expect(kontakte.every(k => UUID.test(k.id))).toBe(true);
    expect(await alteKennungenIn()).toEqual([]);
    // Die Weiterleitungstabelle kennt jedes Paar; über sie prüfen wir die Verweise.
    const { aliasLaden } = await import('@/lib/crm/kennung-alias');
    const alias = await aliasLaden(HAUS);
    paare = new Map(alias.eintraege.map(e => [e.alt, e.neu]));
    expect(paare.size).toBe(N);
    const nach = (i: number) => paare.get(alteId(i))!;
    const nachId = new Map(kontakte.map(k => [k.id, k]));
    expect(nachId.get(nach(1))!.notiz).toContain(`k=${nach(0)}`); // Verweis zwischen Kontakten
    const crm = (await db.loadJson<CrmBestand>('crm'))!;
    expect(crm.chancen[0].kontaktIds).toEqual([nach(0), nach(1)]);
    expect((crm.chancen[0] as unknown as { personenRollen: Record<string, string> }).personenRollen).toEqual({ [nach(0)]: 'entscheider' });
    expect(crm.followups![0]).toMatchObject({ kontaktId: nach(10), bezug: { id: nach(10) }, text: `Anrufen, siehe ?k=${nach(10)}` });
    expect(crm.angebote![0].kontaktId).toBe(nach(7));
    const tasks = (await db.loadJson<{ tasks: { bezug?: { kontaktId?: string }; description?: string; kommentare?: { text: string }[] }[] }>('tasks'))!.tasks;
    expect(tasks[0].bezug!.kontaktId).toBe(nach(40));
    expect(tasks[0].description).toContain(`k=${nach(40)}`);
    expect(tasks[0].kommentare![0].text).toContain(`k=${nach(41)}`);
    expect(Object.keys((await db.loadJson<{ kommend: Record<string, unknown> }>('crm-signale'))!.kommend)).toEqual([nach(30)]);
    // Protokoll-Fingerabdrücke: alt → neu umgerechnet
    const { protokollKennung } = await import('@/lib/store/aenderungsprotokoll');
    const prot = JSON.stringify(await db.loadJson(`aenderungsprotokoll--${HAUS}--2026-09`));
    expect(prot).toContain(protokollKennung(nach(70)));
    expect(prot).not.toContain(protokollKennung(alteId(70)));
    expect(JSON.stringify(await db.loadJson(`zoe-entscheidungen--${HAUS}--2026-09`))).toContain(`aktivitaet:${protokollKennung(nach(60))}`);
    // Archivkopie VORHER (verschlüsselt), mit alten Kennungen.
    expect(existsSync(path.join(ordner, 'archiv', d.archiv))).toBe(true);
    const { archivLesen } = await import('@/lib/store/archiv');
    expect(JSON.stringify(await archivLesen(d.archiv))).toContain(alteId(0));
    // Absicht fertig, ohne Paare (Personendaten) — die bleiben nur in der Weiterleitungstabelle.
    const ab = await import('@/lib/store/absichten');
    const a = (await ab.absichtenLaden(HAUS)).find(x => x.art === 'kennungen-umzug')!;
    expect(a.status).toBe('fertig');
    expect(JSON.stringify(a)).not.toContain('testexampleinvalid');
  });

  it('„Import rückgängig“ und Zusammenführ-Läufe bleiben möglich: Fingerabdrücke nachgezogen', async () => {
    const { kontaktAbdruck, rueckgaengigRechnen } = await import('@/lib/crm/import-lauf');
    const { fingerabdruck } = await import('@/lib/store/fingerabdruck');
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const laeufe = (await db.loadJson<{ laeufe: import('@/lib/crm/import-lauf').ImportLauf[] }>(`crm-import-laeufe--${HAUS}`))!.laeufe;
    const k50 = kontakte.find(k => k.id === paare.get(alteId(50)))!;
    expect(laeufe[0].neu).toEqual([k50.id]);
    expect(laeufe[0].nachher[k50.id]).toBe(kontaktAbdruck(k50));
    expect(rueckgaengigRechnen(kontakte, laeufe[0], () => false).konflikte).toEqual([]);
    const d0 = (await db.loadJson<CrmBestand>('crm'))!.chancen[0] as unknown as Record<string, unknown>;
    expect(laeufe[1].zusammen!.verweise[0].nachher).toBe(fingerabdruck(d0));
    expect(laeufe[1].zusammen!.behalten).toBe(paare.get(alteId(52)));
  });

  it('Sperrliste und Grabsteine bleiben gültig (Merkmale, nicht Kennung)', async () => {
    const { sperrlisteLaden, sperrPruefer } = await import('@/lib/crm/sperrliste');
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const k90 = kontakte.find(k => k.id === paare.get(alteId(90)))!;
    expect(sperrPruefer(await sperrlisteLaden())(k90)).toBe(true);
    const { grabsteineLesen, grabsteinTrifft } = await import('@/lib/datenschutz/grabsteine');
    const g = await grabsteineLesen();
    // Ein Restore von vor der Löschung brächte die Person mit ihrer alten Kennung — der Grabstein erkennt sie weiter.
    expect(grabsteinTrifft(g, { id: 'c-geloeschtfrueherexampleinvalid-zz', vorname: 'Testa', nachname: 'Frueher' } as Kontakt)).toBeTruthy();
    expect(grabsteinTrifft(g, { id: 'c-irgendwas-1', vorname: 'X', nachname: 'Y', email: 'testa.frueher@example.invalid' } as Kontakt)).toBeTruthy();
  });

  it('alte Links leiten weiter (?k=, ?kontakt=) — andere Parameter bleiben, fremde Kennungen bleiben unberührt', async () => {
    const { aliasWeiterleitung, kennungAufloesen } = await import('@/lib/crm/kennung-alias');
    const neu = paare.get(alteId(3))!;
    expect(await kennungAufloesen(alteId(3))).toBe(neu);
    expect(await kennungAufloesen(neu)).toBeNull();
    expect(await kennungAufloesen('ch0')).toBeNull();
    expect(await aliasWeiterleitung('/os/markttraktion', { s: 'kontakte', a: 'akte', k: alteId(3), t: 'aktivitaeten' })).toBe(`/os/markttraktion?s=kontakte&a=akte&k=${neu}&t=aktivitaeten`);
    expect(await aliasWeiterleitung('/os/markttraktion', { s: 'angebot', kontakt: alteId(3), deal: 'ch0' })).toBe(`/os/markttraktion?s=angebot&kontakt=${neu}&deal=ch0`);
    expect(await aliasWeiterleitung('/os/markttraktion', { s: 'kontakte', k: neu })).toBeNull();
  });

  it('Art. 17 einer umgezogenen Person: Grabstein auch für die alte Kennung, Weiterleitung raus', async () => {
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    const neu = paare.get(alteId(99))!;
    const b = await personEntfernen(neu, undefined, { protokoll: { datum: '2026-09-29', grund: 'Art. 17', von: 'kevin' }, person: 'kevin' });
    expect(b.vollstaendig).toBe(true);
    const { grabsteineLesen, grabsteinTrifft } = await import('@/lib/datenschutz/grabsteine');
    // Restore von VOR dem Umzug: alte Kennung, (angenommen) ohne Merkmale — der Grabstein der alten Kennung trifft.
    expect(grabsteinTrifft(await grabsteineLesen(), { id: alteId(99), vorname: '', nachname: '' } as Kontakt)).toBeTruthy();
    const { aliasLaden } = await import('@/lib/crm/kennung-alias');
    expect((await aliasLaden(HAUS)).eintraege.some(e => e.alt === alteId(99) || e.neu === neu)).toBe(false);
    expect(await alles(/^(konten|crm-sperrliste--.*|crm-loeschprotokoll)$/)).not.toContain(mail(99));
  });

  it('Rückweg nach einer Änderung → 409 mit Grund, nichts angefasst', async () => {
    // Die gelöschte Person (vorheriger Test) zählt schon als „seitdem gelöscht“.
    const r = await aufruf('rueckweg');
    expect(r.status).toBe(409);
    const d = await r.json() as { fehler: string; gruende: string[] };
    expect(d.gruende.join(' ')).toMatch(/gelöscht oder zusammengeführt/);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.every(k => UUID.test(k.id))).toBe(true);
  });

  it('Rückweg ohne spätere Änderungen: derselbe Stand wie vor dem Umzug; neue Kennungen leiten zurück', async () => {
    await welt();
    const vorher = await alles(/^(konten|kennung-alias--.*|absichten--.*|aenderungsprotokoll--.*)$/);
    expect((await aufruf('ausfuehren')).status).toBe(200);
    const v = await umzug.umzugVorschau();
    expect(v.rueckweg).toEqual({ moeglich: true, gruende: [] });
    const { aliasLaden, kennungAufloesen } = await import('@/lib/crm/kennung-alias');
    const neu0 = (await aliasLaden(HAUS)).eintraege.find(e => e.alt === alteId(0))!.neu;
    const r = await aufruf('rueckweg');
    expect(r.status).toBe(200);
    // Protokoll-Fingerabdrücke: zurück auf die alte Kennung (das Protokoll selbst bekommt neue Zeilen „Kennung geändert“).
    const { protokollKennung } = await import('@/lib/store/aenderungsprotokoll');
    expect(JSON.stringify(await db.loadJson(`aenderungsprotokoll--${HAUS}--2026-09`))).toContain(protokollKennung(alteId(70)));
    const nachher = await alles(/^(konten|kennung-alias--.*|absichten--.*|aenderungsprotokoll--.*)$/);
    expect(nachher).toBe(vorher);
    expect(await kennungAufloesen(neu0)).toBe(alteId(0));
    expect(await kennungAufloesen(alteId(0))).toBeNull();
    // Ein zweiter Rückweg geht nicht; ein neuer Umzug schon.
    expect((await aufruf('rueckweg')).status).toBe(409);
    const v2 = await umzug.umzugVorschau();
    expect(v2.anzahl).toBe(N);
    expect(v2.letzter?.art).toBe('rueckweg');
  });

  for (const [wann, schritt] of [['nachAbhaken', 'archiv'], ['vorAbhaken', 'crm'], ['nachAbhaken', 'tasks'], ['vorAbhaken', 'weitere'], ['nachAbhaken', 'fingerabdruecke'], ['vorAbhaken', 'kartei'], ['nachAbhaken', 'kartei'], ['vorAbhaken', 'vermerk']] as const) {
    it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken von „${schritt}“ → Wiederaufnahme vollendet den Umzug`, async () => {
      await welt();
      const ab = await import('@/lib/store/absichten');
      ab.absichtTest[wann] = (art, s) => { if (art === 'kennungen-umzug' && s === schritt) throw new ab.TestAbbruch(s); };
      expect((await aufruf('ausfuehren')).status).toBe(500);
      ab.absichtTest[wann] = null;
      const v = await umzug.umzugVorschau();
      expect(v.offen).not.toBeNull();
      const fort = await import('@/lib/store/absichten-fortsetzen');
      expect((await fort.offeneFertigstellen()).fertig).toBe(1);
      const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
      expect(kontakte.every(k => UUID.test(k.id))).toBe(true);
      expect(await alteKennungenIn()).toEqual([]);
      const { aliasLaden } = await import('@/lib/crm/kennung-alias');
      const a = await aliasLaden(HAUS);
      expect(a.eintraege).toHaveLength(N);
      const ids = new Set(kontakte.map(k => k.id));
      // Jeder Verweis zeigt auf einen existierenden Kontakt.
      const crm = (await db.loadJson<CrmBestand>('crm'))!;
      expect(crm.chancen.flatMap(c => c.kontaktIds).every(id => ids.has(id))).toBe(true);
      expect(a.umzuege?.at(-1)?.status).toBe('fertig');
      expect((await umzug.umzugVorschau()).rueckweg.moeglich).toBe(true);
    });
  }
});

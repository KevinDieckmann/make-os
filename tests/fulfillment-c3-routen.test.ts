// ─── Fulfillment C3 · Analyse-Strecke über die Routen (10.10.; FULFILLMENT_KONZEPT.md Abschnitt 11 „Wächter C3“, 12) ─────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), nachgebautes Modell (askText/askWithSearch) und nachgebautes Netz — kein echter Aufruf.
//   · Sicht X bekommt nichts aus Y: fremder Haushalt/Testkunde 403, Dienstweg schreibt nie, Sicht Privat 403, Privat-Mandat 400,
//     Personenteil für „nur Business“ 403 (Rest sichtbar), Leseteil nur die auslösende Person (andere 404), ZOE ohne `mitPersonen` ohne Personenteil
//   · kein Lauf ohne Klick (Morgenlauf startet nie), zu niedrige Bestätigung → 409 `kostenRueckfrage`, ≤ 2 laufend (429), ≤ 3 je Agent (4. nur mit Grund),
//     Pacht 10 Minuten → „abgebrochen“, Abhängigkeiten und F1 hart, F2 nur mit bestandener Prüfung
//   · KI-Kategorien ehrlich (Unternehmen ['crm','web'], A4 ohne Pseudonym, Zweck `fulfillment-a4-personen`); Web-Suche aus → ehrlich gesperrt
//   · Personenteil getrennt (Dossier-Antwort ohne Namen), Lese-Protokoll „personenrecherche“, Löschfrist entfernt Karten und lässt nur den Vermerk,
//     Art. 15 nennt die Karte; Wächter: kein Modul unter lib/fulfillment/** liest den Leseteil.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WURZEL = path.resolve(__dirname, '..');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-c3-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-fulfillment-c3', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'nur-test-schluessel', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

// ── nachgebautes Modell ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Block = { type: string; [k: string]: unknown };
const modell = vi.hoisted(() => ({ antworten: [] as Block[][], aufrufe: [] as { fn: string; opts: Record<string, unknown> }[] }));
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  const usage = { ein: 1000, aus: 200, cacheLesen: 0, cacheSchreiben: 0 };
  return {
    ...echt, hasAnthropicKey: () => true, guthabenLeer: () => false,
    askText: vi.fn(async (o: Record<string, unknown>) => {
      modell.aufrufe.push({ fn: 'askText', opts: o });
      const c = modell.antworten.shift() ?? [{ type: 'text', text: '{}' }];
      const tool = c.some(b => b.type === 'tool_use');
      return { ok: true, status: 200, text: tool ? '' : c.filter(b => b.type === 'text').map(b => String(b.text)).join(''), stopReason: tool ? 'tool_use' : 'end_turn', raw: { content: c }, usage };
    }),
    askWithSearch: vi.fn(async (o: Record<string, unknown>) => {
      modell.aufrufe.push({ fn: 'askWithSearch', opts: o });
      return {
        ok: true, status: 200, webUsed: true, usage,
        // Das Modell „behauptet“ zwei Adressen; in den echten Suchergebnissen steht nur eine — nur die wird erlaubt.
        text: JSON.stringify({ quellen: [{ url: 'https://presse.example/artikel', titel: 'Artikel' }, { url: 'https://erfunden.example/' }] }),
        raw: { content: [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://presse.example/artikel', title: 'Artikel' }] }, { type: 'text', text: 'ok' }] },
      };
    }),
  };
});

// ── nachgebaute Unterlagen (Schnittstelle von C2) ────────────────────────────────────────────────────────────────────────────────────────
const unterlagen = vi.hoisted(() => ({ liste: [] as Record<string, unknown>[], text: 'Handelsregisterauszug: Rechtsform GmbH, Sitz Musterstadt. Geschäftsführer: geboren am 01.02.1970, wohnhaft in Musterdorf.' }));
vi.mock('@/lib/fulfillment/kunde/server', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/fulfillment/kunde/server')>()),
  unterlagenFuer: async () => unterlagen.liste,
  formularAntwortenFuer: async () => [],
  unterlageText: async (_m: string, id: string) => (unterlagen.liste.some(u => u.id === id) ? { ok: true, text: unterlagen.text } : { ok: false, fehler: 'unbekannt' }),
}));

type H = (req: Request) => Promise<Response>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': p });
async function rufe(pfad: string, methode: 'GET' | 'POST', kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const T0 = '2026-09-01T08:00:00.000Z';
const mandat = (id: string, x: Record<string, unknown> = {}) => ({ id, kunde: 'Beispiel GmbH', firmaId: 'f-1', status: 'aktiv', kontaktIds: [], titel: 'Vertriebsaufbau', art: 'retainer', gesellschaft: 'ug', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: T0, ...x });

let db: typeof import('@/lib/store/local-db');
let web: typeof import('@/lib/fulfillment/analyse/web-lesen');
let lauf: typeof import('@/lib/fulfillment/analyse/lauf');
let sp: typeof import('@/lib/fulfillment/speicher');
const dossierVon = async (m = 'm-1') => (await sp.fulfillmentLesen('dossiers')).dossiers[m];
const stand = async (m = 'm-1') => (await rufe('fulfillment/dossier', 'GET', sitzung('pia'), undefined, `?m=${m}`)).j.stand as string;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  web = await import('@/lib/fulfillment/analyse/web-lesen');
  lauf = await import('@/lib/fulfillment/analyse/lauf');
  sp = await import('@/lib/fulfillment/speicher');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }), konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  await db.saveJson('crm', {
    firmen: [{ id: 'f-1', name: 'Beispiel GmbH', domain: 'beispiel-firma.example', branche: 'Software', stadt: 'Musterstadt', geaendert: T0 }],
    mandate: [mandat('m-1'), mandat('m-privat', { gesellschaft: 'kdc', titel: 'Privat-Einheit' }), mandat('m-alt', { status: 'beendet', ende: '2026-01-15', titel: 'Alt' })],
  });
  // Nachgebautes Netz: die Domain des Mandats und die Presse-Adresse sind öffentlich.
  web._netzSetzen({
    aufloesen: async h => (h === 'beispiel-firma.example' || h === 'presse.example' ? [{ address: '93.184.216.34', family: 4 }] : Promise.reject(new Error('ENOTFOUND'))),
    abrufen: async a => ({ status: a.url.pathname === '/robots.txt' ? 404 : 200, kopf: { 'content-type': 'text/html' }, bytes: Buffer.from(`<p>Seite ${a.url.pathname}: Wir entwickeln Beispiel-Software.</p>`) }),
  });
});
afterAll(async () => {
  web._netzSetzen(null);
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});
beforeEach(() => { modell.antworten = []; modell.aufrufe = []; });

describe('Sicht X bekommt nichts aus Y', () => {
  it('fremder Haushalt, Testkunde → 403; Dienstweg schreibt nie; Sicht Privat → 403; Privat-Mandat → 400', async () => {
    for (const p of ['gast', 'kunde']) {
      expect((await rufe('fulfillment/dossier', 'GET', sitzung(p), undefined, '?m=m-1')).status, p).toBe(403);
      expect((await rufe('fulfillment/analyse', 'POST', sitzung(p), { aktion: 'starten', mandatId: 'm-1', agent: 'a0', bestaetigtCent: 0 })).status, p).toBe(403);
      expect((await rufe('fulfillment/personen', 'GET', sitzung(p), undefined, '?m=m-1')).status, p).toBe(403);
    }
    expect((await rufe('fulfillment/dossier', 'POST', dienst('pia'), { aktion: 'anlegen', mandatId: 'm-1' })).status).toBe(403);
    expect((await rufe('fulfillment/analyse', 'POST', dienst('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a0', bestaetigtCent: 0 })).status).toBe(403);
    expect((await rufe('fulfillment/dossier', 'GET', sitzung('pia'), undefined, '?m=m-1&space=privat')).status).toBe(403);
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-privat' })).status).toBe(400);
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-gibts-nicht' })).status).toBe(404);
  });
});

describe('Die Strecke von A0 bis F2', () => {
  it('anlegen: Vorschlag aus der Firmenakte; nichts läuft von selbst', async () => {
    const vor = await rufe('fulfillment/dossier', 'GET', sitzung('pia'), undefined, '?m=m-1');
    expect(vor.j.dossier).toBeNull();
    expect(vor.j.vorschlag).toMatchObject({ firma: 'Beispiel GmbH', domains: ['beispiel-firma.example'], branche: 'Software', sitz: 'Musterstadt' });
    const a = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-1' });
    expect(a.status).toBe(200);
    expect((await dossierVon()).laeufe).toEqual([]);
    expect(modell.aufrufe).toEqual([]);
    // Die Lage: A0 bereit, A1 gesperrt (erst A0), alles mit Schätzung — und nichts gestartet.
    const l = await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1');
    const ag = (id: string) => (l.j.agenten as { id: string; zustand: string; schaetzung: { cent: number } }[]).find(x => x.id === id)!;
    expect(ag('a0').zustand).toBe('bereit');
    expect(ag('a1').zustand).toBe('gesperrt');
    expect(ag('a1').schaetzung.cent).toBeGreaterThan(0);
  });
  it('A0 (ohne Kosten): Gerüst und Aufgabe „Registerauszug ablegen“', async () => {
    const r = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a0', bestaetigtCent: 0, anfrageId: 'test-a0-0000001' });
    expect(r.status).toBe(200);
    const d = await dossierVon();
    expect(d.laeufe[0]).toMatchObject({ agent: 'a0', status: 'uebernommen' });
    expect(Object.keys(d.abschnitte)).toContain('unternehmen');
    const tasks = await db.loadJson<{ tasks: { id: string; title: string }[] }>('tasks');
    expect(tasks?.tasks.some(t => t.id === lauf.registerAufgabeId('m-1') && /Registerauszug/.test(t.title))).toBe(true);
    expect(modell.aufrufe).toEqual([]);
  });
  it('A1: zu niedrige Bestätigung → 409 kostenRueckfrage; dann Lauf mit ehrlichen Kategorien; nur echte Suchtreffer sind lesbar', async () => {
    const zuWenig = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a1', bestaetigtCent: 1 });
    expect(zuWenig.status).toBe(409);
    expect(zuWenig.j.kostenRueckfrage).toBe(true);
    const cent = (zuWenig.j.schaetzung as { cent: number }).cent;
    modell.antworten = [
      [{ type: 'tool_use', id: 't1', name: 'web_lesen', input: { url: 'https://beispiel-firma.example/' } }, { type: 'tool_use', id: 't2', name: 'web_lesen', input: { url: 'https://erfunden.example/' } }],
      [{ type: 'text', text: JSON.stringify({
        quellen: [{ ref: 'q1', url: 'https://beispiel-firma.example/', titel: 'Start' }, { ref: 'q2', url: 'https://erfunden.example/' }],
        abschnitte: { unternehmen: [{ text: 'Entwickelt Beispiel-Software.', art: 'fakt', quellen: ['q1'] }, { text: 'Rund 40 Mitarbeitende.', art: 'schaetzung', quellen: ['q2'] }] },
        steckbrief: { branche: { wert: 'Software', quelle: 'q1' } },
      }) }],
    ];
    const r = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a1', bestaetigtCent: cent, anfrageId: 'test-a1-0000001' });
    expect(r.status).toBe(202);
    await lauf.analyseWarten();
    const l = (await dossierVon()).laeufe.find(x => x.agent === 'a1')!;
    expect(l.status).toBe('fertig');
    expect(l.kostenCent).toBeGreaterThan(0);
    const e = l.ergebnis as { abschnitte: Record<string, { text: string }[]>; steckbrief: Record<string, { wert: string }> };
    expect(e.abschnitte.unternehmen.map(x => x.text)).toEqual(['Entwickelt Beispiel-Software.']);
    expect(e.abschnitte.fragen.map(x => x.text)).toEqual(['Ohne Beleg: Rund 40 Mitarbeitende.']);
    expect(e.steckbrief.branche.wert).toBe('Software');
    // KI ehrlich: Suche mit ['crm','web'] ohne Pseudonym, Schleife als Aufruf der Person mit ['crm','web'], Zweck je Agent
    const suche = modell.aufrufe.find(a => a.fn === 'askWithSearch')!.opts;
    expect(suche.ki).toEqual({ lauf: 'aufruf', person: 'pia', kategorien: ['crm', 'web'], pseudonym: false });
    const schritt = modell.aufrufe.find(a => a.fn === 'askText')!.opts;
    expect(schritt.ki).toMatchObject({ lauf: 'aufruf', person: 'pia' });
    expect((schritt.ki as { kategorien: string[] }).kategorien.sort()).toEqual(['crm', 'web']);
    expect(schritt.zweck).toBe('fulfillment-a1');
    // Das Werkzeug lief nur für die erlaubte Domain; die erfundene Adresse wurde abgelehnt (das Modell bekam einen Satz).
    const runde2 = (modell.aufrufe.filter(a => a.fn === 'askText')[1].opts.messages as { role: string; content: unknown }[]);
    const ergebnisse = JSON.stringify(runde2.at(-1));
    expect(ergebnisse).toContain('Wir entwickeln Beispiel-Software');
    expect(ergebnisse).toMatch(/nicht erlaubt/);
  });
  it('übernehmen (nur angehakte Abschnitte) → Prüfung → F2 nur, wenn bestanden', async () => {
    const l = (await dossierVon()).laeufe.find(x => x.agent === 'a1')!;
    const u = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'uebernehmen', mandatId: 'm-1', stand: await stand(), laufId: l.id, abschnitte: ['unternehmen'] });
    expect(u.status).toBe(200);
    expect((await dossierVon()).abschnitte.unternehmen?.aussagen.map(a => a.text)).toEqual(['Entwickelt Beispiel-Software.']);
    expect((await dossierVon()).abschnitte.fragen?.aussagen ?? []).toEqual([]);
    // fremder Stand → 409 (mit aktuellem Dossier)
    const alt = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'eingaben', mandatId: 'm-1', stand: 'veraltet', eingaben: { sitz: 'Woanders' } });
    expect(alt.status).toBe(409);
    expect(alt.j.dossier).toBeTruthy();
    // F2 vor der Prüfung → 409
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'f2', mandatId: 'm-1', stand: await stand() })).status).toBe(409);
    // Handeintrag ohne Beleg in „fazit“ geht nicht; mit Name einer Person → Prüfung rot (Datenschutz), überstimmen geht nicht
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'aussage-hand', mandatId: 'm-1', stand: await stand(), abschnitt: 'fazit', text: 'x', art: 'fakt' })).status).toBe(400);
    await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'aussage-hand', mandatId: 'm-1', stand: await stand(), abschnitt: 'fazit', text: 'Der Geschäftsführer ist erkrankt.', art: 'fakt', url: 'https://beispiel-firma.example/' });
    const p = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'pruefen', mandatId: 'm-1' });
    const pr = (p.j.dossier as { pruefung: { bestanden: boolean; befunde: { art: string; bezug?: string }[] } }).pruefung;
    expect(pr.bestanden).toBe(false);
    const i = pr.befunde.findIndex(b => b.art === 'dsgvo');
    expect(i).toBeGreaterThanOrEqual(0);
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'ueberstimmen', mandatId: 'm-1', stand: await stand(), index: i, grund: 'Wir wollen es trotzdem drin.' })).status).toBe(403);
    // Aussage entfernen → neu prüfen → F2
    await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'aussage-entfernen', mandatId: 'm-1', stand: await stand(), abschnitt: 'fazit', id: pr.befunde[i].bezug });
    const p2 = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'pruefen', mandatId: 'm-1' });
    expect((p2.j.dossier as { pruefung: { bestanden: boolean } }).pruefung.bestanden).toBe(true);
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'f2', mandatId: 'm-1', stand: await stand() })).status).toBe(200);
    expect((await dossierVon()).abschnitte.unternehmen?.status).toBe('geprueft');
    // Steckbrief → Firmenakte: nur der Schritt für den CRM-Schreibweg (mit Stand), geschrieben wird hier nichts
    const f = await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'firma-uebernehmen', mandatId: 'm-1', laufId: (await dossierVon()).laeufe.find(x => x.agent === 'a1')!.id, feld: 'branche' });
    expect(f.status).toBe(200);
    expect(f.j.op).toMatchObject({ liste: 'firmen', op: 'teil', id: 'f-1', felder: { branche: 'Software' } });
    expect(typeof (f.j.op as { stand?: string }).stand).toBe('string');
  });
});

describe('Grenzen der Läufe', () => {
  it('≤ 2 gleichzeitig (429), ≤ 3 je Agent (4. nur mit Grund), Pacht → abgebrochen, Abbrechen von Hand', async () => {
    const jetzt = new Date().toISOString();
    const laufend = (agent: 'a5' | 'a7') => ({ id: `al-test-${agent}`, agent, status: 'laeuft' as const, schaetzungCent: 1, bestaetigtCent: 1, grenzeCent: 2, laeuftSeit: jetzt, gestartetAm: jetzt, versuch: 1 });
    await sp.fulfillmentAendern('dossiers', d => ({ ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-1': { ...d.dossiers['m-1'], laeufe: [...d.dossiers['m-1'].laeufe, laufend('a5'), laufend('a7')] } } }, geaendert: ['m-1'] }));
    const s = (await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1')).j.agenten as { id: string; schaetzung: { cent: number } }[];
    const cent = s.find(x => x.id === 'a8')!.schaetzung.cent;
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a8', bestaetigtCent: cent })).status).toBe(429);
    // Abbrechen von Hand
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'abbrechen', mandatId: 'm-1', laufId: 'al-test-a5' })).status).toBe(200);
    // Pacht: der zweite ist „seit 11 Minuten“ still → angezeigt als abgebrochen, und der Morgenlauf schreibt es
    await sp.fulfillmentAendern('dossiers', d => ({ ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-1': { ...d.dossiers['m-1'], laeufe: d.dossiers['m-1'].laeufe.map(l => (l.id === 'al-test-a7' ? { ...l, laeuftSeit: new Date(Date.now() - 11 * 60_000).toISOString() } : l)) } } }, geaendert: ['m-1'] }));
    const lage = await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1');
    expect((lage.j.laeufe as { id: string; status: string }[]).find(l => l.id === 'al-test-a7')?.status).toBe('abgebrochen');
    const { fulfillmentMorgenlauf } = await import('@/lib/fulfillment/morgenlauf');
    await fulfillmentMorgenlauf('haus-ff', '2026-10-10');
    expect((await dossierVon()).laeufe.find(l => l.id === 'al-test-a7')?.status).toBe('abgebrochen');
    expect(modell.aufrufe).toEqual([]); // der Morgenlauf startet nie einen Lauf
    // ≤ 3 je Agent: drei A8-Läufe vorhanden → der vierte braucht einen Grund
    const drei = [1, 2, 3].map(i => ({ id: `al-test-a8-${i}`, agent: 'a8' as const, status: 'verworfen' as const, schaetzungCent: 1, bestaetigtCent: 1, grenzeCent: 2, versuch: i }));
    await sp.fulfillmentAendern('dossiers', d => ({ ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-1': { ...d.dossiers['m-1'], laeufe: [...d.dossiers['m-1'].laeufe, ...drei] } } }, geaendert: ['m-1'] }));
    const ohne = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a8', bestaetigtCent: cent });
    expect(ohne.status).toBe(409);
    expect(ohne.j.grundNoetig).toBe(true);
    modell.antworten = [[{ type: 'text', text: JSON.stringify({ quellen: [], abschnitte: {} }) }]];
    const mit = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a8', bestaetigtCent: cent, grund: 'Neue Leistungsseiten seit dem letzten Lauf.' });
    expect(mit.status).toBe(202);
    await lauf.analyseWarten();
    expect((await dossierVon()).laeufe.filter(l => l.agent === 'a8').at(-1)).toMatchObject({ versuch: 4, grund: 'Neue Leistungsseiten seit dem letzten Lauf.' });
  });
  it('Web-Suche aus → ehrlich gesperrt (nichts umgeschaltet); Tiefenbericht ohne Dienst → 409 mit Satz', async () => {
    const ke = await import('@/lib/datenschutz/ki-einstellungen');
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), websuche: false } }));
    const r = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a5', bestaetigtCent: 1000 });
    expect(r.status).toBe(409);
    expect(r.j.schalter).toBe('websuche');
    expect((await ke.kiSchalterFuer('pia')).websuche).toBe(false);
    await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), websuche: true } }));
    const tb = await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'tiefenbericht', mandatId: 'm-1', bestaetigtCent: 500 });
    expect(tb.status).toBe(409);
    expect(String(tb.j.fehler)).toMatch(/Tiefenbericht ist in dieser Instanz aus/);
    expect(modell.aufrufe).toEqual([]);
  });
});

describe('Personenteil, F1, Art. 14, Löschfrist', () => {
  it('A4 gesperrt bis F1 + Interessenabwägung; Karte im getrennten Personenteil; Dossier ohne Namen; „nur Business“ 403; Lese-Protokoll', async () => {
    const s = (await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1')).j.agenten as { id: string; zustand: string; schaetzung: { cent: number } }[];
    expect(s.find(x => x.id === 'a4')!.zustand).toBe('gesperrt');
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'f1', mandatId: 'm-1', stand: await stand(), umfang: ['a1', 'a2', 'a4', 'a8'], funktionen: ['Vertriebsleitung'] })).status).toBe(400);
    const { LIA_MUSTER } = await import('@/lib/fulfillment/analyse/dsgvo');
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'lia', mandatId: 'm-1', stand: await stand(), ...LIA_MUSTER })).status).toBe(200);
    expect((await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'f1', mandatId: 'm-1', stand: await stand(), umfang: ['a1', 'a2', 'a4', 'a8'], funktionen: ['Vertriebsleitung'], kundeBestaetigtAm: '2026-10-09', wie: 'kickoff' })).status).toBe(200);
    // A2 braucht den Registerauszug (Unterlage, freigegeben) — Geburtsdatum/Wohnort daraus kommen nie ins Dossier
    unterlagen.liste = [{ id: 'ud-reg1', mandatId: 'm-1', name: 'register.pdf', typ: 'application/pdf', groesse: 10, am: T0, herkunft: 'intern', zweck: 'register', status: 'freigegeben' }];
    const a2cent = ((await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1')).j.agenten as { id: string; schaetzung: { cent: number } }[]).find(x => x.id === 'a2')!.schaetzung.cent;
    modell.antworten = [
      [{ type: 'tool_use', id: 'u1', name: 'fall_unterlagen', input: { unterlage: 'ud-reg1' } }],
      [{ type: 'text', text: JSON.stringify({ quellen: [{ ref: 'r1', unterlage: 'ud-reg1' }], abschnitte: { unternehmen: [{ text: 'Rechtsform GmbH, Sitz Musterstadt.', art: 'fakt', quellen: ['r1'] }, { text: 'Geschäftsführer wohnhaft in Musterdorf.', art: 'fakt', quellen: ['r1'] }] } }) }],
    ];
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a2', bestaetigtCent: a2cent })).status).toBe(202);
    await lauf.analyseWarten();
    const a2 = (await dossierVon()).laeufe.filter(l => l.agent === 'a2').at(-1)!;
    expect(a2.status).toBe('fertig');
    expect(JSON.stringify(a2.ergebnis)).not.toMatch(/wohnhaft|Musterdorf/);
    expect((a2.ergebnis as { ausgelassen: string[] }).ausgelassen).toEqual(['Wohnort']);
    expect((modell.aufrufe.find(a => a.fn === 'askText')!.opts.ki as { kategorien: string[] }).kategorien).toEqual(['crm']);
    // A4 für die Funktion aus F1 — die Karte geht in den getrennten Personenteil
    const a4cent = ((await rufe('fulfillment/analyse', 'GET', sitzung('pia'), undefined, '?m=m-1')).j.agenten as { id: string; schaetzung: { cent: number } }[]).find(x => x.id === 'a4')!.schaetzung.cent;
    modell.aufrufe = [];
    modell.antworten = [[{ type: 'text', text: JSON.stringify({
      quellen: [{ ref: 'p1', url: 'https://presse.example/artikel' }],
      personen: [{ funktion: 'Vertriebsleitung', name: 'Erika Beispiel', identitaet: 'hoch', rolleSeit: '04/2022', werdegang: [{ text: 'Seit 2022 Vertriebsleitung.', art: 'fakt', quellen: ['p1'] }], themen: [{ text: 'Mutter von zwei Kindern.', art: 'fakt', quellen: ['p1'] }] }],
    }) }]];
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a4', bestaetigtCent: a4cent, funktion: 'Geschäftsführung' })).status).toBe(400);
    expect((await rufe('fulfillment/analyse', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-1', agent: 'a4', bestaetigtCent: a4cent, funktion: 'Vertriebsleitung' })).status).toBe(202);
    await lauf.analyseWarten();
    expect(modell.aufrufe.find(a => a.fn === 'askText')!.opts.zweck).toBe('fulfillment-a4-personen');
    expect(modell.aufrufe.find(a => a.fn === 'askWithSearch')!.opts.ki).toMatchObject({ kategorien: ['crm', 'web'], pseudonym: false });
    const karten = (await sp.fulfillmentLesen('personen')).karten;
    expect(karten).toHaveLength(1);
    expect(karten[0]).toMatchObject({ funktion: 'Vertriebsleitung', name: 'Erika Beispiel', status: 'entwurf', ausgelassen: ['Familie'] });
    expect(karten[0].art14.faelligAm).toBeTruthy();
    // Dossier-Antwort ohne Namen — auch für die Inhaberin; der Lauf trägt nur Zähler
    const d = await rufe('fulfillment/dossier', 'GET', sitzung('pia'), undefined, '?m=m-1');
    expect(JSON.stringify(d.j)).not.toContain('Erika');
    expect(JSON.stringify(await dossierVon())).not.toContain('Erika');
    // Personenteil: Inhaberin und volles Mitglied ja, „nur Business“ nein (der Rest von Fulfillment ja)
    const pia = await rufe('fulfillment/personen', 'GET', sitzung('pia'), undefined, '?m=m-1');
    expect(pia.status).toBe(200);
    expect(JSON.stringify(pia.j)).toContain('Erika Beispiel');
    expect((pia.j.karten as { art14Text: string }[])[0].art14Text).toMatch(/Vertriebsleitung/);
    expect((await rufe('fulfillment/personen', 'GET', sitzung('olaf'), undefined, '?m=m-1')).status).toBe(200);
    expect((await rufe('fulfillment/personen', 'GET', sitzung('partnerin'), undefined, '?m=m-1')).status).toBe(403);
    expect((await rufe('fulfillment/dossier', 'GET', sitzung('partnerin'), undefined, '?m=m-1')).status).toBe(200);
    const { leseprotokollWarten, leseprotokollMonat } = await import('@/lib/store/leseprotokoll');
    await leseprotokollWarten();
    const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
    const eintraege = await leseprotokollMonat('haus-ff', monatBerlin(new Date()));
    expect(eintraege.some(e => e.bereich === 'personenrecherche' && e.person === 'pia' && (e.ids ?? []).length === 1 && !(e.ids ?? []).includes(karten[0].id))).toBe(true);
  });
  it('Karte prüfen, Art. 14 vermerken; ZOE ohne `mitPersonen` ohne Personenteil, nie den Leseteil', async () => {
    const pia = await rufe('fulfillment/personen', 'GET', sitzung('pia'), undefined, '?m=m-1');
    const k = (pia.j.karten as { id: string; stand: string }[])[0];
    const p = await rufe('fulfillment/personen', 'POST', sitzung('pia'), { aktion: 'pruefen', mandatId: 'm-1', id: k.id, stand: k.stand });
    expect(p.status).toBe(200);
    const k2 = (p.j.karten as { id: string; stand: string; status: string }[])[0];
    expect(k2.status).toBe('geprueft');
    expect((await rufe('fulfillment/personen', 'POST', sitzung('partnerin'), { aktion: 'loeschen', mandatId: 'm-1', id: k.id, stand: k2.stand })).status).toBe(403);
    const a = await rufe('fulfillment/personen', 'POST', sitzung('pia'), { aktion: 'art14', mandatId: 'm-1', id: k.id, stand: k2.stand, gegebenAm: '2026-10-09', wie: 'kickoff' });
    expect((a.j.karten as { art14Stand: { stufe: string } }[])[0].art14Stand.stufe).toBe('gegeben');
    // Leseteil-Verweis setzen (wie nach einem Tiefenbericht) — er darf nie im ZOE-Werkzeug auftauchen
    await sp.fulfillmentAendern('dossiers', d => ({ ok: true, datei: { ...d, dossiers: { ...d.dossiers, 'm-1': { ...d.dossiers['m-1'], leseteil: { id: 'tb-geheim-1', person: 'pia', gestartetAm: T0 } } } }, geaendert: ['m-1'] }));
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const ohne = String(((await WERKZEUGE.fulfillment_lage.lauf({ mandat: 'm-1' }, 'http://test', 'pia')) as { meldung: string }).meldung);
    expect(ohne).toContain('Entwickelt Beispiel-Software.');
    expect(ohne).not.toContain('Erika');
    expect(ohne).not.toContain('tb-geheim');
    const mit = String(((await WERKZEUGE.fulfillment_lage.lauf({ mandat: 'm-1', mitPersonen: true }, 'http://test', 'pia')) as { meldung: string }).meldung);
    expect(mit).toContain('Erika Beispiel');
    const partnerin = String(((await WERKZEUGE.fulfillment_lage.lauf({ mandat: 'm-1', mitPersonen: true }, 'http://test', 'partnerin')) as { meldung: string }).meldung);
    expect(partnerin).not.toContain('Erika');
    expect(partnerin).toMatch(/nicht freigegeben/);
    expect(String(((await WERKZEUGE.fulfillment_lage.lauf({ mandat: 'm-1' }, 'http://test', 'gast')) as { meldung: string }).meldung)).toMatch(/Nicht ausgeführt/);
  });
  it('Leseteil nur für die auslösende Person (andere 404, Dienstweg 401)', async () => {
    await db.saveJson('ki-tiefenbericht--pia', { berichte: [{ id: 'tb-geheim-1', frage: 'Markt?', modell: 'deep-research-preview-04-2026', status: 'fertig', gestartet: new Date().toISOString(), fertigAm: new Date().toISOString(), bericht: { text: 'Der Bericht.', quellen: [{ titel: 'Q', url: 'https://presse.example/artikel' }], suchbegriffe: ['markt'], suchvorschlaegeHtml: '<div>Vorschläge</div>' }, kosten: { euroCent: 200, geschaetzt: true } }] });
    const pia = await rufe('fulfillment/dossier/leseteil', 'GET', sitzung('pia'), undefined, '?m=m-1');
    expect(pia.status).toBe(200);
    expect(pia.j.leseteil).toMatchObject({ status: 'fertig', text: 'Der Bericht.', suchvorschlaegeHtml: '<div>Vorschläge</div>' });
    expect((await rufe('fulfillment/dossier/leseteil', 'GET', sitzung('olaf'), undefined, '?m=m-1')).status).toBe(404);
    expect((await rufe('fulfillment/dossier/leseteil', 'GET', dienst('pia'), undefined, '?m=m-1')).status).toBe(401);
    const fremd = await rufe('fulfillment/dossier', 'GET', sitzung('olaf'), undefined, '?m=m-1');
    expect((fremd.j.dossier as { leseteil: unknown }).leseteil).toEqual({ gestartetAm: T0, eigen: false });
  });
  it('Morgenlauf: Art.-14-Hinweis nur als Vorschlag im Stapel; Freigabe legt eine Aufgabe an', async () => {
    // eine zweite Karte, deren Uhr bald abläuft
    const { personenAnwenden } = await import('@/lib/fulfillment/analyse/personen-anwenden');
    const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const vor26 = new Date(Date.now() - 26 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const { einMonatNach } = await import('@/lib/datenschutz/art14');
    await sp.fulfillmentAendern('personen', p => personenAnwenden(p, { op: 'karte-neu', karte: { id: 'pp-bald', mandatId: 'm-1', funktion: 'Geschäftsführung', name: 'Max Beispiel', werdegang: [], themen: [], auftritte: [], aufhaenger: [], identitaet: 'mittel', ausgelassen: [], quellen: [], art14: { faelligAm: einMonatNach(vor26) }, erfasstAm: vor26, status: 'entwurf' } }, { person: 'pia', heute, standVon: () => '' }));
    const { fulfillmentMorgenlauf } = await import('@/lib/fulfillment/morgenlauf');
    const r = await fulfillmentMorgenlauf('haus-ff', heute);
    expect(r.vorschlaege).toBe(1);
    expect((await fulfillmentMorgenlauf('haus-ff', heute)).vorschlaege).toBe(0); // idempotent
    const stapel = await import('@/lib/zoe/stapel');
    const v = (await stapel.lies('offen')).find(x => x.bezug?.id === 'a:art14:pp-bald')!;
    expect(v.titel).toContain('Geschäftsführung');
    expect(JSON.stringify(v)).not.toContain('Max Beispiel');
    const { FULFILLMENT_STAPEL_ART } = await import('@/lib/fulfillment/stapel');
    const f = await FULFILLMENT_STAPEL_ART.freigeben(v, 'pia', {});
    expect(f.ok).toBe(true);
    const tasks = await db.loadJson<{ tasks: { id: string; title: string; dueDate?: string }[] }>('tasks');
    expect(tasks?.tasks.find(t => t.id.startsWith('ff-art14-'))?.title).toBe('Art.-14-Hinweis geben: Geschäftsführung');
    expect(modell.aufrufe).toEqual([]);
  });
  it('Art. 15 nennt die Karte; Löschfrist: Mandatsende + 90 Tage entfernt Karten, am Dossier bleibt nur der Vermerk', async () => {
    const { merkmaleVon } = await import('@/lib/crm/person-weitere');
    const { fulfillmentAuskunft } = await import('@/lib/fulfillment/auskunft');
    const a = await fulfillmentAuskunft(merkmaleVon('c-erika', { vorname: 'Erika', nachname: 'Beispiel' }));
    expect(a.personen.map(p => p.funktion)).toEqual(['Vertriebsleitung']);
    // Ein beendetes Mandat mit Dossier und Karte: Ende 2026-01-15 → 90 Tage später weg
    await rufe('fulfillment/dossier', 'POST', sitzung('pia'), { aktion: 'anlegen', mandatId: 'm-alt' });
    const { personenAnwenden } = await import('@/lib/fulfillment/analyse/personen-anwenden');
    await sp.fulfillmentAendern('personen', p => personenAnwenden(p, { op: 'karte-neu', karte: { id: 'pp-alt', mandatId: 'm-alt', funktion: 'Geschäftsführung', name: 'Alt Beispiel', werdegang: [], themen: [], auftritte: [], aufhaenger: [], identitaet: 'hoch', ausgelassen: [], quellen: [], art14: { faelligAm: '2026-02-15' }, erfasstAm: '2026-01-10', status: 'geprueft' } }, { person: 'pia', heute: '2026-01-10', standVon: () => '' }));
    const { fulfillmentFristen } = await import('@/lib/fulfillment/fristen-server');
    const vorher = await fulfillmentFristen({ heute: '2026-04-14', jetzt: new Date('2026-04-14T05:00:00Z'), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } });
    expect(vorher['fulfillment-personen'] ?? 0).toBe(0);
    const r = await fulfillmentFristen({ heute: '2026-04-15', jetzt: new Date('2026-04-15T05:00:00Z'), fristen: { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 } });
    expect(r['fulfillment-personen']).toBe(1);
    expect((await sp.fulfillmentLesen('personen')).karten.some(k => k.id === 'pp-alt')).toBe(false);
    expect((await sp.fulfillmentLesen('personen')).karten.some(k => k.mandatId === 'm-1')).toBe(true);
    const alt = await dossierVon('m-alt');
    expect(alt.personenGeloescht).toEqual([{ am: '2026-04-15', anzahl: 1 }]);
    expect(JSON.stringify(alt)).not.toContain('Alt Beispiel');
  });
});

describe('Wächter im Code', () => {
  const dateien = (dir: string): string[] => readdirSync(path.join(WURZEL, dir)).flatMap(n => { const rel = `${dir}/${n}`; return statSync(path.join(WURZEL, rel)).isDirectory() ? dateien(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : []; });
  it('nur die Leseteil-Route liest lib/ki/leseteil — kein Modul unter lib/fulfillment/** oder components/os/fulfillment/**', () => {
    const treffer = [...dateien('lib'), ...dateien('app'), ...dateien('components')].filter(f => !f.startsWith('lib/ki/') && /lib\/ki\/leseteil/.test(readFileSync(path.join(WURZEL, f), 'utf8')));
    expect(treffer).toEqual(['app/api/fulfillment/dossier/leseteil/route.ts']);
  });
  it('kein Lauf ohne Klick: Morgenlauf, Fristen und Takt kennen den Start nicht', () => {
    for (const f of ['lib/fulfillment/analyse/server.ts', 'lib/fulfillment/morgenlauf.ts', 'lib/fulfillment/fristen-server.ts']) expect(readFileSync(path.join(WURZEL, f), 'utf8'), f).not.toMatch(/laufStarten|tiefenberichtStarten|kiTiefenberichtStarten/);
    const starter = [...dateien('lib'), ...dateien('app')].filter(f => /laufStarten\(/.test(readFileSync(path.join(WURZEL, f), 'utf8')));
    expect(starter.sort()).toEqual(['app/api/fulfillment/analyse/route.ts', 'lib/fulfillment/analyse/lauf.ts']);
  });
  it('die Analyse-Werkzeuge bietet nur der Analyse-Handler an — nie ZOE, nie die Heads', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const { KATALOG } = await import('@/lib/agenten/katalog');
    for (const w of ['web_lesen', 'fall_unterlagen', 'dossier_teile']) {
      expect(WERKZEUGE[w], w).toBeUndefined();
      expect(KATALOG.some(h => h.werkzeuge.includes(w) || (h.mitarbeiter ?? []).some(m => m.werkzeuge.includes(w))), w).toBe(false);
    }
    const { vertragVon } = await import('@/lib/werkzeuge/register');
    expect(vertragVon('web_lesen')).toMatchObject({ rechteklasse: 'lesen', bereich: 'business', fremd: 'web', gekapselt: true, kategorie: 'web' });
    expect(vertragVon('fulfillment_lage')).toMatchObject({ rechteklasse: 'lesen', bereich: 'business', risiko: 'frei', gekapselt: true, kategorie: 'crm' });
  });
});

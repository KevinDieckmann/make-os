// ─── Prozesse · Läufe-Ansicht, Testfälle, Scharf-Dialog, Webhook, Heute, KI nicht eingerichtet — Server und Routen von Ende zu Ende (22.10.) ───────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell (kein KI-Schlüssel). Geprüft:
//   · Inhalte eines Laufs LIVE nur mit den Rechten der Person: fremde „nur ich“-Aufgabe → „nicht für dich“, fremder Vorschlag → nicht sichtbar, Fall einer
//     eingeschränkten Person (Art. 18) → „eingeschränkter Kontakt“ ohne Namen; der Lauf selbst trägt nur Kennungen; Dienstweg bekommt keine Inhalte
//   · „Als Testfall übernehmen“: Fall + erwartete Statusfolge (nur Kennungen), „alle prüfen“ schreibt nichts und erkennt eine Änderung am Entwurf; Grenze → 413
//   · Scharf-Dialog: Vorschau mit Aufschlüsselung je Modellstufe, ohne Budget bei Agenten-Schritten 400, mit Budget scharf (Einstellung, Verlauf)
//   · Webhook-Schlüssel genau einmal: nur in der Antwort des Anlegens, nie in GET der Werkstatt bzw. der Läufe; neuer Schlüssel ersetzt den alten
//   · Heute-Zeile nur in der Sicht Business (Privat 403)
//   · Agenten-Schritt ohne KI-Schlüssel: sofort angehalten (kein Versuch, auch mit Fehlerkante), EINE Glocke „KI nicht eingerichtet“
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag, AgentSchritt } from '@/lib/prozesse/definition';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, konto, PZ, PZ2, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-laeufe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-laeufe';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-pz';
const PZ3 = 'pz-00000000-0000-4000-8000-000000000003';
const PZ4 = 'pz-00000000-0000-4000-8000-000000000004';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), 'content-type': 'application/json' });

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

const WEG: ProzessDefinition = definition([
  schritt(10, 'Anrufen', 1),
  schritt(12, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) } }),
  schritt(13, 'Fertig', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(20, 'Abgesagt', 4, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
], { laeuftAls: 'pia' });
const AGENT: AgentSchritt = { wer: { art: 'head', headId: 'sales' }, auftrag: 'Nächsten Schritt vorschlagen', modell: 'schnell', budgetCent: 30, gedaechtnis: { brain: false, akte: true }, werkzeuge: [], eingabe: [], ausgabe: [], warumKeineRegel: 'Die Einschätzung braucht Sprachverständnis — eine feste Regel reicht hier nicht.' };
// Mit Fehlerkante: auch dann hält „KI nicht eingerichtet“ an (die Kante ist für Fehler des Falls, nicht der Einrichtung).
const AG = definition([
  schritt(40, 'Einschätzen', 1, { form: 'agent', agent: AGENT, zweige: { fehler: fk(42) } }),
  schritt(41, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(42, 'Von Hand weiter', 3),
], { laeuftAls: 'pia', eigner: 'konto-pia', startKriterium: 'Deal ist in der Qualifizierung', endKriterium: 'Einschätzung ist übernommen' });

const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status'] = 'aktiv', versionen = 1): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: Array.from({ length: versionen }, (_, i) => ({ nr: i + 1, name: `v${i + 1}`, am: J, von: 'pia', definition: { ...def, id } })),
});
const scharf = (budgetCent = 500) => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });

async function laeufe(): Promise<LaeufeDatei> { return S.laeufeLesen(H); }
async function lauf(id: string): Promise<ProzessLauf> { return (await laeufe()).laeufe.find(l => l.id === id)!; }
const laeufeGet = async (kopf: Record<string, string>, suche: string) => {
  const { GET } = await import('@/app/api/prozesse/laeufe/route');
  const r = await GET(new Request(`http://test/api/prozesse/laeufe${suche}`, { headers: kopf }));
  return { status: r.status, text: await r.text() };
};
const laeufePost = async (kopf: Record<string, string>, body: Record<string, unknown>) => {
  const { POST } = await import('@/app/api/prozesse/laeufe/route');
  const r = await POST(new Request('http://test/api/prozesse/laeufe', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, unknown> };
};
const werkstatt = async (kopf: Record<string, string>, body?: Record<string, unknown>, suche = '') => {
  const { GET, POST } = await import('@/app/api/prozesse/werkstatt/route');
  const r = body ? await POST(new Request('http://test/api/prozesse/werkstatt', { method: 'POST', headers: kopf, body: JSON.stringify(body) })) : await GET(new Request(`http://test/api/prozesse/werkstatt${suche}`, { headers: kopf }));
  return { status: r.status, text: await r.text() };
};
function alleDateien(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) geh(p); else raus[path.relative(ordner, p)] = readFileSync(p, 'utf8'); } };
  geh(ordner);
  return raus;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: H }),
    konto('k2', 'olaf', 'mitglied', { haushalt: H }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const deal = (id: string, kontakt: string) => ({ id, titel: `Probe ${id}`, kontaktIds: [kontakt], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J });
  await db.saveJson('crm', { ...leererBestand(), chancen: [deal('ch-probe', 'c-erika'), deal('ch-test', 'c-erika'), deal('ch-agent', 'c-erika'), deal('ch-agent2', 'c-erika')] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' },
    { id: 'c-gesperrt', vorname: 'Max', nachname: 'Muster', email: 'max@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } },
  ] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const WH = definition([schritt(50, 'Anfrage prüfen', 1)], { laeuftAls: 'pia' });
  WH.knoten = WH.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: { art: 'webhook' as const, felder: [{ id: 'thema', art: 'text' as const }] }, katalog: { id: 'ausloeser.webhook' } } : k));
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ, WEG), eintrag(PZ2, AG, 'probelauf'), eintrag(PZ3, AG), eintrag(PZ4, WH)] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ]: scharf(), [PZ3]: scharf(), [PZ4]: scharf() } });
  S = await import('@/lib/prozesse/lauf-server');
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Inhalte eines Laufs — live und nur mit den Rechten der Person', () => {
  let id = '';
  let aufgabe = '';
  it('der Lauf trägt nur Kennungen; die Inhalte kommen live: Aufgabe (bei pia — „wartet auf dich“), Fall-Name, Links', async () => {
    const r = await S.laufVonHand({ prozessId: PZ, person: 'olaf', fall: { art: 'deal', id: 'ch-probe' }, anfrage: 'anfrage-laeufe-0001' });
    if (!r.ok) throw new Error(r.fehler);
    id = r.lauf.id;
    aufgabe = r.lauf.wartet!.wirkung!;
    const ein = await laeufeGet(sitzung('pia'), `?lauf=${id}`);
    expect(ein.status).toBe(200);
    const j = JSON.parse(ein.text) as { schritte: { knoten: string; status: string }[] };
    expect(j.schritte.map(s => s.knoten)).toEqual([fk(3), fk(10)]);
    for (const x of ['Erika', 'example.invalid', 'Anrufen']) expect(ein.text).not.toContain(x);
    const pia = JSON.parse((await laeufeGet(sitzung('pia'), `?lauf=${id}&inhalte=1`)).text) as { fall: { titel: string; sichtbar: boolean }; wirkungen: Record<string, { sichtbar: boolean; mir?: boolean; titel?: string; link?: string }> };
    expect(pia.fall).toMatchObject({ sichtbar: true, titel: 'Probe ch-probe' });
    expect(pia.wirkungen[aufgabe]).toMatchObject({ sichtbar: true, mir: true, titel: 'Anrufen' });
    expect(pia.wirkungen[aufgabe].link).toContain(aufgabe);
    const olaf = JSON.parse((await laeufeGet(sitzung('olaf'), `?lauf=${id}&inhalte=1`)).text) as typeof pia;
    expect(olaf.wirkungen[aufgabe]).toMatchObject({ sichtbar: true });
    expect(olaf.wirkungen[aufgabe].mir).toBeUndefined();
  });
  it('eine „nur ich“-Aufgabe einer anderen Person zeigt KEINEN Titel — „liegt bei einer anderen Person“', async () => {
    await db.updateJson<{ tasks: Record<string, unknown>[] }>('tasks', cur => ({ ...cur!, tasks: cur!.tasks.map(t => (t.id === aufgabe ? { ...t, sichtbarkeit: 'nur-ich', angelegtVon: 'pia' } : t)) }));
    const olaf = await laeufeGet(sitzung('olaf'), `?lauf=${id}&inhalte=1`);
    const j = JSON.parse(olaf.text) as { wirkungen: Record<string, { sichtbar: boolean; grund?: string; titel?: string }> };
    expect(j.wirkungen[aufgabe]).toEqual({ art: 'aufgabe', id: aufgabe, sichtbar: false, grund: 'nicht-fuer-dich' });
    expect(olaf.text).not.toContain('Anrufen');
    const pia = JSON.parse((await laeufeGet(sitzung('pia'), `?lauf=${id}&inhalte=1`)).text) as typeof j;
    expect(pia.wirkungen[aufgabe].sichtbar).toBe(true);
  });
  it('Fall einer eingeschränkten Person (Art. 18) → „eingeschränkt“, ohne Namen; Vorschlag einer anderen Person → nicht sichtbar; Dienstweg → 403', async () => {
    const { lege } = await import('@/lib/zoe/stapel');
    const v = await lege({ werkzeug: 'prozess_schritt', gruppe: 'business', titel: 'Angebot an Max Muster freigeben', nachher: 'Text', eingabe: {}, person: 'pia', quelle: 'lauf', bezug: { art: 'prozess', id: 'pl-probe-v' } });
    const L = 'pl-00000000-0000-4000-8000-0000000000aa';
    await S.laeufeAendern(d => ({ datei: { ...d, laeufe: [...d.laeufe, {
      id: L, prozessId: PZ, version: 1, fall: { art: 'lead', id: 'c-gesperrt' }, bereich: 'sales', schluessel: `${PZ}|lead:c-gesperrt`, durchgang: 1, modus: 'scharf', status: 'wartet', person: 'pia',
      ausloeser: { art: 'hand' }, tiefe: 0, daten: {}, start: J, geaendert: J, aktuell: fk(12), wartet: { knoten: fk(12), art: 'freigabe', wirkung: v.id },
      schritte: [{ knoten: fk(12), status: 'wartet', ab: J, wirkung: [{ art: 'vorschlag', id: v.id }] }], kostenCent: 0,
    } as ProzessLauf] }, r: null }), H);
    const olaf = await laeufeGet(sitzung('olaf'), `?lauf=${L}&inhalte=1`);
    const j = JSON.parse(olaf.text) as { fall: { sichtbar: boolean; grund: string }; wirkungen: Record<string, { sichtbar: boolean }> };
    expect(j.fall).toMatchObject({ sichtbar: false, grund: 'eingeschraenkt' });
    expect(j.wirkungen[v.id]).toMatchObject({ sichtbar: false, grund: 'nicht-fuer-dich' });
    for (const x of ['Max', 'Muster', 'example.invalid']) expect(olaf.text).not.toContain(x);
    const pia = JSON.parse((await laeufeGet(sitzung('pia'), `?lauf=${L}&inhalte=1`)).text) as { fall: { grund: string }; wirkungen: Record<string, { sichtbar: boolean; mir?: boolean }> };
    expect(pia.fall.grund).toBe('eingeschraenkt');
    expect(pia.wirkungen[v.id]).toMatchObject({ sichtbar: true, mir: true });
    expect((await laeufeGet(dienst('pia'), `?lauf=${L}&inhalte=1`)).status).toBe(403);
    expect((await laeufeGet(sitzung('gast'), `?lauf=${L}&inhalte=1`)).status).toBe(403);
  });
});

describe('Testfälle — „Als Testfall übernehmen“, „alle prüfen“', () => {
  let laufId = '';
  let test = '';
  it('aus einem Lauf: Fall-Kennung und erwartete Statusfolge — keine Namen, kein „von“', async () => {
    const r = await S.laufVonHand({ prozessId: PZ, person: 'pia', fall: { art: 'deal', id: 'ch-test' }, anfrage: 'anfrage-laeufe-0002' });
    if (!r.ok) throw new Error(r.fehler);
    laufId = r.lauf.id;
    expect((await laeufePost(dienst('pia'), { aktion: 'testfall', prozess: PZ, wie: 'anlegen', aus: laufId })).status).toBe(403);
    const a = await laeufePost(sitzung('olaf'), { aktion: 'testfall', prozess: PZ, wie: 'anlegen', aus: laufId });
    expect(a.status).toBe(200);
    const t = a.j.test as { id: string; nr: number; fall: { art: string; id: string }; erwartet: { knotenId: string; status: string }[]; aus: { lauf: string } };
    test = t.id;
    expect(t).toMatchObject({ nr: 1, fall: { art: 'deal', id: 'ch-test' }, aus: { lauf: laufId } });
    expect(t.erwartet.map(x => x.knotenId)).toEqual([fk(3), fk(10), fk(12), fk(13)]);
    expect(t).not.toHaveProperty('von');
    const liste = await laeufeGet(sitzung('pia'), `?prozess=${PZ}`);
    const j = JSON.parse(liste.text) as { tests: { id: string }[] };
    expect(j.tests.map(x => x.id)).toEqual([test]);
    for (const x of ['Erika', 'example.invalid']) expect(liste.text).not.toContain(x);
  });
  it('„alle prüfen“ schreibt nichts; gleicher Entwurf → gleiche Folge; ein geänderter Entwurf zeigt die Änderung', async () => {
    const vorher = alleDateien();
    const g = await laeufePost(sitzung('pia'), { aktion: 'tests-pruefen', prozess: PZ, quelle: 'entwurf' });
    expect(g.status).toBe(200);
    expect(alleDateien()).toEqual(vorher);
    const e = (g.j.ergebnisse as { id: string; ok: boolean; ist: { knotenId: string; status: string }[] }[])[0];
    const { testVergleich } = await import('@/lib/prozesse/laeufe-ansicht');
    const t = (await laeufe()).prozesse[PZ].tests![0];
    expect(testVergleich(t.erwartet, e.ist as never).ok).toBe(true);
    // Entwurf ändern: die Raute fällt weg — „Passt es?“ und „Fertig“ werden nicht mehr erreicht.
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    await db.updateJson<{ prozesse: ProzessEintrag[] }>(prozesseBestand(H), cur => ({ ...cur!, prozesse: cur!.prozesse.map(p => (p.id === PZ ? { ...p, entwurf: { ...p.entwurf, knoten: p.entwurf.knoten.filter(k => k.id !== fk(12) && k.id !== fk(13) && k.id !== fk(20)) } } : p)) }));
    const g2 = await laeufePost(sitzung('pia'), { aktion: 'tests-pruefen', prozess: PZ, quelle: 'entwurf' });
    const e2 = (g2.j.ergebnisse as { ist: { knotenId: string; status: string }[] }[])[0];
    const v = testVergleich(t.erwartet, e2.ist as never);
    expect(v.ok).toBe(false);
    expect(v.weg).toEqual(expect.arrayContaining([fk(12), fk(13)]));
    // Die Version (unverändert) bleibt grün.
    const g3 = await laeufePost(sitzung('pia'), { aktion: 'tests-pruefen', prozess: PZ, quelle: 'version' });
    expect(testVergleich(t.erwartet, (g3.j.ergebnisse as { ist: never }[])[0].ist).ok).toBe(true);
  });
  it('mit dem Beispiel-Fall anlegen; löschen; höchstens 20 je Prozess (413, nie gekürzt)', async () => {
    const b = await laeufePost(sitzung('pia'), { aktion: 'testfall', prozess: PZ, wie: 'anlegen', fall: 'beispiel' });
    expect(b.status).toBe(200);
    expect((b.j.test as { fall: string; nr: number })).toMatchObject({ fall: 'beispiel', nr: 2 });
    expect((await laeufePost(sitzung('pia'), { aktion: 'testfall', prozess: PZ, wie: 'loeschen', id: (b.j.test as { id: string }).id })).status).toBe(200);
    await S.laeufeAendern(d => ({ datei: { ...d, prozesse: { ...d.prozesse, [PZ]: { ...d.prozesse[PZ], tests: Array.from({ length: 20 }, (_, i) => ({ id: `tf-00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, nr: i + 1, fall: 'beispiel' as const, erwartet: [], am: J })) } } }, r: null }), H);
    const zuviel = await laeufePost(sitzung('pia'), { aktion: 'testfall', prozess: PZ, wie: 'anlegen', fall: 'beispiel' });
    expect(zuviel.status).toBe(413);
    expect((await laeufe()).prozesse[PZ].tests).toHaveLength(20);
  });
});

describe('Scharf-Dialog — Vorschau, Budget je Prozess, die eine Bestätigung', () => {
  it('Vorschau: Agenten-Schritte je Modellstufe; ohne Budget 400; mit Budget scharf (Einstellung und Verlauf)', async () => {
    S._agentKostenSetzen({ schnell: 4, ausgewogen: 4, stark: 4 });
    const v = await laeufePost(sitzung('pia'), { aktion: 'scharf-vorschau', prozess: PZ2 });
    expect(v.status).toBe(200);
    const vorschau = v.j.vorschau as { agentenSchritte: number; stufen: { stufe: string; schritte: number }[]; jeLaufCent: number; version: number };
    expect(vorschau.agentenSchritte).toBe(1);
    expect(vorschau.stufen).toEqual([expect.objectContaining({ stufe: 'schnell', schritte: 1 })]);
    expect(vorschau.jeLaufCent).toBeGreaterThan(0);
    const stand = (JSON.parse((await werkstatt(sitzung('pia'), undefined, `?id=${PZ2}`)).text) as { stand: string }).stand;
    expect((await laeufePost(sitzung('pia'), { aktion: 'scharf', prozess: PZ2, stand, budgetCent: 0 })).status).toBe(400);
    expect((await laeufePost(dienst('pia'), { aktion: 'scharf', prozess: PZ2, stand, budgetCent: 300 })).status).toBe(403);
    const r = await laeufePost(sitzung('pia'), { aktion: 'scharf', prozess: PZ2, stand, budgetCent: 300, bestehende: 'nur-neue' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const st = (await laeufe()).prozesse[PZ2];
    expect(st.einstellung.scharf).toMatchObject({ budgetCent: 300, bestehende: 'nur-neue', von: 'pia' });
    expect(st.verlauf.map(x => x.was)).toEqual(expect.arrayContaining(['scharf', 'bestehende']));
  });
});

describe('Webhook-Schlüssel — genau einmal sichtbar', () => {
  it('nur in der Antwort des Anlegens; GET der Werkstatt und der Läufe tragen ihn nie; ein neuer ersetzt den alten', async () => {
    const a = await werkstatt(sitzung('pia'), { aktion: 'webhook-schluessel', id: PZ4 });
    expect(a.status).toBe(200);
    const g = (JSON.parse(a.text) as { geheim: { schluessel: string; adresse: string } }).geheim;
    expect(g.schluessel).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const w = await werkstatt(sitzung('pia'), undefined, `?id=${PZ4}`);
    expect(w.text).not.toContain(g.schluessel);
    expect((JSON.parse(w.text) as { webhook: { adresse: string } }).webhook.adresse).toBe(g.adresse);
    const l = await laeufeGet(sitzung('pia'), `?prozess=${PZ4}`);
    expect(l.text).not.toContain(g.schluessel);
    expect(JSON.stringify(alleDateien())).not.toContain(g.schluessel);
    const b = await werkstatt(sitzung('pia'), { aktion: 'webhook-schluessel', id: PZ4 });
    const g2 = (JSON.parse(b.text) as { geheim: { schluessel: string } }).geheim;
    expect(g2.schluessel).not.toBe(g.schluessel);
    // scharf schalten und annehmen: der alte Schlüssel gilt nicht mehr, der neue schon — die Eingänge zeigen nur Zeit und Status.
    expect((await werkstatt(sitzung('pia'), { aktion: 'webhook-scharf', id: PZ4, an: true })).status).toBe(200);
    const { webhookAnnehmen } = await import('@/lib/prozesse/webhook-server');
    const kennung = g.adresse.split('/').pop()!;
    expect((await webhookAnnehmen(kennung, g.schluessel, { thema: 'Frage von Erika' })).status).toBe(404);
    expect((await webhookAnnehmen(kennung, g2.schluessel, { thema: 'Frage von Erika' })).status).toBe(202);
    const l2 = await laeufeGet(sitzung('pia'), `?prozess=${PZ4}`);
    const e = (JSON.parse(l2.text) as { webhookEingaenge: { am: string }[] }).webhookEingaenge;
    expect(e).toHaveLength(1);
    expect(Object.keys(e[0])).toEqual(['am']);
    expect(l2.text).not.toContain('Erika');
  });
});

describe('Heute — die Tageszeile nur im Business', () => {
  it('Sicht Privat → 403; Business → Zahlen (gelaufen, auf dich)', async () => {
    expect((await laeufeGet(sitzung('pia'), '?heute=1&space=privat')).status).toBe(403);
    const r = await laeufeGet(sitzung('pia'), '?heute=1&space=business');
    expect(r.status).toBe(200);
    const h = (JSON.parse(r.text) as { heute: { gelaufen: number; aufDich: number } }).heute;
    expect(h.aufDich).toBeGreaterThanOrEqual(1);
    const { widgetSicht } = await import('@/lib/flaeche/sicht');
    expect(widgetSicht('prozesse')).toBe('business');
  });
});

describe('Agenten-Schritt ohne KI-Schlüssel — sofort anhalten, eine Glocke', () => {
  it('kein Versuch, keine Fehlerkante; Grund „KI nicht eingerichtet“; zweiter Lauf → immer noch EINE ungelesene Glocke', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
    try {
      S._agentKostenSetzen({ schnell: 5 });
      const r = await S.laufVonHand({ prozessId: PZ3, person: 'pia', fall: { art: 'deal', id: 'ch-agent' }, anfrage: 'anfrage-laeufe-0003' });
      if (!r.ok) throw new Error(r.fehler);
      const l = await lauf(r.lauf.id);
      expect(l).toMatchObject({ status: 'fehler', grund: 'ki-nicht-eingerichtet', aktuell: fk(40) });
      const s = l.schritte.find(x => x.knoten === fk(40))!;
      expect(s).toMatchObject({ status: 'fehler', grund: 'ki-nicht-eingerichtet' });
      expect(s.versuch).toBeUndefined();
      expect(l.schritte.some(x => x.knoten === fk(42))).toBe(false);
      const r2 = await S.laufVonHand({ prozessId: PZ3, person: 'pia', fall: { art: 'deal', id: 'ch-agent2' }, anfrage: 'anfrage-laeufe-0004' });
      if (!r2.ok) throw new Error(r2.fehler);
      const m = (await db.loadJson<{ eintraege: { bezug?: { id: string }; gelesen?: boolean; titel: string }[] }>('meldungen--pia'))?.eintraege ?? [];
      const ki = m.filter(x => x.bezug?.id === 'ki-nicht-eingerichtet' && !x.gelesen);
      expect(ki).toHaveLength(1);
      expect(ki[0].titel).toMatch(/KI nicht eingerichtet/);
    } finally { vi.useRealTimers(); }
  });
});

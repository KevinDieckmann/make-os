// ─── Fulfillment · Ausführung der Abläufe — über die Routen (17.10. abends) ───────────────────────────────────────────────────────────────
// Ein Ablauf aus dem Editor (Schritt → Nachricht mit Mail-Baustein → Entscheidung mit Nein-Erinnerung zurück → Termin) läuft durch einen Fall:
//   · Schritt → EINE Aufgabe im Business (feste Kennung, zuständige Person des Mandats); Aufgabe erledigt → der Fall rückt weiter (Haken), idempotent.
//   · Nachricht → Vorschlag im Stapel; Entwurf aus dem Baustein mit gefüllten Platzhaltern; „freigeben“ sendet NICHTS; abgehakt im Fall → Vorschlag weg.
//   · Entscheidung „nein“ → Erinnerung mit Aufgabe (erst nach der Frist), erledigt → fragt wieder; nach der Frist offen → Glocke einmal.
//   · Art. 18: kein Entwurf, kein Vorschlag. Morgenlauf idempotent. Dienstweg schreibt nie. Ein Fall ohne Formen (Altbestand) bleibt Byte für Byte.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-ablauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-ablauf';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const j = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {};
  return { status: r.status, j };
}

const J = '2026-10-01T08:00:00.000Z';
const mandat = (id: string, x: Record<string, unknown> = {}) => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf',
  vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J, ...x,
});

interface KnotenJ { id: string; elternId?: string; titel: string; status?: string; form?: string; faelligAm?: string; antwort?: string; runden?: number; stand?: string; zweige?: { ja?: string; nein?: string } }
const db = () => import('@/lib/store/local-db');
const tasks = async () => ((await (await db()).loadJson<{ tasks: { id: string; status: string; title: string; assignee: string; dueDate?: string; bezug?: { mandatId?: string }; spaceId?: string; tags?: string[] }[] }>('tasks'))?.tasks ?? []);
const ablaufTasks = async () => (await tasks()).filter(t => t.id.startsWith('ff-ab-'));
const stapel = async () => ((await (await db()).loadJson<{ vorschlaege: { id: string; status: string; werkzeug: string; person?: string; bezug?: { art: string; id: string }; ergebnis?: string }[] }>('zoe-stapel'))?.vorschlaege ?? []);
const fallRoh = async (m: string) => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle[m];
const knoten = async (m: string, titel: string) => (await fallRoh(m)).knoten.find(k => k.titel === titel)!;
let localDayFn: () => string = () => '';
const heute = () => localDayFn();
const tagPlusFn: { f: (t: string, n: number) => string } = { f: t => t };
const plus = (n: number) => tagPlusFn.f(heute(), n);

let vorlageId = '';
// 19.10. (Rundgang B13): „Angebot angenommen?“ ist bei aktivem Mandat erledigt (lib/fulfillment/regeln.ts `angebotAngenommenWirksam`) — die Mechanik der
// Entscheidung prüfen wir an einer Kundenfrage, die im laufenden Mandat offen sein kann.
const T = { bedarf: 'Bedarf aufnehmen', senden: 'Konzept senden', frage: 'Konzept freigegeben?', erinnern: 'Nach einer Woche nachfassen', termin: 'Start-Termin vereinbaren' };

beforeAll(async () => {
  localDayFn = (await import('@/lib/zeit')).localDay;
  tagPlusFn.f = (await import('@/lib/kalender/zeit')).tagPlus;
  const d = await db();
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ab' }),
    konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ab' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ab', finanzRecht: 'business' }),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-ab'), mandat('m-alt'), mandat('m-gesperrt', { kontaktIds: ['c-gesperrt'] }), mandat('m-pause')] });
  await d.saveJson('kontakte', { kontakte: [
    { id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' },
    { id: 'c-gesperrt', vorname: 'Gesa', nachname: 'Sperre', email: 'gesa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eingeschraenkt: { seit: '2026-09-15', grund: 'Antrag', von: 'pia' } },
  ] });
  // Ein Mail-Baustein (Bibliothek) und ein Ablauf aus dem Editor — wie im Browser.
  await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'baustein', eintrag: { art: 'mail', titel: 'Angebot (Mail)', text: 'Betreff: Ihr Angebot — {{kunde}}\n\n{{anrede}},\n\nanbei unser Angebot. Nächster Termin: {{termin}}.\n\nFreundliche Grüße\n{{absender}}' } }] });
  const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
  const mail = (ue.j.bausteine as { id: string; titel: string }[]).find(b => b.titel === 'Angebot (Mail)')!;
  const neu = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Probe-Ablauf', phase: 'Angebot', anfrageId: 'ab-probe-neu' });
  vorlageId = neu.j.vorlageId as string;
  const kn0 = ((neu.j.vorlage as { knoten: KnotenJ[] }).knoten);
  const phase = kn0.find(x => x.elternId === kn0.find(y => !y.elternId)!.id)!;
  const id = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const ops = [
    { op: 'schritt-neu', id: id(1), ziel: { phaseId: phase.id }, form: 'schritt', titel: T.bedarf, frist: 2 },
    { op: 'schritt-neu', id: id(2), ziel: { phaseId: phase.id, nach: id(1) }, form: 'nachricht', titel: T.senden, frist: 3 },
    { op: 'schritt-neu', id: id(3), ziel: { phaseId: phase.id, nach: id(2) }, form: 'entscheidung', titel: T.frage, frist: 7 },
    { op: 'nein-erinnerung', id: id(4), entscheidungId: id(3), titel: T.erinnern },
    { op: 'schritt', id: id(4), frist: 7 },
    { op: 'schritt-neu', id: id(5), ziel: { phaseId: phase.id, nach: id(3) }, form: 'termin', titel: T.termin },
    { op: 'baustein-dazu', id: id(6), schrittId: id(2), bausteinId: mail.id },
    { op: 'baustein-dazu', id: id(7), schrittId: id(4), bausteinId: mail.id },
  ];
  const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId, stand: neu.j.stand, ops });
  if (r.status !== 200) throw new Error(`Editor: ${r.status} ${JSON.stringify(r.j)}`);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

/** Fall starten und das Onboarding für den Test entfallen lassen (mit Grund) — danach steht der Fall im Ablauf. */
async function starte(m: string, start: string) {
  const a = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: m, vorlageId, start, anfrageId: `ab-start-${m}` });
  expect(a.status).toBe(200);
  const { MUSTER_ONBOARDING } = await import('@/lib/fulfillment/muster');
  const { obKnotenId } = await import('@/lib/fulfillment/prozesse/onboarding');
  const r = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: m, ops: MUSTER_ONBOARDING.map(s => ({ op: 'knoten-status', id: obKnotenId(s.schluessel), status: 'entfaellt', grund: 'Probe ohne Onboarding', am: start })) });
  expect(r.status, JSON.stringify(r.j)).toBe(200);
}

describe('Ein Ablauf läuft durch', () => {
  it('Schritt → EINE Aufgabe (Business, zuständige Person, Frist ab Ankunft) — idempotent, auch im Morgenlauf', async () => {
    await starte('m-ab', plus(-20));
    const t = await ablaufTasks();
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ status: 'todo', assignee: 'olaf', bezug: { mandatId: 'm-ab' }, spaceId: 'ug', tags: ['fulfillment', 'ablauf'] });
    expect(t[0].title).toBe(`${T.bedarf} — Probe m-ab GmbH`);
    expect(t[0].dueDate).toBe(plus(-18));
    const { ablaufAufgabeId } = await import('@/lib/fulfillment/prozesse/ausfuehrung');
    expect(t[0].id).toBe(ablaufAufgabeId('m-ab', (await knoten('m-ab', T.bedarf)).id));
    const { prozesseMorgenlauf } = await import('@/lib/fulfillment/prozesse/server');
    const { fulfillmentHaushalt } = await import('@/lib/fulfillment/speicher');
    await prozesseMorgenlauf(await fulfillmentHaushalt(), heute());
    await prozesseMorgenlauf(await fulfillmentHaushalt(), heute());
    expect(await ablaufTasks()).toHaveLength(1);
    // Die Live-Lage: hier steht der Fall, überfällig, bei uns.
    const c = await rufe('fulfillment/cockpit', 'GET', sitzung('pia'));
    const z = (c.j.zeilen as { mandatId: string; schritt?: string; schrittLage?: { wartetAuf: string; ueberfaellig: boolean } }[]).find(x => x.mandatId === 'm-ab')!;
    expect(z.schritt).toBe(T.bedarf);
    expect(z.schrittLage).toMatchObject({ wartetAuf: 'intern', ueberfaellig: true });
  });

  it('Aufgabe erledigt → der Fall rückt weiter; die Nachricht steht als Vorschlag im Stapel (für die zuständige Person)', async () => {
    const [t] = await ablaufTasks();
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const r = await systemAufgabenAendern(() => ({ teile: [{ id: t.id, felder: { status: 'done' } }] }), { person: 'olaf' });
    expect(r.ok).toBe(true);
    expect((await knoten('m-ab', T.bedarf)).status).toBe('erledigt');
    expect((await knoten('m-ab', T.bedarf)).erledigtVon).toBe('olaf');
    const v = (await stapel()).filter(x => x.status === 'offen' && x.bezug?.id.startsWith('p:nachricht:m-ab:'));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ werkzeug: 'fulfillment_nachricht', person: 'olaf' });
    expect(await ablaufTasks()).toHaveLength(1); // eine Nachricht hat keine Aufgabe
  });

  it('Entwurf aus dem Baustein (gefüllt); „freigeben“ im Stapel sendet nichts; abgehakt im Fall → Vorschlag geschlossen', async () => {
    const n = await knoten('m-ab', T.senden);
    const g = await rufe('fulfillment/fall', 'GET', sitzung('olaf'), undefined, `?m=m-ab&nachricht=${n.id}`);
    expect(g.status).toBe(200);
    expect(g.j.entwurf).toMatchObject({ betreff: 'Ihr Angebot — Probe m-ab GmbH', an: { email: 'testa@example.invalid', name: 'Testa Probe' }, gesellschaft: 'ug' });
    expect((g.j.entwurf as { text: string }).text).toMatch(/^Guten Tag Testa Probe,\n\nanbei unser Angebot\.\n/); // ohne Termin fällt der Satz weg (L1 B12)
    expect((g.j.entwurf as { text: string }).text).not.toMatch(/Termin folgt/);
    const v = (await stapel()).find(x => x.status === 'offen' && x.bezug?.id.startsWith('p:nachricht:m-ab:'))!;
    const { PROZESSE_STAPEL } = await import('@/lib/fulfillment/prozesse/server');
    const frei = await PROZESSE_STAPEL.freigeben(v as never, 'olaf', {});
    expect(frei).toMatchObject({ ok: true, text: expect.stringContaining('nur dort per Klick') });
    expect((await knoten('m-ab', T.senden)).status).toBe('offen'); // nichts gesendet, nichts erledigt
    // Gesendet im Fall (MailSenden → danach „erledigt“) — hier der Vermerk über die Route.
    const r = await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-ab', ops: [{ op: 'knoten-status', id: n.id, status: 'erledigt', am: plus(-17) }] });
    expect(r.status).toBe(200);
    expect((await knoten('m-ab', T.frage)).faelligAm).toBe(plus(-10));
  });

  it('Entscheidung offen nach der Frist → EINE Glocke an die zuständige Person (Morgenlauf idempotent)', async () => {
    const { ablaufNachziehen } = await import('@/lib/fulfillment/prozesse/ausfuehrung-server');
    const a = await ablaufNachziehen({ mandatId: 'm-ab' });
    expect(a.glocken).toBe(1);
    expect((await ablaufNachziehen({ mandatId: 'm-ab' })).glocken).toBe(0);
    const g = await (await db()).loadJson<{ eintraege?: { titel: string; link: string }[] }>('meldungen--olaf');
    expect((g?.eintraege ?? []).filter(x => x.titel.includes(T.frage))).toHaveLength(1);
    expect((g?.eintraege ?? []).find(x => x.titel.includes(T.frage))!.link).toContain('#schritt-');
  });

  it('„nein“ → Erinnerung: Aufgabe erst nach ihrer Frist (mit Mail-Entwurf im Stapel); erledigt → die Entscheidung fragt wieder', async () => {
    const e = await knoten('m-ab', T.frage);
    const r = await rufe('fulfillment/fall', 'PATCH', sitzung('olaf'), { mandatId: 'm-ab', ops: [{ op: 'antwort', id: e.id, antwort: 'nein', am: plus(-8) }] });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const rk = await knoten('m-ab', T.erinnern);
    expect(rk.faelligAm).toBe(plus(-1));
    const t = (await ablaufTasks()).find(x => x.title.startsWith(T.erinnern))!;
    expect(t).toMatchObject({ status: 'todo', assignee: 'olaf' });
    expect(t.title).toContain('Versuch 1 von 5');
    expect((await stapel()).filter(x => x.status === 'offen' && x.bezug?.id === `p:nachricht:m-ab:${rk.id}:1`)).toHaveLength(1);
    const f = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-ab');
    const ab = f.j.ablauf as { aktiv: boolean; knoten: Record<string, { aktiv: boolean; art: string; aufgabe?: string; aufgabeStatus?: string }> };
    expect(ab.aktiv).toBe(true);
    expect(ab.knoten[rk.id]).toMatchObject({ aktiv: true, art: 'erinnerung', aufgabe: t.id, aufgabeStatus: 'todo' });
    // Erinnerung erledigt (Aufgabe abgehakt) → Runde gezählt, die Entscheidung fragt wieder; der Mail-Vorschlag der Runde ist weg.
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    await systemAufgabenAendern(() => ({ teile: [{ id: t.id, felder: { status: 'done' } }] }), { person: 'olaf' });
    expect(await knoten('m-ab', T.erinnern)).toMatchObject({ status: 'offen', runden: 1 });
    expect(await knoten('m-ab', T.frage)).toMatchObject({ status: 'offen', runden: 1, faelligAm: plus(7) });
    expect((await stapel()).filter(x => x.status === 'offen' && x.bezug?.id === `p:nachricht:m-ab:${rk.id}:1`)).toHaveLength(0);
  });

  it('„ja“ → weiter: die Erinnerung entfällt, der Termin wird eine Aufgabe; Dienstweg schreibt nie', async () => {
    const e = await knoten('m-ab', T.frage);
    expect((await rufe('fulfillment/fall', 'PATCH', dienst('pia'), { mandatId: 'm-ab', ops: [{ op: 'antwort', id: e.id, antwort: 'ja' }] })).status).toBe(403);
    // „nur Business“ darf am Fall weiter, was sie heute darf (Fall-Ops) — hier die Antwort.
    const r = await rufe('fulfillment/fall', 'PATCH', sitzung('partnerin'), { mandatId: 'm-ab', ops: [{ op: 'antwort', id: e.id, antwort: 'ja' }] });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect((await knoten('m-ab', T.erinnern)).status).toBe('entfaellt');
    const termin = (await ablaufTasks()).find(x => x.title.startsWith(T.termin));
    expect(termin).toMatchObject({ status: 'todo' });
    // Abhaken im Fall schließt die Aufgabe.
    const tk = await knoten('m-ab', T.termin);
    await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-ab', ops: [{ op: 'knoten-status', id: tk.id, status: 'erledigt' }] });
    expect((await ablaufTasks()).find(x => x.title.startsWith(T.termin))!.status).toBe('done');
  });
});

describe('Recht und Altbestand', () => {
  it('Art. 18: kein Entwurf und kein Vorschlag — nur der Hinweis', async () => {
    await starte('m-gesperrt', plus(-5));
    const b = await knoten('m-gesperrt', T.bedarf);
    await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-gesperrt', ops: [{ op: 'knoten-status', id: b.id, status: 'erledigt' }] });
    const n = await knoten('m-gesperrt', T.senden);
    const g = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, `?m=m-gesperrt&nachricht=${n.id}`);
    expect(g.status).toBe(200);
    expect(g.j.entwurf).toBeNull();
    expect(String(g.j.gesperrt)).toMatch(/Art\. 18/);
    expect((await stapel()).filter(x => x.bezug?.id.startsWith('p:nachricht:m-gesperrt:'))).toHaveLength(0);
  });

  it('pausiert: die Vorschläge bleiben; abgeschlossen: offene Aufgaben abgebrochen, Vorschläge abgelehnt mit Grund (17.10., Schreibwege B2)', async () => {
    await starte('m-pause', plus(-1));
    const bedarf = await knoten('m-pause', T.bedarf);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-pause', ops: [{ op: 'knoten-status', id: bedarf.id, status: 'erledigt', am: heute() }] })).status).toBe(200);
    const offen = async () => (await stapel()).filter(x => x.bezug?.id.startsWith('p:nachricht:m-pause:'));
    expect((await offen()).filter(x => x.status === 'offen')).toHaveLength(1);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-pause', ops: [{ op: 'fall-status', status: 'pausiert' }] })).status).toBe(200);
    const { ablaufNachziehen } = await import('@/lib/fulfillment/prozesse/ausfuehrung-server');
    await ablaufNachziehen({ mandatId: 'm-pause' });
    expect((await offen()).filter(x => x.status === 'offen')).toHaveLength(1);
    // Wieder laufend, dann abgeschlossen: nichts bleibt liegen, nichts heißt „freigegeben“.
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-pause', ops: [{ op: 'fall-status', status: 'laeuft' }] })).status).toBe(200);
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-pause', ops: [{ op: 'fall-status', status: 'abgeschlossen' }] })).status).toBe(200);
    await ablaufNachziehen({ mandatId: 'm-pause' });
    expect((await offen()).map(x => x.status)).toEqual(['abgelehnt']);
    expect((await ablaufTasks()).filter(t => t.bezug?.mandatId === 'm-pause' && t.status !== 'done' && t.status !== 'cancelled')).toHaveLength(0);
  });

  it('ein Fall ohne Formen (Altbestand): Nachziehen und Morgenlauf ändern nichts, keine Aufgabe', async () => {
    const ue = await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'aus-muster' }] });
    expect(ue.status).toBe(200);
    const p = ((await rufe('fulfillment', 'GET', sitzung('pia'))).j.prozesse as { id: string; art: string }[]).find(x => x.art === 'paket' && x.id !== vorlageId)!;
    // Altbestand: eine Vorlage ohne Formen (seit 17.10. tragen die Muster-Schritte „Schritt“ + Frist — hier fallen sie weg, wie in einer älteren Fassung).
    const { fulfillmentAendern } = await import('@/lib/fulfillment/speicher');
    await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, prozesse: d.prozesse.map(v => v.id !== p.id ? v : { ...v, knoten: v.knoten.map(({ form: _f, frist: _r, ...k }) => k) }) }, geaendert: [p.id] }), { art: 'system' });
    expect((await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-alt', vorlageId: p.id, anfrageId: 'ab-alt' })).status).toBe(200);
    const vorher = JSON.stringify(await fallRoh('m-alt'));
    const anzahl = (await ablaufTasks()).length;
    const { ablaufNachziehen } = await import('@/lib/fulfillment/prozesse/ausfuehrung-server');
    await ablaufNachziehen({ mandatId: 'm-alt' });
    const { prozesseMorgenlauf } = await import('@/lib/fulfillment/prozesse/server');
    const { fulfillmentHaushalt } = await import('@/lib/fulfillment/speicher');
    await prozesseMorgenlauf(await fulfillmentHaushalt(), heute());
    expect(JSON.stringify(await fallRoh('m-alt'))).toBe(vorher);
    expect((await ablaufTasks()).filter(t => t.bezug?.mandatId === 'm-alt')).toHaveLength(0);
    expect((await ablaufTasks()).length).toBe(anzahl);
    const f = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-alt');
    expect(f.j.ablauf).toEqual({ aktiv: false, knoten: {} });
  });
});

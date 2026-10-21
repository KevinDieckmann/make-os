// ─── Prozesse C1 · Lauf-Motor — Server von Ende zu Ende (lib/prozesse/lauf-server.ts, lauf-stapel.ts; Punkte 35–50, 59, 61, 64, 67, N12) ─────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell. Geprüft:
//   · von Hand starten → Aufgabe mit fester Kennung `<lauf>-<schritt>` (Systemlauf); Abbruch nach der Wirkung bzw. vor ihr → derselbe Schritt, nichts doppelt
//   · Abhaken über den Aufgaben-Schreibweg treibt weiter → Entscheidung als Vorschlag im ZOE-Stapel (Stapel-Art `prozess`), Glocke; Ablehnen → „nein“
//   · Version bleibt am Lauf; Art. 18 beendet; Probelauf schreibt NICHTS (jede Datei bit-gleich)
//   · Versand nach der Freigabe (N12): nur aus der eigenen Sitzung (Dienstweg 403), nur die Person, für die vorgelegt; Fehler → bleibt offen mit Grund;
//     Empfänger bleibt der aus dem Fall (geänderte Eingabe ändert ihn nie); danach geht der Lauf weiter
//   · Budget-Pause (Prozess pausiert sich, Glocke); Ereignis startet, eigene Wirkung nicht (Schleifenschutz), privates nie
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag, AgentSchritt } from '@/lib/prozesse/definition';
import type { LaeufeDatei, ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, konto, PZ, PZ2, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-lauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-lauf';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// Versand: nachgebaut — keine echte Mail. Das Ergebnis steuert der Test.
const gesendet: { person: string; an: string; betreff?: string; text?: string }[] = [];
let sendeAntwort: { status: number; body: Record<string, unknown> } = { status: 200, body: { ok: true, id: 'gm-probe' } };
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (person: string, b: { neu?: { betreff?: string }; an?: { email: string }[]; text?: string }) => {
    gesendet.push({ person, an: b.an?.[0]?.email ?? '', betreff: b.neu?.betreff, text: b.text });
    return sendeAntwort;
  },
}));

const H = 'haus-pz';
const PZ3 = 'pz-00000000-0000-4000-8000-000000000003';
const PZ4 = 'pz-00000000-0000-4000-8000-000000000004';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), 'content-type': 'application/json' });

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

/** Anrufen (Mensch) → Entscheidung (Mensch) → Ende; „nein“ → Ende mit Abbruch. Läuft als pia. */
const WEG: ProzessDefinition = definition([
  schritt(10, 'Anrufen', 1),
  schritt(12, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) } }),
  schritt(13, 'Fertig', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(20, 'Abgesagt', 4, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
], { laeuftAls: 'pia' });

const eintrag = (id: string, def: ProzessDefinition, status: ProzessEintrag['status'] = 'aktiv', versionen = 1): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status, angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: Array.from({ length: versionen }, (_, i) => ({ nr: i + 1, name: `v${i + 1}`, am: J, von: 'pia', definition: { ...def, id } })),
});
const scharf = (budgetCent = 500) => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });

async function laeufe(): Promise<LaeufeDatei> { return S.laeufeLesen(H); }
async function lauf(id: string): Promise<ProzessLauf> { return (await laeufe()).laeufe.find(l => l.id === id)!; }
async function aufgaben(): Promise<{ id: string; status: string; assignee?: string; bezug?: Record<string, string>; tags?: string[]; space?: string }[]> {
  return ((await db.loadJson<{ tasks: never[] }>('tasks'))?.tasks ?? []);
}
async function stapel(): Promise<{ id: string; status: string; person?: string; einmalig?: string; bezug?: { art: string; id: string }; eingabe: Record<string, unknown>; bereich?: string; nachher: string }[]> {
  return ((await db.loadJson<{ vorschlaege: never[] }>('zoe-stapel'))?.vorschlaege ?? []);
}
async function stapelPost(kopf: Record<string, string>, body: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> }> {
  const { POST } = await import('@/app/api/zoe/stapel/route');
  const r = await POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, unknown> };
}
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
    konto('k4', 'kunde', 'mitglied'),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const deal = (id: string, kontakt: string) => ({ id, titel: `Probe ${id}`, kontaktIds: [kontakt], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J });
  await db.saveJson('crm', { ...leererBestand(), chancen: [deal('ch-probe', 'c-erika'), deal('ch-zwei', 'c-erika'), deal('ch-drei', 'c-erika'), deal('ch-mail', 'c-erika'), deal('ch-gesperrt', 'c-gesperrt'), deal('ch-agent', 'c-erika')] });
  await db.saveJson('kontakte', { kontakte: [
    // Mail-Einwilligung mit vollem Nachweis (Kanal-Ampel grün) — ohne sie wäre die Danke-Mail „rot“ und würde übersprungen.
    { id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01',
      einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Formular', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja, gern per Mail.', wortlautVersion: 'v1', belegRef: 'Gespräch vom 01.09.' }] },
    { id: 'c-gesperrt', vorname: 'Max', nachname: 'Muster', email: 'max@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } },
  ] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { schlossSetzen } = await import('@/lib/prozesse/schloss');
  const MAIL = schlossSetzen(definition([
    schritt(30, 'Danke-Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'gmail', an: 'fall.kontakt', betreff: 'Danke, {{kontakt.vorname}}', text: 'Schön, dass wir gesprochen haben.' } } }),
    schritt(31, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ], { laeuftAls: 'pia' })).definition;
  const AGENT: AgentSchritt = { wer: { art: 'head', headId: 'sales' }, auftrag: 'Nächsten Schritt vorschlagen', modell: 'schnell', budgetCent: 30, gedaechtnis: { brain: false, akte: true }, werkzeuge: [], eingabe: [], ausgabe: [], warumKeineRegel: 'Die Einschätzung braucht Sprachverständnis — eine feste Regel reicht hier nicht.' };
  const AG = definition([schritt(40, 'Einschätzen', 1, { form: 'agent', agent: AGENT }), schritt(41, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } })], { laeuftAls: 'pia' });
  const EREIGNIS = definition([schritt(50, 'Nachfassen', 1)], { laeuftAls: 'pia' });
  EREIGNIS.knoten = EREIGNIS.knoten.map(k => (k.id === fk(3) ? { ...k, ausloeser: { art: 'ereignis' as const, ereignis: 'deal-stufe' as const }, katalog: { id: 'ausloeser.ereignis' } } : k));
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(PZ, WEG), eintrag(PZ2, MAIL), eintrag(PZ3, AG), eintrag(PZ4, EREIGNIS)] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: { [PZ]: scharf(), [PZ2]: scharf(), [PZ3]: scharf(1), [PZ4]: scharf() } });
  S = await import('@/lib/prozesse/lauf-server');
  const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
  expect((await prozesseLesen(H)).prozesse.map(p => p.id)).toEqual([PZ, PZ2, PZ3, PZ4]);
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Von Hand starten — Menschen-Schritt als Aufgabe, nichts doppelt', () => {
  let id = '';
  let kennung = '';
  it('scharf: die Aufgabe hat die feste Kennung des Schritts, liegt bei der zuständigen Person, mit Bezug — der Lauf wartet darauf', async () => {
    const r = await S.laufVonHand({ prozessId: PZ, person: 'olaf', fall: { art: 'deal', id: 'ch-probe' }, anfrage: 'anfrage-00000001' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    id = r.lauf.id;
    expect(r.lauf).toMatchObject({ status: 'wartet', modus: 'scharf', version: 1, person: 'olaf', wartet: { art: 'aufgabe', knoten: fk(10) } });
    kennung = r.lauf.wartet!.wirkung!;
    expect(kennung.startsWith(`${id}-`)).toBe(true);
    const t = (await aufgaben()).filter(x => x.id === kennung);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ status: 'todo', assignee: 'pia', space: 'business', tags: ['prozess'], bezug: { dealId: 'ch-probe', kontaktId: 'c-erika' } });
    // Der Lauf trägt nur Kennungen — keine Namen, keine Adressen.
    const roh = JSON.stringify(await lauf(id));
    for (const x of ['Erika', 'Beispiel', 'example.invalid']) expect(roh).not.toContain(x);
  });
  it('ein zweiter Start für denselben Fall → 409 (ein offener Lauf je Fall)', async () => {
    expect(await S.laufVonHand({ prozessId: PZ, person: 'pia', fall: { art: 'deal', id: 'ch-probe' }, anfrage: 'anfrage-00000002' })).toMatchObject({ ok: false, status: 409 });
  });
  it('Abbruch NACH der Wirkung, vor dem Festhalten: derselbe Schritt, dieselbe Kennung — keine zweite Aufgabe', async () => {
    const vorher = await lauf(id);
    await S.laeufeAendern(d => ({ datei: { ...d, laeufe: d.laeufe.map(l => { if (l.id !== id) return l; const n = { ...l, status: 'laeuft' as const, aktuell: null, schritte: [], geaendert: J }; delete (n as Partial<ProzessLauf>).wartet; return n; }) }, r: null }), H);
    const n = await S.laufVoran(id);
    expect(n).toMatchObject({ status: 'wartet', wartet: { art: 'aufgabe', wirkung: kennung } });
    expect((await aufgaben()).filter(x => x.id === kennung)).toHaveLength(1);
    expect(n!.schritte.map(s => s.knoten)).toEqual(vorher.schritte.map(s => s.knoten));
  });
  it('Abbruch VOR der Wirkung (Schritt geplant, Aufgabe fehlt): der nächste Anstoß legt sie genau einmal an', async () => {
    await db.saveJson('tasks', { tasks: (await aufgaben()).filter(x => x.id !== kennung), projects: [] });
    await S.laeufeAendern(d => ({ datei: { ...d, laeufe: d.laeufe.map(l => { if (l.id !== id) return l; const n = { ...l, status: 'laeuft' as const, geaendert: J, schritte: l.schritte.map(s => (s.knoten === fk(10) ? { ...s, status: 'laeuft' as const } : s)) }; delete (n as Partial<ProzessLauf>).wartet; return n; }) }, r: null }), H);
    await S.laufVoran(id);
    await S.laufVoran(id);
    expect((await aufgaben()).filter(x => x.id === kennung)).toHaveLength(1);
    expect((await lauf(id)).wartet?.wirkung).toBe(kennung);
  });
  it('Abhaken über den Aufgaben-Schreibweg treibt den Lauf weiter → Entscheidung als Vorschlag (Stapel-Art „prozess“) + Glocke', async () => {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const r = await systemAufgabenAendern(() => ({ teile: [{ id: kennung, felder: { status: 'done' } }] }), { person: 'pia' });
    expect(r.ok).toBe(true);
    const l = await lauf(id);
    expect(l).toMatchObject({ status: 'wartet', aktuell: fk(12), wartet: { art: 'freigabe' } });
    const v = (await stapel()).find(x => x.einmalig === l.wartet!.wirkung)!;
    expect(v).toMatchObject({ status: 'offen', person: 'pia', bezug: { art: 'prozess', id: l.wartet!.wirkung }, bereich: 'business' });
    expect(v.eingabe).toMatchObject({ _lauf: id, _version: 1, _sorte: 'entscheidung' });
    const glocke = await db.loadJson<{ eintraege: { art: string }[] }>('meldungen--pia');
    expect(glocke?.eintraege.some(m => m.art === 'prozess')).toBe(true);
  });
  it('Ablehnen im Stapel → „nein“ → Ende mit Abbruch; die Entscheidung ist am Vorschlag', async () => {
    const l = await lauf(id);
    const v = (await stapel()).find(x => x.einmalig === l.wartet!.wirkung)!;
    const r = await stapelPost(sitzung('pia'), { id: v.id, entscheidung: 'ablehnen', grund: 'Passt gerade nicht.' });
    expect(r.status).toBe(200);
    expect(await lauf(id)).toMatchObject({ status: 'fertig', ergebnis: 'abbruch' });
    expect((await stapel()).find(x => x.id === v.id)?.status).toBe('abgelehnt');
  });
});

describe('Version, Art. 18, Probelauf', () => {
  it('die Version bleibt am Lauf: eine neue Version ändert laufende Läufe nicht', async () => {
    const r = await S.laufVonHand({ prozessId: PZ, person: 'pia', fall: { art: 'deal', id: 'ch-zwei' }, anfrage: 'anfrage-00000003' });
    if (!r.ok) throw new Error(r.fehler);
    const { prozesseBestand } = await import('@/lib/prozesse/definition');
    const zwei = definition([schritt(10, 'Anrufen', 1), schritt(11, 'Neu: Mail vorbereiten', 2), schritt(12, 'Passt es?', 3, { form: 'entscheidung', zweige: { nein: fk(20) } }), schritt(13, 'Fertig', 4, { form: 'ende', ende: { ergebnis: 'erfolg' } }), schritt(20, 'Abgesagt', 5, { form: 'ende', ende: { ergebnis: 'abbruch' } })], { laeuftAls: 'pia' });
    await db.updateJson<{ v: 1; prozesse: ProzessEintrag[] }>(prozesseBestand(H), cur => ({ ...cur!, prozesse: cur!.prozesse.map(p => (p.id === PZ ? { ...p, versionen: [...p.versionen, { nr: 2, name: 'v2', am: J, von: 'pia', definition: { ...zwei, id: PZ } }] } : p)) }));
    const kennung = r.lauf.wartet!.wirkung!;
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    await systemAufgabenAendern(() => ({ teile: [{ id: kennung, felder: { status: 'done' } }] }), { person: 'pia' });
    const l = await lauf(r.lauf.id);
    // Version 1 hat keinen Schritt fk(11) — der Lauf geht direkt zur Entscheidung.
    expect(l).toMatchObject({ version: 1, aktuell: fk(12) });
    expect(l.schritte.some(s => s.knoten === fk(11))).toBe(false);
  });
  it('Art. 18: eine eingeschränkte Person am Fall beendet den Lauf — keine Aufgabe, kein Vorschlag', async () => {
    const vorher = (await aufgaben()).length;
    const r = await S.laufVonHand({ prozessId: PZ, person: 'pia', fall: { art: 'deal', id: 'ch-gesperrt' }, anfrage: 'anfrage-00000004' });
    expect(r.ok && r.lauf).toMatchObject({ status: 'abgebrochen', grund: 'art18' });
    expect((await aufgaben()).length).toBe(vorher);
  });
  it('Probelauf schreibt NICHTS (jede Datei bit-gleich) und ruft kein Modell — mit echtem Fall und mit dem Beispiel', async () => {
    const vorher = alleDateien();
    const a = await S.probelauf({ prozessId: PZ, quelle: 'version', fall: { art: 'deal', id: 'ch-drei' }, person: 'pia' });
    const b = await S.probelauf({ prozessId: PZ2, quelle: 'entwurf', fall: 'beispiel', person: 'pia' });
    expect(alleDateien()).toEqual(vorher);
    expect(a.ok && a.schritte.map(s => s.status)).toEqual(expect.arrayContaining(['wuerde', 'freigabe']));
    expect(b.ok && b.schritte.some(s => s.status === 'freigabe')).toBe(true);
    expect(await S.probelauf({ prozessId: 'pz-00000000-0000-4000-8000-000000000099', quelle: 'version', person: 'pia' })).toMatchObject({ ok: false, status: 404 });
  });
});

describe('Versand nach der Freigabe (N12) — nur als die freigebende Person aus der Sitzung', () => {
  let laufId = '';
  let vId = '';
  it('der Vorschlag trägt Empfänger und Text, bevor jemand klickt', async () => {
    const r = await S.laufVonHand({ prozessId: PZ2, person: 'pia', fall: { art: 'deal', id: 'ch-mail' }, anfrage: 'anfrage-00000005' });
    if (!r.ok) throw new Error(r.fehler);
    laufId = r.lauf.id;
    expect(r.lauf).toMatchObject({ status: 'wartet', wartet: { art: 'freigabe' } });
    const v = (await stapel()).find(x => x.einmalig === r.lauf.wartet!.wirkung)!;
    vId = v.id;
    expect(v.nachher).toContain('erika@example.invalid');
    expect(v.nachher).toContain('Betreff: Danke, Erika');
    expect(gesendet).toHaveLength(0);
  });
  it('Dienstweg (auch mit Person) → 403, nichts gesendet, der Vorschlag bleibt offen', async () => {
    const r = await stapelPost(dienst('pia'), { id: vId, entscheidung: 'freigeben' });
    expect(r.status).toBe(403);
    expect(gesendet).toHaveLength(0);
    expect((await stapel()).find(x => x.id === vId)?.status).toBe('offen');
  });
  it('eine andere Person des Haushalts sieht ihn nicht bzw. darf ihn nicht freigeben', async () => {
    const r = await stapelPost(sitzung('olaf'), { id: vId, entscheidung: 'freigeben' });
    expect([403, 404]).toContain(r.status);
    expect(gesendet).toHaveLength(0);
  });
  it('Versand scheitert → der Vorschlag bleibt offen, mit Grund; der Lauf wartet weiter', async () => {
    sendeAntwort = { status: 409, body: { ok: false, fehler: 'Das Postfach ist getrennt.' } };
    const r = await stapelPost(sitzung('pia'), { id: vId, entscheidung: 'freigeben' });
    expect(r.status).toBe(409);
    expect(String(r.j.error)).toContain('Postfach ist getrennt');
    expect((await stapel()).find(x => x.id === vId)?.status).toBe('offen');
    expect((await lauf(laufId)).status).toBe('wartet');
  });
  it('aus der Sitzung: gesendet als die freigebende Person, an den Empfänger aus dem Fall (eine geänderte Eingabe ändert ihn nie); der Lauf geht weiter', async () => {
    sendeAntwort = { status: 200, body: { ok: true, id: 'gm-probe' } };
    gesendet.length = 0;
    const r = await stapelPost(sitzung('pia'), { id: vId, entscheidung: 'freigeben', eingabe: { text: 'Danke für das Gespräch!', an: 'jemand-anders@example.invalid' } });
    expect(r.status).toBe(200);
    expect(gesendet).toEqual([{ person: 'pia', an: 'erika@example.invalid', betreff: 'Danke, Erika', text: 'Danke für das Gespräch!' }]);
    expect((await stapel()).find(x => x.id === vId)?.status).toBe('freigegeben');
    expect(await lauf(laufId)).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
  });
  it('ein Vorschlag, auf den der Lauf nicht mehr wartet, wird nicht ausgeführt (Punkt 64)', async () => {
    const { lege } = await import('@/lib/zoe/stapel');
    const alt = await lege({ werkzeug: 'prozess_schritt', gruppe: 'business', titel: 'Alt', nachher: 'Alt', eingabe: { _lauf: laufId, _version: 1, _sorte: 'freigabe' }, person: 'pia', quelle: 'lauf', bezug: { art: 'prozess', id: `${laufId}-0000000000000000` }, einmalig: `${laufId}-0000000000000000` });
    const r = await stapelPost(sitzung('pia'), { id: alt.id, entscheidung: 'freigeben' });
    expect(r.status).toBe(409);
    expect((await stapel()).find(x => x.id === alt.id)?.status).toBe('offen');
  });
});

describe('Budget und Ereignisse', () => {
  it('Agenten-Schritt über dem Monatsbudget → der Prozess pausiert sich (Status, Verlauf, Glocke), der Lauf hält an', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
    try {
      S._agentKostenSetzen({ schnell: 5 });
      const r = await S.laufVonHand({ prozessId: PZ3, person: 'pia', fall: { art: 'deal', id: 'ch-agent' }, anfrage: 'anfrage-00000006' });
      if (!r.ok) throw new Error(r.fehler);
      expect(await lauf(r.lauf.id)).toMatchObject({ status: 'angehalten', grund: 'budget' });
      const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
      expect((await prozesseLesen(H)).prozesse.find(p => p.id === PZ3)?.status).toBe('pausiert');
      const st = (await laeufe()).prozesse[PZ3];
      expect(st.pause?.grund).toBe('budget');
      expect(st.verlauf.some(v => v.was === 'budget-grenze')).toBe(true);
      expect(await stapel().then(l => l.some(v => v.eingabe._lauf === r.lauf.id))).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('Ereignis startet einen Lauf (als die auslösende Person); die eigene Wirkung startet den Prozess nicht (Schleifenschutz); privat nie', async () => {
    const E = await import('@/lib/ereignisse/server');
    const { mitLaufHerkunft } = await import('@/lib/prozesse/lauf-herkunft');
    await S.prozesseImTakt(); // erster Lauf: Cursor ab jetzt
    await E.ereignis({ id: 'crm:ch-drei:stufe-1', art: 'deal-stufe', quelle: 'crm', bezug: { dealId: 'ch-drei' }, bereich: 'business', person: 'olaf', stufe: 'angebot' });
    await mitLaufHerkunft({ prozessId: PZ4, laufId: 'pl-00000000-0000-4000-8000-000000000777', tiefe: 0 }, () =>
      E.ereignis({ id: 'crm:ch-zwei:stufe-1', art: 'deal-stufe', quelle: 'crm', bezug: { dealId: 'ch-zwei' }, bereich: 'business', person: 'pia', stufe: 'angebot' }));
    await E.ereignis({ id: 'crm:ch-probe:stufe-p', art: 'deal-stufe', quelle: 'crm', bezug: { dealId: 'ch-probe' }, bereich: 'privat', person: 'pia', stufe: 'angebot' });
    const t = await S.prozesseImTakt();
    expect(t?.gestartet).toBe(1);
    const neu = (await laeufe()).laeufe.filter(l => l.prozessId === PZ4);
    expect(neu).toHaveLength(1);
    expect(neu[0]).toMatchObject({ fall: { art: 'deal', id: 'ch-drei' }, person: 'olaf', ausloeser: { art: 'ereignis' }, status: 'wartet' });
    expect((await laeufe()).prozesse[PZ4].nicht?.eigen).toBe(1);
  });
});

describe('Routen — nur Business, nur der Haushalt, Steuern nur per Sitzung', () => {
  const laeufeGet = async (kopf: Record<string, string>, suche: string) => {
    const { GET } = await import('@/app/api/prozesse/laeufe/route');
    const r = await GET(new Request(`http://test/api/prozesse/laeufe${suche}`, { headers: kopf }));
    return { status: r.status, text: await r.text() };
  };
  const probe = async (kopf: Record<string, string>, body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/prozesse/probelauf/route');
    const r = await POST(new Request('http://test/api/prozesse/probelauf', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
    return { status: r.status, text: await r.text() };
  };
  it('fremder Haushalt, Testkunde, Dienstweg ohne Person → 403; Sicht Privat → 403', async () => {
    for (const k of [sitzung('gast'), sitzung('kunde'), dienst()]) expect((await laeufeGet(k, `?prozess=${PZ}`)).status).toBe(403);
    expect((await laeufeGet(sitzung('pia'), `?prozess=${PZ}&space=privat`)).status).toBe(403);
  });
  it('Läufe-Liste und ein Lauf: Status, Version, Dauer, je Knoten — nur Kennungen, keine Namen', async () => {
    const liste = await laeufeGet(sitzung('olaf'), `?prozess=${PZ}`);
    expect(liste.status).toBe(200);
    const j = JSON.parse(liste.text) as { laeufe: { id: string; version: number; status: string }[] };
    expect(j.laeufe.length).toBeGreaterThanOrEqual(3);
    const eins = await laeufeGet(sitzung('pia'), `?lauf=${j.laeufe[0].id}`);
    expect(eins.status).toBe(200);
    for (const x of ['Erika', 'example.invalid', 'Max']) expect(liste.text + eins.text).not.toContain(x);
  });
  it('Probelauf-Route: Dienstweg 403; Sitzung → Zeilen, schreibt nichts', async () => {
    expect((await probe(dienst('pia'), { prozessId: PZ, quelle: 'version' })).status).toBe(403);
    const vorher = alleDateien();
    const r = await probe(sitzung('pia'), { prozessId: PZ, quelle: 'version', fall: 'beispiel' });
    expect(r.status).toBe(200);
    expect((JSON.parse(r.text) as { schritte: unknown[] }).schritte.length).toBeGreaterThan(0);
    expect(alleDateien()).toEqual(vorher);
  });
  it('Starten per Route: nur per Sitzung (Dienstweg 403), mit anfrageId (einmalig — derselbe Klick startet nicht zweimal)', async () => {
    const { POST } = await import('@/app/api/prozesse/laeufe/route');
    const los = (kopf: Record<string, string>) => POST(new Request('http://test/api/prozesse/laeufe', { method: 'POST', headers: kopf, body: JSON.stringify({ aktion: 'starten', prozess: PZ, fall: { art: 'deal', id: 'ch-mail' }, anfrageId: 'anfrage-route-01' }) }));
    expect((await los(dienst('pia'))).status).toBe(403);
    const a = await los(sitzung('pia'));
    const b = await los(sitzung('pia'));
    expect(a.status).toBe(200);
    const ja = await a.json() as { lauf: string };
    const jb = await b.json() as { lauf: string };
    expect(jb.lauf).toBe(ja.lauf);
    expect((await laeufe()).laeufe.filter(l => l.prozessId === PZ && l.fall.id === 'ch-mail')).toHaveLength(1);
  });
});

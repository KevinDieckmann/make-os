// ─── Prozesse · Werkstatt bau-fertig — Probelauf mit Testdaten, „Weg annehmen“, „Nur diesen Schritt“ / „Bis hier“ (Server, 22.10.; Punkte 9–10) ─────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell. Geprüft: der Probelauf nimmt die Testdaten des Prozesses (nur erfunden), die
// angenommenen Wege, testet einen Schritt bzw. bis hier und liefert die Ausgabe als Tabelle (JSON nur Kennungen) — und schreibt NICHTS (jede Datei bit-gleich),
// sendet nie (kein Versand-Aufruf). Route: Eingaben geprüft (400), Dienstweg 403.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import { definition, fk, schritt, konto, PZ, PZ2, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-probe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-probe';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const gesendet: unknown[] = [];
vi.mock('@/lib/inbox/senden-server', () => ({ inboxSenden: async (...a: unknown[]) => { gesendet.push(a); return { status: 200, body: { ok: true } }; } }));

const H = 'haus-probe';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}), 'content-type': 'application/json' });
let S: typeof import('@/lib/prozesse/lauf-server');
let SL = '';

const WEG: ProzessDefinition = definition([
  schritt(10, 'Anrufen', 1),
  schritt(12, 'Passt es?', 2, { form: 'entscheidung', zweige: { nein: fk(20) } }),
  schritt(13, 'Fertig', 3, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  schritt(20, 'Abgesagt', 4, { form: 'ende', ende: { ergebnis: 'abbruch' } }),
], { laeuftAls: 'pia' });
const eintrag = (id: string, def: ProzessDefinition, extra: Partial<ProzessEintrag> = {}): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status: 'probelauf', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }], ...extra,
});
function alleDateien(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) geh(p); else raus[path.relative(ordner, p)] = readFileSync(p, 'utf8'); } };
  geh(ordner);
  return raus;
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), chancen: [{ id: 'ch-echt', titel: 'Probe', kontaktIds: ['c-erika'], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: J, geaendert: J }] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Echt', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01',
    einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Formular', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja.', wortlautVersion: 'v1', belegRef: 'Gespräch' }] }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { schlossSetzen, schlossKennung } = await import('@/lib/prozesse/schloss');
  SL = schlossKennung(fk(30));
  const MAIL = schlossSetzen(definition([
    schritt(30, 'Danke-Mail', 1, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'gmail', an: 'fall.kontakt', betreff: 'Danke, {{kontakt.vorname}}', text: 'Schön, dass wir gesprochen haben.' } } }),
    schritt(31, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ], { laeuftAls: 'pia' })).definition;
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [
    eintrag(PZ, WEG, { testdaten: { annahmen: { [fk(12)]: 'nein' } } }),
    eintrag(PZ2, MAIL, { testdaten: { platzhalter: { 'kontakt.vorname': 'Tina' }, empfaenger: { name: 'Tina Probe', email: 'tina@probe.invalid' } } }),
  ] });
  S = await import('@/lib/prozesse/lauf-server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Probelauf mit Testdaten und „Weg annehmen“ — schreibt nichts, sendet nie', () => {
  it('ohne Angabe gelten die gespeicherten Annahmen; mit Angabe die neuen; jede Datei bleibt bit-gleich', async () => {
    const vorher = alleDateien();
    const a = await S.probelauf({ prozessId: PZ, quelle: 'version', fall: 'beispiel', person: 'pia' });
    expect(a.ok && a.schritte.map(x => x.knotenId)).toContain(fk(20));
    const b = await S.probelauf({ prozessId: PZ, quelle: 'version', fall: 'beispiel', person: 'pia', annahmen: { [fk(12)]: 'ja' } });
    expect(b.ok && b.schritte.map(x => x.knotenId)).toContain(fk(13));
    expect(alleDateien()).toEqual(vorher);
    expect(gesendet).toEqual([]);
  });
  it('„Nur diesen Schritt“ an der Mail: der Schritt und sein Schloss — würde senden an den erfundenen Empfänger der Testdaten; JSON nur Kennungen', async () => {
    const vorher = alleDateien();
    const r = await S.probelauf({ prozessId: PZ2, quelle: 'entwurf', fall: 'beispiel', person: 'pia', nur: fk(30), ausgabe: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.schritte.map(x => x.knotenId)).toEqual([fk(30), SL]);
    const s = r.schritte[1];
    expect(s.status).toBe('freigabe');
    const t = s.ausgabe!.zeilen.map(z => `${z.feld}: ${z.wert}`).join('\n');
    expect(t).toMatch(/würde senden \(Mail\) — erst nach der Freigabe/);
    expect(t).toContain('Tina Probe <tina@probe.invalid>');
    expect(t).toContain('Betreff: Danke, Tina');
    expect(JSON.stringify(s.ausgabe!.json)).not.toMatch(/Tina|@/);
    expect(alleDateien()).toEqual(vorher);
    expect(gesendet).toEqual([]);
  });
  it('„Bis hier“ endet an diesem Schritt; nicht erreicht → Hinweis; unbekannter Schritt → 404', async () => {
    const r = await S.probelauf({ prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', person: 'pia', bis: fk(12), annahmen: {} });
    expect(r.ok && r.schritte.at(-1)?.knotenId).toBe(fk(12));
    const n = await S.probelauf({ prozessId: PZ, quelle: 'entwurf', fall: 'beispiel', person: 'pia', bis: fk(13) });
    expect(n.ok && n.hinweis).toBe('bis-nicht-erreicht');
    expect(await S.probelauf({ prozessId: PZ, quelle: 'entwurf', person: 'pia', nur: fk(99) })).toMatchObject({ ok: false, status: 404 });
  });
  it('ein echter Fall: Inhalte live, ohne dass etwas gespeichert wird (nur der Fall-Bezug im Probelauf)', async () => {
    const vorher = alleDateien();
    const r = await S.probelauf({ prozessId: PZ2, quelle: 'entwurf', fall: { art: 'deal', id: 'ch-echt' }, person: 'pia', nur: fk(30), ausgabe: true });
    expect(r.ok && r.echterFall).toBe(true);
    expect(r.ok && r.schritte[1].ausgabe?.zeilen.find(z => z.feld === 'An')?.wert).toContain('erika@example.invalid');
    expect(alleDateien()).toEqual(vorher);
  });
});

describe('Route /api/prozesse/probelauf — neue Eingaben geprüft', () => {
  const probe = async (kopf: Record<string, string>, body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/prozesse/probelauf/route');
    const r = await POST(new Request('http://test/api/prozesse/probelauf?space=business', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
    return { status: r.status, j: await r.json() as Record<string, unknown> };
  };
  it('Dienstweg 403, fremder Haushalt 403; falsche Annahmen, nur+bis zusammen → 400', async () => {
    expect((await probe(dienst('pia'), { prozessId: PZ, nur: fk(30) })).status).toBe(403);
    expect((await probe(sitzung('gast'), { prozessId: PZ })).status).toBe(403);
    expect((await probe(sitzung('pia'), { prozessId: PZ, annahmen: { [fk(12)]: 'vielleicht' } })).status).toBe(400);
    expect((await probe(sitzung('pia'), { prozessId: PZ, nur: fk(10), bis: fk(12) })).status).toBe(400);
  });
  it('mit Ausgabe und Beispiel: Zeilen mit Tabelle, nichts geschrieben', async () => {
    const vorher = alleDateien();
    const r = await probe(sitzung('pia'), { prozessId: PZ2, quelle: 'entwurf', fall: 'beispiel', nur: fk(30), ausgabe: true });
    expect(r.status).toBe(200);
    const schritte = r.j.schritte as { ausgabe?: { zeilen: unknown[] } }[];
    expect(schritte.some(x => (x.ausgabe?.zeilen.length ?? 0) > 0)).toBe(true);
    expect(alleDateien()).toEqual(vorher);
  });
});

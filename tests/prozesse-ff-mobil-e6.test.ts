// ─── Werkstatt am Handy — Texte, Fristen/Dauer und Zuständige ändern (22.10., E6, Entscheidung „Am Handy Texte & Fristen ändern“) ─────────────────────────────
// Am Handy: Liste der Schritte mit „Bearbeiten“ je Schritt, eine kleine Maske (Eingaben 16 px, Tippziele ≥ 44 px); ändern nur Texte, Fristen/Dauer und Zuständige —
// Bauen bleibt am Rechner. Gespeichert über DENSELBEN Entwurf (Stand/409, gleiche Rechte, veröffentlichen wie am Rechner):
//   · rein: Felder und Wirkung je Schritt (Paket: Ops des Fulfillment-Editors `schritt`/`phase`; Prozess: nur Titel, Frist, Masken-Texte/-Zahlen/-Personen, Dauer
//     eines Wartens) — Kennung, Form, Zweige, Phase, Rang bleiben; das Ergebnis ist speicherbar
//   · Route: die am Handy geänderte Fassung geht über `paket-entwurf` (200, „nur Business“ 403, alter Stand 409)
//   · Oberfläche (Quelle): 16 px, ≥ 44 px, am Handy nur über die Wächter-Funktionen
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-mobil-e6-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-mobil-e6';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { MOBIL_OPS, paketMobilFelder, paketMobilOps, werkstattMobilAnwenden, werkstattMobilFelder } from '@/lib/prozesse/mobil-felder';
import { paketBearbeiten } from '@/lib/prozesse/fulfillment-bearbeiten';
import { vorlageVon } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { definitionPruefen, sperrtSpeichern } from '@/lib/prozesse/definition-pruefen';
import type { ProzessVorlage } from '@/lib/fulfillment/typen';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

const J = '2026-10-22T08:00:00.000Z';
let nr = 0;
const neueId = (p: string) => `${p}-00000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`;
const PAKET: ProzessVorlage = {
  id: 'fp-e6', art: 'paket', titel: 'Probe-Paket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
  knoten: [
    { id: 'fk-w', titel: 'Probe-Paket', rang: 1 }, { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1 },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1, form: 'termin', frist: 3, zustaendig: 'intern' },
    { id: 'fk-b', elternId: 'fk-p1', titel: 'Fragebogen', rang: 2, form: 'schritt', zustaendig: 'kunde' },
  ],
};
const ohne = (k: object, felder: string[]) => JSON.stringify(Object.fromEntries(Object.entries(k).filter(([f]) => !felder.includes(f))));

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Paket am Handy (rein)', () => {
  it('Felder: Schritt = Titel, Frist, Zuständig; Phase = Titel', () => {
    expect(paketMobilFelder(PAKET.knoten[2], 'schritt').map(f => [f.id, f.wert])).toEqual([['titel', 'Kick-off'], ['frist', 3], ['zustaendig', 'intern']]);
    expect(paketMobilFelder(PAKET.knoten[1], 'phase').map(f => f.id)).toEqual(['titel']);
  });
  it('Ops nur `schritt`/`phase` mit genau diesen Feldern; nichts geändert → keine Op; die Regeln des Fulfillment-Editors wirken — Struktur bleibt', () => {
    const ops = paketMobilOps('fk-a', 'schritt', { titel: 'Kick-off mit Agenda', frist: '5', zustaendig: 'beide' });
    expect(ops).toEqual([{ op: 'schritt', id: 'fk-a', titel: 'Kick-off mit Agenda', frist: 5, zustaendig: 'beide' }]);
    expect(ops.every(o => MOBIL_OPS.includes(o.op))).toBe(true);
    expect(paketMobilOps('fk-a', 'schritt', {})).toEqual([]);
    expect(paketMobilOps('fk-p1', 'phase', { titel: 'Auftakt' })).toEqual([{ op: 'phase', id: 'fk-p1', titel: 'Auftakt' }]);
    expect(paketMobilOps('fk-a', 'schritt', { zustaendig: 'boese' })).toEqual([]);
    const r = paketBearbeiten(PAKET, [], [...ops, ...paketMobilOps('fk-b', 'schritt', { frist: null })], { person: 'pia', jetzt: J, neueId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.vorlage.knoten.find(k => k.id === 'fk-a')!;
    expect(a).toMatchObject({ titel: 'Kick-off mit Agenda', frist: 5, zustaendig: 'beide', form: 'termin', elternId: 'fk-p1', rang: 1 });
    expect(r.vorlage.knoten.map(k => [k.id, k.elternId ?? null, k.form ?? null])).toEqual(PAKET.knoten.map(k => [k.id, k.elternId ?? null, k.form ?? null]));
  });
});

describe('Prozess der Werkstatt am Handy (rein)', () => {
  const fb1 = vorlageVon('fb-01')!.definition;
  const k = (lokal: string) => fb1.knoten.find(x => x.id === `fb-01:${lokal}`)!;
  const team = [{ id: 'rolle:zustaendig', label: 'Zuständig im Fall' }, { id: 't-probe', label: 'Probe' }];
  it('Felder je Form: Mail = Titel, Betreff, Text (nie Postfach/Empfänger); Aufgabe = Titel, Text, Frist, Wer; Warten = Höchstdauer', () => {
    expect(werkstattMobilFelder(k('e1'), team).map(f => f.id)).toEqual(['titel', 'werte.betreff', 'werte.text']);
    const a = werkstattMobilFelder(k('a1'), team);
    expect(a.map(f => f.id)).toEqual(['titel', 'werte.titel', 'werte.wer', 'werte.fristTage', 'werte.beschreibung']);
    expect(a.find(f => f.id === 'werte.wer')).toMatchObject({ art: 'wahl', wert: 'rolle:zustaendig', optionen: team });
    expect(werkstattMobilFelder(k('w1')).map(f => [f.id, f.wert])).toEqual([['titel', 'Auf die Lieferung warten'], ['warten.hoechstensTage', 3]]);
  });
  it('Anwenden ändert NUR diese Felder (Kennung, Form, Zweige, Schloss, Phase bleiben); Fremdes wird ignoriert; leerer Titel bleibt; Ergebnis speicherbar', () => {
    const e1 = k('e1');
    const n = werkstattMobilAnwenden(e1, { titel: 'Freundliche Erinnerung', 'werte.betreff': 'Kurz nachgefragt', form: 'ende', 'werte.postfach': 'x', zweige: 'y' } as never);
    expect(n).toMatchObject({ id: e1.id, form: e1.form, titel: 'Freundliche Erinnerung' });
    expect(n.katalog?.werte?.betreff).toBe('Kurz nachgefragt');
    expect(n.katalog?.werte?.postfach).toBe(e1.katalog?.werte?.postfach);
    expect(ohne(n, ['titel', 'katalog'])).toBe(ohne(e1, ['titel', 'katalog']));
    expect(werkstattMobilAnwenden(e1, { titel: '  ' }).titel).toBe(e1.titel);
    const w = werkstattMobilAnwenden(k('w1'), { 'warten.hoechstensTage': '5' });
    expect(w.warten).toMatchObject({ art: 'ereignis', ereignis: 'kunde-geliefert', hoechstensTage: 5 });
    const def: ProzessDefinition = { ...fb1, knoten: fb1.knoten.map(x => (x.id === n.id ? n : x.id === w.id ? w : x)) };
    expect(sperrtSpeichern(definitionPruefen(def, {}))).toBe(false);
  });
});

describe('Oberfläche (Quelle)', () => {
  const quelle = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8');
  it('Maske: Eingaben 16 px (`eingabe`), Tippziele ≥ 44 px (ZIEL.handy), Formular sendet über onSubmit', () => {
    const s = quelle('components/os/prozesse/MobilBearbeiten.tsx');
    expect(s).toMatch(/style=\{eingabe\}|\.\.\.eingabe/);
    expect(s).toContain('minHeight: ZIEL.handy');
    expect(s).toContain('onSubmit={speichern}');
    expect(s).not.toMatch(/onClick=\{speichern\}/);
  });
  it('am Handy nur über die Wächter-Funktionen: Paket nur MOBIL_OPS, Prozess nur werkstattMobilAnwenden', () => {
    const p = quelle('components/os/prozesse/PaketWerkstatt.tsx');
    expect(p).toContain('mobilDarf && ops.every(o => MOBIL_OPS.includes(o.op))');
    expect(p).toContain('onOps(ops, true)');
    const w = quelle('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain('mitFassung(f => ersetzen(f, werkstattMobilAnwenden(k, w))');
    expect(w).toContain("const mobilDarf = nurAnsehen && !!rechte?.entwurf && !versionAnsicht && eintrag?.status !== 'archiviert'");
  });
});

// ══ Route: derselbe Entwurf ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Hd = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, Hd>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const H = 'haus-e6';
let paketId = '';
beforeAll(async () => {
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'partnerin', 'mitglied', { haushalt: H, finanzRecht: 'business' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', leererBestand());
  await d.saveJson('kontakte', { kontakte: [] });
  paketId = (await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Handy-Paket', phase: 'Start', anfrageId: 'e6-neu' })).j.vorlageId as string;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Am Handy geändert — gespeichert über denselben Entwurf', () => {
  it('Phase umbenannt am Handy → paket-entwurf 200; „nur Business“ 403; alter Stand 409', async () => {
    const a = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, `?paket=${paketId}&space=business`);
    const v = a.j.paket as ProzessVorlage;
    const phase = v.knoten.find(k => k.elternId && !v.knoten.some(x => x.id === k.elternId && x.elternId))!;
    const r = paketBearbeiten(v, [], paketMobilOps(phase.id, 'phase', { titel: 'Auftakt' }), { person: 'pia', jetzt: J, neueId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('partnerin'), { aktion: 'paket-entwurf', paketId, stand: a.j.arbeitsStand, vorlage: r.vorlage }, '?space=business')).status).toBe(403);
    const ok = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId, stand: a.j.arbeitsStand, vorlage: r.vorlage }, '?space=business');
    expect(ok.status, JSON.stringify(ok.j)).toBe(200);
    expect(((ok.j.entwurf as { vorlage: ProzessVorlage }).vorlage.knoten.find(k => k.id === phase.id))!.titel).toBe('Auftakt');
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId, stand: a.j.arbeitsStand, vorlage: r.vorlage }, '?space=business')).status).toBe(409);
  });
});

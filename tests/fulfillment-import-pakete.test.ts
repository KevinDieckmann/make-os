// ─── Fulfillment — Import von Paket-Vorlagen im Ablauf-Format des Prozess-Editors (17.10., Bibliothek) ───────────────────────────────────
// Format „pakete“ (lib/fulfillment/prozesse/import.ts): Phasen mit Fluss (Formen, Fristen, Zweige ja/nein), Abstimmungspunkte, Gruppen, Bausteine per Kennung.
// Geprüft: dieselbe Säuberung wie der Editor (Formen, Frist 0…365, Zweige nur an Entscheidung/Erinnerung, gleiche Phase, Schleife nur über Erinnerung), Ebenen
// (Bausteine auf Ebene 5 im Sammel-Teilprozess), fehlende Bausteine blockieren, wiederholbar (gleich), Konflikt nur mit „Import nehmen“, Vorschau mit Zahlen
// und Duplikaten, Fall-Start (Onboarding in der Phase „Onboarding“, Frist am ersten Schritt), Rückgängig. Route: nur volle Mitglieder, Dienstweg 403, Stand 409.
// Erfundene Daten (@example.invalid), eigener Datenordner, kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { leerVorlagen } from '@/lib/fulfillment/lesen';
import { importLesen, importVorschau, importAnwenden, importRueckgaengig, urheberVorschlag } from '@/lib/fulfillment/prozesse/import';
import { editorModell } from '@/lib/fulfillment/prozesse/editor';
import { phasenAbschnitte } from '@/lib/fulfillment/prozesse/fluss-struktur';
import { fallStarten, OB_TEIL_ID } from '@/lib/fulfillment/prozesse/fall';
import { ebeneVon, kinderVon } from '@/lib/fulfillment/regeln';
import type { VorlagenDatei } from '@/lib/fulfillment/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-import-pakete-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-import-pakete';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const JETZT = '2026-10-17T09:00:00.000Z';
const HEUTE = '2026-10-17';
let N = 0;
const kid = () => `fk-x${++N}`;
const ik = (laufId = 'fi-1') => ({ person: 'pia', jetzt: JETZT, heute: HEUTE, datei: 'probe.json', laufId });
function ok<D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D {
  if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
  return r.datei;
}
const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const BAUSTEINE = {
  vorlagen: [
    { id: 'probe-mail', art: 'mail', titel: 'Erinnerungs-Mail', zweck: 'Erfunden.', text: 'Betreff: Kurz nachgefragt' },
    { id: 'probe-liste', art: 'checkliste', titel: 'Zugangsliste', zweck: 'Erfunden.', pruefen_vor_verkauf: true, pruefgrund: 'Struktur aus Probe-Unterlagen: vor Verkauf prüfen', zusatz: 'telefonie' },
    { id: 'probe-intern', art: 'dokument', titel: 'Interne Probe', zweck: 'Erfunden.', nur_intern: true },
  ],
};
/** Ein erfundenes Paket mit allen Formen, Gruppe, Abstimmungspunkten und einer Schleife Erinnerung → Entscheidung. */
const PAKET = {
  format: 'make-os/pakete',
  pakete: [{
    schluessel: 'probe-paket', titel: 'Probe-Paket', beschreibung: 'Erfunden für Tests.',
    abstimmungen: [{ id: 'F0', titel: 'Rahmen abgestimmt', wer: 'beide' }, { id: 'A1', titel: 'Ergebnis abgenommen', wer: 'kunde' }],
    rollen: [{ id: 'leitung', titel: 'Leitung' }],
    phasen: [
      {
        id: 'start', titel: 'Onboarding', abstimmung: 'F0', dauerTage: 14,
        fluss: [
          { id: 'begruessen', titel: 'Begrüßung senden', form: 'nachricht', frist: 0, zustaendig: 'intern' },
          { id: 'zugang', titel: 'Zugänge anfordern', form: 'nachricht', frist: 1, bausteine: ['probe-liste'] },
          { id: 'da', titel: 'Zugänge nach 5 Tagen da?', form: 'entscheidung', frist: 4, zweige: { nein: 'nachfassen' } },
          { id: 'nachfassen', titel: 'Follow-up-Mail', form: 'erinnerung', bausteine: ['probe-mail'], zweige: { ja: 'da' } },
          { id: 'kickoff', titel: 'Kick-off', form: 'termin', frist: 2, zustaendig: 'beide', kundeSichtbar: true, pos: { x: 10, y: 20 } },
        ],
      },
      {
        id: 'arbeit', titel: 'Umsetzung', abstimmung: 'A1', kreislauf: ['fulfillment'],
        fluss: [
          { gruppe: 'Vor dem Termin', id: 'vor', fluss: [{ id: 'vorbereiten', titel: 'Unterlagen vorbereiten', bausteine: ['probe-intern'] }] },
          { gruppe: 'Nach dem Termin', id: 'nach', fluss: [{ id: 'tag1', titel: 'Tag 1: nachfassen', form: 'nachricht', dauerTage: 1 }, { id: 'tag3', titel: 'Tag 3: prüfen', dauerTage: 3, frist: 2 }] },
        ],
      },
    ],
  }],
};
const mitBausteinen = () => ok(importAnwenden(leerVorlagen(), BAUSTEINE, {}, ik('fi-b'), kid));

describe('Format „pakete“: lesen und prüfen wie der Editor', () => {
  it('liest Phasen, Fluss, Gruppen, Formen, Fristen und Zweige; `pos` kommt seit 17.10. spät mit (wie im Editor)', () => {
    const g = importLesen(PAKET);
    expect(g.format).toBe('pakete');
    expect(g.fehler).toEqual([]);
    expect(g.blockiert).toBe(false);
    const v = g.pakete[0].v;
    expect(v).toMatchObject({ id: 'fp-imp-pk-probe-paket', art: 'paket', titel: 'Probe-Paket', phasenVonHand: true });
    expect(v.freigaben.map(f => f.id)).toEqual(['F0', 'A1']);
    const t = (titel: string) => v.knoten.find(k => k.titel === titel)!;
    expect(t('Zugänge nach 5 Tagen da?')).toMatchObject({ form: 'entscheidung', frist: 4, zweige: { nein: t('Follow-up-Mail').id } });
    expect(t('Follow-up-Mail').zweige).toEqual({ ja: t('Zugänge nach 5 Tagen da?').id });
    expect(t('Kick-off')).toMatchObject({ form: 'termin', frist: 2, zustaendig: 'beide', kundeSichtbar: true });
    expect(t('Kick-off').pos).toEqual({ x: 10, y: 20 });
    expect(t('Onboarding')).toMatchObject({ freigabe: 'F0', dauerTage: 14, kundeSichtbar: true });
  });

  it('Schritte mit Bausteinen stehen in EINEM Sammel-Teilprozess (heißt wie die Phase), Gruppen als benannte Teilprozesse', () => {
    const d = ok(importAnwenden(mitBausteinen(), PAKET, {}, ik(), kid));
    const v = d.prozesse.find(p => p.id === 'fp-imp-pk-probe-paket')!;
    const phase = v.knoten.find(k => k.titel === 'Onboarding' && ebeneVon(k, v.knoten) === 2)!;
    const sammel = kinderVon(phase.id, v.knoten);
    expect(sammel).toHaveLength(1);
    expect(sammel[0].titel).toBe('Onboarding');
    expect(kinderVon(sammel[0].id, v.knoten).map(k => k.titel)).toEqual(['Begrüßung senden', 'Zugänge anfordern', 'Zugänge nach 5 Tagen da?', 'Follow-up-Mail', 'Kick-off']);
    const bk = v.knoten.find(k => k.bausteinId === 'fb-imp-probe-liste')!;
    expect(ebeneVon(bk, v.knoten)).toBe(5);
    expect(bk.titel).toBe('Zugangsliste');
    const arbeit = v.knoten.find(k => k.titel === 'Umsetzung')!;
    expect(phasenAbschnitte(v.knoten, arbeit.id).map(a => [a.art, a.gruppe?.titel])).toEqual([['gruppe', 'Vor dem Termin'], ['gruppe', 'Nach dem Termin']]);
    // Der Editor zeigt das Paket: zwei Phasen mit Abstimmungspunkt, die Erinnerung als Nein-Zweig neben der Entscheidung.
    const m = editorModell(v, d.bausteine);
    expect(m.phasen.map(p => [p.titel, p.abstimmung?.id])).toEqual([['Onboarding', 'F0'], ['Umsetzung', 'A1']]);
    const fluss = m.phasen[0].abschnitte.flatMap(a => a.knoten);
    expect(fluss.find(k => k.titel === 'Follow-up-Mail')!.neinVon).toBe(fluss.find(k => k.titel === 'Zugänge nach 5 Tagen da?')!.id);
  });

  it('lehnt ab wie der Editor: Nein-Zweig an einem Schritt, Zweig in eine andere Phase, Kreis ohne Erinnerung, Frist über 365, unbekannte Form', () => {
    const mit = (f: (p: typeof PAKET.pakete[0]) => void) => { const x = kopie(PAKET); f(x.pakete[0]); return importLesen(x); };
    expect(mit(p => { (p.phasen[0].fluss[0] as Record<string, unknown>).zweige = { nein: 'zugang' }; }).fehler.join(' ')).toMatch(/Nein-Zweig hat nur eine Entscheidung/);
    expect(mit(p => { (p.phasen[0].fluss[2] as Record<string, unknown>).zweige = { nein: 'tag1' }; }).fehler.join(' ')).toMatch(/andere Phase/);
    expect(mit(p => { (p.phasen[0].fluss[2] as Record<string, unknown>).zweige = { ja: 'begruessen' }; }).fehler.join(' ')).toMatch(/Kreis/);
    expect(mit(p => { (p.phasen[0].fluss[0] as Record<string, unknown>).frist = 400; }).fehler.join(' ')).toMatch(/Frist/);
    expect(mit(p => { (p.phasen[0].fluss[0] as Record<string, unknown>).form = 'wolke'; }).fehler.join(' ')).toMatch(/Form/);
    expect(mit(p => { (p.phasen[1].fluss[1] as Record<string, unknown>).id = 'start'; }).fehler.join(' ')).toMatch(/doppelt/);
    expect(mit(p => { p.phasen[0].abstimmung = 'F9'; }).fehler.join(' ')).toMatch(/F9/);
    expect(mit(p => { p.phasen[0].abstimmung = 'F9'; }).blockiert).toBe(true);
  });

  it('fehlende Bausteine blockieren: Vorschau nennt sie, Übernehmen schreibt nichts (400)', () => {
    const v = importVorschau(PAKET, leerVorlagen(), 'pakete.json');
    expect(v.paketVorlagen[0].fehlend.sort()).toEqual(['probe-intern', 'probe-liste', 'probe-mail']);
    expect(v.fehler.join(' ')).toMatch(/zuerst die Bausteine/);
    const r = importAnwenden(leerVorlagen(), PAKET, {}, ik(), kid);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.status).toBe(400);
    // In EINER Datei mit ihren Bausteinen geht es auch.
    const beides = { ...kopie(PAKET), vorlagen: BAUSTEINE.vorlagen };
    const d = ok(importAnwenden(leerVorlagen(), beides, {}, ik('fi-beides'), kid));
    expect(d.bausteine).toHaveLength(3);
    expect(d.prozesse).toHaveLength(1);
  });
});

describe('Vorschau, Wiederholung, Konflikt, Rückgängig', () => {
  it('Vorschau zählt Abläufe, Bausteine, Marken und je Paket Phasen, Schritte, Entscheidungen, Erinnerungen, Bausteine', () => {
    const vb = importVorschau(BAUSTEINE, leerVorlagen(), 'bausteine.json');
    expect(vb.zahlen).toMatchObject({ ablaeufe: 0, bausteine: 3, vorVerkauf: 1, nurIntern: 1 });
    const d = mitBausteinen();
    const vp = importVorschau(PAKET, d, 'pakete.json');
    expect(vp.zahlen.ablaeufe).toBe(1);
    expect(vp.paketVorlagen[0]).toMatchObject({ status: 'neu', phasen: 2, schritte: 8, entscheidungen: 1, erinnerungen: 1, nachrichten: 3, termine: 1, abstimmungen: 2, bausteine: 3, fehlend: [] });
    expect(vp.fehler).toEqual([]);
  });

  it('Duplikate: gleicher Titel mit anderer Kennung (Baustein und Vorlage) — beide bleiben', () => {
    const d: VorlagenDatei = mitBausteinen();
    d.bausteine.push({ ...d.bausteine[0], id: 'fb-hand-1', vonHand: true });
    d.prozesse.push({ id: 'fp-hand-1', art: 'paket', titel: 'Probe-Paket', knoten: [{ id: 'fk-hand-w', titel: 'Probe-Paket', rang: 1 }], uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: JETZT, geaendertVon: 'pia' });
    const v = importVorschau({ ...kopie(PAKET), vorlagen: BAUSTEINE.vorlagen }, d, 'x.json');
    expect(v.duplikate.join(' ')).toMatch(/Erinnerungs-Mail/);
    expect(v.duplikate.join(' ')).toMatch(/Probe-Paket/);
    expect(v.zahlen.duplikate).toBe(v.duplikate.length);
  });

  it('wiederholbar: derselbe Import noch einmal ist „gleich“ und ändert nichts', () => {
    const d1 = ok(importAnwenden(mitBausteinen(), PAKET, {}, ik('fi-1'), kid));
    expect(importVorschau(PAKET, d1, 'p.json').paketVorlagen[0].status).toBe('gleich');
    const d2 = ok(importAnwenden(d1, PAKET, {}, ik('fi-2'), kid));
    expect(d2.prozesse).toEqual(d1.prozesse);
  });

  it('von Hand geändert (Editor) → Konflikt: ohne „Import nehmen“ bleibt die Fassung, mit Haken die Datei; der Papierkorb bleibt', () => {
    const d1 = ok(importAnwenden(mitBausteinen(), PAKET, {}, ik('fi-1'), kid));
    const hand = kopie(d1);
    const v = hand.prozesse[0];
    v.titel = 'Von Hand umbenannt';
    v.geaendert = '2026-10-17T10:00:00.000Z';
    v.papierkorb = [{ id: 'fk-weg', am: '2026-10-17T10:00:00.000Z', von: 'pia', art: 'schritt', knoten: [{ id: 'fk-weg', titel: 'Weg', rang: 1 }] }];
    expect(importVorschau(PAKET, hand, 'p.json').paketVorlagen[0].status).toBe('konflikt');
    const ohne = ok(importAnwenden(hand, PAKET, {}, ik('fi-2'), kid));
    expect(ohne.prozesse[0].titel).toBe('Von Hand umbenannt');
    const mit = ok(importAnwenden(hand, PAKET, { nehmen: { 'fp-imp-pk-probe-paket': true } }, ik('fi-3'), kid));
    expect(mit.prozesse[0].titel).toBe('Probe-Paket');
    expect(mit.prozesse[0].papierkorb?.map(e => e.id)).toEqual(['fk-weg']);
    expect(mit.prozesse[0].fassung).toBe(v.fassung + 1);
  });

  it('Rückgängig nimmt das neue Paket wieder heraus', () => {
    const d1 = ok(importAnwenden(mitBausteinen(), PAKET, {}, ik('fi-r'), kid));
    const r = importRueckgaengig(d1, 'fi-r', JETZT);
    expect(r.ok && r.datei.prozesse).toEqual([]);
    expect(r.bericht?.entfernt).toBe(1);
  });

  it('Bausteine: Array auf oberster Ebene gilt als Liste; pruefgrund wird der Grund, zusatz ein Schlagwort', () => {
    const g = importLesen(BAUSTEINE.vorlagen);
    expect(g.format).toBe('bausteine');
    expect(g.bausteine).toHaveLength(3);
    const liste = g.bausteine.find(x => x.q === 'probe-liste')!;
    expect(liste.urheber).toBe('Struktur aus Probe-Unterlagen: vor Verkauf prüfen');
    expect(liste.b.tags).toContain('zusatz:telefonie');
    expect(urheberVorschlag({ pruefenVorVerkauf: true })).toMatch(/vor Verkauf prüfen/);
  });
});

describe('Fall aus einem importierten Paket', () => {
  it('Onboarding-Schritte landen in der Phase „Onboarding“, der erste Schritt ist ab dem Start fällig, Zweige und Formen kommen mit', () => {
    const d = ok(importAnwenden(mitBausteinen(), PAKET, {}, ik(), kid));
    const v = d.prozesse[0];
    const f = fallStarten({ mandatId: 'm-probe', vorlage: v, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: p => `${p}-${++N}` });
    const phase = f.knoten.find(k => k.titel === 'Onboarding' && ebeneVon(k, f.knoten) === 2)!;
    expect(f.knoten.find(k => k.id === OB_TEIL_ID)?.elternId).toBe(phase.id);
    expect(f.knoten.filter(k => k.id === 'fk-ob')).toEqual([]);
    expect(f.knoten.find(k => k.titel === 'Begrüßung senden')?.faelligAm).toBe(HEUTE);
    expect(f.knoten.find(k => k.titel === 'Zugänge nach 5 Tagen da?')).toMatchObject({ form: 'entscheidung', frist: 4 });
    expect(f.phasenVonHand).toBe(true);
  });
});

// ── Route ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(kopf: Record<string, string>, body: unknown): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import('@/app/api/fulfillment/import/route') as unknown as Record<string, H>;
  const r = await m.POST(new Request('http://test/api/fulfillment/import', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-pk' }),
    konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-pk' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-pk', finanzRecht: 'business' }),
  ], einladungen: [] });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Route: nur volle Mitglieder, Stand, Reihenfolge Bausteine → Pakete', () => {
  it('„nur Business“ und Dienstweg → 403; volles Mitglied importiert Bausteine, dann Pakete; veraltete Vorschau → 409', async () => {
    const pakete = JSON.stringify(PAKET), bausteine = JSON.stringify(BAUSTEINE);
    expect((await rufe(sitzung('partnerin'), { aktion: 'vorschau', datei: 'p.json', inhalt: pakete })).status).toBe(403);
    expect((await rufe(dienst('pia'), { aktion: 'vorschau', datei: 'p.json', inhalt: pakete })).status).toBe(403);
    // Pakete vor den Bausteinen: die Vorschau nennt die fehlenden, Übernehmen schreibt nichts.
    const v0 = await rufe(sitzung('olaf'), { aktion: 'vorschau', datei: 'p.json', inhalt: pakete });
    expect(v0.status).toBe(200);
    expect((v0.j.vorschau as { paketVorlagen: { fehlend: string[] }[] }).paketVorlagen[0].fehlend.length).toBe(3);
    expect((await rufe(sitzung('olaf'), { aktion: 'uebernehmen', datei: 'p.json', inhalt: pakete, vorschauId: v0.j.vorschauId })).status).toBe(400);
    const vb = await rufe(sitzung('olaf'), { aktion: 'vorschau', datei: 'b.json', inhalt: bausteine });
    expect((await rufe(sitzung('olaf'), { aktion: 'uebernehmen', datei: 'b.json', inhalt: bausteine, vorschauId: vb.j.vorschauId })).status).toBe(200);
    // Die alte Vorschau der Pakete ist veraltet (die Bibliothek hat sich geändert).
    expect((await rufe(sitzung('olaf'), { aktion: 'uebernehmen', datei: 'p.json', inhalt: pakete, vorschauId: v0.j.vorschauId })).status).toBe(409);
    const v1 = await rufe(sitzung('olaf'), { aktion: 'vorschau', datei: 'p.json', inhalt: pakete });
    expect((v1.j.vorschau as { zahlen: { ablaeufe: number } }).zahlen.ablaeufe).toBe(1);
    const u = await rufe(sitzung('olaf'), { aktion: 'uebernehmen', datei: 'p.json', inhalt: pakete, vorschauId: v1.j.vorschauId });
    expect(u.status).toBe(200);
    expect(u.j.neu).toBe(1);
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    const d = await fulfillmentLesen('vorlagen');
    expect(d.prozesse.find(p => p.id === 'fp-imp-pk-probe-paket')?.knoten.some(k => k.form === 'entscheidung')).toBe(true);
  });
});

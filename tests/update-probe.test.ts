// ─── Update-Probe: die reine Vergleichs-Logik (lib/betrieb/update-probe.ts, 10.10.) ─────────────────────────────────────────
// Was als Verlust zählt — und was nicht: neue Felder/Einträge/Bestände sind in Ordnung, verschwundene Kennungen und Werte nicht,
// Reihenfolge spielt keine Rolle, Formänderungen mit erhaltenem Wert werden genannt, Ausnahmen brauchen einen Grund.
import { describe, it, expect } from 'vitest';
import {
  bestandBild, berichtMarkdown, eintraegeVon, formatPruefen, kanonisch, kennungVon, leer, mitGegenprobe, selbsttest, vergleiche, vergleicheBestand,
  ERLAUBT, type Schnappschuss,
} from '@/lib/betrieb/update-probe';

const schnapp = (bestaende: Record<string, unknown>, extra: Partial<Schnappschuss> = {}): Schnappschuss => ({
  ordner: '/probe', zeit: '2026-10-10T10:00:00.000Z',
  bestaende: Object.fromEntries(Object.entries(bestaende).map(([n, d]) => [n, bestandBild(n, d, 1)])),
  dateien: {}, beschaedigt: [], tageskopien: 0, ...extra,
});

describe('Hilfen', () => {
  it('leer: null, „“, [], {} — aber false und 0 sind Werte', () => {
    for (const w of [null, undefined, '', [], {}]) expect(leer(w)).toBe(true);
    for (const w of [false, 0, 'x', [1], { a: 1 }]) expect(leer(w)).toBe(false);
  });
  it('kanonisch: Reihenfolge der Schlüssel egal', () => {
    expect(kanonisch({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(kanonisch({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
  it('kennungVon: erster eindeutiger Schlüssel, nur wenn JEDES Element ihn trägt', () => {
    expect(kennungVon([{ id: 'a' }, { id: 'b' }])).toBe('id');
    expect(kennungVon([{ id: 'a' }, { id: 'a', uid: 'x' }])).toBeNull();
    expect(kennungVon([{ speicher: 'lena' }, { speicher: 'jonas' }])).toBe('speicher');
    expect(kennungVon(['text', { id: 'a' }])).toBeNull();
    expect(kennungVon([])).toBeNull();
  });
  it('eintraegeVon: Einträge mit Kennung in jeder Tiefe, sonst oberste Schlüssel', () => {
    const e = eintraegeVon({ tasks: [{ id: 't1', sub: [{ id: 'u1' }] }], projects: [{ id: 'p1' }] });
    expect(Object.keys(e).sort()).toEqual(['projects[id=p1]', 'tasks[id=t1]', 'tasks[id=t1].sub[id=u1]']);
    expect(Object.keys(eintraegeVon({ '2026-10-01': ['a'], '2026-10-02': ['b'] }))).toEqual(['2026-10-01', '2026-10-02']);
  });
});

describe('vergleicheBestand', () => {
  it('gleicher Inhalt in anderer Reihenfolge → keine Abweichung', () => {
    const r = vergleicheBestand('tasks', { tasks: [{ id: 'a', t: 1 }, { id: 'b', t: 2 }] }, { tasks: [{ id: 'b', t: 2 }, { id: 'a', t: 1 }] });
    expect(r.abweichungen).toEqual([]);
  });
  it('neue Felder, Einträge, Werte sind in Ordnung', () => {
    const r = vergleicheBestand('x', { l: [{ id: 'a', v: 1 }], s: ['x'] }, { l: [{ id: 'a', v: 1, neu: true }, { id: 'b' }], s: ['x', 'y'], mehr: 1 });
    expect(r.abweichungen).toEqual([]);
  });
  it('verschwundene Kennung → kennung-fehlt mit Stelle', () => {
    const r = vergleicheBestand('routinen', { routinen: [{ id: 'r1', label: 'A' }, { id: 'r2', label: 'B' }] }, { routinen: [{ id: 'r1', label: 'A' }] });
    expect(r.abweichungen).toEqual([expect.objectContaining({ art: 'kennung-fehlt', bestand: 'routinen', pfad: 'routinen[id=r2]' })]);
  });
  it('Feld verloren und Feld geändert — auch false und 0', () => {
    const r = vergleicheBestand('z', { l: [{ id: 'a', erledigt: false, n: 0, titel: 'T' }] }, { l: [{ id: 'a', erledigt: true, titel: 'T' }] });
    expect(r.abweichungen.map(a => `${a.art} ${a.pfad}`).sort()).toEqual(['wert-fehlt l[id=a].n', 'wert-geaendert l[id=a].erledigt']);
  });
  it('vorher leer → nachher darf fehlen', () => {
    expect(vergleicheBestand('z', { a: '', b: [], c: {}, d: null }, {}).abweichungen).toEqual([]);
  });
  it('Werte-Liste ohne Kennung als Menge: Reihenfolge egal, fehlender Wert gemeldet', () => {
    expect(vergleicheBestand('h', { '2026-10-01': ['a', 'b'] }, { '2026-10-01': ['b', 'a'] }).abweichungen).toEqual([]);
    const r = vergleicheBestand('h', { '2026-10-01': ['a', 'b'] }, { '2026-10-01': ['b'] });
    expect(r.abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: '2026-10-01[#0]', vorher: 'a' })]);
  });
  it('Objekte ohne Kennung: gleicher Inhalt zuerst, sonst der ähnlichste — nur das echte Fehlende wird gemeldet', () => {
    const vorher = { l: [{ name: 'a', wert: 1 }, { name: 'b', wert: 2, notiz: 'x' }] };
    const nachher = { l: [{ name: 'b', wert: 2 }, { name: 'a', wert: 1 }] };
    expect(vergleicheBestand('o', vorher, nachher).abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'l[#1].notiz' })]);
  });
  it('Formänderung im selben Eintrag (Text → { text }) ist kein Verlust, wird aber genannt', () => {
    const r = vergleicheBestand('crm', { mandate: [{ id: 'm1', ziele: ['Ziel A'] }] }, { mandate: [{ id: 'm1', ziele: [{ id: 'z0', text: 'Ziel A' }] }] });
    expect(r.abweichungen).toEqual([]);
    expect(r.formaenderungen).toEqual([expect.objectContaining({ bestand: 'crm', wert: 'Ziel A' })]);
  });
  it('Text verschwindet ganz (Säuberer verwirft Altform) → Verlust', () => {
    const r = vergleicheBestand('crm', { mandate: [{ id: 'm1', ziele: ['Ziel A', { text: 'B' }] }] }, { mandate: [{ id: 'm1', ziele: [{ id: 'z1', text: 'B' }] }] });
    expect(r.abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'mandate[id=m1].ziele[#0]', vorher: 'Ziel A' })]);
  });
  it('ein verlorenes Feld zählt nie als umgezogen, nur weil derselbe Wert schon vorher woanders im Eintrag stand', () => {
    const r = vergleicheBestand('tasks', { tasks: [{ id: 't', assignee: 'lena', angelegtVon: 'lena' }] }, { tasks: [{ id: 't', angelegtVon: 'lena' }] });
    expect(r.abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'tasks[id=t].assignee' })]);
    const liste = vergleicheBestand('crm', { mandate: [{ id: 'm', ziele: ['A', { text: 'A' }] }] }, { mandate: [{ id: 'm', ziele: [{ text: 'A' }] }] });
    expect(liste.abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'mandate[id=m].ziele[#0]' })]);
  });
  it('ein Wert zieht nie über Einträge hinweg um (anderer Eintrag mit demselben Text zählt nicht)', () => {
    const r = vergleicheBestand('l', { l: [{ id: 'a', t: 'gleich' }, { id: 'b', t: 'gleich' }] }, { l: [{ id: 'a', t: 'gleich' }, { id: 'b' }] });
    expect(r.abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'l[id=b].t' })]);
  });
  it('Objekt wird zu null → ganzer Teil fehlt', () => {
    expect(vergleicheBestand('k', { a: { b: 1 } }, { a: null }).abweichungen).toEqual([expect.objectContaining({ art: 'wert-fehlt', pfad: 'a' })]);
  });
});

describe('vergleiche (ganze Schnappschüsse)', () => {
  it('fehlender, unlesbarer und beschädigter Bestand → nicht verlustfrei', () => {
    const v = schnapp({ a: { x: 1 }, b: { y: 1 }, c: { z: 1 } });
    const n = schnapp({ a: { x: 1 }, c: { z: 1 } }, { beschaedigt: ['c.json.corrupt-123'] });
    n.bestaende.a = { ...n.bestaende.a, lesbar: false, fehler: 'Entschlüsselung fehlgeschlagen' };
    const e = vergleiche(v, n, { mitSchluessel: true, erlaubt: [] });
    expect(e.verlustfrei).toBe(false);
    expect(e.abweichungen.map(a => `${a.art}:${a.bestand}`).sort()).toEqual(['beschaedigt:c', 'bestand-fehlt:b', 'unlesbar:a']);
  });
  it('neue Bestände und Dateien sind in Ordnung', () => {
    const v = schnapp({ a: { x: 1 } });
    const n = schnapp({ a: { x: 1 }, neu: { y: 1 } }, { dateien: { 'dateien/h/d-1.bin': { pfad: 'dateien/h/d-1.bin', groesse: 3, form: 'MKOSDAT1', inhalt: 'f', offen: true } } });
    const e = vergleiche(v, n, { mitSchluessel: true });
    expect(e.verlustfrei).toBe(true);
    expect(e.neueBestaende).toEqual(['neu']);
    expect(e.neueDateien).toEqual(['dateien/h/d-1.bin']);
  });
  it('Datei fehlt oder anderer Inhalt → Abweichung', () => {
    const d = (inhalt: string) => ({ pfad: 'x', groesse: 1, form: 'MKOSDAT1' as const, inhalt, offen: true });
    const v = schnapp({}, { dateien: { a: { ...d('1'), pfad: 'a' }, b: { ...d('2'), pfad: 'b' } } });
    const n = schnapp({}, { dateien: { b: { ...d('3'), pfad: 'b' } } });
    expect(vergleiche(v, n).abweichungen.map(a => a.art).sort()).toEqual(['datei-fehlt', 'datei-geaendert']);
  });
  it('Ausnahmen: Zeitstempel aufgefrischt ja — rückwärts oder Text nein; jede Ausnahme mit Grund', () => {
    const v = schnapp({ k: { l: [{ id: 'a', geaendertAm: '2026-10-09T08:00:00.000Z', titel: 'T' }] } });
    const n = schnapp({ k: { l: [{ id: 'a', geaendertAm: '2026-10-10T09:00:00.000Z', titel: 'T' }] } });
    const e = vergleiche(v, n);
    expect(e.verlustfrei).toBe(true);
    expect(e.erlaubt).toEqual([expect.objectContaining({ pfad: 'l[id=a].geaendertAm', grund: expect.stringContaining('Zeitstempel') })]);
    const rueck = vergleiche(n, v);
    expect(rueck.verlustfrei).toBe(false);
    const text = vergleiche(schnapp({ k: { l: [{ id: 'a', titel: 'T' }] } }), schnapp({ k: { l: [{ id: 'a', titel: 'U' }] } }));
    expect(text.verlustfrei).toBe(false);
    for (const r of ERLAUBT) expect(r.grund.length).toBeGreaterThan(20);
  });
  it('Format: v2-Hülle, `_v`, Klartext und MKOSDAT2 werden gemeldet (live läuft kompatibel)', () => {
    const n = schnapp({ a: { x: 1 } }, { dateien: { 'dateien/h/d-2.bin': { pfad: 'dateien/h/d-2.bin', groesse: 9, form: 'MKOSDAT2', inhalt: 'x', offen: true } } });
    n.bestaende.b = bestandBild('b', { _v: 2, y: 1 }, 2);
    n.bestaende.c = bestandBild('c', { z: 1 }, 0);
    const f = formatPruefen(n, { mitSchluessel: true });
    expect(f.map(a => `${a.bestand}${a.pfad ? `.${a.pfad}` : ''}`).sort()).toEqual(['b', 'b._v', 'c', 'datei:dateien/h/d-2.bin']);
    expect(vergleiche(schnapp({}), n).verlustfrei).toBe(false);
  });
});

describe('Tageslisten und Gegenprobe', () => {
  it('Tages-Schnappschüsse ohne Kennung werden über ihren Tag zugeordnet; nur HEUTE darf neu gerechnet sein', () => {
    const v = schnapp({ performance: { snapshots: [{ date: '2026-10-09', index: 40 }, { date: '2026-10-10', index: 48 }] } });
    const heuteNeu = schnapp({ performance: { snapshots: [{ date: '2026-10-09', index: 40 }, { date: '2026-10-10', index: 44 }] } });
    expect(vergleiche(v, heuteNeu, { mitSchluessel: true, heute: '2026-10-10' }).verlustfrei).toBe(true);
    const gesternNeu = schnapp({ performance: { snapshots: [{ date: '2026-10-09', index: 39 }, { date: '2026-10-10', index: 48 }] } });
    const e = vergleiche(v, gesternNeu, { mitSchluessel: true, heute: '2026-10-10' });
    expect(e.abweichungen).toEqual([expect.objectContaining({ pfad: 'snapshots[date=2026-10-09].index' })]);
  });
  it('mitGegenprobe: was die alte Version genauso verliert, blockiert nicht (steht unter auchAlt); Format zählt immer', () => {
    const v = schnapp({ crm: { mandate: [{ id: 'm1', ziele: ['Text', { id: 'z1', text: 'B' }] }] }, x: { a: 1 } });
    const n = schnapp({ crm: { mandate: [{ id: 'm1', ziele: [{ id: 'z1', text: 'B' }] }] }, x: { a: 2 } });
    const k = schnapp({ crm: { mandate: [{ id: 'm1', ziele: [{ id: 'z1', text: 'B' }] }] }, x: { a: 1 }, y: { z: 1 } });
    k.bestaende.x.daten = { a: 1, b: 'nur alt weg' };
    const g = mitGegenprobe(vergleiche(v, n, { mitSchluessel: true, erlaubt: [] }), vergleiche(v, k, { mitSchluessel: true, erlaubt: [] }));
    expect(g.verlustfrei).toBe(false);
    expect(g.abweichungen.map(a => a.pfad)).toEqual(['a']);
    expect(g.auchAlt?.map(a => a.pfad)).toEqual(['mandate[id=m1].ziele[#0]']);
    const nurAlt = mitGegenprobe(vergleiche(v, v, { mitSchluessel: true }), vergleiche(v, n, { mitSchluessel: true, erlaubt: [] }));
    expect(nurAlt.verlustfrei).toBe(true);
    expect(nurAlt.nurAlt?.length).toBe(2);
    const fmt = schnapp({ x: { a: 1 } });
    fmt.bestaende.x = bestandBild('x', { _v: 2, a: 1 }, 2);
    const f = mitGegenprobe(vergleiche(schnapp({ x: { a: 1 } }), fmt), vergleiche(schnapp({ x: { a: 1 } }), fmt));
    expect(f.verlustfrei).toBe(false);
  });
});

describe('selbsttest', () => {
  it('entfernt im Nachher-Bild einen Eintrag und ein Feld — der Vergleich meldet beides', () => {
    const v = schnapp({ routinen: { routinen: [{ id: 'r1', label: 'A', owner: 'lena' }, { id: 'r2', label: 'B', owner: 'jonas' }] } });
    const st = selbsttest(v, v, { mitSchluessel: true });
    expect(st.ok).toBe(true);
    expect(st.erwartet).toEqual(['routinen routinen[id=r1]', 'routinen routinen[id=r2].label']);
  });
  it('ohne geeignete Liste: nicht ok (dann ist das Werkzeug auf diesen Bildern nicht belegt)', () => {
    expect(selbsttest(schnapp({ a: { x: 1 } }), schnapp({ a: { x: 1 } }), { mitSchluessel: true }).ok).toBe(false);
  });
});

describe('berichtMarkdown', () => {
  it('Kopf sagt VERLUSTFREI ja/nein und listet jede Abweichung', () => {
    const e = vergleiche(schnapp({ a: { l: [{ id: 'x', t: 1 }] } }), schnapp({ a: { l: [] } }), { mitSchluessel: true, erlaubt: [] });
    const md = berichtMarkdown(e, { alt: 'a063e73a', neu: 'neu', ordner: '/probe', zeit: 'jetzt', neuLauf: { unsichtbar: ['jonas: PROBE Marke'] } });
    expect(md).toContain('**VERLUSTFREI: nein**');
    expect(md).toContain('kennung-fehlt');
    expect(md).toContain('l[id=x]');
    expect(md).toContain('jonas: PROBE Marke');
    const ok = berichtMarkdown(vergleiche(schnapp({ a: { x: 1 } }), schnapp({ a: { x: 1 } })), { alt: 'a', neu: 'b', ordner: '/p', zeit: 'z' });
    expect(ok).toContain('**VERLUSTFREI: ja**');
  });
});

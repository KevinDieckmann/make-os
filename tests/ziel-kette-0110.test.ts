// ─── Ziel ↔ Meilenstein: die Kette (01.10.) ─────────────────────────────────
// Kevin: „Verknüpfe die Zielebene mit der Meilenstein-Ebene … Mehrere Meilensteine zu einem Ziel, in Abhängigkeit.“
// Rein (lib/planung/meilenstein-kette.ts): Reihenfolge/Stufen, Verschieben und Ziehen, Kreise, Grenze, wartet-Status,
// Datum-Warnung, Löschen räumt die Kette, Ziel-Fortschritt. Durch die echten Schreibwege (Routen, ZOE) mit eigenem
// Datenordner und erfundenen Einträgen: Kreis/unbekannt/Grenze abgelehnt, Löschen räumt `wartetAuf`, Ziel löschen löst nur den
// Bezug, Verbindungsprüfung, Glocke (Frist). Rückweg: der WÖRTLICH kopierte alte Säuberer (af4679a) verwirft die neuen
// Felder und sonst nichts.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { haushaltKonten } from './fixtures/konten';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Meilenstein, Ziel, ZieleDatei } from '@/lib/planung/typen';
import {
  KETTE_MAX, datumVorVorgaenger, ketteOrdnen, kettePruefen, kreisIn, listeNachOps, nachfolger, offeneVorgaenger, ohneMeilenstein, ohneToteVerweise,
  ordneTeilmenge, reiheVerletzt, sauberWartetAuf, verschiebeInKette, verweiseZurueck, wartet, wartetText, wuerdeKreisen, zielFortschrittLive, zielVerweiseLoesen, zieheInKette,
} from '@/lib/planung/meilenstein-kette';
import { sauberMeilenstein } from '@/lib/planung/meilensteine';
import { sauberZiel } from '@/lib/planung/ziele';
import { meilensteineAbleiten } from '@/lib/planung/kaskade';
import { fristen } from '@/lib/kalender/eintraege';
import { planungPruefen, planungReparieren, meilensteinDateiBereinigen, type PlanungBestand } from '@/lib/crm/verbindungen-planung';
import * as altM from './fixtures/alt-af4679a/meilensteine';
import * as altZ from './fixtures/alt-af4679a/ziele';

/** Ein Meilenstein, wie er im Bestand steht (erfunden). */
const ms = (id: string, extra: Partial<Meilenstein> = {}): Meilenstein => ({ id, titel: `Schritt ${id}`, space: 'business', bereich: 'business', fortschritt: 0, erledigt: false, ...extra });

describe('Kette: Reihenfolge und Stufen', () => {
  // Vertrag → (Konto, Logo) parallel → Launch
  const liste = [ms('launch', { rang: 1, wartetAuf: ['konto', 'logo'] }), ms('konto', { rang: 2, wartetAuf: ['vertrag'] }), ms('logo', { rang: 3, wartetAuf: ['vertrag'] }), ms('vertrag', { rang: 4 }), ms('fremd', { rang: 5 })];
  it('jeder Meilenstein nach seinen Vorgängern, bei Gleichstand nach Rang; parallele in einer Stufe', () => {
    const k = ketteOrdnen(liste.filter(m => m.id !== 'fremd'));
    expect(k.reihe.map(m => m.id)).toEqual(['vertrag', 'konto', 'logo', 'launch']);
    expect(k.stufen.map(s => s.map(m => m.id))).toEqual([['vertrag'], ['konto', 'logo'], ['launch']]);
    expect(k.stufe.get('launch')).toBe(3);
  });
  it('ohne Abhängigkeiten gilt der Rang; Vorgänger außerhalb des Ziels zählen für die Stufe nicht', () => {
    const k = ketteOrdnen([ms('b', { rang: 2 }), ms('a', { rang: 1 }), ms('c', { rang: 3, wartetAuf: ['woanders'] })]);
    expect(k.reihe.map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(k.stufen).toHaveLength(1);
  });
  it('ein (verbotener) Kreis im Altbestand bricht nichts: die Reste kommen in Rang-Reihenfolge hinten dran', () => {
    const k = ketteOrdnen([ms('a', { rang: 1, wartetAuf: ['b'] }), ms('b', { rang: 2, wartetAuf: ['a'] }), ms('c', { rang: 3 })]);
    expect(k.reihe.map(m => m.id)).toEqual(['c', 'a', 'b']);
  });
  it('Verschieben (Pfeile): Nachbar tauschen, nur die Plätze des Ziels ändern sich; eine Abhängigkeit geht vor', () => {
    const alle = [ms('a', { rang: 1 }), ms('x', { rang: 2 }), ms('b', { rang: 3 }), ms('y', { rang: 4 }), ms('c', { rang: 5, wartetAuf: ['b'] })];
    const ziel = alle.filter(m => ['a', 'b', 'c'].includes(m.id));
    const reihe = ketteOrdnen(ziel).reihe;
    const neu = verschiebeInKette(alle, reihe, 'b', 'auf')!;
    // a und b tauschen ihre Plätze, x und y behalten ihren
    expect(neu.map(m => m.id)).toEqual(['b', 'x', 'a', 'y', 'c']);
    expect(neu.map(m => m.rang)).toEqual([1, 2, 3, 4, 5]);
    // c wartet auf b: c vor b oder b hinter c geht nicht; Ränder gehen nicht
    expect(verschiebeInKette(alle, reihe, 'c', 'auf')).toBeNull();
    expect(verschiebeInKette(alle, reihe, 'b', 'ab')).toBeNull();
    expect(verschiebeInKette(alle, reihe, 'a', 'auf')).toBeNull();
    // die neue Reihenfolge bleibt beim Neuordnen erhalten
    const zurueck = ketteOrdnen(neu.filter(m => ['a', 'b', 'c'].includes(m.id))).reihe.map(m => m.id);
    expect(zurueck).toEqual(['b', 'a', 'c']);
  });
  it('Ziehen: an die Stelle eines anderen setzen; vor den Vorgänger gezogen wird abgelehnt', () => {
    const alle = [ms('a', { rang: 1 }), ms('b', { rang: 2 }), ms('c', { rang: 3, wartetAuf: ['a'] })];
    const reihe = ketteOrdnen(alle).reihe; // a, b, c
    expect(zieheInKette(alle, reihe, 'c', 'b')!.map(m => m.id)).toEqual(['a', 'c', 'b']);
    expect(zieheInKette(alle, reihe, 'c', 'a')).toBeNull(); // c vor a: a ist sein Vorgänger
    expect(zieheInKette(alle, reihe, 'a', 'a')).toBeNull();
    expect(reiheVerletzt([ms('c', { wartetAuf: ['a'] }), ms('a')])).toEqual({ id: 'c', vor: 'a' });
    expect(reiheVerletzt(reihe)).toBeNull();
  });
  it('ordneTeilmenge: lückenlose Ränge, andere behalten ihren Platz', () => {
    const alle = [ms('a', { rang: 5 }), ms('x', { rang: 6 }), ms('b', { rang: 7 })];
    expect(ordneTeilmenge(alle, ['b', 'a']).map(m => [m.id, m.rang])).toEqual([['b', 1], ['x', 2], ['a', 3]]);
  });
});

describe('Kette: Abhängigkeiten prüfen', () => {
  const a = ms('a'), b = ms('b', { wartetAuf: ['a'] }), c = ms('c', { wartetAuf: ['b'] });
  it('Kreis wird abgelehnt — dieselbe Prüfung wie bei den Aufgaben', () => {
    const nachher = [{ ...a, wartetAuf: ['c'] }, b, c];
    expect(kreisIn(nachher, ['a'])).toEqual(['a', 'c', 'b', 'a']);
    expect(kettePruefen(nachher, ['a'])).toMatch(/^Abgelehnt: das wäre ein Kreis/);
    expect(kettePruefen([a, b, c], ['a', 'b', 'c'])).toBeNull();
    // auf sich selbst warten ist ein Kreis
    expect(kettePruefen([{ ...a, wartetAuf: ['a'] }], ['a'])).toMatch(/Kreis/);
    // Auswahl im Fenster: solche Kandidaten gar nicht erst anbieten
    expect(wuerdeKreisen('a', 'c', [a, b, c])).toBe(true);
    expect(wuerdeKreisen('a', 'a', [a, b, c])).toBe(true);
    expect(wuerdeKreisen('c', 'a', [a, b, c])).toBe(false);
  });
  it('unbekannte Vorgänger: neu genannte werden abgelehnt, alte tote blockieren nichts anderes', () => {
    expect(kettePruefen([a, { ...b, wartetAuf: ['a', 'weg'] }], ['b'], [a, b])).toMatch(/den es nicht gibt \(weg\)/);
    const alt = { ...b, wartetAuf: ['a', 'weg'] };
    expect(kettePruefen([a, alt], ['b'], [a, alt])).toBeNull();
  });
  it('höchstens zehn Vorgänger — abgelehnt, nie gekürzt', () => {
    const viele = Array.from({ length: KETTE_MAX + 1 }, (_, i) => ms(`v${i}`));
    const m = ms('z', { wartetAuf: viele.map(v => v.id) });
    expect(kettePruefen([...viele, m], ['z'])).toMatch(/höchstens 10 Vorgänger/);
    expect(kettePruefen([...viele, { ...m, wartetAuf: viele.slice(0, KETTE_MAX).map(v => v.id) }], ['z'])).toBeNull();
    // Säuberung: Form, keine Doppelten, nie der eigene; elf bleiben stehen, damit der Schreibweg ablehnen kann
    expect(sauberWartetAuf(['a', 'a', 'z', 'böse id', 5, 'b'], 'z')).toEqual(['a', 'b']);
    expect(sauberWartetAuf(viele.map(v => v.id), 'z')).toHaveLength(KETTE_MAX + 1);
    expect(sauberWartetAuf([], 'z')).toBeUndefined();
    expect(sauberMeilenstein({ id: 'z', titel: 'T', wartetAuf: ['a', 'z', 'a'], zielId: 'z1' })).toMatchObject({ wartetAuf: ['a'], zielId: 'z1' });
    expect(sauberMeilenstein({ id: 'z', titel: 'T' })).not.toHaveProperty('wartetAuf');
  });
  it('listeNachOps: die Liste nach den Änderungen, berührt = neu und geändert', () => {
    const r = listeNachOps([a, b], [{ op: 'upsert', eintrag: c }, { op: 'delete', id: 'a' }, { op: 'teil', id: 'b', felder: { wartetAuf: [] } }]);
    expect(r.nachher.map(m => m.id).sort()).toEqual(['b', 'c']);
    expect(r.beruehrt).toEqual(['c', 'b']);
  });
});

describe('Kette: wartet, Datum, Nachfolger', () => {
  const a = ms('a', { titel: 'Vertrag', faellig: '2026-10-20' }), b = ms('b', { titel: 'Launch', wartetAuf: ['a'], faellig: '2026-10-10' });
  it('„wartet“ nur solange ein Vorgänger offen ist — nie gespeichert, erledigte warten nie', () => {
    expect(wartet(b, [a, b])).toBe(true);
    expect(offeneVorgaenger(b, [a, b]).map(m => m.id)).toEqual(['a']);
    expect(wartet(b, [{ ...a, erledigt: true }, b])).toBe(false);
    expect(wartet({ ...b, erledigt: true }, [a, b])).toBe(false);
    expect(wartet(a, [a, b])).toBe(false);
    // ein Verweis ins Leere hält niemanden auf
    expect(wartet({ ...b, wartetAuf: ['weg'] }, [a, b])).toBe(false);
    expect(wartetText(b, [a, b])).toBe('wartet noch auf „Vertrag“');
    expect(wartetText({ wartetAuf: ['a', 'c'] }, [a, ms('c', { titel: 'Konto' })])).toBe('wartet noch auf „Vertrag“ und 1 weiteren');
    expect(wartetText(a, [a, b])).toBeNull();
    expect(nachfolger('a', [a, b]).map(m => m.id)).toEqual(['b']);
  });
  it('Datum vor dem eines Vorgängers: Warnung (Liste der späteren Vorgänger), kein Blockieren', () => {
    expect(datumVorVorgaenger(b, [a, b]).map(m => m.id)).toEqual(['a']);
    expect(datumVorVorgaenger({ ...b, faellig: '2026-10-25' }, [a, b])).toEqual([]);
    expect(datumVorVorgaenger({ ...b, faellig: undefined }, [a, b])).toEqual([]);
    // das Formular prüft das Datum, das noch nicht gespeichert ist
    expect(datumVorVorgaenger({ wartetAuf: ['a'], faellig: '2026-10-01' }, [a])).toHaveLength(1);
    // und der Schreibweg lehnt deshalb nichts ab
    expect(kettePruefen([a, b], ['b'], [a, b])).toBeNull();
  });
  it('Glocke/Kalender: die Frist sagt, dass der Meilenstein noch wartet', () => {
    const f = fristen({ meilensteine: [a, b] }, '2026-10-01', '2026-10-31');
    expect(f.find(x => x.id === 'ms-b')!.titel).toBe('Launch — wartet noch auf „Vertrag“');
    expect(f.find(x => x.id === 'ms-a')!.titel).toBe('Vertrag');
    const erledigt = fristen({ meilensteine: [{ ...a, erledigt: true }, b] }, '2026-10-01', '2026-10-31');
    expect(erledigt.find(x => x.id === 'ms-b')!.titel).toBe('Launch');
  });
});

describe('Kette: Löschen räumt auf', () => {
  const liste = [ms('a'), ms('b', { wartetAuf: ['a'] }), ms('c', { wartetAuf: ['a', 'b'] }), ms('d', { zielId: 'z1' })];
  it('gelöschter Meilenstein verschwindet aus „wartet auf“ der anderen; Rückgängig legt die Verweise zurück', () => {
    const { liste: rest, betroffen } = ohneMeilenstein(liste, 'a');
    expect(rest.map(m => m.id)).toEqual(['b', 'c', 'd']);
    expect(rest[0]).not.toHaveProperty('wartetAuf');
    expect(rest[1].wartetAuf).toEqual(['b']);
    expect(betroffen).toEqual([{ id: 'b', wartetAuf: ['a'] }, { id: 'c', wartetAuf: ['a', 'b'] }]);
    const zurueck = verweiseZurueck([...rest, liste[0]], 'a', betroffen);
    expect(zurueck.find(m => m.id === 'b')!.wartetAuf).toEqual(['a']);
    expect(zurueck.find(m => m.id === 'c')!.wartetAuf).toEqual(['b', 'a']);
    // zweimal ändert nichts
    expect(verweiseZurueck(zurueck, 'a', betroffen)).toEqual(zurueck);
    // unbetroffene bleiben dieselben Objekte
    expect(rest[2]).toBe(liste[3]);
  });
  it('tote Verweise ohne Löschen: nur die toten fallen weg, unveränderte bleiben dieselben Objekte', () => {
    const mitTotem = [...liste, ms('e', { wartetAuf: ['a', 'weg'] })];
    const r = ohneToteVerweise(mitTotem);
    expect(r.geaendert).toEqual(['e']);
    expect(r.liste.find(m => m.id === 'e')!.wartetAuf).toEqual(['a']);
    expect(r.liste[0]).toBe(mitTotem[0]);
    expect(ohneToteVerweise(liste).geaendert).toEqual([]);
  });
  it('gelöschtes Ziel: Meilensteine verlieren nur den Ziel-Bezug und bleiben', () => {
    const r = zielVerweiseLoesen([ms('x', { zielId: 'z1' }), ms('y', { zielId: 'z2' }), ms('w')], new Set(['z1']));
    expect(r.geloest).toEqual(['x']);
    expect(r.liste).toHaveLength(3);
    expect(r.liste[0]).not.toHaveProperty('zielId');
    expect(r.liste[1]).toHaveProperty('zielId', 'z2');
  });
});

describe('Ziel-Fortschritt', () => {
  it('Mittelwert der wirksamen Fortschritte seiner Meilensteine (erledigt = 100); ohne Meilensteine null', () => {
    const l = [ms('a', { zielId: 'z1', fortschritt: 40 }), ms('b', { zielId: 'z1', erledigt: true, fortschritt: 100 }), ms('c', { zielId: 'z2', fortschritt: 90 }), ms('d', { abgeleitetVon: 'z1', fortschritt: 10 })];
    expect(zielFortschrittLive('z1', l, null)).toBe(50);
    expect(zielFortschrittLive('z2', l, null)).toBe(90);
    expect(zielFortschrittLive('z3', l, null)).toBeNull();
  });
});

describe('Verbindungsprüfung: tote Ziel-Bezüge und Vorgänger', () => {
  const planung = (): PlanungBestand => ({
    ziele: [{ speicher: 'ziele', ziele: [{ id: 'z1' }] }, { speicher: 'ziele-eigen--malin', ziele: [{ id: 'z-eigen' }] }],
    meilensteine: [{ id: 'm1', zielId: 'z-weg' }, { id: 'm2', zielId: 'z1', wartetAuf: ['m-weg', 'm1'] }, { id: 'm3', zielId: 'z-eigen' }],
  });
  const lebend = { mandate: new Set<string>(), firmen: new Set<string>() };
  it('meldet tote Kennungen — Meilenstein, nie Titel', () => {
    const m: [string, string][] = [];
    planungPruefen({ planung: planung() }, lebend, (id, k) => m.push([id, k]));
    expect(m).toEqual([['meilenstein-ziel-tot', 'm1'], ['meilenstein-wartet-tot', 'm2']]);
  });
  it('Reparieren entfernt nur die toten Kennungen; zweimal ändert nichts mehr; nur gewählte Befunde', () => {
    const r = planungReparieren({ planung: planung() }, new Set(['meilenstein-ziel-tot', 'meilenstein-wartet-tot']), lebend);
    expect(r.aenderungen.map(a => [a.befundId, a.speicher, a.anzahl])).toEqual([['meilenstein-ziel-tot', 'meilensteine', 1], ['meilenstein-wartet-tot', 'meilensteine', 1]]);
    expect(r.planung!.meilensteine).toEqual([{ id: 'm1' }, { id: 'm2', zielId: 'z1', wartetAuf: ['m1'] }, { id: 'm3', zielId: 'z-eigen' }]);
    expect(planungReparieren({ planung: r.planung }, new Set(['meilenstein-ziel-tot', 'meilenstein-wartet-tot']), lebend).aenderungen).toEqual([]);
    const nurWartet = planungReparieren({ planung: planung() }, new Set(['meilenstein-wartet-tot']), lebend);
    expect(nurWartet.planung!.meilensteine[0]).toEqual({ id: 'm1', zielId: 'z-weg' });
  });
  it('ganze Datei: Vorgänger gegen die Datei, Ziel-Bezug nur mit der Zielliste; andere Felder bleiben', () => {
    const d = { meilensteine: [{ id: 'm1', titel: 'A', zielId: 'z-weg', wartetAuf: ['m9'] }, { id: 'm2', titel: 'B', zielId: 'z1', wartetAuf: ['m1'] }], extra: 1 };
    const r = meilensteinDateiBereinigen(d, { ...lebend, ziele: new Set(['z1']) }, new Set(['meilenstein-ziel-tot', 'meilenstein-wartet-tot']));
    expect(r.datei.meilensteine).toEqual([{ id: 'm1', titel: 'A' }, { id: 'm2', titel: 'B', zielId: 'z1', wartetAuf: ['m1'] }]);
    expect(r.datei.extra).toBe(1);
    // ohne Zielliste bleibt der Ziel-Bezug stehen (die Datei kennt die Ziele nicht)
    expect(meilensteinDateiBereinigen(d, lebend).datei.meilensteine[0]).toHaveProperty('zielId', 'z-weg');
    // ohne die Wahl nichts
    expect(meilensteinDateiBereinigen(d, lebend, new Set(['meilenstein-mandat-tot'])).datei).toBe(d);
  });
});

describe('Kaskade lässt „wartet auf“ am abgeleiteten Meilenstein stehen', () => {
  it('beim Nachziehen bleibt die Kette', () => {
    const ziel: Ziel = { id: 'zj', titel: 'Messe', fortschritt: 0, termin: '2027-03-01', space: 'business' };
    const bisher = [ms('ms~zj', { abgeleitetVon: 'zj', wartetAuf: ['vorher'], faellig: '2027-03-01' }), ms('vorher')];
    const neu = meilensteineAbleiten([ziel], bisher);
    expect(neu.find(m => m.id === 'ms~zj')!.wartetAuf).toEqual(['vorher']);
  });
});

describe('Rückweg: der alte Stand (af4679a) verwirft die neuen Felder und sonst nichts', () => {
  const voll = { id: 'ms-r1', titel: 'Launch', space: 'business', faellig: '2026-12-01', messlatte: 'Live', fortschritt: 30, erledigt: false, rang: 2, einheit: 'KD Ventures', zielId: 'z-r', wartetAuf: ['ms-r0'] };
  it('Meilenstein: wartetAuf (und zielId) fallen beim nächsten Speichern im alten Stand weg — Titel, Datum, Rang, Einheit bleiben', () => {
    const alt = altM.sauberMeilenstein(voll)!;
    expect(alt).not.toHaveProperty('wartetAuf');
    expect(alt).not.toHaveProperty('zielId');
    expect(alt).toMatchObject({ id: 'ms-r1', titel: 'Launch', faellig: '2026-12-01', messlatte: 'Live', fortschritt: 30, rang: 2, einheit: 'KD Ventures', space: 'business', bereich: 'business' });
    // Nach dem erneuten Upload: der neue Säuberer nimmt den Altbestand ohne die Felder, die Kette ist einfach flach.
    const neu = sauberMeilenstein(alt)!;
    expect(neu).not.toHaveProperty('wartetAuf');
    expect(wartet(neu, [neu])).toBe(false);
    expect(ketteOrdnen([neu, ms('ms-r0', { rang: 1 })]).stufen).toHaveLength(1);
    // der neue Säuberer behält, was der alte nicht kennt, solange der neue Stand schreibt
    expect(sauberMeilenstein(voll)).toMatchObject({ wartetAuf: ['ms-r0'], zielId: 'z-r' });
  });
  it('Ziel: Beschreibung (notiz) bleibt im alten Stand erhalten, nur die Messlatte fällt weg', () => {
    const z = { id: 'z-r', titel: 'Ziel', fortschritt: 10, notiz: 'Worum es geht', messlatte: '100 Kunden' };
    const alt = altZ.sauberZiel(z)!;
    expect(alt.notiz).toBe('Worum es geht');
    expect(alt).not.toHaveProperty('messlatte');
    expect(sauberZiel(z)).toMatchObject({ notiz: 'Worum es geht', messlatte: '100 Kunden' });
  });
  it('Dokumentiert im Rückweg der Go-Live-Checkliste', () => {
    const t = readFileSync(path.resolve(__dirname, '../GO_LIVE_CHECKLISTE.md'), 'utf8');
    expect(t).toMatch(/Ziel ↔ Meilenstein \(01\.10\.\)/);
    expect(t).toMatch(/wartetAuf/);
  });
});

// ── Durch die echten Schreibwege ────────────────────────────────────────────

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ziel-kette-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zk';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Mod = { GET: Handler; PATCH: Handler; PUT: Handler };
let zieleRoute: Mod, msRoute: Mod;
const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-zk', 'x-make-person': 'kevin' };
const req = (url: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = Meilenstein & { stand?: string };
const ladeMs = async () => ((await (await msRoute.GET(req('/api/state/meilensteine'))).json()) as { meilensteine: Zeile[] }).meilensteine;
const ladeZiele = async () => (await (await zieleRoute.GET(req('/api/state/ziele'))).json()) as ZieleDatei;
const patchMs = (ops: unknown[]) => msRoute.PATCH(req('/api/state/meilensteine', 'PATCH', { ops }));
const hoch = (m: Partial<Meilenstein> & { id: string }) => ({ op: 'upsert', eintrag: { titel: `Schritt ${m.id}`, space: 'business', fortschritt: 0, erledigt: false, ...m } });
const ZUKUNFT = `${Number(new Date().getFullYear()) + 1}`;

beforeAll(async () => {
  zieleRoute = (await import('@/app/api/state/ziele/route')) as unknown as Mod;
  msRoute = (await import('@/app/api/state/meilensteine/route')) as unknown as Mod;
  await haushaltKonten(await import('@/lib/store/local-db'));
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Schreibweg: Kette, Kreis, Grenze, Löschen', () => {
  beforeAll(async () => {
    const r = await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [
      { op: 'upsert', eintrag: { id: 'z-k1', titel: 'Messe ausrichten', fortschritt: 0, space: 'business' } },
      { op: 'upsert', eintrag: { id: 'z-k2', titel: 'Zweites Ziel', fortschritt: 0, space: 'business' } },
    ] }));
    expect(r.status).toBe(200);
  });

  it('eine Kette in einer Änderung anlegen: Vorgänger dürfen im selben Aufruf entstehen', async () => {
    const r = await patchMs([hoch({ id: 'k-a', zielId: 'z-k1', rang: 1 }), hoch({ id: 'k-b', zielId: 'z-k1', rang: 2, wartetAuf: ['k-a'] }), hoch({ id: 'k-c', zielId: 'z-k1', rang: 3, wartetAuf: ['k-b'] })]);
    expect(r.status).toBe(200);
    const l = await ladeMs();
    expect(l.find(m => m.id === 'k-c')!.wartetAuf).toEqual(['k-b']);
    expect(l.find(m => m.id === 'k-b')).toMatchObject({ zielId: 'z-k1', wartetAuf: ['k-a'] });
  });

  it('Kreis wird abgelehnt (409, nichts gespeichert), auch über `teil`', async () => {
    const vorher = await ladeMs();
    const a = vorher.find(m => m.id === 'k-a')!;
    const r = await patchMs([{ op: 'upsert', eintrag: { ...a, wartetAuf: ['k-c'] }, stand: a.stand }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toMatch(/Kreis/);
    expect((await ladeMs()).find(m => m.id === 'k-a')).not.toHaveProperty('wartetAuf');
    const t = await patchMs([{ op: 'teil', id: 'k-a', felder: { wartetAuf: ['k-b'] } }]);
    expect(t.status).toBe(409);
  });

  it('unbekannter Vorgänger wird abgelehnt (409); mehr als zehn auch (413)', async () => {
    const r = await patchMs([hoch({ id: 'k-x', wartetAuf: ['gibt-es-nicht'] })]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toMatch(/den es nicht gibt/);
    const viele = Array.from({ length: 11 }, (_, i) => `v-${i}`);
    expect((await patchMs(viele.map(id => hoch({ id })))).status).toBe(200);
    const zuviel = await patchMs([hoch({ id: 'k-y', wartetAuf: viele })]);
    expect(zuviel.status).toBe(413);
    expect((await ladeMs()).some(m => m.id === 'k-y')).toBe(false);
    expect((await patchMs([hoch({ id: 'k-y', wartetAuf: viele.slice(0, KETTE_MAX) })])).status).toBe(200);
  });

  it('Datum vor dem des Vorgängers blockiert nicht', async () => {
    const r = await patchMs([hoch({ id: 'k-frueh', faellig: '2026-01-01' }), hoch({ id: 'k-spaet', faellig: '2026-06-01' }), hoch({ id: 'k-nach', faellig: '2026-02-01', wartetAuf: ['k-spaet'] })]);
    expect(r.status).toBe(200);
    const l = await ladeMs();
    expect(datumVorVorgaenger(l.find(m => m.id === 'k-nach')!, l).map(m => m.id)).toEqual(['k-spaet']);
  });

  it('Löschen räumt „wartet auf“ der anderen (selbe Sperre); Rückgängig (Meilenstein + Verweis) stellt es wieder her', async () => {
    let l = await ladeMs();
    const b = l.find(m => m.id === 'k-b')!;
    const c = l.find(m => m.id === 'k-c')!;
    // Nur der Meilenstein wird gelöscht — der Server räumt den Verweis von k-c selbst.
    expect((await patchMs([{ op: 'delete', id: 'k-b', stand: b.stand }])).status).toBe(200);
    l = await ladeMs();
    expect(l.some(m => m.id === 'k-b')).toBe(false);
    expect(l.find(m => m.id === 'k-c')).not.toHaveProperty('wartetAuf');
    // Rückgängig wie im Browser: Meilenstein ohne Stand neu, k-c mit Verweis (mit seinem frischen Stand).
    const { stand: _s, ...ohne } = b;
    const c2 = l.find(m => m.id === 'k-c')!;
    expect((await patchMs([{ op: 'upsert', eintrag: ohne }, { op: 'upsert', eintrag: { ...c2, wartetAuf: ['k-b'] }, stand: c2.stand }])).status).toBe(200);
    expect((await ladeMs()).find(m => m.id === 'k-c')!.wartetAuf).toEqual(['k-b']);
    expect(c.wartetAuf).toEqual(['k-b']);
  });

  it('PUT (alter Weg): Verweise ins Leere fallen weg, ein Kreis wird abgelehnt', async () => {
    const l = await ladeMs();
    const dran = l.map(m => (m.id === 'k-c' ? { ...m, wartetAuf: ['k-b', 'nix'] } : m));
    const r = await msRoute.PUT(req('/api/state/meilensteine', 'PUT', { meilensteine: dran }));
    expect(r.status).toBe(200);
    expect((await ladeMs()).find(m => m.id === 'k-c')!.wartetAuf).toEqual(['k-b']);
    const kreis = (await ladeMs()).map(m => (m.id === 'k-a' ? { ...m, wartetAuf: ['k-c'] } : m));
    expect((await msRoute.PUT(req('/api/state/meilensteine', 'PUT', { meilensteine: kreis }))).status).toBe(409);
  });

  it('Ziel-Fortschritt = Mittelwert seiner Meilensteine (Server zieht nach)', async () => {
    await patchMs([hoch({ id: 'f-1', zielId: 'z-k2', fortschritt: 50 }), hoch({ id: 'f-2', zielId: 'z-k2', fortschritt: 100, erledigt: true })]);
    const z = (await ladeZiele()).jahr.find(x => x.id === 'z-k2')!;
    expect(z.fortschritt).toBe(75);
  });

  it('Ziel löschen: die Meilensteine bleiben und verlieren nur den Ziel-Bezug', async () => {
    const vorher = (await ladeMs()).filter(m => m.zielId === 'z-k1').map(m => m.id).sort();
    expect(vorher).toEqual(['k-a', 'k-b', 'k-c']);
    const z = (await ladeZiele()).jahr.find(x => x.id === 'z-k1') as Ziel & { stand?: string };
    const r = await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'delete', id: 'z-k1', stand: z.stand }] }));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { zielBezugGeloest: number }).zielBezugGeloest).toBe(3);
    const nachher = await ladeMs();
    for (const id of vorher) expect(nachher.find(m => m.id === id)).toBeDefined();
    expect(nachher.filter(m => m.zielId === 'z-k1')).toHaveLength(0);
    // die Kette selbst bleibt
    expect(nachher.find(m => m.id === 'k-c')!.wartetAuf).toEqual(['k-b']);
    // „Rückgängig“: Ziel ohne Stand wieder anlegen, Bezug wieder setzen
    const { stand: _s, ...zOhne } = z;
    expect((await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: zOhne }] }))).status).toBe(200);
    const m = (await ladeMs()).find(x => x.id === 'k-a')!;
    expect((await patchMs([{ op: 'upsert', eintrag: { ...m, zielId: 'z-k1' }, stand: m.stand }])).status).toBe(200);
    expect((await ladeMs()).find(x => x.id === 'k-a')!.zielId).toBe('z-k1');
  });

  it('abgeleiteter Meilenstein fällt mit seinem Ziel weg — auch aus „wartet auf“ der anderen', async () => {
    await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-t', titel: 'Termin-Ziel', fortschritt: 0, termin: `${ZUKUNFT}-05-01`, jahr: Number(ZUKUNFT), space: 'business' } }] }));
    const abgeleitet = (await ladeMs()).find(m => m.abgeleitetVon === 'z-t')!;
    expect(abgeleitet).toBeDefined();
    const warte = hoch({ id: 'k-w', wartetAuf: [abgeleitet.id] });
    expect((await patchMs([warte])).status).toBe(200);
    const z = (await ladeZiele()).jahr.find(x => x.id === 'z-t') as Ziel & { stand?: string };
    expect((await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'delete', id: 'z-t', stand: z.stand }] }))).status).toBe(200);
    const l = await ladeMs();
    expect(l.some(m => m.abgeleitetVon === 'z-t')).toBe(false);
    expect(l.find(m => m.id === 'k-w')).not.toHaveProperty('wartetAuf');
  });
});

describe('ZOE: setze_meilenstein kennt Ziel und Kette', () => {
  beforeAll(async () => {
    await zieleRoute.PATCH(req('/api/state/ziele', 'PATCH', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: 'z-zoe', titel: 'Kundenportal bauen', fortschritt: 0, space: 'business' } }] }));
    await patchMs([hoch({ id: 'zo-1', titel: 'Konzept Portal' }), hoch({ id: 'zo-2', titel: 'Entwurf Portal' }), hoch({ id: 'zo-3', titel: 'Portal Launch' })]);
  });
  it('ordnet einem Ziel zu und setzt „wartet auf“ — über Titelteile', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const r = await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Portal Launch', ziel: 'kundenportal', wartet_auf: ['Konzept Portal', 'Entwurf'] }, 'http://test', 'kevin');
    expect(r).toMatch(/^Erfasst:.*zahlt auf das Ziel „Kundenportal bauen“ ein.*wartet auf „Konzept Portal“, „Entwurf Portal“/);
    const m = (await ladeMs()).find(x => x.id === 'zo-3')!;
    expect(m).toMatchObject({ zielId: 'z-zoe', wartetAuf: ['zo-1', 'zo-2'] });
    // Kreis (Konzept soll auf den Launch warten) wird abgelehnt, nichts geändert
    const kreis = await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Konzept Portal', wartet_auf: ['Portal Launch'] }, 'http://test', 'kevin');
    expect(kreis).toMatch(/^Fehlgeschlagen:.*Kreis/);
    expect((await ladeMs()).find(x => x.id === 'zo-1')).not.toHaveProperty('wartetAuf');
    // unbekanntes Ziel und nicht eindeutiger Vorgänger
    expect(await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Portal Launch', ziel: 'gibt es nicht' }, 'http://test', 'kevin')).toMatch(/^Fehlgeschlagen: Kein Ziel/);
    expect(await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Konzept Portal', wartet_auf: ['Portal'] }, 'http://test', 'kevin')).toMatch(/^Fehlgeschlagen:.*nicht eindeutig/);
    // lösen: leere Liste / leeres Ziel
    const los = await WERKZEUGE.setze_meilenstein.lauf({ titel: 'Portal Launch', ziel: '', wartet_auf: [] }, 'http://test', 'kevin');
    expect(los).toMatch(/ohne Ziel-Bezug.*wartet auf niemanden mehr/);
    const danach = (await ladeMs()).find(x => x.id === 'zo-3')!;
    expect(danach).not.toHaveProperty('zielId');
    expect(danach).not.toHaveProperty('wartetAuf');
  });
  it('bleibt freigabepflichtig (Stapel) und die Vorschau nennt Ziel und Kette', async () => {
    const { REGISTER } = await import('@/lib/zoe/register');
    expect(REGISTER.setze_meilenstein.risiko).toBe('freigabe');
    const v = await REGISTER.setze_meilenstein.vorschau!({ titel: 'Portal Launch', ziel: 'Kundenportal', wartet_auf: ['Konzept'] });
    expect(v.nachher).toMatch(/Ziel „Kundenportal“.*wartet auf „Konzept“/);
  });
});

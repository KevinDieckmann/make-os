// ─── Prozesse · Landkarte anpassen (22.10.) — Vorgabe nie gespeichert, zurück, Grenzen, Rechte ─────────────────────────────────────────────────────────
// Rein: ohne Anpassung bit-gleich (dieselben Objekte, dieselbe Lage); Bereiche umbenennen/färben (nur Palette), eigene Bereiche (höchstens vier, als Band oben
// bzw. unten), Kacheln zuordnen/beschriften/ausblenden, Reihenfolge; alles, was der Vorgabe gleicht, fällt aus dem Gespeicherten; „Auf Vorgabe zurück“ = leer.
// Route: POST /api/prozesse/landkarte nur per Sitzung (Dienstweg 403), Sicht Privat 403, fremder Haushalt 403, Stand/409, Grenzen 413; GET liefert die
// Anpassung mit. Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { fliegeLage, kachelTitel } from '@/lib/prozesse/landkarte';
import { alsListe } from '@/lib/prozesse/modell';
import { FARBE, TIEF } from '@/lib/make-one/design';
import { LANDKARTE_TOENE, tonVon, STUFE_FARBE } from '@/lib/prozesse/farben';
import {
  LANDKARTE_GRENZEN, anpassungAendern, anpassungAus, istVorgabe, landkarteAnsicht, leereAnpassung, reiheVerschieben, reiheVor,
  type LandkarteAnpassung, type LandkarteOp,
} from '@/lib/prozesse/landkarte-anpassung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-landkarte-anpassen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-landkarte';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const L = SYSTEM_PROZESSE;
const KX = { prozesse: L, jetzt: '2026-10-22T09:00:00.000Z', person: 'pia' };
const lb = (n: number) => `lb-0000000${n}-aaaa-4aaa-8aaa-00000000000${n}`;
function anwenden(a: LandkarteAnpassung, ops: LandkarteOp[]): LandkarteAnpassung {
  const r = anpassungAendern(a, ops, KX);
  if (!r.ok) throw new Error(r.fehler);
  return r.anpassung;
}

describe('Ohne Anpassung: bit-gleich', () => {
  it('dieselben Objekte, dieselbe Reihenfolge, dieselbe Lage und Liste', () => {
    const v = landkarteAnsicht(L, null);
    expect(v.alle.length).toBe(L.length);
    v.alle.forEach((p, i) => expect(p).toBe(L[i]));
    expect(JSON.stringify(fliegeLage(v.sichtbar, { bereiche: v.bereiche }))).toBe(JSON.stringify(fliegeLage(L)));
    expect(JSON.stringify(alsListe(v.sichtbar, {}, { bereiche: v.bereiche }))).toBe(JSON.stringify(alsListe(L)));
  });
  it('die Töne der Vorgabe stehen alle in der Palette', () => {
    for (const b of landkarteAnsicht(L, null).bereiche) expect(LANDKARTE_TOENE.some(t => t.ton === b.ton), b.id).toBe(true);
  });
});

describe('Bereiche: Name, Satz, Ton — die Vorgabe wird nie gespeichert', () => {
  it('umbenennen wirkt im Bild (Stufen-Titel, Band-Titel) und in der Liste; die Vorgabe zurück = nichts gespeichert', () => {
    const a = anwenden(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', titel: 'Vertrieb' }, { art: 'bereich', bereich: 'fuehrung', titel: 'Steuern', satz: 'Kurs halten' }]);
    expect(a.bereiche).toEqual({ sales: { titel: 'Vertrieb' }, fuehrung: { titel: 'Steuern', satz: 'Kurs halten' } });
    const v = landkarteAnsicht(L, a);
    const lage = fliegeLage(v.sichtbar, { bereiche: v.bereiche });
    expect(lage.fliege.stufen.find(s => s.id === 'sales')!.titel).toBe('Vertrieb');
    expect(lage.baender.find(b => b.id === 'fuehrung')).toMatchObject({ titel: 'Steuern', satz: 'Kurs halten' });
    expect(lage.rahmen.map(r => r.titel)).toContain('Vertrieb');
    expect(alsListe(v.sichtbar, {}, { bereiche: v.bereiche }).find(b => b.id === 'kern')!.gruppen.map(g => g.titel)).toContain('Vertrieb');
    // Zurück auf den Namen der Vorgabe (bzw. leer) → nichts mehr gespeichert.
    const b = anwenden(a, [{ art: 'bereich', bereich: 'sales', titel: 'Sales' }, { art: 'bereich', bereich: 'fuehrung', titel: null, satz: null }]);
    expect(istVorgabe(b)).toBe(true);
    expect(b).toEqual(leereAnpassung());
  });
  it('Ton nur aus der Palette (400 sonst); der Ton der Vorgabe wird nicht gespeichert; Kacheln tragen den angepassten Ton', () => {
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', ton: 'neonpink' }], KX)).toMatchObject({ ok: false, status: 400 });
    const a = anwenden(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', ton: 'gruen' }]);
    expect(a.bereiche?.sales?.ton).toBe('gruen');
    const deal = landkarteAnsicht(L, a).alle.find(p => p.id === 'sp-deal')!;
    expect(tonVon(deal)).toBe(LANDKARTE_TOENE.find(t => t.id === 'gruen')!.ton);
    expect(anwenden(a, [{ art: 'bereich', bereich: 'sales', ton: 'orange' }])).toEqual(leereAnpassung());
  });
  it('jeder Ton der Palette ≥ 3:1 gegen Grund und Kachel, Titel und Zeile darauf ≥ 4,5:1, kein Rot (Rot heißt „Frist“)', () => {
    const lum = (h: string) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const mix = (f: string, b: string, x: number) => `#${[1, 3, 5].map(i => Math.round(parseInt(f.slice(i, i + 2), 16) * x + parseInt(b.slice(i, i + 2), 16) * (1 - x)).toString(16).padStart(2, '0')).join('')}`;
    const kr = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const alpha = parseInt(TIEF.flaeche('#000000').slice(-2), 16) / 255;
    for (const t of LANDKARTE_TOENE) {
      const kachel = mix(t.ton, FARBE.flaecheHoch, alpha);
      expect(kr(t.ton, FARBE.grund), t.id).toBeGreaterThanOrEqual(3);
      expect(kr(t.ton, kachel), t.id).toBeGreaterThanOrEqual(3);
      expect(kr(FARBE.ink, kachel), t.id).toBeGreaterThanOrEqual(4.5);
      expect(kr(FARBE.inkDim, kachel), t.id).toBeGreaterThanOrEqual(4.5);
      expect(t.ton).not.toBe(FARBE.kritisch);
    }
    expect(new Set(LANDKARTE_TOENE.map(t => t.id)).size).toBe(LANDKARTE_TOENE.length);
  });
});

describe('Kacheln: zuordnen, beschriften, ausblenden, Reihenfolge', () => {
  it('zuordnen: eine Kachel aus Sales in die Führung — im Bild als Band-Kachel; zurück in den Bereich der Vorgabe = nichts gespeichert', () => {
    const a = anwenden(leereAnpassung(), [{ art: 'kachel', id: 'sp-deal', bereich: 'fuehrung' }]);
    expect(a.kacheln).toEqual({ 'sp-deal': { bereich: 'fuehrung' } });
    const v = landkarteAnsicht(L, a);
    const k = fliegeLage(v.sichtbar, { bereiche: v.bereiche }).kacheln.find(x => x.id === 'sp-deal')!;
    expect(k.band).toBe('fuehrung');
    expect(k.stufe).toBeUndefined();
    expect(v.jeBereich.fuehrung.map(p => p.id)).toContain('sp-deal');
    expect(v.jeBereich.sales.map(p => p.id)).not.toContain('sp-deal');
    expect(anwenden(a, [{ art: 'kachel', id: 'sp-deal', bereich: 'sales' }])).toEqual(leereAnpassung());
    expect(anwenden(a, [{ art: 'kachel', id: 'sp-deal', bereich: null }])).toEqual(leereAnpassung());
  });
  it('Beschriftung: die Kachel zeigt sie (fern gekürzt), der Titel des Prozesses bleibt; leer bzw. gleich dem Titel = nichts gespeichert', () => {
    const a = anwenden(leereAnpassung(), [{ art: 'kachel', id: 'sp-netzwerken', beschriftung: 'Netzwerken (Events)' }]);
    const p = landkarteAnsicht(L, a).alle.find(x => x.id === 'sp-netzwerken')!;
    expect(p.titel).toBe('Netzwerken (Erfassen auf Veranstaltungen)');
    expect(kachelTitel(p, 'mittel')).toBe('Netzwerken (Events)');
    expect(kachelTitel(p, 'fern')).toBe('Netzwerken');
    expect(anwenden(a, [{ art: 'kachel', id: 'sp-netzwerken', beschriftung: '' }])).toEqual(leereAnpassung());
    expect(anwenden(a, [{ art: 'kachel', id: 'sp-netzwerken', beschriftung: 'Netzwerken (Erfassen auf Veranstaltungen)' }])).toEqual(leereAnpassung());
  });
  it('ausblenden: fehlt im Bild und in der Liste, bleibt aber erreichbar (alle); einblenden = nichts gespeichert', () => {
    const a = anwenden(leereAnpassung(), [{ art: 'kachel', id: 'sp-bauplan', aus: true }]);
    const v = landkarteAnsicht(L, a);
    expect(v.sichtbar.some(p => p.id === 'sp-bauplan')).toBe(false);
    expect(v.alle.find(p => p.id === 'sp-bauplan')?.aus).toBe(true);
    expect(fliegeLage(v.sichtbar, { bereiche: v.bereiche }).kacheln.some(k => k.id === 'sp-bauplan')).toBe(false);
    expect(JSON.stringify(alsListe(v.alle.filter(p => !p.aus)))).not.toContain('sp-bauplan');
    expect(anwenden(a, [{ art: 'kachel', id: 'sp-bauplan', aus: false }])).toEqual(leereAnpassung());
  });
  it('Reihenfolge: Pfeile und Ziehen ändern die Lage im Bild; die Reihe der Vorgabe wird nie gespeichert', () => {
    const vorgabe = landkarteAnsicht(L, null).jeBereich.marketing.map(p => p.id);
    const neu = reiheVerschieben(vorgabe, vorgabe[2], -1)!;
    expect(neu.indexOf(vorgabe[2])).toBe(1);
    expect(reiheVerschieben(vorgabe, vorgabe[0], -1)).toBeNull();
    const a = anwenden(leereAnpassung(), [{ art: 'reihe', bereich: 'marketing', ids: neu }]);
    expect(a.reihe?.marketing).toEqual(neu);
    const v = landkarteAnsicht(L, a);
    expect(v.jeBereich.marketing.map(p => p.id)).toEqual(neu);
    // Die Verzahnung der anderen Bereiche bleibt (gleich viele Kacheln je Bereich an denselben Stellen der Liste).
    expect(v.alle.map(p => p.band)).toEqual(L.map(p => p.band));
    const lage = fliegeLage(v.sichtbar, { bereiche: v.bereiche });
    const kern = lage.kacheln.filter(k => k.stufe === 'marketing').map(k => k.id);
    expect(new Set(kern)).toEqual(new Set(neu));
    expect(kern).not.toEqual(fliegeLage(L).kacheln.filter(k => k.stufe === 'marketing').map(k => k.id));
    // Zurück auf die Reihe der Vorgabe → nichts gespeichert; Ziehen ans Ende.
    expect(anwenden(a, [{ art: 'reihe', bereich: 'marketing', ids: vorgabe }])).toEqual(leereAnpassung());
    expect(reiheVor(vorgabe, vorgabe[0], null).at(-1)).toBe(vorgabe[0]);
    expect(reiheVor(vorgabe, vorgabe[3], vorgabe[0])[0]).toBe(vorgabe[3]);
  });
});

describe('Eigene Bereiche: anlegen, Band oben/unten, entfernen, höchstens vier', () => {
  it('ein eigener Bereich wird ein Band (Bild, Rahmen, Liste); entfernen holt die Kacheln in ihren Bereich zurück', () => {
    const a = anwenden(leereAnpassung(), [
      { art: 'bereich-neu', id: lb(1), titel: 'Recruiting', lage: 'oben', ton: 'gelb' },
      { art: 'kachel', id: 'sp-meilensteine', bereich: lb(1) },
      { art: 'bereich-neu', id: lb(2), titel: 'Wissen' },
      { art: 'kachel', id: 'sp-bauplan', bereich: lb(2) },
    ]);
    const v = landkarteAnsicht(L, a);
    const lage = fliegeLage(v.sichtbar, { bereiche: v.bereiche });
    expect(lage.baender.map(b => b.id)).toEqual(['fuehrung', lb(1), 'unterstuetzung', lb(2)]);
    expect(lage.kacheln.find(k => k.id === 'sp-meilensteine')).toMatchObject({ band: 'fuehrung', bereich: lb(1) });
    expect(lage.kacheln.find(k => k.id === 'sp-bauplan')).toMatchObject({ band: 'unterstuetzung', bereich: lb(2) });
    // Die Bänder überlappen nicht und stehen in der Reihenfolge des Bilds.
    const [f, e1, u, e2] = lage.baender;
    expect(e1.y).toBeGreaterThan(f.y + f.h);
    expect(lage.fliege.oben).toBeGreaterThan(e1.y + e1.h);
    expect(e2.y).toBeGreaterThan(u.y + u.h);
    expect(lage.rahmen.map(r => r.id)).toEqual(['alles', 'fuehrung', lb(1), 'marketing', 'sales', 'uebergabe', 'fulfillment', 'ausbau', 'unterstuetzung', lb(2)]);
    expect(tonVon(v.alle.find(p => p.id === 'sp-meilensteine')!)).toBe(LANDKARTE_TOENE.find(t => t.id === 'gelb')!.ton);
    const liste = alsListe(v.sichtbar, {}, { bereiche: v.bereiche });
    expect(liste.map(b => b.id)).toEqual(['fuehrung', lb(1), 'kern', 'unterstuetzung', lb(2)]);
    expect(liste.find(b => b.id === 'unterstuetzung')!.gruppen[0].prozesse.some(k => k.id === 'sp-bauplan')).toBe(false);
    // Entfernen: die Kachel steht wieder in der Führung; nichts bleibt gespeichert, was der Vorgabe gleicht.
    const b = anwenden(a, [{ art: 'bereich-weg', bereich: lb(1) }, { art: 'bereich-weg', bereich: lb(2) }]);
    expect(b).toEqual(leereAnpassung());
    expect(landkarteAnsicht(L, b).jeBereich.fuehrung.map(p => p.id)).toContain('sp-meilensteine');
  });
  it('höchstens vier eigene Bereiche (413), feste Bereiche lassen sich nicht entfernen (404), ein eigener braucht einen Namen (400)', () => {
    const vier = anwenden(leereAnpassung(), [1, 2, 3, 4].map(n => ({ art: 'bereich-neu' as const, id: lb(n), titel: `B${n}` })));
    expect(vier.eigene).toHaveLength(LANDKARTE_GRENZEN.eigeneBereiche);
    expect(anpassungAendern(vier, [{ art: 'bereich-neu', id: lb(5), titel: 'B5' }], KX)).toMatchObject({ ok: false, status: 413 });
    expect(anpassungAendern(vier, [{ art: 'bereich-weg', bereich: 'sales' }], KX)).toMatchObject({ ok: false, status: 404 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich-neu', id: lb(1), titel: '  ' }], KX)).toMatchObject({ ok: false, status: 400 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich-neu', id: 'lb-kaputt', titel: 'X' }], KX)).toMatchObject({ ok: false, status: 400 });
    // Ein leerer eigener Bereich bleibt gespeichert (er ist eine Abweichung) — zeichnet aber kein leeres Band.
    const v = landkarteAnsicht(L, vier);
    expect(fliegeLage(v.sichtbar, { bereiche: v.bereiche }).baender.map(b => b.id)).toEqual(['fuehrung', 'unterstuetzung']);
  });
});

describe('Grenzen und Fehler: nie gekürzt, alles oder nichts', () => {
  it('413 bei zu langen Texten und zu vielen Schritten, 404 bei unbekannten Kacheln, 400 bei Unsinn — und dann ist nichts geändert', () => {
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', titel: 'x'.repeat(LANDKARTE_GRENZEN.titel + 1) }], KX)).toMatchObject({ ok: false, status: 413 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'kachel', id: 'sp-deal', beschriftung: 'x'.repeat(LANDKARTE_GRENZEN.beschriftung + 1) }], KX)).toMatchObject({ ok: false, status: 413 });
    const viele = Array.from({ length: LANDKARTE_GRENZEN.ops + 1 }, () => ({ art: 'kachel' as const, id: 'sp-deal', aus: true }));
    expect(anpassungAendern(leereAnpassung(), viele, KX)).toMatchObject({ ok: false, status: 413 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'kachel', id: 'sp-gibtsnicht', aus: true }], KX)).toMatchObject({ ok: false, status: 404 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'reihe', bereich: 'sales', ids: ['sp-deal', 'sp-gibtsnicht'] }], KX)).toMatchObject({ ok: false, status: 404 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich', bereich: 'erfunden', titel: 'X' }], KX)).toMatchObject({ ok: false, status: 404 });
    expect(anpassungAendern(leereAnpassung(), [], KX)).toMatchObject({ ok: false, status: 400 });
    expect(anpassungAendern(leereAnpassung(), [{ art: 'loeschen' }], KX)).toMatchObject({ ok: false, status: 400 });
    // Alles oder nichts: ein guter und ein schlechter Schritt → gar nichts.
    expect(anpassungAendern(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', titel: 'Vertrieb' }, { art: 'kachel', id: 'sp-gibtsnicht', aus: true }], KX).ok).toBe(false);
  });
  it('„Auf Vorgabe zurück“ leert alles; der Säuberer liest Unlesbares nie als Angabe und kürzt keine Liste', () => {
    const a = anwenden(leereAnpassung(), [{ art: 'bereich', bereich: 'sales', titel: 'Vertrieb' }, { art: 'kachel', id: 'sp-deal', aus: true }]);
    expect(anwenden(a, [{ art: 'zuruecksetzen' }])).toEqual(leereAnpassung());
    const roh = { v: 1, bereiche: { sales: { titel: 'Vertrieb', ton: 'neon' }, erfunden: { titel: 'X' } }, eigene: [{ id: 'kaputt', titel: 'X' }], kacheln: { 'sp-deal': { aus: true, bereich: 'mars' } }, reihe: { sales: ['sp-deal', 'sp-deal', 3] } };
    expect(anpassungAus(roh)).toEqual({ v: 1, bereiche: { sales: { titel: 'Vertrieb' } }, kacheln: { 'sp-deal': { aus: true } }, reihe: { sales: ['sp-deal'] } });
    const lang = Array.from({ length: 300 }, (_, i) => `sp-x${i}`);
    expect(anpassungAus({ v: 1, reihe: { sales: lang } }).reihe?.sales).toHaveLength(300);
    expect(anpassungAus(null)).toEqual(leereAnpassung());
  });
  it('die Ansicht verträgt Kacheln, die es nicht mehr gibt, und Bereiche, die entfernt wurden', () => {
    const a: LandkarteAnpassung = { v: 1, kacheln: { 'sp-weg': { bereich: 'sales' }, 'sp-deal': { bereich: lb(9) } }, reihe: { sales: ['sp-weg', 'sp-followup'] } };
    const v = landkarteAnsicht(L, a);
    expect(v.alle.find(p => p.id === 'sp-deal')!.stufe).toBe('sales');
    expect(v.jeBereich.sales[0].id).toBe('sp-followup');
    expect(STUFE_FARBE.sales).toBe(tonVon(v.alle.find(p => p.id === 'sp-deal')!));
  });
});

// ── Route ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json', ...(person ? { 'x-make-person': person } : {}) });
async function hole(kopf: Record<string, string>, suche = '?space=business') {
  const { GET } = await import('@/app/api/prozesse/landkarte/route');
  const r = await GET(new Request(`http://test/api/prozesse/landkarte${suche}`, { headers: kopf }));
  return { status: r.status, j: r.status === 200 ? await r.json() : null };
}
async function sende(kopf: Record<string, string>, koerper: unknown, suche = '?space=business') {
  const { POST } = await import('@/app/api/prozesse/landkarte/route');
  const r = await POST(new Request(`http://test/api/prozesse/landkarte${suche}`, { method: 'POST', headers: kopf, body: JSON.stringify(koerper) }));
  return { status: r.status, j: await r.json().catch(() => null) };
}

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-lk' }),
    konto('k2', 'partnerin', 'mitglied', { haushalt: 'haus-lk', finanzRecht: 'business' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    konto('k4', 'kunde', 'mitglied'),
  ], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Route: lesen, schreiben, Rechte, Stand', () => {
  it('ohne Bestand: GET ohne Anpassung, mit Stand; die Vorgabe steht nicht im Bestand', async () => {
    const r = await hole(sitzung('pia'));
    expect(r.status).toBe(200);
    expect(r.j.anpassung).toBeUndefined();
    expect(typeof r.j.anpassungStand).toBe('string');
    expect(await (await import('@/lib/store/local-db')).loadJson('prozesse-landkarte--haus-lk')).toBeNull();
  });
  it('Dienstweg (auch mit Person), fremder Haushalt, Testkunde, Sicht Privat → 403; nichts geschrieben', async () => {
    const stand = (await hole(sitzung('pia'))).j.anpassungStand;
    const ops = [{ art: 'bereich', bereich: 'sales', titel: 'Vertrieb' }];
    for (const k of [dienst(), dienst('pia'), sitzung('gast'), sitzung('kunde')]) expect((await sende(k, { stand, ops })).status).toBe(403);
    expect((await sende(sitzung('pia'), { stand, ops }, '?space=privat')).status).toBe(403);
    expect(await (await import('@/lib/store/local-db')).loadJson('prozesse-landkarte--haus-lk')).toBeNull();
  });
  it('schreiben (auch „nur Business“), GET liefert die Anpassung; veralteter Stand → 409 mit der aktuellen Fassung; 413 ohne Schreiben', async () => {
    const s0 = (await hole(sitzung('pia'))).j.anpassungStand;
    const a = await sende(sitzung('partnerin'), { stand: s0, ops: [{ art: 'bereich', bereich: 'sales', titel: 'Vertrieb' }] });
    expect(a.status).toBe(200);
    expect(a.j.anpassung.bereiche).toEqual({ sales: { titel: 'Vertrieb' } });
    expect(a.j.anpassung.geaendertVon).toBe('partnerin');
    const g = await hole(sitzung('pia'));
    expect(g.j.anpassung.bereiche.sales.titel).toBe('Vertrieb');
    expect(g.j.anpassungStand).toBe(a.j.anpassungStand);
    // Alter Stand → 409, die aktuelle Fassung kommt mit.
    const k = await sende(sitzung('pia'), { stand: s0, ops: [{ art: 'kachel', id: 'sp-deal', aus: true }] });
    expect(k.status).toBe(409);
    expect(k.j.anpassung.bereiche.sales.titel).toBe('Vertrieb');
    // Grenzen: 413, nichts geschrieben.
    const z = await sende(sitzung('pia'), { stand: a.j.anpassungStand, ops: [{ art: 'bereich', bereich: 'sales', titel: 'x'.repeat(200) }] });
    expect(z.status).toBe(413);
    expect((await hole(sitzung('pia'))).j.anpassung.bereiche.sales.titel).toBe('Vertrieb');
    // Zurück auf die Vorgabe: der Bestand ist leer — keine Vorgabe gespeichert.
    const zur = await sende(sitzung('pia'), { stand: a.j.anpassungStand, ops: [{ art: 'zuruecksetzen' }] });
    expect(zur.status).toBe(200);
    expect(await (await import('@/lib/store/local-db')).loadJson('prozesse-landkarte--haus-lk')).toEqual({ v: 1 });
    expect((await hole(sitzung('pia'))).j.anpassung).toBeUndefined();
  });
  it('Konto löschen tilgt den Speichernamen („[gelöscht]“), die Anpassung bleibt', async () => {
    const s = (await hole(sitzung('pia'))).j.anpassungStand;
    expect((await sende(sitzung('partnerin'), { stand: s, ops: [{ art: 'kachel', id: 'sp-deal', beschriftung: 'Deals' }] })).status).toBe(200);
    const { landkarteKontoLoeschen, anpassungLesen } = await import('@/lib/prozesse/landkarte-anpassung-server');
    expect(await landkarteKontoLoeschen('haus-lk', 'partnerin')).toBe(1);
    const a = await anpassungLesen('haus-lk');
    expect(a.geaendertVon).toBe('[gelöscht]');
    expect(a.kacheln?.['sp-deal']?.beschriftung).toBe('Deals');
  });
});

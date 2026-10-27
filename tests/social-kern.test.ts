// ─── Social — Kern (rein): Schreiben mit Stand, Grenzen, Prüfer, Leitplanken, Analyse, CSV-Import ───────────────────────────────────
// Erfundene Kanäle und Zahlen — nie echte Konten oder Insights.
import { describe, it, expect } from 'vitest';
import { socialAnwenden, socialAus, socialOhnePerson, socialEintraegeVon, type AnwendenKontext } from '@/lib/social/daten';
import { folgePruefen, aehnlichkeit, hatStopp, brauchtMensch } from '@/lib/social/pruefer';
import { autonomieFuer } from '@/lib/social/autonomie';
import { kanalAnalyse, folgeZahlen, median } from '@/lib/social/analyse';
import { importVorschau, zahlAus, tagAus } from '@/lib/social/csv';
import { leereSocial, LEITPLANKEN_VORGABE, SOCIAL_GRENZEN, type SocialDatei, type SocialFolge, type SocialKanal } from '@/lib/social/typen';

let n = 0;
const ctx = (person = 'pa'): AnwendenKontext => ({ person, jetzt: '2026-10-26T20:00:00.000Z', standVon: x => JSON.stringify(x).length.toString(36) + JSON.stringify(x).slice(0, 40), neueId: p => `${p}-t${++n}` });
const st = (x: object) => ctx().standVon(x);

function mitKanal(extra: Record<string, unknown> = {}): SocialDatei {
  const r = socialAnwenden(leereSocial(), [{ op: 'kanal', eintrag: { name: 'Beispiel-Kanal', sprache: 'en', plattformen: ['tiktok', 'youtube', 'facebook'], kiKanal: true, marke: { nieSagen: ['guaranteed'] }, ...extra } }], ctx());
  if (!r.ok) throw new Error(r.fehler);
  return r.datei;
}
const kanalVon = (d: SocialDatei): SocialKanal => d.kanaele[0];

function folge(d: SocialDatei, e: Record<string, unknown>): SocialDatei {
  const r = socialAnwenden(d, [{ op: 'folge', eintrag: { kanalId: kanalVon(d).id, ...e } }], ctx());
  if (!r.ok) throw new Error(r.fehler);
  return r.datei;
}

describe('Schreiben', () => {
  it('neuer Kanal: Kennung vom Server, unbekannte Plattformen fallen weg, Leitplanken-Vorgabe', () => {
    const k = kanalVon(mitKanal());
    expect(k.id).toMatch(/^sk-/);
    expect(k.plattformen).toEqual(['tiktok', 'youtube']);
    expect(k.leitplanken).toEqual(LEITPLANKEN_VORGABE);
    expect(k.geaendertVon).toBe('pa');
  });
  it('Ändern nur mit passendem Stand — sonst Konflikt, nichts geändert', () => {
    const d = mitKanal();
    const k = kanalVon(d);
    const falsch = socialAnwenden(d, [{ op: 'kanal', eintrag: { id: k.id, name: 'Neu' }, stand: 'alt' }], ctx());
    expect(falsch.ok).toBe(false);
    if (!falsch.ok) expect(falsch.status).toBe(409);
    const gut = socialAnwenden(d, [{ op: 'kanal', eintrag: { id: k.id, name: 'Neu' }, stand: st(k) }], ctx());
    expect(gut.ok && gut.datei.kanaele[0].name).toBe('Neu');
  });
  it('Bearbeiten schaltet den Not-Aus nie um — nur der eigene Schritt', () => {
    const d = mitKanal();
    const k = kanalVon(d);
    const r = socialAnwenden(d, [{ op: 'kanal', eintrag: { id: k.id, name: 'X', leitplanken: { postenAus: true, autonomie: 2 } }, stand: st(k) }], ctx());
    expect(r.ok && r.datei.kanaele[0].leitplanken.postenAus).toBe(false);
    expect(r.ok && r.datei.kanaele[0].leitplanken.autonomie).toBe(2);
    const aus = socialAnwenden(d, [{ op: 'notaus', id: k.id, posten: true, stand: st(k) }], ctx());
    expect(aus.ok && aus.datei.kanaele[0].leitplanken.postenAus).toBe(true);
  });
  it('Server-Felder aus dem Körper werden ignoriert (Freigabe, Messungen, geändert von)', () => {
    let d = mitKanal();
    const r = socialAnwenden(d, [{ op: 'format', eintrag: { kanalId: kanalVon(d).id, name: 'Day X', freigegebenAm: '2026-01-01', freigegebenVon: 'fremd', geaendertVon: 'fremd' } }], ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datei.formate[0].freigegebenAm).toBeUndefined();
    expect(r.datei.formate[0].geaendertVon).toBe('pa');
    d = folge(r.datei, { titel: 'T', skript: 'a b c', messungen: [{ id: 'sm-x', plattform: 'tiktok', am: '2026-10-01', views: 999999 }] });
    expect(d.folgen[0].messungen).toEqual([]);
  });
  it('Format-Inhalt geändert → Freigabe fällt weg', () => {
    const d0 = mitKanal();
    const r1 = socialAnwenden(d0, [{ op: 'format', eintrag: { kanalId: kanalVon(d0).id, name: 'Day X', laengeSek: 30 } }], ctx());
    if (!r1.ok) throw new Error();
    const f = r1.datei.formate[0];
    const r2 = socialAnwenden(r1.datei, [{ op: 'format-freigeben', id: f.id, freigeben: true, stand: st(f) }], ctx('pb'));
    if (!r2.ok) throw new Error();
    expect(r2.datei.formate[0].freigegebenVon).toBe('pb');
    const f2 = r2.datei.formate[0];
    const r3 = socialAnwenden(r2.datei, [{ op: 'format', eintrag: { id: f2.id, name: 'Day X', laengeSek: 45 }, stand: st(f2) }], ctx());
    expect(r3.ok && r3.datei.formate[0].freigegebenAm).toBeUndefined();
  });
  it('Grenzen: zu viele Schritte, zu langes Skript → 413, nie gekürzt', () => {
    const d = mitKanal();
    const viele = Array.from({ length: SOCIAL_GRENZEN.ops + 1 }, () => ({ op: 'folge', eintrag: { kanalId: kanalVon(d).id, titel: 'x' } }));
    const r = socialAnwenden(d, viele, ctx());
    expect(!r.ok && r.status).toBe(413);
    const lang = socialAnwenden(d, [{ op: 'folge', eintrag: { kanalId: kanalVon(d).id, titel: 'x', skript: 'a'.repeat(SOCIAL_GRENZEN.skript + 1) } }], ctx());
    expect(!lang.ok && lang.status).toBe(413);
  });
  it('Veröffentlichte Folge mit Zahlen lässt sich nicht löschen — nur verwerfen', () => {
    let d = folge(mitKanal(), { titel: 'T', skript: 'x' });
    const id = d.folgen[0].id;
    const r = socialAnwenden(d, [{ op: 'veroeffentlicht', folgeId: id, plattform: 'tiktok', am: '2026-10-20', link: 'http://unsicher' }, { op: 'messung', folgeId: id, messung: { plattform: 'tiktok', am: '2026-10-21', views: 120 } }], ctx());
    if (!r.ok) throw new Error(r.fehler);
    d = r.datei;
    expect(d.folgen[0].status).toBe('veroeffentlicht');
    expect(d.folgen[0].veroeffentlicht[0].link).toBeUndefined();
    const weg = socialAnwenden(d, [{ op: 'folge-weg', id, stand: st(d.folgen[0]) }], ctx());
    expect(weg.ok).toBe(false);
  });
  it('Lesen: beschädigte Einträge fallen heraus, nie das Ganze', () => {
    const d = socialAus({ kanaele: [{ id: 'sk-1', name: 'Gut' }, { id: 'kaputt' }, 'quatsch'], folgen: [{ id: 'sv-1', kanalId: 'sk-1' }] });
    expect(d.kanaele.map(k => k.id)).toEqual(['sk-1']);
    expect(d.folgen).toEqual([]);
  });
  it('Konto löschen: Einträge bleiben, Speichername wird [gelöscht]; Export nennt nur eigene Stempel', () => {
    const d = folge(mitKanal(), { titel: 'T', skript: 'x' });
    expect(socialEintraegeVon(d, 'pa').length).toBe(2);
    expect(socialEintraegeVon(d, 'pb')).toEqual([]);
    const r = socialOhnePerson(d, 'pa');
    expect(r.n).toBe(2);
    expect(r.neu.folgen[0].geaendertVon).toBe('[gelöscht]');
    expect(r.neu.folgen[0].titel).toBe('T');
  });
});

describe('Prüfer', () => {
  const basis = (e: Partial<SocialFolge>): SocialFolge => ({ id: 'sv-a', kanalId: 'sk-1', titel: 'T', skript: 'Ein ruhiger Satz ohne Probleme und mit einem Gedanken.', hooks: [{ id: 'hk-1', text: 'Hook' }], quellen: [], kiInhalt: true, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '', cta: 'Follow', ...e });
  const kanal = kanalVon(mitKanal());
  it('Platzhalter, fehlender Hook und „sagen wir nie“ stoppen', () => {
    const b = folgePruefen(basis({ skript: 'Day 3. {{followers}} followers. This is guaranteed.', hooks: [] }), { kanal, andere: [] });
    expect(b.filter(x => x.stufe === 'stopp').map(x => x.code).sort()).toEqual(['kein-hook', 'nie-sagen', 'platzhalter']);
  });
  it('KI-Kanal: Behauptung von Gefühl/Bewusstsein stoppt', () => {
    expect(hatStopp(folgePruefen(basis({ skript: "Honestly, I'm alive and I feel proud." }), { kanal, andere: [] }))).toBe(true);
  });
  it('Beratung, Preis und Zahlen ohne Quelle brauchen eine Person', () => {
    const b = folgePruefen(basis({ skript: 'Invest in stocks now: 40% returns since 2020. Only 19 € today.' }), { kanal, andere: [] });
    expect(b.filter(x => x.stufe === 'mensch').map(x => x.code).sort()).toEqual(['angebot', 'beratung', 'ohne-quelle']);
    expect(brauchtMensch(folgePruefen(basis({ skript: 'Seit 2008 gibt es Airbnb.', quellen: ['Quelle'] }), { kanal, andere: [] }))).toBe(false);
  });
  it('Wiederholung: fast gleiches Skript wie eine der letzten Folgen stoppt', () => {
    const text = 'Today I learned that the first three seconds decide everything about a short video and its reach';
    expect(aehnlichkeit(text, text)).toBe(1);
    const b = folgePruefen(basis({ skript: text }), { kanal, andere: [basis({ id: 'sv-b', titel: 'Alt', skript: `${text} again` })] });
    expect(b.some(x => x.code === 'wiederholung')).toBe(true);
  });
});

describe('Leitplanken (Stufe 2)', () => {
  const lauf = (st2: Partial<SocialKanal['leitplanken']>, f: Partial<SocialFolge> = {}, freigegeben = true, heutePosts = 0) => {
    const kanal = { ...kanalVon(mitKanal()), leitplanken: { ...LEITPLANKEN_VORGABE, autonomie: 2 as const, ...st2 } };
    const folge: SocialFolge = { id: 'sv-a', kanalId: kanal.id, formatId: 'sf-1', titel: 'T', skript: 'ok', hooks: [{ id: 'hk-1', text: 'h' }], quellen: [], kiInhalt: true, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '', ...f };
    const format = { id: 'sf-1', kanalId: kanal.id, name: 'Day X', geaendert: '', ...(freigegeben ? { freigegebenAm: '2026-10-26' } : {}) };
    return autonomieFuer(folge, { kanal, format, befunde: folgePruefen(folge, { kanal, format, andere: [] }), heutePosts });
  };
  it('selbst nur mit Stufe 2, freigegebenem Format, sauberer Prüfung und unter dem Limit', () => {
    expect(lauf({}).weg).toBe('selbst');
    expect(lauf({ autonomie: 1 }).weg).toBe('stapel');
    expect(lauf({}, {}, false).weg).toBe('stapel');
    expect(lauf({}, {}, true, 3).weg).toBe('stapel');
    expect(lauf({}, { skript: 'Buy now for 19 €' }).weg).toBe('stapel');
  });
  it('Not-Aus, Stopp, Idee → gar nicht', () => {
    expect(lauf({ postenAus: true }).weg).toBe('gesperrt');
    expect(lauf({}, { skript: '{{views}} views' }).weg).toBe('gesperrt');
    expect(lauf({}, { status: 'idee' }).weg).toBe('gesperrt');
  });
});

describe('Analyse', () => {
  const mk = (i: number, views: number, halte3s: number, extra: Partial<SocialFolge> = {}): SocialFolge => ({
    id: `sv-${i}`, kanalId: 'sk-1', formatId: i % 2 ? 'sf-a' : 'sf-b', saeule: i % 2 ? 'Build log' : 'Useful AI', titel: `F${i}`, skript: 'x', hooks: [], quellen: [], kiInhalt: true,
    status: 'veroeffentlicht', veroeffentlicht: [{ plattform: 'tiktok', am: '2026-10-20' }], geaendert: '',
    messungen: [{ id: `sm-${i}a`, plattform: 'tiktok', am: '2026-10-21', views: Math.round(views / 2), quelle: 'hand' }, { id: `sm-${i}b`, plattform: 'tiktok', am: '2026-10-22', views, halte3s, shares: Math.round(views / 100), quelle: 'hand' }],
    ...extra,
  });
  it('Zahlen: jüngste Messung je Plattform zählt, Raten je 1.000', () => {
    const z = folgeZahlen(mk(1, 2000, 60))!;
    expect(z.views).toBe(2000);
    expect(z.sharesJeTsd).toBe(10);
    expect(median([5, 1, 3])).toBe(3);
  });
  it('unter 5 Folgen: keine relativen Urteile, aber Hook-Signal gilt sofort', () => {
    const a = kanalAnalyse([mk(1, 1000, 30), mk(2, 1200, 70)], 'sk-1');
    expect(a.genugDaten).toBe(false);
    expect(a.folgen.find(f => f.id === 'sv-1')!.urteil).toBe('hook');
    expect(a.folgen.find(f => f.id === 'sv-2')!.urteil).toBe('zu-wenig-daten');
  });
  it('ab 5 Folgen: starke Folge = mehr davon, schwache = streichen, Formate verglichen', () => {
    const l = [mk(1, 1000, 60), mk(2, 1100, 62), mk(3, 900, 61), mk(4, 1000, 60), mk(5, 6000, 75), mk(6, 150, 55)];
    const a = kanalAnalyse(l, 'sk-1', { formatName: id => (id === 'sf-a' ? 'Day X' : 'AI in 30s') });
    expect(a.genugDaten).toBe(true);
    expect(a.folgen.find(f => f.id === 'sv-5')!.urteil).toBe('mehr-davon');
    expect(a.folgen.find(f => f.id === 'sv-6')!.urteil).toBe('streichen');
    expect(a.top[0].id).toBe('sv-5');
    expect(a.empfehlungen.join(' ')).toMatch(/Stärkstes Format bisher: „Day X“/);
  });
  it('Hook-Vergleich: nur innerhalb einer Folge, Tendenz erst ab 2 Plattformen je Variante', () => {
    const h = [{ id: 'hk-a', text: 'A' }, { id: 'hk-b', text: 'B' }];
    const m = (id: string, plattform: 'tiktok' | 'instagram', hookId: string, halte3s: number, am = '2026-10-22') => ({ id, plattform, am, views: 1000, halte3s, hookId, quelle: 'hand' as const });
    const eine = mk(1, 1000, 50, { hooks: h, messungen: [m('m1', 'tiktok', 'hk-a', 40), m('m2', 'tiktok', 'hk-b', 70)] });
    expect(kanalAnalyse([eine], 'sk-1').hooks[0].vorn).toBeNull(); // je Variante nur eine Plattform
    const zwei = mk(1, 1000, 50, { hooks: h, messungen: [m('m1', 'tiktok', 'hk-a', 40), m('m2', 'tiktok', 'hk-b', 70), m('m3', 'instagram', 'hk-a', 42), m('m4', 'instagram', 'hk-b', 68), m('m0', 'tiktok', 'hk-a', 90, '2026-10-20')] });
    const a = kanalAnalyse([zwei], 'sk-1');
    expect(a.hooks[0].vorn).toBe('hk-b'); // der ältere Zwischenstand (90 %) zählt nicht
    expect(a.hooks[0].folgeId).toBe('sv-1');
    // Gleiche Hook-Kennung in zwei verschiedenen Folgen: kein Vergleich über Folgen hinweg
    const getrennt = kanalAnalyse([mk(2, 1000, 40, { hooks: h, hookId: 'hk-a' }), mk(3, 1000, 70, { hooks: h, hookId: 'hk-b' })], 'sk-1');
    expect(getrennt.hooks).toHaveLength(0);
  });
});

describe('CSV-Import', () => {
  it('Zahlen- und Datumsformate', () => {
    expect(zahlAus('1.234')).toBe(1234);
    expect(zahlAus('1,5K')).toBe(1500);
    expect(zahlAus('3,4 Mio.')).toBe(3400000);
    expect(zahlAus('45 %')).toBe(45);
    expect(zahlAus('-')).toBeUndefined();
    expect(tagAus('27.10.2026')).toBe('2026-10-27');
    expect(tagAus('2026-10-27T10:00:00Z')).toBe('2026-10-27');
    expect(tagAus('irgendwas')).toBeUndefined();
  });
  it('ordnet über Link oder eindeutigen Titel zu, rät nie', () => {
    const fs: SocialFolge[] = [
      { id: 'sv-1', kanalId: 'sk-1', titel: 'Day 1', skript: '', hooks: [], quellen: [], kiInhalt: true, status: 'veroeffentlicht', veroeffentlicht: [{ plattform: 'tiktok', am: '2026-10-20', link: 'https://www.tiktok.com/@beispiel/video/1' }], messungen: [], geaendert: '' },
      { id: 'sv-2', kanalId: 'sk-1', titel: 'Doppelt', skript: '', hooks: [], quellen: [], kiInhalt: true, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '' },
      { id: 'sv-3', kanalId: 'sk-1', titel: 'Doppelt', skript: '', hooks: [], quellen: [], kiInhalt: true, status: 'entwurf', veroeffentlicht: [], messungen: [], geaendert: '' },
    ];
    const csv = '﻿Video title,Video link,Post time,Total views,Total shares,Average watch time\n"Irgendwas",https://www.tiktok.com/@beispiel/video/1/,2026-10-21,"1,234",12,9.5\nDoppelt,,2026-10-21,500,1,3\nUnbekannt,,,7,0,1\nKaputt,,,-,0,0';
    const v = importVorschau(csv, 'tiktok', fs, '2026-10-26');
    expect(v.spalten.views).toBe('Total views');
    expect(v.zeilen.map(z => z.folgeId)).toEqual(['sv-1', null, null]);
    expect(v.zeilen[0].messung).toMatchObject({ views: 1234, shares: 12, schnittSek: 9.5, am: '2026-10-21', quelle: 'import' });
    expect(v.zeilen[2].messung.am).toBe('2026-10-26');
    expect(v.zeilen[1].hinweis).toMatch(/Mehrere/);
    expect(v.fehler.length).toBe(1);
  });
  it('ohne Spalte für Aufrufe: Fehler, keine Zeilen', () => {
    const v = importVorschau('Titel;Likes\nA;3', 'instagram', [], '2026-10-26');
    expect(v.zeilen).toEqual([]);
    expect(v.fehler[0]).toMatch(/Aufrufe/);
  });
});

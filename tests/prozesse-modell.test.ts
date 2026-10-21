// ─── Prozesse · Modell, Lage, Adresse (Etappe A, 21.10.; ANALYSE_100.md Punkte 2, 3, 5, 9, 12–15, 20, 24, 26, 27, 30, 93) ─────────────────────
// Rein (ohne DOM): die Fliege (Bänder, Stufen links → rechts, Knoten schmal, keine Überlappung, Übergaben als Wege), der Prozess auf Ebene 2, die Rahmen
// zum Präsentieren, die Adresse (Pfad, Vollbild, Darstellung, Präsentieren), Brotkrumen, Suche, Liste/Text aus DEMSELBEN Modell, Zahlen ohne Null,
// „jede Information nur einmal“, semantischer Zoom, Vorlagen aus dem Fulfillment, Kontrast der Töne.
import { describe, it, expect } from 'vitest';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { KERN_STUFEN, PROZESS_ANSICHTEN, ansichtVorgabe, ebeneVon, istProzessAnsicht, type ProzessDef, type Zahl } from '@/lib/prozesse/typen';
import { fliegeLage, prozessLage, huelle, FLIEGE } from '@/lib/prozesse/landkarte';
import { prozesseLink, prozesseAusAdresse, ebeneHoch, PROZESSE_PFAD } from '@/lib/prozesse/adresse';
import { brotkrumen, pfadGueltig, prozesseSuchen, alsListe, alsText, zahlTexte, kachelTexte, steckbriefZeilen, schrittSatz, zahlSchluessel, kurztitel } from '@/lib/prozesse/modell';
import { prozessAusVorlage } from '@/lib/prozesse/vorlagen';
import { STUFE_FARBE, BAND_FARBE } from '@/lib/prozesse/farben';
import { reiheVerteilen } from '@/lib/prozesse/lage';
import { zoomStufe, ZOOM_STUFEN } from '@/components/os/ui/flaeche/stufe';
import { WEG } from '@/lib/wege';
import { FARBE } from '@/lib/make-one/design';
import { TIEF } from '@/lib/make-one/design';
import type { Box } from '@/lib/fulfillment/prozesse/flaeche';
import type { ProzessVorlage } from '@/lib/fulfillment/typen';

const L = SYSTEM_PROZESSE;
const ueberlappt = (a: Box, b: Box) => a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h;

describe('Die Fliege (Punkte 2, 3, 9 — Entscheidung E1)', () => {
  const lage = fliegeLage(L);
  it('drei Bänder: Führung oben, Kern (die Fliege) in der Mitte, Unterstützung unten', () => {
    const f = lage.baender.find(b => b.id === 'fuehrung')!, u = lage.baender.find(b => b.id === 'unterstuetzung')!;
    expect(f.y + f.h).toBeLessThan(lage.fliege.mitte - Math.max(...lage.fliege.stufen.map(s => s.halb)));
    expect(u.y).toBeGreaterThan(lage.fliege.mitte + Math.max(...lage.fliege.stufen.map(s => s.halb)));
    for (const k of lage.kacheln.filter(k => k.band === 'fuehrung')) expect(k.y + k.h).toBeLessThanOrEqual(f.y + f.h);
    for (const k of lage.kacheln.filter(k => k.band === 'unterstuetzung')) expect(k.y).toBeGreaterThanOrEqual(u.y);
  });
  it('Kern links → rechts: Marketing, Sales, Übergabe, Fulfillment, Ausbau — jede Kachel in der Spalte ihrer Stufe', () => {
    expect(lage.fliege.stufen.map(s => s.id)).toEqual(KERN_STUFEN.map(s => s.id));
    for (let i = 1; i < lage.fliege.stufen.length; i++) expect(lage.fliege.stufen[i].x).toBeGreaterThan(lage.fliege.stufen[i - 1].x);
    for (const k of lage.kacheln.filter(k => k.band === 'kern')) {
      const s = lage.fliege.stufen.find(x => x.id === k.stufe)!;
      expect(k.x >= s.x && k.x + k.b <= s.x + s.b, k.id).toBe(true);
    }
  });
  it('eine Fliege: außen weit, in der Mitte (Übergabe) der schmale Knoten auf dem Weg des Kunden; sonst bleibt die Gasse frei', () => {
    const halb = Object.fromEntries(lage.fliege.stufen.map(s => [s.id, s.halb]));
    expect(halb.uebergabe).toBeLessThan(halb.marketing);
    expect(halb.uebergabe).toBeLessThan(halb.ausbau);
    expect(halb.uebergabe).toBeLessThan(halb.sales);
    expect(halb.uebergabe).toBeLessThan(halb.fulfillment);
    for (const k of lage.kacheln.filter(k => k.band === 'kern' && k.stufe !== 'uebergabe')) expect(k.y + k.h <= lage.fliege.mitte - FLIEGE.gasse / 2 + 0.1 || k.y >= lage.fliege.mitte + FLIEGE.gasse / 2 - 0.1).toBe(true);
    // Der Knoten liegt AUF dem Weg (er ist der Knoten der Fliege).
    const knoten = lage.kacheln.find(k => k.stufe === 'uebergabe')!;
    expect(knoten.y < lage.fliege.mitte && knoten.y + knoten.h > lage.fliege.mitte).toBe(true);
    expect(lage.fliege.pfad.startsWith('M')).toBe(true);
    expect(lage.fliege.pfad.endsWith('Z')).toBe(true);
    // Der Weg des Kunden: von ganz links nach ganz rechts, je Stufe ein Abschnitt, lückenlos.
    expect(lage.rueckgrat.punkte[0][0]).toBeLessThan(lage.rueckgrat.punkte[1][0]);
    expect(lage.rueckgrat.abschnitte[0].von).toBe(0);
    expect(lage.rueckgrat.abschnitte.at(-1)!.bis).toBe(1);
    for (let i = 1; i < lage.rueckgrat.abschnitte.length; i++) expect(lage.rueckgrat.abschnitte[i].von).toBeCloseTo(lage.rueckgrat.abschnitte[i - 1].bis, 3);
  });
  it('alle Prozesse als Kachel, keine überlappt, alle im Bild', () => {
    expect(lage.kacheln.map(k => k.id).sort()).toEqual(L.map(p => p.id).sort());
    for (let i = 0; i < lage.kacheln.length; i++) for (let j = i + 1; j < lage.kacheln.length; j++) expect(ueberlappt(lage.kacheln[i], lage.kacheln[j]), `${lage.kacheln[i].id} × ${lage.kacheln[j].id}`).toBe(false);
    for (const k of lage.kacheln) expect(ueberlappt(k, lage.box) && k.x >= lage.box.x && k.x + k.b <= lage.box.x + lage.box.b).toBe(true);
  });
  it('Übergaben (Punkt 9): je eine beschriftete Linie von Kachel zu Kachel (kurze immer, lange nur mit Fokus); nach links = zurück', () => {
    const n = L.reduce((a, p) => a + (p.uebergaben?.length ?? 0), 0);
    expect(lage.pfeile).toHaveLength(n);
    const nach = new Map(lage.kacheln.map(k => [k.id, k]));
    for (const pf of lage.pfeile) {
      expect(pf.punkte.length).toBeGreaterThanOrEqual(2);
      expect(pf.text.length).toBeGreaterThan(0);
      const a = nach.get(pf.von)!, b = nach.get(pf.nach)!;
      const [x0, y0] = pf.punkte[0], [x1, y1] = pf.punkte.at(-1)!;
      // Beginnt an der Kante der Quelle, endet an der Kante des Ziels.
      expect(x0 >= a.x - 0.5 && x0 <= a.x + a.b + 0.5 && y0 >= a.y - 0.5 && y0 <= a.y + a.h + 0.5).toBe(true);
      expect(x1 >= b.x - 0.5 && x1 <= b.x + b.b + 0.5 && y1 >= b.y - 0.5 && y1 <= b.y + b.h + 0.5).toBe(true);
    }
    expect(lage.pfeile.find(p => p.von === 'sp-wiederkauf' && p.nach === 'sp-deal')?.art).toBe('zurueck');
    expect(lage.pfeile.find(p => p.von === 'sp-lead-sql' && p.nach === 'sp-deal')?.art).toBe('weiter');
  });
  it('deterministisch; eine leere Instanz bzw. nur ein Band legt sich ohne Fehler aus', () => {
    expect(JSON.stringify(fliegeLage(L))).toBe(JSON.stringify(lage));
    const leer = fliegeLage([]);
    expect(leer.kacheln).toEqual([]);
    expect(leer.fliege.stufen).toHaveLength(5);
    const nurKern = fliegeLage(L.filter(p => p.band === 'kern'));
    expect(nurKern.baender).toEqual([]);
    expect(nurKern.kacheln.every(k => k.band === 'kern')).toBe(true);
  });
  it('Präsentieren (Punkt 93): erst das Ganze, dann Führung, die fünf Stufen entlang des Flows, Unterstützung', () => {
    expect(lage.rahmen.map(r => r.id)).toEqual(['alles', 'fuehrung', ...KERN_STUFEN.map(s => s.id), 'unterstuetzung']);
    for (const k of lage.kacheln.filter(k => k.band === 'kern')) {
      const r = lage.rahmen.find(x => x.id === k.stufe)!.box;
      expect(k.x >= r.x && k.x + k.b <= r.x + r.b && k.y >= r.y && k.y + k.h <= r.y + r.h).toBe(true);
    }
  });
  it('die Reihen-Regel ist verallgemeinert: füllen (Hochhaus) bzw. feste Breite mittig mit Umbruch (Bänder)', () => {
    const f = reiheVerteilen({ anzahl: 3, x: 10, breite: 300, luecke: 10 });
    expect(f.map(r => r.b)).toEqual([280 / 3, 280 / 3, 280 / 3]);
    expect(f[2].x + f[2].b).toBeCloseTo(310, 6);
    const k = reiheVerteilen({ anzahl: 5, x: 0, breite: 500, luecke: 20, kachel: 140 });
    expect(new Set(k.map(r => r.zeile))).toEqual(new Set([0, 1]));
    expect(k[0].x).toBe(20); // drei je Zeile (3 · 140 + 2 · 20 = 460), mittig: (500 − 460) / 2
    expect(reiheVerteilen({ anzahl: 0, x: 0, breite: 10, luecke: 1 })).toEqual([]);
  });
});

describe('Ebene 2: ein Prozess', () => {
  const p = L.find(x => x.id === 'sp-deal')!;
  const l = prozessLage(p, L);
  it('Start → Phasen links → rechts → Ergebnis; der Weg läuft durch die Mitte', () => {
    expect(l.phasen.map(x => x.id)).toEqual(p.phasen.map(x => x.id));
    expect(l.start.x).toBeLessThan(l.phasen[0].x);
    expect(l.ende.x).toBeGreaterThan(l.phasen.at(-1)!.x);
    for (const ph of l.phasen) expect(ph.y + ph.h / 2).toBeCloseTo(l.mitte, 1);
    expect(l.weg[0][1]).toBe(l.mitte);
  });
  it('Geister: wer übergibt (links) und an wen (rechts) — mit beschrifteten Wegen', () => {
    const von = l.geister.filter(g => g.richtung === 'von').map(g => g.id);
    const an = l.geister.filter(g => g.richtung === 'an').map(g => g.id);
    expect(von).toContain('sp-lead-sql');
    expect(von).toContain('sp-wiederkauf');
    expect(an).toEqual(['sp-uebergabe']);
    for (const g of l.geister) expect(g.richtung === 'von' ? g.x + g.b < l.start.x : g.x > l.ende.x + l.ende.b).toBe(true);
    expect(l.pfeile).toHaveLength(l.geister.length);
    expect(l.rahmen[0].id).toBe('alles');
    expect(l.rahmen.slice(1).map(r => r.id)).toEqual(p.phasen.map(x => x.id));
  });
  it('höchstens vier Schritte je Phase im Bild, der Rest als „+n“', () => {
    const viele: ProzessDef = { ...p, phasen: [{ id: 'a', titel: 'A', schritte: Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, titel: `S${i}`, form: 'schritt' as const })) }] };
    const x = prozessLage(viele, [viele]);
    expect(x.phasen[0].zeilen).toHaveLength(4);
    expect(x.phasen[0].mehr).toBe(3);
  });
  it('Hülle um Boxen', () => {
    expect(huelle([{ x: 0, y: 0, b: 10, h: 10 }, { x: 20, y: 5, b: 10, h: 10 }], 5)).toEqual({ x: -5, y: -5, b: 40, h: 25 });
    expect(huelle([])).toEqual({ x: 0, y: 0, b: 0, h: 0 });
  });
});

describe('Adresse und Ebenen (Punkte 5, 11, 12, 30, 93)', () => {
  it('Pfad in der Adresse, feste Reihenfolge, ungültige Kennungen fallen weg; Schritt ohne Phase gibt es nicht', () => {
    expect(prozesseLink()).toBe(PROZESSE_PFAD);
    expect(prozesseLink({ p: 'sp-deal', ph: 'angebot', s: 'ag-1', voll: true, ansicht: 'liste' })).toBe('/os/prozesse?p=sp-deal&ph=angebot&s=ag-1&ansicht=liste&voll=1');
    expect(prozesseLink({ s: 'x' })).toBe(PROZESSE_PFAD);
    expect(prozesseLink({ p: '<script>' })).toBe(PROZESSE_PFAD);
    expect(prozesseLink({ p: 'sp-deal', modus: 'praesentieren', voll: true })).toBe('/os/prozesse?p=sp-deal&modus=praesentieren');
    const a = prozesseAusAdresse(new URLSearchParams('p=sp-deal&ph=angebot&s=ag-1&ansicht=liste&voll=1'));
    expect(a).toEqual({ p: 'sp-deal', ph: 'angebot', s: 'ag-1', ansicht: 'liste', voll: true });
    expect(prozesseAusAdresse(new URLSearchParams('ph=x&s=y&ansicht=quatsch'))).toEqual({});
    expect(prozesseAusAdresse(new URLSearchParams('modus=praesentieren'))).toEqual({ modus: 'praesentieren', voll: true });
    expect(WEG.prozesse({ p: 'sp-deal' })).toBe('/os/prozesse?p=sp-deal');
  });
  it('Ebenen: Landkarte → Prozess → Ablauf → Schritt; Esc fährt eine Ebene hinaus, Vollbild und Darstellung bleiben', () => {
    expect(ebeneVon({})).toBe(1);
    expect(ebeneVon({ p: 'a' })).toBe(2);
    expect(ebeneVon({ p: 'a', ph: 'b' })).toBe(3);
    expect(ebeneVon({ p: 'a', ph: 'b', s: 'c' })).toBe(4);
    expect(ebeneHoch({ p: 'a', ph: 'b', s: 'c', voll: true })).toEqual({ p: 'a', ph: 'b', voll: true });
    expect(ebeneHoch({ p: 'a', ph: 'b', ansicht: 'liste' })).toEqual({ p: 'a', ansicht: 'liste' });
    expect(ebeneHoch({ p: 'a' })).toEqual({});
    expect(ebeneHoch({})).toEqual({});
  });
  it('Brotkrumen: Landkarte › Prozess › Phase › Schritt; Unbekanntes fällt weg', () => {
    expect(brotkrumen(L, { p: 'sp-deal', ph: 'angebot', s: 'ag-1' }).map(k => k.titel)).toEqual(['Landkarte', 'Deal → Angebot → Mandat', 'Angebot', 'Angebot stellen']);
    expect(brotkrumen(L, { p: 'gibt-es-nicht', ph: 'x' }).map(k => k.titel)).toEqual(['Landkarte']);
    expect(pfadGueltig(L, { p: 'sp-deal', ph: 'quatsch', s: 'ag-1' })).toEqual({ p: 'sp-deal' });
  });
  it('Darstellungen: EINE Liste (Bild, Liste — erweiterbar), am Handy startet die Liste', () => {
    expect(PROZESS_ANSICHTEN.map(a => a.id)).toEqual(['bild', 'liste']);
    expect(istProzessAnsicht('liste')).toBe(true);
    expect(istProzessAnsicht('werkstatt')).toBe(false);
    expect(ansichtVorgabe(null, true)).toBe('liste');
    expect(ansichtVorgabe(null, false)).toBe('bild');
    expect(ansichtVorgabe('bild', true)).toBe('bild');
  });
});

describe('Suche, Liste, Text (Punkte 15, 30)', () => {
  it('Suche findet Prozesse, Phasen und Schritte (Umlaute gefaltet) und nennt die Ebene, auf der der Treffer aufleuchtet', () => {
    const t = prozesseSuchen(L, 'uebergabe');
    expect(t[0]).toMatchObject({ art: 'prozess', id: 'sp-uebergabe', ziel: {}, leuchten: 'sp-uebergabe' });
    const s = prozesseSuchen(L, 'Angebot stellen').find(x => x.art === 'schritt')!;
    expect(s).toMatchObject({ ziel: { p: 'sp-deal', ph: 'angebot', s: 'ag-1' }, leuchten: 'ag-1' });
    expect(prozesseSuchen(L, '   ')).toEqual([]);
    expect(prozesseSuchen(L, 'e', 5)).toHaveLength(5);
  });
  it('Liste aus demselben Modell: jede Kachel steht drin, Rauten als „Wenn ja … · wenn nein …“, Enden und Schleifen in Worten', () => {
    const liste = alsListe(L);
    expect(liste.map(b => b.id)).toEqual(['fuehrung', 'kern', 'unterstuetzung']);
    const ids = liste.flatMap(b => b.gruppen.flatMap(g => g.prozesse.map(p => p.id)));
    expect(ids.sort()).toEqual(L.map(p => p.id).sort());
    expect(liste.find(b => b.id === 'kern')!.gruppen.map(g => g.titel)).toEqual(KERN_STUFEN.map(s => s.titel));
    const deal = L.find(p => p.id === 'sp-deal')!;
    const ab = deal.phasen.find(p => p.id === 'abschluss')!;
    expect(schrittSatz(ab, ab.schritte[0])).toBe('Wenn ja: weiter bei „Deal gewonnen“ · wenn nein: weiter bei „Verloren mit Grund“');
    expect(schrittSatz(ab, ab.schritte[1])).toBe('Ende dieses Wegs');
    const ag = deal.phasen.find(p => p.id === 'angebot')!;
    expect(schrittSatz(ag, ag.schritte[3])).toBe('Danach zurück zu „Entscheidungsdatum genannt?“');
    const text = alsText(liste);
    expect(text).toContain('# Kern');
    expect(text).toContain('## Übergabe');
    expect(text).toContain('Verloren mit Grund — Ende dieses Wegs');
    expect(text).toContain('[System]');
  });
  it('Steckbrief (Punkt 7): sechs Felder; liegt das Bild daneben, steht bei „Phasen“ nur die Zahl (Punkt 24)', () => {
    const p = L.find(x => x.id === 'sp-lead-sql')!;
    expect(steckbriefZeilen(p).map(z => z.titel)).toEqual(['Auslöser', 'Eingang', 'Phasen', 'Ergebnis', 'Empfänger', 'Eigner']);
    expect(steckbriefZeilen(p).find(z => z.id === 'phasen')!.wert).toBe('Ansprechen → Qualifizieren → SQL');
    expect(steckbriefZeilen(p, { phasenImBild: true }).find(z => z.id === 'phasen')!.wert).toBe('3 Phasen');
  });
});

describe('Zahlen und „wenig und klar“ (Punkte 24, 27)', () => {
  it('nie eine Null: ohne Wert keine Zahl; die zweite nur mit Wert, rot nur bei Frist', () => {
    expect(zahlTexte(undefined)).toBeNull();
    expect(zahlTexte({ wert: 0, wort: 'offen' })).toBeNull();
    expect(zahlTexte({ wert: 1200, wort: 'in Arbeit' })).toEqual({ haupt: '1.200 in Arbeit' });
    expect(zahlTexte({ wert: 3, wort: 'fällig', zweite: { wert: 1, wort: 'überfällig', rot: true } })).toEqual({ haupt: '3 fällig', zweite: { text: '1 überfällig', rot: true } });
    expect(zahlTexte({ wert: 0, wort: 'offen', zweite: { wert: 12, wort: 'rechtzeitig nachgefasst' } })).toEqual({ zweite: { text: '12 rechtzeitig nachgefasst', rot: false } });
    expect(zahlSchluessel({ p: 'a', ph: 'b', s: 'c' })).toBe('a/b/c');
    expect(zahlSchluessel({ p: 'a' })).toBe('a');
  });
  it('eine Kachel zeigt jede Information nur einmal: fern kurzer Titel + EINE Zahl, mittel Titel + Zahl, nah dazu Marke und Eigner', () => {
    const z: Zahl = { wert: 3, wort: 'fällig', zweite: { wert: 1, wort: 'überfällig', rot: true } };
    for (const p of L) for (const st of ['fern', 'mittel', 'nah'] as const) {
      const t = Object.values(kachelTexte(p, z, st)).filter(Boolean) as string[];
      expect(new Set(t).size, `${p.id} ${st}`).toBe(t.length);
    }
    const p = L.find(x => x.id === 'sp-followup')!;
    expect(kachelTexte(p, z, 'fern')).toEqual({ titel: 'Follow-up & Power Hour', zahl: '3 fällig' });
    expect(kachelTexte(p, z, 'mittel')).toEqual({ titel: 'Follow-up & Power Hour', zahl: '3 fällig', zweite: '1 überfällig' });
    expect(kachelTexte(p, undefined, 'nah')).toEqual({ titel: 'Follow-up & Power Hour', marke: 'System · nur lesbar', eigner: 'Head of Sales' });
    expect(kurztitel('Netzwerken (Erfassen auf Veranstaltungen)')).toBe('Netzwerken');
  });
});

describe('Semantischer Zoom (Punkt 14): EINE Regel neben der Kamera', () => {
  it('fern · mittel · nah nur aus dem Zoomwert', () => {
    expect(zoomStufe(0.2)).toBe('fern');
    expect(zoomStufe(ZOOM_STUFEN.fernUnter)).toBe('mittel');
    expect(zoomStufe(1)).toBe('mittel');
    expect(zoomStufe(ZOOM_STUFEN.nahAb)).toBe('nah');
    expect(zoomStufe(NaN)).toBe('mittel');
  });
});

describe('Vorlagen aus dem Fulfillment auf der Landkarte (Punkt 4)', () => {
  const basis = { uebergaenge: [], rollen: [], fassung: 1, geaendert: '', geaendertVon: '' };
  const paket: ProzessVorlage = {
    ...basis, id: 'fp-paket', art: 'paket', titel: 'Beispielpaket', freigaben: [{ id: 'fg-1', titel: 'Ziele bestätigt', wer: 'beide' }],
    knoten: [
      { id: 'fk-w', titel: 'Beispielpaket', rang: 0 },
      { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 0, freigabe: 'fg-1' },
      { id: 'fk-s1', elternId: 'fk-p1', titel: 'Kick-off', rang: 0, form: 'termin' },
      { id: 'fk-s2', elternId: 'fk-p1', titel: 'Passt der Plan?', rang: 1, form: 'entscheidung', zweige: { nein: 'fk-s3' } },
      { id: 'fk-s3', elternId: 'fk-p1', titel: 'Nachfragen', rang: 2, form: 'erinnerung', zweige: { ja: 'fk-s2' } },
    ],
  };
  it('Paket: Phasen und Schritte wie im Editor, Abstimmungspunkt, „Im Editor öffnen“', () => {
    const p = prozessAusVorlage(paket)!;
    expect(p).toMatchObject({ id: 'fp-paket', quelle: 'vorlage', band: 'kern', stufe: 'fulfillment' });
    expect(p.phasen).toHaveLength(1);
    expect(p.phasen[0].schritte.map(s => [s.id, s.form])).toEqual([['fk-s1', 'termin'], ['fk-s2', 'entscheidung'], ['fk-s3', 'erinnerung']]);
    expect(p.phasen[0].schritte[1].nein).toBe('fk-s3');
    expect(p.phasen[0].abstimmung).toContain('Ziele bestätigt');
    expect(p.editor).toBe(WEG.fulfillment('prozesse', { e: 'fp-paket' }));
  });
  it('Landkarte (Hochhaus): eine Kachel ohne eigene Zahl, der Drill-down führt ins Hochhaus; Ablauf: Stufe aus dem Kreislauf-Bezug', () => {
    const hh: ProzessVorlage = { ...basis, id: 'fp-land', art: 'landkarte', titel: 'Landkarte', freigaben: [], knoten: [
      { id: 'fk-w', titel: 'Firma', rang: 0 }, { id: 'fk-e1', elternId: 'fk-w', titel: 'Onboarding', rang: 0, zone: 'etage' }, { id: 'fk-x', elternId: 'fk-e1', titel: 'Willkommen', rang: 0 },
    ] };
    const p = prozessAusVorlage(hh)!;
    expect(p.hochhaus).toBe(true);
    expect(p.zaehler).toBeUndefined();
    expect(p.link?.href).toBe(WEG.fulfillment('prozesse'));
    expect(p.phasen[0]).toMatchObject({ id: 'fk-e1', schritte: [{ id: 'fk-x', titel: 'Willkommen', form: 'schritt' }] });
    const ab: ProzessVorlage = { ...basis, id: 'fp-ab', art: 'ablauf', titel: 'Vertriebsweg', freigaben: [], knoten: [
      { id: 'fk-w', titel: 'Vertriebsweg', rang: 0 }, { id: 'fk-a', elternId: 'fk-w', titel: 'Erstgespräch', rang: 0, kreislauf: ['deals'] },
    ] };
    expect(prozessAusVorlage(ab)!.stufe).toBe('sales');
    expect(prozessAusVorlage({ ...ab, knoten: [] })).toBeNull();
  });
});

describe('Farbe nie allein, Kontrast (Punkt 26)', () => {
  const lum = (h: string) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const mix = (f: string, b: string, a: number) => `#${[1, 3, 5].map(i => Math.round(parseInt(f.slice(i, i + 2), 16) * a + parseInt(b.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  const kr = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  it('jeder Ton ≥ 3:1 gegen den Grund und die Kachel; Titel auf der getönten Kachel ≥ 4,5:1', () => {
    const alpha = parseInt(TIEF.flaeche('#000000').slice(-2), 16) / 255;
    for (const f of [...Object.values(STUFE_FARBE), ...Object.values(BAND_FARBE)]) {
      const kachel = mix(f, FARBE.flaecheHoch, alpha);
      expect(kr(f, FARBE.grund), `${f} gegen Grund`).toBeGreaterThanOrEqual(3);
      expect(kr(f, kachel), `${f} gegen Kachel`).toBeGreaterThanOrEqual(3);
      expect(kr(FARBE.ink, kachel), `Titel auf ${f}`).toBeGreaterThanOrEqual(4.5);
      expect(kr(FARBE.inkDim, kachel), `Zeile auf ${f}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('jede Stufe hat einen eigenen Ton — und steht zusätzlich als Wort über ihrer Spalte', () => {
    expect(new Set(Object.values(STUFE_FARBE)).size).toBe(KERN_STUFEN.length);
    expect(fliegeLage(L).fliege.stufen.map(s => s.titel)).toEqual(KERN_STUFEN.map(s => s.titel));
  });
});

// ─── Prozesse B1 — das EINE Modell: Fulfillment bit-gleich, Säuberer, Fluss, Prüfung (21.10.) ───────────────────────────────────────────────────────
// Punkte 6, 22, 45, 100: ein Modell für alle Bereiche, alte Fulfillment-Vorlagen bleiben bit-gleich gültig (Fehlen = Fulfillment/Mandat), Baukasten mit
// neuen Formen, Kanten an EINER Stelle, eine Instanz ohne Prozesse startet sauber. Rein bis auf den letzten Block (eigener Datenordner).
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { vorlageAus } from '@/lib/fulfillment/lesen';
import type { ProzessVorlage as FfVorlage } from '@/lib/fulfillment/typen';
import { bereichVon, fallArtVon, type ProzessDefinition } from '@/lib/prozesse/definition';
import { prozessAusFulfillment, kurzAusFulfillment, fulfillmentProzesse } from '@/lib/prozesse/fulfillment-bruecke';
import { definitionAus, knotenAus, prozesseAus, eintragAus, neuerProzess } from '@/lib/prozesse/bestand';
import { kantenVon, flussPruefen, alleSchritte } from '@/lib/prozesse/fluss';
import { definitionPruefen, sperrtSpeichern, sperrtVeroeffentlichen } from '@/lib/prozesse/definition-pruefen';
import { definition, fk, schritt, PZ, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-modell-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

/** Eine Paket-Vorlage, wie sie im Bestand `fulfillment--<h>` liegt (erfunden). */
const FF_ROH = {
  id: 'fp-probe-paket', art: 'paket', titel: 'Probe-Paket', fassung: 3, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [{ id: 'A1', titel: 'Bestätigt', wer: 'beide' }], rollen: [],
  phasenVonHand: true,
  knoten: [
    { id: 'fk-probe-w', titel: 'Probe-Paket', rang: 1 },
    { id: 'fk-probe-p1', elternId: 'fk-probe-w', titel: 'Start', rang: 1, freigabe: 'A1', kundeSichtbar: true },
    { id: 'fk-probe-s1', elternId: 'fk-probe-p1', titel: 'Kick-off planen', rang: 1, form: 'termin', frist: 3, zustaendig: 'intern' },
    { id: 'fk-probe-s2', elternId: 'fk-probe-p1', titel: 'Passt es?', rang: 2, form: 'entscheidung', zweige: { nein: 'fk-probe-s3' }, pos: { x: 10, y: 20 }, pfeilText: { ja: 'passt' } },
    { id: 'fk-probe-s3', elternId: 'fk-probe-p1', titel: 'Nachhaken', rang: 3, form: 'erinnerung', zweige: { ja: 'fk-probe-s2' }, versuche: 3 },
    { id: 'fk-probe-s4', elternId: 'fk-probe-p1', titel: 'Willkommen schicken', rang: 4, form: 'nachricht' },
  ],
};

describe('EIN Modell: Fulfillment-Vorlagen bleiben bit-gleich gültig', () => {
  it('der Säuberer des Fulfillments liest eine Vorlage unverändert (die Typen sind nur verschoben)', () => {
    const v = vorlageAus(JSON.parse(JSON.stringify(FF_ROH)))!;
    expect(JSON.parse(JSON.stringify(v))).toEqual(FF_ROH);
  });
  it('Fehlen = Fulfillment und Mandat; die Brücke ändert keinen Knoten (dieselbe Liste)', () => {
    const v = vorlageAus(JSON.parse(JSON.stringify(FF_ROH))) as FfVorlage;
    expect(bereichVon(v)).toBe('fulfillment');
    expect(fallArtVon(v)).toBe('mandat');
    const p = prozessAusFulfillment(v);
    expect(p.knoten).toBe(v.knoten);
    expect(p.bereich).toBe('fulfillment');
    expect(kurzAusFulfillment(v)).toMatchObject({ quelle: 'fulfillment', nurLesen: true, version: 3, bereich: 'fulfillment', fallArt: 'mandat' });
    expect(fulfillmentProzesse([v, { ...v, id: 'fp-karte', art: 'landkarte' }]).map(x => x.id)).toEqual(['fp-probe-paket']);
  });
  it('der allgemeine Säuberer liest die Felder des Fulfillments genauso', () => {
    const d = definitionAus({ ...JSON.parse(JSON.stringify(FF_ROH)) })!;
    const ff = vorlageAus(JSON.parse(JSON.stringify(FF_ROH)))!;
    expect(d.knoten).toEqual(ff.knoten);
  });
  it('neue Felder gehen nie in den Fulfillment-Bestand: dessen Säuberer verwirft Agent, Katalog und neue Formen', () => {
    const roh = JSON.parse(JSON.stringify(FF_ROH));
    roh.knoten.push({ id: 'fk-probe-s5', elternId: 'fk-probe-p1', titel: 'Agent', rang: 5, form: 'agent', agent: { wer: { art: 'zoe' } }, katalog: { id: 'agent.zoe' } });
    const k = vorlageAus(roh)!.knoten.find(x => x.id === 'fk-probe-s5')! as unknown as Record<string, unknown>;
    expect(k.form).toBeUndefined();
    expect(k.agent).toBeUndefined();
    expect(k.katalog).toBeUndefined();
  });
});

describe('Säuberer des Bestands prozesse--<h>', () => {
  it('Unlesbares fällt weg, nie ein Absturz; leere Datei = leer', () => {
    expect(prozesseAus(null)).toEqual({ v: 1, prozesse: [] });
    expect(prozesseAus('kaputt')).toEqual({ v: 1, prozesse: [] });
    expect(prozesseAus({ prozesse: [{ id: 'falsch' }, 7, null] })).toEqual({ v: 1, prozesse: [] });
  });
  it('doppelte Kennungen: der erste gilt; Listen werden nie gekürzt', () => {
    const e = neuerProzess({ id: PZ, titel: 'A', bereich: 'sales', fallArt: 'deal', von: 'pia', jetzt: J, kennung: (() => { let i = 10; return () => fk(i++); })() });
    const viele = { ...e, entwurf: { ...e.entwurf, knoten: [...e.entwurf.knoten, ...Array.from({ length: 300 }, (_, i) => schritt(100 + i, `S${i}`, i + 2))] } };
    const d = prozesseAus({ prozesse: [viele, { ...e, entwurf: { ...e.entwurf, titel: 'B' } }] });
    expect(d.prozesse).toHaveLength(1);
    expect(d.prozesse[0].entwurf.knoten).toHaveLength(303);
  });
  it('Form der neuen Felder: ungültige fallen weg, gültige bleiben (Lesen verliert nichts, was passt)', () => {
    const k = knotenAus({ id: fk(50), titel: 'X', rang: 1, form: 'agent', agent: { wer: { art: 'head', headId: 'sales' }, auftrag: 'A', budgetCent: 20, werkzeuge: ['crm_suche'], warumKeineRegel: 'x' }, bahn: 'nirgends', zweige: { ja: fk(2), fehler: fk(3), quatsch: 1 } })!;
    expect(k.agent?.wer).toEqual({ art: 'head', headId: 'sales' });
    expect(k.bahn).toBeUndefined();
    expect(k.zweige).toEqual({ ja: fk(2), fehler: fk(3) });
    expect(knotenAus({ id: fk(51), titel: 'Y', rang: 1, form: 'gibtsnicht' })!.form).toBeUndefined();
  });
  it('ein Eintrag mit fremder Definitions-Kennung ist unlesbar', () => {
    const e = neuerProzess({ id: PZ, titel: 'A', bereich: 'sales', fallArt: 'deal', von: 'pia', jetzt: J, kennung: (() => { let i = 10; return () => fk(i++); })() });
    expect(eintragAus({ ...e, entwurf: { ...e.entwurf, id: 'pz-anders' } } as unknown as Record<string, unknown>)).toBeNull();
  });
});

describe('Fluss: Kanten an EINER Stelle (Werkstatt und Motor)', () => {
  it('Strang, Phasenwechsel, Ende', () => {
    const p2 = { id: fk(4), elternId: fk(1), titel: 'Zwei', rang: 2 };
    const d = definition([schritt(10, 'A', 1), schritt(11, 'B', 2), schritt(20, 'C', 1, {}, fk(4)), schritt(21, 'Ende', 2, { form: 'ende', ende: { ergebnis: 'erfolg' } }, fk(4))], {}, [p2]);
    const k = kantenVon(d);
    expect(k).toContainEqual({ von: fk(3), nach: fk(10), ausgang: 'weiter' });
    expect(k).toContainEqual({ von: fk(11), nach: fk(20), ausgang: 'weiter' });
    expect(k).toContainEqual({ von: fk(20), nach: fk(21), ausgang: 'weiter' });
    expect(k.filter(x => x.von === fk(21))).toEqual([]);
  });
  it('Entscheidung: ja = weiter, nein neben dem Strang; Erinnerung „danach zurück“ (die erlaubte Schleife)', () => {
    const d = definition([
      schritt(10, 'Frage', 1, { form: 'entscheidung', zweige: { nein: fk(11) } }),
      schritt(11, 'Erinnern', 2, { form: 'erinnerung', zweige: { ja: fk(10) } }),
      schritt(12, 'Weiter', 3),
    ]);
    const k = kantenVon(d);
    expect(k).toContainEqual({ von: fk(10), nach: fk(12), ausgang: 'ja' });
    expect(k).toContainEqual({ von: fk(10), nach: fk(11), ausgang: 'nein' });
    expect(k).toContainEqual({ von: fk(11), nach: fk(10), ausgang: 'weiter' });
    expect(flussPruefen(d).filter(b => b.stufe === 'fehler')).toEqual([]);
  });
  it('Fehlerkante und Warten: abgelaufen ohne eigenen Zweig = weiter', () => {
    const d = definition([
      schritt(10, 'Aufgabe', 1, { zweige: { fehler: fk(11) } }),
      schritt(11, 'Hilfe holen', 2),
      schritt(12, 'Warten', 3, { form: 'warten', warten: { art: 'dauer', tage: 2 } }),
      schritt(13, 'Weiter', 4),
    ]);
    const k = kantenVon(d);
    expect(k).toContainEqual({ von: fk(10), nach: fk(11), ausgang: 'fehler' });
    expect(k).toContainEqual({ von: fk(10), nach: fk(12), ausgang: 'weiter' });
    // Das Seitenziel der Fehlerkante geht danach hinter seinem Ursprung weiter.
    expect(k).toContainEqual({ von: fk(11), nach: fk(12), ausgang: 'weiter' });
    expect(k).toContainEqual({ von: fk(12), nach: fk(13), ausgang: 'abgelaufen' });
  });
  it('Prüfung: Zweig auf sich selbst, in eine andere Phase, auf einen Auslöser, Ausgang, den die Form nicht hat, Kreis', () => {
    const p2 = { id: fk(4), elternId: fk(1), titel: 'Zwei', rang: 2 };
    const fehler = (d: ProzessDefinition) => flussPruefen(d).filter(b => b.stufe === 'fehler').map(b => b.text).join(' | ');
    expect(fehler(definition([schritt(10, 'A', 1, { zweige: { ja: fk(10) } })]))).toMatch(/auf sich selbst/);
    expect(fehler(definition([schritt(10, 'A', 1, { zweige: { ja: fk(20) } }), schritt(20, 'C', 1, {}, fk(4))], {}, [p2]))).toMatch(/andere Phase/);
    expect(fehler(definition([schritt(10, 'A', 1, { zweige: { ja: fk(3) } })]))).toMatch(/Auslöser/);
    expect(fehler(definition([schritt(10, 'A', 1, { zweige: { nein: fk(11) } }), schritt(11, 'B', 2)]))).toMatch(/keinen Ausgang „nein“/);
    expect(fehler(definition([schritt(10, 'A', 1), schritt(11, 'B', 2, { zweige: { ja: fk(10) } })]))).toMatch(/Kreis/);
    expect(fehler(definition([schritt(10, 'A', 1), schritt(11, 'Spät', 2, { form: 'ausloeser', ausloeser: { art: 'hand' } })]))).toMatch(/nicht am Anfang/);
  });
  it('ab zehn Schritten je Phase ein ruhiger Hinweis (nie gesperrt)', () => {
    const d = definition(Array.from({ length: 11 }, (_, i) => schritt(10 + i, `S${i}`, i + 1)));
    const b = flussPruefen(d);
    expect(b.some(x => x.stufe === 'hinweis' && /Teilprozess bilden/.test(x.text))).toBe(true);
    expect(b.some(x => x.stufe === 'fehler')).toBe(false);
  });
});

describe('Prüfung einer Definition', () => {
  it('ein neuer Prozess ist speicherbar; ohne Eigner und Kriterien noch nicht aktiv (das prüft aktivBefunde)', () => {
    const e = neuerProzess({ id: PZ, titel: 'Neu', bereich: 'marketing', fallArt: 'lead', von: 'pia', jetzt: J, kennung: (() => { let i = 10; return () => fk(i++); })() });
    const b = definitionPruefen(e.entwurf);
    expect(sperrtSpeichern(b)).toBe(false);
    expect(sperrtVeroeffentlichen(b)).toBe(false);
    expect(alleSchritte(e.entwurf).map(x => x.schritt.form)).toEqual(['ausloeser']);
  });
  it('ohne Auslöser offen; zwei Webhooks, unbekannter Baustein, Baustein zur falschen Form = Fehler', () => {
    const ohne = definition([schritt(10, 'A', 1)]);
    ohne.knoten = ohne.knoten.filter(k => k.id !== fk(3));
    expect(definitionPruefen(ohne).some(x => x.stufe === 'offen' && /Auslöser/.test(x.text))).toBe(true);
    const wh = (n: number) => schritt(n, 'Webhook', 0, { form: 'ausloeser', ausloeser: { art: 'webhook', felder: [] }, katalog: { id: 'ausloeser.webhook' } });
    expect(definitionPruefen(definition([wh(10), wh(11)])).some(x => x.stufe === 'fehler' && /ein Webhook/.test(x.text))).toBe(true);
    expect(definitionPruefen(definition([schritt(10, 'A', 1, { katalog: { id: 'gibt.esnicht' } })])).some(x => x.stufe === 'fehler' && /gibt es nicht/.test(x.text))).toBe(true);
    expect(definitionPruefen(definition([schritt(10, 'A', 1, { katalog: { id: 'agent.zoe' } })])).some(x => x.stufe === 'fehler' && /passt nicht zur Form/.test(x.text))).toBe(true);
  });
  it('Notiz-Zettel sind keine Knoten — sie laufen nie (keine Kanten)', () => {
    const d = definition([schritt(10, 'A', 1)], { zettel: [{ id: 'z1', text: 'Nur eine Notiz', pos: { x: 0, y: 0 }, farbe: 'gelb' }] });
    expect(kantenVon(d).some(k => k.von === 'z1' || k.nach === 'z1')).toBe(false);
    expect(definitionPruefen(d).filter(x => x.stufe === 'fehler')).toEqual([]);
    expect(definitionAus(d as unknown as Record<string, unknown>)!.zettel).toEqual([{ id: 'z1', text: 'Nur eine Notiz', pos: { x: 0, y: 0 }, farbe: 'gelb' }]);
  });
});

describe('Modul: eine Instanz ohne Prozesse startet sauber', () => {
  it('ohne Bestände liest alles leer — nichts wird angelegt', async () => {
    const { prozesseLesen, webhooksLesen } = await import('@/lib/prozesse/werkstatt-server');
    expect(await prozesseLesen('haus-leer')).toEqual({ v: 1, prozesse: [] });
    expect(await webhooksLesen('haus-leer')).toEqual({ v: 1, webhooks: [], eingaenge: [] });
    const db = await import('@/lib/store/local-db');
    expect(await db.loadJson('prozesse--haus-leer')).toBeNull();
  });
  it('die Schnittstelle des Moduls lädt ohne Server-Module (rein, client-sicher)', async () => {
    const s = await import('@/lib/prozesse/schnittstelle');
    expect(typeof s.kantenVon).toBe('function');
    expect(typeof s.werkstattAnwenden).toBe('function');
    expect(s.BAUSTEIN_KATALOG.length).toBeGreaterThan(20);
  });
});

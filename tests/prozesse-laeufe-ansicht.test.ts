// ─── Prozesse · Läufe-Ansicht, Scharfschalten, Feinschliff — die reinen Regeln (22.10.; lib/prozesse/laeufe-ansicht.ts, werkstatt-lage.ts, werkstatt-maske.ts) ─────
// Ohne Bestände: Zustand der Kopfzeile, Marken je Knoten („wartet auf dich“ pulsiert nur für die Person, mit Frist), der echte Weg als Kanten, der Log-Baum,
// Kosten-Zeilen und Budget-Vorschlag, der Vergleich der Testfälle, die Tageszeile auf Heute, die Fall-Suche des Probelaufs, die Adresse der Reiter — und die fünf
// Befunde der Sichtprüfung (Formauswahl, Kamera zum neuen Knoten, „+“ und Namen der Ausgänge, Einpassen, Bahn beim Anhängen).
import { describe, it, expect } from 'vitest';
import {
  werkstattZustand, fortsetzenStatus, laufMarken, laufWeg, kanteAufWeg, laufLog, dauerText, laufFiltern, kostenZeilen, budgetVorschlag, euroZuCent, centZuEuro,
  testVergleich, testUnterschiede, testStand, testfallName, heuteSatz, fallTreffer, fallName,
} from '@/lib/prozesse/laeufe-ansicht';
import { ausgangMarke, einpassKamera, inhaltBox, kameraZu, bahnBeimAnhaengen, werkstattLage, anschluesse, knotenMass } from '@/lib/prozesse/werkstatt-lage';
import { formauswahl } from '@/lib/prozesse/werkstatt-maske';
import { BAUSTEIN_KATALOG } from '@/lib/prozesse/baustein-katalog';
import { prozesseLink, prozesseAusAdresse } from '@/lib/prozesse/adresse';
import type { LaufSchritt, ProzessLaufStand } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt } from './fixtures/prozess-bau';

const scharfStand = (pause?: 'budget' | 'notbremse'): ProzessLaufStand => ({ einstellung: { scharf: { am: '2026-10-21T08:00:00Z', von: 'pia', version: 1, budgetCent: 500, schaetzungCent: 0, bestehende: 'nur-neue', bestehendeAnzahl: 0 } }, verlauf: [], ...(pause ? { pause: { grund: pause, am: '2026-10-22T08:00:00Z' } } : {}) });
const LAUF = 'pl-00000000-0000-4000-8000-000000000001';

describe('Zustand der Kopfzeile: Entwurf · Probelauf · scharf · pausiert', () => {
  it('Entwurf ohne Version: keine Aktion; mit Version: Schatten oder scharf', () => {
    expect(werkstattZustand('entwurf', null, false)).toMatchObject({ art: 'entwurf', aktionen: [] });
    expect(werkstattZustand('entwurf', null, true)).toMatchObject({ art: 'entwurf', aktionen: ['schatten', 'scharf'] });
  });
  it('aktiv ohne „scharf schalten“ läuft im Schatten (= Probelauf) — erst mit Einstellung „scharf“', () => {
    expect(werkstattZustand('aktiv', { einstellung: {} }, true)).toMatchObject({ art: 'probelauf', aktionen: ['scharf', 'pausieren'] });
    expect(werkstattZustand('aktiv', scharfStand(), true)).toMatchObject({ art: 'scharf', aktionen: ['pausieren'] });
    expect(werkstattZustand('probelauf', null, true).art).toBe('probelauf');
  });
  it('pausiert nennt den Grund (Budget, Notbremse) — Fortsetzen: scharf bleibt scharf, sonst Schatten', () => {
    expect(werkstattZustand('pausiert', scharfStand('budget'), true).satz).toMatch(/Monatsbudget/);
    expect(werkstattZustand('pausiert', scharfStand('notbremse'), true).satz).toMatch(/Notbremse/);
    expect(fortsetzenStatus(scharfStand())).toBe('aktiv');
    expect(fortsetzenStatus({ einstellung: {} })).toBe('probelauf');
    expect(werkstattZustand('archiviert', null, true).aktionen).toEqual([]);
  });
});

describe('Lauf-Ansicht: Marken je Knoten, der echte Weg, der Log-Baum (Punkt 29)', () => {
  const schritte: LaufSchritt[] = [
    { knoten: fk(3), status: 'erledigt', ab: '2026-10-22T08:00:00Z', bis: '2026-10-22T08:00:00Z', ausgang: 'weiter' },
    { knoten: fk(10), status: 'erledigt', ab: '2026-10-22T08:00:00Z', bis: '2026-10-22T09:30:00Z', ausgang: 'weiter', wirkung: [{ art: 'aufgabe', id: `${LAUF}-aaaaaaaaaaaaaaaa` }] },
    { knoten: fk(12), status: 'wartet', ab: '2026-10-22T09:30:00Z', wirkung: [{ art: 'vorschlag', id: 'v-1' }] },
  ];
  it('grün gelaufen, gelb wartet; „wartet auf dich“ pulsiert NUR, wenn die Wirkung bei der Person liegt — mit Frist', () => {
    const w = { knoten: fk(12), art: 'freigabe' as const, wirkung: 'v-1', bis: '2026-10-29T09:30:00Z' };
    const fremd = laufMarken({ schritte, status: 'wartet', wartet: w }, () => false);
    expect(fremd.get(fk(10))).toMatchObject({ stufe: 'gelaufen', puls: false });
    expect(fremd.get(fk(12))).toMatchObject({ stufe: 'wartet', puls: false, name: 'wartet auf Freigabe', frist: w.bis });
    const mir = laufMarken({ schritte, status: 'wartet', wartet: w }, id => id === 'v-1');
    expect(mir.get(fk(12))).toMatchObject({ stufe: 'wartet', puls: true, name: 'wartet auf dich' });
    // nicht erreicht = keine Marke (grau)
    expect(mir.has(fk(13))).toBe(false);
  });
  it('der Weg: aufeinanderfolgende Besuche als Kanten — die Kante der Lage liegt darauf (ohne Ausgang verglichen)', () => {
    const weg = laufWeg(schritte);
    expect([...weg]).toEqual([`${fk(3)}>${fk(10)}`, `${fk(10)}>${fk(12)}`]);
    expect(kanteAufWeg(weg, { von: fk(10), nach: fk(12) })).toBe(true);
    expect(kanteAufWeg(weg, { von: fk(12), nach: fk(13) })).toBe(false);
  });
  it('der Log-Baum: Schritte in Reihenfolge je Phase, Agenten-Schritt mit Modell und Tokens; Dauer als Wort', () => {
    const d = definition([schritt(10, 'Anrufen', 1), schritt(12, 'Einschätzen', 2, { form: 'agent', agent: { wer: { art: 'zoe' }, auftrag: 'x', modell: 'schnell', budgetCent: 30, gedaechtnis: { brain: false, akte: false }, werkzeuge: [], eingabe: [], ausgabe: [], warumKeineRegel: 'x' } })]);
    const log = laufLog([...schritte.slice(0, 2), { knoten: fk(12), status: 'erledigt', ab: '2026-10-22T09:30:00Z', bis: '2026-10-22T09:30:20Z', modell: 'claude-probe', token: { ein: 900, aus: 120 }, kostenCent: 2 }], d, '2026-10-22T10:00:00Z');
    expect(log).toHaveLength(1);
    expect(log[0].titel).toBe('Ablauf');
    expect(log[0].zeilen.map(z => [z.nr, z.titel])).toEqual([[1, 'Start'], [2, 'Anrufen'], [3, 'Einschätzen']]);
    expect(log[0].zeilen[1].dauer).toBe('1 h 30 min');
    expect(log[0].zeilen[2]).toMatchObject({ modell: 'claude-probe', token: { ein: 900, aus: 120 }, kostenCent: 2, dauer: '20 s' });
    expect(dauerText(500)).toBe('unter 1 s');
    expect(dauerText(3 * 86_400_000 + 4 * 3_600_000)).toBe('3 T 4 h');
  });
  it('Filter der Liste: offen umfasst wartend, angehalten und Fehler; beendet = fertig und abgebrochen', () => {
    const l = (['laeuft', 'wartet', 'angehalten', 'fehler', 'fertig', 'abgebrochen'] as const).map(status => ({ status }));
    expect(laufFiltern(l, 'offen').map(x => x.status)).toEqual(['laeuft', 'wartet', 'angehalten', 'fehler']);
    expect(laufFiltern(l, 'fertig').map(x => x.status)).toEqual(['fertig', 'abgebrochen']);
    expect(laufFiltern(l, 'fehler')).toHaveLength(1);
  });
});

describe('Scharf schalten: Kosten aufgeschlüsselt, Budget je Prozess', () => {
  it('Läufe × Agenten-Schritte × Modellstufe', () => {
    const z = kostenZeilen(30, [{ stufe: 'schnell', schritte: 2, centJeSchritt: 1 }, { stufe: 'stark', schritte: 1, centJeSchritt: 12 }]);
    expect(z[0]).toEqual({ text: '30 Läufe × 2 Agenten-Schritte × Stufe „schnell“ (0,01 € je Schritt)', centMonat: 60 });
    expect(z[1].centMonat).toBe(360);
  });
  it('Budget-Vorschlag: ohne Agenten 0; sonst das Anderthalbfache, ganze Euro, mindestens 1 €; Eingabe in Euro', () => {
    expect(budgetVorschlag(0, 0)).toBe(0);
    expect(budgetVorschlag(20, 1)).toBe(100);
    expect(budgetVorschlag(420, 3)).toBe(700);
    expect(euroZuCent('12,50')).toBe(1250);
    expect(euroZuCent('5 €')).toBe(500);
    expect(euroZuCent('1.000')).toBe(100000);
    expect(euroZuCent('abc')).toBeNull();
    expect(euroZuCent('')).toBe(0);
    expect(centZuEuro(1250)).toBe('12,50');
    expect(centZuEuro(700)).toBe('7');
  });
});

describe('Testfälle: grün = gleiche Folge, sonst was sich geändert hat', () => {
  const a = [{ knotenId: 'a', status: 'wuerde' as const }, { knotenId: 'b', status: 'freigabe' as const }, { knotenId: 'c', status: 'wuerde' as const }];
  it('gleich → grün; neu, weg, anders, Reihenfolge', () => {
    expect(testVergleich(a, a).ok).toBe(true);
    const v = testVergleich(a, [{ knotenId: 'a', status: 'wuerde' }, { knotenId: 'b', status: 'uebersprungen' }, { knotenId: 'd', status: 'wuerde' }]);
    expect(v).toMatchObject({ ok: false, neu: ['d'], weg: ['c'], anders: [{ knotenId: 'b', vorher: 'freigabe', nachher: 'uebersprungen' }], reihenfolge: false });
    expect(testUnterschiede(v, id => id.toUpperCase())).toEqual(['neu auf dem Weg: „D“', 'nicht mehr erreicht: „C“', '„B“: Freigabe → übersprungen']);
    expect(testVergleich(a, [a[1], a[0], a[2]]).reihenfolge).toBe(true);
  });
  it('Stand für den Veröffentlichen-Dialog; Namen nie aus Freitext', () => {
    expect(testStand(null, 0)).toBeNull();
    expect(testStand(null, 2)?.satz).toBe('2 Testfälle — noch nicht geprüft');
    expect(testStand([{ ok: true }, { ok: true }], 2)).toEqual({ satz: 'Testfälle: 2 von 2 grün', bedeutung: 'gut' });
    expect(testStand([{ ok: true }, { ok: false }], 2)?.bedeutung).toBe('achtung');
    expect(testfallName({ nr: 3, fall: 'beispiel' })).toBe('Testfall 3 · Beispiel-Fall');
    expect(testfallName({ nr: 1, fall: { art: 'deal', id: 'ch-1' } })).toBe('Testfall 1 · Deal');
  });
});

describe('Heute (Punkt 69): eine Tageszeile, nie eine Null', () => {
  it('ohne Lauf und ohne Wartendes keine Zeile; Einzahl und Mehrzahl', () => {
    expect(heuteSatz(null)).toBeNull();
    expect(heuteSatz({ gelaufen: 0, aufDich: 0 })).toBeNull();
    expect(heuteSatz({ gelaufen: 3, aufDich: 1 })).toBe('Prozesse heute: 3 gelaufen, 1 wartet auf dich');
    expect(heuteSatz({ gelaufen: 0, aufDich: 2 })).toBe('Prozesse heute: 2 warten auf dich');
    expect(heuteSatz({ gelaufen: 4, aufDich: 0 })).toBe('Prozesse heute: 4 gelaufen');
  });
});

describe('Probelauf mit echtem Fall: Suche über die schlanken Verweise', () => {
  const v = {
    kontakte: [{ id: 'c-1', name: 'Erika Beispiel', firma: 'Beispiel GmbH' }], firmen: [{ id: 'f-1', name: 'Beispiel GmbH' }],
    mandate: [{ id: 'm-1', titel: 'Begleitung', kunde: 'Beispiel GmbH', status: 'aktiv' }], deals: [{ id: 'ch-1', titel: 'Website-Relaunch', stufe: 'angebot', firma: 'Beispiel GmbH' }],
  };
  it('je Fall-Art die passenden Verweise; Lead = Firma oder Person; Event/Kampagne nur mit Beispiel', () => {
    expect(fallTreffer(v, 'deal', 'relaunch').map(t => t.id)).toEqual(['ch-1']);
    expect(fallTreffer(v, 'mandat', '').map(t => t.id)).toEqual(['m-1']);
    expect(fallTreffer(v, 'lead', 'beispiel').map(t => t.id)).toEqual(['f-1', 'c-1']);
    expect(fallTreffer(v, 'event', '')).toEqual([]);
    expect(fallName(v, { art: 'deal', id: 'ch-1' })).toBe('Website-Relaunch');
    expect(fallName(v, { art: 'deal', id: 'ch-weg' })).toBe('Deal');
    expect(fallName(null, 'beispiel')).toBe('Beispiel-Fall');
  });
});

describe('Adresse: Reiter der Werkstatt und ein geöffneter Lauf', () => {
  it('w und lauf nur mit Prozess; lauf nur im Reiter Läufe; Bauen ist die Vorgabe', () => {
    const p = 'pz-00000000-0000-4000-8000-000000000001';
    const url = prozesseLink({ p, ansicht: 'werkstatt', w: 'laeufe', lauf: LAUF });
    expect(url).toBe(`/os/prozesse?p=${p}&ansicht=werkstatt&w=laeufe&lauf=${LAUF}`);
    expect(prozesseAusAdresse(new URL(`http://x${url}`).searchParams)).toMatchObject({ p, w: 'laeufe', lauf: LAUF });
    expect(prozesseLink({ p, w: 'tests', lauf: LAUF })).toBe(`/os/prozesse?p=${p}&w=tests`);
    expect(prozesseLink({ p, w: 'bauen' })).toBe(`/os/prozesse?p=${p}`);
    expect(prozesseLink({ w: 'laeufe' })).toBe('/os/prozesse');
    expect(prozesseAusAdresse(new URLSearchParams(`p=${p}&w=laeufe&lauf=pl-falsch`))).not.toHaveProperty('lauf');
  });
});

describe('Feinschliff der Werkstatt (research/prozesse/FEINSCHLIFF_WERKSTATT.md)', () => {
  it('1 · Formauswahl: beim Anhängen stehen Aktionen und Entscheidungen vorn, Auslöser hinten; am Anfang die Auslöser zuerst', () => {
    const anhaengen = formauswahl(BAUSTEIN_KATALOG, { anhaengen: true });
    expect(anhaengen[0].form).not.toBe('ausloeser');
    const ersterAusloeser = anhaengen.findIndex(e => e.form === 'ausloeser');
    expect(anhaengen.slice(ersterAusloeser).every(e => e.form === 'ausloeser')).toBe(true);
    expect(formauswahl(BAUSTEIN_KATALOG, {})[0].form).toBe('ausloeser');
  });
  it('2 · Kamera zum neuen Knoten: nur so weit wie nötig, Zoom bleibt; schon sichtbar → dieselbe Kamera', () => {
    const k = { s: 1, x: 0, y: 0 };
    expect(kameraZu(k, { x: 100, y: 100, b: 184, h: 150 }, { b: 900, h: 600 })).toBe(k);
    const z = kameraZu(k, { x: 1200, y: 100, b: 184, h: 150 }, { b: 900, h: 600 });
    expect(z.s).toBe(1);
    expect(1200 + 184 + z.x).toBeLessThanOrEqual(900 - 48);
    expect(1200 + z.x).toBeGreaterThanOrEqual(48);
  });
  it('3 · Ausgänge der Freigabe: die drei „+“ berühren sich nicht, kein Name liegt über einem „+“', () => {
    const as = anschluesse({ form: 'freigabe' }).filter(a => a.art !== 'ein');
    expect(as).toHaveLength(3);
    const m = as.map(a => ausgangMarke(a, { rechtsAnzahl: 3, mitPlus: true }));
    for (let i = 1; i < m.length; i++) expect(m[i].plus[1] - m[i - 1].plus[1]).toBeGreaterThanOrEqual(m[i].r * 2);
    const textBox = (t: [number, number], n: number) => ({ x0: t[0], x1: t[0] + n * 12 * 0.56, y0: t[1] - 10, y1: t[1] + 2 });
    for (const x of m) for (const y of m) {
      const tb = textBox(x.text, 'freigegeben'.length);
      const pb = { x0: y.plus[0] - y.r, x1: y.plus[0] + y.r, y0: y.plus[1] - y.r, y1: y.plus[1] + y.r };
      const ueber = tb.x0 < pb.x1 && tb.x1 > pb.x0 && tb.y0 < pb.y1 && tb.y1 > pb.y0;
      expect(ueber).toBe(false);
    }
    // Der Name steht rechts neben dem „+“ (auf Höhe des Anschlusses), ohne „+“ dicht am Anschluss.
    expect(m[0].text[0]).toBeGreaterThan(m[0].plus[0]);
    expect(ausgangMarke(as[0], { rechtsAnzahl: 3, mitPlus: false }).text[0]).toBe(as[0].x + 12);
  });
  it('4 · Alles zeigen: auf den Inhalt eingepasst (größer als auf die ganze Box), höchstens 100 %', () => {
    const d = definition([schritt(10, 'Anrufen', 1), schritt(11, 'Passt es?', 2, { form: 'entscheidung' }), schritt(12, 'Fertig', 3, { form: 'ende' })]);
    const l = werkstattLage(d);
    const buehne = { b: 900, h: 560 };
    const inhalt = einpassKamera(inhaltBox(l), buehne);
    const ganz = einpassKamera(l.box, buehne);
    expect(inhalt.s).toBeGreaterThanOrEqual(ganz.s);
    expect(inhalt.s).toBeLessThanOrEqual(1);
    expect(einpassKamera({ x: 0, y: 0, b: 100, h: 100 }, buehne).s).toBe(1);
    expect(knotenMass({ form: 'schritt' }).koerper.b * inhalt.s).toBeGreaterThan(60);
  });
  it('5 · Bahn beim Anhängen: ein Mail-Entwurf hinter einem Menschen-Schritt bleibt in dessen Bahn; Regeln bleiben im System', () => {
    const aufgabe = { form: 'schritt' as const, katalog: { id: 'aufgabe.anlegen', werte: { wer: 'konto-a' } } };
    expect(bahnBeimAnhaengen({ form: 'nachricht', katalog: { id: 'inbox.mail-entwurf' } }, aufgabe)).toBe('person:konto-a');
    expect(bahnBeimAnhaengen({ form: 'nachricht', katalog: { id: 'inbox.mail-entwurf' } }, { form: 'schritt', katalog: { id: 'aufgabe.anlegen' } })).toBe('mensch');
    expect(bahnBeimAnhaengen({ form: 'schritt', katalog: { id: 'crm.abfragen' } }, aufgabe)).toBeNull();
    expect(bahnBeimAnhaengen({ form: 'nachricht', katalog: { id: 'inbox.mail-entwurf' } }, { form: 'schritt', katalog: { id: 'crm.abfragen' } })).toBeNull();
    expect(bahnBeimAnhaengen({ form: 'agent' }, aufgabe)).toBeNull();
  });
});

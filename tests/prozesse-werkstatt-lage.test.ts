// ─── Prozesse · Werkstatt — Lage, Bahnen, Anschlüsse, Fäden, Ordnen, Hilfslinien, Landkarte, Masken (Etappe B2, 21.10.; Punkte 18, 19, 22, 25) ───────────
import { describe, it, expect } from 'vitest';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { kantenVon, phasen } from '@/lib/prozesse/fluss';
import { katalogEintrag, BAUSTEIN_KATALOG } from '@/lib/prozesse/baustein-katalog';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { schlossSetzen } from '@/lib/prozesse/schloss';
import { anlegen, type Fassung, type Ergebnis } from '@/lib/prozesse/werkstatt-aktionen';
import { neuerKnoten, maskeWerte, maskeAnwenden, formauswahl } from '@/lib/prozesse/werkstatt-maske';
import {
  werkstattLage, anschluesse, bahnSchluessel, bahnenOrdnen, inBahn, ordnen, lagenFesthalten, hilfslinien, ortBei, startKamera, knotenMass, unterknotenVon,
  fadenWeg, zuKennung, WS, WERKSTATT_LESBAR,
} from '@/lib/prozesse/werkstatt-lage';
import { prozessAusWerkstatt } from '@/lib/prozesse/werkstatt-landkarte';
import type { ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const basis = (): ProzessDefinition => neuerProzess({ id: 'pz-00000000-0000-4000-8000-000000000001', titel: 'Lead nachfassen', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-21T10:00:00Z', kennung }).entwurf;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const knoten = (id: string, titel?: string) => neuerKnoten(katalogEintrag(id)!, kennung(), titel);
const def = (d: ProzessDefinition, f: Fassung): ProzessDefinition => ({ ...d, knoten: f.knoten, zettel: f.zettel });
const team = [{ id: 'konto-a', name: 'Person A' }, { id: 'konto-b', name: 'Person B' }];

/** Start → Aufgabe (Person A) → Entscheidung → ja: Mail-Entwurf · nein: Erinnerung zurück; dahinter ein Agent. */
function beispiel() {
  const d = basis();
  const st = d.knoten.find(k => k.form === 'ausloeser')!;
  const a = { ...knoten('aufgabe.anlegen', 'Lead prüfen'), katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Lead prüfen', wer: 'konto-a' } } };
  const r = knoten('entscheidung.mensch', 'Passt der Lead?');
  const m = knoten('inbox.mail-entwurf', 'Angebot senden');
  const e = { ...knoten('erinnerung.runde', 'Nachfassen erinnern'), zweige: { ja: '' } };
  const g = knoten('agent.zoe', 'Antwort einordnen');
  let f: Fassung = { knoten: d.knoten };
  f = gut(anlegen(f, a, { nach: st.id }));
  f = gut(anlegen(f, r, { nach: a.id }));
  f = gut(anlegen(f, m, { nach: r.id }));
  f = gut(anlegen(f, g, { nach: m.id }));
  f = gut(anlegen(f, { ...e, zweige: undefined }, { nach: r.id, ausgang: 'nein' }));
  f = { ...f, knoten: f.knoten.map(k => (k.id === e.id ? { ...k, zweige: { ja: r.id } } : k)) };
  return { d: def(d, f), st, a, r, m, e, g };
}

describe('Bahnen (Punkt 25)', () => {
  it('Kunde außen oben, Menschen je Person aus dem Team, System, Agenten unten — nur Bahnen, die etwas tragen', () => {
    const { d } = beispiel();
    const l = werkstattLage(d, { team });
    expect(l.bahnen.map(b => b.schluessel)).toEqual(['person:konto-a', 'mensch', 'system', 'agent']);
    expect(l.bahnen[0].titel).toBe('Person A');
    expect(bahnenOrdnen(['agent', 'kunde', 'system', 'person:konto-b', 'person:konto-a'], team)).toEqual(['kunde', 'person:konto-a', 'person:konto-b', 'system', 'agent']);
  });
  it('in eine Bahn ziehen: Person setzt „wer“, Agenten bleiben bei den Agenten, die Kunden-Bahn nur für Nachrichten', () => {
    const { a, g, m } = beispiel();
    expect(personWer(inBahn(a, 'person:konto-b'))).toBe('konto-b');
    expect(bahnSchluessel(inBahn(a, 'system')!)).toBe('system');
    expect(inBahn(g, 'system')).toBeNull();
    expect(inBahn(a, 'kunde')).toBeNull();
    expect(bahnSchluessel(inBahn(m, 'kunde')!)).toBe('kunde');
    expect(inBahn(m, 'person:konto-a')).toBeNull(); // die Maske des Mail-Entwurfs hat kein „wer“
  });
});
const personWer = (k: ReturnType<typeof inBahn>) => k?.katalog?.werte?.wer;

describe('Knoten, Anschlüsse, Agent (Punkte 19, 22)', () => {
  it('die Raute hat vier feste Andockpunkte: links Eingang, rechts ja, unten nein, oben Fehler', () => {
    const a = anschluesse({ form: 'entscheidung' });
    const c = knotenMass({ form: 'entscheidung' }).koerper;
    expect(a.find(x => x.art === 'ein')).toMatchObject({ x: c.x, richtung: 'links' });
    expect(a.find(x => x.art === 'ja')).toMatchObject({ x: c.x + c.b, richtung: 'rechts' });
    expect(a.find(x => x.art === 'nein')).toMatchObject({ y: c.y + c.h, richtung: 'unten' });
    expect(a.find(x => x.art === 'fehler')).toMatchObject({ y: c.y, richtung: 'oben' });
    expect(anschluesse({ form: 'ausloeser' }).some(x => x.art === 'ein')).toBe(false);
    expect(anschluesse({ form: 'ende' }).map(x => x.art)).toEqual(['ein']);
    expect(anschluesse({ form: 'freigabe' }).map(x => x.art)).toEqual(['ein', 'ja', 'nein', 'abgelaufen']);
  });
  it('der Agent ist breiter und hat drei Andockpunkte mit den angedockten Teilen; Werkzeuge der Klassen außen/Geld/Löschen tragen ein Schloss', () => {
    const m = knotenMass({ form: 'agent' });
    expect(m.koerper.b).toBe(WS.agent.b);
    const leer = unterknotenVon({ id: 'x' }, m.koerper);
    expect(leer.andocks.map(x => x.titel)).toEqual(['Modell', 'Gedächtnis', 'Werkzeuge']);
    expect(leer.teile.every(t => t.leer)).toBe(true);
    const mit = unterknotenVon({ id: 'x', agent: { wer: { art: 'zoe' }, auftrag: 'x', modell: 'schnell', budgetCent: 5, gedaechtnis: { brain: true, akte: true }, werkzeuge: ['create_task', 'crm_suche'], eingabe: [], ausgabe: [], warumKeineRegel: '' } }, m.koerper);
    expect(mit.teile.filter(t => t.art === 'gedaechtnis').map(t => t.titel)).toEqual(['Brain', 'Akte']);
    expect(mit.teile.find(t => t.art === 'modell')?.titel).toBe('schnell');
    expect(mit.teile.filter(t => t.art === 'werkzeuge')).toHaveLength(2);
  });
});

describe('Lage, Fäden, Ordnen (Punkt 18)', () => {
  it('Leserichtung links → rechts, Abzweig in einer eigenen Reihe bzw. Bahn, jeder Faden aus kantenVon hat einen Weg', () => {
    const { d, st, a, r, m, e } = beispiel();
    const l = werkstattLage(d, { team });
    const x = (id: string) => l.knoten.get(id)!.x;
    expect(x(st.id)).toBeLessThan(x(a.id));
    expect(x(a.id)).toBeLessThan(x(r.id));
    expect(x(r.id)).toBeLessThan(x(m.id));
    expect(x(e.id)).toBeGreaterThan(x(r.id));
    const ziele = kantenVon(d).filter(k => k.nach).length;
    expect(l.kanten.length).toBeGreaterThan(0);
    expect(l.kanten.length).toBeLessThanOrEqual(ziele);
    // Die Schleife Erinnerung → Entscheidung läuft außen herum und heißt „zurück zu …“.
    const zurueck = l.kanten.find(k => k.von === e.id && k.nach === r.id)!;
    expect(zurueck.zurueck).toBe(true);
    expect(zurueck.text).toBe('zurück zu „Passt der Lead?“');
    // Rauten-Ausgänge sind benannt.
    expect(l.kanten.find(k => k.von === r.id && k.ausgang === 'nein')?.text).toBe('nein');
  });
  it('ein Faden beginnt am Ausgang und endet am Eingang; rückwärts läuft er unter den Knoten', () => {
    const w = fadenWeg([100, 50], 'rechts', [300, 80], 200);
    expect(w.punkte[0]).toEqual([100, 50]);
    expect(w.punkte.at(-1)).toEqual([300, 80]);
    expect(w.zurueck).toBe(false);
    const z = fadenWeg([300, 50], 'rechts', [100, 50], 200);
    expect(z.zurueck).toBe(true);
    expect(Math.max(...z.punkte.map(p => p[1]))).toBeGreaterThan(200);
  });
  it('gespeicherte Lage gilt (x relativ zum Rahmen, y relativ zur Bahn); „Ordnen“ vergisst alle Lagen; festhalten legt die aktuelle Lage fest, ohne dass etwas springt', () => {
    const { d, a } = beispiel();
    const l0 = werkstattLage(d, { team });
    const fest = lagenFesthalten(d, l0);
    expect(fest.knoten.filter(k => phasen(fest).some(p => p.id === k.elternId)).every(k => k.pos)).toBe(true);
    const l1 = werkstattLage(fest, { team });
    for (const [id, k] of l0.knoten) { expect(l1.knoten.get(id)!.x, id).toBeCloseTo(k.x, 0); expect(l1.knoten.get(id)!.y, id).toBeCloseTo(k.y, 0); }
    const verschoben = { ...fest, knoten: fest.knoten.map(k => (k.id === a.id ? { ...k, pos: { x: k.pos!.x + 400, y: k.pos!.y } } : k)) };
    expect(werkstattLage(verschoben, { team }).knoten.get(a.id)!.x).toBeCloseTo(l0.knoten.get(a.id)!.x + 400, 0);
    expect(ordnen(verschoben).knoten.some(k => k.pos)).toBe(false);
    expect(ordnen(d)).toBe(d);
  });
  it('zugeklappte Phase (Teilprozess als Kachel): eine Kachel statt der Schritte, Fäden enden an ihr', () => {
    const { d } = beispiel();
    const p = phasen(d)[0];
    const l = werkstattLage(d, { team, zu: new Set([p.id]) });
    expect([...l.knoten.keys()]).toEqual([zuKennung(p.id)]);
    expect(l.knoten.get(zuKennung(p.id))!.zu?.schritte).toBeGreaterThan(3);
    expect(l.kanten).toEqual([]);
  });
  it('wohin ein Punkt fällt (Rahmen + Bahn) und die Hilfslinien beim Ziehen', () => {
    const { d } = beispiel();
    const l = werkstattLage(d, { team });
    const b = l.bahnen[1], r = l.rahmen[0];
    expect(ortBei(l, r.x + 10, b.y + 5)).toMatchObject({ phaseId: r.id, bahn: b.schluessel });
    const h = hilfslinien({ x: 103, y: 500, b: 100, h: 100 }, [{ x: 100, y: 0, b: 100, h: 100 }], { raster: 20 });
    expect(h.x).toBe(100);
    expect(h.y).toBe(500);
    expect(h.linien).toHaveLength(1);
    const r2 = hilfslinien({ x: 133, y: 517, b: 100, h: 100 }, [], { raster: 20 });
    expect([r2.x, r2.y, r2.linien.length]).toEqual([140, 520, 0]);
  });
  it('Kamera beim Öffnen: alles, wenn es lesbar passt — sonst lesbar (Namen ≥ 12 px) oben links am Anfang', () => {
    const k = startKamera({ x: 0, y: 0, b: 800, h: 400 }, { b: 1000, h: 600 });
    expect(k.s).toBe(1);
    const gross = startKamera({ x: 0, y: 0, b: 6000, h: 900 }, { b: 1000, h: 600 });
    expect(gross.s).toBe(WERKSTATT_LESBAR);
    expect(15 * gross.s).toBeGreaterThanOrEqual(12);
  });
});

describe('Masken (Punkt 22: Einstellungs-Maske je Baustein)', () => {
  it('ein neuer Knoten trägt die Vorgaben seiner Maske; Werte hin und zurück (eigenes Feld wie Warten, Agent, Auslöser)', () => {
    const w = knoten('warten.dauer');
    expect(w.warten).toEqual({ art: 'dauer', tage: 3 });
    const e = katalogEintrag('warten.dauer')!;
    expect(maskeWerte(w, e)).toEqual({ tage: 3 });
    expect(maskeAnwenden(w, e, { tage: 5, stunden: 2 }).warten).toEqual({ art: 'dauer', tage: 5, stunden: 2 });
    // Ohne Rhythmus (Pflicht, keine Vorgabe) noch kein Auslöser — die Prüfung sagt „offen“, gespeichert wird trotzdem.
    const z = knoten('ausloeser.zeitplan');
    expect(z.ausloeser).toBeUndefined();
    expect(maskeAnwenden(z, katalogEintrag('ausloeser.zeitplan')!, { rhythmus: 'werktags', uhrzeit: '08:00' }).ausloeser).toEqual({ art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' });
  });
  it('Agent: wer aus dem Baustein, Gedächtnis, Werkzeuge, Modell-Wahl über die Liste der Instanz', () => {
    const e = katalogEintrag('agent.zoe')!;
    const k = maskeAnwenden(knoten('agent.zoe'), e, { auftrag: 'Antwort einordnen', modell: 'schnell', budgetCent: 5, brain: true, akte: false, werkzeuge: ['crm_suche'], warumKeineRegel: 'Freie Antworten lassen sich nicht über Felder prüfen.', modellWahl: 'anthropic:claude-x' },
      { modelle: [{ anbieter: 'anthropic', modell: 'claude-x', stufe: 'schnell', schluessel: 'anthropic:claude-x', anbieterName: 'Anthropic', name: 'X', waehlbar: true }] });
    expect(k.agent).toMatchObject({ wer: { art: 'zoe' }, auftrag: 'Antwort einordnen', modell: 'schnell', budgetCent: 5, gedaechtnis: { brain: true, akte: false }, werkzeuge: ['crm_suche'], modellWahl: { anbieter: 'anthropic', modell: 'claude-x', stufe: 'schnell' } });
    expect(maskeWerte(k, e)).toMatchObject({ auftrag: 'Antwort einordnen', modellWahl: 'anthropic:claude-x', brain: true, akte: false });
    const r = maskeAnwenden(knoten('agent.research'), katalogEintrag('agent.research')!, { auftrag: 'Firma anreichern', vorschlagFelder: ['firma.branche'] });
    expect(r.agent).toMatchObject({ wer: { art: 'fach', agentId: 'research' }, ergebnis: 'vorschlag', vorschlagFelder: ['firma.branche'] });
    // Head noch nicht gewählt: kein Agenten-Schritt, die Werte warten (nichts geht verloren) — der Entwurf bleibt speicherbar.
    const h = maskeAnwenden(knoten('agent.head'), katalogEintrag('agent.head')!, { auftrag: 'Lead einschätzen', budgetCent: 10 });
    expect(h.agent).toBeUndefined();
    expect(maskeWerte(h, katalogEintrag('agent.head')!)).toMatchObject({ auftrag: 'Lead einschätzen', budgetCent: 10 });
  });
  it('Masken ohne eigenes Feld schreiben nach katalog.werte (nur Felder der Maske, Leeres fällt weg)', () => {
    const e = katalogEintrag('aufgabe.anlegen')!;
    const k = maskeAnwenden(knoten('aufgabe.anlegen'), e, { titel: 'Angebot vorbereiten', wer: 'konto-a', fremd: 'weg', beschreibung: '' });
    expect(k.katalog).toEqual({ id: 'aufgabe.anlegen', werte: { titel: 'Angebot vorbereiten', wer: 'konto-a' } });
  });
  it('jeder Baustein des Katalogs lässt sich anlegen und als Entwurf speichern (keine Fehler — höchstens offen)', () => {
    for (const e of BAUSTEIN_KATALOG) {
      const d = basis();
      const st = d.knoten.find(k => k.form === 'ausloeser')!;
      const k = neuerKnoten(e, kennung());
      const f = anlegen({ knoten: d.knoten }, k, { nach: st.id });
      expect(f.ok, e.id).toBe(true);
      if (!f.ok) continue;
      const mit = schlossSetzen(def(d, f.fassung)).definition;
      const fehler = definitionPruefen(mit).filter(b => b.stufe === 'fehler');
      expect(fehler, e.id).toEqual([]);
    }
  });
  it('Formauswahl: Suche, die Form zuerst, Auslöser nur am Anfang', () => {
    const l = formauswahl(BAUSTEIN_KATALOG, { suche: 'mail' });
    expect(l.some(e => e.id === 'inbox.mail-entwurf')).toBe(true);
    expect(formauswahl(BAUSTEIN_KATALOG, { form: 'warten' })[0].form).toBe('warten');
    expect(formauswahl(BAUSTEIN_KATALOG, { ohneAusloeser: true }).some(e => e.form === 'ausloeser')).toBe(false);
  });
});

describe('Landkarte: eigener Prozess als Kachel in seinem Bereich', () => {
  const eintrag = (d: ProzessDefinition, o: Partial<ProzessEintrag> = {}): ProzessEintrag => ({ id: d.id, entwurf: d, versionen: [], status: 'entwurf', angelegtAm: '', angelegtVon: '', entwurfAm: '', entwurfVon: '', ...o });
  it('Bereich Sales → Kern-Stufe Sales; Führung → Band Führung; Link in die Werkstatt; ohne Namen', () => {
    const { d } = beispiel();
    const p = prozessAusWerkstatt(eintrag(d))!;
    expect(p).toMatchObject({ quelle: 'werkstatt', band: 'kern', stufe: 'sales' });
    expect(p.link?.href).toBe(`/os/prozesse?p=${d.id}&ansicht=werkstatt`);
    expect(p.steckbrief.ausloeser).toBe('von Hand');
    expect(p.phasen[0].schritte.some(s => s.form === 'entscheidung' && s.nein)).toBe(true);
    expect(prozessAusWerkstatt(eintrag({ ...d, bereich: 'fuehrung' }))).toMatchObject({ band: 'fuehrung' });
    expect(prozessAusWerkstatt(eintrag(d, { status: 'archiviert' }))).toBeNull();
    expect(JSON.stringify(p)).not.toMatch(/konto-a|Person A/);
  });
});

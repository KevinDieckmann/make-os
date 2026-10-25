// ─── Kern-Bau-Test 24.10. — Werkstatt: Werte nur an ihren Knoten, „+ erster Schritt“, Titel folgt Name, Start am Mandat, Genus (rein) ──────────────────
// Befunde: „Pipeline aufbauen“ wurde zu „AufgabeAbschlussbericht übergebenPipeline …“; leere Phase ohne „+“; neue Phase öffnete ein Schritt-Panel; Name und Titel
// getrennt zu pflegen; Start des Produkt-Prozesses hieß „von Hand“; „Echter Mandat“.
import { describe, it, expect } from 'vitest';
import type { ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import { zielPuffer, TIPP_PAUSE_MS } from '@/lib/prozesse/eingabe-puffer';
import { knotenAendern, anlegen, umbenennen, type Fassung } from '@/lib/prozesse/werkstatt-aktionen';
import { titelSetzen, nameSetzen, neuerKnoten, maskeWerte, knotenUnterzeile, AM_MANDAT_KURZ, amMandatSatz } from '@/lib/prozesse/werkstatt-maske';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { schritteDer, phasen } from '@/lib/prozesse/fluss';
import { inhaltBox, werkstattLage, WS } from '@/lib/prozesse/werkstatt-lage';
import { echterFall } from '@/lib/prozesse/laeufe-ansicht';
import { fk } from './fixtures/prozess-bau';

type K = ProzessKnoten<ProzessForm>;
const AUFGABE = katalogEintrag('aufgabe.anlegen')!;
const titelVon = (f: Fassung, id: string) => String(maskeWerte(f.knoten.find(k => k.id === id)!, AUFGABE).titel ?? '');
const uhr = () => {
  let jetzt = 0; const plan: { t: number; f: () => void; h: number }[] = []; let n = 0;
  return {
    setze: (f: () => void, ms: number) => { const h = ++n; plan.push({ t: jetzt + ms, f, h }); return h; },
    loesche: (h: unknown) => { const i = plan.findIndex(x => x.h === h); if (i >= 0) plan.splice(i, 1); },
    weiter: (ms: number) => { jetzt += ms; for (const x of plan.filter(y => y.t <= jetzt)) { plan.splice(plan.indexOf(x), 1); x.f(); } },
  };
};

/** Zwei Aufgaben in einer Phase: A „Pipeline aufbauen“, B „Abschlussbericht übergeben“. */
function fassung(): Fassung {
  const a = { ...titelSetzen({ ...neuerKnoten(AUFGABE, fk(10)), titel: 'Pipeline aufbauen' }, AUFGABE, 'Pipeline für {{firma.name}} aufbauen'), elternId: fk(2), rang: 1 };
  const b = { ...titelSetzen({ ...neuerKnoten(AUFGABE, fk(11)), titel: 'Abschlussbericht übergeben' }, AUFGABE, 'Abschlussbericht an {{firma.name}} übergeben'), elternId: fk(2), rang: 2 };
  return { knoten: [{ id: fk(1), titel: 'Probe', rang: 1 }, { id: fk(2), elternId: fk(1), titel: 'Umsetzung', rang: 1 }, { id: fk(3), elternId: fk(1), titel: 'Abschluss', rang: 2 }, a, b] as K[] };
}

describe('Werte nur an ihren Knoten (Wechsel der Auswahl in der Entprellzeit)', () => {
  it('Titel von A tippen, vor Ablauf der Pause B wählen → nur A ändert sich; B bekommt nie den Text von A', () => {
    let f = fassung();
    const u = uhr();
    const vorherB = JSON.stringify(f.knoten.find(k => k.id === fk(11)));
    // Das Panel schreibt über `knotenAendern` (Kennung fest) — wie onKnotenMit in der Werkstatt.
    const p = zielPuffer({
      ziel: `${fk(10)}|titel`, anfang: titelVon(f, fk(10)), uhr: u,
      uebernehmen: (ziel, v) => { const [id] = ziel.split('|'); const r = knotenAendern(f, id, k => titelSetzen(k, AUFGABE, v)); if (r.ok) f = r.fassung; },
    });
    p.tippe('Pipeline für {{firma.name}} gemeinsam aufbauen');
    u.weiter(TIPP_PAUSE_MS - 100);
    // Auswahl wechselt: das Feld gehört jetzt B — der offene Wert geht vorher an A.
    expect(p.wechsel(`${fk(11)}|titel`, titelVon(f, fk(11)))).toBe('Abschlussbericht an {{firma.name}} übergeben');
    u.weiter(TIPP_PAUSE_MS * 3);
    expect(titelVon(f, fk(10))).toBe('Pipeline für {{firma.name}} gemeinsam aufbauen');
    expect(JSON.stringify(f.knoten.find(k => k.id === fk(11)))).toBe(vorherB);
    // Weiter getippt gehört B — auch beim Schließen (pagehide) nur B.
    p.tippe('Bericht an {{firma.name}}');
    p.jetzt();
    expect(titelVon(f, fk(11))).toBe('Bericht an {{firma.name}}');
    expect(titelVon(f, fk(10))).toBe('Pipeline für {{firma.name}} gemeinsam aufbauen');
  });
  it('läuft die Pause erst NACH dem Wechsel ab, geht der Wert trotzdem an sein Ziel (die Uhr trägt das Ziel)', () => {
    const raus: [string, string][] = [];
    const u = uhr();
    const p = zielPuffer({ ziel: 'A|name', anfang: 'a', uebernehmen: (z, v) => raus.push([z, v]), uhr: u });
    p.tippe('ab');
    p.wechsel('B|name', 'b');
    u.weiter(TIPP_PAUSE_MS * 2);
    expect(raus).toEqual([['A|name', 'ab']]);
  });
  it('knotenAendern ändert nur das eine Feld am AKTUELLEN Stand — ein inzwischen geänderter Name bleibt (kein altes Abbild des ganzen Knotens)', () => {
    let f = fassung();
    const r1 = umbenennen(f, fk(10), 'Pipeline bauen');
    if (r1.ok) f = r1.fassung;
    const r2 = knotenAendern(f, fk(10), k => ({ ...k, kundeSichtbar: true }));
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.fassung.knoten.find(k => k.id === fk(10))).toMatchObject({ titel: 'Pipeline bauen', kundeSichtbar: true, elternId: fk(2), rang: 1 });
    expect(knotenAendern(f, 'fk-gibt-es-nicht', k => k).ok).toBe(false);
  });
});

describe('Name und Titel einer Aufgabe gehören zusammen', () => {
  it('der Titel folgt dem Namen, solange er leer ist bzw. dem bisherigen Namen gleicht — selbst geändert bleibt er', () => {
    const neu = neuerKnoten(AUFGABE, fk(20));
    expect(neu.titel).toBe('Aufgabe anlegen');
    const a = nameSetzen(neu, AUFGABE, 'Pipeline aufbauen');
    expect(maskeWerte(a, AUFGABE).titel).toBe('Pipeline aufbauen');
    const b = nameSetzen(a, AUFGABE, 'Pipeline gemeinsam aufbauen');
    expect(maskeWerte(b, AUFGABE).titel).toBe('Pipeline gemeinsam aufbauen');
    const eigen = titelSetzen(b, AUFGABE, 'Pipeline für {{firma.name}} aufbauen');
    const c = nameSetzen(eigen, AUFGABE, 'Pipeline bauen');
    expect(c.titel).toBe('Pipeline bauen');
    expect(maskeWerte(c, AUFGABE).titel).toBe('Pipeline für {{firma.name}} aufbauen');
  });
  it('umgekehrt: der Name folgt dem Titel, solange er die Vorgabe des Bausteins ist — nie mit Platzhaltern', () => {
    const neu = neuerKnoten(AUFGABE, fk(21));
    expect(titelSetzen(neu, AUFGABE, 'Kick-off-Termin vereinbaren').titel).toBe('Kick-off-Termin vereinbaren');
    expect(titelSetzen(neu, AUFGABE, 'Kick-off mit {{firma.name}}').titel).toBe('Aufgabe anlegen');
    const benannt = { ...neu, titel: 'Mein Name' };
    expect(titelSetzen(benannt, AUFGABE, 'Etwas anderes').titel).toBe('Mein Name');
  });
  it('auch das Umbenennen auf der Fläche nimmt den Titel mit (umbenennen + nameSetzen)', () => {
    const f: Fassung = { knoten: [{ id: fk(1), titel: 'P', rang: 1 }, { id: fk(2), elternId: fk(1), titel: 'Ph', rang: 1 }, { ...neuerKnoten(AUFGABE, fk(22)), elternId: fk(2), rang: 1 }] as K[] };
    const r = umbenennen(f, fk(22), 'Angebot nachfassen', (k, t) => nameSetzen(k, AUFGABE, t));
    expect(r.ok).toBe(true);
    if (r.ok) expect(titelVon(r.fassung, fk(22))).toBe('Angebot nachfassen');
  });
});

describe('„+ erster Schritt“ in einer leeren Phase', () => {
  it('legt den Schritt IN diese Phase (nicht in die seines Vorgängers) und hängt ihn hinter den letzten Schritt davor', () => {
    const f = fassung();
    expect(schritteDer(f, fk(3))).toEqual([]);
    const r = anlegen(f, neuerKnoten(AUFGABE, fk(30)), { nach: null, phaseId: fk(3) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(schritteDer(r.fassung, fk(3)).map(s => s.id)).toEqual([fk(30)]);
    expect(schritteDer(r.fassung, fk(2)).map(s => s.id)).toEqual([fk(10), fk(11)]);
  });
  it('„Alles zeigen“ fasst eine leere Phase ein (Kopf + Platz für das „+“), ohne die leeren Bahnränder', () => {
    const f = fassung();
    const d = { id: 'pz-x', art: 'paket' as const, titel: 'P', knoten: f.knoten, uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: '', geaendertVon: '' };
    const l = werkstattLage(d);
    const leer = l.rahmen.find(r => r.id === fk(3))!;
    expect(phasen(d).map(p => p.id)).toEqual([fk(2), fk(3)]);
    const box = inhaltBox(l);
    expect(box.x + box.b).toBeGreaterThanOrEqual(leer.x + leer.b);
    expect(box.y + box.h).toBeLessThanOrEqual(Math.max(...[...l.knoten.values()].map(k => k.y + k.h), WS.rahmenKopf + 120) + 40);
    // Ohne Rahmen (Teilauswahl) wie bisher.
    expect(inhaltBox({ knoten: l.knoten, box: l.box }).x + inhaltBox({ knoten: l.knoten, box: l.box }).b).toBeLessThan(leer.x + leer.b);
  });
});

describe('Start eines Produkt-Prozesses und Genus', () => {
  it('Kurzzeile und Satz sagen „am Mandat“ statt „von Hand“ — ohne Produkt bleibt es „von Hand“', () => {
    const start = { id: fk(3), elternId: fk(2), titel: 'Start', rang: 0, form: 'ausloeser' as const, ausloeser: { art: 'hand' as const }, katalog: { id: 'ausloeser.hand' } };
    expect(knotenUnterzeile(start, { amMandat: true })).toBe(AM_MANDAT_KURZ);
    expect(knotenUnterzeile(start)).not.toBe(AM_MANDAT_KURZ);
    expect(amMandatSatz(['Vertriebssprint'])).toContain('ein neues Mandat des Produkts „Vertriebssprint“');
    // Ein Ereignis-Auslöser bleibt, was er ist.
    expect(knotenUnterzeile({ ...start, ausloeser: { art: 'ereignis', ereignis: 'mandat-angelegt' } as never }, { amMandat: true })).not.toBe(AM_MANDAT_KURZ);
  });
  it('Probelauf-Schalter: „Echtes Mandat“, „Echter Deal“, „Echte Firma“', () => {
    expect(echterFall('mandat')).toBe('Echtes Mandat');
    expect(echterFall('deal')).toBe('Echter Deal');
    expect(echterFall('firma')).toBe('Echte Firma');
    expect(echterFall('event')).toBe('Echtes Event');
  });
});

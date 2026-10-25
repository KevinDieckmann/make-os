// ─── Prozesse · Werkstatt — Runde 4 (25.10., Befunde aus dem dritten Bau-Test im Demo) ──────────────────────────────────────────────────────────────────────
// Je Befund ein Wächter: (1) ⌘V: der Titel einer Kopie folgt ihrem Namen (auch nach dem Umbenennen), solange er am Original dem Namen folgte;
// (2) das Ausgang-Menü nennt jedes Ziel genau einmal, das wirksame ist gewählt, Optionen beginnen mit dem Namen — über alle Vorlagen;
// (3) eine angehängte Kopie liegt in der Spalte hinter ihrem Ziel (der Faden läuft vorwärts); (4) die Kamera rechnet im freien Feld ohne Leiste und Panel;
// (5) Befunde nennen den Namen des Schritts; (6) die Schleife belegt die einzige passende Liste vor; (7) „Echtes Mandat“ zeigt Produkt bzw. Stufe/Status;
// (8)–(10) Probelauf-Hinweis, Panel-Scroll, Handy.
// Erfundene Werte, kein Netz, kein Modell.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { neuerProzess } from '@/lib/prozesse/bestand';
import { anlegen, kopieren, einfuegen, ausgangsWahl, ausgangSetzen, ausgangWahlAus, hauptZiel, mehrfachZiele, AUSGANG_NAECHSTER, AUSGANG_ENDE, type Ergebnis, type Fassung } from '@/lib/prozesse/werkstatt-aktionen';
import { ausgaengeVon, einfuegeLagen, werkstattLage, kameraSicht, boxUm, WERKSTATT_UEBERSICHT_MIN, type Box } from '@/lib/prozesse/werkstatt-lage';
import { freiesFeld } from '@/lib/einpassen';
import { ausgangsZiele } from '@/lib/prozesse/fluss';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { ALLE_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { MUSTER_PAKETE } from '@/lib/fulfillment/muster';
import { paketAlsDefinition } from '@/lib/prozesse/fulfillment-modus';
import { katalogEintrag, maskeSaeubern } from '@/lib/prozesse/baustein-katalog';
import { maskeBefunde, schleifeVorbelegen, schleifenListen } from '@/lib/prozesse/werkstatt-maske';
import { schleifenElementFall, teilprozessOptionen } from '@/lib/prozesse/teilprozess-neu';
import { knotenBefunde } from '@/lib/prozesse/definition-pruefen';
import { neuerKnoten, nameSetzen, maskeWerte, titelSetzen } from '@/lib/prozesse/werkstatt-maske';
import { phasen } from '@/lib/prozesse/fluss';

let n = 0;
const kennung = () => `fk-00000000-0000-4000-9400-${String(++n).padStart(12, '0')}`;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const AUFGABE = katalogEintrag('aufgabe.anlegen')!;
const titelVon = (k: Fassung['knoten'][number]) => maskeWerte(k, AUFGABE).titel;

const mandatProzess = () => {
  const e = neuerProzess({ id: 'pz-00000000-0000-4000-9400-000000000001', titel: 'Mandat-Start (Probe)', bereich: 'uebergabe', fallArt: 'mandat', von: 'test', jetzt: '2026-10-25T10:00:00Z', kennung });
  const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
  return { e, start };
};

describe('(1) ⌘V-Kopie: der Titel folgt dem Namen', () => {
  const bau = (titel?: string) => {
    const { e, start } = mandatProzess();
    let kick = neuerKnoten(AUFGABE, kennung(), 'Kick-off Diagnose');
    kick = nameSetzen(kick, AUFGABE, 'Kick-off Diagnose');
    if (titel) kick = titelSetzen(kick, AUFGABE, titel);
    const f = gut(anlegen({ knoten: e.entwurf.knoten }, kick, { nach: start.id, ausgang: 'weiter' }));
    return { f, kick: f.knoten.find(k => k.id === kick.id)! };
  };
  it('Bau-Test 3: Kopie heißt „Kick-off Diagnose (Kopie)“ und trägt denselben Titel; umbenannt in „Kick-off Vertrieb“ zieht der Titel mit', () => {
    const { f, kick } = bau();
    expect(titelVon(kick)).toBe('Kick-off Diagnose');
    const g = gut(einfuegen(f, kopieren(f, [kick.id])!, { phaseId: phasen(f)[0].id, kennung }));
    const kopie = g.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose (Kopie)');
    expect(titelVon(kopie)).toBe('Kick-off Diagnose (Kopie)');
    const umbenannt = nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb');
    expect(umbenannt.titel).toBe('Kick-off Vertrieb');
    expect(titelVon(umbenannt)).toBe('Kick-off Vertrieb');
    // Das Original bleibt, wie es war.
    expect(titelVon(g.knoten.find(k => k.id === kick.id)!)).toBe('Kick-off Diagnose');
  });
  it('ein selbst geänderter Titel bleibt an der Kopie — und folgt auch dort nicht dem Namen', () => {
    const { f, kick } = bau('Diagnose-Termin mit {{firma.name}} vereinbaren');
    const g = gut(einfuegen(f, kopieren(f, [kick.id])!, { phaseId: phasen(f)[0].id, kennung }));
    const kopie = g.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose (Kopie)');
    expect(titelVon(kopie)).toBe('Diagnose-Termin mit {{firma.name}} vereinbaren');
    expect(titelVon(nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb'))).toBe('Diagnose-Termin mit {{firma.name}} vereinbaren');
  });
  it('in einen anderen Prozess (freier Name) bleibt der Name — und der Titel folgt weiter', () => {
    const { f, kick } = bau();
    const ablage = kopieren(f, [kick.id])!;
    const { e } = mandatProzess();
    const g = gut(einfuegen({ knoten: e.entwurf.knoten }, ablage, { phaseId: phasen({ knoten: e.entwurf.knoten })[0].id, kennung }));
    const kopie = g.knoten.find(k => !e.entwurf.knoten.some(x => x.id === k.id))!;
    expect(kopie.titel).toBe('Kick-off Diagnose');
    expect(titelVon(nameSetzen(kopie, AUFGABE, 'Kick-off Vertrieb'))).toBe('Kick-off Vertrieb');
  });
  it('die Regel steht an EINER Stelle (einfuegen nimmt nameSetzen)', () => {
    expect(lies('lib/prozesse/werkstatt-aktionen.ts')).toContain('nameSetzen(k, katalogEintrag(k.katalog?.id), name)');
  });
});

describe('(2) Ausgang-Menü: jedes Ziel genau einmal, das wirksame gewählt, Optionen beginnen mit dem Namen', () => {
  const FASSUNGEN: { name: string; d: Pick<ProzessDefinition, 'knoten'> }[] = [
    ...ALLE_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]).map(d => ({ name: d.id, d })),
    ...MUSTER_PAKETE.map(v => ({ name: v.id, d: paketAlsDefinition(v) as Pick<ProzessDefinition, 'knoten'> })),
  ];
  /** Wohin ein Ausgang gerade wirklich führt (dieselbe Auflösung wie Motor und Probelauf). */
  const wirksam = (d: Pick<ProzessDefinition, 'knoten'>, id: string, a: string): string | null => {
    const k = d.knoten.find(x => x.id === id)!;
    const eigner = k.schloss && (a === 'ja' || a === 'weiter') ? d.knoten.find(x => x.id === k.schloss!.fuer)! : k;
    if (eigner !== k || !(a === 'nein' || a === 'fehler' || a === 'abgelaufen')) return hauptZiel(d.knoten, eigner.id);
    const z = ausgangsZiele({ knoten: d.knoten }).get(`${id}|${a}`);
    return z !== undefined ? z : a === 'abgelaufen' && k.form === 'warten' ? hauptZiel(d.knoten, id) : null;
  };
  it('über alle Vorlagen: kein Ziel doppelt, gewählt = wirksam, jede Option beginnt mit dem Namen — und führt dorthin, wohin sie sagt', () => {
    let menues = 0, gewechselt = 0;
    for (const { name, d } of FASSUNGEN) {
      for (const k of d.knoten.filter(x => x.form && x.form !== 'ende')) {
        for (const a of ausgaengeVon(k)) {
          const w = ausgangsWahl(d, k.id, a);
          if (!w.optionen.length) continue;
          menues++;
          const wo = `${name} „${k.titel}“ ${a}: ${w.optionen.map(o => o.label).join(' | ')}`;
          const ziele = w.optionen.map(o => o.ziel ?? '∅');
          expect(new Set(ziele).size, wo).toBe(ziele.length);
          // Jede Option beginnt mit dem Namen ihres Ziels (bzw. „Lauf endet“/„Lauf hält an“) — nie mit „—“ oder einem zusätzlichen „„“.
          for (const o of w.optionen) {
            expect(o.label, wo).not.toMatch(/^—/);
            const t = o.ziel ? d.knoten.find(x => x.id === o.ziel)?.titel.trim() || '(ohne Namen)' : 'Lauf ';
            expect(o.label.startsWith(t), `${wo} — ${o.label}`).toBe(true);
          }
          const gewaehlt = w.optionen.find(o => o.wert === w.wert);
          expect(gewaehlt, wo).toBeTruthy();
          expect(gewaehlt!.ziel, wo).toBe(wirksam(d, k.id, a));
          // „(folgt im Ablauf)“ nur am impliziten Ziel des Strangs.
          for (const o of w.optionen) if (o.label.includes('(folgt im Ablauf')) expect(o.wert === AUSGANG_NAECHSTER || o.wert === '', wo).toBe(true);
          // Verdrahtung unverändert: jede andere Option führt nach dem Wählen genau zu ihrem Ziel; kein anderer Ausgang ändert sich (Regel der Werkstatt-Fäden).
          for (const o of w.optionen.filter(x => x.wert !== w.wert)) {
            const r = ausgangSetzen({ knoten: [...d.knoten] }, k.id, a, ausgangWahlAus(o.wert));
            if (!r.ok) continue;
            gewechselt++;
            expect(wirksam(r.fassung, k.id, a), `${wo} → ${o.label}`).toBe(o.ziel);
          }
        }
      }
    }
    expect(menues).toBeGreaterThan(100);
    expect(gewechselt).toBeGreaterThan(200);
  });
  it('Bau-Test 3: „Lauf endet (folgt im Ablauf)“ steht nicht neben „Lauf endet“, ein implizites Ziel nicht neben sich selbst', () => {
    const { e, start } = mandatProzess();
    const a = neuerKnoten(AUFGABE, kennung(), 'Kick-off Cockpit planen');
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, a, { nach: start.id, ausgang: 'weiter' }));
    // Am Ende des Strangs: das Ende ist implizit und steht genau einmal da.
    const am = ausgangsWahl(f, a.id, 'weiter');
    expect(am.optionen.filter(o => o.ziel === null).map(o => o.label)).toEqual(['Lauf endet (folgt im Ablauf)']);
    expect(am.wert).toBe(AUSGANG_NAECHSTER);
    const b = neuerKnoten(AUFGABE, kennung(), 'Kick-off Diagnose');
    f = gut(anlegen(f, b, { nach: a.id, ausgang: 'weiter' }));
    const w = ausgangsWahl(f, a.id, 'weiter');
    expect(w.optionen.map(o => o.label)).toEqual(['Kick-off Diagnose (folgt im Ablauf)', 'Lauf endet']);
    // Ausdrücklich „Lauf endet“: jetzt steht das Ende einmal (gewählt), das Ziel des Strangs weiter einmal als „folgt im Ablauf“.
    f = gut(ausgangSetzen(f, a.id, 'weiter', ausgangWahlAus(AUSGANG_ENDE)));
    const x = ausgangsWahl(f, a.id, 'weiter');
    expect(x.wert).toBe(AUSGANG_ENDE);
    expect(x.optionen.map(o => o.label)).toEqual(['Kick-off Diagnose (folgt im Ablauf)', 'Lauf endet']);
  });
  it('die Bahn heißt wie auf der Fläche — eine Person mit ihrem Namen statt „Mensch“', () => {
    const { e, start } = mandatProzess();
    const sys = neuerKnoten(katalogEintrag('glocke.melden')!, kennung(), 'Melden');
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, sys, { nach: start.id, ausgang: 'weiter' }));
    const person = { ...neuerKnoten(AUFGABE, kennung(), 'Kick-off planen'), bahn: 'mensch' as const };
    person.katalog = { id: 'aufgabe.anlegen', werte: { ...(person.katalog?.werte ?? {}), titel: 'Kick-off planen', wer: 'lena' } };
    f = gut(anlegen(f, person, { nach: sys.id, ausgang: 'weiter' }));
    const w = ausgangsWahl(f, sys.id, 'weiter', { team: [{ id: 'lena', name: 'Lena Beispiel' }] });
    expect(w.optionen[0].label).toBe('Kick-off planen (folgt im Ablauf · Bahn „Lena Beispiel“)');
    const ohne = ausgangsWahl(f, sys.id, 'weiter');
    expect(ohne.optionen[0].label).toBe('Kick-off planen (folgt im Ablauf · Bahn „Person (nicht mehr im Team)“)');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain("ausgangsWahl(d, k.id, a, { team: teamAusAuswahl(p.auswahl['team-person']) })");
  });
  it('Mehrfach-Dialog: das Ziel „weiter im Ablauf“ steht nicht noch einmal als Schritt da', () => {
    const { e, start } = mandatProzess();
    const a = neuerKnoten(AUFGABE, kennung(), 'Prüfen');
    const f = gut(anlegen({ knoten: e.entwurf.knoten }, a, { nach: start.id, ausgang: 'weiter' }));
    const m = mehrfachZiele(f, start.id);
    expect(m.map(x => x.label)).toEqual(['Prüfen (folgt im Ablauf)']);
  });
});

describe('(3) Eine angehängte Kopie liegt hinter ihrem Ziel — der Faden läuft vorwärts', () => {
  it('Bau-Test 3: „Kick-off Diagnose“ gewählt, ⌘V mit der Maus darunter — die Kopie liegt in der Spalte danach auf derselben Höhe, nicht unter dem Original', () => {
    const { e, start } = mandatProzess();
    const kick = neuerKnoten(AUFGABE, kennung(), 'Kick-off Diagnose');
    const f = gut(anlegen({ knoten: e.entwurf.knoten }, kick, { nach: start.id, ausgang: 'weiter' }));
    const d = (x: Fassung) => ({ ...e.entwurf, knoten: x.knoten }) as ProzessDefinition;
    const l = werkstattLage(d(f));
    const ablage = kopieren(f, [kick.id])!;
    const ph = phasen(f)[0].id;
    const ziel = l.knoten.get(kick.id)!;
    // Die Maus steht UNTER dem Original (wie im Bau-Test) — angehängt zählt das Ziel.
    const unten: [number, number] = [ziel.x + ziel.b / 2, ziel.y + ziel.h + 200];
    const lagen = einfuegeLagen(ablage.knoten, l, unten, ph, { hinter: kick.id });
    const g = gut(einfuegen(f, ablage, { phaseId: ph, nach: kick.id, kennung, lagen }));
    const kopie = g.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    const l2 = werkstattLage(d(g));
    const z2 = l2.knoten.get(kick.id)!, k2 = l2.knoten.get(kopie.id)!;
    expect(k2.x).toBeGreaterThan(z2.x + z2.b);
    expect(k2.y).toBe(z2.y);
    // Der Faden vom Original zur Kopie läuft vorwärts (kein „zurück“).
    const faden = l2.kanten.find(k => k.von === kick.id && k.nach === kopie.id)!;
    expect(faden.rueckwaerts ?? false).toBe(false);
    // Ohne Anhängen (kein Ziel): weiter an der Maus.
    const lose = einfuegeLagen(ablage.knoten, l, unten, ph);
    expect(lose.get(kick.id)!.x).toBeLessThan(lagen.get(kick.id)!.x);
    expect(lies('components/os/prozesse/Werkstatt.tsx')).toContain('einfuegeLagen(a.knoten, lage, punkt, phaseId, { hinter })');
  });
});

describe('(4) Kamera: der sichtbare Bereich ist das freie Feld OHNE Werkzeugleiste und Panel', () => {
  // Bühne wie im Bau-Test (Vollbild): links die Werkzeugleiste, oben die Kopfzeile, rechts das Panel, unten Zoom und „Head fragen“.
  const BUEHNE = { b: 1376, h: 1000 };
  const RAENDER = { links: 74, oben: 140, rechts: 400, unten: 80 };
  const F = freiesFeld(BUEHNE, RAENDER);
  const aufBild = (k: { s: number; x: number; y: number }, b: Box) => ({ x0: b.x * k.s + k.x, y0: b.y * k.s + k.y, x1: (b.x + b.b) * k.s + k.x, y1: (b.y + b.h) * k.s + k.y });
  const ganzFrei = (k: { s: number; x: number; y: number }, b: Box) => { const r = aufBild(k, b); return r.x0 >= F.x - 0.5 && r.y0 >= F.y - 0.5 && r.x1 <= F.x + F.b + 0.5 && r.y1 <= F.y + F.h + 0.5; };
  it('Wählen (l/16): passt der Inhalt beim Zoom, liegt er danach ganz im freien Feld — nichts unter der Leiste, nichts hinter dem Panel', () => {
    const inhalt = { x: 0, y: 0, b: 1400, h: 600 };
    const ziel = { x: 1300, y: 200, b: 184, h: 150 };
    // Vorher: der Anfang unter der Werkzeugleiste, das Ziel hinter dem Panel.
    const k0 = { s: 0.58, x: 20, y: 200 };
    expect(ganzFrei(k0, inhalt)).toBe(false);
    const k = kameraSicht(k0, ziel, BUEHNE, { raender: RAENDER, inhalt });
    expect(k.s).toBe(0.58);
    expect(ganzFrei(k, inhalt)).toBe(true);
    expect(ganzFrei(k, ziel)).toBe(true);
    // Schon passend → dieselbe Kamera.
    expect(kameraSicht(k, ziel, BUEHNE, { raender: RAENDER, inhalt })).toBe(k);
  });
  it('Anhängen (d/09): passt nicht mehr alles, war aber der Anfang zu sehen — herauszoomen statt den Start unter die Leiste zu schieben', () => {
    const rest = { x: 0, y: 0, b: 1000, h: 500 };
    const neu = { x: 1060, y: 200, b: 184 + 66, h: 150 };
    const inhalt = boxUm([rest, neu])!;
    const k0 = { s: 0.9, x: 90, y: 300 };
    expect(ganzFrei(k0, rest)).toBe(false); // rechts schon unter dem Panel, aber der Anfang ist zu sehen
    const k = kameraSicht(k0, neu, BUEHNE, { raender: RAENDER, inhalt, rest, neu: true });
    expect(k.s).toBeLessThan(0.9);
    expect(k.s).toBeGreaterThanOrEqual(WERKSTATT_UEBERSICHT_MIN);
    expect(ganzFrei(k, inhalt)).toBe(true);
    // Ohne Bau-Aktion (nur wählen) wird nie gezoomt — nur so weit wie nötig verschoben, das Ziel ganz im freien Feld.
    const w = kameraSicht(k0, neu, BUEHNE, { raender: RAENDER, inhalt, rest });
    expect(w.s).toBe(0.9);
    expect(ganzFrei(w, neu)).toBe(true);
  });
  it('wer bewusst hineingezoomt ist (Anfang nicht zu sehen), wird nicht herausgezoomt — das Neue kommt trotzdem ins freie Feld', () => {
    const rest = { x: 0, y: 0, b: 3000, h: 500 };
    const neu = { x: 3060, y: 200, b: 250, h: 150 };
    const k0 = { s: 1, x: -2300, y: 300 };
    const k = kameraSicht(k0, neu, BUEHNE, { raender: RAENDER, inhalt: boxUm([rest, neu]), rest, neu: true });
    expect(k.s).toBe(1);
    expect(ganzFrei(k, neu)).toBe(true);
  });
  it('Mehrfach-Rauten (m/10): die neuen Rauten lagen hinter dem Panel — danach liegen alle im freien Feld', () => {
    const rest = { x: 0, y: 0, b: 700, h: 400 };
    const rauten = [{ x: 760, y: 240, b: 184 + 66, h: 206 }, { x: 1016, y: 240, b: 184 + 66, h: 206 }, { x: 1272, y: 240, b: 184 + 66, h: 206 }];
    const ziel = boxUm(rauten)!;
    const k0 = { s: 1, x: 120, y: 260 };
    expect(ganzFrei(k0, ziel)).toBe(false);
    const k = kameraSicht(k0, ziel, BUEHNE, { raender: RAENDER, inhalt: boxUm([rest, ziel]), rest, neu: true });
    for (const r of rauten) expect(ganzFrei(k, r)).toBe(true);
    expect(ganzFrei(k, rest)).toBe(true);
  });
  it('die Oberfläche nimmt die Regel: Auswahl, neue Knoten und Mehrfach-Rauten über zeigeSicht mit den gemessenen Rändern', () => {
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain("flaeche.current?.zeigeSicht(ids, { ausgaenge: true, neu: true })");
    expect(w).toContain("flaeche.current?.zeigeSicht([einerGewaehlt], { ausgaenge: true })");
    expect(w).toContain('if (anwenden(e) && e.waehle) zeigeNeu.current = e.waehle;');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('kameraSicht(kamera.current, ziel, groesse(), { raender: raender(), inhalt: allesBox(), rest, neu: !!o?.neu })');
  });
});

describe('(5) Befunde nennen den Schritt beim Namen', () => {
  const MAIL = katalogEintrag('inbox.mail-entwurf')!;
  it('Bau-Test 3: „„Danke senden“ › Postfach: fehlt.“ statt „Mail-Entwurf › Postfach: fehlt.“ — der Baustein nur ohne Namen', () => {
    const k = { ...neuerKnoten(MAIL, kennung(), 'Danke senden') };
    const texte = maskeBefunde(k).map(b => b.text);
    expect(texte).toContain('„Danke senden“ › Postfach: fehlt.');
    expect(texte.some(t => t.startsWith('Mail-Entwurf ›'))).toBe(false);
    // Dieselbe Regel in der Prüfung des Prozesses (Veröffentlichen).
    const { e } = mandatProzess();
    const d = { ...e.entwurf, knoten: [...e.entwurf.knoten, k] } as ProzessDefinition;
    expect(knotenBefunde(k, d).map(b => b.text)).toContain('„Danke senden“ › Postfach: fehlt.');
    // Ohne Namen: der Baustein.
    expect(maskeSaeubern(MAIL, {}, {}, k.id, '  ').befunde.map(b => b.text)).toContain('Mail-Entwurf › Postfach: fehlt.');
  });
});

describe('(6) Schleife: die einzige passende Liste ist vorbelegt', () => {
  const SCHLEIFE = katalogEintrag('schleife.je-eintrag')!;
  const abfrage = (id: string, titel: string, art: string) => ({ id, titel, rang: 1, form: 'schritt', katalog: { id: 'crm.abfragen' }, abfrage: { art, hoechstens: 50 } }) as unknown as Fassung['knoten'][number];
  it('Bau-Test 3 (d/10): nur „Ergebnis von „CRM abfragen““ — neu angelegt ist sie gewählt, und die Teilprozesse sind sofort nach Fall gefiltert', () => {
    const knoten = [abfrage('fk-q', 'CRM abfragen', 'deals-ohne-schritt')];
    const s0 = neuerKnoten(SCHLEIFE, 'fk-s');
    expect(maskeWerte(s0, SCHLEIFE).liste ?? '').toBe('');
    const s1 = schleifeVorbelegen(knoten, s0, 'fk-q');
    expect(maskeWerte(s1, SCHLEIFE).liste).toBe('abfrage:fk-q');
    expect(maskeWerte(s1, SCHLEIFE).hoechstens).toBe(50);
    const d = { knoten: [...knoten, s1] };
    expect(schleifenElementFall(d, s1)).toBe('deal');
    const l = [{ id: 'pz-deal', label: 'Deal klären', fall: 'deal' as const }, { id: 'pz-mandat', label: 'Mandat', fall: 'mandat' as const }];
    expect(teilprozessOptionen(l, schleifenElementFall(d, s1)).map(o => o.id)).toEqual(['pz-deal']);
  });
  it('mehrere Listen: die Abfrage, an die angehängt wird — sonst nichts vorbelegt; eine gewählte Liste bleibt; andere Bausteine unberührt', () => {
    const knoten = [abfrage('fk-a', 'Leads', 'leads'), abfrage('fk-b', 'Deals', 'deals-haengen')];
    const s0 = neuerKnoten(SCHLEIFE, 'fk-s');
    expect(maskeWerte(schleifeVorbelegen(knoten, s0, 'fk-b'), SCHLEIFE).liste).toBe('abfrage:fk-b');
    expect(maskeWerte(schleifeVorbelegen(knoten, s0, 'fk-x'), SCHLEIFE).liste ?? '').toBe('');
    const gewaehlt = schleifeVorbelegen(knoten, s0, 'fk-a');
    expect(schleifeVorbelegen(knoten, gewaehlt, 'fk-b')).toBe(gewaehlt);
    const auf = neuerKnoten(AUFGABE, 'fk-t');
    expect(schleifeVorbelegen(knoten, auf, 'fk-a')).toBe(auf);
    expect(schleifenListen(knoten).map(x => x.label)).toEqual(['Ergebnis von „Leads“', 'Ergebnis von „Deals“']);
  });
  it('die Oberfläche belegt beim Anlegen vor und das Panel liest dieselben Listen', () => {
    expect(lies('components/os/prozesse/Werkstatt.tsx')).toContain('neu = schleifeVorbelegen(fassungRef.current?.knoten ?? [], neu, ziel.nach ?? kante?.von);');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain("if (q === 'liste') return schleifenListen(p.d.knoten, k.id);");
  });
});

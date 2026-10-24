// ─── Prozesse · Werkstatt-Fäden (24.10., Feinschliff Runde 2 „Verdrahtung“; Anlass: Bau-Test im Demo) ─────────────────────────────────────────────────────────
// DIE Regel: eine Bau-Aktion ändert nie, wohin ein ANDERER Ausgang führt. Geprüft über die aufgelösten Ziele (`ausgangsZiele` — dieselbe Auflösung wie Lauf-Motor
// und Probelauf, `kantenVon`), „Lauf endet“ eingeschlossen:
//   (a) Eigenschaft über ALLE Vorlagen und Teilprozesse der Bibliothek (Kundengewinnung, Begleitung), die Pakete des Fulfillment-Musters und die Überführungen —
//       je Knoten und Ausgang `anlegen`, je Faden `zwischenEinfuegen`, je Schritt eine Kopie `einfuegen` (lose bzw. an einem freien Ausgang), je Schritt `loeschen`;
//   (b) der Bau-Test als Regression: Mehrfach-Entscheidung mit drei Fällen + „sonst“, an jedes „ja“ eine Aufgabe → der Probelauf geht genau den einen Weg;
//   (c) ⌘V verdrahtet nie um; (d) ohne das neue Feld `danach` bit-gleich (Säuberer, Kanten), dazu die Teile der Oberfläche (Panel, Kopf, Warten, Auslöser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ALLE_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { MUSTER_PAKETE } from '@/lib/fulfillment/muster';
import { UEBERFUEHRBAR } from '@/lib/prozesse/ueberfuehrung';
import { ueberfuehrungsVorlage } from '@/lib/prozesse/ueberfuehrung-anlegen';
import { paketAlsDefinition, fulfillmentModusBefunde } from '@/lib/prozesse/fulfillment-modus';
import { alleSchritte, ausgangsZiele, flussPruefen, kantenVon, phasen } from '@/lib/prozesse/fluss';
import { katalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { neuerKnoten } from '@/lib/prozesse/werkstatt-maske';
import { knotenAus, neuerProzess } from '@/lib/prozesse/bestand';
import { mitNeuenKnoten } from '@/lib/prozesse/kopie';
import { ausgaengeVon, einfuegeLagen, werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import {
  anlegen, zwischenEinfuegen, zwischenGrund, einfuegen, kopieren, loeschen, mehrfachEntscheidung, ausgangSetzen, ausloeserWechseln, verbinden, umhaengen, inPhase,
  rueckgaengig, merke, LEERE_GESCHICHTE, hauptAusgang, hauptZiel, phaseNeu, type Fassung, type Ergebnis,
} from '@/lib/prozesse/werkstatt-aktionen';
import { starten, voran, probeZeilen } from '@/lib/prozesse/lauf-regeln';
import { leereLaeufe } from '@/lib/prozesse/lauf-typen';
import type { ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import type { Ausgang } from '@/lib/prozesse/fluss';

type K = ProzessKnoten<ProzessForm>;
let n = 0;
const kennung = () => `fk-00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;
const gut = (e: Ergebnis): Fassung => { if (!e.ok) throw new Error(e.grund); return e.fassung; };
const aufgabe = (titel = 'Neu') => neuerKnoten(katalogEintrag('aufgabe.anlegen')!, kennung(), titel);
const zerlegt = (s: string): [string, string] => { const i = s.lastIndexOf('|'); return [s.slice(0, i), s.slice(i + 1)]; };
const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

// ── Alle Fassungen, die im Repo als Daten vorliegen ────────────────────────────────────────────────────────────────────────────────────────────────────
const FASSUNGEN: { name: string; d: Pick<ProzessDefinition, 'knoten'> }[] = [
  ...ALLE_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]).map(d => ({ name: d.id, d })),
  ...MUSTER_PAKETE.map(v => ({ name: v.id, d: paketAlsDefinition(v) as Pick<ProzessDefinition, 'knoten'> })),
  ...UEBERFUEHRBAR.map(u => ({ name: `ue:${u.sp}`, d: ueberfuehrungsVorlage(u) })),
];

/** Die bedienten Schlüssel eines Ausgangs (wie die Werkstatt sie rechnet): der Hauptausgang (mit Schloss) bzw. genau dieser Zweig. */
function bedient(kn: readonly K[], von: string, a: Ausgang): { keys: Set<string>; haupt: boolean; eigner: string } {
  const k = kn.find(x => x.id === von)!;
  const eigner = k.form === 'freigabe' && k.schloss && (a === 'ja' || a === 'weiter') ? k.schloss.fuer : von;
  const haupt = !(a === 'nein' || a === 'fehler' || a === 'abgelaufen');
  return { keys: new Set(haupt ? hauptAusgang(kn, eigner).alle : [`${von}|${a}`]), haupt, eigner };
}
/** Wohin der Ausgang vorher führte (ein „abgelaufen“ am Warten ohne eigenes Ziel geht den Weg von „weiter“; nein/Fehler ohne Zweig: der Lauf endet). */
function vorherZiel(f: Pick<ProzessDefinition, 'knoten'>, von: string, a: Ausgang): string | null {
  const k = f.knoten.find(x => x.id === von)!;
  const b = bedient(f.knoten, von, a);
  if (b.haupt) return hauptZiel(f.knoten, b.eigner);
  const z = k.zweige?.[a as 'nein' | 'fehler' | 'abgelaufen'];
  if (z) return z;
  return a === 'abgelaufen' && k.form === 'warten' ? hauptZiel(f.knoten, von) : null;
}
/** Die Regel: jedes nicht bediente Ziel vorher = nachher (Ausgänge gelöschter Knoten bzw. auf Gelöschtes zählen nicht). */
function andereGleich(vorher: Pick<ProzessDefinition, 'knoten'>, nachher: Pick<ProzessDefinition, 'knoten'>, ausgenommen: ReadonlySet<string>, wo: string) {
  const z0 = ausgangsZiele(vorher), z1 = ausgangsZiele(nachher);
  const da = new Set(nachher.knoten.map(k => k.id));
  for (const [s, ziel] of z0) {
    if (ausgenommen.has(s)) continue;
    const [von] = zerlegt(s);
    const k = nachher.knoten.find(x => x.id === von);
    if (!k || (k.schloss && !da.has(k.schloss.fuer)) || (ziel !== null && !da.has(ziel))) continue;
    expect(z1.get(s), `${wo}: ${s}`).toBe(ziel);
  }
}

describe('(a) Eigenschaft über alle Vorlagen: eine Bau-Aktion ändert nie, wohin ein anderer Ausgang führt', () => {
  it('die Sammlung deckt Bibliothek, Fulfillment-Muster und Überführungen ab', () => {
    expect(FASSUNGEN.length).toBeGreaterThanOrEqual(30);
    expect(FASSUNGEN.some(x => x.name.startsWith('ue:'))).toBe(true);
    expect(FASSUNGEN.some(x => MUSTER_PAKETE.some(p => p.id === x.name))).toBe(true);
  });

  describe.each(FASSUNGEN.map(x => [x.name, x.d] as const))('%s', (name, d) => {
    const f: Fassung = { knoten: d.knoten };
    const schritte = alleSchritte(f).map(x => x.schritt).filter(k => k.form !== 'ende');

    it('„+“ an JEDEM Ausgang jedes Knotens: der Ausgang führt in den Neuen, der Neue dorthin, wohin der Ausgang führte — alles andere bleibt', () => {
      let geprueft = 0;
      for (const k of schritte) {
        const aus: Ausgang[] = k.form === 'freigabe' && k.schloss ? ['ja', 'nein', 'abgelaufen'] : [...ausgaengeVon(k)];
        for (const a of aus) {
          const wo = `${name} · „${k.titel}“ · ${a}`;
          const neu = aufgabe();
          const T = vorherZiel(f, k.id, a);
          const r = anlegen(f, neu, { nach: k.id, ausgang: a });
          if (!r.ok) {
            // Einzige erlaubte Absage: ein Kreis (z. B. hinter dem „zurück zu …“ einer Erinnerung) — die Fluss-Prüfung, nie die Regel.
            expect(r.grund, wo).toMatch(/Kreis/);
            continue;
          }
          geprueft++;
          const b = bedient(f.knoten, k.id, a);
          andereGleich(f, r.fassung, b.keys, wo);
          const z1 = ausgangsZiele(r.fassung);
          if (b.haupt) expect(z1.get(hauptAusgang(r.fassung.knoten, b.eigner).haupt), `${wo}: führt in den Neuen`).toBe(neu.id);
          else expect(z1.get(`${k.id}|${a}`), `${wo}: führt in den Neuen`).toBe(neu.id);
          expect(z1.get(`${neu.id}|weiter`), `${wo}: der Neue führt dorthin, wohin der Ausgang führte`).toBe(T);
          expect(flussPruefen(r.fassung).filter(x => x.stufe === 'fehler').map(x => x.text), wo).toEqual(flussPruefen(f).filter(x => x.stufe === 'fehler').map(x => x.text));
        }
      }
      expect(geprueft).toBeGreaterThan(0);
    });

    it('„+“ mitten auf JEDEM Faden: zwischen Quelle und Ziel — alle anderen Ausgänge bleiben', () => {
      const nach = new Map(f.knoten.map(k => [k.id, k]));
      for (const kante of kantenVon(f)) {
        const v = nach.get(kante.von);
        if (kante.ausgang === 'abgelaufen' && v?.form === 'warten' && !v.zweige?.abgelaufen) continue; // folgt „weiter“, kein eigener Faden
        if (zwischenGrund(f, kante)) continue;
        const wo = `${name} · ${v?.titel} → ${nach.get(kante.nach!)?.titel} (${kante.ausgang})`;
        const neu = aufgabe();
        const r = zwischenEinfuegen(f, kante, neu);
        if (!r.ok) { expect(r.grund, wo).toMatch(/Kreis/); continue; }
        const b = bedient(f.knoten, kante.von, kante.ausgang);
        andereGleich(f, r.fassung, b.keys, wo);
        const z1 = ausgangsZiele(r.fassung);
        expect(b.haupt ? z1.get(hauptAusgang(r.fassung.knoten, b.eigner).haupt) : z1.get(`${kante.von}|${kante.ausgang}`), wo).toBe(neu.id);
        expect(z1.get(`${neu.id}|weiter`), wo).toBe(kante.nach);
      }
    });

    it('⌘V einer Kopie jedes Schritts: lose (kein Ausgang ändert sich) — an einem freien Ausgang angehängt (nur der ändert sich)', () => {
      const ph = phasen(f).at(-1)!.id;
      for (const k of schritte.filter(x => x.form !== 'ausloeser' && !(x.form === 'freigabe' && x.schloss))) {
        const a = kopieren(f, [k.id])!;
        const lose = gut(einfuegen(f, a, { phaseId: ph, kennung }));
        andereGleich(f, lose, new Set(), `${name} · Kopie „${k.titel}“ lose`);
        const kopie = lose.knoten.find(x => !f.knoten.some(y => y.id === x.id))!;
        expect(hauptZiel(lose.knoten, kopie.id), `${name} · Kopie „${k.titel}“ endet`).toBeNull();
        // Kein bestehender Ausgang führt in die lose Kopie.
        expect([...ausgangsZiele(lose)].filter(([s, z]) => z === kopie.id && f.knoten.some(x => x.id === zerlegt(s)[0])), name).toEqual([]);
      }
      for (const k of schritte.filter(x => hauptZiel(f.knoten, x.id) === null)) {
        const a = kopieren(f, [schritte.find(x => x.form !== 'ausloeser' && !(x.form === 'freigabe' && x.schloss))!.id])!;
        const r = gut(einfuegen(f, a, { phaseId: ph, nach: k.id, kennung }));
        const kopie = r.knoten.find(x => !f.knoten.some(y => y.id === x.id))!;
        andereGleich(f, r, new Set(hauptAusgang(f.knoten, k.id).alle), `${name} · angehängt an „${k.titel}“`);
        expect(hauptZiel(r.knoten, k.id)).toBe(kopie.id);
        expect(hauptZiel(r.knoten, kopie.id)).toBeNull();
      }
    });

    it('Faden ziehen (verbinden), Mehrfach-Entscheidung, in eine andere Phase ziehen: nur der bediente Ausgang ändert sich', () => {
      const ps = phasen(f);
      for (const k of schritte.filter(x => !(x.form === 'freigabe' && x.schloss))) {
        const ph = alleSchritte(f).find(x => x.schritt.id === k.id)!.phase.id;
        const kandidaten = alleSchritte(f).filter(x => x.phase.id === ph && x.schritt.id !== k.id && x.schritt.form !== 'ausloeser' && !x.schritt.schloss).map(x => x.schritt);
        for (const z of [kandidaten[0], kandidaten.at(-1)].filter((x): x is K => !!x)) {
          const r = verbinden(f, k.id, k.form === 'entscheidung' || k.form === 'freigabe' ? 'ja' : 'weiter', z.id);
          if (!r.ok) continue;
          andereGleich(f, r.fassung, new Set(hauptAusgang(f.knoten, k.id).alle), `${name} · „${k.titel}“ → „${z.titel}“`);
          expect(hauptZiel(r.fassung.knoten, k.id)).toBe(z.id);
        }
        const fall = (t: string) => ({ titel: t, bedingungen: [{ feld: 'lead.status', op: 'gleich' as const, wert: t }] });
        const m = mehrfachEntscheidung(f, { nach: k.id, faelle: [fall('eins'), fall('zwei')], sonst: 'aufgabe', kennung });
        if (m.ok) andereGleich(f, m.fassung, new Set(hauptAusgang(f.knoten, k.id).alle), `${name} · Mehrfach an „${k.titel}“`);
        else expect(m.grund).toMatch(/Kreis|Ende/);
        const andere = ps.find(p => p.id !== ph);
        if (andere && k.form !== 'ausloeser') {
          const r = inPhase(f, k.id, andere.id);
          if (r.ok) andereGleich(f, r.fassung, new Set(), `${name} · „${k.titel}“ in „${andere.titel}“`);
        }
      }
    });

    it('Löschen: nur Ausgänge, die auf den Gelöschten zeigten, ändern sich', () => {
      for (const k of schritte.filter(x => !(x.form === 'freigabe' && x.schloss))) {
        const r = loeschen(f, [k.id]);
        if (!r.ok) continue;
        andereGleich(f, r.fassung, new Set(), `${name} · „${k.titel}“ gelöscht`);
      }
    });
  });
});

// ── (b) Der Bau-Test als Regression ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(b) Bau-Test 24.10.: Mehrfach-Entscheidung mit drei Fällen + „sonst“, an jedes „ja“ eine Aufgabe', () => {
  const bauen = () => {
    const e = neuerProzess({ id: 'pz-00000000-0000-4000-9000-000000000001', titel: 'Bau-Test Mandat-Start', bereich: 'uebergabe', fallArt: 'mandat', von: 'test', jetzt: '2026-10-24T10:00:00Z', kennung });
    const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
    const fall = (titel: string, wert: string) => ({ titel, bedingungen: [{ feld: 'mandat.produkt', op: 'gleich' as const, wert }] });
    let f = gut(mehrfachEntscheidung({ knoten: e.entwurf.knoten }, { nach: start.id, faelle: [fall('Vertriebsaufbau', 'vertriebsaufbau'), fall('Cockpit', 'cockpit'), fall('Diagnose', 'diagnose')], sonst: 'aufgabe', kennung }));
    const r = (t: string) => f.knoten.find(k => k.titel === t)!;
    const sonst = r('Sonst: von Hand prüfen');
    const vorKickoff = ausgangsZiele(f);
    const kickoff = aufgabe('Kick-off Vertriebsaufbau planen');
    f = gut(anlegen(f, kickoff, { nach: r('Vertriebsaufbau').id, ausgang: 'ja' }));
    // Der eigentliche Befund 1: vorher führten Cockpit-ja, Diagnose-ja und „sonst“ danach still in „Kick-off“.
    for (const t of ['Cockpit', 'Diagnose']) expect(hauptZiel(f.knoten, r(t).id), t).toBe(vorKickoff.get(`${r(t).id}|ja`));
    expect(hauptZiel(f.knoten, sonst.id)).toBe(vorKickoff.get(`${sonst.id}|weiter`));
    const cockpit = aufgabe('Cockpit einrichten'), diagnose = aufgabe('Diagnose-Termin vereinbaren');
    f = gut(anlegen(f, cockpit, { nach: r('Cockpit').id, ausgang: 'ja' }));
    f = gut(anlegen(f, diagnose, { nach: r('Diagnose').id, ausgang: 'ja' }));
    return { e, f, start, kickoff, cockpit, diagnose, sonst, r };
  };
  const probe = (d: ProzessDefinition, produkt: string | null) => {
    const s = starten(leereLaeufe(), { id: 'pl-00000000-0000-4000-9000-000000000001', prozessId: d.id, version: 1, def: d, fall: { art: 'mandat', id: 'm-probe' }, modus: 'schatten', person: null, ausloeser: { art: 'hand', knoten: d.knoten.find(k => k.form === 'ausloeser')!.id }, automatisch: false, jetzt: '2026-10-24T10:00:00Z' });
    if (!s.ok) throw new Error(s.grund);
    // Die Rolle „Zuständig im Fall“ löst im Server das Umfeld auf — hier eine erfundene Person.
    const v = voran(s.lauf, d, { jetzt: '2026-10-24T10:00:00Z', titel: d.titel, daten: produkt ? { 'mandat.produkt': produkt } : {}, rolle: () => ({ speicher: 'probe' }) as never }, 'schatten');
    expect(v.lauf.status).toBe('fertig');
    return new Set(probeZeilen(v.lauf, d).schritte.map(z => z.knotenId));
  };

  it('jedes „ja“ führt genau in seine Aufgabe, jede Aufgabe endet; „sonst“ läuft nur, wenn kein Fall passt', () => {
    const { f, kickoff, cockpit, diagnose, sonst, r } = bauen();
    expect(hauptZiel(f.knoten, r('Vertriebsaufbau').id)).toBe(kickoff.id);
    expect(hauptZiel(f.knoten, r('Cockpit').id)).toBe(cockpit.id);
    expect(hauptZiel(f.knoten, r('Diagnose').id)).toBe(diagnose.id);
    for (const x of [kickoff, cockpit, diagnose, sonst]) expect(hauptZiel(f.knoten, x.id), x.titel).toBeNull();
    expect(flussPruefen(f).filter(b => b.stufe === 'fehler')).toEqual([]);
    // Die Rauten tragen die Verknüpfung „alle“ (das Panel zeigt nie „— wählen —“).
    for (const t of ['Vertriebsaufbau', 'Cockpit', 'Diagnose']) expect(r(t).raute).toMatchObject({ art: 'regel', verknuepfung: 'und' });
  });
  it('Probelauf (derselbe Motor): Fall 2 passt → genau „Cockpit einrichten“; kein Fall → genau „sonst“, keine Fall-Aufgabe', () => {
    const { e, f, kickoff, cockpit, diagnose, sonst } = bauen();
    const d: ProzessDefinition = { ...e.entwurf, knoten: f.knoten };
    const zwei = probe(d, 'cockpit');
    expect(zwei.has(cockpit.id)).toBe(true);
    for (const x of [kickoff, diagnose, sonst]) expect(zwei.has(x.id), x.titel).toBe(false);
    const keiner = probe(d, 'etwas-anderes');
    expect(keiner.has(sonst.id)).toBe(true);
    for (const x of [kickoff, cockpit, diagnose]) expect(keiner.has(x.id), x.titel).toBe(false);
    const eins = probe(d, 'vertriebsaufbau');
    expect([kickoff, cockpit, diagnose, sonst].filter(x => eins.has(x.id)).map(x => x.titel)).toEqual(['Kick-off Vertriebsaufbau planen']);
  });
  it('„+“ am „ja“ einer Raute neben dem Strang hängt GENAU dort (Befund 2) — nicht hinter „Kick-off“, nicht ohne Eingang', () => {
    const { f, kickoff, cockpit, r } = bauen();
    expect(hauptZiel(f.knoten, kickoff.id)).toBeNull();
    expect([...ausgangsZiele(f)].filter(([, z]) => z === cockpit.id).map(([s]) => s)).toEqual([`${r('Cockpit').id}|ja`]);
    // Lage: die Aufgabe steht rechts von ihrer Raute (ein Faden vorwärts, keine Rückschleife).
    const l = werkstattLage(f);
    expect(l.knoten.get(cockpit.id)!.x).toBeGreaterThan(l.knoten.get(r('Cockpit').id)!.x);
    expect(l.kanten.find(k => k.von === r('Cockpit').id && k.nach === cockpit.id)?.zurueck).toBe(false);
  });
});

// ── (c) ⌘V verdrahtet nie um ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(c) ⌘V: lose an der Mausposition, nie einen bestehenden Ausgang umhängen', () => {
  const lead = () => {
    const e = neuerProzess({ id: 'pz-00000000-0000-4000-9000-000000000002', titel: 'Bau-Test Lead-Eingang', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-24T10:00:00Z', kennung });
    const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
    const raute = { ...neuerKnoten(katalogEintrag('entscheidung.regel')!, kennung(), 'hat geantwortet?'), raute: { art: 'regel' as const, bedingungen: [{ feld: 'lead.status', op: 'gleich' as const, wert: 'im-gespraech' }] } };
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, raute, { nach: start.id }));
    const nach = aufgabe('Lead nachfassen');
    f = gut(anlegen(f, nach, { nach: raute.id, ausgang: 'nein' }));
    return { f, raute, nach };
  };
  it('die Kopie von „Lead nachfassen“ ändert das „ja“ der Raute nicht (vorher „Lauf endet“) — und steht an der Mausposition', () => {
    const { f, raute, nach } = lead();
    expect(hauptZiel(f.knoten, raute.id)).toBeNull();
    const a = kopieren(f, [nach.id])!;
    const ph = phasen(f)[0].id;
    const r = einfuegen(f, a, { phaseId: ph, nach: nach.id, kennung, lagen: new Map([[nach.id, { x: 640, y: 30 }]]) });
    if (!r.ok) throw new Error(r.grund);
    expect(hauptZiel(r.fassung.knoten, raute.id)).toBeNull();
    andereGleich(f, r.fassung, new Set(hauptAusgang(f.knoten, nach.id).alle), 'Kopie');
    const kopie = r.fassung.knoten.find(k => !f.knoten.some(x => x.id === k.id))!;
    expect(kopie.pos).toEqual({ x: 640, y: 30 });
    // „Lead nachfassen“ endete (freier Ausgang) — dort durfte sie anhängen; die Ansage sagt es.
    expect(hauptZiel(r.fassung.knoten, nach.id)).toBe(kopie.id);
    expect(r.ansage).toMatch(/angehängt/);
  });
  it('ohne Wahl bzw. mit belegtem Ausgang: lose — die Ansage sagt es, kein Ausgang ändert sich', () => {
    const { f, raute } = lead();
    const a = kopieren(f, [raute.id])!;
    const ph = phasen(f)[0].id;
    const ohne = einfuegen(f, a, { phaseId: ph, kennung });
    if (!ohne.ok) throw new Error(ohne.grund);
    expect(ohne.ansage).toMatch(/lose eingefügt/);
    andereGleich(f, ohne.fassung, new Set(), 'lose');
    const start = f.knoten.find(k => k.form === 'ausloeser')!;
    const belegt = einfuegen(f, a, { phaseId: ph, nach: start.id, kennung });
    if (!belegt.ok) throw new Error(belegt.grund);
    expect(belegt.ansage).toMatch(/lose eingefügt/);
    andereGleich(f, belegt.fassung, new Set(), 'belegt');
  });
});

// ── (d) Altbestand ohne `danach` bit-gleich; das Feld selbst ────────────────────────────────────────────────────────────────────────────────────────────
describe('(d) `danach` — der festgelegte Hauptausgang; ohne Feld bit-gleich', () => {
  const ph = 'fk-00000000-0000-4000-9000-1000000000p1';
  const def = (extra: Partial<Record<string, Partial<K>>> = {}): Pick<ProzessDefinition, 'knoten'> => ({ knoten: [
    { id: 'w', titel: 'W', rang: 1 },
    { id: ph, elternId: 'w', titel: 'Eins', rang: 1 },
    { id: 'p2', elternId: 'w', titel: 'Zwei', rang: 2 },
    { id: 'st', elternId: ph, titel: 'Start', rang: 1, form: 'ausloeser', ...extra.st },
    { id: 'a', elternId: ph, titel: 'A', rang: 2, form: 'schritt', ...extra.a },
    { id: 'r', elternId: ph, titel: 'R', rang: 3, form: 'entscheidung', zweige: { nein: 's' }, ...extra.r },
    { id: 's', elternId: ph, titel: 'S', rang: 4, form: 'schritt', ...extra.s },
    { id: 'b', elternId: 'p2', titel: 'B', rang: 1, form: 'schritt', ...extra.b },
  ] as K[] });
  it('Kanten: „Lauf endet“, Ziel über Phasen, der Abzweig kehrt hinter seinen Ursprung zurück (dessen Festlegung gilt dafür nicht)', () => {
    const z = (d: Pick<ProzessDefinition, 'knoten'>) => ausgangsZiele(d);
    expect(z(def()).get('a|weiter')).toBe('r');
    expect(z(def({ a: { danach: { ende: true } } })).get('a|weiter')).toBeNull();
    expect(z(def({ a: { danach: { ziel: 'b' } } })).get('a|weiter')).toBe('b');
    expect(z(def({ r: { danach: { ende: true } } })).get('r|ja')).toBeNull();
    expect(z(def({ r: { danach: { ende: true } } })).get('s|weiter')).toBe('b');
    expect(z(def({ st: { danach: { ziel: 'r' } } })).get('st|weiter')).toBe('r');
    // Ein Sprung `zweige.ja` gewinnt vor `danach`.
    expect(z(def({ a: { zweige: { ja: 's' }, danach: { ende: true } } })).get('a|weiter')).toBe('s');
    expect(flussPruefen(def({ a: { danach: { ziel: 'b' } } })).filter(b => b.stufe === 'fehler')).toEqual([]);
  });
  it('die Prüfung: nie auf sich selbst, einen Auslöser, ein Nicht-Schritt; nie an einem Ende', () => {
    const texte = (x: Partial<K>) => flussPruefen(def({ a: x })).filter(b => b.stufe === 'fehler').map(b => b.text).join(' | ');
    expect(texte({ danach: { ziel: 'a' } })).toMatch(/auf sich selbst/);
    expect(texte({ danach: { ziel: 'st' } })).toMatch(/Auslöser/);
    expect(texte({ danach: { ziel: 'nichts' } })).toMatch(/keinen Schritt/);
    expect(texte({ form: 'ende', danach: { ende: true } })).toMatch(/keinen eigenen Ausgang/);
  });
  it('Säuberer: ohne Feld nichts (bit-gleich), mit Feld nur die zwei Formen; im Paket des Fulfillments ein Fehler; eine Kopie folgt den neuen Kennungen', () => {
    const roh = { id: 'fk-1', titel: 'A', rang: 1, form: 'schritt' };
    expect(knotenAus(roh)).not.toHaveProperty('danach');
    expect(JSON.stringify(knotenAus(roh))).toBe(JSON.stringify(knotenAus({ ...roh, danach: { quatsch: 1 } })));
    expect(knotenAus({ ...roh, danach: { ende: true } })?.danach).toEqual({ ende: true });
    expect(knotenAus({ ...roh, danach: { ziel: 'fk-2', mehr: 'x' } })?.danach).toEqual({ ziel: 'fk-2' });
    expect(fulfillmentModusBefunde({ knoten: [{ id: 'k', titel: 'K', rang: 1, danach: { ende: true } }] } as never).some(b => b.feld === 'danach')).toBe(true);
    const d = { ...def({ a: { danach: { ziel: 'b' } } }), id: 'pz-alt', art: 'paket' } as unknown as ProzessDefinition;
    const k = mitNeuenKnoten(d, { id: 'pz-neu', neu: kennung });
    expect(k.definition.knoten.find(x => x.id === k.karte.get('a'))?.danach).toEqual({ ziel: k.karte.get('b') });
  });
  it('alle Vorlagen tragen kein `danach` — ihre Kanten rechnet kantenVon wie bisher (Gold: tests/prozesse-vorlagen-gliederung.test.ts)', () => {
    for (const x of FASSUNGEN) expect(x.d.knoten.some(k => k.danach), x.name).toBe(false);
  });
});

describe('Panel › Ausgänge, Auslöser ändern, Warten, Rückgängig', () => {
  const kette = () => {
    const e = neuerProzess({ id: 'pz-00000000-0000-4000-9000-000000000003', titel: 'Panel', bereich: 'sales', fallArt: 'lead', von: 'test', jetzt: '2026-10-24T10:00:00Z', kennung });
    const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
    const a = aufgabe('A'), b = aufgabe('B'), c = aufgabe('C');
    let f = gut(anlegen({ knoten: e.entwurf.knoten }, a, { nach: start.id }));
    f = gut(anlegen(f, b, { nach: a.id }));
    f = gut(anlegen(f, c, { nach: b.id }));
    return { f, start, a, b, c };
  };
  it('„weiter“ einer Aufgabe ist wählbar: Lauf endet, ein Schritt, der nächste Schritt — die anderen bleiben', () => {
    const { f, a, b, c } = kette();
    const ende = gut(ausgangSetzen(f, a.id, 'weiter', { art: 'ende' }));
    expect(hauptZiel(ende.knoten, a.id)).toBeNull();
    andereGleich(f, ende, new Set(hauptAusgang(f.knoten, a.id).alle), 'ende');
    expect(ende.knoten.find(k => k.id === a.id)?.danach).toEqual({ ende: true });
    const zuC = gut(ausgangSetzen(f, a.id, 'weiter', { art: 'schritt', id: c.id }));
    expect(hauptZiel(zuC.knoten, a.id)).toBe(c.id);
    andereGleich(f, zuC, new Set(hauptAusgang(f.knoten, a.id).alle), 'schritt');
    const zurueck = gut(ausgangSetzen(ende, a.id, 'weiter', { art: 'naechster' }));
    expect(hauptZiel(zurueck.knoten, a.id)).toBe(b.id);
    expect(zurueck.knoten.find(k => k.id === a.id)).not.toHaveProperty('danach');
  });
  it('verbinden und umhängen (der Faden): nur dieser Ausgang ändert sich', () => {
    const { f, a, c, start } = kette();
    const v = gut(verbinden(f, start.id, 'weiter', c.id));
    expect(hauptZiel(v.knoten, start.id)).toBe(c.id);
    andereGleich(f, v, new Set(hauptAusgang(f.knoten, start.id).alle), 'verbinden');
    const k = kantenVon(f).find(x => x.von === a.id)!;
    const u = gut(umhaengen(f, k, c.id));
    expect(hauptZiel(u.knoten, a.id)).toBe(c.id);
    andereGleich(f, u, new Set(hauptAusgang(f.knoten, a.id).alle), 'umhängen');
  });
  it('ein festgelegter Ausgang auf einen gelöschten Schritt löst sich (dann gilt der Strang); vom Auslöser verbunden rückt nichts zwischen die Auslöser', () => {
    const { f, a, b, c, start } = kette();
    const fest = gut(ausgangSetzen(f, a.id, 'weiter', { art: 'schritt', id: c.id }));
    const weg = gut(loeschen(fest, [c.id]));
    expect(weg.knoten.find(k => k.id === a.id)?.danach).toBeUndefined();
    expect(flussPruefen(weg).filter(x => x.stufe === 'fehler')).toEqual([]);
    const zwei = gut(anlegen(f, neuerKnoten(katalogEintrag('ausloeser.zeitplan')!, kennung(), 'Montags'), {}));
    const v = gut(verbinden(zwei, start.id, 'weiter', c.id));
    expect(hauptZiel(v.knoten, start.id)).toBe(c.id);
    expect(flussPruefen(v).filter(x => x.stufe === 'fehler')).toEqual([]);
    andereGleich(zwei, v, new Set(hauptAusgang(zwei.knoten, start.id).alle), 'Auslöser verbunden');
    expect(hauptZiel(v.knoten, b.id)).toBe(c.id);
  });
  it('in eine andere Phase ziehen: der Weg bleibt derselbe', () => {
    const { f, b } = kette();
    const p2 = kennung();
    const g = gut(phaseNeu(f, { id: p2, titel: 'Zwei' }));
    const r = gut(inPhase(g, b.id, p2));
    andereGleich(g, r, new Set(), 'inPhase');
  });
  it('Auslöser ändern: Typ gewechselt, Kennung, Platz und Ausgang bleiben — kein zweiter Auslöser', () => {
    const { f, start, a } = kette();
    const ereignis = neuerKnoten(katalogEintrag('ausloeser.ereignis')!, 'x', 'Ereignis');
    const r = gut(ausloeserWechseln(f, start.id, ereignis, { altName: 'Von Hand' }));
    expect(r.knoten.filter(k => k.form === 'ausloeser')).toHaveLength(1);
    const neu = r.knoten.find(k => k.id === start.id)!;
    expect(neu.katalog?.id).toBe('ausloeser.ereignis');
    expect(neu.titel).toBe(start.titel === 'Von Hand' ? 'Ereignis' : start.titel);
    expect(hauptZiel(r.knoten, start.id)).toBe(a.id);
    expect(ausloeserWechseln(f, a.id, ereignis).ok).toBe(false);
  });
  it('Warten mit fester Dauer hat keinen Ausgang „abgelaufen“ (der Motor geht nach der Dauer „weiter“); Datum und Ereignis schon', () => {
    const dauer = neuerKnoten(katalogEintrag('warten.dauer')!, kennung());
    expect(ausgaengeVon(dauer)).toEqual(['weiter']);
    expect(ausgaengeVon(neuerKnoten(katalogEintrag('warten.ereignis')!, kennung()))).toContain('abgelaufen');
    expect(ausgaengeVon(neuerKnoten(katalogEintrag('warten.datum')!, kennung()))).toContain('abgelaufen');
    // Trägt ein Warten mit Dauer schon ein Ziel dort (Altbestand), bleibt der Ausgang sichtbar — zum Lösen.
    expect(ausgaengeVon({ ...dauer, zweige: { abgelaufen: 'x' } })).toContain('abgelaufen');
  });
  it('Rückgängig holt die Fassung VOR der Bau-Aktion — alle Ziele wie vorher', () => {
    const { f, a } = kette();
    const g = merke(LEERE_GESCHICHTE, f);
    const r = gut(anlegen(f, aufgabe('Zwischen'), { nach: a.id }));
    const z = rueckgaengig(g, r)!;
    expect(ausgangsZiele(z.fassung)).toEqual(ausgangsZiele(f));
  });
  it('die Oberfläche: Kopf nennt den Ausgang, Panel wählt jeden Ausgang, ⌘V an der Mausposition, Klick auf einen Anschluss wählt, Rückfrage im Mehrfach-Fenster', () => {
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain('· Ausgang „');
    expect(w).toContain('ausgangSetzen(');
    expect(w).toContain('flaeche.current?.zeiger()');
    expect(w).toContain('ausloeserWechseln(');
    expect(lies('components/os/prozesse/WerkstattPanel.tsx')).toContain('onAusgang');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('zeiger: () =>');
    expect(lies('components/os/prozesse/WerkstattMehrfach.tsx')).toContain('bestaetigen(');
    // Ein Klick (ohne Ziehen) auf einen Anschluss wählt den Knoten — die Bausteinauswahl nur über das „+“.
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('if (!z.aktiv) { p.onAuswahl([z.von]); return; }');
    // Eine Wahl zählt genau einmal; am Auslöser „Auslöser ändern …“ statt eines zweiten in eigener Bahn.
    const fa = lies('components/os/prozesse/WerkstattFormauswahl.tsx');
    expect(fa).toContain('genommen.current');
    expect(fa).toContain('sonderAuswahl(');
    expect(lies('lib/prozesse/werkstatt-maske.ts')).toContain('Auslöser ändern …');
  });
  it('⌘V-Lage: an der Mausposition in der Bahn der Kopie; liegt dort ein Knoten, rückt die Kopie in freien Platz', () => {
    const { f, b } = kette();
    const l = werkstattLage(f);
    const ph = phasen(f)[0].id;
    const kb = l.knoten.get(b.id)!;
    const k = f.knoten.find(x => x.id === b.id)!;
    // Mitten auf „B“: die Kopie liegt nicht über B.
    const auf = einfuegeLagen([k], l, [kb.x + kb.b / 2, kb.y + kb.koerper.y + kb.koerper.h / 2], ph).get(b.id)!;
    const r = l.rahmen.find(x => x.id === ph)!, bahn = l.bahnen.find(x => x.schluessel === kb.bahn)!;
    const box = { x: r.x + auf.x, y: bahn.y + auf.y };
    expect(box.y >= kb.y + kb.h || box.x >= kb.x + kb.b || box.x + kb.b <= kb.x).toBe(true);
    // Ins Leere weit rechts: genau dort (x relativ zum Rahmen).
    const frei = einfuegeLagen([k], l, [r.x + 2000, kb.y + kb.koerper.y + kb.koerper.h / 2], ph).get(b.id)!;
    expect(frei.x).toBe(Math.round(2000 - kb.b / 2));
  });
});

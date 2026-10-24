// ─── Prozesse · Überführung (22.10., Paket Ü) — die reinen Regeln: Feld am Prozess, Ablöse-Weiche, Schatten-Vergleich, Umschalten, Vorlagen, Wächter ───────
// Kein Datenordner, keine echten Daten. Geprüft:
//   · Säuberer: ohne `ersetzt` bit-gleich; nur System-Prozesse der festen Liste; Phase nur mit `ersetzt`; Unlesbares fällt weg (nie geraten)
//   · Stand eines Prozesses: ohne Überführung derselbe Wert wie vorher; der Schatten-Vergleich ändert ihn nicht (kein 409 nach jedem Morgen)
//   · Weiche: der alte Weg läuft, AUSSER aktiv + Phase scharf + im Motor scharf — und der Motor nimmt dieselbe Regel (`modusFuer`): nie beide, nie keiner
//   · Vergleich: gleich, anders (mit Feldnamen), nur alt / nur neu, zu viele; derselbe Tag vereinigt; nur Kennungen, die Zuständigkeit als Fingerabdruck
//   · Umschalten erst ab N gleichen Läufen und M Tagen (Stellschrauben, Vorgabe 5 / 3); eine Abweichung setzt zurück; zurück in den Schatten zählt neu
//   · Vorlagen gültig (fester Schritt, Auslöser wie der alte Einstiegspunkt); der feste Schritt steht nicht in der Knoten-Auswahl
//   · Wächter: jeder alte Einstiegspunkt fragt die Weiche GENAU EINMAL
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  UEBERFUEHRBAR, BILD_MAX, UMSCHALT_VORGABE, bildSchluessel, ersetzerVon, ersetztAus, istUeberfuehrbar, leererVergleich, neuerWegScharf, slotUrteil, standVonUeberfuehrung,
  ueberfuehrungAus, umschaltenPruefen, vergleichAbschliessen, vergleichMelden, wegEntscheiden, zurueckInDenSchatten, tageZwischen, ueberfuehrbarVon,
  type Ueberfuehrung, type Wirkungsbild,
} from '@/lib/prozesse/ueberfuehrung';
import { prozesseAus } from '@/lib/prozesse/bestand';
import { standVon } from '@/lib/prozesse/werkstatt-server';
import { modusFuer } from '@/lib/prozesse/lauf-server';
import { ueberfuehrungsVorlage, ueberfuehrungAnlegen } from '@/lib/prozesse/ueberfuehrung-anlegen';
import { definitionPruefen, sperrtVeroeffentlichen } from '@/lib/prozesse/definition-pruefen';
import { formauswahl } from '@/lib/prozesse/werkstatt-maske';
import { BAUSTEIN_KATALOG, katalogEintrag, katalogSelbstpruefung } from '@/lib/prozesse/baustein-katalog';
import { startKnoten, alleSchritte } from '@/lib/prozesse/fluss';
import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { WERTE, umschaltRegel } from '@/lib/prozesse/stellschrauben-werte';
import type { ProzessEintrag, ProzessStatus } from '@/lib/prozesse/definition';
import type { ProzessLaufStand } from '@/lib/prozesse/lauf-typen';
import { definition, J, PZ, PZ2 } from './fixtures/prozess-bau';

const eintrag = (id: string, status: ProzessStatus, extra: Partial<ProzessEintrag> = {}): ProzessEintrag => ({
  id, entwurf: { ...definition([]), id }, versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...definition([]), id } }], status,
  angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia', ...extra,
});
const ue = (phase: 'schatten' | 'scharf', v = leererVergleich()): Ueberfuehrung => ({ phase, seit: J, vergleich: v });
const scharfStand: ProzessLaufStand = { einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 0, schaetzungCent: 0, bestehende: 'nur-neue', bestehendeAnzahl: 0 } }, verlauf: [] };
const bild = (n: number, x: Partial<Wirkungsbild> = {}): Wirkungsbild[] => Array.from({ length: n }, (_, i) => ({ art: 'aufgabe', ziel: `mahn-r${i}-1`, tag: '2026-10-22', zustaendig: 'both', ...x }));

describe('Feld am Prozess (Säuberer) und Stand', () => {
  it('ohne `ersetzt` bit-gleich: dieselbe Datei wie vorher, derselbe Stand', () => {
    const roh = { v: 1, prozesse: [eintrag(PZ, 'aktiv')] };
    const d = prozesseAus(JSON.parse(JSON.stringify(roh)));
    expect(JSON.stringify(d)).toBe(JSON.stringify(prozesseAus(roh)));
    expect('ersetzt' in d.prozesse[0]).toBe(false);
    expect('ueberfuehrung' in d.prozesse[0]).toBe(false);
  });
  it('nur System-Prozesse der festen Liste; die Phase nur mit `ersetzt`; Unlesbares fällt weg', () => {
    expect(ersetztAus('sp-rechnung')).toBe('sp-rechnung');
    expect(ersetztAus('sp-bauplan')).toBeUndefined();
    expect(ersetztAus('<script>')).toBeUndefined();
    const d = prozesseAus({ v: 1, prozesse: [
      { ...eintrag(PZ, 'probelauf'), ersetzt: 'sp-rechnung', ueberfuehrung: { phase: 'schatten', seit: J, vergleich: { laeufe: 3, gleich: 2, abweichend: 1, gleichLaeufe: -4, offen: { tag: '2026-10-22', alt: ['aufgabe|mahn-r1-1|2026-10-22|abcdef01', 'kaputt'] }, letzte: { tag: 'gestern', grund: 'x' } } } },
      { ...eintrag(PZ2, 'probelauf'), ueberfuehrung: { phase: 'schatten', seit: J, vergleich: {} } },
    ] });
    expect(d.prozesse[0].ersetzt).toBe('sp-rechnung');
    expect(d.prozesse[0].ueberfuehrung).toEqual({ phase: 'schatten', seit: J, vergleich: { laeufe: 3, gleich: 2, abweichend: 1, gleichLaeufe: 0, offen: { tag: '2026-10-22', alt: ['aufgabe|mahn-r1-1|2026-10-22|abcdef01'] } } });
    expect('ueberfuehrung' in d.prozesse[1]).toBe(false);
    expect(ueberfuehrungAus({ phase: 'irgendwas', seit: J })).toBeUndefined();
  });
  it('der Stand übergeht den Schatten-Vergleich (den schreibt der Morgen) — die Phase zählt', () => {
    const a = eintrag(PZ, 'probelauf', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('schatten') });
    const b = { ...a, ueberfuehrung: ue('schatten', vergleichMelden(leererVergleich(), 'alt', '2026-10-22', bild(2))) };
    expect(standVon(b)).toBe(standVon(a));
    expect(standVon({ ...a, ueberfuehrung: ue('scharf') })).not.toBe(standVon(a));
    // Ohne Überführung: genau der bisherige Fingerabdruck.
    const ohne = eintrag(PZ, 'aktiv');
    expect(standVon(ohne)).toBe(standVon(JSON.parse(JSON.stringify(ohne))));
  });
});

describe('Ablöse-Weiche: nie beide, nie keiner', () => {
  const faelle: [string, ProzessEintrag | null, boolean, 'alt' | 'neu', boolean][] = [
    ['kein ersetzender Prozess', null, false, 'alt', false],
    ['Probelauf (Schatten)', eintrag(PZ, 'probelauf', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('schatten') }), false, 'alt', true],
    ['aktiv, Phase Schatten, im Motor scharf', eintrag(PZ, 'aktiv', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('schatten') }), true, 'alt', true],
    ['aktiv, Phase scharf, im Motor scharf', eintrag(PZ, 'aktiv', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true, 'neu', false],
    ['aktiv, Phase scharf, im Motor NICHT scharf', eintrag(PZ, 'aktiv', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), false, 'alt', false],
    ['angehalten (pausiert), Phase scharf', eintrag(PZ, 'pausiert', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true, 'alt', false],
    ['angehalten im Schatten (vergleicht nicht)', eintrag(PZ, 'pausiert', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('schatten') }), true, 'alt', false],
    ['Entwurf', eintrag(PZ, 'entwurf', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true, 'alt', false],
    ['archiviert', eintrag(PZ, 'archiviert', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true, 'alt', false],
    ['ersetzt etwas anderes', eintrag(PZ, 'aktiv', { ersetzt: 'sp-treppe', ueberfuehrung: ue('scharf') }), true, 'alt', false],
  ];
  for (const [name, e, motor, weg, schatten] of faelle) {
    it(name, () => {
      const w = wegEntscheiden(e ? [e] : [], 'sp-rechnung', () => motor);
      expect(w.weg).toBe(weg);
      expect(w.schatten).toBe(schatten);
      // Der Motor nimmt dieselbe Regel: scharf genau dann, wenn die Weiche den neuen Weg wählt.
      if (e && e.ersetzt === 'sp-rechnung') expect(modusFuer(e, motor ? scharfStand : undefined) === 'scharf').toBe(weg === 'neu');
    });
  }
  it('ohne Überführung rechnet der Motor wie vorher', () => {
    expect(modusFuer(eintrag(PZ, 'aktiv'), scharfStand)).toBe('scharf');
    expect(modusFuer(eintrag(PZ, 'aktiv'), undefined)).toBe('schatten');
    expect(modusFuer(eintrag(PZ, 'probelauf'), scharfStand)).toBe('schatten');
    expect(modusFuer(eintrag(PZ, 'pausiert'), scharfStand)).toBeNull();
  });
  it('ein Archivierter ersetzt nichts mehr (eine neue Überführung geht dann)', () => {
    expect(ersetzerVon([eintrag(PZ, 'archiviert', { ersetzt: 'sp-rechnung' })], 'sp-rechnung')).toBeNull();
    expect(neuerWegScharf(null, true)).toBe(false);
  });
  it('Stand für Kachel und Steckbrief', () => {
    expect(standVonUeberfuehrung(null, false)).toBe('moeglich');
    expect(standVonUeberfuehrung(eintrag(PZ, 'probelauf', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('schatten') }), false)).toBe('schatten');
    expect(standVonUeberfuehrung(eintrag(PZ, 'aktiv', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true)).toBe('scharf');
    expect(standVonUeberfuehrung(eintrag(PZ, 'pausiert', { ersetzt: 'sp-rechnung', ueberfuehrung: ue('scharf') }), true)).toBe('angehalten');
  });
});

describe('Schatten-Vergleich (rein)', () => {
  it('nur Kennungen: die Zuständigkeit steht als Fingerabdruck, nie als Name', () => {
    const s = bildSchluessel({ art: 'vorschlag', ziel: 'report:m1', tag: '2026-10-22', zustaendig: 'pia' });
    expect(s).toMatch(/^vorschlag\|report:m1\|2026-10-22\|[0-9a-f]{8}$/);
    expect(s).not.toContain('pia');
  });
  it('beide Wege gleich → zählt erst, wenn der Tag vorbei ist; derselbe Tag wird vereinigt', () => {
    let v = vergleichMelden(leererVergleich(), 'alt', '2026-10-22', bild(1));
    v = vergleichMelden(v, 'alt', '2026-10-22', bild(2));
    v = vergleichMelden(v, 'neu', '2026-10-22', bild(2));
    expect(v.laeufe).toBe(0);
    expect(v.offen?.alt).toHaveLength(2);
    v = vergleichAbschliessen(v, '2026-10-23');
    expect(v).toMatchObject({ laeufe: 1, gleich: 1, abweichend: 0, gleichLaeufe: 1, gleichSeit: '2026-10-22' });
    expect(v.offen).toBeUndefined();
  });
  it('ein neuer Tag schließt den alten ab; leer gegen leer ist gleich', () => {
    let v = vergleichMelden(leererVergleich(), 'alt', '2026-10-20', []);
    v = vergleichMelden(v, 'neu', '2026-10-20', []);
    v = vergleichMelden(v, 'alt', '2026-10-21', bild(1));
    expect(v).toMatchObject({ laeufe: 1, gleich: 1, offen: { tag: '2026-10-21' } });
  });
  it('nur ein Weg an einem Tag → Abweichung „nur alt“ bzw. „nur neu“ mit den Kennungen; die Folge beginnt neu', () => {
    let v = vergleichAbschliessen(vergleichMelden(vergleichMelden(leererVergleich(), 'alt', '2026-10-20', []), 'neu', '2026-10-20', []), '2026-10-21');
    expect(v.gleichLaeufe).toBe(1);
    v = vergleichAbschliessen(vergleichMelden(v, 'alt', '2026-10-21', bild(1)), '2026-10-22');
    expect(v).toMatchObject({ laeufe: 2, abweichend: 1, gleichLaeufe: 0, letzte: { tag: '2026-10-21', grund: 'nur-alt', kennungen: ['mahn-r0-1'] } });
    expect(v.gleichSeit).toBeUndefined();
    // Paket Ü 2: meldet nur EIN Weg und hat er nichts bewirkt, war es keine Gelegenheit (zählt nicht).
    v = vergleichAbschliessen(vergleichMelden(v, 'neu', '2026-10-22', []), '2026-10-23');
    expect(v).toMatchObject({ laeufe: 2, abweichend: 1, letzte: { tag: '2026-10-21', grund: 'nur-alt' } });
    v = vergleichAbschliessen(vergleichMelden(v, 'neu', '2026-10-23', bild(1)), '2026-10-24');
    expect(v).toMatchObject({ laeufe: 3, abweichend: 2, letzte: { tag: '2026-10-23', grund: 'nur-neu', kennungen: ['mahn-r0-1'] } });
  });
  it('anders: dieselbe Kennung mit anderem Tag bzw. anderer Zuständigkeit (Feldnamen), Kennungen nur auf einer Seite', () => {
    expect(slotUrteil({ tag: 't', alt: bild(1).map(bildSchluessel), neu: bild(1, { zustaendig: 'pia' }).map(bildSchluessel) })).toEqual({ gleich: false, abweichung: { tag: 't', grund: 'anders', kennungen: ['mahn-r0-1'], felder: ['zustaendig'] } });
    expect(slotUrteil({ tag: 't', alt: bild(2).map(bildSchluessel), neu: bild(1, { tag: '2026-10-23' }).map(bildSchluessel) })).toMatchObject({ abweichung: { grund: 'anders', felder: ['tag'] } });
    expect(slotUrteil({ tag: 't', alt: bild(2).map(bildSchluessel), neu: bild(1).map(bildSchluessel) })).toEqual({ gleich: false, abweichung: { tag: 't', grund: 'anders', kennungen: ['mahn-r1-1'] } });
  });
  it('zu viele Wirkungen zum Vergleichen → Abweichung (nie still gekürzt verglichen)', () => {
    let v = vergleichMelden(leererVergleich(), 'alt', '2026-10-22', bild(BILD_MAX + 5));
    v = vergleichMelden(v, 'neu', '2026-10-22', bild(BILD_MAX + 5));
    expect(vergleichAbschliessen(v, '2026-10-23').letzte?.grund).toBe('zu-viele');
  });
});

describe('Umschalten: erst ab N gleichen Läufen und M Tagen — nur per Klick', () => {
  const gleicheTage = (n: number, ab = '2026-10-10') => {
    let v = leererVergleich();
    for (let i = 0; i < n; i++) { const t = `2026-10-${String(Number(ab.slice(8)) + i).padStart(2, '0')}`; v = vergleichMelden(vergleichMelden(v, 'alt', t, bild(1)), 'neu', t, bild(1)); }
    return v;
  };
  it('Vorgabe 5 Läufe / 3 Tage (Stellschrauben); ein Lauf zu wenig → nein mit Grund', () => {
    expect(UMSCHALT_VORGABE).toEqual({ laeufe: 5, tage: 3 });
    expect(umschaltRegel({})).toEqual(UMSCHALT_VORGABE);
    expect(umschaltRegel({ 'ueberfuehrung.laeufe': 2, 'ueberfuehrung.tage': 1 })).toEqual({ laeufe: 2, tage: 1 });
    expect(WERTE.filter(w => w.id.startsWith('ueberfuehrung.')).map(w => [w.id, w.vorgabe])).toEqual([['ueberfuehrung.laeufe', 5], ['ueberfuehrung.tage', 3]]);
    const vier = umschaltenPruefen(ue('schatten', gleicheTage(4)), UMSCHALT_VORGABE, '2026-10-14');
    expect(vier).toMatchObject({ erlaubt: false, laeufe: 4 });
    expect(vier.grund).toMatch(/noch 1 gleicher Lauf/);
    expect(umschaltenPruefen(ue('schatten', gleicheTage(5)), UMSCHALT_VORGABE, '2026-10-15')).toMatchObject({ erlaubt: true, laeufe: 5, tage: 5 });
  });
  it('die offene Gelegenheit von gestern zählt mit (abgeschlossen bei heute); eine Abweichung setzt zurück', () => {
    const v = gleicheTage(5);
    expect(umschaltenPruefen(ue('schatten', v), UMSCHALT_VORGABE, '2026-10-14').erlaubt).toBe(false); // der 14. ist noch offen
    const ab = vergleichMelden(v, 'alt', '2026-10-15', bild(1));
    expect(umschaltenPruefen(ue('schatten', ab), UMSCHALT_VORGABE, '2026-10-16')).toMatchObject({ erlaubt: false, laeufe: 0 });
  });
  it('schon scharf → nein; zurück in den Schatten zählt neu (die Summen bleiben)', () => {
    expect(umschaltenPruefen(ue('scharf', gleicheTage(9)), UMSCHALT_VORGABE, '2026-10-30').erlaubt).toBe(false);
    const z = zurueckInDenSchatten({ ...ue('scharf', vergleichAbschliessen(gleicheTage(6), '2026-10-30')), umgeschaltetAm: J, umgeschaltetVon: 'pia' });
    expect(z).toMatchObject({ phase: 'schatten', vergleich: { laeufe: 6, gleich: 6, gleichLaeufe: 0 } });
    expect(z.umgeschaltetVon).toBeUndefined();
    expect(z.vergleich.gleichSeit).toBeUndefined();
    expect(tageZwischen('2026-10-25', '2026-10-27')).toBe(2);
  });
});

describe('Vorlagen, Baustein, feste Liste', () => {
  it('jeder Teil gehört zu einem System-Prozess des Registers; Kennungen eindeutig', () => {
    const ids = new Set(SYSTEM_PROZESSE.map(p => p.id));
    for (const u of UEBERFUEHRBAR) expect(ids.has(u.sp), u.sp).toBe(true);
    expect(new Set(UEBERFUEHRBAR.map(u => u.sp)).size).toBe(UEBERFUEHRBAR.length);
    expect(istUeberfuehrbar('sp-rechnung')).toBe(true);
    expect(ueberfuehrbarVon('sp-head-takt')).toBeNull();
    expect(ueberfuehrbarVon('sp-followup')).toMatchObject({ schritt: 'power-hour', einstieg: { datei: 'lib/heads/takt.ts', funktion: 'headsFaellig' } });
  });
  it('jede Vorlage ist veröffentlichbar: Auslöser wie der alte Einstieg („nach dem Morgen-Loop“ bzw. je Person ab der Uhrzeit der Power Hour), der feste Schritt, Ziel', () => {
    for (const u of UEBERFUEHRBAR) {
      const d = ueberfuehrungsVorlage(u);
      const b = definitionPruefen(d, {});
      expect(sperrtVeroeffentlichen(b), `${u.sp}: ${JSON.stringify(b)}`).toBe(false);
      const START: Record<string, unknown[]> = {
        'power-hour': [{ art: 'person', uhrzeit: '07:00', bis: '22:00', tage: 'mo-fr', nachMorgenlauf: true, stundeAus: 'head.sales.power_hour.stunde' }],
        // Ausbau (Paket Ü 2): der Kern nach dem Morgen-Loop, dazu (neu) „Deal gewonnen“ für den Rest der Übergabe.
        'fall-vorschlag': [{ art: 'loop', loop: 'morgen' }, { art: 'ereignis', ereignis: 'deal-stufe', bedingungen: [{ feld: 'ereignis.stufe', op: 'gleich', wert: 'gewonnen' }] }],
        'nachfass-lage': [{ art: 'datum', feld: 'event.datum', versatzTage: 1, uhrzeit: '08:00', bedingungen: [{ feld: 'event.besucht', op: 'gleich', wert: true }, { feld: 'event.status', op: 'ungleich', wert: 'abgesagt' }] }],
      };
      expect(startKnoten(d).map(s => s.ausloeser)).toEqual(START[u.schritt] ?? [{ art: 'loop', loop: 'morgen' }]);
      expect(alleSchritte(d).filter(x => x.schritt.katalog?.id === 'system.fest').map(x => x.schritt.katalog?.werte?.schritt)).toEqual([u.schritt, ...(u.zusatz?.schritte ?? [])]);
    }
  });
  it('der feste Schritt steht nicht in der Knoten-Auswahl, der Katalog bleibt in sich stimmig', () => {
    expect(katalogEintrag('system.fest')).toMatchObject({ nurUeberfuehrung: true, rechte: 'intern' });
    expect(formauswahl(BAUSTEIN_KATALOG).some(e => e.id === 'system.fest')).toBe(false);
    expect(formauswahl(BAUSTEIN_KATALOG, { suche: 'Fester Schritt' })).toEqual([]);
    expect(katalogSelbstpruefung()).toEqual([]);
  });
  it('überführen (rein): nur volle Mitglieder, höchstens einer je System-Prozess, sonst Version 1 im Probelauf mit Phase Schatten', () => {
    const rechte = { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true };
    let n = 0;
    const kx = { person: 'pia', jetzt: J, rechte, neueKennung: (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, eigner: 'konto-pia' };
    expect(ueberfuehrungAnlegen({ v: 1, prozesse: [] }, 'sp-rechnung', { ...kx, rechte: { ...rechte, status: false } })).toMatchObject({ ok: false, status: 403 });
    expect(ueberfuehrungAnlegen({ v: 1, prozesse: [] }, 'sp-bauplan', kx)).toMatchObject({ ok: false, status: 404 });
    const r = ueberfuehrungAnlegen({ v: 1, prozesse: [] }, 'sp-rechnung', kx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.eintrag).toMatchObject({ status: 'probelauf', ersetzt: 'sp-rechnung', ueberfuehrung: { phase: 'schatten', seit: J, vergleich: leererVergleich() } });
    expect(r.eintrag.versionen).toHaveLength(1);
    expect(r.eintrag.entwurf.eigner).toBe('konto-pia');
    expect(ueberfuehrungAnlegen(r.datei, 'sp-rechnung', kx)).toMatchObject({ ok: false, status: 409, prozessId: r.eintrag.id });
    expect(ueberfuehrungAnlegen(r.datei, 'sp-treppe', kx).ok).toBe(true);
  });
});

describe('Wächter: jeder alte Einstiegspunkt fragt die Weiche genau einmal', () => {
  for (const u of UEBERFUEHRBAR) {
    it(`${u.einstieg.datei} \`${u.einstieg.funktion}\``, () => {
      const quelle = readFileSync(path.join(process.cwd(), u.einstieg.datei), 'utf8');
      const ab = quelle.indexOf(`export async function ${u.einstieg.funktion}(`);
      expect(ab, 'Einstiegspunkt gibt es').toBeGreaterThan(-1);
      const rest = quelle.slice(ab + 10);
      const ende = rest.search(/\nexport /);
      const rumpf = rest.slice(0, ende < 0 ? undefined : ende);
      expect(rumpf.match(/wegFuer\(/g)?.length, 'genau eine Frage an die Weiche').toBe(1);
      expect(rumpf).toContain(`wegFuer('${u.sp}')`);
    });
  }
  it('der Kern des alten Wegs ist der Kern des festen Schritts (Kennungs-Brücke: dieselbe Funktion)', () => {
    const s = readFileSync(path.join(process.cwd(), 'lib/prozesse/system-schritte-server.ts'), 'utf8');
    expect(s).toContain('mahnAufgabenKern(');
    expect(s).toContain('treppeReportsKern(');
    expect(s).toContain('onboardingVorschlaegeKern(');
    expect(s).toContain('powerHourKern(');
    // Event-Nachfassen (Paket Ü 2): der Kern ist die Rechnung der Glocke (`dankeAnstehend`), der alte Einstieg hängt im Morgenlauf.
    expect(s).toContain('nachfassLageBild(');
    expect(s).toContain('nachfassFollowupsKern(');
    expect(readFileSync(path.join(process.cwd(), 'lib/crm/nachfassen-server.ts'), 'utf8')).toContain('dankeAnstehend(crm, kontakte, heute, p)');
    expect(readFileSync(path.join(process.cwd(), 'app/api/tagesstart/route.ts'), 'utf8')).toContain('nachfassLageMorgenlauf(today)');
    // Power Hour (Paket Ü 2): derselbe Auftrag aus EINER Funktion für den Takt der Heads und den festen Schritt.
    const ht = readFileSync(path.join(process.cwd(), 'lib/heads/takt.ts'), 'utf8');
    expect(ht).toMatch(/headsFaellig[\s\S]*powerHourFaellig\(m\.person\)/);
    expect(ht).toMatch(/export async function powerHourKern[\s\S]*powerHourFaellig\(person\)/);
    expect(readFileSync(path.join(process.cwd(), 'lib/finanzen/rechnung/server.ts'), 'utf8')).toMatch(/mahnAufgabenNachziehen[\s\S]*mahnAufgabenKern\(heute/);
  });
});

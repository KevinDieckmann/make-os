// Lieferzeit ab einem Ereignis (26.10.): ein Schritt trägt `lieferzeit` (Werktage) — erst wenn er erledigt ist (Entscheidung: „ja“), läuft die Lieferzeit.
// Verspätung (Formular kommt später) verschiebt das Datum von selbst; Mails nennen es über {{fall.lieferdatum}}; Editor und Import nehmen das Feld.
import { describe, it, expect } from 'vitest';
import { lieferStand, lieferStaende, lieferSatz, werktageBis } from '@/lib/fulfillment/prozesse/lieferzeit';
import { nachrichtEntwurf } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { editorAnwenden } from '@/lib/fulfillment/prozesse/editor';
import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { importLesen } from '@/lib/fulfillment/prozesse/import';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { paketAnsicht, paketKnotenZeilen } from '@/lib/prozesse/fulfillment-modus';
import type { FallKnoten, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-26T08:00:00.000Z';
const kn = (x: Partial<FallKnoten> & { id: string }): FallKnoten => ({ titel: x.id, rang: 1, status: 'offen', ...x });

describe('lieferStand (rein)', () => {
  it('ohne Lieferzeit im Ablauf: null', () => {
    expect(lieferStand({ knoten: [kn({ id: 'a' }), kn({ id: 'b', frist: 2 })] })).toBeNull();
  });
  it('offen: Werktage bekannt, kein Datum', () => {
    const s = lieferStand({ knoten: [kn({ id: 'f', titel: 'Formular vollständig?', form: 'entscheidung', lieferzeit: 10 })] })!;
    expect(s).toEqual({ knotenId: 'f', titel: 'Formular vollständig?', werktage: 10 });
    expect(lieferSatz(s, '2026-10-26', t => t)).toBe('Lieferzeit 10 Werktage — startet mit „Formular vollständig?“');
  });
  it('Entscheidung mit „ja“: 10 Werktage ab dem Tag — über Wochenenden und Allerheiligen (NRW)', () => {
    // Mo 26.10.2026 + 10 Werktage: 27–30.10. (4), 2.–6.11. (5, 1.11. ist Sonntag), 9.11. (1) → 9.11.
    const s = lieferStand({ knoten: [kn({ id: 'f', form: 'entscheidung', lieferzeit: 10, status: 'erledigt', erledigtAm: '2026-10-26', antwort: 'ja', antwortAm: '2026-10-26' })] })!;
    expect(s.startAm).toBe('2026-10-26');
    expect(s.bisAm).toBe('2026-11-09');
    expect(lieferSatz(s, '2026-10-26', t => t)).toBe('Lieferung bis 2026-11-09 · noch 10 Werktage');
    expect(lieferSatz(s, '2026-11-09', t => t)).toBe('Lieferung bis 2026-11-09 · heute');
    expect(lieferSatz(s, '2026-11-10', t => t)).toBe('Lieferung bis 2026-11-09 · 1 Werktag drüber');
  });
  it('Verspätung verschiebt ohne Handarbeit: Formular eine Woche später → Lieferung eine Woche später', () => {
    const a = lieferStand({ knoten: [kn({ id: 'f', lieferzeit: 5, status: 'erledigt', erledigtAm: '2026-11-02' })] })!;
    const b = lieferStand({ knoten: [kn({ id: 'f', lieferzeit: 5, status: 'erledigt', erledigtAm: '2026-11-09' })] })!;
    expect(a.bisAm).toBe('2026-11-09');
    expect(b.bisAm).toBe('2026-11-16');
  });
  it('„nein“ startet nichts, entfallene und Bausteine zählen nicht; Paket vor Zusatzmodul', () => {
    expect(lieferStand({ knoten: [kn({ id: 'f', form: 'entscheidung', lieferzeit: 3, status: 'erledigt', erledigtAm: '2026-10-26', antwort: 'nein' })] })!.bisAm).toBeUndefined();
    expect(lieferStand({ knoten: [kn({ id: 'f', lieferzeit: 3, status: 'entfaellt' })] })).toBeNull();
    expect(lieferStand({ knoten: [kn({ id: 'b', bausteinId: 'fb-x', lieferzeit: 3 })] })).toBeNull();
    expect(lieferStaende({ knoten: [kn({ id: 'p', lieferzeit: 10 }), kn({ id: 'z', lieferzeit: 3 })] }).map(s => s.knotenId)).toEqual(['p', 'z']);
  });
  it('werktageBis zählt Werktage in beide Richtungen', () => {
    expect(werktageBis('2026-10-30', '2026-11-02')).toBe(1);   // Fr → Mo
    expect(werktageBis('2026-10-31', '2026-11-02')).toBe(1);   // Sa → Mo
    expect(werktageBis('2026-11-02', '2026-10-30')).toBe(-1);
    expect(werktageBis('2026-11-02', '2026-11-02')).toBe(0);
  });
});

describe('Mail-Platzhalter {{fall.lieferdatum}} und {{fall.lieferzeit}}', () => {
  const vorlage = 'Betreff: Alles da\n\n{{kontakt.gruss}},\n\ndamit beginnt heute die Lieferzeit ({{fall.lieferzeit}}).\nGeplante Lieferung: {{fall.lieferdatum}}\nLang: {{fall.lieferdatum | datum-lang}}';
  it('mit gestarteter Lieferzeit: Datum und Werktage gefüllt', () => {
    const m = nachrichtEntwurf(vorlage, { anrede: 'Sie', vorname: 'Erika', nachname: 'Beispiel', lieferzeit: 10, lieferdatum: '2026-11-09' }, 'x');
    expect(m.text).toContain('Lieferzeit (10 Werktage)');
    expect(m.text).toContain('Geplante Lieferung: 09.11.2026');
    expect(m.text).not.toContain('{{');
  });
  it('ohne Lieferzeit: der Platzhalter bleibt sichtbar stehen (der Mensch sieht es vor dem Senden)', () => {
    const m = nachrichtEntwurf(vorlage, { anrede: 'Sie' }, 'x');
    expect(m.text).toContain('{{fall.lieferdatum}}');
    expect(m.text).toContain('{{fall.lieferzeit}}');
  });
});

describe('Editor und Import nehmen „Lieferzeit startet hier“', () => {
  const v: ProzessVorlage = {
    id: 'fp-lz', art: 'paket', titel: 'Testpaket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], freigaben: [],
    knoten: [
      { id: 'fk-w', titel: 'Testpaket', rang: 1 },
      { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1 },
      { id: 'fk-a', elternId: 'fk-p1', titel: 'Formular vollständig?', rang: 1, form: 'entscheidung' },
    ],
  };
  const datei = (): VorlagenDatei => vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [v] })));
  const tun = (d: VorlagenDatei, ops: unknown[]) => {
    const st = fingerabdruck(d.prozesse.find(p => p.id === 'fp-lz')! as unknown as Record<string, unknown>);
    return editorAnwenden(d, { vorlageId: 'fp-lz', stand: st, ops }, { person: 'pia', jetzt: J, standVon: x => fingerabdruck(x as Record<string, unknown>), neueId: p => `${p}-lz` });
  };
  it('setzen, im Panel zeigen, leeren; ungültig → abgelehnt, nichts gespeichert', () => {
    let d = datei();
    const r = tun(d, [{ op: 'schritt', id: 'fk-a', lieferzeit: 10 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d = vorlagenAus(JSON.parse(JSON.stringify(r.datei)));
    const k = d.prozesse[0].knoten.find(x => x.id === 'fk-a')!;
    expect(k.lieferzeit).toBe(10);
    const info = paketAnsicht(d.prozesse[0]).info['fk-a'];
    expect(info.lieferzeit).toBe(10);
    expect(paketKnotenZeilen(info)).toContainEqual({ name: 'Lieferzeit', wert: 'startet hier: 10 Werktage' });
    for (const falsch of [0, 251, 2.5, 'zehn']) expect(tun(d, [{ op: 'schritt', id: 'fk-a', lieferzeit: falsch }]).ok).toBe(false);
    const leer = tun(d, [{ op: 'schritt', id: 'fk-a', lieferzeit: null }]);
    expect(leer.ok && leer.datei.prozesse[0].knoten.find(x => x.id === 'fk-a')!.lieferzeit).toBeUndefined();
  });
  it('Säuberer verwirft Unsinn beim Lesen', () => {
    const d = vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [{ ...v, knoten: v.knoten.map(k => (k.id === 'fk-a' ? { ...k, lieferzeit: 999 } : k)) }] })));
    expect(d.prozesse[0].knoten.find(x => x.id === 'fk-a')!.lieferzeit).toBeUndefined();
  });
  it('Import: Schritt mit `lieferzeit` kommt an, ungültig blockiert die Datei', () => {
    const paket = (lz: unknown) => ({ format: 'make-os/pakete', pakete: [{ titel: 'Probe', phasen: [{ id: 'p1', titel: 'Start', fluss: [{ id: 's1', titel: 'Formular vollständig?', form: 'entscheidung', lieferzeit: lz }, { id: 's2', titel: 'Weiter' }] }] }] });
    const gut = importLesen(paket(15));
    expect(gut.blockiert).toBeFalsy();
    expect(gut.pakete).toHaveLength(1);
    expect(gut.pakete[0].v.knoten.find(k => k.titel === 'Formular vollständig?')!.lieferzeit).toBe(15);
    for (const falsch of [0, 3.5, 'zehn']) { const r = importLesen(paket(falsch)); expect(r.pakete).toHaveLength(0); expect(r.fehler.join(' ')).toContain('Lieferzeit'); }
  });
});


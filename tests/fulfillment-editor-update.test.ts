// ─── Fulfillment · Prozess-Editor — Update-Probe mit Altbestand (17.10.) ───────────────────────────────────────────────────────────────────
// Live-Daten bleiben erhalten (CLAUDE.md › Live-Daten erhalten): Vorlagen und Fälle, wie die Online-Fassung sie schreibt (ohne `form`, `frist`, `zweige`,
// `papierkorb`), laufen durch die neuen Säuberer und einen Schreibweg — die Vergleichs-Logik der Update-Probe (lib/betrieb/update-probe.ts
// `vergleicheBestand`) findet keinen Verlust. Dazu: der Editor hält jede Kennung (gelöscht = im Papierkorb), und die Übernahme in einen laufenden Fall
// verliert keine Kennung, keinen Stand, keinen Zusatz-Schritt. Erfundene Daten, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { leerVorlagen, vorlagenAus, faelleAus } from '@/lib/fulfillment/lesen';
import { vorlagenAnwenden, type VorlagenKontext } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { editorAnwenden, type EditorOp } from '@/lib/fulfillment/prozesse/editor';
import { fallStarten, fallAnwenden, vorlageUebernehmen, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { vergleicheBestand } from '@/lib/betrieb/update-probe';
import { MUSTER_P1 } from '@/lib/fulfillment/muster';
import type { Fall, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-17T09:00:00.000Z';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const vk: VorlagenKontext = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: stand, neueId: p => `${p}-u${++N}` };
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ok = <D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };
const roh = <T>(x: T): unknown => JSON.parse(JSON.stringify(x));

/** Der Altbestand: Muster + ein Baustein am Schritt „Dossier“ (Ebene 4/5) — so, wie die Online-Fassung speichert. */
function altbestand(): VorlagenDatei {
  let d = ok(vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], vk));
  // Die Online-Fassung kannte keine Formen/Fristen — seit 17.10. tragen die Muster-Schritte sie; für den Altbestand fallen sie weg.
  d = { ...d, prozesse: d.prozesse.map(p => ({ ...p, knoten: p.knoten.map(({ form: _f, frist: _r, ...k }) => k) })) };
  d = ok(vorlagenAnwenden(d, [{ op: 'baustein', eintrag: { art: 'mail', titel: 'Begrüßung' } }], vk));
  const p1 = d.prozesse.find(p => p.titel === MUSTER_P1.titel)!;
  const dossier = p1.knoten.find(x => x.titel === 'Dossier')!;
  d = ok(vorlagenAnwenden(d, [{ op: 'knoten', vorlageId: p1.id, eintrag: { elternId: dossier.id, titel: 'Quellen sammeln', zustaendig: 'intern' } }], vk));
  const schritt = d.prozesse.find(p => p.id === p1.id)!.knoten.find(x => x.titel === 'Quellen sammeln')!;
  return ok(vorlagenAnwenden(d, [{ op: 'knoten', vorlageId: p1.id, eintrag: { elternId: schritt.id, bausteinId: d.bausteine[d.bausteine.length - 1].id, titel: 'Begrüßung' } }], vk));
}

describe('Update-Probe: Altbestand verlustfrei', () => {
  it('Vorlagen der Online-Fassung: lesen und schreiben (andere Op) → kein Verlust', () => {
    const alt = roh(altbestand());
    expect(JSON.stringify(alt)).not.toMatch(/"form"|"frist"|"zweige"|"papierkorb"/);
    const gelesen = vorlagenAus(alt);
    expect(vergleicheBestand('fulfillment--h', alt, roh(gelesen)).abweichungen).toEqual([]);
    const geschrieben = ok(vorlagenAnwenden(gelesen, [{ op: 'einstellungen', felder: { willkommenStunden: 48 } }], vk));
    const a = vergleicheBestand('fulfillment--h', alt, roh(geschrieben)).abweichungen.filter(x => !x.pfad.startsWith('einstellungen'));
    expect(a).toEqual([]);
  });
  it('Fälle der Online-Fassung: lesen → kein Verlust', () => {
    const d = altbestand();
    const fall = fallStarten({ mandatId: 'm-1', vorlage: d.prozesse.find(p => p.titel === MUSTER_P1.titel)!, person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-u${++N}` });
    const alt = roh({ version: 1, faelle: { 'm-1': fall } });
    expect(vergleicheBestand('fulfillment-faelle--h', alt, roh(faelleAus(alt))).abweichungen).toEqual([]);
  });
});

describe('Der Editor verliert nichts', () => {
  it('jede Kennung bleibt — in der Vorlage oder im Papierkorb; jedes Feld der übrigen Knoten bleibt', () => {
    const d0 = vorlagenAus(roh(altbestand()));
    const p1 = d0.prozesse.find(p => p.titel === MUSTER_P1.titel)!;
    const ph = (t: string) => p1.knoten.find(x => x.titel === t)!.id;
    const ops: EditorOp[] = [
      { op: 'schritt-neu', id: u(1), ziel: { phaseId: ph('Analyse'), anfang: true }, form: 'nachricht', titel: 'Fragen senden', frist: 3 },
      { op: 'baustein-dazu', id: u(2), schrittId: ph('Analyse-Umfang'), bausteinId: d0.bausteine.at(-1)!.id },
      { op: 'schritt-schieben', id: ph('Quick Wins'), ziel: { phaseId: ph('Aufbau'), anfang: true } },
      { op: 'schritt', id: ph('CRM'), form: 'entscheidung', titel: 'CRM vorhanden?' },
      { op: 'nein-erinnerung', id: u(3), entscheidungId: ph('CRM') },
      { op: 'abstimmung', phaseId: ph('Führung'), an: true },
      { op: 'weg', id: ph('Skripte') },
      { op: 'phase-neu', id: u(4), titel: 'Nachbetreuung' },
    ];
    const r = ok(editorAnwenden(d0, { vorlageId: p1.id, stand: stand(p1), ops }, { person: 'pia', jetzt: J, standVon: stand, neueId: p => `${p}-u${++N}` }));
    const v1 = r.prozesse.find(p => p.id === p1.id)!;
    const ids = new Set([...v1.knoten.map(x => x.id), ...(v1.papierkorb ?? []).flatMap(e => e.knoten.map(x => x.id))]);
    for (const x of p1.knoten) expect(ids.has(x.id), x.titel).toBe(true);
    // Felder der unberührten Knoten: unverändert (nur Rang/Eltern verschieben sich, wo der Editor umgehängt hat).
    for (const x of p1.knoten) {
      const n = v1.knoten.find(y => y.id === x.id);
      if (!n) continue;
      for (const [f, w] of Object.entries(x)) {
        if (f === 'rang' || f === 'elternId' || (x.titel === 'CRM' && f === 'titel') || (x.titel === 'Führung' && f === 'freigabe')) continue;
        expect((n as unknown as Record<string, unknown>)[f], `${x.titel}.${f}`).toEqual(w);
      }
    }
    // Und gelesen bleibt alles, wie es geschrieben wurde (Säuberer kennt die neuen Felder).
    expect(vergleicheBestand('fulfillment--h', roh(r), roh(vorlagenAus(roh(r)))).abweichungen).toEqual([]);
  });

  it('Übernahme in einen laufenden Fall: keine Kennung, kein Stand, kein Zusatz-Schritt geht verloren', () => {
    const d0 = vorlagenAus(roh(altbestand()));
    const p1 = d0.prozesse.find(p => p.titel === MUSTER_P1.titel)!;
    const ph = (t: string) => p1.knoten.find(x => x.titel === t)!.id;
    const fk: FallKontext = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: stand, neueId: p => `${p}-u${++N}`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: p1.freigaben.map(f => f.id) };
    let fall: Fall = fallStarten({ mandatId: 'm-1', vorlage: p1, person: 'pia', jetzt: J, start: '2026-10-10', neueId: p => `${p}-u${++N}` });
    fall = ok(fallAnwenden(fall, [
      { op: 'knoten-status', id: ph('Quellen sammeln'), status: 'erledigt' },
      { op: 'knoten-status', id: ph('Analyse-Umfang'), status: 'wartet_kunde' },
      { op: 'knoten-extra', eintrag: { elternId: ph('Aufbau'), titel: 'Eigener Schritt' } },
    ], fk));
    const ops: EditorOp[] = [
      { op: 'baustein-dazu', id: u(2), schrittId: ph('Analyse-Umfang'), bausteinId: d0.bausteine.at(-1)!.id },
      { op: 'schritt-schieben', id: ph('Einwände'), ziel: { phaseId: ph('Aufbau'), anfang: true } },
      { op: 'schritt-neu', id: u(1), ziel: { phaseId: ph('Aufbau'), nach: ph('Prozess') }, form: 'termin', titel: 'Workshop' },
      { op: 'weg', id: ph('Kennzahlen') },
    ];
    const v1 = ok(editorAnwenden(d0, { vorlageId: p1.id, stand: stand(p1), ops }, { person: 'pia', jetzt: J, standVon: stand, neueId: p => `${p}-u${++N}` })).prozesse.find(p => p.id === p1.id)!;
    const neu = vorlageUebernehmen(fall, v1, J, 'pia');
    const a = vergleicheBestand('fall', roh(fall), roh(neu)).abweichungen;
    // Erlaubt: nur Umordnen/Umhängen (Rang, Eltern), Fassung und Zeitstempel der Übernahme — nie ein fehlender Knoten oder ein verlorener Stand.
    expect(a.filter(x => x.art !== 'wert-geaendert')).toEqual([]);
    expect(a.every(x => /\.(rang|elternId|vorlageFassung|geaendert|geaendertVon)$/.test(x.pfad) || /^(vorlageFassung|geaendert|geaendertVon)$/.test(x.pfad)), JSON.stringify(a)).toBe(true);
    expect(neu.knoten.find(x => x.id === ph('Quellen sammeln'))!.status).toBe('erledigt');
    expect(neu.knoten.find(x => x.id === ph('Analyse-Umfang'))!.status).toBe('wartet_kunde');
    expect(neu.knoten.find(x => x.id === ph('Kennzahlen'))).toBeTruthy();
    expect(neu.knoten.some(x => x.extra && x.titel === 'Eigener Schritt')).toBe(true);
    expect(neu.knoten.find(x => x.id === u(1))).toMatchObject({ form: 'termin', status: 'offen' });
  });
});

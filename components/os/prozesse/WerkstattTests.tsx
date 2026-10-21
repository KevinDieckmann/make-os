'use client';

// ─── Prozesse · Werkstatt — Reiter „Tests“ (22.10.; ANALYSE_100.md Punkt 48; Kevins Bild n8n „Executions“) ─────────────────────────────────────────────────
// Gespeicherte Testfälle (aus einem Lauf übernommen bzw. mit Beispiel- oder echtem Fall angelegt): je Testfall der Fall und die Statusfolge, die der Probelauf
// damals ergab — nur Kennungen. „Alle prüfen“ spielt jeden Testfall als Probelauf auf dem ENTWURF ab (POST tests-pruefen, schreibt nichts) und vergleicht
// (lib/prozesse/laeufe-ansicht.ts `testVergleich`): grün = gleiche Folge, rot = was sich geändert hat. Das Ergebnis gilt auch im Veröffentlichen-Dialog.

import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Trash2, PlayCircle } from 'lucide-react';
import { FARBE as C, TYP, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Zeile, Leer, Ueberschrift, Erklaert } from '../ui';
import type { ProzessDefinition } from '@/lib/prozesse/definition';
import { LAUF_GRENZEN, type Testfall } from '@/lib/prozesse/lauf-typen';
import { fallName, testfallName, testUnterschiede, testVergleich, zeitText, type TestVergleich } from '@/lib/prozesse/laeufe-ansicht';
import type { ProzessRechte } from '@/lib/prozesse/rollen';
import { FallWahl, type FallWert } from './ProbeFall';
import { laeufeSenden, useVerweise, type TestErgebnisServer } from './laeufe-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;

/** Ergebnis je Testfall in der Ansicht: der Vergleich bzw. ein Fehlersatz (Fall weg, Prozess ohne Version …). */
export type TestErgebnis = { id: string; ok: boolean; fehler?: string; vergleich?: TestVergleich };
/** Die Antwort des Servers gegen die gespeicherte Erwartung vergleichen (rein, auch für den Veröffentlichen-Dialog). */
export function testErgebnisse(tests: readonly Testfall[], antwort: readonly TestErgebnisServer[]): TestErgebnis[] {
  return antwort.map(a => {
    const t = tests.find(x => x.id === a.id);
    if (!a.ok || !t) return { id: a.id, ok: false, fehler: a.fehler ?? 'Der Testfall ließ sich nicht prüfen.' };
    const v = testVergleich(t.erwartet, a.ist);
    return { id: a.id, ok: v.ok, vergleich: v };
  });
}
/** Alle (bzw. einzelne) Testfälle prüfen — Probelauf je Testfall auf dem Entwurf. */
export async function testsPruefen(prozessId: string, tests: readonly Testfall[], ids?: readonly string[]): Promise<{ ergebnisse: TestErgebnis[] } | { fehler: string }> {
  const r = await laeufeSenden({ aktion: 'tests-pruefen', prozess: prozessId, quelle: 'entwurf', ...(ids ? { ids } : {}) });
  if (r.status !== 200 || !r.j?.ergebnisse) return { fehler: String(r.j?.fehler ?? 'Die Testfälle ließen sich nicht prüfen.') };
  return { ergebnisse: testErgebnisse(tests, r.j.ergebnisse) };
}

export function WerkstattTests({ prozessId, d, tests, rechte, ergebnisse, onErgebnisse, onNeu }: {
  prozessId: string; d: ProzessDefinition; tests: readonly Testfall[]; rechte: ProzessRechte | undefined;
  ergebnisse: ReadonlyMap<string, TestErgebnis>; onErgebnisse: (e: TestErgebnis[]) => void; onNeu: () => Promise<unknown>;
}) {
  const verweise = useVerweise();
  const [neu, setNeu] = useState<FallWert | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'info' } | null>(null);
  const titel = useMemo(() => { const m = new Map(d.knoten.map(k => [k.id, k.titel])); return (id: string) => m.get(id) ?? 'ein entfernter Schritt'; }, [d.knoten]);
  const darf = !!rechte?.entwurf;
  const pruefen = async (ids?: string[]) => {
    setMeldung(null);
    const r = await testsPruefen(prozessId, tests, ids);
    if ('fehler' in r) { setMeldung({ text: r.fehler, art: 'kritisch' }); return; }
    onErgebnisse(r.ergebnisse);
    const gruen = r.ergebnisse.filter(e => e.ok).length;
    setMeldung({ text: `${gruen} von ${r.ergebnisse.length} grün.`, art: gruen === r.ergebnisse.length ? 'gut' : 'info' });
  };
  const anlegen = async () => {
    if (!neu) return;
    const r = await laeufeSenden({ aktion: 'testfall', prozess: prozessId, wie: 'anlegen', fall: neu === 'beispiel' ? 'beispiel' : { art: neu.art, id: neu.id } });
    if (r.status === 200 && r.j?.ok) { setNeu(null); setMeldung({ text: 'Testfall angelegt.', art: 'gut' }); await onNeu(); return; }
    setMeldung({ text: String(r.j?.fehler ?? 'Nicht angelegt.'), art: 'kritisch' });
  };
  const loeschen = async (id: string) => {
    const r = await laeufeSenden({ aktion: 'testfall', prozess: prozessId, wie: 'loeschen', id });
    setMeldung(r.status === 200 ? { text: 'Testfall gelöscht.', art: 'info' } : { text: String(r.j?.fehler ?? 'Nicht gelöscht.'), art: 'kritisch' });
    await onNeu();
  };
  return (
    <section style={{ display: 'grid', gap: 12 }} aria-label="Testfälle">
      <div className="pw-kopf">
        <Erklaert erklaerung="prozesse.testfaelle" name="Testfälle"><Ueberschrift>{`Testfälle · ${tests.length}`}</Ueberschrift></Erklaert>
        <span className="pw-werkzeuge">
          {tests.length > 0 && <Knopf haupt onClick={() => pruefen()}><span className="pz-knopf-inhalt"><ClipboardCheck size={16} aria-hidden />Alle prüfen</span></Knopf>}
          {darf && !neu && tests.length < LAUF_GRENZEN.testfaelle && <Knopf leise onClick={() => setNeu('beispiel')}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Testfall</span></Knopf>}
        </span>
      </div>
      <p style={klein}>„Alle prüfen“ spielt jeden Testfall als Probelauf auf dem Entwurf ab — es wird nichts geschrieben. Grün heißt: derselbe Weg wie beim Anlegen.</p>
      {neu && (
        <Hinweis art="info" titel="Neuer Testfall — mit welchem Fall?" aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={anlegen}>Anlegen</Knopf><Knopf leise onClick={() => setNeu(null)}>Abbrechen</Knopf></span>}>
          <FallWahl fallArt={d.fallArt ?? 'mandat'} wert={neu} onWert={setNeu} />
        </Hinweis>
      )}
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      {!tests.length && <Leer>Noch keine Testfälle — im Reiter Läufe „Als Testfall übernehmen“ oder hier „+ Testfall“.</Leer>}
      <div role="list" style={{ display: 'grid', gap: 6 }}>
        {tests.map(t => {
          const e = ergebnisse.get(t.id);
          const saetze = e?.vergleich ? testUnterschiede(e.vergleich, titel) : [];
          return (
            <div role="listitem" key={t.id} style={{ display: 'grid', gap: 4 }}>
              <Zeile umbrechen
                links={e ? <Chip farbe={BEDEUTUNG_FARBE[e.ok ? 'gut' : 'kritisch']}>{e.ok ? 'grün' : e.fehler ? 'nicht prüfbar' : 'rot'}</Chip> : <Chip farbe={C.inkDim}>offen</Chip>}
                titel={testfallName(t, t.fall === 'beispiel' ? undefined : fallName(verweise, t.fall))}
                unter={`${t.erwartet.length} ${t.erwartet.length === 1 ? 'Schritt' : 'Schritte'} erwartet · angelegt ${zeitText(t.am)}${t.aus?.lauf ? ' · aus einem Lauf' : ''}${t.aus?.version ? ` · Version ${t.aus.version}` : ''}`}
                rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
                  <Knopf leise onClick={() => pruefen([t.id])} titel="Nur diesen Testfall prüfen"><span className="pz-knopf-inhalt"><PlayCircle size={14} aria-hidden />Prüfen</span></Knopf>
                  {darf && <Knopf leise onClick={() => loeschen(t.id)} titel="Testfall löschen"><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Löschen</span></Knopf>}
                </span>} />
              {e?.fehler && <Hinweis art="achtung">{e.fehler}</Hinweis>}
              {saetze.length > 0 && <ul style={{ margin: '0 0 0 18px', padding: 0, display: 'grid', gap: 2 }}>{saetze.map((s, i) => <li key={i} style={klein}>{s}</li>)}</ul>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

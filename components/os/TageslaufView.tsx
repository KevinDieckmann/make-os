'use client';

// ─── MAKE OS — Tageslauf ────────────────────────────────────────────────────
// Der Tageslauf sichtbar: welche Schritte laufen, was sie gefunden haben, und
// am Ende die eine Ausrichtung. Bewusst als Kette dargestellt — man soll sehen,
// dass jeden Tag dasselbe passiert.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Chips, Leuchtfarben).

import { Fragment, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { KETTE, schritteFuer, type LaufArt, type Lauf, type SchrittErgebnis } from '@/lib/tageslauf';
import { useTasks } from '@/context/TasksContext';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Chip, Knopf, Punkt, LEUCHT } from './schlank';

const standFarbe = (s: SchrittErgebnis['stand']) =>
  s === 'ok' ? LEUCHT.gut : s === 'leer' ? C.inkLeise : s === 'fehler' ? LEUCHT.kritisch : LEUCHT.achtung;
const formFarbe = (f?: string) => (f === 'gruen' ? LEUCHT.gut : f === 'gelb' ? LEUCHT.achtung : f === 'rot' ? LEUCHT.kritisch : C.inkLeise);

const ARTEN: { id: LaufArt; label: string; hin: string }[] = [
  { id: 'voll', label: 'Voller Lauf', hin: 'die ganze Kette — morgens' },
  { id: 'kurz', label: 'Kurzer Check', hin: 'was sich geändert hat — mittags & nachmittags' },
  { id: 'puls', label: 'Puls', hin: 'leise, meldet sich nur bei Bedarf' },
];

interface Antwort { laeufe: Lauf[]; heute: number; letzterVoll: Lauf | null; empfohlen: LaufArt }

/** Text, der in einer Zeile umbrechen darf (die Zeile schneidet sonst ab). */
function Weich({ children, farbe }: { children: React.ReactNode; farbe?: string }) {
  return <span style={{ whiteSpace: 'normal', color: farbe }}>{children}</span>;
}

export function TageslaufView() {
  const [d, setD] = useState<Antwort | null>(null);
  const [art, setArt] = useState<LaufArt>('voll');
  const [laeuft, setLaeuft] = useState(false);
  const [aktuell, setAktuell] = useState<Lauf | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  // Prioritäten & Wächter-Funde per Klick in echte Aufgaben (Duplikat-Schutz in der Route).
  const { rehydrate } = useTasks();
  const [angelegt, setAngelegt] = useState<Record<string, 'busy' | 'ok' | 'dupl' | 'err'>>({});

  async function alsAufgabe(key: string, titel: string, beschreibung: string) {
    setAngelegt(u => ({ ...u, [key]: 'busy' }));
    try {
      const r = await fetch('/api/tasks/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titel, description: beschreibung, priority: 'high', projectId: 'proj-kdm' }),
      });
      const d = await r.json();
      setAngelegt(u => ({ ...u, [key]: d.ok ? (d.duplikat ? 'dupl' : 'ok') : 'err' }));
      if (d.ok && !d.duplikat) await rehydrate();
    } catch { setAngelegt(u => ({ ...u, [key]: 'err' })); }
  }

  function aufgabeKnopf(key: string, titel: string, beschreibung: string) {
    const st = angelegt[key];
    const fertig = st === 'ok' || st === 'dupl';
    return (
      <Knopf onClick={() => alsAufgabe(key, titel, beschreibung)} leise={fertig} aus={st === 'busy' || fertig} farbe={st === 'err' ? LEUCHT.kritisch : LEUCHT.agenten}>
        {st === 'busy' ? '…' : st === 'ok' ? '✓ Aufgabe' : st === 'dupl' ? 'gibt es schon' : st === 'err' ? 'Fehler' : '→ Aufgabe'}
      </Knopf>
    );
  }

  useEffect(() => {
    fetch('/api/tageslauf').then(r => r.json()).then((a: Antwort) => {
      setD(a);
      if (a.empfohlen) setArt(a.empfohlen);
      if (a.laeufe?.[0]) setAktuell(a.laeufe[0]);
    }).catch(() => {});
  }, []);

  async function starten() {
    setLaeuft(true); setAktuell(null); setOffen(null);
    try {
      const r = await fetch('/api/tageslauf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art }) });
      const j = await r.json();
      if (j.lauf) setAktuell(j.lauf);
      const a = await (await fetch('/api/tageslauf')).json();
      setD(a);
    } catch { /* still */ }
    setLaeuft(false);
  }

  const geplant = schritteFuer(art);
  const a = aktuell?.ausrichtung as { gruss?: string; tagesform?: string; warum?: string; prioritaeten?: { titel: string; warum?: string; wann?: string }[]; schutz?: string; warnung?: string; autoAufgaben?: { titel: string; stand: string }[] } | undefined;
  const vorziehen = (aktuell?.schritte.find(x => x.id === 'prioritaet')?.detail as { vorziehen?: { was: string; warum?: string; statt?: string }[] } | undefined)?.vorziehen ?? [];

  return (
    <Seite
      titel="Tageslauf"
      unter={<>Jeden Tag dieselbe Reihenfolge: Postfächer, Termine, Aufgaben, Transkripte, Lage draußen, Prioritäten — und am Ende eine Ausrichtung. Du sollst morgens nichts entscheiden und nichts suchen müssen.{d && <span style={{ color: C.inkLeise }}> Heute {d.heute} {d.heute === 1 ? 'Lauf' : 'Läufe'}.</span>}</>}
      rechts={<Chip farbe={LEUCHT.agenten}>die feste Kette</Chip>}
    >
      {/* Lauf-Art */}
      <Karte i={0}>
        <Ueberschrift farbe={LEUCHT.agenten}>Lauf-Art</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {ARTEN.map(x => (
            <button key={x.id} onClick={() => setArt(x.id)} disabled={laeuft} className="fassbar" style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: laeuft ? 'default' : 'pointer', border: 'none', background: art === x.id ? `${LEUCHT.agenten}1F` : 'rgba(255,255,255,.04)', transition: 'background .15s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Punkt farbe={art === x.id ? LEUCHT.agenten : C.inkLeise} />
                <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: art === x.id ? C.ink : C.inkDim }}>{x.label}</span>
                {d?.empfohlen === x.id && <Chip farbe={LEUCHT.gut}>jetzt dran</Chip>}
              </div>
              <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 3, lineHeight: 1.35 }}>{x.hin}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Knopf onClick={starten} aus={laeuft} farbe={LEUCHT.agenten}>{laeuft ? 'die Kette läuft …' : 'Lauf starten'}</Knopf>
          {laeuft && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Schritt für Schritt — gleich steht die Ausrichtung.</span>}
        </div>
      </Karte>

      {/* Die Kette */}
      <Karte i={1} akzent={laeuft ? LEUCHT.agenten : undefined}>
        <Ueberschrift farbe={LEUCHT.agenten} rechts={laeuft ? 'läuft' : `${geplant.length} Schritte`}>Die Kette</Ueberschrift>
        <Liste>
          {geplant.map(s => {
            const erg = aktuell?.schritte.find(x => x.id === s.id);
            const auf = offen === s.id;
            const hatDetail = !!erg?.detail;
            return (
              <Fragment key={s.id}>
                <Zeile
                  onClick={hatDetail ? () => setOffen(auf ? null : s.id) : undefined}
                  aktiv={auf}
                  links={erg ? <Punkt farbe={standFarbe(erg.stand)} /> : <Punkt farbe={laeuft ? LEUCHT.agenten : C.inkLeise} groesse={7} />}
                  titel={<span style={{ color: erg ? C.ink : C.inkLeise }}>{s.name}{erg?.ms != null && erg.ms > 1500 && <span style={{ fontSize: 12, color: C.inkLeise, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{(erg.ms / 1000).toFixed(1)}s</span>}</span>}
                  unter={<Weich farbe={erg ? (erg.stand === 'fehler' ? LEUCHT.kritisch : erg.stand === 'uebersprungen' ? LEUCHT.achtung : C.inkDim) : C.inkLeise}>{erg ? erg.kurz : s.tut}</Weich>}
                  rechts={hatDetail ? <span style={{ fontSize: 12, color: C.inkLeise }}>{auf ? '▾' : '▸'}</span> : undefined} />
                {auf && erg?.detail != null && (
                  <div style={{ padding: '4px 0 12px 23px' }}>
                    <pre style={{ fontFamily: SCHRIFT.mono, fontSize: 11.5, color: C.inkDim, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '11px 13px' }}>
                      {typeof erg.detail === 'string' ? erg.detail : String(JSON.stringify(erg.detail, null, 2) ?? '')}
                    </pre>
                  </div>
                )}
              </Fragment>
            );
          })}
        </Liste>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 12, lineHeight: 1.6 }}>
          {KETTE.length} Schritte insgesamt · voller Lauf {schritteFuer('voll').length} · kurzer Check {schritteFuer('kurz').length} · Puls {schritteFuer('puls').length}
        </div>
      </Karte>

      {/* Wächter */}
      {aktuell?.alarm && (
        <Karte i={2} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung}>Wächter</Ueberschrift>
          <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>⚠ {aktuell.alarm}</div>
          {vorziehen.length > 0 && (
            <Liste>
              {vorziehen.map((x, i) => (
                <Zeile key={i} links={<Punkt farbe={LEUCHT.achtung} groesse={7} />} titel={x.was}
                  unter={x.warum ? <Weich>{x.warum}{x.statt ? ` — dafür wartet: ${x.statt}` : ''}</Weich> : undefined}
                  rechts={aufgabeKnopf(`waechter-${i}`, x.was, [x.warum, x.statt ? `Dafür wartet: ${x.statt}` : '', 'Vom Prioritäten-Wächter vorgezogen.'].filter(Boolean).join(' · '))} />
              ))}
            </Liste>
          )}
        </Karte>
      )}

      {/* Ausrichtung */}
      {a?.gruss && (
        <Karte i={3} akzent={formFarbe(a.tagesform)}>
          <Ueberschrift farbe={formFarbe(a.tagesform)} rechts={a.tagesform ? <Chip farbe={formFarbe(a.tagesform)}>{a.tagesform}</Chip> : undefined}>Ausrichtung</Ueberschrift>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(16px,2.2vw,18px)', fontWeight: 600, lineHeight: 1.45 }}>{a.gruss}</div>
          {a.warum && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{a.warum}</div>}

          {!!a.prioritaeten?.length && (
            <div style={{ marginTop: 10 }}>
              <Liste>
                {a.prioritaeten.slice(0, 3).map((p, i) => (
                  <Zeile key={i}
                    links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, color: formFarbe(a.tagesform), width: 20, flex: '0 0 auto' }}>{i + 1}</span>}
                    titel={<>{p.titel}{p.wann && <span style={{ fontSize: 12, color: C.inkLeise, marginLeft: 8 }}>{p.wann}</span>}</>}
                    unter={p.warum ? <Weich>{p.warum}</Weich> : undefined}
                    rechts={aufgabeKnopf(`prio-${i}`, p.titel, [p.warum, p.wann ? `Wann: ${p.wann}` : ''].filter(Boolean).join(' · ') || 'Aus der Tages-Ausrichtung.')} />
                ))}
              </Liste>
            </div>
          )}
          {!!a.autoAufgaben?.length && (
            <div style={{ fontSize: 12.5, color: LEUCHT.agenten, marginTop: 10, lineHeight: 1.5 }}>
              ⚙ Task-Agent (autonom) hat angelegt: {a.autoAufgaben.map(x => `${x.titel} (${x.stand})`).join(' · ')}
            </div>
          )}
          {a.schutz && <div style={{ fontSize: TYP.bedien, color: LEUCHT.puls, marginTop: 12 }}>◇ {a.schutz}</div>}
          {a.warnung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 6 }}>⚠ {a.warnung}</div>}
        </Karte>
      )}

      {/* Frühere Läufe */}
      {!!d?.laeufe?.length && (
        <Karte i={4}>
          <Ueberschrift rechts={`${d.laeufe.length}`}>Frühere Läufe</Ueberschrift>
          <Liste>
            {d.laeufe.slice(0, 8).map(l => (
              <Zeile key={l.id} onClick={() => { setAktuell(l); setArt(l.art); setOffen(null); }} aktiv={aktuell?.id === l.id}
                links={<>
                  <span style={{ fontSize: 12, color: C.inkLeise, width: 76, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{l.gestartet.slice(5, 10).replace('-', '.')} {l.gestartet.slice(11, 16)}</span>
                  <Chip farbe={LEUCHT.agenten}>{l.art}</Chip>
                </>}
                titel={<span style={{ color: C.inkDim, fontWeight: 400 }}>{(l.ausrichtung as { gruss?: string })?.gruss ?? l.schritte.map(s => s.name).join(' · ')}</span>}
                rechts={l.alarm ? <span style={{ color: LEUCHT.achtung, flex: '0 0 auto' }}>⚠</span> : undefined} />
            ))}
          </Liste>
        </Karte>
      )}
    </Seite>
  );
}

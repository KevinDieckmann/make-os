'use client';

import Link from 'next/link';
// Der Tageslauf sichtbar: welche Schritte laufen, was sie gefunden haben, und
// am Ende die eine Ausrichtung. Bewusst als Kette dargestellt — man soll sehen,
// dass jeden Tag dasselbe passiert.

import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { KETTE, schritteFuer, type LaufArt, type Lauf, type SchrittErgebnis } from '@/lib/tageslauf';
import { useTasks } from '@/context/TasksContext';

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const standFarbe = (s: SchrittErgebnis['stand']) =>
  s === 'ok' ? T.accent : s === 'leer' ? T.muted : s === 'fehler' ? T.crit : T.amber;
const standZeichen = (s: SchrittErgebnis['stand']) =>
  s === 'ok' ? '●' : s === 'leer' ? '○' : s === 'fehler' ? '⨯' : '–';
const formFarbe = (f?: string) => (f === 'gruen' ? T.accent : f === 'gelb' ? T.amber : f === 'rot' ? T.crit : T.muted);

const ARTEN: { id: LaufArt; label: string; hin: string }[] = [
  { id: 'voll', label: 'Voller Lauf', hin: 'die ganze Kette — morgens' },
  { id: 'kurz', label: 'Kurzer Check', hin: 'was sich geändert hat — mittags & nachmittags' },
  { id: 'puls', label: 'Puls', hin: 'leise, meldet sich nur bei Bedarf' },
];

interface Antwort { laeufe: Lauf[]; heute: number; letzterVoll: Lauf | null; empfohlen: LaufArt }

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
    return (
      <button onClick={() => alsAufgabe(key, titel, beschreibung)} disabled={st === 'busy' || st === 'ok' || st === 'dupl'}
        style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, whiteSpace: 'nowrap', flex: '0 0 auto', cursor: st ? 'default' : 'pointer',
          border: `1px solid ${st === 'err' ? T.crit : st === 'ok' || st === 'dupl' ? T.line : T.accent}`,
          background: st === 'ok' || st === 'dupl' ? 'transparent' : `${T.accent}18`,
          color: st === 'err' ? T.crit : st === 'ok' || st === 'dupl' ? T.muted : T.accent }}>
        {st === 'busy' ? '…' : st === 'ok' ? '✓ Aufgabe' : st === 'dupl' ? 'gibt es schon' : st === 'err' ? 'Fehler' : '→ Aufgabe'}
      </button>
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

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Tageslauf · die feste Kette</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Jeden Tag dieselbe Reihenfolge.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 690, lineHeight: 1.5 }}>
          Postfächer, Termine, Aufgaben, Transkripte, Lage draußen, Prioritäten — und am Ende eine Ausrichtung.
          Du sollst morgens nichts entscheiden und nichts suchen müssen.
          {d && <> <span style={{ color: T.muted }}>Heute {d.heute} {d.heute === 1 ? 'Lauf' : 'Läufe'}.</span></>}
        </p>

        {/* Lauf-Art */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, margin: '20px 0 14px' }}>
          {ARTEN.map(x => (
            <button key={x.id} onClick={() => setArt(x.id)} disabled={laeuft} style={{
              textAlign: 'left', padding: '11px 14px', borderRadius: 10, cursor: laeuft ? 'default' : 'pointer',
              border: `1px solid ${art === x.id ? T.accent : T.line}`, background: art === x.id ? `${T.accent}18` : T.panel,
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: art === x.id ? T.accent : T.ink }}>
                {x.label}{d?.empfohlen === x.id && <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginLeft: 7 }}>jetzt dran</span>}
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.35 }}>{x.hin}</div>
            </button>
          ))}
        </div>

        <button onClick={starten} disabled={laeuft} style={{
          fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 22px', borderRadius: 9, border: 'none',
          cursor: laeuft ? 'default' : 'pointer', background: laeuft ? T.line : T.accent, color: laeuft ? T.muted : '#04110F', marginBottom: 20,
        }}>
          {laeuft ? 'die Kette läuft …' : 'Lauf starten'}
        </button>

        {/* Die Kette */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 12 }}>Die Kette{laeuft ? ' — läuft' : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {geplant.map((s, i) => {
              const erg = aktuell?.schritte.find(x => x.id === s.id);
              const auf = offen === s.id;
              return (
                <div key={s.id}>
                  <div onClick={() => erg?.detail && setOffen(auf ? null : s.id)} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0',
                    borderTop: i ? `1px solid ${T.lineSoft}` : 0, cursor: erg?.detail ? 'pointer' : 'default',
                  }}>
                    <span style={{ fontFamily: T.mono, fontSize: 13, color: erg ? standFarbe(erg.stand) : (laeuft ? T.accentInk : T.muted), flex: '0 0 auto', width: 14, opacity: erg ? 1 : 0.4 }}>
                      {erg ? standZeichen(erg.stand) : '·'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: erg ? T.ink : T.muted }}>{s.name}</span>
                        {erg?.ms != null && erg.ms > 1500 && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>{(erg.ms / 1000).toFixed(1)}s</span>}
                        {!!erg?.detail && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{auf ? '▾' : '▸'}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: erg ? (erg.stand === 'fehler' ? T.crit : erg.stand === 'uebersprungen' ? T.amber : T.inkDim) : T.muted, marginTop: 2, lineHeight: 1.45 }}>
                        {erg ? erg.kurz : s.tut}
                      </div>
                    </div>
                  </div>
                  {auf && erg?.detail != null && (
                    <div style={{ padding: '0 0 12px 26px' }}>
                      <pre style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkDim, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, background: T.panel2, borderRadius: 9, padding: '11px 13px' }}>
                        {typeof erg.detail === 'string' ? erg.detail : String(JSON.stringify(erg.detail, null, 2) ?? '')}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Wächter */}
        {aktuell?.alarm && (
          <div style={{ ...panel, borderColor: `${T.amber}55`, padding: '14px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: T.amber, flex: '0 0 auto' }}>⚠</span>
              <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}><b style={{ color: T.amber }}>Wächter: </b>{aktuell.alarm}</div>
            </div>
            {(() => {
              const det = aktuell.schritte.find(x => x.id === 'prioritaet')?.detail as { vorziehen?: { was: string; warum?: string; statt?: string }[] } | undefined;
              const v = det?.vorziehen ?? [];
              if (!v.length) return null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10, paddingLeft: 24 }}>
                  {v.map((x, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{x.was}</span>
                        {x.warum && <div style={{ fontSize: 12, color: T.inkDim, marginTop: 1, lineHeight: 1.4 }}>{x.warum}{x.statt ? ` — dafür wartet: ${x.statt}` : ''}</div>}
                      </div>
                      {aufgabeKnopf(`waechter-${i}`, x.was, [x.warum, x.statt ? `Dafür wartet: ${x.statt}` : '', 'Vom Prioritäten-Wächter vorgezogen.'].filter(Boolean).join(' · '))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Ausrichtung */}
        {a?.gruss && (
          <div style={{ ...panel, borderTop: `2px solid ${formFarbe(a.tagesform)}`, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <div style={lbl}>Ausrichtung</div>
              {a.tagesform && <span style={{ fontFamily: T.mono, fontSize: 9.5, color: formFarbe(a.tagesform), border: `1px solid ${formFarbe(a.tagesform)}55`, borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase' }}>{a.tagesform}</span>}
            </div>
            <div style={{ fontSize: 15.5, color: T.ink, lineHeight: 1.55 }}>{a.gruss}</div>
            {a.warum && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>{a.warum}</div>}

            {!!a.prioritaeten?.length && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {a.prioritaeten.slice(0, 3).map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, flex: '0 0 auto' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{p.titel}</span>
                      {p.wann && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginLeft: 8 }}>{p.wann}</span>}
                      {p.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2, lineHeight: 1.45 }}>{p.warum}</div>}
                    </div>
                    {aufgabeKnopf(`prio-${i}`, p.titel, [p.warum, p.wann ? `Wann: ${p.wann}` : ''].filter(Boolean).join(' · ') || 'Aus der Tages-Ausrichtung.')}
                  </div>
                ))}
              </div>
            )}
            {!!a.autoAufgaben?.length && (
              <div style={{ fontSize: 12, color: T.accent, marginTop: 10, lineHeight: 1.5 }}>
                ⚙ Task-Agent (autonom) hat angelegt: {a.autoAufgaben.map(x => `${x.titel} (${x.stand})`).join(' · ')}
              </div>
            )}
            {a.schutz && <div style={{ fontSize: 12.5, color: T.accentInk, marginTop: 12 }}>◇ {a.schutz}</div>}
            {a.warnung && <div style={{ fontSize: 12.5, color: T.amber, marginTop: 6 }}>⚠ {a.warnung}</div>}
          </div>
        )}

        {/* Frühere Läufe */}
        {!!d?.laeufe?.length && (
          <div style={{ marginTop: 20 }}>
            <div style={{ ...lbl, marginBottom: 9 }}>Frühere Läufe</div>
            <div style={{ ...panel, overflow: 'hidden' }}>
              {d.laeufe.slice(0, 8).map((l, i) => (
                <div key={l.id} onClick={() => { setAktuell(l); setArt(l.art); setOffen(null); }} style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', cursor: 'pointer',
                  borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: aktuell?.id === l.id ? T.panel2 : 'transparent',
                }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>
                    {l.gestartet.slice(5, 10).replace('-', '.')} {l.gestartet.slice(11, 16)}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accentInk, border: `1px solid ${T.line}`, borderRadius: 5, padding: '2px 7px' }}>{l.art}</span>
                  <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(l.ausrichtung as { gruss?: string })?.gruss ?? l.schritte.map(s => s.name).join(' · ')}
                  </span>
                  {l.alarm && <span style={{ color: T.amber, flex: '0 0 auto' }}>⚠</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 16, lineHeight: 1.6 }}>
          {KETTE.length} Schritte insgesamt · voller Lauf {schritteFuer('voll').length} · kurzer Check {schritteFuer('kurz').length} · Puls {schritteFuer('puls').length}
        </div>
      </div>
    </div>
  );
}

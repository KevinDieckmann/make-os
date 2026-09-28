'use client';
// ─── Archiv „Neu angefangen“ (29.09.) ───────────────────────────────────────
// Unter Aufgaben › Archiv: je Neustart eine Karte mit dem, was damals archiviert wurde — Ziele (je Ebene), Meilensteine,
// Projekte (mit ihren Aufgaben), Aufgaben ohne Projekt, ruhende Serien. „Wiederherstellen“ je Eintrag oder „Alles
// wiederherstellen“; Zurückgeholtes steht danach als „zurück“ da. Server: /api/neustart (GET ?archiv=1, POST zurueck).

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Leer, Punkt, Knopf } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { ArchivLaufSicht, NeustartAuswahl } from '@/lib/aufgaben/neustart-server';
import { REGEL_LABEL } from '@/lib/aufgaben/wiederholung';
import { spaceLabel, tagKurz } from './hilfe';
import { NEU_ANGEFANGEN } from './NeuAnfangen';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const zeileStil: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap', minHeight: 44 };
const HORIZONT: Record<string, string> = { jahr: 'Jahr', quartal: 'Quartal', monat: 'Monat', woche: 'Woche', tag: 'Tag' };
const ZEIGEN = 30;

function Zurueck({ zurueck, onClick, label }: { zurueck: boolean; onClick: () => Promise<void>; label: string }) {
  if (zurueck) return <span style={{ marginLeft: 'auto', fontSize: 12, color: LEUCHT.gut }}>zurück ✓</span>;
  return <span style={{ marginLeft: 'auto' }}><button onClick={() => void onClick()} aria-label={`${label} wiederherstellen`} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, minHeight: 36, padding: '4px 6px' }}>Wiederherstellen</button></span>;
}

function Abschnitt({ titel, anzahl, children }: { titel: string; anzahl: number; children: ReactNode }) {
  const [auf, setAuf] = useState(anzahl <= 8);
  if (!anzahl) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setAuf(a => !a)} aria-expanded={auf} className="fassbar" style={{ ...mikro, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', minHeight: 36 }}>{auf ? '▾' : '▸'} {titel} · {anzahl}</button>
      {auf && <div>{children}</div>}
    </div>
  );
}

export function NeustartArchiv({ spaces }: { spaces: readonly AufgabenSpace[] }) {
  const { rehydrate } = useTasks();
  const [laeufe, setLaeufe] = useState<ArchivLaufSicht[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [alle, setAlle] = useState<Record<string, boolean>>({});

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/neustart?archiv=1', { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) { setLaeufe([]); return; }
      if (!r.ok) { setFehler(d.error ?? `Server antwortet ${r.status}`); return; }
      setLaeufe(Array.isArray(d.laeufe) ? d.laeufe : []);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => {
    void laden();
    const neu = () => { void laden(); };
    window.addEventListener(NEU_ANGEFANGEN, neu);
    return () => window.removeEventListener(NEU_ANGEFANGEN, neu);
  }, [laden]);

  const zurueck = async (laufId: string, auswahl: NeustartAuswahl) => {
    setFehler(null); setMeldung(null);
    try {
      const r = await fetch('/api/neustart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'zurueck', laufId, auswahl }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFehler(d.error ?? `Server antwortet ${r.status}`); return; }
      const b = d.bericht as { aufgaben: number; projekte: number; ziele: number; meilensteine: number; schon: number };
      const teile = [b.projekte ? `${b.projekte} Projekt${b.projekte === 1 ? '' : 'e'}` : '', b.aufgaben ? `${b.aufgaben} Aufgabe${b.aufgaben === 1 ? '' : 'n'}` : '', b.ziele ? `${b.ziele} Ziel${b.ziele === 1 ? '' : 'e'}` : '', b.meilensteine ? `${b.meilensteine} Meilenstein${b.meilensteine === 1 ? '' : 'e'}` : ''].filter(Boolean);
      setMeldung(teile.length ? `Zurückgeholt: ${teile.join(', ')}.${b.schon ? ` ${b.schon} gab es schon — nicht überschrieben.` : ''}` : 'Nichts mehr zurückzuholen.');
      await rehydrate();
      window.dispatchEvent(new CustomEvent(NEU_ANGEFANGEN));
    } catch { setFehler('Keine Verbindung — bitte noch einmal.'); }
  };

  if (!laeufe?.length && !fehler) return null;
  return (
    <>
      <div style={{ ...mikro, margin: '18px 2px 8px' }}>Neu angefangen · archiviert</div>
      {fehler && <Karte i={3}><span role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</span></Karte>}
      {meldung && <div role="status" aria-live="polite" style={{ fontSize: TYP.bedien, color: LEUCHT.gut, margin: '0 2px 8px' }}>{meldung}</div>}
      {(laeufe ?? []).map((l, i) => {
        const kurz = (liste: unknown[]) => (alle[l.id] ? liste : liste.slice(0, ZEIGEN));
        return (
          <Karte key={l.id} i={3 + i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: SCHRIFT.display, fontSize: 16, fontWeight: 700, color: C.ink }}>Neustart vom {tagKurz(l.am.slice(0, 10))}</span>
              <span style={{ fontSize: 12, color: C.inkLeise }}>{new Date(l.am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} · {l.von}{l.status !== 'fertig' ? ' · nicht abgeschlossen' : ''}</span>
              <span style={{ marginLeft: 'auto' }}>
                {l.offen > 0 ? <Knopf leise onClick={() => zurueck(l.id, { art: 'alles' })}>Alles wiederherstellen ({l.offen})</Knopf> : <span style={{ fontSize: 12.5, color: LEUCHT.gut }}>alles zurück ✓</span>}
              </span>
            </div>
            <Abschnitt titel="Ziele" anzahl={l.ziele.length}>
              {(kurz(l.ziele) as ArchivLaufSicht['ziele']).map(z => (
                <div key={`${z.speicher}|${z.horizont}|${z.id}`} style={zeileStil}>
                  <span style={{ fontSize: 12, color: C.inkLeise, minWidth: 58 }}>{HORIZONT[z.horizont]}</span>
                  <span style={{ color: z.erledigt ? C.inkLeise : C.ink, fontSize: 14, textDecoration: z.erledigt ? 'line-through' : undefined }}>{z.titel}</span>
                  {z.speicher !== 'ziele' && <span style={{ fontSize: 12, color: C.inkLeise }}>persönlich</span>}
                  <Zurueck zurueck={z.zurueck} label={z.titel} onClick={() => zurueck(l.id, { art: 'ziel', speicher: z.speicher, horizont: z.horizont, id: z.id })} />
                </div>
              ))}
            </Abschnitt>
            <Abschnitt titel="Meilensteine" anzahl={l.meilensteine.length}>
              {(kurz(l.meilensteine) as ArchivLaufSicht['meilensteine']).map(m => (
                <div key={m.id} style={zeileStil}>
                  <span style={{ color: m.erledigt ? C.inkLeise : C.ink, fontSize: 14, textDecoration: m.erledigt ? 'line-through' : undefined }}>{m.titel}</span>
                  {m.faellig && <span style={{ fontSize: 12, color: C.inkLeise }}>{tagKurz(m.faellig)}</span>}
                  <Zurueck zurueck={m.zurueck} label={m.titel} onClick={() => zurueck(l.id, { art: 'meilenstein', id: m.id })} />
                </div>
              ))}
            </Abschnitt>
            <Abschnitt titel="Projekte" anzahl={l.projekte.length}>
              {(kurz(l.projekte) as ArchivLaufSicht['projekte']).map(p => (
                <div key={p.id} style={zeileStil}>
                  <Punkt farbe={p.farbe ?? C.inkDim} />
                  <span style={{ color: C.ink, fontSize: 14 }}>{p.titel}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{spaceLabel(spaces, p.spaceId)} · {p.aufgaben} Aufgabe{p.aufgaben === 1 ? '' : 'n'}</span>
                  <Zurueck zurueck={p.zurueck} label={p.titel} onClick={() => zurueck(l.id, { art: 'projekt', id: p.id })} />
                </div>
              ))}
            </Abschnitt>
            <Abschnitt titel="Aufgaben ohne Projekt" anzahl={l.aufgaben.length}>
              {(kurz(l.aufgaben) as ArchivLaufSicht['aufgaben']).map(t => (
                <div key={t.id} style={zeileStil}>
                  <span style={{ color: t.erledigt ? C.inkLeise : C.ink, fontSize: 14, textDecoration: t.erledigt ? 'line-through' : undefined }}>{t.titel}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{spaceLabel(spaces, t.spaceId)}{t.unter ? ` · ${t.unter} Unteraufgabe${t.unter === 1 ? '' : 'n'}` : ''}</span>
                  <Zurueck zurueck={t.zurueck} label={t.titel} onClick={() => zurueck(l.id, { art: 'aufgabe', id: t.id })} />
                </div>
              ))}
            </Abschnitt>
            <Abschnitt titel="Serien (ruhen, bis ihr sie zurückholt)" anzahl={l.serien.length}>
              {l.serien.map((s, k) => (
                <div key={k} style={zeileStil}>
                  <span style={{ color: C.inkDim, fontSize: 13.5 }}>↻ {s.titel}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{s.art === 'liste' ? 'Liste · ' : ''}{REGEL_LABEL[s.regel as keyof typeof REGEL_LABEL] ?? s.regel}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: s.zurueck ? LEUCHT.gut : C.inkLeise }}>{s.zurueck ? 'läuft wieder' : 'ruht'}</span>
                </div>
              ))}
            </Abschnitt>
            {!alle[l.id] && [l.ziele, l.meilensteine, l.projekte, l.aufgaben].some(x => x.length > ZEIGEN) && (
              <button onClick={() => setAlle(a => ({ ...a, [l.id]: true }))} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5, marginTop: 8, fontFamily: SCHRIFT.text }}>alle zeigen</button>
            )}
            {!l.ziele.length && !l.meilensteine.length && !l.projekte.length && !l.aufgaben.length && <Leer>Dieser Neustart hat nichts archiviert.</Leer>}
          </Karte>
        );
      })}
    </>
  );
}

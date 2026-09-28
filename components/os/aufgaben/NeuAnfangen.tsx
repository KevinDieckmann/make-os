'use client';
// ─── „Neu anfangen …“ (29.09., Kevin: „morgen alle Ziele und Aufgaben rausnehmen und neu planen“) ─────
// Ein Knopf in Aufgaben und in Ziele & Planung. Das Fenster zeigt vorher, was archiviert wird (nichts wird gelöscht),
// welche Serien ruhen und was bleibt; bestätigt wird durch Tippen von „NEU ANFANGEN“. Danach: Bericht + Link ins
// Archiv (Aufgaben › Archiv › Neu angefangen — dort ganz oder einzeln zurückholen). Server: /api/neustart.
// Die Lauf-Kennung entsteht beim Öffnen — wer nach einem Netzfehler erneut drückt, setzt denselben Lauf fort.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf, feld } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import { neueKennung } from '@/lib/kennung';
import { NEUSTART_BESTAETIGUNG } from '@/lib/aufgaben/neustart';
import { REGEL_LABEL } from '@/lib/aufgaben/wiederholung';
import { aufgabenLink } from '@/lib/aufgaben/adresse';
import type { NeustartVorschau } from '@/lib/aufgaben/neustart-server';

/** Ereignis nach einem Neustart oder Zurückholen — Ziele & Planung lädt daraufhin neu. */
export const NEU_ANGEFANGEN = 'make-neu-angefangen';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const zahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

interface Bericht { projekte: number; listen: number; gruppen: number; aufgaben: number; unteraufgaben?: number; ziele: number; meilensteine: number; fokus: number; meldungenGelesen: number; serien: { art: string; titel: string; regel: string }[] }

export function NeuAnfangenKnopf({ klein }: { klein?: boolean }) {
  const [auf, setAuf] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={knopf} onClick={() => setAuf(true)} className="fassbar"
        style={{ background: 'none', border: `1px solid ${LEUCHT.kritisch}55`, borderRadius: 10, color: LEUCHT.kritisch, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: klein ? 12.5 : TYP.bedien, padding: klein ? '6px 10px' : '8px 12px', minHeight: 36 }}>
        Neu anfangen …
      </button>
      {/* Über ein Portal an den Seitenrand — im Seitenkopf läge das Fenster sonst unter den Karten (Stapelkontext). */}
      {auf && createPortal(<NeuAnfangenFenster onZu={() => { setAuf(false); requestAnimationFrame(() => knopf.current?.focus()); }} />, document.body)}
    </>
  );
}

export function NeuAnfangenFenster({ onZu }: { onZu: () => void }) {
  const { rehydrate } = useTasks();
  const laufId = useMemo(() => neueKennung('na'), []);
  const [vorschau, setVorschau] = useState<NeustartVorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [bericht, setBericht] = useState<Bericht | null>(null);

  useEffect(() => {
    let lebt = true;
    fetch('/api/neustart', { cache: 'no-store' }).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!lebt) return;
      if (!r.ok) { setFehler(d.error ?? d.fehler ?? `Server antwortet ${r.status}`); return; }
      setVorschau(d.vorschau as NeustartVorschau);
    }).catch(() => { if (lebt) setFehler('Keine Verbindung — bitte später noch einmal.'); });
    return () => { lebt = false; };
  }, []);

  const los = async () => {
    setFehler(null);
    try {
      const r = await fetch('/api/neustart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'neu-anfangen', laufId, bestaetigung: text.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFehler(d.error ?? d.fehler ?? `Server antwortet ${r.status}`); return; }
      setBericht(d.bericht as Bericht);
      await rehydrate();
      window.dispatchEvent(new CustomEvent(NEU_ANGEFANGEN));
    } catch { setFehler('Keine Verbindung — nichts ist verloren. Noch einmal drücken setzt denselben Lauf fort.'); }
  };

  const v = vorschau;
  const leer = v && !v.ziele && !v.meilensteine && !v.projekte && !v.aufgaben && !v.unteraufgaben && !v.listen;
  return (
    <Fenster titel={bericht ? 'Neu angefangen' : 'Neu anfangen'} onZu={onZu} breit={620}>
      {bericht ? (
        <>
          <p style={{ margin: 0, fontSize: TYP.body, color: C.ink, lineHeight: 1.55 }}>
            Archiviert: {[zahl(bericht.ziele, 'Ziel', 'Ziele'), zahl(bericht.meilensteine, 'Meilenstein', 'Meilensteine'), zahl(bericht.projekte, 'Projekt', 'Projekte'), zahl(bericht.aufgaben, 'Aufgabe', 'Aufgaben')].join(' · ')}{bericht.unteraufgaben ? ` (dazu ${zahl(bericht.unteraufgaben, 'Unteraufgabe', 'Unteraufgaben')})` : ''}.
            {' '}Die Spaces sind leer — die Startvorlagen stehen unter „Vorlagen“ bereit.
          </p>
          {bericht.serien.length > 0 && <SerienListe serien={bericht.serien} titel="Serien ruhen (laufen weiter, sobald ihr sie zurückholt)" />}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href={aufgabenLink({ ansicht: 'archiv' })} onClick={onZu} style={{ color: C.aktiv, fontSize: TYP.bedien, textDecoration: 'none' }}>Zum Archiv ›</Link>
            <span style={{ marginLeft: 'auto' }}><Knopf onClick={onZu}>Fertig</Knopf></span>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
            Alles Bisherige wird <b style={{ color: C.ink }}>archiviert, nicht gelöscht</b>. Es liegt danach unter Aufgaben › Archiv und lässt sich jederzeit
            ganz oder einzeln wiederherstellen. Vorher legt der Server eine Sicherheitskopie ab.
          </p>
          {!v && !fehler && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>zähle …</span>}
          {v && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={mikro}>Wird archiviert</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {[['Ziele', v.ziele], ['Meilensteine', v.meilensteine], ['Projekte', v.projekte], ['Aufgaben', v.aufgaben]].map(([l, n]) => (
                  <div key={l as string} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={mikro}>{l}</div>
                    <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.zahl, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{n as number}</div>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 }}>
                dazu {zahl(v.unteraufgaben, 'Unteraufgabe', 'Unteraufgaben')}, {zahl(v.listen, 'Liste', 'Listen')}, {zahl(v.gruppen, 'Gruppe', 'Gruppen')}
                {v.fokus ? `, ${zahl(v.fokus, 'Fokus-Satz', 'Fokus-Sätze')}` : ''} · davon {v.erledigt} schon erledigt/abgebrochen · Ziele je Ebene:{' '}
                {(['jahr', 'quartal', 'monat', 'woche', 'tag'] as const).map(h => `${h === 'jahr' ? 'Jahr' : h === 'quartal' ? 'Quartal' : h === 'monat' ? 'Monat' : h === 'woche' ? 'Woche' : 'Tag'} ${v.zieleJe[h]}`).join(' · ')}
              </span>
              {v.serien.length > 0 && <SerienListe serien={v.serien} titel="Serien ruhen im Archiv" />}
              <div style={mikro}>Bleibt</div>
              <span style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>
                Routinen und Wochen-Blöcke, Vorlagen, eigene Status, das CRM (Follow-ups, Deals, Mandate), der Papierkorb
                {v.bleiben.length ? ` und ${zahl(v.bleiben.length, 'offene Fristen-Aufgabe', 'offene Fristen-Aufgaben')} der Module (${v.bleiben.slice(0, 3).map(b => `„${b.titel}“`).join(', ')}${v.bleiben.length > 3 ? ' …' : ''})` : ''}.
              </span>
            </div>
          )}
          {leer && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Es gibt nichts zu archivieren — alles ist schon leer.</span>}
          {v && !leer && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Zum Bestätigen <b style={{ color: C.ink, letterSpacing: '.04em' }}>{NEUSTART_BESTAETIGUNG}</b> tippen</span>
              <input value={text} onChange={e => setText(e.target.value)} autoComplete="off" spellCheck={false} aria-label={`Zum Bestätigen ${NEUSTART_BESTAETIGUNG} tippen`}
                onKeyDown={e => { if (e.key === 'Enter' && text.trim() === NEUSTART_BESTAETIGUNG) void los(); }}
                style={{ ...feld, fontSize: TYP.bedien, padding: '10px 12px', letterSpacing: '.04em' }} placeholder={NEUSTART_BESTAETIGUNG} />
            </label>
          )}
          {fehler && <span role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</span>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
            <Knopf farbe={LEUCHT.kritisch} aus={!v || !!leer || text.trim() !== NEUSTART_BESTAETIGUNG} onClick={los}>Alles archivieren und neu anfangen</Knopf>
          </div>
        </>
      )}
    </Fenster>
  );
}

function SerienListe({ serien, titel }: { serien: { art: string; titel: string; regel: string }[]; titel: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={mikro}>{titel} · {serien.length}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.inkDim, lineHeight: 1.6, maxHeight: 140, overflowY: 'auto' }}>
        {serien.map((s, i) => <li key={i}>↻ {s.titel} <span style={{ color: C.inkLeise }}>({s.art === 'liste' ? 'Liste, ' : ''}{REGEL_LABEL[s.regel as keyof typeof REGEL_LABEL] ?? s.regel})</span></li>)}
      </ul>
    </div>
  );
}

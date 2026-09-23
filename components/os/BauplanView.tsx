'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import {
  KAT_LABEL, STATUS_LABEL, BLOCK_LABEL,
  type BacklogItem, type BacklogStatus, type BacklogKat, type BacklogBlock,
} from '@/lib/make-one/backlog-data';
import { localDay } from '@/lib/zeit';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';
import { Seitenkopf } from './Seitenkopf';

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };

const katColor = (k: BacklogKat) => (k === 'anbindung' ? '#4A6CF7' : k === 'agent' ? T.accent : k === 'qualitaet' ? T.accentInk : '#AC9D80');
const blockColor = (b: BacklogBlock) => (b === 'frei' ? T.accent : b === 'kevin' ? T.amber : T.muted);
const statusColor = (s: BacklogStatus) => (s === 'erledigt' ? T.muted : s === 'laufend' ? T.accentInk : T.ink);
const STATI: BacklogStatus[] = ['offen', 'laufend', 'erledigt'];

export function BauplanView() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [speicherFehler, setSpeicherFehler] = useState(false);
  const [neu, setNeu] = useState('');
  const [filter, setFilter] = useState<'alle' | BacklogBlock>('alle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/backlog')
      .then(r => r.json())
      .then((d: { items: BacklogItem[] }) => {
        // Eine leere Antwort ist kein leerer Bauplan — sie ist ein Fehler.
        if (!Array.isArray(d.items)) throw new Error('keine Liste');
        setItems(d.items); setLoaded(true);
      })
      .catch(() => setLadeFehler(true));
  }, []);

  /**
   * Speichern nur, wenn vorher wirklich geladen wurde. Sonst schriebe ein
   * fehlgeschlagener Ladevorgang eine leere Liste zurück — der Server lehnt
   * das zwar ab (Schrumpf-Wächter), aber Kevin sähe eine leere Seite und
   * seine Änderung verschwände still. Lieber gar nicht speichern und es sagen.
   */
  function persist(next: BacklogItem[]) {
    if (ladeFehler || !loaded) return;
    setItems(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/backlog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: next }) })
        .then(r => { if (!r.ok) setSpeicherFehler(true); })
        .catch(() => setSpeicherFehler(true));
    }, 400);
  }

  const cycleStatus = (it: BacklogItem) => {
    const i = STATI.indexOf(it.status);
    persist(items.map(x => x.id === it.id ? { ...x, status: STATI[(i + 1) % STATI.length] } : x));
  };
  const cyclePrio = (it: BacklogItem) =>
    persist(items.map(x => x.id === it.id ? { ...x, prio: (x.prio === 3 ? 1 : x.prio + 1) as 1 | 2 | 3 } : x));

  async function addItem() {
    const titel = neu.trim();
    if (!titel) return;
    setNeu('');
    try {
      await fetch('/api/state/backlog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel, quelle: 'unterwegs notiert' }),
      });
      const d = await (await fetch('/api/state/backlog')).json();
      setItems(d.items ?? []);
    } catch { /* lokal — Liste bleibt wie sie ist */ }
  }

  const sichtbar = items
    .filter(i => filter === 'alle' || i.block === filter)
    .sort((a, b) => {
      const s = (x: BacklogItem) => (x.status === 'erledigt' ? 2 : x.status === 'laufend' ? 0 : 1);
      return s(a) - s(b) || a.prio - b.prio;
    });

  const offen = items.filter(i => i.status !== 'erledigt');
  const meine = offen.filter(i => i.block === 'frei').length;
  const deine = offen.filter(i => i.block === 'kevin').length;

  // Zeitstrahl: die nächsten 90 Tage — nur Punkte mit Zieldatum landen darauf.
  const p2 = (n: number) => String(n).padStart(2, '0');
  const heute = localDay();
  const tagPlus = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const strahlBis = tagPlus(90);
  const ticks: StrahlTick[] = (() => {
    const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const t: StrahlTick[] = [];
    const d = new Date();
    for (let i = 0; i < 4; i++) {
      const erster = new Date(d.getFullYear(), d.getMonth() + 1 + i, 1);
      const iso = `${erster.getFullYear()}-${p2(erster.getMonth() + 1)}-01`;
      if (iso <= strahlBis) t.push({ date: iso, label: MON_KURZ[erster.getMonth()] });
    }
    return t;
  })();
  const strahlMarker: StrahlMarker[] = offen
    .filter(i => i.ziel)
    .map(i => ({ date: i.ziel!, label: i.titel, farbe: katColor(i.kategorie), symbol: i.block === 'kevin' ? '◆' : '◇', titel: `${i.titel} · Ziel ${i.ziel!.slice(8)}.${i.ziel!.slice(5, 7)}. · ${BLOCK_LABEL[i.block]}` }));
  const ohneZiel = offen.filter(i => !i.ziel).length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>

        {/* Lieber ehrlich stehenbleiben als still eine leere Liste speichern. */}
        {ladeFehler && (
          <div style={{ background: T.panel, border: `1px solid ${T.crit}66`, borderLeft: `3px solid ${T.crit}`, borderRadius: 12, padding: '13px 17px', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.crit }}>Der Bauplan konnte nicht geladen werden.</div>
            <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, marginTop: 4 }}>
              Deine Einträge sind nicht weg — sie liegen auf der Platte. Änderungen sind hier so lange gesperrt,
              damit nichts Leeres darüber geschrieben wird. Seite neu laden.
            </div>
          </div>
        )}
        {speicherFehler && !ladeFehler && (
          <div style={{ background: T.panel, border: `1px solid ${T.amber}66`, borderLeft: `3px solid ${T.amber}`, borderRadius: 12, padding: '13px 17px', marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.amber }}>Die letzte Änderung wurde nicht gespeichert.</div>
            <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, marginTop: 4 }}>
              Entweder war der Server kurz weg, oder der Schutz hat abgelehnt, weil zu viel auf einmal verschwunden wäre.
              Seite neu laden und noch einmal versuchen.
            </div>
          </div>
        )}

        <Seitenkopf
          rubrik={<>Bauplan · das System selbst</>}
          titel={<>Was wir noch bauen.</>}
          satz={<>Getrennt von deinen echten Aufgaben: hier steht, was an MAKE OS fehlt — Anbindungen, Agenten, Verbesserungen. Was dir unterwegs auffällt, trägst du unten ein; ich schreibe rein, was ich beim Bauen finde.</>}
        />

        {/* Kennzahlen + Filter */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 14px', alignItems: 'stretch' }}>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Offen</div><div style={{ fontSize: 21, fontWeight: 700 }}>{offen.length}</div></div>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Kann ich bauen</div><div style={{ fontSize: 21, fontWeight: 700, color: T.accent }}>{meine}</div></div>
          <div style={{ ...panel, padding: '10px 16px' }}><div style={lbl}>Braucht dich</div><div style={{ fontSize: 21, fontWeight: 700, color: T.amber }}>{deine}</div></div>
        </div>

        {/* Zeitstrahl — 90 Tage voraus; nur terminierte Punkte erscheinen */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', margin: '0 2px 6px' }}>
          <span style={lbl}>Zeitstrahl · 90 Tage</span>
          {ohneZiel > 0 && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{ohneZiel} offene Punkte ohne Zieldatum — Datum am Punkt setzen, dann erscheinen sie hier</span>}
        </div>
        <Zeitstrahl von={heute} bis={strahlBis} ticks={ticks} marker={strahlMarker} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['alle', 'frei', 'kevin', 'extern'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${filter === f ? (f === 'alle' ? T.accent : blockColor(f)) : T.line}`,
              background: filter === f ? `${f === 'alle' ? T.accent : blockColor(f)}22` : 'transparent',
              color: filter === f ? (f === 'alle' ? T.accent : blockColor(f)) : T.inkDim,
            }}>{f === 'alle' ? 'Alle' : BLOCK_LABEL[f]}</button>
          ))}
        </div>

        {/* Eingabe */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input
            value={neu} onChange={e => setNeu(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
            placeholder="Was ist dir aufgefallen? (Enter legt es an)"
            style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 9, color: T.ink, fontFamily: T.sans, fontSize: 13.5, padding: '10px 13px', outline: 'none' }}
          />
          <button onClick={addItem} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 9, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Notieren</button>
        </div>

        {/* Liste */}
        {!loaded ? (
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade Bauplan …</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {sichtbar.map(it => (
              <div key={it.id} style={{ ...panel, padding: '14px 18px', opacity: it.status === 'erledigt' ? 0.5 : 1, borderLeft: `3px solid ${katColor(it.kategorie)}` }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <button onClick={() => cyclePrio(it)} title="Priorität wechseln" style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: it.prio === 1 ? T.accent : it.prio === 2 ? T.inkDim : T.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flex: '0 0 auto' }}>
                    P{it.prio}
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 600, color: statusColor(it.status), textDecoration: it.status === 'erledigt' ? 'line-through' : 'none', flex: 1, minWidth: 180 }}>{it.titel}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: katColor(it.kategorie), border: `1px solid ${katColor(it.kategorie)}55`, borderRadius: 5, padding: '2px 7px' }}>{KAT_LABEL[it.kategorie]}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: blockColor(it.block), border: `1px solid ${blockColor(it.block)}55`, borderRadius: 5, padding: '2px 7px' }}>{BLOCK_LABEL[it.block]}</span>
                  <input type="date" value={it.ziel ?? ''} title="Zieldatum — setzt den Punkt auf den Zeitstrahl"
                    onChange={e => persist(items.map(x => x.id === it.id ? { ...x, ziel: e.target.value || undefined } : x))}
                    style={{ fontFamily: T.mono, fontSize: 11, color: it.ziel ? T.accentInk : T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 6, padding: '2px 6px', colorScheme: 'dark', flex: '0 0 auto' }} />
                  <button onClick={() => cycleStatus(it)} style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, flex: '0 0 auto' }}>
                    {STATUS_LABEL[it.status]}
                  </button>
                </div>

                {it.warum && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 6, lineHeight: 1.5, paddingLeft: 30 }}>{it.warum}</div>}

                {it.block === 'kevin' && it.brauche && (
                  <div style={{ marginTop: 8, marginLeft: 30, display: 'flex', gap: 8, background: T.panel2, border: `1px solid ${T.amber}44`, borderRadius: 9, padding: '9px 12px' }}>
                    <span style={{ color: T.amber, flex: '0 0 auto' }}>→</span>
                    <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.5 }}><b style={{ color: T.amber }}>Du brauchst: </b>{it.brauche}</div>
                  </div>
                )}

                {it.quelle && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 7, paddingLeft: 30 }}>aus: {it.quelle}</div>}
              </div>
            ))}
            {!sichtbar.length && (
              <div style={{ ...panel, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13 }}>Hier ist gerade nichts offen.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

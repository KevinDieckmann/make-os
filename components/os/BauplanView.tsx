'use client';

// ─── MAKE OS — Bauplan ──────────────────────────────────────────────────────
// Was an MAKE OS noch fehlt — getrennt von Kevins echten Aufgaben. Vorschläge
// des Verbesserungs-Loops landen hier, Kevins Notizen von unterwegs auch.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile, LEUCHT).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import {
  KAT_LABEL, STATUS_LABEL, BLOCK_LABEL,
  type BacklogItem, type BacklogStatus, type BacklogKat, type BacklogBlock,
} from '@/lib/make-one/backlog-data';
import { localDay } from '@/lib/zeit';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Segmente, feld, LEUCHT } from './schlank';

const katColor = (k: BacklogKat) => (k === 'anbindung' ? LEUCHT.puls : k === 'agent' ? LEUCHT.agenten : k === 'qualitaet' ? LEUCHT.gut : LEUCHT.schlaf);
const blockColor = (b: BacklogBlock) => (b === 'frei' ? LEUCHT.gut : b === 'kevin' ? LEUCHT.achtung : C.inkLeise);
const prioColor = (p: 1 | 2 | 3) => (p === 1 ? LEUCHT.puls : p === 2 ? C.inkDim : C.inkLeise);
const statusColor = (s: BacklogStatus) => (s === 'laufend' ? LEUCHT.puls : s === 'erledigt' ? LEUCHT.gut : C.inkDim);
const STATI: BacklogStatus[] = ['offen', 'laufend', 'erledigt'];
const FILTER: { id: 'alle' | BacklogBlock; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'frei', label: BLOCK_LABEL.frei }, { id: 'kevin', label: BLOCK_LABEL.kevin }, { id: 'extern', label: BLOCK_LABEL.extern },
];
/** Ein Chip, den man anklicken kann — ohne eigenen Knopf-Rahmen. */
const nackt: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', font: 'inherit' };

export function BauplanView() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [speicherFehler, setSpeicherFehler] = useState(false);
  const [neu, setNeu] = useState('');
  const [filter, setFilter] = useState<'alle' | BacklogBlock>('alle');
  const [auf, setAuf] = useState<string | null>(null);
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
    <Seite titel="Bauplan" unter="Getrennt von deinen echten Aufgaben: hier steht, was an MAKE OS fehlt — Anbindungen, Agenten, Verbesserungen. Was dir unterwegs auffällt, trägst du ein; ich schreibe rein, was ich beim Bauen finde.">
      {/* Lieber ehrlich stehenbleiben als still eine leere Liste speichern. */}
      {ladeFehler && (
        <Karte i={0} akzent={LEUCHT.kritisch}>
          <Ueberschrift farbe={LEUCHT.kritisch}>Nicht geladen</Ueberschrift>
          <div style={{ fontSize: TYP.body, fontWeight: 600, color: LEUCHT.kritisch }}>Der Bauplan konnte nicht geladen werden.</div>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: '4px 0 0' }}>
            Deine Einträge sind nicht weg — sie liegen auf der Platte. Änderungen sind hier so lange gesperrt,
            damit nichts Leeres darüber geschrieben wird. Seite neu laden.
          </p>
        </Karte>
      )}
      {speicherFehler && !ladeFehler && (
        <Karte i={0} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung}>Nicht gespeichert</Ueberschrift>
          <div style={{ fontSize: TYP.body, fontWeight: 600, color: LEUCHT.achtung }}>Die letzte Änderung wurde nicht gespeichert.</div>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: '4px 0 0' }}>
            Entweder war der Server kurz weg, oder der Schutz hat abgelehnt, weil zu viel auf einmal verschwunden wäre.
            Seite neu laden und noch einmal versuchen.
          </p>
        </Karte>
      )}

      {/* Kennzahlen + Eingabe */}
      <Karte i={0} akzent={LEUCHT.puls}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={loaded ? `${items.length} Punkte insgesamt` : undefined}>Was wir noch bauen</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
          <Zahl wert={offen.length ? String(offen.length) : undefined} label="offen" />
          <Zahl wert={meine ? String(meine) : undefined} label="kann ich bauen" farbe={LEUCHT.gut} />
          <Zahl wert={deine ? String(deine) : undefined} label="braucht dich" farbe={LEUCHT.achtung} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <input
            value={neu} onChange={e => setNeu(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
            placeholder="Was ist dir aufgefallen? (Enter legt es an)"
            style={{ ...feld, flex: '1 1 240px', width: 'auto' }}
          />
          <Knopf onClick={addItem}>+ Notieren</Knopf>
        </div>
      </Karte>

      {/* Zeitstrahl — 90 Tage voraus; nur terminierte Punkte erscheinen */}
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={strahlMarker.length ? `${strahlMarker.length} terminiert` : undefined}>Zeitstrahl · 90 Tage</Ueberschrift>
        <Zeitstrahl von={heute} bis={strahlBis} ticks={ticks} marker={strahlMarker} />
        {ohneZiel > 0 && (
          <p style={{ fontSize: 12, color: C.inkLeise, margin: '8px 0 0', lineHeight: 1.5 }}>
            {ohneZiel} offene Punkte ohne Zieldatum — Datum am Punkt setzen, dann erscheinen sie hier.
          </p>
        )}
      </Karte>

      {/* Liste */}
      <Karte i={2}>
        <Ueberschrift rechts="Klick zeigt Warum & Zieldatum">Die Punkte</Ueberschrift>
        <div style={{ display: 'flex', overflowX: 'auto', marginBottom: 10 }}>
          <Segmente liste={FILTER} aktiv={filter} onWahl={setFilter} />
        </div>
        {!loaded ? (
          <Leer>lade Bauplan …</Leer>
        ) : (
          <Liste>
            {sichtbar.map(it => {
              const offenAuf = auf === it.id;
              const erledigt = it.status === 'erledigt';
              return (
                <div key={it.id} style={{ opacity: erledigt ? 0.5 : 1 }}>
                  <Zeile onClick={() => setAuf(a => (a === it.id ? null : it.id))} aktiv={offenAuf}
                    links={
                      <button onClick={e => { e.stopPropagation(); cyclePrio(it); }} title="Priorität wechseln" style={nackt}>
                        <Chip farbe={prioColor(it.prio)}>P{it.prio}</Chip>
                      </button>
                    }
                    titel={<span style={{ color: erledigt ? C.inkLeise : C.ink, textDecoration: erledigt ? 'line-through' : 'none' }}>{it.titel}</span>}
                    unter={it.warum ? <span title={it.warum}>{it.warum}</span> : it.quelle ? `aus: ${it.quelle}` : undefined}
                    rechts={
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Chip farbe={katColor(it.kategorie)}>{KAT_LABEL[it.kategorie]}</Chip>
                        <Chip farbe={blockColor(it.block)}>{BLOCK_LABEL[it.block]}</Chip>
                        <button onClick={e => { e.stopPropagation(); cycleStatus(it); }} title="Status wechseln" style={nackt}>
                          <Chip farbe={statusColor(it.status)}>{STATUS_LABEL[it.status]}</Chip>
                        </button>
                      </div>
                    } />
                  {offenAuf && (
                    <div style={{ padding: '6px 2px 14px' }}>
                      {it.warum && <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 }}>{it.warum}</p>}
                      {it.block === 'kevin' && it.brauche && (
                        <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: '8px 0 0' }}>
                          <b style={{ color: LEUCHT.achtung }}>Du brauchst: </b>{it.brauche}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.inkLeise }}>
                          Zieldatum
                          <input type="date" value={it.ziel ?? ''} title="Zieldatum — setzt den Punkt auf den Zeitstrahl"
                            onChange={e => persist(items.map(x => x.id === it.id ? { ...x, ziel: e.target.value || undefined } : x))}
                            style={{ ...feld, width: 'auto', padding: '7px 10px', fontSize: TYP.bedien, color: it.ziel ? C.ink : C.inkLeise, colorScheme: 'dark' }} />
                        </label>
                        {it.quelle && <span style={{ fontSize: 12, color: C.inkLeise }}>aus: {it.quelle}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!sichtbar.length && <Leer>Hier ist gerade nichts offen.</Leer>}
          </Liste>
        )}
      </Karte>
    </Seite>
  );
}

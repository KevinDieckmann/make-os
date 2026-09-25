'use client';

// ─── Bauplan — Planung ──────────────────────────────────────────────────────
// Kevin 25.09.: „wir müssen Planung in den Bau bekommen.“ Etappen bündeln
// Karten zu einem Ziel mit Datum (z. B. „Malin arbeitet täglich damit“ bis
// 10.10.) und zeigen, wie weit es ist. Karten kommen per Ziehen oder Auswahl
// hinein; der Zeitstrahl zeigt alles mit Datum.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, feld, Fortschritt, LEUCHT } from '../schlank';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from '../Zeitstrahl';
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { SPALTEN, board, spalteVon, artVon, etappenStand, type Etappe } from '@/lib/bauplan/board';
import { localDay, tagePlus } from '@/lib/zeit';
import { ART_FARBE, klein, datumKurz } from './gemeinsam';
import type { Tu } from './KarteDetail';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const tageBis = (heute: string, ziel: string) => Math.round((Date.parse(`${ziel}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86_400_000);

export function Planung({ items, etappen, tu, onOeffnen }: { items: BacklogItem[]; etappen: Etappe[]; tu: Tu; onOeffnen: (id: string) => void }) {
  const heute = localDay();
  const [form, setForm] = useState<Partial<Etappe> | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const aktiv = items.filter(i => !i.verworfen);
  const liste = [...etappen].sort((a, b) => (a.ziel ?? '9999').localeCompare(b.ziel ?? '9999') || a.name.localeCompare(b.name));
  const karten = board(items);
  // Ohne Etappe: erst was entschieden ist oder läuft, dann die Ideen — jeweils in Board-Reihenfolge.
  const ohne = (['bereit', 'arbeit', 'test', 'idee'] as const).flatMap(s => karten[s].filter(i => !i.etappe));
  const zuordnen = (id: string, etappe: string) => tu({ aktion: 'teil', id, felder: { etappe } }, l => l.map(i => (i.id === id ? { ...i, etappe: etappe || undefined } : i)));
  const speichern = async () => {
    if (!form?.name?.trim()) return;
    const r = await tu({ aktion: 'etappe', ...form });
    if (r.ok) setForm(null);
  };

  // Zeitstrahl: heute bis zum spätesten Datum (mindestens 8 Wochen, höchstens ein Jahr).
  const daten = [...liste.map(e => e.ziel), ...aktiv.filter(i => spalteVon(i) !== 'fertig').map(i => i.ziel)].filter((d): d is string => !!d && d >= heute);
  const bis = [tagePlus(heute, 56), ...daten.map(d => tagePlus(d, 7))].sort().at(-1)!;
  const strahlBis = bis > tagePlus(heute, 365) ? tagePlus(heute, 365) : bis;
  const ticks: StrahlTick[] = [];
  for (let d = new Date(`${heute}T12:00:00`), n = 0; n < 13; n++) {
    const erster = new Date(d.getFullYear(), d.getMonth() + 1 + n, 1, 12);
    const iso = `${erster.getFullYear()}-${String(erster.getMonth() + 1).padStart(2, '0')}-01`;
    if (iso > strahlBis) break;
    ticks.push({ date: iso, label: MONATE[erster.getMonth()] });
  }
  const marker: StrahlMarker[] = [
    ...liste.filter(e => e.ziel && e.ziel >= heute && e.ziel <= strahlBis).map(e => ({ date: e.ziel!, label: e.name, farbe: LEUCHT.agenten, symbol: '◇', titel: `Etappe: ${e.name}` })),
    ...aktiv.filter(i => i.ziel && i.ziel >= heute && i.ziel <= strahlBis && spalteVon(i) !== 'fertig').map(i => ({ date: i.ziel!, label: i.titel, farbe: ART_FARBE[artVon(i)], symbol: '●', titel: i.titel, href: `/os/bauplan?s=plan&k=${i.id}` })),
  ];
  const ueberfaellig = aktiv.filter(i => i.ziel && i.ziel < heute && spalteVon(i) !== 'fertig');

  return (
    <>
      <Karte i={0} akzent={LEUCHT.puls}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={marker.length ? `${marker.length} mit Datum` : undefined}>Zeitstrahl</Ueberschrift>
        <Zeitstrahl von={heute} bis={strahlBis} ticks={ticks} marker={marker} />
        {ueberfaellig.length > 0 && (
          <div style={{ ...klein, color: LEUCHT.achtung, marginTop: 8 }}>
            Überfällig: {ueberfaellig.map((i, n) => <span key={i.id}>{n ? ', ' : ''}<button onClick={() => onOeffnen(i.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>{i.titel}</button> ({datumKurz(i.ziel)})</span>)}
          </div>
        )}
        {!marker.length && !ueberfaellig.length && <div style={{ ...klein, marginTop: 8 }}>Noch nichts mit Datum. Gib einer Etappe oder Karte ein Zieldatum, dann erscheint sie hier.</div>}
      </Karte>

      <Karte i={1} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten} rechts={!form ? <Knopf leise onClick={() => setForm({ name: '' })}>+ Etappe</Knopf> : undefined}>Etappen</Ueberschrift>
        {form && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 14, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
            <input autoFocus value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void speichern(); }} placeholder="Name der Etappe, z. B. „Malin arbeitet täglich damit“" style={{ ...feld, fontSize: TYP.bedien }} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 4 }}><span style={klein}>Zieldatum</span><input type="date" value={form.ziel ?? ''} onChange={e => setForm({ ...form, ziel: e.target.value })} style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' }} /></label>
              <label style={{ display: 'grid', gap: 4, flex: '1 1 240px' }}><span style={klein}>Worum geht es? (optional)</span><input value={form.beschreibung ?? ''} onChange={e => setForm({ ...form, beschreibung: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}><Knopf aus={!form.name?.trim()} onClick={() => void speichern()}>Speichern</Knopf><Knopf leise onClick={() => setForm(null)}>Abbrechen</Knopf></div>
          </div>
        )}
        {!liste.length && !form && <div style={klein}>Noch keine Etappe. Eine Etappe bündelt Karten zu einem Ziel mit Datum, z. B. „Finanzen mit Malin fertig“ bis 10.10.</div>}
        <div style={{ display: 'grid', gap: 12 }}>
          {liste.map(e => {
            const st = etappenStand(items, e);
            const drin = SPALTEN.flatMap(s => karten[s.id].filter(i => i.etappe === e.id));
            const rest = e.ziel ? tageBis(heute, e.ziel) : null;
            return (
              <div key={e.id}
                onDragOver={ev => { ev.preventDefault(); if (ueber !== e.id) setUeber(e.id); }}
                onDragLeave={() => setUeber(null)}
                onDrop={ev => { ev.preventDefault(); setUeber(null); const id = ev.dataTransfer.getData('text/plain'); if (id) void zuordnen(id, e.id); }}
                style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: `1px solid ${ueber === e.id ? LEUCHT.agenten : 'rgba(255,255,255,.06)'}`, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: TYP.body, fontWeight: 700 }}>{e.name}</div>
                    <div style={klein}>
                      {e.ziel ? <>bis {datumKurz(e.ziel)} · <span style={{ color: rest! < 0 ? LEUCHT.kritisch : rest! <= 7 ? LEUCHT.achtung : C.inkLeise }}>{rest! < 0 ? `${-rest!} Tage drüber` : rest === 0 ? 'heute' : `noch ${rest} Tage`}</span></> : 'ohne Datum'}
                      {e.beschreibung ? ` · ${e.beschreibung}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Knopf leise onClick={() => setForm({ ...e })}>Ändern</Knopf>
                    <Knopf leise onClick={() => { if (window.confirm(`Etappe „${e.name}“ entfernen? Die Karten bleiben, nur die Zuordnung fällt weg.`)) void tu({ aktion: 'etappe_weg', id: e.id }); }}>Entfernen</Knopf>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><Fortschritt anteil={st.anteil} farbe={st.anteil >= 1 ? LEUCHT.gut : LEUCHT.agenten} /></div>
                  <span style={{ ...klein, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{st.fertig} von {st.gesamt} fertig{st.imTest ? ` · ${st.imTest} im Test` : ''}</span>
                </div>
                {drin.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {drin.map(i => <Reihe key={i.id} k={i} onOeffnen={onOeffnen} />)}
                  </div>
                ) : <div style={klein}>Noch keine Karten — zieh eine Karte hierher oder wähle unten die Etappe.</div>}
              </div>
            );
          })}
        </div>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={ohne.length ? `${ohne.length} offen` : undefined}>Noch ohne Etappe</Ueberschrift>
        {!ohne.length && <div style={klein}>Alles Offene ist einer Etappe zugeordnet.</div>}
        <div style={{ display: 'grid', gap: 4 }}>
          {ohne.map(i => (
            <Reihe key={i.id} k={i} onOeffnen={onOeffnen} rechts={liste.length > 0 && (
              <select value="" onChange={e => { if (e.target.value) void zuordnen(i.id, e.target.value); }} aria-label="Etappe zuordnen" onClick={e => e.stopPropagation()}
                style={{ ...feld, width: 'auto', fontSize: 12.5, padding: '5px 8px', borderRadius: 9 }}>
                <option value="">→ Etappe</option>
                {liste.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )} />
          ))}
        </div>
      </Karte>
    </>
  );
}

function Reihe({ k, onOeffnen, rechts }: { k: BacklogItem; onOeffnen: (id: string) => void; rechts?: React.ReactNode }) {
  const s = spalteVon(k);
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData('text/plain', k.id); e.dataTransfer.effectAllowed = 'move'; }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 9, cursor: 'grab' }} className="fassbar">
      <span style={{ fontSize: 11.5, fontWeight: 700, color: s === 'fertig' ? LEUCHT.gut : s === 'test' ? LEUCHT.achtung : s === 'bereit' || s === 'arbeit' ? LEUCHT.puls : C.inkLeise, width: 78, flex: '0 0 auto' }}>{SPALTEN.find(x => x.id === s)?.label}</span>
      <button onClick={() => onOeffnen(k.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: s === 'fertig' ? C.inkLeise : C.ink, fontSize: TYP.bedien, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: s === 'fertig' ? 'line-through' : 'none' }}>
        <span style={{ color: ART_FARBE[artVon(k)], marginRight: 6 }}>●</span>{k.titel}
      </button>
      {k.ziel && <span style={{ ...klein, whiteSpace: 'nowrap' }}>{datumKurz(k.ziel)}</span>}
      {rechts}
    </div>
  );
}

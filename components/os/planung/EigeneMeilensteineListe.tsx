'use client';

// ─── MAKE OS — Eigene Meilensteine an einem eigenen Ziel (10.10., Kevin: „Ja, eigene Meilensteine“) ──────────────────────────────
// Aufgeklappt unter einem Ziel in „Meine Ziele“ (anlegen per Enter, Datum optional, abhaken, löschen mit „Rückgängig“) bzw. in der Spalte der
// anderen Person (nur lesen — der Server schickt nur Meilensteine geteilter Ziele). Daten nur über `useEigeneMeilensteine`; der Fortschritt des
// Ziels folgt den Meilensteinen (lib/planung/eigene-meilensteine.ts `eigenesZielFortschritt`). Bausteine aus components/os/ui.

import { useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { neueKennung } from '@/lib/kennung';
import { ohneStand } from '@/lib/make-one/liste-stand';
import { meilensteineDesZiels, type EigenerMeilenstein } from '@/lib/planung/eigene-meilensteine';
import { HakenZiel, Hinweis, Knopf, ZeileAktionen, feld, LEUCHT, type Rueckgaengig } from '../ui';
import type { EigeneMeilensteineStand } from './useEigeneMeilensteine';

const dtKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const leiseKnopf: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', fontFamily: SCHRIFT.text, minHeight: 44 };

/** Reihenfolge: offene nach Datum (ohne Datum hinten), dann Rang; Erledigtes unten. */
function geordnet(ms: readonly EigenerMeilenstein[]): EigenerMeilenstein[] {
  const schluessel = (m: EigenerMeilenstein) => `${m.erledigt ? 1 : 0}|${m.faellig ?? '9999-99-99'}|${String(m.rang ?? 9999).padStart(4, '0')}`;
  return [...ms].sort((a, b) => schluessel(a).localeCompare(schluessel(b)));
}

export interface EigeneMeilensteineListeProps {
  zielId: string;
  zielTitel: string;
  /** Der Stand aus `useEigeneMeilensteine` (eigene bzw. die geteilten der anderen Person). */
  stand: EigeneMeilensteineStand;
  /** Schreiben erlaubt (nur „Meine Ziele“). */
  darf: boolean;
  rueck: Rueckgaengig;
  farbe: string;
  heute: string;
}

export function EigeneMeilensteineListe({ zielId, zielTitel, stand, darf, rueck, farbe, heute }: EigeneMeilensteineListeProps) {
  const aktuell = useRef(stand); aktuell.current = stand;
  const ms = geordnet(meilensteineDesZiels(zielId, stand.ms));
  const [neu, setNeu] = useState({ titel: '', faellig: '' });
  const [datumFuer, setDatumFuer] = useState<string | null>(null);

  const aendern = (id: string, patch: Partial<EigenerMeilenstein>) => { const s = aktuell.current; s.persist(s.ms.map(m => (m.id === id ? { ...m, ...patch } : m))); };
  const anlegen = () => {
    const titel = neu.titel.trim();
    if (!titel || !darf) return;
    const rang = Math.max(0, ...meilensteineDesZiels(zielId, stand.ms).map(m => m.rang ?? 0)) + 1;
    const m: EigenerMeilenstein = { id: neueKennung('mse'), titel, zielId, fortschritt: 0, erledigt: false, rang, ...(neu.faellig ? { faellig: neu.faellig } : {}) };
    stand.persist([...stand.ms, m]);
    setNeu({ titel: '', faellig: '' });
  };
  const abhaken = (m: EigenerMeilenstein) => aendern(m.id, m.erledigt ? { erledigt: false, erledigtAm: undefined, fortschritt: 0 } : { erledigt: true, erledigtAm: heute, fortschritt: 100 });
  const loeschen = (m: EigenerMeilenstein) => {
    const s = aktuell.current;
    s.persist(s.ms.filter(x => x.id !== m.id));
    rueck.melden(`Meilenstein „${m.titel}“ gelöscht`, () => {
      const q = aktuell.current;
      if (!q.ms.some(x => x.id === m.id)) q.persist([...q.ms, ohneStand(m as EigenerMeilenstein & { stand?: string })]);
    });
  };

  return (
    <div style={{ margin: '2px 0 8px 36px', display: 'grid', gap: 2 }} aria-label={`Meilensteine von „${zielTitel}“`} role="group">
      {darf && stand.hinweis && <Hinweis art="achtung">{stand.hinweis}</Hinweis>}
      {!ms.length && !darf && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine Meilensteine.</span>}
      {ms.map(m => {
        const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;
        const zeile = (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: TYP.bedien, color: m.erledigt ? C.inkLeise : C.inkDim }}>
            {darf
              ? <HakenZiel an={m.erledigt} farbe={farbe} label={m.titel} onChange={() => abhaken(m)} />
              : <span aria-hidden style={{ width: 24, textAlign: 'center', color: m.erledigt ? LEUCHT.gut : LEUCHT.achtung, flex: '0 0 auto' }}>{m.erledigt ? '✓' : '◆'}</span>}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.titel}</span>
            {darf && datumFuer === m.id
              ? <input type="date" autoFocus value={m.faellig ?? ''} aria-label={`Datum „${m.titel}“`} onChange={e => aendern(m.id, { faellig: e.target.value || undefined })} onBlur={() => setDatumFuer(null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setDatumFuer(null); }} style={{ ...feld, width: 'auto', flex: '0 1 150px', colorScheme: 'dark' }} />
              : darf
                ? <button type="button" onClick={() => setDatumFuer(m.id)} aria-label={m.faellig ? `Datum „${m.titel}“ ändern` : `Datum für „${m.titel}“ setzen`} title="Datum (optional)"
                    style={{ ...leiseKnopf, color: spaet ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{m.faellig ? `${spaet ? 'überfällig ' : ''}${dtKurz(m.faellig)}` : '+ Datum'}</button>
                : m.faellig && <span style={{ color: spaet ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{spaet ? 'überfällig ' : ''}{dtKurz(m.faellig)}</span>}
          </div>
        );
        return <div key={m.id}>{darf ? <ZeileAktionen titel={m.titel} onLoeschen={() => loeschen(m)}>{zeile}</ZeileAktionen> : zeile}</div>;
      })}
      {darf && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
            aria-label={`Neuer Meilenstein für „${zielTitel}“`} placeholder="+ Meilenstein …" style={{ ...feld, width: 'auto', flex: '1 1 150px', minWidth: 0 }} />
          {!!neu.titel.trim() && (
            <input type="date" value={neu.faellig} onChange={e => setNeu({ ...neu, faellig: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
              aria-label="Datum (optional)" title="Datum (optional)" style={{ ...feld, width: 'auto', flex: '0 1 150px', colorScheme: 'dark' }} />
          )}
          <Knopf onClick={anlegen} aus={!neu.titel.trim()} farbe={farbe}>+ Meilenstein</Knopf>
        </div>
      )}
    </div>
  );
}

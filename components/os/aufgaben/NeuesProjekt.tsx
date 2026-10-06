'use client';
// ─── „+ Projekt“ je Firma/Space — ein Dialog (06.10., Malins Bauplan-Karte) ───────────────────────────
// Name, Farbe (Auswahl, Vorgabe = Farbe des Space) und optional eine Projekt-Vorlage (dann mit Startdatum — Deadlines = Start +
// Versatz). Projekte entstehen NUR hier (die Schnelleingabe legt immer eine Aufgabe an, das Detail keine Projekte mehr).
// Geschrieben wird über den Aufgaben-Kontext (Einzeländerungen mit Stand); die Vorlage nach lib/aufgaben/vorlagen.ts
// (`ausVorlageAnlegen`, alte Vorlagen mit Gruppen nach der Regel des Umbaus v3).

import { useState } from 'react';
import { Check } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, RAND, LEUCHT } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf, Feldzeile, eingabe, auswahl } from '../ui';
import { useTasks } from '@/context/TasksContext';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import { ausVorlageAnlegen, vorlagenFuer, vorlageUmfang } from '@/lib/aufgaben/vorlagen';
import { berlinerTag } from '@/lib/aufgaben/wiederholung';
import type { Owner } from '@/types/common';
import { LISTEN_FARBEN, neueKennung, projektAnlegen, useIch } from './hilfe';

const TITEL_MAX = 120;

export function NeuesProjektDialog({ space, onZu, onAngelegt }: { space: Pick<AufgabenSpace, 'id' | 'label' | 'farbe'>; onZu: () => void; onAngelegt?: (projektId: string) => void }) {
  const { state, dispatch } = useTasks();
  const ich = useIch();
  const [name, setName] = useState('');
  const [farbe, setFarbe] = useState(space.farbe);
  const [vorlageId, setVorlageId] = useState('');
  const [start, setStart] = useState(berlinerTag());
  const [fehler, setFehler] = useState<string | null>(null);
  const vorlagen = vorlagenFuer(state.vorlagen, 'projekt', space.id);
  const vorlage = vorlagen.find(v => v.id === vorlageId);
  const farben = Array.from(new Set([space.farbe, ...LISTEN_FARBEN]));
  const umfang = vorlage ? vorlageUmfang(vorlage) : null;

  const anlegen = () => {
    const titel = name.replace(/\s+/g, ' ').trim();
    if (!titel) { setFehler('Bitte einen Namen geben.'); return; }
    if (titel.length > TITEL_MAX) { setFehler(`Zu lang — höchstens ${TITEL_MAX} Zeichen (jetzt ${titel.length}).`); return; }
    let id: string;
    if (vorlage) {
      const r = ausVorlageAnlegen(vorlage, state, { spaceId: space.id, start, titel, owner: (ich || 'both') as Owner, praefix: neueKennung('p'), jetzt: new Date().toISOString(), farbe });
      if (!r.projekt) { setFehler('Die Vorlage passt nicht zu einem Projekt.'); return; }
      const { createdAt: _c, updatedAt: _u, ...p } = r.projekt;
      dispatch({ type: 'ADD_PROJECT_MIT_ID', payload: { ...p, title: titel } });
      for (const l of r.listen) dispatch({ type: 'ADD_LISTE', payload: l });
      for (const t of r.tasks) { const { createdAt: _c2, updatedAt: _u2, ...rest } = t; dispatch({ type: 'ADD_TASK_MIT_ID', payload: rest }); }
      id = r.projekt.id;
    } else {
      id = projektAnlegen(dispatch, space.id, titel, farbe);
    }
    onAngelegt?.(id);
    onZu();
  };

  return (
    <Fenster titel={`Neues Projekt in ${space.label}`} onZu={onZu} breit={560}>
      <form onSubmit={e => { e.preventDefault(); anlegen(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Name" fehler={fehler ?? undefined}>
          <input autoFocus value={name} onChange={e => { setName(e.target.value); setFehler(null); }} maxLength={TITEL_MAX + 20} placeholder="z. B. Rechnungswesen" aria-label="Name des Projekts" style={eingabe} />
        </Feldzeile>
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Farbe</span>
          <div role="radiogroup" aria-label="Farbe des Projekts" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {farben.map(f => (
              <button key={f} type="button" role="radio" aria-checked={f === farbe} aria-label={f === space.farbe ? `Farbe des Space (${f})` : `Farbe ${f}`} onClick={() => setFarbe(f)} className="fassbar"
                style={{ width: 44, height: 44, borderRadius: 999, cursor: 'pointer', display: 'grid', placeItems: 'center', background: f, border: f === farbe ? `2px solid ${C.ink}` : `1px solid ${RAND.stark}`, boxShadow: f === farbe ? `0 0 0 3px ${f}55` : 'none' }}>
                {f === farbe && <Check size={16} aria-hidden style={{ color: '#0B0F11' }} />}
              </button>
            ))}
          </div>
        </div>
        <Feldzeile label="Vorlage (optional)">
          <select value={vorlageId} onChange={e => setVorlageId(e.target.value)} aria-label="Vorlage" style={auswahl}>
            <option value="">ohne Vorlage — leeres Projekt</option>
            {vorlagen.map(v => <option key={v.id} value={v.id}>{v.titel}</option>)}
          </select>
        </Feldzeile>
        {vorlage && (
          <Feldzeile label="Start (Deadlines ab hier)">
            <input type="date" value={start} onChange={e => setStart(e.target.value || berlinerTag())} aria-label="Startdatum" style={{ ...eingabe, colorScheme: 'dark' }} />
          </Feldzeile>
        )}
        {umfang && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontFamily: SCHRIFT.text }}>Legt an: {umfang.listen} Liste{umfang.listen === 1 ? '' : 'n'} · {umfang.aufgaben} Aufgabe{umfang.aufgaben === 1 ? '' : 'n'}{umfang.unter ? ` · ${umfang.unter} Unteraufgabe${umfang.unter === 1 ? '' : 'n'}` : ''}</span>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" farbe={LEUCHT.gut} aus={!name.trim()}>Projekt anlegen</Knopf>
        </div>
      </form>
    </Fenster>
  );
}

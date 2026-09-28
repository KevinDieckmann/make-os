'use client';
// ─── Wiederkehrende Liste einstellen (Paket C3, 28.09. spät) ────────────────
// z. B. jeden Monat „Monatsabschluss {Monat} {Jahr}“: Regel, Titel-Muster und Vorlage (die Aufgaben dieser Liste
// oder eine vorhandene Listen-Vorlage). Gespeichert wird `wiederholung` (mit `naechste` = Start der nächsten Periode)
// + `vorlageId` an der Liste; das Muster ist der Name der Vorlage. Die neue Liste legt der Morgenlauf an
// (/api/tagesstart → lib/aufgaben/serie-server.ts). `ListeSerieKnopf` = das ↻ am Listenkopf zum Einhängen.

import { useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf, feld } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import type { AufgabenListe, Wiederholung } from '@/types/tasks';
import { listenMuster, listenSerieStarten } from '@/lib/aufgaben/serie';
import { vorlageAusListe, vorlageFinden, vorlagenFuer, vorlageUmfang, vorlageZuGross } from '@/lib/aufgaben/vorlagen';
import { berlinerTag, hatPlatzhalter, kurzTag, titelMitPlatzhaltern, vorherigerTermin, wiederholungText } from '@/lib/aufgaben/wiederholung';
import { WiederholungWahl, SerienZeichen } from './WiederholungWahl';
import { VorlagenDialog } from './VorlagenDialog';
import { neueKennung } from './hilfe';

const DIESE = '__diese-liste__';
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const zeile: CSSProperties = { display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: 10, alignItems: 'center' };
const eingabe: CSSProperties = { ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' };

export function SerienListeEinstellen({ liste, onSchliessen }: { liste: AufgabenListe; onSchliessen: () => void }) {
  const { state, dispatch } = useTasks();
  const heute = berlinerTag();
  const spaceId = state.projects.find(p => p.id === liste.projektId)?.spaceId;
  const vorhanden = vorlageFinden(state.vorlagen, liste.vorlageId);
  const [w, setW] = useState<Wiederholung | undefined>(liste.wiederholung ?? { regel: 'monatlich', monatstag: 1 });
  const [quelle, setQuelle] = useState<string>(vorhanden?.art === 'liste' ? vorhanden.id : DIESE);
  const [muster, setMuster] = useState<string | null>(vorhanden && hatPlatzhalter(vorhanden.titel) ? vorhanden.titel : null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [alsVorlage, setAlsVorlage] = useState(false);
  const gewaehlt = quelle === DIESE ? undefined : vorlageFinden(state.vorlagen, quelle);
  const musterJetzt = muster ?? (w ? listenMuster(liste, w, gewaehlt) : liste.titel);
  const start = w ? listenSerieStarten(w, heute) : null;
  const listenVorlagen = vorlagenFuer(state.vorlagen, 'liste', spaceId);
  const anzahlHier = state.tasks.filter(t => t.listeId === liste.id && !t.parentId).length;

  const speichern = () => {
    if (!w) { dispatch({ type: 'UPDATE_LISTE', payload: { id: liste.id, wiederholung: undefined } }); onSchliessen(); return; }
    if (!start?.naechste) { setFehler('Mit diesem „bis“ gäbe es keine nächste Liste mehr.'); return; }
    const m = musterJetzt.trim();
    if (!m) { setFehler('Bitte ein Titel-Muster angeben.'); return; }
    // Die Vorlage trägt das Muster als Namen. „Aus dieser Liste“ legt immer eine neue an — eine gewählte (vielleicht
    // auch anderswo genutzte) Vorlage wird nie überschrieben.
    let vorlageId: string;
    if (quelle === DIESE) {
      const bezug = vorherigerTermin(w, start.naechste) ?? heute;
      const v = vorlageAusListe(state, liste.id, { id: neueKennung('v'), titel: m, bezugsTag: bezug, ...(spaceId ? { spaceId } : {}) });
      if (!v) return;
      const zuGross = vorlageZuGross(v);
      if (zuGross) { setFehler(zuGross); return; }
      dispatch({ type: 'ADD_VORLAGE', payload: v });
      vorlageId = v.id;
    } else if (gewaehlt && gewaehlt.titel !== m) {
      // Eigenes Muster zu einer fremden/mitgelieferten Vorlage → eigene Kopie mit diesem Namen.
      const kopie = { ...gewaehlt, id: neueKennung('v'), titel: m.slice(0, 120), angelegt: new Date().toISOString() };
      dispatch({ type: 'ADD_VORLAGE', payload: kopie });
      vorlageId = kopie.id;
    } else vorlageId = quelle;
    dispatch({ type: 'UPDATE_LISTE', payload: { id: liste.id, wiederholung: start, vorlageId } });
    onSchliessen();
  };

  return (
    <Fenster titel={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><SerienZeichen w={w ?? { regel: 'monatlich' }} groesse={18} />Wiederkehrende Liste · {liste.titel}</span>} onZu={onSchliessen} breit={620}>
      <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        Zu jedem Termin legt der Morgenlauf eine neue Liste mit den Aufgaben der Vorlage an — Deadlines ab dem Listenstart.
        Verpasste Perioden holt er einzeln nach, nie mehrere auf einmal.
      </p>
      <label style={zeile}><span style={mikro}>Wiederholt</span>
        <WiederholungWahl wert={w} onChange={n => { setW(n); setFehler(null); }} vorschau="ab-morgen" /></label>
      {w && <>
        <label style={zeile}><span style={mikro}>Aufgaben aus</span>
          <select value={quelle} onChange={e => { setQuelle(e.target.value); setMuster(null); }} style={eingabe} aria-label="Vorlage">
            <option value={DIESE}>dieser Liste ({anzahlHier} Aufgabe{anzahlHier === 1 ? '' : 'n'})</option>
            {listenVorlagen.map(v => <option key={v.id} value={v.id}>Vorlage „{v.titel}“ ({vorlageUmfang(v).aufgaben})</option>)}
          </select></label>
        <label style={zeile}><span style={mikro}>Titel-Muster</span>
          <input value={musterJetzt} onChange={e => setMuster(e.target.value)} maxLength={120} style={eingabe} aria-label="Titel-Muster" placeholder="Monatsabschluss {Monat} {Jahr}" /></label>
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>
          Platzhalter {'{Monat}'} {'{Jahr}'} {'{KW}'} {'{Datum}'} · {wiederholungText(w)}
          {start?.naechste ? ` · nächste Liste am ${kurzTag(start.naechste)}: „${titelMitPlatzhaltern(musterJetzt, start.naechste)}“` : ' · keine weitere Liste'}
        </span>
      </>}
      {fehler && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setAlsVorlage(true)} style={{ marginRight: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>Nur als Vorlage speichern …</button>
        {liste.wiederholung && <Knopf leise onClick={() => { dispatch({ type: 'UPDATE_LISTE', payload: { id: liste.id, wiederholung: undefined } }); onSchliessen(); }}>Serie beenden</Knopf>}
        <Knopf leise onClick={onSchliessen}>Abbrechen</Knopf>
        <Knopf onClick={speichern}>{w ? 'Speichern' : 'Ohne Wiederholung speichern'}</Knopf>
      </div>
      {alsVorlage && <VorlagenDialog auftrag={{ modus: 'speichern', art: 'liste', id: liste.id }} onSchliessen={() => setAlsVorlage(false)} />}
    </Fenster>
  );
}

/** ↻ am Listenkopf: leuchtet bei wiederkehrenden Listen, öffnet das Einstellen. Für virtuelle Listen („Sonstige“) nichts. */
export function ListeSerieKnopf({ listeId }: { listeId: string }) {
  const { state } = useTasks();
  const [auf, setAuf] = useState(false);
  const liste = (state.listen ?? []).find(l => l.id === listeId);
  if (!liste) return null;
  const w = liste.wiederholung;
  return (
    <>
      <button onClick={() => setAuf(true)} className="fassbar" aria-label={w ? `Wiederkehrend: ${wiederholungText(w)} — einstellen` : 'Als wiederkehrende Liste einstellen'}
        title={w ? `wiederkehrend: ${wiederholungText(w)}${w.naechste ? ` · nächste Liste ${kurzTag(w.naechste)}` : ''}` : 'wiederkehrend einstellen'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 14, lineHeight: 1, fontWeight: 700, color: w ? C.aktiv : 'rgba(255,255,255,.28)', fontFamily: SCHRIFT.text }}>↻</button>
      {auf && <SerienListeEinstellen liste={liste} onSchliessen={() => setAuf(false)} />}
    </>
  );
}

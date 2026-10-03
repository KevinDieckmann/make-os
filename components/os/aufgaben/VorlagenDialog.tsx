'use client';
// ─── Vorlagen: speichern und anlegen (Paket C3, 28.09. spät) ────────────────
// „Als Vorlage speichern“ (Projekt oder Liste → nur Struktur, ohne CRM-Bezüge, Kommentare, Dateien) und
// „Aus Vorlage anlegen“ (Space/Projekt wählen, Startdatum → Deadlines = Start + Versatz). Dazu die drei
// mitgelieferten Startvorlagen. Rein in lib/aufgaben/vorlagen.ts; geschrieben wird über den Aufgaben-Kontext
// (Einzeländerungen mit Stand). `VorlagenKnopf` = der eine Knopf zum Einhängen.

import { useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf, Segmente, feld } from '../ui';
import { useTasks } from '@/context/TasksContext';
import type { AufgabenVorlage } from '@/types/tasks';
import { sonstigeProjektId } from '@/lib/aufgaben/struktur';
import {
  alleVorlagen, ausVorlageAnlegen, bezugsTagVon, istStartvorlage, vorlageAusListe, vorlageAusProjekt, vorlagenFuer, vorlageUmfang, vorlageZuGross,
} from '@/lib/aufgaben/vorlagen';
import { berlinerTag, langTag, tagPlus, titelMitPlatzhaltern } from '@/lib/aufgaben/wiederholung';
import { neueKennung, projekteImSpace, spacesOderFest, useIch } from './hilfe';

export type VorlagenAuftrag =
  | { modus: 'speichern'; art: 'projekt' | 'liste'; id: string }
  | { modus: 'anlegen'; spaceId: string; projektId?: string; art?: 'projekt' | 'liste' };

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const zeile: CSSProperties = { display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, alignItems: 'center' };
const eingabe: CSSProperties = { ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' };
const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '4px 6px' };

function Umfang({ v }: { v: Pick<AufgabenVorlage, 'inhalt'> }) {
  const u = vorlageUmfang(v);
  const teile = [u.gruppen ? `${u.gruppen} Gruppe${u.gruppen === 1 ? '' : 'n'}` : '', u.listen ? `${u.listen} Liste${u.listen === 1 ? '' : 'n'}` : '', `${u.aufgaben} Aufgabe${u.aufgaben === 1 ? '' : 'n'}`, u.unter ? `${u.unter} Unteraufgabe${u.unter === 1 ? '' : 'n'}` : ''].filter(Boolean);
  return <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{teile.join(' · ')}</span>;
}

/** Der Dialog. Speichern: aus Projekt/Liste; Anlegen: Vorlage wählen → Ziel + Start. */
export function VorlagenDialog({ auftrag, onSchliessen }: { auftrag: VorlagenAuftrag; onSchliessen: () => void }) {
  return auftrag.modus === 'speichern'
    ? <Speichern art={auftrag.art} id={auftrag.id} onSchliessen={onSchliessen} />
    : <Anlegen spaceId={auftrag.spaceId} projektId={auftrag.projektId} artStart={auftrag.art} onSchliessen={onSchliessen} />;
}

function Speichern({ art, id, onSchliessen }: { art: 'projekt' | 'liste'; id: string; onSchliessen: () => void }) {
  const { state, dispatch } = useTasks();
  const projekt = art === 'projekt' ? state.projects.find(p => p.id === id) : undefined;
  const liste = art === 'liste' ? (state.listen ?? []).find(l => l.id === id) : undefined;
  const spaceId = projekt?.spaceId ?? state.projects.find(p => p.id === liste?.projektId)?.spaceId;
  const vorschlag = art === 'projekt'
    ? (projekt?.start ?? bezugsTagVon(state.tasks.filter(t => t.projectId === id)))
    : bezugsTagVon(state.tasks.filter(t => t.listeId === id));
  const [titel, setTitel] = useState(projekt?.title ?? liste?.titel ?? '');
  const [bezug, setBezug] = useState(vorschlag ?? '');
  const [nurHier, setNurHier] = useState(false);
  // #70 (29.09.): Versatz in Werktagen ohne Feiertage NRW — Deadlines fallen beim Anlegen nie aufs Wochenende/einen Feiertag.
  const [werktage, setWerktage] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const kennung = useMemo(() => neueKennung('v'), []);
  const v = art === 'projekt'
    ? vorlageAusProjekt(state, id, { id: kennung, titel, bezugsTag: bezug || undefined, werktage, ...(nurHier && spaceId ? { spaceId } : {}) })
    : vorlageAusListe(state, id, { id: kennung, titel, bezugsTag: bezug || undefined, werktage, ...(nurHier && spaceId ? { spaceId } : {}) });
  if (!v) return <Fenster titel="Als Vorlage speichern" onZu={onSchliessen} breit={560}><span style={{ color: C.inkLeise }}>Nicht mehr vorhanden.</span></Fenster>;
  const speichern = () => {
    if (!titel.trim()) { setFehler('Bitte einen Namen geben.'); return; }
    const zuGross = vorlageZuGross(v);
    if (zuGross) { setFehler(zuGross); return; }
    dispatch({ type: 'ADD_VORLAGE', payload: { ...v, titel: titel.trim().slice(0, 120) } });
    onSchliessen();
  };
  return (
    <Fenster titel={art === 'projekt' ? 'Projekt als Vorlage speichern' : 'Liste als Vorlage speichern'} onZu={onSchliessen} breit={580}>
      <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        Gespeichert wird nur die Struktur{art === 'projekt' ? ': Gruppen, Listen, Aufgaben, Unteraufgaben, eigene Felder und die Notiz' : ': Aufgaben und Unteraufgaben'} —
        ohne Verknüpfungen ins CRM, Kommentare, Dateien und Verlauf. Deadlines werden zum Abstand in Tagen ab dem Bezugstag.
      </p>
      <label style={zeile}><span style={mikro}>Name</span>
        <input value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} style={eingabe} placeholder="z. B. Monatsabschluss {Monat} {Jahr}" aria-label="Name der Vorlage" /></label>
      <label style={zeile}><span style={mikro}>Bezugstag</span>
        <input type="date" value={bezug} onChange={e => setBezug(e.target.value)} style={eingabe} aria-label="Bezugstag" /></label>
      {spaceId && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
        <input type="checkbox" checked={nurHier} onChange={e => setNurHier(e.target.checked)} /> nur in diesem Space anbieten</label>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
        <input type="checkbox" checked={werktage} onChange={e => setWerktage(e.target.checked)} /> Abstand in Werktagen (ohne Wochenende und Feiertage NRW)</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Umfang v={v} />
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Platzhalter im Namen: {'{Monat}'} {'{Jahr}'} {'{KW}'} {'{Datum}'}</span>
      </div>
      {fehler && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Knopf leise onClick={onSchliessen}>Abbrechen</Knopf>
        <Knopf onClick={speichern} aus={!titel.trim()}>Als Vorlage speichern</Knopf>
      </div>
    </Fenster>
  );
}

function Anlegen({ spaceId: startSpace, projektId: startProjekt, artStart, onSchliessen }: { spaceId: string; projektId?: string; artStart?: 'projekt' | 'liste'; onSchliessen: () => void }) {
  const { state, dispatch, spaces: roh } = useTasks();
  const ich = useIch();
  const spaces = spacesOderFest(roh).filter(s => !s.archiv || s.id === startSpace);
  const [art, setArt] = useState<'projekt' | 'liste'>(artStart ?? (startProjekt ? 'liste' : 'projekt'));
  const [spaceId, setSpaceId] = useState(startSpace);
  const [projektId, setProjektId] = useState(startProjekt ?? sonstigeProjektId(startSpace));
  const [gruppeId, setGruppeId] = useState('');
  const [start, setStart] = useState(berlinerTag());
  const liste = vorlagenFuer(state.vorlagen, art, spaceId);
  const [gewaehlt, setGewaehlt] = useState<string>('');
  const v = liste.find(x => x.id === gewaehlt) ?? liste[0];
  const [titel, setTitel] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const projekte = projekteImSpace(state, spaceId);
  const gruppen = (state.gruppen ?? []).filter(g => g.projektId === projektId);
  const space = spaces.find(s => s.id === spaceId);
  const titelJetzt = titel ?? v?.titel ?? '';
  const u = v ? vorlageUmfang(v) : null;

  const anlegen = () => {
    if (!v) return;
    const r = ausVorlageAnlegen(v, state, {
      spaceId, projektId: art === 'liste' ? projektId : undefined, gruppeId: art === 'liste' && gruppeId ? gruppeId : undefined, start, titel: titelJetzt,
      owner: ich === 'kevin' || ich === 'malin' ? ich : 'kevin', praefix: neueKennung(art === 'projekt' ? 'p' : 'l'), jetzt: new Date().toISOString(), farbe: space?.farbe,
    });
    if (r.projekt) { const { createdAt: _c, updatedAt: _u, ...p } = r.projekt; dispatch({ type: 'ADD_PROJECT_MIT_ID', payload: p }); }
    for (const g of r.gruppen) dispatch({ type: 'ADD_GRUPPE', payload: g });
    for (const l of r.listen) dispatch({ type: 'ADD_LISTE', payload: l });
    for (const t of r.tasks) { const { createdAt: _c, updatedAt: _u, ...rest } = t; dispatch({ type: 'ADD_TASK_MIT_ID', payload: rest }); }
    setFertig(`Angelegt: „${r.projekt?.title ?? r.listen[0]?.titel ?? v.titel}“ mit ${r.tasks.length} Aufgabe${r.tasks.length === 1 ? '' : 'n'}.`);
  };
  const loeschen = (x: AufgabenVorlage) => {
    if (!window.confirm(`Vorlage „${x.titel}“ löschen? Angelegte Projekte und Listen bleiben.`)) return;
    dispatch({ type: 'DELETE_VORLAGE', payload: { id: x.id } });
    if (gewaehlt === x.id) setGewaehlt('');
  };

  return (
    <Fenster titel="Aus Vorlage anlegen" onZu={onSchliessen} breit={640}>
      <Segmente liste={[{ id: 'projekt', label: 'Projekt-Vorlagen' }, { id: 'liste', label: 'Listen-Vorlagen' }]} aktiv={art} onWahl={a => { setArt(a); setGewaehlt(''); setTitel(null); setFertig(null); }} />
      <div style={{ display: 'grid', gap: 4 }} role="radiogroup" aria-label="Vorlage">
        {liste.map(x => (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, border: `1px solid ${x.id === v?.id ? `${C.aktiv}88` : 'rgba(255,255,255,.07)'}`, background: x.id === v?.id ? `${C.aktiv}12` : 'transparent' }}>
            <button role="radio" aria-checked={x.id === v?.id} onClick={() => { setGewaehlt(x.id); setTitel(null); setFertig(null); }} className="fassbar"
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, display: 'grid', gap: 2, padding: 0 }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.titel}</span>
              <Umfang v={x} />
            </button>
            {istStartvorlage(x.id)
              ? <span style={{ ...mikro, color: C.inkLeise }}>mitgeliefert</span>
              : <button onClick={() => loeschen(x)} aria-label={`Vorlage ${x.titel} löschen`} style={leiseKnopf}>Löschen</button>}
          </div>
        ))}
        {!liste.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine {art === 'projekt' ? 'Projekt' : 'Listen'}-Vorlage.</span>}
      </div>
      {v && (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={zeile}><span style={mikro}>Space</span>
            <select value={spaceId} onChange={e => { setSpaceId(e.target.value); setProjektId(sonstigeProjektId(e.target.value)); setGruppeId(''); }} style={eingabe} aria-label="Space">
              {spaces.map(s => <option key={s.id} value={s.id}>{s.label}{s.archiv ? ' (Archiv)' : ''}</option>)}
            </select></label>
          {art === 'liste' && <label style={zeile}><span style={mikro}>Projekt</span>
            <select value={projektId} onChange={e => { setProjektId(e.target.value); setGruppeId(''); }} style={eingabe} aria-label="Projekt">
              {projekte.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              <option value={sonstigeProjektId(spaceId)}>Sonstige</option>
            </select></label>}
          {art === 'liste' && gruppen.length > 0 && <label style={zeile}><span style={mikro}>Gruppe</span>
            <select value={gruppeId} onChange={e => setGruppeId(e.target.value)} style={eingabe} aria-label="Gruppe">
              <option value="">direkt im Projekt</option>
              {gruppen.map(g => <option key={g.id} value={g.id}>{g.titel}</option>)}
            </select></label>}
          <label style={zeile}><span style={mikro}>Start</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value || berlinerTag())} style={eingabe} aria-label="Startdatum" /></label>
          <label style={zeile}><span style={mikro}>Name</span>
            <input value={titelJetzt} onChange={e => setTitel(e.target.value)} maxLength={art === 'projekt' ? 120 : 80} style={eingabe} aria-label="Name" /></label>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
            wird „{titelMitPlatzhaltern(titelJetzt || v.titel, start)}“{u?.letzterVersatz != null ? ` · Deadlines bis ${langTag(tagPlus(start, u.letzterVersatz))}` : ' · ohne Deadlines'}
          </span>
        </div>
      )}
      {fertig && <div role="status" style={{ color: LEUCHT.gut, fontSize: TYP.bedien }}>{fertig}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Knopf leise onClick={onSchliessen}>{fertig ? 'Fertig' : 'Abbrechen'}</Knopf>
        <Knopf onClick={anlegen} aus={!v || !!fertig}>Anlegen</Knopf>
      </div>
    </Fenster>
  );
}

/**
 * Der eine Knopf zum Einhängen: „Vorlagen“ öffnet ein kleines Menü — aus Vorlage anlegen (im Space bzw. Projekt),
 * und wenn ein Projekt/eine Liste gegeben ist, „als Vorlage speichern“.
 */
export function VorlagenKnopf({ spaceId, projektId, listeId, label = 'Vorlagen', stil }: { spaceId: string; projektId?: string; listeId?: string; label?: string; stil?: CSSProperties }) {
  const { state } = useTasks();
  const [auf, setAuf] = useState(false);
  const [auftrag, setAuftrag] = useState<VorlagenAuftrag | null>(null);
  const echtesProjekt = !!projektId && state.projects.some(p => p.id === projektId);
  const zahl = alleVorlagen(state.vorlagen).length;
  const waehle = (a: VorlagenAuftrag) => { setAuf(false); setAuftrag(a); };
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setAuf(a => !a)} aria-expanded={auf} aria-haspopup="menu" className="fassbar" title={`${zahl} Vorlagen`} style={{ ...leiseKnopf, ...stil }}>{label}</button>
      {auf && (
        <span role="menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 40, minWidth: 230, display: 'grid', padding: 6, borderRadius: 12, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 40px -12px rgba(0,0,0,.7)' }}>
          <button role="menuitem" onClick={() => waehle({ modus: 'anlegen', spaceId, ...(echtesProjekt ? { projektId } : {}), art: listeId || echtesProjekt ? 'liste' : 'projekt' })} style={{ ...leiseKnopf, color: C.ink, textAlign: 'left', padding: '8px 10px' }}>Aus Vorlage anlegen …</button>
          {echtesProjekt && !listeId && <button role="menuitem" onClick={() => waehle({ modus: 'speichern', art: 'projekt', id: projektId! })} style={{ ...leiseKnopf, color: C.ink, textAlign: 'left', padding: '8px 10px' }}>Projekt als Vorlage speichern …</button>}
          {listeId && <button role="menuitem" onClick={() => waehle({ modus: 'speichern', art: 'liste', id: listeId })} style={{ ...leiseKnopf, color: C.ink, textAlign: 'left', padding: '8px 10px' }}>Liste als Vorlage speichern …</button>}
        </span>
      )}
      {auftrag && <VorlagenDialog auftrag={auftrag} onSchliessen={() => setAuftrag(null)} />}
    </span>
  );
}

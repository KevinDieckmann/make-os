'use client';
// ─── Aufgabe im Detail (28.09. abends, Kevin + Malin: „wie Monday/ClickUp“) ─
// Status (fest + eigene des Space), Zuständig, Priorität, Start, Deadline, Ort (Space › Projekt › Liste),
// Beschreibung, Verknüpfung mit dem CRM (Kontakt, Firma, Mandat, Deal — Link in die Akte), Unteraufgaben,
// Kommentare mit @-Erwähnung. Jede Änderung ist eine Einzeländerung über den Aufgaben-Kontext (Stand/409).
// Vertiefung (28.09. spät): Notiz, eigene Felder des Projekts, „wartet auf …“ (blockiert sichtbar), Unteraufgaben mit
// eigenem Status/Zuständig/Deadline, in Unteraufgabe umwandeln bzw. herauslösen, Zeit je Aufgabe (Fokus), Dateien
// (Paket C2), Verlauf.
// Paket T2 (29.09., Kevins Entscheidungen): Schalter „🔒 nur ich“, eine Verantwortliche + Beteiligte (kein „Beide“ mehr),
// Status „Abgebrochen“ (grau, durchgestrichen), Serien-Extras (ab Erledigung, im Wechsel, Feiertage NRW, diese überspringen,
// Serie beenden), Erledigen/Löschen/Verschieben mit Rückfrage + „Rückgängig“ (Handlung.tsx), Datumsfelder speichern beim
// Verlassen, Warnung „Unteraufgabe nach Hauptfrist“.
// Mehrstufig (01.10., Kevin: „bei dem HOS unter Produkten … Beschreibungen machen können“): jede Ebene hat das volle Detail
// (Beschreibung, Notiz, Status …), Brotkrumen zeigen die ganze Kette, die Liste der direkten Unteraufgaben mit Anlegen steht
// auf jeder Ebene bis `AUFGABEN_EBENEN_MAX`, „in Unteraufgabe umwandeln“/„umhängen“/„zur Hauptaufgabe machen“ überall
// (Auswahl nur, was ohne Kreis und unter der Grenze passt — `elternKandidaten`). Ort, Sichtbarkeit und Serie stehen an der
// Hauptaufgabe; alle Ebenen darunter erben sie.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, HakenZiel, Knopf, SymbolKnopf, feld, prioFarbe, ZielChip, useZielBezug } from '../ui';
import { Wahl, WahlMehrfach, type WahlEintrag } from '../crm/Wahl';
import { TextMitLinks } from '../TextMitLinks';
import { bereichVonSpace, statusListe, statusVon, erwaehnungen, sonstigeProjektId, fortschritt, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import { crmSuchen, bezugName, bezugLink, bezugSetzen, bezugOhne, BEZUG_ARTEN, BEZUG_LABEL } from '@/lib/aufgaben/crm-verweise';
import { fokusFuerAufgabe } from '@/lib/zeitmessung/fokus-laufend';
import { wartetAuf, wuerdeKreisen } from '@/lib/aufgaben/abhaengig';
import { AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import { dauerText, type ZeitJeAufgabe } from '@/lib/aufgaben/zeit';
import { suchPasst } from '@/lib/text/such-norm';
import type { Task, TasksState, AufgabeKommentar } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, listeAnlegen, projekteImSpace, spacesOderFest, umzugTeil, umhaengenTeil, useCrmVerweise, neueKennung, tagKurz, type Person } from './hilfe';
import { kette, nachIdKarte, kinderKarte, nachfahren, elternKandidaten, pfadText, darfUnteraufgabe, ebeneVon, AUFGABEN_EBENEN_MAX } from '@/lib/aufgaben/ebenen';
import { NotizEditor } from './Notiz';
import { FeldWerte } from './EigeneFelder';
import { VerlaufListe } from './VerlaufListe';
import { ProjektDateien } from './ProjektDateien';
import { WiederholungWahl } from './WiederholungWahl';
import { ZoeAufgabe } from './ZoeAufgabe';
import { wiederholungSetzen } from '@/lib/aufgaben/serie';
import { anlegerinVon } from '@/lib/aufgaben/zustaendig';
import { useHandlung, NachElternFrist } from './Handlung';
import { DatumFeld, UhrzeitFeld } from './DatumFeld';
import { NurIchZeichen, titelStil, AbgebrochenSchild } from './Zeichen';
import { BeitragsVerlauf } from '../austausch/BeitragsVerlauf';
import { MeilensteinVerweis } from '../planung/MeilensteinVerweis';
import { istMeilensteinListe } from '@/lib/planung/meilenstein-aufgaben';

const PRIO: WahlEintrag<Priority>[] = [
  { id: 'critical', label: 'Kritisch', punkt: LEUCHT.kritisch }, { id: 'high', label: 'Hoch', punkt: LEUCHT.achtung },
  { id: 'medium', label: 'Normal', punkt: LEUCHT.puls }, { id: 'low', label: 'Niedrig', punkt: C.inkLeise },
];
const SONST = '__sonstige__';
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const datumFeld: CSSProperties = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '4px 12px', minHeight: 40, maxWidth: '100%', colorScheme: 'dark' };
const zeit = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ui-eigenschaft" style={{ gridTemplateColumns: undefined, minHeight: 34 }}>
      <span style={mikro}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function AufgabeDetail({ task: t, state, dispatch, spaces, personen, ich, onSchliessen, onOeffnen, i = 1 }: {
  task: Task;
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  spaces: readonly AufgabenSpace[];
  personen: readonly Person[];
  ich: string;
  onSchliessen: () => void;
  onOeffnen: (id: string) => void;
  i?: number;
}) {
  const aendern = (teil: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...teil } });
  const handlung = useHandlung(dispatch, state.statusEigen);
  const alleSpaces = spacesOderFest(spaces);
  const space = alleSpaces.find(s => s.id === t.spaceId);
  const nachId = useMemo(() => nachIdKarte(state.tasks), [state.tasks]);
  const kinder = useMemo(() => kinderKarte(state.tasks), [state.tasks]);
  const eltern = t.parentId ? nachId.get(t.parentId) : undefined;
  // Die ganze Kette über der Aufgabe (Hauptaufgabe zuerst) — Brotkrumen, „Unteraufgabe von …“.
  const vorKette = kette(t, nachId);
  const ebene = ebeneVon(t, nachId);
  const darfUnter = darfUnteraufgabe(t, nachId);
  const unter = (kinder.get(t.id) ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const teilbaum = nachfahren(t.id, kinder);
  const eigene = state.statusEigen ?? [];
  const status = statusVon(t, eigene);
  const statusWahl: WahlEintrag<string>[] = statusListe(t.spaceId, eigene).map(s => ({ id: s.id, label: s.label, punkt: s.farbe, ...(s.eigen ? { hinweis: 'eigener Status' } : {}) }));
  // Eine Verantwortliche (29.09., Kevin) — „Beide“ gibt es nicht mehr; ein Altbestand „both“ steht nur noch zum Lesen da.
  const personenWahl: WahlEintrag<Owner>[] = [...personen.map(p => ({ id: p.speicher as Owner, label: p.name })), ...(t.assignee === 'both' ? [{ id: 'both' as Owner, label: 'Beide (alt)' }] : [])];
  const beteiligtWahl: WahlEintrag<string>[] = personen.filter(p => p.speicher !== t.assignee).map(p => ({ id: p.speicher, label: p.name }));
  const nurIch = t.sichtbarkeit === 'nur-ich';
  const anlegerin = anlegerinVon(t);
  const darfSichtbarkeit = !anlegerin || anlegerin === ich;
  const serieLaeuft = !!t.wiederholung && !t.wiederholung.serieBeendet;
  const projekte = projekteImSpace(state, t.spaceId ?? 'privat');
  const projektWahl: WahlEintrag<string>[] = [...projekte.map(p => ({ id: p.id, label: p.title, punkt: p.color })), { id: sonstigeProjektId(t.spaceId ?? 'privat'), label: 'Sonstige' }];
  const listen = (state.listen ?? []).filter(l => l.projektId === t.projectId && !l.archiviert).sort((a, b) => a.sortOrder - b.sortOrder);
  const listenWahl: WahlEintrag<string>[] = [...listen.map(l => ({ id: l.id, label: l.titel })), { id: SONST, label: 'Sonstige' }];
  const spaceWahl: WahlEintrag<string>[] = alleSpaces.filter(s => !s.archiv || s.id === t.spaceId).map(s => ({ id: s.id, label: s.label, punkt: s.farbe }));
  const fremdesProjekt = !projekte.some(p => p.id === t.projectId) && state.projects.some(p => p.id === t.projectId);

  const projekt = state.projects.find(p => p.id === t.projectId);
  const wartet = t.status !== 'done' ? wartetAuf(t, state.tasks) : [];
  // Neues Elternteil (jede Ebene): gleicher Space + Projekt, offen, kein eigener Nachfahre, Teilbaum passt unter die Grenze.
  const elternWahl: WahlEintrag<string>[] = elternKandidaten(t, state.tasks)
    .map(x => ({ id: x.id, label: pfadText(x, nachId) })).sort((a, b) => a.label.localeCompare(b.label, 'de'));
  const [titel, setTitel] = useState(t.title);
  useEffect(() => { setTitel(t.title); }, [t.id, t.title]);
  const [neuUnter, setNeuUnter] = useState('');
  // Ziel-Bezug (03.10.): Aufgabe in der Liste eines Meilensteins → das Ziel ruhig als Chip (nur lesen).
  const zielBezug = useZielBezug(istMeilensteinListe(t.listeId))(t);

  return (
    <Karte i={i} akzent={status.farbe} id={`aufgabe-${t.id}`}>
      {/* Pfad: Space › Projekt › Liste (› übergeordnete Aufgabe) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8 }}>
        <span style={{ color: space?.farbe ?? C.inkDim, fontWeight: 600 }}>{space?.label ?? 'Space'}</span>
        <span aria-hidden>›</span><span>{state.projects.find(p => p.id === t.projectId)?.title ?? 'Sonstige'}</span>
        <span aria-hidden>›</span><span>{listen.find(l => l.id === t.listeId)?.titel ?? 'Sonstige'}</span>
        {vorKette.map(v => <span key={v.id} style={{ display: 'contents' }}><span aria-hidden>›</span><button onClick={() => onOeffnen(v.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</button></span>)}
        <span style={{ marginLeft: 'auto' }}><SymbolKnopf onClick={onSchliessen} ariaLabel="Schließen">×</SymbolKnopf></span>
      </div>
      {/* Meilenstein (30.09.): liegt die Aufgabe in der Liste eines Meilensteins, führt der Link dorthin. */}
      <div style={{ marginTop: -4, marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{zielBezug && <ZielChip bezug={zielBezug} />}<MeilensteinVerweis listeId={t.listeId} /></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ paddingTop: 8 }}><HakenZiel an={t.status === 'done'} onChange={() => handlung.erledigen(t)} farbe={prioFarbe(t.priority)} label={t.title} /></div>
        <textarea value={titel} onChange={e => setTitel(e.target.value)} rows={1} aria-label="Titel"
          onBlur={() => { const v = titel.replace(/\s+/g, ' ').trim(); if (v && v !== t.title) aendern({ title: v }); else setTitel(t.title); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
          style={{ ...feld, fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', background: 'transparent', border: '1px solid transparent', padding: '6px 8px', resize: 'none', lineHeight: 1.3, ...titelStil(t), fieldSizing: 'content' } as CSSProperties} />
      </div>
      {(nurIch || t.status === 'cancelled') && <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '-6px 0 10px 34px' }}>{nurIch && <NurIchZeichen text />}{t.status === 'cancelled' && <AbgebrochenSchild />}</div>}

      {wartet.length > 0 && (
        <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '-4px 0 12px', padding: '8px 12px', borderRadius: 10, border: `1px solid ${LEUCHT.achtung}55`, background: `${LEUCHT.achtung}12`, color: LEUCHT.achtung, fontSize: TYP.bedien }}>
          <Lock size={13} /> Blockiert — wartet auf {wartet.map((w, n) => <button key={w.id} onClick={() => onOeffnen(w.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: LEUCHT.achtung, textDecoration: 'underline', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>{w.title}{n < wartet.length - 1 ? ',' : ''}</button>)}
        </div>
      )}
      <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
        <Feld label="Status">
          <Wahl klein label="Status" liste={statusWahl} wert={status.id} farbe={status.farbe} onWahl={id => handlung.statusSetzen(t, id)} />
        </Feld>
        <Feld label="Zuständig">
          <Wahl klein label="Zuständig" liste={personenWahl} wert={t.assignee} aus={nurIch} onWahl={a => aendern({ assignee: a, ...(t.beteiligte?.includes(a) ? { beteiligte: t.beteiligte.filter(x => x !== a).length ? t.beteiligte.filter(x => x !== a) : undefined } : {}) })} />
          {beteiligtWahl.length > 0 && !nurIch && (
            <WahlMehrfach klein label="Beteiligte" leer="+ Beteiligte" liste={beteiligtWahl} wert={(t.beteiligte ?? []).filter(p => p !== t.assignee)} farbe={C.inkDim}
              onWahl={l => aendern({ beteiligte: l.length ? l : undefined })} />
          )}
        </Feld>
        {!eltern && (
          <Feld label="Sichtbar">
            <button type="button" aria-pressed={nurIch} disabled={!darfSichtbarkeit} onClick={() => aendern(nurIch ? { sichtbarkeit: 'haushalt' } : { sichtbarkeit: 'nur-ich', assignee: (ich || t.assignee) as Owner, beteiligte: undefined, ...(t.wiederholung?.rotation ? { wiederholung: (() => { const w = { ...t.wiederholung! }; delete w.rotation; return w; })() } : {}) })} className="fassbar"
              title={darfSichtbarkeit ? 'Nur ich: niemand sonst sieht die Aufgabe — auch nicht in Kalender, Glocke, Suche oder bei ZOE.' : 'Nur wer die Aufgabe angelegt hat, kann das ändern.'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, borderRadius: 999, padding: '4px 12px', cursor: darfSichtbarkeit ? 'pointer' : 'default', fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
                border: `1px solid ${nurIch ? `${LEUCHT.schlaf}99` : 'rgba(255,255,255,.1)'}`, background: nurIch ? `${LEUCHT.schlaf}22` : 'rgba(255,255,255,.03)', color: nurIch ? LEUCHT.schlaf : C.inkDim, opacity: darfSichtbarkeit ? 1 : 0.55 }}>
              <Lock size={13} aria-hidden /> nur ich
            </button>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{nurIch ? 'Nur du siehst sie — und nur du bist zuständig.' : t.assignee !== ich || t.beteiligte?.length ? 'Für euch beide sichtbar. „Nur ich“ macht dich zuständig und nimmt Beteiligte und Wechsel heraus.' : 'Für euch beide sichtbar.'}</span>
          </Feld>
        )}
        <Feld label="Priorität">
          <Wahl klein label="Priorität" liste={PRIO} wert={t.priority} farbe={prioFarbe(t.priority)} onWahl={p => aendern({ priority: p })} />
        </Feld>
        <Feld label="Zeitraum">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkLeise }}>Start
            <DatumFeld wert={t.startDate} onWert={d => handlung.verschieben(t, { startDate: d }, 'Start geändert')} style={datumFeld} label="Startdatum" /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkLeise }}>Deadline
            <DatumFeld wert={t.dueDate} onWert={d => handlung.verschieben(t, { dueDate: d }, d ? 'verschoben' : 'ohne Deadline')} style={datumFeld} label="Deadline" /></label>
          {/* Uhrzeit der Deadline (29.09., Kalender K1) — dieselbe Aufgabe steht im Kalender an dieser Zeit. */}
          {t.dueDate && <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkLeise }}>um
            <UhrzeitFeld wert={t.dueTime} onWert={z => handlung.verschieben(t, { dueTime: z }, z ? 'Uhrzeit gesetzt' : 'ohne Uhrzeit')} style={datumFeld} label="Uhrzeit der Deadline" /></label>}
          {eltern && <NachElternFrist unter={t} eltern={eltern} />}
        </Feld>
        {!eltern && <Feld label="Wiederholt">
          <WiederholungWahl wert={t.wiederholung} basis={t.dueDate} onChange={w => aendern(wiederholungSetzen(t, w))} extras personen={personen} zustaendig={t.assignee} />
          {t.wiederholung && (
            <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {serieLaeuft && t.dueDate && t.status !== 'done' && t.status !== 'cancelled' && (
                <button type="button" onClick={() => { if (handlung.ueberspringen(t)) onSchliessen(); }} className="fassbar" title="Nur diesen Termin auslassen — die nächste Instanz entsteht sofort"
                  style={{ background: 'none', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 999, padding: '4px 11px', minHeight: 40, color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Diese überspringen</button>
              )}
              <button type="button" onClick={() => aendern({ wiederholung: serieLaeuft ? { ...t.wiederholung!, serieBeendet: true } : (() => { const w = { ...t.wiederholung! }; delete w.serieBeendet; return w; })() })} className="fassbar"
                title={serieLaeuft ? 'Nach dieser Aufgabe kommt keine weitere — die Regel bleibt sichtbar' : 'Die Serie läuft nach dieser Aufgabe wieder weiter'}
                style={{ background: 'none', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 999, padding: '4px 11px', minHeight: 40, color: serieLaeuft ? C.inkDim : C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>{serieLaeuft ? 'Serie beenden' : 'Serie fortsetzen'}</button>
            </span>
          )}
        </Feld>}
        {!eltern && (
          <Feld label="Ort">
            <Wahl klein label="Space" liste={spaceWahl} wert={t.spaceId} farbe={space?.farbe} onWahl={id => handlung.umziehen(t, umzugTeil(state, t, { spaceId: id }))} />
            <Wahl klein label="Projekt" liste={fremdesProjekt ? [{ id: t.projectId, label: state.projects.find(p => p.id === t.projectId)?.title ?? '' }, ...projektWahl] : projektWahl} wert={t.projectId}
              onWahl={id => aendern(umzugTeil(state, t, { projectId: id, listeId: null }))} />
            <Wahl klein label="Liste" liste={listenWahl} wert={t.listeId && listen.some(l => l.id === t.listeId) ? t.listeId : SONST}
              onWahl={id => aendern(umzugTeil(state, t, { listeId: id === SONST ? null : id }))}
              onNeu={async titel => listeAnlegen(dispatch, state, t.projectId, titel)} neuMax={80} />
          </Feld>
        )}
        {!eltern && elternWahl.length > 0 && (
          <Feld label="Ebene">
            <Wahl klein label="Unteraufgabe von" leer={unter.length ? 'samt Unteraufgaben in Unteraufgabe umwandeln' : 'in Unteraufgabe umwandeln'} liste={elternWahl} wert={null} onWahl={id => aendern(umhaengenTeil(state, id))} />
          </Feld>
        )}
        {eltern && (
          <Feld label="Ebene">
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Ebene {ebene} · Unteraufgabe von „{eltern.title}“</span>
            {elternWahl.length > 0 && <Wahl klein label="Umhängen unter" leer="umhängen" liste={elternWahl} wert={null} onWahl={id => aendern(umhaengenTeil(state, id))} />}
            <button onClick={() => aendern(umhaengenTeil(state, null))} className="fassbar" title={teilbaum.length ? `Ihre ${teilbaum.length} Unteraufgabe${teilbaum.length === 1 ? '' : 'n'} kommen mit` : undefined} style={{ background: 'none', border: '1px dashed rgba(255,255,255,.2)', borderRadius: 999, padding: '3px 10px', minHeight: 30, color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>zur Hauptaufgabe machen</button>
          </Feld>
        )}
      </div>

      <div style={{ ...mikro, marginBottom: 6 }}>Beschreibung</div>
      <textarea key={`${t.id}-${t.updatedAt}`} defaultValue={t.description ?? ''} placeholder="Worum geht es? Links (z. B. aus der Markttraktion) werden klickbar."
        onBlur={e => { const v = e.target.value.trim(); if (v !== (t.description ?? '').trim()) aendern({ description: v }); }}
        rows={3} style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, resize: 'vertical', minHeight: 70 }} />
      {/(\/os\/|https?:\/\/)/.test(t.description ?? '') && <TextMitLinks text={(t.description ?? '').trim()} style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 6, maxHeight: 160, overflowY: 'auto' }} />}

      <CrmVerknuepfung task={t} aendern={aendern} />

      <FeldWerte task={t} defs={projekt?.felder ?? []} personen={personen} aendern={aendern} />

      <Abhaengigkeiten task={t} state={state} aendern={aendern} onOeffnen={onOeffnen} />

      <div style={{ ...mikro, margin: '16px 0 6px' }}>Notiz</div>
      <NotizEditor key={t.id} wert={t.notiz} max={AUFGABEN_GRENZEN.notiz} zeile={{ liste: 'tasks', id: t.id }} onSpeichern={n => aendern({ notiz: n })} platzhalter="Gedanken, Checkliste, Links zur Aufgabe …" />

      {/* Unteraufgaben auf jeder Ebene (01.10.) — Liste der direkten, Anlegen bis zur Grenze. */}
      {(unter.length > 0 || darfUnter) && (
        <>
          <div style={{ ...mikro, margin: '16px 0 6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Unteraufgaben{eltern ? ` · Ebene ${ebene + 1}` : ''}</span>{unter.length > 0 && <span>{fortschritt(unter).fertig}/{fortschritt(unter).gesamt}</span>}
          </div>
          {unter.length > 0 && fortschritt(unter).gesamt > 0 && <div aria-hidden style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginBottom: 4 }}><div style={{ height: '100%', width: `${Math.round((fortschritt(unter).fertig / fortschritt(unter).gesamt) * 100)}%`, background: LEUCHT.gut }} /></div>}
          {unter.map(u => {
            const us = statusVon(u, eigene);
            const aendernU = (teil: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id: u.id, ...teil } });
            const uu = kinder.get(u.id) ?? [];
            const uf = fortschritt(uu);
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap' }}>
                <HakenZiel an={u.status === 'done'} onChange={() => handlung.erledigen(u)} farbe={prioFarbe(u.priority)} label={u.title} />
                <button onClick={() => onOeffnen(u.id)} className="fassbar" title="Öffnen — Beschreibung, Notiz, eigene Unteraufgaben" style={{ flex: '1 1 140px', minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', minHeight: 36, cursor: 'pointer', ...titelStil(u), fontFamily: SCHRIFT.text, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.title}{uf.gesamt > 0 && <span style={{ color: C.inkLeise, fontSize: TYP.bedien, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{uf.fertig}/{uf.gesamt}</span>}{u.description?.trim() ? <span title="Mit Beschreibung" style={{ color: C.inkLeise, fontSize: TYP.bedien, marginLeft: 6 }}>¶</span> : null}
                </button>
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Wahl klein label="Status" liste={statusWahl} wert={us.id} farbe={us.farbe} onWahl={id => handlung.statusSetzen(u, id)} />
                  <Wahl klein label="Zuständig" liste={personen.map(p => ({ id: p.speicher as Owner, label: p.name }))} wert={u.assignee} farbe={C.inkDim} onWahl={a => aendernU({ assignee: a })} />
                  <DatumFeld wert={u.dueDate} onWert={d => aendernU({ dueDate: d })} style={{ ...datumFeld, padding: '2px 8px', fontSize: TYP.bedien }} label={`Deadline ${u.title}`} />
                  <NachElternFrist unter={u} eltern={t} />
                </span>
              </div>
            );
          })}
          {darfUnter ? (
            <input value={neuUnter} onChange={e => setNeuUnter(e.target.value)} aria-label="Neue Unteraufgabe"
              onKeyDown={e => { if (e.key === 'Enter' && neuUnter.trim()) { aufgabeAnlegen(dispatch, state, { spaceId: t.spaceId ?? 'privat', parentId: t.id }, { title: neuUnter.trim(), assignee: t.assignee, bezug: t.bezug }); setNeuUnter(''); } }}
              placeholder="+ Unteraufgabe (Enter = nächste)" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', marginTop: 6 }} />
          ) : (
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Tiefste Ebene ({AUFGABEN_EBENEN_MAX}) erreicht — weitere Schritte als Checkliste in der Notiz („- [ ] …“).</div>
          )}
        </>
      )}

      {/* Zeit und Fokus gibt es nur im Business (05.10.: die Selbstständigkeit steht unter Privat, `bereichVonSpace`). */}
      {bereichVonSpace(t.spaceId) === 'business' && <ZeitJeAufgabeZeile ids={[t.id, ...teilbaum.map(u => u.id)]} personen={personen} />}

      <div style={{ marginTop: 16 }} />
      <ProjektDateien projektId={t.projectId} aufgabeId={t.id} space={bereichVonSpace(t.spaceId)} />

      <ZoeAufgabe task={t} ich={ich} personen={personen} />

      <Kommentare task={t} ich={ich} personen={personen} aendern={aendern} />

      <details style={{ marginTop: 16 }}>
        <summary style={{ ...mikro, cursor: 'pointer', listStyle: 'revert' }}>Verlauf{t.verlauf?.length ? ` · ${t.verlauf.length}` : ''}</summary>
        <div style={{ marginTop: 6 }}><VerlaufListe eintraege={t.verlauf ?? []} personen={personen} felder={projekt?.felder} /></div>
      </details>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {bereichVonSpace(t.spaceId) === 'business' && t.status !== 'done' && (
          <Knopf leise onClick={() => fokusFuerAufgabe({ id: t.id, einheit: t.einheit })}>▶ Fokus</Knopf>
        )}
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>angelegt {zeit(t.createdAt)}</span>
        <button onClick={async () => {
          // Papierkorb (29.09., A7): geht etwas mit (Unteraufgaben, Notiz, Dateien), nennt die Rückfrage es; 30 Tage wiederherstellbar.
          // Danach „Rückgängig“ (10 s, #87). Eine offene Serien-Instanz wird dabei übersprungen (die Serie läuft weiter).
          if (await handlung.loeschen(t)) onSchliessen();
        }} className="fassbar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, minHeight: 36 }}>Löschen</button>
      </div>
    </Karte>
  );
}

// ── CRM-Verknüpfung ─────────────────────────────────────────────────────────
function CrmVerknuepfung({ task: t, aendern }: { task: Task; aendern: (teil: Partial<Task>) => void }) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const verweise = useCrmVerweise(offen || !!t.bezug);
  const treffer = useMemo(() => crmSuchen(verweise, suche), [verweise, suche]);
  const feldRef = useRef<HTMLInputElement>(null);
  const gesetzt = BEZUG_ARTEN.filter(a => t.bezug?.[a]);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...mikro, marginBottom: 6 }}>Verknüpft im CRM</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {gesetzt.map(a => {
          const id = t.bezug![a]!;
          const name = bezugName(verweise, a, id);
          return (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${LEUCHT.business}55`, background: `${LEUCHT.business}14`, borderRadius: 999, padding: '3px 4px 3px 10px', fontSize: TYP.bedien }}>
              <span style={{ color: C.inkLeise }}>{BEZUG_LABEL[a]}</span>
              <Link href={bezugLink(a, id)} style={{ color: LEUCHT.business, textDecoration: 'none', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name ?? (verweise ? 'nicht mehr im CRM' : '…')}</Link>
              <SymbolKnopf onClick={() => aendern({ bezug: bezugOhne(t.bezug, a) })} ariaLabel={`${BEZUG_LABEL[a]} lösen`} eingebettet>×</SymbolKnopf>
            </span>
          );
        })}
        {!offen && <button onClick={() => { setOffen(true); setTimeout(() => feldRef.current?.focus(), 0); }} className="fassbar" style={{ border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: C.inkDim, borderRadius: 999, padding: '4px 11px', fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+ Kontakt, Firma, Mandat, Deal</button>}
      </div>
      {offen && (
        <div style={{ marginTop: 8 }}>
          <input ref={feldRef} value={suche} onChange={e => setSuche(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setOffen(false); setSuche(''); } if (e.key === 'Enter' && treffer[0]) { aendern({ bezug: bezugSetzen(t.bezug, treffer[0], verweise) }); setSuche(''); setOffen(false); } }}
            placeholder={verweise ? 'Name, Firma, Mandat oder Deal suchen …' : 'Kartei wird geladen …'} aria-label="Im CRM suchen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} />
          <div style={{ marginTop: 4, display: 'grid' }}>
            {treffer.map(x => (
              <button key={`${x.art}-${x.id}`} onClick={() => { aendern({ bezug: bezugSetzen(t.bezug, x, verweise) }); setSuche(''); setOffen(false); }} className="fassbar"
                style={{ display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
                <span style={{ ...mikro, width: 62, flex: '0 0 auto' }}>{BEZUG_LABEL[x.art]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                {x.unter && <span style={{ color: C.inkLeise, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.unter}</span>}
              </button>
            ))}
            {suche.trim() && verweise && !treffer.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '6px 4px' }}>Nichts gefunden.</span>}
            <button onClick={() => { setOffen(false); setSuche(''); }} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '6px 4px' }}>fertig</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kommentare mit @-Erwähnung (seit 30.09. über das gemeinsame Bauteil components/os/austausch/BeitragsVerlauf) ──
function Kommentare({ task: t, ich, personen, aendern }: { task: Task; ich: string; personen: readonly Person[]; aendern: (teil: Partial<Task>) => void }) {
  const liste = t.kommentare ?? [];
  return (
    <div style={{ marginTop: 16 }}>
      <BeitragsVerlauf liste={liste} ich={ich} personen={personen}
        onSenden={v => {
          const k: AufgabeKommentar = { id: neueKennung('k'), von: ich, text: v, am: new Date().toISOString(), erwaehnt: erwaehnungen(v, personen) };
          if (!k.erwaehnt?.length) delete k.erwaehnt;
          aendern({ kommentare: [...liste, k] });
        }}
        // Weich entfernen (29.09., #76): der Kommentar bleibt gespeichert, angezeigt wird „Kommentar entfernt“.
        onEntfernen={id => aendern({ kommentare: liste.map(x => (x.id === id ? { ...x, entfernt: { am: new Date().toISOString(), von: ich } } : x)) })} />
    </div>
  );
}

// ── Abhängigkeiten: „wartet auf …“ ──────────────────────────────────────────
function Abhaengigkeiten({ task: t, state, aendern, onOeffnen }: { task: Task; state: TasksState; aendern: (teil: Partial<Task>) => void; onOeffnen: (id: string) => void }) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const nachId = useMemo(() => new Map(state.tasks.map(x => [x.id, x])), [state.tasks]);
  const ids = t.abhaengigVon ?? [];
  const davon = state.tasks.filter(x => x.abhaengigVon?.includes(t.id));
  const kandidaten = useMemo(() => {
    if (!offen) return [];
    return state.tasks
      .filter(x => x.id !== t.id && x.status !== 'done' && !ids.includes(x.id) && (!suche.trim() || suchPasst([x.title], suche)))
      .sort((a, b) => (a.spaceId === t.spaceId ? 0 : 1) - (b.spaceId === t.spaceId ? 0 : 1) || (a.projectId === t.projectId ? 0 : 1) - (b.projectId === t.projectId ? 0 : 1) || a.title.localeCompare(b.title, 'de'))
      .filter(x => !wuerdeKreisen(t.id, x.id, state.tasks))
      .slice(0, 8);
  }, [offen, suche, state.tasks, t.id, t.spaceId, t.projectId, ids]);
  const setze = (neu: string[]) => aendern({ abhaengigVon: neu.length ? neu : undefined });
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...mikro, marginBottom: 6 }}>Wartet auf</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {ids.map(id => {
          const b = nachId.get(id);
          if (!b) return null;
          const fertig = b.status === 'done';
          const f = fertig ? LEUCHT.gut : LEUCHT.achtung;
          return (
            <span key={id} title={fertig ? 'Erledigt — blockiert nicht mehr' : 'Noch offen — diese Aufgabe wartet darauf'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${f}55`, background: `${f}14`, borderRadius: 999, padding: '3px 4px 3px 10px', fontSize: TYP.bedien, maxWidth: 280 }}>
              <button onClick={() => onOeffnen(id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: f, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: fertig ? 'line-through' : 'none' }}>{b.title}</button>
              <SymbolKnopf onClick={() => setze(ids.filter(x => x !== id))} ariaLabel={`Abhängigkeit von „${b.title}“ lösen`} eingebettet>×</SymbolKnopf>
            </span>
          );
        })}
        {!offen && <button onClick={() => setOffen(true)} className="fassbar" style={{ border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: C.inkDim, borderRadius: 999, padding: '4px 11px', fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+ wartet auf …</button>}
      </div>
      {offen && (
        <div style={{ marginTop: 8 }}>
          <input autoFocus value={suche} onChange={e => setSuche(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setOffen(false); setSuche(''); } if (e.key === 'Enter' && kandidaten[0]) { setze([...ids, kandidaten[0].id]); setSuche(''); setOffen(false); } }}
            placeholder="Aufgabe suchen …" aria-label="Aufgabe suchen, auf die diese wartet" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} />
          <div style={{ marginTop: 4, display: 'grid' }}>
            {kandidaten.map(x => (
              <button key={x.id} onClick={() => { setze([...ids, x.id]); setSuche(''); setOffen(false); }} className="fassbar"
                style={{ display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{x.title}</span>
                {x.dueDate && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{tagKurz(x.dueDate)}</span>}
              </button>
            ))}
            {!kandidaten.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '6px 4px' }}>Nichts gefunden (Aufgaben, die einen Kreis schließen würden, stehen nicht zur Wahl).</span>}
            <button onClick={() => { setOffen(false); setSuche(''); }} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '6px 4px' }}>fertig</button>
          </div>
        </div>
      )}
      {davon.length > 0 && (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
          Darauf warten: {davon.map((x, n) => <button key={x.id} onClick={() => onOeffnen(x.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>{x.title}{n < davon.length - 1 ? ', ' : ''}</button>)}
        </div>
      )}
    </div>
  );
}

// ── Zeit je Aufgabe (Fokus-Blöcke, die auf die Aufgabe oder eine Unteraufgabe gebucht sind) ─────────────
function ZeitJeAufgabeZeile({ ids, personen }: { ids: string[]; personen: readonly Person[] }) {
  const [z, setZ] = useState<ZeitJeAufgabe | null>(null);
  const schluessel = ids.join(',');
  useEffect(() => {
    let lebt = true;
    setZ(null);
    fetch(`/api/aufgaben/zeit?ids=${encodeURIComponent(schluessel)}`, { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<ZeitJeAufgabe>) : null)).then(d => { if (lebt) setZ(d); }).catch(() => {});
    return () => { lebt = false; };
  }, [schluessel]);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 16, fontSize: TYP.bedien, color: C.inkDim }}>
      <span style={mikro}>Fokus-Zeit</span>
      {!z ? <span style={{ color: C.inkLeise }}>…</span> : z.sek ? <>
        <b style={{ color: C.ink, fontFamily: SCHRIFT.display, fontSize: 15 }}>{dauerText(z.sek)}</b>
        <span>{z.je.map(j => `${personen.find(p => p.speicher === j.person)?.name ?? j.name} ${dauerText(j.sek)}`).join(' · ')}</span>
        <span style={{ color: C.inkLeise }}>{z.bloecke} Block{z.bloecke === 1 ? '' : 'e'}</span>
      </> : <span style={{ color: C.inkLeise }}>noch keine — „▶ Fokus“ bucht die Zeit auf diese Aufgabe.</span>}
    </div>
  );
}

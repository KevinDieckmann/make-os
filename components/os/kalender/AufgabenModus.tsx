'use client';

// ─── Kalender — Modus „Aufgaben“ (29.09., K5 — Kevin: wie Google Tasks im Kalender) ─
// Umschalter oben rechts (KalenderAufgabenSchalter): die offenen Aufgaben nach Fälligkeit — Überfällig · Heute · Diese
// Woche · Später · Ohne Datum (lib/kalender/modus.ts). Filter: Space, Projekt, Liste, meine/beteiligt/alle — dazu Sicht
// und Bereich wie im Kalender (Leiste links). Welche Aufgaben überhaupt: K3 `aufgabenFuerKalender` (mit Deadline) und
// `ohneTermin` (ohne) — offen, ohne Papierkorb/Archiv/fremde „nur ich“. Abhaken, öffnen und „Einplanen“ (Tag + Uhrzeit →
// `dueDate`/`dueTime`, Start wandert mit; per Datumsauswahl oder Ziehen auf einen Tag der Woche rechts) über K3
// `useAufgabenImKalender` (Aufgaben-Schreibweg + „Rückgängig“) — EINE Quelle, keine zweite Liste, kein zweites Abhaken.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Segmente, Chip, feld, prioFarbe, LEUCHT, useBreit, HakenZiel } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { useIch, spacesOderFest, spaceLabel, projekteImSpace } from '../aufgaben/hilfe';
import { aufgabenVorfiltern, faelligGruppen, FAELLIG_GRUPPEN, type WerFilter, type FaelligGruppe } from '@/lib/kalender/modus';
import { aufgabenFuerKalender, ohneTermin, type Sicht, type Bereich } from '@/lib/kalender/aufgaben';
import { useAufgabenImKalender, aufgabeZiehStart, ziehtAufgabe, aufgabeAusZiehen } from './aufgaben';
// Restpunkte 29.09.: Fälligkeit mit Jahreszahl nur außerhalb des laufenden Jahres (eine Regel mit Agenda, Glocke, Heute).
import { tagKurz } from '@/lib/zeit/kalender-kern';
import { WEG } from '@/lib/wege';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const GRUPPEN_FARBE: Record<FaelligGruppe, string> = { ueberfaellig: LEUCHT.kritisch, heute: LEUCHT.puls, woche: LEUCHT.schlaf, spaeter: C.inkDim, ohne: C.inkLeise };
/** Eine Zeile: Aufgabe mit (tag/zeit aus K3) oder ohne Deadline. */
interface Zeile { id: string; title: string; tag?: string; zeit?: string; priority?: string; eltern?: string; spaceId?: string; dueTime?: string }

export interface AufgabenModusFilter { as?: string; ap?: string; al?: string; wer: WerFilter }

export function AufgabenModus({ heute, woche, sicht, bereich, suche, filter, onFilter }: {
  heute: string; woche: string[]; sicht: Sicht; bereich: Bereich; suche: string;
  filter: AufgabenModusFilter; onFilter: (f: AufgabenModusFilter) => void;
}) {
  const { state, spaces: rohSpaces, ready } = useTasks();
  const k3 = useAufgabenImKalender();
  const spaces = spacesOderFest(rohSpaces);
  const ich = useIch();
  const breit = useBreit();
  const [plant, setPlant] = useState<string | null>(null);
  const [ziehtUeber, setZiehtUeber] = useState<string | null>(null);

  const projekte = useMemo(() => (filter.as ? projekteImSpace(state, filter.as) : []), [state, filter.as]);
  const listen = useMemo(() => (state.listen ?? []).filter(l => !l.archiviert && (!filter.ap || l.projektId === filter.ap) && (!filter.as || projekte.some(p => p.id === l.projektId))), [state.listen, filter.ap, filter.as, projekte]);
  // Vorfilter (Space, Projekt, Liste, meine/beteiligt) → K3-Regeln (offen, Sicht, Bereich, Suche, Papierkorb, „nur ich“).
  const vor = useMemo(() => aufgabenVorfiltern(state.tasks, { ...filter, ich }), [state.tasks, filter, ich]);
  const kf = useMemo(() => ({ sicht, bereich, suche: suche.trim() || undefined, ich }), [sicht, bereich, suche, ich]);
  const gruppen = useMemo(() => {
    const nachId = new Map(state.tasks.map(t => [t.id, t]));
    const mit: Zeile[] = aufgabenFuerKalender(vor, '0000-01-01', '9999-12-31', kf).map(a => ({ ...a, spaceId: nachId.get(a.id)?.spaceId }));
    const ohne: Zeile[] = ohneTermin(vor, kf, Number.MAX_SAFE_INTEGER).map(t => ({ id: t.id, title: t.title, priority: t.priority, spaceId: t.spaceId, ...(t.parentId ? { eltern: nachId.get(t.parentId)?.title ?? 'Aufgabe' } : {}) }));
    return faelligGruppen(mit, ohne, heute);
  }, [vor, kf, state.tasks, heute]);
  const anzahl = FAELLIG_GRUPPEN.reduce((s, g) => s + gruppen[g.id].length, 0);
  const jeTag = useMemo(() => { const m = new Map<string, number>(); for (const g of ['ueberfaellig', 'heute', 'woche', 'spaeter'] as const) for (const a of gruppen[g]) if (a.tag) m.set(a.tag, (m.get(a.tag) ?? 0) + 1); return m; }, [gruppen]);

  /** Einplanen über K3 (Aufgaben-Schreibweg, Start wandert mit, „Rückgängig“). */
  const einplanen = (a: Zeile, tag: string, zeit: string | null) => { k3.einplanen(a.id, tag, zeit); setPlant(null); };
  const abgelegt = (e: React.DragEvent, tag: string) => {
    e.preventDefault(); setZiehtUeber(null);
    const id = aufgabeAusZiehen(e);
    const a = id ? [...gruppen.ueberfaellig, ...gruppen.heute, ...gruppen.woche, ...gruppen.spaeter, ...gruppen.ohne].find(x => x.id === id) : undefined;
    if (a) einplanen(a, tag, a.zeit ?? null);
  };

  const zeile = (a: Zeile) => {
    const offen = plant === a.id;
    return (
      <div key={a.id} draggable={breit} onDragStart={e => aufgabeZiehStart(e, a.id)} data-aufgabe={a.id}
        style={{ display: 'grid', gap: 6, padding: '8px 4px', borderTop: '1px solid rgba(255,255,255,.05)', cursor: breit ? 'grab' : undefined }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <HakenZiel an={false} onChange={() => k3.abhaken(a.id)} farbe={prioFarbe(a.priority ?? '')} label={a.title} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link href={WEG.aufgabe(a.id)} style={{ color: C.ink, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.eltern ? <span style={{ color: C.inkLeise }}>↳ </span> : null}{a.priority === 'critical' ? '‼ ' : ''}{a.title}</Link>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {a.tag && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{tagKurz(a.tag, heute)}{a.zeit ? ` · ${a.zeit}` : ''}</span>}
              {a.spaceId && <span>{spaceLabel(spaces, a.spaceId)}</span>}
              {a.eltern && <span>zu „{a.eltern}“</span>}
            </div>
          </div>
          <Knopf leise onClick={() => setPlant(offen ? null : a.id)}>{offen ? 'zu' : a.tag ? 'Verschieben' : 'Einplanen'}</Knopf>
        </div>
        {offen && <Einplanen tag={a.tag} zeit={a.zeit} heute={heute} onFertig={(tag, zeit) => einplanen(a, tag, zeit)} />}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: breit ? 'minmax(0, 1fr) 220px' : 'minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
        <Karte i={0}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select aria-label="Space" value={filter.as ?? ''} onChange={e => onFilter({ ...filter, as: e.target.value || undefined, ap: undefined, al: undefined })} style={{ ...feld, width: 'auto', fontSize: 13, padding: '7px 10px' }}>
              <option value="">Alle Spaces</option>
              {spaces.filter(s => !s.archiv).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {!!projekte.length && (
              <select aria-label="Projekt" value={filter.ap ?? ''} onChange={e => onFilter({ ...filter, ap: e.target.value || undefined, al: undefined })} style={{ ...feld, width: 'auto', fontSize: 13, padding: '7px 10px' }}>
                <option value="">Alle Projekte</option>
                {projekte.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
            {!!listen.length && (
              <select aria-label="Liste" value={filter.al ?? ''} onChange={e => onFilter({ ...filter, al: e.target.value || undefined })} style={{ ...feld, width: 'auto', fontSize: 13, padding: '7px 10px' }}>
                <option value="">Alle Listen</option>
                {listen.map(l => <option key={l.id} value={l.id}>{l.titel}</option>)}
              </select>
            )}
            <Segmente liste={[{ id: 'alle' as WerFilter, label: 'Alle' }, { id: 'meine' as WerFilter, label: 'Meine' }, { id: 'beteiligt' as WerFilter, label: 'Beteiligt' }]} aktiv={filter.wer} onWahl={w => onFilter({ ...filter, wer: w })} />
            <Link href={WEG.aufgaben({ ...(filter.as ? { s: filter.as } : {}), ...(filter.ap ? { p: filter.ap } : {}) })} style={{ marginLeft: 'auto', fontSize: TYP.bedien, color: C.aktiv, textDecoration: 'none', fontWeight: 600 }}>In den Aufgaben öffnen ›</Link>
          </div>
        </Karte>
        {!ready && <Leer>Aufgaben laden …</Leer>}
        {ready && !anzahl && <Karte i={1}><Leer>Keine offenen Aufgaben für diese Auswahl.</Leer></Karte>}
        {FAELLIG_GRUPPEN.filter(g => gruppen[g.id].length).map((g, i) => (
          <Karte key={g.id} i={i + 1} akzent={g.id === 'ueberfaellig' ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={GRUPPEN_FARBE[g.id]} rechts={<Chip farbe={GRUPPEN_FARBE[g.id]}>{gruppen[g.id].length}</Chip>}>{g.label}</Ueberschrift>
            <div data-gruppe={g.id}>{gruppen[g.id].map(zeile)}</div>
          </Karte>
        ))}
      </div>
      {breit && (
        <Karte i={1}>
          <Ueberschrift>Woche</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8, lineHeight: 1.45 }}>Aufgabe hierher ziehen — die Deadline wird dieser Tag (Uhrzeit bleibt).</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {woche.map((tag, i) => (
              <div key={tag} data-tag={tag} onDragOver={e => { if (!ziehtAufgabe(e)) return; e.preventDefault(); setZiehtUeber(tag); }} onDragLeave={() => setZiehtUeber(z => (z === tag ? null : z))} onDrop={e => abgelegt(e, tag)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10, border: `1px dashed ${ziehtUeber === tag ? LEUCHT.puls : 'rgba(255,255,255,.12)'}`, background: ziehtUeber === tag ? `${LEUCHT.puls}1c` : tag === heute ? 'rgba(255,255,255,.05)' : 'transparent', fontFamily: SCHRIFT.text }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: tag === heute ? LEUCHT.puls : C.inkDim, minWidth: 72 }}>{WD[i]} {tagKurz(tag, heute)}</span>
                <span style={{ marginLeft: 'auto', fontSize: TYP.bedien, color: C.inkLeise }}>{jeTag.get(tag) ?? 0}</span>
              </div>
            ))}
          </div>
        </Karte>
      )}
    </div>
  );
}

/** Tag + Uhrzeit wählen. */
function Einplanen({ tag: tag0, zeit: zeit0, heute, onFertig }: { tag?: string; zeit?: string; heute: string; onFertig: (tag: string, zeit: string | null) => void }) {
  const [tag, setTag] = useState(tag0 ?? heute);
  const [zeit, setZeit] = useState(zeit0 ?? '');
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingLeft: 34 }}>
      <input type="date" value={tag} onChange={e => setTag(e.target.value)} aria-label="Tag" style={{ ...feld, width: 'auto', fontSize: 13, padding: '6px 10px' }} />
      <input type="time" value={zeit} onChange={e => setZeit(e.target.value)} aria-label="Uhrzeit (optional)" style={{ ...feld, width: 'auto', fontSize: 13, padding: '6px 10px' }} />
      <Knopf aus={!/^\d{4}-\d{2}-\d{2}$/.test(tag)} onClick={() => onFertig(tag, zeit || null)}>Übernehmen</Knopf>
    </div>
  );
}

'use client';

// ─── Bauplan (25.09.) — hier verbessern Kevin und Malin MAKE OS ─────────────
// Board: Ideen → Bereit → In Arbeit → Zum Testen → Fertig. Karten ziehen
// (auch innerhalb einer Spalte: oben = zuerst), öffnen, abnehmen. Claude baut
// „Bereit“ von oben ab und gibt mit „So testet ihr“ nach „Zum Testen“; erst
// eure Abnahme macht eine Karte fertig. Planung: Etappen mit Zieldatum.
// Neue Karten kommen von hier, vom Knopf „Idee“ oben auf jeder Seite und
// von Jarvis („notier im Bauplan …“).

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ThumbsUp, MessageSquare, Image as BildIcon } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Knopf, Segmente, Zahl, feld, LEUCHT } from '../schlank';
import { Pillen } from '../crm/teile';
import { useLinkAuswahl } from '../Verlauf';
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { SPALTEN, ARTEN, BEREICHE, board, verschieben, artVon, spalteVon, warteschlange, type Spalte, type Art } from '@/lib/bauplan/board';
import { localDay } from '@/lib/zeit';
import { BAUPLAN_NEU, useBauplan, useIch, Fenster, ErfassenFormular, ART_FARBE, klein, datumKurz, Kopf, personFarbe } from './gemeinsam';
import { KarteDetail } from './KarteDetail';
import { Planung } from './Planung';

const FERTIG_ZEIGEN = 12;
const SPALTEN_FARBE: Record<Spalte, string> = { idee: C.inkDim, bereit: LEUCHT.puls, arbeit: LEUCHT.business, test: LEUCHT.achtung, fertig: LEUCHT.gut };

type Ansicht = 'board' | 'plan';

export function BauplanBoard() {
  const { items, etappen, fehler, setFehler, laden, tu } = useBauplan();
  const { ich, namen } = useIch();
  const router = useRouter();
  const pfad = usePathname() ?? '/os/bauplan';
  const params = useSearchParams();
  const ansicht: Ansicht = params.get('s') === 'plan' ? 'plan' : 'board';
  const [offen, setOffen] = useLinkAuswahl('k');
  const [neu, setNeu] = useState(false);
  const [frisch, setFrisch] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [bereich, setBereich] = useState('');
  const [art, setArt] = useState<Art | ''>('');
  const [nurDaumen, setNurDaumen] = useState(false);
  const [alleFertig, setAlleFertig] = useState(false);
  const [verworfeneZeigen, setVerworfeneZeigen] = useState(false);
  const [zieht, setZieht] = useState<string | null>(null);
  const [ziel, setZiel] = useState<{ spalte: Spalte; vor: string | null } | null>(null);

  // Eine Karte vom Knopf „Idee“ (andere Seite derselben Sitzung) sofort zeigen.
  useEffect(() => { const f = () => void laden(); window.addEventListener(BAUPLAN_NEU, f); return () => window.removeEventListener(BAUPLAN_NEU, f); }, [laden]);
  useEffect(() => { if (!frisch) return; const t = setTimeout(() => setFrisch(null), 4000); return () => clearTimeout(t); }, [frisch]);

  const alle = useMemo(() => items ?? [], [items]);
  const spalten = useMemo(() => board(alle), [alle]);
  const passt = (i: BacklogItem) => {
    const q = suche.trim().toLowerCase();
    if (q && ![i.titel, i.problem, i.wunsch, i.warum, i.fertigWenn].join(' ').toLowerCase().includes(q)) return false;
    if (bereich && i.bereich !== bereich) return false;
    if (art && artVon(i) !== art) return false;
    if (nurDaumen && !(i.daumen?.length)) return false;
    return true;
  };
  const gefiltert = Object.fromEntries(SPALTEN.map(s => [s.id, spalten[s.id].filter(passt)])) as Record<Spalte, BacklogItem[]>;
  const filterAn = !!(suche.trim() || bereich || art || nurDaumen);
  const schlange = warteschlange(alle);
  const brauchtKevin = alle.filter(i => !i.verworfen && i.block === 'kevin' && spalteVon(i) !== 'fertig');
  const verworfen = alle.filter(i => i.verworfen);
  const karte = offen ? alle.find(i => i.id === offen) : undefined;

  const wechsle = (a: Ansicht) => {
    const q = new URLSearchParams(params.toString());
    if (a === 'plan') q.set('s', 'plan'); else q.delete('s');
    q.delete('k');
    router.push(`${pfad}${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };

  // ── Ziehen ────────────────────────────────────────────────────────────────
  const ueber = (e: DragEvent<HTMLDivElement>, spalte: Spalte) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Vor welche Karte? Die erste, deren Mitte unter dem Zeiger liegt.
    const karten = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-karte]')).filter(el => el.dataset.karte !== zieht);
    const vor = karten.find(el => { const r = el.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; })?.dataset.karte ?? null;
    if (ziel?.spalte !== spalte || ziel.vor !== vor) setZiel({ spalte, vor });
  };
  const ablegen = (e: DragEvent<HTMLDivElement>, spalte: Spalte) => {
    e.preventDefault();
    const id = zieht ?? e.dataTransfer.getData('text/plain');
    const vor = ziel?.spalte === spalte ? ziel.vor : null;
    setZieht(null); setZiel(null);
    if (!id || !alle.some(i => i.id === id)) return;
    // Position in der VOLLEN Spalte (ohne die gezogene Karte) — auch wenn ein Filter Karten ausblendet.
    const voll = spalten[spalte].filter(i => i.id !== id);
    let index: number;
    if (vor) index = voll.findIndex(i => i.id === vor);
    else { const letzte = gefiltert[spalte].filter(i => i.id !== id).slice(0, spalte === 'fertig' && !alleFertig ? FERTIG_ZEIGEN : undefined).at(-1); index = letzte ? voll.findIndex(i => i.id === letzte.id) + 1 : voll.length; }
    if (index < 0) index = voll.length;
    const vorher = spalten[spalte].findIndex(i => i.id === id);
    if (vorher === index) return; // liegt schon genau dort
    void tu({ aktion: 'verschieben', id, spalte, index }, l => verschieben(l, id, spalte, index, new Date().toISOString()));
  };

  const heute = localDay();
  // Nie eine Null (Muster seit 23.09.): leer zeigt „—“.
  const zahl = (n: number) => (items && n ? String(n) : undefined);

  return (
    <Seite titel="Bauplan" breit={1680}
      unter="Hier verbessern wir MAKE OS. Neues landet in „Ideen“ — was nach „Bereit“ wandert, baut Claude von oben nach unten; ihr testet und nehmt ab."
      rechts={<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmente liste={[{ id: 'board' as Ansicht, label: 'Board' }, { id: 'plan' as Ansicht, label: 'Planung' }]} aktiv={ansicht} onWahl={wechsle} />
        <Knopf onClick={() => setNeu(true)}>+ Karte</Knopf>
      </div>}>

      {fehler && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: LEUCHT.kritisch, fontSize: TYP.bedien }}>
          {fehler} <button onClick={() => setFehler(null)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>ausblenden</button>
        </div>
      )}

      {/* Wo stehen wir? */}
      <Karte i={0} akzent={LEUCHT.puls}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
          <Zahl wert={zahl(spalten.idee.length)} label="Ideen" />
          <Zahl wert={zahl(schlange.length)} label="baut Claude als Nächstes" farbe={LEUCHT.puls} />
          <Zahl wert={zahl(spalten.test.length)} label="warten auf eure Abnahme" farbe={LEUCHT.achtung} />
          <Zahl wert={zahl(brauchtKevin.length)} label="warten auf Kevin" farbe={brauchtKevin.length ? LEUCHT.kritisch : undefined} />
          <Zahl wert={zahl(spalten.fertig.length)} label="fertig" farbe={LEUCHT.gut} />
        </div>
        {schlange[0] && (
          <div style={{ ...klein, marginTop: 14 }}>
            Als Nächstes: <button onClick={() => setOffen(schlange[0].id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)' }}>{schlange[0].titel}</button>
            {schlange[1] ? ` · danach ${schlange[1].titel}` : ''}
          </div>
        )}
      </Karte>

      {ansicht === 'plan' ? (
        items ? <Planung items={alle} etappen={etappen} tu={tu} onOeffnen={setOffen} /> : null
      ) : (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen …" aria-label="Karten durchsuchen" style={{ ...feld, width: 220, fontSize: TYP.bedien, padding: '8px 12px' }} />
            <select value={bereich} onChange={e => setBereich(e.target.value)} aria-label="Bereich" style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '8px 12px' }}>
              <option value="">Alle Bereiche</option>
              {BEREICHE.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <Pillen liste={[{ id: '' as Art | '', label: 'Alle Arten' }, ...ARTEN]} aktiv={art} onWahl={a => setArt(a)} />
            <button onClick={() => setNurDaumen(!nurDaumen)} aria-pressed={nurDaumen} className="fassbar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${nurDaumen ? LEUCHT.gut : 'rgba(255,255,255,.1)'}`, background: nurDaumen ? `${LEUCHT.gut}22` : 'transparent', color: nurDaumen ? LEUCHT.gut : C.inkDim }}>
              <ThumbsUp size={13} /> Nur mit Daumen
            </button>
            {filterAn && <button onClick={() => { setSuche(''); setBereich(''); setArt(''); setNurDaumen(false); }} style={{ background: 'none', border: 'none', color: LEUCHT.business, cursor: 'pointer', fontSize: 12.5 }}>Filter zurücksetzen</button>}
          </div>

          {/* Board */}
          <div className="bauplan-board">
            {SPALTEN.map(s => {
              const liste = gefiltert[s.id];
              const sichtbar = s.id === 'fertig' && !alleFertig ? liste.slice(0, FERTIG_ZEIGEN) : liste;
              const hier = ziel?.spalte === s.id;
              const linie = <div style={{ height: 3, borderRadius: 2, background: LEUCHT.puls, margin: '-2px 0' }} />;
              return (
                <div key={s.id} onDragOver={e => ueber(e, s.id)} onDrop={e => ablegen(e, s.id)} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setZiel(z => (z?.spalte === s.id ? null : z)); }}
                  style={{ scrollSnapAlign: 'start', minWidth: 0, minHeight: 160, padding: 10, borderRadius: 16, gridTemplateColumns: 'minmax(0, 1fr)', background: hier ? 'rgba(79,195,247,.06)' : 'rgba(255,255,255,.025)', border: `1px solid ${hier ? `${LEUCHT.puls}55` : 'rgba(255,255,255,.05)'}`, display: 'grid', gap: 8, alignContent: 'start', transition: 'background .15s ease' }}>
                  <div style={{ padding: '2px 4px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SPALTEN_FARBE[s.id], alignSelf: 'center' }} />
                      <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700 }}>{s.label}</span>
                      <span style={{ fontSize: 12.5, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{filterAn ? `${liste.length}/${spalten[s.id].length}` : spalten[s.id].length}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 2, lineHeight: 1.4 }}>{s.satz}</div>
                  </div>
                  {sichtbar.map(k => (
                    <div key={k.id} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                      {hier && ziel?.vor === k.id && linie}
                      <KarteMini k={k} namen={namen} ich={ich} heute={heute} frisch={frisch === k.id} zieht={zieht === k.id}
                        onOeffnen={() => setOffen(k.id)}
                        onZiehStart={e => { e.dataTransfer.setData('text/plain', k.id); e.dataTransfer.effectAllowed = 'move'; setZieht(k.id); }}
                        onZiehEnde={() => { setZieht(null); setZiel(null); }} />
                    </div>
                  ))}
                  {hier && ziel?.vor === null && linie}
                  {!liste.length && <div style={{ ...klein, padding: '14px 6px', textAlign: 'center', border: '1px dashed rgba(255,255,255,.08)', borderRadius: 12 }}>{items ? (filterAn ? 'Nichts passt zum Filter' : s.id === 'idee' ? 'Leer — „+ Karte“ oder „Idee“ oben auf jeder Seite' : 'Hierher ziehen') : 'lädt …'}</div>}
                  {s.id === 'fertig' && liste.length > FERTIG_ZEIGEN && (
                    <button onClick={() => setAlleFertig(!alleFertig)} style={{ background: 'none', border: 'none', color: LEUCHT.business, cursor: 'pointer', fontSize: 12.5, padding: 6 }}>{alleFertig ? 'Weniger zeigen' : `Alle ${liste.length} zeigen`}</button>
                  )}
                </div>
              );
            })}
          </div>

          {verworfen.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <button onClick={() => setVerworfeneZeigen(!verworfeneZeigen)} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
                {verworfeneZeigen ? 'Verworfene ausblenden' : `${verworfen.length} verworfen — ansehen`}
              </button>
              {verworfeneZeigen && verworfen.map(i => (
                <button key={i.id} onClick={() => setOffen(i.id)} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '2px 0', textDecoration: 'line-through' }}>{i.titel}</button>
              ))}
            </div>
          )}
        </>
      )}

      {neu && (
        <Fenster titel="Neue Karte" onZu={() => setNeu(false)}>
          <ErfassenFormular onAbbruch={() => setNeu(false)} onFertig={k => { setNeu(false); setFrisch(k.id); void laden(); }} />
        </Fenster>
      )}
      {karte && <KarteDetail key={karte.id} karte={karte} items={alle} etappen={etappen} ich={ich} namen={namen} tu={tu} onZu={() => setOffen(null)} />}
    </Seite>
  );
}

function KarteMini({ k, namen, ich, heute, frisch, zieht, onOeffnen, onZiehStart, onZiehEnde }: {
  k: BacklogItem; namen: Record<string, string>; ich: string; heute: string; frisch: boolean; zieht: boolean;
  onOeffnen: () => void; onZiehStart: (e: DragEvent<HTMLDivElement>) => void; onZiehEnde: () => void;
}) {
  const a = artVon(k);
  const d = k.daumen ?? [];
  const n = k.kommentare?.length ?? 0;
  const faellig = k.ziel && spalteVon(k) !== 'fertig' ? (k.ziel < heute ? LEUCHT.kritisch : C.inkLeise) : null;
  const zuletzt = k.kommentare?.at(-1);
  const zurueck = zuletzt?.text.startsWith('Passt noch nicht:') && spalteVon(k) === 'bereit';
  return (
    <div data-karte={k.id} draggable onDragStart={onZiehStart} onDragEnd={onZiehEnde} onClick={onOeffnen} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOeffnen(); } }}
      className="fassbar bauplan-karte"
      style={{ display: 'grid', gap: 7, minWidth: 0, padding: '10px 12px', borderRadius: 12, cursor: 'grab', background: C.flaecheHoch, opacity: zieht ? 0.35 : 1,
        border: `1px solid ${frisch ? LEUCHT.gut : 'rgba(255,255,255,.06)'}`, boxShadow: frisch ? `0 0 24px -6px ${LEUCHT.gut}40` : '0 4px 14px -8px rgba(0,0,0,.6)', transition: 'border-color .3s ease, box-shadow .3s ease' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700 }}>
        <span style={{ color: ART_FARBE[a] }}>● {ARTEN.find(x => x.id === a)?.label}</span>
        {k.bereich && <span style={{ color: C.inkLeise }}>{k.bereich}</span>}
        {k.prio === 1 && spalteVon(k) !== 'fertig' && <span style={{ color: LEUCHT.achtung, marginLeft: 'auto' }}>Jetzt</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: C.ink, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{k.titel}</div>
      {k.block === 'kevin' && spalteVon(k) !== 'fertig' && <div style={{ fontSize: 12, color: LEUCHT.kritisch, fontWeight: 600 }}>wartet auf Kevin{k.brauche ? `: ${k.brauche}` : ''}</div>}
      {zurueck && <div style={{ fontSize: 12, color: LEUCHT.achtung, lineHeight: 1.4 }}>{zuletzt!.text}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.inkLeise }}>
        {d.length > 0 && <span title={d.map(p => namen[p] ?? p).join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: d.includes(ich) ? LEUCHT.gut : C.inkLeise }}><ThumbsUp size={12} /> {d.length}</span>}
        {n > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageSquare size={12} /> {n}</span>}
        {(k.bilder?.length ?? 0) > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BildIcon size={12} /> {k.bilder!.length}</span>}
        {faellig && <span style={{ color: faellig }}>bis {datumKurz(k.ziel)}</span>}
        {k.von && <span style={{ marginLeft: 'auto' }}><Kopf name={namen[k.von] ?? k.von} farbe={personFarbe(k.von)} /></span>}
      </div>
    </div>
  );
}

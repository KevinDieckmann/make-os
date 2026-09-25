'use client';

// ─── Bauplan — eine Karte im Detail ─────────────────────────────────────────
// Alles an einer Stelle: wohin sie gehört (Spalte, Reihenfolge), was sie ist
// (Art, Bereich, Dringlichkeit, Etappe, Zieldatum), die Vorlage (Problem ·
// Wunsch · Warum · Fertig wenn), Bildschirmfotos, Daumen, Kommentare — und in
// „Zum Testen“ die Abnahme: erst sie macht eine Karte fertig.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { Pillen } from '../crm/teile';
import type { BacklogItem } from '@/lib/make-one/backlog-data';
import { SPALTEN, ARTEN, BEREICHE, spalteVon, artVon, board, verschieben, type Spalte, type Etappe } from '@/lib/bauplan/board';
import { Fenster, Bilder, ART_FARBE, PRIO, klein, titelKlein, zeitpunkt, Kopf, personFarbe } from './gemeinsam';

export type Tu = (body: Record<string, unknown>, vorher?: (l: BacklogItem[]) => BacklogItem[]) => Promise<{ ok: boolean; fehler?: string }>;

const WARTET: { id: 'frei' | 'kevin' | 'extern'; label: string }[] = [{ id: 'frei', label: 'Niemand' }, { id: 'kevin', label: 'Kevin' }, { id: 'extern', label: 'Extern' }];

/** Textfeld, das beim Verlassen speichert — und nicht überschrieben wird, solange man tippt. */
function TextFeld({ wert, onFertig, zeilen = 2, platz, gross }: { wert?: string; onFertig: (t: string) => void; zeilen?: number; platz?: string; gross?: boolean }) {
  const [w, setW] = useState(wert ?? '');
  const [fokus, setFokus] = useState(false);
  useEffect(() => { if (!fokus) setW(wert ?? ''); }, [wert, fokus]);
  const ende = () => { setFokus(false); if (w.trim() !== (wert ?? '').trim()) onFertig(w); };
  const stil = { ...feld, fontSize: gross ? TYP.body : TYP.bedien, padding: gross ? '10px 13px' : '9px 12px', fontWeight: gross ? 700 : 400, lineHeight: 1.5 };
  return zeilen === 1
    ? <input value={w} placeholder={platz} onFocus={() => setFokus(true)} onChange={e => setW(e.target.value)} onBlur={ende} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={stil} />
    : <textarea value={w} placeholder={platz} rows={zeilen} onFocus={() => setFokus(true)} onChange={e => setW(e.target.value)} onBlur={ende} style={{ ...stil, resize: 'vertical' }} />;
}

export function KarteDetail({ karte, items, etappen, ich, namen, tu, onZu }: {
  karte: BacklogItem; items: BacklogItem[]; etappen: Etappe[]; ich: string; namen: Record<string, string>; tu: Tu; onZu: () => void;
}) {
  const id = karte.id;
  const spalte = spalteVon(karte);
  const art = artVon(karte);
  const inSpalte = board(items)[spalte];
  const pos = inSpalte.findIndex(i => i.id === id);
  const [nein, setNein] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const jetzt = () => new Date().toISOString();

  const setze = (felder: Record<string, unknown>) => tu({ aktion: 'teil', id, felder }, l => l.map(i => (i.id === id ? { ...i, ...felder } as BacklogItem : i)));
  const bewege = (ziel: Spalte, index: number) => tu({ aktion: 'verschieben', id, spalte: ziel, index }, l => verschieben(l, id, ziel, index, jetzt()));
  // In „Bereit“ hinten anstellen (Claude baut von oben) — sonst oben einsortieren.
  const nach = (ziel: Spalte) => bewege(ziel, ziel === 'bereit' ? board(items).bereit.filter(i => i.id !== id).length : 0);
  const daumen = () => tu({ aktion: 'daumen', id }, l => l.map(i => (i.id === id ? { ...i, daumen: (i.daumen ?? []).includes(ich) ? (i.daumen ?? []).filter(p => p !== ich) : [...(i.daumen ?? []), ich] } : i)));
  const abnehmen = async (ok: boolean) => {
    const r = await tu({ aktion: 'abnahme', id, ok, ...(ok ? {} : { text: nein ?? '' }) });
    if (r.ok) { setNein(null); if (ok) onZu(); } else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const kommentieren = async () => {
    const text = kommentar.trim();
    if (!text) return;
    setKommentar('');
    const r = await tu({ aktion: 'kommentar', id, text }, l => l.map(i => (i.id === id ? { ...i, kommentare: [...(i.kommentare ?? []), { von: ich, am: jetzt(), text }] } : i)));
    if (!r.ok) { setKommentar(text); setFehler(r.fehler ?? 'Nicht gespeichert.'); }
  };

  const d = karte.daumen ?? [];
  const meinDaumen = d.includes(ich);
  const bereiche = BEREICHE.map(b => ({ id: b as string, label: b as string }));

  return (
    <Fenster onZu={onZu} titel={<TextFeld wert={karte.titel} zeilen={1} gross onFertig={t => { if (t.trim()) void setze({ titel: t }); }} />}>
      {/* Wo steht sie? */}
      <div style={{ display: 'grid', gap: 8 }}>
        <Pillen liste={SPALTEN.map(s => ({ id: s.id, label: s.label }))} aktiv={spalte} onWahl={s => { if (s !== spalte) void nach(s); }} farbe={LEUCHT.puls} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', ...klein }}>
          <span>Platz {pos + 1} von {inSpalte.length} in „{SPALTEN.find(s => s.id === spalte)?.label}“</span>
          <Mini aus={pos <= 0} onClick={() => void bewege(spalte, 0)}>ganz nach oben</Mini>
          <Mini aus={pos <= 0} onClick={() => void bewege(spalte, pos - 1)}>↑ eins hoch</Mini>
          <Mini aus={pos < 0 || pos >= inSpalte.length - 1} onClick={() => void bewege(spalte, pos + 1)}>↓ eins runter</Mini>
        </div>
      </div>

      {/* Claude hat gebaut → ihr nehmt ab */}
      {(karte.ergebnis || karte.testen || spalte === 'test') && (
        <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: `${LEUCHT.gut}10`, border: `1px solid ${LEUCHT.gut}33` }}>
          {karte.ergebnis && <div><h3 style={titelKlein}>Was gebaut wurde</h3><div style={{ fontSize: TYP.bedien, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{karte.ergebnis}</div></div>}
          {karte.testen && <div><h3 style={titelKlein}>So testet ihr</h3><div style={{ fontSize: TYP.bedien, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{karte.testen}</div></div>}
          {spalte === 'test' && (nein === null ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf farbe={LEUCHT.gut} onClick={() => void abnehmen(true)}>Funktioniert ✓</Knopf>
              <Knopf leise onClick={() => setNein('')}>Passt noch nicht</Knopf>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <textarea autoFocus value={nein} onChange={e => setNein(e.target.value)} rows={3} placeholder="Was passt noch nicht? (geht mit zurück nach „Bereit“)" style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Knopf aus={!nein.trim()} farbe={LEUCHT.achtung} onClick={() => void abnehmen(false)}>Zurück nach „Bereit“</Knopf>
                <Knopf leise onClick={() => setNein(null)}>Abbrechen</Knopf>
              </div>
            </div>
          ))}
          {karte.abgenommen && <div style={{ ...klein, color: LEUCHT.gut }}>Abgenommen von {namen[karte.abgenommen.von] ?? karte.abgenommen.von} · {zeitpunkt(karte.abgenommen.am)}</div>}
        </div>
      )}

      {/* Die Vorlage */}
      <div style={{ display: 'grid', gap: 10 }}>
        {([['problem', 'Was ist das Problem?', 'z. B. Beim Anlegen fehlt …'], ['wunsch', 'Was wünschst du dir?', 'z. B. Direkt auswählen können'], ['warum', 'Warum ist das wichtig?', 'z. B. Spart jeden Tag …'], ['fertigWenn', 'Fertig, wenn …', 'z. B. Ich lege … an und …']] as const).map(([k, label, platz]) => (
          <label key={k} style={{ display: 'grid', gap: 4 }}><span style={klein}>{label}</span><TextFeld wert={karte[k]} platz={platz} onFertig={t => void setze({ [k]: t })} /></label>
        ))}
      </div>

      <div><h3 style={titelKlein}>Bildschirmfotos</h3><Bilder namen={karte.bilder ?? []} max={6} onAendern={n => void setze({ bilder: n })} /></div>

      {/* Einordnung */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div><h3 style={titelKlein}>Art</h3><Pillen liste={ARTEN} aktiv={art} onWahl={a => void setze({ art: a })} farbe={ART_FARBE[art]} /></div>
        <div><h3 style={titelKlein}>Bereich</h3><Pillen liste={bereiche} aktiv={karte.bereich ?? ''} onWahl={b => void setze({ bereich: b })} /></div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div><h3 style={titelKlein}>Wie dringend?</h3><Pillen liste={PRIO} aktiv={String(karte.prio) as '1' | '2' | '3'} onWahl={p => void setze({ prio: Number(p) })} /></div>
          <div><h3 style={titelKlein}>Wartet auf</h3><Pillen liste={WARTET} aktiv={karte.block} onWahl={b => void setze({ block: b })} farbe={karte.block === 'frei' ? C.inkDim : LEUCHT.achtung} /></div>
        </div>
        {karte.block !== 'frei' && <label style={{ display: 'grid', gap: 4 }}><span style={klein}>Was genau wird gebraucht?</span><TextFeld wert={karte.brauche} zeilen={1} platz="z. B. Zugang zu …, Entscheidung über …" onFertig={t => void setze({ brauche: t })} /></label>}
      </div>

      {/* Planung */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 200px' }}><span style={klein}>Etappe</span>
          <select value={karte.etappe ?? ''} onChange={e => void setze({ etappe: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }}>
            <option value="">keine</option>
            {etappen.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, flex: '0 1 180px' }}><span style={klein}>Zieldatum</span>
          <input type="date" value={karte.ziel ?? ''} onChange={e => void setze({ ziel: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', colorScheme: 'dark' }} />
        </label>
      </div>

      {/* Zusammen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => void daumen()} className="fassbar" aria-pressed={meinDaumen}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, border: `1px solid ${meinDaumen ? LEUCHT.gut : 'rgba(255,255,255,.12)'}`, background: meinDaumen ? `${LEUCHT.gut}1f` : 'transparent', color: meinDaumen ? LEUCHT.gut : C.inkDim }}>
          <ThumbsUp size={15} strokeWidth={2} /> {meinDaumen ? 'Wichtig für mich' : 'Wichtig für mich?'}
        </button>
        {d.length > 0 && <span style={klein}>{d.map(p => namen[p] ?? p).join(' & ')} {d.length === 1 ? 'findet' : 'finden'} das wichtig</span>}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <h3 style={{ ...titelKlein, margin: 0 }}>Kommentare{karte.kommentare?.length ? ` · ${karte.kommentare.length}` : ''}</h3>
        {(karte.kommentare ?? []).map((k, n) => (
          <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Kopf name={namen[k.von] ?? k.von} farbe={personFarbe(k.von)} />
            <div style={{ minWidth: 0 }}>
              <div style={klein}><b style={{ color: C.inkDim }}>{namen[k.von] ?? k.von}</b> · {zeitpunkt(k.am)}</div>
              <div style={{ fontSize: TYP.bedien, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: k.text.startsWith('Passt noch nicht:') ? LEUCHT.achtung : C.ink }}>{k.text}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea value={kommentar} onChange={e => setKommentar(e.target.value)} rows={2} placeholder="Kommentar … (Cmd+Enter sendet)"
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void kommentieren(); } }}
            style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px', resize: 'vertical', flex: 1 }} />
          <Knopf aus={!kommentar.trim()} onClick={() => void kommentieren()}>Senden</Knopf>
        </div>
      </div>

      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}

      {/* Herkunft */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12 }}>
        <div style={klein}>
          {karte.von ? `Von ${namen[karte.von] ?? karte.von}` : 'Angelegt'}{karte.angelegt ? ` · ${zeitpunkt(karte.angelegt)}` : ''}{karte.quelle ? ` · ${karte.quelle}` : ''}
          {karte.seite && <> · aufgefallen auf <Link href={karte.seite} style={{ color: LEUCHT.business }}>{karte.seite.split('?')[0]}</Link></>}
        </div>
        {karte.verworfen
          ? <Knopf leise onClick={() => void setze({ verworfen: false })}>Zurückholen</Knopf>
          : <Knopf leise onClick={() => { void setze({ verworfen: true }); onZu(); }}>Verwerfen</Knopf>}
      </div>
    </Fenster>
  );
}

function Mini({ children, onClick, aus }: { children: React.ReactNode; onClick: () => void; aus?: boolean }) {
  return <button onClick={onClick} disabled={aus} style={{ fontSize: 12, padding: '4px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: aus ? C.inkLeise : C.inkDim, cursor: aus ? 'default' : 'pointer', opacity: aus ? 0.5 : 1, fontFamily: SCHRIFT.text }}>{children}</button>;
}

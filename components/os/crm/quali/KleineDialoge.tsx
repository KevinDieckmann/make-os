'use client';

// ─── Abgeben · Parken · Raus — die drei Wege aus der Runde (03.10.) ────────────────────────────
// Abgeben   alle Personen des Leads an Kevin oder Malin (Übergabe im Verlauf, Aufgabe für die andere Person)
// Parken    Status „ruht“ mit Wiedervorlage — am Tag kommt der Lead in die Runde zurück, dazu ein Follow-up
// Raus      „Kein Fit“ mit Grund aus einer festen Liste — der Grund steht in der Auswertung (Sales › Auswertung)

import { useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../schlank';
import { Fenster } from '../../Fenster';
import { localDay } from '@/lib/zeit';
import { TEAM, nameVon } from '@/lib/crm/team';
import { GRUND_PARKEN, GRUND_RAUS } from '@/lib/crm/lead-grund';
import { ausscheidenGesperrt, type LeadZeile } from '@/lib/crm/leads';
import type { CrmApi } from '../daten';
import { plusTage } from '../daten';
import { leadPost } from './hilfen';

export interface WeiterInfo { text: string; weiter?: boolean }
interface P { api: CrmApi; z: LeadZeile; onZu: () => void; onFertig: (i: WeiterInfo) => void }

const knopfStil = (an: boolean, farbe: string = LEUCHT.business) => ({ display: 'flex', gap: 10, alignItems: 'center', width: '100%', minHeight: 48, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, textAlign: 'left', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}1F` : 'rgba(255,255,255,.03)' }) as const;
/** Hinweis VOR dem Klick (M8): dieser Lead darf nicht geparkt/ausgeschieden werden — der Knopf bleibt gesperrt, statt erst nach dem Klick einen Fehler zu zeigen. */
const Gesperrt = ({ grund }: { grund: string | null }) => (grund ? <div role="note" style={{ padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.achtung}14`, border: `1px solid ${LEUCHT.achtung}44`, fontSize: TYP.bedien, lineHeight: 1.5, color: LEUCHT.achtung }}>{grund}</div> : null);
const Fuss = ({ onZu, ok, laeuft, los, text }: { onZu: () => void; ok: boolean; laeuft: boolean; los: () => void; text: string }) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Knopf leise onClick={onZu}>Abbrechen</Knopf><Knopf aus={!ok || laeuft} onClick={() => los()}>{text}</Knopf></div>
);

export function AbgebenDialog({ api, z, onZu, onFertig }: P) {
  const ich = api.ich ?? TEAM[0].id;
  const [an, setAn] = useState(TEAM.find(t => t.id !== ich)?.id ?? TEAM[0].id);
  const [notiz, setNotiz] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const los = async () => {
    setLaeuft(true); setMeldung('');
    const r = await leadPost({ aktion: 'abgeben', id: z.id, an, ...(notiz.trim() ? { notiz: notiz.trim() } : {}) });
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht abgegeben.'); return; }
    await api.laden(true);
    onFertig({ text: r.text ?? `An ${nameVon(an)} abgegeben.`, weiter: true });
  };
  return (
    <Fenster titel="Abgeben" onZu={onZu} breit={520}>
      <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>„{z.name}“ mit {z.personen.length === 1 ? 'seiner Person' : `allen ${z.personen.length} Personen`} geht an die andere Person. Die Übergabe steht im Verlauf, sie bekommt eine Aufgabe mit Link.</div>
      <div role="radiogroup" aria-label="An wen" style={{ display: 'grid', gap: 6 }}>
        {TEAM.filter(t => t.id !== z.besitzer || z.besitzer === 'beide').map(t => <button key={t.id} type="button" role="radio" aria-checked={an === t.id} onClick={() => setAn(t.id)} className="fassbar" style={knopfStil(an === t.id)}>{t.name}</button>)}
      </div>
      <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={3} maxLength={600} placeholder="Was die andere Person wissen muss (optional) …" aria-label="Notiz zur Übergabe" style={{ ...feld, fontSize: 16, padding: '8px 11px', width: '100%', resize: 'vertical' }} />
      {meldung && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
      <Fuss onZu={onZu} ok laeuft={laeuft} los={() => void los()} text={`An ${nameVon(an)} abgeben`} />
    </Fenster>
  );
}

export function ParkenDialog({ api, z, onZu, onFertig }: P) {
  const gesperrt = ausscheidenGesperrt(z);
  const heute = api.crm?.heute ?? localDay();
  const [bis, setBis] = useState(plusTage(heute, 30));
  const [art, setArt] = useState('spaeter');
  const [grund, setGrund] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const los = async () => {
    setLaeuft(true); setMeldung('');
    const r = await leadPost({ aktion: 'parken', id: z.id, bis, grundArt: art, ...(grund.trim() ? { grund: grund.trim() } : {}) });
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht geparkt.'); return; }
    await api.laden(true);
    onFertig({ text: r.text ?? 'Geparkt.', weiter: true });
  };
  const schnell: [string, number][] = [['2 Wochen', 14], ['1 Monat', 30], ['3 Monate', 90], ['6 Monate', 180]];
  return (
    <Fenster titel="Parken" onZu={onZu} breit={520}>
      <Gesperrt grund={gesperrt} />
      <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>„{z.name}“ ruht bis zu diesem Tag — dann kommt der Lead von selbst in die Runde zurück (und ein Follow-up erinnert).</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {schnell.map(([l, t]) => <button key={l} type="button" onClick={() => setBis(plusTage(heute, t))} aria-pressed={bis === plusTage(heute, t)} className="fassbar" style={{ ...knopfStil(bis === plusTage(heute, t)), width: 'auto', borderRadius: 999 }}>{l}</button>)}
        <input type="date" value={bis} min={heute} onChange={e => setBis(e.target.value)} aria-label="Wiedervorlage am" style={{ ...feld, width: 'auto', fontSize: 16, padding: '10px 12px' }} />
      </div>
      <div role="radiogroup" aria-label="Warum geparkt" style={{ display: 'grid', gap: 6 }}>
        {GRUND_PARKEN.map(g => <button key={g.id} type="button" role="radio" aria-checked={art === g.id} onClick={() => setArt(g.id)} className="fassbar" style={knopfStil(art === g.id)}>{g.label}</button>)}
      </div>
      <input value={grund} onChange={e => setGrund(e.target.value)} maxLength={300} placeholder="Ein Satz dazu (optional) …" aria-label="Grund in einem Satz" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
      {meldung && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
      <Fuss onZu={onZu} ok={bis >= heute && !gesperrt} laeuft={laeuft} los={() => void los()} text="Parken" />
    </Fenster>
  );
}

export function RausDialog({ api, z, onZu, onFertig }: P) {
  const gesperrt = ausscheidenGesperrt(z);
  const [art, setArt] = useState('');
  const [grund, setGrund] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const los = async () => {
    setLaeuft(true); setMeldung('');
    const r = await leadPost({ aktion: 'raus', id: z.id, grundArt: art, ...(grund.trim() ? { grund: grund.trim() } : {}) });
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht ausgeschieden.'); return; }
    await api.laden(true);
    onFertig({ text: r.text ?? 'Raus (Kein Fit).', weiter: true });
  };
  return (
    <Fenster titel="Raus — Kein Fit" onZu={onZu} breit={520}>
      <Gesperrt grund={gesperrt} />
      <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>„{z.name}“ scheidet aus der Qualifizierung aus. Der Grund fließt in die Auswertung — so sehen Marketing und Sales, woran Leads scheitern. Nichts wird gelöscht.</div>
      <div role="radiogroup" aria-label="Warum Kein Fit" style={{ display: 'grid', gap: 6 }}>
        {GRUND_RAUS.map(g => <button key={g.id} type="button" role="radio" aria-checked={art === g.id} onClick={() => setArt(g.id)} className="fassbar" style={{ ...knopfStil(art === g.id, LEUCHT.kritisch), display: 'grid', gap: 2 }}><b style={{ fontWeight: 600 }}>{g.label}</b>{g.hinweis && <span style={{ fontSize: 12, color: C.inkDim }}>{g.hinweis}</span>}</button>)}
      </div>
      <input value={grund} onChange={e => setGrund(e.target.value)} maxLength={300} placeholder="Ein Satz dazu (optional) — steht später an der Firma" aria-label="Grund in einem Satz" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
      {meldung && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
      <Fuss onZu={onZu} ok={!!art && !gesperrt} laeuft={laeuft} los={() => void los()} text="Raus" />
    </Fenster>
  );
}

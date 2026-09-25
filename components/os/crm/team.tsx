'use client';

// ─── Markttraktion — Bauteile fürs Arbeiten zu zweit ───────────────────────
// Person (Plakette), Zuständigkeit wählen, Filter „Alle · Meins · Malin“,
// Übergeben (an Kevin/Malin, mit Notiz und Frist → Verlauf + Aufgabe) und
// „Malin ist gerade hier“. Regeln in lib/crm/team.ts: Sales verantwortet
// Kevin, Marketing und Event Malin; zuständig ist, wer eingetragen ist.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { TEAM, BEIDE, mitglied, nameVon, anderer, verantwortlich, zustaendig as effektiv } from '@/lib/crm/team';
import type { Welt } from '@/lib/crm/traktion';
import type { CrmApi } from './daten';

/** Runde Plakette mit Anfangsbuchstaben — „beide“ als zwei überlappende. */
export function Person({ id, name, groesse = 22 }: { id?: string | null; name?: boolean; groesse?: number }) {
  const eine = (m: { id: string; name: string; farbe: string }, versatz = 0) => (
    <span key={m.id} title={m.name} style={{ width: groesse, height: groesse, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', flex: '0 0 auto', marginLeft: versatz,
      background: `${m.farbe}26`, color: m.farbe, border: `1px solid ${m.farbe}66`, fontSize: Math.round(groesse * 0.5), fontWeight: 700, fontFamily: SCHRIFT.text }}>{m.name.charAt(0)}</span>
  );
  const plakette = id === BEIDE ? <span style={{ display: 'inline-flex' }}>{TEAM.map((m, i) => eine(m, i ? -Math.round(groesse / 3) : 0))}</span>
    : mitglied(id) ? eine(mitglied(id)!) : <span style={{ width: groesse, height: groesse, borderRadius: '50%', display: 'inline-block', border: `1px dashed ${C.inkLeise}` }} />;
  if (!name) return plakette;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'nowrap' }}>{plakette}{nameVon(id)}</span>;
}

/** Zuständigkeit wählen: Kevin · Malin · Beide — ohne Eintrag gilt die Verantwortung der Welt. */
export function ZustaendigWahl({ wert, welt, onWahl, beide = true }: { wert?: string; welt: Welt; onWahl: (z: string) => void; beide?: boolean }) {
  const e = effektiv(wert, welt);
  const liste = [...TEAM.map(t => t.id), ...(beide ? [BEIDE] : [])];
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {liste.map(id => {
        const an = e === id;
        const f = mitglied(id)?.farbe ?? C.inkDim;
        return (
          <button key={id} onClick={() => onWahl(id)} aria-pressed={an} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 5px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SCHRIFT.text,
            border: `1px solid ${an ? f : 'rgba(255,255,255,.1)'}`, background: an ? `${f}1f` : 'transparent', color: an ? C.ink : C.inkDim }}>
            <Person id={id} groesse={18} />{nameVon(id)}
          </button>
        );
      })}
      {!wert && <span style={{ fontSize: 11.5, color: C.inkLeise }}>(Verantwortung {nameVon(verantwortlich(welt))})</span>}
    </span>
  );
}

// ── Filter „Alle · Meins · Malin“ (je Ansicht gemerkt, nur in diesem Browser) ──
export type WerWahl = 'alle' | string;
export function useWerFilter(schluessel: string, start: WerWahl = 'alle'): [WerWahl, (w: WerWahl) => void] {
  const k = `mt-wer-${schluessel}`;
  const [w, setW] = useState<WerWahl>(start);
  useEffect(() => { try { const x = localStorage.getItem(k); if (x) setW(x); } catch { /* ohne Speicher: Standard */ } }, [k]);
  const setze = (x: WerWahl) => { setW(x); try { localStorage.setItem(k, x); } catch { /* egal */ } };
  return [w, setze];
}
/** Passt ein Eintrag zum Filter? „ich“ zeigt Eigenes und Gemeinsames. */
export function passtWer(wahl: WerWahl, z: string | undefined, welt: Welt, ich: string | null): boolean {
  if (wahl === 'alle') return true;
  const e = effektiv(z, welt);
  const wer = wahl === 'ich' ? ich : wahl;
  return e === wer || e === BEIDE;
}
export function WerFilter({ wahl, onWahl, ich, zahlen }: { wahl: WerWahl; onWahl: (w: WerWahl) => void; ich: string | null; zahlen?: Partial<Record<string, number>> }) {
  const andere = ich ? anderer(ich) : null;
  const liste: { id: WerWahl; label: ReactNode }[] = [
    { id: 'alle', label: 'Alle' },
    ...(ich ? [{ id: 'ich', label: <><Person id={ich} groesse={16} /> Meins</> }] : []),
    ...(andere && andere !== ich ? [{ id: andere, label: <><Person id={andere} groesse={16} /> {nameVon(andere)}</> }] : []),
  ];
  return (
    <span role="group" aria-label="Wer" style={{ display: 'inline-flex', gap: 2, background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 2 }}>
      {liste.map(x => (
        <button key={x.id} onClick={() => onWahl(x.id)} aria-pressed={wahl === x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SCHRIFT.text,
          background: wahl === x.id ? 'rgba(255,255,255,.12)' : 'transparent', color: wahl === x.id ? C.ink : C.inkDim }}>
          {x.label}{zahlen?.[x.id] !== undefined && <span style={{ color: C.inkLeise, fontWeight: 500 }}>{zahlen[x.id]}</span>}
        </button>
      ))}
    </span>
  );
}

// ── Übergeben ───────────────────────────────────────────────────────────────
export function Uebergeben({ api, art, id, ids, jetzt, titel, klein }: { api: CrmApi; art: string; id?: string; ids?: string[]; jetzt?: string; titel?: string; klein?: boolean }) {
  const ich = api.ich;
  const [offen, setOffen] = useState(false);
  const [an, setAn] = useState<string>(ich ? anderer(ich) : TEAM[1].id);
  const [notiz, setNotiz] = useState('');
  const [frist, setFrist] = useState('');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const los = async () => {
    setLaeuft(true);
    const r = await api.uebergeben({ art, id, ids, an, ...(notiz.trim() ? { notiz: notiz.trim() } : {}), ...(frist ? { frist } : {}) });
    setLaeuft(false);
    setMeldung(r.ok ? `Übergeben: ${r.text}` : r.fehler ?? 'Nicht übergeben.');
    if (r.ok) { setOffen(false); setNotiz(''); setFrist(''); }
  };
  const feld = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien, fontFamily: SCHRIFT.text } as const;
  if (!offen) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => { setOffen(true); setMeldung(''); }} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: klein ? '5px 10px' : '8px 13px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, fontSize: TYP.bedien, fontWeight: 600, fontFamily: SCHRIFT.text }}>
        <Person id={jetzt ?? null} groesse={16} /> {titel ?? 'Übergeben'} →
      </button>
      {meldung && <span style={{ fontSize: 12, color: C.inkDim }}>{meldung}</span>}
    </span>
  );
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
        An <ZustaendigWahl wert={an} welt="sales" onWahl={setAn} />
      </div>
      <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Worum geht es? (erscheint im Verlauf und in der Aufgabe)" aria-label="Notiz zur Übergabe" style={feld} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5, color: C.inkLeise, display: 'inline-flex', gap: 6, alignItems: 'center' }}>bis <input type="date" value={frist} onChange={e => setFrist(e.target.value)} style={{ ...feld, padding: '6px 9px' }} /></label>
        <span style={{ flex: 1 }} />
        <button onClick={() => setOffen(false)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Abbrechen</button>
        <button onClick={los} disabled={laeuft} className="fassbar" style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: mitglied(an)?.farbe ?? C.aktiv, color: C.grund, fontWeight: 700, fontSize: TYP.bedien, fontFamily: SCHRIFT.text }}>
          {laeuft ? 'übergibt …' : `An ${nameVon(an)} übergeben`}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: C.inkLeise }}>{an !== BEIDE && an !== ich ? `${nameVon(an)} bekommt eine Aufgabe mit Link${notiz && frist && (art === 'kontakt') ? ' und die Person als nächsten Schritt in die Power Hour' : ''}.` : 'Wird als gemeinsam markiert — keine Aufgabe.'}</div>
    </div>
  );
}

// ── Wer ist gerade hier? ────────────────────────────────────────────────────
interface Aktiv { person: string; name: string; pfad: string; seitSek: number }
let letzte: { zeit: number; liste: Aktiv[]; ich: string } | null = null;
let laufend: Promise<void> | null = null;
async function anwesend(): Promise<{ liste: Aktiv[]; ich: string }> {
  if (letzte && Date.now() - letzte.zeit < 20_000) return letzte;
  if (!laufend) laufend = fetch('/api/state/anwesenheit', { cache: 'no-store' }).then(r => r.json()).then(d => { letzte = { zeit: Date.now(), liste: d.aktiv ?? [], ich: d.ich }; }).catch(() => {}).finally(() => { laufend = null; });
  await laufend;
  return letzte ?? { liste: [], ich: '' };
}
/** Andere, deren Seite zu `passt` passt (z. B. `k=c-123` oder `s=event`). */
export function useAuchHier(passt: (pfad: string) => boolean): Aktiv[] {
  const [a, setA] = useState<Aktiv[]>([]);
  useEffect(() => {
    let weg = false;
    const zug = () => anwesend().then(d => { if (!weg) setA(d.liste.filter(x => x.person !== d.ich && passt(x.pfad))); });
    void zug();
    const t = setInterval(zug, 25_000);
    return () => { weg = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return a;
}
export function AuchHier({ passt, was = 'hier' }: { passt: (pfad: string) => boolean; was?: string }) {
  const a = useAuchHier(passt);
  if (!a.length) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkDim, padding: '3px 9px 3px 4px', borderRadius: 999, background: 'rgba(255,255,255,.05)' }}>
      {a.map(x => <Person key={x.person} id={x.person} groesse={16} />)}
      {a.map(x => x.name.split(' ')[0]).join(' und ')} {a.length > 1 ? 'sind' : 'ist'} gerade {was}
    </span>
  );
}

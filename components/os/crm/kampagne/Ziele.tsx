'use client';

// ─── Markttraktion › Kampagne › Ziele (M1, 01.11.: „Firmen in der Kampagne unsichtbar“) ──────────────────────────────────────────────────
// EINE Liste aller Ziele einer Kampagne — Personen UND Betriebe ohne Person — mit dem Stand der Sequenz (Schritt, fällig, Status bzw. Grund) und
// „Stoppen“. Für Betriebe zusätzlich: hinzufügen (Suche), herausnehmen und das Ergebnis festhalten (`firmenErgebnisse`). Personen pflegt wie bisher
// die Liste „Personen“ darunter. Den Stand rechnet der Server (GET /api/crm/kampagnen/motor › staende), hier wird nur gezeigt und geklickt.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Ueberschrift, Knopf, Chip, Leer, LEUCHT } from '../../ui';
import { Pillen } from '../teile';
import { anzeigename } from '@/lib/make-one/crm';
import { SEQUENZ_KANAELE } from '@/lib/crm/sequenz';
import type { CrmApi } from '../daten';
import type { Kampagne, KampagnenErgebnis, SequenzSchritt, ZielStatus } from '@/lib/crm/typen';

interface Stand { art: 'kontakt' | 'firma'; id: string; schritt: number; faelligAm: string; status: ZielStatus; grund?: string }
/** Ereignis, nach dem die Ziel-Liste neu lädt (Sequenz/Stapel ändern den Stand). */
export const MOTOR_GEAENDERT = 'make-kampagne-motor';

const STATUS: Record<ZielStatus, { text: string; farbe: string }> = {
  offen: { text: 'steht an', farbe: LEUCHT.puls }, wartet: { text: 'wartet (Entwurf bzw. Follow-up)', farbe: LEUCHT.achtung },
  reagiert: { text: 'reagiert', farbe: LEUCHT.gut }, gestoppt: { text: 'gestoppt', farbe: C.inkLeise }, fertig: { text: 'fertig', farbe: C.inkDim },
};
const ERGEBNISSE: { id: KampagnenErgebnis; label: string }[] = [
  { id: 'angesprochen', label: 'angesprochen' }, { id: 'reagiert', label: 'reagiert' }, { id: 'gespraech', label: 'Gespräch' }, { id: 'chance', label: 'Interesse → Lead' }, { id: 'kein_interesse', label: 'kein Interesse' },
];
const tag = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function KampagneZiele({ k, api, zuKontakt }: { k: Kampagne; api: CrmApi; zuKontakt: (id: string) => void }) {
  const [staende, setStaende] = useState<Stand[] | null>(null);
  const [sequenz, setSequenz] = useState<SequenzSchritt[]>([]);
  const [suche, setSuche] = useState('');
  const [meldung, setMeldung] = useState('');
  const [alle, setAlle] = useState(false);
  const laden = useCallback(async () => {
    const r = await fetch(`/api/crm/kampagnen/motor?kampagneId=${encodeURIComponent(k.id)}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) { setStaende(r.staende); setSequenz(r.sequenz ?? []); }
  }, [k.id]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { const f = () => void laden(); window.addEventListener(MOTOR_GEAENDERT, f); return () => window.removeEventListener(MOTOR_GEAENDERT, f); }, [laden]);

  const firmen = api.crm?.stand.firmen ?? [];
  const nachFirma = new Map(firmen.map(f => [f.id, f]));
  const nachKontakt = new Map((api.kontakte ?? []).map(x => [x.id, x]));
  const firmaIds = k.firmaIds ?? [];
  const stand = new Map((staende ?? []).map(s => [`${s.art}:${s.id}`, s]));
  const letztesF = new Map<string, KampagnenErgebnis>();
  for (const e of [...(k.firmenErgebnisse ?? [])].sort((a, b) => a.am.localeCompare(b.am))) letztesF.set(e.firmaId, e.ergebnis);
  const ziele = [...k.kontaktIds.map(id => ({ art: 'kontakt' as const, id })), ...firmaIds.map(id => ({ art: 'firma' as const, id }))];
  const treffer = suche.trim().length >= 2 ? firmen.filter(f => !f.geloeschtAm && !f.werbesperre && !firmaIds.includes(f.id) && f.name.toLowerCase().includes(suche.trim().toLowerCase())).slice(0, 6) : [];

  const stoppen = async (art: 'kontakt' | 'firma', id: string) => {
    const r = await fetch('/api/crm/kampagnen/motor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'stoppen', kampagneId: k.id, ziel: { art, id } }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? 'Gestoppt — offene Entwürfe sind verworfen, Follow-ups abgesagt.' : r.fehler ?? 'Nicht gestoppt.');
    await laden();
    window.dispatchEvent(new Event(MOTOR_GEAENDERT));
  };
  const ergebnis = async (firmaId: string, erg: KampagnenErgebnis) => {
    const r = await fetch('/api/crm/kampagnen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'ergebnis', id: k.id, firmaId, ergebnis: erg, ...(api.ich ? { von: api.ich } : {}) }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? `„${ERGEBNISSE.find(x => x.id === erg)?.label}“ bei ${nachFirma.get(firmaId)?.name ?? 'dem Betrieb'} festgehalten.${erg === 'chance' ? ' Der Lead des Betriebs steht jetzt in der Qualifizierung.' : ''}${r.hinweis ? ` ${r.hinweis}` : ''}` : r.fehler ?? 'Nicht gespeichert.');
    await api.laden(true);
  };
  const setzeFirmen = (ids: string[]) => api.teil('kampagnen', k.id, { firmaIds: ids });

  const zeile = (z: { art: 'kontakt' | 'firma'; id: string }) => {
    const s = stand.get(`${z.art}:${z.id}`);
    const f = z.art === 'firma' ? nachFirma.get(z.id) : undefined;
    const p = z.art === 'kontakt' ? nachKontakt.get(z.id) : undefined;
    const name = f?.name ?? (p ? anzeigename(p) : z.art === 'firma' ? 'Betrieb (nicht mehr bei den Firmen)' : 'Person (nicht in der Kartei)');
    const sch = s && s.schritt >= 0 ? sequenz[s.schritt] : undefined;
    const st = s ? STATUS[s.status] : null;
    const laeuft = s && (s.status === 'offen' || s.status === 'wartet');
    return (
      <div key={`${z.art}:${z.id}`} style={{ display: 'grid', gap: 6, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
          <Chip farbe={z.art === 'firma' ? LEUCHT.business : C.inkDim}>{z.art === 'firma' ? 'Betrieb' : 'Person'}</Chip>
          {z.art === 'firma'
            ? <Link href={WEG.firma(z.id)} style={{ color: C.ink, textDecoration: 'none' }}>{name}</Link>
            : <button onClick={() => zuKontakt(z.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{name}</button>}
          {!s && <span style={{ color: C.inkLeise }}>{sequenz.length ? (k.status === 'aktiv' ? 'noch nicht gestartet' : 'startet, sobald die Kampagne aktiv ist') : 'ohne Sequenz'}</span>}
          {s && st && <span style={{ color: st.farbe }}>{st.text}</span>}
          {s && laeuft && (sch ? <span style={{ color: C.inkDim }}>Schritt {s.schritt + 1} · {SEQUENZ_KANAELE.find(x => x.id === sch.kanal)?.label} · fällig {tag(s.faelligAm)}</span> : <span style={{ color: LEUCHT.achtung }}>Schritt gibt es nicht mehr — endet beim nächsten Lauf</span>)}
          {s?.grund && <span style={{ color: C.inkLeise }}>Grund: {s.grund}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {laeuft && <Knopf leise onClick={() => stoppen(z.art, z.id)}>Stoppen</Knopf>}
            {z.art === 'firma' && <button onClick={() => setzeFirmen(firmaIds.filter(i => i !== z.id))} aria-label={`${name} aus der Kampagne nehmen`} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>}
          </span>
        </div>
        {z.art === 'firma' && <Pillen liste={ERGEBNISSE} aktiv={letztesF.get(z.id)} onWahl={erg => void ergebnis(z.id, erg)} farbe={LEUCHT.puls} />}
      </div>
    );
  };

  return (
    <div>
      <Ueberschrift rechts={`${k.kontaktIds.length} Personen · ${firmaIds.length} Betriebe`}>Ziele</Ueberschrift>
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>{meldung} <button onClick={() => setMeldung('')} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>ok</button></div>}
      {!ziele.length && <Leer>Noch keine Ziele — Personen unten hinzufügen, Betriebe über die Suche hier.</Leer>}
      {ziele.slice(0, alle ? ziele.length : 15).map(zeile)}
      {ziele.length > 15 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 44 }}>{alle ? 'weniger' : `alle ${ziele.length}`}</button>}
      <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Betrieb hinzufügen …" aria-label="Betrieb hinzufügen" style={{ marginTop: 8, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: 16 }} />
      {treffer.map(f => <button key={f.id} onClick={() => { void setzeFirmen([...firmaIds, f.id]); setSuche(''); }} style={{ display: 'block', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 0', minHeight: 44 }}>+ {f.name}{f.stadt ? ` · ${f.stadt}` : ''}</button>)}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Betriebe mit Werbesperre lassen sich nicht hinzufügen. Wer gestoppt ist, startet in dieser Kampagne nicht noch einmal.</div>
    </div>
  );
}

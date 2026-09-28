'use client';
// ─── ZOE an Aufgaben (Paket C4, 28.09. spät) — Oberfläche ───────────────────
// Kevin: „ZOE soll ihre eigenen Aufgaben und Stapel bekommen, die sie abarbeiten kann und wir freigeben.“
//  · `ZoeAufgabe` (in der Aufgabe): „An ZOE geben“ (optional mit Hinweis), Status-Chip, „ZOE jetzt arbeiten lassen“,
//    Vorschlag ansehen → Freigeben / Ablehnen (mit Grund) / Ablehnen und nochmal (mit Hinweis), Zurückholen.
//  · `ZoeAufgabenSicht` (Aufgaben › Ansicht „ZOE“): was bei ZOE liegt, nach Status; Knopf für den Lauf.
// Geschrieben wird nur über /api/aufgaben/zoe (Aufgaben-Schreibweg mit Verlauf); danach lädt der Kontext neu.
// Den Vorschlag sieht und entscheidet nur die Auftraggeberin. Nichts wird ohne Klick übernommen.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, Leer, Ueberschrift, feld } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import { zoeAufgaben, auftraggeberinVon, darfAnZoe, vorschlagZeile, ZOE_STATUS_LABEL, type ZoeVorschlagInhalt } from '@/lib/aufgaben/zoe';
import { grundVon } from '@/lib/aufgaben/struktur';
import type { Task, TasksState, ZoeStatus } from '@/types/tasks';
import { ownerLabel, type Person } from './hilfe';

const ZOE_FARBE: Record<ZoeStatus, string> = {
  offen: C.aktiv, in_arbeit: LEUCHT.puls, wartet_freigabe: LEUCHT.achtung, freigegeben: LEUCHT.gut, abgelehnt: C.inkLeise,
};
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };

interface VorschlagSicht { id: string; zeit: string; status: string; titel: string; nachher: string; anlass: string | null; grund?: string; inhalt: ZoeVorschlagInhalt | null }
interface Antwort { ok?: boolean; error?: string; ergebnis?: string; konflikt?: boolean; bearbeitet?: unknown[]; uebersprungen?: { grund: string }[]; ohneKi?: string; rest?: number }

async function senden(body: Record<string, unknown>): Promise<Antwort> {
  try {
    const r = await fetch('/api/aufgaben/zoe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: `Antwort ${r.status}` }))) as Antwort;
  } catch { return { ok: false, error: 'nicht erreichbar' }; }
}

/** Ergebnis eines Laufs als ein Satz. */
export function laufSatz(d: Antwort): string {
  if (d.ok === false && d.error) return d.error;
  if (d.ohneKi) return `ZOE hat nichts vorbereitet (${d.ohneKi}).`;
  const n = d.bearbeitet?.length ?? 0;
  const u = d.uebersprungen?.length ?? 0;
  return `${n ? `ZOE hat ${n} Aufgabe${n === 1 ? '' : 'n'} vorbereitet — wartet auf Freigabe.` : 'ZOE hat nichts Neues vorbereitet.'}${u ? ` ${u} übersprungen (${d.uebersprungen![0].grund}).` : ''}${d.rest ? ` ${d.rest} noch offen.` : ''}`;
}

/** Der Vorschlag im Klartext — nur Text, keine Links/HTML (er stammt aus einem Modell und ggf. aus Fremdtext). */
function VorschlagInhalt({ v }: { v: ZoeVorschlagInhalt }) {
  return (
    <div style={{ display: 'grid', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
      <div style={{ color: C.ink }}>{v.zusammenfassung}</div>
      {v.entwurf && (
        <div>
          <div style={{ ...mikro, marginBottom: 4 }}>Entwurf für die Notiz</div>
          <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px 12px', maxHeight: 280, overflowY: 'auto', lineHeight: 1.5 }}>{v.entwurf}</div>
        </div>
      )}
      {!!v.unteraufgaben?.length && (
        <div>
          <div style={{ ...mikro, marginBottom: 4 }}>Unteraufgaben</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{v.unteraufgaben.map(u => <li key={u}>{u}</li>)}</ul>
        </div>
      )}
      {(v.status || v.deadline) && (
        <div>{v.status && <>Status → <b style={{ color: C.ink }}>{grundVon(v.status).label}</b></>}{v.status && v.deadline && ' · '}{v.deadline && <>Deadline → <b style={{ color: C.ink }}>{v.deadline.slice(8, 10)}.{v.deadline.slice(5, 7)}.{v.deadline.slice(0, 4)}</b></>}</div>
      )}
      {v.begruendung && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Warum: {v.begruendung}</div>}
    </div>
  );
}

/** In der Aufgabe: ZOE geben, Stand sehen, Vorschlag freigeben oder ablehnen. */
export function ZoeAufgabe({ task: t, ich, personen }: { task: Task; ich: string; personen: readonly Person[] }) {
  const { rehydrate } = useTasks();
  const [hinweisAuf, setHinweisAuf] = useState(false);
  const [hinweis, setHinweis] = useState('');
  const [grund, setGrund] = useState('');
  const [meldung, setMeldung] = useState('');
  const [vorschlag, setVorschlag] = useState<VorschlagSicht | null>(null);
  const [ki, setKi] = useState(true);
  const status = t.zoe?.status;
  const auftraggeberin = auftraggeberinVon(t);
  const meins = !!auftraggeberin && auftraggeberin === ich;

  const laden = useCallback(async () => {
    try {
      const d = await fetch(`/api/aufgaben/zoe?id=${encodeURIComponent(t.id)}`, { cache: 'no-store' }).then(r => r.json());
      setKi(d?.ki !== false);
      setVorschlag(d?.vorschlag ?? null);
    } catch { /* offline — Knöpfe bleiben, der Server entscheidet */ }
  }, [t.id]);
  useEffect(() => { setMeldung(''); setHinweisAuf(false); setHinweis(''); setGrund(''); }, [t.id]);
  useEffect(() => { if (status) void laden(); else setVorschlag(null); }, [status, t.zoe?.stapelId, laden]);

  const tun = async (body: Record<string, unknown>, erfolg: string) => {
    const d = await senden({ ...body, id: t.id });
    setMeldung(d.ok ? (d.ergebnis ?? (body.aktion === 'arbeiten' ? laufSatz(d) : erfolg)) : (d.error ?? 'Nicht gespeichert.'));
    if (d.ok) { setHinweis(''); setHinweisAuf(false); setGrund(''); }
    await rehydrate();
    await laden();
  };

  const hinweisFeld = (
    <input value={hinweis} onChange={e => setHinweis(e.target.value)} maxLength={1000} aria-label="Hinweis an ZOE"
      placeholder="Hinweis an ZOE (optional) — worauf soll sie achten?" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', marginTop: 8 }} />
  );

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ ...mikro, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>ZOE</span>
        {status && <Chip farbe={ZOE_FARBE[status]}>{ZOE_STATUS_LABEL[status]}</Chip>}
        {status && auftraggeberin && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>für {ownerLabel(auftraggeberin, personen)}</span>}
      </div>

      {darfAnZoe(t) && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf onClick={() => tun({ aktion: 'geben', ...(hinweis.trim() ? { hinweis: hinweis.trim() } : {}) }, 'Liegt jetzt bei ZOE — sie bereitet einen Vorschlag vor.')}>
              {status === 'abgelehnt' ? 'Nochmal an ZOE geben' : status === 'freigegeben' ? 'Wieder an ZOE geben' : 'An ZOE geben'}
            </Knopf>
            {!hinweisAuf && <button onClick={() => setHinweisAuf(true)} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>+ Hinweis</button>}
          </div>
          {hinweisAuf && hinweisFeld}
          {!status && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>ZOE bereitet vor (Entwurf, Unteraufgaben, Status/Deadline) — übernommen wird erst nach deiner Freigabe. Sie schickt nichts nach außen.</div>}
        </>
      )}

      {status === 'offen' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {meins && <Knopf aus={!ki} onClick={() => tun({ aktion: 'arbeiten', max: 1 }, '')}>ZOE jetzt arbeiten lassen</Knopf>}
          {meins && <Knopf leise onClick={() => tun({ aktion: 'zurueck' }, 'Von ZOE zurückgeholt.')}>Zurückholen</Knopf>}
          {!ki && <span style={{ fontSize: 12, color: C.inkLeise }}>ZOE kann gerade nicht arbeiten (kein Modell verfügbar).</span>}
        </div>
      )}

      {status === 'in_arbeit' && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>ZOE arbeitet gerade daran …</div>}

      {status === 'wartet_freigabe' && !meins && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Wartet auf die Freigabe von {auftraggeberin ? ownerLabel(auftraggeberin, personen) : 'der Auftraggeberin'}.</div>
      )}
      {status === 'wartet_freigabe' && meins && (
        vorschlag?.inhalt && vorschlag.status === 'offen' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <VorschlagInhalt v={vorschlag.inhalt} />
            <input value={grund} onChange={e => setGrund(e.target.value)} maxLength={400} aria-label="Grund fürs Ablehnen"
              placeholder="Grund fürs Ablehnen (optional) — ZOE lernt daraus" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} />
            {hinweisAuf && hinweisFeld}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Knopf farbe={LEUCHT.gut} onClick={() => tun({ aktion: 'freigeben', stapelId: vorschlag.id }, 'Übernommen.')}>Freigeben</Knopf>
              <Knopf leise onClick={() => tun({ aktion: 'ablehnen', stapelId: vorschlag.id, ...(grund.trim() ? { grund: grund.trim() } : {}) }, 'Abgelehnt.')}>Ablehnen</Knopf>
              <Knopf leise onClick={() => (hinweisAuf
                ? tun({ aktion: 'ablehnen', stapelId: vorschlag.id, nochmal: true, ...(grund.trim() ? { grund: grund.trim() } : {}), ...(hinweis.trim() ? { hinweis: hinweis.trim() } : {}) }, 'Abgelehnt — ZOE versucht es noch einmal.')
                : setHinweisAuf(true))}>{hinweisAuf ? 'Ablehnen und nochmal' : 'Nochmal mit Hinweis …'}</Knopf>
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>Freigeben übernimmt: {vorschlagZeile(vorschlag.inhalt)}. Auch im Stapel unter Aufträge & Freigaben.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
            <span>{vorschlag ? `Der Vorschlag ist ${vorschlag.status === 'freigegeben' ? 'schon freigegeben' : 'nicht mehr offen'}.` : 'Vorschlag wird geladen …'}</span>
            {vorschlag && <Knopf leise onClick={() => tun({ aktion: 'zurueck' }, 'Von ZOE zurückgeholt.')}>Zurückholen</Knopf>}
          </div>
        )
      )}

      {status === 'abgelehnt' && meins && vorschlag?.grund && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Abgelehnt: {vorschlag.grund}</div>}
      {meldung && <div role="status" style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
    </div>
  );
}

/** Aufgaben › „ZOE“: was bei ZOE liegt. Die Kachel „wartet auf Freigabe“ im Überblick nimmt `zoeAufgaben(state).wartet`. */
export function ZoeAufgabenSicht({ state, personen, ich, offenId, onOeffnen, i = 1 }: {
  state: TasksState; personen: readonly Person[]; ich: string; offenId: string | null; onOeffnen: (id: string) => void; i?: number;
}) {
  const { rehydrate } = useTasks();
  const [meldung, setMeldung] = useState('');
  const [ki, setKi] = useState(true);
  useEffect(() => { fetch('/api/aufgaben/zoe', { cache: 'no-store' }).then(r => r.json()).then(d => setKi(d?.ki !== false)).catch(() => {}); }, []);
  const s = zoeAufgaben(state);
  const meineOffen = s.offen.filter(t => auftraggeberinVon(t) === ich).length;
  const arbeiten = async () => {
    const d = await senden({ aktion: 'arbeiten' });
    setMeldung(laufSatz(d));
    await rehydrate();
  };
  const gruppe = (titel: string, liste: Task[], leer?: string) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...mikro, marginBottom: 4 }}>{titel} · {liste.length}</div>
      {!liste.length && leer && <Leer>{leer}</Leer>}
      {liste.map(t => {
        const a = auftraggeberinVon(t);
        return (
          <button key={t.id} onClick={() => onOeffnen(t.id)} className="fassbar" style={{
            display: 'flex', width: '100%', alignItems: 'center', gap: 10, textAlign: 'left', padding: '9px 6px', background: offenId === t.id ? 'rgba(255,255,255,.04)' : 'none',
            border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink,
          }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: TYP.bedien }}>{t.title}</span>
            {a && <span style={{ fontSize: 12, color: C.inkLeise }}>{ownerLabel(a, personen)}</span>}
            <Chip farbe={ZOE_FARBE[t.zoe!.status]}>{ZOE_STATUS_LABEL[t.zoe!.status]}</Chip>
          </button>
        );
      })}
    </div>
  );
  return (
    <Karte i={i} akzent={s.wartet.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={s.wartet.length ? LEUCHT.achtung : C.inkLeise} rechts={<Knopf aus={!ki || !meineOffen} onClick={arbeiten}>ZOE jetzt arbeiten lassen</Knopf>}>Bei ZOE</Ueberschrift>
      <div style={{ fontSize: 12.5, color: C.inkLeise }}>ZOE bereitet vor, ihr gebt frei. Sie schickt nichts nach außen und löscht nichts.{!ki ? ' Gerade ist kein Modell verfügbar.' : meineOffen ? ` ${meineOffen} deiner Aufgaben warten auf ihren Lauf.` : ''}</div>
      {meldung && <div role="status" style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
      {!s.alle.length && <Leer>Noch keine Aufgabe bei ZOE. In einer Aufgabe „An ZOE geben“ tippen.</Leer>}
      {s.alle.length > 0 && (
        <>
          {gruppe('Wartet auf Freigabe', s.wartet, 'Nichts wartet.')}
          {gruppe('Bei ZOE', [...s.inArbeit, ...s.offen], 'Nichts offen.')}
          {s.abgelehnt.length > 0 && gruppe('Abgelehnt', s.abgelehnt)}
          {s.freigegeben.length > 0 && gruppe('Zuletzt freigegeben', s.freigegeben.slice(0, 10))}
        </>
      )}
    </Karte>
  );
}

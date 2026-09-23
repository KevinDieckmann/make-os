'use client';

// ─── MAKE OS — Inbox ────────────────────────────────────────────────────────
// Eine Liste, eine Entscheidung je Mail. Jarvis stuft ein (wichtig · normal ·
// rauschen), fällige Wiedervorlagen stehen oben, Rauschen ist eingeklappt und
// geht in einem Zug weg. Je Mail: Erledigt · Aufgabe · Morgen · Montag ·
// Antwort (Jarvis schreibt, Apple Mail öffnet — gesendet wird von Hand).
// Tasten wie gehabt: j/k wandern, e erledigt, a Aufgabe, s morgen.
// Fächer, Screener und der Zero-Durchlauf des alten Baus: /os/inbox/voll.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { absenderKey } from '@/lib/make-one/inbox-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Segmente, Punkt, LEUCHT } from './schlank';

type Source = 'apple' | 'ms';
interface Msg { id: string; source: Source; account: string; sender: string; senderEmail?: string; subject: string; preview?: string; receivedAt: string; isRead: boolean; importance?: string; mbIndex?: number }
type StatusMap = Record<string, { status: string; at: string; bis?: string }>;
type Stufe = 'wichtig' | 'normal' | 'rauschen';
type TriageMap = Record<string, { stufe: Stufe; zeile: string; grund: string }>;
type Segment = 'offen' | 'erledigt';

const OFFEN = new Set(['offen', 'snoozed', '']);
const ERLEDIGT = new Set(['erledigt', 'aufgabe', 'delegiert']);
const SEG: { id: Segment; label: string }[] = [{ id: 'offen', label: 'Offen' }, { id: 'erledigt', label: 'Erledigt' }];
const STUFE_FARBE: Record<Stufe, string> = { wichtig: LEUCHT.gut, normal: LEUCHT.puls, rauschen: C.inkLeise };
const RANG: Record<Stufe, number> = { wichtig: 0, normal: 1, rauschen: 3 };

const fpOf = (m: Msg) => `${(m.senderEmail ?? m.sender).toLowerCase().trim()}|${m.subject.toLowerCase().trim().slice(0, 80)}|${m.receivedAt.slice(0, 16)}`;
const tagIn = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const naechsterMontag = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return localDay(d); };
function stripEmail(s: string): { name: string; email?: string } {
  const m = s.match(/^(.*?)\s*<(.+?)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, '').trim() || m[2], email: m[2] } : { name: s };
}
function relTime(iso: string): string {
  const t = new Date(iso).getTime(); if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60); if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function InboxSchlank() {
  const { state, dispatch } = useTasks();
  const heute = localDay();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [triage, setTriage] = useState<TriageMap>({});
  const [absender, setAbsender] = useState<Record<string, { status: string }>>({});
  const [quelle, setQuelle] = useState<{ apple: string; ms: string }>({ apple: 'lädt …', ms: 'lädt …' });
  const [seg, setSeg] = useState<Segment>('offen');
  const [offenId, setOffenId] = useState<string | null>(null);
  const [body, setBody] = useState<Record<string, string>>({});
  const [entwurf, setEntwurf] = useState<{ id: string; text: string } | null>(null);
  const [schreibt, setSchreibt] = useState(false);
  const [rauschenAuf, setRauschenAuf] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [laedt, setLaedt] = useState(true);
  const angefragt = useRef<Set<string>>(new Set());

  const merge = (a: Msg[], b: Msg[]) => { const m = new Map<string, Msg>(); a.concat(b).forEach(x => m.set(x.id, x)); return Array.from(m.values()).sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)); };

  useEffect(() => {
    fetch('/api/state/inbox').then(r => r.json()).then(d => setStatus(d.status ?? {})).catch(() => {});
    fetch('/api/inbox/triage').then(r => r.json()).then(d => setTriage(d.triage ?? {})).catch(() => {});
    fetch('/api/state/inbox-absender').then(r => r.json()).then(d => setAbsender(d.bekannt ?? {})).catch(() => {});
    fetch('/api/microsoft').then(r => r.json()).then(d => {
      const ms: Msg[] = (d.emails ?? []).map((e: Record<string, unknown>) => ({
        id: String(e.id), source: 'ms' as const, account: 'M365 · KEMARIS', sender: String(e.senderName ?? e.senderEmail ?? 'Unbekannt'), senderEmail: e.senderEmail as string | undefined,
        subject: String(e.subject ?? '(kein Betreff)'), preview: e.preview as string | undefined, receivedAt: String(e.receivedAt ?? new Date().toISOString()), isRead: !!e.isRead, importance: e.importance as string | undefined,
      }));
      setMsgs(p => merge(p, ms)); setQuelle(q => ({ ...q, ms: `${ms.length}` }));
    }).catch(() => setQuelle(q => ({ ...q, ms: 'nicht erreichbar' })));
    fetch('/api/apple-mail').then(r => r.json()).then(rows => {
      if (!Array.isArray(rows)) { setQuelle(q => ({ ...q, apple: rows?.error ?? 'Fehler' })); setLaedt(false); return; }
      const glatt = (x: unknown) => String(x ?? '').replace(/\\'/g, "'");
      const apple: Msg[] = rows.map((r: Record<string, unknown>) => { const { name, email } = stripEmail(glatt(r.sender)); return {
        id: String(r.id), source: 'apple' as const, account: String(r.account ?? 'Apple Mail'), sender: name, senderEmail: email, subject: glatt(r.subject) || '(kein Betreff)',
        receivedAt: String(r.receivedAt ?? new Date().toISOString()), isRead: !!r.isRead, mbIndex: r.mbIndex as number | undefined,
      }; });
      setMsgs(p => merge(p, apple)); setQuelle(q => ({ ...q, apple: `${apple.length}` })); setLaedt(false);
    }).catch(() => { setQuelle(q => ({ ...q, apple: 'nicht erreichbar' })); setLaedt(false); });
  }, []);

  // Jarvis stuft alles Uneingeteilte ein — einmal je Mail, Ergebnis liegt im Cache.
  useEffect(() => {
    if (laedt || !msgs.length) return;
    const neu = msgs.filter(m => !triage[fpOf(m)] && !angefragt.current.has(fpOf(m)));
    if (!neu.length) return;
    neu.forEach(m => angefragt.current.add(fpOf(m)));
    fetch('/api/inbox/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nachrichten: neu.slice(0, 60).map(m => ({ fp: fpOf(m), sender: m.sender, subject: m.subject, account: m.account, preview: m.preview })) }) })
      .then(r => r.json()).then(d => { if (d.triage) setTriage(d.triage); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laedt, msgs]);

  const istOffen = (id: string) => { const e = status[id]; if (!e || OFFEN.has(e.status)) return !(e?.status === 'snoozed' && e.bis && e.bis > heute); return false; };
  const istFaellig = (id: string) => status[id]?.status === 'snoozed' && !!status[id]?.bis && status[id]!.bis! <= heute;
  const stufe = (m: Msg): Stufe | undefined => triage[fpOf(m)]?.stufe;

  const setzen = (ops: { id: string; status: string | null; bis?: string }[]) => {
    const at = new Date().toISOString();
    setStatus(s => { const n = { ...s }; ops.forEach(o => { if (o.status) n[o.id] = { status: o.status, at, ...(o.bis ? { bis: o.bis } : {}) }; else delete n[o.id]; }); return n; });
    fetch('/api/state/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }), keepalive: true }).catch(() => {});
  };
  const aufgabe = (m: Msg) => {
    const schonDa = state.tasks.find(t => t.status !== 'done' && t.title.trim().toLowerCase() === m.subject.trim().toLowerCase() && (t.description ?? '').startsWith('Aus Inbox'));
    if (!schonDa) dispatch({ type: 'ADD_TASK', payload: { projectId: state.projects[0]?.id ?? '', title: m.subject, description: `Aus Inbox · ${m.sender}${m.senderEmail ? ` <${m.senderEmail}>` : ''}`, status: 'todo', priority: m.importance === 'high' ? 'high' : 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0 } });
    setzen([{ id: m.id, status: 'aufgabe' }]); setMeldung(schonDa ? `Aufgabe gab es schon: ${m.subject}` : `Aufgabe angelegt: ${m.subject}`);
  };
  const oeffnen = async (m: Msg) => {
    const zu = offenId === m.id; setOffenId(zu ? null : m.id); setEntwurf(null);
    if (!zu && m.source === 'apple' && !body[m.id] && m.mbIndex) {
      const d = await fetch(`/api/apple-mail/body?account=${encodeURIComponent(m.account)}&index=${m.mbIndex}`).then(r => r.json()).catch(() => ({}));
      setBody(b => ({ ...b, [m.id]: d.body ?? d.error ?? '(kein Inhalt)' }));
    }
  };
  const antworten = async (m: Msg) => {
    setSchreibt(true);
    const d = await fetch('/api/inbox/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: m.sender, senderEmail: m.senderEmail, subject: m.subject, body: (m.source === 'ms' ? m.preview : body[m.id]) ?? m.preview ?? '' }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setEntwurf({ id: m.id, text: d.draft || `— ${d.error ?? 'kein Entwurf'}` }); setSchreibt(false);
  };
  const inMail = async (m: Msg) => {
    if (!entwurf?.text) return;
    const d = await fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: m.senderEmail ?? '', subject: `Re: ${m.subject}`, body: entwurf.text }) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(d.ok ? 'Entwurf in Apple Mail geöffnet — prüfen und selbst senden.' : d.error ?? 'Konnte nicht öffnen.');
  };
  const blocken = (m: Msg) => {
    const key = absenderKey(m); if (!key) return;
    setAbsender(a => ({ ...a, [key]: { status: 'geblockt' } }));
    fetch('/api/state/inbox-absender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ absender: key, status: 'geblockt' }) }).catch(() => {});
    setMeldung(`${m.sender} kommt nicht mehr in die Inbox.`);
  };

  const sichtbar = useMemo(() => msgs.filter(m => seg === 'offen' ? istOffen(m.id) && absender[absenderKey(m)]?.status !== 'geblockt' : ERLEDIGT.has(status[m.id]?.status ?? ''))
    .sort((a, b) => (istFaellig(b.id) ? 1 : 0) - (istFaellig(a.id) ? 1 : 0) || (RANG[stufe(a) ?? 'normal'] - RANG[stufe(b) ?? 'normal']) || b.receivedAt.localeCompare(a.receivedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [msgs, status, triage, absender, seg]);
  const gruppen = seg === 'offen'
    ? [
      { titel: 'Wiedervorlage', liste: sichtbar.filter(m => istFaellig(m.id)) },
      { titel: 'Wichtig', liste: sichtbar.filter(m => !istFaellig(m.id) && stufe(m) === 'wichtig') },
      { titel: 'Normal', liste: sichtbar.filter(m => !istFaellig(m.id) && (stufe(m) ?? 'normal') === 'normal') },
    ]
    : [{ titel: 'Erledigt', liste: sichtbar.slice(0, 40) }];
  const rauschen = seg === 'offen' ? sichtbar.filter(m => !istFaellig(m.id) && stufe(m) === 'rauschen') : [];
  const offenZahl = msgs.filter(m => istOffen(m.id) && absender[absenderKey(m)]?.status !== 'geblockt').length;

  // Tasten: j/k wandern, Enter öffnet, e erledigt, a Aufgabe, s morgen.
  useEffect(() => {
    const alle = [...gruppen.flatMap(g => g.liste), ...(rauschenAuf ? rauschen : [])];
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName; if (ev.metaKey || ev.ctrlKey || ev.altKey || tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = ev.key.toLowerCase(); if (!alle.length) return;
      const idx = offenId ? alle.findIndex(m => m.id === offenId) : -1;
      if (k === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); setOffenId(alle[Math.min(alle.length - 1, idx + 1)].id); return; }
      if (k === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); setOffenId(alle[Math.max(0, idx - 1)].id); return; }
      if (k === 'escape') { setOffenId(null); return; }
      if (idx < 0) return; const m = alle[idx]; const weiter = () => setOffenId(alle[Math.min(alle.length - 1, idx + 1)]?.id ?? null);
      if (k === 'e') { ev.preventDefault(); setzen([{ id: m.id, status: 'erledigt' }]); weiter(); }
      else if (k === 'a') { ev.preventDefault(); aufgabe(m); weiter(); }
      else if (k === 's') { ev.preventDefault(); setzen([{ id: m.id, status: 'snoozed', bis: tagIn(1) }]); weiter(); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruppen, rauschen, rauschenAuf, offenId]);

  const Detail = ({ m }: { m: Msg }) => (
    <div style={{ padding: '6px 2px 18px 22px', borderBottom: `1px solid ${C.linie}` }}>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>{m.senderEmail ?? m.sender} · {m.account} · {new Date(m.receivedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{triage[fpOf(m)]?.grund ? ` · ${triage[fpOf(m)].grund}` : ''}</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.55, maxHeight: 320, overflow: 'auto' }}>{(m.source === 'apple' ? body[m.id] : m.preview) ?? (m.source === 'apple' && m.mbIndex ? 'lädt …' : m.preview ?? '')}</pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {seg === 'offen' ? (<>
          <Knopf onClick={() => setzen([{ id: m.id, status: 'erledigt' }])}>Erledigt</Knopf>
          <Knopf leise onClick={() => aufgabe(m)}>Aufgabe</Knopf>
          <Knopf leise onClick={() => setzen([{ id: m.id, status: 'snoozed', bis: tagIn(1) }])}>Morgen</Knopf>
          <Knopf leise onClick={() => setzen([{ id: m.id, status: 'snoozed', bis: naechsterMontag() }])}>Montag</Knopf>
          <Knopf leise onClick={() => setzen([{ id: m.id, status: 'delegiert' }])}>Delegiert</Knopf>
          {!entwurf && <Knopf leise onClick={() => antworten(m)} aus={schreibt}>{schreibt ? 'Jarvis schreibt …' : 'Antwort'}</Knopf>}
          <button onClick={() => blocken(m)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12 }}>Absender blocken</button>
        </>) : <Knopf leise onClick={() => setzen([{ id: m.id, status: 'offen' }])}>Wieder öffnen</Knopf>}
      </div>
      {entwurf?.id === m.id && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.linie}`, paddingTop: 12 }}>
          <textarea value={entwurf.text} onChange={e => setEntwurf({ id: m.id, text: e.target.value })} rows={8} style={{ width: '100%', background: C.flaeche, border: 'none', borderRadius: 10, padding: 12, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: 1.55, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Knopf onClick={() => inMail(m)}>In Mail öffnen</Knopf>
            <Knopf leise onClick={() => setEntwurf(null)}>Verwerfen</Knopf>
          </div>
        </div>
      )}
    </div>
  );

  const zeile = (m: Msg) => (
    <div key={m.id}>
      <Zeile onClick={() => oeffnen(m)} aktiv={offenId === m.id}
        links={<Punkt farbe={istFaellig(m.id) ? C.achtung : STUFE_FARBE[stufe(m) ?? 'normal']} />}
        titel={<><span style={{ fontWeight: m.isRead ? 400 : 600 }}>{m.sender}</span><span style={{ color: C.inkLeise }}> · {m.subject}</span></>}
        unter={triage[fpOf(m)]?.zeile ?? m.preview}
        rechts={<span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{relTime(m.receivedAt)}</span>} />
      {offenId === m.id && <Detail m={m} />}
    </div>
  );

  return (
    <Seite titel={<>Inbox {offenZahl > 0 && <span style={{ color: C.inkLeise, fontWeight: 500, fontSize: 15 }}>{offenZahl} offen</span>}</>}
      rechts={<span style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Segmente liste={SEG} aktiv={seg} onWahl={setSeg} /><Link href="/os/inbox/voll" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Volle Ansicht ›</Link></span>}>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 12 }}>{meldung}</div>}
      {laedt && !msgs.length && <Karte i={0}><Leer>Apple Mail antwortet gleich · Microsoft 365 {quelle.ms} …</Leer></Karte>}
      {!laedt && !sichtbar.length && !rauschen.length && <Karte i={0} akzent={LEUCHT.gut}><Leer>{seg === 'offen' ? 'Nichts offen. Apple Mail ' + quelle.apple + ' · Microsoft 365 ' + quelle.ms + '.' : 'Noch nichts erledigt.'}</Leer></Karte>}
      {gruppen.filter(g => g.liste.length).map((g, gi) => (
        <Karte key={g.titel} i={gi} akzent={g.titel === 'Wiedervorlage' ? LEUCHT.achtung : g.titel === 'Wichtig' ? LEUCHT.gut : undefined}>
          <Ueberschrift farbe={g.titel === 'Wiedervorlage' ? LEUCHT.achtung : g.titel === 'Wichtig' ? LEUCHT.gut : g.titel === 'Normal' ? LEUCHT.puls : C.inkLeise} rechts={`${g.liste.length}`}>{g.titel}</Ueberschrift>
          <Liste>{g.liste.map(zeile)}</Liste>
        </Karte>
      ))}
      {rauschen.length > 0 && (
        <Karte i={gruppen.length}>
          <Ueberschrift rechts={<span style={{ display: 'flex', gap: 14 }}>
            <button onClick={() => setRauschenAuf(a => !a)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 }}>{rauschenAuf ? 'einklappen' : `${rauschen.length} anzeigen`}</button>
            <button onClick={() => setzen(rauschen.map(m => ({ id: m.id, status: 'erledigt' })))} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 }}>alle erledigen</button>
          </span>}>Rauschen</Ueberschrift>
          {rauschenAuf ? <Liste>{rauschen.map(zeile)}</Liste> : <Leer>Newsletter und Automatisches — {rauschen.length} Mails, die keine Entscheidung brauchen.</Leer>}
        </Karte>
      )}
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 28 }}>Apple Mail {quelle.apple} · Microsoft 365 {quelle.ms} · Tasten: j/k wandern · e erledigt · a Aufgabe · s morgen</div>
    </Seite>
  );
}

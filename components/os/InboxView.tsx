'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO } from '@/lib/make-one/design';
import { Held } from './Held';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { FAECHER, FACH, fachVon, absenderKey } from '@/lib/make-one/inbox-data';

// ─── Normalisierte Nachricht (Apple Mail live + M365 Snapshot) ───────────────
type Source = 'apple' | 'ms';
interface Msg {
  id: string; source: Source; account: string;
  sender: string; senderEmail?: string; subject: string;
  preview?: string; receivedAt: string; isRead: boolean;
  importance?: string; hasAttachment?: boolean; mbIndex?: number;
}
type StatusMap = Record<string, { status: string; at: string; bis?: string }>;
type Stufe = 'wichtig' | 'normal' | 'rauschen';
type TriageMap = Record<string, { stufe: Stufe; zeile: string; grund: string }>;

const OPEN = new Set(['offen', 'snoozed', '']);
const DONE = new Set(['erledigt', 'aufgabe', 'delegiert']);

const tagIn = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const naechsterMontag = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return localDay(d); };

// Stabiler Fingerabdruck je Mail — Apple-IDs sind index-basiert und verschieben
// sich, sobald neue Post kommt. Der fp bleibt gleich → Triage-Cache hält.
const fpOf = (m: { sender: string; senderEmail?: string; subject: string; receivedAt: string }) =>
  `${(m.senderEmail ?? m.sender).toLowerCase().trim()}|${m.subject.toLowerCase().trim().slice(0, 80)}|${m.receivedAt.slice(0, 16)}`;

const STUFE_META: Record<Stufe, { label: string; farbe: string; rang: number }> = {
  wichtig: { label: 'Wichtig', farbe: '#58D9CD', rang: 0 },
  normal: { label: 'Normal', farbe: '#96A8A2', rang: 1 },
  rauschen: { label: 'Rauschen', farbe: '#5A6B66', rang: 3 },
};
const stufeRang = (s?: Stufe) => (s ? STUFE_META[s].rang : 2);

function stripEmail(s: string): { name: string; email?: string } {
  const m = s.match(/^(.*?)\s*<(.+?)>\s*$/);
  if (m) return { name: (m[1].replace(/^"|"$/g, '').trim() || m[2]), email: m[2] };
  return { name: s };
}
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'gerade';
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '·';
}
const srcColor = (s: Source) => (s === 'apple' ? T.accent : T.amber);
const srcLabel = (m: Msg) => (m.source === 'apple' ? m.account : 'M365 · KEMARIS');

const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

export function InboxView() {
  const { state, dispatch } = useTasks();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [sel, setSel] = useState<string | null>(null);
  const [seg, setSeg] = useState<'offen' | 'erledigt' | 'alle'>('offen');
  const [srcFilter, setSrcFilter] = useState<string>('alle');
  // Split Inbox + Screener (aus der Marktanalyse: Hey, Shortwave, Superhuman)
  const [fachFilter, setFachFilter] = useState<string>('alle');
  const [absender, setAbsender] = useState<Record<string, { status: 'durchgelassen' | 'geblockt'; seit: string }>>({});
  const [screenerAuf, setScreenerAuf] = useState(false);
  useEffect(() => {
    fetch('/api/state/inbox-absender').then(r => r.json()).then(d => setAbsender(d.bekannt ?? {})).catch(() => {});
  }, []);
  function entscheideAbsender(key: string, st: 'durchgelassen' | 'geblockt') {
    setAbsender(prev => ({ ...prev, [key]: { status: st, seit: localDay() } }));
    fetch('/api/state/inbox-absender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ absender: key, status: st }) }).catch(() => {});
  }
  const [q, setQ] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftInfo, setDraftInfo] = useState('');
  const [sync, setSync] = useState<{ apple: string; ms: string }>({ apple: 'lädt …', ms: 'lädt …' });
  const [body, setBody] = useState<Record<string, string>>({});
  const [bodyLoading, setBodyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triage, setTriage] = useState<TriageMap>({});
  const [triageBusy, setTriageBusy] = useState(false);
  const [rauschenAuf, setRauschenAuf] = useState(false);
  // Kommando-Zentrale: Jarvis-Meldungen (Shields) + Agenten-Ergebnisse als Eingänge.
  const [shields, setShields] = useState<{ id: string; stufe: 'rot' | 'amber'; text: string; href: string; label: string }[]>([]);
  const [laeufe, setLaeufe] = useState<{ agent: string; title: string; ts: string }[]>([]);
  useEffect(() => {
    fetch('/api/risk').then(r => r.json()).then(d => setShields(Array.isArray(d.shields) ? d.shields : [])).catch(() => {});
    fetch('/api/state/agent-log?limit=20').then(r => r.json()).then(d => setLaeufe(Array.isArray(d.entries) ? d.entries : [])).catch(() => {});
  }, []);
  const agentHref = (agent: string) => {
    if (agent.startsWith('loop-')) return '/os/loop';
    if (agent.startsWith('tageslauf')) return '/os/tageslauf';
    return LIVE_AGENTS.find(a => a.id === agent)?.href ?? '/os/agenten';
  };
  // Nur die letzten 24 Std., ein Eintrag je Agent — Ergebnisse, kein Rauschen.
  const meldungen = useMemo(() => {
    const grenze = Date.now() - 24 * 3600_000;
    const gesehen = new Set<string>();
    return laeufe.filter(l => {
      if (new Date(l.ts).getTime() < grenze || gesehen.has(l.agent)) return false;
      gesehen.add(l.agent);
      return true;
    }).slice(0, 5);
  }, [laeufe]);
  // Zwei-Fenster-Fundament: nur die angefassten Mails gehen raus, nicht die
  // ganze Status-Karte — sonst macht ein Häkchen von Kevin Malins gerade
  // weggearbeitete Post wieder auf. Gesammelt und gebündelt geschickt, damit
  // ein schneller Tastatur-Durchlauf nicht pro Mail einen Aufruf macht.
  /** Schon vorhandene Aufgabe beim Übernehmen — kurzer Hinweis statt Doppel. */
  const [doppelt, setDoppelt] = useState<{ titel: string; id: string } | null>(null);
  const offeneOps = useRef<Map<string, { id: string; status: string | null; bis?: string }>>(new Map());
  const spaeter = useNachspeichern<null>(() => {
    const ops = Array.from(offeneOps.current.values());
    offeneOps.current.clear();
    if (!ops.length) return;
    fetch('/api/state/inbox', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }), keepalive: true,
    }).catch(() => { /* offline — nächster Klick versucht es erneut */ });
  }, 300);

  /** Eine Mail vormerken und das gebündelte Schreiben anstoßen. */
  const merken = (id: string, s: string | null, bis?: string) => {
    offeneOps.current.set(id, { id, status: s, bis });
    spaeter(null);
  };
  const triageAngefragt = useRef<Set<string>>(new Set());

  // ── laden: Apple (live) + M365 (Snapshot) + Status ──
  async function load() {
    setLoading(true);
    // Status
    fetch('/api/state/inbox').then(r => r.json()).then((d: { status: StatusMap }) => setStatus(d.status ?? {})).catch(() => {});
    // M365 (Snapshot, schnell)
    fetch('/api/microsoft').then(r => r.json()).then((d: { emails?: any[] }) => {
      const ms: Msg[] = (d.emails ?? []).map(e => ({
        id: e.id, source: 'ms', account: 'M365 · KEMARIS',
        sender: e.senderName ?? e.senderEmail ?? 'Unbekannt', senderEmail: e.senderEmail,
        subject: e.subject ?? '(kein Betreff)', preview: e.preview,
        receivedAt: e.receivedAt ?? new Date().toISOString(), isRead: !!e.isRead,
        importance: e.importance, hasAttachment: !!e.hasAttachment,
      }));
      setMsgs(prev => dedupeMerge(prev, ms));
      setSync(s => ({ ...s, ms: `${ms.length} · Snapshot` }));
    }).catch(() => setSync(s => ({ ...s, ms: 'nicht erreichbar' })));
    // Apple (live, kann ein paar Sekunden dauern)
    fetch('/api/apple-mail').then(r => r.json()).then((rows: any) => {
      if (!Array.isArray(rows)) { setSync(s => ({ ...s, apple: rows?.error ?? 'Fehler' })); setLoading(false); return; }
      const apple: Msg[] = rows.map((r: any) => {
        const { name, email } = stripEmail(r.sender ?? '');
        return {
          id: r.id, source: 'apple', account: r.account ?? 'Apple Mail',
          sender: name, senderEmail: email, subject: r.subject ?? '(kein Betreff)',
          receivedAt: r.receivedAt ?? new Date().toISOString(), isRead: !!r.isRead, mbIndex: r.mbIndex,
        };
      });
      setMsgs(prev => dedupeMerge(prev, apple));
      setSync(s => ({ ...s, apple: `${apple.length} · live` }));
      setLoading(false);
    }).catch(() => { setSync(s => ({ ...s, apple: 'nicht erreichbar' })); setLoading(false); });
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ── Jarvis-Triage: Cache laden, dann alles Uneingeteilte automatisch einstufen ──
  useEffect(() => {
    fetch('/api/inbox/triage').then(r => r.json()).then(d => setTriage(d.triage ?? {})).catch(() => {});
  }, []);
  useEffect(() => {
    if (loading || !msgs.length) return;
    const offen = msgs.filter(m => {
      const fp = fpOf(m);
      return !triage[fp] && !triageAngefragt.current.has(fp);
    });
    if (!offen.length) return;
    offen.forEach(m => triageAngefragt.current.add(fpOf(m)));
    setTriageBusy(true);
    fetch('/api/inbox/triage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nachrichten: offen.slice(0, 60).map(m => ({ fp: fpOf(m), sender: m.sender, subject: m.subject, account: srcLabel(m), preview: m.preview })) }),
    }).then(r => r.json()).then(d => { if (d.triage) setTriage(d.triage); })
      .catch(() => {}).finally(() => setTriageBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, msgs]);

  function dedupeMerge(a: Msg[], b: Msg[]): Msg[] {
    const map = new Map<string, Msg>();
    a.concat(b).forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort((x, y) => y.receivedAt.localeCompare(x.receivedAt));
  }

  // ── Status setzen + persistieren (snoozed trägt ein bis-Datum) ──
  function setMsgStatus(id: string, s: string, bis?: string) {
    setStatus({ ...status, [id]: { status: s, at: new Date().toISOString(), ...(bis ? { bis } : {}) } });
    merken(id, s, bis);
  }
  const statusOf = (id: string) => status[id]?.status ?? 'offen';
  const heuteTag = localDay();
  /** Offen JETZT: snoozed mit bis in der Zukunft ist unsichtbar — danach ⏰ Wiedervorlage. */
  const istOffen = (id: string) => {
    const e = status[id];
    if (!e || OPEN.has(e.status)) {
      if (e?.status === 'snoozed' && e.bis && e.bis > heuteTag) return false;
      return !e || OPEN.has(e.status);
    }
    return false;
  };
  const istWiedervorlage = (id: string) => status[id]?.status === 'snoozed' && !!status[id]?.bis && status[id]!.bis! <= heuteTag;

  // ── „→ Aufgabe" aus einer Mail ──
  // Duplikat-Wache: zu zweit landet dieselbe Mail schnell zweimal im Board —
  // genau so entstand „AW: Absage Termin CT Spritze" doppelt (31.07., eine
  // Minute Abstand). Gibt es die Aufgabe schon, wird sie nur markiert.
  function toTask(m: Msg) {
    const schonDa = state.tasks.find(t =>
      t.status !== 'done'
      && t.title.trim().toLowerCase() === m.subject.trim().toLowerCase()
      && (t.description ?? '').startsWith('Aus Inbox'));
    if (schonDa) {
      setDoppelt({ titel: m.subject, id: schonDa.id });
      setMsgStatus(m.id, 'aufgabe');
      return;
    }
    const projectId = state.projects[0]?.id ?? '';
    dispatch({
      type: 'ADD_TASK',
      payload: {
        projectId, title: m.subject,
        description: `Aus Inbox · ${m.sender}${m.senderEmail ? ` <${m.senderEmail}>` : ''}`,
        status: 'todo', priority: m.importance === 'high' ? 'high' : 'medium',
        assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0,
      },
    });
    setMsgStatus(m.id, 'aufgabe');
  }

  // ── Body bei Bedarf laden (Apple) ──
  async function openMsg(m: Msg) {
    setSel(m.id);
    setDraftText(''); setDraftInfo('');
    if (m.source === 'apple' && !body[m.id] && m.mbIndex) {
      setBodyLoading(true);
      try {
        const r = await fetch(`/api/apple-mail/body?account=${encodeURIComponent(m.account)}&index=${m.mbIndex}`);
        const d = await r.json();
        setBody(prev => ({ ...prev, [m.id]: d.body ?? d.error ?? '(kein Inhalt)' }));
      } catch { setBody(prev => ({ ...prev, [m.id]: '(Inhalt konnte nicht geladen werden)' })); }
      finally { setBodyLoading(false); }
    }
  }

  // ── Inbox-Agent: Antwort entwerfen + in Mail öffnen ──
  async function makeDraft(m: Msg) {
    setDraftBusy(true); setDraftInfo('');
    try {
      const src = (m.source === 'ms' ? m.preview : body[m.id]) ?? m.preview ?? '';
      const r = await fetch('/api/inbox/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: m.sender, senderEmail: m.senderEmail, subject: m.subject, body: src }) });
      const d = await r.json();
      setDraftText(d.draft || (d.error ? `— ${d.error}` : 'Kein Entwurf erhalten.'));
    } catch { setDraftText('Ich konnte gerade keinen Entwurf schreiben — nochmal versuchen.'); }
    finally { setDraftBusy(false); }
  }
  // ── Zero-Durchlauf: eine Mail nach der anderen, jede genau EINE Entscheidung ──
  interface ZeroLauf { queue: string[]; pos: number; stats: { erledigt: number; aufgabe: number; delegiert: number; uebersprungen: number } }
  const [zero, setZero] = useState<ZeroLauf | null>(null);

  const zeroKandidaten = () => msgs
    .filter(m => istOffen(m.id))
    .filter(m => triage[fpOf(m)]?.stufe !== 'rauschen')
    .sort((a, b) => stufeRang(triage[fpOf(a)]?.stufe) - stufeRang(triage[fpOf(b)]?.stufe) || b.receivedAt.localeCompare(a.receivedAt));

  function zeroStart() {
    const liste = zeroKandidaten();
    if (!liste.length) return;
    setZero({ queue: liste.map(m => m.id), pos: 0, stats: { erledigt: 0, aufgabe: 0, delegiert: 0, uebersprungen: 0 } });
    openMsg(liste[0]);
  }

  function zeroEntscheid(aktion: 'erledigt' | 'aufgabe' | 'delegiert' | 'uebersprungen') {
    // Seiteneffekte bewusst AUSSERHALB des State-Updaters (StrictMode ruft
    // Updater doppelt — sonst entstehen doppelte Aufgaben).
    if (!zero || zero.pos >= zero.queue.length) return;
    const m = msgs.find(x => x.id === zero.queue[zero.pos]);
    if (m && aktion !== 'uebersprungen') {
      if (aktion === 'aufgabe') toTask(m);
      else setMsgStatus(m.id, aktion);
    }
    const pos = zero.pos + 1;
    const naechste = msgs.find(x => x.id === zero.queue[pos]);
    if (naechste) openMsg(naechste);
    setZero({ ...zero, pos, stats: { ...zero.stats, [aktion]: zero.stats[aktion] + 1 } });
  }

  function zeroAntworten() {
    if (!zero) return;
    const m = msgs.find(x => x.id === zero.queue[zero.pos]);
    setZero(null);
    if (m) { openMsg(m); makeDraft(m); }
  }

  /** Rauschen in einem Zug wegräumen — Newsletter verdienen keine Einzelentscheidung. */
  function rauschenAufraeumen() {
    const rausch = msgs.filter(m => istOffen(m.id) && triage[fpOf(m)]?.stufe === 'rauschen');
    if (!rausch.length) return;
    const next = { ...status };
    const at = new Date().toISOString();
    rausch.forEach(m => { next[m.id] = { status: 'erledigt', at }; merken(m.id, 'erledigt'); });
    setStatus(next);
  }

  // Tastatur-Tempo im Durchlauf: E/A/D/S + Esc — nie schneller triagiert.
  useEffect(() => {
    if (!zero) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { setZero(null); return; }
      if (zero && zero.pos >= zero.queue.length) return;
      if (k === 'e') { e.preventDefault(); zeroEntscheid('erledigt'); }
      else if (k === 'a') { e.preventDefault(); zeroEntscheid('aufgabe'); }
      else if (k === 'd') { e.preventDefault(); zeroEntscheid('delegiert'); }
      else if (k === 's' || k === 'arrowright') { e.preventDefault(); zeroEntscheid('uebersprungen'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zero, msgs]);


  async function openInMail(m: Msg) {
    if (!draftText.trim()) return;
    setDraftInfo('öffnet in Apple Mail …');
    try {
      const r = await fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: m.senderEmail ?? '', subject: `Re: ${m.subject}`, body: draftText }) });
      const d = await r.json();
      setDraftInfo(d.ok ? '✓ Als Entwurf in Apple Mail geöffnet — prüfen & selbst senden.' : (d.error ?? 'Konnte nicht öffnen.'));
    } catch { setDraftInfo('Konnte nicht öffnen — versuch es nochmal.'); }
  }

  // ── Filter ──
  const accounts = useMemo(() => {
    const set = new Set<string>(); msgs.forEach(m => set.add(m.source === 'apple' ? m.account : 'M365 · KEMARIS'));
    return Array.from(set);
  }, [msgs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return msgs.filter(m => {
      const st = statusOf(m.id);
      if (seg === 'offen' && !istOffen(m.id)) return false;
      if (seg === 'erledigt' && !DONE.has(st)) return false;
      if (srcFilter !== 'alle') { const acc = m.source === 'apple' ? m.account : 'M365 · KEMARIS'; if (acc !== srcFilter) return false; }
      // Geblockte Absender verschwinden aus dem Postfach — genau das ist der Sinn.
      if (seg === 'offen' && absender[absenderKey(m)]?.status === 'geblockt') return false;
      if (fachFilter !== 'alle' && fachVon(m) !== fachFilter) return false;
      if (needle) {
        const hay = `${m.sender} ${m.senderEmail ?? ''} ${m.subject} ${m.preview ?? ''} ${triage[fpOf(m)]?.zeile ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
      // ⏰ Fällige Wiedervorlagen ganz oben, dann Wichtig → Rauschen, innerhalb nach Zeit.
    }).sort((a, b) =>
      (istWiedervorlage(b.id) ? 1 : 0) - (istWiedervorlage(a.id) ? 1 : 0) ||
      stufeRang(triage[fpOf(a)]?.stufe) - stufeRang(triage[fpOf(b)]?.stufe) ||
      b.receivedAt.localeCompare(a.receivedAt));
  }, [msgs, status, seg, srcFilter, fachFilter, q, triage, absender]);

  /** Wie viel liegt in jedem Fach — Zahlen an den Reitern. */
  const fachZahlen = useMemo(() => {
    const z: Record<string, number> = {};
    msgs.filter(m => istOffen(m.id) && absender[absenderKey(m)]?.status !== 'geblockt')
      .forEach(m => { const f = fachVon(m); z[f] = (z[f] ?? 0) + 1; });
    return z;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, status, absender]);

  /** Screener: Absender, über die noch nie entschieden wurde — je einmal, dann nie wieder. */
  const screener = useMemo(() => {
    const map = new Map<string, { name: string; email?: string; anzahl: number; letzte: string; betreff: string; fach: string }>();
    msgs.filter(m => istOffen(m.id)).forEach(m => {
      const key = absenderKey(m);
      if (!key || absender[key]) return;
      const e = map.get(key);
      if (e) { e.anzahl++; if (m.receivedAt > e.letzte) { e.letzte = m.receivedAt; e.betreff = m.subject; } }
      else map.set(key, { name: m.sender, email: m.senderEmail, anzahl: 1, letzte: m.receivedAt, betreff: m.subject, fach: fachVon(m) });
    });
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.anzahl - a.anzahl || b.letzte.localeCompare(a.letzte));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, status, absender]);
  const anzahlJe = useMemo(() => {
    const z = { wichtig: 0, normal: 0, rauschen: 0, offen: 0 };
    for (const m of filtered) {
      const s = triage[fpOf(m)]?.stufe;
      if (s === 'wichtig') z.wichtig++; else if (s === 'rauschen') z.rauschen++; else z.normal++;
    }
    return z;
  }, [filtered, triage]);

  // Tastatur in der Liste — das Tempo, für das Superhuman Geld nimmt.
  // j/k oder ↑/↓ wandern, e erledigt, a macht eine Aufgabe, s legt schlafen,
  // Enter öffnet, / springt in die Suche.
  useEffect(() => {
    if (zero) return; // im Durchlauf gilt die andere Belegung
    function onKey(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (ev.key === 'Escape') (ev.target as HTMLElement).blur();
        return;
      }
      const k = ev.key.toLowerCase();
      const liste = filtered;
      if (!liste.length) return;
      const idx = sel ? liste.findIndex(m => m.id === sel) : -1;

      if (k === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); setSel(liste[Math.min(liste.length - 1, idx + 1)]?.id ?? liste[0].id); return; }
      if (k === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); setSel(liste[Math.max(0, idx - 1)]?.id ?? liste[0].id); return; }
      if (k === '/') { ev.preventDefault(); (document.querySelector('input[aria-label="Inbox durchsuchen"]') as HTMLInputElement)?.focus(); return; }
      if (k === 'escape') { setSel(null); return; }
      if (idx < 0) return;
      const m = liste[idx];
      // Nach einer Entscheidung auf die nächste Nachricht springen — nie ins Leere.
      const weiter = () => setSel(liste[Math.min(liste.length - 1, idx + 1)]?.id ?? null);
      if (k === 'e') { ev.preventDefault(); setMsgStatus(m.id, 'erledigt'); weiter(); }
      else if (k === 'a') { ev.preventDefault(); toTask(m); weiter(); }
      else if (k === 's') { ev.preventDefault(); setMsgStatus(m.id, 'snoozed', tagIn(1)); weiter(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zero, filtered, sel]);

  const openCount = msgs.filter(m => istOffen(m.id)).length;
  const selMsg = msgs.find(m => m.id === sel) ?? null;

  // ── Segment-Button ──
  const segBtn = (key: 'offen' | 'erledigt' | 'alle', label: string, n?: number) => (
    <button key={key} onClick={() => setSeg(key)} style={{
      fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
      border: `1px solid ${seg === key ? T.lineHot : T.line}`, background: seg === key ? T.accentSoft : 'transparent',
      color: seg === key ? T.accentInk : T.inkDim,
    }}>{label}{typeof n === 'number' ? <span style={{ fontFamily: T.mono, marginLeft: 6, color: seg === key ? T.accent : T.muted }}>{n}</span> : null}</button>
  );

  // ── Zero-Overlay: fokussierter Vollbild-Modus über allem ──
  const zeroAktiv = zero !== null;
  const zeroMail = zeroAktiv && zero!.pos < zero!.queue.length ? msgs.find(m => m.id === zero!.queue[zero!.pos]) ?? null : null;
  const zeroFertig = zeroAktiv && zero!.pos >= zero!.queue.length;
  const rauschenOffen = msgs.filter(m => istOffen(m.id) && triage[fpOf(m)]?.stufe === 'rauschen').length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      {zeroAktiv && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(11,14,16,.92)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="animate-in" style={{ width: 'min(720px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: T.panel, border: `1px solid ${T.lineHot}`, borderRadius: 16, overflow: 'hidden' }}>
            {/* Kopf mit Fortschritt */}
            <div style={{ padding: '13px 18px 11px', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ ...lbl, color: T.accent }}>Zero-Durchlauf</span>
                {!zeroFertig && <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.ink }}>{zero!.pos + 1} von {zero!.queue.length}</span>}
                <button onClick={() => setZero(null)} title="Beenden (Esc)" style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${T.line}`, borderRadius: 7, color: T.muted, cursor: 'pointer', fontSize: 12, width: 26, height: 26, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 3, marginTop: 9 }}>
                {zero!.queue.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < zero!.pos ? T.accent : T.line }} />
                ))}
              </div>
            </div>

            {zeroMail ? (
              <>
                {/* Die EINE Mail */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: T.void, background: srcColor(zeroMail.source), flex: '0 0 auto' }}>{initials(zeroMail.sender)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{zeroMail.sender}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{srcLabel(zeroMail)} · {relTime(zeroMail.receivedAt)}</div>
                    </div>
                    {triage[fpOf(zeroMail)]?.stufe === 'wichtig' && <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: STUFE_META.wichtig.farbe, border: `1px solid ${STUFE_META.wichtig.farbe}44`, borderRadius: 5, padding: '2px 8px', flex: '0 0 auto' }}>WICHTIG</span>}
                  </div>
                  <h2 style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{zeroMail.subject}</h2>
                  {triage[fpOf(zeroMail)]?.zeile && <div style={{ fontSize: 12.5, color: T.accentInk, marginBottom: 10 }}>✨ {triage[fpOf(zeroMail)]!.zeile}</div>}
                  <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {bodyLoading && !body[zeroMail.id] ? 'lade Inhalt …' : (body[zeroMail.id] ?? zeroMail.preview ?? '(keine Vorschau — Entscheidung nach Betreff)')}
                  </div>
                </div>
                {/* Die EINE Entscheidung */}
                <div style={{ padding: '12px 18px 14px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => zeroEntscheid('erledigt')} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 15px', borderRadius: 9, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>✓ Erledigt <span style={{ opacity: .6, fontFamily: T.mono, fontSize: 11 }}>E</span></button>
                  <button onClick={() => zeroEntscheid('aufgabe')} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 9, border: `1px solid ${T.accent}66`, background: 'transparent', color: T.accentInk, cursor: 'pointer' }}>→ Aufgabe <span style={{ opacity: .6, fontFamily: T.mono, fontSize: 11 }}>A</span></button>
                  <button onClick={() => zeroEntscheid('delegiert')} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>Delegieren <span style={{ opacity: .6, fontFamily: T.mono, fontSize: 11 }}>D</span></button>
                  <button onClick={zeroAntworten} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>✍ Antworten</button>
                  <button onClick={() => zeroEntscheid('uebersprungen')} style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, cursor: 'pointer' }}>Überspringen <span style={{ opacity: .6, fontFamily: T.mono, fontSize: 11 }}>S</span></button>
                </div>
              </>
            ) : (
              /* 🎯 Null erreicht */
              <div style={{ padding: '34px 24px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Inbox auf Null.</div>
                <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, marginBottom: 18 }}>
                  {zero!.stats.erledigt} erledigt · {zero!.stats.aufgabe} → Aufgaben · {zero!.stats.delegiert} delegiert{zero!.stats.uebersprungen ? ` · ${zero!.stats.uebersprungen} übersprungen` : ''}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {rauschenOffen > 0 && (
                    <button onClick={() => { rauschenAufraeumen(); setZero(null); }} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.amber}66`, background: `${T.amber}14`, color: T.amber, cursor: 'pointer' }}>
                      Rauschen aufräumen ({rauschenOffen} Newsletter & Co. → erledigt)
                    </button>
                  )}
                  <button onClick={() => setZero(null)} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 9, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>Fertig</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 48px' }}>

        {/* Diese Mail lag schon als Aufgabe im Board — kein zweites Mal anlegen. */}
        {doppelt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: `${T.amber}12`, border: `1px solid ${T.amber}44`, borderRadius: 10, padding: '9px 13px', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: T.amber }}>
              Lag schon als Aufgabe im Board: <b>{doppelt.titel.slice(0, 70)}</b> — Mail als erledigt markiert, keine zweite Aufgabe angelegt.
            </span>
            <Link href="/os/aufgaben" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none', marginLeft: 'auto' }}>zur Aufgabe ›</Link>
            <button onClick={() => setDoppelt(null)} aria-label="Hinweis schließen" style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ─── Der Held (UX 5, 06.09.) ──────────────────────────────────────
            Die eine Frage beim Öffnen: wie viel liegt an — und wie viel davon
            sind wirklich Menschen, die etwas wollen? Alles andere (Zähler je
            Fach, Sync-Stände) tritt darunter zurück. */}
        <Held
          wert={String(openCount)}
          label={openCount === 1 ? 'Nachricht offen' : 'Nachrichten offen'}
          farbe={openCount > 40 ? C.achtung : openCount ? C.ink : C.gut}
          satz={openCount === 0
            ? 'Alles weggearbeitet.'
            : <>Davon <b style={{ color: C.kritisch }}>{anzahlJe.wichtig}</b> wichtig — und <b style={{ color: C.inkDim }}>{anzahlJe.rauschen}</b> Rauschen, das am Stück wegkann.</>}
          neben={[
            { label: 'Apple Mail', wert: sync.apple },
            { label: 'Microsoft 365', wert: sync.ms },
            ...(triageBusy ? [{ label: 'Jarvis', wert: 'stuft ein …', farbe: C.aktiv }] : []),
          ]}
          kinder={
            <div style={{ display: 'flex', gap: A.s, flexWrap: 'wrap' }}>
              <button onClick={zeroStart} disabled={loading || !zeroKandidaten().length} style={{
                fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: `9px ${A.l}px`, minHeight: 36,
                borderRadius: RADIUS.bauteil, border: `1px solid ${C.gut}`, background: C.gut, color: C.grund,
                cursor: loading ? 'default' : 'pointer', opacity: loading || !zeroKandidaten().length ? 0.5 : 1,
              }}>▶ Zero-Durchlauf{zeroKandidaten().length ? ` (${zeroKandidaten().length})` : ''}</button>
              <button onClick={load} disabled={loading} style={{
                fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: `9px ${A.l}px`, minHeight: 36,
                borderRadius: RADIUS.bauteil, border: `1px solid ${C.linie}`, background: 'transparent',
                color: loading ? C.inkLeise : C.inkDim, cursor: loading ? 'default' : 'pointer',
              }}>{loading ? 'synchronisiert …' : '↻ Neu laden'}</button>
            </div>
          }
        />

        {/* ── JETZT DRAN ────────────────────────────────────────────────────
            Unter dem Helden steht, was wirklich zu tun ist. Suche, Fächer und
            Türsteher bleiben darunter — für alle, die suchen statt arbeiten. */}
        {(() => {
          const dran = filtered.filter(m => triage[fpOf(m)]?.stufe === 'wichtig').slice(0, 5);
          if (!dran.length) return null;
          return (
            <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderLeft: `3px solid ${T.accent}`, borderRadius: RADIUS.behaelter, padding: '14px 18px', margin: `${A.m}px 0 ${A.l}px` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, marginBottom: A.s }}>
                <span style={MIKRO}>Jetzt dran</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
                  {dran.length === 1 ? 'eine Nachricht' : `die ersten ${dran.length}`} von {anzahlJe.wichtig}
                </span>
              </div>
              {dran.map(m => {
                const tr = triage[fpOf(m)];
                return (
                  <div key={fpOf(m)} onClick={() => { void openMsg(m); }}
                    style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', cursor: 'pointer', borderTop: `1px solid ${T.lineSoft}` }}>
                    <span style={{ color: T.accent, fontSize: 11, flex: '0 0 auto' }}>●</span>
                    <span style={{ fontSize: 12.5, color: T.inkDim, width: 132, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sender}</span>
                    <span style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                    {tr?.zeile && <span style={{ fontSize: 11.5, color: T.accentInk, flex: '0 0 auto', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✨ {tr.zeile}</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Suche */}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen — Absender, Betreff, Inhalt …" aria-label="Inbox durchsuchen"
          style={{ width: '100%', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '10px 14px', color: T.ink, fontSize: 13, fontFamily: T.sans, outline: 'none', marginBottom: 14 }} />

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {segBtn('offen', 'Offen', openCount)}
          {segBtn('erledigt', 'Erledigt')}
          {segBtn('alle', 'Alle')}
          <span style={{ width: 1, height: 20, background: T.line, margin: '0 4px' }} />
          {['alle', ...accounts].map(a => (
            <button key={a} onClick={() => setSrcFilter(a)} style={{
              fontFamily: T.mono, fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${srcFilter === a ? T.lineHot : T.line}`, background: 'transparent',
              color: srcFilter === a ? T.accentInk : T.muted,
            }}>{a === 'alle' ? 'Alle Quellen' : a}</button>
          ))}
        </div>

        {/* Fächer — nicht eine lange Liste, sondern getrennt nach Art der Nachricht */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <button onClick={() => setFachFilter('alle')} style={{
            fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${fachFilter === 'alle' ? T.lineHot : T.line}`, background: fachFilter === 'alle' ? T.accentSoft : 'transparent',
            color: fachFilter === 'alle' ? T.accentInk : T.inkDim,
          }}>Alles</button>
          {FAECHER.map(f => {
            const n = fachZahlen[f.id] ?? 0;
            const an = fachFilter === f.id;
            return (
              <button key={f.id} onClick={() => setFachFilter(f.id)} title={f.satz} style={{
                fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                border: `1px solid ${an ? f.farbe : T.line}`, background: an ? `${f.farbe}1c` : 'transparent',
                color: an ? f.farbe : n ? T.inkDim : T.muted,
              }}>{f.label}<span style={{ fontFamily: T.mono, fontSize: 11, marginLeft: 6, color: an ? f.farbe : T.muted }}>{n}</span></button>
            );
          })}
          {screener.length > 0 && (
            <button onClick={() => setScreenerAuf(!screenerAuf)} style={{
              marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${screenerAuf ? T.accent : T.amber}55`, background: screenerAuf ? `${T.accent}1c` : `${T.amber}14`, color: screenerAuf ? T.accentInk : T.amber,
            }}>Türsteher · {screener.length} neue Absender {screenerAuf ? '▾' : '▸'}</button>
          )}
        </div>

        {/* Türsteher: je Absender EINE Entscheidung — danach nie wieder gefragt */}
        {screenerAuf && screener.length > 0 && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '13px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={lbl}>Türsteher</span>
              <span style={{ fontSize: 12, color: T.inkDim }}>Wer darf dich erreichen? Einmal entscheiden — Geblockte verschwinden dauerhaft aus dem Postfach.</span>
              <button onClick={() => setScreenerAuf(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 340, overflowY: 'auto' }}>
              {screener.slice(0, 30).map((s, i) => (
                <div key={s.key} style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '9px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                  <span style={{ width: 4, height: 30, borderRadius: 2, background: FACH[s.fach]?.farbe ?? T.line, flex: '0 0 auto' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name} {s.anzahl > 1 && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber }}>· {s.anzahl} Nachrichten</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email ?? '—'} · {s.betreff}
                    </div>
                  </div>
                  <button onClick={() => entscheideAbsender(s.key, 'durchgelassen')}
                    style={{ fontSize: 12, fontWeight: 600, color: T.accentInk, background: `${T.accent}18`, border: `1px solid ${T.accent}55`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', flex: '0 0 auto' }}>Durchlassen</button>
                  <button onClick={() => entscheideAbsender(s.key, 'geblockt')}
                    style={{ fontSize: 12, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', flex: '0 0 auto' }}>Blocken</button>
                </div>
              ))}
              {screener.length > 30 && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, paddingTop: 8 }}>+{screener.length - 30} weitere — die häufigsten zuerst</div>}
            </div>
          </div>
        )}

        {/* Kommando-Zentrale: Meldungen von Jarvis & den Agenten — Eingänge ohne Absender */}
        {seg === 'offen' && (shields.length > 0 || meldungen.length > 0) && (
          <div style={{ ...panel, borderLeft: `3px solid ${shields.some(s => s.stufe === 'rot') ? T.crit : T.accent}`, padding: '11px 16px', marginBottom: 14 }}>
            <div style={{ ...lbl, marginBottom: 7 }}>Zentrale · Meldungen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {shields.map(s => (
                <Link key={s.id} href={s.href} style={{ display: 'flex', gap: 9, alignItems: 'baseline', textDecoration: 'none', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: s.stufe === 'rot' ? T.crit : T.amber, flex: '0 0 auto' }}>●</span>
                  <span style={{ fontSize: 12.5, color: T.ink, flex: 1, minWidth: 200 }}>{s.text}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, flex: '0 0 auto' }}>{s.label} ›</span>
                </Link>
              ))}
              {meldungen.map(l => (
                <Link key={`${l.agent}-${l.ts}`} href={agentHref(l.agent)} style={{ display: 'flex', gap: 9, alignItems: 'baseline', textDecoration: 'none', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: T.accent, flex: '0 0 auto' }}>⚙</span>
                  <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1, minWidth: 200 }}><b style={{ color: T.ink }}>{l.agent}</b> · {l.title}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{relTime(l.ts)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Liste | Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.25fr)', gap: 16, alignItems: 'start' }} className="ibx-grid">
          {/* Liste */}
          <div style={{ ...panel, overflow: 'hidden' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: T.muted, fontSize: 13.5 }}>
                {loading ? 'Lade Nachrichten …' : seg === 'offen' ? 'Alles abgearbeitet. 🎯' : 'Keine Nachrichten in dieser Ansicht.'}
              </div>
            )}
            {(() => {
              let letzteGruppe = '';
              return filtered.map((m, i) => {
                const st = statusOf(m.id); const active = m.id === sel;
                const tr = triage[fpOf(m)] as TriageMap[string] | undefined;
                const gruppe: Stufe | 'neu' = tr?.stufe ?? 'neu';
                const kopf = gruppe !== letzteGruppe;
                letzteGruppe = gruppe;
                const meta = tr ? STUFE_META[tr.stufe] : null;
                // Rauschen bleibt eingeklappt — ein Klick auf den Gruppenkopf öffnet es.
                if (gruppe === 'rauschen' && !rauschenAuf) {
                  if (!kopf) return null;
                  return (
                    <div key="rauschen-zu" onClick={() => setRauschenAuf(true)} style={{ padding: '10px 15px', cursor: 'pointer', borderTop: `1px solid ${T.lineSoft}`, fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>
                      ▸ Rauschen · {anzahlJe.rauschen} — Newsletter & Co., ausgeblendet
                    </div>
                  );
                }
                return (
                  <div key={m.id}>
                    {kopf && (
                      <div onClick={gruppe === 'rauschen' ? () => setRauschenAuf(false) : undefined}
                        style={{ padding: '9px 15px 4px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: meta?.farbe ?? T.muted, cursor: gruppe === 'rauschen' ? 'pointer' : 'default' }}>
                        {gruppe === 'neu' ? (triageBusy ? '◌ Jarvis stuft ein …' : 'Ohne Einstufung') : `${gruppe === 'rauschen' ? '▾ ' : ''}${meta!.label} · ${gruppe === 'wichtig' ? anzahlJe.wichtig : gruppe === 'normal' ? anzahlJe.normal : anzahlJe.rauschen}`}
                      </div>
                    )}
                    <div onClick={() => openMsg(m)} style={{
                      display: 'flex', gap: 12, padding: '11px 15px', cursor: 'pointer',
                      borderTop: kopf ? 0 : `1px solid ${T.lineSoft}`,
                      background: active ? T.panel2 : 'transparent',
                      boxShadow: active ? `inset 2px 0 0 ${T.accent}` : 'none',
                      opacity: gruppe === 'rauschen' ? 0.65 : 1,
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, color: T.void, background: srcColor(m.source) }}>{initials(m.sender)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          {!m.isRead && OPEN.has(st) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, flex: '0 0 auto' }} />}
                          {tr?.stufe === 'wichtig' && <span style={{ color: STUFE_META.wichtig.farbe, fontSize: 11, flex: '0 0 auto' }}>●</span>}
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sender}</span>
                          <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{relTime(m.receivedAt)}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</div>
                        {tr?.zeile && <div style={{ fontSize: 11.5, color: tr.stufe === 'wichtig' ? T.accentInk : T.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✨ {tr.zeile}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
                          {istWiedervorlage(m.id) && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px' }}>⏰ WIEDERVORLAGE</span>}
                          <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: srcColor(m.source), border: `1px solid ${srcColor(m.source)}44`, borderRadius: 5, padding: '1px 6px' }}>{srcLabel(m)}</span>
                          {tr?.grund && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{tr.grund}</span>}
                          {DONE.has(st) && <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: T.muted }}>{st === 'aufgabe' ? '→ Aufgabe' : st === 'delegiert' ? 'delegiert' : 'erledigt ✓'}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Detail */}
          <div style={{ ...panel, padding: selMsg ? '22px 24px' : '40px 24px', minHeight: 320 }}>
            {!selMsg ? (
              <div style={{ color: T.muted, fontSize: 13.5, textAlign: 'center', paddingTop: 40 }}>Wähle links eine Nachricht, um sie zu lesen und zu triagieren.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: srcColor(selMsg.source), border: `1px solid ${srcColor(selMsg.source)}44`, borderRadius: 5, padding: '2px 7px' }}>{srcLabel(selMsg)}</span>
                  {selMsg.importance === 'high' && <span style={{ fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', color: T.crit, border: `1px solid ${T.crit}44`, borderRadius: 5, padding: '2px 7px' }}>wichtig</span>}
                  <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.muted }}>{new Date(selMsg.receivedAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 12 }}>{selMsg.subject}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 16, borderBottom: `1px solid ${T.line}`, marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: T.void, background: srcColor(selMsg.source) }}>{initials(selMsg.sender)}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{selMsg.sender}</div>
                    {selMsg.senderEmail && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{selMsg.senderEmail}</div>}
                  </div>
                </div>

                {/* Body */}
                <div style={{ fontSize: 13.5, lineHeight: 1.62, color: T.inkDim, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', marginBottom: 18 }}>
                  {selMsg.source === 'ms'
                    ? (selMsg.preview || '(keine Vorschau im Snapshot — Volltext kommt mit Microsoft-Live)')
                    : bodyLoading && !body[selMsg.id] ? 'Lade Nachrichtentext aus Apple Mail …'
                    : (body[selMsg.id] || 'Öffne die Nachricht, um den Text zu laden …')}
                </div>

                {/* Triage */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
                  {OPEN.has(statusOf(selMsg.id)) ? (
                    <>
                      <button onClick={() => setMsgStatus(selMsg.id, 'erledigt')} style={btnPri}>✓ Erledigt</button>
                      <button onClick={() => toTask(selMsg)} style={btn}>→ Aufgabe</button>
                      <button onClick={() => setMsgStatus(selMsg.id, 'delegiert')} style={btn}>Delegieren</button>
                      <button onClick={() => setMsgStatus(selMsg.id, 'snoozed', tagIn(1))} style={btn} title="taucht morgen als Wiedervorlage auf">⏰ Morgen</button>
                      <button onClick={() => setMsgStatus(selMsg.id, 'snoozed', tagIn(3))} style={btn} title="taucht in 3 Tagen wieder auf">⏰ +3 Tage</button>
                      <button onClick={() => setMsgStatus(selMsg.id, 'snoozed', naechsterMontag())} style={btn} title="taucht am Montag wieder auf">⏰ Montag</button>
                    </>
                  ) : (
                    <button onClick={() => setMsgStatus(selMsg.id, 'offen')} style={btn}>↩ Wieder öffnen</button>
                  )}
                </div>

                {/* Antwort-Entwurf · Inbox-Agent */}
                <div style={{ marginTop: 16, borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
                  {!draftText && !draftBusy && (
                    <button onClick={() => makeDraft(selMsg)} style={{ ...btn, border: `1px solid ${T.lineHot}`, background: T.accentSoft, color: T.accentInk, fontWeight: 600 }}>✍ Antwort entwerfen (MAKE)</button>
                  )}
                  {draftBusy && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>MAKE schreibt einen Entwurf in deiner Stimme …</div>}
                  {draftText && (
                    <div>
                      <div style={{ ...lbl, marginBottom: 8 }}><span style={{ color: T.accent }}>MAKE</span> · Antwort-Entwurf (editierbar)</div>
                      <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={8} aria-label="Antwort-Entwurf"
                        style={{ width: '100%', background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '12px 14px', color: T.ink, fontSize: 13.5, fontFamily: T.sans, resize: 'vertical', lineHeight: 1.55, outline: 'none' }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                        <button onClick={() => openInMail(selMsg)} style={btnPri}>In Apple Mail öffnen →</button>
                        <button onClick={() => makeDraft(selMsg)} style={btn}>↻ Neu entwerfen</button>
                        <button onClick={() => { navigator.clipboard?.writeText(draftText); setDraftInfo('kopiert.'); }} style={btn}>Kopieren</button>
                        {draftInfo && <span style={{ fontFamily: T.mono, fontSize: 11, color: (draftInfo.startsWith('✓') || draftInfo === 'kopiert.') ? T.accent : T.muted }}>{draftInfo}</span>}
                      </div>
                      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>Versand machst du selbst in Mail — MAKE sendet nie ungefragt.</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`@media (max-width:820px){ .ibx-grid{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

const btn: React.CSSProperties = { fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, cursor: 'pointer' };
const btnPri: React.CSSProperties = { ...btn, border: `1px solid ${T.accent}`, background: T.accent, color: T.void };

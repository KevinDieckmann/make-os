'use client';

// ─── MAKE OS — Inbox · volle Ansicht ────────────────────────────────────────
// Fächer (Split Inbox), Türsteher (Screener) für unbekannte Absender, Zero-
// Durchlauf mit den Tasten E/A/D/S, Jarvis-Triage, Antwort-Entwurf → Apple
// Mail, Snooze, „→ Aufgabe" mit Duplikat-Wache, Suche, Konten-Filter und die
// Tasten j/k/e/a/s in der Liste. Die schlanke Schwester liegt unter /os/inbox.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile aus schlank,
// Farben aus design.ts) — gleiche Funktion, neue Darstellung.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';
import { FAECHER, FACH, fachVon, absenderKey } from '@/lib/make-one/inbox-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Fortschritt, Segmente, Punkt, feld, LEUCHT } from './schlank';

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
type Segment = 'offen' | 'erledigt' | 'alle';

const OPEN = new Set(['offen', 'snoozed', '']);
const DONE = new Set(['erledigt', 'aufgabe', 'delegiert']);
const HAAR = 'rgba(255,255,255,.06)';

const tagIn = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const naechsterMontag = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return localDay(d); };

// Stabiler Fingerabdruck je Mail — Apple-IDs sind index-basiert und verschieben
// sich, sobald neue Post kommt. Der fp bleibt gleich → Triage-Cache hält.
const fpOf = (m: { sender: string; senderEmail?: string; subject: string; receivedAt: string }) =>
  `${(m.senderEmail ?? m.sender).toLowerCase().trim()}|${m.subject.toLowerCase().trim().slice(0, 80)}|${m.receivedAt.slice(0, 16)}`;

// Farben wie in der schlanken Schwester: wichtig grün, normal blau, Rauschen leise.
const STUFE_META: Record<Stufe, { label: string; farbe: string; rang: number }> = {
  wichtig: { label: 'Wichtig', farbe: LEUCHT.gut, rang: 0 },
  normal: { label: 'Normal', farbe: LEUCHT.puls, rang: 1 },
  rauschen: { label: 'Rauschen', farbe: C.inkLeise, rang: 3 },
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
/** Quellfarbe: Apple Mail türkis, Microsoft 365 orange. */
const srcColor = (s: Source) => (s === 'apple' ? LEUCHT.geld : LEUCHT.business);
const srcLabel = (m: Msg) => (m.source === 'apple' ? m.account : 'M365 · KEMARIS');

const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark' };
const textKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 };
const verweis: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none', whiteSpace: 'nowrap' };

/** Kürzel-Taste am Knopf — das einzige Monospace der Seite. */
const Taste = ({ k }: { k: string }) => (
  <span style={{ fontFamily: SCHRIFT.mono, fontSize: 11, fontWeight: 700, marginLeft: 7, padding: '1px 6px', borderRadius: 6, background: 'rgba(127,127,127,.28)' }}>{k}</span>
);

/** Absender-Kürzel in Quellfarbe; ungelesen leuchtet. */
const Avatar = ({ m, glanz }: { m: Msg; glanz?: boolean }) => {
  const f = srcColor(m.source);
  return (
    <span style={{ width: 32, height: 32, borderRadius: 10, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: f, background: `${f}22`, boxShadow: glanz ? `0 0 12px ${f}55` : undefined }}>
      {initials(m.sender)}
    </span>
  );
};

export function InboxView() {
  const { state, dispatch } = useTasks();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [sel, setSel] = useState<string | null>(null);
  const [seg, setSeg] = useState<Segment>('offen');
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
  const selTriage = selMsg ? triage[fpOf(selMsg)] : undefined;

  // ── Zero-Overlay: fokussierter Vollbild-Modus über allem ──
  const zeroAktiv = zero !== null;
  const zeroMail = zeroAktiv && zero!.pos < zero!.queue.length ? msgs.find(m => m.id === zero!.queue[zero!.pos]) ?? null : null;
  const zeroFertig = zeroAktiv && zero!.pos >= zero!.queue.length;
  const rauschenOffen = msgs.filter(m => istOffen(m.id) && triage[fpOf(m)]?.stufe === 'rauschen').length;
  const zeroN = zeroKandidaten().length;

  // ── Was die Seite zeigt ──
  const dran = filtered.filter(m => triage[fpOf(m)]?.stufe === 'wichtig').slice(0, 5);
  const SEG: { id: Segment; label: string }[] = [
    { id: 'offen', label: openCount ? `Offen · ${openCount}` : 'Offen' },
    { id: 'erledigt', label: 'Erledigt' },
    { id: 'alle', label: 'Alle' },
  ];
  const FACH_SEG: { id: string; label: string }[] = [
    { id: 'alle', label: 'Alles' },
    ...FAECHER.map(f => { const n = fachZahlen[f.id] ?? 0; return { id: f.id, label: n ? `${f.label} · ${n}` : f.label }; }),
  ];
  const rotMeldung = shields.some(s => s.stufe === 'rot');
  const kopfFarbe = openCount > 40 ? LEUCHT.achtung : openCount ? C.ink : LEUCHT.gut;
  let karte = 0; // laufender Index — die Karten erscheinen gestaffelt

  /** Eine Nachricht in der Liste: Kürzel, Absender · Betreff, Jarvis-Zeile, Zeit + Pillen. */
  const mailZeile = (m: Msg) => {
    const st = statusOf(m.id);
    const tr = triage[fpOf(m)];
    const ungelesen = !m.isRead && OPEN.has(st);
    return (
      <Zeile key={m.id} onClick={() => { void openMsg(m); }} aktiv={m.id === sel}
        links={<Avatar m={m} glanz={ungelesen} />}
        titel={<><span style={{ fontWeight: ungelesen ? 700 : 500 }}>{m.sender}</span><span style={{ color: C.inkLeise, fontWeight: 400 }}> · {m.subject}</span></>}
        unter={[tr?.zeile ? `✨ ${tr.zeile}` : m.preview, tr?.grund, srcLabel(m)].filter(Boolean).join(' · ')}
        rechts={<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: '0 0 auto' }}>
          <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{relTime(m.receivedAt)}</span>
          {istWiedervorlage(m.id) && <Chip farbe={LEUCHT.achtung}>⏰ Wiedervorlage</Chip>}
          {DONE.has(st) && <Chip farbe={C.inkLeise}>{st === 'aufgabe' ? '→ Aufgabe' : st === 'delegiert' ? 'delegiert' : 'erledigt ✓'}</Chip>}
        </span>} />
    );
  };

  /** Die Liste mit Gruppenköpfen (Wichtig → Normal → Rauschen); Rauschen bleibt eingeklappt. */
  const listenInhalt = () => {
    let letzteGruppe = '';
    const raus: ReactNode[] = [];
    filtered.forEach((m, i) => {
      // Der Cast, weil Record-Zugriffe nie „undefined" liefern — ohne ihn hält TS „neu" für unerreichbar.
      const tr = triage[fpOf(m)] as TriageMap[string] | undefined;
      const gruppe: Stufe | 'neu' = tr?.stufe ?? 'neu';
      const kopf = gruppe !== letzteGruppe;
      letzteGruppe = gruppe;
      if (kopf) {
        const meta = gruppe === 'neu' ? null : STUFE_META[gruppe];
        raus.push(
          <div key={`kopf-${gruppe}-${i}`} style={{ marginTop: raus.length ? 18 : 0 }}>
            <Ueberschrift
              farbe={meta ? meta.farbe : triageBusy ? LEUCHT.agenten : C.inkLeise}
              rechts={gruppe === 'neu' ? undefined : gruppe === 'rauschen'
                ? <button onClick={() => setRauschenAuf(a => !a)} style={textKnopf}>{rauschenAuf ? 'einklappen' : `${anzahlJe.rauschen} anzeigen`}</button>
                : `${gruppe === 'wichtig' ? anzahlJe.wichtig : anzahlJe.normal}`}>
              {gruppe === 'neu' ? (triageBusy ? 'Jarvis stuft ein …' : 'Ohne Einstufung') : meta!.label}
            </Ueberschrift>
          </div>,
        );
      }
      // Rauschen bleibt eingeklappt — der Knopf am Gruppenkopf öffnet es.
      if (gruppe === 'rauschen' && !rauschenAuf) {
        if (kopf) raus.push(<Leer key="rauschen-zu">Newsletter & Co. — {anzahlJe.rauschen} Nachrichten, ausgeblendet.</Leer>);
        return;
      }
      raus.push(mailZeile(m));
    });
    return raus;
  };

  return (
    <>
      {zeroAktiv && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(11,14,16,.92)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: SCHRIFT.text, color: C.ink }}>
          <Karte akzent={LEUCHT.gut} style={{ width: 'min(720px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Kopf mit Fortschritt */}
            <Ueberschrift farbe={LEUCHT.gut} rechts={<>
              {!zeroFertig && <span style={{ color: C.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{zero!.pos + 1} von {zero!.queue.length}</span>}
              <button onClick={() => setZero(null)} title="Beenden (Esc)" aria-label="Beenden" style={textKnopf}>✕</button>
            </>}>Zero-Durchlauf</Ueberschrift>
            <Fortschritt anteil={zero!.queue.length ? zero!.pos / zero!.queue.length : 0} farbe={LEUCHT.gut} />

            {zeroMail ? (
              <>
                {/* Die EINE Mail */}
                <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
                    <Avatar m={zeroMail} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: TYP.body, fontWeight: 700 }}>{zeroMail.sender}</div>
                      <div style={{ fontSize: 12, color: C.inkLeise }}>{srcLabel(zeroMail)} · {relTime(zeroMail.receivedAt)}</div>
                    </div>
                    {triage[fpOf(zeroMail)]?.stufe === 'wichtig' && <Chip farbe={LEUCHT.gut}>Wichtig</Chip>}
                  </div>
                  <h2 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-.015em', margin: '0 0 6px' }}>{zeroMail.subject}</h2>
                  {triage[fpOf(zeroMail)]?.zeile && <div style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 500, marginBottom: 10 }}>✨ {triage[fpOf(zeroMail)]!.zeile}</div>}
                  <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {bodyLoading && !body[zeroMail.id] ? 'lade Inhalt …' : (body[zeroMail.id] ?? zeroMail.preview ?? '(keine Vorschau — Entscheidung nach Betreff)')}
                  </div>
                </div>
                {/* Die EINE Entscheidung */}
                <div style={{ paddingTop: 14, borderTop: `1px solid ${HAAR}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Knopf farbe={LEUCHT.gut} onClick={() => zeroEntscheid('erledigt')}>✓ Erledigt<Taste k="E" /></Knopf>
                  <Knopf leise onClick={() => zeroEntscheid('aufgabe')}>→ Aufgabe<Taste k="A" /></Knopf>
                  <Knopf leise onClick={() => zeroEntscheid('delegiert')}>Delegieren<Taste k="D" /></Knopf>
                  <Knopf leise onClick={zeroAntworten}>✍ Antworten</Knopf>
                  <span style={{ marginLeft: 'auto' }}><Knopf leise onClick={() => zeroEntscheid('uebersprungen')}>Überspringen<Taste k="S" /></Knopf></span>
                </div>
              </>
            ) : (
              /* 🎯 Null erreicht */
              <div style={{ padding: '30px 8px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, marginBottom: 8 }}>Inbox auf Null.</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 18 }}>
                  {zero!.stats.erledigt} erledigt · {zero!.stats.aufgabe} → Aufgaben · {zero!.stats.delegiert} delegiert{zero!.stats.uebersprungen ? ` · ${zero!.stats.uebersprungen} übersprungen` : ''}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {rauschenOffen > 0 && (
                    <Knopf farbe={LEUCHT.achtung} onClick={() => { rauschenAufraeumen(); setZero(null); }}>
                      Rauschen aufräumen ({rauschenOffen} Newsletter & Co. → erledigt)
                    </Knopf>
                  )}
                  <Knopf farbe={LEUCHT.gut} onClick={() => setZero(null)}>Fertig</Knopf>
                </div>
              </div>
            )}
          </Karte>
        </div>
      )}

      <Seite titel="Inbox · voll" breit={1200}
        unter={<>Apple Mail {sync.apple} · Microsoft 365 {sync.ms}{triageBusy && <span style={{ color: LEUCHT.agenten }}> · Jarvis stuft ein …</span>}</>}
        rechts={<span style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmente liste={SEG} aktiv={seg} onWahl={setSeg} />
          <Link href="/os/inbox" style={verweis}>Schlanke Inbox ›</Link>
        </span>}>

        {/* Diese Mail lag schon als Aufgabe im Board — kein zweites Mal anlegen. */}
        {doppelt && (
          <Karte i={karte++} akzent={LEUCHT.achtung}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, flex: '1 1 260px' }}>
                Lag schon als Aufgabe im Board: <b>{doppelt.titel.slice(0, 70)}</b> — Mail als erledigt markiert, keine zweite Aufgabe angelegt.
              </span>
              <Link href="/os/aufgaben" style={verweis}>zur Aufgabe ›</Link>
              <button onClick={() => setDoppelt(null)} aria-label="Hinweis schließen" style={textKnopf}>✕</button>
            </div>
          </Karte>
        )}

        {/* ─── Der Kopf: wie viel liegt an — und wie viel davon sind Menschen, die etwas wollen? */}
        <Karte i={karte++} akzent={openCount > 40 ? LEUCHT.achtung : !openCount && !loading ? LEUCHT.gut : undefined}>
          <div style={{ display: 'flex', gap: 'clamp(18px,4vw,36px)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Zahl gross wert={openCount ? String(openCount) : undefined} label={openCount === 1 ? 'Nachricht offen' : 'Nachrichten offen'} farbe={kopfFarbe} />
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <p style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', margin: 0, lineHeight: 1.35 }}>
                {loading && !msgs.length ? 'Postfächer werden geladen …' : openCount === 0
                  ? 'Alles weggearbeitet.'
                  : <>Davon <b style={{ color: LEUCHT.gut }}>{anzahlJe.wichtig}</b> wichtig — und <b style={{ color: C.inkDim }}>{anzahlJe.rauschen}</b> Rauschen, das am Stück wegkann.</>}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 14, marginTop: 14 }}>
                <Zahl wert={anzahlJe.wichtig ? String(anzahlJe.wichtig) : undefined} label="wichtig" farbe={LEUCHT.gut} />
                <Zahl wert={anzahlJe.normal ? String(anzahlJe.normal) : undefined} label="normal" farbe={LEUCHT.puls} />
                <Zahl wert={anzahlJe.rauschen ? String(anzahlJe.rauschen) : undefined} label="Rauschen" farbe={C.inkDim} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <Knopf farbe={LEUCHT.gut} onClick={zeroStart} aus={loading || !zeroN}>▶ Zero-Durchlauf{zeroN ? ` (${zeroN})` : ''}</Knopf>
                <Knopf leise onClick={load} aus={loading}>{loading ? 'synchronisiert …' : '↻ Neu laden'}</Knopf>
              </div>
            </div>
          </div>
        </Karte>

        {/* ── JETZT DRAN: unter dem Kopf steht, was wirklich zu tun ist. */}
        {dran.length > 0 && (
          <Karte i={karte++} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut} rechts={`${dran.length === 1 ? 'eine Nachricht' : `die ersten ${dran.length}`} von ${anzahlJe.wichtig}`}>Jetzt dran</Ueberschrift>
            <Liste>
              {dran.map(m => (
                <Zeile key={fpOf(m)} onClick={() => { void openMsg(m); }} aktiv={m.id === sel}
                  links={<Punkt farbe={LEUCHT.gut} />}
                  titel={<><span style={{ fontWeight: 600 }}>{m.sender}</span><span style={{ color: C.inkLeise, fontWeight: 400 }}> · {m.subject}</span></>}
                  unter={triage[fpOf(m)]?.zeile ? `✨ ${triage[fpOf(m)]!.zeile}` : undefined}
                  rechts={<span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{relTime(m.receivedAt)}</span>} />
              ))}
            </Liste>
          </Karte>
        )}

        {/* Suche · Konten · Fächer · Türsteher — für alle, die suchen statt arbeiten */}
        <Karte i={karte++}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen — Absender, Betreff, Inhalt …" aria-label="Inbox durchsuchen" style={{ ...feld, flex: '1 1 240px', width: 'auto' }} />
            <select value={srcFilter} onChange={e => setSrcFilter(e.target.value)} aria-label="Konto" style={wahl}>
              <option value="alle">Alle Quellen</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {/* Fächer — nicht eine lange Liste, sondern getrennt nach Art der Nachricht */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
              <Segmente liste={FACH_SEG} aktiv={fachFilter} onWahl={setFachFilter} />
            </div>
            {screener.length > 0 && (
              <span style={{ marginLeft: 'auto' }}>
                {screenerAuf
                  ? <Knopf leise onClick={() => setScreenerAuf(false)}>Türsteher · {screener.length} neue Absender ▾</Knopf>
                  : <Knopf farbe={LEUCHT.achtung} onClick={() => setScreenerAuf(true)}>Türsteher · {screener.length} neue Absender ▸</Knopf>}
              </span>
            )}
          </div>
          {fachFilter !== 'alle' && FACH[fachFilter] && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>{FACH[fachFilter].satz}</div>}
        </Karte>

        {/* Türsteher: je Absender EINE Entscheidung — danach nie wieder gefragt */}
        {screenerAuf && screener.length > 0 && (
          <Karte i={karte++} akzent={LEUCHT.achtung}>
            <Ueberschrift farbe={LEUCHT.achtung} rechts={<button onClick={() => setScreenerAuf(false)} aria-label="Türsteher schließen" style={textKnopf}>✕</button>}>Türsteher</Ueberschrift>
            <Leer>Wer darf dich erreichen? Einmal entscheiden — Geblockte verschwinden dauerhaft aus dem Postfach.</Leer>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <Liste>
                {screener.slice(0, 30).map(s => (
                  <Zeile key={s.key}
                    links={<Punkt farbe={FACH[s.fach]?.farbe ?? C.inkLeise} />}
                    titel={<>{s.name}{s.anzahl > 1 && <span style={{ color: LEUCHT.achtung, fontWeight: 400 }}> · {s.anzahl} Nachrichten</span>}</>}
                    unter={`${s.email ?? '—'} · ${s.betreff}`}
                    rechts={<span style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '0 0 auto' }}>
                      <Knopf leise onClick={() => entscheideAbsender(s.key, 'durchgelassen')}>Durchlassen</Knopf>
                      <button onClick={() => entscheideAbsender(s.key, 'geblockt')} style={textKnopf}>Blocken</button>
                    </span>} />
                ))}
              </Liste>
              {screener.length > 30 && <Leer>+{screener.length - 30} weitere — die häufigsten zuerst</Leer>}
            </div>
          </Karte>
        )}

        {/* Kommando-Zentrale: Meldungen von Jarvis & den Agenten — Eingänge ohne Absender */}
        {seg === 'offen' && (shields.length > 0 || meldungen.length > 0) && (
          <Karte i={karte++} akzent={rotMeldung ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={rotMeldung ? LEUCHT.kritisch : LEUCHT.agenten}>Zentrale · Meldungen</Ueberschrift>
            <Liste>
              {shields.map(s => (
                <Link key={s.id} href={s.href} className="zeile zeile-klick fassbar" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '11px 6px', margin: '0 -6px', minHeight: 50, borderBottom: `1px solid ${HAAR}`, borderRadius: 10, textDecoration: 'none', color: C.ink }}>
                  <Punkt farbe={s.stufe === 'rot' ? LEUCHT.kritisch : LEUCHT.achtung} />
                  <span style={{ fontSize: TYP.body, fontWeight: 500, flex: 1, minWidth: 0 }}>{s.text}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{s.label} ›</span>
                </Link>
              ))}
              {meldungen.map(l => (
                <Link key={`${l.agent}-${l.ts}`} href={agentHref(l.agent)} className="zeile zeile-klick fassbar" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '11px 6px', margin: '0 -6px', minHeight: 50, borderBottom: `1px solid ${HAAR}`, borderRadius: 10, textDecoration: 'none', color: C.ink }}>
                  <Punkt farbe={LEUCHT.agenten} />
                  <span style={{ fontSize: TYP.body, fontWeight: 500, flex: 1, minWidth: 0, color: C.inkDim }}><b style={{ color: C.ink }}>{l.agent}</b> · {l.title}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{relTime(l.ts)}</span>
                </Link>
              ))}
            </Liste>
          </Karte>
        )}

        {/* Liste | Nachricht — zwei Karten nebeneinander, auf dem Handy untereinander */}
        <div className="ibx-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr)', gap: 14, alignItems: 'start' }}>
          <Karte i={karte++}>
            <Ueberschrift rechts={filtered.length ? `${filtered.length}` : undefined}>Nachrichten</Ueberschrift>
            {filtered.length === 0
              ? <Leer>{loading ? 'Lade Nachrichten …' : seg === 'offen' ? 'Alles abgearbeitet. 🎯' : 'Keine Nachrichten in dieser Ansicht.'}</Leer>
              : <Liste>{listenInhalt()}</Liste>}
          </Karte>

          <Karte i={karte++} akzent={selTriage?.stufe === 'wichtig' ? LEUCHT.gut : undefined} style={{ minHeight: 320 }}>
            {!selMsg ? (
              <>
                <Ueberschrift>Nachricht</Ueberschrift>
                <Leer>Wähle links eine Nachricht, um sie zu lesen und zu triagieren. Tasten: j/k wandern · e erledigt · a Aufgabe · s morgen · / suchen.</Leer>
              </>
            ) : (
              <>
                <Ueberschrift farbe={srcColor(selMsg.source)} rechts={new Date(selMsg.receivedAt).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}>{srcLabel(selMsg)}</Ueberschrift>
                <h2 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.3, margin: '0 0 12px' }}>{selMsg.subject}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', paddingBottom: 14, borderBottom: `1px solid ${HAAR}`, marginBottom: 14 }}>
                  <Avatar m={selMsg} />
                  <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                    <div style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{selMsg.sender}</div>
                    {selMsg.senderEmail && <div style={{ fontSize: 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selMsg.senderEmail}</div>}
                  </div>
                  {selTriage && <Chip farbe={STUFE_META[selTriage.stufe].farbe}>{STUFE_META[selTriage.stufe].label}</Chip>}
                  {selMsg.importance === 'high' && <Chip farbe={LEUCHT.kritisch}>wichtig</Chip>}
                  {istWiedervorlage(selMsg.id) && <Chip farbe={LEUCHT.achtung}>⏰ Wiedervorlage</Chip>}
                </div>
                {selTriage?.zeile && (
                  <div style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 500, marginBottom: 12 }}>
                    ✨ {selTriage.zeile}{selTriage.grund && <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {selTriage.grund}</span>}
                  </div>
                )}

                {/* Body */}
                <div style={{ fontSize: TYP.bedien, lineHeight: 1.62, color: C.inkDim, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                  {selMsg.source === 'ms'
                    ? (selMsg.preview || '(keine Vorschau im Snapshot — Volltext kommt mit Microsoft-Live)')
                    : bodyLoading && !body[selMsg.id] ? 'Lade Nachrichtentext aus Apple Mail …'
                    : (body[selMsg.id] || 'Öffne die Nachricht, um den Text zu laden …')}
                </div>

                {/* Triage */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${HAAR}` }}>
                  {OPEN.has(statusOf(selMsg.id)) ? (
                    <>
                      <Knopf farbe={LEUCHT.gut} onClick={() => setMsgStatus(selMsg.id, 'erledigt')}>✓ Erledigt</Knopf>
                      <Knopf leise onClick={() => toTask(selMsg)}>→ Aufgabe</Knopf>
                      <Knopf leise onClick={() => setMsgStatus(selMsg.id, 'delegiert')}>Delegieren</Knopf>
                      <span title="taucht morgen als Wiedervorlage auf"><Knopf leise onClick={() => setMsgStatus(selMsg.id, 'snoozed', tagIn(1))}>⏰ Morgen</Knopf></span>
                      <span title="taucht in 3 Tagen wieder auf"><Knopf leise onClick={() => setMsgStatus(selMsg.id, 'snoozed', tagIn(3))}>⏰ +3 Tage</Knopf></span>
                      <span title="taucht am Montag wieder auf"><Knopf leise onClick={() => setMsgStatus(selMsg.id, 'snoozed', naechsterMontag())}>⏰ Montag</Knopf></span>
                    </>
                  ) : (
                    <Knopf leise onClick={() => setMsgStatus(selMsg.id, 'offen')}>↩ Wieder öffnen</Knopf>
                  )}
                </div>

                {/* Antwort-Entwurf · Inbox-Agent */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${HAAR}` }}>
                  <Ueberschrift farbe={LEUCHT.agenten}>MAKE · Antwort-Entwurf{draftText ? ' (editierbar)' : ''}</Ueberschrift>
                  {!draftText && !draftBusy && (
                    <Knopf leise onClick={() => makeDraft(selMsg)}>✍ Antwort entwerfen (MAKE)</Knopf>
                  )}
                  {draftBusy && <Leer>MAKE schreibt einen Entwurf in deiner Stimme …</Leer>}
                  {draftText && (
                    <div>
                      <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={8} aria-label="Antwort-Entwurf"
                        style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical', lineHeight: 1.55 }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                        <Knopf onClick={() => openInMail(selMsg)}>In Apple Mail öffnen →</Knopf>
                        <Knopf leise onClick={() => makeDraft(selMsg)}>↻ Neu entwerfen</Knopf>
                        <Knopf leise onClick={() => { navigator.clipboard?.writeText(draftText); setDraftInfo('kopiert.'); }}>Kopieren</Knopf>
                        {draftInfo && <span style={{ fontSize: 12, color: (draftInfo.startsWith('✓') || draftInfo === 'kopiert.') ? LEUCHT.gut : C.inkLeise }}>{draftInfo}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Versand machst du selbst in Mail — MAKE sendet nie ungefragt.</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Karte>
        </div>

        <style>{`@media (max-width:820px){ .ibx-grid{grid-template-columns:1fr !important} }`}</style>
      </Seite>
    </>
  );
}

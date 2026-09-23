'use client';

import Link from 'next/link';
// Eine Seite je MSI-Säule: oben der gerechnete Wert mit seiner Herleitung,
// darunter Werkzeuge, die genau diesen Bereich bewegen. Kein Abladeplatz für
// Links — jede Säule bekommt etwas, das man hier wirklich tut.

import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import type { PerfIndex, Saeule } from '@/lib/performance';
import { TEAM, RITUALE } from '@/lib/make-one/team-data';
import { eur, type FinanceState } from '@/lib/make-one/finance-data';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';

export const SAEULEN_META: Record<string, { titel: string; claim: string; hin: string }> = {
  health: { titel: 'Gesundheit & Energie', claim: 'Der Körper trägt alles andere.', hin: 'Recovery, Schlaf, Routinen, Journal' },
  business: { titel: 'Business-Performance', claim: 'Der Weg auf 1 Mio.', hin: 'Umsatz-Kurs und Pipeline' },
  planning: { titel: 'Planung & Execution', claim: 'Ob aus Vorhaben Erledigtes wird.', hin: 'Aufgabenlage und Fluss' },
  finance: { titel: 'Finanzen', claim: 'Wie lange du durchhältst.', hin: 'Runway, Gewinn, Marge' },
  social: { titel: 'Beziehung & Team', claim: 'Wer mitträgt — und wer zu kurz kommt.', hin: 'Rituale, Delegation, Stimmung' },
  agents: { titel: 'Agenten', claim: 'Was Jarvis und die Agenten dir abnehmen.', hin: 'Läufe, Aufträge, Stapel, Bote' },
};

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const col = (v: number | null) => (v == null ? T.muted : v >= 70 ? T.accent : v >= 45 ? T.amber : T.crit);
import { localDay } from '@/lib/zeit';
import { Seitenkopf } from './Seitenkopf';
const tage = (n: number, bis = new Date()) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - (n - 1 - i));
    return localDay(d);
  });

// ───────────────────────── Gesundheit ─────────────────────────
function WerkzeugGesundheit() {
  const [vit, setVit] = useState<Record<string, { rec?: number; sleep?: number }>>({});
  const [log, setLog] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetch('/api/state/vitals')
      .then(r => r.json())
      .then(d => setVit(d.log ?? {}))
      .catch(() => {});
    fetch('/api/state/health')
      .then(r => r.json())
      .then(d => setLog(d.log ?? {}))
      .catch(() => {});
  }, []);
  const t14 = tage(14);
  const werte = t14.map(d => ({ d, rec: vit[d]?.rec, sleep: vit[d]?.sleep, routinen: log[d]?.length ?? 0 }));
  const hatWerte = werte.some(w => w.rec != null);
  const streak = (() => {
    let s = 0;
    for (let i = t14.length - 1; i >= 0; i--) {
      if ((log[t14[i]]?.length ?? 0) >= 4) s++;
      else break;
    }
    return s;
  })();

  return (
    <>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <div style={lbl}>Recovery & Schlaf · 14 Tage</div>
          <Link href="/os/gesundheit" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>
            Morgen-Check ›
          </Link>
        </div>
        {!hatWerte ? (
          <div style={{ fontSize: 13, color: T.inkDim, marginTop: 10, lineHeight: 1.5 }}>
            Noch keine eingetragenen Werte. Jeder Morgen-Check setzt hier einen Punkt — nach ein paar Tagen siehst du, ob Schlaf und Erholung zusammenhängen.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 78, marginTop: 12 }}>
            {werte.map(w => (
              <div
                key={w.d}
                title={`${w.d}: Recovery ${w.rec ?? '—'}, Schlaf ${w.sleep ?? '—'}h`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, height: '100%' }}
              >
                <div style={{ height: `${w.rec ?? 0}%`, background: col(w.rec ?? null), borderRadius: '2px 2px 0 0', opacity: w.rec == null ? 0.12 : 1, minHeight: w.rec ? 2 : 3 }} />
                <div
                  style={{ height: `${Math.min(100, ((w.sleep ?? 0) / 9) * 100) * 0.45}%`, background: T.accentInk, opacity: w.sleep == null ? 0.1 : 0.45, borderRadius: '0 0 2px 2px', minHeight: 2 }}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 8 }}>oben Recovery · unten Schlaf</div>
      </div>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={lbl}>Routinen</div> <span style={{ fontFamily: T.mono, fontSize: 11, color: streak > 0 ? T.accent : T.muted }}>{streak} Tage in Folge</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {t14.map(d => {
            const n = log[d]?.length ?? 0;
            return (
              <div
                key={d}
                title={`${d}: ${n}/${ROUTINE_ITEMS.length}`}
                style={{ flex: 1, height: 26, borderRadius: 4, background: n === 0 ? 'rgba(255,255,255,.05)' : T.accent, opacity: n === 0 ? 1 : 0.25 + (n / ROUTINE_ITEMS.length) * 0.75 }}
              />
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 10, lineHeight: 1.5 }}>
          Vier von {ROUTINE_ITEMS.length} Häkchen zählen als gehaltener Tag.
          <Link href="/os/gesundheit" style={{ color: T.accentInk, textDecoration: 'none' }}>
            Heute abhaken ›
          </Link>
        </div>
      </div>
    </>
  );
} // ───────────────────────── Business ─────────────────────────
interface Prospect {
  id: string;
  company: string;
  score?: number;
  status: string;
}
function WerkzeugBusiness() {
  const [ps, setPs] = useState<Prospect[]>([]);
  const [fin, setFin] = useState<FinanceState | null>(null);
  const [fplan, setFplan] = useState<{ rechnungen: { status: string; betrag: number; faellig?: string; kunde: string }[]; produkte: { status: string; preis: number; name: string }[] } | null>(null);
  const [kunden, setKunden] = useState<{ status: string; name: string; cashflow?: number }[]>([]);
  const [ms, setMs] = useState<{ titel: string; bereich: string; faellig?: string; zeitfenster?: string; fortschritt: number; erledigt: boolean }[]>([]);
  useEffect(() => {
    fetch('/api/state/prospects')
      .then(r => r.json())
      .then(d => setPs(d.state?.prospects ?? []))
      .catch(() => {});
    fetch('/api/state/finance')
      .then(r => r.json())
      .then(d => setFin(d.state ?? null))
      .catch(() => {});
    fetch('/api/state/finanzplan')
      .then(r => r.json())
      .then(setFplan)
      .catch(() => {});
    fetch('/api/state/kunden')
      .then(r => r.json())
      .then(d => setKunden(d.kunden ?? []))
      .catch(() => {});
    fetch('/api/state/meilensteine')
      .then(r => r.json())
      .then(d => setMs((d.meilensteine ?? []).filter((x: { bereich: string }) => x.bereich === 'business')))
      .catch(() => {});
  }, []);
  const stufen = [
    { k: 'neu', label: 'Neu', n: ps.filter(p => p.status === 'neu').length },
    { k: 'qualifiziert', label: 'Qualifiziert', n: ps.filter(p => p.status === 'qualifiziert').length },
    { k: 'kontaktiert', label: 'Kontaktiert', n: ps.filter(p => p.status === 'kontaktiert').length },
  ];
  const max = Math.max(1, ...stufen.map(s => s.n));
  const top = [...ps].filter(p => p.status !== 'kontaktiert' && p.status !== 'verworfen').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const ist = fin ? fin.months.reduce((s, m) => s + m.umsatz, 0) : 0; // ── Der lebende Geld- und Mandats-Stand ──
  const heute = localDay();
  const sum = (l: { betrag: number }[]) => l.reduce((s, r) => s + (r.betrag || 0), 0);
  const gestellt = (fplan?.rechnungen ?? []).filter(r => r.status === 'gestellt');
  const geplantR = (fplan?.rechnungen ?? []).filter(r => r.status === 'geplant');
  const ueberfaellig = gestellt.filter(r => r.faellig && r.faellig < heute);
  const aktive = kunden.filter(k => k.status === 'aktiv');
  const cash = aktive.reduce((s, k) => s + (k.cashflow ?? 0), 0);
  const produkteAktiv = (fplan?.produkte ?? []).filter(p => p.status === 'aktiv' && p.preis > 0).length;
  const naechsterMs = ms.filter(m => !m.erledigt).sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999'))[0];
  const hotOffen = ps.filter(p => (p.score ?? 0) >= 80 && p.status !== 'kontaktiert' && p.status !== 'verworfen').length; // ── Der EINE Hebel — deterministische Regel-Kette, kein Raten ──
  const hebel = (() => {
    if (ueberfaellig.length) return { text: `${eur(sum(ueberfaellig))} Forderungen sind ÜBERFÄLLIG — heute nachfassen.`, href: '/os/finanzen', label: 'Finanzplanung' };
    if (!fin || ist === 0) return { text: 'Ohne Ist-Zahlen fliegt die Säule blind — Controlling füllen (Finanzmeeting).', href: '/os/controlling', label: 'Controlling' };
    if (geplantR.length && !gestellt.length)
      return { text: `${geplantR.length} Rechnung${geplantR.length > 1 ? 'en' : ''} in Vorbereitung — stellen, sonst fließt nichts.`, href: '/os/finanzen', label: 'Finanzplanung' };
    if (!produkteAktiv) return { text: 'Kein Produktpaket aktiv — ohne Angebot kein Verkauf. Pakete festzurren.', href: '/os/finanzen', label: 'Produkte' };
    if (hotOffen)
      return {
        text: `${hotOffen} heiße${hotOffen === 1 ? 'r' : ''} Prospect${hotOffen > 1 ? 's' : ''} (80+) unkontaktiert — der erste Schritt kostet 20 Minuten.`,
        href: '/os/prospecting',
        label: 'Zielliste',
      };
    if (naechsterMs) return { text: `Nächster Meilenstein: ${naechsterMs.titel} (${naechsterMs.fortschritt}%) — Fortschritt schieben.`, href: '/os/planung/jahr', label: 'Meilensteine' };
    return { text: 'Kurs halten — Pipeline füllen und Mandate ausbauen.', href: '/os/prospecting', label: 'Zielliste' };
  })();
  return (
    <>
      {/* Der eine Hebel — was JETZT den größten Unterschied macht */}
      <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '13px 17px' }}>
        <div style={{ ...lbl, color: T.amber, marginBottom: 5 }}>Der eine Hebel</div>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
          {hebel.text}
          <Link href={hebel.href} style={{ color: T.accentInk, textDecoration: 'none' }}>
            {hebel.label} ›
          </Link>
        </div>
      </div>
      {/* Geld & Mandate — die ehrlichen Bestandszahlen */}
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Geld & Mandate</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {[
            { l: 'Offene Forderungen', v: gestellt.length ? eur(sum(gestellt)) : '—', c: ueberfaellig.length ? T.crit : T.amber },
            { l: 'In Vorbereitung', v: geplantR.length ? eur(sum(geplantR)) : '—', c: T.inkDim },
            { l: 'Aktive Mandate', v: String(aktive.length), c: T.accent },
            { l: 'Cashflow/Monat', v: cash ? eur(cash) : '—', c: T.ink },
          ].map((k, i) => (
            <div key={i}>
              <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: T.muted }}>{k.l}</div>
              <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: k.c, marginTop: 3 }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Link href="/os/finanzen" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>
            Finanzplanung ›
          </Link>
          <Link href="/os/crm" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>
            CRM ›
          </Link>
        </div>
        {naechsterMs && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 10, fontSize: 12.5, color: T.inkDim }}>
            <span style={{ color: T.amber }}>◇</span> Nächster Meilenstein: <b style={{ color: T.ink }}>{naechsterMs.titel}</b>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
              {naechsterMs.faellig ? `· ${naechsterMs.faellig.slice(8)}.${naechsterMs.faellig.slice(5, 7)}.` : (naechsterMs.zeitfenster ?? '')} · {naechsterMs.fortschritt}%
            </span>
          </div>
        )}
      </div>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 12 }}>Trichter</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {stufen.map(s => (
            <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: T.inkDim, width: 100, flex: '0 0 auto' }}>{s.label}</span>
              <div style={{ flex: 1, height: 22, background: T.void, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${(s.n / max) * 100}%`, height: '100%', background: s.k === 'kontaktiert' ? T.accent : T.accentInk, opacity: s.n ? 0.8 : 0, borderRadius: 5 }} />
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: s.n ? T.ink : T.muted, width: 26, textAlign: 'right', flex: '0 0 auto' }}>{s.n}</span>
            </div>
          ))}
        </div>
        {top && (
          <div style={{ marginTop: 14, background: T.panel2, border: `1px solid ${T.accent}44`, borderRadius: 10, padding: '11px 14px' }}>
            <div style={{ ...lbl, color: T.accent, marginBottom: 4 }}>Nächster Kontakt</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
              {top.company} <span style={{ fontFamily: T.mono, fontSize: 12, color: col(top.score ?? null), marginLeft: 6 }}>{top.score ?? '—'}</span>
            </div>
            <Link href="/os/prospecting" style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', display: 'inline-block', marginTop: 5 }}>
              In der Zielliste öffnen ›
            </Link>
          </div>
        )}
      </div>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Umsatz-Kurs</div>
        {fin && ist > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: T.accent }}>{Math.round((ist / fin.zielUmsatz) * 100)}%</span>
              <span style={{ fontSize: 13, color: T.inkDim }}>
                {eur(ist)} von {eur(fin.zielUmsatz)}
              </span>
            </div>
            <div style={{ height: 8, background: T.void, borderRadius: 5, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (ist / fin.zielUmsatz) * 100)}%`, height: '100%', background: `linear-gradient(90deg,${T.accent},${T.accentInk})` }} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
            Noch keine Ist-Zahlen. Ohne sie kann diese Säule nur die Pipeline bewerten — der halbe Blick.
            <Link href="/os/controlling" style={{ color: T.accentInk, textDecoration: 'none' }}>
              Zahlen eintragen ›
            </Link>
          </div>
        )}
      </div>
    </>
  );
} // ───────────────────────── Planung ─────────────────────────
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}
function WerkzeugPlanung() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const today = localDay();
  const load = () =>
    fetch('/api/state/tasks')
      .then(r => r.json())
      .then(d => setTasks(d.state?.tasks ?? []))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const offen = tasks.filter(t => t.status !== 'done');
  const brennt = offen.filter(t => (t.dueDate && t.dueDate <= today) || t.priority === 'critical').sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  async function setStatus(t: Task, status: string) {
    setBusy(t.id);
    const next = tasks.map(x => (x.id === t.id ? { ...x, status, updatedAt: new Date().toISOString() } : x));
    setTasks(next);
    try {
      // Erst den echten Stand holen, dann genau diese eine Aufgabe ändern.
      // Wichtig: kommt keine Liste zurück, wird NICHT geschrieben — sonst
      // hätte ein fehlgeschlagener Lesevorgang alle Aufgaben gelöscht.
      const r = await fetch('/api/state/tasks', { cache: 'no-store' });
      if (!r.ok) throw new Error('Stand nicht lesbar');
      const cur = await r.json();
      if (!Array.isArray(cur?.state?.tasks) || !Array.isArray(cur?.state?.projects)) throw new Error('kein Bestand');
      await fetch('/api/state/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: cur.state.projects, tasks: cur.state.tasks.map((x: Task) => (x.id === t.id ? { ...x, status } : x)) }),
      });
      await load();
    } catch {
      setTasks(tasks); /* nicht gespeichert — Anzeige zurückdrehen */
    }
    setBusy(null);
  }
  return (
    <div style={{ ...panel, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={lbl}>Was jetzt brennt</div>
        <Link href="/os/aufgaben" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>
          alle Aufgaben ›
        </Link>
      </div>
      {!brennt.length ? (
        <div style={{ fontSize: 13, color: T.inkDim, marginTop: 10 }}>Nichts überfällig und nichts Kritisches offen. Das ist die Lage, die du halten willst.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {brennt.slice(0, 8).map(t => {
            const spaet = !!t.dueDate && t.dueDate < today;
            return (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 8, borderBottom: `1px solid ${T.lineSoft}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: T.ink }}>{t.title}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: spaet ? T.crit : T.muted, marginTop: 2 }}>
                    {t.priority}
                    {t.dueDate ? ` · ${spaet ? 'überfällig seit' : 'fällig'} ${t.dueDate}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setStatus(t, t.status === 'in-progress' ? 'todo' : 'in-progress')}
                  disabled={busy === t.id}
                  style={{
                    fontFamily: T.sans,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${t.status === 'in-progress' ? T.accentInk : T.line}`,
                    background: t.status === 'in-progress' ? `${T.accentInk}22` : 'transparent',
                    color: t.status === 'in-progress' ? T.accentInk : T.inkDim,
                  }}
                >
                  {t.status === 'in-progress' ? 'in Arbeit' : 'anfangen'}
                </button>
                <button
                  onClick={() => setStatus(t, 'done')}
                  disabled={busy === t.id}
                  style={{
                    fontFamily: T.sans,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    border: `1px solid ${T.accent}`,
                    background: `${T.accent}22`,
                    color: T.accent,
                  }}
                >
                  ✓
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 12, color: T.muted, marginTop: 12, lineHeight: 1.5 }}> {offen.length} offen — bis 12 gilt als tragbar. Was hier nicht brennt, muss heute nicht in deinen Kopf. </div>
    </div>
  );
} // ───────────────────────── Finanzen ─────────────────────────
function WerkzeugFinanzen() {
  const [fin, setFin] = useState<FinanceState | null>(null);
  const [cash, setCash] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch('/api/state/finance')
      .then(r => r.json())
      .then(d => {
        setFin(d.state ?? null);
        if (d.state?.cash) setCash(String(d.state.cash));
      })
      .catch(() => {});
  }, []);
  const kosten = fin ? fin.months.reduce((s, m) => s + m.kosten, 0) : 0;
  const aktiv = fin ? fin.months.filter(m => m.umsatz > 0 || m.kosten > 0).length : 0;
  const burn = aktiv ? kosten / aktiv : 0;
  const cashNum = Number(cash.replace(/[^\d]/g, '')) || 0;
  const runway = burn > 0 ? cashNum / burn : null;
  async function speichern() {
    if (!fin) return;
    setSaving(true);
    try {
      await fetch('/api/state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fin, cash: cashNum }) });
      setFin({ ...fin, cash: cashNum });
    } catch {
      /* lokal */
    }
    setSaving(false);
  }
  return (
    <div style={{ ...panel, padding: '16px 20px' }}>
      <div style={{ ...lbl, marginBottom: 10 }}>Runway-Rechner</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={lbl}>Cash aktuell</span>
          <input
            value={cash}
            onChange={e => setCash(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.mono, fontSize: 15, padding: '9px 11px', width: 150, outline: 'none' }}
          />
        </label>
        <button
          onClick={speichern}
          disabled={saving || !fin}
          style={{
            fontFamily: T.sans,
            fontSize: 12.5,
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: 9,
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
            background: saving ? T.line : T.accent,
            color: saving ? T.muted : '#04110F',
          }}
        >
          {saving ? '…' : 'Übernehmen'}
        </button>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={lbl}>Reicht für</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: runway == null ? T.muted : runway < 4 ? T.crit : runway < 8 ? T.amber : T.accent }}>
            {runway == null ? '—' : `${runway.toFixed(1)} Monate`}
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}> {burn > 0 ? `bei Ø Burn ${eur(burn)}/Monat` : 'trag Kosten im Controlling ein, dann rechnet es'} </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 14, lineHeight: 1.5, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
        Der Runway ist die härteste Zahl im System: er sagt, wie lange du Entscheidungen aus Ruhe treffen kannst statt aus Druck.
        <Link href="/os/controlling" style={{ color: T.accentInk, textDecoration: 'none' }}>
          Monatszahlen pflegen ›
        </Link>
      </div>
    </div>
  );
} // ───────────────────────── Beziehung & Team ─────────────────────────
function WerkzeugSozial() {
  const [journal, setJournal] = useState<Record<string, { mood?: number }>>({});
  const [ritLog, setRitLog] = useState<Record<string, string[]>>({}); // Die Route liefert { journal } — nicht log/state. Vorher blieb die Kurve
  // deshalb immer leer, auch mit Einträgen.
  useEffect(() => {
    fetch('/api/state/journal')
      .then(r => r.json())
      .then(d => setJournal(d.journal ?? {}))
      .catch(() => {});
    fetch('/api/state/rituale')
      .then(r => r.json())
      .then(d => setRitLog(d.log ?? {}))
      .catch(() => {});
  }, []);
  const heute = localDay();
  const gehalten = new Set(ritLog[heute] ?? []);
  async function toggleRitual(id: string) {
    const an = !gehalten.has(id); // Sofort umschalten, danach bestätigen lassen — sonst fühlt es sich träge an.
    setRitLog(prev => {
      const tag = new Set(prev[heute] ?? []);
      an ? tag.add(id) : tag.delete(id);
      return { ...prev, [heute]: Array.from(tag) };
    });
    try {
      const r = await fetch('/api/state/rituale', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, an, date: heute }) });
      const d = await r.json();
      if (d.log) setRitLog(d.log);
    } catch {
      /* lokal */
    }
  }
  const t14 = tage(14);
  const hatStimmung = t14.some(d => typeof journal[d]?.mood === 'number');
  const kern = TEAM.filter(t => t.kreis === 'kern');
  const partner = TEAM.filter(t => t.kreis !== 'kern');
  return (
    <>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={lbl}>Stimmung · 14 Tage</div>
          <Link href="/os/journal" style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>
            Journal ›
          </Link>
        </div>
        {!hatStimmung ? (
          <div style={{ fontSize: 13, color: T.inkDim, marginTop: 10, lineHeight: 1.5 }}> Diese Säule hat noch keine Datenquelle. Ein Journal-Eintrag pro Woche genügt, damit sie mitzählt. </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60, marginTop: 12 }}>
            {t14.map(d => {
              const m = journal[d]?.mood;
              return (
                <div
                  key={d}
                  title={`${d}: ${m ?? '—'}/5`}
                  style={{ flex: 1, height: m ? `${(m / 5) * 100}%` : 3, background: m ? (m >= 4 ? T.accent : m >= 3 ? T.amber : T.crit) : 'rgba(255,255,255,.06)', borderRadius: '3px 3px 0 0' }}
                />
              );
            })}
          </div>
        )}
      </div>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 4 }}>Rituale — was die Beziehung trägt</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Antippen, wenn gehalten. Zählt in die Säule ein.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RITUALE.map(r => {
            const an = gehalten.has(r.id);
            return (
              <div key={r.id} onClick={() => toggleRitual(r.id)} style={{ display: 'flex', gap: 10, alignItems: 'baseline', cursor: 'pointer' }}>
                <span style={{ color: an ? T.accent : T.muted, flex: '0 0 auto', fontSize: 14 }}>{an ? '◆' : '◇'}</span>
                <div>
                  <span style={{ fontSize: 13.5, color: an ? T.accent : T.ink, fontWeight: 600 }}>{r.name}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 8 }}>{r.rhythmus}</span>
                  <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 2, lineHeight: 1.45 }}>{r.warum}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 4 }}>Wer was trägt</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>Aus dem Miro-Strategieboard — die Grundlage für jede Delegation.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[...kern, ...partner].map(t => (
            <div key={t.name} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: t.kreis === 'privat' ? T.accentInk : T.ink, width: 132, flex: '0 0 auto' }}>{t.kurz}</span>
              <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1, minWidth: 180, lineHeight: 1.45 }}>{t.bereiche.join(' · ')}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
} // Verbindung, nach der der Rückblick-Loop selbst gefragt hat: hängt die
// Tagesform mit dem zusammen, was tatsächlich fertig wurde?
function WerkzeugZusammenhang() {
  const [vit, setVit] = useState<Record<string, { rec?: number; sleep?: number }>>({});
  const [tasks, setTasks] = useState<{ completedAt?: string; status: string }[]>([]);
  useEffect(() => {
    fetch('/api/state/vitals')
      .then(r => r.json())
      .then(d => setVit(d.log ?? {}))
      .catch(() => {});
    fetch('/api/state/tasks')
      .then(r => r.json())
      .then(d => setTasks(d.state?.tasks ?? []))
      .catch(() => {});
  }, []);
  const t21 = tage(21);
  const zeilen = t21.map(d => ({ d, rec: vit[d]?.rec, fertig: tasks.filter(t => t.completedAt?.slice(0, 10) === d).length })).filter(z => z.rec != null);
  if (zeilen.length < 5) {
    return (
      <div style={{ ...panel, padding: '16px 20px' }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Zusammenhang · Tagesform & Erledigtes</div>
        <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
          Ab etwa fünf Tagen mit Morgen-Check zeige ich hier, ob niedrige Recovery und liegengebliebene Aufgaben zusammenfallen — der Zusammenhang, den man im Alltag nie sieht.
          <span style={{ color: T.muted }}> Aktuell {zeilen.length} von 5.</span>
        </div>
      </div>
    );
  }
  const gute = zeilen.filter(z => (z.rec as number) >= 60);
  const schlechte = zeilen.filter(z => (z.rec as number) < 60);
  const schnitt = (a: typeof zeilen) => (a.length ? a.reduce((s, z) => s + z.fertig, 0) / a.length : 0);
  const gS = schnitt(gute),
    sS = schnitt(schlechte);
  const spanne = Math.max(1, ...zeilen.map(z => z.fertig));
  return (
    <div style={{ ...panel, padding: '16px 20px' }}>
      <div style={{ ...lbl, marginBottom: 12 }}>Zusammenhang · Tagesform & Erledigtes</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 70 }}>
        {zeilen.map(z => (
          <div key={z.d} title={`${z.d}: Recovery ${z.rec}, ${z.fertig} erledigt`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, height: '100%' }}>
            <div style={{ height: `${(z.fertig / spanne) * 55}%`, background: T.accent, opacity: 0.8, borderRadius: '2px 2px 0 0', minHeight: 2 }} />
            <div style={{ height: `${(z.rec as number) * 0.4}%`, background: col(z.rec as number), opacity: 0.35, borderRadius: '0 0 2px 2px', minHeight: 2 }} />
          </div>
        ))}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 6 }}>oben erledigt · unten Recovery</div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 13, color: T.inkDim, lineHeight: 1.55 }}>
        An Tagen mit Recovery ab 60 wurden im Schnitt <b style={{ color: T.accent }}>{gS.toFixed(1)}</b> Aufgaben fertig, darunter
        <b style={{ color: sS < gS ? T.amber : T.accent }}>{sS.toFixed(1)}</b>.
        {gute.length >= 3 && schlechte.length >= 3
          ? gS - sS >= 0.7
            ? ' Der Zusammenhang ist da — an schwachen Tagen weniger vornehmen ist keine Schwäche, sondern Rechnen.'
            : ' Bisher kein klarer Zusammenhang — deine Ausführung hängt offenbar an etwas anderem als der Erholung.'
          : ' Für ein Urteil fehlen noch Tage in beiden Gruppen.'}
      </div>
    </div>
  );
}
const WERKZEUGE: Record<string, () => JSX.Element> = {
  health: () => (
    <>
      <WerkzeugGesundheit />
      <WerkzeugZusammenhang />
    </>
  ),
  business: WerkzeugBusiness,
  planning: WerkzeugPlanung,
  finance: WerkzeugFinanzen,
  social: WerkzeugSozial,
}; // ───────────────────────── Rahmen ─────────────────────────
export function SaeuleView({ keyName }: { keyName: string }) {
  const [idx, setIdx] = useState<PerfIndex | null>(null);
  const meta = SAEULEN_META[keyName];
  useEffect(() => {
    fetch('/api/performance')
      .then(r => r.json())
      .then(d => setIdx(d.aktuell))
      .catch(() => {});
  }, []);
  const s: Saeule | undefined = idx?.saeulen.find(x => x.key === keyName);
  const Werkzeug = WERKZEUGE[keyName];
  if (!meta) return null;
  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/performance" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>
          ‹ Performance-Index
        </Link>
        <Seitenkopf
          rubrik={<>{meta.titel}</>}
          titel={<>{meta.claim}</>}
          satz={<>{meta.hin}</>}
        />
        {/* Wert + Herleitung */}
        <div style={{ ...panel, borderTop: `2px solid ${col(s?.score ?? null)}`, padding: '18px 22px', margin: '20px 0 14px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 42, fontWeight: 800, fontFamily: T.mono, color: col(s?.score ?? null), lineHeight: 1 }}>{s?.score ?? '—'}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
                Gewicht {s ? Math.round(s.gewicht * 100) : '—'}% im Index · Datenbasis
                <b style={{ color: (s?.abdeckung ?? 0) >= 0.4 ? T.accent : T.amber }}>{s ? Math.round(s.abdeckung * 100) : 0}%</b>
                {s?.zuDuenn && <span style={{ color: T.amber }}> — zählt noch nicht mit</span>}
              </div>
            </div>
          </div>
          {!!s?.faktoren.length && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {s.faktoren.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', opacity: f.echt ? 1 : 0.6 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: f.echt ? col(f.wert) : T.muted, width: 32, textAlign: 'right', flex: '0 0 auto' }}>
                    {f.echt ? f.wert : '—'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: f.echt ? T.ink : T.muted }}>{f.label}</span>
                    <span style={{ fontSize: 11.5, color: f.echt ? T.muted : T.amber, marginLeft: 8 }}>{f.quelle}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Werkzeuge */}
        <div style={{ ...lbl, margin: '18px 0 10px' }}>Werkzeuge</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{Werkzeug ? <Werkzeug /> : null}</div>
      </div>
    </div>
  );
}

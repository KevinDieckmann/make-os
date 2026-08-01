'use client';

import Link from 'next/link';
// ─── MAKE OS — CRM & Kunden ─────────────────────────────────────────────────
// Die Mandate von KD Ventures (du & Malin arbeitet darüber) + der Anschluss an
// die Neukunden-Pipeline (Prospecting). HubSpot-Anbindung kommt später — bis
// dahin ist DAS die eine Kundenliste.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';

interface Kunde { id: string; name: string; status: 'aktiv' | 'gespraech' | 'ruht'; mandat?: string; cashflow?: number; naechsterSchritt?: string; notizen?: string }
interface Prospect { id: string; company: string; score?: number; status: string }
interface Rechnung { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: 'geplant' | 'gestellt' | 'bezahlt'; faellig?: string }
interface Produkt { id: string; name: string; beschreibung: string; preis: number; einheit: string; status: string }
interface Finanzplan { rechnungen: Rechnung[]; produkte: Produkt[]; firmen: { id: string }[] }
const RSTATUS_FARBE: Record<Rechnung['status'], string> = { geplant: '#96A8A2', gestellt: '#E3A24B', bezahlt: '#21B5AA' }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const STATUS: { id: Kunde['status']; label: string; farbe: string }[] = [
  { id: 'aktiv', label: 'Aktiv', farbe: T.accent },
  { id: 'gespraech', label: 'Im Gespräch', farbe: T.amber },
  { id: 'ruht', label: 'Ruht', farbe: T.muted },
];
const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function CrmView() {
  const { state: tasksState } = useTasks();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [fplan, setFplan] = useState<Finanzplan | null>(null);
  const [neu, setNeu] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/kunden').then(r => r.json()).then(d => setKunden(d.kunden ?? [])).catch(() => {});
    fetch('/api/state/prospects').then(r => r.json()).then(d => setProspects(d.state?.prospects ?? [])).catch(() => {});
    fetch('/api/state/finanzplan').then(r => r.json()).then(setFplan).catch(() => {});
  }, []);

  /** Rechnung im Finanzplan anlegen (z.B. Produkt an Kunden) — gleiche Wahrheit wie /os/finanzen. */
  function rechnungAnlegen(kunde: string, titel: string, betrag: number) {
    if (!fplan) return;
    const next: Finanzplan = { ...fplan, rechnungen: [...fplan.rechnungen, { id: `r-${Date.now().toString(36)}`, firmaId: 'kdc', kunde, titel, betrag, status: 'geplant' }] };
    setFplan(next);
    clearTimeout(fpTimer.current);
    fpTimer.current = setTimeout(() => {
      fetch('/api/state/finanzplan', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
    }, 400);
  }

  const rechnungenVon = (name: string) => (fplan?.rechnungen ?? []).filter(r => r.kunde.toLowerCase() === name.toLowerCase());
  const aufgabenVon = (name: string) => tasksState.tasks.filter(t => t.status !== 'done' && t.title.toLowerCase().includes(name.toLowerCase()));

  function persist(next: Kunde[]) {
    setKunden(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/kunden', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kunden: next }) }).catch(() => {});
    }, 500);
  }
  const patch = (id: string, p: Partial<Kunde>) => persist(kunden.map(k => k.id === id ? { ...k, ...p } : k));

  const addKunde = () => {
    const n = neu.trim();
    if (!n) return;
    persist([...kunden, { id: `k-${Date.now().toString(36)}`, name: n, status: 'gespraech' }]);
    setNeu('');
  };

  const mrr = kunden.filter(k => k.status === 'aktiv').reduce((s, k) => s + (k.cashflow ?? 0), 0);
  const hot = prospects.filter(p => (p.score ?? 0) >= 80 && p.status !== 'verworfen').length;
  const kontaktiert = prospects.filter(p => p.status === 'kontaktiert').length;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>CRM & Kunden · KD Ventures</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Deine Mandate.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 660, lineHeight: 1.5 }}>
          Wer zahlt, wer im Gespräch ist, was als Nächstes passiert — du und Malin arbeitet über dieselbe Liste.
          <span style={{ color: T.muted }}> (HubSpot-Anbindung steht im Bauplan; bis dahin ist das hier die Wahrheit.)</span>
        </p>

        {/* Kennzahlen */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0 16px' }}>
          <div style={{ ...panel, padding: '11px 16px' }}><div style={lbl}>Aktive Mandate</div><div style={{ fontSize: 21, fontWeight: 700, color: T.accent }}>{kunden.filter(k => k.status === 'aktiv').length}</div></div>
          <div style={{ ...panel, padding: '11px 16px' }}><div style={lbl}>Cashflow / Monat</div><div style={{ fontSize: 21, fontWeight: 700 }}>{mrr ? eur(mrr) : '—'}</div></div>
          <div style={{ ...panel, padding: '11px 16px' }}><div style={lbl}>Im Gespräch</div><div style={{ fontSize: 21, fontWeight: 700, color: T.amber }}>{kunden.filter(k => k.status === 'gespraech').length}</div></div>
          <Link href="/os/prospecting" style={{ ...panel, padding: '11px 16px', textDecoration: 'none', color: 'inherit' }}>
            <div style={lbl}>Neukunden-Pipeline</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: T.accentInk }}>{prospects.length} Firmen · {hot} heiß · {kontaktiert} kontaktiert ›</div>
          </Link>
        </div>

        {/* Neu */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addKunde(); }}
            placeholder="Kunde/Mandat hinzufügen …"
            style={{ flex: 1, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13.5, padding: '10px 13px', outline: 'none' }} />
          <button onClick={addKunde} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', background: T.accent, color: '#04110F' }}>+ Kunde</button>
        </div>

        {/* Liste */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          {kunden.map((k, i) => {
            const st = STATUS.find(s => s.id === k.status)!;
            const auf = offen === k.id;
            return (
              <div key={k.id} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: auf ? T.panel2 : 'transparent' }}>
                <div onClick={() => setOffen(auf ? null : k.id)} style={{ display: 'flex', gap: 12, padding: '13px 16px', cursor: 'pointer', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.farbe, flex: '0 0 auto' }} />
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{k.name}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: st.farbe, border: `1px solid ${st.farbe}44`, borderRadius: 5, padding: '2px 8px' }}>{st.label}</span>
                  {k.cashflow ? <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.accent }}>{eur(k.cashflow)}/Monat</span> : null}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.naechsterSchritt ?? k.mandat ?? ''}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>{auf ? '▾' : '▸'}</span>
                </div>
                {auf && (
                  <div style={{ padding: '2px 18px 16px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {STATUS.map(s => (
                        <button key={s.id} onClick={() => patch(k.id, { status: s.id })}
                          style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${k.status === s.id ? s.farbe : T.line}`, background: k.status === s.id ? `${s.farbe}22` : 'transparent', color: k.status === s.id ? s.farbe : T.inkDim }}>{s.label}</button>
                      ))}
                      <input value={k.cashflow ?? ''} onChange={e => patch(k.id, { cashflow: Number(e.target.value.replace(/[^\d]/g, '')) || undefined })}
                        placeholder="€/Monat" inputMode="numeric"
                        style={{ width: 100, background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.mono, fontSize: 12, padding: '5px 9px', outline: 'none' }} />
                      <button onClick={() => persist(kunden.filter(x => x.id !== k.id))}
                        style={{ marginLeft: 'auto', fontFamily: T.sans, fontSize: 11.5, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }}>Löschen</button>
                    </div>
                    <input value={k.mandat ?? ''} onChange={e => patch(k.id, { mandat: e.target.value })}
                      placeholder="Mandat / Leistung …"
                      style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none' }} />
                    <input value={k.naechsterSchritt ?? ''} onChange={e => patch(k.id, { naechsterSchritt: e.target.value })}
                      placeholder="Nächster Schritt …"
                      style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none' }} />
                    <textarea value={k.notizen ?? ''} onChange={e => patch(k.id, { notizen: e.target.value })}
                      placeholder="Notizen — Gesprächsstände, Vereinbarungen, Kontext …" rows={3}
                      style={{ background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />

                    {/* Rechnungen dieses Kunden — dieselbe Wahrheit wie in der Finanzplanung */}
                    {(() => {
                      const re = rechnungenVon(k.name);
                      const offenSum = re.filter(r => r.status !== 'bezahlt').reduce((s, r) => s + r.betrag, 0);
                      return (
                        <div>
                          <div style={{ ...lbl, marginBottom: 6 }}>Rechnungen <span style={{ textTransform: 'none' }}>{re.length ? `· ${eur(offenSum)} offen` : ''}</span> <Link href="/os/finanzen" style={{ color: T.accent, textDecoration: 'none', textTransform: 'none' }}>Finanzplanung ›</Link></div>
                          {re.length
                            ? re.map(r => (
                              <div key={r.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 12.5, padding: '2px 0', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: T.mono, fontSize: 10, color: RSTATUS_FARBE[r.status], border: `1px solid ${RSTATUS_FARBE[r.status]}44`, borderRadius: 5, padding: '1px 7px' }}>{r.status}</span>
                                <span style={{ color: T.inkDim }}>{r.titel || 'Leistung'}</span>
                                <span style={{ fontFamily: T.mono, fontWeight: 700, color: T.ink }}>{r.betrag ? eur(r.betrag) : '— €'}</span>
                                {r.faellig && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>fällig {r.faellig.slice(8)}.{r.faellig.slice(5, 7)}.</span>}
                              </div>
                            ))
                            : <span style={{ fontSize: 12, color: T.muted }}>Noch keine Rechnung — unten ein Produkt anbieten oder in der Finanzplanung anlegen.</span>}
                        </div>
                      );
                    })()}

                    {/* Produkte anbieten → legt eine geplante Rechnung an */}
                    {fplan && fplan.produkte.length > 0 && (
                      <div>
                        <div style={{ ...lbl, marginBottom: 6 }}>Produkt anbieten <span style={{ textTransform: 'none' }}>(legt geplante Rechnung an)</span></div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {fplan.produkte.map(p => (
                            <button key={p.id} onClick={() => rechnungAnlegen(k.name, p.name, p.preis)}
                              title={p.beschreibung}
                              style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${p.status === 'aktiv' ? T.accent : T.line}`, background: 'transparent', color: p.status === 'aktiv' ? T.accentInk : T.inkDim }}>
                              + {p.name}{p.preis ? ` · ${eur(p.preis)}` : ''}{p.status !== 'aktiv' ? ' (Entwurf)' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Offene Aufgaben zu diesem Kunden */}
                    {(() => {
                      const at = aufgabenVon(k.name);
                      if (!at.length) return null;
                      return (
                        <div>
                          <div style={{ ...lbl, marginBottom: 6 }}>Offene Aufgaben <Link href="/os/aufgaben" style={{ color: T.accent, textDecoration: 'none', textTransform: 'none' }}>Taskmanagement ›</Link></div>
                          {at.slice(0, 5).map(t => (
                            <div key={t.id} style={{ fontSize: 12.5, color: T.inkDim, padding: '2px 0' }}>
                              {t.priority === 'critical' ? '‼ ' : '· '}{t.title}{t.dueDate ? <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}> · {t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span> : null}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

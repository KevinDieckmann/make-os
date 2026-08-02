'use client';

import Link from 'next/link';
// ─── MAKE OS — Finanzplanung ────────────────────────────────────────────────
// Der lebende Finanz-Organismus: beide Firmen mit Vivid-Konten (Stand von
// Hand, bis die Anbindung steht — siehe Bauplan), die Rechnungs-Pipeline
// (geplant → gestellt → bezahlt, Klick wechselt den Status) und Merkposten
// (Björn-Kredit). Oben die Verknüpfung zum Umsatzziel aus dem Controlling.

import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { useSpeichern } from '@/hooks/useSpeichern';
import { localDay } from '@/lib/zeit';

interface Firma { id: string; name: string; bank: string; kontostand: number | null; stand: string | null }
type RStatus = 'geplant' | 'gestellt' | 'bezahlt';
interface Rechnung { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: RStatus; faellig?: string; notiz?: string }
interface Merkposten { id: string; firmaId: string; titel: string; betrag: number; art: 'kredit' | 'sonstig'; datum?: string; notiz?: string }
interface Zahlung { id: string; firmaId: string; an: string; titel: string; betrag: number; status: 'offen' | 'bezahlt'; faellig?: string }
interface Produkt { id: string; name: string; beschreibung: string; preis: number; einheit: 'einmalig' | 'monatlich' | 'projekt'; status: 'entwurf' | 'aktiv' }
interface Uhrwerk { letztesMeeting: string | null; agenda: { id: string; label: string; done: boolean }[] }
interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; merkposten: Merkposten[]; zahlungen: Zahlung[]; produkte: Produkt[]; uhrwerk: Uhrwerk }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const STATUS_FARBE: Record<RStatus, string> = { geplant: '#96A8A2', gestellt: T.amber, bezahlt: T.accent };
const STATUS_NEXT: Record<RStatus, RStatus> = { geplant: 'gestellt', gestellt: 'bezahlt', bezahlt: 'geplant' };
const inp = { background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.mono, fontSize: 12, padding: '4px 8px', outline: 'none' };

export function FinanzplanungView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [neu, setNeu] = useState({ kunde: '', titel: '', betrag: '', firmaId: 'kdc' });
  const [neuZ, setNeuZ] = useState({ an: '', titel: '', betrag: '', faellig: '', firmaId: 'kdc' });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heute = localDay();

  useEffect(() => {
    fetch('/api/state/finanzplan').then(r => r.json()).then(setPlan).catch(() => {});
    fetch('/api/state/finance').then(r => r.json()).then(d => setFinance(d.state ?? d)).catch(() => {});
  }, []);

  // Speichert auch beim Seitenwechsel — nichts geht zwischen zwei Klicks verloren.
  const planSpeichern = useSpeichern('/api/state/finanzplan');
  function speichern(next: Plan) {
    setPlan(next);
    planSpeichern.speichern(next);
  }

  if (!plan) return <div style={{ minHeight: '100vh', background: T.void, color: T.muted, fontFamily: T.mono, fontSize: 12, padding: 40 }}>lade …</div>;

  const m = finance ? computeMetrics(finance) : null;
  const cash = plan.firmen.reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const gestellt = plan.rechnungen.filter(r => r.status === 'gestellt');
  const geplant = plan.rechnungen.filter(r => r.status === 'geplant');
  const sum = (list: Rechnung[]) => list.reduce((s, r) => s + r.betrag, 0);
  const kredite = plan.merkposten.filter(x => x.art === 'kredit').reduce((s, x) => s + x.betrag, 0);
  const firmaName = (id: string) => plan.firmen.find(f => f.id === id)?.name ?? id;

  function rechnungAendern(id: string, patch: Partial<Rechnung>) {
    speichern({ ...plan!, rechnungen: plan!.rechnungen.map(r => r.id === id ? { ...r, ...patch } : r) });
  }
  function zahlungBewegen(id: string, richtung: -1 | 1) {
    const z = [...plan!.zahlungen];
    const i = z.findIndex(x => x.id === id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= z.length) return;
    [z[i], z[j]] = [z[j], z[i]];
    speichern({ ...plan!, zahlungen: z });
  }

  const uhrwerk = plan.uhrwerk ?? { letztesMeeting: null, agenda: [] };
  const agendaOffen = uhrwerk.agenda.filter(a => !a.done).length;
  const tageSeitMeeting = uhrwerk.letztesMeeting
    ? Math.round((new Date(`${heute}T12:00:00`).getTime() - new Date(`${uhrwerk.letztesMeeting}T12:00:00`).getTime()) / 86_400_000)
    : null;
  const meetingUeberfaellig = tageSeitMeeting !== null && tageSeitMeeting > 16;

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>Finanzen · {heute.slice(8)}.{heute.slice(5, 7)}.</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 14px' }}>Finanzplanung</h1>

        {/* ── Finanzmeeting — das Uhrwerk: 2× im Monat, läuft immer wieder durch ── */}
        <div style={{ ...panel, borderLeft: `3px solid ${meetingUeberfaellig ? T.crit : T.amber}`, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={lbl}>Finanzmeeting · 2× im Monat</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: agendaOffen ? T.amber : T.accent }}>{uhrwerk.agenda.length - agendaOffen}/{uhrwerk.agenda.length}</span>
            <span style={{ fontSize: 11.5, color: meetingUeberfaellig ? T.crit : T.muted, marginLeft: 'auto' }}>
              {uhrwerk.letztesMeeting
                ? `zuletzt ${uhrwerk.letztesMeeting.slice(8)}.${uhrwerk.letztesMeeting.slice(5, 7)}.${meetingUeberfaellig ? ' — überfällig, der Takt ist alle 2 Wochen' : ''}`
                : 'noch keins abgeschlossen — das erste steht an'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 10 }}>
            <b style={{ color: T.ink }}>Rollen:</b> Malin bereitet vor, gleicht ab und prüft · Kevin entscheidet und gibt frei.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6 }}>
            {uhrwerk.agenda.map(a => (
              <div key={a.id} onClick={() => speichern({ ...plan, uhrwerk: { ...uhrwerk, agenda: uhrwerk.agenda.map(x => x.id === a.id ? { ...x, done: !x.done } : x) } })}
                style={{ display: 'flex', gap: 9, alignItems: 'baseline', cursor: 'pointer' }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, border: `1px solid ${a.done ? T.accent : T.line}`, background: a.done ? `${T.accent}22` : 'transparent', color: T.accent, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{a.done ? <span className="check-pop">✓</span> : ''}</span>
                <span style={{ fontSize: 12.5, color: a.done ? T.muted : T.inkDim, textDecoration: a.done ? 'line-through' : 'none' }}>{a.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
            <button
              onClick={() => speichern({ ...plan, uhrwerk: { letztesMeeting: heute, agenda: uhrwerk.agenda.map(a => ({ ...a, done: false })) } })}
              style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '5px 12px', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>
              ✓ Meeting abgeschlossen
            </button>
            <span style={{ fontSize: 11, color: T.muted }}>stempelt das Datum und setzt die Liste fürs nächste Mal zurück</span>
          </div>
        </div>

        {/* Ziel-Verknüpfung: dieselben Zahlen wie im Controlling */}
        {m && finance && (
          <Link href="/os/controlling" style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 13, color: T.inkDim }}>Jahresziel <b style={{ color: T.ink }}>{eur(finance.zielUmsatz)}</b></span>
            <span style={{ fontSize: 13, color: T.inkDim }}>Ist <b style={{ color: T.ink }}>{eur(m.istUmsatz)}</b> ({Math.round(m.fortschritt * 100)}%)</span>
            <span style={{ fontSize: 13, color: T.inkDim }}>gestellt offen <b style={{ color: T.amber }}>{eur(sum(gestellt))}</b></span>
            <span style={{ fontSize: 13, color: T.inkDim }}>in Vorbereitung <b style={{ color: T.ink }}>{eur(sum(geplant))}</b></span>
            <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk }}>Controlling ›</span>
          </Link>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Cash (beide Konten)', v: plan.firmen.some(f => f.kontostand != null) ? eur(cash) : '—', c: T.ink },
            { l: 'Offene Forderungen', v: eur(sum(gestellt)), c: T.amber },
            { l: 'In Vorbereitung', v: eur(sum(geplant)), c: T.inkDim },
            { l: 'Zu zahlen (offen)', v: eur(plan.zahlungen.filter(z => z.status === 'offen').reduce((s, z) => s + z.betrag, 0)), c: T.crit },
            { l: 'Kredite erhalten', v: eur(kredite), c: '#C77DFF' },
          ].map((k, i) => (
            <div key={i} style={{ ...panel, padding: '12px 16px' }}>
              <div style={lbl}>{k.l}</div>
              <div style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 700, color: k.c, marginTop: 5 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Firmen & Konten */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 14 }}>
          {plan.firmen.map(f => {
            const offen = plan.rechnungen.filter(r => r.firmaId === f.id && r.status === 'gestellt');
            return (
              <div key={f.id} style={{ ...panel, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{f.name}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{f.bank}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 6px' }}>
                  <span style={{ fontSize: 12, color: T.inkDim }}>Kontostand</span>
                  <input type="number" value={f.kontostand ?? ''} placeholder="—"
                    onChange={e => speichern({ ...plan, firmen: plan.firmen.map(x => x.id === f.id ? { ...x, kontostand: e.target.value === '' ? null : Number(e.target.value) } : x) })}
                    style={{ ...inp, width: 110, fontSize: 15, fontWeight: 700 }} />
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>€{f.stand ? ` · Stand ${f.stand.slice(8)}.${f.stand.slice(5, 7)}.` : ''}</span>
                </div>
                <div style={{ fontSize: 11.5, color: offen.length ? T.amber : T.muted }}>
                  {offen.length ? `${offen.length} Rechnung${offen.length > 1 ? 'en' : ''} offen · ${eur(sum(offen))}` : 'keine offenen Forderungen'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rechnungs-Pipeline */}
        <div style={{ ...panel, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Rechnungen <span style={{ textTransform: 'none' }}>(Klick auf den Status wechselt: geplant → gestellt → bezahlt)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.rechnungen.map(r => {
              const spaet = r.status === 'gestellt' && r.faellig && r.faellig < heute;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${T.line}55`, paddingBottom: 8 }}>
                  <button onClick={() => rechnungAendern(r.id, { status: STATUS_NEXT[r.status] })}
                    style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.06em', cursor: 'pointer', borderRadius: 6, padding: '3px 9px', border: `1px solid ${STATUS_FARBE[r.status]}66`, background: `${STATUS_FARBE[r.status]}1a`, color: STATUS_FARBE[r.status], width: 76, textAlign: 'center' }}>
                    {r.status}
                  </button>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{r.kunde}</span>
                  <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1, minWidth: 140 }}>{r.titel}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{firmaName(r.firmaId)}</span>
                  {r.faellig && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: spaet ? T.crit : T.muted }}>{spaet ? 'überfällig ' : 'fällig '}{r.faellig.slice(8)}.{r.faellig.slice(5, 7)}.</span>}
                  <input type="number" value={r.betrag || ''} placeholder="0"
                    onChange={e => rechnungAendern(r.id, { betrag: Number(e.target.value) || 0 })}
                    style={{ ...inp, width: 90, textAlign: 'right' }} />
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>€</span>
                  <button onClick={() => speichern({ ...plan, rechnungen: plan.rechnungen.filter(x => x.id !== r.id) })}
                    style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              );
            })}
            {!plan.rechnungen.length && <span style={{ fontSize: 12.5, color: T.muted }}>Keine Rechnungen — unten anlegen.</span>}
          </div>
          {/* Neu anlegen */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={neu.kunde} onChange={e => setNeu({ ...neu, kunde: e.target.value })} placeholder="Kunde" style={{ ...inp, width: 130, fontFamily: T.sans }} />
            <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} placeholder="Leistung/Titel" style={{ ...inp, flex: 1, minWidth: 160, fontFamily: T.sans }} />
            <input value={neu.betrag} onChange={e => setNeu({ ...neu, betrag: e.target.value })} placeholder="€" type="number" style={{ ...inp, width: 90, textAlign: 'right' }} />
            <select value={neu.firmaId} onChange={e => setNeu({ ...neu, firmaId: e.target.value })} style={{ ...inp, fontFamily: T.sans }}>
              {plan.firmen.map(f => <option key={f.id} value={f.id} style={{ background: T.panel }}>{f.name}</option>)}
            </select>
            <button
              onClick={() => {
                if (!neu.kunde.trim()) return;
                speichern({ ...plan, rechnungen: [...plan.rechnungen, { id: `r-${Date.now().toString(36)}`, firmaId: neu.firmaId, kunde: neu.kunde.trim(), titel: neu.titel.trim(), betrag: Number(neu.betrag) || 0, status: 'geplant' }] });
                setNeu({ kunde: '', titel: '', betrag: '', firmaId: neu.firmaId });
              }}
              style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '5px 12px', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>
              + Rechnung
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10 }}>
            Bezahlt? Dann den Betrag im <Link href="/os/controlling" style={{ color: T.accentInk, textDecoration: 'none' }}>Controlling</Link> als Monats-Umsatz erfassen — dort zählt er aufs Jahresziel.
          </div>
        </div>

        {/* ── Zahlungs-Prioritäten: was zuerst bezahlt wird, steht oben ── */}
        <div style={{ ...panel, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Zahlungs-Prioritäten <span style={{ textTransform: 'none' }}>(oben = zuerst · ↑↓ ordnen)</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.zahlungen.map((z, i) => {
              const spaet = z.status === 'offen' && z.faellig && z.faellig < heute;
              return (
                <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${T.line}55`, paddingBottom: 8, opacity: z.status === 'bezahlt' ? 0.5 : 1 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: i === 0 && z.status === 'offen' ? T.crit : T.muted, width: 20, textAlign: 'right' }}>{i + 1}.</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => zahlungBewegen(z.id, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: i === 0 ? `${T.muted}55` : T.muted, cursor: i === 0 ? 'default' : 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}>▲</button>
                    <button onClick={() => zahlungBewegen(z.id, 1)} disabled={i === plan.zahlungen.length - 1} style={{ background: 'none', border: 'none', color: i === plan.zahlungen.length - 1 ? `${T.muted}55` : T.muted, cursor: i === plan.zahlungen.length - 1 ? 'default' : 'pointer', fontSize: 9, padding: 0, lineHeight: 1 }}>▼</button>
                  </span>
                  <button onClick={() => speichern({ ...plan, zahlungen: plan.zahlungen.map(x => x.id === z.id ? { ...x, status: x.status === 'offen' ? 'bezahlt' : 'offen' } : x) })}
                    style={{ fontFamily: T.mono, fontSize: 10, cursor: 'pointer', borderRadius: 6, padding: '3px 9px', border: `1px solid ${z.status === 'bezahlt' ? T.accent : T.amber}66`, background: `${z.status === 'bezahlt' ? T.accent : T.amber}1a`, color: z.status === 'bezahlt' ? T.accent : T.amber, width: 72, textAlign: 'center' }}>
                    {z.status}
                  </button>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{z.an}</span>
                  <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1, minWidth: 120 }}>{z.titel}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{firmaName(z.firmaId)}</span>
                  {z.faellig && <span style={{ fontFamily: T.mono, fontSize: 10.5, color: spaet ? T.crit : T.muted }}>{spaet ? 'überfällig ' : 'fällig '}{z.faellig.slice(8)}.{z.faellig.slice(5, 7)}.</span>}
                  <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{eur(z.betrag)}</span>
                  <button onClick={() => speichern({ ...plan, zahlungen: plan.zahlungen.filter(x => x.id !== z.id) })}
                    style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              );
            })}
            {!plan.zahlungen.length && <span style={{ fontSize: 12.5, color: T.muted }}>Noch leer — im Finanzmeeting alle offenen Rechnungen zusammenziehen und hier priorisieren.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={neuZ.an} onChange={e => setNeuZ({ ...neuZ, an: e.target.value })} placeholder="An wen" style={{ ...inp, width: 130, fontFamily: T.sans }} />
            <input value={neuZ.titel} onChange={e => setNeuZ({ ...neuZ, titel: e.target.value })} placeholder="Wofür" style={{ ...inp, flex: 1, minWidth: 140, fontFamily: T.sans }} />
            <input value={neuZ.betrag} onChange={e => setNeuZ({ ...neuZ, betrag: e.target.value })} placeholder="€" type="number" style={{ ...inp, width: 90, textAlign: 'right' }} />
            <input value={neuZ.faellig} onChange={e => setNeuZ({ ...neuZ, faellig: e.target.value })} type="date" style={{ ...inp }} />
            <select value={neuZ.firmaId} onChange={e => setNeuZ({ ...neuZ, firmaId: e.target.value })} style={{ ...inp, fontFamily: T.sans }}>
              {plan.firmen.map(f => <option key={f.id} value={f.id} style={{ background: T.panel }}>{f.name}</option>)}
            </select>
            <button
              onClick={() => {
                if (!neuZ.an.trim()) return;
                speichern({ ...plan, zahlungen: [...plan.zahlungen, { id: `z-${Date.now().toString(36)}`, firmaId: neuZ.firmaId, an: neuZ.an.trim(), titel: neuZ.titel.trim(), betrag: Number(neuZ.betrag) || 0, status: 'offen', faellig: neuZ.faellig || undefined }] });
                setNeuZ({ an: '', titel: '', betrag: '', faellig: '', firmaId: neuZ.firmaId });
              }}
              style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '5px 12px', border: `1px solid ${T.amber}`, background: `${T.amber}1c`, color: T.amber }}>
              + Zahlung
            </button>
          </div>
        </div>

        {/* ── Produkte: 2–3 Pakete, im Meeting festzurren ── */}
        <div style={{ ...panel, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Produkte <span style={{ textTransform: 'none' }}>(Entwürfe — im Finanzmeeting festzurren, Klick auf Status aktiviert)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
            {plan.produkte.map(p => (
              <div key={p.id} style={{ border: `1px solid ${p.status === 'aktiv' ? T.accent : T.line}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <input value={p.name} onChange={e => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })}
                    style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: T.sans, flex: 1, minWidth: 0 }} />
                  <button onClick={() => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, status: x.status === 'aktiv' ? 'entwurf' : 'aktiv' } : x) })}
                    style={{ fontFamily: T.mono, fontSize: 9.5, cursor: 'pointer', borderRadius: 6, padding: '2px 8px', border: `1px solid ${p.status === 'aktiv' ? T.accent : T.muted}66`, background: 'transparent', color: p.status === 'aktiv' ? T.accent : T.muted }}>
                    {p.status}
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkDim, margin: '6px 0 8px', lineHeight: 1.45 }}>{p.beschreibung}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={p.preis || ''} placeholder="Preis"
                    onChange={e => speichern({ ...plan, produkte: plan.produkte.map(x => x.id === p.id ? { ...x, preis: Number(e.target.value) || 0 } : x) })}
                    style={{ ...inp, width: 90, textAlign: 'right' }} />
                  <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>€ · {p.einheit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Merkposten */}
        <div style={{ ...panel, padding: '14px 18px' }}>
          <div style={{ ...lbl, marginBottom: 10 }}>Merkposten</div>
          {plan.merkposten.map(x => (
            <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '3px 0' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: '#C77DFF' }}>{x.art === 'kredit' ? 'KREDIT' : 'MERK'}</span>
              <span style={{ fontSize: 13, color: T.ink }}>{x.titel}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 700, color: x.betrag >= 0 ? T.accent : T.crit }}>{eur(x.betrag)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{firmaName(x.firmaId)}{x.datum ? ` · ${x.datum.slice(8)}.${x.datum.slice(5, 7)}.` : ''}</span>
              {x.notiz && <span style={{ fontSize: 11.5, color: T.muted }}>{x.notiz}</span>}
            </div>
          ))}
          {!plan.merkposten.length && <span style={{ fontSize: 12.5, color: T.muted }}>Nichts vorgemerkt.</span>}
        </div>
      </div>
    </div>
  );
}

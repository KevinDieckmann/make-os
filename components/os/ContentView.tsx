'use client';

import Link from 'next/link';
import { useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { Rich } from '@/components/os/Rich';

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

const FORMATS = [
  { id: 'linkedin', label: 'LinkedIn-Post', hint: 'Hook + Haltung, Einladung zum Gespräch' },
  { id: 'artikel', label: 'Fachartikel', hint: '600–900 Wörter, Substanz statt Werbung' },
  { id: 'landing', label: 'Landingpage', hint: 'Hero, Nutzen-Blöcke, ruhiger CTA' },
  { id: 'email', label: 'Kalt-E-Mail', hint: 'Erstansprache an kaufm. Leitung/CFO' },
];

export function ContentView() {
  const [format, setFormat] = useState('linkedin');
  const [thema, setThema] = useState('');
  const [notizen, setNotizen] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!thema.trim() || busy) return;
    setBusy(true); setDraft(''); setCopied(false);
    try {
      const r = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, thema, notizen }) });
      const d = await r.json();
      setDraft(d.reply ?? 'Kein Entwurf.');
    } catch { setDraft('Fehler — nochmal versuchen.'); }
    setBusy(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  const activeFmt = FORMATS.find(f => f.id === format);

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={lbl}>Content-/Brand-Agent</div>
          <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.accentInk, border: `1px solid ${T.accentInk}55`, borderRadius: 5, padding: '2px 7px' }}>live · Entwurf</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Schreibt in deiner CI.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5 }}>Format wählen, Thema rein — der Agent entwirft in KEMARIS-Sprache (Souveränität, Klartext, keine Buzzwords). <b style={{ color: T.ink }}>Veröffentlichen bleibt dein Klick.</b></p>

        {/* Format */}
        <div style={{ ...lbl, margin: '20px 0 8px' }}>Format</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {FORMATS.map(f => (
            <button key={f.id} onClick={() => setFormat(f.id)} style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${format === f.id ? T.accent : T.line}`, background: format === f.id ? `${T.accent}18` : T.panel }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: format === f.id ? T.accent : T.ink }}>{f.label}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2, lineHeight: 1.35 }}>{f.hint}</div>
            </button>
          ))}
        </div>

        {/* Eingabe */}
        <div style={{ ...lbl, margin: '18px 0 8px' }}>Thema</div>
        <input value={thema} onChange={e => setThema(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) generate(); }} placeholder={`Worum geht's im ${activeFmt?.label}?`} style={{ width: '100%', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 14, padding: '11px 14px', outline: 'none' }} />
        <div style={{ ...lbl, margin: '12px 0 8px' }}>Notizen / Fakten <span style={{ textTransform: 'none', color: T.muted }}>(optional)</span></div>
        <textarea value={notizen} onChange={e => setNotizen(e.target.value)} rows={3} placeholder="Kernaussagen, Zahlen, Details, die rein sollen — der Agent erfindet nichts dazu." style={{ width: '100%', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, color: T.ink, fontFamily: T.sans, fontSize: 13.5, lineHeight: 1.5, padding: '11px 14px', outline: 'none', resize: 'vertical' }} />

        <button onClick={generate} disabled={busy || !thema.trim()} style={{ marginTop: 14, fontFamily: T.sans, fontSize: 13.5, fontWeight: 700, padding: '11px 20px', borderRadius: 9, border: 'none', cursor: busy || !thema.trim() ? 'default' : 'pointer', background: busy || !thema.trim() ? T.line : T.accent, color: busy || !thema.trim() ? T.muted : '#04110F' }}>
          {busy ? 'entwerfe …' : draft ? 'Neu entwerfen' : 'Entwurf schreiben'}
        </button>

        {/* Entwurf */}
        {(draft || busy) && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accentInk}`, padding: '16px 20px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={lbl}>Entwurf · {activeFmt?.label}</div>
              {draft && !busy && (
                <button onClick={copy} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: copied ? T.accent : T.inkDim, cursor: 'pointer' }}>{copied ? '✓ kopiert' : 'Kopieren'}</button>
              )}
            </div>
            {busy ? <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>schreibe in CI …</div> : <Rich text={draft} />}
            {draft && !busy && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}` }}>Entwurf — gegenlesen & selbst veröffentlichen.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

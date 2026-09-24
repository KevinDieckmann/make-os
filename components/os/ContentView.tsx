'use client';

// ─── MAKE OS — Content-/Brand-Agent ─────────────────────────────────────────
// Format wählen, Thema rein — der Agent entwirft in KEMARIS-Sprache.
// Veröffentlichen bleibt Kevins Klick.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Knopf aus schlank).

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Rich } from '@/components/os/Rich';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from './schlank';

const FORMATS = [
  { id: 'linkedin', label: 'LinkedIn-Post', hint: 'Hook + Haltung, Einladung zum Gespräch' },
  { id: 'artikel', label: 'Fachartikel', hint: '600–900 Wörter, Substanz statt Werbung' },
  { id: 'landing', label: 'Landingpage', hint: 'Hero, Nutzen-Blöcke, ruhiger CTA' },
  { id: 'email', label: 'Kalt-E-Mail', hint: 'Erstansprache an kaufm. Leitung/CFO' },
];

const mikro = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: C.inkLeise };

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
    <Seite
      titel="Schreibt in deiner CI."
      unter={<>Format wählen, Thema rein — der Agent entwirft in KEMARIS-Sprache (Souveränität, Klartext, keine Buzzwords). <b style={{ color: C.ink }}>Veröffentlichen bleibt dein Klick.</b></>}
      rechts={<Chip farbe={LEUCHT.agenten}>live · Entwurf</Chip>}
    >
      <Karte i={0} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten}>Format</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {FORMATS.map(f => {
            const an = format === f.id;
            return (
              <button key={f.id} onClick={() => setFormat(f.id)} className="fassbar" style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', border: 'none', fontFamily: SCHRIFT.text, background: an ? `${LEUCHT.agenten}1f` : 'rgba(255,255,255,.04)', transition: 'background .2s ease' }}>
                <div style={{ fontSize: TYP.bedien, fontWeight: 700, color: an ? LEUCHT.agenten : C.ink }}>{f.label}</div>
                <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 3, lineHeight: 1.4 }}>{f.hint}</div>
              </button>
            );
          })}
        </div>

        <div style={{ ...mikro, margin: '18px 0 8px' }}>Thema</div>
        <input value={thema} onChange={e => setThema(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) generate(); }} placeholder={`Worum geht's im ${activeFmt?.label}?`} style={feld} />
        <div style={{ ...mikro, margin: '12px 0 8px' }}>Notizen / Fakten <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
        <textarea value={notizen} onChange={e => setNotizen(e.target.value)} rows={3} placeholder="Kernaussagen, Zahlen, Details, die rein sollen — der Agent erfindet nichts dazu." style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />

        <div style={{ marginTop: 14 }}>
          <Knopf onClick={generate} aus={busy || !thema.trim()} farbe={LEUCHT.agenten}>
            {busy ? 'entwerfe …' : draft ? 'Neu entwerfen' : 'Entwurf schreiben'}
          </Knopf>
        </div>
      </Karte>

      {(draft || busy) && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts={draft && !busy ? <Knopf leise onClick={copy}>{copied ? '✓ kopiert' : 'Kopieren'}</Knopf> : undefined}>
            Entwurf · {activeFmt?.label}
          </Ueberschrift>
          {busy ? <Leer>schreibe in CI …</Leer> : <Rich text={draft} />}
          {draft && !busy && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 14 }}>Entwurf — gegenlesen &amp; selbst veröffentlichen.</div>}
        </Karte>
      )}
    </Seite>
  );
}

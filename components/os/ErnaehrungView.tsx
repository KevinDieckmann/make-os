'use client';

// ─── MAKE OS — Ernährung ────────────────────────────────────────────────────
// Kevins crit-Hebel (Ernährung 38, unregelmäßig): eine Essens-Woche, die er
// wirklich durchhält. 7 Tage × 3 Mahlzeiten editierbar, Jarvis schlägt die
// Woche nach den Grundsätzen vor (anti-entzündlich, regelmäßig, einfach),
// Einkaufsliste abhakbar + kopierbar (für Malin/REWE). Privat — kein Business.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { TAGE, TAG_LABEL, type ErnaehrungFile, type Mahlzeiten, type Tag } from '@/lib/make-one/ernaehrung-data';
import { Seitenkopf } from './Seitenkopf';

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const inp = { background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.sans, fontSize: 12.5, padding: '5px 9px', outline: 'none', width: '100%' };
const M_LABEL: { k: keyof Mahlzeiten; label: string }[] = [
  { k: 'fruehstueck', label: 'Früh' }, { k: 'mittag', label: 'Mittag' }, { k: 'abend', label: 'Abend' },
];

export function ErnaehrungView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const [daten, setDaten] = useState<ErnaehrungFile | null>(null);
  const [neu, setNeu] = useState('');
  const [vorschlag, setVorschlag] = useState<{ begruendung: string; plan: Record<Tag, Mahlzeiten>; einkauf: string[]; hinweis: string } | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [meld, setMeld] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/state/ernaehrung').then(r => r.json()).then(setDaten).catch(() => {});
  }, []);

  function speichern(next: ErnaehrungFile) {
    setDaten(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/ernaehrung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
    }, 500);
  }

  async function jarvisPlant() {
    setDenkt(true); setVorschlag(null);
    try {
      const r = await fetch('/api/ernaehrung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.plan) setVorschlag(d);
    } catch { /* still */ }
    setDenkt(false);
  }

  function uebernehmen() {
    if (!daten || !vorschlag) return;
    speichern({
      ...daten,
      plan: vorschlag.plan,
      einkauf: vorschlag.einkauf.map((text, i) => ({ id: `e-${Date.now().toString(36)}-${i}`, text, erledigt: false })),
    });
    setVorschlag(null);
  }

  function listeKopieren() {
    if (!daten) return;
    const offenP = daten.einkauf.filter(p => !p.erledigt).map(p => `– ${p.text}`).join('\n');
    try { navigator.clipboard.writeText(`Einkauf (${new Date().toLocaleDateString('de-DE')}):\n${offenP}`); setMeld('Liste kopiert — ab damit an Malin.'); } catch { setMeld('Kopieren nicht möglich.'); }
    setTimeout(() => setMeld(''), 2500);
  }

  if (!daten) return <div style={{ minHeight: '100vh', background: T.void, color: T.muted, fontFamily: T.mono, fontSize: 12, padding: 40 }}>lade …</div>;

  const heuteIdx = (new Date().getDay() + 6) % 7;
  const offeneEinkaeufe = daten.einkauf.filter(p => !p.erledigt).length;
  const geplantN = TAGE.reduce((s, t) => s + M_LABEL.filter(m => daten.plan[t][m.k].trim()).length, 0);

  return (
    <div style={eingebettet ? { color: T.ink, fontFamily: T.sans } : { minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={eingebettet ? {} : { maxWidth: 980, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        {!eingebettet && <Seitenkopf
          rubrik={<>Gesundheit · Ernährung</>}
          titel={<>Die Woche, die du durchhältst.</>}
          satz={<>Regelmäßig + anti-entzündlich — dein größter Hebel. Plan die Woche einmal, dann ist Essen keine Tages-Entscheidung mehr.</>}
        />}

        {/* Grundsätze */}
        <details style={{ ...panel, padding: '13px 17px', margin: '16px 0 12px' }}>
          <summary style={{ cursor: 'pointer', fontFamily: T.mono, fontSize: 11, color: T.accentInk, letterSpacing: '.08em', textTransform: 'uppercase' }}>Grundsätze (steuern Jarvis' Vorschlag)</summary>
          <textarea value={daten.grundsaetze} onChange={e => speichern({ ...daten, grundsaetze: e.target.value })} rows={5}
            style={{ width: '100%', marginTop: 10, background: T.void, border: `1px solid ${T.line}`, borderRadius: 10, color: T.inkDim, fontFamily: T.sans, fontSize: 12.5, lineHeight: 1.55, padding: 12, resize: 'vertical', outline: 'none' }} />
        </details>

        {/* Jarvis plant */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={jarvisPlant} disabled={denkt}
            style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.accent}`, background: denkt ? 'transparent' : `${T.accent}1c`, color: T.accentInk, cursor: denkt ? 'wait' : 'pointer' }}>
            {denkt ? 'Jarvis plant die Woche …' : '✨ Jarvis plant die Woche'}
          </button>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: geplantN >= 15 ? T.accent : T.muted }}>{geplantN}/21 Mahlzeiten geplant</span>
        </div>

        {vorschlag && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '13px 17px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.5, marginBottom: 8 }}><b style={{ color: T.accent }}>Jarvis:</b> {vorschlag.begruendung} <span style={{ color: T.muted }}>({vorschlag.einkauf.length} Einkaufs-Posten)</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={uebernehmen} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>Übernehmen — ersetzt Plan & Liste</button>
              <button onClick={() => setVorschlag(null)} style={{ fontFamily: T.sans, fontSize: 12.5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, cursor: 'pointer' }}>Verwerfen</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Wochenplan */}
          <div style={{ flex: '1 1 520px', minWidth: 300, ...panel, padding: '14px 18px' }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Essens-Woche</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {TAGE.map((t, i) => (
                <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderRadius: 9, background: i === heuteIdx ? `${T.accent}0e` : 'transparent', border: i === heuteIdx ? `1px solid ${T.accent}33` : '1px solid transparent' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: i === heuteIdx ? T.accent : T.muted, width: 78, flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '.08em' }}>{TAG_LABEL[t]}</span>
                  {M_LABEL.map(m => (
                    <input key={m.k} value={(vorschlag ? vorschlag.plan[t][m.k] : daten.plan[t][m.k]) ?? ''}
                      readOnly={!!vorschlag}
                      onChange={e => speichern({ ...daten, plan: { ...daten.plan, [t]: { ...daten.plan[t], [m.k]: e.target.value } } })}
                      placeholder={m.label}
                      style={{ ...inp, flex: '1 1 130px', minWidth: 110, opacity: vorschlag ? 0.75 : 1, borderStyle: vorschlag ? 'dashed' : 'solid' }} />
                  ))}
                </div>
              ))}
            </div>
            {vorschlag && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, marginTop: 8 }}>Vorschau — mit „Übernehmen" wird sie dein Plan.</div>}
          </div>

          {/* Einkaufsliste */}
          <div style={{ flex: '1 1 300px', minWidth: 270, ...panel, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <div style={lbl}>Einkaufsliste</div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: offeneEinkaeufe ? T.amber : T.accent }}>{offeneEinkaeufe} offen</span>
              <button onClick={listeKopieren} style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>Liste kopieren</button>
            </div>
            {meld && <div style={{ fontSize: 11.5, color: T.accent, marginBottom: 8 }}>{meld}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
              {daten.einkauf.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
                  <span onClick={() => speichern({ ...daten, einkauf: daten.einkauf.map(x => x.id === p.id ? { ...x, erledigt: !x.erledigt } : x) })}
                    style={{ width: 16, height: 16, borderRadius: 5, border: `1px solid ${p.erledigt ? T.accent : T.line}`, background: p.erledigt ? `${T.accent}22` : 'transparent', color: T.accent, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', cursor: 'pointer' }}>
                    {p.erledigt ? <span className="check-pop">✓</span> : ''}
                  </span>
                  <span style={{ fontSize: 12.5, color: p.erledigt ? T.muted : T.inkDim, textDecoration: p.erledigt ? 'line-through' : 'none', flex: 1 }}>{p.text}</span>
                  <button onClick={() => speichern({ ...daten, einkauf: daten.einkauf.filter(x => x.id !== p.id) })}
                    style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              ))}
              {!daten.einkauf.length && <span style={{ fontSize: 12, color: T.muted }}>Leer — Jarvis füllt sie mit dem Wochenplan, oder unten selbst ergänzen.</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input value={neu} onChange={e => setNeu(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && neu.trim()) { speichern({ ...daten, einkauf: [...daten.einkauf, { id: `e-${Date.now().toString(36)}`, text: neu.trim(), erledigt: false }] }); setNeu(''); } }}
                placeholder="Posten hinzufügen … (Enter)" style={{ ...inp }} />
            </div>
            {daten.einkauf.some(p => p.erledigt) && (
              <button onClick={() => speichern({ ...daten, einkauf: daten.einkauf.filter(p => !p.erledigt) })}
                style={{ marginTop: 8, fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 9px', cursor: 'pointer' }}>Abgehakte entfernen</button>
            )}
          </div>
        </div>

        <div style={{ fontSize: 11, color: T.muted, marginTop: 14, lineHeight: 1.5 }}>
          Alltagsküche, kein Medizin- oder Ernährungsrat — Psoriasis-Fragen gehören zu Arzt/Ernährungsberatung.
          {' '}<Link href="/os/gesundheit" style={{ color: T.accentInk, textDecoration: 'none' }}>Zum Cockpit ›</Link>
        </div>
      </div>
    </div>
  );
}

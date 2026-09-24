'use client';

// ─── MAKE OS — Prospecting-Agent ────────────────────────────────────────────
// Die Zielliste zum 1-Mio-Ziel: Firmen rein, KI qualifiziert gegen das ICP
// (Score + Fit + Aufhänger), Kevin priorisiert. Ansprache entwerfen — der
// Versand bleibt bei ihm.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Zahl aus schlank).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import {
  DEFAULT_ICP, PROSPECT_STATUS_ORDER, PROSPECT_STATUS_LABEL, PIPELINE_HINT,
  type Prospect, type ProspectStatus, type ProspectsState,
} from '@/lib/make-one/prospecting-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Zahl, feld, LEUCHT } from './schlank';

const scoreColor = (s?: number) => (s == null ? C.inkLeise : s >= 80 ? LEUCHT.gut : s >= 50 ? LEUCHT.achtung : LEUCHT.kritisch);
const statusColor = (s: ProspectStatus) => (s === 'kontaktiert' ? LEUCHT.gut : s === 'qualifiziert' ? LEUCHT.business : s === 'verworfen' ? LEUCHT.kritisch : C.inkLeise);
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
/** Nie eine Null als große Zahl — dann lieber der Strich. */
const z = (n: number) => (n ? String(n) : undefined);

/** Pillen-Schalter — eine Wahl aus mehreren, ohne Rahmen. */
function Wahl({ an, farbe, onClick, children, title, aus }: { an: boolean; farbe?: string; onClick: () => void; children: ReactNode; title?: string; aus?: boolean }) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} title={title} disabled={aus} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: aus ? 'default' : 'pointer', background: an ? `${f}22` : 'rgba(255,255,255,.05)', color: an ? f : C.inkDim, whiteSpace: 'nowrap', transition: 'background .2s ease, color .2s ease' }}>{children}</button>
  );
}

export function ProspectingView() {
  const [icp, setIcp] = useState(DEFAULT_ICP);
  const [rows, setRows] = useState<Prospect[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Ohne geladenen Stand wird nicht gespeichert — sonst ersetzt der erste
  // neue Eintrag die ganze Zielkundenliste.
  const [ladeFehler, setLadeFehler] = useState(false);
  useEffect(() => {
    fetch('/api/state/prospects')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then((d: { state: ProspectsState | null }) => {
        if (d.state) { setIcp(d.state.icp || DEFAULT_ICP); setRows(d.state.prospects || []); }
        setLoaded(true);
      })
      .catch(err => {
        console.error('[MAKE OS] Zielkunden konnten nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true);
        setLoaded(true);
      });
  }, []);

  function persist(nextIcp: string, nextRows: Prospect[]) {
    if (ladeFehler) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/prospects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icp: nextIcp, prospects: nextRows }) }).catch(() => {});
    }, 400);
  }
  const setRowsP = (next: Prospect[]) => { setRows(next); persist(icp, next); };
  const setIcpP = (v: string) => { setIcp(v); persist(v, rows); };

  async function score(p: Prospect): Promise<Prospect> {
    const r = await fetch('/api/prospecting/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
    const d = await r.json();
    if (d.error && d.score == null) return p;
    return { ...p, score: d.score, fit: d.fit, angle: d.angle, status: p.status === 'neu' ? 'qualifiziert' : p.status };
  }

  async function scoreOne(p: Prospect) {
    setBusy(b => ({ ...b, [p.id]: true }));
    const upd = await score(p);
    const next = rows.map(x => x.id === p.id ? upd : x);
    setRows(next);
    persist(icp, next);
    setBusy(b => ({ ...b, [p.id]: false }));
  }

  async function scoreAll() {
    setBulk(true);
    const todo = rows.filter(p => p.score == null);
    // Über die Schleife hinweg mitzählen: `rows` aus dem Abschluss wäre nach
    // dem ersten await veraltet, und der Speichervorgang gehört nicht in den
    // State-Updater — React darf den mehrfach aufrufen.
    let aktuell = rows;
    for (const p of todo) {
      const upd = await score(p);
      aktuell = aktuell.map(x => x.id === p.id ? upd : x);
      setRows(aktuell);
      persist(icp, aktuell);
    }
    setBulk(false);
  }

  function cycleStatus(p: Prospect) {
    const i = PROSPECT_STATUS_ORDER.indexOf(p.status);
    const next = PROSPECT_STATUS_ORDER[(i + 1) % PROSPECT_STATUS_ORDER.length];
    setRowsP(rows.map(x => x.id === p.id ? { ...x, status: next } : x));
  }

  // ── Outreach-Agent: Erstansprache in Kevins Stimme (Entwurf — Versand bei dir) ──
  const [entwurf, setEntwurf] = useState<{ fuer: string; betreff: string; email: string; linkedin: string; hinweis: string } | null>(null);
  const [entwurfBusy, setEntwurfBusy] = useState<string | null>(null);
  const [mailInfo, setMailInfo] = useState('');

  async function ansprache(p: Prospect) {
    setEntwurfBusy(p.id); setEntwurf(null); setMailInfo('');
    try {
      const r = await fetch('/api/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
      const d = await r.json();
      if (d.email) setEntwurf({ fuer: p.id, betreff: d.betreff ?? '', email: d.email, linkedin: d.linkedin ?? '', hinweis: d.hinweis ?? '' });
    } catch { /* still */ }
    setEntwurfBusy(null);
  }

  async function inMailOeffnen() {
    if (!entwurf) return;
    setMailInfo('öffne …');
    try {
      const r = await fetch('/api/apple-mail/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: '', subject: entwurf.betreff, body: entwurf.email }) });
      const d = await r.json();
      setMailInfo(d.ok ? '✓ In Apple Mail geöffnet — Empfänger eintragen, prüfen, selbst senden.' : (d.error ?? 'Konnte Mail nicht öffnen.'));
    } catch { setMailInfo('Apple Mail nicht erreichbar.'); }
  }

  function addManual() {
    const name = newName.trim();
    if (!name) return;
    const p: Prospect = { id: `p-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${rows.length}`, company: name, status: 'neu', region: 'DACH', addedAt: '' , source: 'manuell' };
    setRowsP([p, ...rows]); setNewName('');
  }

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const counts = PROSPECT_STATUS_ORDER.map(s => ({ s, n: rows.filter(r => r.status === s).length }));
  const unscored = rows.filter(r => r.score == null).length;
  const hot = rows.filter(r => (r.score ?? 0) >= 80).length;

  return (
    <Seite
      titel="Deine Zielliste zum 1-Mio-Ziel."
      unter={<>Firmen rein, KI qualifiziert gegen dein Profil (Score + Fit + Aufhänger), du priorisierst. {PIPELINE_HINT}</>}
      rechts={<Chip farbe={LEUCHT.agenten}>live · autonom</Chip>}
    >
      {/* Kennzahlen */}
      <Karte i={0} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business}>Zielliste</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
          <Zahl wert={z(rows.length)} label="In Liste" />
          <Zahl wert={z(hot)} label="Starker Fit (80+)" farbe={LEUCHT.gut} />
          <Zahl wert={z(unscored)} label="Noch offen" farbe={unscored ? LEUCHT.achtung : C.inkLeise} />
          {counts.map(c => <Zahl key={c.s} wert={z(c.n)} label={PROSPECT_STATUS_LABEL[c.s]} farbe={statusColor(c.s)} />)}
        </div>
      </Karte>

      {/* ICP */}
      <Karte i={1}>
        <details>
          <summary style={{ cursor: 'pointer', ...mikro, color: LEUCHT.business }}>Ideales Kundenprofil (ICP)</summary>
          <textarea value={icp} onChange={e => setIcpP(e.target.value)} rows={7} style={{ ...feld, marginTop: 12, resize: 'vertical', lineHeight: 1.5, color: C.inkDim }} />
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Das Profil steuert das Scoring. Änderungen werden gespeichert.</div>
        </details>
      </Karte>

      {/* Aktionen + Liste */}
      <Karte i={2}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <Knopf onClick={scoreAll} aus={bulk || !unscored} farbe={LEUCHT.business}>
            {bulk ? 'qualifiziere …' : unscored ? `Alle ${unscored} qualifizieren` : 'Alle qualifiziert ✓'}
          </Knopf>
          <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManual(); }} placeholder="Firma manuell hinzufügen …" style={{ ...feld, flex: 1, width: 'auto', padding: '9px 14px' }} />
            <Knopf leise onClick={addManual}>+ Hinzufügen</Knopf>
          </div>
        </div>

        {!loaded ? (
          <Leer>lade Zielliste …</Leer>
        ) : rows.length === 0 ? (
          <Leer>Noch keine Firmen. Füg oben welche hinzu — oder sag mir im Chat „bau die Zielliste aus“, dann ziehe ich echte Mittelstands-Firmen (Explorium) rein.</Leer>
        ) : (
          <Liste>
            {sorted.map(p => {
              const isOpen = open === p.id;
              return (
                <div key={p.id}>
                  <Zeile onClick={() => setOpen(isOpen ? null : p.id)} aktiv={isOpen}
                    links={<span style={{ width: 42, textAlign: 'center', flex: '0 0 auto', fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: scoreColor(p.score) }}>{p.score ?? '–'}</span>}
                    titel={p.company}
                    unter={[p.industry, p.size, p.region].filter(Boolean).join(' · ') || (p.domain ?? '')}
                    rechts={
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button onClick={e => { e.stopPropagation(); cycleStatus(p); }} title="Status wechseln" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip farbe={statusColor(p.status)}>{PROSPECT_STATUS_LABEL[p.status]}</Chip></button>
                        <span onClick={e => e.stopPropagation()}><Knopf leise onClick={() => scoreOne(p)} aus={busy[p.id]}>{busy[p.id] ? '…' : p.score == null ? 'Qualifizieren' : 'Neu bewerten'}</Knopf></span>
                        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{isOpen ? '▾' : '▸'}</span>
                      </span>
                    }
                  />
                  {isOpen && (
                    <div style={{ padding: '6px 2px 18px 56px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {p.fit && <div><div style={{ ...mikro, marginBottom: 4 }}>Fit</div><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{p.fit}</div></div>}
                      {p.angle && <div><div style={{ ...mikro, marginBottom: 4 }}>Aufhänger</div><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{p.angle}</div></div>}
                      {!p.fit && !p.angle && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch nicht qualifiziert — „Qualifizieren“ klicken.</div>}

                      {/* Outreach: Ansprache entwerfen — Versand bleibt bei Kevin */}
                      {p.score != null && (
                        <div>
                          <Knopf leise onClick={() => ansprache(p)} aus={entwurfBusy === p.id}>
                            {entwurfBusy === p.id ? 'Jarvis schreibt …' : entwurf?.fuer === p.id ? '↻ Neu entwerfen' : '✍ Ansprache entwerfen'}
                          </Knopf>
                        </div>
                      )}
                      {entwurf?.fuer === p.id && (
                        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ ...mikro, color: LEUCHT.business }}>E-Mail</span>
                            <input value={entwurf.betreff} onChange={e => setEntwurf({ ...entwurf, betreff: e.target.value })} aria-label="Betreff"
                              style={{ ...feld, flex: 1, minWidth: 160, width: 'auto', fontWeight: 600, padding: '8px 12px' }} />
                          </div>
                          <textarea value={entwurf.email} onChange={e => setEntwurf({ ...entwurf, email: e.target.value })} rows={7} aria-label="E-Mail-Text"
                            style={{ ...feld, color: C.inkDim, lineHeight: 1.55, resize: 'vertical' }} />
                          {entwurf.linkedin && (
                            <>
                              <div style={{ ...mikro, color: LEUCHT.business }}>LinkedIn-Erstnachricht</div>
                              <textarea value={entwurf.linkedin} onChange={e => setEntwurf({ ...entwurf, linkedin: e.target.value })} rows={3} aria-label="LinkedIn-Erstnachricht"
                                style={{ ...feld, color: C.inkDim, lineHeight: 1.55, resize: 'vertical' }} />
                            </>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Knopf onClick={inMailOeffnen} farbe={LEUCHT.business}>In Apple Mail öffnen</Knopf>
                            <Knopf leise onClick={() => { try { navigator.clipboard.writeText(`${entwurf.betreff}\n\n${entwurf.email}`); } catch { /* egal */ } }}>E-Mail kopieren</Knopf>
                            {entwurf.linkedin && <Knopf leise onClick={() => { try { navigator.clipboard.writeText(entwurf.linkedin); } catch { /* egal */ } }}>LinkedIn kopieren</Knopf>}
                            <Knopf leise onClick={() => setRowsP(rows.map(x => x.id === p.id ? { ...x, status: 'kontaktiert' } : x))}>→ als kontaktiert markieren</Knopf>
                            {mailInfo && <span style={{ fontSize: 12, color: LEUCHT.gut }}>{mailInfo}</span>}
                          </div>
                          {entwurf.hinweis && <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>{entwurf.hinweis}</div>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {PROSPECT_STATUS_ORDER.map(s => (
                          <Wahl key={s} an={p.status === s} farbe={statusColor(s)} onClick={() => setRowsP(rows.map(x => x.id === p.id ? { ...x, status: s } : x))}>{PROSPECT_STATUS_LABEL[s]}</Wahl>
                        ))}
                        <span style={{ marginLeft: 'auto' }}><Knopf leise onClick={() => setRowsP(rows.filter(x => x.id !== p.id))}>Löschen</Knopf></span>
                      </div>
                      {p.source && <div style={{ fontSize: 12, color: C.inkLeise }}>Quelle: {p.source}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </Liste>
        )}
      </Karte>
    </Seite>
  );
}

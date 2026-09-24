'use client';

// ─── MAKE OS — Wissen (24.09.) ──────────────────────────────────────────────
// Kevin: „kann meine Software jetzt auch auf Obsidian zugreifen?" — „ja mach
// das" — „Obsidian soll Nr. 1 Wissensbank sein."
//
// Links suchen oder stöbern, rechts lesen. Es ist dieselbe Suche, die Jarvis
// benutzt, mit derselben Sicht: gezeigt wird nur, was die angemeldete Person
// sehen darf (Vertraulichkeitsregeln im Vault). Geschrieben wird hier nichts —
// gepflegt wird in Obsidian, deshalb führt jede Notiz mit einem Griff dorthin.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { bloecke, inline, sichererLink, type Block, type Teil } from '@/lib/make-one/markdown';
import { Seite, Karte, Ueberschrift, Leer, Knopf, Segmente, Punkt, Chip, Zahl, feld, LEUCHT, Spalten, Spalte, useBreit } from './schlank';

interface Stand {
  notizen: number; privat: number; jeBereich: Record<string, number>; jeWurzel: Record<string, number>;
  wurzeln: { id: string; name: string; obsidian: string }[];
}
interface Eintrag {
  id: string; titel: string; bereich: string; scope?: string; stand?: string; geaendert: string;
  ausschnitt?: string; ueberschriften?: string[];
}
interface Voll {
  ok: boolean; fehler?: string; id?: string; titel?: string; text?: string; oben?: string;
  bereich?: string; typ?: string; scope?: string; stand?: string; geaendert?: string; obsidian?: string | null;
}

const BEREICHE = ['Business', 'Fundament', 'Protokolle', 'Quellen', 'Privat', 'MAKE OS', 'Sonstiges'];
const FARBE_BEREICH: Record<string, string> = {
  Business: LEUCHT.business, Fundament: LEUCHT.agenten, Protokolle: LEUCHT.puls, Quellen: LEUCHT.geld,
  Privat: LEUCHT.beziehung, 'MAKE OS': C.aktiv, Sonstiges: C.inkLeise,
};
const bereichFarbe = (b?: string) => FARBE_BEREICH[b ?? ''] ?? C.inkLeise;

function wann(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const min = (Date.now() - t) / 60_000;
  if (min < 60) return `vor ${Math.max(1, Math.round(min))} Min.`;
  if (min < 24 * 60) return `vor ${Math.round(min / 60)} Std.`;
  if (min < 48 * 60) return 'gestern';
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
/** „2026-09-21" → „21.09.26"; alles andere so, wie es im Kopf steht. */
function standText(s?: string): string {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : (s ?? '');
}

// ── Lesen: die Bausteine aus lib/make-one/markdown.ts als React ────────────

function teile(liste: Teil[], oeffne: (ziel: string) => void): ReactNode[] {
  return liste.map((t, i) => {
    switch (t.art) {
      case 'fett': return <strong key={i} style={{ fontWeight: 700, color: C.ink }}>{t.text}</strong>;
      case 'kursiv': return <em key={i}>{t.text}</em>;
      case 'markiert': return <mark key={i} style={{ background: `${LEUCHT.achtung}33`, color: C.ink, borderRadius: 4, padding: '0 3px' }}>{t.text}</mark>;
      case 'code': return <code key={i} style={{ fontFamily: SCHRIFT.mono, fontSize: '.88em', background: 'rgba(255,255,255,.07)', borderRadius: 6, padding: '1px 6px' }}>{t.text}</code>;
      case 'wiki':
        if (t.einbettung) return <span key={i} style={{ color: C.inkLeise }}>{`📎 ${t.text}`}</span>;
        return (
          <button key={i} onClick={() => oeffne(t.ziel)} title={`Notiz „${t.ziel}" öffnen`} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: LEUCHT.agenten, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${LEUCHT.agenten}66`, textUnderlineOffset: 3 }}>{t.text}</button>
        );
      case 'link': {
        const ziel = sichererLink(t.ziel);
        return ziel
          ? <a key={i} href={ziel} target={ziel.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ color: C.aktiv, textUnderlineOffset: 3 }}>{t.text}</a>
          : <span key={i}>{t.text}</span>;
      }
      default: return <span key={i}>{t.text}</span>;
    }
  });
}

const CALLOUT: Record<string, string> = { warning: LEUCHT.achtung, caution: LEUCHT.achtung, danger: LEUCHT.kritisch, important: LEUCHT.kritisch, tip: LEUCHT.gut, success: LEUCHT.gut, info: LEUCHT.puls, note: LEUCHT.puls, question: LEUCHT.agenten };

function block(b: Block, i: number, oeffne: (ziel: string) => void, oben = false): ReactNode {
  const zeile = (s: string) => teile(inline(s), oeffne);
  switch (b.art) {
    case 'titel': {
      const groesse = b.stufe === 1 ? 22 : b.stufe === 2 ? 18 : b.stufe === 3 ? 15.5 : 14;
      // Kevins Vault-Regel: der oberste „## 🔴 UPDATE"-Block ist der gültige Stand.
      if (b.text.startsWith('🔴')) {
        return (
          <div key={i} role="heading" aria-level={Math.min(6, b.stufe + 1)} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '18px 0 6px', fontFamily: SCHRIFT.display, fontSize: 15.5, fontWeight: 700 }}>
            <Punkt farbe={LEUCHT.kritisch} groesse={9} />
            <span>{zeile(b.text.replace(/^🔴\s*/, ''))}</span>
            {oben && <Chip farbe={LEUCHT.gut}>gültiger Stand</Chip>}
          </div>
        );
      }
      return <div key={i} role="heading" aria-level={Math.min(6, b.stufe + 1)} style={{ fontFamily: SCHRIFT.display, fontSize: groesse, fontWeight: 700, letterSpacing: '-.01em', margin: `${b.stufe <= 2 ? 22 : 16}px 0 6px`, textWrap: 'balance' as never }}>{zeile(b.text)}</div>;
    }
    case 'absatz':
      return <p key={i} style={{ margin: '0 0 12px' }}>{b.zeilen.map((z, j) => <span key={j}>{j > 0 && <br />}{zeile(z)}</span>)}</p>;
    case 'liste':
      return (
        <div key={i} style={{ margin: '0 0 12px', display: 'grid', gap: 4 }}>
          {b.punkte.map((p, j) => (
            <div key={j} style={{ display: 'flex', gap: 9, paddingLeft: p.tiefe * 18, alignItems: 'baseline' }}>
              {p.haken === undefined
                ? <span style={{ color: C.inkLeise, minWidth: b.geordnet ? 18 : 8, fontVariantNumeric: 'tabular-nums' }}>{b.geordnet ? `${j + 1}.` : '•'}</span>
                : <span aria-label={p.haken ? 'erledigt' : 'offen'} style={{ width: 15, height: 15, borderRadius: 4, flex: '0 0 auto', transform: 'translateY(2px)', border: `1.5px solid ${p.haken ? LEUCHT.gut : C.inkLeise}`, background: p.haken ? LEUCHT.gut : 'transparent', display: 'inline-grid', placeItems: 'center', color: C.grund, fontSize: 11, fontWeight: 800 }}>{p.haken ? '✓' : ''}</span>}
              <span style={{ color: p.haken ? C.inkLeise : undefined, textDecoration: p.haken ? 'line-through' : undefined }}>{zeile(p.text)}</span>
            </div>
          ))}
        </div>
      );
    case 'tabelle':
      return (
        <div key={i} style={{ overflowX: 'auto', margin: '4px 0 14px', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr>{b.kopf.map((k, j) => <th key={j} style={{ textAlign: 'left', padding: '8px 12px', color: C.inkDim, fontWeight: 700, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', whiteSpace: 'nowrap' }}>{zeile(k)}</th>)}</tr></thead>
            <tbody>{b.zeilen.map((r, j) => <tr key={j}>{b.kopf.map((_, k) => <td key={k} style={{ padding: '7px 12px', borderBottom: j < b.zeilen.length - 1 ? '1px solid rgba(255,255,255,.05)' : undefined, verticalAlign: 'top' }}>{zeile(r[k] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'zitat': {
      const f = b.callout ? (CALLOUT[b.callout] ?? LEUCHT.puls) : C.inkLeise;
      return (
        <div key={i} style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 12, background: b.callout ? `${f}14` : 'rgba(255,255,255,.03)', boxShadow: `inset 3px 0 0 ${f}` }}>
          {b.callout && <div style={{ fontSize: 12, fontWeight: 700, color: f, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: b.zeilen.length ? 4 : 0 }}>{b.titel ? zeile(b.titel) : b.callout}</div>}
          {b.zeilen.map((z, j) => <div key={j} style={{ color: C.inkDim }}>{z ? zeile(z) : <br />}</div>)}
        </div>
      );
    }
    case 'code':
      return <pre key={i} style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'rgba(0,0,0,.35)', overflowX: 'auto', fontFamily: SCHRIFT.mono, fontSize: 12.5, lineHeight: 1.55, color: C.inkDim }}>{b.text}</pre>;
    case 'linie':
      return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', margin: '16px 0' }} />;
  }
}

// ── Die Seite ───────────────────────────────────────────────────────────────

export function WissenView() {
  const breit = useBreit();
  const [stand, setStand] = useState<Stand | null>(null);
  const [frage, setFrage] = useState('');
  const [bereich, setBereich] = useState<string>('alle');
  const [liste, setListe] = useState<Eintrag[] | null>(null);
  const [durchsucht, setDurchsucht] = useState<number | null>(null);
  const [offen, setOffen] = useState<Voll | null>(null);
  const [laedtNotiz, setLaedtNotiz] = useState(false);
  const [verlauf, setVerlauf] = useState<string[]>([]);
  const lauf = useRef(0);
  const lesefenster = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/jarvis/wissen').then(r => r.json()).then(d => { if (d.ok) setStand(d); }).catch(() => {});
    // Direkt auf eine Notiz verlinkt (/os/wissen?n=…) — etwa aus einer Quelle, die Jarvis nennt.
    const n = new URLSearchParams(window.location.search).get('n');
    if (n) void oeffne(n, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suchen (verzögert, damit nicht jeder Buchstabe eine Anfrage ist) oder stöbern.
  useEffect(() => {
    const nr = ++lauf.current;
    const b = bereich === 'alle' ? '' : `&bereich=${encodeURIComponent(bereich)}`;
    const q = frage.trim();
    const t = setTimeout(() => {
      const url = q.length >= 3 ? `/api/jarvis/wissen?frage=${encodeURIComponent(q)}&anzahl=20${b}` : `/api/jarvis/wissen?neueste=1&anzahl=30${b}`;
      fetch(url).then(r => r.json()).then(d => {
        if (nr !== lauf.current) return;
        setListe(q.length >= 3 ? (d.treffer ?? []) : (d.notizen ?? []));
        setDurchsucht(q.length >= 3 ? (d.durchsucht ?? null) : null);
      }).catch(() => { if (nr === lauf.current) setListe([]); });
    }, q ? 260 : 0);
    return () => clearTimeout(t);
  }, [frage, bereich]);

  const oeffne = useCallback(async (id: string, merken = true) => {
    setLaedtNotiz(true);
    const d: Voll = await fetch(`/api/jarvis/wissen?notiz=${encodeURIComponent(id)}`).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaedtNotiz(false);
    setOffen(d);
    if (d.ok && d.id) {
      if (merken) setVerlauf(v => (v[v.length - 1] === d.id ? v : [...v, d.id!].slice(-20)));
      else setVerlauf([d.id]);
      try { window.history.replaceState(null, '', `/os/wissen?n=${encodeURIComponent(d.id)}`); } catch { /* egal */ }
    }
    lesefenster.current?.scrollTo?.({ top: 0 });
    if (!breit) window.scrollTo({ top: 0 });
  }, [breit]);

  const zurueck = () => {
    const v = verlauf.slice(0, -1);
    setVerlauf(v);
    if (v.length) void oeffne(v[v.length - 1], false).then(() => setVerlauf(v));
    else { setOffen(null); try { window.history.replaceState(null, '', '/os/wissen'); } catch { /* egal */ } }
  };

  const obsidianVault = stand?.wurzeln.find(w => w.id === 'make')?.obsidian;
  const segmente = [{ id: 'alle', label: 'Alle' }, ...BEREICHE.filter(b => stand?.jeBereich[b]).map(b => ({ id: b, label: b }))];
  const suchend = frage.trim().length >= 3;

  // ── Liste ──
  const listeKarte = (
    <Karte i={1}>
      <input
        value={frage} onChange={e => setFrage(e.target.value)} autoFocus
        placeholder="Suchen — Firma, Person, Vertrag, Begriff …" aria-label="Wissen durchsuchen"
        style={{ ...feld, fontSize: 16, padding: '13px 16px', marginBottom: 12 }}
      />
      <div style={{ overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
        <Segmente liste={segmente} aktiv={bereich} onWahl={setBereich} />
      </div>
      <Ueberschrift rechts={suchend && durchsucht !== null ? `${liste?.length ?? 0} von ${durchsucht}` : undefined}>
        {suchend ? 'Treffer' : 'Zuletzt geändert'}
      </Ueberschrift>
      {liste === null && <Leer>Lese dein Brain …</Leer>}
      {liste && !liste.length && <Leer>{suchend ? `Nichts zu „${frage.trim()}". Anderes Wort oder anderer Bereich?` : 'In diesem Bereich liegt nichts, das du sehen darfst.'}</Leer>}
      {liste && liste.length > 0 && (
        <div>
          {liste.map(e => {
            const aktiv = offen?.id === e.id;
            return (
              <button key={e.id} onClick={() => void oeffne(e.id)} className="zeile-klick" style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', font: 'inherit', color: C.ink,
                padding: '11px 8px', margin: '0 -8px', borderBottom: '1px solid rgba(255,255,255,.06)', borderRadius: aktiv ? 10 : 0,
                background: aktiv ? 'rgba(255,255,255,.06)' : 'transparent', boxSizing: 'content-box',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Punkt farbe={bereichFarbe(e.bereich)} groesse={8} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: TYP.body, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titel}</span>
                  {e.scope === 'privat' && <span title="privat — Jarvis nutzt das nie in Texten nach außen" style={{ fontSize: 12 }}>🔒</span>}
                  <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{e.stand ? `Stand ${standText(e.stand)}` : wann(e.geaendert)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 4, paddingLeft: 18, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45 }}>
                  {e.ausschnitt ?? `${e.bereich}${e.ueberschriften?.length ? ` · ${e.ueberschriften.slice(0, 3).join(' · ')}` : ''}`}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Karte>
  );

  // ── Lesefenster ──
  const leseKarte = offen ? (
    <Karte i={2} akzent={bereichFarbe(offen.bereich)}>
      {(verlauf.length > 1 || !breit) && (
        <button onClick={zurueck} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', font: 'inherit', fontSize: 13, padding: 0, marginBottom: 10 }}>← zurück</button>
      )}
      {!offen.ok ? <Leer>{offen.fehler ?? 'Nicht lesbar.'}</Leer> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <Chip farbe={bereichFarbe(offen.bereich)}>{offen.bereich}</Chip>
            {offen.typ && <Chip farbe={C.inkDim}>{offen.typ}</Chip>}
            {offen.scope === 'privat' && <Chip farbe={LEUCHT.beziehung}>🔒 privat</Chip>}
            {offen.scope && offen.scope !== 'privat' && <Chip farbe={C.inkDim}>{offen.scope}</Chip>}
            {offen.stand && <Chip farbe={C.inkDim}>{`Stand ${standText(offen.stand)}`}</Chip>}
          </div>
          <h2 style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(22px,2.4vw,28px)', fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 4px', lineHeight: 1.15, textWrap: 'balance' as never }}>{offen.titel}</h2>
          <div style={{ fontSize: 12.5, color: C.inkLeise, marginBottom: 16, wordBreak: 'break-word' }}>{`${offen.id?.replace(/^make\//, '').replace(/\.md$/, '')} · geändert ${wann(offen.geaendert)}`}</div>
          {offen.scope === 'privat' && (
            <div style={{ fontSize: 12.5, color: C.inkDim, background: `${LEUCHT.beziehung}14`, borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
              {'Privat nach deinen Vertraulichkeitsregeln: Jarvis nutzt das nur im Gespräch mit dir — nie in Mails, Entwürfen oder Briefings, und kein Agent bekommt es.'}
            </div>
          )}
          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: C.ink, maxWidth: '72ch' }}>
            {(() => {
              const alle = bloecke(offen.text ?? '');
              // Die erste Überschrift wiederholt meist nur den Dateinamen — der steht schon oben.
              const liste = alle[0]?.art === 'titel' && alle[0].text.trim().toLowerCase() === (offen.titel ?? '').trim().toLowerCase() ? alle.slice(1) : alle;
              const ersterStand = offen.oben ? liste.findIndex(b => b.art === 'titel' && b.text.startsWith('🔴')) : -1;
              return liste.map((b, i) => block(b, i, ziel => void oeffne(ziel), i === ersterStand));
            })()}
          </div>
          {offen.obsidian && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Knopf farbe={LEUCHT.agenten} onClick={() => { window.location.href = offen.obsidian!; }}>In Obsidian öffnen</Knopf>
            </div>
          )}
        </>
      )}
    </Karte>
  ) : (
    <Karte i={2} akzent={LEUCHT.agenten}>
      <Ueberschrift farbe={LEUCHT.agenten}>Dein Brain</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
        <Zahl wert={stand ? String(stand.notizen) : undefined} label="Notizen für dich" farbe={LEUCHT.agenten} />
        <Zahl wert={stand ? String(stand.jeWurzel.make ?? 0) : undefined} label="aus Obsidian" />
        <Zahl wert={stand ? String(stand.privat) : undefined} label="davon privat" farbe={LEUCHT.beziehung} />
      </div>
      <div style={{ display: 'grid', gap: 2, marginBottom: 12 }}>
        {BEREICHE.filter(b => stand?.jeBereich[b]).map(b => (
          <button key={b} onClick={() => setBereich(b)} className="zeile-klick" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', color: C.ink, font: 'inherit', cursor: 'pointer', padding: '8px 6px', margin: '0 -6px', boxSizing: 'content-box', textAlign: 'left' }}>
            <Punkt farbe={bereichFarbe(b)} groesse={8} />
            <span style={{ flex: 1, fontSize: TYP.body }}>{b}</span>
            <span style={{ fontSize: 13, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{stand?.jeBereich[b]}</span>
          </button>
        ))}
      </div>
      <Leer>
        {laedtNotiz ? 'Öffne …' : 'Links suchen oder stöbern, hier lesen. Jarvis sucht zuerst hier, bevor er etwas behauptet, und nennt dir die Quelle. Gepflegt wird in Obsidian — jede Notiz hat den Griff dorthin.'}
      </Leer>
    </Karte>
  );

  return (
    <Seite
      titel="Wissen"
      unter={stand ? `Dein Obsidian-Brain · ${stand.notizen} ${stand.notizen === 1 ? 'Notiz' : 'Notizen'} · Nummer eins für Jarvis` : 'Dein Obsidian-Brain · Nummer eins für Jarvis'}
      rechts={obsidianVault ? <Knopf leise onClick={() => { window.location.href = obsidianVault; }}>Obsidian öffnen</Knopf> : undefined}
    >
      {breit ? (
        <Spalten verhaeltnis="1:1">
          <Spalte>{listeKarte}</Spalte>
          <Spalte klebt><div ref={lesefenster}>{leseKarte}</div></Spalte>
        </Spalten>
      ) : offen ? leseKarte : (
        <>{listeKarte}{leseKarte}</>
      )}
    </Seite>
  );
}

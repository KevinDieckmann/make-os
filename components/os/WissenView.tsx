'use client';

// ─── MAKE OS — Wissen (24.09.) ──────────────────────────────────────────────
// Kevin: „kann meine Software jetzt auch auf Obsidian zugreifen?" — „ja mach
// das" — „Obsidian soll Nr. 1 Wissensbank sein."
//
// Links fragen, suchen oder stöbern, rechts lesen. „Fragen“ ist der Chat mit
// dem Brain (Kevin, 24.09.: „dass ich direkt mit dem Hirn chatten kann“) — er
// antwortet nur aus den Notizen, und jede Quelle öffnet sich rechts.
// Es ist dieselbe Suche, die Jarvis
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

interface Quelle { id: string; titel: string; bereich: string; scope?: string }
interface ChatZug { rolle: 'ich' | 'brain'; text: string; quellen?: Quelle[]; fehler?: boolean }
type Modus = 'fragen' | 'stoebern';
const MODI: { id: Modus; label: string }[] = [{ id: 'fragen', label: 'Fragen' }, { id: 'stoebern', label: 'Stöbern' }];
const CHAT_MERKER = 'make-os:brain-chat';
const VORSCHLAEGE = ['Was ist der aktuelle Ist-Stand?', 'Welche offenen Fragen stehen im Brain?', 'Was steht in den letzten Protokollen?', 'Wer ist wer im Team?'];

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

export function block(b: Block, i: number, oeffne: (ziel: string) => void, oben = false): ReactNode {
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
  const [modus, setModus] = useState<Modus>('fragen');
  const [chat, setChat] = useState<ChatZug[]>([]);
  const [eingabe, setEingabe] = useState('');
  const [denkt, setDenkt] = useState(false);
  const chatFenster = useRef<HTMLDivElement | null>(null);
  const letzteFrage = useRef<HTMLDivElement | null>(null);
  const eingabeFeld = useRef<HTMLTextAreaElement | null>(null);

  // Der Chat überlebt ein Neuladen im selben Tab, aber nicht das Schließen:
  // er enthält Inhalte aus dem Brain und soll nicht dauerhaft im Browser liegen.
  useEffect(() => {
    try { const roh = sessionStorage.getItem(CHAT_MERKER); if (roh) { const d = JSON.parse(roh); if (Array.isArray(d)) setChat(d.slice(-30)); } } catch { /* egal */ }
  }, []);
  // Gespeichert wird beim Ändern, nicht in einem Effekt — ein Effekt schriebe
  // beim ersten Zeichnen den leeren Chat zurück, bevor der gemerkte geladen ist.
  const merke = (c: ChatZug[]) => { try { sessionStorage.setItem(CHAT_MERKER, JSON.stringify(c.slice(-30))); } catch { /* egal */ } return c; };
  // Beim Warten ans Ende; kommt die Antwort, bleibt ihr Anfang samt Frage im Blick.
  useEffect(() => {
    const f = chatFenster.current;
    const frage = letzteFrage.current;
    if (!f) return;
    if (denkt || !frage || chat[chat.length - 1]?.rolle !== 'brain') { if (breit) f.scrollTop = f.scrollHeight; return; }
    if (breit) f.scrollTop = Math.max(0, frage.offsetTop - 8);
    else window.scrollTo({ top: frage.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
  }, [chat, denkt, breit]);
  useEffect(() => { if (breit && modus === 'fragen') eingabeFeld.current?.focus(); }, [breit, modus]);

  const fragen = async (text?: string) => {
    const f = (text ?? eingabe).trim();
    if (!f || denkt) return;
    const bisher = chat.filter(z => !z.fehler).map(z => ({ rolle: z.rolle, text: z.text }));
    setChat(c => merke([...c, { rolle: 'ich', text: f }]));
    setEingabe('');
    setDenkt(true);
    const d = await fetch('/api/jarvis/wissen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frage: f, verlauf: bisher }) })
      .then(r => r.json()).catch(() => ({ ok: false, fehler: 'Nicht erreichbar — läuft MAKE OS?' }));
    setDenkt(false);
    setChat(c => merke([...c, d.ok ? { rolle: 'brain', text: String(d.antwort ?? ''), quellen: Array.isArray(d.quellen) ? d.quellen : [] } : { rolle: 'brain', text: String(d.fehler ?? 'Keine Antwort.'), fehler: true, quellen: Array.isArray(d.quellen) ? d.quellen : [] }]));
  };
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

  const umschalter = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <Segmente liste={MODI} aktiv={modus} onWahl={setModus} />
      {modus === 'fragen' && chat.length > 0 && <Knopf leise onClick={() => setChat(merke([]))}>Neuer Chat</Knopf>}
    </div>
  );

  // ── Fragen: der Chat mit dem Brain ──
  const chatKarte = (
    <Karte i={1} akzent={LEUCHT.agenten}>
      {umschalter}
      <div ref={chatFenster} style={{ position: 'relative', maxHeight: breit ? 'calc(100vh - 420px)' : undefined, minHeight: breit ? 280 : 120, overflowY: breit ? 'auto' : undefined, display: 'grid', gap: 14, alignContent: 'start', paddingRight: breit ? 4 : 0, marginBottom: 14 }}>
        {!chat.length && (
          <div>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 6 }}>Frag dein Brain.</div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 14, maxWidth: '60ch' }}>
              {'Es sucht selbst in deinen Obsidian-Notizen, liest sie bei Bedarf ganz und antwortet nur daraus — mit Quelle. Was nicht drinsteht, sagt es dir. Ändern kann es nichts; dafür ist Jarvis da.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VORSCHLAEGE.map(v => (
                <button key={v} onClick={() => void fragen(v)} className="fassbar" style={{ border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, borderRadius: 999, padding: '8px 14px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>
          </div>
        )}
        {chat.map((z, i) => z.rolle === 'ich' ? (
          <div key={i} ref={i === chat.map(x => x.rolle).lastIndexOf('ich') ? letzteFrage : undefined} style={{ justifySelf: 'end', maxWidth: '85%', background: 'rgba(255,255,255,.08)', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: TYP.body, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{z.text}</div>
        ) : (
          <div key={i} className="os-auf" style={{ maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: z.fehler ? LEUCHT.achtung : LEUCHT.agenten, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              <Punkt farbe={z.fehler ? LEUCHT.achtung : LEUCHT.agenten} groesse={7} />Brain
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.6, color: z.fehler ? C.inkDim : C.ink }}>
              {z.fehler ? z.text : bloecke(z.text).map((b, j) => block(b, j, ziel => void oeffne(ziel)))}
            </div>
            {!!z.quellen?.length && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {z.quellen.map(q => (
                  <button key={q.id} onClick={() => void oeffne(q.id)} title={q.id} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', border: `1px solid ${offen?.id === q.id ? bereichFarbe(q.bereich) : 'rgba(255,255,255,.1)'}`, background: 'rgba(255,255,255,.03)', color: C.inkDim, borderRadius: 999, padding: '5px 11px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>
                    <Punkt farbe={bereichFarbe(q.bereich)} groesse={7} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.titel}</span>
                    {q.scope === 'privat' && <span aria-label="privat">🔒</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {denkt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.inkLeise, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {[0, 1, 2].map(k => <span key={k} className="denk-punkt" style={{ width: 6, height: 6, borderRadius: '50%', background: LEUCHT.agenten, animationDelay: `${k * 0.15}s` }} />)}
            </span>
            {'Das Brain sucht und liest …'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          ref={eingabeFeld} value={eingabe} rows={2} onChange={e => setEingabe(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void fragen(); } }}
          placeholder="Frag dein Brain — Firma, Person, Vereinbarung, Stand …" aria-label="Frage an das Brain"
          style={{ ...feld, resize: 'none', lineHeight: 1.45, fontSize: 15, minHeight: 50 }}
        />
        <Knopf farbe={LEUCHT.agenten} aus={denkt || !eingabe.trim()} onClick={() => void fragen()}>Fragen</Knopf>
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>{'Enter schickt, Umschalt+Enter macht eine neue Zeile. Der Chat bleibt nur, solange dieser Tab offen ist.'}</div>
    </Karte>
  );

  // ── Stöbern ──
  const listeKarte = (
    <Karte i={1}>
      {umschalter}
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
          <button key={b} onClick={() => { setBereich(b); setModus('stoebern'); }} className="zeile-klick" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', color: C.ink, font: 'inherit', cursor: 'pointer', padding: '8px 6px', margin: '0 -6px', boxSizing: 'content-box', textAlign: 'left' }}>
            <Punkt farbe={bereichFarbe(b)} groesse={8} />
            <span style={{ flex: 1, fontSize: TYP.body }}>{b}</span>
            <span style={{ fontSize: 13, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{stand?.jeBereich[b]}</span>
          </button>
        ))}
      </div>
      <Leer>
        {laedtNotiz ? 'Öffne …' : 'Links fragen oder stöbern, hier lesen. Jarvis sucht zuerst hier, bevor er etwas behauptet, und nennt dir die Quelle. Gepflegt wird in Obsidian — jede Notiz hat den Griff dorthin.'}
      </Leer>
    </Karte>
  );

  return (
    <Seite
      titel="Brain"
      unter={stand ? `Dein Obsidian-Brain · ${stand.notizen} ${stand.notizen === 1 ? 'Notiz' : 'Notizen'} · Nummer eins für Jarvis` : 'Dein Obsidian-Brain · Nummer eins für Jarvis'}
      rechts={obsidianVault ? <Knopf leise onClick={() => { window.location.href = obsidianVault; }}>Obsidian öffnen</Knopf> : undefined}
    >
      {breit ? (
        <Spalten verhaeltnis="1:1">
          <Spalte>{modus === 'fragen' ? chatKarte : listeKarte}</Spalte>
          <Spalte klebt><div ref={lesefenster}>{leseKarte}</div></Spalte>
        </Spalten>
      ) : offen ? leseKarte : (
        <>{modus === 'fragen' ? chatKarte : listeKarte}{leseKarte}</>
      )}
    </Seite>
  );
}

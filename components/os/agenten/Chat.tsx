'use client';

// ─── Agenten-Seite: der Chat — Verlauf, Verweise, Vorschläge, Feld (09.10., Paket 2) ───────────────────────────────────
// EIN Chat für ZOE, Heads und Mitarbeiter (AGENTEN_KONZEPT.md C2/C3, Recherche 3.3/3.4):
//   • Nachrichten der Person rechts, Agenten links mit Kürzel-Kugel, KI-Antworten mit <KiMarke /> (KI-VO Art. 50);
//   • „An Thread … gesendet ›“ als aufklappbare Delegations-Karte (Ziel · Format · Grenzen · Quellen — erst beim Aufklappen
//     geladen), „◂ Bericht aus Thread …“ als Verweis;
//   • Vorschläge, die ein Werkzeug in den Stapel gelegt hat, als Karte — dieselbe Entscheidung wie im Stapel, kein zweiter Weg;
//   • Daumen je Antwort (seit Paket 4b auf dem Server — Aktion `bewerten`, zählt in die Leistung des Heads; ohne Thread, z. B. im
//     ZOE-Chat über /api/kimmi, nur auf diesem Gerät), Vorlesen per Gerätestimme,
//     „Als Skill speichern“;
//   • das Feld: 16 px (kein Zoom am iPhone), Enter sendet, @Name spricht an (Chips), Mikro zum Diktieren (useStimme).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Mic, MicOff, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react';
import { FARBE as C, ECKE, FLAECHE_STIL, LEUCHT, RAND, SCHRIFT, TIEF, TYP, ABSTAND, MIKRO, ZIEL } from '@/lib/make-one/design';
import type { FadenKurz, HeadKarte, Nachricht } from '@/lib/agenten/typen';
import { useStimme } from '@/hooks/useStimme';
import { KiMarke } from '../KiMarke';
import { Chip, Knopf, Leer, SymbolKnopf, Wahl, eingabe, Eigenschaft, Schalter } from '../ui';
import { KuerzelKugel, ZoeStandbild, headFarbe } from './Avatar';
import { bewerten, ladeFaden, stapelEntscheiden, type StapelAntwort } from './daten';
import {
  absenderVon, agentAusSchluessel, delegationTeile, euroAusUsd, fadenStatusFarbe, fadenStatusName, risikoVon, RISIKO_NAME, zeitKurz,
  type Ansprechbar, type Risiko,
} from './regeln';
import { FELD_ZEILEN, KUGEL_GROESSE, NACHRICHT_MAX } from './masse';
import { useAgenten } from './kontext';
import { WEG } from '@/lib/wege';
import type { Abruf } from './daten';

const RISIKO_FARBE: Readonly<Record<Risiko, string>> = { risikoarm: LEUCHT.gut, intern: LEUCHT.achtung, aussen: LEUCHT.kritisch };

// ── Daumen (Fragerunde 17) — mit Thread auf dem Server (Paket 4b), sonst nur auf diesem Gerät ──────────────────────────────

const DAUMEN_MERKER = 'make-agenten-daumen';
function daumenLesen(): Record<string, 'hoch' | 'runter'> {
  try { const r = sessionStorage.getItem(DAUMEN_MERKER); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function Daumen({ id, fadenId, start }: { id: string; fadenId?: string; start?: 'hoch' | 'runter' }) {
  const { melde } = useAgenten();
  const [wert, setWert] = useState<'hoch' | 'runter' | null>(start ?? null);
  useEffect(() => { setWert(fadenId ? start ?? null : daumenLesen()[id] ?? null); }, [id, fadenId, start]);
  const setze = async (w: 'hoch' | 'runter') => {
    const neu = wert === w ? null : w;
    const vorher = wert;
    setWert(neu);
    if (fadenId) {
      const r = await bewerten(fadenId, id, neu);
      if (!r.ok) { setWert(vorher); melde(r.text, 'kritisch'); }
      return;
    }
    try { const alle = daumenLesen(); if (neu) alle[id] = neu; else delete alle[id]; sessionStorage.setItem(DAUMEN_MERKER, JSON.stringify(alle)); } catch { /* egal */ }
  };
  return (
    <span className="ui-symbole" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <SymbolKnopf ariaLabel={wert === 'hoch' ? 'Daumen hoch zurücknehmen' : 'Hilfreich (Daumen hoch)'} onClick={() => setze('hoch')}>
        <ThumbsUp size={16} color={wert === 'hoch' ? LEUCHT.gut : undefined} />
      </SymbolKnopf>
      <SymbolKnopf ariaLabel={wert === 'runter' ? 'Daumen runter zurücknehmen' : 'Nicht hilfreich (Daumen runter)'} onClick={() => setze('runter')}>
        <ThumbsDown size={16} color={wert === 'runter' ? LEUCHT.achtung : undefined} />
      </SymbolKnopf>
    </span>
  );
}

// ── Vorschlag aus dem Stapel als Karte im Chat ───────────────────────────────────────────────────────────────────────────

export function VorschlagKarte({ vorschlagId, stapel }: { vorschlagId?: string; /** Name des Werkzeugs (nur für Schlüssel/Tests, nie als Text). */ werkzeug: string; stapel: Abruf<StapelAntwort> }) {
  const { melde, bestaetigen } = useAgenten();
  const v = stapel.zustand === 'da' ? stapel.daten.vorschlaege.find(x => x.id === vorschlagId) : undefined;
  const [weg, setWeg] = useState<string | null>(null);
  const risiko: Risiko = v ? risikoVon(v) : 'intern';
  const entscheide = async (entscheidung: 'freigeben' | 'ablehnen') => {
    if (!v) return;
    if (entscheidung === 'ablehnen' && !(await bestaetigen({ titel: 'Vorschlag ablehnen?', text: `„${v.titel}“${v.nachher ? ` (${v.nachher.slice(0, 120)})` : ''} wird nicht ausgeführt.`, ja: 'Ablehnen', gefahr: true }))) return;
    const r = await stapelEntscheiden({ id: v.id, entscheidung });
    if (r.ok) { setWeg(entscheidung === 'freigeben' ? 'Freigegeben.' : 'Abgelehnt.'); melde(entscheidung === 'freigeben' ? `„${v.titel}“ freigegeben.` : `„${v.titel}“ abgelehnt.`, 'gut'); }
    else melde(r.text, 'kritisch');
  };
  return (
    <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: `${ABSTAND.m}px ${ABSTAND.l}px`, display: 'grid', gap: ABSTAND.s, borderColor: TIEF.rand(RISIKO_FARBE[risiko]) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        <span style={{ ...MIKRO }}>Vorschlag</span>
        <Chip farbe={RISIKO_FARBE[risiko]}>{RISIKO_NAME[risiko]}</Chip>
      </div>
      {/* Ohne Eintrag im offenen Stapel: schon entschieden (bzw. ein älterer Verweis ohne Kennung) — nie der Werkzeug-Name als Text (Rundgang 09.10.). */}
      <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.45 }}>{v ? v.titel : vorschlagId && stapel.zustand === 'da' ? 'Dieser Vorschlag ist schon entschieden — der Stand steht unter Freigaben.' : 'Ein Vorschlag liegt im Freigabe-Stapel.'}</div>
      {v?.nachher && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{v.nachher}</div>}
      {weg ? <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>{weg}</div> : (
        <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
          {v && risiko !== 'aussen' && <Knopf onClick={() => entscheide('freigeben')}>Freigeben</Knopf>}
          {v && <Knopf leise onClick={() => entscheide('ablehnen')}>Ablehnen</Knopf>}
          <Knopf leise href={WEG.freigaben()}>Ansehen ›</Knopf>
        </div>
      )}
    </div>
  );
}

// ── Verweise: „An Thread … gesendet“ (aufklappbare Delegation) und „Bericht aus Thread …“ ───────────────────────────────

function DelegationInhalt({ fadenId }: { fadenId: string }) {
  const [stand, setStand] = useState<{ text: string | null; laedt: boolean; kommt?: boolean }>({ text: null, laedt: true });
  useEffect(() => {
    let lebt = true;
    void ladeFaden(fadenId).then(a => {
      if (!lebt) return;
      if (a.zustand === 'da') {
        const auftrag = a.daten.faden.nachrichten.find(n => n.rolle === 'agent' && agentAusSchluessel(n.von)?.art === 'head');
        setStand({ text: auftrag?.text ?? null, laedt: false });
      } else setStand({ text: null, laedt: false, kommt: a.zustand === 'kommt' });
    });
    return () => { lebt = false; };
  }, [fadenId]);
  if (stand.laedt) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Auftrag wird geladen …</div>;
  const d = stand.text ? delegationTeile(stand.text) : null;
  if (!d) return <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{stand.text ?? (stand.kommt ? 'Den Auftrag zeigt der Thread, sobald der Agenten-Kern läuft.' : 'Der Auftrag steht im Thread.')}</div>;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.xs }}>
      {d.ziel && <Eigenschaft label="Ziel">{d.ziel}</Eigenschaft>}
      {d.format && <Eigenschaft label="Format">{d.format}</Eigenschaft>}
      {d.grenzen && <Eigenschaft label="Grenzen">{d.grenzen}</Eigenschaft>}
      {d.quellen && <Eigenschaft label="Quellen">{d.quellen}</Eigenschaft>}
    </div>
  );
}

export function VerweisKarte({ n, kind, startOffen }: { n: Nachricht; kind?: FadenKurz; startOffen?: boolean }) {
  const { oeffne, agenten } = useAgenten();
  const [offen, setOffen] = useState(!!startOffen);
  const v = n.verweis!;
  const titel = v.titel ?? kind?.titel ?? 'Thread';
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const kindHead = kind && kind.agent.art !== 'zoe' ? heads.find(h => h.id === (kind.agent as { headId: string }).headId) : undefined;
  const wer = kind?.agent.art === 'mitarbeiter' ? kindHead?.mitarbeiter.find(m => m.id === (kind.agent as { mitarbeiterId: string }).mitarbeiterId)?.name
    : kind?.agent.art === 'head' ? kindHead?.name : undefined;
  if (v.art === 'bericht') {
    const inhalt = n.text.includes(':') ? n.text.slice(n.text.indexOf(':') + 1).trim() : n.text;
    return (
      <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: `${ABSTAND.m}px ${ABSTAND.l}px`, display: 'grid', gap: ABSTAND.s, borderLeft: `3px solid ${TIEF.rand(LEUCHT.gut)}` }}>
        <div style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink }}>◂ Bericht aus Thread „{titel}“ {kind && <Chip farbe={kind.status === 'fehler' ? LEUCHT.kritisch : LEUCHT.gut}>{fadenStatusName(kind)}</Chip>}</div>
        <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{inhalt}</div>
        <div><Knopf leise onClick={() => oeffne({ f: v.fadenId })}>Thread öffnen ›</Knopf></div>
      </div>
    );
  }
  return (
    <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} className="fassbar"
        style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, width: '100%', minHeight: ZIEL.handy, padding: `${ABSTAND.s}px ${ABSTAND.l}px`, border: 'none', background: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
        {offen ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        <span style={{ flex: 1, minWidth: 0 }}>An {wer ? `„${wer}“` : 'Thread'} gesendet · „{titel}“</span>
        {kind && <Chip farbe={fadenStatusFarbe(kind) === 'laeuft' ? C.aktiv : kind.status === 'fehler' ? LEUCHT.kritisch : kind.status === 'wartet' ? LEUCHT.achtung : LEUCHT.gut}>{fadenStatusName(kind)}</Chip>}
      </button>
      {offen && (
        <div style={{ padding: `0 ${ABSTAND.l}px ${ABSTAND.m}px`, display: 'grid', gap: ABSTAND.s }}>
          <DelegationInhalt fadenId={v.fadenId} />
          <div><Knopf leise onClick={() => oeffne({ f: v.fadenId })}>Thread öffnen ›</Knopf></div>
        </div>
      )}
    </div>
  );
}

// ── Der Verlauf ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function ChatVerlauf({ nachrichten, kinder = [], stapel, leer, ichName = 'Du', onAlsSkill, unten, fadenId }: {
  nachrichten: readonly Nachricht[];
  /** Eigener Thread (Paket 4b): Daumen gehen an den Server (`bewerten`); ohne (ZOE über /api/kimmi, geteilte Threads) nur auf dem Gerät. */
  fadenId?: string;
  /** Kinder-Threads (Status an der Delegations-Karte). */
  kinder?: readonly FadenKurz[];
  stapel: Abruf<StapelAntwort>;
  /** Was ohne Nachricht steht. */
  leer: ReactNode;
  ichName?: string;
  /** „Als Skill speichern“ aus einer Antwort (Antwort 7). */
  onAlsSkill?: (n: Nachricht) => void;
  /** Platz für „schreibt …“. */
  unten?: ReactNode;
}) {
  const { agenten, jetzt } = useAgenten();
  const kurs = agenten.zustand === 'da' ? agenten.daten.kurs : undefined;
  const heads: HeadKarte[] = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const stimme = useStimme(() => { /* hier wird nur vorgelesen */ });
  const ende = useZurNeuesten(nachrichten.length + (unten ? 1 : 0));
  if (!nachrichten.length) return <div style={{ display: 'grid', gap: ABSTAND.m }}>{leer}{unten}<span ref={ende} aria-hidden style={ENDE_ANKER} /></div>;
  return (
    <ol aria-label="Verlauf" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: ABSTAND.l }}>
      {nachrichten.map(n => {
        if (n.rolle === 'system') {
          if (n.verweis) return <li key={n.id} style={{ display: 'grid', gap: ABSTAND.xs }}><VerweisKarte n={n} kind={kinder.find(k => k.id === n.verweis!.fadenId)} />{n.verweis.art === 'bericht' && fadenId && <Daumen id={n.id} fadenId={fadenId} start={n.daumen?.wert} />}</li>;
          return <li key={n.id} style={{ textAlign: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>{n.text} · {zeitKurz(n.zeit, jetzt)}</li>;
        }
        if (n.rolle === 'person') {
          return (
            <li key={n.id} style={{ display: 'grid', justifyItems: 'end', gap: ABSTAND.xs }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{ichName} · {zeitKurz(n.zeit, jetzt)}</span>
              <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: `${ABSTAND.s + 2}px ${ABSTAND.l}px`, maxWidth: `min(${NACHRICHT_MAX}px, 92%)`, fontSize: TYP.body, lineHeight: 1.5, color: C.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
            </li>
          );
        }
        const ab = absenderVon(n.von, heads);
        const farbe = headFarbe(ab?.farbe);
        const gestapelt = (n.werkzeuge ?? []).filter(w => w.gestapelt);
        return (
          <li key={n.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: ABSTAND.m, alignItems: 'start' }}>
            {ab?.art === 'zoe' ? <ZoeStandbild groesse={KUGEL_GROESSE.klein} /> : <KuerzelKugel name={ab?.name ?? '?'} farbe={farbe} bereich={ab?.bereich} groesse={KUGEL_GROESSE.klein} />}
            <div style={{ display: 'grid', gap: ABSTAND.s, minWidth: 0, maxWidth: NACHRICHT_MAX }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}><b style={{ color: C.inkDim }}>{ab?.name ?? 'Agent'}</b> · {zeitKurz(n.zeit, jetzt)}{n.kosten ? ` · ${euroAusUsd(n.kosten.cent, kurs)}` : ''}</span>
              <div style={{ fontSize: TYP.body, lineHeight: 1.55, color: C.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
              {!!n.werkzeuge?.length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: ABSTAND.xs }} aria-label="Benutzte Werkzeuge">
                  {n.werkzeuge.filter(w => !w.gestapelt).map((w, i) => <Chip key={`${w.name}-${i}`} farbe={w.ok ? C.inkDim : LEUCHT.kritisch}>{w.name} {w.ok ? '✓' : '✕'}</Chip>)}
                </div>
              )}
              {gestapelt.map((w, i) => <VorschlagKarte key={w.vorschlagId ?? `${w.name}-${i}`} vorschlagId={w.vorschlagId} werkzeug={w.name} stapel={stapel} />)}
              <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
                {n.ki && <KiMarke text="KI-Antwort — bitte prüfen" />}
                <Daumen id={n.id} fadenId={fadenId} start={n.daumen?.wert} />
                {stimme.kannSprechen && (
                  <SymbolKnopf ariaLabel="Vorlesen" onClick={() => (stimme.spricht ? stimme.schweig() : stimme.lies(n.text))}><Volume2 size={16} /></SymbolKnopf>
                )}
                {onAlsSkill && ab?.art !== 'zoe' && <Knopf leise onClick={() => onAlsSkill(n)}>Als Skill speichern</Knopf>}
              </div>
            </div>
          </li>
        );
      })}
      {unten && <li>{unten}</li>}
      <li aria-hidden ref={ende} style={ENDE_ANKER} />
    </ol>
  );
}

/**
 * Rundgang 09.10. („Agenten live“): neue Nachrichten und der entstehende Text standen UNTER dem klebenden Eingabefeld — man sah die Antwort nicht,
 * ohne selbst zu scrollen. Ändert sich die Zahl der Einträge (eigene Nachricht, „schreibt …“, Antwort), rückt das Ende des Verlaufs in Sicht —
 * nie beim ersten Anzeigen (dann bleibt der Überblick oben), und ohne Animation bei reduzierter Bewegung. Der Rand unten hält Platz fürs Feld frei.
 */
/** Wie viel Platz das klebende Feld unten braucht (Ansprech-Chips + Feld + Knöpfe) — Abstand für „in Sicht scrollen“. */
const FELD_PLATZ = 240;
const ENDE_ANKER: CSSProperties = { display: 'block', height: 1, scrollMarginBottom: FELD_PLATZ };
function useZurNeuesten(zahl: number) {
  const ref = useRef<HTMLElement | null>(null);
  const vorher = useRef<number | null>(null);
  useEffect(() => {
    const alt = vorher.current;
    vorher.current = zahl;
    if (alt === null || zahl <= alt) return;
    const ruhig = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'end', behavior: ruhig ? 'auto' : 'smooth' });
  }, [zahl]);
  return (el: HTMLElement | null) => { ref.current = el; };
}


/**
 * „ZOE schreibt …“ während einer Antwort — mit Streaming (09.10.) der Text, während er entsteht, und „ruft … auf“, solange ein Werkzeug
 * läuft. Kein Tipp-Effekt (auch nicht bei reduzierter Bewegung nötig): der Text wird nur angehängt; vorgelesen wird nur die Statuszeile.
 */
export function Schreibt({ name, entsteht }: { name: string; entsteht?: { text: string; werkzeug: string | null } }) {
  const status = entsteht?.werkzeug ? `${name} ruft ${entsteht.werkzeug} auf …` : `${name} schreibt …`;
  const unten = useRef<HTMLDivElement>(null);
  const laenge = entsteht?.text.length ?? 0;
  // Der entstehende Text wächst nach unten — die Statuszeile bleibt über dem Feld in Sicht (nur, wenn sie darunter verschwände).
  useEffect(() => {
    const el = unten.current;
    if (!el || typeof window === 'undefined') return;
    if (el.getBoundingClientRect().bottom > window.innerHeight - FELD_PLATZ) el.scrollIntoView({ block: 'end' });
  }, [laenge]);
  if (!entsteht?.text) return <div ref={unten} role="status" aria-live="polite" style={{ fontSize: TYP.bedien, color: C.inkLeise, scrollMarginBottom: FELD_PLATZ }}>{status}</div>;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.xs, maxWidth: NACHRICHT_MAX }}>
      <div style={{ fontSize: TYP.body, lineHeight: 1.55, color: C.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entsteht.text}</div>
      <div ref={unten} role="status" aria-live="polite" style={{ fontSize: TYP.bedien, color: C.inkLeise, scrollMarginBottom: FELD_PLATZ }}>{status}</div>
    </div>
  );
}

// ── Das Feld ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function ChatFeld({ platzhalter, ansprechbar = [], onSenden, laeuft, aus, ausText, vorlesen, zusatz, unten }: {
  platzhalter: string;
  /** Wen man per @ ansprechen kann (Chips). */
  ansprechbar?: readonly Ansprechbar[];
  onSenden: (text: string) => Promise<boolean | void> | boolean | void;
  laeuft?: boolean;
  aus?: boolean;
  /** Warum gerade nicht gesendet werden kann (ruhiger Satz statt eines Fehlers). */
  ausText?: string;
  vorlesen?: { an: boolean; umschalten: (v: boolean) => void };
  /** Weitere Knöpfe neben dem Feld (z. B. „Zweite Meinung“). */
  zusatz?: ReactNode;
  /** Abstand zum unteren Rand (Handy: über den Reitern). */
  unten?: string;
}) {
  const [text, setText] = useState('');
  const feld = useRef<HTMLTextAreaElement>(null);
  const stimme = useStimme(t => setText(v => (v.trim() ? `${v.trim()} ${t}` : t)));
  const vorschlag = text.startsWith('@') && !/\s/.test(text.slice(1))
    ? ansprechbar.filter(a => a.name.toLowerCase().startsWith(text.slice(1).toLowerCase()))
    : [];
  const ansprechen = (a: Ansprechbar) => {
    setText(v => `@${a.name} ${v.replace(/^@\S*\s?/, '')}`);
    feld.current?.focus();
  };
  const los = async () => {
    const t = text.trim();
    if (!t || laeuft || aus) return;
    const ok = await onSenden(t);
    if (ok !== false) setText('');
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void los(); }} aria-label="Nachricht"
      style={{ position: 'sticky', bottom: unten ?? 0, zIndex: 5, display: 'grid', gap: ABSTAND.s, padding: `${ABSTAND.m}px 0 ${ABSTAND.s}px`,
        // Deckend bis auf den oberen Rand (Rundgang 09.10.: vorher war das obere Fünftel durchsichtig — der Verlauf schien durch die Ansprech-Chips).
        background: `linear-gradient(to top, ${C.grund} calc(100% - ${ABSTAND.m}px), transparent)` }}>
      {(vorschlag.length ? vorschlag : ansprechbar).length > 0 && (
        <div className="ui-pillen ui-pillen-einzeilig" aria-label="Ansprechen">
          {(vorschlag.length ? vorschlag : ansprechbar).map(a => (
            <Wahl key={`${a.art}-${a.id}`} klein an={text.toLowerCase().startsWith(`@${a.name.toLowerCase()}`)} onClick={() => ansprechen(a)}>@{a.name}</Wahl>
          ))}
        </div>
      )}
      {aus && ausText && <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{ausText}</div>}
      <textarea ref={feld} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void los(); } }}
        placeholder={platzhalter} aria-label={platzhalter} rows={FELD_ZEILEN} disabled={aus}
        style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5, minHeight: ZIEL.haupt * 2, borderRadius: ECKE.knopf }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        {stimme.kannHoeren && (
          <SymbolKnopf ariaLabel={stimme.hoert ? 'Diktat beenden' : 'Diktieren'} onClick={() => (stimme.hoert ? stimme.hoerAuf() : stimme.hoerZu())}>
            {stimme.hoert ? <MicOff size={18} color={LEUCHT.kritisch} /> : <Mic size={18} />}
          </SymbolKnopf>
        )}
        {vorlesen && stimme.kannSprechen && <Schalter an={vorlesen.an} onChange={vorlesen.umschalten}>Vorlesen</Schalter>}
        {stimme.hoert && <span role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>Hört zu{stimme.teil ? `: „${stimme.teil}“` : ' …'}</span>}
        {stimme.fehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{stimme.fehler}</span>}
        <span style={{ flex: 1 }} />
        {zusatz}
        <Knopf haupt typ="submit" aus={aus || laeuft || !text.trim()}>{laeuft ? 'Wartet …' : 'Senden'}</Knopf>
      </div>
    </form>
  );
}

/** Kleiner Leerzustand im Chat. */
export function ChatLeer({ children }: { children: ReactNode }) {
  return <Leer>{children}</Leer>;
}

/** Trennlinie mit Beschriftung im Verlauf (z. B. „Ältere Threads“). */
export function Trenner({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, ...MIKRO }}>
      <span style={{ flex: 1, height: 1, background: RAND.haar }} />{children}<span style={{ flex: 1, height: 1, background: RAND.haar }} />
    </div>
  );
}

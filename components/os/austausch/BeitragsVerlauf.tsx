'use client';
// ─── Austausch: Verlauf mit @-Erwähnung (30.09., verallgemeinert aus den Kommentaren der Aufgaben) ─
// EIN Bauteil für Kommentare an Aufgaben (AufgabeDetail) und den Verlauf am Meilenstein (MeilensteinDetail):
// Liste mit Person + Zeit, @-Erwähnungen hervorgehoben, Vorschläge beim Tippen von „@“, ⌘/Strg + Enter sendet,
// eigene Beiträge weich entfernen („entfernt“ bleibt sichtbar). Optional (Meilenstein): Antworten, eigene bearbeiten,
// ZOE-Beiträge gekennzeichnet. Namen kommen aus dem Team (nie im Code). Gespeichert wird beim Aufrufer.

import { useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Knopf, feld } from '../ui';
import { erwaehnungen } from '@/lib/aufgaben/struktur';

export interface Beitrag {
  id: string; von: string; text: string; am: string;
  erwaehnt?: string[]; entfernt?: { am: string; von: string };
  antwortAuf?: string; bearbeitetAm?: string; zoe?: true;
}
export interface BeitragPerson { speicher: string; name: string; namen: string[] }

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const leise: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, fontFamily: SCHRIFT.text, padding: '2px 4px', minHeight: 28 };
const zeit = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function MitErwaehnung({ text, personen }: { text: string; personen: readonly BeitragPerson[] }) {
  return <>{text.split(/(@[\p{L}\p{N}_-]+)/u).map((s, n) => (s.startsWith('@') && erwaehnungen(s, personen).length ? <b key={n} style={{ color: C.aktiv, fontWeight: 600 }}>{s}</b> : <span key={n}>{s}</span>))}</>;
}

export function BeitragsVerlauf({ liste, ich, personen, titel = 'Kommentare', platzhalter = 'Kommentar … @ erwähnt jemanden (⌘ + Enter sendet)', leer, onSenden, onEntfernen, onBearbeiten, antworten = false, entferntText = 'Kommentar entfernt', beschaeftigt = false }: {
  liste: readonly Beitrag[];
  ich: string;
  personen: readonly BeitragPerson[];
  titel?: string;
  platzhalter?: string;
  leer?: string;
  onSenden: (text: string, antwortAuf?: string) => unknown;
  onEntfernen: (id: string) => unknown;
  /** Eigene Beiträge bearbeiten (Meilenstein) — ohne: nur weich entfernen (Aufgaben). */
  onBearbeiten?: (id: string, text: string) => unknown;
  /** Auf einen Beitrag antworten (Meilenstein). */
  antworten?: boolean;
  entferntText?: string;
  beschaeftigt?: boolean;
}) {
  const [text, setText] = useState('');
  const [antwort, setAntwort] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState<{ id: string; text: string } | null>(null);
  const feldRef = useRef<HTMLTextAreaElement>(null);
  /** Nach dem Antippen eines Vorschlags weiter tippen können — Fokus zurück, Schreibmarke ans Ende. */
  const zurueckInsFeld = () => setTimeout(() => { const f = feldRef.current; if (!f) return; f.focus(); f.setSelectionRange(f.value.length, f.value.length); }, 0);
  // Angefangenes @-Wort am Ende → Vorschläge zum Antippen.
  const angefangen = /(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(text)?.[2]?.toLocaleLowerCase('de-DE');
  const vorschlaege = angefangen !== undefined ? personen.filter(p => p.speicher !== ich && p.namen.some(n => n.toLocaleLowerCase('de-DE').startsWith(angefangen))) : [];
  const name = (s: string) => personen.find(p => p.speicher === s)?.name ?? s;
  const nachId = new Map(liste.map(b => [b.id, b]));
  const sichtbar = liste.filter(k => !k.entfernt).length;
  const senden = () => {
    const v = text.trim();
    if (!v || !ich || beschaeftigt) return;
    void onSenden(v, antwort ?? undefined);
    setText(''); setAntwort(null);
  };
  return (
    <div>
      <div style={{ ...mikro, marginBottom: 6 }}>{titel}{sichtbar ? ` · ${sichtbar}` : ''}</div>
      {!liste.length && leer && <div style={{ fontSize: TYP.bedien, color: C.inkDim, padding: '6px 0' }}>{leer}</div>}
      {liste.map(k => {
        const bezug = k.antwortAuf ? nachId.get(k.antwortAuf) : undefined;
        const eigen = k.von === ich && !k.entfernt;
        return (
          <div key={k.id} id={`beitrag-${k.id}`} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', ...(k.zoe ? { borderLeft: `2px solid ${LEUCHT.agenten}`, paddingLeft: 10 } : {}) }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkLeise }}>
              {k.zoe ? <b style={{ color: LEUCHT.agenten, fontWeight: 700 }}>ZOE</b> : <b style={{ color: C.inkDim, fontWeight: 600 }}>{name(k.von)}</b>}
              {k.zoe && <span>für {name(k.von)} · Vorschlag, nichts ist angelegt</span>}
              <span>{zeit(k.am)}</span>
              {k.bearbeitetAm && !k.entfernt && <span title={`bearbeitet ${zeit(k.bearbeitetAm)}`}>· bearbeitet</span>}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 2 }}>
                {antworten && !k.entfernt && <button onClick={() => { setAntwort(k.id); zurueckInsFeld(); }} style={leise}>antworten</button>}
                {eigen && onBearbeiten && !k.zoe && <button onClick={() => setBearbeite({ id: k.id, text: k.text })} style={leise}>bearbeiten</button>}
                {eigen && <button onClick={() => { void onEntfernen(k.id); }} style={leise}>entfernen</button>}
              </span>
            </div>
            {bezug && (
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, borderLeft: '2px solid rgba(255,255,255,.12)', paddingLeft: 8, margin: '4px 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ↳ {bezug.zoe ? 'ZOE' : name(bezug.von)}: {bezug.entfernt ? '(entfernt)' : bezug.text}
              </div>
            )}
            {k.entfernt ? <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontStyle: 'italic', marginTop: 3 }}>{entferntText}</div>
              : bearbeite?.id === k.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
                  <textarea autoFocus value={bearbeite.text} onChange={e => setBearbeite({ id: k.id, text: e.target.value })} rows={2} aria-label="Nachricht bearbeiten"
                    onKeyDown={e => { if (e.key === 'Escape') setBearbeite(null); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && bearbeite.text.trim()) { e.preventDefault(); void onBearbeiten?.(k.id, bearbeite.text.trim()); setBearbeite(null); } }}
                    style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical', flex: '1 1 200px', minWidth: 0, width: 'auto', padding: '8px 12px' }} />
                  <Knopf onClick={() => { if (bearbeite.text.trim()) { void onBearbeiten?.(k.id, bearbeite.text.trim()); setBearbeite(null); } }} aus={!bearbeite.text.trim()}>Speichern</Knopf>
                  <Knopf leise onClick={() => setBearbeite(null)}>Abbrechen</Knopf>
                </div>
              ) : <div style={{ fontSize: TYP.bedien, color: C.ink, whiteSpace: 'pre-wrap', marginTop: 3, lineHeight: 1.5, overflowWrap: 'anywhere' }}><MitErwaehnung text={k.text} personen={personen} /></div>}
          </div>
        );
      })}
      {antwort && nachId.get(antwort) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Antwort an {nachId.get(antwort)!.zoe ? 'ZOE' : name(nachId.get(antwort)!.von)}</span>
          <button onClick={() => setAntwort(null)} style={leise} aria-label="Antwort abbrechen">×</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
        <textarea ref={feldRef} value={text} onChange={e => setText(e.target.value)} rows={2} aria-label={titel}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); senden(); } }}
          placeholder={platzhalter} style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical', flex: 1, minWidth: 0, width: 'auto', padding: '8px 12px' }} />
        <Knopf onClick={senden} aus={!text.trim() || !ich || beschaeftigt}>Senden</Knopf>
      </div>
      {vorschlaege.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {vorschlaege.map(p => (
            <button key={p.speicher} onClick={() => { setText(x => x.replace(/@([\p{L}\p{N}_-]*)$/u, `@${p.name} `)); zurueckInsFeld(); }} className="fassbar"
              style={{ border: `1px solid ${C.aktiv}66`, background: `${C.aktiv}14`, color: C.aktiv, borderRadius: 999, padding: '3px 10px', fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>@{p.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

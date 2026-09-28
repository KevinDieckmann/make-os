'use client';
// ─── Notiz an Projekt und Aufgabe (28.09. spät) ─────────────────────────────
// Kevin: „Notizen — formatierbar, Checklisten, Links.“ Bearbeiten als Text (kleine Markdown-Teilmenge, Regeln in
// lib/aufgaben/notiz.ts), Vorschau mit React-Elementen — nie dangerouslySetInnerHTML. Checklisten sind in der Vorschau
// abhakbar. Interne Links über next/link, externe öffnen in einem neuen Fenster.

import Link from 'next/link';
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Haken, Knopf, feld } from '../schlank';
import { notizBloecke, checkUmschalten, checkStand, type Inline } from '@/lib/aufgaben/notiz';
import { useEntwurf } from './useEntwurf';

function Zeilen({ teile }: { teile: Inline[] }): ReactNode {
  return teile.map((t, i) => {
    switch (t.art) {
      case 'text': return <Fragment key={i}>{t.text.split('\n').map((z, n) => (n ? <Fragment key={n}><br />{z}</Fragment> : z))}</Fragment>;
      case 'fett': return <b key={i} style={{ fontWeight: 700, color: C.ink }}><Zeilen teile={t.kinder} /></b>;
      case 'kursiv': return <i key={i}><Zeilen teile={t.kinder} /></i>;
      case 'code': return <code key={i} style={{ fontFamily: SCHRIFT.mono, fontSize: '.92em', background: 'rgba(255,255,255,.07)', borderRadius: 5, padding: '1px 5px' }}>{t.text}</code>;
      case 'link': return t.intern
        ? <Link key={i} href={t.href} style={{ color: C.aktiv, textDecoration: 'none' }}>{t.text}</Link>
        : <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv }}>{t.text}</a>;
    }
  });
}

/** Die Notiz gerendert. `onText` (optional) macht Checklisten abhakbar. */
export function NotizAnzeige({ text, onText, leer = 'Noch keine Notiz.' }: { text?: string; onText?: (neu: string) => void; leer?: string }) {
  const bloecke = notizBloecke(text);
  if (!bloecke.length) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{leer}</div>;
  const h: Record<1 | 2 | 3, CSSProperties> = {
    1: { fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, margin: '10px 0 4px' },
    2: { fontFamily: SCHRIFT.display, fontSize: 16, fontWeight: 700, margin: '10px 0 4px' },
    3: { fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkDim, margin: '10px 0 2px' },
  };
  return (
    <div style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien + 1, lineHeight: 1.6, color: C.ink, overflowWrap: 'anywhere' }}>
      {bloecke.map((b, i) => {
        if (b.art === 'ueberschrift') return <div key={i} role="heading" aria-level={b.stufe + 2} style={h[b.stufe]}><Zeilen teile={b.inhalt} /></div>;
        if (b.art === 'trenner') return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,.08)', margin: '10px 0' }} />;
        if (b.art === 'absatz') return <p key={i} style={{ margin: '6px 0' }}><Zeilen teile={b.inhalt} /></p>;
        const Liste = b.nummeriert ? 'ol' : 'ul';
        return (
          <Liste key={i} style={{ margin: '4px 0', paddingLeft: b.punkte.every(p => p.check !== null) ? 0 : 22, listStyle: b.punkte.every(p => p.check !== null) ? 'none' : undefined }}>
            {b.punkte.map(p => (
              <li key={p.zeile} style={{ display: p.check !== null ? 'flex' : 'list-item', gap: 10, alignItems: 'flex-start', padding: '2px 0' }}>
                {p.check !== null && (onText
                  ? <span style={{ marginTop: 1 }}><Haken an={p.check} onChange={() => onText(checkUmschalten(text ?? '', p.zeile))} /></span>
                  : <span aria-hidden style={{ color: p.check ? C.aktiv : C.inkLeise }}>{p.check ? '☑' : '☐'}</span>)}
                <span style={{ color: p.check ? C.inkLeise : C.ink, textDecoration: p.check ? 'line-through' : 'none' }}><Zeilen teile={p.inhalt} /></span>
              </li>
            ))}
          </Liste>
        );
      })}
    </div>
  );
}

const HILFE = '# Überschrift · **fett** · *kursiv* · - Liste · - [ ] Checkliste · [Text](https://…)';

/**
 * Notiz mit Vorschau und Bearbeiten. Seit 29.09. (A3) speichert sie von selbst: kurz nach dem Tippen, beim Verlassen des
 * Feldes und der Seite; jeder Stand liegt zusätzlich als Entwurf im Sitzungsspeicher, bis der Server ihn bestätigt
 * (`useEntwurf`). Abhaken in der Vorschau speichert sofort. `max` = Grenze des Servers (darüber: sichtbare Meldung, der
 * Text bleibt, gespeichert wird erst wieder unter der Grenze — nie gekürzt).
 */
export function NotizEditor({ wert, onSpeichern, max, zeile, feldName = 'notiz', platzhalter = 'Ziele, Absprachen, Checklisten, Links …' }: {
  wert?: string; onSpeichern: (neu: string | undefined) => void; max: number;
  /** Die Zeile (Aufgabe/Projekt), an der die Notiz hängt — Kennung des Entwurfs und Bestätigung durch den Server. */
  zeile: { liste: 'tasks' | 'projects'; id: string };
  feldName?: string;
  platzhalter?: string;
}) {
  const e = useEntwurf({ kennung: `${zeile.liste}:${zeile.id}:${feldName}`, zeile, wert, max, speichern: v => onSpeichern(v.trim() ? v : undefined) });
  const [bearbeiten, setBearbeiten] = useState(e.wiederhergestellt);
  const [startWert, setStartWert] = useState(wert ?? '');
  useEffect(() => { if (e.wiederhergestellt) setBearbeiten(true); }, [e.wiederhergestellt]);
  const oeffnen = () => { setStartWert(wert ?? ''); setBearbeiten(true); };
  const fertig = () => { e.jetzt(); if (!e.zuLang && !e.wiederhergestellt) setBearbeiten(false); };
  const stand = checkStand(wert);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        {stand.gesamt > 0 && !bearbeiten && <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>Checkliste {stand.fertig}/{stand.gesamt}</span>}
        {bearbeiten && !e.wiederhergestellt && <span style={{ fontSize: 12, color: e.zuLang ? '#FF5C5C' : C.inkLeise }}>{e.zuLang ? 'nicht gespeichert — zu lang' : e.ungespeichert ? 'speichert …' : 'gespeichert'}</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          {bearbeiten
            ? <>{e.text !== startWert && !e.wiederhergestellt && <Knopf leise onClick={() => { e.setText(startWert); }}>Änderungen zurücknehmen</Knopf>}<Knopf onClick={fertig} aus={e.zuLang || e.wiederhergestellt}>Fertig</Knopf></>
            : <Knopf leise onClick={oeffnen}>{wert ? 'Bearbeiten' : '+ Notiz'}</Knopf>}
        </span>
      </div>
      {bearbeiten && e.wiederhergestellt && (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: '#FFC93C', marginBottom: 8 }}>
          <span style={{ flex: 1 }}>Ungespeicherter Entwurf aus dieser Sitzung wiederhergestellt — er weicht vom gespeicherten Stand ab.</span>
          <Knopf leise onClick={() => { e.verwerfen(); setBearbeiten(false); }}>Verwerfen</Knopf>
          <Knopf onClick={e.uebernehmen} aus={e.zuLang}>Entwurf speichern</Knopf>
        </div>
      )}
      {bearbeiten ? (
        <>
          <textarea autoFocus value={e.text} onChange={x => e.setText(x.target.value)} onBlur={e.jetzt} aria-label="Notiz" placeholder={platzhalter}
            onKeyDown={x => { if (x.key === 'Enter' && (x.metaKey || x.ctrlKey)) { x.preventDefault(); fertig(); } if (x.key === 'Escape') fertig(); }}
            rows={10} style={{ ...feld, fontFamily: SCHRIFT.mono, fontSize: 13, lineHeight: 1.55, resize: 'vertical', minHeight: 180 }} />
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: e.zuLang ? '#FF5C5C' : C.inkLeise, marginTop: 6, flexWrap: 'wrap' }}>
            <span>{HILFE}</span>
            <span role={e.zuLang ? 'alert' : undefined} style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{e.zuLang ? `Zu lang — NICHT gespeichert: ${e.text.length.toLocaleString('de-DE')} von ${max.toLocaleString('de-DE')} Zeichen. Bitte kürzen oder aufteilen.` : 'speichert von selbst · ⌘ + Enter schließt'}</span>
          </div>
          {e.text.trim() && <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}><div style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 4 }}>Vorschau</div><NotizAnzeige text={e.text} /></div>}
        </>
      ) : (
        <NotizAnzeige text={wert} onText={t => onSpeichern(t)} leer="Noch keine Notiz — „+ Notiz“ legt eine an." />
      )}
    </div>
  );
}

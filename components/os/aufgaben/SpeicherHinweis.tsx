'use client';
// ─── Speicher-Hinweis der Aufgaben (29.09., A1/A4) — global, unten rechts ───
// Liegt im TasksProvider (Wurzel-Rahmen): gilt überall, wo Aufgaben geändert werden — Aufgaben-Seite, CRM-Kachel
// „Aufgaben“ (AufgabenAkte), Flächen, Heute. Zeigt nur, wenn etwas zu sagen ist:
//   · „Nicht gespeichert — wird erneut versucht“ (Netz weg, Neustart beim Hochladen, Sitzung abgelaufen) + „Jetzt“,
//   · abgelehnte Änderungen mit Grund (413/400/Kreis) — die Eingabe bleibt stehen; „Verwerfen“ nimmt den Serverstand,
//   · Konflikte: angezeigt wird die Fassung des Servers, die eigene bleibt als „Deine Fassung“ (übernehmen/kopieren).
// Die Logik liegt in context/TasksContext.tsx + lib/aufgaben/abgleich.ts.

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import type { SpeicherLage, Konflikt } from '@/context/TasksContext';
import { useRueckfrage } from '../ui';

const knopf = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '3px 10px', whiteSpace: 'nowrap' } as const;
const leise = { ...knopf, background: 'none', border: 'none', color: C.inkLeise } as const;

function Sekunden({ bis }: { bis?: number }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setJetzt(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!bis) return null;
  const s = Math.max(0, Math.round((bis - jetzt) / 1000));
  return <>{s ? ` (in ${s} s)` : ' (jetzt)'}</>;
}

export function SpeicherHinweis({ lage, onJetzt, onKonflikt, onAbgelehnt, fassungText }: {
  lage: SpeicherLage;
  onJetzt: () => void;
  onKonflikt: (schluessel: string, wie: 'meine' | 'schliessen') => void;
  onAbgelehnt: (schluessel: string, wie: 'verwerfen' | 'erneut') => void;
  fassungText: (z: Konflikt['meine']) => string;
}) {
  const [kopiert, setKopiert] = useState<string | null>(null);
  // Rückfrage „Verwerfen“ — neben dem Hinweis (nicht in der Live-Region), bleibt stehen, auch wenn der Hinweis verschwindet.
  const { bestaetigen, dialog } = useRueckfrage();
  const zeigen = lage.phase === 'wiederholen' || lage.phase === 'gesperrt' || (lage.phase === 'neuLaden' && lage.offen > 0) || lage.abgelehnt.length > 0 || lage.konflikte.length > 0;
  if (!zeigen) return <>{dialog}</>;
  const kopieren = async (k: Konflikt) => {
    try { await navigator.clipboard.writeText(fassungText(k.meine)); setKopiert(k.schluessel); setTimeout(() => setKopiert(null), 2000); } catch { /* Zwischenablage gesperrt */ }
  };
  return (
    <>
    <div role="status" aria-live="polite" style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 9999, width: 'min(420px, calc(100vw - 32px))', maxHeight: '60vh', overflowY: 'auto',
      display: 'grid', gap: 8, padding: 12, borderRadius: 14, background: C.flaecheHoch, border: `1px solid ${lage.abgelehnt.length || lage.konflikte.length ? LEUCHT.kritisch : LEUCHT.achtung}55`,
      boxShadow: '0 10px 30px rgba(0,0,0,.45)', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.45,
    }}>
      {lage.phase === 'wiederholen' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ flex: 1 }}><b style={{ color: LEUCHT.achtung }}>Nicht gespeichert</b> — wird erneut versucht<Sekunden bis={lage.naechsterVersuch} />. {lage.offen} Änderung{lage.offen === 1 ? '' : 'en'} offen{lage.grund ? ` · ${lage.grund}` : ''}.</span>
          <button onClick={onJetzt} style={knopf}>Jetzt</button>
        </div>
      )}
      {lage.phase === 'neuLaden' && lage.offen > 0 && (
        <div><b style={{ color: LEUCHT.achtung }}>{lage.offen} Aufgaben-Änderung{lage.offen === 1 ? '' : 'en'} nicht gespeichert</b> — MAKE OS wurde aktualisiert. Nach „Neu laden“ gehen sie erneut raus (in diesem Tab gemerkt).</div>
      )}
      {lage.phase === 'gesperrt' && <div><b style={{ color: LEUCHT.kritisch }}>Aufgaben nicht gespeichert</b> — {lage.grund ?? 'kein Zugang'}.</div>}
      {lage.abgelehnt.map(a => (
        <div key={a.schluessel} style={{ display: 'grid', gap: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <span><b style={{ color: LEUCHT.kritisch }}>„{a.titel}“ nicht gespeichert:</b> {a.grund} Deine Eingabe steht noch da — ändern und es geht erneut raus.</span>
          <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => onAbgelehnt(a.schluessel, 'erneut')} style={leise}>Erneut versuchen</button>
            <button onClick={async () => { if (await bestaetigen({ titel: `Deine Änderung an „${a.titel}“ verwerfen?`, text: 'Es gilt dann wieder der gespeicherte Stand.', ja: 'Verwerfen', gefahr: true })) onAbgelehnt(a.schluessel, 'verwerfen'); }} style={knopf}>Verwerfen</button>
          </span>
        </div>
      ))}
      {lage.konflikte.map(k => (
        <div key={k.schluessel} style={{ display: 'grid', gap: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <span><b style={{ color: LEUCHT.achtung }}>„{k.titel}“ {k.grund === 'inzwischen gelöscht' ? 'wurde inzwischen gelöscht' : 'wurde inzwischen von jemand anderem geändert'}</b> — angezeigt wird jetzt der gespeicherte Stand. Deine Fassung ist nicht verloren.</span>
          <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={() => onKonflikt(k.schluessel, 'schliessen')} style={leise}>Gespeicherten Stand behalten</button>
            <button onClick={() => void kopieren(k)} style={knopf}>{kopiert === k.schluessel ? 'Kopiert ✓' : 'Deine Fassung kopieren'}</button>
            <button onClick={() => onKonflikt(k.schluessel, 'meine')} style={{ ...knopf, borderColor: `${C.aktiv}66`, color: C.aktiv }}>Deine Fassung übernehmen</button>
          </span>
        </div>
      ))}
    </div>
    {dialog}
    </>
  );
}

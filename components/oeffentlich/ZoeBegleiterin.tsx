'use client';

// ─── Zoe-Begleiterin auf den öffentlichen Seiten (31.10., Website-Anbau) ──────────────────────────────────────────────────────────────
// Ein ruhiger Ring unten rechts. Antippen öffnet eine kleine Karte mit Zoes FESTEN Sätzen zum aktuellen Schritt
// (lib/oeffentlich/zoe-begleiterin-texte.ts) und den Wegen zum Erstgespräch (Buchungsseite) bzw. zum Kontaktformular.
// Kein Modellaufruf, kein Abruf, nichts gespeichert, nichts nach außen — reine Anzeige (Wächter tests/zoe-begleiterin.test.ts).
// Farben aus dem hellen Stil der öffentlichen Seiten (components/buchen/hell.ts). Esc schließt, Fokus bleibt bedienbar.

import { useEffect, useId, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { C, AKZENT, SCHRIFT } from '@/components/buchen/hell';
import { begleiterSaetze, WEGE_TEXT, type BegleiterOrt, type BegleiterSchritt } from '@/lib/oeffentlich/zoe-begleiterin-texte';

interface Props {
  ort: BegleiterOrt;
  schritt: BegleiterSchritt;
  marke: string;
  gastgeber: string;
  /** Pfad der Buchungsseite (`/buchen/<slug>`) — ohne: kein Termin-Weg. */
  erstgespraech?: string | null;
  /** Pfad des Kontaktformulars (`/anfrage`) — ohne: kein Nachrichten-Weg. */
  kontakt?: string | null;
}

const PFAD_OK = /^\/[a-z0-9/_-]{1,120}$/;

export function ZoeBegleiterin({ ort, schritt, marke, gastgeber, erstgespraech, kontakt }: Props) {
  const [offen, setOffen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setOffen(false); };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen]);

  const saetze = begleiterSaetze(ort, schritt, { marke, gastgeber });
  const termin = erstgespraech && PFAD_OK.test(erstgespraech) ? erstgespraech : null;
  const nachricht = kontakt && PFAD_OK.test(kontakt) ? kontakt : null;

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40, display: 'grid', justifyItems: 'end', gap: 10, fontFamily: SCHRIFT.text, maxWidth: 'calc(100vw - 32px)' }}>
      {offen && (
        <section id={id} role="dialog" aria-label="Zoe" style={{ width: 320, maxWidth: '100%', background: C.flaeche, color: C.ink, border: `1px solid ${C.linie}`, borderRadius: 12, padding: 16, display: 'grid', gap: 10, boxShadow: '0 12px 32px rgba(17, 19, 22, .12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ring gross={false} />
            <b style={{ fontSize: 14 }}>Zoe</b>
            <span style={{ fontSize: 12, color: C.inkDim }}>KI-Assistentin · feste Hinweise</span>
          </div>
          {saetze.map((s, i) => <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: i === 0 ? C.inkDim : C.ink }}>{s}</p>)}
          {(termin || nachricht) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {termin && <Link href={termin} style={weg(true)}>{WEGE_TEXT.erstgespraech}</Link>}
              {nachricht && <Link href={nachricht} style={weg(!termin)}>{WEGE_TEXT.kontakt}</Link>}
            </div>
          )}
        </section>
      )}
      <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} aria-controls={offen ? id : undefined} aria-label={offen ? WEGE_TEXT.schliessen : WEGE_TEXT.oeffnen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '6px 14px 6px 6px', borderRadius: 999, border: `1px solid ${C.linie}`, background: C.flaeche, color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(17, 19, 22, .08)' }}>
        <Ring gross />
        {offen ? WEGE_TEXT.schliessen : 'Zoe'}
      </button>
    </div>
  );
}

/** Der Ring: zwei feine Kreise im Akzent — still, ohne Bewegung (reduzierte Bewegung braucht nichts Eigenes). */
function Ring({ gross }: { gross: boolean }) {
  const d = gross ? 34 : 20;
  return (
    <svg width={d} height={d} viewBox="0 0 34 34" aria-hidden="true" focusable="false">
      <circle cx="17" cy="17" r="14" fill="none" stroke={AKZENT} strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="9" fill="none" stroke={AKZENT} strokeWidth="2" />
      <circle cx="17" cy="17" r="2.5" fill={AKZENT} />
    </svg>
  );
}

function weg(haupt: boolean): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: `1px solid ${haupt ? C.ink : C.linie}`, background: haupt ? C.ink : 'transparent', color: haupt ? C.grund : C.ink };
}

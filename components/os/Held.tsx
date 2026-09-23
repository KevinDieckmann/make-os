'use client';

// ─── MAKE OS — Der Held einer Seite ─────────────────────────────────────────
// UX 4/5 (06.09.), nach Kevins Vorbildern Whoop & N26.
//
// Jede Übersichtsseite beantwortet EINE Frage. Dieser Baustein stellt die
// Antwort dar: eine große Zahl, darunter woher sie kommt, daneben ein Satz,
// der sagt, was jetzt zu tun ist.
//
// Vorher hatte jede Seite ihre eigene Kopfzeile mit vier bis sechs
// gleichwertigen Kacheln — nichts trat hervor, also musste man alles lesen.
//
// Zwei Formen:
//   • ohne Ring — für Beträge und Mengen (Kontostand, offene Nachrichten)
//   • mit Ring  — für alles von 0 bis 100 (Score, Recovery, Fortschritt)

import type React from 'react';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, MIKRO, ZIFFERN, zustandFarbe } from '@/lib/make-one/design';

export function Held({ wert, label, satz, ring, farbe, neben, kinder }: {
  /** Die eine Zahl. Als Text, damit „16.995 €" und „11/28" gleich behandelt werden. */
  wert: string;
  /** Woher sie kommt — GROSSBUCHSTABEN, leise. */
  label: string;
  /** Was jetzt zu tun ist. Ein Satz, keine Aufzählung. */
  satz?: React.ReactNode;
  /** 0–100 zeichnet einen Ring statt einer nackten Zahl. */
  ring?: number | null;
  /** Zustandsfarbe erzwingen; sonst aus dem Ringwert abgeleitet. */
  farbe?: string;
  /** Nebenwerte als ruhige Zeile — nie als konkurrierende Kacheln. */
  neben?: { label: string; wert: string; farbe?: string }[];
  /** Knopf oder Link unter dem Satz. */
  kinder?: React.ReactNode;
}) {
  const ton = farbe ?? (ring != null ? zustandFarbe(ring) : C.ink);

  return (
    <section style={{
      display: 'flex', alignItems: 'center', gap: A.xxl, flexWrap: 'wrap',
      padding: `${A.xl}px 0 ${A.l}px`,
    }}>
      {ring != null ? (
        <div style={{ position: 'relative', width: 168, height: 168, flex: '0 0 auto' }}>
          <svg width="168" height="168" viewBox="0 0 168 168" aria-label={`${label}: ${wert}`}>
            <circle cx="84" cy="84" r="72" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
            <circle cx="84" cy="84" r="72" fill="none" stroke={ton} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={(2 * Math.PI * 72).toFixed(1)}
              strokeDashoffset={(2 * Math.PI * 72 * (1 - Math.max(0, Math.min(100, ring)) / 100)).toFixed(1)}
              transform="rotate(-90 84 84)" />
          </svg>
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            <span style={{ ...ZIFFERN, fontSize: TYP.held, fontWeight: 700, color: ton, lineHeight: 1 }}>{wert}</span>
            <span style={MIKRO}>{label}</span>
          </span>
        </div>
      ) : (
        <div style={{ flex: '0 0 auto' }}>
          <div style={MIKRO}>{label}</div>
          <div style={{ ...ZIFFERN, fontSize: TYP.held, fontWeight: 700, color: ton, lineHeight: 1.05, marginTop: 2 }}>
            {wert}
          </div>
        </div>
      )}

      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        {satz && (
          <p style={{
            fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em',
            color: C.ink, margin: 0, lineHeight: 1.35, textWrap: 'balance',
          }}>{satz}</p>
        )}
        {!!neben?.length && (
          <div style={{ display: 'flex', gap: A.l, flexWrap: 'wrap', marginTop: A.m, fontSize: TYP.bedien, color: C.inkLeise }}>
            {neben.map(n => (
              <span key={n.label}>
                {n.label}{' '}
                <b style={{ ...ZIFFERN, fontWeight: 600, color: n.farbe ?? C.inkDim }}>{n.wert}</b>
              </span>
            ))}
          </div>
        )}
        {kinder && <div style={{ marginTop: A.m }}>{kinder}</div>}
      </div>
    </section>
  );
}

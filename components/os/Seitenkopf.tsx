'use client';

// ─── MAKE OS — Kopf einer Arbeitsseite ──────────────────────────────────────
// UX 4 (06.09.).
//
// Übersichtsseiten beantworten eine Frage mit einer Zahl — dafür gibt es
// <Held>. Arbeitsseiten beantworten keine Frage, man arbeitet dort. Sie
// brauchen nur: wo bin ich, was ist das, und wozu.
//
// Vorher stand dieser Block in 23 Dateien als handgesetztes Trio aus
// Mono-Rubrik, 25px-Überschrift und 13,5px-Absatz — mit Abweichungen, die
// niemand beabsichtigt hatte. Jetzt kommt er aus einer Quelle und hängt an
// den Größen aus design.ts.

import type React from 'react';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, MIKRO } from '@/lib/make-one/design';
// TYP bleibt für den Satz; die Titelgröße folgt seit 24.09. der Seite aus schlank.tsx.

export function Seitenkopf({ rubrik, titel, satz, rechts }: {
  /** Wo man ist — GROSSBUCHSTABEN, leise. */
  rubrik?: React.ReactNode;
  /** Was die Seite ist. Ein kurzer Satz, kein Etikett. */
  titel: React.ReactNode;
  /** Wozu sie da ist. Höchstens zwei Zeilen. */
  satz?: React.ReactNode;
  /** Knöpfe, die zur ganzen Seite gehören — rechts, auf einer Höhe mit dem Titel. */
  rechts?: React.ReactNode;
}) {
  return (
    // Gestaffelter Auftritt: Rubrik, Titel, Satz — 60 ms auseinander.
    // Das ist der Unterschied zwischen einer Seite, die AUFBLITZT, und einer,
    // die ANKOMMT. Weil dieser Kopf auf 34 Arbeitsseiten steht, wirkt die
    // eine Änderung überall.
    <header style={{ marginBottom: A.l }}>
      {rubrik && <div className="zeile-auf" style={MIKRO}>{rubrik}</div>}
      <div className="zeile-auf" style={{ animationDelay: '.06s', display: 'flex', alignItems: 'baseline', gap: A.l, flexWrap: 'wrap' }}>
        <h1 style={{
          // 24.09.: derselbe Kopf wie auf den neuen Seiten — groß, fett, eng.
          fontFamily: SCHRIFT.display, fontSize: 'clamp(24px,3vw,30px)', fontWeight: 700, letterSpacing: '-.025em',
          color: C.ink, margin: `${A.xs}px 0 0`, lineHeight: 1.1, textWrap: 'balance',
        }}>{titel}</h1>
        {rechts && <div style={{ marginLeft: 'auto', display: 'flex', gap: A.s, flexWrap: 'wrap' }}>{rechts}</div>}
      </div>
      {satz && (
        <p className="zeile-auf" style={{
          animationDelay: '.12s',
          fontFamily: SCHRIFT.text, fontSize: TYP.body, color: C.inkDim,
          maxWidth: 680, lineHeight: 1.5, margin: `${A.xs}px 0 0`,
        }}>{satz}</p>
      )}
    </header>
  );
}

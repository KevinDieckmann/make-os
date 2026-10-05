'use client';

// ─── Dezente Marke „KI-Entwurf“ (KI-VO Art. 50, 05.10.) ─────────────────────────────────────────────────────────────
// Steht überall, wo ein ZOE-Text an Dritte gehen kann (Mail-Antworten, Ansprachen, Content). Klein, ruhig, ohne Alarm.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { KI_HINWEIS } from '@/lib/datenschutz/ki-kennzeichnung';

export function KiMarke({ text = KI_HINWEIS }: { text?: string }) {
  return (
    <span role="note" aria-label="KI-erzeugter Text" title="KI-erzeugt (KI-VO Art. 50) — bitte vor dem Weitergeben prüfen"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkLeise, letterSpacing: '.01em' }}>
      <span aria-hidden style={{ fontSize: TYP.mikro, fontWeight: 700, padding: '1px 6px', borderRadius: 6, border: `1px solid ${C.linie}`, color: C.inkDim }}>KI</span>
      {text}
    </span>
  );
}

'use client';

// ─── MAKE OS — Reiter unter ZOE (Aufräumen Etappe 1, 08.10.) ────────────────
// In der Leiste steht nur EIN Punkt „ZOE“. Darunter hängen Freigaben, Agenten (mit Research, Content, Meeting, Board,
// Prospecting), Loops, Brain und der Empfang — diese Reiterzeile steht oben auf jeder dieser Seiten, damit man weiß, wo man ist
// und wohin es weitergeht. Liste und Hervorhebung: lib/make-one/spaces.ts `ZOE_BEREICH`. Reiter = Links (Ort wechseln = push).

import { usePathname, useRouter } from 'next/navigation';
import { Reiter } from './ui';
import { ZOE_BEREICH, passtZu } from '@/lib/make-one/spaces';

export function ZoeReiter() {
  const pfad = usePathname() ?? '';
  const router = useRouter();
  const aktiv = ZOE_BEREICH.find(b => b.passt.some(m => passtZu(pfad, '', m)))?.href ?? null;
  return (
    <div className="ui-reiter-zeile" style={{ marginBottom: 14 }}>
      <Reiter ariaLabel="ZOE" liste={ZOE_BEREICH.map(b => ({ id: b.href, label: b.label }))} aktiv={aktiv} onWahl={href => router.push(href)} />
    </div>
  );
}

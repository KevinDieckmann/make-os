'use client';

// ─── Unternehmen › Dokumente: Vollständigkeits-Ring und „was fehlt zuerst“ (11.10.) ──────────────────────────────────────────────────
// Ein Ring je Gesellschaft (wie viel der Soll-Liste in Ordnung ist), daneben Pflicht und empfohlen gezählt, je Gruppe ein Balken und die höchstens drei
// Unterlagen, die zuerst dran sind (Gewicht wie „Das Wichtigste jetzt“, lib/gesellschaften/schild/blick.ts `dokumenteBlick`). Ruhig: fehlende Unterlagen
// ohne Frist sind neutral, nicht rot.

import Link from 'next/link';
import { FARBE as C, TYP, LEUCHT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster } from '../../ui';
import { WEG } from '@/lib/wege';
import { dokumenteBlick } from '@/lib/gesellschaften/schild/blick';
import { DOK_ZUSTAND_TEXT, type DokSoll } from '@/lib/gesellschaften/schild/dokumente';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import { KleinRing, WasSeheIch, klein } from './teile';

const ringFarbe = (a: number) => (a >= 0.85 ? LEUCHT.gut : a >= 0.5 ? C.aktiv : C.inkDim);

function Inhalt({ dokumente, id, name }: { dokumente: readonly DokSoll[]; id: string; name?: string }) {
  const b = dokumenteBlick(dokumente);
  const fehlen = b.soll - b.ok;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <KleinRing anteil={b.anteil} farbe={ringFarbe(b.anteil)} mitte={`${b.ok}/${b.soll}`} unter="in Ordnung" label={`${name ? `${name}: ` : ''}${b.ok} von ${b.soll} Unterlagen in Ordnung`} />
        <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 180 }}>
          {name && <strong style={{ fontSize: TYP.body }}>{name}</strong>}
          <span style={{ fontSize: TYP.bedien, color: C.ink }}>Pflicht: {b.pflicht.ok} von {b.pflicht.soll}</span>
          <span style={klein}>Empfohlen: {b.empfohlen.ok} von {b.empfohlen.soll}</span>
          <span style={klein}>{fehlen ? `${fehlen} Unterlage${fehlen === 1 ? '' : 'n'} offen${b.zuerst.length ? ` — zuerst ${b.zuerst.length === 1 ? 'diese' : `diese ${b.zuerst.length}`}:` : ''}` : 'Alles abgelegt, was die Soll-Liste verlangt.'}</span>
        </div>
      </div>
      {b.zuerst.length > 0 && (
        <div style={{ display: 'grid' }}>
          {b.zuerst.map((d, i) => (
            <Link key={d.katalog.art} href={WEG.schild('dokumente', id)} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'baseline', minHeight: 44, padding: '6px 2px', borderTop: `1px solid ${RAND.haar}`, color: C.ink, textDecoration: 'none' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{d.katalog.titel}<span style={{ color: C.inkDim }}> · {DOK_ZUSTAND_TEXT[d.zustand]}{d.stufe === 'pflicht' ? ' (Pflicht)' : ''}</span></span>
              <span aria-hidden style={{ color: C.inkLeise }}>›</span>
            </Link>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        {b.gruppen.map(gr => (
          <div key={gr.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px auto', gap: 10, alignItems: 'center' }}>
            <span style={{ ...klein, overflowWrap: 'anywhere' }}>{gr.label}</span>
            <span aria-hidden style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${gr.soll ? Math.max(4, (gr.ok / gr.soll) * 100) : 0}%`, background: 'rgba(255,255,255,.32)', borderRadius: 3 }} /></span>
            <span style={{ ...klein, fontVariantNumeric: 'tabular-nums' }}>{gr.ok}/{gr.soll}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Eine Gesellschaft: Ring, Zählung, „was zuerst“, Gruppen. */
export function DokumenteRing({ lage }: { lage: GesellschaftLage }) {
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.blick.dokumente">Vollständigkeit der Firmen-Akte</Ueberschrift>
      <Inhalt dokumente={lage.dokumente} id={lage.id} />
      <WasSeheIch>Der Ring zeigt, wie viel der Soll-Liste dieser Gesellschaft abgelegt und aktuell ist. Darunter die Unterlagen, die zuerst dran sind — Pflicht vor Empfehlung, Abgelaufenes vor Fehlendem.</WasSeheIch>
    </Karte>
  );
}

/** Alle Gesellschaften nebeneinander — je ein Ring. */
export function DokumenteAlle({ gesellschaften }: { gesellschaften: readonly GesellschaftLage[] }) {
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.blick.dokumente">Vollständigkeit der Firmen-Akten</Ueberschrift>
      <Raster min={300}>
        {gesellschaften.map(g => <div key={g.id} style={{ padding: 4 }}><Inhalt dokumente={g.dokumente} id={g.id} name={g.name} /></div>)}
      </Raster>
      <WasSeheIch>Je Gesellschaft ein Ring: wie viel ihrer Soll-Liste abgelegt und aktuell ist. Wähle oben eine Gesellschaft, um Unterlagen zu erfassen.</WasSeheIch>
    </Karte>
  );
}

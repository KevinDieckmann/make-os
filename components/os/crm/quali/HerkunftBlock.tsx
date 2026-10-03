'use client';

// ─── Herkunft des Leads — an jeder Karte (03.10.) ─────────────────────────────────────────────
// Besuchtes Event (und für welchen Kunden), Make.One, Kampagne, Empfehlung, Quelle; das Foto der Visitenkarte als Vorschau,
// die Sprachnotiz zum Abspielen, die letzte Aktivität. Daten: lib/crm/herkunft.ts. Bilder und Ton laden NUR über die
// geschützte Datei-Route (/api/crm/dateien?id=…), die Sprachnotiz erst auf Tippen (preload none).

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Chip, LEUCHT } from '../../ui';
import { Fenster } from '../../Fenster';
import { letzteAktivitaetText, type Herkunft, type HerkunftTeil } from '@/lib/crm/herkunft';

const FARBE: Record<HerkunftTeil['art'], string> = { event: LEUCHT.business, makeone: LEUCHT.business, kampagne: LEUCHT.agenten, empfehlung: LEUCHT.gut, quelle: C.inkDim, visitenkarte: C.inkDim, sprache: C.inkDim, anfrage: LEUCHT.gut };
const dateiUrl = (id: string) => `/api/crm/dateien?id=${encodeURIComponent(id)}`;

export function HerkunftBlock({ h, heute, personName }: { h: Herkunft; heute: string; personName?: (id: string) => string }) {
  const router = useRouter();
  const [gross, setGross] = useState<HerkunftTeil | null>(null);
  const texte = h.teile.filter(t => t.art !== 'visitenkarte' && t.art !== 'sprache');
  const karten = h.teile.filter(t => t.art === 'visitenkarte');
  const sprachen = h.teile.filter(t => t.art === 'sprache');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>Herkunft</span>
        {!texte.some(t => t.text.toLowerCase().startsWith(h.kanalText.toLowerCase())) && <Chip farbe={C.inkDim} umbrechen>{h.kanalText}</Chip>}
        {texte.map((t, i) => t.href
          ? <button key={i} type="button" onClick={() => router.push(t.href!)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 32, maxWidth: '100%', minWidth: 0, textAlign: 'left' }}><Chip farbe={FARBE[t.art]} umbrechen>{t.text} ›</Chip></button>
          : <Chip key={i} farbe={FARBE[t.art]} umbrechen>{t.text}</Chip>)}
      </div>
      {(karten.length > 0 || sprachen.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {karten.slice(0, 3).map(t => (
            <button key={t.dateiId} type="button" onClick={() => setGross(t)} aria-label={`${t.text} vergrößern`} className="fassbar" style={{ padding: 0, border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', background: 'rgba(255,255,255,.04)', width: 84, height: 56 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Datei-Route, kein Bild-Optimierer */}
              <img src={dateiUrl(t.dateiId!)} alt={t.text} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
          {sprachen.slice(0, 2).map(t => (
            <label key={t.dateiId} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
              <span>{t.text}</span>
              <audio controls preload="none" src={dateiUrl(t.dateiId!)} style={{ height: 36, maxWidth: 220 }} />
            </label>
          ))}
        </div>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflowWrap: 'anywhere' }}>{letzteAktivitaetText(h, heute, personName)}</div>
      {gross && (
        <Fenster titel={gross.text} onZu={() => setGross(null)} breit={720}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dateiUrl(gross.dateiId!)} alt={gross.text} style={{ width: '100%', maxHeight: '70dvh', objectFit: 'contain', borderRadius: 12, background: 'rgba(255,255,255,.04)' }} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Das Foto liegt verschlüsselt in der Dateiablage und wird nur hier angezeigt.</div>
        </Fenster>
      )}
    </div>
  );
}

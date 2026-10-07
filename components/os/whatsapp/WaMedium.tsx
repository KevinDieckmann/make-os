'use client';

// ─── WhatsApp — ein Medium in der Inbox: nur auf Klick (07.10.2026 abends) ──────────────────────────────────────────────
// Kein automatisches Laden — weder von Meta noch von MAKE OS: erst der Klick holt die Datei aus der verschlüsselten Ablage des eigenen
// Servers (GET /api/whatsapp/medien?id=<Nachricht>, liefert immer `attachment` + `nosniff`). Dann:
//   Bild (jpeg/png/webp/gif, nie SVG)      → Vorschau über eine blob:-Adresse (nur im Browser, nie gespeichert), „Ausblenden“ gibt sie frei
//   Audio/Sprachnachricht (ogg/mp3/…)      → Audio-Element mit Steuerung (kein Autoplay)
//   alles andere (Dokument, Video, …)      → Download-Link
// Liegt die Datei (noch) nicht vor, steht der Grund da (wird geholt · zu groß · abgelaufen · nicht ladbar) — „in WhatsApp ansehen“.

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf } from '../ui';
import { mediumAnzeige, mediumVorschauTyp, type WaArt, type WaMedium as WaMediumDaten } from '@/lib/whatsapp/typen';

const ZUSTAND_TEXT: Record<Exclude<WaMediumDaten['zustand'], 'abgelegt'>, string> = {
  offen: 'wird gerade von WhatsApp geholt — gleich noch einmal öffnen',
  'zu-gross': 'zu groß für MAKE OS (über 25 MB) — in WhatsApp ansehen',
  abgelaufen: 'bei Meta nicht mehr abrufbar (älter als 7 Tage)',
  fehler: 'ließ sich nicht laden — in WhatsApp ansehen',
};

const groesseText = (b: number) => (!b ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);
/** Adresse des Mediums einer Nachricht (eigener Server, nie Meta). */
export const waMediumLink = (nachricht: string) => `/api/whatsapp/medien?id=${encodeURIComponent(nachricht)}`;

export function WaMedium({ nachricht, name, typ, groesse, zustand, art }: { nachricht: string; name: string; typ: string; groesse: number; zustand?: WaMediumDaten['zustand']; art?: WaArt }) {
  const [url, setUrl] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const anzeige = mediumAnzeige(typ);
  const link = waMediumLink(nachricht);
  const g = groesseText(groesse);
  const wort = art === 'sprachnachricht' ? 'Sprachnachricht' : anzeige === 'bild' ? 'Bild' : anzeige === 'audio' ? 'Audio' : name;

  const laden = async () => {
    const vorschau = mediumVorschauTyp(typ);
    if (!vorschau) return;
    setLaeuft(true); setFehler('');
    try {
      const r = await fetch(link, { cache: 'no-store' });
      if (!r.ok) { const d = await r.json().catch(() => ({})) as { fehler?: string }; throw new Error(d.fehler ?? 'Die Datei ließ sich nicht laden.'); }
      setUrl(URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: vorschau })));
    } catch (e) { setFehler(e instanceof Error ? e.message : 'Die Datei ließ sich nicht laden.'); }
    setLaeuft(false);
  };

  const rahmen = { display: 'grid', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.linie}`, maxWidth: '100%', minWidth: 0 } as const;
  if (zustand && zustand !== 'abgelegt') {
    return <div data-whatsapp="medium" data-zustand={zustand} style={{ ...rahmen, fontSize: TYP.bedien, color: C.inkLeise }}><span><b style={{ color: C.inkDim }}>{wort}</b>{g ? ` · ${g}` : ''} — {ZUSTAND_TEXT[zustand]}</span></div>;
  }
  return (
    <div data-whatsapp="medium" data-zustand="abgelegt" data-anzeige={anzeige} style={rahmen}>
      {anzeige !== 'download' && !url && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf leise onClick={laden} aus={laeuft}>{laeuft ? 'lädt …' : anzeige === 'bild' ? 'Bild ansehen' : `${wort} abspielen`}</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{wort}{g ? ` · ${g}` : ''} · lädt erst auf Klick</span>
        </div>
      )}
      {url && anzeige === 'bild' && (
        // eslint-disable-next-line @next/next/no-img-element -- blob:-Vorschau aus dem eigenen Server, kein Next-Bild
        <img src={url} alt={name || 'Bild aus WhatsApp'} style={{ display: 'block', maxWidth: '100%', maxHeight: 360, borderRadius: 10, objectFit: 'contain' }} />
      )}
      {url && anzeige === 'audio' && <audio controls preload="metadata" src={url} style={{ width: '100%', maxWidth: 420 }} aria-label={wort} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {url && <Knopf leise onClick={() => { URL.revokeObjectURL(url); setUrl(null); }}>{anzeige === 'bild' ? 'Ausblenden' : 'Schließen'}</Knopf>}
        <a href={link} download rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: C.ink, fontSize: TYP.bedien, textDecoration: 'none', fontFamily: SCHRIFT.text, overflowWrap: 'anywhere', maxWidth: '100%' }}>
          {anzeige === 'download' ? name : 'Herunterladen'}{anzeige === 'download' && g ? <span style={{ color: C.inkLeise, marginLeft: 6 }}>{g}</span> : null}
        </a>
      </div>
      {fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{fehler}</div>}
    </div>
  );
}

/** Das Etikett „WhatsApp“ (Sprechblase + Wort) — ruhig, in der Farbe der Quelle. */
export function WaSymbol({ groesse = 14, farbe = 'currentColor' }: { groesse?: number; farbe?: string }) {
  return (
    <svg aria-hidden width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke={farbe} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, verticalAlign: '-2px' }}>
      <path d="M20 11.5a8 8 0 0 1-11.9 7l-4.1 1.1 1.1-4A8 8 0 1 1 20 11.5z" />
      <path d="M9 9.5c.3 1.6 1.9 3.6 3.9 4.4" />
    </svg>
  );
}

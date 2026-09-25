'use client';

// ─── Markttraktion · Visitenkarte → Kontakt ─────────────────────────────────
// Auf Events und in Terminen: Karte fotografieren → Felder vorausgefüllt →
// Person anlegen, in Sekunden. Der Knopf öffnet am Handy direkt die Kamera
// (capture="environment"), am Rechner die Dateiauswahl.
//
// Ablauf: Foto im Browser auf höchstens 1600 px Kante verkleinern (JPEG 0,85 —
// eine Karte bleibt gut lesbar, der Upload bleibt klein), an
// /api/crm/visitenkarte schicken, die erkannten Felder zeigen — was das Modell
// unsicher fand, ist markiert — und an das Formular geben (`onErkannt`).
// Das Foto wird nirgends gespeichert; auch hier verschwindet es mit dem Zustand.
//
// Eingebunden in der Kartei („+ Person“, Herkunft „selbst“) und am Einlass
// (events/Abend.tsx, Herkunft „Veranstaltung“). Eine Visitenkarte ist in
// beiden Fällen KEINE Einwilligung — der Hinweis steht deshalb immer darunter.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../schlank';
import { KARTEN_FELDER, MAX_BILD_MB, type KartenFeld, type VisitenkartenDaten } from '@/lib/crm/visitenkarte';

export type { VisitenkartenDaten } from '@/lib/crm/visitenkarte';

/** Längste Kante nach dem Verkleinern — reicht für kleine Schrift auf der Karte. */
const MAX_KANTE = 1600;
const QUALITAET = 0.85;
const NICHT_MOEGLICH = 'Erkennung gerade nicht möglich — Felder bitte von Hand ausfüllen.';

type Stand =
  | { art: 'bereit' }
  | { art: 'liest' }
  | { art: 'fertig'; daten: VisitenkartenDaten; unsicher: KartenFeld[] }
  | { art: 'fehler'; fehler: string };

/** Foto → verkleinertes JPEG als Data-URL. Kann der Browser das Format nicht öffnen (z. B. HEIC in Chrome), geht das Original. */
async function vorbereiten(datei: File): Promise<{ bild: string; medientyp: string } | { fehler: string }> {
  const url = URL.createObjectURL(datei);
  try {
    const bild = await new Promise<HTMLImageElement>((ok, nein) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => nein(new Error('nicht lesbar'));
      i.src = url;
    });
    const b = bild.naturalWidth, h = bild.naturalHeight;
    if (!b || !h) throw new Error('leer');
    const f = Math.min(1, MAX_KANTE / Math.max(b, h));
    const leinwand = document.createElement('canvas');
    leinwand.width = Math.max(1, Math.round(b * f));
    leinwand.height = Math.max(1, Math.round(h * f));
    const ctx = leinwand.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    // Weißer Grund: transparente PNGs würden als JPEG sonst schwarz.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, leinwand.width, leinwand.height);
    ctx.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
    return { bild: leinwand.toDataURL('image/jpeg', QUALITAET), medientyp: 'image/jpeg' };
  } catch {
    if (datei.size > MAX_BILD_MB * 1024 * 1024) return { fehler: `Das Foto lässt sich hier nicht verkleinern und ist größer als ${MAX_BILD_MB} MB — bitte als JPG aufnehmen.` };
    const bild = await new Promise<string>(ok => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result ?? ''));
      r.onerror = () => ok('');
      r.readAsDataURL(datei);
    });
    return bild ? { bild, medientyp: datei.type } : { fehler: 'Das Foto ließ sich nicht öffnen — bitte noch einmal aufnehmen.' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * „Visitenkarte fotografieren“ — liest die Karte und ruft `onErkannt` mit den
 * geputzten Feldern. Leere Felder fehlen in `daten` (nichts wird erfunden).
 * `gross`: große Fläche für den Einlass am Tablet.
 */
export function VisitenkarteKnopf({ onErkannt, gross }: { onErkannt: (d: VisitenkartenDaten) => void; gross?: boolean }) {
  const eingabe = useRef<HTMLInputElement>(null);
  // Immer den aktuellen Rückruf nehmen: während die Karte gelesen wird, kann
  // jemand schon tippen — ein alter Rückruf würde das Getippte überschreiben.
  const rueckruf = useRef(onErkannt);
  useEffect(() => { rueckruf.current = onErkannt; });
  // Nur das Ergebnis des zuletzt gewählten Fotos zählt.
  const lauf = useRef(0);
  const [stand, setStand] = useState<Stand>({ art: 'bereit' });

  const lesen = async (datei: File) => {
    const nr = ++lauf.current;
    setStand({ art: 'liest' });
    try {
      const foto = await vorbereiten(datei);
      if (nr !== lauf.current) return;
      if ('fehler' in foto) { setStand({ art: 'fehler', fehler: foto.fehler }); return; }
      const { bild, medientyp } = foto;
      const ctrl = new AbortController();
      const uhr = setTimeout(() => ctrl.abort(), 60_000);
      const r = await fetch('/api/crm/visitenkarte', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bild, medientyp }), signal: ctrl.signal,
      }).then(x => x.json()).catch(() => null).finally(() => clearTimeout(uhr));
      if (nr !== lauf.current) return;
      if (!r?.ok || !r.daten) { setStand({ art: 'fehler', fehler: typeof r?.fehler === 'string' ? r.fehler : NICHT_MOEGLICH }); return; }
      const daten = r.daten as VisitenkartenDaten;
      const unsicher = (Array.isArray(r.unsicher) ? r.unsicher : []).filter((f: unknown): f is KartenFeld => KARTEN_FELDER.some(k => k.id === f));
      setStand({ art: 'fertig', daten, unsicher });
      rueckruf.current(daten);
    } catch {
      if (nr === lauf.current) setStand({ art: 'fehler', fehler: NICHT_MOEGLICH });
    }
  };

  const liest = stand.art === 'liest';
  const knopfText = liest ? 'liest die Karte …' : stand.art === 'fertig' ? 'Andere Karte fotografieren' : 'Visitenkarte fotografieren';

  return (
    <div style={{ display: 'grid', gap: 8, position: 'relative' }}>
      {/* Unsichtbar statt `hidden`: ältere iOS-Versionen öffnen ein display:none-Feld nicht per Klick. */}
      <input ref={eingabe} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
        onChange={x => { const d = x.target.files?.[0]; x.target.value = ''; if (d) void lesen(d); }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {gross ? (
          <button onClick={() => eingabe.current?.click()} disabled={liest} className="fassbar" style={{
            flex: 1, minWidth: 200, minHeight: 48, padding: '12px 18px', borderRadius: 12, cursor: liest ? 'default' : 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700,
            border: `1px solid ${liest ? 'rgba(255,255,255,.12)' : C.aktiv}`, background: liest ? 'rgba(255,255,255,.04)' : C.aktivSanft, color: liest ? C.inkDim : C.aktiv,
          }}>{knopfText}</button>
        ) : (
          <Knopf leise={stand.art === 'fertig'} aus={liest} onClick={() => eingabe.current?.click()}>{knopfText}</Knopf>
        )}
        {liest && <span aria-live="polite" style={{ fontSize: 12.5, color: C.inkLeise }}>Das dauert ein paar Sekunden.</span>}
      </div>

      {stand.art === 'fehler' && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.achtung, lineHeight: 1.5 }}>{stand.fehler}</div>}

      {stand.art === 'fertig' && (
        <div style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>
          <div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 2 }}>
            Von der Karte übernommen — bitte kurz prüfen{stand.unsicher.length ? '; gelb markiert ist, was unsicher gelesen wurde' : ''}.
          </div>
          {KARTEN_FELDER.filter(f => stand.daten[f.id] || stand.unsicher.includes(f.id)).map(f => {
            const unsicher = stand.unsicher.includes(f.id);
            const wert = stand.daten[f.id];
            return (
              <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 110px) 1fr', gap: 10, fontSize: TYP.bedien, alignItems: 'baseline' }}>
                <span style={{ color: C.inkLeise, fontSize: 12.5 }}>{f.label}</span>
                <span style={{ color: unsicher ? LEUCHT.achtung : C.ink, overflowWrap: 'anywhere' }}>
                  {wert ?? 'nicht sicher lesbar — bitte von der Karte abtippen'}{unsicher && wert ? ' · unsicher' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.inkLeise }}>Die Karte kam von der Person selbst — keine Einwilligung für Werbung per Mail.</div>
    </div>
  );
}

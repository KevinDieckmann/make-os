'use client';

// ─── MAKE OS — Whoop-Export einlesen (Knopf) ────────────────────────────────
// Whoop schickt eine Mail „Dein WHOOP Datenexport steht bereit". Ein Klick auf
// „Daten herunterladen" legt my_whoop_data_….zip in den Downloads-Ordner. Hier
// holt MAKE OS die Datei mit einem zweiten Klick ab — oder nimmt sie aus der
// Dateiauswahl. Danach rechnen Gesundheit und Wachstums-Score mit den Werten.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from './schlank';

interface Ergebnis { ok: boolean; error?: string; quelle?: string; tage?: number; neu?: number; von?: string; bis?: string; letzter?: { rec?: number; sleep?: number; hrv?: number; rhr?: number } }

/** Nach dem Einlesen: der Wachstums-Kopf und offene Seiten holen die neuen Werte. */
export const SCORE_NEU = 'make-os:score-neu';

const datum = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

export function WhoopImport({ onFertig, kurz }: { onFertig?: () => void; kurz?: boolean }) {
  const [bereit, setBereit] = useState<{ name: string; zeit: string } | null | undefined>(undefined);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const datei = useRef<HTMLInputElement>(null);

  const pruefen = () => fetch('/api/import/whoop').then(r => r.json()).then(d => setBereit(d.downloads ?? null)).catch(() => setBereit(null));
  useEffect(() => { void pruefen(); }, []);

  async function einlesen(koerper: BodyInit, json: boolean) {
    setLaeuft(true); setErgebnis(null);
    const r: Ergebnis = await fetch('/api/import/whoop', { method: 'POST', ...(json ? { headers: { 'Content-Type': 'application/json' } } : {}), body: koerper })
      .then(x => x.json()).catch(() => ({ ok: false, error: 'Nicht erreichbar.' }));
    setErgebnis(r); setLaeuft(false);
    if (r.ok) { window.dispatchEvent(new Event(SCORE_NEU)); onFertig?.(); }
  }
  const ausDownloads = () => einlesen(JSON.stringify({ ausDownloads: true }), true);
  const gewaehlt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('datei', f); void einlesen(fd, false); e.target.value = '';
  };

  const alt = bereit && Date.now() - Date.parse(bereit.zeit) > 2 * 86400_000;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {!kurz && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
          In der Whoop-Mail „Dein WHOOP Datenexport steht bereit“ auf <b style={{ color: C.ink, fontWeight: 600 }}>Daten herunterladen</b> klicken, dann hier einlesen.
          {bereit && <> Im Downloads-Ordner liegt <b style={{ color: alt ? LEUCHT.achtung : C.ink, fontWeight: 600 }}>{bereit.name}</b>{alt ? ' — älter als zwei Tage.' : '.'}</>}
          {bereit === null && ' Im Downloads-Ordner liegt noch kein Export.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf farbe={LEUCHT.gut} onClick={ausDownloads} aus={laeuft || !bereit}>{laeuft ? 'lese ein …' : 'Aus Downloads einlesen'}</Knopf>
        <Knopf leise onClick={() => datei.current?.click()} aus={laeuft}>ZIP wählen</Knopf>
        <input ref={datei} type="file" accept=".zip,.csv" onChange={gewaehlt} style={{ display: 'none' }} />
      </div>
      {ergebnis && (
        <div style={{ fontSize: TYP.bedien, lineHeight: 1.5, color: ergebnis.ok ? LEUCHT.gut : LEUCHT.kritisch }}>
          {ergebnis.ok
            ? <>Eingelesen: {ergebnis.tage} Tage bis {datum(ergebnis.bis)}{ergebnis.neu ? `, ${ergebnis.neu} neu` : ', alle schon bekannt'}.{ergebnis.letzter?.rec != null && <> Letzter Tag: Recovery {ergebnis.letzter.rec} %{ergebnis.letzter.sleep != null && `, Schlaf ${String(ergebnis.letzter.sleep).replace('.', ',')} h`}.</>}</>
            : ergebnis.error}
        </div>
      )}
    </div>
  );
}

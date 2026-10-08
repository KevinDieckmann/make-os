'use client';

// ─── MAKE OS — Update-Hinweis oben im Kopf (08.10., Phase 0) ────────────────
// Kevin 08.10.: „Schmal oben auf jeder Seite, solange ein Update läuft.“ Eine ruhige Zeile über dem Kopf (sticky mit ihm):
//   „Update läuft — kurz nichts Wichtiges speichern“   solange deploy/ausrollen.sh seine Marke gesetzt hat,
//   „Neue Version da — neu laden“ + Knopf              sobald der Server einen anderen Bau meldet als diese Seite.
// Regeln rein in lib/bau/update.ts, Server GET /api/system/update. Gefragt wird nur bei sichtbarer Seite, höchstens alle 60 s,
// und sofort, wenn ein Schreibversuch mit „bitte neu laden“ (409) zurückkam (Ereignis der Bau-Wache). Zeigt die Bau-Wache
// schon ihren eigenen Hinweis (mit dem Satz zur nicht gespeicherten Eingabe), steht „Neue Version da“ hier nicht doppelt.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, TIEF, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf } from './ui';
import { bauKennung, NEU_LADEN_EREIGNIS } from '@/lib/bau/kennung';
import { abfrageFaellig, antwortLesen, updateAnzeige, NEUE_VERSION_TEXT, UPDATE_LAEUFT_TEXT, type UpdateAntwort } from '@/lib/bau/update';

/** Wie oft nachgesehen wird, ob eine Abfrage fällig ist (die Abfrage selbst höchstens alle 60 s). */
const TAKT_MS = 15_000;

export function UpdateHinweis() {
  const [antwort, setAntwort] = useState<UpdateAntwort | null>(null);
  const [wacheZeigt, setWacheZeigt] = useState(false);
  const letzte = useRef<number | null>(null);
  const unterwegs = useRef(false);
  /** Ohne Sitzung (401) oder gesperrt (403): nicht weiter fragen. */
  const aus = useRef(false);

  const fragen = useCallback(async (sofort = false) => {
    if (aus.current || unterwegs.current) return;
    if (!sofort && document.visibilityState !== 'visible') return;
    if (!abfrageFaellig(letzte.current, Date.now(), sofort)) return;
    letzte.current = Date.now();
    unterwegs.current = true;
    try {
      const r = await fetch('/api/system/update', { cache: 'no-store' });
      if (r.status === 401 || r.status === 403) { aus.current = true; setAntwort(null); return; }
      if (!r.ok) return; // z. B. 502 während des Tauschs — der letzte Stand bleibt stehen
      const a = antwortLesen(await r.json());
      if (a) setAntwort(a);
    } catch { /* offline oder gerade getauscht — der letzte Stand bleibt stehen */ }
    finally { unterwegs.current = false; }
  }, []);

  useEffect(() => {
    void fragen();
    const takt = setInterval(() => { void fragen(); }, TAKT_MS);
    const sicht = () => { if (document.visibilityState === 'visible') void fragen(); };
    const neuLaden = () => { setWacheZeigt(true); void fragen(true); };
    document.addEventListener('visibilitychange', sicht);
    window.addEventListener(NEU_LADEN_EREIGNIS, neuLaden);
    return () => {
      clearInterval(takt);
      document.removeEventListener('visibilitychange', sicht);
      window.removeEventListener(NEU_LADEN_EREIGNIS, neuLaden);
    };
  }, [fragen]);

  const anzeige = updateAnzeige(antwort, bauKennung());
  if (!anzeige || (anzeige === 'neu' && wacheZeigt)) return null;
  const farbe = BEDEUTUNG_FARBE.info;
  return (
    <div role="status" aria-live="polite" className="update-hinweis" style={{ background: TIEF.flaeche(farbe), borderBottom: `1px solid ${TIEF.rand(farbe)}` }}>
      <div className="update-hinweis-innen">
        <RefreshCw aria-hidden size={16} strokeWidth={2} style={{ flex: '0 0 auto', color: farbe }} />
        <span className="update-hinweis-text" style={{ color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
          {anzeige === 'neu' ? NEUE_VERSION_TEXT : UPDATE_LAEUFT_TEXT}
        </span>
        {anzeige === 'neu' && <Knopf leise farbe={farbe} onClick={() => window.location.reload()}>Neu laden</Knopf>}
      </div>
    </div>
  );
}

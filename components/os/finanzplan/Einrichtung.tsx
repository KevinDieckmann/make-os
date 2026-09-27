'use client';

// ─── Finanzplanung jetzt — Einrichtung ohne Dokument ─────────────────────────
// Ruhige Karte: Startbestand hochladen (finanzen-plan.json v3) oder leer
// beginnen. Die Datei geht nur an den eigenen Server, nie ins Repo. Ist schon
// ein Plan da, fragt der Server nach „ersetzen“ — hier bewusst nur beim Erst-
// start; Ersetzen später über dieselbe Route mit ausdrücklicher Bestätigung.

import { useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Knopf, LEUCHT, Raster } from '../schlank';

export function Einrichtung({ zustand, onFertig }: { zustand: 'leer' | 'kein' | 'fehler'; onFertig: () => void }) {
  const datei = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ersetzen, setErsetzen] = useState(false);

  const sende = async (body: FormData | string) => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/finanzplan/import${ersetzen ? '?ersetzen=1' : ''}`, { method: 'POST', body, ...(typeof body === 'string' ? { headers: { 'Content-Type': 'application/json' } } : {}) });
      const a = (await r.json()) as { ok: boolean; fehler?: string };
      if (!a.ok) { if (r.status === 409) setErsetzen(true); setFehler(a.fehler ?? 'Das hat nicht geklappt.'); return; }
      onFertig();
    } catch { setFehler('Keine Verbindung — MAKE OS ist gerade nicht erreichbar.'); }
    finally { setLaeuft(false); }
  };
  const hochladen = () => {
    const f = datei.current?.files?.[0];
    if (!f) { setFehler('Bitte zuerst die Datei wählen.'); return; }
    const fd = new FormData(); fd.set('datei', f); if (ersetzen) fd.set('ersetzen', 'true');
    void sende(fd);
  };

  if (zustand === 'kein') {
    return (
      <Seite titel="Finanzplanung jetzt">
        <Karte i={0}>
          <Ueberschrift farbe={LEUCHT.achtung}>Kein Zugang</Ueberschrift>
          <div style={{ fontSize: TYP.body, lineHeight: 1.6, color: C.inkDim }}>Die Finanzplanung gehört zum Haushalt. Der Inhaber trägt unter System → Konto den Haushalt ein (Kevin und Malin: derselbe Name) — dann erscheint hier der Plan.</div>
        </Karte>
      </Seite>
    );
  }
  return (
    <Seite titel="Finanzplanung jetzt" unter="Unsere privaten Finanzen und die Firmenfinanzen in einem Plan — zu zweit.">
      <Raster min={320}>
        <Karte i={0} akzent={C.aktiv}>
          <Ueberschrift>Startbestand hochladen</Ueberschrift>
          <div style={{ fontSize: TYP.body, lineHeight: 1.6, color: C.inkDim, marginBottom: 12 }}>Die Datei <code style={{ fontFamily: SCHRIFT.mono, fontSize: 13, color: C.ink }}>finanzen-plan.json</code> (Finanzmodul v3, mit Szenarien, Annahmen und Buchungen). Sie bleibt auf dem eigenen Server — Kevin und Malin sehen dann denselben Plan.</div>
          <input ref={datei} type="file" accept="application/json,.json" aria-label="finanzen-plan.json wählen" onChange={() => setFehler(null)} style={{ display: 'block', marginBottom: 12, color: C.inkDim, fontSize: TYP.bedien }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knopf onClick={hochladen} aus={laeuft}>{laeuft ? 'Lädt …' : ersetzen ? 'Hochladen und ersetzen' : 'Hochladen'}</Knopf>
            {ersetzen && <span style={{ fontSize: 12.5, color: LEUCHT.achtung }}>Es gibt schon einen Plan — der nächste Upload ersetzt ihn.</span>}
          </div>
        </Karte>
        <Karte i={1}>
          <Ueberschrift>Leer beginnen</Ueberschrift>
          <div style={{ fontSize: TYP.body, lineHeight: 1.6, color: C.inkDim, marginBottom: 12 }}>Ein rechenbares Dokument mit Zeitachse Okt 26 bis Dez 28, einem Szenario „Basis“ und leeren Annahmen. Zeilen, Szenarien und Buchungen kommen dann aus der Arbeit — die Netto-Tabelle trägt ihr in den Annahmen nach.</div>
          <Knopf leise onClick={() => void sende(JSON.stringify({ leer: true, ersetzen }))} aus={laeuft}>Leer beginnen</Knopf>
        </Karte>
      </Raster>
      {fehler && <div role="alert" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: `${LEUCHT.kritisch}14`, color: LEUCHT.kritisch, fontSize: TYP.bedien, boxShadow: `inset 3px 0 0 ${LEUCHT.kritisch}` }}>{fehler}</div>}
      {zustand === 'fehler' && !fehler && <div role="alert" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: `${LEUCHT.kritisch}14`, color: LEUCHT.kritisch, fontSize: TYP.bedien }}>Der Plan konnte nicht geladen werden — Seite neu laden oder den Server prüfen.</div>}
    </Seite>
  );
}

'use client';

// ─── System › Datenschutz · Verzeichnis der Verarbeitungstätigkeiten (05.10.) ─
// Export als Dokument (HTML zum Drucken/PDF, JSON) — API-Adressen bewusst ohne Next-Link (kein Client-Routing auf /api). Gepflegt werden die Einträge unter Stammdaten › Datenschutz.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf } from '../ui';
import { WEG } from '@/lib/wege';

export function VerzeichnisKarte({ i = 3 }: { i?: number }) {
  return (
    <Karte i={i} id="verzeichnis">
      <Ueberschrift>Verzeichnis der Verarbeitungstätigkeiten (Art. 30)</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
        Ein Dokument aus einer Quelle: Verantwortlicher und Empfänger von hier, Verarbeitungen aus dem Verzeichnis, Löschfristen aus der Tabelle.
        Fehlende Verarbeitungen der Plattform werden beim Öffnen ergänzt; von Hand Geändertes bleibt.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={() => { window.open('/api/datenschutz/verzeichnis?format=html', '_blank', 'noopener'); }}>Als Dokument öffnen (drucken/PDF)</Knopf>
        <Knopf leise onClick={() => { window.location.href = '/api/datenschutz/verzeichnis?format=json'; }}>JSON herunterladen</Knopf>
        <Knopf leise href={WEG.stammdaten('datenschutz')}>Einträge bearbeiten</Knopf>
      </div>
    </Karte>
  );
}

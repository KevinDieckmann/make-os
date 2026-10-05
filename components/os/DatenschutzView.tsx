'use client';

// ─── MAKE OS — System › Datenschutz (05.10., Paket „DSGVO-Grundlagen im Code“) ──────────────────────────────
// Die Datenschutz-Einrichtung der Instanz an EINER Stelle: Verantwortlicher (Art. 13/30). Nur im Haushalt des Inhabers
// (die Routen antworten sonst 403); ändern darf nur der Inhaber. Die Datenschutz-Arbeit am CRM (Pflichtangaben, Anträge,
// Löschfristen) bleibt unter Markttraktion › Stammdaten › Datenschutz.

import { useCallback, useEffect, useState } from 'react';
import { Seite, Karte, Hinweis, Knopf } from './ui';
import { WEG } from '@/lib/wege';
import { VerantwortlicherKarte, type EinrichtungAntwort } from './datenschutz/Verantwortlicher';

export function DatenschutzView() {
  const [d, setD] = useState<EinrichtungAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    setFehler(null);
    const r = await fetch('/api/datenschutz/einrichtung', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) setD(r); else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  return (
    <Seite titel="Datenschutz" unter="Verantwortlicher, Empfänger, Selbstprüfung und Verzeichnis — eine Quelle für die ganze Instanz.">
      {fehler && <Hinweis art="kritisch" titel="Nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Nochmal</Knopf>}>{fehler}</Hinweis>}
      {d && <VerantwortlicherKarte d={d} onGeaendert={() => void laden()} i={0} />}
      <Karte i={1}>
        <Hinweis art="info" titel="CRM-Datenschutz" aktion={<Knopf leise href={WEG.stammdaten('datenschutz')}>Öffnen</Knopf>}>Pflichtangaben, Betroffenenanträge, Löschkonzept und Löschfristen der Kontakte liegen unter Markttraktion › Stammdaten › Datenschutz.</Hinweis>
      </Karte>
    </Seite>
  );
}

'use client';

// ─── MAKE OS — System › Datenschutz (05.10., Paket „DSGVO-Grundlagen im Code“) ──────────────────────────────
// Die Datenschutz-Einrichtung der Instanz an EINER Stelle: Verantwortlicher (Art. 13/30), Empfänger und Auftragsverarbeiter
// mit AVV-Nachweis (Art. 28/30). Nur im Haushalt des Inhabers
// (die Routen antworten sonst 403); ändern darf nur der Inhaber. Die Datenschutz-Arbeit am CRM (Pflichtangaben, Anträge,
// Löschfristen) bleibt unter Markttraktion › Stammdaten › Datenschutz.

import { useCallback, useEffect, useState } from 'react';
import { Seite, Karte, Hinweis, Knopf } from './ui';
import { WEG } from '@/lib/wege';
import { VerantwortlicherKarte, type EinrichtungAntwort } from './datenschutz/Verantwortlicher';
import { EmpfaengerKarte } from './datenschutz/Empfaenger';
import { PruefungKarte } from './datenschutz/Pruefung';
import { VerzeichnisKarte } from './datenschutz/Verzeichnis';

export function DatenschutzView() {
  const [d, setD] = useState<EinrichtungAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stand, setStand] = useState(0);
  const laden = useCallback(async () => {
    setFehler(null);
    const r = await fetch('/api/datenschutz/einrichtung', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setStand(x => x + 1); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  return (
    <Seite titel="Datenschutz" unter="Verantwortlicher, Empfänger, Selbstprüfung und Verzeichnis — eine Quelle für die ganze Instanz.">
      {fehler && <Hinweis art="kritisch" titel="Nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Nochmal</Knopf>}>{fehler}</Hinweis>}
      {d && <PruefungKarte stand={stand} i={0} />}
      {d && <VerantwortlicherKarte d={d} onGeaendert={() => void laden()} i={0} />}
      {d && <EmpfaengerKarte liste={d.empfaenger} darf={d.darf} onGeaendert={() => void laden()} i={1} />}
      {d && <VerzeichnisKarte i={2} />}
      <Karte i={3}>
        <Hinweis art="info" titel="CRM-Datenschutz" aktion={<Knopf leise href={WEG.stammdaten('datenschutz')}>Öffnen</Knopf>}>Pflichtangaben, Betroffenenanträge, Löschkonzept und Löschfristen der Kontakte liegen unter Markttraktion › Stammdaten › Datenschutz.</Hinweis>
      </Karte>
    </Seite>
  );
}

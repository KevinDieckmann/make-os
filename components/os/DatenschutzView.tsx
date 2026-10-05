'use client';

// ─── MAKE OS — System › Datenschutz (05.10., Paket „DSGVO-Grundlagen im Code“) ──────────────────────────────
// Die Datenschutz-Einrichtung der Instanz an EINER Stelle: Verantwortlicher (Art. 13/30), Empfänger und Auftragsverarbeiter
// mit AVV-Nachweis (Art. 28/30), Selbstprüfung, Verzeichnis-Export (Art. 30), Pannen-Register (Art. 33 Abs. 5, nur Inhaber), Dokumente. Nur im Haushalt des Inhabers
// (die Routen antworten sonst 403); ändern darf nur der Inhaber. Die Datenschutz-Arbeit am CRM (Pflichtangaben, Anträge,
// Löschfristen) bleibt unter Markttraktion › Stammdaten › Datenschutz.
// Betroffenenrechte v2 (05.10.): Vorlage der Art.-14-Information und „Vertragsende“ (Instanz-Export + Löschweg, nur Inhaber).
// Seit 05.10. EINE Seite für alles: dazu Gesundheit/KI/Telegram/KI-Protokoll je Person (datenschutz/KiGesundheit.tsx — für jede
// angemeldete Person, auch ohne Inhaber-Recht) und die Nachweise (Lese-Protokoll, Protokoll-Kette, Verschlüsselung — nur Inhaber).

import { useCallback, useEffect, useState } from 'react';
import { Seite, Karte, Hinweis, Knopf } from './ui';
import { WEG } from '@/lib/wege';
import { VerantwortlicherKarte, type EinrichtungAntwort } from './datenschutz/Verantwortlicher';
import { EmpfaengerKarte } from './datenschutz/Empfaenger';
import { PruefungKarte } from './datenschutz/Pruefung';
import { VerzeichnisKarte } from './datenschutz/Verzeichnis';
import { PannenKarte } from './datenschutz/Pannen';
import { DokumenteKarte } from './datenschutz/Dokumente';
import { KiGesundheitKarten } from './datenschutz/KiGesundheit';
import { NachweiseKarten } from './datenschutz/Nachweise';
import { Art14VorlageKarte, VertragsendeKarte } from './datenschutz/Betroffenenrechte';

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
    <Seite titel="Datenschutz" unter="Verantwortlicher, Einwilligungen, KI, Empfänger, Verzeichnis und Nachweise — eine Quelle für die ganze Instanz. Hinweis, keine Rechtsberatung.">
      {fehler && <Hinweis art="kritisch" titel="Nicht geladen" aktion={<Knopf leise onClick={() => void laden()}>Nochmal</Knopf>}>{fehler}</Hinweis>}
      {d && <PruefungKarte stand={stand} i={0} />}
      {d && <VerantwortlicherKarte d={d} onGeaendert={() => void laden()} i={1} />}
      <KiGesundheitKarten i={2} />
      {/* Betroffenenrechte v2 (05.10.): jede Person kommt hier an ihre eigenen Daten — für alle sichtbar, auch ohne Inhaber-Recht. */}
      <Karte i={2}>
        <Hinweis art="info" titel="Ihre eigenen Daten" aktion={<Knopf leise href={WEG.konto()}>Konto › Meine Daten</Knopf>}>Auskunft nach Art. 15 (druckbar), „Meine Daten herunterladen“ (Art. 20) und „Mein Konto löschen“ (Art. 17) — selbst, ohne den Inhaber zu fragen.</Hinweis>
      </Karte>
      {d && <EmpfaengerKarte liste={d.empfaenger} darf={d.darf} onGeaendert={() => void laden()} i={6} />}
      {d && <Art14VorlageKarte d={d} onGeaendert={() => void laden()} i={6} />}
      {d && <VerzeichnisKarte i={7} />}
      {d?.darf && <div id="nachweise"><NachweiseKarten i={8} /></div>}
      {d?.darf && <PannenKarte i={9} />}
      {d?.darf && <VertragsendeKarte i={9} />}
      <Karte i={10}>
        <Hinweis art="info" titel="CRM-Datenschutz" aktion={<Knopf leise href={WEG.stammdaten('datenschutz')}>Öffnen</Knopf>}>Pflichtangaben, Betroffenenanträge, Löschkonzept und Löschfristen der Kontakte liegen unter Markttraktion › Stammdaten › Datenschutz.</Hinweis>
      </Karte>
      <DokumenteKarte i={11} />
    </Seite>
  );
}

'use client';

// ─── Produkte · Leistungstreppe — Strategie unter dem Katalog (10.10.; seit 19.10. P2 ohne eigene Stufen-Kopien) ───────────────────────
// Bis 19.10. zeichnete diese Datei die Treppe aus den GESPEICHERTEN Stufen und bearbeitete sie als eigene Kopien. Seit „Ein Produkt, eine Karte“
// (PRODUKTE_KONZEPT.md) ist die Treppe eine Ansicht der Karten — gezeichnet in ../KatalogTreppe.tsx, Antippen öffnet die Karte, „+ Stufe“ ist
// ein neues Produkt mit Ebene. Hier bleiben: die Vorschläge aus einem Dokument (Head of Sales, Freigabe-Stapel) und — eingeklappt — Kundenreise ·
// Zielbild · Roadmap · Positionierung (11.10., Kevin: „sehr unübersichtlich“ — die Treppe bleibt sichtbar, der Rest ist einen Klick tiefer).

import { useState } from 'react';
import { Segmente, Klappbar } from '../../ui';
import { DokumentVorschau } from './AusDokument';
import { Kundenreise, Zielbild, Roadmap, PositionierungKarte } from './Teile';
import type { TreppeApi, TreppeLage } from './daten';

type Reiter = 'reise' | 'zielbild' | 'roadmap' | 'positionierung';

/** Unter dem Katalog: Dokument-Vorschläge, dann Kundenreise · Zielbild · Roadmap · Positionierung zum Aufklappen. */
export function TreppenStrategie({ api, lage }: { api: TreppeApi; lage: TreppeLage }) {
  const [reiter, setReiter] = useState<Reiter>('reise');
  const [mehr, setMehr] = useState(false);
  return (
    <>
      {lage.vorschlaege.map(v => <DokumentVorschau key={v.id} v={v} />)}
      <Klappbar id="treppe-strategie" titel="Kundenreise · Zielbild · Roadmap · Positionierung" offen={mehr} umschalten={() => setMehr(!mehr)}>
        <Segmente<Reiter> liste={[{ id: 'reise', label: 'Kundenreise' }, { id: 'zielbild', label: 'Zielbild' }, { id: 'roadmap', label: 'Roadmap' }, { id: 'positionierung', label: 'Positionierung & Story' }]} aktiv={reiter} onWahl={setReiter} />
        {reiter === 'reise' && <Kundenreise api={api} lage={lage} />}
        {reiter === 'zielbild' && <Zielbild api={api} lage={lage} />}
        {reiter === 'roadmap' && <Roadmap api={api} lage={lage} />}
        {reiter === 'positionierung' && <PositionierungKarte api={api} lage={lage} />}
      </Klappbar>
    </>
  );
}

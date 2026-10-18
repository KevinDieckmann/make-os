'use client';

// ─── Fulfillment · Fall — Kapazität vorschlagen (18.10., Gesamtprüfung L1 B10) ───────────────────────────────────────────────────────
// Der Fall kennt seinen Aufwand aus der Leistungstreppe (Stufe des Mandats, `stufeStundenWoche`). Steht in Planung › Kapazität noch keine Zuweisung zum
// Mandat, schlägt er sie vor — EIN Klick „Eintragen“ über den vorhandenen Schreibweg (PATCH /api/kapazitaet, Rechte dort). Nichts geschieht von selbst;
// ohne Treppe, ohne Aufwand, ohne Zugang zur Kapazität oder mit Zuweisung steht hier nichts.

import { useState } from 'react';
import { Hinweis, Knopf } from '../../ui';
import { useKapazitaet, kapazitaetNeu } from '../../kapazitaet/useKapazitaet';
import { useTreppe } from '../../mandate/treppe/daten';
import { stufeStundenWoche } from '@/lib/crm/treppe';
import { kapaVorschlag } from '@/lib/fulfillment/prozesse/kapazitaet-vorschlag';

export function KapazitaetVorschlag({ mandatId, kunde, zustaendig }: { mandatId: string; kunde: string; zustaendig: string | null }) {
  const kapa = useKapazitaet(true, 'business');
  const treppe = useTreppe();
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  if (fertig || !kapa.stand || !treppe.lage) return null;
  const zeile = treppe.lage.kunden.find(k => k.mandatId === mandatId);
  const stufe = zeile?.stufe ? treppe.lage.datei.stufen.find(s => s.id === zeile.stufe!.id) : undefined;
  if (!stufe) return null;
  const v = kapaVorschlag({ mandatId, zustaendig, stundenWoche: stufeStundenWoche(stufe).stunden, zuweisungen: kapa.stand.zuweisungen, personen: kapa.stand.personen });
  if (!v) return null;
  const name = kapa.stand.personen.find(p => p.id === v.person)?.name ?? 'die zuständige Person';
  const eintragen = async () => {
    const f = await kapa.aendern([{ op: 'zuweisung', zuweisung: { person: v.person, art: 'mandat', bezugId: mandatId, stundenWoche: v.stundenWoche } }]);
    if (f) { setFehler(f); return; }
    setFertig(true);
    kapazitaetNeu();
  };
  return (
    <Hinweis art="info" titel="Kapazität" aktion={<Knopf leise onClick={eintragen}>Eintragen</Knopf>}>
      Für {kunde} sind laut Leistung etwa {v.stundenWoche.toLocaleString('de-DE')} h je Woche geplant — in der Kapazität steht dazu noch nichts. Für {name} eintragen?
      {fehler ? ` ${fehler}` : ''}
    </Hinweis>
  );
}

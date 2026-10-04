'use client';

// ─── CRM — Archivieren · Zurückholen · Löschen · Papierkorb für eine Liste (04.10., Kevin: „alles anpassbar“) ─────────────
// EINE Stelle für Firmen, Mandate, Events, Segmente, Beiträge, Ausgaben und Kampagnen (Regel: lib/crm/ablage.ts):
//   · `useCrmAblage(api, liste)` → archivieren / zurückholen (Marke `archiviertAm`), löschen (Papierkorb `geloeschtAm`, mit
//     „Rückgängig“), wiederherstellen und endgültig (Rückfrage, nur aus dem Papierkorb), dazu `korb` (die Papierkorb-Einträge
//     dieser Liste aus der Antwort des Servers) und `hinweis`/`dialog` zum Einhängen.
//   · `PapierkorbKarte` zeigt den Papierkorb einer Liste (Wiederherstellen · Endgültig löschen), `AblageReiter` die drei Sichten.
// Die Zeit der Marken setzt der Server; der Browser schickt nur „jetzt“ (bzw. null zum Zurückholen).

import { useState, type ReactNode } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Punkt, Segmente, LEUCHT, useRueckgaengig, useRueckfrage, type RueckfrageDaten, type Bestaetigung } from '../ui';
import { PAPIERKORB_TAGE } from '@/lib/eintraege/sicher';
import { LISTEN_NAME, type PapierkorbListe, type CrmKorbEintrag } from '@/lib/crm/ablage';
import { type CrmApi, datum } from './daten';

export type AblageSicht = 'liste' | 'archiv' | 'papierkorb';

export interface CrmAblage {
  /** Ins Archiv (`archiviertAm`) — mit „Rückgängig“. */
  archivieren: (id: string, titel: string) => void;
  /** Aus dem Archiv zurück — mit „Rückgängig“. */
  zurueckholen: (id: string, titel: string) => void;
  /** In den Papierkorb — mit „Rückgängig“; `frage` (optional) erst als Rückfrage (Verweise nennen, Archiv anbieten). */
  loeschen: (id: string, titel: string, frage?: { text: ReactNode; archivAnbieten?: boolean }) => void;
  wiederherstellen: (id: string, titel: string) => void;
  /** Endgültig (nur aus dem Papierkorb) — hinter einer Rückfrage. `weg` ersetzt den Standardweg (Events: Serverweg mit Kaskade). */
  endgueltig: (id: string, titel: string, weg?: () => Promise<unknown>) => void;
  /** Papierkorb dieser Liste (neueste zuerst). */
  korb: CrmKorbEintrag[];
  melden: (text: string, rueck?: () => void) => void;
  fragen: (f: RueckfrageDaten) => void;
  bestaetigen: (b: Bestaetigung) => Promise<boolean>;
  /** Einmal in die Seite hängen: Rückgängig-Leiste und Rückfrage-Karte. */
  hinweis: ReactNode;
  dialog: ReactNode;
}

export function useCrmAblage(api: CrmApi, liste: PapierkorbListe): CrmAblage {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, bestaetigen, dialog } = useRueckfrage();
  const korb = (api.crm?.papierkorb ?? []).filter(e => e.liste === liste);
  const jetzt = () => new Date().toISOString();
  const archivieren = (id: string, titel: string) => {
    void api.teil(liste, id, { archiviertAm: jetzt() });
    melden(`„${titel}“ archiviert — unter „Archiv“ jederzeit zurückholbar`, () => void api.teil(liste, id, { archiviertAm: null }));
  };
  const zurueckholen = (id: string, titel: string) => {
    void api.teil(liste, id, { archiviertAm: null });
    melden(`„${titel}“ ist zurück`, () => void api.teil(liste, id, { archiviertAm: jetzt() }));
  };
  const inKorb = (id: string, titel: string) => {
    void api.teil(liste, id, { geloeschtAm: jetzt() }).then(ok => {
      if (ok) melden(`„${titel}“ im Papierkorb — ${PAPIERKORB_TAGE} Tage wiederherstellbar`, () => void api.teil(liste, id, { geloeschtAm: null }));
    });
  };
  const loeschen = (id: string, titel: string, frage?: { text: ReactNode; archivAnbieten?: boolean }) => {
    if (!frage) { inKorb(id, titel); return; }
    fragen({
      titel: `„${titel}“ in den Papierkorb?`, text: frage.text,
      wahl: [...(frage.archivAnbieten ? [{ label: 'Archivieren', ton: 'leise' as const, tun: () => archivieren(id, titel) }] : []), { label: 'In den Papierkorb', ton: 'gefahr', tun: () => inKorb(id, titel) }],
    });
  };
  const wiederherstellen = (id: string, titel: string) => {
    void api.teil(liste, id, { geloeschtAm: null });
    melden(`„${titel}“ wiederhergestellt`, () => void api.teil(liste, id, { geloeschtAm: jetzt() }));
  };
  const endgueltig = (id: string, titel: string, weg?: () => Promise<unknown>) => fragen({
    titel: `„${titel}“ endgültig löschen?`,
    text: `${LISTEN_NAME[liste].ein} verschwindet ganz. Das lässt sich nicht rückgängig machen.`,
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => (weg ? weg() : api.weg(liste, id)) }],
  });
  return { archivieren, zurueckholen, loeschen, wiederherstellen, endgueltig, korb, melden, fragen, bestaetigen, hinweis, dialog };
}

/** Die drei Sichten einer Liste: Liste · Archiv · Papierkorb (mit Anzahl). `archiv: null` = die Liste hat kein Archiv-Feld. */
export function AblageReiter({ sicht, onSicht, liste, archiv, korb, name }: { sicht: AblageSicht; onSicht: (s: AblageSicht) => void; liste: number; archiv: number | null; korb: number; name: string }) {
  const eintraege: { id: AblageSicht; label: string }[] = [{ id: 'liste', label: `${name} · ${liste}` }, ...(archiv === null ? [] : [{ id: 'archiv' as const, label: `Archiv · ${archiv}` }]), { id: 'papierkorb', label: `Papierkorb · ${korb}` }];
  return <Segmente<AblageSicht> liste={eintraege} aktiv={sicht} onWahl={onSicht} />;
}

/** Die Sicht als Zustand — wechselt man sie, schließt das Detail (über `onWechsel`). */
export function useAblageSicht(onWechsel?: () => void): [AblageSicht, (s: AblageSicht) => void] {
  const [sicht, setSicht] = useState<AblageSicht>('liste');
  return [sicht, s => { setSicht(s); onWechsel?.(); }];
}

/** Der Papierkorb einer Liste: Wiederherstellen · Endgültig löschen (Frist 30 Tage, danach der Morgenlauf). */
export function PapierkorbKarte({ ablage, liste, i = 1, weg }: { ablage: CrmAblage; liste: PapierkorbListe; i?: number; /** Endgültig über einen eigenen Serverweg (Events). */ weg?: (id: string) => Promise<unknown> }) {
  const n = LISTEN_NAME[liste];
  return (
    <Karte i={i}>
      <Ueberschrift rechts={`${PAPIERKORB_TAGE} Tage`}>Papierkorb · {n.viele}</Ueberschrift>
      <Liste>
        {ablage.korb.map(e => (
          <Zeile key={e.id} links={<Punkt farbe={C.inkLeise} />} titel={e.titel} umbrechen
            unter={`gelöscht ${datum(e.geloeschtAm.slice(0, 10))} · endgültig ab ${datum(e.bisTag)}, wenn nichts mehr darauf zeigt`}
            rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Knopf leise onClick={() => ablage.wiederherstellen(e.id, e.titel)}>Wiederherstellen</Knopf>
              <Knopf leise farbe={LEUCHT.kritisch} onClick={() => ablage.endgueltig(e.id, e.titel, weg ? () => weg(e.id) : undefined)}>Endgültig löschen</Knopf>
            </span>} />
        ))}
      </Liste>
      {!ablage.korb.length && <Leer>Der Papierkorb ist leer. Gelöschte {n.viele} liegen hier {PAPIERKORB_TAGE} Tage, bevor sie endgültig gehen.</Leer>}
    </Karte>
  );
}

/** Leertext fürs Archiv einer Liste. */
export function ArchivLeer({ liste, i = 1 }: { liste: PapierkorbListe; i?: number }) {
  return <Karte i={i}><Leer>Das Archiv ist leer. Archivierte {LISTEN_NAME[liste].viele} sind aus der Liste ausgeblendet, bleiben überall sonst lesbar und lassen sich jederzeit zurückholen.</Leer></Karte>;
}

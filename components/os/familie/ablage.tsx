'use client';

// ─── Familie & Partnerschaft — Archivieren · Löschen an jeder Liste (04.10., Kevin: „alles anpassbar“) ─────────────────
// EINE Stelle für Wichtige Tage, Menschen, Traditionen, Themen, Wünsche und Date-Ideen (Baustein `ZeileAktionen`):
//   · Archivieren = `archiviertAm` am Eintrag (der Speicher nimmt es ohne Umbau mit, lib/familie/speicher.ts) — aus der Liste
//     ausgeblendet, Erinnerungen/Agenda rechnen ohne ihn (app/api/familie `antwort`), unten unter „Archiv“ zurückholbar.
//   · Löschen = weg, mit „Rückgängig“ (10 s): der Eintrag wird mit demselben Inhalt wieder angelegt. Fremde „nur ich“-Einträge
//     lehnt der Server ohnehin ab (403-Regel in `wendeFamilieAn`) — die Aktion erscheint dafür gar nicht (`darf`).

import type { ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Liste, Zeile, Knopf, useRueckgaengig, ZeileAktionen } from '../ui';
import type { Liste as FamilieListe } from '@/lib/familie/typen';
import type { FamilieApi } from './daten';
import { Mehr } from './teile';

type Eintrag = { id: string; von?: string; sichtbarkeit?: string; archiviertAm?: string };

export interface FamilieAblage {
  archivieren: (liste: FamilieListe, e: Eintrag, titel: string) => void;
  loeschen: (liste: FamilieListe, e: Eintrag, titel: string) => void;
  /** Darf die Person den Eintrag ändern? (fremde „nur ich“-Einträge nie) */
  darf: (e: Eintrag) => boolean;
  hinweis: ReactNode;
}

export function useFamilieAblage(api: FamilieApi): FamilieAblage {
  const { melden, hinweis } = useRueckgaengig();
  const ohne = <T extends Eintrag>(e: T): T => { const n = { ...e }; delete n.archiviertAm; return n; };
  const archivieren = (liste: FamilieListe, e: Eintrag, titel: string) => {
    if (e.archiviertAm) {
      void api.setze(liste, ohne(e));
      melden(`„${titel}“ ist zurück`, () => void api.setze(liste, { ...e }));
      return;
    }
    void api.setze(liste, { ...e, archiviertAm: new Date().toISOString() });
    melden(`„${titel}“ archiviert — unten unter „Archiv“ zurückholbar`, () => void api.setze(liste, ohne(e)));
  };
  const loeschen = (liste: FamilieListe, e: Eintrag, titel: string) => {
    void api.weg(liste, e.id);
    melden(`„${titel}“ gelöscht`, () => void api.setze(liste, { ...e }));
  };
  const darf = (e: Eintrag) => e.sichtbarkeit !== 'nur-ich' || !e.von || e.von === api.d?.person;
  return { archivieren, loeschen, darf, hinweis };
}

/** Eine Zeile mit Archivieren/Löschen. */
export function MitAktionen({ ablage, liste, e, titel, children }: { ablage: FamilieAblage; liste: FamilieListe; e: Eintrag; titel: string; children: ReactNode }) {
  return (
    <ZeileAktionen titel={titel} archiviert={!!e.archiviertAm} darf={ablage.darf(e)} onArchivieren={() => ablage.archivieren(liste, e, titel)} onLoeschen={() => ablage.loeschen(liste, e, titel)}>
      {children}
    </ZeileAktionen>
  );
}

/** Das Archiv einer Liste — eingeklappt unten in der Karte, nur wenn etwas darin liegt. */
export function ArchivBlock<T extends Eintrag>({ ablage, liste, eintraege, titelVon }: { ablage: FamilieAblage; liste: FamilieListe; eintraege: T[]; titelVon: (e: T) => string }) {
  const archiv = eintraege.filter(e => e.archiviertAm);
  if (!archiv.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <Mehr titel={`Archiv · ${archiv.length}`}>
        <Liste>
          {archiv.map(e => (
            <MitAktionen key={e.id} ablage={ablage} liste={liste} e={e} titel={titelVon(e)}>
              <Zeile titel={<span style={{ color: C.inkDim, fontSize: TYP.bedien }}>{titelVon(e)}</span>} rechts={ablage.darf(e) ? <Knopf leise onClick={() => ablage.archivieren(liste, e, titelVon(e))}>Zurückholen</Knopf> : undefined} />
            </MitAktionen>
          ))}
        </Liste>
      </Mehr>
    </div>
  );
}

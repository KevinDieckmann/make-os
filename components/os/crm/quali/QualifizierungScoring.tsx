'use client';

// ─── Qualifizierung & Scoring — der Schnellknopf in der Mitte (03.10.) ──────────────────────────
// Kevin: „Leadscoring ist der Oberbegriff der Qualifizierung — mach das ‚Qualifizierung & Scoring‘, darunter Qualifizierung und die
// Scoring-Einstellungen von Marketing und von Sales, also von MQL zu SQL.“ Pillen: Qualifizierung (die Runde) · Scoring, darunter
// Marketing-Scoring · Sales-Scoring. Die Kennung `qualifizierung` und alle alten Links bleiben (lib/crm/adresse.ts).

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { LEUCHT, Karte } from '../../ui';
import { Pillen } from '../teile';
import type { QualiAnsicht } from '@/lib/crm/adresse';
import type { CrmApi } from '../daten';
import { Qualifizierung } from '../Qualifizierung';
import { useScoringEntwurf } from './ScoringEntwurf';
import { ScoringSeite, ScoringAktionen } from './ScoringEditor';

type Teil = 'runde' | 'scoring';

export function QualifizierungScoring({ api, ansicht, start, onAnsicht, zuLeads }: { api: CrmApi; ansicht: QualiAnsicht; start?: string | null; onAnsicht: (a: QualiAnsicht) => void; zuLeads: (id?: string) => void }) {
  const z = useScoringEntwurf(api);
  const teil: Teil = ansicht === 'runde' ? 'runde' : 'scoring';
  return (
    <>
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Pillen einzeilig farbe={LEUCHT.business} liste={[{ id: 'runde' as Teil, label: 'Qualifizierung' }, { id: 'scoring' as Teil, label: z.geaendert ? 'Scoring ●' : 'Scoring' }]} aktiv={teil} onWahl={t => onAnsicht(t === 'runde' ? 'runde' : 'scoring')} />
      </div>
      {teil === 'scoring' && (
        <>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
            <Pillen einzeilig farbe={LEUCHT.agenten} liste={[{ id: 'scoring' as QualiAnsicht, label: 'Marketing-Scoring · bis MQL' }, { id: 'scoring-sales' as QualiAnsicht, label: 'Sales-Scoring · MQL → SQL' }]} aktiv={ansicht} onWahl={onAnsicht} />
          </div>
          {z.daten && z.fehler === '' ? null : z.fehler ? <Karte i={0}><div style={{ color: LEUCHT.kritisch, fontSize: 13 }}>{z.fehler}</div></Karte> : null}
          <ScoringSeite api={api} seite={ansicht === 'scoring-sales' ? 'sales' : 'marketing'} z={z} i={1} />
          <ScoringAktionen api={api} z={z} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Die Methode und der Grund für den Vorschlag stehen in SCORING.md im Projekt.</div>
        </>
      )}
      {teil === 'runde' && <Qualifizierung api={api} start={start} zuLeads={zuLeads} />}
    </>
  );
}

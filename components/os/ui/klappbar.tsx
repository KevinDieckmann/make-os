'use client';

// ─── Standard · Klappbar: ein Abschnitt zum Auf- und Zuklappen (08.10.) ─────
// Eine Seite, auf der mehrere frühere Unterseiten zusammenstehen (Finanzen › Planung, Fragebogen Teil 3 Frage 10), ordnet sie als
// Abschnitte: Kopfzeile = Knopf (Anzeigeschrift, Pfeil, optional Zähler), darunter der Inhalt — zugeklappt wird er GAR NICHT gerendert
// (die Seite bleibt am Handy leicht). Der Inhalt trägt seine eigenen Karten; der Abschnitt ist keine Karte (keine Karte in der Karte).
// Der Abschnitt trägt `id` als Anker (#<id>) mit Abstand zum Kopf. Ob er offen ist, entscheidet die Seite (gemerkt, Sprung, Vorgabe).

import { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';

export function Klappbar({ id, titel, offen, umschalten, zaehler, rechts, children }: {
  id: string; titel: ReactNode; offen: boolean; umschalten: () => void;
  /** Kleine Zahl am Titel (z. B. offene Buchungen) — nur, wenn größer als null. */
  zaehler?: number;
  /** Rechts in der Kopfzeile (leiser Zusatz). */
  rechts?: ReactNode;
  children: ReactNode;
}) {
  const inhaltId = `${id}-inhalt`;
  return (
    <section id={id} data-abschnitt={id} className={`ui-klappbar${offen ? '' : ' ui-klappbar-zu'}`} aria-label={typeof titel === 'string' ? titel : undefined}>
      <div className="ui-klappbar-kopf">
        <h2 className="ui-klappbar-titel" style={{ fontFamily: SCHRIFT.display }}>
          <button type="button" className="ui-klappbar-knopf fassbar" onClick={umschalten} aria-expanded={offen} aria-controls={inhaltId} title={offen ? 'Zuklappen' : 'Aufklappen'} style={{ color: C.ink }}>
            <ChevronDown size={18} aria-hidden className="ui-klappbar-pfeil" style={{ color: C.inkLeise }} />
            <span>{titel}</span>
            {zaehler ? <span className="fp-zaehler" aria-label={`${zaehler} offen`}>{zaehler}</span> : null}
          </button>
        </h2>
        {rechts && <span className="ui-klappbar-rechts" style={{ color: C.inkLeise }}>{rechts}</span>}
      </div>
      {offen && <div id={inhaltId} className="ui-karten ui-klappbar-inhalt">{children}</div>}
    </section>
  );
}

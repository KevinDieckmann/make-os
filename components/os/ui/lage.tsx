'use client';

// ─── Standard · Lage: „Antwort zuerst“ (11.10.) ────────────────────────────────────────────────────────────────────────────
// Kevin 11.10.: „Es muss einfach zu verstehen sein, über die Visualisierungen; so ist es sehr unübersichtlich.“ Oben in einer Ansicht steht in
// HÖCHSTENS FÜNF Kacheln, wo wir stehen, was als Nächstes kommt und was hängt: je Kachel eine Zahl (Farbe = Bedeutung, Rot nur für echte
// Dringlichkeit), ein Wort dazu, ein kurzer Zusatz, optional ein Balken — und der Weg dorthin. Die Einzelheiten stehen darunter oder einen Klick
// tiefer. Der Baustein rechnet nichts: die Seite gibt fertige Werte (sie kommen vom Server bzw. aus den Daten der Seite).
//
// Einsatz: Heute (Tages-Briefing), Produkte & Mandate (Überblick), Markttraktion › Planung (Plan gegen Ist der Stufe).

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { FARBE as C, SCHRIFT, ECKE, FLAECHE_STIL, BEDEUTUNG_FARBE, TIEF, type Bedeutung } from '@/lib/make-one/design';

/** Mehr Kacheln zeigt der Baustein nie (der Rest gehört einen Klick tiefer). */
export const LAGE_MAX = 5;

export interface LageEintrag {
  id: string;
  /** Die Zahl bzw. der kurze Wert („3“, „1/3“, „—“). */
  wert: string;
  /** Ein bis drei Wörter: was die Zahl ist („Termine heute“). */
  label: string;
  /** Eine kurze Zeile darunter („zuerst 09:00“, „davon 1 kritisch“). */
  unter?: ReactNode;
  /** Bedeutung = Farbe der Zahl; `kritisch`/`achtung` tönen die Kachel. Ohne Angabe ruhig. */
  bedeutung?: Bedeutung;
  /** Optional ein Balken 0–1 (Fortschritt, Plan gegen Ist). */
  anteil?: number;
  /** Weg dorthin (interne Adresse über `WEG`) — oder `onClick`. */
  href?: string;
  onClick?: () => void;
}

/** Die Lage in höchstens fünf Kacheln — `label` beschreibt die Gruppe für Bildschirmleser. */
export function Lage({ eintraege, label = 'Lage auf einen Blick', max = LAGE_MAX }: { eintraege: readonly LageEintrag[]; label?: string; max?: number }) {
  const liste = eintraege.slice(0, Math.max(0, Math.min(max, LAGE_MAX)));
  if (!liste.length) return null;
  return (
    <div className="ui-lage" role="list" aria-label={label}>
      {liste.map(e => <div key={e.id} role="listitem" style={{ minWidth: 0, display: 'grid' }}><LageKachel e={e} /></div>)}
    </div>
  );
}

function LageKachel({ e }: { e: LageEintrag }) {
  const farbe = e.bedeutung && e.bedeutung !== 'neutral' ? BEDEUTUNG_FARBE[e.bedeutung] : null;
  const getoent = e.bedeutung === 'kritisch' || e.bedeutung === 'achtung';
  const stil: CSSProperties = { ...(getoent && farbe ? { background: TIEF.flaeche(farbe), border: `1px solid ${TIEF.rand(farbe)}` } : FLAECHE_STIL.flach), borderRadius: ECKE.flach };
  const inhalt = (
    <>
      <span className="ui-lage-wert" style={{ fontFamily: SCHRIFT.display, color: farbe ?? C.ink }}>{e.wert}</span>
      <span className="ui-lage-label">{e.label}</span>
      {e.unter != null && e.unter !== '' && <span className="ui-lage-unter">{e.unter}</span>}
      {e.anteil != null && Number.isFinite(e.anteil) && <LageBalken anteil={e.anteil} farbe={farbe ?? C.aktiv} />}
    </>
  );
  if (e.href) return <Link href={e.href} className="ui-lage-kachel ui-lage-klick fassbar" style={stil}>{inhalt}</Link>;
  if (e.onClick) return <button type="button" onClick={e.onClick} className="ui-lage-kachel ui-lage-klick fassbar" style={stil}>{inhalt}</button>;
  return <div className="ui-lage-kachel" style={stil}>{inhalt}</div>;
}

/** Der Balken der Kachel — aus `span`s (die Kachel kann ein Link oder Knopf sein; dort gehört kein `div` hinein), sonst wie `Fortschritt`. */
function LageBalken({ anteil, farbe }: { anteil: number; farbe: string }) {
  const p = Math.round(Math.max(0, Math.min(1, anteil)) * 100);
  return (
    <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} className="ui-lage-balken">
      <span className="ui-fuell" style={{ width: `${p}%`, background: TIEF.verlauf(farbe) }} />
    </span>
  );
}

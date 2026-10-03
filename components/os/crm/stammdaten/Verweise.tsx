'use client';

// ─── Stammdaten › Übersicht — wo die anderen Stammdaten liegen ──────────────
// Produkte & Leistungen (eigener Bereich /os/mandate?s=produkte), Segmente
// (Marketing › Segmente) und das Team (fest in lib/crm/team.ts: wer welche
// Welt verantwortet, wer wie viele Beziehungen hält). Echte Zahlen aus dem
// Stand, keine Attrappen.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Liste, Zeile, Chip, Raster, Zahl, LEUCHT } from '../../ui';
import { mandateLink } from '@/lib/crm/adresse';
import { TEAM, haeltBeziehung } from '@/lib/crm/team';
import { WELTEN } from '@/lib/crm/traktion';
import { Person } from '../team';
import type { CrmApi } from '../daten';

const knopfLink = { display: 'inline-block', fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, textDecoration: 'none' } as const;
const text = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 } as const;

export function Verweise({ api, zuBereich, ab = 3 }: { api: CrmApi; zuBereich: (b: string, a?: string) => void; ab?: number }) {
  const stand = api.crm?.stand;
  const leistungen = stand?.leistungen ?? [];
  const aktiv = leistungen.filter(l => l.status === 'aktiv').length;
  const segmente = stand?.segmente ?? [];
  const kontakte = api.kontakte ?? [];
  return (
    <Raster min={280}>
      <Karte i={ab}>
        <Ueberschrift rechts={stand ? <Chip farbe={aktiv ? LEUCHT.gut : C.inkDim}>{aktiv} aktiv</Chip> : undefined}>Produkte & Leistungen</Ueberschrift>
        <div style={text}>Der Leistungskatalog mit Preis, Lieferumfang, Phasen und Unterlagen — jeder Deal und jedes Mandat zeigt auf ein Produkt.</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Zahl wert={stand ? String(leistungen.length) : undefined} label="Produkte" />
          <Link href={mandateLink('produkte')} className="fassbar" style={knopfLink}>Produkte öffnen ›</Link>
        </div>
      </Karte>
      <Karte i={ab + 1}>
        <Ueberschrift>Segmente</Ueberschrift>
        <div style={text}>Gespeicherte Filter über die Kartei — für Kampagnen, Einladungen und Newsletter. Gepflegt im Marketing.</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Zahl wert={stand ? String(segmente.length) : undefined} label="Segmente" />
          <Knopf leise onClick={() => zuBereich('marketing', 'segmente')}>Segmente öffnen ›</Knopf>
        </div>
      </Karte>
      <Karte i={ab + 2}>
        <Ueberschrift>Team</Ueberschrift>
        <div style={text}>Verantwortung je Welt steht fest im Code (lib/crm/team.ts); zuständig je Eintrag ist, wer eingetragen ist — Kevin, Malin oder beide.</div>
        <Liste>
          {TEAM.map(t => {
            const welten = t.verantwortet.map(w => WELTEN.find(x => x.id === w)?.label ?? w).join(' und ');
            const haelt = kontakte.filter(k => haeltBeziehung(k) === t.id).length;
            return <Zeile key={t.id} links={<Person id={t.id} groesse={26} />} titel={t.name} unter={`verantwortet ${welten}`} rechts={api.kontakte ? <Chip farbe={t.farbe}>{haelt} Beziehungen</Chip> : undefined} />;
          })}
        </Liste>
      </Karte>
    </Raster>
  );
}

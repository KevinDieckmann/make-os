'use client';

// ─── Angebots-Tool · Liste „Angebote“ (28.09.) ──────────────────────────────
// Zweite Ansicht im Bereich: alle Angebote mit Filter Status, Gesellschaft und Suche
// (Nummer, Titel, Empfänger — suchPasst). Klick öffnet Entwurf bzw. gestelltes Angebot.

import { useMemo, useState } from 'react';
import type { Angebot, AngebotsStatus } from '@/lib/crm/typen';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { anzeigename } from '@/lib/make-one/crm';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste as ListeRahmen, Zeile, Leer, Knopf, Chip, Punkt, feld } from '../../schlank';
import { Pillen } from '../teile';
import type { CrmApi } from '../daten';
import { suchPasst } from '@/lib/text/such-norm';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { angeboteFiltern, angebotSummen, euroCent, ANGEBOT_STATUS_LABEL, gesellschaftLabel } from '@/lib/crm/angebote';
import { STATUS_FARBE } from './Ansicht';
import type { AngebotDaten } from './angebot-daten';

type Filter = 'alle' | 'entwurf' | 'offen' | 'angenommen' | 'abgelehnt' | 'abgelaufen';
const FILTER: { id: Filter; label: string }[] = [{ id: 'alle', label: 'Alle' }, { id: 'entwurf', label: 'Entwürfe' }, { id: 'offen', label: 'Offen' }, { id: 'angenommen', label: 'Angenommen' }, { id: 'abgelehnt', label: 'Abgelehnt' }, { id: 'abgelaufen', label: 'Abgelaufen' }];
const GES: { id: Gesellschaftskennung | 'alle'; label: string }[] = [{ id: 'alle', label: 'Alle Gesellschaften' }, ...KERN_EINHEITEN.map(e => ({ id: e.id, label: e.label }))];

export function AngebotListe({ api, daten, onOeffnen, onNeu }: { api: CrmApi; daten: AngebotDaten; onOeffnen: (id: string) => void; onNeu: () => void }) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [ges, setGes] = useState<Gesellschaftskennung | 'alle'>('alle');
  const [suche, setSuche] = useState('');
  const kontakte = api.kontakte ?? [];
  const firmen = api.crm?.stand.firmen ?? [];
  const name = (a: Angebot) => {
    const k = a.kontaktId ? kontakte.find(x => x.id === a.kontaktId) : undefined;
    const f = a.firmaId ? firmen.find(x => x.id === a.firmaId) : undefined;
    return [k ? anzeigename(k) : a.empfaenger?.name, f?.name ?? a.empfaenger?.firma].filter(Boolean).join(' · ');
  };
  const liste = useMemo(() => angeboteFiltern(daten.angebote ?? [], { status: filter === 'alle' ? null : (filter as AngebotsStatus | 'offen'), gesellschaft: ges === 'alle' ? null : ges, suche }, name, (felder, frage) => suchPasst(felder, frage)),
    [daten.angebote, filter, ges, suche, kontakte, firmen]); // eslint-disable-line react-hooks/exhaustive-deps
  const alle = daten.angebote ?? [];
  const offen = alle.filter(a => a.status === 'gestellt');
  const offenWert = offen.reduce((s, a) => s + angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer }).gesamt.netto, 0);

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf farbe={LEUCHT.gut} onClick={onNeu}>+ Neues Angebot</Knopf>}>Angebote</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>{offen.length ? `${offen.length} offen · ${euroCent(offenWert)} netto Gesamtwert` : 'Kein offenes Angebot.'}{alle.filter(a => a.status === 'entwurf').length ? ` · ${alle.filter(a => a.status === 'entwurf').length} Entwürfe` : ''}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={FILTER} aktiv={filter} onWahl={setFilter} /></div>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={GES} aktiv={ges} onWahl={setGes} /></div>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen — Nummer, Titel, Empfänger" aria-label="Angebote durchsuchen" style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />
        </div>
      </Karte>
      <Karte i={1}>
        {daten.angebote === null ? <Leer>lädt …</Leer> : !liste.length ? <Leer>{alle.length ? 'Kein Angebot passt zum Filter.' : 'Noch kein Angebot — „+ Neues Angebot“.'}</Leer> : (
          <ListeRahmen>
            {liste.map(a => {
              const s = angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer });
              return (
                <Zeile key={a.id} onClick={() => onOeffnen(a.id)} links={<Punkt farbe={STATUS_FARBE[a.status]} />}
                  titel={<>{a.nummer ? `${a.nummer} · ` : ''}{a.titel || 'ohne Titel'}</>}
                  unter={[name(a) || 'ohne Empfänger', gesellschaftLabel(a.gesellschaft), a.gestelltAm ? `gestellt ${a.gestelltAm.slice(8, 10)}.${a.gestelltAm.slice(5, 7)}.` : `geändert ${a.geaendert.slice(8, 10)}.${a.geaendert.slice(5, 7)}.`, `${euroCent(s.gesamt.netto)} netto`].join(' · ')}
                  rechts={<Chip farbe={STATUS_FARBE[a.status]}>{ANGEBOT_STATUS_LABEL[a.status]}</Chip>} />
              );
            })}
          </ListeRahmen>
        )}
      </Karte>
    </>
  );
}

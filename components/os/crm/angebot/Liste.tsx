'use client';

// ─── Angebots-Tool · Liste „Angebote“ (28.09.) ──────────────────────────────
// Zweite Ansicht im Bereich: alle Angebote mit Filter Status, Gesellschaft und Suche
// (Nummer, Titel, Empfänger — suchPasst). Klick öffnet Entwurf bzw. gestelltes Angebot.
// 04.10. (Kevin: „alles anpassbar“): jede Zeile am Baustein `ZeileAktionen` — Archivieren (jeder Status, `archiviertAm`, Filter
// „Archiv“, zurückholbar) und Löschen = Papierkorb (nur Entwürfe, 30 Tage, Rückgängig). Ein gestelltes Angebot ist eine
// Geschäftsunterlage: es wird nie gelöscht — die Rückfrage bietet das Archiv an. Server: /api/crm/angebot `ablage`.

import { useMemo, useState } from 'react';
import type { Angebot, AngebotsStatus } from '@/lib/crm/typen';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { anzeigename } from '@/lib/make-one/crm';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste as ListeRahmen, Zeile, Leer, Knopf, Chip, Punkt, feld, ZeileAktionen, useRueckgaengig, useRueckfrage } from '../../ui';
import { PAPIERKORB_TAGE, papierkorbBis } from '@/lib/eintraege/sicher';
import { Pillen } from '../teile';
import type { CrmApi } from '../daten';
import { suchPasst } from '@/lib/text/such-norm';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { angeboteFiltern, angebotSummen, euroCent, ANGEBOT_STATUS_LABEL, gesellschaftLabel } from '@/lib/crm/angebote';
import { STATUS_FARBE } from './Ansicht';
import { angebotPost, type AngebotDaten } from './angebot-daten';

type Filter = 'alle' | 'entwurf' | 'offen' | 'angenommen' | 'abgelehnt' | 'abgelaufen' | 'archiv' | 'papierkorb';
const FILTER: { id: Filter; label: string }[] = [{ id: 'alle', label: 'Alle' }, { id: 'entwurf', label: 'Entwürfe' }, { id: 'offen', label: 'Offen' }, { id: 'angenommen', label: 'Angenommen' }, { id: 'abgelehnt', label: 'Abgelehnt' }, { id: 'abgelaufen', label: 'Abgelaufen' }, { id: 'archiv', label: 'Archiv' }, { id: 'papierkorb', label: 'Papierkorb' }];
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
  // Archiv nur im Filter „Archiv“, Papierkorb (Entwürfe) nur im Filter „Papierkorb“ — sonst die laufende Liste.
  const basis = useMemo(() => (filter === 'papierkorb' ? daten.papierkorb : (daten.angebote ?? []).filter(a => (filter === 'archiv' ? !!a.archiviertAm : !a.archiviertAm))), [daten.angebote, daten.papierkorb, filter]);
  const liste = useMemo(() => angeboteFiltern(basis, { status: filter === 'alle' || filter === 'archiv' || filter === 'papierkorb' ? null : (filter as AngebotsStatus | 'offen'), gesellschaft: ges === 'alle' ? null : ges, suche }, name, (felder, frage) => suchPasst(felder, frage)),
    [basis, filter, ges, suche, kontakte, firmen]); // eslint-disable-line react-hooks/exhaustive-deps
  const alle = (daten.angebote ?? []).filter(a => !a.archiviertAm);
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  /** Archiv/Papierkorb über den Server-Weg — die Antwort ersetzt das Angebot; danach neu laden (Papierkorb wandert). */
  const ablage = async (a: Angebot, art: 'archiv' | 'papierkorb', zurueck = false): Promise<boolean> => {
    const r = await angebotPost({ aktion: 'ablage', id: a.id, art, ...(zurueck ? { zurueck: true } : {}) });
    if (!r.ok) { daten.setFehler(r.fehler ?? 'Nicht geändert.'); return false; }
    await daten.laden();
    return true;
  };
  const titel = (a: Angebot) => `${a.nummer ? `${a.nummer} · ` : ''}${a.titel || 'ohne Titel'}`;
  const archivieren = (a: Angebot) => void ablage(a, 'archiv', !!a.archiviertAm).then(ok => {
    if (ok) melden(a.archiviertAm ? `„${titel(a)}“ ist zurück` : `„${titel(a)}“ archiviert — im Filter „Archiv“ zurückholbar`, () => void ablage(a, 'archiv', !a.archiviertAm));
  });
  const loeschen = (a: Angebot) => {
    if (a.status !== 'entwurf') {
      fragen({ titel: `„${titel(a)}“ wird nicht gelöscht`, text: 'Ein gestelltes Angebot ist eine Geschäftsunterlage (Nummer, PDF in der Ablage) und bleibt erhalten. Archivieren blendet es aus der Liste aus — jederzeit zurückholbar.', wahl: a.archiviertAm ? [] : [{ label: 'Archivieren', tun: () => archivieren(a) }] });
      return;
    }
    void ablage(a, 'papierkorb').then(ok => { if (ok) melden(`Entwurf „${titel(a)}“ im Papierkorb — ${PAPIERKORB_TAGE} Tage wiederherstellbar`, () => void ablage(a, 'papierkorb', true)); });
  };
  const wiederherstellen = (a: Angebot) => void ablage(a, 'papierkorb', true).then(ok => { if (ok) melden(`Entwurf „${titel(a)}“ wiederhergestellt`, () => void ablage(a, 'papierkorb')); });
  const endgueltig = (a: Angebot & { stand: string }) => fragen({
    titel: `Entwurf „${titel(a)}“ endgültig löschen?`, text: 'Der Entwurf verschwindet ganz. Das lässt sich nicht rückgängig machen.',
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: async () => { const r = await angebotPost({ aktion: 'loeschen', id: a.id, stand: a.stand }); if (!r.ok) daten.setFehler(r.fehler ?? 'Nicht gelöscht.'); await daten.laden(); } }],
  });
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
        {daten.angebote === null ? <Leer>lädt …</Leer> : !liste.length ? <Leer>{filter === 'archiv' ? 'Das Archiv ist leer. Archivierte Angebote sind aus der Liste ausgeblendet und bleiben an Deals und in der Ablage lesbar.' : filter === 'papierkorb' ? `Der Papierkorb ist leer. Gelöschte Entwürfe liegen hier ${PAPIERKORB_TAGE} Tage, bevor sie endgültig gehen.` : alle.length ? 'Kein Angebot passt zum Filter.' : 'Noch kein Angebot — „+ Neues Angebot“.'}</Leer> : (
          <ListeRahmen>
            {liste.map(a => {
              const s = angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer });
              if (filter === 'papierkorb') return (
                <Zeile key={a.id} links={<Punkt farbe={C.inkLeise} />} titel={titel(a)} umbrechen
                  unter={`${name(a) || 'ohne Empfänger'} · gelöscht ${a.geloeschtAm ? `${a.geloeschtAm.slice(8, 10)}.${a.geloeschtAm.slice(5, 7)}.` : ''} · endgültig ab ${a.geloeschtAm ? papierkorbBis(a.geloeschtAm).split('-').reverse().join('.') : '—'}`}
                  rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}><Knopf leise onClick={() => wiederherstellen(a)}>Wiederherstellen</Knopf><Knopf leise farbe={LEUCHT.kritisch} onClick={() => endgueltig(a as Angebot & { stand: string })}>Endgültig löschen</Knopf></span>} />
              );
              return (
                <ZeileAktionen key={a.id} titel={titel(a)} archiviert={!!a.archiviertAm} onArchivieren={() => archivieren(a)} onLoeschen={() => loeschen(a)}>
                <Zeile onClick={() => onOeffnen(a.id)} links={<Punkt farbe={STATUS_FARBE[a.status]} />}
                  titel={<>{a.nummer ? `${a.nummer} · ` : ''}{a.titel || 'ohne Titel'}</>}
                  unter={[name(a) || 'ohne Empfänger', gesellschaftLabel(a.gesellschaft), a.gestelltAm ? `gestellt ${a.gestelltAm.slice(8, 10)}.${a.gestelltAm.slice(5, 7)}.` : `geändert ${a.geaendert.slice(8, 10)}.${a.geaendert.slice(5, 7)}.`, `${euroCent(s.gesamt.netto)} netto`].join(' · ')}
                  rechts={<Chip farbe={STATUS_FARBE[a.status]}>{ANGEBOT_STATUS_LABEL[a.status]}</Chip>} />
                </ZeileAktionen>
              );
            })}
          </ListeRahmen>
        )}
      </Karte>
      {dialog}
      {hinweis}
    </>
  );
}

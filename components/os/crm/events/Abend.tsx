'use client';

// ─── Event · Abend — Einlass-Modus fürs Tablet ──────────────────────────────
// Große Flächen, ein Tipp je Gast: da oder nicht gekommen. Dazu je Gast die
// Notiz vom Abend — worüber gesprochen, was zugesagt, wen vorstellen. Genau
// diese Notiz steht beim Nachfassen wieder da (48 Stunden). Fotos nur mit
// Freigabe; eine Visitenkarte ist keine Einwilligung.
// Zwei Geräte gleichzeitig (Kevin und Malin am Einlass): jeder Tipp ändert
// nur diesen einen Gast und nur dieses Feld (api.teil), nie das Event. Der
// Stand kommt hier alle 8 Sekunden neu, an jedem Gast steht, wer ihn zuletzt
// geändert hat (eingecheckt von …), und wessen Gast er ist (lädt ein).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Fortschritt, Leer, Chip, LEUCHT } from '../../schlank';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { einlader } from '@/lib/crm/eventplanung';
import { TEAM, nameVon } from '@/lib/crm/team';
import type { Teilnahme, TeilnahmeStatus } from '@/lib/crm/typen';
import { neueId } from '../daten';
import { Pillen } from '../teile';
import { Person } from '../team';
import { Notizfeld, KarteiSuche, JePerson, gastSetzen, type ReiterProps } from './gemeinsam';

function GrossKnopf({ an, farbe, onClick, children }: { an: boolean; farbe: string; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className="fassbar" style={{
      flex: 1, minWidth: 120, minHeight: 48, padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontSize: TYP.body, fontWeight: 700,
      border: `1px solid ${an ? farbe : 'rgba(255,255,255,.12)'}`, background: an ? `${farbe}26` : 'rgba(255,255,255,.04)', color: an ? farbe : C.ink,
      boxShadow: an ? `0 0 18px -6px ${farbe}` : undefined,
    }}>{children}</button>
  );
}

type Sicht = 'alle' | 'erwartet' | 'da';

export function Abend({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const [weitereOffen, setWeitereOffen] = useState(false);
  const [sicht, setSicht] = useState<Sicht>('alle');
  // Am Einlass zählt jede Sekunde: öfter abgleichen als sonst (20 s), solange dieser Reiter offen ist.
  const { laden } = api;
  useEffect(() => { const t = setInterval(() => void laden(), 8_000); return () => clearInterval(t); }, [laden]);

  const nachId = new Map((api.kontakte ?? []).map(k => [k.id, k]));
  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id)
    .map(t => ({ t, k: nachId.get(t.kontaktId) }))
    .filter((x): x is { t: Teilnahme; k: Kontakt } => !!x.k)
    .sort((a, b) => anzeigename(a.k).localeCompare(anzeigename(b.k), 'de'));
  const erwartet = gaeste.filter(x => x.t.status === 'zugesagt' || x.t.status === 'da' || x.t.status === 'no_show');
  const weitere = gaeste.filter(x => x.t.status === 'eingeladen' || x.t.status === 'vorgemerkt');
  const da = gaeste.filter(x => x.t.status === 'da');
  const nochNicht = erwartet.filter(x => x.t.status === 'zugesagt').length;
  const eingechecktVon: Record<string, number> = {};
  const checker = (t: Teilnahme) => { const v = t.eingechecktVon ?? t.geaendertVon; return v && TEAM.some(m => m.id === v) ? v : null; };
  for (const { t } of da) { const v = checker(t); if (v) eingechecktVon[v] = (eingechecktVon[v] ?? 0) + 1; }
  const zeigen = erwartet.filter(x => sicht === 'alle' || (sicht === 'erwartet' ? x.t.status === 'zugesagt' : x.t.status === 'da'));
  // Nur den Status schicken — „nochmal tippen“ nimmt ihn zurück auf „zugesagt“.
  // Wer eincheckt, steht am Gast (eingechecktVon) — nicht nur „zuletzt geändert“, das eine spätere Notiz überschreiben würde.
  const setzeStatus = (t: Teilnahme, status: TeilnahmeStatus) => gastSetzen(api, t, { status: t.status === status ? 'zugesagt' : status, eingechecktVon: t.status === status ? undefined : api.ich ?? undefined });

  const karte = ({ t, k }: { t: Teilnahme; k: Kontakt }, spontan?: boolean) => {
    const gastVon = einlader(t, k, e);
    const von = checker(t);
    return (
      <div key={t.id} style={{ padding: 14, borderRadius: 14, background: t.status === 'da' ? `${LEUCHT.gut}0D` : 'rgba(255,255,255,.03)', border: `1px solid ${t.status === 'da' ? `${LEUCHT.gut}40` : 'rgba(255,255,255,.06)'}`, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, fontWeight: 700, padding: 0 }}>{anzeigename(k)}</button>
          {k.firma && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{k.firma}</span>}
          {t.rolle && t.rolle !== 'gast' && <Chip farbe={LEUCHT.agenten}>{t.rolle === 'co_host' ? 'Co-Host' : 'Speaker'}</Chip>}
          <span title={`Lädt ein und fasst nach: ${nameVon(gastVon)}`} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12, color: C.inkLeise }}><Person id={gastVon} groesse={16} />Gast von {nameVon(gastVon)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: t.fotofreigabe ? LEUCHT.gut : C.inkLeise }}>
            <button onClick={() => gastSetzen(api, t, { fotofreigabe: !t.fotofreigabe })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
              {t.fotofreigabe ? '✓ Fotos freigegeben' : 'Fotos: nicht freigegeben'}
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {spontan
            ? <GrossKnopf an={false} farbe={LEUCHT.gut} onClick={() => gastSetzen(api, t, { status: 'da', eingechecktVon: api.ich ?? undefined })}>Ist doch da</GrossKnopf>
            : <>
              <GrossKnopf an={t.status === 'da'} farbe={LEUCHT.gut} onClick={() => setzeStatus(t, 'da')}>{t.status === 'da' ? '✓ Da' : 'Da'}</GrossKnopf>
              <GrossKnopf an={t.status === 'no_show'} farbe={LEUCHT.kritisch} onClick={() => setzeStatus(t, 'no_show')}>Nicht gekommen</GrossKnopf>
            </>}
        </div>
        {!spontan && (t.status === 'da' || t.status === 'no_show') && von && (
          <div title="zuletzt geändert von" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.inkLeise }}>
            <Person id={von} groesse={16} />{t.status === 'da' ? 'eingecheckt' : 'als nicht gekommen markiert'} von {von === api.ich ? 'dir' : nameVon(von)}
          </div>
        )}
        {!spontan && <Notizfeld gross zeilen={2} wert={t.notiz} platzhalter="Notiz vom Abend — worüber gesprochen, was zugesagt, wen vorstellen" onFertig={notiz => gastSetzen(api, t, { notiz: notiz || undefined })} />}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <Ueberschrift rechts={<span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{da.length} / {erwartet.length} da</span>}>Einlass</Ueberschrift>
        <Fortschritt anteil={erwartet.length ? da.length / erwartet.length : 0} farbe={LEUCHT.gut} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: C.inkLeise }}>
          {erwartet.length > 0 && <span>{nochNicht ? `${nochNicht} noch erwartet` : 'Alle Zugesagten sind da oder abgehakt.'}</span>}
          {da.length > 0 && Object.keys(eingechecktVon).length > 0 && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>eingecheckt von <JePerson zahlen={eingechecktVon} /></span>}
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Zwei Geräte gleichzeitig gehen: jeder Tipp ändert nur diesen Gast, der Stand kommt alle 8 Sekunden neu.</div>
      </div>
      {erwartet.length > 0 && (
        <Pillen liste={[{ id: 'alle', label: `Alle ${erwartet.length}` }, { id: 'erwartet', label: `Noch erwartet ${nochNicht}` }, { id: 'da', label: `Da ${da.length}` }]} aktiv={sicht} onWahl={setSicht} farbe={LEUCHT.gut} />
      )}
      {zeigen.map(x => karte(x))}
      {!erwartet.length && <Leer>Noch keine Zusagen. Wer zugesagt hat, steht hier am Abend mit großem „Da“-Knopf und Notizfeld.</Leer>}
      {erwartet.length > 0 && !zeigen.length && <Leer>{sicht === 'erwartet' ? 'Niemand mehr erwartet — jetzt Notizen vom Abend festhalten.' : 'Noch niemand eingecheckt.'}</Leer>}

      {weitere.length > 0 && (
        <div>
          <button onClick={() => setWeitereOffen(!weitereOffen)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: '6px 0' }}>
            {weitereOffen ? '▾' : '▸'} Ohne Zusage, aber doch gekommen? ({weitere.length})
          </button>
          {weitereOffen && <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>{weitere.map(x => karte(x, true))}</div>}
        </div>
      )}
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Spontan dabei — aus der Kartei, direkt als „da“:</div>
        <KarteiSuche api={api} e={e} platzhalter="Name suchen …" onWahl={kontaktId => api.setze('teilnahmen', { id: neueId('t'), eventId: e.id, kontaktId, status: 'da', rolle: 'gast' })} />
      </div>
    </div>
  );
}

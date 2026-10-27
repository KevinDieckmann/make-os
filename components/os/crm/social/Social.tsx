'use client';

// ─── Markttraktion · Marketing › Social (26.10.2026) ────────────────────────────────────────────────────────────────────────────────
// Kevin 26.10.: „Ein Agent, der unser Social Media aufbaut und verwaltet.“ Diese Ansicht ist die Grundlage: Kanäle (Markenprofil, Persona,
// Leitplanken), Serienformate, Folgen mit Prüfung und Leitplanken-Entscheidung, Messungen, Analyse und Import der Plattform-Zahlen.
// MAKE OS veröffentlicht nichts selbst — die Anbindung an TikTok, Instagram und YouTube folgt, wenn die API-Prüfungen der Plattformen durch
// sind. Bis dahin zeigt jede Folge, was der Agent nach den Leitplanken selbst dürfte. Daten nur über `useSocial` (/api/social).

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Leerzustand, Pillen, Segmente } from '../../ui';
import { PLATTFORM_NAME, type AutonomieStufe } from '@/lib/social/typen';
import { useSocial, type SocialApi, type MitStand } from './daten';
import type { SocialKanal } from '@/lib/social/typen';
import { KanalForm } from './KanalForm';
import { Folgen } from './Folgen';
import { Analyse, Formate, Import } from './Analyse';
import { Startpaket } from './Startpaket';

type Bereich = 'folgen' | 'formate' | 'analyse' | 'import' | 'kanal';
const BEREICHE: { id: Bereich; label: string }[] = [
  { id: 'folgen', label: 'Folgen' }, { id: 'formate', label: 'Formate' }, { id: 'analyse', label: 'Analyse' }, { id: 'import', label: 'Import' }, { id: 'kanal', label: 'Kanal' },
];
const STUFEN: { id: `${AutonomieStufe}`; label: string }[] = [
  { id: '0', label: 'Nur Entwürfe' }, { id: '1', label: 'Freigabe per Klick' }, { id: '2', label: 'Selbstständig mit Leitplanken' },
];

export function Social() {
  const api = useSocial();
  const [kanalId, setKanalId] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const [bereich, setBereich] = useState<Bereich>('folgen');
  const kanaele = (api.lage?.datei.kanaele ?? []).filter(k => !k.archiviertAm);
  const kanal = kanaele.find(k => k.id === kanalId) ?? kanaele[0];

  if (!api.lage) return api.fehler ? <Hinweis art="kritisch" rolle="alert">{api.fehler}</Hinweis> : <Karte><span style={{ color: C.inkLeise }}>Lädt …</span></Karte>;
  return (
    <>
      {api.fehler && <Hinweis art="achtung" rolle="alert" aktion={<Knopf leise onClick={() => api.setFehler(null)}>OK</Knopf>}>{api.fehler}</Hinweis>}
      {neu || !kanal ? (
        neu ? <KanalForm api={api} onFertig={() => { setNeu(false); setKanalId(null); }} />
          : <>
            <Karte><Leerzustand symbol="◎" titel="Noch kein Social-Kanal" aktion={<Knopf haupt onClick={() => setNeu(true)}>Ersten Kanal anlegen</Knopf>}>
              Ein Kanal bündelt die Plattformen eines Accounts mit Markenprofil und Leitplanken. Danach: Formate, Folgen, Zahlen — und die Analyse sagt, was trägt.
            </Leerzustand></Karte>
            <Startpaket api={api} />
          </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}>
              <Pillen einzeilig liste={kanaele.map(k => ({ id: k.id, label: k.name }))} aktiv={kanal.id} onWahl={id => { setKanalId(id); setBereich('folgen'); }} />
            </div>
            <Knopf leise onClick={() => setNeu(true)}>+ Kanal</Knopf>
          </div>
          <KanalKopf api={api} kanal={kanal} />
          <Segmente liste={BEREICHE} aktiv={bereich} onWahl={setBereich} umbrechen />
          {bereich === 'folgen' && <Folgen key={kanal.id} api={api} kanal={kanal} />}
          {bereich === 'formate' && <Formate api={api} kanal={kanal} />}
          {bereich === 'analyse' && <Analyse api={api} kanal={kanal} />}
          {bereich === 'import' && <><Import key={kanal.id} api={api} kanal={kanal} /><Startpaket api={api} /></>}
          {bereich === 'kanal' && <>
            <KanalForm key={kanal.stand} api={api} kanal={kanal} onFertig={() => setBereich('folgen')} />
            <Karte><Knopf leise onClick={() => api.schreiben([{ op: 'kanal-archiv', id: kanal.id, archiv: true, stand: kanal.stand }])}>Kanal archivieren</Knopf></Karte>
          </>}
        </>
      )}
    </>
  );
}

function KanalKopf({ api, kanal }: { api: SocialApi; kanal: MitStand<SocialKanal> }) {
  const lp = kanal.leitplanken;
  const w = api.lage!.woche[kanal.id];
  const folgen = api.lage!.datei.folgen.filter(f => f.kanalId === kanal.id);
  const selbst = folgen.filter(f => api.lage!.folgen[f.id]?.weg.weg === 'selbst').length;
  const stapel = folgen.filter(f => api.lage!.folgen[f.id]?.weg.weg === 'stapel').length;
  return (
    <Karte>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {kanal.plattformen.map(p => <Chip key={p} farbe={C.aktiv}>{PLATTFORM_NAME[p]}</Chip>)}
        {kanal.kiKanal && <Chip farbe={LEUCHT.achtung}>KI-Kanal{kanal.persona ? ` · ${kanal.persona.name}` : ''}</Chip>}
      </span>}>{kanal.name}{kanal.handle ? <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}> · @{kanal.handle}</span> : null}</Ueberschrift>
      {kanal.marke.versprechen && <p style={{ color: C.inkDim, margin: '0 0 12px' }}>{kanal.marke.versprechen}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: C.inkDim, fontSize: TYP.bedien, marginBottom: 12 }}>
        <span>{folgen.length} Folgen</span>
        <span>Woche: {w?.veroeffentlicht ?? 0} veröffentlicht · {(w?.views ?? 0).toLocaleString('de-DE')} Aufrufe · {w?.follows ?? 0} neue Follower</span>
        <span>{selbst} würde der Agent selbst posten · {stapel} warten auf Freigabe</span>
      </div>
      <Segmente liste={STUFEN} aktiv={`${lp.autonomie}`} umbrechen
        onWahl={s => api.schreiben([{ op: 'kanal', eintrag: { id: kanal.id, leitplanken: { ...lp, autonomie: Number(s) } }, stand: kanal.stand }])} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        <Knopf farbe={lp.postenAus ? LEUCHT.gut : LEUCHT.kritisch} onClick={() => api.schreiben([{ op: 'notaus', id: kanal.id, posten: !lp.postenAus, stand: kanal.stand }])}>{lp.postenAus ? 'Posten fortsetzen' : 'Not-Aus: Posten anhalten'}</Knopf>
        <Knopf farbe={lp.antwortenAus ? LEUCHT.gut : LEUCHT.kritisch} onClick={() => api.schreiben([{ op: 'notaus', id: kanal.id, antworten: !lp.antwortenAus, stand: kanal.stand }])}>{lp.antwortenAus ? 'Antworten fortsetzen' : 'Not-Aus: Antworten anhalten'}</Knopf>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Tageslimit {lp.postsProTag} Posts · {lp.antwortenProTag} Antworten · {lp.dmsProTag} DMs</span>
      </div>
      <p style={{ color: C.inkLeise, fontSize: TYP.bedien, margin: '12px 0 0' }}>MAKE OS veröffentlicht noch nichts selbst — die Plattform-Anbindung folgt nach den API-Prüfungen. Bis dahin zeigt jede Folge, was der Agent nach diesen Leitplanken dürfte.</p>
    </Karte>
  );
}

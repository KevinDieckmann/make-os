'use client';

// ─── Markttraktion · Marketing › Social (26.10.2026) ────────────────────────────────────────────────────────────────────────────────
// Kevin 26.10.: „Ein Agent, der unser Social Media aufbaut und verwaltet.“ Diese Ansicht ist die Grundlage: Kanäle (Markenprofil, Persona,
// Leitplanken), Serienformate, Folgen mit Prüfung und Leitplanken-Entscheidung, Messungen, Analyse und Import der Plattform-Zahlen.
// Seit 27.10. („voll automatisiert“) mit dem Bereich „Automatik“: Redaktionsplan, Verbindungen, Warteschlange — gepostet wird nur über den
// Takt nach den Leitplanken und nur mit einer Plattform-Verbindung (heute LinkedIn als Person). Daten nur über `useSocial` (/api/social).

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Leerzustand, Pillen, Segmente } from '../../ui';
import { PLATTFORM_NAME, KONTO_ART_NAME, type AutonomieStufe } from '@/lib/social/typen';
import { Ziele } from './Ziele';
import { NeuerKanal, usePersonen } from './KanalArt';
import { useGesellschaftenKurz } from '@/lib/gesellschaften/client';
import { einheitAusGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { useSocial, type SocialApi, type MitStand } from './daten';
import type { SocialKanal } from '@/lib/social/typen';
import { KanalForm } from './KanalForm';
import { Folgen } from './Folgen';
import { Analyse, Formate, Import } from './Analyse';
import { Startpaket } from './Startpaket';
import { Automatik } from './Automatik';
import { Werkstatt, type WerkstattStart } from './Werkstatt';
import { Community } from './Community';

type Bereich = 'folgen' | 'werkstatt' | 'community' | 'automatik' | 'ziele' | 'formate' | 'analyse' | 'import' | 'kanal';
const BEREICHE: { id: Bereich; label: string }[] = [
  { id: 'folgen', label: 'Folgen' }, { id: 'werkstatt', label: 'Werkstatt' }, { id: 'community', label: 'Kommentare & DMs' }, { id: 'automatik', label: 'Automatik' }, { id: 'ziele', label: 'Ziele' }, { id: 'formate', label: 'Formate' }, { id: 'analyse', label: 'Analyse' }, { id: 'import', label: 'Import' }, { id: 'kanal', label: 'Kanal' },
];
const STUFEN: { id: `${AutonomieStufe}`; label: string }[] = [
  { id: '0', label: 'Nur Entwürfe' }, { id: '1', label: 'Freigabe per Klick' }, { id: '2', label: 'Selbstständig mit Leitplanken' },
];

export function Social() {
  const api = useSocial();
  const [kanalId, setKanalId] = useState<string | null>(null);
  const [neu, setNeu] = useState<false | 'vorlage' | 'frei'>(false);
  const [bereich, setBereich] = useState<Bereich>('folgen');
  const [werkstattStart, setWerkstattStart] = useState<WerkstattStart | null>(null);
  const kanaele = (api.lage?.datei.kanaele ?? []).filter(k => !k.archiviertAm);
  const kanal = kanaele.find(k => k.id === kanalId) ?? kanaele[0];

  if (!api.lage) return api.fehler ? <Hinweis art="kritisch" rolle="alert">{api.fehler}</Hinweis> : <Karte><span style={{ color: C.inkLeise }}>Lädt …</span></Karte>;
  return (
    <>
      {api.fehler && <Hinweis art="achtung" rolle="alert" aktion={<Knopf leise onClick={() => api.setFehler(null)}>OK</Knopf>}>{api.fehler}</Hinweis>}
      {neu || !kanal ? (
        neu === 'frei' ? <KanalForm api={api} onFertig={id => { setNeu(false); setKanalId(id ?? null); setBereich('folgen'); }} />
          : neu === 'vorlage' ? <NeuerKanal api={api} onFertig={id => { setNeu(false); setKanalId(id ?? null); setBereich(id ? 'ziele' : 'folgen'); }} ohneVorlage={() => setNeu('frei')} />
          : <>
            <Karte><Leerzustand symbol="◎" titel="Noch kein Social-Kanal" aktion={<Knopf haupt onClick={() => setNeu('vorlage')}>Ersten Kanal anlegen</Knopf>}>
              Ein Kanal ist ein Account — ohne Gesicht, die Marke einer Person oder der Account einer Gesellschaft. Er bündelt die Plattformen mit Markenprofil, Leitplanken und Zielen.
            </Leerzustand></Karte>
            <Startpaket api={api} />
          </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}>
              <Pillen einzeilig liste={kanaele.map(k => ({ id: k.id, label: k.name }))} aktiv={kanal.id} onWahl={id => { setKanalId(id); setBereich('folgen'); }} />
            </div>
            <Knopf leise onClick={() => setNeu('vorlage')}>+ Kanal</Knopf>
          </div>
          <KanalKopf api={api} kanal={kanal} />
          <Segmente liste={BEREICHE} aktiv={bereich} onWahl={setBereich} umbrechen />
          {bereich === 'folgen' && <Folgen key={kanal.id} api={api} kanal={kanal} zurWerkstatt={st => { setWerkstattStart(st); setBereich('werkstatt'); }} />}
          {bereich === 'werkstatt' && <Werkstatt key={kanal.id} api={api} kanal={kanal} start={werkstattStart} onStartVerbraucht={() => setWerkstattStart(null)} />}
          {bereich === 'community' && <Community key={kanal.id} api={api} kanal={kanal} />}
          {bereich === 'automatik' && <Automatik key={kanal.stand} api={api} kanal={kanal} />}
          {bereich === 'ziele' && <Ziele key={kanal.id} api={api} kanal={kanal} />}
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
  const personen = usePersonen();
  const register = useGesellschaftenKurz();
  const kl = api.lage!.kanaele[kanal.id];
  const einrichtung = (kl?.befunde ?? []).filter(b => b.stufe !== 'hinweis');
  const hinweise = (kl?.befunde ?? []).filter(b => b.stufe === 'hinweis');
  const zielWarn = (kl?.ziele ?? []).filter(z => z.ampel === 'hinter' || z.ampel === 'verfehlt').length;
  const personName = kanal.person ? personen.find(p => p.speicher === kanal.person)?.name ?? 'Person' : null;
  const absender = kanal.gesellschaft ? register?.find(g => g.id === kanal.gesellschaft)?.name ?? (istGesellschaft(kanal.gesellschaft) ? einheitAusGesellschaft(kanal.gesellschaft) : 'Gesellschaft') : null;
  // Personenmarke: Stufe 2 schaltet nur die Person selbst ein (Server: 403) — die anderen sehen die Stufen 0 und 1.
  const stufen = kanal.art === 'person' && kanal.person && kanal.person !== api.lage!.ich && lp.autonomie !== 2 ? STUFEN.filter(s => s.id !== '2') : STUFEN;
  const w = api.lage!.woche[kanal.id];
  const folgen = api.lage!.datei.folgen.filter(f => f.kanalId === kanal.id);
  const selbst = folgen.filter(f => api.lage!.folgen[f.id]?.weg.weg === 'selbst').length;
  const stapel = folgen.filter(f => api.lage!.folgen[f.id]?.weg.weg === 'stapel').length;
  const bereit = folgen.filter(f => api.lage!.folgen[f.id]?.weg.weg === 'bereit').length;
  const verbunden = api.lage!.automatik.verbindungen.filter(v => v.kanalId === kanal.id && v.zustand === 'aktiv').length;
  return (
    <Karte>
      <Ueberschrift rechts={<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {kanal.plattformen.map(p => <Chip key={p} farbe={C.aktiv}>{PLATTFORM_NAME[p]}</Chip>)}
        <Chip farbe={C.inkDim}>{KONTO_ART_NAME[kanal.art ?? 'faceless']}{personName ? ` · ${personName}` : ''}</Chip>
        {absender && <Chip farbe={C.inkDim}>{absender}</Chip>}
        {kanal.sichtbarkeit === 'person' && <Chip farbe={C.inkDim}>nur die Person</Chip>}
        {kanal.kiKanal && <Chip farbe={LEUCHT.achtung}>KI-Kanal{kanal.persona ? ` · ${kanal.persona.name}` : ''}</Chip>}
      </span>}>{kanal.name}{kanal.handle ? <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}> · @{kanal.handle}</span> : null}</Ueberschrift>
      {kanal.marke.versprechen && <p style={{ color: C.inkDim, margin: '0 0 12px' }}>{kanal.marke.versprechen}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: C.inkDim, fontSize: TYP.bedien, marginBottom: 12 }}>
        <span>{folgen.length} Folgen</span>
        <span>Woche: {w?.veroeffentlicht ?? 0} veröffentlicht · {(w?.views ?? 0).toLocaleString('de-DE')} Aufrufe · {w?.follows ?? 0} neue Follower</span>
        <span>{selbst} würde der Agent selbst posten · {bereit ? `${bereit} freigegeben · ` : ''}{stapel} warten auf Freigabe</span>
        {(kl?.ziele.length ?? 0) > 0 && <span>{kl!.ziele.length} Ziel{kl!.ziele.length === 1 ? '' : 'e'}{zielWarn ? ` · ${zielWarn} dahinter` : ''}</span>}
      </div>
      {einrichtung.length > 0 && <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>{einrichtung.map(b => <Hinweis key={b.code} art="achtung">{b.text}</Hinweis>)}</div>}
      {hinweise.length > 0 && <div style={{ display: 'grid', gap: 4, marginBottom: 12, color: C.inkLeise, fontSize: TYP.bedien }}>{hinweise.map(b => <span key={b.code}>· {b.text}</span>)}</div>}
      <Segmente liste={stufen} aktiv={`${lp.autonomie}`} umbrechen
        onWahl={s => api.schreiben([{ op: 'kanal', eintrag: { id: kanal.id, leitplanken: { ...lp, autonomie: Number(s) } }, stand: kanal.stand }])} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        <Knopf farbe={lp.postenAus ? LEUCHT.gut : LEUCHT.kritisch} onClick={() => api.schreiben([{ op: 'notaus', id: kanal.id, posten: !lp.postenAus, stand: kanal.stand }])}>{lp.postenAus ? 'Posten fortsetzen' : 'Not-Aus: Posten anhalten'}</Knopf>
        <Knopf farbe={lp.antwortenAus ? LEUCHT.gut : LEUCHT.kritisch} onClick={() => api.schreiben([{ op: 'notaus', id: kanal.id, antworten: !lp.antwortenAus, stand: kanal.stand }])}>{lp.antwortenAus ? 'Antworten fortsetzen' : 'Not-Aus: Antworten anhalten'}</Knopf>
        <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>Tageslimit {lp.postsProTag} Posts · {lp.antwortenProTag} Antworten · {lp.dmsProTag} DMs</span>
      </div>
      <p style={{ color: C.inkLeise, fontSize: TYP.bedien, margin: '12px 0 0' }}>{verbunden
        ? `Verbunden mit ${verbunden} Plattform${verbunden === 1 ? '' : 'en'}: MAKE OS postet zum Termin, was diese Leitplanken erlauben — der Rest wartet auf euch (Automatik).`
        : 'Noch keine Plattform verbunden — MAKE OS postet nichts selbst. Unter „Automatik“ verbinden; bis dahin zeigt jede Folge, was der Agent dürfte.'}</p>
    </Karte>
  );
}

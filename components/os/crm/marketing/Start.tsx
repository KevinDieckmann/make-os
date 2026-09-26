'use client';

// ─── Markttraktion · Marketing › Start — drei Schritte statt leerer Übersicht (27.09.) ──
// Solange es keine Positionierung und keinen Beitrag gibt, zeigt Marketing keine
// leere Übersicht, sondern führt in drei Schritten hin:
//   1  Positionierung   Wofür wir stehen, Zielgruppe, Ton, drei Themensäulen —
//                       gespeichert wie auf der Positionierungs-Seite (POST /api/crm/marketing)
//   2  Erster Beitrag   Titel, Kanal, Datum, Säule, Stimme — als Entwurf im Redaktionsplan
//   3  Erste Zielgruppe Ein Segment aus den Vorlagen (Live-Zahl aus der Kartei)
// Jeder Schritt lässt sich überspringen; danach übernimmt die normale Übersicht.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, feld, LEUCHT } from '../../schlank';
import type { Beitrag, MarketingEinstellung } from '@/lib/crm/typen';
import { kontextAus, segmentAuswerten } from '@/lib/crm/segmente';
import { EINSTELLUNG_GRENZEN as G, BEITRAG_KANAELE, STIMMEN_WAHL, SEGMENT_VORLAGEN, vorlageAlsSegment, kriterienText, einstellungAus, leereEinstellung, genitiv } from '@/lib/crm/marketing';
import { nameVon, verantwortlich } from '@/lib/crm/team';
import { type CrmApi, neueId, plusTage } from '../daten';
import { Pillen, Feldzeile } from '../teile';

type Schritt = 1 | 2 | 3;
const SCHRITTE: { id: Schritt; label: string }[] = [{ id: 1, label: 'Positionierung' }, { id: 2, label: 'Erster Beitrag' }, { id: 3, label: 'Erste Zielgruppe' }];
const SAEULEN_START = ['', '', ''];

export function Start({ api, onFertig, onUeberspringen }: { api: CrmApi; onFertig: () => void; onUeberspringen: () => void }) {
  const crm = api.crm;
  const ich = api.ich;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const gespeichert = useMemo(() => einstellungAus(crm?.stand ?? {}), [crm]);
  const [schritt, setSchritt] = useState<Schritt>(1);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  // Schritt 1
  const [e, setE] = useState<MarketingEinstellung>(() => ({ ...leereEinstellung(), ...gespeichert }));
  const [saeulen, setSaeulen] = useState<string[]>(gespeichert.saeulen.length ? gespeichert.saeulen.map(s => s.name) : SAEULEN_START);
  // Schritt 2
  const [titel, setTitel] = useState('');
  const [kanal, setKanal] = useState<Beitrag['kanal']>('linkedin');
  const [tag, setTag] = useState(plusTage(heute, 7));
  const [saeule, setSaeule] = useState('');
  const [stimme, setStimme] = useState<string>(ich ?? verantwortlich('marketing'));
  const [beitragId, setBeitragId] = useState<string | null>(null);
  // Schritt 3
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const ctx = useMemo(() => (crm ? kontextAus(crm.stand, heute) : null), [crm, heute]);
  const vorlagen = useMemo(() => (ctx ? SEGMENT_VORLAGEN.map(v => ({ v, anzahl: segmentAuswerten(kontakte, v.kriterien, ctx).anzahl })) : []), [kontakte, ctx]);
  if (!crm) return null;
  const einstellung = einstellungAus(crm.stand);

  const positionierungSpeichern = async () => {
    setLaeuft(true); setMeldung('');
    const body: MarketingEinstellung = { ...e, saeulen: saeulen.map((n, i) => ({ id: e.saeulen[i]?.id ?? neueId('s'), name: n.trim(), beschreibung: e.saeulen[i]?.beschreibung ?? '' })).filter(s => s.name) };
    const r = await fetch('/api/crm/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'einstellung', einstellung: body }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht gespeichert — keine Verbindung.'); return; }
    setE(r.einstellung);
    if (r.einstellung.saeulen[0]) setSaeule(r.einstellung.saeulen[0].id);
    await api.laden();
    setSchritt(2);
  };
  const beitragAnlegen = async () => {
    const t = titel.trim();
    if (!t) return;
    setLaeuft(true);
    const b: Beitrag = { id: neueId('bt'), titel: t.slice(0, 200), kanal, status: tag ? 'entwurf' : 'idee', ...(tag ? { datum: tag } : {}), ...(saeule ? { saeule } : {}), wirkung: [], quellen: [], ...(ich ? { zustaendig: ich } : {}), stimme, geaendert: new Date().toISOString() };
    await api.setze('beitraege', b as unknown as { id: string } & Record<string, unknown>);
    setLaeuft(false);
    setBeitragId(b.id);
    setSchritt(3);
  };
  const segmentAnlegen = async (v: (typeof SEGMENT_VORLAGEN)[number]) => {
    setLaeuft(true);
    const s = vorlageAlsSegment(v, neueId('sg'), new Date().toISOString());
    await api.setze('segmente', s as unknown as { id: string } & Record<string, unknown>);
    setLaeuft(false);
    setSegmentId(s.id);
  };
  const saeulenWahl = [{ id: '', label: 'keine' }, ...(e.saeulen.length ? e.saeulen : einstellung.saeulen).map(s => ({ id: s.id, label: s.name }))];
  const bereich = (f: 'positionierung' | 'icp', platzhalter: string, zeilen = 4) => (
    <textarea value={e[f]} rows={zeilen} maxLength={G[f]} placeholder={platzhalter} aria-label={platzhalter} onChange={x => setE({ ...e, [f]: x.target.value })} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />
  );

  return (
    <Karte i={0} akzent={LEUCHT.puls}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={<button onClick={onUeberspringen} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Ohne Start zur Übersicht</button>}>Marketing aufsetzen — drei Schritte</Ueberschrift>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {SCHRITTE.map(s => <Chip key={s.id} farbe={s.id === schritt ? LEUCHT.puls : s.id < schritt ? LEUCHT.gut : C.inkLeise}>{s.id < schritt ? '✓ ' : `${s.id} · `}{s.label}</Chip>)}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
        {schritt === 1 && 'Bevor der erste Beitrag entsteht: Wofür stehen wir, für wen, in welchem Ton — und drei Themen, zu denen wir eine eigene Einsicht haben. Der Head of Marketing liest das als eure Worte.'}
        {schritt === 2 && `Ein Beitrag mit Datum ist der Anfang eines Redaktionsplans. Ohne Eintrag schreibt ${nameVon(verantwortlich('marketing'))} (Verantwortung Marketing); die Stimme sagt, in wessen Namen er erscheint.`}
        {schritt === 3 && 'Ein Segment ist ein gespeicherter Filter über die Kartei — wen meinen wir mit Beiträgen, Einladungen und Kampagnen? Eine Vorlage reicht für den Anfang.'}
      </div>

      {schritt === 1 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkDim }}><span>Wofür wir stehen — in einem Absatz *</span><span style={{ fontSize: 11, color: C.inkLeise }}>{e.positionierung.length}/{G.positionierung}</span></div>
            {bereich('positionierung', 'Für wen lösen wir welches Problem, und warum gerade wir?')}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12.5, color: C.inkDim }}>Zielgruppe (ICP)</div>
            {bereich('icp', 'Branche, Größe, Rolle, Auslöser — wer ist ein idealer Kunde, wer nicht?', 3)}
          </div>
          <Feldzeile label="Ton"><input value={e.ton} maxLength={G.ton} placeholder="z. B. klar, direkt, keine Floskeln; Sie auf LinkedIn, Du im Newsletter" aria-label="Ton" onChange={x => setE({ ...e, ton: x.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} /></Feldzeile>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12.5, color: C.inkDim }}>Drei Themensäulen — wiederkehrende Themen mit eigener Einsicht</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 6 }}>
              {saeulen.map((s, i) => <input key={i} value={s} maxLength={G.name} placeholder={`Säule ${i + 1}${i === 0 ? ' *' : ''}`} aria-label={`Säule ${i + 1}`} onChange={x => setSaeulen(saeulen.map((y, j) => (j === i ? x.target.value : y)))} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />)}
            </div>
          </div>
          {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf aus={laeuft || !e.positionierung.trim() || !saeulen[0]?.trim()} onClick={() => void positionierungSpeichern()}>{laeuft ? 'speichert …' : 'Speichern und weiter'}</Knopf>
            <button onClick={() => setSchritt(2)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Später</button>
            <span style={{ fontSize: 12, color: C.inkLeise }}>Pflicht: die Positionierung und eine Säule. Beschreibungen der Säulen später unter „Positionierung“.</span>
          </div>
        </div>
      )}

      {schritt === 2 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <Feldzeile label="Titel *"><input value={titel} maxLength={200} onChange={x => setTitel(x.target.value)} placeholder="Worum geht es — eine Einsicht, konkret" aria-label="Titel des Beitrags" autoFocus style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} /></Feldzeile>
          <Feldzeile label="Kanal"><Pillen liste={BEITRAG_KANAELE} aktiv={kanal} onWahl={setKanal} /></Feldzeile>
          <Feldzeile label="Datum"><input type="date" value={tag} onChange={x => setTag(x.target.value)} aria-label="Datum" style={{ ...feld, width: 170, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
          <Feldzeile label="Säule">{saeulenWahl.length > 1 ? <Pillen liste={saeulenWahl} aktiv={saeule} onWahl={setSaeule} /> : <span style={{ fontSize: 12.5, color: C.inkLeise }}>Ohne Säulen (Schritt 1) — später unter „Positionierung“.</span>}</Feldzeile>
          <Feldzeile label="Erscheint als"><Pillen liste={STIMMEN_WAHL} aktiv={stimme} onWahl={setStimme} /></Feldzeile>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <Knopf aus={laeuft || !titel.trim()} onClick={() => void beitragAnlegen()}>{laeuft ? '…' : `Als ${tag ? 'Entwurf' : 'Idee'} anlegen und weiter`}</Knopf>
            <button onClick={() => setSchritt(3)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Später</button>
            <span style={{ fontSize: 12, color: C.inkLeise }}>{ich && stimme !== ich && stimme !== 'marke' ? `Erscheint in ${genitiv(nameVon(stimme))} Namen — vor dem Planen braucht es das Okay dieser Person (Redaktionsplan).` : 'Text, Link und Wirkung kommen im Redaktionsplan dazu.'}</span>
          </div>
        </div>
      )}

      {schritt === 3 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {beitragId && <div style={{ fontSize: 12.5, color: LEUCHT.gut }}>Erster Beitrag steht im Redaktionsplan.</div>}
          <Liste>
            {vorlagen.map(({ v, anzahl }) => {
              const da = (crm.stand.segmente ?? []).find(s => s.name.trim().toLowerCase() === v.name.toLowerCase());
              return <Zeile key={v.name} titel={v.name} unter={`${kriterienText(v.kriterien)} · heute ${anzahl} Personen`}
                rechts={da ? <Chip farbe={LEUCHT.gut}>angelegt</Chip> : <Knopf leise aus={laeuft} onClick={() => void segmentAnlegen(v)}>Übernehmen</Knopf>} />;
            })}
          </Liste>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf onClick={onFertig}>{segmentId || crm.stand.segmente.length ? 'Fertig — zur Übersicht' : 'Ohne Segment zur Übersicht'}</Knopf>
            <span style={{ fontSize: 12, color: C.inkLeise }}>Segmente sind später frei änderbar; aus einem Segment lässt sich direkt eine Kampagne planen.</span>
          </div>
        </div>
      )}
    </Karte>
  );
}

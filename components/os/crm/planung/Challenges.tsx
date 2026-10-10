'use client';

// ─── Markttraktion · Planung — Wochen-Challenges (10.10.) ────────────────────────────────────────────────────────
// Kevin: „Dann wöchentliche Challenges, wo wir in die Gespräche gehen und weitere Projekte und Opportunities suchen.“ Je Woche 1–3
// Challenges (je Person oder gemeinsam); der Fortschritt kommt aus echten Aktivitäten (Gespräche, Leads, Angebote, Deals, Power Hours,
// reaktivierte Kontakte, Begegnungen auf Events — lib/crm/planung.ts `wochenIst`), nie von Hand. Vorschläge aus den Lücken des Plans
// (Regelwerk, ohne Modell). Jede Challenge führt in die passende Liste, um Opportunities zu finden. Darunter der Rückblick der Vorwoche.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, auswahl, Chip, Leer, Fortschritt, LEUCHT } from '../../ui';
import type { ChallengeArt, Challenge } from '@/lib/crm/planung-daten';
import type { ChallengeStand, ChallengeVorschlag } from '@/lib/crm/planung';
import { datum, type PlanungApi, type PlanungLage } from './daten';

type MitStand = Challenge & { stand: string };

function ChallengeZeile({ s, lage, api, rueckblick }: { s: ChallengeStand; lage: PlanungLage; api: PlanungApi; rueckblick?: boolean }) {
  const c = s.challenge as MitStand;
  const eintrag = (lage.datei.challenges as MitStand[]).find(x => x.id === c.id);
  const [text, setText] = useState(c.rueckblick ?? '');
  const wer = c.person === 'beide' ? 'gemeinsam' : lage.team.find(t => t.id === c.person)?.name ?? c.person;
  const f = s.erreicht ? LEUCHT.gut : rueckblick ? LEUCHT.achtung : C.aktiv;
  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: TYP.body }}>{c.titel}</b><Chip farbe={C.inkDim}>{wer}</Chip>
          {s.erreicht && <Chip farbe={LEUCHT.gut}>geschafft</Chip>}
        </span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!rueckblick && <Knopf leise href={s.href}>{s.linkLabel} ›</Knopf>}
          {eintrag && <Knopf leise farbe={LEUCHT.kritisch} ariaLabel={`Challenge „${c.titel}“ entfernen`} onClick={async () => { await api.schreibe([{ op: 'challenge-weg', id: c.id, stand: eintrag.stand }]); }}>×</Knopf>}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
        <Fortschritt anteil={s.anteil} farbe={f} />
        <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}><b>{s.ist}</b> / {c.ziel}</span>
      </div>
      {rueckblick && eintrag && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder="Rückblick: was lief, was nehmen wir mit?" aria-label="Rückblick" style={feld} />
          {text !== (c.rueckblick ?? '') && <Knopf onClick={async () => { await api.schreibe([{ op: 'challenge', stand: eintrag.stand, eintrag: { id: c.id, rueckblick: text.trim() || null } }]); }}>Speichern</Knopf>}
        </div>
      )}
    </div>
  );
}

function NeueChallenge({ lage, api }: { lage: PlanungLage; api: PlanungApi }) {
  const [art, setArt] = useState<ChallengeArt>('gespraeche');
  const [ziel, setZiel] = useState('5');
  const [person, setPerson] = useState('beide');
  const [titel, setTitel] = useState('');
  const label = lage.auswahl.challengeArten.find(a => a.id === art)?.einheit ?? '';
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'end' }}>
      <Feldzeile label="Art"><select value={art} onChange={e => setArt(e.target.value as ChallengeArt)} style={{ ...auswahl, width: '100%' }}>{lage.auswahl.challengeArten.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></Feldzeile>
      <Feldzeile label="Ziel"><input value={ziel} onChange={e => setZiel(e.target.value)} inputMode="numeric" style={feld} /></Feldzeile>
      <Feldzeile label="Für"><select value={person} onChange={e => setPerson(e.target.value)} style={{ ...auswahl, width: '100%' }}><option value="beide">gemeinsam</option>{lage.team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Feldzeile>
      <Feldzeile label="Titel (optional)"><input value={titel} onChange={e => setTitel(e.target.value)} maxLength={100} placeholder={`${ziel} ${label}`} style={feld} /></Feldzeile>
      <div><Knopf onClick={async () => { if (await api.schreibe([{ op: 'challenge', eintrag: { woche: lage.woche, art, ziel: Number(ziel), person, titel: titel.trim() || `${ziel} ${label}` } }])) setTitel(''); }}>+ Challenge</Knopf></div>
    </div>
  );
}

export function Challenges({ api, lage }: { api: PlanungApi; lage: PlanungLage }) {
  const ch = lage.challenges;
  const uebernehmen = (v: ChallengeVorschlag) => api.schreibe([{ op: 'challenge', eintrag: { woche: lage.woche, art: v.art, ziel: v.ziel, person: v.person, titel: v.titel, ...(v.kanalId ? { kanalId: v.kanalId } : {}) } }]);
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Chip farbe={C.aktiv}>Woche ab {datum(lage.woche)}</Chip>}>Challenges dieser Woche</Ueberschrift>
        {ch.aktuell.length ? ch.aktuell.map(s => <ChallengeZeile key={s.challenge.id} s={s} lage={lage} api={api} />) : <Leer>Noch keine Challenge für diese Woche — einen Vorschlag übernehmen oder selbst anlegen.</Leer>}
        <div style={{ marginTop: 14 }}><NeueChallenge lage={lage} api={api} /></div>
      </Karte>
      {ch.vorschlaege.length > 0 && (
        <Karte i={1} ton={LEUCHT.business}>
          <Ueberschrift>Vorschläge aus den Lücken des Plans</Ueberschrift>
          <div style={{ display: 'grid', gap: 10 }}>
            {ch.vorschlaege.map(v => (
              <div key={`${v.art}|${v.kanalId ?? ''}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ minWidth: 0 }}><b style={{ fontSize: TYP.body }}>{v.titel}</b><span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkDim }}>{v.grund}</span></span>
                <span style={{ display: 'flex', gap: 6 }}><Knopf leise href={v.href}>{v.linkLabel} ›</Knopf><Knopf onClick={() => uebernehmen(v)}>Übernehmen</Knopf></span>
              </div>
            ))}
          </div>
        </Karte>
      )}
      <Karte i={2} flach>
        <Ueberschrift>Rückblick — Woche ab {datum(lage.vorwoche)}</Ueberschrift>
        {ch.vorwoche.length ? ch.vorwoche.map(s => <ChallengeZeile key={s.challenge.id} s={s} lage={lage} api={api} rueckblick />)
          : <Leer>Letzte Woche gab es keine Challenge.</Leer>}
        <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>
          Diese Woche bisher (Team): {ch.istWoche.gespraeche} Gespräche · {ch.istWoche.leads} neue Leads · {ch.istWoche.angebote} Angebote · {ch.istWoche.deals} neue Deals · {ch.istWoche.powerhours} Power Hours · {ch.istWoche.reaktivieren} reaktiviert
        </div>
      </Karte>
    </>
  );
}

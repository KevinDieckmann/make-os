'use client';

// ─── Sport — Ziele & Plan: Wettkampf, diese Woche, Baukasten, Block, Plan gegen Ist, Ziele ──────
// Seit 09.10. (Plan-Baukasten): oben der nächste Wettkampf (Countdown, Prognose, Taper) bzw. das Ziel, darunter „Diese Woche“ (Plan ↔ Ist
// mit Tagesform, abhaken, verschieben, Kalender), der Baukasten (Woche, Vorlagen), der Block und die Einstellungen der Regeln.
import { useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, Balken, Leer, Haken, LEUCHT, Pillen as UiPillen, useRueckfrage } from '../ui';
import { Feld, Raster, Zeitfeld, Zahlfeld, Hinweis, Weg, klein, de, datumLang, SPORT_FARBE } from './teile';
import { WettkampfKarte } from './WettkampfKarte';
import { DieseWoche } from './DieseWoche';
import { WochenBaukasten, BlockKarte } from './PlanBaukasten';
import { EinstellungenKarte } from './EinstellungenKarte';
import type { VitalTag } from '@/app/api/sport/route';
import { DISZIPLIN_LABEL, neueId, type Disziplin, type Op, type SportStand, type Ziel } from '@/lib/sport/modell';
import { hauptziel, wochenBis, planIst, wocheIst } from '@/lib/sport/plan';
import { saison, geplanteEinheiten } from '@/lib/sport/plan-bau';
import { formatZeit, formatPace, zielPace, montagVon, bestzeiten } from '@/lib/sport/pace';
import { splitsAusZielzeit } from '@/lib/sport/hyrox';
import { rekorde, alleUebungen } from '@/lib/sport/gym';

const FARBE_JE: Record<Disziplin, string> = { hyrox: SPORT_FARBE.hyrox, lauf: SPORT_FARBE.lauf, kraft: SPORT_FARBE.gym, grundlagen: SPORT_FARBE.erholung };
const ARTEN: { id: Disziplin; label: string }[] = (['hyrox', 'lauf', 'kraft', 'grundlagen'] as Disziplin[]).map(id => ({ id, label: DISZIPLIN_LABEL[id] }));

export function ZielePlan({ stand, heute, vitals, schicke, onReiter }: { stand: SportStand; heute: string; vitals: Record<string, VitalTag>; schicke: (ops: Op[], erfolg?: string) => Promise<boolean>; onReiter: (r: 'hyrox' | 'lauf' | 'gym' | 'erholung') => void }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const ziel = hauptziel(stand.ziele, heute);
  const wettkampf = saison(stand.ziele, heute).length > 0;
  const pi = planIst(stand, heute, 8);
  const dieseWoche = wocheIst(stand, montagVon(heute));
  const geplantDiese = geplanteEinheiten(stand, montagVon(heute)).length;
  const [neu, setNeu] = useState(false);

  return (
    <>
      {wettkampf && <WettkampfKarte stand={stand} heute={heute} schicke={schicke} />}
      {!wettkampf && <Karte i={0} ton={ziel ? FARBE_JE[ziel.art] : undefined}>
        <Ueberschrift farbe={ziel ? FARBE_JE[ziel.art] : undefined} rechts={ziel?.datum ? datumLang(ziel.datum) : undefined}>Dein Ziel</Ueberschrift>
        {!ziel ? <Leer>Noch kein Ziel — unten „+ Ziel“ tippen.</Leer> : (
          <>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(20px,3vw,26px)', letterSpacing: '-.02em', marginBottom: 12 }}>{ziel.titel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
              {ziel.datum && <Zahl wert={String(wochenBis(heute, ziel.datum))} label="Wochen bis dahin" farbe={FARBE_JE[ziel.art]} />}
              {ziel.zielzeitSek && <Zahl wert={formatZeit(ziel.zielzeitSek)} label={ziel.art === 'lauf' ? `Ziel über ${de(ziel.distanzKm)} km` : 'Zielzeit'} />}
              {ziel.art === 'lauf' && zielPace(ziel) != null && <Zahl wert={formatPace(zielPace(ziel))} label="Zielpace min/km" />}
              {ziel.art === 'hyrox' && ziel.zielzeitSek && <Zahl wert={formatPace(splitsAusZielzeit(ziel.zielzeitSek).laufJeKm)} label="Lauf je km im Ziel" />}
              {ziel.art === 'kraft' && ziel.zielKg && <Zahl wert={`${de(ziel.zielKg)} kg`} label={`Ziel ${alleUebungen(stand.gym.uebungen).find(u => u.id === ziel.uebung)?.name ?? ''}`} />}
              {ziel.art === 'kraft' && ziel.uebung && rekorde(stand.gym.einheiten)[ziel.uebung] && <Zahl wert={`${de(rekorde(stand.gym.einheiten)[ziel.uebung].e1rm)} kg`} label="bestes e1RM bisher" />}
              {ziel.art === 'lauf' && ziel.distanzKm && bestzeiten(stand.laeufe).find(b => b.distanzKm === ziel.distanzKm) && <Zahl wert={formatZeit(bestzeiten(stand.laeufe).find(b => b.distanzKm === ziel.distanzKm)!.sek)} label="Bestzeit bisher" />}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
              {ziel.art === 'hyrox' && <Knopf leise onClick={() => onReiter('hyrox')}>Splits & Stationen ›</Knopf>}
              {ziel.art === 'lauf' && <Knopf leise onClick={() => onReiter('lauf')}>Läufe & Paces ›</Knopf>}
              {ziel.art === 'kraft' && <Knopf leise onClick={() => onReiter('gym')}>Gym & Verlauf ›</Knopf>}
              <Knopf leise onClick={() => onReiter('erholung')}>Heute trainieren? ›</Knopf>
            </div>
          </>
        )}
      </Karte>}

      <DieseWoche stand={stand} heute={heute} vitals={vitals} schicke={schicke} />
      <WochenBaukasten stand={stand} heute={heute} schicke={schicke} />
      <BlockKarte stand={stand} heute={heute} schicke={schicke} />

      <Karte i={5}>
        <Ueberschrift rechts={<button type="button" onClick={() => setNeu(n => !n)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{neu ? 'Schließen' : '+ Ziel'}</button>}>Alle Ziele</Ueberschrift>
        {neu && <ZielFormular heute={heute} stand={stand} onSpeichern={async z => { const ok = await schicke([{ op: 'ziel', eintrag: z }], 'Ziel gespeichert.'); if (ok) setNeu(false); }} />}
        {!stand.ziele.length && !neu && <Leer>Saisonziele mit Datum: Hyrox am Tag X, 10 km unter Y, Kraftziel Z.</Leer>}
        {stand.ziele.map(z => (
          <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <Haken an={!!z.erledigt} onChange={() => void schicke([{ op: 'ziel', eintrag: { ...z, erledigt: !z.erledigt } }], z.erledigt ? 'Wieder offen.' : 'Geschafft!')} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: TYP.body, fontWeight: 500, textDecoration: z.erledigt ? 'line-through' : undefined, color: z.erledigt ? C.inkLeise : C.ink }}>{z.titel}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>
                {DISZIPLIN_LABEL[z.art]}{z.datum ? ` · ${datumLang(z.datum)} · ${wochenBis(heute, z.datum)} Wo.` : ''}{z.zielzeitSek ? ` · ${formatZeit(z.zielzeitSek)}` : ''}{z.distanzKm ? ` · ${de(z.distanzKm)} km` : ''}{z.zielKg ? ` · ${de(z.zielKg)} kg` : ''}
              </div>
            </div>
            <Chip farbe={FARBE_JE[z.art]}>{DISZIPLIN_LABEL[z.art]}</Chip>
            <Weg onClick={async () => { if (await bestaetigen({ titel: `„${z.titel}“ entfernen?`, text: 'Das Ziel fällt aus dem Plan.', ja: 'Entfernen', gefahr: true })) void schicke([{ op: 'ziel-weg', id: z.id }], 'Ziel entfernt.'); }} />
          </div>
        ))}
      </Karte>

      <Karte i={6}>
        <Ueberschrift rechts={`diese Woche ${dieseWoche.einheiten} von ${geplantDiese}`}>Plan gegen Ist · 8 Wochen</Ueberschrift>
        <Balken werte={pi.map(w => (w.ist ? w.ist : null))} max={Math.max(1, ...pi.map(w => Math.max(w.ist, w.plan)))} farbe={LEUCHT.gut} hoehe={52} titel={pi.map(w => `ab ${datumLang(w.montag)} · ${w.ist} von ${w.plan}`)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12, marginTop: 14 }}>
          <Zahl wert={dieseWoche.lauf ? String(dieseWoche.lauf) : undefined} label="Läufe" farbe={SPORT_FARBE.lauf} />
          <Zahl wert={dieseWoche.gym ? String(dieseWoche.gym) : undefined} label="Gym" farbe={SPORT_FARBE.gym} />
          <Zahl wert={dieseWoche.hyrox ? String(dieseWoche.hyrox) : undefined} label="Hyrox" farbe={SPORT_FARBE.hyrox} />
          <Zahl wert={dieseWoche.weitere ? String(dieseWoche.weitere) : undefined} label="Weitere" />
          <Zahl wert={dieseWoche.km ? `${de(dieseWoche.km)} km` : undefined} label="Laufkilometer" />
        </div>
        <Hinweis>Gezählt wird jede Einheit — von Hand und aus WHOOP, ohne Doppelte. Struktur und Erfassung, keine Trainingsberatung.</Hinweis>
      </Karte>
      <EinstellungenKarte stand={stand} schicke={schicke} />
      {dialog}
    </>
  );
}

function ZielFormular({ heute, stand, onSpeichern }: { heute: string; stand: SportStand; onSpeichern: (z: Ziel) => Promise<void> }) {
  const [art, setArt] = useState<Disziplin>('hyrox');
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState('');
  const [zielzeit, setZielzeit] = useState<number | undefined>();
  const [distanz, setDistanz] = useState<number | undefined>(10);
  const [uebung, setUebung] = useState('kniebeuge');
  const [zielKg, setZielKg] = useState<number | undefined>();
  const [refZeit, setRefZeit] = useState<number | undefined>();
  const [refDist, setRefDist] = useState('10');
  const uebungen = alleUebungen(stand.gym.uebungen);
  const standard = art === 'hyrox' ? 'Hyrox' : art === 'lauf' ? `${de(distanz)} km${zielzeit ? ` unter ${formatZeit(zielzeit)}` : ''}` : art === 'kraft' ? `${uebungen.find(u => u.id === uebung)?.name ?? ''}${zielKg ? ` ${de(zielKg)} kg` : ''}` : 'Grundlagen';
  return (
    <div style={{ padding: '4px 0 14px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{ARTEN.map(a => <Chip key={a.id} farbe={art === a.id ? FARBE_JE[a.id] : C.inkLeise}><button type="button" onClick={() => setArt(a.id)} style={{ all: 'unset', cursor: 'pointer' }}>{a.label}</button></Chip>)}</div>
      <Raster min={150}>
        <Feld label="Zieldatum"><input type="date" value={datum} min={heute} onChange={e => setDatum(e.target.value)} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
        {art === 'lauf' && <Feld label="Distanz (km)" breit><UiPillen liste={[{ id: '5', label: '5 km' }, { id: '10', label: '10 km' }, { id: '21.1', label: 'Halbmarathon' }, { id: '42.2', label: 'Marathon' }]} aktiv={String(distanz)} onWahl={x => setDistanz(Number(x))} /></Feld>}
        {art === 'lauf' && <Feld label="Andere Distanz (km)"><Zahlfeld wert={distanz} onWert={setDistanz} einheit="km" /></Feld>}
        {(art === 'hyrox' || art === 'lauf') && <Feld label="Zielzeit"><Zeitfeld wert={zielzeit} onWert={setZielzeit} placeholder={art === 'hyrox' ? 'h:mm:ss' : 'mm:ss'} /></Feld>}
        {art === 'kraft' && <Feld label="Übung"><select value={uebung} onChange={e => setUebung(e.target.value)} style={{ ...klein, colorScheme: 'dark' }}>{uebungen.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Feld>}
        {art === 'kraft' && <Feld label="Zielgewicht"><Zahlfeld wert={zielKg} onWert={setZielKg} einheit="kg" /></Feld>}
        {art === 'lauf' && <Feld label="Referenz für die Prognose"><UiPillen liste={[{ id: '5', label: '5 km' }, { id: '10', label: '10 km' }]} aktiv={refDist} onWahl={setRefDist} /></Feld>}
        {art === 'lauf' && <Feld label={`Aktuelle Zeit über ${refDist} km`}><Zeitfeld wert={refZeit} onWert={setRefZeit} placeholder="mm:ss" /></Feld>}
        <Feld label="Name" breit><input value={titel} onChange={e => setTitel(e.target.value)} placeholder={standard} style={klein} /></Feld>
      </Raster>
      <div style={{ marginTop: 10 }}><Knopf onClick={() => void onSpeichern({ id: neueId('ziel'), art, titel: titel.trim() || standard, datum: datum || undefined, zielzeitSek: art === 'hyrox' || art === 'lauf' ? zielzeit : undefined, distanzKm: art === 'lauf' ? distanz : undefined, uebung: art === 'kraft' ? uebung : undefined, zielKg: art === 'kraft' ? zielKg : undefined, ...(art === 'lauf' && refZeit ? { referenz: { distanzKm: Number(refDist), sek: refZeit } } : {}), angelegt: new Date().toISOString() })}>Ziel anlegen</Knopf></div>
    </div>
  );
}


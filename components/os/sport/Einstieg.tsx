'use client';

// ─── Sport — geführter Einstieg beim ersten Öffnen ──────────────────────────
// Ziel wählen → Zieldatum & Zielzeit → Ausgangswerte → Wochenrhythmus → fertig.
// Nur Vorschläge, keine Trainingsberatung. Alles lässt sich danach ändern.

import { useState } from 'react';
import { FARBE as C, TYP, SCHRIFT, TIEF } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, Fortschritt } from '../ui';
import { Feld, Raster, Zeitfeld, Zahlfeld, Hinweis, klein, SPORT_FARBE, de } from './teile';
import { WOCHENTAGE, WOCHENTAG_LABEL, PLAN_LABEL, neueId, type Disziplin, type Op, type PlanArt, type Woche } from '@/lib/sport/modell';
import { vorschlagWoche, planUmfang, wochenBis } from '@/lib/sport/plan';
import { montagVon, formatPace, zielPace } from '@/lib/sport/pace';
import { UEBUNGEN } from '@/lib/sport/gym';

const ZIELE: { id: Disziplin; titel: string; text: string }[] = [
  { id: 'hyrox', titel: 'Hyrox', text: 'Ein Wettkampf am Datum X mit Zielzeit — Lauf, Kraft und Stationen im Wechsel.' },
  { id: 'lauf', titel: 'Lauf', text: '5, 10 oder 21,1 km unter einer Zeit — Umfang aufbauen, Tempo gezielt.' },
  { id: 'kraft', titel: 'Kraft', text: 'Ein Gewicht in einer Übung — Kniebeuge, Kreuzheben, Bankdrücken …' },
  { id: 'grundlagen', titel: 'Grundlagen', text: 'Regelmäßig in Bewegung kommen — Laufen und Gym im Wechsel, ohne Wettkampf.' },
];
const FARBE_JE: Record<Disziplin, string> = { hyrox: SPORT_FARBE.hyrox, lauf: SPORT_FARBE.lauf, kraft: SPORT_FARBE.gym, grundlagen: SPORT_FARBE.erholung };
const DIST = [{ id: 5, label: '5 km' }, { id: 10, label: '10 km' }, { id: 21.1, label: 'Halbmarathon' }];

export function Einstieg({ heute, onFertig }: { heute: string; onFertig: (ops: Op[]) => Promise<boolean> }) {
  const [schritt, setSchritt] = useState(0);
  const [art, setArt] = useState<Disziplin | null>(null);
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState('');
  const [zielzeit, setZielzeit] = useState<number | undefined>();
  const [distanz, setDistanz] = useState(10);
  const [uebung, setUebung] = useState('kniebeuge');
  const [zielKg, setZielKg] = useState<number | undefined>();
  const [a5, setA5] = useState<number | undefined>(); const [a10, setA10] = useState<number | undefined>(); const [aHx, setAHx] = useState<number | undefined>();
  const [kraft, setKraft] = useState<Record<string, number | undefined>>({});
  const [tage, setTage] = useState(4);
  const [woche, setWoche] = useState<Woche | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const farbe = art ? FARBE_JE[art] : C.aktiv;
  const w = woche ?? (art ? vorschlagWoche(art, tage) : null);
  const umfang = w ? planUmfang(w) : null;

  const standardTitel = () => art === 'hyrox' ? 'Hyrox' : art === 'lauf' ? `${DIST.find(d => d.id === distanz)?.label ?? `${de(distanz)} km`} unter ${zielzeit ? Math.round(zielzeit / 60) : '…'} min` : art === 'kraft' ? `${UEBUNGEN.find(u => u.id === uebung)?.name ?? uebung} ${zielKg ? `${de(zielKg)} kg` : ''}`.trim() : 'Grundlagen aufbauen';

  const fertig = async () => {
    if (!art || !w) return;
    setLaeuft(true);
    const ziel = { id: neueId('ziel'), art, titel: titel.trim() || standardTitel(), datum: datum || undefined, zielzeitSek: art === 'hyrox' || art === 'lauf' ? zielzeit : undefined, distanzKm: art === 'lauf' ? distanz : undefined, uebung: art === 'kraft' ? uebung : undefined, zielKg: art === 'kraft' ? zielKg : undefined, angelegt: new Date().toISOString() };
    const kraftSauber = Object.fromEntries(Object.entries(kraft).filter(([, v]) => v));
    const ok = await onFertig([
      { op: 'ziel', eintrag: ziel },
      { op: 'ausgang', werte: { lauf5kSek: a5, lauf10kSek: a10, hyroxSek: aHx, tageProWoche: tage, kraft: kraftSauber } },
      { op: 'woche', tage: w, planStart: montagVon(heute) },
      { op: 'einstieg', fertig: true },
    ]);
    if (!ok) setLaeuft(false);
  };

  const SCHRITTE = ['Ziel', 'Datum & Zeit', 'Ausgang', 'Woche', 'Fertig'];
  return (
    <Karte i={0} ton={farbe}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.titel }}>Dein Start</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{SCHRITTE.map((s, i) => <Chip key={s} farbe={i === schritt ? farbe : i < schritt ? C.inkDim : C.inkLeise}>{i + 1} · {s}</Chip>)}</div>
      </div>
      <div style={{ marginBottom: 18 }}><Fortschritt anteil={(schritt + 1) / SCHRITTE.length} farbe={farbe} /></div>

      {schritt === 0 && (
        <>
          <p style={{ color: C.inkDim, fontSize: TYP.body, margin: '0 0 14px' }}>Worauf arbeitest du in dieser Saison hin? Du kannst später weitere Ziele anlegen.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {ZIELE.map(z => (
              <button key={z.id} type="button" onClick={() => setArt(z.id)} aria-pressed={art === z.id} className="fassbar" style={{ textAlign: 'left', padding: 16, borderRadius: 14, cursor: 'pointer', border: `1px solid ${art === z.id ? TIEF.rand(FARBE_JE[z.id]) : 'rgba(255,255,255,.08)'}`, background: art === z.id ? TIEF.flaeche(FARBE_JE[z.id]) : 'rgba(255,255,255,.03)', color: C.ink }}>
                <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, color: art === z.id ? FARBE_JE[z.id] : C.ink }}>{z.titel}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.45 }}>{z.text}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {schritt === 1 && art && (
        <>
          <p style={{ color: C.inkDim, fontSize: TYP.body, margin: '0 0 14px' }}>{art === 'grundlagen' ? 'Bis wann willst du im Rhythmus sein? Ein Datum hilft, die Wochen zu zählen.' : 'Wann ist der Tag — und was soll auf der Uhr stehen?'}</p>
          <Raster min={170}>
            <Feld label={art === 'hyrox' ? 'Wettkampfdatum' : 'Zieldatum'}><input type="date" value={datum} min={heute} onChange={e => setDatum(e.target.value)} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
            {art === 'lauf' && <Feld label="Distanz"><select value={distanz} onChange={e => setDistanz(Number(e.target.value))} style={{ ...klein, colorScheme: 'dark' }}>{DIST.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Feld>}
            {(art === 'hyrox' || art === 'lauf') && <Feld label="Zielzeit"><Zeitfeld wert={zielzeit} onWert={setZielzeit} placeholder={art === 'hyrox' ? 'h:mm:ss' : 'mm:ss'} /></Feld>}
            {art === 'kraft' && <Feld label="Übung"><select value={uebung} onChange={e => setUebung(e.target.value)} style={{ ...klein, colorScheme: 'dark' }}>{UEBUNGEN.filter(u => u.gruppe !== 'hyrox' && u.id !== 'plank').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Feld>}
            {art === 'kraft' && <Feld label="Zielgewicht"><Zahlfeld wert={zielKg} onWert={setZielKg} einheit="kg" placeholder="z. B. 80" /></Feld>}
            <Feld label="Name des Ziels (frei)" breit><input value={titel} onChange={e => setTitel(e.target.value)} placeholder={standardTitel()} style={klein} /></Feld>
          </Raster>
          {datum && <Hinweis>{wochenBis(heute, datum)} Wochen bis dahin.{art === 'lauf' && zielzeit ? ` Zielpace ${formatPace(zielPace({ zielzeitSek: zielzeit, distanzKm: distanz }))} min/km.` : ''}</Hinweis>}
        </>
      )}

      {schritt === 2 && art && (
        <>
          <p style={{ color: C.inkDim, fontSize: TYP.body, margin: '0 0 14px' }}>Wo stehst du gerade? Nur, was du weißt — der Rest bleibt leer und füllt sich mit dem Training.</p>
          <Raster min={170}>
            <Feld label="5 km aktuell"><Zeitfeld wert={a5} onWert={setA5} /></Feld>
            <Feld label="10 km aktuell"><Zeitfeld wert={a10} onWert={setA10} /></Feld>
            {art === 'hyrox' && <Feld label="Letzter Hyrox"><Zeitfeld wert={aHx} onWert={setAHx} placeholder="h:mm:ss" /></Feld>}
            {['kniebeuge', 'kreuzheben', 'bankdruecken'].map(id => <Feld key={id} label={`${UEBUNGEN.find(u => u.id === id)!.name} (Arbeitsgewicht)`}><Zahlfeld wert={kraft[id]} onWert={n => setKraft(k => ({ ...k, [id]: n }))} einheit="kg" /></Feld>)}
          </Raster>
        </>
      )}

      {schritt === 3 && art && w && umfang && (
        <>
          <p style={{ color: C.inkDim, fontSize: TYP.body, margin: '0 0 14px' }}>Wie viele Tage die Woche sind realistisch? Daraus kommt ein Vorschlag — jeden Tag kannst du umstellen.</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6].map(n => <button key={n} type="button" onClick={() => { setTage(n); setWoche(null); }} aria-pressed={tage === n} className="fassbar" style={{ width: 44, height: 40, borderRadius: 12, cursor: 'pointer', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, border: `1px solid ${tage === n ? TIEF.rand(farbe) : 'rgba(255,255,255,.08)'}`, background: tage === n ? TIEF.flaeche(farbe) : 'rgba(255,255,255,.04)', color: tage === n ? farbe : C.inkDim }}>{n}</button>)}
            <span style={{ alignSelf: 'center', color: C.inkLeise, fontSize: TYP.bedien, marginLeft: 6 }}>Tage pro Woche</span>
          </div>
          <WochenRaster woche={w} onWoche={setWoche} />
          <Hinweis>{umfang.einheiten} Einheiten · rund {Math.round(umfang.minuten / 60 * 10) / 10} h · {umfang.ruhetage} Ruhetag{umfang.ruhetage === 1 ? '' : 'e'}. Vorschlag, keine Trainingsberatung — bei Beschwerden führen Ärztin oder Physio.</Hinweis>
        </>
      )}

      {schritt === 4 && art && w && umfang && (
        <>
          <p style={{ color: C.inkDim, fontSize: TYP.body, margin: '0 0 14px' }}>Das ist dein Rahmen. Alles lässt sich unter „Ziele & Plan“ jederzeit ändern.</p>
          <div style={{ display: 'grid', gap: 8, fontSize: TYP.body }}>
            <div><span style={{ color: C.inkLeise }}>Ziel · </span><b>{titel.trim() || standardTitel()}</b>{datum ? <span style={{ color: C.inkDim }}> · {wochenBis(heute, datum)} Wochen</span> : null}</div>
            <div><span style={{ color: C.inkLeise }}>Woche · </span>{WOCHENTAGE.filter(t => w[t].art !== 'frei').map(t => `${WOCHENTAG_LABEL[t]} ${PLAN_LABEL[w[t].art]}`).join(' · ')}</div>
            <div><span style={{ color: C.inkLeise }}>Umfang · </span>{umfang.einheiten} Einheiten, rund {Math.round(umfang.minuten / 60 * 10) / 10} h, {umfang.ruhetage} Ruhetag{umfang.ruhetage === 1 ? '' : 'e'}</div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => setSchritt(s => Math.max(0, s - 1))} aus={schritt === 0 || laeuft}>Zurück</Knopf>
        {schritt < 4
          ? <Knopf farbe={farbe} onClick={() => setSchritt(s => s + 1)} aus={!art}>Weiter</Knopf>
          : <Knopf farbe={farbe} onClick={() => void fertig()} aus={laeuft}>{laeuft ? 'Speichert …' : 'Los geht’s'}</Knopf>}
      </div>
    </Karte>
  );
}

/** Sieben Tage nebeneinander (Handy: umbrechend), je Tag Art und Dauer. */
export function WochenRaster({ woche, onWoche }: { woche: Woche; onWoche: (w: Woche) => void }) {
  const ARTEN: PlanArt[] = ['lauf', 'gym', 'hyrox', 'ruhe', 'frei'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
      {WOCHENTAGE.map(t => {
        const p = woche[t];
        const f = SPORT_FARBE[p.art];
        return (
          <div key={t} style={{ borderRadius: 12, padding: 10, background: p.art === 'frei' ? 'rgba(255,255,255,.03)' : TIEF.flaeche(f), border: `1px solid ${p.art === 'frei' ? 'rgba(255,255,255,.06)' : `${f}40`}` }}>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, color: p.art === 'frei' ? C.inkLeise : f, marginBottom: 6 }}>{WOCHENTAG_LABEL[t]}</div>
            <select value={p.art} aria-label={`${WOCHENTAG_LABEL[t]}: Art`} onChange={e => onWoche({ ...woche, [t]: { ...p, art: e.target.value as PlanArt, dauerMin: ['ruhe', 'frei'].includes(e.target.value) ? undefined : (p.dauerMin ?? 45) } })} style={{ ...klein, padding: '6px 8px', fontSize: TYP.bedien, colorScheme: 'dark' }}>
              {ARTEN.map(a => <option key={a} value={a}>{PLAN_LABEL[a]}</option>)}
            </select>
            {p.art !== 'ruhe' && p.art !== 'frei' && <input type="number" min={10} max={300} step={5} value={p.dauerMin ?? ''} aria-label={`${WOCHENTAG_LABEL[t]}: Minuten`} onChange={e => onWoche({ ...woche, [t]: { ...p, dauerMin: Number(e.target.value) || undefined } })} placeholder="min" style={{ ...klein, padding: '6px 8px', fontSize: TYP.bedien, marginTop: 6 }} />}
          </div>
        );
      })}
    </div>
  );
}

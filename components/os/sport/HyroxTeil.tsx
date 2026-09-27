'use client';

// ─── Sport — Hyrox: Splits aus der Zielzeit, Stationszeiten, Schwächen, Log ─
import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, Leer, LEUCHT } from '../schlank';
import { Feld, Raster, Zeitfeld, Pillen, Hinweis, Weg, klein, datumLang, SPORT_FARBE } from './teile';
import { STATIONEN, LAEUFE, splitsAusZielzeit, gesamtAus, vollstaendig, schwaechen, bestesJeStation, bestzeitPrognose } from '@/lib/sport/hyrox';
import { formatZeit, formatPace } from '@/lib/sport/pace';
import { hauptziel } from '@/lib/sport/plan';
import { neueId, STATION_IDS, type HyroxEinheit, type Op, type SportStand, type StationId } from '@/lib/sport/modell';

const F = SPORT_FARBE.hyrox;
const ARTEN: { id: HyroxEinheit['art']; label: string }[] = [{ id: 'training', label: 'Training' }, { id: 'simulation', label: 'Simulation' }, { id: 'wettkampf', label: 'Wettkampf' }];

export function HyroxTeil({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const hz = stand.ziele.find(z => z.art === 'hyrox' && !z.erledigt && z.zielzeitSek) ?? (hauptziel(stand.ziele, heute)?.art === 'hyrox' ? hauptziel(stand.ziele, heute) : null);
  const [zielzeit, setZielzeit] = useState<number | undefined>(hz?.zielzeitSek ?? stand.ausgang.hyroxSek ?? 5400);
  const splits = useMemo(() => (zielzeit ? splitsAusZielzeit(zielzeit) : null), [zielzeit]);
  const beste = useMemo(() => bestesJeStation(stand.hyrox), [stand.hyrox]);
  const prognose = useMemo(() => bestzeitPrognose(stand.hyrox), [stand.hyrox]);
  const letzteVolle = stand.hyrox.find(e => e.art !== 'training' && (vollstaendig(e) || Object.keys(e.stationen).length >= 4)) ?? stand.hyrox.find(e => Object.keys(e.stationen).length > 0) ?? null;
  const schw = letzteVolle && splits ? schwaechen(letzteVolle, splits) : [];
  const [offen, setOffen] = useState(false);
  const [bearbeite, setBearbeite] = useState<HyroxEinheit | null>(null);

  return (
    <>
      <Karte i={0} akzent={F}>
        <Ueberschrift farbe={F} rechts={hz ? `Ziel: ${hz.titel}` : undefined}>Zielzeit-Rechner</Ueberschrift>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          <Feld label="Zielzeit gesamt"><Zeitfeld wert={zielzeit} onWert={setZielzeit} placeholder="h:mm:ss" stil={{ width: 140, fontSize: TYP.body }} /></Feld>
          {splits && <Zahl wert={formatPace(splits.laufJeKm)} label="je Lauf-km" farbe={F} />}
          {splits && <Zahl wert={formatZeit(splits.laeufeGesamt)} label="8 Läufe gesamt" />}
          {splits && <Zahl wert={formatZeit(splits.roxzone)} label="Roxzone (Wege)" />}
          {prognose && <Zahl wert={formatZeit(prognose)} label="aus deinen Bestzeiten" farbe={LEUCHT.gut} />}
        </div>
        {splits && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {STATIONEN.map(s => (
              <div key={s.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 12.5, color: C.inkDim }}>{s.name} <span style={{ color: C.inkLeise }}>· {s.umfang}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                  <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{formatZeit(splits.stationen[s.id])}</span>
                  {beste[s.id] && <span style={{ fontSize: 11.5, color: beste[s.id]!.sek <= splits.stationen[s.id] ? LEUCHT.gut : C.inkLeise }}>best {formatZeit(beste[s.id]!.sek)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <Hinweis>Splits nach üblichen Anteilen je Station (Läufe rund 52 %, Wege 6 %). Deine eigenen Zeiten lösen den Vorschlag ab, sobald du Stationen erfasst.</Hinweis>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={letzteVolle ? `${ARTEN.find(a => a.id === letzteVolle.art)?.label} · ${datumLang(letzteVolle.datum)}` : undefined}>Schwächen gegen das Ziel</Ueberschrift>
        {!schw.length ? <Leer>Sobald eine Einheit mit Stationszeiten da ist, steht hier, welche Station am meisten kostet.</Leer> : (
          <div>
            {schw.map(s => {
              const f = s.deltaSek > 20 ? LEUCHT.kritisch : s.deltaSek > 5 ? LEUCHT.achtung : LEUCHT.gut;
              const breite = Math.min(100, Math.abs(s.deltaSek) / Math.max(1, Math.abs(schw[0].deltaSek)) * 100);
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1.2fr) minmax(80px, 2fr) auto', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{s.name}<div style={{ fontSize: 11.5, color: C.inkLeise, fontWeight: 400 }}>{formatZeit(s.ist)} statt {formatZeit(s.soll)}</div></div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${breite}%`, height: '100%', background: f, borderRadius: 4, opacity: .8 }} /></div>
                  <Chip farbe={f}>{s.deltaSek > 0 ? '+' : ''}{formatZeit(Math.abs(s.deltaSek)).replace(/^0:/, '')}{s.deltaSek < 0 ? ' schneller' : ''}</Chip>
                </div>
              );
            })}
          </div>
        )}
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<button type="button" onClick={() => { setBearbeite(null); setOffen(o => !o); }} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700 }}>{offen ? 'Schließen' : '+ Einheit'}</button>}>Stationszeiten erfassen</Ueberschrift>
        {(offen || bearbeite) && <EinheitFormular heute={heute} start={bearbeite ?? undefined} onSpeichern={async e => { const ok = await schicke([{ op: 'hyrox', eintrag: e }], 'Einheit gespeichert.'); if (ok) { setOffen(false); setBearbeite(null); } }} onAbbruch={() => { setOffen(false); setBearbeite(null); }} />}
        {!stand.hyrox.length && !offen && <Leer>Training, Simulation oder Wettkampf — Stationen einzeln oder nur die Gesamtzeit.</Leer>}
        {stand.hyrox.slice(0, 30).map(e => {
          const g = gesamtAus(e);
          const n = STATION_IDS.filter(id => e.stationen[id]).length;
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" onClick={() => { setBearbeite(e); setOffen(false); }} style={{ all: 'unset', cursor: 'pointer', fontSize: TYP.body, fontWeight: 500 }}>{datumLang(e.datum)}{e.ort ? ` · ${e.ort}` : ''}</button>
                <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 2 }}>{n} von 8 Stationen · {e.laeufe.length} von 8 Läufen{e.notiz ? ` · ${e.notiz}` : ''}</div>
              </div>
              <Chip farbe={e.art === 'wettkampf' ? F : e.art === 'simulation' ? LEUCHT.achtung : C.inkDim}>{ARTEN.find(a => a.id === e.art)?.label}</Chip>
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums', color: g ? C.ink : C.inkLeise }}>{formatZeit(g)}</span>
              <Weg onClick={() => { if (confirm('Einheit entfernen?')) void schicke([{ op: 'hyrox-weg', id: e.id }], 'Entfernt.'); }} />
            </div>
          );
        })}
      </Karte>
    </>
  );
}

function EinheitFormular({ heute, start, onSpeichern, onAbbruch }: { heute: string; start?: HyroxEinheit; onSpeichern: (e: HyroxEinheit) => Promise<void>; onAbbruch: () => void }) {
  const [e, setE] = useState<HyroxEinheit>(start ?? { id: neueId('hx'), datum: heute, art: 'simulation', stationen: {}, laeufe: [] });
  const setStation = (id: StationId, sek: number | undefined) => setE(x => { const st = { ...x.stationen }; if (sek) st[id] = sek; else delete st[id]; return { ...x, stationen: st }; });
  const setLauf = (i: number, sek: number | undefined) => setE(x => { const l = [...x.laeufe]; while (l.length < LAEUFE) l.push(0); l[i] = sek ?? 0; let n = l.length; while (n > 0 && !l[n - 1]) n--; return { ...x, laeufe: l.slice(0, n) }; });
  const summe = gesamtAus({ ...e, gesamtSek: undefined });
  return (
    <div style={{ padding: '4px 0 14px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Raster min={160}>
        <Feld label="Datum"><input type="date" value={e.datum} max={heute} onChange={ev => setE(x => ({ ...x, datum: ev.target.value }))} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
        <Feld label="Art" breit><Pillen liste={ARTEN} wert={e.art} onWert={art => setE(x => ({ ...x, art }))} farbe={F} /></Feld>
      </Raster>
      <div style={{ marginTop: 12, fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase' }}>Stationen</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 6 }}>
        {STATIONEN.map(s => <Feld key={s.id} label={`${s.name} · ${s.umfang}`}><Zeitfeld wert={e.stationen[s.id]} onWert={v => setStation(s.id, v)} /></Feld>)}
      </div>
      <div style={{ marginTop: 12, fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase' }}>8 × 1 km Lauf</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 8, marginTop: 6 }}>
        {Array.from({ length: LAEUFE }, (_, i) => <Feld key={i} label={`Lauf ${i + 1}`}><Zeitfeld wert={e.laeufe[i] || undefined} onWert={v => setLauf(i, v)} /></Feld>)}
      </div>
      <Raster min={160}>
        <div style={{ marginTop: 10 }}><Feld label={`Gesamtzeit${summe ? ` (Teile: ${formatZeit(summe)})` : ''}`}><Zeitfeld wert={e.gesamtSek} onWert={v => setE(x => ({ ...x, gesamtSek: v }))} placeholder="h:mm:ss" /></Feld></div>
        <div style={{ marginTop: 10 }}><Feld label="Ort"><input value={e.ort ?? ''} onChange={ev => setE(x => ({ ...x, ort: ev.target.value || undefined }))} placeholder="Halle, Stadt" style={klein} /></Feld></div>
        <div style={{ marginTop: 10, gridColumn: '1 / -1' }}><Feld label="Notiz"><input value={e.notiz ?? ''} onChange={ev => setE(x => ({ ...x, notiz: ev.target.value || undefined }))} placeholder="Was lief, was nicht" style={klein} /></Feld></div>
      </Raster>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Knopf farbe={F} onClick={() => void onSpeichern(e)}>{start ? 'Speichern' : 'Einheit anlegen'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

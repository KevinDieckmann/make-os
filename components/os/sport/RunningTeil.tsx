'use client';

// ─── Sport — Running: Läufe, Wochenkilometer, Bestzeiten, Zielpace ──────────
import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, Balken, Leer, LEUCHT, useRueckfrage } from '../ui';
import { Feld, Raster, Zeitfeld, Zahlfeld, Pillen, Skala, Hinweis, Weg, klein, de, datumLang, datumKurz, SPORT_FARBE } from './teile';
import { paceSekProKm, formatPace, formatZeit, wochenKilometer, kmTrend, bestzeiten, riegel, zielPace, trainingsPaces } from '@/lib/sport/pace';
import { LAUF_ARTEN, neueId, type Lauf, type LaufArt, type Op, type SportStand } from '@/lib/sport/modell';

const F = SPORT_FARBE.lauf;
const ART_LABEL = Object.fromEntries(LAUF_ARTEN.map(a => [a.id, a.label])) as Record<LaufArt, string>;

export function RunningTeil({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const wochen = useMemo(() => wochenKilometer(stand.laeufe, heute, 12), [stand.laeufe, heute]);
  const trend = kmTrend(wochen);
  const best = useMemo(() => bestzeiten(stand.laeufe), [stand.laeufe]);
  const laufZiel = stand.ziele.find(z => z.art === 'lauf' && !z.erledigt && zielPace(z) != null) ?? null;
  const zp = laufZiel ? zielPace(laufZiel) : null;
  const paces = zp ? trainingsPaces(zp) : null;
  const [offen, setOffen] = useState(false);
  const [bearbeite, setBearbeite] = useState<Lauf | null>(null);
  const diese = wochen[wochen.length - 1];
  const best5 = best.find(b => b.distanzKm === 5), best10 = best.find(b => b.distanzKm === 10), best21 = best.find(b => b.distanzKm === 21.1);

  return (
    <>
      <Karte i={0} ton={F}>
        <Ueberschrift farbe={F} rechts={trend != null ? `Trend ${trend > 0 ? '+' : ''}${trend} % (4 gegen 4 Wochen)` : undefined}>Wochenkilometer · 12 Wochen</Ueberschrift>
        <Balken werte={wochen.map(w => (w.km ? w.km : null))} max={Math.max(1, ...wochen.map(w => w.km))} farbe={F} hoehe={56} titel={wochen.map(w => `ab ${datumKurz(w.montag)} · ${de(w.km)} km · ${w.laeufe} Läufe`)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 14 }}>
          <Zahl wert={diese.km ? `${de(diese.km)} km` : undefined} label="diese Woche" farbe={F} />
          <Zahl wert={diese.laeufe ? String(diese.laeufe) : undefined} label="Läufe diese Woche" />
          <Zahl wert={diese.dauerSek ? formatZeit(diese.dauerSek) : undefined} label="Laufzeit diese Woche" />
          {zp != null && <Zahl wert={formatPace(zp)} label={`Zielpace · ${laufZiel!.titel}`} farbe={LEUCHT.gut} />}
        </div>
        {paces && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {paces.map(p => <Chip key={p.art} farbe={C.inkDim}>{ART_LABEL[p.art as LaufArt] ?? p.art} {formatPace(p.von)}–{formatPace(p.bis)}</Chip>)}
          </div>
        )}
        {!laufZiel && <Hinweis>Ein Laufziel mit Distanz und Zielzeit (unter „Ziele & Plan“) liefert hier Zielpace und Trainingsbereiche.</Hinweis>}
      </Karte>

      <Karte i={1}>
        <Ueberschrift>Bestzeiten</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
          {[{ d: 5, b: best5, label: '5 km' }, { d: 10, b: best10, label: '10 km' }, { d: 21.1, b: best21, label: 'Halbmarathon' }].map(x => (
            <div key={x.d}>
              <Zahl wert={x.b ? formatZeit(x.b.sek) : undefined} label={x.label} farbe={F} />
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>
                {x.b ? `${formatPace(paceSekProKm(x.d, x.b.sek))} min/km · ${datumKurz(x.b.datum)}${x.b.hochgerechnet ? ' · hochgerechnet' : ''}`
                  : x.d === 10 && best5 ? `≈ ${formatZeit(riegel(best5.sek, 5, 10))} aus 5 km (Riegel)`
                  : x.d === 21.1 && best10 ? `≈ ${formatZeit(riegel(best10.sek, 10, 21.1))} aus 10 km (Riegel)`
                  : 'noch kein Lauf über die Distanz'}
              </div>
            </div>
          ))}
        </div>
        {stand.ausgang.lauf10kSek && !best10 && <Hinweis>Ausgangswert 10 km: {formatZeit(stand.ausgang.lauf10kSek)} — der erste erfasste 10er löst ihn ab.</Hinweis>}
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<button type="button" onClick={() => { setBearbeite(null); setOffen(o => !o); }} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{offen ? 'Schließen' : '+ Lauf'}</button>}>Läufe</Ueberschrift>
        {(offen || bearbeite) && <LaufFormular heute={heute} start={bearbeite ?? undefined} onSpeichern={async l => { const ok = await schicke([{ op: 'lauf', eintrag: l }], 'Lauf gespeichert.'); if (ok) { setOffen(false); setBearbeite(null); } }} onAbbruch={() => { setOffen(false); setBearbeite(null); }} />}
        {!stand.laeufe.length && !offen && <Leer>Datum, Distanz, Zeit, Art und Gefühl — die Pace rechnet sich von selbst. Ein Import (Apple Health, Strava) kann später andocken.</Leer>}
        {stand.laeufe.slice(0, 40).map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button type="button" onClick={() => { setBearbeite(l); setOffen(false); }} style={{ all: 'unset', cursor: 'pointer', fontSize: TYP.body, fontWeight: 500 }}>{datumLang(l.datum)} · {de(l.distanzKm, 2)} km</button>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatZeit(l.dauerSek)}{l.gefuehl ? ` · Gefühl ${l.gefuehl}/5` : ''}{l.quelle !== 'hand' ? ` · ${l.quelle}` : ''}{l.notiz ? ` · ${l.notiz}` : ''}</div>
            </div>
            <Chip farbe={l.art === 'intervall' || l.art === 'tempo' || l.art === 'wettkampf' ? F : C.inkDim}>{ART_LABEL[l.art]}</Chip>
            <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatPace(paceSekProKm(l.distanzKm, l.dauerSek))}<span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}> /km</span></span>
            <Weg onClick={async () => { if (await bestaetigen({ titel: 'Lauf entfernen?', text: 'Der erfasste Lauf fällt weg.', ja: 'Entfernen', gefahr: true })) void schicke([{ op: 'lauf-weg', id: l.id }], 'Entfernt.'); }} />
          </div>
        ))}
      </Karte>
      {dialog}
    </>
  );
}

function LaufFormular({ heute, start, onSpeichern, onAbbruch }: { heute: string; start?: Lauf; onSpeichern: (l: Lauf) => Promise<void>; onAbbruch: () => void }) {
  const [l, setL] = useState<Partial<Lauf> & { id: string; datum: string; art: LaufArt; quelle: Lauf['quelle'] }>(start ?? { id: neueId('lauf'), datum: heute, art: 'locker', quelle: 'hand' });
  const pace = l.distanzKm && l.dauerSek ? paceSekProKm(l.distanzKm, l.dauerSek) : null;
  const ok = !!l.distanzKm && !!l.dauerSek && !!l.datum;
  return (
    <div style={{ padding: '4px 0 14px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Raster min={140}>
        <Feld label="Datum"><input type="date" value={l.datum} max={heute} onChange={e => setL(x => ({ ...x, datum: e.target.value }))} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
        <Feld label="Distanz"><Zahlfeld wert={l.distanzKm} onWert={n => setL(x => ({ ...x, distanzKm: n }))} einheit="km" placeholder="z. B. 8,5" /></Feld>
        <Feld label="Zeit"><Zeitfeld wert={l.dauerSek} onWert={n => setL(x => ({ ...x, dauerSek: n }))} placeholder="mm:ss" /></Feld>
        <Feld label="Pace"><div style={{ ...klein, color: pace ? C.ink : C.inkLeise, fontFamily: SCHRIFT.display, fontWeight: 700 }}>{formatPace(pace)} <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}>min/km</span></div></Feld>
        <Feld label="Art" breit><Pillen liste={LAUF_ARTEN} wert={l.art} onWert={art => setL(x => ({ ...x, art }))} farbe={F} /></Feld>
        <Feld label="Gefühl (1 zäh … 5 fliegt)" breit><Skala wert={l.gefuehl} onWert={n => setL(x => ({ ...x, gefuehl: n }))} /></Feld>
        <Feld label="Notiz" breit><input value={l.notiz ?? ''} onChange={e => setL(x => ({ ...x, notiz: e.target.value || undefined }))} placeholder="Strecke, Wetter, was auffiel" style={klein} /></Feld>
      </Raster>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Knopf farbe={F} aus={!ok} onClick={() => ok && void onSpeichern(l as Lauf)}>{start ? 'Speichern' : 'Lauf anlegen'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

'use client';

// ─── Sport — Gym: Einheiten mit Sätzen, e1RM (Epley), Verlauf, Vorlagen ─────
import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, Balken, Leer, LEUCHT, useRueckfrage } from '../ui';
import { Feld, Raster, Zahlfeld, Hinweis, Weg, klein, de, datumLang, datumKurz, SPORT_FARBE } from './teile';
import { alleUebungen, alleVorlagen, e1rm, bestesE1rm, volumen, verlauf, rekorde, ausVorlage } from '@/lib/sport/gym';
import { neueId, type GymEinheit, type Muskelgruppe, type Op, type Satz, type SportStand, type Uebung, type Vorlage } from '@/lib/sport/modell';

const F = SPORT_FARBE.gym;
const GRUPPEN: { id: Muskelgruppe; label: string }[] = [{ id: 'beine', label: 'Beine' }, { id: 'ruecken', label: 'Rücken' }, { id: 'brust', label: 'Brust' }, { id: 'schulter', label: 'Schulter' }, { id: 'rumpf', label: 'Rumpf' }, { id: 'ganzkoerper', label: 'Ganzkörper' }, { id: 'hyrox', label: 'Hyrox' }];
const kennung = (name: string) => name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || neueId('u');

export function GymTeil({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const uebungen = useMemo(() => alleUebungen(stand.gym.uebungen), [stand.gym.uebungen]);
  const vorlagen = useMemo(() => alleVorlagen(stand.gym.vorlagen), [stand.gym.vorlagen]);
  const name = (id: string) => uebungen.find(u => u.id === id)?.name ?? id;
  const rek = useMemo(() => rekorde(stand.gym.einheiten), [stand.gym.einheiten]);
  const [offen, setOffen] = useState(false);
  const [bearbeite, setBearbeite] = useState<GymEinheit | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string>(() => Object.keys(rek)[0] ?? 'kniebeuge');
  const vl = useMemo(() => verlauf(stand.gym.einheiten, gewaehlt), [stand.gym.einheiten, gewaehlt]);
  const [neueUebung, setNeueUebung] = useState(''); const [neueGruppe, setNeueGruppe] = useState<Muskelgruppe>('ganzkoerper');
  const kraftZiel = stand.ziele.find(z => z.art === 'kraft' && !z.erledigt && z.uebung && z.zielKg);

  return (
    <>
      <Karte i={0} ton={F}>
        <Ueberschrift farbe={F} rechts={<button type="button" onClick={() => { setBearbeite(null); setOffen(o => !o); }} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{offen ? 'Schließen' : '+ Einheit'}</button>}>Einheiten</Ueberschrift>
        {(offen || bearbeite) && <EinheitFormular heute={heute} start={bearbeite ?? undefined} uebungen={uebungen} vorlagen={vorlagen} einheiten={stand.gym.einheiten}
          onSpeichern={async (e, alsVorlage) => {
            const ops: Op[] = [{ op: 'gym', eintrag: e }];
            if (alsVorlage) ops.push({ op: 'vorlage', eintrag: { id: kennung(alsVorlage), name: alsVorlage, uebungen: e.uebungen.map(u => ({ uebung: u.uebung, saetze: u.saetze.length, wdh: String(u.saetze[0]?.wdh ?? 8) })) } });
            const ok = await schicke(ops, 'Einheit gespeichert.'); if (ok) { setOffen(false); setBearbeite(null); }
          }} onAbbruch={() => { setOffen(false); setBearbeite(null); }} />}
        {!stand.gym.einheiten.length && !offen && <Leer>Eine Vorlage wählen („Hyrox Kraft A“) oder frei Sätze eintragen: Gewicht × Wiederholungen je Übung.</Leer>}
        {stand.gym.einheiten.slice(0, 30).map(e => {
          const vol = e.uebungen.reduce((s, u) => s + volumen(u.saetze), 0);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" onClick={() => { setBearbeite(e); setOffen(false); }} style={{ all: 'unset', cursor: 'pointer', fontSize: TYP.body, fontWeight: 500 }}>{datumLang(e.datum)}{e.vorlage ? ` · ${vorlagen.find(v => v.id === e.vorlage)?.name ?? e.vorlage}` : ''}</button>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.uebungen.map(u => `${name(u.uebung)} ${u.saetze.length}×`).join(' · ')}</div>
              </div>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'nowrap' }}>{de(vol, 0)} kg Vol.</span>
              <Weg onClick={async () => { if (await bestaetigen({ titel: 'Einheit entfernen?', text: 'Die erfasste Gym-Einheit fällt weg.', ja: 'Entfernen', gefahr: true })) void schicke([{ op: 'gym-weg', id: e.id }], 'Entfernt.'); }} />
            </div>
          );
        })}
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={kraftZiel ? `Ziel ${name(kraftZiel.uebung!)} ${de(kraftZiel.zielKg)} kg` : undefined}>Verlauf je Übung · e1RM</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.keys(rek).length ? Object.keys(rek).map(id => <Chip key={id} farbe={gewaehlt === id ? F : C.inkLeise}><button type="button" onClick={() => setGewaehlt(id)} style={{ all: 'unset', cursor: 'pointer' }}>{name(id)} {de(rek[id].e1rm)} kg</button></Chip>) : <Leer>Sobald Sätze mit Gewicht da sind, steht hier das geschätzte 1RM je Übung (Epley: kg × (1 + Wdh/30)).</Leer>}
        </div>
        {vl.length > 0 && (
          <>
            <Balken werte={vl.slice(-16).map(p => p.e1rm)} max={Math.max(kraftZiel?.uebung === gewaehlt ? kraftZiel.zielKg! : 0, ...vl.map(p => p.e1rm), 1)} farbe={F} hoehe={56} titel={vl.slice(-16).map(p => `${datumKurz(p.datum)} · e1RM ${de(p.e1rm)} kg · top ${de(p.topKg)} kg · ${p.saetze} Sätze`)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 14 }}>
              <Zahl wert={`${de(vl[vl.length - 1].e1rm)} kg`} label={`e1RM zuletzt · ${name(gewaehlt)}`} farbe={F} />
              <Zahl wert={`${de(rek[gewaehlt]?.e1rm)} kg`} label={`Rekord · ${rek[gewaehlt] ? datumKurz(rek[gewaehlt].datum) : ''}`} />
              <Zahl wert={`${de(vl[vl.length - 1].topKg)} kg`} label="schwerster Satz zuletzt" />
              {kraftZiel?.uebung === gewaehlt && <Zahl wert={`${Math.round((vl[vl.length - 1].e1rm / kraftZiel.zielKg!) * 100)} %`} label="vom Kraftziel" farbe={vl[vl.length - 1].e1rm >= kraftZiel.zielKg! ? LEUCHT.gut : C.ink} />}
            </div>
          </>
        )}
      </Karte>

      <Karte i={2}>
        <Ueberschrift>Bibliothek & Vorlagen</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {uebungen.map(u => <Chip key={u.id} farbe={u.eigen ? F : C.inkDim}>{u.name}{u.eigen && <button type="button" aria-label={`${u.name} entfernen`} onClick={() => void schicke([{ op: 'uebung-weg', id: u.id }], 'Übung entfernt.')} style={{ all: 'unset', cursor: 'pointer', marginLeft: 4 }}>×</button>}</Chip>)}
        </div>
        <Raster min={160}>
          <Feld label="Eigene Übung"><input value={neueUebung} onChange={e => setNeueUebung(e.target.value)} placeholder="z. B. Box Jump" style={klein} /></Feld>
          <Feld label="Gruppe"><select value={neueGruppe} onChange={e => setNeueGruppe(e.target.value as Muskelgruppe)} style={{ ...klein, colorScheme: 'dark' }}>{GRUPPEN.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></Feld>
          <div style={{ alignSelf: 'end' }}><Knopf leise aus={!neueUebung.trim()} onClick={async () => { const ok = await schicke([{ op: 'uebung', eintrag: { id: kennung(neueUebung), name: neueUebung.trim(), gruppe: neueGruppe } }], 'Übung angelegt.'); if (ok) setNeueUebung(''); }}>Hinzufügen</Knopf></div>
        </Raster>
        <div style={{ marginTop: 16 }}>
          {vorlagen.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{v.name}{v.eigen && <span style={{ color: F, fontSize: TYP.bedien, marginLeft: 8 }}>eigene</span>}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.uebungen.map(u => `${name(u.uebung)} ${u.saetze}×${u.wdh}`).join(' · ')}</div>
              </div>
              {v.eigen && <Weg onClick={async () => { if (await bestaetigen({ titel: `Vorlage „${v.name}“ entfernen?`, text: 'Erfasste Einheiten bleiben.', ja: 'Entfernen', gefahr: true })) void schicke([{ op: 'vorlage-weg', id: v.id }], 'Vorlage entfernt.'); }} />}
            </div>
          ))}
        </div>
        <Hinweis>Vorlagen sind Vorschläge für Trainingstage — keine Trainingsberatung. Eine eigene Vorlage entsteht beim Speichern einer Einheit („als Vorlage merken“).</Hinweis>
      </Karte>
      {dialog}
    </>
  );
}

function EinheitFormular({ heute, start, uebungen, vorlagen, einheiten, onSpeichern, onAbbruch }: { heute: string; start?: GymEinheit; uebungen: Uebung[]; vorlagen: Vorlage[]; einheiten: GymEinheit[]; onSpeichern: (e: GymEinheit, alsVorlage?: string) => Promise<void>; onAbbruch: () => void }) {
  const [e, setE] = useState<GymEinheit>(start ?? { id: neueId('gym'), datum: heute, uebungen: [] });
  const [neu, setNeu] = useState(uebungen[0]?.id ?? 'kniebeuge');
  const [merken, setMerken] = useState('');
  const name = (id: string) => uebungen.find(u => u.id === id)?.name ?? id;
  const setSatz = (ui: number, si: number, s: Partial<Satz>) => setE(x => ({ ...x, uebungen: x.uebungen.map((u, i) => i !== ui ? u : { ...u, saetze: u.saetze.map((y, j) => j !== si ? y : { ...y, ...s }) }) }));
  const ok = e.uebungen.some(u => u.saetze.some(s => s.wdh > 0));
  return (
    <div style={{ padding: '4px 0 14px', borderBottom: '1px solid rgba(255,255,255,.06)', marginBottom: 6 }}>
      <Raster min={160}>
        <Feld label="Datum"><input type="date" value={e.datum} max={heute} onChange={ev => setE(x => ({ ...x, datum: ev.target.value }))} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
        <Feld label="Aus Vorlage"><select value={e.vorlage ?? ''} onChange={ev => { const v = vorlagen.find(x => x.id === ev.target.value); setE(x => ({ ...x, vorlage: v?.id, uebungen: v ? ausVorlage(v, einheiten) : x.uebungen })); }} style={{ ...klein, colorScheme: 'dark' }}><option value="">— frei —</option>{vorlagen.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Feld>
        <Feld label="Dauer"><Zahlfeld wert={e.dauerMin} onWert={n => setE(x => ({ ...x, dauerMin: n }))} einheit="min" /></Feld>
      </Raster>
      <div style={{ marginTop: 12 }}>
        {e.uebungen.map((u, ui) => (
          <div key={ui} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{name(u.uebung)} <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 400 }}>e1RM {de(bestesE1rm(u.saetze))} kg</span></span>
              <Weg label="Übung entfernen" onClick={() => setE(x => ({ ...x, uebungen: x.uebungen.filter((_, i) => i !== ui) }))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {u.saetze.map((s, si) => (
                <div key={si} style={{ display: 'grid', gridTemplateColumns: '28px minmax(70px, 1fr) 16px minmax(70px, 1fr) 70px 28px', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{si + 1}.</span>
                  <Zahlfeld wert={s.kg} onWert={n => setSatz(ui, si, { kg: n ?? 0 })} einheit="kg" stil={{ padding: '7px 10px' }} />
                  <span style={{ textAlign: 'center', color: C.inkLeise }}>×</span>
                  <input type="number" min={1} max={200} value={s.wdh || ''} aria-label="Wiederholungen" onChange={ev => setSatz(ui, si, { wdh: Number(ev.target.value) || 0 })} style={{ ...klein, padding: '7px 10px' }} />
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{s.kg && s.wdh ? `${de(e1rm(s.kg, s.wdh))} kg` : ''}</span>
                  <Weg label="Satz entfernen" onClick={() => setE(x => ({ ...x, uebungen: x.uebungen.map((y, i) => i !== ui ? y : { ...y, saetze: y.saetze.filter((_, j) => j !== si) }) }))} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setE(x => ({ ...x, uebungen: x.uebungen.map((y, i) => i !== ui ? y : { ...y, saetze: [...y.saetze, { ...(y.saetze[y.saetze.length - 1] ?? { kg: 0, wdh: 8 }) }] }) }))} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontSize: TYP.bedien, fontWeight: 700, marginTop: 6 }}>+ Satz</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <select value={neu} onChange={ev => setNeu(ev.target.value)} aria-label="Übung wählen" style={{ ...klein, width: 'auto', colorScheme: 'dark' }}>{uebungen.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <Knopf leise onClick={() => setE(x => ({ ...x, uebungen: [...x.uebungen, { uebung: neu, saetze: [{ kg: 0, wdh: 8 }, { kg: 0, wdh: 8 }, { kg: 0, wdh: 8 }] }] }))}>+ Übung</Knopf>
      </div>
      <Raster min={200}>
        <div style={{ marginTop: 10 }}><Feld label="Notiz"><input value={e.notiz ?? ''} onChange={ev => setE(x => ({ ...x, notiz: ev.target.value || undefined }))} placeholder="Wie lief es" style={klein} /></Feld></div>
        <div style={{ marginTop: 10 }}><Feld label="Als Vorlage merken (Name)"><input value={merken} onChange={ev => setMerken(ev.target.value)} placeholder="z. B. Mein Beintag" style={klein} /></Feld></div>
      </Raster>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Knopf farbe={F} aus={!ok} onClick={() => ok && void onSpeichern({ ...e, uebungen: e.uebungen.map(u => ({ ...u, saetze: u.saetze.filter(s => s.wdh > 0) })).filter(u => u.saetze.length) }, merken.trim() || undefined)}>{start ? 'Speichern' : 'Einheit anlegen'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}

'use client';

// ─── Sport — Plan-Baukasten: Woche bauen, Vorlagen, Block (09.10.2026) ──────────────────────────────────────────────────
// Die Person plant selbst (Wunsch 09.10.): eine Woche aus Einheiten je Tag (Sparte, Art, Dauer, Intensität — Zone und Strain-Ziel unter
// „mehr“, Zonen sind ihr eher unwichtig), Tage flexibel („Tage vorschlagen“: harte Einheiten nicht an Folgetagen, langer Lauf am Wochenende),
// als eigene Vorlage speicherbar; Startvorlagen (erfunden, neutral) zum Übernehmen; ein Block über mehrere Wochen (Aufbau → Deload/Taper,
// Deload fest oder nach Tagesform) auf ein Ziel hin. Regeln und Rechnung nur in lib/sport/plan-bau.ts. Vorschläge, keine Trainingsberatung.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Leer, LEUCHT, Pillen as UiPillen, MehrfachPillen, auswahl, useRueckfrage } from '../ui';
import { Feld, Hinweis, klein, datumKurz, de, KLASSE_FARBE, einheitText } from './teile';
import {
  WOCHENTAGE, WOCHENTAG_LABEL, SPARTEN, PLAN_LABEL, EINHEIT_TYPEN, INTENSITAETEN, INTENSITAET_LABEL, PHASE_LABEL, PLAN_GRENZEN, neueId,
  type Op, type SportStand, type Woche, type Wochentag, type PlanEinheit, type Sparte, type EinheitTyp, type Intensitaet,
} from '@/lib/sport/modell';
import { alleVorlagen, blockBauen, einheitenVon, einheitenDerWoche, planPruefen, tagAus, tageVorschlagen, wocheFuer, saison, STANDARD, START_VORLAGEN } from '@/lib/sport/plan-bau';
import { planUmfang } from '@/lib/sport/plan';
import { montagVon, tagPlus } from '@/lib/sport/pace';

type Ziel = { id: string; name: string; art: 'standard' | 'eigen' };

/** Die Woche bauen: Standardwoche oder eine eigene Vorlage bearbeiten; Startvorlagen übernehmen. */
export function WochenBaukasten({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const [offen, setOffen] = useState(false);
  const [ziel, setZiel] = useState<Ziel>({ id: STANDARD, name: 'Standardwoche', art: 'standard' });
  const [entwurf, setEntwurf] = useState<Woche | null>(null);
  const [name, setName] = useState('');
  const [tage, setTage] = useState<Wochentag[]>(WOCHENTAGE.filter(t => stand.woche[t].art !== 'ruhe'));
  const { bestaetigen, dialog } = useRueckfrage();
  const vorlagen = alleVorlagen(stand);
  const quelle = (z: Ziel): Woche => vorlagen.find(v => v.id === z.id)?.woche ?? stand.woche;
  const w = entwurf ?? quelle(ziel);
  const hinweise = useMemo(() => planPruefen(w), [w]);
  const umfang = useMemo(() => planUmfang(w), [w]);
  const geaendert = entwurf !== null;

  const setzeTag = (t: Wochentag, einheiten: PlanEinheit[], ruhe = false) => setEntwurf({ ...w, [t]: tagAus(einheiten, ruhe) });
  const speichern = async () => {
    const ok = ziel.art === 'standard'
      ? await schicke([{ op: 'woche', tage: w, planStart: stand.planStart ?? montagVon(heute) }], 'Standardwoche gespeichert.')
      : await schicke([{ op: 'plan-vorlage', eintrag: { id: ziel.id, name: ziel.name, woche: w } }], 'Vorlage gespeichert.');
    if (ok) setEntwurf(null);
  };
  const alsVorlage = async () => {
    const n = name.trim();
    if (!n) return;
    const id = neueId('pv');
    if (await schicke([{ op: 'plan-vorlage', eintrag: { id, name: n, woche: w } }], `„${n}“ gespeichert.`)) { setName(''); setEntwurf(null); setZiel({ id, name: n, art: 'eigen' }); }
  };
  const wechseln = async (z: Ziel) => {
    if (geaendert && !(await bestaetigen({ titel: 'Änderungen verwerfen?', text: 'Die Woche ist noch nicht gespeichert.', ja: 'Verwerfen', gefahr: true }))) return;
    setEntwurf(null); setZiel(z);
  };

  return (
    <Karte i={3}>
      <Ueberschrift rechts={<button type="button" onClick={() => setOffen(o => !o)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{offen ? 'Schließen' : 'Bauen'}</button>}>Wochenplan bauen</Ueberschrift>
      {!offen && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
          Standardwoche: {umfangText(planUmfang(stand.woche))}. {stand.planVorlagen?.length ? `${stand.planVorlagen.length} eigene Vorlage${stand.planVorlagen.length === 1 ? '' : 'n'}.` : 'Noch keine eigene Vorlage.'}
        </div>
      )}
      {offen && (
        <>
          <Feld label="Was bearbeitest du?">
            <UiPillen liste={vorlagen.filter(v => v.art !== 'start').map(v => ({ id: v.id, label: v.name }))} aktiv={ziel.id}
              onWahl={id => { const v = vorlagen.find(x => x.id === id)!; void wechseln({ id: v.id, name: v.name, art: v.art === 'standard' ? 'standard' : 'eigen' }); }} />
          </Feld>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '8px 0 4px' }}>{umfangText(umfang)}</div>
          {WOCHENTAGE.map(t => <TagEditor key={t} t={t} tag={w[t]} onEinheiten={(e, ruhe) => setzeTag(t, e, ruhe)} />)}
          {hinweise.map(h => <Hinweis key={h.art + h.tage.join()}>{h.text}</Hinweis>)}
          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, border: `1px solid ${RAND.flaeche}` }}>
            <Feld label="Trainingstage, an denen es geht"><MehrfachPillen liste={WOCHENTAGE.map(t => ({ id: t, label: WOCHENTAG_LABEL[t] }))} aktiv={tage} onWahl={setTage} /></Feld>
            <div style={{ marginTop: 8 }}><Knopf leise aus={!tage.length || !einheitenDerWoche(w).length} onClick={() => setEntwurf(tageVorschlagen(einheitenDerWoche(w), tage))}>Tage vorschlagen</Knopf></div>
            <Hinweis>Verteilt die Einheiten neu: langer Lauf aufs Wochenende, harte Einheiten mit einem Tag Luft. Danach kannst du alles von Hand ändern.</Hinweis>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
            <Knopf haupt aus={!geaendert} onClick={speichern}>{ziel.art === 'standard' ? 'Standardwoche speichern' : `„${ziel.name}“ speichern`}</Knopf>
            {geaendert && <Knopf leise onClick={() => setEntwurf(null)}>Verwerfen</Knopf>}
          </div>
          <form onSubmit={e => { e.preventDefault(); void alsVorlage(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}><Feld label="Als eigene Vorlage speichern"><input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="z. B. Aufbauwoche" style={klein} /></Feld></div>
            <Knopf typ="submit" leise aus={!name.trim() || (stand.planVorlagen?.length ?? 0) >= PLAN_GRENZEN.vorlagen}>Speichern</Knopf>
          </form>
          {ziel.art === 'eigen' && (
            <div style={{ marginTop: 10 }}><Knopf leise onClick={async () => { if (await bestaetigen({ titel: `„${ziel.name}“ entfernen?`, text: 'Die Vorlage fällt weg (ein laufender Block hält sie fest).', ja: 'Entfernen', gefahr: true })) { if (await schicke([{ op: 'plan-vorlage-weg', id: ziel.id }], 'Vorlage entfernt.')) { setEntwurf(null); setZiel({ id: STANDARD, name: 'Standardwoche', art: 'standard' }); } } }}>Vorlage entfernen</Knopf></div>
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Startvorlagen</div>
            {START_VORLAGEN.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: `1px solid ${RAND.flaeche}` }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{v.name}</div>
                  <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{v.notiz} · {umfangText(planUmfang(v.woche))}</div>
                </div>
                <Knopf leise onClick={() => setEntwurf(v.woche)}>In die Woche laden</Knopf>
              </div>
            ))}
            <Hinweis>Startvorlagen sind Beispiele zum Anpassen — „In die Woche laden“ ändert erst etwas, wenn du speicherst.</Hinweis>
          </div>
        </>
      )}
      {dialog}
    </Karte>
  );
}

const umfangText = (u: ReturnType<typeof planUmfang>) => `${u.einheiten} Einheit${u.einheiten === 1 ? '' : 'en'} · rund ${de(u.minuten / 60)} h · ${u.ruhetage} Ruhetag${u.ruhetage === 1 ? '' : 'e'}`;

function TagEditor({ t, tag, onEinheiten }: { t: Wochentag; tag: Woche[Wochentag]; onEinheiten: (e: PlanEinheit[], ruhe?: boolean) => void }) {
  const einheiten = einheitenVon(tag, t);
  const neu = () => onEinheiten([...einheiten, { id: neueId(t).slice(0, 60), sparte: 'lauf', typ: 'grundlage', dauerMin: 45 }]);
  return (
    <section aria-label={WOCHENTAG_LABEL[t]} style={{ padding: '10px 0', borderBottom: `1px solid ${RAND.flaeche}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{WOCHENTAG_LABEL[t]}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!einheiten.length && <Knopf leise onClick={() => onEinheiten([], tag.art !== 'ruhe')}>{tag.art === 'ruhe' ? 'Ruhetag ✓' : 'Ruhetag'}</Knopf>}
          {einheiten.length < PLAN_GRENZEN.einheitenJeTag && <Knopf leise onClick={neu}>+ Einheit</Knopf>}
        </div>
      </div>
      {einheiten.map((e, i) => <EinheitEditor key={e.id} e={e} onAendern={x => onEinheiten(einheiten.map((y, j) => (j === i ? x : y)))} onWeg={() => onEinheiten(einheiten.filter((_, j) => j !== i))} />)}
    </section>
  );
}

function EinheitEditor({ e, onAendern, onWeg }: { e: PlanEinheit; onAendern: (e: PlanEinheit) => void; onWeg: () => void }) {
  const [mehr, setMehr] = useState(false);
  const setze = (x: Partial<PlanEinheit>) => { const r = { ...e, ...x }; for (const k of Object.keys(x) as (keyof PlanEinheit)[]) if (x[k] === undefined) delete r[k]; onAendern(r); };
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, border: `1px solid ${RAND.flaeche}`, borderLeft: `3px solid ${KLASSE_FARBE[e.sparte]}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end' }}>
        <Feld label="Sparte"><select value={e.sparte} onChange={ev => setze({ sparte: ev.target.value as Sparte })} style={{ ...auswahl, width: '100%' }}>{SPARTEN.map(s => <option key={s} value={s}>{PLAN_LABEL[s]}</option>)}</select></Feld>
        <Feld label="Art"><select value={e.typ ?? ''} onChange={ev => setze({ typ: (ev.target.value || undefined) as EinheitTyp | undefined })} style={{ ...auswahl, width: '100%' }}><option value="">—</option>{EINHEIT_TYPEN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Feld>
        <Feld label="Minuten"><input type="number" inputMode="numeric" min={5} max={600} step={5} value={e.dauerMin ?? ''} onChange={ev => setze({ dauerMin: Number(ev.target.value) || undefined })} style={klein} /></Feld>
        <Feld label="Intensität"><select value={e.intensitaet ?? ''} onChange={ev => setze({ intensitaet: (ev.target.value || undefined) as Intensitaet | undefined })} style={{ ...auswahl, width: '100%' }}><option value="">nach Art</option>{INTENSITAETEN.map(x => <option key={x} value={x}>{INTENSITAET_LABEL[x]}</option>)}</select></Feld>
      </div>
      {mehr && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8, alignItems: 'end' }}>
          <Feld label="Zielzone"><select value={e.zone ?? ''} onChange={ev => setze({ zone: Number(ev.target.value) || undefined })} style={{ ...auswahl, width: '100%' }}><option value="">—</option>{[1, 2, 3, 4, 5].map(z => <option key={z} value={z}>Zone {z}</option>)}</select></Feld>
          <Feld label="Strain-Ziel"><input type="number" inputMode="decimal" min={0} max={21} step={0.5} value={e.strain ?? ''} onChange={ev => { const n = Number(ev.target.value); setze({ strain: ev.target.value !== '' && Number.isFinite(n) ? n : undefined }); }} style={klein} /></Feld>
          <Feld label="Uhrzeit (Kalender)"><input type="time" step={900} value={e.uhrzeit ?? ''} onChange={ev => setze({ uhrzeit: ev.target.value || undefined })} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
          <Feld label="Notiz" breit><input value={e.notiz ?? ''} maxLength={200} onChange={ev => setze({ notiz: ev.target.value || undefined })} placeholder="z. B. 6 × 800 m" style={klein} /></Feld>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setMehr(m => !m)} style={{ all: 'unset', cursor: 'pointer', color: C.inkDim, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{mehr ? 'weniger' : 'mehr (Zone, Strain, Uhrzeit, Notiz)'}</button>
        <button type="button" onClick={onWeg} aria-label="Einheit entfernen" style={{ all: 'unset', cursor: 'pointer', color: C.inkLeise, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Entfernen</button>
      </div>
    </div>
  );
}

/** Block: mehrere Wochen nacheinander (Aufbau → Deload/Taper), optional auf ein Ziel hin. */
export function BlockKarte({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [neu, setNeu] = useState(false);
  const ziele = useMemo(() => saison(stand.ziele, heute), [stand.ziele, heute]);
  const vorlagen = alleVorlagen(stand);
  const [vorlage, setVorlage] = useState(STANDARD);
  const [start, setStart] = useState<'jetzt' | 'naechste'>('jetzt');
  const [bis, setBis] = useState<string>(ziele[0]?.ziel.id ?? 'wochen');
  const [wochen, setWochen] = useState(8);
  const [aufbau, setAufbau] = useState(3);
  const [deload, setDeload] = useState<'tagesform' | '1'>('tagesform');
  const [taper, setTaper] = useState(1);
  const montag = start === 'jetzt' ? montagVon(heute) : tagPlus(montagVon(heute), 7);
  const zielWahl = ziele.find(z => z.ziel.id === bis)?.ziel;
  const vorschau = useMemo(() => blockBauen({ id: 'vorschau', start: montag, vorlage, ...(zielWahl ? { bis: zielWahl.datum! } : { wochen }), aufbau, deload: deload === '1' ? 1 : 0, taper, ...(zielWahl ? { zielId: zielWahl.id } : {}) }), [montag, vorlage, zielWahl, wochen, aufbau, deload, taper]);
  const b = stand.block;
  const jetztWoche = b ? wocheFuer(stand, heute) : null;

  return (
    <Karte i={4}>
      <Ueberschrift rechts={!b ? <button type="button" onClick={() => setNeu(n => !n)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{neu ? 'Schließen' : '+ Block'}</button> : undefined}>Block · mehrere Wochen</Ueberschrift>
      {b ? (
        <>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>
            {jetztWoche?.blockWoche ? `Woche ${jetztWoche.blockWoche} von ${jetztWoche.blockWochen}` : `ab ${datumKurz(b.start)}`}{b.zielId ? ` · auf „${stand.ziele.find(z => z.id === b.zielId)?.titel ?? 'Ziel'}“ hin` : ''}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} aria-label="Wochen des Blocks">
            {b.wochen.map((w, i) => {
              const m = tagPlus(b.start, 7 * i);
              const aktiv = m === montagVon(heute);
              const f = w.phase === 'deload' ? LEUCHT.schlaf : w.phase === 'taper' ? LEUCHT.business : LEUCHT.gut;
              return <span key={m} title={`ab ${datumKurz(m)} · ${PHASE_LABEL[w.phase]} · ${vorlagen.find(v => v.id === w.vorlage)?.name ?? 'Standardwoche'}`} style={{ width: 22, height: 22, borderRadius: 6, background: `${f}${aktiv ? 'CC' : '40'}`, outline: aktiv ? `2px solid ${C.ink}` : undefined }} />;
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
            <span><Chip farbe={LEUCHT.gut}>Aufbau</Chip></span><span><Chip farbe={LEUCHT.schlaf}>Deload</Chip></span><span><Chip farbe={LEUCHT.business}>Taper</Chip></span>
          </div>
          <div style={{ marginTop: 12 }}><Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Block beenden?', text: 'Ab jetzt gilt wieder die Standardwoche. Vorlagen bleiben.', ja: 'Beenden', gefahr: true })) await schicke([{ op: 'plan-block', block: null }], 'Block beendet.'); }}>Block beenden</Knopf></div>
        </>
      ) : !neu ? (
        <Leer>Ohne Block gilt jede Woche die Standardwoche. Ein Block plant Aufbau-, Deload- und Taper-Wochen auf ein Ziel hin.</Leer>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            <Feld label="Vorlage für die Wochen"><select value={vorlage} onChange={e => setVorlage(e.target.value)} style={{ ...auswahl, width: '100%' }}>{vorlagen.map(v => <option key={v.id} value={v.id}>{v.name}{v.art === 'start' ? ' (Startvorlage)' : ''}</option>)}</select></Feld>
            <Feld label="Start"><UiPillen liste={[{ id: 'jetzt', label: `diese Woche (${datumKurz(montagVon(heute))})` }, { id: 'naechste', label: `nächste (${datumKurz(tagPlus(montagVon(heute), 7))})` }]} aktiv={start} onWahl={setStart} /></Feld>
            <Feld label="Bis"><UiPillen liste={[...ziele.map(z => ({ id: z.ziel.id, label: `${z.ziel.titel} (${z.text})` })), { id: 'wochen', label: 'Anzahl Wochen' }]} aktiv={bis} onWahl={setBis} /></Feld>
            {bis === 'wochen' && <Feld label="Wochen"><input type="number" min={1} max={PLAN_GRENZEN.blockWochen} value={wochen} onChange={e => setWochen(Math.max(1, Math.min(PLAN_GRENZEN.blockWochen, Number(e.target.value) || 1)))} style={klein} /></Feld>}
            <Feld label="Deload"><UiPillen liste={[{ id: 'tagesform', label: 'nach Tagesform (HRV-Trend)' }, { id: '1', label: `fest nach ${aufbau} Wochen` }]} aktiv={deload} onWahl={setDeload} /></Feld>
            {deload === '1' && <Feld label="Aufbau-Wochen vor jedem Deload"><UiPillen liste={[2, 3, 4, 5].map(n => ({ id: String(n), label: String(n) }))} aktiv={String(aufbau)} onWahl={x => setAufbau(Number(x))} /></Feld>}
            <Feld label="Taper-Wochen am Ende"><UiPillen liste={[0, 1, 2].map(n => ({ id: String(n), label: n ? String(n) : 'keine' }))} aktiv={String(taper)} onWahl={x => setTaper(Number(x))} /></Feld>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12 }} aria-label="Vorschau">
            {vorschau.wochen.map((w, i) => <Chip key={i} farbe={w.phase === 'deload' ? LEUCHT.schlaf : w.phase === 'taper' ? LEUCHT.business : LEUCHT.gut}>{datumKurz(tagPlus(vorschau.start, 7 * i))} {PHASE_LABEL[w.phase]}</Chip>)}
          </div>
          <div style={{ marginTop: 12 }}><Knopf haupt onClick={async () => { if (await schicke([{ op: 'plan-block', block: { ...vorschau, id: neueId('block') } }], 'Block steht.')) setNeu(false); }}>Block speichern</Knopf></div>
          <Hinweis>Deload „nach Tagesform“: keine festen leichten Wochen — schlägt die HRV-Regel eine Entlastung vor, nimmst du sie unter „Diese Woche“ an.</Hinweis>
        </>
      )}
      {dialog}
    </Karte>
  );
}

/** Kurztext einer geplanten Woche für Listen. */
export const wocheKurz = (w: Woche) => WOCHENTAGE.filter(t => einheitenVon(w[t], t).length).map(t => `${WOCHENTAG_LABEL[t]} ${einheitenVon(w[t], t).map(e => einheitText(e)).join(' + ')}`).join(' · ');

'use client';

// ─── Sport — Erholung: Schlaf, Puls, HRV, Gefühl, Muskelkater · Ampel · Deload
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Ring, Balken, Zahl, LEUCHT } from '../schlank';
import { Feld, Raster, Zahlfeld, Skala, Hinweis, de, datumKurz, datumLang, stilLink, SPORT_FARBE } from './teile';
import { ampel, bezugAus, AMPEL_LABEL, type Stufe } from '@/lib/sport/ampel';
import { deload, ersteEinheit, wochentagVon } from '@/lib/sport/plan';
import { tagPlus } from '@/lib/sport/pace';
import { PLAN_LABEL, WOCHENTAGE, WOCHENTAG_LABEL, type ErholungTag, type Op, type SportStand } from '@/lib/sport/modell';
import type { VitalTag } from '@/app/api/sport/route';
import { WEG } from '@/lib/wege';

const F = SPORT_FARBE.erholung;
const AMPEL_FARBE: Record<Stufe, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, unbekannt: C.inkLeise };

export function ErholungTeil({ stand, heute, vitals, schicke }: { stand: SportStand; heute: string; vitals: Record<string, VitalTag>; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const gespeichert = stand.erholung[heute];
  const v = vitals[heute];
  // Vorbelegen aus den Vitalwerten der Person (Whoop-Export / Morgen-Check), solange nichts von Hand steht.
  const [t, setT] = useState<ErholungTag>(() => ({ schlafH: gespeichert?.schlafH ?? v?.schlafH, ruhepuls: gespeichert?.ruhepuls ?? v?.ruhepuls, hrv: gespeichert?.hrv ?? v?.hrv, gefuehl: gespeichert?.gefuehl, muskelkater: gespeichert?.muskelkater, notiz: gespeichert?.notiz }));
  useEffect(() => { setT({ schlafH: gespeichert?.schlafH ?? v?.schlafH, ruhepuls: gespeichert?.ruhepuls ?? v?.ruhepuls, hrv: gespeichert?.hrv ?? v?.hrv, gefuehl: gespeichert?.gefuehl, muskelkater: gespeichert?.muskelkater, notiz: gespeichert?.notiz }); }, [gespeichert, v]);
  const ausVitals = !gespeichert?.schlafH && !!v?.schlafH;
  const geplant = stand.woche[wochentagVon(heute)].art;
  const bezug = useMemo(() => bezugAus(stand.erholung, heute), [stand.erholung, heute]);
  const a = ampel(t, geplant, bezug, v?.recovery);
  const fa = AMPEL_FARBE[a.stufe];
  const dl = deload(stand.planStart ?? ersteEinheit(stand), heute, 4);
  const tage = useMemo(() => Array.from({ length: 14 }, (_, i) => tagPlus(heute, i - 13)), [heute]);
  const schlaf = tage.map(d => stand.erholung[d]?.schlafH ?? vitals[d]?.schlafH ?? null);
  const gefuehl = tage.map(d => stand.erholung[d]?.gefuehl ?? null);
  const kater = tage.map(d => stand.erholung[d]?.muskelkater ?? null);
  const ruhetage = WOCHENTAGE.filter(d => stand.woche[d].art === 'ruhe');
  const geaendert = JSON.stringify(t) !== JSON.stringify({ schlafH: gespeichert?.schlafH, ruhepuls: gespeichert?.ruhepuls, hrv: gespeichert?.hrv, gefuehl: gespeichert?.gefuehl, muskelkater: gespeichert?.muskelkater, notiz: gespeichert?.notiz });

  return (
    <>
      <Karte i={0} akzent={fa}>
        <Ueberschrift farbe={fa} rechts={`Plan heute: ${PLAN_LABEL[geplant]}`}>Heute trainieren?</Ueberschrift>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring label="Erholung" wert={a.punkte != null ? String(a.punkte) : undefined} anteil={a.punkte != null ? a.punkte / 100 : undefined} farbe={fa} unter={<Chip farbe={fa}>{AMPEL_LABEL[a.stufe]}</Chip>} />
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <p style={{ fontSize: TYP.body, lineHeight: 1.5, margin: 0, color: C.ink }}>{a.text}</p>
            {a.gruende.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{a.gruende.map(g => <Chip key={g} farbe={C.inkDim}>{g}</Chip>)}</div>}
            {v?.recovery != null && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Recovery {v.recovery} % aus deinen Vitalwerten (Whoop / Morgen-Check).</div>}
          </div>
        </div>
      </Karte>

      <Karte i={1} akzent={F}>
        <Ueberschrift farbe={F} rechts={ausVitals ? 'Schlaf, Puls, HRV aus Vitalwerten vorbelegt' : undefined}>Heute eintragen · {datumLang(heute)}</Ueberschrift>
        <Raster min={130}>
          <Feld label="Schlaf"><Zahlfeld wert={t.schlafH} onWert={n => setT(x => ({ ...x, schlafH: n }))} einheit="h" placeholder="7,5" /></Feld>
          <Feld label="Ruhepuls"><Zahlfeld wert={t.ruhepuls} onWert={n => setT(x => ({ ...x, ruhepuls: n }))} einheit="bpm" /></Feld>
          <Feld label="HRV"><Zahlfeld wert={t.hrv} onWert={n => setT(x => ({ ...x, hrv: n }))} einheit="ms" /></Feld>
          <Feld label="Gefühl (1 platt … 5 frisch)" breit><Skala wert={t.gefuehl} onWert={n => setT(x => ({ ...x, gefuehl: n }))} /></Feld>
          <Feld label="Muskelkater (1 keiner … 5 überall)" breit><Skala wert={t.muskelkater} onWert={n => setT(x => ({ ...x, muskelkater: n }))} umgekehrt /></Feld>
          <Feld label="Notiz" breit><input value={t.notiz ?? ''} onChange={e => setT(x => ({ ...x, notiz: e.target.value || undefined }))} placeholder="Was der Körper sagt" style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '9px 12px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, outline: 'none' }} /></Feld>
        </Raster>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <Knopf farbe={F} aus={!geaendert} onClick={() => void schicke([{ op: 'erholung', tag: heute, werte: { ...t, quelle: ausVitals ? 'whoop' : 'hand' } }], 'Erholung gespeichert.')}>Speichern</Knopf>
          <Link href={WEG.gesundheit('morgen')} style={{ ...stilLink, fontSize: TYP.bedien }}>Morgen-Check in Gesundheit ›</Link>
        </div>
        {bezug.hrv7 == null && bezug.ruhepuls7 == null && <Hinweis>HRV und Ruhepuls zählen in der Ampel erst, wenn drei Tage als Vergleich da sind — dann gegen deinen eigenen 7-Tage-Schnitt.</Hinweis>}
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts="14 Tage">Verlauf</Ueberschrift>
        <div style={{ display: 'grid', gap: 18 }}>
          <div><div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 6 }}>Schlaf <span style={{ color: C.inkLeise }}>· h</span></div><Balken werte={schlaf} max={9} farbe={LEUCHT.schlaf} hoehe={40} titel={tage.map((d, i) => `${datumKurz(d)} · ${schlaf[i] != null ? `${de(schlaf[i])} h` : 'kein Wert'}`)} /></div>
          <div><div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 6 }}>Gefühl <span style={{ color: C.inkLeise }}>· 1–5</span></div><Balken werte={gefuehl} max={5} farbe={LEUCHT.gut} hoehe={32} titel={tage.map((d, i) => `${datumKurz(d)} · ${gefuehl[i] ?? '—'}`)} /></div>
          <div><div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 6 }}>Muskelkater <span style={{ color: C.inkLeise }}>· 1–5, niedriger ist besser</span></div><Balken werte={kater} max={5} farbe={LEUCHT.achtung} hoehe={32} titel={tage.map((d, i) => `${datumKurz(d)} · ${kater[i] ?? '—'}`)} /></div>
        </div>
      </Karte>

      <Karte i={3} akzent={dl?.jetzt ? LEUCHT.achtung : undefined}>
        <Ueberschrift>Ruhe & Deload</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
          <Zahl wert={ruhetage.length ? ruhetage.map(d => WOCHENTAG_LABEL[d]).join(' · ') : undefined} label="Ruhetage im Wochenplan" farbe={F} />
          {dl && <Zahl wert={dl.jetzt ? 'jetzt' : `in ${dl.naechsteIn} Wo.`} label={dl.jetzt ? 'Deload-Woche' : `nächste leichte Woche · ab ${datumKurz(dl.naechsterMontag)}`} farbe={dl.jetzt ? LEUCHT.achtung : undefined} />}
          {dl && <Zahl wert={`${dl.wocheImBlock} / ${dl.rhythmus}`} label="Woche im Block" />}
        </div>
        <Hinweis>Alle 4 Wochen eine leichte Woche (Umfang etwa halbieren, Intensität raus) — ein üblicher Rhythmus, kein Muss. {!ruhetage.length && 'Kein Ruhetag im Plan: unter „Ziele & Plan“ einen Tag auf Ruhe stellen.'} Keine Trainingsberatung; bei Beschwerden führen Ärztin oder Physio.</Hinweis>
      </Karte>
    </>
  );
}

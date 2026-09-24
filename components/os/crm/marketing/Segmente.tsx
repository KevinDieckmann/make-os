'use client';

// ─── CRM · Marketing › Segmente — „wen meinen wir?“ ────────────────────────
// Gespeicherte Filter über die Kartei mit Live-Zahl und Kanal-Aufteilung
// (lib/crm/segmente.ts). Gesperrte Personen sind nie Mitglied; mit einem
// Kanal-Kriterium zählt nur, wer darüber zulässig erreichbar ist. Der Export
// enthält Mail-Adressen nur, wo die Mail-Ampel grün ist. Drei Vorlagen
// werden erst auf Klick angelegt.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, feld, LEUCHT } from '../../schlank';
import { anzeigename, HERKUNFT, type Kontakt } from '@/lib/make-one/crm';
import type { Segment, SegmentKriterien } from '@/lib/crm/typen';
import { kontextAus, segmentAuswerten, type SegmentAuswertung } from '@/lib/crm/segmente';
import { SEGMENT_VORLAGEN, vorlageAlsSegment, kriterienText, kriterienSauber, kriterienGleich } from '@/lib/crm/marketing';
import { type CrmApi, neueId } from '../daten';
import { Pillen, Feldzeile } from '../teile';
import { ROLLEN } from '../Firmen';
import { Mehrfach } from './gemeinsam';

const PHASEN = [{ id: 'kontakt', label: 'Kontakt' }, { id: 'interessent', label: 'Interessent' }, { id: 'kunde', label: 'Kunde' }, { id: 'ex_kunde', label: 'Ex-Kunde' }, { id: 'partner', label: 'Partner' }, { id: 'multiplikator', label: 'Multiplikator' }];
const KREISE = ['A', 'B', 'C', 'D'].map(k => ({ id: k, label: `Kreis ${k}` }));
const PRIOS = ['A', 'B', 'C'].map(p => ({ id: p, label: `Prio ${p}` }));
const FIRMA_ROLLEN = ROLLEN.map(r => ({ id: r.id as string, label: r.label }));
const HERKUENFTE = HERKUNFT.map(h => ({ id: h.id as string, label: h.label }));
type KanalWahl = '' | NonNullable<SegmentKriterien['kanal']>;
const KANAELE: { id: KanalWahl; label: string }[] = [{ id: '', label: 'egal' }, { id: 'mail', label: 'Mail' }, { id: 'telefon', label: 'Telefon' }, { id: 'linkedin', label: 'LinkedIn' }, { id: 'newsletter', label: 'Newsletter' }, { id: 'einladung', label: 'Einladung' }];
const CHANCE: { id: 'egal' | 'ja' | 'nein'; label: string }[] = [{ id: 'egal', label: 'egal' }, { id: 'ja', label: 'mit offener Chance' }, { id: 'nein', label: 'ohne offene Chance' }];

type Entwurf = { id: string; name: string; beschreibung: string; kriterien: SegmentKriterien; neu: boolean };

/** Kanal-Aufteilung als Chips — grün, was zulässig ist; „nur persönlich“ leise. */
export function KanalZahlen({ a }: { a: SegmentAuswertung }) {
  const K: [keyof SegmentAuswertung['kanaele'], string][] = [['mail', 'Mail'], ['telefon', 'Telefon'], ['linkedin', 'LinkedIn'], ['newsletter', 'Newsletter'], ['einladung', 'Einladung'], ['nurPersoenlich', 'nur persönlich']];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {K.map(([id, l]) => <Chip key={id} farbe={id === 'nurPersoenlich' ? C.inkDim : a.kanaele[id] ? LEUCHT.gut : C.inkLeise}>{l} {a.kanaele[id]}</Chip>)}
    </div>
  );
}

export function Segmente({ api, zuKontakt, zuKampagne }: { api: CrmApi; zuKontakt: (id: string) => void; zuKampagne: (segmentId: string) => void }) {
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState('');
  const crm = api.crm;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const ctx = useMemo(() => (crm ? kontextAus(crm.stand, heute) : null), [crm, heute]);
  const segmente = useMemo(() => [...(crm?.stand.segmente ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [crm]);
  const zahlen = useMemo(() => new Map(ctx ? segmente.map(s => [s.id, segmentAuswerten(kontakte, s.kriterien, ctx)]) : []), [segmente, kontakte, ctx]);
  const vorschau = useMemo(() => (entwurf && ctx ? segmentAuswerten(kontakte, entwurf.kriterien, ctx) : null), [entwurf, kontakte, ctx]);
  const vorlagen = useMemo(() => (ctx ? SEGMENT_VORLAGEN.filter(v => !segmente.some(s => s.name.trim().toLowerCase() === v.name.toLowerCase())).map(v => ({ v, anzahl: segmentAuswerten(kontakte, v.kriterien, ctx).anzahl })) : []), [segmente, kontakte, ctx]);
  if (!crm || !ctx) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const oeffne = (s: Segment) => setEntwurf(entwurf?.id === s.id ? null : { id: s.id, name: s.name, beschreibung: s.beschreibung ?? '', kriterien: { ...s.kriterien }, neu: false });
  const speichern = async (e: Entwurf) => {
    const kriterien = kriterienSauber(e.kriterien);
    await api.setze('segmente', { id: e.id, name: e.name.trim(), ...(e.beschreibung.trim() ? { beschreibung: e.beschreibung.trim() } : {}), kriterien });
    setMeldung(`„${e.name.trim()}“ gespeichert.`);
    setEntwurf({ ...e, name: e.name.trim(), beschreibung: e.beschreibung.trim(), kriterien, neu: false });
  };
  const gespeichert = (e: Entwurf) => { const s = segmente.find(x => x.id === e.id); return !!s && s.name === e.name.trim() && (s.beschreibung ?? '') === e.beschreibung.trim() && kriterienGleich(s.kriterien, e.kriterien); };
  const csv = (id: string) => { window.location.href = `/api/crm/marketing?segment=${encodeURIComponent(id)}&format=csv`; };

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={() => setEntwurf({ id: neueId('sg'), name: '', beschreibung: '', kriterien: {}, neu: true })}>+ Segment</Knopf>}>Segmente · {segmente.length}</Ueberschrift>
        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>{meldung}</div>}
        {entwurf?.neu && vorschau && <SegmentFormular e={entwurf} setE={setEntwurf} a={vorschau} speichern={speichern} gespeichert={false} csv={csv} zuKontakt={zuKontakt} />}
        <Liste>
          {segmente.map(s => {
            const a = zahlen.get(s.id);
            return (
              <div key={s.id}>
                <Zeile onClick={() => oeffne(s)} aktiv={entwurf?.id === s.id} titel={s.name} unter={s.beschreibung || kriterienText(s.kriterien)}
                  rechts={<Chip farbe={a?.anzahl ? LEUCHT.business : C.inkDim}>{a?.anzahl ?? 0} Personen</Chip>} />
                {entwurf?.id === s.id && !entwurf.neu && vorschau && (
                  <SegmentFormular e={entwurf} setE={setEntwurf} a={vorschau} speichern={speichern} gespeichert={gespeichert(entwurf)} csv={csv} zuKontakt={zuKontakt}
                    loeschen={async () => { if (!window.confirm(`Segment „${s.name}“ löschen? Die Personen bleiben unberührt.`)) return; await api.weg('segmente', s.id); setEntwurf(null); setMeldung(`„${s.name}“ gelöscht.`); }}
                    kampagne={() => zuKampagne(s.id)} />
                )}
                {entwurf?.id !== s.id && a && <div style={{ padding: '2px 0 10px' }}><KanalZahlen a={a} /></div>}
              </div>
            );
          })}
        </Liste>
        {!segmente.length && !entwurf && <Leer>Noch kein Segment. Ein Segment ist ein gespeicherter Filter über die Kartei — für Einladungen, Beiträge und Kampagnen. Unten liegen drei Vorlagen.</Leer>}
      </Karte>

      {vorlagen.length > 0 && (
        <Karte i={1}>
          <Ueberschrift>Vorlagen</Ueberschrift>
          <Liste>
            {vorlagen.map(({ v, anzahl }) => {
              return (
                <Zeile key={v.name} titel={v.name} unter={`${kriterienText(v.kriterien)} · heute ${anzahl} Personen`}
                  rechts={<Knopf leise onClick={async () => { const s = vorlageAlsSegment(v, neueId('sg'), new Date().toISOString()); await api.setze('segmente', s as unknown as { id: string } & Record<string, unknown>); setMeldung(`Vorlage „${v.name}“ übernommen.`); }}>Vorlage übernehmen</Knopf>} />
              );
            })}
          </Liste>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Angelegt wird erst mit dem Klick — danach frei änderbar.</div>
        </Karte>
      )}
    </>
  );
}

function SegmentFormular({ e, setE, a, speichern, gespeichert, csv, zuKontakt, loeschen, kampagne }: {
  e: Entwurf; setE: (e: Entwurf | null) => void; a: SegmentAuswertung; speichern: (e: Entwurf) => Promise<void>; gespeichert: boolean;
  csv: (id: string) => void; zuKontakt: (id: string) => void; loeschen?: () => void; kampagne?: () => void;
}) {
  const kr = e.kriterien;
  /** Leere Kriterien fallen weg — dann filtern sie auch nicht. */
  const setK = (x: Partial<SegmentKriterien>) => {
    const neu: Record<string, unknown> = { ...kr, ...x };
    for (const [f, v] of Object.entries(neu)) if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete neu[f];
    setE({ ...e, kriterien: neu as SegmentKriterien });
  };
  const text = (f: 'branche' | 'stadt' | 'stichwort', platzhalter: string) => (
    <input value={kr[f] ?? ''} maxLength={80} placeholder={platzhalter} aria-label={platzhalter} onChange={x => setK({ [f]: x.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
  );
  const mitglieder: Kontakt[] = a.mitglieder.slice(0, 30);
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', margin: '6px 0 12px' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={e.name} maxLength={120} placeholder="Name des Segments*" aria-label="Name des Segments" onChange={x => setE({ ...e, name: x.target.value })} style={{ ...feld, flex: 1, minWidth: 200, fontSize: TYP.bedien, padding: '8px 11px' }} />
        <input value={e.beschreibung} maxLength={400} placeholder="Wofür? (optional)" aria-label="Beschreibung" onChange={x => setE({ ...e, beschreibung: x.target.value })} style={{ ...feld, flex: 2, minWidth: 200, fontSize: TYP.bedien, padding: '8px 11px' }} />
      </div>
      <div>
        <Feldzeile label="Lebensphase"><Mehrfach liste={PHASEN} aktiv={kr.lebensphase ?? []} onWahl={l => setK({ lebensphase: l })} /></Feldzeile>
        <Feldzeile label="Kreis"><Mehrfach liste={KREISE} aktiv={kr.kreis ?? []} onWahl={l => setK({ kreis: l })} /></Feldzeile>
        <Feldzeile label="Prio"><Mehrfach liste={PRIOS} aktiv={kr.prio ?? []} onWahl={l => setK({ prio: l })} /></Feldzeile>
        <Feldzeile label="Firmen-Rolle"><Mehrfach liste={FIRMA_ROLLEN} aktiv={kr.firmaRolle ?? []} onWahl={l => setK({ firmaRolle: l })} /></Feldzeile>
        <Feldzeile label="Herkunft"><Mehrfach liste={HERKUENFTE} aktiv={kr.herkunft ?? []} onWahl={l => setK({ herkunft: l })} /></Feldzeile>
        <Feldzeile label="Branche">{text('branche', 'enthält … (Firma oder Person)')}</Feldzeile>
        <Feldzeile label="Stadt">{text('stadt', 'enthält …')}</Feldzeile>
        <Feldzeile label="Stichwort">{text('stichwort', 'in Name, Firma, Position, Aufhänger, Notiz')}</Feldzeile>
        <Feldzeile label="Kanal zulässig"><Pillen liste={KANAELE} aktiv={kr.kanal ?? ''} onWahl={x => setK({ kanal: x || undefined })} /></Feldzeile>
        <Feldzeile label="Chance"><Pillen liste={CHANCE} aktiv={kr.mitChance === undefined ? 'egal' : kr.mitChance ? 'ja' : 'nein'} onWahl={x => setK({ mitChance: x === 'egal' ? undefined : x === 'ja' })} /></Feldzeile>
        <Feldzeile label="Ohne Kontakt seit">
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={0} max={3650} value={kr.ohneKontaktSeitTagen ?? ''} placeholder="—" aria-label="Tage ohne Kontakt" onChange={x => { const n = Math.round(Number(x.target.value)); setK({ ohneKontaktSeitTagen: n > 0 ? Math.min(n, 3650) : undefined }); }} style={{ ...feld, width: 110, fontSize: TYP.bedien, padding: '8px 11px' }} />
            <span style={{ fontSize: 12.5, color: C.inkLeise }}>Tagen (wer noch nie Kontakt hatte, zählt mit)</span>
          </span>
        </Feldzeile>
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise }}>Gesperrte Personen sind nie Mitglied. Mit „Kanal zulässig“ zählt nur, wer darüber erreichbar sein darf (Ampel grün).</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: TYP.body, fontWeight: 600 }}>{a.anzahl} Personen</b>
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>{kriterienText(kr)}</span>
      </div>
      <KanalZahlen a={a} />
      {mitglieder.length > 0 && (
        <div style={{ display: 'grid', gap: 0 }}>
          {mitglieder.map(k => (
            <button key={k.id} onClick={() => zuKontakt(k.id)} className="fassbar" style={{ textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '6px 0' }}>
              {anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}{k.kreis ? <span style={{ color: C.inkLeise }}> · Kreis {k.kreis}</span> : null}
            </button>
          ))}
          {a.anzahl > mitglieder.length && <div style={{ fontSize: 12, color: C.inkLeise, paddingTop: 6 }}>… und {a.anzahl - mitglieder.length} weitere — alle im Export.</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Knopf aus={!e.name.trim() || gespeichert} onClick={() => { if (e.name.trim()) void speichern(e); }}>{gespeichert ? 'Gespeichert' : 'Speichern'}</Knopf>
        <Knopf leise aus={!gespeichert || !a.anzahl} onClick={() => csv(e.id)}>Als CSV</Knopf>
        {kampagne && <Knopf leise aus={!gespeichert} onClick={kampagne}>Kampagne daraus planen</Knopf>}
        <Knopf leise onClick={() => setE(null)}>Schließen</Knopf>
        {loeschen && <Knopf leise onClick={loeschen}>Löschen</Knopf>}
      </div>
      {!gespeichert && !e.neu && <div style={{ fontSize: 12, color: LEUCHT.achtung }}>Ungespeicherte Änderungen — Export und Kampagne nutzen den gespeicherten Stand.</div>}
      <div style={{ fontSize: 12, color: C.inkLeise }}>Der Export enthält Mail-Adressen nur, wo Werbung per Mail zulässig ist (Einwilligung oder Bestandskunde), und keine Privatnotizen.</div>
    </div>
  );
}

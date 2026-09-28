'use client';

// ─── Zeit & Fokus — Zeit je Mandat (28.09., Kevin: „Mandat an Zielen und Zeit“) ─
// Für Abrechnung und Auslastung: bewusste Business-Zeit je Mandat, Woche oder Monat,
// je Person und gesamt. Hat das Mandat ein Monatshonorar, steht daneben ein grober
// Hinweis „≈ € je Stunde“ (Honorar anteilig auf den Zeitraum ÷ erfasste Stunden) —
// nur ein Hinweis, kein Rechnungsbezug.
//   ZeitJeMandatKarte — die Karte auf der Seite Fokus (neben „Zeit je Einheit“)
//   MandatZeitMonat   — eine Zeile „Zeit diesen Monat“ in der Mandatsakte
// Rechnung: lib/zeitmessung/mandate.ts über /api/state/zeit/mandate (nur im Haushalt des Inhabers).

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { zeitText } from '@/lib/zeitmessung/modell';
import { ZEITRAUM_LABEL, type Zeitraum } from '@/lib/zeitmessung/einheiten';
import { MANDAT_OHNE, type MandatAuswertung, type MandatZeile, type ZeitJeMandat } from '@/lib/zeitmessung/mandate';
import { tagPlus } from '@/lib/kalender/zeit';
import { einheitFarbe, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { WEG } from '@/lib/wege';
import { Karte, Ueberschrift, Leer, Segmente, Fortschritt } from '../schlank';
import { ZEIT_EREIGNIS } from '../Kopf';

export type ZeitJeMandatAntwort = ZeitJeMandat & { ok: boolean; ich: string };
export const zeitMandateAdresse = (zeitraum: Zeitraum, stichtag?: string) =>
  `/api/state/zeit/mandate?zeitraum=${zeitraum}${stichtag ? `&stichtag=${stichtag}` : ''}`;

const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const satzTitel = (z: MandatZeile) =>
  z.honorarZeitraum ? `Grob: ${euro(z.honorarZeitraum)} Honorar anteilig im Zeitraum ÷ ${zeitText(z.sek)} erfasste Zeit — nur ein Hinweis, kein Rechnungsbezug.` : undefined;

/** Holen mit kurzem Merker im Fenster (die Mandatsakte zeigt mehrere Mandate nacheinander). */
const merker = new Map<string, { t: number; d: ZeitJeMandatAntwort | null }>();
async function holen(url: string, frisch = false): Promise<ZeitJeMandatAntwort | null> {
  const m = merker.get(url);
  if (!frisch && m && Date.now() - m.t < 60_000) return m.d;
  const d = await fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => (x?.ok ? (x as ZeitJeMandatAntwort) : null)).catch(() => null);
  merker.set(url, { t: Date.now(), d });
  return d;
}

/** Die Zeilen je Mandat: Name (Link zum Mandat), Balken, Zeit, grober Satz. */
export function MandatBalken({ a }: { a: MandatAuswertung }) {
  const max = Math.max(1, ...a.zeilen.map(z => z.sek));
  if (!a.sek) return <Leer>Noch keine Fokus-Blöcke im Business in diesem Zeitraum — oben „Fokus“ starten und einem Mandat zuordnen.</Leer>;
  const zeilen = a.zeilen.filter(z => z.sek > 0);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {zeilen.map(z => {
        const farbe = z.art === 'ohne' ? EINHEIT_GRAU : z.einheit ? einheitFarbe(z.einheit) : LEUCHT.business;
        const anteil = Math.round((z.sek / a.sek) * 100);
        return (
          <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'center' }}>
            <span style={{ fontSize: TYP.bedien, color: z.art === 'ohne' ? C.inkDim : C.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {z.art === 'mandat' ? <Link href={WEG.mandat(z.id)} style={{ color: 'inherit', textDecoration: 'none' }}>{z.label}</Link> : z.label}
              <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {anteil} %{z.einheit ? ` · ${z.einheit}` : ''} · {z.bloecke} {z.bloecke === 1 ? 'Block' : 'Blöcke'}</span>
            </span>
            <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', color: C.ink, textAlign: 'right' }}>
              {zeitText(z.sek)}
              {z.euroJeStunde ? <span title={satzTitel(z)} style={{ display: 'block', fontSize: 11.5, color: C.inkLeise }}>≈ {euro(z.euroJeStunde)}/h</span> : null}
            </span>
            <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={z.sek / max} farbe={farbe} /></div>
          </div>
        );
      })}
    </div>
  );
}

const pfeil = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 16, padding: '2px 8px', borderRadius: 8 } as const;

/** Karte „Zeit je Mandat“: Woche/Monat, blättern, je Person und gesamt. */
export function ZeitJeMandatKarte({ i = 0 }: { i?: number }) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('monat');
  const [stichtag, setStichtag] = useState<string | undefined>(undefined);
  const [wer, setWer] = useState<string>('gesamt');
  const [d, setD] = useState<ZeitJeMandatAntwort | null | undefined>(undefined);
  const laden = useCallback((frisch = false) => { void holen(zeitMandateAdresse(zeitraum, stichtag), frisch).then(setD); }, [zeitraum, stichtag]);
  useEffect(() => {
    laden();
    const auf = () => laden(true);
    window.addEventListener(ZEIT_EREIGNIS, auf);
    return () => window.removeEventListener(ZEIT_EREIGNIS, auf);
  }, [laden]);
  const mehrere = (d?.personen.length ?? 0) > 1;
  const a = !d ? null : wer === 'gesamt' || !mehrere ? (mehrere ? d.gesamt : d.personen[0]?.auswertung ?? d.gesamt) : d.personen.find(p => p.person === wer)?.auswertung ?? d.gesamt;
  const blaettern = (n: -1 | 1) => d && setStichtag(n < 0 ? tagPlus(d.von, -1) : tagPlus(d.bis, 1));
  const anteilMandat = a?.sek ? Math.round((a.mitMandatSek / a.sek) * 100) : 0;
  return (
    <Karte i={i} akzent={a?.mitMandatSek ? LEUCHT.business : undefined}>
      <Ueberschrift farbe={LEUCHT.business} rechts={a ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{zeitText(a.mitMandatSek)} in Mandaten</span> : undefined}>Zeit je Mandat</Ueberschrift>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <Segmente<Zeitraum> liste={(['woche', 'monat'] as const).map(id => ({ id, label: ZEITRAUM_LABEL[id] }))} aktiv={zeitraum} onWahl={z => { setZeitraum(z); setStichtag(undefined); }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: TYP.bedien, color: C.inkDim }}>
          <button onClick={() => blaettern(-1)} aria-label={`${ZEITRAUM_LABEL[zeitraum]} davor`} className="fassbar" style={pfeil}>‹</button>
          <span style={{ minWidth: 104, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{d?.label ?? '…'}</span>
          <button onClick={() => blaettern(1)} aria-label={`${ZEITRAUM_LABEL[zeitraum]} danach`} className="fassbar" style={pfeil}>›</button>
          {stichtag && <button onClick={() => setStichtag(undefined)} className="fassbar" style={{ ...pfeil, fontSize: 12, textDecoration: 'underline' }}>jetzt</button>}
        </span>
        {mehrere && d && (
          <Segmente<string> liste={[{ id: 'gesamt', label: 'Gesamt' }, ...d.personen.map(p => ({ id: p.person, label: p.name }))]} aktiv={wer} onWahl={setWer} />
        )}
      </div>
      {d === undefined ? <Leer>lade …</Leer> : !a ? <Leer>Die Zeit je Mandat ist gerade nicht erreichbar (nur im Haushalt des Inhabers).</Leer> : <MandatBalken a={a} />}
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 12 }}>
        {a?.sek ? `${anteilMandat} % der bewussten Business-Zeit sind einem Mandat zugeordnet. ` : ''}
        Zuordnen im Kopf beim laufenden Fokus oder unter „Fokus-Blöcke“. „≈ €/h“ ist nur ein grober Hinweis aus dem Monatshonorar — kein Rechnungsbezug.
      </div>
    </Karte>
  );
}

/** „Zeit diesen Monat“ in der Mandatsakte: Stunden, Blöcke und der grobe Satz. */
export function MandatZeitMonat({ mandatId }: { mandatId: string }) {
  const [d, setD] = useState<ZeitJeMandatAntwort | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    const laden = (frisch = false) => void holen(zeitMandateAdresse('monat'), frisch).then(x => { if (aktiv) setD(x); });
    laden();
    const auf = () => laden(true);
    window.addEventListener(ZEIT_EREIGNIS, auf);
    return () => { aktiv = false; window.removeEventListener(ZEIT_EREIGNIS, auf); };
  }, []);
  if (d === undefined) return <span style={{ fontSize: 12.5, color: C.inkLeise }}>lade …</span>;
  if (!d) return <span style={{ fontSize: 12.5, color: C.inkLeise }}>nicht erreichbar</span>;
  const z = d.gesamt.zeilen.find(x => x.id === mandatId && x.id !== MANDAT_OHNE);
  if (!z) return <span style={{ fontSize: 12.5, color: C.inkLeise }}>{d.label}: noch keine Fokus-Zeit — im Kopf „Fokus“ starten und dieses Mandat zuordnen.</span>;
  const jePerson = d.personen.length > 1 ? d.personen.map(p => ({ name: p.name, sek: p.auswertung.zeilen.find(x => x.id === mandatId)?.sek ?? 0 })).filter(p => p.sek > 0) : [];
  return (
    <span style={{ fontSize: 12.5, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
      <b style={{ color: C.ink }}>{zeitText(z.sek)}</b> im {d.label} · {z.bloecke} {z.bloecke === 1 ? 'Block' : 'Blöcke'}
      {jePerson.length > 0 && ` · ${jePerson.map(p => `${p.name} ${zeitText(p.sek)}`).join(' · ')}`}
      {z.euroJeStunde ? <span title={satzTitel(z)} style={{ color: C.inkLeise }}> · ≈ {euro(z.euroJeStunde)}/h (grob)</span> : null}
    </span>
  );
}

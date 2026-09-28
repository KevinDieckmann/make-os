'use client';

// ─── Zeit & Fokus — Zeit je Einheit und die Fokus-Blöcke (27.09. spät) ──────
// Kevin: „Fokus-Blöcke einer Aufgabe zuordnen, damit wir die Zeit je Einheit
// sehen (Selbstständigkeit · KD Ventures · MAKE OS UG).“
//   EinheitBalken       — die Zeilen: Einheit, Balken, Zeit, Top-Aufgaben (auch im Widget `zeit`)
//   ZeitJeEinheitKarte  — Woche/Monat, blättern, je Person und gesamt (Seite Fokus)
//   FokusBloeckeKarte   — die eigenen Blöcke der letzten 7 Tage: Business zuordnen, Privat ins Business umbuchen
// Rechnung: lib/zeitmessung/einheiten.ts über /api/state/zeit/einheiten (gemerkt je Haushalt).

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { zeitText, teile, type ZeitBild, type FokusBlock } from '@/lib/zeitmessung/modell';
import { bereichLabel } from '@/lib/zeitmessung/kennzahlen';
import { ZEITRAUM_LABEL, type EinheitAuswertung, type ZeitJeEinheit, type Zeitraum } from '@/lib/zeitmessung/einheiten';
import { tagPlus } from '@/lib/kalender/zeit';
import { einheitFarbe, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { Karte, Ueberschrift, Leer, Segmente, Fortschritt } from '../schlank';
import { ZEIT_EREIGNIS } from '../Kopf';
import { ZuordnungWahl, type Zuordnung } from './Zuordnung';

export type ZeitJeEinheitAntwort = ZeitJeEinheit & { ok: boolean; ich: string };
export const zeitEinheitenAdresse = (zeitraum: Zeitraum, stichtag?: string) =>
  `/api/state/zeit/einheiten?zeitraum=${zeitraum}${stichtag ? `&stichtag=${stichtag}` : ''}`;

/** Die Zeilen je Einheit. `kompakt`: ohne Top-Aufgaben und ohne leere Kerneinheiten (Widget). */
export function EinheitBalken({ a, kompakt }: { a: EinheitAuswertung; kompakt?: boolean }) {
  const zeilen = kompakt ? a.zeilen.filter(z => z.sek > 0) : a.zeilen;
  const max = Math.max(1, ...a.zeilen.map(z => z.sek));
  if (!a.sek) return <Leer>Noch keine Fokus-Blöcke im Business in diesem Zeitraum — oben „Fokus“ starten und einer Aufgabe zuordnen.</Leer>;
  return (
    <div style={{ display: 'grid', gap: kompakt ? 8 : 12 }}>
      {zeilen.map(z => {
        const farbe = z.art === 'ohne' ? EINHEIT_GRAU : einheitFarbe(z.label);
        const anteil = a.sek ? Math.round((z.sek / a.sek) * 100) : 0;
        return (
          <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', alignItems: 'center' }}>
            <span style={{ fontSize: TYP.bedien, color: z.sek ? C.ink : C.inkLeise, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {z.label}{z.sek > 0 && <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {anteil} %{!kompakt && ` · ${z.bloecke} ${z.bloecke === 1 ? 'Block' : 'Blöcke'}`}</span>}
            </span>
            <span style={{ fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', color: z.sek ? C.ink : C.inkLeise }}>{zeitText(z.sek)}</span>
            <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={z.sek / max} farbe={farbe} /></div>
            {!kompakt && (z.aufgaben.length > 0 || z.ohneAufgabeSek > 0) && (
              <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 2, paddingLeft: 10, borderLeft: `2px solid ${farbe}33` }}>
                {z.aufgaben.map(t => (
                  <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.inkDim }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titel}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkLeise }}>{zeitText(t.sek)}</span>
                  </div>
                ))}
                {z.ohneAufgabeSek > 0 && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.inkLeise }}>
                    <span style={{ flex: 1 }}>ohne Aufgabe</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{zeitText(z.ohneAufgabeSek)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const pfeil = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 16, padding: '2px 8px', borderRadius: 8 } as const;

/** Karte „Zeit je Einheit“: Woche/Monat, blättern, je Person und gesamt. */
export function ZeitJeEinheitKarte({ i = 0 }: { i?: number }) {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('woche');
  const [stichtag, setStichtag] = useState<string | undefined>(undefined);
  const [wer, setWer] = useState<string>('gesamt');
  const [d, setD] = useState<ZeitJeEinheitAntwort | null | undefined>(undefined);
  const laden = useCallback(() => {
    fetch(zeitEinheitenAdresse(zeitraum, stichtag), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(x => setD(x?.ok ? (x as ZeitJeEinheitAntwort) : null)).catch(() => setD(null));
  }, [zeitraum, stichtag]);
  useEffect(() => {
    laden();
    window.addEventListener(ZEIT_EREIGNIS, laden);
    return () => window.removeEventListener(ZEIT_EREIGNIS, laden);
  }, [laden]);
  const mehrere = (d?.personen.length ?? 0) > 1;
  const a = !d ? null : wer === 'gesamt' || !mehrere ? (mehrere ? d.gesamt : d.personen[0]?.auswertung ?? d.gesamt) : d.personen.find(p => p.person === wer)?.auswertung ?? d.gesamt;
  const blaettern = (n: -1 | 1) => d && setStichtag(n < 0 ? tagPlus(d.von, -1) : tagPlus(d.bis, 1));
  return (
    <Karte i={i} akzent={a?.sek ? LEUCHT.business : undefined}>
      <Ueberschrift farbe={LEUCHT.business} rechts={a ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{zeitText(a.sek)} bewusst</span> : undefined}>Zeit je Einheit</Ueberschrift>
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
      {d === undefined ? <Leer>lade …</Leer> : !a ? <Leer>Die Zeit je Einheit ist gerade nicht erreichbar.</Leer> : <EinheitBalken a={a} />}
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 12 }}>Gezählt werden bewusste Fokus-Blöcke im Business. Die Einheit kommt aus der zugeordneten Aufgabe, sonst aus der Wahl am Block.</div>
    </Karte>
  );
}

const wann = (b: FokusBlock) => {
  const v = new Date(b.von);
  return `${v.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })} · ${v.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Die eigenen Blöcke der letzten 7 Tage: Business-Blöcke nachträglich einer Aufgabe oder Einheit zuordnen; darunter
 * abgesetzt die eigenen Privat-Blöcke mit „ins Business“ (Kevin 27.09. spät) — Rückweg „nach Privat“ verwirft die
 * Zuordnung. Das Bild von /api/state/zeit ist immer nur das eigene; die andere Person sieht man hier nie.
 */
export function FokusBloeckeKarte({ i = 0 }: { i?: number }) {
  const [bild, setBild] = useState<ZeitBild | null | undefined>(undefined);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  useEffect(() => {
    const laden = () => fetch('/api/state/zeit', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => setBild(x?.bild ?? null)).catch(() => setBild(null));
    void laden();
    window.addEventListener(ZEIT_EREIGNIS, laden);
    return () => window.removeEventListener(ZEIT_EREIGNIS, laden);
  }, []);
  const senden = async (koerper: Record<string, unknown>) => {
    setFehler(null);
    try {
      const r = await fetch('/api/state/zeit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(koerper) });
      const x = await r.json().catch(() => null);
      if (!r.ok || !x?.ok) setFehler(x?.error ?? 'Nicht gespeichert.');
      if (x?.bild) setBild(x.bild as ZeitBild);
    } catch { setFehler('Nicht erreichbar — nicht gespeichert.'); }
    window.dispatchEvent(new Event(ZEIT_EREIGNIS));
  };
  const zuordnen = (b: FokusBlock, z: Zuordnung) => {
    // Sofort zeigen, dann den gesäuberten Stand des Servers übernehmen.
    setBild(alt => alt && { ...alt, bloecke: alt.bloecke.map(x => (x.von === b.von ? { ...x, aufgabeId: z.aufgabeId, einheit: z.einheit, mandatId: z.mandatId } : x)) });
    return senden({ aktion: 'zuordnen', von: b.von, ...z });
  };
  const umbuchen = async (b: FokusBlock, space: 'privat' | 'business') => {
    setLaeuft(b.von);
    await senden({ aktion: 'umbuchen', von: b.von, space });
    setLaeuft(null);
  };
  const alle = bild?.bloecke ?? [];
  const business = alle.filter(b => teile(b.schluessel).space === 'business');
  const privat = alle.filter(b => teile(b.schluessel).space !== 'business');
  const offen = business.filter(b => !b.aufgabeId && !b.einheit && !b.mandatId).length;
  const kopf = (b: FokusBlock) => (
    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
      <div style={{ fontSize: TYP.bedien, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{zeitText(b.sek)} <span style={{ color: C.inkLeise }}>· {b.label || bereichLabel(teile(b.schluessel).bereich)}</span></div>
      <div style={{ fontSize: 12, color: C.inkLeise }}>{wann(b)}</div>
    </div>
  );
  const zeile: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' };
  const leise: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: '2px 4px', textDecoration: 'underline' };
  return (
    <Karte i={i}>
      <Ueberschrift rechts={business.length ? `${offen} ohne Zuordnung` : undefined}>Fokus-Blöcke</Ueberschrift>
      {bild === undefined ? <Leer>lade …</Leer>
        : !alle.length ? <Leer>In den letzten 7 Tagen keine Fokus-Blöcke. Oben „Fokus“ starten — oder aus einer Aufgabe heraus.</Leer>
          : (
            <>
              {!business.length && <Leer>Keine Business-Blöcke in den letzten 7 Tagen.</Leer>}
              <div style={{ display: 'grid' }}>
                {business.map(b => (
                  <div key={b.von} style={zeile}>
                    {kopf(b)}
                    <ZuordnungWahl klein wert={{ aufgabeId: b.aufgabeId, einheit: b.einheit, mandatId: b.mandatId }} setzen={z => void zuordnen(b, z)} />
                    <button onClick={() => void umbuchen(b, 'privat')} disabled={laeuft === b.von} title="Zurück nach Privat — Aufgabe und Einheit fallen weg" className="fassbar" style={leise}>nach Privat</button>
                  </div>
                ))}
              </div>
              {privat.length > 0 && (
                <div style={{ marginTop: 14, padding: '6px 12px', borderRadius: 12, background: 'rgba(255,255,255,.025)' }}>
                  <div style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, padding: '6px 0 2px' }}>Privat · nur deine</div>
                  {privat.map(b => (
                    <div key={b.von} style={{ ...zeile, opacity: 0.85 }}>
                      {kopf(b)}
                      <button onClick={() => void umbuchen(b, 'business')} disabled={laeuft === b.von} title="Ins Business umbuchen — danach Aufgabe oder Einheit zuordnen" className="fassbar"
                        style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${LEUCHT.business}66`, background: `${LEUCHT.business}14`, color: LEUCHT.business }}>
                        {laeuft === b.von ? '…' : 'ins Business'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
      {fehler && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 8 }}>{fehler}</div>}
    </Karte>
  );
}

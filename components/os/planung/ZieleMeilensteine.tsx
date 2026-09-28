'use client';

// ─── MAKE OS — Ziele links, Meilensteine rechts ─────────────────────────────
// Malins Rückmeldung (27.09.): zwei Spalten (am Handy untereinander), „+ neu“
// oben in beiden, offene nach Priorität (Pfeil ▲▼), Erledigtes rutscht in
// einen eigenen Bereich unten in derselben Karte (3–4 sichtbar, Rest scrollt).
// Im Business tragen Ziele und Meilensteine eine Einheit (Filter-Pillen oben,
// „+ neu“ in der Wahl). Gilt für Tag · Woche · Monat · Quartal · Jahr gleich —
// die Seite reicht nur den Horizont; Laden und Schreiben macht usePlanung.
// Abgeleitetes (Kaskade aus dem Jahresziel) ist markiert, lässt sich lösen
// („angepasst“) und erst dann löschen — sonst käme es beim nächsten Rechnen wieder.
// Seit 28.09. („Mandat an Zielen und Zeit“): im Business ein Mandat-Chip beim Anlegen
// und am Eintrag (aktive Mandate, „Firma · Mandatstitel“) — Firma und Einheit kommen
// dann aus dem Mandat (der Server leitet sie beim Speichern ab, lib/planung/mandat.ts).

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_LABEL, SPACE_FARBE, type SpaceId } from '@/lib/make-one/space-regeln';
import { passtEinheit } from '@/lib/planung/einheiten';
import { meilensteinSpace, bereichAusSpace } from '@/lib/planung/meilensteine';
import { offenErledigt, verschiebe, naechsterRang } from '@/lib/planung/rang';
import { imZeitraum } from '@/lib/planung/zeitraum';
import type { Meilenstein, Ziel, ZielHorizont } from '@/lib/planung/typen';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Haken, feld, LEUCHT } from '../schlank';
import { zielRahmen } from '../ziel';
import { PfeilRang } from './PfeilRang';
import { usePlanung, type PlanungStand } from './usePlanung';
import { MandatWahl, useMandate } from '../zeit/MandatWahl';
import type { MandatKurz } from '@/lib/planung/mandat';

type SpaceFilter = SpaceId | 'alle';
const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const prozent: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right', flex: '0 0 auto' };
const loeschen: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' };
const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const pille = (an: boolean, farbe: string): CSSProperties => ({ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim });
const HORIZONT_WORT: Record<ZielHorizont, string> = { tag: 'Tages', woche: 'Wochen', monat: 'Monats', quartal: 'Quartals', jahr: 'Jahres' };
const NEU_EINHEIT = '__neu__';
/** Vier Zeilen sichtbar, der Rest scrollt (Zeile ≈ 50 px). */
const ERLEDIGT_HOEHE = 4 * 50 + 8;
const dtKurz = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;

export interface ZieleMeilensteineProps {
  horizont: ZielHorizont;
  /** Akzentfarbe des Horizonts. */
  farbe?: string;
  /** Von außen gesteuert (Horizont-Seite) — sonst hält das Bauteil den Space selbst. */
  spaceFilter?: SpaceFilter;
  onSpace?: (s: SpaceFilter) => void;
  /** Der Stand (Ziele, Meilensteine, Fokus) für die Seite drumherum — Forecast, Zeitstrahl. */
  onStand?: (s: PlanungStand) => void;
  /** Aus einem Link (?m=) hervorgehobener Meilenstein. */
  zielM?: string | null;
  /** Karten-Index fürs gestaffelte Erscheinen. */
  i?: number;
  /** Kompakt (Woche/Tag): ohne Space-Wechsel je Zeile, kürzere Texte. */
  kompakt?: boolean;
}

export function ZieleMeilensteine({ horizont, farbe = LEUCHT.schlaf, spaceFilter: spaceProp, onSpace, onStand, zielM, i = 0, kompakt }: ZieleMeilensteineProps) {
  const p = usePlanung(horizont);
  const { space: aktiverSpace, ausAdresse: spaceAusAdresse, setzen: spaceSetzen } = useSpace();
  const [spaceEigen, setSpaceEigen] = useState<SpaceFilter>('alle');
  useEffect(() => { if (!spaceProp) setSpaceEigen(spaceAusAdresse ?? aktiverSpace); }, [spaceProp, spaceAusAdresse, aktiverSpace]);
  const spaceFilter = spaceProp ?? spaceEigen;
  const setSpace = (s: SpaceFilter) => { if (onSpace) onSpace(s); else setSpaceEigen(s); if (s !== 'alle') spaceSetzen(s); };
  const [einheitFilter, setEinheitFilter] = useState<string>('alle');
  const [einheitNeu, setEinheitNeu] = useState<string | null>(null);
  // Nur bei echten Änderungen nach außen melden — sonst dreht sich Eltern-Stand ↔ Kind im Kreis.
  useEffect(() => { onStand?.(p); }, [p.ziele, p.ms, p.fokus, p.geladen]); // eslint-disable-line react-hooks/exhaustive-deps
  const heute = localDay();
  const imBusiness = spaceFilter === 'business';

  // ── Ziele im Filter ──
  const zieleSicht = useMemo(() => p.ziele.filter(z => (spaceFilter === 'alle' || !z.space || z.space === spaceFilter) && (!imBusiness || passtEinheit(z.einheit, einheitFilter))), [p.ziele, spaceFilter, imBusiness, einheitFilter]);
  const { offen: zOffen, erledigt: zErledigt } = useMemo(() => offenErledigt(zieleSicht), [zieleSicht]);

  // ── Meilensteine im Zeitraum und Filter ──
  const msSicht = useMemo(() => p.ms.filter(m => {
    const spaceOk = spaceFilter === 'alle' || meilensteinSpace(m) === spaceFilter;
    const zeitOk = horizont === 'jahr' ? (!m.faellig || m.faellig >= p.zr.von || m.erledigt) : imZeitraum(m.faellig, p.zr);
    return spaceOk && zeitOk && (!imBusiness || passtEinheit(m.einheit, einheitFilter));
  }), [p.ms, spaceFilter, horizont, p.zr, imBusiness, einheitFilter]);
  const { offen: mOffen, erledigt: mErledigt } = useMemo(() => offenErledigt(msSicht), [msSicht]);

  // ── Neu anlegen ──
  const [neu, setNeu] = useState({ titel: '', zahl: '', termin: '', einheit: '', mandatId: '' });
  const [msNeu, setMsNeu] = useState({ titel: '', faellig: '', space: 'business' as SpaceId, einheit: '', mandatId: '' });
  // Mandat an Zielen (28.09.): Chip nur mit Zugang zum CRM (Haushalt des Inhabers) oder wenn schon eins gesetzt ist.
  const { zugang: mandatZugang } = useMandate();
  const msBusiness = spaceFilter === 'business' || (spaceFilter === 'alle' && msNeu.space === 'business');
  /** Ein gewähltes Mandat bringt Firma und Einheit mit (der Server leitet sie beim Speichern noch einmal ab). */
  const mandatFelder = (m: MandatKurz | null) => ({ mandatId: m?.id, firmaId: m?.firmaId, ...(m?.einheit ? { einheit: m.einheit } : {}) });
  useEffect(() => { if (spaceFilter !== 'alle') setMsNeu(m => ({ ...m, space: spaceFilter })); }, [spaceFilter]);

  const einheitWahl = (wert: string, setzen: (v: string) => void, label: string) => (
    <select value={wert} aria-label={label} style={wahl} onChange={async e => {
      if (e.target.value === NEU_EINHEIT) { const n = window.prompt('Neue Einheit (z. B. eine Firma, ein Kunde):'); const s = n ? await p.einheitAnlegen(n) : null; setzen(s ?? ''); return; }
      setzen(e.target.value);
    }}>
      <option value="">Einheit …</option>
      {p.einheiten.map(e => <option key={e} value={e}>{e}</option>)}
      <option value={NEU_EINHEIT}>+ neue Einheit</option>
    </select>
  );

  const zielAnlegen = () => {
    const t = neu.titel.trim();
    if (!t) return;
    const zahl = Number(neu.zahl.replace(',', '.'));
    const z: Ziel = {
      id: `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, titel: t, fortschritt: 0, rang: naechsterRang(zOffen),
      ...(spaceFilter !== 'alle' ? { space: spaceFilter } : {}),
      ...(imBusiness && (neu.einheit || (einheitFilter !== 'alle' ? einheitFilter : '')) ? { einheit: neu.einheit || einheitFilter } : {}),
      ...(imBusiness && neu.mandatId ? { mandatId: neu.mandatId } : {}),
      ...(horizont === 'jahr' && isFinite(zahl) && zahl > 0 ? { zielwert: zahl } : {}),
      ...(horizont === 'jahr' && neu.termin ? { termin: neu.termin } : {}),
    };
    p.persistZiele([...p.ziele, z]);
    setNeu({ titel: '', zahl: '', termin: '', einheit: neu.einheit, mandatId: neu.mandatId });
  };
  const msAnlegen = () => {
    const t = msNeu.titel.trim();
    if (!t) return;
    const faellig = msNeu.faellig || (horizont === 'jahr' ? '' : p.zr.bis);
    // Seit 28.09. das echte Feld `space`; `bereich` nur gespiegelt für ältere Leser.
    const space: SpaceId = spaceFilter !== 'alle' ? spaceFilter : msNeu.space;
    const einheit = space === 'business' && imBusiness ? (msNeu.einheit || (einheitFilter !== 'alle' ? einheitFilter : '')) : '';
    const mandatId = space === 'business' ? msNeu.mandatId : '';
    p.persistMs([...p.ms, { id: `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, titel: t, space, bereich: bereichAusSpace(space), faellig: faellig || undefined, fortschritt: 0, erledigt: false, rang: naechsterRang(mOffen), ...(einheit ? { einheit } : {}), ...(mandatId ? { mandatId } : {}) }]);
    setMsNeu({ titel: '', faellig: '', space, einheit: msNeu.einheit, mandatId: msNeu.mandatId });
  };

  // ── Ändern ──
  const zPatch = (id: string, patch: Partial<Ziel>, angepasst = false) => p.persistZiele(p.ziele.map(z => (z.id === id ? { ...z, ...patch, ...(angepasst && z.abgeleitetVon ? { angepasst: true } : {}) } : z)));
  const zErledigen = (z: Ziel) => zPatch(z.id, z.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 });
  const zLoeschen = (id: string) => p.persistZiele(p.ziele.filter(z => z.id !== id));
  const zBewegen = (id: string, r: 'auf' | 'ab') => p.persistZiele(verschiebe(p.ziele, id, r, zOffen.map(z => z.id)));
  const mPatch = (id: string, patch: Partial<Meilenstein>, angepasst = false) => p.persistMs(p.ms.map(m => (m.id === id ? { ...m, ...patch, ...(angepasst && m.abgeleitetVon ? { angepasst: true } : {}) } : m)));
  const mErledigen = (m: Meilenstein) => mPatch(m.id, m.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 }, true);
  const mLoeschen = (id: string) => p.persistMs(p.ms.filter(m => m.id !== id));
  const mBewegen = (id: string, r: 'auf' | 'ab') => p.persistMs(verschiebe(p.ms, id, r, mOffen.map(m => m.id)));

  // ── Titel bearbeiten (Stift) ──
  const [bearbeite, setBearbeite] = useState<{ id: string; text: string } | null>(null);
  const titelFeld = (id: string, fertig: (text: string) => void) => (
    <input autoFocus value={bearbeite?.text ?? ''} aria-label="Titel bearbeiten"
      onChange={e => setBearbeite({ id, text: e.target.value })}
      onBlur={() => { if (bearbeite?.text.trim()) fertig(bearbeite.text.trim()); setBearbeite(null); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setBearbeite(null); }}
      style={{ ...feld, padding: '4px 8px', fontSize: TYP.body, fontWeight: 600 }} />
  );

  const herkunft = (e: { abgeleitetVon?: string; angepasst?: boolean }, was: string): ReactNode =>
    e.abgeleitetVon ? <span style={{ color: e.angepasst ? LEUCHT.achtung : LEUCHT.agenten }}>{e.angepasst ? 'angepasst' : `abgeleitet aus ${was}`}</span> : null;
  const einheitChip = (e: { einheit?: string; space?: SpaceId }) => (e.einheit && e.space === 'business' && !(imBusiness && einheitFilter !== 'alle') ? <Chip farbe={SPACE_FARBE.business}>{e.einheit}</Chip> : null);
  /** Mandat am Eintrag (nur Business): gesetzt als Chip, sonst „+ Mandat“ (nicht im kompakten Modus, nicht bei Erledigtem). */
  const mandatChip = (e: { mandatId?: string; erledigt?: boolean }, business: boolean, setzen: (m: MandatKurz | null) => void) => {
    if (!business || (!e.mandatId && (!mandatZugang || kompakt || e.erledigt))) return null;
    return <MandatWahl klein wert={e.mandatId} aus={!!e.erledigt} setzen={setzen} />;
  };
  const unterZeile = (teile: ReactNode[]) => { const t = teile.filter(Boolean); return t.length ? <>{t.map((x, k) => <span key={k}>{k > 0 ? ' · ' : ''}{x}</span>)}</> : undefined; };

  // ── Zeilen ──
  const zielZeile = (z: Ziel, pos: number, n: number) => {
    const v = z.erledigt ? 100 : z.fortschritt;
    const f = z.space ? SPACE_FARBE[z.space] : farbe;
    return (
      <Zeile key={z.id}
        links={<Haken an={!!z.erledigt} farbe={f} onChange={() => zErledigen(z)} />}
        titel={bearbeite?.id === z.id ? titelFeld(z.id, t => zPatch(z.id, { titel: t }, true)) : <span style={{ fontWeight: 600, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none' }}>{z.titel}</span>}
        unter={unterZeile([
          einheitChip(z),
          mandatChip(z, z.space === 'business', m => zPatch(z.id, mandatFelder(m), true)),
          spaceFilter === 'alle' && z.space ? <span style={{ color: SPACE_FARBE[z.space] }}>{SPACE_LABEL[z.space]}</span> : null,
          z.termin ? `bis ${dtKurz(z.termin)}` : null,
          horizont === 'jahr' && z.zielwert ? `Ziel ${z.zielwert}` : null,
          herkunft(z, 'Jahresziel'),
          z.erledigt && z.erledigtAm ? `erledigt ${dtKurz(z.erledigtAm)}` : null,
        ])}
        rechts={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', opacity: z.erledigt ? 0.7 : 1 }}>
            {!z.erledigt && !kompakt && spaceFilter === 'alle' && (
              <button onClick={() => zPatch(z.id, { space: z.space === 'privat' ? 'business' : z.space === 'business' ? undefined : 'privat', ...(z.space === 'business' ? { einheit: undefined } : {}) }, true)} title={z.space ? `${SPACE_LABEL[z.space]} — Klick wechselt` : 'gemeinsam — Klick wechselt'}
                style={{ ...pille(!!z.space, z.space ? SPACE_FARBE[z.space] : C.inkLeise), padding: '2px 8px', fontSize: 11 }}>{z.space ? SPACE_LABEL[z.space] : 'gemeinsam'}</button>
            )}
            {!z.erledigt && (
              <>
                <input type="range" min={0} max={100} step={5} value={v} aria-label="Fortschritt" onChange={e => zPatch(z.id, { fortschritt: Number(e.target.value) })} style={{ width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)', accentColor: col(v) }} />
                <span style={{ ...prozent, color: col(v) }}>{v} %</span>
                <PfeilRang label={z.titel} obenAus={pos === 0} untenAus={pos === n - 1} onAuf={() => zBewegen(z.id, 'auf')} onAb={() => zBewegen(z.id, 'ab')} />
                <button onClick={() => setBearbeite({ id: z.id, text: z.titel })} aria-label="Ziel umbenennen" title="umbenennen" style={loeschen}>✎</button>
              </>
            )}
            {z.abgeleitetVon && !z.angepasst
              ? <button onClick={() => zPatch(z.id, { angepasst: true })} aria-label="Vom Jahresziel lösen" title="Vom Jahresziel lösen — wird ein eigenes Ziel" style={{ ...loeschen, fontSize: 11, color: LEUCHT.agenten }}>lösen</button>
              : <button onClick={() => zLoeschen(z.id)} aria-label="Ziel löschen" style={loeschen}>✕</button>}
          </span>
        } />
    );
  };

  const msZeile = (m: Meilenstein, pos: number, n: number) => {
    const sp = meilensteinSpace(m);
    const bf = sp === 'privat' ? LEUCHT.gut : LEUCHT.business;
    const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;
    const wann = m.faellig ? dtKurz(m.faellig) : (m.zeitfenster ?? '');
    return (
      <div key={m.id} id={`ziel-${m.id}`} style={zielRahmen(zielM === m.id, bf)}>
        <Zeile
          links={<Haken an={m.erledigt} farbe={bf} onChange={() => mErledigen(m)} />}
          titel={bearbeite?.id === m.id ? titelFeld(m.id, t => mPatch(m.id, { titel: t }, true)) : <span style={{ color: m.erledigt ? C.inkLeise : C.ink, textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.titel}</span>}
          unter={unterZeile([
            wann ? <span style={{ color: spaet ? LEUCHT.kritisch : undefined }}>{spaet ? 'überfällig ' : ''}{wann}</span> : null,
            einheitChip({ einheit: m.einheit, space: sp }),
            mandatChip(m, sp === 'business', x => mPatch(m.id, mandatFelder(x), true)),
            spaceFilter === 'alle' && (kompakt || m.erledigt) ? <span style={{ color: bf }}>{SPACE_LABEL[sp]}</span> : null,
            m.messlatte ? `Messlatte: ${m.messlatte}` : null,
            herkunft(m, 'Jahresziel'),
            m.erledigt && m.erledigtAm ? `erledigt ${dtKurz(m.erledigtAm)}` : null,
          ])}
          rechts={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', opacity: m.erledigt ? 0.7 : 1 }}>
              {!m.erledigt && !kompakt && spaceFilter === 'alle' && (
                <button onClick={() => { const neu: SpaceId = sp === 'privat' ? 'business' : 'privat'; mPatch(m.id, { space: neu, bereich: bereichAusSpace(neu), ...(neu === 'privat' ? { einheit: undefined } : {}) }, true); }} title={`${SPACE_LABEL[sp]} — Klick wechselt`}
                  style={{ ...pille(true, bf), padding: '2px 8px', fontSize: 11 }}>{SPACE_LABEL[sp]}</button>
              )}
              {!m.erledigt && (
                <>
                  <input type="range" min={0} max={100} step={5} value={m.fortschritt} aria-label="Fortschritt" onChange={e => mPatch(m.id, { fortschritt: Number(e.target.value) })} style={{ width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)', accentColor: col(m.fortschritt) }} />
                  <span style={{ ...prozent, color: col(m.fortschritt) }}>{m.fortschritt} %</span>
                  <PfeilRang label={m.titel} obenAus={pos === 0} untenAus={pos === n - 1} onAuf={() => mBewegen(m.id, 'auf')} onAb={() => mBewegen(m.id, 'ab')} />
                  <button onClick={() => setBearbeite({ id: m.id, text: m.titel })} aria-label="Meilenstein umbenennen" title="umbenennen" style={loeschen}>✎</button>
                </>
              )}
              {m.abgeleitetVon && !m.angepasst
                ? <button onClick={() => mPatch(m.id, { angepasst: true })} aria-label="Vom Jahresziel lösen" title="Vom Jahresziel lösen — wird ein eigener Meilenstein" style={{ ...loeschen, fontSize: 11, color: LEUCHT.agenten }}>lösen</button>
                : <button onClick={() => mLoeschen(m.id)} aria-label="Meilenstein löschen" style={loeschen}>✕</button>}
            </span>
          } />
      </div>
    );
  };

  const erledigtBereich = (liste: ReactNode[], n: number) => (n > 0 ? (
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 2 }}>
        <span>Erledigt</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      </div>
      <div style={{ maxHeight: ERLEDIGT_HOEHE, overflowY: 'auto', paddingRight: 2 }}><Liste>{liste}</Liste></div>
    </div>
  ) : null);

  const zieleAlle = p.ziele.length;
  const spaceHinweis = spaceFilter !== 'alle' ? ` in ${SPACE_LABEL[spaceFilter]}` : '';

  return (
    <>
      {p.hinweis && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{p.hinweis}</div>}
      {/* Filter: Space · Einheiten (Business) */}
      <div className="os-auf" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ['--i' as string]: i }}>
        {(['privat', 'business', 'alle'] as const).map(k => (
          <button key={k} onClick={() => setSpace(k)} className="fassbar" title={k === 'alle' ? 'Privat, Business und Gemeinsames' : `Nur ${SPACE_LABEL[k]} (und Gemeinsames)`} style={pille(spaceFilter === k, k === 'alle' ? C.aktiv : SPACE_FARBE[k])}>{k === 'alle' ? 'Alle' : SPACE_LABEL[k]}</button>
        ))}
        {imBusiness && (
          <>
            <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.1)', margin: '0 4px' }} />
            <button onClick={() => setEinheitFilter('alle')} className="fassbar" style={pille(einheitFilter === 'alle', SPACE_FARBE.business)}>Alle Einheiten</button>
            {p.einheiten.map(e => <button key={e} onClick={() => setEinheitFilter(e)} className="fassbar" style={pille(einheitFilter === e, SPACE_FARBE.business)}>{e}</button>)}
            {einheitNeu === null
              ? <button onClick={() => setEinheitNeu('')} className="fassbar" title="Neue Einheit anlegen" style={{ ...pille(false, SPACE_FARBE.business), borderStyle: 'dashed' }}>+ neu</button>
              : <input autoFocus value={einheitNeu} placeholder="Neue Einheit …" aria-label="Neue Einheit" onChange={e => setEinheitNeu(e.target.value)}
                  onKeyDown={async e => { if (e.key === 'Escape') setEinheitNeu(null); if (e.key === 'Enter') { const s = await p.einheitAnlegen(einheitNeu); if (s) setEinheitFilter(s); setEinheitNeu(null); } }}
                  onBlur={() => setEinheitNeu(null)} style={{ ...feld, width: 180, padding: '5px 10px', fontSize: 12 }} />}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 14, alignItems: 'start' }}>
        {/* Ziele */}
        <Karte i={i + 1} akzent={farbe}>
          <Ueberschrift farbe={farbe} rechts={zOffen.length ? `${zOffen.length} offen` : undefined}>Ziele</Ueberschrift>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') zielAnlegen(); }} aria-label="Neues Ziel"
              placeholder={`+ neues ${HORIZONT_WORT[horizont]}ziel …`} style={{ ...feld, width: 'auto', flex: '1 1 180px', minWidth: 0 }} />
            {horizont === 'jahr' && (
              <>
                <input value={neu.zahl} onChange={e => setNeu({ ...neu, zahl: e.target.value })} inputMode="decimal" aria-label="Zahlenziel" title="Zahlenziel — wird auf Quartal, Monat, Woche, Tag verteilt" placeholder="Zahl" style={{ ...feld, width: 'auto', flex: '0 1 84px', minWidth: 0 }} />
                <input type="date" value={neu.termin} onChange={e => setNeu({ ...neu, termin: e.target.value })} aria-label="Termin" title="Ziel mit Datum — wird Meilenstein im passenden Quartal" style={{ ...feld, width: 'auto', flex: '0 1 150px', colorScheme: 'dark' }} />
              </>
            )}
            {imBusiness && einheitWahl(neu.einheit, v => setNeu({ ...neu, einheit: v }), 'Einheit des Ziels')}
            {imBusiness && mandatZugang && <MandatWahl wert={neu.mandatId || undefined} setzen={m => setNeu({ ...neu, mandatId: m?.id ?? '', einheit: m?.einheit ?? neu.einheit })} />}
            <Knopf onClick={zielAnlegen}>+ Ziel</Knopf>
          </div>
          {!p.geladen ? <Leer>lade …</Leer>
            : !zOffen.length && !zErledigt.length ? <Leer>{zieleAlle ? `Keine Ziele${spaceHinweis}${imBusiness && einheitFilter !== 'alle' ? ` für ${einheitFilter}` : ''}.` : `Noch keine Ziele für ${p.zr.label}${spaceHinweis}. Was soll am Ende stehen?`}</Leer>
            : !zOffen.length ? <Leer>Alles erledigt{spaceHinweis} — was kommt als Nächstes?</Leer>
            : <Liste>{zOffen.map((z, k) => zielZeile(z, k, zOffen.length))}</Liste>}
          {erledigtBereich(zErledigt.map((z, k) => zielZeile(z, k, zErledigt.length)), zErledigt.length)}
        </Karte>

        {/* Meilensteine */}
        <Karte i={i + 2} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={mOffen.length ? `${mOffen.length} offen` : undefined}>Meilensteine</Ueberschrift>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={msNeu.titel} onChange={e => setMsNeu({ ...msNeu, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') msAnlegen(); }} aria-label="Neuer Meilenstein"
              placeholder="+ neuer Meilenstein …" style={{ ...feld, width: 'auto', flex: '1 1 160px', minWidth: 0 }} />
            <input type="date" value={msNeu.faellig} onChange={e => setMsNeu({ ...msNeu, faellig: e.target.value })} aria-label="Fällig am" title={horizont === 'jahr' ? 'Fällig am' : `Fällig am — leer heißt ${dtKurz(p.zr.bis)}`} style={{ ...feld, width: 'auto', flex: '0 1 150px', colorScheme: 'dark' }} />
            {spaceFilter === 'alle' && (
              <select value={msNeu.space} onChange={e => setMsNeu({ ...msNeu, space: e.target.value === 'privat' ? 'privat' : 'business' })} aria-label="Space" style={wahl}>
                <option value="business">{SPACE_LABEL.business}</option>
                <option value="privat">{SPACE_LABEL.privat}</option>
              </select>
            )}
            {imBusiness && einheitWahl(msNeu.einheit, v => setMsNeu({ ...msNeu, einheit: v }), 'Einheit des Meilensteins')}
            {msBusiness && mandatZugang && <MandatWahl wert={msNeu.mandatId || undefined} setzen={m => setMsNeu({ ...msNeu, mandatId: m?.id ?? '', einheit: m?.einheit ?? msNeu.einheit })} />}
            <Knopf onClick={msAnlegen}>+ Meilenstein</Knopf>
          </div>
          {!mOffen.length && !mErledigt.length ? <Leer>Noch kein Meilenstein für {p.zr.label}{spaceHinweis}.{horizont === 'jahr' ? ' Ein Jahresziel mit Termin legt ihn von selbst an.' : ''}</Leer>
            : !mOffen.length ? <Leer>Alle Meilensteine für {p.zr.label} erledigt.</Leer>
            : <Liste>{mOffen.map((m, k) => msZeile(m, k, mOffen.length))}</Liste>}
          {erledigtBereich(mErledigt.map((m, k) => msZeile(m, k, mErledigt.length)), mErledigt.length)}
        </Karte>
      </div>
    </>
  );
}

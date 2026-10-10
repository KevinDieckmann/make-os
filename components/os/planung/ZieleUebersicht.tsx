'use client';

// ─── MAKE OS — Ziele im Privat-Bereich: Unsere · Meine · <Name> (09.10.) ─────────────────────────────────────────────────────
// Kevin 09.10.: „Wir müssen im privaten Bereich irgendwie einen Bereich haben, wo wir zusammen unsere Ziele eintragen können — und jeder
// für sich. Das ist unfassbar wichtig. Auch bei der Planung. Irgendwie müssen wir das Ganze ja sehen, sonst macht es keinen Sinn.“
// Befund vorher: eigene Ziele (`ziele-eigen--<person>`) gab es nur auf dem Server — keine Ansicht legte sie an oder zeigte sie (nur der
// Kompass las die eigenen Fokus-Sätze). Die Planung zeigte allein den gemeinsamen Bestand, gemischt mit Business; die Ziele der anderen
// Person gab es nur „ganz oder gar nicht“ (Konto › teilt.ziele) und nirgends als Liste. Deshalb fühlte es sich für das Paar unsichtbar an.
// Jetzt drei Spalten (am Handy untereinander), auf JEDEM Horizont — ZieleMeilensteine hängt sie im Privat-Filter statt der Ziele-Karte ein:
//   · Unsere Ziele — der gemeinsame Bestand (Privat + ohne Bereich), beide bearbeiten; im Jahr oben der Nordstern.
//   · Meine Ziele — der eigene Bestand (`fuer: 'ich'`), nur ich; je Ziel „mit <Name> teilen“ (`geteilt`, Vorgabe aus).
//   · <Name> — je Partner (anderes volles Mitglied des Haushalts) NUR, was er/sie geteilt hat — der Server filtert, hier nur lesen.
// Anlegen direkt in jeder Spalte (Enter), Fortschritt je Ziel und als Ø im Kopf, Meilensteine je Ziel aufklappbar: gemeinsame Ziele mit den
// gemeinsamen Meilensteinen (Bestand `meilensteine`), eigene Ziele seit 10.10. mit EIGENEN Meilensteinen (`meilensteine-eigen--<person>`,
// `useEigeneMeilensteine` + `EigeneMeilensteineListe`; die Spalte der anderen Person zeigt nur die der geteilten Ziele — der Server filtert).
// Namen aus den Konten (`usePlanPersonen`), nie fest im Code.

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { PRIVAT_EINHEITEN_NAMEN } from '@/lib/einheiten';
import { neueKennung } from '@/lib/kennung';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { offenErledigt, naechsterRang, verschiebe } from '@/lib/planung/rang';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import { wirksamerSpace, speicherSpace } from '@/lib/planung/bereich';
import { meilensteineVonZiel, wirksamerFortschritt } from '@/lib/planung/meilenstein-aufgaben';
import { eigenesZielFortschritt, meilensteineDesZiels } from '@/lib/planung/eigene-meilensteine';
import { usePlanPersonen, type PlanPerson } from '@/lib/planung/ziele-client';
import type { Ziel, ZielHorizont } from '@/lib/planung/typen';
import { useTasks } from '@/context/TasksContext';
import { Erklaert, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Haken, Schalter, Segmentbalken, ZeileAktionen, feld, LEUCHT, type Rueckgaengig } from '../ui';
import { PfeilRang } from './PfeilRang';
import { NordsternKarte } from './NordsternKarte';
import { usePlanung, type PlanungStand } from './usePlanung';
import { loescheZiel } from './ziel-loeschen';
import { useEigeneMeilensteine, type EigeneMeilensteineStand } from './useEigeneMeilensteine';
import { EigeneMeilensteineListe } from './EigeneMeilensteineListe';

export type SpaltenArt = 'unsere' | 'meine' | 'partner';
const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const dtKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const HORIZONT_WORT: Record<ZielHorizont, string> = { tag: 'Tages', woche: 'Wochen', monat: 'Monats', quartal: 'Quartals', jahr: 'Jahres' };
const leiseKnopf: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px', fontFamily: SCHRIFT.text };
/** Farbe je Spalte — Privat-Farbe für das Gemeinsame, Planung für das Eigene, Fokus-Ton für die andere Person. */
const SPALTEN_FARBE: Record<SpaltenArt, string> = { unsere: SPACE_FARBE.privat, meine: LEUCHT.planung, partner: LEUCHT.schlaf };

/** Durchschnittlicher Fortschritt einer Liste (erledigt = 100) — null ohne Ziele. */
export function schnittVon(ziele: readonly Pick<Ziel, 'erledigt' | 'fortschritt'>[]): number | null {
  return ziele.length ? Math.round(ziele.reduce((s, z) => s + (z.erledigt ? 100 : z.fortschritt), 0) / ziele.length) : null;
}

export interface ZieleUebersichtProps {
  horizont: ZielHorizont;
  /** Der gemeinsame Stand (von der Seite bzw. von ZieleMeilensteine) — Unsere Ziele schreiben darüber. */
  gemeinsam: PlanungStand;
  /** Nur im Jahr: das gewählte Planungsjahr. */
  planJahr: number;
  rueck: Rueckgaengig;
  /** Karten-Index fürs gestaffelte Erscheinen. */
  i?: number;
  /** Woche/Tag: kürzer, ohne Pfeile. */
  kompakt?: boolean;
  /** „Alles“ im Kopf (solange es ihn gibt): die gemeinsamen Ziele stehen dann in der Ziele-Karte daneben — hier nur Meine + Partner. */
  ohneUnsere?: boolean;
}

export function ZieleUebersicht({ horizont, gemeinsam, planJahr, rueck, i = 0, kompakt, ohneUnsere }: ZieleUebersichtProps) {
  const personen = usePlanPersonen();
  const meine = usePlanung(horizont, true, 'ich');
  // Eigene Meilensteine (10.10.): nach jedem Speichern zieht der Server den Fortschritt der eigenen Ziele nach — dann die Ziele neu laden.
  const meineMs = useEigeneMeilensteine('ich', true, meine.zieleNeuLaden);
  const partner = personen?.partner ?? [];
  return (
    <div className="ziele-spalten" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, alignItems: 'start' }}>
      {!ohneUnsere && (
        <ZielSpalte art="unsere" titel="Unsere Ziele" p={gemeinsam} horizont={horizont} planJahr={planJahr} rueck={rueck} i={i} kompakt={kompakt}
          kopf={horizont === 'jahr' ? <NordsternKarte eingebettet /> : <NordsternKarte kompakt />} />
      )}
      <ZielSpalte art="meine" titel="Meine Ziele" p={meine} horizont={horizont} planJahr={planJahr} rueck={rueck} i={i + 1} kompakt={kompakt} partner={partner} eigeneMs={meineMs} />
      {partner.map((pp, k) => <PartnerSpalte key={pp.speicher} person={pp} horizont={horizont} planJahr={planJahr} rueck={rueck} i={i + 2 + k} kompakt={kompakt} />)}
    </div>
  );
}

/** Je Partner eine eigene Ladung (nur lesen; der Server liefert nur das Geteilte). */
function PartnerSpalte({ person, horizont, planJahr, rueck, i, kompakt }: { person: PlanPerson; horizont: ZielHorizont; planJahr: number; rueck: Rueckgaengig; i: number; kompakt?: boolean }) {
  const p = usePlanung(horizont, true, person.speicher);
  const ms = useEigeneMeilensteine(person.speicher);
  return <ZielSpalte art="partner" titel={person.vorname} p={p} horizont={horizont} planJahr={planJahr} rueck={rueck} i={i} kompakt={kompakt} eigeneMs={ms} />;
}

interface SpalteProps {
  art: SpaltenArt; titel: string; p: PlanungStand; horizont: ZielHorizont; planJahr: number; rueck: Rueckgaengig; i: number; kompakt?: boolean;
  /** Oben in der Spalte (Unsere: der Nordstern). */
  kopf?: ReactNode;
  /** Meine: wem „teilen“ etwas zeigt (Vornamen im Schalter). */
  partner?: readonly PlanPerson[];
  /** Meine/Partner: die eigenen Meilensteine (10.10.) — die der anderen Person nur zu ihren geteilten Zielen (Server-Filter). */
  eigeneMs?: EigeneMeilensteineStand;
}

function ZielSpalte({ art, titel, p, horizont, planJahr, rueck, i, kompakt, kopf, partner = [], eigeneMs }: SpalteProps) {
  const farbe = SPALTEN_FARBE[art];
  const laufend = Number(p.heute.slice(0, 4));
  const zeitLabel = horizont === 'jahr' ? String(planJahr) : p.zr.label;
  const darf = art !== 'partner' && p.darfSchreiben;
  const { state: tasksState } = useTasks();
  const stand = useRef(p); stand.current = p;
  const heute = localDay();

  // Ziele dieser Spalte: im Jahr das gewählte Planungsjahr; „Unsere“ ohne Business (das steht unter Business wie bisher).
  const imHorizont = useMemo(() => p.ziele.filter(z => (horizont !== 'jahr' || zielJahr(z, laufend) === planJahr) && (art !== 'unsere' || wirksamerSpace(z) !== 'business')), [p.ziele, horizont, laufend, planJahr, art]);
  const sicht = useMemo(() => imHorizont.filter(z => !z.archiviertAm), [imHorizont]);
  const archiv = useMemo(() => imHorizont.filter(z => z.archiviertAm), [imHorizont]);
  const { offen, erledigt } = useMemo(() => offenErledigt(sicht), [sicht]);
  const schnitt = schnittVon(sicht);

  // ── Anlegen ──
  const [neu, setNeu] = useState({ titel: '', zahl: '', termin: '', einheit: '' });
  const privatEinheit = art === 'unsere' && !kompakt && PRIVAT_EINHEITEN_NAMEN.length > 0;
  const anlegen = () => {
    const t = neu.titel.trim();
    if (!t || !darf) return;
    const zahl = Number(neu.zahl.replace(',', '.'));
    const einheit = privatEinheit && PRIVAT_EINHEITEN_NAMEN.includes(neu.einheit) ? neu.einheit : undefined;
    const z: Ziel = {
      id: neueKennung('z'), titel: t, fortschritt: 0, rang: naechsterRang(offen),
      // Privat — eine Privat-Einheit (Selbstständigkeit) legt der Server in der alten Form ab (Business + Einheit), angezeigt unter Privat.
      space: speicherSpace('privat', einheit) ?? 'privat', ...(einheit ? { einheit } : {}),
      ...(horizont === 'jahr' && isFinite(zahl) && zahl > 0 ? { zielwert: zahl } : {}),
      ...(horizont === 'jahr' && neu.termin ? { termin: neu.termin } : {}),
      ...(horizont === 'jahr' ? { jahr: planJahr } : {}),
    };
    p.persistZiele([...p.ziele, z]);
    setNeu({ titel: '', zahl: '', termin: '', einheit: neu.einheit });
  };

  // ── Ändern (immer auf dem jüngsten Stand) ──
  const zPatch = (id: string, patch: Partial<Ziel>, angepasst = false) => { const q = stand.current; q.persistZiele(q.ziele.map(z => (z.id === id ? { ...z, ...patch, ...(angepasst && z.abgeleitetVon ? { angepasst: true } : {}) } : z))); };
  const erledigen = (z: Ziel) => zPatch(z.id, z.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 });
  const bewegen = (id: string, r: 'auf' | 'ab') => p.persistZiele(verschiebe(p.ziele, id, r, offen.map(z => z.id)));
  const archivieren = (z: Ziel) => {
    if (z.archiviertAm) { zPatch(z.id, { archiviertAm: undefined }); rueck.melden(`Ziel „${z.titel}“ ist zurück`, () => zPatch(z.id, { archiviertAm: new Date().toISOString() })); return; }
    zPatch(z.id, { archiviertAm: new Date().toISOString() }, true);
    rueck.melden(`Ziel „${z.titel}“ archiviert — unten zurückholbar`, () => zPatch(z.id, { archiviertAm: undefined }));
  };
  const loeschen = (z: Ziel) => { void loescheZiel(stand, z.id, rueck); };
  const teilenText = partner.length ? `mit ${partner.map(x => x.vorname).join(' und ')} teilen` : '';
  const teilen = (z: Ziel) => {
    zPatch(z.id, { geteilt: z.geteilt ? undefined : true });
    rueck.melden(z.geteilt ? `„${z.titel}“ sieht jetzt nur noch du` : `„${z.titel}“ ${partner.length === 1 ? 'sieht' : 'sehen'} jetzt auch ${partner.map(x => x.vorname).join(' und ')}`, () => zPatch(z.id, { geteilt: z.geteilt ? true : undefined }));
  };

  // ── Bearbeiten (Titel) und aufgeklappte Meilensteine ──
  const [bearbeite, setBearbeite] = useState<{ id: string; text: string } | null>(null);
  const [auf, setAuf] = useState<Set<string>>(new Set());
  const [erledigtAuf, setErledigtAuf] = useState(false);
  const umschalten = (id: string) => setAuf(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const zeile = (z: Ziel, pos: number, n: number) => {
    const zMs = art === 'unsere' ? meilensteineVonZiel(z.id, p.ms) : [];
    // Eigene Ziele (10.10.): eigene Meilensteine; der Fortschritt folgt ihnen (Mittelwert), sonst der Wert von Hand.
    const mitEigenen = art !== 'unsere' && !!eigeneMs;
    const darfMs = darf && !!eigeneMs?.darfSchreiben;
    const nMs = zMs.length || (eigeneMs && mitEigenen ? meilensteineDesZiels(z.id, eigeneMs.ms).length : 0);
    const v = eigeneMs && mitEigenen ? eigenesZielFortschritt(z, eigeneMs.ms) : z.erledigt ? 100 : z.fortschritt;
    const offenMs = auf.has(z.id);
    const abgeleitet = !!z.abgeleitetVon && !z.angepasst;
    const titelKnoten = bearbeite?.id === z.id
      ? <input autoFocus value={bearbeite.text} aria-label="Titel bearbeiten" onChange={e => setBearbeite({ id: z.id, text: e.target.value })}
          onBlur={() => { if (bearbeite.text.trim()) zPatch(z.id, { titel: bearbeite.text.trim() }, true); setBearbeite(null); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setBearbeite(null); }}
          style={{ ...feld, padding: '4px 8px', fontSize: TYP.body, fontWeight: 600 }} />
      : art === 'unsere'
        ? <Link href={WEG.ziel(z.id)} title="Ziel öffnen — Meilensteine als Kette, Beschreibung, Messlatte" style={{ fontWeight: 600, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none' }}>{z.titel}</Link>
        : <span style={{ fontWeight: 600, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none' }}>{z.titel}</span>;
    const unter = [
      z.termin ? `bis ${dtKurz(z.termin)}` : null,
      horizont === 'jahr' && z.zielwert ? `Ziel ${z.zielwert}` : null,
      nMs || (mitEigenen && darfMs) ? (
        <button key="ms" type="button" onClick={() => umschalten(z.id)} aria-expanded={offenMs} aria-label={`Meilensteine von „${z.titel}“ ${offenMs ? 'zuklappen' : 'aufklappen'}`}
          style={{ ...leiseKnopf, padding: 0, color: C.inkDim }}>{offenMs ? '▾' : '▸'} {nMs ? (nMs === 1 ? '1 Meilenstein' : `${nMs} Meilensteine`) : 'Meilensteine'}</button>
      ) : null,
      z.abgeleitetVon ? <span key="ab" style={{ color: z.angepasst ? LEUCHT.achtung : LEUCHT.agenten }}>{z.angepasst ? 'angepasst' : 'aus dem Jahresziel'}</span> : null,
      art === 'meine' && partner.length > 0 ? (
        abgeleitet
          ? <span key="gt" style={{ color: z.geteilt ? farbe : C.inkLeise }}>{z.geteilt ? 'geteilt wie das Jahresziel' : 'nur ich (wie das Jahresziel)'}</span>
          : <Erklaert key="gt" erklaerung="ziele.teilen" name={`„${z.titel}“ teilen`}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Schalter erklaerungOhne="Teilen-Schalter im Satz der Zielzeile — das „i“ um den ganzen Satz erklärt das Teilen" an={!!z.geteilt} onChange={() => teilen(z)} farbe={farbe} ariaLabel={`„${z.titel}“ ${teilenText}`} titel={z.geteilt ? 'Geteilt — Klick: nur ich' : `Nur ich — Klick: ${teilenText}`} />
              <span style={{ color: z.geteilt ? farbe : C.inkLeise }}>{z.geteilt ? `geteilt mit ${partner.map(x => x.vorname).join(' und ')}` : 'nur ich'}</span>
            </span></Erklaert>
      ) : null,
      z.erledigt && z.erledigtAm ? `erledigt ${dtKurz(z.erledigtAm)}` : null,
    ].filter(Boolean) as ReactNode[];
    const fortschritt = !z.erledigt && (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        {darf && !nMs
          ? <input type="range" min={0} max={100} step={5} value={v} aria-label={`Fortschritt „${z.titel}“`} onChange={e => zPatch(z.id, { fortschritt: Number(e.target.value) })} style={{ width: kompakt ? 64 : 'clamp(64px, 9vw, 96px)', accentColor: col(v) }} />
          : <span title={nMs ? 'Aus den Meilensteinen dieses Ziels' : undefined} style={{ display: 'inline-flex', width: kompakt ? 64 : 'clamp(64px, 9vw, 96px)' }}><Segmentbalken anteil={v / 100} label={`Fortschritt ${z.titel}`} farbe={col(v)} segmente={kompakt ? 8 : 10} hoehe={10} breite="100%" /></span>}
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right', color: col(v) }}>{v} %</span>
        {darf && !kompakt && <PfeilRang label={z.titel} obenAus={pos === 0} untenAus={pos === n - 1} onAuf={() => bewegen(z.id, 'auf')} onAb={() => bewegen(z.id, 'ab')} />}
        {darf && <button onClick={() => setBearbeite({ id: z.id, text: z.titel })} aria-label={`„${z.titel}“ umbenennen`} title="umbenennen" style={leiseKnopf}>✎</button>}
      </span>
    );
    const kern = (
      <Zeile umbrechen
        links={darf ? <Haken an={!!z.erledigt} farbe={farbe} label={z.titel} onChange={() => erledigen(z)} /> : <span aria-hidden style={{ width: 24, textAlign: 'center', color: z.erledigt ? LEUCHT.gut : farbe, fontWeight: 800, flex: '0 0 auto' }}>{z.erledigt ? '✓' : '◇'}</span>}
        titel={titelKnoten}
        unter={unter.length ? <>{unter.map((x, k) => <span key={k}>{k > 0 ? ' · ' : ''}{x}</span>)}</> : undefined}
        rechts={fortschritt || undefined} />
    );
    return (
      <div key={z.id}>
        {darf ? <ZeileAktionen href={WEG.ziel(z.id)} titel={z.titel} archiviert={!!z.archiviertAm} onArchivieren={() => archivieren(z)} onLoeschen={() => loeschen(z)}>{kern}</ZeileAktionen> : kern}
        {offenMs && mitEigenen && eigeneMs && <EigeneMeilensteineListe zielId={z.id} zielTitel={z.titel} stand={eigeneMs} darf={darfMs} rueck={rueck} farbe={farbe} heute={heute} />}
        {offenMs && zMs.length > 0 && (
          <div style={{ margin: '2px 0 8px 36px', display: 'grid', gap: 4 }}>
            {zMs.map(m => {
              const mv = wirksamerFortschritt(m, tasksState);
              const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;
              return (
                <Link key={m.id} href={WEG.meilenstein(m.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: m.erledigt ? C.inkLeise : C.inkDim, textDecoration: 'none' }}>
                  <span aria-hidden style={{ color: m.erledigt ? LEUCHT.gut : LEUCHT.achtung }}>{m.erledigt ? '✓' : '◆'}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.titel}</span>
                  {m.faellig && <span style={{ color: spaet ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{spaet ? 'überfällig ' : ''}{dtKurz(m.faellig)}</span>}
                  <span style={{ width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: col(mv) }}>{mv} %</span>
                </Link>
              );
            })}
            <Link href={WEG.ziel(z.id)} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Meilensteine im Ziel planen ›</Link>
          </div>
        )}
      </div>
    );
  };

  const leerText: ReactNode = art === 'unsere'
    ? `Noch keine gemeinsamen Ziele für ${zeitLabel}. Was wollt ihr zusammen erreichen?`
    : art === 'meine'
      ? <>Noch keine eigenen Ziele für {zeitLabel}. Nur du siehst sie{teilenText ? ' — teilen kannst du jedes einzeln' : ''}.</>
      : p.nichtGeteilt ? `${titel} hat noch kein Ziel mit dir geteilt.` : `Für ${zeitLabel} hat ${titel} nichts geteilt.`;

  return (
    <Karte i={i} akzent={farbe}>
      <Ueberschrift farbe={farbe} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{offen.length ? `${offen.length} offen` : ''}{schnitt != null ? `${offen.length ? ' · ' : ''}Ø ${schnitt} %` : ''}</span>}>
        {titel}{art === 'partner' && <span style={{ fontWeight: 500, color: C.inkLeise }}> · geteilt</span>}
      </Ueberschrift>
      {kopf && <div style={{ marginBottom: 10 }}>{kopf}</div>}
      {darf && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
              aria-label={art === 'unsere' ? 'Neues gemeinsames Ziel' : 'Neues eigenes Ziel'} placeholder={`+ ${art === 'unsere' ? 'gemeinsames' : 'eigenes'} ${HORIZONT_WORT[horizont]}ziel …`}
              style={{ ...feld, width: 'auto', flex: '1 1 160px', minWidth: 0 }} />
            <Knopf onClick={anlegen} aus={!neu.titel.trim()}>+ Ziel</Knopf>
          </div>
          {/* Im Jahr: Zahlenziel und Termin (Kaskade, Meilenstein) — erst, wenn ein Titel steht. */}
          {horizont === 'jahr' && !!neu.titel.trim() && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={neu.zahl} onChange={e => setNeu({ ...neu, zahl: e.target.value })} inputMode="decimal" aria-label="Zahlenziel" title="Zahlenziel — wird auf Quartal, Monat, Woche, Tag verteilt" placeholder="Zahl (optional)" style={{ ...feld, width: 'auto', flex: '1 1 110px', minWidth: 0 }} />
              <input type="date" value={neu.termin} onChange={e => setNeu({ ...neu, termin: e.target.value })} aria-label="Termin (optional)" title={art === 'unsere' ? 'Ziel mit Datum — wird Meilenstein im passenden Quartal' : 'Ziel mit Datum'} style={{ ...feld, width: 'auto', flex: '1 1 140px', colorScheme: 'dark' }} />
              {privatEinheit && (
                <select value={neu.einheit} onChange={e => setNeu({ ...neu, einheit: e.target.value })} aria-label="Einheit (Privat)" style={{ ...feld, width: 'auto', flex: '1 1 140px' }}>
                  <option value="">ohne Einheit</option>
                  {PRIVAT_EINHEITEN_NAMEN.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      )}
      {!p.geladen ? <Leer>lade …</Leer>
        : !offen.length && !erledigt.length ? <Leer symbol={art === 'partner' ? '◇' : '◎'}>{leerText}</Leer>
        : !offen.length ? <Leer symbol="✓">Alles erledigt — was kommt als Nächstes?</Leer>
        : <Liste>{offen.map((z, k) => zeile(z, k, offen.length))}</Liste>}
      {(erledigt.length > 0 || (darf && archiv.length > 0)) && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${C.linie}`, paddingTop: 6 }}>
          <button type="button" onClick={() => setErledigtAuf(a => !a)} aria-expanded={erledigtAuf} style={{ ...leiseKnopf, padding: '6px 0', minHeight: 40 }}>
            {erledigtAuf ? '▾' : '▸'} Erledigt {erledigt.length}{darf && archiv.length ? ` · Archiv ${archiv.length}` : ''}
          </button>
          {erledigtAuf && <Liste>{[...erledigt.map((z, k) => zeile(z, k, erledigt.length)), ...(darf ? archiv.map((z, k) => zeile(z, k, archiv.length)) : [])]}</Liste>}
        </div>
      )}
    </Karte>
  );
}

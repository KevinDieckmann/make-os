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
// Am Eintrag führt „›“ neben dem Chip in die Mandatsakte (MandantLink, 28.09.); beim Anlegen nicht.
// Seit 30.09. (Kevin: „bis Ende nächsten Jahres planen“): im Jahr zeigt das Bauteil das gewählte
// Planungsjahr (`planJahr`) — Jahresziele nach `zielJahr`, Meilensteine nach `meilensteinImJahr`
// (lib/planung/zeitstrahl.ts); neue Jahresziele tragen `jahr`, Meilensteine ohne Datum im nächsten
// Jahr das Zeitfenster „2027“. Die Jahresseite reicht ihren Stand (`planung`), den Einheiten-Filter und
// `onMsOeffnen` (das Meilenstein-Fenster) herein; Löschen zeigt „Rückgängig“ (wie Aufgaben).
// Seit 01.10. (Ziel ↔ Meilenstein): der Ziel-Titel führt ins Ziel-Detail (`WEG.ziel`), der Ziel-Bezug am Meilenstein ebenso;
// ein Meilenstein, der noch auf einen offenen Vorgänger wartet, sagt es in der Zeile; Löschen räumt die Kette mit
// (`loescheMeilenstein`), ein gelöschtes Ziel lässt seine Meilensteine stehen („ohne Ziel“).
// 04.10. (Kevin: „alles anpassbar“): jede Zeile am Baustein `ZeileAktionen` — Archivieren (`archiviertAm`: aus der Liste
// ausgeblendet, Bereich „Archiv“ unten, zurückholbar; zählt nie als erledigt; Abgeleitetes wird dabei gelöst, damit die
// Kaskade es nicht neu anlegt) und Löschen (mit „Rückgängig“; Abgeleitetes → Rückfrage, Archiv als Weg — gelöscht käme es
// beim nächsten Nachziehen wieder). Der ✕-Knopf in der Zeile ist damit weg; „lösen“ bleibt.
// 05.10. abends (Kevin: Ziele/Meilensteine der Selbstständigkeit „automatisch nach Privat“): der Bereich jeder Zeile ist abgeleitet
// (`wirksamerSpace`/`meilensteinSpace`, lib/planung/bereich.ts) — Einträge mit der Einheit „Selbstständigkeit“ stehen unter Privat, ihr
// Einheiten-Chip in der Privat-Farbe (nie als Business-Einheit). Im Privat-Filter lässt sich die Privat-Einheit beim Anlegen wählen;
// gespeichert wird in der Form, die der alte Stand kennt (Server, `speicherSpace`).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_LABEL, SPACE_FARBE, type SpaceId } from '@/lib/make-one/space-regeln';
import { passtEinheit } from '@/lib/planung/einheiten';
import { meilensteinSpace, meilensteinSpeicherSpace, bereichAusSpace } from '@/lib/planung/meilensteine';
import { wirksamerSpace, hatPrivatEinheit, speicherSpace } from '@/lib/planung/bereich';
import { PRIVAT_EINHEITEN_NAMEN } from '@/lib/einheiten';
import { offenErledigt, verschiebe, naechsterRang } from '@/lib/planung/rang';
import { imZeitraum } from '@/lib/planung/zeitraum';
import { meilensteinImJahr, zielJahr } from '@/lib/planung/zeitstrahl';
import { useRueckgaengig, useRueckfrage, ZeileAktionen, type Rueckgaengig } from '../ui';
import type { Meilenstein, Ziel, ZielHorizont } from '@/lib/planung/typen';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Haken, Hinweis, feld, LEUCHT, Segmentbalken } from '../ui';
import { zielRahmen } from '../ziel';
import { PfeilRang } from './PfeilRang';
import { usePlanung, type PlanungStand } from './usePlanung';
import { MandatWahl, useMandate } from '../zeit/MandatWahl';
import type { MandatKurz } from '@/lib/planung/mandat';
import { neueKennung } from '@/lib/kennung';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { useTasks } from '@/context/TasksContext';
import { aufgabenVonMeilenstein, aufgabenStand, wirksamerFortschritt, fortschrittErrechnet, meilensteineVonZiel } from '@/lib/planung/meilenstein-aufgaben';
import { wartetText } from '@/lib/planung/meilenstein-kette';
import { loescheMeilenstein } from './meilenstein-loeschen';
import { loescheZiel } from './ziel-loeschen';

type SpaceFilter = SpaceId | 'alle';
const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const prozent: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', width: 40, textAlign: 'right', flex: '0 0 auto' };
const loeschen: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' };
const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const pille = (an: boolean, farbe: string): CSSProperties => ({ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim });
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
  /** Aus einem Link (?m=) hervorgehobener Meilenstein. */
  zielM?: string | null;
  /** Karten-Index fürs gestaffelte Erscheinen. */
  i?: number;
  /** Kompakt (Woche/Tag): ohne Space-Wechsel je Zeile, kürzere Texte. */
  kompakt?: boolean;
  /** Der Stand von der Seite (30.09., Jahresplanung) — sonst lädt das Bauteil selbst. */
  planung?: PlanungStand;
  /** Nur im Jahr: das gewählte Planungsjahr (Standard: das laufende). */
  planJahr?: number;
  /** Einheiten-Filter von außen gesteuert (die Jahresseite belegt damit das Anlegen am Zeitstrahl vor). */
  einheitFilter?: string;
  onEinheit?: (e: string) => void;
  /** Meilenstein im Fenster öffnen (Bearbeiten, Verschieben) — sonst nur Umbenennen in der Zeile. */
  onMsOeffnen?: (id: string) => void;
  /** Hinweis mit „Rückgängig“ von der Seite — sonst ein eigener. */
  rueckgaengig?: Rueckgaengig;
}

export function ZieleMeilensteine({ horizont, farbe = LEUCHT.schlaf, spaceFilter: spaceProp, onSpace, zielM, i = 0, kompakt, planung, planJahr: planJahrProp, einheitFilter: einheitProp, onEinheit, onMsOeffnen, rueckgaengig }: ZieleMeilensteineProps) {
  const eigen = usePlanung(horizont, !planung);
  const p = planung ?? eigen;
  const eigenerHinweis = useRueckgaengig();
  const rueck = rueckgaengig ?? eigenerHinweis;
  const { fragen, dialog } = useRueckfrage();
  const laufend = Number(p.heute.slice(0, 4));
  const planJahr = horizont === 'jahr' ? (planJahrProp ?? laufend) : laufend;
  const zeitLabel = horizont === 'jahr' ? String(planJahr) : p.zr.label;
  // Der jüngste Stand für „Rückgängig“ (das Zurückholen läuft später, nach anderen Änderungen).
  const stand = useRef(p); stand.current = p;
  // Meilenstein ↔ Aufgaben (30.09.): Fortschritt aus den Aufgaben, sobald es welche gibt; Ziel aus seinen Meilensteinen.
  const { state: tasksState } = useTasks();
  const { space: aktiverSpace, ausAdresse: spaceAusAdresse, setzen: spaceSetzen } = useSpace();
  const [spaceEigen, setSpaceEigen] = useState<SpaceFilter>('alle');
  useEffect(() => { if (!spaceProp) setSpaceEigen(spaceAusAdresse ?? aktiverSpace); }, [spaceProp, spaceAusAdresse, aktiverSpace]);
  const spaceFilter = spaceProp ?? spaceEigen;
  const setSpace = (s: SpaceFilter) => { if (onSpace) onSpace(s); else setSpaceEigen(s); if (s !== 'alle') spaceSetzen(s); };
  const [einheitEigen, setEinheitEigen] = useState<string>('alle');
  const einheitFilter = einheitProp ?? einheitEigen;
  const setEinheitFilter = (e: string) => { if (onEinheit) onEinheit(e); else setEinheitEigen(e); };
  const [einheitNeu, setEinheitNeu] = useState<string | null>(null);
  const heute = localDay();
  const imBusiness = spaceFilter === 'business';
  // Privat-Einheiten (05.10. abends, unsere Instanz: die Selbstständigkeit) — wählbar beim Anlegen im Privat-Filter.
  const einheitImPrivat = spaceFilter === 'privat' && PRIVAT_EINHEITEN_NAMEN.length > 0;
  const privatEinheitOk = (e: string) => PRIVAT_EINHEITEN_NAMEN.includes(e);

  // ── Ziele im Filter ──
  // Archiviertes (04.10.) steht nur im Bereich „Archiv“ — Offen/Erledigt rechnen ohne es.
  const zieleImFilter = useMemo(() => p.ziele.filter(z => { const zs = wirksamerSpace(z); return (spaceFilter === 'alle' || !zs || zs === spaceFilter) && (!imBusiness || passtEinheit(z.einheit, einheitFilter)); })
    .filter(z => horizont !== 'jahr' || zielJahr(z, laufend) === planJahr), [p.ziele, spaceFilter, imBusiness, einheitFilter, horizont, laufend, planJahr]);
  const zieleSicht = useMemo(() => zieleImFilter.filter(z => !z.archiviertAm), [zieleImFilter]);
  const zArchiv = useMemo(() => zieleImFilter.filter(z => z.archiviertAm), [zieleImFilter]);
  const { offen: zOffen, erledigt: zErledigt } = useMemo(() => offenErledigt(zieleSicht), [zieleSicht]);

  // ── Meilensteine im Zeitraum und Filter ──
  const msImFilter = useMemo(() => p.ms.filter(m => {
    const spaceOk = spaceFilter === 'alle' || meilensteinSpace(m) === spaceFilter;
    const zeitOk = horizont === 'jahr' ? meilensteinImJahr(m, planJahr, laufend) : imZeitraum(m.faellig, p.zr);
    return spaceOk && zeitOk && (!imBusiness || passtEinheit(m.einheit, einheitFilter));
  }), [p.ms, spaceFilter, horizont, p.zr, imBusiness, einheitFilter, planJahr, laufend]);
  const msSicht = useMemo(() => msImFilter.filter(m => !m.archiviertAm), [msImFilter]);
  const mArchiv = useMemo(() => msImFilter.filter(m => m.archiviertAm), [msImFilter]);
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

  /** Einheit beim Anlegen — im Business die Einheiten des Haushalts (+ neu), im Privat-Filter nur die Privat-Einheiten (ohne „neu“). */
  const einheitWahl = (wert: string, setzen: (v: string) => void, label: string, privat = false) => (
    <select value={privat && !privatEinheitOk(wert) ? '' : wert} aria-label={label} style={wahl} onChange={async e => {
      if (e.target.value === NEU_EINHEIT) { const n = window.prompt('Neue Einheit (z. B. eine Firma, ein Kunde):'); const s = n ? await p.einheitAnlegen(n) : null; setzen(s ?? ''); return; }
      setzen(e.target.value);
    }}>
      <option value="">{privat ? 'ohne Einheit' : 'Einheit …'}</option>
      {(privat ? PRIVAT_EINHEITEN_NAMEN : p.einheiten).map(e => <option key={e} value={e}>{e}</option>)}
      {!privat && <option value={NEU_EINHEIT}>+ neue Einheit</option>}
    </select>
  );

  const zielAnlegen = () => {
    const t = neu.titel.trim();
    if (!t) return;
    const zahl = Number(neu.zahl.replace(',', '.'));
    const z: Ziel = {
      id: neueKennung('z'), titel: t, fortschritt: 0, rang: naechsterRang(zOffen),
      ...(spaceFilter !== 'alle' ? { space: speicherSpace(spaceFilter, einheitImPrivat && privatEinheitOk(neu.einheit) ? neu.einheit : undefined) } : {}),
      ...(imBusiness && (neu.einheit || (einheitFilter !== 'alle' ? einheitFilter : '')) ? { einheit: neu.einheit || einheitFilter } : {}),
      // Privat-Einheit (Selbstständigkeit): der Server legt das Ziel in der alten Form ab (Business + Einheit), angezeigt unter Privat.
      ...(einheitImPrivat && privatEinheitOk(neu.einheit) ? { einheit: neu.einheit } : {}),
      ...(imBusiness && neu.mandatId ? { mandatId: neu.mandatId } : {}),
      ...(horizont === 'jahr' && isFinite(zahl) && zahl > 0 ? { zielwert: zahl } : {}),
      ...(horizont === 'jahr' && neu.termin ? { termin: neu.termin } : {}),
      // Planungsjahr (30.09.): das gewählte — auch wenn die Frist schon ins Folgejahr fällt.
      ...(horizont === 'jahr' ? { jahr: planJahr } : {}),
    };
    p.persistZiele([...p.ziele, z]);
    setNeu({ titel: '', zahl: '', termin: '', einheit: neu.einheit, mandatId: neu.mandatId });
  };
  const msAnlegen = () => {
    const t = msNeu.titel.trim();
    if (!t) return;
    const faellig = msNeu.faellig || (horizont === 'jahr' ? '' : p.zr.bis);
    // Ohne Datum in einem anderen als dem laufenden Jahr: das Jahr als Zeitfenster — sonst stünde er im laufenden.
    const zeitfenster = horizont === 'jahr' && !faellig && planJahr !== laufend ? String(planJahr) : undefined;
    // Seit 28.09. das echte Feld `space`; `bereich` nur gespiegelt für ältere Leser.
    const space: SpaceId = spaceFilter !== 'alle' ? spaceFilter : msNeu.space;
    const einheit = space === 'business' && imBusiness ? (msNeu.einheit || (einheitFilter !== 'alle' ? einheitFilter : ''))
      : space === 'privat' && einheitImPrivat && privatEinheitOk(msNeu.einheit) ? msNeu.einheit : '';
    const mandatId = space === 'business' ? msNeu.mandatId : '';
    // Speicherform (05.10. abends): Privat + Privat-Einheit wie bisher als Business + Einheit — angezeigt unter Privat.
    const gespeichert = speicherSpace(space, einheit) ?? space;
    p.persistMs([...p.ms, { id: neueKennung('ms'), titel: t, space: gespeichert, bereich: bereichAusSpace(gespeichert), faellig: faellig || undefined, ...(zeitfenster ? { zeitfenster } : {}), fortschritt: 0, erledigt: false, rang: naechsterRang(mOffen), ...(einheit ? { einheit } : {}), ...(mandatId ? { mandatId } : {}) }]);
    setMsNeu({ titel: '', faellig: '', space, einheit: msNeu.einheit, mandatId: msNeu.mandatId });
  };

  // ── Ändern ──
  const zPatch = (id: string, patch: Partial<Ziel>, angepasst = false) => p.persistZiele(p.ziele.map(z => (z.id === id ? { ...z, ...patch, ...(angepasst && z.abgeleitetVon ? { angepasst: true } : {}) } : z)));
  const zErledigen = (z: Ziel) => zPatch(z.id, z.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 });
  const zLoeschen = (id: string) => { loescheZiel(stand, id, rueck); };
  const zBewegen = (id: string, r: 'auf' | 'ab') => p.persistZiele(verschiebe(p.ziele, id, r, zOffen.map(z => z.id)));
  const mPatch = (id: string, patch: Partial<Meilenstein>, angepasst = false) => p.persistMs(p.ms.map(m => (m.id === id ? { ...m, ...patch, ...(angepasst && m.abgeleitetVon ? { angepasst: true } : {}) } : m)));
  const mErledigen = (m: Meilenstein) => mPatch(m.id, m.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 }, true);
  const mLoeschen = (id: string) => { loescheMeilenstein(stand, id, rueck); };
  const mBewegen = (id: string, r: 'auf' | 'ab') => p.persistMs(verschiebe(p.ms, id, r, mOffen.map(m => m.id)));

  // ── Archivieren · Zurückholen · Löschen (04.10., ZeileAktionen) ──
  // „Rückgängig“ läuft später — immer auf dem jüngsten Stand (`stand`), nie auf dem dieser Zeichnung.
  const zMarke = (id: string, archiviertAm: string | undefined) => { const q = stand.current; q.persistZiele(q.ziele.map(z => (z.id === id ? { ...z, archiviertAm } : z))); };
  const mMarke = (id: string, archiviertAm: string | undefined) => { const q = stand.current; q.persistMs(q.ms.map(m => (m.id === id ? { ...m, archiviertAm } : m))); };
  // Archivieren löst Abgeleitetes zugleich (`angepasst`) — sonst legte die Kaskade es beim nächsten Nachziehen neu an.
  const zArchivieren = (z: Ziel) => {
    if (z.archiviertAm) { zMarke(z.id, undefined); rueck.melden(`Ziel „${z.titel}“ ist zurück`, () => zMarke(z.id, new Date().toISOString())); return; }
    zPatch(z.id, { archiviertAm: new Date().toISOString() }, true);
    rueck.melden(`Ziel „${z.titel}“ archiviert — unten unter „Archiv“ zurückholbar`, () => zMarke(z.id, undefined));
  };
  const mArchivieren = (m: Meilenstein) => {
    if (m.archiviertAm) { mMarke(m.id, undefined); rueck.melden(`„${m.titel}“ ist zurück`, () => mMarke(m.id, new Date().toISOString())); return; }
    mPatch(m.id, { archiviertAm: new Date().toISOString() }, true);
    rueck.melden(`„${m.titel}“ archiviert — unten unter „Archiv“ zurückholbar`, () => mMarke(m.id, undefined));
  };
  /** Abgeleitetes (nicht gelöst) käme gelöscht beim nächsten Nachziehen zurück — die Rückfrage bietet das Archiv an. */
  const abgeleitetFragen = (titel: string, archivieren: () => void) => fragen({
    titel: `„${titel}“ kommt aus dem Jahresziel`,
    text: 'Abgeleitetes legt die Kaskade beim nächsten Nachziehen neu an — gelöscht wäre es gleich wieder da. Archivieren löst es vom Jahresziel und blendet es dauerhaft aus (zurückholbar). Ganz weg geht es mit dem Jahresziel selbst.',
    wahl: [{ label: 'Archivieren', tun: archivieren }],
  });
  const zLoeschenFrage = (z: Ziel) => (z.abgeleitetVon && !z.angepasst ? abgeleitetFragen(z.titel, () => zArchivieren(z)) : zLoeschen(z.id));
  const mLoeschenFrage = (m: Meilenstein) => (m.abgeleitetVon && !m.angepasst ? abgeleitetFragen(m.titel, () => mArchivieren(m)) : mLoeschen(m.id));

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
  /** Einheit am Eintrag: Business-Einheiten in Business-Farbe; eine Privat-Einheit (Selbstständigkeit) in Privat-Farbe — nie als Business-Einheit. */
  const einheitChip = (e: { einheit?: string; space?: SpaceId }) => {
    if (!e.einheit) return null;
    if (hatPrivatEinheit(e)) return <Chip farbe={SPACE_FARBE.privat}>{e.einheit}</Chip>;
    return e.space === 'business' && !(imBusiness && einheitFilter !== 'alle') ? <Chip farbe={SPACE_FARBE.business}>{e.einheit}</Chip> : null;
  };
  /** Mandat am Eintrag (nur Business): gesetzt als Chip, sonst „+ Mandat“ (nicht im kompakten Modus, nicht bei Erledigtem). */
  const mandatChip = (e: { mandatId?: string; erledigt?: boolean }, business: boolean, setzen: (m: MandatKurz | null) => void) => {
    if (!business || (!e.mandatId && (!mandatZugang || kompakt || e.erledigt))) return null;
    return <MandatWahl klein wert={e.mandatId} aus={!!e.erledigt} setzen={setzen} />;
  };
  /** Ziel-Bezug am Meilenstein: der Name des Jahresziels (verschwundene Ziele zeigen nichts). */
  const zielName = (id: string): ReactNode => { const z = p.alleZiele.find(x => x.id === id); return z ? <Link href={WEG.ziel(z.id)} title="Zum Ziel — Meilensteine als Kette" style={{ color: farbe, textDecoration: 'none' }}>→ {z.titel}</Link> : null; };
  const unterZeile = (teile: ReactNode[]) => { const t = teile.filter(Boolean); return t.length ? <>{t.map((x, k) => <span key={k}>{k > 0 ? ' · ' : ''}{x}</span>)}</> : undefined; };

  // ── Zeilen ──
  const zielZeile = (z: Ziel, pos: number, n: number) => {
    const zMs = meilensteineVonZiel(z.id, p.ms);
    const v = z.erledigt ? 100 : z.fortschritt;
    const zs = wirksamerSpace(z);
    const f = zs ? SPACE_FARBE[zs] : farbe;
    return (
      <ZeileAktionen key={z.id} titel={z.titel} archiviert={!!z.archiviertAm} onArchivieren={() => zArchivieren(z)} onLoeschen={() => zLoeschenFrage(z)}>
      <Zeile
        links={<Haken an={!!z.erledigt} farbe={f} onChange={() => zErledigen(z)} />}
        titel={bearbeite?.id === z.id ? titelFeld(z.id, t => zPatch(z.id, { titel: t }, true)) : <Link href={WEG.ziel(z.id)} title="Ziel öffnen — Meilensteine als Kette, Beschreibung, Messlatte" style={{ fontWeight: 600, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none' }}>{z.titel}</Link>}
        unter={unterZeile([
          einheitChip(z),
          mandatChip(z, z.space === 'business', m => zPatch(z.id, mandatFelder(m), true)),
          spaceFilter === 'alle' && zs ? <span style={{ color: SPACE_FARBE[zs] }}>{SPACE_LABEL[zs]}</span> : null,
          z.termin ? `bis ${dtKurz(z.termin)}` : null,
          horizont === 'jahr' && z.zielwert ? `Ziel ${z.zielwert}` : null,
          zMs.length ? <Link href={WEG.ziel(z.id)} title={zMs.map(x => x.titel).join(' · ')} style={{ color: 'inherit' }}>{zMs.length === 1 ? '1 Meilenstein' : `${zMs.length} Meilensteine`}{zMs.some(x => !x.erledigt && wartetText(x, p.ms)) ? ' · Kette' : ''}</Link> : null,
          herkunft(z, 'Jahresziel'),
          z.erledigt && z.erledigtAm ? `erledigt ${dtKurz(z.erledigtAm)}` : null,
        ])}
        rechts={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', opacity: z.erledigt ? 0.7 : 1 }}>
            {!z.erledigt && !kompakt && spaceFilter === 'alle' && (
              <button onClick={() => zPatch(z.id, zs === 'privat'
                // Privat → Business: eine Privat-Einheit (samt Mandat, das sie mitbrächte) fällt weg — sonst stünde das Ziel weiter unter Privat.
                ? { space: 'business', ...(hatPrivatEinheit(z) ? { einheit: undefined, mandatId: undefined, firmaId: undefined } : {}) }
                : zs === 'business' ? { space: undefined, einheit: undefined } : { space: 'privat' }, true)} title={zs ? `${SPACE_LABEL[zs]} — Klick wechselt` : 'gemeinsam — Klick wechselt'}
                style={{ ...pille(!!zs, zs ? SPACE_FARBE[zs] : C.inkLeise), padding: '2px 8px', fontSize: 12 }}>{zs ? SPACE_LABEL[zs] : 'gemeinsam'}</button>
            )}
            {!z.erledigt && (
              <>
                {zMs.length
                  ? <span title="Aus den Meilensteinen dieses Ziels" style={{ display: 'inline-flex', width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)' }}><Segmentbalken anteil={v / 100} label={`Fortschritt ${z.titel}`} farbe={col(v)} segmente={kompakt ? 8 : 12} hoehe={10} breite="100%" /></span>
                  : <input type="range" min={0} max={100} step={5} value={v} aria-label="Fortschritt" onChange={e => zPatch(z.id, { fortschritt: Number(e.target.value) })} style={{ width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)', accentColor: col(v) }} />}
                <span style={{ ...prozent, color: col(v) }}>{v} %</span>
                <PfeilRang label={z.titel} obenAus={pos === 0} untenAus={pos === n - 1} onAuf={() => zBewegen(z.id, 'auf')} onAb={() => zBewegen(z.id, 'ab')} />
                <button onClick={() => setBearbeite({ id: z.id, text: z.titel })} aria-label="Ziel umbenennen" title="umbenennen" style={loeschen}>✎</button>
              </>
            )}
            {z.abgeleitetVon && !z.angepasst && <button onClick={() => zPatch(z.id, { angepasst: true })} aria-label="Vom Jahresziel lösen" title="Vom Jahresziel lösen — wird ein eigenes Ziel" style={{ ...loeschen, fontSize: 12, color: LEUCHT.agenten }}>lösen</button>}
          </span>
        } />
      </ZeileAktionen>
    );
  };

  /** „wartet noch auf …“ (Kette) — nur im Text, nie gespeichert. */
  const wartetHinweis = (m: Meilenstein): ReactNode => { const t = wartetText(m, p.ms); return t ? <span style={{ color: LEUCHT.achtung }}>{t}</span> : null; };

  const msZeile = (m: Meilenstein, pos: number, n: number) => {
    const sp = meilensteinSpace(m);
    const bf = sp === 'privat' ? LEUCHT.gut : LEUCHT.business;
    const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;
    const wann = m.faellig ? dtKurz(m.faellig) : (m.zeitfenster ?? '');
    const mv = wirksamerFortschritt(m, tasksState);
    const ausAufgaben = fortschrittErrechnet(m.id, tasksState);
    const ms = aufgabenStand(aufgabenVonMeilenstein(tasksState, m.id));
    return (
      <div key={m.id} id={`ziel-${m.id}`} style={zielRahmen(zielM === m.id, bf)}>
        <ZeileAktionen titel={m.titel} archiviert={!!m.archiviertAm} onArchivieren={() => mArchivieren(m)} onLoeschen={() => mLoeschenFrage(m)}>
        <Zeile
          links={<Haken an={m.erledigt} farbe={bf} onChange={() => mErledigen(m)} />}
          titel={bearbeite?.id === m.id ? titelFeld(m.id, t => mPatch(m.id, { titel: t }, true)) : <Link href={WEG.meilenstein(m.id)} title="Meilenstein öffnen — Aufgaben, Verlauf, Dateien, Notizen" style={{ color: m.erledigt ? C.inkLeise : C.ink, textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.titel}</Link>}
          unter={unterZeile([
            wann ? (onMsOeffnen && !m.erledigt
              ? <button onClick={() => onMsOeffnen(m.id)} title="Datum ändern" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: spaet ? LEUCHT.kritisch : 'inherit', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{spaet ? 'überfällig ' : ''}{wann}</button>
              : <span style={{ color: spaet ? LEUCHT.kritisch : undefined }}>{spaet ? 'überfällig ' : ''}{wann}</span>) : null,
            m.zielId ? zielName(m.zielId) : null,
            wartetHinweis(m),
            einheitChip({ einheit: m.einheit, space: sp }),
            mandatChip(m, meilensteinSpeicherSpace(m) === 'business', x => mPatch(m.id, mandatFelder(x), true)),
            spaceFilter === 'alle' && (kompakt || m.erledigt) ? <span style={{ color: bf }}>{SPACE_LABEL[sp]}</span> : null,
            ms.gesamt ? <Link href={WEG.meilenstein(m.id)} style={{ color: 'inherit' }}>{ms.erledigt}/{ms.gesamt} Aufgaben</Link> : null,
            m.messlatte ? `Messlatte: ${m.messlatte}` : null,
            herkunft(m, 'Jahresziel'),
            m.erledigt && m.erledigtAm ? `erledigt ${dtKurz(m.erledigtAm)}` : null,
          ])}
          rechts={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', opacity: m.erledigt ? 0.7 : 1 }}>
              {!m.erledigt && !kompakt && spaceFilter === 'alle' && (
                <button onClick={() => { const neu: SpaceId = sp === 'privat' ? 'business' : 'privat'; mPatch(m.id, { space: neu, bereich: bereichAusSpace(neu), ...(neu === 'privat' || hatPrivatEinheit(m) ? { einheit: undefined } : {}), ...(neu === 'business' && hatPrivatEinheit(m) ? { mandatId: undefined, firmaId: undefined } : {}) }, true); }} title={`${SPACE_LABEL[sp]} — Klick wechselt`}
                  style={{ ...pille(true, bf), padding: '2px 8px', fontSize: 12 }}>{SPACE_LABEL[sp]}</button>
              )}
              {!m.erledigt && (
                <>
                  {ausAufgaben
                    ? <span title="Aus den Aufgaben des Meilensteins" style={{ width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)', height: 5, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${mv}%`, background: col(mv) }} /></span>
                    : <input type="range" min={0} max={100} step={5} value={m.fortschritt} aria-label="Fortschritt" onChange={e => mPatch(m.id, { fortschritt: Number(e.target.value) })} style={{ width: kompakt ? 'clamp(50px, 8vw, 80px)' : 'clamp(70px, 12vw, 110px)', accentColor: col(m.fortschritt) }} />}
                  <span style={{ ...prozent, color: col(mv) }}>{mv} %</span>
                  <PfeilRang label={m.titel} obenAus={pos === 0} untenAus={pos === n - 1} onAuf={() => mBewegen(m.id, 'auf')} onAb={() => mBewegen(m.id, 'ab')} />
                  {onMsOeffnen
                    ? <button onClick={() => onMsOeffnen(m.id)} aria-label={`„${m.titel}“ bearbeiten`} title="bearbeiten, verschieben" style={loeschen}>✎</button>
                    : <button onClick={() => setBearbeite({ id: m.id, text: m.titel })} aria-label="Meilenstein umbenennen" title="umbenennen" style={loeschen}>✎</button>}
                </>
              )}
              {m.abgeleitetVon && !m.angepasst && <button onClick={() => mPatch(m.id, { angepasst: true })} aria-label="Vom Jahresziel lösen" title="Vom Jahresziel lösen — wird ein eigener Meilenstein" style={{ ...loeschen, fontSize: 12, color: LEUCHT.agenten }}>lösen</button>}
            </span>
          } />
        </ZeileAktionen>
      </div>
    );
  };

  const erledigtBereich = (liste: ReactNode[], n: number, name = 'Erledigt') => (n > 0 ? (
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 2 }}>
        <span>{name}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      </div>
      <div style={{ maxHeight: ERLEDIGT_HOEHE, overflowY: 'auto', paddingRight: 2 }}><Liste>{liste}</Liste></div>
    </div>
  ) : null);

  const zieleAlle = p.ziele.length;
  const spaceHinweis = spaceFilter !== 'alle' ? ` in ${SPACE_LABEL[spaceFilter]}` : '';

  return (
    <>
      {p.hinweis && <Hinweis art="achtung" rolle="status">{p.hinweis}</Hinweis>}
      {!rueckgaengig && eigenerHinweis.hinweis}
      {dialog}
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
                  onBlur={() => setEinheitNeu(null)} style={{ ...feld, width: 180, padding: '5px 10px', fontSize: TYP.bedien }} />}
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
            {einheitImPrivat && einheitWahl(neu.einheit, v => setNeu({ ...neu, einheit: v }), 'Einheit des Ziels (Privat)', true)}
            {imBusiness && mandatZugang && <MandatWahl ohneLink wert={neu.mandatId || undefined} setzen={m => setNeu({ ...neu, mandatId: m?.id ?? '', einheit: m?.einheit ?? neu.einheit })} />}
            <Knopf onClick={zielAnlegen}>+ Ziel</Knopf>
          </div>
          {!p.geladen ? <Leer>lade …</Leer>
            : !zOffen.length && !zErledigt.length ? <Leer>{zieleAlle ? `Keine Ziele${spaceHinweis}${imBusiness && einheitFilter !== 'alle' ? ` für ${einheitFilter}` : ''}.` : `Noch keine Ziele für ${zeitLabel}${spaceHinweis}. Was soll am Ende stehen?`}</Leer>
            : !zOffen.length ? <Leer>Alles erledigt{spaceHinweis} — was kommt als Nächstes?</Leer>
            : <Liste>{zOffen.map((z, k) => zielZeile(z, k, zOffen.length))}</Liste>}
          {erledigtBereich(zErledigt.map((z, k) => zielZeile(z, k, zErledigt.length)), zErledigt.length)}
          {erledigtBereich(zArchiv.map((z, k) => zielZeile(z, k, zArchiv.length)), zArchiv.length, 'Archiv')}
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
            {einheitImPrivat && einheitWahl(msNeu.einheit, v => setMsNeu({ ...msNeu, einheit: v }), 'Einheit des Meilensteins (Privat)', true)}
            {msBusiness && mandatZugang && <MandatWahl ohneLink wert={msNeu.mandatId || undefined} setzen={m => setMsNeu({ ...msNeu, mandatId: m?.id ?? '', einheit: m?.einheit ?? msNeu.einheit })} />}
            <Knopf onClick={msAnlegen}>+ Meilenstein</Knopf>
          </div>
          {!mOffen.length && !mErledigt.length ? <Leer>Noch kein Meilenstein für {zeitLabel}{spaceHinweis}.{horizont === 'jahr' ? ' Ein Jahresziel mit Termin legt ihn von selbst an.' : ''}</Leer>
            : !mOffen.length ? <Leer>Alle Meilensteine für {zeitLabel} erledigt.</Leer>
            : <Liste>{mOffen.map((m, k) => msZeile(m, k, mOffen.length))}</Liste>}
          {erledigtBereich(mErledigt.map((m, k) => msZeile(m, k, mErledigt.length)), mErledigt.length)}
          {erledigtBereich(mArchiv.map((m, k) => msZeile(m, k, mArchiv.length)), mArchiv.length, 'Archiv')}
        </Karte>
      </div>
    </>
  );
}

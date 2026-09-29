'use client';

import Link from 'next/link';
// ─── MAKE OS — Routine-Planer ───────────────────────────────────────────────
// Positive Routinen für Gesundheit, Leben und Business — HIER werden sie
// geplant. Alles andere greift darauf zu: der Wochenplaner (Leiste + ZOE),
// die Tagesplanung, das Gesundheits-Cockpit (Häkchen), das Home-Widget
// „Routinen heute“ und der MAKE Score.
// 27.09. (Malins Rückmeldung): Trennung Privat / Business, Blöcke je Wochentag
// (Wochenvorlage je Person: wann Privat, wann Arbeit), Routinen je Person und
// gemeinsam, Rhythmus täglich … jährlich mit „nächstes Mal am“, Reihenfolge
// per Pfeil. Datenmodell additiv (lib/planung/typen.ts), gesäubert im Schreibweg.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ListenSchreiber, type SchreibErgebnis } from '@/lib/make-one/liste-stand';
import { localDay } from '@/lib/zeit';
import { SPACE_FARBE, SPACE_LABEL, type SpaceId } from '@/lib/make-one/space-regeln';
import { RHYTHMEN, WOCHENTAGE, OWNER_BEIDE, type Block, type Routine, type Wochentag } from '@/lib/planung/typen';
import { sortiertNachRang, verschiebe, naechsterRang } from '@/lib/planung/rang';
import { bloeckeFuer, standardBloecke, spaceVonRoutine, ownerVonRoutine } from '@/lib/planung/routinen';
import { EinheitWahl, useEinheiten } from './aufgaben/Einheit';
import { Wahl, type WahlEintrag } from './crm/Wahl';
import { einheitFarbe, einheitKurz, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { EINHEIT_MIN, EINHEIT_MAX } from '@/lib/planung/einheiten';
import { rhythmusKurz, naechstesMalNach } from '@/lib/planung/rhythmus';
import { PlanerLeiste } from './PlanerLeiste';
import { Seite, Karte, Ueberschrift, Liste, Leer, Chip, Knopf, Punkt, feld, LEUCHT } from './schlank';
import { PfeilRang } from './planung/PfeilRang';
import { neueKennung } from '@/lib/kennung';

const WANN: { id: Routine['wann']; label: string; hint: string }[] = [
  { id: 'morgen', label: 'Morgens', hint: 'der Start — vor allem anderen' },
  { id: 'tag', label: 'Tagsüber', hint: 'zwischen den Blöcken' },
  { id: 'abend', label: 'Abends', hint: 'der Abschluss — runterfahren' },
];
const KAT: { id: Routine['kategorie']; label: string; farbe: string }[] = [
  { id: 'gesundheit', label: 'Gesundheit', farbe: LEUCHT.gut },
  { id: 'leben', label: 'Leben', farbe: LEUCHT.beziehung },
  { id: 'business', label: 'Business', farbe: LEUCHT.business },
];
const katFarbe = (k: Routine['kategorie']) => KAT.find(x => x.id === k)!.farbe;

const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const mini: CSSProperties = { width: 24, height: 24, fontSize: TYP.bedien, lineHeight: 1, borderRadius: 7, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,.08)', color: C.inkDim, padding: 0 };
const linkStil = { color: C.inkDim, textDecoration: 'none' as const };
const loeschen: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' };
const pille = (an: boolean, farbe: string): CSSProperties => ({ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim });
const dtKurz = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;

interface Person { speicher: string; name: string }

/**
 * Einheit am Block (28.09.): dieselbe Auswahl wie bei Routinen (Werteliste des Haushalts,
 * „ohne Einheit“, „+ neu“), nur schmal — der Chip zeigt das Kürzel (Selbst. · KDV · UG),
 * das Menü den vollen Namen daneben. Passt so in die schmalen Wochentag-Spalten.
 */
function BlockEinheit({ wert, setzen, einheiten, anlegen }: { wert?: string; setzen: (e: string | undefined) => void; einheiten: readonly string[]; anlegen: (name: string) => Promise<string | null> }) {
  const gesetzt = wert ? einheiten.find(e => e.toLocaleLowerCase('de-DE') === wert.toLocaleLowerCase('de-DE')) ?? wert : null;
  const liste: WahlEintrag<string>[] = useMemo(() => [...einheiten, ...(gesetzt && !einheiten.includes(gesetzt) ? [gesetzt] : [])].map(e => {
    const kurz = einheitKurz(e) ?? e;
    return { id: e, label: kurz, ...(kurz !== e ? { hinweis: e } : {}), punkt: einheitFarbe(e) };
  }), [einheiten, gesetzt]);
  return (
    <Wahl label="Einheit des Blocks" liste={liste} wert={gesetzt} leer="+ Einheit" klein farbe={gesetzt ? einheitFarbe(gesetzt) : EINHEIT_GRAU}
      onWahl={e => setzen(e)} onLeeren={() => setzen(undefined)} leerenLabel="ohne Einheit" onNeu={anlegen} neuMin={EINHEIT_MIN} neuMax={EINHEIT_MAX} />
  );
}

export function RoutinenPlanerView() {
  const heute = localDay();
  const [routinen, setRoutinen] = useState<Routine[]>([]);
  const [bloecke, setBloecke] = useState<Block[]>([]);
  const [geladen, setGeladen] = useState(false);
  /** Laden fehlgeschlagen → nicht speichern, sonst löscht der erste Klick alles. */
  const [ladeFehler, setLadeFehler] = useState(false);
  const [ich, setIch] = useState<string>('');
  const [personen, setPersonen] = useState<Person[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<SpaceId | 'alle'>('alle');
  const [werFilter, setWerFilter] = useState<string>('alle');
  const [neu, setNeu] = useState({ label: '', wann: 'morgen' as Routine['wann'], kat: 'gesundheit' as Routine['kategorie'], space: 'privat' as SpaceId, owner: OWNER_BEIDE, rhythmus: 'taeglich' as Routine['rhythmus'] | 'taeglich', naechstesMal: '', einheit: undefined as string | undefined });
  // Business-Einheit (27.09.) wie bei Zielen und Aufgaben — nur im Business.
  const { einheiten, anlegen: einheitAnlegen } = useEinheiten();
  const [blockPerson, setBlockPerson] = useState<string>('');
  const [blockNeu, setBlockNeu] = useState({ wochentag: 1 as Wochentag, von: '09:00', bis: '18:00', art: 'business' as SpaceId, titel: '', einheit: undefined as string | undefined });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Geteilter Bestand (28.09.): nur Einzeländerungen mit Stand — Routinen über `{ ops }`, Blöcke über `{ bloecke: ops }`
  // (nur die eigenen). Die Refs halten die aktuelle Sicht als Grundlage für „was wurde gerade geändert“.
  const routinenSchreiber = useMemo(() => new ListenSchreiber<Routine>({ pfad: '/api/state/routinen', liste: d => (Array.isArray(d.routinen) ? d.routinen as Routine[] : null) }), []);
  const blockSchreiber = useMemo(() => new ListenSchreiber<Block>({ pfad: '/api/state/routinen', koerper: ops => ({ bloecke: ops }), liste: d => (Array.isArray(d.bloecke) ? d.bloecke as Block[] : null) }), []);
  const routinenRef = useRef<Routine[]>([]);
  const bloeckeRef = useRef<Block[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const zeigeRoutinen = (l: Routine[]) => { routinenRef.current = l; setRoutinen(l); };
  const zeigeBloecke = (l: Block[]) => { bloeckeRef.current = l; setBloecke(l); };
  const nachSenden = (e: SchreibErgebnis<unknown>) => setHinweis(e.ok ? null : e.status === 409 ? 'Jemand hat inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.' : e.fehler ?? 'Nicht gespeichert.');

  useEffect(() => {
    fetch('/api/state/routinen')
      .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
      .then(d => {
        const l: Routine[] = Array.isArray(d.routinen) ? d.routinen : [];
        const b: Block[] = Array.isArray(d.bloecke) ? d.bloecke : [];
        routinenSchreiber.kenne(l); blockSchreiber.kenne(b);
        zeigeRoutinen(l); zeigeBloecke(b);
        setGeladen(true);
      })
      .catch(err => {
        console.error('[MAKE OS] Routinen konnten nicht geladen werden — Speichern gesperrt.', err);
        setLadeFehler(true); setGeladen(true);
      });
    fetch('/api/konto/ich').then(r => r.json()).then(d => {
      const me = d.ich?.speicher as string | undefined;
      if (me) { setIch(me); setBlockPerson(me); }
      setPersonen([...(me ? [{ speicher: me, name: (d.ich?.name ?? me).split(' ')[0] }] : []), ...((d.andere ?? []) as Person[]).map(a => ({ speicher: a.speicher, name: (a.name ?? a.speicher).split(' ')[0] }))]);
    }).catch(() => {});
  }, []);

  function persist(next: Routine[]) {
    if (ladeFehler || !routinenSchreiber.geladen) { setRoutinen(next); return; }
    routinenSchreiber.aendern(routinenRef.current, next);
    zeigeRoutinen(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void routinenSchreiber.senden().then(e => { nachSenden(e); if (e.sicht && !e.nichts) zeigeRoutinen(e.sicht); });
    }, 500);
  }
  /** Nur eigene Blöcke — der Server lehnt fremde ohnehin ab (403). */
  function persistBloecke(next: Block[]) {
    if (ladeFehler || !blockSchreiber.geladen) return;
    blockSchreiber.aendern(bloeckeRef.current, next);
    zeigeBloecke(next);
    clearTimeout(blockTimer.current);
    blockTimer.current = setTimeout(() => {
      void blockSchreiber.senden().then(e => { nachSenden(e); if (e.sicht && !e.nichts) zeigeBloecke(e.sicht); });
    }, 500);
  }
  // Beim Verlassen: noch Offenes senden.
  useEffect(() => () => {
    clearTimeout(saveTimer.current); clearTimeout(blockTimer.current);
    if (routinenSchreiber.hatOffenes) void routinenSchreiber.senden();
    if (blockSchreiber.hatOffenes) void blockSchreiber.senden();
  }, [routinenSchreiber, blockSchreiber]);

  const nameVon = (sp: string) => (sp === OWNER_BEIDE ? 'gemeinsam' : personen.find(p => p.speicher === sp)?.name ?? (sp === ich ? 'ich' : sp));
  const patch = (id: string, p: Partial<Routine>) => persist(routinen.map(x => (x.id === id ? { ...x, ...p, ...(p.space === 'privat' ? { einheit: undefined } : {}) } : x)));

  const add = () => {
    const l = neu.label.trim();
    if (!l) return;
    const r: Routine = {
      id: neueKennung('r'), label: l, wann: neu.wann, kategorie: neu.kat, dauerMin: 15, aktiv: true,
      space: neu.space, owner: neu.owner, rang: naechsterRang(routinen), ...(neu.space === 'business' && neu.einheit ? { einheit: neu.einheit } : {}),
      ...(neu.rhythmus !== 'taeglich' ? { rhythmus: neu.rhythmus } : {}),
      ...(neu.rhythmus !== 'taeglich' && neu.rhythmus !== '3x-woche' && neu.naechstesMal ? { naechstesMal: neu.naechstesMal } : {}),
    };
    persist([...routinen, r]);
    setNeu({ ...neu, label: '', naechstesMal: '' });
  };

  // Sicht: Space und Person
  const sicht = useMemo(() => sortiertNachRang(routinen.filter(r =>
    (spaceFilter === 'alle' || spaceVonRoutine(r) === spaceFilter) &&
    (werFilter === 'alle' || ownerVonRoutine(r) === werFilter || (werFilter !== OWNER_BEIDE && ownerVonRoutine(r) === OWNER_BEIDE)),
  )), [routinen, spaceFilter, werFilter]);
  const aktivN = routinen.filter(r => r.aktiv).length;
  const nBusiness = routinen.filter(r => spaceVonRoutine(r) === 'business').length;

  // Blöcke der gewählten Person
  const meineBloecke = useMemo(() => bloeckeFuer(bloecke, blockPerson), [bloecke, blockPerson]);
  /** Blöcke der anderen Person sind nur zu sehen — ändern kann sie nur sie selbst. */
  const blockEigen = !!ich && blockPerson === ich;
  const blockAnlegen = () => {
    if (!blockPerson || !blockEigen || blockNeu.bis <= blockNeu.von) return;
    const b: Block = { id: neueKennung('bl'), owner: blockPerson, wochentag: blockNeu.wochentag, von: blockNeu.von, bis: blockNeu.bis, art: blockNeu.art, rang: naechsterRang(meineBloecke.filter(x => x.wochentag === blockNeu.wochentag)), ...(blockNeu.titel.trim() ? { titel: blockNeu.titel.trim().slice(0, 60) } : {}), ...(blockNeu.art === 'business' && blockNeu.einheit ? { einheit: blockNeu.einheit } : {}) };
    persistBloecke([...bloecke, b]);
    setBlockNeu({ ...blockNeu, titel: '' });
  };
  const blockBewegen = (b: Block, r: 'auf' | 'ab') => persistBloecke(verschiebe(bloecke, b.id, r, meineBloecke.filter(x => x.wochentag === b.wochentag).map(x => x.id)));

  return (
    <Seite
      titel="Was dich jeden Tag trägt."
      unter={<>Routine-Planer · Privat und Business, je Person und gemeinsam, mit Rhythmus — hier geplant, überall wirksam: im <Link href="/os/kalender?modus=planen" style={linkStil}>Wochenplaner</Link>, in der <Link href="/os/planung" style={linkStil}>Tagesplanung</Link>, auf <Link href="/os/gesundheit" style={linkStil}>Gesundheit</Link> (Häkchen), auf <Link href="/os" style={linkStil}>Home</Link> („Routinen heute“) und im <Link href="/os/gesundheit?s=index" style={linkStil}>Gesundheits-Index</Link>. Pausierte zählen nirgends mit.</>}
      rechts={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={aktivN ? LEUCHT.gut : C.inkLeise}>{aktivN} aktive Routinen</Chip>
        <Chip farbe={SPACE_FARBE.privat}>{routinen.length - nBusiness} Privat</Chip>
        <Chip farbe={SPACE_FARBE.business}>{nBusiness} Business</Chip>
      </div>}
    >
      <PlanerLeiste aktiv="routinen" />

      {/* Neu anlegen */}
      <Karte i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut}>Neue Routine</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neu.label} onChange={e => setNeu({ ...neu, label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="z. B. 10 Min Spazieren nach dem Mittag · Steuererklärung · Arzt …"
            style={{ ...feld, width: 'auto', flex: '1 1 240px', minWidth: 0 }} />
          <select value={neu.space} onChange={e => setNeu({ ...neu, space: e.target.value as SpaceId, kat: e.target.value === 'business' ? 'business' : neu.kat === 'business' ? 'leben' : neu.kat })} aria-label="Space" style={{ ...wahl, color: SPACE_FARBE[neu.space] }}>
            <option value="privat">Privat</option><option value="business">Business</option>
          </select>
          {neu.space === 'business' && <EinheitWahl wert={neu.einheit} setzen={e => setNeu({ ...neu, einheit: e })} einheiten={einheiten} anlegen={einheitAnlegen} titel="Einheit der Routine" />}
          <select value={neu.owner} onChange={e => setNeu({ ...neu, owner: e.target.value })} aria-label="Wer" style={wahl}>
            <option value={OWNER_BEIDE}>gemeinsam</option>
            {personen.map(p => <option key={p.speicher} value={p.speicher}>{p.name}</option>)}
          </select>
          <select value={neu.rhythmus} onChange={e => setNeu({ ...neu, rhythmus: e.target.value as Routine['rhythmus'] })} aria-label="Rhythmus" style={wahl}>
            {RHYTHMEN.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {neu.rhythmus !== 'taeglich' && neu.rhythmus !== '3x-woche' && (
            <input type="date" value={neu.naechstesMal} onChange={e => setNeu({ ...neu, naechstesMal: e.target.value })} aria-label="Nächstes Mal am" title="Nächstes Mal am — leer heißt: ab heute dran" style={{ ...feld, width: 'auto', flex: '0 1 150px', colorScheme: 'dark' }} />
          )}
          <select value={neu.wann} onChange={e => setNeu({ ...neu, wann: e.target.value as Routine['wann'] })} aria-label="Tageszeit" style={wahl}>
            {WANN.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <select value={neu.kat} onChange={e => setNeu({ ...neu, kat: e.target.value as Routine['kategorie'] })} aria-label="Kategorie" style={{ ...wahl, color: katFarbe(neu.kat) }}>
            {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <Knopf onClick={add}>+ Routine</Knopf>
        </div>
      </Karte>

      {/* Filter: Space · Person */}
      <div className="os-auf" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ['--i' as string]: 1 }}>
        {(['privat', 'business', 'alle'] as const).map(k => (
          <button key={k} onClick={() => setSpaceFilter(k)} className="fassbar" style={pille(spaceFilter === k, k === 'alle' ? C.aktiv : SPACE_FARBE[k])}>{k === 'alle' ? 'Alle' : SPACE_LABEL[k]}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.1)', margin: '0 4px' }} />
        <button onClick={() => setWerFilter('alle')} className="fassbar" style={pille(werFilter === 'alle', C.aktiv)}>Alle Personen</button>
        {personen.map(p => <button key={p.speicher} onClick={() => setWerFilter(p.speicher)} className="fassbar" title={`${p.name} und Gemeinsames`} style={pille(werFilter === p.speicher, LEUCHT.puls)}>{p.name}</button>)}
        <button onClick={() => setWerFilter(OWNER_BEIDE)} className="fassbar" style={pille(werFilter === OWNER_BEIDE, LEUCHT.puls)}>nur gemeinsam</button>
      </div>

      {/* Drei Tageszeiten */}
      {!geladen ? (
        <Karte i={2}><Leer>lade …</Leer></Karte>
      ) : WANN.map((w, wi) => {
        const eigene = sicht.filter(r => r.wann === w.id);
        const ids = eigene.map(r => r.id);
        const aktivHier = eigene.filter(r => r.aktiv).length;
        return (
          <Karte key={w.id} i={2 + wi}>
            <Ueberschrift farbe={LEUCHT.puls} rechts={<>{w.hint} · <b style={{ color: aktivHier ? C.inkDim : C.inkLeise, fontWeight: 600 }}>{aktivHier} aktiv</b></>}>{w.label}</Ueberschrift>
            {!eigene.length && <Leer>Noch nichts{spaceFilter !== 'alle' ? ` in ${SPACE_LABEL[spaceFilter]}` : ''} — leg oben eine an.</Leer>}
            <Liste>
              {eigene.map((r, pos) => {
                const sp = spaceVonRoutine(r);
                const owner = ownerVonRoutine(r);
                const rh = r.rhythmus ?? 'taeglich';
                return (
                  <div key={r.id} className="zeile" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: r.aktiv ? 1 : 0.45, transition: 'opacity .2s ease' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button onClick={() => patch(r.id, { aktiv: !r.aktiv })}
                        title={r.aktiv ? 'aktiv — klicken zum Pausieren' : 'pausiert — klicken zum Aktivieren'} aria-label={r.aktiv ? 'aktiv' : 'pausiert'}
                        style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none', padding: 0, background: r.aktiv ? LEUCHT.gut : 'rgba(255,255,255,.12)', position: 'relative', flex: '0 0 auto', boxShadow: r.aktiv ? `0 0 10px ${LEUCHT.gut}33` : undefined, transition: 'background .2s ease' }}>
                        <span style={{ position: 'absolute', top: 2, left: r.aktiv ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: r.aktiv ? C.grund : C.inkDim, transition: 'left .15s ease' }} />
                      </button>
                      <Punkt farbe={katFarbe(r.kategorie)} groesse={8} />
                      <input value={r.label} onChange={e => patch(r.id, { label: e.target.value })} aria-label="Routine"
                        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 500 }} />
                      <Chip farbe={SPACE_FARBE[sp]}>{SPACE_LABEL[sp]}</Chip>
                      {sp === 'business' && <EinheitWahl wert={r.einheit} setzen={e => patch(r.id, { einheit: e })} einheiten={einheiten} anlegen={einheitAnlegen} titel="Einheit der Routine" />}
                      <Chip farbe={owner === OWNER_BEIDE ? LEUCHT.beziehung : LEUCHT.puls}>{nameVon(owner)}</Chip>
                      {rh !== 'taeglich' && <Chip farbe={LEUCHT.agenten}>{rhythmusKurz(rh)}{r.naechstesMal ? ` · ${dtKurz(r.naechstesMal)}` : ''}</Chip>}
                      <PfeilRang label={r.label} obenAus={pos === 0} untenAus={pos === eigene.length - 1} onAuf={() => persist(verschiebe(routinen, r.id, 'auf', ids))} onAb={() => persist(verschiebe(routinen, r.id, 'ab', ids))} />
                      <button onClick={() => persist(routinen.filter(x => x.id !== r.id))} aria-label="Routine löschen" style={loeschen}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, paddingLeft: 46 }}>
                      <select value={sp} onChange={e => patch(r.id, { space: e.target.value as SpaceId })} aria-label="Space" style={{ ...wahl, padding: '5px 8px', color: SPACE_FARBE[sp] }}>
                        <option value="privat">Privat</option><option value="business">Business</option>
                      </select>
                      <select value={owner} onChange={e => patch(r.id, { owner: e.target.value })} aria-label="Wer" style={{ ...wahl, padding: '5px 8px' }}>
                        <option value={OWNER_BEIDE}>gemeinsam</option>
                        {personen.map(p => <option key={p.speicher} value={p.speicher}>{p.name}</option>)}
                        {owner !== OWNER_BEIDE && !personen.some(p => p.speicher === owner) && <option value={owner}>{owner}</option>}
                      </select>
                      <select value={rh} onChange={e => { const v = e.target.value as Routine['rhythmus']; patch(r.id, { rhythmus: v === 'taeglich' ? undefined : v, ...(v === 'taeglich' || v === '3x-woche' ? { naechstesMal: undefined } : {}) }); }} aria-label="Rhythmus" style={{ ...wahl, padding: '5px 8px' }}>
                        {RHYTHMEN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      {rh !== 'taeglich' && rh !== '3x-woche' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}>
                          nächstes Mal
                          <input type="date" value={r.naechstesMal ?? ''} onChange={e => patch(r.id, { naechstesMal: e.target.value || undefined })} aria-label="Nächstes Mal am" style={{ ...wahl, padding: '4px 8px' }} />
                          {!r.naechstesMal && <button onClick={() => patch(r.id, { naechstesMal: naechstesMalNach(rh, heute) ?? undefined })} title="ab heute einen Rhythmus weiter" style={{ ...loeschen, fontSize: 11, color: LEUCHT.agenten }}>ab heute + 1</button>}
                        </span>
                      )}
                      <select value={r.kategorie} onChange={e => patch(r.id, { kategorie: e.target.value as Routine['kategorie'] })} aria-label="Kategorie" style={{ ...wahl, padding: '5px 8px', color: katFarbe(r.kategorie) }}>
                        {KAT.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                      <select value={r.wann} onChange={e => patch(r.id, { wann: e.target.value as Routine['wann'] })} aria-label="Tageszeit" style={{ ...wahl, padding: '5px 8px' }}>
                        {WANN.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim, flex: '0 0 auto' }}>
                        <button onClick={() => patch(r.id, { dauerMin: Math.max(5, r.dauerMin - 5) })} aria-label="5 Minuten weniger" style={mini}>−</button>
                        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'center' }}>{r.dauerMin} min</span>
                        <button onClick={() => patch(r.id, { dauerMin: Math.min(120, r.dauerMin + 5) })} aria-label="5 Minuten mehr" style={mini}>＋</button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </Liste>
          </Karte>
        );
      })}

      {/* Blöcke: die Wochenvorlage je Person — wann Privat, wann Arbeit */}
      <Karte i={5} akzent={SPACE_FARBE.business}>
        <Ueberschrift farbe={SPACE_FARBE.business} rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
          {personen.map(p => <button key={p.speicher} onClick={() => setBlockPerson(p.speicher)} className="fassbar" style={pille(blockPerson === p.speicher, LEUCHT.puls)}>{p.name}</button>)}
        </span>}>Blöcke · Wochenvorlage{blockPerson ? ` · ${nameVon(blockPerson)}` : ''}</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.5 }}>Wann ist Arbeit, wann ist Privat? Je Wochentag Zeitfenster — z. B. Mo–Fr 09–18 Business. Was nicht belegt ist, ist privat.</div>
        {geladen && blockPerson && !meineBloecke.length && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <Leer>Noch keine Blöcke für {nameVon(blockPerson)}.</Leer>
            {blockEigen && <Knopf leise onClick={() => persistBloecke([...bloecke, ...standardBloecke(blockPerson)])}>Mo–Fr 09–18 Business anlegen</Knopf>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
          {WOCHENTAGE.map(wt => {
            const tag = meineBloecke.filter(b => b.wochentag === wt.id);
            return (
              <div key={wt.id} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '8px 10px', minHeight: 64 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, marginBottom: 6 }}>{wt.label}</div>
                {!tag.length && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>privat</div>}
                {tag.map((b, pos) => (
                  <div key={b.id} style={{ padding: '4px 0', borderBottom: pos < tag.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Punkt farbe={SPACE_FARBE[b.art]} groesse={7} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.ink, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${b.von}–${b.bis} ${SPACE_LABEL[b.art]}${b.titel ? ` · ${b.titel}` : ''}`}>{b.von}–{b.bis}{b.titel ? <span style={{ color: C.inkDim }}> {b.titel}</span> : ''}</span>
                    {blockEigen ? <>
                      <button onClick={() => persistBloecke(bloecke.map(x => (x.id === b.id ? (x.art === 'business' ? { ...x, art: 'privat', einheit: undefined } : { ...x, art: 'business' }) : x)))} title={`${SPACE_LABEL[b.art]} — Klick wechselt`} style={{ ...pille(true, SPACE_FARBE[b.art]), padding: '1px 6px', fontSize: 11 }}>{b.art === 'business' ? 'B' : 'P'}</button>
                      <PfeilRang label={`${wt.kurz} ${b.von}`} obenAus={pos === 0} untenAus={pos === tag.length - 1} onAuf={() => blockBewegen(b, 'auf')} onAb={() => blockBewegen(b, 'ab')} />
                      <button onClick={() => persistBloecke(bloecke.filter(x => x.id !== b.id))} aria-label="Block löschen" style={{ ...loeschen, padding: 0 }}>✕</button>
                    </> : <span style={{ ...pille(true, SPACE_FARBE[b.art]), padding: '1px 6px', fontSize: 11 }}>{b.art === 'business' ? 'B' : 'P'}</span>}
                  </div>
                  {/* Einheit (28.09., nur Business): kleines Kürzel — bei eigenen Blöcken per Klick wählbar. */}
                  {b.art === 'business' && (blockEigen
                    ? <div style={{ marginTop: 3, paddingLeft: 13 }}><BlockEinheit wert={b.einheit} setzen={e => persistBloecke(bloecke.map(x => (x.id === b.id ? { ...x, einheit: e } : x)))} einheiten={einheiten} anlegen={einheitAnlegen} /></div>
                    : b.einheit ? <div style={{ marginTop: 2, paddingLeft: 13 }}><span title={`Einheit: ${b.einheit}`} style={{ fontSize: 11, fontWeight: 600, color: einheitFarbe(b.einheit) }}>{einheitKurz(b.einheit)}</span></div> : null)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {hinweis && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 10 }}>{hinweis}</div>}
        {blockPerson && !blockEigen && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12 }}>Die Wochenvorlage von {nameVon(blockPerson)} ändert nur {nameVon(blockPerson)} selbst.</div>}
        {blockPerson && blockEigen && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <select value={blockNeu.wochentag} onChange={e => setBlockNeu({ ...blockNeu, wochentag: Number(e.target.value) as Wochentag })} aria-label="Wochentag" style={wahl}>
              {WOCHENTAGE.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
            <input type="time" value={blockNeu.von} onChange={e => setBlockNeu({ ...blockNeu, von: e.target.value })} aria-label="Von" style={{ ...wahl, colorScheme: 'dark' }} />
            <span style={{ color: C.inkLeise }}>–</span>
            <input type="time" value={blockNeu.bis} onChange={e => setBlockNeu({ ...blockNeu, bis: e.target.value })} aria-label="Bis" style={{ ...wahl, colorScheme: 'dark' }} />
            <select value={blockNeu.art} onChange={e => setBlockNeu({ ...blockNeu, art: e.target.value as SpaceId })} aria-label="Art" style={{ ...wahl, color: SPACE_FARBE[blockNeu.art] }}>
              <option value="business">Business</option><option value="privat">Privat</option>
            </select>
            {blockNeu.art === 'business' && <EinheitWahl wert={blockNeu.einheit} setzen={e => setBlockNeu({ ...blockNeu, einheit: e })} einheiten={einheiten} anlegen={einheitAnlegen} titel="Einheit des Blocks" />}
            <input value={blockNeu.titel} onChange={e => setBlockNeu({ ...blockNeu, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') blockAnlegen(); }} placeholder="Titel (optional)" aria-label="Titel" style={{ ...feld, width: 'auto', flex: '1 1 140px', minWidth: 0, padding: '7px 10px' }} />
            <Knopf onClick={blockAnlegen}>+ Block</Knopf>
          </div>
        )}
      </Karte>
    </Seite>
  );
}

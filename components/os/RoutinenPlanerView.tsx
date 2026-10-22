'use client';

import { useSpace } from '@/hooks/useSpace';
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
// 10.10. (Routinen 2, Rückmeldung aus dem Onboarding: „mehr Einstellungen bei den einzelnen Routinen“): Einstellen über den Routine-Editor
// (components/os/routinen/RoutineEditor.tsx — Rhythmus, mehrmals täglich/Zähler, Uhrzeiten, Erinnerung, Kalender-Block, Zeitraum, Pausen,
// Ziel), Vorlagen zum Übernehmen, Streak und Erfüllungsquote je Routine (rhythmusgerecht, lib/planung/rhythmus.ts `routineStatistik`) und
// die eigene Einstellung „Erinnerungen auch aufs Handy“. Anlegen geht immer über den Editor — eine Stelle für alle Felder.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ListenSchreiber, type SchreibErgebnis } from '@/lib/make-one/liste-stand';
import { localDay } from '@/lib/zeit';
import { SPACE_FARBE, SPACE_LABEL, type SpaceId } from '@/lib/make-one/space-regeln';
import { WOCHENTAGE, OWNER_BEIDE, type Block, type Routine, type Wochentag } from '@/lib/planung/typen';
import { sortiertNachRang, verschiebe, naechsterRang } from '@/lib/planung/rang';
import { bloeckeFuer, standardBloecke, spaceVonRoutine, ownerVonRoutine, erledigtTage, heuteIst, type ZaehlerLog } from '@/lib/planung/routinen';
import { EinheitWahl, useEinheiten } from './aufgaben/Einheit';
import { Wahl, type WahlEintrag } from './crm/Wahl';
import { einheitFarbe, einheitKurz, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { EINHEIT_MIN, EINHEIT_MAX } from '@/lib/planung/einheiten';
import { einheitName } from '@/lib/einheiten';
import { hatPrivatEinheit } from '@/lib/planung/bereich';
import { routineRhythmusKurz, routineStatistik, faelligkeit, tagesZielVon, pausiertAm } from '@/lib/planung/rhythmus';
import { ROUTINEN_VORLAGEN, vorlageAnlegen } from '@/lib/planung/routinen-vorlagen';
import { kalenderBetroffen } from '@/lib/planung/routinen-erinnerung';
import { Seite, Karte, Ueberschrift, Liste, Leer, Chip, Knopf, Punkt, feld, LEUCHT, Schalter, Pillen, ZeileAktionen, useRueckgaengig, Kennzahl, Hinweis, Zeile } from './ui';
import { PfeilRang } from './planung/PfeilRang';
import { neueKennung } from '@/lib/kennung';
import { RoutineEditor, type Kategorie } from './routinen/RoutineEditor';
import { streakText } from './routinen/haken';
import { kennzahlTextVon } from '@/lib/erklaerungen/kennzahlen';
import type { RoutineEntwurf } from '@/lib/planung/routine-entwurf';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';

const WANN: { id: Routine['wann']; label: string; hint: string }[] = [
  { id: 'morgen', label: 'Morgens', hint: 'der Start — vor allem anderen' },
  { id: 'tag', label: 'Tagsüber', hint: 'zwischen den Blöcken' },
  { id: 'abend', label: 'Abends', hint: 'der Abschluss — runterfahren' },
];
const KAT: Kategorie[] = [
  { id: 'gesundheit', label: 'Gesundheit', farbe: LEUCHT.gut },
  // Erholung (10.10.): zählt in Gesundheit › Erholung, wenn abgehakt — andere sehen die Routine nur „Belegt“.
  { id: 'erholung', label: 'Erholung', farbe: LEUCHT.schlaf },
  { id: 'leben', label: 'Leben', farbe: LEUCHT.beziehung },
  { id: 'business', label: 'Business', farbe: LEUCHT.business },
];
const katFarbe = (k: Routine['kategorie']) => KAT.find(x => x.id === k)!.farbe;

const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
const loeschen: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' };
const pille = (an: boolean, farbe: string): CSSProperties => ({ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim });
const dtKurz = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;

interface Person { speicher: string; name: string }
type Editor = { routine: Routine | null; vorgabe?: Partial<RoutineEntwurf> };

/**
 * Einheit am Block (28.09.): dieselbe Auswahl wie bei Routinen (Werteliste des Haushalts,
 * „ohne Einheit“, „+ neu“), nur schmal — der Chip zeigt das Kürzel (Selbst. · KDV · MAKE),
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

/** Kurzfassung unter einer Routine: Tageszeit · Dauer · heute · Streak/Quote · Erinnerung · Kalender · Pause/Zeitraum. */
function zusammenfassung(r: Routine, heute: string, log: Record<string, string[]> | null, zaehler: ZaehlerLog | null, eigen: boolean, zielTitel?: string): string {
  // Uhrzeiten stehen schon im Rhythmus-Chip — ohne Uhrzeit die Tageszeit.
  const teile = [r.uhrzeiten?.length ? '' : WANN.find(w => w.id === r.wann)?.label ?? '', `${r.dauerMin} min`];
  if (eigen && log) {
    const tage = erledigtTage(log, r.id);
    const f = faelligkeit(r, tage, heute);
    const ziel = tagesZielVon(r);
    const ist = heuteIst(r, tage.includes(heute), zaehler, heute);
    if (f.pausiert) teile.push('heute in Pause');
    else if (f.ausserhalb === 'vorher') teile.push(`ab ${dtKurz(f.naechstes)}`);
    else if (f.ausserhalb === 'nachher') teile.push('Zeitraum vorbei');
    else if (ziel > 1) teile.push(`heute ${ist} von ${ziel}`);
    else teile.push(f.faellig ? (f.ueberfaellig ? `fällig seit ${dtKurz(f.naechstes)}` : 'heute dran') : tage.includes(heute) ? 'heute erledigt' : `nächstes Mal ${dtKurz(f.naechstes)}`);
    if (f.proWoche) teile.push(`${f.dieseWoche ?? 0}/${f.proWoche} diese Woche`);
    const s = routineStatistik(r, tage, heute);
    const st = streakText(s.streak, s.einheit);
    if (st) teile.push(st);
    if (s.quote != null) teile.push(`${Math.round(s.quote * 100)} % erfüllt`);
  }
  const p = pausiertAm(r, heute) ?? (r.pausen ?? []).find(x => x.von > heute);
  if (p && !pausiertAm(r, heute)) teile.push(`Pause ab ${dtKurz(p.von)}`);
  if (r.erinnerung) teile.push('erinnert');
  if (r.kalender) teile.push('im Kalender');
  if (zielTitel) teile.push(`zahlt ein auf „${zielTitel}“`);
  return teile.filter(Boolean).join(' · ');
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
  // Sicht Privat · Business (Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat“): der Filter folgt dem Kopf-Schalter
  // (vorher immer „alle“ — Business zeigte Gesundheits- und Familien-Routinen). „Alle“ bleibt als ausdrückliche Wahl.
  const { space: kopfSpace } = useSpace();
  const [spaceFilter, setSpaceFilter] = useState<SpaceId | 'alle'>(kopfSpace);
  useEffect(() => { setSpaceFilter(kopfSpace); }, [kopfSpace]);
  const [werFilter, setWerFilter] = useState<string>('alle');
  const [neuName, setNeuName] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  // Routinen 2 (10.10.): eigener Log + Zähler (Streak, Quote, „heute 5 von 8“) und die eigene Einstellung „aufs Handy“.
  const [log, setLog] = useState<Record<string, string[]> | null>(null);
  const [zaehler, setZaehler] = useState<ZaehlerLog | null>(null);
  const [handy, setHandy] = useState<boolean | null>(null);
  const [handyFehler, setHandyFehler] = useState<string | null>(null);
  const [vorlageFuer, setVorlageFuer] = useState<'ich' | 'beide'>('ich');
  // Ziel-Verknüpfung (10.10.): der Titel des Ziels, auf das eine Routine einzahlt — nur zum Anzeigen.
  const planDaten = useZieleUndMeilensteine();
  const zielTitel = (id?: string) => (id ? planDaten?.ziele.find(z => z.id === id)?.titel : undefined);
  // Business-Einheit (27.09.) wie bei Zielen und Aufgaben — nur im Business.
  const { einheiten, anlegen: einheitAnlegen } = useEinheiten();
  const [blockPerson, setBlockPerson] = useState<string>('');
  const [blockNeu, setBlockNeu] = useState({ wochentag: 1 as Wochentag, von: '09:00', bis: '18:00', art: 'business' as SpaceId, titel: '', einheit: undefined as string | undefined });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Nach dem Speichern auszuführen (Kalender-Blöcke nachziehen) — erst, wenn der Server bestätigt hat. */
  const nachSpeichern = useRef<(() => void)[]>([]);
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
    fetch('/api/planung/routinen-person').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.ok) setHandy(!!d.handy); }).catch(() => {});
  }, [routinenSchreiber, blockSchreiber]); // beide stabil (useMemo ohne Abhängigkeiten) — läuft einmal

  function persist(next: Routine[], danach?: () => void) {
    if (ladeFehler || !routinenSchreiber.geladen) { setRoutinen(next); return; }
    routinenSchreiber.aendern(routinenRef.current, next);
    zeigeRoutinen(next);
    if (danach) nachSpeichern.current.push(danach);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void routinenSchreiber.senden().then(e => {
        nachSenden(e);
        if (e.sicht && !e.nichts) zeigeRoutinen(e.sicht);
        const auftraege = nachSpeichern.current.splice(0);
        if (e.ok) for (const a of auftraege) a();
      });
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
  // Datenschutz-Prüfung N5 (11.10.): Haken und Zähler serverseitig gefiltert — in Business nur die der Business-Routinen, das
  // Gesundheits-Log nur in Privat.
  useEffect(() => {
    fetch(kopfSpace === 'business' ? '/api/state/health?bereich=business' : '/api/state/health?space=privat')
      .then(r => (r.ok ? r.json() : null)).then(d => { if (d) { setLog(d.log ?? {}); setZaehler(d.zaehler ?? {}); } }).catch(() => {});
  }, [kopfSpace]);
  // Beim Verlassen: noch Offenes senden.
  useEffect(() => () => {
    clearTimeout(saveTimer.current); clearTimeout(blockTimer.current);
    if (routinenSchreiber.hatOffenes) void routinenSchreiber.senden();
    if (blockSchreiber.hatOffenes) void blockSchreiber.senden();
  }, [routinenSchreiber, blockSchreiber]);

  const nameVon = (sp: string) => (sp === OWNER_BEIDE ? 'gemeinsam' : personen.find(p => p.speicher === sp)?.name ?? (sp === ich ? 'ich' : sp));
  // Löschen (10.10., Standard Zeilen-Aktionen): wischen bzw. „⋯“ statt eines ✕ in der Zeile — mit 10 s „Rückgängig“.
  const { melden, hinweis: rueckHinweis } = useRueckgaengig();
  const routineLoeschen = (r: Routine) => {
    persist(routinenRef.current.filter(x => x.id !== r.id), r.kalender ? kalenderNachziehen : undefined);
    melden(`Routine „${r.label}“ gelöscht`, () => { if (!routinenRef.current.some(x => x.id === r.id)) persist([...routinenRef.current, r], r.kalender ? kalenderNachziehen : undefined); });
  };
  // Prüf-Fund 11.10.: Aktiv/Kalender (oder Uhrzeit, Rhythmus …) direkt in der Liste geändert → Kalender-Blöcke gleich nachziehen.
  const patch = (id: string, p: Partial<Routine>) => persist(routinen.map(x => (x.id === id ? { ...x, ...p } : x)), kalenderBetroffen(routinen.find(x => x.id === id), p) ? kalenderNachziehen : undefined);

  /** Kalender-Blöcke der eigenen Routinen nachziehen (sonst morgens im Morgenlauf) — Ergebnis als Hinweis. */
  async function kalenderNachziehen() {
    try {
      const r = await fetch('/api/planung/routinen-person', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'kalender' }) });
      const d = await r.json().catch(() => ({}));
      setHinweis(r.ok ? null : `Kalender-Blöcke: ${d.error ?? 'nicht nachgezogen'} — der Morgenlauf versucht es wieder.`);
    } catch { setHinweis('Kalender-Blöcke: keine Verbindung — der Morgenlauf versucht es wieder.'); }
  }

  /** Vom Editor: neue Routine anlegen bzw. eine bestehende ersetzen; Kalender-Blöcke nachziehen, wenn sie betroffen sind. */
  const ausEditor = (r: Routine) => {
    const vorher = routinen.find(x => x.id === r.id);
    const kalenderNoetig = !!r.kalender || !!vorher?.kalender;
    if (!vorher) {
      const neu: Routine = { ...r, id: neueKennung('r'), rang: naechsterRang(routinen) };
      persist([...routinen, neu], kalenderNoetig ? kalenderNachziehen : undefined);
      setNeuName('');
    } else {
      persist(routinen.map(x => (x.id === r.id ? r : x)), kalenderNoetig ? kalenderNachziehen : undefined);
    }
    setEditor(null);
  };

  const vorlageUebernehmen = (id: string) => {
    const v = ROUTINEN_VORLAGEN.find(x => x.id === id);
    if (!v || !ich) return;
    const neu = vorlageAnlegen(v, { owner: vorlageFuer === 'ich' ? ich : OWNER_BEIDE, heute, rangAb: naechsterRang(routinen) });
    persist([...routinen, ...neu]);
    const ids = new Set(neu.map(r => r.id));
    melden(`Vorlage „${v.titel}“ übernommen (${neu.length} Routine${neu.length === 1 ? '' : 'n'})`, () => persist(routinenRef.current.filter(x => !ids.has(x.id))));
  };

  async function handySetzen(an: boolean) {
    setHandyFehler(null);
    const vorher = handy;
    setHandy(an);
    try {
      const r = await fetch('/api/planung/routinen-person', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handy: an }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setHandy(vorher); setHandyFehler(d.error ?? 'Nicht gespeichert.'); }
    } catch { setHandy(vorher); setHandyFehler('Keine Verbindung — nicht gespeichert.'); }
  }

  // Sicht: Space und Person
  const sicht = useMemo(() => sortiertNachRang(routinen.filter(r =>
    (spaceFilter === 'alle' || spaceVonRoutine(r) === spaceFilter) &&
    (werFilter === 'alle' || ownerVonRoutine(r) === werFilter || (werFilter !== OWNER_BEIDE && ownerVonRoutine(r) === OWNER_BEIDE)),
  )), [routinen, spaceFilter, werFilter]);
  const aktivN = routinen.filter(r => r.aktiv).length;
  const nBusiness = routinen.filter(r => spaceVonRoutine(r) === 'business').length;
  // „Dein Rhythmus“: Streak und Quote über die eigenen und gemeinsamen aktiven Routinen (nicht die verdeckten der anderen Person).
  const rhythmus = useMemo(() => {
    if (!log) return null;
    const meine = routinen.filter(r => r.aktiv && !r.belegt && (ownerVonRoutine(r) === OWNER_BEIDE || ownerVonRoutine(r) === ich));
    const s = meine.map(r => ({ r, s: routineStatistik(r, erledigtTage(log, r.id), heute) }));
    const quoten = s.map(x => x.s.quote).filter((q): q is number => q != null);
    const best = s.reduce<typeof s[number] | null>((m, x) => (!m || x.s.streak > m.s.streak ? x : m), null);
    return { quote: quoten.length ? quoten.reduce((a, b) => a + b, 0) / quoten.length : null, best };
  }, [routinen, log, ich, heute]);

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
  const neuOeffnen = () => setEditor({ routine: null, vorgabe: { label: neuName.trim(), ...(spaceFilter !== 'alle' ? { space: spaceFilter, ...(spaceFilter === 'business' ? { kategorie: 'business' as const } : {}) } : {}) } });

  return (
    <Seite
      titel="Routinen"
      unter={<>Was dich jeden Tag trägt — hier geplant, wirksam im <Link href="/os/kalender?modus=planen" style={{ color: C.inkDim, textDecoration: 'none' }}>Wochenplaner</Link>, auf Heute und in der Gesundheit.</>}
      rechts={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={aktivN ? LEUCHT.gut : C.inkLeise}>{aktivN} aktive Routinen</Chip>
        <Chip farbe={SPACE_FARBE.privat}>{routinen.length - nBusiness} Privat</Chip>
        <Chip farbe={SPACE_FARBE.business}>{nBusiness} Business</Chip>
      </div>}
    >

      {/* Neu anlegen — Name, dann der Editor mit allen Einstellungen */}
      <Karte i={0} ton={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut}>Neue Routine</Ueberschrift>
        <form onSubmit={x => { x.preventDefault(); neuOeffnen(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuName} onChange={e => setNeuName(e.target.value)} aria-label="Name der neuen Routine"
            placeholder="z. B. Wasser trinken · Laufen · Steuererklärung …"
            style={{ ...feld, width: 'auto', flex: '1 1 240px', minWidth: 0 }} />
          <Knopf typ="submit">+ Routine einstellen</Knopf>
        </form>
      </Karte>

      {/* Dein Rhythmus: Streak, Quote, Erinnerung aufs Handy (eigene Einstellung) */}
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.puls}>Dein Rhythmus</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
          <Kennzahl klein wert={rhythmus?.best && rhythmus.best.s.streak > 0 ? String(rhythmus.best.s.streak) : undefined} label="Längster Streak"
            unter={rhythmus?.best && rhythmus.best.s.streak > 0 ? `${rhythmus.best.r.label} · ${streakText(rhythmus.best.s.streak, rhythmus.best.s.einheit).replace(/^Streak \d+ /, '')}` : 'noch keiner'} erklaerung={kennzahlTextVon('routinen.streak')} />
          <Kennzahl klein wert={rhythmus?.quote != null ? `${Math.round(rhythmus.quote * 100)} %` : undefined} label="Ø erfüllt"
            unter="je Routine nach ihrem Rhythmus" erklaerung={kennzahlTextVon('routinen.quote')} />
        </div>
        <div style={{ marginTop: 10 }}>
          <Schalter erklaerung="routinen.handy" an={!!handy} aus={handy === null} onChange={v => void handySetzen(v)}>Erinnerungen auch aufs Handy</Schalter>
        </div>
        {handyFehler && <Hinweis art="achtung">{handyFehler}</Hinweis>}
      </Karte>

      {/* Filter: Space · Person — zwei wischbare Zeilen Wahl-Chips (Standard) */}
      <div className="os-auf" style={{ display: 'grid', gap: 8, ['--i' as string]: 1 }}>
        <Pillen einzeilig liste={[{ id: 'privat', label: SPACE_LABEL.privat }, { id: 'business', label: SPACE_LABEL.business }, { id: 'alle', label: 'Alle' }]} aktiv={spaceFilter} onWahl={k => setSpaceFilter(k as typeof spaceFilter)} />
        <Pillen einzeilig farbe={LEUCHT.puls} liste={[{ id: 'alle', label: 'Alle Personen' }, ...personen.map(p => ({ id: p.speicher, label: p.name })), { id: OWNER_BEIDE, label: 'nur gemeinsam' }]} aktiv={werFilter} onWahl={w => setWerFilter(w)} />
      </div>

      {hinweis && <Hinweis art="achtung" rolle="status">{hinweis}</Hinweis>}

      {/* Drei Tageszeiten */}
      {!geladen ? (
        <Karte i={2}><Leer>lade …</Leer></Karte>
      ) : WANN.map((w, wi) => {
        const eigene = sicht.filter(r => r.wann === w.id);
        // Verdeckte Routinen der anderen Person (08.10., „Belegt“) zählen beim Umsortieren nicht mit — ändern kann sie nur sie selbst.
        const bearbeitbar = eigene.filter(r => !r.belegt);
        const ids = bearbeitbar.map(r => r.id);
        const aktivHier = eigene.filter(r => r.aktiv).length;
        return (
          <Karte key={w.id} i={2 + wi}>
            <Ueberschrift farbe={LEUCHT.puls} rechts={<>{w.hint} · <b style={{ color: aktivHier ? C.inkDim : C.inkLeise, fontWeight: 600 }}>{aktivHier} aktiv</b></>} erklaerung="routinen.planer">{w.label}</Ueberschrift>
            {!eigene.length && <Leer>Noch nichts{spaceFilter !== 'alle' ? ` in ${SPACE_LABEL[spaceFilter]}` : ''} — leg oben eine an oder übernimm eine Vorlage.</Leer>}
            <Liste>
              {eigene.map(r => {
                const sp = spaceVonRoutine(r);
                const owner = ownerVonRoutine(r);
                const rh = routineRhythmusKurz(r);
                // Routine der anderen Person: nur „Belegt“ mit Besitz, Bereich und Rhythmus — der Server schickt nichts anderes mit.
                if (r.belegt) return (
                  <div key={r.id} className="zeile" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: r.aktiv ? 0.7 : 0.4 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Punkt farbe={C.inkLeise} groesse={8} />
                      <span style={{ flex: 1, minWidth: 0, color: C.inkDim, fontSize: TYP.body }}>Belegt</span>
                      <Chip farbe={SPACE_FARBE[sp]}>{SPACE_LABEL[sp]}</Chip>
                      <Chip farbe={LEUCHT.puls}>{nameVon(owner)}</Chip>
                      {rh && <Chip farbe={LEUCHT.agenten}>{rh}{r.naechstesMal ? ` · ${dtKurz(r.naechstesMal)}` : ''}</Chip>}
                    </div>
                  </div>
                );
                const pos = ids.indexOf(r.id);
                return (
                  <ZeileAktionen key={r.id} titel={r.label} onLoeschen={() => routineLoeschen(r)}
                    mehr={[
                      { id: 'einstellen', label: 'Einstellen …', tun: () => setEditor({ routine: r }) },
                      { id: 'aktiv', label: r.aktiv ? 'Pausieren' : 'Wieder aktivieren', tun: () => patch(r.id, { aktiv: !r.aktiv }) },
                    ]}>
                  <div className="zeile" style={{ padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)', opacity: r.aktiv ? 1 : 0.45, transition: 'opacity .2s ease' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Schalter erklaerungOhne="Zeile im Planer — der Tooltip sagt „aktiv/pausiert“, die Überschrift des Fensters erklärt Routinen" an={r.aktiv} farbe={LEUCHT.gut} onChange={v => patch(r.id, { aktiv: v })} titel={r.aktiv ? 'aktiv — klicken zum Pausieren' : 'pausiert — klicken zum Aktivieren'} ariaLabel={`Routine ${r.label} aktiv`} />
                      <Punkt farbe={katFarbe(r.kategorie)} groesse={8} />
                      <input value={r.label} onChange={e => patch(r.id, { label: e.target.value })} aria-label="Routine"
                        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 500 }} />
                      <PfeilRang label={r.label} obenAus={pos === 0} untenAus={pos === ids.length - 1} onAuf={() => persist(verschiebe(routinen, r.id, 'auf', ids))} onAb={() => persist(verschiebe(routinen, r.id, 'ab', ids))} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, paddingLeft: 46 }}>
                      <Chip farbe={SPACE_FARBE[sp]}>{SPACE_LABEL[sp]}</Chip>
                      {sp === 'business' && <EinheitWahl wert={r.einheit} setzen={e => patch(r.id, { einheit: e })} einheiten={einheiten} anlegen={einheitAnlegen} titel="Einheit der Routine" />}
                      {sp === 'privat' && hatPrivatEinheit(r) && <Chip farbe={SPACE_FARBE.privat}>{r.einheit}</Chip>}
                      <Chip farbe={owner === OWNER_BEIDE ? LEUCHT.beziehung : LEUCHT.puls}>{nameVon(owner)}</Chip>
                      <Chip farbe={LEUCHT.agenten}>{rh || 'täglich'}{r.naechstesMal ? ` · ${dtKurz(r.naechstesMal)}` : ''}</Chip>
                      <Knopf leise onClick={() => setEditor({ routine: r })} ariaLabel={`Routine ${r.label} einstellen`}>Einstellen</Knopf>
                    </div>
                    <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 6, paddingLeft: 46, lineHeight: 1.5 }}>
                      {zusammenfassung(r, heute, log, zaehler, owner === OWNER_BEIDE || owner === ich, zielTitel(r.zielId))}
                    </div>
                  </div>
                  </ZeileAktionen>
                );
              })}
            </Liste>
          </Karte>
        );
      })}

      {/* Vorlagen zum Übernehmen — neutral, frei änderbar */}
      <Karte i={5}>
        <Ueberschrift farbe={LEUCHT.gut} erklaerung="routinen.vorlagen" rechts={<Pillen liste={[{ id: 'ich' as const, label: 'für mich' }, { id: 'beide' as const, label: 'gemeinsam' }]} aktiv={vorlageFuer} onWahl={v => setVorlageFuer(v)} />}>Vorlagen</Ueberschrift>
        <Liste>
          {ROUTINEN_VORLAGEN.map(v => (
            <Zeile key={v.id} titel={v.titel} unter={v.beschreibung} rechts={<Knopf leise aus={!ich || ladeFehler} onClick={() => vorlageUebernehmen(v.id)} ariaLabel={`Vorlage ${v.titel} übernehmen`}>Übernehmen</Knopf>} />
          ))}
        </Liste>
      </Karte>

      {editor && (
        <RoutineEditor routine={editor.routine} vorgabe={editor.vorgabe} heute={heute} ich={ich} personen={personen} kategorien={KAT}
          einheiten={einheiten} einheitAnlegen={einheitAnlegen} onSpeichern={ausEditor} onZu={() => setEditor(null)} />
      )}


      {/* Blöcke: die Wochenvorlage je Person — wann Privat, wann Arbeit */}
      <Karte i={5} akzent={SPACE_FARBE.business}>
        <Ueberschrift farbe={SPACE_FARBE.business} rechts={<Pillen farbe={LEUCHT.puls} liste={personen.map(p => ({ id: p.speicher, label: p.name }))} aktiv={blockPerson} onWahl={id => setBlockPerson(id)} />}>Blöcke · Wochenvorlage{blockPerson ? ` · ${nameVon(blockPerson)}` : ''}</Ueberschrift>
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
                {!tag.length && <div style={{ fontSize: TYP.bedien, color: 'rgba(255,255,255,.2)' }}>privat</div>}
                {tag.map((b, pos) => (
                  <div key={b.id} style={{ padding: '4px 0', borderBottom: pos < tag.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Punkt farbe={SPACE_FARBE[b.art]} groesse={7} />
                    {/* Block der anderen Person (08.10., „Belegt“): Zeit und Bereich, grau, ohne Titel — der Server schickt nichts anderes mit. */}
                    <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: b.belegt ? C.inkDim : C.ink, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.belegt ? `${b.von}–${b.bis} Belegt` : `${b.von}–${b.bis} ${SPACE_LABEL[b.art]}${b.titel ? ` · ${b.titel}` : ''}`}>{b.von}–{b.bis}{b.belegt ? <span style={{ color: C.inkLeise }}> Belegt</span> : b.titel ? <span style={{ color: C.inkDim }}> {b.titel}</span> : ''}</span>
                    {blockEigen ? <>
                      <button onClick={() => persistBloecke(bloecke.map(x => (x.id === b.id ? (x.art === 'business' ? { ...x, art: 'privat', einheit: undefined } : { ...x, art: 'business' }) : x)))} title={`${SPACE_LABEL[b.art]} — Klick wechselt`} style={{ ...pille(true, SPACE_FARBE[b.art]), padding: '1px 6px', fontSize: TYP.bedien }}>{b.art === 'business' ? 'B' : 'P'}</button>
                      <PfeilRang label={`${wt.kurz} ${b.von}`} obenAus={pos === 0} untenAus={pos === tag.length - 1} onAuf={() => blockBewegen(b, 'auf')} onAb={() => blockBewegen(b, 'ab')} />
                      <button onClick={() => persistBloecke(bloecke.filter(x => x.id !== b.id))} aria-label="Block löschen" style={{ ...loeschen, padding: 0 }}>✕</button>
                    </> : <span style={{ ...pille(true, SPACE_FARBE[b.art]), padding: '1px 6px', fontSize: TYP.bedien }}>{b.art === 'business' ? 'B' : 'P'}</span>}
                  </div>
                  {/* Einheit (28.09., nur Business): kleines Kürzel — bei eigenen Blöcken per Klick wählbar. */}
                  {b.art === 'business' && (blockEigen
                    ? <div style={{ marginTop: 3, paddingLeft: 13 }}><BlockEinheit wert={b.einheit} setzen={e => persistBloecke(bloecke.map(x => (x.id === b.id ? { ...x, einheit: e } : x)))} einheiten={einheiten} anlegen={einheitAnlegen} /></div>
                    : b.einheit ? <div style={{ marginTop: 2, paddingLeft: 13 }}><span title={`Einheit: ${einheitName(b.einheit) ?? b.einheit}`} style={{ fontSize: TYP.bedien, fontWeight: 600, color: einheitFarbe(b.einheit) }}>{einheitKurz(b.einheit)}</span></div> : null)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
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
      {rueckHinweis}
    </Seite>
  );
}

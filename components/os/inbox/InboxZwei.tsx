'use client';

// ─── MAKE OS — Inbox 2: das Lagebild aller Kommunikation (06.10.2026; ersetzt InboxSchlank + /os/inbox/voll) ─────────
// INBOX_KONZEPT.md (Abschnitte 4, 5, 12): oben das LAGEBILD je Bereich (Zahlen anklickbar = Filter) + der ZOE-Satz (nur Vorschlag),
// darunter die Postfach-Leiste (Punkt je Postfach: Smaragd aktuell · gelb verzögert · Granat Anmeldung abgelehnt) und die
// ARBEITSLISTE in fester Reihenfolge: Wiedervorlage fällig → Antworten → Nachfassen fällig → Termine → Geld & Papier → Neue Absender
// (Zulassen · Blocken in der Zeile) → Info & Rundschreiben (eingeklappt, am Stück wegräumen). Rechner: Liste links, Gespräch rechts
// (klebend, mit Kontext); Handy: Liste zuerst, das Gespräch als eigene Ansicht. Tasten: j/k · Enter · e erledigt · s später · a Aufgabe
// · r antworten · Esc. Handy: Zeile nach rechts wischen = erledigt, nach links = später (mit „Rückgängig“).
// Alles kommt gefiltert vom Server (/api/inbox) — die Oberfläche blendet nie bloß aus. Nichts wird ohne Klick zugeordnet oder gesendet.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, KUGEL, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { FACH_LABEL, type FachId } from '@/lib/inbox/faecher';
import { gespraechPfad, sortieren, type LageZeile } from '@/lib/inbox/strom';
import { aufgabeAusGespraech } from '@/lib/inbox/aus-gespraech';
import { neueMailHolen, type NeueMail } from '@/lib/inbox/neue-mail';
import type { Owner } from '@/types/common';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Leerzustand, Knopf, Segmente, Punkt, Hinweis, Spalten, Spalte, useBreit, useHandy, useRueckgaengig, LEUCHT, FlussKarte } from '../ui';
import { useLinkAuswahl } from '../Verlauf';
import { GespraechAnsicht } from './Gespraech';
import { Postfaecher, STUFE_FARBE, STUFE_TEXT } from './Postfaecher';
import { Antwort } from './Antwort';
import { aktion, holen, nameVon, senden, tagIn, zeitKurz, type GespraechZeile, type StromAntwort } from './daten';

type Filter = { fach: FachId | 'nachfassen' | 'wiedervorlage'; bereich: string | null } | null;
const LAGE_TEILE: { feld: keyof Omit<LageZeile, 'bereich'>; text: (n: number) => string; fach: NonNullable<Filter>['fach'] }[] = [
  { feld: 'antworten', text: n => `${n} ${n === 1 ? 'braucht' : 'brauchen'} Antwort`, fach: 'antworten' },
  { feld: 'warten', text: n => `${n} ${n === 1 ? 'wartet' : 'warten'} auf andere`, fach: 'warten' },
  { feld: 'termine', text: n => `${n} Termin${n === 1 ? '' : 'e'}`, fach: 'termine' },
  { feld: 'geld', text: n => `${n} Geld & Papier`, fach: 'geld' },
  { feld: 'neu', text: n => `${n} neue Absender`, fach: 'neu' },
];

/** Zeile mit Wischen (Handy): rechts = erledigt, links = später. Unter 90 px passiert nichts; senkrechtes Scrollen bleibt frei. */
function Wisch({ children, an, rechts, links }: { children: ReactNode; an: boolean; rechts: () => void; links: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; aktiv: boolean } | null>(null);
  if (!an) return <>{children}</>;
  const ende = () => { const d = dx; setDx(0); start.current = null; if (d > 90) rechts(); else if (d < -90) links(); };
  return (
    <div style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={e => { if (e.pointerType === 'touch') start.current = { x: e.clientX, y: e.clientY, aktiv: false }; }}
      onPointerMove={e => { const s = start.current; if (!s) return; const x = e.clientX - s.x, y = e.clientY - s.y; if (!s.aktiv && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y)) s.aktiv = true; if (s.aktiv) setDx(Math.max(-160, Math.min(160, x))); }}
      onPointerUp={ende} onPointerCancel={() => { setDx(0); start.current = null; }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dx > 0 ? 'flex-start' : 'flex-end', padding: '0 18px', background: dx > 0 ? `${KUGEL.smaragd}33` : dx < 0 ? `${LEUCHT.achtung}2a` : 'transparent', color: dx > 0 ? KUGEL.smaragd : LEUCHT.achtung, fontSize: TYP.bedien, fontWeight: 700 }}>
        {dx > 0 ? 'Erledigt' : dx < 0 ? 'Morgen' : ''}
      </div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform .18s ease', background: C.flaeche, position: 'relative' }}>{children}</div>
    </div>
  );
}

export function InboxZwei() {
  const params = useSearchParams();
  const space = params.get('space') === 'privat' || params.get('space') === 'business' ? params.get('space') as 'privat' | 'business' : null;
  const [offenId, setOffenId] = useLinkAuswahl('offen');
  const [ansicht, setAnsicht] = useState<'liste' | 'postfaecher'>(() => (params.get('postfaecher') === '1' ? 'postfaecher' : 'liste'));
  const [bereich, setBereich] = useState<string>('alle');
  const [filter, setFilter] = useState<Filter>(null);
  const [s, setS] = useState<StromAntwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [weg, setWeg] = useState<Set<string>>(new Set());
  const [infoAuf, setInfoAuf] = useState(false);
  const [ich, setIch] = useState('');
  const [neueMail, setNeueMail] = useState<NeueMail | null>(null);
  const [antwortStart, setAntwortStart] = useState<string | null>(null);
  const breit = useBreit();
  const handy = useHandy();
  const { melden, hinweis } = useRueckgaengig();
  const { state, dispatch } = useTasks();

  const url = useMemo(() => {
    const q = new URLSearchParams();
    if (bereich !== 'alle') q.set('bereich', bereich); else if (space) q.set('space', space);
    return `/api/inbox${q.toString() ? `?${q}` : ''}`;
  }, [bereich, space]);

  const laden = useCallback(async () => {
    const r = await holen<StromAntwort>(url);
    if (r.d.ok) { setS(r.d as StromAntwort); setFehler(''); setWeg(new Set()); } else setFehler(String(r.d.fehler ?? 'Die Inbox ließ sich nicht laden.'));
  }, [url]);
  useEffect(() => {
    void laden();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 60_000);
    return () => clearInterval(t);
  }, [laden]);
  useEffect(() => { void holen<{ ich?: { speicher?: string } }>('/api/konto/ich').then(r => { if (typeof r.d.ich?.speicher === 'string') setIch(r.d.ich.speicher); }); }, []);
  // Link aus dem alten Verlauf: `?offen=gmail-<Nachricht>` → das Gespräch dazu.
  useEffect(() => {
    if (offenId?.startsWith('gmail-')) void holen<{ id?: string }>(`/api/inbox/gespraech?gmail=${encodeURIComponent(offenId.slice(6))}`).then(r => setOffenId(r.d.ok && r.d.id ? r.d.id : null));
  }, [offenId, setOffenId]);
  // „In der Inbox schreiben“ aus Akte/Prospecting.
  useEffect(() => { if (params.get('neu') === '1') { const m = neueMailHolen(); if (m) setNeueMail(m); } }, [params]);

  const sichtbar = useMemo(() => (s?.gespraeche ?? []).filter(g => !weg.has(g.id)), [s, weg]);
  const passt = (g: GespraechZeile) => !filter || ((filter.bereich === null || g.bereich === filter.bereich) && (filter.fach === 'nachfassen' ? g.fach === 'warten' && g.nachfassen : filter.fach === 'wiedervorlage' ? g.wiedervorlage === 'faellig' : g.fach === filter.fach));
  const arbeit = sichtbar.filter(g => g.inArbeit && passt(g));
  const gruppen: { id: string; titel: string; farbe: string; liste: GespraechZeile[]; eingeklappt?: boolean }[] = useMemo(() => {
    const wv = arbeit.filter(g => g.wiedervorlage === 'faellig');
    const rest = arbeit.filter(g => g.wiedervorlage !== 'faellig');
    const nurWarten = filter?.fach === 'warten';
    return [
      { id: 'wv', titel: 'Wiedervorlage fällig', farbe: LEUCHT.achtung, liste: sortieren(wv) },
      { id: 'antworten', titel: FACH_LABEL.antworten, farbe: KUGEL.granat, liste: sortieren(rest.filter(g => g.fach === 'antworten')) },
      { id: 'warten', titel: nurWarten ? FACH_LABEL.warten : 'Nachfassen fällig', farbe: LEUCHT.achtung, liste: sortieren(rest.filter(g => g.fach === 'warten' && (nurWarten || g.nachfassen))) },
      { id: 'termine', titel: FACH_LABEL.termine, farbe: LEUCHT.planung, liste: sortieren(rest.filter(g => g.fach === 'termine')) },
      { id: 'geld', titel: FACH_LABEL.geld, farbe: LEUCHT.geld, liste: sortieren(rest.filter(g => g.fach === 'geld')) },
      { id: 'neu', titel: FACH_LABEL.neu, farbe: C.inkDim, liste: sortieren(rest.filter(g => g.fach === 'neu')) },
      { id: 'info', titel: FACH_LABEL.info, farbe: C.inkLeise, liste: sortieren(rest.filter(g => g.fach === 'info')), eingeklappt: !infoAuf && filter?.fach !== 'info' },
    ].filter(x => x.liste.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbeit.map(g => g.id).join('|'), infoAuf, filter]);
  const reihe = gruppen.flatMap(g => (g.eingeklappt ? [] : g.liste));
  const offen = offenId ? sichtbar.find(g => g.id === offenId) ?? null : null;

  const tun = useCallback(async (g: GespraechZeile, was: 'erledigt' | 'spaeter', bis?: string) => {
    setWeg(w => new Set(w).add(g.id));
    if (offenId === g.id) { const i = reihe.findIndex(x => x.id === g.id); setOffenId(reihe[i + 1]?.id ?? null); }
    const r = await aktion(g.id, was, bis ? { bis } : {});
    if (!r.d.ok) { setWeg(w => { const n = new Set(w); n.delete(g.id); return n; }); melden(String(r.d.fehler ?? 'Das ging nicht.')); return; }
    melden(was === 'erledigt' ? `Erledigt: ${g.betreff}` : `Wiedervorlage ${bis?.slice(8, 10)}.${bis?.slice(5, 7)}.: ${g.betreff}`, () => { void aktion(g.id, 'zurueck').then(() => laden()); });
    void laden();
  }, [offenId, reihe, setOffenId, melden, laden]);
  const aufgabeAus = useCallback((g: GespraechZeile) => {
    if (!ich) { melden('Dein Konto lädt noch — gleich noch einmal.'); return; }
    const link = gespraechPfad(g.id);
    if (state.tasks.some(t => t.status !== 'done' && (t.description ?? '').includes(link))) { melden(`Aufgabe gab es schon: ${g.betreff}`); return; }
    const v = aufgabeAusGespraech(g, g.frist?.datum);
    dispatch({ type: 'ADD_TASK', payload: { projectId: state.projects[0]?.id ?? '', ...v, status: 'todo', assignee: ich as Owner, tags: [], subTasks: [], dependencies: [], sortOrder: 0 } });
    melden(`Aufgabe angelegt: ${v.title}`);
  }, [state, dispatch, ich, melden]);
  const screener = async (g: GespraechZeile, was: 'zulassen' | 'blocken') => {
    setWeg(w => new Set(w).add(g.id));
    const r = await aktion(g.id, was);
    melden(String(r.d.ok ? r.d.text : r.d.fehler ?? 'Das ging nicht.'), r.d.ok ? () => { void aktion(g.id, 'offen').then(() => laden()); } : undefined);
    void laden();
  };

  // Tasten (Superhuman-Muster)
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const ziel = ev.target as HTMLElement | null;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ziel?.tagName === 'INPUT' || ziel?.tagName === 'TEXTAREA' || ziel?.tagName === 'SELECT' || ziel?.isContentEditable || ansicht !== 'liste') return;
      const k = ev.key.toLowerCase();
      const i = offenId ? reihe.findIndex(g => g.id === offenId) : -1;
      if (k === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); const n = reihe[Math.min(reihe.length - 1, i + 1)]; if (n) setOffenId(n.id); return; }
      if (k === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); const n = reihe[Math.max(0, i - 1)]; if (n) setOffenId(n.id); return; }
      if (k === 'escape') { setOffenId(null); return; }
      if (k === 'enter' && i < 0 && reihe[0]) { setOffenId(reihe[0].id); return; }
      if (i < 0) return;
      const g = reihe[i];
      if (k === 'e') { ev.preventDefault(); void tun(g, 'erledigt'); }
      else if (k === 's') { ev.preventDefault(); void tun(g, 'spaeter', tagIn(1)); }
      else if (k === 'a') { ev.preventDefault(); aufgabeAus(g); }
      else if (k === 'r') { ev.preventDefault(); setAntwortStart(g.id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reihe, offenId, setOffenId, tun, aufgabeAus, ansicht]);

  const namen = useMemo(() => Object.fromEntries((s?.bereiche ?? []).map(b => [b.id, b.name])), [s]);
  const bereichWort = (b: string | null) => (b ? namen[b] ?? b : 'Ohne Bereich');

  const zeile = (g: GespraechZeile, gruppe: string) => {
    const unter = g.fach === 'warten'
      ? `${g.vonUns ? 'Du hast geschrieben' : 'Automatische Antwort'} · seit ${g.wartetTage} ${g.wartetTage === 1 ? 'Tag' : 'Tagen'} keine Antwort`
      : `${g.frist ? `bis ${g.frist.datum.slice(8, 10)}.${g.frist.datum.slice(5, 7)}. · ` : ''}${g.zuordnung?.firma ? `${g.zuordnung.firma} — ` : g.fach === 'neu' ? `${g.gegenueber.email} — ` : ''}${handy ? g.ausschnitt.slice(0, 80) + (g.ausschnitt.length > 80 ? ' …' : '') : g.ausschnitt}`;
    const inhalt = (
      <Zeile onClick={() => setOffenId(offenId === g.id ? null : g.id)} aktiv={offenId === g.id}
        links={<Punkt farbe={g.ungelesen ? KUGEL.granat : g.fach === 'warten' && g.nachfassen ? LEUCHT.achtung : C.linie} />}
        titel={<><span style={{ fontWeight: g.ungelesen ? 700 : 500 }}>{nameVon(g)}</span><span style={{ color: C.inkLeise }}> · {g.betreff}{g.anzahl > 1 ? ` (${g.anzahl})` : ''}</span></>}
        unter={unter}
        rechts={gruppe === 'neu' && !handy ? (
          <span style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <Knopf leise onClick={() => screener(g, 'zulassen')}>Zulassen</Knopf>
            <Knopf leise onClick={() => screener(g, 'blocken')}>Blocken</Knopf>
          </span>
        ) : <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' }}>{zeitKurz(g.am)}{bereich === 'alle' && (s?.bereiche.length ?? 0) > 1 ? <span style={{ display: 'block' }}>{bereichWort(g.bereich)}</span> : null}</span>} />
    );
    return (
      <div key={g.id}>
        <Wisch an={handy} rechts={() => void tun(g, 'erledigt')} links={() => void tun(g, 'spaeter', tagIn(1))}>{inhalt}</Wisch>
        {gruppe === 'neu' && handy && (
          <div style={{ display: 'flex', gap: 8, padding: '0 0 10px 22px' }}>
            <Knopf leise onClick={() => screener(g, 'zulassen')}>Zulassen</Knopf>
            <Knopf leise onClick={() => screener(g, 'blocken')}>Blocken</Knopf>
          </div>
        )}
      </div>
    );
  };

  const anmeldung = (s?.postfaecher ?? []).filter(p => p.zustand.stufe === 'anmeldung');
  const lageZahl = (s?.lage ?? []).reduce((n, l) => n + l.antworten, 0);
  const nichtsOffen = !!s && s.postfaecher.length > 0 && !arbeit.filter(g => g.fach !== 'info').length && !filter;
  const naechsteWv = (s?.gespraeche ?? []).map(g => g.wiedervorlage).filter((x): x is string => !!x && x !== 'faellig').sort()[0];

  const kopfRechts = (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {ansicht === 'liste' ? <Knopf leise onClick={() => setAnsicht('postfaecher')}>Postfächer</Knopf> : <Knopf leise onClick={() => setAnsicht('liste')}>‹ Zur Inbox</Knopf>}
      {ansicht === 'liste' && <span className="ui-nur-breit"><Knopf leise onClick={async () => { melden('Gleicht ab …'); const r = await senden<{ fehler?: number }>('/api/inbox', { aktion: 'abgleichen' }); melden(r.d.ok ? 'Abgeglichen.' : String(r.d.fehler ?? 'Abgleich ging nicht.')); void laden(); }}>Abgleichen</Knopf></span>}
    </span>
  );

  if (ansicht === 'postfaecher') {
    return (
      <Seite titel="Postfächer" unter="Verbinden, Bereich festlegen, Verbindung erneuern — Passwörter liegen verschlüsselt auf dem Server." rechts={kopfRechts}>
        <Postfaecher onGeaendert={() => void laden()} meldung={t => melden(t)} />
        {hinweis}
      </Seite>
    );
  }

  const liste = (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      {filter && (
        <Hinweis art="info" aktion={<Knopf leise onClick={() => setFilter(null)}>Alle zeigen</Knopf>}>
          Gefiltert: {filter.fach === 'nachfassen' ? 'Nachfassen fällig' : filter.fach === 'wiedervorlage' ? 'Wiedervorlage' : FACH_LABEL[filter.fach]}{filter.bereich !== null ? ` · ${bereichWort(filter.bereich)}` : ''}
        </Hinweis>
      )}
      {nichtsOffen && (
        <Leerzustand symbol="✓" titel="Inbox leer" ton={KUGEL.smaragd}>
          Nichts wartet auf dich.{naechsteWv ? ` Nächste Wiedervorlage am ${naechsteWv.slice(8, 10)}.${naechsteWv.slice(5, 7)}.` : ''}{(s?.lage ?? []).some(l => l.warten) ? ' Einige Gespräche warten auf eine Antwort von anderen.' : ''}
        </Leerzustand>
      )}
      {filter && !arbeit.length && <Karte i={0}><Leer>In diesem Fach ist gerade nichts.</Leer></Karte>}
      {gruppen.map((gr, i) => (
        <Karte key={gr.id} i={i} dicht>
          <Ueberschrift farbe={gr.farbe} rechts={gr.id === 'info' ? (
            <span style={{ display: 'flex', gap: 6 }}>
              <Knopf leise onClick={() => setInfoAuf(x => !x)}>{gr.eingeklappt ? `${gr.liste.length} anzeigen` : 'einklappen'}</Knopf>
              <Knopf leise onClick={async () => { const ids = gr.liste.map(g => g.id); setWeg(w => new Set([...w, ...ids])); const r = await senden<{ erledigt?: number; fehler?: number }>('/api/inbox', { aktion: 'alle-erledigen', ids }); melden(r.d.ok ? `${r.d.erledigt ?? 0} erledigt${r.d.fehler ? ` · ${r.d.fehler} ging nicht` : ''}.` : String(r.d.fehler ?? 'Das ging nicht.')); void laden(); }}>alle erledigen</Knopf>
            </span>
          ) : `${gr.liste.length}`}>{gr.titel}</Ueberschrift>
          {gr.eingeklappt ? <Leer>Newsletter und Automatisches — {gr.liste.length} {gr.liste.length === 1 ? 'Gespräch' : 'Gespräche'}, die keine Entscheidung brauchen.</Leer> : <Liste>{gr.liste.map(g => zeile(g, gr.id))}</Liste>}
        </Karte>
      ))}
    </div>
  );

  const detail = offen ? (
    <Karte i={1} akzent={KUGEL.granat}>
      <GespraechAnsicht key={`${offen.id}-${antwortStart === offen.id ? 'r' : ''}`} id={offen.id} person={ich} meldung={melden} onGeaendert={() => void laden()} onZurueck={() => setOffenId(null)} startAntwort={antwortStart === offen.id} />
    </Karte>
  ) : null;

  return (
    <Seite titel="Inbox" unter={lageZahl > 0 ? `${lageZahl} ${lageZahl === 1 ? 'Gespräch braucht' : 'Gespräche brauchen'} eine Antwort.` : undefined} rechts={kopfRechts}>
      {fehler && <div style={{ marginBottom: 12 }}><Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal</Knopf>}>{fehler}</Hinweis></div>}
      {!s && !fehler && <Karte i={0}><Leer>lädt …</Leer></Karte>}
      {s && !s.postfaecher.length && (
        <Leerzustand symbol="✉" titel="Verbinde dein erstes Postfach" ton={KUGEL.granat} aktion={<Knopf haupt onClick={() => setAnsicht('postfaecher')}>Postfach verbinden</Knopf>}>
          iCloud, IONOS, Google Workspace oder ein anderer Anbieter — MAKE OS holt die Post selbst, sortiert sie in Fächer und zeigt, was gerade passiert.
        </Leerzustand>
      )}
      {/* Mit offenem Gespräch tritt das Lagebild zurück (Esc bzw. „Zurück“ holt es wieder) — das Gespräch steht oben. */}
      {s && s.postfaecher.length > 0 && !offen && (
        <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          {(s.bereiche.length > 1 || bereich !== 'alle') && (
            <Segmente umbrechen liste={[{ id: 'alle', label: 'Alle' }, ...s.bereiche.map(b => ({ id: b.id, label: b.name }))]} aktiv={bereich} onWahl={b => { setBereich(b); setFilter(null); setOffenId(null); }} />
          )}
          <Karte i={0} ton={lageZahl ? KUGEL.granat : KUGEL.smaragd} dicht>
            <Ueberschrift farbe={lageZahl ? KUGEL.granat : KUGEL.smaragd}>Lage</Ueberschrift>
            <div style={{ display: 'grid', gap: 10 }} data-inbox="lage">
              {s.lage.length === 0 && <div style={{ fontSize: TYP.body, color: C.inkDim }}>Nichts offen.</div>}
              {s.lage.map(l => (
                <div key={String(l.bereich)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, marginRight: 4 }}>{bereichWort(l.bereich)}</span>
                  {l.wiedervorlage > 0 && <Knopf leise farbe={LEUCHT.achtung} onClick={() => setFilter({ fach: 'wiedervorlage', bereich: l.bereich })}>{l.wiedervorlage} wieder dran</Knopf>}
                  {LAGE_TEILE.filter(t => l[t.feld] > 0).map(t => <Knopf key={t.feld} leise farbe={t.feld === 'antworten' ? KUGEL.granat : undefined} onClick={() => setFilter({ fach: t.fach, bereich: l.bereich })}>{t.text(l[t.feld])}</Knopf>)}
                  {l.nachfassen > 0 && <Knopf leise farbe={LEUCHT.achtung} onClick={() => setFilter({ fach: 'nachfassen', bereich: l.bereich })}>{l.nachfassen} nachfassen</Knopf>}
                  {!LAGE_TEILE.some(t => l[t.feld] > 0) && !l.wiedervorlage && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>nichts offen</span>}
                </div>
              ))}
              <button type="button" disabled={!s.zoe.gespraech} onClick={() => s.zoe.gespraech && setOffenId(s.zoe.gespraech)} data-inbox="zoe-satz"
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: '6px 0 0', minHeight: 44, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, lineHeight: 1.45, cursor: s.zoe.gespraech ? 'pointer' : 'default' }}>
                <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, display: 'block' }}>ZOE schlägt vor</span>
                {s.zoe.text}{s.zoe.gespraech ? ' ›' : ''}
              </button>
            </div>
          </Karte>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} data-inbox="postfach-leiste">
            {s.postfaecher.map(p => (
              <button key={p.id} type="button" onClick={() => setAnsicht('postfaecher')} title={STUFE_TEXT[p.zustand.stufe]}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '6px 12px', borderRadius: 999, border: `1px solid ${C.linie}`, background: 'rgba(255,255,255,.03)', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' }}>
                <Punkt farbe={STUFE_FARBE[p.zustand.stufe]} />{p.anzeigename}{p.zustand.stufe !== 'aktuell' ? <span style={{ color: C.inkLeise }}>· {STUFE_TEXT[p.zustand.stufe]}</span> : null}
              </button>
            ))}
          </div>
          {anmeldung.length > 0 && (
            <Hinweis art="kritisch" rolle="alert" titel="Verbindung erneuern" aktion={<Knopf onClick={() => setAnsicht('postfaecher')}>Verbindung erneuern</Knopf>}>
              {anmeldung.map(p => p.anzeigename).join(', ')}: der Anbieter hat die Anmeldung abgelehnt. Bei iCloud heißt das meist: nach einem Wechsel des Apple-Passworts ein neues App-spezifisches Passwort eintragen.
            </Hinweis>
          )}
          {neueMail && (
            <Karte i={0}>
              <Antwort allen={false} meldung={t => melden(t)} onZu={() => setNeueMail(null)} onGesendet={() => { setNeueMail(null); void laden(); }}
                v={{ betreff: neueMail.betreff ?? '', von: [], postfaecher: s.postfaecher.filter(p => p.quelle !== 'whatsapp' && p.zustand.stufe !== 'anmeldung').map(p => ({ id: p.id, name: `${p.anzeigename} · ${p.bereichName}` })), start: { an: neueMail.an, text: neueMail.text, betreff: neueMail.betreff } }} />
            </Karte>
          )}
        </div>
      )}
      {/* Rechner: ohne offenes Gespräch die Liste in voller Breite; mit Gespräch Liste ⅓ · Gespräch + Kontext ⅔ (Front-Muster). */}
      {s && s.postfaecher.length > 0 && (breit && offen ? (
        <Spalten verhaeltnis="1:2"><Spalte>{liste}</Spalte><Spalte klebt>{detail}</Spalte></Spalten>
      ) : offen ? detail : liste)}
      {s && s.postfaecher.length > 0 && !offen && <div style={{ marginTop: 18 }}><FlussKarte bereich="inbox" farbe={KUGEL.granat} /></div>}
      {s && s.postfaecher.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 18 }}>Tasten: j/k wandern · e erledigt · s später · a Aufgabe · r antworten{handy ? ' · Wischen: rechts erledigt, links morgen' : ''}</div>}
      {hinweis}
    </Seite>
  );
}


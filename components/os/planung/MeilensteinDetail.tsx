'use client';
// ─── MAKE OS — Meilenstein im Detail (30.09.) ───────────────────────────────
// Kevin: „Wenn wir neue Meilensteine aufmachen, müssen darin neue Untertasks erstellt werden, wir müssen dort
// Informationen teilen können … ein Chat mit Kommentarfunktion für mich und Malin.“ Adresse: WEG.meilenstein(id, r).
//
// Kopf: Titel, Datum, Space/Einheit, Ziel, Messlatte, erledigt, Fortschritt (aus den Aufgaben, sobald es welche gibt —
// lib/planung/meilenstein-aufgaben.ts; sonst von Hand). Bearbeiten/Verschieben/Löschen (mit „Rückgängig“) im EINEN
// Meilenstein-Fenster (components/os/planung/MeilensteinFenster.tsx), hier nur „bearbeiten“ + Abhaken. Abschnitte: Aufgaben (ECHTE Aufgaben in der Liste des
// Meilensteins — derselbe Baum wie auf der Aufgaben-Seite, mit Unteraufgaben, Detail darunter), Verlauf (mit @-Erwähnung
// → Glocke), Dateien & Links (Aufgaben-Ablage an der Liste), Notizen (Stand/409).
// Meilenstein-Felder schreibt usePlanung (Einzeländerungen mit Stand), Aufgaben der TasksContext, den Austausch
// /api/planung/meilenstein. Am Handy: eine Spalte, Abschnitte als Reiter.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Haken, Knopf, Segmente, Leer, Chip, feld, useBreit, LEUCHT } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { SPACE_LABEL, SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import {
  aufgabenVonMeilenstein, aufgabenStand, fortschrittAusAufgaben, wirksamerFortschritt, meilensteinListeId, meilensteinAufgabenSpace,
  meilensteinProjektId, zielVonMeilenstein,
} from '@/lib/planung/meilenstein-aufgaben';
import { RAUM_GRENZEN, type Raum } from '@/lib/planung/meilenstein-raum';
import { baum } from '@/lib/aufgaben/struktur';
import type { Meilenstein } from '@/lib/planung/typen';
import { usePlanung } from './usePlanung';
import { BaumAnsicht } from '../aufgaben/BaumAnsicht';
import { AufgabeDetail } from '../aufgaben/AufgabeDetail';
import { HandlungProvider } from '../aufgaben/Handlung';
import { ProjektDateien } from '../aufgaben/ProjektDateien';
import { NotizAnzeige } from '../aufgaben/Notiz';
import { usePersonen, useIch } from '../aufgaben/hilfe';
import { useMeilensteinFenster } from './MeilensteinFenster';
import { useRueckgaengig } from './Rueckgaengig';
import { BeitragsVerlauf } from '../austausch/BeitragsVerlauf';

type Abschnitt = 'aufgaben' | 'verlauf' | 'dateien' | 'notizen';
const ABSCHNITTE: { id: Abschnitt; label: string }[] = [
  { id: 'aufgaben', label: 'Aufgaben' }, { id: 'verlauf', label: 'Verlauf' }, { id: 'dateien', label: 'Dateien & Links' }, { id: 'notizen', label: 'Notizen' },
];
const istAbschnitt = (v: unknown): v is Abschnitt => ABSCHNITTE.some(a => a.id === v);
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const leise: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '6px 8px', minHeight: 36 };
const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

type RaumSicht = Raum & { notizStand: string };
interface Detail { raum: RaumSicht; listeId: string; projektId: string; spaceId: string }

/** Austausch laden/schreiben — eine Stelle für Verlauf, Notiz, Links. */
function useRaum(id: string) {
  const [d, setD] = useState<Detail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlt, setFehlt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/planung/meilenstein?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404) { setFehlt(true); return null; }
      if (!r.ok || !j.ok) { setFehler(j.error ?? 'Nicht erreichbar.'); return null; }
      const neu: Detail = { raum: j.raum, listeId: j.listeId, projektId: j.projektId, spaceId: j.spaceId };
      setD(neu); setFehlt(false);
      return neu;
    } catch { setFehler('Nicht erreichbar.'); return null; }
  }, [id]);
  const aktion = useCallback(async (aktion: Record<string, unknown>): Promise<boolean> => {
    setLaeuft(true);
    try {
      const r = await fetch('/api/planung/meilenstein', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, aktion }) });
      const j = await r.json().catch(() => ({}));
      if (j.raum) setD(x => (x ? { ...x, raum: j.raum } : x));
      if (!r.ok || !j.ok) { setFehler(j.error ?? 'Nicht gespeichert.'); return false; }
      setFehler(null);
      return true;
    } catch { setFehler('Nicht gespeichert — keine Verbindung.'); return false; } finally { setLaeuft(false); }
  }, [id]);
  return { d, fehler, fehlt, laeuft, laden, aktion, setFehler };
}

export function MeilensteinDetail({ id }: { id: string }) {
  const p = usePlanung('jahr');
  const { state, dispatch, spaces, rehydrate, ready } = useTasks();
  const personen = usePersonen();
  const ich = useIch();
  const breit = useBreit();
  const heute = localDay();
  const raum = useRaum(id);
  const [abschnitt, setAbschnitt] = useState<Abschnitt>('aufgaben');
  const [offen, setOffen] = useState<string | null>(null);
  // Bearbeiten/Verschieben/Löschen (mit „Rückgängig“) über DAS Meilenstein-Fenster des Zeitstrahls — kein zweites Formular.
  const rueck = useRueckgaengig();
  const msFenster = useMeilensteinFenster(p, rueck, heute);
  const m = p.ms.find(x => x.id === id) ?? null;

  // Abschnitt aus der Adresse (?r=) — Links aus der Glocke springen in den Verlauf.
  useEffect(() => { const r = new URLSearchParams(window.location.search).get('r'); if (istAbschnitt(r)) setAbschnitt(r); }, []);
  const wechsle = (a: Abschnitt) => {
    setAbschnitt(a);
    const u = new URL(window.location.href); u.searchParams.set('r', a); window.history.replaceState(null, '', u.toString());
  };

  // Laden: Austausch + Liste (der Server legt sie „lazy“ an) — danach die Aufgaben nachladen, falls die Liste neu ist.
  const { laden } = raum;
  useEffect(() => {
    void laden().then(x => { if (x && !(state.listen ?? []).some(l => l.id === x.listeId)) void rehydrate(); });
    // Zwei Personen im Austausch: alle 20 s nachsehen, solange die Seite sichtbar ist.
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 20_000);
    return () => clearInterval(t);
  }, [laden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abhaken direkt im Kopf (wie in jeder Liste); alles andere im Fenster. Ändern sich Space/Titel/Datum/Mandat, zieht
  // der Server die Liste nach (Projekt/Space, Titel, Reihenfolge) — die Aufgaben danach neu laden.
  const strukturSchluessel = m ? [m.titel, m.faellig, m.space, m.einheit, m.mandatId, m.firmaId].join('|') : '';
  const ersterSchluessel = useRef<string | null>(null);
  useEffect(() => {
    if (!strukturSchluessel) return;
    if (ersterSchluessel.current === null) { ersterSchluessel.current = strukturSchluessel; return; }
    if (ersterSchluessel.current === strukturSchluessel) return;
    ersterSchluessel.current = strukturSchluessel;
    const t = setTimeout(() => { void rehydrate(); void laden(); }, 1500);
    return () => clearTimeout(t);
  }, [strukturSchluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Verschwindet der Meilenstein (gelöscht, hier oder anderswo), fragt die Seite den Server — dann steht „gibt es nicht mehr“ da.
  const war = useRef(false);
  useEffect(() => { if (m) war.current = true; else if (war.current) void laden(); }, [m, laden]);
  const abhaken = (x: Meilenstein) => p.persistMs(p.ms.map(y => (y.id === x.id ? { ...y, ...(x.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 }) } : y)));

  const aufgaben = useMemo(() => aufgabenVonMeilenstein(state, id), [state, id]);
  const stand = aufgabenStand(aufgaben, heute);
  const errechnet = fortschrittAusAufgaben(aufgaben);
  const fortschritt = m ? wirksamerFortschritt(m, state) : 0;
  const spaceId = raum.d?.spaceId ?? (m ? meilensteinAufgabenSpace(m) : 'privat');
  const listeId = meilensteinListeId(id);
  const projektId = raum.d?.projektId ?? meilensteinProjektId(spaceId);
  const baumProjekt = useMemo(() => baum(state, spaceId).find(x => x.id === projektId), [state, spaceId, projektId]);
  const listeDa = (state.listen ?? []).some(l => l.id === listeId);
  const space = spaces.find(s => s.id === spaceId);
  const offeneAufgabe = offen ? state.tasks.find(t => t.id === offen) : undefined;

  const zielId = m ? zielVonMeilenstein(m) : undefined;
  const ziel = zielId ? p.ziele.find(z => z.id === zielId) : undefined;

  // Nicht gefunden erst, wenn der Server es sagt (404) — die Meilensteine laden getrennt von den Zielen.
  if (!m && !raum.fehlt) return <Seite titel="Meilenstein"><Leer>lade …</Leer>{rueck.hinweis}</Seite>;
  if (!m) {
    return (
      <Seite titel="Meilenstein">
        <Karte i={1}>
          <Leer>{raum.fehlt ? 'Diesen Meilenstein gibt es nicht (mehr). Gelöscht? Seine Aufgaben stehen in einer archivierten Liste, Verlauf und Notiz bleiben — „Rückgängig“ unten holt alles zurück.' : 'Meilenstein nicht gefunden.'}</Leer>
          <div style={{ marginTop: 10 }}><Link href={WEG.jahr()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>‹ Ziele & Planung</Link></div>
        </Karte>
        {rueck.hinweis}
      </Seite>
    );
  }

  const sp = meilensteinSpace(m);
  const farbe = sp === 'privat' ? LEUCHT.gut : LEUCHT.business;
  const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;

  return (
    <Seite titel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>Meilenstein</span>}
      unter={<Link href={WEG.jahr()} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>‹ Ziele & Planung</Link>}>
      {p.hinweis && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{p.hinweis}</div>}
      {/* ── Kopf ── */}
      <Karte i={1} akzent={farbe}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ paddingTop: 6 }}><Haken an={m.erledigt} farbe={farbe} label={m.titel} onChange={() => abhaken(m)} /></div>
          <h2 style={{ flex: 1, minWidth: 0, margin: 0, padding: '2px 0', fontFamily: SCHRIFT.display, fontSize: TYP.titel + 2, fontWeight: 700, color: m.erledigt ? C.inkLeise : C.ink, textDecoration: m.erledigt ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{m.titel}</h2>
          <Knopf leise onClick={() => msFenster.oeffne(m.id)}>bearbeiten</Knopf>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: C.inkLeise }}>
          <Chip farbe={SPACE_FARBE[sp]}>{SPACE_LABEL[sp]}</Chip>
          {space && space.id !== 'privat' && <Chip farbe={space.farbe}>{space.label}</Chip>}
          {m.einheit && space?.label !== m.einheit && <Chip farbe={SPACE_FARBE.business}>{m.einheit}</Chip>}
          <span style={{ color: spaet ? LEUCHT.kritisch : undefined }}>{m.faellig ? `${spaet ? 'überfällig seit' : 'fällig'} ${m.faellig.slice(8)}.${m.faellig.slice(5, 7)}.${m.faellig.slice(0, 4)}` : m.zeitfenster ?? 'ohne Datum'}</span>
          {ziel && <span>Ziel: <b style={{ color: C.inkDim, fontWeight: 600 }}>{ziel.titel}</b> · {ziel.erledigt ? 100 : ziel.fortschritt} %</span>}
        </div>
        {m.messlatte && <div style={{ marginTop: 8, fontSize: TYP.bedien, color: C.inkDim }}><span style={mikro}>Messlatte </span>{m.messlatte}</div>}
        {/* Fortschritt: aus den Aufgaben, sobald es welche gibt — sonst von Hand. */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.inkLeise, marginBottom: 5 }}>
              <span>{m.erledigt ? 'erledigt' : errechnet !== null ? `aus ${stand.gesamt} Aufgabe${stand.gesamt === 1 ? '' : 'n'}${stand.unter ? ` + ${stand.unter} Unteraufgaben` : ''}` : 'von Hand („bearbeiten“) — mit Aufgaben rechnet er sich selbst'}</span>
              <b style={{ color: col(fortschritt), fontVariantNumeric: 'tabular-nums' }}>{fortschritt} %</b>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${fortschritt}%`, background: col(fortschritt), transition: 'width .3s ease' }} /></div>
          </div>
          <span style={{ fontSize: 12.5, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{stand.erledigt}/{stand.gesamt} erledigt{stand.faellig ? <b style={{ color: LEUCHT.kritisch }}> · {stand.faellig} fällig</b> : null}</span>
        </div>
        {!m.erledigt && errechnet === 100 && <div style={{ marginTop: 8, fontSize: 12.5, color: LEUCHT.gut }}>Alle Aufgaben erledigt — Meilenstein abhaken?</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <Link href={WEG.aufgaben({ s: spaceId, p: projektId, l: listeId })} style={{ ...leise, color: C.aktiv, textDecoration: 'none' }}>in Aufgaben öffnen ›</Link>
        </div>
      </Karte>

      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '4px 0 12px' }}>
        <Segmente liste={ABSCHNITTE.map(a => {
          // Am Handy kurz („Dateien“), Zahlen ohne Umbruch.
          const label = a.id === 'dateien' && !breit ? 'Dateien' : a.label;
          const n = a.id === 'aufgaben' ? stand.offen : a.id === 'verlauf' ? raum.d?.raum.nachrichten.filter(x => !x.entfernt).length ?? 0 : 0;
          return { id: a.id, label: n ? `${label}\u00a0·\u00a0${n}` : label };
        })} aktiv={abschnitt} onWahl={wechsle} />
      </div>
      {raum.fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginBottom: 8 }}>{raum.fehler}</div>}

      {abschnitt === 'aufgaben' && (
        <HandlungProvider>
          {!ready || !listeDa || !baumProjekt
            ? <Karte i={2}><Leer>{!ready ? 'Aufgaben werden geladen …' : 'Die Aufgaben-Liste wird angelegt …'}</Leer></Karte>
            : <BaumAnsicht projekte={[baumProjekt]} state={state} dispatch={dispatch} raumId={spaceId} offenId={offen} onOeffnen={setOffen} breit={breit} personen={personen} heute={heute} fokus={{ l: listeId }} projektKopf={false} />}
          {offeneAufgabe && (
            <div style={{ marginTop: 12 }}>
              <AufgabeDetail task={offeneAufgabe} state={state} dispatch={dispatch} spaces={spaces} personen={personen} ich={ich} onSchliessen={() => setOffen(null)} onOeffnen={x => setOffen(x)} i={3} />
            </div>
          )}
        </HandlungProvider>
      )}

      {abschnitt === 'verlauf' && (
        <Karte i={2}>
          {!raum.d ? <Leer>lade …</Leer> : (
            <BeitragsVerlauf liste={raum.d.raum.nachrichten} ich={ich} personen={personen} titel="Verlauf" antworten beschaeftigt={raum.laeuft}
              leer="Noch nichts besprochen. Schreib, was ansteht — @Name holt die andere Person dazu."
              platzhalter="Nachricht … @ erwähnt jemanden (⌘ + Enter sendet)" entferntText="Nachricht entfernt"
              onSenden={(text, antwortAuf) => raum.aktion({ art: 'senden', text, ...(antwortAuf ? { antwortAuf } : {}) })}
              onBearbeiten={(nid, text) => raum.aktion({ art: 'bearbeiten', id: nid, text })}
              onEntfernen={nid => raum.aktion({ art: 'entfernen', id: nid })} />
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: C.inkLeise }}>ZOE-Zusammenfassung und Vorschläge für nächste Schritte kommen in einem nächsten Schritt.</div>
        </Karte>
      )}

      {abschnitt === 'dateien' && (
        <>
          <Karte i={2}>{listeDa ? <ProjektDateien projektId={projektId} listeId={listeId} space={sp} /> : <Leer>Die Aufgaben-Liste wird angelegt …</Leer>}</Karte>
          <Karte i={3}><Links raum={raum.d?.raum ?? null} aktion={raum.aktion} laeuft={raum.laeuft} personen={personen} /></Karte>
        </>
      )}

      {abschnitt === 'notizen' && (
        <Karte i={2}>{raum.d ? <Notizen raum={raum.d.raum} aktion={raum.aktion} personen={personen} /> : <Leer>lade …</Leer>}</Karte>
      )}
      {msFenster.fenster}
      {rueck.hinweis}
    </Seite>
  );
}

// ── Links ────────────────────────────────────────────────────────────────────
function Links({ raum, aktion, laeuft, personen }: { raum: RaumSicht | null; aktion: (a: Record<string, unknown>) => Promise<boolean>; laeuft: boolean; personen: readonly { speicher: string; name: string }[] }) {
  const [url, setUrl] = useState('');
  const [titel, setTitel] = useState('');
  const gueltig = /^https?:\/\/\S+$/i.test(url.trim());
  const name = (s: string) => personen.find(p => p.speicher === s)?.name ?? s;
  const links = raum?.links ?? [];
  return (
    <div>
      <div style={{ ...mikro, marginBottom: 6 }}>Links{links.length ? ` · ${links.length}` : ''}</div>
      {!links.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px 0 8px' }}>Noch keine Links — z. B. Angebot, Board, Ordner.</div>}
      {links.map(l => (
        <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', minWidth: 0 }}>
          <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{l.titel}</a>
          <span style={{ fontSize: 12, color: C.inkLeise, flex: '0 0 auto' }}>{name(l.von)}</span>
          <button onClick={() => { if (window.confirm(`Link „${l.titel}“ entfernen?`)) void aktion({ art: 'link-entfernen', id: l.id }); }} aria-label="Link entfernen" style={leise}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" inputMode="url" style={{ ...feld, flex: '2 1 200px', width: 'auto', minWidth: 0, fontSize: TYP.bedien, padding: '8px 12px' }} />
        <input value={titel} onChange={e => setTitel(e.target.value)} placeholder="Titel (optional)" aria-label="Titel des Links" maxLength={RAUM_GRENZEN.linkTitel} style={{ ...feld, flex: '1 1 140px', width: 'auto', minWidth: 0, fontSize: TYP.bedien, padding: '8px 12px' }} />
        <Knopf aus={!gueltig || laeuft} onClick={async () => { if (await aktion({ art: 'link', url: url.trim(), titel: titel.trim() })) { setUrl(''); setTitel(''); } }}>+ Link</Knopf>
      </div>
    </div>
  );
}

// ── Notizen: Ziel, Hintergrund, Entscheidungen (Stand/409) ─────────────────────
function Notizen({ raum, aktion, personen }: { raum: RaumSicht; aktion: (a: Record<string, unknown>) => Promise<boolean>; personen: readonly { speicher: string; name: string }[] }) {
  const [text, setText] = useState<string | null>(null);
  const name = (s: string) => personen.find(p => p.speicher === s)?.name ?? s;
  const zuLang = (text?.length ?? 0) > RAUM_GRENZEN.notiz;
  const letzte = raum.notizVerlauf?.slice(-5).reverse() ?? [];
  const wann = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={mikro}>Notizen</span>
        {raum.notiz && <span style={{ fontSize: 12, color: C.inkLeise }}>zuletzt {name(raum.notiz.von)}, {wann(raum.notiz.am)}</span>}
        {text === null && <button onClick={() => setText(raum.notiz?.text ?? '')} style={{ ...leise, marginLeft: 'auto', color: C.aktiv }}>bearbeiten</button>}
      </div>
      {text === null
        ? <NotizAnzeige text={raum.notiz?.text} leer="Noch keine Notiz — Ziel, Hintergrund, Entscheidungen." />
        : (
          <>
            <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={12} aria-label="Notiz des Meilensteins"
              placeholder={'## Ziel\n…\n\n## Hintergrund\n…\n\n## Entscheidungen\n- …'} style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical', padding: '10px 12px', lineHeight: 1.5, fontFamily: SCHRIFT.mono }} />
            {zuLang && <div role="alert" style={{ fontSize: 12, color: LEUCHT.kritisch, marginTop: 4 }}>Zu lang ({text.length} von {RAUM_GRENZEN.notiz} Zeichen) — so wird nichts gespeichert.</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <Knopf leise onClick={() => setText(null)}>Abbrechen</Knopf>
              <Knopf aus={zuLang} onClick={async () => { if (await aktion({ art: 'notiz', text, stand: raum.notizStand })) setText(null); }}>Speichern</Knopf>
            </div>
          </>
        )}
      {letzte.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.inkLeise, display: 'grid', gap: 2 }}>
          <span style={mikro}>Verlauf der Notiz</span>
          {letzte.map((v, i) => <span key={i}>{name(v.von)} · {wann(v.am)} · {v.zeichen} Zeichen</span>)}
        </div>
      )}
    </div>
  );
}



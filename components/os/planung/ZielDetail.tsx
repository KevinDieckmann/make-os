'use client';
// ─── MAKE OS — Ziel im Detail: die Meilensteine als Kette (01.10.) ──────────
// Kevin (01.10.): „Verknüpfe die Zielebene mit der Meilenstein-Ebene. Wir haben Ziele, und darunter kann man Meilensteine
// planen. Mehrere Meilensteine zu einem Ziel, in Abhängigkeit.“ Adresse: WEG.ziel(id) — für Ziele aus jedem Horizont.
//
// Kopf: Titel, Horizont/Jahr oder Frist, Bereich/Einheit, Messlatte, Fortschritt (aus den Meilensteinen — der Mittelwert ihrer
// wirksamen Fortschritte —, ohne Meilensteine von Hand), Beschreibung (`notiz`). Darunter die Kette: die Meilensteine des Ziels in
// Reihenfolge, jeder nach seinen Vorgängern (`ketteOrdnen`, lib/planung/meilenstein-kette.ts), parallele nebeneinander. Reihenfolge
// per ▲▼ oder Ziehen — eine Abhängigkeit geht vor (was einen Meilenstein vor seinen Vorgänger stellte, wird abgelehnt).
// „+ Meilenstein zu diesem Ziel“ und „+ danach“ öffnen DAS Meilenstein-Fenster, vorbelegt (Ziel, Bereich, Einheit, Datum, Vorgänger).
// Geschrieben wird nur über die vorhandenen Schreibwege (usePlanung: Ziele und Meilensteine als Einzeländerungen mit Stand);
// Meilenstein bearbeiten/löschen im Fenster, Ziel löschen mit „Rückgängig“ (die Meilensteine bleiben, nur ohne Ziel).

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Haken, Knopf, Leer, Chip, Hinweis, feld, LEUCHT } from '../ui';
import { Lichtfaeden } from '../lichtfaeden/Lichtfaeden';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { SPACE_LABEL, SPACE_FARBE, type SpaceId } from '@/lib/make-one/space-regeln';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import { aufgabenVonMeilenstein, aufgabenStand, wirksamerFortschritt, meilensteineVonZiel } from '@/lib/planung/meilenstein-aufgaben';
import { datumVorVorgaenger, ketteOrdnen, nachfolger, verschiebeInKette, wartetText, zielFortschrittLive, zieheInKette } from '@/lib/planung/meilenstein-kette';
import { ZIEL_NOTIZ_MAX } from '@/lib/planung/ziele';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZielHorizont } from '@/lib/planung/typen';
import { usePlanung, type PlanungStand } from './usePlanung';
import { useMeilensteinFenster } from './MeilensteinFenster';
import { useRueckgaengig } from './Rueckgaengig';
import { PfeilRang } from './PfeilRang';
import { loescheZiel } from './ziel-loeschen';

const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const leise: CSSProperties = { display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '0 10px', minHeight: 44 };
const dt = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const dtKurz = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.`;

const HORIZONT_NAME: Record<ZielHorizont, string> = { tag: 'Tagesziel', woche: 'Wochenziel', monat: 'Monatsziel', quartal: 'Quartalsziel', jahr: 'Jahresziel' };
/** Die Seite des Horizonts, auf der das Ziel steht (Brotkrume zurück). */
const horizontWeg = (h: ZielHorizont): string => (h === 'jahr' ? WEG.jahr() : h === 'monat' || h === 'quartal' ? `/os/planung/${h}` : h === 'woche' ? WEG.woche() : WEG.tag());

/** Außen: in welchem Horizont steht das Ziel? Erst dann lädt `usePlanung` genau diesen Horizont (die Probe holt nur die Ziele). */
export function ZielDetail({ id }: { id: string }) {
  const [horizont, setHorizont] = useState<ZielHorizont | 'fehlt' | null>(null);
  useEffect(() => {
    let lebt = true;
    setHorizont(null);
    fetch('/api/state/ziele', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!lebt) return;
      setHorizont(ZIEL_HORIZONTE.find(h => Array.isArray(d[h]) && (d[h] as Ziel[]).some(z => z.id === id)) ?? 'fehlt');
    }).catch(() => { if (lebt) setHorizont('fehlt'); });
    return () => { lebt = false; };
  }, [id]);
  if (horizont === null) return <Seite titel="Ziel"><Leer>lade …</Leer></Seite>;
  if (horizont === 'fehlt') {
    return (
      <Seite titel="Ziel">
        <Karte i={1}>
          <Leer>Dieses Ziel gibt es nicht (mehr). Gelöscht? Seine Meilensteine stehen weiter in Ziele & Planung — nur ohne Ziel.</Leer>
          <div style={{ marginTop: 10 }}><Link href={WEG.jahr()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>‹ Ziele & Planung</Link></div>
        </Karte>
      </Seite>
    );
  }
  return <ZielInhalt id={id} horizont={horizont} />;
}

function ZielInhalt({ id, horizont }: { id: string; horizont: ZielHorizont }) {
  const p = usePlanung(horizont);
  const { state: tasksState } = useTasks();
  const heute = localDay();
  const laufend = Number(heute.slice(0, 4));
  const rueck = useRueckgaengig();
  const msFenster = useMeilensteinFenster(p, rueck, heute);
  // Der jüngste Stand fürs Löschen/„Rückgängig“ (das Zurückholen läuft später).
  const stand = useRef<PlanungStand>(p); stand.current = p;
  const z = p.ziele.find(x => x.id === id) ?? null;
  const [hinweis, setHinweis] = useState<string | null>(null);

  const kinder = useMemo(() => meilensteineVonZiel(id, p.ms), [id, p.ms]);
  const kette = useMemo(() => ketteOrdnen(kinder), [kinder]);
  const live = zielFortschrittLive(id, p.ms, tasksState);
  const offen = kinder.filter(m => !m.erledigt).length;

  // Notiz und Messlatte werden beim Verlassen des Feldes gespeichert (ein Schreiben je Änderung, Stand/409 wie überall).
  const [notiz, setNotiz] = useState<string | null>(null);
  const [messlatte, setMesslatte] = useState<string | null>(null);
  const [titel, setTitel] = useState<string | null>(null);
  const [zugId, setZugId] = useState<string | null>(null);

  if (!p.geladen && !z) return <Seite titel="Ziel"><Leer>lade …</Leer>{rueck.hinweis}</Seite>;
  if (!z) {
    return (
      <Seite titel="Ziel">
        <Karte i={1}>
          <Leer>Dieses Ziel gibt es nicht (mehr). Seine Meilensteine stehen weiter in Ziele & Planung — nur ohne Ziel. „Rückgängig“ unten holt es zurück.</Leer>
          <div style={{ marginTop: 10 }}><Link href={horizontWeg(horizont)} style={{ color: C.aktiv, fontSize: TYP.bedien }}>‹ Ziele & Planung</Link></div>
        </Karte>
        {rueck.hinweis}
      </Seite>
    );
  }

  const zPatch = (patch: Partial<Ziel>) => p.persistZiele(p.ziele.map(x => (x.id === z.id ? { ...x, ...patch, ...(x.abgeleitetVon ? { angepasst: true } : {}) } : x)));
  const abgeleitet = !!z.abgeleitetVon && !z.angepasst;
  const space: SpaceId | undefined = z.space;
  const farbe = space ? SPACE_FARBE[space] : LEUCHT.schlaf;
  const fortschritt = z.erledigt ? 100 : live ?? z.fortschritt;
  const jahr = zielJahr(z, laufend);

  /** Vorgabe fürs Fenster: Ziel, Bereich, Einheit — Datum aus der Frist, sonst aus dem Horizont/Jahr (wie die Liste). */
  const vorgabe = (extra: { faellig?: string; wartetAuf?: string[] } = {}) => ({
    zielId: z.id,
    space: space ?? ('business' as const),
    ...(space !== 'privat' && z.einheit ? { einheit: z.einheit } : {}),
    faellig: extra.faellig ?? z.termin ?? (horizont === 'jahr' ? (jahr === laufend ? heute : `${jahr}-01-15`) : p.zr.bis),
    ...(extra.wartetAuf ? { wartetAuf: extra.wartetAuf } : {}),
  });

  const abhaken = (m: Meilenstein) => p.persistMs(p.ms.map(y => (y.id === m.id ? { ...y, ...(m.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 }) } : y)));
  const bewegen = (m: Meilenstein, r: 'auf' | 'ab') => {
    const neu = verschiebeInKette(p.ms, kette.reihe, m.id, r);
    if (neu) { setHinweis(null); p.persistMs(neu); } else setHinweis('Diese Reihenfolge geht nicht — der Nachbar ist ein Vorgänger oder Nachfolger (die Abhängigkeit geht vor).');
  };
  const ziehen = (id1: string, auf: string) => {
    const neu = zieheInKette(p.ms, kette.reihe, id1, auf);
    if (neu) { setHinweis(null); p.persistMs(neu); } else if (id1 !== auf) setHinweis('Diese Reihenfolge geht nicht — ein Meilenstein kann nicht vor einen stehen, auf den er wartet.');
  };
  const messlatteText = messlatte ?? z.messlatte ?? '';
  const notizText = notiz ?? z.notiz ?? '';

  const karte = (m: Meilenstein) => {
    const sp = meilensteinSpace(m);
    const bf = sp === 'privat' ? LEUCHT.gut : LEUCHT.business;
    const wartetNoch = wartetText(m, p.ms);
    const frueher = datumVorVorgaenger(m, p.ms);
    const danach = nachfolger(m.id, p.ms);
    const mv = wirksamerFortschritt(m, tasksState);
    const as = aufgabenStand(aufgabenVonMeilenstein(tasksState, m.id));
    const spaet = !!m.faellig && m.faellig < heute && !m.erledigt;
    const status = m.erledigt ? { t: '✓ erledigt', f: LEUCHT.gut } : wartetNoch ? { t: 'wartet', f: LEUCHT.achtung } : { t: 'dran', f: C.aktiv };
    const obenAus = !verschiebeInKette(p.ms, kette.reihe, m.id, 'auf');
    const untenAus = !verschiebeInKette(p.ms, kette.reihe, m.id, 'ab');
    return (
      <div key={m.id} id={`ziel-${m.id}`} draggable onDragStart={e => { setZugId(m.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', m.id); }}
        onDragEnd={() => setZugId(null)} onDragOver={e => { if (zugId && zugId !== m.id) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); if (zugId) ziehen(zugId, m.id); setZugId(null); }}
        style={{ flex: '1 1 280px', minWidth: 0, maxWidth: '100%', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.04)', border: `1px solid ${m.erledigt ? 'rgba(255,255,255,.06)' : `${status.f}44`}`, opacity: zugId === m.id ? 0.5 : 1 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ paddingTop: 3 }}><Haken an={m.erledigt} farbe={bf} label={m.titel} onChange={() => abhaken(m)} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={WEG.meilenstein(m.id)} title="Meilenstein öffnen — Aufgaben, Verlauf, Dateien, Notizen"
              style={{ fontWeight: 600, fontSize: TYP.body, color: m.erledigt ? C.inkLeise : C.ink, textDecoration: m.erledigt ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{m.titel}</Link>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: TYP.bedien, color: C.inkLeise }}>
              <span style={{ color: status.f, fontWeight: 700 }}>{status.t}</span>
              {m.faellig ? <span style={{ color: spaet ? LEUCHT.kritisch : undefined }}>{spaet ? 'überfällig seit ' : ''}{dt(m.faellig)}</span> : <span>{m.zeitfenster ?? 'ohne Datum'}</span>}
              {as.gesamt > 0 && <Link href={WEG.meilenstein(m.id, 'aufgaben')} style={{ color: 'inherit' }}>{as.erledigt}/{as.gesamt} Aufgaben</Link>}
            </div>
            {wartetNoch && <div style={{ marginTop: 6, fontSize: TYP.bedien, color: LEUCHT.achtung }}>{wartetNoch}</div>}
            {frueher.length > 0 && <div role="status" style={{ marginTop: 4, fontSize: TYP.bedien, color: LEUCHT.achtung }}>Hinweis: liegt vor dem Datum von „{frueher[0].titel}“ ({dtKurz(frueher[0].faellig!)}).</div>}
            {danach.length > 0 && <div style={{ marginTop: 4, fontSize: TYP.bedien, color: C.inkLeise }}>danach: {danach.map((x, k) => <Fragment key={x.id}>{k > 0 ? ', ' : ''}<a href={`#ziel-${x.id}`} style={{ color: 'inherit' }}>{x.titel}</a></Fragment>)}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <span style={{ flex: 1, height: 5, borderRadius: 4, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${mv}%`, background: col(mv), transition: 'width .3s ease' }} /></span>
              <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, color: col(mv), fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>{mv} %</b>
            </div>
          </div>
          <PfeilRang label={m.titel} obenAus={obenAus} untenAus={untenAus} onAuf={() => bewegen(m, 'auf')} onAb={() => bewegen(m, 'ab')} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, marginTop: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => msFenster.oeffneNeu(vorgabe({ wartetAuf: [m.id], faellig: m.faellig }))} style={leise} title="Neuer Meilenstein, der auf diesen wartet">+ danach</button>
          <button type="button" onClick={() => msFenster.oeffne(m.id)} style={leise} title="Bearbeiten, verschieben, Vorgänger ändern">bearbeiten</button>
        </div>
      </div>
    );
  };

  return (
    <Seite titel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>Ziel</span>}
      unter={<><Link href={horizontWeg(horizont)} style={{ color: C.inkLeise, textDecoration: 'none' }}>‹ Ziele & Planung</Link> › {HORIZONT_NAME[horizont]}</>}>
      {p.hinweis && <Hinweis art="achtung" rolle="status">{p.hinweis}</Hinweis>}
      {/* ── Kopf ── */}
      <Karte i={1} akzent={farbe}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ paddingTop: 6 }}><Haken an={!!z.erledigt} farbe={farbe} label={z.titel} onChange={() => zPatch(z.erledigt ? { erledigt: false, erledigtAm: undefined } : { erledigt: true, erledigtAm: heute, fortschritt: 100 })} /></div>
          {titel !== null
            ? <input autoFocus value={titel} aria-label="Titel bearbeiten" maxLength={200} onChange={e => setTitel(e.target.value)}
                onBlur={() => { if (titel.trim() && titel.trim() !== z.titel) zPatch({ titel: titel.trim() }); setTitel(null); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTitel(null); }}
                style={{ ...feld, flex: 1, minWidth: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel + 2, fontWeight: 700 }} />
            : <h2 style={{ flex: 1, minWidth: 0, margin: 0, padding: '2px 0', fontFamily: SCHRIFT.display, fontSize: TYP.titel + 2, fontWeight: 700, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{z.titel}</h2>}
          {titel === null && <Knopf leise onClick={() => setTitel(z.titel)}>umbenennen</Knopf>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: TYP.bedien, color: C.inkLeise }}>
          <Chip farbe={farbe}>{HORIZONT_NAME[horizont]}{horizont === 'jahr' ? ` ${jahr}` : ''}</Chip>
          {space && <Chip farbe={SPACE_FARBE[space]}>{SPACE_LABEL[space]}</Chip>}
          {z.einheit && space === 'business' && <Chip farbe={SPACE_FARBE.business}>{z.einheit}</Chip>}
          {z.termin && <span>Frist {dt(z.termin)}</span>}
          {z.zielwert ? <span>Zahlenziel {z.zielwert}</span> : null}
          {abgeleitet && <span style={{ color: LEUCHT.agenten }}>abgeleitet aus dem Jahresziel</span>}
          {z.erledigt && z.erledigtAm && <span>erledigt {dt(z.erledigtAm)}</span>}
        </div>
        <label style={{ display: 'grid', gap: 6, marginTop: 12, ...mikro }}>Messlatte
          <input value={messlatteText} onChange={e => setMesslatte(e.target.value)} maxLength={300} placeholder="Woran messen wir „erreicht“?"
            onBlur={() => { if (messlatte !== null && messlatte.trim() !== (z.messlatte ?? '')) zPatch({ messlatte: messlatte.trim() || undefined }); setMesslatte(null); }}
            style={{ ...feld, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }} />
        </label>
        <label style={{ display: 'grid', gap: 6, marginTop: 10, ...mikro }}>Beschreibung
          <textarea value={notizText} onChange={e => setNotiz(e.target.value.slice(0, ZIEL_NOTIZ_MAX))} rows={3} placeholder="Worum geht es, was soll am Ende stehen?"
            onBlur={() => { if (notiz !== null && notiz.trim() !== (z.notiz ?? '')) zPatch({ notiz: notiz.trim() || undefined }); setNotiz(null); }}
            style={{ ...feld, resize: 'vertical', minHeight: 70, fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{notizText.length}/{ZIEL_NOTIZ_MAX}</span>
        </label>
        {/* Fortschritt: aus den Meilensteinen, sobald es welche gibt — sonst von Hand. */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 5 }}>
            <span>{z.erledigt ? 'erledigt' : live !== null ? `aus ${kinder.length} Meilenstein${kinder.length === 1 ? '' : 'en'} · ${offen} offen` : 'von Hand — mit Meilensteinen rechnet er sich selbst'}</span>
            <b style={{ color: col(fortschritt), fontVariantNumeric: 'tabular-nums' }}>{fortschritt} %</b>
          </div>
          {live === null && !z.erledigt
            ? <input type="range" min={0} max={100} step={5} value={z.fortschritt} aria-label="Fortschritt" onChange={e => zPatch({ fortschritt: Number(e.target.value) })} style={{ width: '100%', accentColor: col(z.fortschritt) }} />
            : <div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${fortschritt}%`, background: col(fortschritt), transition: 'width .3s ease' }} /></div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {abgeleitet
            ? <Knopf leise onClick={() => zPatch({ angepasst: true })}>vom Jahresziel lösen</Knopf>
            : <Knopf leise onClick={() => { loescheZiel(stand, z.id, rueck); }}>Ziel löschen</Knopf>}
        </div>
      </Karte>

      {/* ── Lichtfäden (03.10.): alles, was auf dieses Ziel einzahlt — Meilensteine, Aufgaben, Termine, Deals, Rechnungen mit
           demselben Mandat/derselben Firma — als Fäden; Tippen auf einen Meilenstein fächert ihn auf. Abgeleitete Ziele zeigen
           ihr Jahresziel (dort laufen die Stränge zusammen). ── */}
      <Lichtfaeden wurzel={`ziel:${abgeleitet && z.abgeleitetVon ? z.abgeleitetVon : z.id}`} titel="Lichtfäden dieses Ziels" i={2} />

      {/* ── Die Kette ── */}
      <Karte i={3} akzent={LEUCHT.achtung}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={kinder.length ? `${offen} offen · ${kinder.length - offen} erledigt` : undefined}>Meilensteine — die Kette zu diesem Ziel</Ueberschrift>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, flex: '1 1 260px' }}>Von oben nach unten: erst die Vorgänger, dann die, die auf sie warten; was nebeneinander steht, geht gleichzeitig. Reihenfolge per ▲▼ oder Ziehen.</span>
          <Knopf onClick={() => msFenster.oeffneNeu(vorgabe())}>+ Meilenstein zu diesem Ziel</Knopf>
        </div>
        {hinweis && <div style={{ marginBottom: 8 }}><Hinweis art="achtung" rolle="status">{hinweis}</Hinweis></div>}
        {!kinder.length
          ? <Leer>Noch kein Meilenstein. Teile das Ziel in Schritte — mit „+ Meilenstein zu diesem Ziel“ (Datum, erste Aufgaben) und lege fest, was auf was wartet.</Leer>
          : kette.stufen.map((stufe, si) => (
            <Fragment key={si}>
              {si > 0 && <div aria-hidden style={{ textAlign: 'center', color: C.inkLeise, fontSize: 18, lineHeight: '24px' }}>↓</div>}
              <div role="group" aria-label={stufe.length > 1 ? `Stufe ${si + 1}, gleichzeitig möglich` : `Stufe ${si + 1}`}>
                {stufe.length > 1 && <div style={{ ...mikro, margin: '2px 0 6px' }}>gleichzeitig möglich</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{stufe.map(m => karte(m))}</div>
              </div>
            </Fragment>
          ))}
      </Karte>
      {msFenster.fenster}
      {rueck.hinweis}
    </Seite>
  );
}

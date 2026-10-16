'use client';

// ─── Heute: Top 3 des Tages (10.10., Branch `heute-top3`) ───────────────────────────────────────────────────────────────────────
// Kevin 08.10. (Fragebogen): „Top-3 Prioritäten, von ZOE vorgeschlagen“ · „Täglich Top-3 festlegen; Prioritäten (Eisenhower) sichtbarer“.
// Drei Zustände in EINER Karte:
//   Vorschlag    ZOE schlägt die drei wichtigsten Aufgaben vor (Regelwerk auf dem Server, mit Grund und Eisenhower-Zeichen) — „Übernehmen“
//                oder „Anpassen“ (tauschen, weglassen, selbst wählen).
//   Festgelegt   die drei des Tages mit Haken; abgehakt wird über den vorhandenen Aufgaben-Schreibweg (TOGGLE_TASK, mit Rückgängig dort).
//   Anpassen     eine Aufgabe tauschen oder hinzufügen aus den besten Aufgaben dieses Bereichs; Festlegen speichert (Stand/409).
// Die Karte gehört zu EINEM Bereich (Privat oder Business, wie Heute): der Server liefert nie den anderen. Kein Modell, nichts verlässt das Haus.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP, LEUCHT, SCHRIFT } from '@/lib/make-one/design';
import { SPACE_FARBE, SPACE_LABEL } from '@/lib/make-one/space-regeln';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Haken, Knopf, Hinweis, Chip, feld } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { WEG } from '@/lib/wege';
import { suchPasst } from '@/lib/text/such-norm';
import { EisenhowerZeichen } from '../aufgaben/Zeichen';
import { TOP3_MAX, type Top3Block, type Top3Zeile, type TopBereich } from '@/lib/heute/top3';
import { heuteGeaendert } from './Briefing';

const link = { color: C.inkLeise, textDecoration: 'none' } as const;
const uhr = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const kurzDatum = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
/** Die kleine Zeile unter dem Titel: warum — oder, wenn nichts drängt, die Deadline; dazu das Projekt. */
const unterText = (z: Top3Zeile) => [z.grund || (z.faellig ? `bis ${kurzDatum(z.faellig)}` : ''), z.projekt].filter(Boolean).join(' · ');

/** `vorgabe`: ein schon geladener Block als Startzustand (Render-Test, Vorschau) — im Betrieb leer, die Karte lädt dann selbst. */
export function Top3Karte({ i, sicht, titel, vorgabe }: { i: number; sicht: TopBereich; titel?: string; vorgabe?: Top3Block }) {
  const router = useRouter();
  const { state, dispatch } = useTasks();
  const [block, setBlock] = useState<Top3Block | null | undefined>(vorgabe);
  const [meldung, setMeldung] = useState('');
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState<string[]>([]);
  /** Welche Zeile gerade getauscht wird (Index im Entwurf); gleich der Länge = eine Aufgabe hinzufügen; null = nichts offen. */
  const [waehlen, setWaehlen] = useState<number | null>(null);
  const [suche, setSuche] = useState('');

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/heute/top3?space=${sicht}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() as { bereiche?: Partial<Record<TopBereich, Top3Block>> } : null;
      setBlock(d?.bereiche?.[sicht] ?? null);
    } catch { setBlock(prev => prev ?? null); }
  }, [sicht]);
  useEffect(() => { setBlock(undefined); setBearbeiten(false); setWaehlen(null); void laden(); }, [laden]);
  // Nach einem Wechsel des Fensters/Tabs frisch holen — der Vorschlag ändert sich, wenn Aufgaben erledigt oder neu angelegt wurden.
  useEffect(() => {
    const frisch = () => { if (document.visibilityState === 'visible') void laden(); };
    document.addEventListener('visibilitychange', frisch);
    window.addEventListener('focus', frisch);
    return () => { document.removeEventListener('visibilitychange', frisch); window.removeEventListener('focus', frisch); };
  }, [laden]);

  const liveErledigt = (z: Top3Zeile) => { const t = state.tasks.find(x => x.id === z.id); return t ? t.status === 'done' : z.erledigt; };
  const nachId = useMemo(() => new Map([...(block?.auswahl ?? []), ...(block?.vorschlag ?? []), ...(block?.festgelegt?.zeilen ?? [])].map(z => [z.id, z] as const)), [block]);

  const senden = async (body: { aktion: 'festlegen'; ids: string[] } | { aktion: 'zuruecksetzen' }) => {
    try {
      const r = await fetch('/api/heute/top3', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, space: sicht, stand: block?.stand ?? '' }) });
      const d = await r.json().catch(() => ({})) as { block?: Top3Block; error?: string };
      if (d.block) setBlock(d.block);
      if (r.ok && d.block) { setBearbeiten(false); setWaehlen(null); setMeldung(''); heuteGeaendert(); }
      else setMeldung(d.error ?? 'Nicht gespeichert — bitte noch einmal versuchen.');
    } catch { setMeldung('Nicht gespeichert — keine Verbindung.'); }
  };

  if (block === null) return <Karte i={i}><Ueberschrift farbe={SPACE_FARBE[sicht]} erklaerung="heute.top3">{titel ?? `Top 3 heute · ${SPACE_LABEL[sicht]}`}</Ueberschrift><Leer>Die Top 3 sind gerade nicht erreichbar.</Leer></Karte>;

  const festgelegt = block?.festgelegt ?? null;
  const vorschlag = (block?.vorschlag ?? []).filter(z => !liveErledigt(z));
  const rechtsLink = <Link href={sicht === 'privat' ? '/os/aufgaben?space=privat' : '/os/aufgaben?space=business'} style={link}>Aufgaben ›</Link>;
  // „Top 3“ nur mit drei Einträgen (16.10., Abnahme 2 · C6: „Top 3 heute“ über zwei Zeilen) — mit einem oder zwei Einträgen heißt sie „Wichtig heute“ (leer bleibt „Top 3“: bis zu drei wählen).
  const anzahlZeilen = festgelegt ? festgelegt.zeilen.length : vorschlag.length;
  const kopf = titel ?? `${anzahlZeilen === 1 || anzahlZeilen === 2 ? 'Wichtig heute' : 'Top 3 heute'} · ${SPACE_LABEL[sicht]}`;

  const anpassen = (ids: string[]) => { setEntwurf(ids); setBearbeiten(true); setWaehlen(null); setSuche(''); setMeldung(''); };
  const waehle = (id: string) => {
    setEntwurf(e => (waehlen !== null && waehlen < e.length ? e.map((x, k) => (k === waehlen ? id : x)) : [...e, id].slice(0, TOP3_MAX)));
    setWaehlen(null); setSuche('');
  };
  const oeffnen = (z: Top3Zeile) => () => router.push(WEG.aufgabe(z.id));

  // ── Zeilen ──
  const mark = (z: Top3Zeile) => <EisenhowerZeichen q={z.quadrant} kritisch={z.kritisch && !liveErledigt(z)} />;
  const nummer = (n: number) => <span aria-hidden style={{ width: 24, height: 24, borderRadius: 12, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, color: SPACE_FARBE[sicht], border: `1px solid ${SPACE_FARBE[sicht]}66` }}>{n}</span>;

  let inhalt: React.ReactNode;
  if (block === undefined) inhalt = <Leer>lade …</Leer>;
  else if (bearbeiten) {
    const zeilen = entwurf.map(id => nachId.get(id)).filter((z): z is Top3Zeile => !!z);
    const kandidaten = block.auswahl.filter(z => !entwurf.includes(z.id) && suchPasst([z.titel, z.projekt], suche));
    inhalt = (
      <>
        <Liste>
          {zeilen.length === 0 && <Leer>Noch nichts gewählt — „Aufgabe hinzufügen“ zeigt die besten offenen Aufgaben.</Leer>}
          {zeilen.map((z, k) => (
            <Zeile key={z.id} links={nummer(k + 1)} titel={z.titel} unter={unterText(z)}
              rechts={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{mark(z)}<Knopf leise onClick={() => { setWaehlen(waehlen === k ? null : k); setSuche(''); }}>Tauschen</Knopf><Knopf leise ariaLabel={`„${z.titel}“ weglassen`} onClick={() => { setEntwurf(e => e.filter((_, j) => j !== k)); setWaehlen(null); }}>Weg</Knopf></span>} />
          ))}
        </Liste>
        {waehlen !== null && (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Aufgabe suchen …" aria-label="Aufgabe suchen" style={feld} />
            <Liste>
              {kandidaten.length === 0 && <Leer>Keine passende offene Aufgabe in {SPACE_LABEL[sicht]} — <Link href={`/os/aufgaben?space=${sicht}`} style={{ color: C.inkDim }}>Aufgaben öffnen ›</Link></Leer>}
              {kandidaten.slice(0, 8).map(z => <Zeile key={z.id} onClick={() => waehle(z.id)} titel={z.titel} unter={unterText(z)} rechts={mark(z)} />)}
            </Liste>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Knopf haupt aus={entwurf.length === 0} onClick={() => senden({ aktion: 'festlegen', ids: entwurf })}>Top {entwurf.length || 3} festlegen</Knopf>
          {entwurf.length < TOP3_MAX && <Knopf leise onClick={() => { setWaehlen(entwurf.length); setSuche(''); }}>+ Aufgabe hinzufügen</Knopf>}
          <Knopf leise onClick={() => { setBearbeiten(false); setWaehlen(null); setMeldung(''); }}>Abbrechen</Knopf>
        </div>
      </>
    );
  } else if (festgelegt) {
    const gesamt = festgelegt.zeilen.length, fertig = festgelegt.zeilen.filter(liveErledigt).length;
    inhalt = (
      <>
        <Liste>
          {festgelegt.zeilen.length === 0 && <Leer>Die festgelegten Aufgaben gibt es nicht mehr — leg neue fest.</Leer>}
          {festgelegt.zeilen.map(z => {
            const fertigZ = liveErledigt(z);
            return (
              <Zeile key={z.id} onClick={oeffnen(z)}
                links={<Haken an={fertigZ} label={z.titel} farbe={z.kritisch ? LEUCHT.kritisch : undefined} onChange={() => { dispatch({ type: 'TOGGLE_TASK', payload: { id: z.id } }); window.setTimeout(() => { void laden(); heuteGeaendert(); }, 800); }} />}
                titel={<span style={fertigZ ? { color: C.inkLeise, textDecoration: 'line-through' } : undefined}>{z.titel}</span>}
                unter={fertigZ ? 'erledigt' : unterText(z)} rechts={mark(z)} />
            );
          })}
        </Liste>
        {gesamt > 0 && fertig === gesamt && <div style={{ marginTop: 8 }}><Chip farbe={LEUCHT.gut}>Alle {gesamt === TOP3_MAX ? 'drei' : gesamt} erledigt</Chip></div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, flex: '1 1 160px' }}>Festgelegt um {uhr(festgelegt.am)} · {festgelegt.von === 'vorschlag' ? 'Vorschlag von ZOE übernommen' : 'von dir gewählt'}</span>
          <Knopf leise onClick={() => anpassen(festgelegt.zeilen.map(z => z.id))}>Ändern</Knopf>
          <Knopf leise onClick={() => senden({ aktion: 'zuruecksetzen' })}>Zurücksetzen</Knopf>
        </div>
      </>
    );
  } else if (vorschlag.length) {
    inhalt = (
      <>
        <Liste>
          {vorschlag.map((z, k) => <Zeile key={z.id} onClick={oeffnen(z)} links={nummer(k + 1)} titel={z.titel} unter={unterText(z)} rechts={mark(z)} />)}
        </Liste>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Knopf haupt onClick={() => senden({ aktion: 'festlegen', ids: vorschlag.map(z => z.id) })}>{vorschlag.length === 3 ? 'Top 3' : 'Vorschlag'} übernehmen</Knopf>
          <Knopf leise onClick={() => anpassen(vorschlag.map(z => z.id))}>Anpassen</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Vorschlag von ZOE</span>
        </div>
      </>
    );
  } else {
    inhalt = block.auswahl.length
      ? <Leer aktion={<Knopf leise onClick={() => anpassen([])}>Selbst festlegen</Knopf>}>Nichts in {SPACE_LABEL[sicht]} drängt von allein — ZOE hat keinen Vorschlag. Du kannst dir bis zu drei Aufgaben selbst festlegen.</Leer>
      : <Leer>Keine offene Aufgabe in {SPACE_LABEL[sicht]}, die dir zugewiesen ist. <Link href={`/os/aufgaben?space=${sicht}`} style={{ color: C.inkDim }}>Aufgaben ›</Link></Leer>;
  }

  const alleFertig = !!festgelegt && festgelegt.zeilen.length > 0 && festgelegt.zeilen.every(liveErledigt);
  return (
    <Karte i={i} akzent={alleFertig ? LEUCHT.gut : SPACE_FARBE[sicht]}>
      <Ueberschrift farbe={alleFertig ? LEUCHT.gut : SPACE_FARBE[sicht]} erklaerung="heute.top3" rechts={rechtsLink}>{kopf}</Ueberschrift>
      {meldung && <div style={{ marginBottom: 8 }}><Hinweis art="achtung" rolle="status">{meldung}</Hinweis></div>}
      {inhalt}
    </Karte>
  );
}

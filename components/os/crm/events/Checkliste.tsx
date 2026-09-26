'use client';

// ─── Event · Checkliste — sechs Wochen Vorlauf, Nachfassen, Wirkung ─────────
// Jeder Punkt hat einen Vorlauf in Tagen (negativ = nach dem Event); fällig
// ist er am Eventdatum minus Vorlauf. Je Punkt steht, wer ihn erledigt
// (Kevin oder Malin, ohne Eintrag die Event-Zuständigkeit); der Filter zeigt
// nur die eigenen. „Als Aufgaben anlegen“ macht aus jedem offenen Punkt eine
// Aufgabe für genau diese Person (wiederholbar, nie doppelt).
// Zu zweit: jede Änderung geht als EINE Punkt-Änderung an den Server
// (/api/crm/events, aktion „punkt“), der sie auf seinen aktuellen Stand legt —
// Kevin und Malin haken gleichzeitig ab, ohne sich die Liste zu
// überschreiben. Bis der Abgleich sie zeigt, steht die Änderung hier schon
// da („schwebend“). Die verknüpfte Aufgabe zieht mit (abhaken, umverteilen,
// Vorlauf), wenn das ohne Risiko geht — sonst kommt ein Hinweis.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Chip, Leer, Haken, Fortschritt, feld, LEUCHT } from '../../schlank';
import { checklisteFaellig, checklisteStand, vorlageAnwenden, VORLAGEN, punktAendern, punktWer, arbeitJePerson, type FaelligerPunkt, type PunktAenderung, type ChecklistenPunkt } from '@/lib/crm/eventplanung';
import { BEIDE, anderer, zustaendig, nameVon } from '@/lib/crm/team';
import type { Event } from '@/lib/crm/typen';
import { neueId, datum } from '../daten';
import { Feld } from '../teile';
import { WerFilter, useWerFilter, passtWer } from '../team';
import { eventSetzen, Leise, WerTausch, JePerson, type ReiterProps } from './gemeinsam';

const vorlauf = (t: number) => (t > 0 ? `${t} T vorher` : t === 0 ? 'am Tag' : `${-t} T danach`);
type Antwort = { ok: boolean; fehler?: string; aufgabe?: 'mitgezogen' | 'unveraendert' | null; hinweise?: string[]; angelegt?: number; jePerson?: Record<string, number>; schonDa?: number; abgehakt?: number };
type Schwebend = { nr: number; a: PunktAenderung; bestaetigt?: number };

/** Zeigt der Server-Stand die Änderung schon? Dann muss sie nicht mehr schweben. */
function schonDa(liste: ChecklistenPunkt[], a: PunktAenderung): boolean {
  if (a.op === 'neu') return liste.some(p => p.id === a.punkt.id);
  const p = liste.find(x => x.id === a.id);
  if (a.op === 'weg' || !p) return !p;
  const f = a.felder;
  return (f.text === undefined || p.text === f.text.trim()) && (f.tageVorher === undefined || p.tageVorher === f.tageVorher)
    && (f.erledigt === undefined || p.erledigt === f.erledigt) && (f.wer === undefined || (p.wer ?? '') === (f.wer ?? ''));
}

export function Checkliste({ e, api }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const ich = api.ich;
  const [text, setText] = useState('');
  const [tage, setTage] = useState('7');
  const [neuWer, setNeuWer] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [schwebend, setSchwebend] = useState<Schwebend[]>([]);
  const [wahl, setWahl] = useWerFilter('event-checkliste');
  const nr = useRef(0);

  // Was der Server schon zeigt, schwebt nicht mehr — bestätigte Änderungen spätestens beim übernächsten Abgleich
  // (hat die/der andere denselben Punkt danach wieder geändert, gilt deren Stand).
  useEffect(() => {
    const l = e.checkliste ?? [];
    setSchwebend(s => { const n = s.filter(x => !schonDa(l, x.a) && !(x.bestaetigt && Date.now() - x.bestaetigt > 15_000)); return n.length === s.length ? s : n; });
  }, [e.checkliste]);

  const anzeige: Event = { ...e, checkliste: schwebend.reduce((l, x) => punktAendern(l, x.a)?.liste ?? l, e.checkliste ?? []) };
  const liste = checklisteFaellig(anzeige, heute);
  const stand = checklisteStand(anzeige, heute);
  const wer = new Map((anzeige.checkliste ?? []).map(p => [p.id, punktWer(p, anzeige)]));
  const passt = (p: FaelligerPunkt, w = wahl) => passtWer(w, wer.get(p.id), 'event', ich);
  const offenAlle = liste.filter(p => !p.erledigt);
  const offen = offenAlle.filter(p => passt(p));
  const erledigt = liste.filter(p => p.erledigt && passt(p));
  const standard = zustaendig(e.zustaendig, 'event');
  const arbeit = arbeitJePerson(anzeige, [], [], heute);
  const naechster = ich ? offenAlle.find(p => passt(p, 'ich')) : undefined;
  const andere = ich ? anderer(ich) : null;
  const zahlen: Record<string, number> = { alle: offenAlle.length };
  if (ich) zahlen.ich = offenAlle.filter(p => passt(p, 'ich')).length;
  if (andere && andere !== ich) zahlen[andere] = offenAlle.filter(p => passt(p, andere)).length;

  const post = (body: Record<string, unknown>): Promise<Antwort> => fetch('/api/crm/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: e.id, ...body }) })
    .then(r => r.json()).catch(() => ({ ok: false, fehler: 'Nicht gespeichert — keine Verbindung.' }));

  /** Was die Aufgabe mitgemacht hat — für die Meldung unter der Überschrift. */
  const mitgezogen = (a: PunktAenderung) => {
    if (a.op !== 'aendern') return '';
    const f = a.felder;
    return [
      f.erledigt === true ? 'Aufgabe mit abgehakt.' : f.erledigt === false ? 'Aufgabe wieder geöffnet.' : '',
      f.wer !== undefined ? `Aufgabe liegt jetzt bei ${nameVon(f.wer || standard)}.` : '',
      f.tageVorher !== undefined ? 'Fälligkeit der Aufgabe angepasst.' : '',
    ].filter(Boolean).join(' ');
  };
  const schicke = async (a: PunktAenderung) => {
    const n = ++nr.current;
    setSchwebend(s => [...s, { nr: n, a }]);
    setMeldung('');
    const r = await post({ aktion: 'punkt', aenderung: a });
    if (!r.ok) { setSchwebend(s => s.filter(x => x.nr !== n)); setMeldung(r.fehler ?? 'Nicht gespeichert.'); return; }
    setSchwebend(s => s.map(x => (x.nr === n ? { ...x, bestaetigt: Date.now() } : x)));
    const text = [r.aufgabe === 'mitgezogen' ? mitgezogen(a) : '', ...(r.hinweise ?? [])].filter(Boolean).join(' ');
    if (text) setMeldung(text);
    void api.laden();
  };

  const alsAufgaben = async () => {
    setLaeuft(true); setMeldung('');
    const r = await post({ aktion: 'checkliste-aufgaben' });
    setLaeuft(false);
    const je = Object.entries(r.jePerson ?? {}).map(([p, n]) => `${nameVon(p === 'both' ? BEIDE : p)} ${n}`).join(', ');
    setMeldung(!r.ok ? (r.fehler ?? 'Nicht angelegt.')
      : [r.angelegt ? `${r.angelegt} ${r.angelegt === 1 ? 'Aufgabe' : 'Aufgaben'} angelegt${je ? ` — ${je}` : ''}` : '', r.schonDa ? `${r.schonDa} gab es schon — verknüpft` : '', r.abgehakt ? `${r.abgehakt} in der Aufgabenliste erledigt — hier abgehakt` : ''].filter(Boolean).join(' · ') || 'Nichts zu tun — alle offenen Punkte haben schon eine Aufgabe.');
    await api.laden();
  };
  const dazu = () => {
    const t = Number(tage);
    if (!text.trim() || !Number.isFinite(t)) return;
    void schicke({ op: 'neu', punkt: { id: neueId('cl'), text: text.trim(), tageVorher: Math.max(-30, Math.min(120, Math.round(t))), ...(neuWer ? { wer: neuWer } : {}) } });
    setText('');
  };
  /** Zurück auf die Event-Zuständigkeit = Eintrag weg (dann geht der Punkt mit, wenn das Event übergeben wird). */
  const umverteilen = (p: FaelligerPunkt, person: string) => void schicke({ op: 'aendern', id: p.id, felder: { wer: person === standard ? '' : person } });

  const zeile = (p: FaelligerPunkt) => {
    const farbe = p.erledigt ? C.inkLeise : p.ueberfaellig ? LEUCHT.kritisch : p.tage <= 3 ? LEUCHT.achtung : C.inkDim;
    const eigen = (anzeige.checkliste ?? []).find(x => x.id === p.id)?.wer;
    return (
      <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <Haken an={p.erledigt} onChange={() => void schicke({ op: 'aendern', id: p.id, felder: { erledigt: !p.erledigt } })} farbe={p.ueberfaellig ? LEUCHT.kritisch : undefined} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.bedien, color: p.erledigt ? C.inkLeise : C.ink, textDecoration: p.erledigt ? 'line-through' : undefined }}>{p.text}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.inkLeise, marginTop: 4 }}>
            <WerTausch wert={wer.get(p.id) ?? standard} ich={ich} standard={eigen ? undefined : 'wie Event'} onWahl={person => umverteilen(p, person)} />
            <span>fällig {datum(p.faelligAm, heute)} · {vorlauf(p.tageVorher)}{p.aufgabeId ? <> · <Link href={WEG.aufgabe(p.aufgabeId)} style={{ color: C.inkDim }}>Aufgabe ›</Link></> : ''}</span>
          </div>
        </div>
        {!p.erledigt && <Chip farbe={farbe}>{p.ueberfaellig ? `${-p.tage} T überfällig` : p.tage === 0 ? 'heute' : `in ${p.tage} T`}</Chip>}
        <Feld typ="number" wert={String(p.tageVorher)} breite={70} platzhalter="Tage vorher" onFertig={v => { const n = Math.round(Number(v)); if (Number.isFinite(n) && n !== p.tageVorher) void schicke({ op: 'aendern', id: p.id, felder: { tageVorher: Math.max(-30, Math.min(120, n)) } }); }} />
        <button onClick={() => void schicke({ op: 'weg', id: p.id })} aria-label="Punkt entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.body }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift rechts={<Knopf leise aus={laeuft || !stand.ohneAufgabe} onClick={alsAufgaben}>{laeuft ? 'legt an …' : `Als Aufgaben anlegen${stand.ohneAufgabe ? ` (${stand.ohneAufgabe})` : ''}`}</Knopf>}>
        Checkliste{stand.ueberfaellig ? ` · ${stand.ueberfaellig} überfällig` : ''}
      </Ueberschrift>
      {meldung && <div style={{ fontSize: 12.5, color: C.inkDim }}>{meldung}</div>}
      {liste.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
            <Fortschritt anteil={stand.gesamt ? stand.erledigt / stand.gesamt : 0} farbe={stand.ueberfaellig ? LEUCHT.achtung : LEUCHT.gut} />
            <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{stand.erledigt} / {stand.gesamt}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkLeise }}>offen <JePerson zahlen={Object.fromEntries(Object.entries(arbeit).map(([p, a]) => [p, a.punkteOffen]))} /></span>
            <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
          </div>
          {naechster && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Für dich als Nächstes: <span style={{ color: C.ink }}>{naechster.text}</span> — {naechster.ueberfaellig ? `seit ${-naechster.tage} ${-naechster.tage === 1 ? 'Tag' : 'Tagen'} überfällig` : `fällig ${datum(naechster.faelligAm, heute)}`}.</div>}
        </>
      )}
      <div>{offen.map(zeile)}</div>
      {liste.length > 0 && !offen.length && <Leer>{offenAlle.length ? `Bei ${wahl === 'ich' ? 'dir' : nameVon(wahl)} ist nichts offen — ${offenAlle.length} ${offenAlle.length === 1 ? 'Punkt liegt' : 'Punkte liegen'} bei der/dem anderen.` : 'Alles erledigt.'}</Leer>}
      {!liste.length && (
        <Leer>
          Noch keine Checkliste. Die Vorlage legt sechs Wochen Vorlauf an: Ziel (42 Tage), Gästeliste (28), persönliche Einladungen (21), Erinnerung (7), Technik (1), Nachfassen in 48 h, Wirkung nach 30 Tagen. Jeder Punkt liegt zuerst bei {nameVon(standard)} — je Punkt umverteilbar.
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {VORLAGEN.map(v => <Knopf key={v.id} leise onClick={() => void eventSetzen(api, e, vorlageAnwenden(e, v.id))}>{v.label}</Knopf>)}
          </div>
        </Leer>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={text} onChange={x => setText(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') dazu(); }} placeholder="Neuer Punkt, z. B. Co-Host briefen" aria-label="Neuer Punkt"
          style={{ ...feld, flex: 1, minWidth: 200, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }} />
        <input type="number" value={tage} onChange={x => setTage(x.target.value)} aria-label="Tage vorher" title="Tage vor dem Event (negativ = danach)" style={{ ...feld, width: 90, fontSize: TYP.bedien, padding: '8px 11px' }} />
        <span style={{ fontSize: 12, color: C.inkLeise }}>Tage vorher</span>
        <WerTausch wert={neuWer ?? standard} ich={ich} standard={neuWer ? undefined : 'wie Event'} onWahl={person => setNeuWer(person === standard ? null : person)} />
        <Knopf leise aus={!text.trim()} onClick={dazu}>+ Punkt</Knopf>
      </div>
      {erledigt.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim }}>Erledigt ({erledigt.length})</summary>
          <div style={{ marginTop: 6 }}>{erledigt.map(zeile)}</div>
        </details>
      )}
      <div style={{ fontSize: 12, color: C.inkLeise }}>
        Aufgaben erscheinen in der Aufgabenliste bei der Person des Punktes, mit Fälligkeit, Link zum Event und den Stichworten „crm“ und „event“. Umverteilen nimmt die Aufgabe mit, solange sie offen ist und niemand sie dort von Hand umgehängt hat.
        {!stand.ohneAufgabe && offenAlle.some(p => p.aufgabeId) && <> <Leise onClick={() => void alsAufgaben()}>In der Aufgabenliste Erledigtes übernehmen</Leise></>}
      </div>
    </div>
  );
}

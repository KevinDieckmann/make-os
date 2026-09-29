'use client';

// ─── Kalender: Zeit-Auswertung „wie Google Time Insights“ (29.09., Paket K2) ─
// Seitenleisten-Karte (diese Woche: Meetings · Fokus · Abwesend · frei, Privat/Business, Abweichung zum 4-Wochen-Schnitt)
// und die ausführliche Ansicht im Fenster (je Tag, je Firma, je Mandat, meistbesuchte Kontakte, Vorwochen). Rechnung
// NUR in lib/kalender/auswertung.ts, gelesen über GET /api/kalender/auswertung — hier wird nur gezeigt.

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { stundenAus, abweichungText, anteil, BLOCK_NAME, type Minuten } from '@/lib/kalender/auswertung';
import type { AuswertungAntwort } from '@/lib/kalender/auswertung-server';
import { tagPlus } from '@/lib/kalender/zeit';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { Karte, Ueberschrift, Knopf, Leer, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { MandantLink } from '../crm/MandantLink';

export const KENNZAHL: { id: keyof Minuten; label: string; farbe: string }[] = [
  { id: 'meetings', label: 'Meetings', farbe: LEUCHT.puls },
  { id: 'fokus', label: 'Fokus', farbe: LEUCHT.schlaf },
  // K6a (29.09.): Planen-Blöcke (Reha, Routine, Pause, Aufgabe, Blockzeit) als eigene Kategorie.
  { id: 'bloecke', label: 'Blöcke (Planen)', farbe: LEUCHT.agenten },
  { id: 'abwesend', label: 'Abwesend', farbe: LEUCHT.achtung },
  { id: 'frei', label: 'Frei (Arbeitszeit)', farbe: LEUCHT.gut },
];

/** Auswertung einer Woche laden (Stichtag = irgendein Tag der Woche). */
export function useAuswertung(stichtag: string): { a: AuswertungAntwort | null; fehler: boolean } {
  const [stand, setStand] = useState<{ stichtag: string; a: AuswertungAntwort | null; fehler: boolean } | null>(null);
  useEffect(() => {
    let lebt = true;
    fetch(`/api/kalender/auswertung?stichtag=${stichtag}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (lebt) setStand({ stichtag, a: d?.ok ? d : null, fehler: !d?.ok }); })
      .catch(() => { if (lebt) setStand({ stichtag, a: null, fehler: true }); });
    return () => { lebt = false; };
  }, [stichtag]);
  return stand?.stichtag === stichtag ? { a: stand.a, fehler: stand.fehler } : { a: null, fehler: false };
}

const pfeil = (min: number) => (Math.abs(min) < 3 ? C.inkLeise : min > 0 ? LEUCHT.achtung : LEUCHT.gut);

/** Zwei-Farben-Balken Privat/Business. */
function SpaceBalken({ privat, business }: { privat: number; business: number }) {
  const p = anteil(privat, privat + business);
  if (privat + business === 0) return <div style={{ fontSize: 12, color: C.inkLeise }}>Noch keine belegte Zeit.</div>;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,.06)' }} aria-label={`Privat ${p} %, Business ${100 - p} %`}>
        <span style={{ width: `${p}%`, background: SPACE_FARBE.privat }} /><span style={{ width: `${100 - p}%`, background: SPACE_FARBE.business }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkLeise, marginTop: 4 }}>
        <span>Privat {p} % · {stundenAus(privat)}</span><span>Business {100 - p} % · {stundenAus(business)}</span>
      </div>
    </div>
  );
}

/** Die Kennzahlen-Zeilen (Karte und Fenster). */
export function KennzahlZeilen({ a }: { a: AuswertungAntwort }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {KENNZAHL.map(k => (
        <div key={k.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: k.farbe, flex: '0 0 auto', alignSelf: 'center' }} />
          <span style={{ color: C.inkDim, flex: 1 }}>{k.label}</span>
          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{stundenAus(a.woche.minuten[k.id] ?? 0)}</b>
          <span title="gegenüber dem Schnitt der letzten 4 Wochen" style={{ fontSize: 11.5, color: pfeil(a.abweichung[k.id] ?? 0), width: 62, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{abweichungText(a.abweichung[k.id] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

/** Seitenleisten-Karte. */
export function AuswertungKarte({ stichtag, i = 5 }: { stichtag: string; i?: number }) {
  const { a, fehler } = useAuswertung(stichtag);
  const [offen, setOffen] = useState(false);
  return (
    <Karte i={i}>
      <Ueberschrift rechts={a ? <Knopf leise onClick={() => setOffen(true)}>Details</Knopf> : undefined}>Zeit{a ? ` · KW ${a.woche.kw}` : ''}</Ueberschrift>
      {!a && <div style={{ fontSize: 12.5, color: C.inkLeise }}>{fehler ? 'Auswertung gerade nicht möglich.' : 'rechnet …'}</div>}
      {a && <>
        <KennzahlZeilen a={a} />
        <div style={{ marginTop: 10 }}><SpaceBalken privat={a.woche.space.privat} business={a.woche.space.business} /></div>
        {a.quelle === 'ohne-kalender' && <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 8 }}>Ohne iCloud nur die Fokus-Zeit aus der Zeitmessung.</div>}
      </>}
      {offen && a && <AuswertungFenster start={stichtag} onZu={() => setOffen(false)} />}
    </Karte>
  );
}

/** Die ausführliche Ansicht — Woche blätterbar. */
export function AuswertungFenster({ start, onZu }: { start: string; onZu: () => void }) {
  const [stichtag, setStichtag] = useState(start);
  const { a, fehler } = useAuswertung(stichtag);
  return (
    <Fenster breit={760} onZu={onZu} titel={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>Zeit-Auswertung{a ? ` · ${a.woche.label}` : ''}</span>}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Knopf leise onClick={() => setStichtag(s => tagPlus(s, -7))}>‹ Vorwoche</Knopf>
        <Knopf leise onClick={() => setStichtag(s => tagPlus(s, 7))}>Folgewoche ›</Knopf>
      </div>
      {!a ? <Leer>{fehler ? 'Auswertung gerade nicht möglich.' : 'rechnet …'}</Leer> : <AuswertungInhalt a={a} />}
    </Fenster>
  );
}

/** Inhalt der ausführlichen Ansicht (rein darstellend — Render-Test). */
export function AuswertungInhalt({ a }: { a: AuswertungAntwort }) {
  const w = a.woche;
  const maxTag = Math.max(60, ...w.tage.map(t => t.meetings + t.fokus + t.abwesend));
  const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const abschnitt = (titel: string) => <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase', margin: '14px 0 6px' }}>{titel}</div>;
  return (
    <div style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
      <KennzahlZeilen a={a} />
      <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 6 }}>{w.anzahlMeetings} Meetings · Arbeitszeit {stundenAus(w.minuten.arbeitszeit)} (ohne Feiertage) · Abweichung gegenüber dem Schnitt der letzten {a.vorher.length} Wochen</div>
      {abschnitt('Je Tag')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, alignItems: 'end', height: 110 }}>
        {w.tage.map((t, i) => (
          <div key={t.tag} title={`${WT[i]} ${t.tag.slice(8, 10)}.${t.tag.slice(5, 7)}.: Meetings ${stundenAus(t.meetings)}, Fokus ${stundenAus(t.fokus)}${t.abwesend ? `, abwesend ${stundenAus(t.abwesend)}` : ''}`} style={{ display: 'grid', gridTemplateRows: '1fr auto', height: '100%', gap: 4 }}>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.04)' }}>
              <span style={{ height: `${(t.meetings / maxTag) * 100}%`, background: LEUCHT.puls }} />
              <span style={{ height: `${(t.fokus / maxTag) * 100}%`, background: LEUCHT.schlaf }} />
              <span style={{ height: `${(t.abwesend / maxTag) * 100}%`, background: `${LEUCHT.achtung}88` }} />
            </div>
            <span style={{ textAlign: 'center', fontSize: 11, color: C.inkLeise }}>{WT[i]}</span>
          </div>
        ))}
      </div>
      {abschnitt('Privat / Business')}
      <SpaceBalken privat={w.space.privat} business={w.space.business} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          {abschnitt('Je Firma')}
          {w.jeEinheit.length ? w.jeEinheit.map(e => <Zeile2 key={e.einheit} links={a.namen.einheiten[e.einheit] ?? e.einheit} rechts={stundenAus(e.minuten)} />) : <div style={{ color: C.inkLeise, fontSize: 12.5 }}>Noch keine Zeit mit Firma — Fokus-Blöcke einer Aufgabe oder Einheit zuordnen.</div>}
        </div>
        <div>
          {abschnitt('Je Mandat')}
          {w.jeMandat.length ? w.jeMandat.map(m => <Zeile2 key={m.mandatId} links={<MandantLink mandatId={m.mandatId} name={a.namen.mandate[m.mandatId] ?? 'Mandat'} klein />} rechts={stundenAus(m.minuten)} />) : <div style={{ color: C.inkLeise, fontSize: 12.5 }}>Noch keine Zeit mit Mandat.</div>}
        </div>
      </div>
      {(w.jeBlock ?? []).length > 0 && <>{abschnitt('Blöcke je Art')}{(w.jeBlock ?? []).map(x => <Zeile2 key={x.art} links={BLOCK_NAME[x.art] ?? x.art} rechts={stundenAus(x.minuten)} />)}</>}
      {abschnitt('Meistbesuchte Kontakte')}
      {w.kontakte.length ? w.kontakte.slice(0, 5).map(k => <Zeile2 key={k.id} links={k.id} rechts={`${k.termine} Termine · ${stundenAus(k.minuten)}`} />)
        : <div style={{ color: C.inkLeise, fontSize: 12.5 }}>Erscheint, sobald Termine mit CRM-Kontakten verknüpft sind.</div>}
      {abschnitt('Vorwochen')}
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${KENNZAHL.length}, 1fr)`, gap: '4px 10px', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
        <span />{KENNZAHL.map(k => <span key={k.id} style={{ color: C.inkLeise, fontSize: 11.5 }}>{k.label}</span>)}
        {[...a.vorher, w].map(v => [
          <span key={`${v.von}-l`} style={{ color: v === w ? C.ink : C.inkDim, fontWeight: v === w ? 700 : 500 }}>KW {v.kw}</span>,
          ...KENNZAHL.map(k => <span key={`${v.von}-${k.id}`} style={{ fontWeight: v === w ? 700 : 400 }}>{stundenAus(v.minuten[k.id] ?? 0)}</span>),
        ])}
      </div>
    </div>
  );
}

function Zeile2({ links, rechts }: { links: React.ReactNode; rechts: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{links}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>{rechts}</span>
    </div>
  );
}

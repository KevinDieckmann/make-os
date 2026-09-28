'use client';

// ─── Kontakt öffnen · Stationen: Firmen, Rollen, Beschäftigungshistorie (28.09.) ─
// Kevins Entscheidung (#2/#3): eine Person kann in mehreren Firmen stehen, ein
// Jobwechsel beendet die alte Station, statt sie zu überschreiben. Hier:
//   · laufende Stationen (Hauptstation markiert) und ehemalige (eingeklappt)
//   · „Firma wechseln“ (Jobwechsel: alte endet, neue wird Hauptstation)
//   · „+ weitere Firma“ (z. B. Beirat — die Hauptstation bleibt)
//   · je Station: Rolle, Art, von/bis, „Haupt“, „beenden“, „entfernen“ (nur Fehleinträge)
// Geschrieben wird die Liste (`stationen`) samt abgeleiteter Felder (`stationenFelder`
// — dieselbe Rechnung wie der Server, lib/crm/stationen.ts); nie wird etwas verschickt.

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../schlank';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Firma } from '@/lib/crm/typen';
import { bestehendeFirma } from '@/lib/crm/firmen';
import { stationenVon, stationWechseln, stationHinzufuegen, stationBeenden, stationEntfernen, hauptWaehlen, stationAendern, stationenFelder, STATION_ART_WAHL, STATION_ART_LABEL, type Station, type StationArt } from '@/lib/crm/stationen';
import type { CrmApi } from '../daten';
import { datum } from '../daten';
import { Wahl } from '../Wahl';
import { Feld } from '../teile';
import { neueFirma } from '../Firmen';
import { FirmenDatalist } from '../FirmenDatalist';
import type { Setze } from '../kontakt-teile';

const klein = { fontSize: 12, color: C.inkLeise } as const;
const leise = { background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: SCHRIFT.text } as const;
const eingabe = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' };

type Form = { art: 'wechsel' | 'dazu'; name: string; rolle: string; stationArt: StationArt | null; von: string };

export function StationenTeil({ k, api, heute, setze, zuFirma }: { k: Kontakt; api: CrmApi; heute: string; setze: Setze; zuFirma: (id: string) => void }) {
  const firmen = api.crm?.stand.firmen ?? [];
  const name = (id: string) => firmen.find(f => f.id === id)?.name;
  const liste = stationenVon(k);
  const [form, setForm] = useState<Form | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [ehemalige, setEhemalige] = useState(false);
  const [sicher, setSicher] = useState<number | null>(null);
  useEffect(() => { setForm(null); setOffen(null); setSicher(null); }, [k.id]);

  const schreiben = (neu: Station[], extraName?: (id: string) => string | undefined) => void setze(stationenFelder(k, neu, heute, id => extraName?.(id) ?? name(id)));

  /** Firma finden oder anlegen (wie „Firma verknüpfen“) — dann die Station schreiben. */
  async function absenden() {
    if (!form) return;
    const n = form.name.trim();
    if (!n) return;
    const f: Firma = firmen.find(x => x.name.toLowerCase() === n.toLowerCase()) ?? bestehendeFirma(firmen, n) ?? neueFirma(n);
    if (!firmen.some(x => x.id === f.id)) await api.setze('firmen', f as unknown as { id: string } & Record<string, unknown>);
    const neu = { firmaId: f.id, ...(form.rolle.trim() ? { rolle: form.rolle.trim() } : {}), ...(form.stationArt ? { art: form.stationArt } : {}), ...(form.von ? { von: form.von } : {}) };
    schreiben(form.art === 'wechsel' ? stationWechseln(k, neu, heute) : stationHinzufuegen(k, neu), id => (id === f.id ? f.name : undefined));
    setForm(null);
  }

  const laufend = liste.map((s, i) => ({ s, i })).filter(x => x.s.aktiv);
  const beendet = liste.map((s, i) => ({ s, i })).filter(x => !x.s.aktiv).sort((a, b) => (b.s.bis ?? '').localeCompare(a.s.bis ?? ''));
  const zeitraum = (s: Station) => (s.von || s.bis ? `${s.von ? datum(s.von, heute) : '…'} – ${s.bis ? datum(s.bis, heute) : s.aktiv ? 'heute' : '…'}` : '');

  const zeile = ({ s, i }: { s: Station; i: number }) => (
    <div key={`${s.firmaId}-${i}`} style={{ display: 'grid', gap: 4, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.045)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <button type="button" onClick={() => zuFirma(s.firmaId)} className="fassbar" title="Firma öffnen"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: s.aktiv ? C.ink : C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name(s.firmaId) ?? s.firmaId}
        </button>
        {s.haupt && <span style={{ fontSize: 11, fontWeight: 700, color: LEUCHT.gut, border: `1px solid ${LEUCHT.gut}55`, borderRadius: 999, padding: '1px 7px' }}>Haupt</span>}
        <button type="button" onClick={() => setOffen(offen === i ? null : i)} className="fassbar" style={leise} aria-expanded={offen === i}>{offen === i ? 'fertig' : 'ändern'}</button>
      </div>
      <div style={klein}>{[s.rolle, s.art ? STATION_ART_LABEL[s.art] : null, zeitraum(s)].filter(Boolean).join(' · ') || (s.aktiv ? 'laufend' : 'beendet')}</div>
      {offen === i && (
        <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
          <Feld wert={s.rolle ?? ''} platzhalter="Rolle / Position" onFertig={v => schreiben(stationAendern(k, i, { rolle: v.trim() || undefined }))} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Wahl label="Art" klein liste={STATION_ART_WAHL} wert={s.art} onWahl={art => schreiben(stationAendern(k, i, { art }))} onLeeren={s.art ? () => schreiben(stationAendern(k, i, { art: undefined })) : undefined} />
            <Feld typ="date" breite={150} wert={s.von ?? ''} platzhalter="von" onFertig={v => schreiben(stationAendern(k, i, { von: v || undefined }))} />
            {!s.aktiv && <Feld typ="date" breite={150} wert={s.bis ?? ''} platzhalter="bis" onFertig={v => schreiben(stationAendern(k, i, { bis: v || undefined }))} />}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {s.aktiv && !s.haupt && <button type="button" onClick={() => schreiben(hauptWaehlen(k, i))} className="fassbar" style={leise}>Zur Hauptstation machen</button>}
            {s.aktiv && <button type="button" onClick={() => { schreiben(stationBeenden(k, i, heute)); setOffen(null); }} className="fassbar" style={leise}>Beenden (ausgeschieden heute)</button>}
            {sicher === i
              ? <><span style={{ ...klein, color: LEUCHT.kritisch }}>Wirklich entfernen? Nur für Fehleinträge — eine echte Station beendet man.</span>
                <button type="button" onClick={() => { schreiben(stationEntfernen(k, i)); setSicher(null); setOffen(null); }} className="fassbar" style={{ ...leise, color: LEUCHT.kritisch }}>Ja, entfernen</button>
                <button type="button" onClick={() => setSicher(null)} className="fassbar" style={{ ...leise, color: C.inkLeise }}>Nein</button></>
              : <button type="button" onClick={() => setSicher(i)} className="fassbar" style={{ ...leise, color: C.inkLeise }}>Entfernen</button>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {laufend.map(zeile)}
      {!laufend.length && <div style={klein}>Keine laufende Station.</div>}
      {beendet.length > 0 && (
        <>
          <button type="button" onClick={() => setEhemalige(!ehemalige)} className="fassbar" style={{ ...leise, color: C.inkDim, justifySelf: 'start', marginTop: 6 }} aria-expanded={ehemalige}>
            {ehemalige ? '▾' : '▸'} Ehemalig · {beendet.length}
          </button>
          {ehemalige && beendet.map(zeile)}
        </>
      )}
      {form ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{form.art === 'wechsel' ? 'Firma wechseln — die bisherige Hauptstation endet' : 'Weitere Firma — die Hauptstation bleibt'}</div>
          <input autoFocus list="stationen-firmen" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Firma suchen oder neu …" aria-label="Firma" style={eingabe}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setForm(null); } }} />
          <FirmenDatalist id="stationen-firmen" firmen={firmen} suche={form.name} />
          <input value={form.rolle} onChange={e => setForm({ ...form, rolle: e.target.value })} placeholder="Rolle / Position (optional)" aria-label="Rolle" style={eingabe} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Wahl label="Art" klein liste={STATION_ART_WAHL} wert={form.stationArt} onWahl={a => setForm({ ...form, stationArt: a })} onLeeren={() => setForm({ ...form, stationArt: null })} />
            <label style={{ ...klein, display: 'inline-flex', gap: 6, alignItems: 'center' }}>ab <input type="date" value={form.von} onChange={e => setForm({ ...form, von: e.target.value })} aria-label="ab" style={{ ...eingabe, width: 150 }} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf aus={!form.name.trim()} onClick={() => absenden()}>{form.art === 'wechsel' ? 'Wechsel eintragen' : 'Hinzufügen'}</Knopf>
            <Knopf leise onClick={() => setForm(null)}>Abbrechen</Knopf>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {laufend.length > 0 && <button type="button" onClick={() => setForm({ art: 'wechsel', name: '', rolle: '', stationArt: null, von: heute })} className="fassbar" style={leise}>Firma wechseln</button>}
          <button type="button" onClick={() => setForm({ art: 'dazu', name: '', rolle: '', stationArt: null, von: '' })} className="fassbar" style={leise}>+ weitere Firma</button>
        </div>
      )}
    </div>
  );
}

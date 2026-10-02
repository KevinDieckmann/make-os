'use client';

// ─── Netzwerken — Schritt „Termin“ (02.10.) ──────────────────────────────────
// Art (Kennenlerngespräch · Telefonat · Videocall), Dauer (30/45/60) und die freien Zeiten der ZUSTÄNDIGEN Person als
// antippbare Vorschläge der nächsten 10 Werktage — oder eine Zeit selbst eintragen. Die Vorschläge kommen vom Server
// (GET /api/netzwerken?frei=<Person>&dauer=…, dieselbe Rechnung wie /api/kalender/frei) und tragen nur Zeiten, nie Titel.
// Der Termin entsteht erst beim Speichern, im Kalender der zuständigen Person, ohne Gäste und ohne Einladung — die Einladung
// schickt man später per Klick am Termin.

import { useEffect, useState } from 'react';
import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import { TERMIN_ARTEN, DAUERN, terminArtLabel, type TerminArt } from '@/lib/crm/netzwerken';
import { Wahl, Beschriftung, Hinweis, Feldzeile, eingabe, tagText } from './bausteine';

export interface TerminEingabe { art: TerminArt; dauer: number; start: string }

interface Tag { tag: string; zeiten: { start: string; ende: string }[] }

export function TerminWahl({ person, personName, kalenderDa, wert, onWert }: { person: string; personName: string; kalenderDa: boolean; wert: TerminEingabe; onWert: (t: TerminEingabe) => void }) {
  const [tage, setTage] = useState<Tag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [manuell, setManuell] = useState(false);

  // Freie Zeiten neu holen, wenn Person oder Dauer wechseln.
  useEffect(() => {
    if (!kalenderDa) { setTage(null); return; }
    let lebt = true;
    setTage(null); setFehler(null);
    fetch(`/api/netzwerken?frei=${encodeURIComponent(person)}&dauer=${wert.dauer}`, { cache: 'no-store' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!lebt) return; if (ok && d?.ok && Array.isArray(d.tage)) setTage(d.tage as Tag[]); else setFehler(typeof d?.fehler === 'string' ? d.fehler : 'Die freien Zeiten ließen sich nicht lesen — bitte eine Zeit selbst eintragen.'); })
      .catch(() => { if (lebt) setFehler('Ohne Netz keine freien Zeiten — bitte eine Zeit selbst eintragen.'); });
    return () => { lebt = false; };
  }, [person, wert.dauer, kalenderDa]);

  const tagTeil = wert.start.slice(0, 10), zeitTeil = wert.start.slice(11, 16);
  const ende = wert.start ? (() => { const m = Number(zeitTeil.slice(0, 2)) * 60 + Number(zeitTeil.slice(3, 5)) + wert.dauer; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; })() : '';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {!kalenderDa && <Hinweis farbe={LEUCHT.achtung} rolle="alert">Für {personName} ist in den Kalender-Einstellungen kein Kalender hinterlegt — der Termin kann so nicht gebucht werden. Bitte jemand anderen zuständig machen oder einen anderen Schritt wählen.</Hinweis>}
      <div>
        <Beschriftung>Art</Beschriftung>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TERMIN_ARTEN.map(a => <Wahl key={a.id} an={wert.art === a.id} onClick={() => onWert({ ...wert, art: a.id })}>{a.label}</Wahl>)}
        </div>
      </div>
      <div>
        <Beschriftung>Dauer</Beschriftung>
        <div style={{ display: 'flex', gap: 8 }}>
          {DAUERN.map(d => <Wahl key={d} an={wert.dauer === d} onClick={() => onWert({ ...wert, dauer: d, start: '' })}>{d} Min.</Wahl>)}
        </div>
      </div>
      <div>
        <Beschriftung rechts={kalenderDa ? 'nächste 10 Werktage' : undefined}>Freie Zeiten von {personName}</Beschriftung>
        {kalenderDa && !tage && !fehler && <div style={{ fontSize: 14, color: C.inkLeise, padding: '6px 2px' }}>Lädt die freien Zeiten …</div>}
        {fehler && <Hinweis rolle="status">{fehler}</Hinweis>}
        {tage && !tage.length && <Hinweis>In den nächsten Tagen ist nichts frei — bitte eine Zeit selbst eintragen.</Hinweis>}
        {tage && tage.length > 0 && (
          <div style={{ display: 'grid', gap: 10, maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 2 }} aria-label={`Freie Zeiten von ${personName}`}>
            {tage.map(t => (
              <div key={t.tag} style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.inkDim }}>{tagText(t.tag)}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {t.zeiten.map(z => <Wahl key={z.start} klein an={wert.start === z.start} onClick={() => { onWert({ ...wert, start: z.start }); setManuell(false); }}>{z.start.slice(11, 16)}</Wahl>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Wahl klein an={manuell} onClick={() => setManuell(m => !m)}>Zeit selbst eintragen</Wahl>
        {manuell && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <Feldzeile label="Tag"><input type="date" value={tagTeil} onChange={x => onWert({ ...wert, start: x.target.value ? `${x.target.value}T${zeitTeil || '10:00'}` : '' })} style={eingabe} aria-label="Tag" /></Feldzeile>
            <Feldzeile label="Uhrzeit"><input type="time" step={900} value={zeitTeil} onChange={x => onWert({ ...wert, start: tagTeil && x.target.value ? `${tagTeil}T${x.target.value}` : tagTeil ? `${tagTeil}T10:00` : '' })} style={eingabe} aria-label="Uhrzeit" /></Feldzeile>
          </div>
        )}
      </div>
      {wert.start ? (
        <Hinweis farbe={LEUCHT.gut} rolle="status">Gewählt: {tagText(tagTeil)} · {zeitTeil}–{ende} Uhr · {terminArtLabel(wert.art)} bei {personName}. Ohne Gäste — die Einladung schickst du später per Klick am Termin.</Hinweis>
      ) : (
        <Hinweis>Noch keine Zeit gewählt.</Hinweis>
      )}
    </div>
  );
}

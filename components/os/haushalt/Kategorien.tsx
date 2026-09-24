'use client';

// Kategorien aufräumen — Vorschlag, dann eure Entscheidung. Zusammenlegen hängt
// Buchungen und Regeln um; die alte Kennung bleibt als Alias gemerkt.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Zusammenlegung } from '@/lib/finanzen/haushalt/kategorien';
import { Knopf, LEUCHT } from '../schlank';
import { Dialog, Haken } from './gemeinsam';

export function KategorienDialog({ aktion, laden, melde, onZu }: {
  aktion: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<(T & { ok: boolean; fehler?: string }) | null>;
  laden: () => Promise<void>; melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void; onZu: () => void;
}) {
  const [v, setV] = useState<{ vorschlaege: Zusammenlegung[]; ungenutzt: { id: string; name: string }[]; anzahl: number } | null>(null);
  const [an, setAn] = useState<Record<string, boolean>>({});
  const [weg, setWeg] = useState<Record<string, boolean>>({});
  useEffect(() => { void aktion<{ vorschlaege: Zusammenlegung[]; ungenutzt: { id: string; name: string }[]; anzahl: number }>({ aktion: 'kategorien', vorschau: true }).then(d => { if (d?.ok) { setV(d); setAn(Object.fromEntries(d.vorschlaege.map(x => [x.von, true]))); } }); }, [aktion]);
  const paare = (v?.vorschlaege ?? []).filter(x => an[x.von]).map(x => ({ von: x.von, nach: x.nach }));
  const loeschen = Object.keys(weg).filter(id => weg[id]);
  const nachher = v ? v.anzahl - paare.length - loeschen.length : 0;
  return (
    <Dialog titel="Kategorien aufräumen" onZu={onZu} aktionen={<Knopf farbe={LEUCHT.geld} aus={!paare.length && !loeschen.length} onClick={async () => {
      const d = await aktion<{ zusammengelegt: number; geaendert: number; geloescht: number }>({ aktion: 'kategorien', paare, loeschen });
      if (d?.ok) { melde('ok', 'Aufgeräumt', `${d.zusammengelegt} zusammengelegt, ${d.geaendert} Buchungen umgehängt, ${d.geloescht} leere entfernt. Der alte Stand liegt im Archiv.`); await laden(); onZu(); }
    }}>{v ? `Anwenden — danach ${nachher} Kategorien` : 'Anwenden'}</Knopf>}>
      <div style={{ color: C.inkDim }}>Malin wollte von {v?.anzahl ?? '…'} auf etwa 15 Kategorien. Hier stehen Doppelungen und leere Kategorien. Buchungen und gelernte Regeln wandern mit, nichts geht verloren.</div>
      {!v && <div style={{ color: C.inkLeise }}>Lese …</div>}
      {v && !v.vorschlaege.length && !v.ungenutzt.length && <div style={{ color: LEUCHT.gut }}>Keine Doppelungen gefunden.</div>}
      {!!v?.vorschlaege.length && <div style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase' }}>Zusammenlegen</div>}
      {v?.vorschlaege.map(x => (
        <Haken key={x.von} an={!!an[x.von]} onChange={w => setAn(a => ({ ...a, [x.von]: w }))}>
          <strong>{x.vonName}</strong> → <strong>{x.nachName}</strong> <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>· {x.grund} · {x.buchungen} Buchungen, {x.regeln} Regeln</span>
        </Haken>
      ))}
      {!!v?.ungenutzt.length && <div style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 6 }}>Leer — keine Buchung, keine Regel</div>}
      {v?.ungenutzt.map(k => <Haken key={k.id} an={!!weg[k.id]} onChange={w => setWeg(a => ({ ...a, [k.id]: w }))}>„{k.name}“ entfernen</Haken>)}
    </Dialog>
  );
}

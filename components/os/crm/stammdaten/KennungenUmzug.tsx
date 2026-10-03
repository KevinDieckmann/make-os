'use client';

// ─── Stammdaten › Datenqualität · Kennungs-Umzug (29.09., Paket D-C #35, Kevin) ─
// Alte Kontakt-Kennungen trugen die E-Mail (bzw. Name+Firma). Die Karte zeigt, wie viele Kontakte noch so heißen und
// wo ihre Kennungen überall stehen (Vorschau, schreibt nichts); „Umstellen“ läuft erst nach einer Rückfrage — nie von
// selbst. Danach: alte Links leiten weiter, der Rückweg geht, solange kein umgezogener Kontakt geändert wurde.
// Nur der Inhaber (die Route antwortet sonst 403 — dann bleibt die Karte eine Zeile).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, LEUCHT } from '../../ui';
import { Fenster } from '../../Fenster';

interface Vorschau {
  anzahl: number; schonNeu: number; speicher: Record<string, number>; fingerabdruecke: Record<string, number>;
  jeKennung: { id: string; name: string; speicher: Record<string, number> }[];
  offen: { id: string; naechster: string | null; status: string } | null;
  letzter: { id: string; am: string; person: string; anzahl: number; status: string; art?: string } | null;
  rueckweg: { moeglich: boolean; gruende: string[] };
}
type Antwort = { ok: boolean; status?: number; fehler?: string; gruende?: string[]; anzahl?: number; speicher?: Record<string, number>; vorschau?: Vorschau } & Partial<Vorschau>;

const post = (aktion: string): Promise<Antwort> => fetch('/api/crm/kennungen-umzug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion }) })
  .then(async r => ({ ...(await r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}.` }))), status: r.status }) as Antwort).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
const summe = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const tag = (iso: string) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

export function KennungenUmzug({ i = 0, onGeaendert }: { i?: number; onGeaendert?: () => void }) {
  const [v, setV] = useState<Vorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, setFrage] = useState<'ausfuehren' | 'rueckweg' | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [alle, setAlle] = useState(false);
  const [nichtFuerMich, setNichtFuerMich] = useState(false);

  const laden = useCallback(async () => {
    const r = await post('vorschau');
    if (r.ok) { setV(r as unknown as Vorschau); setFehler(null); }
    else if (r.status === 403) setNichtFuerMich(true); // nur der Inhaber — für alle anderen keine Karte
    else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const los = async (aktion: 'ausfuehren' | 'rueckweg') => {
    setLaeuft(true); setMeldung('');
    const r = await post(aktion);
    setLaeuft(false); setFrage(null);
    if (r.ok) {
      setMeldung(aktion === 'ausfuehren' ? `Umgestellt: ${r.anzahl ?? 0} Kontakte, ${summe(r.speicher ?? {})} Verweise in ${Object.keys(r.speicher ?? {}).length} Beständen. Alte Links leiten weiter.` : `Zurückgenommen: ${r.anzahl ?? 0} Kontakte tragen wieder ihre alte Kennung.`);
      if (r.vorschau) setV(r.vorschau);
      onGeaendert?.();
    } else setMeldung(r.fehler ?? 'Nicht fertig geworden.');
  };

  if (nichtFuerMich) return null;
  if (fehler) return <Karte i={i}><Ueberschrift>Kontakt-Kennungen</Ueberschrift><Leer>{fehler}</Leer></Karte>;
  if (!v) return <Karte i={i}><Ueberschrift>Kontakt-Kennungen</Ueberschrift><Leer>Zähle die Kennungen …</Leer></Karte>;
  const bestaende = Object.entries(v.speicher).sort((a, b) => b[1] - a[1]);
  const zeilen = alle ? v.jeKennung : v.jeKennung.slice(0, 8);

  return (
    <Karte i={i} akzent={v.offen ? LEUCHT.achtung : v.anzahl ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={<Chip farbe={v.anzahl ? LEUCHT.achtung : LEUCHT.gut}>{v.anzahl ? `${v.anzahl} alt` : 'alle zufällig'}</Chip>}>Kontakt-Kennungen</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
        {v.anzahl
          ? `${v.anzahl} Kontakte tragen noch die alte Kennung aus E-Mail bzw. Name — sie steht so in Adressen, Protokollen und Import-Läufen. ${v.schonNeu} tragen schon eine zufällige. Umstellen ändert nur die Kennung, nie einen Inhalt; vorher entsteht eine Archivkopie, alte Links leiten danach weiter.`
          : `Alle ${v.schonNeu} Kontakte tragen zufällige Kennungen (c-…) — neue bekommen sie von selbst.`}
      </div>
      {v.offen && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 8 }}>Ein Umzug ist nicht fertig geworden (nächster Schritt: {v.offen.naechster ?? '—'}) — „Umstellen“ setzt ihn fort, sonst holt ihn der Takt nach.</div>}
      {v.anzahl > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {bestaende.slice(0, 12).map(([name, n]) => <span key={name} style={{ fontSize: TYP.bedien, color: C.inkDim, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,.04)' }}>{name} · {n}</span>)}
            {bestaende.length > 12 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>+ {bestaende.length - 12} weitere Bestände</span>}
          </div>
          {summe(v.fingerabdruecke) > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{summe(v.fingerabdruecke)} Protokoll-Fingerabdrücke werden auf die neuen Kennungen umgerechnet.</div>}
          <div style={{ display: 'grid', gap: 4, marginTop: 10 }}>
            {zeilen.map(k => (
              <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: TYP.bedien }}>
                <span style={{ color: C.ink, minWidth: 140 }}>{k.name || '—'}</span>
                <span style={{ color: C.inkLeise, flex: 1 }}>{Object.entries(k.speicher).map(([s, n]) => `${s} ${n}`).join(' · ')}</span>
              </div>
            ))}
            {v.jeKennung.length > zeilen.length && <button onClick={() => setAlle(true)} style={{ justifySelf: 'start', background: 'none', border: 0, color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>alle {v.jeKennung.length} zeigen</button>}
          </div>
        </>
      )}
      {v.letzter && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Zuletzt: {v.letzter.art === 'rueckweg' ? 'Rückweg' : 'Umzug'} am {tag(v.letzter.am)} · {v.letzter.anzahl} Kontakte · {v.letzter.person}{v.letzter.status === 'zurueck' ? ' · zurückgenommen' : ''}</div>}
      {!v.rueckweg.moeglich && v.letzter && v.letzter.status === 'fertig' && v.letzter.art !== 'rueckweg' && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>Rückweg nicht mehr möglich: {v.rueckweg.gruende.join(' ')}</div>}
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        {v.rueckweg.moeglich && <Knopf leise aus={laeuft} onClick={() => setFrage('rueckweg')}>Rückweg …</Knopf>}
        {(v.anzahl > 0 || v.offen) && <Knopf aus={laeuft} onClick={() => setFrage('ausfuehren')}>{v.offen ? 'Umzug fortsetzen …' : 'Umstellen …'}</Knopf>}
      </div>
      {frage && (
        <Fenster titel={frage === 'ausfuehren' ? 'Kennungen umstellen' : 'Umzug zurücknehmen'} onZu={() => setFrage(null)} breit={560}>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
            {frage === 'ausfuehren'
              ? `${v.anzahl} Kontakte bekommen eine zufällige Kennung; ${summe(v.speicher)} Verweise in ${bestaende.length} Beständen werden mitgezogen, dazu Such-Index und Protokoll-Fingerabdrücke. Vorher entsteht eine Archivkopie (30 Tage). Besser, wenn gerade niemand im CRM arbeitet — es dauert Sekunden.`
              : 'Alle Kontakte des letzten Umzugs bekommen ihre alte Kennung zurück, alle Verweise werden zurückgebogen. Geht nur, solange keiner von ihnen seitdem geändert wurde.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Knopf leise onClick={() => setFrage(null)}>Abbrechen</Knopf>
            <Knopf aus={laeuft} onClick={() => void los(frage)}>{laeuft ? 'Läuft …' : frage === 'ausfuehren' ? 'Jetzt umstellen' : 'Jetzt zurücknehmen'}</Knopf>
          </div>
        </Fenster>
      )}
    </Karte>
  );
}

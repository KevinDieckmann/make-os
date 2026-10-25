'use client';

// ─── Öffentliche Seite „Angebot anfordern“ — für externe Vertriebler (25.10.2026) ───────────────────────────────────────────────────────
// Das Formular ist dasselbe Bauteil wie im Team (components/os/crm/formulare/AnfrageFormular.tsx) — ohne Kundensuche, ohne Rabatt, nur die Produkte
// des Links. Spam-Schutz wie die Buchung: unsichtbares Feld (Honigtopf) und der Formular-Stempel des Servers. Nach dem Absenden sieht der Vertriebler
// nur das Ergebnis SEINER Anfrage („ist raus“ bzw. „liegt bei uns zur Prüfung“) — nie, ob der Kunde schon bekannt war.

import { useEffect, useState } from 'react';
import { AnfrageFormular, leereWerte, type AnfrageWerte, type AnfrageErgebnis } from '@/components/os/crm/formulare/AnfrageFormular';
import { Hinweis } from '@/components/os/ui';
import type { KatalogProdukt } from '@/lib/crm/formulare';
import { C, seite, rahmen, karte, titel, leise, klein, feld } from '@/components/buchen/stil';

interface Daten { ok: boolean; fehler?: string; stempel: string; seite: { vertriebler: string; produkte: KatalogProdukt[]; datenschutz: { verantwortlich: string | null; seite: string | null } } }

export function AngebotAnfordernSeite({ slug }: { slug: string }) {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [werte, setWerte] = useState<AnfrageWerte>(leereWerte());
  const [falle, setFalle] = useState('');
  const laden = async () => {
    try {
      const r = await fetch(`/api/angebot/${slug}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Die Seite konnte nicht geladen werden.'); return; }
      setD(j);
    } catch { setFehler('Keine Verbindung — bitte später noch einmal.'); }
  };
  useEffect(() => { void laden(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const senden = async (anfrage: Record<string, unknown>, anfrageId: string): Promise<AnfrageErgebnis> => {
    try {
      const r = await fetch(`/api/angebot/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anfrageId, anfrage, stempel: d?.stempel, webseite: falle }) });
      return await r.json() as AnfrageErgebnis;
    } catch { return { ok: false, fehler: 'Keine Verbindung — bitte noch einmal senden.' }; }
  };
  const ds = d?.seite.datenschutz;
  return (
    <main style={seite}>
      <div style={rahmen}>
        <h1 style={titel}>Angebot anfordern</h1>
        {fehler && <div style={karte}><p style={leise}>{fehler}</p></div>}
        {d && (
          <div style={karte}>
            <p style={{ ...leise, marginTop: 0 }}>Hallo {d.seite.vertriebler} — trag den Kunden ein, der ein Angebot braucht, und wähle die Produkte. Das Angebot geht nach dem Absenden an die angegebene Adresse oder nach einer kurzen Prüfung.</p>
            <AnfrageFormular katalog={d.seite.produkte} werte={werte} setWerte={setWerte} onSenden={senden} onNeu={() => { setWerte(leereWerte()); void laden(); }}
              extra={(
                // Honigtopf: Menschen sehen und füllen das Feld nicht.
                <div aria-hidden style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
                  <label>Webseite<input tabIndex={-1} autoComplete="off" value={falle} onChange={e => setFalle(e.target.value)} style={feld} /></label>
                </div>
              )}
              hinweisUnten={(
                <Hinweis art="info" titel="Datenschutz">
                  <span style={{ ...klein, color: C.inkDim }}>
                    Bitte nur Angaben eines Kunden eintragen, der ein Angebot angefragt hat. Verantwortlich für die Verarbeitung: {ds?.verantwortlich ?? 'siehe Datenschutzhinweis'}. Die Angaben dienen nur der Erstellung und dem Versand des Angebots (Art. 6 Abs. 1 lit. b DSGVO); der Kunde erhält mit dem Angebot einen Datenschutzhinweis.
                    {ds?.seite && <> Mehr: <a href={ds.seite} rel="noopener noreferrer" target="_blank" style={{ color: C.aktiv }}>Datenschutzhinweis</a>.</>}
                  </span>
                </Hinweis>
              )} />
          </div>
        )}
      </div>
    </main>
  );
}

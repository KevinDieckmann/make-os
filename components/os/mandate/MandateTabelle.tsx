'use client';

// ─── Mandate aus Excel einfügen — Karte unter Produkte & Mandate (09.10., ONBOARDING_PLAN.md › B9 c / L28) ──────────────────────────
// Mehrere Mandate auf einmal: Kunde/Firma, Produkt, Honorar netto/Monat, Start, Laufzeit, Gesellschaft (+ Titel, Ende, Status, USt). Vorschau
// zeigt je Zeile, welche Firma es wird (vorhanden · neu · aus dem Papierkorb), und ob das Mandat neu, geändert, gleich oder übersprungen ist.
// Übernehmen nur mit der Vorschau-Kennung, Rückgängig nur Unverändertes. Regeln und Schreibwege: lib/crm/mandate-tabelle(-server).ts,
// Route /api/crm/mandate-tabelle. Die Gesellschaft ist Pflicht — aus der Spalte oder oben für alle Zeilen (nie „offen“).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT, EinfuegeTabelle, type EinfuegeErgebnis } from '../ui';
import { GesellschaftWahl } from '../crm/GesellschaftWahl';
import { MANDAT_FELDER } from '@/lib/crm/mandate-tabelle';
import type { Datensatz, VorschauAntwort } from '@/lib/tabelle/einfuegen';
import type { Gesellschaft } from '@/lib/crm/typen';

interface LaufKurz { id: string; am: string; status: string; mandate: number; firmen: number }

async function post(body: Record<string, unknown>) {
  return fetch('/api/crm/mandate-tabelle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts übernommen.' }));
}

export function MandateTabelle({ onGeaendert, i = 3 }: { onGeaendert: () => void | Promise<void>; i?: number }) {
  const [auf, setAuf] = useState(false);
  const [gesellschaft, setGesellschaft] = useState<Gesellschaft>('offen');
  const [laeufe, setLaeufe] = useState<LaufKurz[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const laufeLaden = useCallback(() => {
    fetch('/api/crm/mandate-tabelle', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setLaeufe(d?.laeufe ?? [])).catch(() => setLaeufe([]));
  }, []);
  useEffect(() => { if (auf) laufeLaden(); }, [auf, laufeLaden]);
  const fertig = () => { laufeLaden(); void onGeaendert(); };
  const zurueck = (laufId: string) => async () => {
    const r = await post({ aktion: 'zurueck', laufId });
    fertig();
    return { ok: !!r.ok, text: r.text as string | undefined, fehler: r.fehler as string | undefined };
  };
  const vorgabe = gesellschaft !== 'offen' ? { gesellschaft } : {};

  return (
    <Karte i={i} akzent={LEUCHT.geld}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={<Knopf leise onClick={() => setAuf(!auf)}>{auf ? 'Schließen' : 'Öffnen'}</Knopf>}>Mandate aus Excel einfügen</Ueberschrift>
      {!auf && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Mehrere Mandate auf einmal — Kunde, Produkt, Honorar je Monat, Start, Laufzeit, Gesellschaft. Erst eine Vorschau, dann übernehmen; „Rückgängig“ nimmt Unverändertes zurück.</div>}
      {auf && (
        <div style={{ display: 'grid', gap: 12 }}>
          <EinfuegeTabelle felder={MANDAT_FELDER} einheit={{ eins: 'Mandat', viele: 'Mandate' }} farbe={LEUCHT.geld} kontext={gesellschaft}
            beispiel="Aus Excel: Kunde | Produkt | Honorar netto/Monat | Start | Laufzeit (Monate) | Gesellschaft"
            oben={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Gesellschaft für Zeilen ohne eigene Angabe:</span>
              <GesellschaftWahl wert={gesellschaft} onWahl={setGesellschaft} />
              {gesellschaft === 'offen' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>keine — dann braucht jede Zeile ihre Gesellschaft</span>}
            </div>}
            vorschau={async (zeilen: Datensatz[]) => (await post({ aktion: 'vorschau', zeilen, ...vorgabe })) as VorschauAntwort | { ok: false; fehler?: string }}
            uebernehmen={async (zeilen, basis, auswahl): Promise<EinfuegeErgebnis> => {
              const r = await post({ aktion: 'uebernehmen', zeilen, basis, ...vorgabe, ...(auswahl ? { auswahl } : {}) });
              return { ok: !!r.ok, fehler: r.fehler, vorschau: r.vorschau, text: r.text, hinweise: r.hinweise, ...(r.laufId ? { rueckgaengig: zurueck(r.laufId) } : {}) };
            }}
            onGeaendert={fertig} />
          {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}
          {laeufe.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Letzte Einfügungen</span>
              {laeufe.slice(0, 5).map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', fontSize: TYP.bedien, color: C.inkLeise }}>
                  <span>{new Date(l.am).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · {l.mandate} Mandat{l.mandate === 1 ? '' : 'e'}{l.firmen ? ` · ${l.firmen} Firma${l.firmen === 1 ? '' : 'en'} neu` : ''}
                    {l.status === 'zurueckgenommen' ? ' · zurückgenommen' : l.status === 'teilweise' ? ' · teilweise zurück' : l.status === 'fehlgeschlagen' ? ' · nicht übernommen' : ''}</span>
                  {(l.status === 'uebernommen' || l.status === 'teilweise' || (l.status === 'fehlgeschlagen' && l.firmen > 0)) &&
                    <Knopf leise onClick={async () => { const r = await zurueck(l.id)(); setMeldung(r.ok ? r.text ?? 'Zurückgenommen.' : r.fehler ?? 'Nicht zurückgenommen.'); }}>Rückgängig</Knopf>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Karte>
  );
}

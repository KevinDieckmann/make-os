'use client';

// ─── Angebot: Termin zum Besprechen vorschlagen (K6a, 29.09.; Verbindung aus K4) ─
// Ein Knopf im Angebots-Tool: zeigt die freie Zeit der Person (GET /api/kalender/frei — die EINE Lesefunktion
// `freieZeitFuer`, nur Zeiten, nie Titel) und öffnet per Klick auf eine Zeit den Termin-Entwurf (Anlege-Dialog des
// Kalenders, vorbelegt mit Kontakt/Firma/Deal als Bezug). Nichts geschieht ohne Klick: angelegt wird erst mit
// „Speichern“ im Dialog, Gäste nur nach der Einladungs-Rückfrage (K3).

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Knopf } from '../../schlank';
import { NeuerTermin } from '../../kalender/NeuerTermin';
import type { Vorgabe } from '@/lib/kalender/formular';
import type { FreieZeit } from '@/lib/kalender/verfuegbar';

const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const zeitText = (v: FreieZeit) => `${WT[new Date(`${v.tag}T12:00:00Z`).getUTCDay()]} ${Number(v.tag.slice(8, 10))}.${Number(v.tag.slice(5, 7))}. ${v.start.slice(11, 16)}`;

/**
 * Termintitel: „Angebot besprechen: <Titel>“ — ohne Titel (Restpunkte 29.09.) Nummer und Kunde aus dem Angebot statt
 * „Angebot besprechen: Angebot“; fehlt auch das, nur „Angebot besprechen“.
 */
export function angebotTerminTitel(e: { titel?: string; nummer?: string; kunde?: string }): string {
  const was = e.titel?.trim() || [e.nummer?.trim(), e.kunde?.trim()].filter(Boolean).join(' · ');
  return (was ? `Angebot besprechen: ${was}` : 'Angebot besprechen').slice(0, 120);
}

/** Termin-Vorgabe aus einer freien Zeit (rein, getestet). */
export function vorgabeAusFreierZeit(v: FreieZeit, e: { titel: string; nummer?: string; kunde?: string; kontaktId?: string; firmaId?: string; dealId?: string }): Vorgabe {
  return {
    tag: v.tag, von: v.start.slice(11, 16), bis: v.ende.slice(11, 16), art: 'termin', titel: angebotTerminTitel(e),
    crm: { ...(e.kontaktId ? { kontaktId: e.kontaktId } : {}), ...(e.firmaId ? { firmaId: e.firmaId } : {}), ...(e.dealId ? { dealId: e.dealId } : {}) },
  };
}

export function TerminVorschlag({ ich, heute, titel, nummer, kunde, kontaktId, firmaId, dealId, dauerMin = 45 }: { ich: string; heute: string; titel: string; nummer?: string; kunde?: string; kontaktId?: string; firmaId?: string; dealId?: string; dauerMin?: number }) {
  const [liste, setListe] = useState<FreieZeit[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<FreieZeit | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const suchen = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/kalender/frei?personen=${encodeURIComponent(ich)}&dauer=${dauerMin}&tage=14`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
      if (r.ok) setListe((r.vorschlaege as FreieZeit[]).slice(0, 6)); else setFehler(r.fehler ?? 'Freie Zeit nicht geladen.');
    } finally { setLaeuft(false); }
  };
  if (gewaehlt) {
    return (
      <NeuerTermin vorgabe={vorgabeAusFreierZeit(gewaehlt, { titel, nummer, kunde, kontaktId, firmaId, dealId })} heute={heute} standardDauer={dauerMin} kalender={[]} onZu={() => setGewaehlt(null)}
        onAngelegt={x => { setGewaehlt(null); setListe(null); if (x.uid) setFertig(`Termin am ${zeitText(gewaehlt)} steht im Kalender — mit Bezug zum Kontakt${dealId ? ' und Deal' : ''}.`); }} />
    );
  }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knopf leise aus={laeuft} onClick={() => void suchen()}>{laeuft ? 'sucht …' : 'Termin zum Besprechen vorschlagen'}</Knopf>
        {fertig && <span style={{ fontSize: 12.5, color: LEUCHT.gut }}>{fertig}</span>}
        {fehler && <span style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</span>}
      </div>
      {liste && (liste.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.inkLeise }}>Frei ({dauerMin} Min.):</span>
          {liste.map(v => (
            <button key={v.start} type="button" onClick={() => setGewaehlt(v)} title="Termin-Entwurf öffnen — angelegt wird erst mit Speichern"
              style={{ border: `1px solid ${LEUCHT.business}66`, background: 'transparent', color: LEUCHT.business, borderRadius: 999, padding: '3px 10px', fontSize: TYP.bedien, cursor: 'pointer' }}>
              {zeitText(v)}{v.feiertag ? ` (${v.feiertag})` : ''}
            </button>
          ))}
        </div>
      ) : <span style={{ fontSize: 12.5, color: C.inkLeise }}>Keine freie Zeit in den nächsten 14 Tagen (Arbeitszeit aus der Wochenvorlage).</span>)}
    </div>
  );
}

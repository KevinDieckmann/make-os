'use client';

// ─── Netzwerken — Pop-up für Meldungen der anderen Person (02.10.) ───────────
// „Malin hat dir einen Termin gebucht: Videocall mit …, Mo 05.10. um 10:00 Uhr.“ — liegt eine ungelesene Meldung der Art
// „netzwerken“ in der Glocke (Termin gebucht bzw. Person zugeteilt), zeigt sie diese Karte EINMAL: „Öffnen“ führt zum Termin bzw.
// zur Person, „OK“ schließt. Beides setzt die Meldung auf gelesen — danach kommt sie nicht wieder. Läuft auf JEDER /os-Seite
// (app/os/layout.tsx), auf der vorhandenen Meldungs-Infrastruktur (`useGlockenSicht`: dieselbe Abfrage wie die Glocke, ≤ 60 s).

import Link from 'next/link';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { FARBE as C, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { useGlockenSicht } from '../Glocke';

export function NetzwerkenPopup() {
  const { sicht, gelesen } = useGlockenSicht();
  // Auf der Netzwerken-Seite liegt unten die Hauptaktion (Weiter/Speichern) — dort erscheint die Karte oben statt darüber.
  const oben = (usePathname() ?? '').startsWith('/os/netzwerken');
  // Was diese Seite schon geschlossen hat, bleibt zu — auch bevor die Antwort des Servers „gelesen“ meldet.
  const zu = useRef(new Set<string>());
  const offen = (sicht?.meldungen ?? []).filter(m => m.art === 'netzwerken' && !m.gelesen && !zu.current.has(m.id));
  const m = offen[0];
  if (!m) return null;
  const schliessen = () => { zu.current.add(m.id); gelesen([m.id]); };
  return (
    <div role="alertdialog" aria-labelledby="nw-popup-titel" aria-live="assertive" data-netzwerken-popup
      style={{ position: 'fixed', left: 12, right: 12, ...(oben ? { top: 'calc(12px + env(safe-area-inset-top))' } : { bottom: 'calc(84px + env(safe-area-inset-bottom))' }), zIndex: 95, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: 'min(440px, 100%)', borderRadius: 18, background: C.flaeche, border: `1px solid ${LEUCHT.beziehung}66`, boxShadow: '0 18px 50px -12px rgba(0,0,0,.8)', padding: '14px 16px', display: 'grid', gap: 12, fontFamily: SCHRIFT.text, color: C.ink }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `${LEUCHT.beziehung}1F`, color: LEUCHT.beziehung }}><Handshake size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: LEUCHT.beziehung }}>Netzwerken{offen.length > 1 ? ` · ${offen.length} neu` : ''}</div>
            <div id="nw-popup-titel" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, marginTop: 2, overflowWrap: 'anywhere' }}>{m.titel}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href={m.link} onClick={schliessen} className="fassbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14, textDecoration: 'none', fontSize: 16, fontWeight: 700, border: `1px solid ${C.aktiv}80`, background: `${C.aktiv}24`, color: C.aktiv }}>Öffnen</Link>
          <button type="button" onClick={schliessen} className="fassbar" style={{ minHeight: 48, borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 16, fontWeight: 700, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: C.ink }}>OK</button>
        </div>
      </div>
    </div>
  );
}

'use client';

// ─── Kalender-Kopf: „letzter Abgleich vor X Min.“ (R-K1 #51, Anzeige in R-K2, 29.09.) ─
// Die Kalender-Antwort trägt `abgleich` (app/api/kalender/route.ts, lib/kalender/icloud.ts `abgleichAlter`): Minuten
// seit dem letzten GELUNGENEN Abgleich, `veraltet` ab 30 Min., Fehler/Anmeldung und übersprungene Kalender (`hinweise`:
// 403 je Kalender, gekürzte Antwort 507). Ab 30 Min. hebt die Anzeige sich ab (Achtung-Farbe) — dieselbe Grenze, ab der
// die Buchungsseite keine Plätze mehr zeigt (lib/kalender/buchung.ts `standBuchbar`).

import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../schlank';

export interface AbgleichInfo { letzter: string | null; vorMin: number | null; veraltet: boolean; fehler?: string; anmeldung?: true; hinweise?: { kalender: string; grund: string }[]; naechsterVersuch?: string }

/** „gerade eben“, „vor 12 Min.“, „vor 3 Std.“, „noch nie“. */
export function abgleichText(vorMin: number | null): string {
  if (vorMin === null) return 'noch nie abgeglichen';
  if (vorMin < 1) return 'letzter Abgleich gerade eben';
  if (vorMin < 60) return `letzter Abgleich vor ${vorMin} Min.`;
  const h = Math.floor(vorMin / 60);
  return h < 48 ? `letzter Abgleich vor ${h} Std.` : `letzter Abgleich vor ${Math.floor(h / 24)} Tagen`;
}

export function AbgleichStand({ a }: { a?: AbgleichInfo }) {
  if (!a) return null;
  const warn = a.veraltet || !!a.fehler || !!a.anmeldung;
  const titel = [
    a.letzter ? `Stand ${new Date(a.letzter).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : '',
    a.anmeldung ? 'iCloud lehnt die Anmeldung ab — neu verbinden (System › Konto).' : a.fehler ? `Abgleich gescheitert: ${a.fehler}` : '',
    a.naechsterVersuch ? `Nächster Versuch ${new Date(a.naechsterVersuch).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontFamily: SCHRIFT.text, fontSize: 11.5, fontWeight: 500 }}>
      <span role={warn ? 'status' : undefined} title={titel || undefined}
        style={{ color: warn ? LEUCHT.achtung : C.inkLeise, ...(warn ? { background: `${LEUCHT.achtung}1a`, border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 999, padding: '1px 8px' } : {}) }}>
        {a.anmeldung ? 'iCloud-Anmeldung abgelehnt · ' : a.fehler ? 'Abgleich gescheitert · ' : ''}{abgleichText(a.vorMin)}
      </span>
      {(a.hinweise ?? []).map(h => (
        <span key={`${h.kalender}:${h.grund}`} role="note" style={{ color: LEUCHT.achtung, fontSize: 11.5 }}>„{h.kalender}“: {h.grund}</span>
      ))}
    </span>
  );
}

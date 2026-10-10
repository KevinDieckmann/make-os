'use client';

// ─── Kalender-Kopf: „letzter Abgleich vor X Min.“ (R-K1 #51, Anzeige in R-K2, 29.09.) ─
// Die Kalender-Antwort trägt `abgleich` (app/api/kalender/route.ts, lib/kalender/icloud.ts `abgleichAlter`): Minuten
// seit dem letzten GELUNGENEN Abgleich, `veraltet` ab 30 Min., Fehler/Anmeldung und übersprungene Kalender (`hinweise`:
// 403 je Kalender, gekürzte Antwort 507). Ab 30 Min. hebt die Anzeige sich ab (Achtung-Farbe) — dieselbe Grenze, ab der
// die Buchungsseite keine Plätze mehr zeigt (lib/kalender/buchung.ts `standBuchbar`).
// Seit 10.10. (Kevin: „oben stapeln sich die ‚letzter Abgleich …‘-Texte je Kalender“): in der Kopfzeile nur noch ein kleiner PUNKT je
// Quelle (`AbgleichPunkte`: grün · gelb · rot nach `abgleichAmpel`, lib/kalender/darstellung.ts) — der Tooltip nennt alles, ein Klick
// klappt die Einzelheiten (diese Zeilen) auf, mit „Jetzt abgleichen“. Die Textform bleibt für die Verbindungs-Karten.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { abgleichAmpel, schlechtesteAmpel, type Ampel } from '@/lib/kalender/darstellung';
import { Knopf, LEUCHT } from '../ui';

export interface AbgleichInfo { letzter: string | null; vorMin: number | null; veraltet: boolean; fehler?: string; anmeldung?: true; hinweise?: { kalender: string; grund: string }[]; naechsterVersuch?: string }

/** „gerade eben“, „vor 12 Min.“, „vor 3 Std.“, „noch nie“. */
export function abgleichText(vorMin: number | null): string {
  if (vorMin === null) return 'noch nie abgeglichen';
  if (vorMin < 1) return 'letzter Abgleich gerade eben';
  if (vorMin < 60) return `letzter Abgleich vor ${vorMin} Min.`;
  const h = Math.floor(vorMin / 60);
  return h < 48 ? `letzter Abgleich vor ${h} Std.` : `letzter Abgleich vor ${Math.floor(h / 24)} Tagen`;
}

export function AbgleichStand({ a, quelle = 'iCloud', bezeichnung }: { a?: AbgleichInfo; /** Woher der Stand kommt (iCloud, Google). */ quelle?: string; /** Name des Kalenders (bei mehreren Quellen nebeneinander). */ bezeichnung?: string }) {
  if (!a) return null;
  const warn = a.veraltet || !!a.fehler || !!a.anmeldung;
  const titel = [
    a.letzter ? `Stand ${new Date(a.letzter).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : '',
    a.anmeldung ? (quelle === 'iCloud' ? 'iCloud lehnt die Anmeldung ab (App-Passwort ungültig) — Kalender › Einstellungen › iCloud: Verbindung erneuern.' : `${quelle} lehnt die Anmeldung ab — neu verbinden (Kalender › Einstellungen).`) : a.fehler ? `Abgleich gescheitert: ${a.fehler}` : '',
    a.naechsterVersuch ? `Nächster Versuch ${new Date(a.naechsterVersuch).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 500 }}>
      <span role={warn ? 'status' : undefined} title={titel || undefined}
        style={{ color: warn ? LEUCHT.achtung : C.inkLeise, ...(warn ? { background: `${LEUCHT.achtung}1a`, border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 999, padding: '1px 8px' } : {}) }}>
        {bezeichnung ? `${bezeichnung}: ` : ''}{a.anmeldung ? `${quelle}-Anmeldung abgelehnt · ` : a.fehler ? 'Abgleich gescheitert · ' : ''}{abgleichText(a.vorMin)}
      </span>
      {(a.hinweise ?? []).map(h => (
        <span key={`${h.kalender}:${h.grund}`} role="note" style={{ color: LEUCHT.achtung, fontSize: TYP.bedien }}>„{h.kalender}“: {h.grund}</span>
      ))}
    </span>
  );
}

/** Eine Abgleich-Quelle der Kopfzeile: Anzeigename („iCloud“, „Meine iCloud“, „<Kalender> (Google)“), Art der Quelle, Stand. */
export interface AbgleichQuelle { name: string; quelle: string; a: AbgleichInfo }

const AMPEL_FARBE: Record<Ampel, string> = { gut: LEUCHT.gut, achtung: LEUCHT.achtung, kritisch: LEUCHT.kritisch };
const AMPEL_WORT: Record<Ampel, string> = { gut: 'aktuell', achtung: 'bitte prüfen', kritisch: 'gestört' };

/** Ein Satz je Quelle — für den Tooltip. */
export function abgleichSatz(q: AbgleichQuelle): string {
  const a = q.a;
  const vorne = a.anmeldung ? `${q.quelle}-Anmeldung abgelehnt · ` : a.fehler ? `Abgleich gescheitert (${a.fehler}) · ` : '';
  const n = (a.hinweise ?? []).length;
  return `${q.name}: ${vorne}${abgleichText(a.vorMin)}${n ? ` · ${n} Kalender übersprungen` : ''}`;
}

/** Punkte je Quelle in der Kopfzeile; Klick klappt die Einzelheiten auf (Esc oder Klick daneben schließt). */
export function AbgleichPunkte({ quellen, onAbgleichen, laeuft }: { quellen: readonly AbgleichQuelle[]; /** „Jetzt abgleichen“ (nur, wenn verbunden). */ onAbgleichen?: () => void; laeuft?: boolean }) {
  const [auf, setAuf] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuf(false); };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  if (!quellen.length) return null;
  const ampeln = quellen.map(q => abgleichAmpel(q.a));
  const gesamt = schlechtesteAmpel(ampeln) ?? 'gut';
  return (
    <div ref={box} data-abgleich={gesamt} style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-expanded={auf} aria-controls="kalender-abgleich" title={quellen.map(abgleichSatz).join('\n')}
        aria-label={`Abgleich ${AMPEL_WORT[gesamt]} — Einzelheiten`} className="fassbar"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 40, minWidth: 40, padding: '0 10px', border: 'none', borderRadius: 999, background: gesamt === 'gut' ? 'transparent' : `${AMPEL_FARBE[gesamt]}14`, cursor: 'pointer' }}>
        {ampeln.map((x, i) => <span key={`${quellen[i].name}-${i}`} aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: AMPEL_FARBE[x], boxShadow: x === 'gut' ? undefined : `0 0 0 3px ${AMPEL_FARBE[x]}26` }} />)}
      </button>
      {auf && (
        <div id="kalender-abgleich" role="dialog" aria-label="Abgleich der Kalender"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 45, width: 'min(360px, calc(100vw - 32px))', display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)', fontFamily: SCHRIFT.text }}>
          {quellen.map((q, i) => (
            <div key={`${q.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0, 1fr)', gap: '2px 10px', alignItems: 'center' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: AMPEL_FARBE[ampeln[i]] }} />
              <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600 }}>{q.name}</span>
              <span />
              <AbgleichStand a={q.a} quelle={q.quelle} />
            </div>
          ))}
          {onAbgleichen && <div><Knopf leise aus={laeuft} onClick={onAbgleichen}>{laeuft ? 'gleicht ab …' : '↻ Jetzt abgleichen'}</Knopf></div>}
        </div>
      )}
    </div>
  );
}

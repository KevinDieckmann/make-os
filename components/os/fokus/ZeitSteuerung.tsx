'use client';

// ─── Fokus › Zeit: Soll gegen Ist je Thema (10.10.) ─────────────────────────────────────────────────────────────────────────────
// Entscheidung 10.10.: „welche Zeit wir dafür reingeben wollen und wo der Fokus draufgeht“ — je Thema des Bereichs: mein Soll (h/Woche,
// Eingabe), meine Ist-Zeit der letzten 7 Tage (Zeitmessung: Seiten + bewusst, Einheiten aus ihren Fokus-Blöcken; Privat dazu, was als
// Erholung/Reha im Kalender eingeplant ist) und die Ampel „Fokus und Zeit passen (nicht) zusammen“ — gerechnet NUR auf dem Server
// (lib/fokus/steuerung.ts `passung`). „▶“ startet einen Fokus für das Thema (lib/zeitmessung/fokus-laufend.ts `fokusFuerThema`).

import { useEffect, useState } from 'react';
import { Play, Timer } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { zeitText } from '@/lib/zeitmessung/modell';
import { fokusFuerThema } from '@/lib/zeitmessung/fokus-laufend';
import { einheitAusGesellschaft } from '@/lib/einheiten';
import { SOLL_MAX, type PassStufe, type SteuerBereich } from '@/lib/fokus/steuerung';
import { Karte, Ueberschrift, Hinweis, Leerzustand, Fortschritt, SymbolKnopf, Chip, feld } from '../ui';
import { themaFarbe } from './Prioritaeten';
import type { SteuerungSicht } from './useSteuerung';

export const STUFE_FARBE: Record<PassStufe, string> = { gut: LEUCHT.gut, achtung: LEUCHT.achtung, kritisch: LEUCHT.kritisch, offen: C.inkLeise };
export const STUFE_ART: Record<PassStufe, 'gut' | 'achtung' | 'kritisch' | 'info'> = { gut: 'gut', achtung: 'achtung', kritisch: 'kritisch', offen: 'info' };
const STUFE_WORT: Record<PassStufe, string> = { gut: 'passt', achtung: 'knapp', kritisch: 'passt nicht', offen: 'offen' };

export function ZeitSteuerung({ s, bereich, sollSetzen, i = 0 }: {
  s: SteuerungSicht; bereich: SteuerBereich; sollSetzen: (id: string, h: number | null) => Promise<{ ok: boolean; meldung?: string }>; i?: number;
}) {
  const [meldung, setMeldung] = useState<string | null>(null);
  const starten = (t: SteuerungSicht['themen'][number]) => {
    const r = fokusFuerThema({ bereich, label: t.label, quelle: t.einheit ? 'fokus' : t.zeit[0], ...(t.einheit ? { einheit: einheitAusGesellschaft(t.einheit) ?? t.einheit } : {}) });
    setMeldung(r.art === 'laeuft' ? `Es läuft schon ein Fokus („${r.label}“) — erst oben rechts beenden.` : null);
  };
  return (
    <Karte i={i} akzent={s.passung.stufe === 'kritisch' ? LEUCHT.kritisch : undefined}>
      <Ueberschrift farbe={STUFE_FARBE[s.passung.stufe]} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{zeitText(s.gesamtSek)} in 7 Tagen</span>}>Zeit</Ueberschrift>
      <Hinweis art={STUFE_ART[s.passung.stufe]} rolle="status">{s.passung.satz}</Hinweis>
      {meldung && <Hinweis art="achtung" rolle="status">{meldung}</Hinweis>}
      {!s.themen.length ? (
        <Leerzustand symbol={<Timer size={18} />} titel="Noch keine Themen">Erst oben unter Prioritäten Themen anlegen — dann hier das Soll je Woche eintragen.</Leerzustand>
      ) : (
        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {s.themen.map((t, idx) => {
            const farbe = STUFE_FARBE[t.pass.stufe];
            const anteil = t.soll ? t.ist.sek / (t.soll * 3600) : 0;
            return (
              <div key={t.id} className="fokus-zeit-zeile" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', padding: '12px 2px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ minWidth: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: themaFarbe(idx), flex: '0 0 auto' }} />
                  <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                  <Chip farbe={farbe}>{STUFE_WORT[t.pass.stufe]}</Chip>
                </div>
                <SymbolKnopf ariaLabel={`Fokus für „${t.label}“ starten`} onClick={() => starten(t)}><Play size={15} /></SymbolKnopf>
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 132px', gap: 12, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                      <span><b style={{ color: C.ink, fontWeight: 600 }}>{zeitText(t.ist.sek)}</b>{t.soll ? ` von ${t.soll.toLocaleString('de-DE')} h` : ' ohne Soll'}</span>
                      {t.ist.bewusstSek > 0 && <span>davon {zeitText(t.ist.bewusstSek)} bewusst</span>}
                      {t.ist.eingeplantSek > 0 && <span>{zeitText(t.ist.eingeplantSek)} diese Woche eingeplant</span>}
                    </div>
                    <Fortschritt anteil={t.soll ? Math.min(1, anteil) : 0} farbe={farbe} />
                    <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{t.pass.satz}</div>
                  </div>
                  <SollFeld wert={t.soll} label={`Soll für „${t.label}“ in Stunden je Woche`} onSpeichern={async h => { const r = await sollSetzen(t.id, h); setMeldung(r.ok ? null : r.meldung ?? 'Nicht gespeichert.'); }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12 }}>
        Ist = deine gemessene Zeit der letzten 7 Tage (Seiten und bewusster Fokus) — nur aus {bereich === 'privat' ? 'Privat' : 'Business'}. Das Soll siehst nur du.
      </div>
    </Karte>
  );
}

/** Soll-Eingabe (h/Woche): lokaler Entwurf, Enter/Verlassen speichert; leer = kein Soll. */
function SollFeld({ wert, label, onSpeichern }: { wert: number | null; label: string; onSpeichern: (h: number | null) => Promise<void> }) {
  const [entwurf, setEntwurf] = useState(wert != null ? String(wert).replace('.', ',') : '');
  useEffect(() => { setEntwurf(wert != null ? String(wert).replace('.', ',') : ''); }, [wert]);
  const speichern = () => {
    const t = entwurf.trim().replace(',', '.');
    const h = t ? Number(t) : null;
    if (h != null && (!Number.isFinite(h) || h < 0 || h > SOLL_MAX)) { setEntwurf(wert != null ? String(wert).replace('.', ',') : ''); return; }
    if ((h ?? null) === (wert ?? null) || (h === 0 && wert == null)) return;
    void onSpeichern(h && h > 0 ? h : null);
  };
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>
      Soll h/Woche
      <input inputMode="decimal" value={entwurf} placeholder="—" aria-label={label}
        onChange={e => setEntwurf(e.target.value)} onBlur={speichern} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ ...feld, textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: 0, textTransform: 'none' }} />
    </label>
  );
}

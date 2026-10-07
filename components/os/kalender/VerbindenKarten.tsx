'use client';

// ─── Kalender — „verbinden“ im Bereich, wo es hingehört (06.10.2026) ────────
// Kevin 06.10.: Im Bereich Business steht gut sichtbar „<Firma> verbinden“ (Google Workspace), solange die EIGENE Person ihren
// Google-Kalender nicht verbunden hat — Vorbild „Gmail verbinden“ in der Inbox. Im Bereich Privat ebenso die eigene iCloud.
// Verbunden → die Karte verschwindet, es bleibt ein kleiner Hinweis. Welche Anzeige: lib/kalender/verbinden-anzeige.ts (rein).
// Der Google-Weg ist DERSELBE wie in den Einstellungen (./google-verbinden.ts); die iCloud-Karte IST die Einstellungs-Karte
// (IcloudVerbindung). Nur die eigene Person (die Status-Routen kennen nur sie), nie Zugangsdaten im Browser.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { UG_NAME } from '@/lib/einheiten';
import { Karte, Knopf, Hinweis, LEUCHT } from '../ui';
import { verbindenAnzeige, firmaOhneRechtsform, type GoogleKurz, type IcloudKurz, type KalenderBereich } from '@/lib/kalender/verbinden-anzeige';
import { googleKalenderStandLaden, googleKalenderVerbinden, GOOGLE_NICHT_EINGERICHTET } from './google-verbinden';
import { IcloudVerbindung } from './IcloudVerbindung';

/** Die Firma, deren Google Workspace den Business-Kalender trägt — aus der Instanz (lib/einheiten.ts), ohne Rechtsform. */
export const FIRMA = firmaOhneRechtsform(UG_NAME);

/** Karte „<Firma> verbinden“ (nur Darstellung — testbar ohne Netz). */
export function GoogleVerbindenKarte({ stand, firma = FIRMA, arbeit, fehler, onVerbinden }: { stand: GoogleKurz; firma?: string; arbeit?: boolean; fehler?: string | null; onVerbinden: () => void }) {
  const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55 } as const;
  return (
    <Karte i={0} akzent={LEUCHT.puls}>
      <div data-verbinden="google" style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: TYP.body }}>{firma} verbinden</div>
        {stand.getrennt && <div style={{ fontSize: 13, color: LEUCHT.kritisch }}>Die Verbindung ist nicht mehr gültig ({stand.getrennt.grund}). Bitte neu verbinden.</div>}
        <div style={klein}>
          Die Business-Termine von {firma} erscheinen hier im Kalender und gleichen in beide Richtungen mit deinem Google Kalender (Workspace) ab.
          Du meldest dich bei Google mit deinem Workspace-Konto an; MAKE OS bekommt nur die Freigabe für den Kalender — keine Mails, keine Dateien.
        </div>
        {fehler && <Hinweis art="achtung" rolle="status">{fehler}</Hinweis>}
        {!stand.konfiguriert
          ? <div style={{ ...klein, color: LEUCHT.achtung }}>{GOOGLE_NICHT_EINGERICHTET}</div>
          : <div><Knopf haupt onClick={onVerbinden} aus={arbeit}>{arbeit ? 'öffnet Google …' : stand.getrennt ? 'Neu verbinden' : `${firma} verbinden`}</Knopf></div>}
      </div>
    </Karte>
  );
}

/** Kleiner Hinweis, wenn verbunden („<Firma> · Google verbunden“). */
export function VerbundenHinweis({ text }: { text: string }) {
  return <div data-verbunden="" style={{ fontSize: TYP.bedien, color: C.inkLeise, display: 'flex', alignItems: 'center', gap: 6 }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: C.aktiv }} />{text}</div>;
}

/**
 * Im Kalender oben im Hauptbereich: je nach Bereich die Karte bzw. der Hinweis der EIGENEN Verbindung. Lädt beide Stände
 * der eigenen Person; `onGeaendert` lädt den Kalender neu (z. B. nach dem Verbinden von iCloud).
 */
export function BereichVerbindungen({ bereich, onGeaendert }: { bereich: KalenderBereich; onGeaendert?: () => void }) {
  const [google, setGoogle] = useState<GoogleKurz | null>(null);
  const [icloud, setIcloud] = useState<IcloudKurz | null>(null);
  const [arbeit, setArbeit] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (bereich === 'business') setGoogle(await googleKalenderStandLaden<GoogleKurz>());
    if (bereich === 'privat') setIcloud(await fetch('/api/kalender/icloud', { cache: 'no-store' }).then(r => (r.ok ? r.json() as Promise<IcloudKurz> : null)).catch(() => null));
  }, [bereich]);
  useEffect(() => { void laden(); }, [laden]);

  const a = verbindenAnzeige(bereich, google, icloud);
  if (!a.google && !a.icloud) return null;
  const verbinden = async () => { setArbeit(true); setFehler(null); const f = await googleKalenderVerbinden(); setArbeit(false); if (f) setFehler(f.fehler); };
  return (
    <div data-bereich-verbindungen={bereich} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
      {a.google === 'karte' && google && <GoogleVerbindenKarte stand={google} arbeit={arbeit} fehler={fehler} onVerbinden={() => verbinden()} />}
      {a.google === 'hinweis' && <VerbundenHinweis text={`${FIRMA} · Google verbunden${google?.konto ? ` (${google.konto})` : ''}`} />}
      {a.icloud === 'karte' && <Karte i={0} akzent={LEUCHT.puls}><IcloudVerbindung onGeaendert={() => { void laden(); onGeaendert?.(); }} /></Karte>}
      {a.icloud === 'hinweis' && <VerbundenHinweis text={`iCloud verbunden${icloud?.konto ? ` (${icloud.konto})` : ''}${icloud?.haupt ? ' · Kalender des Haushalts' : ''}`} />}
    </div>
  );
}

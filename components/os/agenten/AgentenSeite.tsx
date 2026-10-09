'use client';

// ─── Agenten: ZOE, Heads, Mitarbeiter, Threads (09.10., Paket 2 „Oberfläche“; AGENTEN_KONZEPT.md C2 + C11) ─────
// Auftrag 08.10. spät: „Den ganzen Agent-Bereich im Business wie im Privaten aufs nächste Level bringen … direkt und
// systematisch mit den Agenten chatten.“ Aufbau (C2, Fragerunde Teil 1):
//   Breit (ab 1.180 px): links das Team wie Ordner (ZOE, Heads, aufgeklappt die Mitarbeiter-Threads) · Mitte ZOE mit Überblick
//   und Chat bzw. der gewählte Head (Reiter Chat · Aktivität · Mitarbeiter · Skills · Gedächtnis · Leistung · Einstellungen) bzw.
//   ein Mitarbeiter-Thread · rechts Wartet auf dich · Läuft · Als Nächstes · Fertig/Fehler.
//   Mittel (720–1.180 px): Team links, rechts Mitte und darunter der Hintergrund.
//   Handy (< 720 px): unten die Reiter Gespräch · Team · Läuft; ein Head oder Thread öffnet ganzflächig mit Zurück.
// Kopfleiste: „+ Neu ▾“, Freigaben, Geplant, Budget in Euro, Not-Aus, „⋯“ (Leitplanken, bisherige Übersicht = AgentenView).
// Adresse NUR über `WEG.agenten({ h, f })`; Ort wechseln = push (Verlauf-Regel), ein neuer Thread am selben Ort = replace.
// Daten: components/os/agenten/daten.ts (ein Client). Welche Heads, Threads und Läufe die Person sieht, entscheidet der Server —
// die Seite blendet nichts aus, sie gruppiert nur nach dem Kopf-Schalter (Alles · Privat · Business).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, ABSTAND, ECKE, LEUCHT, RAND, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useSpace } from '@/hooks/useSpace';
import { AgentenView } from '../AgentenView';
import { ZoeReiter } from '../ZoeReiter';
import { Chip, Hinweis, Karte, Knopf, Seite, useBreit, useHandy, useRueckfrage } from '../ui';
import { Kopfleiste } from './Kopfleiste';
import { Team } from './Team';
import { ZoeMitte } from './ZoeMitte';
import { HeadMitte } from './HeadMitte';
import { FadenMitte } from './FadenMitte';
import { Hintergrund } from './Hintergrund';
import { AgentenDialog } from './Dialoge';
import { AgentenKontext, useAgenten, type AgentenWert, type DialogArt, type Form } from './kontext';
import { ladeAgenten, ladeFaeden, ladeLaeufe, ladeStapel, useAbruf } from './daten';
import { auswahlAus, risikoVon, wartendeFaeden } from './regeln';
import { HANDY_LEISTE, HANDY_REITER, SPALTE, SPALTE_EINS } from './masse';

export type HandyReiter = 'gespraech' | 'team' | 'laeuft';

/** Die Mitte: ZOE, ein Head, ein Mitarbeiter-Thread oder ein neuer Thread (Entwurf). */
export function Mitte() {
  const { auswahl, entwurf } = useAgenten();
  if (entwurf) return <FadenMitte />;
  if (auswahl.art === 'head') return <HeadMitte key={auswahl.headId} headId={auswahl.headId} fadenId={auswahl.fadenId} />;
  if (auswahl.art === 'faden') return <FadenMitte key={auswahl.fadenId} fadenId={auswahl.fadenId} />;
  return <ZoeMitte />;
}

/** Zahl für das Abzeichen am Handy-Reiter „Läuft“: nur, was auf die Person wartet. */
function wartetZahl(w: Pick<AgentenWert, 'stapel' | 'faeden'>): number {
  const stapel = w.stapel.zustand === 'da' ? w.stapel.daten.vorschlaege.filter(v => !v.status || v.status === 'offen').length : 0;
  const faeden = w.faeden.zustand === 'da' ? wartendeFaeden(w.faeden.daten.faeden).length : 0;
  return stapel + faeden;
}

const spalteSeite: CSSProperties = { position: 'sticky', top: ABSTAND.l, alignSelf: 'start', maxHeight: `calc(100vh - ${ABSTAND.l * 2}px)`, overflowY: 'auto', overscrollBehavior: 'contain' };

/**
 * Die drei Spalten (bzw. zwei oder die Handy-Reiter) — rendert nur aus dem Kontext; die Tests geben ihn mit dem Fixture vor.
 */
export function AgentenFlaeche({ handyReiter = 'gespraech', setHandyReiter }: { handyReiter?: HandyReiter; setHandyReiter?: (r: HandyReiter) => void }) {
  const w = useAgenten();
  const { form, auswahl, entwurf, starteEntwurf } = w;
  if (form === 'handy') {
    const zahl = wartetZahl(w);
    const imChat = auswahl.art !== 'zoe' || !!entwurf;
    const reiter: { id: HandyReiter; label: string; zahl?: number }[] = [{ id: 'gespraech', label: 'Gespräch' }, { id: 'team', label: 'Team' }, { id: 'laeuft', label: 'Läuft', zahl }];
    return (
      <div style={{ ['--agenten-feld-unten' as string]: `calc(${HANDY_LEISTE + HANDY_REITER}px + env(safe-area-inset-bottom, 0px))`, paddingBottom: HANDY_REITER + ABSTAND.l, display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: ABSTAND.l, minWidth: 0 }}>
        {handyReiter === 'gespraech' && (
          <>
            {imChat && (
              <div>
                <Knopf leise onClick={() => { starteEntwurf(null); setHandyReiter?.('team'); }}>‹ Team</Knopf>
              </div>
            )}
            <Mitte />
          </>
        )}
        {handyReiter === 'team' && <Team />}
        {handyReiter === 'laeuft' && <Hintergrund />}
        <nav aria-label="Agenten-Bereiche" role="tablist" style={{ position: 'fixed', left: 0, right: 0, bottom: `calc(${HANDY_LEISTE}px + env(safe-area-inset-bottom, 0px))`, zIndex: 35,
          display: 'flex', gap: ABSTAND.xs, padding: `${ABSTAND.xs}px ${ABSTAND.s}px`, background: C.grund, borderTop: `1px solid ${RAND.haar}`, boxSizing: 'border-box', height: HANDY_REITER }}>
          {reiter.map(r => {
            const an = r.id === handyReiter;
            return (
              <button key={r.id} type="button" role="tab" aria-selected={an} onClick={() => setHandyReiter?.(r.id)} className="fassbar"
                style={{ flex: '1 1 0', minHeight: ZIEL.handy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: ABSTAND.xs, borderRadius: ECKE.eingabe,
                  border: `1px solid ${an ? TIEF.rand(C.aktiv) : 'transparent'}`, background: an ? TIEF.flaeche(C.aktiv) : 'transparent', color: an ? C.ink : C.inkDim,
                  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: an ? 700 : 600, cursor: 'pointer' }}>
                {r.label}{r.zahl ? <span className="krit-puls"><Chip farbe={LEUCHT.achtung}>⚑ {r.zahl}</Chip></span> : null}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
  if (form === 'mittel') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${SPALTE.teamMittel}px minmax(0, 1fr)`, gap: ABSTAND.xl, alignItems: 'start' }}>
        <div style={spalteSeite}><Karte flach dicht><Team /></Karte></div>
        <div style={{ display: 'grid', gridTemplateColumns: SPALTE_EINS, gap: ABSTAND.xxl, minWidth: 0 }}>
          <Mitte />
          <Karte flach dicht><Hintergrund /></Karte>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${SPALTE.team}px minmax(${SPALTE.mitteMin}px, 1fr) ${SPALTE.rechts}px`, gap: ABSTAND.xl, alignItems: 'start' }}>
      <div style={spalteSeite}><Karte flach dicht><Team /></Karte></div>
      <section aria-label="Gespräch" style={{ minWidth: 0 }}><Mitte /></section>
      <div style={spalteSeite}><Karte flach dicht><Hintergrund /></Karte></div>
    </div>
  );
}

export function AgentenSeite() {
  const params = useSearchParams();
  const router = useRouter();
  const { wahl, space } = useSpace();
  const breit = useBreit();
  const handy = useHandy();
  const form: Form = handy ? 'handy' : breit ? 'breit' : 'mittel';

  const agenten = useAbruf('agenten', ladeAgenten, 60_000);
  const faeden = useAbruf('faeden', () => ladeFaeden(), 60_000);
  const laeufe = useAbruf('laeufe', ladeLaeufe, 30_000);
  const stapel = useAbruf('stapel', ladeStapel, 60_000);
  const { bestaetigen, dialog: rueckfrage } = useRueckfrage();
  const [dialog, setDialog] = useState<DialogArt | null>(null);
  const [entwurf, setEntwurf] = useState<{ headId: string; mitarbeiterId: string } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'info' | 'kritisch'; nr: number } | null>(null);
  const [handyReiter, setHandyReiter] = useState<HandyReiter>('gespraech');

  useEffect(() => {
    if (!meldung || meldung.art === 'kritisch') return;
    const t = setTimeout(() => setMeldung(m => (m?.nr === meldung.nr ? null : m)), 6_000);
    return () => clearTimeout(t);
  }, [meldung]);

  const h = params.get('h');
  const f = params.get('f');
  const auswahl = useMemo(() => auswahlAus(h, f, faeden.stand.zustand === 'da' ? faeden.stand.daten.faeden : []), [h, f, faeden.stand]);

  const oeffne = useCallback((o: { h?: string; f?: string }, ersetzen?: boolean) => {
    setEntwurf(null);
    setHandyReiter('gespraech');
    const ziel = WEG.agenten(o);
    if (ersetzen) router.replace(ziel, { scroll: false }); else router.push(ziel, { scroll: false });
  }, [router]);
  const starteEntwurf = useCallback((e: { headId: string; mitarbeiterId: string } | null) => {
    setEntwurf(e);
    if (e) setHandyReiter('gespraech');
  }, []);
  const melde = useCallback((text: string, art: 'gut' | 'info' | 'kritisch' = 'info') => setMeldung(m => ({ text, art, nr: (m?.nr ?? 0) + 1 })), []);

  const wert: AgentenWert = useMemo(() => ({
    agenten: agenten.stand, faeden: faeden.stand, laeufe: laeufe.stand, stapel: stapel.stand,
    form, auswahl, entwurf, starteEntwurf, jetzt: new Date(), space, bereich: wahl === 'alles' ? 'alle' : wahl,
    oeffne, dialog: setDialog, bestaetigen, melde,
  }), [agenten.stand, faeden.stand, laeufe.stand, stapel.stand, form, auswahl, entwurf, starteEntwurf, space, wahl, oeffne, bestaetigen, melde]);

  if (dialog?.art === 'uebersicht') {
    return (
      <div>
        <div style={{ padding: `${ABSTAND.l}px clamp(${ABSTAND.l}px, 4vw, ${ABSTAND.xxxl}px) 0` }}>
          <Knopf leise onClick={() => setDialog(null)}>‹ Zurück zu den Agenten</Knopf>
        </div>
        <AgentenView />
      </div>
    );
  }

  const notAus = agenten.stand.zustand === 'da' && agenten.stand.daten.notAus;
  const offenRisikoarm = stapel.stand.zustand === 'da' ? stapel.stand.daten.vorschlaege.filter(v => risikoVon(v) === 'risikoarm').length : 0;
  return (
    <AgentenKontext wert={wert}>
      <Seite titel="Agenten" unter={form === 'handy' ? undefined : 'ZOE steuert die Heads — und du sprichst mit jedem direkt.'} rechts={<Kopfleiste />}>
        <ZoeReiter />
        {notAus && <Hinweis art="achtung" titel="Not-Aus ist an">Alle Agenten halten an: Hintergrundläufe, Zeitpläne und Aufträge an Heads ruhen. Mit ZOE sprechen geht weiter.</Hinweis>}
        {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'} aktion={meldung.art === 'kritisch' ? <Knopf leise onClick={() => setMeldung(null)}>Schließen</Knopf> : undefined}>{meldung.text}</Hinweis>}
        {form === 'handy' && offenRisikoarm > 0 && handyReiter !== 'laeuft' && (
          <Hinweis art="info" aktion={<Knopf leise onClick={() => setHandyReiter('laeuft')}>Ansehen</Knopf>}>{offenRisikoarm} risikoarme Freigabe{offenRisikoarm === 1 ? '' : 'n'} — mit dem Daumen wischen.</Hinweis>
        )}
        <AgentenFlaeche handyReiter={handyReiter} setHandyReiter={setHandyReiter} />
      </Seite>
      <AgentenDialog d={dialog} onZu={() => setDialog(null)} />
      {rueckfrage}
    </AgentenKontext>
  );
}

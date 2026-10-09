'use client';

// ─── Agenten: ZOE, Heads, Mitarbeiter, Threads (09.10., Paket 2 „Oberfläche“; AGENTEN_KONZEPT.md C2 + C11) ─────
// Auftrag 08.10. spät: „Den ganzen Agent-Bereich im Business wie im Privaten aufs nächste Level bringen … direkt und
// systematisch mit den Agenten chatten.“
// Aufräumen 09.10. abends (Auftrag: „Bei Claude sieht das aufgeräumter und sauberer aus — ist das gleiche Prinzip“; „es reicht, wenn wir links
// und rechts beides zuklappen können, damit der Chat größer und übersichtlicher wird“; Klickrunde: „Zuklappen + aufräumen“):
//   Breit (alles passt nebeneinander): links die Liste (Neu ▾, Suche, ZOE, Heads nur mit Namen, aufgeklappt ihre Threads) · Mitte NUR das
//   Gespräch (eine Kopfzeile, Verlauf, Feld — höchstens `SPALTE.lese` breit und mittig) · rechts der Hintergrund (Wartet auf dich · Läuft ·
//   Geplant · Fertig/Fehler, unten Budget, Not-Aus, ⋯). Links und rechts klappen ein (Knöpfe, ⌘B bzw. ⌘.), je Browser gemerkt.
//   Mittel: die Liste daneben (zuklappbar), der Hintergrund als Schublade über dem Gespräch (startet zu) — ist auch für die Liste zu wenig
//   Platz, wird sie ebenfalls zur Schublade. Welche Lage gilt, misst die Seite (klappen.ts `lageAus`).
//   Handy (< 720 px): unten die Reiter Gespräch · Team · Läuft; ein Head oder Thread öffnet ganzflächig mit Zurück.
// Der Seitenkopf ist schlank: Titel und die ZOE-Reiter. Freigaben, Geplant, Budget und Not-Aus stehen rechts im Hintergrund — nichts ist weg.
// Adresse NUR über `WEG.agenten({ h, f })`; Ort wechseln = push (Verlauf-Regel), ein neuer Thread am selben Ort = replace.
// Daten: components/os/agenten/daten.ts (ein Client). Welche Heads, Threads und Läufe die Person sieht, entscheidet der Server —
// die Seite blendet nichts aus, sie gruppiert nur nach dem Kopf-Schalter (Alles · Privat · Business).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, RAND, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useSpace } from '@/hooks/useSpace';
import { AgentenView } from '../AgentenView';
import { ZoeReiter } from '../ZoeReiter';
import { Chip, Hinweis, Karte, Knopf, Seite, useBreit, useHandy, useRueckfrage } from '../ui';
import { Team } from './Team';
import { ZoeMitte } from './ZoeMitte';
import { HeadMitte } from './HeadMitte';
import { FadenMitte } from './FadenMitte';
import { Hintergrund } from './Hintergrund';
import { AgentenDialog } from './Dialoge';
import { FELD_ID } from './GespraechKopf';
import { AgentenKontext, felderVon, useAgenten, wartetAufDichZahl, type AgentenWert, type DialogArt, type Felder, type Form } from './kontext';
import { ladeAgenten, ladeFaeden, ladeLaeufe, ladeStapel, meldeNeu, useAbruf } from './daten';
import { auswahlAus, laufBeendet, risikoVon } from './regeln';
import { klappTaste, lageAus, merkerLesen, merkerSchreiben, type FeldArt, type Seitenfeld } from './klappen';
import { HANDY_LEISTE, HANDY_REITER, SPALTE, SPALTE_ABSTAND, SPALTE_EINS } from './masse';

export type HandyReiter = 'gespraech' | 'team' | 'laeuft';

/** Die Mitte: ZOE, ein Head, ein Mitarbeiter-Thread oder ein neuer Thread (Entwurf). */
export function Mitte() {
  const { auswahl, entwurf, neu } = useAgenten();
  if (entwurf) return <FadenMitte />;
  if (auswahl.art === 'head') return <HeadMitte key={auswahl.headId} headId={auswahl.headId} fadenId={auswahl.fadenId} />;
  if (auswahl.art === 'faden') return <FadenMitte key={auswahl.fadenId} fadenId={auswahl.fadenId} />;
  // Ein anderer ZOE-Thread oder „Neues Gespräch“ fängt die Mitte frisch an (kein alter Verlauf unter neuer Auswahl).
  const zoeNeu = neu?.ziel === 'zoe' ? neu : null;
  return <ZoeMitte key={`${auswahl.fadenId ?? ''}|${zoeNeu?.nr ?? 0}`} neu={!!zoeNeu} />;
}

/** Ein Seitenfeld NEBEN dem Gespräch: klappt weich auf Breite 0 (reduzierte Bewegung: sofort, globals.css), bleibt beim Scrollen stehen. */
function Nebenfeld({ id, seite, offen, breite, children }: { id: string; seite: Seitenfeld; offen: boolean; breite: number; children: ReactNode }) {
  const stil: CSSProperties = {
    position: 'sticky', top: ABSTAND.l, alignSelf: 'flex-start', flex: '0 0 auto', width: offen ? breite + SPALTE_ABSTAND : 0,
    maxHeight: `calc(100vh - ${ABSTAND.l * 2}px)`, overflowX: 'hidden', overflowY: offen ? 'auto' : 'hidden', overscrollBehavior: 'contain',
  };
  return (
    <div id={id} className="agenten-seitenfeld" data-zu={offen ? undefined : ''} aria-hidden={offen ? undefined : true} style={stil}>
      <div style={{ width: breite, [seite === 'links' ? 'marginRight' : 'marginLeft']: SPALTE_ABSTAND }}>
        <Karte flach dicht>{children}</Karte>
      </div>
    </div>
  );
}

/** Ein Seitenfeld als SCHUBLADE über dem Gespräch (mittlere Breite): Schleier dahinter, Klick daneben oder Esc schließt. */
function Schublade({ id, seite, offen, onZu, label, children }: { id: string; seite: Seitenfeld; offen: boolean; onZu: () => void; label: string; children: ReactNode }) {
  return (
    <>
      {offen && <div className="agenten-schleier" aria-hidden onClick={onZu} />}
      <div id={id} role="dialog" aria-modal="false" aria-label={label} className="agenten-schublade" data-zu={offen ? undefined : ''} aria-hidden={offen ? undefined : true}
        style={{ position: 'fixed', top: 0, bottom: 0, ...(seite === 'links' ? { left: 'var(--agenten-x, 0px)' } : { right: 0 }), zIndex: 80, width: `min(${SPALTE.schublade}px, 92vw)`, boxSizing: 'border-box', overflowY: 'auto', overscrollBehavior: 'contain',
          padding: ABSTAND.l, background: FLAECHE_STIL.gehoben.background, boxShadow: FLAECHE_STIL.gehoben.boxShadow, [seite === 'links' ? 'borderRight' : 'borderLeft']: `1px solid ${RAND.stark}`,
          transform: offen ? 'none' : `translateX(${seite === 'links' ? '-' : ''}100%)` }}>
        {children}
      </div>
    </>
  );
}

/**
 * Liste · Gespräch · Hintergrund (bzw. die Handy-Reiter) — rendert nur aus dem Kontext; die Tests geben ihn mit dem Fixture vor.
 */
export function AgentenFlaeche({ handyReiter = 'gespraech', setHandyReiter }: { handyReiter?: HandyReiter; setHandyReiter?: (r: HandyReiter) => void }) {
  const w = useAgenten();
  const { form, auswahl, entwurf, starteEntwurf } = w;
  if (form === 'handy') {
    const zahl = wartetAufDichZahl(w);
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
        <nav aria-label="Agenten-Bereiche" role="tablist" className="agenten-reiter-handy" style={{ position: 'fixed', left: 0, right: 0, bottom: `calc(${HANDY_LEISTE}px + env(safe-area-inset-bottom, 0px))`, zIndex: 35,
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
  const f = felderVon(w);
  const zuLinks = () => f.umschalten('links', false);
  const zuRechts = () => f.umschalten('rechts', false);
  return (
    <div className="agenten-flaeche" style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
      {f.art.links === 'neben'
        ? <Nebenfeld id={FELD_ID.links} seite="links" offen={f.links} breite={SPALTE.team}><Team /></Nebenfeld>
        : <Schublade id={FELD_ID.links} seite="links" offen={f.links} onZu={zuLinks} label="Liste: ZOE, Heads, Threads"><Team /></Schublade>}
      <section aria-label="Gespräch" style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ maxWidth: SPALTE.lese, margin: '0 auto', minWidth: 0 }}><Mitte /></div>
      </section>
      {f.art.rechts === 'neben'
        ? <Nebenfeld id={FELD_ID.rechts} seite="rechts" offen={f.rechts} breite={SPALTE.rechts}><Hintergrund onZu={zuRechts} /></Nebenfeld>
        : <Schublade id={FELD_ID.rechts} seite="rechts" offen={f.rechts} onZu={zuRechts} label="Hintergrund"><Hintergrund onZu={zuRechts} /></Schublade>}
    </div>
  );
}

/**
 * Gemessene Breite der Fläche (ResizeObserver) — null, bis gemessen ist — und ihr linker Rand im Fenster (die Liste als Schublade beginnt
 * dort, rechts neben der Leiste der App; klappt die Leiste ein, ändert sich die Breite und der Rand wird neu gelesen).
 */
function useBreite(): [React.RefObject<HTMLDivElement>, number | null, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [mass, setMass] = useState<{ breite: number | null; x: number }>({ breite: null, x: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(e => {
      const b = Math.round(e[0]?.contentRect.width ?? 0);
      const x = Math.max(0, Math.round(el.getBoundingClientRect().left - SPALTE_ABSTAND));
      if (b > 0) setMass(m => (m.breite === b && m.x === x ? m : { breite: b, x }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, mass.breite, mass.x];
}

export function AgentenSeite() {
  const params = useSearchParams();
  const router = useRouter();
  const { wahl, space } = useSpace();
  const breit = useBreit();
  const handy = useHandy();
  const [flaecheRef, platz, linkerRand] = useBreite();
  const lage = lageAus(platz, breit);
  const form: Form = handy ? 'handy' : lage.form;

  const agenten = useAbruf('agenten', ladeAgenten, 60_000);
  const faeden = useAbruf('faeden', () => ladeFaeden(), 60_000);
  const laeufe = useAbruf('laeufe', ladeLaeufe, 30_000);
  const stapel = useAbruf('stapel', ladeStapel, 60_000);
  const { bestaetigen, dialog: rueckfrage } = useRueckfrage();
  const [dialog, setDialog] = useState<DialogArt | null>(null);
  const [entwurf, setEntwurf] = useState<{ headId: string; mitarbeiterId: string } | null>(null);
  const [neu, setNeu] = useState<{ ziel: string; nr: number } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'info' | 'kritisch'; nr: number } | null>(null);
  const [handyReiter, setHandyReiter] = useState<HandyReiter>('gespraech');
  // Seitenfelder: neben dem Gespräch gemerkt (Vorgabe offen), als Schublade nur für den Moment (startet zu).
  const [gemerkt, setGemerkt] = useState<Record<Seitenfeld, boolean>>({ links: true, rechts: true });
  const [schublade, setSchublade] = useState<Record<Seitenfeld, boolean>>({ links: false, rechts: false });
  useEffect(() => { setGemerkt({ links: merkerLesen('links'), rechts: merkerLesen('rechts') }); }, []);
  const artLinks: FeldArt = lage.links;
  const artRechts: FeldArt = lage.rechts;
  const umschalten = useCallback((s: Seitenfeld, offen?: boolean) => {
    if ((s === 'links' ? artLinks : artRechts) === 'neben') {
      const n = offen ?? !gemerkt[s];
      setGemerkt(g => ({ ...g, [s]: n }));
      merkerSchreiben(s, n);
    } else setSchublade(x => ({ ...x, [s]: offen ?? !x[s] }));
  }, [artLinks, artRechts, gemerkt]);

  // Tastatur: ⌘B / Strg+B = Liste, ⌘. / Strg+. = Hintergrund (nicht in Eingabefeldern, nicht über einem offenen Fenster); Esc schließt Schubladen.
  useEffect(() => {
    if (form === 'handy') return;
    const taste = (e: KeyboardEvent) => {
      if (dialog) return;
      if (e.key === 'Escape' && (schublade.links || schublade.rechts)) { setSchublade({ links: false, rechts: false }); return; }
      const s = klappTaste(e, document.activeElement as HTMLElement | null);
      if (!s) return;
      e.preventDefault();
      umschalten(s);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [form, dialog, schublade, umschalten]);

  useEffect(() => {
    if (!meldung || meldung.art === 'kritisch') return;
    const t = setTimeout(() => setMeldung(m => (m?.nr === meldung.nr ? null : m)), 6_000);
    return () => clearTimeout(t);
  }, [meldung]);

  // Ein Lauf ist fertig geworden → alles neu laden (Thread mit Bericht, Freigaben, Team) — eine Stelle statt eines Abrufs je Bereich.
  const laufend = laeufe.stand.zustand === 'da' ? laeufe.stand.daten.laeufe.filter(l => l.status === 'wartet' || l.status === 'laeuft').map(l => l.id).sort().join(',') : null;
  const laufendVorher = useRef<string[] | null>(null);
  useEffect(() => {
    if (laufend === null) return;
    const jetzt = laufend ? laufend.split(',') : [];
    if (laufBeendet(laufendVorher.current, jetzt)) meldeNeu();
    laufendVorher.current = jetzt;
  }, [laufend]);

  const h = params.get('h');
  const f = params.get('f');
  const auswahl = useMemo(() => auswahlAus(h, f, faeden.stand.zustand === 'da' ? faeden.stand.daten.faeden : []), [h, f, faeden.stand]);

  const oeffne = useCallback((o: { h?: string; f?: string }, ersetzen?: boolean) => {
    setEntwurf(null);
    setNeu(null);
    setHandyReiter('gespraech');
    setSchublade(x => (x.links || x.rechts ? { links: false, rechts: false } : x)); // Schubladen schließen, sobald man etwas daraus öffnet (das Gespräch liegt darunter)
    const ziel = WEG.agenten(o);
    if (ersetzen) router.replace(ziel, { scroll: false }); else router.push(ziel, { scroll: false });
  }, [router]);
  const starteEntwurf = useCallback((e: { headId: string; mitarbeiterId: string } | null) => {
    setEntwurf(e);
    if (e) { setNeu(null); setHandyReiter('gespraech'); setSchublade(x => (x.links || x.rechts ? { links: false, rechts: false } : x)); }
  }, []);
  // „Neuer Thread“: an den Ort gehen (ZOE bzw. Head ohne Thread in der Adresse), dann leer anfangen (`oeffne` hebt `neu` auf — darum danach).
  const starteNeu = useCallback((ziel: string) => {
    oeffne(ziel === 'zoe' ? {} : { h: ziel });
    setNeu(n => ({ ziel, nr: (n?.nr ?? 0) + 1 }));
  }, [oeffne]);
  const melde = useCallback((text: string, art: 'gut' | 'info' | 'kritisch' = 'info') => setMeldung(m => ({ text, art, nr: (m?.nr ?? 0) + 1 })), []);

  const felder: Felder = useMemo(() => ({
    links: artLinks === 'neben' ? gemerkt.links : schublade.links,
    rechts: artRechts === 'neben' ? gemerkt.rechts : schublade.rechts,
    art: { links: artLinks, rechts: artRechts }, umschalten,
  }), [artLinks, artRechts, gemerkt, schublade, umschalten]);

  const wert: AgentenWert = useMemo(() => ({
    agenten: agenten.stand, faeden: faeden.stand, laeufe: laeufe.stand, stapel: stapel.stand,
    form, auswahl, entwurf, starteEntwurf, jetzt: new Date(), space, bereich: wahl === 'alles' ? 'alle' : wahl,
    oeffne, dialog: setDialog, bestaetigen, melde, felder, neu, starteNeu,
  }), [agenten.stand, faeden.stand, laeufe.stand, stapel.stand, form, auswahl, entwurf, starteEntwurf, space, wahl, oeffne, bestaetigen, melde, felder, neu, starteNeu]);

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
      <Seite titel="Agenten">
        <ZoeReiter />
        {notAus && <Hinweis art="achtung" titel="Not-Aus ist an">Alle Agenten halten an: Hintergrundläufe, Zeitpläne und Aufträge an Heads ruhen. Mit ZOE sprechen geht weiter.</Hinweis>}
        {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'} aktion={meldung.art === 'kritisch' ? <Knopf leise onClick={() => setMeldung(null)}>Schließen</Knopf> : undefined}>{meldung.text}</Hinweis>}
        {form === 'handy' && offenRisikoarm > 0 && handyReiter !== 'laeuft' && (
          <Hinweis art="info" aktion={<Knopf leise onClick={() => setHandyReiter('laeuft')}>Ansehen</Knopf>}>{offenRisikoarm} risikoarme Freigabe{offenRisikoarm === 1 ? '' : 'n'} — mit dem Daumen wischen.</Hinweis>
        )}
        <div ref={flaecheRef} style={{ minWidth: 0, ['--agenten-x' as string]: `${linkerRand}px` }}>
          <AgentenFlaeche handyReiter={handyReiter} setHandyReiter={setHandyReiter} />
        </div>
      </Seite>
      <AgentenDialog d={dialog} onZu={() => setDialog(null)} />
      {rueckfrage}
    </AgentenKontext>
  );
}

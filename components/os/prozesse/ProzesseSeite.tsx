'use client';

// ─── Prozesse — die Seite (Etappe A „Sehen“, 21.10.; research/prozesse/ANALYSE_100.md Punkte 1–5, 7, 9, 11–15, 20, 21, 24, 26, 27, 30, 74, 93) ────────
// Der EINE Ort für alle Abläufe von Marketing über Sales bis Fulfillment (Business-Leiste „Prozesse“). Die Seite öffnet mit der Landkarte als Fliege
// (Entscheidung E1); ein Klick fährt hinein — Prozess (Ebene 2: Steckbrief, Phasen), Ablauf (Ebene 3: Schritte in den festen Formen), Schritt (Ebene 4).
// Der Ort steht in der Adresse (lib/prozesse/adresse.ts): Browser-Zurück und Esc fahren eine Ebene hinaus, die Brotkrumen zeigen immer den Weg zurück.
//   · Darstellungen aus EINER Liste (`PROZESS_ANSICHTEN`: Bild · Liste — später mehr), dasselbe Modell; am Handy startet die Liste (Punkte 20, 30).
//   · Vollbild (`?voll=1`) für Landkarte und jeden Prozess — Leiste und Kopf weg, Werkzeuge schweben, Esc zurück (Punkt 11, ../ui/flaeche/vollbild.ts).
//   · Präsentieren (`?modus=praesentieren`): Rahmen für Rahmen entlang des Flows, Bild-auf/ab bzw. Pfeiltasten blättern (Punkt 93).
//   · Tastatur: Alt+1 alles zeigen, Alt+2 Auswahl zeigen, M Minimap, + / − zoomen, F Vollbild, ? Kürzel — Einzeltasten abschaltbar (Punkt 13).
//   · Suche springt zum Knoten und lässt ihn aufleuchten (Punkt 15).
//   · Werkstatt (Etappe B2, `?ansicht=werkstatt`): hier werden Prozesse gebaut (./Werkstatt.tsx); „+ Prozess“ legt einen an (./WerkstattUebersicht.tsx). System-
//     Prozesse und Fulfillment-Pakete bleiben dort nur lesbar (Pakete öffnen weiter ihren Editor). Unter 768 px nur ansehen.
//   · Werkzeug-Muster (22.10., lib/make-one/werkzeuge.ts — Prozesse ist das erste Werkzeug, Miro-Art): die Leiste klappt auf die Unterpunkte um; der Pfeil ⤢
//     oben rechts IN jeder Fläche (Landkarte, Werkstatt) öffnet den Werkzeugmodus (`voll=1`, ../werkzeug/rahmen.tsx): Fläche über den ganzen Bildschirm, links
//     die Symbol-Leiste, oben die Kopfzeile mit Rückweg und Aktionen, schwebend die Werkzeugleiste (links), Zoom (unten rechts), Head fragen (unten links),
//     das Seitenfeld rechts zum Ein- und Ausklappen. „Vorlagen“ und „Präsentieren“ aus dem Menü kommen als Aktion (`make-werkzeug`) hier an.
// Daten: GET /api/prozesse/landkarte (nur Business, serverseitig). Gerechnet wird in lib/prozesse/* — diese Datei verbindet nur.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Maximize2, Fullscreen, Presentation, Map as MapIcon, Plus, Minus, ScanSearch, Keyboard, X, ChevronLeft, ChevronRight, Workflow, LayoutTemplate, Pencil, Sparkles } from 'lucide-react';
import { Werkstatt } from './Werkstatt';
import { PaketWerkstatt } from './PaketWerkstatt';
import { WerkstattUebersicht, NeuerProzessFenster } from './WerkstattUebersicht';
import { VorlagenGalerie } from './VorlagenGalerie';
import { HeadFragenFenster } from './HeadFragen';
import { FARBE as C, TYP, MIKRO, SCHRIFT } from '@/lib/make-one/design';
import { Seite, Karte, Knopf, Segmente, Hinweis, Leerzustand, Wahl, SymbolKnopf, useHandy, useMedien } from '../ui';
import { WEG } from '@/lib/wege';
import { FLOW_TON } from '../ui/reise/formen';
import { flaecheFaden } from '@/lib/reise/flow';
import { flaecheBild } from '@/lib/fulfillment/prozesse/flaeche';
import type { FlowFaden } from '@/lib/lichtfaeden/flow';
import { PROZESS_ANSICHTEN, ansichtVorgabe, ebeneVon, type ProzessAnsicht, type ProzessPfad } from '@/lib/prozesse/typen';
import { prozesseAusAdresse, ebeneHoch } from '@/lib/prozesse/adresse';
import { alsVorlage, brotkrumen, endeSchritte, pfadGueltig, phaseVon, prozessVon, schrittVon, zahlSchluessel, type SuchTreffer } from '@/lib/prozesse/modell';
import { fliegeLage, prozessLage, boxenVon, huelle, pfeileImBild, einpassBox, type PfeilLage, type RahmenLage } from '@/lib/prozesse/landkarte';
import { STUFE_FARBE, tonVon } from '@/lib/prozesse/farben';
import { FORM_FARBE } from '../ui/reise/formen';
import { useVollbild } from '../ui/flaeche/vollbild';
import type { ZoomStufe } from '../ui/flaeche/stufe';
import type { Rechteck } from '../ui/flaeche/kamera';
import { Buehne, type BuehneSteuerung, type Einflug, type MinimapTeil } from './Buehne';
import { LandkarteBild, ProzessBild, AblaufBild } from './Bilder';
import { SteckbriefKarte, PhaseKarte, SchrittKarte } from './Feld';
import { StellschraubenKarte } from './Stellschrauben';
import { ProzessListe } from './ProzessListe';
import { ProzessSuche } from './Suche';
import { useLandkarte } from './daten';
import { LandkarteAnpassen, useLandkarteAnpassung } from './LandkarteAnpassen';
import { WerkzeugRahmen, WerkzeugSlot, WerkzeugFeld, GanzerBildschirmKnopf } from '../werkzeug/rahmen';
import { ZoomLeiste, useMassstab } from '../werkzeug/zoom';
import { PROZESSE_WERKZEUG, WERKZEUG_EREIGNIS, type WerkzeugAktion } from '@/lib/make-one/werkzeuge';

const MERKER_EINZELTASTEN = 'make-prozesse-einzeltasten';
const merkerLesen = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const merkerSchreiben = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* privates Fenster */ } };
const imFeld = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

/** Die Kürzel (eine Liste für Hilfe und Titel der Knöpfe). */
export const KUERZEL: readonly { taste: string; was: string; einzel?: true }[] = [
  { taste: 'Esc', was: 'Eine Ebene hinaus bzw. Vollbild verlassen' },
  { taste: 'Alt + 1', was: 'Alles zeigen' },
  { taste: 'Alt + 2', was: 'Auswahl zeigen' },
  { taste: 'M', was: 'Minimap an/aus', einzel: true },
  { taste: '+ / −', was: 'Vergrößern / Verkleinern', einzel: true },
  { taste: 'F', was: 'Ganzer Bildschirm an/aus', einzel: true },
  { taste: '?', was: 'Diese Übersicht', einzel: true },
  { taste: '← / → · Bild ↑ / Bild ↓', was: 'Beim Präsentieren: Rahmen zurück / weiter' },
];

interface Szene {
  schluessel: string; label: string; box: Rechteck; boxen: Map<string, Rechteck>; faeden: FlowFaden[]; rahmen: RahmenLage[]; minimap: MinimapTeil[];
  zeichne: (stufe: ZoomStufe) => ReactNode;
}

export function ProzesseSeite() {
  const router = useRouter();
  const params = useSearchParams();
  const adr = useMemo(() => prozesseAusAdresse(params ?? new URLSearchParams()), [params]);
  const handy = useHandy();
  /** Unter 768 px ist die Werkstatt nur zum Ansehen (Kevins Bild 21.10.). */
  const schmal = useMedien('(max-width: 767px)');
  const { daten, fehler, neu: landkarteNeu } = useLandkarte();
  // Landkarte anpassen (22.10.): die angepasste Fassung gilt überall auf der Seite (Bild, Liste, Vollbild, Präsentieren); der Stift öffnet das Feld dazu.
  const anp = useLandkarteAnpassung(daten);
  const [anpassen, setAnpassen] = useState(false);
  const [neuOffen, setNeuOffen] = useState(false);
  // „Aus Vorlage anlegen“ (22.10., Kundengewinnung): die Galerie der 18 Vorlagen.
  const [vorlageOffen, setVorlageOffen] = useState(false);
  // „Head fragen“ (22.10.): ein ganzer Entwurf als Vorschlag in den Stapel — übernommen erst per Klick.
  const [headOffen, setHeadOffen] = useState(false);
  const vollbild = useVollbild();
  const praes = adr.modus === 'praesentieren';
  const voll = vollbild.voll || praes;
  const ansicht: ProzessAnsicht = praes ? 'bild' : ansichtVorgabe(adr.ansicht ?? null, handy);
  const buehne = useRef<BuehneSteuerung>(null);
  // Werkzeugmodus (22.10.): der Maßstab der Bühne steht unten rechts in der Zoom-Leiste (direkt geschrieben, kein Zustand je Bild).
  const massstab = useMassstab();
  const [minimap, setMinimap] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [einzeltasten, setEinzeltasten] = useState(true);
  const [leuchten, setLeuchten] = useState<{ id: string; n: number } | null>(null);
  const [rahmenNr, setRahmenNr] = useState(0);
  const [montiert, setMontiert] = useState(false);
  useEffect(() => { setMontiert(true); setEinzeltasten(merkerLesen(MERKER_EINZELTASTEN) !== 'aus'); }, []);

  const prozesse = useMemo(() => (daten ? anp.ansicht.alle : []), [daten, anp.ansicht]);
  /** Der Ton je Bereich, wenn er angepasst ist (Bild, Faden des Kunden). */
  const toene = useMemo(() => Object.fromEntries(anp.ansicht.bereiche.filter(b => b.angepasst).map(b => [b.id, b.ton])) as Record<string, string>, [anp.ansicht]);
  const zahlen = useMemo(() => daten?.zahlen ?? {}, [daten]);
  const nach = useMemo(() => new Map(prozesse.map(p => [p.id, p])), [prozesse]);
  const pfad = useMemo(() => (daten ? pfadGueltig(prozesse, adr) : {}), [daten, prozesse, adr]);
  const ebene = ebeneVon(pfad);
  const p = prozessVon(prozesse, pfad.p);
  const ph = phaseVon(p, pfad.ph);
  const s = schrittVon(ph, pfad.s);

  /** Zu einem Ort im Modell — Darstellung, Vollbild und Präsentieren bleiben. Hineinfahren ist ein Schritt im Verlauf (`push`). */
  const geh = useCallback((ziel: ProzessPfad, o: { ersetzen?: boolean } = {}) => {
    const url = WEG.prozesse({ ...ziel, ...(adr.ansicht ? { ansicht: adr.ansicht } : {}), ...(praes ? { modus: 'praesentieren' as const } : adr.voll ? { voll: true } : {}) });
    if (o.ersetzen) router.replace(url, { scroll: false }); else router.push(url, { scroll: false });
  }, [router, adr.ansicht, adr.voll, praes]);
  const ansichtWaehlen = (a: ProzessAnsicht) => router.replace(WEG.prozesse({ ...pfad, ansicht: a, ...(adr.voll ? { voll: true } : {}) }), { scroll: false });

  // ── Die Szene der Ebene (Landkarte · Prozess · Ablauf) ──
  const spitze = 'pz-spitze';
  // Die Lage der Landkarte einmal je Bestand (nicht je Mausbewegung) — der Fokus wählt nur, welche Wege hell stehen.
  const landLage = useMemo(() => (daten && !p ? fliegeLage(anp.ansicht.sichtbar, { bereiche: anp.ansicht.bereiche }) : null), [daten, anp.ansicht, p]);
  // Fokus (Befund 21.10.: lange Übergaben nur auf Wunsch): überfahrene Kachel, sonst die gewählte (zuletzt besucht bzw. gesucht); beim Präsentieren die
  // Kacheln des Rahmens (nur ihre Wege nach vorn).
  const [ueber, setUeber] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const rahmenFokus = useMemo(() => {
    if (!praes || !landLage) return null;
    const r = landLage.rahmen[rahmenNr];
    if (!r || r.id === 'alles') return [];
    return landLage.kacheln.filter(k => k.stufe === r.id || (!k.stufe && (k.bereich ?? k.band) === r.id)).map(k => k.id);
  }, [praes, landLage, rahmenNr]);
  const fokus = useMemo<string[]>(() => rahmenFokus ?? (ueber ? [ueber] : gewaehlt ? [gewaehlt] : []), [rahmenFokus, ueber, gewaehlt]);
  const szene = useMemo<Szene | null>(() => {
    if (!daten) return null;
    if (!p && landLage) {
      const lage = landLage;
      const weg = (pf: PfeilLage, hell: boolean): FlowFaden => {
        const f = flaecheFaden({ id: pf.id, art: pf.art, punkte: pf.punkte }, FLOW_TON);
        return hell ? { ...f, staerke: 'mittel', bisHier: 1, gluehen: true } : { ...f, bisHier: 0 };
      };
      const faeden: FlowFaden[] = [
        { id: 'rueckgrat', punkte: lage.rueckgrat.punkte, farbe: C.aktiv, staerke: 'breit', aufbau: true, farben: lage.rueckgrat.abschnitte.map(a => ({ von: a.von, bis: a.bis, farbe: toene[a.stufe] ?? STUFE_FARBE[a.stufe] })) },
        ...pfeileImBild(lage.pfeile, fokus, { nurAus: !!rahmenFokus }).map(w => weg(w.pfeil, w.hell)),
      ];
      return {
        schluessel: 'landkarte', label: `Landkarte der Prozesse als Fliege: ${prozesse.length} Prozesse in Führung, Kern (Marketing, Sales, Übergabe, Fulfillment, Ausbau) und Unterstützung`,
        box: huelle([lage.box], 12), boxen: boxenVon({ kacheln: lage.kacheln }), faeden, rahmen: lage.rahmen,
        minimap: lage.kacheln.map(k => ({ box: k, farbe: tonVon(nach.get(k.id) ?? { band: k.band, stufe: k.stufe }) })),
        zeichne: st => <LandkarteBild lage={lage} prozesse={nach} zahlen={zahlen} stufe={st} spitze={spitze} fokus={fokus} nurAus={!!rahmenFokus} toene={toene}
          onFokus={setUeber} onKachel={id => buehne.current?.fliegeIn(id, () => geh({ p: id }))} onZahl={h => router.push(h)} />,
      };
    }
    if (!p) return null;
    if (!ph) {
      const lage = prozessLage(p, prozesse);
      const faeden: FlowFaden[] = [
        { id: 'weg', punkte: lage.weg, farbe: tonVon(p), staerke: 'mittel', aufbau: true },
        ...lage.pfeile.map(pf => flaecheFaden({ id: pf.id, art: 'weiter', punkte: pf.punkte }, FLOW_TON)),
      ];
      return {
        schluessel: `prozess:${p.id}`, label: `Prozess „${p.titel}“: ${p.phasen.length} Phasen von links nach rechts`,
        // Eingepasst wird auf die Kette (Befund 21.10.: sonst stand sie winzig zwischen den Übergaben) — die Übergaben dürfen am Rand angeschnitten sein.
        box: einpassBox(lage), boxen: boxenVon({ phasen: lage.phasen, geister: lage.geister }), faeden, rahmen: lage.rahmen,
        minimap: [...lage.phasen.map(x => ({ box: x, farbe: tonVon(p) })), ...lage.geister.map(g => ({ box: g, farbe: C.inkLeise }))],
        zeichne: st => <ProzessBild lage={lage} prozess={p} zahlen={zahlen} stufe={st} spitze={spitze}
          onPhase={id => buehne.current?.fliegeIn(id, () => geh({ p: p.id, ph: id }))} onGeist={id => buehne.current?.fliegeIn(`geist:${id}`, () => geh({ p: id }))} onZahl={h => router.push(h)} />,
      };
    }
    const bild = flaecheBild(alsVorlage(p));
    const ende = endeSchritte(p);
    const boxen = new Map<string, Rechteck>([...bild.rahmen.map(r => [r.id, r] as [string, Rechteck]), ...bild.knoten.map(k => [k.id, k] as [string, Rechteck])]);
    return {
      schluessel: `ablauf:${p.id}`, label: `Ablauf von „${p.titel}“: ${bild.rahmen.length} Phasen als Rahmen, ${bild.knoten.length} Schritte`,
      box: huelle([bild.box], 40), boxen,
      faeden: bild.pfeile.filter(pf => !ende.has(pf.von)).map(pf => flaecheFaden(pf, FLOW_TON)),
      rahmen: [{ id: 'alles', titel: p.titel, box: huelle([bild.box], 40) }, ...bild.rahmen.map(r => ({ id: r.id, titel: r.titel, box: huelle([r], 20) }))],
      minimap: [...bild.rahmen.map(r => ({ box: r, farbe: C.inkLeise })), ...bild.knoten.map(k => ({ box: k, farbe: FORM_FARBE[k.form] }))],
      zeichne: st => <AblaufBild bild={bild} prozess={p} zahlen={zahlen} gewaehlt={pfad.s ?? null} stufe={st} spitze={spitze} ende={ende}
        onSchritt={(phase, id) => geh({ p: p.id, ph: phase, s: id }, { ersetzen: !!pfad.s })} onPhase={id => geh({ p: p.id, ph: id }, { ersetzen: true })} onZahl={h => router.push(h)} />,
    };
  }, [daten, landLage, fokus, rahmenFokus, prozesse, zahlen, nach, p, ph, pfad.s, geh, router, toene]);

  // ── Wie die neue Szene landet: tiefer = heran, höher = aus dem Element heraus (Punkt 12) ──
  const vorher = useRef<ProzessPfad | null>(null);
  const einflug = useMemo<Einflug>(() => {
    const v = vorher.current;
    if (!v || !szene) return { art: 'neu' };
    const alt = Math.min(3, ebeneVon(v)), neu = Math.min(3, ebene);
    if (neu < alt) { const von = neu === 1 ? v.p : v.ph; if (von) return { art: 'raus', von }; }
    return { art: 'rein' };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Szenenwechsel
  }, [szene?.schluessel]);
  useEffect(() => { if (daten) vorher.current = pfad; });
  // Zurück auf der Landkarte: der Prozess, aus dem man kommt, bleibt gewählt — seine Wege stehen hell, bis man woanders hinklickt.
  useEffect(() => { if (einflug.art === 'raus' && ebene === 1) setGewaehlt(einflug.von); }, [einflug, ebene]);

  // ── Präsentieren: Rahmen für Rahmen ──
  const rahmen = useMemo(() => szene?.rahmen ?? [], [szene?.rahmen]);
  useEffect(() => { setRahmenNr(0); }, [praes, szene?.schluessel]);
  useEffect(() => {
    if (!praes || !rahmen[rahmenNr]) return;
    const t = window.setTimeout(() => buehne.current?.rahmen(rahmen[rahmenNr].box), 60);
    return () => window.clearTimeout(t);
  }, [praes, rahmenNr, rahmen]);
  const blaettern = useCallback((d: number) => setRahmenNr(n => Math.max(0, Math.min(rahmen.length - 1, n + d))), [rahmen.length]);

  // ── Suche: an den Ort, dort aufleuchten (Punkt 15) ──
  const treffer = (t: SuchTreffer) => {
    const gleich = (t.ziel.p ?? '') === (pfad.p ?? '') && (t.ziel.ph ?? '') === (pfad.ph ?? '') && (t.ziel.s ?? '') === (pfad.s ?? '');
    if (ansicht !== 'bild') { geh(t.ziel); return; }
    if (!gleich) geh(t.ziel);
    if (t.art === 'prozess') setGewaehlt(t.leuchten);
    setLeuchten(l => ({ id: t.leuchten, n: (l?.n ?? 0) + 1 }));
  };
  const auswahlZeigen = useCallback(() => { const id = pfad.s ?? pfad.ph ?? leuchten?.id; if (id) buehne.current?.zeige(id, true); else buehne.current?.allesZeigen(); }, [pfad.s, pfad.ph, leuchten?.id]);

  // ── Tastatur (Punkt 13) ──
  const stand = useRef({ hilfe, voll, praes, ebene, pfad, ansicht, einzeltasten, vollbild });
  stand.current = { hilfe, voll, praes, ebene, pfad, ansicht, einzeltasten, vollbild };
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const st = stand.current;
      // Hat die Werkstatt bzw. ein Fenster die Taste schon genommen (Auswahl aufheben, Formauswahl schließen), bleibt das Vollbild.
      if (e.defaultPrevented || document.querySelector('.os-fenster, [role="alertdialog"], .pw-auswahl')) return;
      if (e.key === 'Escape') {
        if (imFeld(e.target)) return;
        if (st.hilfe) { setHilfe(false); e.preventDefault(); return; }
        if (st.voll) { st.vollbild.aus(); e.preventDefault(); return; }
        if (st.ebene > 1) { geh(ebeneHoch(st.pfad)); e.preventDefault(); }
        return;
      }
      if (imFeld(e.target) || st.ansicht !== 'bild') return;
      if (e.altKey && e.code === 'Digit1') { e.preventDefault(); buehne.current?.allesZeigen(); return; }
      if (e.altKey && e.code === 'Digit2') { e.preventDefault(); auswahlZeigen(); return; }
      if (st.praes && ['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); blaettern(1); return; }
      if (st.praes && ['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); blaettern(-1); return; }
      if (!st.einzeltasten || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setMinimap(x => !x); }
      else if (e.key === '?') { e.preventDefault(); setHilfe(x => !x); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); buehne.current?.zoomen(1.25); }
      else if (e.key === '-') { e.preventDefault(); buehne.current?.zoomen(0.8); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); if (st.voll) st.vollbild.aus(); else st.vollbild.an(); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [geh, auswahlZeigen, blaettern]);
  // Aktionen aus dem Menü des Werkzeugs (Leiste, Symbol-Leiste, Blatt): „Vorlagen“ öffnet die Galerie, „Präsentieren“ den Modus (synchron im Klick — Fullscreen).
  useEffect(() => {
    const hoeren = (e: Event) => {
      const d = (e as CustomEvent<WerkzeugAktion>).detail;
      if (d?.werkzeug !== PROZESSE_WERKZEUG.id) return;
      if (d.aktion === 'vorlagen') setVorlageOffen(true);
      else if (d.aktion === 'praesentieren') stand.current.vollbild.an({ modus: 'praesentieren' });
    };
    window.addEventListener(WERKZEUG_EREIGNIS, hoeren);
    return () => window.removeEventListener(WERKZEUG_EREIGNIS, hoeren);
  }, []);

  // ── Teile ──
  const krumen = daten ? brotkrumen(prozesse, pfad) : [];
  const brot = (
    <nav aria-label="Brotkrumen" className="pz-brot">
      {krumen.map((k, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {i > 0 && <span aria-hidden style={{ color: C.inkLeise }}>›</span>}
          {i === krumen.length - 1
            ? <span aria-current="page" style={{ color: C.ink, fontWeight: 600, overflowWrap: 'break-word', hyphens: 'auto' }}>{k.titel}</span>
            : <Link href={WEG.prozesse({ ...k.pfad, ...(adr.ansicht ? { ansicht: adr.ansicht } : {}), ...(praes ? { modus: 'praesentieren' as const } : adr.voll ? { voll: true } : {}) })} scroll={false} style={{ color: C.inkDim }}>{k.titel}</Link>}
        </span>
      ))}
    </nav>
  );
  const ansichtWahl = <Segmente liste={PROZESS_ANSICHTEN.map(a => ({ id: a.id, label: a.titel }))} aktiv={ansicht} onWahl={ansichtWaehlen} />;
  // Werkzeug-Muster (22.10.): hat die Ansicht eine Fläche (Landkarte bzw. Bild, Werkstatt eines eigenen Prozesses beim Bauen), trägt die Fläche selbst den Pfeil
  // ⤢ oben rechts und füllt im Werkzeugmodus den Bildschirm; Liste und Übersichten stehen dort als Seite unter der Kopfzeile.
  const werkstattOffen = ansicht === 'werkstatt' && p?.quelle === 'werkstatt';
  const flaechig = (ansicht === 'bild' && !!szene && prozesse.length > 0) || (werkstattOffen && !schmal && (adr.w ?? 'bauen') === 'bauen');
  // Wo die Fläche selbst den Pfeil trägt (auch am Handy und im Paket des Fulfillments), steht oben kein zweiter Knopf.
  const pfeilInFlaeche = flaechig || (werkstattOffen && (adr.w ?? 'bauen') === 'bauen') || (ansicht === 'werkstatt' && p?.quelle === 'vorlage' && !!p.editor);
  const vollKnopf = <Knopf leise onClick={() => vollbild.an()} titel="Ganzer Bildschirm (F) — dieser Bereich als Ganzes"><span className="pz-knopf-inhalt"><Maximize2 size={15} aria-hidden />Ganzer Bildschirm</span></Knopf>;
  const praesKnopf = <Knopf leise onClick={() => vollbild.an({ modus: 'praesentieren' })} titel="Präsentieren — Rahmen für Rahmen"><span className="pz-knopf-inhalt"><Presentation size={15} aria-hidden />Präsentieren</span></Knopf>;
  const flaecheLeiste = (
    <div className="pz-leiste" role="toolbar" aria-label="Fläche">
      <SymbolKnopf ariaLabel="Verkleinern (−)" onClick={() => buehne.current?.zoomen(0.8)}><Minus size={16} /></SymbolKnopf>
      <SymbolKnopf ariaLabel="Vergrößern (+)" onClick={() => buehne.current?.zoomen(1.25)}><Plus size={16} /></SymbolKnopf>
      <Knopf leise onClick={() => buehne.current?.allesZeigen()} titel="Alles zeigen (Alt + 1)"><span className="pz-knopf-inhalt"><Fullscreen size={14} aria-hidden />Alles zeigen</span></Knopf>
      <Knopf leise onClick={auswahlZeigen} titel="Auswahl zeigen (Alt + 2)"><span className="pz-knopf-inhalt"><ScanSearch size={14} aria-hidden />Auswahl zeigen</span></Knopf>
      <SymbolKnopf ariaLabel="Minimap an/aus (M)" gedrueckt={minimap} onClick={() => setMinimap(x => !x)}><MapIcon size={16} /></SymbolKnopf>
      <SymbolKnopf ariaLabel="Kürzel (?)" gedrueckt={hilfe} onClick={() => setHilfe(x => !x)}><Keyboard size={16} /></SymbolKnopf>
      {/* Landkarte anpassen (22.10.): nur auf der Landkarte, nie beim Präsentieren — sonst bleibt die Ansicht ruhig. */}
      {ebene === 1 && !praes && !schmal && <SymbolKnopf ariaLabel="Landkarte anpassen" titel="Landkarte anpassen — Bereiche, Töne, Reihenfolge, Beschriftung, ausblenden" gedrueckt={anpassen} offen={anpassen} onClick={() => setAnpassen(x => !x)}><Pencil size={16} /></SymbolKnopf>}
    </div>
  );
  // Im Werkzeugmodus (Miro-Art): Werkzeugleiste links, Zoom unten rechts — dieselben Griffe wie `flaecheLeiste`, nur verteilt.
  const landkarteWerkzeuge = (
    <div className="wz-palette" role="toolbar" aria-label="Fläche">
      <SymbolKnopf ariaLabel="Auswahl zeigen (Alt + 2)" onClick={auswahlZeigen}><ScanSearch size={16} /></SymbolKnopf>
      {ebene === 1 && !schmal && <SymbolKnopf ariaLabel="Landkarte anpassen" titel="Landkarte anpassen — Bereiche, Töne, Reihenfolge, Beschriftung, ausblenden" gedrueckt={anpassen} offen={anpassen} onClick={() => setAnpassen(x => !x)}><Pencil size={16} /></SymbolKnopf>}
      <SymbolKnopf ariaLabel="Kürzel (?)" gedrueckt={hilfe} onClick={() => setHilfe(x => !x)}><Keyboard size={16} /></SymbolKnopf>
    </div>
  );
  const landkarteZoom = (
    <ZoomLeiste massstab={massstab.ref} onKleiner={() => buehne.current?.zoomen(0.8)} onGroesser={() => buehne.current?.zoomen(1.25)} onAlles={() => buehne.current?.allesZeigen()}>
      <SymbolKnopf ariaLabel="Karte (Minimap) an/aus (M)" gedrueckt={minimap} onClick={() => setMinimap(x => !x)}><MapIcon size={16} /></SymbolKnopf>
    </ZoomLeiste>
  );
  const anpassFeld = anpassen && !praes && ebene === 1 && daten ? <LandkarteAnpassen ansicht={anp.ansicht} anpassung={anp.anpassung} speicher={anp.speicher} aendern={anp.aendern} onZu={() => setAnpassen(false)} /> : null;
  // Stellschrauben (22.10.): öffnet man einen System-Prozess, stehen seine Einstellungen unter dem Steckbrief (Bild), unter der Liste bzw. in der Werkstatt.
  const schrauben = !praes && p?.stellschrauben?.length && daten
    ? <StellschraubenKarte key={p.id} p={p} rechte={daten.stellschraubenRechte} stand={daten.stellschraubenStand} onGespeichert={landkarteNeu} />
    : null;
  const feld = anpassFeld ?? (!praes && p ? (
    s && ph ? <SchrittKarte p={p} ph={ph} s={s} zahl={zahlen[zahlSchluessel({ p: p.id, ph: ph.id, s: s.id })]} />
      : ph ? <PhaseKarte p={p} ph={ph} zahlen={zahlen} onSchritt={id => geh({ p: p.id, ph: ph.id, s: id })} />
        : <><SteckbriefKarte p={p} zahl={zahlen[p.id]} />{schrauben}</>
  ) : null);
  const hilfeFenster = hilfe && (
    <div role="dialog" aria-label="Kürzel" className="pz-hilfe">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: TYP.body }}>Kürzel</b>
        <SymbolKnopf ariaLabel="Schließen (Esc)" onClick={() => setHilfe(false)}><X size={16} /></SymbolKnopf>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0, fontSize: TYP.bedien }}>
        {KUERZEL.map(k => <span key={k.taste} style={{ display: 'contents', opacity: k.einzel && !einzeltasten ? 0.5 : 1 }}><dt style={{ color: C.ink, fontWeight: 600 }}>{k.taste}</dt><dd style={{ margin: 0, color: C.inkDim }}>{k.was}</dd></span>)}
      </dl>
      <Wahl an={einzeltasten} onClick={() => { const n = !einzeltasten; setEinzeltasten(n); merkerSchreiben(MERKER_EINZELTASTEN, n ? 'an' : 'aus'); }}>Einzeltasten (M, +, −, F, ?) {einzeltasten ? 'an' : 'aus'}</Wahl>
    </div>
  );

  // ── Inhalt: Bild bzw. Liste, daneben das Feld ──
  let inhalt: ReactNode;
  if (!daten) inhalt = fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <p style={{ color: C.inkDim, fontSize: TYP.bedien }}>Die Landkarte lädt …</p>;
  else if (!prozesse.length) inhalt = <Leerzustand symbol={<Workflow size={20} />} titel="Noch keine Prozesse">Sobald Abläufe im System oder im Fulfillment stehen, erscheinen sie hier.</Leerzustand>;
  else if (ansicht === 'werkstatt') inhalt = p?.quelle === 'system' && schrauben
    ? <div className="pz-mit-schrauben"><WerkstattBereich p={p} schmal={schmal} onNeu={() => setNeuOffen(true)} onVorlage={() => setVorlageOffen(true)} onHead={() => setHeadOffen(true)} onLandkarte={() => void landkarteNeu()} onGanz={voll ? undefined : () => vollbild.an()} />{schrauben}</div>
    : <WerkstattBereich p={p} schmal={schmal} onNeu={() => setNeuOffen(true)} onVorlage={() => setVorlageOffen(true)} onHead={() => setHeadOffen(true)} onLandkarte={() => void landkarteNeu()} onGanz={voll ? undefined : () => vollbild.an()} />;
  else if (ansicht === 'liste') inhalt = schrauben
    ? <div className="pz-mit-schrauben"><ProzessListe prozesse={prozesse} zahlen={zahlen} pfad={pfad} bereiche={anp.ansicht.bereiche} />{schrauben}</div>
    : <ProzessListe prozesse={prozesse} zahlen={zahlen} pfad={pfad} bereiche={anp.ansicht.bereiche} />;
  else if (szene) {
    inhalt = (
      <div className="pz-buehnen-rahmen">
        <Buehne ref={buehne} szene={szene.schluessel} einflug={einflug} box={szene.box} boxen={szene.boxen} faeden={szene.faeden}
          ziel={pfad.s ?? pfad.ph ?? null} leuchten={leuchten} minimap={minimap} minimapTeile={szene.minimap} handy={handy} label={szene.label} praesentieren={praes}
          onFrei={() => setGewaehlt(null)} onMassstab={massstab.setzen}>
          {szene.zeichne}
        </Buehne>
        {/* Der Pfeil oben rechts IN der Fläche (Entscheidung 22.10.): dieser Bereich als Ganzes — im Werkzeugmodus trägt ihn die Kopfzeile (⤡). */}
        {!voll && <GanzerBildschirmKnopf onClick={() => vollbild.an()} kuerzel="F" />}
        {hilfeFenster}
      </div>
    );
  }
  const raster = <div className={`pz-raster${feld && ansicht === 'bild' ? ' pz-mit-feld' : ''}`}><div className="pz-haupt">{inhalt}</div>{feld && ansicht === 'bild' && <aside className="pz-feld" aria-label="Details">{feld}</aside>}</div>;
  // „+ Prozess“ (Kevins Bild 21.10.): Bereich, Fall-Art, Eigner, Steckbrief → Werkstatt; die Kachel steht danach in ihrem Bereich der Fliege.
  const neuKnopf = !schmal && <Knopf leise onClick={() => setNeuOffen(true)} titel="Einen eigenen Prozess anlegen (Werkstatt)"><span className="pz-knopf-inhalt"><Plus size={15} aria-hidden />Prozess</span></Knopf>;
  const vorlageKnopf = !schmal && <Knopf leise onClick={() => setVorlageOffen(true)} titel="Einen Prozess aus einer Vorlage der Kundengewinnung anlegen"><span className="pz-knopf-inhalt"><LayoutTemplate size={15} aria-hidden />Vorlage</span></Knopf>;
  const vorlageFenster = vorlageOffen && (
    <VorlagenGalerie onZu={() => setVorlageOffen(false)}
      onAngelegt={async id => { await landkarteNeu(); setVorlageOffen(false); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt', ...(adr.voll ? { voll: true } : {}) }), { scroll: false }); }} />
  );
  const headFenster = headOffen && (
    <HeadFragenFenster onZu={() => setHeadOffen(false)}
      onUebernommen={async r => { await landkarteNeu(); setHeadOffen(false); router.push(WEG.prozesse({ p: r.prozessId, ansicht: 'werkstatt', ...(adr.voll ? { voll: true } : {}) }), { scroll: false }); }} />
  );
  const neuFenster = neuOffen && (
    <NeuerProzessFenster onZu={() => setNeuOffen(false)} bereichVorgabe={p?.band === 'kern' ? p.stufe : p?.band === 'fuehrung' ? 'fuehrung' : p?.band === 'unterstuetzung' ? 'unterstuetzung' : undefined}
      onAngelegt={async id => { await landkarteNeu(); setNeuOffen(false); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt', ...(adr.voll ? { voll: true } : {}) }), { scroll: false }); }} />
  );

  const headKnopf = !schmal && <Knopf leise onClick={() => setHeadOffen(true)} titel="Head fragen — einen ganzen Prozess vorschlagen lassen (übernommen erst mit deinem Klick)"><span className="pz-knopf-inhalt"><Sparkles size={15} aria-hidden />Head fragen</span></Knopf>;

  // ── Präsentieren: über allem (Portal in den Body — nie in einer Karte mit Transform), Rahmen für Rahmen ──
  if (voll && praes) {
    if (!montiert) return null;
    return createPortal(
      <div className="pz-voll pz-praesentieren" role="dialog" aria-modal="true" aria-label="Prozesse präsentieren" style={{ fontFamily: SCHRIFT.text, color: C.ink }}>
        <div className="pz-voll-inhalt">{raster}</div>
        <div className="pz-praes-leiste" role="toolbar" aria-label="Präsentieren">
          <SymbolKnopf ariaLabel="Rahmen zurück (←)" aus={rahmenNr <= 0} onClick={() => blaettern(-1)}><ChevronLeft size={18} /></SymbolKnopf>
          <span aria-live="polite" style={{ fontSize: TYP.bedien, color: C.inkDim, minWidth: 160, textAlign: 'center' }}>{rahmen.length ? `${rahmenNr + 1} / ${rahmen.length} · ${rahmen[rahmenNr]?.titel ?? ''}` : ''}</span>
          <SymbolKnopf ariaLabel="Rahmen weiter (→)" aus={rahmenNr >= rahmen.length - 1} onClick={() => blaettern(1)}><ChevronRight size={18} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Präsentieren beenden (Esc)" onClick={() => vollbild.aus()}><X size={18} /></SymbolKnopf>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Werkzeugmodus (Vollbild, `voll=1`): der Rahmen des Werkzeug-Musters — Esc führt diese Seite selbst (Dialoge, Hilfe zuerst) ──
  if (voll) {
    const bildFlaeche = flaechig && ansicht === 'bild';
    const feldTitel = anpassFeld ? 'Landkarte anpassen' : s ? 'Schritt' : ph ? 'Phase' : 'Steckbrief';
    return (
      <WerkzeugRahmen werkzeug={PROZESSE_WERKZEUG} titel={brot} flaechig={flaechig} esc={false} onVerlassen={() => vollbild.aus()} label="Prozesse im Vollbild">
        <WerkzeugSlot ort="titel">{ansichtWahl}</WerkzeugSlot>
        <WerkzeugSlot ort="aktionen">
          {daten && <ProzessSuche prozesse={prozesse} onTreffer={treffer} />}
          {!werkstattOffen && <>{neuKnopf}{vorlageKnopf}{ansicht === 'bild' && praesKnopf}</>}
        </WerkzeugSlot>
        {bildFlaeche && <WerkzeugSlot ort="links">{landkarteWerkzeuge}</WerkzeugSlot>}
        {bildFlaeche && <WerkzeugSlot ort="unten-rechts">{landkarteZoom}</WerkzeugSlot>}
        {/* Die Werkstatt eines eigenen Prozesses fragt den Head mit dem offenen Prozess (sie legt ihren Knopf selbst dorthin). */}
        {!werkstattOffen && headKnopf && <WerkzeugSlot ort="unten-links">{headKnopf}</WerkzeugSlot>}
        {bildFlaeche ? <>{inhalt}{feld && <WerkzeugFeld titel={feldTitel} oeffnenBei={anpassFeld ? 'anpassen' : pfad.s ?? pfad.ph ?? pfad.p ?? null}>{feld}</WerkzeugFeld>}</> : raster}
        {neuFenster}
        {vorlageFenster}
        {headFenster}
      </WerkzeugRahmen>
    );
  }

  return (
    <Seite titel="Prozesse" ton={STUFE_FARBE.uebergabe} rechts={<div className="pz-kopf-werkzeuge">{ansichtWahl}{neuKnopf}{vorlageKnopf}{!handy && praesKnopf}{!pfeilInFlaeche && vollKnopf}</div>}>
      <Karte className="pz-karte">
        <div className="pz-oben">
          {brot}
          {daten && <ProzessSuche prozesse={prozesse} onTreffer={treffer} />}
        </div>
        {ansicht === 'bild' && daten && flaecheLeiste}
        {raster}
 {neuFenster}
        {vorlageFenster}
        {headFenster}
        {ansicht === 'bild' && daten && ebene === 1 && <p className="pz-legende" style={{ ...MIKRO, margin: 0, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien, color: C.inkLeise }}>Ein Klick fährt hinein · Überfahren zeigt alle Übergaben einer Kachel · Zahl = Fälle, ein Klick darauf zeigt sie · „System“ = schon im Code gebaut, nur lesbar</p>}
      </Karte>
    </Seite>
  );
}


/**
 * Die Werkstatt im Bereich der Seite (Etappe B2): ohne Prozess die Übersicht mit „+ Prozess“; ein eigener Prozess öffnet die Werkstatt; System-Prozesse bleiben hier
 * nur lesbar. Pakete des Fulfillments öffnen sich seit 22.10. (Fulfillment in die Werkstatt, Etappe 1) auf derselben Fläche zum Ansehen (./PaketWerkstatt.tsx);
 * Landkarte (Hochhaus) und gezeichnete Abläufe sind Bilder und bleiben ein Hinweis mit Sprung.
 */
function WerkstattBereich({ p, schmal, onNeu, onVorlage, onHead, onLandkarte, onGanz }: { p: ReturnType<typeof prozessVon>; schmal: boolean; onNeu: () => void; onVorlage: () => void; onHead: () => void; onLandkarte: () => void;
  /** Werkzeug-Muster (22.10.): der Pfeil ⤢ oben rechts in der Fläche — fehlt im Werkzeugmodus (dort trägt ihn die Kopfzeile). */ onGanz?: () => void }) {
  if (!p) return <WerkstattUebersicht onNeu={onNeu} onVorlage={onVorlage} onHead={onHead} />;
  if (p.quelle === 'werkstatt') return <Werkstatt key={p.id} prozessId={p.id} nurAnsehen={schmal} onLandkarte={onLandkarte} onGanzerBildschirm={onGanz} />;
  // Fulfillment in die Werkstatt (22.10., Etappe 1): ein Paket öffnet sich auf derselben Fläche — nur ansehen; bearbeitet wird bis Etappe 2 im Editor des Fulfillments.
  if (p.quelle === 'vorlage' && p.editor) return <PaketWerkstatt key={p.id} paketId={p.id} schmal={schmal} onGanzerBildschirm={onGanz} />;
  if (p.quelle === 'vorlage') {
    return (
      <Hinweis art="info" titel={`„${p.titel}“ ist eine Vorlage des Fulfillments`} aktion={p.editor ? <Knopf leise href={p.editor}>Im Fulfillment-Editor öffnen ›</Knopf> : undefined}>
        Pakete und Abläufe des Fulfillments werden in ihrem eigenen Editor gebaut — hier sind sie nur zu sehen (Bild und Liste).
      </Hinweis>
    );
  }
  return (
    <Hinweis art="info" titel={`„${p.titel}“ ist ein System-Prozess`} aktion={p.link ? <Knopf leise href={p.link.href}>{`Wo es läuft: ${p.link.text} ›`}</Knopf> : undefined}>
      {p.stellschrauben?.length
        ? 'Der Ablauf ist im Code gebaut — seine Stellschrauben stellst du darunter ein. Eigene Prozesse entstehen über „+ Prozess“.'
        : 'Er ist im Code gebaut und nur lesbar. Eigene Prozesse entstehen über „+ Prozess“.'}
    </Hinweis>
  );
}

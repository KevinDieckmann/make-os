'use client';

// ─── Prozesse · Werkstatt — hier baut der Haushalt seine Prozesse (Etappe B2, 21.10.; ANALYSE_100.md Punkte 8, 16–19, 22, 23, 25, 43) ─────────────────────────
// Die dritte Darstellung der Prozesse (`PROZESS_ANSICHTEN`: Bild · Liste · Werkstatt), im Stil eines n8n-Editors, aber in Klar·DARK und mit unseren Dingen:
//   · Fläche (./WerkstattFlaeche.tsx) mit Knoten, Bahnen, Phasen und dem Flow als Verbindung; Panel rechts (./WerkstattPanel.tsx) mit der Maske des Bausteins.
//   · Entwurf & Version (Punkt 43): die Fläche IST der Entwurf und speichert sich selbst (EIN Weg: POST /api/prozesse/werkstatt `entwurf`, Stand/409). Kommt eine
//     andere Fassung dazwischen, bleibt „Deine Fassung“ stehen — speichern oder die andere übernehmen, nie still verworfen; Ungespeichertes übersteht ein Neuladen
//     (Sitzungsspeicher, bis der Server bestätigt). „Veröffentlichen“ mit Name und Notiz, Versionen ansehen, vergleichen, als Entwurf übernehmen (./WerkstattVersionen.tsx).
//   · Bauen-Komfort: Rückgängig/Wiederholen, Kopieren/Einfügen mit Kanten, Alt+Pfeil, Tab = Formauswahl, „Ordnen“, Raster, Hilfslinien, „Teilprozess bilden?“,
//     Beschriftung nach Regel — alles reine Regeln in lib/prozesse/werkstatt-*.ts; diese Datei verbindet nur.
//   · Kopfzeile (22.10., Kevins Bild n8n „Executions“): Reiter Bauen · Läufe · Tests auf demselben Bild (Adresse `w=`, ein Lauf `lauf=` — lib/prozesse/adresse.ts);
//     der Zustand des Prozesses (Entwurf · Probelauf · scharf · pausiert) mit „Scharf schalten“, Pausieren und den Einstellungen (./WerkstattSteuerung.tsx);
//     „Probelauf“ fragt den Lauf-Motor (POST /api/prozesse/probelauf) mit dem Beispiel oder einem echten Fall (./ProbeFall.tsx) und färbt die Knoten — solange es
//     ihn nicht gibt: „Probelauf kommt mit dem Lauf-Motor“. Läufe: ./WerkstattLaeufe.tsx, Tests: ./WerkstattTests.tsx, Webhook am Auslöser: ./WerkstattWebhook.tsx.
//   · Rollen (lib/prozesse/rollen.ts): volle Mitglieder veröffentlichen, alle im Haushalt bauen Entwürfe; System-Prozesse und Fulfillment-Pakete bleiben hier
//     nur lesbar. Am Handy (unter 768 px) nur ansehen.
//   · Werkzeugmodus (22.10., Werkzeug-Muster — ../werkzeug/rahmen.tsx): der Pfeil ⤢ oben rechts in der Fläche öffnet den ganzen Bildschirm; dort füllt die
//     Fläche alles, und dieselben Griffe schweben Miro-artig: Ordnen, Zettel, Phase, Raster … links, Zoom unten rechts, „Head fragen“ unten links, Probelauf
//     und Veröffentlichen oben rechts, Zustand und Version hinter dem Titel; das Panel schwebt rechts und klappt ein. Außerhalb bleibt alles wie bisher.
//   · Werkstatt bau-fertig (22.10., n8n-Niveau): Hinweise schweben, Doppelklick benennt auf der Fläche, „+“ mitten auf dem Faden, Verbinden über Phasen und Kantenende
//     umhängen, Knoten-Auswahl als Seitenleiste, Befund mit Satz, großes Fenster (./WerkstattGross.tsx) mit Platzhaltern an den Cursor, Testdaten, „Weg annehmen“,
//     „Nur diesen Schritt“ / „Bis hier“ und „Modell wirklich fragen“, Lauf → Testdaten, Karte, Ausschalten, Kopieren zwischen Prozessen, Mehrfach-Entscheidung.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Undo2, Redo2, LayoutGrid, Grid3x3, StickyNote, Plus, Minus, Fullscreen, Keyboard, Play, Upload, X, Columns3, Check, CloudOff, Loader2, Sparkles, Map as KarteSymbol } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, LEUCHT } from '@/lib/make-one/design';
import { Knopf, Hinweis, SymbolKnopf, Chip, Reiter } from '../ui';
import { neueKennung } from '@/lib/kennung';
import { definitionPruefen, sperrtVeroeffentlichen } from '@/lib/prozesse/definition-pruefen';
import { katalogEintrag, type KatalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { headDef } from '@/lib/agenten/katalog';
import { FACH_AGENTEN } from '@/lib/prozesse/agent-schritt';
import { alleSchritte, phasen, wurzel } from '@/lib/prozesse/fluss';
import type { AgentWer, Befund, KnotenLage, ProzessDefinition, ProzessForm, ProzessKnoten, ProzessVersion } from '@/lib/prozesse/definition';
import {
  werkstattLage, lagenFesthalten, ordnen, zettelFreiLegen, kachelnFuerAlles, ortBei, inBahn, bahnSchluessel, knotenMass, WS, type TeamName, type KanteLage,
} from '@/lib/prozesse/werkstatt-lage';
import {
  anlegen, verbinden, loesen, loeschen, ersetzen, umbenennen as umbenennen_, lageSetzen, inPhase, pfeilText, phaseNeu, phaseLoeschen, teilprozessBilden, zettelNeu, zettelAendern, zettelWeg,
  kopieren, einfuegen, merke, rueckgaengig, wiederholen, LEERE_GESCHICHTE, phaseVon, verbindenFrei, umhaengen, zwischenEinfuegen, zwischenGrund, mehrfachEntscheidung,
  type Ablage, type Ergebnis, type Fassung, type Geschichte,
} from '@/lib/prozesse/werkstatt-aktionen';
import { neuerKnoten, knotenUnterzeile, maskeAnwenden, maskeWerte } from '@/lib/prozesse/werkstatt-maske';
import { teilprozessFall, teilprozessTitel } from '@/lib/prozesse/teilprozess-neu';
import { FALL_ARTEN } from '@/lib/prozesse/definition';
import Link from 'next/link';
import { bahnBeimAnhaengen } from '@/lib/prozesse/werkstatt-lage';
import { laufBefunde } from '@/lib/prozesse/lauf-regeln';
import { webhookAusloeserVon } from '@/lib/prozesse/webhook';
import { prozesseAusAdresse, type WerkstattReiterId } from '@/lib/prozesse/adresse';
import { werkstattZiel } from '@/lib/prozesse/werkstatt-ziel';
import { testStand } from '@/lib/prozesse/laeufe-ansicht';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { ablageAus, ablageFuerSpeicher, ABLAGE_MERKER } from '@/lib/prozesse/ablage';
import type { ProzessStatus } from '@/lib/prozesse/definition';
import { altPfeil, nachbar, WERKSTATT_KUERZEL, type TastenAktion } from '@/lib/prozesse/werkstatt-tastatur';
import { hinweiseVon, probelaufAus, probelaufKoerper, PROBELAUF_PFAD, PROBE_FEHLT, centText, type ProbeErgebnis, type ProbeSchritt } from '@/lib/prozesse/werkstatt-hinweise';
import { WerkstattFlaeche, type AnhangZiel, type FlaecheSteuerung } from './WerkstattFlaeche';
import { WerkstattPanel } from './WerkstattPanel';
import { WerkstattFormauswahl } from './WerkstattFormauswahl';
import { VersionenFenster } from './WerkstattVersionen';
import { ProzessKopieren } from './WerkstattKopie';
import { HeadFragenFenster } from './HeadFragen';
import { useKatalog, useProzess, versionHolen, vergleichHolen, werkstattSenden, type EintragAnsicht } from './werkstatt-daten';
import { UeberfuehrungBand } from './Ueberfuehrung';
import { WerkstattGross, type ModellAntwort } from './WerkstattGross';
import { MehrfachFenster } from './WerkstattMehrfach';
import { VorlageKontext, EingabeKontext, type VorlageZiel, type EingabeRegister } from './WerkstattMaske';
import { speicherAnzeige } from '@/lib/prozesse/eingabe-puffer';
import { testWerte, annahmenAusLauf, type ProzessTestdaten } from '@/lib/prozesse/testdaten';
import type { LaufKurz } from '@/lib/prozesse/lauf-regeln';
import type { LaufSchritt } from '@/lib/prozesse/lauf-typen';
import { WerkstattSteuerung } from './WerkstattSteuerung';
import { WerkstattLaeufe } from './WerkstattLaeufe';
import { WerkstattTests, testsPruefen, type TestErgebnis } from './WerkstattTests';
import { DatumAusloeserKarte } from './WerkstattDatum';
import { WebhookKarte, type WebhookKurz } from './WerkstattWebhook';
import { ProbeFallFenster, type FallWert } from './ProbeFall';
import { useLaeufe } from './laeufe-daten';
import { MobilMaske, MobilSchrittListe } from './MobilBearbeiten';
import { werkstattMobilAnwenden, werkstattMobilFelder } from '@/lib/prozesse/mobil-felder';
import { useWerkzeugModus, WerkzeugSlot, WerkzeugFeld, GanzerBildschirmKnopf } from '../werkzeug/rahmen';
import { ZoomLeiste, useMassstab } from '../werkzeug/zoom';

type K = ProzessKnoten<ProzessForm>;

/** Die Reiter der Kopfzeile (22.10., Kevins Bild n8n „Executions“) — „Läufe“ und „Tests“ kamen mit dem Lauf-Motor (Entscheidung 21.10.: keine toten Reiter). */
export const WERKSTATT_REITER: readonly { id: WerkstattReiterId; titel: string }[] = [{ id: 'bauen', titel: 'Bauen' }, { id: 'laeufe', titel: 'Läufe' }, { id: 'tests', titel: 'Tests' }];
const ENTWURF_MERKER = (id: string) => `make-prozess-entwurf:${id}`;
const ZU_MERKER = (id: string) => `make-prozess-zu:${id}`;
const RASTER_MERKER = 'make-werkstatt-raster';
const KARTE_MERKER = 'make-werkstatt-karte';
const lies = (s: Storage | undefined, k: string) => { try { return s?.getItem(k) ?? null; } catch { return null; } };
const schreib = (s: Storage | undefined, k: string, v: string | null) => { try { if (v === null) s?.removeItem(k); else s?.setItem(k, v); } catch { /* privates Fenster */ } };
const sitzung = () => (typeof window !== 'undefined' ? window.sessionStorage : undefined);
const lokal = () => (typeof window !== 'undefined' ? window.localStorage : undefined);
const fassungVon = (d: Pick<ProzessDefinition, 'knoten' | 'zettel'>): Fassung => ({ knoten: d.knoten, ...(d.zettel ? { zettel: d.zettel } : {}) });
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const tagZeit = (iso: string) => { const t = new Date(iso); return Number.isFinite(t.getTime()) ? t.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : iso; };

type Speicher = { art: 'gespeichert' | 'ausstehend' | 'speichert' | 'fehler' | 'konflikt' | 'offline'; text?: string };
/** Was am Knoten steht (Feinschliff 24.10.): ein Rat mit `warnung` (z. B. eine Rolle ohne Person) steht gelb wie „offen“ — er sperrt nichts. */
const amKnoten = (x: Befund): 'fehler' | 'offen' | null => (x.stufe === 'fehler' ? 'fehler' : x.stufe === 'offen' || x.warnung ? 'offen' : null);

export function Werkstatt({ prozessId, nurAnsehen, onLandkarte, onGanzerBildschirm }: { prozessId: string; nurAnsehen: boolean; /** Steckbrief bzw. Version geändert — die Landkarte (Kachel, Brotkrumen) neu laden. */ onLandkarte?: () => void;
  /** Werkzeug-Muster (22.10.): der Pfeil ⤢ oben rechts in der Fläche — „Ganzer Bildschirm“ (außerhalb des Werkzeugmodus). */ onGanzerBildschirm?: () => void }) {
  const { daten, fehler: ladeFehler, laden: prozessLaden } = useProzess(prozessId);
  const laeufe = useLaeufe(prozessId);
  const router = useRouter();
  const adr = prozesseAusAdresse(useSearchParams());
  const reiter: WerkstattReiterId = adr.w ?? 'bauen';
  // Werkzeugmodus (22.10.): im Rahmen des Werkzeugs, mit Fläche über den ganzen Bildschirm — dann schweben die Griffe (Orte des Rahmens).
  const modus = useWerkzeugModus();
  const imModus = !!modus?.flaechig && reiter === 'bauen' && !nurAnsehen;
  const massstab = useMassstab();
  const reiterWaehlen = (w: WerkstattReiterId, lauf?: string | null) => router.push(WEG.prozesse({ p: prozessId, ansicht: 'werkstatt', w, ...(lauf ? { lauf } : {}), ...(adr.voll ? { voll: true } : {}) }), { scroll: false });
  const kat = useKatalog();
  const auswahlListen = useMemo(() => kat.daten?.auswahl ?? {}, [kat.daten]);
  const modelle = useMemo(() => kat.daten?.modelle ?? [], [kat.daten]);
  const team = useMemo<TeamName[]>(() => (auswahlListen['team-person'] ?? []).filter(t => !t.id.startsWith('rolle:')).map(t => ({ id: t.id, name: t.label })), [auswahlListen]);

  const [eintrag, setEintrag] = useState<EintragAnsicht | null>(null);
  const [fassung, setFassungRoh] = useState<Fassung | null>(null);
  const [befundeServer, setBefundeServer] = useState<Befund[]>([]);
  const [geaendertSeitVersion, setGeaendertSeitVersion] = useState(true);
  const [speicher, setSpeicher] = useState<Speicher>({ art: 'gespeichert' });
  const [konflikt, setKonflikt] = useState<{ eintrag: EintragAnsicht; stand: string } | null>(null);
  const [wiederher, setWiederher] = useState<Fassung | null>(null);
  const [geschichte, setGeschichte] = useState<Geschichte>(LEERE_GESCHICHTE);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [kanteWahl, setKanteWahl] = useState<string | null>(null);
  const [rahmenWahl, setRahmenWahl] = useState<string | null>(null);
  const [andockWahl, setAndockWahl] = useState<{ id: string; art: string } | null>(null);
  const [titelFokus] = useState(0);
  /** Werkstatt bau-fertig (Punkt 2): dieser Knoten wird gerade direkt auf der Fläche umbenannt. */
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  /** Punkt 15: die Bau-Hilfe „Mehrfach-Entscheidung“ — hinter diesem Knoten. */
  const [mehrfach, setMehrfach] = useState<string | null>(null);
  /** Punkt 7: das große Einstellungsfenster (Eingabe · Maske · Ausgabe) für diesen Knoten. */
  const [gross, setGross] = useState<string | null>(null);
  /** Punkt 6: ein Klick auf den Befund am Knoten springt in sein Feld. */
  const [feldFokus, setFeldFokus] = useState<{ knoten: string; feld?: string; n: number } | null>(null);
  /** Punkt 10: das Ergebnis von „Nur diesen Schritt“ bzw. „Bis hier testen“ (nur für den Knoten des großen Fensters). */
  const [schrittTest, setSchrittTest] = useState<{ knoten: string; ergebnis: ProbeErgebnis & { art: 'nur' | 'bis' } } | null>(null);
  const [schrittTestLaeuft, setSchrittTestLaeuft] = useState(false);
  /** Punkt 8: das Textvorlagen-Feld, das zuletzt den Fokus hatte — Platzhalter landen dort am Cursor. */
  const vorlageZiel = useRef<VorlageZiel | null>(null);
  const [ansage, setAnsage] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'achtung' | 'kritisch' | 'info'; link?: { href: string; text: string } } | null>(null);
  const [formauswahl, setFormauswahl] = useState<{ ziel: AnhangZiel & { bahn?: string }; form?: ProzessForm } | null>(null);
  const [probe, setProbe] = useState<ProbeErgebnis | null>(null);
  const [probeHinweis, setProbeHinweis] = useState<string | null>(null);
  const [versionAnsicht, setVersionAnsicht] = useState<ProzessVersion | null>(null);
  /** 22.10.: „Als neuen Entwurf zurückholen“ an der gezeigten Version — erst nach der Rückfrage. */
  const [zurueckholen, setZurueckholen] = useState(false);
  const [versionenOffen, setVersionenOffen] = useState(false);
  const [hilfe, setHilfe] = useState(false);
  const [headOffen, setHeadOffen] = useState(false);
  const [raster, setRaster] = useState(true);
  /** Punkt 12: die Karte (Minimap) unten rechts — gemerkt im Browser. */
  const [karte, setKarte] = useState(false);
  const [zu, setZu] = useState<Set<string>>(new Set());
  /** „Alles zeigen“ als Kacheln (Befund 6): die Phasen, die die Übersicht gerade zugeklappt zeigt — nur für den Augenblick, nie gemerkt. */
  const [uebersicht, setUebersicht] = useState<Set<string> | null>(null);
  const einpassen = useRef<'alles' | { phase: string } | null>(null);
  const [webhook, setWebhook] = useState<WebhookKurz | null>(null);
  const [probeFall, setProbeFall] = useState<FallWert>('beispiel');
  const [probeOffen, setProbeOffen] = useState(false);
  /** Feinschliff 24.10.: der Probelauf klappt das Seitenfeld (Werkzeugmodus) für den Augenblick ein — ein Zähler, kein Merker. */
  const [panelZu, setPanelZu] = useState(0);
  const allesZeigenRef = useRef<() => void>(() => {});
  const [testErg, setTestErg] = useState<Map<string, TestErgebnis>>(new Map());
  /** Feinschliff 22.10. (Befund 2): ein neu angehängter Knoten — sobald die Lage ihn kennt, fährt die Kamera hin. */
  const zeigeNeu = useRef<string | null>(null);
  const flaeche = useRef<FlaecheSteuerung>(null);
  const stand = useRef('');
  const fassungRef = useRef<Fassung | null>(null);
  fassungRef.current = fassung;
  const aenderung = useRef(0);
  const gesichert = useRef(0);
  const ablage = useRef<{ ablage: Ablage; am: string } | null>(null);
  const rahmen = useRef<HTMLDivElement | null>(null);

  // ── Laden: Server-Fassung übernehmen; eine ungespeicherte Fassung aus dieser Sitzung bleibt (gleicher Stand) bzw. wird angeboten ──
  useEffect(() => {
    if (!daten || eintrag) return;
    setEintrag(daten.eintrag);
    stand.current = daten.stand;
    setBefundeServer(daten.befunde);
    setGeaendertSeitVersion(daten.entwurfGeaendert);
    const server = fassungVon(daten.eintrag.entwurf);
    setFassungRoh(server);
    const roh = lies(sitzung(), ENTWURF_MERKER(prozessId));
    if (roh) {
      try {
        const m = JSON.parse(roh) as { stand: string; fassung: Fassung };
        if (!gleich(m.fassung, server)) {
          if (m.stand === daten.stand) { setFassungRoh(m.fassung); aenderung.current = 1; setSpeicher({ art: 'ausstehend' }); }
          else setWiederher(m.fassung);
        } else schreib(sitzung(), ENTWURF_MERKER(prozessId), null);
      } catch { schreib(sitzung(), ENTWURF_MERKER(prozessId), null); }
    }
    setZu(new Set((lies(lokal(), ZU_MERKER(prozessId)) ?? '').split(',').filter(Boolean)));
    setWebhook((daten.webhook as WebhookKurz | null) ?? null);
    if (lies(lokal(), RASTER_MERKER) === 'aus') setRaster(false);
    if (lies(lokal(), KARTE_MERKER) === 'an') setKarte(true);
  }, [daten, eintrag, prozessId]);

  const rechte = daten?.rechte;
  const nurLesen = nurAnsehen || !rechte?.entwurf || !!versionAnsicht || eintrag?.status === 'archiviert';
  // E6 (22.10., Entscheidung „Am Handy Texte & Fristen ändern“): am Handy Texte, Fristen/Dauer und Zuständige der Schritte — derselbe Entwurf, dieselben Rechte.
  const mobilDarf = nurAnsehen && !!rechte?.entwurf && !versionAnsicht && eintrag?.status !== 'archiviert';
  const [mobilWahl, setMobilWahl] = useState<string | null>(null);
  const d: ProzessDefinition | null = useMemo(() => {
    if (versionAnsicht) return versionAnsicht.definition;
    if (!eintrag || !fassung) return null;
    const { zettel: _z, ...rest } = eintrag.entwurf;
    return { ...rest, knoten: fassung.knoten, ...(fassung.zettel ? { zettel: fassung.zettel } : {}) };
  }, [eintrag, fassung, versionAnsicht]);
  const zuWirksam = useMemo(() => (uebersicht?.size ? new Set([...zu, ...uebersicht]) : zu), [zu, uebersicht]);
  const lage = useMemo(() => (d ? werkstattLage(d, { team, zu: zuWirksam }) : null), [d, team, zuWirksam]);
  useEffect(() => { const id = zeigeNeu.current; if (id && lage?.knoten.has(id)) { zeigeNeu.current = null; flaeche.current?.insBild(id); } }, [lage]);
  // Nach dem Umschalten der Übersicht (bzw. dem Aufklappen einer Kachel) die Kamera auf die neue Lage einpassen.
  useEffect(() => {
    const e = einpassen.current;
    if (!e || !lage) return;
    einpassen.current = null;
    if (e === 'alles') flaeche.current?.allesZeigen(); else flaeche.current?.rahmenZeigen(e.phase);
  }, [lage]);
  useEffect(() => { setUebersicht(null); }, [prozessId, versionAnsicht]);
  // Feinschliff 1 (23.10.): ein Link mit Schritt (`?ph=…&s=…`, lib/prozesse/adresse.ts) wählt ihn — das Panel zeigt seine Einstellungen, eine zugeklappte Phase
  // klappt auf, die Kamera fährt hin. Auch, wenn sich nur die Adresse ändert (kein Neuladen); dieselbe Adresse wirkt einmal.
  const adresseGezeigt = useRef<string | null>(null);
  const zeigeAdresse = useRef<string | null>(null);
  useEffect(() => {
    const schluessel = `${prozessId}|${adr.ph ?? ''}|${adr.s ?? ''}`;
    if (!d || !lage || reiter !== 'bauen' || versionAnsicht || adresseGezeigt.current === schluessel) return;
    adresseGezeigt.current = schluessel;
    const z = werkstattZiel(d, { ph: adr.ph, s: adr.s }, zuWirksam);
    if (!z) return;
    if (z.aufklappen) {
      setUebersicht(u => { if (!u?.has(z.phase)) return u; const n = new Set(u); n.delete(z.phase); return n.size ? n : null; });
      if (zu.has(z.phase)) setZu(alt => { const n = new Set(alt); n.delete(z.phase); schreib(lokal(), ZU_MERKER(prozessId), [...n].join(',') || null); return n; });
    }
    setKanteWahl(null); setAndockWahl(null);
    if (z.art === 'schritt') { setAuswahl([z.id]); setRahmenWahl(null); } else { setAuswahl([]); setRahmenWahl(z.id); }
    // Ein Bild später: dann stehen Seitenfeld und Leisten (Vollbild), und eine aufgeklappte Phase ist in der Lage.
    if (z.aufklappen) zeigeAdresse.current = z.art === 'schritt' ? z.id : `phase:${z.id}`;
    else requestAnimationFrame(() => { if (z.art === 'schritt') flaeche.current?.zeige(z.id); else flaeche.current?.rahmenZeigen(z.id); });
  }, [prozessId, adr.ph, adr.s, d, lage, reiter, versionAnsicht, zu, zuWirksam]);
  useEffect(() => {
    const id = zeigeAdresse.current;
    if (!id || !lage) return;
    const phase = id.startsWith('phase:') ? id.slice(6) : null;
    if (phase ? [...lage.knoten.values()].some(k => k.zu?.phaseId === phase) : !lage.knoten.has(id)) return;
    zeigeAdresse.current = null;
    requestAnimationFrame(() => { if (phase) flaeche.current?.rahmenZeigen(phase); else flaeche.current?.zeige(id); });
  }, [lage]);
  /**
   * „Alles zeigen“ (Befund 6, Feinschliff 1 vom 23.10.): eingepasst ins freie Feld neben Seitenfeld und Leisten; nur wenn der Prozess dort unter den Mindestmaßstab
   * fiele, klappen so wenige Phasen wie nötig zu — die Phase der Auswahl bleibt offen (lib/prozesse/werkstatt-lage.ts `kachelnFuerAlles`). Ein Klick klappt auf.
   */
  const allesZeigen = () => {
    if (!d) return;
    const g = flaeche.current?.groesse() ?? { b: 960, h: 600 };
    const behalten = auswahl.length === 1 ? lage?.knoten.get(auswahl[0])?.phaseId ?? null : rahmenWahl;
    const kacheln = kachelnFuerAlles(d, g, { raender: flaeche.current?.raender(), team, zu, behalten });
    if (kacheln.size) {
      setUebersicht(kacheln);
      einpassen.current = 'alles';
      ansagen(`Alles zeigen: ${kacheln.size === 1 ? 'eine Phase steht' : `${kacheln.size} Phasen stehen`} als Kachel da — ein Klick klappt auf.`);
      return;
    }
    if (uebersicht) { setUebersicht(null); einpassen.current = 'alles'; return; }
    flaeche.current?.allesZeigen();
  };
  allesZeigenRef.current = allesZeigen;
  // Testergebnisse gelten für genau diese Fassung — jede Änderung macht sie wieder „noch nicht geprüft“.
  useEffect(() => { setTestErg(m => (m.size ? new Map() : m)); }, [fassung]);
  const ausstehend = speicher.art === 'ausstehend' || speicher.art === 'speichert' || speicher.art === 'fehler' || speicher.art === 'offline' || speicher.art === 'konflikt';
  const befunde = useMemo(() => (d && (ausstehend || versionAnsicht) ? definitionPruefen(d, {}) : befundeServer), [d, ausstehend, versionAnsicht, befundeServer]);
  const raete = useMemo(() => (d ? hinweiseVon(d) : []), [d]);
  const befundJe = useMemo(() => {
    const m = new Map<string, 'fehler' | 'offen'>();
    for (const b of befunde) { const s = amKnoten(b); if (b.knotenId && s && m.get(b.knotenId) !== 'fehler') m.set(b.knotenId, s); }
    return m;
  }, [befunde]);
  const mitSchloss = useMemo(() => new Set((d?.knoten ?? []).flatMap(k => (k.schloss ? [k.schloss.fuer] : []))), [d]);
  /** Punkt 6: die Sätze der Befunde je Knoten (beim Überfahren der Marke am Knoten). */
  const befundTexte = useMemo(() => {
    const m = new Map<string, { text: string; feld?: string; stufe: 'fehler' | 'offen' }[]>();
    for (const b of befunde) { const s = amKnoten(b); if (b.knotenId && s) m.set(b.knotenId, [...(m.get(b.knotenId) ?? []), { text: b.text, stufe: s, ...(b.feld ? { feld: b.feld } : {}) }]); }
    return m;
  }, [befunde]);
  /** Punkt 3: auf welchen Fäden mitten ein „+“ steht (dazwischen einfügen) — die Regel `zwischenGrund`; Kacheln zugeklappter Phasen nie. */
  /** Punkte 7–8: die Testwerte (Beispiel ∪ Testdaten ∪ Webhook aus dem Schema) für Vorschau und Platzhalter — dieselbe Quelle wie der Probelauf. */
  const testwerte = useMemo(() => testWerte({ testdaten: eintrag?.testdaten ?? null, knoten: d?.knoten ?? [], titel: d?.titel, heute: localDay() }), [eintrag?.testdaten, d?.knoten, d?.titel]);
  const vorlageUmfeld = useMemo(() => ({ werte: testwerte.platzhalter, ziel: vorlageZiel }), [testwerte]);
  const zwischenOk = useMemo(() => new Set(d && lage ? lage.kanten.filter(k => !k.von.startsWith('zu:') && !k.nach?.startsWith('zu:') && zwischenGrund(d, k) === null).map(k => k.id) : []), [d, lage]);
  const probeMap = useMemo(() => (probe ? new Map(probe.schritte.map(s => [s.knotenId, s.status])) : null), [probe]);
  const probeSaetze = useMemo(() => (probe ? new Map<string, ProbeSchritt>(probe.schritte.map(s => [s.knotenId, s])) : null), [probe]);
  const agentName = useCallback((wer: AgentWer) => (wer.art === 'zoe' ? 'ZOE' : wer.art === 'head' ? headDef(wer.headId)?.kurz ?? 'Head' : wer.art === 'skill' ? 'Skill' : FACH_AGENTEN.find(f => f.id === wer.agentId)?.titel.split(' ')[0] ?? 'Agent'), []);
  const unterzeile = useCallback((k: K) => knotenUnterzeile(k, { mitSchloss: mitSchloss.has(k.id), ...(k.agent ? { agentName: agentName(k.agent.wer) } : {}) }), [mitSchloss, agentName]);

  const ansagen = (t: string) => setAnsage(t);
  // Punkt 1: gute Nachrichten verschwinden von selbst (sie schweben über der Fläche) — Warnungen und Fehler bleiben, bis man sie schließt.
  useEffect(() => { if (meldung?.art !== 'gut') return; const t = window.setTimeout(() => setMeldung(null), 6000); return () => window.clearTimeout(t); }, [meldung]);

  // ── Getipptes (Feinschliff 24.10.): jedes Feld meldet, solange es Getipptes hält — der Kopf sagt dann nie „gespeichert“; vor dem Speichern, beim Verlassen der
  // Seite (pagehide) und beim Verbergen wird alles übernommen (lib/prozesse/eingabe-puffer.ts). ──
  const eingaben = useRef(new Map<symbol, () => void>());
  const [tippt, setTippt] = useState(0);
  const eingabeRegister = useMemo<EingabeRegister>(() => ({
    melde: (id, jetzt) => { if (jetzt) eingaben.current.set(id, jetzt); else eingaben.current.delete(id); setTippt(eingaben.current.size); },
  }), []);
  const eingabenUebernehmen = useCallback(() => { for (const f of [...eingaben.current.values()]) f(); }, []);

  // ── Speichern: EIN Weg, nacheinander; die Antwort ersetzt die Fassung nur, wenn seitdem nichts dazukam ──
  const sichern = useCallback(async (o: { keepalive?: boolean } = {}): Promise<boolean> => {
    eingabenUebernehmen();
    const f = fassungRef.current;
    if (!f || aenderung.current === gesichert.current) return true;
    const nr = aenderung.current;
    setSpeicher({ art: 'speichert' });
    const r = await werkstattSenden(() => ({ aktion: 'entwurf', id: prozessId, stand: stand.current, knoten: f.knoten, zettel: f.zettel ?? null }), { keepalive: o.keepalive });
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) {
      stand.current = j.stand;
      setEintrag(j.eintrag);
      setBefundeServer(j.befunde ?? []);
      if (typeof j.entwurfGeaendert === 'boolean') setGeaendertSeitVersion(j.entwurfGeaendert);
      gesichert.current = nr;
      // Feinschliff 24.10. (Bau-Test: „das neue Freigabe-Schloss lag unter dem Panel“): ein Schloss, das die Regel beim Speichern gesetzt hat, kommt ins Bild.
      const neuesSchloss = j.eintrag.entwurf.knoten.find(k => k.schloss && !f.knoten.some(x => x.id === k.id));
      if (neuesSchloss) zeigeNeu.current = neuesSchloss.id;
      if (aenderung.current === nr) {
        setFassungRoh(fassungVon(j.eintrag.entwurf));
        schreib(sitzung(), ENTWURF_MERKER(prozessId), null);
        setSpeicher({ art: 'gespeichert' });
      } else setSpeicher({ art: 'ausstehend' });
      return true;
    }
    if (r.status === 409 && j?.eintrag && j.stand) { setKonflikt({ eintrag: j.eintrag, stand: j.stand }); setSpeicher({ art: 'konflikt' }); return false; }
    if (r.status === 0 || r.status >= 500) { setSpeicher({ art: 'offline', text: 'Keine Verbindung — die Fassung bleibt hier und wird erneut gesendet.' }); return false; }
    if (j?.befunde) setBefundeServer(j.befunde);
    setSpeicher({ art: 'fehler', text: String(j?.fehler ?? 'Nicht gespeichert.') });
    return false;
  }, [prozessId, eingabenUebernehmen]);
  // Nach einer Pause speichern; bei Netzfehler mit wachsendem Abstand erneut.
  const versuch = useRef(0);
  useEffect(() => {
    if (speicher.art !== 'ausstehend' && speicher.art !== 'offline') return;
    if (konflikt) return;
    const warte = speicher.art === 'offline' ? Math.min(60_000, 2000 * 2 ** versuch.current) : 800;
    const t = window.setTimeout(async () => { const ok = await sichern(); versuch.current = ok ? 0 : versuch.current + 1; }, warte);
    return () => window.clearTimeout(t);
  }, [speicher, fassung, konflikt, sichern]);
  // Verlassen mit Ungespeichertem: der Browser fragt.
  useEffect(() => {
    if (!ausstehend && !tippt) return;
    const vorher = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', vorher);
    return () => window.removeEventListener('beforeunload', vorher);
  }, [ausstehend, tippt]);
  // Seite verlassen bzw. verborgen (Feinschliff 24.10.): Getipptes sofort übernehmen (steht damit auch im Sitzungsspeicher) und mit keepalive senden.
  useEffect(() => {
    const weg = () => { eingabenUebernehmen(); if (aenderung.current !== gesichert.current) void sichern({ keepalive: true }); };
    const sicht = () => { if (document.visibilityState === 'hidden') weg(); };
    window.addEventListener('pagehide', weg);
    document.addEventListener('visibilitychange', sicht);
    return () => { window.removeEventListener('pagehide', weg); document.removeEventListener('visibilitychange', sicht); };
  }, [eingabenUebernehmen, sichern]);

  /** Eine Änderung übernehmen: Geschichte, Fassung, Sitzungsspeicher, Speichern anstoßen, Ansage. */
  const anwenden = useCallback((e: Ergebnis, o: { auswahl?: boolean } = {}): boolean => {
    const vorher = fassungRef.current;
    if (!e.ok) { setMeldung({ text: e.grund, art: 'achtung' }); ansagen(e.grund); return false; }
    if (!vorher || gleich(vorher, e.fassung)) return true;
    setGeschichte(g => merke(g, vorher));
    setFassungRoh(e.fassung);
    fassungRef.current = e.fassung;
    aenderung.current++;
    schreib(sitzung(), ENTWURF_MERKER(prozessId), JSON.stringify({ stand: stand.current, fassung: e.fassung }));
    setSpeicher(s => (s.art === 'konflikt' ? s : { art: 'ausstehend' }));
    setMeldung(null);
    ansagen(e.ansage);
    if (e.waehle && o.auswahl !== false) { setAuswahl(e.waehle); setKanteWahl(null); setRahmenWahl(null); }
    return true;
  }, [prozessId]);
  const mitFassung = (f: (x: Fassung) => Ergebnis, o?: { auswahl?: boolean }) => { const x = fassungRef.current; return x ? anwenden(f(x), o) : false; };

  const zurueck = () => { const f = fassungRef.current; if (!f) return; const r = rueckgaengig(geschichte, f); if (!r) { ansagen('Nichts mehr rückgängig zu machen.'); return; } setGeschichte(r.geschichte); setFassungRoh(r.fassung); fassungRef.current = r.fassung; aenderung.current++; setSpeicher({ art: 'ausstehend' }); ansagen('Rückgängig.'); };
  const vor = () => { const f = fassungRef.current; if (!f) return; const r = wiederholen(geschichte, f); if (!r) { ansagen('Nichts zu wiederholen.'); return; } setGeschichte(r.geschichte); setFassungRoh(r.fassung); fassungRef.current = r.fassung; aenderung.current++; setSpeicher({ art: 'ausstehend' }); ansagen('Wiederholt.'); };

  // ── Steckbrief (eigene Aktion; der Name der Wurzel zieht mit) ──
  const steckbrief = async (felder: Record<string, unknown>) => {
    await sichern();
    const r = await werkstattSenden(() => ({ aktion: 'steckbrief', id: prozessId, stand: stand.current, felder }));
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) {
      stand.current = j.stand;
      setEintrag(j.eintrag);
      setBefundeServer(j.befunde ?? []);
      const w = wurzel(j.eintrag.entwurf.knoten);
      if (w) setFassungRoh(f => (f ? { ...f, knoten: f.knoten.map(k => (k.id === w.id ? { ...k, titel: w.titel } : k)) } : f));
      ansagen('Steckbrief gespeichert.');
      onLandkarte?.();
    } else if (r.status === 409 && j?.eintrag && j.stand) setKonflikt({ eintrag: j.eintrag, stand: j.stand });
    else setMeldung({ text: String(j?.fehler ?? 'Der Steckbrief ließ sich nicht speichern.'), art: 'kritisch' });
  };

  // ── Konflikt: Deine Fassung bleibt; speichern oder die andere übernehmen ──
  const meineSpeichern = async () => { if (!konflikt) return; stand.current = konflikt.stand; setEintrag(konflikt.eintrag); setKonflikt(null); aenderung.current++; setSpeicher({ art: 'ausstehend' }); };
  const andereUebernehmen = () => {
    if (!konflikt) return;
    const f = fassungRef.current;
    if (f) setGeschichte(g => merke(g, f));
    stand.current = konflikt.stand; setEintrag(konflikt.eintrag); setFassungRoh(fassungVon(konflikt.eintrag.entwurf));
    gesichert.current = aenderung.current; setKonflikt(null); setSpeicher({ art: 'gespeichert' }); schreib(sitzung(), ENTWURF_MERKER(prozessId), null);
    ansagen('Die andere Fassung ist übernommen — Rückgängig holt deine zurück.');
  };

  // ── „Head fragen“ (22.10., Kundengewinnung): übernommene Bausteine stehen auf dem Server — die neue Fassung holen (Rückgängig holt die vorige zurück);
  // ein ganzer Entwurf ist ein neuer Prozess — dorthin wechseln. ──
  const headUebernommen = async (r: { art: 'prozess' | 'baustein'; prozessId: string; text: string }) => {
    setHeadOffen(false);
    if (r.art === 'prozess' || r.prozessId !== prozessId) { onLandkarte?.(); router.push(WEG.prozesse({ p: r.prozessId, ansicht: 'werkstatt' }), { scroll: false }); return; }
    const neu = await prozessLaden();
    if (!neu) { setMeldung({ text: `${r.text} Bitte die Seite neu laden.`, art: 'achtung' }); return; }
    const f = fassungRef.current;
    if (f) setGeschichte(g => merke(g, f));
    stand.current = neu.stand; setEintrag(neu.eintrag); setFassungRoh(fassungVon(neu.eintrag.entwurf)); setBefundeServer(neu.befunde); setGeaendertSeitVersion(neu.entwurfGeaendert);
    gesichert.current = aenderung.current; setSpeicher({ art: 'gespeichert' }); schreib(sitzung(), ENTWURF_MERKER(prozessId), null);
    setMeldung({ text: r.text, art: 'gut' });
    ansagen(r.text);
  };

  // ── Anlegen über die Formauswahl („+“, Tab, Faden ins Leere) ──
  // Seit 22.10. (bau-fertig, Punkt 5) öffnet die Knoten-Auswahl als Seitenleiste in voller Höhe — der Ort des „+“ zählt nur noch für die Lage des neuen Knotens.
  const anhaengen = (ziel: AnhangZiel & { bahn?: string }, _ort?: [number, number]) => {
    if (nurLesen || !d) return;
    const vonId = ziel.nach ?? (ziel.zwischen ? lage?.kanten.find(k => k.id === ziel.zwischen)?.von : undefined);
    const von = vonId ? d.knoten.find(k => k.id === vonId) : undefined;
    setUmbenennen(null);
    setFormauswahl({ ziel, ...(von?.form && von.form !== 'ausloeser' && von.form !== 'freigabe' ? { form: von.form } : {}) });
  };
  /** Wo ein neuer Knoten liegen soll, wenn die Fläche schon von Hand gelegt ist (sonst legt die Regel ihn selbst). */
  const platzFuer = (neu: K, ziel: AnhangZiel & { bahn?: string }): { platz?: KnotenLage; platzSchaffen?: number } => {
    if (!lage || !d || !d.knoten.some(k => k.pos)) return {};
    const quelle = ziel.nach ? lage.knoten.get(ziel.nach) : ziel.vor ? lage.knoten.get(ziel.vor) : undefined;
    if (!quelle) return {};
    const m = knotenMass(neu);
    const bahn = (ziel.bahn as ReturnType<typeof bahnSchluessel> | undefined) ?? bahnSchluessel(neu);
    const b = lage.bahnen.find(x => x.schluessel === bahn);
    const r = lage.rahmen.find(x => x.id === quelle.phaseId);
    if (!b || !r) return {};
    if (ziel.platz) return { platz: { x: ziel.platz[0] - m.koerper.x - r.x, y: Math.max(WS.bahnRand, ziel.platz[1] - m.koerper.h / 2 - b.y) } };
    const zweig = ziel.ausgang === 'nein' || ziel.ausgang === 'fehler' || ziel.ausgang === 'abgelaufen';
    const x = ziel.vor ? quelle.x - r.x : quelle.x - r.x + quelle.b + WS.spaltenLuecke;
    const y = zweig ? quelle.y - b.y + quelle.h + WS.reihenLuecke : bahn === quelle.bahn ? quelle.y - b.y : WS.bahnRand;
    return { platz: { x, y: Math.max(0, y) }, ...(!zweig ? { platzSchaffen: m.b + WS.spaltenLuecke } : {}) };
  };
  const ausKatalog = (e: KatalogEintrag, ziel: AnhangZiel & { bahn?: string }) => {
    let neu = neuerKnoten(e, neueKennung('fk'));
    if (ziel.bahn) neu = inBahn(neu, ziel.bahn as ReturnType<typeof bahnSchluessel>) ?? neu;
    // Feinschliff 22.10. (Befund 5): was nach außen geht, folgt der Menschen-Bahn des Vorgängers (kein Zickzack Mensch/System/Mensch).
    else if (ziel.nach) { const b = bahnBeimAnhaengen(neu, d?.knoten.find(k => k.id === ziel.nach)); if (b) neu = inBahn(neu, b) ?? neu; }
    // Mitten auf einem Faden (Punkt 3): zwischen Quelle und Ziel — die Regel steht in lib/prozesse/werkstatt-aktionen.ts `zwischenEinfuegen`.
    const kante = ziel.zwischen ? lage?.kanten.find(k => k.id === ziel.zwischen) : undefined;
    const ok = kante
      ? mitFassung(f => zwischenEinfuegen(f, kante, neu, platzFuer(neu, { nach: kante.von })))
      : mitFassung(f => anlegen(f, neu, { nach: ziel.nach ?? null, ...(ziel.vor ? { vor: ziel.vor } : {}), ...(ziel.phaseId ? { phaseId: ziel.phaseId } : {}), ...(ziel.ausgang ? { ausgang: ziel.ausgang } : {}), ...platzFuer(neu, ziel) }));
    if (ok) { setAuswahl([neu.id]); setKanteWahl(null); setRahmenWahl(null); zeigeNeu.current = neu.id; }
    setFormauswahl(null);
    flaeche.current?.fokus();
  };
  /** Alt+Pfeil: derselbe Baustein wie der Knoten in diese Richtung (Auslöser, Freigabe und Ende hängen eine Aufgabe an). */
  const altAnlegen = (k: K, r: 'rechts' | 'links' | 'unten' | 'oben') => {
    if (!lage) return;
    const lk = lage.knoten.get(k.id);
    const i = lage.bahnen.findIndex(b => b.schluessel === lk?.bahn);
    const was = altPfeil(k, r, { darunter: lage.bahnen[i + 1]?.schluessel, darueber: i > 0 ? lage.bahnen[i - 1]?.schluessel : undefined });
    if (!was) { ansagen('In diese Richtung lässt sich hier nichts anlegen.'); return; }
    const gleicheForm = k.form && !['ausloeser', 'freigabe', 'ende'].includes(k.form) ? katalogEintrag(k.katalog?.id) : undefined;
    const e = gleicheForm ?? katalogEintrag(k.form === 'entscheidung' ? 'entscheidung.mensch' : 'aufgabe.anlegen')!;
    ausKatalog(e, { ...(was.vor ? { vor: k.id } : { nach: k.id, ausgang: was.ausgang }), ...(was.bahn ? { bahn: was.bahn } : {}) });
  };

  // ── Ziehen auf der Fläche: Lage festhalten (nichts springt), Phase und Bahn nach dem Ort, Hilfslinien hat die Fläche schon eingerastet ──
  const ziehen = (ids: string[], dx: number, dy: number) => {
    if (!lage || nurLesen) return;
    mitFassung(f0 => {
      let f: Fassung = { ...f0, knoten: lagenFesthalten(f0, lage).knoten };
      const knotenIds = ids.filter(id => lage.knoten.has(id) && !lage.knoten.get(id)!.zu);
      const lagen: { id: string; pos: KnotenLage }[] = [];
      for (const id of knotenIds) {
        const lk = lage.knoten.get(id)!;
        const ax = lk.x + dx, ay = lk.y + dy;
        const ort = ortBei(lage, ax + lk.koerper.x + lk.koerper.b / 2, ay + lk.koerper.y + lk.koerper.h / 2);
        let rx = lage.rahmen.find(r => r.id === lk.phaseId)?.x ?? 0;
        const by = lage.bahnen.find(b => b.schluessel === lk.bahn)?.y ?? 0;
        if (ort && knotenIds.length === 1 && ort.phaseId !== lk.phaseId) {
          const r = inPhase(f, id, ort.phaseId);
          if (r.ok) { f = r.fassung; rx = ort.rahmenX; }
        }
        let y = ay - by;
        if (ort && ort.bahn !== lk.bahn) {
          const k = f.knoten.find(x => x.id === id)!;
          const neu = inBahn(k, ort.bahn);
          if (neu) { f = { ...f, knoten: f.knoten.map(x => (x.id === id ? neu : x)) }; y = ay - ort.bahnY; }
          // Diese Bahn passt nicht (Agenten bleiben bei den Agenten, die Kunden-Bahn trägt nur Nachrichten): nur waagerecht verschieben.
          else { y = lk.y - by; ansagen('In diese Bahn passt der Schritt nicht — er bleibt in seiner Bahn.'); }
        }
        lagen.push({ id, pos: { x: Math.max(WS.rahmenRand / 2, Math.round(ax - rx)), y: Math.max(0, Math.round(y)) } });
      }
      const r = lageSetzen(f, lagen);
      if (!r.ok) return r;
      f = r.fassung;
      const zIds = ids.filter(id => (f.zettel ?? []).some(z => z.id === id));
      if (zIds.length) f = { ...f, zettel: (f.zettel ?? []).map(z => (zIds.includes(z.id) ? { ...z, pos: { ...z.pos, x: Math.round(z.pos.x + dx), y: Math.round(z.pos.y + dy) } } : z)) };
      return { ok: true, fassung: f, ansage: ids.length === 1 ? 'Verschoben.' : `${ids.length} verschoben.` };
    }, { auswahl: false });
  };

  // ── Kopieren, Einfügen ──
  // Punkt 13: ⌘C legt die Auswahl auch in den Browser-Speicher (ohne Personen, lib/prozesse/ablage.ts) — so lässt sie sich in einem anderen Prozess einfügen.
  const kopie = () => {
    const f = fassungRef.current;
    if (!f) return;
    const a = kopieren(f, auswahl);
    if (!a) { ansagen('Nichts zum Kopieren gewählt (Auslöser und Schlösser bleiben).'); return; }
    const am = new Date().toISOString();
    ablage.current = { ablage: a, am };
    schreib(lokal(), ABLAGE_MERKER, JSON.stringify(ablageFuerSpeicher(a, { quelle: prozessId, jetzt: am })));
    ansagen(`${a.knoten.length + a.zettel.length} kopiert — mit ihren Verbindungen; auch in einem anderen Prozess einfügbar.`);
  };
  const einf = () => {
    const f = fassungRef.current;
    // Aus einem anderen Prozess (jünger als die eigene Ablage): die Fassung ohne Personen aus dem Browser-Speicher.
    const fremd = ablageAus(lies(lokal(), ABLAGE_MERKER), new Date().toISOString());
    const ausFremd = !!fremd && fremd.quelle !== prozessId && (!ablage.current || fremd.am > ablage.current.am);
    const a = ausFremd ? fremd!.ablage : ablage.current?.ablage;
    if (!a || !f || !d) { ansagen('Die Ablage ist leer.'); return; }
    const ziel = auswahl.find(id => phaseVon(f, id));
    const phaseId = (ziel && phaseVon(f, ziel)) ?? phasen(d).at(-1)?.id;
    if (!phaseId) return;
    if (mitFassung(x => einfuegen(x, a, { phaseId, nach: ziel ?? null, kennung: () => neueKennung('fk') })) && ausFremd) {
      setMeldung({ text: `Aus einem anderen Prozess eingefügt${fremd!.hinweise.length ? ` — ${fremd!.hinweise.join(' ')}` : ''} Verweise auf Schritte, die es hier nicht gibt, meldet die Prüfung.`, art: 'info' });
    }
  };

  // ── Tastatur (lib/prozesse/werkstatt-tastatur.ts) ──
  const taste = (a: TastenAktion): boolean => {
    if (!d || !lage) return false;
    const eine = auswahl.length === 1 ? d.knoten.find(k => k.id === auswahl[0]) : undefined;
    switch (a.art) {
      case 'abbrechen':
        // Feinschliff 24.10.: Esc schließt das große Fenster auch, wenn der Fokus auf der Fläche liegt (Enter auf dem Knoten öffnet es von dort).
        if (gross) { setGross(null); setSchrittTest(null); flaeche.current?.fokus(); return true; }
        if (umbenennen) { setUmbenennen(null); return true; }
        if (formauswahl) { setFormauswahl(null); return true; }
        if (hilfe) { setHilfe(false); return true; }
        if (auswahl.length || kanteWahl || rahmenWahl) { setAuswahl([]); setKanteWahl(null); setRahmenWahl(null); setAndockWahl(null); return true; }
        return false;
      case 'hilfe': setHilfe(h => !h); return true;
      case 'zoom': if (a.wie === 'alles') allesZeigen(); else flaeche.current?.zoomen(a.wie === 'groesser' ? 1.25 : 0.8); return true;
      case 'karte': karteUmschalten(); return true;
      case 'waehlen': {
        const boxen = [...lage.knoten.values()].filter(k => !k.zu).map(k => ({ id: k.id, x: k.x, y: k.y, b: k.b, h: k.h }));
        if (!eine) { const erst = alleSchritte(d)[0]?.schritt.id; if (erst) { setAuswahl([erst]); flaeche.current?.zeige(erst); } return true; }
        const lk = lage.knoten.get(eine.id);
        const n = lk ? nachbar(lk, boxen.filter(b => b.id !== eine.id), a.richtung) : null;
        if (n) { setAuswahl([n]); flaeche.current?.zeige(n); ansagen(`„${d.knoten.find(k => k.id === n)?.titel ?? ''}“ gewählt.`); }
        return true;
      }
      case 'kopieren': kopie(); return true;
      default: break;
    }
    if (nurLesen) return false;
    switch (a.art) {
      case 'rueckgaengig': zurueck(); return true;
      case 'wiederholen': vor(); return true;
      case 'alles-waehlen': setAuswahl([...alleSchritte(d).map(x => x.schritt.id), ...(d.zettel ?? []).map(z => z.id)]); return true;
      case 'einfuegen': einf(); return true;
      case 'duplizieren': kopie(); einf(); return true;
      // Ordnen legt auch Zettel frei, die einen Phasen-Kopf, eine Bahn oder einen Knoten verdecken (Befund 3) — über die Rahmen.
      case 'ordnen': mitFassung(f => ({ ok: true, fassung: zettelFreiLegen(ordnen(f), { team, zu }), ansage: 'Geordnet — eine Leserichtung, Zettel liegen frei. Rückgängig holt die alte Lage.' })); return true;
      case 'loeschen': loeschenAuswahl(); return true;
      case 'benennen': if (eine && !eine.schloss) { setUmbenennen(eine.id); return true; } return false;
      case 'oeffnen': if (eine) { setGross(eine.id); return true; } return false;
      case 'formauswahl': {
        if (!eine) return false;
        const lk = lage.knoten.get(eine.id);
        const port = lk?.anschluesse.find(x => x.art === 'weiter' || x.art === 'ja');
        if (!lk || !port) return false;
        anhaengen({ nach: eine.id, ausgang: port.art === 'ein' ? 'weiter' : port.art }, flaeche.current?.bildschirm(lk.x + port.x + 30, lk.y + port.y) ?? [80, 80]);
        return true;
      }
      case 'anlegen': if (eine) { altAnlegen(eine, a.richtung); return true; } return false;
      case 'schieben': if (auswahl.length) { ziehen(auswahl, a.dx, a.dy); return true; } return false;
      default: return false;
    }
  };
  const loeschenAuswahl = () => {
    if (kanteWahl && lage) { const k = lage.kanten.find(x => x.id === kanteWahl); if (k) { if (mitFassung(f => loesen(f, k.von, k.ausgang))) setKanteWahl(null); } return; }
    const f = fassungRef.current;
    if (!f) return;
    const zIds = auswahl.filter(id => (f.zettel ?? []).some(z => z.id === id));
    const kIds = auswahl.filter(id => !zIds.includes(id));
    if (kIds.length) mitFassung(x => loeschen(x, kIds));
    if (zIds.length) mitFassung(x => zettelWeg(x, zIds));
    setAuswahl([]);
  };

  // ── Probelauf (Vertrag mit dem Lauf-Motor, Etappe C1) ──
  const probelauf = async (o: { fall?: FallWert; annahmen?: Readonly<Record<string, string>> } = {}) => {
    setProbeHinweis(null);
    setProbeOffen(false);
    if (!versionAnsicht) await sichern();
    const pf = o.fall ?? probeFall;
    const fall = pf === 'beispiel' ? 'beispiel' as const : { art: pf.art, id: pf.id };
    // Punkt 9: die angenommenen Wege der Testdaten gehen mit (der Server nähme sie sonst selbst aus dem Bestand).
    const annahmen = o.annahmen ?? eintrag?.testdaten?.annahmen;
    const r = await fetch(`${PROBELAUF_PFAD}?space=business`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(probelaufKoerper(prozessId, versionAnsicht ? 'version' : 'entwurf', fall, annahmen ? { annahmen } : {})) }).catch(() => null);
    const a = probelaufAus(r?.status ?? 0, r ? await r.json().catch(() => null) : null);
    if (a.art === 'fehlt') { setProbe(null); setProbeHinweis(PROBE_FEHLT); return; }
    if (a.art === 'fehler') { setProbe(null); setProbeHinweis(a.text); return; }
    setProbe(a.ergebnis);
    // Feinschliff 24.10. (Bau-Test: Ergebnis unter Panel und Hinweis-Karte): das Seitenfeld klappt ein, dann „Alles zeigen“ — im freien Feld unter der Karte.
    setPanelZu(n => n + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => allesZeigenRef.current()));
    ansagen(`Probelauf${pf === 'beispiel' ? ' mit dem Beispiel' : ` mit „${pf.name}“`}: ${a.ergebnis.schritte.length} Schritte, geschätzt ${centText(a.ergebnis.kostenSchaetzungCent)}.`);
  };

  // ── Werkstatt bau-fertig: Testdaten, „Weg annehmen“, „Schritt testen“, Lauf → Testdaten (Punkte 9–11) ──
  /** Testdaten speichern (EIN Weg: POST …/werkstatt `testdaten`, Stand/409) — der Server prüft, dass alles erfunden ist. Liefert einen Fehlersatz bzw. null. */
  const testdatenSpeichern = async (t: ProzessTestdaten | null): Promise<string | null> => {
    if (!(await sichern())) return 'Erst muss der Entwurf gespeichert sein.';
    const r = await werkstattSenden(() => ({ aktion: 'testdaten', id: prozessId, stand: stand.current, testdaten: t }));
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) { stand.current = j.stand; setEintrag(j.eintrag); ansagen('Testdaten gespeichert.'); return null; }
    if (r.status === 409 && j?.eintrag && j.stand) { setKonflikt({ eintrag: j.eintrag, stand: j.stand }); return 'Inzwischen hat jemand anders geändert — erst die Fassung klären.'; }
    return String(j?.fehler ?? 'Die Testdaten ließen sich nicht speichern.');
  };
  const annahmeSetzen = async (knotenId: string, ausgang: string | null) => {
    const td = eintrag?.testdaten ?? null;
    const annahmen = { ...(td?.annahmen ?? {}) } as Record<string, string>;
    if (ausgang) annahmen[knotenId] = ausgang; else delete annahmen[knotenId];
    const { annahmen: _a, am: _am, von: _v, ...rest } = td ?? {};
    const neu = { ...rest, ...(Object.keys(annahmen).length ? { annahmen } : {}) } as ProzessTestdaten;
    const f = await testdatenSpeichern(Object.keys(neu).length ? neu : null);
    if (f) setMeldung({ text: f, art: 'kritisch' });
    else if (probe) void probelauf({ annahmen });
  };
  /** „Nur diesen Schritt testen“ / „Bis hier testen“ — derselbe Motor im Schatten mit Ausgabe (Tabelle, JSON nur Kennungen). Schreibt nichts, sendet nie. */
  const schrittTesten = async (knotenId: string, art: 'nur' | 'bis') => {
    setSchrittTestLaeuft(true);
    if (!versionAnsicht) await sichern();
    const fall = probeFall === 'beispiel' ? 'beispiel' as const : { art: probeFall.art, id: probeFall.id };
    const annahmen = eintrag?.testdaten?.annahmen;
    const r = await fetch(`${PROBELAUF_PFAD}?space=business`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(probelaufKoerper(prozessId, versionAnsicht ? 'version' : 'entwurf', fall, { ...(annahmen ? { annahmen } : {}), [art]: knotenId, ausgabe: true })) }).catch(() => null);
    const a = probelaufAus(r?.status ?? 0, r ? await r.json().catch(() => null) : null);
    setSchrittTestLaeuft(false);
    if (a.art !== 'ergebnis') { setSchrittTest(null); setMeldung({ text: a.art === 'fehlt' ? PROBE_FEHLT : a.text, art: 'kritisch' }); return; }
    setSchrittTest({ knoten: knotenId, ergebnis: { ...a.ergebnis, art } });
    // „Bis hier“ färbt auch die Fläche (wie der Probelauf).
    if (art === 'bis') setProbe(a.ergebnis);
    ansagen(`${art === 'nur' ? 'Schritt getestet' : 'Bis hier getestet'}: ${a.ergebnis.schritte.length} ${a.ergebnis.schritte.length === 1 ? 'Schritt' : 'Schritte'} — nichts geschrieben, nichts gesendet.`);
  };
  /** „Modell wirklich fragen“ (22.10.): Schätzung bzw. der echte Aufruf eines Agenten-Schritts — nur auf eigenen Klick, Ergebnis nur in der Ansicht. */
  const modellRufen = async (knotenId: string, art: 'schaetzen' | 'fragen'): Promise<ModellAntwort> => {
    if (art === 'fragen' && !versionAnsicht && !(await sichern())) return { ok: false, fehler: 'Erst muss der Entwurf gespeichert sein.' };
    const fall = probeFall === 'beispiel' ? 'beispiel' as const : { art: probeFall.art, id: probeFall.id };
    const r = await fetch(`${PROBELAUF_PFAD}?space=business`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...probelaufKoerper(prozessId, versionAnsicht ? 'version' : 'entwurf', fall, { nur: knotenId }), modell: art }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) as (Record<string, unknown> & { ok?: boolean }) | null : null;
    if (r?.status === 200 && j?.ok) { if (art === 'fragen') ansagen('Modell gefragt — nur ein Vorschlag im Fenster, nichts übernommen.'); return j as unknown as ModellAntwort; }
    return { ok: false, fehler: String(j?.fehler ?? j?.error ?? 'Das Modell ließ sich nicht fragen.'), ...(typeof j?.kostenCent === 'number' ? { kostenCent: j.kostenCent } : {}) };
  };
  /** Punkt 11 („Copy to editor“): Weg des Laufs → „Weg annehmen“ (gespeichert, nur Kennungen), Fall nur für diese Sitzung → Bauen, Probelauf. */
  const alsTestdaten = async (a: { fall: LaufKurz['fall']; schritte: readonly LaufSchritt[]; start: string }) => {
    const annahmen = annahmenAusLauf(a.schritte, d?.knoten ?? []);
    const td = eintrag?.testdaten ?? null;
    const { annahmen: _a, am: _am, von: _v, ...rest } = td ?? {};
    const f = await testdatenSpeichern({ ...rest, ...(Object.keys(annahmen).length ? { annahmen } : {}) });
    if (f) { setMeldung({ text: f, art: 'kritisch' }); return; }
    const fall: FallWert = a.fall.id && a.fall.art !== 'keiner' ? { art: a.fall.art, id: a.fall.id, name: `Fall des Laufs vom ${tagZeit(a.start)}` } : 'beispiel';
    setProbeFall(fall);
    reiterWaehlen('bauen');
    setMeldung({ text: `Fall und Weg des Laufs sind in „Bauen“: ${Object.keys(annahmen).length} angenommene ${Object.keys(annahmen).length === 1 ? 'Weg' : 'Wege'}${fall === 'beispiel' ? ' (ohne Fall: mit dem Beispiel)' : ' — der Fall gilt nur in dieser Sitzung'}.`, art: 'gut' });
    void probelauf({ fall, annahmen });
  };

  // ── „+ Teilprozess hier anlegen“ (Feinschliff 24.10., Bau-Test A2): neuer Prozess mit dem passenden Fall (Schleife je Deal → am Deal), danach hier gewählt; ein Entwurf —
  // der Probelauf nimmt ihn schon, scharf erst nach dem Veröffentlichen. Öffnen in einem neuen Tab (diese Werkstatt bleibt, wie sie ist). ──
  const teilprozessNeu = async (knotenId: string) => {
    if (nurLesen || !d) return;
    const k = fassungRef.current?.knoten.find(x => x.id === knotenId);
    const e = k ? katalogEintrag(k.katalog?.id) : null;
    if (!k || !e) return;
    const fallArt = teilprozessFall(d, k);
    const titel = teilprozessTitel(k);
    const r = await werkstattSenden(() => ({ aktion: 'anlegen', titel, bereich: d.bereich ?? 'fulfillment', fallArt, ...(d.eigner ? { eigner: d.eigner } : {}), anfrageId: neueKennung('pza') }));
    const j = r.j;
    const neuId = r.status === 200 && j?.ok ? j.eintrag?.id : undefined;
    if (!neuId) { setMeldung({ text: String(j?.fehler ?? 'Der Teilprozess ließ sich nicht anlegen.'), art: 'kritisch' }); return; }
    const jetzt = fassungRef.current?.knoten.find(x => x.id === knotenId);
    if (jetzt) mitFassung(f => ersetzen(f, maskeAnwenden(jetzt, e, { ...maskeWerte(jetzt, e), prozessId: neuId }, { modelle })), { auswahl: false });
    await kat.laden();
    onLandkarte?.();
    const fall = FALL_ARTEN.find(x => x.id === fallArt)?.titel ?? fallArt;
    setMeldung({ text: `„${titel}“ ist angelegt (Fall: ${fall}) und hier gewählt — noch ein Entwurf: der Probelauf nimmt ihn schon, scharf läuft er erst nach dem Veröffentlichen.`, art: 'info',
      link: { href: WEG.prozesse({ p: neuId, ansicht: 'werkstatt' }), text: 'In neuem Tab öffnen' } });
    ansagen(`Teilprozess „${titel}“ angelegt und gewählt.`);
  };

  // ── Zustand, Status, Neu laden (22.10.) ──
  /** Eintrag und Laufzeit-Stand neu laden (nach Scharfschalten, Einstellungen, Status) — die Fassung auf der Fläche bleibt. */
  const neuLaden = async () => {
    const r = await prozessLaden();
    if (r) { stand.current = r.stand; setEintrag(r.eintrag); setBefundeServer(r.befunde); setGeaendertSeitVersion(r.entwurfGeaendert); setWebhook((r.webhook as WebhookKurz | null) ?? null); onLandkarte?.(); }
    await laeufe.laden();
  };
  const statusSetzen = async (status: ProzessStatus): Promise<string | null> => {
    if (!(await sichern())) return 'Erst muss der Entwurf gespeichert sein.';
    const r = await werkstattSenden(() => ({ aktion: 'status', id: prozessId, stand: stand.current, status }));
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) { stand.current = j.stand; setEintrag(j.eintrag); setBefundeServer(j.befunde ?? []); await laeufe.laden(); onLandkarte?.(); return null; }
    if (j?.befunde) setBefundeServer(j.befunde);
    if (r.status === 409 && j?.eintrag && j.stand) { stand.current = j.stand; setEintrag(j.eintrag); }
    return String(j?.fehler ?? 'Der Status ließ sich nicht setzen.');
  };
  const testsAlle = async () => {
    const r = await testsPruefen(prozessId, laeufe.daten?.tests ?? []);
    if ('ergebnisse' in r) setTestErg(new Map(r.ergebnisse.map(e => [e.id, e])));
    else setMeldung({ text: r.fehler, art: 'kritisch' });
  };

  // ── Versionen ──
  const veroeffentlichen = async (name: string, notiz: string): Promise<string | null> => {
    if (!(await sichern())) return 'Erst muss der Entwurf gespeichert sein.';
    const r = await werkstattSenden(() => ({ aktion: 'veroeffentlichen', id: prozessId, stand: stand.current, name, notiz }));
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) { stand.current = j.stand; setEintrag(j.eintrag); setBefundeServer(j.befunde ?? []); setGeaendertSeitVersion(false); setFassungRoh(fassungVon(j.eintrag.entwurf)); setVersionenOffen(false); setMeldung({ text: `${j.version?.name ?? 'Version'} ist veröffentlicht.`, art: 'gut' }); onLandkarte?.(); return null; }
    if (j?.befunde) setBefundeServer(j.befunde);
    return String(j?.fehler ?? 'Nicht veröffentlicht.');
  };
  const uebernehmen = async (nr: number): Promise<string | null> => {
    await sichern();
    const vorher = fassungRef.current;
    const r = await werkstattSenden(() => ({ aktion: 'version-uebernehmen', id: prozessId, stand: stand.current, nr }));
    const j = r.j;
    if (r.status === 200 && j?.ok && j.eintrag && j.stand) {
      if (vorher) setGeschichte(g => merke(g, vorher));
      stand.current = j.stand; setEintrag(j.eintrag); setBefundeServer(j.befunde ?? []); setFassungRoh(fassungVon(j.eintrag.entwurf)); gesichert.current = aenderung.current;
      setVersionAnsicht(null); setVersionenOffen(false); setMeldung({ text: `Version ${nr} ist jetzt der Entwurf.`, art: 'gut' });
      return null;
    }
    return String(j?.fehler ?? 'Nicht übernommen.');
  };
  const ansehen = async (nr: number) => { const r = await versionHolen(prozessId, nr); if (r.daten) { setVersionAnsicht(r.daten.version); setVersionenOffen(false); setAuswahl([]); } else setMeldung({ text: r.fehler ?? 'Die Version ließ sich nicht laden.', art: 'kritisch' }); };
  const vergleichen = async (nr: number) => { await sichern(); const r = await vergleichHolen(prozessId, nr, 'entwurf'); return r.daten?.vergleich ?? null; };

  // ── Zuklappen (Merker je Prozess) ──
  const zuklappen = (phaseId: string) => {
    // Eine Kachel der Übersicht (Befund 6): aufklappen und die Phase einpassen — der Merker der Phasen bleibt unberührt.
    if (uebersicht?.has(phaseId)) {
      setUebersicht(u => { if (!u) return u; const n = new Set(u); n.delete(phaseId); return n.size ? n : null; });
      einpassen.current = { phase: phaseId };
      return;
    }
    setZu(s => { const n = new Set(s); if (n.has(phaseId)) n.delete(phaseId); else n.add(phaseId); schreib(lokal(), ZU_MERKER(prozessId), [...n].join(',') || null); return n; });
    setAuswahl(a => a.filter(id => !lage?.knoten.get(id) || lage.knoten.get(id)!.phaseId !== phaseId));
  };
  const phaseAktion = (aktion: 'umbenennen' | 'teilen' | 'zuklappen' | 'neu' | 'loeschen', id: string, wert?: string) => {
    if (aktion === 'zuklappen') { zuklappen(id); return; }
    if (aktion === 'umbenennen' && wert) mitFassung(f => umbenennen_(f, id, wert));
    if (aktion === 'teilen') mitFassung(f => teilprozessBilden(f, id, { id: neueKennung('fk') }));
    if (aktion === 'neu') mitFassung(f => phaseNeu(f, { id: neueKennung('fk'), titel: 'Neue Phase', nach: id }));
    if (aktion === 'loeschen' && mitFassung(f => phaseLoeschen(f, id))) setRahmenWahl(null);
  };
  const karteUmschalten = () => { const n = !karte; setKarte(n); schreib(lokal(), KARTE_MERKER, n ? 'an' : null); ansagen(n ? 'Karte an.' : 'Karte aus.'); };
  const zettelHin = () => {
    const m = flaeche.current?.mitte() ?? [200, 200];
    mitFassung(f => zettelNeu(f, { id: neueKennung('fk'), text: '', pos: { x: Math.round(m[0] - WS.zettel.b / 2), y: Math.round(m[1] - WS.zettel.h / 2) }, farbe: 'gelb' }));
  };

  // ── Zeichnung ──
  if (!daten || !eintrag || !fassung || !d || !lage) {
    return <div className="pw-werkstatt">{ladeFehler ? <Hinweis art="kritisch">{ladeFehler}</Hinweis> : <p style={{ color: C.inkDim, fontSize: TYP.bedien }}>Die Werkstatt lädt …</p>}</div>;
  }
  const konten = new Map((auswahlListen['konto-person'] ?? []).map(t => [t.id, t.label]));
  const jungeVersion = eintrag.versionen.at(-1);
  // Ob die jüngste Version einen Webhook-Auslöser hat, weiß die Ansicht nur, wenn der Entwurf seitdem gleich ist — sonst sagt es der Server beim Schalten.
  const versionHatWebhook = !geaendertSeitVersion ? !!webhookAusloeserVon(eintrag.entwurf) : true;
  const webhookZusatz = (k: K) => (k.form === 'ausloeser' && (k.ausloeser?.art === 'webhook' || k.katalog?.id === 'ausloeser.webhook')
    ? <WebhookKarte prozessId={prozessId} webhook={webhook} eingaenge={laeufe.daten?.webhookEingaenge ?? []} felder={k.ausloeser?.art === 'webhook' ? k.ausloeser.felder : []}
        darf={!!rechte?.webhook && !nurAnsehen} versionHatWebhook={!!jungeVersion && versionHatWebhook} onWebhook={w => { setWebhook(w); void laeufe.laden(); }} />
    // Datums-Start (22.10.): worauf der Auslöser schaut und die nächsten Starts (des gespeicherten Entwurfs).
    : k.form === 'ausloeser' && k.ausloeser?.art === 'datum'
      ? <DatumAusloeserKarte prozessId={prozessId} knotenId={k.id} ausloeser={k.ausloeser} gespeichert={speicher.art === 'gespeichert'} />
      : null);
  const ein = auswahl.length === 1 ? auswahl[0] : null;
  const panelKnoten = ein ? d.knoten.find(k => k.id === ein) ?? null : null;
  const panelZettel = ein ? (d.zettel ?? []).find(z => z.id === ein) ?? null : null;
  const panelPhase = rahmenWahl && !panelKnoten ? phasen(d).find(p => p.id === rahmenWahl) ?? null : null;
  const panelKante: KanteLage | null = kanteWahl ? lage.kanten.find(k => k.id === kanteWahl) ?? null : null;
  const sperrt = sperrtVeroeffentlichen(befunde);
  // „Entwurf gespeichert“ erst nach der Antwort des Servers und ohne Getipptes in einem Feld (lib/prozesse/eingabe-puffer.ts `speicherAnzeige`).
  const spArt = speicherAnzeige(speicher.art, tippt);
  const SP = { gespeichert: Check, ausstehend: Loader2, speichert: Loader2, fehler: CloudOff, konflikt: CloudOff, offline: CloudOff, tippt: Loader2 }[spArt];
  const spText = { gespeichert: 'Entwurf gespeichert', ausstehend: 'wird gespeichert …', speichert: 'speichert …', fehler: 'nicht gespeichert', konflikt: 'Konflikt — deine Fassung bleibt', offline: 'offline — bleibt hier', tippt: 'Änderung wird übernommen …' }[spArt];
  const spFarbe = spArt === 'gespeichert' ? C.inkLeise : spArt === 'fehler' || spArt === 'konflikt' ? LEUCHT.kritisch : spArt === 'offline' ? LEUCHT.achtung : C.inkDim;
  const v = eintrag.versionen.at(-1);
  // Die Teile der Kopfzeile — außerhalb in der Werkzeugzeile, im Werkzeugmodus an den Orten des Rahmens (dieselben Griffe, nur verteilt).
  const kopfZustand = (
    <>
      {v && <Chip farbe={C.inkDim}>{`Version ${v.nr}`}</Chip>}
      <WerkstattSteuerung prozessId={prozessId} def={d} status={eintrag.status} hatVersion={!!v} laufStand={laeufe.daten?.stand ?? null}
        rechte={rechte} nurAnsehen={nurAnsehen} stand={() => stand.current} onStatus={statusSetzen} onGeaendert={neuLaden} onMeldung={(text, art) => setMeldung({ text, art })} vorher={sichern} />
      {reiter === 'bauen' && !nurLesen && <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: spFarbe }}><SP size={14} aria-hidden />{spText}</span>}
      {reiter === 'bauen' && nurLesen && !versionAnsicht && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{nurAnsehen ? (mobilDarf ? 'Am Handy: Texte und Fristen ändern' : 'Am Handy nur ansehen') : !rechte?.entwurf ? 'Nur lesen' : eintrag.status === 'archiviert' ? 'Archiviert — nur lesen' : 'Nur lesen'}</span>}
    </>
  );
  const karteKnopf = <SymbolKnopf ariaLabel="Karte (Minimap) an/aus (M)" gedrueckt={karte} onClick={karteUmschalten}><KarteSymbol size={16} /></SymbolKnopf>;
  const rasterKnopf = <SymbolKnopf ariaLabel="Raster an/aus" gedrueckt={raster} onClick={() => { const n = !raster; setRaster(n); schreib(lokal(), RASTER_MERKER, n ? null : 'aus'); }}><Grid3x3 size={16} /></SymbolKnopf>;
  const headKnopf = !nurLesen && <Knopf leise onClick={() => setHeadOffen(true)} titel="Head fragen — Bausteine oder einen ganzen Entwurf vorschlagen lassen (übernommen erst mit deinem Klick)"><span className="pz-knopf-inhalt"><Sparkles size={14} aria-hidden />Head fragen</span></Knopf>;
  const probeKnopf = <Knopf leise onClick={() => setProbeOffen(o => !o)} titel="Probelauf — zeigt Schritt für Schritt, was passieren würde (schreibt nichts); mit dem Beispiel oder einem echten Fall"><span className="pz-knopf-inhalt"><Play size={14} aria-hidden />Probelauf</span></Knopf>;
  const versionenKnopf = (!nurAnsehen || mobilDarf) && !versionAnsicht && <Knopf onClick={() => { setVersionenOffen(true); if (laeufe.daten?.tests.length) void testsAlle(); }} titel="Veröffentlichen und Versionen"><span className="pz-knopf-inhalt"><Upload size={14} aria-hidden />{rechte?.veroeffentlichen ? 'Veröffentlichen' : 'Versionen'}</span></Knopf>;
  // ── Werkstatt bau-fertig: Titel der Knoten-Auswahl, Fäden mit „+“, Doppelklick und Umbenennen auf der Fläche ──
  const auswahlTitel = (z: AnhangZiel): string => {
    if (z.zwischen) { const k = lage.kanten.find(x => x.id === z.zwischen); return `Einfügen zwischen „${d.knoten.find(x => x.id === k?.von)?.titel ?? ''}“ und „${d.knoten.find(x => x.id === k?.nach)?.titel ?? ''}“`; }
    return z.nach ? `Anhängen an „${d.knoten.find(k => k.id === z.nach)?.titel ?? ''}“` : 'Baustein anlegen';
  };
  const doppelklick = (id: string) => {
    const k = d.knoten.find(x => x.id === id);
    if (!k) return;
    setAuswahl([id]); setKanteWahl(null); setRahmenWahl(null);
    // Erster Doppelklick: den Namen direkt ändern; zweiter (bzw. ein Schloss, das keinen eigenen Namen trägt): die Einstellungen.
    if (nurLesen || k.schloss || umbenennen === id) { setUmbenennen(null); setGross(id); return; }
    setUmbenennen(id);
  };
  const umbenannt = (id: string, t: string | null) => {
    setUmbenennen(u => (u === id ? null : u));
    const k = d.knoten.find(x => x.id === id);
    if (t && k && t !== k.titel) mitFassung(f => umbenennen_(f, id, t), { auswahl: false });
    flaeche.current?.fokus();
  };
  // Überführung (22.10., Paket Ü): ersetzt dieser Prozess einen System-Ablauf — Band mit Vergleich, „Umschalten“ und „Zurück in den Schatten“.
  const ueBand = daten.ueberfuehrung
    ? <UeberfuehrungBand prozessId={prozessId} a={daten.ueberfuehrung} darf={!!rechte?.status && !nurAnsehen} stand={() => stand.current} onGeaendert={neuLaden} />
    : null;
  const panelFuer = (o: { knoten: K | null; imFenster?: boolean }) => (
    <>
          <WerkstattPanel d={d} auswahl={auswahlListen} modelle={modelle} befunde={befunde} raete={raete} probe={probeSaetze} kanten={lage.kanten} nurLesen={nurLesen}
            knoten={o.knoten} phase={o.imFenster ? null : panelPhase} kante={o.imFenster ? null : panelKante} zettel={o.imFenster ? null : panelZettel} andock={andockWahl?.id === o.knoten?.id ? andockWahl?.art ?? null : null} titelFokus={titelFokus}
            annahmen={eintrag.testdaten?.annahmen} onAnnahme={nurLesen ? undefined : (id, a) => void annahmeSetzen(id, a)}
            onDuplizieren={() => { kopie(); einf(); }} onGross={id => setGross(id)} feldFokus={feldFokus} imFenster={o.imFenster}
            onTeilprozessNeu={nurLesen ? undefined : id => void teilprozessNeu(id)}
            onKnoten={k => mitFassung(f => ersetzen(f, k), { auswahl: false })}
            onSteckbrief={steckbrief}
            onZweig={(von, ausgang, nach) => mitFassung(f => (nach ? verbinden(f, von, ausgang, nach) : loesen(f, von, ausgang)), { auswahl: false })}
            onPfeilText={(von, art, t) => mitFassung(f => pfeilText(f, von, art, t), { auswahl: false })}
            onLoeschen={ids => { mitFassung(f => loeschen(f, ids)); setAuswahl([]); }}
            onKopieren={kopie}
            onPhase={phaseAktion}
            onZettel={(id, teil) => { if (teil) mitFassung(f => zettelAendern(f, id, teil), { auswahl: false }); else { mitFassung(f => zettelWeg(f, [id])); setAuswahl([]); } }}
            agentName={agentName} knotenZusatz={webhookZusatz} produkte={daten?.produkte}
            steckbriefZusatz={<>
              {/* Überführung (Paket Ü): im Werkzeugmodus steht das Band hier im Feld (außerhalb unter der Kopfzeile). */}
              {imModus && ueBand}
              {!nurAnsehen && rechte?.entwurf && !versionAnsicht
                ? <ProzessKopieren prozessId={prozessId} titel={d.titel} vorher={sichern} onKopiert={id => { onLandkarte?.(); router.push(WEG.prozesse({ p: id, ansicht: 'werkstatt' }), { scroll: false }); }} />
                : null}
            </>} />
          {!o.imFenster && !nurLesen && auswahl.length > 1 && <p style={{ ...MIKRO, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien }}>{`${auswahl.length} gewählt — ziehen verschiebt alle, Entf löscht, ⌘C kopiert mit Verbindungen.`}</p>}
    </>
  );
  const panelInhalt = panelFuer({ knoten: panelKnoten });
  const grossKnoten = gross ? d.knoten.find(k => k.id === gross) ?? null : null;
  const modellFuer = grossKnoten?.form === 'agent' && !nurAnsehen && rechte?.entwurf ? (art: 'schaetzen' | 'fragen') => modellRufen(grossKnoten.id, art) : undefined;
  // Werkstatt bau-fertig (Punkt 1): Hinweise und Meldungen schweben über der Fläche (Bauen) statt sie nach unten zu schieben — außerhalb wie im Werkzeugmodus.
  const hinweisTeile: ReactNode[] = [
    konflikt && (
      <Hinweis art="achtung" titel="Inzwischen hat jemand anders diesen Entwurf geändert" aktion={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}><Knopf onClick={meineSpeichern}>Meine Fassung speichern</Knopf><Knopf leise onClick={andereUebernehmen}>Andere Fassung übernehmen</Knopf></span>}>
        Deine Fassung ist nicht verloren — sie steht hier auf der Fläche. Speichern überschreibt die andere; Übernehmen holt die andere (Rückgängig holt deine zurück).
      </Hinweis>
    ),
    wiederher && (
      <Hinweis art="info" titel="Ungespeicherte Fassung aus dieser Sitzung" aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={() => { anwenden({ ok: true, fassung: wiederher, ansage: 'Wiederhergestellt.' }); setWiederher(null); }}>Wiederherstellen</Knopf><Knopf leise onClick={() => { setWiederher(null); schreib(sitzung(), ENTWURF_MERKER(prozessId), null); }}>Verwerfen</Knopf></span>}>
        Beim letzten Mal wurde nicht alles gespeichert — inzwischen gibt es eine neuere Fassung auf dem Server.
      </Hinweis>
    ),
    versionAnsicht && (
      <Hinweis art="info" titel={`Version ${versionAnsicht.nr} · ${versionAnsicht.name} — nur lesen`}
        aktion={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
          {!nurAnsehen && rechte?.entwurf && eintrag.status !== 'archiviert' && <Knopf leise onClick={() => setZurueckholen(true)} titel="Diese Version als neuen Entwurf zurückholen — die laufende Version bleibt, bis ihr veröffentlicht"><span className="pz-knopf-inhalt"><Undo2 size={14} aria-hidden />Als neuen Entwurf zurückholen</span></Knopf>}
          <Knopf leise onClick={() => { setVersionAnsicht(null); setZurueckholen(false); }}><span className="pz-knopf-inhalt"><X size={14} aria-hidden />Zurück zum Entwurf</span></Knopf>
        </span>}>
        {`${tagZeit(versionAnsicht.am)}${konten.get(versionAnsicht.von) ? ` · ${konten.get(versionAnsicht.von)}` : ''} · ${versionAnsicht.notiz ?? 'So wurde der Prozess veröffentlicht.'}`}
      </Hinweis>
    ),
    versionAnsicht && zurueckholen && (
      <Hinweis art="achtung" titel={`Version ${versionAnsicht.nr} als neuen Entwurf zurückholen?`}
        aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={async () => { const f = await uebernehmen(versionAnsicht.nr); setZurueckholen(false); if (f) setMeldung({ text: f, art: 'kritisch' }); }}>Zurückholen</Knopf><Knopf leise onClick={() => setZurueckholen(false)}>Abbrechen</Knopf></span>}>
        {`Der jetzige Entwurf wird ersetzt (Rückgängig holt ihn zurück). ${v ? `Neue Fälle laufen weiter auf Version ${v.nr}, bis ihr veröffentlicht; laufende Fälle bleiben auf ihrer Version.` : ''}`}
      </Hinweis>
    ),
    (speicher.art === 'fehler' || speicher.art === 'offline') && speicher.text && <Hinweis art={speicher.art === 'fehler' ? 'kritisch' : 'achtung'}>{speicher.text}{speicher.art === 'fehler' ? ' Deine Fassung bleibt hier — nach der nächsten Änderung wird erneut gespeichert.' : ''}</Hinweis>,
    meldung && <Hinweis art={meldung.art} aktion={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {meldung.link && <Link href={meldung.link.href} target="_blank" rel="noopener" style={{ color: C.aktiv, fontSize: TYP.bedien }}>{`${meldung.link.text} ›`}</Link>}
      <SymbolKnopf ariaLabel="Meldung schließen" onClick={() => setMeldung(null)}><X size={14} /></SymbolKnopf></span>}>{meldung.text}</Hinweis>,
    probeHinweis && <Hinweis art="info" aktion={<SymbolKnopf ariaLabel="Schließen" onClick={() => setProbeHinweis(null)}><X size={14} /></SymbolKnopf>}>{probeHinweis}</Hinweis>,
    reiter === 'bauen' && probe && <Hinweis art="info" titel={`Probelauf ${probeFall === 'beispiel' ? 'mit dem Beispiel-Fall' : `mit „${probeFall.name}“`} — nichts wurde geschrieben`} aktion={<Knopf leise onClick={() => setProbe(null)}>Beenden</Knopf>}>{`Grün würde laufen, gelb wartet bzw. braucht Freigabe, grau wird übersprungen, rot ist ein Fehler. Kosten geschätzt: ${centText(probe.kostenSchaetzungCent)}.`}</Hinweis>,
  ].filter(Boolean);
  const hinweisBlock = (schwebend: boolean) => (hinweisTeile.length
    ? <div className={schwebend ? (imModus ? 'wz-hinweise' : 'pw-hinweise-schwebe') : 'pw-hinweise'}>{hinweisTeile.map((x, i) => <div key={i} className={schwebend ? 'pw-hinweis-karte' : undefined}>{x}</div>)}</div>
    : null);
  return (
    <EingabeKontext.Provider value={eingabeRegister}>
    <VorlageKontext.Provider value={vorlageUmfeld}>
    <div className={`pw-werkstatt${imModus ? ' pw-modus' : ''}`} onKeyDown={e => { if (e.key === 'Escape' && (formauswahl || hilfe || probeOffen)) { e.preventDefault(); setFormauswahl(null); setHilfe(false); setProbeOffen(false); } }}>
      {imModus ? (
        <>
          <WerkzeugSlot ort="titel">{kopfZustand}</WerkzeugSlot>
          <WerkzeugSlot ort="links">
            <div className="wz-palette" role="toolbar" aria-label="Werkstatt">
              {!nurLesen && <SymbolKnopf ariaLabel="Rückgängig (⌘Z)" aus={!geschichte.zurueck.length} onClick={zurueck}><Undo2 size={16} /></SymbolKnopf>}
              {!nurLesen && <SymbolKnopf ariaLabel="Wiederholen (⌘⇧Z)" aus={!geschichte.vor.length} onClick={vor}><Redo2 size={16} /></SymbolKnopf>}
              {!nurLesen && <SymbolKnopf ariaLabel="Ordnen (⇧O)" titel="Ordnen — eine Leserichtung; Zettel, die etwas verdecken, wandern über die Rahmen (⇧O, rückgängig machbar)" onClick={() => taste({ art: 'ordnen' })}><LayoutGrid size={16} /></SymbolKnopf>}
              {!nurLesen && <SymbolKnopf ariaLabel="Notiz-Zettel auf die Fläche" onClick={zettelHin}><StickyNote size={16} /></SymbolKnopf>}
              {!nurLesen && <SymbolKnopf ariaLabel="Neue Phase am Ende" onClick={() => phaseAktion('neu', phasen(d).at(-1)?.id ?? '')}><Columns3 size={16} /></SymbolKnopf>}
              {rasterKnopf}
              <SymbolKnopf ariaLabel="Kürzel (?)" gedrueckt={hilfe} onClick={() => setHilfe(h => !h)}><Keyboard size={16} /></SymbolKnopf>
            </div>
          </WerkzeugSlot>
          <WerkzeugSlot ort="unten-rechts">
            <ZoomLeiste massstab={massstab.ref} onKleiner={() => flaeche.current?.zoomen(0.8)} onGroesser={() => flaeche.current?.zoomen(1.25)} onAlles={allesZeigen}>{karteKnopf}</ZoomLeiste>
          </WerkzeugSlot>
          {headKnopf && <WerkzeugSlot ort="unten-links">{headKnopf}</WerkzeugSlot>}
          <WerkzeugSlot ort="aktionen">{probeKnopf}{versionenKnopf}</WerkzeugSlot>
        </>
      ) : (
      <div className="pw-kopf">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {WERKSTATT_REITER.length > 1 && <div className="ui-reiter-zeile"><Reiter liste={WERKSTATT_REITER.map(r => ({ id: r.id, label: r.id === 'laeufe' && laeufe.daten?.laeufe.length ? `${r.titel} · ${laeufe.daten.laeufe.length}` : r.id === 'tests' && laeufe.daten?.tests.length ? `${r.titel} · ${laeufe.daten.tests.length}` : r.titel }))} aktiv={reiter} onWahl={w => reiterWaehlen(w)} ariaLabel="Werkstatt" /></div>}
          {kopfZustand}
        </div>
        {reiter === 'bauen' && <div className="pw-werkzeuge" role="toolbar" aria-label="Werkstatt">
          {!nurLesen && <SymbolKnopf ariaLabel="Rückgängig (⌘Z)" aus={!geschichte.zurueck.length} onClick={zurueck}><Undo2 size={16} /></SymbolKnopf>}
          {!nurLesen && <SymbolKnopf ariaLabel="Wiederholen (⌘⇧Z)" aus={!geschichte.vor.length} onClick={vor}><Redo2 size={16} /></SymbolKnopf>}
          {!nurLesen && <Knopf leise onClick={() => taste({ art: 'ordnen' })} titel="Ordnen — eine Leserichtung; Zettel, die etwas verdecken, wandern über die Rahmen (⇧O, rückgängig machbar)"><span className="pz-knopf-inhalt"><LayoutGrid size={14} aria-hidden />Ordnen</span></Knopf>}
          {!nurLesen && <Knopf leise onClick={zettelHin} titel="Notiz-Zettel auf die Fläche"><span className="pz-knopf-inhalt"><StickyNote size={14} aria-hidden />Zettel</span></Knopf>}
          {!nurLesen && <Knopf leise onClick={() => phaseAktion('neu', phasen(d).at(-1)?.id ?? '')} titel="Neue Phase am Ende"><span className="pz-knopf-inhalt"><Columns3 size={14} aria-hidden />Phase</span></Knopf>}
          {rasterKnopf}
          <SymbolKnopf ariaLabel="Verkleinern" onClick={() => flaeche.current?.zoomen(0.8)}><Minus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Vergrößern" onClick={() => flaeche.current?.zoomen(1.25)}><Plus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Alles zeigen" onClick={allesZeigen}><Fullscreen size={16} /></SymbolKnopf>
          {karteKnopf}
          <SymbolKnopf ariaLabel="Kürzel (?)" gedrueckt={hilfe} onClick={() => setHilfe(h => !h)}><Keyboard size={16} /></SymbolKnopf>
          {headKnopf}
          {probeKnopf}
          {versionenKnopf}
        </div>}
      </div>
      )}
      {!imModus && ueBand}
      {reiter !== 'bauen' && hinweisBlock(false)}
      {reiter === 'laeufe' && (
        <WerkstattLaeufe prozessId={prozessId} laufId={adr.lauf ?? null} daten={laeufe.daten} fehler={laeufe.fehler} rechte={rechte} team={team} konten={konten} agentName={agentName}
          onLauf={id => reiterWaehlen('laeufe', id)} onTestfall={() => reiterWaehlen('tests')} onNeu={laeufe.laden} onAlsTestdaten={a => void alsTestdaten(a)} />
      )}
      {reiter === 'tests' && (
        <WerkstattTests prozessId={prozessId} d={d} tests={laeufe.daten?.tests ?? []} rechte={rechte} ergebnisse={testErg}
          onErgebnisse={e => setTestErg(m => { const n = new Map(m); for (const x of e) n.set(x.id, x); return n; })} onNeu={laeufe.laden} />
      )}
      {/* Am Handy zuerst die Schritte zum Bearbeiten (Texte, Fristen, Zuständige) — die Fläche und der Steckbrief folgen darunter. */}
      {reiter === 'bauen' && nurAnsehen && (
        <MobilSchrittListe darf={mobilDarf} onBearbeiten={setMobilWahl}
          phasen={phasen(d).map(p => ({ id: p.id, titel: p.titel, schritte: alleSchritte(d).filter(x => x.phase.id === p.id && x.schritt.form !== 'freigabe').map(x => ({ id: x.schritt.id, titel: x.schritt.titel, unter: unterzeile(x.schritt) || undefined })) }))} />
      )}
      {reiter === 'bauen' && <div className={`pw-raster${nurAnsehen ? ' pw-raster-schmal' : ''}`}>
        <div ref={rahmen} className="pw-flaeche-rahmen">
          <WerkstattFlaeche ref={flaeche} d={d} lage={lage} szene={`${prozessId}:${versionAnsicht?.nr ?? 'entwurf'}`} auswahl={auswahl} kanteWahl={kanteWahl} rahmenWahl={rahmenWahl} andockWahl={andockWahl}
            probe={probeMap} befundJe={befundJe} unterzeile={unterzeile} mitSchloss={mitSchloss} nurLesen={nurLesen} raster={raster} handy={nurAnsehen}
            label={`Werkstatt „${d.titel}“: ${alleSchritte(d).length} Schritte in ${phasen(d).length} Phasen, ${lage.bahnen.length} Bahnen. Pfeile wählen, Alt + Pfeil legt an, Tab öffnet die Formauswahl.`}
            onAuswahl={(ids, o) => { setKanteWahl(null); setAndockWahl(null); setRahmenWahl(null); setAuswahl(a => (o?.erweitern ? [...a.filter(x => !ids.includes(x)), ...ids.filter(x => !a.includes(x))] : ids)); }}
            onKante={id => { setKanteWahl(id); setAuswahl([]); setRahmenWahl(null); }}
            onRahmen={id => { setRahmenWahl(id); setAuswahl([]); setKanteWahl(null); }}
            onUnter={(id, art) => { setAuswahl([id]); setAndockWahl({ id, art }); setKanteWahl(null); setRahmenWahl(null); }}
            onZiehen={ziehen}
            onVerbinden={(von, ausgang, nach) => mitFassung(f => verbindenFrei(f, von, ausgang, nach))}
            zwischen={zwischenOk} onZwischen={(id, ort) => anhaengen({ zwischen: id }, ort)}
            onUmhaengen={(id, ziel) => { const k = lage.kanten.find(x => x.id === id); if (k && mitFassung(f => umhaengen(f, k, ziel))) setKanteWahl(null); }}
            onDoppel={doppelklick} umbenennen={umbenennen} onUmbenannt={umbenannt}
            karte={karte} radSchiebt={imModus} onZettelGroesse={(id, b, h) => mitFassung(f => { const z = (f.zettel ?? []).find(x => x.id === id); return z ? zettelAendern(f, id, { pos: { ...z.pos, b, h } }) : { ok: false, grund: 'Diesen Zettel gibt es nicht (mehr).' }; }, { auswahl: false })}
            befundTexte={befundTexte} onBefund={(id, feld) => { setAuswahl([id]); setKanteWahl(null); setRahmenWahl(null); setFeldFokus(f => ({ knoten: id, ...(feld ? { feld } : {}), n: (f?.n ?? 0) + 1 })); }}
            onAnhaengen={anhaengen}
            onZuklappen={zuklappen}
            onTaste={taste} onMassstab={massstab.setzen} />
          {hinweisBlock(true)}
          {/* Der Pfeil oben rechts IN der Fläche (Entscheidung 22.10.) — im Werkzeugmodus trägt ihn die Kopfzeile (⤡). */}
          {!modus && onGanzerBildschirm && <GanzerBildschirmKnopf onClick={onGanzerBildschirm} />}
          {formauswahl && (
            <WerkstattFormauswahl form={formauswahl.form} titel={auswahlTitel(formauswahl.ziel)}
              ohneAusloeser={!!formauswahl.ziel.zwischen || (!!formauswahl.ziel.nach && d.knoten.find(k => k.id === formauswahl.ziel.nach)?.form !== 'ausloeser')} anhaengen={!!formauswahl.ziel.nach || !!formauswahl.ziel.zwischen}
              onWahl={e => ausKatalog(e, formauswahl.ziel)} onZu={() => { setFormauswahl(null); flaeche.current?.fokus(); }}
              onMehrfach={formauswahl.ziel.nach && !formauswahl.ziel.zwischen && !formauswahl.ziel.ausgang?.match(/nein|fehler|abgelaufen/) ? () => { setMehrfach(formauswahl.ziel.nach!); setFormauswahl(null); } : undefined} />
          )}
          {probeOffen && <ProbeFallFenster fallArt={d.fallArt ?? 'mandat'} wert={probeFall} onWert={setProbeFall} onStart={() => probelauf()} onZu={() => setProbeOffen(false)} />}
          {hilfe && (
            <div role="dialog" aria-label="Kürzel der Werkstatt" className="pz-hilfe">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: TYP.body }}>Kürzel</b>
                <SymbolKnopf ariaLabel="Schließen (Esc)" onClick={() => setHilfe(false)}><X size={16} /></SymbolKnopf>
              </div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0, fontSize: TYP.bedien }}>
                {WERKSTATT_KUERZEL.map(k => <span key={k.taste} style={{ display: 'contents' }}><dt style={{ color: C.ink, fontWeight: 600 }}>{k.taste}</dt><dd style={{ margin: 0, color: C.inkDim }}>{k.was}</dd></span>)}
              </dl>
            </div>
          )}
        </div>
        {imModus
          ? <WerkzeugFeld titel="Einstellungen" oeffnenBei={ein ?? kanteWahl ?? rahmenWahl ?? null} zuBei={panelZu}>{panelInhalt}</WerkzeugFeld>
          : <aside className="pw-panel" aria-label="Einstellungen">{panelInhalt}</aside>}
      </div>}
      {mobilWahl && (() => {
        const k = d.knoten.find(x => x.id === mobilWahl);
        if (!k) return null;
        return <MobilMaske titel={`„${k.titel}“`} felder={werkstattMobilFelder(k, auswahlListen['team-person'] ?? [])} onZu={() => setMobilWahl(null)}
          onSpeichern={w => { if (mobilDarf) mitFassung(f => ersetzen(f, werkstattMobilAnwenden(k, w)), { auswahl: false }); setMobilWahl(null); }} />;
      })()}
      <div aria-live="polite" className="pz-nur-vorlesen">{ansage}</div>
      {headOffen && (
        <HeadFragenFenster onZu={() => setHeadOffen(false)} onUebernommen={headUebernommen}
          gesperrt={ausstehend ? 'Erst warten, bis dein Entwurf gespeichert ist — dann übernehmen.' : null}
          prozess={{ id: prozessId, titel: d.titel, bereich: d.bereich, fallArt: d.fallArt, beschreibung: d.beschreibung, phasen: phasen(d).map(p => ({ id: p.id, titel: p.titel })) }} />
      )}
      {versionenOffen && (
        <VersionenFenster versionen={eintrag.versionen} befunde={befunde} sperrt={sperrt} darfVeroeffentlichen={!!rechte?.veroeffentlichen} entwurfGeaendert={geaendertSeitVersion || ausstehend}
          ausstehend={ausstehend} laufHinweise={laufBefunde(d)}
          tests={{ anzahl: laeufe.daten?.tests.length ?? 0, stand: testStand(testErg.size ? [...testErg.values()] : null, laeufe.daten?.tests.length ?? 0), onPruefen: testsAlle }}
          onVeroeffentlichen={veroeffentlichen} onAnsehen={ansehen} onVergleichen={vergleichen} onUebernehmen={uebernehmen} onZu={() => setVersionenOffen(false)} namen={konten} />
      )}
      {mehrfach && (
        <MehrfachFenster d={d} nach={mehrfach} onZu={() => setMehrfach(null)} onAnlegen={(faelle, sonst) => {
          const f = fassungRef.current;
          if (!f) return 'Die Werkstatt lädt noch.';
          const e = mehrfachEntscheidung(f, { nach: mehrfach, faelle, sonst, kennung: () => neueKennung('fk') });
          if (!e.ok) return e.grund;
          anwenden(e); setMehrfach(null);
          return null;
        }} />
      )}
      {/* Punkt 7: das große Einstellungsfenster — Eingabe · Maske · Ausgabe (Enter bzw. zweiter Doppelklick). */}
      {grossKnoten && reiter === 'bauen' && (
        <WerkstattGross k={grossKnoten} d={d} panel={panelFuer({ knoten: grossKnoten, imFenster: true })} werte={testwerte} testdaten={eintrag.testdaten ?? null}
          namen={new Map(team.map(t => [t.id, t.name]))} mitSchloss={mitSchloss.has(grossKnoten.id)} nurLesen={nurLesen}
          test={schrittTest?.knoten === grossKnoten.id ? schrittTest.ergebnis : null} testLaeuft={schrittTestLaeuft}
          onTesten={art => void schrittTesten(grossKnoten.id, art)} onTestdaten={testdatenSpeichern}
          onZu={() => { setGross(null); setSchrittTest(null); flaeche.current?.fokus(); }}
          onModell={modellFuer} />
      )}
    </div>
    </VorlageKontext.Provider>
    </EingabeKontext.Provider>
  );
}


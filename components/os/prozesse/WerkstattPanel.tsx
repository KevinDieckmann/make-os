'use client';

// ─── Prozesse · Werkstatt — das Panel rechts (Etappe B2, 21.10.; ANALYSE_100.md Punkte 8, 10, 22, 23, 55, 62; Kevins Bild der Werkstatt) ─────────────────────
// Klick auf einen Knoten öffnet rechts die Einstellungs-Maske aus dem Masken-Schema des Katalogs (lib/prozesse/baustein-katalog.ts), gesäubert und
// zurückgeschrieben über EINE Stelle (lib/prozesse/werkstatt-maske.ts). Dazu: Name (Verb + Gegenstand), Freigabe-Schloss (sichtbar, nicht entfernbar), beim Agenten
// die drei Andockpunkte (Modell · Gedächtnis · Werkzeuge) mit dem Rechte-Profil (Ampel „tödliches Dreieck“), die Ausgänge (wohin, wie beschriftet — dieselbe
// Verbindung wie das Ziehen, für Tastatur und Vorleser), die Befunde und Hinweise am Knoten, der Satz des Probelaufs. Ohne Auswahl: der Steckbrief des Prozesses
// (Name, Bereich, Fall, Eigner, Kriterien — Punkt 10). Phase, Faden und Zettel haben eigene, kurze Felder.

import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { Lock, Trash2, Copy, Scissors, ChevronsRightLeft, Plus, CopyPlus, Maximize2, Zap } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, BEDEUTUNG_FARBE, MIKRO, TIEF } from '@/lib/make-one/design';
import { Ueberschrift, Hinweis, Knopf, Pillen, Feldzeile, Schalter, auswahl as auswahlStil, Chip } from '../ui';
import {
  PROZESS_BEREICHE, FALL_ARTEN, ZETTEL_FARBEN, type Befund, type MaskenWert, type NotizZettel, type ProzessDefinition, type ProzessForm, type ProzessKnoten, type AgentWer,
} from '@/lib/prozesse/definition';
import { alleSchritte, phasen, schritteDer, type Ausgang } from '@/lib/prozesse/fluss';
import { feldSichtbar, katalogEintrag, klasseVonEintrag, platzhalterFuer, type AuswahlQuelle, type KatalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { ausloeserFelder, feldTitelVon } from '@/lib/prozesse/ausloeser';
import { annahmeOptionen } from '@/lib/prozesse/testdaten';
import { rautenFelder } from '@/lib/prozesse/definition-pruefen';
import { erlaubteWerkzeuge, rechteProfil } from '@/lib/prozesse/agent-schritt';
import { schlossText } from '@/lib/prozesse/schloss';
import { kundenFormErlaubt } from '@/lib/prozesse/produkt-bindung';
import { maskeWerte, maskeAnwenden, formWort, nameSetzen, titelSetzen, amMandatSatz, startAmMandat, AM_MANDAT_NAME } from '@/lib/prozesse/werkstatt-maske';
import { schleifenElementFall, teilprozessOptionen } from '@/lib/prozesse/teilprozess-neu';
import { feldWerte } from '@/lib/prozesse/feld-werte';
import { tageOptionen } from '@/lib/prozesse/zeitplan-tage';
import { ausgaengeVon, ausgangName, teamAusAuswahl, type KanteLage } from '@/lib/prozesse/werkstatt-lage';
import { ausgangsWahl, ausgangWahlAus, type AusgangWahl } from '@/lib/prozesse/werkstatt-aktionen';
import { PROBE_NAME, PROBE_BEDEUTUNG, centText, type ProbeSchritt, type Rat } from '@/lib/prozesse/werkstatt-hinweise';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { WEG } from '@/lib/wege';
import { ZETTEL_TON, WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import type { ModellOption } from '@/lib/prozesse/modell-wahl';
import { MaskenEingabe, TextFeld, useTippen, type Option } from './WerkstattMaske';
import { symbolVon } from './WerkstattKnoten';
import type { Auswahl } from './werkstatt-daten';

type K = ProzessKnoten<ProzessForm>;
const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const leise = { fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.45 } as const;
const ART: Readonly<Record<Befund['stufe'], 'kritisch' | 'achtung' | 'info'>> = { fehler: 'kritisch', offen: 'achtung', hinweis: 'info' };
const AMPEL = { gruen: { art: 'gut' as const, wort: 'grün' }, gelb: { art: 'achtung' as const, wort: 'gelb' }, rot: { art: 'kritisch' as const, wort: 'rot — Freigabe Pflicht' } };

/** Befunde und Hinweise als ruhige Liste (Farbe nie allein — Wort und Symbol des Hinweises). */
export function BefundListe({ befunde, raete = [], onTeilprozess }: { befunde: readonly Befund[]; raete?: readonly Rat[]; onTeilprozess?: (phaseId: string) => void }) {
  if (!befunde.length && !raete.length) return null;
  return (
    <div style={{ display: 'grid', gap: 8 }} aria-live="polite">
      {befunde.map((b, i) => <Hinweis key={`b${i}`} art={b.warnung ? 'achtung' : ART[b.stufe]}>{b.text}</Hinweis>)}
      {raete.map((r, i) => (
        <Hinweis key={`r${i}`} art={r.art === 'warnung' ? 'achtung' : 'info'}
          aktion={r.aktion === 'teilprozess' && r.phaseId && onTeilprozess ? <Knopf leise onClick={() => onTeilprozess(r.phaseId!)}><span className="pz-knopf-inhalt"><Scissors size={14} aria-hidden />Teilprozess bilden</span></Knopf> : undefined}>
          {r.text}
        </Hinweis>
      ))}
    </div>
  );
}

/** Wie ein Feld für Rauten heißt — EINE Stelle (lib/prozesse/ausloeser.ts `feldTitelVon`), auch für „Schritt testen“. */
export const feldTitel = feldTitelVon;

export interface PanelProps {
  d: ProzessDefinition;
  auswahl: Auswahl;
  modelle: readonly ModellOption[];
  befunde: readonly Befund[];
  raete: readonly Rat[];
  probe: ReadonlyMap<string, ProbeSchritt> | null;
  kanten: readonly KanteLage[];
  nurLesen: boolean;
  /** Was gewählt ist (höchstens eines davon). */
  knoten: K | null; phase: K | null; kante: KanteLage | null; zettel: NotizZettel | null;
  andock: string | null;
  titelFokus: number;
  onKnoten: (k: K) => void;
  /**
   * Kern-Bau-Test 24.10.: eine Änderung am AKTUELLEN Stand eines Knotens (Kennung + Änderung, `knotenAendern`) — so ändert ein Feld nur sein Feld an seinem Knoten,
   * nie mit einem älteren Abbild des ganzen Knotens. Ohne: wie bisher `onKnoten` mit dem Knoten, den das Panel zeigt.
   */
  onKnotenMit?: (id: string, f: (k: K) => K) => void;
  /** Der Sprung ins Feld eines Befunds ist erledigt — danach springt ein neues Öffnen desselben Knotens nicht wieder hinein (der Fokus bleibt, wo er ist). */
  onFeldFokusFertig?: () => void;
  /** Eine eben angelegte Phase: ihr Namensfeld bekommt einmal den Fokus (Name gewählt), danach `onPhaseFokusFertig`. */
  phaseFokus?: string | null;
  onPhaseFokusFertig?: () => void;
  onSteckbrief: (felder: Record<string, unknown>) => void;
  onZweig: (von: string, ausgang: Ausgang, nach: string | null) => void;
  /** Werkstatt-Fäden (24.10.): wohin ein Ausgang führt — JEDER Ausgang (auch „weiter“), dieselbe Funktion wie der Faden (lib/prozesse/werkstatt-aktionen.ts `ausgangSetzen`). */
  onAusgang?: (von: string, ausgang: Ausgang, wahl: AusgangWahl) => void;
  /** Am Auslöser (Bau-Test 24.10.): den Typ wechseln bzw. bewusst einen weiteren Auslöser hinzufügen — beides über die Knoten-Auswahl. */
  onAusloeser?: (id: string, art: 'wechseln' | 'neu') => void;
  onPfeilText: (von: string, art: Ausgang, text: string | null) => void;
  onLoeschen: (ids: string[]) => void;
  onKopieren: () => void;
  onPhase: (aktion: 'umbenennen' | 'teilen' | 'zuklappen' | 'neu' | 'loeschen', id: string, wert?: string) => void;
  onZettel: (id: string, teil: Partial<Pick<NotizZettel, 'text' | 'farbe'>> | null) => void;
  agentName: (wer: AgentWer) => string;
  /** Zusatz unter der Maske eines Knotens (22.10.: die Webhook-Karte am Auslöser „Webhook von außen“). */
  knotenZusatz?: (k: K) => ReactNode;
  /** Produkte, die auf diesen Prozess zeigen (22.10., Prozesse × Fulfillment) — der Steckbrief verlinkt sie. */
  produkte?: readonly { id: string; name: string }[];
  /** Unten im Steckbrief (22.10.): „Kopie anlegen“ und „Als Vorlage speichern“ (./WerkstattKopie.tsx). */
  steckbriefZusatz?: ReactNode;
  // ── Werkstatt bau-fertig (22.10.) ──
  /** „Weg annehmen“ im Probelauf (Punkt 9): Kennung → Ausgang; ändern über `onAnnahme` (null = wieder der Hauptweg). */
  annahmen?: Readonly<Record<string, string>>;
  onAnnahme?: (knotenId: string, ausgang: string | null) => void;
  onDuplizieren?: () => void;
  /** Das große Einstellungsfenster öffnen (Eingabe · Maske · Ausgabe, Punkt 7). */
  onGross?: (knotenId: string) => void;
  /** Ein Klick auf einen Befund am Knoten (Punkt 6) springt in dieses Feld (`n` zählt hoch, damit derselbe Klick wieder springt). */
  feldFokus?: { knoten: string; feld?: string; n: number } | null;
  /** Im großen Fenster: ohne Kopfzeile (die trägt das Fenster) und ohne „großes Fenster“-Knopf. */
  imFenster?: boolean;
  /** „+ Teilprozess hier anlegen“ an Schleife bzw. Teilprozess (Feinschliff 24.10.): neuer Prozess mit passendem Fall, danach gewählt. */
  onTeilprozessNeu?: (knotenId: string) => void;
}

/** Das Panel (siehe Kopf). */
export function WerkstattPanel(p: PanelProps) {
  // Je Knoten frisch (key): Getipptes eines Felds wird beim Wechsel zum nächsten Knoten noch für DIESEN übernommen (Feinschliff 24.10.), nie für den neuen.
  // Kern-Bau-Test 24.10.: ebenso Phase, Faden und Zettel (vorher ohne key — der Name einer Phase konnte nach dem Wechsel der Auswahl an die NEUE gehen); dazu
  // trägt jedes Feld sein Ziel (Kennung + Feld, `useTippen`).
  if (p.knoten) return <KnotenPanel key={p.knoten.id} {...p} k={p.knoten} />;
  if (p.phase) return <PhasePanel key={p.phase.id} {...p} ph={p.phase} />;
  if (p.kante) return <KantenPanel key={p.kante.id} {...p} k={p.kante} />;
  if (p.zettel) return <ZettelPanel key={p.zettel.id} {...p} z={p.zettel} />;
  return <SteckbriefPanel {...p} />;
}

function SteckbriefPanel(p: PanelProps) {
  const d = p.d;
  // Eigner ist immer eine Person — die Rollen („Zuständig im Fall“, „Eigner des Prozesses“) gibt es nur in den Masken der Schritte.
  const team = (p.auswahl['team-person'] ?? []).filter(t => !t.id.startsWith('rolle:'));
  const konten = p.auswahl['konto-person'] ?? [];
  const ohne = p.befunde.filter(b => !b.knotenId);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift>Steckbrief</Ueberschrift>
      <Feldzeile label="Name *"><TextFeld label="Name" pflicht wert={d.titel} aus={p.nurLesen} platz="z. B. Lead nachfassen" onWert={v => p.onSteckbrief({ titel: v })} /></Feldzeile>
      <Feldzeile label="Beschreibung"><TextFeld label="Beschreibung" mehrzeilig wert={d.beschreibung ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ beschreibung: v || null })} /></Feldzeile>
      <Feldzeile gruppe label="Bereich (Kachel auf der Landkarte)">
        <Pillen liste={PROZESS_BEREICHE.map(b => ({ id: b.id, label: b.titel }))} aktiv={d.bereich ?? 'fulfillment'} onWahl={v => { if (!p.nurLesen) p.onSteckbrief({ bereich: v }); }} />
      </Feldzeile>
      <Feldzeile gruppe label="Woran hängt ein Lauf?">
        <Pillen liste={FALL_ARTEN.map(f => ({ id: f.id, label: f.titel }))} aktiv={d.fallArt ?? 'mandat'} onWahl={v => { if (!p.nurLesen) p.onSteckbrief({ fallArt: v }); }} />
      </Feldzeile>
      <Feldzeile label="Eigner (genau eine Person aus dem Team)">
        <select aria-label="Eigner" value={d.eigner ?? ''} disabled={p.nurLesen} onChange={e => p.onSteckbrief({ eigner: e.target.value || null })} style={{ ...auswahlStil, width: '100%' }}>
          <option value="">— noch offen —</option>
          {d.eigner && !team.some(t => t.id === d.eigner) && <option value={d.eigner}>nicht mehr im Team</option>}
          {team.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Feldzeile>
      <Feldzeile label="Läuft als (Konto, als das der Lauf schreibt)">
        <select aria-label="Läuft als" value={d.laeuftAls ?? ''} disabled={p.nurLesen} onChange={e => p.onSteckbrief({ laeuftAls: e.target.value || null })} style={{ ...auswahlStil, width: '100%' }}>
          <option value="">— der Eigner —</option>
          {konten.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Feldzeile>
      {p.produkte?.length ? (
        <Feldzeile gruppe label="Gehört zu Produkt — ein neues Mandat startet diesen Prozess">
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
            {p.produkte.map(x => <Link key={x.id} href={WEG.produkt(x.id)} style={{ color: C.aktiv, fontSize: TYP.bedien }}>{x.name} ›</Link>)}
          </span>
        </Feldzeile>
      ) : null}
      <Feldzeile label="Startkriterium — wann gehört ein Fall hinein?"><TextFeld label="Startkriterium" mehrzeilig wert={d.startKriterium ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ startKriterium: v || null })} /></Feldzeile>
      <Feldzeile label="Endkriterium — wann ist der Prozess erfüllt?"><TextFeld label="Endkriterium" mehrzeilig wert={d.endKriterium ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ endKriterium: v || null })} /></Feldzeile>
      <BefundListe befunde={ohne} raete={p.raete.filter(r => !r.knotenId)} onTeilprozess={p.nurLesen ? undefined : id => p.onPhase('teilen', id)} />
      {!ohne.length && <p style={leise}>Einen Knoten anklicken öffnet seine Einstellungen. „+“ am Ausgang hängt den nächsten Baustein an.</p>}
      {p.steckbriefZusatz}
    </div>
  );
}

/** Werte einer Auswahlquelle — aus der Instanz (Server) bzw. aus dem Prozess selbst (Schritte, Listen). */
function optionenFuer(q: AuswahlQuelle | undefined, p: PanelProps, k: K): Option[] {
  if (!q) return [];
  if (q === 'schritt') return alleSchritte(p.d).filter(x => x.schritt.id !== k.id && x.schritt.form !== 'ausloeser' && !x.schritt.schloss).map(x => ({ id: x.schritt.id, label: x.schritt.titel }));
  if (q === 'liste') return p.d.knoten.filter(x => x.abfrage || x.katalog?.id === 'crm.abfragen').map(x => ({ id: `abfrage:${x.id}`, label: `Ergebnis von „${x.titel}“` }));
  const l = (p.auswahl[q] ?? []).map(o => ({ ...o }));
  if (q === 'werkzeug') {
    const erlaubt = k.agent ? erlaubteWerkzeuge(k.agent.wer) : null;
    return l.filter(o => !erlaubt || erlaubt.includes(o.id)).map(o => { const r = EINORDNUNG[o.id]?.rechte; return { ...o, ...(r === 'aussen' || r === 'geld' || r === 'loeschen' ? { hinweis: 'mit Freigabe' } : r ? { hinweis: r } : {}) }; });
  }
  // Runde 3 (Bau-Test 2): an einer Schleife nur Teilprozesse, deren Fall zum Eintrag der Liste passt (Deal-Liste → Fall Deal bzw. ohne Fall); ein schon gewählter,
  // der nicht passt, bleibt mit „passt nicht zum Fall“ stehen.
  if (q === 'prozess') return teilprozessOptionen(l.filter(o => o.id !== p.d.id), schleifenElementFall(p.d, k), k.schleife?.prozessId ?? null);
  return l;
}

function KnotenPanel(p: PanelProps & { k: K }) {
  const { k, d } = p;
  const e: KatalogEintrag | undefined = katalogEintrag(k.katalog?.id) ?? undefined;
  // 25.10. (Kern-Bau-Test 2): Kopf, Symbol und Satz aus DERSELBEN Regel wie die Unterzeile des Knotens (`startAmMandat`) — nie „Von Hand“ an einem Start am Mandat.
  const amMandat = startAmMandat(k, !!p.produkte?.length);
  const S = symbolVon(k, { amMandat: !!p.produkte?.length });
  const ton = WERKSTATT_FORM_FARBE[k.form ?? 'schritt'];
  const werte = e ? maskeWerte(k, e) : {};
  // Kern-Bau-Test 24.10.: jede Änderung wirkt auf den AKTUELLEN Stand DIESES Knotens (Kennung fest) — nur das eine Feld, nie ein älteres Abbild des ganzen Knotens.
  const aendern = (f: (x: K) => K) => (p.onKnotenMit ? p.onKnotenMit(k.id, f) : p.onKnoten(f(k)));
  const setze = (id: string, v: MaskenWert) => {
    if (!e || p.nurLesen) return;
    aendern(x => {
      // Name und Titel gehören zusammen (Bau-Test 24.10., lib/prozesse/werkstatt-maske.ts `titelSetzen`): der Name folgt dem Titel, solange er nicht selbst geändert wurde.
      if (id === 'titel') return titelSetzen(x, e, v, { modelle: p.modelle });
      const w = maskeWerte(x, e);
      const neu = { ...w, [id]: v };
      // Feinschliff 24.10.: ein anderer Rhythmus hat andere Tage (Wochentage ↔ Monatstage) — die alten passen nicht mehr.
      if (id === 'rhythmus' && v !== w.rhythmus) delete neu.tage;
      return maskeAnwenden(x, e, neu, { modelle: p.modelle });
    });
  };
  const schloss = d.knoten.find(x => x.schloss?.fuer === k.id);
  const fuer = k.schloss ? d.knoten.find(x => x.id === k.schloss!.fuer) : null;
  const befunde = p.befunde.filter(b => b.knotenId === k.id);
  const raete = p.raete.filter(r => r.knotenId === k.id);
  const probe = p.probe?.get(k.id);
  const titel = useRef<HTMLInputElement>(null);
  useEffect(() => { if (p.titelFokus) titel.current?.focus(); }, [p.titelFokus]);
  const andock = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (p.andock) andock.current?.querySelector(`[data-ws-abschnitt="${p.andock}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [p.andock, k.id]);
  // Punkt 6: der Befund am Knoten springt in sein Feld (bzw. an die Befunde, wenn er keins nennt).
  const ff = p.feldFokus;
  useEffect(() => {
    if (!ff || ff.knoten !== k.id) return;
    const wurzel = andock.current;
    const ziel = (ff.feld ? wurzel?.querySelector(`[data-ws-feld="${ff.feld}"]`) : null) ?? wurzel?.querySelector('[data-ws-befunde]');
    if (!ziel) return;
    ziel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (ziel.querySelector('input,textarea,select,button') as HTMLElement | null)?.focus({ preventScroll: true });
    // Kern-Bau-Test 24.10.: nur EINMAL springen — sonst holte jedes neue Öffnen dieses Knotens (Panel, großes Fenster) den Fokus wieder ins Feld, und Getipptes
    // landete dort statt auf der Fläche.
    p.onFeldFokusFertig?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur, wenn ein neuer Sprung kommt
  }, [ff, k.id]);
  const optionenAnnahme = annahmeOptionen(k);
  const ausschaltbar = k.form !== 'ausloeser' && k.form !== 'ende' && !k.schloss;
  // Felder für Bedingungen: am Auslöser die des Ereignisses bzw. Webhooks, sonst Fall + Webhook + Agenten-Ausgaben (wie die Prüfung).
  const felder: Option[] = useMemo(() => {
    const ids = k.form === 'ausloeser'
      ? ausloeserFelder(k.ausloeser ?? { art: e?.id === 'ausloeser.webhook' ? 'webhook' : e?.id === 'ausloeser.datum' ? 'datum' : 'ereignis' }, d.fallArt ?? 'mandat')
      : rautenFelder(d);
    return ids.map(id => ({ id, label: feldTitel(id) }));
  }, [k, e, d]);
  const platz = useMemo(() => platzhalterFuer(d.fallArt ?? 'mandat'), [d.fallArt]);
  const fehlerVon = (feldId: string) => befunde.find(b => b.feld === feldId && (b.stufe !== 'hinweis' || b.warnung))?.text;
  // „Nur öffentliche Angaben“ (Entscheidung 22.10. nachts): dann sind Akte und Brain aus — die Maske zeigt sie gesperrt auf „nein“ (so läuft es auch im Motor).
  const nurOeffentlich = k.form === 'agent' && werte.nurOeffentlich === true;
  const gesperrt = (id: string) => nurOeffentlich && (id === 'akte' || id === 'brain');
  // Feinschliff 24.10.: Felder mit Werteliste (Produkt, Stufe, Status, Zuständig …) — Auswahl statt Freitext (lib/prozesse/feld-werte.ts).
  const werteVon = (feldId: string) => feldWerte(feldId, p.auswahl, d);
  // Zeitplan (Feinschliff 24.10.): Tage nach dem Rhythmus — wöchentlich Mo–So, monatlich 1–30 + „letzter Tag“; täglich/werktags ohne Tage.
  const tage = tageOptionen(werte.rhythmus);
  const eingabe = (f: KatalogEintrag['maske'][number]) => ((f.typ === 'tage' && !tage) || !feldSichtbar(f, werte) ? null : (
    <MaskenEingabe key={f.id} f={f} wert={gesperrt(f.id) ? false : werte[f.id]} onWert={v => setze(f.id, v)} optionen={f.optionen ? f.optionen.map(o => ({ ...o })) : optionenFuer(f.quelle, p, k)}
      felder={felder} platzhalter={platz} fehler={fehlerVon(f.id)} aus={p.nurLesen || gesperrt(f.id)} werteVon={werteVon} {...(tage ? { tage } : {})} />
  ));
  // Feinschliff 24.10. (Bau-Test A2): am Teilprozess bzw. an der Schleife gleich einen neuen Prozess anlegen — mit dem passenden Fall, danach gewählt.
  const teilNeu = !p.nurLesen && !!p.onTeilprozessNeu && (e?.feld === 'schleife' || e?.feld === 'teilprozess');
  const feld = (f: KatalogEintrag['maske'][number]) => (f.id === 'prozessId' && f.quelle === 'prozess' && teilNeu
    ? (
      <div key={f.id} style={{ display: 'grid', gap: 6 }}>
        {eingabe(f)}
        <span><Knopf leise onClick={() => p.onTeilprozessNeu!(k.id)} titel="Legt einen neuen Prozess mit dem passenden Fall an (je Deal: am Deal) und wählt ihn hier — öffnen lässt er sich danach in einem neuen Tab">
          <span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Teilprozess hier anlegen</span>
        </Knopf></span>
      </div>
    )
    : eingabe(f));
  // Agent: die Maske nach den drei Andockpunkten gruppiert (Modell · Gedächtnis · Werkzeuge), dazu das Rechte-Profil.
  const GRUPPE: Readonly<Record<string, 'modell' | 'gedaechtnis' | 'werkzeuge'>> = { modell: 'modell', modellWahl: 'modell', budgetCent: 'modell', nurOeffentlich: 'gedaechtnis', brain: 'gedaechtnis', akte: 'gedaechtnis', werkzeuge: 'werkzeuge' };
  const istAgent = k.form === 'agent' && e?.feld === 'agent';
  const profil = istAgent && k.agent ? rechteProfil(k.agent, {}) : null;
  const klasse = e ? klasseVonEintrag(e) : null;
  // Werkstatt-Fäden (24.10.): die Ausgänge der Form — am Warten mit fester Dauer ohne „abgelaufen“ (es läuft nie ab).
  const ausgaenge = ausgaengeVon(k);
  return (
    <div ref={andock} style={{ display: 'grid', gap: 12, minWidth: 0, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span aria-hidden style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(ton), border: `1px solid ${TIEF.rand(ton)}` }}><S width={20} height={20} color={ton} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...MIKRO }}>{e ? `${e.anbindung} · ${formWort(k.form)}` : formWort(k.form)}</div>
          <div style={{ fontSize: TYP.body, fontWeight: 650, color: C.ink, overflowWrap: 'anywhere' }}>{amMandat ? AM_MANDAT_NAME : e?.name ?? k.titel}</div>
        </div>
      </div>
      {/* Kern-Bau-Test 24.10.: der Start eines Prozesses, der zu einem Produkt gehört, startet am Mandat — nicht nur „wenn jemand auf Starten klickt“. */}
      {e?.satz && <p style={klein}>{amMandat && p.produkte ? amMandatSatz(p.produkte.map(x => x.name)) : e.satz}</p>}
      {k.deaktiviert && <Hinweis art="achtung" titel="Ausgeschaltet">Der Lauf überspringt diesen Schritt{schloss ? ' — sein Freigabe-Schloss mit' : ''}. Nichts davon wirkt, bis du ihn wieder einschaltest.</Hinweis>}
      <Feldzeile label="Name (Verb + Gegenstand)">
        <TitelFeld eingabe={titel} ziel={`${k.id}|name`} wert={k.titel} aus={p.nurLesen || !!k.schloss} onWert={t => aendern(x => nameSetzen(x, e, t, { modelle: p.modelle }))} />
      </Feldzeile>
      {/* Prozesse × Fulfillment (22.10.): ein Schritt, eine Nachricht oder ein Termin eines Mandats-Prozesses darf im Kunden-Link als Etappe erscheinen —
          nur ausdrücklich (lib/prozesse/kunden-etappen.ts); alles andere bleibt intern. */}
      {(d.fallArt ?? 'mandat') === 'mandat' && kundenFormErlaubt(k.form) && !k.schloss && (
        <Schalter an={k.kundeSichtbar === true} aus={p.nurLesen} erklaerung="prozesse.kundeSichtbar"
          onChange={v => aendern(x => { if (v) return { ...x, kundeSichtbar: true }; const { kundeSichtbar: _weg, ...ohne } = x; return ohne; })}>
          Dem Kunden zeigen
        </Schalter>
      )}
      {k.schloss && (
        <Hinweis art="achtung" titel={<span className="pz-knopf-inhalt"><Lock size={14} aria-hidden />Freigabe-Schloss</span>}>
          Gehört zu „{fuer?.titel ?? ''}“ — {schlossText(k.schloss.grund)} Die Regel setzt es selbst; es lässt sich nicht entfernen. Einstellen lässt sich, wer freigibt und wohin „abgelehnt“ bzw. „abgelaufen“ führen.
        </Hinweis>
      )}
      {schloss?.schloss && <Hinweis art="achtung" titel={<span className="pz-knopf-inhalt"><Lock size={14} aria-hidden />Mit Freigabe</span>}>{schlossText(schloss.schloss.grund)} Dahinter steht automatisch eine Freigabe im Stapel — die Wirkung geschieht erst nach dem Klick.</Hinweis>}
      {!schloss && klasse && klasse !== 'lesen' && <p style={leise}>Rechte-Klasse: {klasse}</p>}
      {probe && (
        <Hinweis art={PROBE_BEDEUTUNG[probe.status] === 'neutral' ? 'neutral' : PROBE_BEDEUTUNG[probe.status] === 'gut' ? 'gut' : PROBE_BEDEUTUNG[probe.status] === 'kritisch' ? 'kritisch' : 'achtung'} titel={`Probelauf: ${PROBE_NAME[probe.status]}`}>
          {probe.text}{probe.kostenCent ? ` · etwa ${centText(probe.kostenCent)}` : ''}
        </Hinweis>
      )}
      {!e && <p style={leise}>Dieser Knoten hat keinen Baustein aus dem Katalog — er läuft als {formWort(k.form)} ohne eigene Einstellungen.</p>}
      {e && !istAgent && e.maske.map(feld)}
      {p.knotenZusatz?.(k)}
      {istAgent && e && (
        <>
          {e.maske.filter(f => !GRUPPE[f.id]).map(feld)}
          {(['modell', 'gedaechtnis', 'werkzeuge'] as const).map(g => {
            const fs = e.maske.filter(f => GRUPPE[f.id] === g);
            if (!fs.length) return null;
            return (
              <section key={g} data-ws-abschnitt={g} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${p.andock === g ? C.ink : 'transparent'}`, background: 'transparent' }}>
                <div style={{ ...MIKRO }}>{g === 'modell' ? 'Andockpunkt Modell' : g === 'gedaechtnis' ? 'Andockpunkt Gedächtnis' : 'Andockpunkt Werkzeuge'}</div>
                {fs.map(feld)}
                {g === 'gedaechtnis' && nurOeffentlich && <p style={leise}>Nur öffentliche Angaben: an das Modell gehen nur Firmenname, Website und Branche — Akte und Brain bleiben aus, darum steht keine Freigabe dahinter. Die gefundenen Felder bestätigst du im Stapel.</p>}
                {g === 'werkzeuge' && <p style={leise}>Nur Werkzeuge, die der Agent schon hat. Werkzeuge der Klassen außen, Geld und Löschen setzen automatisch eine Freigabe dahinter.</p>}
              </section>
            );
          })}
          {profil && (
            <Hinweis art={AMPEL[profil.ampel].art} titel={`Rechte-Profil: ${AMPEL[profil.ampel].wort}`}>
              {profil.gruende.length ? profil.gruende.join(' · ') : 'liest nur, was der Schritt braucht'}{profil.dreieck ? ' — private Daten, fremder Text und ein Weg nach außen: Freigabe Pflicht (nicht abschaltbar).' : ''}
            </Hinweis>
          )}
        </>
      )}
      {/* Auslöser (Bau-Test 24.10.): den Typ wechseln statt eines zweiten Auslösers; ein weiterer Auslöser nur bewusst. */}
      {k.form === 'ausloeser' && !p.nurLesen && p.onAusloeser && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf leise onClick={() => p.onAusloeser!(k.id, 'wechseln')} titel="Den Typ dieses Auslösers wechseln — von Hand, Ereignis, Zeitplan, je Person ab Uhrzeit, Webhook …"><span className="pz-knopf-inhalt"><Zap size={14} aria-hidden />Auslöser ändern …</span></Knopf>
          <Knopf leise onClick={() => p.onAusloeser!(k.id, 'neu')} titel="Einen zweiten Auslöser dazu — er führt wie dieser in den ersten Schritt"><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Weiteren Auslöser hinzufügen</span></Knopf>
        </div>
      )}
      {/* Ausgänge: wohin, wie beschriftet — dasselbe wie einen Faden ziehen (Punkt 23: Rauten-Ausgänge immer benannt). Werkstatt-Fäden (24.10.): JEDER Ausgang ist
          wählbar, auch „weiter“ einer Aufgabe — „der nächste Schritt“, ein Schritt der Phase oder „Lauf endet“; kein anderer Ausgang ändert sich dabei. */}
      {ausgaenge.length > 0 && !p.nurLesen && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ ...MIKRO }}>Ausgänge</div>
          {ausgaenge.map(a => {
            const kante = p.kanten.find(x => x.von === k.id && (x.ausgang === a || (a === 'weiter' && x.ausgang === 'ja' && k.form !== 'entscheidung')));
            const wahl = ausgangsWahl(d, k.id, a, { team: teamAusAuswahl(p.auswahl['team-person']) });
            return (
              // Runde 4 (Bau-Test 3: das Ziel war im schmalen Feld abgeschnitten): der Name des Ausgangs steht über der Auswahl, die Auswahl nimmt die volle Breite.
              <div key={a} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1fr)' }}>
                <span style={{ fontSize: TYP.bedien, color: a === 'fehler' ? LEUCHT.kritisch : C.inkDim }}>{ausgangName(k.form ?? 'schritt', a)}</span>
                <select aria-label={`Ausgang ${ausgangName(k.form ?? 'schritt', a)}`} value={wahl.wert} disabled={!p.onAusgang}
                  onChange={ev => p.onAusgang?.(k.id, a, ausgangWahlAus(ev.target.value))} style={{ ...auswahlStil, width: '100%' }}>
                  {wahl.optionen.map(o => <option key={o.wert} value={o.wert}>{o.label}</option>)}
                </select>
                {(a !== 'weiter' || kante) && (
                  <span style={{ gridColumn: '1 / -1' }}>
                    <TextFeld label={`Beschriftung von ${ausgangName(k.form ?? 'schritt', a)}`} ziel={`${k.id}|pfeil:${a}`} wert={(a === 'weiter' ? k.pfeilText?.weiter : k.pfeilText?.[a]) ?? ''} platz={`Beschriftung (Vorgabe „${ausgangName(k.form ?? 'schritt', a)}“)`}
                      onWert={t => p.onPfeilText(k.id, a, t || null)} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Punkt 9: „Weg annehmen“ — welchen Ausgang der Probelauf hier nimmt (gespeichert als Testdaten, nur Kennungen; scharf nie). */}
      {optionenAnnahme.length > 0 && p.onAnnahme && (
        <Feldzeile label="Im Probelauf annehmen">
          <select aria-label="Im Probelauf annehmen" value={p.annahmen?.[k.id] ?? ''} disabled={p.nurLesen} onChange={ev => p.onAnnahme!(k.id, ev.target.value || null)} style={{ ...auswahlStil, width: '100%' }}>
            <option value="">— Hauptweg (Vorgabe) —</option>
            {optionenAnnahme.map(o => <option key={o.ausgang} value={o.ausgang}>{o.label}</option>)}
          </select>
        </Feldzeile>
      )}
      {/* Punkt 14: ausschalten statt löschen — der Lauf überspringt ihn, ein Schloss dahinter mit. */}
      {ausschaltbar && (
        <Schalter an={k.deaktiviert === true} aus={p.nurLesen}
          erklaerung={[{ kopf: 'Schritt ausschalten', text: 'Ausgeschaltet überspringt der Lauf diesen Schritt und geht über den Hauptweg weiter. Ein Freigabe-Schloss dahinter wird mit übersprungen — es bleibt im Prozess. Beispiel: die Erinnerungs-Mail eine Woche lang aussetzen, ohne sie zu löschen.' }]}
          onChange={v => aendern(x => { if (v) return { ...x, deaktiviert: true }; const { deaktiviert: _d, ...ohne } = x; return ohne; })}>
          Ausgeschaltet
        </Schalter>
      )}
      <div data-ws-befunde=""><BefundListe befunde={befunde} raete={raete} /></div>
      {!p.nurLesen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {!p.imFenster && p.onGross && <Knopf leise onClick={() => p.onGross!(k.id)} titel="Großes Fenster: Eingabe · Maske · Ausgabe (Enter bzw. zweiter Doppelklick)"><span className="pz-knopf-inhalt"><Maximize2 size={14} aria-hidden />Groß öffnen</span></Knopf>}
          <Knopf leise onClick={p.onKopieren} titel="Kopieren (⌘C)"><span className="pz-knopf-inhalt"><Copy size={14} aria-hidden />Kopieren</span></Knopf>
          {!k.schloss && k.form !== 'ausloeser' && p.onDuplizieren && <Knopf leise onClick={p.onDuplizieren} titel="Duplizieren (⌘D)"><span className="pz-knopf-inhalt"><CopyPlus size={14} aria-hidden />Duplizieren</span></Knopf>}
          {!k.schloss && <Knopf leise onClick={() => p.onLoeschen([k.id])} titel="Löschen (Entf)"><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Löschen</span></Knopf>}
        </div>
      )}
    </div>
  );
}

/** Der Name eines Schritts — beim Tippen übernommen (entprellt, nie leer), beim Verlassen gekürzt bzw. zurück auf den gespeicherten Namen (Feinschliff 24.10.). */
function TitelFeld({ eingabe, wert, aus, onWert, ziel }: { eingabe: RefObject<HTMLInputElement>; wert: string; aus: boolean; onWert: (t: string) => void; ziel: string }) {
  const e = useTippen(wert, onWert, { gueltig: v => !!v.trim(), ziel });
  const verlassen = () => {
    if (e.t.trim() !== e.t && e.t.trim()) e.tippe(e.t.trim());
    if (!e.fertig() && !e.t.trim()) e.zuruecksetzen();
  };
  return (
    <input ref={eingabe} aria-label="Name des Schritts" value={e.t} disabled={aus} placeholder="z. B. Angebot senden"
      onChange={ev => e.tippe(ev.target.value)} onBlur={verlassen}
      onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
      style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', background: 'transparent', border: `1px solid ${C.linie}`, borderRadius: 12, padding: '10px 14px', color: C.ink, fontSize: TYP.body }} />
  );
}

function PhasePanel(p: PanelProps & { ph: K }) {
  const { ph, d } = p;
  const schritte = schritteDer(d, ph.id);
  const nr = phasen(d).findIndex(x => x.id === ph.id) + 1;
  const wurzel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (p.phaseFokus !== ph.id) return;
    const feld = wurzel.current?.querySelector<HTMLInputElement>('input[aria-label="Name der Phase"]');
    feld?.focus({ preventScroll: true }); feld?.select();
    p.onPhaseFokusFertig?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nur für die eben angelegte Phase
  }, [p.phaseFokus, ph.id]);
  return (
    <div ref={wurzel} style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift rechts={<Chip farbe={C.inkDim}>{`Phase ${nr}`}</Chip>}>{ph.titel}</Ueberschrift>
      <Feldzeile label="Name der Phase"><TextFeld label="Name der Phase" ziel={`${ph.id}|titel`} wert={ph.titel} aus={p.nurLesen} onWert={v => v.trim() && p.onPhase('umbenennen', ph.id, v)} /></Feldzeile>
      <p style={klein}>{schritte.length} {schritte.length === 1 ? 'Schritt' : 'Schritte'}.</p>
      <BefundListe befunde={p.befunde.filter(b => b.knotenId === ph.id)} raete={p.raete.filter(r => r.phaseId === ph.id)} onTeilprozess={p.nurLesen ? undefined : id => p.onPhase('teilen', id)} />
      {!p.nurLesen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf leise onClick={() => p.onPhase('teilen', ph.id)} titel="Die Phase an einer Stelle teilen, an der kein Zweig quer liegt"><span className="pz-knopf-inhalt"><Scissors size={14} aria-hidden />Teilprozess bilden</span></Knopf>
          <Knopf leise onClick={() => p.onPhase('zuklappen', ph.id)}><span className="pz-knopf-inhalt"><ChevronsRightLeft size={14} aria-hidden />Zu- bzw. aufklappen</span></Knopf>
          <Knopf leise onClick={() => p.onPhase('neu', ph.id)}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Phase dahinter</span></Knopf>
          {!schritte.length && <Knopf leise onClick={() => p.onPhase('loeschen', ph.id)}><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Phase löschen</span></Knopf>}
        </div>
      )}
    </div>
  );
}

function KantenPanel(p: PanelProps & { k: KanteLage }) {
  const von = p.d.knoten.find(x => x.id === p.k.von), nach = p.d.knoten.find(x => x.id === p.k.nach);
  const f = von?.form ?? 'schritt';
  const zweig = p.k.ausgang !== 'weiter' && !(p.k.ausgang === 'ja' && (f === 'freigabe' || von?.schloss)) && !!von?.zweige?.[p.k.ausgang as 'ja'];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift>Faden</Ueberschrift>
      <p style={klein}>„{von?.titel ?? ''}“ → „{nach?.titel ?? ''}“ · Ausgang {ausgangName(f, p.k.ausgang)}{p.k.rueckwaerts ? ' · zurück (Schleife)' : ''}</p>
      {von && !p.nurLesen && (
        <Feldzeile label="Beschriftung">
          <TextFeld label="Beschriftung" ziel={`${von.id}|pfeil:${p.k.ausgang}`} wert={(p.k.ausgang === 'weiter' ? von.pfeilText?.weiter : von.pfeilText?.[p.k.ausgang]) ?? ''} platz={ausgangName(f, p.k.ausgang)} onWert={t => p.onPfeilText(von.id, p.k.ausgang, t || null)} />
        </Feldzeile>
      )}
      {!p.nurLesen && (zweig
        ? <Knopf leise onClick={() => p.onZweig(p.k.von, p.k.ausgang, null)}>Zweig lösen (Entf)</Knopf>
        : <p style={leise}>Die Reihenfolge lässt sich nicht lösen — einen Faden vom Ausgang zu einem anderen Schritt ziehen hängt ihn um.</p>)}
    </div>
  );
}

function ZettelPanel(p: PanelProps & { z: NotizZettel }) {
  const z = p.z;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift>Notiz-Zettel</Ueberschrift>
      <p style={leise}>Nur Text auf der Fläche — kein Schritt, keine Wirkung, nie im Lauf.</p>
      <Feldzeile label="Text"><TextFeld label="Text des Zettels" ziel={`${z.id}|text`} mehrzeilig wert={z.text} aus={p.nurLesen} platz="z. B. Auftrag an den Agenten" onWert={t => p.onZettel(z.id, { text: t })} /></Feldzeile>
      <Feldzeile gruppe label="Farbe">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ZETTEL_FARBEN.map(f => (
            <button key={f} type="button" className="fassbar" aria-pressed={(z.farbe ?? 'gelb') === f} aria-label={`Farbe ${f}`} disabled={p.nurLesen} onClick={() => p.onZettel(z.id, { farbe: f })}
              style={{ width: 40, height: 40, borderRadius: 12, border: `2px solid ${(z.farbe ?? 'gelb') === f ? C.ink : 'transparent'}`, background: TIEF.fuellung(ZETTEL_TON[f]), cursor: 'pointer' }} />
          ))}
        </div>
      </Feldzeile>
      {!p.nurLesen && <Knopf leise onClick={() => p.onZettel(z.id, null)}><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Zettel löschen</span></Knopf>}
    </div>
  );
}

/** Für die Seite: die Farbe eines Befunds (Rand der Statuszeile). */
export const befundFarbe = (s: Befund['stufe']) => BEDEUTUNG_FARBE[ART[s] === 'info' ? 'info' : ART[s]];

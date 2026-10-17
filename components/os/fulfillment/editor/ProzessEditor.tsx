'use client';

// ─── Fulfillment › Landkarte › Ablauf bearbeiten — der Prozess-Editor im Miro-Stil (17.10.) ───────────────────────────────────────────────
// Rückmeldung 17.10.: „Jeder baut seine Abläufe selbst in der App: Schritte, Nachrichten, Entscheidungen und Erinnerungen per Ziehen anlegen. Damit wird das
// Fulfillment zum Werkzeug, das Kunden für ihre eigenen Prozesse nutzen.“ Aufbau (DESIGN_STANDARD.md › Prozess-Visualisierung › Editor):
//   · Oben die Reise als EINE Zeile (dieselbe Zeichnung wie Fall › Reise): Phasen ziehen zum Umsortieren, Raute zwischen den Phasen = Abstimmungspunkt
//     an/aus, „+ Phase“ am Ende. Ein Tipp auf eine Phase zeigt darunter ihren Fluss.
//   · Darunter links die Palette (Schritt · Nachricht · Entscheidung · Erinnerung · Termin · Baustein — ziehen oder antippen), in der Mitte der Fluss
//     (oben → unten, Entscheidung mit ja/nein, Nein-Zweig typisch eine Erinnerung zurück zur Entscheidung), rechts das kleine Seitenfeld des Knotens.
//   · Rückgängig/Wiederholen in der Sitzung (⌘Z / ⇧⌘Z) über denselben Schreibweg; ein fremder Stand (409) zeigt die aktuelle Fassung und beginnt neu.
//   · Bedienung: Maus/Trackpad ziehen ab 5 px, Finger lange drücken 0,45 s; Tastatur für alles (Pfeile, Alt+Pfeile verschieben, Entf löschen, Enter
//     bearbeiten, „Einfügen nach …“); Ziele ≥ 44 px. Am Handy (≤ 720 px) eine Liste mit Pfeilen statt Ziehen (EditorListe).
//   · Rechte: bearbeiten nur volle Mitglieder (die Route prüft; „nur Business“ sieht nur — hier ohne Palette und Ziehen).
//   · Zwei Ansichten derselben Vorlage (17.10.): „Fluss“ (oben → unten, wie bisher; am Handy die Liste) und „Fläche“ (frei zeichnen wie in Miro, ./Flaeche.tsx;
//     am Handy nur ansehen). Der Wechsel verliert nichts — beide schreiben über denselben Weg; die Wahl merkt sich der Browser.
// Rechnet nichts (lib/fulfillment/prozesse/{editor,editor-geschichte}.ts); Änderungen gelten für NEUE Fälle — laufende zeigen „Vorlage geändert — übernehmen?“.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, Redo2, ArrowLeft, Plus } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, RAND, ECKE, SCHRIFT, FLAECHE_STIL } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Klappbar, useHandy, useRueckfrage, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { neueKennung } from '@/lib/kennung';
import { editorModell, FORM_TITEL, FORM_VORGABE, type EditorKnoten, type EditorOp, type EditorPhase, type EditorZiel } from '@/lib/fulfillment/prozesse/editor';
import { geschichteFuer, type GeschichteEintrag } from '@/lib/fulfillment/prozesse/editor-geschichte';
import { flussFormVon } from '@/lib/fulfillment/prozesse/reise-bild';
import type { KnotenForm, ProzessVorlage } from '@/lib/fulfillment/typen';
import { holeJson, fehlerText, geaendert } from '../prozesse/daten';
import { klein, Meldung, KnotenFormular } from '../prozesse/teile';
import { ReiseBild, FormZeichen } from '../../ui/reise/ReiseBild';
import { FreigabeRaute } from '../../ui/reise/formen';
import { FormenLegende } from '../../ui/reise/Fluss';
import { editorSpalten, flacheSchritte, formFuerBaustein } from './bild';
import { EditorFluss } from './EditorFluss';
import { SchrittFeld, PhasenFeld, GruppenFeld, LeerFeld, WahlKnoepfe, K44, ZIEL_PX, type EditorApi } from './SeitenFeld';
import { EditorListe } from './EditorListe';
import { useEditorZiehen, type ZiehQuelle, type ZiehZiel } from './ziehen';
import { EditorFlaeche } from './Flaeche';

/** Die zwei Ansichten des Editors — Fluss (bzw. Liste am Handy) und Fläche. */
export type EditorAnsichtArt = 'fluss' | 'flaeche';
const MERKER_ANSICHT = 'make-ff-editor-ansicht';

export interface EditorDaten { vorlage: ProzessVorlage; stand: string; bausteine: { id: string; titel: string; art: string }[]; darfBearbeiten: boolean; laufend: number }

export { formFuerBaustein } from './bild';
/** Die Palette — in dieser Reihenfolge (Miro-Standard). */
export const PALETTE: readonly (KnotenForm | 'baustein')[] = ['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'baustein'];

/** Lädt den Ablauf und zeigt den Editor. */
export function ProzessEditor({ vorlageId }: { vorlageId: string }) {
  const [daten, setDaten] = useState<EditorDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    let lebt = true;
    void holeJson<EditorDaten>(`/api/fulfillment/editor?v=${encodeURIComponent(vorlageId)}`).then(a => { if (!lebt) return; if (a.ok) setDaten(a.j as EditorDaten); else setFehler(fehlerText(a)); });
    return () => { lebt = false; };
  }, [vorlageId]);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  return <EditorAnsicht start={daten} />;
}

/** Der Editor mit seinen Daten (Auswahl, Verlauf, Schreiben). `handy` nur für Tests (sonst die Bildschirmbreite). */
export function EditorAnsicht({ start, handy: handyFest, ansicht: ansichtFest }: { start: EditorDaten; handy?: boolean; ansicht?: EditorAnsichtArt }) {
  const router = useRouter();
  const handyMedien = useHandy();
  const handy = handyFest ?? handyMedien;
  const { bestaetigen, dialog } = useRueckfrage();
  const [d, setD] = useState<EditorDaten>(start);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [wahl, setWahl] = useState<{ phase: string | null; knoten: string | null }>({ phase: null, knoten: null });
  const [verlauf, setVerlauf] = useState<{ zurueck: GeschichteEintrag[]; vor: GeschichteEintrag[] }>({ zurueck: [], vor: [] });
  const [laeuft, setLaeuft] = useState(false);
  const laeuftRef = useRef(false);
  const [bausteinZiel, setBausteinZiel] = useState<EditorZiel | null>(null);
  const [papierkorbAuf, setPapierkorbAuf] = useState(false);
  const [mehrFuer, setMehrFuer] = useState<string | null>(null);
  const [ansicht, setAnsichtRoh] = useState<EditorAnsichtArt>(ansichtFest ?? 'fluss');
  const [bausteinRueckruf, setBausteinRueckruf] = useState<((b: { id: string; titel: string; art: string }) => void) | null>(null);
  useEffect(() => {
    if (ansichtFest) return;
    try { const m = window.localStorage.getItem(MERKER_ANSICHT); if (m === 'fluss' || m === 'flaeche') setAnsichtRoh(m); } catch { /* privates Fenster */ }
  }, [ansichtFest]);
  const setAnsicht = (a: EditorAnsichtArt) => { setAnsichtRoh(a); try { window.localStorage.setItem(MERKER_ANSICHT, a); } catch { /* privates Fenster */ } };
  /** Neu lesen (nach „Mehr Angaben …“, das über den Baum-Weg schreibt) — Auswahl und Verlauf bleiben. */
  const neuLaden = useCallback(async () => {
    const a = await holeJson<EditorDaten>(`/api/fulfillment/editor?v=${encodeURIComponent(d.vorlage.id)}`);
    if (a.ok) setD(a.j as EditorDaten); else setMeldung({ text: fehlerText(a), art: 'kritisch' });
  }, [d.vorlage.id]);
  const titelEl = useRef<HTMLInputElement | null>(null);
  const titelFokus = useRef(false);
  const darf = d.darfBearbeiten;
  const modell = editorModell(d.vorlage, d.bausteine);
  const phase: EditorPhase | null = modell.phasen.find(p => p.id === wahl.phase) ?? modell.phasen[0] ?? null;
  const alle = phase ? phase.abschnitte.flatMap(a => a.knoten) : [];
  const knoten = wahl.knoten ? alle.find(k => k.id === wahl.knoten) ?? null : null;
  const gruppe = phase && wahl.knoten ? phase.abschnitte.find(a => a.gruppeId === wahl.knoten) : undefined;
  const abstimmungGewaehlt = !!phase && wahl.knoten === `fg-${phase.id}`;
  useEffect(() => { if (titelFokus.current && titelEl.current) { titelFokus.current = false; titelEl.current.focus(); titelEl.current.select(); } });

  /** Ops schicken (Stand der ganzen Vorlage). `modus`: neu = in den Verlauf; rueck/wieder = aus dem Verlauf. */
  const senden = useCallback(async (ops: EditorOp[], modus: 'neu' | 'rueck' | 'wieder' = 'neu'): Promise<boolean> => {
    if (laeuftRef.current || !ops.length) return false;
    laeuftRef.current = true; setLaeuft(true);
    const g = modus === 'neu' ? geschichteFuer(d.vorlage, ops) : null;
    const a = await holeJson<{ vorlage?: ProzessVorlage; stand?: string }>('/api/fulfillment/editor', { method: 'PATCH', body: JSON.stringify({ vorlageId: d.vorlage.id, stand: d.stand, ops }) });
    laeuftRef.current = false; setLaeuft(false);
    if (a.ok && a.j.vorlage && a.j.stand) {
      setD(x => ({ ...x, vorlage: a.j.vorlage!, stand: a.j.stand! }));
      if (modus === 'neu') setVerlauf(v => ({ zurueck: g ? [...v.zurueck, g].slice(-100) : [], vor: [] }));
      setMeldung(g || modus !== 'neu' ? null : { text: 'Gespeichert — dieser Schritt lässt sich nicht zurücknehmen.', art: 'achtung' });
      geaendert();
      return true;
    }
    if (a.status === 409 && a.j.vorlage && a.j.stand) {
      setD(x => ({ ...x, vorlage: a.j.vorlage!, stand: a.j.stand! }));
      setVerlauf({ zurueck: [], vor: [] });
      setMeldung({ text: `${fehlerText(a)} Die aktuelle Fassung steht jetzt da — Rückgängig beginnt neu.`, art: 'achtung' });
      return false;
    }
    setMeldung({ text: fehlerText(a), art: 'kritisch' });
    return false;
  }, [d.vorlage, d.stand]);

  const rueckgaengig = useCallback(async () => {
    const e = verlauf.zurueck.at(-1);
    if (!e) return;
    if (await senden(e.rueck, 'rueck')) setVerlauf(v => ({ zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, e] }));
  }, [verlauf, senden]);
  const wiederholen = useCallback(async () => {
    const e = verlauf.vor.at(-1);
    if (!e) return;
    if (await senden(e.wieder, 'wieder')) setVerlauf(v => ({ zurueck: [...v.zurueck, e], vor: v.vor.slice(0, -1) }));
  }, [verlauf, senden]);

  // ⌘Z / Strg+Z = Rückgängig, ⇧⌘Z / Strg+Y = Wiederholen — nicht, solange in einem Eingabefeld geschrieben wird.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); void rueckgaengig(); }
      else if (mod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) { e.preventDefault(); void wiederholen(); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [rueckgaengig, wiederholen]);

  const waehle = (p: string, k: string | null, titel = false) => { setWahl({ phase: p, knoten: k }); if (titel) titelFokus.current = true; };
  const fokusKnoten = (id: string) => { if (typeof document !== 'undefined') document.querySelector<HTMLElement>(`[data-ff-knoten="${id}"]`)?.focus(); };

  // ── Einfügen, Verschieben, Löschen ──
  const zielFuerEinfuegen = (): EditorZiel | null => {
    if (!phase) return null;
    if (knoten) return { phaseId: phase.id, nach: knoten.id };
    if (gruppe?.gruppeId) return { phaseId: phase.id, inGruppe: gruppe.gruppeId };
    return { phaseId: phase.id };
  };
  const neuerKnoten = async (form: KnotenForm, ziel: EditorZiel, baustein?: { id: string; titel: string }) => {
    const id = neueKennung('fk');
    const ops: EditorOp[] = [{ op: 'schritt-neu', id, ziel, form, titel: baustein ? baustein.titel.slice(0, 120) : FORM_VORGABE[form] }];
    if (baustein) ops.push({ op: 'baustein-dazu', id: neueKennung('fk'), schrittId: id, bausteinId: baustein.id });
    if (await senden(ops)) waehle(ziel.phaseId, id, !baustein);
  };
  const einfuegen = (form: KnotenForm | 'baustein', ziel = zielFuerEinfuegen()) => {
    if (!ziel) return;
    if (form === 'baustein') setBausteinZiel(ziel); else void neuerKnoten(form, ziel);
  };
  /** Einen Schritt um eins verschieben (Tastatur/Knöpfe): über die Grenze eines Abschnitts hinweg schließt er sich dem Nachbarn an. */
  const schritt = (k: EditorKnoten, richtung: -1 | 1) => {
    if (!phase) return;
    const reihe = flacheSchritte(phase);
    const i = reihe.findIndex(x => x.knoten.id === k.id);
    const n = reihe[i + richtung];
    if (i < 0 || !n) return;
    const gleich = n.abschnitt === reihe[i].abschnitt;
    const ziel: EditorZiel = richtung < 0 ? (gleich ? { phaseId: phase.id, vor: n.knoten.id } : { phaseId: phase.id, nach: n.knoten.id }) : (gleich ? { phaseId: phase.id, nach: n.knoten.id } : { phaseId: phase.id, vor: n.knoten.id });
    void senden([{ op: 'schritt-schieben', id: k.id, ziel }]).then(ok => { if (ok) setTimeout(() => fokusKnoten(k.id), 0); });
  };
  const loeschen = async (id: string, art: 'phase' | 'gruppe' | 'schritt' | 'baustein') => {
    if (art === 'phase' || art === 'gruppe') {
      const p = modell.phasen.find(x => x.id === id);
      const n = art === 'phase' ? p?.schritte ?? 0 : phase?.abschnitte.find(a => a.gruppeId === id)?.knoten.length ?? 0;
      const titel = art === 'phase' ? p?.titel : phase?.abschnitte.find(a => a.gruppeId === id)?.titel;
      if (!(await bestaetigen({ titel: `„${titel ?? ''}“ löschen?`, text: `${n ? `Mit ${n} Schritt${n === 1 ? '' : 'en'}. ` : ''}Liegt danach 30 Tage im Papierkorb dieses Ablaufs und lässt sich zurückholen; laufende Fälle behalten ihre Kopie.`, ja: 'In den Papierkorb', gefahr: true }))) return;
    }
    if (await senden([{ op: 'weg', id }])) {
      if (art === 'phase') setWahl({ phase: null, knoten: null }); else if (art !== 'baustein' && phase) setWahl({ phase: phase.id, knoten: null });
      setMeldung({ text: 'In den Papierkorb gelegt — „Rückgängig“ holt es zurück.', art: 'gut' });
    }
  };
  const phaseSchieben = (p: EditorPhase, richtung: -1 | 1) => {
    const i = modell.phasen.findIndex(x => x.id === p.id);
    const j = i + richtung;
    if (j < 0 || j >= modell.phasen.length) return;
    const ohne = modell.phasen.filter(x => x.id !== p.id);
    const nach = j === 0 ? null : ohne[j - 1].id;
    void senden([{ op: 'phase-schieben', id: p.id, nach }]);
  };
  const phaseNeu = async (nach?: string) => {
    const id = neueKennung('fk');
    if (await senden([{ op: 'phase-neu', id, titel: 'Neue Phase', ...(nach !== undefined ? { nach } : {}) }])) waehle(id, null, true);
  };

  const api: EditorApi = {
    darf, laeuft, bausteine: d.bausteine, neueId: () => neueKennung('fk'),
    tun: async (ops, o) => { const ok = await senden(ops); if (ok && o?.waehle) setWahl(o.waehle); return ok; },
    einfuegen: f => einfuegen(f), schritt, loeschen: (id, art) => void loeschen(id, art), phaseSchieben, phaseNeu: nach => void phaseNeu(nach),
    mehr: id => setMehrFuer(id),
  };
  const mehrKnoten = mehrFuer ? d.vorlage.knoten.find(x => x.id === mehrFuer) : undefined;

  // ── Ziehen ──
  const pruefen = (q: ZiehQuelle, z: ZiehZiel): string | null => {
    if (q.art === 'phase') return z.art === 'phase' ? null : 'Phasen ordnet man in der Reise um.';
    if (z.art === 'phase') return 'Hier ordnet man Phasen um — Schritte gehören in den Fluss.';
    if (z.art === 'nein' && q.art === 'neu' && q.form !== 'erinnerung') return 'Auf den Nein-Zweig passt eine Erinnerung.';
    return null;
  };
  const ablegen = (q: ZiehQuelle, z: ZiehZiel) => {
    if (q.art === 'phase') { if (z.art === 'phase') void senden([{ op: 'phase-schieben', id: q.id, nach: z.nach }]); return; }
    if (z.art === 'nein') {
      if (q.art === 'neu') { const id = neueKennung('fk'); void senden([{ op: 'nein-erinnerung', id, entscheidungId: z.entscheidungId }]).then(ok => { if (ok && phase) waehle(phase.id, id, true); }); }
      else void senden([{ op: 'zweig', id: z.entscheidungId, nein: q.id }]);
      return;
    }
    const ziel: EditorZiel | null = z.art === 'fluss' ? z.ziel : z.art === 'in-phase' ? { phaseId: z.phaseId } : null;
    if (!ziel) return;
    if (q.art === 'neu') einfuegen(q.form, ziel);
    else void senden([{ op: 'schritt-schieben', id: q.id, ziel }]).then(ok => { if (ok) waehle(ziel.phaseId, q.id); });
  };
  const zieh = useEditorZiehen({ pruefen, ablegen, aus: !darf || laeuft });

  // ── Tastatur an Knoten und Phasen ──
  const tasten = (k: EditorKnoten) => (e: RKeyboardEvent<HTMLElement>) => {
    if (!phase) return;
    const reihe = flacheSchritte(phase).map(x => x.knoten.id);
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); if (darf) schritt(k, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const n = reihe[reihe.indexOf(k.id) + (e.key === 'ArrowUp' ? -1 : 1)];
      if (n) { fokusKnoten(n); setWahl({ phase: phase.id, knoten: n }); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && darf) { e.preventDefault(); void loeschen(k.id, 'schritt'); return; }
    if (e.key === 'Enter') { e.preventDefault(); waehle(phase.id, k.id, darf); return; }
    if ((e.key === 'Insert' || e.key === '+') && darf) { e.preventDefault(); waehle(phase.id, k.id); setTimeout(() => document.getElementById('ff-editor-einfuegen')?.focus(), 0); }
  };
  const phasenTasten = (p: EditorPhase) => (e: RKeyboardEvent<HTMLElement>) => {
    const i = modell.phasen.findIndex(x => x.id === p.id);
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); if (darf) phaseSchieben(p, e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const n = modell.phasen[i + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (n) { document.querySelector<HTMLElement>(`[data-ff-phase-pille="${n.id}"]`)?.focus(); waehle(n.id, null); }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && darf) { e.preventDefault(); void loeschen(p.id, 'phase'); return; }
    if (e.key === 'Enter') { e.preventDefault(); waehle(p.id, null, darf); }
  };

  const papierkorb = modell.papierkorb;
  const feld = !phase ? <LeerFeld darf={darf} />
    : knoten ? <SchrittFeld modell={modell} phase={phase} k={knoten} api={api} titelRef={el => { titelEl.current = el; }} />
      : abstimmungGewaehlt ? <PhasenFeld modell={modell} phase={phase} api={api} nurAbstimmung />
        : gruppe?.gruppeId ? <GruppenFeld gruppe={{ id: gruppe.gruppeId, titel: gruppe.titel ?? '' }} api={api} />
          : <PhasenFeld modell={modell} phase={phase} api={api} titelRef={el => { titelEl.current = el; }} />;
  const iPhase = phase ? modell.phasen.findIndex(p => p.id === phase.id) : -1;

  return (
    <div className="ff-editor" data-ff-editor>
      {/* Kopf: zurück, Titel des Ablaufs, Rückgängig/Wiederholen — und EIN Satz, was die Änderung bewirkt. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <Knopf leise style={K44} onClick={() => router.push(WEG.fulfillment())}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} aria-hidden />Landkarte</span></Knopf>
        <div style={{ display: 'flex', gap: 6 }}>
          <Knopf leise style={K44} aus={!darf || laeuft || !verlauf.zurueck.length} onClick={rueckgaengig} ariaLabel="Rückgängig (⌘Z)" titel="Rückgängig (⌘Z / Strg+Z)"><Undo2 size={16} aria-hidden /></Knopf>
          <Knopf leise style={K44} aus={!darf || laeuft || !verlauf.vor.length} onClick={wiederholen} ariaLabel="Wiederholen (⇧⌘Z)" titel="Wiederholen (⇧⌘Z / Strg+Y)"><Redo2 size={16} aria-hidden /></Knopf>
        </div>
      </div>
      <Karte i={0} flach>
        <Ueberschrift rechts={<span>Fassung {d.vorlage.fassung}</span>}>
          {darf
            ? <input key={`${d.vorlage.id}:${d.vorlage.titel}`} defaultValue={d.vorlage.titel} aria-label="Titel des Ablaufs" disabled={laeuft}
              onBlur={e => { const t = e.target.value.trim(); if (t && t !== d.vorlage.titel) void senden([{ op: 'titel', titel: t }]); else e.target.value = d.vorlage.titel; }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: C.ink, background: 'none', border: `1px solid transparent`, borderRadius: ECKE.eingabe, padding: '4px 6px', minHeight: ZIEL_PX, width: '100%', boxSizing: 'border-box' }} />
            : d.vorlage.titel}
        </Ueberschrift>
        <div style={klein}>
          Änderungen gelten für neue Fälle{d.laufend ? ` — ${d.laufend === 1 ? 'der laufende Fall zeigt' : `die ${d.laufend} laufenden Fälle zeigen`} „Vorlage geändert“ und übernimmt sie erst per Klick` : ''}.
        </div>
        {!darf && <Hinweis art="info">Nur ansehen — Abläufe bearbeiten volle Mitglieder.</Hinweis>}
        <Meldung text={meldung?.text ?? null} art={meldung?.art} />
        <WahlKnoepfe label="Ansicht des Ablaufs" liste={[{ id: 'fluss' as const, label: handy ? 'Liste' : 'Fluss' }, { id: 'flaeche' as const, label: handy ? 'Fläche (ansehen)' : 'Fläche' }]} aktiv={ansicht} onWahl={setAnsicht} />
        {handy || ansicht === 'flaeche' ? null : (
          <ReiseBild spalten={editorSpalten(modell)} aktiv={phase?.id ?? null} gewaehlt={wahl.knoten} label="Phasen des Ablaufs — bearbeiten"
            onPhase={id => waehle(id, null)} onKaestchen={(p, k) => waehle(p, k)}
            griff={id => {
              const p = modell.phasen.find(x => x.id === id)!;
              const vorher = modell.phasen[modell.phasen.findIndex(x => x.id === id) - 1]?.id ?? '';
              return { 'data-ff-ziel': 'phase', 'data-ff-id': id, 'data-ff-titel': p.titel, 'data-ff-vorher': vorher, 'data-ff-phase-pille': id, onKeyDown: phasenTasten(p),
                'aria-keyshortcuts': darf ? 'ArrowLeft ArrowRight Alt+ArrowLeft Alt+ArrowRight Delete Enter' : 'ArrowLeft ArrowRight Enter', ...(darf ? zieh.griff({ art: 'phase', id, titel: p.titel }) : {}) };
            }}
            rauteSchalter={id => {
              const p = modell.phasen.find(x => x.id === id)!;
              const an = !!p.abstimmung;
              const label = an ? `Abstimmungspunkt am Ende von „${p.titel}“ — bearbeiten` : `Abstimmungspunkt am Ende von „${p.titel}“ einfügen`;
              if (!an && !darf) return <span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.bedien }}>›</span>;
              return (
                <button type="button" className="fassbar" aria-label={label} title={label} disabled={laeuft}
                  onClick={() => (an ? waehle(id, `fg-${id}`) : void senden([{ op: 'abstimmung', phaseId: id, an: true }]).then(ok => { if (ok) waehle(id, `fg-${id}`); }))}
                  style={{ width: ZIEL_PX, height: ZIEL_PX, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: an ? 1 : 0.55 }}>
                  {an ? <FreigabeRaute gegeben={false} aktiv={abstimmungGewaehlt && phase?.id === id} groesse={14} />
                    : <span style={{ display: 'inline-block', width: 12, height: 12, transform: 'rotate(45deg)', border: `1.5px dashed ${C.inkDim}`, borderRadius: 2 }} />}
                </button>
              );
            }}
            ende={darf ? (
              <Knopf leise style={K44} aus={laeuft} onClick={() => void phaseNeu()}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Plus size={14} aria-hidden />Phase</span></Knopf>
            ) : undefined} />
        )}
      </Karte>

      {ansicht === 'flaeche' ? (
        <EditorFlaeche vorlage={d.vorlage} bausteine={d.bausteine} darf={darf} laeuft={laeuft} handy={handy} senden={ops => senden(ops)}
          gewaehlt={wahl.knoten} onWahl={(p, k) => waehle(p, k)} meldung={(text, art) => setMeldung({ text, art })}
          bausteinWaehlen={fertig => setBausteinRueckruf(() => fertig)} loeschenPhase={id => void loeschen(id, 'phase')}
          feld={handy ? undefined : feld} zurListe={id => { setAnsicht('fluss'); if (id) { const p = modell.phasen.find(x => x.abschnitte.some(a => a.knoten.some(k => k.id === id))); if (p) waehle(p.id, id); } }} />
      ) : handy ? (
        <EditorListe modell={modell} phase={phase} gewaehlt={wahl.knoten} api={api} onPhase={id => waehle(id, null)} onKnoten={(p, k) => waehle(p, k)} feld={feld} />
      ) : !modell.phasen.length ? (
        <Karte i={1}>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
            <span style={klein}>Dieser Ablauf hat noch keine Phase — leg die erste an.</span>
            {darf && <Knopf haupt style={K44} onClick={() => void phaseNeu()}>+ Erste Phase</Knopf>}
          </div>
        </Karte>
      ) : phase && (
        <div className="ff-editor-raster">
          {darf ? (
            <div className="ff-editor-palette" role="toolbar" aria-label="Palette — ziehen oder antippen">
              <span style={{ ...MIKRO, alignSelf: 'center' }}>Palette</span>
              {PALETTE.map(f => {
                const titel = f === 'baustein' ? 'Baustein' : FORM_TITEL[f];
                return (
                  <button key={f} type="button" className="fassbar" disabled={laeuft} {...zieh.griff({ art: 'neu', form: f, titel: f === 'baustein' ? 'Baustein' : FORM_VORGABE[f] })}
                    id={f === 'schritt' ? 'ff-editor-einfuegen' : undefined}
                    onClick={() => einfuegen(f)} aria-label={`${titel} einfügen${knoten ? ` nach „${knoten.titel}“` : ` am Ende von „${phase.titel}“`} — oder in den Fluss ziehen`}
                    style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minHeight: ZIEL_PX, padding: '6px 12px', borderRadius: f === 'erinnerung' ? 18 : 8, cursor: 'grab', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, textAlign: 'left',
                      ...FLAECHE_STIL.flach, border: `1px solid ${RAND.flaeche}` }}>
                    {f === 'baustein' ? <span aria-hidden style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${LEUCHT.planung}` }} />
                      : f === 'entscheidung' ? <FreigabeRaute gegeben={false} groesse={10} /> : f === 'schritt' ? <span aria-hidden style={{ width: 13, height: 10, borderRadius: 2, border: `1.5px solid ${LEUCHT.gut}` }} /> : <FormZeichen form={flussFormVon(f)} />}
                    {titel}
                  </button>
                );
              })}
            </div>
          ) : <div />}
          <Karte i={1} id="ff-editor-fluss">
            <Ueberschrift rechts={<span>{phase.schritte} Schritt{phase.schritte === 1 ? '' : 'e'}</span>}>Phase {phase.nr} · {phase.titel}</Ueberschrift>
            <EditorFluss phase={phase} vorige={modell.phasen[iPhase - 1]} naechste={modell.phasen[iPhase + 1]} gewaehlt={abstimmungGewaehlt ? `fg-${phase.id}` : wahl.knoten} darf={darf}
              onWahl={id => waehle(phase.id, id)} griff={zieh.griff} tasten={tasten}
              onNeinNeu={eid => { const id = neueKennung('fk'); void senden([{ op: 'nein-erinnerung', id, entscheidungId: eid }]).then(ok => { if (ok) waehle(phase.id, id, true); }); }}
              onGruppe={gid => waehle(phase.id, gid)} onAbstimmung={() => waehle(phase.id, `fg-${phase.id}`)}
              {...(modell.phasen[iPhase + 1] ? { onNaechste: () => waehle(modell.phasen[iPhase + 1].id, null) } : {})} />
            <FormenLegende zustaende={false} />
          </Karte>
          <div className="ff-editor-feld" style={{ display: 'grid', gap: 14, minWidth: 0 }}>{feld}</div>
        </div>
      )}

      {(bausteinZiel || bausteinRueckruf) && (
        <Karte i={2}>
          <Ueberschrift rechts={<Knopf leise style={K44} onClick={() => { setBausteinZiel(null); setBausteinRueckruf(null); }}>Abbrechen</Knopf>}>Baustein aus der Bibliothek</Ueberschrift>
          {d.bausteine.length ? (
            <div role="listbox" aria-label="Baustein wählen" style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {d.bausteine.map(b => (
                <button key={b.id} type="button" role="option" aria-selected={false} className="fassbar" disabled={laeuft}
                  onClick={() => {
                    if (bausteinRueckruf) { const r = bausteinRueckruf; setBausteinRueckruf(null); r(b); return; }
                    const z = bausteinZiel; setBausteinZiel(null); if (z) void neuerKnoten(formFuerBaustein(b.art), z, b);
                  }}
                  style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: ZIEL_PX, padding: '6px 12px', borderRadius: 8, border: `1px solid ${RAND.flaeche}`, background: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{b.titel}</span><span style={{ color: C.inkLeise }}>{b.art}</span>
                </button>
              ))}
            </div>
          ) : <div style={klein}>Die Bibliothek ist noch leer — Bausteine legst du unter Fulfillment › Bausteine an.</div>}
        </Karte>
      )}

      {papierkorb.length > 0 && (
        <Klappbar id="ff-editor-papierkorb" titel={`Papierkorb (${papierkorb.length})`} offen={papierkorbAuf} umschalten={() => setPapierkorbAuf(!papierkorbAuf)}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {papierkorb.map(e => (
              <li key={e.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: ZIEL_PX }}>
                <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: TYP.bedien, color: C.ink }}>{e.titel}<span style={{ color: C.inkLeise }}> · {e.art === 'phase' ? 'Phase' : e.art === 'gruppe' ? 'Teilprozess' : e.art === 'baustein' ? 'Baustein' : 'Schritt'}{e.wo ? ` in „${e.wo}“` : ''} · bis {e.bis.slice(8, 10)}.{e.bis.slice(5, 7)}.</span></span>
                {darf && <Knopf leise style={K44} aus={laeuft} onClick={() => void senden([{ op: 'zurueck', id: e.id }])}>Zurückholen</Knopf>}
                {darf && <Knopf leise style={K44} aus={laeuft} onClick={async () => { if (await bestaetigen({ titel: `„${e.titel}“ endgültig löschen?`, text: 'Das lässt sich nicht zurücknehmen. Laufende Fälle behalten ihre Kopie.', ja: 'Endgültig löschen', gefahr: true })) await senden([{ op: 'papierkorb-leeren', id: e.id }]); }}>Endgültig löschen</Knopf>}
              </li>
            ))}
          </ul>
        </Klappbar>
      )}
      {mehrKnoten && (
        // Das vorhandene Formular (Ziel, Warum, Eingang, Ergebnis, Kennzahl, Rolle, Dauer, Aufwand, Ort) — schreibt über den Baum-Weg; danach neu lesen.
        <KnotenFormular vorlage={d.vorlage} knoten={{ ...mehrKnoten, stand: '' }} bausteine={[]} onZu={() => { setMehrFuer(null); void neuLaden(); }} />
      )}
      {zieh.anzeige}
      {dialog}
    </div>
  );
}


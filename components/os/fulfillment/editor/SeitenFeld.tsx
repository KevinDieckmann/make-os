'use client';

// ─── Fulfillment · Prozess-Editor — das kleine Feld neben dem Fluss (17.10.) ───────────────────────────────────────────────────────────────
// Ein Knoten angetippt → hier: Titel (kurz, 2–6 Wörter), Art (die Form), Frist in Tagen, Verantwortung (intern · Kunde · beide), für den Kunden sichtbar,
// Bausteine aus der Bibliothek, bei einer Entscheidung „ja führt zu …“ und der Nein-Zweig, bei einer Erinnerung „danach zurück / weiter“ — und die
// Tastatur-Alternativen zum Ziehen: nach oben/unten, „Einfügen nach …“, in eine andere Phase, löschen. Eine Phase angetippt → Titel, Sichtbarkeit,
// Abstimmungspunkt am Ende (an/aus, Titel, wer), links/rechts, „+ Phase danach“, löschen (mit Rückfrage, in den Papierkorb). Alle Ziele ≥ 44 px.
// Schreibt nur über `api` (ProzessEditor → PATCH /api/fulfillment/editor); rechnet nichts.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, Plus } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Schalter, Hinweis, auswahl } from '../../ui';
import { KNOTEN_FORMEN } from '@/lib/fulfillment/lesen';
import { FORM_TITEL, FRIST_MAX, VERSUCHE_MIN, VERSUCHE_MAX, type EditorKnoten, type EditorModell, type EditorOp, type EditorPhase } from '@/lib/fulfillment/prozesse/editor';
import { VERSUCHE_VORGABE } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { flussFormVon } from '@/lib/fulfillment/prozesse/reise-bild';
import type { KnotenForm, Zustaendig } from '@/lib/fulfillment/typen';
import { FormZeichen } from '../../ui/reise/ReiseBild';
import { TextFeld, klein } from '../prozesse/teile';
import { flacheSchritte } from './bild';

/** Mindesthöhe jedes Bedienziels im Editor. */
export const ZIEL_PX = 44;
export const K44: CSSProperties = { minHeight: ZIEL_PX };
const wahlStil: CSSProperties = { ...auswahl, minHeight: ZIEL_PX, width: '100%', fontSize: 16 };
const ZUST: { id: Zustaendig; label: string }[] = [{ id: 'intern', label: 'intern' }, { id: 'kunde', label: 'Kunde' }, { id: 'beide', label: 'beide' }];

export interface EditorApi {
  darf: boolean; laeuft: boolean;
  tun: (ops: EditorOp[], o?: { waehle?: { phase: string; knoten: string | null } }) => Promise<boolean>;
  einfuegen: (form: KnotenForm | 'baustein') => void;
  schritt: (k: EditorKnoten, richtung: -1 | 1) => void;
  loeschen: (id: string, art: 'phase' | 'gruppe' | 'schritt' | 'baustein') => void;
  phaseSchieben: (p: EditorPhase, richtung: -1 | 1) => void;
  phaseNeu: (nach?: string) => void;
  bausteine: readonly { id: string; titel: string; art: string }[];
  neueId: () => string;
  /** Weitere Angaben des Knotens (Ziel, Warum, Ergebnis, Kennzahl, Dauer, Ort …) im vorhandenen Formular. */
  mehr: (id: string) => void;
}

/** Eine Reihe Wahl-Knöpfe (Rolle radio) — 44 px hoch, mit Text (nie nur Farbe). */
export function WahlKnoepfe<T extends string>({ liste, aktiv, onWahl, aus, label }: { liste: { id: T; label: ReactNode }[]; aktiv: T | null; onWahl: (id: T) => void; aus?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {liste.map(x => {
        const an = x.id === aktiv;
        return (
          <button key={x.id} type="button" role="radio" aria-checked={an} disabled={aus} onClick={() => onWahl(x.id)} className="fassbar"
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minHeight: ZIEL_PX, padding: '6px 12px', borderRadius: ECKE.eingabe, cursor: aus ? 'default' : 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
              color: an ? C.ink : C.inkDim, background: an ? TIEF.flaeche(C.aktiv) : 'transparent', border: `1px solid ${an ? TIEF.rand(C.aktiv) : RAND.flaeche}` }}>{x.label}</button>
        );
      })}
    </div>
  );
}

const Feld = ({ label, children, hinweis }: { label: string; children: ReactNode; hinweis?: ReactNode }) => (
  <div style={{ display: 'grid', gap: 4 }}><span style={MIKRO}>{label}</span>{children}{hinweis && <span style={{ ...klein, color: C.inkLeise }}>{hinweis}</span>}</div>
);
const woerter = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const SymbolText = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{icon}{children}</span>;

/** „Einfügen nach …“ — die Palette als Menü (Tastatur-Alternative zum Ziehen). */
export function EinfuegenMenue({ api, onZu }: { api: EditorApi; onZu: () => void }) {
  return (
    <div role="menu" aria-label="Einfügen" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {[...KNOTEN_FORMEN.filter(f => f !== 'abstimmung'), 'baustein' as const].map(f => (
        <button key={f} type="button" role="menuitem" className="fassbar" onClick={() => { onZu(); api.einfuegen(f); }} disabled={api.laeuft}
          style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minHeight: ZIEL_PX, padding: '6px 12px', borderRadius: ECKE.eingabe, border: `1px solid ${RAND.flaeche}`, background: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer' }}>
          {f !== 'baustein' && f !== 'schritt' && <FormZeichen form={flussFormVon(f)} />}{f === 'baustein' ? 'Baustein …' : FORM_TITEL[f]}
        </button>
      ))}
    </div>
  );
}

/** Das Feld eines Schritts. */
export function SchrittFeld({ modell, phase, k, api, titelRef }: { modell: EditorModell; phase: EditorPhase; k: EditorKnoten; api: EditorApi; titelRef?: (el: HTMLInputElement | null) => void }) {
  const [menue, setMenue] = useState(false);
  const aus = !api.darf || api.laeuft;
  const setze = (felder: Record<string, unknown>) => api.tun([{ op: 'schritt', id: k.id, ...felder }]);
  const schritte = flacheSchritte(phase).map(x => x.knoten).filter(x => x.id !== k.id);
  const alleSchritte = phase.abschnitte.flatMap(a => a.knoten);
  const reihe = flacheSchritte(phase).map(x => x.knoten.id);
  const i = reihe.indexOf(k.id);
  const entscheidung = k.neinVon ? alleSchritte.find(x => x.id === k.neinVon) : undefined;
  const titelFeld = (
    <input ref={titelRef} id="ff-feld-titel" key={`${k.id}:${k.titel}`} defaultValue={k.titel} disabled={aus} aria-label="Titel"
      onBlur={e => { const t = e.target.value.trim(); if (t && t !== k.titel) void setze({ titel: t }); else e.target.value = k.titel; }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { (e.target as HTMLInputElement).value = k.titel; (e.target as HTMLInputElement).blur(); } }}
      style={{ ...wahlStil, appearance: 'none', cursor: 'text' }} />
  );
  return (
    <Karte i={0} flach id="ff-editor-feld">
      <Ueberschrift>{FORM_TITEL[k.form]}</Ueberschrift>
      <Feld label="Titel" hinweis={woerter(k.titel) > 6 || woerter(k.titel) < 2 ? 'Am klarsten mit 2–6 Wörtern.' : '2–6 Wörter'}>{titelFeld}</Feld>
      <Feld label="Art">
        <WahlKnoepfe label="Art" aus={aus} aktiv={k.form} onWahl={f => void setze({ form: f })}
          liste={KNOTEN_FORMEN.map(f => ({ id: f, label: <SymbolText icon={f === 'schritt' ? null : <FormZeichen form={flussFormVon(f)} />}>{FORM_TITEL[f]}</SymbolText> }))} />
      </Feld>
      <Feld label="Frist (Tage nach dem Schritt davor)">
        <TextFeld key={`${k.id}:${k.frist ?? ''}`} wert={k.frist !== undefined ? String(k.frist) : ''} typ="number" aus={aus} platzhalter="ohne" label="Frist in Tagen"
          onFertig={t => { const n = t.trim() === '' ? null : Number(t); if (n === null || (Number.isInteger(n) && n >= 0 && n <= FRIST_MAX)) void setze({ frist: n }); }} />
      </Feld>
      {/* Ausführung (17.10. abends): wie oft die Erinnerung auf dem Nein-Pfad läuft, bevor der Punkt „eskaliert“ — leer = Vorgabe (5 Kontaktversuche). */}
      {k.form === 'erinnerung' && (
        <Feld label={`Versuche (${VERSUCHE_MIN}–${VERSUCHE_MAX})`} hinweis={`So oft wird erinnert, dann gilt der Punkt als eskaliert. Leer = ${VERSUCHE_VORGABE}.`}>
          <TextFeld key={`${k.id}:v:${k.versuche ?? ''}`} wert={k.versuche !== undefined ? String(k.versuche) : ''} typ="number" aus={aus} platzhalter={String(VERSUCHE_VORGABE)} label="Versuche"
            onFertig={t => { const n = t.trim() === '' ? null : Number(t); if (n === null || (Number.isInteger(n) && n >= VERSUCHE_MIN && n <= VERSUCHE_MAX)) void setze({ versuche: n }); }} />
        </Feld>
      )}
      <Feld label="Verantwortung">
        <WahlKnoepfe label="Verantwortung" aus={aus} aktiv={k.zustaendig ?? 'intern'} onWahl={z => { if (z !== (k.zustaendig ?? 'intern')) void setze({ zustaendig: z }); }} liste={ZUST} />
      </Feld>
      <Schalter an={k.kundeSichtbar === true} aus={aus} onChange={v => void setze({ kundeSichtbar: v })} erklaerung="fulfillment.kundeSichtbar">Für den Kunden sichtbar</Schalter>
      <Feld label="Bausteine aus der Bibliothek">
        {k.bausteine.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {k.bausteine.map(b => (
              <li key={b.knotenId} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: ZIEL_PX }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: C.ink, overflowWrap: 'break-word' }}>{b.titel}{b.art ? <span style={{ color: C.inkLeise }}> · {b.art}</span> : null}</span>
                {api.darf && <Knopf leise style={K44} ariaLabel={`„${b.titel}“ lösen`} aus={api.laeuft} onClick={() => api.loeschen(b.knotenId, 'baustein')}>×</Knopf>}
              </li>
            ))}
          </ul>
        )}
        {api.darf && api.bausteine.length > 0 && (
          <select aria-label="Baustein verknüpfen" value="" disabled={aus} style={wahlStil}
            onChange={e => { const id = e.target.value; if (id) void api.tun([{ op: 'baustein-dazu', id: api.neueId(), schrittId: k.id, bausteinId: id }]); }}>
            <option value="">+ Baustein verknüpfen …</option>
            {api.bausteine.filter(b => !k.bausteine.some(x => x.bausteinId === b.id)).map(b => <option key={b.id} value={b.id}>{b.titel} ({b.art})</option>)}
          </select>
        )}
        {!k.bausteine.length && !api.darf && <span style={klein}>keine</span>}
      </Feld>
      {k.form === 'entscheidung' && (
        <>
          <Feld label="Ja führt zu">
            <select aria-label="Ja führt zu" value={k.zweige?.ja ?? ''} disabled={aus} style={wahlStil} onChange={e => void api.tun([{ op: 'zweig', id: k.id, ja: e.target.value || null }])}>
              <option value="">weiter (nächster Schritt)</option>
              {schritte.map(s => <option key={s.id} value={s.id}>{s.titel}</option>)}
            </select>
          </Feld>
          <Feld label="Nein führt zu" hinweis="Typisch: eine Erinnerung, die zurück zur Entscheidung läuft.">
            <select aria-label="Nein führt zu" value={k.zweige?.nein ?? ''} disabled={aus} style={wahlStil}
              onChange={e => { const v = e.target.value; if (v === '+erinnerung') void api.tun([{ op: 'nein-erinnerung', id: api.neueId(), entscheidungId: k.id }]); else void api.tun([{ op: 'zweig', id: k.id, nein: v || null }]); }}>
              <option value="">— kein Nein-Zweig</option>
              {!k.zweige?.nein && <option value="+erinnerung">+ neue Erinnerung</option>}
              {alleSchritte.filter(s => s.id !== k.id && (!s.neinVon || s.neinVon === k.id)).map(s => <option key={s.id} value={s.id}>{s.titel}</option>)}
            </select>
          </Feld>
        </>
      )}
      {k.form === 'erinnerung' && entscheidung && (
        <Feld label="Danach">
          <WahlKnoepfe label="Danach" aus={aus} aktiv={k.zweige?.ja === entscheidung.id ? 'zurueck' : 'weiter'}
            onWahl={w => void api.tun([{ op: 'zweig', id: k.id, ja: w === 'zurueck' ? entscheidung.id : null }])}
            liste={[{ id: 'zurueck' as const, label: `zurück zu „${entscheidung.titel}“` }, { id: 'weiter' as const, label: 'weiter' }]} />
        </Feld>
      )}
      {api.darf && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={MIKRO}>Ohne Ziehen</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Knopf leise style={K44} aus={aus || i <= 0} onClick={() => api.schritt(k, -1)} titel="Alt + ↑"><SymbolText icon={<ArrowUp size={14} aria-hidden />}>Nach oben</SymbolText></Knopf>
            <Knopf leise style={K44} aus={aus || i < 0 || i >= reihe.length - 1} onClick={() => api.schritt(k, 1)} titel="Alt + ↓"><SymbolText icon={<ArrowDown size={14} aria-hidden />}>Nach unten</SymbolText></Knopf>
            <Knopf leise style={K44} aus={aus} onClick={() => setMenue(!menue)}><SymbolText icon={<Plus size={14} aria-hidden />}>Einfügen nach …</SymbolText></Knopf>
          </div>
          {menue && <EinfuegenMenue api={api} onZu={() => setMenue(false)} />}
          {modell.phasen.length > 1 && (
            <select aria-label="In eine andere Phase verschieben" value="" disabled={aus} style={wahlStil}
              onChange={e => { const p = e.target.value; if (p) void api.tun([{ op: 'schritt-schieben', id: k.id, ziel: { phaseId: p } }], { waehle: { phase: p, knoten: k.id } }); }}>
              <option value="">Verschieben nach Phase …</option>
              {modell.phasen.filter(p => p.id !== phase.id).map(p => <option key={p.id} value={p.id}>Phase {p.nr} · {p.titel}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Knopf leise style={K44} aus={aus} onClick={() => api.mehr(k.id)}>Mehr Angaben …</Knopf>
            <Knopf leise style={K44} aus={aus} onClick={() => api.loeschen(k.id, 'schritt')} titel="Entf"><SymbolText icon={<Trash2 size={14} aria-hidden />}>Löschen</SymbolText></Knopf>
          </div>
        </div>
      )}
    </Karte>
  );
}

/** Das Feld einer Phase (und ihres Abstimmungspunkts am Ende). */
export function PhasenFeld({ modell, phase, api, titelRef, nurAbstimmung }: { modell: EditorModell; phase: EditorPhase; api: EditorApi; titelRef?: (el: HTMLInputElement | null) => void; nurAbstimmung?: boolean }) {
  const aus = !api.darf || api.laeuft;
  const i = modell.phasen.findIndex(p => p.id === phase.id);
  const ab = phase.abstimmung;
  const abstimmung = (
    <div style={{ display: 'grid', gap: 8 }}>
      <Schalter an={!!ab} aus={aus} onChange={an => void api.tun([{ op: 'abstimmung', phaseId: phase.id, an }])} erklaerung="fulfillment.abstimmungAmEnde">Abstimmungspunkt am Ende der Phase</Schalter>
      {ab && (
        <>
          <Feld label={`Abstimmungspunkt${ab.nr ? ` ${ab.nr}` : ''} — Titel`}>
            <TextFeld key={`${ab.id}:${ab.titel}`} wert={ab.titel} aus={aus} label="Titel des Abstimmungspunkts" onFertig={t => { if (t.trim()) void api.tun([{ op: 'abstimmung', phaseId: phase.id, an: true, titel: t.trim() }]); }} />
          </Feld>
          <Feld label="Wer stimmt ab">
            <WahlKnoepfe label="Wer stimmt ab" aus={aus} aktiv={ab.wer} onWahl={w => void api.tun([{ op: 'abstimmung', phaseId: phase.id, an: true, wer: w }])} liste={ZUST} />
          </Feld>
        </>
      )}
    </div>
  );
  if (nurAbstimmung) return <Karte i={0} flach id="ff-editor-feld"><Ueberschrift>Abstimmungspunkt</Ueberschrift>{abstimmung}</Karte>;
  return (
    <Karte i={0} flach id="ff-editor-feld">
      <Ueberschrift>Phase {phase.nr}</Ueberschrift>
      <Feld label="Titel" hinweis="2–6 Wörter">
        <input ref={titelRef} id="ff-feld-titel" key={`${phase.id}:${phase.titel}`} defaultValue={phase.titel} disabled={aus} aria-label="Titel der Phase"
          onBlur={e => { const t = e.target.value.trim(); if (t && t !== phase.titel) void api.tun([{ op: 'phase', id: phase.id, titel: t }]); else e.target.value = phase.titel; }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={{ ...wahlStil, appearance: 'none', cursor: 'text' }} />
      </Feld>
      <Schalter an={phase.kundeSichtbar} aus={aus} onChange={v => void api.tun([{ op: 'phase', id: phase.id, kundeSichtbar: v }])} erklaerung="fulfillment.kundeSichtbar">Der Kunde sieht diese Phase</Schalter>
      {abstimmung}
      {api.darf && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Knopf leise style={K44} aus={aus || i <= 0} onClick={() => api.phaseSchieben(phase, -1)} titel="Alt + ←"><SymbolText icon={<ArrowLeft size={14} aria-hidden />}>Nach links</SymbolText></Knopf>
          <Knopf leise style={K44} aus={aus || i >= modell.phasen.length - 1} onClick={() => api.phaseSchieben(phase, 1)} titel="Alt + →"><SymbolText icon={<ArrowRight size={14} aria-hidden />}>Nach rechts</SymbolText></Knopf>
          <Knopf leise style={K44} aus={aus} onClick={() => api.phaseNeu(phase.id)}><SymbolText icon={<Plus size={14} aria-hidden />}>Phase danach</SymbolText></Knopf>
          <Knopf leise style={K44} aus={aus} onClick={() => api.mehr(phase.id)}>Mehr Angaben …</Knopf>
          <Knopf leise style={K44} aus={aus} onClick={() => api.loeschen(phase.id, 'phase')} titel="Entf"><SymbolText icon={<Trash2 size={14} aria-hidden />}>Phase löschen</SymbolText></Knopf>
        </div>
      )}
    </Karte>
  );
}

/** Das Feld eines Teilprozesses (Gruppe). */
export function GruppenFeld({ gruppe, api }: { gruppe: { id: string; titel: string }; api: EditorApi }) {
  const aus = !api.darf || api.laeuft;
  return (
    <Karte i={0} flach id="ff-editor-feld">
      <Ueberschrift>Teilprozess</Ueberschrift>
      <Feld label="Titel">
        <TextFeld key={`${gruppe.id}:${gruppe.titel}`} wert={gruppe.titel} aus={aus} label="Titel des Teilprozesses" onFertig={t => { if (t.trim()) void api.tun([{ op: 'gruppe', id: gruppe.id, titel: t.trim() }]); }} />
      </Feld>
      {api.darf && <Knopf leise style={K44} aus={aus} onClick={() => api.loeschen(gruppe.id, 'gruppe')}><SymbolText icon={<Trash2 size={14} aria-hidden />}>Teilprozess löschen</SymbolText></Knopf>}
    </Karte>
  );
}

/** Ohne Wahl: ein Satz, wie es geht. */
export function LeerFeld({ darf }: { darf: boolean }) {
  return (
    <Karte i={0} flach id="ff-editor-feld">
      <Ueberschrift>Bearbeiten</Ueberschrift>
      {darf
        ? <div style={klein}>Einen Knoten oder eine Phase antippen — hier stehen dann Titel, Art, Frist, Verantwortung und Sichtbarkeit.</div>
        : <Hinweis art="info">Nur ansehen — Abläufe bearbeiten volle Mitglieder.</Hinweis>}
    </Karte>
  );
}

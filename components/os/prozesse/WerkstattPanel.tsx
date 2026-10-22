'use client';

// ─── Prozesse · Werkstatt — das Panel rechts (Etappe B2, 21.10.; ANALYSE_100.md Punkte 8, 10, 22, 23, 55, 62; Kevins Bild der Werkstatt) ─────────────────────
// Klick auf einen Knoten öffnet rechts die Einstellungs-Maske aus dem Masken-Schema des Katalogs (lib/prozesse/baustein-katalog.ts), gesäubert und
// zurückgeschrieben über EINE Stelle (lib/prozesse/werkstatt-maske.ts). Dazu: Name (Verb + Gegenstand), Freigabe-Schloss (sichtbar, nicht entfernbar), beim Agenten
// die drei Andockpunkte (Modell · Gedächtnis · Werkzeuge) mit dem Rechte-Profil (Ampel „tödliches Dreieck“), die Ausgänge (wohin, wie beschriftet — dieselbe
// Verbindung wie das Ziehen, für Tastatur und Vorleser), die Befunde und Hinweise am Knoten, der Satz des Probelaufs. Ohne Auswahl: der Steckbrief des Prozesses
// (Name, Bereich, Fall, Eigner, Kriterien — Punkt 10). Phase, Faden und Zettel haben eigene, kurze Felder.

import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { Lock, Trash2, Copy, Scissors, ChevronsRightLeft, Plus } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, BEDEUTUNG_FARBE, MIKRO, TIEF } from '@/lib/make-one/design';
import { Ueberschrift, Hinweis, Knopf, Pillen, Feldzeile, auswahl as auswahlStil, Chip } from '../ui';
import {
  PROZESS_BEREICHE, FALL_ARTEN, ZETTEL_FARBEN, type Befund, type MaskenWert, type NotizZettel, type ProzessDefinition, type ProzessForm, type ProzessKnoten, type AgentWer,
} from '@/lib/prozesse/definition';
import { alleSchritte, phasen, schritteDer, type Ausgang } from '@/lib/prozesse/fluss';
import { katalogEintrag, klasseVonEintrag, platzhalterFuer, type AuswahlQuelle, type KatalogEintrag } from '@/lib/prozesse/baustein-katalog';
import { EREIGNIS_FELDER, FALL_FELDER, ausloeserFelder } from '@/lib/prozesse/ausloeser';
import { rautenFelder } from '@/lib/prozesse/definition-pruefen';
import { erlaubteWerkzeuge, rechteProfil } from '@/lib/prozesse/agent-schritt';
import { schlossText } from '@/lib/prozesse/schloss';
import { maskeWerte, maskeAnwenden, formWort } from '@/lib/prozesse/werkstatt-maske';
import { AUSGAENGE, ausgangName, type KanteLage } from '@/lib/prozesse/werkstatt-lage';
import { PROBE_NAME, PROBE_BEDEUTUNG, centText, type ProbeSchritt, type Rat } from '@/lib/prozesse/werkstatt-hinweise';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { ZETTEL_TON, WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import type { ModellOption } from '@/lib/prozesse/modell-wahl';
import { MaskenEingabe, TextFeld, type Option } from './WerkstattMaske';
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
      {befunde.map((b, i) => <Hinweis key={`b${i}`} art={ART[b.stufe]}>{b.text}</Hinweis>)}
      {raete.map((r, i) => (
        <Hinweis key={`r${i}`} art={r.art === 'warnung' ? 'achtung' : 'info'}
          aktion={r.aktion === 'teilprozess' && r.phaseId && onTeilprozess ? <Knopf leise onClick={() => onTeilprozess(r.phaseId!)}><span className="pz-knopf-inhalt"><Scissors size={14} aria-hidden />Teilprozess bilden</span></Knopf> : undefined}>
          {r.text}
        </Hinweis>
      ))}
    </div>
  );
}

const FELD_TITEL = new Map<string, string>([...EREIGNIS_FELDER, ...Object.values(FALL_FELDER).flat()].map(f => [f.id, f.titel]));
export const feldTitel = (id: string) => FELD_TITEL.get(id) ?? (id.startsWith('webhook.') ? `Webhook: ${id.slice(8)}` : id.startsWith('agent.') ? `Agent-Ausgabe: ${id.slice(6)}` : id);

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
  onSteckbrief: (felder: Record<string, unknown>) => void;
  onZweig: (von: string, ausgang: Ausgang, nach: string | null) => void;
  onPfeilText: (von: string, art: Ausgang, text: string | null) => void;
  onLoeschen: (ids: string[]) => void;
  onKopieren: () => void;
  onPhase: (aktion: 'umbenennen' | 'teilen' | 'zuklappen' | 'neu' | 'loeschen', id: string, wert?: string) => void;
  onZettel: (id: string, teil: Partial<Pick<NotizZettel, 'text' | 'farbe'>> | null) => void;
  agentName: (wer: AgentWer) => string;
  /** Zusatz unter der Maske eines Knotens (22.10.: die Webhook-Karte am Auslöser „Webhook von außen“). */
  knotenZusatz?: (k: K) => ReactNode;
}

/** Das Panel (siehe Kopf). */
export function WerkstattPanel(p: PanelProps) {
  if (p.knoten) return <KnotenPanel {...p} k={p.knoten} />;
  if (p.phase) return <PhasePanel {...p} ph={p.phase} />;
  if (p.kante) return <KantenPanel {...p} k={p.kante} />;
  if (p.zettel) return <ZettelPanel {...p} z={p.zettel} />;
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
      <Feldzeile label="Name *"><TextFeld label="Name" wert={d.titel} aus={p.nurLesen} platz="z. B. Lead nachfassen" onWert={v => p.onSteckbrief({ titel: v })} /></Feldzeile>
      <Feldzeile label="Beschreibung"><TextFeld label="Beschreibung" mehrzeilig wert={d.beschreibung ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ beschreibung: v || null })} /></Feldzeile>
      <Feldzeile label="Bereich (Kachel auf der Landkarte)">
        <Pillen liste={PROZESS_BEREICHE.map(b => ({ id: b.id, label: b.titel }))} aktiv={d.bereich ?? 'fulfillment'} onWahl={v => { if (!p.nurLesen) p.onSteckbrief({ bereich: v }); }} />
      </Feldzeile>
      <Feldzeile label="Woran hängt ein Lauf?">
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
      <Feldzeile label="Startkriterium — wann gehört ein Fall hinein?"><TextFeld label="Startkriterium" mehrzeilig wert={d.startKriterium ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ startKriterium: v || null })} /></Feldzeile>
      <Feldzeile label="Endkriterium — wann ist der Prozess erfüllt?"><TextFeld label="Endkriterium" mehrzeilig wert={d.endKriterium ?? ''} aus={p.nurLesen} onWert={v => p.onSteckbrief({ endKriterium: v || null })} /></Feldzeile>
      <BefundListe befunde={ohne} raete={p.raete.filter(r => !r.knotenId)} onTeilprozess={p.nurLesen ? undefined : id => p.onPhase('teilen', id)} />
      {!ohne.length && <p style={leise}>Einen Knoten anklicken öffnet seine Einstellungen. „+“ am Ausgang hängt den nächsten Baustein an.</p>}
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
  if (q === 'prozess') return l.filter(o => o.id !== p.d.id);
  return l;
}

function KnotenPanel(p: PanelProps & { k: K }) {
  const { k, d } = p;
  const e: KatalogEintrag | undefined = katalogEintrag(k.katalog?.id) ?? undefined;
  const S = symbolVon(k);
  const ton = WERKSTATT_FORM_FARBE[k.form ?? 'schritt'];
  const werte = e ? maskeWerte(k, e) : {};
  const setze = (id: string, v: MaskenWert) => { if (e && !p.nurLesen) p.onKnoten(maskeAnwenden(k, e, { ...werte, [id]: v }, { modelle: p.modelle })); };
  const schloss = d.knoten.find(x => x.schloss?.fuer === k.id);
  const fuer = k.schloss ? d.knoten.find(x => x.id === k.schloss!.fuer) : null;
  const befunde = p.befunde.filter(b => b.knotenId === k.id);
  const raete = p.raete.filter(r => r.knotenId === k.id);
  const probe = p.probe?.get(k.id);
  const titel = useRef<HTMLInputElement>(null);
  useEffect(() => { if (p.titelFokus) titel.current?.focus(); }, [p.titelFokus]);
  const andock = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (p.andock) andock.current?.querySelector(`[data-ws-abschnitt="${p.andock}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [p.andock, k.id]);
  // Felder für Bedingungen: am Auslöser die des Ereignisses bzw. Webhooks, sonst Fall + Webhook + Agenten-Ausgaben (wie die Prüfung).
  const felder: Option[] = useMemo(() => {
    const ids = k.form === 'ausloeser'
      ? ausloeserFelder(k.ausloeser ?? { art: e?.id === 'ausloeser.webhook' ? 'webhook' : 'ereignis' }, d.fallArt ?? 'mandat')
      : rautenFelder(d);
    return ids.map(id => ({ id, label: feldTitel(id) }));
  }, [k, e, d]);
  const platz = useMemo(() => platzhalterFuer(d.fallArt ?? 'mandat'), [d.fallArt]);
  const fehlerVon = (feldId: string) => befunde.find(b => b.feld === feldId && b.stufe !== 'hinweis')?.text;
  // „Nur öffentliche Angaben“ (Entscheidung 22.10. nachts): dann sind Akte und Brain aus — die Maske zeigt sie gesperrt auf „nein“ (so läuft es auch im Motor).
  const nurOeffentlich = k.form === 'agent' && werte.nurOeffentlich === true;
  const gesperrt = (id: string) => nurOeffentlich && (id === 'akte' || id === 'brain');
  const feld = (f: KatalogEintrag['maske'][number]) => (
    <MaskenEingabe key={f.id} f={f} wert={gesperrt(f.id) ? false : werte[f.id]} onWert={v => setze(f.id, v)} optionen={f.optionen ? f.optionen.map(o => ({ ...o })) : optionenFuer(f.quelle, p, k)}
      felder={felder} platzhalter={platz} fehler={fehlerVon(f.id)} aus={p.nurLesen || gesperrt(f.id)} />
  );
  // Agent: die Maske nach den drei Andockpunkten gruppiert (Modell · Gedächtnis · Werkzeuge), dazu das Rechte-Profil.
  const GRUPPE: Readonly<Record<string, 'modell' | 'gedaechtnis' | 'werkzeuge'>> = { modell: 'modell', modellWahl: 'modell', budgetCent: 'modell', nurOeffentlich: 'gedaechtnis', brain: 'gedaechtnis', akte: 'gedaechtnis', werkzeuge: 'werkzeuge' };
  const istAgent = k.form === 'agent' && e?.feld === 'agent';
  const profil = istAgent && k.agent ? rechteProfil(k.agent, {}) : null;
  const klasse = e ? klasseVonEintrag(e) : null;
  const ausgaenge = AUSGAENGE[k.form ?? 'schritt'];
  const phaseId = alleSchritte(d).find(x => x.schritt.id === k.id)?.phase.id;
  const ziele = phaseId ? schritteDer(d, phaseId).filter(x => x.id !== k.id && x.form !== 'ausloeser' && !x.schloss) : [];
  return (
    <div ref={andock} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span aria-hidden style={{ display: 'inline-flex', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: TIEF.flaeche(ton), border: `1px solid ${TIEF.rand(ton)}` }}><S width={20} height={20} color={ton} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...MIKRO }}>{e ? `${e.anbindung} · ${formWort(k.form)}` : formWort(k.form)}</div>
          <div style={{ fontSize: TYP.body, fontWeight: 650, color: C.ink, overflowWrap: 'anywhere' }}>{e?.name ?? k.titel}</div>
        </div>
      </div>
      {e?.satz && <p style={klein}>{e.satz}</p>}
      <Feldzeile label="Name (Verb + Gegenstand)">
        <TitelFeld eingabe={titel} wert={k.titel} aus={p.nurLesen || !!k.schloss} onWert={t => p.onKnoten({ ...k, titel: t })} />
      </Feldzeile>
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
      {/* Ausgänge: wohin, wie beschriftet — dasselbe wie einen Faden ziehen (Punkt 23: Rauten-Ausgänge immer benannt). */}
      {ausgaenge.length > 0 && !p.nurLesen && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ ...MIKRO }}>Ausgänge</div>
          {ausgaenge.map(a => {
            const kante = p.kanten.find(x => x.von === k.id && (x.ausgang === a || (a === 'weiter' && x.ausgang === 'ja' && k.form !== 'entscheidung')));
            const zweig = a !== 'weiter' && !(a === 'ja' && k.form === 'freigabe');
            const ziel = zweig ? k.zweige?.[a as 'ja' | 'nein' | 'fehler' | 'abgelaufen'] ?? null : null;
            return (
              <div key={a} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1.2fr)', alignItems: 'center' }}>
                <span style={{ fontSize: TYP.bedien, color: a === 'fehler' ? LEUCHT.kritisch : C.inkDim }}>{ausgangName(k.form ?? 'schritt', a)}</span>
                {zweig ? (
                  <select aria-label={`Ausgang ${ausgangName(k.form ?? 'schritt', a)}`} value={ziel ?? ''} onChange={ev => p.onZweig(k.id, a, ev.target.value || null)} style={{ ...auswahlStil, width: '100%' }}>
                    <option value="">{a === 'ja' && k.form === 'entscheidung' ? '— der nächste Schritt —' : a === 'abgelaufen' && k.form === 'warten' ? '— geht weiter —' : '— Lauf endet —'}</option>
                    {ziele.map(z => <option key={z.id} value={z.id}>{z.titel}</option>)}
                  </select>
                ) : <span style={klein}>{kante ? `zu „${d.knoten.find(x => x.id === kante.nach)?.titel ?? ''}“` : 'Lauf endet hier'}</span>}
                {(a !== 'weiter' || kante) && (
                  <span style={{ gridColumn: '1 / -1' }}>
                    <TextFeld label={`Beschriftung von ${ausgangName(k.form ?? 'schritt', a)}`} wert={(a === 'weiter' ? k.pfeilText?.weiter : k.pfeilText?.[a]) ?? ''} platz={`Beschriftung (Vorgabe „${ausgangName(k.form ?? 'schritt', a)}“)`}
                      onWert={t => p.onPfeilText(k.id, a, t || null)} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <BefundListe befunde={befunde} raete={raete} />
      {!p.nurLesen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Knopf leise onClick={p.onKopieren} titel="Kopieren (⌘C)"><span className="pz-knopf-inhalt"><Copy size={14} aria-hidden />Kopieren</span></Knopf>
          {!k.schloss && <Knopf leise onClick={() => p.onLoeschen([k.id])} titel="Löschen (Entf)"><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Löschen</span></Knopf>}
        </div>
      )}
    </div>
  );
}

function TitelFeld({ eingabe, wert, aus, onWert }: { eingabe: RefObject<HTMLInputElement>; wert: string; aus: boolean; onWert: (t: string) => void }) {
  return (
    <input ref={eingabe} aria-label="Name" defaultValue={wert} key={wert} disabled={aus} placeholder="z. B. Angebot senden"
      onBlur={ev => { const t = ev.target.value.trim(); if (t && t !== wert) onWert(t); else ev.target.value = wert; }}
      onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
      style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', background: 'transparent', border: `1px solid ${C.linie}`, borderRadius: 12, padding: '10px 14px', color: C.ink, fontSize: TYP.body }} />
  );
}

function PhasePanel(p: PanelProps & { ph: K }) {
  const { ph, d } = p;
  const schritte = schritteDer(d, ph.id);
  const nr = phasen(d).findIndex(x => x.id === ph.id) + 1;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Ueberschrift rechts={<Chip farbe={C.inkDim}>{`Phase ${nr}`}</Chip>}>{ph.titel}</Ueberschrift>
      <Feldzeile label="Name der Phase"><TextFeld label="Name der Phase" wert={ph.titel} aus={p.nurLesen} onWert={v => v.trim() && p.onPhase('umbenennen', ph.id, v)} /></Feldzeile>
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
      <p style={klein}>„{von?.titel ?? ''}“ → „{nach?.titel ?? ''}“ · Ausgang {ausgangName(f, p.k.ausgang)}{p.k.zurueck ? ' · zurück (Schleife)' : ''}</p>
      {von && !p.nurLesen && (
        <Feldzeile label="Beschriftung">
          <TextFeld label="Beschriftung" wert={(p.k.ausgang === 'weiter' ? von.pfeilText?.weiter : von.pfeilText?.[p.k.ausgang]) ?? ''} platz={ausgangName(f, p.k.ausgang)} onWert={t => p.onPfeilText(von.id, p.k.ausgang, t || null)} />
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
      <Feldzeile label="Text"><TextFeld label="Text des Zettels" mehrzeilig wert={z.text} aus={p.nurLesen} platz="z. B. Auftrag an den Agenten" onWert={t => p.onZettel(z.id, { text: t })} /></Feldzeile>
      <Feldzeile label="Farbe">
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

'use client';

// ─── Standard · die Reise als EINE Zeile (17.10. — Kevins Miro-Standard, DESIGN_STANDARD.md › Prozess-Visualisierung) ─────────────────────────────
// Rückmeldung 17.10.: „Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar.“ Vorbild ist der Stil seiner Kundenjourney (nie deren Inhalt):
// die Stufen als EINE Zeile nebeneinander (Beschriftung als Pille), darunter je Stufe höchstens vier kurze Kästchen (Rest „+n“), zwischen den Stufen eine
// Raute (Abstimmungspunkt bzw. Abhängigkeit) oder ein Pfeil, unten optional ein durchgehendes Band (intern „Kunde“, beim Kunden „Sie“). Erledigt (✓) · Hier
// (Petrol, „▾ Hier“) · offen · läuft (Kreislauf: alle Stufen zugleich, in ihrer Farbe); was hängt, trägt eine rote bzw. gelbe Kante mit „!“ — die Bedeutung
// hängt nie nur an der Farbe (Zeichen + Text für Vorleser).
// EIN Baustein für alle Bereiche (seit 17.10. aus dem Fulfillment hierher gezogen): Fulfillment-Fall, Kunden-Seite, Prozess-Editor, Markttraktion ›
// Kreislauf, Einrichtung, Planung › Ziel. Er zeichnet nur — die Modelle rechnen (lib/reise/bild.ts nennt sie). Keine Daten-Importe (die öffentliche
// Kunden-Seite bündelt diese Datei mit). Am Handy (≤ 720 px) wird die Zeile zur senkrechten Liste (globals.css `.ff-reise`).
// Markenzeichen: der Flow (17.10.): unter der Zeile läuft der Weg als Lichtfaden (`FlowLinie`, lib/lichtfaeden/flow.ts) — hell bis „Hier“, dahinter ruhig und
// ausgefranst, Stau an offenen Rauten; das Band sitzt darauf (seine untere Kante IST der Faden). Stand nur aus denselben Spalten (lib/reise/flow.ts
// `reiseFlow`), gemessen wird nur die Lage. Am Handy läuft der Faden links an der Liste hinunter. `flow="still"` (Kunden-Seite) = Standbild, `aus` = ohne.
// Abschnitte (17.10. spät — Zusatzmodul): tragen Stufen `abschnitt`, steht jeder Abschnitt als eigene Zeile mit einem leisen Titel darunter — eigenes „Hier“,
// eigener Faden (`reiseAbschnitte`, lib/reise/bild.ts). Ohne Abschnitte bleibt alles genau EINE Zeile.

import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Check, Mail, CalendarClock, BellRing, AlertCircle } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { reiseAbschnitte, type BildKaestchen, type BildSpalte, type FlussForm, type KaestchenZustand, type ReiseZustand } from '@/lib/reise/bild';
import { reiseFlow, reiseFaden, type ReiseLagen } from '@/lib/reise/flow';
import { JETZT, FORM_FARBE, FLOW_TON, FreigabeRaute } from './formen';
import { FlowLinie } from '../flow';

export type { BildKaestchen, BildSpalte };

const HAENGT_FARBE = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung } as const;
const ZUSTAND_TEXT: Record<KaestchenZustand, string> = { erledigt: 'erledigt', hier: 'als Nächstes', offen: 'offen', entfaellt: 'entfällt' };
const PHASE_TEXT: Record<ReiseZustand, string> = { fertig: 'erledigt', jetzt: 'hier stehen wir', offen: 'kommt noch', laeuft: 'läuft' };
const FORM_TEXT: Record<FlussForm, string> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Entscheidung', erinnerung: 'Erinnerung', termin: 'Termin' };

/** Das kleine Zeichen der Form vor einem Kästchen (nur Nachricht, Termin, Erinnerung — ein Schritt braucht keins, die Abstimmung ist eine Raute). */
export function FormZeichen({ form, groesse = 13 }: { form?: FlussForm; groesse?: number }) {
  const f = form ? FORM_FARBE[form] : C.inkDim;
  if (form === 'nachricht') return <Mail size={groesse} color={f} aria-hidden style={{ flex: '0 0 auto' }} />;
  if (form === 'termin') return <CalendarClock size={groesse} color={f} aria-hidden style={{ flex: '0 0 auto' }} />;
  if (form === 'erinnerung') return <BellRing size={groesse} color={f} aria-hidden style={{ flex: '0 0 auto' }} />;
  if (form === 'entscheidung') return <FreigabeRaute gegeben={false} groesse={9} />;
  return null;
}

function Kaestchen({ k, phaseId, gewaehlt, onKaestchen }: { k: BildKaestchen; phaseId: string; gewaehlt?: boolean; onKaestchen?: (phaseId: string, id: string) => void }) {
  const hier = k.zustand === 'hier';
  const fertig = k.zustand === 'erledigt';
  const kante = k.haengt ? HAENGT_FARBE[k.haengt] : hier ? JETZT : undefined;
  const label = `${k.form ? `${FORM_TEXT[k.form]}: ` : ''}${k.titel} — ${ZUSTAND_TEXT[k.zustand]}${k.haengt ? `, hängt${k.haengt === 'rot' ? ' (dringend)' : ''}` : ''}${k.unter ? `, ${k.unter}` : ''}`;
  const stil: CSSProperties = {
    display: 'flex', gap: 4, alignItems: 'flex-start', width: '100%', minWidth: 0, minHeight: 44, padding: '7px 6px', textAlign: 'left', boxSizing: 'border-box',
    borderRadius: 8, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, lineHeight: 1.3, color: fertig || k.zustand === 'entfaellt' ? C.inkDim : C.ink, fontWeight: hier ? 700 : 500,
    background: hier ? TIEF.flaeche(JETZT) : fertig ? 'transparent' : 'rgba(255,255,255,.045)',
    border: `1px solid ${gewaehlt ? C.ink : hier ? TIEF.rand(JETZT) : fertig ? RAND.haar : RAND.flaeche}`,
    borderLeft: kante ? `3px solid ${kante}` : undefined, boxShadow: hier ? TIEF.schein(JETZT, 14) : undefined,
    textDecoration: k.zustand === 'entfaellt' ? 'line-through' : 'none', cursor: onKaestchen ? 'pointer' : 'default',
  };
  const inhalt = (
    <>
      {fertig ? <Check size={13} color={LEUCHT.gut} aria-hidden style={{ flex: '0 0 auto', marginTop: 2 }} /> : k.form && k.form !== 'schritt' ? <span style={{ marginTop: 2, display: 'inline-flex' }}><FormZeichen form={k.form} /></span> : null}
      <span className="ff-reise-text" style={{ minWidth: 0, flex: 1 }}>{k.titel}</span>
      {k.haengt && <AlertCircle size={13} color={HAENGT_FARBE[k.haengt]} aria-hidden style={{ flex: '0 0 auto', marginTop: 2 }} />}
    </>
  );
  return onKaestchen
    ? <button type="button" className="fassbar ff-reise-kasten" title={k.unter ? `${k.titel} — ${k.unter}` : k.titel} aria-label={label} aria-pressed={gewaehlt} onClick={() => onKaestchen(phaseId, k.id)} style={stil}>{inhalt}</button>
    : <div className="ff-reise-kasten" title={k.unter ? `${k.titel} — ${k.unter}` : k.titel} aria-label={label} role="note" style={stil}>{inhalt}</div>;
}

/**
 * Die Reise als Zeile. `hierText` = Marke über der laufenden Stufe („Hier“ intern, „hier stehen wir“ beim Kunden), `bandTitel` = Beschriftung des Bandes
 * („Kunde“ intern, „Sie“/„Ihr“ beim Kunden; `band={false}` = ohne Band — Einrichtung, Planung), `wort` = wie eine Stufe heißt („Phase“, „Stufe“, „Etappe“,
 * „Meilenstein“), `mehrWort` = was hinter „+n“ steht („Schritte“, „Aufgaben“). Mit `onPhase`/`onKaestchen`/`onRaute` sind Beschriftung, Kästchen und Raute Tippziele.
 * Prozess-Editor (17.10.) — dieselbe Zeichnung: `griff` legt Ziehen/Tastatur auf die Phasen-Pille, `rauteSchalter` steht zwischen JEDER Phase und hinter der
 * letzten (Abstimmungspunkt an/aus, 44 px breit), `ende` ist eine eigene Spalte am Schluss („+ Phase“, im Kreislauf „↺ zurück“).
 */
/**
 * Die Lagen der Zeile für den Faden — gemessen an den Stufen (`data-flow-stufe`) und Rauten-Spalten (`data-flow-grenze`), relativ zur Leinwand. Quer am
 * Rechner (der Faden an der Unterkante), senkrecht am Handy (die Leinwand ist dort höher als breit).
 */
function reiseLagen(eltern: HTMLElement, box: DOMRect, n: number): ReiseLagen | null {
  const achse: ReiseLagen['achse'] = box.height > box.width ? 'hoch' : 'quer';
  const stufen: { von: number; bis: number }[] = [];
  const grenzen: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const s = eltern.querySelector<HTMLElement>(`[data-flow-stufe="${i}"]`);
    if (!s) return null;
    const r = s.getBoundingClientRect();
    stufen.push(achse === 'quer' ? { von: r.left - box.left, bis: r.right - box.left } : { von: r.top - box.top, bis: r.bottom - box.top });
    const g = eltern.querySelector<HTMLElement>(`[data-flow-grenze="${i}"]`)?.getBoundingClientRect();
    grenzen.push(g && g.width > 0 && g.height > 0 ? (achse === 'quer' ? (g.left + g.right) / 2 - box.left : null) : null);
  }
  return { stufen, grenzen, quer: achse === 'quer' ? box.height / 2 : box.width / 2, achse };
}

interface ReiseBildProps {
  spalten: readonly BildSpalte[]; hierText?: string; bandTitel?: string; band?: boolean; wort?: string; mehrWort?: string; aktiv?: string | null; gewaehlt?: string | null;
  onPhase?: (id: string) => void; onKaestchen?: (phaseId: string, id: string) => void; onRaute?: (phaseId: string) => void; gross?: boolean; label?: string;
  griff?: (phaseId: string) => Record<string, unknown>; rauteSchalter?: (phaseId: string) => ReactNode; ende?: ReactNode;
  /** Der Faden (Markenzeichen): `an` (Vorgabe) · `still` = Standbild ohne Bewegung (Kunden-Seite, Präsentation) · `aus`. */
  flow?: 'an' | 'still' | 'aus';
}
const LABEL = 'Reise des Kunden durch die Phasen';

/**
 * Die Reise. Ohne Abschnitte EINE Zeile (wie bisher); mit Abschnitten (Zusatzmodul) je Abschnitt eine Zeile — der eigene Abschnitt dezent abgesetzt mit seinem
 * Titel, jede Zeile mit eigenem „Hier“ und eigenem Faden. Das Ende (Abschluss) gehört zur ersten Zeile.
 */
export function ReiseBild(p: ReiseBildProps) {
  if (!p.spalten.some(s => s.abschnitt)) return <ReiseZeile {...p} />;
  const teile = reiseAbschnitte(p.spalten);
  return (
    <div className="ff-reise-abschnitte" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {teile.map((t, i) => (
        <div key={t.abschnitt?.id ?? 'grund'} data-reise-abschnitt={t.abschnitt?.id} style={{ display: 'grid', gap: 4, minWidth: 0, ...(t.abschnitt ? { borderTop: `1px dashed ${RAND.flaeche}`, paddingTop: 8 } : {}) }}>
          {t.abschnitt && <span style={{ ...MIKRO, color: C.inkLeise }}>Zusatzmodul · {t.abschnitt.titel}</span>}
          <ReiseZeile {...p} spalten={t.spalten} ende={i === 0 ? p.ende : undefined} label={t.abschnitt ? `${p.label ?? LABEL} — Zusatzmodul „${t.abschnitt.titel}“` : p.label} />
        </div>
      ))}
    </div>
  );
}

function ReiseZeile({ spalten, hierText = 'Hier', bandTitel = 'Kunde', band: mitBand = true, wort = 'Phase', mehrWort = 'Schritte', aktiv, gewaehlt, onPhase, onKaestchen, onRaute, gross, label = LABEL, griff, rauteSchalter, ende, flow = 'an' }: ReiseBildProps) {
  // Der Stand des Fadens aus denselben Spalten wie die Zeile („Hier“ = die Stufe `jetzt`) — gemessen wird in der Zeichnung nur die Lage.
  const stand = useMemo(() => reiseFlow(spalten), [spalten]);
  if (!spalten.length && !ende) return null;
  const zwischen = (i: number, s: BildSpalte) => i < spalten.length - 1 || !!s.raute || !!rauteSchalter;
  const spuren = [...spalten.flatMap((s, i) => ['minmax(0, 1fr)', ...(zwischen(i, s) ? [rauteSchalter ? '44px' : '22px'] : [])]), ...(ende ? ['minmax(min-content, auto)'] : [])].join(' ');
  const messen = (eltern: HTMLElement, box: DOMRect) => {
    const l = reiseLagen(eltern, box, spalten.length);
    const f = l ? reiseFaden(stand, l, FLOW_TON, stand.laeuft ? { farben: spalten.map(s => s.farbe) } : {}) : null;
    return f ? [f] : [];
  };
  const zeile = (
    <div className={`ff-reise${gross ? ' ff-reise-gross' : ''}${mitBand ? '' : ' ff-reise-ohne-band'}`} role="list" aria-label={label} style={{ gridTemplateColumns: spuren }}>
      {spalten.map((s, i) => {
        const pf = s.zustand === 'fertig' ? LEUCHT.gut : s.zustand === 'jetzt' ? JETZT : s.zustand === 'laeuft' ? (s.farbe ?? C.ink) : C.inkDim;
        const marke = s.zustand === 'jetzt' ? `▾ ${hierText}` : s.zustand === 'fertig' ? '✓' : '';
        const gegebenText = s.raute?.gegebenText ?? 'vermerkt';
        const phaseLabel = `${wort} ${s.nr}: ${s.titel} — ${PHASE_TEXT[s.zustand]}${s.unter ? `, ${s.unter}` : ''}${s.haengt ? ', etwas hängt' : ''}${s.raute ? `, ${s.raute.titel} ${s.raute.gegeben ? gegebenText : 'offen'}` : ''}`;
        const pille: CSSProperties = {
          display: 'flex', gap: 6, alignItems: 'center', width: '100%', minWidth: 0, minHeight: 44, padding: '6px 10px', boxSizing: 'border-box', borderRadius: ECKE.eingabe,
          fontFamily: SCHRIFT.text, fontSize: gross ? TYP.body : TYP.bedien, fontWeight: 700, textAlign: 'left', lineHeight: 1.25,
          color: s.zustand === 'offen' ? C.inkDim : C.ink, background: s.zustand === 'offen' ? 'transparent' : TIEF.flaeche(pf),
          border: `${aktiv === s.id ? 2 : 1}px solid ${aktiv === s.id ? C.ink : s.zustand === 'offen' ? RAND.stark : TIEF.rand(pf)}`,
          boxShadow: s.zustand === 'jetzt' ? TIEF.schein(JETZT, 16) : undefined, cursor: onPhase ? 'pointer' : 'default',
        };
        const titel = (
          <>
            <span className="ff-titel" title={s.titel} style={{ minWidth: 0, flex: 1 }}>{s.titel}</span>
            {s.haengt && <AlertCircle size={14} color={HAENGT_FARBE[s.haengt]} aria-hidden style={{ flex: '0 0 auto' }} />}
          </>
        );
        const band = s.band;
        return (
          <Fragment key={s.id}>
            <div role="listitem" data-flow-stufe={i} aria-current={s.zustand === 'jetzt' ? 'step' : undefined} className={`ff-reise-spalte ff-reise-${s.zustand}${aktiv === s.id ? ' ff-reise-aktiv' : ''}`}>
              <span className="ff-reise-marke" style={{ ...MIKRO, color: s.zustand === 'jetzt' ? JETZT : s.zustand === 'fertig' ? LEUCHT.gut : C.inkLeise, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {marke}<span className="ff-reise-nr">{marke ? ' · ' : ''}{wort} {s.nr}</span>
              </span>
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                {onPhase
                  ? <button type="button" className="fassbar ff-reise-stufe" aria-label={phaseLabel} aria-expanded={aktiv === s.id} onClick={() => onPhase(s.id)} {...griff?.(s.id)} style={pille}>{titel}</button>
                  : <span className="ff-reise-stufe" aria-label={phaseLabel} style={pille}>{titel}</span>}
                {s.unter && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, paddingLeft: 2 }}>{s.unter}</span>}
              </span>
              <div className="ff-reise-kaestchen">
                {s.kaestchen.map(k => <Kaestchen key={k.id} k={k} phaseId={s.id} gewaehlt={gewaehlt === k.id} onKaestchen={onKaestchen} />)}
                {s.mehr > 0 && (onPhase
                  ? <button type="button" className="fassbar" onClick={() => onPhase(s.id)} aria-label={`${s.mehr} weitere ${mehrWort} in „${s.titel}“ zeigen`} style={{ minHeight: 44, padding: '0 9px', textAlign: 'left', background: 'none', border: `1px dashed ${RAND.stark}`, borderRadius: 8, color: C.inkDim, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+{s.mehr}</button>
                  : <span style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '2px 9px' }}>+{s.mehr}</span>)}
              </div>
              {/* Am Handy steht die Raute als Zeile unter der Stufe (die Rauten-Spalte entfällt). */}
              {s.raute && (
                <span className="ff-reise-raute-zeile" style={{ gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: s.raute.gegeben ? LEUCHT.gut : C.inkDim }}>
                  <FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier} />{s.raute.titel}{s.raute.gegeben ? ` · ${gegebenText}` : ''}
                </span>
              )}
              {mitBand && (
                <span className={`ff-reise-band${band?.achtung ? ' ff-reise-band-achtung' : ''}${band?.intern ? ' ff-reise-band-intern' : ''}${!band?.text ? ' ff-reise-band-leer' : ''}`} style={{ ...bandStil(band), borderRadius: i === 0 ? '10px 0 0 10px' : i === spalten.length - 1 && !s.raute ? '0 10px 10px 0' : 0 }}>
                  {/* Am Rechner steht die Beschriftung einmal ganz links; am Handy trägt jedes Band mit Text sie selbst (die übrigen Bänder entfallen dort). */}
                  <b className={`ff-reise-band-titel${i > 0 ? ' ff-reise-band-titel-folge' : ''}`} style={{ ...MIKRO, color: C.inkDim, marginRight: 6 }}>{bandTitel}</b>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{band?.text ?? ''}</span>
                </span>
              )}
            </div>
            {zwischen(i, s) && (
              <div className="ff-reise-zwischen" data-flow-grenze={i} aria-hidden={rauteSchalter ? undefined : !s.raute || !onRaute}>
                <span />
                <span style={{ display: 'grid', placeItems: 'center', minHeight: 44 }}>
                  {rauteSchalter ? rauteSchalter(s.id) : s.raute
                    ? (onRaute
                      ? <button type="button" className="fassbar" onClick={() => onRaute(s.id)} title={`${s.raute.titel} — ${s.raute.gegeben ? gegebenText : 'offen'}`} aria-label={`${s.raute.titel} — ${s.raute.gegeben ? gegebenText : 'offen'}${s.raute.haengt ? ', überfällig' : ''}`}
                        style={{ width: 22, minHeight: 44, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier || !!s.raute.haengt} groesse={s.raute.hier ? 16 : 13} />
                      </button>
                      : <span title={s.raute.titel}><FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier} groesse={13} /></span>)
                    : <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>›</span>}
                </span>
                <span />
                {mitBand && <span className="ff-reise-band" style={{ ...bandStil({ intern: !!band?.intern && (i === spalten.length - 1 || !!spalten[i + 1]?.band?.intern) }), borderRadius: i === spalten.length - 1 ? '0 10px 10px 0' : 0 }} />}
              </div>
            )}
          </Fragment>
        );
      })}
      {ende && <div className="ff-reise-ende" style={{ display: 'grid', alignContent: 'start', paddingTop: 24, paddingLeft: 6, minWidth: 0 }}>{ende}</div>}
    </div>
  );
  if (flow === 'aus' || !spalten.length) return zeile;
  // Der Weg: die Zeile und darunter (am Handy daneben) der Faden — `.ff-reise-weg` (globals.css) gibt ihm seinen Platz.
  return (
    <div className="ff-reise-weg">
      {zeile}
      <FlowLinie messen={messen} still={flow === 'still'} />
    </div>
  );
}

const bandStil = (b?: BildSpalte['band']): CSSProperties => ({
  display: 'flex', alignItems: 'center', minWidth: 0, minHeight: 30, padding: '0 8px', boxSizing: 'border-box', fontSize: TYP.bedien, whiteSpace: 'nowrap',
  color: b?.achtung ? LEUCHT.achtung : C.inkDim,
  background: b?.intern ? 'transparent' : b?.achtung ? TIEF.flaeche(LEUCHT.achtung) : 'rgba(255,255,255,.05)',
  borderTop: `1px ${b?.intern ? 'dashed' : 'solid'} ${b?.achtung ? TIEF.rand(LEUCHT.achtung) : RAND.flaeche}`,
  borderBottom: `1px ${b?.intern ? 'dashed' : 'solid'} ${b?.achtung ? TIEF.rand(LEUCHT.achtung) : RAND.flaeche}`,
});

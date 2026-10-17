'use client';

// ─── Fulfillment · die Reise als EINE Zeile (Kundenjourney, 17.10. — Miro-Standard) ───────────────────────────────────────────────────────
// Rückmeldung 17.10.: „Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar.“ Vorbild ist der Stil seiner Kundenjourney (nie deren Inhalt):
// die Phasen als EINE Zeile nebeneinander (Beschriftung als Pille), darunter je Phase höchstens vier kurze Kästchen (Rest „+n“), zwischen den Phasen
// der Abstimmungspunkt als Raute, unten ein durchgehendes Band „Kunde“ (was bei ihm liegt, was er sieht). Erledigt (✓) · Hier (Petrol, „▾ Hier“) ·
// offen; was hängt, trägt eine rote bzw. gelbe Kante mit „!“ — die Bedeutung hängt nie nur an der Farbe (Zeichen + Text für Vorleser).
// EIN Baustein für die interne Reise (Fall › Reise), die Kunden-Seite, „Dem Kunden zeigen“ und (nachgebaut in pdf-bild.ts) den Report. Er zeichnet nur —
// die Modelle rechnen lib/fulfillment/prozesse/reise-bild.ts (intern) bzw. lib/fulfillment/kunde/bild.ts `kundenReise` (Kunde). Keine Daten-Importe
// (die öffentliche Kunden-Seite bündelt diese Datei mit). Am Handy (≤ 720 px) wird die Zeile zur senkrechten Liste (globals.css `.ff-reise`).

import { Fragment, type CSSProperties } from 'react';
import { Check, Mail, CalendarClock, BellRing, AlertCircle } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from '../../ui';
import type { FlussForm, KaestchenZustand } from '@/lib/fulfillment/prozesse/reise-bild';
import type { PhasenZustand } from '@/lib/fulfillment/prozesse/reise';
import { JETZT, FORM_FARBE, FreigabeRaute } from './bilder';

export interface BildKaestchen { id: string; titel: string; form?: FlussForm; zustand: KaestchenZustand; haengt?: 'rot' | 'gelb'; unter?: string }
export interface BildSpalte {
  id: string; nr: number; titel: string; zustand: PhasenZustand;
  /** Ein kurzer Zähler unter der Beschriftung („2 von 5“, „erledigt“). */
  unter?: string;
  haengt?: 'rot' | 'gelb';
  kaestchen: readonly BildKaestchen[];
  mehr: number;
  /** Der Abstimmungspunkt am Ende der Phase — die Raute zwischen dieser und der nächsten Phase. */
  raute?: { titel: string; gegeben: boolean; hier?: boolean; haengt?: 'rot' | 'gelb' };
  /** Das Band „Kunde“ unter der Phase: ein kurzer Satz (was bei ihm liegt), `achtung` = es liegt etwas bei ihm, `intern` = diese Phase sieht er nicht. */
  band?: { text?: string; achtung?: boolean; intern?: boolean };
}

const HAENGT_FARBE = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung } as const;
const ZUSTAND_TEXT: Record<KaestchenZustand, string> = { erledigt: 'erledigt', hier: 'als Nächstes', offen: 'offen', entfaellt: 'entfällt' };
const PHASE_TEXT: Record<PhasenZustand, string> = { fertig: 'erledigt', jetzt: 'hier stehen wir', offen: 'kommt noch' };
const FORM_TEXT: Record<FlussForm, string> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Abstimmung', erinnerung: 'Erinnerung', termin: 'Termin' };

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
 * Die Reise als Zeile. `hierText` = Marke über der laufenden Phase („Hier“ intern, „hier stehen wir“ beim Kunden), `bandTitel` = Beschriftung des Bandes
 * („Kunde“ intern, „Sie“/„Ihr“ beim Kunden). Mit `onPhase`/`onKaestchen`/`onRaute` sind Beschriftung, Kästchen und Raute Tippziele.
 */
export function ReiseBild({ spalten, hierText = 'Hier', bandTitel = 'Kunde', aktiv, gewaehlt, onPhase, onKaestchen, onRaute, gross, label = 'Reise des Kunden durch die Phasen' }: {
  spalten: readonly BildSpalte[]; hierText?: string; bandTitel?: string; aktiv?: string | null; gewaehlt?: string | null;
  onPhase?: (id: string) => void; onKaestchen?: (phaseId: string, id: string) => void; onRaute?: (phaseId: string) => void; gross?: boolean; label?: string;
}) {
  if (!spalten.length) return null;
  const spuren = spalten.flatMap((s, i) => ['minmax(0, 1fr)', ...(i < spalten.length - 1 || s.raute ? ['22px'] : [])]).join(' ');
  return (
    <div className={`ff-reise${gross ? ' ff-reise-gross' : ''}`} role="list" aria-label={label} style={{ gridTemplateColumns: spuren }}>
      {spalten.map((s, i) => {
        const pf = s.zustand === 'fertig' ? LEUCHT.gut : s.zustand === 'jetzt' ? JETZT : C.inkDim;
        const marke = s.zustand === 'jetzt' ? `▾ ${hierText}` : s.zustand === 'fertig' ? '✓' : '';
        const phaseLabel = `Phase ${s.nr}: ${s.titel} — ${PHASE_TEXT[s.zustand]}${s.unter ? `, ${s.unter}` : ''}${s.haengt ? ', etwas hängt' : ''}${s.raute ? `, ${s.raute.titel} ${s.raute.gegeben ? 'vermerkt' : 'offen'}` : ''}`;
        const pille: CSSProperties = {
          display: 'flex', gap: 6, alignItems: 'center', width: '100%', minWidth: 0, minHeight: 44, padding: '6px 10px', boxSizing: 'border-box', borderRadius: ECKE.eingabe,
          fontFamily: SCHRIFT.text, fontSize: gross ? TYP.body : TYP.bedien, fontWeight: 700, textAlign: 'left', lineHeight: 1.25,
          color: s.zustand === 'offen' ? C.inkDim : C.ink, background: s.zustand === 'offen' ? 'transparent' : TIEF.flaeche(pf),
          border: `${aktiv === s.id ? 2 : 1}px solid ${aktiv === s.id ? C.ink : s.zustand === 'offen' ? RAND.stark : TIEF.rand(pf)}`,
          boxShadow: s.zustand === 'jetzt' ? TIEF.schein(JETZT, 16) : undefined, cursor: onPhase ? 'pointer' : 'default',
        };
        const titel = (
          <>
            <span style={{ minWidth: 0, flex: 1, overflowWrap: 'break-word', hyphens: 'manual' }}>{s.titel}</span>
            {s.haengt && <AlertCircle size={14} color={HAENGT_FARBE[s.haengt]} aria-hidden style={{ flex: '0 0 auto' }} />}
          </>
        );
        const band = s.band;
        return (
          <Fragment key={s.id}>
            <div role="listitem" aria-current={s.zustand === 'jetzt' ? 'step' : undefined} className={`ff-reise-spalte ff-reise-${s.zustand}`}>
              <span className="ff-reise-marke" style={{ ...MIKRO, color: s.zustand === 'jetzt' ? JETZT : s.zustand === 'fertig' ? LEUCHT.gut : C.inkLeise, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {marke}<span className="ff-reise-nr">{marke ? ' · ' : ''}Phase {s.nr}</span>
              </span>
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                {onPhase
                  ? <button type="button" className="fassbar ff-reise-stufe" aria-label={phaseLabel} aria-expanded={aktiv === s.id} onClick={() => onPhase(s.id)} style={pille}>{titel}</button>
                  : <span className="ff-reise-stufe" aria-label={phaseLabel} style={pille}>{titel}</span>}
                {s.unter && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, paddingLeft: 2 }}>{s.unter}</span>}
              </span>
              <div className="ff-reise-kaestchen">
                {s.kaestchen.map(k => <Kaestchen key={k.id} k={k} phaseId={s.id} gewaehlt={gewaehlt === k.id} onKaestchen={onKaestchen} />)}
                {s.mehr > 0 && (onPhase
                  ? <button type="button" className="fassbar" onClick={() => onPhase(s.id)} aria-label={`${s.mehr} weitere Schritte in „${s.titel}“ zeigen`} style={{ minHeight: 44, padding: '0 9px', textAlign: 'left', background: 'none', border: `1px dashed ${RAND.stark}`, borderRadius: 8, color: C.inkDim, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+{s.mehr}</button>
                  : <span style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '2px 9px' }}>+{s.mehr}</span>)}
              </div>
              {/* Am Handy steht der Abstimmungspunkt als Zeile unter der Phase (die Rauten-Spalte entfällt). */}
              {s.raute && (
                <span className="ff-reise-raute-zeile" style={{ gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: s.raute.gegeben ? LEUCHT.gut : C.inkDim }}>
                  <FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier} />{s.raute.titel}{s.raute.gegeben ? ' · vermerkt' : ''}
                </span>
              )}
              <span className={`ff-reise-band${band?.achtung ? ' ff-reise-band-achtung' : ''}${band?.intern ? ' ff-reise-band-intern' : ''}${!band?.text ? ' ff-reise-band-leer' : ''}`} style={{ ...bandStil(band), borderRadius: i === 0 ? '10px 0 0 10px' : i === spalten.length - 1 && !s.raute ? '0 10px 10px 0' : 0 }}>
                {/* Am Rechner steht die Beschriftung einmal ganz links; am Handy trägt jedes Band mit Text sie selbst (die übrigen Bänder entfallen dort). */}
                <b className={`ff-reise-band-titel${i > 0 ? ' ff-reise-band-titel-folge' : ''}`} style={{ ...MIKRO, color: C.inkDim, marginRight: 6 }}>{bandTitel}</b>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{band?.text ?? ''}</span>
              </span>
            </div>
            {(i < spalten.length - 1 || s.raute) && (
              <div className="ff-reise-zwischen" aria-hidden={!s.raute || !onRaute}>
                <span />
                <span style={{ display: 'grid', placeItems: 'center', minHeight: 44 }}>
                  {s.raute
                    ? (onRaute
                      ? <button type="button" className="fassbar" onClick={() => onRaute(s.id)} title={`${s.raute.titel} — ${s.raute.gegeben ? 'vermerkt' : 'offen'}`} aria-label={`${s.raute.titel} — ${s.raute.gegeben ? 'vermerkt' : 'offen'}${s.raute.haengt ? ', überfällig' : ''}`}
                        style={{ width: 22, minHeight: 44, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier || !!s.raute.haengt} groesse={s.raute.hier ? 16 : 13} />
                      </button>
                      : <span title={s.raute.titel}><FreigabeRaute gegeben={s.raute.gegeben} aktiv={!!s.raute.hier} groesse={13} /></span>)
                    : <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>›</span>}
                </span>
                <span />
                <span className="ff-reise-band" style={{ ...bandStil({ intern: !!band?.intern && (i === spalten.length - 1 || !!spalten[i + 1]?.band?.intern) }), borderRadius: i === spalten.length - 1 ? '0 10px 10px 0' : 0 }} />
              </div>
            )}
          </Fragment>
        );
      })}
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

'use client';

// ─── Fulfillment · Prozesse — Zeichnungen: Landkarte „Hochhaus“ und Ablauf-Bild (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 6.1/6.2) ────────
// Die Komponenten ZEICHNEN nur (SVG am Rechner, Liste am Handy unter 720 px) — gerechnet wird in lib/fulfillment/prozesse/landkarte.ts und
// ablauf-bild.ts (Vorbild Lichtfäden). Keine Bewegung (reduzierte Bewegung bleibt still). Farben aus den Token; gestrichelt = Ergänzung bzw. Ausstieg.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, MIKRO, RAND } from '@/lib/make-one/design';
import { LEUCHT, Chip } from '../../ui';
import { landkarteLage } from '@/lib/fulfillment/prozesse/landkarte';
import type { Ampel } from '@/lib/fulfillment/prozesse/darstellung';
import { ablaufLage, ablaufListe } from '@/lib/fulfillment/prozesse/ablauf-bild';
import type { ProzessKnoten, ProzessVorlage, Uebergang, Zone } from '@/lib/fulfillment/typen';

export const HANDY_BREITE = 720;
/** Breite des Behälters (ResizeObserver) — 0 bis gemessen. */
export function useBreite(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [b, setB] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(e => setB(Math.round(e[0].contentRect.width)));
    ro.observe(el);
    setB(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, b];
}

export const ZONE_FARBE: Record<Zone, string> = { dach: LEUCHT.planung, etage: LEUCHT.business, fundament: LEUCHT.agenten };
export const ZONE_TEXT: Record<Zone, string> = { dach: 'Dach · Steuerung', etage: 'Etage · Kernprozess', fundament: 'Fundament · Unterstützung' };
const kuerzen = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const AMPEL: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
const AMPEL_SATZ: Record<Ampel, string> = { gruen: 'läuft rund', gelb: 'braucht einen Blick', rot: 'braucht Aufmerksamkeit' };
const kundenText = (n: number) => `${n} Kund${n === 1 ? 'e' : 'en'}`;

/**
 * Die Landkarte als Hochhaus — Klick auf einen Kasten öffnet seinen Steckbrief. `ampel` (11.10.): je Kasten der schlechteste Stand der Kunden dort
 * (lib/fulfillment/prozesse/darstellung.ts `knotenAmpel`) — färbt die Kunden-Marke; ohne Kunden keine Marke.
 */
export function Landkarte({ vorlage, zaehler, aktiv, onKnoten, gross, ampel = {} }: { vorlage: Pick<ProzessVorlage, 'knoten'>; zaehler: Record<string, readonly string[]>; aktiv?: string; onKnoten: (id: string) => void; gross?: boolean; ampel?: Record<string, Ampel> }) {
  const [ref, breite] = useBreite();
  const handy = breite > 0 && breite < HANDY_BREITE;
  const lage = breite ? landkarteLage(vorlage, zaehler, Math.max(breite, 320)) : null;
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      {lage && handy && (
        <div style={{ display: 'grid', gap: 6 }} role="list" aria-label="Landkarte des Unternehmens">
          {(['dach', 'etage', 'fundament'] as Zone[]).map(z => {
            const l = lage.kaesten.filter(k => k.zone === z);
            if (!l.length) return null;
            const reihe = z === 'etage' ? [...l].reverse() : l;
            return (
              <div key={z} style={{ display: 'grid', gap: 6 }}>
                <span style={{ ...MIKRO, color: ZONE_FARBE[z] }}>{ZONE_TEXT[z]}</span>
                {reihe.map(k => (
                  <button key={k.id} type="button" role="listitem" onClick={() => onKnoten(k.id)} className="fassbar"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 44, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${aktiv === k.id ? ZONE_FARBE[z] : RAND.flaeche}`, background: `${ZONE_FARBE[z]}12`, color: C.ink, fontSize: TYP.bedien }}>
                    <span style={{ minWidth: 0 }}>{k.titel}</span>
                    {k.anzahl > 0 && <Chip farbe={ampel[k.id] ? AMPEL[ampel[k.id]] : ZONE_FARBE[z]}>{kundenText(k.anzahl)}</Chip>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {lage && !handy && (
        <svg viewBox={`0 0 ${lage.breite} ${lage.hoehe}`} width="100%" style={{ display: 'block', maxHeight: gross ? undefined : 760 }} role="img" aria-label="Landkarte des Unternehmens als Hochhaus">
          <defs>
            <marker id="ff-pfeil" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={C.inkLeise} /></marker>
          </defs>
          {lage.dach && <path d={lage.dach.pfad} fill="none" stroke={ZONE_FARBE.dach} strokeOpacity={0.5} strokeWidth={1.5} />}
          {lage.pfeile.map((p, i) => (
            <g key={i}>
              <path d={p.pfad} fill="none" stroke={p.art === 'zurueck' ? LEUCHT.business : C.inkDim} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray={p.art === 'zurueck' ? '5 5' : undefined} markerEnd="url(#ff-pfeil)" />
              <text x={p.tx} y={p.ty} transform={`rotate(-90 ${p.tx} ${p.ty})`} textAnchor="middle" fill={p.art === 'zurueck' ? LEUCHT.business : C.inkLeise} fontSize={11} fontWeight={600} letterSpacing=".1em" style={{ textTransform: 'uppercase' }}>{p.text}</text>
            </g>
          ))}
          {lage.kaesten.map(k => {
            const f = ZONE_FARBE[k.zone];
            const an = aktiv === k.id;
            return (
              <g key={k.id} role="button" tabIndex={0} aria-label={`${k.titel}${k.anzahl ? `, ${kundenText(k.anzahl)}${ampel[k.id] ? ` — ${AMPEL_SATZ[ampel[k.id]]}` : ''}` : ''}`} style={{ cursor: 'pointer' }}
                onClick={() => onKnoten(k.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKnoten(k.id); } }}>
                <rect x={k.x} y={k.y} width={k.b} height={k.h} rx={10} fill={`${f}${an ? '30' : '16'}`} stroke={f} strokeOpacity={an ? 0.9 : 0.45} strokeWidth={an ? 2 : 1} />
                <text x={k.x + 12} y={k.y + (k.unter.length && k.zone === 'etage' ? 21 : k.h / 2 + 5)} fill={C.ink} fontSize={13} fontWeight={600}>{kuerzen(k.titel, Math.max(8, Math.floor(k.b / 8)))}</text>
                {k.zone === 'etage' && k.unter.length > 0 && <text x={k.x + 12} y={k.y + 40} fill={C.inkDim} fontSize={13}>{kuerzen(k.unter.join(" · "), Math.floor(k.b / 7.5))}</text>}
                {k.anzahl > 0 && (
                  <g>
                    <rect x={k.x + k.b - 92} y={k.y + 8} width={82} height={22} rx={11} fill={`${ampel[k.id] ? AMPEL[ampel[k.id]] : f}26`} stroke={ampel[k.id] ? AMPEL[ampel[k.id]] : f} strokeOpacity={0.6} />
                    {ampel[k.id] && <circle cx={k.x + k.b - 80} cy={k.y + 19} r={4} fill={AMPEL[ampel[k.id]]} />}
                    <text x={k.x + k.b - 44} y={k.y + 23} fill={C.ink} fontSize={13} fontWeight={600} textAnchor="middle">{kundenText(k.anzahl)}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

const ART_FARBE: Record<string, string> = { einstieg: LEUCHT.gut, stufe: LEUCHT.planung, ausstieg: LEUCHT.kritisch, routine: LEUCHT.agenten };
const KANTE_TEXT: Record<Uebergang['art'], string> = { weiter: 'weiter', rueckweg: 'Rückweg', ausstieg: 'Ausstieg', schleife: 'Schleife', kreislauf: 'zurück an den Anfang' };

/** Ein Ablauf in seiner Zeichenform (Trichter · Fluss · Zeitachse · Kreis · Baum) — am Handy als Liste mit Wegen. Lage rechnet NUR ablauf-bild.ts. */
export function AblaufBild({ vorlage, aktiv, onStufe }: { vorlage: Pick<ProzessVorlage, 'knoten' | 'uebergaenge' | 'form'>; aktiv?: string; onStufe: (id: string) => void }) {
  const [ref, breite] = useBreite();
  const handy = breite > 0 && breite < HANDY_BREITE;
  const lage = breite && !handy ? ablaufLage(vorlage, breite) : null;
  const liste = handy ? ablaufListe(vorlage) : null;
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      {liste && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-label="Stufen des Ablaufs">
          {liste.map(s => (
            <li key={s.id}>
              <button type="button" onClick={() => onStufe(s.id)} className="fassbar"
                style={{ width: '100%', textAlign: 'left', minHeight: 44, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', color: C.ink, fontSize: TYP.bedien,
                  border: `1px ${s.gestrichelt ? 'dashed' : 'solid'} ${aktiv === s.id ? ART_FARBE[s.art] ?? C.aktiv : RAND.flaeche}`, background: `${ART_FARBE[s.art] ?? C.aktiv}10` }}>
                {s.phase && <span style={{ ...MIKRO, display: 'block' }}>{s.phase}</span>}
                <b style={{ fontWeight: 600 }}>{s.titel}</b>
                {s.wege.length > 0 && <span style={{ display: 'block', color: C.inkDim, marginTop: 4 }}>{s.wege.map(w => `${KANTE_TEXT[w.art]}${w.weiche ? ` (${w.weiche})` : ''} → ${w.nach}`).join(' · ')}</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
      {lage && (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${lage.breite} ${lage.hoehe}`} width={lage.breite > breite ? lage.breite : '100%'} style={{ display: 'block' }} role="img" aria-label="Ablauf als Zeichnung">
            <defs>
              <marker id="ff-ab-pfeil" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={C.inkDim} /></marker>
            </defs>
            {lage.form === 'zeitachse' && lage.stufen.length > 0 && <line x1={16} x2={lage.breite - 16} y1={120} y2={120} stroke={C.inkLeise} strokeOpacity={0.5} />}
            {(lage.ringe ?? []).filter(r => !r.nurLage).map((r, i) => (
              <g key={`ring-${i}`}>
                <circle cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke={r.gestrichelt ? LEUCHT.gut : C.inkLeise} strokeOpacity={r.gestrichelt ? 0.6 : 0.22} strokeWidth={r.gestrichelt ? 1.4 : 1} strokeDasharray={r.gestrichelt ? '6 5' : undefined} />
                {r.titel && r.tx !== undefined && r.ty !== undefined && <text x={r.tx} y={r.ty} fill={C.inkDim} fontSize={11} textAnchor="middle">{r.titel}</text>}
              </g>
            ))}
            {lage.phasen.map(p => (
              <g key={p.id}>
                <rect x={p.x} y={p.y} width={p.b} height={p.h} rx={8} fill={`${LEUCHT.planung}14`} stroke={LEUCHT.planung} strokeOpacity={0.35} />
                <text x={p.x + p.b / 2} y={p.y + 17} fill={C.inkDim} fontSize={11} textAnchor="middle">{kuerzen(p.titel, Math.max(6, Math.floor(p.b / 6.5)))}</text>
              </g>
            ))}
            {lage.kanten.map((k, i) => (
              <g key={i}>
                <path d={k.pfad} fill="none" stroke={k.art === 'ausstieg' ? LEUCHT.kritisch : k.art === 'rueckweg' || k.art === 'kreislauf' ? LEUCHT.business : C.inkDim} strokeOpacity={0.7} strokeWidth={1.3}
                  strokeDasharray={k.gestrichelt ? '5 4' : undefined} markerEnd="url(#ff-ab-pfeil)" />
                {k.weiche && (
                  <g>
                    <rect x={k.lx - 6} y={k.ly - 6} width={12} height={12} transform={`rotate(45 ${k.lx} ${k.ly})`} fill={C.grund} stroke={LEUCHT.achtung} strokeOpacity={0.8} />
                    <text x={k.lx + 10} y={k.ly - 8} fill={C.inkDim} fontSize={10}>{kuerzen(k.weiche, 28)}</text>
                  </g>
                )}
              </g>
            ))}
            {lage.stufen.map(s => {
              const f = ART_FARBE[s.art] ?? C.aktiv;
              const an = aktiv === s.id;
              return (
                <g key={s.id} role="button" tabIndex={0} aria-label={s.titel} style={{ cursor: 'pointer' }} onClick={() => onStufe(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStufe(s.id); } }}>
                  <rect x={s.x} y={s.y} width={s.b} height={s.h} rx={s.rund ? s.h / 2 : 10} fill={`${f}${an ? '33' : '18'}`} stroke={f} strokeOpacity={an ? 0.95 : 0.55}
                    strokeWidth={an ? 2 : 1.2} strokeDasharray={s.gestrichelt ? '5 4' : undefined} />
                  <text x={s.x + s.b / 2} y={s.y + s.h / 2 + 4} fill={C.ink} fontSize={12} textAnchor="middle">{kuerzen(s.titel, Math.max(6, Math.floor(s.b / 7)))}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/** Legende unter einem Ablauf: durchgezogen = Quelle, gestrichelt = ergänzt; Farben der Stufen-Arten. */
export function AblaufLegende({ rechts }: { rechts?: ReactNode }) {
  const p = (farbe: string, text: string, strich?: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}>
      <svg width={22} height={10} aria-hidden><line x1={1} x2={21} y1={5} y2={5} stroke={farbe} strokeWidth={2} strokeDasharray={strich ? '4 3' : undefined} /></svg>{text}
    </span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      {p(C.inkDim, 'aus der Quelle')}{p(C.inkDim, 'ergänzt', true)}{p(LEUCHT.business, 'Rückweg / Kreislauf')}{p(LEUCHT.kritisch, 'Ausstieg', true)}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}><svg width={12} height={12} aria-hidden><rect x={2} y={2} width={8} height={8} transform="rotate(45 6 6)" fill="none" stroke={LEUCHT.achtung} /></svg>Entscheidung</span>
      {rechts}
    </div>
  );
}

export type { ProzessKnoten };

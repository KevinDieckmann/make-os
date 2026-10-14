'use client';

// ─── Fulfillment · Reise — gemeinsame Bausteine der Fall-Reiter (12.10., „kundenreif“) ──────────────────────────────────────────────────────
// Rückmeldung 12.10.: „Antwort zuerst, Bild statt Liste, eine Hauptaktion, der Rest hinter ⋯.“ Hier nur Zeichen-Bausteine (gerechnet wird in
// lib/fulfillment/prozesse/ansichten.ts): die Antwort-Karte über einem Reiter, ein „⋯“-Menü für Karten (dasselbe Menü wie an den Zeilen —
// `ZeilenMenueFenster`), eine Zeitachse mit Punkten und Strecken, und das Kreislauf-Rad (die sieben Stufen der Markttraktion als Kreis, „hier steht
// dieser Kunde“). Farben nur aus den Token; Tippziele ≥ 44 px; Text ≥ 13 px; jedes Bild trägt seinen Inhalt als Text für Vorleser.

import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT, ZeilenMenueFenster, zeilenMenueEintraege, useHandy, type ZeilenMehr, type ErklaerungsQuelle } from '../../ui';
import { KREISLAUF_REIHE, KREISLAUF_NAME, type Antwort, type KreislaufStufeId } from '@/lib/fulfillment/prozesse/ansichten';
import { AntwortKachel, Antworten, AMPEL_FARBE, JETZT } from './bilder';

const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 };

/**
 * Die Antwort über einem Reiter: eine Karte mit Überschrift und einer bis drei Antwort-Kacheln (Ampel, Satz, Satz darunter). Optional rechts die
 * EINE Hauptaktion des Reiters und das „⋯“ für alles Seltene.
 */
export function ReiterAntwort({ titel, erklaerung, antworten, aktion, mehr }: {
  titel: string; erklaerung?: ErklaerungsQuelle;
  antworten: readonly (Antwort & { frage: string; onClick?: () => void; links?: ReactNode })[];
  aktion?: ReactNode; mehr?: ReactNode;
}) {
  return (
    <Karte i={0} flach>
      <Ueberschrift erklaerung={erklaerung} rechts={mehr}>{titel}</Ueberschrift>
      <Antworten>
        {antworten.map(a => <AntwortKachel key={a.frage} frage={a.frage} ampel={AMPEL_FARBE[a.ampel]} antwort={a.antwort} unter={a.unter} onClick={a.onClick} links={a.links} />)}
      </Antworten>
      {aktion && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>{aktion}</div>}
    </Karte>
  );
}

/** „⋯“ an einer Karte — dasselbe Menü wie an den Zeilen (Rechner: am Knopf; Handy: Blatt von unten). Ohne Einträge: nichts. */
export function MehrKnopf({ titel, mehr }: { titel: string; mehr: readonly ZeilenMehr[] }) {
  const handy = useHandy();
  const router = useRouter();
  const id = useId();
  const knopf = useRef<HTMLButtonElement>(null);
  const [anker, setAnker] = useState<DOMRect | null | undefined>(undefined);
  const eintraege = zeilenMenueEintraege({ titel, mehr });
  if (!eintraege.length) return null;
  const zu = (fokus: boolean) => { setAnker(undefined); if (fokus) knopf.current?.focus(); };
  return (
    <>
      <button ref={knopf} type="button" className="fassbar" aria-haspopup="menu" aria-expanded={anker !== undefined} aria-controls={anker !== undefined ? id : undefined}
        aria-label={`Weitere Aktionen: ${titel}`} title="Weitere Aktionen"
        onClick={() => (anker !== undefined ? zu(true) : setAnker(knopf.current?.getBoundingClientRect() ?? null))}
        style={{ minWidth: 44, minHeight: 44, display: 'inline-grid', placeItems: 'center', background: 'none', border: `1px solid ${RAND.flaeche}`, borderRadius: ECKE.eingabe, color: C.inkDim, cursor: 'pointer' }}>
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {anker !== undefined && (
        <ZeilenMenueFenster id={id} titel={titel} eintraege={eintraege} anker={anker} blatt={handy} knopf={knopf.current} onZu={zu}
          onWahl={e => { zu(false); if (e.href) router.push(e.href); else void e.tun?.(); }} />
      )}
    </>
  );
}

/** Ein Punkt auf der Zeitachse. `voll` = gefüllt (geschehen), sonst Umriss (geplant/erwartet). */
export interface AchsenPunkt { x: number; farbe: string; voll: boolean; titel: string; raute?: boolean; gross?: boolean }
export interface AchsenStrecke { x1: number; x2: number; farbe: string; gestrichelt?: boolean }

/**
 * Eine Zeitachse (links alt, rechts neu): eine leise Linie, Strecken (z. B. offene Entscheidung bis zur Frist), Punkte, der Strich „heute“, unten
 * Beschriftungen. Reines Bild — der Inhalt steht als Liste für Vorleser daneben (`beschreibung`).
 */
export function Zeitachse({ punkte, strecken = [], heuteX, links, rechts, beschreibung }: { punkte: readonly AchsenPunkt[]; strecken?: readonly AchsenStrecke[]; heuteX?: number; links?: string; rechts?: string; beschreibung: string }) {
  const pz = (x: number) => `calc(${Math.round(Math.max(0, Math.min(1, x)) * 1000) / 10}% - 0px)`;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div role="img" aria-label={beschreibung} style={{ position: 'relative', height: 40, margin: '0 10px' }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 19, height: 2, borderRadius: 1, background: 'rgba(255,255,255,.08)' }} />
        {strecken.map((s, i) => (
          <span key={i} aria-hidden style={{ position: 'absolute', left: pz(Math.min(s.x1, s.x2)), width: `${Math.round(Math.abs(s.x2 - s.x1) * 1000) / 10}%`, top: 18, height: 4, borderRadius: 2,
            background: s.gestrichelt ? `repeating-linear-gradient(90deg, ${s.farbe} 0 6px, transparent 6px 10px)` : TIEF.verlauf(s.farbe), opacity: 0.85 }} />
        ))}
        {heuteX !== undefined && (
          <span aria-hidden style={{ position: 'absolute', left: pz(heuteX), top: 2, bottom: 2, width: 2, marginLeft: -1, borderRadius: 1, background: JETZT, boxShadow: TIEF.schein(JETZT, 10) }} />
        )}
        {punkte.map((p, i) => {
          const g = p.gross ? 14 : 11;
          return (
            <span key={i} title={p.titel} aria-hidden style={{
              position: 'absolute', left: pz(p.x), top: 20 - g / 2, width: g, height: g, marginLeft: -g / 2, borderRadius: p.raute ? 2 : g / 2,
              transform: p.raute ? 'rotate(45deg)' : undefined, background: p.voll ? p.farbe : C.grund, border: `2px solid ${p.farbe}`, boxShadow: p.voll ? TIEF.schein(p.farbe, 8) : undefined,
            }} />
          );
        })}
      </div>
      {(links || rechts || heuteX !== undefined) && (
        // Abnahme C3: „heute“ steht unter dem Heute-Strich (nicht in der Mitte); am Rand rückt es nach innen, damit es Start/Ende nicht überdeckt.
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 8, margin: '0 10px', minHeight: 16, ...MIKRO }}>
          <span>{links ?? ''}</span><span>{rechts ?? ''}</span>
          {heuteX !== undefined && (
            <span style={{ position: 'absolute', top: 0, left: pz(heuteX), transform: `translateX(${heuteX < 0.12 ? '0' : heuteX > 0.88 ? '-100%' : '-50%'})`, color: JETZT, padding: '0 4px', whiteSpace: 'nowrap' }}>heute</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Eine Stufe des Rads (Zahl und Weg aus Markttraktion › Planung, falls geladen). */
export interface RadStufe { id: KreislaufStufeId; label?: string; anzahl?: number; zusatz?: string; href?: string }

/**
 * Das Kreislauf-Rad: die sieben Stufen (Kanäle → Leads → Deals → Abschluss → Fulfillment → nach der Leistung → Wiederkauf) im Uhrzeigersinn um einen
 * Kreis, die Stufe `hier` hervorgehoben („hier steht …“), durchlaufene Stufen grün, kommende leise. Jede Stufe mit `href` ist ein Sprung dorthin
 * (die vorhandene Ansicht der Markttraktion). In der Mitte steht `mitte` (eine Antwort). Am Handy wird das Rad zur Liste in derselben Reihenfolge.
 */
export function KreislaufRad({ stufen, hier, durchlaufen = [], mitte, onStufe, beschreibung }: {
  stufen: readonly RadStufe[]; hier?: KreislaufStufeId; durchlaufen?: readonly KreislaufStufeId[]; mitte?: ReactNode; onStufe?: (s: RadStufe) => void; beschreibung?: string;
}) {
  const handy = useHandy();
  const nach = new Map(stufen.map(s => [s.id, s]));
  const reihe = KREISLAUF_REIHE.map(id => nach.get(id) ?? { id });
  const zustand = (id: KreislaufStufeId) => (id === hier ? 'hier' : durchlaufen.includes(id) ? 'durch' : 'kommt');
  const farbe = (id: KreislaufStufeId) => (zustand(id) === 'hier' ? JETZT : zustand(id) === 'durch' ? LEUCHT.gut : C.inkLeise);
  const knopf = (s: RadStufe, stil: CSSProperties) => {
    const z = zustand(s.id);
    const f = farbe(s.id);
    const label = s.label ?? KREISLAUF_NAME[s.id];
    const inhalt = (
      <>
        <span aria-hidden style={{ width: z === 'hier' ? 30 : 24, height: z === 'hier' ? 30 : 24, borderRadius: 15, display: 'inline-grid', placeItems: 'center', flex: '0 0 auto',
          fontSize: TYP.bedien, fontWeight: 700, fontFamily: SCHRIFT.display, color: z === 'kommt' ? C.inkDim : C.ink,
          background: z === 'kommt' ? 'transparent' : TIEF.flaeche(f), border: `2px solid ${z === 'kommt' ? RAND.stark : TIEF.rand(f)}`, boxShadow: z === 'hier' ? TIEF.schein(f, 16) : undefined }}>
          {s.anzahl !== undefined ? s.anzahl : z === 'durch' ? '✓' : ''}
        </span>
        <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
          {z === 'hier' && <span style={{ ...MIKRO, color: JETZT }}>hier</span>}
          <span style={{ fontSize: TYP.bedien, fontWeight: z === 'hier' ? 700 : 600, color: z === 'kommt' ? C.inkDim : C.ink, lineHeight: 1.25, overflowWrap: 'break-word' }}>{label}</span>
          {handy && s.zusatz && <span style={{ ...klein, color: C.inkLeise }}>{s.zusatz}</span>}
        </span>
      </>
    );
    const aria = `${label}${s.anzahl !== undefined ? `: ${s.anzahl}` : ''} — ${z === 'hier' ? 'hier steht dieser Kunde' : z === 'durch' ? 'durchlaufen' : 'kommt noch'}${s.zusatz ? ` (${s.zusatz})` : ''}`;
    const basis: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, padding: '4px 6px', borderRadius: ECKE.eingabe, textAlign: 'left', color: C.ink, fontFamily: SCHRIFT.text, ...stil };
    return onStufe
      ? <button key={s.id} type="button" className="fassbar" onClick={() => onStufe(s)} aria-label={aria} title={s.zusatz} style={{ ...basis, background: z === 'hier' ? TIEF.flaeche(JETZT) : 'rgba(11,14,16,.82)', border: `1px solid ${z === 'hier' ? TIEF.rand(JETZT) : 'transparent'}`, cursor: 'pointer' }}>{inhalt}</button>
      : <div key={s.id} aria-label={aria} title={s.zusatz} style={{ ...basis, background: 'rgba(11,14,16,.82)' }}>{inhalt}</div>;
  };
  if (handy) return (
    <ol aria-label={beschreibung ?? 'Kreislauf'} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
      {mitte && <li style={{ padding: '4px 0 8px' }}>{mitte}</li>}
      {reihe.map((s, i) => <li key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{knopf(s, { flex: 1 })}{i === reihe.length - 1 && <span aria-hidden style={{ ...klein, color: LEUCHT.business }}>↺</span>}</li>)}
    </ol>
  );
  const n = reihe.length;
  const lage = (i: number) => { const w = -Math.PI / 2 + (i / n) * 2 * Math.PI; return { x: 50 + 39 * Math.cos(w), y: 50 + 39 * Math.sin(w) }; };
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '1 / 1', margin: '0 auto' }} aria-label={beschreibung ?? 'Kreislauf'} role="group">
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <marker id="ff-rad-pfeil" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={C.inkLeise} /></marker>
        </defs>
        {reihe.map((s, i) => {
          const a = lage(i), b = lage((i + 1) % n);
          const durch = zustand(s.id) !== 'kommt' && zustand(reihe[(i + 1) % n].id) !== 'kommt';
          const zurueck = i === n - 1;
          return <path key={s.id} d={`M ${a.x} ${a.y} A 39 39 0 0 1 ${b.x} ${b.y}`} fill="none" stroke={zurueck ? LEUCHT.business : durch ? LEUCHT.gut : 'rgba(255,255,255,.14)'} strokeWidth={durch ? 0.9 : 0.6}
            strokeDasharray={zurueck ? '2 1.5' : undefined} strokeOpacity={durch || zurueck ? 0.7 : 1} markerEnd="url(#ff-rad-pfeil)" />;
        })}
      </svg>
      {mitte && <div style={{ position: 'absolute', left: '24%', right: '24%', top: '30%', bottom: '30%', display: 'grid', placeItems: 'center', textAlign: 'center' }}>{mitte}</div>}
      {reihe.map((s, i) => {
        const p = lage(i);
        return knopf(s, { position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)', width: 'max-content', maxWidth: '34%' });
      })}
    </div>
  );
}

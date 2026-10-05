'use client';

// ─── MAKE OS — Brain als Kugel aus allen Daten (05.10.2026, UMBAU_ABEND_0410.md 3) ─
// Jeder Punkt ist ein echter Datensatz (Kontakt, Firma, Deal, Mandat, Aufgabe, Ziel, Meilenstein, Termin, Notiz,
// Gesellschaft) — eingefärbt nach Bereich, als Cluster gruppiert, Größe/Helligkeit nach Aktualität. Zeiger: Ausbruch an der
// Stelle, Titel des Punkts und dünne Linien zu seinen Verbindungen; Klick öffnet den Datensatz über WEG (lib/wege.ts).
// Daten NUR aus GET /api/brain/punkte — dort ist schon gefiltert, was der Betrachter sehen darf; hier wird nichts versteckt.
// Barrierefrei: die Leinwand ist dekorativ, darunter dieselben Punkte als Liste mit Suche (Tastatur, Vorleser); der Fokus
// in der Liste hebt den Punkt in der Kugel hervor. Ohne WebGL bleibt nur die Liste.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP, KUGEL_BEREICH_FARBE, RAND, LICHT_GLAS } from '@/lib/make-one/design';
import { ART_NAME, BEREICH_NAME, KUGEL_BEREICHE, nachbarn, wegFuer, type BrainPunkt, type KugelArt, type KugelBereich } from '@/lib/brain/kugel';
import { Kugel } from './Kugel';
import { brainLayout } from './brain-layout';
import type { Motor } from './motor';
import type { KugelZustand } from './geometrie';
import { Leer, Punkt, feld } from '../ui';

interface Antwort { ok: boolean; punkte?: BrainPunkt[]; gekuerzt?: number; deckel?: number; jeArt?: Record<KugelArt, number>; fehler?: string }

/** Die Brain-Kugel atmet kaum — sie ist eine Karte, kein Gesicht. */
const RUHE: KugelZustand = { tempo: 0.6, atem: 0.018, weite: 0, verschiebung: 0, hell: 1, pegel: 0 };
const LISTE_MAX = 150;
const KEINE: readonly string[] = [];

const datumText = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}` : 'ohne Datum');
const heuteTag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function BrainKugel() {
  const router = useRouter();
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [mitGl, setMitGl] = useState(true);
  const motor = useRef<Motor | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const linien = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let weg = false;
    fetch('/api/brain/punkte').then(r => r.json()).then((d: Antwort) => { if (!weg) setAntwort(d); })
      .catch(() => { if (!weg) setAntwort({ ok: false, fehler: 'Die Brain-Kugel ist gerade nicht erreichbar.' }); });
    return () => { weg = true; };
  }, []);

  const punkte = useMemo(() => antwort?.punkte ?? [], [antwort]);
  const nachId = useMemo(() => new Map(punkte.map(p => [p.id, p])), [punkte]);
  const netz = useMemo(() => nachbarn(punkte), [punkte]);
  const layout = useMemo(() => brainLayout(punkte, heuteTag()), [punkte]);
  const jeBereich = useMemo(() => {
    const z = Object.fromEntries(KUGEL_BEREICHE.map(b => [b, 0])) as Record<KugelBereich, number>;
    for (const p of punkte) z[p.bereich]++;
    return z;
  }, [punkte]);

  const aktiv = hover ?? auswahl;
  const aktivPunkt = aktiv ? nachId.get(aktiv) ?? null : null;
  const aktivNachbarn = useMemo(() => (aktiv ? netz.get(aktiv) ?? KEINE : KEINE), [aktiv, netz]);

  // Linien zu den Verbindungen + Lage des Titels: einmal je Wechsel (die Drehung steht, solange ein Punkt gezeigt wird).
  const [titelOrt, setTitelOrt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = linien.current, m = motor.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    if (!aktiv || !m || !aktivPunkt) { setTitelOrt(null); return; }
    const i = layout.index.get(aktiv);
    const von = i === undefined ? null : m.bildschirm(i);
    if (!von) { setTitelOrt(null); return; }
    setTitelOrt({ x: von.x, y: von.y });
    g.lineWidth = 1;
    for (const id of aktivNachbarn) {
      const j = layout.index.get(id), q = nachId.get(id);
      const zu = j === undefined ? null : m.bildschirm(j);
      if (!zu || !q) continue;
      g.strokeStyle = `${KUGEL_BEREICH_FARBE[q.bereich]}${zu.vorne ? '8C' : '33'}`;
      g.beginPath(); g.moveTo(von.x, von.y); g.lineTo(zu.x, zu.y); g.stroke();
      g.fillStyle = `${KUGEL_BEREICH_FARBE[q.bereich]}${zu.vorne ? 'CC' : '44'}`;
      g.beginPath(); g.arc(zu.x, zu.y, 2.2, 0, Math.PI * 2); g.fill();
    }
  }, [aktiv, aktivPunkt, aktivNachbarn, layout, nachId]);

  const zeige = useCallback((id: string | null) => {
    const m = motor.current;
    setHover(id);
    m?.hebeHervor(id === null ? null : layout.index.get(id) ?? null);
    m?.halte(id !== null);
  }, [layout]);

  const zeigerBewegt = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = motor.current;
    if (!m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = m.treffer(x, y, e.pointerType === 'mouse' ? 14 : 22);
    const id = i === null ? null : layout.ids[i] ?? null;
    if (id !== hover) zeige(id);
    if (id === null) m.zeiger(x, y);
  };
  const zeigerWeg = () => { motor.current?.zeiger(null); zeige(null); };
  const tippen = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = motor.current;
    if (!m) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = m.treffer(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'mouse' ? 14 : 22);
    const id = i === null ? null : layout.ids[i] ?? null;
    if (!id) { setAuswahl(null); return; }
    const p = nachId.get(id);
    // Maus: Klick öffnet. Finger: erst zeigen (Titel + Verbindungen + „Öffnen“), ein zweites Tippen öffnet.
    if (p && (e.pointerType === 'mouse' || auswahl === id)) router.push(wegFuer(p));
    else { setAuswahl(id); zeige(id); }
  };

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? punkte.filter(p => p.titel.toLowerCase().includes(q) || ART_NAME[p.art].ein.toLowerCase().includes(q)) : punkte;
  }, [punkte, suche]);

  if (!antwort) return <Leer>Ich lege die Kugel aus deinen Daten …</Leer>;
  if (!antwort.ok) return <Leer>{antwort.fehler ?? 'Die Brain-Kugel konnte nicht geladen werden.'}</Leer>;
  if (!punkte.length) return <Leer>Hier ist noch nichts, das du sehen darfst — sobald Kontakte, Aufgaben, Termine oder Notizen da sind, erscheinen sie als Punkte.</Leer>;

  const satz = `${punkte.length} Datensätze als Punkte${antwort.gekuerzt ? ` — ${antwort.gekuerzt} ältere nicht gezeigt (höchstens ${antwort.deckel})` : ''}.`;
  return (
    <div data-brain-kugel="" style={{ display: 'grid', gap: 12 }}>
      {mitGl && (
        <div
          ref={flaeche}
          onPointerMove={zeigerBewegt}
          onPointerLeave={zeigerWeg}
          onPointerUp={tippen}
          style={{ position: 'relative', width: '100%', maxWidth: 440, aspectRatio: '1 / 1', margin: '0 auto', cursor: hover ? 'pointer' : 'default', touchAction: 'pan-y' }}
        >
          <Kugel
            name="brain"
            art="brain"
            daten={layout.daten}
            zustand={RUHE}
            onMotor={m => { motor.current = m; }}
            rueckfall={<RueckfallMerker aus={() => setMitGl(false)} />}
          />
          <canvas ref={linien} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          {aktivPunkt && titelOrt && (
            <div role="presentation" style={{
              position: 'absolute', left: Math.min(Math.max(8, titelOrt.x + 12), (flaeche.current?.clientWidth ?? 440) - 228), top: Math.max(4, titelOrt.y - 46), maxWidth: 220,
              pointerEvents: auswahl ? 'auto' : 'none', background: LICHT_GLAS.flaeche, border: `1px solid ${LICHT_GLAS.rand(KUGEL_BEREICH_FARBE[aktivPunkt.bereich])}`,
              borderRadius: 10, padding: '6px 10px', fontFamily: SCHRIFT.text, backdropFilter: 'blur(6px)',
            }}>
              <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aktivPunkt.titel}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>
                {ART_NAME[aktivPunkt.art].ein} · {datumText(aktivPunkt.datum)}{aktivNachbarn.length ? ` · ${aktivNachbarn.length} ${aktivNachbarn.length === 1 ? 'Verbindung' : 'Verbindungen'}` : ''}
              </div>
              {auswahl === aktivPunkt.id && (
                <Link href={wegFuer(aktivPunkt)} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 32, fontSize: TYP.bedien, color: KUGEL_BEREICH_FARBE[aktivPunkt.bereich], textDecoration: 'none', fontWeight: 600 }}>Öffnen ›</Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legende: Bereich = Farbe, mit Zahl (die Zahlen je Art stehen im Titel). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
        {KUGEL_BEREICHE.filter(b => jeBereich[b]).map(b => (
          <span key={b} title={Object.entries(antwort.jeArt ?? {}).filter(([a, n]) => n && punkte.some(p => p.art === a && p.bereich === b)).map(([a, n]) => `${n} ${ART_NAME[a as KugelArt].viele}`).join(' · ')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: TYP.bedien, color: C.inkDim }}>
            <Punkt farbe={KUGEL_BEREICH_FARBE[b]} groesse={8} />{BEREICH_NAME[b]} <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{jeBereich[b]}</span>
          </span>
        ))}
      </div>
      <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, textAlign: 'center' }}>{satz}</div>

      {/* Dieselben Punkte als Liste — für Tastatur und Vorleser, und ohne WebGL der einzige Weg. */}
      <details open={!mitGl} style={{ borderTop: `1px solid ${RAND.haar}`, paddingTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim, minHeight: 40, display: 'flex', alignItems: 'center' }}>Alle Punkte als Liste ({punkte.length})</summary>
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen — Titel oder Art …" aria-label="Punkte der Brain-Kugel durchsuchen"
          style={{ ...feld, fontSize: 16, margin: '8px 0' }} />
        <ul aria-label="Punkte der Brain-Kugel" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {gefiltert.slice(0, LISTE_MAX).map(p => {
            const n = netz.get(p.id)?.length ?? 0;
            return (
              <li key={p.id}>
                <Link href={wegFuer(p)} className="zeile-klick"
                  onFocus={() => zeige(p.id)} onBlur={() => zeige(null)} onMouseEnter={() => zeige(p.id)} onMouseLeave={() => zeige(null)}
                  aria-label={`${ART_NAME[p.art].ein}: ${p.titel}, ${datumText(p.datum)}${n ? `, ${n} ${n === 1 ? 'Verbindung' : 'Verbindungen'}` : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '4px 6px', borderRadius: 8, color: C.ink, textDecoration: 'none', fontSize: TYP.bedien }}>
                  <Punkt farbe={KUGEL_BEREICH_FARBE[p.bereich]} groesse={7} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</span>
                  <span style={{ color: C.inkLeise, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{ART_NAME[p.art].ein} · {datumText(p.datum)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {gefiltert.length > LISTE_MAX && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '6px 6px 0' }}>{`… und ${gefiltert.length - LISTE_MAX} weitere — Suche verfeinern.`}</div>}
        {!gefiltert.length && <Leer>{`Nichts zu „${suche.trim()}“.`}</Leer>}
      </details>
    </div>
  );
}

/** Ohne WebGL: die Kugel-Fläche fällt weg, die Liste geht auf. */
function RueckfallMerker({ aus }: { aus: () => void }) {
  useEffect(() => { aus(); }, [aus]);
  return null;
}

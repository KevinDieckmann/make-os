'use client';

// ─── MAKE OS — Brain als Kugel aus allen Daten (05.10.2026 · Überarbeitung „Galaxie“, UMBAU_ABEND_0410.md 3) ─
// Kevin: „Überarbeite das Brain nochmal … das muss sehr geil aussehen.“ Die Kugel ist jetzt die Bühne der Seite:
//   · eine dichte, dunkle Partikel-Hülle (Galaxie, nur Form) mit leisem Farbnebel je Cluster,
//   · darin jeder echte Datensatz als heller Stern mit Halo (Größe nach Bedeutung/Aktualität), vorne heller und größer,
//   · Cluster je Bereich mit kleiner Beschriftung — anklicken fährt die Kamera sanft hin, „Gesamt“ zurück,
//   · Zeigen: der Stern glüht auf, Verbindungen als leuchtende Bögen über der Kugel, Titelkarte im Glas-Stil; Klick öffnet
//     den Datensatz über WEG (lib/wege.ts), am Handy erst zeigen, dann „Öffnen ›“,
//   · die Legende blendet Bereiche ein und aus.
// Daten NUR aus GET /api/brain/punkte — dort ist schon gefiltert, was der Betrachter sehen darf; hier wird nichts versteckt.
// Barrierefrei: die Leinwand ist dekorativ, darunter dieselben Punkte als Liste mit Suche (Tastatur, Vorleser); der Fokus in
// der Liste hebt den Stern hervor. Ohne WebGL bleibt nur die Liste. Beschriftungen, Bögen und Titel folgen dem Takt des
// Motors (`nachBild`) — kein eigener Lauf, keine React-Zustände je Bild.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP, KUGEL_BEREICH_FARBE, RAND, LICHT_GLAS, ZIEL } from '@/lib/make-one/design';
import { ART_NAME, BEREICH_NAME, KUGEL_BEREICHE, nachbarn, wegFuer, type BrainPunkt, type KugelArt, type KugelBereich } from '@/lib/brain/kugel';
import { Kugel } from './Kugel';
import { brainLayout, HUELLE_PUNKTE, HUELLE_PUNKTE_HANDY, type BrainLayout } from './brain-layout';
import type { Motor } from './motor';
import { RUHE, norm, type Vec3 } from './geometrie';
import { Leer, Punkt, feld, useHandy } from '../ui';

interface Antwort { ok: boolean; punkte?: BrainPunkt[]; gekuerzt?: number; deckel?: number; jeArt?: Record<KugelArt, number>; fehler?: string }

const LISTE_MAX = 150;
const KEINE: readonly string[] = [];
/** Höhe der Bögen über der Kugel (Anteil des Abstands der beiden Sterne). */
const BOGEN_HOEHE = 0.32;
const BOGEN_STUECKE = 28;

const datumText = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}` : 'ohne Datum');
const heuteTag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Punkt t (0 … 1) des Bogens von a nach b: über die Kugel, in der Mitte angehoben. */
export function bogenPunkt(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const m = norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  const la = Math.hypot(a[0], a[1], a[2]), lb = Math.hypot(b[0], b[1], b[2]);
  const h = (la + (lb - la) * t) * (1 + BOGEN_HOEHE * d * Math.sin(Math.PI * t));
  return [m[0] * h, m[1] * h, m[2] * h];
}

export function BrainKugel() {
  const router = useRouter();
  const handy = useHandy();
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [mitGl, setMitGl] = useState(true);
  const [aus, setAus] = useState<ReadonlySet<KugelBereich>>(new Set());
  const [fokus, setFokus] = useState<KugelBereich | null>(null);
  const motor = useRef<Motor | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const linien = useRef<HTMLCanvasElement>(null);
  const titelKarte = useRef<HTMLDivElement>(null);
  const schilder = useRef(new Map<KugelBereich, HTMLButtonElement>());

  useEffect(() => {
    let weg = false;
    fetch('/api/brain/punkte').then(r => r.json()).then((d: Antwort) => { if (!weg) setAntwort(d); })
      .catch(() => { if (!weg) setAntwort({ ok: false, fehler: 'Die Brain-Kugel ist gerade nicht erreichbar.' }); });
    return () => { weg = true; };
  }, []);

  const punkte = useMemo(() => antwort?.punkte ?? [], [antwort]);
  const sichtbar = useMemo(() => punkte.filter(p => !aus.has(p.bereich)), [punkte, aus]);
  const nachId = useMemo(() => new Map(punkte.map(p => [p.id, p])), [punkte]);
  const netz = useMemo(() => nachbarn(sichtbar), [sichtbar]);
  const layout = useMemo(() => brainLayout(sichtbar, heuteTag(), handy ? HUELLE_PUNKTE_HANDY : HUELLE_PUNKTE), [sichtbar, handy]);
  const jeBereich = useMemo(() => {
    const z = Object.fromEntries(KUGEL_BEREICHE.map(b => [b, 0])) as Record<KugelBereich, number>;
    for (const p of punkte) z[p.bereich]++;
    return z;
  }, [punkte]);

  const aktiv = hover ?? auswahl;
  const aktivPunkt = aktiv ? nachId.get(aktiv) ?? null : null;
  const aktivNachbarn = useMemo(() => (aktiv ? netz.get(aktiv) ?? KEINE : KEINE), [aktiv, netz]);

  // Was der Bild-Takt braucht, ohne React je Bild zu bemühen.
  const stand = useRef<{ layout: BrainLayout; aktiv: string | null; nachbarn: readonly string[]; fokus: KugelBereich | null; gezeichnet: boolean }>({ layout, aktiv, nachbarn: aktivNachbarn, fokus, gezeichnet: false });
  stand.current = { ...stand.current, layout, aktiv, nachbarn: aktivNachbarn, fokus };

  const nachBild = useCallback(() => {
    const m = motor.current, c = linien.current;
    if (!m || !c) return;
    const s = stand.current;
    const pos = s.layout.daten.pos;
    const ortVon = (id: string): Vec3 | null => { const i = s.layout.index.get(id); return i === undefined ? null : [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]; };
    // Cluster-Beschriftung: über der Clustermitte, hinten leise.
    for (const k of s.layout.cluster) {
      const el = schilder.current.get(k.bereich);
      if (!el) continue;
      const p = m.ort([k.mitte[0] * 1.14, k.mitte[1] * 1.14, k.mitte[2] * 1.14]);
      // Im Bild halten: am Handy stünden die seitlichen Schilder sonst halb über dem Rand.
      const halb = el.offsetWidth / 2, breite = flaeche.current?.clientWidth ?? 0, hoehe = flaeche.current?.clientHeight ?? 0;
      const x = breite ? Math.min(Math.max(p.x, halb + 6), breite - halb - 6) : p.x, y = hoehe ? Math.min(Math.max(p.y, 24), hoehe - 24) : p.y;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      el.style.opacity = p.vorne ? (s.fokus && s.fokus !== k.bereich ? '0.35' : '1') : '0.22';
    }
    // Bögen und Titel.
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d');
    if (!g) return;
    if (!s.aktiv) {
      if (s.gezeichnet) { g.clearRect(0, 0, c.width, c.height); s.gezeichnet = false; }
      if (titelKarte.current) titelKarte.current.style.visibility = 'hidden';
      return;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    s.gezeichnet = true;
    const a = ortVon(s.aktiv);
    const quelle = nachId.get(s.aktiv);
    if (!a || !quelle) return;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const id of s.nachbarn) {
      const b = ortVon(id), q = nachId.get(id);
      if (!b || !q) continue;
      const zug = Array.from({ length: BOGEN_STUECKE + 1 }, (_, k) => m.ort(bogenPunkt(a, b, k / BOGEN_STUECKE)));
      const anfang = zug[0], ende = zug[zug.length - 1];
      const verlauf = g.createLinearGradient(anfang.x, anfang.y, ende.x, ende.y);
      verlauf.addColorStop(0, KUGEL_BEREICH_FARBE[quelle.bereich]); verlauf.addColorStop(1, KUGEL_BEREICH_FARBE[q.bereich]);
      const strich = () => { g.beginPath(); zug.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); };
      g.strokeStyle = verlauf;
      g.globalAlpha = ende.vorne ? 0.16 : 0.06; g.lineWidth = 5; strich(); g.stroke();   // Schein
      g.globalAlpha = ende.vorne ? 0.85 : 0.3; g.lineWidth = 1.2; strich(); g.stroke();  // Faden
      g.globalAlpha = ende.vorne ? 0.9 : 0.3; g.fillStyle = KUGEL_BEREICH_FARBE[q.bereich];
      g.beginPath(); g.arc(ende.x, ende.y, 2.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const t = titelKarte.current, p = m.ort(a);
    if (t) {
      const breite = flaeche.current?.clientWidth ?? 400;
      t.style.visibility = 'visible';
      t.style.transform = `translate(${Math.min(Math.max(8, p.x + 16), breite - 240).toFixed(1)}px, ${Math.max(8, p.y - 58).toFixed(1)}px)`;
    }
  }, [nachId]);

  const zeige = useCallback((id: string | null) => {
    const m = motor.current;
    setHover(id);
    m?.hebeHervor(id === null ? null : stand.current.layout.index.get(id) ?? null);
    m?.halte(id !== null);
  }, []);

  const trifft = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = motor.current;
    if (!m) return { id: null as string | null, x: 0, y: 0 };
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const i = m.treffer(x, y, e.pointerType === 'mouse' ? 16 : 24);
    return { id: i === null ? null : layout.ids[i] ?? null, x, y };
  };
  const zeigerBewegt = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    const { id } = trifft(e);
    if (id !== hover) zeige(id);
  };
  const zeigerWeg = () => { motor.current?.zeiger(null); zeige(null); };
  const tippen = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    const { id } = trifft(e);
    if (!id) { setAuswahl(null); zeige(null); return; }
    const p = nachId.get(id);
    // Maus: Klick öffnet. Finger: erst zeigen (Titel + Bögen + „Öffnen“), ein zweites Tippen öffnet.
    if (p && (e.pointerType === 'mouse' || auswahl === id)) router.push(wegFuer(p));
    else { setAuswahl(id); zeige(id); }
  };
  const fliege = (b: KugelBereich | null) => {
    const k = b ? layout.cluster.find(x => x.bereich === b) : null;
    setFokus(k ? b : null);
    motor.current?.fliegeZu(k ? k.mitte : null, 0.6);
  };
  const umschalten = (b: KugelBereich) => {
    setAus(v => { const n = new Set(v); if (n.has(b)) n.delete(b); else n.add(b); return n; });
    if (fokus === b) fliege(null);
    setAuswahl(null); zeige(null);
  };

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? sichtbar.filter(p => p.titel.toLowerCase().includes(q) || ART_NAME[p.art].ein.toLowerCase().includes(q)) : sichtbar;
  }, [sichtbar, suche]);

  if (!antwort) return <Leer>Ich lege die Kugel aus deinen Daten …</Leer>;
  if (!antwort.ok) return <Leer>{antwort.fehler ?? 'Die Brain-Kugel konnte nicht geladen werden.'}</Leer>;
  if (!punkte.length) return <Leer>Hier ist noch nichts, das du sehen darfst — sobald Kontakte, Aufgaben, Termine oder Notizen da sind, erscheinen sie als Sterne.</Leer>;

  const satz = `${punkte.length} Datensätze als Sterne${aus.size ? ` (${sichtbar.length} eingeblendet)` : ''}${antwort.gekuerzt ? ` — ${antwort.gekuerzt} ältere nicht gezeigt (höchstens ${antwort.deckel})` : ''}.`;
  return (
    <div data-brain-kugel="" style={{ display: 'grid', gap: 14 }}>
      {mitGl && (
        <div
          ref={flaeche}
          onPointerMove={zeigerBewegt}
          onPointerLeave={zeigerWeg}
          onPointerUp={tippen}
          style={{ position: 'relative', width: '100%', height: handy ? undefined : 'min(640px, 72vh)', aspectRatio: handy ? '1 / 1' : undefined, cursor: hover ? 'pointer' : 'default', touchAction: 'pan-y', overflow: 'hidden' }}
        >
          <Kugel
            name="brain"
            art="brain"
            daten={layout.daten}
            zustand={RUHE}
            nachBild={nachBild}
            onMotor={m => { motor.current = m; }}
            rueckfall={<RueckfallMerker aus={() => setMitGl(false)} />}
          />
          <canvas ref={linien} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          {/* Cluster-Beschriftung — anklicken fährt die Kamera hin. */}
          {layout.cluster.map(k => (
            <button key={k.bereich} type="button" ref={el => { if (el) schilder.current.set(k.bereich, el); else schilder.current.delete(k.bereich); }}
              onClick={() => fliege(fokus === k.bereich ? null : k.bereich)}
              aria-label={`${BEREICH_NAME[k.bereich]}: ${k.anzahl} Datensätze — ${fokus === k.bereich ? 'zurück zur Gesamtsicht' : 'hinfahren'}`}
              style={{
                position: 'absolute', left: 0, top: 0, transform: 'translate(-9999px, 0)', minHeight: ZIEL.handy, padding: '0 10px', border: 'none',
                background: 'transparent', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.12em',
                textTransform: 'uppercase', color: KUGEL_BEREICH_FARBE[k.bereich], whiteSpace: 'nowrap', transition: 'opacity .4s ease',
                textShadow: `0 0 12px ${KUGEL_BEREICH_FARBE[k.bereich]}80`,
              }}>
              {BEREICH_NAME[k.bereich]} <span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{k.anzahl}</span>
            </button>
          ))}
          {fokus && (
            <button type="button" onClick={() => fliege(null)} style={{
              position: 'absolute', left: 12, top: 12, minHeight: ZIEL.handy, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
              background: LICHT_GLAS.flaeche, border: `1px solid ${RAND.stark}`, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
            }}>‹ Gesamt</button>
          )}
          <div ref={titelKarte} role="presentation" style={{
            position: 'absolute', left: 0, top: 0, visibility: 'hidden', width: 232,
            pointerEvents: auswahl ? 'auto' : 'none', background: LICHT_GLAS.flaeche,
            border: `1px solid ${aktivPunkt ? LICHT_GLAS.rand(KUGEL_BEREICH_FARBE[aktivPunkt.bereich]) : RAND.stark}`,
            boxShadow: aktivPunkt ? LICHT_GLAS.schein(KUGEL_BEREICH_FARBE[aktivPunkt.bereich]) : undefined,
            borderRadius: 12, padding: '8px 12px', fontFamily: SCHRIFT.text, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          }}>
            {aktivPunkt && <>
              <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aktivPunkt.titel}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>
                <span style={{ color: KUGEL_BEREICH_FARBE[aktivPunkt.bereich] }}>{ART_NAME[aktivPunkt.art].ein}</span> · {datumText(aktivPunkt.datum)}{aktivNachbarn.length ? ` · ${aktivNachbarn.length} ${aktivNachbarn.length === 1 ? 'Verbindung' : 'Verbindungen'}` : ''}
              </div>
              {auswahl === aktivPunkt.id && (
                <Link href={wegFuer(aktivPunkt)} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, fontSize: TYP.bedien, color: KUGEL_BEREICH_FARBE[aktivPunkt.bereich], textDecoration: 'none', fontWeight: 600 }}>Öffnen ›</Link>
              )}
            </>}
          </div>
        </div>
      )}

      {/* Legende = Filter: ein Bereich je Knopf, ein- und ausblendbar. */}
      <div role="group" aria-label="Bereiche ein- und ausblenden" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {KUGEL_BEREICHE.filter(b => jeBereich[b]).map(b => {
          const an = !aus.has(b);
          return (
            <button key={b} type="button" aria-pressed={an} onClick={() => umschalten(b)}
              title={Object.entries(antwort.jeArt ?? {}).filter(([a, n]) => n && punkte.some(p => p.art === a && p.bereich === b)).map(([a, n]) => `${n} ${ART_NAME[a as KugelArt].viele}`).join(' · ')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: ZIEL.handy, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
                background: an ? LICHT_GLAS.flaeche : 'transparent', border: `1px solid ${an ? LICHT_GLAS.rand(KUGEL_BEREICH_FARBE[b]) : RAND.haar}`,
                color: an ? C.ink : C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
              }}>
              <Punkt farbe={an ? KUGEL_BEREICH_FARBE[b] : C.inkLeise} groesse={8} />{BEREICH_NAME[b]} <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{jeBereich[b]}</span>
            </button>
          );
        })}
      </div>
      <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, textAlign: 'center' }}>{satz}</div>

      {/* Dieselben Punkte als Liste — für Tastatur und Vorleser, und ohne WebGL der einzige Weg. */}
      <details open={!mitGl} style={{ borderTop: `1px solid ${RAND.haar}`, paddingTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim, minHeight: 40, display: 'flex', alignItems: 'center' }}>Alle Punkte als Liste ({sichtbar.length})</summary>
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

'use client';

// ─── Prozesse — die Zeichnungen der drei Ebenen (Etappe A, 21.10.; ANALYSE_100.md Punkte 2–5, 9, 14, 21, 24, 26, 27) ───────────────────────────
// Die Komponenten ZEICHNEN nur (SVG in Welt-Koordinaten, die Bühne setzt die Kamera) — gerechnet wird in lib/prozesse/* (Lage, Regeln) und lib/text/umbruch.ts
// (Text in eine Breite, nie mitten im Wort). Miro-Stil, wenig und klar: je Kachel Titel und EINE Zahl (die zweite nur rot bei einer Frist), der Rest auf Klick;
// Farbe nie allein (Wort, Form, Zeichen). Die Linien sind Lichtfäden auf der Ebene darunter (die Bühne) — hier stehen nur Spitze und Beschriftung (FlaechePfeil;
// CSS blendet den Strich aus, solange der Flow läuft). Formen der Ebene 3 sind dieselben wie im Prozess-Editor (components/os/ui/reise/flaeche-formen.tsx).
//   · `LandkarteBild`  Ebene 1 — Bänder, die Fliege (zwei getönte Flügel, der Knoten „Übergabe“ in der Mitte), Kacheln, Übergaben: ohne Fokus nur die kurzen
//                      zwischen Nachbarn, mit Fokus (überfahren, gewählt, Rahmen beim Präsentieren) dazu die langen — hell und beschriftet (`pfeileImBild`).
//   · `ProzessBild`    Ebene 2 — Start, Phasen mit ihren ersten Schritten, Ergebnis, Geister (woher, wohin)
//   · `AblaufBild`     Ebene 3/4 — die Fläche des Editors (`flaecheBild`), nur lesbar; Enden ohne Pfeil weiter

import type { KeyboardEvent as RKeyboardEvent, MouseEvent as RMouseEvent } from 'react';
import { Cog, LayoutTemplate, AlertTriangle, Workflow, SlidersHorizontal } from 'lucide-react';
import { FARBE as C, TIEF, RAND, FLAECHE_STIL } from '@/lib/make-one/design';
import { pfadVon, pfeilTextOrt, type FlaecheBild } from '@/lib/fulfillment/prozesse/flaeche';
import { pfeileImBild, kachelTitel, wegTextMass, KACHEL_TEXT, WEG_TEXT, PHASE_TITEL, type FliegeLage, type ProzessLage } from '@/lib/prozesse/landkarte';
import type { ProzessDef, Zahl } from '@/lib/prozesse/typen';
import { kachelTexte, kurztitel, zahlTexte, zahlSchluessel } from '@/lib/prozesse/modell';
import { einstellbar } from '@/lib/prozesse/stellschrauben';
import { STUFE_FARBE, tonVon } from '@/lib/prozesse/farben';
import { einpassen, textBreite, type Eingepasst } from '@/lib/text/umbruch';
import type { ZoomStufe } from '../ui/flaeche/stufe';
import { FlaecheForm, FlaecheStart, FlaecheRahmen, FlaecheGruppe, FlaechePfeil, FlaecheSpitze, FLAECHE_SCHRIFT } from '../ui/reise/flaeche-formen';
import { JETZT } from '../ui/reise/formen';

/** Schrift auf Ebene 2 und für Zahlen je Zoomstufe (Bildpunkte der Fläche) — die Kacheln der Landkarte stehen in `KACHEL_TEXT` (lib/prozesse/landkarte.ts). */
export const KACHEL_SCHRIFT = { fern: KACHEL_TEXT.fern.groesse, zahlFern: 24, mittel: KACHEL_TEXT.mittel.groesse, nah: KACHEL_TEXT.nah.groesse, wegFern: WEG_TEXT.fern } as const;
/** Zeilenabstand (× Schriftgröße). */
const ZEILE = 1.2;

/** Tastatur an einem SVG-Knopf: Enter bzw. Leertaste lösen aus. */
const taste = (f: () => void) => (e: RKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } };

/** Ein Weg als SVG-Pfad: gewinkelte Wege mit weichen Ecken (`pfadVon`), Kurven (viele kurze Stücke) als feine Polylinie. */
export function linieVon(p: readonly [number, number][]): string {
  const winkel = p.every((q, i) => !i || q[0] === p[i - 1][0] || q[1] === p[i - 1][1]);
  return winkel ? pfadVon(p) : p.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join(' ');
}

/** Eingepasster Text (lib/text/umbruch.ts) als Block: links bündig ab `x` bzw. mittig um `x`; senkrecht um `mitteY` zentriert. */
function TextBlock({ e, x, mitteY, farbe = C.ink, gewicht = 600, mitte }: { e: Eingepasst; x: number; mitteY: number; farbe?: string; gewicht?: number; mitte?: boolean }) {
  const g = e.groesse, n = e.zeilen.length;
  // Erste Grundlinie so, dass der Block (Versalhöhe ≈ 0,7 · g) um `mitteY` steht.
  const erste = mitteY - ((n - 1) * g * ZEILE) / 2 + g * 0.35;
  return (
    <text x={x} y={erste} fontSize={g} fontWeight={gewicht} fill={farbe} textAnchor={mitte ? 'middle' : 'start'} style={{ pointerEvents: 'none' }}>
      {e.zeilen.map((t, i) => <tspan key={i} x={x} dy={i ? g * ZEILE : 0}>{t}</tspan>)}
    </text>
  );
}
/** Eine Zeile (eingepasst, sonst mit „…“ an einer Wortgrenze). */
const zeile = (text: string, breite: number, groesse: number, min: number, gewicht = 400) => einpassen({ text, breite, groesse, min, zeilen: 1, gewicht });

/** Breite einer Zahl-Pille (Zahl + Wort; mit Zeichen bei einer Frist). */
const pillenBreite = (text: string, g: number, rot?: boolean) => Math.round(textBreite(text, g, 600) + (rot ? g + 22 : 18));

/** Eine Zahl als Pille (Zahl + Wort; rot mit Zeichen nur bei einer Frist) — ein Klick zeigt die Fälle (Punkt 27). */
function ZahlPille({ x, y, text, rot, groesse = FLAECHE_SCHRIFT.unter, ton, href, onZahl, rechtsBuendig }: { x: number; y: number; text: string; rot?: boolean; groesse?: number; ton: string; href?: string; onZahl?: (href: string) => void; rechtsBuendig?: boolean }) {
  const farbe = rot ? C.kritisch : ton;
  const b = pillenBreite(text, groesse, rot);
  const h = Math.round(groesse * 1.75);
  const x0 = rechtsBuendig ? x - b : x;
  const klick = href && onZahl ? () => onZahl(href) : undefined;
  return (
    <g transform={`translate(${x0} ${y})`} {...(klick ? { 'data-pz-klick': '', role: 'link', tabIndex: 0, 'aria-label': `${text} — Fälle ansehen`, onClick: (e: RMouseEvent) => { e.stopPropagation(); klick(); }, onKeyDown: taste(klick), style: { cursor: 'pointer' } } : {})}>
      <rect width={b} height={h} rx={h / 2} fill={C.grund} stroke={TIEF.rand(farbe)} strokeWidth={1.2} />
      {rot && <AlertTriangle x={8} y={(h - groesse) / 2} width={groesse} height={groesse} color={farbe} aria-hidden />}
      <text x={rot ? groesse + 14 : 9} y={h / 2} dominantBaseline="central" fontSize={groesse} fontWeight={600} fill={rot ? farbe : C.ink}>{text}</text>
    </g>
  );
}

/** Die Beschriftung eines Wegs als Marke auf dunklem Grund — fern größer (lesbar in der Gesamtansicht), hell mit dem Akzent am Rand. */
function WegText({ text, ort, groesse, hell }: { text: string; ort: [number, number]; groesse: number; hell?: boolean }) {
  const { b, h } = wegTextMass(text, groesse);
  return (
    <g data-teil="text" transform={`translate(${ort[0]} ${ort[1]})`} style={{ pointerEvents: 'none' }}>
      <rect x={-b / 2} y={-h / 2} width={b} height={h} rx={h / 2} fill={C.grund} stroke={hell ? TIEF.rand(JETZT) : RAND.stark} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={groesse} fill={hell ? C.ink : C.inkDim}>{text}</text>
    </g>
  );
}

/** Rand zum Aufleuchten (sichtbar nur mit `data-pz-leuchten` am Element — CSS). */
const Leuchtrand = ({ b, h, rx = 14 }: { b: number; h: number; rx?: number }) => <rect className="pz-leuchtrand" x={-6} y={-6} width={b + 12} height={h + 12} rx={rx + 4} fill="none" stroke={JETZT} strokeWidth={3} />;

/** Ein Wort in Versalien mit Farbpunkt davor (Stufen der Fliege) — Farbe nie allein. */
function StufenTitel({ x, y, titel, groesse, farbe }: { x: number; y: number; titel: string; groesse: number; farbe: string }) {
  const t = titel.toUpperCase();
  const breit = textBreite(t, groesse, 700) + 1.2 * (t.length - 1);
  const r = Math.max(4, groesse / 4);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={x - breit / 2 - r - 8} cy={y - groesse * 0.36} r={r} fill={farbe} />
      <text x={x} y={y} textAnchor="middle" fontSize={groesse} fontWeight={700} letterSpacing="1.2" fill={C.ink}>{t}</text>
    </g>
  );
}

// ── Ebene 1: die Landkarte als Fliege ─────────────────────────────────────────────────────────────────────────────────────────────────

export function LandkarteBild({ lage, prozesse, zahlen, stufe, spitze, fokus = [], nurAus, onKachel, onZahl, onFokus, toene }: {
  lage: FliegeLage; prozesse: ReadonlyMap<string, ProzessDef>; zahlen: Readonly<Record<string, Zahl>>; stufe: ZoomStufe; spitze: string;
  /** Landkarte anpassen (22.10.): der Ton je Bereich (Kennung → Wert aus `LANDKARTE_TOENE`) — ohne Angabe die Töne der Vorgabe. */
  toene?: Readonly<Record<string, string>>;
  /** Überfahrene bzw. gewählte Kacheln (beim Präsentieren: die des Rahmens) — ihre Wege stehen hell und beschriftet. */
  fokus?: readonly string[]; nurAus?: boolean;
  onKachel: (id: string) => void; onZahl: (href: string) => void;
  /** Eine Kachel wird überfahren bzw. erhält den Fokus (null = wieder weg). */
  onFokus?: (id: string | null) => void;
}) {
  const fern = stufe === 'fern';
  const { fliege } = lage;
  const wege = pfeileImBild(lage.pfeile, fokus, { nurAus });
  const hellIds = new Set(wege.filter(w => w.hell).flatMap(w => [w.pfeil.von, w.pfeil.nach]));
  const grund = `${spitze}-fluegel`, rand = `${spitze}-fluegel-rand`;
  const stufeTon = (id: keyof typeof STUFE_FARBE) => toene?.[id] ?? STUFE_FARBE[id];
  const knotenTon = stufeTon('uebergabe');
  return (
    <g>
      <defs>
        <FlaecheSpitze id={spitze} />
        {/* Die Flügel: getönt im Ton jeder Stufe (TIEF, leise) — ein Verlauf von links nach rechts. */}
        <linearGradient id={grund} gradientUnits="userSpaceOnUse" x1={fliege.x0} x2={fliege.x1} y1={0} y2={0}>
          {fliege.toene.map(t => <stop key={t.stufe} offset={t.bei} stopColor={stufeTon(t.stufe)} stopOpacity={0.12} />)}
        </linearGradient>
        <linearGradient id={rand} gradientUnits="userSpaceOnUse" x1={fliege.x0} x2={fliege.x1} y1={0} y2={0}>
          {fliege.toene.map(t => <stop key={t.stufe} offset={t.bei} stopColor={stufeTon(t.stufe)} stopOpacity={0.42} />)}
        </linearGradient>
      </defs>
      {lage.baender.map(b => {
        // Ein Band mit eigenem Ton (Landkarte anpassen) trägt ihn als Punkt vor dem Namen — Farbe nie allein, der Name steht daneben.
        const ton = toene?.[b.id] && toene[b.id] !== C.inkDim ? toene[b.id] : null;
        const ein = ton ? (fern ? 30 : 18) : 0;
        return (
          <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
            <rect data-pz-rand="" width={b.b} height={b.h} rx={22} fill={FLAECHE_STIL.leise.background} stroke={ton ? TIEF.rand(ton) : RAND.stark} strokeWidth={1.2} />
            {ton && <circle cx={22 + (fern ? 9 : 5)} cy={fern ? 29 : 25} r={fern ? 9 : 5} fill={ton} />}
            <text x={22 + ein} y={fern ? 38 : 30} fontSize={fern ? 26 : 13} fontWeight={700} letterSpacing="1.4" fill={C.inkDim}>{b.titel.toUpperCase()}</text>
            {!fern && b.satz && <text x={22 + ein + textBreite(b.titel.toUpperCase(), 13, 700) + 1.4 * b.titel.length + 18} y={30} fontSize={13} fill={C.inkLeise}>{b.satz}</text>}
          </g>
        );
      })}
      {/* Die Fliege: zwei getönte Flügel, in der Mitte der Knoten „Übergabe“. */}
      <path data-pz-rand="" d={fliege.pfad} fill={`url(#${grund})`} stroke={`url(#${rand})`} strokeWidth={1.5} />
      {fliege.knoten.b > 0 && <rect x={fliege.knoten.x} y={fliege.knoten.y} width={fliege.knoten.b} height={fliege.knoten.h} rx={Math.min(30, fliege.knoten.h / 2)} fill={TIEF.flaeche(knotenTon)} stroke={TIEF.rand(knotenTon)} strokeWidth={1.5} />}
      {!fern && (
        <text x={fliege.caption[0]} y={fliege.caption[1]} textAnchor="middle" fontSize={13} fontWeight={700} letterSpacing="1.4" fill={C.inkDim} style={{ pointerEvents: 'none' }}>
          KERN<tspan dx={12} fontWeight={400} letterSpacing="0" fill={C.inkLeise}>Kunden gewinnen → übergeben → liefern und ausbauen</tspan>
        </text>
      )}
      {/* Über jeder Stufe ihr Wort — es folgt der Form der Fliege. */}
      {fliege.stufen.map(s => <StufenTitel key={s.id} x={s.cx} y={s.titelY} titel={s.titel} groesse={fern ? 30 : 15} farbe={stufeTon(s.id)} />)}
      {/* Übergaben: Spitze (der Strich ist der Lichtfaden darunter); Beschriftung, wo Platz ist, bzw. immer mit Fokus. */}
      {wege.map(({ pfeil: pf }) => <FlaechePfeil key={pf.id} d={linieVon(pf.punkte)} spitze={spitze} gestrichelt={pf.art === 'zurueck'} />)}
      {lage.kacheln.map(k => {
        const p = prozesse.get(k.id);
        if (!p) return null;
        const ton = tonVon(p);
        const t = kachelTexte(p, zahlen[p.id], stufe);
        const z = zahlTexte(zahlen[p.id]);
        const href = zahlen[p.id]?.href;
        // Stellschrauben (22.10.): ein System-Prozess mit änderbaren Werten trägt statt des Zahnrads den Regler — dezent, dieselbe Größe und Farbe.
        const schrauben = p.quelle === 'system' && einstellbar(p);
        const Zeichen = p.quelle === 'system' ? (schrauben ? SlidersHorizontal : Cog) : p.quelle === 'werkstatt' ? Workflow : LayoutTemplate;
        const aria = `${p.beschriftung ?? p.titel}${t.produkt ? `, ${t.produkt}` : ''}${z?.haupt ? `, ${z.haupt}` : ''}${z?.zweite ? `, ${z.zweite.text}` : ''} — ${p.quelle === 'system' ? (schrauben ? 'System, einstellbar' : 'System, nur lesbar') : p.quelle === 'werkstatt' ? 'Werkstatt' : 'Vorlage'}; öffnen`;
        const spec = KACHEL_TEXT[stufe];
        const titel = einpassen({ text: kachelTitel(p, stufe), breite: k.b - spec.innen, groesse: spec.groesse, min: spec.min, zeilen: spec.zeilen, gewicht: spec.gewicht });
        const hell = hellIds.has(k.id);
        return (
          <g key={k.id} data-pz-id={k.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} aria-label={aria} transform={`translate(${k.x} ${k.y})`}
            onClick={() => onKachel(k.id)} onKeyDown={taste(() => onKachel(k.id))} style={{ cursor: 'pointer' }}
            onMouseEnter={() => onFokus?.(k.id)} onMouseLeave={() => onFokus?.(null)} onFocus={() => onFokus?.(k.id)} onBlur={() => onFokus?.(null)}>
            <rect width={k.b} height={k.h} rx={14} fill={C.flaecheHoch} />
            <rect width={k.b} height={k.h} rx={14} fill={TIEF.flaeche(ton)} stroke={hell ? ton : TIEF.rand(ton)} strokeWidth={hell ? 2.2 : 1.5} />
            <rect x={0} y={12} width={4} height={k.h - 24} rx={2} fill={ton} />
            <Leuchtrand b={k.b} h={k.h} />
            {fern ? (
              <TextBlock e={titel} x={18} mitteY={k.h / 2} gewicht={spec.gewicht} />
            ) : (
              <>
                {t.marke && <text x={18} y={22} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{t.marke.toUpperCase()}</text>}
                <Zeichen x={18} y={(stufe === 'nah' ? k.h / 2 + 2 : k.h / 2) - 9} width={18} height={18} color={ton} aria-hidden />
                <TextBlock e={titel} x={44} mitteY={stufe === 'nah' ? k.h / 2 + 2 : k.h / 2} gewicht={spec.gewicht} />
                {/* Unten: das Produkt, zu dem der Prozess gehört (22.10.), sonst — nah — der Eigner. Eine Zeile, nie doppelt. */}
                {(t.produkt ?? t.eigner) && <text x={18} y={k.h - 10} fontSize={FLAECHE_SCHRIFT.mikro + 1} fill={C.inkDim}>{zeile((t.produkt ?? t.eigner)!, k.b - 36, FLAECHE_SCHRIFT.mikro + 1, FLAECHE_SCHRIFT.mikro).zeilen[0]}</text>}
              </>
            )}
            {/* Die Zahl hängt als Abzeichen an der oberen rechten Ecke (die zweite links daneben) — nie im Text der Kachel, nie doppelt. */}
            {(() => {
              const g = fern ? KACHEL_SCHRIFT.zahlFern : FLAECHE_SCHRIFT.unter;
              const h = Math.round(g * 1.75);
              const haupt = fern ? t.zahl : z?.haupt;
              const zweite = fern ? undefined : z?.zweite;
              return (
                <>
                  {haupt && <ZahlPille x={k.b + 6} y={-h / 2} text={haupt} groesse={g} ton={ton} rechtsBuendig {...(href ? { href, onZahl } : {})} />}
                  {zweite && <ZahlPille x={k.b + 6 - (haupt ? pillenBreite(haupt, g) + 6 : 0)} y={-h / 2} text={zweite.text} rot={zweite.rot} groesse={g} ton={ton} rechtsBuendig {...(href ? { href, onZahl } : {})} />}
                </>
              );
            })()}
          </g>
        );
      })}
      {/* Beschriftungen zuletzt (über den Kacheln, falls ein langer Weg nah an einer vorbeiführt). */}
      {wege.filter(w => w.hell || (w.pfeil.textFrei && !fern)).map(({ pfeil: pf, hell }) => <WegText key={pf.id} text={pf.text} ort={fern ? pf.textOrtFern : pf.textOrt} groesse={fern ? KACHEL_SCHRIFT.wegFern : WEG_TEXT.nah} hell={hell} />)}
    </g>
  );
}

// ── Ebene 2: ein Prozess ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function ProzessBild({ lage, prozess, zahlen, stufe, spitze, onPhase, onGeist, onZahl }: {
  lage: ProzessLage; prozess: ProzessDef; zahlen: Readonly<Record<string, Zahl>>; stufe: ZoomStufe; spitze: string;
  onPhase: (id: string) => void; onGeist: (id: string) => void; onZahl?: (href: string) => void;
}) {
  const ton = tonVon(prozess);
  const fern = stufe === 'fern';
  return (
    <g>
      <defs><FlaecheSpitze id={spitze} /></defs>
      {lage.pfeile.map(pf => <FlaechePfeil key={pf.id} d={linieVon(pf.punkte)} spitze={spitze} />)}
      {[{ box: lage.start, wort: 'Start' }, { box: lage.ende, wort: 'Ergebnis' }].map(m => (
        <g key={m.wort} transform={`translate(${m.box.x} ${m.box.y})`}>
          <rect width={m.box.b} height={m.box.h} rx={m.box.h / 2} fill={C.grund} stroke={C.inkDim} strokeWidth={2} />
          <text x={m.box.b / 2} y={m.box.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={fern ? PHASE_TITEL.fernMin : 17} fontWeight={650} fill={C.ink}>{m.wort}</text>
        </g>
      ))}
      {lage.phasen.map(ph => {
        const zr = zahlen[zahlSchluessel({ p: prozess.id, ph: ph.id })];
        const z = zahlTexte(zr);
        const schritte = prozess.phasen.find(x => x.id === ph.id)?.schritte ?? [];
        return (
          <g key={ph.id} data-pz-id={ph.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} transform={`translate(${ph.x} ${ph.y})`}
            aria-label={`Phase ${ph.nr}: ${ph.titel}, ${schritte.length} Schritte${z?.haupt ? `, ${z.haupt}` : ''} — Ablauf öffnen`}
            onClick={() => onPhase(ph.id)} onKeyDown={taste(() => onPhase(ph.id))} style={{ cursor: 'pointer' }}>
            <rect width={ph.b} height={ph.h} rx={16} fill={C.flaecheHoch} />
            <rect width={ph.b} height={ph.h} rx={16} fill={TIEF.flaeche(ton)} stroke={TIEF.rand(ton)} strokeWidth={1.5} />
            <Leuchtrand b={ph.b} h={ph.h} rx={16} />
            <text x={18} y={26} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{`PHASE ${ph.nr}`}</text>
            {fern
              ? <TextBlock e={einpassen({ text: ph.titel, breite: ph.b - 36, groesse: PHASE_TITEL.fern, min: PHASE_TITEL.fernMin, zeilen: 2, gewicht: 700 })} x={18} mitteY={Math.min(ph.h / 2 + 8, 76)} gewicht={700} />
              : <TextBlock e={zeile(ph.titel, ph.b - 36, PHASE_TITEL.mittel, PHASE_TITEL.mittelMin, 700)} x={18} mitteY={50} gewicht={700} />}
            {z?.haupt && <ZahlPille x={ph.b + 6} y={-12} text={z.haupt} ton={ton} rechtsBuendig {...(zr?.href && onZahl ? { href: zr.href, onZahl } : {})} />}
            {/* Ebene 2: der Hauptweg als ruhige Aufzählung — Formen (Raute, Erinnerung …) erst im Ablauf (Punkt 5). */}
            {!fern && ph.zeilen.map((t, i) => (
              <g key={i}>
                <circle cx={24} cy={87 + i * 28} r={3} fill={C.inkLeise} />
                <TextBlock e={zeile(t, ph.b - 54, 15, 15)} x={36} mitteY={87 + i * 28} farbe={C.inkDim} gewicht={400} />
              </g>
            ))}
            {!fern && ph.mehr > 0 && <text x={36} y={92 + ph.zeilen.length * 28} fontSize={15} fill={C.inkLeise}>{`+${ph.mehr} weitere`}</text>}
          </g>
        );
      })}
      {lage.geister.map(g => {
        const id = `geist:${g.id}`;
        const titel = einpassen({ text: fern ? kurztitel(g.titel) : g.titel, breite: g.b - 28, groesse: fern ? 22 : 15, min: fern ? 18 : 13, zeilen: 2, gewicht: 600 });
        return (
          <g key={id} data-pz-id={id} data-pz-klick="" role="button" tabIndex={0} transform={`translate(${g.x} ${g.y})`} aria-label={`${g.richtung === 'von' ? 'Kommt von' : 'Geht an'}: ${g.titel} (${g.text}) — dorthin`}
            onClick={() => onGeist(g.id)} onKeyDown={taste(() => onGeist(g.id))} style={{ cursor: 'pointer' }}>
            <rect width={g.b} height={g.h} rx={12} fill={C.grund} stroke={RAND.stark} strokeWidth={1.4} strokeDasharray="6 5" />
            <Leuchtrand b={g.b} h={g.h} rx={12} />
            <text x={14} y={20} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{g.richtung === 'von' ? 'KOMMT VON' : 'GEHT AN'}</text>
            <TextBlock e={titel} x={14} mitteY={titel.zeilen.length > 1 ? 47 : 46} farbe={C.inkDim} gewicht={600} />
          </g>
        );
      })}
      {!fern && lage.pfeile.map(pf => <WegText key={`t:${pf.id}`} text={pf.text} ort={pf.textOrt} groesse={FLAECHE_SCHRIFT.unter} />)}
    </g>
  );
}

// ── Ebene 3/4: der Ablauf auf der Fläche (dieselben Formen wie im Editor, nur lesbar) ─────────────────────────────────────────────────────

export function AblaufBild({ bild, prozess, zahlen, gewaehlt, stufe, spitze, ende, onSchritt, onPhase, onZahl }: {
  bild: FlaecheBild; prozess: ProzessDef; zahlen: Readonly<Record<string, Zahl>>; gewaehlt: string | null; stufe: ZoomStufe; spitze: string;
  ende: ReadonlySet<string>; onSchritt: (phaseId: string, id: string) => void; onPhase: (id: string) => void; onZahl?: (href: string) => void;
}) {
  const fern = stufe === 'fern';
  const ton = tonVon(prozess);
  const pfeile = bild.pfeile.filter(pf => !ende.has(pf.von));
  return (
    <g>
      <defs><FlaecheSpitze id={spitze} /></defs>
      {bild.rahmen.map(r => (
        <g key={r.id} data-pz-id={r.id} transform={`translate(${r.x} ${r.y})`}>
          <FlaecheRahmen b={r.b} h={r.h} nr={r.nr} titel={r.titel} kopf={80} />
          <rect data-pz-klick="" role="button" tabIndex={0} aria-label={`Phase ${r.nr}: ${r.titel}`} width={r.b} height={66} fill="transparent" style={{ cursor: 'pointer' }}
            onClick={() => onPhase(r.id)} onKeyDown={taste(() => onPhase(r.id))} />
          <Leuchtrand b={r.b} h={r.h} rx={16} />
        </g>
      ))}
      {bild.gruppen.map(g => <g key={g.id} transform={`translate(${g.box.x} ${g.box.y})`}><FlaecheGruppe b={g.box.b} h={g.box.h} titel={g.titel} /></g>)}
      {pfeile.map(pf => <FlaechePfeil key={pf.id} d={pfadVon(pf.punkte)} spitze={spitze} text={fern ? undefined : pf.text} textOrt={fern || !pf.text ? undefined : pfeilTextOrt(pf.punkte)} gestrichelt={pf.art === 'zurueck'} />)}
      {bild.starts.map(s => <g key={s.id} transform={`translate(${s.x} ${s.y})`}><FlaecheStart b={s.b} h={s.h} titel={s.titel} /></g>)}
      {bild.abstimmungen.map(a => <g key={a.id} transform={`translate(${a.x} ${a.y})`}><FlaecheForm form="entscheidung" umriss="raute" b={a.b} h={a.h} titel={a.titel} /></g>)}
      {bild.knoten.map(k => {
        const zr = zahlen[zahlSchluessel({ p: prozess.id, ph: k.phaseId, s: k.id })];
        const z = zahlTexte(zr);
        return (
          <g key={k.id} data-pz-id={k.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} transform={`translate(${k.x} ${k.y})`}
            aria-label={`${k.titel}${z?.haupt ? `, ${z.haupt}` : ''}${ende.has(k.id) ? ', Ende dieses Wegs' : ''} — Schritt öffnen`} aria-pressed={gewaehlt === k.id}
            onClick={() => onSchritt(k.phaseId, k.id)} onKeyDown={taste(() => onSchritt(k.phaseId, k.id))} style={{ cursor: 'pointer' }}>
            <FlaecheForm form={k.form} umriss={k.umriss} b={k.b} h={k.h} titel={k.titel} gewaehlt={gewaehlt === k.id} />
            <Leuchtrand b={k.b} h={k.h} rx={10} />
            {z?.haupt && <ZahlPille x={k.b + 6} y={-14} text={z.haupt} ton={ton} rechtsBuendig {...(zr?.href && onZahl ? { href: zr.href, onZahl } : {})} />}
            {ende.has(k.id) && <text x={k.b / 2} y={k.h + 22} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.unter} fontWeight={600} fill={C.inkLeise}>■ Ende</text>}
          </g>
        );
      })}
    </g>
  );
}

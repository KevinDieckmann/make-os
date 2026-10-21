'use client';

// ─── Prozesse — die Zeichnungen der drei Ebenen (Etappe A, 21.10.; ANALYSE_100.md Punkte 2–5, 9, 14, 21, 24, 26, 27) ───────────────────────────
// Die Komponenten ZEICHNEN nur (SVG in Welt-Koordinaten, die Bühne setzt die Kamera) — gerechnet wird in lib/prozesse/* (Lage, Regeln). Miro-Stil, wenig
// und klar: je Kachel Titel und EINE Zahl (die zweite nur rot bei einer Frist), der Rest auf Klick; Farbe nie allein (Wort, Form, Zeichen). Die Linien
// sind Lichtfäden auf der Ebene darunter (die Bühne) — hier stehen nur Spitze und Beschriftung (FlaechePfeil; CSS blendet den Strich aus, solange der
// Flow läuft). Formen der Ebene 3 sind dieselben wie im Prozess-Editor (components/os/ui/reise/flaeche-formen.tsx).
//   · `LandkarteBild`  Ebene 1 — Bänder, die Fliege mit ihren Stufen, Kacheln, Übergaben
//   · `ProzessBild`    Ebene 2 — Start, Phasen mit ihren ersten Schritten, Ergebnis, Geister (woher, wohin)
//   · `AblaufBild`     Ebene 3/4 — die Fläche des Editors (`flaecheBild`), nur lesbar; Enden ohne Pfeil weiter

import type { KeyboardEvent as RKeyboardEvent, MouseEvent as RMouseEvent } from 'react';
import { Cog, LayoutTemplate, AlertTriangle } from 'lucide-react';
import { FARBE as C, TIEF, RAND, FLAECHE_STIL } from '@/lib/make-one/design';
import { pfadVon, pfeilTextOrt, type FlaecheBild } from '@/lib/fulfillment/prozesse/flaeche';
import type { FliegeLage, ProzessLage } from '@/lib/prozesse/landkarte';
import type { ProzessDef, Zahl } from '@/lib/prozesse/typen';
import { kachelTexte, zahlTexte, zahlSchluessel } from '@/lib/prozesse/modell';
import { STUFE_FARBE, tonVon } from '@/lib/prozesse/farben';
import type { ZoomStufe } from '../ui/flaeche/stufe';
import { FlaecheForm, FlaecheStart, FlaecheRahmen, FlaecheGruppe, FlaechePfeil, FlaecheSpitze, FLAECHE_SCHRIFT, textZeilen } from '../ui/reise/flaeche-formen';
import { FORM_FARBE, JETZT } from '../ui/reise/formen';
import type { FlussForm } from '@/lib/reise/bild';

/** Tastatur an einem SVG-Knopf: Enter bzw. Leertaste lösen aus. */
const taste = (f: () => void) => (e: RKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f(); } };

/** Text in Zeilen (links bündig). */
function Text({ text, x, y, breite, groesse, zeilen = 2, farbe = C.ink, gewicht = 600, mitte }: { text: string; x: number; y: number; breite: number; groesse: number; zeilen?: number; farbe?: string; gewicht?: number; mitte?: boolean }) {
  const z = textZeilen(text, breite, groesse, zeilen);
  return (
    <text x={x} y={y} fontSize={groesse} fontWeight={gewicht} fill={farbe} textAnchor={mitte ? 'middle' : 'start'} style={{ pointerEvents: 'none' }}>
      {z.map((t, i) => <tspan key={i} x={x} dy={i ? groesse * 1.22 : 0}>{t}</tspan>)}
    </text>
  );
}

/** Eine Zahl als Pille (Zahl + Wort; rot mit Zeichen nur bei einer Frist) — ein Klick zeigt die Fälle (Punkt 27). */
function ZahlPille({ x, y, text, rot, groesse = FLAECHE_SCHRIFT.unter, ton, href, onZahl, rechtsBuendig }: { x: number; y: number; text: string; rot?: boolean; groesse?: number; ton: string; href?: string; onZahl?: (href: string) => void; rechtsBuendig?: boolean }) {
  const farbe = rot ? C.kritisch : ton;
  const b = Math.round(text.length * groesse * 0.58 + (rot ? groesse + 22 : 18));
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

/** Ein kleines Zeichen je Form (Kasten, Brief, Raute, Pille, Kalender) — die Form trägt die Bedeutung, die Farbe kommt dazu. */
function FormMini({ form, x, y }: { form: FlussForm; x: number; y: number }) {
  const f = FORM_FARBE[form];
  const s = { fill: TIEF.flaeche(f), stroke: f, strokeWidth: 1.4 };
  if (form === 'entscheidung') return <polygon points={`${x + 6},${y} ${x + 12},${y + 6} ${x + 6},${y + 12} ${x},${y + 6}`} {...s} />;
  if (form === 'erinnerung') return <rect x={x} y={y + 1} width={13} height={10} rx={5} {...s} />;
  if (form === 'nachricht') return <g><rect x={x} y={y + 1} width={13} height={10} rx={1.5} {...s} /><path d={`M${x} ${y + 2} L${x + 6.5} ${y + 7} L${x + 13} ${y + 2}`} fill="none" stroke={f} strokeWidth={1.2} /></g>;
  if (form === 'termin') return <g><rect x={x} y={y + 1} width={13} height={11} rx={1.5} {...s} /><line x1={x} x2={x + 13} y1={y + 4} y2={y + 4} stroke={f} strokeWidth={1.4} /></g>;
  return <rect x={x} y={y + 1} width={13} height={10} rx={1.5} {...s} />;
}

/** Rand zum Aufleuchten (sichtbar nur mit `data-pz-leuchten` am Element — CSS). */
const Leuchtrand = ({ b, h, rx = 14 }: { b: number; h: number; rx?: number }) => <rect className="pz-leuchtrand" x={-6} y={-6} width={b + 12} height={h + 12} rx={rx + 4} fill="none" stroke={JETZT} strokeWidth={3} />;

// ── Ebene 1: die Landkarte als Fliege ─────────────────────────────────────────────────────────────────────────────────────────────────

export function LandkarteBild({ lage, prozesse, zahlen, stufe, spitze, onKachel, onZahl }: {
  lage: FliegeLage; prozesse: ReadonlyMap<string, ProzessDef>; zahlen: Readonly<Record<string, Zahl>>; stufe: ZoomStufe; spitze: string;
  onKachel: (id: string) => void; onZahl: (href: string) => void;
}) {
  const fern = stufe === 'fern';
  const { fliege } = lage;
  return (
    <g>
      <defs><FlaecheSpitze id={spitze} /></defs>
      {lage.baender.map(b => (
        <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
          <rect data-pz-rand="" width={b.b} height={b.h} rx={22} fill={FLAECHE_STIL.leise.background} stroke={RAND.stark} strokeWidth={1.2} />
          <text x={22} y={34} fontSize={fern ? 26 : 13} fontWeight={700} letterSpacing="1.4" fill={C.inkDim}>{b.titel.toUpperCase()}</text>
          {!fern && <text x={22 + b.titel.length * 11 + 22} y={34} fontSize={13} fill={C.inkLeise}>{b.satz}</text>}
        </g>
      ))}
      {/* Die Fliege: Umriss, darüber je Stufe ihr Wort mit Farbpunkt (Farbe nie allein). */}
      <path data-pz-rand="" d={fliege.pfad} fill={FLAECHE_STIL.leise.background} stroke={RAND.stark} strokeWidth={1.2} />
      {!fern && <text x={fliege.x0} y={fliege.titelY - 34} fontSize={13} fontWeight={700} letterSpacing="1.4" fill={C.inkDim}>KERN<tspan dx={14} fontWeight={400} letterSpacing="0" fill={C.inkLeise}>Kunden gewinnen → übergeben → liefern und ausbauen</tspan></text>}
      {fliege.stufen.map(s => (
        <g key={s.id}>
          <circle cx={s.cx - (fern ? 14 : 8) - s.titel.length * (fern ? 9.4 : 4.6)} cy={fliege.titelY - (fern ? 8 : 4)} r={fern ? 8 : 5} fill={STUFE_FARBE[s.id]} />
          <text x={s.cx} y={fliege.titelY} textAnchor="middle" fontSize={fern ? 30 : 15} fontWeight={700} letterSpacing="1.2" fill={C.ink}>{s.titel.toUpperCase()}</text>
        </g>
      ))}
      {/* Übergaben: Spitze und Beschriftung (der Strich ist der Lichtfaden darunter). */}
      {lage.pfeile.map(pf => (
        <FlaechePfeil key={pf.id} d={pfadVon(pf.punkte)} spitze={spitze} text={fern ? undefined : pf.text} textOrt={fern ? undefined : pf.textOrt} gestrichelt={pf.art === 'zurueck'} />
      ))}
      {lage.kacheln.map(k => {
        const p = prozesse.get(k.id);
        if (!p) return null;
        const ton = tonVon(p);
        const t = kachelTexte(p, zahlen[p.id], stufe);
        const z = zahlTexte(zahlen[p.id]);
        const href = zahlen[p.id]?.href;
        const Zeichen = p.quelle === 'system' ? Cog : LayoutTemplate;
        const aria = `${p.titel}${z?.haupt ? `, ${z.haupt}` : ''}${z?.zweite ? `, ${z.zweite.text}` : ''} — ${p.quelle === 'system' ? 'System, nur lesbar' : 'Vorlage'}; öffnen`;
        return (
          <g key={k.id} data-pz-id={k.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} aria-label={aria} transform={`translate(${k.x} ${k.y})`}
            onClick={() => onKachel(k.id)} onKeyDown={taste(() => onKachel(k.id))} style={{ cursor: 'pointer' }}>
            <rect width={k.b} height={k.h} rx={14} fill={C.flaecheHoch} />
            <rect width={k.b} height={k.h} rx={14} fill={TIEF.flaeche(ton)} stroke={TIEF.rand(ton)} strokeWidth={1.5} />
            <rect x={0} y={12} width={4} height={k.h - 24} rx={2} fill={ton} />
            <Leuchtrand b={k.b} h={k.h} />
            {fern ? (
              <Text text={t.titel ?? ''} x={18} y={k.h / 2 - (textZeilen(t.titel ?? '', k.b - 30, 24, 2).length > 1 ? 10 : -8)} breite={k.b - 30} groesse={24} gewicht={700} />
            ) : (
              <>
                <Zeichen x={16} y={stufe === 'nah' ? 30 : 14} width={16} height={16} color={ton} aria-hidden />
                {t.marke && <text x={16} y={20} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{t.marke.toUpperCase()}</text>}
                <Text text={t.titel ?? ''} x={40} y={stufe === 'nah' ? 43 : 27} breite={k.b - 54} groesse={stufe === 'nah' ? 15 : 16} gewicht={650} />
                {t.eigner && <text x={16} y={k.h - 12} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>{t.eigner}</text>}
              </>
            )}
            {/* Die Zahl: fern groß über der Ecke, sonst unten bzw. (nah) oben rechts. */}
            {fern && t.zahl && <ZahlPille x={k.b + 8} y={-24} text={t.zahl} groesse={22} ton={ton} rechtsBuendig {...(href ? { href, onZahl } : {})} />}
            {!fern && z?.haupt && <ZahlPille x={stufe === 'nah' ? k.b - 10 : 16} y={stufe === 'nah' ? 6 : k.h - 30} text={z.haupt} ton={ton} rechtsBuendig={stufe === 'nah'} {...(href ? { href, onZahl } : {})} />}
            {!fern && z?.zweite && <ZahlPille x={stufe === 'nah' ? k.b - 10 : z.haupt ? 26 + z.haupt.length * 7.6 + 18 : 16} y={stufe === 'nah' ? 32 : k.h - 30} text={z.zweite.text} rot={z.zweite.rot} ton={ton} rechtsBuendig={stufe === 'nah'} {...(href ? { href, onZahl } : {})} />}
          </g>
        );
      })}
    </g>
  );
}

// ── Ebene 2: ein Prozess ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function ProzessBild({ lage, prozess, zahlen, stufe, spitze, onPhase, onGeist }: {
  lage: ProzessLage; prozess: ProzessDef; zahlen: Readonly<Record<string, Zahl>>; stufe: ZoomStufe; spitze: string;
  onPhase: (id: string) => void; onGeist: (id: string) => void;
}) {
  const ton = tonVon(prozess);
  const fern = stufe === 'fern';
  return (
    <g>
      <defs><FlaecheSpitze id={spitze} /></defs>
      {lage.pfeile.map(pf => <FlaechePfeil key={pf.id} d={pfadVon(pf.punkte)} spitze={spitze} text={fern ? undefined : pf.text} textOrt={fern ? undefined : pf.textOrt} />)}
      <g transform={`translate(${lage.start.x} ${lage.start.y})`}><FlaecheStart b={lage.start.b} h={lage.start.h} titel="Start" /></g>
      <g transform={`translate(${lage.ende.x} ${lage.ende.y})`}><FlaecheStart b={lage.ende.b} h={lage.ende.h} titel="Ergebnis" /></g>
      {lage.phasen.map(ph => {
        const z = zahlTexte(zahlen[zahlSchluessel({ p: prozess.id, ph: ph.id })]);
        const schritte = prozess.phasen.find(x => x.id === ph.id)?.schritte ?? [];
        return (
          <g key={ph.id} data-pz-id={ph.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} transform={`translate(${ph.x} ${ph.y})`}
            aria-label={`Phase ${ph.nr}: ${ph.titel}, ${schritte.length} Schritte${z?.haupt ? `, ${z.haupt}` : ''} — Ablauf öffnen`}
            onClick={() => onPhase(ph.id)} onKeyDown={taste(() => onPhase(ph.id))} style={{ cursor: 'pointer' }}>
            <rect width={ph.b} height={ph.h} rx={16} fill={C.flaecheHoch} />
            <rect width={ph.b} height={ph.h} rx={16} fill={TIEF.flaeche(ton)} stroke={TIEF.rand(ton)} strokeWidth={1.5} />
            <Leuchtrand b={ph.b} h={ph.h} rx={16} />
            <text x={18} y={26} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{`PHASE ${ph.nr}`}</text>
            <text x={18} y={52} fontSize={17} fontWeight={700} fill={C.ink}>{textZeilen(ph.titel, ph.b - 36, 17, 1)[0] ?? ''}</text>
            {z?.haupt && <ZahlPille x={ph.b - 12} y={10} text={z.haupt} ton={ton} rechtsBuendig />}
            {!fern && ph.zeilen.map((t, i) => (
              <g key={i}>
                <FormMini form={schritte[i]?.form ?? 'schritt'} x={18} y={72 + i * 26} />
                <text x={40} y={83 + i * 26} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>{textZeilen(t, ph.b - 58, FLAECHE_SCHRIFT.unter, 1)[0] ?? ''}</text>
              </g>
            ))}
            {!fern && ph.mehr > 0 && <text x={40} y={83 + ph.zeilen.length * 26} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkLeise}>{`+${ph.mehr} weitere`}</text>}
          </g>
        );
      })}
      {lage.geister.map(g => {
        const id = `geist:${g.id}`;
        return (
          <g key={id} data-pz-id={id} data-pz-klick="" role="button" tabIndex={0} transform={`translate(${g.x} ${g.y})`} aria-label={`${g.richtung === 'von' ? 'Kommt von' : 'Geht an'}: ${g.titel} (${g.text}) — dorthin`}
            onClick={() => onGeist(g.id)} onKeyDown={taste(() => onGeist(g.id))} style={{ cursor: 'pointer' }}>
            <rect width={g.b} height={g.h} rx={12} fill={C.grund} stroke={RAND.stark} strokeWidth={1.4} strokeDasharray="6 5" />
            <Leuchtrand b={g.b} h={g.h} rx={12} />
            <text x={14} y={22} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise}>{g.richtung === 'von' ? 'KOMMT VON' : 'GEHT AN'}</text>
            <text x={14} y={46} fontSize={14} fontWeight={600} fill={C.inkDim}>{textZeilen(g.titel, g.b - 28, 14, 1)[0] ?? ''}</text>
          </g>
        );
      })}
    </g>
  );
}

// ── Ebene 3/4: der Ablauf auf der Fläche (dieselben Formen wie im Editor, nur lesbar) ─────────────────────────────────────────────────────

export function AblaufBild({ bild, prozess, zahlen, gewaehlt, stufe, spitze, ende, onSchritt, onPhase }: {
  bild: FlaecheBild; prozess: ProzessDef; zahlen: Readonly<Record<string, Zahl>>; gewaehlt: string | null; stufe: ZoomStufe; spitze: string;
  ende: ReadonlySet<string>; onSchritt: (phaseId: string, id: string) => void; onPhase: (id: string) => void;
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
        const z = zahlTexte(zahlen[zahlSchluessel({ p: prozess.id, ph: k.phaseId, s: k.id })]);
        return (
          <g key={k.id} data-pz-id={k.id} data-pz-klick="" className="pz-kachel" role="button" tabIndex={0} transform={`translate(${k.x} ${k.y})`}
            aria-label={`${k.titel}${z?.haupt ? `, ${z.haupt}` : ''}${ende.has(k.id) ? ', Ende dieses Wegs' : ''} — Schritt öffnen`} aria-pressed={gewaehlt === k.id}
            onClick={() => onSchritt(k.phaseId, k.id)} onKeyDown={taste(() => onSchritt(k.phaseId, k.id))} style={{ cursor: 'pointer' }}>
            <FlaecheForm form={k.form} umriss={k.umriss} b={k.b} h={k.h} titel={k.titel} gewaehlt={gewaehlt === k.id} />
            <Leuchtrand b={k.b} h={k.h} rx={10} />
            {z?.haupt && <ZahlPille x={k.b + 6} y={-14} text={z.haupt} ton={ton} rechtsBuendig />}
            {ende.has(k.id) && <text x={k.b / 2} y={k.h + 22} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.unter} fontWeight={600} fill={C.inkLeise}>■ Ende</text>}
          </g>
        );
      })}
    </g>
  );
}

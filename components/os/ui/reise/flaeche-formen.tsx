// ─── Standard · Reise + Fluss — die Formen auf der FLÄCHE (SVG, 17.10.; DESIGN_STANDARD.md › Prozess-Visualisierung › Fläche) ─────────────────
// Rückmeldung 17.10.: „Zeichnen wie in Miro: freie Fläche, Kästen frei platzieren, Pfeile ziehen, zoomen und schieben, Rahmen für Phasen.“ Dieselben Formen
// wie im Fluss (components/os/ui/reise/Fluss.tsx) — nur als SVG, damit die Fläche zoomen, 300 Knoten flüssig zeigen und als Bild (SVG/PNG) gespeichert werden
// kann. Die Bedeutung trägt die Form (Kasten, Brief, Raute, Glocke, Kalender), die Farbe kommt dazu (`FORM_FARBE`), Rahmen = Phase, gestrichelt = Gruppe.
// Rechnet nichts, holt keine Daten (die Lage kommt fertig aus dem Modell des Bereichs, Fulfillment: lib/fulfillment/prozesse/flaeche.ts).

import { Mail, BellRing, CalendarClock } from 'lucide-react';
import { FARBE as C, TIEF, RAND, LEUCHT, FLAECHE_STIL } from '@/lib/make-one/design';
import { FORM_NAME, type FlussForm } from '@/lib/reise/bild';
import { FLOW, type FlowFaden } from '@/lib/lichtfaeden/flow';
import { FORM_FARBE, JETZT } from './formen';

export type FlaecheUmriss = 'kasten' | 'raute' | 'termin';

/** Schriftgrößen auf der Fläche (Bildpunkte der Fläche; nie unter 13 — beim Zoomen wachsen sie mit). */
export const FLAECHE_SCHRIFT = { titel: 15, unter: 13, rahmen: 20, mikro: 11 } as const;

/**
 * Text in Zeilen umbrechen — grob nach Zeichen (≈ 0,56 · Schriftgröße je Zeichen), an Wortgrenzen, höchstens `zeilen` Zeilen, Rest mit „…“. Lange Wörter
 * werden geteilt. Rein (für die Tests).
 */
export function textZeilen(text: string, breite: number, groesse: number, zeilen = 2): string[] {
  const max = Math.max(4, Math.floor(breite / (groesse * 0.56)));
  const woerter = text.trim().split(/\s+/).filter(Boolean).flatMap(w => (w.length > max ? w.match(new RegExp(`.{1,${max}}`, 'g')) ?? [w] : [w]));
  const raus: string[] = [];
  let z = '';
  for (const w of woerter) {
    const t = z ? `${z} ${w}` : w;
    if (t.length <= max) { z = t; continue; }
    raus.push(z); z = w;
  }
  if (z) raus.push(z);
  if (raus.length <= zeilen) return raus;
  const rest = raus.slice(0, zeilen);
  const letzte = rest[zeilen - 1];
  rest[zeilen - 1] = `${letzte.length >= max ? letzte.slice(0, max - 1) : letzte}…`;
  return rest;
}

function Zeilen({ text, x, y, breite, groesse, zeilen = 2, farbe = C.ink, gewicht = 600 }: { text: string; x: number; y: number; breite: number; groesse: number; zeilen?: number; farbe?: string; gewicht?: number }) {
  const z = textZeilen(text, breite, groesse, zeilen);
  const hoehe = groesse * 1.25;
  const start = y - ((z.length - 1) * hoehe) / 2;
  return (
    <text x={x} textAnchor="middle" fontSize={groesse} fontWeight={gewicht} fill={farbe} style={{ pointerEvents: 'none' }}>
      {z.map((t, i) => <tspan key={i} x={x} y={start + i * hoehe} dominantBaseline="middle">{t}</tspan>)}
    </text>
  );
}

/**
 * Ein Knoten der Fläche in seiner Form, an (0, 0) mit b × h: Schritt = Kasten (grün getönt), Nachricht = Kasten mit Brief (gelb), Entscheidung/Abstimmung =
 * Raute, Erinnerung = abgerundeter Kasten mit Glocke (orange), Termin = Kasten mit Kalender (ein Knoten, keine Überschrift — 18.10., N12). `gewaehlt` = heller Rand, `ziel` = Petrol
 * (hier landet ein Pfeil bzw. ein abgelegter Knoten).
 */
export function FlaecheForm({ form, umriss, b, h, titel, unter, gewaehlt, ziel }: { form: FlussForm; umriss: FlaecheUmriss; b: number; h: number; titel: string; unter?: string; gewaehlt?: boolean; ziel?: boolean }) {
  const f = FORM_FARBE[form];
  const rand = ziel ? JETZT : gewaehlt ? C.ink : TIEF.rand(f);
  const breit = gewaehlt || ziel ? 2.5 : 1.5;
  if (umriss === 'raute') {
    return (
      <g>
        <polygon points={`${b / 2},0 ${b},${h / 2} ${b / 2},${h} 0,${h / 2}`} fill={TIEF.flaeche(f)} stroke={rand} strokeWidth={breit} strokeLinejoin="round" />
        <Zeilen text={titel} x={b / 2} y={h / 2} breite={b * 0.72} groesse={FLAECHE_SCHRIFT.unter} zeilen={3} />
      </g>
    );
  }
  if (umriss === 'termin') {
    // Termin = Kasten mit Kalender (flacher als ein Schritt, `FL.termin`), Titel bis zwei Zeilen — wie jeder andere Knoten.
    return (
      <g>
        <rect width={b} height={h} rx={8} fill={TIEF.flaeche(f)} stroke={rand} strokeWidth={breit} />
        <CalendarClock x={10} y={h / 2 - 9} width={18} height={18} color={f} aria-hidden />
        <Zeilen text={titel} x={32 + (b - 44) / 2} y={h / 2} breite={b - 44} groesse={FLAECHE_SCHRIFT.titel} />
      </g>
    );
  }
  const zeichen = form === 'nachricht' ? Mail : form === 'erinnerung' ? BellRing : null;
  const Z = zeichen;
  const textB = b - (Z ? 44 : 24);
  return (
    <g>
      <rect width={b} height={h} rx={form === 'erinnerung' ? 22 : 8} fill={TIEF.flaeche(f)} stroke={rand} strokeWidth={breit} />
      {Z && <Z x={10} y={10} width={18} height={18} color={f} aria-hidden />}
      <Zeilen text={titel} x={(Z ? 32 : 12) + textB / 2} y={unter ? h / 2 - 10 : h / 2} breite={textB} groesse={FLAECHE_SCHRIFT.titel} />
      {unter && <Zeilen text={unter} x={b / 2} y={h - 18} breite={b - 20} groesse={FLAECHE_SCHRIFT.unter} zeilen={1} farbe={C.inkLeise} gewicht={400} />}
    </g>
  );
}

/** Der Start einer Phase: Kreis bzw. Pille (womit sie beginnt). */
export function FlaecheStart({ b, h, titel }: { b: number; h: number; titel: string }) {
  return (
    <g>
      <rect width={b} height={h} rx={h / 2} fill={C.grund} stroke={C.inkDim} strokeWidth={2} />
      <Zeilen text={titel} x={b / 2} y={h / 2} breite={b - 30} groesse={FLAECHE_SCHRIFT.unter} zeilen={2} />
    </g>
  );
}

/** Ein Rahmen = eine Phase: Fläche, Titelzeile („PHASE n“ + Titel), „intern“, wenn der Kunde sie nicht sieht. */
export function FlaecheRahmen({ b, h, nr, titel, intern, gewaehlt, kopf }: { b: number; h: number; nr: number; titel: string; intern?: boolean; gewaehlt?: boolean; kopf: number }) {
  return (
    <g>
      <rect data-teil="rahmen" width={b} height={h} rx={16} fill={FLAECHE_STIL.leise.background} stroke={gewaehlt ? C.ink : RAND.stark} strokeWidth={gewaehlt ? 2.5 : 1.5} />
      <line data-teil="linie" x1={0} x2={b} y1={kopf - 14} y2={kopf - 14} stroke={RAND.haar} strokeWidth={1} />
      <text x={20} y={26} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkLeise} style={{ pointerEvents: 'none' }}>{`PHASE ${nr}${intern ? ' · INTERN' : ''}`}</text>
      <text x={20} y={52} fontSize={FLAECHE_SCHRIFT.rahmen} fontWeight={700} fill={C.ink} style={{ pointerEvents: 'none' }}>{textZeilen(titel, b - 40, FLAECHE_SCHRIFT.rahmen, 1)[0] ?? ''}</text>
    </g>
  );
}

/** Eine Gruppe (benannter Teilprozess): gestrichelter Rand um ihre Schritte, Titel oben. */
export function FlaecheGruppe({ b, h, titel }: { b: number; h: number; titel: string }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect width={b} height={h} rx={12} fill="none" stroke={RAND.stark} strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={12} y={18} fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="1.1" fill={C.inkDim}>{textZeilen(titel.toUpperCase(), b - 24, FLAECHE_SCHRIFT.mikro, 1)[0] ?? ''}</text>
    </g>
  );
}

/** Die Spitze der Pfeile (einmal je Zeichnung, `id` eindeutig). */
export function FlaecheSpitze({ id, farbe = C.inkDim }: { id: string; farbe?: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <path d="M0,0 L10,5 L0,10 z" fill={farbe} />
    </marker>
  );
}

/**
 * Ein Pfeil: der gewinkelte Pfad (fertig gerechnet) mit Spitze, optional beschriftet („ja“, „nein“ oder frei) — die Beschriftung auf dunklem Grund.
 * Markenzeichen: der Flow — live zeichnet die Faden-Ebene unter dem SVG den Pfeil als Lichtfaden (CSS blendet den Strich aus, `data-gewaehlt` bleibt sichtbar);
 * `faden` (nur „Als Bild speichern“) zeichnet ihn als ruhiges Standbild in seiner Farbe: leiser breiter Schein + feiner Kern (FLOW.standbild).
 */
export function FlaechePfeil({ d, spitze, text, textOrt, gewaehlt, gestrichelt, faden }: { d: string; spitze: string; text?: string; textOrt?: [number, number]; gewaehlt?: boolean; gestrichelt?: boolean; faden?: Pick<FlowFaden, 'farbe' | 'bisHier'> }) {
  const farbe = gewaehlt ? C.ink : C.inkDim;
  const breite = text ? Math.max(28, text.length * FLAECHE_SCHRIFT.unter * 0.58 + 14) : 0;
  const S = FLOW.standbild;
  const leise = faden && faden.bisHier === 0 ? S.gedaempft : 1;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {faden && <path d={d} fill="none" stroke={faden.farbe} strokeOpacity={S.schein.deckkraft * leise} strokeWidth={S.schein.breite} strokeLinecap="round" strokeLinejoin="round" />}
      {faden
        ? <path data-teil="pfad" d={d} fill="none" stroke={faden.farbe} strokeOpacity={S.kern.deckkraft * leise} strokeWidth={S.kern.breite} strokeDasharray={gestrichelt ? '6 5' : undefined} strokeLinecap="round" markerEnd={`url(#${spitze})`} />
        : <path data-teil="pfad" data-gewaehlt={gewaehlt ? '' : undefined} data-zurueck={gestrichelt ? '' : undefined} d={d} fill="none" stroke={farbe} strokeWidth={gewaehlt ? 2.5 : 2} strokeDasharray={gestrichelt ? '6 5' : undefined} markerEnd={`url(#${spitze})`} />}
      {text && textOrt && (
        <g data-teil="text" transform={`translate(${textOrt[0]} ${textOrt[1]})`}>
          <rect x={-breite / 2} y={-12} width={breite} height={24} rx={12} fill={C.grund} stroke={RAND.stark} />
          <text textAnchor="middle" dominantBaseline="middle" fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>{text}</text>
        </g>
      )}
    </g>
  );
}

/** Die Legende als SVG (für „Als Bild speichern“): Start, die Formen, Rahmen = Phase — Form + Wort, nie nur Farbe. */
export function FlaecheLegende({ x, y }: { x: number; y: number }) {
  const formen: { form: FlussForm; umriss: FlaecheUmriss; wort: string }[] = [
    { form: 'schritt', umriss: 'kasten', wort: FORM_NAME.schritt },
    { form: 'nachricht', umriss: 'kasten', wort: FORM_NAME.nachricht },
    { form: 'entscheidung', umriss: 'raute', wort: 'Entscheidung · Bestätigung' },
    { form: 'erinnerung', umriss: 'kasten', wort: FORM_NAME.erinnerung },
    { form: 'termin', umriss: 'termin', wort: FORM_NAME.termin },
  ];
  let dx = 0;
  const teile = [
    <g key="start" transform={`translate(${dx} 0)`}><rect width={34} height={22} rx={11} fill={C.grund} stroke={C.inkDim} strokeWidth={2} /><text x={44} y={15} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>Start</text></g>,
  ];
  dx += 110;
  for (const f of formen) {
    const farbe = FORM_FARBE[f.form];
    teile.push(
      <g key={f.form} transform={`translate(${dx} 0)`}>
        {f.umriss === 'raute' ? <polygon points="17,0 34,11 17,22 0,11" fill={TIEF.flaeche(farbe)} stroke={TIEF.rand(farbe)} strokeWidth={1.5} />
          : f.umriss === 'termin' ? <g><rect width={34} height={22} rx={4} fill={TIEF.flaeche(farbe)} stroke={TIEF.rand(farbe)} strokeWidth={1.5} /><CalendarClock x={10} y={4} width={14} height={14} color={farbe} aria-hidden /></g>
            : <rect width={34} height={22} rx={f.form === 'erinnerung' ? 11 : 4} fill={TIEF.flaeche(farbe)} stroke={TIEF.rand(farbe)} strokeWidth={1.5} />}
        <text x={44} y={15} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>{f.wort}</text>
      </g>,
    );
    dx += 44 + f.wort.length * 7.6 + 30;
  }
  teile.push(
    <g key="rahmen" transform={`translate(${dx} 0)`}><rect width={34} height={22} rx={6} fill={FLAECHE_STIL.leise.background} stroke={RAND.stark} strokeWidth={1.5} /><text x={44} y={15} fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkDim}>Rahmen = Phase</text></g>,
  );
  return <g transform={`translate(${x} ${y})`} data-fl-legende="">{teile}</g>;
}

/** Farbe „hier landet es“ (Ziel beim Ziehen) — dieselbe wie „Hier“ in der Reise. */
export const FLAECHE_ZIEL = JETZT;
/** Farbe eines ungültigen Ziels (mit Satz, nie nur Farbe). */
export const FLAECHE_NEIN = LEUCHT.kritisch;

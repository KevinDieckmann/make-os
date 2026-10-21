'use client';

// ─── Prozesse · Werkstatt — ein Knoten auf der Fläche (SVG, Etappe B2, 21.10.; ANALYSE_100.md Punkt 22, Kevins Bild der Werkstatt) ─────────────────────────
// „Stil wie ein n8n-Editor, aber in Klar·DARK und mit unseren Dingen“: abgerundetes Quadrat mit Symbol, Name darunter, kleine Unterzeile; Eingang links,
// Ausgänge rechts als Andockpunkte; „+“ am freien Ausgang; Auslöser mit Blitz-Marke; Agent breiter mit drei Andockpunkten unten (Modell · Gedächtnis ·
// Werkzeuge) und den angedockten Teilen als kleine runde Knoten darunter; Raute mit vier festen Andockpunkten. Unsere Formen bleiben erkennbar (Miro-Farben —
// Schritt grün, Nachricht gelb, Raute ruhig, Erinnerung orange, Agent im Ton der ZOE-Kugel), Farbe nie allein (Symbol + Text). Rechnet nichts: Maße und
// Anschlüsse kommen fertig aus lib/prozesse/werkstatt-lage.ts.

import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  Zap, ListChecks, Mail, MessageCircle, GitBranch, BellRing, CalendarClock, Bot, Hourglass, Repeat, Workflow, Lock, Flag, Users, FileText, Receipt, Bell, Send,
  Trash2, RotateCcw, Search, Handshake, Plus, AlertTriangle, Check, Clock, Minus, X, Brain, FolderOpen, Cpu, Wrench, Database, Webhook, CalendarDays, Hand,
} from 'lucide-react';
import { FARBE as C, TIEF, RAND, LEUCHT, FLAECHE_STIL } from '@/lib/make-one/design';
import type { ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import type { KnotenLageW } from '@/lib/prozesse/werkstatt-lage';
import { ausgangName, WS } from '@/lib/prozesse/werkstatt-lage';
import { WERKSTATT_FORM_FARBE, AGENT_TON_ZWEI } from '@/lib/prozesse/farben';
import { PROBE_NAME, type ProbeStatus } from '@/lib/prozesse/werkstatt-hinweise';
import { textZeilen, FLAECHE_SCHRIFT } from '../ui/reise/flaeche-formen';
import { BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { PROBE_BEDEUTUNG } from '@/lib/prozesse/werkstatt-hinweise';

type K = ProzessKnoten<ProzessForm>;
type Symbol = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; color?: string }>;

/** Das Symbol eines Knotens: nach Baustein (Anbindung), sonst nach Form. */
export function symbolVon(k: Pick<K, 'form' | 'katalog' | 'ausloeser'>): Symbol {
  const id = k.katalog?.id ?? '';
  if (k.form === 'ausloeser') return k.ausloeser?.art === 'webhook' ? Webhook : k.ausloeser?.art === 'zeitplan' ? Clock : k.ausloeser?.art === 'datum' ? CalendarDays : k.ausloeser?.art === 'hand' ? Hand : Zap;
  if (id.startsWith('whatsapp.')) return MessageCircle;
  if (id.startsWith('inbox.')) return Mail;
  if (id === 'crm.abfragen') return Database;
  if (id.startsWith('crm.')) return Users;
  if (id.startsWith('angebot.')) return FileText;
  if (id.startsWith('rechnung.')) return Receipt;
  if (id.startsWith('glocke.')) return Bell;
  if (id.startsWith('telegram.')) return Send;
  if (id.startsWith('loeschen.')) return Trash2;
  if (id === 'lauf.erneut-ab') return RotateCcw;
  if (id === 'agent.research') return Search;
  const f: Readonly<Record<ProzessForm, Symbol>> = {
    schritt: ListChecks, nachricht: Mail, entscheidung: GitBranch, erinnerung: BellRing, termin: CalendarClock, abstimmung: Handshake, ausloeser: Zap, agent: Bot,
    warten: Hourglass, schleife: Repeat, teilprozess: Workflow, freigabe: Lock, ende: Flag,
  };
  return f[k.form ?? 'schritt'];
}

const PROBE_SYMBOL: Readonly<Record<ProbeStatus, Symbol>> = { wuerde: Check, uebersprungen: Minus, wartet: Clock, freigabe: Lock, fehler: X };
const UNTER_SYMBOL = { modell: Cpu, gedaechtnis: Brain, werkzeuge: Wrench } as const;

function Zeilen({ text, x, y, breite, groesse, zeilen, farbe, gewicht }: { text: string; x: number; y: number; breite: number; groesse: number; zeilen: number; farbe: string; gewicht: number }) {
  const z = textZeilen(text, breite, groesse, zeilen);
  return (
    <text x={x} textAnchor="middle" fontSize={groesse} fontWeight={gewicht} fill={farbe} style={{ pointerEvents: 'none' }}>
      {z.map((t, i) => <tspan key={i} x={x} y={y + i * groesse * 1.22}>{t}</tspan>)}
    </text>
  );
}

export interface KnotenZeichnungProps {
  k: K; l: KnotenLageW;
  unterzeile: string;
  gewaehlt?: boolean; ziel?: boolean; zielNein?: boolean;
  /** Ausgänge, an denen ein Faden hängt — an den freien steht das „+“ (am gewählten Knoten an allen). */
  belegt: ReadonlySet<string>;
  /** Hinter dem Knoten steht ein Freigabe-Schloss. */
  schloss?: boolean;
  befund?: 'fehler' | 'offen' | null;
  probe?: ProbeStatus;
  nurLesen?: boolean;
  /** Agent: der gewählte Andockpunkt (Panel). */
  andockGewaehlt?: string | null;
}

/** Ein Knoten in seiner Gestalt (an 0, 0 der Knoten-Box). */
export function KnotenZeichnung(p: KnotenZeichnungProps) {
  const { k, l } = p;
  const f = k.form ?? 'schritt';
  const ton = WERKSTATT_FORM_FARBE[f];
  const c = l.koerper;
  const S = symbolVon(k);
  const rand = p.ziel ? (p.zielNein ? LEUCHT.kritisch : C.aktiv) : p.gewaehlt ? C.ink : TIEF.rand(ton);
  const breit = p.ziel || p.gewaehlt ? 2.6 : 1.6;
  const probeFarbe = p.probe ? BEDEUTUNG_FARBE[PROBE_BEDEUTUNG[p.probe]] : null;
  const agent = l.gestalt === 'agent';
  const raute = l.gestalt === 'raute';
  const titelY = c.y + c.h + 22;
  // ── Körper ──
  let koerper: ReactNode;
  if (raute) {
    const m = c.b / 2;
    koerper = (
      <g transform={`translate(${c.x} ${c.y})`}>
        <polygon points={`${m},0 ${c.b},${m} ${m},${c.b} 0,${m}`} fill={C.flaecheHoch} />
        <polygon points={`${m},0 ${c.b},${m} ${m},${c.b} 0,${m}`} fill={TIEF.flaeche(ton)} stroke={rand} strokeWidth={breit} strokeLinejoin="round" />
        <S x={m - 17} y={m - 17} width={34} height={34} color={ton} aria-hidden />
      </g>
    );
  } else if (agent) {
    koerper = (
      <g transform={`translate(${c.x} ${c.y})`}>
        <defs>
          <linearGradient id={`ws-agent-${k.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={ton} stopOpacity={0.22} /><stop offset="1" stopColor={AGENT_TON_ZWEI} stopOpacity={0.14} /></linearGradient>
        </defs>
        <rect width={c.b} height={c.h} rx={20} fill={C.flaecheHoch} />
        <rect width={c.b} height={c.h} rx={20} fill={`url(#ws-agent-${k.id})`} stroke={rand} strokeWidth={breit} />
        <S x={18} y={c.h / 2 - 17} width={34} height={34} color={ton} aria-hidden />
        <Zeilen text={k.titel} x={(c.b + 60) / 2} y={c.h / 2 - 6} breite={c.b - 80} groesse={FLAECHE_SCHRIFT.titel} zeilen={2} farbe={C.ink} gewicht={650} />
        <text x={(c.b + 60) / 2} y={c.h - 14} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkLeise} style={{ pointerEvents: 'none' }}>{textZeilen(p.unterzeile, c.b - 80, FLAECHE_SCHRIFT.unter, 1)[0] ?? ''}</text>
      </g>
    );
  } else {
    // Auslöser: links weit gerundet (Startmarke) — wie die Trigger in n8n; sonst ein abgerundetes Quadrat.
    const d = f === 'ausloeser'
      ? `M${c.h / 2} 0 H${c.b - 18} Q${c.b} 0 ${c.b} 18 V${c.h - 18} Q${c.b} ${c.h} ${c.b - 18} ${c.h} H${c.h / 2} A${c.h / 2} ${c.h / 2} 0 0 1 ${c.h / 2} 0 Z`
      : `M18 0 H${c.b - 18} Q${c.b} 0 ${c.b} 18 V${c.h - 18} Q${c.b} ${c.h} ${c.b - 18} ${c.h} H18 Q0 ${c.h} 0 ${c.h - 18} V18 Q0 0 18 0 Z`;
    koerper = (
      <g transform={`translate(${c.x} ${c.y})`}>
        <path d={d} fill={C.flaecheHoch} />
        <path d={d} fill={TIEF.flaeche(ton)} stroke={rand} strokeWidth={breit} strokeDasharray={f === 'freigabe' && k.schloss ? '0' : undefined} />
        <S x={c.b / 2 - 18} y={c.h / 2 - 18} width={36} height={36} color={ton} aria-hidden />
      </g>
    );
  }
  return (
    <g>
      {probeFarbe && <rect x={c.x - 7} y={c.y - 7} width={c.b + 14} height={c.h + 14} rx={raute ? 14 : 24} fill="none" stroke={probeFarbe} strokeWidth={2.4} strokeDasharray={p.probe === 'uebersprungen' ? '5 5' : undefined} />}
      {koerper}
      {/* Blitz-Marke am Auslöser, Schloss-Marke an der Freigabe der Regel. */}
      {f === 'ausloeser' && <g transform={`translate(${c.x - 8} ${c.y - 8})`}><circle cx={11} cy={11} r={11} fill={C.grund} stroke={ton} strokeWidth={1.4} /><Zap x={4} y={4} width={14} height={14} color={ton} aria-hidden /></g>}
      {f === 'freigabe' && k.schloss && <g transform={`translate(${c.x + c.b - 14} ${c.y - 8})`}><circle cx={11} cy={11} r={11} fill={C.grund} stroke={LEUCHT.achtung} strokeWidth={1.4} /><Lock x={4} y={4} width={14} height={14} color={LEUCHT.achtung} aria-hidden /></g>}
      {p.schloss && f !== 'freigabe' && <g transform={`translate(${c.x + c.b - 14} ${c.y - 8})`}><circle cx={11} cy={11} r={11} fill={C.grund} stroke={LEUCHT.achtung} strokeWidth={1.4} /><Lock x={4} y={4} width={14} height={14} color={LEUCHT.achtung} aria-hidden /></g>}
      {p.befund && <g transform={`translate(${c.x - 8} ${c.y + c.h - 14})`}><circle cx={11} cy={11} r={11} fill={C.grund} stroke={p.befund === 'fehler' ? LEUCHT.kritisch : LEUCHT.achtung} strokeWidth={1.4} /><AlertTriangle x={4} y={4} width={14} height={14} color={p.befund === 'fehler' ? LEUCHT.kritisch : LEUCHT.achtung} aria-hidden /></g>}
      {p.probe && probeFarbe && (() => { const P = PROBE_SYMBOL[p.probe!]; return <g transform={`translate(${c.x + c.b - 14} ${c.y + c.h - 14})`}><circle cx={11} cy={11} r={11} fill={probeFarbe} /><P x={4} y={4} width={14} height={14} color={C.grund} aria-hidden /></g>; })()}
      {/* Name und Unterzeile unter dem Körper (beim Agenten stehen sie darin). */}
      {!agent && <Zeilen text={k.titel} x={l.b / 2} y={titelY} breite={l.b - 8} groesse={FLAECHE_SCHRIFT.titel} zeilen={2} farbe={C.ink} gewicht={650} />}
      {!agent && <text x={l.b / 2} y={titelY + (textZeilen(k.titel, l.b - 8, FLAECHE_SCHRIFT.titel, 2).length) * FLAECHE_SCHRIFT.titel * 1.22 + 2} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkLeise} style={{ pointerEvents: 'none' }}>{textZeilen(p.unterzeile, l.b - 8, FLAECHE_SCHRIFT.unter, 1)[0] ?? ''}</text>}
      {agent && l.unterknoten && <AgentAndocks k={k} l={l} gewaehlt={p.andockGewaehlt ?? null} nurLesen={!!p.nurLesen} />}
      {/* Anschlüsse: Eingang links, Ausgänge rechts (Raute: vier feste Punkte). Freie Ausgänge mit „+“ und — an Raute und Freigabe — ihrem Namen. */}
      {l.anschluesse.map(a => {
        const frei = a.art !== 'ein' && !p.belegt.has(a.art);
        const istFehler = a.art === 'fehler';
        const farbe = istFehler ? LEUCHT.kritisch : a.art === 'nein' ? WERKSTATT_FORM_FARBE.erinnerung : C.aktiv;
        const benannt = a.art !== 'ein' && a.art !== 'weiter' && (raute || f === 'freigabe' || f === 'warten' || istFehler);
        const zeigePlus = !p.nurLesen && a.art !== 'ein' && (frei || p.gewaehlt) && !(istFehler && !p.gewaehlt) && !(a.art === 'abgelaufen' && !p.gewaehlt && f === 'warten');
        const plus = a.richtung === 'unten' ? [a.x, a.y + 34] : a.richtung === 'oben' ? [a.x, a.y - 34] : [a.x + 36, a.y];
        return (
          <g key={a.art}>
            {zeigePlus && <line x1={a.x} y1={a.y} x2={plus[0]} y2={plus[1]} stroke={TIEF.rand(farbe)} strokeWidth={1.4} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />}
            <circle data-ws-anschluss={`${k.id}|${a.art}`} cx={a.x} cy={a.y} r={a.art === 'ein' ? 6 : 7} fill={C.grund} stroke={a.art === 'ein' ? C.inkDim : farbe} strokeWidth={2}
              style={{ cursor: p.nurLesen || a.art === 'ein' ? 'default' : 'crosshair' }} aria-hidden />
            {benannt && (frei || p.gewaehlt) && <text x={a.richtung === 'rechts' ? a.x + 12 : a.x + 12} y={a.richtung === 'unten' ? a.y + 16 : a.richtung === 'oben' ? a.y - 8 : a.y - 9} fontSize={FLAECHE_SCHRIFT.mikro + 1} fill={istFehler ? LEUCHT.kritisch : C.inkDim} style={{ pointerEvents: 'none' }}>{`${a.art === 'ein' ? '' : ausgangName(f, a.art)}${frei && raute && a.art === 'nein' ? ' · offen' : ''}`}</text>}
            {zeigePlus && (
              <g data-ws-plus={`${k.id}|${a.art}`} transform={`translate(${plus[0]} ${plus[1]})`} style={{ cursor: 'pointer' }} role="button" aria-label={`An „${a.art === 'ein' ? '' : ausgangName(f, a.art)}“ von „${k.titel}“ anhängen`}>
                <circle r={13} fill={C.flaeche} stroke={TIEF.rand(farbe)} strokeWidth={1.4} />
                <Plus x={-8} y={-8} width={16} height={16} color={farbe} aria-hidden />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Die drei Andockpunkte des Agenten und die angedockten Teile (Modell · Gedächtnis · Werkzeuge) — feine Fäden in die Kreise (Fäden zeichnet die Flow-Ebene). */
function AgentAndocks({ k, l, gewaehlt, nurLesen }: { k: K; l: KnotenLageW; gewaehlt: string | null; nurLesen: boolean }) {
  const u = l.unterknoten!;
  const c = l.koerper;
  const ton = WERKSTATT_FORM_FARBE.agent;
  return (
    <g>
      {u.andocks.map(a => (
        <g key={a.art}>
          <rect x={a.x - 5} y={c.y + c.h - 5} width={10} height={10} transform={`rotate(45 ${a.x} ${c.y + c.h})`} fill={C.grund} stroke={TIEF.rand(ton)} strokeWidth={1.6} />
          <text x={a.x} y={c.y + c.h + 18} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.mikro} fontWeight={600} letterSpacing="0.6" fill={C.inkLeise} style={{ pointerEvents: 'none' }}>{a.titel.toUpperCase()}</text>
        </g>
      ))}
      {u.teile.map(t => {
        const Z = t.art === 'gedaechtnis' ? (t.titel === 'Akte' ? FolderOpen : Brain) : UNTER_SYMBOL[t.art];
        const an = gewaehlt === t.art;
        return (
          <g key={t.id} data-ws-unter={`${k.id}|${t.art}`} transform={`translate(${t.cx} ${t.cy})`} style={{ cursor: nurLesen ? 'default' : 'pointer' }} role="button"
            aria-label={`${t.art === 'modell' ? 'Modell' : t.art === 'gedaechtnis' ? 'Gedächtnis' : 'Werkzeuge'}: ${t.titel}${t.schloss ? ' — mit Freigabe' : ''}`}>
            <circle r={WS.andock.r} fill={t.leer ? C.grund : C.flaecheHoch} stroke={an ? C.ink : t.leer ? RAND.stark : TIEF.rand(ton)} strokeWidth={an ? 2.2 : 1.4} strokeDasharray={t.leer ? '4 4' : undefined} />
            {t.leer ? <Plus x={-8} y={-8} width={16} height={16} color={C.inkDim} aria-hidden /> : <Z x={-9} y={-9} width={18} height={18} color={ton} aria-hidden />}
            {t.schloss && <g transform="translate(9 -22)"><circle cx={7} cy={7} r={8} fill={C.grund} stroke={LEUCHT.achtung} strokeWidth={1.2} /><Lock x={2} y={2} width={10} height={10} color={LEUCHT.achtung} aria-hidden /></g>}
            <text y={WS.andock.r + 15} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.mikro + 1} fill={t.leer ? C.inkLeise : C.inkDim} style={{ pointerEvents: 'none' }}>{textZeilen(t.titel, WS.andock.abstand + 8, FLAECHE_SCHRIFT.mikro + 1, 1)[0] ?? ''}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Die Kachel einer zugeklappten Phase (Punkt 8: Teilprozess zugeklappt als Kachel). */
export function ZuKachel({ l }: { l: KnotenLageW }) {
  const c = l.koerper;
  const ton = WERKSTATT_FORM_FARBE.teilprozess;
  return (
    <g>
      <rect x={c.x} y={c.y} width={c.b} height={c.h} rx={20} fill={C.flaecheHoch} />
      <rect x={c.x} y={c.y} width={c.b} height={c.h} rx={20} fill={TIEF.flaeche(ton)} stroke={TIEF.rand(ton)} strokeWidth={1.6} strokeDasharray="6 4" />
      <Workflow x={c.x + c.b / 2 - 18} y={c.y + c.h / 2 - 18} width={36} height={36} color={ton} aria-hidden />
      <Zeilen text={l.zu?.titel ?? ''} x={l.b / 2} y={c.y + c.h + 22} breite={l.b - 8} groesse={FLAECHE_SCHRIFT.titel} zeilen={2} farbe={C.ink} gewicht={650} />
      <text x={l.b / 2} y={c.y + c.h + 62} textAnchor="middle" fontSize={FLAECHE_SCHRIFT.unter} fill={C.inkLeise}>{`${l.zu?.schritte ?? 0} Schritte · zugeklappt`}</text>
      {l.anschluesse.map(a => <circle key={a.art} cx={a.x} cy={a.y} r={6} fill={C.grund} stroke={C.inkDim} strokeWidth={2} aria-hidden />)}
    </g>
  );
}

/** Der Name eines Probe-Status (für Vorleser und Panel). */
export const probeWort = (s: ProbeStatus) => PROBE_NAME[s];
/** Die Fläche eines Notiz-Zettels (Hintergrund aus dem Standard). */
export const ZETTEL_GRUND = FLAECHE_STIL.flach.background;

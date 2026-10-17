'use client';

// ─── Standard · der Fluss einer Stufe (17.10. — Kevins Miro-Standard „Beispiel Prozess“, DESIGN_STANDARD.md › Prozess-Visualisierung) ─────────────
// EIN Fluss von oben nach unten mit Pfeilen und festen Formen (nur der Stil seines Miro-Boards, nie dessen Inhalt):
//   Start            — Kreis (womit die Phase beginnt: Unterschrift bzw. der Abstimmungspunkt davor)
//   Schritt          — Kasten, ruhig grün getönt
//   Nachricht        — Kasten mit Brief, gelb getönt (Willkommensmail, Mail-Baustein, Wirkungsbericht)
//   Entscheidung     — Raute (Abstimmungspunkt) mit „ja“ nach unten und „nein“ zur Seite
//   Erinnerung       — Kasten mit Glocke, orange getönt, auf dem Nein-Pfad bzw. neben einem Schritt, der beim Kunden wartet
//   Termin           — große Beschriftung mit Kalender (Kick-off, Ritual)
//   Gruppen          — zwei oder mehr Teilprozesse als Karten nebeneinander
// Die Bedeutung hängt an der Form (Zeichen + Text für Vorleser), die Farbe kommt dazu. Erledigt ✓ (leise), „Hier“ (Petrol-Rahmen), hängt („!“ rot/gelb).
// Er zeichnet nur — die Modelle rechnen (Fulfillment `phasenFluss`, Einrichtung `etappenFluss`, Planung `meilensteinFluss`; Typen lib/reise/bild.ts).
// Ein Tipp auf einen Knoten wählt ihn (Detail daneben). Die Legende steht EINMAL je Ansicht (`FormenLegende`). Seit 17.10. EIN Baustein für alle Bereiche
// (aus dem Fulfillment hierher gezogen) — generisch im Knoten-Typ, damit jeder Bereich seine eigenen Felder am Knoten behält.
// Markenzeichen: der Flow (17.10.): die Pfeile sind feine Lichtfäden in Laufrichtung (`FlussFaden`, ./faden.tsx) — erledigt hell, offen gedämpft, der Pfeil in
// den aktuellen Knoten glüht, der Nein-Pfad im Ton der Erinnerung. Der Zustand je Pfeil kommt aus den Knoten davor/danach (lib/reise/flow.ts `pfeilZustand`);
// die ruhige Linie (`.ff-fluss-pfeil-linie`) bleibt für Druck und den ersten Moment, solange der Faden läuft, blendet CSS sie aus.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Mail, CalendarClock, BellRing, AlertCircle, ChevronDown, ArrowRight, RotateCcw } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT, FLAECHE_STIL, LEUCHT } from '@/lib/make-one/design';
import { anzahl } from '@/lib/text/zahlwort';
import { FORM_NAME, type FlussBild, type FlussForm, type FlussKnotenBild, type FlussTeilBild, type KaestchenZustand } from '@/lib/reise/bild';
import { pfeilZustand, stufeBegonnen, type PfeilArt, type PfeilZustand } from '@/lib/reise/flow';
import { JETZT, FORM_FARBE, FreigabeRaute } from './formen';
import { FlussFaden } from './faden';

/** Ein Knoten, dessen Nein-Zweig dieselbe Form hat — jeder Bereich setzt hier seinen eigenen Typ ein (Fulfillment: `FlussKnoten`). */
type K0<K> = FlussKnotenBild<K>;

const HAENGT_FARBE = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung } as const;
const ZUSTAND_TEXT = { erledigt: 'erledigt', hier: 'als Nächstes', offen: 'offen', entfaellt: 'entfällt' } as const;
/** So viele Knoten zeigt eine Gruppe bzw. ein Strang, bevor „+n weitere“ kommt. */
const STRANG_MAX = 6;
const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 };

/**
 * Ein Pfeil nach unten (optional beschriftet, z. B. „ja“) — auch im Prozess-Editor. `zustand`/`art` tragen den Faden (Markenzeichen): erledigt · hier (in den
 * aktuellen Knoten) · offen; weiter · ja · nein.
 */
export function Pfeil({ text, kurz, zustand = 'offen', art = text === 'ja' ? 'ja' : 'weiter' }: { text?: string; kurz?: boolean; zustand?: PfeilZustand; art?: PfeilArt }) {
  return (
    <span aria-hidden className="ff-fluss-pfeil" data-flow-pfeil={zustand} data-flow-art={art} style={{ display: 'grid', justifyItems: 'center', color: C.inkLeise, minHeight: kurz ? 22 : 34, alignContent: 'center', position: 'relative' }}>
      <span className="ff-fluss-pfeil-linie" style={{ width: 2, height: kurz ? 10 : 18, background: RAND.stark, borderRadius: 1 }} />
      <ChevronDown size={14} style={{ marginTop: -4 }} />
      {text && <span style={{ position: 'absolute', left: 'calc(50% + 10px)', top: '50%', transform: 'translateY(-50%)', fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'nowrap' }}>{text}</span>}
    </span>
  );
}

/** Name der Form für Vorleser — eine Entscheidung aus dem Editor heißt so, die Raute eines Abstimmungspunkts „Abstimmung“. */
export const formName = (k: Pick<FlussKnotenBild, 'form' | 'entscheid'>): string => (k.entscheid ? 'Entscheidung' : FORM_NAME[k.form]);

export function knotenLabel(k: FlussKnotenBild, zustand = true): string {
  return `${formName(k)}: ${k.titel}${zustand ? ` — ${ZUSTAND_TEXT[k.zustand]}` : ''}${k.haengt ? `, hängt${k.haengt === 'rot' ? ' (dringend)' : ''}` : ''}${k.unter ? `, ${k.unter}` : ''}`;
}

/**
 * Ein Knoten des Flusses in der Form seiner Art (Zeichen, Titel, Satz darunter) — EIN Bauteil für die Ansicht (Fall › Reise) UND den Prozess-Editor
 * (`editor`: ohne Zustand im Vorleser-Text; `griff` = Ziehen, Tastatur und Markierung des Editors, auf den Knopf gelegt).
 */
export function KnotenKnopf<K extends K0<K>>({ k, gewaehlt, onWahl, griff, editor }: { k: K; gewaehlt: boolean; onWahl: (k: K) => void; griff?: Record<string, unknown>; editor?: boolean }) {
  const f = FORM_FARBE[k.form];
  const hier = k.zustand === 'hier';
  const fertig = k.zustand === 'erledigt';
  const kante = k.haengt ? HAENGT_FARBE[k.haengt] : undefined;
  const rahmen = gewaehlt ? C.ink : hier ? JETZT : kante ?? (fertig ? RAND.flaeche : TIEF.rand(f));
  const marke = (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center', ...MIKRO, color: hier ? JETZT : kante ?? C.inkLeise, minHeight: 14 }}>
      {hier ? 'Hier · als Nächstes' : fertig ? '' : k.haengt ? (k.haengt === 'rot' ? 'Hängt · dringend' : 'Hängt') : ''}
    </span>
  );
  const titel = (
    <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
      <span className="ff-titel" title={k.titel} style={{ fontWeight: hier ? 700 : 600, color: fertig || k.zustand === 'entfaellt' ? C.inkDim : C.ink, textDecoration: k.zustand === 'entfaellt' ? 'line-through' : 'none' }}>{k.titel}</span>
      {k.unter && <span style={{ ...klein, color: kante ?? C.inkLeise }}>{k.unter}</span>}
    </span>
  );
  const zeichen = fertig ? <Check size={16} color={LEUCHT.gut} aria-hidden style={{ flex: '0 0 auto' }} />
    : k.form === 'nachricht' ? <Mail size={16} color={f} aria-hidden style={{ flex: '0 0 auto' }} />
      : k.form === 'erinnerung' ? <BellRing size={16} color={f} aria-hidden style={{ flex: '0 0 auto' }} />
        : k.form === 'termin' ? <CalendarClock size={20} color={f} aria-hidden style={{ flex: '0 0 auto' }} />
          : null;
  const basis: CSSProperties = { display: 'grid', gap: 4, width: '100%', minWidth: 0, minHeight: 44, textAlign: 'left', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.35, boxSizing: 'border-box' };
  if (k.form === 'termin') {
    // Termin: große Beschriftung statt Kasten (wie „Kickoff-Termin“ im Vorbild).
    return (
      <button type="button" className="fassbar ff-fluss-knoten" aria-label={knotenLabel(k, !editor)} aria-pressed={gewaehlt} onClick={() => onWahl(k)} {...griff}
        style={{ ...basis, padding: '6px 4px', background: 'none', border: 'none', borderBottom: `2px solid ${gewaehlt ? C.ink : hier ? JETZT : kante ?? RAND.stark}` }}>
        {marke}
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          {zeichen}
          <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <span className="ff-titel" title={k.titel} style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, color: fertig ? C.inkDim : C.ink, lineHeight: 1.2 }}>{k.titel}</span>
            {k.unter && <span style={{ ...klein, color: kante ?? C.inkLeise }}>{k.unter}</span>}
          </span>
        </span>
      </button>
    );
  }
  if (k.form === 'entscheidung') {
    // Abstimmungspunkt: die Raute, daneben die Frage — „vermerkt?“.
    return (
      <button type="button" className="fassbar ff-fluss-knoten" aria-label={knotenLabel(k, !editor)} aria-pressed={gewaehlt} onClick={() => onWahl(k)} {...griff}
        style={{ ...basis, padding: '6px 10px', background: gewaehlt ? 'rgba(255,255,255,.04)' : 'none', border: `1px solid ${gewaehlt ? C.ink : hier ? TIEF.rand(JETZT) : 'transparent'}`, borderRadius: ECKE.eingabe }}>
        {marke}
        <span style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
          <span aria-hidden style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <span style={{ width: 24, height: 24, transform: 'rotate(45deg)', borderRadius: 3, display: 'grid', placeItems: 'center', border: `2px solid ${fertig ? LEUCHT.gut : hier ? JETZT : kante ?? C.inkDim}`, background: fertig ? LEUCHT.gut : hier ? TIEF.flaeche(JETZT) : C.grund, boxShadow: hier ? TIEF.schein(JETZT, 14) : undefined }}>
              {fertig && <Check size={13} color={C.grund} style={{ transform: 'rotate(-45deg)' }} />}
            </span>
          </span>
          <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
            <span className="ff-titel" title={k.titel} style={{ fontWeight: hier ? 700 : 600, color: fertig ? C.inkDim : C.ink }}>{k.titel}</span>
            <span style={{ ...klein, color: kante ?? C.inkLeise }}>{fertig ? (k.entscheid ? 'ja' : 'vermerkt') : k.unter ?? (k.entscheid ? 'ja oder nein?' : 'bestätigt? — erst dann geht es weiter')}</span>
          </span>
          {kante && !fertig && <AlertCircle size={15} color={kante} aria-hidden style={{ flex: '0 0 auto' }} />}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="fassbar ff-fluss-knoten" aria-label={knotenLabel(k, !editor)} aria-pressed={gewaehlt} onClick={() => onWahl(k)} {...griff}
      style={{ ...basis, padding: '8px 12px', borderRadius: k.form === 'erinnerung' ? 18 : 8, background: hier ? TIEF.flaeche(JETZT) : fertig ? 'transparent' : TIEF.flaeche(f),
        border: `${gewaehlt || hier ? 2 : 1}px solid ${rahmen}`, borderLeft: kante && !gewaehlt ? `4px solid ${kante}` : undefined, boxShadow: hier ? TIEF.schein(JETZT, 16) : undefined }}>
      {marke}
      <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 0 }}>
        {zeichen && <span style={{ marginTop: 1, display: 'inline-flex' }}>{zeichen}</span>}
        {titel}
        {kante && !fertig && <AlertCircle size={15} color={kante} aria-hidden style={{ flex: '0 0 auto', marginTop: 1 }} />}
      </span>
    </button>
  );
}

/** Eine Erinnerung am Rand (Nein-Pfad bzw. neben einem wartenden Schritt) — orange, mit Glocke; zählt nicht als eigener Schritt. */
export function Erinnerung({ e, art }: { e: { titel: string; unter?: string }; art: 'nein' | 'wartet' }) {
  const f = FORM_FARBE.erinnerung;
  return (
    <span className="ff-fluss-erinnerung" role="note" aria-label={`Erinnerung${art === 'nein' ? ' auf dem Nein-Pfad' : ''}: ${e.titel}${e.unter ? `, ${e.unter}` : ''}`}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 0, padding: '7px 11px', borderRadius: 18, background: TIEF.flaeche(f), border: `1px solid ${TIEF.rand(f)}`, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.35 }}>
      <BellRing size={15} color={f} aria-hidden style={{ flex: '0 0 auto', marginTop: 1 }} />
      <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{e.titel}</span>
        {e.unter && <span style={{ color: C.inkLeise }}>{e.unter}</span>}
      </span>
      {art === 'nein' && <RotateCcw size={13} color={C.inkLeise} aria-hidden style={{ flex: '0 0 auto', marginTop: 2 }} />}
    </span>
  );
}

/** Der Pfeil zur Seite (Nein-Zweig bzw. Erinnerung) — auch im Prozess-Editor. Sein Faden trägt den Ton der Erinnerung. */
export function SeitenPfeil({ nein, zustand = 'offen' }: { nein?: boolean; zustand?: PfeilZustand }) {
  return (
    <span aria-hidden className="ff-fluss-seitenpfeil" data-flow-pfeil={zustand} data-flow-art="nein" style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.inkLeise, fontSize: TYP.bedien, padding: '0 6px' }}>
      {nein ? 'nein' : ''}<ArrowRight size={14} />
    </span>
  );
}

/** Der Seitenpfeil zum Nein-Zweig: hell, sobald der Nein-Pfad gegangen ist (der Zweig ist dran bzw. erledigt). */
const seitenZustand = (z: KaestchenZustand): PfeilZustand => (z === 'hier' ? 'hier' : z === 'erledigt' ? 'erledigt' : 'offen');
/** Die Zustände an den Rändern eines Teils (für die Pfeile davor und dahinter): eine Gruppe ist „dran“, wenn einer ihrer Knoten dran ist, „erledigt“, wenn alle es sind. */
function teilRand<K extends K0<K>>(t: FlussTeilBild<K>, wo: 'anfang' | 'ende'): { zustand: KaestchenZustand } | null {
  const alle = t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten);
  if (!alle.length) return null;
  if (t.art === 'linie') return wo === 'anfang' ? alle[0] : alle[alle.length - 1];
  if (alle.every(k => k.zustand === 'erledigt' || k.zustand === 'entfaellt')) return { zustand: 'erledigt' };
  return { zustand: wo === 'anfang' && alle.some(k => k.zustand === 'hier') ? 'hier' : 'offen' };
}

/** Ein Knoten im Strang — mit Nein-Zweig (Raute) bzw. Erinnerung daneben (wartet beim Kunden). */
function Knoten<K extends K0<K>>({ k, gewaehlt, onWahl }: { k: K; gewaehlt: string | null; onWahl: (k: K) => void }) {
  const knopf = <KnotenKnopf k={k} gewaehlt={gewaehlt === k.id} onWahl={onWahl} />;
  // Entscheidung aus dem Editor: ihr Nein-Zweig ist ein echter Knoten des Falls — daneben, antippbar (Status, Detail).
  if (k.neinKnoten) {
    return (
      <div className="ff-fluss-zweig">
        <div className="ff-fluss-zelle">{knopf}</div>
        <SeitenPfeil nein zustand={seitenZustand(k.neinKnoten.zustand)} />
        <div className="ff-fluss-erinnerung" style={{ minWidth: 0 }}><KnotenKnopf k={k.neinKnoten} gewaehlt={gewaehlt === k.neinKnoten.id} onWahl={onWahl} /></div>
      </div>
    );
  }
  const seite = k.nein && k.zustand !== 'erledigt' ? { e: k.nein, art: 'nein' as const } : k.erinnerung ? { e: k.erinnerung, art: 'wartet' as const } : null;
  if (!seite) return <div className="ff-fluss-zelle">{knopf}</div>;
  return (
    <div className="ff-fluss-zweig">
      <div className="ff-fluss-zelle">{knopf}</div>
      <SeitenPfeil nein={seite.art === 'nein'} zustand={seite.art === 'wartet' && k.zustand === 'hier' ? 'erledigt' : 'offen'} />
      <Erinnerung e={seite.e} art={seite.art} />
    </div>
  );
}

/** Ein Strang (oben → unten) — ab `STRANG_MAX` Knoten mit „+n weitere“. */
function Strang<K extends K0<K>>({ knoten, gewaehlt, onWahl, titel }: { knoten: readonly K[]; gewaehlt: string | null; onWahl: (k: K) => void; titel?: string }) {
  const [alle, setAlle] = useState(false);
  // Ein langer Strang zeigt den Ausschnitt um „hier“ (bzw. den gewählten Knoten) — davor und danach je „+n“.
  const kurzStrang = !alle && knoten.length > STRANG_MAX;
  const hierIdx = knoten.findIndex(k => k.id === gewaehlt || k.zustand === 'hier');
  const davor = kurzStrang ? Math.max(0, Math.min(hierIdx >= 0 ? hierIdx - 1 : 0, knoten.length - STRANG_MAX)) : 0;
  const sichtbar = kurzStrang ? knoten.slice(davor, davor + STRANG_MAX) : knoten;
  const danach = knoten.length - davor - sichtbar.length;
  const mehr = (n: number) => <button type="button" className="fassbar" onClick={() => setAlle(true)} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: `1px dashed ${RAND.stark}`, borderRadius: 8, color: C.inkDim, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+{anzahl(n, 'weiterer Schritt', 'weitere Schritte')}</button>;
  return (
    <div style={{ display: 'grid', justifyItems: 'center', width: '100%', minWidth: 0 }}>
      {titel && <span style={{ ...MIKRO, color: C.inkDim, justifySelf: 'center', padding: '2px 0 4px' }}>{titel}</span>}
      {!alle && davor > 0 && <>{mehr(davor)}<Pfeil kurz zustand={pfeilZustand(knoten[davor - 1], knoten[davor])} /></>}
      {sichtbar.map((k, i) => <div key={k.id} style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>{i > 0 && <Pfeil text={knoten[davor + i - 1]?.form === 'entscheidung' && knoten[davor + i - 1]?.zustand !== 'erledigt' ? 'ja' : undefined} zustand={pfeilZustand(knoten[davor + i - 1], k)} />}<Knoten k={k} gewaehlt={gewaehlt} onWahl={onWahl} /></div>)}
      {!alle && danach > 0 && <><Pfeil kurz zustand={pfeilZustand(knoten[davor + sichtbar.length - 1], knoten[davor + sichtbar.length])} />{mehr(danach)}</>}
    </div>
  );
}

function Teil<K extends K0<K>>({ t, gewaehlt, onWahl }: { t: FlussTeilBild<K>; gewaehlt: string | null; onWahl: (k: K) => void }) {
  if (t.art === 'linie') return <Strang knoten={t.knoten} gewaehlt={gewaehlt} onWahl={onWahl} {...(t.titel ? { titel: t.titel } : {})} />;
  // Verzweigung in Gruppen: die Teilprozesse als Karten nebeneinander (am Handy untereinander).
  return (
    <div className="ff-fluss-gruppen" role="group" aria-label={`${t.gruppen.length} Teilprozesse`}>
      {t.gruppen.map(g => (
        <div key={g.id} style={{ ...FLAECHE_STIL.leise, borderRadius: ECKE.flach, padding: '10px 10px 12px', display: 'grid', gap: 6, alignContent: 'start', minWidth: 0 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
            <span style={{ ...MIKRO, color: C.ink, overflowWrap: 'break-word', minWidth: 0 }}>{g.titel}</span>
            <span style={{ ...klein, color: C.inkLeise, flex: '0 0 auto' }}>{g.erledigt}/{g.gesamt}</span>
          </span>
          <Strang knoten={g.knoten} gewaehlt={gewaehlt} onWahl={onWahl} />
        </div>
      ))}
    </div>
  );
}

/**
 * Der Fluss einer Stufe: Start-Kreis, Schritte (Strang bzw. Gruppen), Raute mit ja/nein, Abschluss, Ende. `label` = der Satz für Vorleser (Vorgabe „Ablauf der
 * Phase 2: …“; z. B. „Aufgaben des Meilensteins …“), `leer` = der Satz ohne Schritte.
 */
export function Fluss<K extends K0<K>>({ fluss, gewaehlt, onWahl, onEnde, fuss, label, leer = 'Diese Phase hat noch keine Schritte.', flow = 'an' }: { fluss: FlussBild<K>; gewaehlt: string | null; onWahl: (k: K) => void; onEnde?: () => void; fuss?: ReactNode; label?: string; leer?: string; flow?: 'an' | 'still' | 'aus' }) {
  const nichts = !fluss.teile.length && !fluss.abstimmung && !fluss.abschluss.length;
  // Der Zustand der Pfeile zwischen den Teilen — aus den Knoten davor und danach (dieselben Zustände wie im Bild). Der Start ist erreicht, sobald die Stufe begonnen hat.
  const alleKnoten = [...fluss.teile.flatMap(t => (t.art === 'linie' ? t.knoten : t.gruppen.flatMap(g => g.knoten))), ...(fluss.abstimmung ? [fluss.abstimmung] : []), ...fluss.abschluss];
  const beginn = stufeBegonnen(alleKnoten) ? 'begonnen' as const : null;
  const vorTeil = (i: number) => (i === 0 ? beginn : teilRand(fluss.teile[i - 1], 'ende'));
  const letzterTeil = fluss.teile.length ? teilRand(fluss.teile[fluss.teile.length - 1], 'ende') : beginn;
  const vorAbschluss = fluss.abstimmung ?? letzterTeil;
  const vorEnde = fluss.abschluss.length ? fluss.abschluss[fluss.abschluss.length - 1] : vorAbschluss;
  return (
    <div className="ff-fluss" role="group" aria-label={label ?? `Ablauf der Phase ${fluss.nr}: ${fluss.titel}`}>
      <span className="ff-fluss-start" aria-label={`Start: ${fluss.start.titel}${fluss.start.unter ? `, ${fluss.start.unter}` : ''}`} role="note"
        style={{ display: 'grid', placeItems: 'center', textAlign: 'center', minWidth: 120, maxWidth: 260, minHeight: 64, padding: '8px 18px', borderRadius: 999, border: `2px solid ${C.inkDim}`, background: C.grund, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.3, boxSizing: 'border-box' }}>
        <span style={{ fontWeight: 600 }}>{fluss.start.titel}</span>
        {fluss.start.unter && <span style={{ color: C.inkLeise }}>{fluss.start.unter}</span>}
      </span>
      {fluss.teile.map((t, i) => <div key={i} style={{ display: 'grid', justifyItems: 'center', width: '100%' }}><Pfeil zustand={pfeilZustand(vorTeil(i), teilRand(t, 'anfang'))} /><Teil t={t} gewaehlt={gewaehlt} onWahl={onWahl} /></div>)}
      {nichts && <><Pfeil /><span style={{ ...klein, color: C.inkLeise }}>{leer}</span></>}
      {fluss.abstimmung && <><Pfeil zustand={pfeilZustand(letzterTeil, fluss.abstimmung)} /><Knoten k={fluss.abstimmung} gewaehlt={gewaehlt} onWahl={onWahl} /></>}
      {fluss.abschluss.length > 0 && <><Pfeil text={fluss.abstimmung ? 'ja' : undefined} zustand={pfeilZustand(vorAbschluss, fluss.abschluss[0])} /><Strang knoten={fluss.abschluss} gewaehlt={gewaehlt} onWahl={onWahl} titel="Abschluss" /></>}
      <Pfeil text={fluss.abstimmung && !fluss.abschluss.length ? 'ja' : undefined} zustand={pfeilZustand(vorEnde, null)} />
      {onEnde
        ? <button type="button" className="fassbar ff-fluss-ende" onClick={onEnde} aria-label={`Weiter: ${fluss.ende.titel}`}
          style={{ minHeight: 48, minWidth: 120, maxWidth: 300, padding: '8px 18px', borderRadius: 999, border: `2px solid ${RAND.stark}`, background: 'none', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', textAlign: 'center' }}>
          {fluss.ende.titel} ›
        </button>
        : <span style={{ minHeight: 48, padding: '8px 18px', borderRadius: 999, border: `2px solid ${RAND.haar}`, color: C.inkLeise, fontSize: TYP.bedien, display: 'grid', placeItems: 'center' }}>{fluss.ende.titel}</span>}
      {fuss && <div style={{ marginTop: 14, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{fuss}</div>}
      {flow !== 'aus' && <FlussFaden still={flow === 'still'} />}
    </div>
  );
}

/**
 * Die Legende der Formen — EINMAL je Ansicht, klein. Form + Zeichen + Wort (nie nur Farbe). `formen` = nur die Formen, die die Ansicht wirklich zeigt
 * (Vorgabe: alle — Fulfillment, Editor); Start und die Zustände stehen immer da.
 */
export function FormenLegende({ zustaende = true, formen, entscheidung = 'Entscheidung · Abstimmung (ja / nein)' }: { zustaende?: boolean; formen?: readonly FlussForm[]; entscheidung?: string }) {
  const kasten = (form: FlussForm, rund = false) => <span aria-hidden style={{ display: 'inline-block', width: 18, height: 12, borderRadius: rund ? 6 : 3, background: TIEF.flaeche(FORM_FARBE[form]), border: `1px solid ${TIEF.rand(FORM_FARBE[form])}` }} />;
  const zeigt = (f: FlussForm) => !formen || formen.includes(f);
  const e: { z: ReactNode; t: string }[] = [
    { z: <span aria-hidden style={{ display: 'inline-block', width: 16, height: 12, borderRadius: 6, border: `2px solid ${C.inkDim}` }} />, t: 'Start' },
    ...(zeigt('schritt') ? [{ z: kasten('schritt'), t: 'Schritt' }] : []),
    ...(zeigt('nachricht') ? [{ z: <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>{kasten('nachricht')}<Mail size={12} color={FORM_FARBE.nachricht} aria-hidden /></span>, t: 'Nachricht' }] : []),
    ...(zeigt('entscheidung') ? [{ z: <FreigabeRaute gegeben={false} groesse={11} />, t: entscheidung }] : []),
    ...(zeigt('erinnerung') ? [{ z: <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>{kasten('erinnerung', true)}<BellRing size={12} color={FORM_FARBE.erinnerung} aria-hidden /></span>, t: 'Erinnerung' }] : []),
    ...(zeigt('termin') ? [{ z: <CalendarClock size={14} color={C.ink} aria-hidden />, t: 'Termin' }] : []),
    ...(zustaende ? [
      { z: <Check size={13} color={LEUCHT.gut} aria-hidden />, t: 'erledigt' },
      { z: <span aria-hidden style={{ display: 'inline-block', width: 18, height: 12, borderRadius: 3, border: `2px solid ${JETZT}` }} />, t: 'hier' },
      { z: <AlertCircle size={13} color={LEUCHT.kritisch} aria-hidden />, t: 'hängt' },
    ] : []),
  ];
  return (
    <div data-formen-legende className="ff-formen-legende" role="list" aria-label="Legende der Formen" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
      {e.map(x => <span key={x.t} role="listitem" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{x.z}{x.t}</span>)}
    </div>
  );
}

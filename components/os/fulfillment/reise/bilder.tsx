'use client';

// ─── Fulfillment · Bilder — Phasen-Strahl, Ring, Antwort-Kacheln, Wert-Balken, Wellen-Bild (11.10., Design-Überarbeitung) ─────────────────
// Rückmeldung 11.10.: „Es muss einfach zu verstehen sein — über Visualisierungen.“ Kleine, gemeinsame Zeichen-Bausteine NUR für Fulfillment (die
// gemeinsamen Bausteine in components/os/ui bleiben unverändert). Sie zeichnen nur — gerechnet wird in lib/fulfillment/prozesse/{reise,darstellung}.ts.
// Farben nur aus den Token (LEUCHT, FARBE, TIEF, RAND, FLAECHE_STIL); Text ≥ 13 px, Beschriftungen in Großbuchstaben 11 px; Tippziele ≥ 44 px.

import type { CSSProperties, ReactNode } from 'react';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, FLAECHE_STIL, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT, Punkt } from '../../ui';
import { anzahl, wort } from '@/lib/text/zahlwort';
import type { PhasenZustand, ReiseFreigabe } from '@/lib/fulfillment/prozesse/reise';
import type { Ampel, Welle, WellenStufe } from '@/lib/fulfillment/prozesse/darstellung';
import { agentText } from '@/lib/fulfillment/analyse/agenten';
import { JETZT, FORM_FARBE, FreigabeRaute } from '../../ui/reise/formen';

export const AMPEL_FARBE: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'läuft rund', gelb: 'braucht einen Blick', rot: 'braucht Aufmerksamkeit' };
// „Hier“ (JETZT), die Farben der Formen (FORM_FARBE) und die Raute (FreigabeRaute) sind seit 17.10. gemeinsam für alle Bereiche (components/os/ui/reise) —
// hier nur weitergereicht, damit jede Fulfillment-Stelle unverändert bleibt.
export { JETZT, FORM_FARBE, FreigabeRaute };
export const ZUSTAND_FARBE: Record<PhasenZustand, string> = { fertig: LEUCHT.gut, jetzt: JETZT, offen: C.inkLeise };

const klein: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 };

/** Ein Phasen-Eintrag für die Strahlen (aus `fallReise` bzw. `reiseKurz`). */
export interface StrahlPhase { id?: string; titel: string; zusatz?: string; zustand: PhasenZustand; anteil: number; erledigt?: number; gesamt?: number; ueberfaellig?: boolean; wartet?: number; freigabe?: Pick<ReiseFreigabe, 'id' | 'gegeben'> & { titel?: string; nr?: number } }

/** „Abstimmungspunkt 3“ (14.10., Abnahme B19: „Freigabe“ meint in MAKE OS die Vorschläge von ZOE) — Nummer lückenlos aus dem Ablauf. */
export const abstimmungKurz = (f: { nr?: number }) => `Bestätigung${f.nr ? ` ${f.nr}` : ''}`;

const balkenFarbe = (p: StrahlPhase) => (p.zustand === 'fertig' ? LEUCHT.gut : p.ueberfaellig ? LEUCHT.kritisch : p.zustand === 'jetzt' ? JETZT : C.inkLeise);

/** Ein Abschnitt des Strahls: leise Schiene, darin der erledigte Anteil (vom tiefen in den vollen Ton), am Ende ggf. die Freigabe-Raute. */
function Schiene({ p, hoehe = 8 }: { p: StrahlPhase; hoehe?: number }) {
  const f = balkenFarbe(p);
  const anteil = p.zustand === 'fertig' ? 1 : Math.max(p.zustand === 'jetzt' ? 0.04 : 0, p.anteil);
  const raute = hoehe >= 8 ? 14 : 9;
  return (
    <span style={{ position: 'relative', display: 'block', height: hoehe, borderRadius: hoehe / 2, background: 'rgba(255,255,255,.07)', boxShadow: p.zustand === 'jetzt' ? TIEF.schein(f, 14) : undefined }}>
      <span style={{ position: 'absolute', inset: 0, width: `${Math.round(anteil * 100)}%`, borderRadius: hoehe / 2, background: anteil > 0 ? TIEF.verlauf(f) : 'transparent' }} />
      {p.freigabe && <span style={{ position: 'absolute', right: -raute / 2 + 1, top: '50%', marginTop: -raute / 2, display: 'flex', lineHeight: 0 }}><FreigabeRaute gegeben={p.freigabe.gegeben} aktiv={p.zustand !== 'offen'} groesse={raute} /></span>}
    </span>
  );
}

const phaseLabel = (p: StrahlPhase, i: number) => `Phase ${i + 1}: ${p.titel}${p.zusatz ? ` (${p.zusatz})` : ''} — ${p.zustand === 'fertig' ? 'erledigt' : p.zustand === 'jetzt' ? 'hier stehen wir' : 'kommt noch'}${p.gesamt ? `, ${p.erledigt ?? 0} von ${p.gesamt} ${wort(p.gesamt, 'Schritt', 'Schritten')} erledigt` : ''}${p.freigabe ? `, ${abstimmungKurz(p.freigabe)} ${p.freigabe.gegeben ? 'vermerkt' : 'offen'}` : ''}`;

/**
 * Der Phasen-Strahl (Rechner): eine Spalte je Phase — oben „Sie sind hier“ bzw. „Phase n“, darunter die Schiene mit dem erledigten Anteil und
 * der Freigabe-Raute am Ende, dann Titel, Zähler und der Freigabe-Punkt in Klartext. `onPhase` macht die Spalten anklickbar.
 */
export function PhasenStrahl({ phasen, onPhase, aktiv }: { phasen: readonly StrahlPhase[]; onPhase?: (id: string) => void; aktiv?: string }) {
  // Ab acht Spalten passt „Sie sind hier“ nicht mehr in die Spalte (Abnahme C2: „SIE SIND …“) — dann kurz „Hier“.
  const hier = phasen.length > 7 ? 'Hier' : 'Sie sind hier';
  return (
    <ol aria-label="Phasen des Falls" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, phasen.length)}, minmax(0, 1fr))`, gap: 10 }}>
      {phasen.map((p, i) => {
        const inhalt = (
          <>
            <span style={{ ...MIKRO, color: p.zustand === 'jetzt' ? JETZT : C.inkLeise, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.zustand === 'jetzt' ? hier : p.zustand === 'fertig' ? `✓ Phase ${i + 1}` : `Phase ${i + 1}`}</span>
            <Schiene p={p} />
            <span title={p.zusatz ? `${p.titel} — ${p.zusatz}` : undefined} style={{ fontSize: TYP.bedien, fontWeight: p.zustand === 'jetzt' ? 700 : 600, color: p.zustand === 'offen' ? C.inkDim : C.ink, lineHeight: 1.3, overflowWrap: 'break-word', hyphens: 'manual' }}>{p.titel}</span>
            {p.gesamt !== undefined && p.gesamt > 0 && <span style={{ ...klein, color: C.inkLeise }}>{p.zustand === 'fertig' ? 'erledigt' : `${p.erledigt ?? 0} von ${p.gesamt}`}{p.wartet ? ` · ${p.wartet} beim Kunden` : ''}</span>}
            {p.freigabe && <span title={abstimmungKurz(p.freigabe)} style={{ ...klein, color: p.freigabe.gegeben ? LEUCHT.gut : C.inkDim, display: 'flex', gap: 6, alignItems: 'baseline' }}><span aria-hidden>◆</span><span style={{ overflowWrap: 'break-word', hyphens: 'manual', minWidth: 0 }}>{p.freigabe.nr ?? ''}{p.freigabe.titel ? `${p.freigabe.nr ? ' · ' : ''}${p.freigabe.titel}` : ''}</span></span>}
          </>
        );
        const stil: CSSProperties = { display: 'grid', gap: 6, alignContent: 'start', minWidth: 0, textAlign: 'left', padding: '6px 4px', borderRadius: ECKE.eingabe, minHeight: 44, color: C.ink, fontFamily: SCHRIFT.text,
          background: aktiv === p.id ? TIEF.flaeche(JETZT) : 'transparent', border: `1px solid ${aktiv === p.id ? TIEF.rand(JETZT) : 'transparent'}` };
        return (
          <li key={p.id ?? i} aria-current={p.zustand === 'jetzt' ? 'step' : undefined} style={{ minWidth: 0 }}>
            {onPhase && p.id
              ? <button type="button" className="fassbar" onClick={() => onPhase(p.id!)} aria-label={phaseLabel(p, i)} style={{ ...stil, width: '100%', cursor: 'pointer' }}>{inhalt}</button>
              : <div aria-label={phaseLabel(p, i)} style={stil}>{inhalt}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Der Mini-Strahl (Handy, Cockpit-Karte): nur die Abschnitte nebeneinander, Rauten an den Freigaben, darunter „Phase n von m · Titel“.
 * Ohne `onPhase` reines Bild mit Text für Vorleser.
 */
export function MiniStrahl({ phasen, onPhase, unter = true, hoehe = 8 }: { phasen: readonly StrahlPhase[]; onPhase?: (id: string) => void; unter?: boolean; hoehe?: number }) {
  const j = phasen.findIndex(p => p.zustand === 'jetzt');
  const jetzt = j >= 0 ? phasen[j] : null;
  const alle = phasen.length > 0 && phasen.every(p => p.zustand === 'fertig');
  const text = jetzt ? `Phase ${j + 1} von ${phasen.length} · ${jetzt.titel}` : alle ? (phasen.length === 1 ? 'Phase erledigt' : `Alle ${phasen.length} Phasen erledigt`) : anzahl(phasen.length, 'Phase', 'Phasen');
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div role={onPhase ? undefined : 'img'} aria-label={onPhase ? undefined : `${text}. ${phasen.map((p, i) => phaseLabel(p, i)).join('. ')}`} style={{ display: 'flex', gap: hoehe >= 8 ? 8 : 6, alignItems: 'center' }}>
        {phasen.map((p, i) => onPhase && p.id ? (
          <button key={p.id} type="button" className="fassbar" aria-label={phaseLabel(p, i)} onClick={() => onPhase(p.id!)}
            style={{ flex: '1 1 0', minWidth: 0, minHeight: 44, padding: '0 2px', display: 'grid', alignContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Schiene p={p} hoehe={hoehe} />
          </button>
        ) : <span key={p.id ?? i} style={{ flex: '1 1 0', minWidth: 0 }}><Schiene p={p} hoehe={hoehe} /></span>)}
      </div>
      {unter && <span style={{ ...klein, color: jetzt ? C.ink : C.inkDim }}>{jetzt && <span style={{ ...MIKRO, color: JETZT, marginRight: 8 }}>Sie sind hier</span>}{text}</span>}
    </div>
  );
}

/** Fortschrittsring (klein, 0–100 %) — Zahl in der Mitte, Farbe = Bereich bzw. Zustand. */
export function FortschrittsRing({ prozent, farbe = JETZT, groesse = 52, label }: { prozent: number; farbe?: string; groesse?: number; label: string }) {
  const p = Math.max(0, Math.min(100, Math.round(prozent)));
  const r = (groesse - 8) / 2, u = 2 * Math.PI * r;
  return (
    <span role="img" aria-label={`${label}: ${p} %`} style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: groesse, height: groesse, flex: '0 0 auto' }}>
      <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} aria-hidden style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={5} />
        <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={TIEF.fuellung(farbe)} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(p / 100) * u} ${u}`} />
      </svg>
      <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{p}%</span>
    </span>
  );
}

/**
 * Eine Antwort-Kachel: kleine Frage oben („Wo stehen wir?“), die Antwort groß, ein Satz darunter, optional eine Ampel. Mit `onClick` ein Tippziel.
 */
export function AntwortKachel({ frage, antwort, unter, ampel, links, onClick, ariaLabel }: { frage: string; antwort: ReactNode; unter?: ReactNode; ampel?: string; links?: ReactNode; onClick?: () => void; ariaLabel?: string }) {
  const inhalt = (
    <>
      {links}
      <span style={{ display: 'grid', gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ ...MIKRO, display: 'flex', gap: 6, alignItems: 'center' }}>{ampel && <Punkt farbe={ampel} groesse={8} />}{frage}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, color: C.ink, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{antwort}</span>
        {unter && <span style={{ ...klein, overflowWrap: 'anywhere' }}>{unter}</span>}
      </span>
      {onClick && <span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.body }}>›</span>}
    </>
  );
  const stil: CSSProperties = { ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', minWidth: 0, minHeight: 44, textAlign: 'left', color: C.ink, fontFamily: SCHRIFT.text };
  return onClick
    ? <button type="button" className="fassbar" onClick={onClick} aria-label={ariaLabel} style={{ ...stil, cursor: 'pointer', width: '100%' }}>{inhalt}</button>
    : <div style={stil}>{inhalt}</div>;
}

/** Drei (oder mehr) Antwort-Kacheln nebeneinander, am Handy untereinander. */
export function Antworten({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>{children}</div>;
}

/** Wert-Konto als Balken: links „vorher“, rechts „Ziel“, gefüllt bis „jetzt“ (Ø Zielerreichung). Ohne Messung ein leiser Satz. */
export function WertBalken({ wert, ziele, kompakt }: { wert: number | null | undefined; ziele?: number; kompakt?: boolean }) {
  if (wert == null) return <span style={{ ...klein, color: C.inkLeise }}>Wert-Konto: noch keine Messung</span>;
  const p = Math.max(0, Math.min(100, Math.round(wert)));
  const f = p >= 60 ? LEUCHT.gut : p >= 30 ? LEUCHT.achtung : LEUCHT.kritisch;
  return (
    <span role="img" aria-label={`Wert-Konto: ${p} % des Wegs von vorher zum Ziel${ziele ? ` (Durchschnitt über ${ziele} Ziel${ziele === 1 ? '' : 'e'})` : ''}`} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...MIKRO }}><span>vorher</span>{!kompakt && <span style={{ color: f }}>jetzt {p} %</span>}<span>Ziel</span></span>
      <span style={{ position: 'relative', display: 'block', height: 8, borderRadius: 4, background: 'rgba(255,255,255,.07)' }}>
        <span style={{ position: 'absolute', inset: 0, width: `${Math.max(p, 2)}%`, borderRadius: 4, background: TIEF.verlauf(f) }} />
        <span aria-hidden style={{ position: 'absolute', left: `calc(${p}% - 5px)`, top: -3, width: 10, height: 14, borderRadius: 3, background: f, boxShadow: TIEF.schein(f, 10) }} />
      </span>
      {kompakt && <span style={{ ...klein }}>Wert-Konto: {p} % des Wegs{ziele ? ` · ${ziele} Ziel${ziele === 1 ? '' : 'e'}` : ''}</span>}
    </span>
  );
}

// ── Wellen-Bild der Analyse ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const WELLEN_FARBE: Record<WellenStufe, string> = { uebernommen: LEUCHT.gut, entwurf: LEUCHT.achtung, laeuft: LEUCHT.planung, fehler: LEUCHT.kritisch, bereit: C.aktiv, gesperrt: C.inkLeise };
export const WELLEN_TEXT: Record<WellenStufe, string> = { uebernommen: 'im Dossier', entwurf: 'Entwurf prüfen', laeuft: 'läuft', fehler: 'Fehler', bereit: 'bereit', gesperrt: 'noch gesperrt' };

/**
 * Ein Agent als Marke in seiner Stufenfarbe (gefüllt = Ergebnis da, Umriss = noch nicht) — mit seinem Namen; seit 17.10. spät nie mehr das Kürzel
 * (15.10., Abnahme B5: „A0–A13, AP, TB ohne Erklärung“; 17.10.: „Fachbegriffe raus“).
 */
export function AgentMarke({ id, stufe, name }: { id: string; stufe: WellenStufe; name?: string }) {
  const f = WELLEN_FARBE[stufe];
  const voll = stufe === 'uebernommen' || stufe === 'entwurf' || stufe === 'laeuft' || stufe === 'fehler';
  return (
    <span title={`${name ?? agentText(id)} — ${WELLEN_TEXT[stufe]}`} aria-label={`${name ?? agentText(id)}: ${WELLEN_TEXT[stufe]}`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: 26, padding: '0 8px', borderRadius: 13, fontSize: TYP.bedien, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: voll ? C.ink : f, background: voll ? TIEF.flaeche(f) : 'transparent', border: `1px ${stufe === 'gesperrt' ? 'dashed' : 'solid'} ${stufe === 'gesperrt' ? RAND.stark : TIEF.rand(f)}` }}>
      {name ?? agentText(id)}
    </span>
  );
}

/** Die vier Wellen nebeneinander (am Handy umbrechend), je Welle die Agenten als Marken. `kompakt`: nur Punkte (Übersicht aller Dossiers). */
export function WellenBild({ wellen, kompakt }: { wellen: readonly Welle[]; kompakt?: boolean }) {
  if (kompakt) {
    return (
      <span role="img" aria-label={wellen.map(w => `Welle ${w.nr}: ${w.agenten.map(a => `${a.name ?? agentText(a.id)} ${WELLEN_TEXT[a.stufe]}`).join(', ')}`).join('. ')} style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {wellen.map(w => (
          <span key={w.nr} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
            {w.agenten.map(a => <span key={a.id} style={{ width: 8, height: 8, borderRadius: 4, background: a.stufe === 'gesperrt' || a.stufe === 'bereit' ? 'transparent' : WELLEN_FARBE[a.stufe], border: `1px solid ${WELLEN_FARBE[a.stufe]}` }} />)}
          </span>
        ))}
      </span>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
      {wellen.map((w, i) => (
        <div key={w.nr} style={{ ...FLAECHE_STIL.leise, borderRadius: ECKE.flach, padding: '10px 12px', display: 'grid', gap: 8, alignContent: 'start', position: 'relative' }}>
          <span style={{ ...MIKRO }}>Welle {w.nr} · {w.titel}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{w.agenten.map(a => <AgentMarke key={a.id} {...a} />)}</span>
          {i < wellen.length - 1 && <span aria-hidden style={{ position: 'absolute', right: -9, top: '50%', color: C.inkLeise, fontSize: TYP.bedien }}>›</span>}
        </div>
      ))}
    </div>
  );
}

/** Eine Legende: Zeichen + kurzer Text, umbrechend. */
export function Legende({ eintraege }: { eintraege: readonly { zeichen: ReactNode; text: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center' }}>
      {eintraege.map(e => <span key={e.text} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', ...klein }}>{e.zeichen}{e.text}</span>)}
    </div>
  );
}

/** Ein kleiner Balken-Abschnitt als Legenden-Zeichen. */
export const LegendenBalken = ({ farbe }: { farbe: string }) => <span aria-hidden style={{ display: 'inline-block', width: 18, height: 6, borderRadius: 3, background: TIEF.verlauf(farbe) }} />;

'use client';

// ─── Agenten-Seite: rechts — Wartet auf dich · Läuft · Als Nächstes · Fertig/Fehler (09.10., Paket 2) ──────────────────
// Fragerunde 4: „Wartet auf dich · Läuft · Als Nächstes (Eisenhower) · Fertig/Fehler eingeklappt.“
//   • Wartet auf dich steht oben — Rückfragen eines Threads mit Antwort direkt in der Zeile, Freigaben aus dem Stapel mit
//     Risiko-Ampel; am Handy Daumen-Wischen NUR für risikoarme (→ freigeben, ← ablehnen, je mit Rückfrage), dazu „alle
//     risikoarmen“. Entschieden wird über /api/zoe/stapel — derselbe Weg wie auf der Freigaben-Seite.
//   • Läuft: Fortschritt in Schritten, Dauer, Kosten in Euro, Abbrechen (mit Rückfrage).
//   • Als Nächstes: nach Eisenhower (wichtig & dringend zuerst), kritisch pulsiert.
//   • Fertig und Fehler eingeklappt; Fehler mit „Neu starten“.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FARBE as C, ABSTAND, ECKE, FLAECHE_STIL, LEUCHT, MIKRO, SCHRIFT, TIEF, TYP, ZIEL } from '@/lib/make-one/design';
import type { FadenKurz, Lauf, Naechstes } from '@/lib/agenten/typen';
import { Chip, Fortschritt, Hinweis, Knopf, Leer, eingabe } from '../ui';
import { headFarbe } from './Avatar';
import { anfrageId, fadenSenden, laeufeSenden, meldeNeu, mitRueckfrage, stapelEntscheiden } from './daten';
import { useAgenten } from './kontext';
import {
  dauerText, euro, laufGruppen, nachEisenhower, QUADRANT_NAME, risikoVon, RISIKO_NAME, naechstesTitel, schrittAnteil, vorschlagDetail, wartendeFaeden, wiederholText, zeitKurz,
  type Risiko, type VorschlagKurz,
} from './regeln';
import { WEG } from '@/lib/wege';

const RISIKO_FARBE: Readonly<Record<Risiko, string>> = { risikoarm: LEUCHT.gut, intern: LEUCHT.achtung, aussen: LEUCHT.kritisch };
const LAUF_FARBE: Readonly<Record<Lauf['status'], string>> = { wartet: LEUCHT.achtung, laeuft: C.aktiv, fertig: LEUCHT.gut, fehler: LEUCHT.kritisch, abgebrochen: C.inkLeise };
const LAUF_NAME: Readonly<Record<Lauf['status'], string>> = { wartet: 'wartet', laeuft: 'läuft', fertig: 'fertig', fehler: 'Fehler', abgebrochen: 'abgebrochen' };

function Block({ titel, zahl, children, puls }: { titel: string; zahl?: number; children: ReactNode; puls?: boolean }) {
  return (
    <section aria-label={titel} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: ABSTAND.s, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, ...MIKRO }}>
        {puls && <span aria-hidden className="krit-puls" style={{ width: 8, height: 8, borderRadius: ECKE.eingabe, background: LEUCHT.achtung }} />}
        {titel}{zahl != null && zahl > 0 ? ` (${zahl})` : ''}
      </div>
      {children}
    </section>
  );
}

/** Listen und Spalten schrumpfen mit (ohne `minmax(0, 1fr)` drückt ein langer Titel die Zeile über den Rand). */
const LISTE: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: ABSTAND.s };
const zeile = { ...FLAECHE_STIL.flach, minWidth: 0, borderRadius: ECKE.flach, padding: `${ABSTAND.s + 2}px ${ABSTAND.m}px`, display: 'grid', gap: ABSTAND.xs + 2 } as const;

// ── Wartet auf dich ────────────────────────────────────────────────────────────────────────────────────────────────────

function RueckfrageZeile({ f }: { f: FadenKurz }) {
  const { agenten, oeffne, melde } = useAgenten();
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const h = f.agent.art !== 'zoe' ? heads.find(x => x.id === (f.agent as { headId: string }).headId) : undefined;
  const wer = f.agent.art === 'mitarbeiter' ? h?.mitarbeiter.find(m => m.id === (f.agent as { mitarbeiterId: string }).mitarbeiterId)?.name ?? 'Mitarbeiter' : f.agent.art === 'head' ? h?.kurz ?? 'Head' : 'ZOE';
  const antworten = async () => {
    const t = text.trim();
    if (!t) return;
    setLaeuft(true);
    const r = await fadenSenden({ aktion: 'senden', agent: f.agent, fadenId: f.id, text: t, anfrageId: anfrageId() });
    setLaeuft(false);
    if (r.ok) { setText(''); melde(`Antwort an ${wer} gesendet.`, 'gut'); } else melde(r.kommt ? 'Antworten kommt mit dem Agenten-Kern.' : r.text, r.kommt ? 'info' : 'kritisch');
  };
  return (
    <li style={{ ...zeile, borderColor: TIEF.rand(LEUCHT.achtung) }}>
      <button type="button" onClick={() => oeffne({ f: f.id })} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, minHeight: ZIEL.rechner }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>⚑ {wer} fragt</span>
        <span style={{ display: 'block', fontSize: TYP.body, fontWeight: 600 }}>„{f.titel}“ ›</span>
      </button>
      <form onSubmit={e => { e.preventDefault(); void antworten(); }} style={{ display: 'flex', gap: ABSTAND.s }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Antwort …" aria-label={`Antwort an ${wer}`} style={{ ...eingabe, minHeight: ZIEL.handy, padding: `${ABSTAND.s}px ${ABSTAND.m}px`, minWidth: 0, flex: 1 }} />
        <Knopf typ="submit" aus={laeuft || !text.trim()}>Senden</Knopf>
      </form>
    </li>
  );
}

/** Zeile mit Daumen-Wischen (Handy, nur risikoarm): → freigeben, ← ablehnen — beides mit Rückfrage. */
function WischZeile({ an, onRechts, onLinks, children }: { an: boolean; onRechts: () => void; onLinks: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const breite = useRef(1);
  if (!an) return <>{children}</>;
  return (
    <div style={{ position: 'relative', borderRadius: ECKE.flach, overflow: 'hidden', touchAction: 'pan-y' }}
      onPointerDown={e => { start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; breite.current = (e.currentTarget as HTMLElement).offsetWidth || 1; }}
      onPointerMove={e => {
        const s = start.current; if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x, y = e.clientY - s.y;
        if (Math.abs(x) > 10 && Math.abs(x) > 1.2 * Math.abs(y)) setDx(x);
      }}
      onPointerUp={() => {
        const anteil = dx / breite.current;
        start.current = null; setDx(0);
        if (anteil > 0.4) onRechts(); else if (anteil < -0.4) onLinks();
      }}
      onPointerCancel={() => { start.current = null; setDx(0); }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dx >= 0 ? 'flex-start' : 'flex-end', padding: `0 ${ABSTAND.l}px`,
        background: TIEF.flaeche(dx >= 0 ? LEUCHT.gut : LEUCHT.kritisch), color: dx >= 0 ? LEUCHT.gut : LEUCHT.kritisch, fontSize: TYP.bedien, fontWeight: 700 }}>
        {dx >= 0 ? 'Freigeben' : 'Ablehnen'}
      </div>
      <div style={{ position: 'relative', transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform .24s ease' }}>{children}</div>
    </div>
  );
}

function FreigabeZeile({ v }: { v: VorschlagKurz }) {
  const { form, melde, bestaetigen, jetzt } = useAgenten();
  const [erledigt, setErledigt] = useState<string | null>(null);
  const risiko = risikoVon(v);
  const detail = vorschlagDetail(v);
  const entscheide = async (entscheidung: 'freigeben' | 'ablehnen', fragen: boolean) => {
    if (fragen && !(await bestaetigen({ titel: entscheidung === 'freigeben' ? 'Freigeben?' : 'Ablehnen?', text: `„${v.titel}“${detail ? ` — ${detail}` : ''}`, ja: entscheidung === 'freigeben' ? 'Freigeben' : 'Ablehnen', gefahr: entscheidung === 'ablehnen' }))) return;
    const r = await stapelEntscheiden({ id: v.id, entscheidung });
    if (r.ok) { setErledigt(entscheidung === 'freigeben' ? 'freigegeben' : 'abgelehnt'); melde(`„${v.titel}“ ${entscheidung === 'freigeben' ? 'freigegeben' : 'abgelehnt'}.`, 'gut'); }
    else melde(r.text, 'kritisch');
  };
  const inhalt = (
    <div style={{ ...zeile, background: FLAECHE_STIL.gehoben.background, borderColor: TIEF.rand(RISIKO_FARBE[risiko]) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        <Chip farbe={RISIKO_FARBE[risiko]}>{RISIKO_NAME[risiko]}</Chip>
        {v.zeit && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{zeitKurz(v.zeit, jetzt)}</span>}
      </div>
      <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.4 }}>{v.titel}</div>
      {detail && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{detail}</div>}
      {erledigt ? <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>Erledigt: {erledigt}.</div> : (
        <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
          {risiko !== 'aussen' && <Knopf onClick={() => entscheide('freigeben', risiko !== 'risikoarm')}>Freigeben</Knopf>}
          <Knopf leise onClick={() => entscheide('ablehnen', true)}>Ablehnen</Knopf>
          <Knopf leise href={WEG.freigaben()}>Ansehen ›</Knopf>
        </div>
      )}
    </div>
  );
  return (
    <li>
      <WischZeile an={form === 'handy' && risiko === 'risikoarm' && !erledigt} onRechts={() => { void entscheide('freigeben', true); }} onLinks={() => { void entscheide('ablehnen', true); }}>{inhalt}</WischZeile>
    </li>
  );
}

export function WartetAufDich() {
  const { stapel, faeden, form, melde } = useAgenten();
  const rueckfragen = faeden.zustand === 'da' ? wartendeFaeden(faeden.daten.faeden) : [];
  const vorschlaege = stapel.zustand === 'da' ? stapel.daten.vorschlaege.filter(v => !v.status || v.status === 'offen') : [];
  const risikoarm = vorschlaege.filter(v => risikoVon(v) === 'risikoarm').length;
  const zahl = rueckfragen.length + vorschlaege.length;
  const alle = async () => {
    const r = await stapelEntscheiden({ alle: true });
    if (r.ok) melde(`${r.daten.erledigt ?? 0} risikoarme Freigaben erledigt.`, 'gut'); else melde(r.text, 'kritisch');
  };
  return (
    <Block titel="Wartet auf dich" zahl={zahl} puls={zahl > 0}>
      {stapel.zustand === 'laedt' && <Leer>Wird geladen …</Leer>}
      {stapel.zustand === 'gesperrt' && <Leer>Freigaben sieht hier nur der Haushalt.</Leer>}
      {stapel.zustand === 'fehler' && <Hinweis art="kritisch" aktion={<Knopf leise onClick={meldeNeu}>Noch einmal versuchen</Knopf>}>{stapel.text}</Hinweis>}
      {stapel.zustand !== 'laedt' && zahl === 0 && stapel.zustand !== 'fehler' && <Leer>Nichts wartet auf dich.</Leer>}
      {zahl > 0 && (
        <ul style={LISTE}>
          {rueckfragen.map(f => <RueckfrageZeile key={f.id} f={f} />)}
          {vorschlaege.slice(0, 6).map(v => <FreigabeZeile key={v.id} v={v} />)}
        </ul>
      )}
      {(risikoarm > 1 || vorschlaege.length > 6) && (
        <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
          {risikoarm > 1 && <Knopf onClick={alle}>Alle {risikoarm} risikoarmen freigeben</Knopf>}
          {vorschlaege.length > 6 && <Knopf leise href={WEG.freigaben()}>Alle {vorschlaege.length} ansehen ›</Knopf>}
        </div>
      )}
      {form === 'handy' && risikoarm > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Risikoarme: nach rechts wischen = freigeben, nach links = ablehnen.</span>}
    </Block>
  );
}

// ── Läuft · Fertig · Fehler ────────────────────────────────────────────────────────────────────────────────────────────

export function LaufZeile({ l }: { l: Lauf }) {
  const { agenten, oeffne, melde, bestaetigen, jetzt } = useAgenten();
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const h = heads.find(x => x.id === l.headId);
  const anteil = schrittAnteil(l);
  const dauer = l.dauerMs ?? (l.status === 'laeuft' ? jetzt.getTime() - Date.parse(l.start) : undefined);
  const tu = async (aktion: 'abbrechen' | 'neu-starten') => {
    if (aktion === 'abbrechen' && !(await bestaetigen({ titel: 'Lauf abbrechen?', text: `„${l.titel}“ hält an. Was schon fertig ist, bleibt.`, ja: 'Abbrechen', gefahr: true }))) return;
    // Neu starten: Kosten über der Schwelle bzw. Business-frei fragen nach (409) — dann mit Bestätigung erneut (Gegenprüfung 09.10.).
    const r = aktion === 'abbrechen' ? await laeufeSenden({ aktion, laufId: l.id })
      : await mitRueckfrage(z => laeufeSenden({ aktion: 'neu-starten', laufId: l.id, ...z }), bestaetigen, `„${l.titel}“ neu starten?`);
    if (r.ok) melde(aktion === 'abbrechen' ? `„${l.titel}“ abgebrochen.` : `„${l.titel}“ startet neu.`, 'gut');
    else if (r.text) melde(r.kommt ? 'Abbrechen und Neu starten kommen mit dem nächsten Paket.' : r.text, r.kommt ? 'info' : 'kritisch');
  };
  return (
    <li style={zeile}>
      <button type="button" onClick={() => (l.fadenId ? oeffne({ f: l.fadenId }) : l.headId ? oeffne({ h: l.headId }) : undefined)} className="fassbar"
        style={{ display: 'grid', gap: 2, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, minHeight: ZIEL.rechner }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, fontSize: TYP.bedien, color: C.inkDim }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: ECKE.eingabe, background: h ? headFarbe(h.farbe) : C.inkLeise }} />
          {h?.kurz ?? (l.quelle === 'takt' ? 'Takt' : 'ZOE')}
          <Chip farbe={LAUF_FARBE[l.status]}>{LAUF_NAME[l.status]}</Chip>
        </span>
        <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{l.titel}</span>
      </button>
      {anteil != null && l.status === 'laeuft' && <Fortschritt anteil={anteil} farbe={C.aktiv} />}
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>
        {[l.schritte ? `Schritt ${Math.min(l.schritte.fertig + (l.status === 'laeuft' ? 1 : 0), l.schritte.gesamt)}/${l.schritte.gesamt}${l.schritte.aktuell ? ` · ${l.schritte.aktuell}` : ''}` : null,
          l.status === 'laeuft' ? null : zeitKurz(l.ende ?? l.start, jetzt), dauerText(dauer) || null,
          l.kosten ? `${euro(l.kosten.cent)}${l.kosten.grenzeCent ? ` / ${euro(l.kosten.grenzeCent)}` : ''}` : null].filter(Boolean).join(' · ')}
      </span>
      {l.aktionen.length > 0 && (
        <div style={{ display: 'flex', gap: ABSTAND.s }}>
          {l.aktionen.includes('abbrechen') && <Knopf leise onClick={() => tu('abbrechen')}>Abbrechen</Knopf>}
          {l.aktionen.includes('neu-starten') && <Knopf leise onClick={() => tu('neu-starten')}>Neu starten</Knopf>}
        </div>
      )}
    </li>
  );
}

function Eingeklappt({ titel, laeufe }: { titel: string; laeufe: Lauf[] }) {
  const [offen, setOffen] = useState(false);
  if (!laeufe.length) return null;
  return (
    <div style={{ display: 'grid', gap: ABSTAND.s }}>
      <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} className="fassbar"
        style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, minHeight: ZIEL.handy, background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...MIKRO }}>
        {offen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}{titel} ({laeufe.length})
      </button>
      {offen && <ul style={LISTE}>{laeufe.map(l => <LaufZeile key={l.id} l={l} />)}</ul>}
    </div>
  );
}

export function Laeuft() {
  const { laeufe } = useAgenten();
  const g = laufGruppen(laeufe.zustand === 'da' ? laeufe.daten.laeufe : []);
  return (
    <Block titel="Läuft" zahl={g.laeuft.length}>
      {laeufe.zustand === 'laedt' && <Leer>Wird geladen …</Leer>}
      {laeufe.zustand === 'kommt' && <Leer>Hintergrundaufgaben erscheinen hier, sobald der Takt sie meldet.</Leer>}
      {laeufe.zustand === 'gesperrt' && <Leer>{laeufe.text}</Leer>}
      {laeufe.zustand === 'fehler' && <Hinweis art="kritisch" aktion={<Knopf leise onClick={meldeNeu}>Noch einmal versuchen</Knopf>}>{laeufe.text}</Hinweis>}
      {laeufe.zustand === 'da' && !g.laeuft.length && <Leer>Gerade läuft nichts im Hintergrund.</Leer>}
      {g.laeuft.length > 0 && <ul style={LISTE}>{g.laeuft.map(l => <LaufZeile key={l.id} l={l} />)}</ul>}
    </Block>
  );
}

export function FertigFehler() {
  const { laeufe } = useAgenten();
  const g = laufGruppen(laeufe.zustand === 'da' ? laeufe.daten.laeufe : []);
  if (!g.fertig.length && !g.fehler.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: ABSTAND.xs }}>
      <Eingeklappt titel="Fertig" laeufe={g.fertig} />
      <Eingeklappt titel="Fehler" laeufe={g.fehler} />
    </div>
  );
}

function NaechstesZeile({ n }: { n: Naechstes }) {
  const { agenten, jetzt } = useAgenten();
  const h = agenten.zustand === 'da' ? agenten.daten.heads.find(x => x.id === n.headId) : undefined;
  return (
    <li>
      <Knopf leise voll href={n.link} style={{ justifyContent: 'flex-start', textAlign: 'left', fontWeight: 600 }}>
        <span aria-hidden className={n.kritisch ? 'krit-puls' : undefined} style={{ width: 8, height: 8, borderRadius: ECKE.eingabe, flex: '0 0 auto', background: n.kritisch ? LEUCHT.kritisch : h ? headFarbe(h.farbe) : C.inkLeise }} />
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, minWidth: 64, fontVariantNumeric: 'tabular-nums' }}>{zeitKurz(n.wann, jetzt)}</span>
        {/* Titel führt; „werktags bis …“ steht darunter — nebeneinander verdrängte es den Titel bis auf „P…“ (Rundgang 09.10.). */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{naechstesTitel(n)}</span>
          {!!n.weitere && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}>{wiederholText(n, jetzt)}</span>}
        </span>
        {h && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{h.kurz}</span>}
      </Knopf>
    </li>
  );
}

export function AlsNaechstes() {
  const { laeufe } = useAgenten();
  const liste = laeufe.zustand === 'da' ? nachEisenhower(laeufe.daten.naechstes) : [];
  const gruppen = (['q1', 'q2', 'q3', 'q4'] as const).map(q => ({ q, eintraege: liste.filter(n => n.quadrant === q) })).filter(g => g.eintraege.length);
  return (
    <Block titel="Als Nächstes" zahl={liste.length}>
      {laeufe.zustand === 'laedt' && <Leer>Wird geladen …</Leer>}
      {laeufe.zustand === 'kommt' && <Leer>Geplante Läufe, Fristen und Freigaben der nächsten Tage stehen hier, sobald die Vorschau läuft.</Leer>}
      {laeufe.zustand === 'da' && !liste.length && <Leer>Die nächsten Tage ist nichts geplant.</Leer>}
      {gruppen.map(g => (
        <div key={g.q} style={{ display: 'grid', gap: ABSTAND.xs }}>
          <span style={{ fontSize: TYP.bedien, color: g.q === 'q1' ? LEUCHT.achtung : C.inkDim, fontWeight: 600 }}>{QUADRANT_NAME[g.q]}</span>
          <ul style={{ ...LISTE, gap: ABSTAND.xs }}>{g.eintraege.map(n => <NaechstesZeile key={n.id} n={n} />)}</ul>
        </div>
      ))}
    </Block>
  );
}

/** Die ganze rechte Spalte (am Handy der Reiter „Läuft“). */
export function Hintergrund() {
  return (
    <aside aria-label="Hintergrund" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: ABSTAND.xl, alignContent: 'start', minWidth: 0 }}>
      <WartetAufDich />
      <Laeuft />
      <AlsNaechstes />
      <FertigFehler />
    </aside>
  );
}

'use client';

// ─── MAKE OS — Gesundheit › Erholung (Auftrag 10.10.: „Einen Erholungsbereich … manche müssen extrem viel erholen bzw. Reha machen,
// die zweite Person nach dem Sport … der muss auch überall mit einstellbar sein“) ──────────────────────────────────────────────────
// Der Reiter: heute fällige Einheiten abhaken, Vorschlag aus den eigenen Körperwerten, Woche + Streak, eigene Programme, Vorlagen
// (neutrale Erholungsarten), Behandlungsserien mit Kalender-Verweis und eigenen Unterlagen, Erholungs-Ziele, eigener Fokus-Satz,
// Beschwerden-Verlauf (Symptom-Tagebuch) mit Zusammenhang, Pausen im Arbeitstag. Alle Rechnungen in lib/gesundheit/erholung-lage.ts,
// alle Daten über /api/gesundheit/erholung (die Route filtert — fremde Ansicht nur lesend und ohne Unterlagen/Kalender-Verweise).
// „Überall einstellbar“: Kalender › Planen (Baustein Erholung), Routinen (Kategorie Erholung), Aufgaben (Marke Erholung), Heute-Widget,
// Kapazität (zieht geplante Erholung ab), Zeit (Bereich Erholung).

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Fortschritt, Leer, Leerzustand, Hinweis, Schalter, Zeile, Feldzeile, feld, auswahl, LEUCHT } from '../ui';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { erholungStarten } from '@/lib/zeitmessung/fokus-laufend';
import {
  ERHOLUNG_VORLAGEN, ERHOLUNG_HINWEIS, PROGRAMM_STATUS, PROGRAMM_STATUS_NAME, BEHANDLUNG_STATUS, BEHANDLUNG_STATUS_NAME, erholungArtName, erholungHatInhalt,
  type ErholungProgramm, type ErholungArt, type Behandlung, type ProgrammStatus, type BehandlungStatus, type ErholungZiel,
} from '@/lib/gesundheit/erholung';
import { einheitName, naechstePause, programmMinuten, VORSCHLAG_TITEL } from '@/lib/gesundheit/erholung-lage';
import type { ErholungSicht } from '@/lib/gesundheit/erholung-server';
import { useErholung, ERHOLUNG_FARBE, type ErholungAntwort, type Op } from './erholung-daten';

export { useErholung, ERHOLUNG_FARBE, ERHOLUNG_GEAENDERT } from './erholung-daten';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const VORSCHLAG_FARBE: Record<string, string> = { erholungstag: LEUCHT.kritisch, entlastungswoche: LEUCHT.achtung, schlaf: LEUCHT.schlaf, leicht: LEUCHT.achtung, normal: LEUCHT.gut };

// ── Kleine Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────────────

function Klein({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{children}</div>;
}
function Reihe({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}
function Zahlfeld({ wert, setzen, label, min = 1, max = 600 }: { wert: number | ''; setzen: (n: number | '') => void; label: string; min?: number; max?: number }) {
  return <input type="number" inputMode="numeric" min={min} max={max} value={wert} aria-label={label} placeholder={label}
    onChange={e => setzen(e.target.value === '' ? '' : Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || min)))} style={{ ...feld, width: 96 }} />;
}

// ── Heute: Vorschlag, fällig, eintragen ─────────────────────────────────────────────────────────────────────────────────────

function VorschlagTeil({ v }: { v: ErholungSicht['vorschlag'] }) {
  if (!v) return <Klein>Noch kein Vorschlag — dafür braucht es eigene Werte (WHOOP oder Morgen-Check).</Klein>;
  const f = VORSCHLAG_FARBE[v.art] ?? ERHOLUNG_FARBE;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Reihe><Chip farbe={f}>{VORSCHLAG_TITEL[v.art]}</Chip></Reihe>
      <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>{v.text}</div>
      {v.gruende.length > 0 && <Klein>{v.gruende.join(' · ')}</Klein>}
      <Klein>{ERHOLUNG_HINWEIS}</Klein>
    </div>
  );
}

function HeuteKarte({ d, aendern, heute }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean>; heute: string }) {
  const s = d.erholung, sicht = d.sicht, eigene = d.eigene;
  const [art, setArt] = useState<ErholungArt>('spaziergang');
  const [minuten, setMinuten] = useState<number | ''>('');
  const [meldung, setMeldung] = useState<string | null>(null);
  const t = sicht.tag;
  const teile = [
    t.einheiten ? `${t.einheiten} Einheit${t.einheiten === 1 ? '' : 'en'}` : '', t.minuten ? `${t.minuten} min` : '',
    t.aufgaben ? `${t.aufgaben} Aufgabe${t.aufgaben === 1 ? '' : 'n'}` : '', t.routinen ? `${t.routinen} Routine${t.routinen === 1 ? '' : 'n'}` : '',
    t.zeitMin ? `${t.zeitMin} min gemessen` : '', t.geplantMin ? `${t.geplantMin} min im Kalender geplant` : '',
  ].filter(Boolean);
  return (
    <Karte i={0} akzent={ERHOLUNG_FARBE}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={sicht.streak.tage ? `${sicht.streak.tage} Tag${sicht.streak.tage === 1 ? '' : 'e'} in Folge` : undefined}>Erholung heute</Ueberschrift>
      {s.einstellungen.vorschlag !== false && <div style={{ marginBottom: 12 }}><VorschlagTeil v={sicht.vorschlag} /></div>}
      {sicht.faellig.length === 0 && <Leer>{s.programme.some(p => p.status === 'aktiv') ? 'Heute ist kein Programm dran.' : eigene ? 'Noch kein aktives Programm — unten eines anlegen oder eine Vorlage übernehmen.' : 'Heute ist kein Programm dran.'}</Leer>}
      {sicht.faellig.map(f => (
        <Zeile key={f.programm.id} titel={f.programm.name} unter={[f.minuten ? `${f.minuten} min` : '', f.grund, f.programm.stufe ?? ''].filter(Boolean).join(' · ')}
          rechts={<Schalter an={f.erledigt} aus={!eigene} farbe={ERHOLUNG_FARBE} ariaLabel={`${f.programm.name} heute erledigt`}
            onChange={an => { void aendern([an ? { op: 'einheit', einheit: { tag: heute, programmId: f.programm.id } } : { op: 'einheit-weg', programmId: f.programm.id, tag: heute }]); }} />} />
      ))}
      <div style={{ marginTop: 10 }}><Klein>{teile.length ? `Heute: ${teile.join(' · ')}` : 'Heute noch keine Erholung eingetragen.'}</Klein></div>
      {eigene && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <Reihe>
            <select value={art} onChange={e => setArt(e.target.value as ErholungArt)} aria-label="Erholungsart" style={auswahl}>
              {ERHOLUNG_VORLAGEN.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="eigene">Eigene</option>
            </select>
            <Zahlfeld wert={minuten} setzen={setMinuten} label="Minuten" />
            <Knopf farbe={ERHOLUNG_FARBE} onClick={async () => { if (await aendern([{ op: 'einheit', einheit: { tag: heute, art, ...(minuten ? { minuten } : {}) } }])) setMinuten(''); }}>Eintragen</Knopf>
          </Reihe>
          <Reihe>
            <Knopf leise onClick={() => { const r = erholungStarten(erholungArtName(art)); setMeldung(r.art === 'gestartet' ? 'Läuft — der Zähler steht oben im Kopf; beim Beenden zählt die Zeit als Erholung.' : `Es läuft schon „${r.label}“ — erst im Kopf beenden.`); }}>▶ Zeit messen</Knopf>
            <Knopf leise href={WEG.woche()}>Im Kalender planen ›</Knopf>
          </Reihe>
          {meldung && <Klein>{meldung}</Klein>}
        </div>
      )}
    </Karte>
  );
}

function WocheKarte({ d }: { d: ErholungAntwort }) {
  const { wocheTage, woche, streak } = d.sicht;
  const max = Math.max(30, ...wocheTage.map(t => t.minuten + t.zeitMin));
  return (
    <Karte i={1}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={streak.tage ? `Streak ${streak.tage}` : undefined}>Diese Woche</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'end', height: 72 }} aria-label="Erholung je Tag dieser Woche">
        {wocheTage.map((t, i) => {
          const min = t.minuten + t.zeitMin;
          return (
            <div key={t.tag} title={`${WD[i]} ${tagKurz(t.tag)} · ${t.erholt ? `${min} min` : 'keine Erholung'}${t.geplantMin ? ` · ${t.geplantMin} min geplant` : ''}`} style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <div style={{ width: '100%', height: Math.max(4, (min / max) * 52), borderRadius: 4, background: t.erholt ? ERHOLUNG_FARBE : 'rgba(255,255,255,.08)', opacity: t.erholt ? 0.9 : 1 }} />
              <span style={{ fontSize: TYP.mikro, color: C.inkLeise, textTransform: 'uppercase', letterSpacing: '.04em' }}>{WD[i]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {woche.length === 0 && <Klein>Programme zeigen hier ihr Soll je Woche.</Klein>}
        {woche.map(w => (
          <div key={w.id} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien }}><span style={{ color: C.ink }}>{w.name}</span><span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{w.ist} von {w.soll}</span></div>
            <Fortschritt anteil={w.soll ? w.ist / w.soll : 0} farbe={ERHOLUNG_FARBE} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}><Klein>„Erholung gehalten“ zählt jeden Tag mit einer Einheit, einer Erholungs-Aufgabe oder -Routine oder mindestens 5 gemessenen Minuten.</Klein></div>
    </Karte>
  );
}

// ── Programme ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface UebungEntwurf { id?: string; name: string; minuten: number | ''; wiederholungen: number | ''; saetze: number | '' }
interface ProgrammEntwurf { name: string; ziel: string; art: ErholungArt; proWoche: number | ''; tage: number[]; stufe: string; status: ProgrammStatus; uebungen: UebungEntwurf[] }
const entwurfAus = (p?: ErholungProgramm): ProgrammEntwurf => ({
  name: p?.name ?? '', ziel: p?.ziel ?? '', art: p?.art ?? 'eigene', proWoche: p?.proWoche ?? 3, tage: p?.tage ?? [], stufe: p?.stufe ?? '', status: p?.status ?? 'aktiv',
  uebungen: (p?.uebungen ?? []).map(u => ({ id: u.id, name: u.name, minuten: u.minuten ?? '', wiederholungen: u.wiederholungen ?? '', saetze: u.saetze ?? '' })),
});
const programmAusEntwurf = (e: ProgrammEntwurf) => ({
  name: e.name, ziel: e.ziel, art: e.art, proWoche: e.proWoche || 1, tage: e.tage, stufe: e.stufe, status: e.status,
  uebungen: e.uebungen.filter(u => u.name.trim()).map(u => ({ ...(u.id ? { id: u.id } : {}), name: u.name, ...(u.minuten ? { minuten: u.minuten } : {}), ...(u.wiederholungen ? { wiederholungen: u.wiederholungen } : {}), ...(u.saetze ? { saetze: u.saetze } : {}) })),
});

function ProgrammFormular({ start, speichern, abbrechen }: { start?: ErholungProgramm; speichern: (p: ReturnType<typeof programmAusEntwurf>) => Promise<boolean>; abbrechen: () => void }) {
  const [e, setE] = useState<ProgrammEntwurf>(() => entwurfAus(start));
  const set = <K extends keyof ProgrammEntwurf>(k: K, v: ProgrammEntwurf[K]) => setE(x => ({ ...x, [k]: v }));
  const setU = (i: number, u: Partial<UebungEntwurf>) => setE(x => ({ ...x, uebungen: x.uebungen.map((y, j) => (j === i ? { ...y, ...u } : y)) }));
  return (
    <form onSubmit={async ev => { ev.preventDefault(); if (await speichern(programmAusEntwurf(e))) abbrechen(); }} style={{ display: 'grid', gap: 10, padding: '10px 0' }}>
      <Feldzeile label="Name"><input value={e.name} onChange={x => set('name', x.target.value)} placeholder="z. B. Morgen-Mobility" style={feld} required /></Feldzeile>
      <Feldzeile label="Wofür (eigener Satz, optional)"><input value={e.ziel} onChange={x => set('ziel', x.target.value)} style={feld} /></Feldzeile>
      <Reihe>
        <Feldzeile label="Art"><select value={e.art} onChange={x => set('art', x.target.value as ErholungArt)} style={auswahl}>{ERHOLUNG_VORLAGEN.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}<option value="eigene">Eigene</option></select></Feldzeile>
        <Feldzeile label="Je Woche"><Zahlfeld wert={e.proWoche} setzen={n => set('proWoche', n)} label="mal je Woche" max={14} /></Feldzeile>
        <Feldzeile label="Stufe / Phase"><input value={e.stufe} onChange={x => set('stufe', x.target.value)} placeholder="z. B. Phase 1" style={{ ...feld, width: 140 }} /></Feldzeile>
        <Feldzeile label="Status"><select value={e.status} onChange={x => set('status', x.target.value as ProgrammStatus)} style={auswahl}>{PROGRAMM_STATUS.map(s => <option key={s} value={s}>{PROGRAMM_STATUS_NAME[s]}</option>)}</select></Feldzeile>
      </Reihe>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Feste Tage (leer = flexibel, bis die Woche ihr Soll hat)</span>
        <Reihe>{WD.map((w, i) => { const an = e.tage.includes(i + 1); return <button key={w} type="button" className="fassbar" aria-pressed={an} onClick={() => set('tage', an ? e.tage.filter(t => t !== i + 1) : [...e.tage, i + 1].sort())} style={{ minWidth: 44, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, background: an ? `${ERHOLUNG_FARBE}26` : 'rgba(255,255,255,.05)', color: an ? ERHOLUNG_FARBE : C.inkDim }}>{w}</button>; })}</Reihe>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Übungen</span>
        {e.uebungen.map((u, i) => (
          <Reihe key={u.id ?? `n${i}`}>
            <input value={u.name} onChange={x => setU(i, { name: x.target.value })} placeholder="Übung" aria-label="Übung" style={{ ...feld, flex: '1 1 160px', width: 'auto' }} />
            <Zahlfeld wert={u.minuten} setzen={n => setU(i, { minuten: n })} label="Min." />
            <Zahlfeld wert={u.wiederholungen} setzen={n => setU(i, { wiederholungen: n })} label="Wdh." max={500} />
            <Zahlfeld wert={u.saetze} setzen={n => setU(i, { saetze: n })} label="Sätze" max={50} />
            <Knopf leise onClick={() => setE(x => ({ ...x, uebungen: x.uebungen.filter((_, j) => j !== i) }))} ariaLabel="Übung entfernen">×</Knopf>
          </Reihe>
        ))}
        <div><Knopf leise onClick={() => setE(x => ({ ...x, uebungen: [...x.uebungen, { name: '', minuten: '', wiederholungen: '', saetze: '' }] }))}>+ Übung</Knopf></div>
      </div>
      <Reihe><Knopf typ="submit" farbe={ERHOLUNG_FARBE}>Speichern</Knopf><Knopf leise onClick={abbrechen}>Abbrechen</Knopf></Reihe>
    </form>
  );
}

function ProgrammeKarte({ d, aendern }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean> }) {
  const [offen, setOffen] = useState<string | null>(null);
  const s = d.erholung, eigene = d.eigene;
  const reihe = [...s.programme].sort((a, b) => PROGRAMM_STATUS.indexOf(a.status) - PROGRAMM_STATUS.indexOf(b.status) || a.name.localeCompare(b.name));
  return (
    <Karte i={2}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={eigene && offen !== 'neu' ? <button type="button" onClick={() => setOffen('neu')} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, fontFamily: SCHRIFT.text }}>+ Programm</button> : undefined}>Programme</Ueberschrift>
      {offen === 'neu' && <ProgrammFormular speichern={p => aendern([{ op: 'programm', programm: p }])} abbrechen={() => setOffen(null)} />}
      {reihe.length === 0 && offen !== 'neu' && <Leer>{eigene ? 'Noch kein Programm. Eigene Übungen anlegen oder rechts eine Vorlage übernehmen.' : 'Keine Programme.'}</Leer>}
      {reihe.map(p => (
        offen === p.id ? <ProgrammFormular key={p.id} start={p} speichern={x => aendern([{ op: 'programm', id: p.id, programm: x }])} abbrechen={() => setOffen(null)} /> : (
          <Zeile key={p.id} onClick={eigene ? () => setOffen(p.id) : undefined}
            titel={<span style={{ color: p.status === 'aktiv' ? C.ink : C.inkLeise }}>{p.name}</span>}
            unter={[erholungArtName(p.art), `${p.proWoche}× je Woche`, p.tage.length ? p.tage.map(t => WD[t - 1]).join(' ') : 'flexibel', programmMinuten(p) ? `${programmMinuten(p)} min` : '', p.stufe ?? '', p.uebungen.length ? `${p.uebungen.length} Übung${p.uebungen.length === 1 ? '' : 'en'}` : '', p.ziel ?? ''].filter(Boolean).join(' · ')}
            rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.status !== 'aktiv' && <Chip farbe={C.inkDim}>{PROGRAMM_STATUS_NAME[p.status]}</Chip>}
              {eigene && <Knopf leise ariaLabel={`${p.name} entfernen`} onClick={async () => { if (window.confirm(`„${p.name}“ entfernen? Erledigte Einheiten bleiben im Protokoll.`)) await aendern([{ op: 'weg', liste: 'programme', id: p.id }]); }}>×</Knopf>}
            </span>} />
        )
      ))}
    </Karte>
  );
}

function VorlagenKarte({ aendern }: { aendern: (ops: Op[]) => Promise<boolean> }) {
  return (
    <Karte i={3}>
      <Ueberschrift farbe={ERHOLUNG_FARBE}>Vorlagen</Ueberschrift>
      <Klein>Allgemeine Erholungsarten zum Übernehmen — danach frei anpassbar.</Klein>
      <div style={{ marginTop: 8 }}>
        {ERHOLUNG_VORLAGEN.map(v => (
          <Zeile key={v.id} titel={v.name} unter={`${v.minuten} min · ${v.proWoche}× je Woche · ${v.satz}`}
            rechts={<Knopf leise onClick={() => aendern([{ op: 'programm', programm: { name: v.name, art: v.id, proWoche: Math.min(14, v.proWoche), uebungen: [{ name: v.name, minuten: v.minuten }] } }])}>Übernehmen</Knopf>} />
        ))}
      </div>
    </Karte>
  );
}

// ── Behandlungen ────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface KalTermin { id: string; titel: string; start: string; maskiert?: true }
interface UnterlageKurz { id: string; name: string }

function BehandlungKarte({ b, eigene, aendern, heute, termine, unterlagen }: { b: Behandlung; eigene: boolean; aendern: (ops: Op[]) => Promise<boolean>; heute: string; termine: KalTermin[]; unterlagen: UnterlageKurz[] }) {
  const [tag, setTag] = useState(heute);
  const [uhr, setUhr] = useState('');
  const [termin, setTermin] = useState('');
  const [bearbeiten, setBearbeiten] = useState(false);
  const [art, setArt] = useState(b.art);
  const [geplant, setGeplant] = useState<number | ''>(b.geplant ?? '');
  const [status, setStatus] = useState<BehandlungStatus>(b.status);
  const erledigt = b.termine.filter(t => t.erledigt).length;
  const naechster = b.termine.find(t => !t.erledigt && t.tag >= heute);
  return (
    <div style={{ borderBottom: `1px solid ${C.linie}`, padding: '10px 0', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: TYP.body, color: C.ink, fontWeight: 600 }}>{b.art}</span>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{b.geplant ? `${erledigt} von ${b.geplant}` : `${erledigt} erledigt`} · {BEHANDLUNG_STATUS_NAME[b.status]}</span>
      </div>
      {b.geplant ? <Fortschritt anteil={erledigt / b.geplant} farbe={ERHOLUNG_FARBE} /> : null}
      <Klein>{naechster ? `Nächster Termin: ${tagKurz(naechster.tag)}${naechster.uhr ? ` ${naechster.uhr}` : ''}` : 'Kein offener Termin.'}{b.notiz ? ` · ${b.notiz}` : ''}</Klein>
      {b.termine.map(t => (
        <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
          <Schalter an={t.erledigt} aus={!eigene} farbe={ERHOLUNG_FARBE} ariaLabel={`Termin ${tagKurz(t.tag)} erledigt`} onChange={an => { void aendern([{ op: 'behandlung-termin', id: b.id, terminKennung: t.id, termin: { erledigt: an } }]); }} />
          <span style={{ color: t.erledigt ? C.inkLeise : C.ink }}>{tagKurz(t.tag)}{t.uhr ? ` ${t.uhr}` : ''}</span>
          {t.terminId && <Link href={WEG.termin(t.terminId, t.tag)} style={{ color: C.inkDim }}>im Kalender ›</Link>}
          {eigene && <button type="button" onClick={() => { void aendern([{ op: 'behandlung-termin-weg', id: b.id, terminKennung: t.id }]); }} aria-label="Termin entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>}
        </div>
      ))}
      {eigene && (
        <form onSubmit={async ev => { ev.preventDefault(); const k = termine.find(x => x.id === termin); if (await aendern([{ op: 'behandlung-termin', id: b.id, termin: { tag: k ? k.start.slice(0, 10) : tag, ...(k ? { uhr: k.start.slice(11, 16), terminId: k.id } : uhr ? { uhr } : {}) } }])) { setTermin(''); setUhr(''); } }} style={{ display: 'grid', gap: 6 }}>
          <Reihe>
            <select value={termin} onChange={e => setTermin(e.target.value)} aria-label="Mit einem Kalender-Termin verknüpfen" style={{ ...auswahl, maxWidth: 260 }}>
              <option value="">Tag von Hand …</option>
              {termine.map(k => <option key={k.id} value={k.id}>{tagKurz(k.start.slice(0, 10))} {k.start.slice(11, 16)} · {k.titel}</option>)}
            </select>
            {!termin && <input type="date" value={tag} onChange={e => setTag(e.target.value)} aria-label="Tag" style={{ ...feld, width: 160, colorScheme: 'dark' }} />}
            {!termin && <input type="time" value={uhr} onChange={e => setUhr(e.target.value)} aria-label="Uhrzeit" style={{ ...feld, width: 120, colorScheme: 'dark' }} />}
            <Knopf typ="submit" leise>+ Termin</Knopf>
          </Reihe>
          <Klein>Verknüpft wird nur über die Kennung des Kalender-Termins — der Titel wird nie kopiert.</Klein>
        </form>
      )}
      {eigene && unterlagen.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Eigene Unterlagen dazu</span>
          <Reihe>{unterlagen.map(u => { const an = b.unterlagen.includes(u.id); return <button key={u.id} type="button" className="fassbar" aria-pressed={an} onClick={() => { void aendern([{ op: 'behandlung', id: b.id, behandlung: { unterlagen: an ? b.unterlagen.filter(x => x !== u.id) : [...b.unterlagen, u.id] } }]); }} style={{ minHeight: 44, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, background: an ? `${ERHOLUNG_FARBE}26` : 'rgba(255,255,255,.05)', color: an ? ERHOLUNG_FARBE : C.inkDim }}>{u.name}</button>; })}</Reihe>
        </div>
      )}
      {eigene && !bearbeiten && <Reihe><Knopf leise onClick={() => setBearbeiten(true)}>Bearbeiten</Knopf><Knopf leise onClick={async () => { if (window.confirm(`„${b.art}“ entfernen?`)) await aendern([{ op: 'weg', liste: 'behandlungen', id: b.id }]); }}>Entfernen</Knopf></Reihe>}
      {eigene && bearbeiten && (
        <form onSubmit={async ev => { ev.preventDefault(); if (await aendern([{ op: 'behandlung', id: b.id, behandlung: { art, geplant: geplant || null, status } }])) setBearbeiten(false); }} style={{ display: 'grid', gap: 6 }}>
          <Reihe>
            <input value={art} onChange={e => setArt(e.target.value)} aria-label="Art der Behandlung" style={{ ...feld, flex: '1 1 160px', width: 'auto' }} />
            <Zahlfeld wert={geplant} setzen={setGeplant} label="von … Terminen" max={200} />
            <select value={status} onChange={e => setStatus(e.target.value as BehandlungStatus)} aria-label="Status" style={auswahl}>{BEHANDLUNG_STATUS.map(x => <option key={x} value={x}>{BEHANDLUNG_STATUS_NAME[x]}</option>)}</select>
          </Reihe>
          <Reihe><Knopf typ="submit" farbe={ERHOLUNG_FARBE}>Speichern</Knopf><Knopf leise onClick={() => setBearbeiten(false)}>Abbrechen</Knopf></Reihe>
        </form>
      )}
    </div>
  );
}

function BehandlungenKarte({ d, aendern, heute }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean>; heute: string }) {
  const [art, setArt] = useState('');
  const [geplant, setGeplant] = useState<number | ''>('');
  const [termine, setTermine] = useState<KalTermin[]>([]);
  const [unterlagen, setUnterlagen] = useState<UnterlageKurz[]>([]);
  const eigene = d.eigene;
  useEffect(() => {
    if (!eigene) return;
    const bis = new Date(`${heute}T12:00:00`); bis.setDate(bis.getDate() + 90);
    fetch(`/api/kalender?von=${heute}&bis=${localDay(bis)}`, { cache: 'no-store' }).then(r => r.json())
      .then(x => setTermine(((x?.termine ?? []) as KalTermin[]).filter(t => !t.maskiert).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 80))).catch(() => {});
    fetch('/api/gesundheit/unterlagen', { cache: 'no-store' }).then(r => r.json()).then(x => setUnterlagen(((x?.unterlagen ?? []) as UnterlageKurz[]).map(u => ({ id: u.id, name: u.name })))).catch(() => {});
  }, [eigene, heute]);
  const offen = d.erholung.behandlungen;
  return (
    <Karte i={4}>
      <Ueberschrift farbe={ERHOLUNG_FARBE}>Behandlungen & Termine</Ueberschrift>
      {offen.length === 0 && <Leer>{eigene ? 'Eine Serie anlegen (z. B. zehn Termine) — dann zählt „6 von 10“ mit.' : 'Keine Behandlungen.'}</Leer>}
      {offen.map(b => <BehandlungKarte key={b.id} b={b} eigene={eigene} aendern={aendern} heute={heute} termine={termine} unterlagen={unterlagen} />)}
      {eigene && (
        <form onSubmit={async ev => { ev.preventDefault(); if (!art.trim()) return; if (await aendern([{ op: 'behandlung', behandlung: { art, ...(geplant ? { geplant } : {}) } }])) { setArt(''); setGeplant(''); } }} style={{ marginTop: 10 }}>
          <Reihe>
            <input value={art} onChange={e => setArt(e.target.value)} placeholder="Art, z. B. Physiotherapie" aria-label="Art der Behandlung" style={{ ...feld, flex: '1 1 180px', width: 'auto' }} />
            <Zahlfeld wert={geplant} setzen={setGeplant} label="Termine" max={200} />
            <Knopf typ="submit" farbe={ERHOLUNG_FARBE}>+ Serie</Knopf>
          </Reihe>
        </form>
      )}
    </Karte>
  );
}

// ── Ziele, Fokus, Beschwerde, Einstellungen, Protokoll ───────────────────────────────────────────────────────────────────────

function ZieleKarte({ d, aendern }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean> }) {
  const [titel, setTitel] = useState('');
  const [zeitraum, setZeitraum] = useState<ErholungZiel['zeitraum']>('woche');
  const [einheiten, setEinheiten] = useState<number | ''>(3);
  const [minuten, setMinuten] = useState<number | ''>('');
  const [programmId, setProgrammId] = useState('');
  const eigene = d.eigene;
  return (
    <Karte i={5}>
      <Ueberschrift farbe={ERHOLUNG_FARBE}>Erholungs-Ziele</Ueberschrift>
      {d.sicht.ziele.length === 0 && <Leer>{eigene ? 'Z. B. „3× Erholung je Woche“ oder „90 Minuten je Woche“ — der Fortschritt kommt aus den erledigten Einheiten.' : 'Keine Erholungs-Ziele.'}</Leer>}
      {d.sicht.ziele.map(z => (
        <div key={z.id} style={{ display: 'grid', gap: 4, padding: '8px 0', borderBottom: `1px solid ${C.linie}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: TYP.bedien }}>
            <span style={{ color: C.ink }}>{z.titel} <span style={{ color: C.inkLeise }}>· {z.zeitraum === 'woche' ? 'diese Woche' : 'diesen Monat'}</span></span>
            <span style={{ color: z.erreicht ? ERHOLUNG_FARBE : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
              {[z.soll.einheiten ? `${z.ist.einheiten}/${z.soll.einheiten}` : '', z.soll.minuten ? `${z.ist.minuten}/${z.soll.minuten} min` : ''].filter(Boolean).join(' · ')}
              {eigene && <button type="button" aria-label={`${z.titel} entfernen`} onClick={() => { void aendern([{ op: 'weg', liste: 'ziele', id: z.id }]); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', marginLeft: 6 }}>×</button>}
            </span>
          </div>
          <Fortschritt anteil={z.anteil} farbe={ERHOLUNG_FARBE} />
        </div>
      ))}
      {eigene && (
        <form onSubmit={async ev => { ev.preventDefault(); if (!titel.trim()) return; if (await aendern([{ op: 'ziel', ziel: { titel, zeitraum, ...(einheiten ? { einheiten } : {}), ...(minuten ? { minuten } : {}), ...(programmId ? { programmId } : {}) } }])) setTitel(''); }} style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          <input value={titel} onChange={e => setTitel(e.target.value)} placeholder="Titel, z. B. 3× Erholung je Woche" aria-label="Titel des Ziels" style={feld} />
          <Reihe>
            <select value={zeitraum} onChange={e => setZeitraum(e.target.value as ErholungZiel['zeitraum'])} aria-label="Zeitraum" style={auswahl}><option value="woche">je Woche</option><option value="monat">je Monat</option></select>
            <Zahlfeld wert={einheiten} setzen={setEinheiten} label="Einheiten" max={100} />
            <Zahlfeld wert={minuten} setzen={setMinuten} label="Minuten" max={10000} />
            <select value={programmId} onChange={e => setProgrammId(e.target.value)} aria-label="Nur ein Programm" style={auswahl}><option value="">jede Erholung</option>{d.erholung.programme.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <Knopf typ="submit" farbe={ERHOLUNG_FARBE}>+ Ziel</Knopf>
          </Reihe>
        </form>
      )}
    </Karte>
  );
}

function FokusKarte({ d, aendern }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean> }) {
  const [text, setText] = useState(d.erholung.fokus);
  useEffect(() => { setText(d.erholung.fokus); }, [d.erholung.fokus]);
  return (
    <Karte i={6}>
      <Ueberschrift farbe={ERHOLUNG_FARBE}>Fokus der Erholung</Ueberschrift>
      {d.eigene ? (
        <form onSubmit={ev => { ev.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }} style={{ display: 'grid', gap: 6 }}>
          <input value={text} onChange={e => setText(e.target.value)} onBlur={() => { if (text !== d.erholung.fokus) void aendern([{ op: 'fokus', text }]); }} placeholder="Worauf es bei deiner Erholung gerade ankommt" aria-label="Fokus der Erholung" maxLength={300} style={feld} />
          <Klein>Steht auf Heute im Widget „Erholung heute“ — an ZOE nur mit deiner Einwilligung „An die KI geben“.</Klein>
        </form>
      ) : <div style={{ fontSize: TYP.body, color: d.erholung.fokus ? C.ink : C.inkLeise }}>{d.erholung.fokus || 'Kein Fokus gesetzt.'}</div>}
    </Karte>
  );
}

function BeschwerdeKarte({ b }: { b: NonNullable<ErholungSicht['beschwerde']> }) {
  const echte = b.tage.filter(t => t.wert != null);
  return (
    <Karte i={7}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href={WEG.gesundheit('haut')} style={{ color: C.inkLeise, textDecoration: 'none' }}>eintragen ›</Link>}>{b.name} · 30 Tage</Ueberschrift>
      {echte.length === 0 ? <Leer>Noch keine Einträge in 30 Tagen.</Leer> : (
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56 }} aria-label={`${b.name} je Tag, 30 Tage`}>
          {b.tage.map(t => <span key={t.tag} title={`${tagKurz(t.tag)} · ${t.wert ?? 'kein Eintrag'}`} style={{ flex: 1, height: t.wert == null ? 3 : Math.max(3, (t.wert / 10) * 56), borderRadius: 2, background: t.wert == null ? C.linie : t.wert >= 7 ? LEUCHT.kritisch : t.wert >= 4 ? LEUCHT.achtung : LEUCHT.gut }} />)}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        <Klein>Skala 0–10, niedriger ist besser.{b.ausloeser.length ? ` Auslöser in 30 Tagen: ${b.ausloeser.map(a => `${a.was} (${a.mal}×)`).join(' · ')}` : ''}</Klein>
        <Klein>{b.zusammenhang ? b.zusammenhang.satz : 'Zusammenhang „Erholung ↔ Folgetag“ erst ab je 5 Tagen mit und ohne Erholung (mit Eintrag am Folgetag).'}</Klein>
      </div>
    </Karte>
  );
}

function EinstellungenKarte({ d, aendern }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean> }) {
  const p = d.erholung.einstellungen.pausen ?? { an: false, alleMin: 90, von: '09:00', bis: '17:00' };
  const [alle, setAlle] = useState<number | ''>(p.alleMin);
  const [von, setVon] = useState(p.von);
  const [bis, setBis] = useState(p.bis);
  const jetzt = new Date();
  const naechste = naechstePause(p, jetzt.getHours() * 60 + jetzt.getMinutes());
  const vorschlagAn = d.erholung.einstellungen.vorschlag !== false;
  return (
    <Karte i={8}>
      <Ueberschrift farbe={ERHOLUNG_FARBE}>Einstellungen</Ueberschrift>
      <Zeile titel="Vorschlag aus deinen Körperwerten" unter="Recovery, Belastung, HRV-Trend, Schlafschuld" rechts={<Schalter an={vorschlagAn} farbe={ERHOLUNG_FARBE} ariaLabel="Vorschlag zeigen" onChange={an => { void aendern([{ op: 'einstellungen', einstellungen: { vorschlag: an } }]); }} />} />
      <Zeile titel="Pausen im Arbeitstag" unter={p.an ? (naechste ? `nächste Pause ${naechste.um}${naechste.faellig ? ' — jetzt fällig' : ''}` : 'heute keine mehr') : 'aus'}
        rechts={<Schalter an={p.an} farbe={ERHOLUNG_FARBE} ariaLabel="Pausen-Erinnerung" onChange={an => { void aendern([{ op: 'einstellungen', einstellungen: { pausen: { ...p, an } } }]); }} />} />
      {p.an && (
        <form onSubmit={async ev => { ev.preventDefault(); await aendern([{ op: 'einstellungen', einstellungen: { pausen: { an: true, alleMin: alle || 90, von, bis } } }]); }} style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          <Reihe>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>alle</span><Zahlfeld wert={alle} setzen={setAlle} label="Minuten" min={30} max={240} />
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>min, von</span><input type="time" value={von} onChange={e => setVon(e.target.value)} aria-label="Arbeitstag von" style={{ ...feld, width: 120, colorScheme: 'dark' }} />
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>bis</span><input type="time" value={bis} onChange={e => setBis(e.target.value)} aria-label="Arbeitstag bis" style={{ ...feld, width: 120, colorScheme: 'dark' }} />
            <Knopf typ="submit" leise>Speichern</Knopf>
          </Reihe>
          <Klein>Die nächste Pause steht auf Heute im Widget „Erholung heute“; „Pause gemacht“ trägt eine Bildschirmpause ein.</Klein>
        </form>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: TYP.bedien }}>
        <Link href={WEG.woche()} style={{ color: C.inkDim }}>Erholung im Kalender planen ›</Link>
        <Link href={WEG.routinen()} style={{ color: C.inkDim }}>Routinen mit Kategorie „Erholung“ ›</Link>
        <Link href={WEG.sport('erholung')} style={{ color: C.inkDim }}>Sport › Erholung ›</Link>
      </div>
    </Karte>
  );
}

function ProtokollKarte({ d, aendern }: { d: ErholungAntwort; aendern: (ops: Op[]) => Promise<boolean> }) {
  const letzte = useMemo(() => [...d.erholung.einheiten].sort((a, b) => b.tag.localeCompare(a.tag) || b.am.localeCompare(a.am)).slice(0, 12), [d.erholung.einheiten]);
  return (
    <Karte i={9}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={d.erholung.einheiten.length ? `${d.erholung.einheiten.length} insgesamt` : undefined}>Zuletzt</Ueberschrift>
      {letzte.length === 0 && <Leer>Noch keine Einheit eingetragen.</Leer>}
      {letzte.map(e => (
        <Zeile key={e.id} titel={einheitName(e, d.erholung.programme)} unter={[tagKurz(e.tag), e.minuten ? `${e.minuten} min` : '', e.notiz ?? ''].filter(Boolean).join(' · ')}
          rechts={d.eigene ? <Knopf leise ariaLabel="Einheit entfernen" onClick={() => aendern([{ op: 'einheit-weg', id: e.id }])}>×</Knopf> : undefined} />
      ))}
    </Karte>
  );
}

// ── Der Reiter ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Gesundheit › Erholung. `fuer` = die angezeigte Person (andere nur lesend, nur wenn geteilt — die Route entscheidet). */
export function ErholungReiter({ fuer, eigene }: { fuer?: string; eigene: boolean }) {
  const { d, fehler, geladen, aendern } = useErholung(eigene ? undefined : fuer);
  const heute = localDay();
  if (!geladen) return <Leer>Erholung lädt …</Leer>;
  if (!d) return <Leer>{fehler ?? 'Die Erholung dieser Person ist nicht geteilt.'}</Leer>;
  const leer = !erholungHatInhalt(d.erholung);
  return (
    <>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {leer && d.eigene && (
        <Leerzustand symbol={<Leaf size={22} />} titel="Dein Erholungsbereich" ton={ERHOLUNG_FARBE}>
          Programme, Behandlungen, Ziele und ein Vorschlag aus deinen eigenen Werten — eine Vorlage übernehmen oder ein eigenes Programm anlegen. Nur du siehst das, außer du teilst deine Gesundheit.
        </Leerzustand>
      )}
      <Flaeche seite="gesundheit-erholung">
        <Kachel id="heute" titel="Erholung heute" breite={3}><HeuteKarte d={d} aendern={aendern} heute={heute} /></Kachel>
        <Kachel id="woche" titel="Diese Woche" breite={3}><WocheKarte d={d} /></Kachel>
        <Kachel id="programme" titel="Programme" breite={3}><ProgrammeKarte d={d} aendern={aendern} /></Kachel>
        {d.eigene && <Kachel id="vorlagen" titel="Vorlagen" breite={3}><VorlagenKarte aendern={aendern} /></Kachel>}
        <Kachel id="behandlungen" titel="Behandlungen & Termine" breite={3}><BehandlungenKarte d={d} aendern={aendern} heute={heute} /></Kachel>
        <Kachel id="ziele" titel="Erholungs-Ziele" breite={3}><ZieleKarte d={d} aendern={aendern} /></Kachel>
        <Kachel id="fokus" titel="Fokus der Erholung" breite={3}><FokusKarte d={d} aendern={aendern} /></Kachel>
        {d.sicht.beschwerde && <Kachel id="beschwerde" titel="Beschwerden-Verlauf" breite={3}><BeschwerdeKarte b={d.sicht.beschwerde} /></Kachel>}
        {d.eigene && <Kachel id="einstellungen" titel="Einstellungen" breite={3}><EinstellungenKarte d={d} aendern={aendern} /></Kachel>}
        <Kachel id="protokoll" titel="Zuletzt" breite={3}><ProtokollKarte d={d} aendern={aendern} /></Kachel>
      </Flaeche>
    </>
  );
}

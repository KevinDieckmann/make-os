'use client';

// ─── MAKE OS — Journal ──────────────────────────────────────────────────────
// Kurz festhalten, wie der Tag war — daraus entstehen die Daten für den Weg.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Balken/Chip).

import Link from 'next/link';
import { localDay } from '@/lib/zeit';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Leer, Chip, Balken, feld, LEUCHT } from './schlank';
import { Flaeche, Kachel } from './flaeche/Flaeche';

interface Entry { text?: string; mood?: number; energy?: number; stress?: number; haut?: string; ruecken?: string; flags?: string[]; at?: string; gut?: string; dankbar?: string; hart?: string; tagesnote?: string }
type Journal = Record<string, Entry>;
const ymd = (d: Date) => localDay(d);

const FLAGS: { id: string; label: string }[] = [
  { id: 'antiinflamm', label: 'Anti-entzündlich gegessen' },
  { id: 'bewegt', label: 'Bewegt / Reha gemacht' },
  { id: 'gutgeschlafen', label: 'Gut geschlafen' },
  { id: 'keincannabis', label: 'Kein Cannabis' },
  { id: 'keinalkohol', label: 'Kein Alkohol' },
];

/** Pille zum Umschalten — leuchtet in der Kennzahlfarbe, wenn sie an ist. */
const pille = (an: boolean, farbe: string): CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: 'none',
  background: an ? `${farbe}22` : 'rgba(255,255,255,.06)', color: an ? farbe : C.inkDim, transition: 'background .15s ease, color .15s ease',
});

export function JournalView() {
  const today = ymd(new Date());
  const [journal, setJournal] = useState<Journal>({});
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    fetch('/api/state/journal').then(r => r.json()).then((d: { journal: Journal }) => setJournal(d.journal ?? {})).catch(() => {});
  }, []);

  // Nur die geänderten Felder des Tages (PATCH) — kein Zurückschreiben der ganzen Datei, das überschriebe,
  // was Gesundheit, Tagesstart, Vitals-Merge und Jarvis inzwischen eingetragen haben (26.09.).
  const offen = useRef<Partial<Entry>>({});
  const spaeter = useNachspeichern<Partial<Entry>>(eintrag => {
    offen.current = {};
    fetch('/api/state/journal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: today, eintrag }) })
      .then(() => setSaved(true)).catch(() => {});
  }, 500);

  const entry = journal[today] ?? {};
  function patch(p: Partial<Entry>) {
    setSaved(false);
    const cur = journal[today] ?? {};
    const next: Journal = { ...journal, [today]: { ...cur, ...p, at: new Date().toISOString() } };
    setJournal(next);
    offen.current = { ...offen.current, ...p };
    spaeter(offen.current);
  }
  // „Kein Cannabis“ ist der Streak, „Bewegt / Reha“ die Reha-Routine — beides landet dort, wo es zählt.
  const nebenwirkung = (id: string, an: boolean) => {
    if (id === 'keincannabis' && an) fetch('/api/state/streak', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eintrag: { sauber: true } }) }).catch(() => {});
    if (id === 'bewegt' && an) fetch('/api/state/routinen').then(r => r.json()).then(d => {
      const reha = (d.routinen ?? []).find((r: { id: string; label: string; aktiv: boolean }) => r.aktiv && /reha|mobil|beweg/i.test(`${r.id} ${r.label}`));
      if (!reha) return;
      return fetch('/api/state/health').then(r => r.json()).then(h => { const log = h.log ?? {}; const tag = new Set<string>(log[today] ?? []); tag.add(reha.id); return fetch('/api/state/health', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...log, [today]: Array.from(tag) }) }); });
    }).catch(() => {});
  };
  const toggleFlag = (id: string) => {
    const f = new Set(entry.flags ?? []);
    const an = !f.has(id);
    if (an) f.add(id); else f.delete(id);
    patch({ flags: Array.from(f) });
    nebenwirkung(id, an);
  };

  const dots = (label: string, val: number | undefined, set: (n: number) => void, bad = false) => (
    <div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const on = (val ?? 0) >= n;
          const c = bad ? LEUCHT.kritisch : LEUCHT.gut;
          return (
            <button key={n} onClick={() => set(n)} aria-label={`${label} ${n}`} className="fassbar" style={{
              width: 30, height: 30, borderRadius: 10, cursor: 'pointer', border: 'none', fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700,
              background: on ? c : 'rgba(255,255,255,.07)', color: on ? C.grund : C.inkLeise, boxShadow: on ? `0 0 10px ${c}33` : undefined, transition: 'background .15s ease',
            }}>{n}</button>
          );
        })}
      </div>
    </div>
  );
  // Verlauf (ohne heute) + Trend
  const history = useMemo(() => Object.entries(journal).filter(([d]) => d !== today).sort((a, b) => b[0].localeCompare(a[0])), [journal, today]);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return { tag: ymd(d), e: journal[ymd(d)] ?? {} }; }), [journal]);
  const datumKurz = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

  const trend: { name: string; pick: (e: Entry) => number | undefined; c: string }[] = [
    { name: 'Stimmung', pick: e => e.mood, c: LEUCHT.gut },
    { name: 'Energie', pick: e => e.energy, c: LEUCHT.gut },
    { name: 'Stress', pick: e => e.stress, c: LEUCHT.kritisch },
  ];

  return (
    <Seite
      titel={<span suppressHydrationWarning>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</span>}
      unter="Journal · dein Datenweg — kurz festhalten, wie der Tag war. Daraus entstehen deine Daten, um den Weg immer wieder anzupassen."
      rechts={<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip farbe={saved ? LEUCHT.gut : LEUCHT.achtung}>{saved ? 'gespeichert ✓' : 'speichert …'}</Chip>
        <Link href="/os/gesundheit" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Gesundheit ›</Link>
      </div>}
    >
      <Flaeche seite="journal">
      <Kachel id="journal" titel="Journal" breite={6}>
      <Karte i={0} akzent={LEUCHT.gut}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit#haut" style={{ color: C.inkLeise, textDecoration: 'none' }}>Haut & Streak auf Gesundheit ›</Link>}>Journal</Ueberschrift>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            {dots('Stimmung', entry.mood, n => patch({ mood: n }))}
            {dots('Energie', entry.energy, n => patch({ energy: n }))}
            {dots('Stress', entry.stress, n => patch({ stress: n }), true)}
          </div>
          <div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>Heute gelungen</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FLAGS.map(f => { const on = (entry.flags ?? []).includes(f.id); return <button key={f.id} onClick={() => toggleFlag(f.id)} className="fassbar" style={pille(on, C.aktiv)}>{on ? '✓ ' : ''}{f.label}</button>; })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 8 }}>Was war heute? Was ist dir aufgefallen?</div>
            <textarea value={entry.text ?? ''} onChange={e => patch({ text: e.target.value })} rows={5} placeholder="Frei schreiben …"
              style={{ ...feld, resize: 'vertical', lineHeight: 1.55 }} />
          </div>
        </div>
      </Karte>
      </Kachel>

        {trend.map((t, i) => {
          const werte = last14.map(x => t.pick(x.e) ?? null);
          const hat = werte.some(w => w != null);
          return (
            <Kachel key={t.name} id={`trend-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} titel={`${t.name} · 14 Tage`} breite={2}>
            <Karte i={1 + i}>
              <Ueberschrift farbe={t.c} rechts="14 Tage">{t.name}</Ueberschrift>
              {hat
                ? <Balken werte={werte} max={5} farbe={t.c} hoehe={40} titel={last14.map(x => `${datumKurz(x.tag)} · ${t.pick(x.e) ?? '—'}`)} />
                : <Leer>Noch nichts eingetragen.</Leer>}
            </Karte>
            </Kachel>
          );
        })}

      <Kachel id="verlauf" titel="Verlauf" breite={6}>
      <Karte i={4}>
        <Ueberschrift rechts={history.length ? `${history.length} Einträge` : undefined}>Verlauf</Ueberschrift>
        {history.length === 0 && <Leer>Noch keine früheren Einträge — heute ist der Anfang. 🌱</Leer>}
        <Liste>
          {history.slice(0, 30).map(([date, e]) => (
            <div key={date} className="zeile" style={{ padding: '12px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>{new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                {typeof e.mood === 'number' && <Chip farbe={LEUCHT.gut}>Stimmung {e.mood}</Chip>}
                {typeof e.energy === 'number' && <Chip farbe={LEUCHT.gut}>Energie {e.energy}</Chip>}
                {typeof e.stress === 'number' && <Chip farbe={LEUCHT.kritisch}>Stress {e.stress}</Chip>}
                {(e.flags ?? []).map(f => <Chip key={f} farbe={C.inkDim}>{FLAGS.find(x => x.id === f)?.label ?? f}</Chip>)}
                {e.haut === 'schub' && <Chip farbe={LEUCHT.kritisch}>Haut-Schub</Chip>}
                {e.ruecken === 'schmerz' && <Chip farbe={LEUCHT.kritisch}>Rücken-Schmerz</Chip>}
              </div>
              {e.text && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{e.text}</div>}
              {(e.gut || e.dankbar || e.hart || e.tagesnote) && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 6, lineHeight: 1.5, display: 'grid', gap: 2 }}>{e.gut && <span>Gut: {e.gut}</span>}{e.dankbar && <span>Dankbar: {e.dankbar}</span>}{e.hart && <span>Hart zu mir: {e.hart}</span>}{e.tagesnote && <span>Tagesnotiz: {e.tagesnote}</span>}</div>}
            </div>
          ))}
        </Liste>
      </Karte>
      </Kachel>
      </Flaeche>
    </Seite>
  );
}

'use client';

// ─── MAKE OS — Gesundheit ───────────────────────────────────────────────────
// Neu gebaut am 23.09. nach Kevins Urteil („grausig") und dem Entwurf, den er
// freigegeben hat. Vorher: elf Seiten, jede Karte ein Kasten, Nullen als große
// Zahlen. Jetzt EINE Seite, vier Segmente:
//
//   Heute      drei Ringe, ein Satz, EINE Tagesliste (Routinen, Haut, Streak,
//              drei Fragen — so macht es Whoops Journal)
//   Verlauf    30 Tage, ein Diagramm je Kennzahl
//   Ernährung  die Woche (bestehende Ansicht, eingebettet)
//   Körper     Aufbau und Reha (eingebettet) + das Profil vom 29.07.
//
// Whoops Regeln, hier eingehalten: keine Rahmen — Weißraum und Haarlinien;
// eine Schrift; große Zahlen, kleine Labels in normaler Schrift; eine Farbe
// je Kennzahl; nie eine Null, wo kein Wert ist.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A } from '@/lib/make-one/design';
import { BESCHWERDEN, HEBEL, AUFBAU, HGOALS, ZUSAMMENHAENGE, CARE_NOTE } from '@/lib/make-one/health-data';
import { localDay } from '@/lib/zeit';
import { ErnaehrungView } from './ErnaehrungView';
import { EnergieView } from './EnergieView';

type Segment = 'heute' | 'verlauf' | 'ernaehrung' | 'koerper';
const SEGMENTE: { id: Segment; label: string }[] = [
  { id: 'heute', label: 'Heute' }, { id: 'verlauf', label: 'Verlauf' }, { id: 'ernaehrung', label: 'Ernährung' }, { id: 'koerper', label: 'Körper' },
];

interface Vitals { rec: number; sleep: number; hrv: number; rhr: number; stand: string; heute: boolean; alterTage: number; fallback: boolean }
interface Stand {
  person: string; ich: string; heute: string; vitals: Vitals;
  haut: { trend: { tage: number; heute?: number; juckreiz7?: number; schuebe30: number; richtung: 'besser' | 'schlechter' | 'gleich' | 'unbekannt'; ausloeser: { was: string; mal: number }[] }; tage: { d: string; e: { juckreiz: number; schub: boolean } | null }[] };
  streak: { sauberTage: number; letzterRueckfall?: string; aktuell: boolean; craving7?: number; eintraege30: number };
  routinen: { liste: { id: string; label: string; wann: string; heute: boolean }[]; tage: { d: string; n: number }[] };
  journal: { tage7: number; heute: { gut?: string; dankbar?: string; hart?: string; stress?: number } | null };
  telegram: { konfiguriert: boolean; gekoppelt: boolean };
}

// ── Bausteine ────────────────────────────────────────────────────────────────

const zone = (r?: number) => (r == null ? C.inkLeise : r >= 66 ? C.gut : r >= 40 ? C.achtung : C.kritisch);

function Ring({ wert, einheit, label, farbe, anteil }: { wert?: string; einheit?: string; label: string; farbe: string; anteil?: number }) {
  const r = 52, u = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0' }}>
      <svg viewBox="0 0 120 120" style={{ width: 'clamp(96px, 14vw, 124px)', height: 'auto' }} aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke={C.linie} strokeWidth="8" />
        {anteil != null && <circle cx="60" cy="60" r={r} fill="none" stroke={farbe} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={u.toFixed(1)} strokeDashoffset={(u * (1 - Math.max(0, Math.min(1, anteil)))).toFixed(1)} transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)' }} />}
      </svg>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(30px, 4vw, 38px)', letterSpacing: '-.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: wert == null ? C.inkLeise : C.ink }}>
        {wert ?? '—'}{wert != null && einheit && <span style={{ fontSize: 15, fontWeight: 600, color: C.inkDim, marginLeft: 2 }}>{einheit}</span>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{label}</div>
    </div>
  );
}

function Schalter({ an, onChange, aus }: { an: boolean; onChange?: () => void; aus?: boolean }) {
  return (
    <button role="switch" aria-checked={an} onClick={onChange} disabled={aus} style={{
      width: 40, height: 24, borderRadius: 12, border: 'none', padding: 0, position: 'relative', flex: '0 0 auto',
      background: an ? C.aktiv : C.linie, cursor: aus ? 'default' : 'pointer', transition: 'background .18s ease',
    }}>
      <span style={{ position: 'absolute', top: 3, left: an ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: an ? C.grund : C.inkDim, transition: 'left .18s cubic-bezier(.22,1,.36,1)' }} />
    </button>
  );
}

function Zeile({ wann, titel, unter, kinder }: { wann?: string; titel: string; unter?: string; kinder: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 2px', borderBottom: `1px solid ${C.linie}`, minHeight: 48 }}>
      {wann && <span style={{ fontSize: 11, color: C.inkLeise, width: 56, letterSpacing: '.04em', textTransform: 'uppercase', flex: '0 0 auto' }}>{wann}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: TYP.body }}>{titel}</div>
        {unter && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 1 }}>{unter}</div>}
      </div>
      {kinder}
    </div>
  );
}

function Ueberschrift({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 12, fontWeight: 600, color: C.inkLeise, letterSpacing: '.04em', textTransform: 'uppercase', margin: '30px 0 6px' }}>{children}</h2>;
}

/** Ein Diagramm für den Verlauf: 30 Balken, kein Rahmen, ein Wert hervorgehoben. */
function Balken({ titel, werte, max, farbe, einheit, besserIst }: { titel: string; werte: (number | null)[]; max: number; farbe: string; einheit?: string; besserIst?: 'hoch' | 'tief' }) {
  const echte = werte.filter((x): x is number => x != null);
  const mittel = echte.length ? Math.round((echte.reduce((a, b) => a + b, 0) / echte.length) * 10) / 10 : null;
  const letzter = [...werte].reverse().find(x => x != null) ?? null;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: TYP.body, fontWeight: 500 }}>{titel}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, color: letzter == null ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }}>{letzter ?? '—'}{letzter != null && einheit}</span>
        <span style={{ fontSize: 12, color: C.inkLeise }}>{mittel != null ? `Ø ${mittel}${einheit ?? ''} · ${echte.length} von 30 Tagen` : 'noch keine Werte'}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56 }}>
        {werte.map((w, i) => (
          <span key={i} style={{ flex: 1, height: w == null ? 3 : Math.max(3, (w / max) * 56), borderRadius: 2, background: w == null ? C.linie : farbe, opacity: w == null ? 1 : 0.55 + 0.45 * (i / 29) }} />
        ))}
      </div>
      {besserIst && <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 4 }}>{besserIst === 'tief' ? 'niedriger ist besser' : 'höher ist besser'}</div>}
    </div>
  );
}

// ── Die Seite ────────────────────────────────────────────────────────────────

export function GesundheitView() {
  const router = useRouter();
  const pfad = usePathname();
  const params = useSearchParams();
  const segment = (SEGMENTE.find(s => s.id === params.get('s'))?.id ?? 'heute') as Segment;
  const heute = localDay();

  const [ansicht, setAnsicht] = useState('');
  const [personen, setPersonen] = useState<{ speicher: string; name: string }[]>([]);
  const [stand, setStand] = useState<Stand | null>(null);
  const [hl, setHl] = useState<Record<string, string[]>>({});
  const [juckreiz, setJuckreiz] = useState<number | null>(null);
  const [fragen, setFragen] = useState({ gut: '', dankbar: '', hart: '' });
  const [verlauf, setVerlauf] = useState<{ vitals: Record<string, { rec?: number; sleep?: number }>; haut: Record<string, { juckreiz: number }> } | null>(null);
  const eigene = !stand || stand.ich === ansicht;
  const q = ansicht ? `?fuer=${ansicht}` : '';
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const laden = () => fetch(`/api/gesundheit/stand${q}`).then(r => r.json()).then((d: Stand & { error?: string }) => {
    if (d.error) return;
    setStand(d);
    if (!ansicht && d.ich) setAnsicht(d.ich);
    setJuckreiz(d.haut.trend.heute ?? null);
    setFragen({ gut: d.journal.heute?.gut ?? '', dankbar: d.journal.heute?.dankbar ?? '', hart: d.journal.heute?.hart ?? '' });
  }).catch(() => {});

  useEffect(() => {
    fetch('/api/konto/ich').then(r => r.json()).then(d => {
      if (!d.ich) return;
      const teilen = (d.andere ?? []).filter((a: { teiltGesundheitMitMir: boolean }) => a.teiltGesundheitMitMir);
      setPersonen([{ speicher: d.ich.speicher, name: d.ich.name }, ...teilen]);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    void laden();
    fetch(`/api/state/health${q}`).then(r => r.json()).then(d => setHl(d.log ?? {})).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht]);
  useEffect(() => {
    if (segment !== 'verlauf' || verlauf) return;
    Promise.all([fetch(`/api/state/vitals${q}`).then(r => r.json()), fetch(`/api/state/haut${q}`).then(r => r.json())])
      .then(([v, h]) => setVerlauf({ vitals: v.log ?? {}, haut: h.log ?? {} })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, ansicht]);

  const geheZu = (s: Segment) => router.replace(s === 'heute' ? pfad : `${pfad}?s=${s}`);

  // ── Schreiben (nur auf der eigenen Seite) ──
  const hake = (id: string) => {
    if (!eigene) return;
    const tag = new Set(hl[heute] ?? []);
    tag.has(id) ? tag.delete(id) : tag.add(id);
    const next = { ...hl, [heute]: Array.from(tag) };
    setHl(next);
    fetch('/api/state/health', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  };
  const hautSetzen = (j: number) => {
    setJuckreiz(j);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch('/api/state/haut', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eintrag: { juckreiz: j } }) }).then(() => laden()).catch(() => {});
    }, 500);
  };
  const streakSetzen = (sauber: boolean) => {
    fetch('/api/state/streak', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eintrag: { sauber } }) }).then(() => laden()).catch(() => {});
  };
  const frageSpeichern = (feld: 'gut' | 'dankbar' | 'hart') => {
    const wert = fragen[feld].trim();
    if (!wert || wert === (stand?.journal.heute?.[feld] ?? '')) return;
    fetch('/api/state/journal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: heute, eintrag: { [feld]: wert } }) }).catch(() => {});
  };

  // ── Ableitungen ──
  const v = stand?.vitals;
  const frisch = !!v && (v.heute || (v.alterTage <= 1 && !v.fallback));
  const rec = frisch ? v!.rec : undefined;
  const schlaf = frisch && v!.sleep > 0 ? v!.sleep : undefined;
  const anspannung = stand?.journal.heute?.stress;
  const satz = useMemo(() => {
    if (!stand) return '';
    if (rec == null) return 'Noch keine Werte von heute.';
    const lage = rec >= 66 ? 'Grün — heute darf es Druck sein.' : rec >= 40 ? 'Gelb — fokussiert, mit Puffer.' : 'Rot — heute nur das Nötige.';
    return `${lage}${v?.heute ? '' : ` Werte von gestern (${v?.stand.slice(5)}).`}`;
  }, [stand, rec, v]);
  const heuteDrin = new Set(hl[heute] ?? []);
  const sieben = (stand?.routinen.tage ?? []).slice(0, 7).reverse();
  const anzahl = stand?.routinen.liste.length ?? 1;

  const tage30 = useMemo(() => Array.from({ length: 30 }, (_, i) => { const d = new Date(`${heute}T12:00:00`); d.setDate(d.getDate() - (29 - i)); return localDay(d); }), [heute]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '34px clamp(20px,4vw,56px) 60px', color: C.ink, fontFamily: SCHRIFT.text }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
        <h1 style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 22, letterSpacing: '-.02em', margin: 0 }}>
          Gesundheit{personen.length > 1 && !eigene && <span style={{ color: C.inkLeise, fontWeight: 500 }}> · {personen.find(p => p.speicher === ansicht)?.name.split(' ')[0]}</span>}
        </h1>
        <div style={{ display: 'flex', gap: 2, background: C.flaeche, borderRadius: 10, padding: 3 }}>
          {SEGMENTE.map(s => (
            <button key={s.id} onClick={() => geheZu(s.id)} style={{ padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, background: segment === s.id ? C.grund : 'transparent', color: segment === s.id ? C.ink : C.inkDim }}>{s.label}</button>
          ))}
        </div>
      </div>

      {personen.length > 1 && (
        <div style={{ display: 'flex', gap: 14, marginTop: -14, marginBottom: 22, fontSize: TYP.bedien }}>
          {personen.map(p => <button key={p.speicher} onClick={() => { setAnsicht(p.speicher); setStand(null); setVerlauf(null); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: ansicht === p.speicher ? C.ink : C.inkLeise, borderBottom: `1px solid ${ansicht === p.speicher ? C.ink : 'transparent'}` }}>{p.name.split(' ')[0]}</button>)}
        </div>
      )}

      {segment === 'heute' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(8px,2vw,20px)', margin: '8px 0 10px' }}>
            <Ring label="Recovery" wert={rec != null ? String(rec) : undefined} einheit="%" farbe={zone(rec)} anteil={rec != null ? rec / 100 : undefined} />
            <Ring label="Schlaf" wert={schlaf != null ? String(schlaf).replace('.', ',') : undefined} einheit="h" farbe={C.lavendel} anteil={schlaf != null ? schlaf / 8 : undefined} />
            <Ring label="Anspannung" wert={anspannung != null ? String(anspannung) : undefined} einheit="/5" farbe={anspannung != null && anspannung >= 4 ? C.kritisch : anspannung != null && anspannung >= 3 ? C.achtung : C.aktiv} anteil={anspannung != null ? anspannung / 5 : undefined} />
          </div>
          <p style={{ textAlign: 'center', color: C.inkDim, fontSize: TYP.body, margin: '0 0 30px' }}>
            {satz ? <><b style={{ color: C.ink, fontWeight: 600 }}>{satz.split('.')[0]}.</b> {satz.split('.').slice(1).join('.').trim()}</> : null}
            {stand && rec == null && <> <Link href="/os/verbindungen" style={{ color: C.aktiv, textDecoration: 'none' }}>Whoop verbinden</Link> oder morgens dem Boten sagen.</>}
            {stand && anspannung == null && rec != null && <> Anspannung fragt der Bote mittags.</>}
          </p>

          <Ueberschrift>Heute</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {(stand?.routinen.liste ?? []).map(r => (
              <Zeile key={r.id} wann={r.wann === 'abend' ? 'Abend' : r.id === 'essen' ? 'Mittag' : 'Morgen'} titel={r.label}
                unter={r.id === 'essen' ? 'dein Hebel gegen die Schübe' : undefined}
                kinder={<Schalter an={heuteDrin.has(r.id)} onChange={() => hake(r.id)} aus={!eigene} />} />
            ))}
            <Zeile wann="Abend" titel="Haut · Juckreiz"
              unter={stand?.haut.trend.juckreiz7 != null ? `Ø ${stand.haut.trend.juckreiz7} diese Woche${stand.haut.trend.richtung === 'besser' ? ', besser als die Woche davor' : stand.haut.trend.richtung === 'schlechter' ? ', schlechter als die Woche davor' : ''}` : 'noch kein Eintrag'}
              kinder={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 clamp(140px, 24vw, 200px)' }}>
                  <input type="range" min={0} max={10} value={juckreiz ?? 0} disabled={!eigene} onChange={e => hautSetzen(Number(e.target.value))} aria-label="Juckreiz 0 bis 10"
                    style={{ flex: 1, accentColor: juckreiz == null ? C.inkLeise : juckreiz >= 7 ? C.kritisch : juckreiz >= 4 ? C.achtung : C.aktiv }} />
                  <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 15, width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: juckreiz == null ? C.inkLeise : C.ink }}>{juckreiz ?? '—'}</span>
                </div>
              } />
            {(ansicht === 'kevin' || (stand?.streak.eintraege30 ?? 0) > 0) && (
              <Zeile wann="Abend" titel="Sauber geblieben"
                unter={stand?.streak.aktuell ? `Tag ${stand.streak.sauberTage} seit dem letzten Rückfall` : stand?.streak.eintraege30 ? 'seit über drei Tagen kein Eintrag' : 'noch nicht angefangen'}
                kinder={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {eigene && <button onClick={() => streakSetzen(false)} style={{ background: 'none', border: 'none', color: C.inkLeise, fontSize: 12, cursor: 'pointer', fontFamily: SCHRIFT.text, padding: 0 }}>Rückfall</button>}
                  <Schalter an={!!stand?.streak.aktuell && (stand.haut.tage[0]?.d === heute ? true : stand.streak.aktuell)} onChange={() => streakSetzen(true)} aus={!eigene} />
                </div>} />
            )}
          </div>

          {eigene && (
            <>
              <Ueberschrift>Drei Fragen</Ueberschrift>
              {([['gut', 'Was lief heute gut?'], ['dankbar', 'Wofür bist du dankbar?'], ['hart', 'Wo warst du hart zu dir?']] as const).map(([k, frage]) => (
                <input key={k} value={fragen[k]} onChange={e => setFragen(f => ({ ...f, [k]: e.target.value }))} onBlur={() => frageSpeichern(k)} placeholder={frage}
                  style={{ width: '100%', background: 'transparent', border: 0, borderBottom: `1px solid ${C.linie}`, padding: '11px 2px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, outline: 'none' }} />
              ))}
            </>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 18, color: C.inkLeise, fontSize: 12 }}>
            7 Tage {sieben.map(t => <span key={t.d} title={`${t.d.slice(5)} · ${t.n}/${anzahl}`} style={{ width: 22, height: 6, borderRadius: 3, background: t.n >= anzahl * 0.6 ? C.aktiv : t.n > 0 ? `${C.aktiv}66` : C.linie }} />)}
          </div>

          <div style={{ marginTop: 34, paddingTop: 16, borderTop: `1px solid ${C.linie}`, color: C.inkLeise, fontSize: TYP.bedien, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span>Bote: {!stand ? '…' : !stand.telegram.konfiguriert ? <Link href="/os/konto" style={{ color: C.inkDim }}>Telegram einrichten</Link> : stand.telegram.gekoppelt ? 'Telegram gekoppelt' : <Link href="/os/konto" style={{ color: C.inkDim }}>Telegram koppeln</Link>}</span>
            <span>{v?.heute ? 'Whoop heute' : <Link href="/os/verbindungen" style={{ color: C.inkDim }}>Whoop verbinden</Link>}</span>
          </div>
        </>
      )}

      {segment === 'verlauf' && (
        <div style={{ marginTop: 8 }}>
          {!verlauf ? <div style={{ color: C.inkLeise, fontSize: TYP.bedien }}>lade …</div> : (
            <>
              <Balken titel="Recovery" einheit="%" max={100} farbe={C.gut} besserIst="hoch" werte={tage30.map(d => verlauf.vitals[d]?.rec ?? null)} />
              <Balken titel="Schlaf" einheit=" h" max={9} farbe={C.lavendel} besserIst="hoch" werte={tage30.map(d => verlauf.vitals[d]?.sleep ?? null)} />
              <Balken titel="Juckreiz" max={10} farbe={C.achtung} besserIst="tief" werte={tage30.map(d => verlauf.haut[d]?.juckreiz ?? null)} />
              <Balken titel="Routinen" max={anzahl} farbe={C.aktiv} besserIst="hoch" werte={tage30.map(d => (hl[d]?.length ?? 0) || null)} />
              {stand?.haut.trend.ausloeser.length ? (
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>Auslöser in 30 Tagen: {stand.haut.trend.ausloeser.map(a => `${a.was} (${a.mal}×)`).join(' · ')}</div>
              ) : null}
            </>
          )}
        </div>
      )}

      {segment === 'ernaehrung' && <ErnaehrungView eingebettet />}

      {segment === 'koerper' && (
        <>
          <EnergieView eingebettet />
          <Ueberschrift>Profil · Stand 29.07.</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {AUFBAU.map(s => <Zeile key={s.phase} wann={s.state === 'now' ? 'Jetzt' : s.state === 'next' ? 'Danach' : 'Später'} titel={`${s.phase} · ${s.name}`} unter={s.desc} kinder={<span />} />)}
          </div>
          <Ueberschrift>Was Aufmerksamkeit braucht</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {BESCHWERDEN.map(b => <Zeile key={b.name} titel={b.name} unter={b.note} kinder={<span style={{ fontSize: 12, color: b.tone === 'crit' ? C.kritisch : b.tone === 'watch' ? C.achtung : C.gut, whiteSpace: 'nowrap' }}>{b.status}</span>} />)}
          </div>
          <Ueberschrift>Hebel</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {HEBEL.map(h => <Zeile key={h.name} titel={h.name} unter={h.note} kinder={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 15, color: h.tone === 'crit' ? C.kritisch : h.tone === 'watch' ? C.achtung : C.gut }}>{h.score}</span>} />)}
          </div>
          <Ueberschrift>Ziele</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {HGOALS.map(g => <Zeile key={g.title} titel={g.title} unter={g.why} kinder={<span style={{ fontSize: 12, color: C.inkLeise }}>{g.progress} %</span>} />)}
          </div>
          <Ueberschrift>Zusammenhänge</Ueberschrift>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {ZUSAMMENHAENGE.map(z => <Zeile key={z} titel={z} kinder={<span />} />)}
          </div>
          <p style={{ fontSize: 12, color: C.inkLeise, marginTop: A.xl, lineHeight: 1.5 }}>{CARE_NOTE}</p>
        </>
      )}
    </div>
  );
}

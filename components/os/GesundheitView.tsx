'use client';

// ─── MAKE OS — Gesundheit ───────────────────────────────────────────────────
// Neu gebaut am 23.09. nach Kevins Urteil („grausig") und dem Entwurf, den er
// freigegeben hat. Vorher: elf Seiten, jede Karte ein Kasten, Nullen als große
// Zahlen. Jetzt EINE Seite, vier Segmente:
//
//   Heute      drei Ringe, ein Satz, EINE Tagesliste (Routinen, die eingeschalteten Module — Symptom-Tagebuch,
//              Zähler —, drei Fragen — so macht es Whoops Journal)
//   Verlauf    30 Tage, ein Diagramm je Kennzahl
//   Ernährung  die Woche (bestehende Ansicht, eingebettet)
//   Körper     Energie, Gesundheits-Meilensteine, die eigenen Module (09.10.) und das EIGENE Körper-Profil (Daten je
//              Person, seit 08.10. abends — nur die Person selbst; in der Ansicht einer anderen Person gibt es den Reiter nicht)
//
// Whoops Regeln, hier eingehalten: keine Rahmen — Weißraum und Haarlinien;
// eine Schrift; große Zahlen, kleine Labels in normaler Schrift; eine Farbe
// je Kennzahl; nie eine Null, wo kein Wert ist.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { WhoopImport } from './WhoopImport';
import { WhoopKarte } from './gesundheit/WhoopKarte';
import { UnterlagenKarte } from './gesundheit/Unterlagen';
import { Seite, Karte, Ueberschrift, Ring, Segmente, Chip, Fortschritt, Balken as Trend, Leer, Hinweis, Schalter, ZielBezug, feld, LEUCHT, FlussKarte } from './ui';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { useKoerper, KoerperLeer, ProfilKarte, BeschwerdenKarte, HebelKarte, ZusammenhaengeKarte, AnzeigeKarte, ModuleKarte } from './gesundheit/Koerper';
import { routinenHinweis } from '@/lib/gesundheit/koerper';
import { symptomAnzeige, MODUL_INFO, type ModulStand } from '@/lib/gesundheit/module';

import { localDay } from '@/lib/zeit';
import { ErnaehrungView } from './ErnaehrungView';
import { EnergieView } from './EnergieView';
import { GesundheitIndex, GesundheitIndexKurz } from './gesundheit/GesundheitIndex';
import { SportKurz } from './sport/SportKurz';
import { EinwilligungHinweis } from './gesundheit/EinwilligungHinweis';
import { useZuZiel } from './ziel';
import { WEG } from '@/lib/wege';

type Segment = 'heute' | 'index' | 'verlauf' | 'ernaehrung' | 'koerper';
const SEGMENTE: { id: Segment; label: string }[] = [
  { id: 'heute', label: 'Heute' }, { id: 'index', label: 'Index' }, { id: 'verlauf', label: 'Verlauf' }, { id: 'ernaehrung', label: 'Ernährung' }, { id: 'koerper', label: 'Körper' },
];

interface Vitals { rec: number; sleep: number; hrv: number; rhr: number; stand: string; heute: boolean; alterTage: number; fallback: boolean }
interface Stand {
  person: string; ich: string; heute: string; vitals: Vitals;
  /** Wirksame Module der angezeigten Person (Server) — ein ausgeschaltetes kommt leer an. */
  module?: ModulStand;
  haut: { trend: { tage: number; heute?: number; juckreiz7?: number; schuebe30: number; richtung: 'besser' | 'schlechter' | 'gleich' | 'unbekannt'; ausloeser: { was: string; mal: number }[] }; tage: { d: string; e: { juckreiz: number; schub: boolean } | null }[] };
  streak: { sauberTage: number; letzterRueckfall?: string; aktuell: boolean; craving7?: number; eintraege30: number };
  routinen: { liste: { id: string; label: string; wann: string; heute: boolean }[]; quote7?: number; tage: { d: string; n: number }[] };
  journal: { tage7: number; heute: { gut?: string; dankbar?: string; hart?: string; stress?: number } | null };
  telegram: { konfiguriert: boolean; gekoppelt: boolean };
}

// ── Bausteine ────────────────────────────────────────────────────────────────

const zone = (r?: number) => (r == null ? C.inkLeise : r >= 66 ? LEUCHT.gut : r >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

function Zeile({ wann, titel, unter, kinder }: { wann?: string; titel: React.ReactNode; unter?: React.ReactNode; kinder: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 2px', borderBottom: `1px solid ${C.linie}`, minHeight: 48 }}>
      {wann && <span style={{ fontSize: 11, color: C.inkLeise, width: 56, letterSpacing: '.04em', textTransform: 'uppercase', flex: '0 0 auto' }}>{wann}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: TYP.body }}>{titel}</div>
        {unter && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 1 }}>{unter}</div>}
      </div>
      {kinder}
    </div>
  );
}

// Deutsche Zahl: 8,5 statt 8.5
const de = (n: number) => String(n).replace('.', ',');

function Balken({ titel, werte, max, farbe, farbeJe, einheit, besserIst, tage }: { titel: string; werte: (number | null)[]; max: number; farbe: string; farbeJe?: (w: number) => string; einheit?: string; besserIst?: 'hoch' | 'tief'; tage?: string[] }) {
  const echte = werte.filter((x): x is number => x != null);
  const mittel = echte.length ? Math.round((echte.reduce((a, b) => a + b, 0) / echte.length) * 10) / 10 : null;
  const letzter = [...werte].reverse().find(x => x != null) ?? null;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: TYP.body, fontWeight: 500 }}>{titel}</span>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, color: letzter == null ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }}>{letzter != null ? de(letzter) : '—'}{letzter != null && einheit}</span>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{mittel != null ? `Ø ${de(mittel)}${einheit ?? ''} · ${echte.length} von 30 Tagen` : 'noch keine Werte'}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56 }}>
        {werte.map((w, i) => (
          <span key={i} title={tage?.[i] ? `${tage[i].slice(8, 10)}.${tage[i].slice(5, 7)}. · ${w == null ? 'kein Wert' : `${de(w)}${einheit ?? ''}`}` : undefined}
            style={{ flex: 1, height: w == null ? 3 : Math.max(3, (Math.min(w, max) / max) * 56), borderRadius: 2, background: w == null ? C.linie : farbeJe ? farbeJe(w) : farbe, opacity: w == null ? 1 : 0.55 + 0.45 * (i / 29) }} />
        ))}
      </div>
      {besserIst && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>{besserIst === 'tief' ? 'niedriger ist besser' : 'höher ist besser'}</div>}
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

  // ?fuer=<person> zeigt die andere Person (wenn sie teilt) — z. B. aus einem Index-Link (26.09.).
  const [ansicht, setAnsicht] = useState(() => { const f = params.get('fuer'); return f && /^[a-z0-9-]{1,40}$/.test(f) ? f : ''; });
  const [personen, setPersonen] = useState<{ speicher: string; name: string }[]>([]);
  const [stand, setStand] = useState<Stand | null>(null);
  const [hl, setHl] = useState<Record<string, string[]>>({});
  const [juckreiz, setJuckreiz] = useState<number | null>(null);
  const [fragen, setFragen] = useState({ gut: '', dankbar: '', hart: '' });
  const [verlauf, setVerlauf] = useState<{ vitals: Record<string, { rec?: number; sleep?: number; hrv?: number; rhr?: number }>; haut: Record<string, { juckreiz: number }> } | null>(null);
  // Körper-Reiter (26.09.): die Hebel kommen live aus dem Gesundheits-Index, nicht mehr aus Konstanten vom 29.07.
  const [hebel, setHebel] = useState<{ id: string; label: string; anzeige: string | null; ampel: string; gemessen: boolean }[] | null>(null);
  const [etappen, setEtappen] = useState<{ id: string; titel: string; faellig?: string; fortschritt: number; erledigt: boolean; bereich: string }[]>([]);
  const eigene = !stand || stand.ich === ansicht;
  // Körper-Profil (08.10. abends, Kevin: „Körper-Reiter sieht nur die Person selbst“): nur die EIGENE Ansicht, sicher erst mit
  // geladenem Stand. Die Route liefert ohnehin nur das eigene Profil — die Oberfläche zeigt es nie unter fremdem Namen.
  const eigeneSicher = !!stand && stand.ich === ansicht;
  const koerper = useKoerper(eigeneSicher);
  const segmente = !stand || eigeneSicher ? SEGMENTE : SEGMENTE.filter(s => s.id !== 'koerper');
  // Module (09.10., lib/gesundheit/module.ts): Symptom-Regler und Zähler „Sauber geblieben“ nur, wenn die angezeigte Person das
  // Modul führt (`stand.module` — der Server liefert ein ausgeschaltetes leer). Eigene Ansicht mit dem eigenen Namen des
  // Reglers; geteilte Ansicht nur mit Einträgen und neutral benannt (die Einstellungen der anderen Person bleiben bei ihr).
  const modulAn = stand?.module;
  const symptomName = !modulAn?.haut ? null : eigeneSicher ? symptomAnzeige(koerper.koerper, true) : stand?.haut.tage.some(t => t.e) ? MODUL_INFO.haut.name : null;
  // Verlauf (nur lesen, 30 Tage): mit eingeschaltetem Modul, sobald es Einträge gibt — vorhandene Daten verschwinden nie,
  // nur weil (noch) kein eigener Name eingestellt ist; in der eigenen Ansicht mit dem eigenen Namen, sonst neutral.
  const verlaufEintraege = !!verlauf && Object.values(verlauf.haut).some(e => e?.juckreiz != null);
  const verlaufSymptom = !modulAn?.haut ? null : (eigeneSicher ? symptomName : null) ?? (verlaufEintraege ? MODUL_INFO.haut.name : null);
  const sauberZeigen = !!modulAn?.serie && (eigeneSicher || (stand?.streak.eintraege30 ?? 0) > 0);
  const q = ansicht ? `?fuer=${ansicht}` : '';
  // #morgen · #routinen · #haut · #streak aus einem Link: hinspringen, sobald der Stand da ist.
  useZuZiel(null, !!stand);
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
    if (segment !== 'koerper' || !eigeneSicher) return;
    fetch(`/api/gesundheit/index${q}`, { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.ok) setHebel((d.pi.saeulen as { kennzahlen: { id: string; label: string; anzeige: string | null; ampel: string; gemessen: boolean }[] }[]).flatMap(s => s.kennzahlen)); }).catch(() => {});
    fetch('/api/state/meilensteine').then(r => r.json()).then(d => setEtappen((d.meilensteine ?? []).filter((m: { bereich: string }) => m.bereich === 'gesundheit'))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, ansicht, eigeneSicher]);
  useEffect(() => {
    if (segment !== 'verlauf' || verlauf) return;
    Promise.all([fetch(`/api/state/vitals${q}`).then(r => r.json()), fetch(`/api/state/haut${q}`).then(r => r.json())])
      .then(([v, h]) => setVerlauf({ vitals: v.log ?? {}, haut: h.log ?? {} })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, ansicht]);

  // Segment wechseln ist ein Ortswechsel — Zurück führt zum vorigen Segment (25.09.).
  const geheZu = (s: Segment) => router.push(s === 'heute' ? pfad : `${pfad}?s=${s}`, { scroll: false });

  // ── Schreiben (nur auf der eigenen Seite) ──
  const hake = (id: string) => {
    if (!eigene) return;
    const tag = new Set(hl[heute] ?? []);
    if (tag.has(id)) tag.delete(id); else tag.add(id);
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
  // Anspannung 1–5 direkt hier — vorher nur über den Boten (26.09.).
  const anspannungSetzen = (n: number) => {
    if (!eigene) return;
    setStand(s => (s ? { ...s, journal: { ...s.journal, heute: { ...(s.journal.heute ?? {}), stress: n } } } : s));
    fetch('/api/state/journal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: heute, eintrag: { stress: n } }) }).catch(() => {});
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
    <Seite titel={<>Gesundheit{personen.length > 1 && !eigene && <span style={{ color: C.inkLeise, fontWeight: 500 }}> · {personen.find(p => p.speicher === ansicht)?.name.split(' ')[0]}</span>}</>}
      unter={personen.length > 1 ? (
        <div style={{ display: 'flex', gap: 14, fontSize: TYP.bedien }}>
          {personen.map(p => <button key={p.speicher} onClick={() => { setAnsicht(p.speicher); setStand(null); setVerlauf(null); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: ansicht === p.speicher ? C.ink : C.inkLeise, borderBottom: `1px solid ${ansicht === p.speicher ? C.ink : 'transparent'}` }}>{p.name.split(' ')[0]}</button>)}
        </div>
      ) : undefined}
      >
      {/* Die Umschalter stehen im Inhalt als EINE wischbare Leiste (Standard, Regel 11) — nicht im Kopf. */}
      {eigene && <EinwilligungHinweis />}
      <Segmente liste={segmente} aktiv={segment} onWahl={geheZu} />
      <ZielBezug bereich="gesundheit" />

      {segment === 'heute' && (
        <>
          <Flaeche seite="gesundheit-heute">
          {/* Überblick „Für dich“ (04.10. abends): Ist der letzten 3 Monate → heute → Prognose aus echten Daten; serverseitig gefiltert (FlussKarte, /api/fluss). */}
          {eigene && <Kachel id="fluss" titel="Für dich" breite={6}><FlussKarte bereich="gesundheit" farbe={LEUCHT.gut} /></Kachel>}
          <Kachel id="index-kurz" titel="Gesundheits-Index" breite={3}><GesundheitIndexKurz fuer={!eigene ? ansicht : undefined} onOeffnen={() => geheZu('index')} stand={hl} /></Kachel>
          <Kachel id="morgen" titel="Morgen-Check" breite={3}>
          <Karte i={0} ton={rec != null ? zone(rec) : undefined} id="morgen" style={{ scrollMarginTop: 90 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(8px,2vw,20px)', margin: '4px 0 8px' }}>
              <button type="button" onClick={() => geheZu('verlauf')} className="fassbar" title="Verlauf 30 Tage" style={{ all: 'unset', cursor: 'pointer' }}><Ring label="Recovery" wert={rec != null ? String(rec) : undefined} einheit="%" farbe={zone(rec)} anteil={rec != null ? rec / 100 : undefined}
                unter={rec != null ? <Chip farbe={zone(rec)}>{rec >= 66 ? 'Grün' : rec >= 40 ? 'Gelb' : 'Rot'}</Chip> : undefined} /></button>
              <button type="button" onClick={() => geheZu('verlauf')} className="fassbar" title="Verlauf 30 Tage" style={{ all: 'unset', cursor: 'pointer' }}><Ring label="Schlaf" wert={schlaf != null ? String(schlaf).replace('.', ',') : undefined} einheit="h" farbe={LEUCHT.schlaf} anteil={schlaf != null ? schlaf / 8 : undefined} /></button>
              <Ring label="Anspannung" wert={anspannung != null ? String(anspannung) : undefined} einheit="/5" farbe={anspannung != null && anspannung >= 4 ? LEUCHT.kritisch : anspannung != null && anspannung >= 3 ? LEUCHT.achtung : LEUCHT.puls} anteil={anspannung != null ? anspannung / 5 : undefined} />
            </div>
            {eigene && (
              <div role="group" aria-label="Anspannung heute von 1 bis 5" style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, minmax(44px, 56px))', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, paddingRight: 6 }}>Anspannung</span>
                {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => anspannungSetzen(n)} aria-label={`Anspannung ${n}`} aria-pressed={anspannung === n} className="fassbar" style={{ height: 44, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, background: (anspannung ?? 0) >= n ? (n >= 4 ? LEUCHT.kritisch : n >= 3 ? LEUCHT.achtung : LEUCHT.puls) : 'rgba(255,255,255,.07)', color: (anspannung ?? 0) >= n ? C.grund : C.inkLeise }}>{n}</button>)}
              </div>
            )}
            <p style={{ textAlign: 'center', color: C.inkDim, fontSize: TYP.body, margin: '14px 0 0', lineHeight: 1.5 }}>
              {satz ? <><b style={{ color: C.ink, fontWeight: 600 }}>{satz.split('.')[0]}.</b> {satz.split('.').slice(1).join('.').trim()}</> : null}
              {stand && rec == null && eigene && <> WHOOP verbinden (Kachel „WHOOP“) oder den Morgen-Check ausfüllen.</>}
              {stand && anspannung == null && rec != null && eigene && <> Anspannung: oben 1–5 tippen.</>}
            </p>
            {stand && rec == null && eigene && <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}><WhoopImport kurz onFertig={() => { void laden(); setVerlauf(null); }} /></div>}
          </Karte>
          </Kachel>
          <Kachel id="sport" titel="Sport" breite={3}><SportKurz eigene={eigene} /></Kachel>
          {/* WHOOP je Person (08.10.): nur die EIGENE Verbindung — in der Ansicht einer anderen Person keine Karte. */}
          {eigene && <Kachel id="whoop" titel="WHOOP" breite={3}><WhoopKarte i={2} /></Kachel>}
          {/* 09.10.: eigene Unterlagen + Weg zum Auftrag an den Gesundheits-Agenten — nur in der EIGENEN Ansicht (Art. 9, nie für andere). */}
          {eigene && (
            <Kachel id="unterlagen" titel="Unterlagen & Gesundheits-Agent" breite={3}>
              <Karte>
                <div style={{ display: 'grid', gap: 12 }}>
                  <UnterlagenKarte />
                  <Link href={WEG.agenten({ h: 'gesundheit', r: 'auftrag' })} style={{ fontSize: TYP.bedien, color: C.inkDim }}>Deinen Auftrag an den Gesundheits-Agenten schreiben ›</Link>
                </div>
              </Karte>
            </Kachel>
          )}
          <Kachel id="sieben-tage" titel="Sieben Tage Routinen" breite={3}>
          <Karte i={3}>
            <Ueberschrift rechts={stand?.routinen.quote7 != null ? `Ø ${Math.round(stand.routinen.quote7 * 100)} %` : 'Ø — %'}>Sieben Tage Routinen</Ueberschrift>
            <Trend werte={sieben.map(t => t.n || null)} max={anzahl} farbe={LEUCHT.gut} hoehe={44} titel={sieben.map(t => `${t.d.slice(8)}.${t.d.slice(5, 7)}. · ${t.n}/${anzahl}`)} />
            <div style={{ marginTop: 16, color: C.inkLeise, fontSize: TYP.bedien, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span>Bote: {!stand ? '…' : !stand.telegram.konfiguriert ? <Link href="/os/konto" style={{ color: C.inkDim }}>Telegram einrichten</Link> : stand.telegram.gekoppelt ? 'Telegram gekoppelt' : <Link href="/os/konto" style={{ color: C.inkDim }}>Telegram koppeln</Link>}</span>
              <span>{v?.heute ? 'Whoop heute' : <Link href="/os/gesundheit#whoop" style={{ color: C.inkDim }}>Whoop verbinden</Link>}</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: TYP.bedien }}>
              <Link href="/os/ritual?modus=morgen" style={{ color: C.inkDim }}>Tagesstart ›</Link>
              <Link href={WEG.journal()} style={{ color: C.inkDim }}>Journal ›</Link>
              <Link href={WEG.routinen()} style={{ color: C.inkDim }}>Routinen planen ›</Link>
              <Link href={WEG.wachstum()} style={{ color: C.inkDim }}>Säule im Wachstums-Score ›</Link>
            </div>
          </Karte>
          </Kachel>
          {eigene && (
            <Kachel id="drei-fragen" titel="Drei Fragen" breite={3}>
            <Karte i={2} akzent={LEUCHT.schlaf}>
              <Ueberschrift farbe={LEUCHT.schlaf}>Drei Fragen</Ueberschrift>
              <div style={{ display: 'grid', gap: 8 }}>
                {([['gut', 'Was lief heute gut?'], ['dankbar', 'Wofür bist du dankbar?'], ['hart', 'Wo warst du hart zu dir?']] as const).map(([k, frage]) => (
                  <input key={k} value={fragen[k]} onChange={e => setFragen(f => ({ ...f, [k]: e.target.value }))} onBlur={() => frageSpeichern(k)} placeholder={frage} style={feld} />
                ))}
              </div>
            </Karte>
            </Kachel>
          )}
          <Kachel id="routinen" titel="Routinen heute" breite={3}>
          <Karte i={1} id="routinen" style={{ scrollMarginTop: 90 }}>
            <Ueberschrift farbe={LEUCHT.gut} rechts={<span>{heuteDrin.size} von {anzahl} · <Link href={WEG.routinen()} style={{ color: C.inkLeise, textDecoration: 'none' }}>planen ›</Link></span>}>Heute</Ueberschrift>
            <Fortschritt anteil={anzahl ? heuteDrin.size / anzahl : 0} farbe={LEUCHT.gut} />
            <div style={{ marginTop: 6 }}>
              {(stand?.routinen.liste ?? []).map(r => (
                <Zeile key={r.id} wann={r.wann === 'abend' ? 'Abend' : r.id === 'essen' ? 'Mittag' : 'Morgen'} titel={r.label}
                  unter={eigeneSicher ? routinenHinweis(koerper.koerper, r.id) : undefined}
                  kinder={<Schalter an={heuteDrin.has(r.id)} onChange={() => hake(r.id)} aus={!eigene} ariaLabel={`${r.label} heute erledigt`} />} />
              ))}
              {symptomName && (<>
              <div id="haut" style={{ scrollMarginTop: 90 }} />
              <Zeile wann="Abend" titel={symptomName}
                unter={stand?.haut.trend.juckreiz7 != null ? `Ø ${stand.haut.trend.juckreiz7} diese Woche${stand.haut.trend.richtung === 'besser' ? ', besser als die Woche davor' : stand.haut.trend.richtung === 'schlechter' ? ', schlechter als die Woche davor' : ''}` : 'noch kein Eintrag'}
                kinder={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 clamp(140px, 24vw, 200px)' }}>
                    <input type="range" min={0} max={10} value={juckreiz ?? 0} disabled={!eigene} onChange={e => hautSetzen(Number(e.target.value))} aria-label={`${symptomName} 0 bis 10`}
                      style={{ flex: 1, accentColor: juckreiz == null ? C.inkLeise : juckreiz >= 7 ? LEUCHT.kritisch : juckreiz >= 4 ? LEUCHT.achtung : LEUCHT.gut }} />
                    <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, width: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: juckreiz == null ? C.inkLeise : C.ink }}>{juckreiz ?? '—'}</span>
                  </div>
                } />
              </>)}
              <div id="streak" style={{ scrollMarginTop: 90 }} />
              {sauberZeigen && (
                <Zeile wann="Abend" titel="Sauber geblieben"
                  unter={stand?.streak.aktuell ? `Tag ${stand.streak.sauberTage} seit dem letzten Rückfall` : stand?.streak.eintraege30 ? 'seit über drei Tagen kein Eintrag' : 'noch nicht angefangen'}
                  kinder={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {eigene && <button onClick={() => streakSetzen(false)} style={{ background: 'none', border: 'none', color: C.inkLeise, fontSize: TYP.bedien, cursor: 'pointer', fontFamily: SCHRIFT.text, padding: 0 }}>Rückfall</button>}
                    <Schalter an={!!stand?.streak.aktuell && (stand.haut.tage[0]?.d === heute ? true : stand.streak.aktuell)} onChange={() => streakSetzen(true)} aus={!eigene} ariaLabel="Heute sauber geblieben" />
                  </div>} />
              )}
            </div>
          </Karte>
          </Kachel>
          </Flaeche>
        </>
      )}

      {segment === 'index' && <GesundheitIndex fuer={!eigene ? ansicht : undefined} ich={stand?.ich} stand={hl} />}

      {segment === 'verlauf' && (
        <Karte i={0}>
          <Ueberschrift>30 Tage</Ueberschrift>
          {!verlauf ? <Leer>Der Verlauf lädt …</Leer> : (
            <>
              {/* Recovery je Tag in seiner Zone — wie Whoop: grün ab 66, gelb ab 40, darunter rot */}
              <Balken titel="Recovery" einheit="%" max={100} farbe={LEUCHT.gut} farbeJe={zone} besserIst="hoch" tage={tage30} werte={tage30.map(d => verlauf.vitals[d]?.rec ?? null)} />
              <Balken titel="Schlaf" einheit=" h" max={9} farbe={LEUCHT.schlaf} besserIst="hoch" tage={tage30} werte={tage30.map(d => verlauf.vitals[d]?.sleep ?? null)} />
              <Balken titel="HRV" einheit=" ms" max={140} farbe={LEUCHT.puls} besserIst="hoch" tage={tage30} werte={tage30.map(d => verlauf.vitals[d]?.hrv ?? null)} />
              <Balken titel="Ruhepuls" einheit="" max={90} farbe={LEUCHT.beziehung} besserIst="tief" tage={tage30} werte={tage30.map(d => verlauf.vitals[d]?.rhr ?? null)} />
              {verlaufSymptom && <Balken titel={verlaufSymptom} max={10} farbe={LEUCHT.achtung} besserIst="tief" tage={tage30} werte={tage30.map(d => verlauf.haut[d]?.juckreiz ?? null)} />}
              <Balken titel="Routinen" max={anzahl} farbe={LEUCHT.gut} besserIst="hoch" tage={tage30} werte={tage30.map(d => (hl[d]?.length ?? 0) || null)} />
              {verlaufSymptom && stand?.haut.trend.ausloeser.length ? (
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>Auslöser in 30 Tagen: {stand.haut.trend.ausloeser.map(a => `${a.was} (${a.mal}×)`).join(' · ')}</div>
              ) : null}
            </>
          )}
        </Karte>
      )}

      {segment === 'ernaehrung' && <ErnaehrungView eingebettet />}

      {segment === 'koerper' && stand && !eigeneSicher && (
        <Leer>Das Körper-Profil sieht nur die Person selbst.</Leer>
      )}
      {segment === 'koerper' && eigeneSicher && (
        <>
          {koerper.fehler && <Hinweis art="kritisch">{koerper.fehler}</Hinweis>}
          {koerper.geladen && !koerper.koerper && <KoerperLeer aendern={koerper.aendern} />}
          <Flaeche seite="gesundheit-koerper">
          <Kachel id="energie" titel="Energie" breite={3}><EnergieView eingebettet /></Kachel>
          <Kachel id="module" titel="Module" breite={3}><ModuleKarte k={koerper.koerper} modulStand={koerper.module} aendern={koerper.aendern} nachher={() => { void laden(); setVerlauf(null); }} /></Kachel>
          <Kachel id="meilensteine" titel="Gesundheits-Meilensteine" breite={3}>
          <Karte i={4}>
            <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/planung/jahr" style={{ color: C.inkLeise, textDecoration: 'none' }}>pflegen ›</Link>}>Gesundheits-Meilensteine</Ueberschrift>
            {!etappen.length && <Leer>Noch kein Gesundheits-Meilenstein — <Link href="/os/planung/jahr" style={{ color: C.inkDim }}>in der Jahresplanung anlegen ›</Link></Leer>}
            {etappen.map(g => { const spaet = !!g.faellig && g.faellig < heute && !g.erledigt; return <Link key={g.id} href={`/os/planung/jahr?m=${encodeURIComponent(g.id)}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}><Zeile titel={<span style={{ textDecoration: g.erledigt ? 'line-through' : 'none', color: g.erledigt ? C.inkLeise : C.ink }}>{g.titel}</span>} unter={spaet ? `überfällig seit ${g.faellig!.slice(8)}.${g.faellig!.slice(5, 7)}. — zählt 0 im Index` : g.faellig ? `fällig ${g.faellig.slice(8)}.${g.faellig.slice(5, 7)}.` : undefined} kinder={<span style={{ fontSize: TYP.bedien, color: spaet ? LEUCHT.kritisch : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{g.fortschritt} %</span>} /><div style={{ margin: '-4px 0 10px' }}><Fortschritt anteil={g.fortschritt / 100} farbe={spaet ? LEUCHT.kritisch : LEUCHT.schlaf} /></div></Link>; })}
          </Karte>
          </Kachel>
          {koerper.koerper && <Kachel id="profil" titel="Profil" breite={3}><ProfilKarte k={koerper.koerper} aendern={koerper.aendern} zumVerlauf={() => geheZu('verlauf')} /></Kachel>}
          {koerper.koerper && <Kachel id="aufmerksamkeit" titel="Was Aufmerksamkeit braucht" breite={3}><BeschwerdenKarte k={koerper.koerper} aendern={koerper.aendern} /></Kachel>}
          {koerper.koerper && <Kachel id="hebel" titel="Hebel · live" breite={3}><HebelKarte k={koerper.koerper} aendern={koerper.aendern} kennzahlen={hebel} zumIndex={() => geheZu('index')} /></Kachel>}
          {koerper.koerper && <Kachel id="zusammenhaenge" titel="Zusammenhänge" breite={3}><ZusammenhaengeKarte k={koerper.koerper} aendern={koerper.aendern} /></Kachel>}
          {koerper.koerper && <Kachel id="anzeige" titel="Sätze unter Routinen" breite={3}><AnzeigeKarte k={koerper.koerper} aendern={koerper.aendern} routinen={(stand?.routinen.liste ?? []).map(r => ({ id: r.id, label: r.label }))} /></Kachel>}
          </Flaeche>
        </>
      )}
    </Seite>
  );
}

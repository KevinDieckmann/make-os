'use client';

// ─── MAKE OS — Kompass ──────────────────────────────────────────────────────
// Der Zustand, in dem das System läuft. Vier Ebenen: Lage → Regler → Wirkung
// → Reichweite. Siehe lib/make-one/kompass-data.ts für das Konzept.
//
// Der wichtigste Trick: Der Kompass schreibt in dieselben Speicher, die die
// übrige Software ohnehin liest (Fokus-Regler, Ordnung). Dadurch wirkt jede
// Änderung sofort überall — ohne dass eine einzige andere Seite davon weiß.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Chip/Knopf).

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { THEMEN, STANDARD_ORDNUNG, sortierteThemen, themenMit, themaVon } from '@/lib/make-one/ordnung-data';
import { ORGS } from '@/lib/make-one/organisation-data';
import { STICHWORTE, stichworteVon, mitEigenen } from '@/lib/make-one/stichworte-data';
import { FAECHER } from '@/lib/make-one/inbox-data';
import { WER_LABEL, einschaetzen, dauerText } from '@/lib/make-one/umsetzung-data';
import {
  MODI, MODUS, STANDARD_MODUS, BEREICHE, REGLER, wertVon, abweichungen, stufeText,
  type ReglerId,
} from '@/lib/make-one/kompass-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Zahl, Segmente, feld, LEUCHT } from './schlank';

const HAAR = 'rgba(255,255,255,.06)';
/** Beschriftung einer Zeile im Filter-Editor — GROSSBUCHSTABEN, leise. */
const MIKRO: CSSProperties = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const wahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', outline: 'none', cursor: 'pointer' };
/** Kleiner, rahmenloser Knopf für ▲ ▼ ↺ ✕. */
const klein = (aus = false): CSSProperties => ({ width: 30, height: 30, borderRadius: 9, border: 'none', cursor: aus ? 'default' : 'pointer', background: 'rgba(255,255,255,.06)', color: aus ? C.linie : C.inkDim, fontSize: TYP.bedien, display: 'grid', placeItems: 'center', padding: 0, flex: '0 0 auto', opacity: aus ? .5 : 1 });
const loeschen: CSSProperties = { background: 'transparent', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: '2px 4px', flex: '0 0 auto' };
const verweis: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' };

const SAEULE_VON_REGLER: Record<string, string> = {
  'fokus-health': 'health', 'fokus-business': 'business', 'fokus-planning': 'planning',
  'fokus-finance': 'finance', 'fokus-social': 'social',
};

interface EigenerFilter {
  id: string; name: string; wo: 'aufgaben' | 'inbox';
  themen?: string[]; orgs?: string[]; prios?: string[]; stichworte?: string[]; wege?: string[]; faecher?: string[];
  besitzer?: string; suche?: string;
}
interface EigenesStichwort { id: string; label: string; thema: string; woerter: string[]; kpi?: boolean }

const PRIOS = [['critical', 'kritisch'], ['high', 'hoch'], ['medium', 'mittel'], ['low', 'niedrig']] as const;

/** Die Horizonte, für die je ein Fokus-Satz gesetzt wird. */
const HORIZONTE = [
  { id: 'jahr', label: 'Jahr', frage: 'Worauf läuft dieses Jahr hinaus?' },
  { id: 'quartal', label: 'Quartal', frage: 'Was muss dieses Quartal stehen?' },
  { id: 'monat', label: 'Monat', frage: 'Worauf liegt der Fokus diesen Monat?' },
  { id: 'woche', label: 'Woche', frage: 'Worauf liegt der Fokus diese Woche?' },
  { id: 'tag', label: 'Heute', frage: 'Worauf liegt der Fokus heute?' },
];

export function KompassView() {
  const { state } = useTasks();

  // ── Lage & Regler ──
  const [modus, setModus] = useState<string>(STANDARD_MODUS);
  const [eigene, setEigene] = useState<Partial<Record<ReglerId, number>>>({});
  const [geladen, setGeladen] = useState(false);
  const [reihenfolge, setReihenfolge] = useState<string[]>(STANDARD_ORDNUNG);
  const [tiefer, setTiefer] = useState(false);
  // Der Fokus je Horizont liegt in denselben Zielen, aus denen Tag, Woche und
  // Jarvis lesen — hier wird er gesetzt, dort wirkt er.
  const [fokus, setFokus] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json()).then(d => {
      if (d.modus) setModus(d.modus);
      if (d.eigene) setEigene(d.eigene);
      setGeladen(true);
    }).catch(() => setGeladen(true));
    fetch('/api/state/ordnung').then(r => r.json()).then(d => {
      if (Array.isArray(d.reihenfolge) && d.reihenfolge.length) setReihenfolge(d.reihenfolge);
    }).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setFokus(d.fokus ?? {})).catch(() => {});
  }, []);

  // Die Route nimmt einen Horizont je Aufruf — genau den geänderten.
  const fokusSpaeter = useNachspeichern<{ h: string; text: string }>(({ h, text }) => {
    fetch('/api/state/ziele', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horizont: h, fokus: text }), keepalive: true,
    }).catch(() => {});
  }, 500);

  /** Fokus-Satz setzen — sofort sichtbar, kurz gebündelt geschrieben. */
  function fokusSetzen(h: string, text: string) {
    fokusSpaeter({ h, text });
    setFokus(prev => {
      const next = { ...prev, [h]: text };
      return next;
    });
  }

  const wert = (id: ReglerId) => wertVon(id, modus, eigene);
  const abw = abweichungen(modus, eigene);

  /** Fokuswerte in den Speicher schreiben, den die übrige Software liest. */
  function fokusSpiegeln(werte: Partial<Record<ReglerId, number>>, basisModus: string) {
    const regler: Record<string, number> = {};
    for (const [rid, saeule] of Object.entries(SAEULE_VON_REGLER)) {
      regler[saeule] = wertVon(rid as ReglerId, basisModus, werte);
    }
    fetch('/api/state/fokus-regler', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regler }) }).catch(() => {});
  }

  function reglerSetzen(id: ReglerId, v: number) {
    const next = { ...eigene, [id]: v };
    setEigene(next);
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eigene: { [id]: v } }) }).catch(() => {});
    if (SAEULE_VON_REGLER[id]) fokusSpiegeln(next, modus);
  }

  /** Lage wechseln: setzt alle Regler, die Themen-Reihenfolge und den Fokus. */
  function lageWechseln(id: string) {
    const m = MODUS[id];
    if (!m) return;
    setModus(id);
    setEigene({});
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modus: id }) }).catch(() => {});
    setReihenfolge(m.ordnung);
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: m.ordnung }) }).catch(() => {});
    fokusSpiegeln({}, id);
  }

  function zuruecksetzen() {
    setEigene({});
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zuruecksetzen: true }) }).catch(() => {});
    const m = MODUS[modus];
    if (m) {
      setReihenfolge(m.ordnung);
      fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: m.ordnung }) }).catch(() => {});
    }
    fokusSpiegeln({}, modus);
  }

  function schieben(id: string, richtung: -1 | 1) {
    const i = reihenfolge.indexOf(id), j = i + richtung;
    if (i < 0 || j < 0 || j >= reihenfolge.length) return;
    const next = [...reihenfolge];
    [next[i], next[j]] = [next[j], next[i]];
    setReihenfolge(next);
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: next }) }).catch(() => {});
  }

  // ── Eigene Bezeichnungen: umbenennen und ergänzen ohne Code ──
  const [labels, setLabels] = useState<{ themen: Record<string, string>; orte: Record<string, string>; kategorien: string[]; versteckt: string[] }>(
    { themen: {}, orte: {}, kategorien: [], versteckt: [] },
  );
  const [neueKat, setNeueKat] = useState('');
  useEffect(() => {
    fetch('/api/state/labels').then(r => r.json()).then(d => setLabels({
      themen: d.themen ?? {}, orte: d.orte ?? {}, kategorien: d.kategorien ?? [], versteckt: d.versteckt ?? [],
    })).catch(() => {});
  }, []);

  const labelSpaeter = useNachspeichern<{ gruppe: string; werte: Record<string, string> }>(({ gruppe, werte }) => {
    fetch('/api/state/labels', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [gruppe]: werte }), keepalive: true,
    }).catch(() => {});
  }, 500);

  function labelSetzen(gruppe: 'themen' | 'orte', id: string, text: string) {
    const werte = { ...labels[gruppe], [id]: text };
    setLabels({ ...labels, [gruppe]: werte });
    labelSpaeter({ gruppe, werte });
  }

  function kategorienSetzen(liste: string[]) {
    setLabels(prev => ({ ...prev, kategorien: liste }));
    fetch('/api/state/labels', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategorien: liste }), keepalive: true,
    }).catch(() => {});
  }

  // ── Eigene Filter & Stichworte ──
  const [filter, setFilter] = useState<EigenerFilter[]>([]);
  const [eigeneSw, setEigeneSw] = useState<EigenesStichwort[]>([]);
  useEffect(() => {
    fetch('/api/state/filter').then(r => r.json()).then(d => {
      setFilter(Array.isArray(d.filter) ? d.filter : []);
      setEigeneSw(Array.isArray(d.stichworte) ? d.stichworte : []);
    }).catch(() => {});
  }, []);
  function speichern(next: { filter?: EigenerFilter[]; stichworte?: EigenesStichwort[] }) {
    if (next.filter) setFilter(next.filter);
    if (next.stichworte) setEigeneSw(next.stichworte);
    fetch('/api/state/filter', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: next.filter ?? filter, stichworte: next.stichworte ?? eigeneSw }),
    }).catch(() => {});
  }

  // ── Türsteher-Stand fürs Wirkungs-Feedback ──
  const [offeneAbsender, setOffeneAbsender] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/state/inbox-absender').then(r => r.json()).then(d => setOffeneAbsender(Object.keys(d.bekannt ?? {}).length)).catch(() => {});
  }, []);

  // ── WIRKUNG: was der Regler gerade bewirkt, in echten Zahlen ──
  const offen = useMemo(() => state.tasks.filter(t => t.status !== 'done'), [state.tasks]);
  const heute = localDay();
  const wirkung = (id: ReglerId): string => {
    const v = wert(id);
    const saeule = SAEULE_VON_REGLER[id];
    if (saeule) {
      const n = offen.filter(t => SAEULE_VON_PROJEKT[t.projectId] === saeule).length;
      if (!n) return 'gerade keine Aufgaben in dieser Säule';
      return v >= FOKUS_SCHWELLE ? `${n} Aufgaben wandern nach oben` : `${n} Aufgaben laufen normal mit`;
    }
    if (id === 'tageslast') {
      const heuteMin = offen.filter(t => t.dueDate === heute).reduce((s, t) => s + einschaetzen(t).dauer, 0);
      if (!heuteMin) return `heute nichts terminiert · Grenze ${v} h`;
      const ueber = heuteMin > v * 60;
      return `heute ${dauerText(heuteMin)} geplant — ${ueber ? `${dauerText(heuteMin - v * 60)} über der Grenze` : 'passt in die Grenze'}`;
    }
    if (id === 'kritisch-grenze') {
      const k = offen.filter(t => t.priority === 'critical').length;
      return k > v ? `${k} kritisch offen — ${k - v} über deiner Grenze` : `${k} kritisch offen — im Rahmen`;
    }
    if (id === 'vorschau-tage') {
      const bis = new Date(); bis.setDate(bis.getDate() + v);
      const grenze = localDay(bis);
      const n = offen.filter(t => t.dueDate && t.dueDate >= heute && t.dueDate <= grenze).length;
      return `${n} Aufgaben liegen in diesem Fenster`;
    }
    if (id === 'fokus-schwelle') {
      const drueber = (['health', 'business', 'planning', 'finance', 'social'] as const)
        .filter(s => wert(`fokus-${s}` as ReglerId) >= v).length;
      return drueber === 0 ? 'keine Säule hat gerade Vorfahrt' : drueber === 5 ? 'alle fünf Säulen — das ist kein Fokus mehr' : `${drueber} von 5 Säulen haben Vorfahrt`;
    }
    if (id === 'wochenlast') return `Wochenplaner warnt ab ${v} verplanten Stunden`;
    if (id === 'recovery-gruen') return `grün ab ${v} % · gelb ab ${Math.max(20, v - 26)} % · darunter rot`;
    if (id === 'runway-warnung') return `rot unter ${v} Monaten, gelb unter ${v * 2} — gilt in Shields, Controlling und Board`;
    if (id === 'nachtruhe-ab') return `zwischen ${v} und 7 Uhr läuft nichts von selbst`;
    if (id === 'tagesstart-auto') return v >= 50 ? 'startet beim Öffnen von selbst (bis zu 4 Minuten)' : 'wartet auf deinen Knopfdruck';
    if (id === 'koerper-an-agenten') return v >= 50 ? 'Agenten sehen Erholung, Schlaf und Symptome' : 'Gesundheitswerte bleiben aus allen Agenten-Aufträgen draußen';
    if (id === 'tuersteher') {
      const n = offeneAbsender;
      if (v >= 88) return n ? `nur die ${n} entschiedenen Absender kommen durch` : 'noch niemand entschieden — Postfach bleibt offen';
      if (v <= 12) return 'jeder darf rein, der Türsteher schweigt';
      return n != null ? `${n} Absender bereits entschieden` : 'Türsteher arbeitet mit';
    }
    return stufeText(v, REGLER.find(r => r.id === id)?.skala);
  };

  const themen = sortierteThemen(reihenfolge, labels.themen);
  /** Themen-Nachschlag mit euren eigenen Bezeichnungen. */
  const THEMA_EIGEN = useMemo(() => themenMit(labels.themen), [labels.themen]);
  const stichListe = useMemo(() => mitEigenen(eigeneSw), [eigeneSw]);
  const aktLage = MODUS[modus] ?? MODUS[STANDARD_MODUS];

  // ── Filter-Bearbeitung ──
  const [neuName, setNeuName] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);
  function filterAnlegen() {
    const name = neuName.trim();
    if (!name) return;
    const f: EigenerFilter = { id: `f-${Date.now().toString(36)}`, name, wo: 'aufgaben', themen: [], orgs: [], prios: [], stichworte: [], wege: [] };
    speichern({ filter: [...filter, f] });
    setNeuName('');
    setOffenId(f.id);
  }
  const patch = (id: string, p: Partial<EigenerFilter>) => speichern({ filter: filter.map(f => f.id === id ? { ...f, ...p } : f) });
  const kippen = (liste: string[] | undefined, w: string) =>
    (liste ?? []).includes(w) ? (liste ?? []).filter(x => x !== w) : [...(liste ?? []), w];

  /** Wie viele Aufgaben ein Filter gerade trifft — sofortiges Feedback. */
  const trefferVon = (f: EigenerFilter) => offen.filter(t => {
    if (f.themen?.length && !f.themen.includes(themaVon(t, {}))) return false;
    if (f.prios?.length && !f.prios.includes(t.priority)) return false;
    if (f.wege?.length && !f.wege.includes(einschaetzen(t).wer)) return false;
    if (f.besitzer && t.assignee !== f.besitzer) return false;
    if (f.stichworte?.length) {
      const meine = stichworteVon(t, {}, stichListe);
      if (!f.stichworte.some(s => meine.includes(s))) return false;
    }
    if (f.suche && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(f.suche.toLowerCase())) return false;
    return true;
  }).length;

  const [swLabel, setSwLabel] = useState('');
  const [swWoerter, setSwWoerter] = useState('');
  const [swThema, setSwThema] = useState('umsatz');
  function stichwortAnlegen() {
    const label = swLabel.trim();
    if (!label) return;
    const woerter = swWoerter.split(',').map(w => w.trim()).filter(Boolean);
    speichern({ stichworte: [...eigeneSw, { id: `eig-${Date.now().toString(36)}`, label, thema: swThema, woerter: woerter.length ? woerter : [label] }] });
    setSwLabel(''); setSwWoerter('');
  }

  /** Umschalt-Pille im Filter-Editor: leuchtet in der Farbe, wenn sie an ist. */
  const chip = (an: boolean, farbe: string, text: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} className="fassbar" style={{
      fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', border: 'none',
      background: an ? `${farbe}22` : 'rgba(255,255,255,.06)', color: an ? farbe : C.inkDim, transition: 'background .15s ease, color .15s ease',
    }}>{text}</button>
  );
  /** Eine Zeile im Filter-Editor: Beschriftung links, Pillen rechts. */
  const reihe = (label: string, kinder: ReactNode) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ ...MIKRO, width: 64, flex: '0 0 auto' }}>{label}</span>
      {kinder}
    </div>
  );

  const gesetzt = HORIZONTE.filter(h => (fokus[h.id] ?? '').trim()).length;
  let k = 0; // laufender Karten-Index fürs gestaffelte Erscheinen

  return (
    <Seite
      titel="Kompass"
      unter="Der Zustand, in dem das System läuft: Lage → Regler → Wirkung → Reichweite. Was hier steht, wirkt in Aufgaben, Tag, Dashboard und Postfach."
      breit={960}
      rechts={abw.length > 0 ? <Knopf leise onClick={zuruecksetzen}>↺ {abw.length} Abweichung{abw.length === 1 ? '' : 'en'} zurücknehmen</Knopf> : undefined}
    >
      {/* ── EBENE 1: DIE LAGE ──
          Kein Zahlenwert, sondern ein Zustand: in welcher Lage läuft das
          System gerade. Alles andere auf dieser Seite justiert nur nach. */}
      <Karte i={k++} akzent={aktLage.farbe}>
        <Ueberschrift farbe={aktLage.farbe} rechts="wirkt in Aufgaben · Tag · Dashboard · Postfach">Lage</Ueberschrift>
        <div style={{ display: 'flex', gap: 'clamp(16px,3vw,32px)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Zahl gross wert={aktLage.label} label="aktuelle Lage" farbe={aktLage.farbe} />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <p style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', color: C.ink, margin: 0, lineHeight: 1.35 }}>{aktLage.satz}</p>
            {abw.length > 0 && <p style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '8px 0 0' }}>Von der Lage abweichend eingestellt: {abw.length} Regler.</p>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {MODI.map(m => {
            const an = m.id === modus;
            return (
              <button key={m.id} onClick={() => lageWechseln(m.id)} className="fassbar" style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', border: 'none', fontFamily: SCHRIFT.text,
                background: an ? `${m.farbe}1f` : 'rgba(255,255,255,.04)', boxShadow: an ? `inset 0 0 0 1px ${m.farbe}66, 0 0 24px -8px ${m.farbe}40` : undefined, transition: 'background .2s ease, box-shadow .2s ease',
              }}>
                <div style={{ fontSize: TYP.body, fontWeight: 700, color: an ? m.farbe : C.ink, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>{m.satz}</div>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12 }}>
          Ein Klick stellt Fokus, Reihenfolge, Tageslast, Postfach-Strenge und Agenten-Leine gemeinsam um.
        </div>
      </Karte>

      {/* ── PRIORITÄTEN: was zuerst zählt, wenn alles wichtig ist ──
          Kevins Ansage: „Das ist nicht unsere Ordnung, das sind unsere
          Prioritäten." Diese Reihenfolge sortiert das Taskmanagement, den
          Tagesplan und Jarvis' Vorschläge — deshalb steht sie hier oben. */}
      <Karte i={k++}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts="Die Lage setzt sie — hier feinjustieren.">Unsere Prioritäten</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Was zuerst zählt, wenn alles wichtig ist.</div>
        <Liste>
          {themen.map((b, i) => {
            const n = offen.filter(t => themaVon(t, {}) === b.id).length;
            return (
              <Zeile key={b.id}
                links={<span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.zahl, fontWeight: 700, color: b.farbe, width: 28, textAlign: 'center', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>}
                titel={<>{b.label} <span style={{ color: C.inkLeise, fontWeight: 400 }}>· {n} offen</span></>}
                unter={b.satz}
                rechts={<span style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                  <button onClick={() => schieben(b.id, -1)} disabled={i === 0} aria-label="Nach oben" style={klein(i === 0)}>▲</button>
                  <button onClick={() => schieben(b.id, 1)} disabled={i === themen.length - 1} aria-label="Nach unten" style={klein(i === themen.length - 1)}>▼</button>
                </span>} />
            );
          })}
        </Liste>
      </Karte>

      {/* ── FOKUS: worauf es je Horizont ankommt ──
          Kevin: „eine eigene Seite, wo es nur darum geht, welche Prios wir
          geben und welchen Fokus." Der Satz je Horizont steht in denselben
          Daten, aus denen Jarvis, der Tagesplan und die Wochensicht lesen. */}
      <Karte i={k++}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Chip farbe={gesetzt === HORIZONTE.length ? LEUCHT.gut : gesetzt ? LEUCHT.achtung : C.inkLeise}>{gesetzt} von {HORIZONTE.length} gesetzt</Chip>}>Unser Fokus</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 10 }}>Ein Satz je Horizont. Was hier steht, taucht im Tag, in der Woche und bei Jarvis wieder auf.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {HORIZONTE.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...MIKRO, width: 62, flex: '0 0 auto' }}>{h.label}</span>
              <input
                value={fokus[h.id] ?? ''}
                onChange={e => fokusSetzen(h.id, e.target.value)}
                placeholder={h.frage}
                aria-label={`Fokus ${h.label}`}
                style={{ ...feld, fontWeight: fokus[h.id] ? 600 : 400 }}
              />
            </div>
          ))}
        </div>
      </Karte>

      {/* ── EBENE 2+3: REGLER MIT WIRKUNG ── */}
      {!geladen ? (
        <Karte i={k++}><Leer>lädt …</Leer></Karte>
      ) : BEREICHE.map(b => {
        const meine = REGLER.filter(r => r.bereich === b.id);
        // Schrittweise Tiefe: Fokus und Zeit stehen offen, der Rest auf Wunsch.
        const immer = b.id === 'fokus' || b.id === 'zeit';
        if (!immer && !tiefer) return null;
        return (
          <Karte key={b.id} i={k++}>
            <Ueberschrift farbe={b.farbe} rechts={b.satz}>{b.label}</Ueberschrift>
            {meine.map(r => {
              const v = wert(r.id);
              const eigenerWert = typeof eigene[r.id] === 'number' && eigene[r.id] !== aktLage.werte[r.id];
              return (
                <div key={r.id} className="zeile" style={{ padding: '12px 2px', borderBottom: `1px solid ${HAAR}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, flex: '1 1 160px', minWidth: 0 }}>
                      {r.label}
                      {eigenerWert && <span style={{ color: LEUCHT.achtung, marginLeft: 6 }} title="weicht von der Lage ab">•</span>}
                    </span>
                    {r.schalter ? (
                      <Segmente
                        liste={[{ id: '100', label: r.skala?.[1] ?? 'an' }, { id: '0', label: r.skala?.[0] ?? 'aus' }]}
                        aktiv={v === 100 ? '100' : '0'}
                        onWahl={id => reglerSetzen(r.id, Number(id))} />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '2 1 220px', minWidth: 0 }}>
                        <input type="range" min={r.min} max={r.max} step={r.schritt} value={v}
                          onChange={e => reglerSetzen(r.id, Number(e.target.value))}
                          aria-label={r.label}
                          style={{ flex: 1, minWidth: 120, accentColor: b.farbe, cursor: 'pointer' }} />
                        <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: b.farbe, minWidth: 56, textAlign: 'right', flex: '0 0 auto' }}>
                          {v}{r.einheit ? ` ${r.einheit}` : ''}
                        </span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 6 }}>
                    <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>→ {wirkung(r.id)}</span>
                    <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{r.erklaert}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.wirktIn.map(w => (
                        <Link key={w.href} href={w.href} style={verweis}>{w.label} ›</Link>
                      ))}
                    </span>
                  </div>
                </div>
              );
            })}
          </Karte>
        );
      })}

      {geladen && (
        <div className="os-auf" style={{ ['--i' as string]: k++, display: 'flex', justifyContent: 'center' }}>
          <Knopf leise onClick={() => setTiefer(!tiefer)}>
            {tiefer ? '− Postfach, Agenten und Schutz einklappen' : '+ Postfach, Agenten und Schutz einstellen'}
          </Knopf>
        </div>
      )}

      {/* ── Eigene Filter ── */}
      <Karte i={k++}>
        <Ueberschrift farbe={LEUCHT.puls} rechts="Einmal einstellen, dann mit einem Klick aufrufen.">Eigene Filter</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuName} onChange={e => setNeuName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') filterAnlegen(); }}
            placeholder="Name, z. B. Was Malin heute macht — oder: Alles zum Steuerberater" aria-label="Neuer Filter"
            style={{ ...feld, width: 'auto', flex: '1 1 220px', minWidth: 0 }} />
          <Knopf onClick={filterAnlegen}>+ Anlegen</Knopf>
        </div>

        {!filter.length && <Leer>Noch keine eigenen Filter. Leg einen an — er erscheint dann oben im Taskmanagement.</Leer>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filter.map(f => {
            const auf = offenId === f.id;
            const treffer = f.wo === 'aufgaben' ? trefferVon(f) : null;
            const teile = [
              ...(f.themen ?? []).map(x => THEMA_EIGEN[x]?.label),
              ...(f.orgs ?? []).map(x => ORGS.find(o => o.id === x)?.kurz),
              ...(f.prios ?? []).map(x => PRIOS.find(p => p[0] === x)?.[1]),
              ...(f.wege ?? []).map(x => WER_LABEL[x as keyof typeof WER_LABEL]),
              ...(f.stichworte ?? []).map(x => STICHWORTE.find(s => s.id === x)?.label ?? eigeneSw.find(s => s.id === x)?.label),
            ].filter(Boolean);
            return (
              <div key={f.id} style={{ background: auf ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.03)', borderRadius: 14, padding: '10px 14px', transition: 'background .2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input value={f.name} onChange={e => patch(f.id, { name: e.target.value })} aria-label="Filtername"
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 600, flex: '1 1 140px', minWidth: 0 }} />
                  {treffer != null && <Chip farbe={treffer ? LEUCHT.gut : C.inkLeise}>{treffer} Treffer</Chip>}
                  <Chip farbe={C.inkLeise}>{f.wo === 'inbox' ? 'Postfach' : 'Aufgaben'}</Chip>
                  <Knopf leise onClick={() => setOffenId(auf ? null : f.id)}>{auf ? 'Fertig' : 'Einstellen'}</Knopf>
                  <button onClick={() => speichern({ filter: filter.filter(x => x.id !== f.id) })} aria-label="Filter löschen" style={loeschen}>✕</button>
                </div>
                {!auf && teile.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>{teile.join(' · ')}</div>}
                {!auf && !teile.length && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 4 }}>Noch nichts eingestellt — Einstellen klicken.</div>}

                {auf && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reihe('Gilt für', <>
                      {chip(f.wo === 'aufgaben', C.aktiv, 'Aufgaben', () => patch(f.id, { wo: 'aufgaben' }), 'w-a')}
                      {chip(f.wo === 'inbox', C.aktiv, 'Postfach', () => patch(f.id, { wo: 'inbox' }), 'w-i')}
                    </>)}
                    {f.wo === 'aufgaben' ? (
                      <>
                        {reihe('Thema', THEMEN.map(b => chip((f.themen ?? []).includes(b.id), b.farbe, b.label, () => patch(f.id, { themen: kippen(f.themen, b.id) }), b.id)))}
                        {reihe('Ort', ORGS.map(o => chip((f.orgs ?? []).includes(o.id), o.farbe, o.kurz, () => patch(f.id, { orgs: kippen(f.orgs, o.id) }), o.id)))}
                        {reihe('Stufe', PRIOS.map(([key, label]) => chip((f.prios ?? []).includes(key), C.aktiv, label, () => patch(f.id, { prios: kippen(f.prios, key) }), key)))}
                        {reihe('Weg', (['jarvis', 'gemeinsam', 'mensch'] as const).map(w => chip((f.wege ?? []).includes(w), C.aktiv, WER_LABEL[w], () => patch(f.id, { wege: kippen(f.wege, w) }), w)))}
                        {reihe('Wer', (['kevin', 'malin', 'both'] as const).map(p => chip(f.besitzer === p, C.aktiv, p === 'both' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin', () => patch(f.id, { besitzer: f.besitzer === p ? undefined : p }), p)))}
                      </>
                    ) : (
                      reihe('Fach', FAECHER.map(fa => chip((f.faecher ?? []).includes(fa.id), fa.farbe, fa.label, () => patch(f.id, { faecher: kippen(f.faecher, fa.id) }), fa.id)))
                    )}
                    {reihe('Text', (
                      <input value={f.suche ?? ''} onChange={e => patch(f.id, { suche: e.target.value })}
                        placeholder="muss im Text vorkommen (optional)" aria-label="Suchtext"
                        style={{ ...feld, width: 'auto', flex: '1 1 200px', minWidth: 0, padding: '8px 12px', fontSize: TYP.bedien }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Karte>

      {/* ── Eigene Stichworte ── */}
      <Karte i={k++}>
        <Ueberschrift rechts={`${STICHWORTE.length} sind eingebaut — hier kommen eure eigenen dazu.`}>Eigene Stichworte</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <input value={swLabel} onChange={e => setSwLabel(e.target.value)} placeholder="Name, z. B. Zoo Palais"
            aria-label="Name des Stichworts" style={{ ...feld, width: 'auto', flex: '1 1 160px', minWidth: 0 }} />
          <input value={swWoerter} onChange={e => setSwWoerter(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') stichwortAnlegen(); }}
            placeholder="Wörter zum Erkennen, mit Komma getrennt" aria-label="Erkennungswörter" style={{ ...feld, width: 'auto', flex: '2 1 200px', minWidth: 0 }} />
          <select value={swThema} onChange={e => setSwThema(e.target.value)} aria-label="Thema" style={wahl}>
            {THEMEN.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <Knopf onClick={stichwortAnlegen}>+ Anlegen</Knopf>
        </div>
        {!eigeneSw.length && <Leer>Noch keine eigenen. Beispiel: Name Zoo Palais, Wörter: Zoo Palais, Pressekonferenz, Volllaunch.</Leer>}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {eigeneSw.map(s => (
            <span key={s.id} title={s.woerter.join(', ')}>
              <Chip farbe={THEMA_EIGEN[s.thema]?.farbe ?? C.inkDim}>
                {s.label}
                <span style={{ fontWeight: 500, opacity: .75 }}>{s.woerter.length} Wörter</span>
                <button onClick={() => speichern({ stichworte: eigeneSw.filter(x => x.id !== s.id) })} aria-label="Stichwort löschen"
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: TYP.mikro, opacity: .8 }}>✕</button>
              </Chip>
            </span>
          ))}
        </div>
      </Karte>

      {/* ── EIGENE BEZEICHNUNGEN ──
          Kevins Kernsatz: „Wir bauen aus diesem System selber ein System —
          aber das geht nicht, wenn du das immer einprogrammierst." Hier wird
          umbenannt und ergänzt, ohne dass jemand Code anfasst. */}
      <Karte i={k++}>
        <Ueberschrift rechts="Wie die Dinge bei euch heißen. Wirkt überall, wo sie auftauchen.">Eigene Bezeichnungen</Ueberschrift>

        <div style={{ ...MIKRO, marginBottom: 8 }}>Prioritäten umbenennen</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {THEMEN.map(th => (
            <div key={th.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Punkt farbe={th.farbe} groesse={10} />
              <input
                value={labels.themen[th.id] ?? ''}
                placeholder={th.label}
                onChange={e => labelSetzen('themen', th.id, e.target.value)}
                aria-label={`Bezeichnung für ${th.label}`}
                style={{ ...feld, width: 'auto', flex: 1, minWidth: 0, padding: '8px 12px', fontSize: TYP.bedien }} />
              {labels.themen[th.id] && (
                <button onClick={() => labelSetzen('themen', th.id, '')} title="Zurück auf den Standard" aria-label="Zurück auf den Standard" style={klein()}>↺</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ ...MIKRO, margin: '16px 0 8px' }}>
          Eigene Kategorien <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>für Buchungen, Zahlungen und Planposten</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {labels.kategorien.map(kat => (
            <Chip key={kat} farbe={C.inkDim}>
              {kat}
              <button onClick={() => kategorienSetzen(labels.kategorien.filter(x => x !== kat))} title={`„${kat}" entfernen`} aria-label={`„${kat}" entfernen`}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: TYP.mikro, padding: 0, opacity: .8 }}>✕</button>
            </Chip>
          ))}
          {!labels.kategorien.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine eigenen — die vorhandenen kommen aus euren Daten.</span>}
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          const w = neueKat.trim();
          if (!w || labels.kategorien.includes(w)) return;
          kategorienSetzen([...labels.kategorien, w]);
          setNeueKat('');
        }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neueKat} onChange={e => setNeueKat(e.target.value)} placeholder="Kategorie hinzufügen …"
            aria-label="Neue Kategorie" style={{ ...feld, width: 'auto', flex: '1 1 180px', maxWidth: 320, minWidth: 0, padding: '8px 12px', fontSize: TYP.bedien }} />
          <Knopf aus={!neueKat.trim()}>+ anlegen</Knopf>
        </form>
      </Karte>

      {/* ── Reichweite: wo sonst noch eingestellt wird ── */}
      <Karte i={k++}>
        <Ueberschrift>Weiter einstellen</Ueberschrift>
        <Liste>
          {[
            { href: '/os/aufgaben', label: 'Aufgaben', unter: 'Stichworte & Orte je Aufgabe' },
            { href: '/os/inbox', label: 'Postfach', unter: 'Türsteher & Fächer' },
            { href: '/os/datenbasis', label: 'Datenbasis', unter: 'Quellen & Verbindungen' },
            { href: '/os/agenten', label: 'Agenten', unter: 'was läuft' },
            { href: '/os/planung/jahr', label: 'Jahr', unter: 'Ziele & Meilensteine' },
            { href: '/os/bauplan', label: 'Bauplan', unter: 'was wir noch bauen' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <Zeile titel={l.label} unter={l.unter} rechts={<span style={{ color: C.inkLeise, fontSize: TYP.body }}>›</span>} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}

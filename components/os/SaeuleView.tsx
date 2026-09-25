'use client';

// ─── MAKE OS — Säule ────────────────────────────────────────────────────────
// Eine Seite je Säule des Wachstums-Scores: oben der gerechnete Wert mit seiner
// Herleitung, darunter Werkzeuge, die genau diesen Bereich bewegen. Kein
// Abladeplatz für Links — jede Säule bekommt etwas, das man hier wirklich tut.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile, LEUCHT).

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { PerfIndex, Saeule } from '@/lib/performance';
import { TEAM, RITUALE } from '@/lib/make-one/team-data';
import { eur, computeMetrics, type FinanceState, type Kasse } from '@/lib/make-one/finance-data';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Ring, Zahl, Balken, Fortschritt, Haken, feld, LEUCHT } from './schlank';

export const SAEULEN_META: Record<string, { titel: string; claim: string; hin: string }> = {
  health: { titel: 'Gesundheit & Energie', claim: 'Der Körper trägt alles andere.', hin: 'Recovery, Schlaf, Routinen, Journal' },
  business: { titel: 'Business-Performance', claim: 'Der Weg auf 1 Mio.', hin: 'Umsatz-Kurs und Pipeline' },
  planning: { titel: 'Planung & Execution', claim: 'Ob aus Vorhaben Erledigtes wird.', hin: 'Aufgabenlage und Fluss' },
  finance: { titel: 'Finanzen', claim: 'Wie lange du durchhältst.', hin: 'Runway, Gewinn, Marge' },
  social: { titel: 'Beziehung & Team', claim: 'Wer mitträgt — und wer zu kurz kommt.', hin: 'Rituale, Delegation, Stimmung' },
  agents: { titel: 'Agenten', claim: 'Was Jarvis und die Agenten dir abnehmen.', hin: 'Läufe, Aufträge, Stapel, Bote' },
};

/** Eine Farbe je Säule — dieselbe wie auf der Wachstums-Seite. */
const SAEULEN_FARBE: Record<string, string> = { health: LEUCHT.gut, business: LEUCHT.business, planning: LEUCHT.puls, finance: LEUCHT.geld, social: LEUCHT.beziehung, agents: LEUCHT.agenten };
/** Zustandsfarbe eines Werts — Schwellen wie bisher (70/45). */
const col = (v: number | null) => (v == null ? C.inkLeise : v >= 70 ? LEUCHT.gut : v >= 45 ? LEUCHT.achtung : LEUCHT.kritisch);
const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
const linkKnopf: CSSProperties = {
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,.06)', color: C.ink, textDecoration: 'none',
};
const legende: CSSProperties = { fontSize: TYP.mikro, color: C.inkLeise, marginTop: 8, letterSpacing: '.04em', textTransform: 'uppercase' };
const absatz: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 };
const tage = (n: number, bis = new Date()) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - (n - 1 - i));
    return localDay(d);
  });
const kurzDatum = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;

// ───────────────────────── Gesundheit ─────────────────────────
function WerkzeugGesundheit() {
  const [vit, setVit] = useState<Record<string, { rec?: number; sleep?: number }>>({});
  const [log, setLog] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetch('/api/state/vitals')
      .then(r => r.json())
      .then(d => setVit(d.log ?? {}))
      .catch(() => {});
    fetch('/api/state/health')
      .then(r => r.json())
      .then(d => setLog(d.log ?? {}))
      .catch(() => {});
  }, []);
  const t14 = tage(14);
  const werte = t14.map(d => ({ d, rec: vit[d]?.rec, sleep: vit[d]?.sleep, routinen: log[d]?.length ?? 0 }));
  const hatWerte = werte.some(w => w.rec != null);
  const streak = (() => {
    let s = 0;
    for (let i = t14.length - 1; i >= 0; i--) {
      if ((log[t14[i]]?.length ?? 0) >= 4) s++;
      else break;
    }
    return s;
  })();
  const titel = werte.map(w => `${kurzDatum(w.d)} · Recovery ${w.rec ?? '—'}, Schlaf ${w.sleep ?? '—'}h`);

  return (
    <>
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit" style={link}>Morgen-Check ›</Link>}>Recovery & Schlaf · 14 Tage</Ueberschrift>
        {!hatWerte ? (
          <Leer>Noch keine eingetragenen Werte. Jeder Morgen-Check setzt hier einen Punkt — nach ein paar Tagen siehst du, ob Schlaf und Erholung zusammenhängen.</Leer>
        ) : (
          <>
            <Balken werte={werte.map(w => w.rec ?? null)} max={100} farbe={LEUCHT.gut} hoehe={56} titel={titel} />
            <div style={{ marginTop: 6 }}>
              <Balken werte={werte.map(w => w.sleep ?? null)} max={9} farbe={LEUCHT.schlaf} hoehe={28} titel={titel} />
            </div>
          </>
        )}
        <div style={legende}>oben Recovery · unten Schlaf</div>
      </Karte>
      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={<Chip farbe={streak > 0 ? LEUCHT.gut : C.inkLeise}>{streak} Tage in Folge</Chip>}>Routinen</Ueberschrift>
        <Balken werte={t14.map(d => log[d]?.length ?? 0)} max={ROUTINE_ITEMS.length} farbe={LEUCHT.gut} hoehe={32} titel={t14.map(d => `${kurzDatum(d)} · ${log[d]?.length ?? 0}/${ROUTINE_ITEMS.length}`)} />
        <p style={{ ...absatz, marginTop: 10 }}>
          Vier von {ROUTINE_ITEMS.length} Häkchen zählen als gehaltener Tag.{' '}
          <Link href="/os/gesundheit" style={link}>Heute abhaken ›</Link>
        </p>
      </Karte>
    </>
  );
}

// ───────────────────────── Business ─────────────────────────
interface Prospect {
  id: string;
  company: string;
  score?: number;
  status: string;
}
function WerkzeugBusiness() {
  const [ps, setPs] = useState<Prospect[]>([]);
  const [fin, setFin] = useState<FinanceState | null>(null);
  const [fplan, setFplan] = useState<{ rechnungen: { status: string; betrag: number; faellig?: string; kunde: string }[]; produkte: { status: string; preis: number; name: string }[] } | null>(null);
  const [kunden, setKunden] = useState<{ status: string; name: string; cashflow?: number }[]>([]);
  const [ms, setMs] = useState<{ titel: string; bereich: string; faellig?: string; zeitfenster?: string; fortschritt: number; erledigt: boolean }[]>([]);
  useEffect(() => {
    fetch('/api/state/prospects')
      .then(r => r.json())
      .then(d => setPs(d.state?.prospects ?? []))
      .catch(() => {});
    fetch('/api/state/finance')
      .then(r => r.json())
      .then(d => setFin(d.state ?? null))
      .catch(() => {});
    fetch('/api/state/finanzplan')
      .then(r => r.json())
      .then(setFplan)
      .catch(() => {});
    fetch('/api/state/kunden')
      .then(r => r.json())
      .then(d => setKunden(d.kunden ?? []))
      .catch(() => {});
    fetch('/api/state/meilensteine')
      .then(r => r.json())
      .then(d => setMs((d.meilensteine ?? []).filter((x: { bereich: string }) => x.bereich === 'business')))
      .catch(() => {});
  }, []);
  const stufen = [
    { k: 'neu', label: 'Neu', n: ps.filter(p => p.status === 'neu').length },
    { k: 'qualifiziert', label: 'Qualifiziert', n: ps.filter(p => p.status === 'qualifiziert').length },
    { k: 'kontaktiert', label: 'Kontaktiert', n: ps.filter(p => p.status === 'kontaktiert').length },
  ];
  const max = Math.max(1, ...stufen.map(s => s.n));
  const top = [...ps].filter(p => p.status !== 'kontaktiert' && p.status !== 'verworfen').sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const ist = fin ? fin.months.reduce((s, m) => s + m.umsatz, 0) : 0; // ── Der lebende Geld- und Mandats-Stand ──
  const heute = localDay();
  const sum = (l: { betrag: number }[]) => l.reduce((s, r) => s + (r.betrag || 0), 0);
  const gestellt = (fplan?.rechnungen ?? []).filter(r => r.status === 'gestellt');
  const geplantR = (fplan?.rechnungen ?? []).filter(r => r.status === 'geplant');
  const ueberfaellig = gestellt.filter(r => r.faellig && r.faellig < heute);
  const aktive = kunden.filter(k => k.status === 'aktiv');
  const cash = aktive.reduce((s, k) => s + (k.cashflow ?? 0), 0);
  const produkteAktiv = (fplan?.produkte ?? []).filter(p => p.status === 'aktiv' && p.preis > 0).length;
  const naechsterMs = ms.filter(m => !m.erledigt).sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999'))[0];
  const hotOffen = ps.filter(p => (p.score ?? 0) >= 80 && p.status !== 'kontaktiert' && p.status !== 'verworfen').length; // ── Der EINE Hebel — deterministische Regel-Kette, kein Raten ──
  const hebel = (() => {
    if (ueberfaellig.length) return { text: `${eur(sum(ueberfaellig))} Forderungen sind ÜBERFÄLLIG — heute nachfassen.`, href: '/os/finanzen', label: 'Finanzplanung' };
    if (!fin || ist === 0) return { text: 'Ohne Ist-Zahlen fliegt die Säule blind — Controlling füllen (Finanzmeeting).', href: '/os/controlling', label: 'Controlling' };
    if (geplantR.length && !gestellt.length)
      return { text: `${geplantR.length} Rechnung${geplantR.length > 1 ? 'en' : ''} in Vorbereitung — stellen, sonst fließt nichts.`, href: '/os/finanzen', label: 'Finanzplanung' };
    if (!produkteAktiv) return { text: 'Kein Produktpaket aktiv — ohne Angebot kein Verkauf. Pakete festzurren.', href: '/os/finanzen', label: 'Produkte' };
    if (hotOffen)
      return {
        text: `${hotOffen} heiße${hotOffen === 1 ? 'r' : ''} Prospect${hotOffen > 1 ? 's' : ''} (80+) unkontaktiert — der erste Schritt kostet 20 Minuten.`,
        href: '/os/prospecting',
        label: 'Zielliste',
      };
    if (naechsterMs) return { text: `Nächster Meilenstein: ${naechsterMs.titel} (${naechsterMs.fortschritt}%) — Fortschritt schieben.`, href: '/os/planung/jahr', label: 'Meilensteine' };
    return { text: 'Kurs halten — Pipeline füllen und Mandate ausbauen.', href: '/os/prospecting', label: 'Zielliste' };
  })();
  const kursPct = fin && ist > 0 ? Math.round((ist / fin.zielUmsatz) * 100) : null;
  return (
    <>
      {/* Der eine Hebel — was JETZT den größten Unterschied macht */}
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href={hebel.href} style={link}>{hebel.label} ›</Link>}>Der eine Hebel</Ueberschrift>
        <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5 }}>{hebel.text}</div>
      </Karte>
      {/* Geld & Mandate — die ehrlichen Bestandszahlen */}
      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.geld} rechts={<><Link href="/os/finanzen" style={link}>Finanzplanung ›</Link><Link href="/os/mandate" style={link}>Mandate ›</Link></>}>Geld & Mandate</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <Zahl wert={gestellt.length ? eur(sum(gestellt)) : undefined} label="offene Forderungen" farbe={ueberfaellig.length ? LEUCHT.kritisch : LEUCHT.achtung} />
          <Zahl wert={geplantR.length ? eur(sum(geplantR)) : undefined} label="in Vorbereitung" />
          <Zahl wert={aktive.length ? String(aktive.length) : undefined} label="aktive Mandate" farbe={LEUCHT.gut} />
          <Zahl wert={cash ? eur(cash) : undefined} label="Cashflow / Monat" farbe={LEUCHT.geld} />
        </div>
        {naechsterMs && (
          <Liste>
            <div style={{ marginTop: 10 }}>
              <Zeile links={<Chip farbe={LEUCHT.achtung}>◇</Chip>} titel={<>Nächster Meilenstein: <b style={{ fontWeight: 600 }}>{naechsterMs.titel}</b></>}
                unter={naechsterMs.faellig ? `fällig ${kurzDatum(naechsterMs.faellig)}` : (naechsterMs.zeitfenster ?? undefined)}
                rechts={<Chip farbe={col(naechsterMs.fortschritt)}>{naechsterMs.fortschritt} %</Chip>} />
            </div>
          </Liste>
        )}
      </Karte>
      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.business} rechts={<Link href="/os/prospecting" style={link}>Zielliste ›</Link>}>Trichter</Ueberschrift>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stufen.map(s => (
            <div key={s.k} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 120px) 1fr 36px', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{s.label}</span>
              <Fortschritt anteil={s.n / max} farbe={s.k === 'kontaktiert' ? LEUCHT.gut : LEUCHT.business} />
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, fontVariantNumeric: 'tabular-nums', color: s.n ? C.ink : C.inkLeise, textAlign: 'right' }}>{s.n || '—'}</span>
            </div>
          ))}
        </div>
        {top && (
          <div style={{ marginTop: 16, background: `${LEUCHT.business}14`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: LEUCHT.business, marginBottom: 4 }}>Nächster Kontakt</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink }}>{top.company}</span>
              <Chip farbe={col(top.score ?? null)}>{top.score ?? '—'}</Chip>
            </div>
            <Link href="/os/prospecting" style={{ ...link, fontSize: TYP.bedien, display: 'inline-block', marginTop: 6 }}>In der Zielliste öffnen ›</Link>
          </div>
        )}
      </Karte>
      <Karte i={4}>
        <Ueberschrift farbe={LEUCHT.business} rechts={fin && ist > 0 ? `${eur(ist)} von ${eur(fin.zielUmsatz)}` : undefined}>Umsatz-Kurs</Ueberschrift>
        {fin && ist > 0 && kursPct != null ? (
          <>
            <Zahl gross wert={String(kursPct)} label={`% von ${eur(fin.zielUmsatz)} erreicht`} farbe={LEUCHT.business} />
            <div style={{ marginTop: 12 }}>
              <Fortschritt anteil={Math.min(1, ist / fin.zielUmsatz)} farbe={LEUCHT.business} />
            </div>
          </>
        ) : (
          <Leer>
            Noch keine Ist-Zahlen. Ohne sie kann diese Säule nur die Pipeline bewerten — der halbe Blick.{' '}
            <Link href="/os/controlling" style={link}>Zahlen eintragen ›</Link>
          </Leer>
        )}
      </Karte>
    </>
  );
}

// ───────────────────────── Planung ─────────────────────────
interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}
function WerkzeugPlanung() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const today = localDay();
  const load = () =>
    fetch('/api/state/tasks')
      .then(r => r.json())
      .then(d => setTasks(d.state?.tasks ?? []))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const offen = tasks.filter(t => t.status !== 'done');
  const brennt = offen.filter(t => (t.dueDate && t.dueDate <= today) || t.priority === 'critical').sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  async function setStatus(t: Task, status: string) {
    setBusy(t.id);
    const next = tasks.map(x => (x.id === t.id ? { ...x, status, updatedAt: new Date().toISOString() } : x));
    setTasks(next);
    try {
      // Erst den echten Stand holen, dann genau diese eine Aufgabe ändern.
      // Wichtig: kommt keine Liste zurück, wird NICHT geschrieben — sonst
      // hätte ein fehlgeschlagener Lesevorgang alle Aufgaben gelöscht.
      const r = await fetch('/api/state/tasks', { cache: 'no-store' });
      if (!r.ok) throw new Error('Stand nicht lesbar');
      const cur = await r.json();
      if (!Array.isArray(cur?.state?.tasks) || !Array.isArray(cur?.state?.projects)) throw new Error('kein Bestand');
      await fetch('/api/state/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: cur.state.projects, tasks: cur.state.tasks.map((x: Task) => (x.id === t.id ? { ...x, status } : x)) }),
      });
      await load();
    } catch {
      setTasks(tasks); /* nicht gespeichert — Anzeige zurückdrehen */
    }
    setBusy(null);
  }
  return (
    <Karte i={1}>
      <Ueberschrift farbe={brennt.length ? LEUCHT.kritisch : LEUCHT.gut} rechts={<Link href="/os/aufgaben" style={link}>alle Aufgaben ›</Link>}>Was jetzt brennt</Ueberschrift>
      {!brennt.length ? (
        <Leer>Nichts überfällig und nichts Kritisches offen. Das ist die Lage, die du halten willst.</Leer>
      ) : (
        <Liste>
          {brennt.slice(0, 8).map(t => {
            const spaet = !!t.dueDate && t.dueDate < today;
            const laeuft = t.status === 'in-progress';
            return (
              <Zeile key={t.id}
                titel={t.title}
                unter={<span style={{ color: spaet ? LEUCHT.kritisch : C.inkLeise }}>{t.priority}{t.dueDate ? ` · ${spaet ? 'überfällig seit' : 'fällig'} ${t.dueDate}` : ''}</span>}
                rechts={
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Knopf leise={!laeuft} farbe={LEUCHT.puls} aus={busy === t.id} onClick={() => setStatus(t, laeuft ? 'todo' : 'in-progress')}>{laeuft ? 'in Arbeit' : 'anfangen'}</Knopf>
                    <Knopf farbe={LEUCHT.gut} aus={busy === t.id} onClick={() => setStatus(t, 'done')}>✓</Knopf>
                  </div>
                } />
            );
          })}
        </Liste>
      )}
      <p style={{ fontSize: 12, color: C.inkLeise, marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>{offen.length} offen — bis 12 gilt als tragbar. Was hier nicht brennt, muss heute nicht in deinen Kopf.</p>
    </Karte>
  );
}

// ───────────────────────── Finanzen ─────────────────────────
function WerkzeugFinanzen() {
  const [fin, setFin] = useState<FinanceState | null>(null);
  const [kasse, setKasse] = useState<Kasse | null>(null);
  const [grenze, setGrenze] = useState({ rot: 4, amber: 8 });
  const [cash, setCash] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch('/api/state/finance')
      .then(r => r.json())
      .then(d => {
        setFin(d.state ?? null);
        setKasse(d.kasse ?? null);
        if (d.runway) setGrenze(d.runway);
        if (d.state?.cash) setCash(String(d.state.cash));
      })
      .catch(() => {});
  }, []);
  // Eine Formel für alle: computeMetrics (ab Startmonat), Kasse aus den Firmenkonten.
  const ausKonten = kasse?.quelle === 'konten';
  const cashNum = ausKonten ? kasse!.betrag : Number(cash.replace(/[^\d-]/g, '')) || 0;
  const m = fin ? computeMetrics({ ...fin, cash: cashNum }) : null;
  const burn = m?.avgBurn ?? 0;
  const runway = m?.runwayMonate ?? null;
  const runwayFarbe = runway == null ? undefined : runway < grenze.rot ? LEUCHT.kritisch : runway < grenze.amber ? LEUCHT.achtung : LEUCHT.gut;
  async function speichern() {
    if (!fin) return;
    setSaving(true);
    try {
      await fetch('/api/state/finance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fin, cash: cashNum }) });
      setFin({ ...fin, cash: cashNum });
    } catch {
      /* lokal */
    }
    setSaving(false);
  }
  return (
    <Karte i={1}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={<Link href="/os/controlling" style={link}>Monatszahlen pflegen ›</Link>}>Runway-Rechner</Ueberschrift>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 160px', maxWidth: 220 }}>
          <span style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise }}>{ausKonten ? `Cash · ${kasse!.konten} Firmenkonten` : 'Cash aktuell'}</span>
          {ausKonten
            ? <div style={{ ...feld, fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} title={kasse!.stand ? `ältester Kontostand vom ${kasse!.stand}` : undefined}>{eur(cashNum)}</div>
            : <input
                value={cash}
                onChange={e => setCash(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={{ ...feld, fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              />}
        </label>
        {!ausKonten && <Knopf onClick={speichern} aus={saving || !fin} farbe={LEUCHT.geld}>{saving ? '…' : 'Übernehmen'}</Knopf>}
        <div style={{ flex: '1 1 160px' }}>
          <Zahl wert={runway == null ? undefined : `${runway.toFixed(1).replace('.', ',')} Monate`} label={burn > 0 ? `reicht bei Ø Burn ${eur(burn)}/Monat` : 'trag Kosten im Controlling ein, dann rechnet es'} farbe={runwayFarbe} />
        </div>
      </div>
      <p style={{ ...absatz, marginTop: 16 }}>
        Der Runway ist die härteste Zahl im System: er sagt, wie lange du Entscheidungen aus Ruhe treffen kannst statt aus Druck.
      </p>
    </Karte>
  );
}

// ───────────────────────── Beziehung & Team ─────────────────────────
function WerkzeugSozial() {
  const [journal, setJournal] = useState<Record<string, { mood?: number }>>({});
  const [ritLog, setRitLog] = useState<Record<string, string[]>>({}); // Die Route liefert { journal } — nicht log/state. Vorher blieb die Kurve
  // deshalb immer leer, auch mit Einträgen.
  useEffect(() => {
    fetch('/api/state/journal')
      .then(r => r.json())
      .then(d => setJournal(d.journal ?? {}))
      .catch(() => {});
    fetch('/api/state/rituale')
      .then(r => r.json())
      .then(d => setRitLog(d.log ?? {}))
      .catch(() => {});
  }, []);
  const heute = localDay();
  const gehalten = new Set(ritLog[heute] ?? []);
  async function toggleRitual(id: string) {
    const an = !gehalten.has(id); // Sofort umschalten, danach bestätigen lassen — sonst fühlt es sich träge an.
    setRitLog(prev => {
      const tag = new Set(prev[heute] ?? []);
      if (an) tag.add(id); else tag.delete(id);
      return { ...prev, [heute]: Array.from(tag) };
    });
    try {
      const r = await fetch('/api/state/rituale', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, an, date: heute }) });
      const d = await r.json();
      if (d.log) setRitLog(d.log);
    } catch {
      /* lokal */
    }
  }
  const t14 = tage(14);
  const hatStimmung = t14.some(d => typeof journal[d]?.mood === 'number');
  const kern = TEAM.filter(t => t.kreis === 'kern');
  const partner = TEAM.filter(t => t.kreis !== 'kern');
  return (
    <>
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Link href="/os/gesundheit" style={link}>Journal ›</Link>}>Stimmung · 14 Tage</Ueberschrift>
        {!hatStimmung ? (
          <Leer>Diese Säule hat noch keine Datenquelle. Ein Journal-Eintrag pro Woche genügt, damit sie mitzählt.</Leer>
        ) : (
          <Balken werte={t14.map(d => (typeof journal[d]?.mood === 'number' ? (journal[d]!.mood as number) : null))} max={5} farbe={LEUCHT.beziehung} hoehe={60} titel={t14.map(d => `${kurzDatum(d)} · ${journal[d]?.mood ?? '—'}/5`)} />
        )}
      </Karte>
      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.beziehung} rechts="Antippen, wenn gehalten">Rituale — was die Beziehung trägt</Ueberschrift>
        <Liste>
          {RITUALE.map(r => {
            const an = gehalten.has(r.id);
            return (
              <Zeile key={r.id} onClick={() => toggleRitual(r.id)} aktiv={an}
                links={<Haken an={an} onChange={() => toggleRitual(r.id)} farbe={LEUCHT.beziehung} />}
                titel={<span style={{ color: an ? LEUCHT.gut : C.ink }}>{r.name}</span>}
                unter={<span title={r.warum}>{r.warum}</span>}
                rechts={<Chip farbe={C.inkDim}>{r.rhythmus}</Chip>} />
            );
          })}
        </Liste>
        <p style={{ fontSize: 12, color: C.inkLeise, margin: '10px 0 0' }}>Zählt in die Säule ein.</p>
      </Karte>
      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.beziehung} rechts="aus dem Miro-Strategieboard">Wer was trägt</Ueberschrift>
        <Liste>
          {[...kern, ...partner].map(t => (
            <Zeile key={t.name}
              titel={<span style={{ color: t.kreis === 'privat' ? LEUCHT.beziehung : C.ink }}>{t.kurz}</span>}
              unter={<span title={t.bereiche.join(' · ')}>{t.bereiche.join(' · ')}</span>}
              rechts={<Chip farbe={t.kreis === 'kern' ? LEUCHT.beziehung : C.inkLeise}>{t.kreis}</Chip>} />
          ))}
        </Liste>
        <p style={{ fontSize: 12, color: C.inkLeise, margin: '10px 0 0' }}>Die Grundlage für jede Delegation.</p>
      </Karte>
    </>
  );
}

// Verbindung, nach der der Rückblick-Loop selbst gefragt hat: hängt die
// Tagesform mit dem zusammen, was tatsächlich fertig wurde?
function WerkzeugZusammenhang() {
  const [vit, setVit] = useState<Record<string, { rec?: number; sleep?: number }>>({});
  const [tasks, setTasks] = useState<{ completedAt?: string; status: string }[]>([]);
  useEffect(() => {
    fetch('/api/state/vitals')
      .then(r => r.json())
      .then(d => setVit(d.log ?? {}))
      .catch(() => {});
    fetch('/api/state/tasks')
      .then(r => r.json())
      .then(d => setTasks(d.state?.tasks ?? []))
      .catch(() => {});
  }, []);
  const t21 = tage(21);
  const zeilen = t21.map(d => ({ d, rec: vit[d]?.rec, fertig: tasks.filter(t => t.completedAt?.slice(0, 10) === d).length })).filter(z => z.rec != null);
  if (zeilen.length < 5) {
    return (
      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={`${zeilen.length} von 5 Tagen`}>Zusammenhang · Tagesform & Erledigtes</Ueberschrift>
        <Leer>
          Ab etwa fünf Tagen mit Morgen-Check zeige ich hier, ob niedrige Recovery und liegengebliebene Aufgaben zusammenfallen — der Zusammenhang, den man im Alltag nie sieht.
          {' '}Aktuell {zeilen.length} von 5.
        </Leer>
      </Karte>
    );
  }
  const gute = zeilen.filter(z => (z.rec as number) >= 60);
  const schlechte = zeilen.filter(z => (z.rec as number) < 60);
  const schnitt = (a: typeof zeilen) => (a.length ? a.reduce((s, z) => s + z.fertig, 0) / a.length : 0);
  const gS = schnitt(gute),
    sS = schnitt(schlechte);
  const spanne = Math.max(1, ...zeilen.map(z => z.fertig));
  const titel = zeilen.map(z => `${kurzDatum(z.d)} · Recovery ${z.rec}, ${z.fertig} erledigt`);
  return (
    <Karte i={3}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={`${zeilen.length} Tage`}>Zusammenhang · Tagesform & Erledigtes</Ueberschrift>
      <Balken werte={zeilen.map(z => z.fertig)} max={spanne} farbe={LEUCHT.puls} hoehe={44} titel={titel} />
      <div style={{ marginTop: 6 }}>
        <Balken werte={zeilen.map(z => z.rec as number)} max={100} farbe={LEUCHT.gut} hoehe={28} titel={titel} />
      </div>
      <div style={legende}>oben erledigt · unten Recovery</div>
      <p style={{ ...absatz, marginTop: 14 }}>
        An Tagen mit Recovery ab 60 wurden im Schnitt <b style={{ color: LEUCHT.gut }}>{gS.toFixed(1)}</b> Aufgaben fertig, darunter{' '}
        <b style={{ color: sS < gS ? LEUCHT.achtung : LEUCHT.gut }}>{sS.toFixed(1)}</b>.
        {gute.length >= 3 && schlechte.length >= 3
          ? gS - sS >= 0.7
            ? ' Der Zusammenhang ist da — an schwachen Tagen weniger vornehmen ist keine Schwäche, sondern Rechnen.'
            : ' Bisher kein klarer Zusammenhang — deine Ausführung hängt offenbar an etwas anderem als der Erholung.'
          : ' Für ein Urteil fehlen noch Tage in beiden Gruppen.'}
      </p>
    </Karte>
  );
}

const WERKZEUGE: Record<string, () => JSX.Element> = {
  health: () => (
    <>
      <WerkzeugGesundheit />
      <WerkzeugZusammenhang />
    </>
  ),
  business: WerkzeugBusiness,
  planning: WerkzeugPlanung,
  finance: WerkzeugFinanzen,
  social: WerkzeugSozial,
};

// ───────────────────────── Rahmen ─────────────────────────
export function SaeuleView({ keyName }: { keyName: string }) {
  const [idx, setIdx] = useState<PerfIndex | null>(null);
  const meta = SAEULEN_META[keyName];
  useEffect(() => {
    fetch('/api/performance')
      .then(r => r.json())
      .then(d => setIdx(d.aktuell))
      .catch(() => {});
  }, []);
  const s: Saeule | undefined = idx?.saeulen.find(x => x.key === keyName);
  const Werkzeug = WERKZEUGE[keyName];
  if (!meta) return null;
  const saeulenFarbe = SAEULEN_FARBE[keyName] ?? C.inkLeise;
  const zone = col(s?.score ?? null);
  const abdeckung = s ? Math.round(s.abdeckung * 100) : null;
  const echt = (s?.faktoren ?? []).filter(f => f.echt).length;
  return (
    <Seite titel={meta.titel} unter={<>{meta.claim} <span style={{ color: C.inkLeise }}>· {meta.hin}</span></>}
      rechts={<Link href="/os/wachstum" className="fassbar" style={linkKnopf}>Wachstum ›</Link>}>
      {/* Wert + Herleitung */}
      <Karte i={0} akzent={s?.score != null ? zone : undefined}>
        <Ueberschrift farbe={s ? zone : C.inkLeise} rechts={s?.zuDuenn ? <Chip farbe={LEUCHT.achtung}>zählt noch nicht mit</Chip> : undefined}>Die Säule</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,44px)', alignItems: 'center' }}>
          <Ring groesse="gross" label={meta.titel} wert={s?.score != null ? String(s.score) : undefined} farbe={zone} anteil={s?.score != null ? s.score / 100 : undefined} />
          <div style={{ minWidth: 0, width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
              <Zahl wert={s ? String(Math.round(s.gewicht * 100)) : undefined} label="% Gewicht im Index" farbe={saeulenFarbe} />
              <Zahl wert={abdeckung ? String(abdeckung) : undefined} label="% Datenbasis" farbe={abdeckung != null ? (abdeckung >= 40 ? LEUCHT.gut : LEUCHT.achtung) : undefined} />
              <Zahl wert={echt ? String(echt) : undefined} label={s?.faktoren.length ? `von ${s.faktoren.length} Faktoren echt gemessen` : 'Faktoren'} />
            </div>
            {s?.zuDuenn && <p style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, margin: '12px 0 0' }}>Datenbasis unter 40 % — die Säule zählt noch nicht mit.</p>}
          </div>
        </div>
        {!!s?.faktoren.length && (
          <div style={{ marginTop: 18 }}>
            {s.faktoren.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr 44px', alignItems: 'center', gap: 12, padding: '6px 0', opacity: f.echt ? 1 : 0.6 }}>
                <span style={{ fontSize: TYP.bedien, color: f.echt ? C.ink : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${f.label}${f.quelle ? ` · ${f.quelle}` : ''}`}>
                  {f.label}<span style={{ color: f.echt ? C.inkLeise : LEUCHT.achtung, marginLeft: 8, fontSize: 11.5 }}>{f.quelle}</span>
                </span>
                <Fortschritt anteil={f.echt ? f.wert / 100 : 0} farbe={f.echt ? col(f.wert) : saeulenFarbe} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums', color: f.echt ? col(f.wert) : C.inkLeise, textAlign: 'right' }}>{f.echt ? f.wert : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Karte>
      {/* Werkzeuge */}
      {Werkzeug ? <Werkzeug /> : null}
    </Seite>
  );
}
